import { toSafeLinkHref } from '../../utilities/arweave/arweaveUrls.js';

type SurveyDocumentUrlSource = {
  documentURLs?: unknown;
};

type SurveyQuestionIdsSource = {
  questionIDs?: unknown;
};

type SurveyIdSource = {
  id?: unknown;
};

type SurveySelectorCacheEntry = SurveyIdSource &
  SurveyQuestionIdsSource & {
    surveyID?: unknown;
    title?: unknown;
    [key: string]: unknown;
  };

type SurveySelectorPendingSubmitStats = {
  total: number;
  encrypted: number;
  submittedSinceLastEdit: boolean;
  isSubmitting: boolean;
  submitCountText: string;
  submitError: string;
};

type SurveySelectorPendingSubmitStatsSource = Partial<SurveySelectorPendingSubmitStats> | null | undefined;

type SurveyQuestionsCache = Record<
  string,
  | {
      questions?: Record<string, unknown>;
    }
  | null
  | undefined
>;

// Survey metadata can come from any uploader, so only safe link schemes become hrefs.
export const getSurveyDocumentUrls = (survey: SurveyDocumentUrlSource | null = null): string[] =>
  (Array.isArray(survey?.documentURLs) ? survey.documentURLs : [])
    .map((value) => toSafeLinkHref(value, { contextLabel: 'survey_document' }))
    .filter(Boolean);

export const getSurveyDocumentLinkTitle = (survey: SurveyDocumentUrlSource | null = null): string => {
  const documentURLs = getSurveyDocumentUrls(survey);
  if (documentURLs.length <= 0) return '';
  return documentURLs.length > 1 ? `${documentURLs.length} documents` : documentURLs[0];
};

export const getDefaultSurveySelectorPendingSubmitStats = (): SurveySelectorPendingSubmitStats => ({
  total: 0,
  encrypted: 0,
  submittedSinceLastEdit: false,
  isSubmitting: false,
  submitCountText: '',
  submitError: '',
});

export const buildSurveySelectorPendingSubmitStatsPatch = (stats: SurveySelectorPendingSubmitStatsSource = {}) => {
  const source = stats || {};
  return {
    pendingSubmitStats: {
      total: Number(source.total || 0),
      encrypted: Number(source.encrypted || 0),
      submittedSinceLastEdit: !!source.submittedSinceLastEdit,
      isSubmitting: !!source.isSubmitting,
      submitCountText: String(source.submitCountText || ''),
      submitError: String(source.submitError || ''),
    },
  };
};

// What the bar says under its Submit: the list's message as a Submit ends, or as the list answers the bar's Submit
// at once (one it refuses straight away never starts). It stands while that message does and answers remain to
// send. A message the list gives at any other time, such as a notice after a Submit that saved everything or a
// decryption fault, is not the bar's to show as a failed Submit.
export const resolveSurveySelectorHeaderSubmitFailure = ({
  prev,
  next,
  shown = '',
  pressed = false,
}: {
  prev: SurveySelectorPendingSubmitStatsSource;
  next: SurveySelectorPendingSubmitStats;
  shown?: string;
  pressed?: boolean;
}): string => {
  if (next.isSubmitting || !next.total || !next.submitError) return '';
  if (prev?.isSubmitting || pressed) return next.submitError;
  return next.submitError === shown ? shown : '';
};

export const buildSurveySelectorPubKeyPatch = (pubKey: unknown) => ({
  pubKey,
});

export const buildSurveySelectorSelectedTypesPatch = (selectedTypes: unknown) => ({
  selectedTypes,
});

export const buildSurveySelectorShowResultsPatch = (showResults: unknown) => ({
  showResults: !!showResults,
});

export const buildSurveySelectorFilterStatePatch = (filterState: unknown) => ({
  filterState,
});

export const buildSurveySelectorFilterActivePatch = (isFilterActive: unknown) => ({
  isFilterActive: !!isFilterActive,
});

export const buildSurveySelectorCopySuccessPatch = (copySurveyIdSuccess: unknown) => ({
  copySurveyIdSuccess: !!copySurveyIdSuccess,
});

export const buildSurveySelectorShowLongLoadingPatch = (showLongLoading: unknown) => ({
  showLongLoading: !!showLongLoading,
});

export const buildSurveySelectorLoadingPatch = (loading: unknown) => ({
  loading: !!loading,
});

export const buildSurveySelectorQuestionCountPatch = (
  filteredQuestionCount: unknown,
  encryptedQuestionCount: unknown,
) => ({
  filteredQuestionCount,
  encryptedQuestionCount,
});

export const buildSurveySelectorEmptySurveyListPatch = () => ({
  surveys: [],
  loading: false,
});

export const buildSurveySelectorLoadedSurveysPatch = (surveys: unknown = []) => ({
  surveys,
  loading: false,
});

export const buildSurveySelectorSubmittedSurveyList = (surveyBag: unknown = {}): SurveySelectorCacheEntry[] => {
  if (!surveyBag || typeof surveyBag !== 'object') return [];

  const bag = surveyBag as Record<string, SurveySelectorCacheEntry | null | undefined>;
  const submittedSurveys: SurveySelectorCacheEntry[] = [];
  const seenSurveyIds = new Set<string>();

  Object.keys(bag).forEach((sid) => {
    const survey = bag[sid];
    // Uploaded metadata is untrusted; a non-string title would crash the selector render.
    if (!survey || typeof survey.title !== 'string' || !survey.title || !Array.isArray(survey.questionIDs)) return;

    const qids = survey.questionIDs.map((questionId) => String(questionId || '').toLowerCase());
    if (qids.length === 0) return;

    if (!survey.id) survey.id = survey.surveyID || sid;
    const loweredSurveyId = String(survey.id || sid).toLowerCase();
    if (seenSurveyIds.has(loweredSurveyId)) return;

    seenSurveyIds.add(loweredSurveyId);
    submittedSurveys.push(survey);
  });

  return submittedSurveys;
};

export const buildSurveySelectorSelectSurveyPatch = (selectedSurveyIndex: unknown) => ({
  selectedSurveyIndex,
  viewMode: 'survey',
  showResults: false,
  pendingSubmitStats: getDefaultSurveySelectorPendingSubmitStats(),
  headerSubmitFailure: '',
});

export const buildSurveySelectorViewModePatch = (viewMode: unknown) => ({
  viewMode,
  pendingSubmitStats: getDefaultSurveySelectorPendingSubmitStats(),
  headerSubmitFailure: '',
});

export const buildQuestionsDashboardFilterLoadingPatch = (filterLoading: unknown) => ({
  filterLoading,
});

export const buildQuestionsDashboardFilteredQuestionsPatch = (filteredQuestions: unknown) => ({
  filteredQuestions,
});

export const buildQuestionsDashboardNoNetworkPatch = (shouldResetFilteredQuestions: unknown) => ({
  questions: [],
  ...(shouldResetFilteredQuestions ? { filteredQuestions: [] } : {}),
  questionResponses: {},
});

export const areSurveySpecificQuestionsLoaded = (
  survey: SurveyQuestionIdsSource | null = null,
  networkId: unknown = '',
  parsedQuestionsCache: SurveyQuestionsCache | null = null,
): boolean => {
  if (!survey || !Array.isArray(survey.questionIDs) || survey.questionIDs.length === 0) {
    return true;
  }
  if (!networkId) {
    return true;
  }

  try {
    const netKey = String(networkId);
    const netBucket = parsedQuestionsCache?.[netKey] || null;
    if (!netBucket || !netBucket.questions) return false;

    const cachedQuestionMap = netBucket.questions;
    for (const surveyQID of survey.questionIDs) {
      if (!cachedQuestionMap[String(surveyQID).toLowerCase()]) {
        return false;
      }
    }
    return true;
  } catch (_error) {
    return false;
  }
};

export const resolveSelectedSurveyIndex = ({
  surveys = [],
  path = '',
  surveyId = '',
  previousSelectedSurveyIndex = null,
}: {
  surveys?: SurveyIdSource[];
  path?: unknown;
  surveyId?: unknown;
  previousSelectedSurveyIndex?: number | null;
} = {}): number | null => {
  const normalizedPath = String(path || '');
  if (normalizedPath === '/surveys') {
    return null;
  }

  let surveyIdFromUrl: string | null = null;
  const match = normalizedPath.match(/^\/survey\/(0x[0-9a-fA-F]{64})(?:\/.*)?$/);
  if (match && match[1]) {
    surveyIdFromUrl = match[1].toLowerCase();
  }

  const propId = surveyId ? String(surveyId).toLowerCase() : null;
  const targetId = surveyIdFromUrl || propId;

  if (!targetId) {
    return null;
  }

  const idx = (Array.isArray(surveys) ? surveys : []).findIndex(
    (survey) => (survey.id ? String(survey.id).toLowerCase() : '') === targetId,
  );
  if (idx !== -1) {
    return idx;
  }

  return previousSelectedSurveyIndex;
};

export const resolveSurveyIdToCopy = ({
  surveyID = null,
  search = '',
  surveys = [],
  selectedSurveyIndex = null,
}: {
  surveyID?: unknown;
  search?: unknown;
  surveys?: SurveyIdSource[];
  selectedSurveyIndex?: number | null;
} = {}) => {
  let idToCopy = surveyID;

  if (!idToCopy) {
    const urlParams = new URLSearchParams(String(search || ''));
    idToCopy = urlParams.get('surveyID');
  }
  if (!idToCopy && selectedSurveyIndex !== null && Array.isArray(surveys) && surveys[selectedSurveyIndex]) {
    idToCopy = surveys[selectedSurveyIndex].id;
  }

  return idToCopy;
};
