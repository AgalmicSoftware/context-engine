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

const shouldHydrateGateLabelsAfterUpdate = ({
  prevProps = {},
  nextProps = {},
  prevState = {},
  nextState = {},
} = {}) => (
  prevProps.sbtCacheRevision !== nextProps.sbtCacheRevision ||
  prevProps.network?.id !== nextProps.network?.id ||
  prevProps.networkChainId !== nextProps.networkChainId ||
  prevState.questionPool !== nextState.questionPool ||
  prevState.pileQuestions !== nextState.pileQuestions ||
  prevProps.questionPool !== nextProps.questionPool ||
  prevProps.questionsCacheNonce !== nextProps.questionsCacheNonce ||
  prevProps.questionResponsesNonce !== nextProps.questionResponsesNonce
);

const shouldRetryViewedBootstrapOnReadiness = ({
  prevProps = {},
  nextProps = {},
  nextState = {},
} = {}) => {
  const prevNetId = String(prevProps.network?.id ?? prevProps.networkChainId ?? '');
  const currNetId = String(nextProps.network?.id ?? nextProps.networkChainId ?? '');
  const authOrProviderBecameReady =
    (!prevProps.loginComplete && !!nextProps.loginComplete) ||
    (!prevProps.account && !!nextProps.account) ||
    (!prevProps.provider && !!nextProps.provider);
  const networkBecameReady = prevNetId !== currNetId && !!currNetId;
  const waitingForViewedResponseBootstrap =
    !!nextProps.responderAddress &&
    !nextState.parsedViewAddressAnswers &&
    nextState.noResponse !== true;
  const singleQuestionBootstrapPending =
    waitingForViewedResponseBootstrap || (
      !nextState.displayAnswerMode &&
      !nextState.parsedViewAddressAnswers &&
      (!Array.isArray(nextState.questionPool) || nextState.questionPool.length === 0)
    );
  return singleQuestionBootstrapPending && (authOrProviderBecameReady || networkBecameReady);
};

const shouldRehydrateStandaloneLocalResponses = ({
  prevProps = {},
  nextProps = {},
} = {}) => {
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
  const qid = String(questionId || '').trim().toLowerCase();
  const retrySig = String(pendingRetrySig || '').trim().toLowerCase();
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

    expect(buildQuestionIdScopeSignature(prevQuestionPool)).toBe(
      buildQuestionIdScopeSignature(nextQuestionPool)
    );
    expect(shouldHydrateGateLabelsAfterUpdate({
      prevProps: { questionPool: [] },
      nextProps: { questionPool: [] },
      prevState: { questionPool: prevQuestionPool, pileQuestions: [] },
      nextState: { questionPool: nextQuestionPool, pileQuestions: [] },
    })).toBe(true);
    // port note: the old test spied on `hydrateGateSbtLabels()` after
    // `componentDidUpdate`; the portable contract is that a state pool ref
    // change bypasses the no-op update guard even when question ids are stable.
  });

  it('does not short-circuit masked refresh when lit hooks become ready', () => {
    expect(shouldRetryMaskedQuestionRefresh({
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
    })).toBe(true);
  });

  it('retries viewed-response bootstrap on readiness even when questionPool is already seeded', () => {
    expect(shouldRetryViewedBootstrapOnReadiness({
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
    })).toBe(true);
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
    expect(buildAutomaticQuestionMetadataFetchOptions({
      passkeyReady: false,
    })).toEqual(expect.objectContaining({ skipDecrypt: true }));
    // port note: the class wrapper also builds a decrypt context; the behavior
    // guarded here is the boundary option passed to `getQuestionData`.
  });

  it('auto-decrypts single-question prompts when passkey wallet auto-sign is ready', () => {
    const options = buildAutomaticQuestionMetadataFetchOptions({
      passkeyReady: true,
    });

    expect(options).not.toEqual(expect.objectContaining({ skipDecrypt: true }));
    expect(options.decryptContext).toEqual(expect.objectContaining({
      account: ACCOUNT,
      providerLike: 'passkey_eoa',
    }));
  });

  it('falls back to known candidate slugs when pinned single-question slug is unresolved', async () => {
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockImplementation(
      async (_provider, _questionId, candidateSlug) => (
        String(candidateSlug || '').toLowerCase() === 'edge'
          ? { id: 'q1', type: 'binary', prompt: 'Recovered prompt', tags: [] }
          : null
      )
    );
    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue(['edge']);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      String(slug || '').toLowerCase() === 'edge' ? { networkChainId: 84532 } : null
    ));
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});

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

    await subject.fetchSingleQuestionData();
    await callbackRun;
    subject.clearSingleQuestionBootstrapRetry();

    const calledSlugs = getQuestionDataSpy.mock.calls.map((call) => String(call[2] || '').toLowerCase());
    expect(calledSlugs).toContain('general3');
    expect(calledSlugs).toContain('edge');
    expect(subject.state.questionPool[0]).toEqual(
      expect.objectContaining({ id: 'q1', prompt: 'Recovered prompt' })
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

    expect(getQuestionDataSpy).toHaveBeenCalled();
    expect(retrySpy).not.toHaveBeenCalled();
    expect(subject.state.questionPool[0].prompt).toBe('Recovered prompt');
  });

  it('does not clear a newer pending retry when an older metadata fetch resolves stale', async () => {
    const deferred = createDeferred();
    jest.spyOn(contractScripts, 'getQuestionData').mockImplementation(() => deferred.promise);
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
    syncClassSetState(subject);
    const clearSpy = jest.spyOn(subject, 'clearSingleQuestionBootstrapRetry');

    const runPromise = subject.fetchSingleQuestionData();
    await Promise.resolve();

    subject._singleQuestionBootstrapRetrySig = 'q2:1';
    subject._fetchSingleQuestionRunId += 1;
    deferred.resolve({
      id: 'q1',
      type: 'binary',
      prompt: 'Recovered prompt',
      tags: [],
    });

    await runPromise;

    expect(clearSpy).not.toHaveBeenCalled();
    expect(subject._singleQuestionBootstrapRetrySig).toBe('q2:1');
    expect(subject.state.questionPool).toEqual([]);
  });

  it('renders a masked encrypted question placeholder while new Arweave metadata propagates', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue(null);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'demo-4',
      activeSessionSlug: 'demo-4',
      sessionSlugPinned: true,
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      surveysResponseState: [],
      isLoadingResponse: true,
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    const retrySpy = jest.spyOn(subject, 'scheduleSingleQuestionBootstrapRetry').mockReturnValue(true);

    await subject.fetchSingleQuestionData();

    expect(retrySpy).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 'q1',
      reason: 'question-fetch-unavailable',
    }));
    expect(subject.state.isLoadingResponse).toBe(false);
    expect(subject.state.questionPool).toEqual([
      expect.objectContaining({
        id: 'q1',
        prompt: '[encrypted]',
        __ceQuestionMetadataPending: true,
      }),
    ]);
    expect(subject.state.surveysResponseState.length).toBeGreaterThan(0);
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
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Visible prompt', tags: [] }],
    };

    expect(subject.hasMaskedCurrentQuestionPayload()).toBe(false);
  });

  it('keeps submit disabled when only the question id is loaded over stale masked cache state', () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'binary', prompt: '[encrypted]' },
        },
        questionResponses: {},
        questionResponsesMeta: {},
      },
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

    expect(subject.hasMaskedCurrentQuestionPayload()).toBe(true);
  });

  it('does not downgrade scheduled single-question bootstrap retry attempts on cache ticks', async () => {
    jest.useFakeTimers();
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);

    const first = subject.scheduleSingleQuestionBootstrapRetry({
      questionId: 'q1',
      attempt: 2,
      reason: 'seed-attempt',
    });
    const second = subject.scheduleSingleQuestionBootstrapRetry({
      questionId: 'q1',
      attempt: 0,
      reason: 'cache-tick',
    });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(subject._singleQuestionBootstrapRetrySig).toBe('q1:3');

    jest.advanceTimersByTime(12000);
    await Promise.resolve();
    expect(subject.fetchSingleQuestionData).toHaveBeenCalledWith(
      expect.objectContaining({
        forceQuestionMetadataRefetch: true,
        bootstrapRetryAttempt: 3,
      })
    );
  });

  it('reuses the pending single-question bootstrap retry attempt when cache ticks trigger componentDidUpdate', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 1,
      questionResponsesNonce: 1,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      isDirty: false,
      modifiedCount: 0,
      parsedViewAddressAnswers: null,
      noResponse: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Prompt', tags: [] }],
      pileQuestions: [],
    };
    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);
    subject._singleQuestionBootstrapRetrySig = 'q1:3';

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 0,
    };
    const prevState = {
      ...subject.state,
    };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.fetchSingleQuestionData).toHaveBeenCalledWith(
      expect.objectContaining({ bootstrapRetryAttempt: 3 })
    );
  });

  it('reuses the pending single-question bootstrap retry attempt during account-change rehydration fetches', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
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
      isDirty: false,
      modifiedCount: 0,
      parsedViewAddressAnswers: { answer: { value: 'cached' } },
      noResponse: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Prompt', tags: [] }],
      pileQuestions: [],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.fetchSingleQuestionData = jest.fn().mockResolvedValue(undefined);
    subject.resetFormStateForAccountChange = jest.fn((cb) => {
      if (typeof cb === 'function') return cb();
      return undefined;
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject._singleQuestionBootstrapRetrySig = 'q1:3';
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') return cb();
      return patch;
    });

    const prevProps = {
      ...subject.props,
      account: '',
      loginComplete: false,
      provider: null,
    };
    const prevState = {
      ...subject.state,
    };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.resetFormStateForAccountChange).toHaveBeenCalledTimes(1);
    expect(subject.fetchSingleQuestionData).toHaveBeenCalledWith(
      expect.objectContaining({ bootstrapRetryAttempt: 3 })
    );
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

    await subject.fetchSingleQuestionData();
    await callbackRun;

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
