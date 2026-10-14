import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const openSettings = async (page) => {
  await page.getByRole('button', { name: /^LOG IN$/i }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog]')].some((el) => getComputedStyle(el).opacity === '1'));
  const toggle = page.getByTestId('ce-settings-auto-advance');
  if (!await toggle.isVisible()) await page.getByRole('button', { name: 'Toggle pre-login settings' }).click();
  await toggle.waitFor({ state: 'visible' });
  return toggle;
};
const closeSettings = (page) => page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
const activeCard = (page) => page.getByTestId('ce-pile-active-question');
const waitForCard = (page, index) => page.waitForFunction((index) =>
  document.querySelector('[data-testid="ce-pile-active-question"]')?.getAttribute('aria-label')?.startsWith(`Question ${index} of `), index, { timeout: 20000 });

try {
  for (const theme of ['civic', 'classic-95', 'context-engine']) {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await page.addInitScript((theme) => {
        localStorage.setItem('ce:theme', theme);
        localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
        localStorage.setItem('ce_onboarding_complete', 'true');
      }, theme);
      page.setDefaultTimeout(20000);
      await page.goto(`${baseUrl}/session/demo-sh`, { waitUntil: 'domcontentloaded' });
      await waitForCard(page, 1);
      await activeCard(page).getByText('Agree', { exact: true }).click();
      await waitForCard(page, 2);
      assert(await activeCard(page).evaluate((el) => el === document.activeElement), 'Focus follows the next question');
      await page.getByRole('button', { name: 'Previous Question', exact: true }).click();
      assert(await activeCard(page).getByRole('radio', { name: 'Agree', exact: true }).isChecked(), 'Back preserves the answer');
      // Clicking the selected answer clears it without navigating.
      await activeCard(page).getByText('Agree', { exact: true }).click();
      await waitForCard(page, 1);
      assert(!await activeCard(page).getByRole('radio', { name: 'Agree', exact: true }).isChecked());
      let toggle = await openSettings(page);
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
      const overflow = await toggle.evaluate((el) => {
        const row = el.parentElement;
        return row.scrollWidth - row.clientWidth;
      });
      assert(overflow <= 1, 'Auto-advance setting fits the viewport');
      await closeSettings(page);
      await activeCard(page).getByText('Unsure', { exact: true }).click();
      await waitForCard(page, 1);
      assert(await activeCard(page).getByRole('radio', { name: 'Unsure', exact: true }).isChecked());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForCard(page, 1);
      toggle = await openSettings(page);
      assert.equal(await toggle.getAttribute('aria-pressed'), 'false', 'Opt-out survives reload');
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
      if (theme === 'civic') await page.getByRole('dialog').screenshot({ animations: 'disabled', path: `/tmp/pile-auto-advance-settings-${width}.png` });
      await closeSettings(page);
      await activeCard(page).getByRole('radio', { name: 'Disagree', exact: true }).press('Space');
      await waitForCard(page, 2);
      await page.close();
      console.log(`PASS ${theme} ${width}: answer, Back, deselect, toggle, reload, focus`);
    }
  }
} finally {
  await browser.close();
}
