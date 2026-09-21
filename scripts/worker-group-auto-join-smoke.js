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
    let sessionConfig;
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseUrl).origin) {
        if ([`/session/${sessionSlug}`, '/about'].includes(url.pathname)) return route.fulfill({ contentType: 'text/html', body: html });
        return route.continue();
      }
      if (url.origin === 'https://auto-join-worker.example') {
        const payload = { ok: true, sessionId, sessionSlug };
        if (url.pathname === '/session-config') payload.config = sessionConfig;
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
    await banner.getByText('Participants 2026:', { exact: true }).waitFor();
    sessionConfig = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('ce:sessionWorkerConfigCache:v1')).bySession)[0].canonicalConfig);
    assert.equal(joins, 0);
    assert.equal(await banner.getByRole('button').count(), 1);
    assert.equal(await banner.getByRole('heading').count(), 0);
    // The actual name is visible before authentication at narrow and wider widths.
    for (const width of [390, 646, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      if (width >= 646) assert.ok((await banner.boundingBox()).height <= 44, 'Invitation must remain a thin single row');
      await page.screenshot({ path: path.join(os.tmpdir(), `ce-auto-join-invitation-${width}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    // The app shell owns joining; its collapsed Groups panel is not needed.
    assert.equal(await page.getByTestId('ce-session-worker-groups-native').count(), 0);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await banner.getByText('Joined Participants 2026.', { exact: true }).waitFor();
    assert.equal(joins, 1);
    assert.equal(new URL(page.url()).search, '?view=questions');
    assert.equal(new URL(page.url()).hash, '#questions');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.getByTestId('ce-session-groups-toggle').click();
    const openDetails = page.getByRole('button', { name: 'Open group details for Participants 2026', exact: true });
    await openDetails.waitFor();
    const groupHeading = page.getByTestId('ce-session-groups-toggle');
    const refreshGroups = page.getByRole('button', { name: 'Refresh groups', exact: true });
    for (const width of [390, 646, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const headingBox = await groupHeading.boundingBox();
      const refreshBox = await refreshGroups.boundingBox();
      assert.ok(Math.abs(headingBox.y + headingBox.height / 2 - refreshBox.y - refreshBox.height / 2) <= 2,
        `Group refresh stays aligned with its title at ${width}px`);
      assert.equal(await refreshGroups.evaluate((button) => getComputedStyle(button).borderTopWidth), '0px');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    }
    await refreshGroups.click();
    await openDetails.waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.getByRole('button', { name: 'Copy auto-join link for Participants 2026', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Copy Participants 2026 group link', exact: true }).count(), 1);
    const [detailPage] = await Promise.all([context.waitForEvent('page'), openDetails.click()]);
    try {
      await detailPage.getByTestId('ce-worker-group-detail').waitFor();
    } catch (error) {
      console.error('Group route failure:', await detailPage.locator('body').innerText());
      throw error;
    }
    assert.equal(new URL(detailPage.url()).pathname, `/group/${group.groupId}`);
    assert.equal(new URL(detailPage.url()).searchParams.get('worker'), 'https://auto-join-worker.example');
    assert.equal(await detailPage.getByText(/blocks left/i).count(), 0);
    // This uses the actual app shell, including fresh discovery from the
    // cached public origin when an older shared link has no Worker hint.
    await detailPage.goto(`${baseUrl}/group/${group.groupId}?sessionName=${sessionSlug}`);
    await detailPage.getByTestId('ce-worker-group-detail').waitFor();
    assert.equal(await detailPage.getByText(/blocks left/i).count(), 0);
    await detailPage.reload();
    await detailPage.getByTestId('ce-worker-group-detail').waitFor();
    assert.equal(await detailPage.getByText(/blocks left/i).count(), 0);
    const copyLink = detailPage.getByRole('button', { name: 'Copy auto-join link for Participants 2026', exact: true });
    await copyLink.click();
    assert.equal(await detailPage.evaluate(() => navigator.clipboard.readText()), `${baseUrl}/session/${sessionSlug}?joinGroup=${group.groupId}&worker=https%3A%2F%2Fauto-join-worker.example`);
    assert.equal(await detailPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await copyLink.scrollIntoViewIfNeeded();
    const screenshot = path.join(os.tmpdir(), 'ce-worker-group-auto-join-mobile.png');
    await detailPage.screenshot({ path: screenshot });
    console.log(`Mobile screenshot: ${screenshot}`);
    await detailPage.getByRole('link', { name: /back to groups/i }).click();
    await detailPage.getByRole('button', { name: 'Open group details for Participants 2026', exact: true }).waitFor();
    assert.equal(await detailPage.getByText(/blocks left/i).count(), 0);
    const sessionHero = detailPage.getByTestId('ce-worker-groups-session-hero');
    const createGroup = detailPage.getByTestId('ce-sbts-create-toggle');
    const listRefresh = detailPage.getByRole('button', { name: 'Refresh groups', exact: true });
    for (const width of [390, 646, 1280]) {
      await detailPage.setViewportSize({ width, height: 900 });
      for (const creating of [false, true]) {
        if (creating) await createGroup.click();
        const heroBox = await sessionHero.boundingBox();
        for (const control of [createGroup, listRefresh]) {
          const box = await control.boundingBox();
          assert.ok(Math.abs(box.y - heroBox.y) <= 1, `Groups toolbar stays on one row at ${width}px`);
          assert.ok(Math.abs(box.height - heroBox.height) <= 1, `Groups toolbar controls match height at ${width}px`);
          assert.ok(box.height >= 44, 'Toolbar controls retain a usable touch target');
        }
        assert.equal(await listRefresh.evaluate((button) => getComputedStyle(button).borderTopWidth), '0px');
        assert.equal(await detailPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
        if (creating) await createGroup.click();
      }
      await detailPage.screenshot({ path: path.join(os.tmpdir(), `ce-worker-groups-toolbar-${width}.png`) });
    }
    await listRefresh.click();
    await detailPage.getByRole('button', { name: 'Open group details for Participants 2026', exact: true }).waitFor();
    await detailPage.close();
    await page.reload();
    assert.equal(await banner.count(), 0);
    assert.equal(joins, 1);
    // Reopening the invitation recognizes membership without another POST.
    await page.goto(link);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
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
    await page.getByRole('button', { name: 'Log in', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Navigate away before signing in' }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await banner.getByText('Joined Participants 2026.', { exact: true }).waitFor();
    assert.equal(joins, 2);
    assert.equal(new URL(page.url()).pathname, '/about');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('ce:worker-group-auto-join:v1')), null);
    await page.goto(`${baseUrl}/session/${sessionSlug}?joinGroup=${'a'.repeat(80)}`);
    await page.getByRole('button', { name: 'Log in', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    console.log('PASS: Cloudflare auto-join smoke (sign-in, join, cleanup, real app group routes, clean links and refresh, matching toolbar heights, no blockchain progress, detail-only sharing, existing member, cancellation, navigation/refresh before login, mobile layout)');
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
