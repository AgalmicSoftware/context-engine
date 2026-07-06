/** @file SurveyResults.tsx */

import React, { useLayoutEffect, useReducer, useRef } from 'react';
import { connect } from 'react-redux';
import {
  Form,
  Card,
  CardHeader,
  CardBody,
  FormText,
  InputGroup,
  InputGroupText,
  Collapse
} from 'reactstrap';


import "../../assets/css/contextEngine.scss";
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
  faExclamationCircle
} from '@fortawesome/free-solid-svg-icons';

import {
  getAllSessionSlugs,
  getSessionConfigBySlug,
} from '../../utilities/web3/contractScripts.js';
import { getShortenedAddress, getShortenedSurveyID } from 'utilities/ui/displayHelpers.js';
import { serializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { createLogger } from 'utilities/logging.js';
import {
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
} from '../../utilities/survey/questionRouting.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { buildResponseGatePolicy } from '../../utilities/crypto/litGatePolicy.js';
import { resolveSbtDisplayLabel } from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import { isDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
import {
  resolveSurveyResultsExplicitSessionSlug,
  resolveSurveyResultsQuestionReadScope,
  resolveSurveyResultsSessionContext,
  scanSurveyResultsSessionSlugFromCache,
} from './surveyResultsSessionResolution.js';
import {
  normalizeSurveyResultsBlockNumber,
  readSurveyResultsLatestBlock,
  type SurveyResultsLatestBlockMap,
} from './surveyResultsBlockNumbers.js';
import {
  buildSurveyResultsAlertMessagePatch,
  buildSurveyResultsBookmarkFeedbackPatch,
  buildSurveyResultsBookmarkedQuestionIdsPatch,
  buildSurveyResultsBookmarkedSurveyIdsPatch,
  buildSurveyResultsBooleanTogglePatch,
  buildSurveyResultsCommittedFilterStatePatch,
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
  buildSurveyResultsFilteredResponsesPatchPlan,
  buildSurveyResultsIndividualResponseAggregator,
  buildSurveyResultsKeyedTogglePatch,
  buildSurveyResultsLockedResponsesDecryptCompletePatch,
  buildSurveyResultsLockedResponsesDecryptingPatch,
  buildSurveyResultsLocalStoragePollPatch,
  buildSurveyResultsNetworkLatestBlockPatch,
  buildSurveyResultsQuestionIdSortPatch,
  buildSurveyResultsQuestionFilterCountPatch,
  buildSurveyResultsQuestionFilterPatch,
  buildSurveyResultsQuestionFilterQuestions,
  buildSurveyResultsQuestionScopeResetPatch,
  buildSurveyResultsRefreshStatusSequencePlan,
  buildSurveyResultsSurveyIdPropChangePatch,
  buildSurveyResultsSurveyIdStateChangePatch,
  buildSurveyResultsSurveyModeHydratedPatch,
  buildSurveyResultsSurveyViewModePatch,
  buildSurveyResultsUnfilteredQuestionModeHydratedPatch,
  buildSurveyResultsViewModeResetPatch,
  buildSurveyResultsViewStatePatch,
  buildSurveyRespondersPayloadRefSignature,
  buildSurveyRespondersSignature,
  countQuestionModeResponses,
  getSurveyResponseAggregateTimestampMs,
  getSurveyResponseQuestionId,
  hasAnyCountableSurveyAnswer,
  normalizeSurveyResponsePayloadByQuestionId,
  stableSerializeSignatureValue,
  stringifySurveyResultsAggregatorResponses,
  toggleSurveyResultsLockedResponseDetailsPatch,
  type SurveyResultsAggregateRow,
  type SurveyResultsFilterQuestionRecord,
  type SurveyResultsIndividualAggregator,
  type SurveyResultsStringifiedAggregator,
  type SurveyResultsSurveyResponsePayload,
} from './surveyResultsHelpers.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { isResponseAllowedForSessionSlug } from '../../utilities/session/responseSessionScope.js';
import {
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import {
  SurveyResultsLockedResponsesBanner,
  SurveyResultsLockedResponsesToggle,
} from './SurveyResultsLockedResponsesPanel';
import {
  buildSurveyResultsQuestionTableEntries,
  type SurveyResultsQuestionTableEntry,
} from './surveyResultsSummaryModels';
import {
  renderSurveyResultsSyncStatusPanel,
} from './SurveyResultsPanels';
import {
  isSurveyResultsStateSynced,
} from './surveyResultsSyncHelpers.js';
import {
  createInitialSurveyResultsState,
  preserveSurveyResultsFilterStateValue,
  surveyResultsReducer,
} from './surveyResultsState';
import type { SurveyResultsStateUpdate } from './surveyResultsState';
import {
  SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS as DEFAULT_HTML_REPORT_SELECTED_SECTIONS,
} from './surveyResultsHtmlReportSelection.js';
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
import type {
  SurveyResultsHtmlReportSectionKey,
} from './surveyResultsHtmlReportReadiness.js';
import {
  buildSurveyResultsDemoAnalysisArtifact,
} from './surveyResultsDemoAnalysisArtifact.js';
import {
  buildSurveyResultsQuestionsCsvExport,
  buildSurveyResultsQuestionsJsonExport,
  buildSurveyResultsExportBaseFileName,
  buildSurveyResultsExportControlsDisplayDescriptor,
  buildSurveyResultsResponsesCsvExport,
  buildSurveyResultsResponsesJsonExport,
} from './surveyResultsExportPlans.js';
import {
  buildSurveyResultsFilteredQuestionIdsForExport,
  buildSurveyResultsFilteredQuestionsForExport,
  type SurveyResultsQuestionExportRecord,
} from './surveyResultsExportRows.js';
import {
  buildSurveyResultsCacheReadinessDisplayPlan,
} from './surveyResultsCacheReadinessDisplayPlan';
import {
  buildSurveyResultsCacheControllerSnapshot,
} from './surveyResultsCacheControllerSnapshot';
import {
  buildSurveyResultsAnalysisArtifactWritePlan,
  buildSurveyResultsAnalysisArtifactWriteReadinessPlan,
  buildSurveyResultsFilterBookmarkWritePlan,
  buildSurveyResultsSurveyQuestionBookmarkWritePlan,
  type SurveyResultsFilterBookmarkWritePlan,
} from './surveyResultsCacheWriteEligibilityPlan';
import {
  buildSurveyResultsAnalysisArtifactCacheKey,
  buildSurveyResultsAnalysisArtifactCacheReadRequestPlan,
  type SurveyResultsAnalysisArtifactCacheReadPort,
} from './surveyResultsAnalysisArtifactCachePorts';
import {
  buildSurveyResultsBookmarksCacheReadRequest,
} from './surveyResultsBookmarkCacheReadPorts';
import {
  runSurveyResultsAnalysisArtifactReadController,
} from './surveyResultsAnalysisArtifactReadController';
import {
  runSurveyResultsAnalysisArtifactWriteController,
} from './surveyResultsAnalysisArtifactWriteController';
import {
  buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan,
  runSurveyResultsAnalysisGeneratedArtifactCompletion,
  type SurveyResultsAnalysisGeneratedArtifactCompletionPlan,
} from './surveyResultsAnalysisGeneratedArtifactCompletionPlan';
import {
  buildSurveyResultsAnalysisLifecyclePlan,
} from './surveyResultsAnalysisLifecyclePlan';
import {
  runSurveyResultsAnalysisLifecycleController,
  type SurveyResultsAnalysisLifecycleStatePatchPort,
} from './surveyResultsAnalysisLifecycleController';
import {
  runSurveyResultsFilterBookmarkWriteController,
} from './surveyResultsFilterBookmarkWriteController';
import {
  runSurveyResultsSurveyQuestionBookmarkWriteController,
} from './surveyResultsSurveyQuestionBookmarkWriteController';
import {
  runSurveyResultsManualRefreshDispatchController,
} from './surveyResultsManualRefreshController';
import {
  runSurveyResultsManualRefreshStatusApplicationController,
} from './surveyResultsManualRefreshStatusApplicationController';
import {
  surveyResultsHtmlReportExporterPort,
} from './surveyResultsHtmlReportExporterPort';
import {
  surveyResultsAnalysisGenerationPort,
} from './surveyResultsAnalysisGenerationPort';
import {
  runSurveyResultsQueuedRefreshController,
} from './surveyResultsQueuedRefreshController';
import {
  buildSurveyResultsHtmlReportDownloadExecutionPlan,
} from './surveyResultsHtmlReportDownloadRequest';
import {
  buildSurveyResultsHtmlReportParticipantCount,
  buildSurveyResultsHtmlReportQuestionsForExport,
  buildSurveyResultsHtmlReportResponseCountsByQuestion,
} from './surveyResultsHtmlReportDataModel';
import {
  buildSurveyResultsHtmlReportSnapshot,
} from './surveyResultsHtmlReportSnapshotDataModel';
import {
  buildSurveyResultsLockedRows,
} from './surveyResultsLockedResponsesModel';
import {
  buildSurveyResultsLockedGateDetails,
} from './surveyResultsLockedGateDetailsModel';
import {
  buildLockedResponseSignature,
  extractEnvelopeCandidate,
  hasOwn,
  isBannerEligibleLockedField,
  isLockedEncryptedField,
  normalizeGateSbtEntries,
  normalizeGateText,
  type SurveyResultsEncryptedFieldRecord,
  type SurveyResultsGateRecord,
  type SurveyResultsResponseRecord,
} from './surveyResultsLockedFieldHelpers';
import {
  buildSurveyResultsAnalysisResponsesForExport,
  buildSurveyResultsAnalysisSegmentDimensionsForExport,
  readSurveyResultsAnalysisSafeLabel,
} from './surveyResultsAnalysisDataModel';
import {
  buildSurveyResultsHtmlReportModalProps,
} from './surveyResultsHtmlReportModalProps';
import {
  getSurveyResultsQuestionCardDomId,
} from './surveyResultsQuestionSummaryStatusController';
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
  type SurveyResultsQuestionResponsesByResponder,
  type SurveyResultsScopedQuestionNetworkData,
  type SurveyResultsScopedQuestionNetworkMemo,
} from './surveyResultsQuestionNetworkReadController';
import {
  normalizeSurveyResultsQuestionModeCache,
} from './surveyResultsQuestionModeCacheNormalizationController';
import {
  applySurveyResultsBuiltInDemoQuestionMetadataFallbackToBucket,
  isSurveyResultsDemoQuestionResultsContext,
} from './surveyResultsDemoQuestionFallback';
import {
  surveyResultsCachePort,
} from '../../domains/surveys/surveyResultsCachePort';
import {
  surveyResultsAnalysisArtifactMergePort,
} from '../../domains/surveys/surveyResultsAnalysisArtifactMergePort';
import {
  cryptoGatePort,
  type CryptoGateDecryptOptions,
} from '../../domains/crypto/cryptoGatePort';
import {
  createSurveyResultsFetchResponsesRuntime,
  type SurveyResultsFetchResponsesRuntime,
} from '../../domains/surveys/surveyResultsFetchResponsesRuntime';
import {
  createSurveyResultsLocalStoragePollingRuntime,
  type SurveyResultsLocalStoragePollingRuntime,
} from '../../domains/surveys/surveyResultsLocalStoragePollingRuntime';
import {
  buildSurveyResultsLocalStoragePollCountPlan,
  buildSurveyResultsLocalStoragePollPatchPlan,
} from './surveyResultsLocalStoragePollDecision';
import {
  buildSurveyResultsDemoSurfaceProps,
  createSurveyResultsDemoSurfaceParentProps,
} from './surveyResultsDemoSurfaceProps';
import {
  createSurveyResultsQueuedRefreshRuntime,
  type SurveyResultsQueuedRefreshRuntime,
} from '../../domains/surveys/surveyResultsQueuedRefreshRuntime';
import {
  chainScanReadsPort,
} from '../../domains/chain/contractScriptsChainScanReadsPort';
import {
  runSurveyResultsBrowserDownload,
  runSurveyResultsExportController,
} from './surveyResultsExportController.js';
import {
  buildSessionResultsAnalysisAiPayload,
  buildSessionResultsAnalysisInputSignature,
  buildSessionResultsAnalysisPrompt,
  evaluateSessionResultsAnalysisEligibility,
  SESSION_RESULTS_ANALYSIS_SECTION_KEYS,
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  shortenSessionResultsAddress,
  type SessionResultsAnalysisSectionKey,
  type SessionResultsExportFormat,
  type SessionResultsGeneratedAnalysisArtifact,
  type SessionResultsHtmlSnapshot,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import type { SurveyResultsDisplayPanelsArgs } from './SurveyResultsDisplayPanels';
import { renderSurveyResultsFilterExportControls } from './SurveyResultsFilterExportControls';
import type { QuestionFilterHandle } from './QuestionFilter';
import {
  renderSurveyResultsHtmlReportExportModal,
  type SurveyResultsHtmlReportExportModalProps,
} from './SurveyResultsHtmlReportExportModal';
import SurveyResultsReportSurface from './SurveyResultsReportSurface';
import SurveyResultsQuestionSummary from './SurveyResultsQuestionSummary';
import SurveyResultsQuestionTable from './SurveyResultsQuestionTable';

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
type SurveyResultsAnalysisPayloadForAi = ReturnType<typeof buildSessionResultsAnalysisAiPayload> & {
  eligibility: ReturnType<typeof evaluateSessionResultsAnalysisEligibility>;
  inputSignature: string;
};
type SurveyResultsHtmlReportExporterMetadata = {
  address: string;
  chainId: number | null;
  displayAddress: string;
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
type SurveyResultsFiltersCache = SurveyResultsRecord & {
  bookmarkedFilters?: unknown;
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
type SurveyResultsSessionConfigRecord = SurveyResultsRecord & {
  __registry?: SurveyResultsRecord & { chainId?: unknown };
  networkChainId?: number | string | null;
  sponsored?: SurveyResultsRecord & { gates?: unknown };
};
type SurveyResultsLockedResponseKeyArgs = {
  questionId?: unknown;
  responder?: unknown;
  response?: SurveyResultsResponseRecord | null;
  surveyId?: unknown;
};
type SurveyResultsSurveyBucketRecord = SurveyResultsRecord & {
  surveyResponses?: Record<string, SurveyResultsRecord>;
  surveyResponsesLatestBlock?: SurveyResultsLatestBlockMap;
  surveys?: Record<string, SurveyResultsRecord & { documentURLs?: unknown; questionIDs?: unknown; title?: string }>;
  surveysLatestBlock?: unknown;
};
type SurveyResultsManagedCacheUpdate = {
  namespace?: unknown;
};
type SurveyResultsQuestionFilterCombinedPayload = SurveyResultsRecord & {
  filteredQuestions?: unknown;
  filteredResponsesByQuestion?: unknown;
};
type SurveyResultsPollingCountOptions = {
  forceScan?: boolean;
};
type SurveyResultsResponseListEntry = SurveyResultsRecord & {
  response?: (SurveyResultsRecord & { responses?: SurveyResultsRecord[] }) | null;
  responder: string;
  surveyId?: unknown;
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
type SurveyResultsDemoViewOption = {
  key: string;
  label: string;
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
const toSurveyResultsRecord = (value: unknown): SurveyResultsRecord => (
  value && typeof value === 'object' ? value as SurveyResultsRecord : {}
);
const normalizeNextSurveyResultsFilterState = (
  nextFilterState: unknown,
  fallbackFilterState: unknown = {}
): SurveyResultsFilterState => (
  nextFilterState && typeof nextFilterState === 'object'
    ? nextFilterState as SurveyResultsFilterState
    : preserveSurveyResultsFilterStateValue(fallbackFilterState)
);
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
const asSurveyResultsStatePatch = (patch: unknown): SurveyResultsState => (
  patch as SurveyResultsState
);
const asSurveyResultsStateUpdater = (
  updater: (prevState: SurveyResultsState) => unknown
): ((
  prevState: Readonly<SurveyResultsState>
) => SurveyResultsState) => (
  updater as (
    prevState: Readonly<SurveyResultsState>
  ) => SurveyResultsState
);
const resolveSbtDisplayLabelForSurveyResults: SurveyResultsSbtDisplayLabelResolver = (args) => (
  (resolveSbtDisplayLabel as unknown as SurveyResultsSbtDisplayLabelResolver)(args)
);

const HTML_REPORT_SECTION_TO_ANALYSIS_SECTION: Partial<Record<SurveyResultsHtmlReportSectionKey, SessionResultsAnalysisSectionKey>> = {
  argumentMap: 'argumentMap',
  atlas: 'atlas',
  report: 'breakdown',
  riskMatrix: 'riskMatrix',
};
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

function applyExistingGroupPrefix(newPath: string): string {
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

const normalizeNonceKey = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getFilterStateSignature = (
  filterState: unknown
): string => serializeFilterState(filterState as SurveyResultsFilterState | null | undefined) || '';
const areValuesEquivalentBySignature = (currentValue: unknown, nextValue: unknown): boolean => {
  if (currentValue === nextValue) return true;
  if (currentValue == null || nextValue == null) return currentValue === nextValue;
  if (typeof currentValue !== 'object' && typeof nextValue !== 'object') {
    return currentValue === nextValue;
  }
  return stableSerializeSignatureValue(currentValue) === stableSerializeSignatureValue(nextValue);
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


type SurveyResultsInstanceFields = {
  _syncLoadingStartedAt: number | null;
  _scrollMutationObserver: MutationObserver | null;
  _scrollToQuestionRetryTimer: ReturnType<typeof setTimeout> | null;
  _isMounted: boolean;
  _questionFilterQuestionsMemo: SurveyResultsQuestionFilterQuestionsMemo;
  _questionTableEntriesMemo: SurveyResultsQuestionTableEntriesMemo;
  _lockedResponsesModelMemo: SurveyResultsLockedResponsesModelMemo;
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
  _bookmarkFeedbackTimer: ReturnType<typeof setTimeout> | null;
  _stableFallbackQuestions: SurveyResultsFallbackQuestionBuckets | null;
  csvFileName: string;
};

const createSurveyResultsInstanceFields = (): SurveyResultsInstanceFields => ({
  _syncLoadingStartedAt: null,
  _scrollMutationObserver: null,
  _scrollToQuestionRetryTimer: null,
  _isMounted: false,
  _questionFilterQuestionsMemo: {
      questionResponsesRef: null,
      networkQuestionsRef: null,
      questionResponsesNonceKey: null,
      questionsCacheNonceKey: null,
      result: [],
    },
  _questionTableEntriesMemo: {
      questionMapRef: null,
      networkQuestionsRef: null,
      sortBy: '',
      sortAsc: true,
      result: [],
    },
  _lockedResponsesModelMemo: {
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
    },
  _lastLocalStoragePollCoarseSignature: '',
  _lastLocalStoragePollDetailedSignature: '',
  _lastPolledQuestionsRef: null,
  _lastPolledSurveyResponsesRef: null,
  _lastPolledQuestionRefVersion: 0,
  _lastPolledSurveyResponsesRefVersion: 0,
  _pollQuestionCountMemo: {
      questionsRef: null,
      count: 0,
    },
  _scopedQuestionNetworkDataSyncMemo: {
      viewMode: '',
      netIdStr: '',
      slugsKey: '',
      bucketRefs: [],
      result: EMPTY_SCOPED_QUESTION_NETWORK_DATA,
    },
  _pollSurveyResponsesCountMemo: {
      surveyId: '',
      responsesRef: null,
      count: 0,
    },
  _nonceTickInFlight: false,
  _nonceTickQueued: false,
  _pollLatestBlockFetchInFlight: false,
  _pollLatestBlockLastAttemptAt: 0,
  _responseParseMemo: new Map(),
  _surveyModeSourceSignature: '',
  _surveyModeSourceCoarseSignature: '',
  _surveyModeSourcePayloadRefSignature: '',
  _surveyModeSourceCacheNonce: 0,
  _individualResponsesAggregatorMemo: {
      responsesRef: null,
      result: {},
    },
  _aggregatorEntriesMemo: {
      aggregatorRef: null,
      entries: [],
    },
  _polisQuestionResponsesMemo: {
      selected: false,
      sourceRef: null,
      result: null,
    },
  _effectiveSlugScanMemo: {
      surveyId: '',
      nonceKey: '',
      slug: '',
    },
  _surveysCacheChangeNonce: 0,
  _unsubscribeCacheUpdates: null,
  _lastNotifiedFilterStateSignature: null,
  _pendingFilterLoadingValue: null,
  _bookmarkFeedbackTimer: null,
  _stableFallbackQuestions: null,
  csvFileName: '',
});

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
    instRef.current = createSurveyResultsInstanceFields();
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
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions'
  ): SurveyResultsQuestionReadScopeContext {
    return resolveQuestionReadScopeContextFor({ viewMode });
  }

function getQuestionReadSlugs(viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions'): string[] {
    const scopeContext = getQuestionReadScopeContext(viewMode);
    const scopedSlugs = Array.isArray(scopeContext?.questionReadSlugs)
      ? scopeContext.questionReadSlugs
      : [];
    return scopedSlugs.length > 0 ? scopedSlugs : [getEffectiveSlug()];
  }

function getQuestionFilterStorageKeyPrefix(
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions'
  ): string {
    return getQuestionReadScopeContext(viewMode).storageKeyPrefix;
  }

function shouldRequireAuthoritativeQuestionScope(
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions'
  ): boolean {
    if (String(viewMode || '').trim().toLowerCase() !== 'questions') return false;
    if (typeof window === 'undefined') return false;
    // Embedded one-page session results already pass an explicit pinned session slug.
    // Requiring authoritative metadata here hides legacy cache-backed questions that
    // pile view and the inline Polis report are already rendering from the same bucket.
    if (propsRef.current.preventUrlChange && propsRef.current.sessionSlugPinned) return false;
    return hasExplicitSessionQueryPinInPath(`${window.location.pathname || ''}${window.location.search || ''}`);
  }

function buildQuestionResultsScopeResetPatch(): SurveyResultsRecord {
    return buildSurveyResultsQuestionScopeResetPatch();
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
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions'
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
        readQuestionBucket: (slug, networkId) => applyBuiltInDemoQuestionMetadataFallbackToBucket(
          resolveNetBucketReadOnly(
            surveyResultsCachePort.peekCacheSync('questionsCache', slug, { clone: false }) || {},
            networkId,
            {
              questionsLatestBlock: 0,
              questions: {},
              questionResponses: {},
              questionResponsesLatestBlock: 0,
            }
          ) as SurveyResultsQuestionBucketRecord,
          slug,
          viewMode
        ),
      },
    });
    if (!controllerResult.memoHit && controllerResult.memo) {
      inst._scopedQuestionNetworkDataSyncMemo = controllerResult.memo;
    }
    return controllerResult.result;
  }

async function getScopedQuestionNetworkData(
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions'
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
            {}
          ) as SurveyResultsQuestionBucketRecord;
          return Object.keys(bucket || {}).length > 0
            ? applyBuiltInDemoQuestionMetadataFallbackToBucket(bucket, slug, viewMode)
            : bucket;
        },
        readQuestionBucket: async (slug, networkId) => applyBuiltInDemoQuestionMetadataFallbackToBucket(
          resolveNetBucketReadOnly(
            (await surveyResultsCachePort.readCache('questionsCache', slug)) || {},
            networkId,
            {
              questionsLatestBlock: 0,
              questions: {},
              questionResponses: {},
              questionResponsesLatestBlock: 0,
            }
          ) as SurveyResultsQuestionBucketRecord,
          slug,
          viewMode
        ),
      },
    });
    return controllerResult.result;
  }

const appendSessionHintToSurveyPath = (pathIn: unknown = ''): string => {
    const path = String(pathIn || '');
    if (!path || hasExplicitSessionQueryPinInPath(path)) return path;
    const pathOnly = path.split('?')[0];
    const isSessionAwarePath = (
      pathOnly.includes('/survey/') ||
      pathOnly.startsWith('/questions') ||
      pathOnly.startsWith('/question/')
    );
    if (!isSessionAwarePath) return path;
    const slug = getEffectiveSlug();
    if (!slug) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}session=${encodeURIComponent(slug)}`;
  };

function getMemoizedQuestionFilterQuestions(
    networkQuestionsById: Record<string, SurveyResultsFilterQuestionRecord> = {}
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

function commitResultsFilterState(statePatch: SurveyResultsRecord | null | undefined, nextFilterState: unknown): void {
    const patch: SurveyResultsRecord = (statePatch && typeof statePatch === 'object') ? statePatch : {};
    const normalizedFilterState = normalizeNextSurveyResultsFilterState(
      nextFilterState,
      stateRef.current.filterState
    );
    const filterStateChanged = !areValuesEquivalentBySignature(
      stateRef.current.filterState,
      normalizedFilterState
    );
    const patchChanged = Object.keys(patch).some((key) => (
      !areValuesEquivalentBySignature(stateRef.current[key], patch[key])
    ));
    if (!filterStateChanged && !patchChanged) return;
    setState(
      asSurveyResultsStatePatch(buildSurveyResultsCommittedFilterStatePatch({
        filterState: normalizedFilterState,
        statePatch: patch,
      })),
      () => notifyFilterStateCommitted(stateRef.current.filterState)
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
      const latest = await chainScanReadsPort.getLatestBlockNumber(propsRef.current.provider as string | undefined, slug);
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
      setState(
        asSurveyResultsStatePatch(refreshStatusSequencePlan.statePatch),
        () => {
          // Re-read localStorage derived counters and repaint from cache immediately
          pollLocalStorageForUpdates();
          resetLocalStoragePollingBackoff('nonce-tick');
          queueResultsRefresh('nonce-tick');
        }
      );
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
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions'
  ): boolean => (
    isSurveyResultsDemoQuestionResultsContext({
      effectiveSlug: getEffectiveSlug(),
      viewMode,
    })
  );

const applyBuiltInDemoQuestionMetadataFallbackToBucket = (
    bucket: SurveyResultsQuestionBucketRecord | null | undefined,
    bucketSlug: unknown = '',
    viewMode: unknown = stateRef.current.viewMode || propsRef.current.viewMode || 'questions'
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
    setState(asSurveyResultsStateUpdater((prevState) => buildSurveyResultsDemoViewSelectPatch({
      nextView,
      prevState,
    })));
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
    let newSurveyId = stateRef.current.surveyId;  // Default to current

    const surveyResultsRegex = /^\/survey\/([0-9a-fA-FxX]{66})\/results/;
    const surveyMatch = path.match(surveyResultsRegex);

    const questionResultsRegex = /^\/questions\/results/;
    const questionMatch = path.match(questionResultsRegex);

    if (surveyMatch) {
        newViewMode = "survey";
        newSurveyId = surveyMatch[1]; // surveyID from URL
    } else if (questionMatch) {
        newViewMode = "questions";
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

const maybeRefreshNetworkLatestBlockFromPolling = (): void => {
    if (normalizeSurveyResultsBlockNumber(stateRef.current.networkLatestBlock) > 0) return;
    if (inst._pollLatestBlockFetchInFlight) return;
    const now = Date.now();
    if (
      inst._pollLatestBlockLastAttemptAt > 0 &&
      (now - inst._pollLatestBlockLastAttemptAt) < LATEST_BLOCK_POLL_THROTTLE_MS
    ) {
      return;
    }
    inst._pollLatestBlockLastAttemptAt = now;
    inst._pollLatestBlockFetchInFlight = true;
    const slug = getEffectiveSlug();
    chainScanReadsPort
      .getLatestBlockNumber(propsRef.current.provider as string | undefined, slug)
      .then((blk: unknown) => {
        if (!inst._isMounted) return;
        const parsed = normalizeSurveyResultsBlockNumber(blk);
        const currentLatestBlock = normalizeSurveyResultsBlockNumber(stateRef.current.networkLatestBlock);
        if (parsed > 0 && parsed !== currentLatestBlock) {
          setState(asSurveyResultsStatePatch(buildSurveyResultsNetworkLatestBlockPatch(parsed)));
        }
      })
      .catch((e: unknown) => { surveyLog.warn('SurveyResults: fallback', e); })
      .finally(() => {
        inst._pollLatestBlockFetchInFlight = false;
      });
  };

const getMemoizedQuestionsCountForPolling = (
    questionsById: unknown,
    options: SurveyResultsPollingCountOptions = {}
  ): number => {
    const ref: SurveyResultsRecord = questionsById && typeof questionsById === 'object'
      ? questionsById as SurveyResultsRecord
      : {};
    const forceScan = options && options.forceScan === true;
    const memo = inst._pollQuestionCountMemo;
    if (!forceScan && memo.questionsRef === ref) return memo.count;
    const nextCount = measureSync(
      forceScan
        ? 'ce.surveyResults.poll.questionsCountForcedScan'
        : 'ce.surveyResults.poll.questionsCountScan',
      () => Object.keys(ref).length
    ) as number;
    inst._pollQuestionCountMemo = {
      questionsRef: ref,
      count: nextCount,
    };
    return nextCount;
  };

const getMemoizedSurveyResponsesCountForPolling = (
    surveyResponsesById: unknown,
    surveyId: unknown,
    options: SurveyResultsPollingCountOptions = {}
  ): number => {
    const sid = String(surveyId || '').toLowerCase();
    if (!sid) {
      inst._pollSurveyResponsesCountMemo = {
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
    const memo = inst._pollSurveyResponsesCountMemo;
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
    inst._pollSurveyResponsesCountMemo = {
      surveyId: sid,
      responsesRef,
      count: nextCount,
    };
    return nextCount;
  };

function pollLocalStorageForUpdates(): boolean {
  return measureSync('ce.surveyResults.pollLocalStorageForUpdates', () => {
    if (!hasEffectiveNetworkId()) return false;
    const slug = getEffectiveSlug();
    const netIdStr = String(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? '');
    if (!netIdStr) return false;
    const currentSurveyId = stateRef.current.viewMode === 'survey'
      ? String(stateRef.current.surveyId || '').toLowerCase()
      : '';

    const questionNetCache: SurveyResultsQuestionBucketRecord = (
      stateRef.current.viewMode === 'questions'
        ? getScopedQuestionNetworkDataSync('questions')
        : resolveNetBucketReadOnly(
            surveyResultsCachePort.peekCacheSync('questionsCache', slug, { clone: false }) || {},
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
      const surveysCache = surveyResultsCachePort.peekCacheSync('surveysCache', slug, { clone: false }) || {};
      surveyNetCache = resolveNetBucketReadOnly(surveysCache, netIdStr, {
        surveys: {},
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
        surveysLatestBlock: 0,
      }) as SurveyResultsSurveyBucketRecord;
      surveyResponsesById = surveyNetCache.surveyResponses || {};
    }
    if (inst._lastPolledQuestionsRef !== questionsById) {
      inst._lastPolledQuestionsRef = questionsById;
      inst._lastPolledQuestionRefVersion += 1;
    }
    if (inst._lastPolledSurveyResponsesRef !== surveyResponsesById) {
      inst._lastPolledSurveyResponsesRef = surveyResponsesById;
      inst._lastPolledSurveyResponsesRefVersion += 1;
    }

    // Keep retrying latest-block fetches even when local cache signatures are stable.
    let netLatest = normalizeSurveyResultsBlockNumber(stateRef.current.networkLatestBlock);
    if (!netLatest) {
      maybeRefreshNetworkLatestBlockFromPolling();
      netLatest = 0;
    }

    const localQBlock = normalizeSurveyResultsBlockNumber(questionNetCache.questionsLatestBlock);
    const localRespBlock = normalizeSurveyResultsBlockNumber(questionNetCache.questionResponsesLatestBlock);
    const localSBlock = currentSurveyId
      ? readSurveyResultsLatestBlock(surveyNetCache?.surveyResponsesLatestBlock, currentSurveyId)
      : 0;

    const fetchRuntimeSnapshot = fetchResponsesRuntime.getSnapshot();
    const countPlan = buildSurveyResultsLocalStoragePollCountPlan({
      currentSurveyId,
      fetchInFlight: fetchRuntimeSnapshot.inFlight,
      forceRescanEvery: LOCAL_STORAGE_FORCE_RESCAN_EVERY,
      localQBlock,
      localRespBlock,
      localSBlock,
      netLatest,
      previousCoarseSignature: inst._lastLocalStoragePollCoarseSignature,
      questionLocalBlock: stateRef.current.questionLocalBlock,
      questionRefVersion: inst._lastPolledQuestionRefVersion,
      responseLocalBlock: stateRef.current.responseLocalBlock,
      stableCycles: localStoragePollingRuntime.getStableCycles(),
      surveyLocalBlock: stateRef.current.surveyLocalBlock,
      surveyResponsesRefVersion: inst._lastPolledSurveyResponsesRefVersion,
      viewMode: stateRef.current.viewMode,
    });
    if (countPlan.shouldReturnFalseForInFlight) {
      return false;
    }

    const newQuestionsCount = countPlan.useCachedCounts
      ? Number(stateRef.current.cachedQuestionsCount || 0)
      : getMemoizedQuestionsCountForPolling(questionsById, {
          forceScan: countPlan.shouldForceCountRescan,
        });
    const localSurveyResponsesCount = currentSurveyId
      ? (
          countPlan.useCachedCounts
            ? Number(stateRef.current.cachedSurveyResponsesCount || 0)
            : getMemoizedSurveyResponsesCountForPolling(surveyResponsesById, currentSurveyId, {
                forceScan: countPlan.shouldForceCountRescan,
              })
        )
      : 0;
    const patchPlan = buildSurveyResultsLocalStoragePollPatchPlan({
      blockOrRespChanged: countPlan.blockOrRespChanged,
      cachedQuestionsCount: stateRef.current.cachedQuestionsCount,
      cachedSurveyResponsesCount: stateRef.current.cachedSurveyResponsesCount,
      coarseSignature: countPlan.coarseSignature,
      localQBlock,
      localRespBlock,
      localSBlock,
      localSurveyResponsesCount,
      netLatest: countPlan.netLatest,
      newQuestionsCount,
      previousDetailedSignature: inst._lastLocalStoragePollDetailedSignature,
    });
    if (patchPlan.shouldReturnFalseForUnchangedSignature) {
      return false;
    }
    inst._lastLocalStoragePollCoarseSignature = countPlan.coarseSignature;
    inst._lastLocalStoragePollDetailedSignature = patchPlan.detailedSignature;

    if (patchPlan.shouldApplyPatch && patchPlan.patch) {
      setState(
        asSurveyResultsStatePatch(buildSurveyResultsLocalStoragePollPatch(patchPlan.patch)),
        () => {
          queueResultsRefresh('poll-local-storage-change');
        }
      );
      return true;
    }

    return false;
  }) as boolean;
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

const isDemoPolisFixtureResponse = (responseData: unknown): boolean => (
  !!responseData &&
  typeof responseData === 'object' &&
  (responseData as SurveyResultsRecord).source === 'demo-polis-data'
);

const getNetworkQuestionsForCurrentContext = (
  _identity?: SurveyResultsQuestionMetadataReadIdentity
): Record<string, SurveyResultsQuestionRecord> => {
  const networkData = getScopedQuestionNetworkDataSync(
    stateRef.current.viewMode || propsRef.current.viewMode || 'questions'
  ) as SurveyResultsScopedQuestionNetworkData;
  return networkData.questions;
};

const getEffectiveNetworkId = (): unknown => (
  propsRef.current.network?.id ?? propsRef.current.networkChainId ?? ''
);

const hasEffectiveNetworkId = (): boolean => (
  String(getEffectiveNetworkId() ?? '').trim() !== ''
);

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
    const currentSurveyID = stateRef.current.surveyId ? stateRef.current.surveyId.toLowerCase() : null;

    // Use the robust slug resolver to ensure we read the correct cache
    const slug = getEffectiveSlug();
    const netIdStr = String(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? '');

    // Read the specific group's cache
    let surveysCache = (surveyResultsCachePort.peekCacheSync('surveysCache', slug, { clone: false }) || {}) as SurveyResultsRecord;
    if (!surveysCache || Object.keys(surveysCache).length === 0) {
      surveysCache = ((await surveyResultsCachePort.readCache('surveysCache', slug)) || {}) as SurveyResultsRecord;
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
      if (inst._surveyModeSourceSignature === emptySignature) {
        return;
      }
      inst._surveyModeSourceSignature = emptySignature;
      inst._surveyModeSourceCoarseSignature = emptySignature;
      inst._surveyModeSourcePayloadRefSignature = '';
      inst._surveyModeSourceCacheNonce = Number(inst._surveysCacheChangeNonce || 0);
      setState(asSurveyResultsStatePatch(buildSurveyResultsEmptySurveyModePatch()));
      return;
    }

    // In survey mode, show questions strictly belonging to this survey.
    const srMap = surveyNetCache.surveyResponses?.[currentSurveyID] || {};
    const allResponders = Object.keys(srMap);
    const networkQuestions = getNetworkQuestionsForCurrentContext();
    const questionIDsInSurvey: string[] = Array.isArray(surveyNetCache?.surveys?.[currentSurveyID]?.questionIDs)
      ? surveyNetCache.surveys[currentSurveyID].questionIDs as string[]
      : [];
    const questionIdsSignature = questionIDsInSurvey
      .map((qid) => String(qid || '').toLowerCase())
      .join('|');
    const surveyResponsesLatestBlock = readSurveyResultsLatestBlock(
      surveyNetCache?.surveyResponsesLatestBlock,
      currentSurveyID
    );
    const surveyDefinitionLatestBlock = normalizeSurveyResultsBlockNumber(surveyNetCache?.surveysLatestBlock);
    const surveyCacheChangeNonce = Number(inst._surveysCacheChangeNonce || 0);
    const questionCacheReadySignal = propsRef.current.isQuestionCacheReady ? 1 : 0;
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
    if (inst._surveyModeSourceSignature === sourceSignature) {
      inst._surveyModeSourceCoarseSignature = coarseSourceSignature;
      inst._surveyModeSourcePayloadRefSignature = payloadRefSignature;
      inst._surveyModeSourceCacheNonce = surveyCacheChangeNonce;
      return;
    }
    inst._surveyModeSourceCoarseSignature = coarseSourceSignature;
    inst._surveyModeSourcePayloadRefSignature = payloadRefSignature;
    inst._surveyModeSourceCacheNonce = surveyCacheChangeNonce;
    inst._surveyModeSourceSignature = sourceSignature;

    const aggregatorMap: Record<string, SurveyResultsAggregateRow[]> = {};
    const rawResponses: SurveyResultsResponseListEntry[] = [];
    allResponders.forEach((responder) => {
      const responderLower = String(responder || '').toLowerCase();
      const rawResp = normalizeSurveyResponsePayloadByQuestionId(
        parseResponse(srMap[responder])
      ) as SurveyResultsSurveyResponsePayload | null;
      if (!hasAnyCountableSurveyAnswer(rawResp, networkQuestions)) return;
      rawResponses.push({
        responder: responderLower,
        surveyId: currentSurveyID,
        response: rawResp as SurveyResultsResponseListEntry['response'],
      });
      if (!rawResp || !Array.isArray(rawResp.responses)) return;
      rawResp.responses.forEach((ans: SurveyResultsResponseRecord) => {
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
    let foundDocURLs: string[] = [];
    if (surveyNetCache?.surveys?.[currentSurveyID]) {
      foundTitle = surveyNetCache.surveys[currentSurveyID].title || '';
      foundDocURLs = Array.isArray(surveyNetCache.surveys[currentSurveyID].documentURLs)
        ? surveyNetCache.surveys[currentSurveyID].documentURLs as string[]
        : [];
    }

    // Initialize master and filtered views so UI renders immediately
    setState(asSurveyResultsStatePatch(buildSurveyResultsSurveyModeHydratedPatch({
      aggregateQuestionResponses: finalAggregator,
      filteredResponsesCount: rawResponses.length,
      responses: rawResponses,
      sbtFilteredAggregatorQuestionResponses: finalAggregator,
      sbtFilteredResponses: rawResponses,
      surveyDocumentURLs: foundDocURLs,
      surveyTitle: foundTitle,
      totalQuestionsCount: totalQCount,
      totalResponsesCount: totalRespondersCount,
    })));
  }

async function fetchQuestionModeResponses(): Promise<void> {
const netIdStr = String(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? '');
if (!netIdStr) return;
const questionNetCache = await getScopedQuestionNetworkData('questions') as SurveyResultsScopedQuestionNetworkData;
  const strictQuestionResponseSlug = isDemoSessionSlug(getEffectiveSlug()) ? getEffectiveSlug() : '';
  const normalizedQuestionModeCache = normalizeSurveyResultsQuestionModeCache({
    ports: {
      isDemoPolisFixtureResponse,
      isResponseAllowedForSessionSlug,
      parseResponse,
    },
    questionResponses: questionNetCache?.questionResponses || {},
    questions: questionNetCache?.questions || {},
    requiredSessionSlug: normalizeSessionSlug(strictQuestionResponseSlug),
  });
  const partialQR: SurveyResultsQuestionResponsesByQuestion = normalizedQuestionModeCache.questionResponses;
	const allQuestions = normalizedQuestionModeCache.questions;
	const aggregatorMap: Record<string, unknown> = {};

	Object.keys(partialQR).forEach((qId) => {
	  const lowerQ = qId.toLowerCase();
	  aggregatorMap[lowerQ] = aggregatorMap[lowerQ] || {};
		  const respondersMap: SurveyResultsQuestionResponsesByResponder = partialQR[qId] || {};

  Object.keys(respondersMap).forEach((rAddr) => {
    const rData = respondersMap[rAddr];
    const parsed = parseResponse(rData) as SurveyResultsRecord | null;
    if (isDemoPolisFixtureResponse(parsed)) return;
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
if (stateRef.current.isFilterActive) {
  setState(
    asSurveyResultsStatePatch(buildSurveyResultsFilteredQuestionModeHydratedPatch({
      aggregatorQuestionResponses: finalAggregator,
      currentFilteredQuestionsCount: stateRef.current.filteredQuestionsCount,
      currentFilteredResponsesCount: stateRef.current.filteredResponsesCount,
      initialFilteredCount,
      questionResponses: partialQR,
      sbtFilteredAggregatorQuestionResponses: stateRef.current.sbtFilteredAggregatorQuestionResponses,
      totalQuestionsCount: totalQ,
      totalResponsesCount: totalResponseCount,
    })),
    () => {
      // ask the QuestionFilter to re-apply its pipeline on the fresh data
      if (questionFilterRef && questionFilterRef.current) {
        try {
          questionFilterRef.current.handleApplyFilters(true);
        } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
      }
    }
  );
} else {
  // no active filters – reset filtered view to the full aggregator
  setState(asSurveyResultsStatePatch(buildSurveyResultsUnfilteredQuestionModeHydratedPatch({
    aggregatorQuestionResponses: finalAggregator,
    filteredResponsesCount: initialFilteredCount,
    questionResponses: partialQR,
    totalQuestionsCount: totalQ,
    totalResponsesCount: totalResponseCount,
  })));
}
}

const generateResponsesCSV = (): string => {
const { viewMode, surveyViewMode, sbtFilteredResponses, sbtFilteredAggregatorQuestionResponses } = stateRef.current;

if (!hasEffectiveNetworkId()) {
  setState(asSurveyResultsStatePatch(buildSurveyResultsAlertMessagePatch('Network not available for fetching question data.')));
  return '';
}
const networkQuestions = getNetworkQuestionsForCurrentContext();

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
  const sessionName = propsRef.current.sessionName;
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
  inst.csvFileName = suggested;
  if (typeof setState === 'function') {
    setState(asSurveyResultsStatePatch(buildSurveyResultsCsvFileNamePatch(suggested)));
  }
} catch (err) {
  surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to set CSV filename:', err);
  const fallback = `contextEngine_questionResponses_${tsName}.csv`;
  inst.csvFileName = fallback;
  try {
    if (typeof setState === 'function') {
      setState(asSurveyResultsStatePatch(buildSurveyResultsCsvFileNamePatch(fallback)));
    }
  } catch (innerErr) {
    surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to set fallback CSV filename:', innerErr);
  }
}

return buildSurveyResultsResponsesCsvExport({
  aggregatorQuestionResponses: sbtFilteredAggregatorQuestionResponses,
  filteredResponses: sbtFilteredResponses,
  networkQuestions,
  parseResponse,
  surveyViewMode,
  viewMode,
});
};

const generateResultsJSON = (): string => {
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
} = stateRef.current;

return buildSurveyResultsResponsesJsonExport({
    counts: {
      totalQuestions: totalQuestionsCount,
      filteredQuestions: filteredQuestionsCount,
      totalResponses: totalResponsesCount,
      filteredResponses: filteredResponsesCount,
    },
    exportedAt: new Date().toISOString(),
    filteredQuestionResponses: sbtFilteredAggregatorQuestionResponses || {},
    filteredQuestions: getFilteredQuestionsForExport(),
    filteredResponses: sbtFilteredResponses || [],
    filterState: filterState || {},
    sessionSlug: getEffectiveSlug() || '',
    surveyId: surveyId || null,
    surveyTitle: surveyTitle || '',
    surveyViewMode,
    viewMode,
  });
};

const getFilteredQuestionIdsForExport = (): string[] => {
return buildSurveyResultsFilteredQuestionIdsForExport({
  aggregatorQuestionResponses: stateRef.current.sbtFilteredAggregatorQuestionResponses,
  filteredResponses: stateRef.current.sbtFilteredResponses as SurveyResultsSummaryResponseRow[],
  getResponseQuestionId: (answer) => getResponseQuestionId(answer as SurveyResultsResponseRecord),
  parseResponse: (response) => parseResponse(response) as SurveyResultsResponseRecord | null,
});
};

const getFilteredQuestionsForExport = (): SurveyResultsQuestionExportRecord[] => {
const networkQuestions = getNetworkQuestionsForCurrentContext() as Record<string, SurveyResultsRecord | undefined>;
return buildSurveyResultsFilteredQuestionsForExport({
  networkQuestions,
  questionIds: getFilteredQuestionIdsForExport(),
});
};

const generateQuestionsJSON = (): string => {
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
} = stateRef.current;

return buildSurveyResultsQuestionsJsonExport({
    counts: {
      totalQuestions: totalQuestionsCount,
      filteredQuestions: filteredQuestionsCount,
      totalResponses: totalResponsesCount,
      filteredResponses: filteredResponsesCount,
    },
    exportedAt: new Date().toISOString(),
    filteredQuestions: getFilteredQuestionsForExport(),
    filterState: filterState || {},
    sessionSlug: getEffectiveSlug() || '',
    surveyId: surveyId || null,
    surveyTitle: surveyTitle || '',
    surveyViewMode,
    viewMode,
  });
};

const generateQuestionsCSV = (): string => {
if (!hasEffectiveNetworkId()) {
  setState(asSurveyResultsStatePatch(buildSurveyResultsAlertMessagePatch('Network not available for fetching question data.')));
  return '';
}

const filteredQuestions = getFilteredQuestionsForExport();
if (!filteredQuestions.length) {
  setState(asSurveyResultsStatePatch(buildSurveyResultsAlertMessagePatch('No filtered questions to export.')));
  return '';
}

return buildSurveyResultsQuestionsCsvExport(filteredQuestions);
};

const getHtmlReportChainId = (): number | null => {
const network = toSurveyResultsRecord(propsRef.current.network);
const chainId = Number(network.id ?? network.chainId);
return Number.isFinite(chainId) ? chainId : null;
};

const getHtmlReportNetworkLabel = (): string => {
const network = toSurveyResultsRecord(propsRef.current.network);
const chainId = getHtmlReportChainId();
const explicitLabel = String(network.name || network.label || network.network || '').trim();
if (explicitLabel) return explicitLabel;
if (chainId === 11155420) return 'OP Sepolia';
if (chainId === 84532) return 'Base Sepolia';
return chainId ? `Chain ${chainId}` : '';
};

const getHtmlReportResponseCountsByQuestion = (): Map<string, number> => {
return buildSurveyResultsHtmlReportResponseCountsByQuestion({
  aggregatorQuestionResponses: stateRef.current.sbtFilteredAggregatorQuestionResponses,
  filteredResponses: stateRef.current.sbtFilteredResponses,
  getResponseQuestionId: (answer) => getResponseQuestionId(toSurveyResultsRecord(answer) as SurveyResultsResponseRecord),
  parseResponse,
  surveyViewMode: stateRef.current.surveyViewMode,
  viewMode: stateRef.current.viewMode,
});
};

const getHtmlReportParticipantCount = (): number => {
return buildSurveyResultsHtmlReportParticipantCount({
  aggregatorQuestionResponses: stateRef.current.sbtFilteredAggregatorQuestionResponses,
  filteredResponses: stateRef.current.sbtFilteredResponses,
  surveyViewMode: stateRef.current.surveyViewMode,
  viewMode: stateRef.current.viewMode,
});
};

const getHtmlReportQuestionsForExport = () => {
const countsByQuestion = getHtmlReportResponseCountsByQuestion();
return buildSurveyResultsHtmlReportQuestionsForExport({
  filteredQuestions: getFilteredQuestionsForExport(),
  responseCountsByQuestion: countsByQuestion,
});
};

const isHtmlReportDemoSession = (): boolean => {
const candidates = [
  getEffectiveSlug(),
  propsRef.current.sessionSlug,
  propsRef.current.activeSessionSlug,
  stateRef.current.surveyTitle,
].map((value) => String(value || '').trim().toLowerCase());
return candidates.some((value) => isDemoSessionSlug(value));
};

const isHtmlReportDemoModeActive = (): boolean => (
  isHtmlReportDemoSession() && !!stateRef.current.htmlReportDemoMode
);

const getHtmlReportExporterMetadata = (): SurveyResultsHtmlReportExporterMetadata | null => {
if (isHtmlReportDemoModeActive()) {
  return {
    address: 'demo-preview',
    chainId: getHtmlReportChainId(),
    displayAddress: 'Demo preview',
  };
}
const account = String(propsRef.current.account || '').trim();
if (!propsRef.current.loginComplete || !account) return null;
return {
  address: account,
  chainId: getHtmlReportChainId(),
  displayAddress: shortenSessionResultsAddress(account),
};
};

const isHtmlReportExportAuthorized = (): boolean => !!getHtmlReportExporterMetadata();

const getHtmlReportSelectedSections = (): Required<SessionResultsSectionSelection> => ({
  ...DEFAULT_HTML_REPORT_SELECTED_SECTIONS,
  ...(stateRef.current.htmlReportSelectedSections || {}),
});

const getHtmlReportAnalysisArtifact = (): SessionResultsGeneratedAnalysisArtifact | null => {
const artifact = stateRef.current.htmlReportAnalysisArtifact as SessionResultsGeneratedAnalysisArtifact | null;
return artifact && artifact.kind ? artifact : null;
};

const applyHtmlReportAnalysisLifecycleStatePatch: SurveyResultsAnalysisLifecycleStatePatchPort = (patch) => {
setState(asSurveyResultsStatePatch(patch));
};

const buildHtmlReportDemoAnalysisArtifact = (): SessionResultsGeneratedAnalysisArtifact => {
const built = buildSessionResultsAnalysisPayloadForAi();
return buildSurveyResultsDemoAnalysisArtifact({
  analysisPayload: built,
  generatedAt: new Date().toISOString(),
  inputSignature: built.inputSignature,
});
};

const getSessionResultsAnalysisCacheSlug = (): string => getEffectiveSlug() || 'general';

const getSessionResultsAnalysisCacheKey = (inputSignature: unknown): string => (
buildSurveyResultsAnalysisArtifactCacheKey({
  chainId: getHtmlReportChainId(),
  inputSignature,
  networkLabel: getHtmlReportNetworkLabel(),
})
);

const readSessionResultsAnalysisArtifactFromCache = (
inputSignature: unknown
): SessionResultsGeneratedAnalysisArtifact | null => {
const cacheKey = getSessionResultsAnalysisCacheKey(inputSignature);
const readPlan = buildSurveyResultsAnalysisArtifactCacheReadRequestPlan({
  cacheKey,
  inputSignature,
  slug: getSessionResultsAnalysisCacheSlug(),
});
const readAnalysisCache: SurveyResultsAnalysisArtifactCacheReadPort = (namespace, cacheSlug, options) => (
  surveyResultsCachePort.peekCacheSync(namespace, cacheSlug, options)
);
const readResult = runSurveyResultsAnalysisArtifactReadController({
  ports: {
    readAnalysisArtifactCache: readAnalysisCache,
  },
  readRequest: readPlan.shouldRead ? readPlan.readRequest : null,
  target: readPlan.target,
});
return readResult.artifact;
};

const writeSessionResultsAnalysisArtifactToCache = async (
artifact: SessionResultsGeneratedAnalysisArtifact | null
): Promise<void> => {
const slug = getSessionResultsAnalysisCacheSlug();
const cacheKey = artifact ? getSessionResultsAnalysisCacheKey(artifact.inputSignature) : '';
const writeReadinessPlan = buildSurveyResultsAnalysisArtifactWriteReadinessPlan({
  artifact,
  cacheKey,
  inputSignature: artifact?.inputSignature || '',
  slug,
});
if (!writeReadinessPlan.shouldReadCache) return;
const current = toSurveyResultsRecord(await surveyResultsCachePort.readCache('analysisCache', slug));
const writePlan = buildSurveyResultsAnalysisArtifactWritePlan({
  artifact,
  cacheKey,
  currentCache: current,
  inputSignature: artifact?.inputSignature || '',
  slug,
});
if (!writePlan.shouldWrite || !writePlan.payload) return;
const writeResult = await runSurveyResultsAnalysisArtifactWriteController({
  plan: writePlan,
  ports: {
    writeAnalysisArtifact: (namespace, cacheSlug, payload) => (
      surveyResultsCachePort.writeCache(namespace, cacheSlug, payload)
    ),
  },
});
if (!writeResult.ok && writeResult.error) throw writeResult.error;
};

const getSessionResultsAnalysisResponsesForExport = () => {
return buildSurveyResultsAnalysisResponsesForExport({
  aggregatorQuestionResponses: stateRef.current.sbtFilteredAggregatorQuestionResponses,
  filteredResponses: stateRef.current.sbtFilteredResponses,
  getResponseQuestionId: (response) => getResponseQuestionId(toSurveyResultsRecord(response) as SurveyResultsResponseRecord),
  getResponseQuestionPrompt: (response, questionData) => getResponseQuestionPrompt(
    toSurveyResultsRecord(response) as SurveyResultsResponseRecord,
    toSurveyResultsRecord(questionData)
  ),
  getResponseQuestionType: (response, questionData) => getResponseQuestionType(
    toSurveyResultsRecord(response) as SurveyResultsResponseRecord,
    toSurveyResultsRecord(questionData)
  ),
  networkQuestions: getNetworkQuestionsForCurrentContext(),
  parseResponse,
  surveyViewMode: stateRef.current.surveyViewMode,
  viewMode: stateRef.current.viewMode,
});
};

const getSessionResultsAnalysisSbtEntryLabel = (entry: unknown): string => {
const record = toSurveyResultsRecord(entry);
const direct = readSurveyResultsAnalysisSafeLabel(
  record.label || record.name || record.title || record.sessionName || record.group || record.slug
);
if (direct) return direct;
const address = String(record.address || record.sbtAddress || (typeof entry === 'string' ? entry : '') || '').trim();
if (!address) return '';
const resolved = resolveSbtDisplayLabelForSurveyResults({
  address,
  chainId: getHtmlReportChainId(),
  fallback: 'short',
  preferredSlug: getEffectiveSlug() || '',
});
return readSurveyResultsAnalysisSafeLabel(resolved);
};

const getSessionResultsAnalysisSegmentDimensionsForExport = (): unknown[] => {
return buildSurveyResultsAnalysisSegmentDimensionsForExport({
  filterState: stateRef.current.filterState,
  getQuestionEncryptionGates: (question) => (
    getQuestionEncryptionGates(toSurveyResultsRecord(question) as SurveyResultsQuestionWithEncryption)
  ),
  getSbtEntryLabel: getSessionResultsAnalysisSbtEntryLabel,
  networkQuestions: getNetworkQuestionsForCurrentContext(),
  normalizeGateSbtEntries: (gate) => normalizeGateSbtEntries(toSurveyResultsRecord(gate) as SurveyResultsGateRecord),
  participantCount: getHtmlReportParticipantCount(),
  questions: getHtmlReportQuestionsForExport(),
});
};

const buildSessionResultsAnalysisPayloadForAi = (): SurveyResultsAnalysisPayloadForAi => {
const sessionSlug = getEffectiveSlug() || '';
const sessionName = String(propsRef.current.sessionName || stateRef.current.surveyTitle || sessionSlug || 'Session').trim();
const built = buildSessionResultsAnalysisAiPayload({
  questions: getHtmlReportQuestionsForExport(),
  responses: getSessionResultsAnalysisResponsesForExport(),
  segmentDimensions: getSessionResultsAnalysisSegmentDimensionsForExport(),
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
};

const buildSessionResultsHtmlReportSnapshot = (
exportedAt: unknown = new Date().toISOString()
): SessionResultsHtmlSnapshot => {
const sessionSlug = getEffectiveSlug() || '';
const sessionName = String(propsRef.current.sessionName || stateRef.current.surveyTitle || sessionSlug || 'Session').trim();
return buildSurveyResultsHtmlReportSnapshot({
  analysisArtifact: getHtmlReportAnalysisArtifact(),
  chainId: getHtmlReportChainId(),
  countsByQuestion: getHtmlReportResponseCountsByQuestion(),
  exportedAt,
  exporterMetadata: getHtmlReportExporterMetadata(),
  filterState: stateRef.current.filterState,
  filteredQuestionsCount: stateRef.current.filteredQuestionsCount,
  filteredResponsesCount: stateRef.current.filteredResponsesCount,
  latestKnownBlock: stateRef.current.networkLatestBlock,
  networkLabel: getHtmlReportNetworkLabel(),
  participantCount: getHtmlReportParticipantCount(),
  questions: getHtmlReportQuestionsForExport(),
  sessionName,
  sessionSlug,
  surveyId: stateRef.current.surveyId,
  surveyTitle: stateRef.current.surveyTitle,
  surveyViewMode: stateRef.current.surveyViewMode,
  totalQuestionsCount: stateRef.current.totalQuestionsCount,
  totalResponsesCount: stateRef.current.totalResponsesCount,
  viewMode: stateRef.current.viewMode,
});
};

const getHtmlReportAnalysisSectionsToGenerate = (
  sections: Required<SessionResultsSectionSelection> = getHtmlReportSelectedSections()
): SessionResultsAnalysisSectionKey[] => {
const keys = new Set<SessionResultsAnalysisSectionKey>();
Object.entries(sections).forEach(([sectionKey, selected]) => {
  if (!selected) return;
  const analysisKey = HTML_REPORT_SECTION_TO_ANALYSIS_SECTION[sectionKey as SurveyResultsHtmlReportSectionKey];
  if (analysisKey) keys.add(analysisKey);
});
return SESSION_RESULTS_ANALYSIS_SECTION_KEYS.filter((key) => keys.has(key));
};

const openHtmlReportExportModal = (): void => {
const snapshot = buildSessionResultsHtmlReportSnapshot();
setState(buildSurveyResultsHtmlReportModalOpenPatch(snapshot.exportedAt));
};

const closeHtmlReportExportModal = (): void => {
setState(buildSurveyResultsHtmlReportModalClosePatch());
};

const toggleHtmlReportSection = (key: SurveyResultsHtmlReportSectionKey): void => {
const current = getHtmlReportSelectedSections();
setState(buildSurveyResultsHtmlReportSectionTogglePatch({
  currentSections: current,
  sectionKey: key,
}));
};

const toggleHtmlReportDemoMode = (): void => {
const nextDemoMode = !stateRef.current.htmlReportDemoMode;
const currentArtifact = getHtmlReportAnalysisArtifact();
setState(buildSurveyResultsHtmlReportDemoModePatch({
  currentArtifact,
  demoArtifact: nextDemoMode ? buildHtmlReportDemoAnalysisArtifact() : null,
  nextDemoMode,
}));
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
  setState(buildSurveyResultsHtmlReportAnalysisErrorPatch(
    'Connect a wallet with permission to view these results before generating analysis views.'
  ));
  return;
}

const {
  aiPayload,
  eligibility,
  inputSignature,
  participants,
} = buildSessionResultsAnalysisPayloadForAi();
if (!eligibility.eligible) {
  setState(buildSurveyResultsHtmlReportAnalysisEligibilityBlockedPatch({
    inputSignature,
    reason: eligibility.reasons.join(' '),
  }));
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
    setState(buildSurveyResultsHtmlReportAnalysisProgressPatch(
      `Generating ${label} (${index + 1}/${missingSections.length})`
    ));
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
      base: artifact || surveyResultsAnalysisArtifactMergePort.normalizeGeneratedArtifact({
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

const getExportBaseFileName = (exportType: unknown = stateRef.current.exportType): string => {
const { viewMode, surveyId } = stateRef.current;
const surveyIdShort = surveyId
  ? getShortenedSurveyID(surveyId, false, null, true)
  : 'all';
return buildSurveyResultsExportBaseFileName({
  exportType,
  surveyIdShort,
  viewMode,
});
};

const downloadCSV = (): void => {
const { exportType } = stateRef.current;
const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
const baseFileName = getExportBaseFileName(exportType);
runSurveyResultsExportController({
  baseFileName,
  downloadFile: runSurveyResultsBrowserDownload,
  exportType,
  generators: {
    'questions-csv': generateQuestionsCSV,
    'questions-json': generateQuestionsJSON,
    'questions-responses-csv': generateResponsesCSV,
    'questions-responses-json': generateResultsJSON,
  },
  getCurrentAlertMessage: () => stateRef.current.alertMessage,
  onAlertMessage: (message) => {
    setState(asSurveyResultsStatePatch(buildSurveyResultsAlertMessagePatch(message)));
  },
  timestamp,
});
};

const handleExportTypeChange = (type: unknown): void => {
setState(asSurveyResultsStatePatch(buildSurveyResultsExportTypePatch(type)));
};

const handleQuestionFilter = (
  filteredQuestionsOrCombined: unknown,
  newFilterState: unknown
): void => {
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
  const networkQuestions = isSurveyIndividuals || isSurveyAggregate
    ? {}
    : getNetworkQuestionsForCurrentContext();
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
      setState(asSurveyResultsStateUpdater((prev: SurveyResultsRecord) => (
        buildSurveyResultsFilterLoadingStatePatch({
          nextLoading: loadingUpdate.nextLoading,
          prevState: prev,
        })
      )), () => {
        if (stateRef.current.filterLoading === inst._pendingFilterLoadingValue) {
          inst._pendingFilterLoadingValue = null;
        }
      });
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

const handleFilteredResponses = (
  filteredResponses: unknown,
  newSbtFilterLocalState: unknown
): void => {
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
    networkQuestions: (
      stateRef.current.viewMode !== 'survey' &&
      filteredResponses &&
      typeof filteredResponses === 'object'
    )
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
    commitResultsFilterState(
      filteredResponsesPatchPlan.patch,
      nextFilterState
    );
  } else {
    return;
  }
};

const toggleQuestionSummary = (questionId: unknown): void => {
setState(asSurveyResultsStateUpdater((prevState) => buildSurveyResultsKeyedTogglePatch({
  itemKey: questionId,
  mapKey: 'activeQuestionToggles',
  prevState,
})));
};

const toggleResponse = (responseId: unknown): void => {
setState(asSurveyResultsStateUpdater((prevState) => buildSurveyResultsKeyedTogglePatch({
  itemKey: responseId,
  mapKey: 'activeToggles',
  prevState,
})));
};

const toggleSurveyBookmark = (surveyId: unknown): void => {
const slug = getEffectiveSlug();
const bookmarksReadRequest = buildSurveyResultsBookmarksCacheReadRequest({ slug });
let bookmarksCache: unknown = {};

try {
  bookmarksCache = surveyResultsCachePort.peekCacheSync(
    bookmarksReadRequest.namespace,
    bookmarksReadRequest.slug,
    bookmarksReadRequest.options
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
    writeBookmarksCache: (namespace, cacheSlug, payload) => (
      surveyResultsCachePort.writeCache(namespace, cacheSlug, payload)
    ),
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
    bookmarksReadRequest.options
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
    writeBookmarksCache: (namespace, cacheSlug, payload) => (
      surveyResultsCachePort.writeCache(namespace, cacheSlug, payload)
    ),
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
    ? individualResponses as SurveyResultsSummaryResponseRow[]
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
  const ref = (aggregator && typeof aggregator === 'object')
    ? aggregator as SurveyResultsRecord
    : {};
  const memo = inst._aggregatorEntriesMemo;
  if (memo.aggregatorRef === ref) {
    return memo.entries as SurveyResultsAggregatorEntry[];
  }
  const entries = measureSync('ce.surveyResults.render.aggregatorEntries', () =>
    Object.entries(ref)
  ) as SurveyResultsAggregatorEntry[];
  inst._aggregatorEntriesMemo = {
    aggregatorRef: ref,
    entries,
  };
  return entries;
};

const getMemoizedPolisQuestionResponses = (
  polisSelected: unknown,
  sourceAggregator: unknown
): SurveyResultsStringifiedAggregator | null => {
  if (!polisSelected) {
    inst._polisQuestionResponsesMemo = {
      selected: false,
      sourceRef: null,
      result: null,
    };
    return null;
  }
  const sourceRef = (sourceAggregator && typeof sourceAggregator === 'object')
    ? sourceAggregator as SurveyResultsRecord
    : {};
  const memo = inst._polisQuestionResponsesMemo;
  if (memo.selected && memo.sourceRef === sourceRef) {
    return memo.result as SurveyResultsStringifiedAggregator;
  }
  const result = measureSync('ce.surveyResults.render.polisPayload', () =>
    stringifySurveyResultsAggregatorResponses(sourceRef)
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

const getDecryptLitHooks = (): SurveyResultsLitHooks | null => {
  if (propsRef.current.lit && typeof propsRef.current.lit === 'object') {
    return propsRef.current.lit as SurveyResultsLitHooks;
  }
  if (propsRef.current.litHooks && typeof propsRef.current.litHooks === 'object') {
    return propsRef.current.litHooks as SurveyResultsLitHooks;
  }
  if (typeof window === 'undefined') return null;
  const windowWithLitHooks = window as SurveyResultsWindowWithLitHooks;
  return windowWithLitHooks.__litHooks || windowWithLitHooks.litHooks || null;
};

const getQuestionEncryptionGates = (question: SurveyResultsQuestionWithEncryption | null = null): SurveyResultsGateRecord[] => {
  const encryption = question?.encryption as SurveyResultsQuestionEncryptionRecord | null | undefined;
  if (!encryption || typeof encryption !== 'object' || encryption.enabled === false) return [];
  const list = Array.isArray(encryption.gates)
    ? encryption.gates
    : (encryption.gate && typeof encryption.gate === 'object' ? [encryption.gate] : []);
  return list.filter((gate): gate is SurveyResultsGateRecord => !!gate && typeof gate === 'object');
};

const getLockedResponseKey = ({
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

const getDecryptedResponseOverride = (
  key: unknown = ''
): SurveyResultsDecryptedResponseOverride | null => {
  if (!key) return null;
  const overrides = toSurveyResultsRecord(stateRef.current.decryptedResponseOverrides);
  const override = overrides[String(key)] || null;
  return override && typeof override === 'object'
    ? override as SurveyResultsDecryptedResponseOverride
    : null;
};

const applyDecryptedOverrideToResponse = ({
  response = null,
  key = '',
}: SurveyResultsApplyDecryptedOverrideArgs = {}): SurveyResultsResponseRecord | null => {
  if (!response || typeof response !== 'object' || !key) return response;
  const override = getDecryptedResponseOverride(key);
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

const buildLockedGateDetails = (
  lockedRows: unknown = [],
  questionLookup: Record<string, SurveyResultsQuestionWithEncryption> = {}
): SurveyResultsLockedGateDetailsResult => {
  const rows = Array.isArray(lockedRows) ? lockedRows as SurveyResultsLockedRow[] : [];
  if (rows.length === 0) {
    return { gateDetails: [], hasGenericGateMessage: false };
  }

  const resolvedSession = getEffectiveSessionContext();
  const baseSlug = resolvedSession.sessionSlug || '';
  const baseSessionConfig = toSurveyResultsRecord(resolvedSession.sessionConfig) as SurveyResultsSessionConfigRecord;
  const baseFallbackChainId = Number(
    propsRef.current.network?.id ||
    propsRef.current.networkChainId ||
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
      propsRef.current.network?.id ||
      propsRef.current.networkChainId ||
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
        isQuestionResponseFlow: stateRef.current.viewMode === 'questions',
        fallbackChainId: nextFallbackChainId,
      }) as SurveyResultsRecord & { gates?: unknown },
      configuredGateMap: toSurveyResultsRecord(sponsoredConfig.gates) as Record<string, SurveyResultsGateRecord>,
    };
    sessionContextMemo.set(requestedSlug, nextContext);
    return nextContext;
  };

  return buildSurveyResultsLockedGateDetails({
    baseSlug,
    buildSbtDetailPath,
    getQuestionEncryptionGates: (question) => (
      getQuestionEncryptionGates(toSurveyResultsRecord(question) as SurveyResultsQuestionWithEncryption | null)
    ),
    getShortenedAddress,
    lockedRows: rows,
    normalizeGateSbtEntries: (gate) => normalizeGateSbtEntries(toSurveyResultsRecord(gate) as SurveyResultsGateRecord),
    normalizeGateText,
    questionLookup,
    readSessionGateContext,
    resolveSbtDisplayLabel: resolveSbtDisplayLabelForSurveyResults,
  }) as SurveyResultsLockedGateDetailsResult;
};

const getMemoizedLockedResponsesModel = (
  questionLookup: Record<string, SurveyResultsQuestionWithEncryption> = {}
): SurveyResultsLockedResponsesModel => {
  const {
    viewMode,
    surveyViewMode,
    sbtFilteredResponses,
    sbtFilteredAggregatorQuestionResponses,
    decryptedResponseOverrides,
  } = stateRef.current;
  const slug = getEffectiveSlug();
  const memo = (inst._lockedResponsesModelMemo || {}) as SurveyResultsLockedResponsesModelMemo;
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

  const lockedRows = buildSurveyResultsLockedRows({
    aggregatorQuestionResponses: sbtFilteredAggregatorQuestionResponses,
    applyDecryptedOverrideToResponse: ({ response, key }) => applyDecryptedOverrideToResponse({
      response: response as SurveyResultsResponseRecord | null,
      key,
    }),
    getLockedResponseKey: (args) => getLockedResponseKey({
      ...args,
      response: args.response as SurveyResultsResponseRecord | null,
    }),
    isBannerEligibleLockedField: (field) => (
      isBannerEligibleLockedField(field as SurveyResultsEncryptedFieldRecord | null | undefined)
    ),
    sbtFilteredResponses,
    surveyId: stateRef.current.surveyId,
    surveyViewMode,
    viewMode,
  }) as SurveyResultsLockedRow[];

  const { gateDetails, hasGenericGateMessage } = buildLockedGateDetails(lockedRows, questionLookup);
  const result = {
    lockedRows,
    lockedCount: lockedRows.length,
    gateDetails,
    hasGenericGateMessage,
  };
  inst._lockedResponsesModelMemo = {
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

const decryptFieldValue = async (
  field: SurveyResultsEncryptedFieldRecord | null = null
): Promise<SurveyResultsDecryptFieldResult> => {
  if (!field || typeof field !== 'object') return { ok: false };
  const envelope = extractEnvelopeCandidate(field);
  if (!envelope) return { ok: false };

  const decryptOptions = getCryptoGateDecryptOptions();
  try {
    const value = await cryptoGatePort.decryptEnvelopeValue(envelope, decryptOptions);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error };
  }
};

const getCryptoGateDecryptOptions = (): CryptoGateDecryptOptions => {
  const litHooks = getDecryptLitHooks();
  const litOpts = litHooks && typeof litHooks.getKey === 'function'
    ? { getKey: litHooks.getKey }
    : undefined;
  return {
    account: propsRef.current.account,
    chainId: propsRef.current.network?.id || propsRef.current.networkChainId || null,
    providerLike: propsRef.current.provider,
    ...(litOpts ? { litOpts } : {}),
  };
};

const handleDecryptLockedResponses = async (): Promise<void> => {
  if (stateRef.current.lockedResponsesDecrypting) return;
  if (!propsRef.current.loginComplete || !propsRef.current.account) {
    setState(asSurveyResultsStatePatch(buildSurveyResultsAlertMessagePatch('Login required to decrypt locked responses.')));
    return;
  }

  const questionLookup = getNetworkQuestionsForCurrentContext();
  const model = getMemoizedLockedResponsesModel(questionLookup);
  const lockedRows = Array.isArray(model?.lockedRows) ? model.lockedRows : [];
  if (lockedRows.length === 0) return;

  setState(asSurveyResultsStatePatch(buildSurveyResultsLockedResponsesDecryptingPatch(true)));

  let anyDecrypted = false;
  const nextOverrides: Record<string, SurveyResultsDecryptedResponseOverride> = {
    ...(toSurveyResultsRecord(stateRef.current.decryptedResponseOverrides) as Record<string, SurveyResultsDecryptedResponseOverride>),
  };

  for (const row of lockedRows) {
    const response: SurveyResultsResponseRecord = row?.response || {};
    const override: SurveyResultsDecryptedResponseOverride = { ...(nextOverrides[row.key] || {}) };

    if (isLockedEncryptedField(row?.mergedResponse?.answer)) {
      const answerResult = await decryptFieldValue(response.answer);
      if (answerResult.ok) {
        override.answerValue = answerResult.value;
        anyDecrypted = true;
      }
    }

    if (isLockedEncryptedField(row?.mergedResponse?.additional)) {
      const additionalResult = await decryptFieldValue(response.additional);
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
        const importance = await cryptoGatePort.decryptEnvelopeValue(
          response.importanceEncrypted,
          getCryptoGateDecryptOptions()
        );
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
        const conviction = await cryptoGatePort.decryptEnvelopeValue(
          response.convictionEncrypted,
          getCryptoGateDecryptOptions()
        );
        override.conviction = Number.isNaN(Number(conviction)) ? conviction : Number(conviction);
        anyDecrypted = true;
      } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
    }

    if (Object.keys(override).length > 0) {
      nextOverrides[row.key] = override;
    }
  }

  setState(asSurveyResultsStatePatch(buildSurveyResultsLockedResponsesDecryptCompletePatch({
    anyDecrypted,
    decryptedResponseOverrides: nextOverrides,
    walletLowerLabel: t('walletLower'),
  })));
};

const toggleLockedResponseDetails = (): void => {
  setState(asSurveyResultsStateUpdater(toggleSurveyResultsLockedResponseDetailsPatch));
};

const renderQuestionSummary = (
  questionId: string,
  responses: unknown,
  preNetworkQuestions?: Record<string, SurveyResultsRecord> | null
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

const getStableFallbackQuestion = (
  questionId: unknown,
  mode: unknown = 'summary'
): SurveyResultsFallbackQuestion => {
if (!inst._stableFallbackQuestions || typeof inst._stableFallbackQuestions !== 'object') {
  inst._stableFallbackQuestions = createSurveyResultsFallbackQuestionBuckets();
}
return getSurveyResultsStableFallbackQuestion(inst._stableFallbackQuestions, questionId, mode);
};

const getMemoizedQuestionTableEntries = (
  questionMap: unknown = {},
  networkQuestions: unknown = {}
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
      setState(asSurveyResultsStateUpdater((prevState) => buildSurveyResultsKeyedTogglePatch({
        forceValue: true,
        itemKey: questionId,
        mapKey: 'activeQuestionToggles',
        prevState,
      })), () => {
        scrollToQuestion(questionId);
      });
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
  (questionIdTableRef?.current &&
    questionIdTableRef.current.closest(`.${styles.modalBody}`)) ||
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
setState(asSurveyResultsStateUpdater((prevState) => buildSurveyResultsQuestionIdSortPatch({
  column,
  prevState,
})));
};

const toggleQuestionFilter = (): void => {
setState(asSurveyResultsStateUpdater((prevState) => buildSurveyResultsBooleanTogglePatch({
  prevState,
  stateKey: 'showQuestionFilter',
})));
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
setState(asSurveyResultsStateUpdater((prevState) => buildSurveyResultsBooleanTogglePatch({
  prevState,
  stateKey: 'exportAreaOpen',
})));
};

const handleManualRefresh = async (): Promise<void> => {
try {
  const slug = getEffectiveSlug();
  await runSurveyResultsManualRefreshStatusApplicationController({
    ports: {
      applyRefreshState: (statePatch, afterApply) => {
        setState(asSurveyResultsStatePatch(statePatch), afterApply);
      },
      dispatchManualRefresh: () => runSurveyResultsManualRefreshDispatchController({
        ports: {
          onQuestionMetadataRefreshAvailable: () => surveyLog.log("refreshQuestionMetadata present"),
          refreshQuestionMetadata: propsRef.current.refreshQuestionMetadata,
          refreshQuestionResponses: propsRef.current.refreshQuestionResponses,
          refreshSurveyResponsesByID: propsRef.current.refreshSurveyResponsesByID,
        },
        surveyId: stateRef.current.surveyId,
        viewMode: stateRef.current.viewMode,
      }),
      pollLocalStorageForUpdates,
      queueResultsRefresh,
      readLatestBlock: () => chainScanReadsPort.getLatestBlockNumber(
        propsRef.current.provider as string | undefined,
        slug
      ),
      resetLocalStoragePollingBackoff,
    },
  });
} catch (error) {
  surveyLog.error('handleManualRefresh error:', error);
}
};

const handleBookmarkFilter = async (): Promise<void> => {
const filterToBookmark = stateRef.current.filterState;
const mountedWritePlan = buildSurveyResultsFilterBookmarkWritePlan({
  filterState: filterToBookmark,
  isMounted: inst._isMounted,
});
if (!mountedWritePlan.shouldReadCache) return;
const slug = getEffectiveSlug();

let filtersCache: unknown = surveyResultsCachePort.peekCacheSync('filters', slug, { clone: false });
if (!filtersCache || typeof filtersCache !== 'object') {
  filtersCache = (await surveyResultsCachePort.readCache('filters', slug)) || {};
} else {
  filtersCache = { ...(filtersCache as SurveyResultsFiltersCache) };
}
const filtersCacheRecord = toSurveyResultsRecord(filtersCache) as SurveyResultsFiltersCache;
let writePlan: SurveyResultsFilterBookmarkWritePlan;
try {
  writePlan = buildSurveyResultsFilterBookmarkWritePlan({
    filtersCache: filtersCacheRecord,
    filtersCacheLoaded: true,
    filterState: filterToBookmark,
    isMounted: inst._isMounted,
    slug,
  });
  if (writePlan.bookmarkedFiltersInvalid) {
    surveyLog.warn('Bookmarked filters cache was not an array. Initializing to empty array.');
  }
} catch (e) {
  surveyLog.error('Error parsing bookmarked filters cache:', e);
  writePlan = buildSurveyResultsFilterBookmarkWritePlan({
    filtersCache: {},
    filtersCacheLoaded: true,
    filterState: filterToBookmark,
    isMounted: inst._isMounted,
    slug,
  });
}

if (!writePlan.shouldWrite || !writePlan.payload) return;

const writeResult = await runSurveyResultsFilterBookmarkWriteController({
  plan: writePlan,
  ports: {
    writeFilterBookmark: (namespace, cacheSlug, payload) => (
      surveyResultsCachePort.writeCache(namespace, cacheSlug, payload)
    ),
  },
});
if (!writeResult.ok) {
  if (writeResult.error) {
    surveyLog.error('Error saving bookmarked filters cache:', writeResult.error);
  }
  return;
}

try {
  if (writeResult.shouldApplySuccessFeedback) {
    setState(asSurveyResultsStatePatch(buildSurveyResultsBookmarkFeedbackPatch(true)));
  }

  if (inst._bookmarkFeedbackTimer) {
    clearTimeout(inst._bookmarkFeedbackTimer);
    inst._bookmarkFeedbackTimer = null;
  }
  inst._bookmarkFeedbackTimer = setTimeout(() => {
    inst._bookmarkFeedbackTimer = null;
    if (inst._isMounted) {
      setState(asSurveyResultsStatePatch(buildSurveyResultsBookmarkFeedbackPatch(false)));
    }
  }, 2000);
} catch (e) {
  surveyLog.error('Error saving bookmarked filters cache:', e);
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

const renderHtmlReportExportModal = (): React.ReactNode => {
return renderSurveyResultsHtmlReportExportModal(getHtmlReportModalProps());
};

  function runComponentDidUpdate(prevProps: SurveyResultsProps, prevState: SurveyResultsState): void {
    const refreshReasons: Set<string> = new Set();
    const pendingStatePatch: SurveyResultsRecord = {};
    let hasPendingStatePatch = false;
    let runPostPatchTasks: VoidFunction | null = null;
    const clearResponseParseMemo = (): void => {
      if (inst._responseParseMemo && typeof inst._responseParseMemo.clear === 'function') {
        inst._responseParseMemo.clear();
      }
    };
    const queueStatePatch = (key: string, value: unknown): void => {
      if (stateRef.current[key] === value) return;
      pendingStatePatch[key] = value;
      hasPendingStatePatch = true;
    };
    const wasSynced = isSurveyResultsStateSynced(prevState);
    const isSyncedNow = isSurveyResultsStateSynced(stateRef.current);
    if (!wasSynced && isSyncedNow) {
      inst._syncLoadingStartedAt = null;
    } else if (!isSyncedNow && inst._syncLoadingStartedAt === null) {
      inst._syncLoadingStartedAt = Date.now();
    }

    // Sync local filteredQuestionsCount from props
    if (
      propsRef.current.filteredQuestionsCount !== prevProps.filteredQuestionsCount &&
      propsRef.current.filteredQuestionsCount !== stateRef.current.filteredQuestionsCount
    ) {
      queueStatePatch('filteredQuestionsCount', propsRef.current.filteredQuestionsCount);
    }

    // If the modal just closed, revert the URL and stop polling
    if (prevProps.isOpen && !propsRef.current.isOpen) {
      clearResponseParseMemo();
      queueStatePatch('questionResultsHydrated', false);
      queueStatePatch('surveyResultsHydrated', false);
      queueStatePatch('demoResultsViewMode', 'raw');
      queueStatePatch('demoResultsAtlasNodeId', null);
      if (!propsRef.current.preventUrlChange) {
        let basePath;
        if (stateRef.current.viewMode === 'questions') {
          basePath = '/questions';
        } else if (stateRef.current.surveyId) {
          basePath = `/survey/${stateRef.current.surveyId}`;
        } else {
          basePath = '/questions';
        }
        basePath = appendSessionHintToSurveyPath(basePath);
        window.history.pushState({}, '', applyExistingGroupPrefix(basePath));
      }
      stopLocalStoragePolling();
      resetLocalStoragePollingBackoff('modal-closed');
      inst._syncLoadingStartedAt = null;
    }

    // If the modal just opened
    if (!prevProps.isOpen && propsRef.current.isOpen) {
      resetLocalStoragePollingBackoff('modal-open');
      if (String(stateRef.current.viewMode || '').trim().toLowerCase() === 'questions') {
        queueStatePatch('questionResultsHydrated', false);
      } else {
        queueStatePatch('surveyResultsHydrated', false);
      }
      queueStatePatch('demoResultsViewMode', 'raw');
      queueStatePatch('demoResultsAtlasNodeId', null);
      // Reset then re-seed sync timer if currently loading
      const isSyncedOnOpen = isSurveyResultsStateSynced(stateRef.current);
      inst._syncLoadingStartedAt = isSyncedOnOpen ? null : Date.now();
      updateLocalStoragePollingState();
      // Re-open should re-emit current filter state so URL/query filter sync is restored.
      inst._lastNotifiedFilterStateSignature = null;
      refreshReasons.add('modal-open');

      const filterStatePropChanged =
        getFilterStateSignature(propsRef.current.filterState) !==
        getFilterStateSignature(prevProps.filterState);

      const updateTasks = () => {
        updateParentWithCurrentFiltersForUrl();

        if (!propsRef.current.preventUrlChange && !window.location.pathname.endsWith('/results')) {
          const path =
            stateRef.current.viewMode === 'questions'
              ? '/questions/results'
              : (stateRef.current.surveyId ? `/survey/${stateRef.current.surveyId}/results` : '/questions/results');
          window.history.pushState({}, '', applyExistingGroupPrefix(appendSessionHintToSurveyPath(path)));
        }
      };

      if (filterStatePropChanged) {
        queueStatePatch('filterState', propsRef.current.filterState || {});
        runPostPatchTasks = updateTasks;
      } else {
        updateTasks();
      }
    }

    // If the modal is open and a cache just became ready, refresh
    const cacheJustBecameReady =
      (stateRef.current.viewMode === 'questions' &&
        !prevProps.isQuestionCacheReady &&
        propsRef.current.isQuestionCacheReady) ||
      (stateRef.current.viewMode === 'survey' &&
        !prevProps.isSurveyCacheReady &&
        propsRef.current.isSurveyCacheReady);

    if (propsRef.current.isOpen && cacheJustBecameReady) {
      refreshReasons.add('cache-ready');
    }

    // If responses cache flips ready while open, refresh
    if (
      propsRef.current.isOpen &&
      prevProps.isResponsesCacheReady !== propsRef.current.isResponsesCacheReady &&
      propsRef.current.isResponsesCacheReady
    ) {
      refreshReasons.add('responses-cache-ready');
    }

    // View mode changed (questions <-> survey)
    if (prevState.viewMode !== stateRef.current.viewMode) {
      // Invalidate survey-mode source memo so returning to the same survey rebuilds state.
      inst._surveyModeSourceSignature = '';
      clearResponseParseMemo();
      setState(
        asSurveyResultsStatePatch(buildSurveyResultsViewModeResetPatch({
          questionResultsHydrated: stateRef.current.questionResultsHydrated,
          surveyId: stateRef.current.surveyId,
          surveyResultsHydrated: stateRef.current.surveyResultsHydrated,
          viewMode: stateRef.current.viewMode,
        })),
        () => {
          resetLocalStoragePollingBackoff('view-mode-change');
          queueResultsRefresh('view-mode-change');
        }
      );
    }

    // Survey identity changed (prop or internal)
    if ((propsRef.current.surveyId !== prevProps.surveyId) || (prevState.surveyId !== stateRef.current.surveyId)) {
      clearResponseParseMemo();
      if (propsRef.current.surveyId && propsRef.current.surveyId !== stateRef.current.surveyId) {
        setState(
          asSurveyResultsStatePatch(buildSurveyResultsSurveyIdPropChangePatch(propsRef.current.surveyId)),
          () => {
            resetLocalStoragePollingBackoff('survey-id-prop-change');
            queueResultsRefresh('survey-id-prop-change');
          }
        );
      } else if (prevState.surveyId !== stateRef.current.surveyId && stateRef.current.viewMode === 'survey') {
        setState(
          asSurveyResultsStatePatch(buildSurveyResultsSurveyIdStateChangePatch()),
          () => {
            resetLocalStoragePollingBackoff('survey-id-state-change');
            queueResultsRefresh('survey-id-state-change');
          }
        );
      }
    }

    // Upstream "responses changed" signal
    if (prevProps.questionResponsesNonce !== propsRef.current.questionResponsesNonce) {
      handleNonceTick();
    }

    if (prevProps.isOpen !== propsRef.current.isOpen) {
      if (propsRef.current.isOpen) {
        resetLocalStoragePollingBackoff('modal-open-state-change');
      }
      updateLocalStoragePollingState();
    }

    const prevQuestionScopeSignature = buildQuestionReadScopeSignature({
      props: prevProps,
      state: prevState,
      viewMode: prevState.viewMode || prevProps.viewMode || 'questions',
    });
    const nextQuestionScopeSignature = buildQuestionReadScopeSignature({
      props: propsRef.current,
      state: stateRef.current,
      viewMode: stateRef.current.viewMode || propsRef.current.viewMode || 'questions',
    });
    if (
      propsRef.current.isOpen &&
      String(stateRef.current.viewMode || '').trim().toLowerCase() === 'questions' &&
      prevQuestionScopeSignature !== nextQuestionScopeSignature
    ) {
      clearResponseParseMemo();
      const questionScopeResetPatch: SurveyResultsRecord = buildQuestionResultsScopeResetPatch();
      Object.keys(questionScopeResetPatch).forEach((key) => {
        queueStatePatch(key, questionScopeResetPatch[key]);
      });
      refreshReasons.add('question-scope-change');
    }

    if (hasPendingStatePatch) {
      setState(pendingStatePatch, () => {
        if (typeof runPostPatchTasks === 'function') runPostPatchTasks();
      });
    } else if (typeof runPostPatchTasks === 'function') {
      runPostPatchTasks();
    }

    runSurveyResultsQueuedRefreshController({
      ports: {
        queueResultsRefresh: queueResultsRefresh,
      },
      reasons: refreshReasons,
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
    inst._isMounted = true;
    inst._unsubscribeCacheUpdates = surveyResultsCachePort.subscribeCacheUpdates(handleManagedCacheUpdate);
    window.addEventListener('popstate', handleUrlChange);
    document.addEventListener('visibilitychange', handleDocumentVisibilityChange);

    // Determine initial viewMode and surveyId for state
    let initialViewMode = propsRef.current.viewMode || 'questions';
    let initialSurveyId = propsRef.current.surveyId || '';

    if (initialSurveyId) {
      initialViewMode = 'survey';
    }

    setState(asSurveyResultsStatePatch(buildSurveyResultsViewStatePatch(initialViewMode, initialSurveyId)), () => {
      handleUrlBasedView();

      if (propsRef.current.isOpen) {
        if (stateRef.current.viewMode === 'questions') {
          if (propsRef.current.refreshQuestionMetadata && propsRef.current.refreshQuestionResponses) {
            propsRef.current.refreshQuestionMetadata();
            propsRef.current.refreshQuestionResponses();
          }
        } else if (stateRef.current.viewMode === 'survey' && stateRef.current.surveyId) {
          if (propsRef.current.refreshSurveyResponsesByID) {
            propsRef.current.refreshSurveyResponsesByID(stateRef.current.surveyId.toLowerCase());
          }
        }

        const ensureResultsUrl = () => {
          if (propsRef.current.preventUrlChange) return;
          if (!window.location.pathname.endsWith('/results')) {
            let path =
              stateRef.current.viewMode === 'questions'
                ? '/questions/results'
                : (stateRef.current.surveyId ? `/survey/${stateRef.current.surveyId}/results` : '/questions/results');

            // Apply prefix
            path = applyExistingGroupPrefix(path);

            // Preserve existing query params (specifically filter) if present
            const search = window.location.search;
            if (search) {
              path += search;
            } else {
              path = appendSessionHintToSurveyPath(path);
            }

            window.history.pushState({}, '', path);
          }
        };

        updateLocalStoragePollingState();
        handleManualRefresh();
        queueResultsRefresh('mount-open');
        ensureResultsUrl();
        updateParentWithCurrentFiltersForUrl();
      }
    });

    return () => {
    inst._isMounted = false;
    fetchResponsesRuntime.destroy();
    inst._nonceTickInFlight = false;
    inst._nonceTickQueued = false;
    inst._pollLatestBlockFetchInFlight = false;
    queuedResultsRefreshRuntime.destroy();
    if (inst._responseParseMemo && typeof inst._responseParseMemo.clear === 'function') {
      inst._responseParseMemo.clear();
    }
    if (typeof inst._unsubscribeCacheUpdates === 'function') {
      inst._unsubscribeCacheUpdates();
    }
    inst._unsubscribeCacheUpdates = null;
    if (inst._scrollToQuestionRetryTimer) {
      clearTimeout(inst._scrollToQuestionRetryTimer);
      inst._scrollToQuestionRetryTimer = null;
    }
    if (inst._scrollMutationObserver) {
      inst._scrollMutationObserver.disconnect();
      inst._scrollMutationObserver = null;
    }
    if (inst._bookmarkFeedbackTimer) {
      clearTimeout(inst._bookmarkFeedbackTimer);
      inst._bookmarkFeedbackTimer = null;
    }
    window.removeEventListener('popstate', handleUrlChange);
    document.removeEventListener('visibilitychange', handleDocumentVisibilityChange);
    localStoragePollingRuntime.destroy();

    // If unmounting while still open, remove "/results" from the URL
    if (propsRef.current.isOpen && !propsRef.current.preventUrlChange) {
      const currentPath = window.location.pathname;
      if (currentPath.includes('/results')) {
        let newPath = currentPath.replace('/results', '').replace(/\/+$/, '');
        // If that leaves nothing, fall back to whichever path logic you want:
        if (!newPath) {
          newPath =
            stateRef.current.viewMode === 'questions'
              ? '/questions'
              : stateRef.current.surveyId // Use state.surveyId
                ? `/survey/${stateRef.current.surveyId}`
                : '/questions';
        }
        newPath = appendSessionHintToSurveyPath(newPath);
        window.history.pushState({}, '', newPath);
      }
    }
  };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


const isActuallyOpen = propsRef.current.isOpen;

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
} = stateRef.current;

// Use stateRef.current.surveyId for consistency
const currentSurveyId = stateRef.current.surveyId;
// Preload scoped question metadata once per render so question-mode summaries stay in
// sync with the same list-scope aggregation used by fetchQuestionModeResponses().
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
const surveyAggregateEntries =
  (viewMode === 'survey' && surveyViewMode === 'aggregate') ? aggregatorEntries : [];
const questionModeEntries = viewMode === 'questions' ? aggregatorEntries : [];

const surveyIdAbbreviation = currentSurveyId
  ? getShortenedSurveyID(currentSurveyId, false, null, false)
  : null;
const isDemoQuestionResults = getIsDemoQuestionResultsContext();
const demoResultsViewMode = isDemoQuestionResults
  ? stateRef.current.demoResultsViewMode || 'raw'
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
const cacheControllerSnapshot = buildSurveyResultsCacheControllerSnapshot({
  activeSessionSlug: slug,
  aggregatorEntriesCount,
  currentSurveyId,
  currentSurveyIdForUrl: viewMode === 'survey' ? currentSurveyId : null,
  currentViewModeForUrl: viewMode,
  filteredQuestionsCount,
  filteredResponsesCount,
  filterLoading,
  filterState: stateRef.current.filterState,
  hasRefreshQuestionMetadata: typeof propsRef.current.refreshQuestionMetadata === 'function',
  hasRefreshQuestionResponses: typeof propsRef.current.refreshQuestionResponses === 'function',
  hasRefreshSurveyResponsesByID: typeof propsRef.current.refreshSurveyResponsesByID === 'function',
  isQuestionCacheReady: propsRef.current.isQuestionCacheReady,
  isSBTCacheReady: propsRef.current.isSBTCacheReady,
  networkLatestBlock: stateRef.current.networkLatestBlock,
  nowMs: Date.now(),
  questionLocalBlock: stateRef.current.questionLocalBlock,
  questionResponsesNonce: propsRef.current.questionResponsesNonce,
  questionsCacheNonce: propsRef.current.questionsCacheNonce,
  questionResultsHydrated: stateRef.current.questionResultsHydrated,
  refreshTargetQuestionBlock: stateRef.current.refreshTargetQuestionBlock,
  refreshTargetResponseBlock: stateRef.current.refreshTargetResponseBlock,
  refreshTargetSurveyBlock: stateRef.current.refreshTargetSurveyBlock,
  responseLocalBlock: stateRef.current.responseLocalBlock,
  sbtCacheRevision: propsRef.current.sbtCacheRevision,
  showQuestionFilter: stateRef.current.showQuestionFilter,
  storageKeyPrefix: getQuestionFilterStorageKeyPrefix(viewMode),
  surveyLocalBlock: stateRef.current.surveyLocalBlock,
  surveyResultsHydrated: stateRef.current.surveyResultsHydrated,
  surveyViewMode,
  syncLoadingStartedAt: inst._syncLoadingStartedAt,
  totalQuestionsCount,
  totalResponsesCount,
  viewMode,
});
const cacheReadinessDisplay = buildSurveyResultsCacheReadinessDisplayPlan(
  cacheControllerSnapshot.cacheReadinessInput
);
const filterInput = cacheControllerSnapshot.filterInput;
const syncStatusNode = renderSurveyResultsSyncStatusPanel({
  syncStatusDisplay: cacheReadinessDisplay.syncStatusDisplay,
  syncDetailsOpen: !!stateRef.current.syncDetailsOpen,
  syncDetailsStyle: resolveSurveyResultsSyncDetailsStyle(stateRef.current.syncDetailsOpen),
  onToggleSyncDetails: () =>
    setState(asSurveyResultsStateUpdater((prevState) => buildSurveyResultsBooleanTogglePatch({
      prevState,
      stateKey: 'syncDetailsOpen',
    }))),
  onManualRefresh: () => handleManualRefresh(),
  miniBarSpinnerStyle: SURVEY_RESULTS_MINI_BAR_SPINNER_STYLE,
  miniProgressStyle: SURVEY_RESULTS_MINI_PROGRESS_STYLE,
  remainingSpinnerStyle: SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE,
});
const filterControlsNode = renderSurveyResultsFilterExportControls({
  activeSessionSlug: filterInput.activeSessionSlug,
  aggregateQuestionResponses: stateRef.current.aggregateQuestionResponses,
  currentSurveyIdForUrl: filterInput.currentSurveyIdForUrl,
  currentViewModeForUrl: filterInput.currentViewModeForUrl,
  defaultTags: propsRef.current.defaultTags,
  ensureLightSbtUniverse: propsRef.current.ensureLightSbtUniverse,
  exportControlsDisplay,
  filterState: filterInput.filterState,
  isFilterActive,
  isQuestionCacheReady: filterInput.isQuestionCacheReady,
  isSBTCacheReady: filterInput.isSBTCacheReady,
  network: propsRef.current.network,
  onClearFilters: handleClearFiltersFromParent,
  onDownload: downloadCSV,
  onExportHtmlReport: openHtmlReportExportModal,
  onExportTypeChange: handleExportTypeChange,
  onFilterActivityChange: handleFilterActivityChange,
  onQuestionFilter: handleQuestionFilter,
  onQuestionFilterCountUpdate: handleQuestionFilterCountUpdate,
  onSbtFilter: handleFilteredResponses,
  onSetFilterLoading: stableSetFilterLoadingRef.current,
  onToggleExportArea: toggleExportArea,
  onToggleQuestionFilter: toggleQuestionFilter,
  provider: propsRef.current.provider,
  questionFilterQuestions,
  questionFilterRef: questionFilterRef,
  questionResponses: stateRef.current.questionResponses,
  questionResponsesNonce: filterInput.questionResponsesNonce,
  questionsCacheNonce: filterInput.questionsCacheNonce,
  responses: stateRef.current.responses,
  sbtCacheRevision: filterInput.sbtCacheRevision,
  sessionConfig: propsRef.current.sessionConfig,
  sessionSlug: propsRef.current.sessionSlug,
  showQuestionFilter: filterInput.showQuestionFilter,
  storageKeyPrefix: filterInput.storageKeyPrefix,
  styleMap: styles,
  surveyViewMode,
  viewMode,
});
const displayPanelsProps: SurveyResultsDisplayPanelsArgs = {
  account: propsRef.current.account,
  activeQuestionToggles: stateRef.current.activeQuestionToggles,
  activeToggles: stateRef.current.activeToggles,
  alertMessage,
  applyDecryptedOverrideToResponse: applyDecryptedOverrideToResponse,
  cacheReadinessDisplay,
  currentSurveyId,
  effectiveSlug: slug,
  filterControlsNode,
  filterLoading,
  getFallbackQuestion: getStableFallbackQuestion,
  getLockedResponseKey: getLockedResponseKey,
  getResponseCardProps: getSurveyResultsResponseCardProps,
  lockedResponsesBannerNode: SurveyResultsLockedResponsesBanner({
    decrypting: !!stateRef.current.lockedResponsesDecrypting,
    isOpen: !!stateRef.current.lockedResponseDetailsOpen,
    lockedModel: lockedResponsesModel,
    onDecrypt: handleDecryptLockedResponses,
  }),
  network: propsRef.current.network,
  onSurveyViewModeKeyDown: handleSurveyViewModeKeyDown,
  onSurveyViewModeToggle: handleSurveyViewModeToggle,
  onToggleQuestionList: () => toggleQuestionSummary('__questionList__'),
  onToggleResponse: toggleResponse,
  preNetworkQuestions,
  questionModeEntries,
  questionResponsesNonce: propsRef.current.questionResponsesNonce,
  questionsCacheNonce: propsRef.current.questionsCacheNonce,
  renderQuestionSummary: (qId, arr) => renderQuestionSummary(qId, arr, preNetworkQuestions),
  renderQuestionTable: () => renderQuestionIDsTable(
    sbtFilteredAggregatorQuestionResponses,
    preNetworkQuestions
  ),
  responses: sbtFilteredResponses,
  sbtCacheRevision: propsRef.current.sbtCacheRevision,
  styleMap: styles,
  surveyAggregateEntries,
  surveyViewMode,
  tableWrapperRef: questionIdTableRef,
  toggleKnobStyle: resolveSurveyResultsToggleKnobStyle(surveyViewMode === 'aggregate'),
  trailingLabelStyle: SURVEY_RESULTS_TRAILING_LABEL_STYLE,
  viewMode,
};
const demoSurfaceProps = buildSurveyResultsDemoSurfaceProps({
  activeSlug: slug,
  getIndividualsAggregator: getMemoizedIndividualsAggregator,
  getPolisQuestionResponses: getMemoizedPolisQuestionResponses,
  isDemoAlternateResultsView,
  onAtlasModalClose: handleDemoAtlasModalClose,
  onAtlasNodeOpen: handleDemoAtlasOpen,
  parentProps: createSurveyResultsDemoSurfaceParentProps(propsRef.current),
  state: stateRef.current,
  viewKey: demoResultsViewMode,
});

return (
  <SurveyResultsReportSurface
    demoSurfaceProps={demoSurfaceProps}
    displayPanelsProps={displayPanelsProps}
    htmlReportModalProps={getHtmlReportModalProps()}
    isOpen={isActuallyOpen}
    modalHeaderProps={{
      bookmarkedSurveyIDs: stateRef.current.bookmarkedSurveyIDs,
      currentSurveyId,
      demoResultsViewMode,
      demoResultsViewOptions,
      documentLinkIconStyle: SURVEY_RESULTS_DOCUMENT_LINK_ICON_STYLE,
      effectiveSlug: slug,
      isDemoQuestionResults,
      lockedResponsesToggleNode: SurveyResultsLockedResponsesToggle({
        isOpen: !!stateRef.current.lockedResponseDetailsOpen,
        lockedModel: lockedResponsesModel,
        onToggleDetails: toggleLockedResponseDetails,
      }),
      onDemoResultsViewSelect: handleDemoResultsViewSelect,
      onToggleSurveyBookmark: toggleSurveyBookmark,
      styleMap: styles,
      surveyBookmarkStyle: SURVEY_RESULTS_SURVEY_BOOKMARK_STYLE,
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
    styleMap={styles}
  />
);

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
