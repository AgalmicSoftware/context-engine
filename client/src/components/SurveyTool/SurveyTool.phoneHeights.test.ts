import path from 'node:path';
import * as sass from 'sass';

// On a phone `vh` counts the screen under the browser's bars, so the interview dialog sized by it put its foot,
// where Submit floats, beneath Safari's bottom bar once enough questions filled it. Its heights follow the
// visible screen instead.
const scssDir = path.resolve(__dirname, '..', '..');
const css = sass
  .compile(path.resolve(__dirname, 'SurveyTool.module.scss'), {
    loadPaths: [scssDir],
    style: 'expanded',
    logger: sass.Logger.silent,
  })
  .css.replace(/\/\*[\s\S]*?\*\//g, '');

const heightsOf = (selector: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(',').some((candidate) => candidate.trim() === selector))
    .flatMap(([, , body]) => [...body.matchAll(/((?:min-|max-)?height):\s*([^;]+);/g)].map(([, , value]) => value));

it.each([
  '.sessionVoiceModeModal',
  '.sessionListeningPanel',
  '.sessionListeningTranscript',
  '.sessionInterviewChoicesPanel',
])('%s sizes from the visible screen, not one that counts the browser’s bars', (selector) => {
  const heights = heightsOf(selector);
  expect(heights.some((value) => /dvh/.test(value))).toBe(true);
  expect(heights.filter((value) => /\d(vh)\b/.test(value))).toEqual([]);
});
