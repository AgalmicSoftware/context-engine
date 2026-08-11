import fs from 'node:fs';
import path from 'node:path';
import * as sass from 'sass';

describe('runtime SCSS theme contract', () => {
  const scssDir = path.resolve(__dirname, '..', '..');
  const tokenOnlyStylesheets = [
    'components/Footer/Footer.module.scss',
    'components/DocsPage/DocsPage.module.scss',
    'components/MainContent/MainContent.module.scss',
    'components/MainSite/AppShell.module.scss',
    'components/Navbar/Navbar.module.scss',
    'components/RightSidebar/RightSide.module.scss',
    'scss/_finalSubmitCta.scss',
  ];
  const colorLiteralPattern = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/i;
  const migratedLegacyPalettePattern =
    /#(?:fff(?:fff)?|e14eca|1d8cf8|ff8d72|00f2c3|fd5d93|212529|3358f4|ff6491|ba54f5|0098f0|ec250d|adb5bd|344675|f4f5f7|6c757d|525f7f|e9ecef|1f2251|32325d|f8f9fa)\b/i;
  const findScssFiles = (directory: string): string[] =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? findScssFiles(entryPath) : entry.name.endsWith('.scss') ? [entryPath] : [];
    });

  test('compiles all bundled themes through the exact contract', () => {
    const result = sass.compile(path.resolve(scssDir, 'assets/css/contextEngine.scss'), {
      loadPaths: [scssDir],
      style: 'expanded',
    });

    expect(result.css).toContain(':root[data-ce-theme=context-engine]');
    expect(result.css).toContain(':root[data-ce-theme=classic-95]');
    expect(result.css).toContain('--ce-canvas: #008080');
    expect(result.css).toContain('--ce-layout-profile: standard-app');
    expect(result.css).toContain('--ce-layout-profile: desktop-window');
    expect(result.css).toContain('--ce-welcome-slide-mode: fluid');
    expect(result.css).toContain('--ce-welcome-slide-mode: fixed-window');
    expect(result.css).toContain('--ce-border-raised: #ffffff #404040 #404040 #ffffff');
    expect(result.css).toContain('--ce-action-submit: #000080');
    expect(result.css).toContain('--ce-nav-tab-inactive: #c0c0c0');
    expect(result.css).toContain('--ce-response-agree-bg: #c0e0c0');
    expect(result.css).toContain('--ce-binary-choice-agree-bg: #4caf50');
    expect(result.css).toContain('--ce-binary-choice-unsure-bg: #ffeb3b');
    expect(result.css).toContain('--ce-binary-choice-disagree-bg: #f44336');
    expect(result.css).toContain('--ce-data-viz-point: #000080');
    expect(result.css).toContain('--ce-brand-logo-blend-mode: screen');
    expect(result.css).toContain('--ce-recognition-logo-backing: transparent');
    expect(result.css).toContain('--ce-recognition-logo-border: transparent');
    expect(result.css).toContain('--ce-recognition-logo-backing: var(--ce-status-info-text)');
    expect(result.css).toContain('--ce-recognition-logo-border: var(--ce-status-info)');
    expect(result.css).toContain('--ce-welcome-artwork-blend-soft: screen');
    expect(result.css).toContain('--ce-welcome-artwork-blend-intense: screen');
    expect(result.css).toContain('--ce-welcome-artwork-blend-cutout: screen');
    expect(result.css).toContain('--ce-welcome-artwork-backdrop: linear-gradient(90deg, #5b8cff');
    expect(result.css).toContain('--ce-shadow-neumorphic-dark: #404040');
    expect(result.css).toContain('--ce-tool-card-border: var(--ce-border-raised)');
    expect(result.css).toContain('--ce-tool-card-shadow: var(--ce-shadow-raised)');
    expect(result.css).toContain('--ce-tool-card-hover-bg: var(--ce-surface-raised)');
    expect(result.css).toContain('--ce-tool-card-hover-bg: var(--ce-status-info)');
    expect(result.css).toContain('--ce-footer-link-bg: var(--ce-control-face)');
    expect(result.css).toContain('--ce-footer-bar-bg: var(--ce-control-face)');
    expect(result.css).toContain('--ce-footer-link-height: 32px');
    expect(result.css).toContain('--ce-footer-link-border: var(--ce-border-raised)');
    expect(result.css).toContain('--ce-footer-link-active-border: var(--ce-border-inset)');
    expect(result.css).toContain('--ce-footer-link-bg: transparent');
    expect(result.css).toContain('--ce-settings-panel-bg: var(--ce-surface-raised)');
    expect(result.css).toContain('--ce-settings-surface-bg: var(--ce-surface-subtle)');
    expect(result.css).toContain('--ce-settings-control-border: var(--ce-border-raised)');
    expect(result.css).toContain('--ce-settings-control-opacity: 1');
    expect(result.css).toContain('--ce-settings-text: var(--ce-panel-text)');
    expect(result.css).toContain(
      '--ce-settings-panel-bg: color-mix(in srgb, var(--ce-overlay-surface) 92%, transparent)',
    );
    expect(result.css).toContain('--ce-color-primary: var(--ce-action-primary)');
  });

  test.each(['_context-engine.scss', '_classic-95.scss'])('%s remains a values-only theme definition', (filename) => {
    const source = fs.readFileSync(path.resolve(__dirname, filename), 'utf8');
    expect(source).not.toMatch(/(?:^|\n)\s*(?::root|\.[a-z]|#[a-z]|\[[^\]]+\])[^\n]*\{/i);
  });

  test('component styles contain no theme-ID selectors', () => {
    findScssFiles(path.resolve(scssDir, 'components')).forEach((filename) => {
      expect(fs.readFileSync(filename, 'utf8')).not.toContain('data-ce-theme');
    });
  });

  test('the document root exposes the semantic theme style-query container', () => {
    const source = fs.readFileSync(path.resolve(scssDir, 'assets/css/contextEngine.scss'), 'utf8');
    expect(source).toMatch(/html\s*{[\s\S]*?container-name:\s*ce-theme;/);
  });

  test.each(tokenOnlyStylesheets)('%s contains no raw color literals', (filename) => {
    const source = fs.readFileSync(path.resolve(scssDir, filename), 'utf8');
    expect(source).not.toMatch(colorLiteralPattern);
  });

  test('the legacy global stylesheet does not reintroduce migrated palette literals', () => {
    const source = fs.readFileSync(path.resolve(scssDir, 'assets/css/contextEngine.scss'), 'utf8');
    expect(source).not.toMatch(migratedLegacyPalettePattern);
    expect(source).toContain('color: var(--ce-nav-tab-inactive);');
  });

  test('the Session Wizard resolves shared primitives from the runtime theme', () => {
    const source = fs.readFileSync(path.resolve(scssDir, 'components/Sessions/SessionWizard.module.scss'), 'utf8');
    expect(source).not.toMatch(/tokens\.\$ce-(?:panel|card|clickable|input|muted)/);
    expect(source).toContain('$clickable-color: var(--ce-action-accent);');
    expect(source).toContain('$input-bg: var(--ce-input-bg);');
  });
});
