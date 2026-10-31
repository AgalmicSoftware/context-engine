import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname), 'This smoke requires a local client');

// Tab forward until the target has focus, proving it is reachable without a pointer.
const tabTo = async (page, locator, label, limit = 80) => {
  const target = await locator.elementHandle();
  assert(target, `${label} is rendered`);
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  assert.fail(`${label} is not reachable with Tab`);
};

// Fields animate their outline in, so wait for the transition to finish.
const assertVisibleFocus = async (locator, label) => {
  const shown = await locator
    .evaluate(
      (element) =>
        new Promise((resolve) => {
          const deadline = Date.now() + 2000;
          const check = () => {
            const style = getComputedStyle(element);
            const outline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
            if (outline || style.boxShadow !== 'none') resolve(true);
            else if (Date.now() > deadline) resolve(false);
            else requestAnimationFrame(check);
          };
          check();
        }),
    );
  assert(shown, `${label} shows a visible focus indicator`);
};

const assertNoHorizontalOverflow = async (page, label) => {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert(scrollWidth <= innerWidth, `${label} scrolls sideways (${scrollWidth}px content in ${innerWidth}px)`);
};

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const label = `${viewport.width}px`;
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
    await page.goto(`${baseUrl}/new`, { waitUntil: 'domcontentloaded' });
    const name = page.getByTestId('ce-wizard-session-name');
    await name.waitFor({ timeout: 30000 });
    await assertNoHorizontalOverflow(page, `${label} setup page`);

    await tabTo(page, name, `${label} session name`);
    await assertVisibleFocus(name, `${label} session name`);
    await page.keyboard.type('Keyboard session');
    assert.equal(await name.inputValue(), 'Keyboard session', `${label} the name takes typed text`);

    const hosting = page.getByTestId('ce-setup-more-hosting');
    await tabTo(page, hosting, `${label} hosting caret`);
    await assertVisibleFocus(hosting, `${label} hosting caret`);
    assert.equal(await hosting.getAttribute('aria-expanded'), 'false', `${label} hosting starts closed`);
    await page.keyboard.press('Enter');
    assert.equal(await hosting.getAttribute('aria-expanded'), 'true', `${label} Enter opens a section`);
    await page.getByTestId('ce-setup-storage').waitFor({ timeout: 10000 });
    await assertNoHorizontalOverflow(page, `${label} opened section`);
    await page.keyboard.press('Space');
    assert.equal(await hosting.getAttribute('aria-expanded'), 'false', `${label} Space closes it again`);

    // The token's "?" opens from the keyboard; its text is also the input's description.
    const tip = page.getByRole('button', { name: 'About Cloudflare API token' });
    await tabTo(page, tip, `${label} token help`);
    const bubble = page.locator('#ce-setup-cloudflare-token-tip-content');
    await bubble.waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await bubble.innerText(), /never saved/i, `${label} the token help opens on focus`);
    await page.keyboard.press('Escape');
    await bubble.waitFor({ state: 'hidden', timeout: 10000 });
    const helpId = await page.getByTestId('ce-wizard-cloudflare-api-token').getAttribute('aria-describedby');
    assert.match(
      await page.locator(`[id="${helpId}"]`).textContent(),
      /never saved/i,
      `${label} screen readers get the same help`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('Session setup keyboard smoke passed at 1280px and 390px: fields, section carets and help work without a pointer.');
