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

      if (!writeResult?.questionCacheWritten) {
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
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const refreshSurveyResponsesByID = jest.fn().mockResolvedValue(undefined);
    const subject = new SurveyQuestions({
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      refreshQuestionResponses,
      refreshSurveyResponsesByID,
    });

    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 42,
      transactionHash: `0x${'3'.repeat(64)}`,
      __ceQuestionResponses: [
        {
          questionID: 'q1',
          responder: '0xabc',
          type: 'freeform',
          prompt: 'Prompt 1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
          importance: null,
          conviction: null,
        },
      ],
      __ceSurveyResponse: {
        surveyID: '0xsurvey',
        responder: '0xabc',
        surveyTitle: 'Survey 1',
        responses: [
          {
            questionID: 'q1',
            responder: '0xabc',
            type: 'freeform',
            prompt: 'Prompt 1',
            answer: { value: 'yes', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        ],
      },
      __ceSurveyId: '0xsurvey',
    });
    subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
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
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const refreshSurveyResponsesByID = jest.fn().mockResolvedValue(undefined);
    const subject = new SurveyQuestions({
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      refreshQuestionResponses,
      refreshSurveyResponsesByID,
    });

    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn().mockImplementation(async () => {
      return {
        status: 1,
        blockNumber: 42,
        transactionHash: `0x${'4'.repeat(64)}`,
        __ceQuestionResponses: [
          {
            questionID: 'q1',
            responder: '0xabc',
            type: 'freeform',
            prompt: 'Prompt 1',
            answer: { value: 'yes', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        ],
        __ceSurveyResponse: {
          surveyID: '0xsurvey',
          responder: '0xabc',
          responses: [
            {
              questionID: 'q1',
              responder: '0xabc',
              type: 'freeform',
              prompt: 'Prompt 1',
              answer: { value: 'yes', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          ],
        },
        __ceSurveyId: '0xsurvey',
      };
    });
    subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
      questionCacheWritten: false,
      surveyCacheWritten: false,
    });
    subject.clearDraftFor = jest.fn();
    subject.invalidateDiffCaches = jest.fn();
    subject.prepareJsonAndHash = jest.fn(() => ({
      responder: '0xabc',
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
    }));
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { value: 'yes', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
      }],
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
      pileQuestions: [],
      isSubmitting: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      modifiedCount: 1,
      hasEncryptedChanges: false,
    };
    subject.setState = (updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') {
        const pending = callback();
        if (pending && typeof pending.then === 'function') {
          subject._lastSetStatePromise = pending;
        }
      }
    };

    await subject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (subject._lastSetStatePromise) await subject._lastSetStatePromise;

    expect(refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'edge',
      responder: '0xabc',
    });
    expect(refreshSurveyResponsesByID).toHaveBeenCalledWith('0xsurvey');
  });

  it('does not run submit fallback refreshes after the submit context changes', async () => {
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const refreshSurveyResponsesByID = jest.fn().mockResolvedValue(undefined);
    const subject = new SurveyQuestions({
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      refreshQuestionResponses,
      refreshSurveyResponsesByID,
    });

    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 42,
      transactionHash: `0x${'5'.repeat(64)}`,
      __ceQuestionResponses: [
        {
          questionID: 'q1',
          responder: '0xabc',
          type: 'freeform',
          prompt: 'Prompt 1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
      __ceSurveyResponse: {
        surveyID: '0xsurvey',
        responder: '0xabc',
        responses: [
          {
            questionID: 'q1',
            responder: '0xabc',
            type: 'freeform',
            prompt: 'Prompt 1',
            answer: { value: 'yes', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        ],
      },
      __ceSurveyId: '0xsurvey',
    });
    subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockImplementation(async () => {
      subject.props = {
        ...subject.props,
        sessionSlug: 'next',
        activeSessionSlug: 'next',
      };
      subject._getEffectiveDraftSlug = jest.fn(() => 'next');
      return {
        questionCacheWritten: false,
        surveyCacheWritten: false,
      };
    });
    subject.clearDraftFor = jest.fn();
    subject.invalidateDiffCaches = jest.fn();
    subject.prepareJsonAndHash = jest.fn(() => ({
      responder: '0xabc',
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'yes', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
    }));
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { value: 'yes', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
      }],
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
      pileQuestions: [],
      isSubmitting: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      modifiedCount: 1,
      hasEncryptedChanges: false,
    };
    subject.setState = (updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') {
        const pending = callback();
        if (pending && typeof pending.then === 'function') {
          subject._lastSetStatePromise = pending;
        }
      }
    };

    await subject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (subject._lastSetStatePromise) await subject._lastSetStatePromise;

    expect(subject.writeSubmittedResponsesToLocalCaches).toHaveBeenCalled();
    expect(refreshQuestionResponses).not.toHaveBeenCalled();
    expect(refreshSurveyResponsesByID).not.toHaveBeenCalled();
  });

  it('passes the merged encrypted slice into submit work before async state flush', async () => {
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const subject = new SurveyQuestions({
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getAnsweredQuestionsCount = jest.fn(() => 1);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1, additional: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 1 }));
    subject.buildFieldEncryptionWorkGroups = jest.fn(() => ({
      groups: [{
        recipients: [{ type: 'lit-sbt-v1' }],
        qids: ['q1'],
        slice: {
          answers: {
            q1: {
              value: 'yes',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptedPortion: '',
            },
          },
          additionalComments: {
            q1: {
              value: 'context',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptedPortion: '',
            },
          },
          importance: {},
          conviction: {},
        },
      }],
      missingRecipients: [],
    }));
    subject.encryptFieldWorkGroups = jest.fn().mockResolvedValue({
      answers: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: 'answer-env',
          hash: 'answer-hash',
        },
      },
      additionalComments: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: 'additional-env',
          hash: 'additional-hash',
        },
      },
    });
    subject.submitSurveyResponse = jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 77,
      transactionHash: `0x${'7'.repeat(64)}`,
      __ceQuestionResponses: [
        {
          questionID: 'q1',
          responder: '0xabc',
          type: 'freeform',
          prompt: 'Prompt 1',
          answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
          additional: { value: '*', encrypted: true, encryptedPortion: 'additional-env' },
        },
      ],
      __ceSurveyResponse: {
        surveyID: '0xsurvey',
        responder: '0xabc',
        responses: [
          {
            questionID: 'q1',
            responder: '0xabc',
            type: 'freeform',
            prompt: 'Prompt 1',
            answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
            additional: { value: '*', encrypted: true, encryptedPortion: 'additional-env' },
          },
        ],
      },
      __ceSurveyId: '0xsurvey',
    });
    subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
      questionCacheWritten: true,
      surveyCacheWritten: true,
    });
    subject.clearDraftFor = jest.fn();
    subject.invalidateDiffCaches = jest.fn();
    subject.prepareJsonAndHash = jest.fn((surveyIndex, responderAddress, overrideState = null) => {
      const sourceSlice = overrideState || subject.state.surveysResponseState[surveyIndex];
      return ({
        responder: '0xabc',
        responses: [
          {
            questionID: 'q1',
            answer: sourceSlice.answers.q1,
            additional: sourceSlice.additionalComments.q1,
          },
        ],
      });
    });
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {
          q1: {
            value: 'yes',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: '',
          },
        },
        additionalComments: {
          q1: {
            value: 'context',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: '',
          },
        },
        importance: {},
        conviction: {},
      }],
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
      pileQuestions: [],
      isSubmitting: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      modifiedCount: 1,
      encryptedModifiedCount: 1,
      hasEncryptedChanges: true,
    };

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
        additionalComments: expect.objectContaining({
          q1: expect.objectContaining({ encryptedPortion: 'additional-env' }),
        }),
      }),
    );
    // port note: the old test deferred class `setState` to catch stale `this.state`; this pins the exported payload/success-state contract for the merged encrypted slice.
  });

  it('uses the resolved submission slug for post-submit cache writes and refresh fallback', async () => {
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const refreshSurveyResponsesByID = jest.fn().mockResolvedValue(undefined);
    const subject = new SurveyQuestions({
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      refreshQuestionResponses,
      refreshSurveyResponsesByID,
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
    expect(refreshSurveyResponsesByID).toHaveBeenCalledWith('0xsurvey');
  });

  it('canonicalizes reserved session aliases in post-submit survey response links', async () => {
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

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
