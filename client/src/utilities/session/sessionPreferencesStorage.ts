import { DEFAULT_DEMO_SURFACE_MODE } from '../../variables/appConfig.js';

const DEMO_SURFACE_MODE_STORAGE_KEY = 'ce:demoSurfaceMode';
const TOOLTIPS_ENABLED_STORAGE_KEY = 'ce:tooltipsEnabled';

export const normalizeDemoSurfaceMode = (value: unknown): boolean => (value === false ? false : true);

export const normalizeTooltipsEnabled = (value: unknown): boolean => (value === false ? false : true);

export const readStoredDemoSurfaceMode = (): boolean => {
  try {
    const storedValue = localStorage.getItem(DEMO_SURFACE_MODE_STORAGE_KEY);
    if (storedValue !== null) {
      return normalizeDemoSurfaceMode(JSON.parse(storedValue));
    }
    return DEFAULT_DEMO_SURFACE_MODE;
  } catch (_) {
    return DEFAULT_DEMO_SURFACE_MODE;
  }
};

export const readStoredTooltipsEnabled = (): boolean => {
  try {
    const storedValue = localStorage.getItem(TOOLTIPS_ENABLED_STORAGE_KEY);
    return storedValue !== null ? normalizeTooltipsEnabled(JSON.parse(storedValue)) : true;
  } catch (_) {
    return true;
  }
};

export const persistDemoSurfaceMode = (value: unknown): void => {
  try {
    localStorage.setItem(DEMO_SURFACE_MODE_STORAGE_KEY, JSON.stringify(normalizeDemoSurfaceMode(value)));
  } catch (_) {}
};

export const persistTooltipsEnabled = (value: boolean): void => {
  try {
    localStorage.setItem(TOOLTIPS_ENABLED_STORAGE_KEY, JSON.stringify(normalizeTooltipsEnabled(value)));
  } catch (_) {}
};
