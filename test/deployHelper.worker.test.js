const { webcrypto } = require('crypto');
const deployHelperWorker = require('../workers/deploy-helper/worker.js').default;

const makeJsonRequest = (path, body, init = {}) => new Request(`https://helper.example.test${path}`, {
  method: init.method || 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:3000',
    ...(init.headers || {}),
  },
  body: body == null ? undefined : JSON.stringify(body),
});

const cfSuccess = (result = {}) => new Response(JSON.stringify({
  success: true,
  result,
}), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

const cfFailure = (status, message, errors = [{ message }]) => new Response(JSON.stringify({
  success: false,
  errors,
}), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const makeFetchSequence = (responses = []) => {
  const queue = [...responses];
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    const next = queue.shift();
    if (typeof next === 'function') {
      return next(...args);
    }
    return next;
  };
  fetchMock.calls = calls;
  return fetchMock;
};

const makeKvBinding = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
};

const parseConsolePayload = (call) => {
  expect(call).toBeTruthy();
  return JSON.parse(call[1]);
};

const expectBundleDiagnosticsLog = (consoleLogSpy, source) => {
  const call = consoleLogSpy.mock.calls.find(([label, payload]) => {
    if (label !== '[deploy-helper] bundle diagnostics') return false;
    try {
      return JSON.parse(payload)?.diagnostics?.source === source;
    } catch (_) {
      return false;
    }
  });
  const payload = parseConsolePayload(call);
  expect(payload).toEqual(expect.objectContaining({
    workerName: 'test-worker',
    sessionSlug: 'alpha-session',
    diagnostics: expect.objectContaining({ source }),
  }));
  return payload;
};

const expectScriptUploadFailureLog = (consoleErrorSpy, source) => {
  const call = consoleErrorSpy.mock.calls.find(([label, payload]) => {
    if (label !== '[deploy-helper] script upload failed') return false;
    try {
      return JSON.parse(payload)?.diagnostics?.source === source;
    } catch (_) {
      return false;
    }
  });
  const payload = parseConsolePayload(call);
  expect(payload).toEqual(expect.objectContaining({
    workerName: 'test-worker',
    sessionSlug: 'alpha-session',
    error: expect.stringContaining('no registered event handlers'),
    diagnostics: expect.objectContaining({ source }),
  }));
  return payload;
};

describe('deploy-helper worker', () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;

  beforeAll(() => {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('normalizes worker secrets before writing them to KV during deploy', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({ subdomain: 'tenant-subdomain', status: 'active' }),
      cfSuccess({ enabled: true }),
      cfSuccess({}),
    ]);
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
        secrets: {
          openaiKey: '  sk-openai  ',
          arweaveJwk: { kty: 'RSA', n: 'abc' },
          faucetPrivateKey: 12345,
          litAccountApiKey: '  lit-account-secret  ',
          litUsageApiKey: '  lit-usage-secret  ',
        },
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload?.ok).toBe(true);
      expect(fetchMock.calls.length).toBe(9);
      expectBundleDiagnosticsLog(consoleLogSpy, 'bundleUrl');

      const scriptUpload = fetchMock.calls[2];
      const uploadForm = scriptUpload[1].body;
      const metadataBlob = uploadForm.get('metadata');
      const metadataText = await new Response(metadataBlob).text();
      const uploadMetadata = JSON.parse(metadataText);
      expect(uploadMetadata.main_module).toBe('worker.mjs');
      expect(uploadForm.get('worker.mjs')).toBeTruthy();
      expect(uploadForm.get('worker.js')).toBeNull();

      const configWrite = fetchMock.calls[4];
      expect(JSON.parse(configWrite[1].body).allowOrigins).toEqual([
        'http://localhost:3000',
      ]);

      const secretsWrite = fetchMock.calls[5];
      expect(String(secretsWrite[0])).toMatch(/\/storage\/kv\/namespaces\/kv-123\/values\/session:alpha-session:secrets$/);
      const secretsEnvelope = JSON.parse(secretsWrite[1].body);
      expect(secretsEnvelope).toEqual(expect.objectContaining({
        v: 1,
        kind: 'session-secrets',
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      }));
      expect(secretsEnvelope.secrets).toEqual({
        openaiKey: 'sk-openai',
        arweaveJwk: '{"kty":"RSA","n":"abc"}',
        faucetPrivateKey: '12345',
        litAccountApiKey: 'lit-account-secret',
        litUsageApiKey: 'lit-usage-secret',
      });

      const configRewrite = fetchMock.calls[8];
      expect(String(configRewrite[0])).toMatch(/\/storage\/kv\/namespaces\/kv-123\/values\/session:alpha-session:config$/);
      expect(JSON.parse(configRewrite[1].body).corsWorkerUrl).toBe(
        'https://test-worker.tenant-subdomain.workers.dev/' // intentional: real URL — tests worker URL construction
      );
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('returns a structured 502 when Cloudflare API lookup fails at the network layer', async () => {
    global.fetch = async () => {
      throw new Error('socket hang up');
    };

    const response = await deployHelperWorker.fetch(makeJsonRequest('/account', {
      apiToken: 'cf-token',
    }), {}, {});
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload?.error || '').toMatch(/Cloudflare API request failed/);
    expect(payload?.error || '').toMatch(/socket hang up/);
  });

  it('returns a structured 502 when fetching the worker bundle fails', async () => {
    global.fetch = async () => {
      throw new TypeError('fetch failed');
    };

    const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token',
      accountId: 'acc-123',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
    }), {}, {});
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload?.error).toBe('Failed to fetch bundle: fetch failed');
  });

  it('returns a partial-success response when only the final config rewrite fails', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({ subdomain: 'tenant-subdomain', status: 'active' }),
      cfSuccess({ enabled: true }),
      cfFailure(500, 'final config rewrite failed'),
    ]);
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(207);
      expect(payload?.ok).toBe(true);
      expect(payload?.partial).toBe(true);
      expect(payload?.workerUrl).toBe('https://test-worker.tenant-subdomain.workers.dev/'); // intentional: real URL — tests worker URL construction
      expect(payload?.configWriteError).toBe('final config rewrite failed');
      expect(payload?.configWriteStatus).toBe(500);
      expect(fetchMock.calls.length).toBe(9);
      expectBundleDiagnosticsLog(consoleLogSpy, 'bundleUrl');
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('includes bundle diagnostics when Cloudflare rejects the uploaded worker entrypoint', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfFailure(400, 'The uploaded script has no registered event handlers.'),
    ]);
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.error || '').toContain('no registered event handlers');
      expect(payload?.error || '').toContain('Bundle diagnostics:');
      expect(payload?.bundleDiagnostics).toEqual(expect.objectContaining({
        source: 'bundleUrl',
        hasAnyExport: true,
        hasExportDefault: true,
        hasFetchHandler: true,
        hasServiceWorkerFetch: false,
      }));
      expectBundleDiagnosticsLog(consoleLogSpy, 'bundleUrl');
      expectScriptUploadFailureLog(consoleErrorSpy, 'bundleUrl');
    } finally {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });

  it('preserves raw bundleText bytes and reports exact bundleText diagnostics', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const bundleText = '\nexport default { fetch() { return new Response("ok"); } };\n';
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      async (...args) => {
        const uploadForm = args[1].body;
        const uploadedBundle = await new Response(uploadForm.get('worker.mjs')).text();
        expect(uploadedBundle).toBe(bundleText);
        return cfFailure(400, 'The uploaded script has no registered event handlers.');
      },
    ]);
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText,
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.bundleDiagnostics).toEqual(expect.objectContaining({
        source: 'bundleText',
        length: bundleText.length,
        hasStringExportWrapper: false,
        hasFetchHandler: true,
      }));
      expectBundleDiagnosticsLog(consoleLogSpy, 'bundleText');
      expectScriptUploadFailureLog(consoleErrorSpy, 'bundleText');
    } finally {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });

  it('rejects admin origins requests without a matching bearer token', async () => {
    const response = await deployHelperWorker.fetch(makeJsonRequest('/admin/origins', null, {
      method: 'GET',
    }), {
      ADMIN_SECRET: 'top-secret',
    }, {});
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Admin authorization failed.' });
  });

  it('returns the KV allowlist ahead of env ALLOWED_ORIGINS on GET /admin/origins', async () => {
    const response = await deployHelperWorker.fetch(makeJsonRequest('/admin/origins', null, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer top-secret',
        Origin: 'https://kv.example.test',
      },
    }), {
      ADMIN_SECRET: 'top-secret',
      ALLOWED_ORIGINS: 'https://env.example.test',
      DEPLOY_HELPER_KV: makeKvBinding({
        'deploy-helper:origins': JSON.stringify(['https://kv.example.test']),
      }),
    }, {});
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      origins: ['https://kv.example.test'],
      source: 'kv',
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://kv.example.test');
  });

  it('falls back to the localhost-only default origins when no env or KV override is configured', async () => {
    const response = await deployHelperWorker.fetch(makeJsonRequest('/admin/origins', null, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer top-secret',
      },
    }), {
      ADMIN_SECRET: 'top-secret',
    }, {});
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      origins: ['http://localhost:3000'],
      source: 'default',
    });
  });

  it('stores normalized origins in KV via POST /admin/origins', async () => {
    const kv = makeKvBinding();
    const response = await deployHelperWorker.fetch(makeJsonRequest('/admin/origins', {
      origins: [
        'kv.example.test',
        'https://kv.example.test/path',
        'http://localhost:3000',
      ],
    }, {
      headers: {
        Authorization: 'Bearer top-secret',
        Origin: 'https://env.example.test',
      },
    }), {
      ADMIN_SECRET: 'top-secret',
      ALLOWED_ORIGINS: 'https://env.example.test',
      DEPLOY_HELPER_KV: kv,
    }, {});
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      origins: [
        'https://kv.example.test',
        'http://localhost:3000',
      ],
      source: 'kv',
    });
    expect(kv.store.get('deploy-helper:origins')).toBe(JSON.stringify([
      'https://kv.example.test',
      'http://localhost:3000',
    ]));
  });

  it('falls back to newline-delimited env origins after clearing the KV override', async () => {
    const kv = makeKvBinding({
      'deploy-helper:origins': JSON.stringify(['https://kv.example.test']),
    });
    const response = await deployHelperWorker.fetch(makeJsonRequest('/admin/origins', {
      origins: [],
    }, {
      headers: {
        Authorization: 'Bearer top-secret',
        Origin: 'https://env.example.test',
      },
    }), {
      ADMIN_SECRET: 'top-secret',
      ALLOWED_ORIGINS: 'https://env.example.test\nhttp://localhost:3000',
      DEPLOY_HELPER_KV: kv,
    }, {});
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      origins: [
        'https://env.example.test',
        'http://localhost:3000',
      ],
      source: 'env',
    });
    expect(kv.store.has('deploy-helper:origins')).toBe(false);
  });
});
