import { QUESTION_CACHE_PREFIX, questionMemoryCache, SELECTORS, QUESTIONS_ADDED_TOPIC0, encodeAbiStringArg, decodeSessionTuple, decodeBytes32ArrayFromData, hexToBase64url } from './registryQuestionCore.mjs';
import { resolveScanWindow, scanQuestionIds } from './registryQuestionSource.mjs';
import { normalizeQuestionPayload } from './registryQuestionPayloads.mjs';
import { cacheKey, isPayloadUnavailableQuestion } from './registryQuestionCache.mjs';

export const __test__sessionQuestions = {
  QUESTION_CACHE_PREFIX,
  QUESTIONS_ADDED_TOPIC0,
  SELECTORS,
  cacheKey,
  clearCaches() {
    questionMemoryCache.clear();
  },
  decodeBytes32ArrayFromData,
  decodeSessionTuple,
  encodeAbiStringArg,
  hexToBase64url,
  normalizeQuestionPayload,
  isPayloadUnavailableQuestion,
  questionMemoryCache,
  resolveScanWindow,
  scanQuestionIds,
};
