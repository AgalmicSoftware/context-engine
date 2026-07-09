type BlockLimitSource = {
  start?: unknown;
  end?: unknown;
};

export type NormalizedBlockLimits = {
  start: number;
  end: number | null;
};

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveBlock = (value: unknown): number | null => {
  const parsed = toFiniteNumber(value);
  if (!parsed || parsed <= 0) return null;
  return Math.floor(parsed);
};

export const normalizeBlockLimitsForConfig = (
  value: unknown,
  fallbackStart: unknown = null,
): NormalizedBlockLimits | null => {
  const source: BlockLimitSource =
    value && typeof value === 'object' && !Array.isArray(value) ? (value as BlockLimitSource) : {};
  const start = toPositiveBlock(source.start) || toPositiveBlock(fallbackStart);
  if (!start) return null;

  const endRaw = source.end;
  const endCandidate = endRaw == null || endRaw === '' ? null : toPositiveBlock(endRaw);
  const end = endCandidate && endCandidate >= start ? endCandidate : null;

  return { start, end };
};

const blockLimits = {
  normalizeBlockLimitsForConfig,
};

export default blockLimits;
