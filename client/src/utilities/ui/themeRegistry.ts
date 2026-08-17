import registry from '../../scss/themes/registry.json';

export type CeThemeId = string;

export interface CeThemeMetadata {
  id: CeThemeId;
  label: string;
  colorScheme: 'dark' | 'light';
  layoutProfile?: 'standard-app' | 'desktop-window';
}

export const DEFAULT_CE_THEME_ID = registry.defaultThemeId as CeThemeId;

export const CE_THEME_REGISTRY = Object.freeze(
  registry.themes.reduce<Record<string, CeThemeMetadata>>((acc, entry) => {
    const metadata = Object.freeze(entry as CeThemeMetadata);
    acc[metadata.id] = metadata;
    return acc;
  }, {}),
);

export const CE_THEME_IDS = Object.freeze(registry.themes.map(({ id }) => id as CeThemeId));

export const normalizeThemeId = (value: unknown): CeThemeId | null => {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(CE_THEME_REGISTRY, candidate) ? (candidate as CeThemeId) : null;
};

export const getThemeMetadata = (value: unknown): CeThemeMetadata =>
  CE_THEME_REGISTRY[normalizeThemeId(value) || DEFAULT_CE_THEME_ID];
