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
  // The Arweave link of a question or response record. Records carry uploader
  // data: a field that is not an Arweave id, or whose text conversion throws,
  // gives no link.
  buildQuestionArweaveHref: (question, options) => {
    let arweaveTxId: string;
    try {
      arweaveTxId = storageRefs.getLegacyArweaveTxId(question);
    } catch {
      return '';
    }
    return arweaveUrls.toSafeArweaveLinkHref(arweaveTxId, options);
  },
};
