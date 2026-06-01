import React from 'react';
import { InputGroup } from 'reactstrap';

import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import { buildSurveyQuestionsFullQuestionContentSections } from './SurveyQuestionsFullQuestionContentSections';

const findFirstNodeByType = (node, type) => {
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
    if (current.type === type) return current;
    const children = current.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const treeHasText = (node, text) => {
  if (node == null) return false;
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node !== 'object') return false;
  return treeHasText(node.props?.children, text);
};

const buildRenderers = () => ({
  renderAdditionalDecryptControl: jest.fn(() => <button type="button">Decrypt Comments</button>),
  renderAdditionalInput: jest.fn(() => <textarea aria-label="Additional comments" />),
  renderAdditionalLockControl: jest.fn(() => <button type="button">Lock Comments</button>),
  renderAnswerDecryptControl: jest.fn(() => <button type="button">Decrypt Answer</button>),
  renderResponseInput: jest.fn(() => <input aria-label="Answer" />),
});

describe('SurveyQuestionsFullQuestionContentSections', () => {
  it('wraps visible answers without rendering closed comment controls', () => {
    const renderers = buildRenderers();

    const sections = buildSurveyQuestionsFullQuestionContentSections({
      ...renderers,
      commentsOpen: false,
      maskedAnswer: false,
      maskedAdditional: false,
    });

    const inputGroup = findFirstNodeByType(sections.mainContent, InputGroup);

    expect(inputGroup).not.toBeNull();
    expect(inputGroup.props.children.type).toBe('input');
    expect(sections.commentsSection).toBeNull();
    expect(renderers.renderResponseInput).toHaveBeenCalledTimes(1);
    expect(renderers.renderAnswerDecryptControl).not.toHaveBeenCalled();
    expect(renderers.renderAdditionalInput).not.toHaveBeenCalled();
    expect(renderers.renderAdditionalLockControl).not.toHaveBeenCalled();
  });

  it('shows answer decrypt content while allowing plaintext additional comments', () => {
    const renderers = buildRenderers();

    const sections = buildSurveyQuestionsFullQuestionContentSections({
      ...renderers,
      commentsOpen: true,
      maskedAnswer: true,
      maskedAdditional: false,
    });

    expect(treeHasText(sections.mainContent, 'Decrypt Answer')).toBe(true);
    expect(findFirstNodeByType(sections.commentsSection, 'textarea')).not.toBeNull();
    expect(renderers.renderAnswerDecryptControl).toHaveBeenCalledTimes(1);
    expect(renderers.renderAdditionalInput).toHaveBeenCalledTimes(1);
    expect(renderers.renderAdditionalDecryptControl).not.toHaveBeenCalled();
  });

  it('uses comment decrypt display for masked additional content', () => {
    const renderers = buildRenderers();

    const sections = buildSurveyQuestionsFullQuestionContentSections({
      ...renderers,
      commentsOpen: true,
      maskedAnswer: false,
      maskedAdditional: true,
    });

    expect(treeHasText(sections.commentsSection, 'Decrypt Comments')).toBe(true);
    expect(renderers.renderAdditionalDecryptControl).toHaveBeenCalledTimes(1);
    expect(renderers.renderAdditionalInput).not.toHaveBeenCalled();
    expect(renderers.renderAdditionalLockControl).not.toHaveBeenCalled();
  });

  it('renders editable additional comments with their lock control', () => {
    const renderers = buildRenderers();

    const sections = buildSurveyQuestionsFullQuestionContentSections({
      ...renderers,
      commentsOpen: true,
      maskedAnswer: false,
      maskedAdditional: false,
    });

    const row = findFirstNodeByType(sections.commentsSection, AdditionalCommentsInlineRow);

    expect(row).not.toBeNull();
    expect(row.props.input.type).toBe('textarea');
    expect(treeHasText(row.props.lockControl, 'Lock Comments')).toBe(true);
    expect(renderers.renderAdditionalInput).toHaveBeenCalledTimes(1);
    expect(renderers.renderAdditionalLockControl).toHaveBeenCalledTimes(1);
  });
});
