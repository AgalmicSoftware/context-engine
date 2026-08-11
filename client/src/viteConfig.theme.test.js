const fs = require('fs');
const path = require('path');

describe('Vite theme bootstrap contract', () => {
  const clientRoot = path.join(__dirname, '..');

  test('normalizes deployment theme ids through the shared registry', async () => {
    const registry = JSON.parse(
      fs.readFileSync(path.join(clientRoot, 'src', 'scss', 'themes', 'registry.json'), 'utf8'),
    );
    const { normalizeThemeIdForHtml } = await import('../scripts/theme-registry-core.mjs');

    expect(normalizeThemeIdForHtml(' classic-95 ', registry)).toBe('classic-95');
    expect(normalizeThemeIdForHtml('../remote.css', registry)).toBe('context-engine');
  });

  test('keeps the bootstrap external and ahead of the app entry', () => {
    const html = fs.readFileSync(path.join(clientRoot, 'index.html'), 'utf8');
    const bootstrapIndex = html.indexOf('theme-bootstrap.js');
    const appIndex = html.indexOf('/src/viteEntry.ts');

    expect(html).toContain('data-ce-deployment-theme="__CE_DEFAULT_THEME__"');
    expect(html).toContain('data-ce-theme-registry="__CE_THEME_IDS__"');
    expect(bootstrapIndex).toBeGreaterThan(0);
    expect(bootstrapIndex).toBeLessThan(appIndex);
    expect(html).not.toMatch(/<script[^>]*>\s*\(function bootstrapCeTheme/);
  });

  test('transforms the shared CommonJS password derivation helper for Vite', async () => {
    const { transformGroupPasswordDerivationCommonJs } = await import(
      '../scripts/source-commonjs-compatibility.mjs'
    );
    const commonJsSource = fs.readFileSync(
      path.join(clientRoot, 'src', 'utilities', 'crypto', 'groupPasswordDerivation.cjs'),
      'utf8',
    );
    const transformed = transformGroupPasswordDerivationCommonJs(commonJsSource);

    expect(transformed).toContain('export { createGroupPasswordDerivation };');
    expect(transformed).toContain('export default { createGroupPasswordDerivation };');
    expect(transformed).not.toContain('module.exports');
  });
});
