import chainGateway from '../../utilities/web3/chainGateway.js';

export type SurveyResponseSubmitGateway = {
  submitResponses: (
    provider: unknown,
    questionIds: unknown,
    questionResponses: unknown,
    surveyId: unknown,
    surveyResponse: unknown,
    submissionGroupKey: unknown,
  ) => Promise<unknown>;
};

export type SurveyResponseSubmitPort = SurveyResponseSubmitGateway;

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
