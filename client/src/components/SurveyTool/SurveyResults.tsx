/** @file SurveyResults.tsx */

import React, { useLayoutEffect, useReducer, useRef } from 'react';
import { connect } from 'react-redux';
import {
  Alert,
  Button,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  UncontrolledDropdown,
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
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Table,
  Collapse
} from 'reactstrap';

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
  faFilter,
  faExclamationCircle
} from '@fortawesome/free-solid-svg-icons';

import { getAllSessionSlugs, getSessionConfigBySlug } from '../../utilities/web3/chainGateway.js';
import { createLogger } from 'utilities/logging.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
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
  renderSurveyResultsFilterSummary,
  renderSurveyResultsSyncStatusPanel,
} from './SurveyResultsPanels';
import {
  isSurveyResultsStateSynced,
  type SurveyResultsSyncStateLike,
} from './surveyResultsSyncHelpers.js';
import {
  SURVEY_RESULTS_EXPORT_OPTIONS as EXPORT_OPTIONS,
  SURVEY_RESULTS_EXPORT_TYPES as EXPORT_TYPES,
  buildSurveyResultsExportControlsDisplayDescriptor,
  buildSurveyResultsExportDownloadPlan,
  buildSurveyResultsExportGenerationPlan,
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
    description: 'Interactive self-contained report with search and embedded snapshot data.',
    label: 'Exported viewer',
    value: SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  },
  {
    description: 'Static standalone HTML with all selected sections expanded for review or archiving.',
    label: 'Single HTML file',
    value: SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
  },
  {
    description: 'One-page PDF capture using the same selected sections and print-oriented layout.',
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

getHtmlReportExporterMetadata = () => {
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
    reason: snapshot.sections.report.available ? 'Hydrated questions or responses are available.' : (
      snapshot.sections.report.reason || 'No filtered questions or responses are hydrated yet.'
    ),
  },
  {
    available: snapshot.sections.argumentMap.available,
    key: 'argumentMap',
    label: 'Argument Map',
    reason: snapshot.sections.argumentMap.available ? 'Generated analysis is available.' : (
      snapshot.sections.argumentMap.reason || 'Generate analysis views to derive an argument map.'
    ),
  },
  {
    available: snapshot.sections.riskMatrix.available,
    key: 'riskMatrix',
    label: 'Risk Matrix',
    reason: snapshot.sections.riskMatrix.available ? 'Generated analysis is available.' : (
      snapshot.sections.riskMatrix.reason || 'Generate analysis views to derive a risk matrix.'
    ),
  },
  {
    available: snapshot.sections.atlas.available,
    key: 'atlas',
    label: 'Atlas Nodes',
    reason: snapshot.sections.atlas.available ? 'Generated analysis is available.' : (
      snapshot.sections.atlas.reason || 'Generate analysis views to derive atlas nodes.'
    ),
  },
  {
    available: true,
    key: 'snapshotJson',
    label: 'Embedded Snapshot JSON',
    reason: 'Embedded as inert application data for reproducibility and integrity checks.',
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

handleHtmlReportFormatChange = (format: SessionResultsExportFormat): void => {
this.setState({ htmlReportExportFormat: format });
}

generateHtmlReportAnalysisViews = async (): Promise<void> => {
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
let fileContent = '';
const baseFileName = this.getExportBaseFileName(exportType);
const generationPlan = buildSurveyResultsExportGenerationPlan({
  baseFileName,
  exportType,
  timestamp,
});

if (generationPlan.status === 'invalid') {
  this.setState(buildSurveyResultsAlertMessagePatch(generationPlan.alertMessage));
  return;
}

switch (generationPlan.generatorKey) {
  case 'questions-csv':
    fileContent = this.generateQuestionsCSV();
    break;
  case 'questions-responses-csv':
    fileContent = this.generateResponsesCSV();
    break;
  case 'questions-json':
    fileContent = this.generateQuestionsJSON();
    break;
  case 'questions-responses-json':
    fileContent = this.generateResultsJSON();
    break;
  default:
    this.setState(buildSurveyResultsAlertMessagePatch('Invalid export type selected.'));
    return;
}

const downloadPlan = buildSurveyResultsExportDownloadPlan({
  fileContent,
  generationPlan,
});
if (downloadPlan.status === 'empty') {
  if (!this.state.alertMessage) {
    this.setState(buildSurveyResultsAlertMessagePatch(downloadPlan.alertMessage));
  }
  return;
}

const blob = new Blob([downloadPlan.fileContent], { type: downloadPlan.mimeType });
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.setAttribute('hidden', '');
a.setAttribute('href', url);
a.setAttribute('download', downloadPlan.filename);
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
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
    if (picks.size === 0) return;
    totalResponders += 1;
    picks.forEach((key) => {
      countsByKey.set(key, (countsByKey.get(key) || 0) + 1);
    });
  });

  return {
    totalResponders,
    options: Array.from(displayByKey.entries()).map(([key, label]) => ({
      key,
      label,
      count: countsByKey.get(key) || 0,
    })),
  };
};

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

const questionRecord = Object(questionMap || {}) as Record<string, unknown>;
const networkQuestionRecord = Object(networkQuestions || {}) as Record<string, SurveyResultsRecord | undefined>;
const entries = Object.keys(questionRecord).map((qId) => {
  const responses = questionRecord[qId] || [];
  const lowerQ = qId.toLowerCase();
  const qData = networkQuestionRecord[lowerQ] || {};
  return {
    questionId: qId,
    responsesCount: this.getLatestResponsesByResponder(responses).length,
    type: (qData.type || '') as string,
    prompt: (qData.prompt || '') as string,
    sessionSlug: (qData.sessionSlug || '') as string,
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
if (!this.props.network || !this.props.network.id) return null;
const networkQuestions = preNetworkQuestions || this.getNetworkQuestionsForCurrentContext();
const questionEntries = this.getMemoizedQuestionTableEntries(questionMap, networkQuestions);
const { questionIdSortBy, questionIdSortAsc } = this.state;

return (
  <div className={styles.questionIdTableWrapper}>
    <Table striped bordered hover size="sm" className={styles.questionIdTable}>
      <thead>
        <tr>
          <th style={SURVEY_RESULTS_TABLE_CELL_STYLE}>Question ID</th>
          <th
            style={SURVEY_RESULTS_SORTABLE_HEADER_STYLE}
            onClick={() => this.changeQuestionIdSort('prompt')}
          >
            Prompt {questionIdSortBy === 'prompt' ? (questionIdSortAsc ? '▲' : '▼') : '▲▼'}
          </th>
          <th
            style={SURVEY_RESULTS_SORTABLE_HEADER_STYLE}
            onClick={() => this.changeQuestionIdSort('type')}
          >
            Type {questionIdSortBy === 'type' ? (questionIdSortAsc ? '▲' : '▼') : '▲▼'}
          </th>
          <th
            style={SURVEY_RESULTS_SORTABLE_HEADER_STYLE}
            onClick={() => this.changeQuestionIdSort('responses')}
          >
            Responses{' '}
            {questionIdSortBy === 'responses' ? (questionIdSortAsc ? '▲' : '▼') : '▲▼'}
          </th>
          <th style={SURVEY_RESULTS_TABLE_CELL_STYLE}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {questionEntries.map((entry) => {
          const shortened = getShortenedQuestionID(entry.questionId, false);
          const bookmarked = this.state.bookmarkedQuestionIDs.includes(entry.questionId);
          return (
            <tr key={entry.questionId}>
              <td style={SURVEY_RESULTS_TABLE_CELL_STYLE}>
                <FontAwesomeIcon
                  icon={faBookmark}
                  style={SURVEY_RESULTS_TABLE_BOOKMARK_STYLE}
                  color={bookmarked ? 'gold' : 'white'}
                  onClick={() => this.toggleQuestionBookmark(entry.questionId)}
                />
                <a
                  href={buildQuestionRoutePath(entry.questionId, {
                    sessionSlug: entry.sessionSlug || this.getEffectiveSlug(),
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.clickableQuestionId}
                >
                  {shortened}
                </a>
              </td>
              <td className={styles.promptColumn}>{entry.prompt || '(No prompt)'}</td>
              <td style={SURVEY_RESULTS_TABLE_CELL_STYLE}>{entry.type}</td>
              <td style={SURVEY_RESULTS_TABLE_CELL_STYLE}>{entry.responsesCount}</td>
              <td style={SURVEY_RESULTS_TABLE_CELL_STYLE}>
                <Button
                  size="sm"
                  onClick={() => {
                    // Use setState with a callback to guarantee the scroll happens after the render.
                    // This ensures the card is expanded before we attempt to scroll to it.
                    this.setState((prevState: SurveyResultsRecord) => buildSurveyResultsKeyedTogglePatch({
                      forceValue: true,
                      itemKey: entry.questionId,
                      mapKey: 'activeQuestionToggles',
                      prevState,
                    }), () => {
                      this.scrollToQuestion(entry.questionId);
                    });
                  }}
                  className={styles.tableActionButton}
                >
                  View
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  </div>
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
const needsAnalysisGeneration = this.needsHtmlReportAnalysisGeneration(snapshot, selectedSections);
const analysisPayload = this.buildSessionResultsAnalysisPayloadForAi();
const canGenerateAnalysis = isAuthorized && analysisPayload.eligibility.eligible && !this.state.htmlReportAnalysisGenerating;
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
          Connect a wallet with permission to view these results before exporting. The downloader address
          is embedded in report metadata and shown on exported artifacts.
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
              <span>{formatOption.description}</span>
            </Label>
          </FormGroup>
        ))}
      </div>
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
        <h6>Generated analysis</h6>
        <p>
          AI payloads use synthetic participant IDs. Viewable freeform text can be sent for analysis,
          but wallet addresses are not sent to the AI provider.
        </p>
        <p>
          Current minimums: {analysisPayload.eligibility.counts.responses} viewable responses,
          {' '}{analysisPayload.eligibility.counts.participants} participants,
          {' '}{analysisPayload.eligibility.counts.questions} hydrated questions.
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
          {this.state.htmlReportAnalysisGenerating ? 'Generating Analysis Views...' : 'Generate Analysis Views'}
        </Button>
      </div>
      <Table size="sm" responsive className={styles.htmlReportSectionTable}>
        <thead>
          <tr>
            <th scope="col">Protection</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Exporter metadata</td>
            <td>{isAuthorized ? `Embedded for ${exporterLabel}` : 'Login required'}</td>
          </tr>
          <tr>
            <td>Generated analysis storage</td>
            <td>{this.getHtmlReportAnalysisArtifact() ? 'Saved locally for this session' : 'Not generated yet'}</td>
          </tr>
          <tr>
            <td>Integrity warning</td>
            <td>Exported viewer warns and degrades rendering if embedded exporter metadata is removed.</td>
          </tr>
        </tbody>
      </Table>
      {needsAnalysisGeneration && (
        <Alert color="info" fade={false} className={styles.htmlReportInfo}>
          Selected analysis sections need generated data before download.
        </Alert>
      )}
      <Table size="sm" responsive className={styles.htmlReportSectionTable}>
        <thead>
          <tr>
            <th scope="col">Redaction</th>
            <th scope="col">Default</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Raw responses in snapshot</td>
            <td>Omitted</td>
          </tr>
          <tr>
            <td>Wallet addresses in AI payload</td>
            <td>Replaced with synthetic participant IDs</td>
          </tr>
          <tr>
            <td>Downloader address in artifact metadata</td>
            <td>{isAuthorized ? 'Included' : 'Login required'}</td>
          </tr>
        </tbody>
      </Table>
      <Alert color="warning" fade={false} className={styles.htmlReportWarning}>
        The exported file is a portable local artifact. Redacted mode omits raw response records,
        wallet addresses, encrypted payloads, gated values, and bridge identifiers by default.
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
const aggregatorEntries = this.getMemoizedAggregatorEntries(sbtFilteredAggregatorQuestionResponses);
const aggregatorEntriesCount = aggregatorEntries.length;
const lockedResponsesModel = this.getMemoizedLockedResponsesModel(preNetworkQuestions);
const surveyAggregateEntries =
  (viewMode === 'survey' && surveyViewMode === 'aggregate') ? aggregatorEntries : [];
const questionModeEntries = viewMode === 'questions' ? aggregatorEntries : [];

const netBlock = this.state.networkLatestBlock || 0;
const { questionLocalBlock, responseLocalBlock, surveyLocalBlock } = this.state;
const {
  refreshTargetQuestionBlock,
  refreshTargetResponseBlock,
  refreshTargetSurveyBlock
} = this.state;

const clampedQuestionLocalBlock = Math.min(questionLocalBlock, netBlock);
const clampedResponseLocalBlock = Math.min(responseLocalBlock, netBlock);
const clampedSurveyLocalBlock = Math.min(surveyLocalBlock, netBlock);

const clampedRefreshTargetQuestionBlock =
  refreshTargetQuestionBlock > 0 ? Math.min(refreshTargetQuestionBlock, netBlock) : 0;
const clampedRefreshTargetResponseBlock =
  refreshTargetResponseBlock > 0 ? Math.min(refreshTargetResponseBlock, netBlock) : 0;
const clampedRefreshTargetSurveyBlock =
  refreshTargetSurveyBlock > 0 ? Math.min(refreshTargetSurveyBlock, netBlock) : 0;

let questionDifference = 0;
let questionBarText: React.ReactNode = '';
let questionProgress = 0;
let showQuestionSpinner = false;

if (viewMode === 'questions') {
  if (clampedQuestionLocalBlock === 0 || netBlock === 0) {
    showQuestionSpinner = true;
  } else if (
    clampedRefreshTargetQuestionBlock > 0 &&
    clampedQuestionLocalBlock >= clampedRefreshTargetQuestionBlock
  ) {
    questionProgress = 100;
    questionBarText = `In Sync (Current: ${clampedQuestionLocalBlock} / Latest: ${clampedRefreshTargetQuestionBlock})`;
  } else {
    const denom =
      clampedRefreshTargetQuestionBlock > 0 ? clampedRefreshTargetQuestionBlock : netBlock;
    if (clampedRefreshTargetQuestionBlock === 0) {
      if (clampedQuestionLocalBlock >= netBlock) {
        questionProgress = 100;
        questionBarText = `In Sync (Current: ${clampedQuestionLocalBlock} / Latest: ${netBlock})`;
      } else {
        questionDifference = netBlock - clampedQuestionLocalBlock;
        questionBarText = `Remaining Blocks: ${questionDifference} (Current: ${clampedQuestionLocalBlock} / Latest: ${netBlock})`;
        questionProgress = Math.floor((clampedQuestionLocalBlock / netBlock) * 100);
      }
    } else {
      questionDifference = clampedRefreshTargetQuestionBlock - clampedQuestionLocalBlock;
      questionBarText = (
        <>
          Remaining Blocks: {questionDifference}{' '}
          <FontAwesomeIcon icon={faSpinner} spin style={SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE} />
        </>
      );
      questionProgress = denom
        ? Math.floor((clampedQuestionLocalBlock / denom) * 100)
        : 0;
    }
  }
}

let showResponseSpinner = false;
let responseBarText: React.ReactNode = '';
let responseProgress = 0;
let difference = 0;

if (viewMode === 'survey') {
  if (clampedSurveyLocalBlock === 0 || netBlock === 0) {
    showResponseSpinner = true;
  } else if (
    clampedRefreshTargetSurveyBlock > 0 &&
    clampedSurveyLocalBlock >= clampedRefreshTargetSurveyBlock
  ) {
    responseProgress = 100;
    responseBarText = `In Sync (Current: ${clampedSurveyLocalBlock} / Latest: ${clampedRefreshTargetSurveyBlock})`;
  } else {
    const denom =
      clampedRefreshTargetSurveyBlock > 0 ? clampedRefreshTargetSurveyBlock : netBlock;
    if (clampedRefreshTargetSurveyBlock === 0) {
      if (clampedSurveyLocalBlock >= netBlock) {
        responseProgress = 100;
        responseBarText = `In Sync (Current: ${clampedSurveyLocalBlock} / Latest: ${netBlock})`;
      } else {
        difference = netBlock - clampedSurveyLocalBlock;
        responseBarText = `Remaining Blocks: ${difference} (Current: ${clampedSurveyLocalBlock} / Latest: ${netBlock})`;
        responseProgress = Math.floor((clampedSurveyLocalBlock / netBlock) * 100);
      }
    } else {
      difference = clampedRefreshTargetSurveyBlock - clampedSurveyLocalBlock;
      responseBarText = (
        <>
          Remaining Blocks: {difference}{' '}
          <FontAwesomeIcon icon={faSpinner} spin style={SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE} />
        </>
      );
      responseProgress = denom
        ? Math.floor((clampedSurveyLocalBlock / denom) * 100)
        : 0;
    }
  }
} else {
  if (clampedResponseLocalBlock === 0 || netBlock === 0) {
    showResponseSpinner = true;
  } else if (
    clampedRefreshTargetResponseBlock > 0 &&
    clampedResponseLocalBlock >= clampedRefreshTargetResponseBlock
  ) {
    responseProgress = 100;
    responseBarText = `In Sync (Current: ${clampedResponseLocalBlock} / Latest: ${clampedRefreshTargetResponseBlock})`;
  } else {
    const denom =
      clampedRefreshTargetResponseBlock > 0 ? clampedRefreshTargetResponseBlock : netBlock;
    if (clampedRefreshTargetResponseBlock === 0) {
      if (clampedResponseLocalBlock >= netBlock) {
        responseProgress = 100;
        responseBarText = `In Sync (Current: ${clampedResponseLocalBlock} / Latest: ${netBlock})`;
      } else {
        difference = netBlock - clampedResponseLocalBlock;
        responseBarText = `Remaining Blocks: ${difference} (Current: ${clampedResponseLocalBlock} / Latest: ${netBlock})`;
        responseProgress = Math.floor((clampedResponseLocalBlock / netBlock) * 100);
      }
    } else {
      difference = clampedRefreshTargetResponseBlock - clampedResponseLocalBlock;
      responseBarText = (
        <>
          Remaining Blocks: {difference}{' '}
          <FontAwesomeIcon icon={faSpinner} spin style={SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE} />
        </>
      );
      responseProgress = denom
        ? Math.floor((clampedResponseLocalBlock / denom) * 100)
        : 0;
    }
  }
}

const questionColor = questionProgress < 100 ? 'info' : 'success';
const responseColor = responseProgress < 100 ? 'info' : 'success';

const currentViewModeForFilter = this.state.viewMode;
const currentSurveyIdForFilter = this.state.viewMode === 'survey' ? this.state.surveyId : null;

const isSynced = (viewMode === 'questions' ? questionColor === 'success' && responseColor === 'success' : responseColor === 'success');

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

// Compute a context-aware filtered questions count for display
let displayedFilteredQuestionsCount;
if (viewMode === 'survey') {
  if (surveyViewMode === 'aggregate') {
    displayedFilteredQuestionsCount = aggregatorEntriesCount || totalQuestionsCount;
  } else {
    // Individuals view does not change which questions belong to the survey
    displayedFilteredQuestionsCount = totalQuestionsCount;
  }
} else {
  // Questions view – use live count from QuestionFilter if available; otherwise fallback to visible aggregator keys
  const fallbackLen = aggregatorEntriesCount;
  displayedFilteredQuestionsCount =
    (filteredQuestionsCount !== null && filteredQuestionsCount !== undefined)
      ? filteredQuestionsCount
      : fallbackLen;
}
const displayedTotalQuestionsCount = Math.max(0, Number(totalQuestionsCount) || 0);
const displayedTotalResponsesCount = Math.max(0, Number(totalResponsesCount) || 0);
const normalizedFilteredQuestionsCount = Math.min(
  displayedTotalQuestionsCount,
  Math.max(0, Number(displayedFilteredQuestionsCount) || 0)
);
const normalizedFilteredResponsesCount = Math.min(
  displayedTotalResponsesCount,
  Math.max(0, Number(filteredResponsesCount) || 0)
);

// Compact sync status display
let syncStatusText = '';
let isSyncingOrLoading = true;

if (showQuestionSpinner || showResponseSpinner) {
  syncStatusText = 'Loading...';
} else if (isSynced) {
  syncStatusText = 'In Sync';
  isSyncingOrLoading = false;
} else {
  syncStatusText = 'Syncing...';
}
const showLongSyncNotice =
  isSyncingOrLoading &&
  this._syncLoadingStartedAt !== null &&
  Date.now() - this._syncLoadingStartedAt >= 15000;

return (
  <>
  <Modal
    isOpen={isActuallyOpen}
    toggle={this.closeModal}
    className={styles.resultsModal}
  >
    <ModalHeader toggle={this.closeModal} className={styles.modalHeader}>
      <div className={styles.modalHeaderContent}>
        <div className={styles.modalHeaderTitleBlock}>
          <h2 className={styles.modalTitle}>
            {viewMode === 'survey'
             ? `${surveyTitle ? `${surveyTitle}` : 'Survey Results'}`
              : 'Question Results'}
          </h2>
        </div>

        {viewMode === 'survey' && currentSurveyId && (
          <div className={styles.modalSubtitle}>
            <span className={styles.surveyIdMeta}>
              Survey ID:{' '}
              <a
                href={`/survey/${encodeURIComponent(currentSurveyId)}${this.getEffectiveSlug() ? `?session=${encodeURIComponent(this.getEffectiveSlug())}` : ''}`}
                className={styles.surveyIdLink}
              >
                {surveyIdAbbreviation || currentSurveyId}
              </a>
            </span>
            <FontAwesomeIcon
              icon={faBookmark}
              className={styles.biggerIcon}
              onClick={(e: React.MouseEvent<SVGSVGElement>) => {
                e.stopPropagation();
                this.toggleSurveyBookmark(currentSurveyId);
              }}
              color={
                this.state.bookmarkedSurveyIDs.includes(currentSurveyId) ? 'gold' : 'grey'
              }
              style={SURVEY_RESULTS_SURVEY_BOOKMARK_STYLE}
              title="Bookmark Survey ID"
            />
          </div>
        )}
        {viewMode === 'survey' && Array.isArray(surveyDocumentURLs) && surveyDocumentURLs.length > 0 && (
          <div className={styles.surveyDocUrls}>
            {surveyDocumentURLs.map((url: string, idx: number) => (
              <a
                key={idx}
                href={url}
                target='_blank'
                rel='noopener noreferrer'
                className={styles.surveyDocUrlLink}
                title={url}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} style={SURVEY_RESULTS_DOCUMENT_LINK_ICON_STYLE} />
                {url.length > 50 ? `${url.slice(0, 47)}...` : url}
              </a>
            ))}
          </div>
        )}
      </div>
      <div className={styles.modalHeaderControls}>
        {this.renderLockedResponsesToggle(lockedResponsesModel)}
        {renderSurveyResultsSyncStatusPanel({
          isSynced,
          isSyncingOrLoading,
          syncStatusText,
          showLongSyncNotice,
          syncDetailsOpen: !!this.state.syncDetailsOpen,
          syncDetailsStyle: resolveSurveyResultsSyncDetailsStyle(this.state.syncDetailsOpen),
          onToggleSyncDetails: () =>
            this.setState((prevState: SurveyResultsRecord) => buildSurveyResultsBooleanTogglePatch({
              prevState,
              stateKey: 'syncDetailsOpen',
            })),
          onManualRefresh: () => this.handleManualRefresh(),
          viewMode,
          showQuestionSpinner,
          questionProgress,
          questionColor,
          questionBarText,
          showResponseSpinner,
          responseProgress,
          responseColor,
          responseBarText,
          miniBarSpinnerStyle: SURVEY_RESULTS_MINI_BAR_SPINNER_STYLE,
          miniProgressStyle: SURVEY_RESULTS_MINI_PROGRESS_STYLE,
        })}
        {isDemoQuestionResults && (
          <div
            className={styles.demoResultsViewNav}
            aria-label="Demo results views"
            data-testid="ce-surveyresults-demo-view-nav"
          >
            {demoResultsViewOptions.map((option: SurveyResultsDemoViewOption) => {
              const isActiveView = demoResultsViewMode === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={[
                    styles.demoResultsViewButton,
                    isActiveView ? styles.demoResultsViewButtonActive : '',
                  ].filter(Boolean).join(' ')}
                  aria-pressed={isActiveView}
                  data-testid={`ce-surveyresults-demo-view-${option.key}`}
                  onClick={() => this.handleDemoResultsViewSelect(option.key)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </ModalHeader>

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
      {alertMessage && !filterLoading && (
        <Alert color="info" className={styles.alertMessage} fade={false}>
          {alertMessage}
        </Alert>
      )}

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

      {renderSurveyResultsFilterSummary({
        displayedTotalQuestionsCount,
        displayedTotalResponsesCount,
        normalizedFilteredQuestionsCount,
        normalizedFilteredResponsesCount,
        filterLoading,
        areSummaryCountsHydrated,
      })}

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
                void Promise.resolve().then(afterApply).then(resolve, reject);
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
