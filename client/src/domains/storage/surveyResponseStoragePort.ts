import * as noLeakPayloads from '../../utilities/arweave/noLeakPayloads.js';
import * as arweaveUrls from '../../utilities/arweave/arweaveUrls.js';
import * as storageRefs from '../../utilities/storage/storageRefs.js';

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

export const surveyResponseStoragePort: SurveyResponseStoragePort = {
  sanitizeQuestionPromptForResponsePayload: (question, options) =>
    noLeakPayloads.sanitizeQuestionPromptForResponsePayload(question, options),
  sanitizeSurveyTitleForResponsePayload: (survey, options) =>
    noLeakPayloads.sanitizeSurveyTitleForResponsePayload(survey, options),
  getLegacyArweaveTxId: (record, options) => storageRefs.getLegacyArweaveTxId(record, options),
  normalizeArweaveUrl: (value, options) => arweaveUrls.normalizeArweaveUrl(value, options),
  // Question records carry uploader data, so only a safe gateway link may come back.
  buildQuestionArweaveHref: (question, options) =>
    arweaveUrls.toSafeArweaveLinkHref(storageRefs.getLegacyArweaveTxId(question), options),
};
