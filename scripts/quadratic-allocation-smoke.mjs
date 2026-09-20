import assert from 'node:assert/strict';

// Compatible with Playwright and the in-app browser's Playwright locator surface.
export async function probeQuadraticAllocation(page) {
  const parks = page.getByTestId('ce-quadratic-vote-0');
  const transit = page.getByTestId('ce-quadratic-vote-1');
  const budget = page.getByTestId('ce-quadratic-budget');
  for (let i = 0; i < 7; i++) await parks.press('ArrowRight');
  for (let i = 0; i < 7; i++) await transit.press('ArrowLeft');
  assert.match(await budget.textContent(), /1 credits left/);
  assert.match(await page.getByTestId('ce-quadratic-cost-0').textContent(), /49 credits/);
  await parks.press('ArrowRight');
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.match(await budget.textContent(), /1 credits left/);
  await page.getByRole('button', { name: 'How voice credits work' }).click();
  assert.match(await page.getByRole('tooltip').textContent(), /49 credits/);
  await page.getByRole('button', { name: 'How voice credits work' }).press('Tab');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  assert.equal(await page.getByTestId('ce-quadratic-saved').textContent(), '[7,-7,0]');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  assert.match(await budget.textContent(), /99 credits left/);
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  assert.match(await budget.textContent(), /1 credits left/);
  await page.getByRole('button', { name: 'Submit locally', exact: true }).click();
  for (let i = 0; i < 9; i++) await parks.press('ArrowLeft');
  for (let i = 0; i < 12; i++) await transit.press('ArrowRight');
  await page.getByRole('button', { name: 'Submit locally', exact: true }).click();
  const rows = page.getByTestId('ce-quadratic-results').getByRole('row');
  assert.match(await rows.nth(1).textContent(), /Parks7-25/);
  assert.match(await rows.nth(2).textContent(), /Transit5-7-2/);
  const geometry = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="ce-quadratic-pile-card"]');
    const sliders = container.querySelectorAll('input[type="range"]');
    const last = sliders[sliders.length - 1];
    return {
      containerBottom: container.getBoundingClientRect().bottom,
      lastSliderBottom: last.getBoundingClientRect().bottom,
      pageWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hasSharedControls: /Submit locally|Question 3 of 12/.test(container.textContent),
    };
  });
  assert.ok(geometry.lastSliderBottom <= geometry.containerBottom, 'Pile container must grow around all sliders');
  assert.ok(geometry.scrollWidth <= geometry.pageWidth, 'No horizontal overflow');
  assert.equal(geometry.hasSharedControls, false, 'Submit and progress stay outside the card');
  return { ok: true, checks: ['keyboard sliders', 'per-option costs', 'descriptive tooltip', 'signed votes', 'budget enforcement', 'neutrality', 'draft restore', 'net and positive/negative totals'] };
}

export async function runSmoke() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      for (const theme of ['context-engine', 'classic-95']) {
        await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:3000'}/tests/fixtures/quadratic-allocation.html`);
        await page.getByRole('combobox', { name: 'Theme' }).selectOption(theme);
        console.log(JSON.stringify({ viewport, theme, ...await probeQuadraticAllocation(page) }));
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
