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

// Every phone question card shares one height: the small viewport (steady while Safari's bars move) below the card's
// measured top, less the controls row, so the row sits in view without scrolling and the arrows never shift.
it('gives every phone question card one height that leaves the controls row in view', () => {
  const unit = css.match(/\.pileInteractionUnit\s*\{([^{}]*--pile-phone-card-height[^{}]*)\}/)?.[1] || '';
  const values = [...unit.matchAll(/--pile-phone-card-height:\s*([^;]+);/g)].map(([, value]) => value);
  expect(values).toEqual([
    'max(240px, calc(100vh - var(--pile-card-top, 129px) - var(--pile-phone-row-space)))',
    'max(240px, calc(100svh - var(--pile-card-top, 129px) - var(--pile-phone-row-space)))',
  ]);
  // The row's 20px gap, its 44px (48px in Classic 95) controls and a margin under it.
  expect(unit).toMatch(/--pile-phone-row-space: 80px;/);
  // The agent's question list shows a card outside the pile, where the variable is unset.
  expect(heightsOf('.pileCardInner')).toContain('var(--pile-phone-card-height, 380px)');
  // Choices scroll from the top: centring pushed the first ones out of reach.
  expect(css).toMatch(
    /\.pileCardInner \.pileCardMainContent:has\(\.multichoiceQuestionContainer\)\s*\{[^}]*?justify-content: flex-start;/,
  );
});

// The actions, Submit and the arrows share one row on a phone. The arrows hold the row's right end at a fixed width
// and Submit takes what is left, so Submit appearing, the Submitted check and the unsent-answers notice never move
// them; the counter sits between the arrows in a slot of fixed width, so it takes room from Submit, never from them.
it('keeps the phone controls in one row, with the arrows fixed at its end', () => {
  const rule = (selector: string) =>
    css.match(new RegExp(`@media \\(max-width: 768px\\)\\s*\\{[^@]*?${selector}\\s*\\{([^{}]*)\\}`))?.[1] || '';
  expect(rule('\\.pileInteractionUnit \\.pileControls')).toMatch(/flex-wrap: nowrap;/);
  expect(rule('\\.pileInteractionUnit \\.pileControls > \\.pileNav')).toMatch(
    /flex: 0 0 auto;[\s\S]*margin-left: auto;/,
  );
  expect(rule('\\.pileInteractionUnit \\.pileFooter')).toMatch(/flex: 1 1 0;\s*min-width: 0;/);
  const counter = css.match(/\.pileInteractionUnit \.pileNav \.pileNavCounterText\s*\{([^{}]*)\}/)?.[1] || '';
  expect(counter).toMatch(/flex: none;[\s\S]*width: calc\(var\(--pile-counter-digits, 2\) \* 2ch \+ 2ch\);/);
  expect(counter).not.toMatch(/position: absolute/);
  expect(css).toMatch(/\.pileInteractionUnit \.pileFooter \.pilePendingAnswerNotice\s*\{\s*position: absolute;/);
  expect(css).not.toMatch(/\.pileNav\s*\{\s*flex-basis: 100%;/);
  // Choices keep room below the last one for the fade and its focus ring.
  expect(css).toMatch(/padding-bottom: 28px;\s*scroll-padding-bottom: 28px;/);
});

// Where a phone row is short of room, Submit keeps its word and its spinner rather than showing either cut.
it('keeps Submit readable on the narrowest phone rows', () => {
  expect(css).toMatch(
    /@media [^{]*max-width: 370px\)\s*\{[^@]*\.pileInteractionUnit \.pileControls > \.pileNav\s*\{\s*gap: 1px;/,
  );
  expect(css).toMatch(
    /\.pileInteractionUnit \.pileFooter \.pileSubmitProgress\s*\{\s*flex-wrap: wrap;[^}]*max-height: 1\.25em;\s*overflow: hidden;/,
  );
  expect(css).toMatch(/\.pileInteractionUnit \.pileFooter \.pileSubmitProgress > svg\s*\{\s*order: -1;/);
  expect(css).toMatch(/\.pileInteractionUnit\s*\{\s*--pile-phone-row-space: 84px;/);
  // The unsent-answers notice under the row keeps its own room, so a failed save's line below never sits under it.
  expect(css).toMatch(
    /\.pileInteractionUnit \.pileControls:has\(\.pilePendingAnswerNotice\)\s*\{\s*margin-bottom: 16px;/,
  );
});

// Next is the same arrow once a card has an answer, only in the theme's highlight, with a glow that pulses and then
// holds still (and only holds still under reduced motion).
it('highlights Next without changing its size', () => {
  const primary = css.match(/\n\.pileNav \.pileNavArrow\.pileNavArrowPrimary\s*\{([^{}]*)\}/)?.[1] || '';
  // Each theme sets its own highlight; themeContrast.test.ts holds it to 3:1 on the page.
  expect(primary).toMatch(/--pile-next-highlight: var\(--ce-pile-next-highlight\);/);
  expect(primary).not.toMatch(/width|height|padding|background/);
  expect(css).toMatch(/\.pileNavArrowPrimary\.pileNavArrowNudge\s*\{\s*animation: pileNextNudge 1\.1s ease-in-out 3;/);
  expect(css).toMatch(
    /prefers-reduced-motion: reduce[\s\S]*\.pileNavArrowPrimary\.pileNavArrowNudge:hover:not\(:disabled\)\s*\{\s*animation: none !important;\s*filter: drop-shadow/,
  );
});

// A free-text box fills the room under its prompt: a small box under a tall gap read as broken.
it('lets a phone free-text box fill the card', () => {
  expect(css).toMatch(
    /\.pileCardBody:has\(\.freeformQuestionContainer\) \.pileCardMainContent\s*\{\s*flex: 1 1 0;\s*min-height: 0;/,
  ); // Only the text box stretches; the microphone beside it keeps its size, and nothing reaches the footer.
  const fill = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectors]) =>
    /audioInputContainer|inputRow|textareaWrap|audioTextarea/.test(selectors),
  );
  expect(fill.length).toBeGreaterThan(0);
  fill.forEach(([selectors, body]) => {
    selectors.split(',').forEach((selector) => expect(selector).toMatch(/\.pileCardMainContent :global\(/));
    expect(body).not.toMatch(/align-items: stretch/);
  });
  expect(fill.some(([selectors]) => /microphoneButton|topControls/.test(selectors))).toBe(false);
});

// A long choice list fades at whichever end has more; usePileHalfRowCut sets the cue.
it('fades a phone choice list where more options are', () => {
  expect(css).toMatch(/\[data-list-cue=start\],[^{]*\[data-list-cue=middle\]\s*\{\s*--pile-list-fade-bottom:/);
  expect(css).toMatch(/\[data-list-cue=middle\],[^{]*\[data-list-cue=end\]\s*\{\s*--pile-list-fade-top:/);
});
