export type QuestionDecryptBusyToken = number;
export type QuestionDecryptBusyTokens = Record<string, unknown>;

export interface QuestionDecryptBusyTokenHost {
  _questionDecryptBusyTokenSeq: QuestionDecryptBusyToken;
  _questionDecryptBusyTokens: QuestionDecryptBusyTokens;
}

export interface QuestionDecryptBusyTokenRegistration {
  token: QuestionDecryptBusyToken;
  busyTokens: QuestionDecryptBusyTokens;
}

export interface QuestionDecryptOwnedClearResult {
  busyTokens: QuestionDecryptBusyTokens;
  statePatch: unknown;
}

export interface SurveyDecryptMountHost {
  _isMounted: boolean;
}

export interface SurveyDecryptAttemptHost extends SurveyDecryptMountHost {
  _surveyDecryptAttemptSeq: number;
  _activeSurveyDecryptAttemptSeq: number;
}

export type SurveyDecryptContextSnapshot = {
  mounted?: boolean;
  [key: string]: unknown;
} | null;

export type BuildSurveyDecryptContextKey = (snapshot: SurveyDecryptContextSnapshot) => string;

export const applyQuestionDecryptBusyTokenRegistration = (
  host: QuestionDecryptBusyTokenHost,
  registration: QuestionDecryptBusyTokenRegistration,
): QuestionDecryptBusyToken => {
  host._questionDecryptBusyTokenSeq = registration.token;
  host._questionDecryptBusyTokens = registration.busyTokens;
  return registration.token;
};

export const replaceQuestionDecryptBusyTokens = (
  host: QuestionDecryptBusyTokenHost,
  busyTokens: QuestionDecryptBusyTokens,
): QuestionDecryptBusyTokens => {
  host._questionDecryptBusyTokens = busyTokens;
  return busyTokens;
};

export const canUpdateStateForAsyncSnapshot = (
  host: SurveyDecryptMountHost,
  snapshot: SurveyDecryptContextSnapshot,
): boolean => !!snapshot && (!snapshot.mounted || host._isMounted);

export const isDecryptContextCurrentForHost = ({
  host,
  snapshot,
  currentSnapshot,
  buildDecryptContextKey,
}: {
  host: SurveyDecryptMountHost;
  snapshot: SurveyDecryptContextSnapshot;
  currentSnapshot: SurveyDecryptContextSnapshot;
  buildDecryptContextKey: BuildSurveyDecryptContextKey;
}): boolean =>
  canUpdateStateForAsyncSnapshot(host, snapshot) &&
  buildDecryptContextKey(snapshot) === buildDecryptContextKey(currentSnapshot);

export const startSurveyDecryptAttemptOnHost = (host: SurveyDecryptAttemptHost): number => {
  const attemptId = (Number(host._surveyDecryptAttemptSeq) || 0) + 1;
  host._surveyDecryptAttemptSeq = attemptId;
  host._activeSurveyDecryptAttemptSeq = attemptId;
  return attemptId;
};

export const canUpdateSurveyDecryptAttemptOnHost = (
  host: SurveyDecryptAttemptHost,
  snapshot: SurveyDecryptContextSnapshot,
  attemptId: number | null,
): boolean =>
  canUpdateStateForAsyncSnapshot(host, snapshot) &&
  Number(attemptId || 0) > 0 &&
  host._activeSurveyDecryptAttemptSeq === attemptId;

export const finishSurveyDecryptAttemptOnHost = (host: SurveyDecryptAttemptHost, attemptId: number | null): void => {
  if (Number(attemptId || 0) > 0 && host._activeSurveyDecryptAttemptSeq === attemptId) {
    host._activeSurveyDecryptAttemptSeq = 0;
  }
};
