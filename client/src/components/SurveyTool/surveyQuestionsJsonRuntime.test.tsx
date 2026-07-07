import { createSurveyQuestionsJsonRuntime } from './surveyQuestionsJsonRuntime';

describe('surveyQuestionsJsonRuntime', () => {
  it('delegates comment toggles through the runtime strategy when present', () => {
    const toggleComments = jest.fn();
    const engine = {};
    const runtime = createSurveyQuestionsJsonRuntime({
      engine,
      getRuntimeStrategy: () => ({ toggleComments }),
      setState: jest.fn(),
    });

    runtime.toggleComments('q1', true);

    expect(toggleComments).toHaveBeenCalledWith(engine, 'q1', true);
  });

  it('falls back to the comments state builder when no strategy handles toggles', () => {
    const buildCommentsToggleState = jest.fn((prev, questionId, defaultOpen) => ({
      ...prev,
      showComments: {
        ...(prev.showComments || {}),
        [questionId]: defaultOpen,
      },
    }));
    const setState = jest.fn((updater) => updater({ showComments: {} }));
    const runtime = createSurveyQuestionsJsonRuntime({
      buildCommentsToggleState,
      engine: {},
      getRuntimeStrategy: () => ({}),
      setState,
    });

    runtime.toggleComments('q2', false);

    expect(buildCommentsToggleState).toHaveBeenCalledWith({ showComments: {} }, 'q2', false);
  });
});
