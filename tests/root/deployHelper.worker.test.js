const { webcrypto } = require('crypto');
const deployHelperWorker = require('../../workers/deploy-helper/worker.js').default;
const { SessionWriteCoordinator } = require('../../workers/sessionCorsWorker/sessionWriteCoordinator.js');

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
  let scriptUploadAttempted = false;
  let scriptUploadSucceeded = false;
  let postUploadOwnershipChecked = false;
  const fetchMock = async (...args) => {
    const [url, init = {}] = args;
    const normalizedUrl = String(url);
    const method = String(init.method || 'GET').toUpperCase();
    if (method === 'GET' && /\/accounts\?per_page=5$/.test(normalizedUrl)) {
      return fetchMock.accountLookupOverride || cfSuccess([
        { id: 'acc-123', name: 'Derived test account' },
      ]);
    }
    if (method === 'GET' && /\/workers\/scripts\/[^/]+\/settings$/.test(normalizedUrl)) {
      workerNamePreflightCalls.push(args);
      if (workerNamePreflightCalls.length === 1) {
        return fetchMock.workerNamePreflightOverride || cfFailure(404, 'Worker not found.');
      }
      if (!scriptUploadAttempted) {
        return fetchMock.workerSecondPreflightOverride || cfFailure(404, 'Worker not found.');
      }
      if (scriptUploadSucceeded && !postUploadOwnershipChecked) {
        postUploadOwnershipChecked = true;
        if (fetchMock.workerPostUploadSettingsOverride) return fetchMock.workerPostUploadSettingsOverride;
      } else if (fetchMock.workerCleanupSettingsOverride) {
        return fetchMock.workerCleanupSettingsOverride;
      }
      const scriptUpload = [...calls].reverse().find(([candidateUrl, candidateInit = {}]) => (
        String(candidateInit.method || '').toUpperCase() === 'PUT' &&
        /\/workers\/scripts\/[^/?]+$/.test(String(candidateUrl))
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
      if (fetchMock.scriptSubdomainOverride) return fetchMock.scriptSubdomainOverride;
      return cfSuccess({ enabled: true });
    }
    if (method === 'PUT' && /\/workers\/scripts\/[^/]+\/secrets$/.test(normalizedUrl)) {
      if (Array.isArray(fetchMock.workerSecretPutResponses) && fetchMock.workerSecretPutResponses.length) {
        return fetchMock.workerSecretPutResponses.shift();
      }
      if (fetchMock.workerSecretPutOverride) return fetchMock.workerSecretPutOverride;
      return cfSuccess({});
    }
    if (method === 'DELETE' && /\/workers\/scripts\/[^/?]+\?force=true$/.test(normalizedUrl)) {
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
      if (Array.isArray(fetchMock.secretsPutResponses) && fetchMock.secretsPutResponses.length) {
        return fetchMock.secretsPutResponses.shift();
      }
      if (fetchMock.secretsPutOverride) return fetchMock.secretsPutOverride;
      return cfSuccess({});
    }
    if (method === 'GET' && /\/values\/session:[^/]+:config$/.test(normalizedUrl)) {
      if (Array.isArray(fetchMock.kvReadbackResponses) && fetchMock.kvReadbackResponses.length) {
        return fetchMock.kvReadbackResponses.shift();
      }
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
    const response = typeof next === 'function' ? await next(...args) : next;
    if (method === 'PUT' && /\/workers\/scripts\/[^/?]+$/.test(normalizedUrl)) {
      scriptUploadAttempted = true;
      scriptUploadSucceeded = response?.ok === true;
    }
    return response;
  };
  fetchMock.calls = calls;
  fetchMock.workerNamePreflightCalls = workerNamePreflightCalls;
  return fetchMock;
};

const makeDeploymentRequestFetchSequence = (responses = []) => {
  const baseFetch = makeFetchSequence(responses);
  const namespaces = [];
  const fetchMock = async (...args) => {
    const [url, init = {}] = args;
    const normalizedUrl = String(url);
    const method = String(init.method || 'GET').toUpperCase();
    if (method === 'GET' && /\/storage\/kv\/namespaces\?/.test(normalizedUrl)) {
      baseFetch.calls.push(args);
      if (namespaces.length && fetchMock.namespaceListHiddenReads > 0) {
        fetchMock.namespaceListHiddenReads -= 1;
        return cfSuccess([]);
      }
      return cfSuccess(namespaces);
    }
    if (
      method === 'POST' &&
      normalizedUrl.endsWith('/storage/kv/namespaces') &&
      fetchMock.commitNamespaceCreateThenThrow
    ) {
      baseFetch.calls.push(args);
      const { title } = JSON.parse(String(init.body || '{}'));
      namespaces.push({ id: `kv-${namespaces.length + 1}`, title });
      fetchMock.commitNamespaceCreateThenThrow = false;
      throw new TypeError('namespace create response lost');
    }
    const response = await baseFetch(...args);
    if (method === 'POST' && normalizedUrl.endsWith('/storage/kv/namespaces') && response?.ok) {
      const payload = await response.clone().json();
      const { title } = JSON.parse(String(init.body || '{}'));
      namespaces.push({ id: payload?.result?.id, title });
    }
    return response;
  };
  fetchMock.calls = baseFetch.calls;
  fetchMock.workerNamePreflightCalls = baseFetch.workerNamePreflightCalls;
  fetchMock.namespaces = namespaces;
  fetchMock.commitNamespaceCreateThenThrow = false;
  fetchMock.namespaceListHiddenReads = 0;
  return fetchMock;
};

const makeResumableDeploymentFetch = () => {
  const namespaces = [];
  const kvValues = new Map();
  const workerBindings = new Map();
  const workerSecretBindings = new Map();
  const workerSecretBodies = [];
  const scriptUploadMetadata = [];
  let namespaceCreates = 0;
  let scriptUploads = 0;
  let finalConfigPuts = 0;
  let bundleFetches = 0;
  const fetchMock = jest.fn(async (url, init = {}) => {
    const normalizedUrl = String(url);
    const method = String(init.method || 'GET').toUpperCase();
    if (normalizedUrl === 'https://bundles.example.test/sessionCorsWorker.bundle.js') {
      bundleFetches += 1;
      if (fetchMock.bundleFetchMustFail) throw new TypeError('bundle host is unavailable');
      return new Response('export default { fetch() {} };', { status: 200 });
    }
    if (method === 'GET' && /\/accounts\?per_page=5$/.test(normalizedUrl)) {
      const authorization = init.headers instanceof Headers
        ? init.headers.get('Authorization')
        : init.headers?.Authorization;
      const token = String(authorization || '').replace(/^Bearer\s+/i, '');
      const accountId = fetchMock.accountIdsByToken.get(token) || 'acc-123';
      return cfSuccess([{ id: accountId, name: 'Derived test account' }]);
    }
    const secretListMatch = normalizedUrl.match(/\/workers\/scripts\/([^/]+)\/secrets$/);
    if (method === 'GET' && secretListMatch) {
      if (Array.isArray(fetchMock.secretListResponses) && fetchMock.secretListResponses.length) {
        return fetchMock.secretListResponses.shift();
      }
      return cfSuccess([...(workerSecretBindings.get(secretListMatch[1])?.values() || [])]);
    }
    const settingsMatch = normalizedUrl.match(/\/workers\/scripts\/([^/]+)\/settings$/);
    if (method === 'GET' && settingsMatch) {
      const bindings = workerBindings.get(settingsMatch[1]);
      if (bindings && fetchMock.workerSettingsHiddenReads > 0) {
        fetchMock.workerSettingsHiddenReads -= 1;
        return cfFailure(404, 'Worker not found.');
      }
      return bindings ? cfSuccess({ bindings, main_module: 'worker.mjs' }) : cfFailure(404, 'Worker not found.');
    }
    if (method === 'GET' && /\/storage\/kv\/namespaces\?/.test(normalizedUrl)) {
      if (namespaces.length && fetchMock.namespaceListHiddenReads > 0) {
        fetchMock.namespaceListHiddenReads -= 1;
        return cfSuccess([]);
      }
      return cfSuccess(namespaces);
    }
    if (method === 'POST' && normalizedUrl.endsWith('/storage/kv/namespaces')) {
      namespaceCreates += 1;
      const { title } = JSON.parse(String(init.body || '{}'));
      const namespace = { id: `kv-resume-${namespaceCreates}`, title };
      namespaces.push(namespace);
      return cfSuccess({ id: namespace.id });
    }
    const valueMatch = normalizedUrl.match(/\/storage\/kv\/namespaces\/([^/]+)\/values\/(.+)$/);
    if (valueMatch && method === 'PUT') {
      const valueKey = `${valueMatch[1]}/${valueMatch[2]}`;
      if (valueMatch[2].endsWith(':config') && kvValues.has(valueKey)) {
        finalConfigPuts += 1;
        if (fetchMock.finalConfigPutFailures > 0) {
          fetchMock.finalConfigPutFailures -= 1;
          return cfFailure(503, 'Final config temporarily unavailable.');
        }
      }
      kvValues.set(valueKey, String(init.body || ''));
      return cfSuccess({});
    }
    if (valueMatch && method === 'GET') {
      const valueKey = `${valueMatch[1]}/${valueMatch[2]}`;
      if (fetchMock.configReadbackFailures > 0) {
        fetchMock.configReadbackFailures -= 1;
        return cfFailure(503, 'Config readback temporarily unavailable.');
      }
      return new Response(kvValues.get(valueKey) || '{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const scriptUploadMatch = normalizedUrl.match(/\/workers\/scripts\/([^/?]+)$/);
    if (method === 'PUT' && scriptUploadMatch && init.body instanceof FormData) {
      scriptUploads += 1;
      const metadata = JSON.parse(await new Response(init.body.get('metadata')).text());
      scriptUploadMetadata.push(metadata);
      const response = Array.isArray(fetchMock.scriptUploadResponses) && fetchMock.scriptUploadResponses.length
        ? fetchMock.scriptUploadResponses.shift()
        : cfSuccess({ id: 'worker-uploaded' });
      if (response.ok) workerBindings.set(scriptUploadMatch[1], metadata.bindings || []);
      return response;
    }
    if (method === 'GET' && normalizedUrl.endsWith('/workers/subdomain')) {
      if (fetchMock.subdomainFailures > 0) {
        fetchMock.subdomainFailures -= 1;
        return cfFailure(503, 'Subdomain temporarily unavailable.');
      }
      return cfSuccess({ subdomain: 'tenant-subdomain', status: 'active' });
    }
    if (method === 'POST' && /\/workers\/scripts\/[^/]+\/subdomain$/.test(normalizedUrl)) {
      return cfSuccess({ enabled: true });
    }
    if (method === 'PUT' && /\/workers\/scripts\/[^/]+\/secrets$/.test(normalizedUrl)) {
      const secretBody = JSON.parse(String(init.body || '{}'));
      workerSecretBodies.push(secretBody);
      let response;
      if (Array.isArray(fetchMock.workerSecretPutResponses) && fetchMock.workerSecretPutResponses.length) {
        response = fetchMock.workerSecretPutResponses.shift();
      } else {
        response = cfSuccess({});
      }
      if (response.ok) {
        const workerName = normalizedUrl.match(/\/workers\/scripts\/([^/]+)\/secrets$/)?.[1];
        if (!workerSecretBindings.has(workerName)) workerSecretBindings.set(workerName, new Map());
        workerSecretBindings.get(workerName).set(secretBody.name, {
          name: secretBody.name,
          type: secretBody.type,
        });
      }
      return response;
    }
    const forcedScriptDeleteMatch = normalizedUrl.match(/\/workers\/scripts\/([^/?]+)\?force=true$/);
    if (method === 'DELETE' && forcedScriptDeleteMatch) {
      workerBindings.delete(forcedScriptDeleteMatch[1]);
      workerSecretBindings.delete(forcedScriptDeleteMatch[1]);
      return cfSuccess({});
    }
    const namespaceDeleteMatch = normalizedUrl.match(/\/storage\/kv\/namespaces\/([^/?]+)$/);
    if (method === 'DELETE' && namespaceDeleteMatch) {
      const index = namespaces.findIndex(({ id }) => id === namespaceDeleteMatch[1]);
      if (index >= 0) namespaces.splice(index, 1);
      return cfSuccess({});
    }
    throw new Error(`Unexpected resumable Cloudflare mock call: ${method} ${normalizedUrl}`);
  });
  fetchMock.finalConfigPutFailures = 0;
  fetchMock.configReadbackFailures = 0;
  fetchMock.subdomainFailures = 0;
  fetchMock.bundleFetchMustFail = false;
  fetchMock.workerSettingsHiddenReads = 0;
  fetchMock.namespaceListHiddenReads = 0;
  fetchMock.namespaces = namespaces;
  fetchMock.kvValues = kvValues;
  fetchMock.workerBindings = workerBindings;
  fetchMock.workerSecretBindings = workerSecretBindings;
  fetchMock.workerSecretBodies = workerSecretBodies;
  fetchMock.scriptUploadMetadata = scriptUploadMetadata;
  fetchMock.scriptUploadResponses = [];
  fetchMock.workerSecretPutResponses = [];
  fetchMock.secretListResponses = [];
  fetchMock.accountIdsByToken = new Map();
  fetchMock.getNamespaceCreateCount = () => namespaceCreates;
  fetchMock.getScriptUploadCount = () => scriptUploads;
  fetchMock.getFinalConfigPutCount = () => finalConfigPuts;
  fetchMock.getBundleFetchCount = () => bundleFetches;
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

const makeCoordinatorEnv = (baseEnv = {}) => {
  const env = { ...baseEnv };
  const instances = new Map();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  env.CE_SESSION_COORDINATOR = {
    idFromName: (name) => `coordinator:${name}`,
    get: (id) => {
      if (!instances.has(id)) {
        const store = new Map();
        let tail = Promise.resolve();
        const storage = {
          get: async (key) => store.get(key),
          put: async (key, value) => store.set(key, clone(value)),
          transaction: (callback) => {
            const run = tail.then(() => callback({
              get: async (key) => store.get(key),
              put: async (key, value) => store.set(key, clone(value)),
            }));
            tail = run.catch(() => undefined);
            return run;
          },
        };
        const coordinator = new SessionWriteCoordinator({ storage }, env);
        instances.set(id, {
          fetch: (input, init) => coordinator.fetch(
            input instanceof Request ? input : new Request(input, init),
          ),
          store,
        });
      }
      return instances.get(id);
    },
  };
  env.__coordinatorInstances = instances;
  return env;
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
    workerName: expect.stringMatching(/^test-worker-[0-9a-f]{12}$/),
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
    workerName: expect.stringMatching(/^test-worker-[0-9a-f]{12}$/),
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

const findScriptUploadCall = (fetchMock) => fetchMock.calls.find(([url, init = {}]) => (
  String(init.method || '').toUpperCase() === 'PUT' &&
  /\/workers\/scripts\/[^/?]+$/.test(String(url)) &&
  init.body instanceof FormData
));

const findConfigWriteCall = (fetchMock) => fetchMock.calls.find(([url, init = {}]) => (
  String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':config')
));

const expectPendingDeploy = async (responsePromise) => {
  const response = await responsePromise;
  expect(response.status).toBe(503);
  expect((await response.json()).deploymentRequestPending).toBe(true);
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
      expect(fetchMock.calls.length).toBe(9);
      expectBundleDiagnosticsLog(consoleLogSpy, 'bundleUrl');

      const scriptUpload = findScriptUploadCall(fetchMock);
      const uploadForm = scriptUpload[1].body;
      const uploadMetadata = await readScriptUploadMetadata(scriptUpload);
      expect(uploadMetadata.main_module).toBe('worker.mjs');
      expect(uploadMetadata.bindings).toContainEqual({
        name: 'CE_SESSION_COORDINATOR',
        type: 'durable_object_namespace',
        class_name: 'SessionWriteCoordinator',
      });
      expect(uploadMetadata.migrations).toEqual({
        old_tag: '',
        new_tag: 'ce-session-write-coordinator-v1',
        new_sqlite_classes: ['SessionWriteCoordinator'],
      });
      expect(uploadMetadata.bindings.some((binding) => binding.name === 'CE_STORAGE_INDEX_KV')).toBe(false);
      expect(uploadForm.get('worker.mjs')).toBeTruthy();
      expect(uploadForm.get('worker.js')).toBeNull();
      const workerSecretWrites = fetchMock.calls
        .filter(([url]) => String(url).endsWith(`/workers/scripts/${payload.workerName}/secrets`))
        .map(([, init]) => JSON.parse(init.body));
      expect(workerSecretWrites.map((secret) => secret.name)).toEqual(['TOKEN_HMAC_SECRET']);

      const configWrite = findConfigWriteCall(fetchMock);
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
        `https://${payload.workerName}.tenant-subdomain.workers.dev/` // intentional: real URL — tests worker URL construction
      );
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('derives the deploy account from the token even when a caller injects accountId', async () => {
    const fetchMock = makeFetchSequence([]);
    fetchMock.accountLookupOverride = cfSuccess([
      { id: 'account-a', name: 'Account A' },
      { id: 'account-b', name: 'Account B' },
    ]);
    global.fetch = fetchMock;

    const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token',
      accountId: 'attacker-selected-account',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      bundleText: 'export default { fetch() {} };',
    }), {}, {});
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload?.error).toMatch(/restrict the token to exactly one account/i);
    expect(fetchMock.calls).toHaveLength(0);
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
      ).toHaveLength(2);
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
      expect(payload?.orphanResources).toEqual({
        kvNamespaceId: 'kv-123',
        kvCleanupStatus: 'delete-failed',
        workerName: '',
      });
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

  it('retries the adjacent secrets envelope with an identical body while fresh KV propagates', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const propagationFailure = cfFailure(404, "get namespace: 'namespace not found'", [
      { code: 10013, message: "get namespace: 'namespace not found'" },
    ]);
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
    ]);
    fetchMock.secretsPutResponses = [propagationFailure, cfSuccess({})];
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText: 'export default { fetch() {} };',
        secrets: { openaiKey: 'sk-retry-once' },
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload?.configVerified).toBe(true);
      const secretWrites = fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':secrets')
      ));
      expect(secretWrites).toHaveLength(2);
      expect(secretWrites[0][1].body).toBe(secretWrites[1][1].body);
      expect(JSON.parse(secretWrites[1][1].body).secrets.openaiKey).toBe('sk-retry-once');
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'DELETE' &&
        String(url).endsWith('/storage/kv/namespaces/kv-123')
      ))).toBe(false);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('cleans up after fresh-KV secrets envelope propagation retries are exhausted', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const propagationFailure = () => cfFailure(404, "get namespace: 'namespace not found'", [
      { code: 10013, message: "get namespace: 'namespace not found'" },
    ]);
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.secretsPutResponses = [
      propagationFailure(),
      propagationFailure(),
      propagationFailure(),
      propagationFailure(),
    ];
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText: 'export default { fetch() {} };',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.error).toBe("get namespace: 'namespace not found'");
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':secrets')
      ))).toHaveLength(4);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'DELETE' &&
        String(url).endsWith('/storage/kv/namespaces/kv-123')
      ))).toHaveLength(1);
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' &&
        /\/workers\/scripts\/test-worker-[0-9a-f]{12}$/.test(String(url))
      ))).toBe(false);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('does not retry an unrelated secrets envelope write error', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.secretsPutResponses = [cfFailure(404, 'KV value path was not found.')];
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText: 'export default { fetch() {} };',
      }), {}, {});

      expect(response.status).toBe(502);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':secrets')
      ))).toHaveLength(1);
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
      const uploadMetadata = await readScriptUploadMetadata(findScriptUploadCall(fetchMock));
      expect(uploadMetadata.bindings).toEqual(expect.arrayContaining([
        { name: 'CE_STORAGE_INDEX_KV', type: 'kv_namespace', namespace_id: 'kv-123' },
      ]));

      const workerSecretWrites = fetchMock.calls
        .filter(([url]) => String(url).endsWith(`/workers/scripts/${payload.workerName}/secrets`))
        .map(([, init]) => JSON.parse(init.body));
      expect(workerSecretWrites.map((secret) => secret.name)).toEqual([
        'CE_STORAGE_ENVELOPE_KEK',
        'TOKEN_HMAC_SECRET',
      ]);
      const envelopeKek = workerSecretWrites[0].text;
      const tokenSecret = workerSecretWrites[1].text;
      expect(envelopeKek).toMatch(/^[0-9a-f]{64}$/);
      expect(envelopeKek).not.toBe(tokenSecret);

      const configWrite = JSON.parse(findConfigWriteCall(fetchMock)[1].body);
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

  it('keeps login inactive when envelope KEK provisioning fails', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.workerSecretPutResponses = [cfFailure(500, 'envelope KEK write failed')];
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText: 'export default { fetch() {} };',
        storageProfile: {
          backend: 'cloudflare',
          payloadAccessControl: { gate: 'none', encryption: 'worker_envelope' },
        },
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.error).toBe('envelope KEK write failed');
      const runtimeSecrets = fetchMock.calls
        .filter(([url]) => /\/workers\/scripts\/test-worker-[0-9a-f]{12}\/secrets$/.test(String(url)))
        .map(([, init]) => JSON.parse(init.body).name);
      expect(runtimeSecrets).toEqual(['CE_STORAGE_ENVELOPE_KEK']);
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: '', workerName: '' });
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('writes TOKEN_HMAC_SECRET last and rolls back if the final activation gate fails', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.workerSecretPutResponses = [
      cfSuccess({}),
      cfFailure(500, 'HMAC activation failed'),
    ];
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText: 'export default { fetch() {} };',
        storageProfile: {
          backend: 'cloudflare',
          payloadAccessControl: { gate: 'none', encryption: 'worker_envelope' },
        },
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.error).toBe('HMAC activation failed');
      const runtimeSecrets = fetchMock.calls
        .filter(([url]) => /\/workers\/scripts\/test-worker-[0-9a-f]{12}\/secrets$/.test(String(url)))
        .map(([, init]) => JSON.parse(init.body).name);
      expect(runtimeSecrets).toEqual(['CE_STORAGE_ENVELOPE_KEK', 'TOKEN_HMAC_SECRET']);
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: '', workerName: '' });
    } finally {
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
      const configWrite = JSON.parse(findConfigWriteCall(fetchMock)[1].body);
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

      const scriptUploadMetadata = await readScriptUploadMetadata(findScriptUploadCall(fetchMock));
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
      const sessionSecretsIndex = fetchMock.calls.findIndex(([url]) => String(url).endsWith(':secrets'));
      const scriptUploadIndex = fetchMock.calls.findIndex(([url, init = {}]) => (
        /\/workers\/scripts\/[^/?]+$/.test(String(url)) && init.method === 'PUT'
      ));
      const workerSecretWriteIndices = fetchMock.calls
        .map(([url], index) => (String(url).endsWith('/secrets') ? index : -1))
        .filter((index) => index >= 0);
      expect(sessionSecretsIndex).toBeGreaterThanOrEqual(0);
      expect(sessionSecretsIndex).toBeLessThan(scriptUploadIndex);
      expect(workerSecretWriteIndices).not.toHaveLength(0);
      expect(workerSecretWriteIndices.every((index) => index > configReadbackIndex)).toBe(true);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('keeps explicit-Lit worker RPC credentials in the secret-only record instead of canonical config', async () => {
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
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'lit-session',
        sessionId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        adminAddress: '0x00000000000000000000000000000000000000aa',
        networkChainId: 11155420,
        rpcUrl: 'https://rpc.example.test',
        rpcUrlsByChainId: { 11155420: ['https://rpc.example.test'] },
        sessionModeProfile: {
          authority: { mode: 'worker_canonical' },
          encryption: { mode: 'lit' },
        },
        bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
        secrets: {
          customRpcUrl: 'https://rpc.example.test',
          customRpcKey: 'rpc-secret',
          litAccountApiKey: 'lit-secret',
        },
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload?.ok).toBe(true);
      const configWrite = JSON.parse(findConfigWriteCall(fetchMock)[1].body);
      expect(configWrite.rpcUrl).toBeUndefined();
      expect(configWrite.rpcUrlsByChainId).toBeUndefined();
      expect(configWrite.sessionModeProfile.encryption).toEqual({ mode: 'lit' });

      const secretsWrite = fetchMock.calls.find(([url]) => String(url).endsWith(':secrets'));
      const secretsEnvelope = JSON.parse(secretsWrite[1].body);
      expect(secretsEnvelope.secrets).toEqual({
        customRpcUrl: 'https://rpc.example.test',
        customRpcKey: 'rpc-secret',
        litAccountApiKey: 'lit-secret',
      });
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

  it('randomizes a legacy physical worker name before checking for an existing script', async () => {
    const fetchMock = makeFetchSequence([]);
    fetchMock.workerNamePreflightOverride = cfSuccess({ compatibility_date: '2024-09-02' });
    global.fetch = fetchMock;

    const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token',
      accountId: 'acc-123',
      workerName: 'existing-worker',
      sessionSlug: 'alpha-session',
      allowOverwrite: true,
      bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
      storageProfile: {
        backend: 'cloudflare',
        payloadAccessControl: { gate: 'sbt_gate', encryption: 'worker_envelope' },
      },
    }), {}, {});
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload?.error).toContain('In-place redeploy is disabled');
    expect(payload?.error).toContain('protect existing worker state');
    expect(fetchMock.workerNamePreflightCalls).toHaveLength(1);
    expect(String(fetchMock.workerNamePreflightCalls[0][0])).toMatch(
      /\/workers\/scripts\/existing-worker-[0-9a-f]{12}\/settings$/
    );
    expect(fetchMock.calls).toHaveLength(0);
  });

  it('aborts a legacy redeploy before mutation when worker existence cannot be determined', async () => {
    const fetchMock = makeFetchSequence([]);
    fetchMock.workerNamePreflightOverride = cfFailure(503, 'worker lookup unavailable');
    global.fetch = fetchMock;

    const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token',
      accountId: 'acc-123',
      workerName: 'existing-worker',
      sessionSlug: 'alpha-session',
      bundleText: 'export default { fetch() {} };',
    }), {}, {});
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload?.error).toBe('worker lookup unavailable');
    expect(fetchMock.calls.some(([, init = {}]) => (
      ['POST', 'PUT', 'DELETE'].includes(String(init.method || '').toUpperCase())
    ))).toBe(false);
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

      const uploadMetadata = await readScriptUploadMetadata(findScriptUploadCall(fetchMock));
      expect(uploadMetadata.bindings).toEqual(expect.arrayContaining([
        { name: 'GROUP_KV', type: 'kv_namespace', namespace_id: 'kv-123' },
        { name: 'CE_STORAGE_INDEX_KV', type: 'kv_namespace', namespace_id: 'kv-123' },
      ]));
      expect(uploadMetadata.bindings.some((binding) => binding.name === 'CE_STORAGE_R2')).toBe(false);

      const configWrite = JSON.parse(findConfigWriteCall(fetchMock)[1].body);
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
      expect(configRewrite.corsWorkerUrl).toBe(`https://${payload.workerName}.tenant-subdomain.workers.dev/`);
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
      const uploadMetadata = await readScriptUploadMetadata(findScriptUploadCall(fetchMock));
      expect(uploadMetadata.bindings).toEqual(expect.arrayContaining([
        { name: 'CE_STORAGE_INDEX_KV', type: 'kv_namespace', namespace_id: 'kv-123' },
        { name: 'CE_STORAGE_R2', type: 'r2_bucket', bucket_name: 'ce-session-payloads' },
      ]));

      const configWrite = JSON.parse(findConfigWriteCall(fetchMock)[1].body);
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

  it.each([
    { status: 404, result: cfSuccess([]), label: 'no visible account' },
    {
      status: 409,
      result: new Response(JSON.stringify({
        success: true,
        result: [{ id: 'account-a' }, { id: 'account-b' }],
        result_info: { total_count: 2 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      label: 'ambiguous account set',
    },
  ])('preserves the safe $status account lookup status for /account and /deploy ($label)', async ({ status, result }) => {
    const fetchMock = jest.fn(async () => result.clone());
    global.fetch = fetchMock;

    const accountResponse = await deployHelperWorker.fetch(makeJsonRequest('/account', {
      apiToken: 'cf-token',
    }), {}, {});
    const deployResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      bundleText: 'export default { fetch() {} };',
    }), {}, {});

    expect(accountResponse.status).toBe(status);
    expect(deployResponse.status).toBe(status);
    expect((await accountResponse.json()).error).toBeTruthy();
    expect((await deployResponse.json()).error).toBeTruthy();
  });

  it('continues to map Cloudflare account 5xx responses to the helper 502 boundary', async () => {
    global.fetch = jest.fn(async () => cfFailure(503, 'Cloudflare accounts unavailable.'));

    const accountResponse = await deployHelperWorker.fetch(makeJsonRequest('/account', {
      apiToken: 'cf-token',
    }), {}, {});
    const deployResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      bundleText: 'export default { fetch() {} };',
    }), {}, {});

    expect(accountResponse.status).toBe(502);
    expect(deployResponse.status).toBe(502);
  });

  it('returns a structured 502 when fetching the worker bundle fails', async () => {
    global.fetch = async (url) => {
      if (/\/accounts\?per_page=5$/.test(String(url))) {
        return cfSuccess([{ id: 'acc-123', name: 'Derived test account' }]);
      }
      if (/\/workers\/scripts\/test-worker-[0-9a-f]{12}\/settings$/.test(String(url))) {
        return cfFailure(404, 'Worker not found.');
      }
      if (/\/accounts\/acc-123\/workers\/subdomain$/.test(String(url))) {
        return cfSuccess({ subdomain: 'tenant-subdomain', status: 'active' });
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

  it('seeds the URL-bearing final config once before attaching the script', async () => {
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

      expect(response.status).toBe(200);
      expect(payload?.workerUrl).toMatch(/\.tenant-subdomain\.workers\.dev\/$/);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':config')
      ))).toHaveLength(1);
      expect(fetchMock.calls.some(([url]) => String(url).endsWith(':secrets'))).toBe(true);
      expect(fetchMock.calls.some(([url]) => String(url).endsWith('/secrets'))).toBe(true);
      expectBundleDiagnosticsLog(consoleLogSpy, 'bundleUrl');
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('rolls back instead of surfacing a worker URL when the script subdomain stays disabled', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.scriptSubdomainOverride = cfSuccess({ enabled: false });
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
      expect(payload?.error).toMatch(/did not enable workers\.dev/i);
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: '', workerName: '' });
      expect(fetchMock.calls.some(([url, init = {}]) => (
        /\/workers\/scripts\/test-worker-[0-9a-f]{12}\?force=true$/.test(String(url)) && init.method === 'DELETE'
      ))).toBe(true);
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(url).endsWith('/storage/kv/namespaces/kv-123') && init.method === 'DELETE'
      ))).toBe(true);
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

  it('does not treat a nonempty foreign revision as fresh-namespace propagation lag', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.kvReadbackResponses = [new Response(JSON.stringify({
      slug: 'alpha-session',
      configRevision: 'revision-old',
      corsWorkerUrl: 'https://test-worker.tenant-subdomain.workers.dev/',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })];
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        configRevision: 'revision-new',
        bundleText: 'export default { fetch() {} };',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.configVerified).toBeUndefined();
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || 'GET').toUpperCase() === 'GET' && String(url).endsWith(':config')
      ))).toHaveLength(1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('retries an empty readback while the single final config write propagates', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
    ]);
    fetchMock.kvReadbackResponses = [new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })];
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        configRevision: 'revision-same',
        bundleText: 'export default { fetch() {} };',
      }), {}, {});

      expect(response.status).toBe(200);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || 'GET').toUpperCase() === 'GET' && String(url).endsWith(':config')
      ))).toHaveLength(2);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('retries the narrow fresh-namespace 404 during final config readback', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
    ]);
    fetchMock.kvReadbackResponses = [cfFailure(404, "get namespace: 'namespace not found'", [
      { code: 10013, message: "get namespace: 'namespace not found'" },
    ])];
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        configRevision: 'revision-new',
        bundleText: 'export default { fetch() {} };',
      }), {}, {});

      expect(response.status).toBe(200);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || 'GET').toUpperCase() === 'GET' && String(url).endsWith(':config')
      ))).toHaveLength(2);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('fails closed on a nonempty foreign revision instead of treating it as propagation lag', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.kvReadbackResponses = Array.from({ length: 4 }, () => new Response(JSON.stringify({
      slug: 'alpha-session',
      configRevision: 'revision-old',
      corsWorkerUrl: 'https://test-worker.tenant-subdomain.workers.dev/',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        configRevision: 'revision-new',
        bundleText: 'export default { fetch() {} };',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.error).toBe('Worker config verification failed after deployment.');
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || 'GET').toUpperCase() === 'GET' && String(url).endsWith(':config')
      ))).toHaveLength(1);
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: '', workerName: '' });
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('does not retry a same-revision identity mismatch', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.kvReadbackOverride = new Response(JSON.stringify({
      slug: 'foreign-session',
      configRevision: 'revision-new',
      corsWorkerUrl: 'https://foreign.example.test/',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        configRevision: 'revision-new',
        bundleText: 'export default { fetch() {} };',
      }), {}, {});

      expect(response.status).toBe(502);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || 'GET').toUpperCase() === 'GET' && String(url).endsWith(':config')
      ))).toHaveLength(1);
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

  it('cleans up staged KV without uploading a script when the session secrets write fails', async () => {
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
      expect(fetchMock.calls.some(([url, init = {}]) => (
        /\/workers\/scripts\/test-worker-[0-9a-f]{12}(?:\?|$)/.test(String(url)) && init.method === 'PUT'
      ))).toBe(false);
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(url).endsWith('/storage/kv/namespaces/kv-123') && init.method === 'DELETE'
      ))).toBe(true);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('cleans up the staged session store when the post-verification runtime secret write fails', async () => {
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
      expect(fetchMock.calls.some(([url]) => String(url).endsWith(':secrets'))).toBe(true);
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
      expect(payload?.deploymentId).toMatch(/^[0-9a-f]{64}$/);
      expect(payload?.orphanResources).toEqual({
        kvNamespaceId: 'kv-123',
        kvCleanupStatus: 'retained-live-worker',
        workerName: expect.stringMatching(/^test-worker-[0-9a-f]{12}$/),
        workerCleanupStatus: 'ownership-changed',
      });
      expect(fetchMock.calls.some(([url, init = {}]) => (
        /\/workers\/scripts\/test-worker-[0-9a-f]{12}\?force=true$/.test(String(url)) && init.method === 'DELETE'
      ))).toBe(false);
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(url).endsWith('/storage/kv/namespaces/kv-123') && init.method === 'DELETE'
      ))).toBe(false);
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
      shouldDeleteKv: false,
    },
    {
      label: 'retains KV when post-upload ownership remains hidden behind 404',
      settingsOverride: cfFailure(404, 'Worker not found.'),
      expectedOrphans: {
        kvNamespaceId: 'kv-123',
        kvCleanupStatus: 'retained-live-worker',
        workerName: expect.stringMatching(/^canonical-worker-[0-9a-f]{12}$/),
        workerCleanupStatus: 'ownership-unverified',
      },
      shouldDeleteScript: false,
      shouldDeleteKv: false,
    },
    {
      label: 'preserves a changed deployment owner',
      settingsOverride: cfSuccess({
        bindings: [{ name: 'CE_DEPLOYMENT_ID', type: 'plain_text', text: 'different-deployment' }],
      }),
      expectedOrphans: {
        kvNamespaceId: 'kv-123',
        kvCleanupStatus: 'retained-live-worker',
        workerName: expect.stringMatching(/^canonical-worker-[0-9a-f]{12}$/),
        workerCleanupStatus: 'ownership-changed',
      },
      shouldDeleteScript: false,
      shouldDeleteKv: false,
    },
    {
      label: 'reports indeterminate ownership with an exact retryable physical name',
      settingsOverride: cfFailure(503, 'Settings unavailable.'),
      expectedOrphans: {
        kvNamespaceId: 'kv-123',
        kvCleanupStatus: 'retained-live-worker',
        workerName: expect.stringMatching(/^canonical-worker-[0-9a-f]{12}$/),
        workerCleanupStatus: 'ownership-unverified',
      },
      shouldDeleteScript: false,
      shouldDeleteKv: false,
    },
  ])('$label after an ambiguous canonical script upload failure', async ({
    settingsOverride,
    scriptDeleteResponse,
    expectedOrphans,
    expectedOwnedDeleteFailure,
    shouldDeleteScript,
    shouldDeleteKv = true,
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
          kvNamespaceId: 'kv-123',
          kvCleanupStatus: 'retained-live-worker',
          workerName: expect.stringMatching(/^canonical-worker-[0-9a-f]{12}$/),
          workerCleanupStatus: 'owned-delete-failed',
        });
      } else {
        expect(payload?.orphanResources).toEqual(expectedOrphans);
      }
      const scriptDeleteCalls = fetchMock.calls.filter(([url, init = {}]) => (
        /\/workers\/scripts\/canonical-worker-[0-9a-f]{12}\?force=true$/.test(String(url)) && init.method === 'DELETE'
      ));
      expect(scriptDeleteCalls).toHaveLength(shouldDeleteScript ? 1 : 0);
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(url).endsWith('/storage/kv/namespaces/kv-123') && init.method === 'DELETE'
      ))).toBe(shouldDeleteKv);
    } finally {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });

  it('aborts and removes staged KV when an explicit worker name is claimed before upload', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({}),
    ]);
    fetchMock.workerSecondPreflightOverride = cfSuccess({
      bindings: [{ name: 'CE_DEPLOYMENT_ID', type: 'plain_text', text: 'other-deployment' }],
    });
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText: 'export default { fetch() {} };',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(409);
      expect(payload?.error).toMatch(/became unavailable/i);
      expect(payload?.orphanResources).toEqual({ kvNamespaceId: '', workerName: '' });
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' &&
        /\/workers\/scripts\/test-worker-[0-9a-f]{12}$/.test(String(url))
      ))).toBe(false);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'DELETE' &&
        String(url).endsWith('/storage/kv/namespaces/kv-123')
      ))).toHaveLength(1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('gives concurrent same-prefix deploys distinct physical worker names', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const workerBindingsByName = new Map();
    let kvCreates = 0;
    let scriptUploads = 0;
    const kvValues = new Map();
    global.fetch = jest.fn(async (url, init = {}) => {
      const normalizedUrl = String(url);
      const method = String(init.method || 'GET').toUpperCase();
      if (method === 'GET' && /\/accounts\?per_page=5$/.test(normalizedUrl)) {
        return cfSuccess([{ id: 'acc-123', name: 'Derived test account' }]);
      }
      const settingsMatch = normalizedUrl.match(/\/workers\/scripts\/([^/]+)\/settings$/);
      if (method === 'GET' && settingsMatch) {
        const workerBindings = workerBindingsByName.get(settingsMatch[1]);
        return workerBindings
          ? cfSuccess({ bindings: workerBindings })
          : cfFailure(404, 'Worker not found.');
      }
      if (method === 'POST' && normalizedUrl.endsWith('/storage/kv/namespaces')) {
        kvCreates += 1;
        return cfSuccess({ id: `kv-${kvCreates}` });
      }
      if (/\/storage\/kv\/namespaces\/kv-\d+\/values\//.test(normalizedUrl)) {
        if (method === 'PUT') {
          kvValues.set(normalizedUrl, init.body);
          return cfSuccess({});
        }
        if (method === 'GET') {
          return new Response(kvValues.get(normalizedUrl) || '{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      const scriptMatch = normalizedUrl.match(/\/workers\/scripts\/([^/]+)$/);
      if (method === 'PUT' && scriptMatch && init.body instanceof FormData) {
        scriptUploads += 1;
        const metadata = JSON.parse(await new Response(init.body.get('metadata')).text());
        workerBindingsByName.set(scriptMatch[1], metadata.bindings);
        return cfSuccess({ id: 'worker-uploaded' });
      }
      if (method === 'GET' && normalizedUrl.endsWith('/workers/subdomain')) {
        return cfSuccess({ subdomain: 'tenant-subdomain', status: 'active' });
      }
      if (method === 'POST' && /\/workers\/scripts\/[^/]+\/subdomain$/.test(normalizedUrl)) {
        return cfSuccess({ enabled: true });
      }
      if (method === 'PUT' && /\/workers\/scripts\/[^/]+\/secrets$/.test(normalizedUrl)) {
        return cfSuccess({});
      }
      throw new Error(`Unexpected Cloudflare mock call: ${method} ${normalizedUrl}`);
    });

    try {
      const body = {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText: 'export default { fetch() {} };',
      };
      const [firstResponse, secondResponse] = await Promise.all([
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), {}, {}),
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), {}, {}),
      ]);
      const [first, second] = await Promise.all([firstResponse.json(), secondResponse.json()]);

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(first.workerName).toMatch(/^test-worker-[0-9a-f]{12}$/);
      expect(second.workerName).toMatch(/^test-worker-[0-9a-f]{12}$/);
      expect(first.workerName).not.toBe(second.workerName);
      expect(kvCreates).toBe(2);
      expect(scriptUploads).toBe(2);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('fails a stable deployment closed before Cloudflare access when its coordinator binding is absent', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('Cloudflare must not be called without deployment coordination');
    });

    const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token-must-not-run',
      deploymentRequestId: 'request-without-coordinator-0001',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      bundleText: 'export default { fetch() {} };',
    }), { DEPLOY_HELPER_KV: makeKvBinding() }, {});

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expect.objectContaining({
      deploymentRequestPending: true,
      error: expect.stringMatching(/CE_SESSION_COORDINATOR.*no Cloudflare mutation/i),
    }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('globally serializes concurrent stable deployments and stores no request credentials in the coordinator', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeResumableDeploymentFetch();
    global.fetch = fetchMock;
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: makeKvBinding() });
    const body = {
      apiToken: 'cf-concurrent-secret-token',
      deploymentRequestId: 'request-concurrent-coordinator-0001',
      workerName: 'coordinated-worker',
      sessionSlug: 'coordinated-session',
      bundleText: 'export default { fetch() { return new Response("secret bundle"); } };',
      secrets: { openaiKey: 'sk-concurrent-provider-secret' },
    };

    try {
      const responses = await Promise.all([
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {}),
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {}),
      ]);
      const statuses = responses.map(({ status }) => status).sort((left, right) => left - right);
      expect(statuses).toEqual([200, 503]);
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);

      const replay = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        ...body,
        apiToken: 'cf-rotated-same-account-token',
        sessionName: 'Mutable replay drift',
      }), env, {});
      expect(replay.status).toBe(200);
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);

      const coordinatorState = JSON.stringify(
        [...env.__coordinatorInstances.values()].flatMap(({ store }) => [...store.values()]),
      );
      expect(coordinatorState).not.toContain(body.apiToken);
      expect(coordinatorState).not.toContain('cf-rotated-same-account-token');
      expect(coordinatorState).not.toContain(body.bundleText);
      expect(coordinatorState).not.toContain('sk-concurrent-provider-secret');
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('retries an already-applied coordinator migration without dropping its binding', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeResumableDeploymentFetch();
    fetchMock.scriptUploadResponses = [
      cfFailure(412, 'Migration tag precondition failed: tag already applied.'),
      cfSuccess({ id: 'worker-uploaded' }),
    ];
    global.fetch = fetchMock;
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: makeKvBinding() });

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        deploymentRequestId: 'request-coordinator-migration-0001',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText: 'export default { fetch() {} };',
      }), env, {});

      expect(response.status).toBe(200);
      expect(fetchMock.getScriptUploadCount()).toBe(2);
      expect(fetchMock.scriptUploadMetadata[0].migrations).toEqual({
        old_tag: '',
        new_tag: 'ce-session-write-coordinator-v1',
        new_sqlite_classes: ['SessionWriteCoordinator'],
      });
      expect(fetchMock.scriptUploadMetadata[1].migrations).toBeUndefined();
      expect(fetchMock.scriptUploadMetadata[1].bindings).toContainEqual({
        name: 'CE_SESSION_COORDINATOR',
        type: 'durable_object_namespace',
        class_name: 'SessionWriteCoordinator',
      });
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('replays a committed terminal deploy journal result and rejects a changed request body', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeDeploymentRequestFetchSequence([
      cfSuccess({ id: 'kv-request-1' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
    ]);
    global.fetch = fetchMock;
    const journalKv = makeKvBinding();
    const normalPut = journalKv.put.bind(journalKv);
    let loseTerminalWriteResponse = true;
    const journalPutKeys = [];
    journalKv.put = async (key, value, options) => {
      journalPutKeys.push(key);
      await normalPut(key, value, options);
      const parsed = JSON.parse(value);
      if (parsed?.state === 'terminal' && loseTerminalWriteResponse) {
        loseTerminalWriteResponse = false;
        throw new TypeError('terminal journal response lost');
      }
    };
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken: 'cf-token',
      deploymentRequestId: 'request-loss-0001',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      bundleText: 'export default { fetch() {} };',
      secrets: { openaiKey: 'sk-journal-secret' },
    };

    try {
      await expectPendingDeploy(
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {}),
      );

      const cloudflareCallsAfterCommit = fetchMock.calls.length;
      const replayResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        secrets: body.secrets,
        bundleText: body.bundleText,
        sessionSlug: body.sessionSlug,
        workerName: body.workerName,
        deploymentRequestId: body.deploymentRequestId,
        apiToken: body.apiToken,
      }), env, {});
      const replay = await replayResponse.json();

      expect(replayResponse.status).toBe(200);
      expect(replay).toEqual(expect.objectContaining({
        ok: true,
        workerName: expect.stringMatching(/^test-worker-[0-9a-f]{12}$/),
        kvNamespaceId: 'kv-request-1',
      }));
      expect(fetchMock.calls).toHaveLength(cloudflareCallsAfterCommit);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'POST' &&
        String(url).endsWith('/storage/kv/namespaces')
      ))).toHaveLength(1);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' &&
        /\/workers\/scripts\/[^/?]+$/.test(String(url))
      ))).toHaveLength(1);
      expect(JSON.stringify([...journalKv.store.values()])).not.toContain('cf-token');
      expect(JSON.stringify([...journalKv.store.values()])).not.toContain('export default');
      expect(JSON.stringify([...journalKv.store.values()])).not.toContain('sk-journal-secret');
      expect(journalPutKeys).toHaveLength(3);
      expect(new Set(journalPutKeys).size).toBe(journalPutKeys.length);
      expect([...journalKv.store.values()].map((value) => JSON.parse(value).state).sort()).toEqual([
        'reserved',
        'terminal',
        'upload_started',
      ]);

      const driftReplayResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        ...body,
        apiToken: 'cf-rotated-token-for-same-account',
        sessionName: 'Mutable fields do not redeploy terminal infrastructure',
        limits: { requestsPerMinute: 99 },
      }), env, {});
      const driftReplay = await driftReplayResponse.json();
      expect(driftReplayResponse.status).toBe(200);
      expect(driftReplay.workerName).toBe(replay.workerName);
      expect(fetchMock.calls).toHaveLength(cloudflareCallsAfterCommit);

      const changedResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        ...body,
        sessionSlug: 'changed-session',
      }), env, {});
      expect(changedResponse.status).toBe(409);
      expect(await changedResponse.json()).toEqual(expect.objectContaining({
        error: expect.stringMatching(/different immutable deployment identity/i),
        deploymentRequestConflict: true,
      }));
      expect(fetchMock.calls).toHaveLength(cloudflareCallsAfterCommit);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('resumes after secrets with mutable/token drift without rotating existing runtime secrets', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeResumableDeploymentFetch();
    global.fetch = fetchMock;
    const journalKv = makeKvBinding();
    const normalPut = journalKv.put.bind(journalKv);
    let failTerminalWriteBeforeCommit = true;
    journalKv.put = async (key, value, options) => {
      const parsed = JSON.parse(value);
      if (parsed?.state === 'terminal' && failTerminalWriteBeforeCommit) {
        failTerminalWriteBeforeCommit = false;
        throw new TypeError('terminal journal did not commit');
      }
      await normalPut(key, value, options);
    };
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken: 'cf-resume-secret-token',
      deploymentRequestId: 'request-resume-0001',
      workerName: 'resume-worker',
      sessionSlug: 'resume-session',
      bundleText: 'export default { fetch() {} };',
      storageProfile: {
        backend: 'cloudflare',
        payloadAccessControl: { gate: 'none', encryption: 'worker_envelope' },
      },
      secrets: { openaiKey: 'sk-provider-before-resume' },
    };

    try {
      await expectPendingDeploy(
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {}),
      );
      expect(JSON.parse([...journalKv.store.values()][0]).state).toBe('reserved');
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);
      expect(fetchMock.workerSecretBodies).toHaveLength(2);

      const retryResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        ...body,
        apiToken: 'cf-rotated-resume-token',
        sessionName: 'Recovered mutable config',
        secrets: { openaiKey: 'sk-provider-after-resume' },
      }), env, {});
      const retryPayload = await retryResponse.json();

      expect(retryResponse.status).toBe(200);
      expect(retryPayload).toEqual(expect.objectContaining({
        ok: true,
        kvNamespaceId: 'kv-resume-1',
        workerName: expect.stringMatching(/^resume-worker-[0-9a-f]{12}$/),
        tokenSecretPreserved: true,
        envelopeKekSecretPreserved: true,
        writesSessionSecrets: false,
      }));
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);
      expect(fetchMock.getFinalConfigPutCount()).toBe(1);
      expect(fetchMock.workerSecretBodies).toHaveLength(2);
      const sessionSecretWrites = fetchMock.mock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'PUT' && String(url).endsWith(':secrets')
      ));
      expect(sessionSecretWrites).toHaveLength(1);
      expect(sessionSecretWrites[0][1].body).toContain('sk-provider-before-resume');
      expect(sessionSecretWrites[0][1].body).not.toContain('sk-provider-after-resume');
      expect(fetchMock.workerSecretBodies.map(({ text }) => text)).toEqual(
        expect.arrayContaining([expect.stringMatching(/^[0-9a-f]{64}$/)]),
      );
      const serializedJournal = JSON.stringify([...journalKv.store.values()]);
      expect(serializedJournal).not.toContain('cf-resume-secret-token');
      expect(serializedJournal).not.toContain('cf-rotated-resume-token');
      fetchMock.workerSecretBodies.forEach(({ text }) => expect(serializedJournal).not.toContain(text));

      fetchMock.accountIdsByToken.set('cf-token-for-other-account', 'acc-other');
      const accountConflict = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        ...body,
        apiToken: 'cf-token-for-other-account',
      }), env, {});
      expect(accountConflict.status).toBe(409);
      expect(await accountConflict.json()).toEqual(expect.objectContaining({
        deploymentRequestConflict: true,
        error: expect.stringMatching(/different Cloudflare account/i),
      }));
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);
      expect(fetchMock.workerSecretBodies).toHaveLength(2);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('never deletes resumed Worker or KV resources after journal loss and a later activation failure', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeResumableDeploymentFetch();
    global.fetch = fetchMock;
    const journalKv = makeKvBinding();
    const normalPut = journalKv.put.bind(journalKv);
    let failTerminalWriteBeforeCommit = true;
    journalKv.put = async (key, value, options) => {
      const parsed = JSON.parse(value);
      if (parsed?.state === 'terminal' && failTerminalWriteBeforeCommit) {
        failTerminalWriteBeforeCommit = false;
        throw new TypeError('terminal journal did not commit');
      }
      await normalPut(key, value, options);
    };
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken: 'cf-resume-resource-owner-token',
      deploymentRequestId: 'request-resume-preserve-resources-0001',
      workerName: 'preserve-worker',
      sessionSlug: 'preserve-session',
      bundleText: 'export default { fetch() {} };',
    };

    try {
      await expectPendingDeploy(
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {}),
      );
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);

      // Model expiration/loss of every inner KV journal key. The DO still
      // permits a same-identity retry, but recovered infrastructure is never
      // considered created by this invocation.
      journalKv.store.clear();
      fetchMock.secretListResponses.push(cfFailure(503, 'Secret inventory unavailable.'));

      const retryResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
      const retryPayload = await retryResponse.json();
      expect(retryResponse.status).toBe(502);
      expect(retryPayload.deploymentRequestPending).toBe(true);
      expect(retryPayload.orphanResources).toEqual(expect.objectContaining({
        kvNamespaceId: 'kv-resume-1',
        kvCleanupStatus: 'retained-pre-existing',
        workerCleanupStatus: 'retained-pre-existing',
      }));
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);
      expect(fetchMock.mock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'DELETE' &&
        (/\/workers\/scripts\//.test(String(url)) || /\/storage\/kv\/namespaces\//.test(String(url)))
      ))).toHaveLength(0);
      expect(fetchMock.namespaces).toHaveLength(1);
      expect(fetchMock.workerBindings).toHaveProperty('size', 1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('labels a changed-payload conflict while an upload journal is still non-terminal', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeResumableDeploymentFetch();
    global.fetch = fetchMock;
    const journalKv = makeKvBinding();
    const normalPut = journalKv.put.bind(journalKv);
    let failTerminalWriteBeforeCommit = true;
    journalKv.put = async (key, value, options) => {
      const parsed = JSON.parse(value);
      if (parsed?.state === 'terminal' && failTerminalWriteBeforeCommit) {
        failTerminalWriteBeforeCommit = false;
        throw new TypeError('terminal journal did not commit');
      }
      await normalPut(key, value, options);
    };
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken: 'cf-resume-secret-token',
      deploymentRequestId: 'request-upload-conflict-0001',
      workerName: 'resume-worker',
      sessionSlug: 'resume-session',
      bundleText: 'export default { fetch() {} };',
    };

    try {
      await expectPendingDeploy(
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {}),
      );
      const cloudflareCallsBeforeConflict = fetchMock.mock.calls.length;

      const conflictResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        ...body,
        sessionSlug: 'changed-session',
      }), env, {});

      expect(conflictResponse.status).toBe(409);
      expect(await conflictResponse.json()).toEqual(expect.objectContaining({
        error: 'deploymentRequestId was already used for a different immutable deployment identity.',
        deploymentRequestConflict: true,
      }));
      // The coordinator re-derives the current token account before comparing
      // immutable identity, but performs no deployment mutation.
      expect(fetchMock).toHaveBeenCalledTimes(cloudflareCallsBeforeConflict + 1);
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('resumes an exactly owned worker without refetching its unavailable bundle URL', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeResumableDeploymentFetch();
    global.fetch = fetchMock;
    const journalKv = makeKvBinding();
    const normalPut = journalKv.put.bind(journalKv);
    let failTerminalWriteBeforeCommit = true;
    journalKv.put = async (key, value, options) => {
      const parsed = JSON.parse(value);
      if (parsed?.state === 'terminal' && failTerminalWriteBeforeCommit) {
        failTerminalWriteBeforeCommit = false;
        throw new TypeError('terminal journal did not commit');
      }
      await normalPut(key, value, options);
    };
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken: 'cf-resume-secret-token',
      deploymentRequestId: 'request-resume-bundle-url-0001',
      workerName: 'resume-worker',
      sessionSlug: 'resume-session',
      bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
    };

    try {
      await expectPendingDeploy(
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {}),
      );
      expect(fetchMock.getBundleFetchCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);

      fetchMock.bundleFetchMustFail = true;
      const retryResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});

      expect(retryResponse.status).toBe(200);
      expect((await retryResponse.json()).configVerified).toBe(true);
      expect(fetchMock.getBundleFetchCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('keeps temporarily invisible exact Worker and KV state pending until it can resume', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeResumableDeploymentFetch();
    global.fetch = fetchMock;
    const journalKv = makeKvBinding();
    const normalPut = journalKv.put.bind(journalKv);
    let failTerminalWriteBeforeCommit = true;
    journalKv.put = async (key, value, options) => {
      const parsed = JSON.parse(value);
      if (parsed?.state === 'terminal' && failTerminalWriteBeforeCommit) {
        failTerminalWriteBeforeCommit = false;
        throw new TypeError('terminal journal did not commit');
      }
      await normalPut(key, value, options);
    };
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken: 'cf-resume-secret-token',
      deploymentRequestId: 'request-resume-visibility-0001',
      workerName: 'resume-worker',
      sessionSlug: 'resume-session',
      bundleText: 'export default { fetch() {} };',
    };

    try {
      await expectPendingDeploy(
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {}),
      );
      fetchMock.namespaceListHiddenReads = 1;

      const hiddenKvResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
      expect(hiddenKvResponse.status).toBe(503);
      expect((await hiddenKvResponse.json()).deploymentRequestPending).toBe(true);
      expect([...journalKv.store.values()].some((value) => JSON.parse(value).state === 'terminal')).toBe(false);
      expect(fetchMock.getScriptUploadCount()).toBe(1);

      fetchMock.workerSettingsHiddenReads = 1;
      const resumedResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
      expect(resumedResponse.status).toBe(200);
      expect((await resumedResponse.json()).configVerified).toBe(true);
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('resumes an exactly owned worker when the non-terminal journal reservation has expired', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeResumableDeploymentFetch();
    global.fetch = fetchMock;
    const journalKv = makeKvBinding();
    const normalPut = journalKv.put.bind(journalKv);
    let failTerminalWriteBeforeCommit = true;
    journalKv.put = async (key, value, options) => {
      const parsed = JSON.parse(value);
      if (parsed?.state === 'terminal' && failTerminalWriteBeforeCommit) {
        failTerminalWriteBeforeCommit = false;
        throw new TypeError('terminal journal did not commit');
      }
      await normalPut(key, value, options);
    };
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken: 'cf-resume-secret-token',
      deploymentRequestId: 'request-resume-expired-journal-0001',
      workerName: 'resume-worker',
      sessionSlug: 'resume-session',
      bundleText: 'export default { fetch() {} };',
    };

    try {
      await expectPendingDeploy(
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {}),
      );
      for (const [key, value] of journalKv.store.entries()) {
        if (JSON.parse(value).state !== 'terminal') journalKv.store.delete(key);
      }

      const retryResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
      expect(retryResponse.status).toBe(200);
      expect((await retryResponse.json()).configVerified).toBe(true);
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it.each([
    {
      label: 'deployment marker',
      mutateBindings: (bindings) => bindings.map((binding) => (
        binding.name === 'CE_DEPLOYMENT_ID' ? { ...binding, text: 'foreign-deployment' } : binding
      )),
    },
    {
      label: 'request digest',
      mutateBindings: (bindings) => bindings.map((binding) => (
        binding.name === 'CE_DEPLOYMENT_REQUEST_DIGEST' ? { ...binding, text: '0'.repeat(64) } : binding
      )),
    },
    {
      label: 'GROUP_KV namespace',
      mutateBindings: (bindings) => bindings.map((binding) => (
        binding.name === 'GROUP_KV' ? { ...binding, namespace_id: 'kv-foreign' } : binding
      )),
    },
    {
      label: 'bundle identity',
      mutateBindings: (bindings) => bindings.map((binding) => (
        binding.name === 'CE_BUNDLE_SHA256' ? { ...binding, text: '0'.repeat(64) } : binding
      )),
    },
    {
      label: 'storage index namespace',
      mutateBindings: (bindings) => bindings.map((binding) => (
        binding.name === 'CE_STORAGE_INDEX_KV' ? { ...binding, namespace_id: 'kv-foreign' } : binding
      )),
    },
    {
      label: 'R2 bucket',
      mutateBindings: (bindings) => bindings.map((binding) => (
        binding.name === 'CE_STORAGE_R2' ? { ...binding, bucket_name: 'foreign-bucket' } : binding
      )),
    },
    {
      label: 'bootstrap admin',
      mutateBindings: (bindings) => bindings.map((binding) => (
        binding.name === 'BOOTSTRAP_ADMIN_ADDRESS' ? { ...binding, text: '0x2222222222222222222222222222222222222222' } : binding
      )),
    },
    {
      label: 'session slug',
      mutateBindings: (bindings) => bindings.map((binding) => (
        binding.name === 'DEFAULT_SESSION_SLUG' ? { ...binding, text: 'foreign-session' } : binding
      )),
    },
    {
      label: 'deploy-helper flag',
      mutateBindings: (bindings) => bindings.map((binding) => (
        binding.name === 'DEPLOY_HELPER_ENABLED' ? { ...binding, text: '1' } : binding
      )),
    },
    {
      label: 'session coordinator',
      mutateBindings: (bindings) => bindings.map((binding) => (
        binding.name === 'CE_SESSION_COORDINATOR'
          ? { ...binding, class_name: 'ForeignCoordinator' }
          : binding
      )),
    },
  ])('refuses to resume when the existing worker has a mismatched $label binding', async ({ mutateBindings }) => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeResumableDeploymentFetch();
    global.fetch = fetchMock;
    const journalKv = makeKvBinding();
    const normalPut = journalKv.put.bind(journalKv);
    let failTerminalWriteBeforeCommit = true;
    journalKv.put = async (key, value, options) => {
      const parsed = JSON.parse(value);
      if (parsed?.state === 'terminal' && failTerminalWriteBeforeCommit) {
        failTerminalWriteBeforeCommit = false;
        throw new TypeError('terminal journal did not commit');
      }
      await normalPut(key, value, options);
    };
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken: 'cf-resume-secret-token',
      deploymentRequestId: 'request-resume-mismatch-0001',
      workerName: 'resume-worker',
      sessionSlug: 'resume-session',
      bundleText: 'export default { fetch() {} };',
      adminAddress: '0x1111111111111111111111111111111111111111',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
      embeddedDeployHelperEnabled: false,
      storageProfile: {
        backend: 'cloudflare',
        r2BucketName: 'ce-session-payloads',
        payloadAccessControl: { gate: 'none', encryption: 'none' },
      },
    };

    try {
      await expectPendingDeploy(
        deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {}),
      );
      const [[workerName, bindings]] = [...fetchMock.workerBindings.entries()];
      fetchMock.workerBindings.set(workerName, mutateBindings(bindings));

      const retryResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
      expect(retryResponse.status).toBe(409);
      expect(await retryResponse.json()).toEqual(expect.objectContaining({
        error: expect.stringMatching(/does not match this deployment request/i),
        deploymentRequestPending: true,
      }));
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);
      expect([...journalKv.store.values()].some((value) => JSON.parse(value).state === 'terminal')).toBe(false);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('recovers a partial upload after mutable/token drift without duplicating infrastructure', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeResumableDeploymentFetch();
    fetchMock.configReadbackFailures = 4;
    global.fetch = fetchMock;
    const journalKv = makeKvBinding();
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken: 'cf-token',
      deploymentRequestId: 'request-final-config-0001',
      workerName: 'resume-worker',
      sessionSlug: 'resume-session',
      bundleText: 'export default { fetch() {} };',
    };

    try {
      const firstResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
      expect(firstResponse.status).toBe(502);
      expect((await firstResponse.json()).deploymentRequestPending).toBe(true);
      expect(JSON.parse([...journalKv.store.values()][0]).state).toBe('reserved');
      expect(fetchMock.workerSecretBodies).toHaveLength(0);

      const retryResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        ...body,
        apiToken: 'cf-token-after-partial-upload',
        sessionName: 'Recovered after partial upload',
      }), env, {});
      const retryPayload = await retryResponse.json();
      expect(retryResponse.status).toBe(200);
      expect(retryPayload).toEqual(expect.objectContaining({
        ok: true,
        tokenSecretSet: true,
        tokenSecretPreserved: false,
      }));
      expect(fetchMock.getNamespaceCreateCount()).toBe(1);
      expect(fetchMock.getScriptUploadCount()).toBe(1);
      expect(fetchMock.getFinalConfigPutCount()).toBe(1);
      expect(fetchMock.workerSecretBodies).toHaveLength(1);
      expect(fetchMock.workerSecretBodies[0].name).toBe('TOKEN_HMAC_SECRET');
      expect(JSON.stringify([...journalKv.store.values()])).not.toMatch(
        /cf-token-after-partial-upload|Recovered after partial upload/,
      );
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('reconciles an ambiguous request-marked KV create without provisioning a second namespace', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeDeploymentRequestFetchSequence([
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
    ]);
    fetchMock.commitNamespaceCreateThenThrow = true;
    global.fetch = fetchMock;
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: makeKvBinding() });
    const boundarySlug = 'a'.repeat(128);

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        deploymentRequestId: 'request-loss-0002',
        workerName: 'test-worker',
        sessionSlug: boundarySlug,
        bundleText: 'export default { fetch() {} };',
      }), env, {});
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.kvNamespaceId).toBe('kv-1');
      expect(fetchMock.namespaces).toHaveLength(1);
      expect(fetchMock.namespaces[0].title).toMatch(/req-[0-9a-f]{16}$/);
      expect(fetchMock.namespaces[0].title).toContain(boundarySlug);
      expect(fetchMock.namespaces[0].title.length).toBeLessThanOrEqual(512);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'POST' &&
        String(url).endsWith('/storage/kv/namespaces')
      ))).toHaveLength(1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('rejects session slugs longer than the 128-character canonical limit before Cloudflare access', async () => {
    const fetchMock = jest.fn(async () => {
      throw new Error('Cloudflare must not be called for an invalid slug');
    });
    global.fetch = fetchMock;

    const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
      apiToken: 'cf-token',
      workerName: 'test-worker',
      sessionSlug: 'a'.repeat(129),
      bundleText: 'export default { fetch() {} };',
    }), {}, {});

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/at most 128/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redacts known request credentials from terminal journal errors and their replay', async () => {
    const apiToken = 'cf-sensitive-token-value';
    const providerSecret = 'provider-sensitive-secret';
    global.fetch = jest.fn(async (url) => {
      if (String(url).endsWith('/accounts?per_page=5')) {
        return cfFailure(400, `rejected ${apiToken} with ${providerSecret}`);
      }
      throw new Error(`Unexpected Cloudflare mock call: ${url}`);
    });
    const journalKv = makeKvBinding();
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken,
      deploymentRequestId: 'request-redacted-error-0001',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      bundleText: 'export default { fetch() {} };',
      secrets: { providerApiKey: providerSecret },
    };

    const firstResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
    const firstPayload = await firstResponse.json();
    expect(firstResponse.status).toBe(502);
    expect(firstPayload.error).toBe('rejected [REDACTED] with [REDACTED]');
    expect(JSON.stringify([...journalKv.store.values()])).not.toContain(apiToken);
    expect(JSON.stringify([...journalKv.store.values()])).not.toContain(providerSecret);

    const cloudflareCallCount = global.fetch.mock.calls.length;
    const replayResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
    expect(await replayResponse.json()).toEqual(firstPayload);
    expect(global.fetch).toHaveBeenCalledTimes(cloudflareCallCount + 1);
  });

  it('reconciles delayed KV-title visibility on a same-id retry without a second namespace', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeDeploymentRequestFetchSequence([
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
    ]);
    fetchMock.commitNamespaceCreateThenThrow = true;
    fetchMock.namespaceListHiddenReads = 4;
    global.fetch = fetchMock;
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: makeKvBinding() });
    const body = {
      apiToken: 'cf-token',
      deploymentRequestId: 'request-loss-0003',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      bundleText: 'export default { fetch() {} };',
    };

    try {
      const firstResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
      expect(firstResponse.status).toBe(503);
      expect((await firstResponse.json()).deploymentRequestPending).toBe(true);

      const retryResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
      expect(retryResponse.status).toBe(200);
      expect((await retryResponse.json()).kvNamespaceId).toBe('kv-1');
      expect(fetchMock.namespaces).toHaveLength(1);
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'POST' &&
        String(url).endsWith('/storage/kv/namespaces')
      ))).toHaveLength(1);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('retries a pre-mutation bundle failure after mutable/token drift', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = makeDeploymentRequestFetchSequence([
      async () => { throw new TypeError('bundle unavailable'); },
      new Response('export default { fetch() {} };', { status: 200 }),
      cfSuccess({ id: 'kv-request-4' }),
      cfSuccess({}),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
      cfSuccess({}),
    ]);
    global.fetch = fetchMock;
    const journalKv = makeKvBinding();
    const env = makeCoordinatorEnv({ DEPLOY_HELPER_KV: journalKv });
    const body = {
      apiToken: 'cf-token',
      deploymentRequestId: 'request-loss-0004',
      workerName: 'test-worker',
      sessionSlug: 'alpha-session',
      bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
    };

    try {
      const firstResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', body), env, {});
      expect(firstResponse.status).toBe(502);
      expect((await firstResponse.json()).error).toMatch(/bundle unavailable/);
      expect(JSON.parse([...journalKv.store.values()][0]).state).toBe('reserved');

      const retryResponse = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        ...body,
        apiToken: 'cf-token-after-bundle-failure',
        sessionName: 'Retry with mutable drift',
      }), env, {});
      expect(retryResponse.status).toBe(200);
      expect((await retryResponse.json()).kvNamespaceId).toBe('kv-request-4');
      expect(fetchMock.calls.filter(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'POST' &&
        String(url).endsWith('/storage/kv/namespaces')
      ))).toHaveLength(1);
      expect(JSON.stringify([...journalKv.store.values()])).not.toMatch(
        /cf-token-after-bundle-failure|Retry with mutable drift/,
      );
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('stops activation and preserves ambiguous resources when ownership changes after upload', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const foreignSettings = cfSuccess({
      bindings: [{ name: 'CE_DEPLOYMENT_ID', type: 'plain_text', text: 'other-deployment' }],
    });
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
    ]);
    fetchMock.workerPostUploadSettingsOverride = foreignSettings;
    fetchMock.workerCleanupSettingsOverride = foreignSettings.clone();
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        accountId: 'acc-123',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText: 'export default { fetch() {} };',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(409);
      expect(payload?.error).toMatch(/ownership changed/i);
      expect(payload?.orphanResources).toEqual({
        kvNamespaceId: 'kv-123',
        kvCleanupStatus: 'retained-live-worker',
        workerName: expect.stringMatching(/^test-worker-[0-9a-f]{12}$/),
        workerCleanupStatus: 'ownership-changed',
      });
      expect(fetchMock.calls.some(([url]) => String(url).endsWith('/secrets'))).toBe(false);
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'DELETE' &&
        (/\/workers\/scripts\/test-worker-[0-9a-f]{12}\?force=true$/.test(String(url)) ||
          String(url).endsWith('/storage/kv/namespaces/kv-123'))
      ))).toBe(false);
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('retains KV when an accepted upload remains temporarily invisible to settings reads', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const hiddenSettings = cfFailure(404, 'Worker not found.');
    const fetchMock = makeFetchSequence([
      cfSuccess({ id: 'kv-123' }),
      cfSuccess({}),
      cfSuccess({ id: 'worker-uploaded' }),
    ]);
    fetchMock.workerPostUploadSettingsOverride = hiddenSettings;
    fetchMock.workerCleanupSettingsOverride = hiddenSettings.clone();
    global.fetch = fetchMock;

    try {
      const response = await deployHelperWorker.fetch(makeJsonRequest('/deploy', {
        apiToken: 'cf-token',
        workerName: 'test-worker',
        sessionSlug: 'alpha-session',
        bundleText: 'export default { fetch() {} };',
      }), {}, {});
      const payload = await response.json();

      expect(response.status).toBe(502);
      expect(payload?.orphanResources).toEqual({
        kvNamespaceId: 'kv-123',
        kvCleanupStatus: 'retained-live-worker',
        workerName: expect.stringMatching(/^test-worker-[0-9a-f]{12}$/),
        workerCleanupStatus: 'ownership-unverified',
      });
      expect(fetchMock.calls.some(([url, init = {}]) => (
        String(init.method || '').toUpperCase() === 'DELETE' &&
        String(url).endsWith('/storage/kv/namespaces/kv-123')
      ))).toBe(false);
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
