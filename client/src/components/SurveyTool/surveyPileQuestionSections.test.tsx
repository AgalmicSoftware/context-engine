import React from 'react';

import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import {
  buildPileQuestionCommentButtonClassName,
  renderPileAdditionalEditorRow,
  renderPileCommentsSection,
  renderPileQuestionIcons,
  renderPileFooterSection,
  resolvePileQuestionCommentIconClassName,
} from './surveyPileQuestionSections';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type TestTreeNode = React.ReactNode;
type TestElementNode = React.ReactElement<{
  children?: React.ReactNode;
  className?: string;
  [key: string]: unknown;
}>;
type InlineRowElementNode = React.ReactElement<{
  input: React.ReactNode;
  lockControl: React.ReactNode;
}>;
type CommentsButtonElementNode = React.ReactElement<{
  onClick: () => void;
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

describe('surveyPileQuestionSections', () => {
  it('renders the pile additional editor row through AdditionalCommentsInlineRow', () => {
    const tree = renderPileAdditionalEditorRow({
      input: <div data-testid="additional-input">Input</div>,
      lockControl: <div data-testid="additional-lock">Lock</div>,
    });

    const inlineRow = findElement(
      tree,
      (node) => isElementNode(node) && node.type === AdditionalCommentsInlineRow,
    ) as InlineRowElementNode | null;

    expect(inlineRow).not.toBeNull();
    expect(
      findElement(
        inlineRow?.props.input,
        (node) => isElementNode(node) && node.props['data-testid'] === 'additional-input',
      ),
    ).not.toBeNull();
    expect(
      findElement(
        inlineRow?.props.lockControl,
        (node) => isElementNode(node) && node.props['data-testid'] === 'additional-lock',
      ),
    ).not.toBeNull();
  });

  it('renders masked or unmasked pile comments based on the masked flag and visibility', () => {
    const maskedTree = renderPileCommentsSection({
      showComments: true,
      maskedAdditional: true,
      decryptAdditionalControl: <div data-testid="decrypt-comments">Decrypt</div>,
      additionalEditorRow: <div data-testid="editor-row">Editor</div>,
    });
    const unmaskedTree = renderPileCommentsSection({
      showComments: true,
      maskedAdditional: false,
      decryptAdditionalControl: <div data-testid="decrypt-comments">Decrypt</div>,
      additionalEditorRow: <div data-testid="editor-row">Editor</div>,
    });

    expect(
      findElement(maskedTree, (node) => isElementNode(node) && node.props['data-testid'] === 'decrypt-comments'),
    ).not.toBeNull();
    expect(
      findElement(maskedTree, (node) => isElementNode(node) && node.props['data-testid'] === 'editor-row'),
    ).toBeNull();
    expect(
      findElement(unmaskedTree, (node) => isElementNode(node) && node.props['data-testid'] === 'editor-row'),
    ).not.toBeNull();
    expect(
      renderPileCommentsSection({
        showComments: false,
        maskedAdditional: false,
        decryptAdditionalControl: <div />,
        additionalEditorRow: <div />,
      }),
    ).toBeNull();
  });

  it('renders pile question icons with active comment state and forwards the toggle callback', () => {
    const onToggleComments = jest.fn();
    const tree = renderPileQuestionIcons({
      questionId: 'Q1',
      hasAdditionalContent: true,
      onToggleComments,
      answerLockControl: <div data-testid="answer-lock">Lock</div>,
    });
    const commentsButton = findElement(
      tree,
      (node) => isElementNode(node) && node.props['data-testid'] === E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE,
    ) as CommentsButtonElementNode | null;

    expect(commentsButton).not.toBeNull();
    expect(nodeHasClassName(commentsButton, 'iconButtonActive')).toBe(true);
    expect(commentsButton?.props['data-ce-question-id']).toBe('q1');
    commentsButton?.props.onClick();
    expect(onToggleComments).toHaveBeenCalledTimes(1);
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'answer-lock'),
    ).not.toBeNull();
  });

  it('renders the pile footer with control row and optional comments section', () => {
    const tree = renderPileFooterSection({
      sliderSection: <div data-testid="slider-section">Slider</div>,
      questionIcons: <div data-testid="question-icons">Icons</div>,
      commentsSection: <div data-testid="comments-section">Comments</div>,
    });

    expect(findElement(tree, (node) => nodeHasClassName(node, 'pileControlsRow'))).not.toBeNull();
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'slider-section'),
    ).not.toBeNull();
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'question-icons'),
    ).not.toBeNull();
    expect(
      findElement(tree, (node) => isElementNode(node) && node.props['data-testid'] === 'comments-section'),
    ).not.toBeNull();
  });

  it('builds pile question comment display helpers', () => {
    expect(
      buildPileQuestionCommentButtonClassName({
        activeClassName: 'active',
        baseClassName: 'base',
        commentClassName: 'comment',
        hasAdditionalContent: true,
      }),
    ).toBe('base comment active');
    expect(
      buildPileQuestionCommentButtonClassName({
        activeClassName: 'active',
        baseClassName: 'base',
        commentClassName: 'comment',
        hasAdditionalContent: false,
      }),
    ).toBe('base comment');
    expect(
      resolvePileQuestionCommentIconClassName({
        glowClassName: 'glow',
        hasAdditionalContent: true,
      }),
    ).toBe('glow');
    expect(
      resolvePileQuestionCommentIconClassName({
        glowClassName: 'glow',
        hasAdditionalContent: false,
      }),
    ).toBeUndefined();
  });
});
