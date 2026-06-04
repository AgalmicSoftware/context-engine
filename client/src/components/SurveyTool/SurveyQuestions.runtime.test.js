import { SurveyQuestions } from './SurveyQuestions';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import contractScripts from '../../utilities/web3/contractScripts.js';

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
    window.sessionStorage?.removeItem('dg:recentQuestionPayloads');
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

  it('keeps single-question prefill from invalidating its active hydration run', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject._fetchSingleQuestionRunId = 7;
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {},
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
      isLoadingResponse: true,
      autoDecryptEnabled: false,
    };
    subject.didEditDiffInputsChange = jest.fn(() => true);
    subject.invalidateResponseHydrationRuns = jest.fn(() => {
      subject._fetchSingleQuestionRunId += 1;
    });
    subject.invalidateDiffCaches = jest.fn();
    subject.getPendingEditStats = jest.fn(() => ({
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
    }));
    subject.getPendingStatsSnapshot = jest.fn(() => ({
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
    }));
    subject.emitPendingStats = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.isAutoDecryptBlocked = jest.fn(() => false);
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.hasMaskedCurrentQuestionPayload = jest.fn(() => false);
    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'prefilled' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    }));
    subject._applyResponseHydrationListToSlice = jest.fn(({ targetSlice }) => {
      targetSlice.answers.q1 = { value: 'prefilled' };
      return true;
    });

    const prevProps = { ...subject.props };
    let updateComplete = Promise.resolve();
    subject.setState = jest.fn((updater, callback) => {
      const prevState = subject.state;
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      updateComplete = Promise.resolve(subject.componentDidUpdate(prevProps, prevState));
      if (typeof callback === 'function') callback();
      return patch;
    });

    subject.prefillSingleQuestionResponse({
      questionID: 'q1',
      answer: { value: 'prefilled' },
    });
    await updateComplete;

    expect(subject.invalidateResponseHydrationRuns).not.toHaveBeenCalled();
    expect(subject._fetchSingleQuestionRunId).toBe(7);
    expect(subject.state.surveysResponseState[0].answers.q1).toEqual({ value: 'prefilled' });
  });

  it('restores recent decrypted single-question payload before response bootstrap', async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    window.sessionStorage.setItem('dg:recentQuestionPayloads', JSON.stringify({
      q1: {
        savedAtMs: now - 1_000,
        creator: '0xAbC',
        prompt: 'Restored gated prompt',
        promptDecrypted: true,
        encryptedPrompt: 'ciphertext-prompt',
        questionType: 'text',
        tags: ['gate'],
      },
    }));
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue(null);
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue(null);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      questionID: 'Q1',
      account: '0xabc',
      loginComplete: true,
      provider: { kind: 'mock-provider' },
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      pileQuestions: [],
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      isLoadingResponse: true,
      autoDecryptEnabled: false,
    };
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.updateSingleQuestionDebug = jest.fn();
    subject.clearSingleQuestionBootstrapRetry = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();
    subject.prefillSingleQuestionResponse = jest.fn();
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

    await subject.fetchSingleQuestionData();
    await callbackRun;

    expect(subject.state.questionPool[0]).toMatchObject({
      id: 'q1',
      prompt: 'Restored gated prompt',
      promptDecrypted: true,
      encryptedPrompt: 'ciphertext-prompt',
      questionType: 'text',
    });
    expect(getQuestionDataSpy).not.toHaveBeenCalled();
    expect(getResponseSpy).toHaveBeenCalledWith(
      subject.props.provider,
      '0xabc',
      'q1',
      'edge',
    );
    expect(writeSpy).toHaveBeenCalledWith(
      'questionsCache',
      'edge',
      expect.objectContaining({
        84532: expect.objectContaining({
          questions: expect.objectContaining({
            q1: expect.objectContaining({
              encryptedPrompt: 'ciphertext-prompt',
            }),
          }),
        }),
      }),
    );
    expect(subject.updateJsonPreview).toHaveBeenCalledWith();
    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledWith();
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledWith();
    expect(subject.prefillSingleQuestionResponse).not.toHaveBeenCalled();
    expect(subject.state.userAnswers).toBeNull();
    expect(subject.state.isLoadingResponse).toBe(false);
  });

  it('ignores stale recent decrypted payloads and keeps bootstrap on the normal metadata path', async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    window.sessionStorage.setItem('dg:recentQuestionPayloads', JSON.stringify({
      q1: {
        savedAtMs: now - (13 * 60 * 60 * 1000),
        creator: '0xAbC',
        prompt: 'Expired gated prompt',
        promptDecrypted: true,
        encryptedPrompt: 'expired-ciphertext',
        questionType: 'text',
        tags: ['expired'],
      },
    }));
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue({
      creator: '0xAbC',
      encryptedPrompt: 'fresh-ciphertext',
      id: 'q1',
      prompt: 'Fresh network prompt',
      promptDecrypted: true,
      questionType: 'text',
      tags: ['fresh'],
    });
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue(null);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      questionID: 'Q1',
      account: '0xabc',
      loginComplete: true,
      provider: { kind: 'mock-provider' },
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      pileQuestions: [],
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      isLoadingResponse: true,
      autoDecryptEnabled: false,
    };
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.updateSingleQuestionDebug = jest.fn();
    subject.clearSingleQuestionBootstrapRetry = jest.fn();
    subject.scheduleSingleQuestionBootstrapRetry = jest.fn(() => false);
    subject.updateJsonPreview = jest.fn();
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();
    subject.prefillSingleQuestionResponse = jest.fn();
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

    await subject.fetchSingleQuestionData();
    await callbackRun;

    expect(getQuestionDataSpy).toHaveBeenCalled();
    expect(getResponseSpy).toHaveBeenCalledWith(
      subject.props.provider,
      '0xabc',
      'q1',
      'edge',
    );
    expect(subject.state.questionPool[0]).toMatchObject({
      id: 'q1',
      prompt: 'Fresh network prompt',
      encryptedPrompt: 'fresh-ciphertext',
      questionType: 'text',
    });
    expect(writeSpy).toHaveBeenCalledWith(
      'questionsCache',
      'edge',
      expect.objectContaining({
        84532: expect.objectContaining({
          questions: expect.objectContaining({
            q1: expect.objectContaining({
              prompt: 'Fresh network prompt',
              encryptedPrompt: 'fresh-ciphertext',
            }),
          }),
        }),
      }),
    );
    expect(writeSpy).not.toHaveBeenCalledWith(
      'questionsCache',
      'edge',
      expect.objectContaining({
        84532: expect.objectContaining({
          questions: expect.objectContaining({
            q1: expect.objectContaining({
              prompt: 'Expired gated prompt',
              encryptedPrompt: 'expired-ciphertext',
            }),
          }),
        }),
      }),
    );
    expect(subject.updateJsonPreview).toHaveBeenCalledWith();
    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledWith();
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledWith();
    expect(subject.prefillSingleQuestionResponse).not.toHaveBeenCalled();
    expect(subject.state.userAnswers).toBeNull();
    expect(subject.state.isLoadingResponse).toBe(false);
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

  it('wires question decrypt stale cleanup through owned busy-token state', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const olderToken = subject.registerQuestionDecryptBusyTokens(['q1:answer']);
    const newerToken = subject.registerQuestionDecryptBusyTokens(['q1:answer']);
    subject.state = {
      ...subject.state,
      decryptingByKey: { 'q1:answer': true },
    };

    expect(subject.buildQuestionDecryptFailureStateForAttempt(
      subject.state,
      'q1',
      'answer',
      'old decrypt failed',
      olderToken,
    )).toBeNull();
    expect(subject._questionDecryptBusyTokens['q1:answer']).toBe(newerToken);
    expect(subject.state.decryptingByKey['q1:answer']).toBe(true);

    const ownedPatch = subject.buildQuestionDecryptFailureStateForAttempt(
      subject.state,
      'q1',
      'answer',
      'new decrypt failed',
      newerToken,
    );

    expect(ownedPatch).toEqual({
      submissionError: 'new decrypt failed',
      isDecrypting: false,
      decryptingByKey: { 'q1:answer': false },
    });
    expect(subject._questionDecryptBusyTokens['q1:answer']).toBeUndefined();
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

  it('uses parent pending-count fallback before primary submit dispatch', () => {
    const events = [];
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyId: '0xsurvey',
      account: '0xabc',
    });
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submissionComplete: false,
      submittedSinceLastEdit: true,
      modifiedCount: 2,
    };
    subject.getPendingEditStats = undefined;
    subject.encryptAndUpload = jest.fn(() => {
      events.push(`encrypt:${subject._submitGuard ? 'guarded' : 'unguarded'}`);
    });

    subject.handlePrimarySubmitClick();

    expect(events).toEqual(['encrypt:guarded']);
    expect(subject.encryptAndUpload).toHaveBeenCalledTimes(1);
    expect(subject._submitGuard).toBe(true);
  });

  it('builds Lit encryption options from recipients and wallet provider hooks', () => {
    const saveKey = jest.fn();
    const getKey = jest.fn();
    const resourceAbilityRequests = [{ resource: 'session://edge', ability: 'decrypt' }];
    const recipients = [{
      accessControlConditions: [{ contractAddress: '0x1111111111111111111111111111111111111111' }],
      chain: 'optimismSepolia',
    }];
    const subject = new SurveyQuestions({
      provider: { kind: 'mock-wallet-provider' },
      litHooks: {
        saveKey,
        getKey,
        litNetwork: 'datil-dev',
        connectTimeout: 1234,
        resourceAbilityRequests,
      },
    });

    const options = subject.buildLitEncryptionOptionsForRecipients(recipients);

    expect(options).toEqual(expect.objectContaining({
      saveKey,
      getKey,
      accessControlConditions: recipients[0].accessControlConditions,
      chain: 'optimismSepolia',
      recipients,
      litNetwork: 'datil-dev',
      connectTimeout: 1234,
      providerLike: subject.props.provider,
      resourceAbilityRequests,
    }));
  });

  it('runs submit success cache write and refresh callbacks through submitted slug boundaries', async () => {
    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const refreshSurveyResponsesByID = jest.fn().mockResolvedValue(undefined);
    const finalSlice = {
      answers: { q1: { value: 'yes', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
    };
    const receipt = {
      blockNumber: 44,
      transactionHash: `0x${'4'.repeat(64)}`,
      __ceQuestionResponses: [{
        questionID: 'q1',
        answer: { value: 'yes', encrypted: false },
      }],
      __ceSurveyResponse: {
        surveyID: '0xsurvey',
        responses: [{ questionID: 'q1' }],
      },
      __ceSurveyId: '0xsurvey',
      __ceSubmissionGroupKey: 'submitted-edge',
    };
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: { kind: 'mock-wallet-provider' },
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      refreshQuestionResponses,
      refreshSurveyResponsesByID,
    });
    const callbackRuns = [];
    subject._isMounted = true;
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveSessionChainId = jest.fn(() => 84532);
    subject.getAnsweredQuestionsCount = jest.fn(() => 1);
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn().mockResolvedValue(receipt);
    subject.writeSubmittedResponsesToLocalCaches = jest.fn().mockResolvedValue({
      questionCacheWritten: false,
      surveyCacheWritten: false,
    });
    subject.clearDraftFor = jest.fn();
    subject.prepareJsonAndHash = jest.fn(() => ({
      surveyID: '0xsurvey',
      responses: [{ questionID: 'q1', answer: { value: 'yes' } }],
    }));
    subject.invalidateDiffCaches = jest.fn();
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function'
        ? updater(subject.state, subject.props)
        : updater;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof callback === 'function') {
        callbackRuns.push(Promise.resolve(callback()));
      }
      return patch;
    });
    subject.state = {
      ...subject.state,
      surveysResponseState: [finalSlice],
      editBaseline: {
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      },
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
      pileQuestions: [],
      modifiedCount: 1,
      encryptedModifiedCount: 0,
      hasEncryptedChanges: false,
    };

    await subject.encryptAndUpload();
    await Promise.all(callbackRuns);

    expect(subject.submitSurveyResponse).toHaveBeenCalledWith(
      finalSlice,
      expect.any(Set),
      expect.objectContaining({
        account: '0xabc',
        effectiveDraftSlug: 'edge',
        surveyId: '0xsurvey',
      })
    );
    expect(subject.clearDraftFor).toHaveBeenCalledWith('q1');
    expect(subject.writeSubmittedResponsesToLocalCaches).toHaveBeenCalledWith({
      receipt,
      questionResponses: receipt.__ceQuestionResponses,
      surveyResponse: receipt.__ceSurveyResponse,
      surveyId: receipt.__ceSurveyId,
      submissionSlug: 'submitted-edge',
    }, expect.objectContaining({
      account: '0xabc',
      effectiveDraftSlug: 'edge',
    }));
    expect(refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'submitted-edge',
      responder: '0xabc',
    });
    expect(refreshSurveyResponsesByID).toHaveBeenCalledWith('0xsurvey');
    expect(subject.state.responseUrl).toBe('/survey/0xsurvey/0xabc?session=submitted-edge');
    expect(subject._submitGuard).toBe(false);
  });

  it('runs submit failure status cleanup through the parent wiring', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: { kind: 'mock-wallet-provider' },
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveSessionChainId = jest.fn(() => 84532);
    subject.getAnsweredQuestionsCount = jest.fn(() => 1);
    subject.maybeBlockSubmitUntilQuestionPoolComplete = jest.fn(() => false);
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { answer: 1 } },
    }));
    subject.getPendingEditStats = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.submitSurveyResponse = jest.fn().mockRejectedValue(new Error('Receipt reverted'));
    subject.clearDraftFor = jest.fn();
    subject.writeSubmittedResponsesToLocalCaches = jest.fn();
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function'
        ? updater(subject.state, subject.props)
        : updater;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof callback === 'function') callback();
      return patch;
    });
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
      submissionComplete: true,
      submittedSinceLastEdit: true,
      modifiedCount: 1,
      hasEncryptedChanges: false,
    };
    subject._submitGuard = true;

    await subject.encryptAndUpload();

    expect(subject.submitSurveyResponse).toHaveBeenCalledTimes(1);
    expect(subject.clearDraftFor).not.toHaveBeenCalled();
    expect(subject.writeSubmittedResponsesToLocalCaches).not.toHaveBeenCalled();
    expect(subject._submitGuard).toBe(false);
    expect(subject._activeSubmitAttemptSeq).toBe(0);
    expect(subject.state).toEqual(expect.objectContaining({
      isSubmitting: false,
      submitProgress: 0,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      submissionError: 'Receipt reverted',
    }));
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

  it('applies successful self decrypt results through parent state and draft callbacks', async () => {
    const callbackRuns = [];
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      provider: { kind: 'mock-wallet-provider' },
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
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-env' } },
        additionalComments: { q1: { value: '*', encrypted: true, encryptedPortion: 'add-env' } },
        importance: {},
        conviction: {},
      }],
      editBaseline: null,
      userAnswers: {},
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof callback === 'function') {
        callbackRuns.push(callback);
      }
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
      ratingEnvelopes: { q1: { importanceEncrypted: 'imp-env' } },
    });
    subject.prepareQuestionDecryptAttempt = jest.fn(() => ({
      shouldDecrypt: true,
      decryptSelection: {
        keysToMark: ['q1:answer', 'q1:additional'],
        clearMode: 'both',
      },
      chainId: 84532,
      lit: { getKey: jest.fn() },
      opts: { providerKind: 'mock' },
    }));
    subject.finalizeQuestionDecryptAttempt = jest.fn(async () => {
      expect(subject.state.decryptingByKey).toEqual({
        'q1:answer': true,
        'q1:additional': true,
      });
      return {
        decryptedStateSlice: {
          answers: { q1: { value: 'clear answer', zkSalt: 'salt-a' } },
          additionalComments: { q1: { value: 'clear notes', zkSalt: 'salt-b' } },
        },
        didUpdate: true,
        decryptedImportance: 7,
        decryptedConviction: 9,
      };
    });
    subject.updateJsonPreview = jest.fn();
    subject.persistDraftSafely = jest.fn();

    const result = await subject.handleDecryptQuestionAnswerInternal(
      'q1',
      'both',
      null,
      subject.buildDecryptContextSnapshot(),
    );
    callbackRuns.forEach((callback) => callback());

    expect(result).toBe(true);
    expect(subject.prepareSelfQuestionDecryptState).toHaveBeenCalledWith(expect.objectContaining({
      surveyIndex: 0,
      questionId: 'q1',
      fieldToDecrypt: 'both',
      account: '0xabc',
      sessionSlug: 'edge',
    }));
    expect(subject.finalizeQuestionDecryptAttempt).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 'q1',
      fieldToDecrypt: 'both',
      account: '0xabc',
      providerLike: subject.props.provider,
      chainId: 84532,
      opts: { providerKind: 'mock' },
    }));
    expect(subject.state.surveysResponseState[0]).toMatchObject({
      answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
      additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
      importance: { q1: 7 },
      conviction: { q1: 9 },
    });
    expect(subject.state.decryptingByKey).toEqual({
      'q1:answer': false,
      'q1:additional': false,
    });
    expect(subject.updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(subject.persistDraftSafely).toHaveBeenCalledWith(0);
  });

  it('routes self decrypt failures through the owned busy-token fallback state', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      provider: { kind: 'mock-wallet-provider' },
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
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-env' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      userAnswers: {},
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
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
      throw new Error('decrypt rejected');
    });

    const result = await subject.handleDecryptQuestionAnswerInternal(
      'q1',
      'answer',
      null,
      subject.buildDecryptContextSnapshot(),
    );

    expect(result).toBe(false);
    expect(subject.state.decryptingByKey).toEqual({ 'q1:answer': false });
    expect(subject.state.isDecrypting).toBe(false);
    expect(subject.state.submissionError).toBe('decrypt rejected');
    expect(subject._questionDecryptBusyTokens['q1:answer']).toBeUndefined();
  });

  it('keeps viewed decrypt inert when login or response override is unavailable', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.prepareViewedQuestionDecryptState = jest.fn();
    subject.setState = jest.fn();

    await expect(subject.handleDecryptViewedResponseFieldInternal(
      'q1',
      'answer',
      { responder: '0xdef', answer: { value: '*', encrypted: true } },
      subject.buildDecryptContextSnapshot(),
    )).resolves.toBe(false);

    subject.props = {
      ...subject.props,
      account: '0xabc',
      loginComplete: true,
    };

    await expect(subject.handleDecryptViewedResponseFieldInternal(
      'q1',
      'answer',
      null,
      subject.buildDecryptContextSnapshot(),
    )).resolves.toBe(false);

    expect(subject.prepareViewedQuestionDecryptState).not.toHaveBeenCalled();
    expect(subject.setState).not.toHaveBeenCalled();
  });

  it('applies viewed decrypt results without switching into self-edit state', async () => {
    const responseOverride = {
      questionID: 'q1',
      responder: '0xdef',
      answer: { value: '*', encrypted: true, encryptedPortion: 'ans-env' },
      additional: { value: '*', encrypted: true, encryptedPortion: 'add-env' },
    };
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      provider: { kind: 'mock-wallet-provider' },
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      responderAddress: '0xdef',
    });
    subject._isMounted = true;
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      decryptingByKey: {},
      parsedViewAddressAnswers: { responses: [responseOverride] },
      viewAddressAnswers: JSON.stringify({ responses: [responseOverride] }),
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof callback === 'function') callback();
      return patch;
    });
    subject.prepareViewedQuestionDecryptState = jest.fn().mockResolvedValue({
      baselineForDecrypt: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-env' } },
        additionalComments: { q1: { value: '*', encrypted: true, encryptedPortion: 'add-env' } },
        importance: {},
        conviction: {},
      },
      ratingEnvelopes: { q1: { convictionEncrypted: 'conv-env' } },
    });
    subject.prepareQuestionDecryptAttempt = jest.fn(() => ({
      shouldDecrypt: true,
      decryptSelection: {
        keysToMark: ['q1:answer', 'q1:additional'],
        clearMode: 'both',
      },
      chainId: 84532,
      lit: null,
      opts: { providerKind: 'mock' },
    }));
    subject.finalizeQuestionDecryptAttempt = jest.fn().mockResolvedValue({
      decryptedStateSlice: {
        answers: { q1: { value: 'viewed answer' } },
        additionalComments: { q1: { value: 'viewed notes' } },
      },
      didUpdate: true,
      decryptedImportance: 5,
      decryptedConviction: 8,
    });

    const result = await subject.handleDecryptViewedResponseFieldInternal(
      'q1',
      'both',
      responseOverride,
      subject.buildDecryptContextSnapshot(),
    );

    expect(result).toBe(true);
    expect(subject.prepareViewedQuestionDecryptState).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 'q1',
      fieldToDecrypt: 'both',
      responseOverride,
      account: '0xabc',
      responderForLatest: '0xdef',
      sessionSlug: 'edge',
    }));
    expect(subject.finalizeQuestionDecryptAttempt).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 'q1',
      fieldToDecrypt: 'both',
      account: '0xabc',
      providerLike: subject.props.provider,
      opts: { providerKind: 'mock' },
    }));
    expect(subject.state.parsedViewAddressAnswers.responses[0]).toMatchObject({
      answer: { value: 'viewed answer' },
      additional: { value: 'viewed notes' },
      importance: 5,
      conviction: 8,
    });
    expect(JSON.parse(subject.state.viewAddressAnswers).responses[0]).toMatchObject({
      answer: { value: 'viewed answer' },
      additional: { value: 'viewed notes' },
      importance: 5,
      conviction: 8,
    });
    expect(subject.state.surveysResponseState[0].answers).toEqual({});
    expect(subject.state.decryptingByKey).toEqual({
      'q1:answer': false,
      'q1:additional': false,
    });
  });

  it('tries masked prompt reload sources in order and restores the better payload', async () => {
    const getQuestionDataSpy = jest
      .spyOn(contractScripts, 'getQuestionData')
      .mockImplementation(async (_provider, _qid, slug) => (
        slug === 'preferred'
          ? {
              id: 'q1',
              prompt: '[encrypted]',
              promptDecrypted: false,
              encryptedPrompt: 'old-env',
            }
          : {
              id: 'q1',
              prompt: 'Restored prompt',
              promptDecrypted: true,
              encryptedPrompt: 'new-env',
            }
      ));
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      provider: { kind: 'mock-wallet-provider' },
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', prompt: '[encrypted]', promptDecrypted: false }],
      pileQuestions: [],
    };
    subject.getQuestionFetchCandidateSlugs = jest.fn(() => ['preferred', 'fallback']);
    subject.buildQuestionDecryptContext = jest.fn((slug) => ({
      slug,
      chainId: 84532,
      litHooks: { getKey: jest.fn() },
    }));
    subject.cacheQuestionPayloadForSlug = jest.fn();
    subject.applyQuestionPayloadToRenderedPools = jest.fn();

    await expect(subject.fetchQuestionPayloadWithDeterministicContext(
      'Q1',
      { preferredSlug: 'preferred' },
    )).resolves.toEqual({
      promptReady: true,
      bestQuestionData: expect.objectContaining({
        id: 'q1',
        prompt: 'Restored prompt',
        promptDecrypted: true,
      }),
      bestSlug: 'fallback',
    });

    expect(getQuestionDataSpy.mock.calls.map((call) => call[2])).toEqual(['preferred', 'fallback']);
    expect(subject.applyQuestionPayloadToRenderedPools).toHaveBeenCalledWith(
      'q1',
      expect.objectContaining({
        prompt: 'Restored prompt',
        promptDecrypted: true,
      }),
    );
    expect(subject.cacheQuestionPayloadForSlug).toHaveBeenLastCalledWith(
      'fallback',
      'q1',
      expect.objectContaining({
        prompt: 'Restored prompt',
        promptDecrypted: true,
      }),
    );
  });

  it('clears prompt reload busy state when source restoration fails', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      decryptingByKey: {},
    };
    subject.setState = jest.fn((updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof callback === 'function') callback();
      return patch;
    });
    subject.fetchQuestionPayloadWithDeterministicContext = jest.fn(async () => {
      throw new Error('source unavailable');
    });

    await expect(subject.handleReloadMaskedPrompt('Q1')).resolves.toBe(false);

    expect(subject.fetchQuestionPayloadWithDeterministicContext).toHaveBeenCalledWith(
      'q1',
      { preferredSlug: subject._getEffectiveDraftSlug() },
    );
    expect(subject.state.decryptingByKey).toEqual({ 'q1:prompt': false });
  });

  it('restores exit-editing state from the viewed response source before self or cache fallbacks', () => {
    const callbacks = [];
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      responderAddress: '0xdef',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { value: 'draft' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      }],
      parsedViewAddressAnswers: { answer: { value: 'viewed' } },
      userAnswers: { answer: { value: 'self' } },
      editBaseline: null,
      submittedSinceLastEdit: true,
    };
    subject.buildSliceFromUserAnswers = jest.fn((source) => ({
      answers: { q1: { value: source?.answer?.value || 'missing' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));
    subject.buildSliceFromLocalCache = jest.fn(() => ({
      answers: { q1: { value: 'cache' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1']);
    subject.buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));
    subject.recalculateEditStats = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject.clearDraft = jest.fn();
    subject.setState = jest.fn((patch, callback) => {
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') callbacks.push(callback);
      return patch;
    });

    subject.handleExitEditing();
    callbacks.forEach((callback) => callback());

    expect(subject.buildSliceFromUserAnswers).toHaveBeenCalledTimes(1);
    expect(subject.buildSliceFromUserAnswers).toHaveBeenCalledWith(subject.state.parsedViewAddressAnswers);
    expect(subject.buildSliceFromLocalCache).not.toHaveBeenCalled();
    expect(subject.state.surveysResponseState[0].answers.q1.value).toBe('viewed');
    expect(subject.state.editBaseline.answers.q1.value).toBe('viewed');
    expect(subject.state).toEqual(expect.objectContaining({
      isEditing: false,
      displayAnswerMode: true,
      submittedSinceLastEdit: false,
      isDirty: false,
      modifiedCount: 0,
    }));
    expect(subject.recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(subject.persistDraftSafely).toHaveBeenCalledTimes(1);
    expect(subject.updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(subject.clearDraft).toHaveBeenCalledTimes(1);
  });
});
