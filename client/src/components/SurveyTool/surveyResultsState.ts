import { createLogger } from 'utilities/logging.js';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import {
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
} from '../../utilities/sessionResultsExport';
import {
  SURVEY_RESULTS_EXPORT_TYPES,
  SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
} from './surveyResultsExportDisplayHelpers.js';
import { resolveSurveyResultsExplicitSessionSlug } from './surveyResultsSessionResolution.js';
import {
  buildSurveyResultsBookmarksCacheReadRequest,
  selectSurveyResultsBookmarkLists,
} from './surveyResultsBookmarkCacheReadPorts';
import type {
  SurveyResultsFilterState,
  SurveyResultsProps,
  SurveyResultsState,
} from './SurveyResults';

const surveyLog = createLogger('surveys');

export const preserveSurveyResultsFilterStateValue = (
  value: unknown
): SurveyResultsFilterState => (
  (value || {}) as SurveyResultsFilterState
);

/**
 * State updates accepted by the survey results reducer: either a (possibly
 * partial) patch object cast to the state type, or a class-style updater fn.
 * Both shapes merge over the previous state, matching the legacy
 * `this.setState` shallow-merge semantics the builders were written against.
 */
export type SurveyResultsStateUpdate =
  | SurveyResultsState
  | ((prevState: Readonly<SurveyResultsState>) => SurveyResultsState);

export const surveyResultsReducer = (
  prevState: SurveyResultsState,
  update: SurveyResultsStateUpdate
): SurveyResultsState => ({
  ...prevState,
  ...(typeof update === 'function' ? update(prevState) : update),
});

export const createInitialSurveyResultsState = (
  props: SurveyResultsProps
): SurveyResultsState => {
  const initialSlug = resolveSurveyResultsExplicitSessionSlug(props) ?? '';
  const bookmarksReadRequest = buildSurveyResultsBookmarksCacheReadRequest({ slug: initialSlug });
  let bookmarksCacheValue: unknown = null;

  try {
    bookmarksCacheValue = peekCacheSync(
      bookmarksReadRequest.namespace,
      bookmarksReadRequest.slug,
      bookmarksReadRequest.options
    );
  } catch (error) {
    surveyLog.error('[SurveyResults] Error reading bookmarksCache:', error);
    bookmarksCacheValue = null;
  }
  const {
    surveys: bootstrapSurveyIds,
    questions: bootstrapQuestionIds,
  } = selectSurveyResultsBookmarkLists(bookmarksCacheValue);

  return {
    responses: [],
    sbtFilteredResponses: [],
    csvData: '',
    exportType: SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES,
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
    viewMode: props.viewMode as SurveyResultsState['viewMode'], // 'survey' or 'questions'
    filterLoading: false,
    showQuestionFilter: false,
    filterState: preserveSurveyResultsFilterStateValue(props.filterState),
    syncDetailsOpen: false,
    bookmarkedQuestionIDs: bootstrapQuestionIds,
    bookmarkedSurveyIDs: bootstrapSurveyIds,
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
    filteredQuestionsCount: props.filteredQuestionsCount === undefined ? null : props.filteredQuestionsCount,
    isFilterActive: false,
    lockedResponseDetailsOpen: false,
    lockedResponsesDecrypting: false,
    decryptedResponseOverrides: {},
    demoResultsViewMode: 'raw',
    demoResultsAtlasNodeId: null,
    htmlReportModalOpen: false,
    htmlReportExportedAt: '',
    htmlReportExportFormat: SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
    htmlReportSelectedSections: { ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS },
    htmlReportAnalysisGenerating: false,
    htmlReportAnalysisError: '',
    htmlReportAnalysisArtifact: null,
    htmlReportAnalysisInputSignature: '',
    htmlReportAnalysisProgress: '',
    htmlReportDemoMode: false,
  };
};
