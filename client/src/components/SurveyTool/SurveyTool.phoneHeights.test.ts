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

// The live centring spacer and overlay counted the large viewport, so on an iPhone the review started a fifth of
// the way down with Submit under the bar; on a phone it now takes the whole visible screen.
it('gives the interview dialog the whole visible screen on a phone', () => {
  expect(css).toMatch(
    /@media \(max-width: 575\.98px\)\s*\{\s*\.sessionVoiceModeModal\s*\{\s*max-height: calc\(100dvh - 1rem\);/,
  );
});

// Every phone question card shares one height from the small viewport, which stays still while Safari's bars move,
// so the arrows under the card never shift from card to card.
it('gives every phone question card one height from the steady visible screen', () => {
  const unit = css.match(/\.pileInteractionUnit\s*\{([^{}]*--pile-phone-card-height[^{}]*)\}/)?.[1] || '';
  const values = [...unit.matchAll(/--pile-phone-card-height:\s*([^;]+);/g)].map(([, value]) => value);
  expect(values).toEqual(['max(380px, calc(100vh - 170px))', 'max(380px, calc(100svh - 170px))']);
  // The agent's question list shows a card outside the pile, where the variable is unset.
  expect(heightsOf('.pileCardInner')).toContain('var(--pile-phone-card-height, 380px)');
  // Choices scroll from the top: centring pushed the first ones out of reach.
  expect(css).toMatch(
    /\.pileCardInner \.pileCardMainContent:has\(\.multichoiceQuestionContainer\)\s*\{\s*justify-content: flex-start;/,
  );
});

// Submit appearing, the Submitted check and a long unsent-answers notice each moved the arrows on a phone.
it('keeps the phone arrows on their own row, after the wider rule that puts them beside the actions', () => {
  const ownRow = css.search(
    /@media \(max-width: 768px\) and \(max-width: 640px\)\s*\{\s*\.pileInteractionUnit \.pileControls > \.pileNav\s*\{\s*flex-basis: 100%;/,
  );
  const besideActions = css.search(/\.pileInteractionUnit \.pileControls > \.pileNav\s*\{\s*flex-basis: 180px;/);
  expect(besideActions).toBeGreaterThan(-1);
  expect(ownRow).toBeGreaterThan(besideActions);
  expect(css).toMatch(/\.pileInteractionUnit \.pileSubmitSuccessBadge\s*\{\s*width: 44px;\s*height: 44px;/);
  expect(css).toMatch(/\.pileInteractionUnit \.pileFooter\s*\{\s*min-width: 0;/);
  // Choices keep room below the last one for the fade and its focus ring.
  expect(css).toMatch(/padding-bottom: 28px;\s*scroll-padding-bottom: 28px;/);
});
