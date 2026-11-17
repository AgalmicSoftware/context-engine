import path from 'node:path';
import * as sass from 'sass';

// On a phone `vh` counts the screen under the browser's bars, so centred modals such as Login sat low and ran
// under the bottom bar. Modal heights follow the visible screen, keeping `vh` only as the fallback written
// before a `dvh` value.
const srcDir = path.resolve(__dirname, '..', '..');
const rulesOf = (file: string) =>
  [
    ...sass
      .compile(path.resolve(srcDir, file), { loadPaths: [srcDir], style: 'expanded', logger: sass.Logger.silent })
      .css.replace(/\/\*[\s\S]*?\*\//g, '')
      .matchAll(/([^{}]+)\{([^{}]*)\}/g),
  ].map(([, selectors, body]) => ({ selectors: selectors.trim(), body }));

// The dimmed backdrop may run under the bars; the overlay, dialog and content may not.
const modalRules = rulesOf('assets/css/contextEngine.scss').filter(({ selectors }) =>
  /(^|[\s,])\.modal(-dialog[\w-]*|-content)?(?=$|[\s,.:>[])/.test(selectors),
);
// Modals that size their own overlay or dialog.
const ownModalRules = [
  ...rulesOf('components/About/AboutPage.module.scss').filter(({ selectors }) =>
    /\.recognitionModalDialog\b/.test(selectors),
  ),
  ...rulesOf('components/TagPage/TagPage.module.scss').filter(({ selectors }) =>
    /\.tagModal\b.*modal-dialog/.test(selectors),
  ),
];

const heightsOf = (body: string) =>
  [...body.matchAll(/(?<![\w-])((?:min-|max-)?height):\s*([^;]+);/g)].map(([, property, value]) => ({
    property,
    value,
  }));

it('finds the modal rules', () => {
  expect(modalRules.some(({ selectors }) => selectors === '.modal')).toBe(true);
  expect(modalRules.some(({ selectors }) => selectors === '.modal-dialog-centered')).toBe(true);
  expect(ownModalRules.length).toBeGreaterThanOrEqual(3);
});

it('gives the modal overlay the visible screen height', () => {
  const overlay = modalRules.filter(({ selectors }) => selectors === '.modal').flatMap(({ body }) => heightsOf(body));
  expect(overlay.filter(({ property }) => property === 'height').at(-1)?.value).toBe('100dvh');
});

it('uses vh in modal heights only as a fallback for a dvh value', () => {
  const vhOnly = [...modalRules, ...ownModalRules].flatMap(({ selectors, body }) => {
    const heights = heightsOf(body);
    return heights
      .filter(({ property, value }, index) => {
        if (!/\d(vh)\b/.test(value)) return false;
        const next = heights[index + 1];
        return !(next && next.property === property && /\ddvh\b/.test(next.value));
      })
      .map(({ property, value }) => `${selectors} { ${property}: ${value} }`);
  });
  expect(vhOnly).toEqual([]);
});

it('centres a modal by its visible-height overlay, not a spacer that counts the browser bars', () => {
  expect(modalRules.filter(({ selectors }) => /::before/.test(selectors)).map(({ selectors }) => selectors)).toEqual(
    [],
  );
});
