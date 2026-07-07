type SurveyResultsLockedResponsesRecord = Record<string, unknown>;

export type SurveyResultsLockedResponsesKeyArgs = {
  questionId?: unknown;
  responder?: unknown;
  response?: unknown;
  surveyId?: unknown;
};

export type SurveyResultsLockedResponseRow = SurveyResultsLockedResponsesRecord & {
  key: string;
  mergedResponse?: SurveyResultsLockedResponsesRecord | null;
  questionId: string;
  responder: string;
  response?: SurveyResultsLockedResponsesRecord | null;
  surveyId?: unknown;
};

export type BuildSurveyResultsLockedRowsArgs = {
  aggregatorQuestionResponses?: unknown;
  applyDecryptedOverrideToResponse?: ((args: {
    key: string;
    response?: SurveyResultsLockedResponsesRecord | null;
  }) => SurveyResultsLockedResponsesRecord | null | undefined) | null;
  getLockedResponseKey?: ((args: SurveyResultsLockedResponsesKeyArgs) => string) | null;
  isBannerEligibleLockedField?: ((field: unknown) => boolean) | null;
  sbtFilteredResponses?: unknown;
  surveyId?: unknown;
  surveyViewMode?: unknown;
  viewMode?: unknown;
};

const toRecord = (value: unknown): SurveyResultsLockedResponsesRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as SurveyResultsLockedResponsesRecord
    : {}
);

const defaultGetLockedResponseKey = ({
  questionId = '',
  responder = '',
  surveyId = '',
}: SurveyResultsLockedResponsesKeyArgs): string => (
  [surveyId, questionId, responder].map((part) => String(part || '').trim().toLowerCase()).join(':')
);

const defaultApplyOverride = ({
  response = null,
}: {
  key: string;
  response?: SurveyResultsLockedResponsesRecord | null;
}): SurveyResultsLockedResponsesRecord | null => response;

const defaultIsBannerEligible = (): boolean => false;

const readResponseRecord = (response: unknown): SurveyResultsLockedResponsesRecord | null => (
  response && typeof response === 'object' && !Array.isArray(response)
    ? response as SurveyResultsLockedResponsesRecord
    : null
);

export const buildSurveyResultsLockedRows = ({
  aggregatorQuestionResponses = {},
  applyDecryptedOverrideToResponse = defaultApplyOverride,
  getLockedResponseKey = defaultGetLockedResponseKey,
  isBannerEligibleLockedField = defaultIsBannerEligible,
  sbtFilteredResponses = [],
  surveyId = '',
  surveyViewMode = '',
  viewMode = '',
}: BuildSurveyResultsLockedRowsArgs = {}): SurveyResultsLockedResponseRow[] => {
  const rows: SurveyResultsLockedResponseRow[] = [];
  const keyPort = typeof getLockedResponseKey === 'function'
    ? getLockedResponseKey
    : defaultGetLockedResponseKey;
  const overridePort = typeof applyDecryptedOverrideToResponse === 'function'
    ? applyDecryptedOverrideToResponse
    : defaultApplyOverride;
  const eligiblePort = typeof isBannerEligibleLockedField === 'function'
    ? isBannerEligibleLockedField
    : defaultIsBannerEligible;

  const pushRow = ({
    questionId,
    responder,
    response,
    rowSurveyId,
  }: {
    questionId: unknown;
    responder: unknown;
    response?: SurveyResultsLockedResponsesRecord | null;
    rowSurveyId?: unknown;
  }): void => {
    const normalizedQuestionId = String(questionId || '').trim().toLowerCase();
    if (!normalizedQuestionId) return;
    const normalizedResponder = String(responder || '').trim().toLowerCase();
    const effectiveSurveyId = rowSurveyId ?? surveyId;
    const key = keyPort({
      responder: normalizedResponder,
      questionId: normalizedQuestionId,
      surveyId: effectiveSurveyId,
      response,
    });
    const mergedResponse = overridePort({
      response,
      key,
    }) || response || null;
    if (
      !eligiblePort(mergedResponse?.answer) &&
      !eligiblePort(mergedResponse?.additional)
    ) {
      return;
    }
    rows.push({
      key,
      responder: normalizedResponder,
      surveyId: effectiveSurveyId,
      questionId: normalizedQuestionId,
      response,
      mergedResponse,
    });
  };

  if (viewMode === 'survey' && surveyViewMode === 'individuals') {
    const surveyResponses = Array.isArray(sbtFilteredResponses) ? sbtFilteredResponses : [];
    surveyResponses.forEach((surveyResponse) => {
      const row = toRecord(surveyResponse);
      const responder = String(row.responder || '').trim().toLowerCase();
      const rowSurveyId = String(row.surveyId || surveyId || '').trim().toLowerCase();
      const responseRecord = toRecord(row.response);
      const answers = Array.isArray(responseRecord.responses) ? responseRecord.responses : [];
      answers.forEach((answerItem) => {
        const answer = readResponseRecord(answerItem);
        if (!answer) return;
        pushRow({
          questionId: answer.questionID || answer.questionId,
          responder,
          response: answer,
          rowSurveyId,
        });
      });
    });
    return rows;
  }

  Object.entries(toRecord(aggregatorQuestionResponses)).forEach(([questionId, responseRows]) => {
    const aggregateRows = Array.isArray(responseRows) ? responseRows : [];
    aggregateRows.forEach((responseRow) => {
      const row = toRecord(responseRow);
      pushRow({
        questionId,
        responder: row.responder,
        response: readResponseRecord(row.response),
        rowSurveyId: surveyId,
      });
    });
  });

  return rows;
};
