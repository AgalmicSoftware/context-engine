/** @file SurveyTool.tsx */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../../assets/css/contextEngine.scss';
import styles from './SurveyTool.module.scss';
import contractScripts, { getSessionSlugByName } from '../../utilities/web3/chainGateway.js';
import { updateCacheAtomic } from '../../utilities/cache/cacheScripts.js';
import {
  resolveEffectiveSlug,
  getActiveSessionSlugFromProps,
  computeSubmitLabel,
  ensureQuestionsNet,
  readSurveysCache,
  readSurveysCacheAsync,
  readQuestionsCacheAsync,
  writeSurveysCache,
  resolveSlugForIds,
  surveyLog,
  resolveUpdateCacheContext,
  resolveSurveyReadContext,
  resolveEnsureQuestionCachedContext,
} from './surveyToolUtils';
import {
  buildSurveyToolHydratedFilterState,
  buildSurveyToolFilterStateUrlPath,
  buildSurveyToolSurveyListFromBag,
  getInitialCacheState,
  getResolvedSurveyToolPropsFromProps,
  getSurveyToolSessionPropFromProps,
  resolveSurveyToolResultsModalCloseState,
  resolveSurveyToolRenderMode,
  resolveSurveyToolSelectorRenderState,
  shouldBumpSurveyToolQuestionsCacheNonce,
  shouldFetchSurveyToolSurveyIndex,
  shouldFetchSurveyToolSurveysOnPropsChange,
  shouldOpenSurveyToolResultsOnPropsChange,
  shouldRouteSurveyToolMountToQuestions,
} from './surveyToolTopLevelHelpers';
import {
  persistSurveyToolCachePatchForCurrentTarget,
  readSurveyToolScopedCacheNode,
  shouldUseSurveyToolChainCacheMissFallback,
} from './surveyToolWorkerCacheIsolation';
import { SurveySelector } from './SurveySelector';

const LazySurveyQuestions = React.lazy(() =>
  import('./SurveyQuestions').then((module) => ({ default: module.SurveyQuestions })),
);
const LazyPileViewMode = React.lazy(() =>
  import('./SurveyPileViewMode').then((module) => ({ default: module.PileViewMode })),
);
const SurveyResults = React.lazy(() => import('./SurveyResults'));

type SurveyToolRecord = Record<string, unknown>;
type SurveyToolQuestionDataRecord = SurveyToolRecord & {
  creator?: unknown;
  id?: unknown;
  tags?: unknown;
};
type SurveyToolContractScripts = Record<string, unknown> & {
  getQuestionData: (...args: unknown[]) => Promise<SurveyToolQuestionDataRecord | null | undefined>;
};

const cs = contractScripts as unknown as SurveyToolContractScripts;

type SurveyToolProps = {
  minifiedMode?: string;
  filterState?: unknown;
  autoOpenResults?: boolean;
  singleQuestionMode?: boolean;
  questionID?: string;
  responderAddress?: string;
  surveyId?: string;
  surveyID?: string;
  sessionSlug?: string;
  sessionSlugPinned?: boolean;
  sessionConfig?: unknown;
  ensureLightSbtUniverse?: unknown;
  account?: string;
  provider?: unknown;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  loginModalToggled?: boolean;
  network?: { id?: number; chainId?: number; name?: string };
  networkChainId?: number;
  networkLatestBlock?: number;
  sbtCacheRevision?: number;
  toggleLoginModal?: () => void;
  refreshSurveyResponsesByID?: (...args: unknown[]) => unknown;
  refreshQuestionMetadata?: (...args: unknown[]) => unknown;
  refreshQuestionResponses?: (...args: unknown[]) => unknown;
  defaultTags?: unknown[];
  defaultFeaturedSBTs?: unknown[];
  defaultFilterState?: unknown;
  onFilterChange?: (...args: unknown[]) => unknown;
  onResultsModalClose?: () => void;
  preventUrlChange?: boolean;
  miniMode?: boolean;
  hideEmbeddedDebugUi?: boolean;
  toolbarTarget?: HTMLElement | null;
  questionCountTarget?: HTMLElement | null;
  isQuestionCacheReady?: boolean;
  cacheInitializationError?: unknown;
  isResponsesCacheReady?: boolean;
  isSurveyCacheReady?: boolean;
  isSBTCacheReady?: boolean;
  questionScanProgress?: unknown;
  questionPool?: unknown[];
  questionResponsesNonce?: number;
  sessionInfo?: unknown;
  sessionName?: string;
  displayAnswerMode?: boolean;
  viewAddress?: string;
  lit?: unknown;
  litHooks?: unknown;
  [key: string]: unknown;
};

type SurveyToolLitHookSource = {
  getKey?: unknown;
};
type SurveyToolWindowWithLitHooks = Window & {
  __litHooks?: unknown;
  litHooks?: unknown;
};
type SurveyToolEnsureQuestionContext = Record<string, unknown> & {
  sessionName?: unknown;
};
type SurveyToolCacheState = ReturnType<typeof getInitialCacheState> & SurveyToolRecord;
type SurveyToolCachePatch = SurveyToolRecord & {
  surveyResponses?: Record<string, unknown>;
  surveyResponsesLatestBlock?: Record<string, unknown>;
  surveys?: Record<string, unknown>;
};
type SurveyToolSurveyFetchContext = {
  netIdStr?: unknown;
  slug?: unknown;
};
type SurveyToolCacheUpdaterFn = (cache: unknown) => unknown;
type SurveyToolCacheUpdater = (updater: unknown, cb?: () => void) => unknown;
type SurveyToolQuestionCacheEnsurer = (questionId: unknown, ctx?: SurveyToolEnsureQuestionContext) => unknown;
type SurveyToolFilterStateUrlUpdater = (newFilterState: unknown) => unknown;
type SurveyToolRenderArgs = {
  props: SurveyToolProps;
  cache: unknown;
  showResultsModal: boolean;
  pubKey: string;
  questionsCacheNonce: number;
  hydratedFilterState: unknown;
  updateCache: SurveyToolCacheUpdater;
  updatePubKey: (newPubKey: string) => void;
  ensureQuestionCached: SurveyToolQuestionCacheEnsurer;
  closeResultsModal: () => void;
  handleTopLevelFilterStateUrlUpdate: SurveyToolFilterStateUrlUpdater;
};

const buildHydratedFilterState = (props: SurveyToolProps) => {
  if (typeof window === 'undefined') return null;

  const { filterState, cleanUrl, error } = buildSurveyToolHydratedFilterState({
    props,
    href: window.location.href,
  });

  if (error) {
    surveyLog.error('SurveyTool: Error hydrating filter state from URL', error);
    return filterState;
  }

  if (cleanUrl) {
    try {
      window.history.replaceState({}, '', cleanUrl);
    } catch (e) {
      surveyLog.error('SurveyTool: Error hydrating filter state from URL', e);
    }
  }

  return filterState;
};

const updateFilterStateUrlForProps = (props: SurveyToolProps, newFilterState: unknown) => {
  if (typeof window === 'undefined') return;
  const newPath = buildSurveyToolFilterStateUrlPath(props, newFilterState);

  if (!props.preventUrlChange) {
    const currentUrl = `${window.location.pathname}${window.location.search || ''}`;
    if (currentUrl !== newPath) {
      window.history.replaceState({}, '', newPath);
    }
  }
};

const getSurveyToolWindowLitHooks = (): unknown => {
  if (typeof window === 'undefined') return null;
  const surveyToolWindow = window as SurveyToolWindowWithLitHooks;
  return surveyToolWindow.__litHooks || surveyToolWindow.litHooks || null;
};

const getSurveyToolLitGetKey = (litHooks: unknown): ((...args: unknown[]) => unknown) | null => {
  if (!litHooks || (typeof litHooks !== 'object' && typeof litHooks !== 'function')) return null;
  const getKey = (litHooks as SurveyToolLitHookSource).getKey;
  return typeof getKey === 'function' ? (getKey as (...args: unknown[]) => unknown) : null;
};

const renderSurveyToolContent = ({
  props,
  cache,
  showResultsModal,
  pubKey,
  questionsCacheNonce,
  hydratedFilterState,
  updateCache,
  updatePubKey,
  ensureQuestionCached,
  closeResultsModal,
  handleTopLevelFilterStateUrlUpdate,
}: SurveyToolRenderArgs) => {
  const activeSessionSlug = getActiveSessionSlugFromProps(props);
  const toolSessionSlug = getSurveyToolSessionPropFromProps(props);
  const renderModeState = resolveSurveyToolRenderMode({
    minifiedMode: props.minifiedMode,
    singleQuestionMode: props.singleQuestionMode,
  });

  if (renderModeState.shouldRenderPileMode) {
    return (
      <LazyPileViewMode
        {...props}
        isStandalone={true}
        surveyIndex={0}
        onFilterChange={props.onFilterChange}
        questionsCacheNonce={questionsCacheNonce}
        ensureQuestionCached={ensureQuestionCached}
        pubKey={pubKey}
        updatePubKey={updatePubKey}
        computeSubmitLabel={computeSubmitLabel}
        activeSessionSlug={activeSessionSlug}
        sessionSlug={toolSessionSlug}
        sessionConfig={props.sessionConfig}
        ensureLightSbtUniverse={props.ensureLightSbtUniverse}
      />
    );
  }

  if (renderModeState.shouldRenderSingleQuestionMode) {
    return (
      <div id={styles.surveySelectorRow}>
        <React.Suspense fallback={null}>
          <LazySurveyQuestions
            questionID={props.questionID}
            responderAddress={props.responderAddress}
            singleQuestionMode={true}
            toggleLoginModal={props.toggleLoginModal}
            account={props.account}
            provider={props.provider}
            lit={props.lit}
            litHooks={props.litHooks}
            loginComplete={props.loginComplete}
            loginInProgress={props.loginInProgress}
            network={props.network}
            networkChainId={props.networkChainId}
            cache={cache}
            updateCache={updateCache}
            pubKey={pubKey}
            updatePubKey={updatePubKey}
            refreshSurveyResponsesByID={props.refreshSurveyResponsesByID}
            refreshQuestionMetadata={props.refreshQuestionMetadata}
            refreshQuestionResponses={props.refreshQuestionResponses}
            defaultFeaturedSBTs={props.defaultFeaturedSBTs}
            cacheInitializationError={props.cacheInitializationError}
            isQuestionCacheReady={props.isQuestionCacheReady}
            isResponsesCacheReady={props.isResponsesCacheReady}
            isSurveyCacheReady={props.isSurveyCacheReady}
            isSBTCacheReady={props.isSBTCacheReady}
            questionResponsesNonce={props.questionResponsesNonce}
            questionsCacheNonce={questionsCacheNonce}
            ensureQuestionCached={ensureQuestionCached}
            computeSubmitLabel={computeSubmitLabel}
            activeSessionSlug={activeSessionSlug}
            sessionSlug={toolSessionSlug}
            sessionSlugPinned={props.sessionSlugPinned}
            sessionConfig={props.sessionConfig}
            hideEmbeddedDebugUi={props.hideEmbeddedDebugUi}
          />
        </React.Suspense>
      </div>
    );
  }

  const selectorRenderState = resolveSurveyToolSelectorRenderState({
    props,
    hydratedFilterState,
  });
  const { normalizedSurveyId, effectiveFilterState, shouldWarnMismatchedSurveyIds, mismatchedSurveyIdWarning } =
    selectorRenderState;

  if (shouldWarnMismatchedSurveyIds) {
    if (process.env.NODE_ENV !== 'production') {
      surveyLog.warn(mismatchedSurveyIdWarning);
    }
  }

  return (
    <div id={styles.surveySelectorRow}>
      <SurveySelector
        SurveyQuestionsComponent={LazySurveyQuestions}
        surveyId={normalizedSurveyId}
        displayAnswerMode={props.displayAnswerMode}
        viewAddress={props.viewAddress}
        toggleLoginModal={props.toggleLoginModal}
        account={props.account}
        provider={props.provider}
        lit={props.lit}
        litHooks={props.litHooks}
        loginComplete={props.loginComplete}
        loginInProgress={props.loginInProgress}
        network={props.network}
        networkChainId={props.networkChainId}
        cache={cache}
        updateCache={updateCache}
        questionID={props.questionID}
        responderAddress={props.responderAddress}
        singleQuestionMode={false}
        defaultTags={props.defaultTags}
        defaultFeaturedSBTs={props.defaultFeaturedSBTs}
        defaultFilterState={props.defaultFilterState}
        refreshSurveyResponsesByID={props.refreshSurveyResponsesByID}
        refreshQuestionMetadata={props.refreshQuestionMetadata}
        refreshQuestionResponses={props.refreshQuestionResponses}
        autoOpenResults={false}
        filterState={effectiveFilterState}
        cacheInitializationError={props.cacheInitializationError}
        isQuestionCacheReady={props.isQuestionCacheReady}
        isResponsesCacheReady={props.isResponsesCacheReady}
        isSurveyCacheReady={props.isSurveyCacheReady}
        isSBTCacheReady={props.isSBTCacheReady}
        networkLatestBlock={props.networkLatestBlock}
        questionScanProgress={props.questionScanProgress}
        questionPool={props.questionPool}
        questionResponsesNonce={props.questionResponsesNonce}
        questionsCacheNonce={questionsCacheNonce}
        ensureQuestionCached={ensureQuestionCached}
        onFilterChange={props.onFilterChange}
        preventUrlChange={props.preventUrlChange}
        computeSubmitLabel={computeSubmitLabel}
        activeSessionSlug={activeSessionSlug}
        sessionSlug={toolSessionSlug}
        sessionSlugPinned={props.sessionSlugPinned}
        sessionConfig={props.sessionConfig}
        ensureLightSbtUniverse={props.ensureLightSbtUniverse}
        hideEmbeddedDebugUi={props.hideEmbeddedDebugUi}
        embeddedSessionToolbar={Boolean(props.hideEmbeddedDebugUi && props.sessionSlugPinned)}
        toolbarTarget={props.toolbarTarget}
        questionCountTarget={props.questionCountTarget}
      />
      <React.Suspense fallback={null}>
        <SurveyResults
          isOpen={showResultsModal}
          onClose={closeResultsModal}
          provider={props.provider}
          lit={props.lit}
          litHooks={props.litHooks}
          network={props.network}
          networkChainId={props.networkChainId}
          sbtCacheRevision={props.sbtCacheRevision}
          surveyId={normalizedSurveyId}
          filterState={effectiveFilterState}
          questionResponsesNonce={props.questionResponsesNonce}
          questionsCacheNonce={questionsCacheNonce}
          refreshSurveyResponsesByID={props.refreshSurveyResponsesByID}
          refreshQuestionMetadata={props.refreshQuestionMetadata}
          refreshQuestionResponses={props.refreshQuestionResponses}
          defaultFeaturedSBTs={props.defaultFeaturedSBTs}
          defaultTags={props.defaultTags}
          sessionInfo={props.sessionInfo}
          sessionName={props.sessionName}
          cacheInitializationError={props.cacheInitializationError}
          isQuestionCacheReady={props.isQuestionCacheReady}
          isResponsesCacheReady={props.isResponsesCacheReady}
          isSurveyCacheReady={props.isSurveyCacheReady}
          isSBTCacheReady={props.isSBTCacheReady}
          questionScanProgress={props.questionScanProgress}
          onFilterChange={props.onFilterChange}
          currentViewModeForUrl={normalizedSurveyId ? 'survey' : 'questions'}
          currentSurveyIdForUrl={normalizedSurveyId || null}
          onFilterStateChangeForUrlUpdate={handleTopLevelFilterStateUrlUpdate}
          preventUrlChange={props.preventUrlChange}
          sessionSlug={toolSessionSlug}
          activeSessionSlug={activeSessionSlug}
          sessionConfig={props.sessionConfig}
          ensureLightSbtUniverse={props.ensureLightSbtUniverse}
          sessionSlugPinned={props.sessionSlugPinned}
          hideEmbeddedDebugUi={props.hideEmbeddedDebugUi}
        />
      </React.Suspense>
    </div>
  );
};

const SurveyTool = (props: SurveyToolProps) => {
  const propsRef = useRef(props);
  propsRef.current = props;

  const [cache, setCache] = useState<SurveyToolCacheState>(getInitialCacheState);
  const [showResultsModal, setShowResultsModal] = useState(props.autoOpenResults || false);
  const [pubKey, setPubKey] = useState('');
  const [questionsCacheNonce, setQuestionsCacheNonce] = useState(0);
  const [loading, setLoading] = useState(false);
  const [surveys, setSurveys] = useState<unknown[]>();
  const [hydratedFilterState] = useState(() => buildHydratedFilterState(props));
  const [cacheCallbackTick, setCacheCallbackTick] = useState(0);

  const _surveyToolFetchEpoch = useRef(0);
  const _lastSurveysCtx = useRef<SurveyToolSurveyFetchContext>({});
  const loadingRef = useRef(loading);
  const surveysRef = useRef<unknown[] | undefined>(surveys);
  const showResultsModalRef = useRef(showResultsModal);
  const pendingUpdateCacheCallbacksRef = useRef<Array<() => void>>([]);
  const didRunFetchUpdateEffectRef = useRef(false);
  const didRunAutoOpenUpdateEffectRef = useRef(false);
  const didRunNonceUpdateEffectRef = useRef(false);
  const prevSurveyFetchPropsRef = useRef<SurveyToolProps>({
    network: { id: props.network?.id },
    isSurveyCacheReady: props.isSurveyCacheReady,
    minifiedMode: props.minifiedMode,
    singleQuestionMode: props.singleQuestionMode,
    sessionConfig: props.sessionConfig,
  });
  const prevAutoOpenResultsRef = useRef(props.autoOpenResults);
  const prevQuestionCacheReadyRef = useRef(props.isQuestionCacheReady);
  const prevResponsesCacheReadyRef = useRef(props.isResponsesCacheReady);
  const prevQuestionResponsesNonceRef = useRef(props.questionResponsesNonce);
  const prevNonceNetworkIdRef = useRef(props.network?.id);

  loadingRef.current = loading;
  surveysRef.current = surveys;
  showResultsModalRef.current = showResultsModal;

  const getResolvedSurveyToolProps = () => getResolvedSurveyToolPropsFromProps(propsRef.current);

  const handleTopLevelFilterStateUrlUpdate = useCallback((newFilterState: unknown) => {
    updateFilterStateUrlForProps(propsRef.current, newFilterState);
  }, []);

  const fetchSurveys = useCallback(async () => {
    const requestEpoch = Number(_surveyToolFetchEpoch.current || 0) + 1;
    _surveyToolFetchEpoch.current = requestEpoch;
    if (!loadingRef.current) {
      setLoading(true);
    }

    const resolvedProps = getResolvedSurveyToolProps();
    const slug = resolveEffectiveSlug(resolvedProps);
    const surveyReadContext = resolveSurveyReadContext(resolvedProps, slug);
    const effectiveSlug = surveyReadContext.sessionSlug || slug;
    const netIdStr = surveyReadContext.networkIdStr;
    if (!netIdStr) {
      if (requestEpoch !== _surveyToolFetchEpoch.current) return;
      surveyLog.error('SurveySelector: Network ID is undefined in fetchSurveys.');
      setSurveys([]);
      setLoading(false);
      return;
    }

    const prevCtx = _lastSurveysCtx.current || {};
    const ctxChanged = prevCtx.slug !== effectiveSlug || prevCtx.netIdStr !== netIdStr;

    const prevList = Array.isArray(surveysRef.current) ? surveysRef.current : [];
    const prevCount = prevList.length;

    const surveysCache = await readSurveysCacheAsync(effectiveSlug);
    if (requestEpoch !== _surveyToolFetchEpoch.current) return;

    const scopedSurveyCache = readSurveyToolScopedCacheNode({
      cache: surveysCache,
      cacheScope: netIdStr,
      sessionConfig: resolvedProps.sessionConfig,
      sessionSlug: effectiveSlug,
    });
    const surveyBag = (scopedSurveyCache?.surveys as SurveyToolRecord | undefined) || {};

    if (!surveyBag || Object.keys(surveyBag).length === 0) {
      if (prevCount > 0 && !ctxChanged) {
        if (requestEpoch !== _surveyToolFetchEpoch.current) return;
        setLoading(false);
        return;
      }
      if (requestEpoch !== _surveyToolFetchEpoch.current) return;
      setSurveys([]);
      setLoading(false);
      _lastSurveysCtx.current = { slug: effectiveSlug, netIdStr };
      return;
    }

    const next = buildSurveyToolSurveyListFromBag(surveyBag);

    if (next.length === 0 && prevCount > 0 && !ctxChanged) {
      if (requestEpoch !== _surveyToolFetchEpoch.current) return;
      setLoading(false);
      return;
    }

    const currentProps = propsRef.current;
    const warming = !currentProps.isSurveyCacheReady || !currentProps.isQuestionCacheReady;
    if (next.length < prevCount && !ctxChanged && warming) {
      if (requestEpoch !== _surveyToolFetchEpoch.current) return;
      setLoading(false);
      return;
    }

    if (requestEpoch !== _surveyToolFetchEpoch.current) return;
    setSurveys(next);
    setLoading(false);
    _lastSurveysCtx.current = { slug: effectiveSlug, netIdStr };
  }, []);

  const ensureQuestionCached = useCallback(async (questionId: unknown, ctx: SurveyToolEnsureQuestionContext = {}) => {
    const resolvedProps = getResolvedSurveyToolProps();
    const currentSlug = resolveEffectiveSlug(resolvedProps);
    const currentCacheContext = resolveEnsureQuestionCachedContext(resolvedProps, currentSlug);
    const netIdStr = currentCacheContext.networkIdStr || '';
    if (!netIdStr) {
      surveyLog.error('SurveyTool: Network ID undefined in ensureQuestionCached');
      return;
    }
    const cachedQuestions = await readQuestionsCacheAsync(currentSlug);
    const scopedQuestionsCache = readSurveyToolScopedCacheNode({
      cache: cachedQuestions,
      cacheScope: netIdStr,
      sessionConfig: resolvedProps.sessionConfig,
      sessionSlug: currentSlug,
    });
    const questionsCache = ensureQuestionsNet(
      netIdStr === 'worker' && !scopedQuestionsCache ? {} : cachedQuestions,
      netIdStr,
    );

    const qIdLower = String(questionId).toLowerCase();
    if (!questionsCache[netIdStr].questions[qIdLower]) {
      if (!shouldUseSurveyToolChainCacheMissFallback(netIdStr)) return;
      let fetchSlug = currentSlug;

      const sessionNameHint = ctx.sessionName;
      if (sessionNameHint) {
        const mapped = getSessionSlugByName(sessionNameHint);
        if (mapped !== null) fetchSlug = mapped;
      } else {
        fetchSlug = resolveSlugForIds({
          questionId: qIdLower,
          props: resolvedProps,
          network: resolvedProps.network,
        });
      }

      surveyLog.log(`SurveyTool: Question ${qIdLower} not in ${currentSlug} cache. Fetching from: '${fetchSlug}'...`);

      const litHooks = resolvedProps.lit || resolvedProps.litHooks || getSurveyToolWindowLitHooks();
      const litGetKey = getSurveyToolLitGetKey(litHooks);
      const decryptContext = {
        account: resolvedProps.account || '',
        providerLike: resolvedProps.provider || '',
        chainId: currentCacheContext.networkId || null,
        litHooks,
        litOpts: litGetKey ? { getKey: litGetKey } : null,
      };

      let questionData = await cs.getQuestionData(resolvedProps.provider, qIdLower, fetchSlug, { decryptContext });

      const allowGeneralFallback = !currentSlug;
      if (!questionData && fetchSlug !== '' && allowGeneralFallback) {
        surveyLog.log(`SurveyTool: Question ${qIdLower} not found in '${fetchSlug}', trying general fallback...`);
        questionData = await cs.getQuestionData(resolvedProps.provider, qIdLower, '', {
          decryptContext: {
            ...decryptContext,
            chainId: Number(resolvedProps.network?.id || 0) || decryptContext.chainId,
          },
        });
      }

      if (questionData) {
        questionData.id = qIdLower;
        if (!questionData.creator) questionData.creator = '';
        if (!questionData.tags) questionData.tags = [];

        const persistedCache = await updateCacheAtomic('questionsCache', currentSlug, (current: unknown) => {
          const nextCache = ensureQuestionsNet(
            current && typeof current === 'object' ? (current as SurveyToolRecord) : {},
            netIdStr,
          );
          nextCache[netIdStr].questions[qIdLower] = questionData;
          return nextCache;
        });
        const persisted = !!persistedCache;
        surveyLog.log(`SurveyTool: Question ${qIdLower} fetched and cached in ${currentSlug}.`);

        if (!persisted) {
          surveyLog.warn('SurveyTool: question cache persist failed while ensuring question cached', {
            slug: currentSlug,
            questionId: qIdLower,
          });
        }
        setQuestionsCacheNonce((prevState) => prevState + 1);
      } else {
        surveyLog.warn(`SurveyTool: Question data not found on chain for ID: ${qIdLower}`);
      }
    }
  }, []);
  const initialMountPropsRef = useRef(props);
  const initialFetchSurveysRef = useRef(fetchSurveys);

  const updateCache = useCallback((updater: unknown, cb?: () => void) => {
    if (typeof updater !== 'function') {
      surveyLog.error('updateCache expects a function; got:', updater);
      return;
    }
    const updateCacheFn = updater as SurveyToolCacheUpdaterFn;
    const resolvedProps = getResolvedSurveyToolProps();
    const slug = resolveEffectiveSlug(resolvedProps);
    const updateCacheContext = resolveUpdateCacheContext(resolvedProps, slug);
    const effectiveSlug = updateCacheContext.sessionSlug || slug;
    const netIdStr = updateCacheContext.networkIdStr;

    setCache((prevCache) => {
      const newCache = updateCacheFn(prevCache || {}) as SurveyToolCachePatch;
      if (typeof cb === 'function') {
        pendingUpdateCacheCallbacksRef.current.push(cb);
      }
      if (netIdStr) {
        try {
          persistSurveyToolCachePatchForCurrentTarget({
            expectedContext: updateCacheContext,
            expectedSessionSlug: effectiveSlug,
            getCurrentContext: () => {
              const liveProps = getResolvedSurveyToolProps();
              return resolveUpdateCacheContext(liveProps, resolveEffectiveSlug(liveProps));
            },
            patch: newCache,
            readSurveysCache,
            writeSurveysCache,
          });
        } catch (err) {
          surveyLog.warn('[SurveyTool] updateCache merge failed:', err);
        }
      }
      return newCache as SurveyToolCacheState;
    });
    if (typeof cb === 'function') {
      setCacheCallbackTick((t) => t + 1);
    }
  }, []);

  const closeResultsModal = useCallback(() => {
    const currentProps = propsRef.current;
    const onClose = currentProps.onResultsModalClose;
    const hasExternalCloseHandler = typeof onClose === 'function';
    const closeState = resolveSurveyToolResultsModalCloseState({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      hasExternalCloseHandler,
    });
    if (closeState.shouldTrimResultsPath) {
      window.history.pushState({}, '', closeState.nextUrl);
    }
    setShowResultsModal(false);
    if (closeState.shouldCallExternalCloseHandler && typeof onClose === 'function') {
      onClose();
    }
  }, []);

  useEffect(() => {
    const pending = pendingUpdateCacheCallbacksRef.current.splice(0, pendingUpdateCacheCallbacksRef.current.length);
    pending.forEach((cb) => cb());
  }, [cache, cacheCallbackTick]);

  useEffect(() => {
    const initialProps = initialMountPropsRef.current;
    if (
      shouldRouteSurveyToolMountToQuestions({
        pathname: window.location.pathname,
        props: initialProps,
      })
    ) {
      window.history.pushState({}, '', '/questions');
    }

    if (shouldFetchSurveyToolSurveyIndex(initialProps)) {
      initialFetchSurveysRef.current();
    }
  }, []);

  useEffect(() => {
    const currentProps = {
      network: { id: props.network?.id },
      isSurveyCacheReady: props.isSurveyCacheReady,
      minifiedMode: props.minifiedMode,
      singleQuestionMode: props.singleQuestionMode,
      sessionConfig: props.sessionConfig,
    };
    if (!didRunFetchUpdateEffectRef.current) {
      didRunFetchUpdateEffectRef.current = true;
      prevSurveyFetchPropsRef.current = currentProps;
      return;
    }

    if (
      shouldFetchSurveyToolSurveysOnPropsChange({
        prevProps: prevSurveyFetchPropsRef.current,
        props: currentProps,
      })
    ) {
      fetchSurveys();
    }

    prevSurveyFetchPropsRef.current = currentProps;
  }, [
    props.network?.id,
    props.isSurveyCacheReady,
    props.minifiedMode,
    props.singleQuestionMode,
    props.sessionConfig,
    fetchSurveys,
  ]);

  useEffect(() => {
    const currentProps = { autoOpenResults: props.autoOpenResults };
    if (!didRunAutoOpenUpdateEffectRef.current) {
      didRunAutoOpenUpdateEffectRef.current = true;
      if (currentProps.autoOpenResults && !showResultsModalRef.current) {
        setShowResultsModal(true);
      }
      prevAutoOpenResultsRef.current = currentProps.autoOpenResults;
      return;
    }

    if (
      shouldOpenSurveyToolResultsOnPropsChange({
        prevProps: { autoOpenResults: prevAutoOpenResultsRef.current },
        props: currentProps,
        showResultsModal: showResultsModalRef.current,
      })
    ) {
      setShowResultsModal(true);
    }

    prevAutoOpenResultsRef.current = currentProps.autoOpenResults;
  }, [props.autoOpenResults]);

  useEffect(() => {
    const currentProps = {
      isQuestionCacheReady: props.isQuestionCacheReady,
      isResponsesCacheReady: props.isResponsesCacheReady,
      questionResponsesNonce: props.questionResponsesNonce,
      network: { id: props.network?.id },
    };
    if (!didRunNonceUpdateEffectRef.current) {
      didRunNonceUpdateEffectRef.current = true;
      prevQuestionCacheReadyRef.current = currentProps.isQuestionCacheReady;
      prevResponsesCacheReadyRef.current = currentProps.isResponsesCacheReady;
      prevQuestionResponsesNonceRef.current = currentProps.questionResponsesNonce;
      prevNonceNetworkIdRef.current = currentProps.network.id;
      return;
    }

    if (
      shouldBumpSurveyToolQuestionsCacheNonce({
        prevProps: {
          isQuestionCacheReady: prevQuestionCacheReadyRef.current,
          isResponsesCacheReady: prevResponsesCacheReadyRef.current,
          questionResponsesNonce: prevQuestionResponsesNonceRef.current,
          network: { id: prevNonceNetworkIdRef.current },
        },
        props: currentProps,
      })
    ) {
      setQuestionsCacheNonce((prev) => prev + 1);
    }

    prevQuestionCacheReadyRef.current = currentProps.isQuestionCacheReady;
    prevResponsesCacheReadyRef.current = currentProps.isResponsesCacheReady;
    prevQuestionResponsesNonceRef.current = currentProps.questionResponsesNonce;
    prevNonceNetworkIdRef.current = currentProps.network.id;
  }, [props.isQuestionCacheReady, props.isResponsesCacheReady, props.questionResponsesNonce, props.network?.id]);

  return renderSurveyToolContent({
    props,
    cache,
    showResultsModal,
    pubKey,
    questionsCacheNonce,
    hydratedFilterState,
    updateCache,
    updatePubKey: setPubKey,
    ensureQuestionCached,
    closeResultsModal,
    handleTopLevelFilterStateUrlUpdate,
  });
};

export default SurveyTool;
