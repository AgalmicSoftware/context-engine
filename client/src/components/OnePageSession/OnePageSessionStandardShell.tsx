import React, { Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCaretDown,
  faCaretUp,
  faDownload,
  faExpand,
  faExternalLinkAlt,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';

import LazyFallback from '../Shared/LazyFallback';
import { lazyWithRetry } from '../../utilities/ui/lazyImportRetry.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { PUBLIC_AI_DISCOURSE_CORPUS_URL } from '../../variables/publicRepoMetadata.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { hasDemoAnalysisFixture } from '../../utilities/demo/demoPolisDatasets';
import type { RiskMatrixRestoreState } from '../MainContent/RiskMatrix';
import type { SessionGeneratedResultsViewKey } from '../../domains/sessionResults/sessionResultsGeneratedViewTypes';
import type { SessionResultsGeneratedAnalysisArtifact } from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';
import type {
  GeneratedResultsSnapshotQuestion,
  GeneratedResultsSnapshotResponse,
} from '../../domains/sessionResults/sessionResultsAnalysisController';
import styles from './OnePageSession.module.scss';
import OnePageSessionAutoMintAlerts, { type OnePageSessionAutoMintAlertsProps } from './OnePageSessionAutoMintAlerts';

const SurveyPage = React.lazy(() => import('../SurveyTool/SurveyPage'));
const MemoSurveyPage = React.memo((props: Record<string, unknown>) => <SurveyPage {...props} />);
const OnePageSessionGroupsSection = React.lazy(() => import('./GroupsSection'));
const PolisReport = React.lazy(() => import('../PolisReport/PolisReport'));
const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
const CorpusViewer = lazyWithRetry(() => import('../DemoViews/CorpusViewer'));
const RiskMatrix = React.lazy(() => import('../MainContent/RiskMatrix'));
const DemoAnalysisWorkspace = React.lazy(() => import('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace'));
const SessionGeneratedResultsViews = React.lazy(() => import('../SessionResults/SessionGeneratedResultsViews'));

const DebateMapAny = DebateMap as React.ComponentType<Record<string, unknown>>;
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

type SessionContextLink = {
  label: string;
  url: string;
};

type SessionContextView = {
  title: string;
  paragraphs: string[];
  links: SessionContextLink[];
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
  generatedResultsAnalysis?: UnknownRecord | null;
  generatedResultsAuthAvailable?: boolean;
  isDemoSlug: boolean;
  isQuestionCacheReady: boolean;
  isResponsesCacheReady: boolean;
  isSBTCacheReady: unknown;
  isSurveyCacheReady: unknown;
  litHooks: unknown;
  loginComplete: unknown;
  loginModalToggled?: boolean;
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
  onGeneratedResultsAuthorize?: () => void;
  onGeneratedResultsCheck?: () => void;
  onGeneratedResultsGenerate?: (refresh?: boolean) => void;
  onKickoffAutoMintIfNeeded: () => void;
  onLoadFullCorpusClick: (event: React.MouseEvent<HTMLElement>) => void;
  onOpenResults: () => void;
  onViewSessionResults?: () => void;
  resultsSectionRef?: React.Ref<HTMLDivElement>;
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

const renderSectionHeading = (title: React.ReactNode, subtitle?: React.ReactNode) => (
  <span className={styles.sectionHeaderText}>
    <span className={styles.sectionHeaderTitle}>{title}</span>
    {subtitle ? <span className={styles.sectionHeaderSubtitle}>{subtitle}</span> : null}
  </span>
);

const buildResultsViewOptions = (
  isDemoSlug: boolean,
  showDemoAnalysisView: boolean,
  generatedOptions: ResultsViewOption[] = [],
): ResultsViewOption[] => [
  { key: 'polis', label: 'Report', icon: '🧾' },
  ...(generatedOptions.length > 0
    ? generatedOptions
    : isDemoSlug
      ? [
          { key: 'debateAtlas', label: 'Debate Map', icon: '🗺️' },
          ...(showDemoAnalysisView ? [{ key: 'analysis', label: 'Breakdown', icon: '📊' }] : []),
          { key: 'riskMatrix', label: 'Risk Matrix', icon: '⚠️' },
        ]
      : []),
];

const toTrimmedText = (value: unknown, maxLength = 2000) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const normalizeSessionContextLinks = (raw: unknown): SessionContextLink[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const record = entry && typeof entry === 'object' ? (entry as UnknownRecord) : {};
      const label = toTrimmedText(record.label, 120);
      const url = toTrimmedText(record.url, 500);
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return null;
      }
      if (!label || parsedUrl.protocol !== 'https:') return null;
      return { label, url };
    })
    .filter((entry): entry is SessionContextLink => !!entry)
    .slice(0, 4);
};

const normalizeSessionContextView = (config: unknown): SessionContextView | null => {
  const record = config && typeof config === 'object' ? (config as UnknownRecord) : {};
  const rawContext =
    record.sessionContext && typeof record.sessionContext === 'object'
      ? (record.sessionContext as UnknownRecord)
      : null;
  if (!rawContext) return null;
  const paragraphs = (Array.isArray(rawContext.paragraphs) ? rawContext.paragraphs : [rawContext.body])
    .map((entry) => toTrimmedText(entry, 1400))
    .filter(Boolean)
    .slice(0, 4);
  const links = normalizeSessionContextLinks(rawContext.links);
  if (!paragraphs.length && !links.length) return null;
  return {
    title: toTrimmedText(rawContext.title, 80) || 'Context',
    paragraphs,
    links,
  };
};

const renderSessionContext = (context: SessionContextView | null) => {
  if (!context) return null;
  return (
    <section className={styles.sessionContextSection} aria-label={context.title} data-testid="ce-session-context">
      {context.paragraphs.map((paragraph, index) => (
        <p key={`${index}:${paragraph.slice(0, 24)}`}>{paragraph}</p>
      ))}
      {context.links.length ? (
        <div className={styles.sessionContextLinks}>
          {context.links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
              <FontAwesomeIcon icon={faExternalLinkAlt} />
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
};

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
  generatedResultsAnalysis,
  generatedResultsAuthAvailable = false,
  isDemoSlug,
  isQuestionCacheReady,
  isResponsesCacheReady,
  isSBTCacheReady,
  isSurveyCacheReady,
  litHooks,
  loginComplete,
  loginModalToggled,
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
  onGeneratedResultsAuthorize,
  onGeneratedResultsCheck,
  onGeneratedResultsGenerate,
  onKickoffAutoMintIfNeeded,
  onLoadFullCorpusClick,
  onOpenResults,
  onViewSessionResults,
  resultsSectionRef,
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
  const showDemoAnalysisView = isDemoSlug && hasDemoAnalysisFixture(displaySessionSlug);
  const generatedState = (
    generatedResultsAnalysis && typeof generatedResultsAnalysis === 'object' ? generatedResultsAnalysis : {}
  ) as UnknownRecord;
  const generatedHasArtifact = !!generatedState.artifact;
  const generatedViewOptions =
    generatedState.viewerAuthorized === true && generatedHasArtifact
      ? (Array.isArray(generatedState.viewOptions) ? generatedState.viewOptions : [])
          .map((option: unknown) => {
            const record = option && typeof option === 'object' ? (option as UnknownRecord) : {};
            const key = String(record.key || '');
            return {
              key,
              label: String(record.label || key),
              icon: key === 'circles' ? '◎' : key === 'breakdown' ? '📊' : '⚠️',
            };
          })
          .filter((option) => option.key)
      : [];
  const generatedViewKeys = new Set(generatedViewOptions.map((option) => option.key));
  const requestedResultsViewMode = resultsViewMode;
  const effectiveResultsViewMode = generatedViewKeys.has(requestedResultsViewMode)
    ? requestedResultsViewMode
    : isDemoSlug
      ? requestedResultsViewMode === 'analysis' && !showDemoAnalysisView
        ? 'polis'
        : requestedResultsViewMode
      : requestedResultsViewMode === 'polis'
        ? requestedResultsViewMode
        : 'polis';
  const resultsViewOptions = buildResultsViewOptions(isDemoSlug, showDemoAnalysisView, generatedViewOptions);
  const generatedStatus = String(generatedState.status || 'idle');
  const generatedIsRunning = generatedState.isRunning === true || generatedStatus === 'running';
  const generatedCanCheckStatus = generatedState.canCheckStatus === true;
  const generatedCanGenerate = generatedState.canGenerate === true && !generatedIsRunning;
  const showGeneratedCheckAction =
    generatedCanCheckStatus || (generatedResultsAuthAvailable && generatedState.adminAuthorized !== true);
  const showGeneratedGenerateAction =
    generatedState.adminAuthorized === true &&
    Array.isArray(generatedState.viewOptions) &&
    generatedState.viewOptions.length > 0 &&
    !generatedCanCheckStatus;
  const generatedCheckActionLabel = generatedCanCheckStatus ? 'Recheck AI Views' : 'Check AI Views';
  const generatedActionLabel = generatedIsRunning
    ? 'Generating AI Views…'
    : generatedState.lastFailure
      ? 'Retry AI Views'
      : generatedHasArtifact
        ? 'Refresh AI Views'
        : 'Generate AI Views';
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
  const questionsSectionTitle = renderSectionHeading('Questions');
  const questionsSectionTooltip =
    'Survey and question platform allowing detailed responses, advanced question formats, preference weighing, and group filtering.';
  const documentsSectionTooltip =
    'Allows the conversation to be enriched by data, and the formats can change per-session';
  const loadFullCorpusButtonLabel =
    corpusViewerLoadState.loadButtonLabel || DEFAULT_CORPUS_VIEWER_LOAD_STATE.loadButtonLabel;
  const disableLoadFullCorpusButton = !!corpusViewerLoadState.disableLoadButton;
  const sessionContext = normalizeSessionContextView(resolvedSessionConfig);
  const showContextSection = isDemoSlug || !!sessionContext;

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
              onViewSessionResults={onViewSessionResults}
              minifiedMode="pile"
              account={account}
              provider={provider}
              network={network}
              toggleLoginModal={toggleLoginModal}
              loginComplete={loginComplete}
              loginModalToggled={loginModalToggled}
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
        <div className={`${styles.sectionContainer} ${styles.questionsSectionContainer}`} ref={questionsSectionRef}>
          <div
            className={`${styles.miniSectionContent} ${styles.miniSectionContentNoHeader} ${styles.questionsSectionContent}`}
          >
            <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
              <MemoSurveyPage
                miniMode={true}
                hideEmbeddedDebugUi={true}
                account={account}
                provider={provider}
                network={network}
                toggleLoginModal={toggleLoginModal}
                loginComplete={loginComplete}
                loginModalToggled={loginModalToggled}
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
        <Suspense fallback={<LazyFallback label="Loading Groups..." minHeight="8vh" />}>
          <OnePageSessionGroupsSection
            account={account}
            autoMintingMode={autoMintingMode}
            blockLimits={blockLimits}
            contracts={contracts}
            defaultFeaturedSBTs={defaultFeaturedSBTs}
            defaultSbtTags={defaultSbtTags}
            embeddedGroupsSessionConfig={embeddedGroupsSessionConfig}
            embeddedGroupsSessionSlug={embeddedGroupsSessionSlug}
            ensureLightSbtDiscovery={ensureLightSbtDiscovery}
            ensureLightSbtUniverse={ensureLightSbtUniverse}
            isSBTCacheReady={isSBTCacheReady}
            loginComplete={loginComplete}
            network={network}
            networkChainId={networkChainId}
            provider={provider}
            refreshSbtData={refreshSbtData}
            resolvedSessionConfig={resolvedSessionConfig}
            sbtRealtimeCoverageBySlug={sbtRealtimeCoverageBySlug}
            sbtScanProgressBySlug={sbtScanProgressBySlug}
            sessionInfo={sessionInfo}
            sessionName={sessionName}
            showEmbeddedCreateGroup={showEmbeddedCreateGroup}
            showGroups={showGroups}
            toggleLoginModal={toggleLoginModal}
            onGroupsViewAll={onGroupsViewAll}
            onToggleEmbeddedCreateGroup={onToggleEmbeddedCreateGroup}
            onToggleGroups={onToggleGroups}
          />
        </Suspense>

        {showContextSection && (
          <div
            className={`${styles.sectionContainer} ${showDocuments ? styles.sectionExpanded : ''}`}
            data-testid="ce-demo-documents-section"
          >
            <div className={`${styles.sectionHeaderRow} ${showDocuments ? styles.documentsHeaderRow : ''}`}>
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
              {showDocuments && isDemoSlug && (
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
              <div className={`${styles.miniSectionContent} ${styles.documentsSectionContent}`.trim()}>
                {renderSessionContext(sessionContext)}
                {isDemoSlug && (
                  <Suspense fallback={<LazyFallback label="Loading Corpus..." minHeight="20vh" />}>
                    <CorpusViewer
                      onAtlasIssueOpen={onCorpusAtlasIssueOpen}
                      showGithubLink={false}
                      externalLoadRequestNonce={corpusViewerLoadRequestNonce}
                      onExternalLoadStateChange={onCorpusViewerLoadStateChange}
                    />
                  </Suspense>
                )}
              </div>
            )}
          </div>
        )}

        <div
          ref={resultsSectionRef}
          className={`${styles.sectionContainer} ${showResults ? styles.sectionExpanded : ''}`}
        >
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
                  {showGeneratedCheckAction && (
                    <button
                      type="button"
                      onClick={(event: React.MouseEvent<HTMLElement>) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (generatedCanCheckStatus) {
                          onGeneratedResultsCheck?.();
                        } else {
                          onGeneratedResultsAuthorize?.();
                        }
                      }}
                      className={styles.sectionHeaderViewModeButton}
                      disabled={generatedStatus === 'loading'}
                      data-testid="ce-session-generated-results-check"
                    >
                      {generatedCheckActionLabel}
                    </button>
                  )}
                  {showGeneratedGenerateAction && (
                    <button
                      type="button"
                      onClick={(event: React.MouseEvent<HTMLElement>) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onGeneratedResultsGenerate?.(true);
                      }}
                      className={styles.sectionHeaderViewModeButton}
                      disabled={!generatedCanGenerate}
                      data-testid="ce-session-generated-results-generate"
                    >
                      {generatedActionLabel}
                    </button>
                  )}
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
                      sessionConfig={resolvedSessionConfig}
                      demoDataFirstLoad={isDemoSlug}
                      demoDataBySlug={resolvedPolisDemoDataBySlug}
                      contracts={contracts}
                      blockLimits={blockLimits}
                      networkChainId={networkChainId}
                    />
                  </Suspense>
                )}
                {showDemoAnalysisView && effectiveResultsViewMode === 'analysis' && (
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
                {isDemoSlug &&
                  effectiveResultsViewMode === 'riskMatrix' &&
                  !generatedViewKeys.has(effectiveResultsViewMode) && (
                    <Suspense fallback={<LazyFallback label="Loading Risk Matrix..." minHeight="30vh" />}>
                      <RiskMatrix
                        embedded={true}
                        onOpenAtlasNode={onCorpusAtlasIssueOpen}
                        restoreState={riskMatrixRestoreState}
                        onRestoreApplied={onRiskMatrixRestoreApplied}
                      />
                    </Suspense>
                  )}
                {generatedViewKeys.has(effectiveResultsViewMode) && (
                  <div className={styles.generatedResultsPanel} data-testid="ce-session-generated-results-panel">
                    <div className={styles.generatedResultsStatus}>
                      <span>{String(generatedState.statusLabel || '')}</span>
                      {generatedState.lastFailure ? <span>{String(generatedState.lastFailure)}</span> : null}
                    </div>
                    {generatedState.artifact ? (
                      <Suspense fallback={<LazyFallback label="Loading generated AI view..." minHeight="30vh" />}>
                        <SessionGeneratedResultsViews
                          artifact={generatedState.artifact as SessionResultsGeneratedAnalysisArtifact}
                          questions={
                            (Array.isArray(generatedState.questions)
                              ? generatedState.questions
                              : []) as GeneratedResultsSnapshotQuestion[]
                          }
                          responses={
                            (Array.isArray(generatedState.responses)
                              ? generatedState.responses
                              : []) as GeneratedResultsSnapshotResponse[]
                          }
                          selectedView={effectiveResultsViewMode as SessionGeneratedResultsViewKey}
                          sessionSlug={displaySessionSlug}
                        />
                      </Suspense>
                    ) : (
                      <div className={styles.generatedResultsEmpty} data-testid="ce-session-generated-results-empty">
                        <p>
                          {String(
                            generatedState.unsupportedReason ||
                              generatedState.statusLabel ||
                              'No generated view is available yet.',
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
