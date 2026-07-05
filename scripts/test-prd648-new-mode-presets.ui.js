'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { normalizeBaseUrl } = require('./vite-navigation-smoke');

const WIZARD_CACHE_KEY = 'ce:sessionWizardDraft:v1';

async function readCachedDraft(page) {
  return page.evaluate((cacheKey) => {
    const raw = window.localStorage.getItem(cacheKey);
    return raw ? JSON.parse(raw).draft || null : null;
  }, WIZARD_CACHE_KEY);
}

async function waitForDraft(page, predicateSource, description) {
  await page.waitForFunction(({ cacheKey, source }) => {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return false;
    const draft = JSON.parse(raw).draft || null;
    const predicate = new Function('draft', `return (${source})(draft);`);
    return !!predicate(draft);
  }, {
    cacheKey: WIZARD_CACHE_KEY,
    source: predicateSource,
  }, { timeout: 30000 });

  const draft = await readCachedDraft(page);
  assert.ok(draft, description);
  return draft;
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.BASE_URL || 'http://127.0.0.1:3000');
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript((cacheKey) => {
      window.localStorage.removeItem(cacheKey);
      window.sessionStorage.clear();
    }, WIZARD_CACHE_KEY);

    const page = await context.newPage();
    await page.goto(`${baseUrl}/new`, { waitUntil: 'domcontentloaded' });

    const continueButton = page.getByTestId('ce-new-preset-continue');
    const fastPreset = page.getByTestId('ce-new-preset-fast_cheap_cloudflare');
    const trustlessPreset = page.getByTestId('ce-new-preset-trustless_public_decentralized');

    await continueButton.waitFor({ timeout: 30000 });
    assert.equal(await continueButton.isDisabled(), true, 'Continue is disabled before choosing a preset');
    assert.equal(await fastPreset.getAttribute('aria-checked'), 'false', 'Fast preset starts unselected');
    assert.equal(await trustlessPreset.getAttribute('aria-checked'), 'false', 'Trustless preset starts unselected');

    await fastPreset.click();
    assert.equal(await continueButton.isEnabled(), true, 'Continue is enabled after choosing a preset');
    assert.equal(await fastPreset.getAttribute('aria-checked'), 'true', 'Fast preset becomes selected');
    let draft = await waitForDraft(
      page,
      "(draft) => draft?.sessionModeProfile?.preset === 'fast_cheap_cloudflare' && draft?.storageProfile?.backend === 'cloudflare'",
      'Fast preset profile is written to the wizard draft'
    );
    assert.equal(draft.sessionModeProfile.storage.backend, 'cloudflare', 'Fast preset uses Cloudflare storage');
    assert.equal(draft.sessionModeProfile.surfaces.telegram, false, 'Fast preset starts without Telegram surface');

    await page.getByRole('button', { name: /Advanced options/i }).click();
    await page.getByLabel('Telegram').check();
    draft = await waitForDraft(
      page,
      "(draft) => draft?.sessionModeProfile?.preset === 'custom' && draft?.sessionModeProfile?.surfaces?.telegram === true && draft?.sessionModeProfile?.surfaces?.miniApp === true",
      'Advanced surface override flips the preset to custom'
    );
    assert.equal(draft.sessionModeProfile.preset, 'custom', 'Advanced override marks the profile as custom');
    await page.getByText('Custom', { exact: true }).first().waitFor({ timeout: 30000 });

    const dialogPromise = page.waitForEvent('dialog');
    const clickPromise = trustlessPreset.click();
    const dialog = await dialogPromise;
    assert.match(dialog.message(), /Switch preset and replace incompatible advanced settings/i);
    await dialog.accept();
    await clickPromise;

    assert.equal(await trustlessPreset.getAttribute('aria-checked'), 'true', 'Trustless preset is selected after confirmation');
    draft = await waitForDraft(
      page,
      "(draft) => draft?.sessionModeProfile?.preset === 'trustless_public_decentralized' && draft?.sessionModeProfile?.storage?.backend === 'arweave'",
      'Preset switch after custom config writes the selected trustless profile'
    );
    assert.equal(draft.sessionModeProfile.authority.mode, 'evm_registry_canonical', 'Trustless preset uses registry authority');
    assert.equal(draft.sessionModeProfile.surfaces.telegram, false, 'Preset switch resets the advanced Telegram override');

    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      checks: [
        'no default preset',
        'gated Continue',
        'Fast & Cheap profile draft write',
        'advanced override flips to custom',
        'preset switch confirmation',
      ],
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
