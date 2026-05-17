import { SurveyQuestions } from './SurveyQuestions';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';

const flushAsyncCallbacks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
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
    subject._submitGuard = true;

    await subject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (subject._lastSetStatePromise) await subject._lastSetStatePromise;

    expect(subject.writeSubmittedResponsesToLocalCaches).toHaveBeenCalledWith(expect.objectContaining({
      receipt: expect.objectContaining({ status: 1, blockNumber: 42 }),
      surveyId: '0xsurvey',
    }), expect.objectContaining({
      account: '0xabc',
      surveyId: '0xsurvey',
    }));
    expect(subject._submitGuard).toBe(false);
    expect(refreshQuestionResponses).not.toHaveBeenCalled();
    expect(refreshSurveyResponsesByID).not.toHaveBeenCalled();
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

    const deferredStatePatches = [];
    subject.setState = (updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      if (patch && typeof patch === 'object') {
        if (Object.prototype.hasOwnProperty.call(patch, 'surveysResponseState')) {
          deferredStatePatches.push(patch);
        } else {
          subject.state = { ...subject.state, ...patch };
        }
      }
      if (typeof callback === 'function') {
        const pending = callback();
        if (pending && typeof pending.then === 'function') {
          subject._lastSetStatePromise = pending;
        }
      }
      return patch;
    };
    subject._submitGuard = true;

    await subject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (subject._lastSetStatePromise) await subject._lastSetStatePromise;

    expect(
      deferredStatePatches.some((patch) => Array.isArray(patch?.surveysResponseState))
    ).toBe(true);
    expect(subject.submitSurveyResponse).toHaveBeenCalledTimes(1);
    expect(subject.submitSurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.objectContaining({
          q1: expect.objectContaining({
            value: '*',
            encrypted: true,
            encryptedPortion: 'answer-env',
          }),
        }),
        additionalComments: expect.objectContaining({
          q1: expect.objectContaining({
            value: '*',
            encrypted: true,
            encryptedPortion: 'additional-env',
          }),
        }),
      }),
      expect.any(Set),
      expect.objectContaining({
        account: '0xabc',
        provider: expect.any(Object),
        surveyId: '0xsurvey',
        effectiveDraftSlug: 'edge',
      }),
    );
    expect(subject.submitSurveyResponse.mock.calls[0][1]).toEqual(new Set(['q1']));
    expect(subject.prepareJsonAndHash).toHaveBeenCalledWith(
      0,
      undefined,
      expect.objectContaining({
        answers: expect.objectContaining({
          q1: expect.objectContaining({ encryptedPortion: 'answer-env' }),
        }),
        additionalComments: expect.objectContaining({
          q1: expect.objectContaining({ encryptedPortion: 'additional-env' }),
        }),
      }),
    );
    expect(deferredStatePatches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        userAnswers: expect.objectContaining({
          responses: [
            expect.objectContaining({
              answer: expect.objectContaining({ encryptedPortion: 'answer-env' }),
              additional: expect.objectContaining({ encryptedPortion: 'additional-env' }),
            }),
          ],
        }),
      }),
    ]));
    expect(subject.writeSubmittedResponsesToLocalCaches).toHaveBeenCalledWith(expect.objectContaining({
      receipt: expect.objectContaining({ status: 1, blockNumber: 77 }),
    }), expect.objectContaining({
      account: '0xabc',
      surveyId: '0xsurvey',
    }));
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

    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 52,
      transactionHash: `0x${'9'.repeat(64)}`,
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
      __ceSubmissionGroupKey: 'alpha',
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

    expect(subject.writeSubmittedResponsesToLocalCaches).toHaveBeenCalledWith(expect.objectContaining({
      submissionSlug: 'alpha',
    }), expect.objectContaining({
      account: '0xabc',
      surveyId: '0xsurvey',
    }));
    expect(refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'alpha',
      responder: '0xabc',
    });
    expect(refreshSurveyResponsesByID).toHaveBeenCalledWith('0xsurvey');
  });

  it('canonicalizes reserved session aliases in post-submit survey response links', async () => {
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const buildSubject = (submissionGroupKey) => {
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
      subject.getChangedQidsAndFields = jest.fn(() => ({
        changedQids: new Set(['q1']),
        changedMap: { q1: { answer: 1 } },
      }));
      subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
      subject.submitSurveyResponse = jest.fn().mockResolvedValue({
        status: 1,
        blockNumber: 52,
        transactionHash: `0x${'9'.repeat(64)}`,
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
        __ceSubmissionGroupKey: submissionGroupKey,
      });
      subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
        questionCacheWritten: true,
        surveyCacheWritten: true,
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

      return subject;
    };

    const debateSubject = buildSubject('DEBATE');
    await debateSubject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (debateSubject._lastSetStatePromise) await debateSubject._lastSetStatePromise;
    expect(debateSubject.state.responseUrl).toBe('/survey/0xsurvey/0xabc?session=DEBATE');

    const generalSubject = buildSubject('general');
    await generalSubject.encryptAndUpload();
    await flushAsyncCallbacks();
    if (generalSubject._lastSetStatePromise) await generalSubject._lastSetStatePromise;
    expect(generalSubject.state.responseUrl).toBe('/survey/0xsurvey/0xabc');
  });
});
