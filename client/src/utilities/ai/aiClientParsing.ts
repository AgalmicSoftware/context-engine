import { createLogger } from '../logging';

type UnknownRecord = Record<string, unknown>;

const aiLog = createLogger('ai');

const asRecord = (value: unknown): UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

export const asParsedJsonRecord = (value: unknown): UnknownRecord | null =>
  !!value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null;

export const readParsedString = (record: UnknownRecord | null | undefined, key: string): string =>
  typeof record?.[key] === 'string' ? String(record[key]) : '';

export const readParsedLegacyString = (record: UnknownRecord | null | undefined, key: string): string =>
  String(record?.[key] || '');

export const pickParsedString = (record: UnknownRecord | null | undefined, keys: readonly string[]): string => {
  for (const key of keys) {
    const value = readParsedString(record, key);
    if (value) return value;
  }
  return '';
};

/**
 * Try to parse JSON from a string that may include ```json code fences
 * or extra text around the JSON object.
 */
export function parseJsonFlexible(text: unknown): unknown | null {
  if (!text || typeof text !== 'string') return null;
  let body = text.trim();

  const fenced = body.match(/```json\s*([\s\S]*?)```/i) || body.match(/```\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) {
    body = fenced[1].trim();
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    aiLog.warn('Flexible JSON parse failed on primary body:', error);
    const firstBrace = body.indexOf('{');
    const lastBrace = body.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(body.slice(firstBrace, lastBrace + 1));
      } catch (innerError) {
        aiLog.warn('Flexible JSON parse failed on extracted body:', innerError);
        return null;
      }
    }
    return null;
  }
}

/**
 * Fallback name when the model doesn't provide one.
 */
export function deriveFallbackClusterName(payload: unknown): string {
  const size = Number(asRecord(payload).clusterSize ?? 0);
  return size >= 12 ? 'Large Cohort' : size >= 6 ? 'Small Cohort' : 'Tiny Cohort';
}

export function buildHeuristicClusterSummary(payload: unknown): { short: string; long: string } {
  const source = asRecord(payload);
  const statements = Array.isArray(source.topStatements) ? source.topStatements : [];
  const withPrompt = statements.filter((s) => {
    const statement = asRecord(s);
    return typeof statement.prompt === 'string' && statement.prompt.trim();
  });

  if (!withPrompt.length) {
    return {
      short: 'Summary unavailable.',
      long: 'Not enough statement data to summarize this cluster.',
    };
  }

  const collapseSpace = (text: string) => text.replace(/\s+/g, ' ').trim();
  const truncate = (text: string, max = 90) => {
    const clean = collapseSpace(text);
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 3)}...`;
  };
  const describe = (s: unknown) => truncate(String(asRecord(s).prompt || ''));

  const positive = withPrompt.filter((s) => (Number(asRecord(s).differenceScore) || 0) > 0).slice(0, 1);
  const negative = withPrompt.filter((s) => (Number(asRecord(s).differenceScore) || 0) < 0).slice(0, 1);

  let short = '';
  if (positive.length && negative.length) {
    short = `More agreement with "${describe(positive[0])}" and more disagreement with "${describe(negative[0])}".`;
  } else if (positive.length) {
    short = `Stronger agreement with "${describe(positive[0])}" compared to the overall group.`;
  } else if (negative.length) {
    short = `More disagreement with "${describe(negative[0])}" compared to the overall group.`;
  } else {
    short = `Aligned around "${describe(withPrompt[0])}".`;
  }

  const highlights = withPrompt
    .slice(0, 3)
    .map((s) => `"${describe(s)}"`)
    .join('; ');
  const size =
    typeof source.clusterSize === 'number'
      ? `This cluster has ${source.clusterSize} participants.`
      : 'This cluster has a distinct voting pattern.';
  const long = `${size} The largest opinion gaps appear on ${highlights}.`;
  return { short, long };
}

export function stripEnclosingMarkdownFences(s: unknown): string {
  if (typeof s !== 'string') return '';
  let out = s.trim();
  const m = out.match(/^\s*```(?:md|markdown|text|json)?\s*\n?([\s\S]*?)\n?\s*```\s*$/i);
  if (m && m[1]) out = m[1];
  out = out.replace(/^\uFEFF/, '').replace(/^[`'"]+|[`'"]+$/g, '');
  return out.trim();
}
