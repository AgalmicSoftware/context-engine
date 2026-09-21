import { validateQuadraticAllocation } from '../../../../shared/questions/quadraticAllocation.mjs';
import { isResponseAllowedForSessionSlug } from '../../utilities/session/responseSessionScope';

export type ReportRecord = Record<string, unknown>;
export type AnswerType = 'freeform' | 'rating' | 'multichoice' | 'quadratic';
export type ReportAnswerQuestion = {
  id: string;
  type: AnswerType;
  prompt: string;
  count: number;
  texts: string[];
  average: number;
  min: number;
  max: number;
  bins: { score: number; count: number }[];
  options: { label: string; count: number; positive: number; negative: number; net: number }[];
};
export const answerTypeTitles: Record<AnswerType, string> = {
  freeform: 'Freeform',
  rating: 'Ratings',
  multichoice: 'Multiple choice',
  quadratic: 'Quadratic allocation',
};
export const record = (value: unknown): ReportRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ReportRecord) : {};
export function parseReportResponse(value: unknown): ReportRecord {
  if (typeof value !== 'string') return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}
const label = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
export function reportQuestionMetadata(meta: unknown, payload: ReportRecord): ReportRecord {
  return { ...payload, ...record(meta) };
}
export function normalizePolisBinaryVote(value: unknown): -1 | 0 | 1 | null {
  if (value === 1) return 1;
  if (value === -1) return -1;
  if (value === 0) return 0;
  if (value === true) return 1;
  if (value === false) return -1;

  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (
    normalized === 'agree' ||
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'true' ||
    normalized === '1'
  ) {
    return 1;
  }
  if (
    normalized === 'disagree' ||
    normalized === 'no' ||
    normalized === 'n' ||
    normalized === 'false' ||
    normalized === '-1'
  ) {
    return -1;
  }
  if (
    normalized === 'unsure' ||
    normalized === 'unknown' ||
    normalized === 'maybe' ||
    normalized === 'neutral' ||
    normalized === '0'
  ) {
    return 0;
  }
  return null;
}

export function readReportAnswer(payload: ReportRecord, question: ReportRecord): unknown {
  const answer = record(payload.answer);
  if (answer.encrypted || answer.value === '*' || answer.value == null) return null;
  const value = answer.value;
  switch (question.type || question.questionType) {
    case 'binary':
      return normalizePolisBinaryVote(value);
    case 'freeform':
      return label(value) || null;
    case 'rating': {
      if ((typeof value !== 'number' && typeof value !== 'string') || value === '') return null;
      if (typeof value === 'string' && !value.trim()) return null;
      const scale = record(question.scale);
      const min = typeof scale.min === 'number' ? scale.min : 0;
      const max = typeof scale.max === 'number' ? scale.max : 10;
      const number = Number(value);
      return Number.isFinite(number) && max > min && number >= min && number <= max ? number : null;
    }
    case 'multichoice': {
      const options = Array.isArray(question.options) ? question.options.map(label).filter(Boolean) : [];
      const picks = (Array.isArray(value) ? value : [value]).map((pick) =>
        label(record(pick).label || record(pick).value || pick),
      );
      const canonical = picks.map(
        (pick) => options.find((option) => option.toLowerCase() === pick.toLowerCase()) || (options.length ? '' : pick),
      );
      const selected = [...new Set(canonical.filter(Boolean))];
      return selected.length ? selected : null;
    }
    case 'quadratic':
      return validateQuadraticAllocation(value, question) ? null : value;
    default:
      return null;
  }
}

type ReportScope = { sessionSlug?: string; allowDemo?: boolean };

function collectReportAnswers(
  aggregator: unknown,
  metadata: Record<string, ReportRecord>,
  { sessionSlug = '', allowDemo = false }: ReportScope,
) {
  return Object.entries(record(aggregator)).flatMap(([id, rows]) => {
    if (!Array.isArray(rows)) return [];
    const allowed = rows
      .map((row) => ({ row: record(row), payload: parseReportResponse(record(row).response) }))
      .filter(
        ({ row, payload }) =>
          (allowDemo || payload.source !== 'demo-polis-data') &&
          isResponseAllowedForSessionSlug(row, sessionSlug) &&
          isResponseAllowedForSessionSlug(payload, sessionSlug),
      );
    const meta = reportQuestionMetadata(metadata[id.toLowerCase()], allowed[0]?.payload || {});
    const type = String(meta.type || meta.questionType || '') as AnswerType | 'binary';
    if (type !== 'binary' && !Object.hasOwn(answerTypeTitles, type)) return [];
    // Aggregators normally contain the latest answer per participant. Deduplicate
    // defensively so overlapping survey/standalone rows never inflate totals.
    const values = new Map<string, unknown>();
    allowed.forEach(({ row, payload }) => {
      if (payload.type && payload.type !== type) return;
      const responder = label(row.responder).toLowerCase();
      if (!responder) return;
      const value = readReportAnswer(payload, meta);
      if (value !== null) values.set(responder, value);
    });
    return values.size ? [{ id, meta, type, values }] : [];
  });
}

export function buildReportResponseStats(
  aggregator: unknown,
  metadata: Record<string, ReportRecord> = {},
  scope: ReportScope = {},
) {
  const questions = collectReportAnswers(aggregator, metadata, scope);
  const count = (entries: typeof questions) => {
    const participants = new Set(entries.flatMap(({ values }) => [...values.keys()])).size;
    const responses = entries.reduce((total, { values }) => total + values.size, 0);
    return {
      participants,
      questions: entries.length,
      responses,
      responsesPerParticipant: participants ? responses / participants : 0,
    };
  };
  return { all: count(questions), binary: count(questions.filter(({ type }) => type === 'binary')) };
}

export function buildReportAnswerQuestions(
  aggregator: unknown,
  metadata: Record<string, ReportRecord> = {},
  scope: ReportScope = {},
): ReportAnswerQuestion[] {
  const questions: ReportAnswerQuestion[] = [];
  collectReportAnswers(aggregator, metadata, scope).forEach(({ id, meta, type, values }) => {
    if (type === 'binary') return;
    const scale = record(meta.scale);
    const min = typeof scale.min === 'number' ? scale.min : 0;
    const max = typeof scale.max === 'number' ? scale.max : 10;
    const question: ReportAnswerQuestion = {
      id,
      type,
      prompt: label(meta.prompt) || '(No prompt)',
      count: values.size,
      texts: [],
      average: 0,
      min,
      max,
      bins: [],
      options: [],
    };
    if (type === 'freeform') question.texts = [...values.values()] as string[];
    if (type === 'rating') {
      const ratings = [...values.values()] as number[];
      question.average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
      const steps = Math.min(10, Math.max(1, Math.ceil(max - min)));
      question.bins = Array.from({ length: steps + 1 }, (_, i) => ({
        score: min + (i * (max - min)) / steps,
        count: 0,
      }));
      ratings.forEach(
        (value) => question.bins[Math.min(steps, Math.round(((value - min) / (max - min)) * steps))].count++,
      );
    }
    if (type === 'multichoice' || type === 'quadratic') {
      const options = Array.isArray(meta.options)
        ? meta.options.map(label).filter(Boolean)
        : [...new Set([...values.values()].flat() as string[])];
      question.options = options.map((name, index) => {
        let positive = 0,
          negative = 0,
          count = 0;
        values.forEach((value) => {
          if (type === 'multichoice') {
            if ((value as string[]).includes(name)) count++;
          } else {
            const vote = (value as number[])[index];
            positive += Math.max(0, vote);
            negative += Math.min(0, vote);
          }
        });
        return { label: name, count, positive, negative, net: positive + negative };
      });
    }
    questions.push(question);
  });
  return questions.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}
