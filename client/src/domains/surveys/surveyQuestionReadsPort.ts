import chainGateway from '../../utilities/web3/chainGateway.js';

export type SurveyQuestionReadRecord = Record<string, unknown>;
export type SurveyQuestionReadOptions = Record<string, unknown>;

export type SurveyQuestionReadsGateway = {
  getQuestionData: (
    provider: unknown,
    questionId: unknown,
    groupKeyOrCfg?: unknown,
    options?: SurveyQuestionReadOptions,
  ) => Promise<SurveyQuestionReadRecord | null | undefined>;
  getSurveyDataById: (
    provider: unknown,
    surveyId: unknown,
    groupKeyOrCfg?: unknown,
    options?: SurveyQuestionReadOptions,
  ) => Promise<SurveyQuestionReadRecord | null | undefined>;
  getResponse: (
    provider: unknown,
    responderAddress: unknown,
    questionId: unknown,
    groupKeyOrCfg?: unknown,
    options?: SurveyQuestionReadOptions,
  ) => Promise<SurveyQuestionReadRecord | null | undefined>;
  getResponseHash: (
    provider: unknown,
    responderAddress: unknown,
    questionId: unknown,
    groupKeyOrCfg?: unknown,
  ) => Promise<unknown>;
  getSurveyResponse: (
    provider: unknown,
    responderAddress: unknown,
    surveyId: unknown,
    groupKeyOrCfg?: unknown,
    options?: SurveyQuestionReadOptions,
  ) => Promise<SurveyQuestionReadRecord | null | undefined>;
};

export type SurveyQuestionReadsPort = SurveyQuestionReadsGateway;

export const surveyQuestionReadsPort: SurveyQuestionReadsPort = {
  getQuestionData: (provider, questionId, groupKeyOrCfg, options) =>
    options === undefined
      ? chainGateway.getQuestionData(provider, questionId, groupKeyOrCfg)
      : chainGateway.getQuestionData(provider, questionId, groupKeyOrCfg, options),
  getSurveyDataById: (provider, surveyId, groupKeyOrCfg, options) =>
    options === undefined
      ? chainGateway.getSurveyDataById(provider, surveyId, groupKeyOrCfg)
      : chainGateway.getSurveyDataById(provider, surveyId, groupKeyOrCfg, options),
  getResponse: (provider, responderAddress, questionId, groupKeyOrCfg, options) =>
    options === undefined
      ? chainGateway.getResponse(provider, responderAddress, questionId, groupKeyOrCfg)
      : chainGateway.getResponse(provider, responderAddress, questionId, groupKeyOrCfg, options),
  getResponseHash: (provider, responderAddress, questionId, groupKeyOrCfg) =>
    chainGateway.getResponseHash(provider, responderAddress, questionId, groupKeyOrCfg),
  getSurveyResponse: (provider, responderAddress, surveyId, groupKeyOrCfg, options) =>
    options === undefined
      ? chainGateway.getSurveyResponse(provider, responderAddress, surveyId, groupKeyOrCfg)
      : chainGateway.getSurveyResponse(provider, responderAddress, surveyId, groupKeyOrCfg, options),
};
