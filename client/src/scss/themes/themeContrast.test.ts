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
    for (const [, selectors, body] of moduleCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
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
      const onToken = value.match(/^color-mix\(in srgb, var\(--ce-([a-z0-9-]+)\) (\d+)%, var\(--ce-([a-z0-9-]+)\)\)$/);
      if (onToken) {
        const [top, base] = [tokenColor(onToken[1]), tokenColor(onToken[3])];
        return [0, 1, 2]
          .map((i) => (top[i] * Number(onToken[2])) / 100 + (base[i] * (100 - Number(onToken[2]))) / 100)
          .concat(1) as Rgba;
      }
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

  // Every primary button without its own rule takes these. `.btn:hover` and `.btn:active` clear fills with !important,
  // so the primary rules must come after them; the purple fill they replace was only 3.70:1 with a white label.
  test('primary buttons keep their fill on the action colours', () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
      selectors: selectors.split(/,(?![^(]*\))/).map((selector) => selector.trim()),
      body,
    }));
    const lastRule = (selector: string, bodyPattern: RegExp) =>
      rules.findLastIndex((rule) => rule.selectors.includes(selector) && bodyPattern.test(rule.body));

    [
      ['.btn-primary:hover', '.btn:hover'],
      ['.btn-primary:active', '.btn:active'],
      ['.btn-primary:active:hover', '.btn:active:hover'],
    ].forEach(([primary, reset]) => {
      const clears = lastRule(reset, /background-color: unset !important/);
      expect(clears).toBeGreaterThan(-1);
      expect(lastRule(primary, /background-color: var\(--ce-action-primary-hover\) !important/)).toBeGreaterThan(
        clears,
      );
    });
    // Disabled buttons don't react to the pointer, and their label must stay on a fill. `:where` adds no specificity,
    // so a module's own disabled rule still wins.
    expect(
      moduleRule(
        compileModule('components/SurveyTool/SurveyTool.module.scss'),
        '.sessionInterviewPanel :global(.btn-primary):disabled:hover',
      ).background,
    ).toBe('var(--ce-action-accent)');
    const disabledHover = '.btn-primary:where(:disabled, .disabled):hover';
    expect(lastRule(disabledHover, /background-color: var\(--ce-action-primary\) !important/)).toBeGreaterThan(
      lastRule('.btn-primary:hover', /!important/),
    );
    expect(
      rules
        .filter(({ selectors }) => selectors.some((selector) => selector.startsWith('.btn-primary')))
        .filter(({ body }) => body.includes('--ce-compat-purple'))
        .flatMap(({ selectors }) => selectors),
    ).toEqual([]);
  });

  // Unstyled, the browser paints a file input's button, and Context Engine's hover shade left its label at 3.95:1.
  // The file name was 1.93:1 on a dark panel in the document text the theme gives other fields.
  test.each(registry.themes.map(({ id }) => id))('%s keeps native file inputs readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const rule = (selector: string) => moduleRule(css, `:root[data-ce-theme] ${selector}`);
    const field = composite(
      parseColor(values['input-bg']),
      composite(parseColor(values.surface), parseColor(values.canvas)),
    );
    const ratio = (color: string, fill: Rgba) => Number(contrastRatio(composite(paint(color), fill), fill).toFixed(2));
    const resting = rule('::file-selector-button');
    const pressed = { ...resting, ...rule('input:not(:disabled)::file-selector-button:active') };
    // A field's own text fill, such as the setup page's, would otherwise paint the label.
    expect(resting['-webkit-text-fill-color']).toBe('currentColor');
    const ratios = [
      ['label', ratio(resting.color, composite(paint(resting.background), field))],
      ['pressed label', ratio(pressed.color, composite(paint(pressed.background), field))],
      ['file name', ratio(rule('input[type=file]').color, field)],
    ] as const;
    expect(ratios.filter(([, value]) => value < 4.5)).toEqual([]);
  });

  // The Session Doc Library's fields sit in an upload box on a panel, both translucent layers on the page canvas.
  // Its link fields took the document text the recipe gives every field (1.93:1 in Context Engine), and Classic 95's
  // placeholders were 1.82:1.
  const docLibraryCss = compileModule('components/DocumentLibrary/DocumentLibraryPanel.module.scss');
  test.each(registry.themes.map(({ id }) => id))('%s keeps the Session Doc Library fields readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const rule = (selector: string) => moduleRule(docLibraryCss, selector);
    const layer = (selector: string, under: Rgba) => composite(paint(rule(selector).background), under);
    const field = composite(
      parseColor(values['input-bg']),
      layer('.uploadBox', layer('.panel', parseColor(values.canvas))),
    );
    const ratio = (color?: string) =>
      color ? Number(contrastRatio(composite(paint(color), field), field).toFixed(2)) : 0;
    const ratios = [
      ['text', ratio(rule('.uploadBox .uploadRow input.urlField').color)],
      ['placeholder', ratio(rule('.uploadBox .uploadRow input.urlField::placeholder').color)],
      ['file name', ratio(moduleRule(css, ':root[data-ce-theme] input[type=file]').color)],
    ] as const;
    expect(ratios.filter(([, value]) => value < 4.5)).toEqual([]);
  });

  // Every pairing below paints over the global `.btn` rules, so each fill has to be !important in every state.
  const stateSelectors = (button: string) =>
    ['', ':hover', ':focus', ':active', ':active:hover'].map((state) => `${button}${state}`);
  const importantFill = (moduleCss: string, selector: string) =>
    [...moduleCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(
      ([, selectors, body]) =>
        selectors.split(/,(?![^(]*\))/).some((candidate) => candidate.trim() === selector) &&
        /background: [^;]+ !important/.test(body) &&
        /[^-]color: [^;]+ !important/.test(body),
    );

  const adminCss = compileModule('components/Admin/AdminPage.module.scss');
  test.each(registry.themes.map(({ id }) => id))('%s keeps admin action buttons readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const card = composite(
      parseColor(values['card-bg']),
      composite(parseColor(values.surface), parseColor(values.canvas)),
    );
    const filled = [
      '.actionButton:global(.btn)',
      '.actionButton:global(.btn:hover:not(:disabled))',
      '.actionButton:global(.btn:focus:not(:disabled))',
      '.actionButton:global(.btn:active:not(:disabled))',
    ];
    const outline = [
      '.actionButton:global(.btn-outline-secondary)',
      '.actionButton:global(.btn-outline-secondary:hover:not(:disabled))',
      '.actionButton:global(.btn-outline-secondary:focus:not(:disabled))',
      '.actionButton:global(.btn-outline-secondary:active:not(:disabled))',
      '.subtleActionButton:global(.btn)',
      '.subtleActionButton:global(.btn:hover:not(:disabled))',
      '.subtleActionButton:global(.btn:focus:not(:disabled))',
      '.subtleActionButton:global(.btn:active:not(:disabled))',
    ];
    const diagnostics = [
      '.diagnosticsCard .actionButton:global(.btn)',
      '.diagnosticsCard .actionButton:global(.btn:hover:not(:disabled))',
      '.diagnosticsCard .actionButton:global(.btn:focus:not(:disabled))',
      '.diagnosticsCard .actionButton:global(.btn:active:not(:disabled))',
    ];
    expect([...filled, ...outline, ...diagnostics].filter((selector) => !importantFill(adminCss, selector))).toEqual(
      [],
    );

    const ratio = (color: string, fill: Rgba) => Number(contrastRatio(composite(paint(color), fill), fill).toFixed(2));
    const ratios = [
      ...filled.flatMap((selector) => {
        const rule = moduleRule(adminCss, selector);
        // The gradient's two stops: the label has to clear both.
        const stops = rule.background.match(/var\(--ce-[a-z0-9-]+\)/g) ?? [];
        expect(stops).toHaveLength(2);
        return stops.map((stop) => [selector, ratio(rule.color, composite(paint(stop), card))] as const);
      }),
      ...outline.map((selector) => {
        const rule = moduleRule(adminCss, selector);
        return [selector, ratio(rule.color, composite(paint(rule.background), card))] as const;
      }),
    ];
    expect(ratios.filter(([, value]) => value < 4.5)).toEqual([]);
  });

  test.each(registry.themes.map(({ id }) => id))('%s keeps the Groups panel readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const card = composite(
      parseColor(values['card-bg']),
      composite(parseColor(values.surface), parseColor(values.canvas)),
    );
    const rule = (selector: string) => moduleRule(adminCss, selector);
    const fillOf = (selector: string) => composite(paint(rule(selector).background), card);
    const ratio = (color: string, fill: Rgba) => Number(contrastRatio(composite(paint(color), fill), fill).toFixed(2));
    expect(rule('.panelTitle').opacity).toBeUndefined();
    const groupCard = fillOf('.statusItem');
    // The theme outranks a plain colour on these, and the panel also sits outside .adminPage.
    [
      '.subtleActionButton:global(.btn)',
      '.subtleActionButton:global(.btn:hover:not(:disabled))',
      '.dangerActionButton:global(.btn)',
      '.dangerActionButton:global(.btn:focus:not(:disabled))',
    ].forEach((selector) =>
      expect(
        [...adminCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(
          ([, selectors, body]) =>
            selectors.split(/,(?![^(]*\))/).some((candidate) => candidate.trim() === selector) &&
            /border-color: [^;]+ !important/.test(body),
        ),
      ).toBe(true),
    );
    expect(adminCss).toMatch(
      /\.panel :global\(\.form-control\)[^{]*\{[^}]*[^-]color: var\(--ce-control-text\) !important/,
    );
    expect(rule('.panel').color).toBe('var(--ce-panel-text)');
    expect(rule('.heroSessionDetailLabel').opacity).toBeUndefined();
    expect(rule('.hero').background).toBe('var(--ce-card-bg)');
    expect(rule('.inlineResourceCard').background).toBe('var(--ce-card-bg)');
    // Translucent fields add up with the layers under them, so each sits over an opaque surface.
    expect(rule('.panel :global(.form-control)').background).toContain('var(--ce-surface)');
    expect(rule('.panel :global(.form-select)')['background-color']).toBe('var(--ce-surface)');
    expect(rule('.statusItemClickable:hover').background).toBeUndefined();
    const ratios = [
      ['.panelTitle', ratio(rule('.panelTitle').color, card)],
      ['.panelSubtitle', ratio(rule('.panelSubtitle').color, card)],
      ['.statusNote', ratio(rule('.statusNote').color, fillOf('.statusNote'))],
      ['.statusItem text', ratio('var(--ce-panel-text)', groupCard)],
      ['.statusItem label', ratio(rule('.statusItem span:first-child').color, groupCard)],
      ['.statusItem link', ratio(rule('.statusItem a').color, groupCard)],
      ['.metadataItem label', ratio(rule('.metadataItem span:first-child').color, fillOf('.metadataItem'))],
      ['.panel label', ratio(rule('.panel :global(label)').color, card)],
      ['admin heading', ratio(rule('.heroTitleBlock h1').color, card)],
      ['connection badge', ratio(rule('.connectionBadgeActive').color, fillOf('.connectionBadgeActive'))],
      ['result box', ratio('var(--ce-panel-text)', fillOf('.resultBox'))],
      ['secret option', ratio('var(--ce-panel-text)', fillOf('.secretOptionCard'))],
      ['.adminPage label', ratio(rule('.adminPage :global(label)').color, card)],
      ['subtle button on a group', ratio(rule('.subtleActionButton:global(.btn)').color, groupCard)],
    ] as const;
    expect(ratios.filter(([, value]) => value < 4.5)).toEqual([]);
  });

  test.each(registry.themes.map(({ id }) => id))('%s keeps the group form readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const formCss = compileModule('components/Shared/WorkerGroupCreateForm.module.scss');
    const card = composite(
      parseColor(values['card-bg']),
      composite(parseColor(values.surface), parseColor(values.canvas)),
    );
    const selectors = [
      '.sessionContextName',
      '.sessionContextSlug',
      '.sectionHeading',
      '.field label',
      '.metadataCard > label',
      '.imageLabel',
      '.accessLabel',
      '.formHelp',
      '.status',
    ];
    expect(selectors.filter((selector) => moduleRule(formCss, selector).color !== 'var(--ce-control-text)')).toEqual(
      [],
    );
    // The theme paints every select and input with text meant for documents, so these rules must outrank it.
    expect(formCss).toMatch(/\.accessSelect[^{]*\{[^}]*[^-]color: var\(--ce-control-text\) !important/);
    // Placeholders set the fill too, or the input's own fill would make them look typed.
    ['.field input::placeholder', '.accessInput::placeholder', '.inlineInputRow input::placeholder'].forEach(
      (selector) =>
        expect([selector, moduleRule(formCss, selector)['-webkit-text-fill-color']]).toEqual([
          selector,
          'color-mix(in srgb, var(--ce-control-text) 78%, transparent)',
        ]),
    );
    expect(moduleRule(formCss, '.accessSelect').background).toContain('var(--ce-surface)');
    const wizardCard = moduleRule(
      compileModule('components/Sessions/SessionWizard.module.scss'),
      '.pendingWorkerGroupCard',
    ).background;
    expect(contrastRatio(paint('var(--ce-control-text)'), composite(paint(wizardCard), card))).toBeGreaterThanOrEqual(
      4.5,
    );
    const chooserCss = compileModule('components/Shared/CompactImageChooser.module.scss');
    expect(chooserCss).toMatch(/\.urlInput \{[^}]*[^-]color: var\(--ce-control-text\) !important/);
    const sessionContext = composite(paint(moduleRule(formCss, '.sessionContext').background), card);
    expect(contrastRatio(paint('var(--ce-control-text)'), sessionContext)).toBeGreaterThanOrEqual(4.5);
    expect(
      moduleRule(compileModule('components/SBTs/CreateSBTGroup.module.scss'), '.createGroupExpanded .createGroupTitle')
        .color,
    ).toBe('var(--ce-control-text)');
  });

  // Hover and press clear a danger outline's fill, so its label can't rely on that fill.
  test.each(registry.themes.map(({ id }) => id))('%s keeps the Groups panel danger button readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const card = composite(
      parseColor(values['card-bg']),
      composite(parseColor(values.surface), parseColor(values.canvas)),
    );
    const groupCard = composite(paint(moduleRule(adminCss, '.statusItem').background), card);
    expect(moduleRule(adminCss, '.statusItem').color).toBe('var(--ce-panel-text)');
    const selectors = [
      ':global(.btn)',
      ':global(.btn:hover:not(:disabled))',
      ':global(.btn:focus:not(:disabled))',
      ':global(.btn:active:not(:disabled))',
    ].map((state) => `.dangerActionButton${state}`);
    expect(selectors.filter((selector) => !importantFill(adminCss, selector))).toEqual([]);
    selectors.forEach((selector) => {
      const rule = moduleRule(adminCss, selector);
      expect([selector, rule.background]).toEqual([selector, 'transparent']);
      expect(contrastRatio(paint(rule.color), groupCard)).toBeGreaterThanOrEqual(4.5);
    });
  });

  // A group's Joined, Join period ended and Admin add required share this chip, which is translucent over the card.
  test.each(registry.themes.map(({ id }) => id))('%s keeps the group status chip readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const chip = moduleRule(
      compileModule('components/OnePageSession/OnePageSession.module.scss'),
      '.workerGroupCardInactiveStatus',
    );
    const card = composite(
      parseColor(values['card-bg']),
      composite(parseColor(values.surface), parseColor(values.canvas)),
    );
    const ratios = [card, parseColor(values['document-canvas'])].map((backdrop) => {
      const fill = composite(paint(chip.background), backdrop);
      return Number(contrastRatio(composite(paint(chip.color), fill), fill).toFixed(2));
    });
    expect(ratios.filter((value) => value < 4.5)).toEqual([]);
  });

  test.each(registry.themes.map(({ id }) => id))('%s keeps the session section headers readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const onePageCss = compileModule('components/OnePageSession/OnePageSession.module.scss');
    const surface = composite(
      parseColor(values['card-bg']),
      composite(parseColor(values.surface), parseColor(values.canvas)),
    );
    ['.sectionsGrid .sectionHeaderTitle', '.sectionsGrid .sectionHeaderSubtitle'].forEach((selector) =>
      expect([selector, moduleRule(onePageCss, selector).opacity]).toEqual([selector, undefined]),
    );
    // Every rule for these selectors, since the layouts each set their own colour and only one applies at a time.
    const ratios = ['.sectionHeaderTitle', '.sectionHeaderSubtitle', '.sectionHeader .sectionHeaderSubtitle'].flatMap(
      (selector) =>
        [...onePageCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
          .filter(([, selectors]) => selectors.split(/,(?![^(]*\))/).some((candidate) => candidate.trim() === selector))
          .flatMap(([, , body]) => [...body.matchAll(/(?:^|[;\s])color:\s*([^;]+);/g)].map(([, color]) => color.trim()))
          .map((color) => [selector, color, contrastRatio(composite(paint(color), surface), surface)] as const),
    );
    expect(ratios.length).toBeGreaterThanOrEqual(5);
    expect(ratios.filter(([, , value]) => value < 4.5)).toEqual([]);
  });

  // Minimal clears every button's border, so a button with no fill of its own reads as a plain word.
  test.each(registry.themes.map(({ id }) => id))('%s gives the settings buttons a readable fill', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const setupCss = compileModule('components/Sessions/setup/SessionSetup.module.scss');
    const surface = composite(parseColor(values.surface), parseColor(values.canvas));
    const ratios = ['.button', '.moreButton', '.primaryButton'].map((selector) => {
      const rule = moduleRule(setupCss, selector);
      expect([selector, rule.background]).not.toEqual([selector, 'transparent']);
      const fill = composite(paint(rule.background), surface);
      return [selector, Number(contrastRatio(composite(paint(rule.color), fill), fill).toFixed(2))] as const;
    });
    expect(ratios.filter(([, value]) => value < 4.5)).toEqual([]);
  });

  // A link with no state colour of its own takes the global `a:hover`, which fails on the button's fill.
  test.each(registry.themes.map(({ id }) => id))('%s keeps a link styled as a button readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const setupCss = compileModule('components/Sessions/setup/SessionSetup.module.scss');
    const surface = composite(parseColor(values.surface), parseColor(values.canvas));
    const fill = composite(paint(moduleRule(setupCss, '.button').background), surface);
    const ratios = ['a.button:hover', 'a.button:focus', 'a.button:active'].map((selector) => {
      const { color } = moduleRule(setupCss, selector);
      return [selector, color ? Number(contrastRatio(composite(paint(color), fill), fill).toFixed(2)) : 0] as const;
    });
    expect(ratios.filter(([, value]) => value < 4.5)).toEqual([]);
  });

  // A heading with no colour of its own takes the global one, which vanishes on dark themes.
  test.each(registry.themes.map(({ id }) => id))('%s keeps the setup banner title readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const setupCss = compileModule('components/Sessions/setup/SessionSetup.module.scss');
    const surface = composite(parseColor(values.surface), parseColor(values.canvas));
    const banner = composite(paint(moduleRule(setupCss, '.banner').background), surface);
    const title = composite(paint(moduleRule(setupCss, '.bannerTitle').color), banner);
    expect(contrastRatio(title, banner)).toBeGreaterThanOrEqual(4.5);
    const message = composite(paint(moduleRule(setupCss, '.pageBanner').color), banner);
    expect(contrastRatio(message, banner)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(registry.themes.map(({ id }) => id))('%s keeps the HTML report buttons readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const selectors = [
      ...['.htmlReportCancelButton', '.htmlReportDownloadButton', '.htmlReportGenerateButton'].flatMap(stateSelectors),
      // Download stays disabled while signed out. These dialogs are light in every theme, so dark-theme disabled
      // colours vanish, and hovering must not bring back the primary fill under a muted label.
      ...['.htmlReportDownloadButton', '.htmlReportGenerateButton'].flatMap((button) => [
        `${button}:disabled`,
        `${button}:disabled:hover`,
      ]),
    ];
    expect(selectors.filter((selector) => !importantFill(resultsCss, selector))).toEqual([]);
    const ratios = selectors.map((selector) => {
      const rule = resultsRule(selector);
      const fill = paint(rule.background);
      return [selector, Number(contrastRatio(composite(paint(rule.color), fill), fill).toFixed(2))] as const;
    });
    expect(ratios.filter(([, value]) => value < 4.5)).toEqual([]);
  });

  // The accent is 1.00:1 on Classic 95's teal. These sit on several surfaces, so they take each surface's text colour.
  test.each([
    [
      'components/SurveyTool/SingleQuestionResponse.module.scss',
      ['.decryptCta', '.maskedPromptActionButton'],
      'var(--decrypt-cta-text, var(--ce-panel-text))',
    ],
    [
      'components/SurveyTool/SurveyTool.module.scss',
      ['.gatedPromptNoticeActionButton', '.maskedPromptActionButton', '.decryptQuestionButton', '#decryptEditButton'],
      'inherit',
    ],
  ] as const)('%s keeps Decrypt on the surface text colour', (file, buttons, color) => {
    const moduleCss = compileModule(file);
    buttons.forEach((button) => {
      const rest = moduleRule(moduleCss, button);
      expect([button, rest.color, rest.border]).toEqual([button, color, '1px solid currentColor']);
      const hovered = moduleRule(moduleCss, `${button}:hover:not(:disabled)`);
      expect([button, hovered.color, hovered['border-color'], hovered.background]).toEqual([
        button,
        undefined,
        undefined,
        undefined,
      ]);
      expect([button, moduleRule(moduleCss, `${button}:focus`).outline]).toEqual([button, '2px solid currentColor']);
    });
  });

  // Inside the voice dialog the notice's group name meets `.sessionVoiceModeModal strong`, and has to outrank it.
  test('the group notice keeps its own colour for the group name', () => {
    const noticeCss = compileModule('components/OnePageSession/WorkerGroupAutoJoinNotice.module.scss');
    expect(moduleRule(noticeCss, '.notice .message strong').color).toBe('inherit');
    expect(
      moduleRule(compileModule('components/SurveyTool/SurveyTool.module.scss'), '.sessionVoiceModeModal strong').color,
    ).toBe('var(--ce-panel-text)');
  });

  const surveyToolCss = compileModule('components/SurveyTool/SurveyTool.module.scss');
  test.each(registry.themes.map(({ id }) => id))('%s keeps the surfaces Decrypt inherits from readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const onSurface = composite(parseColor(values.surface), parseColor(values.canvas));
    const ratio = (color: string, background: string, under: Rgba) => {
      const fill = composite(paint(background), under);
      return Number(contrastRatio(composite(paint(color), fill), fill).toFixed(2));
    };
    const notice = moduleRule(surveyToolCss, '.gatedPromptNotice');
    const responseNotice = moduleRule(surveyToolCss, '.userResponseNotice');
    const chip = moduleRule(surveyToolCss, '.decryptChip');
    const dialog = composite(parseColor(values['overlay-surface']), parseColor(values['overlay-base']));
    // The banner's colours are all set against its own fill, in every state.
    const banner = '.lockedQuestionsBannerOnDark';
    const bannerRule = moduleRule(surveyToolCss, banner);
    const onBanner = composite(paint(bannerRule.background), parseColor(values['overlay-base']));
    const bannerText = [
      banner,
      `${banner} .lockedQuestionsSubtext`,
      `${banner} .lockedSbtInlineLink`,
      `${banner} .lockedSbtInlineLink:hover`,
      `${banner} .lockedSbtInlineLink:focus`,
      `${banner} .lockedQuestionsDecryptButton`,
      `${banner} .lockedQuestionsDecryptButton:hover:not(:disabled)`,
      `${banner} .lockedQuestionsDecryptButton:focus:not(:disabled)`,
      `${banner} .lockedQuestionsDecryptButton:disabled`,
      `${banner} .lockedSbtCard`,
      `${banner} .lockedSbtCard:hover`,
      `${banner} .lockedSbtMeta`,
      `${banner} .lockedQuestionsCaretButton:hover:not(:disabled)`,
    ];
    expect(
      bannerText
        .map(
          (selector) =>
            [
              selector,
              Number(
                contrastRatio(composite(paint(moduleRule(surveyToolCss, selector).color), onBanner), onBanner).toFixed(
                  2,
                ),
              ),
            ] as const,
        )
        .filter(([, value]) => value < 4.5),
    ).toEqual([]);
    const onDark = moduleRule(surveyToolCss, '.lockedQuestionsBannerOnDark .lockedQuestionsDecryptButton');
    expect(
      [
        ['locked notice', ratio(notice.color, notice.background, onSurface)],
        ['response notice', ratio(responseNotice.color, responseNotice['background-color'], onSurface)],
        ['chip', ratio(chip.color, 'var(--ce-card-bg)', onSurface)],
        ['locked banner', ratio(onDark.color, 'transparent', dialog)],
      ].filter(([, value]) => Number(value) < 4.5),
    ).toEqual([]);
    expect(chip.opacity).toBeUndefined();
    expect(moduleRule(surveyToolCss, '.gatedEmptyCopy').color).toBe('inherit');
    const tooltipIcon = moduleRule(surveyToolCss, '.gatedPromptTooltipIcon');
    expect([tooltipIcon.color, tooltipIcon.opacity]).toEqual(['inherit', '1']);

    // Results' dialog names the colour the card's Decrypt takes; panel text is black on Classic 95's teal there.
    const resultsCard = moduleRule(resultsCss, '.surveyResultsResponseCard');
    const onCard = composite(paint(resultsCard.background), dialog);
    expect(resultsCard['--decrypt-cta-text']).toBe('var(--ce-overlay-text)');
    expect(contrastRatio(composite(paint(resultsCard['--decrypt-cta-text']), onCard), onCard)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  // The Group Agent's launcher paints the session chrome pair itself, so it reads on any section background, and its
  // dialog paints the setup page's surface.
  test.each(registry.themes.map(({ id }) => id))('%s keeps the Group Agent placeholder readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const onePageCss = compileModule('components/OnePageSession/OnePageSession.module.scss');
    const agentCss = compileModule('components/OnePageSession/GroupAgentModal.module.scss');
    const canvas = parseColor(values.canvas);
    const ratio = (rule: Record<string, string>) => {
      const fill = composite(paint(rule.background ?? 'transparent'), canvas);
      return Number(contrastRatio(composite(paint(rule.color), fill), fill).toFixed(2));
    };
    const ratios = [
      ...['', ':hover', ':focus-visible', ':active'].map(
        (state) => [`.groupAgentButton${state}`, ratio(moduleRule(onePageCss, `.groupAgentButton${state}`))] as const,
      ),
      ['.content', ratio(moduleRule(agentCss, '.content'))] as const,
    ];
    expect(ratios.filter(([, value]) => value < 4.5)).toEqual([]);
  });

  // A file's Visible to paints its own fills, so it reads on any panel, including the transcript box that places it;
  // a chosen toggle takes the control text as its fill.
  test.each(registry.themes.map(({ id }) => id))('%s keeps a file’s Visible to readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const pickerCss = compileModule('components/Sessions/setup/ContextAccessPicker.module.scss');
    const transcriptBox = moduleRule(
      compileModule('components/SurveyTool/SurveyTool.module.scss'),
      '.sessionTranscriptContextAccess',
    );
    const canvas = parseColor(values.canvas);
    const ratios = [canvas, composite(paint(transcriptBox['background-color'] ?? 'transparent'), canvas)].flatMap(
      (under, place) => {
        const ratio = (selector: string, on = under) => {
          const rule = moduleRule(pickerCss, selector);
          const fill = composite(paint(rule.background ?? 'transparent'), on);
          return Number(contrastRatio(composite(paint(rule.color), fill), fill).toFixed(2));
        };
        const panel = composite(paint(moduleRule(pickerCss, '.choices').background), under);
        return [
          ...['.toggle', '.choice', '.chosen'].map((selector) => [place, selector, ratio(selector)] as const),
          [place, '.limit', ratio('.limit', panel)] as const,
        ];
      },
    );
    expect(ratios.filter(([, , value]) => value < 4.5)).toEqual([]);
  });

  // Sharing for research sits on the AI submission info summary, hovered or not, or under it where the bar is narrow,
  // and its ? takes the label's colour.
  test.each(registry.themes.map(({ id }) => id))('%s keeps sharing for research readable on its bar', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    const surveyCss = compileModule('components/SurveyTool/SurveyTool.module.scss');
    const consentCss = compileModule('components/SurveyTool/SessionInterviewResearchConsent.module.scss');
    const canvas = parseColor(values.canvas);
    const bar = composite(paint(moduleRule(surveyCss, '.sessionInterviewReviewActions').background), canvas);
    const behind = {
      summary: composite(paint(moduleRule(surveyCss, '.sessionInterviewConsentOptions > summary').background), bar),
      hoveredSummary: composite(
        paint(moduleRule(surveyCss, '.sessionInterviewConsentOptions > summary:hover').background),
        bar,
      ),
      bar,
    };
    const label = paint(moduleRule(consentCss, '.provenanceOption').color);
    const help = moduleRule(consentCss, '.researchHelp');
    const helpHover = moduleRule(consentCss, '.researchHelp:hover');
    const ratios = Object.entries(behind).flatMap(([place, under]) => {
      const hoverFill = composite(paint(helpHover.background), under);
      return [
        [place, 'label', contrastRatio(composite(label, under), under)],
        [place, '?', contrastRatio(composite(paint(help.color), under), under)],
        [place, '? hovered', contrastRatio(composite(paint(help.color), hoverFill), hoverFill)],
      ] as const;
    });
    expect(ratios.filter(([, , value]) => value < 4.5)).toEqual([]);
  });

  test.each(registry.themes.map(({ id }) => id))('%s keeps the Context panels’ headings readable', (themeId) => {
    const values = themeValues(css, themeId);
    const paint = painter(values);
    // The headings take the panel's text colour rather than the site-wide heading colour.
    const shellCss = compileModule('components/OnePageSession/OnePageSession.module.scss');
    expect(moduleRule(shellCss, '.sessionContextManage h3').color).toBe('inherit');
    const panel = moduleRule(compileModule('components/Sessions/setup/SessionSetup.module.scss'), '.page');
    const fill = composite(paint(panel.background), parseColor(values.canvas));
    expect(contrastRatio(composite(paint(panel.color), fill), fill)).toBeGreaterThanOrEqual(4.5);
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
  test('speaker labels stay legible on the transcript in every theme and vision mode', () => {
    const colors = [...css.matchAll(/--ce-speaker-\d+:\s*([^;]+);/g)].map((match) => match[1].trim());
    expect(colors).toHaveLength(16);
    registry.themes.forEach(({ id }) => {
      const transcript = parseColor(themeValues(css, id)['text-inverse']);
      colors.forEach((color) => expect(contrastRatio(parseColor(color), transcript)).toBeGreaterThanOrEqual(4.5));
    });
  });
});
