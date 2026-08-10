import fs from 'node:fs';
import path from 'node:path';
import * as sass from 'sass';

describe('runtime SCSS theme contract', () => {
  const scssDir = path.resolve(__dirname, '..', '..');

  test('compiles all bundled themes through the exact contract', () => {
    const result = sass.compile(path.resolve(scssDir, 'assets/css/contextEngine.scss'), {
      loadPaths: [scssDir],
      style: 'expanded',
    });

    expect(result.css).toContain(':root[data-ce-theme=context-engine]');
    expect(result.css).toContain(':root[data-ce-theme=classic-95]');
    expect(result.css).toContain('--ce-canvas: #008080');
    expect(result.css).toContain('--ce-border-raised: #ffffff #404040 #404040 #ffffff');
    expect(result.css).toContain('--ce-color-primary: var(--ce-action-primary)');
  });

  test.each(['_context-engine.scss', '_classic-95.scss'])(
    '%s remains a values-only theme definition',
    (filename) => {
      const source = fs.readFileSync(path.resolve(__dirname, filename), 'utf8');
      expect(source).not.toMatch(/(?:^|\n)\s*(?::root|\.[a-z]|#[a-z]|\[[^\]]+\])[^\n]*\{/i);
    },
  );
});
