import * as noLeakPayloads from '../../utilities/arweave/noLeakPayloads.js';
import * as arweaveUrls from '../../utilities/arweave/arweaveUrls.js';
import * as storageRefs from '../../utilities/storage/storageRefs.js';

export type SurveyResponseStorageNoLeakModule = Pick<
  typeof noLeakPayloads,
  'sanitizeQuestionPromptForResponsePayload' | 'sanitizeSurveyTitleForResponsePayload'
>;
export type SurveyResponseStorageArweaveUrlModule = Pick<typeof arweaveUrls, 'normalizeArweaveUrl'>;
export type SurveyResponseStorageRefModule = Pick<typeof storageRefs, 'getLegacyArweaveTxId'>;

export type SurveyResponseStoragePort = {
  sanitizeQuestionPromptForResponsePayload: typeof noLeakPayloads.sanitizeQuestionPromptForResponsePayload;
  sanitizeSurveyTitleForResponsePayload: typeof noLeakPayloads.sanitizeSurveyTitleForResponsePayload;
  getLegacyArweaveTxId: typeof storageRefs.getLegacyArweaveTxId;
  normalizeArweaveUrl: typeof arweaveUrls.normalizeArweaveUrl;
  buildQuestionArweaveHref: (
    question: unknown,
    options?: Parameters<typeof arweaveUrls.normalizeArweaveUrl>[1],
  ) => string;
};

export type BindSurveyResponseStoragePortArgs = {
  noLeakPayloads: () => SurveyResponseStorageNoLeakModule;
  arweaveUrls: () => SurveyResponseStorageArweaveUrlModule;
  storageRefs: () => SurveyResponseStorageRefModule;
};

export const bindSurveyResponseStoragePort = ({
  noLeakPayloads: readNoLeakPayloads,
  arweaveUrls: readArweaveUrls,
  storageRefs: readStorageRefs,
}: BindSurveyResponseStoragePortArgs): SurveyResponseStoragePort => ({
  sanitizeQuestionPromptForResponsePayload: (question, options) =>
    readNoLeakPayloads().sanitizeQuestionPromptForResponsePayload(question, options),
  sanitizeSurveyTitleForResponsePayload: (survey, options) =>
    readNoLeakPayloads().sanitizeSurveyTitleForResponsePayload(survey, options),
  getLegacyArweaveTxId: (record, options) => readStorageRefs().getLegacyArweaveTxId(record, options),
  normalizeArweaveUrl: (value, options) => readArweaveUrls().normalizeArweaveUrl(value, options),
  buildQuestionArweaveHref: (question, options) => {
    const arweaveTxId = readStorageRefs().getLegacyArweaveTxId(question);
    return arweaveTxId ? readArweaveUrls().normalizeArweaveUrl(arweaveTxId, options) : '';
  },
});

export const surveyResponseStoragePort = bindSurveyResponseStoragePort({
  noLeakPayloads: () => noLeakPayloads,
  arweaveUrls: () => arweaveUrls,
  storageRefs: () => storageRefs,
});
