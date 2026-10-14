import fs from 'node:fs';
import path from 'node:path';
import registry from '../../scss/themes/registry.json';
import { initializeThemeRuntime, setStoredThemePreference } from './themeRuntime';

const clientRoot = path.resolve(__dirname, '..', '..', '..');

describe('pre-paint theme bootstrap', () => {
  const source = fs.readFileSync(path.join(clientRoot, 'public', 'theme-bootstrap.js'), 'utf8');

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('style');
    document.documentElement.dataset.ceThemeRegistry = 'context-engine classic-95 civic';
    document.documentElement.dataset.ceLightThemes = 'classic-95 civic';
    document.documentElement.dataset.ceThemeColors = 'context-engine:#20204e classic-95:#008080 civic:#ffffff';
    document.documentElement.dataset.ceDeploymentTheme = 'classic-95';
    document.documentElement.removeAttribute('data-ce-theme');
    document.documentElement.removeAttribute('data-ce-theme-source');
    document.head.innerHTML = '<meta name="theme-color" content="#ffffff" />';
  });

  test('sets the browser theme-color from the restored theme before the app loads', () => {
    const themeColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
    window.localStorage.setItem('ce:theme', 'context-engine');
    window.eval(source);
    expect(themeColor()).toBe('#20204e');

    window.localStorage.clear();
    window.eval(source);
    expect(themeColor()).toBe('#008080');
  });

  test.each([
    ['', 'context-engine'],
    ['civic', 'context-engine'],
    ['', 'classic-95'],
    ['civic', 'classic-95'],
  ])('migrates returning visitors to Minimal once on deployment %s from %s', (deployment, priorTheme) => {
    document.documentElement.dataset.ceDeploymentTheme = deployment;
    window.localStorage.setItem('ce:theme', priorTheme);
    const preserved = {
      'ce:color-vision': 'color-blind',
      appCacheVersion: '2026-06-19-demo-session-and-sbt-cache-sync-v1',
      'fixture:auth': 'keep-auth',
      'fixture:wallet': 'keep-wallet',
      'fixture:authored-draft': 'keep-draft',
    };
    Object.entries(preserved).forEach(([key, value]) => window.localStorage.setItem(key, value));

    window.eval(source);
    expect(document.documentElement.dataset.ceTheme).toBe('civic');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#ffffff');
    expect(window.localStorage.getItem('ce:theme')).toBeNull();
    expect(window.localStorage.getItem('ce:theme-default-version')).toBe('2026-10-13-civic-v1');
    expect(initializeThemeRuntime().id).toBe('civic');
    expect(document.documentElement.dataset.ceColorVision).toBe('color-blind');
    Object.entries(preserved).forEach(([key, value]) => expect(window.localStorage.getItem(key)).toBe(value));

    setStoredThemePreference('classic-95');
    window.localStorage.setItem('appCacheVersion', 'later-data-cache-refresh');
    window.eval(source);
    expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
    expect(initializeThemeRuntime()).toEqual({ id: 'classic-95', source: 'user' });
  });

  test('marks fresh Minimal visits without resetting later explicit themes', () => {
    document.documentElement.dataset.ceDeploymentTheme = 'civic';
    window.eval(source);
    expect(window.localStorage.getItem('ce:theme-default-version')).toBe('2026-10-13-civic-v1');
    setStoredThemePreference('context-engine');
    window.eval(source);
    expect(initializeThemeRuntime()).toEqual({ id: 'context-engine', source: 'user' });
  });

  test.each(['context-engine', 'classic-95'])('keeps explicit non-Minimal deployment %s preferences', (deployment) => {
    document.documentElement.dataset.ceDeploymentTheme = deployment;
    window.localStorage.setItem('ce:theme', 'classic-95');
    window.eval(source);
    expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
    expect(window.localStorage.getItem('ce:theme')).toBe('classic-95');
    expect(window.localStorage.getItem('ce:theme-default-version')).toBeNull();
  });

  test('preserves a readable saved preference and accessibility when migration writes are blocked', () => {
    document.documentElement.dataset.ceDeploymentTheme = 'civic';
    window.localStorage.setItem('ce:theme', 'context-engine');
    window.localStorage.setItem('ce:color-vision', 'color-blind');
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage is read only');
    });
    try {
      expect(() => window.eval(source)).not.toThrow();
      expect(document.documentElement.dataset.ceTheme).toBe('context-engine');
      expect(initializeThemeRuntime()).toEqual({ id: 'context-engine', source: 'user' });
      expect(document.documentElement.dataset.ceColorVision).toBe('color-blind');
    } finally {
      setItem.mockRestore();
    }
  });

  test('retains consistent theme resolution when an old preference cannot be removed', () => {
    document.documentElement.dataset.ceDeploymentTheme = 'civic';
    window.localStorage.setItem('ce:theme', 'classic-95');
    const removeItem = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage removal is blocked');
    });
    try {
      expect(() => window.eval(source)).not.toThrow();
      expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
      expect(initializeThemeRuntime()).toEqual({ id: 'classic-95', source: 'user' });
    } finally {
      removeItem.mockRestore();
    }
  });

  test('keeps each theme-color equal to the theme canvas, with Minimal as the static default', () => {
    registry.themes.forEach(({ id, themeColor }) => {
      const scss = fs.readFileSync(path.join(clientRoot, 'src', 'scss', 'themes', `_${id}.scss`), 'utf8');
      expect(scss).toMatch(new RegExp(`^\\s*canvas: ${themeColor},$`, 'm'));
    });
    const defaultColor = registry.themes.find(({ id }) => id === registry.defaultThemeId)?.themeColor;
    const html = fs.readFileSync(path.join(clientRoot, 'index.html'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(path.join(clientRoot, 'public', 'manifest.json'), 'utf8'));
    expect(html).toContain(`<meta name="theme-color" content="${defaultColor}" />`);
    expect(html.indexOf('name="theme-color"')).toBeLessThan(html.indexOf('theme-bootstrap.js'));
    expect(html).toContain('data-ce-theme-colors="__CE_THEME_COLORS__"');
    expect(manifest.theme_color).toBe(defaultColor);
  });

  test('applies an allowlisted user preference before the app bundle', () => {
    window.localStorage.setItem('ce:theme', 'context-engine');
    window.eval(source);

    expect(document.documentElement.dataset.ceTheme).toBe('context-engine');
    expect(document.documentElement.dataset.ceThemeSource).toBe('user');
  });

  test('restores Minimal with light native controls before the app loads', () => {
    window.localStorage.setItem('ce:theme', 'civic');
    window.eval(source);
    expect(document.documentElement.dataset.ceTheme).toBe('civic');
    expect(document.documentElement.dataset.ceThemeSource).toBe('user');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  test('rejects stale preferences and uses the deployment theme', () => {
    window.localStorage.setItem('ce:theme', '../remote.css');
    window.eval(source);

    expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
    expect(document.documentElement.dataset.ceThemeSource).toBe('deployment');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  test('restores color-blind mode before paint independently of the theme', () => {
    window.localStorage.setItem('ce:color-vision', 'color-blind');
    window.eval(source);
    expect(document.documentElement.dataset.ceColorVision).toBe('color-blind');
    expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
    window.localStorage.setItem('ce:color-vision', 'unknown');
    window.eval(source);
    expect(document.documentElement.dataset.ceColorVision).toBe('standard');
  });

  test.each(['', 'unknown'])('boots Minimal when no valid preference or deployment exists (%s)', (deployment) => {
    document.documentElement.dataset.ceDeploymentTheme = deployment;
    window.localStorage.setItem('ce:theme', 'removed-theme');
    window.eval(source);
    expect(document.documentElement.dataset.ceTheme).toBe('civic');
    expect(document.documentElement.dataset.ceThemeSource).toBe('default');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  test('boots Minimal even when browser storage is unavailable', () => {
    delete document.documentElement.dataset.ceDeploymentTheme;
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    try {
      window.eval(source);
      expect(document.documentElement.dataset.ceTheme).toBe('civic');
      expect(document.documentElement.style.colorScheme).toBe('light');
    } finally {
      getItem.mockRestore();
    }
  });
});
