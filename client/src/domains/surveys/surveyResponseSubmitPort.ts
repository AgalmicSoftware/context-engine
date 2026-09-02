import chainGateway from '../../utilities/web3/chainGateway.js';

export type SurveyResponseProvider = string;
export type SurveyResponseIdentifier = string | number | null | undefined;
export type SurveyResponsePayload = Record<string, unknown>;
export type SurveyResponseSessionTarget = string | Record<string, unknown> | null | undefined;

export type WorkerCanonicalSurveySubmission = {
  workerCanonicalSubmission: true;
  sessionSlug: string;
  storageRefs: unknown[];
};

export type SurveyResponseTransactionResult = Record<string, unknown> & {
  transactionHash?: string;
};

export type SurveyResponseSubmissionResult =
  | SurveyResponseTransactionResult
  | WorkerCanonicalSurveySubmission
  | undefined;

export type SurveyResponseSubmitPort = {
  submitResponses: (
    provider: SurveyResponseProvider,
    questionIds: SurveyResponseIdentifier[],
    questionResponses: SurveyResponsePayload[],
    surveyId: SurveyResponseIdentifier,
    surveyResponse: SurveyResponsePayload | null | undefined,
    submissionGroupKey: SurveyResponseSessionTarget,
  ) => Promise<SurveyResponseSubmissionResult>;
};

export const surveyResponseSubmitPort: SurveyResponseSubmitPort = {
  submitResponses: (provider, questionIds, questionResponses, surveyId, surveyResponse, submissionGroupKey) =>
    chainGateway.submitResponses(
      provider,
      questionIds,
      questionResponses,
      surveyId,
      surveyResponse,
      submissionGroupKey,
    ),
};
