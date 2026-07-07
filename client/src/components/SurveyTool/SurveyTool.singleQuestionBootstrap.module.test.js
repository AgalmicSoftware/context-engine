import SurveyTool from './SurveyTool';
import {
  computeSubmitLabel,
  doesQuestionProgressMatchSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
  buildSurveyDraftSemanticSignature,
} from './surveyToolUtils.js';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';
import { QuestionsDashboard } from './SurveySelector';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import { DeferredCommitSlider } from './DeferredCommitSlider';
import { QuestionFilter as RawQuestionFilter } from './QuestionFilter';
import TagModal from '../TagPage/TagModal';
import GatedPromptNotice from './GatedPromptNotice';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import contractScripts, * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as portoFunctions from '../../utilities/web3/portoFunctions.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as sponsoredAccess from '../../utilities/web3/sponsoredAccess.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  countElements,
  findElement,
  findFirstNodeByType,
  findNodeByClassName,
  getElementChildren,
  nodeHasClassName,
  treeHasDataTestId,
  treeHasLabel,
  treeHasText,
} from './surveyToolTreeTestHelpers.js';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushAsyncCallbacks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
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

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'next' }],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
      autoDecryptEnabled: false,
      showComments: {},
      prefillQueuedAfterCache: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
    };

    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.emitPendingStats = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = { ...subject.props };
    const prevState = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'prev' }],
    };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.hydrateGateSbtLabels).toHaveBeenCalledTimes(1);
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

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
    };

    subject.hasMaskedCurrentQuestionPayload = () => true;
    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.emitPendingStats = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = { ...subject.props, litHooks: null };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.fetchSingleQuestionData).toHaveBeenCalledTimes(1);
  });

  it('retries viewed-response bootstrap on readiness even when questionPool is already seeded', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: '0xquestion',
      responderAddress,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject.state = {
      ...subject.state,
      displayAnswerMode: true,
      parsedViewAddressAnswers: null,
      noResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [{ id: '0xquestion', type: 'binary', prompt: 'seeded' }],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
    };

    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.emitPendingStats = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = {
      ...subject.props,
      provider: null,
      loginComplete: false,
    };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.fetchSingleQuestionData).toHaveBeenCalledTimes(1);
  });

  it('rehydrates standalone prior responses when wallet auth becomes ready after mount', async () => {
    const questionPool = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      questionPool,
      account: '0xabc',
      loginComplete: true,
      provider: 'porto_passkey',
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject.state = {
      ...subject.state,
      questionPool,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
      autoDecryptEnabled: false,
      showComments: {},
      prefillQueuedAfterCache: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
    };

    subject.resetFormStateForAccountChange = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.emitPendingStats = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.isAutoDecryptBlocked = () => false;
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    const prevProps = {
      ...subject.props,
      account: '',
      loginComplete: false,
      provider: '',
    };

    await subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.resetFormStateForAccountChange).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('rehydrates standalone prior responses when the response cache nonce ticks', async () => {
    const questionPool = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      questionPool,
      account: '0xabc',
      loginComplete: true,
      provider: 'porto_passkey',
      network: { id: 84532 },
      networkChainId: 84532,
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 3,
      questionResponsesNonce: 8,
    });

    subject.state = {
      ...subject.state,
      questionPool,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
      autoDecryptEnabled: false,
      showComments: {},
      prefillQueuedAfterCache: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
    };

    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.resetFormStateForAccountChange = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.emitPendingStats = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 7,
    };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
    expect(subject.resetFormStateForAccountChange).not.toHaveBeenCalled();
  });

  it('keeps single-question metadata fetch scoped to pinned session slug', async () => {
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue(null);
    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue(['edge', 'other']);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation((slug) => (
      String(slug || '').toLowerCase() === 'edge'
        ? { slug: 'edge', networkChainId: 84532 }
        : null
    ));
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      return patch;
    });

    await subject.fetchSingleQuestionData();
    subject.clearSingleQuestionBootstrapRetry();

    expect(getQuestionDataSpy).toHaveBeenCalled();
    expect(
      getQuestionDataSpy.mock.calls.every((call) => String(call[2] || '').toLowerCase() === 'edge')
    ).toBe(true);
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

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'general3',
      activeSessionSlug: 'general3',
      sessionSlugPinned: true,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((update, cb) => {
      const prevState = subject.state;
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (
        subject.didEditDiffInputsChange(subject.props, prevState) &&
        !subject._responseHydrationStateUpdateDepth
      ) {
        subject.invalidateResponseHydrationRuns();
      }
      if (typeof cb === 'function') {
        const maybePromise = cb();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
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
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockImplementation(() => deferred.promise);
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      return patch;
    });
    const retrySpy = jest.spyOn(subject, 'scheduleSingleQuestionBootstrapRetry');

    const runPromise = subject.fetchSingleQuestionData({
      questionFetchTimeoutMs: 3000,
      questionFetchTimeoutRecoveryMs: 12000,
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
    await runPromise;

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

    await runPromise;

    expect(clearSpy).not.toHaveBeenCalled();
    expect(subject._singleQuestionBootstrapRetrySig).toBe('q2:1');
    expect(subject.state.questionPool).toEqual([]);
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
    jest.spyOn(cacheScripts, 'readCache')
      .mockResolvedValueOnce({
        '84532': {
          questions: {
            q1: { id: 'q1', type: 'binary', prompt: 'Existing prompt', tags: [] },
          },
          questionResponses: {},
          questionResponsesMeta: {},
        },
      })
      .mockResolvedValueOnce(null);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue(null);

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
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      isLoadingResponse: true,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Existing prompt', tags: [] }],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchSingleQuestionData({ forceQuestionMetadataRefetch: true });

    expect(subject.state.isLoadingResponse).toBe(false);
    expect(subject.state.questionPool).toEqual([
      expect.objectContaining({ id: 'q1', prompt: 'Existing prompt' }),
    ]);
  });

  it('lets an unmasked single-question payload override stale masked cache state', () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'binary', prompt: '[encrypted]' },
        },
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });

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

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'binary', tags: [] }],
    };

    expect(events).toEqual(['reset', 'rehydrate-draft', ['fetch-single-question', { bootstrapRetryAttempt: 3 }]]);
    // port note: the old test observed a callback passed to
    // `resetFormStateForAccountChange()`. The hooks-safe behavior is that the
    // account-change branch carries the pending retry attempt into the fetch.
  });

  it('falls back to a deterministic warning state when viewed response payload shape is malformed', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Prompt from cache', creator: responderAddress },
        },
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getResponse').mockResolvedValue({});
    jest.spyOn(contractScripts, 'getResponseHash').mockResolvedValue(null);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      displayAnswerMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      responseLookupWarning: '',
      isLoadingResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((update, cb) => {
      const prevState = subject.state;
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (
        subject.didEditDiffInputsChange(subject.props, prevState) &&
        !subject._responseHydrationStateUpdateDepth
      ) {
        subject.invalidateResponseHydrationRuns();
      }
      if (typeof cb === 'function') {
        const maybePromise = cb();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
    });

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

    expect(subject.state.noResponse).toBe(true);
    expect(subject.state.isLoadingResponse).toBe(false);
    expect(String(subject.state.responseLookupWarning || '')).toContain('could not be rendered');
  });

  it('marks viewed response as no-response when response payload retries are exhausted', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'binary', prompt: 'Prompt from cache', creator: responderAddress },
        },
        questionResponses: {},
        questionResponsesMeta: {},
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
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue(null);
    const getResponseHashSpy = jest.spyOn(contractScripts, 'getResponseHash').mockResolvedValue('tx-response-hash');

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') {
        const maybePromise = cb();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
    });
    const retrySpy = jest
      .spyOn(subject, 'scheduleSingleQuestionBootstrapRetry')
      .mockReturnValue(false);

    await subject.fetchSingleQuestionData();
    await callbackRun;

    expect(getResponseSpy).toHaveBeenCalled();
    expect(getResponseHashSpy).toHaveBeenCalled();
    expect(retrySpy).toHaveBeenCalled();
    expect(subject.state.noResponse).toBe(true);
    expect(subject.state.isLoadingResponse).toBe(false);
  });

});
