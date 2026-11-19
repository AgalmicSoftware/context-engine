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
import styles from './OnePageSession.module.scss';
import WorkerGroupsLoading from './WorkerGroupsLoading';
import OnePageSessionAutoMintAlerts, { type OnePageSessionAutoMintAlertsProps } from './OnePageSessionAutoMintAlerts';
import SessionContextSources from './SessionContextSources';
import SessionAgentNotice from './SessionAgentNotice';
import { normalizeInterviewSettings } from '@ce-shared/interviewSettings.mjs';
import { useSessionContextSources } from '../../utilities/docLibrary/useSessionContextSources';
import { sessionAgentOpenToAnyone, sessionAgentSettingOf } from '@ce-shared/sessionAgent.mjs';

const SurveyPage = React.lazy(() => import('../SurveyTool/SurveyPage'));
const MemoSurveyPage = React.memo((props: Record<string, unknown>) => <SurveyPage {...props} />);
const OnePageSessionGroupsSection = React.lazy(() => import('./GroupsSection'));
const PolisReport = React.lazy(() => import('../PolisReport/PolisReport'));
const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
const CorpusViewer = lazyWithRetry(() => import('../DemoViews/CorpusViewer'));
const RiskMatrix = React.lazy(() => import('../MainContent/RiskMatrix'));
const DemoAnalysisWorkspace = React.lazy(() => import('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace'));
// Loaded only for a session whose context is an uploaded HTML page, with its sanitizer.
const SessionContextHtml = React.lazy(() => import('./SessionContextHtml'));
const SessionDebateAtlasView = React.lazy(() => import('../DebateAtlas/SessionDebateAtlasView'));
const SessionRiskMatrixView = React.lazy(() => import('../ResultsBuilds/SessionRiskMatrixView'));
const SessionAgentModal = React.lazy(() => import('./SessionAgentModal'));
const SessionFeedback = React.lazy(() => import('./SessionFeedback'));

const SESSION_AGENT_UPDATE_HELP =
  "Refreshes what this session's Session Agent knows about the results as a whole, from the answers given so far. When answers have changed since the last update it is a paid AI call on the session's AI key; when none have, nothing is built or charged.";

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
  // The build of the results as a whole, which the Session Agent reads; its one control is Update Session Agent.
  generatedResultsAnalysis?: UnknownRecord | null;
  sessionAgentUpdateUnchanged?: boolean;
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
  onSessionAgentUpdate?: () => void;
  onKickoffAutoMintIfNeeded: () => void;
  onLoadFullCorpusClick: (event: React.MouseEvent<HTMLElement>) => void;
  onOpenResults: () => void;
  onViewSessionResults?: () => void;
  onViewSessionGroups?: () => void;
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

const DEBATE_ATLAS_VIEW_OPTION: ResultsViewOption = { key: 'debateAtlas', label: 'Atlas', icon: '🗺️' };
const RISK_MATRIX_VIEW_OPTION: ResultsViewOption = { key: 'riskMatrix', label: 'Risk Matrix', icon: '⚠️' };

// A demo session shows its fixtures; any other shows the views an admin has built, and to those who may build
// them, the views not built yet.
const buildResultsViewOptions = (
  isDemoSlug: boolean,
  showDemoAnalysisView: boolean,
  builtOptions: ResultsViewOption[],
): ResultsViewOption[] => [
  { key: 'polis', label: 'Report', icon: '🧾' },
  ...(isDemoSlug
    ? [
        DEBATE_ATLAS_VIEW_OPTION,
        ...(showDemoAnalysisView ? [{ key: 'analysis', label: 'Breakdown', icon: '📊' }] : []),
        RISK_MATRIX_VIEW_OPTION,
      ]
    : builtOptions),
];

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
  onSessionAgentUpdate,
  sessionAgentUpdateUnchanged = false,
  onKickoffAutoMintIfNeeded,
  onLoadFullCorpusClick,
  onOpenResults,
  onViewSessionResults,
  onViewSessionGroups,
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
    ...(atlas.build || atlas.canBuild ? [DEBATE_ATLAS_VIEW_OPTION] : []),
    ...(riskMatrix.build || riskMatrix.canBuild ? [RISK_MATRIX_VIEW_OPTION] : []),
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
      help: 'Builds an atlas from the responses right now: the topics and subtopics people raised, the positions in each, and where everyone stands. Takes a few minutes. Everyone who sees Results sees it, and earlier builds stay to compare.',
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
  const requestedResultsViewMode = resultsViewMode;
  const effectiveResultsViewMode = isDemoSlug
    ? requestedResultsViewMode === 'analysis' && !showDemoAnalysisView
      ? 'polis'
      : requestedResultsViewMode
    : requestedResultsViewMode === 'polis' || builtViewKeys.has(requestedResultsViewMode)
      ? requestedResultsViewMode
      : 'polis';
  const resultsViewOptions = buildResultsViewOptions(isDemoSlug, showDemoAnalysisView, builtViewOptions);
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
  // Someone signed out where they could add once logged in sees Add too, which opens the login.
  const signInToAddContext = contextSources.signInToAdd && typeof toggleLoginModal === 'function';
  const canEditContext =
    (contextSources.isAdmin && contextSources.supported) || contextSources.participantsCanAdd || signInToAddContext;
  // Everyone signed in sees the Session Agent once an admin turns it on: the
  // dialog says whether it answers them, and lets them keep their answers and
  // files out of it. Someone not signed in sees it too unless the admins turned
  // that off, and the dialog asks them to sign in where the Worker won't answer
  // them as they are. The robot by the title tells everyone it is on.
  const sessionAgentSetting = isDemoSlug
    ? null
    : sessionAgentSettingOf((resolvedSessionConfig as UnknownRecord | null)?.sessionAgent);
  const sessionAgentOn = !!sessionAgentSetting;
  // The Session Agent answers about the results as a whole from a build an admin starts here. The button shows
  // only where the agent is on, since nothing else reads that build. A session whose Worker builds it
  // automatically keeps the notice of a failed build either way, as that goes on whether or not the agent is on.
  const agentUpdate = (
    generatedResultsAnalysis && typeof generatedResultsAnalysis === 'object' ? generatedResultsAnalysis : {}
  ) as UnknownRecord;
  const agentUpdateAdmin = agentUpdate.adminAuthorized === true;
  const agentUpdateRunning = agentUpdate.isRunning === true || agentUpdate.status === 'running';
  const agentUpdateCanCheck = agentUpdate.canCheckStatus === true;
  const agentUpdateMode = String(
    agentUpdate.generationMode ||
      ((resolvedSessionConfig as UnknownRecord | null)?.resultsAnalysis as UnknownRecord | undefined)?.generationMode ||
      '',
  );
  const agentUpdateAutomatic = agentUpdateMode === 'automatic' || agentUpdateMode === 'both';
  const showAgentUpdate = sessionAgentOn && (agentUpdateAdmin || generatedResultsAuthAvailable);
  const agentUpdateFailure =
    agentUpdateAdmin && (sessionAgentOn || agentUpdateAutomatic) ? String(agentUpdate.lastFailure || '') : '';
  // Once the admin has pressed, say why nothing started: the press could not be proven or sent, or this
  // session cannot be updated by hand. Before a press these would be noise from the page's own reads.
  const [agentUpdatePressed, setAgentUpdatePressed] = React.useState(false);
  const agentUpdateCannotStart =
    agentUpdateAdmin && !agentUpdateRunning && !agentUpdateCanCheck && agentUpdate.canGenerate !== true;
  const agentUpdateProblem =
    !showAgentUpdate || !agentUpdatePressed || agentUpdateFailure || agentUpdate.status === 'loading'
      ? ''
      : agentUpdate.error
        ? `Session Agent update could not start: ${String(agentUpdate.error)}`
        : agentUpdateCannotStart
          ? agentUpdateMode === 'automatic'
            ? 'This session updates its Session Agent automatically, so it is not updated by hand.'
            : 'The Session Agent can’t be updated on this session.'
          : '';
  const agentUpdateLabel = agentUpdateRunning
    ? 'Updating Session Agent…'
    : agentUpdateCanCheck
      ? 'Check Session Agent update'
      : agentUpdateFailure
        ? 'Retry Session Agent update'
        : 'Update Session Agent';
  const agentUpdateDisabled =
    agentUpdateRunning ||
    agentUpdate.status === 'loading' ||
    (agentUpdateAdmin && !agentUpdateCanCheck && agentUpdate.canGenerate !== true);
  const agentUpdateHelpId = `session-agent-update-help-${React.useId().replace(/:/g, '')}`;
  const viewerAccount = loginComplete && typeof account === 'string' ? account : '';
  const showSessionAgent = sessionAgentOn && (!!viewerAccount || sessionAgentOpenToAnyone(sessionAgentSetting));
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
              sessionConfig={resolvedSessionConfig}
              note={normalizeInterviewSettings((resolvedSessionConfig as UnknownRecord | null)?.interviewMode).dataNote}
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
              onViewSessionGroups={onViewSessionGroups}
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
        <Suspense fallback={<WorkerGroupsLoading />}>
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
                          onOpenResults={() => {
                            if (!showResults) onToggleResults();
                          }}
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
                    onRequestLogin={
                      signInToAddContext ? () => (toggleLoginModal as (open: boolean) => void)(true) : undefined
                    }
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
                  {showAgentUpdate && (
                    <>
                      <button
                        type="button"
                        id={agentUpdateHelpId}
                        onClick={(event: React.MouseEvent<HTMLElement>) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setAgentUpdatePressed(true);
                          onSessionAgentUpdate?.();
                        }}
                        className={styles.sectionHeaderViewModeButton}
                        disabled={agentUpdateDisabled}
                        data-testid="ce-session-agent-update"
                      >
                        {agentUpdateLabel}
                        <FontAwesomeIcon icon={faQuestionCircle} aria-hidden="true" />
                      </button>
                      <CETooltip target={agentUpdateHelpId} placement="bottom" trigger="hover focus" autohide={false}>
                        {SESSION_AGENT_UPDATE_HELP}
                      </CETooltip>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          {showResults && (
            <div className={styles.miniSectionContent}>
              {agentUpdateFailure ? (
                <div
                  className={styles.generatedResultsStatus}
                  role="status"
                  data-testid="ce-session-agent-update-failed"
                >
                  Session Agent update failed: {agentUpdateFailure}
                </div>
              ) : agentUpdateProblem ? (
                <div
                  className={styles.generatedResultsStatus}
                  role="status"
                  data-testid="ce-session-agent-update-problem"
                >
                  {agentUpdateProblem}
                </div>
              ) : showAgentUpdate && sessionAgentUpdateUnchanged && !agentUpdateRunning ? (
                <div
                  className={styles.generatedResultsStatus}
                  role="status"
                  data-testid="ce-session-agent-update-unchanged"
                >
                  No answers have changed since the last update, so the Session Agent already has them. Nothing was
                  built or charged.
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
                  <Suspense fallback={<LazyFallback label="Loading Atlas..." minHeight="30vh" />}>
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
                  <Suspense fallback={<LazyFallback label="Loading Atlas..." minHeight="30vh" />}>
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
                {isDemoSlug && !riskMatrix.build && effectiveResultsViewMode === 'riskMatrix' && (
                  <Suspense fallback={<LazyFallback label="Loading Risk Matrix..." minHeight="30vh" />}>
                    <RiskMatrix
                      embedded={true}
                      onOpenAtlasNode={onCorpusAtlasIssueOpen}
                      restoreState={riskMatrixRestoreState}
                      onRestoreApplied={onRiskMatrixRestoreApplied}
                    />
                  </Suspense>
                )}
                {/* Shown only to those who may build it: nothing stands in for a view before an admin builds it. */}
                {!isDemoSlug &&
                  resultsBuilds.map(({ kind, mode, results, busy, label, busyLabel }) =>
                    effectiveResultsViewMode === mode &&
                    !results.build &&
                    (busy || (results.loaded && !results.error)) ? (
                      <p key={kind} className={styles.resultsBuildEmpty} data-testid={`ce-session-${kind}-empty`}>
                        {busy ? (
                          busyLabel
                        ) : (
                          <>
                            Not built yet. Press <strong>{label}</strong> above to build it from the responses so far.
                          </>
                        )}
                      </p>
                    ) : null,
                  )}
              </div>
            </div>
          )}
        </div>
        <Suspense fallback={null}>
          <SessionFeedback
            sessionSlug={effectiveSlug}
            sessionConfig={resolvedSessionConfig}
            account={viewerAccount}
            view={showResults ? `results:${effectiveResultsViewMode}` : 'questions'}
          />
        </Suspense>
      </div>
    </div>
  );
}
