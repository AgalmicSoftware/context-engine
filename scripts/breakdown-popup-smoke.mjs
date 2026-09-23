import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:3000'}/tests/fixtures/breakdown-popup.html`);
    await page.getByRole('button', { name: /How should communities.*: Agree/ }).first().click();
    const tooltip = page.getByTestId('demo-analysis-beeswarm-tooltip');
    const assertBounds = async (height) => {
      const bounds = await tooltip.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height,
        'Popup stays inside the viewport rather than being clipped by the report');
    };
    await assertBounds(844);
    await page.screenshot({ path: `/tmp/ce-breakdown-popup-${width}.png` });
    await page.setViewportSize({ width, height: 300 });
    await page.waitForFunction(() => {
      const tooltip = document.querySelector('[data-testid="demo-analysis-beeswarm-tooltip"]');
      return tooltip.getBoundingClientRect().bottom <= window.innerHeight;
    });
    await assertBounds(300);
    await tooltip.evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.ok(await tooltip.evaluate(el => el.scrollTop > 0), 'Long popup details can scroll');
    await tooltip.evaluate(el => { el.scrollTop = 0; });
    await page.getByRole('button', { name: 'Close details' }).click();
    assert.equal(await tooltip.count(), 0);
    console.log(JSON.stringify({ width, checks: ['portal', 'viewport edges', 'resize', 'scroll long details', 'close'] }));
    await page.close();
  }
} finally {
  await browser.close();
}
