export const WORKER_SESSION_COLOR_SCHEME_IDS = Object.freeze(['context-engine', 'ocean', 'amber']);

const ALLOWED_IDS = new Set(WORKER_SESSION_COLOR_SCHEME_IDS);

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const normalizeWorkerSessionAppearance = (value) => {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, 'colorSchemeId')) return null;
  if (typeof value.colorSchemeId !== 'string') return null;
  const colorSchemeId = value.colorSchemeId.trim().toLowerCase();
  return ALLOWED_IDS.has(colorSchemeId) ? { colorSchemeId } : null;
};
