import { buildResponsePayload } from './surveyToolResponsePayloadController';
import { recordInterviewProvenance, submitSessionInterviewResponses } from './SurveyPileViewMode';
import type { PileViewModeEngine } from './surveyPileRuntimeBinding';
import { responseValuesEqual } from './responseValueEquality';

// The responder already saved q1 = "Agree" without a responder name. They reopen the
// interview, tick "Include “Fixture Responder” as the responder name" and submit the same answer.
it('a newly opted-in responder name is not reported as "already saved" without being sent', async () => {
  const saved = {
    answers: { q1: { value: 'Agree' } },
    additionalComments: { q1: { value: '' } },
    importance: {},
    conviction: {},
  };
  const state: Record<string, any> = {
    isSubmitting: false,
    userAnswers: { responses: [{ questionID: 'q1', answer: { value: 'Agree' } }] },
    surveysResponseState: [JSON.parse(JSON.stringify(saved))],
  };
  let uploaded: ReturnType<typeof buildResponsePayload> | undefined;
  const handlePileSubmitClick = jest.fn(async () => {
    uploaded = buildResponsePayload({
      isStandalone: true,
      singleQuestionMode: false,
      surveyId: 'fixture-survey',
      account: '0x0000000000000000000000000000000000000001',
      surveyIndex: 0,
      surveyResponseState: state.surveysResponseState[0],
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Fixture question' }],
      pileQuestions: [],
      resolveFieldEncryptionAudience: () => 'self',
      getQuestionEncryptionGates: () => [],
      resolveFieldEncryptionGateId: () => null,
      normalizeFieldAudienceMode: () => 'explicit',
      getSurveyMetadataForJson: () => ({ surveyTitle: null, sessionName: '' }),
      resolveSessionContext: () => ({ sessionName: '' }),
      getConvictionFromSlice: () => null,
      getImportanceFromSlice: () => null,
      sanitizeQuestionPromptForResponsePayload: (q) => String(q.prompt || ''),
    });
    return { status: 'submitted' as const };
  });
  const engine = {
    props: { loginComplete: true, account: '0x0000000000000000000000000000000000000001' },
    get state() {
      return state;
    },
    setState: (updater: any, callback?: () => void) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      Object.assign(state, patch);
      callback?.();
    },
    persistDraft: jest.fn(),
    getChangedQidsAndFields: () => ({ changedQids: new Set<string>() }),
    getSubmitCount: () => 0, // no answer/comment/importance/conviction change
    buildSliceFromUserAnswers: () => saved,
    valuesEqual: (a: unknown, b: unknown) => responseValuesEqual(a, b, true),
    handlePileSubmitClick,
  } as unknown as PileViewModeEngine;

  // SessionVoiceModeModal records the consent choice first (sessionInterviewDraftSubmit.ts:169-186)...
  await recordInterviewProvenance(
    engine,
    [{ questionId: 'q1', answer: 'Agree' }],
    { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
    null,
    true,
    false,
    'Fixture Responder',
  );
  expect(state.surveysResponseState[0].interviewProvenance.q1.responderName).toBe('Fixture Responder');

  // ...then asks the pile to submit (sessionInterviewDraftSubmit.ts:189).
  const result = await submitSessionInterviewResponses(engine, ['q1']);
  // The modal shows "Responses already saved" for this result, but nothing carried the name.
  expect(result).toEqual({ status: 'submitted' });
  expect(handlePileSubmitClick).toHaveBeenCalledTimes(1);
  expect(uploaded?.responses?.[0]).toMatchObject({
    responderName: 'Fixture Responder',
    answer: { value: 'Agree' },
    interviewProvenance: { source: { platform: 'claude' } },
  });
});
