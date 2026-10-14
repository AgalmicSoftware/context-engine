// Public session reads only; pending, empty, and failed lists are browser-local fixtures.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
try {
  for (const mode of ['live', 'pending-empty', 'failure']) {
    const page = await browser.newPage({ viewport: { width: 773, height: 853 } });
    await page.addInitScript(() => {
      localStorage.setItem('ce_onboarding_complete', 'true');
      localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
      localStorage.setItem('ce:primarySessionSlug', 'eddy26');
      localStorage.setItem('ce:selectedSessionScope', 'active');
    });
    let releaseList;
    let listRequested = false;
    if (mode !== 'live') await page.route('https://ce-eddy26-d9702b0d3c41.agalmic.workers.dev/storage/list?*', async route => {
      if (new URL(route.request().url()).searchParams.get('resource') !== 'questions') return route.continue();
      listRequested = true;
      if (mode === 'failure') return route.fulfill({ status: 503, json: { error: 'Synthetic unavailable list' } });
      await new Promise(resolve => { releaseList = resolve; });
      await route.fulfill({ json: { items: [], listComplete: true, cursor: null } });
    });
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    await page.getByText('Questions', { exact: true }).click();
    if (mode === 'pending-empty') {
      await page.waitForFunction(() => /Loading\.\.\./.test(document.body.innerText));
      assert(!/Questions\s*\(0\)|Loading\.\.\.\s*\(0\)/.test(await page.locator('body').innerText()));
      // Wait for the asynchronous fetch to reach the held list before releasing it.
      for (let attempt = 0; !releaseList && attempt < 100; attempt++) await page.waitForTimeout(50);
      assert(releaseList, 'Expected the selected Worker question list');
      releaseList();
      await page.waitForFunction(() => /Questions\s*\(0\)/.test(document.body.innerText));
    } else if (mode === 'failure') {
      await page.getByText('(cache error)', { exact: true }).waitFor({ timeout: 60000 });
      assert(!/Questions\s*\(0\)/.test(await page.locator('body').innerText()));
      assert(listRequested);
    } else {
      await page.waitForFunction(() => /Questions\s*\([1-9]\d*\)/.test(document.body.innerText), {}, { timeout: 60000 });
      console.log((await page.locator('body').innerText()).match(/Questions\s*\(\d+\)/)?.[0]);
      // Revisiting a verified session must hydrate that session, not keep the previous count.
      const selector = page.getByTestId('ce-tool-explorer-active-session');
      await selector.selectOption('demo-sh');
      await page.waitForFunction(() => /Questions\s*\([1-9]\d*\)/.test(document.body.innerText));
      await selector.selectOption('eddy26');
      await page.waitForFunction(() => /Questions\s*\([1-9]\d*\)/.test(document.body.innerText));
    }
    console.log(`PASS Worker Questions: ${mode}`);
    await page.close();
  }
} finally { await browser.close(); }
