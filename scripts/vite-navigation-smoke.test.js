'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_ROUTE_TEXT,
  compactSmokeSummary,
  findMissingExpectedText,
  isAllowedConsoleIssue,
  isAllowedFailedRequest,
  isExpectedLoadedMediaAbort,
  normalizeBaseUrl,
  normalizeLayoutProbeSelectors,
  normalizeRoutes,
  resolveViewport,
  routeUrl,
  summarizeFailures,
} = require('./vite-navigation-smoke');

test('normalizeBaseUrl keeps the app origin and removes path/search/hash drift', () => {
  assert.equal(normalizeBaseUrl('http://localhost:3000/foo?bar=baz#hash'), 'http://localhost:3000');
});

test('normalizeRoutes accepts comma-separated routes and adds leading slashes', () => {
  assert.deepEqual(normalizeRoutes('session/demo, /admin'), ['/session/demo', '/admin']);
});

test('resolveViewport supports the maintained mobile smoke alias', () => {
  assert.deepEqual(resolveViewport('mobile'), { width: 390, height: 844 });
  assert.deepEqual(resolveViewport('desktop'), { width: 1440, height: 1000 });
});

test('normalizeLayoutProbeSelectors keeps default browser layout checks and accepts overrides', () => {
  assert.ok(normalizeLayoutProbeSelectors().includes('[data-testid="ce-survey-submit"]'));
  assert.deepEqual(
    normalizeLayoutProbeSelectors('[data-testid="a"], [data-testid="b"]'),
    ['[data-testid="a"]', '[data-testid="b"]']
  );
  assert.deepEqual(
    normalizeLayoutProbeSelectors([' [data-testid="c"] ', '']),
    ['[data-testid="c"]']
  );
});

test('routeUrl joins normalized app URLs and routes', () => {
  assert.equal(routeUrl('http://127.0.0.1:3000', '/session/demo'), 'http://127.0.0.1:3000/session/demo');
});

test('session smoke markers survive both resolving and loaded pe4 shell states', () => {
  const expectedText = DEFAULT_ROUTE_TEXT['/session/pe4'];
  const resolvingState = 'LOG IN Resolving pe4 Session... Questions – Answer or Add Groups – Join or Create Results – View or Save';
  const loadedState = 'LOG IN pe4 Loading... 0s 0 / 0 Groups Join or Create Results View';

  assert.deepEqual(expectedText, ['Groups', 'Results']);
  assert.deepEqual(findMissingExpectedText(resolvingState, expectedText), []);
  assert.deepEqual(findMissingExpectedText(loadedState, expectedText), []);
  assert.deepEqual(findMissingExpectedText('LOG IN pe4 Groups Join or Create', expectedText), ['Results']);
});

test('failed local chain probes are allowed without masking same-origin asset failures', () => {
  const baseUrl = 'http://127.0.0.1:3000';

  assert.equal(isAllowedFailedRequest('http://127.0.0.1:8545/', baseUrl), true);
  assert.equal(isAllowedFailedRequest('http://localhost:8545/', baseUrl), true);
  assert.equal(isAllowedFailedRequest('http://127.0.0.1:3000/src/main.tsx', baseUrl), false);
  assert.equal(isAllowedFailedRequest('http://cdn.example.test/chunk.js', baseUrl), false);
});

test('loaded media aborts are ignored without masking real request failures', () => {
  const loadedMediaUrls = ['http://127.0.0.1:3000/about-demo.mp4'];

  assert.equal(isExpectedLoadedMediaAbort({
    url: loadedMediaUrls[0],
    resourceType: 'media',
    failure: 'net::ERR_ABORTED',
  }, loadedMediaUrls), true);
  assert.equal(isExpectedLoadedMediaAbort({
    url: loadedMediaUrls[0],
    resourceType: 'media',
    failure: 'net::ERR_ABORTED',
  }, []), false);
  assert.equal(isExpectedLoadedMediaAbort({
    url: loadedMediaUrls[0],
    resourceType: 'media',
    failure: 'net::ERR_CONNECTION_REFUSED',
  }, loadedMediaUrls), false);
  assert.equal(isExpectedLoadedMediaAbort({
    url: loadedMediaUrls[0],
    resourceType: 'script',
    failure: 'net::ERR_ABORTED',
  }, loadedMediaUrls), false);
  assert.equal(isExpectedLoadedMediaAbort({
    url: 'http://127.0.0.1:3000/other.mp4',
    resourceType: 'media',
    failure: 'net::ERR_ABORTED',
  }, loadedMediaUrls), false);
});

test('console allowlist permits known dependency warnings but not app exceptions', () => {
  assert.equal(isAllowedConsoleIssue({ type: 'warning', text: 'React Router future flag warning' }), true);
  assert.equal(isAllowedConsoleIssue({ type: 'error', text: 'Warning: defaultProps warning' }), true);
  assert.equal(isAllowedConsoleIssue({ type: 'error', text: 'Failed to load resource: net::ERR_CONNECTION_REFUSED' }), true);
  assert.equal(isAllowedConsoleIssue({ type: 'error', text: 'TypeError: Cannot read properties of undefined' }), false);
});

test('summarizeFailures catches Vite-sensitive render, style, and asset failures', () => {
  const failures = summarizeFailures([
    {
      route: '/session/demo',
      status: 200,
      rootChildren: 0,
      bodyTextLength: 0,
      styleCount: 0,
      missingText: ['Session'],
      badResponses: [{ status: 404, url: 'http://127.0.0.1:3000/src/missing.js' }],
      unexpectedFailedRequests: [{
        resourceType: 'script',
        url: 'http://127.0.0.1:3000/src/main.tsx',
        failure: 'net::ERR_FAILED',
      }],
      unexpectedConsoleIssues: [{ type: 'error', text: 'TypeError: boom' }],
      pageErrors: ['ReferenceError: boom'],
      layoutIssues: ['ce-survey-submit: visible text appears clipped'],
    },
  ]);

  assert.deepEqual(failures, [
    '/session/demo: #root rendered no children',
    '/session/demo: no visible body text',
    '/session/demo: no stylesheet/style tags detected',
    '/session/demo: missing expected text "Session"',
    '/session/demo: 404 http://127.0.0.1:3000/src/missing.js',
    '/session/demo: failed script http://127.0.0.1:3000/src/main.tsx (net::ERR_FAILED)',
    '/session/demo: console error: TypeError: boom',
    '/session/demo: page error: ReferenceError: boom',
    '/session/demo: layout issue: ce-survey-submit: visible text appears clipped',
  ]);
});

test('compactSmokeSummary keeps success output focused on route health', () => {
  assert.deepEqual(compactSmokeSummary({
    baseUrl: 'http://127.0.0.1:3000',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    failures: [],
    results: [{
      route: '/session/demo',
      status: 200,
      rootChildren: 1,
      bodyTextLength: 20,
      bodyTextPreview: 'Session',
      styleCount: 3,
      failedRequests: [{ url: 'http://127.0.0.1:8545/' }],
      unexpectedFailedRequests: [],
      unexpectedConsoleIssues: [],
      pageErrors: [],
      layoutIssues: [],
      missingText: [],
    }],
  }), {
    baseUrl: 'http://127.0.0.1:3000',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    routes: [{
      route: '/session/demo',
      status: 200,
      rootChildren: 1,
      bodyTextLength: 20,
      bodyTextPreview: 'Session',
      styleCount: 3,
      allowedLocalChainFailures: 1,
      unexpectedFailedRequests: 0,
      unexpectedConsoleIssues: 0,
      pageErrors: 0,
      layoutIssues: 0,
      missingText: [],
    }],
    failures: [],
  });
});
