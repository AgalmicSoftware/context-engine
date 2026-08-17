import fs from 'node:fs';
import path from 'node:path';

describe('pre-paint theme bootstrap', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'public', 'theme-bootstrap.js'), 'utf8');

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('style');
    document.documentElement.dataset.ceThemeRegistry = 'context-engine classic-95';
    document.documentElement.dataset.ceDeploymentTheme = 'classic-95';
    document.documentElement.removeAttribute('data-ce-theme');
    document.documentElement.removeAttribute('data-ce-theme-source');
  });

  test('applies an allowlisted user preference before the app bundle', () => {
    window.localStorage.setItem('ce:theme', 'context-engine');
    window.eval(source);

    expect(document.documentElement.dataset.ceTheme).toBe('context-engine');
    expect(document.documentElement.dataset.ceThemeSource).toBe('user');
  });

  test('rejects stale preferences and uses the deployment theme', () => {
    window.localStorage.setItem('ce:theme', '../remote.css');
    window.eval(source);

    expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
    expect(document.documentElement.dataset.ceThemeSource).toBe('deployment');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
