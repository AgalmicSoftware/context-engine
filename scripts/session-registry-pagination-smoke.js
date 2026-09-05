'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { ethers } = require('ethers');
const registryAbi = require('../client/src/contractsABI/SESSION_REGISTRY_ABI.json');
const { normalizeBaseUrl } = require('./vite-navigation-smoke');

const registryInterface = new ethers.utils.Interface(registryAbi);
const cacheKey = 'dg:sessionRegistryCache:v1';
const fixtureSlug = index => `pagination-fixture-${String(index).padStart(3, '0')}`;

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.BASE_URL || 'http://127.0.0.1:3000');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const surface of ['admin', 'sponsor']) {
      const context = await browser.newContext();
      await context.addInitScript(() => localStorage.setItem('ce_onboarding_complete', 'true'));
      const requestedIndices = [];
      await context.route('**/*', async route => {
        if (new URL(route.request().url()).origin === new URL(baseUrl).origin) return route.continue();
        let payload;
        try { payload = route.request().postDataJSON(); } catch (_) { /* Non-RPC read. */ }
        if (!payload?.method) return route.fulfill({ status: 200, json: { items: [] } });
        let result = '0x0';
        if (payload.method === 'eth_chainId') result = '0xaa37dc';
        if (payload.method === 'eth_blockNumber') result = '0x1';
        if (payload.method === 'eth_call') {
          try {
            const call = registryInterface.parseTransaction({ data: payload.params[0].data });
            let values;
            switch (call.name) {
              case 'getSessionCount': values = [101]; break;
              case 'getSessionSlugByIndex': {
                const index = call.args[0].toNumber();
                requestedIndices.push(index);
                values = [fixtureSlug(index)];
                break;
              }
              case 'getSessionBySlug': values = [call.args[0], 11155420, '', '', ethers.constants.AddressZero, 1, 1, ethers.constants.HashZero.slice(0, 34)]; break;
              case 'getResourceGate': values = [[], 11155420, 0, 0]; break;
              case 'getSessionFields': values = [call.args[1].map(() => '')]; break;
              case 'getSessionField': values = ['']; break;
              case 'sessionExists': values = [true]; break;
              default: throw new Error(`Unconfigured fixture method: ${call.name}`);
            }
            result = registryInterface.encodeFunctionResult(call.name, values);
          } catch (error) {
            return route.fulfill({ json: { jsonrpc: '2.0', id: payload.id, error: { code: -32000, message: error.message } } });
          }
        }
        return route.fulfill({ json: { jsonrpc: '2.0', id: payload.id, result } });
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/${surface}`, { waitUntil: 'domcontentloaded' });
      const older = page.getByTestId(`ce-${surface}-load-older`);
      await older.waitFor({ timeout: 60000 });
      const readSlugs = () => page.evaluate(key => Object.keys(JSON.parse(localStorage.getItem(key) || '{}').sessions || {}).filter(slug => slug.startsWith('pagination-fixture-')), cacheKey);
      assert.equal((await readSlugs()).length, 100, `${surface}: first page is bounded`);
      assert.equal(requestedIndices[0], 100, `${surface}: newest index requested first`);
      assert.ok(!requestedIndices.includes(0), `${surface}: oldest entry is deferred`);
      await older.click();
      await older.waitFor({ state: 'detached', timeout: 60000 });
      assert.deepEqual((await readSlugs()).sort(), Array.from({ length: 101 }, (_, index) => fixtureSlug(index)));
      assert.ok(requestedIndices.includes(0), `${surface}: oldest page loaded`);
      process.stdout.write(`${surface}: newest 100, Load older, and retained 101 sessions passed\n`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
