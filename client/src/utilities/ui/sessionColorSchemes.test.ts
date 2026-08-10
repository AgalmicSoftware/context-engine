import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SESSION_COLOR_SCHEME_ID,
  SESSION_COLOR_SCHEME_IDS,
  getSessionColorScheme,
  normalizeSessionAppearance,
  normalizeSessionColorSchemeId,
  parseSessionColorSchemeId,
} from './sessionColorSchemes';

describe('session color scheme registry', () => {
  const scssPath = path.resolve(__dirname, '..', '..', 'scss', 'session-color-schemes', '_schemes.scss');

  test('accepts only the three bundled stable ids and falls back safely', () => {
    expect(SESSION_COLOR_SCHEME_IDS).toEqual(['context-engine', 'ocean', 'amber']);
    expect(parseSessionColorSchemeId(' OCEAN ')).toBe('ocean');
    expect(parseSessionColorSchemeId('url(https://example.invalid/theme.css)')).toBeNull();
    expect(normalizeSessionColorSchemeId('../custom.scss')).toBe(DEFAULT_SESSION_COLOR_SCHEME_ID);
    expect(getSessionColorScheme('amber').label).toBe('Amber');
  });

  test('normalizes untrusted metadata to the exact public appearance shape', () => {
    expect(
      normalizeSessionAppearance({
        colorSchemeId: 'ocean',
        '--ce-session-accent': '#ffffff',
        stylesheet: 'https://example.invalid/theme.css',
      }),
    ).toEqual({ colorSchemeId: 'ocean' });
    expect(normalizeSessionAppearance({ colorSchemeId: 'missing' })).toEqual({
      colorSchemeId: 'context-engine',
    });
    expect(normalizeSessionAppearance(null)).toEqual({ colorSchemeId: 'context-engine' });
  });

  test('keeps the TypeScript registry and bundled SCSS selectors in exact parity', () => {
    const source = fs.readFileSync(scssPath, 'utf8');
    const selectorIds = Array.from(source.matchAll(/data-ce-session-color-scheme=['"]([^'"]+)['"]/g)).map(
      ([, id]) => id,
    );

    expect(selectorIds).toEqual(SESSION_COLOR_SCHEME_IDS);
  });

  test('keeps the Worker trust-boundary allowlist in parity with the client registry', () => {
    const workerSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', '..', 'workers', 'shared', 'sessionColorSchemeConfig.mjs'),
      'utf8',
    );
    const ids = workerSource
      .match(/WORKER_SESSION_COLOR_SCHEME_IDS = Object\.freeze\(\[([^\]]+)\]\)/)?.[1]
      ?.match(/'([^']+)'/g)
      ?.map((value) => value.slice(1, -1));

    expect(ids).toEqual(SESSION_COLOR_SCHEME_IDS);
  });

  test('meets AA text and non-text contrast for every bundled scheme', () => {
    const source = fs.readFileSync(scssPath, 'utf8');
    const toLuminance = (hex: string) => {
      const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(
        (channel) => Number.parseInt(channel, 16) / 255,
      );
      const linear = channels.map((channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
      );
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const contrast = (left: string, right: string) => {
      const [light, dark] = [toLuminance(left), toLuminance(right)].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };

    for (const id of SESSION_COLOR_SCHEME_IDS) {
      const block = source.match(
        new RegExp(`\\[data-ce-session-color-scheme=['"]${id}['"]\\] \\{([\\s\\S]*?)\\n\\}`),
      )?.[1];
      expect(block).toBeTruthy();
      const values = Object.fromEntries(
        Array.from(block!.matchAll(/--ce-session-([a-z-]+):\s*(#[0-9a-f]{6});/gi)).map(([, key, value]) => [
          key,
          value.toLowerCase(),
        ]),
      );

      expect(contrast(values.accent, values['accent-contrast'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(values['accent-hover'], values['accent-contrast'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(values.chrome, values['chrome-contrast'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(values.focus, values.chrome)).toBeGreaterThanOrEqual(3);
    }
  });
});
