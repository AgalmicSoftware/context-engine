'use strict';

const { URL } = require('node:url');

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_ROUTES = Object.freeze([
  '/session/demo',
  '/session/pe4',
  '/admin',
  '/about',
  '/contracts',
]);
const DEFAULT_ROUTE_TEXT = Object.freeze({
  '/session/demo': ['Session'],
  '/session/pe4': ['Groups', 'Results'],
  '/admin': ['Session Admin'],
  '/about': ['Context Engine'],
  '/contracts': ['Contract'],
});
const DEFAULT_LAYOUT_PROBE_SELECTORS = Object.freeze([
  '[data-testid="ce-survey-submit"]',
  '[data-testid="ce-create-submit"]',
  '[data-testid="ce-doc-upload-file-button"]',
  '[data-testid="ce-doc-url-add-button"]',
  '[data-testid="ce-doc-lock-toggle"]',
  '[data-testid="ce-session-listening-start"]',
  '[data-testid="ce-session-listening-stop"]',
]);

function normalizeBaseUrl(rawBaseUrl = DEFAULT_BASE_URL) {
  const url = new URL(rawBaseUrl);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function normalizeRoutes(rawRoutes = process.env.SMOKE_ROUTES) {
  const routes = rawRoutes
    ? rawRoutes.split(',').map((route) => route.trim()).filter(Boolean)
    : DEFAULT_ROUTES;

  return routes.map((route) => (route.startsWith('/') ? route : `/${route}`));
}

function resolveViewport(rawViewport = process.env.PLAYWRIGHT_VIEWPORT) {
  if (rawViewport === 'mobile') {
    return { width: 390, height: 844 };
  }

  return { width: 1440, height: 1000 };
}

function normalizeLayoutProbeSelectors(rawSelectors = process.env.SMOKE_LAYOUT_PROBE_SELECTORS) {
  if (Array.isArray(rawSelectors)) {
    return rawSelectors.map((selector) => String(selector || '').trim()).filter(Boolean);
  }
  const raw = String(rawSelectors || '').trim();
  if (!raw) return [...DEFAULT_LAYOUT_PROBE_SELECTORS];
  return raw.split(',').map((selector) => selector.trim()).filter(Boolean);
}

function isAllowedFailedRequest(requestUrl, baseUrl) {
  let parsed;
  try {
    parsed = new URL(requestUrl);
  } catch (_error) {
    return false;
  }

  const base = new URL(baseUrl);
  if (parsed.origin === base.origin) {
    return false;
  }

  return (
    (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
    parsed.port === '8545'
  );
}

function isAllowedConsoleIssue(issue) {
  if (issue.type === 'warning') {
    return true;
  }

  return (
    issue.text.startsWith('Warning: ') ||
    issue.text.startsWith('Failed to load resource:')
  );
}

function routeUrl(baseUrl, route) {
  return `${baseUrl}${route}`;
}

function findMissingExpectedText(bodyText, expectedText = []) {
  const normalizedBodyText = String(bodyText || '').toLowerCase();
  return expectedText
    .filter((text) => !normalizedBodyText.includes(String(text).toLowerCase()));
}

async function inspectRoute(browser, baseUrl, route, options = {}) {
  const page = await browser.newPage({ viewport: options.viewport || resolveViewport() });
  const consoleIssues = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleIssues.push({
        type: msg.type(),
        text: msg.text(),
      });
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText || 'unknown request failure',
      resourceType: request.resourceType(),
    });
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && new URL(url).origin === new URL(baseUrl).origin) {
      badResponses.push({
        url,
        status,
        resourceType: response.request().resourceType(),
      });
    }
  });

  const response = await page.goto(routeUrl(baseUrl, route), {
    waitUntil: 'domcontentloaded',
    timeout: options.timeoutMs || 30000,
  });
  await page.waitForSelector('#root', { state: 'attached', timeout: options.timeoutMs || 15000 });
  await page.waitForTimeout(options.settleMs || 2500);

  const layoutProbeSelectors = options.layoutProbeSelectors || normalizeLayoutProbeSelectors();
  const info = await page.evaluate((selectors) => {
    const root = document.querySelector('#root');
    const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
    const styleTags = document.querySelectorAll('style').length;
    const linkedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((link) => link.href);
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const isInViewport = (rect) => (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < viewportHeight &&
      rect.left < viewportWidth
    );
    const labelFor = (element, selector) => (
      element.getAttribute('data-testid') ||
      element.getAttribute('aria-label') ||
      element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) ||
      selector
    );
    const layoutIssues = [];

    (Array.isArray(selectors) ? selectors : []).forEach((selector) => {
      let elements = [];
      try {
        elements = Array.from(document.querySelectorAll(selector));
      } catch (_error) {
        layoutIssues.push(`${selector}: invalid layout probe selector`);
        return;
      }
      elements.forEach((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) === 0) return;
        const rect = element.getBoundingClientRect();
        if (!isInViewport(rect)) return;

        const label = labelFor(element, selector);
        if (rect.width < 1 || rect.height < 1) {
          layoutIssues.push(`${label}: visible control has a zero-sized box`);
          return;
        }
        const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
        const clipsInlineText = (
          text &&
          (style.overflowX === 'hidden' || style.textOverflow === 'ellipsis') &&
          element.scrollWidth > Math.ceil(rect.width) + 2
        );
        const clipsBlockText = (
          text &&
          style.overflowY === 'hidden' &&
          element.scrollHeight > Math.ceil(rect.height) + 2
        );
        if (clipsInlineText || clipsBlockText) {
          layoutIssues.push(`${label}: visible text appears clipped`);
        }
      });
    });

    return {
      title: document.title,
      rootChildren: root ? root.children.length : 0,
      bodyTextLength: bodyText.length,
      bodyTextPreview: bodyText.slice(0, 240),
      styleCount: styleTags + linkedStyles.length,
      layoutIssues,
    };
  }, layoutProbeSelectors);

  await page.close();

  const unexpectedFailedRequests = failedRequests
    .filter((request) => !isAllowedFailedRequest(request.url, baseUrl));
  const unexpectedConsoleIssues = consoleIssues
    .filter((issue) => !isAllowedConsoleIssue(issue));
  const expectedText = options.expectedText?.[route] || DEFAULT_ROUTE_TEXT[route] || [];
  const missingText = findMissingExpectedText(info.bodyTextPreview, expectedText);

  return {
    route,
    status: response?.status() || null,
    ...info,
    badResponses,
    failedRequests,
    unexpectedFailedRequests,
    consoleIssues,
    unexpectedConsoleIssues,
    pageErrors,
    missingText,
  };
}

function summarizeFailures(results) {
  const failures = [];

  results.forEach((result) => {
    if (result.status !== 200) {
      failures.push(`${result.route}: document status ${result.status}`);
    }
    if (result.rootChildren < 1) {
      failures.push(`${result.route}: #root rendered no children`);
    }
    if (result.bodyTextLength < 1) {
      failures.push(`${result.route}: no visible body text`);
    }
    if (result.styleCount < 1) {
      failures.push(`${result.route}: no stylesheet/style tags detected`);
    }
    result.missingText.forEach((text) => {
      failures.push(`${result.route}: missing expected text "${text}"`);
    });
    result.badResponses.forEach((response) => {
      failures.push(`${result.route}: ${response.status} ${response.url}`);
    });
    result.unexpectedFailedRequests.forEach((request) => {
      failures.push(`${result.route}: failed ${request.resourceType} ${request.url} (${request.failure})`);
    });
    result.unexpectedConsoleIssues.forEach((issue) => {
      failures.push(`${result.route}: console ${issue.type}: ${issue.text}`);
    });
    result.pageErrors.forEach((error) => {
      failures.push(`${result.route}: page error: ${error}`);
    });
    (result.layoutIssues || []).forEach((issue) => {
      failures.push(`${result.route}: layout issue: ${issue}`);
    });
  });

  return failures;
}

function compactSmokeSummary(summary) {
  return {
    baseUrl: summary.baseUrl,
    browserName: summary.browserName,
    viewport: summary.viewport,
    routes: summary.results.map((result) => ({
      route: result.route,
      status: result.status,
      rootChildren: result.rootChildren,
      bodyTextLength: result.bodyTextLength,
      bodyTextPreview: result.bodyTextPreview,
      styleCount: result.styleCount,
      allowedLocalChainFailures: result.failedRequests.length - result.unexpectedFailedRequests.length,
      unexpectedFailedRequests: result.unexpectedFailedRequests.length,
      unexpectedConsoleIssues: result.unexpectedConsoleIssues.length,
      pageErrors: result.pageErrors.length,
      layoutIssues: (result.layoutIssues || []).length,
      missingText: result.missingText,
    })),
    failures: summary.failures,
  };
}

async function runSmoke(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || process.env.BASE_URL || DEFAULT_BASE_URL);
  const routes = options.routes || normalizeRoutes();
  const browserName = options.browserName || process.env.PLAYWRIGHT_BROWSER || 'chromium';
  const viewport = options.viewport || resolveViewport();
  const { [browserName]: browserType } = require('playwright');

  if (!browserType) {
    throw new Error(`Unsupported PLAYWRIGHT_BROWSER "${browserName}"`);
  }

  const browser = await browserType.launch({ headless: true });
  try {
    const results = [];
    for (const route of routes) {
      results.push(await inspectRoute(browser, baseUrl, route, {
        expectedText: options.expectedText,
        settleMs: options.settleMs,
        timeoutMs: options.timeoutMs,
        viewport,
        layoutProbeSelectors: options.layoutProbeSelectors,
      }));
    }

    return {
      baseUrl,
      browserName,
      viewport,
      results,
      failures: summarizeFailures(results),
    };
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runSmoke()
    .then((summary) => {
      const output = (process.env.SMOKE_VERBOSE === '1' || summary.failures.length)
        ? summary
        : compactSmokeSummary(summary);
      console.log(JSON.stringify(output, null, 2));
      if (summary.failures.length) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_LAYOUT_PROBE_SELECTORS,
  DEFAULT_ROUTES,
  DEFAULT_ROUTE_TEXT,
  compactSmokeSummary,
  findMissingExpectedText,
  inspectRoute,
  isAllowedConsoleIssue,
  isAllowedFailedRequest,
  normalizeBaseUrl,
  normalizeLayoutProbeSelectors,
  normalizeRoutes,
  resolveViewport,
  routeUrl,
  runSmoke,
  summarizeFailures,
};
