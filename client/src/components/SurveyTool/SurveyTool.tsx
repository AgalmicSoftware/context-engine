/** @file SurveyTool.tsx */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../../assets/css/contextEngine.scss';
import styles from './SurveyTool.module.scss';
import contractScripts, { getSessionSlugByName } from '../../utilities/web3/contractScripts.js';
import { listNamespaceEntriesSync, updateCacheAtomic } from '../../utilities/cache/cacheScripts.js';
import {
  resolveEffectiveSlug,
  getActiveSessionSlugFromProps,
  computeSubmitLabel,
  ensureQuestionsNet,
  ensureSurveysNet,
  mergeSurveyToolCachePatchIntoSurveysCache,
  readSurveysCache,
  readSurveysCacheAsync,
  readQuestionsCacheAsync,
  writeSurveysCache,
  resolveSlugForIds,
  surveyLog,
  resolveUpdateCacheContext,
  resolveSurveyReadContext,
  resolveEnsureQuestionCachedContext,
} from './surveyToolUtils.js';
import {
  buildSurveyToolHydratedFilterState,
  buildSurveyToolLoadingStatePatch,
  buildSurveyToolPubKeyStatePatch,
  buildSurveyToolQuestionsCacheNoncePatch,
  buildSurveyToolFilterStateUrlPath,
  buildSurveyToolResultsModalStatePatch,
  buildSurveyToolSurveyListStatePatch,
  buildSurveyToolSurveyListFromBag,
  findSurveyInAllSurveyCaches,
  getInitialCacheState,
  getNormalizedSurveyIdFromPropsValue,
  getResolvedSurveyToolPropsFromProps,
  getSurveyToolSessionPropFromProps,
  resolveSurveyToolResultsModalCloseState,
  resolveSurveyToolRenderMode,
  resolveSurveyToolSelectorRenderState,
  shouldBumpSurveyToolQuestionsCacheNonce,
  shouldFetchSurveyToolSurveysOnPropsChange,
  shouldOpenSurveyToolResultsOnPropsChange,
  shouldRouteSurveyToolMountToQuestions,
} from './surveyToolTopLevelHelpers';
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
type SurveyToolSurveyDataRecord = SurveyToolRecord & {
  creator?: unknown;
  id?: unknown;
  questionIDs?: unknown[];
  surveyID?: unknown;
  title?: unknown;
};
type SurveyToolContractScripts = Record<string, unknown> & {
  getSurveyDataById: (...args: unknown[]) => Promise<unknown>;
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
  isQuestionCacheReady?: boolean;
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
type SurveyToolQuestionsCacheNonceState = Record<string, unknown> & {
  questionsCacheNonce?: unknown;
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
type SurveyToolLegacyCacheState = {
  cache?: unknown;
};
type SurveyToolLegacyState = SurveyToolLegacyCacheState &
  SurveyToolRecord & {
    cache: SurveyToolCacheState;
    hydratedFilterState: unknown;
    loading: boolean;
    pubKey: string;
    questionsCacheNonce: number;
    showResultsModal: boolean;
    surveys?: unknown[];
  };
type SurveyToolSetStateInput =
  SurveyToolRecord | null | undefined | ((state: SurveyToolLegacyState, props: SurveyToolProps) => unknown);
type SurveyToolSurveyFetchContext = {
  netIdStr?: unknown;
  slug?: unknown;
};
type SurveyToolQuestionRefTarget = {
  handlePrimarySubmitClick?: () => void;
  state?: {
    isSubmitting?: unknown;
  };
};
type SurveyToolCacheUpdaterFn = (cache: unknown) => unknown;
type SurveyToolCacheUpdater = (updater: unknown, cb?: () => void) => unknown;
type SurveyToolQuestionCacheEnsurer = (questionId: unknown, ctx?: SurveyToolEnsureQuestionContext) => unknown;
type SurveyToolFilterStateUrlUpdater = (newFilterState: unknown) => unknown;
type SurveyToolLegacyInstance = {
  _lastSurveysCtx: SurveyToolSurveyFetchContext;
  _surveyToolFetchEpoch: number;
  closeResultsModal: () => void;
  componentDidMount: () => Promise<void>;
  componentDidUpdate: (prevProps: SurveyToolProps) => void;
  componentWillUnmount: () => void;
  ensureQuestionCached: (questionId: unknown, ctx?: SurveyToolEnsureQuestionContext) => Promise<void>;
  fetchSurveys: () => Promise<void>;
  findSurveyInAllCaches: (surveyID: unknown) => ReturnType<typeof findSurveyInAllSurveyCaches>;
  getNormalizedSurveyIdFromProps: () => ReturnType<typeof getNormalizedSurveyIdFromPropsValue>;
  getResolvedSurveyToolProps: () => SurveyToolProps;
  getSurveyData: (surveyID: unknown) => Promise<SurveyToolSurveyDataRecord | null>;
  getSurveyToolSessionProp: () => ReturnType<typeof getSurveyToolSessionPropFromProps>;
  handleHeaderSubmitClick: () => void;
  handleTopLevelFilterStateUrlUpdate: SurveyToolFilterStateUrlUpdater;
  loadInitialData: () => Promise<void>;
  props: SurveyToolProps;
  render: () => ReturnType<typeof renderSurveyToolContent>;
  setState: (next: SurveyToolSetStateInput, cb?: () => void) => unknown;
  state: SurveyToolLegacyState;
  surveyQuestionsRef: { current: SurveyToolQuestionRefTarget | null };
  updateCache: SurveyToolCacheUpdater;
  updatePubKey: (newPubKey: string) => void;
  updateSelectedSurvey?: () => void;
};

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

const findSurveyInAllCaches = (surveyID: unknown) => {
  return findSurveyInAllSurveyCaches(surveyID, listNamespaceEntriesSync);
};

const createLegacySurveyToolInstance = (props: SurveyToolProps) => {
  const instance = {
    props,
    state: {
      cache: getInitialCacheState(),
      latestBlockNumber: 0,
      events: [],
      showResultsModal: props.autoOpenResults || false,
      pubKey: '',
      questionsCacheNonce: 0,
      loading: false,
      hydratedFilterState: buildHydratedFilterState(props),
    },
    surveyQuestionsRef: { current: null },
    _surveyToolFetchEpoch: 0,
    _lastSurveysCtx: {},
  } as unknown as SurveyToolLegacyInstance;

  instance.setState = (next: SurveyToolSetStateInput, cb?: () => void) => {
    const patch = typeof next === 'function' ? next(instance.state as SurveyToolLegacyState, instance.props) : next;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...(patch as SurveyToolRecord) };
    }
    if (typeof cb === 'function') cb();
    return patch;
  };

  instance.getSurveyToolSessionProp = () => getSurveyToolSessionPropFromProps(instance.props);

  instance.getResolvedSurveyToolProps = () => getResolvedSurveyToolPropsFromProps(instance.props);

  instance.handleHeaderSubmitClick = () => {
    const target = instance.surveyQuestionsRef?.current;
    if (!target || typeof target.handlePrimarySubmitClick !== 'function') return;
    if (target.state?.isSubmitting) return;
    target.handlePrimarySubmitClick();
  };

  instance.updatePubKey = (newPubKey: string) => {
    instance.setState(buildSurveyToolPubKeyStatePatch({ pubKey: newPubKey }));
  };

  instance.getNormalizedSurveyIdFromProps = () => getNormalizedSurveyIdFromPropsValue(instance.props);

  instance.handleTopLevelFilterStateUrlUpdate = (newFilterState: unknown) => {
    updateFilterStateUrlForProps(instance.props, newFilterState);
  };

  instance.findSurveyInAllCaches = (surveyID: unknown) => findSurveyInAllCaches(surveyID);

  instance.componentDidMount = async () => {
    if (
      shouldRouteSurveyToolMountToQuestions({
        pathname: window.location.pathname,
        props: instance.props,
      })
    ) {
      window.history.pushState({}, '', '/questions');
    }

    instance.fetchSurveys();
  };

  instance.componentDidUpdate = (prevProps: SurveyToolProps) => {
    if (shouldFetchSurveyToolSurveysOnPropsChange({ prevProps, props: instance.props })) {
      instance.fetchSurveys();
    }

    if (
      shouldOpenSurveyToolResultsOnPropsChange({
        prevProps,
        props: instance.props,
        showResultsModal: instance.state.showResultsModal,
      })
    ) {
      instance.setState(buildSurveyToolResultsModalStatePatch({ open: true }));
    }

    if (shouldBumpSurveyToolQuestionsCacheNonce({ prevProps, props: instance.props })) {
      instance.setState((prev: SurveyToolQuestionsCacheNonceState) => buildSurveyToolQuestionsCacheNoncePatch(prev));
    }
  };

  instance.componentWillUnmount = () => {};

  instance.closeResultsModal = () => {
    const hasExternalCloseHandler = typeof instance.props.onResultsModalClose === 'function';
    const closeState = resolveSurveyToolResultsModalCloseState({
      pathname: window.location.pathname,
      hasExternalCloseHandler,
    });
    if (closeState.shouldTrimResultsPath) {
      window.history.pushState({}, '', closeState.nextPathname);
    }
    instance.setState(buildSurveyToolResultsModalStatePatch({ open: false }));
    if (closeState.shouldCallExternalCloseHandler && typeof instance.props.onResultsModalClose === 'function') {
      instance.props.onResultsModalClose();
    }
  };

  instance.getSurveyData = async (surveyID: unknown) => {
    if (instance.props.singleQuestionMode) {
      return null;
    }

    const resolvedProps = instance.getResolvedSurveyToolProps();
    const slug = resolveEffectiveSlug(resolvedProps);
    const surveyReadContext = resolveSurveyReadContext(resolvedProps, slug);
    const effectiveSlug = surveyReadContext.sessionSlug || slug;
    const netIdStr = surveyReadContext.networkIdStr;
    const loweredSurveyID = String(surveyID).toLowerCase();

    surveyLog.log(`[SurveyTool] Getting data for ${loweredSurveyID} in context: ${effectiveSlug} (Chain: ${netIdStr})`);

    let surveyData: SurveyToolSurveyDataRecord | null = null;

    if (netIdStr) {
      const surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);

      if (surveysCache[netIdStr]?.surveys?.[loweredSurveyID]) {
        surveyData = surveysCache[netIdStr].surveys[loweredSurveyID] as SurveyToolSurveyDataRecord;
      }
    }

    if (!surveyData) {
      const found = instance.findSurveyInAllCaches(loweredSurveyID);
      if (found) {
        surveyLog.log(
          `[SurveyTool] Found survey ${loweredSurveyID} cached in different group: '${found.foundSlug}'. Using cached data.`,
        );
        surveyData = found.data as SurveyToolSurveyDataRecord;
      }
    }

    if (!surveyData && netIdStr) {
      surveyLog.log(`[SurveyTool] Cache miss. Fetching from chain for ${effectiveSlug}...`);
      try {
        surveyData = (await cs.getSurveyDataById(
          resolvedProps.provider,
          loweredSurveyID,
          effectiveSlug,
        )) as SurveyToolSurveyDataRecord | null;

        if (surveyData) {
          surveyData.surveyID = loweredSurveyID;
          if (!surveyData.questionIDs) surveyData.questionIDs = [];
          if (!surveyData.creator) surveyData.creator = '';
          surveyData.id = surveyData.surveyID;

          const cacheToUpdate = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
          if (!cacheToUpdate[netIdStr])
            cacheToUpdate[netIdStr] = { surveys: {}, surveysLatestBlock: 0, surveyResponses: {} };
          if (!cacheToUpdate[netIdStr].surveys) cacheToUpdate[netIdStr].surveys = {};

          cacheToUpdate[netIdStr].surveys[loweredSurveyID] = surveyData;
          await writeSurveysCache(effectiveSlug, cacheToUpdate);
        }
      } catch (e) {
        surveyLog.error('[SurveyTool] Chain fetch failed:', e);
      }
    }

    return surveyData;
  };

  instance.loadInitialData = async () => {
    surveyLog.log('SurveyTool: loadInitialData - This method is deprecated for initial broad survey fetching.');
  };

  instance.fetchSurveys = async () => {
    const requestEpoch = Number(instance._surveyToolFetchEpoch || 0) + 1;
    instance._surveyToolFetchEpoch = requestEpoch;
    if (!instance.state.loading) {
      instance.setState(buildSurveyToolLoadingStatePatch({ loading: true }));
    }

    const resolvedProps = instance.getResolvedSurveyToolProps();
    const slug = resolveEffectiveSlug(resolvedProps);
    const surveyReadContext = resolveSurveyReadContext(resolvedProps, slug);
    const effectiveSlug = surveyReadContext.sessionSlug || slug;
    const netIdStr = surveyReadContext.networkIdStr;
    if (!netIdStr) {
      if (requestEpoch !== instance._surveyToolFetchEpoch) return;
      surveyLog.error('SurveySelector: Network ID is undefined in fetchSurveys.');
      instance.setState(buildSurveyToolSurveyListStatePatch());
      return;
    }

    const prevCtx = instance._lastSurveysCtx || {};
    const ctxChanged = prevCtx.slug !== effectiveSlug || prevCtx.netIdStr !== netIdStr;

    const prevList = Array.isArray(instance.state.surveys) ? instance.state.surveys : [];
    const prevCount = prevList.length;

    let surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
    if (requestEpoch !== instance._surveyToolFetchEpoch) return;

    const surveyBag = surveysCache?.[netIdStr]?.surveys || {};

    if (!surveyBag || Object.keys(surveyBag).length === 0) {
      if (prevCount > 0 && !ctxChanged) {
        if (requestEpoch !== instance._surveyToolFetchEpoch) return;
        instance.setState(buildSurveyToolLoadingStatePatch(), instance.updateSelectedSurvey);
        return;
      }
      if (requestEpoch !== instance._surveyToolFetchEpoch) return;
      instance.setState(buildSurveyToolSurveyListStatePatch(), instance.updateSelectedSurvey);
      instance._lastSurveysCtx = { slug: effectiveSlug, netIdStr };
      return;
    }

    const next = buildSurveyToolSurveyListFromBag(surveyBag);

    if (next.length === 0 && prevCount > 0 && !ctxChanged) {
      if (requestEpoch !== instance._surveyToolFetchEpoch) return;
      instance.setState(buildSurveyToolLoadingStatePatch(), instance.updateSelectedSurvey);
      return;
    }

    const warming = !instance.props.isSurveyCacheReady || !instance.props.isQuestionCacheReady;
    if (next.length < prevCount && !ctxChanged && warming) {
      if (requestEpoch !== instance._surveyToolFetchEpoch) return;
      instance.setState(buildSurveyToolLoadingStatePatch(), instance.updateSelectedSurvey);
      return;
    }

    if (requestEpoch !== instance._surveyToolFetchEpoch) return;
    instance.setState(buildSurveyToolSurveyListStatePatch({ surveys: next }), instance.updateSelectedSurvey);
    instance._lastSurveysCtx = { slug: effectiveSlug, netIdStr };
  };

  instance.ensureQuestionCached = async (questionId: unknown, ctx: SurveyToolEnsureQuestionContext = {}) => {
    const resolvedProps = instance.getResolvedSurveyToolProps();
    const currentSlug = resolveEffectiveSlug(resolvedProps);
    const currentCacheContext = resolveEnsureQuestionCachedContext(resolvedProps, currentSlug);
    const netIdStr = currentCacheContext.networkIdStr || '';
    if (!netIdStr) {
      surveyLog.error('SurveyTool: Network ID undefined in ensureQuestionCached');
      return;
    }
    let questionsCache = ensureQuestionsNet(await readQuestionsCacheAsync(currentSlug), netIdStr);

    const qIdLower = String(questionId).toLowerCase();
    if (!questionsCache[netIdStr].questions[qIdLower]) {
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
        instance.setState((prevState: SurveyToolQuestionsCacheNonceState) =>
          buildSurveyToolQuestionsCacheNoncePatch(prevState),
        );
      } else {
        surveyLog.warn(`SurveyTool: Question data not found on chain for ID: ${qIdLower}`);
      }
    }
  };

  instance.updateCache = (updater: unknown, cb?: () => void) => {
    if (typeof updater !== 'function') {
      surveyLog.error('updateCache expects a function; got:', updater);
      return;
    }
    const updateCacheFn = updater as SurveyToolCacheUpdaterFn;
    const resolvedProps = instance.getResolvedSurveyToolProps();
    const slug = resolveEffectiveSlug(resolvedProps);
    const updateCacheContext = resolveUpdateCacheContext(resolvedProps, slug);
    const effectiveSlug = updateCacheContext.sessionSlug || slug;
    const netIdStr = updateCacheContext.networkIdStr;

    instance.setState((prev: SurveyToolLegacyCacheState) => {
      const newCache = updateCacheFn(prev.cache || {}) as SurveyToolCachePatch;
      if (netIdStr) {
        try {
          const global = mergeSurveyToolCachePatchIntoSurveysCache(readSurveysCache(effectiveSlug), netIdStr, newCache);
          writeSurveysCache(effectiveSlug, global);
        } catch (err) {
          surveyLog.warn('[SurveyTool] updateCache merge failed:', err);
        }
      }
      return { cache: newCache };
    }, cb);
  };

  instance.render = () =>
    renderSurveyToolContent({
      props: instance.props,
      cache: instance.state.cache,
      showResultsModal: instance.state.showResultsModal,
      pubKey: instance.state.pubKey,
      questionsCacheNonce: instance.state.questionsCacheNonce,
      hydratedFilterState: instance.state.hydratedFilterState,
      updateCache: instance.updateCache,
      updatePubKey: instance.updatePubKey,
      ensureQuestionCached: instance.ensureQuestionCached,
      closeResultsModal: instance.closeResultsModal,
      handleTopLevelFilterStateUrlUpdate: instance.handleTopLevelFilterStateUrlUpdate,
    });

  return instance;
};

const SurveyToolRuntime = (props: SurveyToolProps) => {
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

  const surveyQuestionsRef = useRef<SurveyToolQuestionRefTarget | null>(null);
  const _surveyToolFetchEpoch = useRef(0);
  const _lastSurveysCtx = useRef<SurveyToolSurveyFetchContext>({});
  const loadingRef = useRef(loading);
  const surveysRef = useRef<unknown[] | undefined>(surveys);
  const showResultsModalRef = useRef(showResultsModal);
  const pendingUpdateCacheCallbacksRef = useRef<Array<() => void>>([]);
  const didRunFetchUpdateEffectRef = useRef(false);
  const didRunAutoOpenUpdateEffectRef = useRef(false);
  const didRunNonceUpdateEffectRef = useRef(false);
  const prevFetchNetworkIdRef = useRef(props.network?.id);
  const prevSurveyCacheReadyRef = useRef(props.isSurveyCacheReady);
  const prevAutoOpenResultsRef = useRef(props.autoOpenResults);
  const prevQuestionCacheReadyRef = useRef(props.isQuestionCacheReady);
  const prevResponsesCacheReadyRef = useRef(props.isResponsesCacheReady);
  const prevQuestionResponsesNonceRef = useRef(props.questionResponsesNonce);
  const prevNonceNetworkIdRef = useRef(props.network?.id);

  loadingRef.current = loading;
  surveysRef.current = surveys;
  showResultsModalRef.current = showResultsModal;

  const getSurveyToolSessionProp = () => getSurveyToolSessionPropFromProps(propsRef.current);

  const getResolvedSurveyToolProps = () => getResolvedSurveyToolPropsFromProps(propsRef.current);

  const handleHeaderSubmitClick = useCallback(() => {
    const target = surveyQuestionsRef?.current;
    if (!target || typeof target.handlePrimarySubmitClick !== 'function') return;
    if (target.state?.isSubmitting) return;
    target.handlePrimarySubmitClick();
  }, []);

  const getNormalizedSurveyIdFromProps = () => getNormalizedSurveyIdFromPropsValue(propsRef.current);

  const handleTopLevelFilterStateUrlUpdate = useCallback((newFilterState: unknown) => {
    updateFilterStateUrlForProps(propsRef.current, newFilterState);
  }, []);

  const getSurveyData = async (surveyID: unknown) => {
    const currentProps = propsRef.current;
    if (currentProps.singleQuestionMode) {
      return null;
    }

    const resolvedProps = getResolvedSurveyToolProps();
    const slug = resolveEffectiveSlug(resolvedProps);
    const surveyReadContext = resolveSurveyReadContext(resolvedProps, slug);
    const effectiveSlug = surveyReadContext.sessionSlug || slug;
    const netIdStr = surveyReadContext.networkIdStr;
    const loweredSurveyID = String(surveyID).toLowerCase();

    surveyLog.log(`[SurveyTool] Getting data for ${loweredSurveyID} in context: ${effectiveSlug} (Chain: ${netIdStr})`);

    let surveyData: SurveyToolSurveyDataRecord | null = null;

    if (netIdStr) {
      const surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);

      if (surveysCache[netIdStr]?.surveys?.[loweredSurveyID]) {
        surveyData = surveysCache[netIdStr].surveys[loweredSurveyID] as SurveyToolSurveyDataRecord;
      }
    }

    if (!surveyData) {
      const found = findSurveyInAllCaches(loweredSurveyID);
      if (found) {
        surveyLog.log(
          `[SurveyTool] Found survey ${loweredSurveyID} cached in different group: '${found.foundSlug}'. Using cached data.`,
        );
        surveyData = found.data as SurveyToolSurveyDataRecord;
      }
    }

    if (!surveyData && netIdStr) {
      surveyLog.log(`[SurveyTool] Cache miss. Fetching from chain for ${effectiveSlug}...`);
      try {
        surveyData = (await cs.getSurveyDataById(
          resolvedProps.provider,
          loweredSurveyID,
          effectiveSlug,
        )) as SurveyToolSurveyDataRecord | null;

        if (surveyData) {
          surveyData.surveyID = loweredSurveyID;
          if (!surveyData.questionIDs) surveyData.questionIDs = [];
          if (!surveyData.creator) surveyData.creator = '';
          surveyData.id = surveyData.surveyID;

          const cacheToUpdate = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
          if (!cacheToUpdate[netIdStr])
            cacheToUpdate[netIdStr] = { surveys: {}, surveysLatestBlock: 0, surveyResponses: {} };
          if (!cacheToUpdate[netIdStr].surveys) cacheToUpdate[netIdStr].surveys = {};

          cacheToUpdate[netIdStr].surveys[loweredSurveyID] = surveyData;
          await writeSurveysCache(effectiveSlug, cacheToUpdate);
        }
      } catch (e) {
        surveyLog.error('[SurveyTool] Chain fetch failed:', e);
      }
    }

    return surveyData;
  };

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

    let surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
    if (requestEpoch !== _surveyToolFetchEpoch.current) return;

    const surveyBag = surveysCache?.[netIdStr]?.surveys || {};

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
    let questionsCache = ensureQuestionsNet(await readQuestionsCacheAsync(currentSlug), netIdStr);

    const qIdLower = String(questionId).toLowerCase();
    if (!questionsCache[netIdStr].questions[qIdLower]) {
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
          const global = mergeSurveyToolCachePatchIntoSurveysCache(readSurveysCache(effectiveSlug), netIdStr, newCache);
          writeSurveysCache(effectiveSlug, global);
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
      hasExternalCloseHandler,
    });
    if (closeState.shouldTrimResultsPath) {
      window.history.pushState({}, '', closeState.nextPathname);
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

    initialFetchSurveysRef.current();
  }, []);

  useEffect(() => {
    const currentProps = {
      network: { id: props.network?.id },
      isSurveyCacheReady: props.isSurveyCacheReady,
    };
    if (!didRunFetchUpdateEffectRef.current) {
      didRunFetchUpdateEffectRef.current = true;
      prevFetchNetworkIdRef.current = currentProps.network.id;
      prevSurveyCacheReadyRef.current = currentProps.isSurveyCacheReady;
      return;
    }

    if (
      shouldFetchSurveyToolSurveysOnPropsChange({
        prevProps: {
          network: { id: prevFetchNetworkIdRef.current },
          isSurveyCacheReady: prevSurveyCacheReadyRef.current,
        },
        props: currentProps,
      })
    ) {
      fetchSurveys();
    }

    prevFetchNetworkIdRef.current = currentProps.network.id;
    prevSurveyCacheReadyRef.current = currentProps.isSurveyCacheReady;
  }, [props.network?.id, props.isSurveyCacheReady, fetchSurveys]);

  useEffect(() => {
    const currentProps = { autoOpenResults: props.autoOpenResults };
    if (!didRunAutoOpenUpdateEffectRef.current) {
      didRunAutoOpenUpdateEffectRef.current = true;
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

  void getSurveyToolSessionProp;
  void handleHeaderSubmitClick;
  void getNormalizedSurveyIdFromProps;
  void getSurveyData;

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

function SurveyTool(props: SurveyToolProps): React.ReactElement;
function SurveyTool(this: unknown, props: SurveyToolProps) {
  if (new.target) {
    return createLegacySurveyToolInstance(props);
  }

  return <SurveyToolRuntime {...props} />;
}

export default SurveyTool;
