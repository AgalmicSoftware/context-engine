type SurveyResultsRecord = Record<string, unknown>;

export type SurveyResultsQuestionMetadataReadIdentity = {
  activeSessionSlug: string;
  currentSurveyId: string;
  questionId: string;
  viewMode: string;
};

export type SurveyResultsQuestionMetadataReadControllerPorts = {
  readNetworkQuestions?: (identity: SurveyResultsQuestionMetadataReadIdentity) => unknown;
};

export type SurveyResultsQuestionMetadataReadControllerArgs = {
  identity?: Partial<SurveyResultsQuestionMetadataReadIdentity>;
  ports?: SurveyResultsQuestionMetadataReadControllerPorts;
  preloadedNetworkQuestions?: unknown;
};

export type SurveyResultsQuestionMetadataReadControllerResult = {
  identity: SurveyResultsQuestionMetadataReadIdentity;
  metadataStatus: 'ready' | 'missing' | 'loading';
  networkQuestions: Record<string, SurveyResultsRecord>;
  question: SurveyResultsRecord | null;
  selectedNetworkQuestions: Record<string, SurveyResultsRecord>;
  statePatch: SurveyResultsRecord;
};

const normalizeIdentity = (
  identity: Partial<SurveyResultsQuestionMetadataReadIdentity> = {},
): SurveyResultsQuestionMetadataReadIdentity => ({
  activeSessionSlug: String(identity.activeSessionSlug || ''),
  currentSurveyId: String(identity.currentSurveyId || ''),
  questionId: String(identity.questionId || ''),
  viewMode: String(identity.viewMode || ''),
});

const toQuestionMap = (value: unknown): Record<string, SurveyResultsRecord> =>
  value && typeof value === 'object' ? (value as Record<string, SurveyResultsRecord>) : {};

const resolveMetadataStatus = (
  question: SurveyResultsRecord | null,
): SurveyResultsQuestionMetadataReadControllerResult['metadataStatus'] => {
  if (!question) return 'missing';
  return question.__ceQuestionMetadataPending === true ? 'loading' : 'ready';
};

export const runSurveyResultsQuestionMetadataReadController = ({
  identity = {},
  ports = {},
  preloadedNetworkQuestions,
}: SurveyResultsQuestionMetadataReadControllerArgs = {}): SurveyResultsQuestionMetadataReadControllerResult => {
  const normalizedIdentity = normalizeIdentity(identity);
  const rawNetworkQuestions =
    preloadedNetworkQuestions != null
      ? preloadedNetworkQuestions
      : typeof ports.readNetworkQuestions === 'function'
        ? ports.readNetworkQuestions(normalizedIdentity)
        : {};
  const networkQuestions = toQuestionMap(rawNetworkQuestions);
  const questionKey = normalizedIdentity.questionId.toLowerCase();
  const question =
    questionKey && networkQuestions[questionKey] && typeof networkQuestions[questionKey] === 'object'
      ? networkQuestions[questionKey]
      : null;
  const selectedNetworkQuestions = questionKey && question ? { [questionKey]: question } : {};

  return {
    identity: normalizedIdentity,
    metadataStatus: resolveMetadataStatus(question),
    networkQuestions,
    question,
    selectedNetworkQuestions,
    statePatch: {},
  };
};
