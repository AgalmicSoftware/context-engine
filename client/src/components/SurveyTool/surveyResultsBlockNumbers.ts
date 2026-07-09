export type SurveyResultsLatestBlockMap = Record<string, unknown>;

export const normalizeSurveyResultsBlockNumber = (value: unknown): number => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toSurveyResultsLatestBlockMap = (value: unknown): SurveyResultsLatestBlockMap =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as SurveyResultsLatestBlockMap) : {};

export const readSurveyResultsLatestBlock = (latestBlockMap: unknown, key: unknown): number => {
  const normalizedKey = String(key || '').toLowerCase();
  if (!normalizedKey) return 0;
  return normalizeSurveyResultsBlockNumber(toSurveyResultsLatestBlockMap(latestBlockMap)[normalizedKey]);
};
