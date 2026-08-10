import fs from 'node:fs';
import path from 'node:path';
import * as sass from 'sass';

describe('runtime SCSS theme contract', () => {
  const scssDir = path.resolve(__dirname, '..', '..');
  const tokenOnlyStylesheets = [
    'components/Footer/Footer.module.scss',
    'components/MainContent/MainContent.module.scss',
    'components/MainSite/AppShell.module.scss',
    'components/Navbar/Navbar.module.scss',
    'components/RightSidebar/RightSide.module.scss',
    'scss/_finalSubmitCta.scss',
  ];
  const colorLiteralPattern = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/i;
  const migratedLegacyPalettePattern =
    /#(?:fff(?:fff)?|e14eca|1d8cf8|ff8d72|00f2c3|fd5d93|212529|3358f4|ff6491|ba54f5|0098f0|ec250d|adb5bd|344675|f4f5f7|6c757d|525f7f|e9ecef|1f2251|32325d|f8f9fa)\b/i;

  test('compiles all bundled themes through the exact contract', () => {
    const result = sass.compile(path.resolve(scssDir, 'assets/css/contextEngine.scss'), {
      loadPaths: [scssDir],
      style: 'expanded',
    });

    expect(result.css).toContain(':root[data-ce-theme=context-engine]');
    expect(result.css).toContain(':root[data-ce-theme=classic-95]');
    expect(result.css).toContain('--ce-canvas: #008080');
    expect(result.css).toContain('--ce-border-raised: #ffffff #404040 #404040 #ffffff');
    expect(result.css).toContain('--ce-action-submit: #000080');
    expect(result.css).toContain('--ce-shadow-neumorphic-dark: #404040');
    expect(result.css).toContain('--ce-color-primary: var(--ce-action-primary)');
  });

  test.each(['_context-engine.scss', '_classic-95.scss'])('%s remains a values-only theme definition', (filename) => {
    const source = fs.readFileSync(path.resolve(__dirname, filename), 'utf8');
    expect(source).not.toMatch(/(?:^|\n)\s*(?::root|\.[a-z]|#[a-z]|\[[^\]]+\])[^\n]*\{/i);
  });

  test.each(tokenOnlyStylesheets)('%s contains no raw color literals', (filename) => {
    const source = fs.readFileSync(path.resolve(scssDir, filename), 'utf8');
    expect(source).not.toMatch(colorLiteralPattern);
  });

  test('the legacy global stylesheet does not reintroduce migrated palette literals', () => {
    const source = fs.readFileSync(path.resolve(scssDir, 'assets/css/contextEngine.scss'), 'utf8');
    expect(source).not.toMatch(migratedLegacyPalettePattern);
  });

  test('the Session Wizard resolves shared primitives from the runtime theme', () => {
    const source = fs.readFileSync(path.resolve(scssDir, 'components/Sessions/SessionWizard.module.scss'), 'utf8');
    expect(source).not.toMatch(/tokens\.\$ce-(?:panel|card|clickable|input|muted)/);
    expect(source).toContain('$clickable-color: var(--ce-action-accent);');
    expect(source).toContain('$input-bg: var(--ce-input-bg);');
  });
});
