import path from 'node:path';
import * as sass from 'sass';

// Classic 95's topic window keeps a small close button in its title bar, with a wider reach for a thumb. That reach
// was a 44px square hung from the button, so it ran about 20px below the bar, and a tap on the window's first line
// closed the window. It is now 44px wide at the bar's right end and exactly as tall as the bar.
const srcDir = path.resolve(__dirname, '..', '..');
const rules = [
  ...sass
    .compile(path.resolve(__dirname, 'DebateMap.module.scss'), {
      loadPaths: [srcDir],
      style: 'expanded',
      logger: sass.Logger.silent,
    })
    .css.replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/([^{}]+)\{([^{}]*)\}/g),
].map(([, selectors, body]) => ({ selectors: selectors.split(',').map((selector) => selector.trim()), body }));

// Every declaration the window's own rules give a part, in order; the last of a property wins.
const WINDOW = '.debateMapWrapper.embeddedAtlas .debateMap .modalContent .modalHeader';
const declared = (selector: string) =>
  rules
    .filter(({ selectors }) => selectors.includes(selector))
    .map(({ body }) => body)
    .join('\n');
const last = (body: string, property: string) =>
  [...body.matchAll(new RegExp(`(?<![\\w-])${property}:\\s*([^;]+);`, 'g'))].at(-1)?.[1];

it("keeps the Classic 95 close button's reach inside its title bar", () => {
  const reach = declared(`${WINDOW} .closeIcon::after`);
  expect(last(reach, 'position')).toBe('absolute');
  expect(last(reach, 'width')).toBe('44px');
  // Top and bottom of the bar, at its right end: as tall as the bar, whatever its title wraps to.
  expect(last(reach, 'top')).toBe('0');
  expect(last(reach, 'bottom')).toBe('0');
  expect(last(reach, 'right')).toBe('0');
  expect(last(reach, 'height')).toBeUndefined();
  // The reach is placed against the bar, not the button: the bar holds positioned children, the button does not.
  expect(last(declared(WINDOW), 'position')).toBe('sticky');
  expect(last(declared(`${WINDOW} .closeIcon`), 'position')).toBe('static');
});

it("keeps the reach clear of the title bar's other buttons", () => {
  // The button is at least 22px wide and sits 2px in from the bar's end, so 44px reaches at most 20px to its left.
  const button = declared(`${WINDOW} .closeIcon`);
  expect(last(button, 'min-width')).toBe('22px');
  expect(last(declared(WINDOW), 'padding')).toBe('2px 2px 2px 6px');
  expect(last(declared(`${WINDOW} .modalControls`), 'padding-left')).toBe('22px');
});
