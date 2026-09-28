import { fireEvent, render, screen } from '@testing-library/react';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';

jest.mock('./CreateQuestionsAndSurveys', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('div') };
});
jest.mock('./SessionListeningPanel', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('div') };
});

const question = { id: '0xq', type: 'quadratic', prompt: 'Split', options: ['Parks', 'Transit'], voiceCredits: 99 };

const createEngine = (state = {}) => {
  const engine = {
    props: { loginComplete: false, account: '' },
    state: { editBaseline: null, userAnswers: null, isSubmitting: false },
    setState: jest.fn(),
    buildSliceFromUserAnswers: () => null,
    buildSliceFromLocalCache: () => null,
  };
  try {
    createPileViewRuntimeStrategy().buildInitialState(engine);
  } catch (_) {
    // Only the attached render methods are needed here.
  }
  engine.state = { editBaseline: null, userAnswers: null, isSubmitting: false, ...state };
  engine.handleAnswerPile = jest.fn();
  return engine;
};

const renderQuadratic = (engine, props) =>
  render(
    engine.renderPileResponseInput({ question, inputNamePrefix: 'interview-draft', enableAiRewrite: false, ...props }),
  );

const isEmptyOrNeutral = (value) => value === '' || (Array.isArray(value) && value.every((vote) => vote === 0));

describe('quadratic Reset in interview draft editors', () => {
  it('leaves an untouched AI allocation alone', () => {
    const onAnswerChange = jest.fn();
    renderQuadratic(createEngine(), { answer: { value: [3, -2] }, onAnswerChange, answerResetValue: [3, -2] });

    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(reset).toHaveAttribute('title', 'Undo answer changes');
    expect(reset).toBeDisabled();
    fireEvent.click(reset);
    expect(onAnswerChange).not.toHaveBeenCalled();
  });

  it('undoes edits back to the AI allocation instead of clearing it', () => {
    const onAnswerChange = jest.fn();
    renderQuadratic(createEngine(), { answer: { value: [1, 1] }, onAnswerChange, answerResetValue: [3, -2] });

    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(onAnswerChange.mock.calls).toEqual([[[3, -2]]]);
    expect(onAnswerChange.mock.calls.some(([value]) => isEmptyOrNeutral(value))).toBe(false);
  });

  it('restores an all-zero AI allocation as a valid answer', () => {
    const onAnswerChange = jest.fn();
    const { unmount } = renderQuadratic(createEngine(), {
      answer: { value: [2, 0] },
      onAnswerChange,
      answerResetValue: [0, 0],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onAnswerChange.mock.calls).toEqual([[[0, 0]]]);
    unmount();

    renderQuadratic(createEngine(), { answer: { value: [0, 0] }, onAnswerChange, answerResetValue: [0, 0] });
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });
});

describe('quadratic Reset in the pile', () => {
  const savedState = { editBaseline: { answers: { '0xq': { value: [1, 2] } } } };

  it('undoes an edited allocation to the saved answer', () => {
    const engine = createEngine(savedState);
    renderQuadratic(engine, { answer: { value: [3, -2] } });

    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(reset).toHaveAttribute('title', 'Undo answer changes');
    fireEvent.click(reset);
    expect(engine.handleAnswerPile).toHaveBeenCalledWith('0xq', [1, 2]);
  });

  it('keeps Reset disabled for an untouched saved allocation', () => {
    const engine = createEngine(savedState);
    renderQuadratic(engine, { answer: { value: [1, 2] } });

    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });
});
