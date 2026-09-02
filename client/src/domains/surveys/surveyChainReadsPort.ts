import chainGateway from '../../utilities/web3/chainGateway.js';

export type SurveyMetadataRecord = Record<string, unknown>;
export type SurveyResponseRecord = Record<string, unknown>;

type SurveyReadOptions = Record<string, unknown>;

export type SurveyReadsPort = {
  getSurveyHash: (
    providerName: string,
    surveyId: string,
    groupKeyOrCfg?: unknown,
  ) => Promise<string | null | undefined>;
  getSurveyDataById: (
    providerName: string,
    surveyId: string,
    groupKeyOrCfg?: unknown,
    options?: SurveyReadOptions,
  ) => Promise<SurveyMetadataRecord | null>;
  getQuestionData: (
    providerName: string,
    questionId: string,
    groupKeyOrCfg?: unknown,
    options?: SurveyReadOptions,
  ) => Promise<SurveyMetadataRecord | null>;
  getSurveyResponse: (
    providerName: string,
    responderAddress: string,
    surveyId: string,
    groupKeyOrCfg?: unknown,
    options?: SurveyReadOptions,
  ) => Promise<SurveyResponseRecord | null>;
  getResponse: (
    providerName: string,
    responderAddress: string,
    questionId: string,
    groupKeyOrCfg?: unknown,
    options?: SurveyReadOptions,
  ) => Promise<SurveyResponseRecord | null>;
};

export const surveyReadsPort: SurveyReadsPort = {
  getSurveyHash: (providerName, surveyId, groupKeyOrCfg) =>
    chainGateway.getSurveyHash(providerName, surveyId, groupKeyOrCfg),
  getSurveyDataById: (providerName, surveyId, groupKeyOrCfg, options) =>
    options === undefined
      ? chainGateway.getSurveyDataById(providerName, surveyId, groupKeyOrCfg)
      : chainGateway.getSurveyDataById(providerName, surveyId, groupKeyOrCfg, options),
  getQuestionData: (providerName, questionId, groupKeyOrCfg, options) =>
    options === undefined
      ? chainGateway.getQuestionData(providerName, questionId, groupKeyOrCfg)
      : chainGateway.getQuestionData(providerName, questionId, groupKeyOrCfg, options),
  getSurveyResponse: (providerName, responderAddress, surveyId, groupKeyOrCfg, options) =>
    options === undefined
      ? chainGateway.getSurveyResponse(providerName, responderAddress, surveyId, groupKeyOrCfg)
      : chainGateway.getSurveyResponse(providerName, responderAddress, surveyId, groupKeyOrCfg, options),
  getResponse: (providerName, responderAddress, questionId, groupKeyOrCfg, options) =>
    options === undefined
      ? chainGateway.getResponse(providerName, responderAddress, questionId, groupKeyOrCfg)
      : chainGateway.getResponse(providerName, responderAddress, questionId, groupKeyOrCfg, options),
};
