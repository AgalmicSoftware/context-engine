import type {
  SurveyResultsQuestionRecord,
  SurveyResultsQuestionResponsesByQuestion,
  SurveyResultsQuestionResponsesByResponder,
} from './surveyResultsQuestionNetworkReadController.js';

export type SurveyResultsQuestionModeCacheNormalizationPorts = {
  isDemoPolisFixtureResponse: (responseData: unknown) => boolean;
  isResponseAllowedForSessionSlug: (responseData: unknown, requiredSessionSlug: string) => boolean;
  parseResponse: (responseData: unknown) => unknown;
};

export type SurveyResultsQuestionModeCacheNormalizationArgs = {
  ports: SurveyResultsQuestionModeCacheNormalizationPorts;
  questionResponses?: unknown;
  questions?: unknown;
  requiredSessionSlug?: unknown;
};

export type SurveyResultsQuestionModeCacheNormalizationResult = {
  liveQuestionIds: Set<string>;
  questionResponses: SurveyResultsQuestionResponsesByQuestion;
  questions: Record<string, SurveyResultsQuestionRecord>;
};

const toQuestionResponsesByQuestion = (
  questionResponses: unknown
): SurveyResultsQuestionResponsesByQuestion => (
  questionResponses && typeof questionResponses === 'object'
    ? questionResponses as SurveyResultsQuestionResponsesByQuestion
    : {}
);

const toQuestionsById = (
  questions: unknown
): Record<string, SurveyResultsQuestionRecord> => (
  questions && typeof questions === 'object'
    ? questions as Record<string, SurveyResultsQuestionRecord>
    : {}
);

const normalizeQuestionIdKey = (value: unknown): string => (
  String(value || '').trim().toLowerCase()
);

const normalizeLiveQuestionResponses = ({
  ports,
  questionResponses = {},
  requiredSessionSlug = '',
}: {
  ports: SurveyResultsQuestionModeCacheNormalizationPorts;
  questionResponses?: unknown;
  requiredSessionSlug?: unknown;
}): SurveyResultsQuestionResponsesByQuestion => {
  const out: SurveyResultsQuestionResponsesByQuestion = {};
  const normalizedRequiredSlug = String(requiredSessionSlug || '');
  const source = toQuestionResponsesByQuestion(questionResponses);

  Object.entries(source).forEach(([rawQuestionId, responderMap]) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId || !responderMap || typeof responderMap !== 'object') return;

    const kept: SurveyResultsQuestionResponsesByResponder = {};
    Object.entries(responderMap).forEach(([responder, responseData]) => {
      const parsedResponse = ports.parseResponse(responseData);
      if (ports.isDemoPolisFixtureResponse(parsedResponse)) return;
      if (!ports.isResponseAllowedForSessionSlug(parsedResponse, normalizedRequiredSlug)) return;
      kept[responder] = responseData;
    });

    if (Object.keys(kept).length > 0) out[questionId] = kept;
  });

  return out;
};

const normalizeLiveQuestionMetadata = ({
  liveQuestionIds,
  questions = {},
}: {
  liveQuestionIds: Set<string>;
  questions?: unknown;
}): Record<string, SurveyResultsQuestionRecord> => {
  const out: Record<string, SurveyResultsQuestionRecord> = {};
  const source = toQuestionsById(questions);

  Object.entries(source).forEach(([rawQuestionId, question]) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId || question?.id);
    if (!questionId) return;
    if (question?.source === 'demo-polis-data' && !liveQuestionIds.has(questionId)) return;
    out[questionId] = question;
  });

  return out;
};

export const normalizeSurveyResultsQuestionModeCache = ({
  ports,
  questionResponses = {},
  questions = {},
  requiredSessionSlug = '',
}: SurveyResultsQuestionModeCacheNormalizationArgs): SurveyResultsQuestionModeCacheNormalizationResult => {
  const liveResponses = normalizeLiveQuestionResponses({
    ports,
    questionResponses,
    requiredSessionSlug,
  });
  const liveQuestionIds = new Set(
    Object.keys(liveResponses).map((questionId) => normalizeQuestionIdKey(questionId))
  );

  return {
    liveQuestionIds,
    questionResponses: liveResponses,
    questions: normalizeLiveQuestionMetadata({
      liveQuestionIds,
      questions,
    }),
  };
};
