import React from 'react';

import {
  renderPileActiveQuestionCard,
  renderPileCardShell,
  renderPileGatedPromptCard,
} from './surveyPileActiveQuestionCard';

const findElement = (node: any, predicate: any) => {
  const stack = [node];
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
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const nodeHasClassName = (node: any, className: string) => {
  const value = node?.props?.className;
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

    expect(findElement(tree, (node: any) => node?.props?.['data-testid'] === 'prompt-header')).not.toBeNull();
    expect(findElement(tree, (node: any) => node?.props?.['data-testid'] === 'question-component')).not.toBeNull();
    expect(findElement(tree, (node: any) => node?.props?.['data-testid'] === 'footer-section')).not.toBeNull();
    expect(findElement(tree, (node: any) => nodeHasClassName(node, 'pileCardMainContent'))).not.toBeNull();
    expect(findElement(tree, (node: any) => nodeHasClassName(node, 'customQuestionContainer'))).not.toBeNull();
  });

  it('renders the pile gated prompt card without the main content shell', () => {
    const tree = renderPileGatedPromptCard({
      promptHeader: <span data-testid="prompt-header">Prompt</span>,
      gatedPromptNotice: <div data-testid="gated-notice">Locked</div>,
    });

    expect(findElement(tree, (node: any) => node?.props?.['data-testid'] === 'prompt-header')).not.toBeNull();
    expect(findElement(tree, (node: any) => node?.props?.['data-testid'] === 'gated-notice')).not.toBeNull();
    expect(findElement(tree, (node: any) => nodeHasClassName(node, 'pileCardMainContent'))).toBeNull();
  });

  it('delegates masked prompts through the shared masked-card callback', () => {
    const renderQuestionMaskedPromptCard = jest.fn(() => (
      <div data-testid="masked-card">Masked</div>
    ));

    const tree = renderPileActiveQuestionCard({
      question: { id: 'q1' },
      promptMasked: true,
      renderQuestionMaskedPromptCard,
      promptHeader: <span data-testid="prompt-header">Prompt</span>,
      questionComponent: <div data-testid="question-component">Answer input</div>,
      questionContainerClass: 'customQuestionContainer',
      footerSection: <div data-testid="footer-section">Footer</div>,
    });

    expect(renderQuestionMaskedPromptCard).toHaveBeenCalledWith({
      mode: 'pile',
      question: { id: 'q1' },
    });
    expect(findElement(tree, (node: any) => node?.props?.['data-testid'] === 'masked-card')).not.toBeNull();
    expect(findElement(tree, (node: any) => node?.props?.['data-testid'] === 'question-component')).toBeNull();
  });
});
