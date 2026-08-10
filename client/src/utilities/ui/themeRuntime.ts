import { CE_DEFAULT_THEME } from '../../variables/appConfig';
import { DEFAULT_CE_THEME_ID, getThemeMetadata, normalizeThemeId, type CeThemeId } from './themeRegistry';

export const CE_THEME_STORAGE_KEY = 'ce:theme';
export const CE_THEME_CHANGE_EVENT = 'ce:theme-change';

export type ThemeSource = 'user' | 'deployment' | 'default';

export interface ResolvedThemeSelection {
  id: CeThemeId;
  source: ThemeSource;
}

export interface ThemeResolutionInput {
  userTheme?: unknown;
  deploymentTheme?: unknown;
}

let currentSelection: ResolvedThemeSelection = {
  id: DEFAULT_CE_THEME_ID,
  source: 'default',
};
let hasAppliedThemeRuntime = false;

const getRoot = (): HTMLElement | null => (typeof document === 'undefined' ? null : document.documentElement);

const getStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const readStoredThemePreference = (
  storage: Pick<Storage, 'getItem'> | null = getStorage(),
): CeThemeId | null => {
  try {
    return normalizeThemeId(storage?.getItem(CE_THEME_STORAGE_KEY));
  } catch {
    return null;
  }
};

export const resolveThemeSelection = ({
  userTheme,
  deploymentTheme,
}: ThemeResolutionInput = {}): ResolvedThemeSelection => {
  const userId = normalizeThemeId(userTheme);
  if (userId) return { id: userId, source: 'user' };

  const deploymentId = normalizeThemeId(deploymentTheme);
  if (deploymentId) return { id: deploymentId, source: 'deployment' };

  return { id: DEFAULT_CE_THEME_ID, source: 'default' };
};

export const applyResolvedTheme = (selection: ResolvedThemeSelection): ResolvedThemeSelection => {
  const root = getRoot();
  if (
    hasAppliedThemeRuntime &&
    currentSelection.id === selection.id &&
    currentSelection.source === selection.source &&
    (!root || (root.dataset.ceTheme === selection.id && root.dataset.ceThemeSource === selection.source))
  ) {
    return selection;
  }
  currentSelection = selection;
  hasAppliedThemeRuntime = true;
  if (!root) return selection;

  root.dataset.ceTheme = selection.id;
  root.dataset.ceThemeSource = selection.source;
  root.style.colorScheme = getThemeMetadata(selection.id).colorScheme;

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent<ResolvedThemeSelection>(CE_THEME_CHANGE_EVENT, { detail: selection }));
  }
  return selection;
};

const readDeploymentTheme = (): unknown => {
  const rootTheme = getRoot()?.dataset.ceDeploymentTheme;
  return rootTheme || CE_DEFAULT_THEME;
};

export const initializeThemeRuntime = (): ResolvedThemeSelection =>
  applyResolvedTheme(
    resolveThemeSelection({
      userTheme: readStoredThemePreference(),
      deploymentTheme: readDeploymentTheme(),
    }),
  );

export const setStoredThemePreference = (themeId: unknown): ResolvedThemeSelection => {
  const storage = getStorage();
  const normalized = normalizeThemeId(themeId);
  try {
    if (normalized) storage?.setItem(CE_THEME_STORAGE_KEY, normalized);
    else storage?.removeItem(CE_THEME_STORAGE_KEY);
  } catch {
    // A blocked storage API must not prevent applying the in-memory theme.
  }
  return applyResolvedTheme(
    resolveThemeSelection({
      userTheme: normalized,
      deploymentTheme: readDeploymentTheme(),
    }),
  );
};

export const clearStoredThemePreference = (): ResolvedThemeSelection => setStoredThemePreference(null);

export const getResolvedTheme = (): ResolvedThemeSelection => currentSelection;

export const hasExplicitUserThemePreference = (): boolean => {
  const rootSource = getRoot()?.dataset.ceThemeSource;
  return rootSource ? rootSource === 'user' : getResolvedTheme().source === 'user';
};

export const readThemeToken = (tokenName: string, fallback = ''): string => {
  const normalized = String(tokenName || '')
    .trim()
    .replace(/^--/, '');
  if (!/^ce-[a-z0-9-]+$/.test(normalized)) return fallback;
  const root = getRoot();
  if (!root || typeof getComputedStyle !== 'function') return fallback;
  return getComputedStyle(root).getPropertyValue(`--${normalized}`).trim() || fallback;
};

export const subscribeThemeChanges = (listener: (selection: ResolvedThemeSelection) => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ResolvedThemeSelection>).detail;
    listener(detail || currentSelection);
  };
  window.addEventListener(CE_THEME_CHANGE_EVENT, handler);
  return () => window.removeEventListener(CE_THEME_CHANGE_EVENT, handler);
};
