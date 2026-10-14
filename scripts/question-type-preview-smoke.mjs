// Local type selection only; no AI generation or content submission.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['civic', 'classic-95', 'context-engine']) {
    for (const width of [320, 937, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 853 }, reducedMotion: 'reduce' });
      await page.addInitScript(theme => {
        localStorage.setItem('ce:theme', theme);
        localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
        localStorage.setItem('ce_onboarding_complete', 'true');
        localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
      }, theme);
      await page.goto(process.env.BASE_URL || 'http://127.0.0.1:3000');
      await page.getByRole('tab', { name: 'Tools', exact: true }).click();
      await page.getByText('Context', { exact: true }).click();
      await page.getByTestId('ce-context-text-input').fill('Local question type preview.');
      const tile = page.getByRole('button', { name: 'Quadratic', exact: true });
      await tile.waitFor();
      const layout = await tile.evaluate(tile => {
        const preview = tile.querySelector('[aria-hidden="true"]');
        const rect = node => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { x, y, width, height };
        };
        return {
          tile: rect(tile), preview: rect(preview),
          squares: [...preview.children].map(rect),
          color: getComputedStyle(preview.firstElementChild).backgroundColor,
          expectedColor: getComputedStyle(tile).getPropertyValue('--ce-status-success').trim(),
          text: tile.textContent.trim(),
        };
      });
      assert.equal(layout.text, 'Quadratic');
      assert.equal(layout.squares.length, 4);
      const [a, b, c, d] = layout.squares;
      assert(a.width > 0 && a.width === a.height && b.width === a.width && c.height === a.height);
      assert(a.y === b.y && c.y === d.y && a.x === c.x && b.x === d.x && b.x > a.x && c.y > a.y);
      assert(Math.abs(layout.preview.x + layout.preview.width / 2 - layout.tile.x - layout.tile.width / 2) < 1);
      assert(layout.tile.x >= 0 && layout.tile.x + layout.tile.width <= width);
      assert.notEqual(layout.color, 'rgba(0, 0, 0, 0)');
      assert(layout.expectedColor, 'Preview uses a theme color');
      const selected = await tile.getAttribute('aria-pressed');
      await tile.click();
      assert.equal(await tile.getAttribute('aria-pressed'), String(selected !== 'true'));
      await tile.press('Space');
      assert.equal(await tile.getAttribute('aria-pressed'), selected);
      await tile.press('Enter');
      assert.equal(await tile.getAttribute('aria-pressed'), String(selected !== 'true'));
      await tile.press('Enter');
      if (process.env.OUTPUT_DIR) await tile.locator('..').screenshot({ path: `${process.env.OUTPUT_DIR}/${theme}-${width}.png` });
      console.log(`PASS Quadratic preview: ${theme} ${width}, four centered squares, pointer and keyboard selection`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
