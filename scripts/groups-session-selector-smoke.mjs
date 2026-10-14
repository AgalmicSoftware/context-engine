// Read-only live session discovery and Groups navigation; no join/create submission.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import testIds from '../client/src/utilities/e2eTestIds.js';
const { E2E_TESTIDS } = testIds;
const browser = await chromium.launch({ headless: true });
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const demoWorker = 'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev';
const eddyWorker = 'https://ce-eddy26-d9702b0d3c41.agalmic.workers.dev';
try {
  for (const theme of ['civic', 'classic-95', 'context-engine']) {
    for (const width of [320, 705, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 853 } });
      await page.addInitScript(theme => {
        localStorage.setItem('ce:theme', theme);
        localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
        localStorage.setItem('ce_onboarding_complete', 'true');
        localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
        localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
      }, theme);
      await page.goto(`${base}/groups?sessionSlug=demo-sh&worker=${encodeURIComponent(demoWorker)}`);
      const selector = page.getByTestId(E2E_TESTIDS.WORKER_GROUPS_SESSION_SELECT);
      await selector.waitFor();
      await page.getByRole('article').first().waitFor();
      const demoGroups = await page.getByRole('article').allTextContents();
      await page.getByTestId('ce-sbts-create-toggle').click();
      await selector.selectOption('eddy26');
      await page.waitForFunction(() => document.querySelector('[data-testid="ce-worker-groups-session-select"]')?.value === 'eddy26');
      await page.getByRole('article').first().waitFor();
      const url = new URL(page.url());
      assert.equal(url.pathname, '/groups');
      assert.equal(url.searchParams.get('sessionSlug'), 'eddy26');
      assert.equal(url.searchParams.get('worker'), eddyWorker);
      assert.notDeepEqual(await page.getByRole('article').allTextContents(), demoGroups, 'Group cards change with the session');
      assert.equal(await page.getByRole('button', { name: 'Exit Group Creation' }).count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('ce:primarySessionSlug')), 'demo-sh');
      const layout = await selector.evaluate(select => {
        const hero = select.closest('section');
        const h = hero.getBoundingClientRect();
        const s = select.getBoundingClientRect();
        const link = hero.querySelector('a').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, fits: s.left >= h.left && link.right <= h.right && s.width > 50 };
      });
      assert(layout.fits && !layout.overflow, `Controls fit ${theme} ${width}: ${JSON.stringify(layout)}`);
      if (theme === 'civic') await page.screenshot({ path: `/tmp/group-selector-${width}.png` });
      await page.goBack();
      await page.waitForFunction(() => document.querySelector('[data-testid="ce-worker-groups-session-select"]')?.value === 'demo-sh');
      await page.getByRole('article').first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get('worker'), demoWorker);
      assert.deepEqual(await page.getByRole('article').allTextContents(), demoGroups);
      console.log(`PASS Groups session selector: ${theme} ${width}`);
      await page.close();
    }
  }
} finally { await browser.close(); }
