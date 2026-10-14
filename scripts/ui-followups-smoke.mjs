// Browser-local fixtures only: no response, membership or configuration writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
try {
  for (const theme of (process.env.REPORT_ONLY ? [] : ['civic', 'classic-95', 'context-engine'])) {
    for (const width of [320, 773, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await page.addInitScript(theme => {
        localStorage.setItem('ce:theme', theme);
        localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
        localStorage.setItem('ce_onboarding_complete', 'true');
        localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
      }, theme);
      await page.goto(`${base}/session/eddy26?worker=https%3A%2F%2Fce-eddy26-d9702b0d3c41.agalmic.workers.dev`);
      await page.getByTestId('ce-pile-active-question').waitFor({ timeout: 60000 });
      const rail = await page.getByRole('button', { name: 'Next Question', exact: true }).evaluate(button => {
        const nav = button.parentElement;
        const controls = nav.parentElement;
        const actions = [...controls.children].find(child => child.className.includes('pileActions'));
        const center = element => { const rect = element.getBoundingClientRect(); return rect.left + rect.width / 2; };
        return { desktop: getComputedStyle(nav).position === 'absolute', nav: center(button), actions: center([...actions.querySelectorAll('button')].find(element => element.getBoundingClientRect().width > 0)), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      if (rail.desktop) assert(Math.abs(rail.nav - rail.actions) < 1, JSON.stringify({ theme, width, rail }));
      assert(!rail.overflow, JSON.stringify({ theme, width, rail }));
      if (theme === 'civic') await page.screenshot({ path: `/tmp/ui-rail-${width}.png` });
      await page.getByRole('button', { name: /^LOG IN$/i }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog]')].some(element => getComputedStyle(element).opacity === '1'));
      await page.getByRole('button', { name: 'Toggle pre-login settings' }).click();
      const select = page.getByTestId('ce-settings-theme');
      await select.waitFor();
      const appearance = await select.evaluate(select => {
        const row = select.closest('[class*="settingsThemeQuickControl"]');
        const label = row.querySelector('label');
        const checkbox = row.querySelector('input');
        const centerY = element => { const r = element.getBoundingClientRect(); return r.top + r.height / 2; };
        return { text: label.textContent.trim(), width: select.getBoundingClientRect().width, labelY: centerY(label), selectY: centerY(select), checkboxY: centerY(checkbox), overflow: row.scrollWidth > row.clientWidth + 1 };
      });
      assert.equal(appearance.text, 'Appearance');
      assert(appearance.width <= 171 && !appearance.overflow, JSON.stringify({ theme, width, appearance }));
      if (width >= 773) {
        assert(Math.abs(appearance.labelY - appearance.selectY) < 2, JSON.stringify(appearance));
        assert(Math.abs(appearance.checkboxY - appearance.selectY) < 2, JSON.stringify(appearance));
      }
      if (theme === 'civic') await page.getByRole('dialog').screenshot({ path: `/tmp/ui-appearance-${width}.png` });
      console.log(`PASS appearance and pile alignment: ${theme} ${width}`);
      await page.close();
    }
  }
  const page = await browser.newPage();
  await page.goto(base);
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const Report = (await import('/src/components/PolisReport/PolisReport.tsx')).default;
    const container = document.createElement('div');
    document.body.replaceChildren(container);
    const root = createRoot(container);
    const props = { sessionSlug: 'synthetic-refresh', network: { id: 11155420 }, isQuestionCacheReady: true, isResponsesCacheReady: true,
      questionResponses: { q1: [{ responder: '0x' + '1'.repeat(40), questionId: 'q1', response: JSON.stringify({ type: 'binary', prompt: 'Synthetic refresh question', answer: { value: 'Agree' } }) }] } };
    window.renderReport = (next) => root.render(React.createElement(Report, { ...props, ...next }));
    window.renderReport({});
  });
  await page.getByText('Summary and Statistics', { exact: true }).waitFor();
  await page.evaluate(() => window.renderReport({ questionResponses: {}, isQuestionCacheReady: false, isResponsesCacheReady: false }));
  await page.getByLabel('Refreshing report').waitFor();
  assert.equal(await page.getByLabel('Loading report', { exact: true }).count(), 0);
  assert(await page.getByText('Summary and Statistics', { exact: true }).isVisible());
  await page.evaluate(() => window.renderReport({ questionResponses: {}, sessionSlug: 'different-session', isQuestionCacheReady: false, isResponsesCacheReady: false }));
  await page.getByLabel('Loading report', { exact: true }).waitFor();
  console.log('PASS report refresh retains loaded results and clears on session change');
  await page.close();
} finally { await browser.close(); }
