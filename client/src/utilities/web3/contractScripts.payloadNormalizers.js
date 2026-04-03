/**
 * @module contractScriptsPayloadNormalizers
 * @description Internal payload normalization helpers shared by contractScripts internals.
 */

import { createLogger } from '../logging.js';

const contractsLog = createLogger('contracts');

export const coerceStringArray = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v));
      } catch (err) {
        contractsLog.debug('coerceStringArray error:', err);
      }
    }
    return trimmed ? [trimmed] : [];
  }
  return [];
};

export const normalizeConvictionImportance = (responseJson) => {
  if (!responseJson || typeof responseJson !== 'object') return responseJson;
  const normalize = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    const hasConviction = obj.conviction !== undefined && obj.conviction !== null;
    const hasImportance = obj.importance !== undefined && obj.importance !== null;
    if (hasConviction && !hasImportance) obj.importance = obj.conviction;
    if (hasImportance && !hasConviction) obj.conviction = obj.importance;
  };
  normalize(responseJson);
  if (Array.isArray(responseJson.responses)) {
    responseJson.responses.forEach(normalize);
  }
  return responseJson;
};

// Preserve UI flags (like singleSelect) as question payloads move into caches.
export const normalizeQuestionFlags = (questionData) => {
  if (!questionData || typeof questionData !== 'object') return;
  if (questionData.singleSelect === undefined && questionData.oneSelectionOnly !== undefined) {
    questionData.singleSelect = !!questionData.oneSelectionOnly;
  } else if (questionData.singleSelect !== undefined) {
    questionData.singleSelect = !!questionData.singleSelect;
  }
};
