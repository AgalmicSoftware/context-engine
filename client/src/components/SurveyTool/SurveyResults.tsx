/** @file SurveyResults.tsx */

import React, { useLayoutEffect, useReducer, useRef } from 'react';
import { connect } from 'react-redux';
import { Form, Card, CardHeader, CardBody, FormText, InputGroup, InputGroupText, Collapse } from 'reactstrap';

import '../../assets/css/contextEngine.scss';
import styles from './SurveyResults.module.scss';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretUp,
  faCaretDown,
  faCheck,
  faArrowLeft,
  faArrowRight,
  faQuestionCircle,
  faSearch,
  faExpand,
  faExclamationCircle,
} from '@fortawesome/free-solid-svg-icons';

import { getAllSessionSlugs, getSessionConfigBySlug } from '../../utilities/web3/chainGateway.js';
import { createLogger } from 'utilities/logging.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { resolveSbtDisplayLabel } from '../../utilities/sbt/sbtDisplayNames.js';
import {
  resolveSurveyResultsExplicitSessionSlug,
  resolveSurveyResultsQuestionReadScope,
  resolveSurveyResultsSessionContext,
  scanSurveyResultsSessionSlugFromCache,
} from './surveyResultsSessionResolution.js';
import { normalizeSurveyResultsBlockNumber } from './surveyResultsBlockNumbers.js';
import {
  buildSurveyResultsBookmarkedQuestionIdsPatch,
  buildSurveyResultsBookmarkedSurveyIdsPatch,
  buildSurveyResultsBooleanTogglePatch,
  buildSurveyResultsCommittedFilterStatePatch,
  buildSurveyResultsDemoAtlasOpenPatch,
  buildSurveyResultsDemoAtlasNodePatch,
  buildSurveyResultsDemoViewSelectPatch,
  buildSurveyResultsExportTypePatch,
  buildSurveyResultsFilterActivePatch,
  buildSurveyResultsFilterLoadingStatePatch,
  buildSurveyResultsFilterLoadingUpdate,
  buildSurveyResultsFilteredQuestionsCountPatch,
  buildSurveyResultsFilteredResponsesPatchPlan,
  buildSurveyResultsIndividualResponseAggregator,
  buildSurveyResultsKeyedTogglePatch,
  buildSurveyResultsQuestionIdSortPatch,
  buildSurveyResultsQuestionFilterCountPatch,
  buildSurveyResultsQuestionFilterPatch,
  buildSurveyResultsQuestionFilterQuestions,
  buildSurveyResultsRefreshStatusSequencePlan,
  buildSurveyResultsSurveyViewModePatch,
  buildSurveyResultsViewStatePatch,
  countQuestionModeResponses,
  stringifySurveyResultsAggregatorResponses,
  type SurveyResultsAggregateRow,
  type SurveyResultsFilterQuestionRecord,
  type SurveyResultsIndividualAggregator,
  type SurveyResultsStringifiedAggregator,
} from './surveyResultsHelpers.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import {
  buildSurveyResultsQuestionTableEntries,
  type SurveyResultsQuestionTableEntry,
} from './surveyResultsSummaryModels';
import {
  createInitialSurveyResultsState,
  preserveSurveyResultsFilterStateValue,
  surveyResultsReducer,
} from './surveyResultsState';
import type { SurveyResultsStateUpdate } from './surveyResultsState';
import {
  buildSurveyResultsHtmlReportAnalysisDemoReadyPatch,
  buildSurveyResultsHtmlReportAnalysisEligibilityBlockedPatch,
  buildSurveyResultsHtmlReportAnalysisErrorPatch,
  buildSurveyResultsHtmlReportAnalysisProgressPatch,
  buildSurveyResultsHtmlReportDemoModePatch,
  buildSurveyResultsHtmlReportFormatPatch,
  buildSurveyResultsHtmlReportModalClosePatch,
  buildSurveyResultsHtmlReportModalOpenPatch,
  buildSurveyResultsHtmlReportSectionTogglePatch,
} from './surveyResultsHtmlReportStatePatches.js';
import {
  buildSurveyResultsHtmlReportDownloadFailurePatch,
  buildSurveyResultsHtmlReportDownloadSuccessPatch,
} from './surveyResultsHtmlReportDownloadAttempt.js';
import type { SurveyResultsHtmlReportSectionKey } from './surveyResultsHtmlReportReadiness.js';
import { buildSurveyResultsSurveyQuestionBookmarkWritePlan } from './surveyResultsCacheWriteEligibilityPlan';
import { buildSurveyResultsBookmarksCacheReadRequest } from './surveyResultsBookmarkCacheReadPorts';
import {
  buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan,
  runSurveyResultsAnalysisGeneratedArtifactCompletion,
  type SurveyResultsAnalysisGeneratedArtifactCompletionPlan,
} from './surveyResultsAnalysisGeneratedArtifactCompletionPlan';
import { buildSurveyResultsAnalysisLifecyclePlan } from './surveyResultsAnalysisLifecyclePlan';
import {
  runSurveyResultsAnalysisLifecycleController,
  type SurveyResultsAnalysisLifecycleStatePatchPort,
} from './surveyResultsAnalysisLifecycleController';
import { runSurveyResultsSurveyQuestionBookmarkWriteController } from './surveyResultsSurveyQuestionBookmarkWriteController';
import { runSurveyResultsManualRefreshDispatchController } from './surveyResultsManualRefreshController';
import { runSurveyResultsManualRefreshStatusApplicationController } from './surveyResultsManualRefreshStatusApplicationController';
import { surveyResultsHtmlReportExporterPort } from './surveyResultsHtmlReportExporterPort';
import { surveyResultsAnalysisGenerationPort } from './surveyResultsAnalysisGenerationPort';
import { buildSurveyResultsHtmlReportDownloadExecutionPlan } from './surveyResultsHtmlReportDownloadRequest';
import { normalizeGateSbtEntries, type SurveyResultsResponseRecord } from './surveyResultsLockedFieldHelpers';
import {
  applyExistingGroupPrefix,
  areValuesEquivalentBySignature,
  getFilterStateSignature,
  getResponseQuestionId,
  getResponseQuestionPrompt,
  getResponseQuestionType,
  hasExplicitSessionQueryPinInPath,
  normalizeNonceKey,
  resolveNetBucketReadOnly,
} from './surveyResultsRuntimeHelpers';
import { buildSurveyResultsHtmlReportModalProps } from './surveyResultsHtmlReportModalProps';
import { getSurveyResultsQuestionCardDomId } from './surveyResultsQuestionSummaryStatusController';
import {
  runSurveyResultsQuestionMetadataReadController,
  type SurveyResultsQuestionMetadataReadIdentity,
} from './surveyResultsQuestionMetadataReadController';
import {
  createSurveyResultsFallbackQuestionBuckets,
  getSurveyResultsStableFallbackQuestion,
  type SurveyResultsFallbackQuestion,
  type SurveyResultsFallbackQuestionBuckets,
} from './surveyResultsFallbackQuestionHelpers';
import {
  EMPTY_SCOPED_QUESTION_NETWORK_DATA,
  runSurveyResultsQuestionNetworkAsyncReadController,
  runSurveyResultsQuestionNetworkReadController,
  type SurveyResultsQuestionBucketRecord,
  type SurveyResultsQuestionRecord,
  type SurveyResultsQuestionResponsesByQuestion,
  type SurveyResultsScopedQuestionNetworkData,
  type SurveyResultsScopedQuestionNetworkMemo,
} from './surveyResultsQuestionNetworkReadController';
import {
  applySurveyResultsBuiltInDemoQuestionMetadataFallbackToBucket,
  isSurveyResultsDemoQuestionResultsContext,
} from './surveyResultsDemoQuestionFallback';
import { createSurveyResultsInstanceFields } from './surveyResultsInstanceFields';
import { surveyResultsCachePort } from '../../domains/surveys/surveyResultsCachePort';
import { surveyResultsAnalysisArtifactMergePort } from '../../domains/surveys/surveyResultsAnalysisArtifactMergePort';
import { cryptoGatePort } from '../../domains/crypto/cryptoGatePort';
import {
  createSurveyResultsFetchResponsesRuntime,
  type SurveyResultsFetchResponsesRuntime,
} from '../../domains/surveys/surveyResultsFetchResponsesRuntime';
import {
  createSurveyResultsLocalStoragePollingRuntime,
  type SurveyResultsLocalStoragePollingRuntime,
} from '../../domains/surveys/surveyResultsLocalStoragePollingRuntime';
import {
  createSurveyResultsQueuedRefreshRuntime,
  type SurveyResultsQueuedRefreshRuntime,
} from '../../domains/surveys/surveyResultsQueuedRefreshRuntime';
import { runSurveyResultsComponentDidMount, runSurveyResultsComponentDidUpdate } from './surveyResultsLifecycleRuntime';
import { chainScanReadsPort } from '../../domains/chain/chainScanReadsPort';
import { createSurveyResultsDataExportRuntime } from './surveyResultsDataExportRuntime';
import { createSurveyResultsHtmlReportRuntime } from './surveyResultsHtmlReportRuntime';
import {
  fetchSurveyResultsQuestionModeResponses,
  fetchSurveyResultsSurveyModeResponses,
} from './surveyResultsHydrationRuntime';
import {
  maybeRefreshSurveyResultsNetworkLatestBlockFromPolling,
  pollSurveyResultsLocalStorageForUpdates,
} from './surveyResultsLocalStoragePollRuntime';
import {
  createSurveyResultsLockedResponsesRuntime,
  type SurveyResultsLockedResponsesRuntimeInstance,
} from './surveyResultsLockedResponsesRuntime';
import { renderSurveyResultsRenderSurface } from './surveyResultsRenderSurface';
import {
  buildSessionResultsAnalysisPrompt,
  SESSION_RESULTS_ANALYSIS_SECTION_KEYS,
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  type SessionResultsAnalysisSectionKey,
  type SessionResultsExportFormat,
  type SessionResultsGeneratedAnalysisArtifact,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import type { QuestionFilterHandle } from './QuestionFilter';
import { type SurveyResultsHtmlReportExportModalProps } from './SurveyResultsHtmlReportExportModal';
import SurveyResultsQuestionSummary from './SurveyResultsQuestionSummary';
import SurveyResultsQuestionTable from './SurveyResultsQuestionTable';

export {
  SURVEY_RESULTS_SORTABLE_HEADER_STYLE,
  SURVEY_RESULTS_TABLE_BOOKMARK_STYLE,
  SURVEY_RESULTS_TABLE_CELL_STYLE,
} from './SurveyResultsQuestionTable';

export { countQuestionModeResponses, hasAnyCountableSurveyAnswer } from './surveyResultsHelpers.js';

const surveyLog = createLogger('surveys');
const LATEST_BLOCK_POLL_THROTTLE_MS = 8000;
const RESPONSE_PARSE_MEMO_MAX_SIZE = 500;
const LOCAL_STORAGE_POLL_MIN_MS = 2000;
const LOCAL_STORAGE_POLL_MID_MS = 4000;
const LOCAL_STORAGE_POLL_MAX_MS = 12000;
const LOCAL_STORAGE_FORCE_RESCAN_EVERY = 6;
type SurveyResultsRecord = Record<string, unknown>;
type SurveyResultsQuestionReadScopeContext = ReturnType<typeof resolveSurveyResultsQuestionReadScope>;
type SurveyResultsSessionContext = ReturnType<typeof resolveSurveyResultsSessionContext>;
type SurveyResultsScopeContextInput = {
  props?: SurveyResultsRecord;
  state?: SurveyResultsRecord;
  viewMode?: unknown;
};
type SurveyResultsSummaryAnswerField = SurveyResultsRecord & {
  encrypted?: unknown;
  value?: unknown;
};
type SurveyResultsSummaryResponsePayload = SurveyResultsRecord & {
  additional?: SurveyResultsSummaryAnswerField | null;
  answer?: SurveyResultsSummaryAnswerField | null;
  questionType?: unknown;
  type?: unknown;
};
type SurveyResultsSummaryResponseRow = SurveyResultsAggregateRow & {
  response?: SurveyResultsSummaryResponsePayload | null;
  responder?: unknown;
};
export type SurveyResultsFilterState = SurveyResultsRecord;
type SurveyResultsQuestionFilterQuestionsMemo = {
  questionResponsesRef: unknown;
  networkQuestionsRef: unknown;
  questionResponsesNonceKey: unknown;
  questionsCacheNonceKey: unknown;
  result: SurveyResultsFilterQuestionRecord[];
};
type SurveyResultsQuestionTableEntriesMemo = {
  questionMapRef: unknown;
  networkQuestionsRef: unknown;
  sortBy: string;
  sortAsc: boolean;
  result: SurveyResultsQuestionTableEntry[];
};
type SurveyResultsPollQuestionCountMemo = {
  questionsRef: unknown;
  count: number;
};
type SurveyResultsPollSurveyResponsesCountMemo = {
  surveyId: string;
  responsesRef: unknown;
  count: number;
};
type SurveyResultsIndividualResponsesAggregatorMemo = {
  responsesRef: unknown;
  result: SurveyResultsIndividualAggregator;
};
type SurveyResultsAggregatorEntriesMemo = {
  aggregatorRef: unknown;
  entries: SurveyResultsAggregatorEntry[];
};
type SurveyResultsPolisQuestionResponsesMemo = {
  selected: boolean;
  sourceRef: unknown;
  result: SurveyResultsStringifiedAggregator | null;
};
type SurveyResultsEffectiveSlugScanMemo = {
  surveyId: string;
  nonceKey: string;
  slug: string;
};
type SurveyResultsAggregatorEntry = [string, unknown];
type SurveyResultsResponseCardClassNames = {
  aggregatorContainerClassName: string;
  aggregatorFreeformAnswerClassName: string;
  aggregatorParagraphClassName: string;
  aggregatorTextClassName: string;
  bodyClassName: string;
  containerClassName: string;
  iconButtonClassName: string;
  linksContainerClassName: string;
};
type SurveyResultsQuestionEncryptionRecord = SurveyResultsRecord & {
  enabled?: unknown;
  gate?: unknown;
  gates?: unknown;
};
type SurveyResultsQuestionWithEncryption = SurveyResultsRecord & {
  encryption?: SurveyResultsQuestionEncryptionRecord | unknown;
};
type SurveyResultsManagedCacheUpdate = {
  namespace?: unknown;
};
type SurveyResultsQuestionFilterCombinedPayload = SurveyResultsRecord & {
  filteredQuestions?: unknown;
  filteredResponsesByQuestion?: unknown;
};
type SurveyResultsResponseListEntry = SurveyResultsRecord & {
  response?: (SurveyResultsRecord & { responses?: SurveyResultsRecord[] }) | null;
  responder: string;
  surveyId?: unknown;
};
type SurveyResultsLitHooks = SurveyResultsRecord & {
  getKey?: (...args: unknown[]) => unknown;
};
type SurveyResultsDecryptedResponseOverride = SurveyResultsRecord & {
  additionalValue?: unknown;
  answerValue?: unknown;
  conviction?: unknown;
  importance?: unknown;
};
export type SurveyResultsProps = SurveyResultsRecord & {
  account?: string;
  activeSessionSlug?: string;
  defaultTags?: unknown[];
  ensureLightSbtUniverse?: unknown;
  filterState?: SurveyResultsFilterState | null;
  filteredQuestionsCount?: number | null;
  isOpen?: boolean;
  isQuestionCacheReady?: boolean;
  isResponsesCacheReady?: boolean;
  isSBTCacheReady?: boolean;
  isSurveyCacheReady?: boolean;
  lit?: SurveyResultsLitHooks | null;
  litHooks?: SurveyResultsLitHooks | null;
  loginComplete?: boolean;
  network?: (SurveyResultsRecord & { id?: unknown }) | null;
  networkChainId?: number | string | null;
  onClose?: () => void;
  onCountUpdate?: (count: unknown) => void;
  onFilterChange?: (filterState: SurveyResultsFilterState) => void;
  onFilterStateChangeForUrlUpdate?: (filterState: SurveyResultsFilterState) => void;
  preventUrlChange?: boolean;
  profile?: unknown;
  provider?: unknown;
  questionResponsesNonce?: unknown;
  questionScanProgress?: unknown;
  questionsCacheNonce?: unknown;
  refreshQuestionMetadata?: () => unknown;
  refreshQuestionResponses?: () => unknown;
  refreshSurveyResponsesByID?: (surveyId: string) => unknown;
  sbtCacheRevision?: unknown;
  sessionConfig?: unknown;
  sessionName?: string;
  sessionSlug?: string;
  sessionSlugPinned?: boolean;
  sessionState?: unknown;
  setFilterLoading?: (loading: unknown) => void;
  surveyId?: string;
  viewMode?: string;
};
export type SurveyResultsState = SurveyResultsRecord & {
  activeQuestionToggles: Record<string, boolean>;
  activeToggles: Record<string, boolean>;
  aggregateQuestionResponses: Record<string, unknown[]>;
  aggregatorQuestionResponses: Record<string, unknown[]>;
  alertMessage: string;
  bookmarkedQuestionIDs: string[];
  bookmarkedSurveyIDs: string[];
  cachedQuestionsCount: number;
  cachedSurveyResponsesCount: number;
  csvData: string;
  decryptedResponseOverrides: Record<string, SurveyResultsDecryptedResponseOverride>;
  demoResultsAtlasNodeId: string | null;
  demoResultsViewMode: string;
  exportAreaOpen: boolean;
  exportType: string;
  filterBookmarkedFeedback: boolean;
  filteredQuestionsCount: number | null;
  filteredResponsesCount: number;
  filterLoading: boolean;
  filterState: SurveyResultsFilterState;
  htmlReportAnalysisArtifact: SessionResultsGeneratedAnalysisArtifact | null;
  htmlReportAnalysisError: string;
  htmlReportAnalysisGenerating: boolean;
  htmlReportAnalysisInputSignature: string;
  htmlReportAnalysisProgress: string;
  htmlReportDemoMode: boolean;
  htmlReportExportedAt: string;
  htmlReportExportFormat: SessionResultsExportFormat;
  htmlReportModalOpen: boolean;
  htmlReportSelectedSections: Required<SessionResultsSectionSelection>;
  isFilterActive: boolean;
  loading: boolean;
  lockedResponseDetailsOpen: boolean;
  lockedResponsesDecrypting: boolean;
  networkLatestBlock: number;
  questionIdSortAsc: boolean;
  questionIdSortBy: string;
  questionLocalBlock: number;
  questionPartialLoading: boolean;
  questionPartialProgress: number;
  questionPartialTotal: number;
  questionResponses: SurveyResultsQuestionResponsesByQuestion | SurveyResultsRecord;
  questionResultsHydrated: boolean;
  refreshTargetQuestionBlock: number;
  refreshTargetResponseBlock: number;
  refreshTargetSurveyBlock: number;
  responseLocalBlock: number;
  responsePartialLoading: boolean;
  responsePartialProgress: number;
  responsePartialTotal: number;
  responses: SurveyResultsResponseListEntry[];
  sbtFilteredAggregatorQuestionResponses: Record<string, unknown>;
  sbtFilteredQuestionResponses: SurveyResultsRecord;
  sbtFilteredResponses: SurveyResultsResponseListEntry[];
  showQuestionFilter: boolean;
  surveyDocumentURLs: string[];
  surveyId: string;
  surveyLocalBlock: number;
  surveyResultsHydrated: boolean;
  surveyTitle: string;
  surveyViewMode: string;
  syncDetailsOpen: boolean;
  totalQuestionsCount: number;
  totalResponsesCount: number;
  viewMode: string;
};
type SurveyResultsSbtDisplayLabelResolver = (args: {
  address: string;
  chainId?: unknown;
  fallback?: string;
  preferredSlug?: unknown;
}) => string;
const toSurveyResultsRecord = (value: unknown): SurveyResultsRecord =>
  value && typeof value === 'object' ? (value as SurveyResultsRecord) : {};
const normalizeNextSurveyResultsFilterState = (
  nextFilterState: unknown,
  fallbackFilterState: unknown = {},
): SurveyResultsFilterState =>
  nextFilterState && typeof nextFilterState === 'object'
    ? (nextFilterState as SurveyResultsFilterState)
    : preserveSurveyResultsFilterStateValue(fallbackFilterState);
const buildSurveyResultsSbtFilterState = ({
  filterState,
  sbtFilter,
}: {
  filterState: unknown;
  sbtFilter: unknown;
}): SurveyResultsFilterState => ({
  ...toSurveyResultsRecord(filterState),
  sbtFilter,
});
const asSurveyResultsStatePatch = (patch: unknown): SurveyResultsState => patch as SurveyResultsState;
const asSurveyResultsStateUpdater = (
  updater: (prevState: SurveyResultsState) => unknown,
): ((prevState: Readonly<SurveyResultsState>) => SurveyResultsState) =>
  updater as (prevState: Readonly<SurveyResultsState>) => SurveyResultsState;
const resolveSbtDisplayLabelForSurveyResults: SurveyResultsSbtDisplayLabelResolver = (args) =>
  (resolveSbtDisplayLabel as unknown as SurveyResultsSbtDisplayLabelResolver)(args);

const HTML_REPORT_ANALYSIS_SECTION_LABELS: Record<SessionResultsAnalysisSectionKey, string> = {
  argumentMap: 'Argument Map',
  atlas: 'Atlas Nodes',
  breakdown: 'Breakdown',
  riskMatrix: 'Risk Matrix',
};
const HTML_REPORT_ANALYSIS_SECTION_MAX_TOKENS: Record<SessionResultsAnalysisSectionKey, number> = {
  argumentMap: 6000,
  atlas: 7000,
  breakdown: 5000,
  riskMatrix: 6500,
};
export const SURVEY_RESULTS_CLICKABLE_ICON_STYLE: React.CSSProperties = {
  cursor: 'pointer',
};

export const SURVEY_RESULTS_METADATA_MISSING_STYLE: React.CSSProperties = {
  fontStyle: 'italic',
  color: '#bbb',
  padding: '1rem',
};

export const SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE: React.CSSProperties = {
  marginLeft: '6px',
};

export const SURVEY_RESULTS_SURVEY_BOOKMARK_STYLE: React.CSSProperties = {
  marginLeft: '8px',
  cursor: 'pointer',
};

export const SURVEY_RESULTS_DOCUMENT_LINK_ICON_STYLE: React.CSSProperties = {
  marginRight: 4,
};

export const SURVEY_RESULTS_MINI_BAR_SPINNER_STYLE: React.CSSProperties = {
  marginRight: '6px',
};

export const SURVEY_RESULTS_MINI_PROGRESS_STYLE: React.CSSProperties = {
  minWidth: '100px',
};

export const SURVEY_RESULTS_TRAILING_LABEL_STYLE: React.CSSProperties = {
  marginLeft: '10px',
};

export const resolveSurveyResultsSyncDetailsStyle = (syncDetailsOpen: unknown): React.CSSProperties => ({
  display: syncDetailsOpen ? 'block' : undefined,
});

export const resolveSurveyResultsToggleKnobStyle = (isAggregate: unknown): React.CSSProperties => ({
  left: isAggregate ? '31px' : '1px',
  backgroundColor: isAggregate ? '#4caf50' : '#fff',
});

const scheduleMicrotask = (cb: unknown): void => {
  if (typeof cb !== 'function') return;
  const task = cb as VoidFunction;
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task);
    return;
  }
  Promise.resolve().then(task);
};

type SurveyResultsInstanceFields = {
  _syncLoadingStartedAt: number | null;
  _scrollMutationObserver: MutationObserver | null;
  _scrollToQuestionRetryTimer: ReturnType<typeof setTimeout> | null;
  _isMounted: boolean;
  _questionFilterQuestionsMemo: SurveyResultsQuestionFilterQuestionsMemo;
  _questionTableEntriesMemo: SurveyResultsQuestionTableEntriesMemo;
  _lockedResponsesModelMemo: SurveyResultsLockedResponsesRuntimeInstance['_lockedResponsesModelMemo'];
  _lastLocalStoragePollCoarseSignature: string;
  _lastLocalStoragePollDetailedSignature: string;
  _lastPolledQuestionsRef: unknown;
  _lastPolledSurveyResponsesRef: unknown;
  _lastPolledQuestionRefVersion: number;
  _lastPolledSurveyResponsesRefVersion: number;
  _pollQuestionCountMemo: SurveyResultsPollQuestionCountMemo;
  _scopedQuestionNetworkDataSyncMemo: SurveyResultsScopedQuestionNetworkMemo;
  _pollSurveyResponsesCountMemo: SurveyResultsPollSurveyResponsesCountMemo;
  _nonceTickInFlight: boolean;
  _nonceTickQueued: boolean;
  _pollLatestBlockFetchInFlight: boolean;
  _pollLatestBlockLastAttemptAt: number;
  _responseParseMemo: Map<string, unknown>;
  _surveyModeSourceSignature: string;
  _surveyModeSourceCoarseSignature: string;
  _surveyModeSourcePayloadRefSignature: string;
  _surveyModeSourceCacheNonce: number;
  _individualResponsesAggregatorMemo: SurveyResultsIndividualResponsesAggregatorMemo;
  _aggregatorEntriesMemo: SurveyResultsAggregatorEntriesMemo;
  _polisQuestionResponsesMemo: SurveyResultsPolisQuestionResponsesMemo;
  _effectiveSlugScanMemo: SurveyResultsEffectiveSlugScanMemo;
  _surveysCacheChangeNonce: number;
  _unsubscribeCacheUpdates: (() => void) | null;
  _lastNotifiedFilterStateSignature: string | null;
  _pendingFilterLoadingValue: unknown;
  _stableFallbackQuestions: SurveyResultsFallbackQuestionBuckets | null;
  csvFileName: string;
};

const SurveyResults = (props: SurveyResultsProps): React.ReactElement => {
  const [state, dispatch] = useReducer(surveyResultsReducer, props, createInitialSurveyResultsState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const propsRef = useRef(props);
  propsRef.current = props;
  const questionIdTableRef = useRef<HTMLDivElement>(null);
  const questionFilterRef = useRef<QuestionFilterHandle>(null);
  const instRef = useRef<SurveyResultsInstanceFields | null>(null);
  if (instRef.current === null) {
    instRef.current = createSurveyResultsInstanceFields() as SurveyResultsInstanceFields;
  }
  const inst = instRef.current;
  const pendingSetStateCallbacksRef = useRef<VoidFunction[]>([]);
  const fetchResponsesRuntimeRef = useRef<SurveyResultsFetchResponsesRuntime | null>(null);
  if (fetchResponsesRuntimeRef.current === null) {
    fetchResponsesRuntimeRef.current = createSurveyResultsFetchResponsesRuntime({
      fetchResponses: () => fetchResponses(),
      isMounted: () => inst._isMounted,
    });
  }
  const fetchResponsesRuntime = fetchResponsesRuntimeRef.current;
  const queuedResultsRefreshRuntimeRef = useRef<SurveyResultsQueuedRefreshRuntime | null>(null);
  if (queuedResultsRefreshRuntimeRef.current === null) {
    queuedResultsRefreshRuntimeRef.current = createSurveyResultsQueuedRefreshRuntime({
      isMounted: () => inst._isMounted,
      isOpen: () => !!propsRef.current.isOpen,
      requestFetchResponses: () => requestFetchResponses(),
      scheduleMicrotask,
      shouldUseAnimationFrame: () => shouldUseAnimationFrameForRefreshCoalescing(),
      animationFrame: {
        requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
        cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
      },
      measureFlush: (label, callback) => {
        measureSync(label, callback);
      },
    });
  }
  const queuedResultsRefreshRuntime = queuedResultsRefreshRuntimeRef.current;
  const localStoragePollingRuntimeRef = useRef<SurveyResultsLocalStoragePollingRuntime | null>(null);
  if (localStoragePollingRuntimeRef.current === null) {
    localStoragePollingRuntimeRef.current = createSurveyResultsLocalStoragePollingRuntime({
      minDelayMs: LOCAL_STORAGE_POLL_MIN_MS,
      midDelayMs: LOCAL_STORAGE_POLL_MID_MS,
      maxDelayMs: LOCAL_STORAGE_POLL_MAX_MS,
      isOpen: () => !!propsRef.current.isOpen,
      isDocumentHidden: () => isDocumentHidden(),
      isMounted: () => inst._isMounted,
      pollLocalStorageForUpdates: () => pollLocalStorageForUpdates(),
      onResetWithReason: () => {
        inst._lastLocalStoragePollCoarseSignature = '';
        inst._lastLocalStoragePollDetailedSignature = '';
      },
    });
  }
  const localStoragePollingRuntime = localStoragePollingRuntimeRef.current;
  const setFilterLoadingHandlerRef = useRef<(loading: unknown) => void>(() => {});
  const stableSetFilterLoadingRef = useRef<(loading: unknown) => void>((loading) => {
    setFilterLoadingHandlerRef.current(loading);
  });
  const setState = (update: SurveyResultsStateUpdate, callback?: VoidFunction): void => {
    if (callback) pendingSetStateCallbacksRef.current.push(callback);
    dispatch(update);
  };

  const handleManagedCacheUpdate = (update: SurveyResultsManagedCacheUpdate = {}): void => {
    if (!update || update.namespace !== 'surveysCache') return;
    inst._surveysCacheChangeNonce += 1;
  };

  function getEffectiveSlug(): string {
    const explicitSlug = resolveSurveyResultsExplicitSessionSlug({
      ...propsRef.current,
      search: (typeof window !== 'undefined' && window.location?.search) || '',
    });
    if (explicitSlug !== null) return explicitSlug;

    // 2. Fallback: scan known sessions for the survey ID if we have one
    if (stateRef.current.surveyId) {
      const sid = stateRef.current.surveyId.toLowerCase();
      const nonceKey = [
        normalizeNonceKey(propsRef.current.questionResponsesNonce),
        normalizeNonceKey(propsRef.current.questionsCacheNonce),
        normalizeNonceKey(inst._surveysCacheChangeNonce),
      ].join('|');
      if (
        inst._effectiveSlugScanMemo &&
        inst._effectiveSlugScanMemo.surveyId === sid &&
        inst._effectiveSlugScanMemo.nonceKey === nonceKey
      ) {
        return inst._effectiveSlugScanMemo.slug || '';
      }

      const slug = scanSurveyResultsSessionSlugFromCache({
        surveyId: sid,
        surveyCacheEntries: surveyResultsCachePort.listNamespaceEntriesSync('surveysCache', { cloneValues: false }),
      });
      inst._effectiveSlugScanMemo = {
        surveyId: sid,
        nonceKey,
        slug,
      };
      return slug;
    }

    return ''; // Default to general
  }

  function getEffectiveSessionContext(): SurveyResultsSessionContext {
    return resolveSurveyResultsSessionContext({
      sessionSlug: getEffectiveSlug(),
      resolveBySlug: getSessionConfigBySlug,
    });
  }

  function resolveBaseQuestionReadScopeContextFor({
    props = propsRef.current,
    state = stateRef.current,
    viewMode = state?.viewMode || props?.viewMode || 'questions',
  }: SurveyResultsScopeContextInput = {}): SurveyResultsQuestionReadScopeContext {
    return resolveSurveyResultsQuestionReadScope({
      pathname: (typeof window !== 'undefined' && window.location?.pathname) || '',
      search: (typeof window !== 'undefined' && window.location?.search) || '',
      sessionSlug: props.sessionSlug,
      activeSessionSlug: props.activeSessionSlug,
      sessionSlugPinned: props.sessionSlugPinned,
      viewMode,
      readSessionScanScope: readSessionScanScope as () => unknown,
      readSessionScanSlugs: readSessionScanSlugs as () => unknown,
      getAllSessionSlugs: getAllSessionSlugs as () => unknown,
    });
  }

  function resolveQuestionReadScopeContextFor({
    props = propsRef.current,
    state = stateRef.current,
    viewMode = state?.viewMode || props?.viewMode || 'questions',
  }: SurveyResultsScopeContextInput = {}): SurveyResultsQuestionReadScopeContext {
    return resolveBaseQuestionReadScopeContextFor({
      props,
      state,
      viewMode,
    });
  }

  function getQuestionReadScopeContext(
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions',
  ): SurveyResultsQuestionReadScopeContext {
    return resolveQuestionReadScopeContextFor({ viewMode });
  }

  function getQuestionReadSlugs(
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions',
  ): string[] {
    const scopeContext = getQuestionReadScopeContext(viewMode);
    const scopedSlugs = Array.isArray(scopeContext?.questionReadSlugs) ? scopeContext.questionReadSlugs : [];
    return scopedSlugs.length > 0 ? scopedSlugs : [getEffectiveSlug()];
  }

  function getQuestionFilterStorageKeyPrefix(
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions',
  ): string {
    return getQuestionReadScopeContext(viewMode).storageKeyPrefix;
  }

  function shouldRequireAuthoritativeQuestionScope(
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions',
  ): boolean {
    if (
      String(viewMode || '')
        .trim()
        .toLowerCase() !== 'questions'
    )
      return false;
    if (typeof window === 'undefined') return false;
    // Embedded one-page session results already pass an explicit pinned session slug.
    // Requiring authoritative metadata here hides legacy cache-backed questions that
    // pile view and the inline Polis report are already rendering from the same bucket.
    if (propsRef.current.preventUrlChange && propsRef.current.sessionSlugPinned) return false;
    return hasExplicitSessionQueryPinInPath(`${window.location.pathname || ''}${window.location.search || ''}`);
  }

  function buildQuestionReadScopeSignature({
    props = propsRef.current,
    state = stateRef.current,
    viewMode = state?.viewMode || props?.viewMode || 'questions',
  }: SurveyResultsScopeContextInput = {}): string {
    const scopeContext = resolveQuestionReadScopeContextFor({ props, state, viewMode });
    return [
      String(scopeContext?.baseSlug || ''),
      Array.isArray(scopeContext?.questionReadSlugs) ? scopeContext.questionReadSlugs.join('|') : '',
      String(scopeContext?.storageKeyPrefix || ''),
      String(viewMode || ''),
    ].join('::');
  }

  function getScopedQuestionNetworkDataSync(
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions',
  ): SurveyResultsScopedQuestionNetworkData {
    const netIdStr = String(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? '');
    if (!netIdStr) return EMPTY_SCOPED_QUESTION_NETWORK_DATA;
    const questionReadSlugs = getQuestionReadSlugs(viewMode);
    const requireAuthoritativeBinding = shouldRequireAuthoritativeQuestionScope(viewMode);
    const controllerResult = runSurveyResultsQuestionNetworkReadController({
      netIdStr,
      previousMemo: inst._scopedQuestionNetworkDataSyncMemo,
      questionReadSlugs,
      requireAuthoritativeBinding,
      viewMode,
      ports: {
        readQuestionBucket: (slug, networkId) =>
          applyBuiltInDemoQuestionMetadataFallbackToBucket(
            resolveNetBucketReadOnly(
              surveyResultsCachePort.peekCacheSync('questionsCache', slug, { clone: false }) || {},
              networkId,
              {
                questionsLatestBlock: 0,
                questions: {},
                questionResponses: {},
                questionResponsesLatestBlock: 0,
              },
            ) as SurveyResultsQuestionBucketRecord,
            slug,
            viewMode,
          ),
      },
    });
    if (!controllerResult.memoHit && controllerResult.memo) {
      inst._scopedQuestionNetworkDataSyncMemo = controllerResult.memo;
    }
    return controllerResult.result;
  }

  async function getScopedQuestionNetworkData(
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions',
  ): Promise<SurveyResultsScopedQuestionNetworkData> {
    const netIdStr = String(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? '');
    if (!netIdStr) return EMPTY_SCOPED_QUESTION_NETWORK_DATA;
    const questionReadSlugs = getQuestionReadSlugs(viewMode);
    const requireAuthoritativeBinding = shouldRequireAuthoritativeQuestionScope(viewMode);
    const controllerResult = await runSurveyResultsQuestionNetworkAsyncReadController({
      netIdStr,
      questionReadSlugs,
      requireAuthoritativeBinding,
      ports: {
        peekQuestionBucket: (slug, networkId) => {
          const bucket = resolveNetBucketReadOnly(
            surveyResultsCachePort.peekCacheSync('questionsCache', slug, { clone: false }) || {},
            networkId,
            {},
          ) as SurveyResultsQuestionBucketRecord;
          return Object.keys(bucket || {}).length > 0
            ? applyBuiltInDemoQuestionMetadataFallbackToBucket(bucket, slug, viewMode)
            : bucket;
        },
        readQuestionBucket: async (slug, networkId) =>
          applyBuiltInDemoQuestionMetadataFallbackToBucket(
            resolveNetBucketReadOnly(
              (await surveyResultsCachePort.readCache('questionsCache', slug)) || {},
              networkId,
              {
                questionsLatestBlock: 0,
                questions: {},
                questionResponses: {},
                questionResponsesLatestBlock: 0,
              },
            ) as SurveyResultsQuestionBucketRecord,
            slug,
            viewMode,
          ),
      },
    });
    return controllerResult.result;
  }

  const appendSessionHintToSurveyPath = (pathIn: unknown = ''): string => {
    const path = String(pathIn || '');
    if (!path || hasExplicitSessionQueryPinInPath(path)) return path;
    const pathOnly = path.split('?')[0];
    const isSessionAwarePath =
      pathOnly.includes('/survey/') || pathOnly.startsWith('/questions') || pathOnly.startsWith('/question/');
    if (!isSessionAwarePath) return path;
    const slug = getEffectiveSlug();
    if (!slug) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}session=${encodeURIComponent(slug)}`;
  };

  function getMemoizedQuestionFilterQuestions(
    networkQuestionsById: Record<string, SurveyResultsFilterQuestionRecord> = {},
  ): SurveyResultsFilterQuestionRecord[] {
    const questionResponsesRef = stateRef.current.questionResponses as SurveyResultsRecord | null | undefined;
    const networkQuestionsRef = networkQuestionsById;
    const questionResponsesNonceKey = normalizeNonceKey(propsRef.current.questionResponsesNonce);
    const questionsCacheNonceKey = normalizeNonceKey(propsRef.current.questionsCacheNonce);
    const memo = inst._questionFilterQuestionsMemo;

    if (
      memo.questionResponsesRef === questionResponsesRef &&
      memo.networkQuestionsRef === networkQuestionsRef &&
      memo.questionResponsesNonceKey === questionResponsesNonceKey &&
      memo.questionsCacheNonceKey === questionsCacheNonceKey
    ) {
      return memo.result;
    }

    const next = buildSurveyResultsQuestionFilterQuestions({
      networkQuestionsById,
      questionResponses: questionResponsesRef,
    });

    inst._questionFilterQuestionsMemo = {
      questionResponsesRef,
      networkQuestionsRef,
      questionResponsesNonceKey,
      questionsCacheNonceKey,
      result: next,
    };
    return next;
  }

  function notifyFilterStateCommitted(nextFilterState: SurveyResultsFilterState): void {
    const nextSignature = getFilterStateSignature(nextFilterState);
    if (inst._lastNotifiedFilterStateSignature === nextSignature) return;
    inst._lastNotifiedFilterStateSignature = nextSignature;
    if (propsRef.current.onFilterStateChangeForUrlUpdate) {
      propsRef.current.onFilterStateChangeForUrlUpdate(nextFilterState);
    }
    if (propsRef.current.onFilterChange) {
      propsRef.current.onFilterChange(nextFilterState);
    }
  }

  function commitResultsFilterState(
    statePatch: SurveyResultsRecord | null | undefined,
    nextFilterState: unknown,
  ): void {
    const patch: SurveyResultsRecord = statePatch && typeof statePatch === 'object' ? statePatch : {};
    const normalizedFilterState = normalizeNextSurveyResultsFilterState(nextFilterState, stateRef.current.filterState);
    const filterStateChanged = !areValuesEquivalentBySignature(stateRef.current.filterState, normalizedFilterState);
    const patchChanged = Object.keys(patch).some(
      (key) => !areValuesEquivalentBySignature(stateRef.current[key], patch[key]),
    );
    if (!filterStateChanged && !patchChanged) return;
    setState(
      asSurveyResultsStatePatch(
        buildSurveyResultsCommittedFilterStatePatch({
          filterState: normalizedFilterState,
          statePatch: patch,
        }),
      ),
      () => notifyFilterStateCommitted(stateRef.current.filterState),
    );
  }

  const requestFetchResponses = (): void => {
    fetchResponsesRuntime.request();
  };

  const shouldUseAnimationFrameForRefreshCoalescing = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (typeof window.requestAnimationFrame !== 'function') return false;
    if (isDocumentHidden()) return false;
    const ua = String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
    if (/jsdom/i.test(ua)) return false;
    return true;
  };

  const queueResultsRefresh = (reason: unknown = 'unknown'): void => {
    queuedResultsRefreshRuntime.queue(reason);
  };

  const updateParentWithCurrentFiltersForUrl = (): void => {
    notifyFilterStateCommitted(stateRef.current.filterState);
  };

  const runNonceTickRefresh = async (): Promise<void> => {
    try {
      const slug = getEffectiveSlug();
      const latest = await chainScanReadsPort.getLatestBlockNumber(
        propsRef.current.provider as string | undefined,
        slug,
      );
      const refreshStatusSequencePlan = buildSurveyResultsRefreshStatusSequencePlan({
        isMounted: inst._isMounted,
        latestBlock: latest,
        writeNetworkLatestBlock: true,
        followUpEffects: [
          'pollLocalStorageForUpdates',
          'resetLocalStoragePollingBackoff:nonce-tick',
          'queueResultsRefresh:nonce-tick',
        ],
      });
      if (!refreshStatusSequencePlan.shouldWrite || !refreshStatusSequencePlan.statePatch) return;
      setState(asSurveyResultsStatePatch(refreshStatusSequencePlan.statePatch), () => {
        // Re-read localStorage derived counters and repaint from cache immediately
        pollLocalStorageForUpdates();
        resetLocalStoragePollingBackoff('nonce-tick');
        queueResultsRefresh('nonce-tick');
      });
    } catch (e: unknown) {
      // Fall back to a soft refresh if block lookup fails
      if (inst._isMounted) {
        resetLocalStoragePollingBackoff('nonce-tick-fallback');
        queueResultsRefresh('nonce-tick-fallback');
      }
    }
  };

  const handleNonceTick = async (): Promise<void> => {
    if (inst._nonceTickInFlight) {
      inst._nonceTickQueued = true;
      return;
    }
    inst._nonceTickInFlight = true;
    try {
      do {
        inst._nonceTickQueued = false;
        await runNonceTickRefresh();
      } while (inst._nonceTickQueued && inst._isMounted);
    } finally {
      inst._nonceTickInFlight = false;
    }
  };

  const handleFilterActivityChange = (isActive: unknown): void => {
    if (stateRef.current.isFilterActive === isActive) return;
    setState(asSurveyResultsStatePatch(buildSurveyResultsFilterActivePatch(isActive)));
  };

  const getIsDemoQuestionResultsContext = (
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions',
  ): boolean =>
    isSurveyResultsDemoQuestionResultsContext({
      effectiveSlug: getEffectiveSlug(),
      viewMode,
    });

  const applyBuiltInDemoQuestionMetadataFallbackToBucket = (
    bucket: SurveyResultsQuestionBucketRecord | null | undefined,
    bucketSlug: unknown = '',
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions',
  ): SurveyResultsQuestionBucketRecord => {
    return applySurveyResultsBuiltInDemoQuestionMetadataFallbackToBucket({
      bucket,
      bucketSlug,
      effectiveSlug: getEffectiveSlug(),
      ports: {
        isDemoFixtureResponse: isDemoPolisFixtureResponse,
        parseResponse,
      },
      viewMode,
    }) as SurveyResultsQuestionBucketRecord;
  };

  const handleDemoResultsViewSelect = (nextView: unknown = 'report'): void => {
    setState(
      asSurveyResultsStateUpdater((prevState) =>
        buildSurveyResultsDemoViewSelectPatch({
          nextView,
          prevState,
        }),
      ),
    );
  };

  const handleDemoAtlasOpen = (nodeId: unknown = ''): void => {
    setState(asSurveyResultsStatePatch(buildSurveyResultsDemoAtlasOpenPatch(nodeId)));
  };

  const handleDemoAtlasModalClose = (): void => {
    if (!stateRef.current.demoResultsAtlasNodeId) return;
    setState(asSurveyResultsStatePatch(buildSurveyResultsDemoAtlasNodePatch()));
  };

  const handleClearFiltersFromParent = (e: React.SyntheticEvent): void => {
    e.stopPropagation();
    if (questionFilterRef.current) {
      questionFilterRef.current.handleClearFilters();
    }
  };

  const closeModal = (): void => {
    const oldPath = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
    let base = oldPath.split('/results')[0];

    if (base === oldPath || base === '') {
      if (stateRef.current.viewMode === 'questions') {
        base = '/questions';
      } else if (stateRef.current.surveyId) {
        base = `/survey/${stateRef.current.surveyId}`;
      } else {
        base = '/questions';
      }
    }
    base = appendSessionHintToSurveyPath(base);

    if (!propsRef.current.preventUrlChange) {
      window.history.pushState({}, '', applyExistingGroupPrefix(base));
    }

    if (propsRef.current.onClose) {
      propsRef.current.onClose();
    }
  };

  const handleUrlChange = (): void => {
    handleUrlBasedView();
  };

  const handleUrlBasedView = (): void => {
    const path = window.location.pathname;
    let newViewMode = stateRef.current.viewMode; // Default to current
    let newSurveyId = stateRef.current.surveyId; // Default to current

    const surveyResultsRegex = /^\/survey\/([0-9a-fA-FxX]{66})\/results/;
    const surveyMatch = path.match(surveyResultsRegex);

    const questionResultsRegex = /^\/questions\/results/;
    const questionMatch = path.match(questionResultsRegex);

    if (surveyMatch) {
      newViewMode = 'survey';
      newSurveyId = surveyMatch[1]; // surveyID from URL
    } else if (questionMatch) {
      newViewMode = 'questions';
      newSurveyId = ''; // No surveyId for questions view
    }
    // If neither matches, it might be a base path like /survey/ID or /questions
    // In that case, we don't necessarily change the mode here, as componentDidMount/Update handles props.

    if (stateRef.current.viewMode !== newViewMode || stateRef.current.surveyId !== newSurveyId) {
      setState(asSurveyResultsStatePatch(buildSurveyResultsViewStatePatch(newViewMode, newSurveyId)), () => {
        queueResultsRefresh('url-view-change');
      });
    }
  };

  const isDocumentHidden = (): boolean => {
    try {
      return typeof document !== 'undefined' && document.hidden;
    } catch (_) {
      return false;
    }
  };

  const updateLocalStoragePollingState = (): void => {
    if (propsRef.current.isOpen && !isDocumentHidden()) {
      resetLocalStoragePollingBackoff('polling-state-open');
      startLocalStoragePolling();
    } else {
      stopLocalStoragePolling();
    }
  };

  const handleDocumentVisibilityChange = (): void => {
    updateLocalStoragePollingState();
  };

  const resetLocalStoragePollingBackoff = (reason: unknown = ''): void => {
    localStoragePollingRuntime.resetBackoff(reason);
  };

  function startLocalStoragePolling(): void {
    localStoragePollingRuntime.start();
  }

  function stopLocalStoragePolling(): void {
    localStoragePollingRuntime.stop();
  }

  const getLocalStoragePollRuntimeArgs = () => ({
    config: {
      forceRescanEvery: LOCAL_STORAGE_FORCE_RESCAN_EVERY,
      latestBlockPollThrottleMs: LATEST_BLOCK_POLL_THROTTLE_MS,
    },
    instance: inst,
    ports: {
      applyStatePatch: (patch: unknown, afterApply?: () => void) => {
        setState(asSurveyResultsStatePatch(patch), afterApply);
      },
      getEffectiveSlug,
      getFetchRuntimeSnapshot: () => fetchResponsesRuntime.getSnapshot(),
      getProps: () => propsRef.current,
      getScopedQuestionNetworkDataSync,
      getStableCycles: () => localStoragePollingRuntime.getStableCycles(),
      getState: () => stateRef.current,
      logWarn: (...args: unknown[]) => surveyLog.warn(...args),
      queueResultsRefresh: (reason: string) => queueResultsRefresh(reason),
      readLatestBlock: (provider: string | undefined, slug: string) =>
        chainScanReadsPort.getLatestBlockNumber(provider, slug),
      readQuestionCacheSync: (slug: string) =>
        surveyResultsCachePort.peekCacheSync('questionsCache', slug, { clone: false }),
      readSurveyCacheSync: (slug: string) =>
        surveyResultsCachePort.peekCacheSync('surveysCache', slug, { clone: false }),
    },
  });

  const maybeRefreshNetworkLatestBlockFromPolling = (): void => {
    maybeRefreshSurveyResultsNetworkLatestBlockFromPolling(getLocalStoragePollRuntimeArgs());
  };

  function pollLocalStorageForUpdates(): boolean {
    if (!hasEffectiveNetworkId()) return false;
    return pollSurveyResultsLocalStorageForUpdates(getLocalStoragePollRuntimeArgs());
  }

  const parseResponse = <T,>(responseData: T): T | SurveyResultsRecord | null => {
    if (typeof responseData !== 'string') return responseData;
    const memo = inst._responseParseMemo as Map<string, unknown>;
    if (memo.has(responseData)) {
      return memo.get(responseData) as SurveyResultsRecord | null;
    }
    try {
      const parsed = JSON.parse(responseData);
      memo.set(responseData, parsed);
      if (memo.size > RESPONSE_PARSE_MEMO_MAX_SIZE) {
        const oldestKey = memo.keys().next().value;
        if (oldestKey !== undefined) memo.delete(oldestKey);
      }
      return parsed;
    } catch (error) {
      surveyLog.error('Error parsing response data:', error);
      memo.set(responseData, null);
      if (memo.size > RESPONSE_PARSE_MEMO_MAX_SIZE) {
        const oldestKey = memo.keys().next().value;
        if (oldestKey !== undefined) memo.delete(oldestKey);
      }
      return null;
    }
  };

  const isDemoPolisFixtureResponse = (responseData: unknown): boolean =>
    !!responseData &&
    typeof responseData === 'object' &&
    (responseData as SurveyResultsRecord).source === 'demo-polis-data';

  const getNetworkQuestionsForCurrentContext = (
    _identity?: SurveyResultsQuestionMetadataReadIdentity,
  ): Record<string, SurveyResultsQuestionRecord> => {
    const networkData = getScopedQuestionNetworkDataSync(
      stateRef.current.viewMode || propsRef.current.viewMode || 'questions',
    ) as SurveyResultsScopedQuestionNetworkData;
    return networkData.questions;
  };

  const getEffectiveNetworkId = (): unknown => propsRef.current.network?.id ?? propsRef.current.networkChainId ?? '';

  const hasEffectiveNetworkId = (): boolean => String(getEffectiveNetworkId() ?? '').trim() !== '';

  const fetchResponses = async (): Promise<void> => {
    if (!hasEffectiveNetworkId()) {
      surveyLog.error('Network ID is undefined in fetchResponses. Cannot proceed.');
      return;
    }

    // Cache-first results should not wait on RPC freshness. Kick the latest-block
    // lookup into the background so the modal can render cached questions/responses
    // immediately, then let the sync badge catch up when the block call resolves.
    if (!normalizeSurveyResultsBlockNumber(stateRef.current.networkLatestBlock)) {
      maybeRefreshNetworkLatestBlockFromPolling();
    }

    if (stateRef.current.viewMode === 'survey') {
      await fetchSurveyModeResponses();
    } else {
      await fetchQuestionModeResponses();
    }
  };

  async function fetchSurveyModeResponses(): Promise<void> {
    await fetchSurveyResultsSurveyModeResponses({
      instance: inst,
      ports: {
        applyStatePatch: (patch, afterApply) => setState(asSurveyResultsStatePatch(patch), afterApply),
        getEffectiveSlug,
        getNetworkQuestionsForCurrentContext,
        getProps: () => propsRef.current,
        getScopedQuestionNetworkData,
        getState: () => stateRef.current,
        logWarn: (...args) => surveyLog.warn(...args),
        parseResponse,
        readSurveyCache: (slug) => surveyResultsCachePort.readCache('surveysCache', slug),
        readSurveyCacheSync: (slug) => surveyResultsCachePort.peekCacheSync('surveysCache', slug, { clone: false }),
        reapplyQuestionFilters: () => {
          if (questionFilterRef.current) questionFilterRef.current.handleApplyFilters(true);
        },
      },
    });
  }

  async function fetchQuestionModeResponses(): Promise<void> {
    await fetchSurveyResultsQuestionModeResponses({
      instance: inst,
      ports: {
        applyStatePatch: (patch, afterApply) => setState(asSurveyResultsStatePatch(patch), afterApply),
        getEffectiveSlug,
        getNetworkQuestionsForCurrentContext,
        getProps: () => propsRef.current,
        getScopedQuestionNetworkData,
        getState: () => stateRef.current,
        logWarn: (...args) => surveyLog.warn(...args),
        parseResponse,
        readSurveyCache: (slug) => surveyResultsCachePort.readCache('surveysCache', slug),
        readSurveyCacheSync: (slug) => surveyResultsCachePort.peekCacheSync('surveysCache', slug, { clone: false }),
        reapplyQuestionFilters: () => {
          if (questionFilterRef.current) questionFilterRef.current.handleApplyFilters(true);
        },
      },
    });
  }

  const dataExportRuntime = createSurveyResultsDataExportRuntime({
    applyStatePatch: (patch) => setState(asSurveyResultsStatePatch(patch)),
    getEffectiveSlug,
    getNetworkQuestionsForCurrentContext,
    getProps: () => propsRef.current,
    getResponseQuestionId,
    getState: () => stateRef.current,
    hasEffectiveNetworkId,
    parseResponse: (response) => parseResponse(response) as SurveyResultsResponseRecord | null,
    writeCsvFileName: (filename) => {
      inst.csvFileName = filename;
    },
  });
  const { downloadCSV, getFilteredQuestionsForExport } = dataExportRuntime;

  const lockedResponsesRuntime = createSurveyResultsLockedResponsesRuntime({
    instance: inst,
    ports: {
      applyStatePatch: (patch, afterApply) => setState(patch as SurveyResultsStateUpdate, afterApply),
      decryptEnvelopeValue: (envelope, options) => cryptoGatePort.decryptEnvelopeValue(envelope, options),
      getEffectiveSessionContext,
      getEffectiveSlug,
      getNetworkQuestionsForCurrentContext: () =>
        getNetworkQuestionsForCurrentContext() as Record<string, SurveyResultsQuestionWithEncryption>,
      getProps: () => propsRef.current,
      getState: () => stateRef.current,
      logWarn: (...args) => surveyLog.warn(...args),
      resolveSbtDisplayLabel: resolveSbtDisplayLabelForSurveyResults,
      resolveSessionContext: (sessionSlug) =>
        resolveSurveyResultsSessionContext({
          sessionSlug,
          resolveBySlug: getSessionConfigBySlug,
        }),
    },
  });
  const {
    applyDecryptedOverrideToResponse,
    getLockedResponseKey,
    getMemoizedLockedResponsesModel,
    getQuestionEncryptionGates,
    handleDecryptLockedResponses,
    toggleLockedResponseDetails,
  } = lockedResponsesRuntime;

  const applyHtmlReportAnalysisLifecycleStatePatch: SurveyResultsAnalysisLifecycleStatePatchPort = (patch) => {
    setState(asSurveyResultsStatePatch(patch));
  };

  const htmlReportRuntime = createSurveyResultsHtmlReportRuntime({
    getEffectiveSlug,
    getFilteredQuestionsForExport,
    getNetworkQuestionsForCurrentContext,
    getProps: () => propsRef.current,
    getQuestionEncryptionGates: (question) =>
      getQuestionEncryptionGates(question as SurveyResultsQuestionWithEncryption),
    getResponseQuestionId,
    getResponseQuestionPrompt,
    getResponseQuestionType,
    getState: () => stateRef.current,
    normalizeGateSbtEntries,
    parseResponse,
    readAnalysisCache: (slug) => surveyResultsCachePort.readCache('analysisCache', slug),
    readAnalysisCacheSync: (namespace, cacheSlug, options) =>
      surveyResultsCachePort.peekCacheSync(namespace, cacheSlug, options),
    resolveSbtDisplayLabel: resolveSbtDisplayLabelForSurveyResults,
    writeAnalysisArtifact: (namespace, cacheSlug, payload) =>
      surveyResultsCachePort.writeCache(namespace, cacheSlug, payload),
  });
  const {
    buildHtmlReportDemoAnalysisArtifact,
    buildSessionResultsAnalysisPayloadForAi,
    buildSessionResultsHtmlReportSnapshot,
    getHtmlReportAnalysisArtifact,
    getHtmlReportAnalysisSectionsToGenerate,
    getHtmlReportExporterMetadata,
    getHtmlReportSelectedSections,
    getSessionResultsAnalysisCacheKey,
    getSessionResultsAnalysisCacheSlug,
    isHtmlReportDemoModeActive,
    isHtmlReportDemoSession,
    isHtmlReportExportAuthorized,
    readSessionResultsAnalysisArtifactFromCache,
    writeSessionResultsAnalysisArtifactToCache,
  } = htmlReportRuntime;

  const openHtmlReportExportModal = (): void => {
    const snapshot = buildSessionResultsHtmlReportSnapshot();
    setState(buildSurveyResultsHtmlReportModalOpenPatch(snapshot.exportedAt));
  };

  const closeHtmlReportExportModal = (): void => {
    setState(buildSurveyResultsHtmlReportModalClosePatch());
  };

  const toggleHtmlReportSection = (key: SurveyResultsHtmlReportSectionKey): void => {
    const current = getHtmlReportSelectedSections();
    setState(
      buildSurveyResultsHtmlReportSectionTogglePatch({
        currentSections: current,
        sectionKey: key,
      }),
    );
  };

  const toggleHtmlReportDemoMode = (): void => {
    const nextDemoMode = !stateRef.current.htmlReportDemoMode;
    const currentArtifact = getHtmlReportAnalysisArtifact();
    setState(
      buildSurveyResultsHtmlReportDemoModePatch({
        currentArtifact,
        demoArtifact: nextDemoMode ? buildHtmlReportDemoAnalysisArtifact() : null,
        nextDemoMode,
      }),
    );
  };

  const handleHtmlReportFormatChange = (format: SessionResultsExportFormat): void => {
    setState(buildSurveyResultsHtmlReportFormatPatch(format));
  };

  const generateHtmlReportAnalysisViews = async (): Promise<void> => {
    if (isHtmlReportDemoModeActive()) {
      setState(buildSurveyResultsHtmlReportAnalysisDemoReadyPatch(buildHtmlReportDemoAnalysisArtifact()));
      return;
    }
    if (!isHtmlReportExportAuthorized()) {
      setState(
        buildSurveyResultsHtmlReportAnalysisErrorPatch(
          'Connect a wallet with permission to view these results before generating analysis views.',
        ),
      );
      return;
    }

    const { aiPayload, eligibility, inputSignature, participants } = buildSessionResultsAnalysisPayloadForAi();
    if (!eligibility.eligible) {
      setState(
        buildSurveyResultsHtmlReportAnalysisEligibilityBlockedPatch({
          inputSignature,
          reason: eligibility.reasons.join(' '),
        }),
      );
      return;
    }

    const cached = readSessionResultsAnalysisArtifactFromCache(inputSignature);
    const currentArtifact = getHtmlReportAnalysisArtifact();
    const analysisLifecyclePlan = buildSurveyResultsAnalysisLifecyclePlan({
      allSections: SESSION_RESULTS_ANALYSIS_SECTION_KEYS,
      cachedArtifact: cached,
      currentArtifact,
      inputSignature,
      requestedSections: getHtmlReportAnalysisSectionsToGenerate(),
    });
    let artifact: SessionResultsGeneratedAnalysisArtifact | null = analysisLifecyclePlan.artifact;

    const lifecycleResult = runSurveyResultsAnalysisLifecycleController({
      plan: analysisLifecyclePlan,
      ports: {
        applyBlockedState: applyHtmlReportAnalysisLifecycleStatePatch,
        applyGenerateStartState: applyHtmlReportAnalysisLifecycleStatePatch,
        applyReadyState: applyHtmlReportAnalysisLifecycleStatePatch,
      },
    });
    if (!lifecycleResult.shouldGenerate) {
      return;
    }

    try {
      const missingSections = analysisLifecyclePlan.missingSections;
      let completionPlan: SurveyResultsAnalysisGeneratedArtifactCompletionPlan | null = null;
      let completionLifecyclePatch: unknown = null;
      for (let index = 0; index < missingSections.length; index += 1) {
        const section = missingSections[index];
        const label = HTML_REPORT_ANALYSIS_SECTION_LABELS[section];
        setState(
          buildSurveyResultsHtmlReportAnalysisProgressPatch(
            `Generating ${label} (${index + 1}/${missingSections.length})`,
          ),
        );
        const prompt = buildSessionResultsAnalysisPrompt(aiPayload, section);
        const rawOutput = await surveyResultsAnalysisGenerationPort.generateSection({
          maxTokens: HTML_REPORT_ANALYSIS_SECTION_MAX_TOKENS[section],
          prompt,
          sessionSlug: getEffectiveSlug() || '',
        });
        const sectionArtifact = surveyResultsAnalysisArtifactMergePort.normalizeGeneratedArtifact({
          generatedAt: new Date().toISOString(),
          inputSignature,
          participants,
          rawOutput,
        });
        artifact = surveyResultsAnalysisArtifactMergePort.mergeGeneratedArtifacts({
          base:
            artifact ||
            surveyResultsAnalysisArtifactMergePort.normalizeGeneratedArtifact({
              generatedAt: new Date().toISOString(),
              inputSignature,
              participants,
              rawOutput: {},
            }),
          next: sectionArtifact,
          sections: [section],
        });
        completionPlan = buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan({
          artifact,
          cacheKey: artifact ? getSessionResultsAnalysisCacheKey(artifact.inputSignature) : '',
          failureStatePatch: analysisLifecyclePlan.failureRecovery.statePatch,
          inputSignature,
          requestedSections: analysisLifecyclePlan.sectionsToGenerate,
          slug: getSessionResultsAnalysisCacheSlug(),
        });
        const completionResult = await runSurveyResultsAnalysisGeneratedArtifactCompletion({
          plan: completionPlan,
          ports: {
            writeArtifactToCache: writeSessionResultsAnalysisArtifactToCache,
          },
        });
        if (!completionResult.ok) {
          if (completionResult.error instanceof Error) throw completionResult.error;
          throw new Error(completionResult.errorMessage);
        }
        completionLifecyclePatch = completionResult.lifecyclePatchDescriptor;
      }
      if (!completionPlan || !completionLifecyclePatch) {
        throw new Error('Generated analysis artifact completion did not produce a lifecycle patch.');
      }
      setState(asSurveyResultsStatePatch(completionLifecyclePatch));
    } catch (error) {
      surveyLog.error('[SurveyResults.generateHtmlReportAnalysisViews] Failed to generate analysis:', error);
      runSurveyResultsAnalysisLifecycleController({
        phase: 'failure-recovery',
        plan: analysisLifecyclePlan,
        ports: {
          applyFailureRecoveryState: applyHtmlReportAnalysisLifecycleStatePatch,
        },
      });
    }
  };

  const downloadHtmlReport = async (): Promise<void> => {
    const exportedAt = stateRef.current.htmlReportExportedAt || new Date().toISOString();
    const snapshot = buildSessionResultsHtmlReportSnapshot(exportedAt);
    const selectedSections = getHtmlReportSelectedSections();
    const format = stateRef.current.htmlReportExportFormat || SESSION_RESULTS_EXPORT_FORMAT_VIEWER;
    const downloadPlan = buildSurveyResultsHtmlReportDownloadExecutionPlan({
      analysisGenerating: stateRef.current.htmlReportAnalysisGenerating,
      format,
      isAuthorized: isHtmlReportExportAuthorized(),
      selectedSections,
      snapshot,
    });
    if (downloadPlan.status === 'blocked') {
      setState(asSurveyResultsStatePatch(downloadPlan.statePatch));
      return;
    }

    try {
      const { downloadRequest } = downloadPlan;
      await surveyResultsHtmlReportExporterPort.exportReport({
        downloadRequest,
        snapshot,
      });
      setState(asSurveyResultsStatePatch(buildSurveyResultsHtmlReportDownloadSuccessPatch()));
    } catch (error) {
      surveyLog.error('[SurveyResults.downloadHtmlReport] Failed to export HTML report:', error);
      setState(asSurveyResultsStatePatch(buildSurveyResultsHtmlReportDownloadFailurePatch()));
    }
  };

  const handleExportTypeChange = (type: unknown): void => {
    setState(asSurveyResultsStatePatch(buildSurveyResultsExportTypePatch(type)));
  };

  const handleQuestionFilter = (filteredQuestionsOrCombined: unknown, newFilterState: unknown): void => {
    // ⛑️ Gate: don't clobber counts or bubble anything until the question cache is ready
    if (!propsRef.current.isQuestionCacheReady) return;

    const isSurveyMode = stateRef.current.viewMode === 'survey';
    const isSurveyAggregate = isSurveyMode && stateRef.current.surveyViewMode === 'aggregate';
    const isSurveyIndividuals = isSurveyMode && stateRef.current.surveyViewMode === 'individuals';

    let filteredQuestions: SurveyResultsQuestionRecord[] = [];
    let filteredResponsesByQuestion: SurveyResultsRecord | null = null;
    if (Array.isArray(filteredQuestionsOrCombined)) {
      filteredQuestions = filteredQuestionsOrCombined as SurveyResultsQuestionRecord[];
    } else if (
      filteredQuestionsOrCombined &&
      typeof filteredQuestionsOrCombined === 'object' &&
      Array.isArray((filteredQuestionsOrCombined as SurveyResultsQuestionFilterCombinedPayload).filteredQuestions)
    ) {
      const combinedPayload = filteredQuestionsOrCombined as SurveyResultsQuestionFilterCombinedPayload;
      filteredQuestions = combinedPayload.filteredQuestions as SurveyResultsQuestionRecord[];
      filteredResponsesByQuestion = toSurveyResultsRecord(combinedPayload.filteredResponsesByQuestion);
    } else {
      return;
    }

    const finalFilteredQCount = filteredQuestions.length;
    if (propsRef.current.onCountUpdate) {
      propsRef.current.onCountUpdate(finalFilteredQCount);
    }

    const sourceMap = isSurveyAggregate
      ? stateRef.current.aggregateQuestionResponses
      : stateRef.current.aggregatorQuestionResponses;
    const networkQuestions = isSurveyIndividuals || isSurveyAggregate ? {} : getNetworkQuestionsForCurrentContext();
    const statePatch = buildSurveyResultsQuestionFilterPatch({
      filteredQuestions,
      filteredResponsesByQuestion,
      isSurveyAggregate,
      isSurveyIndividuals,
      networkQuestions,
      sourceMap,
      totalResponsesCount: stateRef.current.totalResponsesCount,
    });

    commitResultsFilterState(statePatch, newFilterState);
  };

  const setFilterLoading = (loading: unknown): void => {
    const loadingUpdate = buildSurveyResultsFilterLoadingUpdate({
      loading,
      pendingValue: inst._pendingFilterLoadingValue,
      stateFilterLoading: stateRef.current.filterLoading,
    });

    if (loadingUpdate.shouldQueueState) {
      inst._pendingFilterLoadingValue = loadingUpdate.nextPendingValue;
      setState(
        asSurveyResultsStateUpdater((prev: SurveyResultsRecord) =>
          buildSurveyResultsFilterLoadingStatePatch({
            nextLoading: loadingUpdate.nextLoading,
            prevState: prev,
          }),
        ),
        () => {
          if (stateRef.current.filterLoading === inst._pendingFilterLoadingValue) {
            inst._pendingFilterLoadingValue = null;
          }
        },
      );
    }

    if (propsRef.current.setFilterLoading) {
      propsRef.current.setFilterLoading(loadingUpdate.nextLoading);
    }
  };
  setFilterLoadingHandlerRef.current = setFilterLoading;

  const handleQuestionFilterCountUpdate = (count: unknown): void => {
    const countPatch = buildSurveyResultsQuestionFilterCountPatch({
      count,
      props: propsRef.current,
      state: stateRef.current,
    });
    if (!countPatch) return;
    setState(asSurveyResultsStatePatch(countPatch));
    if (propsRef.current.onCountUpdate) propsRef.current.onCountUpdate(count);
  };

  const handleFilteredResponses = (filteredResponses: unknown, newSbtFilterLocalState: unknown): void => {
    // ⛑️ Gate: avoid overwriting filtered maps during waiting/aborted states
    if (!propsRef.current.isQuestionCacheReady) return;
    const nextFilterState =
      typeof newSbtFilterLocalState !== 'undefined'
        ? buildSurveyResultsSbtFilterState({
            filterState: stateRef.current.filterState,
            sbtFilter: newSbtFilterLocalState,
          })
        : preserveSurveyResultsFilterStateValue(stateRef.current.filterState);

    const filteredResponsesPatchPlan = buildSurveyResultsFilteredResponsesPatchPlan({
      filteredResponses,
      networkQuestions:
        stateRef.current.viewMode !== 'survey' && filteredResponses && typeof filteredResponses === 'object'
          ? getNetworkQuestionsForCurrentContext()
          : {},
      surveyViewMode: stateRef.current.surveyViewMode,
      totalResponsesCount: stateRef.current.totalResponsesCount,
      viewMode: stateRef.current.viewMode,
    });

    if (filteredResponsesPatchPlan.status === 'invalid-array') {
      surveyLog.error('Expected an array in survey mode (individuals), got:', filteredResponses);
    } else if (filteredResponsesPatchPlan.status === 'invalid-aggregator') {
      if (stateRef.current.viewMode === 'survey') {
        surveyLog.error('Expected aggregator object in aggregator mode, got:', filteredResponses);
      } else {
        surveyLog.error('Expected aggregator object for question mode, got:', filteredResponses);
      }
    }

    if (filteredResponsesPatchPlan.patch) {
      commitResultsFilterState(filteredResponsesPatchPlan.patch, nextFilterState);
    } else {
      return;
    }
  };

  const toggleQuestionSummary = (questionId: unknown): void => {
    setState(
      asSurveyResultsStateUpdater((prevState) =>
        buildSurveyResultsKeyedTogglePatch({
          itemKey: questionId,
          mapKey: 'activeQuestionToggles',
          prevState,
        }),
      ),
    );
  };

  const toggleResponse = (responseId: unknown): void => {
    setState(
      asSurveyResultsStateUpdater((prevState) =>
        buildSurveyResultsKeyedTogglePatch({
          itemKey: responseId,
          mapKey: 'activeToggles',
          prevState,
        }),
      ),
    );
  };

  const toggleSurveyBookmark = (surveyId: unknown): void => {
    const slug = getEffectiveSlug();
    const bookmarksReadRequest = buildSurveyResultsBookmarksCacheReadRequest({ slug });
    let bookmarksCache: unknown = {};

    try {
      bookmarksCache = surveyResultsCachePort.peekCacheSync(
        bookmarksReadRequest.namespace,
        bookmarksReadRequest.slug,
        bookmarksReadRequest.options,
      );
    } catch (error) {
      surveyLog.error('[SurveyResults] Error reading bookmarksCache:', error);
      bookmarksCache = {};
    }

    const writePlan = buildSurveyResultsSurveyQuestionBookmarkWritePlan({
      bookmarkId: surveyId,
      bookmarkType: 'survey',
      bookmarksCache,
      slug,
    });

    if (!writePlan.shouldWrite || !writePlan.payload || !writePlan.statePatch) return;

    void runSurveyResultsSurveyQuestionBookmarkWriteController({
      plan: writePlan,
      ports: {
        writeBookmarksCache: (namespace, cacheSlug, payload) =>
          surveyResultsCachePort.writeCache(namespace, cacheSlug, payload),
      },
    }).then((writeResult) => {
      if (!writeResult.ok && writeResult.error) {
        surveyLog.error('[SurveyResults] Error saving bookmarksCache:', writeResult.error);
      }
    });
    setState(asSurveyResultsStatePatch(buildSurveyResultsBookmarkedSurveyIdsPatch(writePlan.statePatch.value)));
  };

  const toggleQuestionBookmark = (questionId: unknown): void => {
    const slug = getEffectiveSlug();
    const bookmarksReadRequest = buildSurveyResultsBookmarksCacheReadRequest({ slug });
    let bookmarksCache: unknown = {};

    try {
      bookmarksCache = surveyResultsCachePort.peekCacheSync(
        bookmarksReadRequest.namespace,
        bookmarksReadRequest.slug,
        bookmarksReadRequest.options,
      );
    } catch (error) {
      surveyLog.error('[SurveyResults] Error reading bookmarksCache:', error);
      bookmarksCache = {};
    }

    const writePlan = buildSurveyResultsSurveyQuestionBookmarkWritePlan({
      bookmarkId: questionId,
      bookmarkType: 'question',
      bookmarksCache,
      slug,
    });

    if (!writePlan.shouldWrite || !writePlan.payload || !writePlan.statePatch) return;

    void runSurveyResultsSurveyQuestionBookmarkWriteController({
      plan: writePlan,
      ports: {
        writeBookmarksCache: (namespace, cacheSlug, payload) =>
          surveyResultsCachePort.writeCache(namespace, cacheSlug, payload),
      },
    }).then((writeResult) => {
      if (!writeResult.ok && writeResult.error) {
        surveyLog.error('[SurveyResults] Error saving bookmarksCache:', writeResult.error);
      }
    });
    setState(asSurveyResultsStatePatch(buildSurveyResultsBookmarkedQuestionIdsPatch(writePlan.statePatch.value)));
  };

  const getMemoizedIndividualsAggregator = (individualResponses: unknown): SurveyResultsIndividualAggregator => {
    const responsesRef = Array.isArray(individualResponses)
      ? (individualResponses as SurveyResultsSummaryResponseRow[])
      : [];
    const memo = inst._individualResponsesAggregatorMemo;
    if (memo.responsesRef === responsesRef) {
      return memo.result;
    }
    const next = buildSurveyResultsIndividualResponseAggregator(responsesRef);
    inst._individualResponsesAggregatorMemo = {
      responsesRef,
      result: next,
    };
    return next;
  };

  const getMemoizedAggregatorEntries = (aggregator: unknown): SurveyResultsAggregatorEntry[] => {
    const ref = aggregator && typeof aggregator === 'object' ? (aggregator as SurveyResultsRecord) : {};
    const memo = inst._aggregatorEntriesMemo;
    if (memo.aggregatorRef === ref) {
      return memo.entries as SurveyResultsAggregatorEntry[];
    }
    const entries = measureSync('ce.surveyResults.render.aggregatorEntries', () =>
      Object.entries(ref),
    ) as SurveyResultsAggregatorEntry[];
    inst._aggregatorEntriesMemo = {
      aggregatorRef: ref,
      entries,
    };
    return entries;
  };

  const getMemoizedPolisQuestionResponses = (
    polisSelected: unknown,
    sourceAggregator: unknown,
  ): SurveyResultsStringifiedAggregator | null => {
    if (!polisSelected) {
      inst._polisQuestionResponsesMemo = {
        selected: false,
        sourceRef: null,
        result: null,
      };
      return null;
    }
    const sourceRef =
      sourceAggregator && typeof sourceAggregator === 'object' ? (sourceAggregator as SurveyResultsRecord) : {};
    const memo = inst._polisQuestionResponsesMemo;
    if (memo.selected && memo.sourceRef === sourceRef) {
      return memo.result as SurveyResultsStringifiedAggregator;
    }
    const result = measureSync('ce.surveyResults.render.polisPayload', () =>
      stringifySurveyResultsAggregatorResponses(sourceRef),
    ) as SurveyResultsStringifiedAggregator;
    inst._polisQuestionResponsesMemo = {
      selected: true,
      sourceRef,
      result,
    };
    return result;
  };

  const getSurveyResultsResponseCardProps = (): SurveyResultsResponseCardClassNames => ({
    containerClassName: styles.surveyResultsResponseCard,
    bodyClassName: styles.surveyResultsResponseCardBody,
    linksContainerClassName: styles.surveyResultsResponseCardLinks,
    iconButtonClassName: styles.surveyResultsResponseCardLinkButton,
    aggregatorContainerClassName: styles.surveyResultsAggregatorPanel,
    aggregatorTextClassName: styles.surveyResultsAggregatorText,
    aggregatorParagraphClassName: styles.surveyResultsAggregatorParagraph,
    aggregatorFreeformAnswerClassName: styles.surveyResultsFreeformAnswer,
  });

  const renderQuestionSummary = (
    questionId: string,
    responses: unknown,
    preNetworkQuestions?: Record<string, SurveyResultsRecord> | null,
  ): React.ReactNode => {
    const activeSessionSlug = getEffectiveSlug();
    const questionMetadataRead = runSurveyResultsQuestionMetadataReadController({
      identity: {
        activeSessionSlug,
        currentSurveyId: String(stateRef.current.surveyId || ''),
        questionId,
        viewMode: String(stateRef.current.viewMode || propsRef.current.viewMode || 'questions'),
      },
      ports: {
        readNetworkQuestions: getNetworkQuestionsForCurrentContext,
      },
      // Prefer preloaded per-render cache to avoid repeated localStorage hits.
      preloadedNetworkQuestions: preNetworkQuestions,
    });
    const networkQuestions = questionMetadataRead.selectedNetworkQuestions;

    return SurveyResultsQuestionSummary({
      activeQuestionToggles: stateRef.current.activeQuestionToggles,
      activeSessionSlug,
      applyDecryptedOverrideToResponse: applyDecryptedOverrideToResponse,
      bookmarkedQuestionIDs: stateRef.current.bookmarkedQuestionIDs,
      bookmarkIconStyle: SURVEY_RESULTS_CLICKABLE_ICON_STYLE,
      getFallbackQuestion: getStableFallbackQuestion,
      getLockedResponseKey: getLockedResponseKey,
      getResponseCardProps: getSurveyResultsResponseCardProps,
      metadataMissingStyle: SURVEY_RESULTS_METADATA_MISSING_STYLE,
      network: propsRef.current.network,
      networkQuestions,
      onToggleBookmark: toggleQuestionBookmark,
      onToggleSummary: toggleQuestionSummary,
      questionId,
      questionResponsesNonce: propsRef.current.questionResponsesNonce,
      questionsCacheNonce: propsRef.current.questionsCacheNonce,
      responses,
      sbtCacheRevision: propsRef.current.sbtCacheRevision,
      styleMap: styles,
      surveyId: stateRef.current.surveyId,
    });
  };

  const getStableFallbackQuestion = (questionId: unknown, mode: unknown = 'summary'): SurveyResultsFallbackQuestion => {
    if (!inst._stableFallbackQuestions || typeof inst._stableFallbackQuestions !== 'object') {
      inst._stableFallbackQuestions = createSurveyResultsFallbackQuestionBuckets();
    }
    return getSurveyResultsStableFallbackQuestion(inst._stableFallbackQuestions, questionId, mode);
  };

  const getMemoizedQuestionTableEntries = (
    questionMap: unknown = {},
    networkQuestions: unknown = {},
  ): SurveyResultsQuestionTableEntry[] => {
    const { questionIdSortBy, questionIdSortAsc } = stateRef.current;
    const memo = inst._questionTableEntriesMemo;
    if (
      memo.questionMapRef === questionMap &&
      memo.networkQuestionsRef === networkQuestions &&
      memo.sortBy === questionIdSortBy &&
      memo.sortAsc === questionIdSortAsc
    ) {
      return memo.result;
    }

    const entries = buildSurveyResultsQuestionTableEntries({
      networkQuestions,
      questionMap,
      sortAsc: questionIdSortAsc,
      sortBy: questionIdSortBy,
    });

    inst._questionTableEntriesMemo = {
      questionMapRef: questionMap,
      networkQuestionsRef: networkQuestions,
      sortBy: questionIdSortBy,
      sortAsc: questionIdSortAsc,
      result: entries,
    };
    return entries;
  };

  const renderQuestionIDsTable = (questionMap: unknown, preNetworkQuestions: unknown): React.ReactNode => {
    if (!hasEffectiveNetworkId()) return null;
    const networkQuestions = preNetworkQuestions || getNetworkQuestionsForCurrentContext();
    const questionEntries = getMemoizedQuestionTableEntries(questionMap, networkQuestions);
    const { questionIdSortBy, questionIdSortAsc } = stateRef.current;

    return (
      <SurveyResultsQuestionTable
        bookmarkedQuestionIDs={stateRef.current.bookmarkedQuestionIDs}
        entries={questionEntries}
        fallbackSessionSlug={getEffectiveSlug()}
        onSort={changeQuestionIdSort}
        onToggleQuestionBookmark={toggleQuestionBookmark}
        onViewQuestion={(questionId) => {
          // Use setState with a callback to guarantee the scroll happens after the render.
          // This ensures the card is expanded before we attempt to scroll to it.
          setState(
            asSurveyResultsStateUpdater((prevState) =>
              buildSurveyResultsKeyedTogglePatch({
                forceValue: true,
                itemKey: questionId,
                mapKey: 'activeQuestionToggles',
                prevState,
              }),
            ),
            () => {
              scrollToQuestion(questionId);
            },
          );
        }}
        sortAsc={questionIdSortAsc}
        sortBy={questionIdSortBy}
        styleMap={styles}
      />
    );
  };

  const scrollToQuestion = (questionId: unknown): void => {
    const domId = getSurveyResultsQuestionCardDomId(questionId as string | undefined);
    const cleanupScrollWatcher = () => {
      if (inst._scrollToQuestionRetryTimer) {
        clearTimeout(inst._scrollToQuestionRetryTimer);
        inst._scrollToQuestionRetryTimer = null;
      }
      if (inst._scrollMutationObserver) {
        inst._scrollMutationObserver.disconnect();
        inst._scrollMutationObserver = null;
      }
    };

    cleanupScrollWatcher();

    const attemptScroll = (): boolean => {
      const el = document.getElementById(domId);
      if (!el || typeof el.scrollIntoView !== 'function') return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      cleanupScrollWatcher();
      return true;
    };

    if (attemptScroll()) return;

    if (typeof MutationObserver === 'undefined') return;

    const containerToWatch =
      (questionIdTableRef?.current && questionIdTableRef.current.closest(`.${styles.modalBody}`)) ||
      document.querySelector(`.${styles.modalBody}`);

    if (!containerToWatch) return;

    inst._scrollMutationObserver = new MutationObserver(() => {
      attemptScroll();
    });

    inst._scrollMutationObserver.observe(containerToWatch, {
      childList: true,
      subtree: true,
    });

    inst._scrollToQuestionRetryTimer = setTimeout(() => {
      cleanupScrollWatcher();
    }, 2000);
  };

  const changeQuestionIdSort = (column: unknown): void => {
    setState(
      asSurveyResultsStateUpdater((prevState) =>
        buildSurveyResultsQuestionIdSortPatch({
          column,
          prevState,
        }),
      ),
    );
  };

  const toggleQuestionFilter = (): void => {
    setState(
      asSurveyResultsStateUpdater((prevState) =>
        buildSurveyResultsBooleanTogglePatch({
          prevState,
          stateKey: 'showQuestionFilter',
        }),
      ),
    );
  };

  const toggleSurveyViewMode = (mode: unknown): void => {
    setState(asSurveyResultsStatePatch(buildSurveyResultsSurveyViewModePatch(mode)));
  };

  const handleSurveyViewModeToggle = (): void => {
    toggleSurveyViewMode(stateRef.current.surveyViewMode === 'individuals' ? 'aggregate' : 'individuals');
  };

  const handleSurveyViewModeKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSurveyViewModeToggle();
    }
  };

  const toggleExportArea = (): void => {
    setState(
      asSurveyResultsStateUpdater((prevState) =>
        buildSurveyResultsBooleanTogglePatch({
          prevState,
          stateKey: 'exportAreaOpen',
        }),
      ),
    );
  };

  const handleManualRefresh = async (): Promise<void> => {
    try {
      const slug = getEffectiveSlug();
      await runSurveyResultsManualRefreshStatusApplicationController({
        ports: {
          applyRefreshState: (statePatch, afterApply) => {
            return new Promise<void>((resolve, reject) => {
              setState(asSurveyResultsStatePatch(statePatch), () => {
                void Promise.resolve()
                  .then(afterApply)
                  .then(resolve, reject);
              });
            });
          },
          dispatchManualRefresh: () =>
            runSurveyResultsManualRefreshDispatchController({
              ports: {
                onQuestionMetadataRefreshAvailable: () => surveyLog.log('refreshQuestionMetadata present'),
                refreshQuestionMetadata: propsRef.current.refreshQuestionMetadata,
                refreshQuestionResponses: propsRef.current.refreshQuestionResponses,
                refreshSurveyResponsesByID: propsRef.current.refreshSurveyResponsesByID,
              },
              surveyId: stateRef.current.surveyId,
              viewMode: stateRef.current.viewMode,
            }),
          pollLocalStorageForUpdates,
          queueResultsRefresh,
          readLatestBlock: () =>
            chainScanReadsPort.getLatestBlockNumber(propsRef.current.provider as string | undefined, slug),
          resetLocalStoragePollingBackoff,
        },
      });
    } catch (error) {
      surveyLog.error('handleManualRefresh error:', error);
    }
  };

  const getHtmlReportModalProps = (): SurveyResultsHtmlReportExportModalProps => {
    const exportedAt = stateRef.current.htmlReportExportedAt || new Date().toISOString();
    const snapshot = buildSessionResultsHtmlReportSnapshot(exportedAt);
    const selectedSections = getHtmlReportSelectedSections();
    const isAuthorized = isHtmlReportExportAuthorized();
    const analysisPayload = buildSessionResultsAnalysisPayloadForAi();

    return buildSurveyResultsHtmlReportModalProps({
      analysisGenerating: stateRef.current.htmlReportAnalysisGenerating,
      analysisPayload,
      analysisProgress: stateRef.current.htmlReportAnalysisProgress,
      exportFormat: stateRef.current.htmlReportExportFormat,
      htmlReportAnalysisError: stateRef.current.htmlReportAnalysisError,
      isAuthorized,
      isDemoMode: isHtmlReportDemoModeActive(),
      isDemoSession: isHtmlReportDemoSession(),
      isOpen: stateRef.current.htmlReportModalOpen,
      onClose: closeHtmlReportExportModal,
      onDownload: downloadHtmlReport,
      onFormatChange: handleHtmlReportFormatChange,
      onGenerateAnalysis: generateHtmlReportAnalysisViews,
      onToggleDemoMode: toggleHtmlReportDemoMode,
      onToggleSection: toggleHtmlReportSection,
      selectedSections,
      snapshot,
      styleMap: styles,
    });
  };

  function runComponentDidUpdate(prevProps: SurveyResultsProps, prevState: SurveyResultsState): void {
    runSurveyResultsComponentDidUpdate({
      instance: inst,
      ports: {
        appendSessionHintToSurveyPath,
        applyStatePatch: (patch, afterApply) => {
          setState(asSurveyResultsStatePatch(patch), afterApply);
        },
        buildQuestionReadScopeSignature,
        handleNonceTick,
        queueResultsRefresh,
        resetLocalStoragePollingBackoff,
        stopLocalStoragePolling,
        updateLocalStoragePollingState,
        updateParentWithCurrentFiltersForUrl,
      },
      prevProps,
      prevState,
      props: propsRef.current,
      state: stateRef.current,
    });
  }

  const lifecyclePrevRef = useRef<{ props: SurveyResultsProps; state: SurveyResultsState } | null>(null);
  // Class parity: componentDidUpdate runs synchronously after every commit except the first.
  useLayoutEffect(() => {
    const prev = lifecyclePrevRef.current;
    lifecyclePrevRef.current = { props, state };
    if (prev) {
      runComponentDidUpdate(prev.props, prev.state);
    }
  });

  // Class parity: setState(_, callback) callbacks fire after the state commit,
  // after componentDidUpdate (this effect is declared after the one above).
  useLayoutEffect(() => {
    const callbacks = pendingSetStateCallbacksRef.current;
    if (callbacks.length === 0) return;
    pendingSetStateCallbacksRef.current = [];
    callbacks.forEach((callback) => callback());
  }, [state]);

  // Class parity: componentDidMount / componentWillUnmount.
  useLayoutEffect(() => {
    return runSurveyResultsComponentDidMount({
      instance: inst,
      ports: {
        appendSessionHintToSurveyPath,
        applyStatePatch: (patch, afterApply) => {
          setState(asSurveyResultsStatePatch(patch), afterApply);
        },
        destroyFetchResponsesRuntime: () => fetchResponsesRuntime.destroy(),
        destroyLocalStoragePollingRuntime: () => localStoragePollingRuntime.destroy(),
        destroyQueuedResultsRefreshRuntime: () => queuedResultsRefreshRuntime.destroy(),
        getProps: () => propsRef.current,
        getState: () => stateRef.current,
        handleDocumentVisibilityChange,
        handleManagedCacheUpdate: (update) => {
          handleManagedCacheUpdate(
            update && typeof update === 'object' ? (update as SurveyResultsManagedCacheUpdate) : {},
          );
        },
        handleManualRefresh,
        handleUrlBasedView,
        handleUrlChange,
        queueResultsRefresh,
        reportDetachedRefreshError: (operation, error) => {
          surveyLog.error(`[SurveyResults] ${operation} failed:`, error);
        },
        subscribeCacheUpdates: (listener) => surveyResultsCachePort.subscribeCacheUpdates(listener),
        updateLocalStoragePollingState,
        updateParentWithCurrentFiltersForUrl,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return renderSurveyResultsRenderSurface({
    applyDecryptedOverrideToResponse,
    closeModal,
    displayStyles: {
      documentLinkIconStyle: SURVEY_RESULTS_DOCUMENT_LINK_ICON_STYLE,
      miniBarSpinnerStyle: SURVEY_RESULTS_MINI_BAR_SPINNER_STYLE,
      miniProgressStyle: SURVEY_RESULTS_MINI_PROGRESS_STYLE,
      remainingSpinnerStyle: SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE,
      resolveSyncDetailsStyle: resolveSurveyResultsSyncDetailsStyle,
      resolveToggleKnobStyle: resolveSurveyResultsToggleKnobStyle,
      surveyBookmarkStyle: SURVEY_RESULTS_SURVEY_BOOKMARK_STYLE,
      trailingLabelStyle: SURVEY_RESULTS_TRAILING_LABEL_STYLE,
    },
    downloadCSV,
    getEffectiveSlug,
    getFallbackQuestion: getStableFallbackQuestion,
    getHtmlReportModalProps,
    getIsDemoQuestionResultsContext,
    getLockedResponseKey,
    getMemoizedAggregatorEntries,
    getMemoizedIndividualsAggregator,
    getMemoizedLockedResponsesModel: (questions) =>
      getMemoizedLockedResponsesModel(questions as Record<string, SurveyResultsQuestionWithEncryption>),
    getMemoizedPolisQuestionResponses,
    getMemoizedQuestionFilterQuestions,
    getQuestionFilterStorageKeyPrefix,
    getResponseCardProps: getSurveyResultsResponseCardProps,
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
    isOpen: propsRef.current.isOpen,
    onToggleSyncDetails: () =>
      setState(
        asSurveyResultsStateUpdater((prevState) =>
          buildSurveyResultsBooleanTogglePatch({
            prevState,
            stateKey: 'syncDetailsOpen',
          }),
        ),
      ),
    openHtmlReportExportModal,
    props: propsRef.current,
    questionFilterRef,
    questionIdTableRef,
    renderQuestionSummary: (qId, arr, preNetworkQuestions) => renderQuestionSummary(qId, arr, preNetworkQuestions),
    renderQuestionTable: (questionMap, preNetworkQuestions) => renderQuestionIDsTable(questionMap, preNetworkQuestions),
    stableSetFilterLoading: stableSetFilterLoadingRef.current,
    state: stateRef.current,
    styleMap: styles,
    syncLoadingStartedAt: inst._syncLoadingStartedAt,
    toggleExportArea,
    toggleLockedResponseDetails,
    toggleQuestionFilter,
    toggleQuestionSummary,
    toggleResponse,
    toggleSurveyBookmark,
  });
};

const mapStateToProps = (state: SurveyResultsRecord = {}) => {
  const sessionState = toSurveyResultsRecord(state.sessionState);
  const profile = toSurveyResultsRecord(state.profile);
  const activeSessionSlug = String(sessionState.activeSessionSlug || '');
  return {
    activeSessionSlug,
    account: String(profile.account || ''),
    loginComplete: !!sessionState.loginComplete,
  };
};
export default connect(mapStateToProps)(SurveyResults);
