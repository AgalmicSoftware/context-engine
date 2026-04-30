/** @file SurveyTool.tsx */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import "../../assets/css/contextEngine.scss";
import styles from './SurveyTool.module.scss';
import SurveyResults from './SurveyResults';
import contractScripts, {
  getSessionSlugByName
} from '../../utilities/web3/contractScripts.js';
import { deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import {
  listNamespaceEntriesSync,
  updateCacheAtomic,
} from '../../utilities/cache/cacheScripts.js';
import {
  normalizeSessionSlugValue,
  resolveEffectiveSlug,
  isSurveyToolFilterStateActive,
  getActiveSessionSlugFromProps,
  computeSubmitLabel,
  ensureQuestionsNet,
  ensureSurveysNet,
  readSurveysCache,
  readSurveysCacheAsync,
  readQuestionsCacheAsync,
  writeSurveysCache,
  resolveSlugForIds,
  serializeSurveyToolFilterState,
  normalizeSurveyToolFilterState,
  appendExplicitSessionHintToPath,
  applyExistingGroupPrefix,
  surveyLog,
  resolveUpdateCacheContext,
  resolveSurveyReadContext,
  resolveEnsureQuestionCachedContext,
} from './surveyToolUtils.js';
import { SurveySelector } from './SurveySelector';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';

type SurveyToolProps = {
  minifiedMode?: string;
  filterState?: any;
  autoOpenResults?: boolean;
  singleQuestionMode?: boolean;
  questionID?: string;
  responderAddress?: string;
  surveyId?: string;
  surveyID?: string;
  sessionSlug?: string;
  sessionSlugPinned?: boolean;
  account?: string;
  provider?: any;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  network?: { id?: number; chainId?: number; name?: string };
  networkChainId?: number;
  networkLatestBlock?: number;
  sbtCacheRevision?: number;
  toggleLoginModal?: () => void;
  refreshSurveyResponsesByID?: (...args: any[]) => any;
  refreshQuestionMetadata?: (...args: any[]) => any;
  refreshQuestionResponses?: (...args: any[]) => any;
  defaultTags?: any[];
  defaultFeaturedSBTs?: any[];
  defaultFilterState?: any;
  onFilterChange?: (...args: any[]) => any;
  onResultsModalClose?: () => void;
  preventUrlChange?: boolean;
  miniMode?: boolean;
  hideEmbeddedDebugUi?: boolean;
  isQuestionCacheReady?: boolean;
  isResponsesCacheReady?: boolean;
  isSurveyCacheReady?: boolean;
  isSBTCacheReady?: boolean;
  questionScanProgress?: any;
  questionResponsesNonce?: number;
  sessionInfo?: any;
  sessionName?: string;
  displayAnswerMode?: string;
  viewAddress?: string;
  lit?: any;
  litHooks?: any;
  [key: string]: any;
};

type SurveyToolRenderArgs = {
  props: SurveyToolProps;
  cache: any;
  showResultsModal: boolean;
  pubKey: string;
  questionsCacheNonce: number;
  hydratedFilterState: any;
  updateCache: (...args: any[]) => any;
  updatePubKey: (newPubKey: string) => void;
  ensureQuestionCached: (...args: any[]) => any;
  closeResultsModal: () => void;
  handleTopLevelFilterStateUrlUpdate: (...args: any[]) => any;
};

const getInitialCacheState = () => ({
  surveyIDs: [],
  questionIDs: [],
  questionResponses: {},
  arweaveContent: {},
});

const getSurveyToolSessionPropFromProps = (props: SurveyToolProps) => {
  if (typeof props.sessionSlug === 'string') return normalizeSessionSlugValue(props.sessionSlug);
  return undefined;
};

const getResolvedSurveyToolPropsFromProps = (props: SurveyToolProps) => {
  const sessionSlug = getSurveyToolSessionPropFromProps(props);
  if (typeof sessionSlug === 'undefined') return props;
  return {
    ...props,
    sessionSlug,
  };
};

const getNormalizedSurveyIdFromPropsValue = (props: SurveyToolProps) => {
  const { surveyId, surveyID } = props;
  const rawId = surveyId || surveyID;
  return rawId ? String(rawId).trim().toLowerCase() : null;
};

const buildHydratedFilterState = (props: SurveyToolProps) => {
  let urlFilterState = null;
  const isPile = props.minifiedMode === 'pile';
  const hasPropFilter = isSurveyToolFilterStateActive(props.filterState);

  if (!isPile && !hasPropFilter && typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      const filterParam = url.searchParams.get('filter');
      if (filterParam) {
        urlFilterState = normalizeSurveyToolFilterState(deserializeFilterState(filterParam));
        url.searchParams.delete('filter');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {
      surveyLog.error("SurveyTool: Error hydrating filter state from URL", e);
    }
  }

  return urlFilterState;
};

const updateFilterStateUrlForProps = (props: SurveyToolProps, newFilterState: any) => {
  if (typeof window === 'undefined') return;
  const serializedState = serializeSurveyToolFilterState(newFilterState);
  const normalizedSurveyId = getNormalizedSurveyIdFromPropsValue(props);
  const slug = resolveEffectiveSlug(getResolvedSurveyToolPropsFromProps(props)) || '';
  let newPath = normalizedSurveyId
    ? `/survey/${normalizedSurveyId}/results`
    : `/questions/results`;

  if (serializedState) {
    newPath += `?filter=${serializedState}`;
  }
  newPath = appendExplicitSessionHintToPath(newPath, slug);
  newPath = applyExistingGroupPrefix(newPath);

  if (!props.preventUrlChange) {
    const currentUrl = `${window.location.pathname}${window.location.search || ''}`;
    if (currentUrl !== newPath) {
      window.history.replaceState({}, '', newPath);
    }
  }
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

  if (props.minifiedMode === 'pile') {
    return (
      <PileViewMode
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
      />
    );
  }

  if (props.singleQuestionMode) {
    return (
      <div id={styles.surveySelectorRow}>
        <SurveyQuestions
          questionID={props.questionID}
          responderAddress={props.responderAddress}
          singleQuestionMode={true}
          toggleLoginModal={props.toggleLoginModal}
          account={props.account}
          provider={props.provider}
          loginComplete={props.loginComplete}
          loginInProgress={props.loginInProgress}
          network={props.network}
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
          hideEmbeddedDebugUi={props.hideEmbeddedDebugUi}
        />
      </div>
    );
  }

  const { surveyId, surveyID } = props;
  if (
    surveyId &&
    surveyID &&
    String(surveyId).trim().toLowerCase() !== String(surveyID).trim().toLowerCase()
  ) {
    if (process.env.NODE_ENV !== 'production') {
      surveyLog.warn(
        `[SurveyTool] Both surveyId and surveyID props were provided with different values. Preferring surveyId: "${surveyId}" over surveyID: "${surveyID}"`
      );
    }
  }
  const rawId = surveyId || surveyID;
  const normalizedSurveyId = rawId ? String(rawId).trim().toLowerCase() : null;

  let effectiveFilterState = normalizeSurveyToolFilterState(props.filterState);
  if (!serializeSurveyToolFilterState(effectiveFilterState)) {
    effectiveFilterState = normalizeSurveyToolFilterState(hydratedFilterState || {});
  }

  return (
    <div id={styles.surveySelectorRow}>
      <SurveySelector
        SurveyQuestionsComponent={SurveyQuestions}
        surveyId={normalizedSurveyId}
        displayAnswerMode={props.displayAnswerMode}
        viewAddress={props.viewAddress}
        toggleLoginModal={props.toggleLoginModal}
        account={props.account}
        provider={props.provider}
        loginComplete={props.loginComplete}
        loginInProgress={props.loginInProgress}
        network={props.network}
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
        questionResponsesNonce={props.questionResponsesNonce}
        questionsCacheNonce={questionsCacheNonce}
        ensureQuestionCached={ensureQuestionCached}
        onFilterChange={props.onFilterChange}
        preventUrlChange={props.preventUrlChange}
        computeSubmitLabel={computeSubmitLabel}
        activeSessionSlug={activeSessionSlug}
        sessionSlug={toolSessionSlug}
        sessionSlugPinned={props.sessionSlugPinned}
        hideEmbeddedDebugUi={props.hideEmbeddedDebugUi}
      />
      <SurveyResults
        isOpen={showResultsModal}
        onClose={closeResultsModal}
        provider={props.provider}
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
        sessionSlugPinned={props.sessionSlugPinned}
        hideEmbeddedDebugUi={props.hideEmbeddedDebugUi}
      />
    </div>
  );
};

const findSurveyInAllCaches = (surveyID: any) => {
  if (!surveyID) return null;
  const sid = String(surveyID).toLowerCase();

  const entries = listNamespaceEntriesSync('surveysCache', { cloneValues: false });
  for (const entry of entries) {
    const slug = String(entry?.slug || '');
    const cache = (entry?.value && typeof entry.value === 'object') ? entry.value : {};
    for (const netKey in cache) {
      if (cache[netKey]?.surveys?.[sid]) {
        const foundData = cache[netKey].surveys[sid];
        return { data: foundData, foundSlug: slug };
      }
    }
  }
  return null;
};

const createLegacySurveyToolInstance = (props: SurveyToolProps) => {
  const instance: any = {
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
  };

  instance.setState = (next: any, cb?: () => void) => {
    const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
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
    instance.setState({ pubKey: newPubKey });
  };

  instance.getNormalizedSurveyIdFromProps = () => getNormalizedSurveyIdFromPropsValue(instance.props);

  instance.handleTopLevelFilterStateUrlUpdate = (newFilterState: any) => {
    updateFilterStateUrlForProps(instance.props, newFilterState);
  };

  instance.findSurveyInAllCaches = (surveyID: any) => findSurveyInAllCaches(surveyID);

  instance.componentDidMount = async () => {
    if (
      !window.location.pathname.includes('/survey/') &&
      !window.location.pathname.includes('/question/') &&
      !window.location.pathname.includes('/questions') &&
      !window.location.pathname.includes('/surveys')
    ) {
      if (instance.props.minifiedMode !== 'pile' && !instance.props.preventUrlChange && !instance.props.miniMode) {
        window.history.pushState({}, '', '/questions');
      }
    }

    instance.fetchSurveys();
  };

  instance.componentDidUpdate = (prevProps: SurveyToolProps) => {
    if (
      prevProps.network?.id !== instance.props.network?.id ||
      (prevProps.isSurveyCacheReady !== instance.props.isSurveyCacheReady && instance.props.isSurveyCacheReady)
    ) {
      instance.fetchSurveys();
    }

    if (instance.props.autoOpenResults && !prevProps.autoOpenResults && !instance.state.showResultsModal) {
      instance.setState({ showResultsModal: true });
    }

    const questionCacheReadyChanged =
      prevProps.isQuestionCacheReady !== instance.props.isQuestionCacheReady;
    const responsesCacheReadyChanged =
      prevProps.isResponsesCacheReady !== instance.props.isResponsesCacheReady;
    const questionResponsesNonceChanged =
      prevProps.questionResponsesNonce !== instance.props.questionResponsesNonce;
    const networkChanged = prevProps.network?.id !== instance.props.network?.id;

    if (
      (questionCacheReadyChanged && instance.props.isQuestionCacheReady) ||
      (responsesCacheReadyChanged && instance.props.isResponsesCacheReady) ||
      questionResponsesNonceChanged ||
      networkChanged
    ) {
      instance.setState((prev: any) => ({ questionsCacheNonce: prev.questionsCacheNonce + 1 }));
    }
  };

  instance.componentWillUnmount = () => {};

  instance.closeResultsModal = () => {
    const hasExternalCloseHandler = typeof instance.props.onResultsModalClose === 'function';
    let oldPath = window.location.pathname;
    if (oldPath.endsWith('/results') && !hasExternalCloseHandler) {
      const trimmed = oldPath.slice(0, oldPath.length - '/results'.length);
      window.history.pushState({}, '', trimmed);
    }
    instance.setState({ showResultsModal: false });
    if (hasExternalCloseHandler) {
      instance.props.onResultsModalClose();
    }
  };

  instance.getSurveyData = async (surveyID: any) => {
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

    let surveyData: any = null;

    if (netIdStr) {
      const surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);

      if (surveysCache[netIdStr]?.surveys?.[loweredSurveyID]) {
        surveyData = surveysCache[netIdStr].surveys[loweredSurveyID];
      }
    }

    if (!surveyData) {
      const found = instance.findSurveyInAllCaches(loweredSurveyID);
      if (found) {
        surveyLog.log(`[SurveyTool] Found survey ${loweredSurveyID} cached in different group: '${found.foundSlug}'. Using cached data.`);
        surveyData = found.data;
      }
    }

    if (!surveyData && netIdStr) {
      surveyLog.log(`[SurveyTool] Cache miss. Fetching from chain for ${effectiveSlug}...`);
      try {
        surveyData = await contractScripts.getSurveyDataById(resolvedProps.provider, loweredSurveyID, effectiveSlug);

        if (surveyData) {
          surveyData.surveyID = loweredSurveyID;
          if (!surveyData.questionIDs) surveyData.questionIDs = [];
          if (!surveyData.creator) surveyData.creator = "";
          surveyData.id = surveyData.surveyID;

          const cacheToUpdate = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
          if (!cacheToUpdate[netIdStr]) cacheToUpdate[netIdStr] = { surveys: {}, surveysLatestBlock: 0, surveyResponses: {} };
          if (!cacheToUpdate[netIdStr].surveys) cacheToUpdate[netIdStr].surveys = {};

          cacheToUpdate[netIdStr].surveys[loweredSurveyID] = surveyData;
          await writeSurveysCache(effectiveSlug, cacheToUpdate);
        }
      } catch (e) {
        surveyLog.error("[SurveyTool] Chain fetch failed:", e);
      }
    }

    return surveyData;
  };

  instance.loadInitialData = async () => {
    surveyLog.log('SurveyTool: loadInitialData - This method is deprecated for initial broad survey fetching.');
  };

  instance.fetchSurveys = async () => {
    const requestEpoch = (Number(instance._surveyToolFetchEpoch || 0) + 1);
    instance._surveyToolFetchEpoch = requestEpoch;
    if (!instance.state.loading) {
      instance.setState({ loading: true });
    }

    const resolvedProps = instance.getResolvedSurveyToolProps();
    const slug = resolveEffectiveSlug(resolvedProps);
    const surveyReadContext = resolveSurveyReadContext(resolvedProps, slug);
    const effectiveSlug = surveyReadContext.sessionSlug || slug;
    const netIdStr = surveyReadContext.networkIdStr;
    if (!netIdStr) {
      if (requestEpoch !== instance._surveyToolFetchEpoch) return;
      surveyLog.error('SurveySelector: Network ID is undefined in fetchSurveys.');
      instance.setState({ surveys: [], loading: false });
      return;
    }

    const prevCtx = instance._lastSurveysCtx || {};
    const ctxChanged = (prevCtx.slug !== effectiveSlug) || (prevCtx.netIdStr !== netIdStr);

    const prevList = Array.isArray(instance.state.surveys) ? instance.state.surveys : [];
    const prevCount = prevList.length;

    let surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
    if (requestEpoch !== instance._surveyToolFetchEpoch) return;

    const surveyBag = surveysCache?.[netIdStr]?.surveys || {};

    if (!surveyBag || Object.keys(surveyBag).length === 0) {
      if (prevCount > 0 && !ctxChanged) {
        if (requestEpoch !== instance._surveyToolFetchEpoch) return;
        instance.setState({ loading: false }, instance.updateSelectedSurvey);
        return;
      }
      if (requestEpoch !== instance._surveyToolFetchEpoch) return;
      instance.setState({ surveys: [], loading: false }, instance.updateSelectedSurvey);
      instance._lastSurveysCtx = { slug: effectiveSlug, netIdStr };
      return;
    }

    const next: any[] = [];
    const seen = new Set();

    for (const sid of Object.keys(surveyBag)) {
      const sData = surveyBag[sid];
      if (!sData || !sData.title || !Array.isArray(sData.questionIDs)) continue;

      const qids = (sData.questionIDs || []).map((q: any) => String(q || '').toLowerCase());
      if (qids.length === 0) continue;

      if (!sData.id) sData.id = sData.surveyID || sid;
      const lowered = String(sData.id || sid).toLowerCase();
      if (!seen.has(lowered)) {
        seen.add(lowered);
        next.push(sData);
      }
    }

    if (next.length === 0 && prevCount > 0 && !ctxChanged) {
      if (requestEpoch !== instance._surveyToolFetchEpoch) return;
      instance.setState({ loading: false }, instance.updateSelectedSurvey);
      return;
    }

    const warming = (!instance.props.isSurveyCacheReady || !instance.props.isQuestionCacheReady);
    if (next.length < prevCount && !ctxChanged && warming) {
      if (requestEpoch !== instance._surveyToolFetchEpoch) return;
      instance.setState({ loading: false }, instance.updateSelectedSurvey);
      return;
    }

    if (requestEpoch !== instance._surveyToolFetchEpoch) return;
    instance.setState({ surveys: next, loading: false }, instance.updateSelectedSurvey);
    instance._lastSurveysCtx = { slug: effectiveSlug, netIdStr };
  };

  instance.ensureQuestionCached = async (questionId: any, ctx: any = {}) => {
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
          network: resolvedProps.network
        });
      }

      surveyLog.log(`SurveyTool: Question ${qIdLower} not in ${currentSlug} cache. Fetching from: '${fetchSlug}'...`);

      const litHooks =
        resolvedProps.lit ||
        resolvedProps.litHooks ||
        (typeof window !== 'undefined' ? ((window as any).__litHooks || (window as any).litHooks) : null);
      const decryptContext = {
        account: resolvedProps.account || '',
        providerLike: resolvedProps.provider || '',
        chainId: currentCacheContext.networkId || null,
        litHooks,
        litOpts: litHooks && typeof litHooks.getKey === 'function'
          ? { getKey: litHooks.getKey }
          : null,
      };

      let questionData = await contractScripts.getQuestionData(
        resolvedProps.provider,
        qIdLower,
        fetchSlug,
        { decryptContext }
      );

      const allowGeneralFallback = !currentSlug;
      if (!questionData && fetchSlug !== '' && allowGeneralFallback) {
        surveyLog.log(`SurveyTool: Question ${qIdLower} not found in '${fetchSlug}', trying general fallback...`);
        questionData = await contractScripts.getQuestionData(
          resolvedProps.provider,
          qIdLower,
          '',
          { decryptContext: { ...decryptContext, chainId: Number(resolvedProps.network?.id || 0) || decryptContext.chainId } }
        );
      }

      if (questionData) {
        questionData.id = qIdLower;
        if (!questionData.creator) questionData.creator = "";
        if (!questionData.tags) questionData.tags = [];

        const persistedCache = await updateCacheAtomic('questionsCache', currentSlug, (current: any) => {
          const nextCache = ensureQuestionsNet(
            (current && typeof current === 'object') ? current : {},
            netIdStr
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
        instance.setState((prevState: any) => ({ questionsCacheNonce: prevState.questionsCacheNonce + 1 }));
      } else {
        surveyLog.warn(`SurveyTool: Question data not found on chain for ID: ${qIdLower}`);
      }
    }
  };

  instance.updateCache = (updater: any, cb?: () => void) => {
    if (typeof updater !== 'function') {
      surveyLog.error('updateCache expects a function; got:', updater);
      return;
    }
    const resolvedProps = instance.getResolvedSurveyToolProps();
    const slug = resolveEffectiveSlug(resolvedProps);
    const updateCacheContext = resolveUpdateCacheContext(resolvedProps, slug);
    const effectiveSlug = updateCacheContext.sessionSlug || slug;
    const netIdStr = updateCacheContext.networkIdStr;

    instance.setState(
      (prev: any) => {
        const newCache = updater(prev.cache || {});
        if (netIdStr) {
          try {
            const global = ensureSurveysNet(readSurveysCache(effectiveSlug), netIdStr);
            const net = global[netIdStr];

            if (newCache.surveys) {
              net.surveys = { ...net.surveys, ...newCache.surveys };
            }
            if (newCache.surveyResponses) {
              net.surveyResponses = {
                ...net.surveyResponses,
                ...newCache.surveyResponses,
              };
            }
            if (newCache.surveyResponsesLatestBlock) {
              net.surveyResponsesLatestBlock = {
                ...net.surveyResponsesLatestBlock,
                ...newCache.surveyResponsesLatestBlock,
              };
            }
            writeSurveysCache(effectiveSlug, global);
          } catch (err) {
            surveyLog.warn('[SurveyTool] updateCache merge failed:', err);
          }
        }
        return { cache: newCache };
      },
      cb,
    );
  };

  instance.render = () => renderSurveyToolContent({
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

  const [cache, setCache] = useState(getInitialCacheState);
  const [showResultsModal, setShowResultsModal] = useState(props.autoOpenResults || false);
  const [pubKey, setPubKey] = useState('');
  const [questionsCacheNonce, setQuestionsCacheNonce] = useState(0);
  const [loading, setLoading] = useState(false);
  const [surveys, setSurveys] = useState<any[]>();
  const [hydratedFilterState] = useState(() => buildHydratedFilterState(props));
  const [cacheCallbackTick, setCacheCallbackTick] = useState(0);

  const surveyQuestionsRef = useRef<any>(null);
  const _surveyToolFetchEpoch = useRef(0);
  const _lastSurveysCtx = useRef<any>({});
  const loadingRef = useRef(loading);
  const surveysRef = useRef<any[] | undefined>(surveys);
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

  const handleTopLevelFilterStateUrlUpdate = useCallback((newFilterState: any) => {
    updateFilterStateUrlForProps(propsRef.current, newFilterState);
  }, []);

  const getSurveyData = async (surveyID: any) => {
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

    let surveyData: any = null;

    if (netIdStr) {
      const surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);

      if (surveysCache[netIdStr]?.surveys?.[loweredSurveyID]) {
        surveyData = surveysCache[netIdStr].surveys[loweredSurveyID];
      }
    }

    if (!surveyData) {
      const found = findSurveyInAllCaches(loweredSurveyID);
      if (found) {
        surveyLog.log(`[SurveyTool] Found survey ${loweredSurveyID} cached in different group: '${found.foundSlug}'. Using cached data.`);
        surveyData = found.data;
      }
    }

    if (!surveyData && netIdStr) {
      surveyLog.log(`[SurveyTool] Cache miss. Fetching from chain for ${effectiveSlug}...`);
      try {
        surveyData = await contractScripts.getSurveyDataById(resolvedProps.provider, loweredSurveyID, effectiveSlug);

        if (surveyData) {
          surveyData.surveyID = loweredSurveyID;
          if (!surveyData.questionIDs) surveyData.questionIDs = [];
          if (!surveyData.creator) surveyData.creator = "";
          surveyData.id = surveyData.surveyID;

          const cacheToUpdate = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
          if (!cacheToUpdate[netIdStr]) cacheToUpdate[netIdStr] = { surveys: {}, surveysLatestBlock: 0, surveyResponses: {} };
          if (!cacheToUpdate[netIdStr].surveys) cacheToUpdate[netIdStr].surveys = {};

          cacheToUpdate[netIdStr].surveys[loweredSurveyID] = surveyData;
          await writeSurveysCache(effectiveSlug, cacheToUpdate);
        }
      } catch (e) {
        surveyLog.error("[SurveyTool] Chain fetch failed:", e);
      }
    }

    return surveyData;
  };

  const fetchSurveys = useCallback(async () => {
    const requestEpoch = (Number(_surveyToolFetchEpoch.current || 0) + 1);
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
    const ctxChanged = (prevCtx.slug !== effectiveSlug) || (prevCtx.netIdStr !== netIdStr);

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

    const next: any[] = [];
    const seen = new Set();

    for (const sid of Object.keys(surveyBag)) {
      const sData = surveyBag[sid];
      if (!sData || !sData.title || !Array.isArray(sData.questionIDs)) continue;

      const qids = (sData.questionIDs || []).map((q: any) => String(q || '').toLowerCase());
      if (qids.length === 0) continue;

      if (!sData.id) sData.id = sData.surveyID || sid;
      const lowered = String(sData.id || sid).toLowerCase();
      if (!seen.has(lowered)) {
        seen.add(lowered);
        next.push(sData);
      }
    }

    if (next.length === 0 && prevCount > 0 && !ctxChanged) {
      if (requestEpoch !== _surveyToolFetchEpoch.current) return;
      setLoading(false);
      return;
    }

    const currentProps = propsRef.current;
    const warming = (!currentProps.isSurveyCacheReady || !currentProps.isQuestionCacheReady);
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

  const ensureQuestionCached = useCallback(async (questionId: any, ctx: any = {}) => {
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
          network: resolvedProps.network
        });
      }

      surveyLog.log(`SurveyTool: Question ${qIdLower} not in ${currentSlug} cache. Fetching from: '${fetchSlug}'...`);

      const litHooks =
        resolvedProps.lit ||
        resolvedProps.litHooks ||
        (typeof window !== 'undefined' ? ((window as any).__litHooks || (window as any).litHooks) : null);
      const decryptContext = {
        account: resolvedProps.account || '',
        providerLike: resolvedProps.provider || '',
        chainId: currentCacheContext.networkId || null,
        litHooks,
        litOpts: litHooks && typeof litHooks.getKey === 'function'
          ? { getKey: litHooks.getKey }
          : null,
      };

      let questionData = await contractScripts.getQuestionData(
        resolvedProps.provider,
        qIdLower,
        fetchSlug,
        { decryptContext }
      );

      const allowGeneralFallback = !currentSlug;
      if (!questionData && fetchSlug !== '' && allowGeneralFallback) {
        surveyLog.log(`SurveyTool: Question ${qIdLower} not found in '${fetchSlug}', trying general fallback...`);
        questionData = await contractScripts.getQuestionData(
          resolvedProps.provider,
          qIdLower,
          '',
          { decryptContext: { ...decryptContext, chainId: Number(resolvedProps.network?.id || 0) || decryptContext.chainId } }
        );
      }

      if (questionData) {
        questionData.id = qIdLower;
        if (!questionData.creator) questionData.creator = "";
        if (!questionData.tags) questionData.tags = [];

        const persistedCache = await updateCacheAtomic('questionsCache', currentSlug, (current: any) => {
          const nextCache = ensureQuestionsNet(
            (current && typeof current === 'object') ? current : {},
            netIdStr
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

  const updateCache = useCallback((updater: any, cb?: () => void) => {
    if (typeof updater !== 'function') {
      surveyLog.error('updateCache expects a function; got:', updater);
      return;
    }
    const resolvedProps = getResolvedSurveyToolProps();
    const slug = resolveEffectiveSlug(resolvedProps);
    const updateCacheContext = resolveUpdateCacheContext(resolvedProps, slug);
    const effectiveSlug = updateCacheContext.sessionSlug || slug;
    const netIdStr = updateCacheContext.networkIdStr;

    setCache((prevCache: any) => {
      const newCache = updater(prevCache || {});
      if (typeof cb === 'function') {
        pendingUpdateCacheCallbacksRef.current.push(cb);
      }
      if (netIdStr) {
        try {
          const global = ensureSurveysNet(readSurveysCache(effectiveSlug), netIdStr);
          const net = global[netIdStr];

          if (newCache.surveys) {
            net.surveys = { ...net.surveys, ...newCache.surveys };
          }
          if (newCache.surveyResponses) {
            net.surveyResponses = {
              ...net.surveyResponses,
              ...newCache.surveyResponses,
            };
          }
          if (newCache.surveyResponsesLatestBlock) {
            net.surveyResponsesLatestBlock = {
              ...net.surveyResponsesLatestBlock,
              ...newCache.surveyResponsesLatestBlock,
            };
          }
          writeSurveysCache(effectiveSlug, global);
        } catch (err) {
          surveyLog.warn('[SurveyTool] updateCache merge failed:', err);
        }
      }
      return newCache;
    });
    if (typeof cb === 'function') {
      setCacheCallbackTick(t => t + 1);
    }
  }, []);

  const closeResultsModal = useCallback(() => {
    const currentProps = propsRef.current;
    const onClose = currentProps.onResultsModalClose;
    const hasExternalCloseHandler = typeof onClose === 'function';
    let oldPath = window.location.pathname;
    if (oldPath.endsWith('/results') && !hasExternalCloseHandler) {
      const trimmed = oldPath.slice(0, oldPath.length - '/results'.length);
      window.history.pushState({}, '', trimmed);
    }
    setShowResultsModal(false);
    if (hasExternalCloseHandler) {
      onClose();
    }
  }, []);

  useEffect(() => {
    const pending = pendingUpdateCacheCallbacksRef.current.splice(0, pendingUpdateCacheCallbacksRef.current.length);
    pending.forEach((cb) => cb());
  }, [cache, cacheCallbackTick]);

  useEffect(() => {
    if (
      !window.location.pathname.includes('/survey/') &&
      !window.location.pathname.includes('/question/') &&
      !window.location.pathname.includes('/questions') &&
      !window.location.pathname.includes('/surveys')
    ) {
      if (props.minifiedMode !== 'pile' && !props.preventUrlChange && !props.miniMode) {
        window.history.pushState({}, '', '/questions');
      }
    }

    fetchSurveys();
  }, []);

  useEffect(() => {
    if (!didRunFetchUpdateEffectRef.current) {
      didRunFetchUpdateEffectRef.current = true;
      prevFetchNetworkIdRef.current = props.network?.id;
      prevSurveyCacheReadyRef.current = props.isSurveyCacheReady;
      return;
    }

    if (
      prevFetchNetworkIdRef.current !== props.network?.id ||
      (prevSurveyCacheReadyRef.current !== props.isSurveyCacheReady && props.isSurveyCacheReady)
    ) {
      fetchSurveys();
    }

    prevFetchNetworkIdRef.current = props.network?.id;
    prevSurveyCacheReadyRef.current = props.isSurveyCacheReady;
  }, [props.network?.id, props.isSurveyCacheReady, fetchSurveys]);

  useEffect(() => {
    if (!didRunAutoOpenUpdateEffectRef.current) {
      didRunAutoOpenUpdateEffectRef.current = true;
      prevAutoOpenResultsRef.current = props.autoOpenResults;
      return;
    }

    if (props.autoOpenResults && !prevAutoOpenResultsRef.current && !showResultsModalRef.current) {
      setShowResultsModal(true);
    }

    prevAutoOpenResultsRef.current = props.autoOpenResults;
  }, [props.autoOpenResults]);

  useEffect(() => {
    if (!didRunNonceUpdateEffectRef.current) {
      didRunNonceUpdateEffectRef.current = true;
      prevQuestionCacheReadyRef.current = props.isQuestionCacheReady;
      prevResponsesCacheReadyRef.current = props.isResponsesCacheReady;
      prevQuestionResponsesNonceRef.current = props.questionResponsesNonce;
      prevNonceNetworkIdRef.current = props.network?.id;
      return;
    }

    const questionCacheReadyChanged =
      prevQuestionCacheReadyRef.current !== props.isQuestionCacheReady;
    const responsesCacheReadyChanged =
      prevResponsesCacheReadyRef.current !== props.isResponsesCacheReady;
    const questionResponsesNonceChanged =
      prevQuestionResponsesNonceRef.current !== props.questionResponsesNonce;
    const networkChanged = prevNonceNetworkIdRef.current !== props.network?.id;

    if (
      (questionCacheReadyChanged && props.isQuestionCacheReady) ||
      (responsesCacheReadyChanged && props.isResponsesCacheReady) ||
      questionResponsesNonceChanged ||
      networkChanged
    ) {
      setQuestionsCacheNonce((prev) => prev + 1);
    }

    prevQuestionCacheReadyRef.current = props.isQuestionCacheReady;
    prevResponsesCacheReadyRef.current = props.isResponsesCacheReady;
    prevQuestionResponsesNonceRef.current = props.questionResponsesNonce;
    prevNonceNetworkIdRef.current = props.network?.id;
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

function SurveyTool(this: any, props: SurveyToolProps) {
  if (new.target) {
    return createLegacySurveyToolInstance(props);
  }

  return <SurveyToolRuntime {...props} />;
}

export default SurveyTool;
