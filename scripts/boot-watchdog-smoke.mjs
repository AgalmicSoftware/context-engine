// A page whose app never appears must say so, with a way to reload, rather than stay blank; and a page that does
// load, however slowly, must never show that message. Runs against a built client: nothing but the local server is
// reached.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const base = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a local built client');
const engines = { chromium, webkit };
const engineNames = (process.env.SMOKE_ENGINES || 'chromium,webkit').split(',').filter(Boolean);
// The wait the watchdog gives a page after its load event (client/public/boot-watchdog.js).
const WAIT_MS = 12000;
// And the longer wait it gives once the app's first script has run.
const LONG_WAIT_MS = 45000;
const PAGE = '/about';
const notice = (page) => page.locator('#ce-boot-notice');
// Drawn means something in the root besides what the app puts there before drawing (its empty toast host and its
// loading line carry data-ce-boot-ignore).
const drawn = () => [...document.getElementById('root').children].some((el) => !el.hasAttribute('data-ce-boot-ignore'));
const appShown = (page) => page.evaluate(drawn);
const waitForApp = (page, timeout) => page.waitForFunction(drawn, null, { timeout });
const isEntry = (url) => /\/assets\/index-[^/]+\.js$/.test(url.pathname);
const isAppScript = (url) => /\/assets\/[^/]+\.js$/.test(url.pathname) && !isEntry(url);
const isMainPart = (url) => /\/assets\/AppShell-[^/]+\.js$/.test(url.pathname);

const open = async (browser, { colorScheme = 'light', routes = async () => {} } = {}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 664 }, colorScheme });
  const page = await context.newPage();
  await page.route(
    (url) => url.origin !== new URL(base).origin,
    (route) => route.abort(),
  );
  await routes(page);
  return { context, page };
};

const assertNotice = async (page, label) => {
  await notice(page).waitFor({ timeout: WAIT_MS + 8000 });
  assert.equal(await notice(page).getAttribute('role'), 'alert', `${label}: the message is announced`);
  assert.match(await notice(page).innerText(), /This page did not load\./, `${label}: the message says what happened`);
  const button = notice(page).getByRole('button', { name: 'Reload', exact: true });
  const box = await button.boundingBox();
  assert(box.height >= 44, `${label}: Reload is at least 44px tall (${box.height})`);
  // Readable whatever the theme: its text against its own background, 4.5:1 or better.
  const ratio = await notice(page).evaluate((el) => {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color) => {
      const [r, g, b] = color.match(/\d+(\.\d+)?/g).map(Number);
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const style = getComputedStyle(el);
    const [a, b] = [luminance(style.color), luminance(style.backgroundColor)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
  assert(ratio >= 4.5, `${label}: the message is readable (${ratio.toFixed(1)}:1)`);
  assert.equal(await appShown(page), false, `${label}: nothing else was drawn`);
  return button;
};

for (const name of engineNames) {
  const browser = await engines[name].launch({ headless: true });
  try {
    // 1. The app's first script is blocked (a content blocker, a filtered network): the message comes at once, in
    // light and dark, and Reload brings the page back once the script can load.
    for (const colorScheme of ['light', 'dark']) {
      let blocked = true;
      const { context, page } = await open(browser, {
        colorScheme,
        routes: (p) => p.route(isEntry, (route) => (blocked ? route.abort() : route.continue())),
      });
      const started = Date.now();
      await page.goto(`${base}${PAGE}`, { waitUntil: 'domcontentloaded' });
      const button = await assertNotice(page, `${name} ${colorScheme}, first script blocked`);
      assert(Date.now() - started < WAIT_MS, `${name}: a blocked script is reported without the long wait`);
      blocked = false;
      await button.click();
      await waitForApp(page, 30000);
      assert.equal(await notice(page).count(), 0, `${name} ${colorScheme}: the message is gone after Reload`);
      await context.close();
    }

    // 2. The first script is gone (a page kept from before a release asks for a file the host no longer has, and
    // gets the host's 404 page).
    {
      const { context, page } = await open(browser, {
        routes: (p) =>
          p.route(isEntry, (route) =>
            route.fulfill({ status: 404, contentType: 'text/html; charset=UTF-8', body: '<!doctype html><title>Not found</title>' }),
          ),
      });
      await page.goto(`${base}${PAGE}`, { waitUntil: 'domcontentloaded' });
      await assertNotice(page, `${name}, first script removed`);
      await context.close();
    }

    // 3. The first script runs and fails before drawing anything: no load error to hear, so the message comes
    // after the wait.
    {
      const { context, page } = await open(browser, {
        routes: (p) =>
          p.route(isEntry, (route) =>
            route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("failed before the app drew");' }),
          ),
      });
      await page.goto(`${base}${PAGE}`, { waitUntil: 'load' });
      await page.waitForTimeout(WAIT_MS - 3000);
      assert.equal(await notice(page).count(), 0, `${name}: no message before the wait is over`);
      await assertNotice(page, `${name}, first script failed early`);
      await context.close();
    }

    // 4. A slow but successful load: every script of the app takes its time, and (in Chromium) the processor is
    // slowed six times, as on an old phone. The message never shows, during the load or after it.
    {
      const { context, page } = await open(browser, {
        routes: (p) =>
          p.route(
            (url) => isEntry(url) || isAppScript(url),
            async (route) => {
              await new Promise((resolve) => setTimeout(resolve, 400));
              await route.continue();
            },
          ),
      });
      if (name === 'chromium') {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      }
      await page.addInitScript(() => {
        window.__noticeSeen = false;
        new MutationObserver(() => {
          if (document.getElementById('ce-boot-notice')) window.__noticeSeen = true;
        }).observe(document, { childList: true, subtree: true });
      });
      const started = Date.now();
      await page.goto(`${base}${PAGE}`, { waitUntil: 'load' });
      const loadMs = Date.now() - started;
      await waitForApp(page, 60000);
      const drawnMs = Date.now() - started;
      await page.waitForTimeout(WAIT_MS + 2000);
      assert.equal(await page.evaluate(() => window.__noticeSeen), false, `${name}: a slow load never shows the message`);
      assert(drawnMs - loadMs < WAIT_MS / 2, `${name}: the app drew ${drawnMs - loadMs}ms after load, too near the ${WAIT_MS}ms wait`);
      console.log(`[${name}] slow load: page loaded in ${loadMs}ms, app drawn ${drawnMs - loadMs}ms after that; no message.`);
      await context.close();
    }

    // 5. A load slower than even the long wait (the app's first script ran, the rest crawls): no message at the
    // short wait, the message after the long one, and it goes the moment the app draws.
    {
      // The connection recovers once the message is up: each part of the app that waits on another arrives only
      // after it, so a crawl that never ends would keep the app from ever drawing.
      let crawling = true;
      const { context, page } = await open(browser, {
        routes: (p) =>
          p.route(isAppScript, async (route) => {
            if (crawling) await new Promise((resolve) => setTimeout(resolve, LONG_WAIT_MS + 5000));
            await route.continue().catch(() => {});
          }),
      });
      // The crawling parts hold back the page's load event too, so the wait is counted from the page's start.
      await page.goto(`${base}${PAGE}`, { waitUntil: 'commit' });
      await page.waitForTimeout(WAIT_MS + 3000);
      assert.equal(await notice(page).count(), 0, `${name}: a slow connection is not told the page failed at the short wait`);
      await notice(page).waitFor({ timeout: LONG_WAIT_MS });
      crawling = false;
      assert.equal(await page.locator('#ce-agent-note').count(), 0, `${name}: the agents' note is not left beside the message`);
      await waitForApp(page, 90000);
      assert.equal(await notice(page).count(), 0, `${name}: the message goes once the app draws`);
      await context.close();
    }

    // 6. The first script ran, but the main part of the app never arrives (a stalled connection). The app has
    // already put its toast host in the root; that alone once kept the message away and left a white page. Now
    // the loading line shows, and the message comes after the long wait.
    {
      const { context, page } = await open(browser, { routes: (p) => p.route(isMainPart, () => {}) });
      await page.goto(`${base}${PAGE}`, { waitUntil: 'commit' });
      const loading = page.locator('.ce-app-loading');
      await loading.waitFor({ timeout: 20000 });
      await page.waitForTimeout(1500);
      assert.equal(await loading.isVisible(), true, `${name}: the loading line shows while the main part is missing`);
      assert.equal(await notice(page).count(), 0, `${name}: no message before the long wait`);
      await notice(page).waitFor({ timeout: LONG_WAIT_MS });
      await assertNotice(page, `${name}, main part stalled`);
      await context.close();
    }

    // 7. A normal load: nothing of it shows, not even the loading line.
    {
      const { context, page } = await open(browser);
      await page.addInitScript(() => {
        window.__loadingSeen = false;
        const check = () => {
          const line = document.querySelector('.ce-app-loading');
          if (line && getComputedStyle(line).visibility === 'visible') window.__loadingSeen = true;
        };
        new MutationObserver(check).observe(document, { childList: true, subtree: true });
        const poll = setInterval(check, 100);
        setTimeout(() => clearInterval(poll), 15000);
      });
      await page.goto(`${base}${PAGE}`, { waitUntil: 'load' });
      await waitForApp(page, 30000);
      assert.equal(await notice(page).count(), 0, `${name}: a normal load shows no message`);
      assert.equal(await page.evaluate(() => window.__loadingSeen), false, `${name}: a normal load never shows the loading line`);
      await context.close();
    }
    console.log(`[${name}] blank-page message: blocked, removed and failed first scripts and a stalled main part report; slow and normal loads do not.`);
  } finally {
    await browser.close();
  }
}
