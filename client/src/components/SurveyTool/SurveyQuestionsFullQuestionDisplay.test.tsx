import React from 'react';

import { renderSurveyQuestionsFullQuestionDisplay } from './SurveyQuestionsFullQuestionDisplay';

const treeHasText = (node: React.ReactNode, text: string): boolean => {
  if (node == null) return false;
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (!React.isValidElement(node)) return false;
  return treeHasText(node.props.children, text);
};

const buildRenderers = () => ({
  renderAdditionalDecryptControl: jest.fn(() => <button type="button">Decrypt Comments</button>),
  renderAdditionalInput: jest.fn(() => <textarea aria-label="Additional comments" />),
  renderAdditionalLockControl: jest.fn(() => <button type="button">Lock Comments</button>),
  renderAnswerDecryptControl: jest.fn(() => <button type="button">Decrypt Answer</button>),
  renderFullQuestionCardShell: jest.fn((args) => (
    <section>
      <div>{args.mainContent}</div>
      <footer>
        {args.sliderSection}
        {args.footerIcons}
      </footer>
      <aside>{args.commentsSection}</aside>
    </section>
  )),
  renderFullQuestionFooterIcons: jest.fn(({ onToggleComments }) => (
    <button type="button" onClick={onToggleComments}>
      Toggle comments
    </button>
  )),
  renderFullQuestionSliderSection: jest.fn(() => <div>Slider</div>),
  renderResponseInput: jest.fn(() => <input aria-label="Answer" />),
});

describe('SurveyQuestionsFullQuestionDisplay', () => {
  it('orders full-question shell sections and preserves handler arguments', () => {
    const renderers = buildRenderers();
    const onToggleComments = jest.fn();

    const tree = renderSurveyQuestionsFullQuestionDisplay({
      ...renderers,
      cardIcons: <span>Links</span>,
      cardKey: 'q1-0',
      commentsOpen: true,
      displayState: {
        activeSliderValue: 7,
        additional: { value: 'notes' },
        allowDecryptAdditional: true,
        allowDecryptAnswer: false,
        answer: { value: '*' },
        convictionValue: 7,
        decryptTooltip: 'Connect wallet',
        glowAdditional: true,
        glowAnswer: false,
        hasAdditionalContent: true,
        hasConvictionImportanceValue: true,
        importanceValue: 4,
        isAdditionalDecrypting: false,
        isAnswerDecrypting: true,
        maskedAdditional: false,
        maskedAnswer: true,
        sliderMode: 'importance',
      },
      onToggleComments,
      qIndex: 2,
      question: { id: 'q1' },
      sliderOpen: true,
      surveyIndex: 3,
    });

    expect(treeHasText(tree, 'Decrypt Answer')).toBe(true);
    expect(treeHasText(tree, 'Slider')).toBe(true);
    expect(treeHasText(tree, 'Toggle comments')).toBe(true);
    expect(renderers.renderResponseInput).not.toHaveBeenCalled();
    expect(renderers.renderAdditionalInput).toHaveBeenCalledWith({
      qIndex: 2,
      surveyIndex: 3,
      questionId: 'q1',
      additional: { value: 'notes' },
      glowAdditional: true,
    });
    expect(renderers.renderAnswerDecryptControl).toHaveBeenCalledWith({
      questionId: 'q1',
      fieldKey: 'answer',
      allowDecrypt: false,
      decryptTooltip: 'Connect wallet',
      actionLabel: 'Decrypt Answer',
      busy: true,
    });
    expect(renderers.renderFullQuestionSliderSection).toHaveBeenCalledWith({
      surveyIndex: 3,
      questionId: 'q1',
      sliderMode: 'importance',
      activeSliderValue: 7,
      convictionValue: 7,
      importanceValue: 4,
      hasConvictionImportanceValue: true,
      sliderOpen: true,
    });
    expect(renderers.renderFullQuestionCardShell).toHaveBeenCalledWith(
      expect.objectContaining({
        cardKey: 'q1-0',
        question: { id: 'q1' },
        cardIcons: <span>Links</span>,
      }),
    );

    renderers.renderFullQuestionFooterIcons.mock.calls[0][0].onToggleComments();

    expect(onToggleComments).toHaveBeenCalledWith('q1', true);
  });

  it('renders answer input and comment decrypt display for masked comments', () => {
    const renderers = buildRenderers();

    const tree = renderSurveyQuestionsFullQuestionDisplay({
      ...renderers,
      cardIcons: null,
      cardKey: 'q2-0',
      commentsOpen: true,
      displayState: {
        answer: { value: 'ready' },
        allowDecryptAdditional: false,
        decryptTooltip: 'Login required',
        hasAdditionalContent: true,
        isAdditionalDecrypting: true,
        maskedAdditional: true,
        maskedAnswer: false,
      },
      onToggleComments: jest.fn(),
      qIndex: 0,
      question: { id: 'q2' },
      surveyIndex: 0,
    });

    expect(treeHasText(tree, 'Decrypt Comments')).toBe(true);
    expect(renderers.renderResponseInput).toHaveBeenCalledWith({
      question: { id: 'q2' },
      qIndex: 0,
      surveyIndex: 0,
      answer: { value: 'ready' },
      glowAnswer: false,
    });
    expect(renderers.renderAdditionalDecryptControl).toHaveBeenCalledWith({
      questionId: 'q2',
      fieldKey: 'additional',
      allowDecrypt: false,
      decryptTooltip: 'Login required',
      actionLabel: 'Decrypt Comments',
      busy: true,
    });
    expect(renderers.renderAdditionalLockControl).not.toHaveBeenCalled();
  });
});
