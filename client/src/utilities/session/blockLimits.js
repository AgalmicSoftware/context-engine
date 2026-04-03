const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveBlock = (value) => {
  const parsed = toFiniteNumber(value);
  if (!parsed || parsed <= 0) return null;
  return Math.floor(parsed);
};

export const normalizeBlockLimitsForConfig = (value, fallbackStart = null) => {
  const source = value && typeof value === 'object' ? value : {};
  const start = toPositiveBlock(source.start) || toPositiveBlock(fallbackStart);
  if (!start) return null;

  const endRaw = source.end;
  const endCandidate = (endRaw == null || endRaw === '') ? null : toPositiveBlock(endRaw);
  const end = endCandidate && endCandidate >= start ? endCandidate : null;

  return { start, end };
};

const blockLimits = {
  normalizeBlockLimitsForConfig,
};

export default blockLimits;
