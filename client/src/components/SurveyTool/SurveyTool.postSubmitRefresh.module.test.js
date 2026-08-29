import {
  resolveSurveyQuestionsSubmittedResponseUrl,
  runSurveyQuestionsSubmitSuccessController,
} from './surveyQuestionsSubmitController';
import { filterChangedResponsesForSubmit, normalizeSubmitReceipt } from './surveyToolSubmitTransactionController';
import { buildResponsePayload } from './surveyToolResponsePayloadController';
import { buildSubmissionGroupContext } from './surveyToolHydrationFlow';
import { normalizeSessionSlugValue } from './surveyToolScope';
import { normalizeQuestionIdKey } from './surveyToolSignatures';
import { getConvictionFromSlice, getImportanceFromSlice } from './surveyToolResponseState';

const HASH_ZERO = `0x${'0'.repeat(64)}`;
const TX_HASH = `0x${'9'.repeat(64)}`;

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const buildQuestionResponse = (overrides = {}) => ({
  questionID: 'q1',
  responder: '0xabc',
  type: 'freeform',
  prompt: 'Prompt 1',
  answer: { value: 'yes', encrypted: false },
  additional: { value: '', encrypted: false },
  ...overrides,
});

const buildSurveyResponse = (response = buildQuestionResponse(), overrides = {}) => ({
  surveyID: '0xsurvey',
  responder: '0xabc',
  surveyTitle: 'Survey 1',
  responses: [response],
  ...overrides,
});

const createSubmitContext = (overrides = {}) => ({
  account: '0xabc',
  effectiveDraftSlug: 'edge',
  isStandalone: false,
  mounted: true,
  providerKind: 'browser',
  questionID: '',
  singleQuestionMode: false,
  surveyId: '0xsurvey',
  surveyIndex: 0,
  ...overrides,
});

const createSubmitContextKey = (context = {}) =>
  [
    String(context.account || '')
      .trim()
      .toLowerCase(),
    String(context.providerKind || '')
      .trim()
      .toLowerCase(),
    normalizeSessionSlugValue(context.effectiveDraftSlug || ''),
    String(context.chainId || '').trim(),
    context.singleQuestionMode ? 'single' : context.isStandalone ? 'standalone' : 'survey',
    String(context.surveyIndex ?? '').trim(),
    String(context.surveyId || '')
      .trim()
      .toLowerCase(),
    String(context.questionID || '')
      .trim()
      .toLowerCase(),
  ].join('|');

const buildSubmitState = (overrides = {}) => ({
  answers: { q1: { value: 'yes', encrypted: false } },
  additionalComments: { q1: { value: '', encrypted: false } },
  conviction: {},
  importance: {},
  ...overrides,
});

const buildSurveyPayload = (slice = buildSubmitState()) =>
  buildResponsePayload({
    account: '0xabc',
    isStandalone: false,
    singleQuestionMode: false,
    surveyId: '0xsurvey',
    surveyIndex: 0,
    surveyResponseState: slice,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
    pileQuestions: [],
    resolveFieldEncryptionAudience: (field) => field?.encryptionAudience || 'self',
    getQuestionEncryptionGates: () => [],
    resolveFieldEncryptionGateId: (field) => field?.encryptionGateId || null,
    normalizeFieldAudienceMode: (mode, fieldKey) => mode || (fieldKey === 'additional' ? 'inherit' : 'explicit'),
    getSurveyMetadataForJson: () => ({
      surveyTitle: 'Survey 1',
      sessionName: 'Edge Session',
    }),
    resolveSessionContext: () => ({ sessionName: 'Edge Session' }),
    getConvictionFromSlice,
    getImportanceFromSlice,
    sanitizeQuestionPromptForResponsePayload: (question) => question.prompt || '',
  });

const runPostSubmitFollowup = async ({
  cacheWriteResult = { questionCacheWritten: true, surveyCacheWritten: true },
  changedQids = new Set(['q1']),
  receipt = {
    status: 1,
    blockNumber: 42,
    transactionHash: TX_HASH,
    __ceQuestionResponses: [buildQuestionResponse()],
    __ceSurveyResponse: buildSurveyResponse(),
    __ceSurveyId: '0xsurvey',
    __ceSubmissionGroupKey: 'edge',
  },
  submitContext = createSubmitContext(),
  submittedCacheSlug = 'edge',
  contextCurrentChecks = [true, true, true],
  writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue(cacheWriteResult),
  refreshQuestionResponses = jest.fn().mockResolvedValue(undefined),
  refreshSurveyResponsesByID = jest.fn().mockResolvedValue(undefined),
} = {}) => {
  const currentChecks = [...contextCurrentChecks];
  const isSubmitContextCurrent = jest.fn(() => (currentChecks.length > 0 ? currentChecks.shift() : true));
  const events = [];
  let afterStateAppliedPromise = null;

  const result = runSurveyQuestionsSubmitSuccessController({
    editBaseline: buildSubmitState(),
    hasEncrypted: false,
    responseUrl: resolveSurveyQuestionsSubmittedResponseUrl({
      account: submitContext.account,
      currentPathname: '/survey/0xsurvey',
      isStandalone: submitContext.isStandalone,
      questionID: submitContext.questionID,
      singleQuestionMode: submitContext.singleQuestionMode,
      submissionSlug: submittedCacheSlug,
      surveyId: submitContext.surveyId,
    }),
    submittedSinceLastEdit: false,
    surveysResponseState: [buildSubmitState()],
    userAnswers: buildSurveyResponse(),
    submitAttemptId: 11,
    ports: {
      clearSubmitGuard: () => events.push('clear-submit-guard'),
      finishSubmitAttempt: (submitAttemptId) => events.push(`finish-submit-attempt:${submitAttemptId}`),
      setSubmitSuccessState: (statePatch, afterStateApplied) => {
        events.push(`set-success:${statePatch.responseUrl}`);
        afterStateAppliedPromise = afterStateApplied?.();
      },
    },
    afterStateApplied: async () => {
      if (!isSubmitContextCurrent(submitContext)) return;
      const writeResult = await writeSubmittedResponsesToLocalCaches(
        {
          receipt,
          questionResponses: receipt?.__ceQuestionResponses,
          surveyResponse: receipt?.__ceSurveyResponse,
          surveyId: receipt?.__ceSurveyId,
          submissionSlug: submittedCacheSlug,
        },
        submitContext,
      ).catch(() => ({
        questionCacheWritten: false,
        surveyCacheWritten: false,
      }));
      if (!isSubmitContextCurrent(submitContext)) return;

      const shouldRefreshQuestionResponses =
        !writeResult?.questionCacheWritten || !!submitContext.workerTargetKey;
      if (shouldRefreshQuestionResponses) {
        const ids = Array.from(changedQids)
          .map((id) => normalizeQuestionIdKey(id))
          .filter(Boolean);
        if (ids.length > 0 && isSubmitContextCurrent(submitContext)) {
          await refreshQuestionResponses(ids, {
            slug: submittedCacheSlug,
            responder: submitContext.account || '',
          });
        }
      }
      if (!writeResult?.surveyCacheWritten && !submitContext.singleQuestionMode && submitContext.surveyId) {
        if (isSubmitContextCurrent(submitContext)) {
          await refreshSurveyResponsesByID(submitContext.surveyId);
        }
      }
    },
  });

  if (afterStateAppliedPromise && typeof afterStateAppliedPromise.then === 'function') {
    await afterStateAppliedPromise;
  }

  return {
    events,
    isSubmitContextCurrent,
    refreshQuestionResponses,
    refreshSurveyResponsesByID,
    result,
    writeSubmittedResponsesToLocalCaches,
  };
};

describe('SurveyTool post-submit refresh', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('skips immediate response refreshes after submit when local cache write-through succeeds', async () => {
    const writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
      questionCacheWritten: true,
      surveyCacheWritten: true,
    });

    const outcome = await runPostSubmitFollowup({ writeSubmittedResponsesToLocalCaches });

    expect(outcome.result.statePatch).toEqual(
      expect.objectContaining({
        responseUrl: '/survey/0xsurvey/0xabc?session=edge',
        submissionComplete: true,
        submittedSinceLastEdit: true,
      }),
    );
    expect(outcome.events).toEqual([
      'clear-submit-guard',
      'finish-submit-attempt:11',
      'set-success:/survey/0xsurvey/0xabc?session=edge',
    ]);
    expect(writeSubmittedResponsesToLocalCaches).toHaveBeenCalledWith(
      expect.objectContaining({
        receipt: expect.objectContaining({ status: 1, blockNumber: 42 }),
        surveyId: '0xsurvey',
      }),
      expect.objectContaining({
        account: '0xabc',
        surveyId: '0xsurvey',
      }),
    );
    expect(outcome.refreshQuestionResponses).not.toHaveBeenCalled();
    expect(outcome.refreshSurveyResponsesByID).not.toHaveBeenCalled();
    // port note: the old test inspected the private `_submitGuard` after the class callback; the success controller now pins guard clearing.
  });

  it('falls back to immediate response refreshes after submit when local cache write-through cannot update caches', async () => {
    const outcome = await runPostSubmitFollowup({
      cacheWriteResult: {
        questionCacheWritten: false,
        surveyCacheWritten: false,
      },
    });

    expect(outcome.refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'edge',
      responder: '0xabc',
    });
    expect(outcome.refreshSurveyResponsesByID).toHaveBeenCalledWith('0xsurvey');
  });

  it('refreshes Worker-canonical responses after cache write-through so Results sees the new revision', async () => {
    const outcome = await runPostSubmitFollowup({
      submitContext: createSubmitContext({
        chainId: null,
        workerTargetKey: 'https://worker.example.test|0x00112233445566778899aabbccddeeff|edge',
      }),
    });

    expect(outcome.refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'edge',
      responder: '0xabc',
    });
    expect(outcome.refreshSurveyResponsesByID).not.toHaveBeenCalled();
  });

  it('does not run submit fallback refreshes after the submit context changes', async () => {
    const originalContext = createSubmitContext({ chainId: 84532 });
    const changedContext = createSubmitContext({
      activeSessionSlug: 'next',
      chainId: 84532,
      effectiveDraftSlug: 'next',
      sessionSlug: 'next',
    });

    const outcome = await runPostSubmitFollowup({
      cacheWriteResult: {
        questionCacheWritten: false,
        surveyCacheWritten: false,
      },
      submitContext: originalContext,
      contextCurrentChecks: [
        createSubmitContextKey(originalContext) === createSubmitContextKey(originalContext),
        createSubmitContextKey(originalContext) === createSubmitContextKey(changedContext),
      ],
    });

    expect(outcome.writeSubmittedResponsesToLocalCaches).toHaveBeenCalled();
    expect(outcome.isSubmitContextCurrent).toHaveBeenCalledTimes(2);
    expect(outcome.refreshQuestionResponses).not.toHaveBeenCalled();
    expect(outcome.refreshSurveyResponsesByID).not.toHaveBeenCalled();
    // port note: direct `subject.props` mutation during the async callback is private shell behavior; this pins the context-key stale branch.
  });

  it('passes the merged encrypted slice into submit work before async state flush', async () => {
    const encryptedSlice = buildSubmitState({
      answers: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: 'answer-env',
          hash: 'answer-hash',
          encryptionAudience: 'gate',
        },
      },
      additionalComments: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: 'additional-env',
          hash: 'additional-hash',
          encryptionAudience: 'gate',
        },
      },
    });
    const payload = buildSurveyPayload(encryptedSlice);
    const filtered = filterChangedResponsesForSubmit({
      data: payload,
      changedSet: new Set(['q1']),
      singleQuestionMode: false,
      isStandalone: false,
      surveyId: '0xsurvey',
      HashZero: HASH_ZERO,
    });
    const receipt = await normalizeSubmitReceipt(TX_HASH, {
      questionResponses: filtered.questionResponses,
      surveyResponse: filtered.surveyResponse,
      surveyId: filtered.surveyId,
      submissionGroupKey: 'edge',
      deepClone,
    });
    const result = runSurveyQuestionsSubmitSuccessController({
      editBaseline: deepClone(encryptedSlice),
      hasEncrypted: true,
      responseUrl: '/survey/0xsurvey/0xabc?session=edge',
      surveysResponseState: [encryptedSlice],
      userAnswers: payload,
      ports: {
        setSubmitSuccessState: jest.fn(),
      },
    });

    expect(filtered.questionResponses).toHaveLength(1);
    expect(filtered.questionResponses[0].answer).toEqual(
      expect.objectContaining({
        encrypted: true,
        encryptedPortion: 'answer-env',
      }),
    );
    expect(filtered.questionResponses[0].additional).toEqual(
      expect.objectContaining({
        encrypted: true,
        encryptedPortion: 'additional-env',
      }),
    );
    expect(receipt.__ceQuestionResponses[0].answer).toEqual(
      expect.objectContaining({
        encryptedPortion: 'answer-env',
      }),
    );
    expect(receipt.__ceSurveyResponse.responses[0].additional).toEqual(
      expect.objectContaining({
        encryptedPortion: 'additional-env',
      }),
    );
    expect(result.statePatch).toEqual(
      expect.objectContaining({
        editBaseline: expect.objectContaining({
          answers: expect.objectContaining({
            q1: expect.objectContaining({ encryptedPortion: 'answer-env' }),
          }),
        }),
        hasEncryptedChanges: false,
        surveysResponseState: [encryptedSlice],
        userAnswers: expect.objectContaining({
          responses: [
            expect.objectContaining({
              answer: expect.objectContaining({ encryptedPortion: 'answer-env' }),
              additional: expect.objectContaining({ encryptedPortion: 'additional-env' }),
            }),
          ],
        }),
      }),
    );
    // port note: the old test deferred class `setState` to catch stale `this.state`; this pins the exported payload/success-state contract for the merged encrypted slice.
  });

  it('uses the resolved submission slug for post-submit cache writes and refresh fallback', async () => {
    const submissionContext = buildSubmissionGroupContext({
      questionIds: ['q1'],
      slugByQuestionId: new Map([['q1', 'alpha']]),
      fallbackSlug: 'edge',
    });
    const receipt = await normalizeSubmitReceipt(TX_HASH, {
      questionResponses: [buildQuestionResponse()],
      surveyResponse: buildSurveyResponse(),
      surveyId: '0xsurvey',
      submissionGroupKey: submissionContext.submissionGroupKey,
      deepClone,
    });
    const outcome = await runPostSubmitFollowup({
      cacheWriteResult: {
        questionCacheWritten: false,
        surveyCacheWritten: false,
      },
      receipt,
      submittedCacheSlug: receipt.__ceSubmissionGroupKey,
    });

    expect(submissionContext).toEqual(
      expect.objectContaining({
        ok: true,
        submissionGroupKey: 'alpha',
      }),
    );
    expect(outcome.result.statePatch.responseUrl).toBe('/survey/0xsurvey/0xabc?session=alpha');
    expect(outcome.writeSubmittedResponsesToLocalCaches).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionSlug: 'alpha',
      }),
      expect.objectContaining({
        account: '0xabc',
        surveyId: '0xsurvey',
      }),
    );
    expect(outcome.refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'alpha',
      responder: '0xabc',
    });
    expect(outcome.refreshSurveyResponsesByID).toHaveBeenCalledWith('0xsurvey');
  });

  it('canonicalizes reserved session aliases in post-submit survey response links', async () => {
    const debateSlug = normalizeSessionSlugValue('DEBATE');
    const generalSlug = normalizeSessionSlugValue('general');

    expect(
      resolveSurveyQuestionsSubmittedResponseUrl({
        account: '0xabc',
        currentPathname: '/survey/0xsurvey',
        singleQuestionMode: false,
        submissionSlug: debateSlug,
        surveyId: '0xsurvey',
      }),
    ).toBe('/survey/0xsurvey/0xabc?session=DEBATE');
    expect(
      resolveSurveyQuestionsSubmittedResponseUrl({
        account: '0xabc',
        currentPathname: '/survey/0xsurvey',
        singleQuestionMode: false,
        submissionSlug: generalSlug,
        surveyId: '0xsurvey',
      }),
    ).toBe('/survey/0xsurvey/0xabc');
  });
});
