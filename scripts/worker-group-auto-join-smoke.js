'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3112';
const sessionId = '0x11111111111111111111111111111111';
const sessionSlug = 'auto-join-smoke';
const group = { groupId: 'participants-2026', sessionSlug, label: 'Participants 2026', joinMode: 'open', memberVisibility: 'session' };
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="root"></div><script type="module" src="/src/test-smoke/workerGroupAutoJoinSmokeEntry.tsx"></script></body></html>`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    let joins = 0;
    let member = false;
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseUrl).origin) {
        if (url.pathname === `/session/${sessionSlug}` || url.pathname === '/about') return route.fulfill({ contentType: 'text/html', body: html });
        return route.continue();
      }
      if (url.origin === 'https://auto-join-worker.example') {
        const payload = { ok: true, sessionId, sessionSlug };
        if (url.pathname === '/groups/list') payload.groups = [group];
        if (url.pathname === '/groups/my-memberships') payload.memberships = member ? [{ group, member: { sessionSlug } }] : [];
        if (url.pathname === '/groups/join') {
          assert.equal(route.request().headers().authorization, 'Bearer synthetic-viewer-token');
          assert.deepEqual(route.request().postDataJSON(), { groupId: group.groupId, sessionId });
          joins += 1; member = true; payload.group = group; payload.memberCount = 1;
        }
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
      }
      return route.abort();
    });
    const link = `${baseUrl}/session/${sessionSlug}?joinGroup=${group.groupId}&view=questions#questions`;
    await page.goto(link);
    const banner = page.getByTestId('ce-session-worker-group-auto-join');
    await banner.getByText('Sign in to join this group automatically.').waitFor();
    assert.equal(joins, 0);
    // The app shell owns joining; its collapsed Groups panel is not needed.
    assert.equal(await page.getByTestId('ce-session-worker-groups-native').count(), 0);
    await banner.getByRole('button', { name: 'Sign in', exact: true }).click();
    await banner.getByText('Joined Participants 2026.', { exact: true }).waitFor();
    assert.equal(joins, 1);
    assert.equal(new URL(page.url()).search, '?view=questions');
    assert.equal(new URL(page.url()).hash, '#questions');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.getByTestId('ce-session-groups-toggle').click();
    const copyLink = page.getByRole('button', { name: 'Copy auto-join link for Participants 2026', exact: true });
    await copyLink.click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${baseUrl}/session/${sessionSlug}?joinGroup=${group.groupId}&worker=https%3A%2F%2Fauto-join-worker.example`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await copyLink.scrollIntoViewIfNeeded();
    const screenshot = path.join(os.tmpdir(), 'ce-worker-group-auto-join-mobile.png');
    await page.screenshot({ path: screenshot });
    console.log(`Mobile screenshot: ${screenshot}`);
    await page.reload();
    assert.equal(await banner.count(), 0);
    assert.equal(joins, 1);
    // Reopening the invitation recognizes membership without another POST.
    await page.goto(link);
    await banner.getByRole('button', { name: 'Sign in', exact: true }).click();
    await banner.getByText('You’re already in Participants 2026.').waitFor();
    assert.equal(joins, 1);
    // Cancellation consumes the intent before authentication.
    member = false;
    await page.goto(link);
    await banner.getByRole('button', { name: 'Cancel auto-join' }).click();
    await page.reload();
    assert.equal(await banner.count(), 0);
    assert.equal(joins, 1);
    // A pending invitation survives client navigation and a refresh away from
    // the session, and still joins its original group after login.
    await page.goto(link);
    await banner.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Navigate away before signing in' }).click();
    await page.reload();
    await banner.getByRole('button', { name: 'Sign in', exact: true }).click();
    await banner.getByText('Joined Participants 2026.', { exact: true }).waitFor();
    assert.equal(joins, 2);
    assert.equal(new URL(page.url()).pathname, '/about');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('ce:worker-group-auto-join:v1')), null);
    await page.goto(`${baseUrl}/session/${sessionSlug}?joinGroup=${'a'.repeat(80)}`);
    await banner.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    console.log('PASS: Cloudflare auto-join smoke (sign-in, collapsed groups, join, cleanup, existing member, cancellation, navigation/refresh before login, mobile layout)');
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
