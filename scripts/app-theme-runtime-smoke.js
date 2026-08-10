'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { normalizeBaseUrl } = require('./vite-navigation-smoke');

const ROUTE_CASES = Object.freeze([
  { path: '/about', label: 'about lazy route' },
  { path: '/session/new', label: 'Session Wizard', requiresSessionColors: true },
  { path: '/docs', label: 'docs lazy route' },
  { path: '/demos', label: 'demo surface' },
  { path: '/theme-smoke-not-found', label: 'not-found state' },
]);

const VIEWPORTS = Object.freeze([
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]);

const readThemeState = () => {
  const root = document.documentElement;
  const style = window.getComputedStyle(root);
  const probe = document.createElement('div');
  probe.className = 'modal-content';
  probe.style.position = 'fixed';
  probe.style.left = '-10000px';
  probe.textContent = 'theme probe';
  document.body.appendChild(probe);
  const probeStyle = window.getComputedStyle(probe);
  const state = {
    themeId: root.dataset.ceTheme || '',
    themeSource: root.dataset.ceThemeSource || '',
    canvas: style.getPropertyValue('--ce-canvas').trim().toLowerCase(),
    radius4: style.getPropertyValue('--ce-radius-4').trim(),
    fontBody: style.getPropertyValue('--ce-font-body').trim().toLowerCase(),
    modalBackground: probeStyle.backgroundColor,
    modalRadius: probeStyle.borderRadius,
  };
  probe.remove();
  return state;
};

async function inspectRoute(page, baseUrl, routeCase, viewportName) {
  const response = await page.goto(`${baseUrl}${routeCase.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector('#root', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 15000 });

  if (routeCase.requiresSessionColors) {
    await page.getByTestId('ce-new-preset-fast_cheap_cloudflare').click();
    await page.waitForSelector('[data-testid="ce-wizard-session-color-scheme"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ce-wizard-session-color-preview"]', { timeout: 15000 });
  }

  const classic = await page.evaluate(readThemeState);
  const routeState = await page.evaluate(() => {
    const root = document.querySelector('#root');
    const preview = document.querySelector('[data-testid="ce-wizard-session-color-preview"]');
    const rootRect = root?.getBoundingClientRect();
    const overflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    return {
      rootWidth: rootRect?.width || 0,
      overflow,
      sessionPreviewAccent: preview
        ? window.getComputedStyle(preview).getPropertyValue('--ce-session-accent').trim()
        : '',
    };
  });

  await page.evaluate(() => {
    document.documentElement.dataset.ceTheme = 'context-engine';
    window.dispatchEvent(new CustomEvent('ce:theme-change', { detail: { id: 'context-engine', source: 'user' } }));
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const current = await page.evaluate(readThemeState);

  assert.equal(response?.status(), 200, `${routeCase.label} should load in ${viewportName}`);
  assert.equal(classic.themeId, 'classic-95', `${routeCase.label} should bootstrap the stored theme`);
  assert.equal(classic.themeSource, 'user', `${routeCase.label} should preserve user-theme precedence`);
  assert.equal(classic.canvas, '#008080', `${routeCase.label} should receive the Classic 95 palette`);
  assert.equal(classic.radius4, '0', `${routeCase.label} should receive square Classic 95 geometry`);
  assert.match(classic.fontBody, /tahoma/, `${routeCase.label} should receive Classic 95 typography`);
  assert.equal(current.themeId, 'context-engine', `${routeCase.label} should switch without a reload`);
  assert.equal(current.canvas, '#20204e', `${routeCase.label} should repaint to the Context Engine palette`);
  assert.equal(current.radius4, '4px', `${routeCase.label} should repaint rounded geometry`);
  assert.match(current.fontBody, /poppins/, `${routeCase.label} should repaint typography`);
  assert.notEqual(classic.modalBackground, current.modalBackground, `${routeCase.label} modal chrome should repaint`);
  assert.notEqual(classic.modalRadius, current.modalRadius, `${routeCase.label} modal geometry should repaint`);
  assert.ok(routeState.rootWidth > 0, `${routeCase.label} should render a visible app root`);
  assert.ok(routeState.overflow <= 4, `${routeCase.label} should not overflow the ${viewportName} viewport`);
  if (routeCase.requiresSessionColors) {
    assert.ok(routeState.sessionPreviewAccent, 'Session Wizard preview should expose its scoped accent immediately');
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.BASE_URL || 'http://127.0.0.1:3000');
  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      await page.addInitScript(() => {
        window.localStorage.setItem('ce_onboarding_complete', 'true');
        window.localStorage.setItem('ce:theme', 'classic-95');
      });
      for (const routeCase of ROUTE_CASES) {
        await inspectRoute(page, baseUrl, routeCase, viewport.name);
      }
      await page.close();
    }
    console.log(
      `App theme runtime Playwright smoke passed (${ROUTE_CASES.length} routes × ${VIEWPORTS.length} viewports).`,
    );
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
