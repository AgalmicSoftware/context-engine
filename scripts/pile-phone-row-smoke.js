'use strict';

// On a phone the question pile's controls (actions, Submit, arrows) stay in one row under the card, in view without
// scrolling, with the arrows in one place on an unanswered card, an answered one and the end of the set. Runs on the
// local demo session with chain and Worker reads answered by fixtures, in each theme and at small phone sizes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  installDemoWorkerFixtureRoutes,
  installLocalSmokeFixtureRoutes,
  isLocalSmokeBaseUrl,
  normalizeBaseUrl,
} = require('./vite-navigation-smoke');
const themeRegistry = require('../client/src/scss/themes/registry.json');

const SIZES = Object.freeze([
  { name: 'iPhone SE (1st generation)', width: 320, height: 568 },
  { name: 'small Android', width: 360, height: 640 },
  { name: 'iPhone SE, toolbars shown', width: 375, height: 548 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 13, toolbars shown', width: 390, height: 664 },
  { name: 'iPhone 13', width: 390, height: 844 },
  { name: 'Pixel', width: 412, height: 915 },
  { name: 'large phone', width: 430, height: 740 },
]);
const THEMES = themeRegistry.themes.map((theme) => theme.id);
const THEME_DEFAULT_VERSION = fs
  .readFileSync(path.join(__dirname, '../client/public/theme-bootstrap.js'), 'utf8')
  .match(/themeDefaultVersion = '([^']+)'/)[1];
const ROUTE = '/session/demo';
const ACTIVE_CARD = '[data-testid="ce-pile-active-question"]';

// What the stylesheet works from, read back in the font this machine draws: how much room the row has left for
// the counter on one line and for its numbers stacked (px; below zero where that form does not fit), and the
// width of a digit. Installed in the page so every measurement shares it.
const installRoomProbe = (context) =>
  context.addInitScript(() => {
    window.__pileRowRoom = (row) => {
      const counterBox = row.querySelector('[class*="_pileNavCounterText_"]');
      const rowStyle = getComputedStyle(row);
      const number = (name) => parseFloat(rowStyle.getPropertyValue(name));
      const probe = Object.assign(document.createElement('span'), { ariaHidden: 'true' });
      probe.style.cssText = 'position:absolute;visibility:hidden;width:1ch;height:1px;padding:0;border:0';
      counterBox.append(probe);
      const ch = probe.getBoundingClientRect().width;
      probe.remove();
      const digits = parseFloat(getComputedStyle(counterBox).getPropertyValue('--pile-counter-digits')) || 2;
      const width = row.clientWidth - parseFloat(rowStyle.paddingLeft) - parseFloat(rowStyle.paddingRight);
      const word = Math.max(number('--pile-submit-digits') * ch, number('--pile-submit-floor'));
      const rest = number('--pile-row-fixed') + number('--pile-row-arrows') + word + 8;
      return { line: width - rest - (digits * 2 * ch + 2 * ch), stack: width - rest - (digits * ch + 4), ch };
    };
  });

const measureRow = (page) =>
  page.evaluate(() => {
    const row = document.querySelector('[class*="_pileControls_"]');
    const shown = (el) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    // Text a control's clipping boxes cut through, rather than show whole or hide whole (a wrapped-away Submit count).
    const cutText = (button) => {
      const cut = [];
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.textContent.trim()) continue;
        // A box clips at its padding edge, inside its border.
        const buttonBox = button.getBoundingClientRect();
        let clip = new DOMRect(
          buttonBox.left + button.clientLeft,
          buttonBox.top + button.clientTop,
          button.clientWidth,
          button.clientHeight,
        );
        for (let el = text.parentElement; el && el !== button; el = el.parentElement) {
          if (getComputedStyle(el).overflow === 'visible') continue;
          const box = el.getBoundingClientRect();
          clip = new DOMRect(
            Math.max(clip.left, box.left),
            Math.max(clip.top, box.top),
            Math.min(clip.right, box.right) - Math.max(clip.left, box.left),
            Math.min(clip.bottom, box.bottom) - Math.max(clip.top, box.top),
          );
        }
        const range = document.createRange();
        range.selectNodeContents(text);
        const box = range.getBoundingClientRect();
        // A glyph box is taller than its line, so a line counts as shown when its middle is; shown text is cut when
        // either side runs past the clip.
        const middle = (box.top + box.bottom) / 2;
        const outside = middle <= clip.top || middle >= clip.bottom || box.right <= clip.left || box.left >= clip.right;
        const inside = !outside && box.left >= clip.left - 0.5 && box.right <= clip.right + 0.5;
        if (!inside && !outside) cut.push(text.textContent.trim());
        if (outside && text === button.querySelector('[class*="_pileSubmitButtonLabel_"]')?.firstChild) {
          cut.push(`${text.textContent.trim()} (hidden)`);
        }
      }
      return cut.join(', ');
    };
    // Submit's count: its digits, whether they show whole inside the button and clear of the word, and whether
    // the brackets round them are drawn.
    const submitCount = (button) => {
      const count = button.querySelector('[class*="_pileSubmitButtonCount_"]');
      const label = button.querySelector('[class*="_pileSubmitButtonLabel_"]');
      if (!count || !label) return null;
      const textBox = (node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getBoundingClientRect();
      };
      const digits = [...count.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
      const box = textBox(digits);
      const word = textBox(label.firstChild);
      const edge = button.getBoundingClientRect();
      return {
        digits: digits.textContent,
        shown:
          box.width > 0 &&
          box.left >= edge.left + button.clientLeft &&
          box.right <= edge.right - button.clientLeft &&
          box.top >= edge.top + button.clientTop &&
          box.bottom <= edge.bottom - button.clientTop,
        // A glyph box is taller than its letters; the count is clear when it ends above the word's small letters,
        // or sits past the word's end (give or take a pixel of side bearing).
        overWord: box.right > word.left + 1 && box.left < word.right - 1 && box.bottom > word.top + word.height * 0.3,
        at: `count ${box.left.toFixed(1)},${box.top.toFixed(1)} to ${box.right.toFixed(1)},${box.bottom.toFixed(1)}; word ${word.left.toFixed(1)},${word.top.toFixed(1)} to ${word.right.toFixed(1)},${word.bottom.toFixed(1)}`,
        brackets: [...count.querySelectorAll('span')].some((bracket) => getComputedStyle(bracket).display !== 'none'),
      };
    };
    const controls = [...row.querySelectorAll('button')]
      .filter((button) => !button.closest('[class*="_pileActionButtonGroup_"]') && shown(button))
      .map((button) => {
        const box = button.getBoundingClientRect();
        return {
          name: button.getAttribute('aria-label') || button.textContent.trim(),
          top: box.top,
          bottom: box.bottom,
          left: box.left,
          right: box.right,
          height: box.height,
          // The Submit count may wrap out of sight; the word must show whole.
          clipped: cutText(button),
          count: submitCount(button),
        };
      });
    const card = document.querySelector('[class*="_pileCardContainer_"]').getBoundingClientRect();
    const arrow = (name) => {
      const box = document.querySelector(`button[aria-label="${name}"]`).getBoundingClientRect();
      return `${Math.round(box.left)},${Math.round(box.top)}`;
    };
    // The counter sits between the arrows: its numbers on one line or stacked, and clear of either arrow's focus ring.
    const counterBox = row.querySelector('[class*="_pileNavCounterText_"]');
    const box = (el) => el.getBoundingClientRect();
    const numbers = [counterBox.firstElementChild, counterBox.lastElementChild].map(box);
    const text = document.createRange();
    text.selectNodeContents(counterBox);
    const counter = {
      shown: shown(counterBox),
      room: window.__pileRowRoom(row),
      left: box(counterBox).left,
      right: box(counterBox).right,
      middle: (box(counterBox).top + box(counterBox).bottom) / 2,
      textLeft: text.getBoundingClientRect().left,
      textRight: text.getBoundingClientRect().right,
      lines: Math.abs(numbers[0].top - numbers[1].top) < 2 ? 1 : 2,
      slash: box(counterBox.children[1]).width,
      // The same with the shortest count there is, which must not run together where a longer one stacks.
      shortLines: (() => {
        const [first, last] = [counterBox.firstElementChild, counterBox.lastElementChild];
        const [was, wasLast] = [first.textContent, last.textContent];
        first.textContent = '1';
        last.textContent = '11';
        const lines = Math.abs(box(first).top - box(last).top) < 2 ? 1 : 2;
        first.textContent = was;
        last.textContent = wasLast;
        return lines;
      })(),
      opacity: getComputedStyle(counterBox).opacity,
      previousRight: box(document.querySelector('button[aria-label="Previous Question"]')).right,
      nextLeft: box(document.querySelector('button[aria-label="Next Question"]')).left,
      arrowMiddle: (box(document.querySelector('button[aria-label="Next Question"]')).top + box(document.querySelector('button[aria-label="Next Question"]')).bottom) / 2,
    };
    return {
      controls,
      counter,
      arrows: `${arrow('Previous Question')} ${arrow('Next Question')}`,
      cardHeight: Math.round(card.height),
      cardTop: getComputedStyle(row.parentElement).getPropertyValue('--pile-card-top'),
      viewportHeight: window.innerHeight,
      overflowX: document.scrollingElement.scrollWidth - document.documentElement.clientWidth,
      scrollY: window.scrollY,
    };
  });

// Submit's word must keep room to spare at every width, not only the sampled sizes: the tightest rows sit just
// past each point where the counter changes form. 3px is the least accepted: a release failed on a runner that
// drew the same font a little wider than the machine it was tuned on, with 1.4px to spare. The tightest row
// measures 6.7px on that machine, so another platform may draw the word up to 3.7px wider before this fails.
const MIN_SPARE = 3;
// To 440px: the row's gaps widen past 430px, and the rows just after a change are the tightest.
const SWEEP = { from: 320, to: 440 };
// What a browser without style() container queries (Safari before 18, Firefox) gets: the stylesheet's first,
// unconditional values, in every theme.
const NO_STYLE_QUERY_CSS = (() => {
  const scss = fs.readFileSync(path.join(__dirname, '../client/src/components/SurveyTool/SurveyTool.module.scss'), 'utf8');
  const first = (name) => scss.match(new RegExp(`${name}: ([^;]+);`))[1];
  return `[class*="_pileControls_"] { --pile-submit-digits: ${first('--pile-submit-digits')} !important; --pile-submit-chars: ${first('--pile-submit-chars')} !important; --pile-row-arrows: ${first('--pile-row-arrows')} !important; --pile-submit-floor: ${first('--pile-submit-floor')} !important; }`;
})();

// The faces the row is drawn in on this machine, and how wide they come out.
const describeFonts = (page) =>
  page.evaluate(() => {
    const row = document.querySelector('[class*="_pileControls_"]');
    const counterBox = row.querySelector('[class*="_pileNavCounterText_"]');
    const label = row.querySelector('[class*="_pileSubmitButtonLabel_"]');
    const word = document.createRange();
    word.selectNodeContents(label.firstChild);
    const face = (el) => {
      const style = getComputedStyle(el);
      const first = style.fontFamily.split(',')[0].trim();
      const loaded = document.fonts.check(`${style.fontWeight} ${style.fontSize} ${first}`);
      return `${first} ${style.fontWeight} ${style.fontSize}${loaded ? '' : ' (not loaded; a fallback draws it)'}`;
    };
    return `counter ${face(counterBox)}, a digit ${window.__pileRowRoom(row).ch.toFixed(2)}px; Submit ${face(label)}, its word ${word.getBoundingClientRect().width.toFixed(1)}px at ${window.innerWidth}px`;
  });

const measureSpare = (page, digits) =>
  page.evaluate((digitCount) => {
    const row = document.querySelector('[class*="_pileControls_"]');
    const counterBox = row.querySelector('[class*="_pileNavCounterText_"]');
    const [first, last] = [counterBox.firstElementChild, counterBox.lastElementChild];
    const was = [first.textContent, last.textContent, counterBox.style.getPropertyValue('--pile-counter-digits')];
    const count = '1'.padEnd(digitCount, '0');
    first.textContent = count;
    last.textContent = count;
    counterBox.style.setProperty('--pile-counter-digits', String(digitCount));
    const button = [...row.querySelectorAll('button')].find((el) => /^Submit/.test(el.getAttribute('aria-label') || el.textContent.trim()));
    const label = button.querySelector('[class*="_pileSubmitButtonLabel_"]');
    const word = document.createRange();
    word.selectNodeContents(label.firstChild);
    const spare = button.clientWidth - word.getBoundingClientRect().width;
    const lines = counterBox.getBoundingClientRect().width < 1 ? 0 : Math.abs(first.getBoundingClientRect().top - last.getBoundingClientRect().top) < 2 ? 1 : 2;
    const room = window.__pileRowRoom(row);
    first.textContent = was[0];
    last.textContent = was[1];
    counterBox.style.setProperty('--pile-counter-digits', was[2]);
    return { spare, lines, room };
  }, digits);

// The form the row's room calls for, or null within EDGE px of a change, where either may show.
const EDGE = 4;
const FORMS = ['gone', 'on one line', 'stacked'];
const formByRoom = ({ line, stack, ch }) => {
  // A reading that is not a number would skip every form check unseen.
  assert(Number.isFinite(line) && Number.isFinite(stack) && ch > 0, `the row's room could not be read (${line}, ${stack}, ${ch})`);
  if (line >= EDGE) return 1;
  if (stack <= -EDGE) return 0;
  if (line <= -EDGE && stack >= EDGE) return 2;
  return null;
};

const assertRow = (state, where) => {
  const label = `${where}:`;
  const names = state.controls.map((control) => control.name);
  for (const required of ['Question actions', 'Previous Question', 'Next Question']) {
    assert(names.includes(required), `${label} ${required} should show; saw ${names.join(', ')}`);
  }
  const middle = (control) => (control.top + control.bottom) / 2;
  const first = middle(state.controls[0]);
  for (const control of state.controls) {
    assert(Math.abs(middle(control) - first) <= 4, `${label} ${control.name} should share the controls' row`);
    assert(control.height >= 44, `${label} ${control.name} should be at least 44px tall; is ${control.height}`);
    assert(!control.clipped, `${label} ${control.name} should show its whole label (${control.clipped})`);
    assert(control.bottom <= state.viewportHeight, `${label} ${control.name} should show without scrolling`);
  }
  for (const [left, right] of state.controls.slice(1).map((control, i) => [state.controls[i], control])) {
    assert(right.left >= left.right - 0.5, `${label} ${left.name} and ${right.name} should not overlap`);
  }
  const { counter } = state;
  // The counter gives way to Submit's word by the room the row has in the font in use: one line, then its numbers
  // stacked, then gone. Which widths that falls on is the font's to decide, and a runner draws fonts its own way,
  // so the form is checked against the room measured here, and only where that room is clear either way.
  const form = counter.shown ? counter.lines : 0;
  const wanted = formByRoom(counter.room);
  if (wanted !== null) {
    assert.equal(
      form,
      wanted,
      `${label} the counter should be ${FORMS[wanted]} with ${counter.room.line.toFixed(1)}px for one line and ${counter.room.stack.toFixed(1)}px for a stack; it is ${FORMS[form]}`,
    );
  }
  if (counter.shown) {
    assert(
      counter.left >= counter.previousRight - 0.5 && counter.right <= counter.nextLeft + 0.5,
      `${label} the counter should sit between the arrows`,
    );
    assert(Math.abs(counter.middle - counter.arrowMiddle) <= 4, `${label} the counter should share the arrows' line`);
    assert.equal(counter.opacity, '1', `${label} the counter should show whole`);
    assert(counter.ring > 0, `${label} an arrow should draw a focus ring from the keyboard (${counter.ring})`);
    assert(
      counter.textLeft >= counter.previousRight + counter.ring - 0.5 && counter.textRight <= counter.nextLeft - counter.ring + 0.5,
      `${label} an arrow's focus ring should not cover the counter`,
    );
    // One line with its slash, or one number over the other, whatever the count: never two numbers run together.
    assert(counter.lines === 2 || counter.slash > 1, `${label} the counter's one line should show its slash`);
    assert.equal(counter.shortLines, counter.lines, `${label} a short count should take the same form`);
    // Whole in either form: both numbers inside its box.
    assert(
      counter.textLeft >= counter.left - 0.5 && counter.textRight <= counter.right + 0.5,
      `${label} the counter's numbers should show whole`,
    );
  }
  assert.equal(state.scrollY, 0, `${label} the page should not have scrolled`);
  assert(state.overflowX <= 0, `${label} the page should not be wider than the screen (${state.overflowX}px over)`);
};

// Further passes, each a way a machine may differ from the one the row was tuned on. Submit's word must show
// whole in all of them, and the counter's form must follow the room measured in that pass.
// - A font wider than the site's own (a fallback font, larger text, a longer word): Verdana where it is installed,
//   DejaVu Sans on a Linux runner, both among the widest common faces.
// - No style() container queries (Safari before 18, Firefox): the stylesheet's first, unconditional values.
// - Another machine's drawing: the site's fonts missing, so the system's stand in, with every letter set a little
//   wider than its font says. A hosted runner drew Submit's word 0.5px wider than the machine this was tuned on;
//   this adds 0.25px a letter, three times that.
const PASSES = Object.freeze([
  { name: '', minSpare: MIN_SPARE },
  { name: ' (wide font)', minSpare: 0, css: `* { font-family: Verdana, 'DejaVu Sans', sans-serif !important; }` },
  { name: ' (no style queries)', minSpare: MIN_SPARE, css: NO_STYLE_QUERY_CSS },
  { name: ' (system fonts, wider letters)', minSpare: 0, css: `* { letter-spacing: 0.25px !important; }`, noWebFonts: true },
]);

async function runTheme(browser, baseUrl, browserName, theme, pass, failures) {
  const named = `${browserName} ${theme}${pass.name}`;
  // Every failing cell is kept and reported at the end, so one run shows all there is to fix.
  const check = (run) => {
    try {
      run();
    } catch (error) {
      failures.push(error.message);
    }
  };
  const context = await browser.newContext({
    viewport: SIZES[0],
    hasTouch: true,
    ...(browserName === 'chromium' ? { isMobile: true } : {}),
  });
  await context.addInitScript(
    ({ themeId, version }) => {
      localStorage.setItem('ce_onboarding_complete', 'true');
      localStorage.setItem('firstVisit', 'true');
      // The bootstrap clears a chosen theme stored under an older default version.
      localStorage.setItem('ce:theme-default-version', version);
      localStorage.setItem('ce:theme', themeId);
    },
    { themeId: theme, version: THEME_DEFAULT_VERSION },
  );
  await installRoomProbe(context);
  if (pass.css) {
    await context.addInitScript((css) => {
      const add = () => document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
      if (document.head) add();
      else document.addEventListener('DOMContentLoaded', add, { once: true });
    }, pass.css);
  }
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // The navigation smoke's fixtures answer the chain and Worker reads; every other host is refused.
  await installLocalSmokeFixtureRoutes(page, baseUrl, ROUTE);
  await installDemoWorkerFixtureRoutes(page, baseUrl, ROUTE);
  // The newest route answers first, so this one comes after the fixtures'.
  if (pass.noWebFonts) await page.route(/\.(woff2?|ttf|otf)(\?.*)?$/, (route) => route.abort());
  try {
    await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(ACTIVE_CARD, { timeout: 60000 });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.ceTheme), theme, `${theme} should apply`);
    await page.evaluate(() => document.fonts.ready);
    // The session title fades out a few seconds after load, and the card grows into its room; measure after that.
    await page.waitForFunction(
      () =>
        document
          .getAnimations()
          .every((animation) => animation.playState !== 'running' || animation.effect.getTiming().iterations === Infinity),
      null,
      { polling: 250, timeout: 20000 },
    );
    // A single-choice card stays after an answer, so Submit, Clear and a filled Next all show beside the arrows.
    await page.waitForFunction(
      (selector) => {
        const card = document.querySelector(selector);
        if (/Pick one/.test(card?.textContent || '')) return true;
        document.querySelector('button[aria-label="Next Question"]')?.click();
        return false;
      },
      ACTIVE_CARD,
      { polling: 150, timeout: 30000 },
    );
    const states = {};
    const measureEverySize = async (stateName) => {
      for (const size of SIZES) {
        await page.setViewportSize(size);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(150);
        states[`${stateName} ${size.name}`] = await measureRow(page);
        // An arrow's focus ring, as the keyboard draws it, must stay clear of the counter (both arrows share it; Next
        // is disabled at the end of the set).
        await page.keyboard.press('Shift');
        await page.focus('button[aria-label="Previous Question"]');
        states[`${stateName} ${size.name}`].counter.ring = await page.evaluate(() => {
          const focused = document.activeElement;
          if (focused?.getAttribute('aria-label') !== 'Previous Question' || !focused.matches(':focus-visible')) return NaN;
          const style = getComputedStyle(focused);
          return parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
        });
        await page.evaluate(() => document.activeElement.blur());
        if (stateName === 'unanswered') {
          // The row sits at the foot of the screen, so its actions menu must open where it can be seen.
          await page.getByRole('button', { name: 'Question actions' }).click();
          const placed = await page.waitForFunction(() => {
            const panel = document.querySelector('[role="dialog"][aria-label="Question actions"]');
            if (!panel || getComputedStyle(panel).visibility !== 'visible') return null;
            const box = panel.getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, height: box.height, viewportHeight: window.innerHeight };
          });
          states[`menu ${size.name}`] = await placed.jsonValue();
          await page.keyboard.press('Escape');
          await page.getByRole('dialog', { name: 'Question actions' }).waitFor({ state: 'detached' });
          // The pointer rests where it clicked. Off the row, so the next size measures no hovered button, and so
          // the next click starts from elsewhere: a click on a button the mouse already rests on, after a resize,
          // moves the page in Chromium, and the menu closes on any scroll. On a slow runner that closed it before
          // this step could see it. A tap, as on a phone, never does this.
          await page.mouse.move(0, 0);
        }
      }
    };
    await measureEverySize('unanswered');
    await page.locator(`${ACTIVE_CARD} .form-check-label`).first().click();
    await page.getByRole('button', { name: /^Submit/ }).waitFor();
    // Submit widens into its place; measure once it has.
    await page.waitForTimeout(800);
    await measureEverySize('answered');
    // Every width a phone has, for a two-digit and a three-digit count.
    const tightest = {};
    const forms = {};
    for (const digits of [2, 3]) {
      forms[digits] = [];
      for (let width = SWEEP.from; width <= SWEEP.to; width += 1) {
        await page.setViewportSize({ width, height: 700 });
        await page.waitForTimeout(40);
        const { spare, lines, room } = await measureSpare(page, digits);
        if (!tightest[digits] || spare < tightest[digits].spare) tightest[digits] = { spare, width, lines };
        forms[digits].push({ width, lines, room });
        check(() => {
          const wanted = formByRoom(room);
          assert(
            wanted === null || wanted === lines,
            `${named} ${width}px, ${digits} digits: the counter should be ${FORMS[wanted]} with ${room.line.toFixed(1)}px for one line and ${room.stack.toFixed(1)}px for a stack; it is ${FORMS[lines]}`,
          );
        });
      }
    }
    const spareNote = [2, 3]
      .map((digits) => `${digits} digits ${tightest[digits].spare.toFixed(1)}px at ${tightest[digits].width}px (count ${FORMS[tightest[digits].lines]})`)
      .join('; ');
    console.log(`  ${theme}${pass.name}: Submit's least spare room, ${SWEEP.from} to ${SWEEP.to}px: ${spareNote}`);
    try {
      // Where each form starts and ends on this machine, and what it measured them in: the first thing to read
      // when a run differs from another machine's.
      for (const digits of [2, 3]) {
        const runs = [];
        for (const at of forms[digits]) {
          const last = runs[runs.length - 1];
          if (last && last.lines === at.lines) last.to = at.width;
          else runs.push({ lines: at.lines, from: at.width, to: at.width });
        }
        const lineRoom = [412, 430]
          .map((width) => `${forms[digits].find((at) => at.width === width).room.line.toFixed(1)}px at ${width}px`)
          .join(', ');
        console.log(
          `    ${digits} digits: ${runs.map((run) => `${FORMS[run.lines]} ${run.from} to ${run.to}px`).join(', ')}; one line's room ${lineRoom}`,
        );
      }
      console.log(`    drawn in: ${await describeFonts(page)}`);
    } catch (error) {
      console.log(`    (this machine's forms and fonts could not be printed: ${error.message})`);
    }
    for (const digits of [2, 3]) {
      // In another font the word may sit closer to its edges, but it is never cut.
      check(() =>
        assert(
          tightest[digits].spare >= pass.minSpare,
          `${named}, ${digits} digits: Submit's word should keep ${pass.minSpare}px to spare at every width (${spareNote})`,
        ),
      );
    }
    await page.waitForFunction(
      () => {
        const next = document.querySelector('button[aria-label="Next Question"]');
        if (next.disabled) return true;
        next.click();
        return false;
      },
      null,
      { polling: 100, timeout: 60000 },
    );
    await page.waitForTimeout(500);
    await measureEverySize('end of set');

    for (const size of SIZES) {
      const where = (stateName) => `${named} ${size.name} ${size.width}x${size.height} ${stateName}`;
      const byState = ['unanswered', 'answered', 'end of set'].map((stateName) => [
        stateName,
        states[`${stateName} ${size.name}`],
      ]);
      byState.forEach(([stateName, state]) => check(() => assertRow(state, where(stateName))));
      const menu = states[`menu ${size.name}`];
      check(() =>
        assert(
          menu.height > 0 && menu.top >= 0 && menu.bottom <= menu.viewportHeight,
          `${where('menu')}: the actions menu should open on screen (${Math.round(menu.top)} to ${Math.round(menu.bottom)})`,
        ),
      );
      const answered = states[`answered ${size.name}`];
      check(() =>
        assert(
          answered.controls.some((control) => /^Submit/.test(control.name)),
          `${where('answered')}: Submit should show in the row`,
        ),
      );
      // The count always shows: small, without its brackets, in the button's corner and clear of the word.
      const submitCount = answered.controls.find((control) => /^Submit/.test(control.name))?.count;
      check(() => assert(submitCount, `${where('answered')}: Submit should carry its count`));
      if (submitCount) {
        check(() =>
          assert(
            /^\d+$/.test(submitCount.digits) && !submitCount.brackets,
            `${where('answered')}: Submit's count should show as digits without brackets (${submitCount.digits})`,
          ),
        );
        check(() =>
          assert(
            submitCount.shown && !submitCount.overWord,
            `${where('answered')}: Submit should show its count (${submitCount.digits}) whole and clear of its word (${submitCount.at})`,
          ),
        );
      }
      check(() =>
        assert(
          !states[`end of set ${size.name}`].controls.some((control) => /^Submit/.test(control.name)),
          `${where('end of set')}: the end-of-set card's Submit should be the only one`,
        ),
      );
      for (const [stateName, state] of byState.slice(1)) {
        check(() => assert.equal(state.arrows, byState[0][1].arrows, `${where(stateName)}: the arrows should not move`));
        check(() =>
          assert.equal(
            state.cardHeight,
            byState[0][1].cardHeight,
            `${where(stateName)}: the card should keep its height (top ${state.cardTop} vs ${byState[0][1].cardTop})`,
          ),
        );
      }
    }
    check(() => assert.deepEqual(pageErrors, [], `${named}: the page should raise no errors`));
  } catch (error) {
    // A step that could not run at all (a card that never came, a menu that never opened) is one more failure.
    failures.push(`${named}: ${error.message.split('\n')[0]}${pageErrors.length ? ` (page errors: ${pageErrors.join('; ')})` : ''}`);
  } finally {
    await context.close();
  }
}

async function runSmoke() {
  const baseUrl = normalizeBaseUrl(process.env.BASE_URL || 'http://127.0.0.1:3000');
  // Its fixtures are what keep it off live chains and Workers.
  if (!isLocalSmokeBaseUrl(baseUrl)) throw new Error(`Run the phone row smoke against a local build, not ${baseUrl}`);
  const browserName = process.env.PLAYWRIGHT_BROWSER || 'chromium';
  const { [browserName]: browserType } = require('playwright');
  if (!browserType) throw new Error(`Unsupported PLAYWRIGHT_BROWSER "${browserName}"`);
  const browser = await browserType.launch({ headless: true });
  const failures = [];
  try {
    for (const pass of PASSES) {
      for (const theme of THEMES) await runTheme(browser, baseUrl, browserName, theme, pass, failures);
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    throw new Error(`The phone question row failed ${failures.length} check(s) in ${browserName}:\n- ${failures.join('\n- ')}`);
  }
  console.log(
    `Phone question row held in ${browserName}: ${THEMES.length} themes x ${SIZES.length} sizes x 3 states, in the site's fonts, a wide one, without style queries, and in system fonts with wider letters; every width from ${SWEEP.from} to ${SWEEP.to}px.`,
  );
}

if (require.main === module) {
  runSmoke().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { SIZES, runSmoke };
