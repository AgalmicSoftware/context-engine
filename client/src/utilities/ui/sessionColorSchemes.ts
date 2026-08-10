export const DEFAULT_SESSION_COLOR_SCHEME_ID = 'context-engine' as const;

export const SESSION_COLOR_SCHEME_REGISTRY = Object.freeze([
  Object.freeze({ id: 'context-engine', label: 'Context Engine' }),
  Object.freeze({ id: 'ocean', label: 'Ocean' }),
  Object.freeze({ id: 'amber', label: 'Amber' }),
] as const);

export type SessionColorSchemeId = (typeof SESSION_COLOR_SCHEME_REGISTRY)[number]['id'];

export type SessionColorSchemeMetadata = (typeof SESSION_COLOR_SCHEME_REGISTRY)[number];

export const SESSION_COLOR_SCHEME_IDS = Object.freeze(
  SESSION_COLOR_SCHEME_REGISTRY.map(({ id }) => id),
);

const SCHEME_BY_ID = Object.freeze(
  SESSION_COLOR_SCHEME_REGISTRY.reduce<Record<string, SessionColorSchemeMetadata>>((registry, entry) => {
    registry[entry.id] = entry;
    return registry;
  }, {}),
);

export const parseSessionColorSchemeId = (value: unknown): SessionColorSchemeId | null => {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(SCHEME_BY_ID, candidate)
    ? (candidate as SessionColorSchemeId)
    : null;
};

export const normalizeSessionColorSchemeId = (value: unknown): SessionColorSchemeId =>
  parseSessionColorSchemeId(value) || DEFAULT_SESSION_COLOR_SCHEME_ID;

export const getSessionColorScheme = (value: unknown): SessionColorSchemeMetadata =>
  SCHEME_BY_ID[normalizeSessionColorSchemeId(value)];

export const normalizeSessionAppearance = (
  value: unknown,
): { colorSchemeId: SessionColorSchemeId } => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    colorSchemeId: normalizeSessionColorSchemeId((source as Record<string, unknown>).colorSchemeId),
  };
};
