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
    /\.pileCardInner \.pileCardMainContent:has\(#multiChoice\)\s*\{[^}]*?justify-content: flex-start;/,
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
  expect(counter).toMatch(/flex: none;/);
  expect(counter).not.toMatch(/position: absolute/);
  expect(css).toMatch(/\.pileInteractionUnit \.pileFooter \.pilePendingAnswerNotice\s*\{\s*position: absolute;/);
  expect(css).not.toMatch(/\.pileNav\s*\{\s*flex-basis: 100%;/);
  // Choices keep room below the last one for the fade and its focus ring.
  expect(css).toMatch(/padding-bottom: 28px;\s*scroll-padding-bottom: 28px;/);
});

// Where a phone row is short of room, Submit keeps its word and its spinner rather than showing either cut.
it('keeps Submit readable on the narrowest phone rows', () => {
  expect(css).toMatch(
    /@media [^{]*max-width: 430px\)\s*\{[^@]*\.pileInteractionUnit \.pileControls > \.pileNav\s*\{\s*gap: 1px;/,
  );
  expect(css).toMatch(
    /\.pileInteractionUnit \.pileFooter \.pileSubmitProgress\s*\{\s*flex-wrap: wrap;[^}]*max-height: 1\.25em;\s*overflow: hidden;/,
  );
  expect(css).toMatch(/\.pileInteractionUnit \.pileFooter \.pileSubmitProgress > svg\s*\{\s*order: -1;/);
  expect(css).toMatch(/\.pileInteractionUnit\s*\{\s*--pile-phone-row-space: 84px;/);
  // The unsent-answers notice is not drawn on a phone row (the number on Submit says it), so the row keeps no room
  // for it; it stays in the page for screen readers.
  expect(css).not.toMatch(/\.pileControls:has\(\.pilePendingAnswerNotice\)/);
  expect(css).toMatch(
    /\.pileInteractionUnit \.pileFooter \.pilePendingAnswerNotice\s*\{\s*position: absolute;\s*width: 1px;\s*height: 1px;\s*overflow: hidden;\s*clip-path: inset\(50%\);/,
  );
  expect(css).not.toMatch(/\.pilePendingAnswerNotice\s*\{[^}]*display: none/);
});

// The arrows sit against the counter, with no margin between: each icon is drawn at the counter's side of its
// 44px target, and its keyboard ring pulled in to the target's edge. The room goes to Submit, whose count always shows,
// without brackets, in the button's top corner, as large as the gap above the word holds.
it('closes the phone arrows up to the counter and keeps the Submit count in view', () => {
  const counter = css.match(/\.pileInteractionUnit \.pileNav \.pileNavCounterText\s*\{([^{}]*)\}/)?.[1] || '';
  expect(counter).toMatch(/margin: 0;/);
  expect(css).toMatch(
    /\.pileInteractionUnit \.pileNav \.pileNavArrow:first-child\s*\{\s*justify-content: flex-end;\s*padding-right: 4px;/,
  );
  expect(css).toMatch(
    /\.pileInteractionUnit \.pileNav \.pileNavArrow:last-child\s*\{\s*justify-content: flex-start;\s*padding-left: 4px;/,
  );
  expect(css).toMatch(
    /\.pileInteractionUnit \.pileControls \.pileNav \.pileNavArrow:focus-visible\s*\{\s*outline-offset: -1px;/,
  );
  // The word moves down under the number, by margins that cancel, so the button does not grow.
  expect(css).toMatch(
    /\.pileInteractionUnit \.pileFooter \.pileSubmitButtonLabelCounted\s*\{\s*margin-top: 5px;\s*margin-bottom: -5px;/,
  );
});

// Rules outside every media query: in the expanded output only their selectors start a line.
const topLevelRules = (selector: string) =>
  [...css.matchAll(/(?:^|\n)([^\s@}][^{}]*)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(',').some((candidate) => candidate.trim() === selector))
    .map(([, , body]) => body);

// Every Submit that sends answers shows its count the same way at every width: small, without brackets, in the
// button's top corner. Each button is the count's frame. The bar's word, which the bar otherwise positions and layers
// below the button's glow, is left unpositioned, and on a one-row bar stays level with the buttons beside it,
// leaving the count room at its end instead.
it('frames the count in the corner of every Submit that sends answers, at every width', () => {
  expect(topLevelRules('.pileSubmitButtonCount').join('')).toMatch(
    /position: absolute;\s*top: 4px;\s*right: 5px;\s*z-index: 3;\s*font-size: 16px;\s*font-weight: 700;\s*line-height: 0\.75;/,
  );
  for (const button of [
    '.headerSubmitButton',
    '.pileFooter .pileSubmitButton',
    '#submitSurveyButton',
    '.sessionInterviewPanel .sessionInterviewSubmitButton',
    '.pileEndPrimary',
  ]) {
    expect([button, topLevelRules(button).some((body) => /position: relative;/.test(body))]).toEqual([button, true]);
  }
  expect(css).not.toMatch(/pileSubmitButtonCountBracket/);
  expect(topLevelRules('.headerSubmitButton > .pileSubmitButtonLabel').join('')).toMatch(
    /position: static;\s*z-index: auto;/,
  );
  expect(topLevelRules('.headerSubmitButton > .pileSubmitButtonLabelCounted').join('')).toMatch(/margin-right: 10px;/);
});

// While a Submit saves, every one wears the pile's busy look: the theme's quiet Submit colours at full strength, so
// "SAVING · 3s" reads. The bar's had faded to 40% and the end card's to 70%; the one-question page's label stayed
// white on the light fill; and the interview's, under the pointer, took the panel's accent fill under its quiet text.
it('keeps a busy Submit in the quiet Submit colours everywhere, at full strength', () => {
  const quietFill = /background(?:-color)?: var\(--ce-action-submit-disabled-bg\)/;
  for (const busy of [
    '.headerSubmitButton:disabled',
    '.headerSubmitButton:disabled:hover',
    '.pileEndPrimary:disabled',
  ]) {
    const body = topLevelRules(busy).join('');
    expect([busy, quietFill.test(body), /color: var\(--ce-action-submit-disabled-text\)/.test(body)]).toEqual([
      busy,
      true,
      true,
    ]);
    expect([busy, /opacity/.test(body)]).toEqual([busy, false]);
  }
  expect(topLevelRules('#uploadingEncryptingText').join('')).toMatch(/color: inherit;/);
  const interviewHover = '.sessionInterviewPanel .sessionInterviewSubmitButton:disabled:hover';
  expect(topLevelRules(interviewHover).join('')).toMatch(
    /background: var\(--ce-action-submit-disabled-bg\) !important;/,
  );
  // As specific as the panel's accent rule for disabled primary buttons, so it must come after it.
  expect(css.indexOf(`${interviewHover} {`)).toBeGreaterThan(
    css.indexOf('.sessionInterviewPanel :global(.btn-primary):disabled:hover {'),
  );
  expect(css.indexOf('.sessionInterviewPanel :global(.btn-primary):disabled:hover {')).toBeGreaterThan(-1);
});

// The counter gives way to Submit's word: one line, then its numbers stacked, then gone. A row that was a hair too
// tight in another platform's rendering of the same font cut the word ("Submit" lost its end at 375px). Its form
// now comes from the row's width against what the row needs in the font in use, never from a width in pixels.
it('sizes the phone counter by the room the row has in the font in use', () => {
  const counter = css.match(/\.pileInteractionUnit \.pileNav \.pileNavCounterText\s*\{([^{}]*)\}/)?.[1] || '';
  // What the rest of an answered row needs: its fixed parts and Submit's word, counted in this font's digits and
  // never under a floor, so a fallback font with narrow digits cannot count the word short.
  expect(counter).toMatch(
    /--pile-row-rest: calc\(\s*var\(--pile-row-fixed\) \+ var\(--pile-row-arrows\) \+ max\(var\(--pile-submit-digits\) \* 1ch, var\(--pile-submit-floor\)\) \+\s*8px\s*\);/,
  );
  // Classic 95's word is wider than its digits say where letters are drawn whole pixels wide, so it and the
  // values a browser without style queries gets keep 72px; the other two themes' own fonts need 62px.
  expect([...css.matchAll(/--pile-submit-floor: (\d+)px;/g)].map((match) => match[1])).toEqual([
    '72',
    '62',
    '62',
    '72',
  ]);
  // Each form's switch compares the row's own width (cqw) with that need and the form's width.
  expect(counter).toMatch(
    /--pile-room-line: calc\(\(100cqw - var\(--pile-row-rest\) - var\(--pile-counter-line\)\) \* 999\);/,
  );
  expect(counter).toMatch(
    /--pile-room-stack: calc\(\(100cqw - var\(--pile-row-rest\) - var\(--pile-counter-stack\)\) \* 999\);/,
  );
  // The line's width with room for it, else the stack's, else nothing; and nothing it shows is cut.
  expect(counter).toMatch(
    /width: min\(max\(0px, var\(--pile-room-stack\)\), clamp\(var\(--pile-counter-stack\), var\(--pile-counter-stack\) \+ var\(--pile-room-line\), var\(--pile-counter-line\)\)\);/,
  );
  expect(counter).toMatch(/flex-wrap: wrap;[\s\S]*overflow: hidden;/);
  expect(css).toMatch(
    /\.pileInteractionUnit \.pileNav \.pileNavCounterSlash\s*\{[^}]*font-size: clamp\(0px, var\(--pile-room-line\), 1em\);/,
  );
  // Stacked, the first number takes a line to itself, so "1" and "11" never read as 111 once the slash has gone.
  expect(css).toMatch(
    /\.pileNavCounterText > span:first-child\s*\{\s*min-width: clamp\(0px, var\(--pile-room-line\) \* -1, 100%\);/,
  );
  // Submit's word is measured without letter spacing on every phone row, not only the narrow ones.
  expect(css).toMatch(
    /@media \(max-width: 768px\)\s*\{\s*\.pileInteractionUnit \.pileFooter \.pileSubmitButton\s*\{\s*letter-spacing: 0;/,
  );
  // No breakpoint in pixels decides the counter's form any more.
  expect(css).not.toMatch(/@container pile-row \(max-width: \d+px\)/);
  // The same on every card, with or without Submit, so the arrows never move: nothing about Submit selects it.
  expect(css).not.toMatch(/:has\([^)]*pileSubmit[^)]*\)[^{]*\.pileNavCounterText/);
  // Each theme says how wide Submit's word is in its own fonts. The first, unconditional values are the most any
  // theme needs: a browser without style queries (Safari before 18) gets those in every theme, and must hold back
  // too much room rather than too little.
  const themed = [
    ...css.matchAll(/--pile-submit-digits: (\d+);\s*--pile-submit-chars: ([\d.]+);\s*--pile-row-arrows: (\d+)px;/g),
  ].map((match) => match.slice(1, 4).map(Number));
  expect(themed).toEqual([
    [9, 6.8, 8],
    [7, 5.95, 0],
    [8, 6.8, 0],
    [9, 6.5, 8],
  ]);
  themed.slice(1).forEach((own) => own.forEach((value, at) => expect(value).toBeLessThanOrEqual(themed[0][at])));
  // Where the row is short even with the counter gone, the word shrinks by as much as it is short, not cut.
  expect(css).toMatch(
    /\.pileInteractionUnit \.pileFooter \.pileSubmitButtonLabel\s*\{\s*font-size: clamp\(0\.8em, 1em \+ \(100cqw - var\(--pile-row-fixed\) - var\(--pile-row-arrows\) \+ 10px - max\(var\(--pile-submit-chars\) \* 1ch, var\(--pile-submit-floor\)\) - 8px\) \* 0\.3, 1em\);/,
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

// The options spread apart by what usePileHalfRowCut measures, so a long list fills its room and still ends
// partway through an option; a fixed gap left a blank band under it.
it('lets a choice list spread its options to fill the card', () => {
  expect(css).toMatch(
    /^#multiChoice\s*\{[^}]*flex-direction: column;[^}]*gap: calc\(8px \+ var\(--pile-list-row-spread, 0px\)\);/m,
  );
});

// Choice options ran sideways in a strip on a computer and stacked on a phone. They stack one per line at every
// width, in an answer area that scrolls up and down and takes the room the prompt leaves, never room from it.
it('lists choice options one per line at every width, scrolling up and down only', () => {
  // A rule at the top level of the stylesheet, which holds at every width.
  const everywhere = (selector: string) =>
    css.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm'))?.[1] || '';
  expect(everywhere('.pileCardInner .pileCardMainContent:has(#multiChoice)')).toMatch(
    /overflow-x: hidden;[\s\S]*overflow-y: auto;[\s\S]*flex: 1 1 0;\s*min-height: 0;/,
  );
  expect(everywhere('#multiChoice')).toMatch(/flex-direction: column;\s*flex-wrap: nowrap;\s*align-items: stretch;/);
  expect(everywhere('#multiChoice .checkboxOptionText')).toMatch(/width: 100%;\s*max-width: 100%;/);
  // Nothing in a choice list scrolls or snaps sideways, or wraps its options into columns.
  const choiceRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([selectors]) =>
    /multichoiceQuestionContainer|#multiChoice/.test(selectors),
  );
  expect(choiceRules.length).toBeGreaterThan(5);
  choiceRules.forEach(([selectors, body]) =>
    expect([selectors.trim(), body]).toEqual([
      selectors.trim(),
      expect.not.stringMatching(/overflow-x: (auto|scroll)|scroll-snap-type: x|flex-wrap: wrap|grid-auto-flow: column/),
    ]),
  );
});
