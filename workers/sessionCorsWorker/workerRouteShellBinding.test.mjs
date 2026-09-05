import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkerRouteShellWithWorkerDeps } from './workerRouteShellBinding.js';

const createBaseDeps = () => ({
  toStr: 'toStr',
  corsHeaders: 'corsHeaders',
  json: 'json',
  isAddress: 'isAddress',
  resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
  resolveExistingSessionCors: 'resolveExistingSessionCors',
  validateTrustedLoginRequestOrigin: 'validateTrustedLoginRequestOrigin',
  validateBrowserLoginOrigin: 'validateBrowserLoginOrigin',
  resolveTrustedAdminOrigins: 'resolveTrustedAdminOrigins',
  buildNonce: 'buildNonce',
  checkNonceRateLimit: 'checkNonceRateLimit',
  base64UrlEncode: 'base64UrlEncode',
  normalizeSignedWorkerRequest: 'normalizeSignedWorkerRequest',
  verifyMessage: 'verifyMessage',
  validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
  parseSiweMessage: 'parseSiweMessage',
  validateSiwe: 'validateSiwe',
  validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
  consumeNonce: 'consumeNonce',
  computeScopesForLogin: 'computeScopesForLogin',
  signToken: 'signToken',
  getAddress: 'getAddress',
  buildAuthTokenJti: 'buildAuthTokenJti',
  persistAuthTokenRecord: 'persistAuthTokenRecord',
  now: 'now',
  readArweaveBootstrapUploadPayload: 'readArweaveBootstrapUploadPayload',
  getSessionConfig: 'getSessionConfig',
  getCorsContext: 'getCorsContext',
  verifyAdminSignature: 'verifyAdminSignature',
  getSessionSecrets: 'getSessionSecrets',
  arweaveUpload: 'arweaveUpload',
  storageRoute: 'storageRoute',
  validateBootstrapAdmin: 'validateBootstrapAdmin',
  validateAdmin: 'validateAdmin',
  mergeWorkerConfigRecords: 'mergeWorkerConfigRecords',
  mergeWorkerLimitRecords: 'mergeWorkerLimitRecords',
  putSessionConfig: 'putSessionConfig',
  normalizeSecretValue: 'normalizeSecretValue',
  putSessionSecrets: 'putSessionSecrets',
  resolveRequestSlugWithoutToken: 'resolveRequestSlugWithoutToken',
  resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
  checkRateLimit: 'checkRateLimit',
  dispatchAnonymousRoute: 'dispatchAnonymousRoute',
  readTranscribeRequestPayload: 'readTranscribeRequestPayload',
  evaluateAnonymousRouteAccess: 'evaluateAnonymousRouteAccess',
  transcribe: 'transcribe',
  readAiRequestPayload: 'readAiRequestPayload',
  validateAnonymousAiRequest: 'validateAnonymousAiRequest',
  proxyAnthropic: 'proxyAnthropic',
  proxyOpenAI: 'proxyOpenAI',
  proxyOpenRouter: 'proxyOpenRouter',
  proxyCustomRPC: 'proxyCustomRPC',
  requireAuth: 'requireAuth',
  dispatchAuthenticatedRoute: 'dispatchAuthenticatedRoute',
  dispatchAuthenticatedSecretPathRoute: 'dispatchAuthenticatedSecretPathRoute',
  readAuthenticatedActionPayload: 'readAuthenticatedActionPayload',
  dispatchAuthenticatedNonSecretActionRoute: 'dispatchAuthenticatedNonSecretActionRoute',
  dispatchAuthenticatedSecretActionRoute: 'dispatchAuthenticatedSecretActionRoute',
  evaluateAuthenticatedRoutePreflight: 'evaluateAuthenticatedRoutePreflight',
  resolveAuthenticatedRouteSecrets: 'resolveAuthenticatedRouteSecrets',
  fetchImage: 'fetchImage',
  fetchUrl: 'fetchUrl',
  normalizeAiRequestPayload: 'normalizeAiRequestPayload',
  faucet: 'faucet',
});

const createBaseConstants = () => ({
  missingSlugError: 'Missing sessionSlug.',
  nonceTtlSeconds: 300,
  nonceRateLimitMax: 5,
  nonceRateLimitWindowMs: 60000,
  nonceRateLimitTtlSeconds: 60,
  usedNonceTtlSeconds: 600,
  loginSiweMaxAgeMs: 300000,
  loginSiweFutureSkewMs: 60000,
  tokenTtlSeconds: 86400,
  sessionConfigNotFoundError: 'Session config not found.',
  bootstrapSessionConfigRequiredError:
    'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.',
  anonymousRouteDeniedError: 'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.',
});

const createRequest = (path, method = 'POST', headers = {}) => (
  new Request(`https://worker.example${path}`, { method, headers })
);

test('createWorkerRouteShellWithWorkerDeps returns a fetch handler', () => {
  const routeShell = createWorkerRouteShellWithWorkerDeps();

  assert.equal(typeof routeShell.fetch, 'function');
});

test('createWorkerRouteShellWithWorkerDeps preserves options short-circuit and arweave preflight logging', async () => {
  const request = createRequest('/arweave/upload', 'OPTIONS', {
    Origin: 'https://allowed.example',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type',
  });
  const logs = [];
  let envSlugCalls = 0;

  const routeShell = createWorkerRouteShellWithWorkerDeps({
    deps: {
      toStr: 'toStr',
      corsHeaders: 'corsHeaders',
      resolveTopLevelRouteSelection: (value) => {
        assert.equal(value.path, '/arweave/upload');
        assert.equal(value.method, 'OPTIONS');
        assert.equal(value.request, request);
        assert.deepEqual(value.deps, { toStr: 'toStr' });
        return { kind: 'options' };
      },
      getRouteBaseHeaders: (value) => {
        assert.equal(value.request, request);
        assert.deepEqual(value.deps, { corsHeaders: 'corsHeaders' });
        return { 'X-Route': 'base' };
      },
      getDefaultWorkerSessionSlug: () => {
        envSlugCalls += 1;
        return 'env-slug';
      },
      log: (...args) => {
        logs.push(args);
      },
    },
  });

  const response = await routeShell.fetch(request, { DEFAULT_SESSION_SLUG: 'ignored' });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('X-Route'), 'base');
  assert.equal(envSlugCalls, 0);
  assert.deepEqual(logs, [[
    '[arweave] preflight',
    {
      origin: 'https://allowed.example',
      requestMethod: 'POST',
      requestHeaders: 'authorization,content-type',
      url: 'https://worker.example/arweave/upload',
    },
  ]]);
});

test('createWorkerRouteShellWithWorkerDeps preserves resource-presence branch wiring', async () => {
  const request = createRequest('/resource-presence', 'GET', { 'X-Session-Slug': 'demo-1' });
  const env = { GROUP_KV: { id: 'kv' }, DEFAULT_SESSION_SLUG: 'demo-1' };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const response = new Response('ok');

  const routeShell = createWorkerRouteShellWithWorkerDeps({
    deps: {
      ...createBaseDeps(),
      resolveTopLevelRouteSelection: () => ({ kind: 'resource-presence' }),
      getRouteBaseHeaders: () => baseHeaders,
      getDefaultWorkerSessionSlug: () => 'demo-1',
      dispatchResourcePresenceRequest: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.slugHint, 'demo-1');
        assert.equal(value.baseHeaders, baseHeaders);
        assert.deepEqual(value.deps, {
          resolveRequestSlugWithoutToken: 'resolveRequestSlugWithoutToken',
          getSessionConfig: 'getSessionConfig',
          getCorsContext: 'getCorsContext',
          getSessionSecrets: 'getSessionSecrets',
          json: 'json',
        });
        assert.deepEqual(value.constants, {
          missingSlugError: 'Missing sessionSlug.',
          sessionConfigNotFoundError: 'Session config not found.',
        });
        return response;
      },
    },
    constants: createBaseConstants(),
  });

  assert.equal(await routeShell.fetch(request, env), response);
});

test('createWorkerRouteShellWithWorkerDeps preserves session-config bootstrap branch wiring', async () => {
  const request = createRequest('/session-config', 'GET', { 'X-Session-Slug': 'demo-1' });
  const env = { GROUP_KV: { id: 'kv' }, DEFAULT_SESSION_SLUG: 'demo-1' };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const response = new Response('ok');

  const routeShell = createWorkerRouteShellWithWorkerDeps({
    deps: {
      ...createBaseDeps(),
      resolveTopLevelRouteSelection: () => ({ kind: 'session-config' }),
      getRouteBaseHeaders: () => baseHeaders,
      getDefaultWorkerSessionSlug: () => 'demo-1',
      dispatchSessionConfigBootstrapRequest: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.slugHint, 'demo-1');
        assert.equal(value.baseHeaders, baseHeaders);
        assert.deepEqual(value.deps, {
          resolveRequestSlugWithoutToken: 'resolveRequestSlugWithoutToken',
          getSessionConfig: 'getSessionConfig',
          getCorsContext: 'getCorsContext',
          json: 'json',
        });
        assert.deepEqual(value.constants, {
          missingSlugError: 'Missing sessionSlug.',
          sessionConfigNotFoundError: 'Session config not found.',
        });
        return response;
      },
    },
    constants: createBaseConstants(),
  });

  assert.equal(await routeShell.fetch(request, env), response);
});

test('createWorkerRouteShellWithWorkerDeps preserves interview brief branch wiring', async () => {
  const request = createRequest('/agent/interview-brief?slug=demo-1', 'GET');
  const env = { SESSION_CONFIGS: { id: 'kv' }, DEFAULT_SESSION_SLUG: 'demo-1' };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const response = new Response('interview brief');
  const fetchImpl = async () => new Response();

  const routeShell = createWorkerRouteShellWithWorkerDeps({
    deps: {
      ...createBaseDeps(),
      fetch: fetchImpl,
      resolveTopLevelRouteSelection: () => ({ kind: 'interview-brief' }),
      getRouteBaseHeaders: () => baseHeaders,
      getDefaultWorkerSessionSlug: () => 'demo-1',
      dispatchInterviewBriefRequest: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.slugHint, 'demo-1');
        assert.equal(value.baseHeaders, baseHeaders);
        assert.deepEqual(value.deps, {
          resolveRequestSlugWithoutToken: 'resolveRequestSlugWithoutToken',
          getSessionConfig: 'getSessionConfig',
          getCorsContext: 'getCorsContext',
          resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
          checkRateLimit: 'checkRateLimit',
          storageRoute: 'storageRoute',
          fetch: fetchImpl,
          json: 'json',
        });
        assert.deepEqual(value.constants, {
          missingSlugError: 'Missing sessionSlug.',
          sessionConfigNotFoundError: 'Session config not found.',
        });
        return response;
      },
    },
    constants: createBaseConstants(),
  });

  assert.equal(await routeShell.fetch(request, env), response);
});

test('createWorkerRouteShellWithWorkerDeps preserves auth-nonce branch wiring', async () => {
  const request = createRequest('/auth/nonce');
  const env = { GROUP_KV: { id: 'kv' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const response = new Response('ok');

  const routeShell = createWorkerRouteShellWithWorkerDeps({
    deps: {
      ...createBaseDeps(),
      resolveTopLevelRouteSelection: () => ({ kind: 'auth-nonce' }),
      getRouteBaseHeaders: () => baseHeaders,
      getDefaultWorkerSessionSlug: (value) => {
        assert.equal(value, env);
        return 'env-slug';
      },
      dispatchAuthNonceRequestWithWorkerDeps: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.slug, 'env-slug');
        assert.deepEqual(value.deps, {
          json: 'json',
          toStr: 'toStr',
          isAddress: 'isAddress',
          resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
          resolveExistingSessionCors: 'resolveExistingSessionCors',
          validateTrustedLoginRequestOrigin: 'validateTrustedLoginRequestOrigin',
          resolveTrustedAdminOrigins: 'resolveTrustedAdminOrigins',
          checkNonceRateLimit: 'checkNonceRateLimit',
          now: 'now',
          buildNonce: 'buildNonce',
          base64UrlEncode: 'base64UrlEncode',
        });
        assert.deepEqual(value.constants, {
          missingSlugError: 'Missing sessionSlug.',
          nonceTtlSeconds: 300,
          nonceRateLimitMax: 5,
          nonceRateLimitWindowMs: 60000,
          nonceRateLimitTtlSeconds: 60,
        });
        return response;
      },
    },
    constants: createBaseConstants(),
  });

  const result = await routeShell.fetch(request, env);

  assert.equal(result, response);
});

test('createWorkerRouteShellWithWorkerDeps preserves auth-login branch wiring', async () => {
  const request = createRequest('/auth/login');
  const env = { GROUP_KV: { id: 'kv' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const response = new Response('ok');

  const routeShell = createWorkerRouteShellWithWorkerDeps({
    deps: {
      ...createBaseDeps(),
      resolveTopLevelRouteSelection: () => ({ kind: 'auth-login' }),
      getRouteBaseHeaders: () => baseHeaders,
      getDefaultWorkerSessionSlug: () => 'env-slug',
      dispatchAuthLoginRequestWithWorkerDeps: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.slug, 'env-slug');
        assert.deepEqual(value.deps, {
          json: 'json',
          normalizeSignedWorkerRequest: 'normalizeSignedWorkerRequest',
          resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
          isAddress: 'isAddress',
          resolveExistingSessionCors: 'resolveExistingSessionCors',
          verifyMessage: 'verifyMessage',
          validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
          parseSiweMessage: 'parseSiweMessage',
          validateSiwe: 'validateSiwe',
          validateBrowserLoginOrigin: 'validateBrowserLoginOrigin',
          resolveTrustedAdminOrigins: 'resolveTrustedAdminOrigins',
          validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
          consumeNonce: 'consumeNonce',
          computeScopesForLogin: 'computeScopesForLogin',
          signToken: 'signToken',
          getAddress: 'getAddress',
          buildAuthTokenJti: 'buildAuthTokenJti',
          persistAuthTokenRecord: 'persistAuthTokenRecord',
          now: 'now',
        });
        assert.deepEqual(value.constants, {
          usedNonceTtlSeconds: 600,
          tokenTtlSeconds: 86400,
          loginSiweMaxAgeMs: 300000,
          loginSiweFutureSkewMs: 60000,
          missingSlugError: 'Missing sessionSlug.',
          sessionConfigNotFoundError: 'Session config not found.',
        });
        return response;
      },
    },
    constants: createBaseConstants(),
  });

  const result = await routeShell.fetch(request, env);

  assert.equal(result, response);
});

test('createWorkerRouteShellWithWorkerDeps preserves bootstrap arweave handled short-circuit', async () => {
  const request = createRequest('/arweave/upload');
  const env = { GROUP_KV: { id: 'kv' } };
  const response = new Response('bootstrap');

  const routeShell = createWorkerRouteShellWithWorkerDeps({
    deps: {
      ...createBaseDeps(),
      log: 'routeLog',
      resolveTopLevelRouteSelection: () => ({
        kind: 'arweave-upload',
        hasAuthorizationHeader: true,
      }),
      getRouteBaseHeaders: () => ({ 'Access-Control-Allow-Origin': 'https://allowed.example' }),
      getDefaultWorkerSessionSlug: () => 'env-slug',
      dispatchBootstrapArweaveUploadWithWorkerDeps: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.hasAuthorization, true);
        assert.deepEqual(value.deps, {
          log: 'routeLog',
          corsHeaders: 'corsHeaders',
          readArweaveBootstrapUploadPayload: 'readArweaveBootstrapUploadPayload',
          resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
          json: 'json',
          getSessionConfig: 'getSessionConfig',
          getCorsContext: 'getCorsContext',
          verifyAdminSignature: 'verifyAdminSignature',
          getSessionSecrets: 'getSessionSecrets',
          arweaveUpload: 'arweaveUpload',
          storageRoute: 'storageRoute',
        });
        assert.deepEqual(value.constants, {
          missingSlugError: 'Missing sessionSlug.',
          bootstrapSessionConfigRequiredError:
            'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.',
        });
        return {
          handled: true,
          response,
        };
      },
      dispatchAuthenticatedRouteEntryWithWorkerDeps: async () => {
        assert.fail('authenticated fallback should not run when bootstrap handled the upload');
      },
    },
    constants: createBaseConstants(),
  });

  const result = await routeShell.fetch(request, env);

  assert.equal(result, response);
});

test('createWorkerRouteShellWithWorkerDeps preserves admin and anonymous branch handoff', async (t) => {
  await t.test('admin branch preserves action, slug, and constants', async () => {
    const request = createRequest('/admin/set-config');
    const env = { GROUP_KV: { id: 'kv' } };
    const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
    const response = new Response('admin');

    const routeShell = createWorkerRouteShellWithWorkerDeps({
      deps: {
        ...createBaseDeps(),
        resolveTopLevelRouteSelection: () => ({
          kind: 'admin',
          action: 'set-config',
        }),
        getRouteBaseHeaders: () => baseHeaders,
        getDefaultWorkerSessionSlug: () => 'env-slug',
        dispatchAdminRequestWithWorkerDeps: async (value) => {
          assert.equal(value.request, request);
          assert.equal(value.env, env);
          assert.equal(value.baseHeaders, baseHeaders);
          assert.equal(value.slug, 'env-slug');
          assert.equal(value.action, 'set-config');
          assert.deepEqual(value.deps, {
            json: 'json',
            normalizeSignedWorkerRequest: 'normalizeSignedWorkerRequest',
            resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
            isAddress: 'isAddress',
            getAddress: 'getAddress',
            resolveExistingSessionCors: 'resolveExistingSessionCors',
            verifyMessage: 'verifyMessage',
            validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
            parseSiweMessage: 'parseSiweMessage',
            validateSiwe: 'validateSiwe',
            validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
            consumeNonce: 'consumeNonce',
            validateBootstrapAdmin: 'validateBootstrapAdmin',
            validateAdmin: 'validateAdmin',
            mergeWorkerConfigRecords: 'mergeWorkerConfigRecords',
            mergeWorkerLimitRecords: 'mergeWorkerLimitRecords',
            putSessionConfig: 'putSessionConfig',
            getSessionSecrets: 'getSessionSecrets',
            normalizeSecretValue: 'normalizeSecretValue',
            putSessionSecrets: 'putSessionSecrets',
          });
          assert.deepEqual(value.constants, {
            usedNonceTtlSeconds: 600,
            missingSlugError: 'Missing sessionSlug.',
          });
          return response;
        },
      },
      constants: createBaseConstants(),
    });

    const result = await routeShell.fetch(request, env);

    assert.equal(result, response);
  });

  await t.test('anonymous branch preserves route, slug hint, and downstream bundle', async () => {
    const request = createRequest('/ai');
    const env = { GROUP_KV: { id: 'kv' } };
    const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
    const response = new Response('anonymous');

    const routeShell = createWorkerRouteShellWithWorkerDeps({
      deps: {
        ...createBaseDeps(),
        resolveTopLevelRouteSelection: () => ({
          kind: 'anonymous',
          anonymousRoute: 'ai',
        }),
        getRouteBaseHeaders: () => baseHeaders,
        getDefaultWorkerSessionSlug: () => 'env-slug',
        dispatchAnonymousRouteEntryWithWorkerDeps: async (value) => {
          assert.equal(value.path, '/ai');
          assert.equal(value.anonymousRoute, 'ai');
          assert.equal(value.request, request);
          assert.equal(value.env, env);
          assert.equal(value.slugHint, 'env-slug');
          assert.equal(value.baseHeaders, baseHeaders);
          assert.deepEqual(value.deps, {
            resolveRequestSlugWithoutToken: 'resolveRequestSlugWithoutToken',
            json: 'json',
            getSessionConfig: 'getSessionConfig',
            getCorsContext: 'getCorsContext',
            resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
            checkRateLimit: 'checkRateLimit',
            dispatchAnonymousRoute: 'dispatchAnonymousRoute',
            storageRoute: 'storageRoute',
            readTranscribeRequestPayload: 'readTranscribeRequestPayload',
            evaluateAnonymousRouteAccess: 'evaluateAnonymousRouteAccess',
            getSessionSecrets: 'getSessionSecrets',
            transcribe: 'transcribe',
            readAiRequestPayload: 'readAiRequestPayload',
            validateAnonymousAiRequest: 'validateAnonymousAiRequest',
            proxyAnthropic: 'proxyAnthropic',
            proxyOpenAI: 'proxyOpenAI',
            proxyOpenRouter: 'proxyOpenRouter',
            proxyCustomRPC: 'proxyCustomRPC',
            now: 'now',
          });
          assert.deepEqual(value.constants, {
            missingSlugError: 'Missing sessionSlug.',
            sessionConfigNotFoundError: 'Session config not found.',
            anonymousRouteDeniedError:
              'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.',
          });
          return response;
        },
      },
      constants: createBaseConstants(),
    });

    const result = await routeShell.fetch(request, env);

    assert.equal(result, response);
  });
});

test('createWorkerRouteShellWithWorkerDeps preserves authenticated fallback after unhandled bootstrap upload', async () => {
  const request = createRequest('/arweave/upload');
  const env = { GROUP_KV: { id: 'kv' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const response = new Response('authenticated');

  const routeShell = createWorkerRouteShellWithWorkerDeps({
    deps: {
      ...createBaseDeps(),
      log: 'routeLog',
      resolveTopLevelRouteSelection: () => ({
        kind: 'arweave-upload',
        hasAuthorizationHeader: false,
      }),
      getRouteBaseHeaders: () => baseHeaders,
      getDefaultWorkerSessionSlug: () => 'env-slug',
      dispatchBootstrapArweaveUploadWithWorkerDeps: async () => ({ handled: false }),
      dispatchAuthenticatedRouteEntryWithWorkerDeps: async (value) => {
        assert.equal(value.path, '/arweave/upload');
        assert.equal(value.method, 'POST');
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.deepEqual(value.deps, {
          json: 'json',
          requireAuth: 'requireAuth',
          getSessionConfig: 'getSessionConfig',
          getCorsContext: 'getCorsContext',
          computeScopesForLogin: 'computeScopesForLogin',
          toStr: 'toStr',
          dispatchAuthenticatedRoute: 'dispatchAuthenticatedRoute',
          dispatchAuthenticatedSecretPathRoute: 'dispatchAuthenticatedSecretPathRoute',
          readAuthenticatedActionPayload: 'readAuthenticatedActionPayload',
          dispatchAuthenticatedNonSecretActionRoute: 'dispatchAuthenticatedNonSecretActionRoute',
          dispatchAuthenticatedSecretActionRoute: 'dispatchAuthenticatedSecretActionRoute',
          evaluateAuthenticatedRoutePreflight: 'evaluateAuthenticatedRoutePreflight',
          resolveAuthenticatedRouteSecrets: 'resolveAuthenticatedRouteSecrets',
          checkRateLimit: 'checkRateLimit',
          getSessionSecrets: 'getSessionSecrets',
          isAddress: 'isAddress',
          getAddress: 'getAddress',
          transcribe: 'transcribe',
          arweaveUpload: 'arweaveUpload',
          storageRoute: 'storageRoute',
          fetchImage: 'fetchImage',
          fetchUrl: 'fetchUrl',
          now: 'now',
          normalizeAiRequestPayload: 'normalizeAiRequestPayload',
          proxyAnthropic: 'proxyAnthropic',
          proxyOpenAI: 'proxyOpenAI',
          proxyOpenRouter: 'proxyOpenRouter',
          proxyCustomRPC: 'proxyCustomRPC',
          faucet: 'faucet',
        });
        assert.deepEqual(value.constants, {
          sessionConfigNotFoundError: 'Session config not found.',
        });
        return response;
      },
    },
    constants: createBaseConstants(),
  });

  const result = await routeShell.fetch(request, env);

  assert.equal(result, response);
});

test('createWorkerRouteShellWithWorkerDeps converts unhandled route errors into CORS-safe JSON failures', async () => {
  const request = createRequest('/admin/set-config');
  const env = { GROUP_KV: { id: 'kv' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const errors = [];

  const routeShell = createWorkerRouteShellWithWorkerDeps({
    deps: {
      ...createBaseDeps(),
      log: {
        error: (...args) => errors.push(args),
      },
      resolveTopLevelRouteSelection: () => ({
        kind: 'admin',
        action: 'set-config',
      }),
      getRouteBaseHeaders: () => baseHeaders,
      getDefaultWorkerSessionSlug: () => 'env-slug',
      dispatchAdminRequestWithWorkerDeps: async () => {
        throw new Error('Simulated admin crash');
      },
    },
    constants: createBaseConstants(),
  });

  const result = await routeShell.fetch(request, env);

  assert.equal(result.status, 500);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'https://allowed.example');
  assert.deepEqual(await result.json(), { error: 'Simulated admin crash' });
  assert.deepEqual(errors, [[
    '[worker] unhandled route error',
    {
      path: '/admin/set-config',
      method: 'POST',
      error: 'Simulated admin crash',
    },
  ]]);
});
