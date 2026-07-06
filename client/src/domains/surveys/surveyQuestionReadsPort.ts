import contractScripts from '../../utilities/web3/contractScripts.js';

export type SurveyQuestionReadRecord = Record<string, unknown>;
export type SurveyQuestionReadOptions = Record<string, unknown>;

export type SurveyQuestionReadsGateway = {
  getQuestionData: (
    provider: unknown,
    questionId: unknown,
    groupKeyOrCfg?: unknown,
    options?: SurveyQuestionReadOptions
  ) => Promise<SurveyQuestionReadRecord | null | undefined>;
  getSurveyDataById: (
    provider: unknown,
    surveyId: unknown,
    groupKeyOrCfg?: unknown,
    options?: SurveyQuestionReadOptions
  ) => Promise<SurveyQuestionReadRecord | null | undefined>;
  getResponse: (
    provider: unknown,
    responderAddress: unknown,
    questionId: unknown,
    groupKeyOrCfg?: unknown,
    options?: SurveyQuestionReadOptions
  ) => Promise<SurveyQuestionReadRecord | null | undefined>;
  getResponseHash: (
    provider: unknown,
    responderAddress: unknown,
    questionId: unknown,
    groupKeyOrCfg?: unknown
  ) => Promise<unknown>;
  getSurveyResponse: (
    provider: unknown,
    responderAddress: unknown,
    surveyId: unknown,
    groupKeyOrCfg?: unknown,
    options?: SurveyQuestionReadOptions
  ) => Promise<SurveyQuestionReadRecord | null | undefined>;
};

export type SurveyQuestionReadsPort = SurveyQuestionReadsGateway;

export type BindSurveyQuestionReadsPortArgs = {
  chainGateway: () => SurveyQuestionReadsGateway;
};

export const bindSurveyQuestionReadsPort = ({
  chainGateway: readChainGateway,
}: BindSurveyQuestionReadsPortArgs): SurveyQuestionReadsPort => ({
  getQuestionData: (provider, questionId, groupKeyOrCfg, options) => (
    options === undefined
      ? readChainGateway().getQuestionData(provider, questionId, groupKeyOrCfg)
      : readChainGateway().getQuestionData(provider, questionId, groupKeyOrCfg, options)
  ),
  getSurveyDataById: (provider, surveyId, groupKeyOrCfg, options) => (
    options === undefined
      ? readChainGateway().getSurveyDataById(provider, surveyId, groupKeyOrCfg)
      : readChainGateway().getSurveyDataById(provider, surveyId, groupKeyOrCfg, options)
  ),
  getResponse: (provider, responderAddress, questionId, groupKeyOrCfg, options) => (
    options === undefined
      ? readChainGateway().getResponse(provider, responderAddress, questionId, groupKeyOrCfg)
      : readChainGateway().getResponse(provider, responderAddress, questionId, groupKeyOrCfg, options)
  ),
  getResponseHash: (provider, responderAddress, questionId, groupKeyOrCfg) => (
    readChainGateway().getResponseHash(provider, responderAddress, questionId, groupKeyOrCfg)
  ),
  getSurveyResponse: (provider, responderAddress, surveyId, groupKeyOrCfg, options) => (
    options === undefined
      ? readChainGateway().getSurveyResponse(provider, responderAddress, surveyId, groupKeyOrCfg)
      : readChainGateway().getSurveyResponse(provider, responderAddress, surveyId, groupKeyOrCfg, options)
  ),
});

export const surveyQuestionReadsPort = bindSurveyQuestionReadsPort({
  chainGateway: () => contractScripts as SurveyQuestionReadsGateway,
});
