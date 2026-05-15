import { SurveyQuestions } from './SurveyQuestions';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('SurveyQuestions runtime helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('runs mount-time survey draft hydration under the response hydration guard', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: `0x${'1'.repeat(64)}`,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      isQuestionCacheReady: true,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject.loadBookmarks = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.fetchQuestionPool = jest.fn().mockResolvedValue(undefined);
    subject.initializeSurveyResponseState = jest.fn(() => [{
      answers: {},
      additionalComments: {},
      importance: {},
      conviction: {},
    }]);
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn().mockResolvedValue(undefined);
    subject.fetchSurveyResponse = jest.fn().mockResolvedValue(undefined);
    subject.checkAndHandleStartFresh = jest.fn();
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') {
        const maybePromise = callback();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
    });

    subject.componentDidMount();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await callbackRun;

    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledWith(expect.objectContaining({
      responseHydrationOwned: true,
    }));
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ responseHydrationOwned: true }),
    );
    expect(subject.fetchSurveyResponse).toHaveBeenCalledTimes(1);
  });

  it('persists SurveyQuestions bookmarks with optimistic cache writes', async () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ questions: [] });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);

    const subject = new SurveyQuestions({
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    subject.handleBookmarkToggle('q1');
    await Promise.resolve();

    expect(subject.state.bookmarkedQuestions).toEqual(new Set(['q1']));
    expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', {
      questions: ['q1'],
    });
  });

  it('loads SurveyQuestions bookmarks from cache into a normalized string set', async () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ questions: ['q1', 2] });
    const readSpy = jest.spyOn(cacheScripts, 'readCache');

    const subject = new SurveyQuestions({
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.loadBookmarks();

    expect(readSpy).not.toHaveBeenCalled();
    expect(subject.state.bookmarkedQuestions).toEqual(new Set(['q1', '2']));
  });

  it('coalesces bursty auto-decrypt sweeps into one scheduled pass', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      autoDecryptEnabled: true,
    };
    subject.isAutoDecryptBlocked = jest.fn(() => false);
    subject.shouldUseAnimationFrameForAutoDecryptSweep = jest.fn(() => false);
    subject.maybeAutoDecryptVisibleFields = jest.fn();

    subject.queueAutoDecryptVisibleSweep('a');
    subject.queueAutoDecryptVisibleSweep('b');
    subject.queueAutoDecryptVisibleSweep('c');

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subject.maybeAutoDecryptVisibleFields).toHaveBeenCalledTimes(1);
  });

  it('deduplicates in-flight decrypt tasks keyed to the same field payload', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const deferred = createDeferred();
    const runner = jest.fn(() => deferred.promise);

    const first = subject.runDedupedDecryptTask('task-key', runner);
    const second = subject.runDedupedDecryptTask('task-key', runner);
    await Promise.resolve();

    expect(second).toBe(first);
    expect(runner).toHaveBeenCalledTimes(1);

    deferred.resolve(true);
    await first;

    await subject.runDedupedDecryptTask('task-key', runner);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('scopes decrypt task keys to account, provider, session, network, and viewed responder', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xABC',
      loginComplete: true,
      provider: 'wagmi',
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      responderAddress: '0xResponder',
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');

    const firstKey = subject.buildDecryptTaskKey('self', 'q1', 'answer');
    subject.props = { ...subject.props, account: '0xDEF' };
    const accountKey = subject.buildDecryptTaskKey('self', 'q1', 'answer');
    subject.props = { ...subject.props, account: '0xABC', sessionSlug: 'alpha', activeSessionSlug: 'alpha' };
    subject._getEffectiveDraftSlug = jest.fn(() => 'alpha');
    const sessionKey = subject.buildDecryptTaskKey('self', 'q1', 'answer');

    expect(firstKey).toContain('0xabc');
    expect(firstKey).toContain('edge');
    expect(firstKey).toContain('84532');
    expect(firstKey).toContain('0xresponder');
    expect(accountKey).not.toBe(firstKey);
    expect(sessionKey).not.toBe(firstKey);
  });

  it('does not apply stale self decrypt results after the viewer account changes', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      provider: 'wagmi',
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      decryptingByKey: {},
      surveysResponseState: [{
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{}' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      userAnswers: {},
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });
    subject.resolveQuestionDecryptHandlingMode = jest.fn(() => ({
      effectiveResponseOverride: null,
      hasResponseOverride: false,
      isViewedResponseMode: false,
    }));
    subject.prepareSelfQuestionDecryptState = jest.fn().mockResolvedValue({
      baselineSlice: subject.state.surveysResponseState[0],
      baselineForDecrypt: subject.state.surveysResponseState[0],
      ratingEnvelopes: {},
    });
    subject.prepareQuestionDecryptAttempt = jest.fn(() => ({
      shouldDecrypt: true,
      decryptSelection: {
        keysToMark: ['q1:answer'],
        clearMode: 'answer',
      },
      chainId: 84532,
      lit: null,
      opts: {},
    }));
    subject.finalizeQuestionDecryptAttempt = jest.fn(async () => {
      subject.props = { ...subject.props, account: '0xdef' };
      return {
        decryptedStateSlice: {
          answers: { q1: { value: 'decrypted', encrypted: false } },
          additionalComments: {},
        },
        didUpdate: true,
        decryptedImportance: null,
        decryptedConviction: null,
      };
    });
    subject.buildSelfQuestionDecryptSuccessState = jest.fn((prev) => ({
      ...prev,
      staleDecryptApplied: true,
    }));

    const result = await subject.handleDecryptQuestionAnswerInternal(
      'q1',
      'answer',
      null,
      subject.buildDecryptContextSnapshot(),
    );

    expect(result).toBe(false);
    expect(subject.buildSelfQuestionDecryptSuccessState).not.toHaveBeenCalled();
    expect(subject.state.staleDecryptApplied).toBeUndefined();
    expect(subject.state.decryptingByKey['q1:answer']).toBe(false);
  });

  it('does not apply stale self decrypt failures after the viewer account changes', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      provider: 'wagmi',
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      decryptingByKey: {},
      surveysResponseState: [{
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{}' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      userAnswers: {},
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });
    subject.resolveQuestionDecryptHandlingMode = jest.fn(() => ({
      effectiveResponseOverride: null,
      hasResponseOverride: false,
      isViewedResponseMode: false,
    }));
    subject.prepareSelfQuestionDecryptState = jest.fn().mockResolvedValue({
      baselineSlice: subject.state.surveysResponseState[0],
      baselineForDecrypt: subject.state.surveysResponseState[0],
      ratingEnvelopes: {},
    });
    subject.prepareQuestionDecryptAttempt = jest.fn(() => ({
      shouldDecrypt: true,
      decryptSelection: {
        keysToMark: ['q1:answer'],
        clearMode: 'answer',
      },
      chainId: 84532,
      lit: null,
      opts: {},
    }));
    subject.finalizeQuestionDecryptAttempt = jest.fn(async () => {
      subject.props = { ...subject.props, account: '0xdef' };
      throw new Error('decrypt rejected');
    });
    subject.buildQuestionDecryptFailureState = jest.fn((prev) => ({
      ...prev,
      staleDecryptFailureApplied: true,
    }));

    const result = await subject.handleDecryptQuestionAnswerInternal(
      'q1',
      'answer',
      null,
      subject.buildDecryptContextSnapshot(),
    );

    expect(result).toBe(false);
    expect(subject.buildQuestionDecryptFailureState).not.toHaveBeenCalled();
    expect(subject.state.staleDecryptFailureApplied).toBeUndefined();
    expect(subject.state.decryptingByKey['q1:answer']).toBe(false);
  });

  it('does not let stale decrypt cleanup clear a newer decrypt busy token', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      provider: 'wagmi',
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      decryptingByKey: {},
      surveysResponseState: [{
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{}' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      userAnswers: {},
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });
    subject.resolveQuestionDecryptHandlingMode = jest.fn(() => ({
      effectiveResponseOverride: null,
      hasResponseOverride: false,
      isViewedResponseMode: false,
    }));
    subject.prepareSelfQuestionDecryptState = jest.fn().mockResolvedValue({
      baselineSlice: subject.state.surveysResponseState[0],
      baselineForDecrypt: subject.state.surveysResponseState[0],
      ratingEnvelopes: {},
    });
    subject.prepareQuestionDecryptAttempt = jest.fn(() => ({
      shouldDecrypt: true,
      decryptSelection: {
        keysToMark: ['q1:answer'],
        clearMode: 'answer',
      },
      chainId: 84532,
      lit: null,
      opts: {},
    }));
    subject.finalizeQuestionDecryptAttempt = jest.fn(async () => {
      subject.props = { ...subject.props, account: '0xdef' };
      subject.registerQuestionDecryptBusyTokens(['q1:answer']);
      subject.state = {
        ...subject.state,
        decryptingByKey: { 'q1:answer': true },
      };
      return {
        decryptedStateSlice: {
          answers: { q1: { value: 'old decrypted', encrypted: false } },
          additionalComments: {},
        },
        didUpdate: true,
        decryptedImportance: null,
        decryptedConviction: null,
      };
    });

    const result = await subject.handleDecryptQuestionAnswerInternal(
      'q1',
      'answer',
      null,
      subject.buildDecryptContextSnapshot(),
    );

    expect(result).toBe(false);
    expect(subject.state.decryptingByKey['q1:answer']).toBe(true);
  });

  it('does not apply an older same-context decrypt result after a newer decrypt owns the field', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      provider: 'wagmi',
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      decryptingByKey: {},
      surveysResponseState: [{
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{}' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      userAnswers: {},
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });
    subject.resolveQuestionDecryptHandlingMode = jest.fn(() => ({
      effectiveResponseOverride: null,
      hasResponseOverride: false,
      isViewedResponseMode: false,
    }));
    subject.prepareSelfQuestionDecryptState = jest.fn().mockResolvedValue({
      baselineSlice: subject.state.surveysResponseState[0],
      baselineForDecrypt: subject.state.surveysResponseState[0],
      ratingEnvelopes: {},
    });
    subject.prepareQuestionDecryptAttempt = jest.fn(() => ({
      shouldDecrypt: true,
      decryptSelection: {
        keysToMark: ['q1:answer'],
        clearMode: 'answer',
      },
      chainId: 84532,
      lit: null,
      opts: {},
    }));
    subject.finalizeQuestionDecryptAttempt = jest.fn(async () => {
      subject.registerQuestionDecryptBusyTokens(['q1:answer']);
      subject.state = {
        ...subject.state,
        decryptingByKey: { 'q1:answer': true },
      };
      return {
        decryptedStateSlice: {
          answers: { q1: { value: 'old decrypted', encrypted: false } },
          additionalComments: {},
        },
        didUpdate: true,
        decryptedImportance: null,
        decryptedConviction: null,
      };
    });
    subject.buildSelfQuestionDecryptSuccessState = jest.fn(() => ({
      staleDecryptApplied: true,
    }));

    const result = await subject.handleDecryptQuestionAnswerInternal(
      'q1',
      'answer',
      null,
      subject.buildDecryptContextSnapshot(),
    );

    expect(result).toBe(false);
    expect(subject.buildSelfQuestionDecryptSuccessState).not.toHaveBeenCalled();
    expect(subject.state.staleDecryptApplied).toBeUndefined();
    expect(subject.state.decryptingByKey['q1:answer']).toBe(true);
  });

  it('does not apply stale full-survey decrypt results after the viewer account changes', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: 'survey-a',
      account: '0xabc',
      loginComplete: true,
      provider: 'wagmi',
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{}' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      userAnswers: {},
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });
    subject.prepareSurveyDecryptAttempt = jest.fn().mockResolvedValue({
      sourceSlice: subject.state.surveysResponseState[0],
      ratingEnvelopesByQid: {},
      chainId: 84532,
      lit: null,
      opts: {},
      poolForDecrypt: [{ id: 'q1' }],
    });
    subject.finalizeSurveyDecryptAttempt = jest.fn(async () => {
      subject.props = { ...subject.props, account: '0xdef' };
      return {
        normalizedDecryptedSlice: {
          answers: { q1: { value: 'old decrypted', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
        decryptedImportanceFromEnv: {},
        decryptedConvictionFromEnv: {},
      };
    });
    subject.buildSurveyDecryptSuccessState = jest.fn((prev) => ({
      ...prev,
      staleSurveyDecryptApplied: true,
    }));
    subject.prepareJsonAndHash = jest.fn(() => []);
    subject.persistDraftSafely = jest.fn();

    await subject.handleDecryptEdit();

    expect(subject.buildSurveyDecryptSuccessState).not.toHaveBeenCalled();
    expect(subject.state.staleSurveyDecryptApplied).toBeUndefined();
    expect(subject.state.isDecrypting).toBe(false);
  });

  it('does not apply stale submit success after the viewer account changes', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: `0x${'1'.repeat(64)}`,
      account: '0xabc',
      loginComplete: true,
      provider: { request: jest.fn() },
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      toggleLoginModal: jest.fn(),
    });
    subject._isMounted = true;
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveSessionChainId = jest.fn(() => 84532);
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { value: 'draft answer' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      editBaseline: {
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      },
      modifiedCount: 1,
      hasEncryptedChanges: false,
      submittedSinceLastEdit: false,
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });
    subject.getAnsweredQuestionsCount = jest.fn(() => 1);
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn(async () => {
      subject.props = { ...subject.props, account: '0xdef' };
      return {
        blockNumber: 123,
        __ceSubmissionGroupKey: 'edge',
        __ceQuestionResponses: [],
        __ceSurveyResponse: null,
        __ceSurveyId: `0x${'1'.repeat(64)}`,
      };
    });
    subject.clearDraftFor = jest.fn();
    subject.writeSubmittedResponsesToLocalCaches = jest.fn();
    subject.prepareJsonAndHash = jest.fn(() => []);

    await subject.encryptAndUpload();

    expect(subject.submitSurveyResponse).toHaveBeenCalledTimes(1);
    expect(subject.clearDraftFor).not.toHaveBeenCalled();
    expect(subject.writeSubmittedResponsesToLocalCaches).not.toHaveBeenCalled();
    expect(subject.state.isSubmitting).toBe(false);
    expect(subject.state.currentStep).toBe(0);
    expect(subject.state.submissionComplete).toBe(false);
  });

  it('does not let stale submit cleanup clear a newer submit attempt', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: `0x${'2'.repeat(64)}`,
      account: '0xabc',
      loginComplete: true,
      provider: { request: jest.fn() },
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      toggleLoginModal: jest.fn(),
    });
    subject._isMounted = true;
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveSessionChainId = jest.fn(() => 84532);
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { value: 'draft answer' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      editBaseline: {
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      },
      modifiedCount: 1,
      hasEncryptedChanges: false,
      submittedSinceLastEdit: false,
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });
    subject.getAnsweredQuestionsCount = jest.fn(() => 1);
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn(async () => {
      subject.props = { ...subject.props, account: '0xdef' };
      subject.startSubmitAttempt();
      subject.state = {
        ...subject.state,
        isSubmitting: true,
        currentStep: 1,
      };
      return {
        blockNumber: 123,
        __ceSubmissionGroupKey: 'edge',
        __ceQuestionResponses: [],
        __ceSurveyResponse: null,
        __ceSurveyId: `0x${'2'.repeat(64)}`,
      };
    });
    subject.clearDraftFor = jest.fn();
    subject.writeSubmittedResponsesToLocalCaches = jest.fn();
    subject.prepareJsonAndHash = jest.fn(() => []);

    await subject.encryptAndUpload();

    expect(subject.submitSurveyResponse).toHaveBeenCalledTimes(1);
    expect(subject.clearDraftFor).not.toHaveBeenCalled();
    expect(subject.writeSubmittedResponsesToLocalCaches).not.toHaveBeenCalled();
    expect(subject.state.isSubmitting).toBe(true);
    expect(subject.state.currentStep).toBe(1);
    expect(subject.state.submissionComplete).toBe(false);
  });

  it('skips auto-decrypt requeue for unchanged masked payloads after a failed attempt', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const maskedAnswer = {
      value: '*',
      encrypted: true,
      encryptedPortion: 'enc-1',
    };
    const maskedSig = subject.buildAutoDecryptMaskedFieldSignature(maskedAnswer);

    subject.state = {
      ...subject.state,
      autoDecryptEnabled: true,
      submissionError: '',
      showComments: {},
      autoDecryptAttempted: {},
      decryptingByKey: {},
      surveysResponseState: [
        { answers: { q1: maskedAnswer }, additionalComments: {} },
      ],
    };
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1']);
    subject.processAutoDecryptQueue = jest.fn();
    subject._autoDecryptMaskedAttemptSignature = { 'q1:answer': maskedSig };

    subject.maybeAutoDecryptVisibleFields();
    expect(subject._autoDecQueue).toHaveLength(0);
    expect(subject.processAutoDecryptQueue).not.toHaveBeenCalled();

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: {
            q1: {
              ...maskedAnswer,
              encryptedPortion: 'enc-2',
            },
          },
          additionalComments: {},
        },
      ],
    };

    subject.maybeAutoDecryptVisibleFields();
    expect(subject._autoDecQueue).toHaveLength(1);
    expect(subject._autoDecQueue[0]).toMatchObject({ qid: 'q1', field: 'answer' });
    expect(subject.processAutoDecryptQueue).toHaveBeenCalledTimes(1);
  });
});
