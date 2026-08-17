import {
  CE_THEME_CHANGE_EVENT,
  CE_THEME_STORAGE_KEY,
  applyResolvedTheme,
  clearStoredThemePreference,
  hasExplicitUserThemePreference,
  initializeThemeRuntime,
  readStoredThemePreference,
  readThemeToken,
  resolveThemeSelection,
  setStoredThemePreference,
  subscribeThemeChanges,
} from './themeRuntime';

describe('theme runtime', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-ce-theme');
    document.documentElement.removeAttribute('data-ce-theme-source');
    document.documentElement.removeAttribute('data-ce-deployment-theme');
    document.documentElement.removeAttribute('style');
  });

  test('uses user, deployment, then built-in precedence without a session theme layer', () => {
    expect(resolveThemeSelection({ userTheme: 'context-engine', deploymentTheme: 'classic-95' })).toEqual({
      id: 'context-engine',
      source: 'user',
    });
    expect(resolveThemeSelection({ deploymentTheme: 'classic-95' })).toEqual({
      id: 'classic-95',
      source: 'deployment',
    });
    expect(resolveThemeSelection({ deploymentTheme: 'unknown' })).toEqual({
      id: 'context-engine',
      source: 'default',
    });
  });

  test('persists only allowlisted user ids and restores the deployment default when cleared', () => {
    document.documentElement.dataset.ceDeploymentTheme = 'classic-95';
    initializeThemeRuntime();
    expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
    expect(document.documentElement.dataset.ceThemeSource).toBe('deployment');

    setStoredThemePreference('context-engine');
    expect(window.localStorage.getItem(CE_THEME_STORAGE_KEY)).toBe('context-engine');
    expect(document.documentElement.dataset.ceThemeSource).toBe('user');
    expect(hasExplicitUserThemePreference()).toBe(true);
    expect(readStoredThemePreference()).toBe('context-engine');

    clearStoredThemePreference();
    expect(window.localStorage.getItem(CE_THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
    expect(document.documentElement.dataset.ceThemeSource).toBe('deployment');

    setStoredThemePreference('../remote.css');
    expect(window.localStorage.getItem(CE_THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
  });

  test('notifies non-CSS consumers and reads only CE token names', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeThemeChanges(listener);
    document.documentElement.style.setProperty('--ce-chart-grid', '#123456');

    applyResolvedTheme({ id: 'classic-95', source: 'deployment' });

    expect(listener).toHaveBeenCalledWith({ id: 'classic-95', source: 'deployment' });
    expect(readThemeToken('ce-chart-grid')).toBe('#123456');
    expect(readThemeToken('color', 'fallback')).toBe('fallback');
    unsubscribe();
    window.dispatchEvent(new CustomEvent(CE_THEME_CHANGE_EVENT));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
