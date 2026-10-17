// Synthetic Worker reads only. No session responses, credentials, or deployed config are written.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const demoSessions = JSON.parse(readFileSync(new URL('../client/src/variables/demo/demo_sessions.json', import.meta.url)));
const canonicalConfig = demoSessions['demo-sh'];
const canonicalOrigin = new URL(canonicalConfig.corsWorkerUrl).origin;
const alternateOrigin = 'https://alternate-session-worker.example.test';
const browser = await chromium.launch({ headless: true });

try {
  for (const routeOrigin of [canonicalOrigin, alternateOrigin]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    let onHome = false;
    const homeBootstraps = [];
    const homeAlternateReads = [];
    const rejectedIdentityChanges = [];
    page.on('dialog', async (dialog) => {
      rejectedIdentityChanges.push(dialog.message());
      await dialog.dismiss();
    });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (![canonicalOrigin, alternateOrigin].includes(url.origin)) return route.abort();
      if (onHome && url.origin === alternateOrigin) homeAlternateReads.push(url.pathname);
      const config = { ...canonicalConfig, corsWorkerUrl: url.origin };
      if (url.pathname === '/session-config') {
        if (onHome) homeBootstraps.push(url.origin);
        return route.fulfill({ json: { ok: true, sessionSlug: config.slug, config } });
      }
      if (url.pathname === '/storage/list') {
        return route.fulfill({ json: {
          items: url.searchParams.get('resource') === 'questions'
            ? [{ storageRef: { backend: 'cloudflare', id: `0x${'1'.repeat(64)}`, resource: 'questions' } }] : [],
          listComplete: true,
          cursor: null,
        } });
      }
      if (url.pathname === '/storage/read') {
        return route.fulfill({ json: {
          id: `0x${'1'.repeat(64)}`,
          type: 'binary',
          prompt: 'Synthetic Worker navigation question',
          options: [],
          tags: [],
          sessionSlug: config.slug,
          sessionId: config.sessionId,
        } });
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      localStorage.setItem('ce_onboarding_complete', 'true');
      localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
      localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
      localStorage.setItem('ce:selectedSessionScope', 'active');
    });
    page.setDefaultTimeout(20000);
    await page.goto(`${baseUrl}/session/demo-sh?worker=${encodeURIComponent(routeOrigin)}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('ce-pile-active-question').waitFor({ timeout: 60000 });
    onHome = true;
    await page.getByRole('link', { name: 'Context Engine home', exact: true }).click();
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    await page.getByText('Questions', { exact: true }).click();
    if (routeOrigin === alternateOrigin) {
      await page.getByTestId('ce-worker-canonical-bootstrap-error').waitFor();
      assert.equal(rejectedIdentityChanges.length, 1, 'Home keeps the existing identity change confirmation');
      assert.equal(homeAlternateReads.length, 0, 'Home must not reuse the explicitly opened alternate Worker');
    } else {
      await page.waitForFunction(() => /Questions\s*\(1\)/.test(document.body.innerText));
      // Reopening the tool rerenders Home without starting another bootstrap.
      await page.getByRole('button', { name: '← Back', exact: true }).click();
      await page.getByText('Questions', { exact: true }).click();
      await page.waitForFunction(() => /Questions\s*\(1\)/.test(document.body.innerText));
    }
    assert.deepEqual(homeBootstraps, [canonicalOrigin], 'Home must verify its configured origin exactly once');
    console.log(`PASS Worker route → Home: ${routeOrigin === canonicalOrigin ? 'same origin verifies once' : 'alternate origin isolated; identity conflict remains closed'}`);
    await page.close();
  }
} finally {
  await browser.close();
}
