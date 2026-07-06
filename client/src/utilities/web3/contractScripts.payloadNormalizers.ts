/**
 * @module contractScriptsPayloadNormalizers
 * @description Internal payload normalization helpers shared by contractScripts internals.
 */

import { createLogger } from '../logging.js';

type PayloadRecord = Record<string, unknown>;

const contractsLog = createLogger('contracts');

const asPayloadRecord = (value: unknown): PayloadRecord | null => (
  value && typeof value === 'object' ? value as PayloadRecord : null
);

export const coerceStringArray = (value: unknown): string[] => {
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

const readOptionLabel = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  if (typeof value !== 'object') return String(value).trim();
  const record = asPayloadRecord(value) || {};
  return String(
    record.label ??
    record.text ??
    record.name ??
    record.value ??
    record.id ??
    ''
  ).trim();
};

export const coerceQuestionOptionLabels = (value: unknown): string[] => {
  let rawOptions: unknown[] = [];
  if (Array.isArray(value)) {
    rawOptions = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return coerceQuestionOptionLabels(JSON.parse(trimmed));
      } catch (err) {
        contractsLog.debug('coerceQuestionOptionLabels error:', err);
      }
    }
    rawOptions = [trimmed];
  } else if (value && typeof value === 'object') {
    rawOptions = Object.values(value as PayloadRecord);
  }

  const seen = new Set<string>();
  return rawOptions
    .map(readOptionLabel)
    .filter(Boolean)
    .filter((label) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
};

export const normalizeConvictionImportance = <T extends PayloadRecord | null | undefined>(
  responseJson: T
): T => {
  if (!responseJson || typeof responseJson !== 'object') return responseJson;
  const normalize = (obj: PayloadRecord | null | undefined): void => {
    if (!obj || typeof obj !== 'object') return;
    const hasConviction = obj.conviction !== undefined && obj.conviction !== null;
    const hasImportance = obj.importance !== undefined && obj.importance !== null;
    if (hasConviction && !hasImportance) obj.importance = obj.conviction;
    if (hasImportance && !hasConviction) obj.conviction = obj.importance;
  };
  normalize(responseJson);
  if (Array.isArray(responseJson.responses)) {
    responseJson.responses.forEach((entry: unknown) => normalize(asPayloadRecord(entry)));
  }
  return responseJson;
};

// Preserve UI flags (like singleSelect) as question payloads move into caches.
export const normalizeQuestionFlags = (questionData: PayloadRecord | null | undefined): void => {
  if (!questionData || typeof questionData !== 'object') return;
  if (questionData.singleSelect === undefined && questionData.oneSelectionOnly !== undefined) {
    questionData.singleSelect = !!questionData.oneSelectionOnly;
  } else if (questionData.singleSelect !== undefined) {
    questionData.singleSelect = !!questionData.singleSelect;
  }

  const existingOptions = coerceQuestionOptionLabels(questionData.options);
  const config = asPayloadRecord(questionData.config);
  const payload = asPayloadRecord(questionData.payload);
  const data = asPayloadRecord(questionData.data);
  const optionAliases = (
    existingOptions.length > 0
      ? questionData.options
      : questionData.choices ??
        questionData.answers ??
        questionData.choiceOptions ??
        config?.options ??
        config?.choices ??
        payload?.options ??
        data?.options ??
        questionData.optionsMap ??
        questionData.options_by_id
  );
  const normalizedOptions = coerceQuestionOptionLabels(optionAliases);
  if (normalizedOptions.length > 0) {
    questionData.options = normalizedOptions;
  }
};
