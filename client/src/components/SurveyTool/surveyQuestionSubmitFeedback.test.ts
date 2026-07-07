import {
  buildClearedTransientSubmitFeedbackState,
  buildQuestionPoolPendingSubmitFeedbackMessage,
  buildTransientSubmitFeedbackState,
  normalizeTransientSubmitFeedbackDurationMs,
} from './surveyQuestionSubmitFeedback.js';

describe('surveyQuestionSubmitFeedback', () => {
  it('builds the transient submit feedback patch for full and pile flows', () => {
    expect(
      buildTransientSubmitFeedbackState({
        message: '  Saved ',
      }),
    ).toEqual({
      submissionError: 'Saved',
    });

    expect(
      buildTransientSubmitFeedbackState({
        message: '',
        mirrorToPileSubmitText: true,
      }),
    ).toEqual({
      submissionError: '',
      pileSubmitTempText: null,
    });
  });

  it('builds the cleared transient submit feedback patch', () => {
    expect(buildClearedTransientSubmitFeedbackState()).toEqual({
      submissionError: '',
    });

    expect(
      buildClearedTransientSubmitFeedbackState({
        mirrorToPileSubmitText: true,
      }),
    ).toEqual({
      submissionError: '',
      pileSubmitTempText: null,
    });
  });

  it('normalizes transient submit feedback duration with the existing minimum/default behavior', () => {
    expect(normalizeTransientSubmitFeedbackDurationMs()).toBe(2000);
    expect(normalizeTransientSubmitFeedbackDurationMs(500)).toBe(1000);
    expect(normalizeTransientSubmitFeedbackDurationMs(0)).toBe(2000);
    expect(normalizeTransientSubmitFeedbackDurationMs('1500')).toBe(1500);
  });

  it('builds the question-pool pending submit feedback message', () => {
    expect(
      buildQuestionPoolPendingSubmitFeedbackMessage({
        pendingCount: 1,
      }),
    ).toBe('Loading 1 more question...');

    expect(
      buildQuestionPoolPendingSubmitFeedbackMessage({
        pendingCount: 2,
      }),
    ).toBe('Loading 2 more questions...');
  });
});
