'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { ethers } = require('ethers');
const registryAbi = require('../client/src/contractsABI/SESSION_REGISTRY_ABI.json');
const contracts = require('../client/src/variables/contracts.json');

const {
  DEFAULT_ROUTE_PROBES,
  DEFAULT_ROUTES,
  DEFAULT_ROUTE_TEXT,
  compactSmokeSummary,
  dismissOnboardingIfPresent,
  findMissingExpectedText,
  installDemoWorkerFixtureRoutes,
  installLocalSmokeFixtureRoutes,
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

test('default navigation smoke checks removed standalone pages use the normal not-found view', () => {
  for (const route of ['/debate', '/beta', '/contributors', '/matrix', '/demos']) {
    assert.ok(DEFAULT_ROUTES.includes(route));
    assert.deepEqual(DEFAULT_ROUTE_TEXT[route], ['Page not found', `Path: ${route}`]);
  }
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

test('setup, removed standalone pages, and shared demo views receive the pinned default-cache fixture locally', async () => {
  for (const route of ['/new', '/session/new', '/session/new?mode=interview', '/debate', '/beta', '/contributors', '/matrix', '/demos', '/atlas', '/atlas/scenario', '/su/Franklin']) {
    const handlers = [];
    await installDemoWorkerFixtureRoutes({ route: async (pattern, handler) => handlers.push({ pattern, handler }) },
      'http://127.0.0.1:4173', route);
    assert.equal(handlers.length, 1, `${route} should isolate the unrelated demo cache`);
    assert.equal(handlers[0].pattern, 'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev/storage/list?*');
    let response;
    await handlers[0].handler({
      request: () => ({ method: () => 'GET', url: () => 'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev/storage/list?resource=questions&limit=100' }),
      fulfill: async (value) => { response = value; },
      fallback: async () => assert.fail('the pinned question list should use the fixture'),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body), { items: [], listComplete: true });
    let fellBack = false;
    await handlers[0].handler({
      request: () => ({ method: () => 'POST', url: () => 'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev/storage/list?resource=questions' }),
      fulfill: async () => assert.fail('the default-cache fixture must not intercept writes'),
      fallback: async () => { fellBack = true; },
    });
    assert.equal(fellBack, true);
  }
  assert.equal(DEFAULT_ROUTE_PROBES['/session/new'], probeSessionModePresets);
});

test('local demo presence fixtures cover queryless reads and keep interview readiness scoped', async () => {
  const origin = 'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev';
  const interviewRoute = `/session/demo?mode=interview&worker=${encodeURIComponent(origin)}`;
  for (const route of ['/session/demo', '/session/demo?mode=recordGroup', '/session/demo-2', interviewRoute]) {
    const handlers = [];
    await installDemoWorkerFixtureRoutes({ route: async (pattern, handler) => handlers.push({ pattern, handler }) },
      'http://127.0.0.1:4173', route);
    const presence = handlers.find(({ pattern }) => typeof pattern === 'function' && pattern(new URL(`${origin}/resource-presence`)));
    assert(presence, `${route} isolates the queryless resource-presence request`);
    assert(presence.pattern(new URL(`${origin}/resource-presence?session=demo`)));
    assert.equal(presence.pattern(new URL('https://other-worker.example/resource-presence')), false);
    assert.equal(presence.pattern(new URL(`${origin}/resource-presence-private`)), false);
    let response;
    await presence.handler({
      request: () => ({ method: () => 'GET' }),
      fulfill: async (value) => { response = value; },
      fallback: async () => assert.fail('the exact public presence read should use the fixture'),
    });
    assert.equal(JSON.parse(response.body).interview.ready, route === interviewRoute);
    let fellBack = false;
    await presence.handler({
      request: () => ({ method: () => 'POST' }),
      fulfill: async () => assert.fail('fixture must not intercept writes'),
      fallback: async () => { fellBack = true; },
    });
    assert.equal(fellBack, true);
  }
});

test('setup fixture preserves live Worker checks and unrelated session routes', async () => {
  const page = { route: async () => assert.fail('no fixture should be installed') };
  await installDemoWorkerFixtureRoutes(page, 'https://contextengine.sh', '/session/new');
  await installDemoWorkerFixtureRoutes(page, 'https://contextengine.sh', '/new');
  await installDemoWorkerFixtureRoutes(page, 'http://127.0.0.1:4173', '/session/new-project');
});

test('local navigation fixtures allow app assets and fail unmatched external requests', async () => {
  let handler;
  await installLocalSmokeFixtureRoutes({ addInitScript: async () => {}, route: async (pattern, callback) => {
    assert.equal(pattern, '**/*');
    handler = callback;
  } }, 'http://127.0.0.1:4173');
  for (const [url, expected] of [
    ['http://127.0.0.1:4173/assets/app.js', 'continue'],
    ['https://unconfigured.example.test/asset.png', 'blockedbyclient'],
    ['https://sepolia.optimism.io/unconfigured', 'blockedbyclient'],
    ['https://fonts.googleapis.com/css2?family=Unexpected', 'blockedbyclient'],
    ['https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev/unconfigured', 'blockedbyclient'],
  ]) {
    let action;
    await handler({
      request: () => ({ url: () => url, method: () => 'GET' }),
      continue: async () => { action = 'continue'; },
      abort: async (reason) => { action = reason; },
      fulfill: async () => assert.fail(`unconfigured fixture: ${url}`),
    });
    assert.equal(action, expected, url);
  }
  await installLocalSmokeFixtureRoutes({ route: async () => assert.fail('remote smoke remains live') }, 'https://app.example.test');
});

test('the pinned worker route renders from read-only local smoke fixtures', async () => {
  const sessions = require('../client/src/variables/demo/demo_sessions.json');
  const origin = new URL(sessions['rxc-ra-test'].corsWorkerUrl).origin;
  for (const route of ['/rxc-ra-test', '/session/rxc-ra-test?mode=questions']) {
    let handler;
    await installLocalSmokeFixtureRoutes({ addInitScript: async () => {}, route: async (_pattern, callback) => { handler = callback; } },
      'http://127.0.0.1:4173', route);
    const request = async (pathname, method = 'GET') => {
      let result;
      await handler({
        request: () => ({ url: () => origin + pathname, method: () => method }),
        continue: async () => assert.fail('the fixture must not read a deployed Worker'),
        abort: async (reason) => { result = { aborted: reason }; },
        fulfill: async (response) => { result = response.json; },
      });
      return result;
    };
    const bootstrap = await request('/session-config?slug=rxc-ra-test');
    assert.equal(bootstrap.ok, true);
    assert.equal(bootstrap.sessionSlug, 'rxc-ra-test');
    assert.equal(bootstrap.config.slug, 'rxc-ra-test');
    assert.equal(bootstrap.config.corsWorkerUrl, origin + '/');
    assert.deepEqual(bootstrap.config.sessionModeProfile, sessions['demo-sh'].sessionModeProfile);
    assert.deepEqual(await request('/storage/list?resource=questions'), { items: [], listComplete: true });
    assert.deepEqual(await request('/resource-presence'), { ok: true, interview: { ready: false } });
    assert.deepEqual(await request('/session-config?slug=another-session'), { aborted: 'blockedbyclient' });
    assert.deepEqual(await request('/storage/list?resource=private'), { aborted: 'blockedbyclient' });
    assert.deepEqual(await request('/session-config?slug=rxc-ra-test', 'POST'), { aborted: 'blockedbyclient' });
  }
  assert.deepEqual(DEFAULT_ROUTE_TEXT['/rxc-ra-test'], ['Groups', 'Results']);
});

test('pinned Worker fixtures do not mask reads from unrelated routes', async () => {
  const origin = new URL(require('../client/src/variables/demo/demo_sessions.json')['rxc-ra-test'].corsWorkerUrl).origin;
  for (const route of ['/about', '/rxc-ra-test-2']) {
    let handler;
    await installLocalSmokeFixtureRoutes({ addInitScript: async () => {}, route: async (_pattern, callback) => { handler = callback; } },
      'http://127.0.0.1:4173', route);
    let aborted;
    await handler({
      request: () => ({ url: () => origin + '/session-config?slug=rxc-ra-test', method: () => 'GET' }),
      continue: async () => assert.fail('external requests remain isolated'),
      abort: async (reason) => { aborted = reason; },
      fulfill: async () => assert.fail('unrelated routes must not use the fixture'),
    });
    assert.equal(aborted, 'blockedbyclient');
  }
});

test('local navigation uses explicit asset fixtures and ABI-valid registry reads', async () => {
  let handler;
  await installLocalSmokeFixtureRoutes({ addInitScript: async () => {}, route: async (_pattern, callback) => { handler = callback; } }, 'http://127.0.0.1:4173');
  const request = async (url, method = 'GET', payload) => {
    let result;
    await handler({
      request: () => ({ url: () => url, method: () => method, postDataJSON: () => payload }),
      continue: async () => assert.fail('fixtures must never access the network'),
      abort: async (reason) => { result = { aborted: reason }; },
      fulfill: async (response) => { result = response; },
    });
    return result;
  };
  for (const fontUrl of [
    'https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Poppins:wght@400;600;700;800&display=swap',
    'https://fonts.googleapis.com/css?family=Poppins:200,300,400,600,700,800',
    'https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,500;1,500;1,600&display=swap',
  ]) {
    const font = await request(fontUrl);
    assert.equal(font.contentType, 'text/css', fontUrl);
  }
  const logo = await request('https://ethereum.org/images/assets/eth-diamond-glyph.png');
  assert.equal(logo.contentType, 'image/png');
  assert.match(logo.path, /client\/public\/favicon-32x32\.png$/);

  const capabilitiesUrl = 'https://demo-worker-030226.agalmic.workers.dev/capabilities?slug=';
  const capabilities = await request(capabilitiesUrl);
  assert.equal(capabilities.json.type, 'ce_worker_capabilities');
  assert.deepEqual(capabilities.json.features, []);
  assert.deepEqual(await request(capabilitiesUrl, 'POST'), { aborted: 'blockedbyclient' });
  assert.deepEqual(await request(capabilitiesUrl.replace('slug=', 'slug=private')), { aborted: 'blockedbyclient' });
  assert.deepEqual(await request(capabilitiesUrl.replace('demo-worker-030226', 'unknown-worker')), { aborted: 'blockedbyclient' });

  const registry = new ethers.utils.Interface(registryAbi);
  const to = contracts.sessionRegistryAddresses['11155420'];
  const rpcUrl = 'https://sepolia.optimism.io/';
  const read = async (name, args) => request(rpcUrl, 'POST', {
    jsonrpc: '2.0', id: 7, method: 'eth_call', params: [{ to, data: registry.encodeFunctionData(name, args) }, 'latest'],
  });
  const session = await read('getSessionBySlug', ['pe4']);
  assert.equal(session.json.id, 7);
  const tuple = registry.decodeFunctionResult('getSessionBySlug', session.json.result);
  assert.equal(tuple[0], 'pe4');
  assert.equal(tuple[1].toNumber(), 11155420);
  assert.deepEqual(JSON.parse(decodeURIComponent(tuple[2].split(',')[1])), { blockLimits: { start: 1 } });
  const gate = await read('getResourceGate', ['pe4', 'questionResponses']);
  assert.deepEqual(registry.decodeFunctionResult('getResourceGate', gate.json.result)[0], []);
  const fields = await read('getSessionFields', ['pe4', ['corsWorkerUrl', 'rpcUrl']]);
  assert.deepEqual(registry.decodeFunctionResult('getSessionFields', fields.json.result)[0], ['', '']);

  for (const payload of [
    { method: 'eth_sendRawTransaction', params: ['0x1234'] },
    { method: 'eth_call', params: [{ to: ethers.constants.AddressZero, data: registry.encodeFunctionData('getSessionCount') }] },
    { method: 'eth_getLogs', params: [{ address: ethers.constants.AddressZero }] },
    null,
  ]) {
    assert.equal((await request(rpcUrl, 'POST', payload)).aborted, 'blockedbyclient');
  }
  assert.equal((await read('getSessionBySlug', ['unconfigured-session'])).aborted, 'blockedbyclient');
});

test('local service-worker guard tolerates opaque frames and blocks registration elsewhere', async () => {
  let initScript;
  await installLocalSmokeFixtureRoutes({
    addInitScript: async (callback) => { initScript = callback; },
    route: async () => {},
  }, 'http://127.0.0.1:4173');
  const source = `(${initScript.toString()})();`;
  const opaqueNavigator = Object.defineProperty({}, 'serviceWorker', {
    get: () => { throw new Error('Service worker is disabled because the context is sandboxed'); },
  });
  assert.doesNotThrow(() => vm.runInNewContext(source, { navigator: opaqueNavigator }));
  assert.doesNotThrow(() => vm.runInNewContext(source, { navigator: {} }));

  let registered = false;
  const serviceWorker = { register: async () => { registered = true; } };
  vm.runInNewContext(source, { navigator: { serviceWorker } });
  await assert.rejects(serviceWorker.register('/worker.js'), /registration is disabled in local navigation smoke/);
  assert.equal(registered, false);
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
      securityPolicyViolations: [
        { disposition: 'enforce', effectiveDirective: 'script-src-elem', blockedURI: 'inline', documentURI: 'about:srcdoc' },
        { disposition: 'report', effectiveDirective: 'connect-src', blockedURI: 'http://outside.example.test/', documentURI: '/session/demo' },
      ],
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
    '/session/demo: CSP enforce script-src-elem: inline in about:srcdoc',
    '/session/demo: CSP report connect-src: http://outside.example.test/ in /session/demo',
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
      securityPolicyViolations: 0,
      routeProbeFailures: 0,
      layoutIssues: 0,
      missingText: [],
    }],
    failures: [],
    scriptInjection: undefined,
  });
});
