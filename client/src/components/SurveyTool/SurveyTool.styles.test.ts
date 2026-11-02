import fs from 'fs';
import path from 'path';

const readSurveyToolScss = () => fs.readFileSync(path.join(__dirname, 'SurveyTool.module.scss'), 'utf8');

const checks = [
  { selector: /\.pileCard(?:\s*,|\s*$)/, declaration: /transition-duration: 0\.01ms !important;/ },
  {
    selector: /\.pileFooter\s+\.pileSubmitButton\.submitGlow::before(?:\s*,|\s*$)/,
    declaration: /animation:\s*none !important;/,
  },
  { selector: /\.headerSubmitButton\.submitGlow::before(?:\s*,|\s*$)/, declaration: /animation:\s*none !important;/ },
];
const reducedMotionBodies = (text: string): string[] => {
  const condition = '@media (prefers-reduced-motion: reduce) {';
  const bodies: string[] = [];
  let from = text.indexOf(condition);
  while (from >= 0) {
    let depth = 0;
    let end = from + condition.length - 1;
    for (; end < text.length; end += 1) {
      if (text[end] === '{') depth += 1;
      else if (text[end] === '}' && --depth === 0) break;
    }
    bodies.push(text.slice(from + condition.length, end));
    from = text.indexOf(condition, end);
  }
  return bodies;
};
const checkRule = (text: string, check: (typeof checks)[number]) =>
  reducedMotionBodies(text).some((body) =>
    [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(
      ([, selector, declarations]) => check.selector.test(selector) && check.declaration.test(declarations),
    ),
  );
const motionGuardPasses = (text: string) => checks.every((check) => checkRule(text, check));
it.each(checks)('keeps each pile and submit motion rule inside reduced motion (%s)', (check) => {
  expect(checkRule(readSurveyToolScss(), check)).toBe(true);
});
it('rejects rules moved out of their reduced-motion block', () => {
  const text = readSurveyToolScss();
  const condition = '@media (prefers-reduced-motion: reduce) {';
  const start = text.lastIndexOf(condition);
  expect(start).toBeGreaterThan(0);
  const mutated = text.slice(0, start) + '@media (min-width: 0) {' + text.slice(start + condition.length);
  expect(motionGuardPasses(text)).toBe(true);
  expect(motionGuardPasses(mutated)).toBe(false);
});

it('rejects selectors moved to a different reduced-motion rule', () => {
  const text = readSurveyToolScss();
  const mutated = text
    .replace('  .pileCard,\n  .pileActions {', '  .pileActions {')
    .replace('  .pileSubmitSuccessBadge,', '  .pileCard,\n  .pileSubmitSuccessBadge,');
  expect(motionGuardPasses(text)).toBe(true);
  expect(motionGuardPasses(mutated)).toBe(false);
});

// The text of the first rule whose selector is exactly `selector`, nested rules included.
const ruleText = (text: string, selector: string) => {
  const start = text.indexOf(`${selector} {`);
  if (start < 0) return '';
  let depth = 0;
  for (let end = text.indexOf('{', start); end < text.length; end += 1) {
    if (text[end] === '{') depth += 1;
    else if (text[end] === '}' && --depth === 0) return text.slice(start, end + 1);
  }
  return '';
};

// Group Conversation's colour pairs; their contrast in each theme is checked in scss/themes/themeContrast.test.ts.
describe('Group Conversation dialog colours', () => {
  const scss = readSurveyToolScss();
  const drafts = ruleText(scss, '.sessionListeningPanelEmbedded .sessionListeningCreateWrap');

  it('draws draft fields on the dialog colour with a muted-text edge and placeholder', () => {
    const fields = drafts.slice(drafts.indexOf(':global(.form-control) {'));
    expect(fields).toMatch(
      /^[^}]*background: color-mix\(in srgb, var\(--ce-surface-sunken\) 68%, transparent\) !important;\s*border-color: var\(--ce-panel-text-muted\) !important;/,
    );
    expect(fields).toMatch(/^[^}]*&::placeholder \{\s*color: var\(--ce-panel-text-muted\) !important;/);
    expect(drafts).toMatch(
      /:global\(\[class\*='tagInputGroup'\]\) \{\s*border-color: var\(--ce-panel-text-muted\) !important;\s*&:focus-within \{\s*outline: 2px solid var\(--ce-focus-ring\);/,
    );
    expect(ruleText(scss, ".sessionListeningPanelEmbedded :global([class*='paste']) textarea")).toMatch(
      /border: 1px solid var\(--ce-panel-text-muted\) !important;\s*color: var\(--ce-panel-text\) !important;/,
    );
    expect(drafts).not.toMatch(/var\(--ce-overlay-surface\) \d+%/);
  });

  it('draws submit progress in the dialog colours', () => {
    expect(drafts).toMatch(
      /:global\(\[class\*='step'\]\) \{\s*color: var\(--ce-panel-text-muted\) !important;\s*span,\s*svg \{\s*background: var\(--ce-surface-sunken\) !important;/,
    );
    expect(drafts).toMatch(
      /:global\(\[class\*='stepCompleted'\]\) \{\s*color: var\(--ce-status-success-text\) !important;/,
    );
  });

  it("gives a tinted tag chip's remove × the chip's text colour, and the help icon full opacity", () => {
    expect(drafts).toMatch(
      /:global\(\[class\*='removeIcon'\]\) \{\s*color: inherit !important;\s*&:hover \{\s*color: var\(--ce-status-danger-text\) !important;/,
    );
    expect(drafts).toMatch(/:global\(\[class\*='singleSelectLabel'\]\) svg \{\s*opacity: 1;/);
  });

  it('keeps the white transcript pill and clear button in document text', () => {
    const pillHover = ruleText(
      scss,
      '.sessionListeningTranscriptButton:hover,\n.sessionListeningTranscriptButton:focus-visible',
    );
    expect(pillHover).toMatch(/border-color: var\(--ce-status-info\) !important;/);
    expect(pillHover).not.toMatch(/[^-]color:/);
    expect(ruleText(scss, '.sessionListeningClearTranscript')).toMatch(
      /background: var\(--ce-text-inverse\);\s*color: var\(--ce-document-text\);/,
    );
    expect(ruleText(scss, '.sessionListeningClearTranscript:disabled')).toMatch(/opacity: 0\.6;/);
  });

  it('keeps recorder icons and focus rings clear of their surfaces', () => {
    expect(ruleText(scss, '.sessionListeningPanel .sessionListeningTimerDot')).toMatch(
      /color: color-mix\(in srgb, var\(--ce-status-error\) 60%, var\(--ce-text-inverse\)\);/,
    );
    expect(ruleText(scss, '.sessionListeningStopButton')).toMatch(
      /color: color-mix\(in srgb, var\(--ce-status-error\) 65%, var\(--ce-compat-dark\)\);/,
    );
    expect(scss).toMatch(
      /\.sessionListeningPanel\s+:is\(\.sessionListeningActiveRecorder, \.sessionListeningTranscriptDetails\)\s+:is\(button, textarea\):focus-visible,\s*\.sessionListeningPanel:not\(\.sessionListeningPanelEmbedded\) :is\(a, button, input, textarea\):focus-visible \{\s*outline-color: var\(--ce-document-text\);/,
    );
  });

  it('labels a held-off or submitting Submit in panel text, readable on its face and fill', () => {
    expect(ruleText(scss, '.sessionListeningCreateWrap')).toMatch(
      /:disabled > :global\(\[class\*='buttonContent'\]\) \{\s*color: var\(--ce-panel-text\) !important;/,
    );
  });

  it('presses the audio buttons onto a face their icons stay readable on', () => {
    expect(ruleText(scss, '.sessionListeningAudioButton')).toMatch(
      /&:active:not\(:disabled\) \{\s*background: color-mix\(in srgb, var\(--ce-document-border\) 50%, var\(--ce-text-inverse\)\);/,
    );
  });

  it('keeps the Generate fill under the global .btn hover, focus and press resets', () => {
    expect(ruleText(scss, 'button.sessionListeningGenerate:is(:hover, :focus, :active):not(:disabled)')).toMatch(
      /background: var\(--ce-status-success\) !important;/,
    );
  });
});

// Floating at zero height, the new-drafts cue covered the recorder and each draft's type chip and Edit
// button on a phone. Once drafts exist it keeps a lane of its own, so showing or clearing it moves nothing;
// while it shows, the lane sticks to the top of the dialog body and scroll targets stop below it.
it('gives the new-drafts cue a lane of its own and keeps scroll targets below it', () => {
  const scss = readSurveyToolScss();
  const cue = ruleText(scss, '.sessionNewDraftsCue');
  expect(cue).not.toMatch(/[^-]height: 0;/);
  expect(cue).toMatch(
    /\.sessionListeningPanelWithDraft > & \{\s*box-sizing: border-box;\s*min-height: 56px;\s*margin: 0 calc\(-1 \* var\(--ce-voice-body-pad\)\) -10px;\s*padding: 8px var\(--ce-voice-body-pad\);/,
  );
  // Sticky offsets start inside the body's padding, which would show scrolled drafts above the lane.
  expect(cue).toMatch(
    /&:has\(> button\) \{\s*position: sticky;\s*(\/\/[^\n]*\s*)*top: calc\(-1 \* var\(--ce-voice-body-pad\)\);\s*z-index: 3;\s*background: var\(--ce-surface-sunken\);/,
  );
  expect(scss).toMatch(/\.sessionVoiceModeModal \{\s*(\/\/[^\n]*\s*)*--ce-voice-body-pad: 18px;/);
  expect(ruleText(scss, '.sessionVoiceModeModal')).toMatch(
    /:global\(\.modal-body\) \{\s*min-height: 0;\s*padding: var\(--ce-voice-body-pad\);/,
  );
  expect(ruleText(scss, '.sessionVoiceModeModal :global(.modal-body):has(.sessionNewDraftsCue > button)')).toMatch(
    /scroll-padding-top: 64px;/,
  );
});
