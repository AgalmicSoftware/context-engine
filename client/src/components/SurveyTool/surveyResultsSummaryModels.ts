import { isFreeformBlankAnswer } from '../../utilities/survey/freeformAnswerUtils.js';
import { getSurveyResponseAggregateTimestampMs } from './surveyResultsHelpers.js';

type SurveyResultsRecord = Record<string, unknown>;

type SurveyResultsSummaryAnswerField = SurveyResultsRecord & {
  encrypted?: unknown;
  value?: unknown;
};

type SurveyResultsSummaryResponsePayload = SurveyResultsRecord & {
  additional?: SurveyResultsSummaryAnswerField | null;
  answer?: SurveyResultsSummaryAnswerField | null;
  questionType?: unknown;
  type?: unknown;
};

export type SurveyResultsSummaryResponseRow = SurveyResultsRecord & {
  response?: SurveyResultsSummaryResponsePayload | null;
  responder?: unknown;
};

export type SurveyResultsFreeformDisplayedResponse = {
  additional: string;
  responder: unknown;
  value: unknown;
};

export type SurveyResultsFreeformSummaryModel = {
  blankCount: number;
  displayedResponses: SurveyResultsFreeformDisplayedResponse[];
  encryptedCount: number;
  totalResponses: number;
};

type SurveyResultsMultichoiceSummaryOption = {
  count: number;
  key: string;
  label: string;
};

export type SurveyResultsMultichoiceSummaryModel = {
  options: SurveyResultsMultichoiceSummaryOption[];
  totalResponders: number;
};

export type SurveyResultsQuestionTableEntry = {
  prompt?: string;
  questionId: string;
  responsesCount?: number;
  sessionSlug?: string;
  type?: string;
};

type BuildSurveyResultsQuestionTableEntriesArgs = {
  networkQuestions?: unknown;
  questionMap?: unknown;
  sortAsc?: unknown;
  sortBy?: unknown;
};

export const resolveSurveyResultsSummaryQuestionType = (
  question: SurveyResultsRecord | null = null,
  responses: unknown = [],
): string => {
  const resolvedType = String(question?.type || '')
    .trim()
    .toLowerCase();
  const isFreeform = resolvedType === 'freeform' || resolvedType === 'text';
  if (isFreeform) return 'freeform';
  if (resolvedType) return resolvedType;
  const responseRows = Array.isArray(responses) ? (responses as SurveyResultsSummaryResponseRow[]) : [];
  for (let index = 0; index < responseRows.length; index += 1) {
    const inferredType = String(
      responseRows[index]?.response?.type ||
        responseRows[index]?.response?.questionType ||
        responseRows[index]?.response?.answer?.type ||
        '',
    )
      .trim()
      .toLowerCase();
    const inferredIsFreeform = inferredType === 'freeform' || inferredType === 'text';
    if (inferredIsFreeform) return 'freeform';
    if (inferredType) return inferredType;
  }
  return '';
};

export const getSurveyResultsLatestResponsesByResponder = (
  responses: unknown = [],
): SurveyResultsSummaryResponseRow[] => {
  const responseRows = Array.isArray(responses) ? (responses as SurveyResultsSummaryResponseRow[]) : [];
  const latestByResponder = new Map<string, SurveyResultsSummaryResponseRow>();
  responseRows.forEach((row, index) => {
    const responderKey = String(row?.responder || `__row_${index}`)
      .trim()
      .toLowerCase();
    const timestamp = getSurveyResponseAggregateTimestampMs(row?.response, row);
    const existing = latestByResponder.get(responderKey);
    const existingTimestamp = getSurveyResponseAggregateTimestampMs(existing?.response, existing);
    if (!existing || timestamp >= existingTimestamp) {
      latestByResponder.set(responderKey, row);
    }
  });
  return Array.from(latestByResponder.values());
};

export const buildSurveyResultsQuestionTableEntries = ({
  networkQuestions = {},
  questionMap = {},
  sortAsc = true,
  sortBy = '',
}: BuildSurveyResultsQuestionTableEntriesArgs = {}): SurveyResultsQuestionTableEntry[] => {
  const questionRecord = Object(questionMap || {}) as Record<string, unknown>;
  const networkQuestionRecord = Object(networkQuestions || {}) as Record<string, SurveyResultsRecord | undefined>;
  const entries = Object.keys(questionRecord).map((questionId) => {
    const responses = questionRecord[questionId] || [];
    const lowerQuestionId = questionId.toLowerCase();
    const questionData = networkQuestionRecord[lowerQuestionId] || {};
    return {
      questionId,
      responsesCount: getSurveyResultsLatestResponsesByResponder(responses).length,
      type: String(questionData.type || ''),
      prompt: String(questionData.prompt || ''),
      sessionSlug: String(questionData.sessionSlug || ''),
    };
  });

  const normalizedSortBy = String(sortBy || '');
  const ascending = sortAsc !== false;
  entries.sort((a, b) => {
    let comparison = 0;
    if (normalizedSortBy === 'responses') {
      comparison = a.responsesCount - b.responsesCount;
    } else if (normalizedSortBy === 'type') {
      comparison = a.type.localeCompare(b.type);
    } else if (normalizedSortBy === 'prompt') {
      comparison = a.prompt.localeCompare(b.prompt);
    }
    return ascending ? comparison : -comparison;
  });

  return entries;
};

export const buildSurveyResultsFreeformSummaryModel = (responses: unknown = []): SurveyResultsFreeformSummaryModel => {
  const latestRows = getSurveyResultsLatestResponsesByResponder(responses);

  let encryptedCount = 0;
  let blankCount = 0;
  const displayedResponses: SurveyResultsFreeformDisplayedResponse[] = [];

  latestRows.forEach((row) => {
    const parsedResponse = row?.response;
    if (!parsedResponse || !parsedResponse.answer) {
      blankCount += 1;
      return;
    }

    if (isFreeformBlankAnswer('freeform', parsedResponse)) {
      blankCount += 1;
      return;
    }

    const isEncryptedPlaceholder = parsedResponse.answer.encrypted === true && parsedResponse.answer.value === '*';
    if (isEncryptedPlaceholder) {
      encryptedCount += 1;
      return;
    }

    const additionalEncrypted = parsedResponse.additional?.encrypted === true;
    const rawAdditional = additionalEncrypted ? '' : parsedResponse.additional?.value || '';
    const safeAdditional = typeof rawAdditional === 'string' ? rawAdditional : JSON.stringify(rawAdditional);

    displayedResponses.push({
      responder: row?.responder || '',
      value: parsedResponse.answer.value,
      additional: safeAdditional,
    });
  });

  const totalResponses = Math.max(latestRows.length - blankCount, 0);
  return {
    totalResponses,
    encryptedCount,
    blankCount,
    displayedResponses,
  };
};

export const buildSurveyResultsMultichoiceSummaryModel = (
  responses: unknown = [],
  question: SurveyResultsRecord | null = null,
): SurveyResultsMultichoiceSummaryModel => {
  const latestRows = getSurveyResultsLatestResponsesByResponder(responses);
  const normalizeChoiceLabel = (choice: unknown) => {
    if (typeof choice === 'string') return choice;
    if (!choice || typeof choice !== 'object') return '';
    const choiceRecord = choice as SurveyResultsRecord;
    return choiceRecord.label ?? choiceRecord.text ?? choiceRecord.name ?? choiceRecord.value ?? '';
  };

  const displayByKey = new Map<string, string>();
  const addOption = (option: unknown) => {
    const label = String(normalizeChoiceLabel(option) || '').trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (!displayByKey.has(key)) {
      displayByKey.set(key, label);
    }
  };

  (Array.isArray(question?.options) ? question.options : []).forEach(addOption);

  if (displayByKey.size === 0) {
    latestRows.forEach((row) => {
      const value = row?.response?.answer?.value;
      const items = Array.isArray(value) ? value : value == null ? [] : [value];
      items.forEach(addOption);
    });
  }

  const countsByKey = new Map<string, number>();
  Array.from(displayByKey.keys()).forEach((key) => countsByKey.set(key, 0));

  let totalResponders = 0;
  latestRows.forEach((row) => {
    const parsedResponse = row?.response;
    if (!parsedResponse?.answer || parsedResponse.answer.encrypted === true) return;
    const value = parsedResponse.answer.value;
    const items = Array.isArray(value) ? value : value == null ? [] : [value];
    const picks = new Set<string>();
    items.forEach((choice) => {
      const label = String(normalizeChoiceLabel(choice) || '').trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (displayByKey.has(key)) {
        picks.add(key);
      }
    });
    if (picks.size === 0) return;
    totalResponders += 1;
    picks.forEach((key) => {
      countsByKey.set(key, (countsByKey.get(key) || 0) + 1);
    });
  });

  return {
    totalResponders,
    options: Array.from(displayByKey.entries()).map(([key, label]) => ({
      key,
      label,
      count: countsByKey.get(key) || 0,
    })),
  };
};
