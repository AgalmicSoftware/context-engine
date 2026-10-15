import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const demoSessions = JSON.parse(readFileSync(new URL('../client/src/variables/demo/demo_sessions.json', import.meta.url)));
const activeCard = (page) => page.getByTestId('ce-pile-active-question');
const waitForCard = (page, index) => page.waitForFunction((index) =>
  document.querySelector('[data-testid="ce-pile-active-question"]')?.getAttribute('aria-label')?.startsWith(`Question ${index} of `), index, { timeout: 60000 }).catch(async (error) => {
    console.error((await page.locator('body').innerText()).slice(0, 3500));
    throw error;
  });

try {
  for (const theme of ['civic', 'classic-95', 'context-engine']) {
    for (const width of [390, 1280]) {
      for (const enabled of [true, false]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        // Override only this browser's config reads; never change the deployed session.
        // The enabled case omits the field and exercises the normal environment default.
        const config = { ...demoSessions['demo-sh'], ...(enabled ? {} : { pileAutoAdvanceEnabled: false }) };
        const fixture = { ...demoSessions, 'demo-sh': config };
        const moduleLines = Object.entries(fixture)
          .filter(([key]) => /^[A-Za-z_$][\w$]*$/.test(key))
          .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`);
        moduleLines.push(`export default ${JSON.stringify(fixture)};`);
        await page.route('**/src/variables/demo/demo_sessions.json?import*', route => route.fulfill({
          contentType: 'application/javascript', body: moduleLines.join('\n'),
        }));
        const questions = [1, 2, 3].map(index => ({
          id: `0x${String(index).padStart(64, '0')}`, type: 'binary',
          prompt: `Synthetic navigation question ${index}`, options: [], tags: [],
          sessionSlug: 'demo-sh', sessionId: config.sessionId,
        }));
        await page.route(`${new URL(config.corsWorkerUrl).origin}/storage/list?*`, route => route.fulfill({ json: {
          items: new URL(route.request().url()).searchParams.get('resource') === 'questions'
            ? questions.map(question => ({ storageRef: { backend: 'cloudflare', id: question.id, resource: 'questions' } })) : [],
          listComplete: true, cursor: null,
        } }));
        await page.route(`${new URL(config.corsWorkerUrl).origin}/storage/read?*`, route => {
          const question = questions.find(item => item.id === new URL(route.request().url()).searchParams.get('id'));
          return route.fulfill({ status: question ? 200 : 404, json: question || {} });
        });
        await page.route('**/session-config?*', route => route.fulfill({ json: { ok: true, sessionSlug: 'demo-sh', config } }));
        await page.addInitScript(({ theme, enabled }) => {
          localStorage.setItem('ce:theme', theme);
          localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
          localStorage.setItem('ce_onboarding_complete', 'true');
          localStorage.setItem('ce:pileAutoAdvanceEnabled', JSON.stringify(!enabled));
        }, { theme, enabled });
        page.setDefaultTimeout(20000);
        await page.goto(`${baseUrl}/session/demo-sh`, { waitUntil: 'domcontentloaded' });
        await waitForCard(page, 1);
        await activeCard(page).getByText('Agree', { exact: true }).click();
        if (enabled) {
          await waitForCard(page, 2);
          assert(await activeCard(page).evaluate((el) => el === document.activeElement), 'Focus follows the next question');
        } else {
          await waitForCard(page, 1);
          assert(await activeCard(page).getByRole('radio', { name: 'Agree', exact: true }).isChecked());
          await page.getByRole('button', { name: 'Next Question', exact: true }).click();
          await waitForCard(page, 2);
        }
        await page.getByRole('button', { name: 'Previous Question', exact: true }).click();
        assert(await activeCard(page).getByRole('radio', { name: 'Agree', exact: true }).isChecked(), 'Back preserves the answer');
        await activeCard(page).getByText('Agree', { exact: true }).click();
        await waitForCard(page, 1);
        assert(!await activeCard(page).getByRole('radio', { name: 'Agree', exact: true }).isChecked());
        await page.getByRole('button', { name: /^LOG IN$/i }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog]')].some((el) => getComputedStyle(el).opacity === '1'));
        await page.getByRole('button', { name: 'Toggle pre-login settings' }).click();
        await page.getByTestId('ce-prelogin-settings-panel').waitFor();
        assert.equal(await page.getByTestId('ce-settings-auto-advance').count(), 0);
        assert.equal(await page.getByRole('button', { name: /Auto-advance/i }).count(), 0);
        if (theme === 'civic' && enabled) await page.getByRole('dialog').screenshot({ animations: 'disabled', path: `/tmp/pile-auto-advance-settings-${width}.png` });
        await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForCard(page, 1);
        await activeCard(page).getByRole('radio', { name: 'Disagree', exact: true }).press('Space');
        await waitForCard(page, enabled ? 2 : 1);
        if (!enabled) assert(await activeCard(page).getByRole('radio', { name: 'Disagree', exact: true }).isChecked());
        await page.close();
        console.log(`PASS ${theme} ${width} auto-advance=${enabled}: config, answer, Back, deselect, reload, Settings`);
      }
    }
  }
} finally {
  await browser.close();
}
