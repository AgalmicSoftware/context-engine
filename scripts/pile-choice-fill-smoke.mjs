// On a phone a long choice list fills the room under its prompt and still ends partway through an option, so it
// never looks complete and never leaves a blank band. One synthetic "Pick any" card with a three-line prompt and six
// options, read from browser-local fixtures; nothing is submitted and no Worker is reached.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const shots = process.env.SHOTS || '';
const sessions = JSON.parse(readFileSync(new URL('../client/src/variables/demo/demo_sessions.json', import.meta.url)));
const themeRegistry = JSON.parse(readFileSync(new URL('../client/src/scss/themes/registry.json', import.meta.url)));
const themeDefaultVersion = readFileSync(new URL('../client/public/theme-bootstrap.js', import.meta.url), 'utf8')
  .match(/themeDefaultVersion = '([^']+)'/)[1];
const config = sessions['demo-sh'];
const workerOrigin = new URL(config.corsWorkerUrl).origin;
const SIZES = [
  { width: 360, height: 640 },
  { width: 375, height: 548 },
  { width: 375, height: 667 },
  { width: 390, height: 664 },
  { width: 390, height: 844 },
];
const question = {
  id: `0x${'1'.padStart(64, '0')}`,
  type: 'multichoice',
  prompt: 'Which of these should your city pay for first with new money?',
  options: [
    'Faster replies from city offices',
    'Open data anyone can check',
    'Translation at public meetings',
    'A vote on the yearly budget',
    'Free internet in public places',
    'Training for city staff',
  ],
  tags: [],
  sessionSlug: 'demo-sh',
  sessionId: config.sessionId,
};

const measure = (page) =>
  page.evaluate(() => {
    const card = document.querySelector('[data-testid="ce-pile-active-question"]');
    const area = card.querySelector('[class*="_pileCardMainContent_"]');
    const body = area.parentElement;
    const box = (el) => el.getBoundingClientRect();
    const rows = [...area.querySelectorAll('[class*="_checkboxOptionText_"]')].map(box);
    const title = card.querySelector('[id*="questionTitle"]');
    const shownBelow = [...body.children]
      .slice([...body.children].indexOf(area) + 1)
      .find((el) => box(el).height > 0 && getComputedStyle(el).position !== 'absolute');
    const bodyStyle = getComputedStyle(body);
    // The lowest edge the list could reach: the next part of the card less the gap between parts, or the card's foot.
    const roomBottom = shownBelow
      ? box(shownBelow).top - parseFloat(bodyStyle.rowGap || '0')
      : box(body).bottom - parseFloat(bodyStyle.paddingBottom);
    const areaBottom = box(area).top + area.clientTop + area.clientHeight;
    const cutRow = rows.find((row) => row.top < areaBottom && row.bottom > areaBottom);
    return {
      kind: /Pick any/.test(card.textContent),
      titleLines: Math.round(box(title).height / parseFloat(getComputedStyle(title).lineHeight)),
      options: rows.length,
      overflows: rows[rows.length - 1].bottom > areaBottom + 1,
      blank: roomBottom - areaBottom,
      cutShare: cutRow ? (areaBottom - cutRow.top) / cutRow.height : null,
      gap: rows.length > 1 ? rows[1].top - rows[0].bottom : 0,
      cue: area.dataset.listCue,
      overflowX: document.scrollingElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

const browser = await chromium.launch({ headless: true });
let checked = 0;
let filled = 0;
try {
  for (const theme of themeRegistry.themes.map((entry) => entry.id)) {
    const context = await browser.newContext({ viewport: SIZES[0], hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await context.addInitScript(
      ({ themeId, version }) => {
        localStorage.setItem('ce_onboarding_complete', 'true');
        localStorage.setItem('firstVisit', 'true');
        localStorage.setItem('ce:theme-default-version', version);
        localStorage.setItem('ce:theme', themeId);
      },
      { themeId: theme, version: themeDefaultVersion },
    );
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    // Nothing leaves the local server; the session's Worker reads come from the fixtures below.
    await page.route(
      (url) => url.origin !== new URL(base).origin,
      (route) => route.abort(),
    );
    await page.route(`${workerOrigin}/storage/list?*`, (route) =>
      route.fulfill({
        json: {
          items:
            new URL(route.request().url()).searchParams.get('resource') === 'questions'
              ? [{ storageRef: { backend: 'cloudflare', id: question.id, resource: 'questions' } }]
              : [],
          listComplete: true,
          cursor: null,
        },
      }),
    );
    await page.route(`${workerOrigin}/storage/read?*`, (route) => {
      const found = new URL(route.request().url()).searchParams.get('id') === question.id;
      return route.fulfill({ status: found ? 200 : 404, json: found ? question : {} });
    });
    await page.route('**/session-config?*', (route) =>
      route.fulfill({ json: { ok: true, sessionSlug: 'demo-sh', config } }),
    );
    await page.goto(`${base}/session/demo-sh`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('ce-pile-active-question').waitFor({ timeout: 60000 });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.ceTheme), theme, `${theme} should apply`);
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await page.evaluate(() => window.scrollTo(0, 0));
      // The session title fades out after load and the card grows into its room; measure once both have settled.
      await page.waitForFunction(
        () =>
          document
            .getAnimations()
            .every((animation) => animation.playState !== 'running' || animation.effect.getTiming().iterations === Infinity),
        null,
        { polling: 250, timeout: 20000 },
      );
      await page.waitForTimeout(300);
      const state = await measure(page);
      const where = `${theme} ${size.width}x${size.height}`;
      if (shots) {
        await page.screenshot({ path: path.join(shots, `choice-fill-${theme}-${size.width}x${size.height}.png`) });
      }
      console.log(where, JSON.stringify(state));
      assert(state.kind, `${where}: the card should read "Pick any"`);
      assert.equal(state.options, 6, `${where}: the card should hold six options`);
      assert(state.titleLines >= 3, `${where}: the prompt should take three lines or more (${state.titleLines})`);
      assert(state.overflowX <= 0, `${where}: the page should not be wider than the screen`);
      if (!state.overflows) {
        // A tall phone shows all six: the list is left as it is, with nothing to mark.
        assert.equal(state.cue, 'none', `${where}: a list that fits should mark nothing`);
        assert(Math.abs(state.gap - 8) < 0.5, `${where}: a list that fits should keep its gaps (${state.gap}px)`);
        checked += 1;
        continue;
      }
      assert.equal(state.cue, 'start', `${where}: the list should mark more below`);
      assert(Math.abs(state.blank) <= 2, `${where}: the list should fill its room (${state.blank.toFixed(1)}px left blank)`);
      assert(
        state.cutShare !== null && state.cutShare >= 0.35 && state.cutShare <= 0.75,
        `${where}: the list should end partway through an option (${state.cutShare === null ? 'between two' : state.cutShare.toFixed(2)})`,
      );
      // Scrolled to its end, the list shows its last option whole and marks more above.
      const end = await page.evaluate(() => {
        const card = document.querySelector('[data-testid="ce-pile-active-question"]');
        const area = card.querySelector('[class*="_pileCardMainContent_"]');
        area.scrollTop = area.scrollHeight;
        const rows = area.querySelectorAll('[class*="_checkboxOptionText_"]');
        const lastRow = rows[rows.length - 1].getBoundingClientRect();
        const box = area.getBoundingClientRect();
        return { below: lastRow.bottom - (box.top + area.clientTop + area.clientHeight), scrolled: area.scrollTop };
      });
      assert(end.scrolled > 0 && end.below <= 0.5, `${where}: the last option should show whole at the end (${end.below.toFixed(1)}px cut)`);
      await page.waitForFunction(
        () => document.querySelector('[data-testid="ce-pile-active-question"] [class*="_pileCardMainContent_"]').dataset.listCue === 'end',
      );
      await page.evaluate(() => {
        document.querySelector('[data-testid="ce-pile-active-question"] [class*="_pileCardMainContent_"]').scrollTop = 0;
      });
      checked += 1;
      filled += 1;
    }
    assert.deepEqual(pageErrors, [], `${theme}: the page should raise no errors`);
    await context.close();
  }
} finally {
  await browser.close();
}
// The smaller phones cannot show six options under the prompt; were the card to change so they could, this smoke
// would check nothing.
assert(filled >= 3 * 3, `Only ${filled} theme and size pairs had a list longer than its card`);
console.log(`Phone choice list held in ${checked} theme and size pairs; ${filled} lists longer than their card fill it and end inside an option.`);
