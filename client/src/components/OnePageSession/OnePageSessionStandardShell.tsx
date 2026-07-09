import React, { Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCaretDown,
  faCaretUp,
  faDownload,
  faExpand,
  faExternalLinkAlt,
  faPlus,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';

import LazyFallback from '../Shared/LazyFallback';
import { lazyWithRetry } from '../../utilities/ui/lazyImportRetry.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { isCryptoMode, t } from '../../utilities/ui/terminology.js';
import { PUBLIC_AI_DISCOURSE_CORPUS_URL } from '../../variables/publicRepoMetadata.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import type { RiskMatrixRestoreState } from '../MainContent/RiskMatrix';
import styles from './OnePageSession.module.scss';
import OnePageSessionAutoMintAlerts, { type OnePageSessionAutoMintAlertsProps } from './OnePageSessionAutoMintAlerts';

const SurveyPage = React.lazy(() => import('../SurveyTool/SurveyPage'));
const MemoSurveyPage = React.memo((props: Record<string, unknown>) => <SurveyPage {...props} />);
const SBTsPage = React.lazy(() => import('../SBTs/SBTsPage'));
const PolisReport = React.lazy(() => import('../PolisReport/PolisReport'));
const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
const CorpusViewer = lazyWithRetry(() => import('../DemoViews/CorpusViewer'));
const RiskMatrix = React.lazy(() => import('../MainContent/RiskMatrix'));
const DemoAnalysisWorkspace = React.lazy(() => import('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace'));

const DebateMapAny = DebateMap as React.ComponentType<Record<string, unknown>>;
const SBT_TOOLTIP_LABEL = isCryptoMode() ? 'Soulbound tokens (SBTs)' : `${t('sbtFull')}s`;
const DEMO_CORPUS_GITHUB_URL = PUBLIC_AI_DISCOURSE_CORPUS_URL;

export const DEFAULT_CORPUS_VIEWER_LOAD_STATE = Object.freeze({
  activeCorpusKey: 'cross_corpus',
  activeCorpusLabel: 'Cross-Corpus',
  loadStatus: 'idle',
  loadButtonLabel: 'Load full corpus',
  disableLoadButton: false,
  error: '',
});

type CorpusViewerLoadState = typeof DEFAULT_CORPUS_VIEWER_LOAD_STATE;
type UnknownRecord = Record<string, unknown>;

type ResultsViewOption = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

type OnePageSessionStandardShellProps = {
  account: unknown;
  aggregatorData: UnknownRecord | null;
  autoMintCountdown: number | null;
  autoMintingMode: boolean;
  autoMintStatuses: OnePageSessionAutoMintAlertsProps['autoMintStatuses'];
  autoMintTargets: OnePageSessionAutoMintAlertsProps['autoMintTargets'];
  autoOpenResults: boolean;
  blockLimits: UnknownRecord | null;
  cacheHasLoaded: unknown;
  contracts: UnknownRecord | null;
  corpusViewerLoadRequestNonce: number;
  corpusViewerLoadState: CorpusViewerLoadState;
  defaultFeaturedSBTs: unknown;
  defaultFilterState: unknown;
  defaultSbtTags: unknown;
  defaultTags: unknown;
  disclaimersActive: boolean;
  displaySessionSlug: string;
  dismissedLoginBanner: boolean;
  dismissedStatusItems: OnePageSessionAutoMintAlertsProps['dismissedStatusItems'];
  effectiveSlug: string;
  embeddedAtlasNodeId: unknown;
  embeddedAtlasReturnState: unknown;
  embeddedGroupsSessionConfig: unknown;
  embeddedGroupsSessionSlug: string;
  embeddedQuestionSessionSlug: string;
  expandedImages: OnePageSessionAutoMintAlertsProps['expandedImages'];
  filterState: UnknownRecord | null;
  isDemoSlug: boolean;
  isQuestionCacheReady: boolean;
  isResponsesCacheReady: boolean;
  isSBTCacheReady: unknown;
  isSurveyCacheReady: unknown;
  litHooks: unknown;
  loginComplete: unknown;
  needsLoginForAutoMint: boolean;
  network: UnknownRecord | null;
  networkChainId: string | number | null;
  pileSubmitRailVisible: boolean;
  provider: unknown;
  questionPool?: unknown[];
  questionResponsesNonce: number;
  questionScanProgress: UnknownRecord | null;
  questionsSectionRef: React.RefObject<HTMLDivElement>;
  refreshQuestionMetadata: unknown;
  refreshQuestionResponses: unknown;
  refreshSbtData: unknown;
  refreshSurveyResponsesByID: unknown;
  resolvedPolisDemoDataBySlug: unknown;
  resolvedSessionConfig: unknown;
  resultsViewMode: string;
  riskMatrixRestoreState: RiskMatrixRestoreState | null;
  sbtCacheRevision: unknown;
  sbtImages: OnePageSessionAutoMintAlertsProps['sbtImages'];
  sbtNames: OnePageSessionAutoMintAlertsProps['sbtNames'];
  sbtRealtimeCoverageBySlug: unknown;
  sbtScanProgressBySlug: unknown;
  sessionHeader: unknown;
  sessionInfo: React.ReactNode;
  sessionName: unknown;
  sharedQuestionPool?: unknown[];
  showDocuments: boolean;
  showEmbeddedCreateGroup: boolean;
  showGroups: boolean;
  showQuestions: boolean;
  showResults: boolean;
  slug?: string;
  titleText: string;
  toggleLoginModal: unknown;
  ensureLightSbtDiscovery?: unknown;
  ensureLightSbtUniverse?: unknown;
  onCancelAutoMintCountdown: () => void;
  onCorpusAtlasIssueOpen: (nodeId: unknown, restoreState?: RiskMatrixRestoreState | null) => void;
  onCorpusViewerLoadStateChange: (nextLoadState: unknown) => void;
  onDismissLoginBanner: () => void;
  onDismissStatusItem: OnePageSessionAutoMintAlertsProps['onDismissStatusItem'];
  onEmbeddedAtlasModalClose: () => void;
  onFilterChange: (newFilterState: unknown) => void;
  onGroupsViewAll: (event: React.MouseEvent<HTMLElement>) => void;
  onKickoffAutoMintIfNeeded: () => void;
  onLoadFullCorpusClick: (event: React.MouseEvent<HTMLElement>) => void;
  onOpenResults: () => void;
  onPileSubmitRailVisibilityChange: (visible: unknown) => void;
  onResultsModalClose: () => void;
  onResultsModeChange: (resultsViewMode: string) => void;
  onRiskMatrixRestoreApplied: () => void;
  onToggleDocuments: () => void;
  onToggleEmbeddedCreateGroup: (event?: React.MouseEvent<HTMLElement>) => void;
  onToggleGroups: () => void;
  onToggleQuestions: () => void;
  onToggleResults: () => void;
  onToggleStatusImagePreview: OnePageSessionAutoMintAlertsProps['onToggleStatusImagePreview'];
  onViewAllQuestionsClick: () => void;
};

const renderSectionHeading = (title: React.ReactNode, subtitle: React.ReactNode) => (
  <span className={styles.sectionHeaderText}>
    <span className={styles.sectionHeaderTitle}>{title}</span>
    <span className={styles.sectionHeaderSubtitle}>{subtitle}</span>
  </span>
);

const buildResultsViewOptions = (isDemoSlug: boolean): ResultsViewOption[] => [
  { key: 'polis', label: 'Report', icon: '🧾' },
  ...(isDemoSlug
    ? [
        { key: 'debateAtlas', label: 'Debate Map', icon: '🗺️' },
        { key: 'analysis', label: 'Breakdown', icon: '📊' },
        { key: 'riskMatrix', label: 'Risk Matrix', icon: '⚠️' },
      ]
    : []),
];

export default function OnePageSessionStandardShell({
  account,
  aggregatorData,
  autoMintCountdown,
  autoMintingMode,
  autoMintStatuses,
  autoMintTargets,
  autoOpenResults,
  blockLimits,
  cacheHasLoaded,
  contracts,
  corpusViewerLoadRequestNonce,
  corpusViewerLoadState,
  defaultFeaturedSBTs,
  defaultFilterState,
  defaultSbtTags,
  defaultTags,
  disclaimersActive,
  displaySessionSlug,
  dismissedLoginBanner,
  dismissedStatusItems,
  effectiveSlug,
  embeddedAtlasNodeId,
  embeddedAtlasReturnState,
  embeddedGroupsSessionConfig,
  embeddedGroupsSessionSlug,
  embeddedQuestionSessionSlug,
  expandedImages,
  filterState,
  isDemoSlug,
  isQuestionCacheReady,
  isResponsesCacheReady,
  isSBTCacheReady,
  isSurveyCacheReady,
  litHooks,
  loginComplete,
  needsLoginForAutoMint,
  network,
  networkChainId,
  pileSubmitRailVisible,
  provider,
  questionPool,
  questionResponsesNonce,
  questionScanProgress,
  questionsSectionRef,
  refreshQuestionMetadata,
  refreshQuestionResponses,
  refreshSbtData,
  refreshSurveyResponsesByID,
  resolvedPolisDemoDataBySlug,
  resolvedSessionConfig,
  resultsViewMode,
  riskMatrixRestoreState,
  sbtCacheRevision,
  sbtImages,
  sbtNames,
  sbtRealtimeCoverageBySlug,
  sbtScanProgressBySlug,
  sessionHeader,
  sessionInfo,
  sessionName,
  sharedQuestionPool,
  showDocuments,
  showEmbeddedCreateGroup,
  showGroups,
  showQuestions,
  showResults,
  slug,
  titleText,
  toggleLoginModal,
  ensureLightSbtDiscovery,
  ensureLightSbtUniverse,
  onCancelAutoMintCountdown,
  onCorpusAtlasIssueOpen,
  onCorpusViewerLoadStateChange,
  onDismissLoginBanner,
  onDismissStatusItem,
  onEmbeddedAtlasModalClose,
  onFilterChange,
  onGroupsViewAll,
  onKickoffAutoMintIfNeeded,
  onLoadFullCorpusClick,
  onOpenResults,
  onPileSubmitRailVisibilityChange,
  onResultsModalClose,
  onResultsModeChange,
  onRiskMatrixRestoreApplied,
  onToggleDocuments,
  onToggleEmbeddedCreateGroup,
  onToggleGroups,
  onToggleQuestions,
  onToggleResults,
  onToggleStatusImagePreview,
  onViewAllQuestionsClick,
}: OnePageSessionStandardShellProps) {
  const basePath = readPublicUrlBasePath();
  const effectiveResultsViewMode = isDemoSlug ? resultsViewMode : 'polis';
  const resultsViewOptions = buildResultsViewOptions(isDemoSlug);
  const sectionsGridClassName = [styles.sectionsGrid, !isDemoSlug ? styles.sectionsGridTwoUp : '']
    .filter(Boolean)
    .join(' ');
  const pileSubmitRailActive = !showQuestions && pileSubmitRailVisible;
  const brandingSectionClassName = [
    styles.brandingSection,
    pileSubmitRailActive ? styles.brandingSectionWithPileSubmitRail : '',
  ]
    .filter(Boolean)
    .join(' ');
  const titleContainerClassName = [
    styles.titleContainer,
    pileSubmitRailActive ? styles.titleContainerWithPileSubmitRail : '',
  ]
    .filter(Boolean)
    .join(' ');
  const questionsSectionTitle = renderSectionHeading('Questions', 'Answer or Add');
  const questionsSectionTooltip =
    'Survey and question platform allowing detailed responses, advanced question formats, preference weighing, and group filtering.';
  const documentsSectionTooltip =
    'Allows the conversation to be enriched by data, and the formats can change per-session';
  const loadFullCorpusButtonLabel =
    corpusViewerLoadState.loadButtonLabel || DEFAULT_CORPUS_VIEWER_LOAD_STATE.loadButtonLabel;
  const disableLoadFullCorpusButton = !!corpusViewerLoadState.disableLoadButton;

  return (
    <div className={styles.onePageDemoContainer}>
      <OnePageSessionAutoMintAlerts
        autoMintCountdown={autoMintCountdown}
        autoMintStatuses={autoMintStatuses}
        autoMintTargets={autoMintTargets}
        basePath={basePath}
        dismissedLoginBanner={dismissedLoginBanner}
        dismissedStatusItems={dismissedStatusItems}
        effectiveSlug={effectiveSlug}
        expandedImages={expandedImages}
        needsLoginForAutoMint={needsLoginForAutoMint}
        sbtImages={sbtImages}
        sbtNames={sbtNames}
        onCancelAutoMintCountdown={onCancelAutoMintCountdown}
        onDismissLoginBanner={onDismissLoginBanner}
        onDismissStatusItem={onDismissStatusItem}
        onKickoffAutoMintIfNeeded={onKickoffAutoMintIfNeeded}
        onToggleStatusImagePreview={onToggleStatusImagePreview}
      />

      <div className={brandingSectionClassName}>
        <div className={titleContainerClassName}>
          <h2 className={styles.brandingSectionTitle}>{titleText}</h2>
          <div className={styles.tooltip} tabIndex={0} aria-label="Session info">
            <FontAwesomeIcon icon={faQuestionCircle} />
            <span className={styles.tooltiptext}>
              {sessionInfo ? (
                <p>
                  <em>{sessionInfo}</em>
                </p>
              ) : (
                <p>Share input; your responses help generate a collective intelligence map.</p>
              )}
            </span>
          </div>
        </div>

        {showQuestions ? (
          <div className={styles.pileHeaderRow} data-testid={E2E_TESTIDS.SESSION_QUESTIONS_FULL_HEADER}>
            <div className={styles.pileBackContainer}>
              <button
                type="button"
                onClick={onToggleQuestions}
                className={styles.pileBackButton}
                data-testid={E2E_TESTIDS.SESSION_PILE_BACK}
                aria-label="Back to pile view"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Back</span>
              </button>
            </div>
            <div className={styles.pileHeaderTitleWrap}>
              <h2 className={styles.pileHeaderTitle}>{questionsSectionTitle}</h2>
              <div className={`${styles.tooltip} ${styles.pileHeaderTooltip}`} tabIndex={0} aria-label="Questions info">
                <FontAwesomeIcon icon={faQuestionCircle} />
                <span className={styles.tooltiptext}>{questionsSectionTooltip}</span>
              </div>
            </div>
          </div>
        ) : (
          <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
            <MemoSurveyPage
              minifiedMode="pile"
              account={account}
              provider={provider}
              network={network}
              toggleLoginModal={toggleLoginModal}
              loginComplete={loginComplete}
              isSBTCacheReady={isSBTCacheReady}
              isSurveyCacheReady={isSurveyCacheReady}
              isQuestionCacheReady={isQuestionCacheReady}
              isResponsesCacheReady={isResponsesCacheReady}
              cacheHasLoaded={cacheHasLoaded}
              sbtCacheRevision={sbtCacheRevision}
              questionResponsesNonce={questionResponsesNonce}
              questionScanProgress={questionScanProgress}
              refreshSurveyResponsesByID={refreshSurveyResponsesByID}
              refreshQuestionMetadata={refreshQuestionMetadata}
              refreshQuestionResponses={refreshQuestionResponses}
              sessionInfo={sessionInfo}
              sessionName={sessionName}
              sessionHeader={sessionHeader}
              defaultTags={defaultTags}
              defaultFilterState={defaultFilterState}
              defaultFeaturedSBTs={defaultFeaturedSBTs}
              onFilterChange={onFilterChange}
              onPileSubmitRailVisibilityChange={onPileSubmitRailVisibilityChange}
              filterState={filterState}
              onViewAllClick={onViewAllQuestionsClick}
              hideSessionSelector={true}
              sessionSlugPinned={true}
              preventUrlChange={true}
              sessionSlug={embeddedQuestionSessionSlug}
              questionPool={sharedQuestionPool}
              sessionConfig={resolvedSessionConfig}
              contracts={contracts}
              blockLimits={blockLimits}
              networkChainId={networkChainId}
              litHooks={litHooks}
            />
          </Suspense>
        )}
      </div>

      {showQuestions && (
        <div className={styles.sectionContainer} ref={questionsSectionRef}>
          <div className={`${styles.miniSectionContent} ${styles.miniSectionContentNoHeader}`}>
            <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
              <MemoSurveyPage
                miniMode={true}
                hideEmbeddedDebugUi={true}
                account={account}
                provider={provider}
                network={network}
                toggleLoginModal={toggleLoginModal}
                loginComplete={loginComplete}
                sessionInfo={sessionInfo}
                sessionName={sessionName}
                sessionHeader={sessionHeader}
                defaultTags={defaultTags}
                defaultFilterState={defaultFilterState}
                defaultFeaturedSBTs={defaultFeaturedSBTs}
                autoOpenResults={autoOpenResults}
                questionResponsesNonce={questionResponsesNonce}
                questionScanProgress={questionScanProgress}
                refreshSurveyResponsesByID={refreshSurveyResponsesByID}
                refreshQuestionMetadata={refreshQuestionMetadata}
                refreshQuestionResponses={refreshQuestionResponses}
                isQuestionCacheReady={isQuestionCacheReady}
                isSBTCacheReady={isSBTCacheReady}
                isSurveyCacheReady={isSurveyCacheReady}
                isResponsesCacheReady={isResponsesCacheReady}
                cacheHasLoaded={cacheHasLoaded}
                onFilterChange={onFilterChange}
                filterState={filterState}
                hideSessionSelector={true}
                sessionSlugPinned={true}
                preventUrlChange={true}
                onResultsModalClose={onResultsModalClose}
                sessionSlug={embeddedQuestionSessionSlug}
                questionPool={questionPool}
                sessionConfig={resolvedSessionConfig}
                contracts={contracts}
                blockLimits={blockLimits}
                networkChainId={networkChainId}
                litHooks={litHooks}
              />
            </Suspense>
          </div>
        </div>
      )}

      <div className={sectionsGridClassName}>
        <div className={`${styles.sectionContainer} ${showGroups ? styles.sectionExpanded : ''}`}>
          <div className={styles.sectionHeaderRow}>
            <h2 onClick={onToggleGroups} className={styles.sectionHeader}>
              {showGroups ? (
                <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
              ) : (
                <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
              )}
              {renderSectionHeading(t('sbts'), 'Join or Create')}
              {showGroups && (
                <div
                  className={`${styles.tooltip} ${styles.sectionHeaderTooltip}`}
                  onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
                >
                  <FontAwesomeIcon icon={faQuestionCircle} />
                  <span className={styles.tooltiptext}>
                    {`${SBT_TOOLTIP_LABEL} enable groups to organize membership, roles, and permissions on-chain.`}
                    They unlock private coordination, community-governed tools, and shared AI training.
                  </span>
                </div>
              )}
            </h2>

            {showGroups && (
              <div className={styles.sectionHeaderActionsScroller}>
                <div className={styles.sectionHeaderActions}>
                  <button type="button" onClick={onGroupsViewAll} className={styles.sectionHeaderActionButton}>
                    <FontAwesomeIcon icon={faExpand} />
                    View All
                  </button>
                  <button
                    type="button"
                    onClick={onToggleEmbeddedCreateGroup}
                    className={styles.sectionHeaderActionButton}
                    data-testid={E2E_TESTIDS.SBTS_CREATE_TOGGLE}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    {showEmbeddedCreateGroup ? 'Exit' : 'Create'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {showGroups && (
            <div className={styles.miniSectionContent}>
              <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
                <SBTsPage
                  key={`sbtspage:${embeddedGroupsSessionSlug || 'general'}`}
                  provider={provider}
                  network={network}
                  account={account}
                  loginComplete={loginComplete}
                  toggleLoginModal={toggleLoginModal}
                  miniaturized={true}
                  hideMiniActionRow={true}
                  sessionName={sessionName}
                  sessionInfo={sessionInfo}
                  defaultFeaturedSBTs={defaultFeaturedSBTs}
                  defaultSbtTags={defaultSbtTags}
                  isSBTCacheReady={isSBTCacheReady}
                  autoMintingMode={autoMintingMode}
                  showCreateGroupAboveFeatured={true}
                  showCreateGroupExternal={showEmbeddedCreateGroup}
                  onCreateGroupToggleExternal={onToggleEmbeddedCreateGroup}
                  preferCacheBackedFeaturedCards={true}
                  requireExplicitAutoFeatureSessionSlug={true}
                  refreshSbtData={refreshSbtData}
                  sessionSlug={embeddedGroupsSessionSlug}
                  contracts={contracts}
                  blockLimits={blockLimits}
                  networkChainId={networkChainId}
                  sessionConfig={embeddedGroupsSessionConfig}
                  sbtScanProgressBySlug={sbtScanProgressBySlug}
                  sbtRealtimeCoverageBySlug={sbtRealtimeCoverageBySlug}
                  ensureLightSbtDiscovery={ensureLightSbtDiscovery}
                  ensureLightSbtUniverse={ensureLightSbtUniverse}
                />
              </Suspense>
            </div>
          )}
        </div>

        {isDemoSlug && (
          <div
            className={`${styles.sectionContainer} ${showDocuments ? styles.sectionExpanded : ''}`}
            data-testid="ce-demo-documents-section"
          >
            <div className={styles.sectionHeaderRow}>
              <h2
                onClick={onToggleDocuments}
                className={`${styles.sectionHeader} ${styles.documentsSectionHeader}`.trim()}
                data-testid="ce-demo-documents-toggle"
              >
                {showDocuments ? (
                  <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
                ) : (
                  <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
                )}
                {renderSectionHeading('Context', 'View')}
                {showDocuments && (
                  <div
                    className={`${styles.tooltip} ${styles.sectionHeaderTooltip}`}
                    onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
                  >
                    <FontAwesomeIcon icon={faQuestionCircle} />
                    <span className={styles.tooltiptext}>{documentsSectionTooltip}</span>
                  </div>
                )}
              </h2>
              {showDocuments && (
                <div className={styles.sectionHeaderActionsScroller}>
                  <div className={styles.sectionHeaderActions}>
                    <a
                      href={DEMO_CORPUS_GITHUB_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.sectionHeaderActionButton}
                      onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                      <span>GitHub</span>
                    </a>
                    <button
                      type="button"
                      className={styles.sectionHeaderActionButton}
                      onClick={onLoadFullCorpusClick}
                      disabled={disableLoadFullCorpusButton}
                      data-testid="ce-demo-documents-load-full-corpus"
                    >
                      <FontAwesomeIcon icon={faDownload} />
                      <span>{loadFullCorpusButtonLabel}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            {showDocuments && (
              <div className={styles.miniSectionContent}>
                <Suspense fallback={<LazyFallback label="Loading Corpus..." minHeight="20vh" />}>
                  <CorpusViewer
                    onAtlasIssueOpen={onCorpusAtlasIssueOpen}
                    showGithubLink={false}
                    externalLoadRequestNonce={corpusViewerLoadRequestNonce}
                    onExternalLoadStateChange={onCorpusViewerLoadStateChange}
                  />
                </Suspense>
              </div>
            )}
          </div>
        )}

        <div className={`${styles.sectionContainer} ${showResults ? styles.sectionExpanded : ''}`}>
          <div className={styles.sectionHeaderRow}>
            <h2
              onClick={onToggleResults}
              className={styles.sectionHeader}
              data-testid={E2E_TESTIDS.SESSION_RESULTS_TOGGLE}
            >
              {showResults ? (
                <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
              ) : (
                <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
              )}
              {renderSectionHeading('Results', 'View')}
              {showResults && (
                <div
                  className={`${styles.tooltip} ${styles.sectionHeaderTooltip}`}
                  onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
                >
                  <FontAwesomeIcon icon={faQuestionCircle} />
                  <span className={styles.tooltiptext}>
                    Click “Raw Results” to explore detailed breakdowns, filter by group membership, and export a pol.is
                    report.
                  </span>
                </div>
              )}
            </h2>

            {showResults && (
              <div className={`${styles.sectionHeaderActionsScroller} ${styles.resultsModeActionsScroller}`}>
                <div
                  className={`${styles.sectionHeaderActions} ${styles.resultsModeActions}`}
                  data-testid="ce-session-results-view-nav"
                >
                  {resultsViewOptions.map(({ key, label, icon }) => {
                    const isSelected = effectiveResultsViewMode === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onResultsModeChange(key)}
                        className={`${styles.sectionHeaderViewModeButton} ${isSelected ? styles.sectionHeaderViewModeButtonActive : ''}`}
                        title={label}
                        aria-pressed={isSelected}
                      >
                        <span className={styles.sectionHeaderViewModeIcon} aria-hidden="true">
                          {icon}
                        </span>
                        <span className={styles.sectionHeaderViewModeLabel}>{label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={(event: React.MouseEvent<HTMLElement>) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOpenResults();
                    }}
                    className={styles.sectionHeaderViewModeButton}
                  >
                    <FontAwesomeIcon icon={faExpand} />
                    Raw Results
                  </button>
                </div>
              </div>
            )}
          </div>
          {showResults && (
            <div className={styles.miniSectionContent}>
              <div>
                {effectiveResultsViewMode === 'polis' && (
                  <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
                    <PolisReport
                      onePageDemo={true}
                      miniMode={true}
                      account={account}
                      provider={provider}
                      network={network}
                      loginComplete={loginComplete}
                      questionResponses={aggregatorData}
                      disclaimersActive={disclaimersActive}
                      filterState={filterState}
                      sessionName={sessionName}
                      sessionHeader={sessionHeader}
                      sessionInfo={sessionInfo}
                      defaultTags={defaultTags}
                      isQuestionCacheReady={isQuestionCacheReady}
                      isResponsesCacheReady={isResponsesCacheReady}
                      questionScanProgress={questionScanProgress}
                      questionResponsesNonce={questionResponsesNonce}
                      sessionSlug={displaySessionSlug}
                      demoDataFirstLoad={isDemoSlug}
                      demoDataBySlug={resolvedPolisDemoDataBySlug}
                      contracts={contracts}
                      blockLimits={blockLimits}
                      networkChainId={networkChainId}
                    />
                  </Suspense>
                )}
                {isDemoSlug && effectiveResultsViewMode === 'analysis' && (
                  <Suspense fallback={<LazyFallback label="Loading Analysis..." minHeight="30vh" />}>
                    <DemoAnalysisWorkspace sessionSlug={slug} />
                  </Suspense>
                )}
                {isDemoSlug && effectiveResultsViewMode === 'debateAtlas' && (
                  <Suspense fallback={<LazyFallback label="Loading Debate Atlas..." minHeight="30vh" />}>
                    <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                      <DebateMapAny
                        account={account}
                        provider={provider}
                        network={network}
                        activeSessionSlug={slug}
                        toggleLoginModal={toggleLoginModal}
                        demoMode={true}
                        embedded={true}
                        requestedModalNodeId={embeddedAtlasNodeId}
                        onModalClose={embeddedAtlasReturnState ? onEmbeddedAtlasModalClose : null}
                      />
                    </div>
                  </Suspense>
                )}
                {isDemoSlug && effectiveResultsViewMode === 'riskMatrix' && (
                  <Suspense fallback={<LazyFallback label="Loading Risk Matrix..." minHeight="30vh" />}>
                    <RiskMatrix
                      embedded={true}
                      onOpenAtlasNode={onCorpusAtlasIssueOpen}
                      restoreState={riskMatrixRestoreState}
                      onRestoreApplied={onRiskMatrixRestoreApplied}
                    />
                  </Suspense>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
