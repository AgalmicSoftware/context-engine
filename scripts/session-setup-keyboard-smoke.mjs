import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname), 'This smoke requires a local client');

const activeTestId = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid') || '');

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

const assertVisibleFocus = async (locator, label) => {
  const indicator = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outline: style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0,
      shadow: style.boxShadow !== 'none',
    };
  });
  assert(indicator.outline || indicator.shadow, `${label} shows a visible focus indicator`);
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
    const centralized = page.getByTestId('ce-new-preset-fast_cheap_cloudflare');
    await centralized.waitFor({ timeout: 30000 });
    await assertNoHorizontalOverflow(page, `${label} preset choice`);

    await tabTo(page, centralized, `${label} Centralized preset`);
    await assertVisibleFocus(centralized, `${label} Centralized preset`);
    await page.keyboard.press('ArrowDown');
    assert.equal(await activeTestId(page), 'ce-new-preset-trustless_public_decentralized', `${label} arrows move between presets`);
    await page.keyboard.press('ArrowUp');
    assert.equal(await activeTestId(page), 'ce-new-preset-fast_cheap_cloudflare', `${label} arrows move back`);
    await page.keyboard.press('Enter');

    const steps = page.getByRole('region', { name: 'Session setup steps' });
    await steps.waitFor({ timeout: 15000 });
    const stepButtons = steps.getByRole('button');
    const stepCount = await stepButtons.count();
    assert(stepCount >= 3, `${label} shows the setup steps`);
    for (let index = 0; index < stepCount; index += 1) {
      const title = (await stepButtons.nth(index).getAttribute('aria-label')).replace(/^Step \d+: /, '');
      assert((await stepButtons.nth(index).innerText()).includes(title), `${label} step "${title}" shows its name`);
    }
    await assertNoHorizontalOverflow(page, `${label} setup steps`);

    const secondStep = stepButtons.nth(1);
    await tabTo(page, secondStep, `${label} second setup step`);
    await assertVisibleFocus(secondStep, `${label} second setup step`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      (element) => element.className.includes('normalModeCardActive'),
      await secondStep.elementHandle(),
      { timeout: 10000 },
    );
    await assertNoHorizontalOverflow(page, `${label} opened step`);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('Session setup keyboard smoke passed at 1280px and 390px: presets, named steps and step focus work without a pointer.');
