import path from 'node:path';
import * as sass from 'sass';
import registry from './registry.json';

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

  test.each(registry.themes.map(({ id }) => id))('%s meets documented text and focus contrast', (themeId) => {
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
      ['status-success-contrast', 'status-success', 'canvas'],
      ['status-error-contrast', 'status-error', 'canvas'],
      ['control-text', 'control-face', 'canvas'],
      ['option-scroll-text', 'option-scroll-bg', 'canvas'],
      ['option-scroll-text', 'option-scroll-hover-bg', 'canvas'],
      ['option-scroll-disabled-text', 'option-scroll-disabled-bg', 'canvas'],
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
    // Recorder question-type chips are filled with status text colours and labelled in the sunken surface colour.
    ['info', 'success', 'warning', 'danger'].forEach((status) =>
      assertContrast(values, 'surface-sunken', `status-${status}-text`, 4.5, 'surface-sunken'),
    );
    assertContrast(values, 'data-viz-label', 'data-viz-surface', 4.5, 'surface');
    assertContrast(values, 'data-viz-point', 'data-viz-surface', 3, 'surface');
    assertContrast(values, 'data-viz-point-active', 'data-viz-surface', 3, 'surface');
    assertContrast(values, 'focus-ring', 'surface', 3, 'canvas');
  });

  // Group Conversation stacks translucent layers on the dialog's sunken surface (SurveyTool.module.scss):
  // draft cards take 8% of the panel text, tag chips 18% of the info text, fields 68% of the dialog colour,
  // and the recording timer is 82% of the compat dark over the waveform's light border colour.
  test.each(registry.themes.map(({ id }) => id))('%s keeps Group Conversation drafts readable', (themeId) => {
    const values = themeValues(css, themeId);
    const color = (token: string) => parseColor(values[token]);
    const tint = (token: string, share: number, under: Rgba) => {
      const [red, green, blue, alpha] = color(token);
      return composite([red, green, blue, alpha * share], under);
    };
    const blend = (token: string, share: number, other: string): Rgba => {
      const [a, b] = [color(token), color(other)];
      return [0, 1, 2].map((i) => a[i] * share + b[i] * (1 - share)).concat(1) as Rgba;
    };
    const ratio = (foreground: Rgba, background: Rgba) => contrastRatio(composite(foreground, background), background);
    const card = tint('panel-text', 0.08, color('surface-sunken'));
    const chip = tint('status-info-text', 0.18, card);
    const field = tint('surface-sunken', 0.68, card);
    const timer = tint('compat-dark', 0.82, color('border-light'));

    expect(ratio(color('panel-text'), chip)).toBeGreaterThanOrEqual(4.5); // tag text and its remove ×
    expect(ratio(color('status-danger-text'), chip)).toBeGreaterThanOrEqual(3); // the × while hovered
    expect(ratio(color('panel-text'), field)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(color('panel-text-muted'), field)).toBeGreaterThanOrEqual(4.5); // placeholder
    expect(contrastRatio(composite(color('panel-text-muted'), field), card)).toBeGreaterThanOrEqual(3); // field edge
    expect(ratio(blend('status-error', 0.6, 'text-inverse'), timer)).toBeGreaterThanOrEqual(3); // recording dot
    // The transcript pill and its clear button are white in every theme.
    expect(ratio(color('document-text'), color('text-inverse'))).toBeGreaterThanOrEqual(4.5);
  });

  // Contracts on component stylesheets read the compiled rules, so a token meant for another surface fails them.
  const compileModule = (file: string) =>
    sass.compile(path.resolve(scssDir, file), { loadPaths: [scssDir], style: 'expanded' }).css;
  const moduleRule = (moduleCss: string, selector: string) => {
    const found: Record<string, string> = {};
    for (const [, selectors, body] of moduleCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!selectors.split(/,(?![^(]*\))/).some((candidate) => candidate.trim() === selector)) continue;
      for (const [, name, value] of body.matchAll(/([a-z-]+):\s*([^;]+);/g)) {
        found[name] = value.replace(/\s*!important$/, '').trim();
      }
    }
    return found;
  };
  const painter =
    (values: Record<string, string>) =>
    (value: string): Rgba => {
      if (value === 'transparent') return [0, 0, 0, 0];
      const aliases: Record<string, string> = { 'color-accent': 'action-accent', 'color-panel-text': 'panel-text' };
      const tokenColor = (token: string) => parseColor(values[aliases[token] ?? token]);
      const token = value.match(/^var\(--ce-([a-z0-9-]+)\)$/)?.[1];
      if (token) return tokenColor(token);
      const mix = value.match(/^color-mix\(in srgb, var\(--ce-([a-z0-9-]+)\) (\d+)%, transparent\)$/);
      if (!mix) throw new Error(`Unsupported paint in a component contrast contract: ${value}`);
      const [red, green, blue, alpha] = tokenColor(mix[1]);
      return [red, green, blue, (alpha * Number(mix[2])) / 100];
    };

  // Hovered, focused or pressed, the login dialog's passkey buttons paint their own fill and label, and
  // Account.styles.test.ts checks that those rules win. The label sits mid-button, so a gradient counts at its midpoint.
  const accountCss = compileModule('components/Account/Account.module.scss');
  const minimalStart = accountCss.indexOf('style(--ce-layout-profile: minimal-app)');

  test.each(registry.themes.map(({ id, layoutProfile }) => [id, layoutProfile]))(
    '%s keeps the passkey labels readable on their active fills',
    (themeId, layoutProfile) => {
      const values = themeValues(css, themeId);
      const paint = painter(values);
      const themedCss =
        layoutProfile === 'minimal-app' ? accountCss.slice(minimalStart) : accountCss.slice(0, minimalStart);
      const dialog = composite(parseColor(values.surface), parseColor(values.canvas));
      const midpoint = (gradient: string): Rgba => {
        const stops = gradient.match(/color-mix\(in srgb, var\([^)]+\) \d+%, transparent\)|var\(--ce-[a-z0-9-]+\)/g);
        const [a, b] = (stops ?? []).map(paint);
        const alpha = (a[3] + b[3]) / 2;
        return [0, 1, 2].map((i) => (a[i] * a[3] + b[i] * b[3]) / (2 * alpha)).concat(alpha) as Rgba;
      };
      const ratios = ['passkeyButtonPrimary', 'passkeyButtonOutline'].map((button) => {
        const rule = moduleRule(themedCss, `button.${button}:is(:hover, :focus, :active):not(:disabled)`);
        const backing = composite(paint(rule['background-color']), dialog);
        const image = rule['background-image'];
        const fill = image === 'none' ? backing : composite(midpoint(image), backing);
        return [button, Number(contrastRatio(composite(paint(rule.color), fill), fill).toFixed(2))] as const;
      });
      expect(ratios.filter(([, value]) => value < 4.5)).toEqual([]);
    },
  );

  // The results dialog's locked-answers controls. On Classic 95's navy the accent gave Decrypt 3.35:1 and document
  // text gave the toggle 1.31:1.
  const resultsCss = compileModule('components/SurveyTool/SurveyResults.module.scss');
  const resultsRule = (selector: string) => moduleRule(resultsCss, selector);

  test.each(registry.themes.map(({ id }) => id))('%s keeps the locked-answers controls readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const dialog = composite(parseColor(values['overlay-surface']), parseColor(values['overlay-base']));
    const onBanner = composite(paint(resultsRule('.lockedBanner').background), dialog);
    const onTitleBar = composite(parseColor(values['titlebar-bg']), parseColor(values['overlay-base']));
    const ratio = (selector: string, under: Rgba) => {
      const { background, color } = resultsRule(selector);
      // A state without its own colour takes a global one, such as `a:hover`.
      if (!color) return [selector, 0] as const;
      const fill = composite(paint(background), under);
      return [selector, Number(contrastRatio(composite(paint(color), fill), fill).toFixed(2))] as const;
    };

    const ratios = [
      ratio('.lockedBanner', dialog),
      ...[
        '.lockedBannerDecryptButton',
        '.lockedBannerDecryptButton:hover:not(:disabled)',
        '.lockedBannerDecryptButton:focus:not(:disabled)',
        '.lockedBannerGateLink',
        '.lockedBannerGateLink:hover',
        '.lockedBannerGateLink:focus',
        '.exportToggleButton',
        // Log in sits on the banner, and only this selector outranks the global `.btn:active:hover`.
        'button.exportToggleButton:is(:hover, :focus, :active):not(:disabled)',
      ].map((selector) => ratio(selector, onBanner)),
      ...[
        '.lockedSummaryToggle',
        '.lockedSummaryToggle:hover',
        '.lockedSummaryToggle:focus',
        '.lockedSummaryToggleOpen',
      ].map((selector) => ratio(selector, onTitleBar)),
    ];
    expect(ratios.filter(([, value]) => value < 4.5)).toEqual([]);

    // Decrypting dims the whole button, and its label stays readable at that opacity.
    const [red, green, blue, alpha] = paint(resultsRule('.lockedBannerDecryptButton').color);
    const dimmed = alpha * Number(resultsRule('.lockedBannerDecryptButton:disabled').opacity);
    expect(contrastRatio(composite([red, green, blue, dimmed], onBanner), onBanner)).toBeGreaterThanOrEqual(4.5);

    // The theme's own focus ring is black on Classic 95's navy.
    expect(
      contrastRatio(paint(resultsRule('.lockedBanner :is(a, button):focus-visible')['outline-color']), onBanner),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(paint(resultsRule('.lockedSummaryToggle:focus-visible')['outline-color']), onTitleBar),
    ).toBeGreaterThanOrEqual(3);
  });

  test.each(registry.themes.map(({ id }) => id))('%s keeps small binary answer labels readable', (themeId) => {
    const values = themeValues(css, themeId);
    for (const stance of ['agree', 'disagree']) {
      assertContrast(values, `binary-choice-${stance}-text`, `binary-choice-${stance}-bg`, 4.5);
    }
  });

  test('Civic keeps forms, disabled actions, and session chrome readable', () => {
    const values = themeValues(css, 'civic');
    [
      ['text', 'input-bg'],
      ['text-muted', 'input-bg'],
      ['session-chrome-contrast', 'session-chrome'],
      ['session-accent-contrast', 'session-accent'],
      ['control-disabled-text', 'control-disabled-bg'],
      ['action-submit-disabled-text', 'action-submit-disabled-bg'],
      ['nav-tab-inactive', 'titlebar-bg'],
    ].forEach(([foreground, background]) => assertContrast(values, foreground, background, 4.5));
    assertContrast(values, 'input-border', 'input-bg', 3);
  });

  test('classic-95 keeps inactive title-bar tab icons visibly distinct', () => {
    const values = themeValues(css, 'classic-95');
    assertContrast(values, 'nav-tab-inactive', 'titlebar-bg', 3, 'canvas');
  });

  test.each(registry.themes.map(({ id }) => id))('%s color-blind mode keeps response text legible', (themeId) => {
    const values = themeValues(css, themeId);
    const selectors = [':root[data-ce-color-vision=color-blind]'];
    if (registry.themes.find(({ id }) => id === themeId)?.colorScheme === 'light') {
      selectors.push(`:root[data-ce-color-vision=color-blind][data-ce-theme=${themeId}]`);
    }
    selectors.forEach((selector) => {
      const start = css.indexOf(selector);
      expect(start).toBeGreaterThan(-1);
      const block = css.slice(css.indexOf('{', start), css.indexOf('}', start));
      for (const match of block.matchAll(/--ce-([a-z0-9-]+):\s*([^;]+);/g)) values[match[1]] = match[2].trim();
    });
    ['agree', 'unsure', 'disagree'].forEach((stance) => {
      assertContrast(values, `response-${stance}-text`, `response-${stance}-bg`, 4.5, 'surface');
      expect(
        contrastRatio(
          parseColor(stance === 'unsure' ? '#000000' : values[`binary-choice-${stance}-text`]),
          parseColor(values[`binary-choice-${stance}-bg`]),
        ),
      ).toBeGreaterThanOrEqual(4.5);
    });
    ['agree', 'disagree'].forEach((stance) => {
      expect(
        contrastRatio(parseColor(values[`response-${stance}-document-text`]), parseColor('#ffffff')),
      ).toBeGreaterThanOrEqual(4.5);
    });
    ['success', 'warning', 'danger'].forEach((status) => {
      assertContrast(values, `status-${status}-text`, 'surface', 4.5);
      assertContrast(values, 'surface-sunken', `status-${status}-text`, 4.5, 'surface-sunken');
    });
    assertContrast(values, 'status-success-contrast', 'status-success', 4.5, 'surface');
    assertContrast(values, 'status-error-contrast', 'status-error', 4.5, 'surface');
    expect(values['binary-choice-agree-bg']).toBe('#56b4e9');
    expect(values['binary-choice-disagree-bg']).toBe('#e69f00');
    expect(values['chart-series-1']).toBe(values['data-series-1']);
  });
});
