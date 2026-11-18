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
    const rowStyle = getComputedStyle(row);
    const counter = {
      shown: shown(counterBox),
      room: row.clientWidth - parseFloat(rowStyle.paddingLeft) - parseFloat(rowStyle.paddingRight),
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
const SWEEP = { from: 320, to: 430 };
// What a browser without style() container queries (Safari before 18, Firefox) gets: the stylesheet's first,
// unconditional values, in every theme.
const NO_STYLE_QUERY_CSS = (() => {
  const scss = fs.readFileSync(path.join(__dirname, '../client/src/components/SurveyTool/SurveyTool.module.scss'), 'utf8');
  const first = (name) => scss.match(new RegExp(`${name}: ([^;]+);`))[1];
  return `[class*="_pileControls_"] { --pile-submit-digits: ${first('--pile-submit-digits')} !important; --pile-submit-chars: ${first('--pile-submit-chars')} !important; --pile-row-arrows: ${first('--pile-row-arrows')} !important; }`;
})();

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
    first.textContent = was[0];
    last.textContent = was[1];
    counterBox.style.setProperty('--pile-counter-digits', was[2]);
    return { spare, lines };
  }, digits);

const assertRow = (state, where, { width, wideFont }) => {
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
  // stacked, then gone. In the site's own fonts that leaves it off the narrowest phones, on from 375px, and on one
  // line on a large phone; in a wide font it may give way sooner, and Submit's word (checked above) still shows whole.
  if (!wideFont) {
    if (width <= 320) assert.equal(counter.shown, false, `${label} the counter should leave the row to Submit`);
    if (width >= 375) assert.equal(counter.shown, true, `${label} the counter should show`);
    if (width >= 430) assert.equal(counter.lines, 1, `${label} the counter should take one line`);
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

// A second pass in a font wider than the site's own: a runner's fallback font, a person's larger text setting or a
// longer word all take more of the row, and Submit's word must still show whole. Verdana where it is installed,
// DejaVu Sans on a Linux runner; both are among the widest common faces.
const WIDE_FONT_CSS = `* { font-family: Verdana, 'DejaVu Sans', sans-serif !important; }`;

async function runTheme(browser, baseUrl, browserName, theme, wideFont = false, noStyleQueries = false) {
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
  if (wideFont || noStyleQueries) {
    await context.addInitScript((css) => {
      const add = () => document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
      if (document.head) add();
      else document.addEventListener('DOMContentLoaded', add, { once: true });
    }, `${wideFont ? WIDE_FONT_CSS : ''} ${noStyleQueries ? NO_STYLE_QUERY_CSS : ''}`);
  }
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // The navigation smoke's fixtures answer the chain and Worker reads; every other host is refused.
  await installLocalSmokeFixtureRoutes(page, baseUrl, ROUTE);
  await installDemoWorkerFixtureRoutes(page, baseUrl, ROUTE);
  try {
    await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(ACTIVE_CARD, { timeout: 60000 });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.ceTheme), theme, `${theme} should apply`);
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
    for (const digits of [2, 3]) {
      for (let width = SWEEP.from; width <= SWEEP.to; width += 1) {
        await page.setViewportSize({ width, height: 700 });
        await page.waitForTimeout(40);
        const { spare, lines } = await measureSpare(page, digits);
        if (!tightest[digits] || spare < tightest[digits].spare) tightest[digits] = { spare, width, lines };
      }
    }
    const spareNote = [2, 3]
      .map((digits) => `${digits} digits ${tightest[digits].spare.toFixed(1)}px at ${tightest[digits].width}px (count ${['gone', 'on one line', 'stacked'][tightest[digits].lines]})`)
      .join('; ');
    console.log(`  ${theme}${wideFont ? ' (wide font)' : ''}${noStyleQueries ? ' (no style queries)' : ''}: Submit's least spare room, ${SWEEP.from} to ${SWEEP.to}px: ${spareNote}`);
    for (const digits of [2, 3]) {
      // In a wide font the word may sit closer to its edges, but it is never cut.
      assert(
        tightest[digits].spare >= (wideFont ? 0 : MIN_SPARE),
        `${browserName} ${theme}${wideFont ? ' (wide font)' : ''}: Submit's word should keep ${wideFont ? 0 : MIN_SPARE}px to spare at every width (${spareNote})`,
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
      const where = (stateName) =>
        `${browserName} ${theme}${wideFont ? ' (wide font)' : ''}${noStyleQueries ? ' (no style queries)' : ''} ${size.name} ${size.width}x${size.height} ${stateName}`;
      const byState = ['unanswered', 'answered', 'end of set'].map((stateName) => [
        stateName,
        states[`${stateName} ${size.name}`],
      ]);
      byState.forEach(([stateName, state]) =>
        // Without style queries the counter may give way sooner than each theme's own numbers would have it.
        assertRow(state, where(stateName), { width: size.width, wideFont: wideFont || noStyleQueries }),
      );
      const menu = states[`menu ${size.name}`];
      assert(
        menu.height > 0 && menu.top >= 0 && menu.bottom <= menu.viewportHeight,
        `${where('menu')}: the actions menu should open on screen (${Math.round(menu.top)} to ${Math.round(menu.bottom)})`,
      );
      const answered = states[`answered ${size.name}`];
      assert(
        answered.controls.some((control) => /^Submit/.test(control.name)),
        `${where('answered')}: Submit should show in the row`,
      );
      assert(
        !states[`end of set ${size.name}`].controls.some((control) => /^Submit/.test(control.name)),
        `${where('end of set')}: the end-of-set card's Submit should be the only one`,
      );
      for (const [stateName, state] of byState.slice(1)) {
        assert.equal(state.arrows, byState[0][1].arrows, `${where(stateName)}: the arrows should not move`);
        assert.equal(state.cardHeight, byState[0][1].cardHeight, `${where(stateName)}: the card should keep its height (top ${state.cardTop} vs ${byState[0][1].cardTop})`);
      }
    }
    assert.deepEqual(pageErrors, [], `${browserName} ${theme}: the page should raise no errors`);
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
  try {
    for (const [wideFont, noStyleQueries] of [
      [false, false],
      [true, false],
      [false, true],
    ]) {
      for (const theme of THEMES) await runTheme(browser, baseUrl, browserName, theme, wideFont, noStyleQueries);
    }
  } finally {
    await browser.close();
  }
  console.log(
    `Phone question row held in ${browserName}: ${THEMES.length} themes x ${SIZES.length} sizes x 3 states, in the site's fonts, a wide one, and without style queries; every width from ${SWEEP.from} to ${SWEEP.to}px.`,
  );
}

if (require.main === module) {
  runSmoke().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { SIZES, runSmoke };
