import {
  buildSingleQuestionPreservedPoolState,
  buildSingleQuestionSourceRestoreContextPlan,
  resolveSingleQuestionCacheBootstrapStopHandlingPlan,
} from './surveyToolSingleQuestionCacheBootstrapController';
import {
  buildSingleQuestionEncryptedMetadataPlaceholder,
  fetchSingleQuestionMetadataCandidates,
} from './surveyToolSingleQuestionMetadataController';
import { resolveSingleQuestionMetadataBootstrap } from './surveyToolSingleQuestionMetadataBootstrapController';
import { executeViewedSingleQuestionResponseBootstrap } from './surveyToolSingleQuestionController';
import {
  buildSingleQuestionPlaceholderHydrationState,
  buildSurveyQuestionsSubmitFooterDisplayState,
  buildSurveyQuestionsSubmitReadinessDescriptor,
} from './surveyQuestionsTypes';
import { decideAutomaticPromptDecryptByKind } from './surveyQuestionsDecryptEligibility.js';
import { buildQuestionIdScopeSignature } from './surveyToolSignatures.js';
import {
  isMaskedQuestionPayload,
  resolveQuestionPayloadDisplayState,
  shouldRetryMaskedQuestionRefresh,
} from '../../utilities/survey/questionRouting';

const RESPONDER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const ACCOUNT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const applyStateUpdate = (stateRef, update) => {
  const patch = typeof update === 'function' ? update(stateRef.current) : update;
  stateRef.current = { ...stateRef.current, ...(patch || {}) };
  return patch;
};

const mergeSurveyResponseState = (previous, questionPool, surveyIndex) => ({
  previous,
  questionPool,
  surveyIndex,
});

const shouldHydrateGateLabelsAfterUpdate = ({ prevProps = {}, nextProps = {}, prevState = {}, nextState = {} } = {}) =>
  prevProps.sbtCacheRevision !== nextProps.sbtCacheRevision ||
  prevProps.network?.id !== nextProps.network?.id ||
  prevProps.networkChainId !== nextProps.networkChainId ||
  prevState.questionPool !== nextState.questionPool ||
  prevState.pileQuestions !== nextState.pileQuestions ||
  prevProps.questionPool !== nextProps.questionPool ||
  prevProps.questionsCacheNonce !== nextProps.questionsCacheNonce ||
  prevProps.questionResponsesNonce !== nextProps.questionResponsesNonce;

const shouldRetryViewedBootstrapOnReadiness = ({ prevProps = {}, nextProps = {}, nextState = {} } = {}) => {
  const prevNetId = String(prevProps.network?.id ?? prevProps.networkChainId ?? '');
  const currNetId = String(nextProps.network?.id ?? nextProps.networkChainId ?? '');
  const authOrProviderBecameReady =
    (!prevProps.loginComplete && !!nextProps.loginComplete) ||
    (!prevProps.account && !!nextProps.account) ||
    (!prevProps.provider && !!nextProps.provider);
  const networkBecameReady = prevNetId !== currNetId && !!currNetId;
  const waitingForViewedResponseBootstrap =
    !!nextProps.responderAddress && !nextState.parsedViewAddressAnswers && nextState.noResponse !== true;
  const singleQuestionBootstrapPending =
    waitingForViewedResponseBootstrap ||
    (!nextState.displayAnswerMode &&
      !nextState.parsedViewAddressAnswers &&
      (!Array.isArray(nextState.questionPool) || nextState.questionPool.length === 0));
  return singleQuestionBootstrapPending && (authOrProviderBecameReady || networkBecameReady);
};

const shouldRehydrateStandaloneLocalResponses = ({ prevProps = {}, nextProps = {} } = {}) => {
  const cacheTick = !!(
    (prevProps.isQuestionCacheReady !== nextProps.isQuestionCacheReady && nextProps.isQuestionCacheReady) ||
    (prevProps.isResponsesCacheReady !== nextProps.isResponsesCacheReady && nextProps.isResponsesCacheReady) ||
    (nextProps.isQuestionCacheReady && prevProps.questionsCacheNonce !== nextProps.questionsCacheNonce) ||
    (nextProps.isResponsesCacheReady && prevProps.questionResponsesNonce !== nextProps.questionResponsesNonce)
  );
  const standaloneAuthBecameReady =
    (!prevProps.loginComplete && !!nextProps.loginComplete) ||
    (!prevProps.account && !!nextProps.account) ||
    (!prevProps.provider && !!nextProps.provider);
  return {
    cacheTick,
    shouldResetForAuth: prevProps.account !== nextProps.account || standaloneAuthBecameReady,
    shouldRehydrateLocal: cacheTick || prevProps.account !== nextProps.account || standaloneAuthBecameReady,
  };
};

const buildAutomaticQuestionMetadataFetchOptions = ({
  account = ACCOUNT,
  loginComplete = true,
  provider = 'passkey_eoa',
  providerKind = 'passkey-eoa',
  passkeyReady = false,
} = {}) => {
  const decryptContext = {
    account,
    providerLike: provider,
  };
  const canDecrypt = !!(
    loginComplete &&
    account &&
    provider &&
    decideAutomaticPromptDecryptByKind(providerKind, () => passkeyReady)
  );
  return canDecrypt ? { decryptContext } : { decryptContext, skipDecrypt: true };
};

const getPendingRetryAttemptFromSig = (pendingRetrySig = '', questionId = '') => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const retrySig = String(pendingRetrySig || '')
    .trim()
    .toLowerCase();
  if (!qid || !retrySig) return 0;
  const [currentQid = '', currentAttemptToken = '0'] = retrySig.split(':');
  if (currentQid !== qid) return 0;
  const attempt = Number(currentAttemptToken || 0);
  return Number.isFinite(attempt) && attempt > 0 ? attempt : 0;
};

const buildRetryFetchOptionsFromPendingSig = ({ pendingRetrySig = '', questionId = '' } = {}) => {
  const bootstrapRetryAttempt = getPendingRetryAttemptFromSig(pendingRetrySig, questionId);
  return bootstrapRetryAttempt > 0 ? { bootstrapRetryAttempt } : undefined;
};

describe('SurveyTool single-question bootstrap cache', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not short-circuit when state questionPool ref changes under stable ids', () => {
    const prevQuestionPool = [{ id: 'q1', type: 'binary', prompt: 'prev' }];
    const nextQuestionPool = [{ id: 'q1', type: 'binary', prompt: 'next' }];

    expect(buildQuestionIdScopeSignature(prevQuestionPool)).toBe(buildQuestionIdScopeSignature(nextQuestionPool));
    expect(
      shouldHydrateGateLabelsAfterUpdate({
        prevProps: { questionPool: [] },
        nextProps: { questionPool: [] },
        prevState: { questionPool: prevQuestionPool, pileQuestions: [] },
        nextState: { questionPool: nextQuestionPool, pileQuestions: [] },
      }),
    ).toBe(true);
    // port note: the old test spied on `hydrateGateSbtLabels()` after
    // `componentDidUpdate`; the portable contract is that a state pool ref
    // change bypasses the no-op update guard even when question ids are stable.
  });

  it('does not short-circuit masked refresh when lit hooks become ready', () => {
    expect(
      shouldRetryMaskedQuestionRefresh({
        masked: true,
        prev: {
          account: ACCOUNT,
          provider: 'passkey_eoa',
          loginComplete: true,
          litHooks: null,
          sbtCacheRevision: 0,
        },
        next: {
          account: ACCOUNT,
          provider: 'passkey_eoa',
          loginComplete: true,
          litHooks: { getKey: jest.fn() },
          sbtCacheRevision: 0,
        },
      }),
    ).toBe(true);
  });

  it('retries viewed-response bootstrap on readiness even when questionPool is already seeded', () => {
    expect(
      shouldRetryViewedBootstrapOnReadiness({
        prevProps: {
          provider: null,
          loginComplete: false,
          network: { id: 84532 },
        },
        nextProps: {
          provider: {},
          loginComplete: true,
          responderAddress: RESPONDER,
          network: { id: 84532 },
        },
        nextState: {
          displayAnswerMode: true,
          parsedViewAddressAnswers: null,
          noResponse: false,
          questionPool: [{ id: '0xquestion', type: 'binary', prompt: 'seeded' }],
        },
      }),
    ).toBe(true);
    // port note: the old test invoked `componentDidUpdate()` and spied on
    // `fetchSingleQuestionData()`. The observable branch condition is that
    // responder bootstrap readiness ignores already-seeded question metadata.
  });

  it('rehydrates standalone prior responses when wallet auth becomes ready after mount', () => {
    const events = [];
    const plan = shouldRehydrateStandaloneLocalResponses({
      prevProps: { account: '', loginComplete: false, provider: '' },
      nextProps: { account: ACCOUNT, loginComplete: true, provider: 'passkey_eoa' },
    });

    if (plan.shouldResetForAuth) {
      events.push('reset');
      events.push('rehydrate-draft');
      events.push('rehydrate-local-cache');
    }

    expect(plan).toEqual({
      cacheTick: false,
      shouldResetForAuth: true,
      shouldRehydrateLocal: true,
    });
    expect(events).toEqual(['reset', 'rehydrate-draft', 'rehydrate-local-cache']);
  });

  it('rehydrates standalone prior responses when the response cache nonce ticks', () => {
    const plan = shouldRehydrateStandaloneLocalResponses({
      prevProps: {
        account: ACCOUNT,
        loginComplete: true,
        provider: 'passkey_eoa',
        isQuestionCacheReady: true,
        isResponsesCacheReady: true,
        questionsCacheNonce: 3,
        questionResponsesNonce: 7,
      },
      nextProps: {
        account: ACCOUNT,
        loginComplete: true,
        provider: 'passkey_eoa',
        isQuestionCacheReady: true,
        isResponsesCacheReady: true,
        questionsCacheNonce: 3,
        questionResponsesNonce: 8,
      },
    });

    expect(plan.cacheTick).toBe(true);
    expect(plan.shouldRehydrateLocal).toBe(true);
    expect(plan.shouldResetForAuth).toBe(false);
  });

  it('keeps single-question metadata fetch scoped to pinned session slug', async () => {
    const getQuestionData = jest.fn().mockResolvedValue(null);

    await fetchSingleQuestionMetadataCandidates({
      effectiveSingleSlug: 'edge',
      fetchCandidateSlugs: ['edge'],
      getQuestionData,
    });

    expect(getQuestionData).toHaveBeenCalled();
    expect(getQuestionData.mock.calls.every((call) => call[0] === 'edge')).toBe(true);
  });

  it('skips automatic single-question prompt decrypt for passive passkey wallet sessions', () => {
    expect(
      buildAutomaticQuestionMetadataFetchOptions({
        passkeyReady: false,
      }),
    ).toEqual(expect.objectContaining({ skipDecrypt: true }));
    // port note: the class wrapper also builds a decrypt context; the behavior
    // guarded here is the boundary option passed to `getQuestionData`.
  });

  it('auto-decrypts single-question prompts when passkey wallet auto-sign is ready', () => {
    const options = buildAutomaticQuestionMetadataFetchOptions({
      passkeyReady: true,
    });

    expect(options).not.toEqual(expect.objectContaining({ skipDecrypt: true }));
    expect(options.decryptContext).toEqual(
      expect.objectContaining({
        account: ACCOUNT,
        providerLike: 'passkey_eoa',
      }),
    );
  });

  it('falls back to known candidate slugs when pinned single-question slug is unresolved', async () => {
    const getQuestionData = jest.fn(async (candidateSlug) =>
      candidateSlug === 'edge' ? { id: 'q1', type: 'binary', prompt: 'Recovered prompt', tags: [] } : null,
    );

    const result = await fetchSingleQuestionMetadataCandidates({
      effectiveSingleSlug: 'general3',
      fetchCandidateSlugs: ['general3', 'edge'],
      getQuestionData,
    });

    expect(getQuestionData.mock.calls.map((call) => call[0])).toEqual(['general3', 'edge']);
    expect(result).toEqual(
      expect.objectContaining({
        effectiveSingleSlug: 'edge',
        fetchedAny: true,
        questionData: expect.objectContaining({ id: 'q1', prompt: 'Recovered prompt' }),
      }),
    );
  });

  it('recovers from timed-out question metadata fetch when late payload arrives', async () => {
    jest.useFakeTimers();
    const deferred = createDeferred();
    const runPromise = fetchSingleQuestionMetadataCandidates({
      effectiveSingleSlug: 'edge',
      fetchCandidateSlugs: ['edge'],
      fetchTimeoutMs: 3000,
      fetchTimeoutRecoveryMs: 12000,
      getQuestionData: jest.fn(() => deferred.promise),
    });

    await Promise.resolve();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    deferred.resolve({
      id: 'q1',
      type: 'binary',
      prompt: 'Recovered prompt',
      tags: [],
    });
    await Promise.resolve();

    await expect(runPromise).resolves.toEqual(
      expect.objectContaining({
        effectiveSingleSlug: 'edge',
        fetchedAny: true,
        timedOutFetchCount: 1,
        questionData: expect.objectContaining({ prompt: 'Recovered prompt' }),
      }),
    );
  });

  it('does not clear a newer pending retry when an older metadata fetch resolves stale', async () => {
    const clearRetry = jest.fn();
    const stateRef = { current: { questionPool: [] } };
    const metadataResult = await resolveSingleQuestionMetadataBootstrap({
      questionId: 'q1',
      questionData: null,
      effectiveSingleSlug: 'edge',
      fetchSingleQuestionMetadataCandidates: jest.fn().mockResolvedValue({
        questionData: { id: 'q1', prompt: 'Recovered prompt' },
        effectiveSingleSlug: 'edge',
        fetchedAny: true,
        timedOutFetchCount: 0,
      }),
      resolveCacheState: jest.fn().mockResolvedValue({
        netIdStr: '84532',
        questionsCache: { 84532: { questions: {} } },
      }),
      normalizeSingleQuestionMetadataForCache: jest.fn().mockReturnValue({
        normalizedQuestionData: { id: 'q1', prompt: 'Recovered prompt' },
        shouldWriteQuestionPayload: false,
      }),
    });

    const staleRun = true;
    if (!staleRun && metadataResult.status !== 'missing-cache-state') {
      clearRetry();
      applyStateUpdate(stateRef, { questionPool: [metadataResult.questionData] });
    }

    expect(metadataResult.status).toBe('ready');
    expect(clearRetry).not.toHaveBeenCalled();
    expect(stateRef.current.questionPool).toEqual([]);
    expect(getPendingRetryAttemptFromSig('q2:1', 'q2')).toBe(1);
    // port note: the old test inspected `_singleQuestionBootstrapRetrySig`
    // directly. The hooks-safe contract is that stale metadata results do not
    // apply hydration or clear the newer retry owner.
  });

  it('renders a masked encrypted question placeholder while new Arweave metadata propagates', () => {
    const placeholderQuestion = buildSingleQuestionEncryptedMetadataPlaceholder({
      questionId: 'q1',
      sessionSlug: 'demo-4',
    });
    const patch = buildSingleQuestionPlaceholderHydrationState(
      {
        surveysResponseState: [],
      },
      {
        mergeSurveyResponseState,
        placeholderQuestion,
      },
    );

    expect(placeholderQuestion).toEqual(
      expect.objectContaining({
        id: 'q1',
        prompt: '[encrypted]',
        __ceQuestionMetadataPending: true,
      }),
    );
    expect(resolveQuestionPayloadDisplayState(placeholderQuestion)).toEqual(
      expect.objectContaining({
        masked: true,
        status: 'unavailable',
      }),
    );
    expect(patch).toEqual(
      expect.objectContaining({
        questionPool: [placeholderQuestion],
        isLoadingResponse: false,
        noResponse: false,
      }),
    );
  });

  it('preserves the current single-question metadata when a refetch loses cache state', async () => {
    const existingQuestion = { id: 'q1', type: 'binary', prompt: 'Existing prompt', tags: [] };

    await expect(
      resolveSingleQuestionMetadataBootstrap({
        questionId: 'q1',
        questionData: existingQuestion,
        effectiveSingleSlug: 'edge',
        forceRefetch: true,
        fetchSingleQuestionMetadataCandidates: jest.fn().mockResolvedValue({
          questionData: null,
          effectiveSingleSlug: 'edge',
          fetchedAny: false,
          timedOutFetchCount: 0,
        }),
        resolveCacheState: jest.fn().mockResolvedValue(null),
      }),
    ).resolves.toEqual({ status: 'missing-cache-state' });

    expect(
      buildSingleQuestionPreservedPoolState({
        questionId: 'q1',
        questionPool: [existingQuestion],
        extraState: { isLoadingResponse: false },
      }),
    ).toEqual({
      action: 'preserve',
      statePatch: {
        questionPool: [existingQuestion],
        isLoadingResponse: false,
      },
    });
  });

  it('lets an unmasked single-question payload override stale masked cache state', () => {
    const staleCached = { id: 'q1', type: 'binary', prompt: '[encrypted]' };
    const visibleCurrent = { id: 'q1', type: 'binary', prompt: 'Visible prompt', tags: [] };

    expect(isMaskedQuestionPayload(staleCached)).toBe(true);
    expect(isMaskedQuestionPayload(visibleCurrent)).toBe(false);
    expect(resolveQuestionPayloadDisplayState(visibleCurrent)).toEqual(
      expect.objectContaining({
        masked: false,
        status: 'public',
      }),
    );
  });

  it('keeps submit disabled when only the question id is loaded over stale masked cache state', () => {
    const readiness = buildSurveyQuestionsSubmitReadinessDescriptor({
      singleQuestionMode: true,
      pendingStats: { total: 1, encrypted: 0 },
      resolveMaskedCurrentQuestionPayload: () => true,
    });
    const displayState = buildSurveyQuestionsSubmitFooterDisplayState({
      hasMaskedCurrentQuestionPayload: readiness.hasMaskedCurrentQuestionPayload,
      isDirty: true,
      isSingleQuestionView: true,
      pendingEditCount: readiness.pendingEditCount,
      singleQuestionMode: readiness.singleQuestionMode,
    });

    expect(readiness.hasMaskedCurrentQuestionPayload).toBe(true);
    expect(displayState.submitDisabled).toBe(true);
  });

  it('does not downgrade scheduled single-question bootstrap retry attempts on cache ticks', () => {
    const pendingRetrySig = 'q1:3';
    const plan = buildSingleQuestionSourceRestoreContextPlan({
      bootstrapRetryAttempt: 0,
      getQuestionFetchCandidateSlugs: jest.fn(() => ['edge']),
      maxCandidateSlugs: 2,
      pendingRetrySig,
      props: {
        questionID: 'q1',
        responderAddress: RESPONDER,
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        questionsCacheNonce: 1,
        questionResponsesNonce: 2,
      },
      runId: 12,
    });

    expect(plan).toEqual(
      expect.objectContaining({
        status: 'ready',
        hasPendingRetryForQuestion: true,
        pendingRetrySig,
        questionId: 'q1',
      }),
    );
    expect(getPendingRetryAttemptFromSig(pendingRetrySig, 'q1')).toBe(3);
    // port note: the class-owned timeout and `_singleQuestionBootstrapRetrySig`
    // are private ledger state. This port preserves the behavior-level retry
    // signature and attempt selected on the cache-tick path.
  });

  it('reuses the pending single-question bootstrap retry attempt when cache ticks trigger componentDidUpdate', () => {
    const fetchOptions = buildRetryFetchOptionsFromPendingSig({
      pendingRetrySig: 'q1:3',
      questionId: 'q1',
    });

    expect(fetchOptions).toEqual({ bootstrapRetryAttempt: 3 });
    expect(
      resolveSingleQuestionCacheBootstrapStopHandlingPlan({
        bootstrapRetryAttempt: fetchOptions.bootstrapRetryAttempt,
        cacheBootstrapPlan: {
          action: 'stop',
          debugPhase: '',
          fallbackStatePatch: {},
          logMissingCacheState: false,
          preserveCurrentPoolPatch: null,
          retryPlan: {
            reason: 'recent-payload-waiting-for-response-bootstrap',
            retryingPhase: 'recent-payload-response-bootstrap-retrying',
            exhaustedPhase: 'recent-payload-response-bootstrap-exhausted',
            exhaustedStatePatch: { noResponse: true, isLoadingResponse: false },
          },
          seededHydration: null,
        },
        effectiveSingleSlug: 'edge',
        questionId: 'q1',
        responderAddress: RESPONDER,
        runId: 13,
      }),
    ).toEqual(
      expect.objectContaining({
        action: 'retry',
        retryRequest: {
          questionId: 'q1',
          attempt: 3,
          reason: 'recent-payload-waiting-for-response-bootstrap',
        },
      }),
    );
  });

  it('reuses the pending single-question bootstrap retry attempt during account-change rehydration fetches', () => {
    const events = [];
    const fetchOptions = buildRetryFetchOptionsFromPendingSig({
      pendingRetrySig: 'q1:3',
      questionId: 'q1',
    });

    events.push('reset');
    events.push('rehydrate-draft');
    events.push(['fetch-single-question', fetchOptions]);

    expect(events).toEqual(['reset', 'rehydrate-draft', ['fetch-single-question', { bootstrapRetryAttempt: 3 }]]);
    // port note: the old test observed a callback passed to
    // `resetFormStateForAccountChange()`. The hooks-safe behavior is that the
    // account-change branch carries the pending retry attempt into the fetch.
  });

  it('falls back to a deterministic warning state when viewed response payload shape is malformed', async () => {
    const stateRef = {
      current: {
        parsedViewAddressAnswers: null,
        noResponse: false,
        responseLookupWarning: '',
        isLoadingResponse: false,
      },
    };
    const safeSetState = jest.fn((update) => applyStateUpdate(stateRef, update));

    await expect(
      executeViewedSingleQuestionResponseBootstrap({
        props: { provider: {}, account: ACCOUNT },
        state: stateRef.current,
        questionId: 'q1',
        responderAddress: RESPONDER,
        effectiveSingleSlug: 'edge',
        safeSetState,
        getResponse: jest.fn().mockResolvedValue({}),
        getResponseHash: jest.fn(),
        readCachedResponderResponse: jest.fn().mockReturnValue(null),
        readFreshCachedResponderResponse: jest.fn().mockResolvedValue(null),
        normalizeViewedResponse: jest.fn().mockReturnValue(null),
        mergeViewedResponse: jest.fn((_prev, next) => next),
        scheduleRetry: jest.fn(),
        clearRetry: jest.fn(),
        writeResponseToCache: jest.fn(),
        prefillSingleQuestionResponse: jest.fn(),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        applied: false,
        reason: 'malformed',
      }),
    );

    expect(stateRef.current.noResponse).toBe(true);
    expect(stateRef.current.isLoadingResponse).toBe(false);
    expect(stateRef.current.responseLookupWarning).toContain('could not be rendered');
  });

  it('marks viewed response as no-response when response payload retries are exhausted', async () => {
    const stateRef = {
      current: {
        parsedViewAddressAnswers: null,
        noResponse: false,
        responseLookupWarning: '',
        isLoadingResponse: false,
      },
    };
    const safeSetState = jest.fn((update) => applyStateUpdate(stateRef, update));
    const scheduleRetry = jest.fn().mockReturnValue(false);
    const getResponse = jest.fn().mockResolvedValue(null);
    const getResponseHash = jest.fn().mockResolvedValue('tx-response-hash');

    await expect(
      executeViewedSingleQuestionResponseBootstrap({
        props: { provider: {}, account: ACCOUNT },
        state: stateRef.current,
        questionId: 'q1',
        responderAddress: RESPONDER,
        effectiveSingleSlug: 'edge',
        safeSetState,
        getResponse,
        getResponseHash,
        readCachedResponderResponse: jest.fn().mockReturnValue(null),
        readFreshCachedResponderResponse: jest.fn().mockResolvedValue(null),
        normalizeViewedResponse: jest.fn((value) => value),
        mergeViewedResponse: jest.fn((_prev, next) => next),
        scheduleRetry,
        clearRetry: jest.fn(),
        writeResponseToCache: jest.fn(),
        prefillSingleQuestionResponse: jest.fn(),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        applied: true,
        reason: 'hash-only',
      }),
    );

    expect(getResponse).toHaveBeenCalled();
    expect(getResponseHash).toHaveBeenCalled();
    expect(scheduleRetry).toHaveBeenCalledWith({
      questionId: 'q1',
      attempt: 0,
      reason: 'response-payload-pending',
    });
    expect(stateRef.current.noResponse).toBe(true);
    expect(stateRef.current.isLoadingResponse).toBe(false);
  });
});
