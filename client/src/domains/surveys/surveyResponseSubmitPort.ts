import chainGateway from '../../utilities/web3/contractScripts.js';

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

export type BindSurveyResponseSubmitPortArgs = {
  chainGateway: () => SurveyResponseSubmitGateway;
};

export const bindSurveyResponseSubmitPort = ({
  chainGateway: readChainGateway,
}: BindSurveyResponseSubmitPortArgs): SurveyResponseSubmitPort => ({
  submitResponses: (provider, questionIds, questionResponses, surveyId, surveyResponse, submissionGroupKey) =>
    readChainGateway().submitResponses(
      provider,
      questionIds,
      questionResponses,
      surveyId,
      surveyResponse,
      submissionGroupKey,
    ),
});

export const surveyResponseSubmitPort = bindSurveyResponseSubmitPort({
  chainGateway: () => chainGateway as SurveyResponseSubmitGateway,
});
