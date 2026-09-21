'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_ROUTE_PROBES,
  DEFAULT_ROUTES,
  DEFAULT_ROUTE_TEXT,
  compactSmokeSummary,
  dismissOnboardingIfPresent,
  findMissingExpectedText,
  installDemoWorkerFixtureRoutes,
  isAllowedConsoleIssue,
  isAllowedFailedRequest,
  isDemoReadyInterviewRoute,
  isDemoStorageListFixtureRequest,
  isExpectedLoadedMediaAbort,
  isLocalSmokeBaseUrl,
  normalizeBaseUrl,
  normalizeLayoutProbeSelectors,
  normalizeRoutes,
  probeBenchmarkReportFrame,
  probeSessionModePresets,
  resolveViewport,
  routeUrl,
  runRouteProbe,
  summarizeFailures,
} = require('./vite-navigation-smoke');

test('default navigation smoke covers session modes, Docs, its legacy contracts alias, and benchmarks', () => {
  assert.ok(DEFAULT_ROUTES.includes('/new'));
  assert.equal(DEFAULT_ROUTE_PROBES['/new'], probeSessionModePresets);
  assert.equal(DEFAULT_ROUTE_PROBES['/benchmarks'], probeBenchmarkReportFrame);
  assert.ok(DEFAULT_ROUTES.includes('/docs'));
  assert.ok(DEFAULT_ROUTES.includes('/contracts'));
  assert.ok(DEFAULT_ROUTES.includes('/benchmarks'));
  assert.deepEqual(DEFAULT_ROUTE_TEXT['/docs'], ['Docs']);
  assert.deepEqual(DEFAULT_ROUTE_TEXT['/contracts'], ['Docs']);
  assert.equal(DEFAULT_ROUTE_TEXT['/benchmarks'], undefined);
});

test('session mode probe selects both supported presets', async () => {
  const selected = new Map();
  const presetIds = ['fast_cheap_cloudflare', 'trustless_public_decentralized'];
  const page = {
    getByTestId: (testId) => {
      if (testId === 'ce-onboarding-overlay') {
        return { count: async () => 0 };
      }
      const presetId = testId.replace('ce-new-preset-', '');
      assert.ok(presetIds.includes(presetId));
      return {
        waitFor: async ({ state, timeout }) => {
          assert.equal(state, 'visible');
          assert.equal(timeout, 1234);
        },
        click: async () => {
          presetIds.forEach((id) => selected.set(id, id === presetId));
        },
        getAttribute: async (name) => {
          assert.equal(name, 'aria-checked');
          return selected.get(presetId) ? 'true' : 'false';
        },
      };
    },
    once: (eventName, handler) => {
      assert.equal(eventName, 'dialog');
      handler({ accept: async () => {} });
    },
  };

  assert.deepEqual(await probeSessionModePresets(page, { timeoutMs: 1234 }), []);
  assert.equal(selected.get('trustless_public_decentralized'), true);
});

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

test('demo Worker smoke fixtures are local-only and match exact storage-list resources', () => {
  assert.equal(isLocalSmokeBaseUrl('http://127.0.0.1:3100'), true);
  assert.equal(isLocalSmokeBaseUrl('http://localhost:3100/path'), true);
  assert.equal(isLocalSmokeBaseUrl('https://contextengine.xyz'), false);

  assert.equal(
    isDemoStorageListFixtureRequest(
      'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev/storage/list?resource=questions&limit=100',
    ),
    true,
  );
  assert.equal(
    isDemoStorageListFixtureRequest(
      'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev/storage/read?id=question-1',
    ),
    false,
  );
  assert.equal(
    isDemoStorageListFixtureRequest(
      'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev/storage/list?resource=groups&limit=100',
    ),
    false,
  );
  assert.equal(
    isDemoStorageListFixtureRequest('https://other-worker.example/storage/list?resource=questions'),
    false,
  );
});

test('demo interview ready fixture requires the explicit Worker discovery route', () => {
  const worker = encodeURIComponent('https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev');
  assert.equal(isDemoReadyInterviewRoute(`/session/demo?mode=interview&worker=${worker}`), true);
  assert.equal(isDemoReadyInterviewRoute('/session/demo?mode=interview'), false);
  assert.equal(isDemoReadyInterviewRoute(`/session/demo?mode=recordGroup&worker=${worker}`), false);
});

test('both session setup aliases receive the pinned demo cache fixture in local smoke', async () => {
  for (const route of ['/new', '/session/new', '/session/new?mode=interview']) {
    const handlers = [];
    await installDemoWorkerFixtureRoutes({ route: async (pattern, handler) => handlers.push({ pattern, handler }) },
      'http://127.0.0.1:4173', route);
    assert.equal(handlers.length, 1, `${route} should isolate the unrelated demo cache`);
    assert.equal(handlers[0].pattern, 'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev/storage/list?*');
    let response;
    await handlers[0].handler({
      request: () => ({ url: () => 'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev/storage/list?resource=questions&limit=100' }),
      fulfill: async (value) => { response = value; },
      fallback: async () => assert.fail('the pinned question list should use the fixture'),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body), { items: [], listComplete: true });
  }
  assert.equal(DEFAULT_ROUTE_PROBES['/session/new'], probeSessionModePresets);
});

test('setup fixture preserves live Worker checks and unrelated session routes', async () => {
  const page = { route: async () => assert.fail('no fixture should be installed') };
  await installDemoWorkerFixtureRoutes(page, 'https://contextengine.sh', '/session/new');
  await installDemoWorkerFixtureRoutes(page, 'https://contextengine.sh', '/new');
  await installDemoWorkerFixtureRoutes(page, 'http://127.0.0.1:4173', '/session/new-project');
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

test('runRouteProbe normalizes reported failures and fails closed on probe errors', async () => {
  const page = { marker: 'page' };
  const context = { route: '/session/demo-2' };

  assert.deepEqual(
    await runRouteProbe(page, async (receivedPage, receivedContext) => {
      assert.equal(receivedPage, page);
      assert.equal(receivedContext, context);
      return [' missing Breakdown guard ', '', null];
    }, context),
    ['missing Breakdown guard'],
  );
  assert.deepEqual(
    await runRouteProbe(page, async () => {
      throw new Error('results did not hydrate');
    }, context),
    ['results did not hydrate'],
  );
  assert.deepEqual(await runRouteProbe(page, null, context), []);
});

test('demo results probe dismisses first-run onboarding before clicking covered controls', async () => {
  const calls = [];
  const overlay = {
    count: async () => 1,
    getByRole: (role, options) => {
      assert.equal(role, 'button');
      assert.match('Skip', options.name);
      return { click: async () => calls.push('skip') };
    },
    waitFor: async (options) => calls.push(`wait:${options.state}:${options.timeout}`),
  };

  await dismissOnboardingIfPresent({ getByTestId: () => overlay }, { timeoutMs: 1234 });

  assert.deepEqual(calls, ['skip', 'wait:detached:1234']);
});

test('demo results probe leaves an already-complete onboarding state untouched', async () => {
  let lookedForSkip = false;
  const overlay = {
    count: async () => 0,
    getByRole: () => {
      lookedForSkip = true;
    },
  };

  await dismissOnboardingIfPresent({ getByTestId: () => overlay }, { timeoutMs: 1234 });

  assert.equal(lookedForSkip, false);
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

test('console allowlist mirrors the failed-request exception for the optional local chain', () => {
  assert.equal(
    isAllowedConsoleIssue({
      type: 'error',
      text: "Access to fetch at 'http://127.0.0.1:8545/' from origin 'http://127.0.0.1:4173' has been blocked by CORS policy: No access control header.",
    }),
    true,
  );
  assert.equal(
    isAllowedConsoleIssue({
      type: 'error',
      text: "Access to fetch at 'http://127.0.0.1:4173/api' from origin 'http://127.0.0.1:4173' has been blocked by CORS policy",
    }),
    false,
  );
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
      routeProbeFailures: ['results did not hydrate'],
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
    '/session/demo: route probe: results did not hydrate',
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
      routeProbeFailures: [],
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
      routeProbeFailures: 0,
      layoutIssues: 0,
      missingText: [],
    }],
    failures: [],
  });
});
