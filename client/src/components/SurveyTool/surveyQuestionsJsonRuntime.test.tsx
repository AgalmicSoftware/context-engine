import { waitFor } from '@testing-library/react';
import { createSurveyQuestionsJsonRuntime } from './surveyQuestionsJsonRuntime';
import { captureSessionRecruitmentSource } from './sessionRecruitmentSource';

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

  it('passes the captured session recruitment source into response JSON payloads', () => {
    sessionStorage.clear();
    captureSessionRecruitmentSource('alpha', '?src=partner-outreach');
    const buildResponsePayload = jest.fn((_payload: unknown) => ({ responses: [] }));
    const runtime = createSurveyQuestionsJsonRuntime({
      buildResponsePayload,
      propsRef: { current: { sessionSlug: 'alpha', account: '0xUser' } },
      stateRef: {
        current: {
          questionPool: [{ id: 'q1', prompt: 'Question?' }],
          pileQuestions: [],
          surveysResponseState: [{ answers: { q1: { value: 'Yes' } }, additionalComments: {} }],
        },
      },
      resolveEffectiveSlug: () => 'alpha',
      resolveFieldEncryptionAudience: () => null,
      getQuestionEncryptionGates: () => [],
      resolveFieldEncryptionGateId: () => null,
      normalizeFieldAudienceMode: () => 'default',
      resolveResponseJsonContext: () => ({ sessionConfig: {} }),
      resolveSlugForIds: () => 'alpha',
      readSurveysCacheRef: () => ({}),
      surveyResponseStoragePort: {
        sanitizeQuestionPromptForResponsePayload: (q: { prompt?: string }) => q.prompt || '',
      },
      getConvictionFromSlice: () => null,
      getImportanceFromSlice: () => null,
      inst: { _surveyJsonMetaCache: {} },
    });

    runtime.prepareJsonAndHash(0);

    expect(buildResponsePayload).toHaveBeenCalledWith(
      expect.objectContaining({ recruitmentSource: 'partner-outreach' }),
    );
  });

  it('says when copying JSON is refused, and shows no copied tick', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    const notify = { success: jest.fn(), error: jest.fn() };
    const setState = jest.fn();
    const runtime = createSurveyQuestionsJsonRuntime({ notify, setState, buildCopiedQuestionsJsonState: jest.fn() });

    runtime.copyJsonToClipboard({ questions: [] }, 'questions');

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith("Copying isn't allowed here, so the JSON wasn't copied."),
    );
    expect(notify.success).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });
});
