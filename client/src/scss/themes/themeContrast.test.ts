import path from 'node:path';
import * as sass from 'sass';

type Rgba = [number, number, number, number];

const parseColor = (value: string): Rgba => {
  const input = value.trim();
  const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map((digit) => `${digit}${digit}`).join('') : hex;
    return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255).concat(1) as Rgba;
  }

  const functional = input
    .match(/^rgba?\(([^)]+)\)$/i)?.[1]
    ?.split(',')
    .map((part) => Number(part.trim()));
  if (functional && (functional.length === 3 || functional.length === 4)) {
    return [functional[0] / 255, functional[1] / 255, functional[2] / 255, functional[3] ?? 1];
  }
  throw new Error(`Unsupported theme color in contrast contract: ${value}`);
};

const composite = (foreground: Rgba, background: Rgba): Rgba => {
  const alpha = foreground[3] + background[3] * (1 - foreground[3]);
  return [
    (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
    (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
    (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
    alpha,
  ];
};

const luminance = ([red, green, blue]: Rgba) => {
  const linearize = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
};

const contrastRatio = (foreground: Rgba, background: Rgba) => {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
};

const themeValues = (css: string, themeId: string) => {
  const escaped = themeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blocks = [...css.matchAll(new RegExp(`:root\\[data-ce-theme=${escaped}\\]\\s*\\{([^}]*)\\}`, 'g'))].map(
    (match) => match[1],
  );
  return Object.fromEntries(
    blocks.flatMap((block) =>
      [...block.matchAll(/--ce-([a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
    ),
  );
};

const assertContrast = (
  values: Record<string, string>,
  foregroundToken: string,
  backgroundToken: string,
  minimum: number,
  backdropToken = 'canvas',
) => {
  [foregroundToken, backgroundToken, backdropToken].forEach((token) => {
    if (!values[token]) throw new Error(`Missing --ce-${token} in compiled theme contrast contract`);
  });
  const backdrop = parseColor(values[backdropToken]);
  const background = composite(parseColor(values[backgroundToken]), backdrop);
  const foreground = composite(parseColor(values[foregroundToken]), background);
  const ratio = contrastRatio(foreground, background);
  if (ratio < minimum) {
    throw new Error(
      `--ce-${foregroundToken} on --ce-${backgroundToken} has ${ratio.toFixed(2)}:1 contrast; expected ${minimum}:1`,
    );
  }
};

describe('bundled app-theme contrast', () => {
  const scssDir = path.resolve(__dirname, '..', '..');
  const css = sass.compile(path.resolve(scssDir, 'assets/css/contextEngine.scss'), {
    loadPaths: [scssDir],
    style: 'expanded',
  }).css;

  test.each(['context-engine', 'classic-95'])('%s meets documented text and focus contrast', (themeId) => {
    const values = themeValues(css, themeId);
    const textPairs = [
      ['document-text', 'document-canvas', 'document-canvas'],
      ['document-text-muted', 'document-surface', 'document-canvas'],
      ['panel-text', 'surface', 'canvas'],
      ['panel-text-muted', 'surface', 'canvas'],
      ['panel-text', 'card-bg', 'canvas'],
      ['panel-text-muted', 'card-bg', 'canvas'],
      ['tooltip-text', 'tooltip-bg', 'canvas'],
      ['tooltip-muted', 'tooltip-bg', 'canvas'],
      ['overlay-text', 'overlay-surface', 'overlay-base'],
      ['overlay-text-muted', 'overlay-surface', 'overlay-base'],
      ['overlay-text', 'overlay-surface-alt', 'overlay-base'],
      ['overlay-text-muted', 'overlay-surface-alt', 'overlay-base'],
      ['authoring-panel-text', 'authoring-panel-bg', 'canvas'],
      ['authoring-panel-muted', 'authoring-panel-bg', 'canvas'],
      ['authoring-panel-text', 'authoring-section-bg', 'authoring-panel-bg'],
      ['authoring-control-text', 'authoring-control-bg', 'authoring-section-bg'],
      ['authoring-control-muted', 'authoring-control-bg', 'authoring-section-bg'],
      ['authoring-input-text', 'authoring-input-bg', 'authoring-section-bg'],
      ['authoring-input-placeholder', 'authoring-input-bg', 'authoring-section-bg'],
      ['action-primary-text', 'action-primary', 'canvas'],
      ['action-primary-text', 'action-primary-hover', 'canvas'],
      ['action-accent-text', 'action-accent', 'canvas'],
      ['action-accent-text', 'action-accent-hover', 'canvas'],
      ['action-submit-text', 'action-submit', 'canvas'],
      ['action-submit-text', 'action-submit-hover', 'canvas'],
      ['control-text', 'control-face', 'canvas'],
      ['titlebar-text', 'titlebar-bg', 'canvas'],
      ['selection-text', 'selection-bg', 'canvas'],
      ['link', 'surface', 'canvas'],
      ['link', 'card-bg', 'canvas'],
      ['status-info-text', 'surface', 'canvas'],
      ['status-success-text', 'surface', 'canvas'],
      ['status-warning-text', 'surface', 'canvas'],
      ['status-danger-text', 'surface', 'canvas'],
    ] as const;

    textPairs.forEach(([foreground, background, backdrop]) =>
      assertContrast(values, foreground, background, 4.5, backdrop),
    );
    [
      ['response-agree-text', 'response-agree-bg'],
      ['response-unsure-text', 'response-unsure-bg'],
      ['response-disagree-text', 'response-disagree-bg'],
    ].forEach(([foreground, background]) => assertContrast(values, foreground, background, 4.5, 'tooltip-bg'));
    assertContrast(values, 'data-viz-label', 'data-viz-surface', 4.5, 'surface');
    assertContrast(values, 'data-viz-point', 'data-viz-surface', 3, 'surface');
    assertContrast(values, 'data-viz-point-active', 'data-viz-surface', 3, 'surface');
    assertContrast(values, 'focus-ring', 'surface', 3, 'canvas');
  });

  test('classic-95 keeps inactive title-bar tab icons visibly distinct', () => {
    const values = themeValues(css, 'classic-95');
    assertContrast(values, 'nav-tab-inactive', 'titlebar-bg', 3, 'canvas');
  });
});
