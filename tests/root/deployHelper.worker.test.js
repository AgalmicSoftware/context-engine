const { webcrypto } = require('crypto');
const deployHelperWorker = require('../../workers/deploy-helper/worker.js').default;

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
  const workerNamePreflightCalls = [];
  const fetchMock = async (...args) => {
    const [url, init = {}] = args;
    const normalizedUrl = String(url);
    const method = String(init.method || 'GET').toUpperCase();
    if (method === 'GET' && /\/workers\/scripts\/[^/]+\/settings$/.test(normalizedUrl)) {
      workerNamePreflightCalls.push(args);
      if (workerNamePreflightCalls.length === 1) {
        return fetchMock.workerNamePreflightOverride || cfFailure(404, 'Worker not found.');
      }
      if (fetchMock.workerCleanupSettingsOverride) return fetchMock.workerCleanupSettingsOverride;
      const scriptUpload = [...calls].reverse().find(([candidateUrl, candidateInit = {}]) => (
        String(candidateInit.method || '').toUpperCase() === 'PUT' &&
        /\/workers\/scripts\/[^/]+$/.test(String(candidateUrl))
      ));
      const metadataBlob = scriptUpload?.[1]?.body?.get?.('metadata');
      const metadata = metadataBlob
        ? JSON.parse(await new Response(metadataBlob).text())
        : { bindings: [] };
      return cfSuccess({ bindings: metadata.bindings || [] });
    }
    calls.push(args);
    if (method === 'GET' && /\/accounts\/[^/]+\/workers\/subdomain$/.test(normalizedUrl)) {
      return cfSuccess({ subdomain: 'tenant-subdomain', status: 'active' });
    }
    if (method === 'POST' && /\/workers\/scripts\/[^/]+\/subdomain$/.test(normalizedUrl)) {
      return cfSuccess({ enabled: true });
    }
    if (method === 'PUT' && /\/workers\/scripts\/[^/]+\/secrets$/.test(normalizedUrl)) {
      if (fetchMock.workerSecretPutOverride) return fetchMock.workerSecretPutOverride;
    }
    if (method === 'DELETE' && /\/workers\/scripts\/[^/]+$/.test(normalizedUrl)) {
      if (fetchMock.workerDeleteOverride) return fetchMock.workerDeleteOverride;
    }
    if (method === 'PUT' && /\/values\/session:[^/]+:config$/.test(normalizedUrl)) {
      const priorConfigPut = calls
        .slice(0, -1)
        .some(([candidateUrl, candidateInit = {}]) => (
          String(candidateInit.method || '').toUpperCase() === 'PUT' &&
          String(candidateUrl) === normalizedUrl
        ));
      if (priorConfigPut && fetchMock.finalConfigPutOverride) return fetchMock.finalConfigPutOverride;
    }
    if (method === 'PUT' && /\/values\/session:[^/]+:secrets$/.test(normalizedUrl)) {
      if (fetchMock.secretsPutOverride) return fetchMock.secretsPutOverride;
      if (!queue.length) return cfSuccess({});
    }
    if (method === 'GET' && /\/values\/session:[^/]+:config$/.test(normalizedUrl)) {
      if (fetchMock.kvReadbackOverride) return fetchMock.kvReadbackOverride;
      const latestConfigWrite = [...calls]
        .reverse()
        .find(([candidateUrl, candidateInit = {}]) => (
          String(candidateInit.method || '').toUpperCase() === 'PUT' &&
          String(candidateUrl) === normalizedUrl
        ));
      if (fetchMock.kvReadbackTransform) {
        const latestConfig = JSON.parse(latestConfigWrite?.[1]?.body || '{}');
        return new Response(JSON.stringify(fetchMock.kvReadbackTransform(latestConfig)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(latestConfigWrite?.[1]?.body || '{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const next = queue.shift();
    if (typeof next === 'function') {
      return next(...args);
    }
    return next;
  };
  fetchMock.calls = calls;
  fetchMock.workerNamePreflightCalls = workerNamePreflightCalls;
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

const readScriptUploadMetadata = async (scriptUploadCall) => {
  const uploadForm = scriptUploadCall[1].body;
  const metadataBlob = uploadForm.get('metadata');
  const metadataText = await new Response(metadataBlob).text();
  return JSON.parse(metadataText);
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
      expect(payload?.configVerified).toBe(true);
      expect(fetchMock.calls.length).toBe(10);
      expectBundleDiagnosticsLog(consoleLogSpy, 'bundleUrl');

      const scriptUpload = fetchMock.calls[3];
      const uploadForm = scriptUpload[1].body;
      const uploadMetadata = await readScriptUploadMetadata(scriptUpload);
      expect(uploadMetadata.main_module).toBe('worker.mjs');
      expect(uploadMetadata.bindings.some((binding) => binding.name === 'CE_STORAGE_INDEX_KV')).toBe(false);
      expect(uploadForm.get('worker.mjs')).toBeTruthy();
      expect(uploadForm.get('worker.js')).toBeNull();
      const workerSecretWrites = fetchMock.calls
        .filter(([url]) => String(url).endsWith('/workers/scripts/test-worker/secrets'))
        .map(([, init]) => JSON.parse(init.body));
      expect(workerSecretWrites.map((secret) => secret.name)).toEqual(['TOKEN_HMAC_SECRET']);

      const configWrite = fetchMock.calls[2];
      expect(JSON.parse(configWrite[1].body).allowOrigins).toEqual([
        'http://localhost:3000',
      ]);

      const secretsWrite = fetchMock.calls.find(([url]) => String(url).endsWith(':secrets'));
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

      const configRewrite = [...fetchMock.calls].reverse().find(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':config')
      ));
      expect(String(configRewrite[0])).toMatch(/\/storage\/kv\/namespaces\/kv-123\/values\/session:alpha-session:config$/);
      expect(JSON.parse(configRewrite[1].body).corsWorkerUrl).toBe(
        'https://test-worker.tenant-subdomain.workers.dev/' // intentional: real URL — tests worker URL construction
      );
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('retries the first config write while a new KV namespace is propagating', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfFailure(404, "get namespace: 'namespace not found'", [
        { code: 10013, message: "get namespace: 'namespace not found'" },
      ]),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(
        makeJsonRequest('/deploy', {
          apiToken: 'cf-token',
          accountId: 'acc-123',
          workerName: 'canonical-worker',
          sessionSlug: 'alpha-session',
          adminAddress: '0x00000000000000000000000000000000000000aa',
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
          storageProfile: {
            backend: 'cloudflare',
            payloadAccessControl: { gate: 'none', encryption: 'worker_envelope' },
          },
          bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
        }),
        {},
        {},
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload?.configVerified).toBe(true);
      expect(
        fetchMock.calls.filter(([url, init = {}]) =>
          String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':config'),
        ),
      ).toHaveLength(3);
      expect(
        fetchMock.calls.some(
          ([url, init = {}]) =>
            String(init.method || '').toUpperCase() === 'DELETE' &&
            String(url).endsWith('/storage/kv/namespaces/kv-123'),
        ),
      ).toBe(false);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('cleans up once when KV namespace propagation retries are exhausted', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const propagationFailure = () =>
      cfFailure(404, "get namespace: 'namespace not found'", [
        { code: 10013, message: "get namespace: 'namespace not found'" },
      ]);
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      propagationFailure(),
      propagationFailure(),
      propagationFailure(),
      propagationFailure(),
      cfFailure(503, 'KV cleanup unavailable.'),
    ]);
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(
        makeJsonRequest('/deploy', {
          apiToken: 'cf-token',
          accountId: 'acc-123',
          workerName: 'canonical-worker',
          sessionSlug: 'alpha-session',
          adminAddress: '0x00000000000000000000000000000000000000aa',
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
          bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
        }),
        {},
        {},
      );
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.error).toBe("get namespace: 'namespace not found'");
      expect(payload?.detail).toEqual([
        { code: 10013, message: "get namespace: 'namespace not found'" },
      ]);
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: 'kv-123', workerName: '' });
      expect(
        fetchMock.calls.filter(([url, init = {}]) =>
          String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':config'),
        ),
      ).toHaveLength(4);
      expect(
        fetchMock.calls.filter(
          ([url, init = {}]) =>
            String(init.method || '').toUpperCase() === 'DELETE' &&
            String(url).endsWith('/storage/kv/namespaces/kv-123'),
        ),
      ).toHaveLength(1);
      expect(
        fetchMock.calls.some(
          ([url, init = {}]) =>
            String(init.method || '').toUpperCase() === 'PUT' && /\/workers\/scripts\/[^/]+$/.test(String(url)),
        ),
      ).toBe(false);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('does not retry unrelated KV 404 failures', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfFailure(404, 'KV value path was not found.'),
      cfSuccess({}),
    ]);
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(
        makeJsonRequest('/deploy', {
          apiToken: 'cf-token',
          accountId: 'acc-123',
          workerName: 'canonical-worker',
          sessionSlug: 'alpha-session',
          adminAddress: '0x00000000000000000000000000000000000000aa',
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
          bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
        }),
        {},
        {},
      );
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.error).toBe('KV value path was not found.');
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: '', workerName: '' });
      expect(
        fetchMock.calls.filter(([url, init = {}]) =>
          String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':config'),
        ),
      ).toHaveLength(1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('provisions an envelope KEK for worker-envelope storage without leaking it', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
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
        storageProfile: {
          backend: 'cloudflare',
          payloadAccessControl: { gate: 'sbt_gate', encryption: 'worker_envelope' },
        },
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(200);
      const uploadMetadata = await readScriptUploadMetadata(fetchMock.calls[3]);
      expect(uploadMetadata.bindings).toEqual(expect.arrayContaining([
        { name: 'CE_STORAGE_INDEX_KV', type: 'kv_namespace', namespace_id: 'kv-123' },
      ]));

      const workerSecretWrites = fetchMock.calls
        .filter(([url]) => String(url).endsWith('/workers/scripts/test-worker/secrets'))
        .map(([, init]) => JSON.parse(init.body));
      expect(workerSecretWrites.map((secret) => secret.name)).toEqual([
        'TOKEN_HMAC_SECRET',
        'CE_STORAGE_ENVELOPE_KEK',
      ]);
      const tokenSecret = workerSecretWrites[0].text;
      const envelopeKek = workerSecretWrites[1].text;
      expect(envelopeKek).toMatch(/^[0-9a-f]{64}$/);
      expect(envelopeKek).not.toBe(tokenSecret);

      const configWrite = JSON.parse(fetchMock.calls[2][1].body);
      expect(configWrite.storageProfile.payloadAccessControl.encryption).toBe('worker_envelope');
      expect(JSON.stringify(payload)).not.toContain(envelopeKek);
      expect(JSON.stringify(configWrite)).not.toContain(envelopeKek);
      expect(JSON.stringify(consoleLogSpy.mock.calls)).not.toContain(envelopeKek);
      expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(envelopeKek);
    } finally {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });

  it('seeds reload-safe worker-canonical config without persisting deployment or AI keys', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
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
        apiToken: 'cf-never-store',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        configRevision: 'revision-a',
        sessionName: 'Alpha Session',
        sessionInfo: 'Worker-canonical session',
        adminAddress: '0x00000000000000000000000000000000000000aa',
        ai: {
          models: { fast: { provider: 'openai', model: 'gpt-5' } },
          apiKey: 'sk-never-store',
          headers: { Authorization: 'Bearer sk-header-secret' },
          provider: { key: 'sk-generic-key' },
          endpoint: 'https://user:password@api.example.test',
        },
        cfApiToken: 'cf-alias-never-store',
        scopes: { cloudflare: { credentials: { token: 'nested-cf-never-store' } } },
        sessionModeProfile: {
          authority: { mode: 'worker_canonical' },
          encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
        },
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
        storageProfile: {
          backend: 'cloudflare',
          payloadAccessControl: { gate: 'none', encryption: 'worker_envelope' },
        },
        secrets: { openaiKey: 'sk-never-store' },
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload?.workerName).toMatch(/^test-worker-[0-9a-f]{12}$/);
      const configWrite = JSON.parse(fetchMock.calls[2][1].body);
      const serialized = JSON.stringify(configWrite);
      expect(configWrite).toEqual(expect.objectContaining({
        sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        configRevision: 'revision-a',
        sessionName: 'Alpha Session',
        sessionInfo: 'Worker-canonical session',
        sessionModeProfile: expect.objectContaining({ authority: { mode: 'worker_canonical' } }),
        workerAuthority: {
          version: 1,
          participantScopes: ['ai', 'transcribe', 'storage', 'groups', 'fetch'],
          anonymousScopes: [],
        },
        ai: { models: { fast: { provider: 'openai', model: 'gpt-5' } } },
      }));
      expect(serialized).not.toContain('cf-never-store');
      expect(serialized).not.toContain('cf-alias-never-store');
      expect(serialized).not.toContain('nested-cf-never-store');
      expect(serialized).not.toContain('sk-never-store');
      expect(serialized).not.toContain('sk-header-secret');
      expect(serialized).not.toContain('sk-generic-key');
      expect(serialized).not.toContain('user:password');
      expect(configWrite.registryAddress).toBeUndefined();
      expect(configWrite.registryChainId).toBeUndefined();
      expect(configWrite.rpcUrl).toBeUndefined();
      expect(configWrite.rpcUrlsByChainId).toBeUndefined();
      expect(configWrite.faucet).toBeUndefined();
      expect(configWrite.blockLimits).toBeUndefined();

      const scriptUploadMetadata = await readScriptUploadMetadata(fetchMock.calls[3]);
      expect(scriptUploadMetadata.bindings).toContainEqual({
        name: 'BOOTSTRAP_ADMIN_ADDRESS',
        type: 'plain_text',
        text: '0x00000000000000000000000000000000000000aa',
      });

      const finalConfigWrite = [...fetchMock.calls].reverse().find(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':config')
      ));
      const configRewrite = JSON.parse(finalConfigWrite[1].body);
      expect(configRewrite.configRevision).toBe('revision-a');
      expect(configRewrite.corsWorkerUrl).toBe(
        `https://${payload.workerName}.tenant-subdomain.workers.dev/`
      );
      const configReadbackIndex = fetchMock.calls.findIndex(([url, init = {}]) => (
        String(init.method || 'GET').toUpperCase() === 'GET' && String(url).endsWith(':config')
      ));
      const secretWriteIndices = fetchMock.calls
        .map(([url], index) => (String(url).endsWith(':secrets') || String(url).endsWith('/secrets') ? index : -1))
        .filter((index) => index >= 0);
      expect(secretWriteIndices).not.toHaveLength(0);
      expect(secretWriteIndices.every((index) => index > configReadbackIndex)).toBe(true);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('rejects an invalid worker-canonical authority policy before Cloudflare mutation', async () => {
    const fetchMock = makeFetchSequence([]);
    global.fetch = fetchMock;

    const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token',
      accountId: 'acc-123',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      adminAddress: '0x00000000000000000000000000000000000000aa',
      sessionModeProfile: {
        authority: { mode: 'worker_canonical' },
      },
      workerAuthority: {
        version: 2,
        participantScopes: ['storage'],
        anonymousScopes: [],
      },
      bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
    }), {}, {});
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Worker-canonical authority policy must use version 1.');
    expect(fetchMock.calls).toHaveLength(0);
    expect(fetchMock.workerNamePreflightCalls).toHaveLength(0);
  });

  it('rejects an existing worker-canonical name before creating KV or overwriting a script', async () => {
    const fetchMock = makeFetchSequence([]);
    fetchMock.workerNamePreflightOverride = cfSuccess({ compatibility_date: '2024-09-02' });
    global.fetch = fetchMock;

    const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token',
      accountId: 'acc-123',
      workerName: 'existing-worker',
      sessionSlug: 'alpha-session',
      allowOverwrite: true,
      adminAddress: '0x00000000000000000000000000000000000000aa',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
      bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
    }), {}, {});
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload?.error).toContain('already exists');
    expect(fetchMock.workerNamePreflightCalls).toHaveLength(1);
    expect(String(fetchMock.workerNamePreflightCalls[0][0])).toMatch(
      /\/workers\/scripts\/existing-worker-[0-9a-f]{12}\/settings$/
    );
    expect(fetchMock.calls).toHaveLength(0);
  });

  it('preserves existing noncanonical worker update behavior', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({ id: 'worker-updated' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.workerNamePreflightOverride = cfSuccess({ compatibility_date: '2024-09-02' });
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'existing-worker',
        sessionSlug: 'alpha-session',
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload?.workerName).toBe('existing-worker');
      expect(fetchMock.workerNamePreflightCalls).toHaveLength(1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('never deletes a pre-existing noncanonical worker during rollback', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({ id: 'worker-updated' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.workerNamePreflightOverride = cfSuccess({ compatibility_date: '2024-09-02' });
    fetchMock.workerSecretPutOverride = cfFailure(500, 'runtime secret write failed');
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'existing-worker',
        sessionSlug: 'alpha-session',
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.orphanResources).toEqual({
        kvNamespaceId: '',
        workerName: '',
        workerCleanupStatus: 'preserved-existing',
      });
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(url).endsWith('/workers/scripts/existing-worker') && init.method === 'DELETE'
      ))).toBe(false);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('binds Cloudflare storage index KV and persists a sanitized storage profile', async () => {
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
        storageProfile: {
          backend: 'cloudflare',
          resources: { questions: 'active', responses: 'active' },
          payloadAccessControl: { mode: 'public-read' },
          cloudflare: {
            payloadAccessMode: 'public_read',
            primitives: { r2: ['question_payloads'], kv: ['metadata_indexes'] },
            apiToken: 'storage-secret',
            accountId: 'storage-account',
          },
        },
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload?.ok).toBe(true);

      const uploadMetadata = await readScriptUploadMetadata(fetchMock.calls[3]);
      expect(uploadMetadata.bindings).toEqual(expect.arrayContaining([
        { name: 'GROUP_KV', type: 'kv_namespace', namespace_id: 'kv-123' },
        { name: 'CE_STORAGE_INDEX_KV', type: 'kv_namespace', namespace_id: 'kv-123' },
      ]));
      expect(uploadMetadata.bindings.some((binding) => binding.name === 'CE_STORAGE_R2')).toBe(false);

      const configWrite = JSON.parse(fetchMock.calls[2][1].body);
      expect(configWrite.storageProfile).toEqual(expect.objectContaining({
        backend: 'cloudflare',
        sessionOwned: true,
        telegramOwned: false,
        payloadAccessControl: expect.objectContaining({ mode: 'public_read' }),
      }));
      expect(configWrite.storageProfile.resources.questions).toBe('active');
      expect(configWrite.storageProfile.resources.responses).toBe('active');
      expect(configWrite.storageProfile.cloudflare).toEqual(expect.objectContaining({
        payloadAccessMode: 'public_read',
        exposesAccountId: false,
        exposesBucketName: false,
        exposesWorkerToken: false,
      }));
      expect(JSON.stringify(configWrite)).not.toContain('storage-secret');
      expect(JSON.stringify(configWrite)).not.toContain('storage-account');

      const finalConfigWrite = [...fetchMock.calls].reverse().find(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':config')
      ));
      const configRewrite = JSON.parse(finalConfigWrite[1].body);
      expect(configRewrite.storageProfile.payloadAccessControl.mode).toBe('public_read');
      expect(configRewrite.corsWorkerUrl).toBe('https://test-worker.tenant-subdomain.workers.dev/');
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('binds a requested Cloudflare R2 bucket without persisting the bucket name', async () => {
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
        storageProfile: {
          backend: 'cloudflare',
          cloudflare: {
            useR2: true,
            r2BucketName: 'ce-session-payloads',
          },
        },
      }), {}, {});

      expect(response.status).toBe(200);
      const uploadMetadata = await readScriptUploadMetadata(fetchMock.calls[3]);
      expect(uploadMetadata.bindings).toEqual(expect.arrayContaining([
        { name: 'CE_STORAGE_INDEX_KV', type: 'kv_namespace', namespace_id: 'kv-123' },
        { name: 'CE_STORAGE_R2', type: 'r2_bucket', bucket_name: 'ce-session-payloads' },
      ]));

      const configWrite = JSON.parse(fetchMock.calls[2][1].body);
      expect(configWrite.storageProfile.backend).toBe('cloudflare');
      expect(JSON.stringify(configWrite)).not.toContain('ce-session-payloads');
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('fails clearly when Cloudflare R2 storage is requested without a bucket name', async () => {
    const fetchMock = makeFetchSequence([]);
    global.fetch = fetchMock;

    const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token',
      accountId: 'acc-123',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      bundleText: 'export default { fetch() {} };',
      storageProfile: {
        backend: 'cloudflare',
        cloudflare: { useR2: true },
      },
    }), {}, {});
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Cloudflare R2 storage requires r2BucketName when R2 is explicitly requested.');
    expect(fetchMock.calls.length).toBe(0);
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
    global.fetch = async (url) => {
      if (String(url).endsWith('/workers/scripts/test-worker/settings')) {
        return cfFailure(404, 'Worker not found.');
      }
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

  it('fails without surfacing a worker URL when the final config rewrite fails', async () => {
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
    fetchMock.finalConfigPutOverride = cfFailure(500, 'final config rewrite failed');
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
      expect(payload?.workerUrl).toBeUndefined();
      expect(payload?.error).toBe('final config rewrite failed');
      expect(fetchMock.calls.length).toBe(9);
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: '', workerName: '' });
      expect(fetchMock.calls.some(([url]) => String(url).endsWith(':secrets'))).toBe(false);
      expect(fetchMock.calls.some(([url]) => String(url).endsWith('/secrets'))).toBe(false);
      expectBundleDiagnosticsLog(consoleLogSpy, 'bundleUrl');
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('fails without surfacing a worker URL when config readback does not match', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({ subdomain: 'tenant-subdomain', status: 'active' }),
      cfSuccess({ enabled: true }),
      cfSuccess({}),
    ]);
    fetchMock.kvReadbackOverride = new Response(JSON.stringify({
      slug: 'different-session',
      corsWorkerUrl: 'https://attacker.example',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
      expect(payload?.workerUrl).toBeUndefined();
      expect(payload?.error).toBe('Worker config verification failed after deployment.');
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('fails worker-canonical readback when the persisted authority policy does not match', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.kvReadbackTransform = (latestConfig) => ({
      ...latestConfig,
      workerAuthority: {
        version: 1,
        participantScopes: [],
        anonymousScopes: [],
      },
    });
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        adminAddress: '0x00000000000000000000000000000000000000aa',
        sessionModeProfile: { authority: { mode: 'worker_canonical' } },
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.error).toBe('Worker config verification failed after deployment.');
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: '', workerName: '' });
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('cleans up the script and KV namespace when the final session secrets write fails', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.secretsPutOverride = cfFailure(500, 'secrets write failed');
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
        secrets: { openaiKey: 'sk-never-orphan' },
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.error).toBe('secrets write failed');
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: '', workerName: '' });
      expect(fetchMock.calls).toEqual(expect.arrayContaining([
        expect.arrayContaining([
          expect.stringMatching(/\/workers\/scripts\/test-worker$/),
          expect.objectContaining({ method: 'DELETE' }),
        ]),
        expect.arrayContaining([
          expect.stringMatching(/\/storage\/kv\/namespaces\/kv-123$/),
          expect.objectContaining({ method: 'DELETE' }),
        ]),
      ]));
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('cleans up before session keys persist when the post-verification runtime secret write fails', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.workerSecretPutOverride = cfFailure(500, 'runtime secret write failed');
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
        secrets: { openaiKey: 'sk-never-orphan' },
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.error).toBe('runtime secret write failed');
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: '', workerName: '' });
      expect(fetchMock.calls.some(([url]) => String(url).endsWith(':secrets'))).toBe(false);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('does not delete a script whose deployment ownership changed before rollback', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.workerSecretPutOverride = cfFailure(500, 'runtime secret write failed');
    fetchMock.workerCleanupSettingsOverride = cfSuccess({
      bindings: [{ name: 'CE_DEPLOYMENT_ID', type: 'plain_text', text: 'different-deployment' }],
    });
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
      expect(payload?.orphanResources).toEqual({
        kvNamespaceId: '',
        workerName: '',
        workerCleanupStatus: 'ownership-changed',
      });
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(url).endsWith('/workers/scripts/test-worker') && init.method === 'DELETE'
      ))).toBe(false);
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(url).endsWith('/storage/kv/namespaces/kv-123') && init.method === 'DELETE'
      ))).toBe(true);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it.each([
    {
      label: 'deletes an exactly owned script',
      settingsOverride: null,
      expectedOrphans: { kvNamespaceId: '', workerName: '' },
      shouldDeleteScript: true,
    },
    {
      label: 'reports only an exactly owned script whose deletion failed',
      settingsOverride: null,
      scriptDeleteResponse: cfFailure(500, 'Worker deletion failed.'),
      expectedOwnedDeleteFailure: true,
      shouldDeleteScript: true,
    },
    {
      label: 'treats a confirmed 404 as already absent',
      settingsOverride: cfFailure(404, 'Worker not found.'),
      expectedOrphans: { kvNamespaceId: '', workerName: '' },
      shouldDeleteScript: false,
    },
    {
      label: 'preserves a changed deployment owner',
      settingsOverride: cfSuccess({
        bindings: [{ name: 'CE_DEPLOYMENT_ID', type: 'plain_text', text: 'different-deployment' }],
      }),
      expectedOrphans: {
        kvNamespaceId: '',
        workerName: '',
        workerCleanupStatus: 'ownership-changed',
      },
      shouldDeleteScript: false,
    },
    {
      label: 'reports indeterminate ownership without removal instructions',
      settingsOverride: cfFailure(503, 'Settings unavailable.'),
      expectedOrphans: {
        kvNamespaceId: '',
        workerName: '',
        workerCleanupStatus: 'ownership-unverified',
      },
      shouldDeleteScript: false,
    },
  ])('$label after an ambiguous canonical script upload failure', async ({
    settingsOverride,
    scriptDeleteResponse,
    expectedOrphans,
    expectedOwnedDeleteFailure,
    shouldDeleteScript,
  }) => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfFailure(502, 'Worker upload response was lost.'),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    if (settingsOverride) fetchMock.workerCleanupSettingsOverride = settingsOverride;
    if (scriptDeleteResponse) fetchMock.workerDeleteOverride = scriptDeleteResponse;
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'canonical-worker',
        sessionSlug: 'alpha-session',
        adminAddress: '0x00000000000000000000000000000000000000aa',
        sessionModeProfile: { authority: { mode: 'worker_canonical' } },
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      if (expectedOwnedDeleteFailure) {
        expect(payload?.orphanResources).toEqual({
          kvNamespaceId: '',
          workerName: expect.stringMatching(/^canonical-worker-[0-9a-f]{12}$/),
          workerCleanupStatus: 'owned-delete-failed',
        });
      } else {
        expect(payload?.orphanResources).toEqual(expectedOrphans);
      }
      const scriptDeleteCalls = fetchMock.calls.filter(([url, init = {}]) => (
        /\/workers\/scripts\/canonical-worker-[0-9a-f]{12}$/.test(String(url)) && init.method === 'DELETE'
      ));
      expect(scriptDeleteCalls).toHaveLength(shouldDeleteScript ? 1 : 0);
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(url).endsWith('/storage/kv/namespaces/kv-123') && init.method === 'DELETE'
      ))).toBe(true);
    } finally {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });

  it('includes bundle diagnostics when Cloudflare rejects the uploaded worker entrypoint', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfFailure(400, 'The uploaded script has no registered event handlers.'),
      cfSuccess({}),
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
      cfSuccess({}),
      async (...args) => {
        const uploadForm = args[1].body;
        const uploadedBundle = await new Response(uploadForm.get('worker.mjs')).text();
        expect(uploadedBundle).toBe(bundleText);
        return cfFailure(400, 'The uploaded script has no registered event handlers.');
      },
      cfSuccess({}),
      cfSuccess({}),
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
