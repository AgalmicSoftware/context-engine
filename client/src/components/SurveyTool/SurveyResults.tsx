/** @file SurveyResults.tsx */

import React, { Component, Suspense } from 'react';
import { connect } from 'react-redux';
import {
  Alert,
  Button,
  FormGroup,
  Label,
  Input,
  Form,
  Card,
  CardHeader,
  CardBody,
  FormText,
  InputGroup,
  InputGroupText,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Table,
  Collapse
} from 'reactstrap';


import "../../assets/css/contextEngine.scss";
import styles from './SurveyResults.module.scss';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretUp,
  faCaretDown,
  faCheck,
  faTimes,
  faArrowLeft,
  faArrowRight,
  faQuestionCircle,
  faSearch,
  faExpand,
  faFilter,
  faExclamationCircle
} from '@fortawesome/free-solid-svg-icons';

import contractScripts, {
  getAllSessionSlugs,
  getSessionConfigBySlug,
} from '../../utilities/web3/contractScripts.js';
import { getShortenedAddress, getShortenedSurveyID } from 'utilities/ui/displayHelpers.js';
import SBTFilter from '../SBTs/SBTFilter';
import QuestionFilter from './QuestionFilter';
import PolisReport from '../PolisReport/PolisReport';
import SingleQuestionResponse from './SingleQuestionResponse';
import { serializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { isFreeformBlankAnswer } from '../../utilities/survey/freeformAnswerUtils.js';
import { createLogger } from 'utilities/logging.js';
import {
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
} from '../../utilities/survey/questionRouting.js';
import {
  listNamespaceEntriesSync,
  peekCacheSync,
  readCache,
  subscribeCacheUpdates,
  writeCache,
} from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { buildResponseGatePolicy } from '../../utilities/crypto/litGatePolicy.js';
import { resolveSbtDisplayLabel } from '../../utilities/sbt/sbtDisplayNames.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { callAI } from '../../utilities/ai/aiScripts.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import LazyFallback from '../Shared/LazyFallback';
import {
  resolveSurveyResultsExplicitSessionSlug,
  resolveSurveyResultsQuestionReadScope,
  resolveSurveyResultsSessionContext,
  scanSurveyResultsSessionSlugFromCache,
} from './surveyResultsSessionResolution.js';
import {
  buildSurveyResultsAlertMessagePatch,
  buildSurveyResultsBookmarkFeedbackPatch,
  buildSurveyResultsBookmarkedQuestionIdsPatch,
  buildSurveyResultsBookmarkedSurveyIdsPatch,
  buildSurveyResultsBooleanTogglePatch,
  buildSurveyResultsCsvFileNamePatch,
  buildSurveyResultsDemoAtlasOpenPatch,
  buildSurveyResultsDemoAtlasNodePatch,
  buildSurveyResultsDemoViewSelectPatch,
  buildSurveyResultsEmptySurveyModePatch,
  buildSurveyResultsExportTypePatch,
  buildSurveyResultsFilterActivePatch,
  buildSurveyResultsFilterLoadingStatePatch,
  buildSurveyResultsFilterLoadingUpdate,
  buildSurveyResultsFilteredQuestionModeHydratedPatch,
  buildSurveyResultsFilteredQuestionsCountPatch,
  buildSurveyResultsKeyedTogglePatch,
  buildSurveyResultsLockedResponsesDecryptCompletePatch,
  buildSurveyResultsLockedResponsesDecryptingPatch,
  buildSurveyResultsNetworkLatestBlockPatch,
  buildSurveyResultsQuestionIdSortPatch,
  buildSurveyResultsQuestionFilterCountPatch,
  buildSurveyResultsSurveyModeHydratedPatch,
  buildSurveyResultsSurveyViewModePatch,
  buildSurveyResultsUnfilteredQuestionModeHydratedPatch,
  buildSurveyResultsViewStatePatch,
  buildSurveyRespondersPayloadRefSignature,
  buildSurveyRespondersSignature,
  countQuestionModeResponses,
  formatTsForCsv,
  getSurveyResponseAggregateTimestampMs,
  getSurveyResponseQuestionId,
  hasAnyCountableSurveyAnswer,
  normalizeSurveyResponsePayloadByQuestionId,
  pickTimestampMs,
  stableSerializeSignatureValue,
  toggleSurveyResultsLockedResponseDetailsPatch,
  type SurveyResultsAggregateRow,
  type SurveyResultsSurveyResponsePayload,
} from './surveyResultsHelpers.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import {
  SurveyResultsLockedResponsesBanner,
  SurveyResultsLockedResponsesToggle,
} from './SurveyResultsLockedResponsesPanel';
import {
  SurveyResultsFreeformAggregatorSummary,
  SurveyResultsMultichoiceAggregatorSummary,
} from './SurveyResultsAggregatorSummaries';
import {
  buildSurveyResultsFreeformSummaryModel,
  buildSurveyResultsMultichoiceSummaryModel,
  getSurveyResultsLatestResponsesByResponder,
  resolveSurveyResultsSummaryQuestionType,
} from './surveyResultsSummaryModels';
import {
  renderSurveyResultsFilterSummary,
  renderSurveyResultsSyncStatusPanel,
} from './SurveyResultsPanels';
import {
  isSurveyResultsStateSynced,
  type SurveyResultsSyncStateLike,
} from './surveyResultsSyncHelpers.js';
import {
  SURVEY_RESULTS_EXPORT_TYPES as EXPORT_TYPES,
  buildSurveyResultsExportControlsDisplayDescriptor,
} from './surveyResultsExportDisplayHelpers.js';
import { buildSurveyResultsFilterSummaryDisplayPlan } from './surveyResultsFilterStatusController';
import { buildSurveyResultsSyncStatusDisplayPlan } from './surveyResultsSyncStatusController';
import {
  runSurveyResultsBrowserDownload,
  runSurveyResultsExportController,
} from './surveyResultsExportController.js';
import {
  buildSessionResultsAnalysisAiPayload,
  buildSessionResultsAnalysisInputSignature,
  buildSessionResultsAnalysisPrompt,
  buildRedactedSessionResultsSnapshot,
  buildSessionResultsHtmlReportFilename,
  buildSessionResultsPdfReportFilename,
  downloadSessionResultsHtmlReport,
  downloadSessionResultsPdfReport,
  evaluateSessionResultsAnalysisEligibility,
  normalizeGeneratedSessionResultsAnalysisArtifact,
  renderSessionResultsHtmlReport,
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  shortenSessionResultsAddress,
  type SessionResultsAnalysisResponseInput,
  type SessionResultsExportFormat,
  type SessionResultsGeneratedAnalysisArtifact,
  type SessionResultsHtmlSnapshot,
  type SessionResultsReportQuestion,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import SurveyResultsExportControls from './SurveyResultsExportControls';
import SurveyResultsIndividualResponsesList from './SurveyResultsIndividualResponsesList';
import SurveyResultsModalHeader from './SurveyResultsModalHeader';
import SurveyResultsQuestionListCard from './SurveyResultsQuestionListCard';
import SurveyResultsQuestionSummaryCard from './SurveyResultsQuestionSummaryCard';
import SurveyResultsQuestionSummariesList from './SurveyResultsQuestionSummariesList';
import SurveyResultsQuestionTable from './SurveyResultsQuestionTable';
import SurveyResultsStatusMessages from './SurveyResultsStatusMessages';
import SurveyResultsSurveyViewModeToggle from './SurveyResultsSurveyViewModeToggle';

export {
  SURVEY_RESULTS_SORTABLE_HEADER_STYLE,
  SURVEY_RESULTS_TABLE_BOOKMARK_STYLE,
  SURVEY_RESULTS_TABLE_CELL_STYLE,
} from './SurveyResultsQuestionTable';

export {
  countQuestionModeResponses,
  hasAnyCountableSurveyAnswer,
} from './surveyResultsHelpers.js';

const surveyLog = createLogger('surveys');
const DemoAnalysisWorkspace = React.lazy(() => import('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace'));
const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
const RiskMatrix = React.lazy(() => import('../MainContent/RiskMatrix'));
const LATEST_BLOCK_POLL_THROTTLE_MS = 8000;
const RESPONSE_PARSE_MEMO_MAX_SIZE = 500;
const LOCAL_STORAGE_POLL_MIN_MS = 2000;
const LOCAL_STORAGE_POLL_MID_MS = 4000;
const LOCAL_STORAGE_POLL_MAX_MS = 12000;
const LOCAL_STORAGE_FORCE_RESCAN_EVERY = 6;
type SurveyResultsWriteCache = (namespace: string, slug: string, value: unknown) => Promise<unknown>;
type SurveyResultsRecord = Record<string, unknown>;
const DebateMapForSurveyResults = DebateMap as React.ComponentType<SurveyResultsRecord>;
type SurveyResultsQuestionReadScopeContext = ReturnType<typeof resolveSurveyResultsQuestionReadScope>;
type SurveyResultsScopeContextInput = {
  props?: SurveyResultsRecord;
  state?: SurveyResultsRecord;
  viewMode?: unknown;
};
type SurveyResultsQuestionRecord = SurveyResultsRecord & {
  __ceQuestionMetadataPending?: unknown;
  id?: unknown;
  sessionSlug?: unknown;
  sessionSlugExplicit?: unknown;
};
type SurveyResultsQuestionResponsesByResponder = Record<string, unknown>;
type SurveyResultsQuestionResponsesByQuestion = Record<string, SurveyResultsQuestionResponsesByResponder>;
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
type SurveyResultsViewableResponsesCountMemoValue = {
  count: number;
  questionType: string;
};
type SurveyResultsBookmarkCache = {
  questions: unknown[];
  surveys: unknown[];
};
type SurveyResultsFiltersCache = SurveyResultsRecord & {
  bookmarkedFilters?: unknown;
};
type SurveyResultsQuestionExportRecord = {
  id: unknown;
  options: unknown[];
  prompt: unknown;
  tags: unknown[];
  type: unknown;
};
type SurveyResultsFallbackQuestion = SurveyResultsRecord & {
  creator?: string;
  id: unknown;
  prompt: string;
  type?: string;
};
type SurveyResultsFallbackQuestionBuckets = {
  individual: Map<string, SurveyResultsFallbackQuestion>;
  summary: Map<string, SurveyResultsFallbackQuestion>;
};
type SurveyResultsQuestionTableEntry = {
  prompt: string;
  questionId: string;
  responsesCount: number;
  sessionSlug: string;
  type: string;
};
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
type SurveyResultsQuestionFilterHandle = {
  handleApplyFilters: (usePendingState?: unknown) => void;
  handleClearFilters: () => void;
};
type SurveyResultsIndividualAggregator = Record<string, SurveyResultsAggregateRow[]>;
type SurveyResultsAggregatorEntry = [string, unknown];
type SurveyResultsStringifiedAggregator = Record<string, SurveyResultsRecord[]>;
type SurveyResultsFreeformDisplayedResponse = {
  additional: string;
  responder: unknown;
  value: unknown;
};
type SurveyResultsFreeformSummaryModel = {
  blankCount: number;
  displayedResponses: SurveyResultsFreeformDisplayedResponse[];
  encryptedCount: number;
  totalResponses: number;
};
type SurveyResultsMultichoiceSummaryOption = {
  count: number;
  key: string;
  label: string;
};
type SurveyResultsMultichoiceSummaryModel = {
  options: SurveyResultsMultichoiceSummaryOption[];
  totalResponders: number;
};
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
type SurveyResultsSessionConfigRecord = SurveyResultsRecord & {
  __registry?: SurveyResultsRecord & { chainId?: unknown };
  networkChainId?: unknown;
  sponsored?: SurveyResultsRecord & { gates?: unknown };
};
type SurveyResultsLockedResponseKeyArgs = {
  questionId?: unknown;
  responder?: unknown;
  response?: SurveyResultsResponseRecord | null;
  surveyId?: unknown;
};
type SurveyResultsQuestionBucketRecord = SurveyResultsRecord & {
  questionResponses?: SurveyResultsQuestionResponsesByQuestion;
  questionResponsesLatestBlock?: unknown;
  questions?: Record<string, SurveyResultsQuestionRecord>;
  questionsLatestBlock?: unknown;
};
type SurveyResultsSurveyBucketRecord = SurveyResultsRecord & {
  surveyResponses?: Record<string, SurveyResultsRecord>;
  surveyResponsesLatestBlock?: Record<string, unknown>;
  surveys?: Record<string, SurveyResultsRecord & { documentURLs?: unknown; questionIDs?: unknown; title?: string }>;
  surveysLatestBlock?: unknown;
};
type SurveyResultsScopedQuestionNetworkData = {
  questionResponses: SurveyResultsQuestionResponsesByQuestion;
  questionResponsesLatestBlock: number;
  questions: Record<string, SurveyResultsQuestionRecord>;
  questionsLatestBlock: number;
};
type SurveyResultsQuestionResponseMergeOptions = {
  allowedQuestionIds?: Set<string> | null;
};
type SurveyResultsScopedQuestionOptions = {
  allowedScopeSlugs?: Set<string> | unknown[] | null;
  bucketSlug?: unknown;
  question?: SurveyResultsQuestionRecord;
  requireAuthoritativeBinding?: boolean;
};
type SurveyResultsScopedQuestionNetworkEntry = {
  bucket?: SurveyResultsQuestionBucketRecord | null;
  slug?: unknown;
};
type SurveyResultsScopedQuestionNetworkOptions = {
  allowedScopeSlugs?: Set<string> | unknown[] | null;
  requireAuthoritativeBinding?: boolean;
};
type SurveyResultsScopedQuestionNetworkMemo = {
  bucketRefs?: unknown[];
  netIdStr?: string;
  requireAuthoritativeBinding?: boolean;
  result?: SurveyResultsScopedQuestionNetworkData;
  slugsKey?: string;
  viewMode?: unknown;
};
type SurveyResultsManagedCacheUpdate = {
  namespace?: unknown;
};
type SurveyResultsFilterQuestionRecord = SurveyResultsRecord & {
  creator?: unknown;
  id?: unknown;
  prompt?: unknown;
  type?: unknown;
};
type SurveyResultsQuestionFilterCombinedPayload = SurveyResultsRecord & {
  filteredQuestions?: unknown;
  filteredResponsesByQuestion?: unknown;
};
type SurveyResultsCsvLatestEntry = {
  ms: number;
  row: string;
};
type SurveyResultsCsvResponseEntry = SurveyResultsRecord & {
  responder?: unknown;
  response?: unknown;
};
type SurveyResultsPollingCountOptions = {
  forceScan?: boolean;
};
type SurveyResultsResponseRecord = SurveyResultsRecord & {
  additional?: SurveyResultsEncryptedFieldRecord | null;
  answer?: SurveyResultsEncryptedFieldRecord | null;
  conviction?: unknown;
  convictionEncrypted?: unknown;
  importanceEncrypted?: unknown;
  importance?: unknown;
  prompt?: unknown;
  questionID?: unknown;
  questionId?: unknown;
  timeStamp?: unknown;
  timestamp?: unknown;
  type?: unknown;
};
type SurveyResultsResponseListEntry = SurveyResultsRecord & {
  response?: (SurveyResultsRecord & { responses?: SurveyResultsRecord[] }) | null;
  responder: string;
  surveyId?: unknown;
};
type SurveyResultsAggregatorLockedResponseRow = SurveyResultsRecord & {
  responder?: unknown;
  response?: SurveyResultsResponseRecord | null;
};
type SurveyResultsLockedGateDetail = {
  address: string;
  href: string;
  label: React.ReactNode;
};
type SurveyResultsLockedRow = SurveyResultsRecord & {
  key: string;
  mergedResponse?: SurveyResultsResponseRecord | null;
  questionId: string;
  responder: string;
  response?: SurveyResultsResponseRecord | null;
  surveyId?: unknown;
};
type SurveyResultsLockedResponsesModel = SurveyResultsRecord & {
  gateDetails?: SurveyResultsLockedGateDetail[];
  hasGenericGateMessage?: boolean;
  lockedCount?: number;
  lockedRows?: SurveyResultsLockedRow[];
};
type SurveyResultsLockedGateContext = {
  configuredGateMap: Record<string, SurveyResultsGateRecord>;
  defaultPolicy: SurveyResultsRecord & { gates?: unknown };
  fallbackChainId: number | null;
  slug: string;
};
type SurveyResultsLockedGateDetailsResult = {
  gateDetails: SurveyResultsLockedGateDetail[];
  hasGenericGateMessage: boolean;
};
type SurveyResultsLockedResponsesModelMemo = {
  aggregatorRef?: unknown;
  overridesRef?: unknown;
  questionLookupRef?: unknown;
  responsesRef?: unknown;
  result?: SurveyResultsLockedResponsesModel;
  slug?: string;
  surveyViewMode?: unknown;
  viewMode?: unknown;
};
type SurveyResultsDecryptFieldResult =
  | { ok: true; value: unknown }
  | { ok: false; error?: unknown };
type SurveyResultsLitHooks = SurveyResultsRecord & {
  getKey?: (...args: unknown[]) => unknown;
};
type SurveyResultsWindowWithLitHooks = Window & {
  __litHooks?: SurveyResultsLitHooks | null;
  litHooks?: SurveyResultsLitHooks | null;
};
type SurveyResultsDecryptedResponseOverride = SurveyResultsRecord & {
  additionalValue?: unknown;
  answerValue?: unknown;
  conviction?: unknown;
  importance?: unknown;
};
type SurveyResultsApplyDecryptedOverrideArgs = {
  key?: unknown;
  response?: SurveyResultsResponseRecord | null;
};
type SurveyResultsGateRecord = SurveyResultsRecord & {
  address?: unknown;
  gateId?: unknown;
  id?: unknown;
  label?: unknown;
  name?: unknown;
  sbtAddress?: unknown;
  sbtAddresses?: unknown;
  sbts?: unknown;
  title?: unknown;
};
type SurveyResultsGateEntry = {
  address: string;
  label: string;
};
type SurveyResultsEncryptedFieldRecord = SurveyResultsRecord & {
  encrypted?: unknown;
  encryptedData?: unknown;
  encryptedEnvelope?: unknown;
  encryptedPortion?: unknown;
  encryptionAudience?: unknown;
  envelope?: unknown;
  isEncrypted?: unknown;
  locked?: unknown;
  payload?: unknown;
  value?: unknown;
  valueEnvelope?: unknown;
};
type SurveyResultsDemoViewOption = {
  key: string;
  label: string;
};
type SurveyResultsHtmlReportSectionAvailability = {
  argumentMap: boolean;
  atlas: boolean;
  report: boolean;
  riskMatrix: boolean;
  snapshotJson: boolean;
};
type SurveyResultsHtmlReportSectionKey = keyof SurveyResultsHtmlReportSectionAvailability;
type SurveyResultsHtmlReportSectionRow = {
  available: boolean;
  key: SurveyResultsHtmlReportSectionKey;
  label: string;
  reason: string;
};
type SurveyResultsSbtDisplayLabelResolver = (args: {
  address: string;
  chainId?: unknown;
  fallback?: string;
  preferredSlug?: unknown;
}) => string;
const toSurveyResultsRecord = (value: unknown): SurveyResultsRecord => (
  value && typeof value === 'object' ? value as SurveyResultsRecord : {}
);
const resolveSbtDisplayLabelForSurveyResults: SurveyResultsSbtDisplayLabelResolver = (args) => (
  (resolveSbtDisplayLabel as unknown as SurveyResultsSbtDisplayLabelResolver)(args)
);

const HTML_REPORT_EXPORT_FORMATS: readonly { description: string; label: string; value: SessionResultsExportFormat }[] = Object.freeze([
  {
    description: 'Interactive local HTML',
    label: 'Exported viewer',
    value: SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  },
  {
    description: 'Static local HTML',
    label: 'Single HTML file',
    value: SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
  },
  {
    description: 'Print-oriented PDF preview',
    label: 'Single-page PDF',
    value: SESSION_RESULTS_EXPORT_FORMAT_PDF,
  },
]);

const DEFAULT_HTML_REPORT_SELECTED_SECTIONS: Required<SessionResultsSectionSelection> = Object.freeze({
  argumentMap: false,
  atlas: false,
  report: true,
  riskMatrix: false,
  snapshotJson: true,
});

const HTML_REPORT_ANALYSIS_SECTION_KEYS: SurveyResultsHtmlReportSectionKey[] = [
  'argumentMap',
  'riskMatrix',
  'atlas',
];
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

export const buildSurveyResultsAggregatorPanelClassName = (
  styleMap: Record<string, string>
) => `${styleMap.surveyResultsAggregatorPanel} ${styleMap.surveyResultsAggregatorText}`;

export const buildSurveyResultsMultichoiceOptionClassName = (
  styleMap: Record<string, string>
) => `${styleMap.surveyResultsFreeformAnswer} ${styleMap.surveyResultsMultichoiceOption}`;

export const resolveSurveyResultsSyncDetailsStyle = (
  syncDetailsOpen: unknown
): React.CSSProperties => ({
  display: syncDetailsOpen ? 'block' : undefined,
});

export const resolveSurveyResultsToggleKnobStyle = (
  isAggregate: unknown
): React.CSSProperties => ({
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

/**
* Helper that merges aggregator keys in lowercase, ensuring zero-response question IDs are included.
*/
function unifyAggregatorWithAllQuestionIDs(
  baseAggregator: Record<string, unknown[]> = {},
  allKnownQuestionIds: string[] = []
): Record<string, unknown[]> {
  const loweredMap: Record<string, unknown[]> = {};
  for (const key of Object.keys(baseAggregator)) {
    const lowerKey = key.toLowerCase();
    if (!loweredMap[lowerKey]) {
      loweredMap[lowerKey] = baseAggregator[key];
    } else {
      loweredMap[lowerKey] = loweredMap[lowerKey].concat(baseAggregator[key]);
    }
  }
  for (const qId of allKnownQuestionIds) {
    const qLower = qId.toLowerCase();
    if (!loweredMap[qLower]) {
      loweredMap[qLower] = [];
    }
  }
  return loweredMap;
}

const INVALID_RESPONSE_TIMESTAMP = Number.NEGATIVE_INFINITY;

const normalizeResponseTimestampMs = (value) => {
  if (value === null || value === undefined || value === '') return INVALID_RESPONSE_TIMESTAMP;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return INVALID_RESPONSE_TIMESTAMP;
    return Math.abs(value) < 1e12 ? Math.floor(value * 1000) : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return INVALID_RESPONSE_TIMESTAMP;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) return INVALID_RESPONSE_TIMESTAMP;
      return Math.abs(numeric) < 1e12 ? Math.floor(numeric * 1000) : numeric;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? INVALID_RESPONSE_TIMESTAMP : parsed;
  }
  return INVALID_RESPONSE_TIMESTAMP;
};

const getSurveyResponseQuestionId = (row = {}) => (
  String(row?.questionID || row?.questionId || '').trim().toLowerCase()
);

const getSurveyResponseEntryTimestampMs = (row = {}) => (
  normalizeResponseTimestampMs(row?.timestamp ?? row?.timeStamp)
);

const getSurveyResponsePayloadTimestampMs = (payload = {}) => (
  normalizeResponseTimestampMs(payload?.timestamp ?? payload?.timeStamp)
);

const getSurveyResponseAggregateTimestampMs = (row = {}, payload = {}) => {
  const entryTimestamp = getSurveyResponseEntryTimestampMs(row);
  const payloadTimestamp = getSurveyResponsePayloadTimestampMs(payload);
  // Regression guard: merged survey payloads can advance the top-level recency
  // without rewriting preserved per-question rows. Keep the newer of the two so
  // stale row timestamps do not pin an older answer ahead of a newer payload edit.
  if (
    entryTimestamp === INVALID_RESPONSE_TIMESTAMP &&
    payloadTimestamp === INVALID_RESPONSE_TIMESTAMP
  ) {
    return 0;
  }
  if (entryTimestamp === INVALID_RESPONSE_TIMESTAMP) return payloadTimestamp;
  if (payloadTimestamp === INVALID_RESPONSE_TIMESTAMP) return entryTimestamp;
  return Math.max(entryTimestamp, payloadTimestamp);
};

const isSurveyQuestionResponseNewer = (candidate, existing) => {
  // Regression guard: current client edits may advance only the payload timestamp.
  // Compare effective recency first, then payload recency, and let later array
  // order win within the same payload revision so stale per-answer timestamps do
  // not pin an older answer ahead of a newer payload-backed edit.
  if (candidate.aggregateTimestampMs !== existing.aggregateTimestampMs) {
    return candidate.aggregateTimestampMs > existing.aggregateTimestampMs;
  }
  if (candidate.payloadTimestampMs !== existing.payloadTimestampMs) {
    return candidate.payloadTimestampMs > existing.payloadTimestampMs;
  }
  if (
    candidate.payloadTimestampMs !== INVALID_RESPONSE_TIMESTAMP &&
    candidate.payloadTimestampMs === existing.payloadTimestampMs
  ) {
    return candidate.index >= existing.index;
  }
  if (candidate.entryTimestampMs !== existing.entryTimestampMs) {
    return candidate.entryTimestampMs > existing.entryTimestampMs;
  }
  return candidate.index >= existing.index;
};

const normalizeSurveyResponsePayloadByQuestionId = (payload) => {
  const source = (payload && typeof payload === 'object') ? payload : null;
  if (!source) return payload;
  if (!Array.isArray(source.responses)) return { ...source };

  const payloadTimestampMs = getSurveyResponsePayloadTimestampMs(source);
  const passthroughRows = [];
  const latestByQuestionId = new Map();

  source.responses.forEach((row, index) => {
    const clonedRow = (row && typeof row === 'object') ? { ...row } : row;
    const questionId = getSurveyResponseQuestionId(row);
    if (!questionId) {
      passthroughRows.push({
        index,
        orderIndex: index,
        row: clonedRow,
      });
      return;
    }

    const candidate = {
      index,
      orderIndex: index,
      row: clonedRow,
      entryTimestampMs: getSurveyResponseEntryTimestampMs(row),
      payloadTimestampMs,
      aggregateTimestampMs: getSurveyResponseAggregateTimestampMs(row, source),
    };
    const existing = latestByQuestionId.get(questionId);
    if (!existing || isSurveyQuestionResponseNewer(candidate, existing)) {
      latestByQuestionId.set(questionId, {
        ...candidate,
        // Keep the original slot while replacing only the row contents.
        orderIndex: existing?.orderIndex ?? index,
      });
    }
  });

  const normalizedResponses = [
    ...passthroughRows,
    ...Array.from(latestByQuestionId.values()),
  ]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((entry) => entry.row);

  return {
    ...source,
    responses: normalizedResponses,
  };
};

/** Prefix-preserver used by SurveySelector */
const readPathSearch = (path: unknown = ''): string => {
  const value = String(path || '');
  const queryIndex = value.indexOf('?');
  return queryIndex >= 0 ? value.slice(queryIndex) : '';
};

const hasExplicitSessionQueryPinInPath = (path: unknown = ''): boolean => {
  const search = readPathSearch(path);
  return (
    parseQuestionSessionSlugFromSearch(search) !== null ||
    parseQuestionSessionIdFromSearch(search) !== null
  );
};

function applyExistingGroupPrefix(newPath: string) {
  try {
    if (hasExplicitSessionQueryPinInPath(newPath)) return newPath;
    const p = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
    const pathOnly = p.split('?')[0].split('#')[0];
    const segs = pathOnly.split('/').filter(Boolean);
    const RESERVED: Set<string> = new Set(['questions','question','survey','surveys']);
    if (segs.length >= 2 && !RESERVED.has(segs[0])) {
      const base = `/${segs[0]}/${segs[1]}`;
      if (!newPath.startsWith(base)) {
        return `${base}${newPath.startsWith('/') ? '' : '/'}${newPath}`;
      }
    }
  } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
  return newPath;
}

function resolveNetBucketReadOnly(cacheObj: unknown, netIdStr: unknown, fallbackValue: unknown): unknown {
  const fallback = fallbackValue === undefined ? {} : fallbackValue;
  if (!cacheObj || typeof cacheObj !== 'object' || !netIdStr) return fallback;
  const bucket = (cacheObj as SurveyResultsRecord)[String(netIdStr)];
  return (bucket && typeof bucket === 'object') ? bucket : fallback;
}

const EMPTY_SCOPED_QUESTION_NETWORK_DATA = Object.freeze({
  questions: {},
  questionResponses: {},
  questionsLatestBlock: 0,
  questionResponsesLatestBlock: 0,
}) as SurveyResultsScopedQuestionNetworkData;

function mergeQuestionResponsesByQuestion(
  accumulator: SurveyResultsQuestionResponsesByQuestion = {},
  questionResponses: unknown = {},
  options: SurveyResultsQuestionResponseMergeOptions = {}
): SurveyResultsQuestionResponsesByQuestion {
  const target = (accumulator && typeof accumulator === 'object') ? accumulator : {};
  const source = (
    questionResponses && typeof questionResponses === 'object'
      ? questionResponses as SurveyResultsQuestionResponsesByQuestion
      : {}
  );
  const allowedQuestionIds = options.allowedQuestionIds instanceof Set
    ? options.allowedQuestionIds
    : null;
  Object.keys(source).forEach((questionId) => {
    const lowerQuestionId = String(questionId || '').trim().toLowerCase();
    if (!lowerQuestionId) return;
    if (allowedQuestionIds && !allowedQuestionIds.has(lowerQuestionId)) return;
    const responderMap = source[questionId];
    if (!responderMap || typeof responderMap !== 'object') return;
    if (!target[lowerQuestionId] || typeof target[lowerQuestionId] !== 'object') {
      target[lowerQuestionId] = {};
    }
    const targetResponderMap = target[lowerQuestionId];
    Object.keys(responderMap).forEach((responder) => {
      targetResponderMap[responder] = responderMap[responder];
    });
  });
  return target;
}

const hasAuthoritativeQuestionSessionSlug = (question: SurveyResultsQuestionRecord = {}): boolean => (
  hasOwn(question, 'sessionSlug') && question?.sessionSlugExplicit === true
);

const isPendingQuestionMetadataPlaceholder = (question: SurveyResultsQuestionRecord = {}): boolean => (
  !!question && question.__ceQuestionMetadataPending === true
);

const resolveScopedQuestionSessionSlug = (
  question: SurveyResultsQuestionRecord = {},
  bucketSlug: unknown = ''
): string => {
  const normalizedBucketSlug = normalizeSessionSlug(bucketSlug || '');
  const normalizedQuestionSlug = normalizeSessionSlug(question?.sessionSlug || '');
  if (hasAuthoritativeQuestionSessionSlug(question)) return normalizedQuestionSlug;
  if (hasOwn(question, 'sessionSlug') && question?.sessionSlugExplicit === false) {
    return normalizedBucketSlug;
  }
  return normalizedQuestionSlug || normalizedBucketSlug;
};

const shouldKeepScopedQuestion = ({
  question = {},
  bucketSlug = '',
  allowedScopeSlugs = [],
  requireAuthoritativeBinding = false,
}: SurveyResultsScopedQuestionOptions = {}): boolean => {
  const scopeSet = allowedScopeSlugs instanceof Set
    ? allowedScopeSlugs
    : new Set(
      (Array.isArray(allowedScopeSlugs) ? allowedScopeSlugs : [])
        .map((slug) => normalizeSessionSlug(slug || ''))
    );
  if (!scopeSet.size) return true;
  const normalizedQuestionSlug = normalizeSessionSlug(question?.sessionSlug || '');
  if (isPendingQuestionMetadataPlaceholder(question)) return false;
  if (requireAuthoritativeBinding) {
    return hasAuthoritativeQuestionSessionSlug(question) && scopeSet.has(normalizedQuestionSlug);
  }
  return scopeSet.has(resolveScopedQuestionSessionSlug(question, bucketSlug));
};

function mergeScopedQuestionNetworkData(
  networkEntries: SurveyResultsScopedQuestionNetworkEntry[] = [],
  options: SurveyResultsScopedQuestionNetworkOptions = {}
): SurveyResultsScopedQuestionNetworkData {
  if (!Array.isArray(networkEntries) || networkEntries.length === 0) {
    return EMPTY_SCOPED_QUESTION_NETWORK_DATA;
  }

  const mergedQuestions: Record<string, SurveyResultsQuestionRecord> = {};
  const mergedQuestionResponses: SurveyResultsQuestionResponsesByQuestion = {};
  const allowedScopeSlugs = options.allowedScopeSlugs instanceof Set
    ? options.allowedScopeSlugs
    : new Set(
      (Array.isArray(options.allowedScopeSlugs) ? options.allowedScopeSlugs : [])
        .map((slug) => normalizeSessionSlug(slug || ''))
    );
  const requireAuthoritativeBinding = options.requireAuthoritativeBinding === true;
  let questionsLatestBlock = 0;
  let questionResponsesLatestBlock = 0;

  networkEntries.forEach(({ slug = '', bucket = {} }) => {
    const questionBucket = (
      bucket && typeof bucket === 'object'
        ? bucket as SurveyResultsQuestionBucketRecord
        : {}
    );
    const allowedQuestionIds: Set<string> = new Set();
    const questions = (
      questionBucket.questions && typeof questionBucket.questions === 'object'
        ? questionBucket.questions
        : {}
    );
    Object.keys(questions).forEach((questionId) => {
      const lowerQuestionId = String(questionId || '').trim().toLowerCase();
      if (!lowerQuestionId) return;
      const question = questions[questionId] || {};
      if (!shouldKeepScopedQuestion({
        question,
        bucketSlug: slug,
        allowedScopeSlugs,
        requireAuthoritativeBinding,
      })) return;
      allowedQuestionIds.add(lowerQuestionId);
      if (Object.prototype.hasOwnProperty.call(mergedQuestions, lowerQuestionId)) return;
      mergedQuestions[lowerQuestionId] = {
        id: question?.id || questionId,
        ...(question || {}),
        sessionSlug: resolveScopedQuestionSessionSlug(question, slug),
      };
    });

    mergeQuestionResponsesByQuestion(
      mergedQuestionResponses,
      questionBucket.questionResponses || {},
      { allowedQuestionIds }
    );
    questionsLatestBlock = Math.max(questionsLatestBlock, Number(questionBucket.questionsLatestBlock || 0));
    questionResponsesLatestBlock = Math.max(
      questionResponsesLatestBlock,
      Number(questionBucket.questionResponsesLatestBlock || 0)
    );
  });

  return {
    questions: mergedQuestions,
    questionResponses: mergedQuestionResponses,
    questionsLatestBlock,
    questionResponsesLatestBlock,
  };
}

const normalizeNonceKey = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasOwn = (obj: unknown, key: PropertyKey): boolean => (
  !!obj && Object.prototype.hasOwnProperty.call(obj, key)
);

const normalizeGateSbtEntries = (
  gate: SurveyResultsGateRecord | null = null
): SurveyResultsGateEntry[] => {
  const out: SurveyResultsGateEntry[] = [];
  const seen: Set<string> = new Set();
  const push = (address: unknown, label: unknown = ''): void => {
    const normalizedAddress = typeof address === 'string'
      ? address.trim()
      : address == null
        ? ''
        : String(address).trim();
    if (!normalizedAddress) return;
    const key = normalizedAddress.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      address: normalizedAddress,
      label: typeof label === 'string' ? label.trim() : '',
    });
  };

  if (Array.isArray(gate?.sbts)) {
    gate.sbts.forEach((entry: unknown) => {
      if (typeof entry === 'string') {
        push(entry);
        return;
      }
      const entryRecord = entry as SurveyResultsGateRecord | null | undefined;
      push(
        entryRecord?.address || entryRecord?.sbtAddress || '',
        entryRecord?.label || entryRecord?.name || entryRecord?.title || ''
      );
    });
  }

  if (Array.isArray(gate?.sbtAddresses)) {
    gate.sbtAddresses.forEach((address: unknown) => push(address));
  }
  if (gate?.sbtAddress) push(gate.sbtAddress);

  return out;
};

const hasEnvelopeShape = (value: unknown): value is SurveyResultsEncryptedFieldRecord => {
  if (!value || typeof value !== 'object') return false;
  return [
    'ciphertext',
    'encryptedString',
    'encryptedData',
    'dataToEncryptHash',
    'accessControlConditions',
    'chain',
    'iv',
    'salt',
  ].some((key) => hasOwn(value, key));
};

const extractEnvelopeCandidate = (
  field: SurveyResultsEncryptedFieldRecord | null | undefined
): unknown | null => {
  if (!field || typeof field !== 'object') return null;

  const directEnvelope = field.encryptedPortion || field.envelope || field.encryptedEnvelope || null;
  if (typeof directEnvelope === 'string' && directEnvelope.trim()) return directEnvelope.trim();
  if (directEnvelope && typeof directEnvelope === 'object') return directEnvelope;

  if (field.payload && typeof field.payload === 'object' && hasEnvelopeShape(field.payload)) {
    return field.payload;
  }
  if (field.valueEnvelope && typeof field.valueEnvelope === 'object' && hasEnvelopeShape(field.valueEnvelope)) {
    return field.valueEnvelope;
  }

  if (hasEnvelopeShape(field)) return field;
  return null;
};

const hasVisibleFieldValue = (field: SurveyResultsEncryptedFieldRecord | null | undefined): boolean => {
  if (!field || typeof field !== 'object' || !hasOwn(field, 'value')) return false;
  if (field.value === '*') return false;
  if (field.value === null || field.value === undefined) return false;
  return true;
};

const isLockedEncryptedField = (field: SurveyResultsEncryptedFieldRecord | null | undefined): boolean => {
  if (!field || typeof field !== 'object') return false;
  const flaggedLocked = field.locked === true;
  const flaggedEncrypted = field.isEncrypted === true || field.encrypted === true;
  const envelope = extractEnvelopeCandidate(field);
  if (!flaggedLocked && !flaggedEncrypted && !envelope) return false;
  if (flaggedLocked) return true;
  return !hasVisibleFieldValue(field);
};

const getFieldEncryptionAudience = (field: SurveyResultsEncryptedFieldRecord | null | undefined): string => (
  typeof field === 'object' && field
    ? String(field.encryptionAudience || '').trim().toLowerCase()
    : ''
);

const isBannerEligibleLockedField = (field: SurveyResultsEncryptedFieldRecord | null | undefined): boolean => (
  isLockedEncryptedField(field) && getFieldEncryptionAudience(field) !== 'self'
);

const normalizeGateText = (value: unknown): string => {
  const raw = (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
  if (!raw) return '';
  if (/^\[object\s+object\]$/i.test(raw)) return '';
  return raw;
};

const buildLockedResponseSignature = (response: SurveyResultsResponseRecord = {}): string => stableSerializeSignatureValue({
  questionId: response?.questionID || response?.questionId || '',
  timestamp: response?.timeStamp || response?.timestamp || 0,
  answerHash: response?.answer?.hash || '',
  additionalHash: response?.additional?.hash || '',
  answerValue: response?.answer?.value,
  additionalValue: response?.additional?.value,
  answerEncrypted: response?.answer?.encrypted,
  additionalEncrypted: response?.additional?.encrypted,
  answerEnvelope: extractEnvelopeCandidate(response?.answer),
  additionalEnvelope: extractEnvelopeCandidate(response?.additional),
  importanceEncrypted: response?.importanceEncrypted || '',
  convictionEncrypted: response?.convictionEncrypted || '',
});

const getFilterStateSignature = (
  filterState: unknown
): string => serializeFilterState(filterState as SurveyResultsRecord | null | undefined) || '';
const areValuesEquivalentBySignature = (currentValue: unknown, nextValue: unknown): boolean => {
  if (currentValue === nextValue) return true;
  if (currentValue == null || nextValue == null) return currentValue === nextValue;
  if (typeof currentValue !== 'object' && typeof nextValue !== 'object') {
    return currentValue === nextValue;
  }
  return stableSerializeSignatureValue(currentValue) === stableSerializeSignatureValue(nextValue);
};

const getConvictionValue = (obj: SurveyResultsResponseRecord | null | undefined): unknown => {
  if (!obj || typeof obj !== 'object') return '';
  if (obj.conviction !== undefined && obj.conviction !== null) return obj.conviction;
  if (obj.importance !== undefined && obj.importance !== null) return obj.importance;
  return '';
};

const getResponseQuestionId = (obj: SurveyResultsResponseRecord | null | undefined): string => (
  String(obj?.questionID || obj?.questionId || '').trim()
);

const getResponseQuestionPrompt = (
  obj: SurveyResultsResponseRecord | null | undefined,
  questionData: SurveyResultsRecord | null = null
): unknown => (
  obj?.prompt || questionData?.prompt || ''
);

const getResponseQuestionType = (
  obj: SurveyResultsResponseRecord | null | undefined,
  questionData: SurveyResultsRecord | null = null
): unknown => (
  obj?.type || questionData?.type || ''
);


/**
 * A single place to generate the DOM id used
 * by every question-card element.
 *  – always lower-cases the questionId
 *  – strips characters that are invalid in an HTML id
 */
const getQuestionCardDomId = (questionId: string = ''): string =>
  `questionCard-${questionId.toLowerCase()}`;

class SurveyResults extends Component<any, any> {
  _syncLoadingStartedAt: number | null;
  _scrollMutationObserver: MutationObserver | null;
  _scrollToQuestionRetryTimer: ReturnType<typeof setTimeout> | null;
  questionIdTableRef: React.RefObject<HTMLDivElement>;
  questionFilterRef: React.RefObject<SurveyResultsQuestionFilterHandle>;
  _isMounted: boolean;
  _questionFilterQuestionsMemo: SurveyResultsQuestionFilterQuestionsMemo;
  _questionTableEntriesMemo: SurveyResultsQuestionTableEntriesMemo;
  _lockedResponsesModelMemo: SurveyResultsLockedResponsesModelMemo;
  _fetchResponsesInFlight: boolean;
  _fetchResponsesQueued: boolean;
  _fetchResponsesRequestScheduled: boolean;
  _localStoragePollingIntervalId: ReturnType<typeof setTimeout> | null;
  _localStoragePollingDelayMs: number;
  _localStoragePollingStableCycles: number;
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
  _viewableResponsesCountMemo: WeakMap<SurveyResultsSummaryResponseRow[], SurveyResultsViewableResponsesCountMemoValue>;
  _resultsRefreshMicrotaskScheduled: boolean;
  _resultsRefreshFrameRequestId: number | null;
  _queuedResultsRefreshReasons: Set<string>;
  _aggregatorEntriesMemo: SurveyResultsAggregatorEntriesMemo;
  _polisQuestionResponsesMemo: SurveyResultsPolisQuestionResponsesMemo;
  _effectiveSlugScanMemo: SurveyResultsEffectiveSlugScanMemo;
  _surveysCacheChangeNonce: number;
  _unsubscribeCacheUpdates: (() => void) | null;
  _lastNotifiedFilterStateSignature: string | null;
  _pendingFilterLoadingValue: unknown;
  _bookmarkFeedbackTimer: ReturnType<typeof setTimeout> | null;
  _stableFallbackQuestions: SurveyResultsFallbackQuestionBuckets | null = null;
  csvFileName: string = '';

  constructor(props: SurveyResultsRecord) {
    super(props);

    const initialSlug = resolveSurveyResultsExplicitSessionSlug(props) ?? '';
    let parsedCache;
    const defaultCache = { surveys: [], questions: [] };

    try {
      parsedCache = peekCacheSync('bookmarksCache', initialSlug, { clone: false });
      if (
        !parsedCache ||
        typeof parsedCache !== 'object' ||
        !Array.isArray(parsedCache.surveys) ||
        !Array.isArray(parsedCache.questions)
      ) {
        parsedCache = defaultCache;
      }
    } catch (error) {
      surveyLog.error('[SurveyResults] Error reading bookmarksCache:', error);
      parsedCache = defaultCache;
    }

    this._syncLoadingStartedAt = null;
    this._scrollMutationObserver = null;
    this._scrollToQuestionRetryTimer = null;

    this.state = {
      responses: [],
      sbtFilteredResponses: [],
      csvData: '',
      exportType: EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES,
      alertMessage: '',
      loading: false,
      surveyTitle: '',
      surveyDocumentURLs: [],
      surveyId: '', // This will be set from props or determined logic
      activeQuestionToggles: {},
      questionResponses: {},
      sbtFilteredQuestionResponses: {},
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      viewMode: this.props.viewMode, // 'survey' or 'questions'
      filterLoading: false,
      showQuestionFilter: false,
      filterState: this.props.filterState || {},
      syncDetailsOpen: false,
      bookmarkedQuestionIDs: Array.isArray(parsedCache.questions) ? [...parsedCache.questions] : [],
      bookmarkedSurveyIDs: Array.isArray(parsedCache.surveys) ? [...parsedCache.surveys] : [],
      questionIdSortBy: 'responses',
      questionIdSortAsc: true,
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      filteredResponsesCount: 0,
      surveyViewMode: 'individuals', // aggregator vs. individuals
      exportAreaOpen: false,
      aggregateQuestionResponses: {},
      questionResultsHydrated: false,
      surveyResultsHydrated: false,

      // chunk-based progress placeholders (not fully used)
      questionPartialLoading: false,
      questionPartialProgress: 0,
      questionPartialTotal: 0,

      responsePartialLoading: false,
      responsePartialProgress: 0,
      responsePartialTotal: 0,
      networkLatestBlock: 0,

      // We track local blocks for question & survey data
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      surveyLocalBlock: 0,

      // track how many questions & responses are cached
      cachedQuestionsCount: 0,
      cachedSurveyResponsesCount: 0,

      // block targets for manual refresh
      refreshTargetQuestionBlock: 0,
      refreshTargetResponseBlock: 0,
      refreshTargetSurveyBlock: 0,

      activeToggles: {},
      filterBookmarkedFeedback: false,
      filteredQuestionsCount: this.props.filteredQuestionsCount === undefined ? null : this.props.filteredQuestionsCount,
      isFilterActive: false,
      lockedResponseDetailsOpen: false,
      lockedResponsesDecrypting: false,
      decryptedResponseOverrides: {},
      demoResultsViewMode: 'raw',
      demoResultsAtlasNodeId: null,
      htmlReportModalOpen: false,
      htmlReportExportedAt: '',
      htmlReportExportFormat: SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
      htmlReportSelectedSections: { ...DEFAULT_HTML_REPORT_SELECTED_SECTIONS },
      htmlReportAnalysisGenerating: false,
      htmlReportAnalysisError: '',
      htmlReportAnalysisArtifact: null,
      htmlReportAnalysisInputSignature: '',
      htmlReportDemoMode: false,
    };

    this.questionIdTableRef = React.createRef();
    this.questionFilterRef = React.createRef();
    this._isMounted = false;
    this._questionFilterQuestionsMemo = {
      questionResponsesRef: null,
      networkQuestionsRef: null,
      questionResponsesNonceKey: null,
      questionsCacheNonceKey: null,
      result: [],
    };
    this._questionTableEntriesMemo = {
      questionMapRef: null,
      networkQuestionsRef: null,
      sortBy: '',
      sortAsc: true,
      result: [],
    };
    this._lockedResponsesModelMemo = {
      viewMode: '',
      surveyViewMode: '',
      responsesRef: null,
      aggregatorRef: null,
      questionLookupRef: null,
      overridesRef: null,
      slug: '',
      result: {
        lockedRows: [],
        lockedCount: 0,
        gateDetails: [],
        hasGenericGateMessage: false,
      },
    };
    this._fetchResponsesInFlight = false;
    this._fetchResponsesQueued = false;
    this._fetchResponsesRequestScheduled = false;
    this._localStoragePollingIntervalId = null;
    this._localStoragePollingDelayMs = LOCAL_STORAGE_POLL_MIN_MS;
    this._localStoragePollingStableCycles = 0;
    this._lastLocalStoragePollCoarseSignature = '';
    this._lastLocalStoragePollDetailedSignature = '';
    this._lastPolledQuestionsRef = null;
    this._lastPolledSurveyResponsesRef = null;
    this._lastPolledQuestionRefVersion = 0;
    this._lastPolledSurveyResponsesRefVersion = 0;
    this._pollQuestionCountMemo = {
      questionsRef: null,
      count: 0,
    };
    this._scopedQuestionNetworkDataSyncMemo = {
      viewMode: '',
      netIdStr: '',
      slugsKey: '',
      bucketRefs: [],
      result: EMPTY_SCOPED_QUESTION_NETWORK_DATA,
    };
    this._pollSurveyResponsesCountMemo = {
      surveyId: '',
      responsesRef: null,
      count: 0,
    };
    this._nonceTickInFlight = false;
    this._nonceTickQueued = false;
    this._pollLatestBlockFetchInFlight = false;
    this._pollLatestBlockLastAttemptAt = 0;
    this._responseParseMemo = new Map();
    this._surveyModeSourceSignature = '';
    this._surveyModeSourceCoarseSignature = '';
    this._surveyModeSourcePayloadRefSignature = '';
    this._surveyModeSourceCacheNonce = 0;
    this._individualResponsesAggregatorMemo = {
      responsesRef: null,
      result: {},
    };
    this._viewableResponsesCountMemo = new WeakMap();
    this._resultsRefreshMicrotaskScheduled = false;
    this._resultsRefreshFrameRequestId = null;
    this._queuedResultsRefreshReasons = new Set();
    this._aggregatorEntriesMemo = {
      aggregatorRef: null,
      entries: [],
    };
    this._polisQuestionResponsesMemo = {
      selected: false,
      sourceRef: null,
      result: null,
    };
    this._effectiveSlugScanMemo = {
      surveyId: '',
      nonceKey: '',
      slug: '',
    };
    this._surveysCacheChangeNonce = 0;
    this._unsubscribeCacheUpdates = null;
    this._lastNotifiedFilterStateSignature = null;
    this._pendingFilterLoadingValue = null;
    this._bookmarkFeedbackTimer = null;
  }

  handleManagedCacheUpdate = (update: SurveyResultsManagedCacheUpdate = {}): void => {
    if (!update || update.namespace !== 'surveysCache') return;
    this._surveysCacheChangeNonce += 1;
  };

  getIsSyncedForState = (stateSnapshot: SurveyResultsSyncStateLike = this.state): boolean => (
    isSurveyResultsStateSynced(stateSnapshot)
  );

  /**
   * Resolve the effective session slug for cache + RPC calls.
   * Priority: explicit sessionSlug → Redux active slug → cache scan → general ('').
   */
  getEffectiveSlug() {
    const explicitSlug = resolveSurveyResultsExplicitSessionSlug({
      ...this.props,
      search: (typeof window !== 'undefined' && window.location?.search) || '',
    });
    if (explicitSlug !== null) return explicitSlug;

    // 2. Fallback: scan known sessions for the survey ID if we have one
    if (this.state.surveyId) {
      const sid = this.state.surveyId.toLowerCase();
      const nonceKey = [
        normalizeNonceKey(this.props.questionResponsesNonce),
        normalizeNonceKey(this.props.questionsCacheNonce),
        normalizeNonceKey(this._surveysCacheChangeNonce),
      ].join('|');
      if (
        this._effectiveSlugScanMemo &&
        this._effectiveSlugScanMemo.surveyId === sid &&
        this._effectiveSlugScanMemo.nonceKey === nonceKey
      ) {
        return this._effectiveSlugScanMemo.slug || '';
      }

      const slug = scanSurveyResultsSessionSlugFromCache({
        surveyId: sid,
        surveyCacheEntries: listNamespaceEntriesSync('surveysCache', { cloneValues: false }),
      });
      this._effectiveSlugScanMemo = {
        surveyId: sid,
        nonceKey,
        slug,
      };
      return slug;
    }

    return ''; // Default to general
  }

  getEffectiveSessionContext() {
    return resolveSurveyResultsSessionContext({
      sessionSlug: this.getEffectiveSlug(),
      resolveBySlug: getSessionConfigBySlug,
    });
  }

  resolveBaseQuestionReadScopeContextFor({
    props = this.props,
    state = this.state,
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

  resolveQuestionReadScopeContextFor({
    props = this.props,
    state = this.state,
    viewMode = state?.viewMode || props?.viewMode || 'questions',
  }: SurveyResultsScopeContextInput = {}): SurveyResultsQuestionReadScopeContext {
    return this.resolveBaseQuestionReadScopeContextFor({
      props,
      state,
      viewMode,
    });
  }

  getQuestionReadScopeContext(
    viewMode: unknown = this.state.viewMode || this.props.viewMode || 'questions'
  ): SurveyResultsQuestionReadScopeContext {
    return this.resolveQuestionReadScopeContextFor({ viewMode });
  }

  getQuestionReadSlugs(viewMode: unknown = this.state.viewMode || this.props.viewMode || 'questions'): string[] {
    const scopeContext = this.getQuestionReadScopeContext(viewMode);
    const scopedSlugs = Array.isArray(scopeContext?.questionReadSlugs)
      ? scopeContext.questionReadSlugs
      : [];
    return scopedSlugs.length > 0 ? scopedSlugs : [this.getEffectiveSlug()];
  }

  getQuestionFilterStorageKeyPrefix(
    viewMode: unknown = this.state.viewMode || this.props.viewMode || 'questions'
  ): string {
    return this.getQuestionReadScopeContext(viewMode).storageKeyPrefix;
  }

  shouldRequireAuthoritativeQuestionScope(
    viewMode: unknown = this.state.viewMode || this.props.viewMode || 'questions'
  ): boolean {
    if (String(viewMode || '').trim().toLowerCase() !== 'questions') return false;
    if (typeof window === 'undefined') return false;
    // Embedded one-page session results already pass an explicit pinned session slug.
    // Requiring authoritative metadata here hides legacy cache-backed questions that
    // pile view and the inline Polis report are already rendering from the same bucket.
    if (this.props.preventUrlChange && this.props.sessionSlugPinned) return false;
    return hasExplicitSessionQueryPinInPath(`${window.location.pathname || ''}${window.location.search || ''}`);
  }

  buildQuestionResultsScopeResetPatch() {
    return {
      questionResponses: {},
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      filteredResponsesCount: 0,
      filteredQuestionsCount: 0,
      questionResultsHydrated: false,
    };
  }

  buildQuestionReadScopeSignature({
    props = this.props,
    state = this.state,
    viewMode = state?.viewMode || props?.viewMode || 'questions',
  }: SurveyResultsScopeContextInput = {}): string {
    const scopeContext = this.resolveQuestionReadScopeContextFor({ props, state, viewMode });
    return [
      String(scopeContext?.baseSlug || ''),
      Array.isArray(scopeContext?.questionReadSlugs) ? scopeContext.questionReadSlugs.join('|') : '',
      String(scopeContext?.storageKeyPrefix || ''),
      String(viewMode || ''),
    ].join('::');
  }

  getScopedQuestionNetworkDataSync(
    viewMode: unknown = this.state.viewMode || this.props.viewMode || 'questions'
  ): SurveyResultsScopedQuestionNetworkData {
    const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? '');
    if (!netIdStr) return EMPTY_SCOPED_QUESTION_NETWORK_DATA;
    const questionReadSlugs = this.getQuestionReadSlugs(viewMode);
    const slugsKey = questionReadSlugs.join('|');
    const requireAuthoritativeBinding = this.shouldRequireAuthoritativeQuestionScope(viewMode);
    const entries: SurveyResultsScopedQuestionNetworkEntry[] = questionReadSlugs.map((slug) => ({
      slug,
      bucket: resolveNetBucketReadOnly(
        peekCacheSync('questionsCache', slug, { clone: false }) || {},
        netIdStr,
        {
          questionsLatestBlock: 0,
          questions: {},
          questionResponses: {},
          questionResponsesLatestBlock: 0,
        }
      ) as SurveyResultsQuestionBucketRecord,
    }));
    const memo: SurveyResultsScopedQuestionNetworkMemo = this._scopedQuestionNetworkDataSyncMemo || {};
    const bucketRefs = entries.map((entry) => entry.bucket);
    const memoMatches = (
      memo.viewMode === viewMode &&
      memo.netIdStr === netIdStr &&
      memo.slugsKey === slugsKey &&
      memo.requireAuthoritativeBinding === requireAuthoritativeBinding &&
      Array.isArray(memo.bucketRefs) &&
      memo.bucketRefs.length === bucketRefs.length &&
      memo.bucketRefs.every((bucket, index) => bucket === bucketRefs[index])
    );
    if (memoMatches) return memo.result || EMPTY_SCOPED_QUESTION_NETWORK_DATA;

    const result = mergeScopedQuestionNetworkData(entries, {
      allowedScopeSlugs: questionReadSlugs,
      // Regression guard: explicit ?session= pins must ignore legacy bucket leaks
      // until question metadata is rehydrated with an authoritative session binding.
      requireAuthoritativeBinding,
    });
    this._scopedQuestionNetworkDataSyncMemo = {
      viewMode,
      netIdStr,
      slugsKey,
      requireAuthoritativeBinding,
      bucketRefs,
      result,
    };
    return result;
  }

  async getScopedQuestionNetworkData(
    viewMode: unknown = this.state.viewMode || this.props.viewMode || 'questions'
  ): Promise<SurveyResultsScopedQuestionNetworkData> {
    const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? '');
    if (!netIdStr) return EMPTY_SCOPED_QUESTION_NETWORK_DATA;
    const questionReadSlugs = this.getQuestionReadSlugs(viewMode);
    const requireAuthoritativeBinding = this.shouldRequireAuthoritativeQuestionScope(viewMode);
    const entries: SurveyResultsScopedQuestionNetworkEntry[] = await Promise.all(questionReadSlugs.map(async (slug) => {
      let questionsCache = peekCacheSync('questionsCache', slug, { clone: false }) || {};
      if (!questionsCache || Object.keys(questionsCache).length === 0) {
        questionsCache = (await readCache('questionsCache', slug)) || {};
      }
      return {
        slug,
        bucket: resolveNetBucketReadOnly(questionsCache, netIdStr, {
          questionsLatestBlock: 0,
          questions: {},
          questionResponses: {},
          questionResponsesLatestBlock: 0,
        }) as SurveyResultsQuestionBucketRecord,
      };
    }));
    return mergeScopedQuestionNetworkData(entries, {
      allowedScopeSlugs: questionReadSlugs,
      requireAuthoritativeBinding,
    });
  }

  appendSessionHintToSurveyPath = (pathIn: unknown = ''): string => {
    const path = String(pathIn || '');
    if (!path || hasExplicitSessionQueryPinInPath(path)) return path;
    const pathOnly = path.split('?')[0];
    const isSessionAwarePath = (
      pathOnly.includes('/survey/') ||
      pathOnly.startsWith('/questions') ||
      pathOnly.startsWith('/question/')
    );
    if (!isSessionAwarePath) return path;
    const slug = this.getEffectiveSlug();
    if (!slug) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}session=${encodeURIComponent(slug)}`;
  };

  getMemoizedQuestionFilterQuestions(
    networkQuestionsById: Record<string, SurveyResultsFilterQuestionRecord> = {}
  ): SurveyResultsFilterQuestionRecord[] {
    const questionResponsesRef = this.state.questionResponses as SurveyResultsRecord | null | undefined;
    const networkQuestionsRef = networkQuestionsById;
    const questionResponsesNonceKey = normalizeNonceKey(this.props.questionResponsesNonce);
    const questionsCacheNonceKey = normalizeNonceKey(this.props.questionsCacheNonce);
    const memo = this._questionFilterQuestionsMemo;

    if (
      memo.questionResponsesRef === questionResponsesRef &&
      memo.networkQuestionsRef === networkQuestionsRef &&
      memo.questionResponsesNonceKey === questionResponsesNonceKey &&
      memo.questionsCacheNonceKey === questionsCacheNonceKey
    ) {
      return memo.result;
    }

    const next = Object.keys(questionResponsesRef || {}).map((qId) => {
      const lower = String(qId || '').toLowerCase();
      const qData = networkQuestionsById[lower];
      return qData || { id: lower || qId, creator: '', type: '', prompt: '' };
    });

    this._questionFilterQuestionsMemo = {
      questionResponsesRef,
      networkQuestionsRef,
      questionResponsesNonceKey,
      questionsCacheNonceKey,
      result: next,
    };
    return next;
  }

  notifyFilterStateCommitted(nextFilterState: unknown): void {
    const nextSignature = getFilterStateSignature(nextFilterState);
    if (this._lastNotifiedFilterStateSignature === nextSignature) return;
    this._lastNotifiedFilterStateSignature = nextSignature;
    if (this.props.onFilterStateChangeForUrlUpdate) {
      this.props.onFilterStateChangeForUrlUpdate(nextFilterState);
    }
    if (this.props.onFilterChange) {
      this.props.onFilterChange(nextFilterState);
    }
  }

  commitResultsFilterState(statePatch: SurveyResultsRecord | null | undefined, nextFilterState: unknown): void {
    const patch: SurveyResultsRecord = (statePatch && typeof statePatch === 'object') ? statePatch : {};
    const normalizedFilterState =
      nextFilterState && typeof nextFilterState === 'object'
        ? nextFilterState
        : (this.state.filterState || {});
    const filterStateChanged = !areValuesEquivalentBySignature(
      this.state.filterState,
      normalizedFilterState
    );
    const patchChanged = Object.keys(patch).some((key) => (
      !areValuesEquivalentBySignature(this.state[key], patch[key])
    ));
    if (!filterStateChanged && !patchChanged) return;
    this.setState(
      {
        ...patch,
        filterState: normalizedFilterState,
      },
      () => this.notifyFilterStateCommitted(this.state.filterState)
    );
  }

  requestFetchResponses = (): void => {
    if (!this._isMounted) return;
    if (this._fetchResponsesRequestScheduled) return;
    this._fetchResponsesRequestScheduled = true;
    Promise.resolve().then(() => {
      this._fetchResponsesRequestScheduled = false;
      if (!this._isMounted) return;
      if (this._fetchResponsesInFlight) {
        this._fetchResponsesQueued = true;
        return;
      }
      void this.flushFetchResponsesRequest();
    });
  };

  flushFetchResponsesRequest = async (): Promise<void> => {
    if (!this._isMounted || this._fetchResponsesInFlight) return;
    this._fetchResponsesInFlight = true;
    try {
      await this.fetchResponses();
    } finally {
      this._fetchResponsesInFlight = false;
      if (this._fetchResponsesQueued) {
        this._fetchResponsesQueued = false;
        if (this._isMounted) {
          void this.flushFetchResponsesRequest();
        }
      }
    }
  };

  shouldUseAnimationFrameForRefreshCoalescing = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (typeof window.requestAnimationFrame !== 'function') return false;
    if (this.isDocumentHidden()) return false;
    const ua = String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
    if (/jsdom/i.test(ua)) return false;
    return true;
  };

  queueResultsRefresh = (reason: unknown = 'unknown'): void => {
    if (!this._isMounted) return;
    if (reason) {
      this._queuedResultsRefreshReasons.add(String(reason));
    }
    if (this._resultsRefreshMicrotaskScheduled) return;
    this._resultsRefreshMicrotaskScheduled = true;

    scheduleMicrotask(() => {
      this._resultsRefreshMicrotaskScheduled = false;
      if (!this._isMounted) return;
      if (this._resultsRefreshFrameRequestId != null) return;

      const flush = () => {
        this._resultsRefreshFrameRequestId = null;
        this.flushQueuedResultsRefresh();
      };

      if (this.shouldUseAnimationFrameForRefreshCoalescing()) {
        this._resultsRefreshFrameRequestId = window.requestAnimationFrame(flush);
        return;
      }

      flush();
    });
  };

  flushQueuedResultsRefresh = (): void => {
    if (!this._isMounted) return;
    if (this._queuedResultsRefreshReasons.size === 0) return;
    if (!this.props.isOpen) {
      this._queuedResultsRefreshReasons.clear();
      return;
    }
    this._queuedResultsRefreshReasons.clear();
    measureSync('ce.surveyResults.flushQueuedResultsRefresh', () => {
      this.requestFetchResponses();
    });
  };

  updateParentWithCurrentFiltersForUrl = (): void => {
    this.notifyFilterStateCommitted(this.state.filterState);
  }

  componentDidMount() {
    this._isMounted = true;
    this._unsubscribeCacheUpdates = subscribeCacheUpdates(this.handleManagedCacheUpdate);
    window.addEventListener('popstate', this.handleUrlChange);
    document.addEventListener('visibilitychange', this.handleDocumentVisibilityChange);

    // Determine initial viewMode and surveyId for state
    let initialViewMode = this.props.viewMode || 'questions';
    let initialSurveyId = this.props.surveyId || '';

    if (initialSurveyId) {
      initialViewMode = 'survey';
    }

    this.setState({
      viewMode: initialViewMode,
      surveyId: initialSurveyId
    }, () => {
      this.handleUrlBasedView();

      if (this.props.isOpen) {
        if (this.state.viewMode === 'questions') {
          if (this.props.refreshQuestionMetadata && this.props.refreshQuestionResponses) {
            this.props.refreshQuestionMetadata();
            this.props.refreshQuestionResponses();
          }
        } else if (this.state.viewMode === 'survey' && this.state.surveyId) {
          if (this.props.refreshSurveyResponsesByID) {
            this.props.refreshSurveyResponsesByID(this.state.surveyId.toLowerCase());
          }
        }

        const ensureResultsUrl = () => {
          if (this.props.preventUrlChange) return;
          if (!window.location.pathname.endsWith('/results')) {
            let path =
              this.state.viewMode === 'questions'
                ? '/questions/results'
                : (this.state.surveyId ? `/survey/${this.state.surveyId}/results` : '/questions/results');

            // Apply prefix
            path = applyExistingGroupPrefix(path);

            // Preserve existing query params (specifically filter) if present
            const search = window.location.search;
            if (search) {
              path += search;
            } else {
              path = this.appendSessionHintToSurveyPath(path);
            }

            window.history.pushState({}, '', path);
          }
        };

        this.updateLocalStoragePollingState();
        this.handleManualRefresh();
        this.queueResultsRefresh('mount-open');
        ensureResultsUrl();
        this.updateParentWithCurrentFiltersForUrl();
      }
    });
  }


  componentWillUnmount() {
    this._isMounted = false;
    this._fetchResponsesQueued = false;
    this._fetchResponsesInFlight = false;
    this._fetchResponsesRequestScheduled = false;
    this._nonceTickInFlight = false;
    this._nonceTickQueued = false;
    this._pollLatestBlockFetchInFlight = false;
    this._resultsRefreshMicrotaskScheduled = false;
    this._queuedResultsRefreshReasons.clear();
    if (this._responseParseMemo && typeof this._responseParseMemo.clear === 'function') {
      this._responseParseMemo.clear();
    }
    if (this._resultsRefreshFrameRequestId != null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(this._resultsRefreshFrameRequestId);
    }
    this._resultsRefreshFrameRequestId = null;
    if (typeof this._unsubscribeCacheUpdates === 'function') {
      this._unsubscribeCacheUpdates();
    }
    this._unsubscribeCacheUpdates = null;
    if (this._scrollToQuestionRetryTimer) {
      clearTimeout(this._scrollToQuestionRetryTimer);
      this._scrollToQuestionRetryTimer = null;
    }
    if (this._scrollMutationObserver) {
      this._scrollMutationObserver.disconnect();
      this._scrollMutationObserver = null;
    }
    if (this._bookmarkFeedbackTimer) {
      clearTimeout(this._bookmarkFeedbackTimer);
      this._bookmarkFeedbackTimer = null;
    }
    window.removeEventListener('popstate', this.handleUrlChange);
    document.removeEventListener('visibilitychange', this.handleDocumentVisibilityChange);
    this.stopLocalStoragePolling();

    // If unmounting while still open, remove "/results" from the URL
    if (this.props.isOpen && !this.props.preventUrlChange) {
      const currentPath = window.location.pathname;
      if (currentPath.includes('/results')) {
        let newPath = currentPath.replace('/results', '').replace(/\/+$/, '');
        // If that leaves nothing, fall back to whichever path logic you want:
        if (!newPath) {
          newPath =
            this.state.viewMode === 'questions'
              ? '/questions'
              : this.state.surveyId // Use state.surveyId
                ? `/survey/${this.state.surveyId}`
                : '/questions';
        }
        newPath = this.appendSessionHintToSurveyPath(newPath);
        window.history.pushState({}, '', newPath);
      }
    }
  }



  componentDidUpdate(prevProps: SurveyResultsRecord, prevState: SurveyResultsRecord): void {
    const refreshReasons: Set<string> = new Set();
    const pendingStatePatch: SurveyResultsRecord = {};
    let hasPendingStatePatch = false;
    let runPostPatchTasks: VoidFunction | null = null;
    const clearResponseParseMemo = (): void => {
      if (this._responseParseMemo && typeof this._responseParseMemo.clear === 'function') {
        this._responseParseMemo.clear();
      }
    };
    const queueStatePatch = (key: string, value: unknown): void => {
      if (this.state[key] === value) return;
      pendingStatePatch[key] = value;
      hasPendingStatePatch = true;
    };
    const wasSynced = this.getIsSyncedForState(prevState);
    const isSyncedNow = this.getIsSyncedForState(this.state);
    if (!wasSynced && isSyncedNow) {
      this._syncLoadingStartedAt = null;
    } else if (!isSyncedNow && this._syncLoadingStartedAt === null) {
      this._syncLoadingStartedAt = Date.now();
    }

    // Sync local filteredQuestionsCount from props
    if (
      this.props.filteredQuestionsCount !== prevProps.filteredQuestionsCount &&
      this.props.filteredQuestionsCount !== this.state.filteredQuestionsCount
    ) {
      queueStatePatch('filteredQuestionsCount', this.props.filteredQuestionsCount);
    }

    // If the modal just closed, revert the URL and stop polling
    if (prevProps.isOpen && !this.props.isOpen) {
      clearResponseParseMemo();
      queueStatePatch('questionResultsHydrated', false);
      queueStatePatch('surveyResultsHydrated', false);
      queueStatePatch('demoResultsViewMode', 'raw');
      queueStatePatch('demoResultsAtlasNodeId', null);
      if (!this.props.preventUrlChange) {
        let basePath;
        if (this.state.viewMode === 'questions') {
          basePath = '/questions';
        } else if (this.state.surveyId) {
          basePath = `/survey/${this.state.surveyId}`;
        } else {
          basePath = '/questions';
        }
        basePath = this.appendSessionHintToSurveyPath(basePath);
        window.history.pushState({}, '', applyExistingGroupPrefix(basePath));
      }
      this.stopLocalStoragePolling();
      this.resetLocalStoragePollingBackoff('modal-closed');
      this._syncLoadingStartedAt = null;
    }

    // If the modal just opened
    if (!prevProps.isOpen && this.props.isOpen) {
      this.resetLocalStoragePollingBackoff('modal-open');
      if (String(this.state.viewMode || '').trim().toLowerCase() === 'questions') {
        queueStatePatch('questionResultsHydrated', false);
      } else {
        queueStatePatch('surveyResultsHydrated', false);
      }
      queueStatePatch('demoResultsViewMode', 'raw');
      queueStatePatch('demoResultsAtlasNodeId', null);
      // Reset then re-seed sync timer if currently loading
      const isSyncedOnOpen = this.getIsSyncedForState(this.state);
      this._syncLoadingStartedAt = isSyncedOnOpen ? null : Date.now();
      this.updateLocalStoragePollingState();
      // Re-open should re-emit current filter state so URL/query filter sync is restored.
      this._lastNotifiedFilterStateSignature = null;
      refreshReasons.add('modal-open');

      const filterStatePropChanged =
        getFilterStateSignature(this.props.filterState) !==
        getFilterStateSignature(prevProps.filterState);

      const updateTasks = () => {
        this.updateParentWithCurrentFiltersForUrl();

        if (!this.props.preventUrlChange && !window.location.pathname.endsWith('/results')) {
          const path =
            this.state.viewMode === 'questions'
              ? '/questions/results'
              : (this.state.surveyId ? `/survey/${this.state.surveyId}/results` : '/questions/results');
          window.history.pushState({}, '', applyExistingGroupPrefix(this.appendSessionHintToSurveyPath(path)));
        }
      };

      if (filterStatePropChanged) {
        queueStatePatch('filterState', this.props.filterState || {});
        runPostPatchTasks = updateTasks;
      } else {
        updateTasks();
      }
    }

    // If the modal is open and a cache just became ready, refresh
    const cacheJustBecameReady =
      (this.state.viewMode === 'questions' &&
        !prevProps.isQuestionCacheReady &&
        this.props.isQuestionCacheReady) ||
      (this.state.viewMode === 'survey' &&
        !prevProps.isSurveyCacheReady &&
        this.props.isSurveyCacheReady);

    if (this.props.isOpen && cacheJustBecameReady) {
      refreshReasons.add('cache-ready');
    }

    // If responses cache flips ready while open, refresh
    if (
      this.props.isOpen &&
      prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady &&
      this.props.isResponsesCacheReady
    ) {
      refreshReasons.add('responses-cache-ready');
    }

    // View mode changed (questions <-> survey)
    if (prevState.viewMode !== this.state.viewMode) {
      // Invalidate survey-mode source memo so returning to the same survey rebuilds state.
      this._surveyModeSourceSignature = '';
      clearResponseParseMemo();
      this.setState(
        {
          questionLocalBlock: 0,
          responseLocalBlock: 0,
          surveyLocalBlock: 0,
          refreshTargetQuestionBlock: 0,
          refreshTargetResponseBlock: 0,
          refreshTargetSurveyBlock: 0,
          questionResultsHydrated:
            this.state.viewMode === 'questions' ? false : this.state.questionResultsHydrated,
          surveyResultsHydrated:
            this.state.viewMode === 'survey' ? false : this.state.surveyResultsHydrated,
          demoResultsViewMode: 'raw',
          demoResultsAtlasNodeId: null,
          // If switching to questions, clear surveyId
          surveyId: this.state.viewMode === 'questions' ? '' : this.state.surveyId,
        },
        () => {
          this.resetLocalStoragePollingBackoff('view-mode-change');
          this.queueResultsRefresh('view-mode-change');
        }
      );
    }

    // Survey identity changed (prop or internal)
    if ((this.props.surveyId !== prevProps.surveyId) || (prevState.surveyId !== this.state.surveyId)) {
      clearResponseParseMemo();
      if (this.props.surveyId && this.props.surveyId !== this.state.surveyId) {
        this.setState(
          {
            surveyId: this.props.surveyId,
            viewMode: 'survey',
            surveyLocalBlock: 0,
            refreshTargetSurveyBlock: 0,
            surveyResultsHydrated: false,
            demoResultsViewMode: 'raw',
            demoResultsAtlasNodeId: null,
          },
          () => {
            this.resetLocalStoragePollingBackoff('survey-id-prop-change');
            this.queueResultsRefresh('survey-id-prop-change');
          }
        );
      } else if (prevState.surveyId !== this.state.surveyId && this.state.viewMode === 'survey') {
        this.setState(
          {
            surveyLocalBlock: 0,
            refreshTargetSurveyBlock: 0,
            surveyResultsHydrated: false,
            demoResultsViewMode: 'raw',
            demoResultsAtlasNodeId: null,
          },
          () => {
            this.resetLocalStoragePollingBackoff('survey-id-state-change');
            this.queueResultsRefresh('survey-id-state-change');
          }
        );
      }
    }

    // Upstream "responses changed" signal
    if (prevProps.questionResponsesNonce !== this.props.questionResponsesNonce) {
      this.handleNonceTick();
    }

    if (prevProps.isOpen !== this.props.isOpen) {
      if (this.props.isOpen) {
        this.resetLocalStoragePollingBackoff('modal-open-state-change');
      }
      this.updateLocalStoragePollingState();
    }

    const prevQuestionScopeSignature = this.buildQuestionReadScopeSignature({
      props: prevProps,
      state: prevState,
      viewMode: prevState.viewMode || prevProps.viewMode || 'questions',
    });
    const nextQuestionScopeSignature = this.buildQuestionReadScopeSignature({
      props: this.props,
      state: this.state,
      viewMode: this.state.viewMode || this.props.viewMode || 'questions',
    });
    if (
      this.props.isOpen &&
      String(this.state.viewMode || '').trim().toLowerCase() === 'questions' &&
      prevQuestionScopeSignature !== nextQuestionScopeSignature
    ) {
      clearResponseParseMemo();
      const questionScopeResetPatch: SurveyResultsRecord = this.buildQuestionResultsScopeResetPatch();
      Object.keys(questionScopeResetPatch).forEach((key) => {
        queueStatePatch(key, questionScopeResetPatch[key]);
      });
      refreshReasons.add('question-scope-change');
    }

    if (hasPendingStatePatch) {
      this.setState(pendingStatePatch, () => {
        if (typeof runPostPatchTasks === 'function') runPostPatchTasks();
      });
    } else if (typeof runPostPatchTasks === 'function') {
      runPostPatchTasks();
    }

    if (refreshReasons.size > 0) {
      this.queueResultsRefresh(Array.from(refreshReasons).join('|'));
    }
  }


  // Force-refresh handler to keep UI reactivity and progress bars current on cache updates
  runNonceTickRefresh = async (): Promise<void> => {
    try {
      const slug = this.getEffectiveSlug();
      const latest = await contractScripts.getLatestBlockNumber(this.props.provider, slug);
      if (!this._isMounted) return;
      this.setState(
        {
          networkLatestBlock: latest,
          refreshTargetQuestionBlock: latest,
          refreshTargetResponseBlock: latest,
          refreshTargetSurveyBlock: latest
        },
        () => {
          // Re-read localStorage derived counters and repaint from cache immediately
          this.pollLocalStorageForUpdates();
          this.resetLocalStoragePollingBackoff('nonce-tick');
          this.queueResultsRefresh('nonce-tick');
        }
      );
    } catch (e: unknown) {
      // Fall back to a soft refresh if block lookup fails
      if (this._isMounted) {
        this.resetLocalStoragePollingBackoff('nonce-tick-fallback');
        this.queueResultsRefresh('nonce-tick-fallback');
      }
    }
  };

  handleNonceTick = async (): Promise<void> => {
    if (this._nonceTickInFlight) {
      this._nonceTickQueued = true;
      return;
    }
    this._nonceTickInFlight = true;
    try {
      do {
        this._nonceTickQueued = false;
        await this.runNonceTickRefresh();
      } while (this._nonceTickQueued && this._isMounted);
    } finally {
      this._nonceTickInFlight = false;
    }
  };



  handleFilterActivityChange = (isActive: unknown): void => {
    if (this.state.isFilterActive === isActive) return;
    this.setState(buildSurveyResultsFilterActivePatch(isActive));
  };

  getIsDemoQuestionResultsContext = (): boolean => (
    String(this.state.viewMode || '').trim().toLowerCase() === 'questions' &&
    normalizeSessionSlug(this.getEffectiveSlug()) === 'demo'
  );

  handleDemoResultsViewSelect = (nextView: unknown = 'report'): void => {
    this.setState((prevState: SurveyResultsRecord) => buildSurveyResultsDemoViewSelectPatch({
      nextView,
      prevState,
    }));
  };

  handleDemoAtlasOpen = (nodeId: unknown = ''): void => {
    this.setState(buildSurveyResultsDemoAtlasOpenPatch(nodeId));
  };

  handleDemoAtlasModalClose = (): void => {
    if (!this.state.demoResultsAtlasNodeId) return;
    this.setState(buildSurveyResultsDemoAtlasNodePatch());
  };

  renderDemoResultsSurface = (viewKey: unknown = 'report'): React.ReactNode => {
    const activeSlug = this.getEffectiveSlug();
    if (viewKey === 'report') {
      return (
        <div id="polisReportSection">
          <PolisReport
            questionResponses={this.getMemoizedPolisQuestionResponses(
              true,
              this.state.viewMode === 'survey' && this.state.surveyViewMode === 'individuals'
                ? this.getMemoizedIndividualsAggregator(this.state.sbtFilteredResponses)
                : (this.state.sbtFilteredAggregatorQuestionResponses || {})
            )}
            network={this.props.network}
            networkChainId={this.props.networkChainId}
            disclaimersActive={true}
            filterState={this.props.filterState || this.state.filterState}
            defaultTags={this.props.defaultTags}
            isQuestionCacheReady={this.props.isQuestionCacheReady}
            isResponsesCacheReady={this.props.isResponsesCacheReady}
            questionScanProgress={this.props.questionScanProgress}
            questionResponsesNonce={this.props.questionResponsesNonce}
            slug={activeSlug}
          />
        </div>
      );
    }

    if (viewKey === 'breakdown') {
      return (
        <Suspense fallback={<LazyFallback label="Loading Breakdown..." minHeight="30vh" />}>
          <DemoAnalysisWorkspace />
        </Suspense>
      );
    }

    if (viewKey === 'atlas') {
      return (
        <Suspense fallback={<LazyFallback label="Loading Atlas..." minHeight="30vh" />}>
          <div className={styles.demoResultsAtlasSurface}>
            <DebateMapForSurveyResults
              activeSessionSlug={activeSlug}
              demoMode={true}
              embedded={true}
              requestedModalNodeId={this.state.demoResultsAtlasNodeId}
              onModalClose={this.state.demoResultsAtlasNodeId ? this.handleDemoAtlasModalClose : null}
            />
          </div>
        </Suspense>
      );
    }

    if (viewKey === 'riskMatrix') {
      return (
        <Suspense fallback={<LazyFallback label="Loading Risk Matrix..." minHeight="30vh" />}>
          <div className={styles.demoResultsRiskMatrixSurface}>
            <RiskMatrix embedded={true} onOpenAtlasNode={this.handleDemoAtlasOpen} />
          </div>
        </Suspense>
      );
    }

    return null;
  };

  handleClearFiltersFromParent = (e: React.SyntheticEvent): void => {
    e.stopPropagation();
    if (this.questionFilterRef.current) {
      this.questionFilterRef.current.handleClearFilters();
    }
  };

  closeModal = (): void => {
    const oldPath = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
    let base = oldPath.split('/results')[0];

    if (base === oldPath || base === '') {
      if (this.state.viewMode === 'questions') {
        base = '/questions';
      } else if (this.state.surveyId) {
        base = `/survey/${this.state.surveyId}`;
      } else {
        base = '/questions';
      }
    }
    base = this.appendSessionHintToSurveyPath(base);

    if (!this.props.preventUrlChange) {
      window.history.pushState({}, '', applyExistingGroupPrefix(base));
    }

    if (this.props.onClose) {
      this.props.onClose();
    }
  };


  handleUrlChange = (): void => {
    this.handleUrlBasedView();
  };

  handleUrlBasedView = (): void => {
    const path = window.location.pathname;
    let newViewMode = this.state.viewMode; // Default to current
    let newSurveyId = this.state.surveyId;  // Default to current

    const surveyResultsRegex = /^\/survey\/([0-9a-fA-FxX]{66})\/results/;
    const surveyMatch = path.match(surveyResultsRegex);

    const questionResultsRegex = /^\/questions\/results/;
    let questionMatch = path.match(questionResultsRegex);

    if (surveyMatch) {
        newViewMode = "survey";
        newSurveyId = surveyMatch[1]; // surveyID from URL
    } else if (questionMatch) {
        newViewMode = "questions";
        newSurveyId = ''; // No surveyId for questions view
    }
    // If neither matches, it might be a base path like /survey/ID or /questions
    // In that case, we don't necessarily change the mode here, as componentDidMount/Update handles props.

    if (this.state.viewMode !== newViewMode || this.state.surveyId !== newSurveyId) {
      this.setState(buildSurveyResultsViewStatePatch(newViewMode, newSurveyId), () => {
        this.queueResultsRefresh('url-view-change');
      });
    }
  };


  // -----------------------------------------
  // LOCAL STORAGE POLLING
  // -----------------------------------------
  isDocumentHidden = (): boolean => {
    try {
      return typeof document !== 'undefined' && document.hidden;
    } catch (_) {
      return false;
    }
  };

  updateLocalStoragePollingState = (): void => {
    if (this.props.isOpen && !this.isDocumentHidden()) {
      this.resetLocalStoragePollingBackoff('polling-state-open');
      this.startLocalStoragePolling();
    } else {
      this.stopLocalStoragePolling();
    }
  };

  handleDocumentVisibilityChange = (): void => {
    this.updateLocalStoragePollingState();
  };

  resetLocalStoragePollingBackoff = (reason: unknown = ''): void => {
    this._localStoragePollingStableCycles = 0;
    this._localStoragePollingDelayMs = LOCAL_STORAGE_POLL_MIN_MS;
    if (reason) {
      this._lastLocalStoragePollCoarseSignature = '';
      this._lastLocalStoragePollDetailedSignature = '';
    }
  };

  updateLocalStoragePollingBackoff = (didObserveChange: unknown): void => {
    if (didObserveChange) {
      this.resetLocalStoragePollingBackoff();
      return;
    }
    this._localStoragePollingStableCycles += 1;
    if (this._localStoragePollingStableCycles <= 0) {
      this._localStoragePollingDelayMs = LOCAL_STORAGE_POLL_MIN_MS;
      return;
    }
    if (this._localStoragePollingStableCycles === 1) {
      this._localStoragePollingDelayMs = LOCAL_STORAGE_POLL_MID_MS;
      return;
    }
    this._localStoragePollingDelayMs = LOCAL_STORAGE_POLL_MAX_MS;
  };

  startLocalStoragePolling() {
    if (!this.props.isOpen) return;
    if (this.isDocumentHidden()) return;
    if (this._localStoragePollingIntervalId) return;
    const waitMs = Number(this._localStoragePollingDelayMs || LOCAL_STORAGE_POLL_MIN_MS);
    this._localStoragePollingIntervalId = setTimeout(() => {
      this._localStoragePollingIntervalId = null;
      if (!this._isMounted) return;
      if (this.isDocumentHidden()) return;
      const didObserveChange = this.pollLocalStorageForUpdates();
      this.updateLocalStoragePollingBackoff(!!didObserveChange);
      this.startLocalStoragePolling();
    }, waitMs);
  }

  stopLocalStoragePolling() {
    if (!this._localStoragePollingIntervalId) return;
    clearTimeout(this._localStoragePollingIntervalId);
    this._localStoragePollingIntervalId = null;
  }

  maybeRefreshNetworkLatestBlockFromPolling = (): void => {
    if ((this.state.networkLatestBlock || 0) > 0) return;
    if (this._pollLatestBlockFetchInFlight) return;
    const now = Date.now();
    if (
      this._pollLatestBlockLastAttemptAt > 0 &&
      (now - this._pollLatestBlockLastAttemptAt) < LATEST_BLOCK_POLL_THROTTLE_MS
    ) {
      return;
    }
    this._pollLatestBlockLastAttemptAt = now;
    this._pollLatestBlockFetchInFlight = true;
    const slug = this.getEffectiveSlug();
    contractScripts
      .getLatestBlockNumber(this.props.provider, slug)
      .then((blk: unknown) => {
        if (!this._isMounted) return;
        const parsed = Number(blk || 0);
        if (parsed > 0 && parsed !== Number(this.state.networkLatestBlock || 0)) {
          this.setState(buildSurveyResultsNetworkLatestBlockPatch(parsed));
        }
      })
      .catch((e: unknown) => { surveyLog.warn('SurveyResults: fallback', e); })
      .finally(() => {
        this._pollLatestBlockFetchInFlight = false;
      });
  };

  getMemoizedQuestionsCountForPolling = (
    questionsById: unknown,
    options: SurveyResultsPollingCountOptions = {}
  ): number => {
    const ref: SurveyResultsRecord = questionsById && typeof questionsById === 'object'
      ? questionsById as SurveyResultsRecord
      : {};
    const forceScan = options && options.forceScan === true;
    const memo = this._pollQuestionCountMemo;
    if (!forceScan && memo.questionsRef === ref) return memo.count;
    const nextCount = measureSync(
      forceScan
        ? 'ce.surveyResults.poll.questionsCountForcedScan'
        : 'ce.surveyResults.poll.questionsCountScan',
      () => Object.keys(ref).length
    ) as number;
    this._pollQuestionCountMemo = {
      questionsRef: ref,
      count: nextCount,
    };
    return nextCount;
  };

  getMemoizedSurveyResponsesCountForPolling = (
    surveyResponsesById: unknown,
    surveyId: unknown,
    options: SurveyResultsPollingCountOptions = {}
  ): number => {
    const sid = String(surveyId || '').toLowerCase();
    if (!sid) {
      this._pollSurveyResponsesCountMemo = {
        surveyId: '',
        responsesRef: null,
        count: 0,
      };
      return 0;
    }

    const byId: SurveyResultsRecord = surveyResponsesById && typeof surveyResponsesById === 'object'
      ? surveyResponsesById as SurveyResultsRecord
      : {};
    const responsesRef = byId[sid] && typeof byId[sid] === 'object'
      ? byId[sid] as SurveyResultsRecord
      : null;
    const memo = this._pollSurveyResponsesCountMemo;
    const forceScan = options && options.forceScan === true;
    if (!forceScan && memo.surveyId === sid && memo.responsesRef === responsesRef) {
      return memo.count;
    }
    const nextCount = measureSync(
      forceScan
        ? 'ce.surveyResults.poll.surveyResponsesCountForcedScan'
        : 'ce.surveyResults.poll.surveyResponsesCountScan',
      () => Object.keys(responsesRef || {}).length
    ) as number;
    this._pollSurveyResponsesCountMemo = {
      surveyId: sid,
      responsesRef,
      count: nextCount,
    };
    return nextCount;
  };

pollLocalStorageForUpdates(): boolean {
  return measureSync('ce.surveyResults.pollLocalStorageForUpdates', () => {
    if (!this.hasEffectiveNetworkId()) return false;
    const slug = this.getEffectiveSlug();
    const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? '');
    if (!netIdStr) return false;
    const currentSurveyId = this.state.viewMode === 'survey'
      ? String(this.state.surveyId || '').toLowerCase()
      : '';

    const questionNetCache: SurveyResultsQuestionBucketRecord = (
      this.state.viewMode === 'questions'
        ? this.getScopedQuestionNetworkDataSync('questions')
        : resolveNetBucketReadOnly(
            peekCacheSync('questionsCache', slug, { clone: false }) || {},
            netIdStr,
            {
              questionsLatestBlock: 0,
              questions: {},
              questionResponses: {},
              questionResponsesLatestBlock: 0,
            }
          )
    ) as SurveyResultsQuestionBucketRecord;

    const questionsById = questionNetCache.questions || {};
    let surveyNetCache: SurveyResultsSurveyBucketRecord | null = null;
    let surveyResponsesById: unknown = {};
    if (currentSurveyId) {
      const surveysCache = peekCacheSync('surveysCache', slug, { clone: false }) || {};
      surveyNetCache = resolveNetBucketReadOnly(surveysCache, netIdStr, {
        surveys: {},
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
        surveysLatestBlock: 0,
      }) as SurveyResultsSurveyBucketRecord;
      surveyResponsesById = surveyNetCache.surveyResponses || {};
    }
    if (this._lastPolledQuestionsRef !== questionsById) {
      this._lastPolledQuestionsRef = questionsById;
      this._lastPolledQuestionRefVersion += 1;
    }
    if (this._lastPolledSurveyResponsesRef !== surveyResponsesById) {
      this._lastPolledSurveyResponsesRef = surveyResponsesById;
      this._lastPolledSurveyResponsesRefVersion += 1;
    }

    // Keep retrying latest-block fetches even when local cache signatures are stable.
    let netLatest = Number(this.state.networkLatestBlock || 0);
    if (!netLatest) {
      this.maybeRefreshNetworkLatestBlockFromPolling();
      netLatest = 0;
    }

    const localQBlock = Number(questionNetCache.questionsLatestBlock || 0);
    const localRespBlock = Number(questionNetCache.questionResponsesLatestBlock || 0);
    const surveyResponsesLatestBlock = (
      surveyNetCache?.surveyResponsesLatestBlock &&
      typeof surveyNetCache.surveyResponsesLatestBlock === 'object'
        ? surveyNetCache.surveyResponsesLatestBlock as SurveyResultsRecord
        : {}
    );
    const localSBlock = currentSurveyId
      ? Number(surveyResponsesLatestBlock[currentSurveyId] || 0)
      : 0;

    const coarseSignature = [
      String(this.state.viewMode || ''),
      currentSurveyId,
      localQBlock,
      localRespBlock,
      localSBlock,
      this._lastPolledQuestionRefVersion,
      currentSurveyId ? this._lastPolledSurveyResponsesRefVersion : 0,
    ].join('|');
    const coarseSignatureUnchanged = coarseSignature === this._lastLocalStoragePollCoarseSignature;
    const blockOrRespChanged =
      localQBlock !== this.state.questionLocalBlock ||
      localRespBlock !== this.state.responseLocalBlock ||
      localSBlock !== this.state.surveyLocalBlock;

    if (this._fetchResponsesInFlight && !blockOrRespChanged) {
      return false;
    }

    const stableCycles = Math.max(0, Number(this._localStoragePollingStableCycles || 0));
    const forceRescanOnStableCycle =
      stableCycles > 0 &&
      (stableCycles % LOCAL_STORAGE_FORCE_RESCAN_EVERY) === 0;
    const shouldForceCountRescan =
      !this._fetchResponsesInFlight &&
      (!coarseSignatureUnchanged || forceRescanOnStableCycle);

    const newQuestionsCount = this._fetchResponsesInFlight
      ? Number(this.state.cachedQuestionsCount || 0)
      : this.getMemoizedQuestionsCountForPolling(questionsById, {
          forceScan: shouldForceCountRescan,
        });
    const localSurveyResponsesCount = currentSurveyId
      ? (
          this._fetchResponsesInFlight
            ? Number(this.state.cachedSurveyResponsesCount || 0)
            : this.getMemoizedSurveyResponsesCountForPolling(surveyResponsesById, currentSurveyId, {
                forceScan: shouldForceCountRescan,
              })
        )
      : 0;
    const detailedSignature = [
      coarseSignature,
      newQuestionsCount,
      localSurveyResponsesCount,
      netLatest,
    ].join('|');
    if (detailedSignature === this._lastLocalStoragePollDetailedSignature) {
      return false;
    }
    this._lastLocalStoragePollCoarseSignature = coarseSignature;
    this._lastLocalStoragePollDetailedSignature = detailedSignature;

    const questionCountChanged = newQuestionsCount !== this.state.cachedQuestionsCount;
    const surveyResponseCountChanged =
      localSurveyResponsesCount !== this.state.cachedSurveyResponsesCount;

    if (blockOrRespChanged || questionCountChanged || surveyResponseCountChanged) {
      this.setState(
        {
          questionLocalBlock: localQBlock,
          responseLocalBlock: localRespBlock,
          surveyLocalBlock: localSBlock,
          cachedQuestionsCount: newQuestionsCount,
          cachedSurveyResponsesCount: localSurveyResponsesCount,
          networkLatestBlock: netLatest
        },
        () => {
          this.queueResultsRefresh('poll-local-storage-change');
        }
      );
      return true;
    }

    return false;
  }) as boolean;
}

parseResponse = <T,>(responseData: T): T | SurveyResultsRecord | null => {
if (typeof responseData !== 'string') return responseData;
const memo = this._responseParseMemo as Map<string, unknown>;
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

getNetworkQuestionsForCurrentContext = (): Record<string, SurveyResultsQuestionRecord> => {
  const networkData = this.getScopedQuestionNetworkDataSync(
    this.state.viewMode || this.props.viewMode || 'questions'
  ) as SurveyResultsScopedQuestionNetworkData;
  return networkData.questions;
};

getEffectiveNetworkId = (): unknown => (
  this.props.network?.id ?? this.props.networkChainId ?? ''
);

hasEffectiveNetworkId = (): boolean => (
  String(this.getEffectiveNetworkId() ?? '').trim() !== ''
);

fetchResponses = async (): Promise<void> => {
if (!this.hasEffectiveNetworkId()) {
  surveyLog.error('Network ID is undefined in fetchResponses. Cannot proceed.');
  return;
}

  // Cache-first results should not wait on RPC freshness. Kick the latest-block
  // lookup into the background so the modal can render cached questions/responses
  // immediately, then let the sync badge catch up when the block call resolves.
  if (!Number(this.state.networkLatestBlock || 0)) {
    this.maybeRefreshNetworkLatestBlockFromPolling();
  }

if (this.state.viewMode === 'survey') {
  await this.fetchSurveyModeResponses();
} else {
  await this.fetchQuestionModeResponses();
}
};

  async fetchSurveyModeResponses() {
    const currentSurveyID = this.state.surveyId ? this.state.surveyId.toLowerCase() : null;

    // Use the robust slug resolver to ensure we read the correct cache
    const slug = this.getEffectiveSlug();
    const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? '');

    // Read the specific group's cache
    let surveysCache = peekCacheSync('surveysCache', slug, { clone: false }) || {};
    if (!surveysCache || Object.keys(surveysCache).length === 0) {
      surveysCache = (await readCache('surveysCache', slug)) || {};
    }
    const hasSurveyNetCache = !!(
      surveysCache &&
      typeof surveysCache === 'object' &&
      surveysCache[netIdStr] != null
    );
    const surveyNetCache = resolveNetBucketReadOnly(
      surveysCache,
      netIdStr,
      null
    ) as SurveyResultsSurveyBucketRecord | null;

    // If cache missing for this network, abort
    if (!hasSurveyNetCache || !surveyNetCache) {
      return;
    }

    if (!currentSurveyID) {
      const emptySignature = `${slug}|${netIdStr}|__none__`;
      if (this._surveyModeSourceSignature === emptySignature) {
        return;
      }
      this._surveyModeSourceSignature = emptySignature;
      this._surveyModeSourceCoarseSignature = emptySignature;
      this._surveyModeSourcePayloadRefSignature = '';
      this._surveyModeSourceCacheNonce = Number(this._surveysCacheChangeNonce || 0);
      this.setState(buildSurveyResultsEmptySurveyModePatch());
      return;
    }

    // In survey mode, show questions strictly belonging to this survey.
    const srMap = surveyNetCache.surveyResponses?.[currentSurveyID] || {};
    const allResponders = Object.keys(srMap);
    const networkQuestions = this.getNetworkQuestionsForCurrentContext();
    const questionIDsInSurvey: string[] = Array.isArray(surveyNetCache?.surveys?.[currentSurveyID]?.questionIDs)
      ? surveyNetCache.surveys[currentSurveyID].questionIDs as string[]
      : [];
    const questionIdsSignature = questionIDsInSurvey
      .map((qid) => String(qid || '').toLowerCase())
      .join('|');
    const surveyResponsesLatestBlock = Number(
      surveyNetCache?.surveyResponsesLatestBlock?.[currentSurveyID] || 0
    );
    const surveyDefinitionLatestBlock = Number(surveyNetCache?.surveysLatestBlock || 0);
    const surveyCacheChangeNonce = Number(this._surveysCacheChangeNonce || 0);
    const questionCacheReadySignal = this.props.isQuestionCacheReady ? 1 : 0;
    const payloadRefSignature = buildSurveyRespondersPayloadRefSignature(srMap);
    const coarseSourceSignature = [
      slug,
      netIdStr,
      currentSurveyID,
      questionCacheReadySignal,
      surveyResponsesLatestBlock,
      surveyDefinitionLatestBlock,
      allResponders.length,
      questionIdsSignature,
    ].join('::');
    const respondersSignature = buildSurveyRespondersSignature(srMap);
    const sourceSignature = [
      coarseSourceSignature,
      respondersSignature,
    ].join('::');
    if (this._surveyModeSourceSignature === sourceSignature) {
      this._surveyModeSourceCoarseSignature = coarseSourceSignature;
      this._surveyModeSourcePayloadRefSignature = payloadRefSignature;
      this._surveyModeSourceCacheNonce = surveyCacheChangeNonce;
      return;
    }
    this._surveyModeSourceCoarseSignature = coarseSourceSignature;
    this._surveyModeSourcePayloadRefSignature = payloadRefSignature;
    this._surveyModeSourceCacheNonce = surveyCacheChangeNonce;
    this._surveyModeSourceSignature = sourceSignature;

    const aggregatorMap: Record<string, SurveyResultsAggregateRow[]> = {};
    const rawResponses: SurveyResultsAggregateRow[] = [];
    allResponders.forEach((responder) => {
      const responderLower = String(responder || '').toLowerCase();
      const rawResp = normalizeSurveyResponsePayloadByQuestionId(
        this.parseResponse(srMap[responder])
      );
      if (!hasAnyCountableSurveyAnswer(rawResp, networkQuestions)) return;
      rawResponses.push({
        responder: responderLower,
        surveyId: currentSurveyID,
        response: rawResp,
      });
      if (!rawResp || !Array.isArray(rawResp.responses)) return;
      rawResp.responses.forEach((ans) => {
        const qIdL = getSurveyResponseQuestionId(ans);
        if (!qIdL) return;
        if (!aggregatorMap[qIdL]) aggregatorMap[qIdL] = [];
        aggregatorMap[qIdL].push({
          responder: responderLower,
          questionId: qIdL,
          response: ans,
          timestamp: getSurveyResponseAggregateTimestampMs(ans, rawResp),
        });
      });
    });
    const totalRespondersCount = rawResponses.length;

    const finalAggregator = unifyAggregatorWithAllQuestionIDs(
      aggregatorMap,
      questionIDsInSurvey
    );

    const totalQCount = Object.keys(finalAggregator).length;

    // Retrieve title from the correct group cache
    let foundTitle = '';
    let foundDocURLs: unknown[] = [];
    if (surveyNetCache?.surveys?.[currentSurveyID]) {
      foundTitle = surveyNetCache.surveys[currentSurveyID].title || '';
      foundDocURLs = Array.isArray(surveyNetCache.surveys[currentSurveyID].documentURLs)
        ? surveyNetCache.surveys[currentSurveyID].documentURLs
        : [];
    }

    // Initialize master and filtered views so UI renders immediately
    this.setState(buildSurveyResultsSurveyModeHydratedPatch({
      aggregateQuestionResponses: finalAggregator,
      filteredResponsesCount: rawResponses.length,
      responses: rawResponses,
      sbtFilteredAggregatorQuestionResponses: finalAggregator,
      sbtFilteredResponses: rawResponses,
      surveyDocumentURLs: foundDocURLs,
      surveyTitle: foundTitle,
      totalQuestionsCount: totalQCount,
      totalResponsesCount: totalRespondersCount,
    }));
  }



async fetchQuestionModeResponses(): Promise<void> {
const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? '');
if (!netIdStr) return;
const questionNetCache = await this.getScopedQuestionNetworkData('questions') as SurveyResultsScopedQuestionNetworkData;
		const allQuestions = questionNetCache?.questions || {};

		const partialQR: SurveyResultsQuestionResponsesByQuestion = questionNetCache?.questionResponses || {};
	const aggregatorMap: Record<string, unknown> = {};

	Object.keys(partialQR).forEach((qId) => {
	  const lowerQ = qId.toLowerCase();
	  aggregatorMap[lowerQ] = aggregatorMap[lowerQ] || {};
		  const respondersMap: SurveyResultsQuestionResponsesByResponder = partialQR[qId] || {};

  Object.keys(respondersMap).forEach((rAddr) => {
    const rData = respondersMap[rAddr];
    const parsed = this.parseResponse(rData) as SurveyResultsRecord | null;
    if (parsed) {
      // store as array downstream; collect as array here
      if (!Array.isArray(aggregatorMap[lowerQ])) {
        aggregatorMap[lowerQ] = [];
      }
      (aggregatorMap[lowerQ] as SurveyResultsAggregateRow[]).push({
        responder: rAddr.toLowerCase(),
        questionId: lowerQ,
        response: parsed,
        timestamp: parsed.timeStamp || 0
      });
    }
	  });
	});

	const knownQIDs = Object.keys(allQuestions);
	const finalAggregator = unifyAggregatorWithAllQuestionIDs(
	  aggregatorMap as Record<string, unknown[]>,
	  knownQIDs
	);
	const totalQ = Object.keys(finalAggregator).length;
  const totalResponseCount = countQuestionModeResponses(finalAggregator, allQuestions);

// Compute a baseline "filtered" count (used when no filters are active)
const initialFilteredCount = totalResponseCount;

// 🛡️ Preserve currently-applied filters across refresh if a filter is active
if (this.state.isFilterActive) {
  this.setState(
    buildSurveyResultsFilteredQuestionModeHydratedPatch({
      aggregatorQuestionResponses: finalAggregator,
      currentFilteredQuestionsCount: this.state.filteredQuestionsCount,
      currentFilteredResponsesCount: this.state.filteredResponsesCount,
      initialFilteredCount,
      questionResponses: partialQR,
      sbtFilteredAggregatorQuestionResponses: this.state.sbtFilteredAggregatorQuestionResponses,
      totalQuestionsCount: totalQ,
      totalResponsesCount: totalResponseCount,
    }),
    () => {
      // ask the QuestionFilter to re-apply its pipeline on the fresh data
      if (this.questionFilterRef && this.questionFilterRef.current) {
        try {
          this.questionFilterRef.current.handleApplyFilters(true);
        } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
      }
    }
  );
} else {
  // no active filters – reset filtered view to the full aggregator
  this.setState(buildSurveyResultsUnfilteredQuestionModeHydratedPatch({
    aggregatorQuestionResponses: finalAggregator,
    filteredResponsesCount: initialFilteredCount,
    questionResponses: partialQR,
    totalQuestionsCount: totalQ,
    totalResponsesCount: totalResponseCount,
  }));
}
}


generateResponsesCSV = (): string => {
const { viewMode, surveyViewMode, sbtFilteredResponses, sbtFilteredAggregatorQuestionResponses } = this.state;
let csvContent = '';
let header = '';
const csvRows: string[] = [];

if (!this.hasEffectiveNetworkId()) {
  this.setState(buildSurveyResultsAlertMessagePatch('Network not available for fetching question data.'));
  return '';
}
const networkQuestions = this.getNetworkQuestionsForCurrentContext();

const formatCell = (value: unknown): string => {
  const cellValue = Array.isArray(value) ? value.join(', ') : value;
  const stringValue = String(cellValue !== undefined && cellValue !== null ? cellValue : '');
  return `"${stringValue.replace(/"/g, '""')}"`;
};

// -------- filename (prefix by mode) --------
const tsName = new Date().toISOString().replace(/[:.]/g, '_');
try {
  const isSurveyIndividuals = (viewMode === 'survey' && surveyViewMode === 'individuals');
  const prefix = isSurveyIndividuals ? 'contextEngine_surveyResponses' : 'contextEngine_questionResponses';

  let cleanSession = '';
  const sessionName = this.props.sessionName;
  try {
    if (typeof sessionName === 'string' && sessionName.trim().length > 0) {
      cleanSession = sessionName.replace(/[^A-Za-z0-9_-]+/g, '');
    } else if (sessionName !== undefined) {
      surveyLog.error('[SurveyResults.generateResponsesCSV] sessionName provided but not a non-empty string:', sessionName);
    }
  } catch (orgErr) {
    surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to sanitize sessionName:', orgErr);
  }

  const suggested = `${prefix}_${tsName}${cleanSession ? '_' + cleanSession : ''}.csv`;
  this.csvFileName = suggested;
  if (typeof this.setState === 'function') {
    this.setState(buildSurveyResultsCsvFileNamePatch(suggested));
  }
} catch (err) {
  surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to set CSV filename:', err);
  const fallback = `contextEngine_questionResponses_${tsName}.csv`;
  this.csvFileName = fallback;
  try {
    if (typeof this.setState === 'function') {
      this.setState(buildSurveyResultsCsvFileNamePatch(fallback));
    }
  } catch (innerErr) {
    surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to set fallback CSV filename:', innerErr);
  }
}

if (viewMode === 'survey' && surveyViewMode === 'individuals') {
  header = 'responderAddress,questionID,questionPrompt,type,options,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp\n';

  // De-dupe latest per (responder|questionID)
  const latest = new Map<string, SurveyResultsCsvLatestEntry>();
  const passthroughRows: string[] = [];

  const filteredResponses = Array.isArray(sbtFilteredResponses)
    ? sbtFilteredResponses as SurveyResultsCsvResponseEntry[]
    : [];
  filteredResponses.forEach((response) => {
    const parsedResponse = this.parseResponse(response.response) as SurveyResultsSurveyResponsePayload | null;
    if (parsedResponse && Array.isArray(parsedResponse.responses)) {
      parsedResponse.responses.forEach((answer: SurveyResultsResponseRecord) => {
        const qid = getResponseQuestionId(answer);
        const responderAddress =
          typeof response.responder === 'string'
            ? response.responder
            : (response.responder && toSurveyResultsRecord(response.responder).address) || response.responder || '';

        const questionData = networkQuestions[qid?.toLowerCase?.() ?? qid];
        let optionsString = '';
        if (questionData && questionData.type === 'multichoice' && Array.isArray(questionData.options)) {
          optionsString = questionData.options.join(';');
        }

        const ms = pickTimestampMs(answer, parsedResponse, response);
        const tsOut = formatTsForCsv(ms);

        const row = [
          responderAddress,
          qid,
          getResponseQuestionPrompt(answer, questionData),
          getResponseQuestionType(answer, questionData),
          optionsString,
          getConvictionValue(answer),
          answer.answer?.value,
          answer.answer?.hash,
          answer.additional?.value,
          answer.answer?.encrypted,
          answer.additional?.encrypted,
          answer.additional?.hash,
          tsOut
        ].map(formatCell).join(',');

        if (!responderAddress || !qid) {
          passthroughRows.push(row);
          return;
        }

        const key = `${String(responderAddress).toLowerCase()}|${String(qid).toLowerCase()}`;
        const prev = latest.get(key);
        if (!prev || ms > prev.ms) {
          latest.set(key, { ms, row });
        }
      });
    }
  });

  csvRows.push(...passthroughRows, ...Array.from(latest.values()).map((v) => v.row));
} else {
  // 'questions' mode or 'survey' -> 'aggregate' mode (question-centric)
  header = 'questionID,questionPrompt,type,options,responderAddress,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp\n';

  const dataToExport = toSurveyResultsRecord(sbtFilteredAggregatorQuestionResponses);
  const latest = new Map<string, SurveyResultsCsvLatestEntry>();
  const passthroughRows: string[] = [];

  Object.entries(dataToExport).forEach(([questionIdFromBucket, responsesArray]) => {
    const rows = Array.isArray(responsesArray) ? responsesArray as SurveyResultsCsvResponseEntry[] : [];
    rows.forEach((respObj) => {
      const parsed = this.parseResponse(respObj.response) as SurveyResultsResponseRecord | null;
      if (!parsed) return;

      let responderAddress = '';
      if (typeof respObj.responder === 'string') {
        responderAddress = respObj.responder;
      } else if (respObj.responder && typeof toSurveyResultsRecord(respObj.responder).address === 'string') {
        responderAddress = toSurveyResultsRecord(respObj.responder).address as string;
      }

      const qid = getResponseQuestionId(parsed) || String(questionIdFromBucket || '');
      const questionData = networkQuestions[qid?.toLowerCase?.() ?? qid];
      let optionsString = '';
      if (questionData && questionData.type === 'multichoice' && Array.isArray(questionData.options)) {
        optionsString = questionData.options.join(';');
      }

      const ms = pickTimestampMs(parsed, null, respObj);
      const tsOut = formatTsForCsv(ms);

      const row = [
        qid,
        getResponseQuestionPrompt(parsed, questionData),
        getResponseQuestionType(parsed, questionData),
        optionsString,
        responderAddress,
        getConvictionValue(parsed),
        parsed.answer?.value,
        parsed.answer?.hash,
        parsed.additional?.value,
        parsed.answer?.encrypted,
        parsed.additional?.encrypted,
        parsed.additional?.hash,
        tsOut
      ].map(formatCell).join(',');

      if (!responderAddress || !qid) {
        passthroughRows.push(row);
        return;
      }

      const key = `${String(responderAddress).toLowerCase()}|${String(qid).toLowerCase()}`;
      const prev = latest.get(key);
      if (!prev || ms > prev.ms) {
        latest.set(key, { ms, row });
      }
    });
  });

  csvRows.push(...passthroughRows, ...Array.from(latest.values()).map((v) => v.row));
}

csvContent = header + csvRows.join('\n');
return csvContent;
}

generateResultsJSON = (): string => {
const {
  viewMode,
  surveyViewMode,
  surveyId,
  surveyTitle,
  totalQuestionsCount,
  totalResponsesCount,
  filteredQuestionsCount,
  filteredResponsesCount,
  filterState,
  sbtFilteredResponses,
  sbtFilteredAggregatorQuestionResponses,
} = this.state;

const filteredQuestions = this.getFilteredQuestionsForExport();

return JSON.stringify(
  {
    exportedAt: new Date().toISOString(),
    sessionSlug: this.getEffectiveSlug() || '',
    viewMode,
    surveyViewMode,
    surveyId: surveyId || null,
    surveyTitle: surveyTitle || '',
    counts: {
      totalQuestions: totalQuestionsCount,
      filteredQuestions: filteredQuestionsCount,
      totalResponses: totalResponsesCount,
      filteredResponses: filteredResponsesCount,
    },
    filterState: filterState || {},
    filteredQuestions,
    filteredQuestionResponses: sbtFilteredAggregatorQuestionResponses || {},
    filteredResponses: sbtFilteredResponses || [],
  },
  null,
  2
);
}

getFilteredQuestionIdsForExport = (): string[] => {
const questionIds = new Set<string>();

Object.keys(this.state.sbtFilteredAggregatorQuestionResponses || {}).forEach((qId) => {
  const normalized = String(qId || '').trim().toLowerCase();
  if (normalized) questionIds.add(normalized);
});

(this.state.sbtFilteredResponses || []).forEach((response: SurveyResultsSummaryResponseRow) => {
  const parsedResponse = this.parseResponse(response?.response);
  const responseRows = Array.isArray(parsedResponse?.responses) ? parsedResponse.responses : [];
  responseRows.forEach((answer: SurveyResultsResponseRecord) => {
    const normalized = getResponseQuestionId(answer);
    if (normalized) questionIds.add(String(normalized).toLowerCase());
  });
});

return Array.from(questionIds);
}

getFilteredQuestionsForExport = (): SurveyResultsQuestionExportRecord[] => {
const networkQuestions = this.getNetworkQuestionsForCurrentContext() as Record<string, SurveyResultsRecord | undefined>;
return this.getFilteredQuestionIdsForExport().map((qId) => {
  const normalizedQuestionId = qId.toLowerCase();
  const questionData = networkQuestions[normalizedQuestionId] || networkQuestions[qId] || {};

  return {
    id: questionData.id || qId,
    prompt: questionData.prompt || '',
    type: questionData.type || '',
    tags: Array.isArray(questionData.tags) ? [...questionData.tags] : [],
    options: Array.isArray(questionData.options) ? [...questionData.options] : [],
  };
});
}

generateQuestionsJSON = (): string => {
const {
  viewMode,
  surveyViewMode,
  surveyId,
  surveyTitle,
  totalQuestionsCount,
  totalResponsesCount,
  filteredQuestionsCount,
  filteredResponsesCount,
  filterState,
} = this.state;

return JSON.stringify(
  {
    exportedAt: new Date().toISOString(),
    sessionSlug: this.getEffectiveSlug() || '',
    viewMode,
    surveyViewMode,
    surveyId: surveyId || null,
    surveyTitle: surveyTitle || '',
    counts: {
      totalQuestions: totalQuestionsCount,
      filteredQuestions: filteredQuestionsCount,
      totalResponses: totalResponsesCount,
      filteredResponses: filteredResponsesCount,
    },
    filterState: filterState || {},
    filteredQuestions: this.getFilteredQuestionsForExport(),
  },
  null,
  2
);
}

generateQuestionsCSV = (): string => {
if (!this.hasEffectiveNetworkId()) {
  this.setState(buildSurveyResultsAlertMessagePatch('Network not available for fetching question data.'));
  return '';
}

const filteredQuestions = this.getFilteredQuestionsForExport();
if (!filteredQuestions.length) {
  this.setState(buildSurveyResultsAlertMessagePatch('No filtered questions to export.'));
  return '';
}

const header = '"questionID","prompt","type","tags","options"\n';
const csvRows = filteredQuestions.map((question) => {
  const tags = Array.isArray(question?.tags) ? question.tags.join(';') : '';
  const options = Array.isArray(question?.options) ? question.options.join(';') : '';
  return [
    `"${String(question?.id || '').replace(/"/g, '""')}"`,
    `"${String(question?.prompt || '').replace(/"/g, '""')}"`,
    `"${String(question?.type || '').replace(/"/g, '""')}"`,
    `"${String(tags).replace(/"/g, '""')}"`,
    `"${String(options).replace(/"/g, '""')}"`,
  ].join(',');
});

return header + csvRows.join('\n');
}

getHtmlReportChainId = (): number | null => {
const network = toSurveyResultsRecord(this.props.network);
const chainId = Number(network.id ?? network.chainId);
return Number.isFinite(chainId) ? chainId : null;
}

getHtmlReportNetworkLabel = (): string => {
const network = toSurveyResultsRecord(this.props.network);
const chainId = this.getHtmlReportChainId();
const explicitLabel = String(network.name || network.label || network.network || '').trim();
if (explicitLabel) return explicitLabel;
if (chainId === 11155420) return 'OP Sepolia';
if (chainId === 84532) return 'Base Sepolia';
return chainId ? `Chain ${chainId}` : '';
}

getHtmlReportResponseCountsByQuestion = (): Map<string, number> => {
const counts = new Map<string, number>();
const addCount = (questionId: unknown, amount = 1): void => {
  const normalized = String(questionId || '').trim().toLowerCase();
  if (!normalized) return;
  counts.set(normalized, (counts.get(normalized) || 0) + amount);
};

if (this.state.viewMode === 'survey' && this.state.surveyViewMode === 'individuals') {
  const filteredResponses = Array.isArray(this.state.sbtFilteredResponses)
    ? this.state.sbtFilteredResponses as SurveyResultsResponseListEntry[]
    : [];
  filteredResponses.forEach((responseRow) => {
    const parsedResponse = this.parseResponse(responseRow.response) as SurveyResultsSurveyResponsePayload | null;
    const responseRows = Array.isArray(parsedResponse?.responses) ? parsedResponse.responses : [];
    responseRows.forEach((answer) => {
      addCount(getResponseQuestionId(answer));
    });
  });
  return counts;
}

const aggregator = toSurveyResultsRecord(this.state.sbtFilteredAggregatorQuestionResponses);
Object.entries(aggregator).forEach(([questionId, rows]) => {
  addCount(questionId, Array.isArray(rows) ? rows.length : 0);
});
return counts;
}

getHtmlReportParticipantCount = (): number => {
const participants = new Set<string>();
const addParticipant = (value: unknown): void => {
  if (typeof value === 'string' && value.trim()) {
    participants.add(value.trim().toLowerCase());
    return;
  }
  const record = toSurveyResultsRecord(value);
  const address = String(record.address || record.walletAddress || '').trim();
  if (address) participants.add(address.toLowerCase());
};

if (this.state.viewMode === 'survey' && this.state.surveyViewMode === 'individuals') {
  const filteredResponses = Array.isArray(this.state.sbtFilteredResponses)
    ? this.state.sbtFilteredResponses as SurveyResultsResponseListEntry[]
    : [];
  filteredResponses.forEach((responseRow) => addParticipant(responseRow.responder));
  return participants.size;
}

const aggregator = toSurveyResultsRecord(this.state.sbtFilteredAggregatorQuestionResponses);
Object.values(aggregator).forEach((rows) => {
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => addParticipant((toSurveyResultsRecord(row)).responder));
});
return participants.size;
}

getHtmlReportQuestionsForExport = (): SessionResultsReportQuestion[] => {
const countsByQuestion = this.getHtmlReportResponseCountsByQuestion();
return this.getFilteredQuestionsForExport().map((question) => {
  const id = String(question.id || '').trim();
  const countKey = id.toLowerCase();
  return {
    id,
    prompt: String(question.prompt || '').trim(),
    type: String(question.type || '').trim(),
    tags: Array.isArray(question.tags) ? question.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : [],
    options: Array.isArray(question.options)
      ? question.options.map((option) => String(option || '').trim()).filter(Boolean)
      : [],
    responseCount: countsByQuestion.get(countKey) || 0,
  };
});
}

isHtmlReportDemoSession = (): boolean => {
const candidates = [
  this.getEffectiveSlug(),
  this.props.sessionSlug,
  this.props.activeSessionSlug,
  this.state.surveyTitle,
].map((value) => String(value || '').trim().toLowerCase());
return candidates.includes('demo');
}

isHtmlReportDemoModeActive = (): boolean => (
  this.isHtmlReportDemoSession() && !!this.state.htmlReportDemoMode
);

getHtmlReportExporterMetadata = () => {
if (this.isHtmlReportDemoModeActive()) {
  return {
    address: 'demo-preview',
    chainId: this.getHtmlReportChainId(),
    displayAddress: 'Demo preview',
  };
}
const account = String(this.props.account || '').trim();
if (!this.props.loginComplete || !account) return null;
return {
  address: account,
  chainId: this.getHtmlReportChainId(),
  displayAddress: shortenSessionResultsAddress(account),
};
}

isHtmlReportExportAuthorized = (): boolean => !!this.getHtmlReportExporterMetadata();

getHtmlReportSelectedSections = (): Required<SessionResultsSectionSelection> => ({
  ...DEFAULT_HTML_REPORT_SELECTED_SECTIONS,
  ...(this.state.htmlReportSelectedSections || {}),
});

getHtmlReportAnalysisArtifact = (): SessionResultsGeneratedAnalysisArtifact | null => {
const artifact = this.state.htmlReportAnalysisArtifact as SessionResultsGeneratedAnalysisArtifact | null;
return artifact && artifact.kind ? artifact : null;
}

buildHtmlReportDemoAnalysisArtifact = (): SessionResultsGeneratedAnalysisArtifact => {
const built = this.buildSessionResultsAnalysisPayloadForAi();
const questions = built.aiPayload.questions;
const responseCounts = new Map<string, number>();
built.aiPayload.responses.forEach((response) => {
  const key = String(response.questionId || '').trim();
  if (!key) return;
  responseCounts.set(key, (responseCounts.get(key) || 0) + 1);
});
const questionModels = questions.length > 0
  ? questions.slice(0, 6)
  : [{ id: 'demo-results', prompt: 'Demo results', type: 'demo', options: [], tags: [] }];
const groups = questionModels.slice(0, 4).map((question, index) => ({
  id: `demo_group_${index + 1}`,
  label: question.prompt || `Demo theme ${index + 1}`,
  questionIds: [question.id],
  responseCount: responseCounts.get(question.id) || 0,
  summary: `Demo preview theme derived from ${responseCounts.get(question.id) || 0} visible response${(responseCounts.get(question.id) || 0) === 1 ? '' : 's'}.`,
}));
const nodes = questionModels.map((question, index) => ({
  id: `demo_atlas_${index + 1}`,
  label: question.prompt || `Demo node ${index + 1}`,
  path: ['Demo Session', question.prompt || `Question ${index + 1}`],
  questionIds: [question.id],
  responseCount: responseCounts.get(question.id) || 0,
  summary: 'Demo preview node generated from hydrated results.',
}));
const edges = nodes.slice(1).map((node, index) => ({
  source: nodes[0]?.id || 'demo_atlas_1',
  target: node.id,
  label: index % 2 === 0 ? 'related theme' : 'adjacent concern',
}));

return {
  generatedAt: new Date().toISOString(),
  inputSignature: `demo-preview-${built.inputSignature}`,
  kind: 'ce_session_results_analysis_artifact',
  model: 'demo-preview',
  participants: built.participants,
  sections: {
    argumentMap: {
      available: true,
      debates: questionModels.slice(0, 3).map((question, index) => ({
        id: `demo_debate_${index + 1}`,
        title: question.prompt || `Demo debate ${index + 1}`,
        claims: [
          {
            id: `demo_claim_${index + 1}`,
            label: `Participants surface tradeoffs around ${question.prompt || 'this result'}.`,
            questionIds: [question.id],
            responseCount: responseCounts.get(question.id) || 0,
            stance: 'mixed',
          },
        ],
      })),
    },
    atlas: {
      available: true,
      edges,
      nodes,
    },
    breakdown: {
      available: true,
      groups,
      summary: {
        overview: 'Demo preview analysis generated locally from currently hydrated results.',
      },
    },
    riskMatrix: {
      available: true,
      categories: questionModels.slice(0, 4).map((question, index) => ({
        id: `demo_risk_${index + 1}`,
        label: question.prompt || `Demo risk ${index + 1}`,
        description: 'Demo preview category for PDF/HTML layout testing.',
      })),
      comments: questionModels.slice(0, 4).map((question, index) => ({
        id: `demo_risk_comment_${index + 1}`,
        categoryId: `demo_risk_${index + 1}`,
        questionIds: [question.id],
        summary: `Demo preview signal from ${responseCounts.get(question.id) || 0} visible response${(responseCounts.get(question.id) || 0) === 1 ? '' : 's'}.`,
      })),
      heatmap: questionModels.slice(0, 4).reduce<Record<string, unknown>>((acc, question, index) => {
        acc[`demo_risk_${index + 1}`] = {
          impact: index % 2 === 0 ? 'medium' : 'high',
          likelihood: (responseCounts.get(question.id) || 0) > 1 ? 'medium' : 'low',
        };
        return acc;
      }, {}),
      scenarioLinks: [],
    },
  },
  source: 'ai-generated',
  version: 1,
};
}

getSessionResultsAnalysisCacheSlug = (): string => this.getEffectiveSlug() || 'general';

getSessionResultsAnalysisCacheKey = (inputSignature: unknown): string => (
`sessionResultsAnalysis:v1:${this.getHtmlReportNetworkLabel() || this.getHtmlReportChainId() || 'unknown'}:${String(inputSignature || '')}`
);

getSessionResultsAnalysisCacheBucket = (): SurveyResultsRecord => {
const cacheObj = peekCacheSync('analysisCache', this.getSessionResultsAnalysisCacheSlug(), { clone: false });
return toSurveyResultsRecord(cacheObj);
}

readSessionResultsAnalysisArtifactFromCache = (
inputSignature: unknown
): SessionResultsGeneratedAnalysisArtifact | null => {
const bucket = this.getSessionResultsAnalysisCacheBucket();
const artifacts = toSurveyResultsRecord(bucket.sessionResultsAnalysis);
const artifact = artifacts[this.getSessionResultsAnalysisCacheKey(inputSignature)];
return artifact && typeof artifact === 'object'
  ? artifact as SessionResultsGeneratedAnalysisArtifact
  : null;
}

writeSessionResultsAnalysisArtifactToCache = async (
artifact: SessionResultsGeneratedAnalysisArtifact
): Promise<void> => {
const slug = this.getSessionResultsAnalysisCacheSlug();
const current = toSurveyResultsRecord(await readCache('analysisCache', slug));
const artifacts = toSurveyResultsRecord(current.sessionResultsAnalysis);
await (writeCache as SurveyResultsWriteCache)('analysisCache', slug, {
  ...current,
  sessionResultsAnalysis: {
    ...artifacts,
    [this.getSessionResultsAnalysisCacheKey(artifact.inputSignature)]: artifact,
  },
});
}

getSessionResultsAnalysisTextField = (field: unknown): string => {
if (field === null || field === undefined) return '';
if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') {
  return String(field).trim();
}
const record = toSurveyResultsRecord(field);
const value = record.value ?? record.text ?? record.answer;
if (value === null || value === undefined || value === '*') return '';
if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
  return String(value).trim();
}
return '';
}

getSessionResultsAnalysisResponsesForExport = (): SessionResultsAnalysisResponseInput[] => {
const rows: SessionResultsAnalysisResponseInput[] = [];
const networkQuestions = this.getNetworkQuestionsForCurrentContext() as Record<string, SurveyResultsRecord | undefined>;
const pushRow = (
  response: SurveyResultsResponseRecord | null | undefined,
  responder: unknown,
  questionIdFallback: unknown = ''
): void => {
  if (!response || typeof response !== 'object') return;
  const questionId = getResponseQuestionId(response) || String(questionIdFallback || '').trim();
  if (!questionId) return;
  const questionData = networkQuestions[questionId.toLowerCase()] || networkQuestions[questionId] || {};
  const answer = this.getSessionResultsAnalysisTextField(response.answer);
  const additional = this.getSessionResultsAnalysisTextField(response.additional);
  if (!answer && !additional) return;
  rows.push({
    additional,
    answer,
    participantAddress: responder,
    questionId,
    questionPrompt: getResponseQuestionPrompt(response, questionData),
    questionType: getResponseQuestionType(response, questionData),
  });
};

if (this.state.viewMode === 'survey' && this.state.surveyViewMode === 'individuals') {
  const filteredResponses = Array.isArray(this.state.sbtFilteredResponses)
    ? this.state.sbtFilteredResponses as SurveyResultsResponseListEntry[]
    : [];
  filteredResponses.forEach((responseRow) => {
    const parsedResponse = this.parseResponse(responseRow.response) as SurveyResultsSurveyResponsePayload | null;
    const responseRows = Array.isArray(parsedResponse?.responses) ? parsedResponse.responses : [];
    responseRows.forEach((answer) => pushRow(answer, responseRow.responder));
  });
  return rows;
}

const aggregator = toSurveyResultsRecord(this.state.sbtFilteredAggregatorQuestionResponses);
Object.entries(aggregator).forEach(([questionId, responsesArray]) => {
  if (!Array.isArray(responsesArray)) return;
  responsesArray.forEach((responseRow) => {
    const row = toSurveyResultsRecord(responseRow);
    const parsed = this.parseResponse(row.response) as SurveyResultsResponseRecord | null;
    pushRow(parsed, row.responder, questionId);
  });
});
return rows;
}

buildSessionResultsAnalysisPayloadForAi = () => {
const sessionSlug = this.getEffectiveSlug() || '';
const sessionName = String(this.props.sessionName || this.state.surveyTitle || sessionSlug || 'Session').trim();
const built = buildSessionResultsAnalysisAiPayload({
  questions: this.getHtmlReportQuestionsForExport(),
  responses: this.getSessionResultsAnalysisResponsesForExport(),
  session: {
    name: sessionName,
    slug: sessionSlug,
  },
});
return {
  ...built,
  eligibility: evaluateSessionResultsAnalysisEligibility(built.aiPayload),
  inputSignature: buildSessionResultsAnalysisInputSignature(built.aiPayload),
};
}

buildSessionResultsHtmlReportSnapshot = (
exportedAt: unknown = new Date().toISOString()
): SessionResultsHtmlSnapshot => {
const questions = this.getHtmlReportQuestionsForExport();
const countsByQuestion = this.getHtmlReportResponseCountsByQuestion();
const analysisArtifact = this.getHtmlReportAnalysisArtifact();
const responseCountFromRows = Array.from(countsByQuestion.values()).reduce((sum, count) => sum + count, 0);
const responsesCount =
  responseCountFromRows ||
  Number(this.state.filteredResponsesCount) ||
  Number(this.state.totalResponsesCount) ||
  0;
const questionsCount =
  questions.length ||
  Number(this.state.filteredQuestionsCount) ||
  Number(this.state.totalQuestionsCount) ||
  0;
const sessionSlug = this.getEffectiveSlug() || '';
const sessionName = String(this.props.sessionName || this.state.surveyTitle || sessionSlug || 'Session').trim();
const hasReportContent = questions.length > 0 || responsesCount > 0;

return buildRedactedSessionResultsSnapshot({
  exportedAt,
  session: {
    slug: sessionSlug,
    name: sessionName,
    chainId: this.getHtmlReportChainId(),
    networkLabel: this.getHtmlReportNetworkLabel(),
    latestKnownBlock: this.state.networkLatestBlock || null,
  },
  exportedBy: this.getHtmlReportExporterMetadata() || undefined,
  counts: {
    questions: questionsCount,
    responses: responsesCount,
    participants: this.getHtmlReportParticipantCount(),
    atlasNodes: analysisArtifact?.sections.atlas.nodes.length || 0,
    riskMatrixComments: analysisArtifact?.sections.riskMatrix.comments.length || 0,
  },
  filters: {
    filterState: this.state.filterState || {},
    surveyId: this.state.surveyId || null,
    surveyViewMode: this.state.surveyViewMode || null,
    viewMode: this.state.viewMode || null,
  },
  sections: {
    report: {
      available: hasReportContent,
      summary: {
        ...(analysisArtifact?.sections.breakdown.summary || {}),
        filteredQuestions: questions.length,
        generatedAnalysisAt: analysisArtifact?.generatedAt || null,
        surveyId: this.state.surveyId || null,
        surveyTitle: this.state.surveyTitle || '',
        surveyViewMode: this.state.surveyViewMode || '',
        viewMode: this.state.viewMode || '',
      },
      groups: analysisArtifact?.sections.breakdown.groups || [],
      representativeQuestions: [],
      questions,
      reason: hasReportContent ? undefined : 'No filtered questions or responses are hydrated yet.',
    },
    argumentMap: {
      available: !!analysisArtifact?.sections.argumentMap.available,
      debates: analysisArtifact?.sections.argumentMap.debates || [],
      reason: analysisArtifact?.sections.argumentMap.reason || 'Generate analysis views to derive an argument map from this session data.',
    },
    riskMatrix: {
      available: !!analysisArtifact?.sections.riskMatrix.available,
      categories: analysisArtifact?.sections.riskMatrix.categories || [],
      comments: analysisArtifact?.sections.riskMatrix.comments || [],
      heatmap: analysisArtifact?.sections.riskMatrix.heatmap || {},
      scenarioLinks: analysisArtifact?.sections.riskMatrix.scenarioLinks || [],
      reason: analysisArtifact?.sections.riskMatrix.reason || 'Generate analysis views to derive a custom risk matrix from this session data.',
    },
    atlas: {
      available: !!analysisArtifact?.sections.atlas.available,
      nodes: analysisArtifact?.sections.atlas.nodes || [],
      edges: analysisArtifact?.sections.atlas.edges || [],
      reason: analysisArtifact?.sections.atlas.reason || 'Generate analysis views to derive atlas nodes from this session data.',
    },
  },
});
}

getHtmlReportSectionAvailability = (
snapshot: SessionResultsHtmlSnapshot
): SurveyResultsHtmlReportSectionAvailability => ({
  report: snapshot.sections.report.available,
  argumentMap: snapshot.sections.argumentMap.available,
  riskMatrix: snapshot.sections.riskMatrix.available,
  atlas: snapshot.sections.atlas.available,
  snapshotJson: true,
});

getHtmlReportSectionRows = (
snapshot: SessionResultsHtmlSnapshot
): SurveyResultsHtmlReportSectionRow[] => ([
  {
    available: snapshot.sections.report.available,
    key: 'report',
    label: 'Report',
    reason: snapshot.sections.report.available ? 'Ready' : 'No hydrated results',
  },
  {
    available: snapshot.sections.argumentMap.available,
    key: 'argumentMap',
    label: 'Argument Map',
    reason: snapshot.sections.argumentMap.available ? 'Ready' : 'Needs analysis',
  },
  {
    available: snapshot.sections.riskMatrix.available,
    key: 'riskMatrix',
    label: 'Risk Matrix',
    reason: snapshot.sections.riskMatrix.available ? 'Ready' : 'Needs analysis',
  },
  {
    available: snapshot.sections.atlas.available,
    key: 'atlas',
    label: 'Atlas Nodes',
    reason: snapshot.sections.atlas.available ? 'Ready' : 'Needs analysis',
  },
  {
    available: true,
    key: 'snapshotJson',
    label: 'Embedded Snapshot JSON',
    reason: 'Always available',
  },
]);

hasHtmlReportExportableSections = (
  snapshot: SessionResultsHtmlSnapshot,
  sections: Required<SessionResultsSectionSelection> = this.getHtmlReportSelectedSections()
): boolean => (
  (sections.report && snapshot.sections.report.available) ||
  (sections.argumentMap && snapshot.sections.argumentMap.available) ||
  (sections.riskMatrix && snapshot.sections.riskMatrix.available) ||
  (sections.atlas && snapshot.sections.atlas.available) ||
  sections.snapshotJson
);

hasHtmlReportUnavailableSelectedSections = (
  snapshot: SessionResultsHtmlSnapshot,
  sections: Required<SessionResultsSectionSelection> = this.getHtmlReportSelectedSections()
): boolean => (
  (sections.report && !snapshot.sections.report.available) ||
  (sections.argumentMap && !snapshot.sections.argumentMap.available) ||
  (sections.riskMatrix && !snapshot.sections.riskMatrix.available) ||
  (sections.atlas && !snapshot.sections.atlas.available)
);

needsHtmlReportAnalysisGeneration = (
  snapshot: SessionResultsHtmlSnapshot,
  sections: Required<SessionResultsSectionSelection> = this.getHtmlReportSelectedSections()
): boolean => (
  HTML_REPORT_ANALYSIS_SECTION_KEYS.some((key) => sections[key] && !this.getHtmlReportSectionAvailability(snapshot)[key])
);

canDownloadHtmlReport = (
  snapshot: SessionResultsHtmlSnapshot,
  sections: Required<SessionResultsSectionSelection> = this.getHtmlReportSelectedSections()
): boolean => (
  this.isHtmlReportExportAuthorized() &&
  this.hasHtmlReportExportableSections(snapshot, sections) &&
  !this.hasHtmlReportUnavailableSelectedSections(snapshot, sections) &&
  !this.state.htmlReportAnalysisGenerating
);

openHtmlReportExportModal = (): void => {
const snapshot = this.buildSessionResultsHtmlReportSnapshot();
this.setState({
  htmlReportModalOpen: true,
  htmlReportExportedAt: snapshot.exportedAt,
  htmlReportAnalysisError: '',
  alertMessage: '',
});
}

closeHtmlReportExportModal = (): void => {
this.setState({
  htmlReportModalOpen: false,
});
}

toggleHtmlReportSection = (key: SurveyResultsHtmlReportSectionKey): void => {
const current = this.getHtmlReportSelectedSections();
this.setState({
  htmlReportSelectedSections: {
    ...current,
    [key]: !current[key],
  },
});
}

toggleHtmlReportDemoMode = (): void => {
const nextDemoMode = !this.state.htmlReportDemoMode;
const currentArtifact = this.getHtmlReportAnalysisArtifact();
this.setState({
  htmlReportDemoMode: nextDemoMode,
  htmlReportAnalysisArtifact: nextDemoMode
    ? this.buildHtmlReportDemoAnalysisArtifact()
    : currentArtifact?.model === 'demo-preview'
      ? null
      : currentArtifact,
  htmlReportAnalysisError: '',
  htmlReportSelectedSections: nextDemoMode
    ? {
      argumentMap: true,
      atlas: true,
      report: true,
      riskMatrix: true,
      snapshotJson: true,
    }
    : { ...DEFAULT_HTML_REPORT_SELECTED_SECTIONS },
});
}

handleHtmlReportFormatChange = (format: SessionResultsExportFormat): void => {
this.setState({ htmlReportExportFormat: format });
}

generateHtmlReportAnalysisViews = async (): Promise<void> => {
if (this.isHtmlReportDemoModeActive()) {
  this.setState({
    htmlReportAnalysisArtifact: this.buildHtmlReportDemoAnalysisArtifact(),
    htmlReportAnalysisError: '',
  });
  return;
}
if (!this.isHtmlReportExportAuthorized()) {
  this.setState({
    htmlReportAnalysisError: 'Connect a wallet with permission to view these results before generating analysis views.',
  });
  return;
}

const {
  aiPayload,
  eligibility,
  inputSignature,
  participants,
} = this.buildSessionResultsAnalysisPayloadForAi();
if (!eligibility.eligible) {
  this.setState({
    htmlReportAnalysisError: eligibility.reasons.join(' '),
    htmlReportAnalysisInputSignature: inputSignature,
  });
  return;
}

const cached = this.readSessionResultsAnalysisArtifactFromCache(inputSignature);
if (cached) {
  this.setState({
    htmlReportAnalysisArtifact: cached,
    htmlReportAnalysisError: '',
    htmlReportAnalysisInputSignature: inputSignature,
  });
  return;
}

this.setState({
  htmlReportAnalysisGenerating: true,
  htmlReportAnalysisError: '',
  htmlReportAnalysisInputSignature: inputSignature,
});

try {
  const prompt = buildSessionResultsAnalysisPrompt(aiPayload);
  const rawOutput = await callAI(prompt, {
    sessionSlug: this.getEffectiveSlug() || '',
    thinking: true,
  });
  const artifact = normalizeGeneratedSessionResultsAnalysisArtifact({
    generatedAt: new Date().toISOString(),
    inputSignature,
    participants,
    rawOutput,
  });
  await this.writeSessionResultsAnalysisArtifactToCache(artifact);
  this.setState({
    htmlReportAnalysisArtifact: artifact,
    htmlReportAnalysisGenerating: false,
    htmlReportAnalysisError: '',
  });
} catch (error) {
  surveyLog.error('[SurveyResults.generateHtmlReportAnalysisViews] Failed to generate analysis:', error);
  this.setState({
    htmlReportAnalysisGenerating: false,
    htmlReportAnalysisError: 'Unable to generate analysis views right now. Check AI settings and try again.',
  });
}
}

downloadHtmlReport = async (): Promise<void> => {
const exportedAt = this.state.htmlReportExportedAt || new Date().toISOString();
const snapshot = this.buildSessionResultsHtmlReportSnapshot(exportedAt);
const selectedSections = this.getHtmlReportSelectedSections();
if (!this.isHtmlReportExportAuthorized()) {
  this.setState(buildSurveyResultsAlertMessagePatch('Connect a wallet with permission to view these results before export.'));
  return;
}
if (!this.hasHtmlReportExportableSections(snapshot, selectedSections)) {
  this.setState(buildSurveyResultsAlertMessagePatch('Select at least one available report section before export.'));
  return;
}
if (this.hasHtmlReportUnavailableSelectedSections(snapshot, selectedSections)) {
  this.setState(buildSurveyResultsAlertMessagePatch('Generate selected analysis views before downloading the report.'));
  return;
}

try {
  const format = this.state.htmlReportExportFormat || SESSION_RESULTS_EXPORT_FORMAT_VIEWER;
  const html = renderSessionResultsHtmlReport(snapshot, {
    format,
    sections: selectedSections,
  });
  const baseFilenameArgs = {
    exportedAt: snapshot.exportedAt,
    name: snapshot.session.name,
    slug: snapshot.session.slug,
  };
  if (format === SESSION_RESULTS_EXPORT_FORMAT_PDF) {
    await downloadSessionResultsPdfReport({
      html,
      filename: buildSessionResultsPdfReportFilename(baseFilenameArgs),
    });
  } else {
    downloadSessionResultsHtmlReport(html, buildSessionResultsHtmlReportFilename(baseFilenameArgs));
  }
  this.setState({
    htmlReportModalOpen: false,
    alertMessage: '',
  });
} catch (error) {
  surveyLog.error('[SurveyResults.downloadHtmlReport] Failed to export HTML report:', error);
  this.setState(buildSurveyResultsAlertMessagePatch('Unable to export the HTML report.'));
}
}

getExportBaseFileName = (exportType: unknown = this.state.exportType): string => {
const { viewMode, surveyId } = this.state;
const questionsOnly =
  exportType === EXPORT_TYPES.CSV_QUESTIONS ||
  exportType === EXPORT_TYPES.JSON_QUESTIONS;

if (viewMode === 'survey') {
  const surveyIdShort = surveyId
    ? getShortenedSurveyID(surveyId, false, null, true)
    : 'all';
  return questionsOnly
    ? `contextEngine_surveyQuestions_${surveyIdShort}`
    : `contextEngine_surveyResults_${surveyIdShort}`;
}

return questionsOnly ? 'contextEngine_filteredQuestions' : 'contextEngine_questionResults';
}

downloadCSV = (): void => {
const { exportType } = this.state;
const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
const baseFileName = this.getExportBaseFileName(exportType);
runSurveyResultsExportController({
  baseFileName,
  downloadFile: runSurveyResultsBrowserDownload,
  exportType,
  generators: {
    'questions-csv': this.generateQuestionsCSV,
    'questions-json': this.generateQuestionsJSON,
    'questions-responses-csv': this.generateResponsesCSV,
    'questions-responses-json': this.generateResultsJSON,
  },
  getCurrentAlertMessage: () => this.state.alertMessage,
  onAlertMessage: (message) => {
    this.setState(buildSurveyResultsAlertMessagePatch(message));
  },
  timestamp,
});
};

handleExportTypeChange = (type: unknown): void => {
this.setState(buildSurveyResultsExportTypePatch(type));
};

handleQuestionFilter = (
  filteredQuestionsOrCombined: unknown,
  newFilterState: unknown
): void => {
  // ⛑️ Gate: don't clobber counts or bubble anything until the question cache is ready
  if (!this.props.isQuestionCacheReady) return;

  const isSurveyMode = this.state.viewMode === 'survey';
  const isSurveyAggregate = isSurveyMode && this.state.surveyViewMode === 'aggregate';
  const isSurveyIndividuals = isSurveyMode && this.state.surveyViewMode === 'individuals';

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
  if (this.props.onCountUpdate) {
    this.props.onCountUpdate(finalFilteredQCount);
  }

  const statePatch: SurveyResultsRecord = {
    filteredQuestionsCount: finalFilteredQCount,
  };

  if (!isSurveyIndividuals) {
    const sourceMap = isSurveyAggregate
      ? toSurveyResultsRecord(this.state.aggregateQuestionResponses)
      : toSurveyResultsRecord(this.state.aggregatorQuestionResponses);
    const allowedIds = new Set<string>(
      filteredQuestions.map((q) => String(q?.id || '').toLowerCase())
    );
    const nextFilteredAggregator: SurveyResultsRecord = {};

    Object.keys(sourceMap).forEach((qId) => {
      if (!allowedIds.has(String(qId || '').toLowerCase())) return;
      if (
        filteredResponsesByQuestion &&
        Object.prototype.hasOwnProperty.call(filteredResponsesByQuestion, qId)
      ) {
        const arr = filteredResponsesByQuestion[qId] || [];
        if (Array.isArray(arr) && arr.length > 0) {
          nextFilteredAggregator[qId] = arr;
        }
        return;
      }
      nextFilteredAggregator[qId] = sourceMap[qId];
    });

    statePatch.sbtFilteredAggregatorQuestionResponses = nextFilteredAggregator;
    if (isSurveyAggregate) {
      const responders = new Set<string>();
      Object.values(nextFilteredAggregator).forEach((rows) => {
        if (Array.isArray(rows)) {
          rows.forEach((row: SurveyResultsRecord) => {
            const responder = row?.responder;
            if (typeof responder === 'string' && responder) responders.add(responder.toLowerCase());
          });
        }
      });
      statePatch.filteredResponsesCount = Math.min(responders.size, this.state.totalResponsesCount);
    } else {
      const networkQuestions = this.getNetworkQuestionsForCurrentContext();
      const totalR = countQuestionModeResponses(nextFilteredAggregator, networkQuestions);
      statePatch.filteredResponsesCount = Math.min(totalR, this.state.totalResponsesCount);
    }
  }

  this.commitResultsFilterState(statePatch, newFilterState);
};





  setFilterLoading = (loading: unknown): void => {
    const loadingUpdate = buildSurveyResultsFilterLoadingUpdate({
      loading,
      pendingValue: this._pendingFilterLoadingValue,
      stateFilterLoading: this.state.filterLoading,
    });

    if (loadingUpdate.shouldQueueState) {
      this._pendingFilterLoadingValue = loadingUpdate.nextPendingValue;
      this.setState((prev: SurveyResultsRecord) => (
        buildSurveyResultsFilterLoadingStatePatch({
          nextLoading: loadingUpdate.nextLoading,
          prevState: prev,
        })
      ), () => {
        if (this.state.filterLoading === this._pendingFilterLoadingValue) {
          this._pendingFilterLoadingValue = null;
        }
      });
    }

    if (this.props.setFilterLoading) {
      this.props.setFilterLoading(loadingUpdate.nextLoading);
    }
  };

handleQuestionFilterCountUpdate = (count: unknown): void => {
  const countPatch = buildSurveyResultsQuestionFilterCountPatch({
    count,
    props: this.props,
    state: this.state,
  });
  if (!countPatch) return;
  this.setState(countPatch);
  if (this.props.onCountUpdate) this.props.onCountUpdate(count);
};

// SurveyResults.handleFilteredResponses(...)
handleFilteredResponses = (
  filteredResponses: unknown,
  newSbtFilterLocalState: unknown
): void => {
  // ⛑️ Gate: avoid overwriting filtered maps during waiting/aborted states
  if (!this.props.isQuestionCacheReady) return;
  const nextFilterState =
    typeof newSbtFilterLocalState !== 'undefined'
      ? { ...toSurveyResultsRecord(this.state.filterState), sbtFilter: newSbtFilterLocalState }
      : (this.state.filterState || {});

  if (this.state.viewMode === 'survey') {
    if (this.state.surveyViewMode === 'individuals') {
      if (Array.isArray(filteredResponses)) {
        this.commitResultsFilterState(
          {
            sbtFilteredResponses: filteredResponses,
            filteredResponsesCount: filteredResponses.length,
          },
          nextFilterState
        );
      } else {
        surveyLog.error('Expected an array in survey mode (individuals), got:', filteredResponses);
        this.commitResultsFilterState(
          { sbtFilteredResponses: [], filteredResponsesCount: 0 },
          nextFilterState
        );
      }
    } else {
      // survey aggregate
      if (filteredResponses && typeof filteredResponses === 'object') {
        // 🔒 prune zero-response questions to avoid reintroducing empty keys
        const pruned: SurveyResultsRecord = {};
        Object.entries(toSurveyResultsRecord(filteredResponses)).forEach(([k, arr]) => {
          if (Array.isArray(arr) && arr.length > 0) pruned[k] = arr;
        });

        const responders = new Set<string>();
        Object.values(pruned).forEach((rows) => {
          if (Array.isArray(rows)) {
            rows.forEach((row: SurveyResultsRecord) => {
              const responder = row?.responder;
              if (typeof responder === 'string' && responder) responders.add(responder.toLowerCase());
            });
          }
        });
        const finalRCount = Math.min(responders.size, this.state.totalResponsesCount);

        this.commitResultsFilterState(
          {
            sbtFilteredAggregatorQuestionResponses: pruned,
            filteredResponsesCount: finalRCount,
          },
          nextFilterState
        );
      } else {
        surveyLog.error('Expected aggregator object in aggregator mode, got:', filteredResponses);
      }
    }
  } else {
    // questions mode
    if (filteredResponses && typeof filteredResponses === 'object') {
      // 🔒 prune zero-response questions here as well
      const pruned: SurveyResultsRecord = {};
      Object.entries(toSurveyResultsRecord(filteredResponses)).forEach(([k, arr]) => {
        if (Array.isArray(arr) && arr.length > 0) pruned[k] = arr;
      });

      const networkQuestions = this.getNetworkQuestionsForCurrentContext();
      const totalR = countQuestionModeResponses(pruned, networkQuestions);
      const finalRCount = totalR > this.state.totalResponsesCount ? this.state.totalResponsesCount : totalR;

      this.commitResultsFilterState(
        {
          sbtFilteredAggregatorQuestionResponses: pruned,
          filteredResponsesCount: finalRCount,
        },
        nextFilterState
      );
    } else {
      surveyLog.error('Expected aggregator object for question mode, got:', filteredResponses);
    }
  }
};




toggleQuestionSummary = (questionId: unknown): void => {
this.setState((prevState: SurveyResultsRecord) => buildSurveyResultsKeyedTogglePatch({
  itemKey: questionId,
  mapKey: 'activeQuestionToggles',
  prevState,
}));
};

toggleResponse = (index: unknown): void => {
this.setState((prevState: SurveyResultsRecord) => buildSurveyResultsKeyedTogglePatch({
  itemKey: index,
  mapKey: 'activeToggles',
  prevState,
}));
};

toggleSurveyBookmark = (surveyId: unknown): void => {
const slug = this.getEffectiveSlug();
let bookmarksCache: SurveyResultsBookmarkCache;
const defaultCache: SurveyResultsBookmarkCache = { surveys: [], questions: [] };

try {
  const parsed = peekCacheSync('bookmarksCache', slug, { clone: false });
  const parsedRecord = parsed as SurveyResultsRecord;
  bookmarksCache = (parsed && typeof parsed === 'object')
    ? {
        ...parsedRecord,
        surveys: Array.isArray(parsedRecord.surveys) ? [...parsedRecord.surveys] : [],
        questions: Array.isArray(parsedRecord.questions) ? [...parsedRecord.questions] : [],
      }
    : defaultCache;
  if (
    typeof bookmarksCache !== 'object' ||
    bookmarksCache === null ||
    !Array.isArray(bookmarksCache.surveys) ||
    !Array.isArray(bookmarksCache.questions)
  ) {
    bookmarksCache = defaultCache;
  }
} catch (error) {
  surveyLog.error('[SurveyResults] Error reading bookmarksCache:', error);
  bookmarksCache = defaultCache;
}

const surveyIndex = bookmarksCache.surveys.indexOf(surveyId);
if (surveyIndex > -1) {
  bookmarksCache.surveys.splice(surveyIndex, 1);
} else {
  bookmarksCache.surveys.push(surveyId);
}

void (writeCache as SurveyResultsWriteCache)('bookmarksCache', slug, bookmarksCache).catch((error: unknown) => {
  surveyLog.error('[SurveyResults] Error saving bookmarksCache:', error);
});
this.setState(buildSurveyResultsBookmarkedSurveyIdsPatch(bookmarksCache.surveys));
};

toggleQuestionBookmark = (questionId: unknown): void => {
const slug = this.getEffectiveSlug();
let bookmarksCache: SurveyResultsBookmarkCache;
const defaultCache: SurveyResultsBookmarkCache = { surveys: [], questions: [] };

try {
  const parsed = peekCacheSync('bookmarksCache', slug, { clone: false });
  const parsedRecord = parsed as SurveyResultsRecord;
  bookmarksCache = (parsed && typeof parsed === 'object')
    ? {
        ...parsedRecord,
        surveys: Array.isArray(parsedRecord.surveys) ? [...parsedRecord.surveys] : [],
        questions: Array.isArray(parsedRecord.questions) ? [...parsedRecord.questions] : [],
      }
    : defaultCache;
  if (
    typeof bookmarksCache !== 'object' ||
    bookmarksCache === null ||
    !Array.isArray(bookmarksCache.surveys) ||
    !Array.isArray(bookmarksCache.questions)
  ) {
    bookmarksCache = defaultCache;
  }
} catch (error) {
  surveyLog.error('[SurveyResults] Error reading bookmarksCache:', error);
  bookmarksCache = defaultCache;
}

const questionIndex = bookmarksCache.questions.indexOf(questionId);
if (questionIndex > -1) {
  bookmarksCache.questions.splice(questionIndex, 1);
} else {
  bookmarksCache.questions.push(questionId);
}

void (writeCache as SurveyResultsWriteCache)('bookmarksCache', slug, bookmarksCache).catch((error: unknown) => {
  surveyLog.error('[SurveyResults] Error saving bookmarksCache:', error);
});
this.setState(buildSurveyResultsBookmarkedQuestionIdsPatch(bookmarksCache.questions));
};

transformIndividualResponsesToAggregator = (individualResponses: unknown): SurveyResultsIndividualAggregator => {
  const responseRows = individualResponses as SurveyResultsSummaryResponseRow[];
  if (!individualResponses || responseRows.length === 0) {
    return {};
  }

  const aggregator: SurveyResultsIndividualAggregator = {};

  individualResponses.forEach(response => {
    const parsedResponse = normalizeSurveyResponsePayloadByQuestionId(response.response); // Already an object
    if (parsedResponse && Array.isArray(parsedResponse.responses)) {
      parsedResponse.responses.forEach(answerItem => {
        const qIdLower = getSurveyResponseQuestionId(answerItem);
        if (!qIdLower) return;

        if (!aggregator[qIdLower]) {
          aggregator[qIdLower] = [];
        }

        aggregator[qIdLower].push({
          responder: String(response.responder || '').toLowerCase(), // normalize storage
          questionId: qIdLower,
          response: answerItem,
          timestamp: getSurveyResponseAggregateTimestampMs(answerItem, parsedResponse),
        });
      });
    }
  });

  return aggregator;
}

getMemoizedIndividualsAggregator = (individualResponses: unknown): SurveyResultsIndividualAggregator => {
  const responsesRef = Array.isArray(individualResponses)
    ? individualResponses as SurveyResultsSummaryResponseRow[]
    : [];
  const memo = this._individualResponsesAggregatorMemo;
  if (memo.responsesRef === responsesRef) {
    return memo.result;
  }
  const next = this.transformIndividualResponsesToAggregator(responsesRef);
  this._individualResponsesAggregatorMemo = {
    responsesRef,
    result: next,
  };
  return next;
};

getMemoizedViewableResponsesCount = (responses: unknown, questionType: unknown = ''): number => {
  const list = Array.isArray(responses)
    ? responses as SurveyResultsSummaryResponseRow[]
    : [];
  const normalizedQuestionType = String(questionType || '').toLowerCase();
  const memo = this._viewableResponsesCountMemo as WeakMap<
    SurveyResultsSummaryResponseRow[],
    SurveyResultsViewableResponsesCountMemoValue
  >;
  const cached = memo.get(list);
  if (cached && cached.questionType === normalizedQuestionType) {
    return cached.count;
  }
  const count = this.getLatestResponsesByResponder(list).reduce((acc, row) => {
    const parsedResponse = row?.response;
    if (!parsedResponse || !parsedResponse.answer) {
      return acc;
    }
    if (isFreeformBlankAnswer(normalizedQuestionType, parsedResponse)) {
      return acc;
    }
    const isEncryptedPlaceholder =
      parsedResponse.answer.encrypted === true &&
      parsedResponse.answer.value === '*';
    return isEncryptedPlaceholder ? acc : (acc + 1);
  }, 0);
  memo.set(list, {
    questionType: normalizedQuestionType,
    count,
  });
  return count;
};

getMemoizedAggregatorEntries = (aggregator: unknown): SurveyResultsAggregatorEntry[] => {
  const ref = (aggregator && typeof aggregator === 'object')
    ? aggregator as SurveyResultsRecord
    : {};
  const memo = this._aggregatorEntriesMemo;
  if (memo.aggregatorRef === ref) {
    return memo.entries as SurveyResultsAggregatorEntry[];
  }
  const entries = measureSync('ce.surveyResults.render.aggregatorEntries', () =>
    Object.entries(ref)
  ) as SurveyResultsAggregatorEntry[];
  this._aggregatorEntriesMemo = {
    aggregatorRef: ref,
    entries,
  };
  return entries;
};

getMemoizedPolisQuestionResponses = (
  polisSelected: unknown,
  sourceAggregator: unknown
): SurveyResultsStringifiedAggregator | null => {
  if (!polisSelected) {
    this._polisQuestionResponsesMemo = {
      selected: false,
      sourceRef: null,
      result: null,
    };
    return null;
  }
  const sourceRef = (sourceAggregator && typeof sourceAggregator === 'object')
    ? sourceAggregator as SurveyResultsRecord
    : {};
  const memo = this._polisQuestionResponsesMemo;
  if (memo.selected && memo.sourceRef === sourceRef) {
    return memo.result as SurveyResultsStringifiedAggregator;
  }
  const result = measureSync('ce.surveyResults.render.polisPayload', () =>
    this.stringifyAggregatorResponses(sourceRef)
  ) as SurveyResultsStringifiedAggregator;
  this._polisQuestionResponsesMemo = {
    selected: true,
    sourceRef,
    result,
  };
  return result;
};

resolveSummaryQuestionType = resolveSurveyResultsSummaryQuestionType;

getLatestResponsesByResponder = getSurveyResultsLatestResponsesByResponder as (
  responses?: unknown
) => SurveyResultsSummaryResponseRow[];

buildFreeformSummaryModel = buildSurveyResultsFreeformSummaryModel as (
  responses?: unknown
) => SurveyResultsFreeformSummaryModel;

buildMultichoiceSummaryModel = buildSurveyResultsMultichoiceSummaryModel as (
  responses?: unknown,
  question?: SurveyResultsRecord | null
) => SurveyResultsMultichoiceSummaryModel;

renderFreeformAggregatorSummary = (responses: unknown = []): React.ReactNode => {
  const summary = this.buildFreeformSummaryModel(responses);
  return SurveyResultsFreeformAggregatorSummary({ summary });
};

renderMultichoiceAggregatorSummary = (
  responses: unknown = [],
  question: SurveyResultsRecord | null = null
): React.ReactNode => {
  const summary = this.buildMultichoiceSummaryModel(responses, question);
  return SurveyResultsMultichoiceAggregatorSummary({ summary });
};

getSurveyResultsResponseCardProps = (): SurveyResultsResponseCardClassNames => ({
  containerClassName: styles.surveyResultsResponseCard,
  bodyClassName: styles.surveyResultsResponseCardBody,
  linksContainerClassName: styles.surveyResultsResponseCardLinks,
  iconButtonClassName: styles.surveyResultsResponseCardLinkButton,
  aggregatorContainerClassName: styles.surveyResultsAggregatorPanel,
  aggregatorTextClassName: styles.surveyResultsAggregatorText,
  aggregatorParagraphClassName: styles.surveyResultsAggregatorParagraph,
  aggregatorFreeformAnswerClassName: styles.surveyResultsFreeformAnswer,
});

getDecryptLitHooks = (): SurveyResultsLitHooks | null => {
  if (this.props.lit && typeof this.props.lit === 'object') {
    return this.props.lit as SurveyResultsLitHooks;
  }
  if (this.props.litHooks && typeof this.props.litHooks === 'object') {
    return this.props.litHooks as SurveyResultsLitHooks;
  }
  if (typeof window === 'undefined') return null;
  const windowWithLitHooks = window as SurveyResultsWindowWithLitHooks;
  return windowWithLitHooks.__litHooks || windowWithLitHooks.litHooks || null;
};

getQuestionEncryptionGates = (question: SurveyResultsQuestionWithEncryption | null = null): SurveyResultsGateRecord[] => {
  const encryption = question?.encryption as SurveyResultsQuestionEncryptionRecord | null | undefined;
  if (!encryption || typeof encryption !== 'object' || encryption.enabled === false) return [];
  const list = Array.isArray(encryption.gates)
    ? encryption.gates
    : (encryption.gate && typeof encryption.gate === 'object' ? [encryption.gate] : []);
  return list.filter((gate): gate is SurveyResultsGateRecord => !!gate && typeof gate === 'object');
};

getLockedResponseKey = ({
  responder = '',
  questionId = '',
  surveyId = '',
  response = null,
}: SurveyResultsLockedResponseKeyArgs = {}): string => {
  const responderLower = String(responder || '').trim().toLowerCase();
  const qidLower = String(questionId || response?.questionID || response?.questionId || '').trim().toLowerCase();
  const surveyKey = String(surveyId || '').trim().toLowerCase();
  return [
    surveyKey,
    responderLower,
    qidLower,
    buildLockedResponseSignature(response || {}),
  ].join('|');
};

getDecryptedResponseOverride = (
  key: unknown = ''
): SurveyResultsDecryptedResponseOverride | null => {
  if (!key) return null;
  const overrides = toSurveyResultsRecord(this.state.decryptedResponseOverrides);
  const override = overrides[String(key)] || null;
  return override && typeof override === 'object'
    ? override as SurveyResultsDecryptedResponseOverride
    : null;
};

applyDecryptedOverrideToResponse = ({
  response = null,
  key = '',
}: SurveyResultsApplyDecryptedOverrideArgs = {}): SurveyResultsResponseRecord | null => {
  if (!response || typeof response !== 'object' || !key) return response;
  const override = this.getDecryptedResponseOverride(key);
  if (!override || typeof override !== 'object') return response;

  let changed = false;
  const next: SurveyResultsRecord = { ...response };

  if (hasOwn(override, 'answerValue') && next.answer && typeof next.answer === 'object') {
    next.answer = { ...toSurveyResultsRecord(next.answer), value: override.answerValue };
    changed = true;
  }
  if (hasOwn(override, 'additionalValue') && next.additional && typeof next.additional === 'object') {
    next.additional = { ...toSurveyResultsRecord(next.additional), value: override.additionalValue };
    changed = true;
  }
  if (hasOwn(override, 'importance')) {
    next.importance = override.importance;
    changed = true;
  }
  if (hasOwn(override, 'conviction')) {
    next.conviction = override.conviction;
    changed = true;
  }

  return changed ? next : response;
};

buildLockedGateDetails = (
  lockedRows: unknown = [],
  questionLookup: Record<string, SurveyResultsQuestionWithEncryption> = {}
): SurveyResultsLockedGateDetailsResult => {
  const rows = Array.isArray(lockedRows) ? lockedRows as SurveyResultsLockedRow[] : [];
  if (rows.length === 0) {
    return { gateDetails: [], hasGenericGateMessage: false };
  }

  const resolvedSession = this.getEffectiveSessionContext();
  const baseSlug = resolvedSession.sessionSlug || '';
  const baseSessionConfig = toSurveyResultsRecord(resolvedSession.sessionConfig) as SurveyResultsSessionConfigRecord;
  const baseFallbackChainId = Number(
    this.props.network?.id ||
    this.props.networkChainId ||
    baseSessionConfig?.networkChainId ||
    baseSessionConfig?.__registry?.chainId ||
    0
  ) || null;
  const sessionContextMemo = new Map<string, SurveyResultsLockedGateContext>();
  const readSessionGateContext = (questionSlug: unknown = ''): SurveyResultsLockedGateContext => {
    const requestedSlug = String(questionSlug || '').trim() || baseSlug;
    if (sessionContextMemo.has(requestedSlug)) {
      return sessionContextMemo.get(requestedSlug) as SurveyResultsLockedGateContext;
    }
    const nextResolvedSession = resolveSurveyResultsSessionContext({
      sessionSlug: requestedSlug,
      resolveBySlug: getSessionConfigBySlug,
    });
    const nextSlug = nextResolvedSession.sessionSlug || requestedSlug || baseSlug;
    const nextSessionConfig = toSurveyResultsRecord(nextResolvedSession.sessionConfig) as SurveyResultsSessionConfigRecord;
    const nextFallbackChainId = Number(
      this.props.network?.id ||
      this.props.networkChainId ||
      nextSessionConfig?.networkChainId ||
      nextSessionConfig?.__registry?.chainId ||
      baseFallbackChainId ||
      0
    ) || null;
    const sponsoredConfig = toSurveyResultsRecord(nextSessionConfig.sponsored);
    const nextContext = {
      slug: nextSlug,
      fallbackChainId: nextFallbackChainId,
      defaultPolicy: buildResponseGatePolicy({
        cfg: nextSessionConfig,
        isQuestionResponseFlow: this.state.viewMode === 'questions',
        fallbackChainId: nextFallbackChainId,
      }) as SurveyResultsRecord & { gates?: unknown },
      configuredGateMap: toSurveyResultsRecord(sponsoredConfig.gates) as Record<string, SurveyResultsGateRecord>,
    };
    sessionContextMemo.set(requestedSlug, nextContext);
    return nextContext;
  };

  const detailsByAddress = new Map<string, SurveyResultsLockedGateDetail>();
  let hasGenericGateMessage = false;

  const addGate = (
    gate: SurveyResultsGateRecord = {},
    gateContext: SurveyResultsLockedGateContext = readSessionGateContext()
  ): void => {
    const configuredGate = gateContext.configuredGateMap[
      normalizeGateText(gate?.gateId || gate?.id)
    ] || null;
    const gateEntries = [
      ...normalizeGateSbtEntries(configuredGate),
      ...normalizeGateSbtEntries(gate),
    ];
    if (!gateEntries.length) {
      hasGenericGateMessage = true;
      return;
    }
    gateEntries.forEach(({ address, label }) => {
      const key = String(address || '').toLowerCase();
      if (!key) return;
      if (detailsByAddress.has(key)) return;
      const displayLabel = resolveSbtDisplayLabelForSurveyResults({
        address,
        preferredSlug: gateContext.slug,
        chainId: gateContext.fallbackChainId,
        fallback: 'short',
      });
      detailsByAddress.set(key, {
        address,
        label: displayLabel || label || getShortenedAddress(address, true),
        href: buildSbtDetailPath(address, gateContext.slug),
      });
    });
  };

  rows.forEach((row) => {
    const qid = String(row?.questionId || '').trim().toLowerCase();
    const question = questionLookup?.[qid] || null;
    const gateContext = readSessionGateContext(question?.sessionSlug || baseSlug);
    const questionGates = this.getQuestionEncryptionGates(question);
    if (questionGates.length > 0) {
      const beforeSize = detailsByAddress.size;
      questionGates.forEach((gate) => addGate(gate, gateContext));
      if (detailsByAddress.size > beforeSize) return;
    }
    const defaultGates = Array.isArray(gateContext.defaultPolicy?.gates)
      ? gateContext.defaultPolicy.gates as SurveyResultsGateRecord[]
      : [];
    if (defaultGates.length > 0) {
      const beforeSize = detailsByAddress.size;
      defaultGates.forEach((gate) => addGate(gate, gateContext));
      if (detailsByAddress.size > beforeSize) return;
    }
    hasGenericGateMessage = true;
  });

  return {
    gateDetails: Array.from(detailsByAddress.values()),
    hasGenericGateMessage,
  };
};

getMemoizedLockedResponsesModel = (
  questionLookup: Record<string, SurveyResultsQuestionWithEncryption> = {}
): SurveyResultsLockedResponsesModel => {
  const {
    viewMode,
    surveyViewMode,
    sbtFilteredResponses,
    sbtFilteredAggregatorQuestionResponses,
    decryptedResponseOverrides,
  } = this.state;
  const slug = this.getEffectiveSlug();
  const memo = (this._lockedResponsesModelMemo || {}) as SurveyResultsLockedResponsesModelMemo;
  if (
    memo.viewMode === viewMode &&
    memo.surveyViewMode === surveyViewMode &&
    memo.responsesRef === sbtFilteredResponses &&
    memo.aggregatorRef === sbtFilteredAggregatorQuestionResponses &&
    memo.questionLookupRef === questionLookup &&
    memo.overridesRef === decryptedResponseOverrides &&
    memo.slug === slug
  ) {
    return memo.result || {
      lockedRows: [],
      lockedCount: 0,
      gateDetails: [],
      hasGenericGateMessage: false,
    };
  }

  const lockedRows: SurveyResultsLockedRow[] = [];

  if (viewMode === 'survey' && surveyViewMode === 'individuals') {
    const surveyResponses = Array.isArray(sbtFilteredResponses)
      ? sbtFilteredResponses as SurveyResultsResponseListEntry[]
      : [];
    surveyResponses.forEach((surveyResponse) => {
      const responder = String(surveyResponse?.responder || '').trim().toLowerCase();
      const surveyId = String(surveyResponse?.surveyId || this.state.surveyId || '').trim().toLowerCase();
      const answers = Array.isArray(surveyResponse?.response?.responses)
        ? surveyResponse.response.responses as SurveyResultsResponseRecord[]
        : [];
      answers.forEach((answerItem) => {
        const questionId = String(answerItem?.questionID || answerItem?.questionId || '').trim().toLowerCase();
        if (!questionId) return;
        const key = this.getLockedResponseKey({
          responder,
          questionId,
          surveyId,
          response: answerItem,
        });
        const mergedResponse = this.applyDecryptedOverrideToResponse({
          response: answerItem,
          key,
        });
        if (
          !isBannerEligibleLockedField(mergedResponse?.answer) &&
          !isBannerEligibleLockedField(mergedResponse?.additional)
        ) {
          return;
        }
        lockedRows.push({
          key,
          responder,
          surveyId,
          questionId,
          response: answerItem,
          mergedResponse,
        });
      });
    });
  } else {
    Object.entries(toSurveyResultsRecord(sbtFilteredAggregatorQuestionResponses)).forEach(([questionId, rows]) => {
      const responseRows = Array.isArray(rows) ? rows as SurveyResultsAggregatorLockedResponseRow[] : [];
      responseRows.forEach((row) => {
        const responder = String(row?.responder || '').trim().toLowerCase();
        const key = this.getLockedResponseKey({
          responder,
          questionId,
          surveyId: this.state.surveyId,
          response: row?.response,
        });
        const mergedResponse = this.applyDecryptedOverrideToResponse({
          response: row?.response,
          key,
        });
        if (
          !isBannerEligibleLockedField(mergedResponse?.answer) &&
          !isBannerEligibleLockedField(mergedResponse?.additional)
        ) {
          return;
        }
        lockedRows.push({
          key,
          responder,
          surveyId: this.state.surveyId,
          questionId: String(questionId || '').trim().toLowerCase(),
          response: row?.response,
          mergedResponse,
        });
      });
    });
  }

  const { gateDetails, hasGenericGateMessage } = this.buildLockedGateDetails(lockedRows, questionLookup);
  const result = {
    lockedRows,
    lockedCount: lockedRows.length,
    gateDetails,
    hasGenericGateMessage,
  };
  this._lockedResponsesModelMemo = {
    viewMode,
    surveyViewMode,
    responsesRef: sbtFilteredResponses,
    aggregatorRef: sbtFilteredAggregatorQuestionResponses,
    questionLookupRef: questionLookup,
    overridesRef: decryptedResponseOverrides,
    slug,
    result,
  };
  return result;
};

decryptFieldValue = async (
  field: SurveyResultsEncryptedFieldRecord | null = null
): Promise<SurveyResultsDecryptFieldResult> => {
  if (!field || typeof field !== 'object') return { ok: false };
  const envelope = extractEnvelopeCandidate(field);
  if (!envelope) return { ok: false };

  const litHooks = this.getDecryptLitHooks();
  const litOpts = litHooks && typeof litHooks.getKey === 'function'
    ? { getKey: litHooks.getKey }
    : undefined;

  try {
    const value = await cryptoUtils.decryptEnvelopeValue(envelope, {
      account: this.props.account,
      chainId: this.props.network?.id || this.props.networkChainId || null,
      providerLike: this.props.provider,
      ...(litOpts ? { litOpts } : {}),
    });
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error };
  }
};

handleDecryptLockedResponses = async (): Promise<void> => {
  if (this.state.lockedResponsesDecrypting) return;
  if (!this.props.loginComplete || !this.props.account) {
    this.setState(buildSurveyResultsAlertMessagePatch('Login required to decrypt locked responses.'));
    return;
  }

  const questionLookup = this.getNetworkQuestionsForCurrentContext();
  const model = this.getMemoizedLockedResponsesModel(questionLookup);
  const lockedRows = Array.isArray(model?.lockedRows) ? model.lockedRows : [];
  if (lockedRows.length === 0) return;

  this.setState(buildSurveyResultsLockedResponsesDecryptingPatch(true));

  let anyDecrypted = false;
  const nextOverrides: Record<string, SurveyResultsDecryptedResponseOverride> = {
    ...(toSurveyResultsRecord(this.state.decryptedResponseOverrides) as Record<string, SurveyResultsDecryptedResponseOverride>),
  };

  for (const row of lockedRows) {
    const response: SurveyResultsResponseRecord = row?.response || {};
    const override: SurveyResultsDecryptedResponseOverride = { ...(nextOverrides[row.key] || {}) };

    if (isLockedEncryptedField(row?.mergedResponse?.answer)) {
      const answerResult = await this.decryptFieldValue(response.answer);
      if (answerResult.ok) {
        override.answerValue = answerResult.value;
        anyDecrypted = true;
      }
    }

    if (isLockedEncryptedField(row?.mergedResponse?.additional)) {
      const additionalResult = await this.decryptFieldValue(response.additional);
      if (additionalResult.ok) {
        override.additionalValue = additionalResult.value;
        anyDecrypted = true;
      }
    }

    if (
      typeof response?.importanceEncrypted === 'string' &&
      response.importanceEncrypted.trim() &&
      !hasOwn(override, 'importance')
    ) {
      try {
        const litHooks = this.getDecryptLitHooks();
        const importance = await cryptoUtils.decryptEnvelopeValue(response.importanceEncrypted, {
          account: this.props.account,
          chainId: this.props.network?.id || this.props.networkChainId || null,
          providerLike: this.props.provider,
          ...(litHooks?.getKey ? { litOpts: { getKey: litHooks.getKey } } : {}),
        });
        override.importance = Number.isNaN(Number(importance)) ? importance : Number(importance);
        anyDecrypted = true;
      } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
    }

    if (
      typeof response?.convictionEncrypted === 'string' &&
      response.convictionEncrypted.trim() &&
      !hasOwn(override, 'conviction')
    ) {
      try {
        const litHooks = this.getDecryptLitHooks();
        const conviction = await cryptoUtils.decryptEnvelopeValue(response.convictionEncrypted, {
          account: this.props.account,
          chainId: this.props.network?.id || this.props.networkChainId || null,
          providerLike: this.props.provider,
          ...(litHooks?.getKey ? { litOpts: { getKey: litHooks.getKey } } : {}),
        });
        override.conviction = Number.isNaN(Number(conviction)) ? conviction : Number(conviction);
        anyDecrypted = true;
      } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
    }

    if (Object.keys(override).length > 0) {
      nextOverrides[row.key] = override;
    }
  }

  this.setState(buildSurveyResultsLockedResponsesDecryptCompletePatch({
    anyDecrypted,
    decryptedResponseOverrides: nextOverrides,
    walletLowerLabel: t('walletLower'),
  }));
};

toggleLockedResponseDetails = (): void => {
  this.setState(toggleSurveyResultsLockedResponseDetailsPatch);
};

renderLockedResponsesToggle = (
  lockedModel: SurveyResultsLockedResponsesModel | null = null
): React.ReactNode => {
  return SurveyResultsLockedResponsesToggle({
    isOpen: !!this.state.lockedResponseDetailsOpen,
    lockedModel,
    onToggleDetails: this.toggleLockedResponseDetails,
  });
};

renderLockedResponsesBanner = (
  lockedModel: SurveyResultsLockedResponsesModel | null = null
): React.ReactNode => {
  return SurveyResultsLockedResponsesBanner({
    decrypting: !!this.state.lockedResponsesDecrypting,
    isOpen: !!this.state.lockedResponseDetailsOpen,
    lockedModel,
    onDecrypt: this.handleDecryptLockedResponses,
  });
};


renderQuestionSummary = (
  questionId: string,
  responses: unknown,
  preNetworkQuestions: Record<string, SurveyResultsRecord>
): React.ReactNode => {
  const domId = getQuestionCardDomId(questionId);
  const lowerQId = questionId.toLowerCase();

  // Prefer preloaded per-render cache to avoid repeated localStorage hits.
  let networkQuestions = preNetworkQuestions;
  if (!networkQuestions) {
    networkQuestions = this.getNetworkQuestionsForCurrentContext();
  }
  const question = networkQuestions[lowerQId];
  const questionPrompt = (question?.prompt || `Unknown question: ${questionId}`) as React.ReactNode;
  const displayResponses = (Array.isArray(responses) ? responses : []).map((row: SurveyResultsAggregateRow) => {
    const rowResponse = row?.response as SurveyResultsResponseRecord | null;
    const key = this.getLockedResponseKey({
      responder: row?.responder,
      questionId,
      surveyId: this.state.surveyId,
      response: rowResponse,
    });
    return {
      ...row,
      response: this.applyDecryptedOverrideToResponse({
        response: rowResponse,
        key,
      }),
    };
  });
  const resolvedQuestionType = this.resolveSummaryQuestionType(question, displayResponses);
  const viewableResponsesCount = this.getMemoizedViewableResponsesCount(displayResponses, resolvedQuestionType);

const isActive = this.state.activeQuestionToggles[questionId];
return (
  <SurveyResultsQuestionSummaryCard
    key={questionId}
    bookmarked={this.state.bookmarkedQuestionIDs.includes(questionId)}
    bookmarkIconStyle={SURVEY_RESULTS_CLICKABLE_ICON_STYLE}
    domId={domId}
    isActive={!!isActive}
    metadataMissing={!question}
    metadataMissingStyle={SURVEY_RESULTS_METADATA_MISSING_STYLE}
    onToggleBookmark={() => this.toggleQuestionBookmark(questionId)}
    onToggleSummary={() => this.toggleQuestionSummary(questionId)}
    questionPrompt={questionPrompt}
    renderDefaultSummary={() => (
      <SingleQuestionResponse
        aggregatorResponseMode={true}
        question={question || this.getStableFallbackQuestion(questionId, 'summary')}
        allResponses={displayResponses}
        network={this.props.network}
        activeSessionSlug={question?.sessionSlug || this.getEffectiveSlug()}
        questionResponsesNonce={this.props.questionResponsesNonce}
        questionsCacheNonce={this.props.questionsCacheNonce}
        sbtCacheRevision={this.props.sbtCacheRevision}
        {...this.getSurveyResultsResponseCardProps()}
      />
    )}
    renderFreeformSummary={() => this.renderFreeformAggregatorSummary(displayResponses)}
    renderMultichoiceSummary={() => this.renderMultichoiceAggregatorSummary(displayResponses, question)}
    resolvedQuestionType={resolvedQuestionType}
    styleMap={styles}
    viewableResponsesCount={viewableResponsesCount}
  />
);
};

getStableFallbackQuestion = (
  questionId: unknown,
  mode: unknown = 'summary'
): SurveyResultsFallbackQuestion => {
const cacheKey = String(questionId || '');
if (!this._stableFallbackQuestions || typeof this._stableFallbackQuestions !== 'object') {
  this._stableFallbackQuestions = {
    summary: new Map(),
    individual: new Map(),
  };
}
const fallbackQuestions = this._stableFallbackQuestions as SurveyResultsFallbackQuestionBuckets;
const bucket = mode === 'individual'
  ? fallbackQuestions.individual
  : fallbackQuestions.summary;
if (bucket.has(cacheKey)) return bucket.get(cacheKey) as SurveyResultsFallbackQuestion;
const fallback: SurveyResultsFallbackQuestion = mode === 'individual'
  ? {
    id: questionId,
    creator: '',
    type: '',
    prompt: '',
  }
  : {
    id: questionId,
    prompt: 'Unknown question',
  };
bucket.set(cacheKey, fallback);
return fallback;
};

getMemoizedQuestionTableEntries = (
  questionMap: unknown = {},
  networkQuestions: unknown = {}
): SurveyResultsQuestionTableEntry[] => {
const { questionIdSortBy, questionIdSortAsc } = this.state;
const memo = this._questionTableEntriesMemo;
if (
  memo.questionMapRef === questionMap &&
  memo.networkQuestionsRef === networkQuestions &&
  memo.sortBy === questionIdSortBy &&
  memo.sortAsc === questionIdSortAsc
) {
  return memo.result;
}

const questionRecord = Object(questionMap || {}) as Record<string, unknown>;
const networkQuestionRecord = Object(networkQuestions || {}) as Record<string, SurveyResultsRecord | undefined>;
const entries = Object.keys(questionRecord).map((qId) => {
  const responses = questionRecord[qId] || [];
  const lowerQ = qId.toLowerCase();
  const qData = networkQuestionRecord[lowerQ] || {};
  return {
    questionId: qId,
    responsesCount: this.getLatestResponsesByResponder(responses).length,
    type: qData.type || '',
    prompt: qData.prompt || '',
    sessionSlug: qData.sessionSlug || '',
  };
});

entries.sort((a, b) => {
  let cmp = 0;
  if (questionIdSortBy === 'responses') {
    cmp = a.responsesCount - b.responsesCount;
  } else if (questionIdSortBy === 'type') {
    cmp = a.type.localeCompare(b.type);
  } else if (questionIdSortBy === 'prompt') {
    cmp = a.prompt.localeCompare(b.prompt);
  }
  return questionIdSortAsc ? cmp : -cmp;
});

this._questionTableEntriesMemo = {
  questionMapRef: questionMap,
  networkQuestionsRef: networkQuestions,
  sortBy: questionIdSortBy,
  sortAsc: questionIdSortAsc,
  result: entries,
};
return entries;
};

renderQuestionIDsTable = (questionMap: unknown, preNetworkQuestions: unknown): React.ReactNode => {
if (!this.hasEffectiveNetworkId()) return null;
const networkQuestions = preNetworkQuestions || this.getNetworkQuestionsForCurrentContext();
const questionEntries = this.getMemoizedQuestionTableEntries(questionMap, networkQuestions);
const { questionIdSortBy, questionIdSortAsc } = this.state;

return (
  <SurveyResultsQuestionTable
    bookmarkedQuestionIDs={this.state.bookmarkedQuestionIDs}
    entries={questionEntries}
    fallbackSessionSlug={this.getEffectiveSlug()}
    onSort={this.changeQuestionIdSort}
    onToggleQuestionBookmark={this.toggleQuestionBookmark}
    onViewQuestion={(questionId) => {
      // Use setState with a callback to guarantee the scroll happens after the render.
      // This ensures the card is expanded before we attempt to scroll to it.
      this.setState((prevState: SurveyResultsRecord) => buildSurveyResultsKeyedTogglePatch({
        forceValue: true,
        itemKey: questionId,
        mapKey: 'activeQuestionToggles',
        prevState,
      }), () => {
        this.scrollToQuestion(questionId);
      });
    }}
    sortAsc={questionIdSortAsc}
    sortBy={questionIdSortBy}
    styleMap={styles}
  />
);
};

// Add this helper inside the SurveyResults class
stringifyAggregatorResponses = (aggregatorObj: unknown): SurveyResultsStringifiedAggregator => {
const out: SurveyResultsStringifiedAggregator = {};
if (!aggregatorObj || typeof aggregatorObj !== 'object') return out;
const aggregatorRecord = aggregatorObj as Record<string, unknown>;
Object.keys(aggregatorRecord).forEach((qId) => {
  const arr = Array.isArray(aggregatorRecord[qId]) ? aggregatorRecord[qId] : [];
  out[qId] = arr.map((item) => ({
    ...(item as SurveyResultsRecord),
    response:
      typeof (item as SurveyResultsRecord).response === 'string'
        ? (item as SurveyResultsRecord).response
        : JSON.stringify((item as SurveyResultsRecord).response),
  }));
});
return out;
};


scrollToQuestion = (questionId: unknown): void => {
const domId = getQuestionCardDomId(questionId as string | undefined);
const cleanupScrollWatcher = () => {
  if (this._scrollToQuestionRetryTimer) {
    clearTimeout(this._scrollToQuestionRetryTimer);
    this._scrollToQuestionRetryTimer = null;
  }
  if (this._scrollMutationObserver) {
    this._scrollMutationObserver.disconnect();
    this._scrollMutationObserver = null;
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
  (this.questionIdTableRef?.current &&
    this.questionIdTableRef.current.closest(`.${styles.modalBody}`)) ||
  document.querySelector(`.${styles.modalBody}`);

if (!containerToWatch) return;

this._scrollMutationObserver = new MutationObserver(() => {
  attemptScroll();
});

this._scrollMutationObserver.observe(containerToWatch, {
  childList: true,
  subtree: true,
});

this._scrollToQuestionRetryTimer = setTimeout(() => {
  cleanupScrollWatcher();
}, 2000);
};

changeQuestionIdSort = (column: unknown): void => {
this.setState((prevState: SurveyResultsRecord) => buildSurveyResultsQuestionIdSortPatch({
  column,
  prevState,
}));
};

  toggleQuestionFilter = (): void => {
this.setState((prevState: SurveyResultsRecord) => buildSurveyResultsBooleanTogglePatch({
  prevState,
  stateKey: 'showQuestionFilter',
}));
};

toggleSurveyViewMode = (mode: unknown): void => {
this.setState(buildSurveyResultsSurveyViewModePatch(mode));
};

handleSurveyViewModeToggle = (): void => {
this.toggleSurveyViewMode(this.state.surveyViewMode === 'individuals' ? 'aggregate' : 'individuals');
};

handleSurveyViewModeKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
if (event.key === 'Enter' || event.key === ' ') {
  event.preventDefault();
  this.handleSurveyViewModeToggle();
}
};

toggleExportArea = (): void => {
this.setState((prevState: SurveyResultsRecord) => buildSurveyResultsBooleanTogglePatch({
  prevState,
  stateKey: 'exportAreaOpen',
}));
};

handleManualRefresh = async (): Promise<void> => {
try {
  const slug = this.getEffectiveSlug();
  const latestOnChain = await contractScripts.getLatestBlockNumber(this.props.provider, slug);

  this.setState(
    {
      refreshTargetQuestionBlock: latestOnChain,
      refreshTargetResponseBlock: latestOnChain,
      refreshTargetSurveyBlock: latestOnChain
    },
    async () => {
      if (this.state.viewMode === 'questions') {
        if (this.props.refreshQuestionMetadata) {
          surveyLog.log("refreshQuestionMetadata present")
          await this.props.refreshQuestionMetadata();
        }
        if (this.props.refreshQuestionResponses) {
          await this.props.refreshQuestionResponses();
        }
      } else if (
        this.state.viewMode === 'survey' &&
        this.state.surveyId && // Use state.surveyId
        this.props.refreshSurveyResponsesByID
      ) {
        await this.props.refreshSurveyResponsesByID(this.state.surveyId.toLowerCase());
      }
      this.resetLocalStoragePollingBackoff('manual-refresh');
      this.pollLocalStorageForUpdates();
      this.queueResultsRefresh('manual-refresh');
    }
  );
} catch (error) {
  surveyLog.error('handleManualRefresh error:', error);
}
};

handleBookmarkFilter = async (): Promise<void> => {
if (!this._isMounted) return;

const filterToBookmark = this.state.filterState;
const slug = this.getEffectiveSlug();

let filtersCache: unknown = peekCacheSync('filters', slug, { clone: false });
if (!filtersCache || typeof filtersCache !== 'object') {
  filtersCache = (await readCache('filters', slug)) || {};
} else {
  filtersCache = { ...(filtersCache as SurveyResultsFiltersCache) };
}
const filtersCacheRecord = toSurveyResultsRecord(filtersCache) as SurveyResultsFiltersCache;
let bookmarks: unknown[] = [];
try {
  const parsed = filtersCacheRecord.bookmarkedFilters;
  if (Array.isArray(parsed)) {
    bookmarks = [...parsed];
  } else if (parsed != null) {
    surveyLog.warn('Bookmarked filters cache was not an array. Initializing to empty array.');
  }
} catch (e) {
  surveyLog.error('Error parsing bookmarked filters cache:', e);
}

// Optional: Duplicate check (skipped for simplicity as per instructions)
bookmarks.push(filterToBookmark);

try {
  await (writeCache as SurveyResultsWriteCache)('filters', slug, {
    ...filtersCacheRecord,
    bookmarkedFilters: bookmarks,
  });
  this.setState(buildSurveyResultsBookmarkFeedbackPatch(true));

  if (this._bookmarkFeedbackTimer) {
    clearTimeout(this._bookmarkFeedbackTimer);
    this._bookmarkFeedbackTimer = null;
  }
  this._bookmarkFeedbackTimer = setTimeout(() => {
    this._bookmarkFeedbackTimer = null;
    if (this._isMounted) {
      this.setState(buildSurveyResultsBookmarkFeedbackPatch(false));
    }
  }, 2000);
} catch (e) {
  surveyLog.error('Error saving bookmarked filters cache:', e);
}
};

renderHtmlReportExportModal = (): React.ReactNode => {
const exportedAt = this.state.htmlReportExportedAt || new Date().toISOString();
const snapshot = this.buildSessionResultsHtmlReportSnapshot(exportedAt);
const sectionRows = this.getHtmlReportSectionRows(snapshot);
const selectedSections = this.getHtmlReportSelectedSections();
const canDownload = this.canDownloadHtmlReport(snapshot, selectedSections);
const isAuthorized = this.isHtmlReportExportAuthorized();
const isDemoSession = this.isHtmlReportDemoSession();
const isDemoMode = this.isHtmlReportDemoModeActive();
const needsAnalysisGeneration = this.needsHtmlReportAnalysisGeneration(snapshot, selectedSections);
const analysisPayload = this.buildSessionResultsAnalysisPayloadForAi();
const canGenerateAnalysis =
  (isAuthorized || isDemoMode) &&
  analysisPayload.eligibility.eligible &&
  !this.state.htmlReportAnalysisGenerating;
const sessionLabel = snapshot.session.name || snapshot.session.slug || 'Session';
const exporterLabel = snapshot.exportedBy?.displayAddress || 'Not connected';
const downloadLabel = this.state.htmlReportExportFormat === SESSION_RESULTS_EXPORT_FORMAT_PDF
  ? 'Download PDF'
  : this.state.htmlReportExportFormat === SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML
    ? 'Download Single HTML'
    : 'Download HTML Viewer';

return (
  <Modal
    isOpen={!!this.state.htmlReportModalOpen}
    toggle={this.closeHtmlReportExportModal}
    className={styles.htmlReportModal}
    data-testid="ce-surveyresults-html-report-modal"
  >
    <ModalHeader toggle={this.closeHtmlReportExportModal} className={styles.htmlReportModalHeader}>
      Export HTML Report
    </ModalHeader>
    <ModalBody className={styles.htmlReportModalBody}>
      <p>
        <strong>{sessionLabel}</strong>
        {snapshot.session.slug ? ` (${snapshot.session.slug})` : ''}
      </p>
      <p>
        Export timestamp: <strong>{snapshot.exportedAt}</strong>
      </p>
      <p>
        Privacy mode: <strong>Redacted</strong>
      </p>
      <p>
        Downloaded by: <strong>{exporterLabel}</strong>
      </p>
      {!isAuthorized && (
        <Alert color="info" fade={false} className={styles.htmlReportInfo}>
          Connect a wallet to download authenticated exports.
        </Alert>
      )}
      <div className={styles.htmlReportOptionGroup}>
        <h6>Export format</h6>
        {HTML_REPORT_EXPORT_FORMATS.map((formatOption) => (
          <FormGroup check key={formatOption.value} className={styles.htmlReportOptionRow}>
            <Input
              id={`html-report-format-${formatOption.value}`}
              type="radio"
              checked={this.state.htmlReportExportFormat === formatOption.value}
              onChange={() => this.handleHtmlReportFormatChange(formatOption.value)}
            />
            <Label check for={`html-report-format-${formatOption.value}`}>
              <strong>{formatOption.label}</strong>
              <small>{formatOption.description}</small>
            </Label>
          </FormGroup>
        ))}
      </div>
      {isDemoSession && (
        <div className={styles.htmlReportOptionGroup}>
          <FormGroup check className={styles.htmlReportOptionRow}>
            <Input
              id="html-report-demo-mode"
              type="checkbox"
              checked={isDemoMode}
              onChange={this.toggleHtmlReportDemoMode}
              data-testid="ce-surveyresults-html-report-demo-mode"
            />
            <Label check for="html-report-demo-mode">
              <strong>Demo preview mode</strong>
              <small>Use local demo analysis sections without AI or wallet auth.</small>
            </Label>
          </FormGroup>
        </div>
      )}
      <Table size="sm" responsive className={styles.htmlReportSectionTable}>
        <thead>
          <tr>
            <th scope="col">Include</th>
            <th scope="col">Section</th>
            <th scope="col">Availability</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          {sectionRows.map((row) => (
            <tr key={row.key}>
              <td>
                <Input
                  aria-label={`Include ${row.label}`}
                  checked={!!selectedSections[row.key]}
                  type="checkbox"
                  onChange={() => this.toggleHtmlReportSection(row.key)}
                />
              </td>
              <td>{row.label}</td>
              <td>{row.available ? 'Available' : 'Unavailable'}</td>
              <td>{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className={styles.htmlReportOptionGroup}>
        <h6>Analysis views</h6>
        <p>
          {analysisPayload.eligibility.counts.responses} responses,
          {' '}{analysisPayload.eligibility.counts.participants} participants,
          {' '}{analysisPayload.eligibility.counts.questions} questions.
          {' '}AI mode uses synthetic participant IDs.
        </p>
        {analysisPayload.eligibility.reasons.length > 0 && (
          <Alert color="info" fade={false} className={styles.htmlReportInfo}>
            {analysisPayload.eligibility.reasons.join(' ')}
          </Alert>
        )}
        {this.state.htmlReportAnalysisError && (
          <Alert color="warning" fade={false} className={styles.htmlReportWarning}>
            {this.state.htmlReportAnalysisError}
          </Alert>
        )}
        <Button
          type="button"
          color="secondary"
          onClick={this.generateHtmlReportAnalysisViews}
          disabled={!canGenerateAnalysis}
          className={styles.htmlReportGenerateButton}
          data-testid="ce-surveyresults-html-report-generate-analysis"
        >
          {this.state.htmlReportAnalysisGenerating
            ? 'Generating Analysis Views...'
            : isDemoMode
              ? 'Refresh Demo Analysis'
              : 'Generate Analysis Views'}
        </Button>
      </div>
      {needsAnalysisGeneration && (
        <Alert color="info" fade={false} className={styles.htmlReportInfo}>
          Selected analysis sections need generated data before download.
        </Alert>
      )}
      <Alert color="warning" fade={false} className={styles.htmlReportWarning}>
        Redacted exports omit raw response records, wallet addresses, encrypted payloads, and gated values by default.
      </Alert>
      {!canDownload && (
        <Alert color="info" fade={false} className={styles.htmlReportInfo}>
          {isAuthorized
            ? 'Select only available sections, or generate selected analysis views before download.'
            : 'Connect a wallet to enable download.'}
        </Alert>
      )}
    </ModalBody>
    <ModalFooter className={styles.htmlReportModalFooter}>
      <Button
        color="secondary"
        onClick={this.closeHtmlReportExportModal}
        className={styles.htmlReportCancelButton}
      >
        Cancel
      </Button>
      <Button
        color="primary"
        onClick={this.downloadHtmlReport}
        disabled={!canDownload}
        className={styles.htmlReportDownloadButton}
        data-testid="ce-surveyresults-html-report-download"
      >
        {downloadLabel}
      </Button>
    </ModalFooter>
  </Modal>
);
}

render() {
const isActuallyOpen = this.props.isOpen;

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
} = this.state;

// Use this.state.surveyId for consistency
const currentSurveyId = this.state.surveyId;
// Preload scoped question metadata once per render so question-mode summaries stay in
// sync with the same list-scope aggregation used by fetchQuestionModeResponses().
const slug = this.getEffectiveSlug();
const preQuestionNetworkData = this.getScopedQuestionNetworkDataSync(viewMode);
const preNetworkQuestions = preQuestionNetworkData.questions || {};
const questionFilterQuestions = this.getMemoizedQuestionFilterQuestions(preNetworkQuestions);
const exportControlsDisplay = buildSurveyResultsExportControlsDisplayDescriptor({
  exportAreaOpen,
  exportType,
});
const aggregatorEntries = this.getMemoizedAggregatorEntries(sbtFilteredAggregatorQuestionResponses);
const aggregatorEntriesCount = aggregatorEntries.length;
const lockedResponsesModel = this.getMemoizedLockedResponsesModel(preNetworkQuestions);
const surveyAggregateEntries =
  (viewMode === 'survey' && surveyViewMode === 'aggregate') ? aggregatorEntries : [];
const questionModeEntries = viewMode === 'questions' ? aggregatorEntries : [];

const currentViewModeForFilter = this.state.viewMode;
const currentSurveyIdForFilter = this.state.viewMode === 'survey' ? this.state.surveyId : null;

const surveyIdAbbreviation = currentSurveyId
  ? getShortenedSurveyID(currentSurveyId, false, null, false)
  : null;
const areSummaryCountsHydrated =
  viewMode === 'survey'
    ? !!this.state.surveyResultsHydrated
    : !!this.state.questionResultsHydrated;
const isDemoQuestionResults = this.getIsDemoQuestionResultsContext();
const demoResultsViewMode = isDemoQuestionResults
  ? this.state.demoResultsViewMode || 'raw'
  : 'raw';
const isDemoAlternateResultsView = isDemoQuestionResults && demoResultsViewMode !== 'raw';
const demoResultsViewOptions: SurveyResultsDemoViewOption[] = isDemoQuestionResults
  ? [
      { key: 'report', label: 'Report' },
      { key: 'atlas', label: 'Atlas' },
      { key: 'breakdown', label: 'Breakdown' },
      { key: 'riskMatrix', label: 'Risk Matrix' },
    ]
  : [];

const filterSummaryDisplay = buildSurveyResultsFilterSummaryDisplayPlan({
  aggregatorEntriesCount,
  areSummaryCountsHydrated,
  filteredQuestionsCount,
  filteredResponsesCount,
  filterLoading,
  surveyViewMode,
  totalQuestionsCount,
  totalResponsesCount,
  viewMode,
});

const syncStatusDisplay = buildSurveyResultsSyncStatusDisplayPlan({
  networkLatestBlock: this.state.networkLatestBlock,
  questionLocalBlock: this.state.questionLocalBlock,
  refreshTargetQuestionBlock: this.state.refreshTargetQuestionBlock,
  refreshTargetResponseBlock: this.state.refreshTargetResponseBlock,
  refreshTargetSurveyBlock: this.state.refreshTargetSurveyBlock,
  responseLocalBlock: this.state.responseLocalBlock,
  showLongSyncNotice:
    this._syncLoadingStartedAt !== null &&
    Date.now() - this._syncLoadingStartedAt >= 15000,
  surveyLocalBlock: this.state.surveyLocalBlock,
  viewMode,
});

return (
  <>
  <Modal
    isOpen={isActuallyOpen}
    toggle={this.closeModal}
    className={styles.resultsModal}
  >
    <SurveyResultsModalHeader
      bookmarkedSurveyIDs={this.state.bookmarkedSurveyIDs}
      currentSurveyId={currentSurveyId}
      demoResultsViewMode={demoResultsViewMode}
      demoResultsViewOptions={demoResultsViewOptions}
      documentLinkIconStyle={SURVEY_RESULTS_DOCUMENT_LINK_ICON_STYLE}
      effectiveSlug={this.getEffectiveSlug()}
      isDemoQuestionResults={isDemoQuestionResults}
      lockedResponsesToggleNode={this.renderLockedResponsesToggle(lockedResponsesModel)}
      onClose={this.closeModal}
      onDemoResultsViewSelect={this.handleDemoResultsViewSelect}
      onToggleSurveyBookmark={this.toggleSurveyBookmark}
      styleMap={styles}
      surveyBookmarkStyle={SURVEY_RESULTS_SURVEY_BOOKMARK_STYLE}
      surveyDocumentURLs={Array.isArray(surveyDocumentURLs) ? surveyDocumentURLs : []}
      surveyIdAbbreviation={surveyIdAbbreviation}
      surveyTitle={surveyTitle}
      syncStatusNode={renderSurveyResultsSyncStatusPanel({
          isSynced: syncStatusDisplay.isSynced,
          isSyncingOrLoading: syncStatusDisplay.isSyncingOrLoading,
          syncStatusText: syncStatusDisplay.syncStatusText,
          showLongSyncNotice: syncStatusDisplay.showLongSyncNotice,
          syncDetailsOpen: !!this.state.syncDetailsOpen,
          syncDetailsStyle: resolveSurveyResultsSyncDetailsStyle(this.state.syncDetailsOpen),
          onToggleSyncDetails: () =>
            this.setState((prevState: SurveyResultsRecord) => buildSurveyResultsBooleanTogglePatch({
              prevState,
              stateKey: 'syncDetailsOpen',
            })),
          onManualRefresh: () => this.handleManualRefresh(),
          viewMode: syncStatusDisplay.viewMode,
          showQuickRefresh: syncStatusDisplay.showQuickRefresh,
          showQuestionSpinner: syncStatusDisplay.question.showSpinner,
          questionProgress: syncStatusDisplay.question.progress,
          questionColor: syncStatusDisplay.question.color,
          questionBarText: syncStatusDisplay.question.label,
          showQuestionRemainingSpinner: syncStatusDisplay.question.showRemainingSpinner,
          showResponseSpinner: syncStatusDisplay.response.showSpinner,
          responseProgress: syncStatusDisplay.response.progress,
          responseColor: syncStatusDisplay.response.color,
          responseBarText: syncStatusDisplay.response.label,
          showResponseRemainingSpinner: syncStatusDisplay.response.showRemainingSpinner,
          miniBarSpinnerStyle: SURVEY_RESULTS_MINI_BAR_SPINNER_STYLE,
          miniProgressStyle: SURVEY_RESULTS_MINI_PROGRESS_STYLE,
          remainingSpinnerStyle: SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE,
        })}
      viewMode={viewMode}
    />

    <ModalBody className={styles.modalBody}>
      {isDemoAlternateResultsView ? (
        <div
          className={styles.demoResultsSurface}
          data-testid={`ce-surveyresults-demo-surface-${demoResultsViewMode}`}
        >
          {this.renderDemoResultsSurface(demoResultsViewMode)}
        </div>
      ) : (
        <>
      <SurveyResultsStatusMessages
        alertMessage={alertMessage}
        filterLoading={filterLoading}
        styleMap={styles}
      />

      {viewMode === 'survey' && (
        <SurveyResultsSurveyViewModeToggle
          isAggregate={surveyViewMode === 'aggregate'}
          knobStyle={resolveSurveyResultsToggleKnobStyle(surveyViewMode === 'aggregate')}
          onKeyDown={this.handleSurveyViewModeKeyDown}
          onToggle={this.handleSurveyViewModeToggle}
          styleMap={styles}
          trailingLabelStyle={SURVEY_RESULTS_TRAILING_LABEL_STYLE}
        />
      )}

      {this.renderLockedResponsesBanner(lockedResponsesModel)}

      {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
        <SurveyResultsQuestionListCard
          isOpen={!!this.state.activeQuestionToggles['__questionList__']}
          onToggle={() => this.toggleQuestionSummary('__questionList__')}
          questionTableNode={
            aggregatorEntriesCount === 0 && !filterLoading
              ? null
              : this.renderQuestionIDsTable(
                sbtFilteredAggregatorQuestionResponses,
                preNetworkQuestions
              )
          }
          showEmptyState={aggregatorEntriesCount === 0 && !filterLoading}
          styleMap={styles}
          tableWrapperRef={this.questionIdTableRef}
          title=" View & Sort Questions"
          trailingLabelStyle={SURVEY_RESULTS_TRAILING_LABEL_STYLE}
        />
      )}

      {viewMode === 'questions' && (
        <SurveyResultsQuestionListCard
          isOpen={!!this.state.activeQuestionToggles['__questionList__']}
          onToggle={() => this.toggleQuestionSummary('__questionList__')}
          questionTableNode={
            aggregatorEntriesCount === 0 && !filterLoading
              ? null
              : this.renderQuestionIDsTable(
                sbtFilteredAggregatorQuestionResponses,
                preNetworkQuestions
              )
          }
          showEmptyState={aggregatorEntriesCount === 0 && !filterLoading}
          styleMap={styles}
          title="View & Sort Questions"
          trailingLabelStyle={SURVEY_RESULTS_TRAILING_LABEL_STYLE}
        />
      )}

      {renderSurveyResultsFilterSummary({
        displayedTotalQuestionsCount: filterSummaryDisplay.displayedTotalQuestionsCount,
        displayedTotalResponsesCount: filterSummaryDisplay.displayedTotalResponsesCount,
        normalizedFilteredQuestionsCount: filterSummaryDisplay.normalizedFilteredQuestionsCount,
        normalizedFilteredResponsesCount: filterSummaryDisplay.normalizedFilteredResponsesCount,
        showFilteredCountSpinner: filterSummaryDisplay.showFilteredCountSpinner,
      })}


      {/* The area with SBTFilter / QuestionFilter toggles previously (export + filter) */}
      <div className={styles.exportAndFilterContainer}>

        <div className={styles.filterBox}>
          {viewMode === 'survey' && surveyViewMode === 'individuals' && (
            <Label className={styles.filterBoxLabel}>
              {/* Filter (Survey Individuals): */}
            </Label>
          )}
          {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
            <Label className={styles.filterBoxLabel}>
              {/* Filter (Survey Aggregate): */}
            </Label>
          )}
          {viewMode === 'questions' && (
            <Label className={styles.filterBoxLabel}>
              {/* Filter Questions & Responses: */}
            </Label>
          )}



          {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
            <SBTFilter
              items={this.state.aggregateQuestionResponses}
              mode="responder"
              provider={this.props.provider}
              network={this.props.network}
              onFilter={this.handleFilteredResponses}
              setFilterLoading={this.setFilterLoading}
              autoExpand={false}
              buttonSurface="light"
              hideLoadingOverlay={true}
              externalSBTFilterState={this.state.filterState.sbtFilter}
              isQuestionCacheReady={this.props.isQuestionCacheReady}
              isSBTCacheReady={this.props.isSBTCacheReady}
              sbtCacheRevision={this.props.sbtCacheRevision}
            />
          )}
          {viewMode === 'survey' && surveyViewMode === 'individuals' && (
            <SBTFilter
              items={this.state.responses}
              mode="responder"
              provider={this.props.provider}
              network={this.props.network}
              onFilter={this.handleFilteredResponses}
              setFilterLoading={this.setFilterLoading}
              autoExpand={false}
              buttonSurface="light"
              hideLoadingOverlay={true}
              externalSBTFilterState={this.state.filterState.sbtFilter}
              isQuestionCacheReady={this.props.isQuestionCacheReady}
              isSBTCacheReady={this.props.isSBTCacheReady}
              sbtCacheRevision={this.props.sbtCacheRevision}
            />
          )}
          {viewMode === 'questions' && (

            <>

         {/* The "Filter" button that toggles the QuestionFilter */}
        <Button className={styles.questionFilterButton} onClick={this.toggleQuestionFilter}>
          Filter

          <FontAwesomeIcon icon={faFilter} className={styles.questionFilterIcon} />

           {isFilterActive && (
            <span className={styles.clearFilterIcon} onClick={this.handleClearFiltersFromParent}>
              <FontAwesomeIcon icon={faTimes} />
            </span>
          )}
        </Button>

<QuestionFilter
  ref={this.questionFilterRef}
  onFilterActivityChange={this.handleFilterActivityChange}
  resultsMode={true}
  filterModalOpen={this.state.showQuestionFilter}
  toggleFilterModal={this.toggleQuestionFilter}
  questions={questionFilterQuestions}
  questionResponses={this.state.questionResponses}
	provider={this.props.provider}
	network={this.props.network}
	onFilter={this.handleQuestionFilter}
	onCountUpdate={this.handleQuestionFilterCountUpdate}
	filterState={this.state.filterState}
	setFilterLoading={this.setFilterLoading}
  creatorAndResponderMode={true}
  currentViewModeForUrl={currentViewModeForFilter}
  currentSurveyIdForUrl={currentSurveyIdForFilter}
  questionResponsesNonce={this.props.questionResponsesNonce}
  questionsCacheNonce={this.props.questionsCacheNonce}
  isQuestionCacheReady={this.props.isQuestionCacheReady}
  isSBTCacheReady={this.props.isSBTCacheReady}
  sbtCacheRevision={this.props.sbtCacheRevision}
  defaultTags={this.props.defaultTags}
  activeSessionSlug={this.getEffectiveSlug()}
  storageKeyPrefix={this.getQuestionFilterStorageKeyPrefix(currentViewModeForFilter)}
/>


</>
          )}
        </div>

        <SurveyResultsExportControls
          exportAreaOpen={exportControlsDisplay.exportAreaOpen}
          exportOptions={exportControlsDisplay.exportOptions}
          exportTypeLabel={exportControlsDisplay.exportTypeLabel}
          onDownload={this.downloadCSV}
          onExportHtmlReport={this.openHtmlReportExportModal}
          onExportTypeChange={this.handleExportTypeChange}
          onToggleExportArea={this.toggleExportArea}
          styleMap={styles}
        />
      </div>

      {viewMode === 'survey' && surveyViewMode === 'individuals' && (
        <SurveyResultsIndividualResponsesList
          activeToggles={this.state.activeToggles}
          currentSurveyId={currentSurveyId}
          effectiveSlug={this.getEffectiveSlug()}
          filterLoading={filterLoading}
          onToggleResponse={this.toggleResponse}
          renderResponseBody={(response: SurveyResultsResponseListEntry) => {
            const parsedResponse = response.response; // Already an object
            return parsedResponse &&
              parsedResponse.responses &&
              parsedResponse.responses.length > 0 ? (
                parsedResponse.responses.map((answerItem: SurveyResultsRecord, aIndex: number) => {
                  const questionId = getSurveyResponseQuestionId(answerItem);
                  const questionData = preNetworkQuestions[questionId] || this.getStableFallbackQuestion(questionId, 'individual');
                  const responseKey = this.getLockedResponseKey({
                    responder: response?.responder,
                    questionId,
                    surveyId: response?.surveyId || currentSurveyId,
                    response: answerItem,
                  });
                  const displayResponse = this.applyDecryptedOverrideToResponse({
                    response: answerItem,
                    key: responseKey,
                  });
                  return (
                    <div key={aIndex} className={styles.surveyResultsOverride}>
                      <SingleQuestionResponse
                        aggregatorResponseMode={false}
                        question={questionData}
                        response={displayResponse}
                        mode="fullscreen"
                        isOwnResponse={
                          this.props.account?.toLowerCase() ===
                          response.responder?.toLowerCase()
                        }
                        network={this.props.network}
                        activeSessionSlug={questionData?.sessionSlug || this.getEffectiveSlug()}
                        questionResponsesNonce={this.props.questionResponsesNonce}
                        questionsCacheNonce={this.props.questionsCacheNonce}
                        sbtCacheRevision={this.props.sbtCacheRevision}
                        {...this.getSurveyResultsResponseCardProps()}
                      />
                    </div>
                  );
                })
              ) : (
                <p>No question-level responses found for this user.</p>
              );
          }}
          responses={sbtFilteredResponses}
          styleMap={styles}
        />
      )}

      {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
        <SurveyResultsQuestionSummariesList
          entries={surveyAggregateEntries}
          filterLoading={filterLoading}
          renderQuestionSummary={(qId, arr) => this.renderQuestionSummary(qId, arr, preNetworkQuestions)}
          styleMap={styles}
        />
      )}

	      {viewMode === 'questions' && (
        <SurveyResultsQuestionSummariesList
          entries={questionModeEntries}
          filterLoading={filterLoading}
          renderQuestionSummary={(qId, arr) => this.renderQuestionSummary(qId, arr, preNetworkQuestions)}
          styleMap={styles}
        />
      )}
        </>
      )}

    </ModalBody>

    <ModalFooter>
      {/* Additional footer actions if needed */}
    </ModalFooter>
  </Modal>
  {this.renderHtmlReportExportModal()}
  </>
);
}
}

 const mapStateToProps = (state: SurveyResultsRecord = {}) => {
   const sessionState = toSurveyResultsRecord(state.sessionState);
   const profile = toSurveyResultsRecord(state.profile);
   const activeSessionSlug = sessionState.activeSessionSlug || '';
   return {
     activeSessionSlug,
     account: profile.account || '',
     loginComplete: !!sessionState.loginComplete,
   };
 };
 export default connect(mapStateToProps)(SurveyResults);
