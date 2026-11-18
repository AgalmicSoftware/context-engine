import React from 'react';
import { render } from '@testing-library/react';

import * as pileHalfRowCut from './pileHalfRowCut';
import { QuadraticScrollControlsSlot } from './QuadraticScrollControls';
import {
  renderPileActiveQuestionCard,
  renderPileCardShell,
  renderPileGatedPromptCard,
  type PileActiveQuestionLike,
} from './surveyPileActiveQuestionCard';

type TestTreeNode = React.ReactNode;
type TestElementNode = React.ReactElement<{
  children?: React.ReactNode;
  className?: string;
  [key: string]: unknown;
}>;
type TestTreePredicate = (node: unknown) => boolean;

const isElementNode = (node: unknown): node is TestElementNode => React.isValidElement(node);

const findElement = (node: TestTreeNode, predicate: TestTreePredicate): unknown => {
  const stack: unknown[] = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    if (!isElementNode(current)) continue;
    const children = current.props.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const nodeHasClassName = (node: unknown, className: string): boolean => {
  if (!isElementNode(node)) return false;
  const value = node.props.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

describe('surveyPileActiveQuestionCard', () => {
  it('renders the pile card shell with prompt, main content, and footer sections', () => {
    const tree = renderPileCardShell({
      promptHeader: <span data-testid="prompt-header">Prompt</span>,
      questionComponent: <div data-testid="question-component">Answer input</div>,
      questionContainerClass: 'customQuestionContainer',
      footerSection: <div data-testid="footer-section">Footer</div>,
    });

    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'prompt-header'),
    ).not.toBeNull();
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'question-component'),
    ).not.toBeNull();
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'footer-section'),
    ).not.toBeNull();
    expect(findElement(tree, (node) => nodeHasClassName(node, 'customQuestionContainer'))).not.toBeNull();
    // The answer area is a component of its own (it keeps a long list ending partway through an option).
    const { container } = render(tree);
    expect(container.querySelector('.pileCardMainContent .customQuestionContainer')).not.toBeNull();
  });

  it('renders the pile gated prompt card without the main content shell', () => {
    const tree = renderPileGatedPromptCard({
      promptHeader: <span data-testid="prompt-header">Prompt</span>,
      gatedPromptNotice: <div data-testid="gated-notice">Locked</div>,
    });

    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'prompt-header'),
    ).not.toBeNull();
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'gated-notice'),
    ).not.toBeNull();
    expect(findElement(tree, (node) => nodeHasClassName(node, 'pileCardMainContent'))).toBeNull();
  });

  it('renders the unmasked pile question path through the shared shell and skips the masked callback', () => {
    const renderQuestionMaskedPromptCard = jest.fn(() => <div data-testid="masked-card">Masked</div>);
    const question: PileActiveQuestionLike = { id: 'q2' };

    const tree = renderPileActiveQuestionCard({
      question,
      promptMasked: false,
      renderQuestionMaskedPromptCard,
      promptHeader: <span data-testid="prompt-header">Prompt</span>,
      questionComponent: <div data-testid="question-component">Answer input</div>,
      questionContainerClass: 'customQuestionContainer',
      footerSection: <div data-testid="footer-section">Footer</div>,
    });

    expect(renderQuestionMaskedPromptCard).not.toHaveBeenCalled();
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'prompt-header'),
    ).not.toBeNull();
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'question-component'),
    ).not.toBeNull();
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'footer-section'),
    ).not.toBeNull();
    expect(findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'masked-card')).toBeNull();
  });

  it('delegates masked prompts through the shared masked-card callback', () => {
    const renderQuestionMaskedPromptCard = jest.fn(() => <div data-testid="masked-card">Masked</div>);
    const question: PileActiveQuestionLike = { id: 'q1' };

    const tree = renderPileActiveQuestionCard({
      question,
      promptMasked: true,
      renderQuestionMaskedPromptCard,
      promptHeader: <span data-testid="prompt-header">Prompt</span>,
      questionComponent: <div data-testid="question-component">Answer input</div>,
      questionContainerClass: 'customQuestionContainer',
      footerSection: <div data-testid="footer-section">Footer</div>,
    });

    expect(renderQuestionMaskedPromptCard).toHaveBeenCalledWith({
      mode: 'pile',
      question,
    });
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'masked-card'),
    ).not.toBeNull();
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'question-component'),
    ).toBeNull();
  });
});

describe('the answer area’s scroll chevrons', () => {
  it('shows the quadratic card’s chevrons in the footer while choices are out of view', () => {
    const cue = jest.spyOn(pileHalfRowCut, 'usePileHalfRowCut');
    const renderCard = () =>
      render(
        renderPileCardShell({
          promptHeader: 'Who should decide?',
          questionComponent: <div>Choices</div>,
          questionContainerClass: 'multichoiceQuestionContainer',
          footerSection: (
            <div data-testid="footer">
              <QuadraticScrollControlsSlot />
            </div>
          ),
          questionType: 'multichoice',
        }),
      );
    try {
      cue.mockReturnValue('start');
      const { getByTestId, getByRole, queryByRole, unmount } = renderCard();
      const more = getByRole('button', { name: 'Scroll to more options' });
      // In the footer's slot, as on a quadratic card, and pointing at the list it scrolls.
      expect(getByTestId('footer')).toContainElement(more);
      expect(document.getElementById(more.getAttribute('aria-controls') || '')).toHaveTextContent('Choices');
      expect(queryByRole('button', { name: 'Scroll to previous options' })).not.toBeInTheDocument();
      unmount();

      cue.mockReturnValue('end');
      const atEnd = renderCard();
      expect(atEnd.getByRole('button', { name: 'Scroll to previous options' })).toBeInTheDocument();
      expect(atEnd.queryByRole('button', { name: 'Scroll to more options' })).not.toBeInTheDocument();
      atEnd.unmount();

      // A list that fits keeps the chevrons' place, empty, so the footer does not change as it comes and goes.
      cue.mockReturnValue('none');
      const fits = renderCard();
      expect(fits.queryByRole('button', { name: /^Scroll to/ })).not.toBeInTheDocument();
      expect(fits.getByTestId('footer').querySelector('.scrollControls')).toBeInTheDocument();
      fits.unmount();

      cue.mockReturnValue('off');
      const off = renderCard();
      expect(off.getByTestId('footer').querySelector('.scrollControls')).not.toBeInTheDocument();
      off.unmount();

      // Without the footer slot (the agent's question list), they never take a line of their own.
      cue.mockReturnValue('start');
      const noSlot = render(
        renderPileCardShell({
          promptHeader: 'Who should decide?',
          questionComponent: <div>Choices</div>,
          questionContainerClass: 'multichoiceQuestionContainer',
          footerSection: <div data-testid="footer" />,
          questionType: 'multichoice',
        }),
      );
      expect(noSlot.queryByRole('button', { name: /^Scroll to/ })).not.toBeInTheDocument();
      expect(noSlot.container.querySelector('.scrollControls')).not.toBeInTheDocument();
    } finally {
      cue.mockRestore();
    }
  });
});
