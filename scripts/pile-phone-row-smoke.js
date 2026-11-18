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
    return {
      controls,
      arrows: `${arrow('Previous Question')} ${arrow('Next Question')}`,
      cardHeight: Math.round(card.height),
      cardTop: getComputedStyle(row.parentElement).getPropertyValue('--pile-card-top'),
      viewportHeight: window.innerHeight,
      overflowX: document.scrollingElement.scrollWidth - document.documentElement.clientWidth,
      scrollY: window.scrollY,
    };
  });

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
  assert.equal(state.scrollY, 0, `${label} the page should not have scrolled`);
  assert(state.overflowX <= 0, `${label} the page should not be wider than the screen (${state.overflowX}px over)`);
};

async function runTheme(browser, baseUrl, browserName, theme) {
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
        }
      }
    };
    await measureEverySize('unanswered');
    await page.locator(`${ACTIVE_CARD} .form-check-label`).first().click();
    await page.getByRole('button', { name: /^Submit/ }).waitFor();
    // Submit widens into its place; measure once it has.
    await page.waitForTimeout(800);
    await measureEverySize('answered');
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
      const where = (stateName) => `${browserName} ${theme} ${size.name} ${size.width}x${size.height} ${stateName}`;
      const byState = ['unanswered', 'answered', 'end of set'].map((stateName) => [
        stateName,
        states[`${stateName} ${size.name}`],
      ]);
      byState.forEach(([stateName, state]) => assertRow(state, where(stateName)));
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
    for (const theme of THEMES) await runTheme(browser, baseUrl, browserName, theme);
  } finally {
    await browser.close();
  }
  console.log(`Phone question row held in ${browserName}: ${THEMES.length} themes x ${SIZES.length} sizes x 3 states.`);
}

if (require.main === module) {
  runSmoke().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { SIZES, runSmoke };
