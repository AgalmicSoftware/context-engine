'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { normalizeBaseUrl } = require('./vite-navigation-smoke');

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.BASE_URL || 'http://127.0.0.1:3000');
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      window.localStorage.setItem('ce:theme', 'classic-95');
    });
    const response = await page.goto(`${baseUrl}/about`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('#root', { state: 'attached', timeout: 15000 });
    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const style = window.getComputedStyle(root);
      return {
        themeId: root.dataset.ceTheme || '',
        themeSource: root.dataset.ceThemeSource || '',
        canvas: style.getPropertyValue('--ce-canvas').trim().toLowerCase(),
        radius4: style.getPropertyValue('--ce-radius-4').trim(),
        fontBody: style.getPropertyValue('--ce-font-body').trim().toLowerCase(),
      };
    });

    assert.equal(response?.status(), 200);
    assert.equal(result.themeId, 'classic-95');
    assert.equal(result.themeSource, 'user');
    assert.equal(result.canvas, '#008080');
    assert.equal(result.radius4, '0');
    assert.match(result.fontBody, /tahoma/);
    console.log('App theme runtime Playwright smoke passed.');
    await page.close();
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
