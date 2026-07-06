import type {
  SessionResultsAnalysisResponseInput,
} from '../../utilities/sessionResultsExport';

type SurveyResultsAnalysisRecord = Record<string, unknown>;

export type SurveyResultsAnalysisParsePort = (response: unknown) => unknown;
export type SurveyResultsAnalysisQuestionIdPort = (response: unknown) => string;
export type SurveyResultsAnalysisQuestionMetadataPort = (
  response: unknown,
  questionData?: SurveyResultsAnalysisRecord | null
) => unknown;

export type BuildSurveyResultsAnalysisResponsesArgs = {
  aggregatorQuestionResponses?: unknown;
  filteredResponses?: unknown;
  getResponseQuestionId?: SurveyResultsAnalysisQuestionIdPort | null;
  getResponseQuestionPrompt?: SurveyResultsAnalysisQuestionMetadataPort | null;
  getResponseQuestionType?: SurveyResultsAnalysisQuestionMetadataPort | null;
  networkQuestions?: unknown;
  parseResponse?: SurveyResultsAnalysisParsePort | null;
  surveyViewMode?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsAnalysisGateEntry = {
  address?: unknown;
  label?: unknown;
};

export type SurveyResultsAnalysisSegmentDimension = {
  id: string;
  label: string;
  source: string;
  values: Array<{
    count: number;
    id: string;
    label: string;
    source?: string;
  }>;
};

export type BuildSurveyResultsAnalysisSegmentDimensionsArgs = {
  filterState?: unknown;
  getQuestionEncryptionGates?: ((question: unknown) => unknown[]) | null;
  getSbtEntryLabel?: ((entry: unknown) => string) | null;
  networkQuestions?: unknown;
  normalizeGateSbtEntries?: ((gate: unknown) => SurveyResultsAnalysisGateEntry[]) | null;
  participantCount?: unknown;
  questions?: unknown;
};

const isRecord = (value: unknown): value is SurveyResultsAnalysisRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const toRecord = (value: unknown): SurveyResultsAnalysisRecord => (
  isRecord(value) ? value : {}
);

const defaultParseResponse = (response: unknown): unknown => {
  if (isRecord(response)) return response;
  if (typeof response !== 'string') return null;
  const trimmed = response.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const defaultGetQuestionId = (response: unknown): string => {
  const record = toRecord(response);
  return String(record.questionID || record.questionId || '').trim();
};

const defaultGetQuestionPrompt = (response: unknown, questionData: SurveyResultsAnalysisRecord | null = null): unknown => {
  const responseRecord = toRecord(response);
  const questionRecord = toRecord(questionData);
  return responseRecord.prompt || questionRecord.prompt || '';
};

const defaultGetQuestionType = (response: unknown, questionData: SurveyResultsAnalysisRecord | null = null): unknown => {
  const responseRecord = toRecord(response);
  const questionRecord = toRecord(questionData);
  return responseRecord.type || questionRecord.type || questionRecord.questionType || '';
};

const isSurveyIndividualsMode = (viewMode: unknown, surveyViewMode: unknown): boolean => (
  viewMode === 'survey' && surveyViewMode === 'individuals'
);

export const readSurveyResultsAnalysisTextField = (field: unknown): string => {
  if (field === null || field === undefined) return '';
  if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') {
    return String(field).trim();
  }
  const record = toRecord(field);
  const value = record.value ?? record.text ?? record.answer;
  if (value === null || value === undefined || value === '*') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
};

export const readSurveyResultsAnalysisSafeLabel = (value: unknown): string => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (/^0x/i.test(text) || /0x[a-fA-F0-9]{6,}/.test(text)) return '';
  return text;
};

export const buildSurveyResultsAnalysisResponsesForExport = ({
  aggregatorQuestionResponses = {},
  filteredResponses = [],
  getResponseQuestionId = defaultGetQuestionId,
  getResponseQuestionPrompt = defaultGetQuestionPrompt,
  getResponseQuestionType = defaultGetQuestionType,
  networkQuestions = {},
  parseResponse = defaultParseResponse,
  surveyViewMode = '',
  viewMode = '',
}: BuildSurveyResultsAnalysisResponsesArgs = {}): SessionResultsAnalysisResponseInput[] => {
  const rows: SessionResultsAnalysisResponseInput[] = [];
  const questions = toRecord(networkQuestions);
  const parsePort = typeof parseResponse === 'function' ? parseResponse : defaultParseResponse;
  const questionIdPort = typeof getResponseQuestionId === 'function'
    ? getResponseQuestionId
    : defaultGetQuestionId;
  const questionPromptPort = typeof getResponseQuestionPrompt === 'function'
    ? getResponseQuestionPrompt
    : defaultGetQuestionPrompt;
  const questionTypePort = typeof getResponseQuestionType === 'function'
    ? getResponseQuestionType
    : defaultGetQuestionType;
  const pushRow = (
    response: unknown,
    responder: unknown,
    questionIdFallback: unknown = ''
  ): void => {
    if (!isRecord(response)) return;
    const questionId = questionIdPort(response) || String(questionIdFallback || '').trim();
    if (!questionId) return;
    const questionData = toRecord(questions[questionId.toLowerCase()] || questions[questionId]);
    const answer = readSurveyResultsAnalysisTextField(response.answer);
    const additional = readSurveyResultsAnalysisTextField(response.additional);
    if (!answer && !additional) return;
    rows.push({
      additional,
      answer,
      participantAddress: responder,
      questionId,
      questionPrompt: questionPromptPort(response, questionData),
      questionType: questionTypePort(response, questionData),
    });
  };

  if (isSurveyIndividualsMode(viewMode, surveyViewMode)) {
    const responseRows = Array.isArray(filteredResponses) ? filteredResponses : [];
    responseRows.forEach((responseRow) => {
      const row = toRecord(responseRow);
      const parsedResponse = parsePort(row.response);
      const answers = isRecord(parsedResponse) && Array.isArray(parsedResponse.responses)
        ? parsedResponse.responses
        : [];
      answers.forEach((answer) => pushRow(answer, row.responder));
    });
    return rows;
  }

  Object.entries(toRecord(aggregatorQuestionResponses)).forEach(([questionId, responsesArray]) => {
    if (!Array.isArray(responsesArray)) return;
    responsesArray.forEach((responseRow) => {
      const row = toRecord(responseRow);
      pushRow(parsePort(row.response), row.responder, questionId);
    });
  });
  return rows;
};

type SurveyResultsAnalysisCountBucket = {
  count: number;
  label: string;
  source?: string;
};

const buildSegmentValues = (
  counts: Map<string, SurveyResultsAnalysisCountBucket>
): SurveyResultsAnalysisSegmentDimension['values'] => Array.from(counts.values())
  .filter((value) => value.label)
  .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
  .map((value) => ({
    count: value.count,
    id: value.label,
    label: value.label,
    ...(value.source ? { source: value.source } : {}),
  }));

const addSbtFilterEntries = ({
  counts,
  entries,
  getSbtEntryLabel,
  prefix,
}: {
  counts: Map<string, SurveyResultsAnalysisCountBucket>;
  entries: unknown;
  getSbtEntryLabel: (entry: unknown) => string;
  prefix: string;
}): void => {
  if (!Array.isArray(entries)) return;
  entries.forEach((entry) => {
    const label = getSbtEntryLabel(entry);
    if (!label) return;
    const fullLabel = `${prefix}: ${label}`;
    const key = fullLabel.toLowerCase();
    const prev = counts.get(key) || { count: 0, label: fullLabel, source: 'sbtFilter' };
    prev.count += 1;
    counts.set(key, prev);
  });
};

export const buildSurveyResultsAnalysisSegmentDimensionsForExport = ({
  filterState = {},
  getQuestionEncryptionGates = null,
  getSbtEntryLabel = readSurveyResultsAnalysisSafeLabel,
  networkQuestions = {},
  normalizeGateSbtEntries = null,
  participantCount = 0,
  questions = [],
}: BuildSurveyResultsAnalysisSegmentDimensionsArgs = {}): SurveyResultsAnalysisSegmentDimension[] => {
  const dimensions: SurveyResultsAnalysisSegmentDimension[] = [];
  const reportQuestions = Array.isArray(questions) ? questions.map(toRecord) : [];
  const sbtLabelPort = typeof getSbtEntryLabel === 'function'
    ? getSbtEntryLabel
    : readSurveyResultsAnalysisSafeLabel;
  const gatePort = typeof getQuestionEncryptionGates === 'function'
    ? getQuestionEncryptionGates
    : () => [];
  const normalizeGatePort = typeof normalizeGateSbtEntries === 'function'
    ? normalizeGateSbtEntries
    : () => [];

  const tagCounts = new Map<string, SurveyResultsAnalysisCountBucket>();
  reportQuestions.forEach((question) => {
    const responseCount = Math.max(1, Number(question.responseCount || 0));
    (Array.isArray(question.tags) ? question.tags : []).forEach((tag) => {
      const label = readSurveyResultsAnalysisSafeLabel(tag);
      if (!label) return;
      const key = label.toLowerCase();
      const prev = tagCounts.get(key) || { count: 0, label, source: 'questionTags' };
      prev.count += responseCount;
      tagCounts.set(key, prev);
    });
  });
  const tagValues = buildSegmentValues(tagCounts);
  if (tagValues.length > 0) {
    dimensions.push({
      id: 'question_tags',
      label: 'Question Tags',
      source: 'questionTags',
      values: tagValues,
    });
  }

  const sbtFilter = toRecord(toRecord(filterState).sbtFilter);
  const sbtCounts = new Map<string, SurveyResultsAnalysisCountBucket>();
  addSbtFilterEntries({ counts: sbtCounts, entries: sbtFilter.selectedSBTGroups, getSbtEntryLabel: sbtLabelPort, prefix: 'Include' });
  addSbtFilterEntries({ counts: sbtCounts, entries: sbtFilter.selectedSBTGroupsResponder, getSbtEntryLabel: sbtLabelPort, prefix: 'Responder include' });
  addSbtFilterEntries({ counts: sbtCounts, entries: sbtFilter.selectedSBTGroupsCreator, getSbtEntryLabel: sbtLabelPort, prefix: 'Creator include' });
  addSbtFilterEntries({ counts: sbtCounts, entries: sbtFilter.excludedSBTGroups, getSbtEntryLabel: sbtLabelPort, prefix: 'Exclude' });
  addSbtFilterEntries({ counts: sbtCounts, entries: sbtFilter.excludedSBTGroupsResponder, getSbtEntryLabel: sbtLabelPort, prefix: 'Responder exclude' });
  addSbtFilterEntries({ counts: sbtCounts, entries: sbtFilter.excludedSBTGroupsCreator, getSbtEntryLabel: sbtLabelPort, prefix: 'Creator exclude' });
  if (sbtFilter.onlyVerifiedHumans) {
    sbtCounts.set('verified_humans', {
      count: Number(participantCount) || 1,
      label: 'Verified humans',
      source: 'sbtFilter',
    });
  }
  const sbtValues = buildSegmentValues(sbtCounts);
  if (sbtValues.length > 0) {
    dimensions.push({
      id: 'active_sbt_filters',
      label: 'Active SBT Filters',
      source: 'sbtFilter',
      values: sbtValues,
    });
  }

  const questionsById = toRecord(networkQuestions);
  const gateCounts = new Map<string, SurveyResultsAnalysisCountBucket>();
  reportQuestions.forEach((question) => {
    const questionId = String(question.id || '').trim();
    const questionRecord = questionsById[questionId.toLowerCase()] || questionsById[questionId] || null;
    const responseCount = Math.max(1, Number(question.responseCount || 0));
    gatePort(questionRecord).forEach((gate) => {
      normalizeGatePort(gate).forEach((entry) => {
        const label = readSurveyResultsAnalysisSafeLabel(entry.label)
          || sbtLabelPort({ address: entry.address });
        if (!label) return;
        const key = label.toLowerCase();
        const prev = gateCounts.get(key) || { count: 0, label, source: 'responseGates' };
        prev.count += responseCount;
        gateCounts.set(key, prev);
      });
    });
  });
  const gateValues = buildSegmentValues(gateCounts);
  if (gateValues.length > 0) {
    dimensions.push({
      id: 'response_gates',
      label: 'Response Gates',
      source: 'responseGates',
      values: gateValues,
    });
  }

  return dimensions;
};
