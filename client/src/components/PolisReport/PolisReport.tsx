/** @file PolisReport.tsx */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faQuestionCircle,
  faSpinner,
  faMagic as faWand,
  faCog,
  faInfoCircle,
  faMinusSquare,
  faPlusSquare,
  faCaretDown,
  faCaretUp,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';

import {
  computePolisCommentStats,
  computePolisConversationMath,
  findRepresentativeQuestions,
} from '../../utilities/survey/consensusReportMath.js';

import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';
import styles from './PolisReport.module.scss';
import { QRCodeSVG } from 'qrcode.react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { FIXED_MEDIA_DARK, FIXED_MEDIA_LIGHT } from '../../utilities/ui/fixedMediaColors';
import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import { createLogger } from 'utilities/logging.js';
import { isDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { QuestionStanceBar } from '../Shared/QuestionStanceCard';
import BeeswarmPlot, { type BeeswarmPoint } from '../Shared/BeeswarmPlot/BeeswarmPlot';
import {
  buildQuestionScanProgressDisplay,
  doesQuestionProgressMatchSlug,
  normalizeQuestionProgressSlug,
} from '../SurveyTool/surveyToolUtils';
import type {
  BooleanMap,
  EmbeddingChoice,
  NumberMap,
  PolisAnalysisCacheByKey,
  PolisAnalysisErrorsByKey,
  PolisCommentStat,
  PolisPoint,
  PolisRepQuestionsMap,
  PolisReportProps,
  PolisSbtSelection,
  PolisStats,
  PolisVote,
  PrecomputedDemoClusterState,
  RatingMatrix,
  RatingMatrixBuildResult,
  StringMap,
  UnknownRecord,
} from './polisReportRuntime';
import {
  DEFAULT_EXPLORATORY_CLUSTER_COUNT,
  OPINION_GROUPS_TOOLTIP_TEXT,
  PARTICIPANTS_GRAPH_TOOLTIP_TEXT,
  REPORT_DEFAULT_EMBEDDING_LABEL,
  REPORT_DEFAULT_EMBEDDING_TOOLTIP_TEXT,
  analyzeClusterOpinionsTyped,
  applyFilterStateToAggregator,
  buildClusterAnalysisDataKey,
  buildPolisDemoDatasetsBySlug,
  buildPolisReportPdfFilename,
  buildPrecomputedDemoClusterState,
  buildRatingMatrixFromDemo,
  buildRatingMatrixFromRealData,
  clusterUMAPPointsKmeansTyped,
  d3Report,
  doUMAPTyped,
  formatBlockchainNetworkLabel,
  formatSuperscriptNumber,
  getErrorMessage,
  getPolisDemoDatasetForSlug as getPolisDemoDatasetForSlugRuntime,
  getPolisHistoricalParticipantAvatar,
  getPolisHistoricalParticipantBlockie,
  getRenderableParticipantList,
  getUTCDataTimestamp,
  resolveExploratoryClusterCount,
  resolveJsPdfConstructor,
  shouldAutoEnablePolisDemoData,
} from './polisReportRuntime';
import PolisReportSectionToggleLabel from './PolisReportSectionToggleLabel';
export {
  OPINION_GROUPS_TOOLTIP_TEXT,
  PARTICIPANTS_GRAPH_TOOLTIP_TEXT,
  REPORT_DEFAULT_EMBEDDING_LABEL,
  REPORT_DEFAULT_EMBEDDING_TOOLTIP_TEXT,
  applyFilterStateToAggregator,
  buildClusterAnalysisDataKey,
  buildPolisReportPdfFilename,
  buildPrecomputedDemoClusterState,
  buildRatingMatrixFromDemo,
  buildRatingMatrixFromRealData,
  formatBlockchainNetworkLabel,
  getPolisHistoricalParticipantAvatar,
  getRenderableParticipantList,
  normalizePolisBinaryVote,
  resolveExploratoryClusterCount,
  resolveJsPdfConstructor,
  resolvePrecomputedClusterDifference,
  shouldAutoEnablePolisDemoData,
} from './polisReportRuntime';

const surveyLog = createLogger('surveys');
export const POLIS_CLUSTER_COLORS = d3Report.schemeCategory10;
export const getPolisDemoDatasetForSlug = (...args: Parameters<typeof getPolisDemoDatasetForSlugRuntime>) =>
  getPolisDemoDatasetForSlugRuntime(...args);

export const buildPolisParticipantProfileHref = ({
  address = '',
  displayName = '',
  sessionSlug = '',
}: {
  address?: unknown;
  displayName?: unknown;
  sessionSlug?: unknown;
} = {}): string => {
  const name = String(displayName || '').trim();
  const addr = String(address || '').trim();
  const isEth = /^0x[0-9a-fA-F]{40}$/.test(addr);
  const base = name ? `/su/${encodeURIComponent(name)}` : isEth ? `/u/${encodeURIComponent(addr)}` : '';
  if (!base) return '';
  const normalizedSlug = normalizeSessionSlug(sessionSlug || '');
  return normalizedSlug ? `${base}?session=${encodeURIComponent(normalizedSlug)}` : base;
};

/***************************************************************
 * The main PolisReport component
 ***************************************************************/
export default function PolisReport({
  questionResponses, // Aggregator object { questionId -> [ { responder, questionId, response }, ... ] }
  network, // blockchain network object
  disclaimersActive, // boolean
  sbtFilterString, // (Optional) String describing SBT filters applied by parent
  filterState, // (Optional) Object with detailed filter state from parent
  sessionName = null, // Optional session name
  sessionHeader = null, // --> NEW: Optional header image path
  sessionInfo = null, // Optional session info (string or object)
  onePageDemo = false, // whether we are embedded in demo page
  demoMode = false, // optional: external demo flag
  demoDataFirstLoad = false,
  demoDataBySlug = null,
  miniMode = false,
  // NEW: loading flag – default true to preserve existing behavior where this prop isn't passed
  isQuestionCacheReady = false,
  isResponsesCacheReady = false,
  questionScanProgress = null,
  // NEW: bump recalculation when fresh responses land
  questionResponsesNonce,
  networkChainId = null,
  slug = '',
  sessionSlug = '',
  sessionConfig = null,
}: PolisReportProps) {
  const [ratingMatrix, setRatingMatrix] = useState<RatingMatrix | null>(null);
  const [allResponders, setAllResponders] = useState<string[]>([]);
  const [allQuestions, setAllQuestions] = useState<string[]>([]);
  const [stats, setStats] = useState<PolisStats | null>(null);
  const [demoDisplayNames, setDemoDisplayNames] = useState<StringMap>({});

  // Single SVD-based approach (statements + participants):
  const [participantCoords, setParticipantCoords] = useState<PolisPoint[]>([]);
  const [statementCoords, setStatementCoords] = useState<PolisPoint[]>([]);
  const [umapParticipantCoords, setUmapParticipantCoords] = useState<PolisPoint[]>([]);

  const [questionPrompts, setQuestionPrompts] = useState<StringMap>({});
  const [questionLabels, setQuestionLabels] = useState<string[]>([]);
  const resolvedSessionName = sessionName;
  const resolvedSessionInfo = sessionInfo;
  const activeReportSlug = normalizeSessionSlug(slug || sessionSlug || '');
  const resolvedSessionSlug = activeReportSlug;
  const hasBlockchainContext = Number(networkChainId || network?.id || network?.chainId || 0) > 0;
  const reportProgressSlug = useMemo(() => normalizeQuestionProgressSlug(resolvedSessionSlug), [resolvedSessionSlug]);
  const resolvedDemoDataBySlug = useMemo(() => buildPolisDemoDatasetsBySlug(demoDataBySlug), [demoDataBySlug]);
  const autoUseDemoData = useMemo(
    () =>
      shouldAutoEnablePolisDemoData({
        slug: activeReportSlug,
        demoDataFirstLoad,
        datasetsBySlug: resolvedDemoDataBySlug,
      }),
    [activeReportSlug, demoDataFirstLoad, resolvedDemoDataBySlug],
  );
  const activeDemoData = useMemo(
    () => getPolisDemoDatasetForSlug(activeReportSlug, { datasetsBySlug: resolvedDemoDataBySlug }),
    [activeReportSlug, resolvedDemoDataBySlug],
  );
  const trustedBuiltInDemoData = useMemo(
    () => getPolisDemoDatasetForSlug(activeReportSlug, { allowFallback: false }),
    [activeReportSlug],
  );
  // Keep the canonical built-in demo aligned with other demo datasets by
  // starting in the shared exploratory UMAP view instead of special-casing
  // a first-load Polis Auto mode.
  const defaultEmbeddingChoice = 'UMAP' as EmbeddingChoice;
  const defaultManualClusterCount = String(DEFAULT_EXPLORATORY_CLUSTER_COUNT);
  const currentPathname = typeof window !== 'undefined' && window.location?.pathname ? window.location.pathname : '';
  const currentSearch =
    typeof window !== 'undefined' && typeof window.location?.search === 'string' ? window.location.search : '';
  const liveReportUrl = useMemo(() => {
    if (!resolvedSessionSlug || !currentPathname) return '';
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    // Strip auth/claim params that should never appear in exported PDFs
    const SENSITIVE_PARAMS = new Set(['gp', 'password', 'inv', 'sbt', 'auto']);
    const params = new URLSearchParams(currentSearch);
    for (const key of [...params.keys()]) {
      if (SENSITIVE_PARAMS.has(key) || /^(?:sbt|gp|inv|auto)\d+$/.test(key)) params.delete(key);
    }
    const sanitizedSearch = params.toString() ? `?${params.toString()}` : '';
    return `${origin}${currentPathname}${sanitizedSearch}`;
  }, [currentPathname, currentSearch, resolvedSessionSlug]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const footnoteTextsRef = useRef<string[]>([]);
  const footnoteIndexByTextRef = useRef<Map<string, number>>(new Map());
  const footnoteTexts = footnoteTextsRef.current;
  const footnoteIndexByText = footnoteIndexByTextRef.current;
  footnoteTexts.length = 0;
  footnoteIndexByText.clear();

  // Toggling between demo data or real data
  const [useDemoData, setUseDemoData] = useState<boolean>(() => autoUseDemoData);
  const effectiveUseDemoData = useDemoData;
  const scopedQuestionScanProgress = useMemo(() => {
    if (!questionScanProgress) return null;
    return doesQuestionProgressMatchSlug(String(questionScanProgress.slug || ''), reportProgressSlug)
      ? questionScanProgress
      : null;
  }, [questionScanProgress, reportProgressSlug]);
  const loadingScanProgress = useMemo(
    () => buildQuestionScanProgressDisplay(scopedQuestionScanProgress),
    [scopedQuestionScanProgress],
  );
  const autoUseDemoDataSignatureRef = useRef<string>(`${activeReportSlug}|${autoUseDemoData ? '1' : '0'}`);
  const precomputedDemoClusterState = useMemo<PrecomputedDemoClusterState | null>(() => {
    if (!effectiveUseDemoData) return null;
    return buildPrecomputedDemoClusterState(activeDemoData);
  }, [activeDemoData, effectiveUseDemoData]);

  // For cluster assignments
  const [clusterCount, setClusterCount] = useState<number>(0);
  const [clusterAssignments, setClusterAssignments] = useState<number[]>([]);
  const [embeddingChoice, setEmbeddingChoice] = useState<EmbeddingChoice>(
    () => defaultEmbeddingChoice as EmbeddingChoice,
  );
  const embeddingChoiceRef = useRef<EmbeddingChoice>(defaultEmbeddingChoice as EmbeddingChoice);
  const [manualClusterCount, setManualClusterCount] = useState<string>(() => defaultManualClusterCount);
  const [exploratoryClusterAssignments, setExploratoryClusterAssignments] = useState<number[]>([]);
  const [exploratoryRepQuestions, setExploratoryRepQuestions] = useState<PolisRepQuestionsMap>({});

  useEffect(() => {
    embeddingChoiceRef.current = embeddingChoice;
  }, [embeddingChoice]);

  // Representative questions
  const [repQuestions, setRepQuestions] = useState<PolisRepQuestionsMap>({});

  // Collapsible states
  const [beeswarmOpen, setBeeswarmOpen] = useState<boolean>(true);
  const [participantsGraphOpen, setParticipantsGraphOpen] = useState<boolean>(true);
  const [allQuestionsOpen, setAllQuestionsOpen] = useState<boolean>(true);
  const [statsOpen, setStatsOpen] = useState<boolean>(true);
  const [participantsListOpen, setParticipantsListOpen] = useState<boolean>(true); // NEW: List of Participants section toggle

  // Collapsible clusters
  const [clusterCollapseState, setClusterCollapseState] = useState<BooleanMap>({});

  // Show/hide tooltips
  const [enableTooltips, setEnableTooltips] = useState<boolean>(true);
  const [hoveredContent, setHoveredContent] = useState<React.ReactNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkScrollableTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelTooltipHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);
  const cancelCheckScrollableTimeout = useCallback(() => {
    if (checkScrollableTimeoutRef.current) {
      clearTimeout(checkScrollableTimeoutRef.current);
      checkScrollableTimeoutRef.current = null;
    }
  }, []);
  const scheduleTooltipHide = useCallback(
    (delay: number = 400) => {
      cancelTooltipHide();
      hideTimerRef.current = setTimeout(() => setHoveredContent(null), delay);
    },
    [cancelTooltipHide],
  );

  useEffect(() => {
    return () => {
      cancelTooltipHide();
      cancelCheckScrollableTimeout();
    };
  }, [cancelCheckScrollableTimeout, cancelTooltipHide]);

  const registerFootnote = (text: unknown) => {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) return null;
    if (!footnoteIndexByText.has(normalizedText)) {
      footnoteTexts.push(normalizedText);
      footnoteIndexByText.set(normalizedText, footnoteTexts.length);
    }
    return footnoteIndexByText.get(normalizedText);
  };

  const renderTooltipReference = (
    text: string,
    options: {
      ariaLabel?: string;
      className?: string;
      style?: React.CSSProperties;
      title?: string;
    } = {},
  ) => {
    const footnoteNumber = registerFootnote(text);
    const { ariaLabel, className = styles.tooltipIcon, style, title } = options;

    return (
      <>
        {enableTooltips && (
          <span className={styles.pdfIgnore} style={{ display: 'inline-flex' }}>
            <FontAwesomeIcon
              icon={faQuestionCircle}
              className={className}
              style={style}
              aria-label={ariaLabel}
              title={title}
              onMouseEnter={() => {
                cancelTooltipHide();
                setHoveredContent(text);
              }}
              onMouseLeave={() => scheduleTooltipHide(400)}
            />
          </span>
        )}
        {footnoteNumber ? (
          <sup className={`${styles.showWhenPdf} ${styles.footnoteRef}`}>{formatSuperscriptNumber(footnoteNumber)}</sup>
        ) : null}
      </>
    );
  };

  // Show/hide the top settings row
  const [showSettingsRow, setShowSettingsRow] = useState<boolean>(() => isDemoSessionSlug(activeReportSlug));
  const [reportStyle, setReportStyle] = useState<string>('original');
  const embeddingDefaultSignatureRef = useRef<string>(
    `${activeReportSlug}|${defaultEmbeddingChoice}|${defaultManualClusterCount}`,
  );

  // Toggles for participant graph
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showRadialAxes, setShowRadialAxes] = useState<boolean>(true);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [showParticipants, setShowParticipants] = useState<boolean>(true);
  const [showGroupOutline, setShowGroupOutline] = useState<boolean>(true);

  // NEW: toggle for showing Ethereum addresses in participant graph (non-demo only)
  const [showAddresses, setShowAddresses] = useState<boolean>(() => {
    try {
      localStorage.setItem('ceReport_showAddresses', localStorage.getItem('ceReport_showAddresses') || 'false');
      return localStorage.getItem('ceReport_showAddresses') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('ceReport_showAddresses', showAddresses ? 'true' : 'false');
    } catch (e) {
      surveyLog.warn('PolisReport: fallback', e);
    }
  }, [showAddresses]);

  // PDF capture ref
  const reportRef = useRef<HTMLDivElement | null>(null);

  // Error handling
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local state for toggling PDF link in the heading
  const [isPdfModeActive, setIsPdfModeActive] = useState<boolean>(false);

  // ADDED: Ref and state for Bee Swarm scroller buttons
  const swarmContainerRef = useRef<HTMLDivElement | null>(null);
  const [isSwarmScrollable, setIsSwarmScrollable] = useState<boolean>(false);

  // 🔐 Deterministic seed for embeddings & clustering
  const DETERMINISTIC_SEED = 42;
  const [polisMathResult, setPolisMathResult] = useState<{
    stats: PolisStats;
    participantCoords: PolisPoint[];
    statementCoords: PolisPoint[];
    commentStats?: PolisCommentStat[];
    clusterAssignments: number[];
    clusterCount: number;
    repQuestions: PolisRepQuestionsMap;
  } | null>(null);
  const [polisMathError, setPolisMathError] = useState<unknown>(null);
  useEffect(() => {
    if (!ratingMatrix || !ratingMatrix.length) {
      setPolisMathResult(null);
      setPolisMathError(null);
      return;
    }

    try {
      setPolisMathResult(
        computePolisConversationMath(ratingMatrix, questionPrompts, allQuestions, {
          randomSeed: DETERMINISTIC_SEED,
        }) as {
          stats: PolisStats;
          participantCoords: PolisPoint[];
          statementCoords: PolisPoint[];
          commentStats?: PolisCommentStat[];
          clusterAssignments: number[];
          clusterCount: number;
          repQuestions: PolisRepQuestionsMap;
        },
      );
      setPolisMathError(null);
    } catch (error) {
      setPolisMathResult(null);
      setPolisMathError(error);
    }
  }, [DETERMINISTIC_SEED, allQuestions, questionPrompts, ratingMatrix]);

  useEffect(() => {
    const nextSig = `${activeReportSlug}|${autoUseDemoData ? '1' : '0'}`;
    if (autoUseDemoDataSignatureRef.current === nextSig) return;
    autoUseDemoDataSignatureRef.current = nextSig;
    // Reset the local toggle default when the session changes, while preserving manual toggles within a session.
    setUseDemoData(autoUseDemoData);
    setShowSettingsRow(isDemoSessionSlug(activeReportSlug));
  }, [activeReportSlug, autoUseDemoData]);

  useEffect(() => {
    const nextSig = `${activeReportSlug}|${defaultEmbeddingChoice}|${defaultManualClusterCount}`;
    if (embeddingDefaultSignatureRef.current === nextSig) return;
    embeddingDefaultSignatureRef.current = nextSig;
    setEmbeddingChoice(defaultEmbeddingChoice);
    setManualClusterCount(defaultManualClusterCount);
    if (defaultEmbeddingChoice !== 'SVD') {
      setShowComments(false);
    }
  }, [activeReportSlug, defaultEmbeddingChoice, defaultManualClusterCount]);

  const manualClusterCountValue = useMemo(() => {
    const parsed = parseInt(manualClusterCount, 10);
    return Number.isFinite(parsed) && parsed >= 2 ? parsed : null;
  }, [manualClusterCount]);
  // Only the exact built-in dataset object may hydrate authored summaries.
  // Caller overrides stay on the normal computed/AI path even for demo slugs.
  const shouldUsePrecomputedDemoClusters = !!(
    precomputedDemoClusterState &&
    isDemoSessionSlug(activeReportSlug) &&
    effectiveUseDemoData &&
    activeDemoData === trustedBuiltInDemoData &&
    embeddingChoice === 'POLIS' &&
    manualClusterCountValue === null
  );
  const isExploratoryMode = embeddingChoice !== 'POLIS' || manualClusterCountValue !== null;
  const activeParticipantCoords = embeddingChoice === 'UMAP' ? umapParticipantCoords : participantCoords;
  const activeStatementCoords = embeddingChoice === 'SVD' ? statementCoords : [];
  const activeClusterCount = useMemo(() => {
    if (manualClusterCountValue !== null) return manualClusterCountValue;
    if (
      !isExploratoryMode &&
      shouldUsePrecomputedDemoClusters &&
      Number.isInteger(precomputedDemoClusterState?.clusterCount)
    ) {
      return precomputedDemoClusterState.clusterCount;
    }
    return clusterCount || 0;
  }, [
    clusterCount,
    isExploratoryMode,
    manualClusterCountValue,
    precomputedDemoClusterState,
    shouldUsePrecomputedDemoClusters,
  ]);
  const activeClusterAssignments = useMemo(() => {
    const source = isExploratoryMode ? exploratoryClusterAssignments : clusterAssignments;
    if (Array.isArray(source) && source.length) return source;
    if (
      !isExploratoryMode &&
      shouldUsePrecomputedDemoClusters &&
      Array.isArray(precomputedDemoClusterState?.clusterAssignments)
    ) {
      return precomputedDemoClusterState.clusterAssignments;
    }
    return Array.isArray(source) ? source : [];
  }, [
    clusterAssignments,
    exploratoryClusterAssignments,
    isExploratoryMode,
    precomputedDemoClusterState,
    shouldUsePrecomputedDemoClusters,
  ]);
  const activeRepQuestions = useMemo(() => {
    const source = isExploratoryMode ? exploratoryRepQuestions : repQuestions;
    if (source && typeof source === 'object' && Object.keys(source).length) return source;
    if (
      !isExploratoryMode &&
      shouldUsePrecomputedDemoClusters &&
      precomputedDemoClusterState?.repQuestions &&
      typeof precomputedDemoClusterState.repQuestions === 'object'
    ) {
      return precomputedDemoClusterState.repQuestions;
    }
    return source && typeof source === 'object' ? source : {};
  }, [
    exploratoryRepQuestions,
    isExploratoryMode,
    precomputedDemoClusterState,
    repQuestions,
    shouldUsePrecomputedDemoClusters,
  ]);
  const memoizedCommentSwarmResult = useMemo(() => {
    if (!ratingMatrix || !ratingMatrix.length) {
      return { commentStats: [], error: null };
    }
    const precomputedCommentStats = Array.isArray(precomputedDemoClusterState?.commentStats)
      ? precomputedDemoClusterState.commentStats
      : null;
    if (precomputedCommentStats) {
      return { commentStats: precomputedCommentStats, error: null };
    }
    if (!polisMathResult && !polisMathError) {
      return { commentStats: [], error: null };
    }
    if (Array.isArray(polisMathResult?.commentStats)) {
      return { commentStats: polisMathResult.commentStats, error: null };
    }
    try {
      return {
        commentStats: computePolisCommentStats(ratingMatrix, { randomSeed: DETERMINISTIC_SEED }),
        error: null,
      };
    } catch (error) {
      return { commentStats: [], error };
    }
  }, [DETERMINISTIC_SEED, polisMathError, polisMathResult, precomputedDemoClusterState, ratingMatrix]);

  // ====== NEW: AI Cluster Analysis State ======
  const analysisStartTimesRef = useRef<NumberMap>({}); // { [clusterIndex]: startMs }
  const [analysisTicker, setAnalysisTicker] = useState<number>(0); // triggers re-render for timers
  const [analysisLoadingKey, setAnalysisLoadingKey] = useState<string | null>(null); // string | null (current analysis key)
  const [analysisCacheByKey, setAnalysisCacheByKey] = useState<PolisAnalysisCacheByKey>({}); // { [key]: { [clusterIndex]: {short,long} } }
  const [analysisErrorsByKey, setAnalysisErrorsByKey] = useState<PolisAnalysisErrorsByKey>({}); // { [key]: { [clusterIndex]: string } }
  const [isDocumentHidden, setIsDocumentHidden] = useState<boolean>(() => {
    try {
      return typeof document !== 'undefined' && !!document.hidden;
    } catch (_) {
      return false;
    }
  });
  const analysisDataKey = useMemo(
    () =>
      buildClusterAnalysisDataKey({
        activeClusterAssignments,
        activeClusterCount,
        activeRepQuestions,
        embeddingChoice,
        useDemoData: effectiveUseDemoData,
        questionResponsesNonce,
        questionPrompts,
        allQuestions,
      }),
    [
      activeClusterAssignments,
      activeClusterCount,
      activeRepQuestions,
      embeddingChoice,
      effectiveUseDemoData,
      questionResponsesNonce,
      questionPrompts,
      allQuestions,
    ],
  );
  const currentAnalysisKey = analysisDataKey;

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibilityChange = () => {
      try {
        setIsDocumentHidden(!!document.hidden);
      } catch (_) {
        setIsDocumentHidden(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Tick elapsed timers while analyzing
  useEffect(() => {
    if (!analysisLoadingKey || isDocumentHidden) return;
    const iv = setInterval(() => setAnalysisTicker((t) => (t + 1) % 1_000_000), 500);
    return () => clearInterval(iv);
  }, [analysisLoadingKey, isDocumentHidden]);

  // Utility: format elapsed mm:ss
  const formatElapsed = (startMs: number | undefined) => {
    if (!startMs) return '00:00';
    const s = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  /***************************************************************
   * handleCollapseAll / handleExpandAll
   ***************************************************************/
  function handleCollapseAll() {
    setBeeswarmOpen(false);
    setParticipantsGraphOpen(false);
    setAllQuestionsOpen(false);
    setStatsOpen(false);
    setParticipantsListOpen(false);

    const newObj: BooleanMap = {};
    Object.keys(activeRepQuestions || {}).forEach((c) => {
      newObj[c] = false;
    });
    setClusterCollapseState(newObj);
  }

  function handleExpandAll() {
    setBeeswarmOpen(true);
    setParticipantsGraphOpen(true);
    setAllQuestionsOpen(true);
    setStatsOpen(true);
    setParticipantsListOpen(true);

    const newObj: BooleanMap = {};
    Object.keys(activeRepQuestions || {}).forEach((c) => {
      newObj[c] = true;
    });
    setClusterCollapseState(newObj);
  }

  function handleCollapseAllClusters() {
    const newObj: BooleanMap = {};
    Object.keys(activeRepQuestions || {}).forEach((c) => {
      newObj[c] = false;
    });
    setClusterCollapseState(newObj);
  }

  function handleExpandAllClusters() {
    const newObj: BooleanMap = {};
    Object.keys(activeRepQuestions || {}).forEach((c) => {
      newObj[c] = true;
    });
    setClusterCollapseState(newObj);
  }

  const handleManualClusterCountChange = (nextValue: string) => {
    if (nextValue === '') {
      setManualClusterCount('');
      return;
    }
    const parsed = parseInt(nextValue, 10);
    if (Number.isFinite(parsed)) {
      setManualClusterCount(String(Math.max(2, parsed)));
    }
  };

  const handleManualClusterCountBlur = () => {
    if (manualClusterCount === '') return;
    const parsed = parseInt(manualClusterCount, 10);
    if (!Number.isFinite(parsed) || parsed < 2) {
      setManualClusterCount('');
      return;
    }
    setManualClusterCount(String(parsed));
  };

  const stepManualClusterCount = (delta: number) => {
    const base = Math.max(activeClusterCount || clusterCount || 0, DEFAULT_EXPLORATORY_CLUSTER_COUNT);
    setManualClusterCount(String(Math.max(2, base + delta)));
  };

  const handleEmbeddingChoiceChange = (nextChoice: EmbeddingChoice) => {
    setEmbeddingChoice(nextChoice);
    if (nextChoice === 'POLIS') {
      setManualClusterCount('');
    } else if (manualClusterCountValue === null) {
      setManualClusterCount(String(DEFAULT_EXPLORATORY_CLUSTER_COUNT));
    }
    if (nextChoice !== 'SVD') {
      setShowComments(false);
    }
  };

  /***************************************************************
   * Build rating matrix from real or demo
   ***************************************************************/
  useEffect(() => {
    setErrorMessage(null);
    let buildResult: RatingMatrixBuildResult;
    try {
      if (!effectiveUseDemoData) {
        // Apply the upstream filterState BEFORE building the matrix
        const filteredAgg = applyFilterStateToAggregator(
          questionResponses,
          network,
          filterState,
          activeReportSlug,
          sessionConfig,
        );
        buildResult = buildRatingMatrixFromRealData(filteredAgg, { sessionSlug: activeReportSlug });
      } else {
        // Demo mode: bypass all filters entirely
        buildResult = buildRatingMatrixFromDemo(activeDemoData);
      }
      if (!buildResult.matrix || !buildResult.matrix.length) {
        setRatingMatrix(null);
        setAllResponders([]);
        setAllQuestions([]);
        setStats(null);
        setQuestionPrompts({});
        setQuestionLabels([]);
        setParticipantCoords([]);
        setStatementCoords([]);
        setClusterCount(0);
        setClusterAssignments([]);
        setRepQuestions({});
        setClusterCollapseState({});
        return;
      }
      setRatingMatrix(buildResult.matrix);
      setAllResponders(buildResult.responders);
      setAllQuestions(buildResult.questions);
      setQuestionPrompts(buildResult.promptsMap);
      setDemoDisplayNames(buildResult.displayNamesMap || {});

      const labels = buildResult.questions.map((_q, idx) => `#${idx + 1}`);
      setQuestionLabels(labels);
    } catch (e: unknown) {
      setErrorMessage(`Error building rating matrix: ${getErrorMessage(e)}`);
    }
  }, [
    questionResponses,
    effectiveUseDemoData,
    filterState,
    network,
    questionResponsesNonce,
    activeReportSlug,
    activeDemoData,
    sessionConfig,
  ]);

  useEffect(() => {
    if (!shouldUsePrecomputedDemoClusters) return;
    setClusterCount(precomputedDemoClusterState.clusterCount);
    setClusterAssignments(precomputedDemoClusterState.clusterAssignments);
    setRepQuestions(precomputedDemoClusterState.repQuestions);
    setClusterCollapseState(precomputedDemoClusterState.clusterCollapseState);
  }, [precomputedDemoClusterState, shouldUsePrecomputedDemoClusters]);

  /***************************************************************
   * Polis-style PCA + clustering + representative comments
   ***************************************************************/
  useEffect(() => {
    setErrorMessage(null);
    if (!ratingMatrix || !ratingMatrix.length) {
      setStats(null);
      setParticipantCoords([]);
      setStatementCoords([]);
      setUmapParticipantCoords([]);
      setClusterCount(0);
      setClusterAssignments([]);
      setRepQuestions({});
      setExploratoryClusterAssignments([]);
      setExploratoryRepQuestions({});
      setClusterCollapseState({});
      return;
    }

    if (polisMathError) {
      setErrorMessage(`Report math error: ${getErrorMessage(polisMathError)}`);
      return;
    }
    if (!polisMathResult) return;

    setStats(polisMathResult.stats);
    setParticipantCoords(polisMathResult.participantCoords);
    setStatementCoords(polisMathResult.statementCoords);
    if (!shouldUsePrecomputedDemoClusters) {
      setClusterCount(polisMathResult.clusterCount);
      setClusterAssignments(polisMathResult.clusterAssignments);
      setRepQuestions(polisMathResult.repQuestions);
      const nextCollapseState: BooleanMap = {};
      Object.keys(polisMathResult.repQuestions || {}).forEach((clusterKey) => {
        nextCollapseState[clusterKey] = false;
      });
      setClusterCollapseState(nextCollapseState);
    }
  }, [polisMathError, polisMathResult, ratingMatrix, shouldUsePrecomputedDemoClusters]);

  useEffect(() => {
    if (!ratingMatrix || !ratingMatrix.length) {
      setUmapParticipantCoords([]);
      return;
    }

    try {
      const nComments = ratingMatrix.length;
      const nParticipants = ratingMatrix[0]?.length || 0;
      if (nParticipants < 2) {
        setUmapParticipantCoords([]);
        return;
      }

      const participantData: number[][] = [];
      for (let participantIndex = 0; participantIndex < nParticipants; participantIndex += 1) {
        const row: number[] = [];
        for (let commentIndex = 0; commentIndex < nComments; commentIndex += 1) {
          row.push(ratingMatrix[commentIndex][participantIndex] ?? 0);
        }
        participantData.push(row);
      }

      const nNeighbors = Math.max(2, Math.min(15, nParticipants - 1));
      const embedding = doUMAPTyped(participantData, nNeighbors, DETERMINISTIC_SEED);
      setUmapParticipantCoords(
        embedding.map((point, index) => ({
          x: point[0],
          y: point[1],
          index,
        })),
      );
    } catch (e: unknown) {
      surveyLog.error('UMAP error caught:', e);
      if (embeddingChoiceRef.current === 'UMAP') {
        setErrorMessage(`UMAP error: ${getErrorMessage(e)}`);
      }
      setUmapParticipantCoords([]);
    }
  }, [DETERMINISTIC_SEED, ratingMatrix]);

  useEffect(() => {
    if (!ratingMatrix || !ratingMatrix.length) {
      setExploratoryClusterAssignments([]);
      setExploratoryRepQuestions({});
      return;
    }
    if (!isExploratoryMode) {
      setExploratoryClusterAssignments([]);
      setExploratoryRepQuestions({});
      return;
    }

    const pointsToUse = activeParticipantCoords;
    if (!pointsToUse || !pointsToUse.length) {
      setExploratoryClusterAssignments([]);
      setExploratoryRepQuestions({});
      return;
    }

    const nextClusterCount = resolveExploratoryClusterCount({
      activeClusterCount,
      manualClusterCountValue,
    });
    if (nextClusterCount < 1) {
      setExploratoryClusterAssignments([]);
      setExploratoryRepQuestions({});
      return;
    }
    if (pointsToUse.length < nextClusterCount) {
      const fallbackAssignments = new Array(pointsToUse.length).fill(0);
      setExploratoryClusterAssignments(fallbackAssignments);
      setExploratoryRepQuestions(
        findRepresentativeQuestions(
          ratingMatrix,
          fallbackAssignments,
          questionPrompts,
          allQuestions,
        ) as PolisRepQuestionsMap,
      );
      return;
    }

    try {
      const assigned = clusterUMAPPointsKmeansTyped(pointsToUse, nextClusterCount, DETERMINISTIC_SEED);
      const nextRepQuestions = findRepresentativeQuestions(
        ratingMatrix,
        assigned,
        questionPrompts,
        allQuestions,
      ) as PolisRepQuestionsMap;
      setExploratoryClusterAssignments(assigned);
      setExploratoryRepQuestions(nextRepQuestions);
      setClusterCollapseState((prev) => {
        const next = { ...prev };
        Object.keys(nextRepQuestions || {}).forEach((clusterKey) => {
          if (!Object.prototype.hasOwnProperty.call(next, clusterKey)) {
            next[clusterKey] = false;
          }
        });
        return next;
      });
    } catch (e: unknown) {
      setErrorMessage(`Exploratory clustering error: ${getErrorMessage(e)}`);
      setExploratoryClusterAssignments([]);
      setExploratoryRepQuestions({});
    }
  }, [
    DETERMINISTIC_SEED,
    activeClusterCount,
    activeParticipantCoords,
    allQuestions,
    isExploratoryMode,
    manualClusterCountValue,
    questionPrompts,
    ratingMatrix,
  ]);

  useEffect(() => {
    if (!shouldUsePrecomputedDemoClusters) return;
    setAnalysisLoadingKey(null);
    setAnalysisErrorsByKey((prev) => ({
      ...prev,
      [currentAnalysisKey]: {},
    }));
    setAnalysisCacheByKey((prev) => ({
      ...prev,
      [currentAnalysisKey]: {
        ...(prev[currentAnalysisKey] || {}),
        ...precomputedDemoClusterState.analysisCacheByClusterIndex,
      },
    }));
  }, [currentAnalysisKey, precomputedDemoClusterState, shouldUsePrecomputedDemoClusters]);

  /***************************************************************
   * ADDED: Effect to check if Bee Swarm is scrollable
   ***************************************************************/
  useEffect(() => {
    const checkScrollable = () => {
      if (swarmContainerRef.current) {
        const { scrollWidth, clientWidth } = swarmContainerRef.current;
        setIsSwarmScrollable(scrollWidth > clientWidth);
      }
    };

    // Check initially and after a short delay to allow for rendering
    cancelCheckScrollableTimeout();
    checkScrollableTimeoutRef.current = setTimeout(() => {
      checkScrollableTimeoutRef.current = null;
      checkScrollable();
    }, 100);

    const resizeObserver = new ResizeObserver(checkScrollable);
    const container = swarmContainerRef.current;
    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      cancelCheckScrollableTimeout();
      if (container && typeof resizeObserver.unobserve === 'function') resizeObserver.unobserve(container);
      if (typeof resizeObserver.disconnect === 'function') resizeObserver.disconnect();
    };
  }, [ratingMatrix, beeswarmOpen, cancelCheckScrollableTimeout]); // Rerun when data changes or section is opened/closed

  /***************************************************************
   * ADDED: Handler for Bee Swarm scroll buttons
   ***************************************************************/
  const handleSwarmScroll = (direction: 'left' | 'right') => {
    if (swarmContainerRef.current) {
      const container = swarmContainerRef.current;
      if (direction === 'left') {
        container.scrollTo({
          left: 0,
          behavior: 'smooth',
        });
      } else if (direction === 'right') {
        container.scrollTo({
          left: container.scrollWidth,
          behavior: 'smooth',
        });
      }
    }
  };

  /***************************************************************
   * PDF Download (UPDATED for layout + BeeSwarm numeric dots + size)
   ***************************************************************/
  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    const input = reportRef.current;

    // Enter PDF mode (BeeSwarm numbers; hide tooltips via CSS)
    setIsPdfModeActive(true);
    input.classList.add(styles.pdfMode);
    // Force a consistent, desktop-like width for capture regardless of device viewport
    input.classList.add(styles.pdfDesktopWidth);

    // === NEW: ensure clusters expanded for PDF capture ===
    const prevClusterState = { ...clusterCollapseState };
    const expandAllForPdf: BooleanMap = {};
    Object.keys(activeRepQuestions || {}).forEach((c) => {
      expandAllForPdf[c] = true;
    });
    setClusterCollapseState(expandAllForPdf);

    // === NEW: ensure "All Questions" is open during PDF capture ===
    const prevAllQuestionsOpen = allQuestionsOpen;
    setAllQuestionsOpen(true);

    // allow reflow
    await new Promise((r) => setTimeout(r, 100));

    // Hide any floating tooltips
    const tooltipEls = document.querySelectorAll(`.${styles.beeTooltip}`);
    tooltipEls.forEach((el) => {
      const tooltipEl = el as HTMLElement;
      tooltipEl.style.display = 'none';
      tooltipEl.style.visibility = 'hidden';
    });

    try {
      // Lazy-load heavy PDF deps with retry for chunk loading failures
      const loadWithRetry = async <T,>(importFn: () => Promise<T>, retries: number = 2): Promise<T> => {
        for (let i = 0; i <= retries; i++) {
          try {
            return await importFn();
          } catch (e) {
            if (i === retries) throw e;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        return importFn();
      };
      const [{ default: html2canvas }, jsPdfModule] = await Promise.all([
        loadWithRetry(() => import('html2canvas')),
        loadWithRetry(() => import('jspdf')),
      ]);
      const jsPDF = resolveJsPdfConstructor(jsPdfModule);

      // Capture full element
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        backgroundColor: FIXED_MEDIA_LIGHT,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: input.scrollWidth,
        windowHeight: input.scrollHeight,
        ignoreElements: (el) => el.classList && el.classList.contains(styles.pdfIgnore),
      });

      // Build multi-page A4 in points, compressed JPEG to reduce size
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgData = canvas.toDataURL('image/jpeg', 0.82);
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - imgHeight;
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(buildPolisReportPdfFilename(resolvedSessionName));
    } catch (e) {
      setErrorMessage('PDF export failed — please try refreshing the page and downloading again.');
    } finally {
      // Restore tooltips
      tooltipEls.forEach((el) => {
        const tooltipEl = el as HTMLElement;
        tooltipEl.style.display = '';
        tooltipEl.style.visibility = '';
      });

      // Restore cluster open/close state after PDF
      setClusterCollapseState(prevClusterState);

      // Restore the All Questions section to its previous state
      setAllQuestionsOpen(prevAllQuestionsOpen);

      input.classList.remove(styles.pdfMode);
      input.classList.remove(styles.pdfDesktopWidth);
      setIsPdfModeActive(false);
    }
  };

  /***************************************************************
   * Mouse move for tooltips
   ***************************************************************/
  function handleContainerMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (containerRef.current && enableTooltips) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left + 10,
        y: e.clientY - rect.top + 10,
      });
    }
  }

  /***************************************************************
   * Build question list with box plots
   ***************************************************************/
  function buildQuestionList() {
    if (!ratingMatrix || !ratingMatrix.length) {
      return (
        <p className={styles.hiddenInPdf} style={{ fontStyle: 'italic', marginLeft: '10px' }}>
          (No questions or rating matrix)
        </p>
      );
    }
    const lines = ratingMatrix.map((votes, i: number) => {
      const label = questionLabels[i] || `#${i + 1}`;
      const originalId = allQuestions[i];
      const prompt = questionPrompts[originalId] || '(No prompt)';

      const agrees = votes.filter((v) => v === 1).length;
      const disagrees = votes.filter((v) => v === -1).length;
      const unsures = votes.filter((v) => v === 0).length;
      const noresp = votes.filter((v) => v === null || v === undefined).length;
      const total = votes.length;

      return (
        <div
          key={i}
          style={{
            marginBottom: '6px',
            borderBottom: '1px solid var(--ce-document-border)',
            paddingBottom: '6px',
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
            {label}: {prompt}
          </div>
          {/* UPDATED: Added className for mobile styling */}
          <div className={styles.questionVoteRow}>
            <span style={{ fontSize: '0.8rem', marginRight: '8px' }}>
              <strong>Agree:</strong> {agrees} / <strong>Disagree:</strong> {disagrees} / <strong>Unsure:</strong>{' '}
              {unsures} / (Total: {total})
            </span>
            <QuestionStanceBar votes={votes} />
          </div>
        </div>
      );
    });

    return <div style={{ marginTop: 10 }}>{lines}</div>;
  }

  /***************************************************************
   * NEW: Build "List of Participants" with blockies + full address
   ***************************************************************/
  const blockieCacheRef = useRef<StringMap>({});
  function getBlockieFor(addr: unknown) {
    const key = String(addr || '').toLowerCase();
    if (!blockieCacheRef.current[key]) {
      blockieCacheRef.current[key] = generateBlockieDataUrl(key, 8, 4);
    }
    return blockieCacheRef.current[key];
  }

  function renderParticipantsList() {
    if (!Array.isArray(allResponders) || allResponders.length === 0) {
      return <p style={{ fontStyle: 'italic', marginLeft: '10px' }}>(No participants found.)</p>;
    }

    const hasDisplayNames = demoDisplayNames && Object.keys(demoDisplayNames).length > 0;
    const unique = getRenderableParticipantList(allResponders, demoDisplayNames);

    if (unique.length === 0) {
      return <p style={{ fontStyle: 'italic', marginLeft: '10px' }}>(No valid participant addresses.)</p>;
    }

    return (
      <div className={styles.participantsList}>
        {unique.map((addr, idx) => {
          const displayName = demoDisplayNames[addr];
          const isEth = typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
          const imgSrc = displayName ? getPolisHistoricalParticipantAvatar(displayName, addr) : getBlockieFor(addr);
          const shortAddr = getShortenedAddress(addr, false) || addr;
          const linkHref = buildPolisParticipantProfileHref({
            address: isEth ? addr : '',
            displayName,
            sessionSlug: resolvedSessionSlug,
          });
          const label = displayName || addr;
          const shortLabel = displayName || shortAddr;
          return (
            <div key={addr} className={styles.participantListItem} title={displayName || addr}>
              <span className={`${styles.showWhenPdf} ${styles.participantIndex}`}>{idx + 1}.</span>
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt=""
                  width={24}
                  height={24}
                  className={styles.participantBlockie}
                  data-testid={displayName ? `ce-polis-participant-avatar-${displayName}` : undefined}
                  onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
                    const fallbackSrc = displayName
                      ? getPolisHistoricalParticipantBlockie(displayName, addr)
                      : getBlockieFor(addr);
                    if (fallbackSrc && event.currentTarget.src !== fallbackSrc) {
                      event.currentTarget.src = fallbackSrc;
                    }
                  }}
                />
              ) : null}
              {linkHref ? (
                <a href={linkHref} target="_blank" rel="noopener noreferrer" className={styles.participantAddressLink}>
                  <span className={styles.participantAddressFull}>{label}</span>
                  <span className={styles.participantAddressShort}>{shortLabel}</span>
                </a>
              ) : (
                <span className={styles.participantAddressLink}>
                  <span className={styles.participantAddressFull}>{label}</span>
                  <span className={styles.participantAddressShort}>{shortLabel}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /***************************************************************
   * getVotesForQuestionInCluster
   ***************************************************************/
  function getVotesForQuestionInCluster(
    questionIndex: number,
    clusterIndex: number,
    rMatrix: RatingMatrix | null,
    assignments: number[],
  ): PolisVote[] {
    // Safely handle edge cases
    if (!rMatrix || !rMatrix.length) return [];
    if (questionIndex < 0 || questionIndex >= rMatrix.length) return [];
    if (!rMatrix[questionIndex]) return [];
    if (!assignments) return [];

    const nParticipants = rMatrix[questionIndex].length;
    const votes: PolisVote[] = [];
    for (let p = 0; p < nParticipants; p++) {
      if (assignments[p] === clusterIndex) {
        const val =
          rMatrix[questionIndex][p] !== undefined && rMatrix[questionIndex][p] !== null
            ? rMatrix[questionIndex][p]
            : null;
        votes.push(val);
      }
    }
    return votes;
  }

  /***************************************************************
   * Helpers for AI payload construction
   ***************************************************************/
  const countVotes = (votesArr: PolisVote[]) => {
    const res = { agree: 0, disagree: 0, unsure: 0, responded: 0 };
    (votesArr || []).forEach((v) => {
      if (v === 1) {
        res.agree += 1;
        res.responded += 1;
      } else if (v === -1) {
        res.disagree += 1;
        res.responded += 1;
      } else if (v === 0) {
        res.unsure += 1;
        res.responded += 1;
      }
    });
    return {
      ...res,
      agreeRate: res.responded ? +((res.agree * 100) / res.responded).toFixed(1) : 0,
      disagreeRate: res.responded ? +((res.disagree * 100) / res.responded).toFixed(1) : 0,
      unsureRate: res.responded ? +((res.unsure * 100) / res.responded).toFixed(1) : 0,
    };
  };

  const buildClusterPayload = (clusterIndex: number, uniqueClusters: number[]): UnknownRecord => {
    const clusterSize = activeClusterAssignments.filter((c) => c === clusterIndex).length;
    const totalClusters = uniqueClusters.length;
    const matrix = ratingMatrix || [];

    const reps = Array.isArray(activeRepQuestions[clusterIndex]) ? activeRepQuestions[clusterIndex].slice(0, 5) : [];
    const topStatements = reps.map((rq) => {
      const qIdx = rq.questionIndex;
      const promptKey = allQuestions[qIdx];
      const prompt = (questionPrompts[promptKey] || rq.prompt || '').trim();
      const clusterVotes = getVotesForQuestionInCluster(qIdx, clusterIndex, matrix, activeClusterAssignments);
      const overallVotes = matrix[qIdx] || [];
      return {
        label: rq.label,
        questionIndex: qIdx,
        prompt,
        cluster: countVotes(clusterVotes),
        overall: countVotes(overallVotes),
        differenceScore: rq.difference,
      };
    });

    return { clusterIndex, clusterSize, totalClusters, topStatements };
  };

  /***************************************************************
   * NEW: Analyze clusters (parallel AI calls + caching)
   * (UPDATED to pass previous names and enforce uniqueness)
   ***************************************************************/
  const handleAnalyzeClustersClick = async () => {
    try {
      if (!activeClusterAssignments || activeClusterAssignments.length === 0) return;

      const key = currentAnalysisKey;
      const uniqueClusters = Array.from(new Set(activeClusterAssignments)).sort((a, b) => a - b);
      if (uniqueClusters.length === 0) return;

      const cacheForKey = analysisCacheByKey[key] || {};
      const errorsForKey = analysisErrorsByKey[key] || {};
      const hasAllClusters = uniqueClusters.every((c) => cacheForKey[c]);
      const hasErrors = uniqueClusters.some((c) => errorsForKey[c]);
      if (hasAllClusters && !hasErrors) {
        // Already have cached results for this k – nothing to re-fetch
        return;
      }

      const clustersToAnalyze = uniqueClusters.filter((c) => !cacheForKey[c] || errorsForKey[c]);
      if (clustersToAnalyze.length === 0) return;

      // Reset start times; we'll set each cluster's start at call time
      analysisStartTimesRef.current = {};

      // Prepare fresh error bucket and mark as loading for this key
      setAnalysisErrorsByKey((prev) => ({ ...prev, [key]: {} }));
      setAnalysisLoadingKey(key);

      // Optional all-clusters context (sizes only) for the template
      const clusterSizes: NumberMap = {};
      uniqueClusters.forEach((c) => {
        clusterSizes[c] = activeClusterAssignments.filter((x) => x === c).length;
      });
      const baseAllClustersData = { clusterCount: uniqueClusters.length, sizes: clusterSizes };

      // Track names we’ve already accepted to guarantee uniqueness
      const usedNames: string[] = [];
      uniqueClusters.forEach((c) => {
        const cachedName = cacheForKey[c]?.name;
        if (cachedName) {
          usedNames.push(cachedName);
        }
      });

      // Sequentially analyze each missing/failed cluster
      for (const c of clustersToAnalyze) {
        const clusterKey = String(c);
        // Set this cluster's timer start at call time
        analysisStartTimesRef.current[clusterKey] = Date.now();

        const payload = buildClusterPayload(c, uniqueClusters);

        try {
          // Pass prior names to instruct the AI to choose a distinct title
          const allClustersDataWithNames = {
            ...baseAllClustersData,
            previousNames: usedNames.slice(),
            nameUniqueness: true,
          };

          const aiRes = await analyzeClusterOpinionsTyped(payload, allClustersDataWithNames, {
            sessionSlug: activeReportSlug,
          });

          // Enforce uniqueness in UI even if AI repeats a name
          const baseNameCandidate =
            aiRes && (aiRes.name || aiRes.short) ? String(aiRes.name || aiRes.short).trim() : '';

          let proposed = baseNameCandidate || `Group ${usedNames.length + 1}`;
          const seenLower = new Set(usedNames.map((n) => n.toLowerCase()));
          if (seenLower.has(proposed.toLowerCase())) {
            let suffix = 2;
            let candidate = `${proposed} (${suffix})`;
            while (seenLower.has(candidate.toLowerCase())) {
              suffix += 1;
              candidate = `${proposed} (${suffix})`;
            }
            proposed = candidate;
          }
          usedNames.push(proposed);

          setAnalysisCacheByKey((prev) => ({
            ...prev,
            [key]: {
              ...(prev[key] || {}),
              [clusterKey]: {
                short: String(aiRes.short || ''),
                long: String(aiRes.long || ''),
                name: proposed,
              },
            },
          }));
        } catch (err: unknown) {
          setAnalysisErrorsByKey((prev) => ({
            ...prev,
            [key]: {
              ...(prev[key] || {}),
              [clusterKey]: getErrorMessage(err, 'AI request failed'),
            },
          }));
        }
      }
    } catch (e) {
      surveyLog.error('Analyze clusters failed:', e);
    } finally {
      // Clear loading flag only after all clusters have been processed
      setAnalysisLoadingKey(null);
    }
  };

  /***************************************************************
   * renderClusterRepresentativesFor
   ***************************************************************/
  function renderClusterRepresentativesFor(clusterIndex: number) {
    if (!activeRepQuestions[clusterIndex] || !activeRepQuestions[clusterIndex].length) {
      return (
        <p style={{ marginLeft: '20px', marginTop: '6px' }}>
          No representative questions found for cluster {clusterIndex}
        </p>
      );
    }
    const arr = activeRepQuestions[clusterIndex].slice(0, 3);
    const uniqueClusters = Array.from(new Set(activeClusterAssignments)).sort((a, b) => a - b);
    const colorScale = d3Report.scaleOrdinal(POLIS_CLUSTER_COLORS);

    return (
      <div style={{ marginTop: '6px' }}>
        {arr.map((rq, idx) => {
          const qIndex = rq.questionIndex;
          const questionPrompt = rq.prompt;
          const representativeDifference = Number(rq.difference);
          const hasRepresentativeDifference =
            rq.difference !== null && rq.difference !== undefined && Number.isFinite(representativeDifference);
          const clusterVotes = getVotesForQuestionInCluster(
            qIndex,
            clusterIndex,
            ratingMatrix,
            activeClusterAssignments,
          );

          return (
            <div
              key={idx}
              style={{
                marginLeft: '20px',
                marginBottom: '8px',
                borderLeft: '2px solid var(--ce-document-border)',
                paddingLeft: '8px',
              }}
            >
              <strong>{rq.label}</strong>: {questionPrompt} <br />
              <small style={{ color: 'var(--ce-document-text-muted)' }}>
                {hasRepresentativeDifference
                  ? `(${rq.repfulFor === 'disagree' ? 'disagreement' : 'agreement'} rate differs from the overall conversation by ${(representativeDifference * 100).toFixed(1)} percentage points)`
                  : '(difference from the overall conversation is unavailable)'}
              </small>
              <div style={{ marginTop: '4px' }}>
                <QuestionStanceBar votes={clusterVotes} />
              </div>
              {/* Compare all other clusters */}
              <div style={{ marginTop: '6px', marginBottom: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {uniqueClusters.map((cl) => {
                    if (cl === clusterIndex) return null;
                    const otherClusterVotes = getVotesForQuestionInCluster(
                      qIndex,
                      cl,
                      ratingMatrix,
                      activeClusterAssignments,
                    );
                    const clusterColor = colorScale(cl);
                    return (
                      <div
                        key={cl}
                        style={{
                          border: `1px solid ${clusterColor}`,
                          padding: '4px',
                        }}
                      >
                        <div
                          style={{
                            color: clusterColor,
                            fontWeight: 'bold',
                            marginBottom: '4px',
                          }}
                        >
                          Cluster {cl}
                        </div>
                        <QuestionStanceBar votes={otherClusterVotes} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /***************************************************************
   * buildClusterHulls
   ***************************************************************/
  function buildClusterHulls(points: PolisPoint[], assignments: number[]) {
    const grouped: Record<string, [number, number][]> = {};
    points.forEach((pt) => {
      const cl = assignments[pt.index];
      if (!grouped[cl]) grouped[cl] = [];
      grouped[cl].push([pt.x, pt.y]);
    });

    const hulls: Array<{ cluster: number; path: [number, number][] | null }> = [];
    Object.keys(grouped).forEach((clstr) => {
      const arr = grouped[clstr];
      if (arr.length < 3) {
        hulls.push({ cluster: +clstr, path: null });
        return;
      }
      const hull = d3Report.polygonHull(arr);
      hulls.push({ cluster: +clstr, path: hull });
    });
    return hulls;
  }

  /***************************************************************
   * renderClusterLegend (augmented with AI summaries + timers)
   ***************************************************************/
  function renderClusterLegend() {
    if (!activeClusterAssignments || !activeClusterAssignments.length) return null;
    const uniqueClusters = Array.from(new Set(activeClusterAssignments)).sort((a, b) => a - b);
    const colorScale = d3Report.scaleOrdinal(POLIS_CLUSTER_COLORS);

    const cacheForKey = analysisCacheByKey[currentAnalysisKey] || {};
    const errorsForKey = analysisErrorsByKey[currentAnalysisKey] || {};

    return (
      <div style={{ marginTop: '12px', marginBottom: '20px' }}>
        <strong style={{ marginRight: '6px' }}>
          Opinion Groups
          {renderTooltipReference('Groups are made of participants who voted similarly on statements.', {
            title: 'Groups are made of participants who voted similarly on statements.',
            style: { cursor: 'help', marginLeft: '4px' },
          })}
          :
        </strong>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: '6px',
          }}
        >
          {uniqueClusters.map((c) => {
            const cColor = colorScale(c);
            const clusterIsOpen = clusterCollapseState[c];
            const handleToggleCluster = () => {
              setClusterCollapseState((prev) => ({
                ...prev,
                [c]: !prev[c],
              }));
            };

            const analysis = cacheForKey[c];
            const errText = errorsForKey[c];
            const isLoadingThis = analysisLoadingKey === currentAnalysisKey && !analysis && !errText;
            const analysisState = analysis ? 'ready' : errText ? 'error' : isLoadingThis ? 'loading' : 'idle';
            const startedAt = analysisStartTimesRef.current?.[c];
            const elapsed = formatElapsed(startedAt); // analysisTicker used to re-render
            const shouldRenderAnalysisState = isLoadingThis || !!analysis || !!errText;

            const nameSuffix = analysis?.name ? `: ${analysis.name}` : '';

            return (
              <div
                key={c}
                style={{
                  marginBottom: '8px',
                  border: '1px dashed var(--ce-document-border)',
                  padding: '6px',
                }}
              >
                <div
                  onClick={handleToggleCluster}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <svg width={16} height={16} className={styles.clusterSwatchSvg}>
                      <circle cx={8} cy={8} r={6} fill={cColor} />
                    </svg>
                    <span style={{ marginLeft: '4px', fontWeight: 'bold' }}>
                      Cluster {c}
                      {nameSuffix}
                    </span>
                  </div>
                  <FontAwesomeIcon icon={clusterIsOpen ? faMinusSquare : faPlusSquare} style={{ marginRight: '8px' }} />
                </div>

                {/* NEW: AI Analysis Summary / Spinner / Error */}
                {shouldRenderAnalysisState && (
                  <div
                    className={styles.clusterAnalysis}
                    data-testid={E2E_TESTIDS.POLIS_CLUSTER_ANALYSIS}
                    data-ce-cluster-index={String(c)}
                    data-ce-analysis-state={analysisState}
                  >
                    {isLoadingThis && (
                      <div className={styles.clusterAnalysisRow}>
                        <FontAwesomeIcon icon={faSpinner} spin className={styles.analysisSpinner} />
                        <span className={styles.elapsedTimer} aria-live="polite">
                          {elapsed}
                        </span>
                        <span className={styles.analysisNote}>Analyzing group...</span>
                      </div>
                    )}
                    {analysis && (
                      <div className={styles.clusterAnalysisText}>
                        <div className={styles.clusterAnalysisShort}>&quot;{analysis.short}&quot;</div>
                        <div className={styles.clusterAnalysisLong}>{analysis.long}</div>
                      </div>
                    )}
                    {errText && !analysis && (
                      <div className={styles.clusterAnalysisError}>Couldn’t analyze this cluster: {errText}</div>
                    )}
                  </div>
                )}

                {clusterIsOpen ? (
                  renderClusterRepresentativesFor(c)
                ) : (
                  <div style={{ marginLeft: '20px', marginTop: '6px' }}>
                    <em className={styles.showWhenPdf}>Omitted</em>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /***************************************************************
   * renderParticipantGraph (UPDATED hover + links + showAddresses)
   ***************************************************************/
  function renderParticipantGraph() {
    try {
      const pointsToUse = activeParticipantCoords;
      const matrix = ratingMatrix || [];

      if (!pointsToUse || !pointsToUse.length) {
        return (
          <p
            className={styles.hiddenInPdf}
            style={{ fontStyle: 'italic', marginLeft: '10px', color: 'var(--ce-status-danger-text)' }}
          >
            (Not enough participant data to plot.)
          </p>
        );
      }

      const statementPoints = showComments ? activeStatementCoords : [];
      const allXs = pointsToUse.map((d) => d.x).concat(statementPoints.map((d) => d.x));
      const allYs = pointsToUse.map((d) => d.y).concat(statementPoints.map((d) => d.y));

      const minx = d3Report.min(allXs) ?? 0;
      const maxx = d3Report.max(allXs) ?? 1;
      const miny = d3Report.min(allYs) ?? 0;
      const maxy = d3Report.max(allYs) ?? 1;

      const w = 500;
      const h = 400;
      const pad = 40;
      const xScale = d3Report
        .scaleLinear()
        .domain([minx, maxx])
        .range([-(w / 2 - pad), w / 2 - pad]);
      const yScale = d3Report
        .scaleLinear()
        .domain([miny, maxy])
        .range([h / 2 - pad, -(h / 2 - pad)]);

      const hulls = buildClusterHulls(pointsToUse, activeClusterAssignments);
      const colorScale = d3Report.scaleOrdinal(POLIS_CLUSTER_COLORS);

      const centerX = w / 2;
      const centerY = h / 2;

      const isDemoLike = effectiveUseDemoData || onePageDemo || demoMode;

      return (
        <div className={styles.graphItem}>
          <svg
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`} // UPDATED: Added viewBox for responsiveness
            className={styles.participantSvg}
          >
            <g transform={`translate(${centerX}, ${centerY})`}>
              {showRadialAxes && (
                <g>
                  <circle
                    strokeWidth={1}
                    stroke="var(--ce-document-border)"
                    fill="var(--ce-document-surface)"
                    r={Math.min(w, h) / 2.3}
                  />
                  <circle
                    strokeWidth={1}
                    stroke="var(--ce-document-border)"
                    fill="var(--ce-document-canvas)"
                    r={Math.min(w, h) / 4}
                  />
                  <circle
                    strokeWidth={1}
                    stroke="var(--ce-document-border)"
                    fill="var(--ce-document-surface)"
                    r={Math.min(w, h) / 8}
                  />
                </g>
              )}

              {showAxes && (
                <g>
                  <line
                    x1={-(w / 2) + pad}
                    y1={0}
                    x2={w / 2 - pad}
                    y2={0}
                    stroke="var(--ce-document-text)"
                    strokeWidth={1}
                  />
                  <line
                    x1={0}
                    y1={-(h / 2) + pad}
                    x2={0}
                    y2={h / 2 - pad}
                    stroke="var(--ce-document-text)"
                    strokeWidth={1}
                  />
                </g>
              )}

              {showGroupOutline &&
                hulls.map((hullObj, i) => {
                  if (!hullObj.path) return null;
                  const cColor = colorScale(hullObj.cluster); // BUGFIX: reuse existing colorScale; do not re-instantiate
                  const lineGenerator = d3Report.line();
                  const pathStr = lineGenerator(hullObj.path.map((pt) => [xScale(pt[0]), yScale(pt[1])])) + 'Z';
                  return (
                    <path
                      key={i}
                      d={pathStr}
                      fill={cColor}
                      fillOpacity={0.1}
                      stroke={cColor}
                      strokeOpacity={0.7}
                      strokeWidth={1}
                    />
                  );
                })}

              {showParticipants &&
                pointsToUse.map((d, i) => {
                  const c = activeClusterAssignments[d.index] ?? 0;
                  const col = colorScale(c);
                  const px = xScale(d.x);
                  const py = yScale(d.y);
                  const addr = allResponders?.[d.index];
                  const isEth = typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
                  const displayName = demoDisplayNames?.[addr];
                  const hasLink = isEth || !!displayName;
                  const linkHref = buildPolisParticipantProfileHref({
                    address: addr,
                    displayName,
                    sessionSlug: resolvedSessionSlug,
                  });
                  const linkLabel = displayName || getShortenedAddress(addr, false);
                  const historicalAvatar = displayName ? getPolisHistoricalParticipantAvatar(displayName, addr) : '';

                  const textShort = displayName
                    ? showAddresses
                      ? displayName
                      : null
                    : isEth && showAddresses
                      ? getShortenedAddress(addr, false)
                      : null;

                  return (
                    <g key={i}>
                      <circle
                        cx={px}
                        cy={py}
                        r={5}
                        fill={col}
                        style={{ cursor: hasLink ? 'pointer' : 'default' }}
                        onMouseEnter={() => {
                          if (!enableTooltips) return;
                          cancelTooltipHide();

                          if (hasLink) {
                            setHoveredContent(
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {historicalAvatar ? (
                                  <img
                                    src={historicalAvatar}
                                    alt=""
                                    width={26}
                                    height={26}
                                    style={{ borderRadius: '8px', flexShrink: 0 }}
                                  />
                                ) : null}
                                <div>
                                  <a
                                    href={linkHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ textDecoration: 'none', fontWeight: 600 }}
                                  >
                                    {linkLabel}
                                  </a>
                                  <div>Cluster {c}</div>
                                </div>
                              </div>,
                            );
                          } else {
                            setHoveredContent(`Cluster ${c}`);
                          }
                        }}
                        onMouseLeave={() => scheduleTooltipHide(450)}
                        onClick={() => {
                          if (hasLink) {
                            window.open(linkHref, '_blank', 'noopener');
                          }
                        }}
                      />
                      {/* Participant index label for PDF export only */}
                      {isPdfModeActive && (
                        <text
                          x={px}
                          y={py + 3}
                          textAnchor="middle"
                          fontSize="8"
                          fill={FIXED_MEDIA_LIGHT}
                          fontWeight="600"
                        >
                          {d.index + 1}
                        </text>
                      )}
                      {/* Optional text labels below points when not miniMode */}
                      {!miniMode && textShort && (
                        <text x={px} y={py + 14} textAnchor="middle" fontSize="9" fill="var(--ce-document-text)">
                          {textShort}
                        </text>
                      )}
                    </g>
                  );
                })}

              {showComments &&
                activeStatementCoords.map((d, i) => {
                  const label = questionLabels[d.index] || `#${d.index + 1}`;
                  const promptKey = allQuestions[d.index];
                  const prompt = questionPrompts[promptKey] || '(No prompt)';
                  const px = xScale(d.x);
                  const py = yScale(d.y);
                  const votesForThis = matrix[d.index] || [];
                  const agrees = votesForThis.filter((v) => v === 1).length;
                  const disagrees = votesForThis.filter((v) => v === -1).length;
                  const unsures = votesForThis.filter((v) => v === 0).length;
                  const noresps = votesForThis.filter((v) => v === null || v === undefined).length;

                  const rowVotes = matrix[d.index] || [];
                  const statementHoverContent = (
                    <div>
                      <div style={{ marginBottom: '6px' }}>
                        <strong>{label}:</strong> {prompt}
                      </div>
                      <div style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                        <strong>Agree:</strong> {agrees}, <strong>Disagree:</strong> {disagrees},{' '}
                        <strong>Unsure:</strong> {unsures}, <strong>No Resp:</strong> {noresps}
                      </div>
                      <QuestionStanceBar votes={rowVotes} />
                    </div>
                  );

                  return (
                    <circle
                      key={i}
                      cx={px}
                      cy={py}
                      r={3}
                      fill="var(--ce-document-text)"
                      onMouseEnter={() => {
                        if (enableTooltips) {
                          cancelTooltipHide();
                          setHoveredContent(statementHoverContent);
                        }
                      }}
                      onMouseLeave={() => scheduleTooltipHide(450)}
                    />
                  );
                })}
            </g>
          </svg>
        </div>
      );
    } catch (err: unknown) {
      return (
        <p style={{ color: 'var(--ce-status-danger-text)', marginLeft: '10px' }}>
          Error rendering participant graph: {getErrorMessage(err)}
        </p>
      );
    }
  }

  /***************************************************************
   * renderCommentSwarm (UPDATED to show numbers in PDF mode)
   ***************************************************************/
  function renderCommentSwarm() {
    try {
      const matrix = ratingMatrix;
      if (!matrix || !matrix.length) {
        return (
          <p className={styles.hiddenInPdf} style={{ fontStyle: 'italic', marginLeft: '10px' }}>
            (No question data for beeswarm)
          </p>
        );
      }

      if (memoizedCommentSwarmResult.error) {
        throw memoizedCommentSwarmResult.error;
      }

      const points: BeeswarmPoint[] = memoizedCommentSwarmResult.commentStats.map((item) => {
        const questionIndex = item.commentIndex;
        const questionKey = allQuestions[questionIndex];
        const label = questionLabels[questionIndex] || `#${questionIndex + 1}`;
        const prompt = questionPrompts[questionKey] || '(No prompt)';
        return {
          key: `${questionKey || 'question'}:${questionIndex}`,
          index: item.commentIndex,
          value: item.extremity,
          label: `${label}: ${prompt}`,
          agrees: item.agrees,
          disagrees: item.disagrees,
          unsure: item.unsure,
          total: item.total,
        };
      });

      if (!points.length) {
        return (
          <p className={styles.hiddenInPdf} style={{ fontStyle: 'italic', marginLeft: '10px' }}>
            (No valid report comment data)
          </p>
        );
      }

      return (
        <div className={styles.swarmLayoutContainer}>
          <BeeswarmPlot
            points={points}
            className={styles.reportBeeswarm}
            width={700}
            height={200}
            minPlotWidth={700}
            pointRadius={5}
            axisLabels={['Consensus', 'Difference']}
            ariaLabel="Question consensus and difference beeswarm"
            testIdPrefix="ce-polis-beeswarm"
            responsesAvailable={points.length > 0}
            tooltipsEnabled={enableTooltips}
            showIdleSummary={false}
            scrollContainerRef={swarmContainerRef}
            renderTooltip={(point) => {
              const cIndex = Number(point.index);
              const promptKey = allQuestions[cIndex];
              const label = questionLabels[cIndex] || `#${cIndex + 1}`;
              const rowVotes = matrix[cIndex] || [];
              const agrees = rowVotes.filter((v) => v === 1).length;
              const disagrees = rowVotes.filter((v) => v === -1).length;
              const unsures = rowVotes.filter((v) => v === 0).length;
              const prompt = questionPrompts[promptKey] || '(No prompt)';
              return (
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {label}: {prompt}
                  </div>
                  <div style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                    <strong>Agree:</strong> {agrees}, <strong>Disagree:</strong> {disagrees}, <strong>Unsure:</strong>{' '}
                    {unsures}
                  </div>
                  <QuestionStanceBar votes={rowVotes} />
                </div>
              );
            }}
            renderPointLabel={(point, index) =>
              isPdfModeActive ? (
                <text
                  x={point.x}
                  y={Number(point.y) + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fill={FIXED_MEDIA_LIGHT}
                  fontWeight="600"
                  style={{ pointerEvents: 'none' }}
                >
                  {index + 1}
                </text>
              ) : null
            }
          />
          {isSwarmScrollable && (
            <div className={styles.swarmScrollControls}>
              <button className={styles.scrollButton} onClick={() => handleSwarmScroll('left')} title="Scroll to Start">
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <button className={styles.scrollButton} onClick={() => handleSwarmScroll('right')} title="Scroll to End">
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          )}
        </div>
      );
    } catch (err: unknown) {
      return (
        <p style={{ color: 'var(--ce-status-danger-text)', marginLeft: '10px' }}>
          Error rendering Bee Swarm: {getErrorMessage(err)}
        </p>
      );
    }
  }

  /***************************************************************
   * Render Filter Info (from filterState) - Comprehensive Version
   ***************************************************************/
  function renderActiveFilters() {
    if (effectiveUseDemoData) {
      return <span>None (Demo Data Active)</span>;
    }

    if (!filterState || typeof filterState !== 'object') {
      return <span>None</span>;
    }

    const { sbtFilter, onlyVerifiedHumans, questionTypes, selectedTags, topQuestions } = filterState;

    const activeFilterElements: React.ReactNode[] = [];

    // 1. Verified Humans
    if (onlyVerifiedHumans) {
      activeFilterElements.push(
        <div key="verified">
          <strong>Only Verified Humans</strong>
        </div>,
      );
    }

    // 2. Top Questions
    if (topQuestions && topQuestions.count) {
      const topQuestionCount = String(topQuestions.count);
      const byText =
        topQuestions.by === 'responses'
          ? '# of responses'
          : topQuestions.by === 'conviction'
            ? 'conviction'
            : 'importance';
      activeFilterElements.push(
        <div key="top-questions">
          <strong>Showing:</strong> Top {topQuestionCount} by {byText}
        </div>,
      );
    }

    // 3. Question Types
    if (questionTypes && questionTypes.length > 0) {
      activeFilterElements.push(
        <div key="q-types">
          <strong>Types:</strong> {questionTypes.join(', ')}
        </div>,
      );
    }

    // 4. Selected Tags
    if (selectedTags && selectedTags.length > 0) {
      activeFilterElements.push(
        <div key="tags">
          <strong>Tags:</strong> {selectedTags.map((t) => `#${t}`).join(', ')}
        </div>,
      );
    }

    // 5. SBT Filters
    const renderSBTList = (sbtArr: PolisSbtSelection[]) =>
      sbtArr.map((sbt) => sbt.name || `${sbt.address.slice(0, 6)}...`).join(', ');

    if (sbtFilter) {
      if (sbtFilter.selectedSBTGroupsCreator?.length) {
        activeFilterElements.push(
          <div key="sbt-c-in">
            <strong>Creator Include:</strong> {renderSBTList(sbtFilter.selectedSBTGroupsCreator)}
          </div>,
        );
      }
      if (sbtFilter.excludedSBTGroupsCreator?.length) {
        activeFilterElements.push(
          <div key="sbt-c-ex">
            <strong>Creator Exclude:</strong> {renderSBTList(sbtFilter.excludedSBTGroupsCreator)}
          </div>,
        );
      }
      if (sbtFilter.selectedSBTGroupsResponder?.length) {
        activeFilterElements.push(
          <div key="sbt-r-in">
            <strong>Responder Include:</strong> {renderSBTList(sbtFilter.selectedSBTGroupsResponder)}
          </div>,
        );
      }
      if (sbtFilter.excludedSBTGroupsResponder?.length) {
        activeFilterElements.push(
          <div key="sbt-r-ex">
            <strong>Responder Exclude:</strong> {renderSBTList(sbtFilter.excludedSBTGroupsResponder)}
          </div>,
        );
      }
      // Handle single-role 'addresses' mode from older filter structures for compatibility
      if (sbtFilter.selectedSBTGroups?.length) {
        activeFilterElements.push(
          <div key="sbt-a-in">
            <strong>Include:</strong> {renderSBTList(sbtFilter.selectedSBTGroups)}
          </div>,
        );
      }
      if (sbtFilter.excludedSBTGroups?.length) {
        activeFilterElements.push(
          <div key="sbt-a-ex">
            <strong>Exclude:</strong> {renderSBTList(sbtFilter.excludedSBTGroups)}
          </div>,
        );
      }
    }

    // Handle the old `sbtFilterString` for basic backward compatibility if `filterState` is simple
    if (activeFilterElements.length === 0 && sbtFilterString) {
      return <span>{sbtFilterString}</span>;
    }

    if (activeFilterElements.length === 0) {
      return <span>None</span>;
    }

    return <div className={styles.filterList}>{activeFilterElements}</div>;
  }

  /***************************************************************
   * Loading flag (component always renders; content spinners inline)
   ***************************************************************/
  // When Demo Data is active, bypass cache readiness gates so the report renders deterministically.
  const hasRenderableReport = !!stats;
  const isModernStyle = reportStyle === 'modern';
  const isDarkStyle = reportStyle === 'dark';
  const sessionInfoText =
    typeof resolvedSessionInfo === 'string' ? resolvedSessionInfo : JSON.stringify(resolvedSessionInfo) || '';
  const hydrateDiscovered = Math.max(0, Number(scopedQuestionScanProgress?.discoveredQuestions || 0));
  const hydrateDone = Math.max(0, Number(scopedQuestionScanProgress?.hydratedQuestions || 0));
  const isHydratingLoading = scopedQuestionScanProgress?.phase === 'hydrate';
  const hasHydrateProgressDetails = isHydratingLoading && hydrateDiscovered > 0;
  const hasCompletedScopedBlockScan =
    scopedQuestionScanProgress?.phase === 'scan' &&
    loadingScanProgress.requestedTotalBlocks > 0 &&
    loadingScanProgress.remainingBlocks === 0 &&
    loadingScanProgress.percentComplete >= 100;
  const isRefreshing =
    !effectiveUseDemoData && !hasCompletedScopedBlockScan && (!isQuestionCacheReady || !isResponsesCacheReady);
  const isLoading = isRefreshing && !hasRenderableReport;
  const showLoadingProgress = isLoading && (loadingScanProgress.requestedTotalBlocks > 0 || isHydratingLoading);
  const showLoadingProgressDetails = !isHydratingLoading || hasHydrateProgressDetails;
  const loadingProgressPercent = isHydratingLoading
    ? hydrateDiscovered > 0
      ? Math.round((Math.min(hydrateDone, hydrateDiscovered) / hydrateDiscovered) * 100)
      : 0
    : loadingScanProgress.percentComplete;
  const loadingProgressStatusText = isHydratingLoading ? 'Loading report data' : 'Scanning session blocks';
  const loadingProgressLeftText = isHydratingLoading
    ? `${Math.max(0, hydrateDiscovered - Math.min(hydrateDone, hydrateDiscovered))} items left`
    : loadingScanProgress.metaLeftText;
  const loadingProgressRightText = isHydratingLoading
    ? `${Math.min(hydrateDone, hydrateDiscovered)} / ${hydrateDiscovered}`
    : loadingScanProgress.metaRightText;

  /***************************************************************
   * Render
   ***************************************************************/
  return (
    <div
      className={`${styles.polisReportContainer} ${isModernStyle ? styles.polisReportModern : ''} ${isDarkStyle ? styles.polisReportDark : ''}`}
      data-testid={E2E_TESTIDS.POLIS_REPORT_ROOT}
      ref={containerRef}
      onMouseMove={handleContainerMouseMove}
    >
      {/* The gear icon to toggle top settings row */}
      <div
        style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}
      >
        {isRefreshing && hasRenderableReport && (
          <div
            aria-label="Refreshing report"
            title="Refreshing report"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--ce-panel-text-muted)',
              fontSize: '0.9rem',
            }}
          >
            <FontAwesomeIcon icon={faSpinner} spin />
            <span>Refreshing</span>
          </div>
        )}
        <button
          type="button"
          data-testid={E2E_TESTIDS.POLIS_SETTINGS_TOGGLE}
          aria-label={showSettingsRow ? 'Hide report settings' : 'Show report settings'}
          onClick={() => setShowSettingsRow(!showSettingsRow)}
          title="Toggle settings row"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            marginRight: '10px',
            color: 'inherit',
          }}
        >
          <FontAwesomeIcon icon={faCog} style={{ fontSize: '1.3rem' }} />
        </button>
      </div>

      {showSettingsRow && (
        <div className={`${styles.pdfIgnore} ${styles.settingsRow}`}>
          <div style={{ marginRight: '12px', position: 'relative' }}>
            <button
              onClick={handleDownloadPDF}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                marginRight: '4px',
              }}
              onMouseEnter={() => {
                if (enableTooltips) {
                  cancelTooltipHide();
                  setHoveredContent('Downloads only the currently open sections of this report as a PDF');
                }
              }}
              onMouseLeave={() => scheduleTooltipHide(400)}
              title="Download the currently open sections of the report"
            >
              Download as PDF {enableTooltips && <FontAwesomeIcon icon={faInfoCircle} style={{ marginLeft: '4px' }} />}
            </button>
          </div>

          <div style={{ marginRight: '12px' }}>
            <label className={styles.demoToggleLabel} style={{ marginRight: '10px' }}>
              <input
                type="checkbox"
                data-testid={E2E_TESTIDS.POLIS_DEMO_DATA_TOGGLE}
                checked={effectiveUseDemoData}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setUseDemoData(e.target.checked);
                }}
                className={styles.demoToggleCheckbox}
              />
              Demo Data
            </label>
          </div>

          <div style={{ marginRight: '12px' }}>
            <label className={styles.demoToggleLabel} style={{ marginRight: '5px' }}>
              <input
                type="checkbox"
                checked={enableTooltips}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnableTooltips(e.target.checked)}
                style={{ marginRight: '4px', cursor: 'pointer' }}
              />
              Show Explainers
            </label>
          </div>

          <div style={{ marginRight: '12px' }}>
            <label className={styles.demoToggleLabel} htmlFor="report-style-select" style={{ marginRight: '6px' }}>
              Report style:
            </label>
            <select
              id="report-style-select"
              className={styles.reportStyleSelect}
              value={reportStyle}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReportStyle(e.target.value)}
            >
              <option value="original">Original</option>
              <option value="modern">Modern</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div style={{ marginRight: '12px' }}>
            <button onClick={handleCollapseAll} style={{ marginRight: '4px' }}>
              Collapse All
            </button>
            <button onClick={handleExpandAll} style={{ marginRight: '8px' }}>
              Expand All
            </button>
          </div>
        </div>
      )}

      {/* --- Start Report Content --- */}
      <div
        ref={reportRef}
        className={`${styles.reportInner} ${isModernStyle ? styles.reportInnerModern : ''} ${isDarkStyle ? styles.reportInnerDark : ''}`}
      >
        {/* --- ORGANIZATION BRANDING SECTION --- */}
        <div className={styles.brandingHeader}>
          {/* {sessionHeader && (
            <img
              src={sessionHeader}
              alt={`${resolvedSessionName || 'Session'} Header`}
              className={styles.orgHeaderImage} // Use CSS class for styling
            />
          )}
          {resolvedSessionName && (
            <h3 className={styles.orgReportTitle}>
              {resolvedSessionName} - Context Engine Report
            </h3>
          )} */}
          {!!resolvedSessionInfo && <p className={styles.sessionInfo}>{sessionInfoText}</p>}
        </div>
        {/* --- END ORGANIZATION BRANDING SECTION --- */}

        {/* Heading with link only in PDF mode */}
        {isPdfModeActive ? (
          <h4 className={styles.heading}>
            {/* <a href="https://contextengine.sh" target="_blank" rel="noopener noreferrer">
              Context Engine
            </a> Report  */}
            {/* (Pol.is Style) */}
          </h4>
        ) : (
          <h4 className={styles.heading}>
            {/* Context Engine Report  */}
            {/* (Pol.is Style) */}
          </h4>
        )}

        {disclaimersActive && (
          <div className={styles.disclaimerBox}>
            <strong>Note:</strong> Only non-encrypted, binary (Agree/Disagree/Unsure) responses have been considered in
            this Polis-inspired report.
          </div>
        )}

        {errorMessage && (
          <div style={{ color: 'var(--ce-status-danger-text)', marginBottom: '10px', fontWeight: 'bold' }}>
            Error: {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className={styles.loadingState}>
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              size="4x"
              aria-label="Loading report"
              className={styles.loadingSpinner}
            />
            {showLoadingProgress && (
              <div className={styles.loadingProgressWrap}>
                <div className={styles.loadingProgressLabel}>{loadingProgressStatusText}</div>
                {showLoadingProgressDetails && (
                  <>
                    <div className={styles.loadingProgressMeta}>
                      <span>{loadingProgressLeftText}</span>
                      <span>{loadingProgressRightText}</span>
                    </div>
                    <div
                      className={styles.loadingProgressBar}
                      role="progressbar"
                      aria-label="Polis report loading progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={loadingProgressPercent}
                      data-testid={E2E_TESTIDS.POLIS_REPORT_LOADING_PROGRESS}
                    >
                      <div className={styles.loadingProgressFill} style={{ width: `${loadingProgressPercent}%` }} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : !stats ? (
          <p className={styles.noData}>No non-encrypted binary responses found, or no Demo data loaded.</p>
        ) : (
          <>
            <div className={styles.sectionCollapse}>
              <div
                className={styles.sectionHeaderRow}
                style={{ width: '100%', cursor: 'pointer' }}
                onClick={() => setStatsOpen(!statsOpen)}
              >
                <h5 className={`${styles.sectionHeader} ${styles.sectionTitle}`}>
                  <FontAwesomeIcon icon={faCaretUp} style={{ marginRight: '6px' }} />
                  Summary and Statistics
                </h5>
                <div className={styles.pdfIgnore} style={{ textAlign: 'right', flex: '1' }}>
                  <PolisReportSectionToggleLabel open={statsOpen} />
                </div>
              </div>
              {statsOpen ? (
                <div className={styles.statsSectionCollapsible}>
                  <div className={styles.statsSection}>
                    <div className={styles.statsRow}>
                      <div className={styles.statsItem}>
                        <span className={styles.statLabel}>
                          Participants
                          {renderTooltipReference('Participants who voted or wrote statements in the conversation.')}:
                        </span>
                        <span className={styles.statValue}>{stats.nParticipants}</span>
                      </div>
                      <div className={styles.statsItem}>
                        <span className={styles.statLabel}>
                          Statements
                          {renderTooltipReference(
                            'Number of statements (questions) with a binary vote option available.',
                          )}
                          :
                        </span>
                        <span className={styles.statValue}>{stats.nComments}</span>
                      </div>
                      <div className={styles.statsItem}>
                        <span className={styles.statLabel}>
                          Votes
                          {renderTooltipReference(
                            'Total agree or disagree clicks recorded across all statements by participants.',
                          )}
                          :
                        </span>
                        <span className={styles.statValue}>{stats.totalVotes}</span>
                      </div>
                      <div className={styles.statsItem}>
                        <span className={styles.statLabel}>
                          Votes/Voter Avg
                          {renderTooltipReference('The average number of vote actions each participant made.')}:
                        </span>
                        <span className={styles.statValue}>{stats.votesPerVoterAvg.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className={styles.statsRow}>
                      <div className={styles.statsItem}>
                        <span className={styles.statLabel}>
                          Active Filters
                          {renderTooltipReference('Summary of all active filters applied to this data.')}:
                        </span>
                        <div className={styles.statValue}>{renderActiveFilters()}</div>
                      </div>
                    </div>

                    {/* Added row for network and block info */}
                    <div className={styles.statsRow}>
                      {hasBlockchainContext ? (
                        <div className={styles.statsItem}>
                          <span className={styles.statLabel}>Blockchain:</span>
                          <span className={styles.statValue}>
                            {formatBlockchainNetworkLabel(network, networkChainId)}
                          </span>
                        </div>
                      ) : null}
                      <div className={styles.statsItem}>
                        <span className={styles.statLabel}>Timestamp:</span>
                        <span className={styles.statValue}>{getUTCDataTimestamp()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* CONSENSUS SECTION */}
            <div className={styles.sectionCollapse}>
              <div
                className={styles.sectionHeaderRow}
                style={{ width: '100%', cursor: 'pointer' }}
                onClick={() => setBeeswarmOpen(!beeswarmOpen)}
              >
                <h5 className={`${styles.sectionHeader} ${styles.sectionTitle}`}>
                  <FontAwesomeIcon icon={beeswarmOpen ? faCaretUp : faCaretDown} style={{ marginRight: '6px' }} />
                  Consensus and Difference
                </h5>
                <div className={styles.pdfIgnore} style={{ textAlign: 'right', flex: '1' }}>
                  <PolisReportSectionToggleLabel open={beeswarmOpen} />
                </div>
              </div>
              {beeswarmOpen ? <div className={styles.graphSection}>{renderCommentSwarm()}</div> : null}
            </div>

            {/* PARTICIPANTS + STATEMENTS GRAPH */}
            <div className={styles.sectionCollapse}>
              <div
                className={styles.sectionHeaderRow}
                style={{ width: '100%', cursor: 'pointer' }}
                onClick={() => setParticipantsGraphOpen(!participantsGraphOpen)}
              >
                <h5 className={`${styles.sectionHeader} ${styles.sectionTitle}`}>
                  <FontAwesomeIcon
                    icon={participantsGraphOpen ? faCaretUp : faCaretDown}
                    style={{ marginRight: '6px' }}
                  />
                  Participants Graph
                  {renderTooltipReference(PARTICIPANTS_GRAPH_TOOLTIP_TEXT, {
                    ariaLabel: 'Participants graph view details',
                  })}
                </h5>
                <div className={styles.pdfIgnore} style={{ textAlign: 'right', flex: '1' }}>
                  <PolisReportSectionToggleLabel open={participantsGraphOpen} />
                </div>
              </div>
              {participantsGraphOpen ? (
                <>
                  <div className={styles.participantGraphControls}>
                    <div className={styles.controlGroup}>
                      <label htmlFor="embedding-choice-select">
                        Embedding:
                        {renderTooltipReference(REPORT_DEFAULT_EMBEDDING_TOOLTIP_TEXT)}
                      </label>
                      <select
                        id="embedding-choice-select"
                        value={embeddingChoice}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          handleEmbeddingChoiceChange(e.target.value as EmbeddingChoice)
                        }
                        style={{ padding: '4px' }}
                      >
                        <option value="UMAP">UMAP</option>
                        <option value="SVD">SVD/PCA</option>
                        <option value="POLIS">{REPORT_DEFAULT_EMBEDDING_LABEL}</option>
                      </select>
                    </div>

                    <div className={styles.controlGroup}>
                      <label>
                        Opinion groups:
                        {renderTooltipReference(OPINION_GROUPS_TOOLTIP_TEXT)}
                      </label>
                      <div className={styles.numberInputWrapper}>
                        <button
                          className={styles.stepperButton}
                          onClick={() => stepManualClusterCount(-1)}
                          aria-label="Decrease cluster count"
                        >
                          -
                        </button>
                        <input
                          id="cluster-count-input"
                          type="number"
                          value={manualClusterCount === '' ? String(activeClusterCount || 0) : manualClusterCount}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleManualClusterCountChange(e.target.value)
                          }
                          onBlur={handleManualClusterCountBlur}
                          className={styles.clusterNumberInput}
                          min="2"
                        />
                        <button
                          className={styles.stepperButton}
                          onClick={() => stepManualClusterCount(1)}
                          aria-label="Increase cluster count"
                        >
                          +
                        </button>
                        <button type="button" onClick={() => setManualClusterCount('')} style={{ marginLeft: '6px' }}>
                          Auto
                        </button>
                      </div>
                    </div>

                    <div className={styles.controlGroup} style={{ flexBasis: '100%' }}>
                      <label style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showComments && embeddingChoice === 'SVD'}
                          onChange={() => {
                            if (showComments && embeddingChoice === 'SVD') {
                              setShowComments(false);
                              return;
                            }
                            if (embeddingChoice !== 'SVD') {
                              handleEmbeddingChoiceChange('SVD');
                            }
                            setShowComments(true);
                          }}
                          style={{ marginRight: '4px' }}
                        />
                        Statements
                      </label>

                      <label style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showParticipants}
                          onChange={() => setShowParticipants(!showParticipants)}
                          style={{ marginRight: '4px' }}
                        />
                        Participants
                      </label>

                      {/* NEW: toggle for addresses (disabled in demo) */}
                      {/* <label style={{ cursor: (useDemoData || onePageDemo || demoMode) ? 'not-allowed' : 'pointer', opacity: (useDemoData || onePageDemo || demoMode) ? 0.6 : 1 }}>
                        <input
                          type="checkbox"
                          checked={showAddresses && !(useDemoData || onePageDemo || demoMode)}
                          onChange={(e) => setShowAddresses(e.target.checked)}
                          disabled={useDemoData || onePageDemo || demoMode}
                          style={{ marginRight: '4px' }}
                        />
                        Show addresses
                      </label> */}

                      <label style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showGroupOutline}
                          onChange={() => setShowGroupOutline(!showGroupOutline)}
                          style={{ marginRight: '4px' }}
                        />
                        Outline
                      </label>

                      <label style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showAxes}
                          onChange={() => setShowAxes(!showAxes)}
                          style={{ marginRight: '4px' }}
                        />
                        Axes
                      </label>

                      <label style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showRadialAxes}
                          onChange={() => setShowRadialAxes(!showRadialAxes)}
                          style={{ marginRight: '4px' }}
                        />
                        Radial Axes
                      </label>
                    </div>
                  </div>

                  <div className={styles.graphSection}>{renderParticipantGraph()}</div>

                  <div className={styles.pdfIgnore}>
                    <button onClick={handleCollapseAllClusters} style={{ marginRight: '10px' }}>
                      Collapse Clusters
                    </button>
                    <button onClick={handleExpandAllClusters}>Expand Clusters</button>
                    {/* NEW: Analyze clusters button */}
                    <button
                      className={styles.analyzeClustersBtn}
                      onClick={handleAnalyzeClustersClick}
                      disabled={!!analysisLoadingKey}
                      data-testid={E2E_TESTIDS.POLIS_ANALYZE_CLUSTERS}
                      title="Use AI to summarize each cluster’s unique viewpoint"
                      style={{ marginLeft: '10px' }}
                    >
                      {analysisLoadingKey ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin className={styles.analysisSpinner} />
                          <span>Analyzing…</span>
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faWand} />
                          <span>Analyze clusters</span>
                        </>
                      )}
                    </button>
                  </div>

                  {renderClusterLegend()}
                </>
              ) : (
                <div style={{ width: '900px', height: '1px', opacity: 0, pointerEvents: 'none' }} />
              )}
            </div>

            {/* ALL QUESTIONS */}
            <div className={styles.sectionCollapse}>
              <div
                className={styles.sectionHeaderRow}
                style={{ width: '100%', cursor: 'pointer' }}
                onClick={() => setAllQuestionsOpen(!allQuestionsOpen)}
              >
                <h5 className={`${styles.sectionHeader} ${styles.sectionTitle}`}>
                  <FontAwesomeIcon icon={allQuestionsOpen ? faCaretUp : faCaretDown} style={{ marginRight: '6px' }} />
                  All Questions
                </h5>
                <div className={styles.pdfIgnore} style={{ textAlign: 'right', flex: '1' }}>
                  <PolisReportSectionToggleLabel open={allQuestionsOpen} />
                </div>
              </div>
              {allQuestionsOpen ? <>{buildQuestionList()}</> : null}
            </div>

            {/* LIST OF PARTICIPANTS (NEW) – Appears directly BELOW "All Questions" */}
            <div className={styles.sectionCollapse}>
              <div
                className={styles.sectionHeaderRow}
                style={{ width: '100%', cursor: 'pointer' }}
                onClick={() => setParticipantsListOpen(!participantsListOpen)}
              >
                <h5 className={`${styles.sectionHeader} ${styles.sectionTitle}`}>
                  <FontAwesomeIcon
                    icon={participantsListOpen ? faCaretUp : faCaretDown}
                    style={{ marginRight: '6px' }}
                  />
                  List of Participants
                </h5>
                <div className={styles.pdfIgnore} style={{ textAlign: 'right', flex: '1' }}>
                  <PolisReportSectionToggleLabel open={participantsListOpen} />
                </div>
              </div>
              {participantsListOpen ? renderParticipantsList() : null}
            </div>

            {footnoteTexts.length > 0 && (
              <div className={`${styles.showWhenPdf} ${styles.footnotesSection}`}>
                <h5 className={styles.footnotesHeading}>Footnotes</h5>
                <ol className={styles.footnotesList}>
                  {footnoteTexts.map((text, index) => (
                    <li key={`polis-footnote-${index + 1}`}>{text}</li>
                  ))}
                </ol>
              </div>
            )}

            {liveReportUrl && (
              <div className={`${styles.showWhenPdf} ${styles.pdfFooter}`}>
                <div className={styles.pdfFooterQr}>
                  <QRCodeSVG
                    value={liveReportUrl}
                    size={128}
                    bgColor={FIXED_MEDIA_LIGHT}
                    fgColor={FIXED_MEDIA_DARK}
                    level="Q"
                    includeMargin={true}
                  />
                </div>
                <div className={styles.pdfFooterMeta}>
                  <div className={styles.pdfFooterLabel}>Live report</div>
                  <div className={styles.pdfFooterLink}>{liveReportUrl}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* --- End Report Content --- */}

      {/* Tooltips should not appear in PDF; forcibly hidden above but also .pdfIgnore */}
      {enableTooltips && hoveredContent && (
        <div
          className={`${styles.beeTooltip} ${styles.pdfIgnore}`}
          role="tooltip"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
          }}
          onMouseEnter={cancelTooltipHide}
          onMouseLeave={() => scheduleTooltipHide(450)}
        >
          {hoveredContent}
        </div>
      )}
    </div>
  );
}
