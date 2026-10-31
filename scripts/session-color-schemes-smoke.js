'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { E2E_TESTIDS } = require('../client/src/utilities/e2eTestIds.js');
const { normalizeBaseUrl } = require('./vite-navigation-smoke');

const WIZARD_CACHE_KEY = 'ce:sessionWizardDraft:v1';

async function readDraft(page) {
  return page.evaluate((cacheKey) => {
    const raw = window.sessionStorage.getItem(cacheKey);
    return raw ? JSON.parse(raw).draft || null : null;
  }, WIZARD_CACHE_KEY);
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.BASE_URL || 'http://127.0.0.1:3000');
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript((cacheKey) => {
      window.localStorage.setItem('ce_onboarding_complete', 'true');
      window.localStorage.removeItem('ce:theme');
      if (!window.sessionStorage.getItem('ce:e2e-session-color-initialized')) {
        window.sessionStorage.removeItem(cacheKey);
        window.sessionStorage.setItem('ce:e2e-session-color-initialized', 'true');
      }
    }, WIZARD_CACHE_KEY);

    const page = await context.newPage();
    await page.goto(`${baseUrl}/session/new`, { waitUntil: 'domcontentloaded' });

    const picker = page.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME);
    await picker.waitFor({ timeout: 30000 });
    await page.getByTestId(`${E2E_TESTIDS.SETUP_MORE_PREFIX}participation`).click();
    const groupCreationPolicy = page.getByTestId(E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY);
    await groupCreationPolicy.waitFor({ timeout: 30000 });

    assert.equal(
      await groupCreationPolicy.inputValue(),
      'participants',
      'Group creation policy starts with the participant default',
    );
    assert.deepEqual(
      await groupCreationPolicy.locator('option').evaluateAll((options) =>
        options.map((option) => ({ value: option.value, label: option.textContent?.trim() }))),
      [
        { value: 'participants', label: 'Anyone in the session' },
        { value: 'admin_only', label: 'Admins only' },
      ],
      'Group creation policy exposes only supported values',
    );
    await groupCreationPolicy.selectOption('admin_only');
    await page.waitForFunction(
      (cacheKey) => {
        const raw = window.sessionStorage.getItem(cacheKey);
        return raw ? JSON.parse(raw).draft?.groupCreationPolicy === 'admin_only' : false;
      },
      WIZARD_CACHE_KEY,
      { timeout: 30000 },
    );
    await groupCreationPolicy.selectOption('participants');
    await page.waitForFunction(
      (cacheKey) => {
        const raw = window.sessionStorage.getItem(cacheKey);
        return raw ? JSON.parse(raw).draft?.groupCreationPolicy === 'participants' : false;
      },
      WIZARD_CACHE_KEY,
      { timeout: 30000 },
    );

    assert.equal(
      await picker.evaluate((element, prefix) => element.closest(`[data-testid^="${prefix}"]`)?.dataset.testid,
        E2E_TESTIDS.SETUP_SECTION_PREFIX),
      `${E2E_TESTIDS.SETUP_SECTION_PREFIX}basics`,
      'The color scheme picker sits in Basics',
    );
    assert.equal(
      await picker.evaluate((element) => element.labels?.[0]?.textContent?.trim()),
      'Colors',
      'The picker uses the documented visible label',
    );
    assert.deepEqual(
      await picker.locator('option').evaluateAll((options) =>
        options.map((option) => ({ value: option.value, label: option.textContent?.trim() }))),
      [
        { value: 'context-engine', label: 'Context Engine' },
        { value: 'ocean', label: 'Ocean' },
        { value: 'amber', label: 'Amber' },
      ],
      'Only curated color schemes are exposed',
    );
    assert.equal(await picker.inputValue(), 'context-engine', 'The picker starts with the fallback scheme');

    await picker.selectOption('ocean');
    await page.waitForFunction(
      (cacheKey) => {
        const raw = window.sessionStorage.getItem(cacheKey);
        const draft = raw ? JSON.parse(raw).draft : null;
        return draft?.appearance?.colorSchemeId === 'ocean' && Object.keys(draft.appearance).length === 1;
      },
      WIZARD_CACHE_KEY,
      { timeout: 30000 },
    );
    assert.deepEqual(
      (await readDraft(page)).appearance,
      { colorSchemeId: 'ocean' },
      'The setup page persists only the stable scheme identifier',
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await picker.waitFor({ timeout: 30000 });
    assert.deepEqual(
      (await readDraft(page)).appearance,
      { colorSchemeId: 'ocean' },
      'The tab-scoped draft retains the stable scheme identifier across reload',
    );
    assert.equal(await picker.inputValue(), 'ocean', 'The selected scheme survives draft recovery');

    console.log('Session color scheme Playwright smoke passed.');
    await context.close();
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
