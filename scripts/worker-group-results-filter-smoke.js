'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3112';
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="root"></div><script type="module" src="/src/test-smoke/workerGroupResultsSmokeEntry.tsx"></script></body></html>`;
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 646, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let denied = false,
      reads = 0;
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseUrl).origin)
        return url.pathname === '/session/group-results-smoke'
          ? route.fulfill({ contentType: 'text/html', body: html })
          : route.continue();
      if (url.origin === 'https://group-results-worker.example') {
        const group = {
          groupId: 'eddy-2026',
          label: 'EDDY-2026',
          sessionSlug: 'group-results-smoke',
          joinMode: 'open',
          memberVisibility: 'session',
        };
        const payload = { ok: true, sessionSlug: group.sessionSlug, sessionId: '0x' + '4'.repeat(32) };
        if (url.pathname === '/groups/list') payload.groups = [group];
        if (url.pathname === '/groups/my-memberships') payload.memberships = [];
        if (url.pathname === '/groups/members') {
          reads++;
          if (denied)
            return route.fulfill({
              status: 403,
              contentType: 'application/json',
              body: JSON.stringify({ ...payload, ok: false, reason: 'worker_group_member_list_forbidden' }),
            });
          Object.assign(payload, {
            group,
            members: [
              {
                groupId: group.groupId,
                sessionSlug: group.sessionSlug,
                principal: { kind: 'passkey_account', address: '0x' + 'a'.repeat(40) },
              },
            ],
            memberCount: 1,
            nextCursor: '',
          });
        }
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
      }
      return route.abort();
    });
    await page.goto(`${baseUrl}/session/group-results-smoke`);
    await page.getByText('Member-only feedback', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Question results', exact: true }).click();
    await page.locator('.modal.show').waitFor();
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await page.getByTestId('ce-results-group-filter-toggle').click();
    await page.getByLabel('Include responders', { exact: true }).selectOption('eddy-2026');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="ce-results-group-filter"] select')?.disabled,
    );
    await page.getByLabel('Remove EDDY-2026 from include responders').waitFor();
    // The question-results filter is the same state supplied to the actual PolisReport.
    await page.waitForFunction(() => !document.body.innerText.includes('Outside feedback'));
    assert.ok(reads > 0);
    await page.getByLabel('Exclude responders', { exact: true }).selectOption('eddy-2026');
    await page.waitForFunction(() => !document.body.innerText.includes('Member-only feedback'));
    await page.getByRole('button', { name: 'Clear Group filters' }).click();
    await page.getByLabel('Include responders', { exact: true }).selectOption('eddy-2026');
    await page.waitForFunction(() => !document.body.innerText.includes('Outside feedback'));
    await page.waitForFunction(() => !document.querySelector('[aria-label="Include responders"]')?.disabled);
    await page.getByLabel('Include responders', { exact: true }).waitFor({ state: 'visible' });
    await page.getByLabel('Include responders', { exact: true }).scrollIntoViewIfNeeded();
    await page.getByLabel('Include responders', { exact: true }).click({ trial: true });
    assert.equal(
      await page.getByTestId('ce-results-group-filter').evaluate((node) => {
        const panel = node.closest('[class*="questionFilterInline"]');
        return panel && getComputedStyle(panel).overflowY === 'auto' && panel.scrollHeight > panel.clientHeight;
      }),
      true,
    );
    await page.screenshot({ path: '/tmp/ce-worker-group-filter-page.png', animations: 'disabled' });
    denied = true;
    await page.getByRole('button', { name: 'Refresh Groups', exact: true }).click();
    await page
      .getByText(/do not have permission/)
      .first()
      .waitFor();
    for (const width of [390, 646, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      const controls = page.getByTestId('ce-results-group-filter');
      assert.ok(await controls.isVisible());
      assert.equal(await controls.evaluate((node) => node.scrollWidth > node.clientWidth), false);
      await page.getByRole('button', { name: 'Refresh Groups', exact: true }).click({ trial: true });
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS: native Group controls, inclusion/exclusion, cleared filters, question results → PolisReport, permission failures, responsive layout',
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
