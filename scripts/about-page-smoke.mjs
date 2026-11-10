import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { assertReadable } from './civic-theme-overlay-smoke.mjs';

async function inspectMobileAbout(page) {
  if (page.viewportSize().width > 640) return;
  const hero = page.getByTestId('ce-about-hero');
  const geometry = await hero.evaluate((element) => {
    const actions = [...element.querySelectorAll('a')].filter((link) => ['Demo', 'New Session'].includes(link.textContent.trim()));
    const textRows = (node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return new Set([...range.getClientRects()].filter((rect) => rect.width).map((rect) => Math.round(rect.top))).size;
    };
    return {
      actionRows: actions.map(textRows),
      actionHeights: actions.map((link) => link.getBoundingClientRect().height),
      resources: [...element.querySelectorAll('[data-testid^="ce-about-link-"]')].map((link) => {
        const rect = link.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    };
  });
  assert.deepEqual(geometry.actionRows, [1, 1], 'Phone actions keep their labels on one line');
  assert(geometry.actionHeights.every((height) => height >= 44), 'Phone actions have usable touch targets');
  assert(geometry.resources.every(({ width, height }) => width >= 44 && height >= 44), 'Resource icons have 44px touch targets');
  await assertReadable(page.getByTestId('ce-about-demo-video-play'));
  for (const name of ['Related Work', 'Recognition']) {
    const header = page.getByRole('button', { name, exact: true });
    const fits = await header.evaluate((element) => {
      const heading = element.querySelector('h2');
      const summary = element.querySelector('[class*="relatedSummary_"], [class*="practiceSummary_"]');
      const headingRect = heading.getBoundingClientRect();
      const summaryRect = summary.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return headingRect.height <= parseFloat(getComputedStyle(heading).lineHeight) + 1
        && summaryRect.top >= headingRect.bottom
        && summaryRect.left >= rect.left - 1 && summaryRect.right <= rect.right + 1;
    });
    assert(fits, `${name} preview sits below an unbroken heading and fits the phone`);
  }
  const tile = page.getByTestId('ce-about-use-cases').getByRole('button').first();
  await tile.tap();
  assert.equal(await tile.getAttribute('aria-pressed'), 'true', 'Touch opens the selected use case');
  await tile.tap();
  assert.equal(await tile.getAttribute('aria-pressed'), 'false', 'Touch closes the selected use case');
}

export async function inspectAboutControls(page) {
  const grid = page.getByTestId('ce-about-use-cases');
  const buttons = grid.getByRole('button');
  assert.equal(await buttons.count(), 5);
  const fills = await buttons.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundImage));
  assert.equal(new Set(fills).size, 5, 'Each use case has its own color');
  await assertReadable(grid);

  for (let index = 0; index < 5; index += 1) {
    const button = buttons.nth(index);
    await button.focus();
    await button.press('Enter');
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.equal(await grid.locator('[aria-pressed="true"]').count(), 1);
    const panel = page.locator('article[aria-live="polite"]');
    await assertReadable(panel);
    assert.equal(await panel.evaluate((element) => element.scrollWidth > element.clientWidth + 1), false, 'Detail content stays inside its panel');
    await assertReadable(button);
    const visual = await button.evaluate((element) => {
      const style = getComputedStyle(element);
      return { shadow: style.boxShadow, outline: style.outlineStyle, width: parseFloat(style.outlineWidth), focus: element.matches(':focus-visible') };
    });
    assert(visual.shadow.split(/,(?![^()]*\))/).every((shadow) => shadow.includes('inset')), 'Selected tile is recessed');
    assert(visual.focus && visual.outline !== 'none' && visual.width >= 2, 'Keyboard selection keeps a visible focus ring');
    await button.press('Enter');
    assert.equal(await panel.count(), 0, 'Pressing the active use case closes its detail');
  }

  await page.getByRole('button', { name: 'Recognition', exact: true }).click();
  const logos = page.getByTestId('ce-about-used-by').locator('[class*="practiceVisual_"]');
  const sizes = await logos.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return [rect.width, rect.height];
  }));
  assert.equal(sizes.length, 5);
  assert(sizes.every(([width, height]) => width === 64 && height === 64), 'Recognition uses equal logo containers without stretching artwork');
  const overflowingNames = await page.locator('[class*="recognitionName_"]').evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent));
  assert.deepEqual(overflowingNames, [], 'Acknowledgement names wrap without overlapping adjacent logos');
  await assertReadable(page.locator('body'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Expanded About fits the viewport');
  await page.getByRole('button', { name: 'Recognition', exact: true }).click();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await buttons.first().click();
  const motion = await page.locator('article[aria-live="polite"]').evaluate((element) => getComputedStyle(element).animationName);
  assert.equal(motion, 'none', 'Reduced motion removes detail entrance animation');
  await buttons.first().click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

export async function runSmoke() {
  const { chromium } = await import('playwright');
  const { inspectCivicAbout, inspectNavbarLogoAlignment } = await import('./civic-theme-smoke.mjs');
  const { installCivicThemeFixtures } = await import('./civic-theme-fixtures.mjs');
  const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 768, 640, 430, 390, 360, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width <= 640, hasTouch: width <= 640 });
      await installCivicThemeFixtures(context, baseUrl);
      await context.addInitScript(() => localStorage.setItem('ce:theme', 'civic'));
      const page = await context.newPage();
      await page.goto(`${baseUrl}/about`, { waitUntil: 'domcontentloaded' });
      await inspectNavbarLogoAlignment(page);
      await inspectMobileAbout(page);
      await inspectCivicAbout(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      console.log(`About smoke passed: ${width}px (contrast, selection, focus, logos, header, reduced motion)`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSmoke().catch((error) => { console.error(error); process.exitCode = 1; });
}
