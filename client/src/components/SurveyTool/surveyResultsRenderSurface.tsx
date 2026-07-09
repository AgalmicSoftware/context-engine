import React from 'react';

import { getShortenedSurveyID } from 'utilities/ui/displayHelpers.js';
import {
  SurveyResultsLockedResponsesBanner,
  SurveyResultsLockedResponsesToggle,
} from './SurveyResultsLockedResponsesPanel';
import { buildSurveyResultsCacheControllerSnapshot } from './surveyResultsCacheControllerSnapshot';
import { buildSurveyResultsCacheReadinessDisplayPlan } from './surveyResultsCacheReadinessDisplayPlan';
import {
  buildSurveyResultsDemoSurfaceProps,
  createSurveyResultsDemoSurfaceParentProps,
  type SurveyResultsDemoSurfaceQuestionResponsePort,
} from './surveyResultsDemoSurfaceProps';
import { buildSurveyResultsExportControlsDisplayDescriptor } from './surveyResultsExportPlans.js';
import type { SurveyResultsDisplayPanelsArgs } from './SurveyResultsDisplayPanels';
import { renderSurveyResultsFilterExportControls } from './SurveyResultsFilterExportControls';
import type { SurveyResultsHtmlReportExportModalProps } from './SurveyResultsHtmlReportExportModal';
import { renderSurveyResultsSyncStatusPanel } from './SurveyResultsPanels';
import SurveyResultsReportSurface from './SurveyResultsReportSurface';
import type { QuestionFilterHandle } from './QuestionFilter';
import type { SurveyResultsProps, SurveyResultsState } from './SurveyResults';

type SurveyResultsRecord = Record<string, unknown>;
type SurveyResultsAggregatorEntry = [string, unknown];
type SurveyResultsScopedQuestionNetworkData = {
  questions?: Record<string, SurveyResultsRecord>;
};
type SurveyResultsLockedResponsesPanelProps = Parameters<typeof SurveyResultsLockedResponsesBanner>[0];
type SurveyResultsLockedResponsesModel = SurveyResultsLockedResponsesPanelProps['lockedModel'];
type SurveyResultsDemoViewOption = {
  key: string;
  label: string;
};

export type SurveyResultsRenderSurfaceDisplayStyles = {
  documentLinkIconStyle: React.CSSProperties;
  miniBarSpinnerStyle: React.CSSProperties;
  miniProgressStyle: React.CSSProperties;
  remainingSpinnerStyle: React.CSSProperties;
  surveyBookmarkStyle: React.CSSProperties;
  trailingLabelStyle: React.CSSProperties;
  resolveSyncDetailsStyle: (open: unknown) => React.CSSProperties;
  resolveToggleKnobStyle: (isAggregate: unknown) => React.CSSProperties;
};

export type SurveyResultsRenderSurfaceArgs = {
  applyDecryptedOverrideToResponse: SurveyResultsDisplayPanelsArgs['applyDecryptedOverrideToResponse'];
  closeModal: () => void;
  displayStyles: SurveyResultsRenderSurfaceDisplayStyles;
  downloadCSV: () => void;
  getEffectiveSlug: () => string;
  getFallbackQuestion: SurveyResultsDisplayPanelsArgs['getFallbackQuestion'];
  getHtmlReportModalProps: () => SurveyResultsHtmlReportExportModalProps;
  getIsDemoQuestionResultsContext: () => boolean;
  getLockedResponseKey: SurveyResultsDisplayPanelsArgs['getLockedResponseKey'];
  getMemoizedAggregatorEntries: (aggregator: unknown) => SurveyResultsAggregatorEntry[];
  getMemoizedIndividualsAggregator: (individualResponses: unknown) => unknown;
  getMemoizedLockedResponsesModel: (
    questions: Record<string, SurveyResultsRecord>,
  ) => SurveyResultsLockedResponsesModel;
  getMemoizedPolisQuestionResponses: SurveyResultsDemoSurfaceQuestionResponsePort;
  getMemoizedQuestionFilterQuestions: (networkQuestionsById: Record<string, SurveyResultsRecord>) => unknown;
  getQuestionFilterStorageKeyPrefix: (viewMode?: unknown) => string;
  getResponseCardProps: SurveyResultsDisplayPanelsArgs['getResponseCardProps'];
  getScopedQuestionNetworkDataSync: (viewMode?: unknown) => SurveyResultsScopedQuestionNetworkData;
  handleClearFiltersFromParent: React.MouseEventHandler<HTMLElement>;
  handleDecryptLockedResponses: () => void;
  handleDemoAtlasModalClose: () => void;
  handleDemoAtlasOpen: (nodeId: unknown) => void;
  handleDemoResultsViewSelect: (nextView: unknown) => void;
  handleExportTypeChange: (type: unknown) => void;
  handleFilterActivityChange: (isActive: unknown) => void;
  handleFilteredResponses: (filteredResponses: unknown, newSbtFilterLocalState?: unknown) => void;
  handleManualRefresh: () => unknown;
  handleQuestionFilter: (filteredQuestionsOrCombined: unknown, newFilterState: unknown) => void;
  handleQuestionFilterCountUpdate: (count: unknown) => void;
  handleSurveyViewModeKeyDown: React.KeyboardEventHandler<HTMLElement>;
  handleSurveyViewModeToggle: () => void;
  isOpen?: boolean;
  onToggleSyncDetails: () => void;
  openHtmlReportExportModal: () => void;
  props: SurveyResultsProps;
  questionFilterRef: React.Ref<QuestionFilterHandle>;
  questionIdTableRef: React.Ref<HTMLDivElement>;
  renderQuestionSummary: (
    qId: string,
    responses: unknown,
    preNetworkQuestions: Record<string, SurveyResultsRecord>,
  ) => React.ReactNode;
  renderQuestionTable: (
    questionMap: unknown,
    preNetworkQuestions: Record<string, SurveyResultsRecord>,
  ) => React.ReactNode;
  stableSetFilterLoading: (loading: unknown) => void;
  state: SurveyResultsState;
  styleMap: Record<string, string>;
  syncLoadingStartedAt: number | null;
  toggleExportArea: () => void;
  toggleLockedResponseDetails: () => void;
  toggleQuestionFilter: () => void;
  toggleQuestionSummary: (questionId: unknown) => void;
  toggleResponse: (responseId: unknown) => void;
  toggleSurveyBookmark: (surveyId: unknown) => void;
};

export const renderSurveyResultsRenderSurface = ({
  applyDecryptedOverrideToResponse,
  closeModal,
  displayStyles,
  downloadCSV,
  getEffectiveSlug,
  getFallbackQuestion,
  getHtmlReportModalProps,
  getIsDemoQuestionResultsContext,
  getLockedResponseKey,
  getMemoizedAggregatorEntries,
  getMemoizedIndividualsAggregator,
  getMemoizedLockedResponsesModel,
  getMemoizedPolisQuestionResponses,
  getMemoizedQuestionFilterQuestions,
  getQuestionFilterStorageKeyPrefix,
  getResponseCardProps,
  getScopedQuestionNetworkDataSync,
  handleClearFiltersFromParent,
  handleDecryptLockedResponses,
  handleDemoAtlasModalClose,
  handleDemoAtlasOpen,
  handleDemoResultsViewSelect,
  handleExportTypeChange,
  handleFilterActivityChange,
  handleFilteredResponses,
  handleManualRefresh,
  handleQuestionFilter,
  handleQuestionFilterCountUpdate,
  handleSurveyViewModeKeyDown,
  handleSurveyViewModeToggle,
  isOpen = false,
  onToggleSyncDetails,
  openHtmlReportExportModal,
  props,
  questionFilterRef,
  questionIdTableRef,
  renderQuestionSummary,
  renderQuestionTable,
  stableSetFilterLoading,
  state,
  styleMap,
  syncLoadingStartedAt,
  toggleExportArea,
  toggleLockedResponseDetails,
  toggleQuestionFilter,
  toggleQuestionSummary,
  toggleResponse,
  toggleSurveyBookmark,
}: SurveyResultsRenderSurfaceArgs): React.ReactElement => {
  const {
    responses,
    sbtFilteredResponses,
    exportType,
    alertMessage,
    filterLoading,
    totalQuestionsCount,
    totalResponsesCount,
    filteredResponsesCount,
    surveyViewMode,
    exportAreaOpen,
    aggregatorQuestionResponses,
    sbtFilteredAggregatorQuestionResponses,
    surveyTitle,
    surveyDocumentURLs,
    viewMode,
    filteredQuestionsCount,
    isFilterActive,
  } = state;

  const currentSurveyId = state.surveyId;
  const slug = getEffectiveSlug();
  const preQuestionNetworkData = getScopedQuestionNetworkDataSync(viewMode);
  const preNetworkQuestions = preQuestionNetworkData.questions || {};
  const questionFilterQuestions = getMemoizedQuestionFilterQuestions(preNetworkQuestions);
  const exportControlsDisplay = buildSurveyResultsExportControlsDisplayDescriptor({
    exportAreaOpen,
    exportType,
  });
  const aggregatorEntries = getMemoizedAggregatorEntries(sbtFilteredAggregatorQuestionResponses);
  const aggregatorEntriesCount = aggregatorEntries.length;
  const lockedResponsesModel = getMemoizedLockedResponsesModel(preNetworkQuestions);
  const surveyAggregateEntries = viewMode === 'survey' && surveyViewMode === 'aggregate' ? aggregatorEntries : [];
  const questionModeEntries = viewMode === 'questions' ? aggregatorEntries : [];
  const surveyIdAbbreviation = currentSurveyId ? getShortenedSurveyID(currentSurveyId, false, null, false) : null;
  const isDemoQuestionResults = getIsDemoQuestionResultsContext();
  const demoResultsViewMode = isDemoQuestionResults ? state.demoResultsViewMode || 'raw' : 'raw';
  const isDemoAlternateResultsView = isDemoQuestionResults && demoResultsViewMode !== 'raw';
  const demoResultsViewOptions: SurveyResultsDemoViewOption[] = isDemoQuestionResults
    ? [
        { key: 'report', label: 'Report' },
        { key: 'atlas', label: 'Atlas' },
        { key: 'breakdown', label: 'Breakdown' },
        { key: 'riskMatrix', label: 'Risk Matrix' },
      ]
    : [];
  const cacheControllerSnapshot = buildSurveyResultsCacheControllerSnapshot({
    activeSessionSlug: slug,
    aggregatorEntriesCount,
    currentSurveyId,
    currentSurveyIdForUrl: viewMode === 'survey' ? currentSurveyId : null,
    currentViewModeForUrl: viewMode,
    filteredQuestionsCount,
    filteredResponsesCount,
    filterLoading,
    filterState: state.filterState,
    hasRefreshQuestionMetadata: typeof props.refreshQuestionMetadata === 'function',
    hasRefreshQuestionResponses: typeof props.refreshQuestionResponses === 'function',
    hasRefreshSurveyResponsesByID: typeof props.refreshSurveyResponsesByID === 'function',
    isQuestionCacheReady: props.isQuestionCacheReady,
    isSBTCacheReady: props.isSBTCacheReady,
    networkLatestBlock: state.networkLatestBlock,
    nowMs: Date.now(),
    questionLocalBlock: state.questionLocalBlock,
    questionResponsesNonce: props.questionResponsesNonce,
    questionsCacheNonce: props.questionsCacheNonce,
    questionResultsHydrated: state.questionResultsHydrated,
    refreshTargetQuestionBlock: state.refreshTargetQuestionBlock,
    refreshTargetResponseBlock: state.refreshTargetResponseBlock,
    refreshTargetSurveyBlock: state.refreshTargetSurveyBlock,
    responseLocalBlock: state.responseLocalBlock,
    sbtCacheRevision: props.sbtCacheRevision,
    showQuestionFilter: state.showQuestionFilter,
    storageKeyPrefix: getQuestionFilterStorageKeyPrefix(viewMode),
    surveyLocalBlock: state.surveyLocalBlock,
    surveyResultsHydrated: state.surveyResultsHydrated,
    surveyViewMode,
    syncLoadingStartedAt,
    totalQuestionsCount,
    totalResponsesCount,
    viewMode,
  });
  const cacheReadinessDisplay = buildSurveyResultsCacheReadinessDisplayPlan(
    cacheControllerSnapshot.cacheReadinessInput,
  );
  const filterInput = cacheControllerSnapshot.filterInput;
  const syncStatusNode = renderSurveyResultsSyncStatusPanel({
    syncStatusDisplay: cacheReadinessDisplay.syncStatusDisplay,
    syncDetailsOpen: !!state.syncDetailsOpen,
    syncDetailsStyle: displayStyles.resolveSyncDetailsStyle(state.syncDetailsOpen),
    onToggleSyncDetails,
    onManualRefresh: () => handleManualRefresh(),
    miniBarSpinnerStyle: displayStyles.miniBarSpinnerStyle,
    miniProgressStyle: displayStyles.miniProgressStyle,
    remainingSpinnerStyle: displayStyles.remainingSpinnerStyle,
  });
  const filterControlsNode = renderSurveyResultsFilterExportControls({
    activeSessionSlug: filterInput.activeSessionSlug,
    aggregateQuestionResponses: state.aggregateQuestionResponses,
    currentSurveyIdForUrl: filterInput.currentSurveyIdForUrl,
    currentViewModeForUrl: filterInput.currentViewModeForUrl,
    defaultTags: props.defaultTags,
    ensureLightSbtUniverse: props.ensureLightSbtUniverse,
    exportControlsDisplay,
    filterState: filterInput.filterState,
    isFilterActive,
    isQuestionCacheReady: filterInput.isQuestionCacheReady,
    isSBTCacheReady: filterInput.isSBTCacheReady,
    network: props.network,
    onClearFilters: handleClearFiltersFromParent,
    onDownload: downloadCSV,
    onExportHtmlReport: openHtmlReportExportModal,
    onExportTypeChange: handleExportTypeChange,
    onFilterActivityChange: handleFilterActivityChange,
    onQuestionFilter: handleQuestionFilter,
    onQuestionFilterCountUpdate: handleQuestionFilterCountUpdate,
    onSbtFilter: handleFilteredResponses,
    onSetFilterLoading: stableSetFilterLoading,
    onToggleExportArea: toggleExportArea,
    onToggleQuestionFilter: toggleQuestionFilter,
    provider: props.provider,
    questionFilterQuestions,
    questionFilterRef,
    questionResponses: state.questionResponses,
    questionResponsesNonce: filterInput.questionResponsesNonce,
    questionsCacheNonce: filterInput.questionsCacheNonce,
    responses: state.responses,
    sbtCacheRevision: filterInput.sbtCacheRevision,
    sessionConfig: props.sessionConfig,
    sessionSlug: props.sessionSlug,
    showQuestionFilter: filterInput.showQuestionFilter,
    storageKeyPrefix: filterInput.storageKeyPrefix,
    styleMap,
    surveyViewMode,
    viewMode,
  });
  const displayPanelsProps: SurveyResultsDisplayPanelsArgs = {
    account: props.account,
    activeQuestionToggles: state.activeQuestionToggles,
    activeToggles: state.activeToggles,
    alertMessage,
    applyDecryptedOverrideToResponse,
    cacheReadinessDisplay,
    currentSurveyId,
    effectiveSlug: slug,
    filterControlsNode,
    filterLoading,
    getFallbackQuestion,
    getLockedResponseKey,
    getResponseCardProps,
    lockedResponsesBannerNode: SurveyResultsLockedResponsesBanner({
      decrypting: !!state.lockedResponsesDecrypting,
      isOpen: !!state.lockedResponseDetailsOpen,
      lockedModel: lockedResponsesModel,
      onDecrypt: handleDecryptLockedResponses,
    }),
    network: props.network,
    onSurveyViewModeKeyDown: handleSurveyViewModeKeyDown,
    onSurveyViewModeToggle: handleSurveyViewModeToggle,
    onToggleQuestionList: () => toggleQuestionSummary('__questionList__'),
    onToggleResponse: toggleResponse,
    preNetworkQuestions,
    questionModeEntries,
    questionResponsesNonce: props.questionResponsesNonce,
    questionsCacheNonce: props.questionsCacheNonce,
    renderQuestionSummary: (qId, arr) => renderQuestionSummary(qId, arr, preNetworkQuestions),
    renderQuestionTable: () => renderQuestionTable(sbtFilteredAggregatorQuestionResponses, preNetworkQuestions),
    responses: sbtFilteredResponses,
    sbtCacheRevision: props.sbtCacheRevision,
    styleMap,
    surveyAggregateEntries,
    surveyViewMode,
    tableWrapperRef: questionIdTableRef,
    toggleKnobStyle: displayStyles.resolveToggleKnobStyle(surveyViewMode === 'aggregate'),
    trailingLabelStyle: displayStyles.trailingLabelStyle,
    viewMode,
  };
  const demoSurfaceProps = buildSurveyResultsDemoSurfaceProps({
    activeSlug: slug,
    getIndividualsAggregator: getMemoizedIndividualsAggregator,
    getPolisQuestionResponses: getMemoizedPolisQuestionResponses,
    isDemoAlternateResultsView,
    onAtlasModalClose: handleDemoAtlasModalClose,
    onAtlasNodeOpen: handleDemoAtlasOpen,
    parentProps: createSurveyResultsDemoSurfaceParentProps(props),
    state,
    viewKey: demoResultsViewMode,
  });

  return (
    <SurveyResultsReportSurface
      demoSurfaceProps={demoSurfaceProps}
      displayPanelsProps={displayPanelsProps}
      htmlReportModalProps={getHtmlReportModalProps()}
      isOpen={isOpen}
      modalHeaderProps={{
        bookmarkedSurveyIDs: state.bookmarkedSurveyIDs,
        currentSurveyId,
        demoResultsViewMode,
        demoResultsViewOptions,
        documentLinkIconStyle: displayStyles.documentLinkIconStyle,
        effectiveSlug: slug,
        isDemoQuestionResults,
        lockedResponsesToggleNode: SurveyResultsLockedResponsesToggle({
          isOpen: !!state.lockedResponseDetailsOpen,
          lockedModel: lockedResponsesModel,
          onToggleDetails: toggleLockedResponseDetails,
        }),
        onDemoResultsViewSelect: handleDemoResultsViewSelect,
        onToggleSurveyBookmark: toggleSurveyBookmark,
        styleMap,
        surveyBookmarkStyle: displayStyles.surveyBookmarkStyle,
        surveyDocumentURLs: Array.isArray(surveyDocumentURLs) ? surveyDocumentURLs : [],
        surveyIdAbbreviation,
        surveyTitle,
        syncStatusNode,
        viewMode,
      }}
      onCloseResultsModal={closeModal}
      reportSurfaceDisplayPlan={{
        demoResultsViewMode,
        isDemoAlternateResultsView,
      }}
      styleMap={styleMap}
    />
  );
};
