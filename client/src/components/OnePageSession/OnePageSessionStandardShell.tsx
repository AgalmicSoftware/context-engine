import React, { Suspense } from 'react';
import CETooltip from '../Shared/CETooltip';
import SessionTestEthBadge from '../Shared/SessionTestEthBadge';
import { useSessionResultsBuild } from '../ResultsBuilds/useSessionResultsBuild';
import ResultsBuildStatus from '../ResultsBuilds/ResultsBuildStatus';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCaretDown,
  faCaretUp,
  faDownload,
  faExpand,
  faExternalLinkAlt,
  faQuestionCircle,
  faRobot,
} from '@fortawesome/free-solid-svg-icons';

import LazyFallback from '../Shared/LazyFallback';
import { formatPolisReportSessionInfo } from '../PolisReport/polisReportSessionInfo';
import { hasSessionContext, normalizeSessionContext, type SessionContext } from '@ce-shared/sessionContext.mjs';
import { lazyWithRetry } from '../../utilities/ui/lazyImportRetry.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { PUBLIC_AI_DISCOURSE_CORPUS_URL } from '../../variables/publicRepoMetadata.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { hasDemoAnalysisFixture } from '../../utilities/demo/demoFixtureSessionSlugs';
import type { RiskMatrixRestoreState } from '../MainContent/RiskMatrix';
import type { DebateAtlasBuild } from '../../domains/debateAtlas/debateAtlasTypes';
import type { RiskMatrixBuild } from '../../domains/riskMatrix/riskMatrixTypes';
import type { SessionGeneratedResultsViewKey } from '../../domains/sessionResults/sessionResultsGeneratedViewTypes';
import type { SessionResultsGeneratedAnalysisArtifact } from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';
import type {
  GeneratedResultsSnapshotQuestion,
  GeneratedResultsSnapshotResponse,
} from '../../domains/sessionResults/sessionResultsAnalysisController';
import styles from './OnePageSession.module.scss';
import OnePageSessionAutoMintAlerts, { type OnePageSessionAutoMintAlertsProps } from './OnePageSessionAutoMintAlerts';
import SessionContextSources from './SessionContextSources';
import SessionAgentNotice from './SessionAgentNotice';
import { useSessionContextSources } from '../../utilities/docLibrary/useSessionContextSources';
import { sessionAgentSettingOf } from '@ce-shared/sessionAgent.mjs';

const SurveyPage = React.lazy(() => import('../SurveyTool/SurveyPage'));
const MemoSurveyPage = React.memo((props: Record<string, unknown>) => <SurveyPage {...props} />);
const OnePageSessionGroupsSection = React.lazy(() => import('./GroupsSection'));
const PolisReport = React.lazy(() => import('../PolisReport/PolisReport'));
const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
const CorpusViewer = lazyWithRetry(() => import('../DemoViews/CorpusViewer'));
const RiskMatrix = React.lazy(() => import('../MainContent/RiskMatrix'));
const DemoAnalysisWorkspace = React.lazy(() => import('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace'));
const SessionGeneratedResultsViews = React.lazy(() => import('../SessionResults/SessionGeneratedResultsViews'));
// Loaded only for a session whose context is an uploaded HTML page, with its sanitizer.
const SessionContextHtml = React.lazy(() => import('./SessionContextHtml'));
const SessionDebateAtlasView = React.lazy(() => import('../DebateAtlas/SessionDebateAtlasView'));
const SessionRiskMatrixView = React.lazy(() => import('../ResultsBuilds/SessionRiskMatrixView'));
const SessionAgentModal = React.lazy(() => import('./SessionAgentModal'));

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

type SessionContextView = SessionContext;

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
  cacheInitializationError?: unknown;
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
  requestedAtlasNodeId?: string | null;
  onRequestedAtlasNodeClose?: () => void;
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

const DEBATE_ATLAS_VIEW_OPTION: ResultsViewOption = { key: 'debateAtlas', label: 'Debate Map', icon: '🗺️' };
const RISK_MATRIX_VIEW_OPTION: ResultsViewOption = { key: 'riskMatrix', label: 'Risk Matrix', icon: '⚠️' };

const buildResultsViewOptions = (
  isDemoSlug: boolean,
  showDemoAnalysisView: boolean,
  generatedOptions: ResultsViewOption[] = [],
  builtOptions: ResultsViewOption[] = [],
): ResultsViewOption[] => {
  const demoOptions =
    isDemoSlug && generatedOptions.length === 0
      ? [
          DEBATE_ATLAS_VIEW_OPTION,
          ...(showDemoAnalysisView ? [{ key: 'analysis', label: 'Breakdown', icon: '📊' }] : []),
          RISK_MATRIX_VIEW_OPTION,
        ]
      : [];
  // A built view takes the place of the AI Views one of its name.
  const builtKeys = new Set(builtOptions.map(({ key }) => key));
  return [
    { key: 'polis', label: 'Report', icon: '🧾' },
    ...(demoOptions.length === 0 ? builtOptions : []),
    ...(generatedOptions.length > 0 ? generatedOptions.filter(({ key }) => !builtKeys.has(key)) : demoOptions),
  ];
};

// The shared reader's limits apply here as in MCP and on the Worker.
const normalizeSessionContextView = (config: unknown): SessionContextView | null => {
  const record = config && typeof config === 'object' ? (config as UnknownRecord) : {};
  if (!hasSessionContext(record.sessionContext)) return null;
  const context = normalizeSessionContext(record.sessionContext);
  return { ...context, title: context.title || 'Context' };
};

const renderSessionContext = (context: SessionContextView | null) => {
  if (!context) return null;
  return (
    <section className={styles.sessionContextSection} aria-label={context.title} data-testid="ce-session-context">
      {context.html ? (
        <Suspense fallback={<LazyFallback label="Loading context..." minHeight="8vh" />}>
          <SessionContextHtml html={context.html} />
        </Suspense>
      ) : (
        context.paragraphs.map((paragraph, index) => <p key={`${index}:${paragraph.slice(0, 24)}`}>{paragraph}</p>)
      )}
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
  cacheInitializationError,
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
  requestedAtlasNodeId = null,
  onRequestedAtlasNodeClose,
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
  const atlas = useSessionResultsBuild<DebateAtlasBuild>({
    account,
    chainId: networkChainId,
    enabled: showResults,
    kind: 'debate-atlas',
    provider,
    sessionConfig: resolvedSessionConfig,
    sessionSlug: effectiveSlug,
  });
  const riskMatrix = useSessionResultsBuild<RiskMatrixBuild>({
    account,
    chainId: networkChainId,
    enabled: showResults,
    kind: 'risk-matrix',
    provider,
    sessionConfig: resolvedSessionConfig,
    sessionSlug: effectiveSlug,
  });
  const showBuiltAtlas = !!atlas.build;
  // Risk Matrix and Context links open nodes of the demo atlas, so it stays the one shown for them.
  const showDemoAtlas = isDemoSlug && (!showBuiltAtlas || !!embeddedAtlasNodeId);
  const builtViewOptions = [
    ...(showBuiltAtlas ? [DEBATE_ATLAS_VIEW_OPTION] : []),
    ...(riskMatrix.build ? [RISK_MATRIX_VIEW_OPTION] : []),
  ];
  const builtViewKeys = new Set(builtViewOptions.map(({ key }) => key));
  const buildAtlasHelpId = `build-atlas-help-${React.useId().replace(/:/g, '')}`;
  const buildRiskMatrixHelpId = `build-risk-matrix-help-${React.useId().replace(/:/g, '')}`;
  // The views admins build, each pressed from the open Results menu.
  const resultsBuilds = [
    {
      kind: 'debate-atlas' as const,
      mode: 'debateAtlas',
      results: atlas,
      helpId: buildAtlasHelpId,
      label: 'Build atlas',
      busyLabel: 'Building atlas…',
      help: 'Builds a debate atlas from the responses right now, with a political compass for each category and topic. Takes a few minutes. Everyone who sees Results sees it, and earlier builds stay to compare.',
    },
    {
      kind: 'risk-matrix' as const,
      mode: 'riskMatrix',
      results: riskMatrix,
      helpId: buildRiskMatrixHelpId,
      label: 'Build risk matrix',
      busyLabel: 'Building risk matrix…',
      help: 'Builds a risk matrix from the responses right now: the areas they discuss, and the opportunities and risks where two of them meet. Takes a minute or two. Everyone who sees Results sees it, and earlier builds stay to compare.',
    },
  ].map((entry) => ({ ...entry, busy: entry.results.building || entry.results.activeSinceMs !== null }));
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
  const generatedViewKeys = new Set(
    generatedViewOptions.map((option) => option.key).filter((key) => !builtViewKeys.has(key)),
  );
  const requestedResultsViewMode = resultsViewMode;
  const effectiveResultsViewMode = generatedViewKeys.has(requestedResultsViewMode)
    ? requestedResultsViewMode
    : isDemoSlug
      ? requestedResultsViewMode === 'analysis' && !showDemoAnalysisView
        ? 'polis'
        : requestedResultsViewMode
      : requestedResultsViewMode === 'polis' || builtViewKeys.has(requestedResultsViewMode)
        ? requestedResultsViewMode
        : 'polis';
  const resultsViewOptions = buildResultsViewOptions(
    isDemoSlug,
    showDemoAnalysisView,
    generatedViewOptions,
    builtViewOptions,
  );
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
  const sessionInfoTooltipId = `session-info-${React.useId().replace(/:/g, '')}`;
  const sessionInfoTooltip =
    typeof sessionInfo === 'string' ? formatPolisReportSessionInfo(sessionInfo, displaySessionSlug) : sessionInfo;
  const sessionContext = normalizeSessionContextView(resolvedSessionConfig);
  // Files and links this reader may see. Admins also get the Context section
  // with nothing in it yet, to add the first; everyone else sees it only with context.
  const contextSources = useSessionContextSources({
    sessionSlug: effectiveSlug,
    sessionConfig: resolvedSessionConfig,
    account: typeof account === 'string' ? account : '',
  });
  const canEditContext = (contextSources.isAdmin && contextSources.supported) || contextSources.participantsCanAdd;
  // Everyone signed in sees the Session Agent once an admin turns it on: the
  // dialog says whether it answers them, and lets them keep their answers and
  // files out of it. The robot by the title tells everyone else it is on.
  const sessionAgentOn =
    !isDemoSlug && !!sessionAgentSettingOf((resolvedSessionConfig as UnknownRecord | null)?.sessionAgent);
  const viewerAccount = loginComplete && typeof account === 'string' ? account : '';
  const showSessionAgent = sessionAgentOn && !!viewerAccount;
  const [sessionAgentOpen, setSessionAgentOpen] = React.useState(false);
  // Signing out or switching account closes the dialog, so it never shows one
  // person's answer to another, or opens again by itself at the next sign-in.
  React.useEffect(() => {
    setSessionAgentOpen(false);
  }, [showSessionAgent, viewerAccount]);
  // Where the Context section's Add and View go, in its header beside the title.
  const [contextActions, setContextActions] = React.useState<HTMLDivElement | null>(null);
  const showContextSection =
    isDemoSlug || !!sessionContext || contextSources.sources.length > 0 || canEditContext || showSessionAgent;
  const sectionsGridClassName = [styles.sectionsGrid, !showContextSection ? styles.sectionsGridTwoUp : '']
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
  const [questionCountTarget, setQuestionCountTarget] = React.useState<HTMLSpanElement | null>(null);
  const questionsSectionTitle = renderSectionHeading('Questions');
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
          <SessionTestEthBadge sessionConfig={resolvedSessionConfig} sessionSlug={effectiveSlug} loadPresence />
          <button
            type="button"
            id={sessionInfoTooltipId}
            className={styles.sessionInfoButton}
            data-ce-control-appearance="frameless"
            aria-label="Session info"
            onClick={(event) => event.currentTarget.focus()}
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
          <CETooltip target={sessionInfoTooltipId} placement="bottom" trigger="hover focus" autohide={false}>
            {sessionInfoTooltip || 'Share input; your responses help generate a collective intelligence map.'}
          </CETooltip>
          {sessionAgentOn ? (
            <SessionAgentNotice
              id={`${sessionInfoTooltipId}-agent`}
              where="page"
              className={styles.sessionInfoButton}
            />
          ) : null}
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
              <h2 className={styles.pileHeaderTitle}>
                {questionsSectionTitle}
                <span className={styles.pileHeaderCount} ref={setQuestionCountTarget} />
              </h2>
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
              cacheInitializationError={cacheInitializationError}
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
                questionCountTarget={questionCountTarget}
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
                cacheInitializationError={cacheInitializationError}
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
                {renderSectionHeading('Context', showDocuments ? null : 'View')}
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
              {showDocuments && !isDemoSlug && (canEditContext || contextSources.groupFilesHidden) ? (
                <div className={styles.sectionHeaderActionsScroller}>
                  <div ref={setContextActions} className={styles.sectionHeaderActions} />
                </div>
              ) : null}
            </div>
            {showDocuments && (
              <div className={`${styles.miniSectionContent} ${styles.documentsSectionContent}`.trim()}>
                {showSessionAgent ? (
                  <div className={styles.sessionAgentBar}>
                    <button
                      type="button"
                      className={styles.sessionAgentButton}
                      onClick={() => setSessionAgentOpen(true)}
                      data-testid="ce-session-agent-open"
                    >
                      <FontAwesomeIcon icon={faRobot} aria-hidden="true" />
                      Session Agent
                    </button>
                    {sessionAgentOpen ? (
                      <Suspense fallback={null}>
                        <SessionAgentModal
                          sessionSlug={effectiveSlug}
                          sessionConfig={resolvedSessionConfig}
                          account={viewerAccount}
                          onClose={() => setSessionAgentOpen(false)}
                        />
                      </Suspense>
                    ) : null}
                  </div>
                ) : null}
                {renderSessionContext(sessionContext)}
                {!isDemoSlug ? (
                  <SessionContextSources
                    sessionSlug={effectiveSlug}
                    sessionConfig={(resolvedSessionConfig as Record<string, unknown> | null) || null}
                    account={typeof account === 'string' ? account : ''}
                    list={contextSources}
                    pageLinks={sessionContext?.links || []}
                    headerActionsSlot={contextActions}
                  />
                ) : null}
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
          id="report"
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
              {renderSectionHeading('Results', showResults ? null : 'View')}
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
                  {resultsBuilds.map(({ kind, mode, results, busy, helpId, label, busyLabel, help }) =>
                    results.canBuild ? (
                      <React.Fragment key={kind}>
                        {/* The "?" sits in the pill so it shares the menu's colours in every state. */}
                        <button
                          type="button"
                          id={helpId}
                          onClick={async (event: React.MouseEvent<HTMLElement>) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (await results.startBuild()) onResultsModeChange(mode);
                          }}
                          className={styles.sectionHeaderViewModeButton}
                          disabled={busy}
                          data-testid={`ce-session-${kind}-build`}
                        >
                          {busy ? busyLabel : label}
                          <FontAwesomeIcon icon={faQuestionCircle} aria-hidden="true" />
                        </button>
                        <CETooltip target={helpId} placement="bottom" trigger="hover focus" autohide={false}>
                          {help}
                        </CETooltip>
                      </React.Fragment>
                    ) : null,
                  )}
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
              {generatedState.adminAuthorized === true && generatedState.lastFailure ? (
                <div className={styles.generatedResultsStatus} role="status">
                  {String(generatedState.lastFailure)}
                </div>
              ) : null}
              {resultsBuilds.map(({ kind, results, busy }) =>
                results.canBuild && (busy || results.error) ? (
                  <ResultsBuildStatus
                    key={kind}
                    kind={kind}
                    className={styles.generatedResultsStatus}
                    busy={busy}
                    error={results.error}
                    nextBuild={results.nextBuild}
                    startedAtMs={results.buildStartedAtMs}
                  />
                ) : null,
              )}
              <div>
                {!showDemoAtlas && effectiveResultsViewMode === 'debateAtlas' && atlas.build && (
                  <Suspense fallback={<LazyFallback label="Loading Debate Atlas..." minHeight="30vh" />}>
                    <SessionDebateAtlasView
                      build={atlas.build}
                      builds={atlas.builds}
                      onSelectBuild={atlas.selectBuild}
                      sessionSlug={displaySessionSlug}
                      workerUrl={atlas.workerUrl}
                      requestedNodeId={requestedAtlasNodeId}
                      onRequestedNodeClose={onRequestedAtlasNodeClose}
                    />
                  </Suspense>
                )}
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
                      cacheInitializationError={cacheInitializationError}
                      onRetryLoad={
                        typeof refreshQuestionResponses === 'function'
                          ? () => refreshQuestionResponses(null, { slug: embeddedQuestionSessionSlug })
                          : undefined
                      }
                      onRequestLogin={typeof toggleLoginModal === 'function' ? () => toggleLoginModal(true) : undefined}
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
                {showDemoAtlas && effectiveResultsViewMode === 'debateAtlas' && (
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
                {effectiveResultsViewMode === 'riskMatrix' && riskMatrix.build && (
                  <Suspense fallback={<LazyFallback label="Loading Risk Matrix..." minHeight="30vh" />}>
                    <SessionRiskMatrixView
                      build={riskMatrix.build}
                      builds={riskMatrix.builds}
                      onSelectBuild={riskMatrix.selectBuild}
                    />
                  </Suspense>
                )}
                {isDemoSlug &&
                  !riskMatrix.build &&
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
