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
    await page.getByTestId('ce-new-preset-fast_cheap_cloudflare').click();

    const picker = page.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME);
    const preview = page.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_PREVIEW);
    await picker.waitFor({ timeout: 30000 });

    assert.equal(
      await page.getByText('Session colors', { exact: true }).count(),
      1,
      'Session colors appears as a primary Wizard section',
    );
    assert.equal(
      await picker.evaluate((element) => element.labels?.[0]?.textContent?.trim()),
      'Color scheme',
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
    assert.equal(
      await preview.getAttribute('data-ce-color-scheme-id'),
      'context-engine',
      'The preview starts with the fallback scheme',
    );

    await picker.selectOption('ocean');
    await page.waitForFunction(
      ({ previewId, cacheKey }) => {
        const previewElement = document.querySelector(`[data-testid="${previewId}"]`);
        const raw = window.sessionStorage.getItem(cacheKey);
        const draft = raw ? JSON.parse(raw).draft : null;
        return (
          previewElement?.getAttribute('data-ce-color-scheme-id') === 'ocean' &&
          draft?.appearance?.colorSchemeId === 'ocean' &&
          Object.keys(draft.appearance).length === 1
        );
      },
      { previewId: E2E_TESTIDS.WIZARD_SESSION_COLOR_PREVIEW, cacheKey: WIZARD_CACHE_KEY },
      { timeout: 30000 },
    );
    assert.deepEqual(
      (await readDraft(page)).appearance,
      { colorSchemeId: 'ocean' },
      'The Wizard persists only the stable scheme identifier',
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    assert.deepEqual(
      (await readDraft(page)).appearance,
      { colorSchemeId: 'ocean' },
      'The tab-scoped draft retains the stable scheme identifier across reload',
    );
    await page.getByTestId('ce-new-preset-fast_cheap_cloudflare').click();
    await page.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME).waitFor({ timeout: 30000 });
    assert.equal(
      await page.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_PREVIEW).getAttribute('data-ce-color-scheme-id'),
      'ocean',
      'The selected scheme and preview survive Wizard draft recovery',
    );

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
