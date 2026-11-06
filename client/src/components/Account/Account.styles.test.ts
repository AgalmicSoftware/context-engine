import path from 'path';
import * as sass from 'sass';

const srcDir = path.resolve(__dirname, '..', '..');
const compile = (file: string) =>
  sass.compile(path.resolve(srcDir, file), { loadPaths: [srcDir], style: 'expanded' }).css;
const globalCss = compile('assets/css/contextEngine.scss');
const accountCss = compile('components/Account/Account.module.scss');
const minimalCss = accountCss.slice(accountCss.indexOf('style(--ce-layout-profile: minimal-app)'));

const rules = (css: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
    selectors: selectors.split(/,(?![^(]*\))/).map((selector) => selector.trim()),
    body,
  }));

// Enough of the specificity rules for button selectors: `:is()` counts once, `:not()` as its argument.
const specificity = (selector: string) => {
  const flat = selector.replace(/:is\([^)]*\)/g, ':is').replace(/:not\(([^)]*)\)/g, '$1');
  return (flat.match(/[.:][\w-]+/g) || []).length * 100 + (/^[a-z]/.test(flat) ? 1 : 0);
};

// The global rules that paint or clear this variant's fill with !important once it's hovered, focused or pressed.
const globalFillRules = (variant: string) =>
  rules(globalCss)
    .filter(({ body }) => /background(-color|-image)?:[^;]*!important/.test(body))
    .flatMap(({ selectors }) => selectors)
    .filter((selector) => {
      const state = selector.replace(/:not\([^)]*\)/g, '');
      return (
        new RegExp(`^\\.btn(-${variant})?(:[a-z-]+)*:(hover|focus|active)(:[a-z-]+)*$`).test(state) &&
        !state.includes(':disabled')
      );
    });

const stateSelector = (button: string) => `button.${button}:is(:hover, :focus, :active):not(:disabled)`;

describe('passkey buttons under the global .btn rules', () => {
  // contextEngine.scss clears `.btn` fills on hover and press and paints `.btn-primary:focus`, all with !important.
  // That left these light labels on the dialog behind them: white on white in Minimal, 1.82:1 in Classic 95.
  it.each([
    ['passkeyButtonPrimary', 'primary'],
    ['passkeyButtonOutline', 'outline-secondary'],
  ])('keeps the %s fill on hover, focus and press in every theme', (button, variant) => {
    const selector = stateSelector(button);
    const own = rules(accountCss).filter(({ selectors }) => selectors.includes(selector));

    expect(own).toHaveLength(2); // the shared fill, then Minimal's
    expect(rules(minimalCss).filter(({ selectors }) => selectors.includes(selector))).toHaveLength(1);
    own.forEach(({ body }) => {
      expect(body).toMatch(/background-color: [^;]+ !important;/);
      expect(body).toMatch(/background-image: [^;]+ !important;/);
    });

    const opposing = globalFillRules(variant);
    expect(opposing.length).toBeGreaterThan(0);
    expect(specificity(selector)).toBeGreaterThan(Math.max(...opposing.map(specificity)));
  });

  it.each([
    ['passkeyButtonPrimary', 'var(--ce-document-surface)', 'var(--ce-action-primary-text)'],
    ['passkeyButtonOutline', 'var(--ce-document-surface)', 'var(--ce-control-text)'],
  ])('keeps the %s label when pressed', (button, shared, minimal) => {
    // Pressing `.btn-outline-secondary` paints a dark label, which measured 1.03:1 on Context Engine's fill.
    const own = rules(accountCss).filter(({ selectors }) => selectors.includes(stateSelector(button)));
    expect(own.map(({ body }) => body.match(/[^-]color: ([^;]+);/)?.[1])).toEqual([
      `${shared} !important`,
      `${minimal} !important`,
    ]);
  });
});
