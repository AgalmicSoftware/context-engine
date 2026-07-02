import contractScripts from '../../utilities/web3/contractScripts.js';

export type SurveyMetadataRecord = Record<string, unknown>;
export type SurveyResponseRecord = Record<string, unknown>;

type SurveyReadOptions = Record<string, unknown>;

type SurveyReadsContractScripts = {
  getSurveyHash: (
    providerName: string,
    surveyId: string,
    groupKeyOrCfg?: unknown
  ) => Promise<string | null | undefined>;
  getSurveyDataById: (
    providerName: string,
    surveyId: string,
    groupKeyOrCfg?: unknown,
    options?: SurveyReadOptions
  ) => Promise<SurveyMetadataRecord | null>;
  getQuestionData: (
    providerName: string,
    questionId: string,
    groupKeyOrCfg?: unknown,
    options?: SurveyReadOptions
  ) => Promise<SurveyMetadataRecord | null>;
  getSurveyResponse: (
    providerName: string,
    responderAddress: string,
    surveyId: string,
    groupKeyOrCfg?: unknown,
    options?: SurveyReadOptions
  ) => Promise<SurveyResponseRecord | null>;
  getResponse: (
    providerName: string,
    responderAddress: string,
    questionId: string,
    groupKeyOrCfg?: unknown,
    options?: SurveyReadOptions
  ) => Promise<SurveyResponseRecord | null>;
};

export type SurveyReadsPort = SurveyReadsContractScripts;

type BindSurveyReadsPortArgs = {
  contractScripts: () => SurveyReadsContractScripts;
};

export const bindSurveyReadsPort = ({
  contractScripts: readContractScripts,
}: BindSurveyReadsPortArgs): SurveyReadsPort => ({
  getSurveyHash: (providerName, surveyId, groupKeyOrCfg) => (
    readContractScripts().getSurveyHash(providerName, surveyId, groupKeyOrCfg)
  ),
  getSurveyDataById: (providerName, surveyId, groupKeyOrCfg, options) => (
    options === undefined
      ? readContractScripts().getSurveyDataById(providerName, surveyId, groupKeyOrCfg)
      : readContractScripts().getSurveyDataById(providerName, surveyId, groupKeyOrCfg, options)
  ),
  getQuestionData: (providerName, questionId, groupKeyOrCfg, options) => (
    options === undefined
      ? readContractScripts().getQuestionData(providerName, questionId, groupKeyOrCfg)
      : readContractScripts().getQuestionData(providerName, questionId, groupKeyOrCfg, options)
  ),
  getSurveyResponse: (providerName, responderAddress, surveyId, groupKeyOrCfg, options) => (
    options === undefined
      ? readContractScripts().getSurveyResponse(providerName, responderAddress, surveyId, groupKeyOrCfg)
      : readContractScripts().getSurveyResponse(
        providerName,
        responderAddress,
        surveyId,
        groupKeyOrCfg,
        options
      )
  ),
  getResponse: (providerName, responderAddress, questionId, groupKeyOrCfg, options) => (
    options === undefined
      ? readContractScripts().getResponse(providerName, responderAddress, questionId, groupKeyOrCfg)
      : readContractScripts().getResponse(
        providerName,
        responderAddress,
        questionId,
        groupKeyOrCfg,
        options
      )
  ),
});

export const surveyReadsPort = bindSurveyReadsPort({
  contractScripts: () => contractScripts,
});
