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
      buildNonce: ({ base64UrlEncode }) => {
        assert.equal(base64UrlEncode, 'base64UrlEncode');
        return 'nonce-built';
      },
      issueNonce: async (...args) => {
        assert.deepEqual(args, [
          env,
          'session-a',
          '0xabc',
          'nonce-built',
          300,
          { now: 'now' },
        ]);
        return { ok: true };
      },
      dispatchAuthNonceRequest: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.slug, 'env-slug');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.isAddress, 'isAddress');
        assert.equal(value.deps.resolveWorkerBodySlugContext, 'resolveWorkerBodySlugContext');
        assert.equal(value.deps.resolveExistingSessionCors, 'resolveExistingSessionCors');
        assert.equal(value.deps.validateTrustedLoginRequestOrigin, 'validateTrustedLoginRequestOrigin');
        assert.equal(value.deps.resolveTrustedAdminOrigins, 'resolveTrustedAdminOrigins');
        assert.equal(value.deps.checkNonceRateLimit, 'checkNonceRateLimit');
        assert.equal(value.deps.now, 'now');
        assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
        assert.equal(value.deps.NONCE_TTL_SECONDS, 300);
        assert.equal(value.deps.NONCE_RATE_LIMIT_MAX, 5);
        assert.equal(value.deps.NONCE_RATE_LIMIT_WINDOW_MS, 60000);
        assert.equal(value.deps.NONCE_RATE_LIMIT_TTL_SECONDS, 60);
        assert.equal(value.deps.buildNonce(), 'nonce-built');
        await value.deps.issueNonce(env, 'session-a', '0xabc', 'nonce-built', 300);
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
      consumeNonce: async (...args) => {
        assert.deepEqual(args, [
          env,
          'session-a',
          '0xabc',
          'nonce-1',
          { usedNonceTtlSeconds: 600 },
        ]);
        return 'consumeNonceResult';
      },
      dispatchAuthLoginRequest: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.slug, 'env-slug');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.normalizeSignedWorkerRequest, 'normalizeSignedWorkerRequest');
        assert.equal(value.deps.resolveWorkerBodySlugContext, 'resolveWorkerBodySlugContext');
        assert.equal(value.deps.isAddress, 'isAddress');
        assert.equal(value.deps.resolveExistingSessionCors, 'resolveExistingSessionCors');
        assert.equal(value.deps.verifyMessage, 'verifyMessage');
        assert.equal(value.deps.validateRecoveredAddressMatchesRequest, 'validateRecoveredAddressMatchesRequest');
        assert.equal(value.deps.parseSiweMessage, 'parseSiweMessage');
        assert.equal(value.deps.validateSiwe, 'validateSiwe');
        assert.equal(value.deps.validateBrowserLoginOrigin, 'validateBrowserLoginOrigin');
        assert.equal(value.deps.resolveTrustedAdminOrigins, 'resolveTrustedAdminOrigins');
        assert.equal(value.deps.validateSiweAddressMatchesRequest, 'validateSiweAddressMatchesRequest');
        assert.equal(value.deps.computeScopesForLogin, 'computeScopesForLogin');
        assert.equal(value.deps.signToken, 'signToken');
        assert.equal(value.deps.getAddress, 'getAddress');
        assert.equal(value.deps.buildAuthTokenJti, 'buildAuthTokenJti');
        assert.equal(value.deps.persistAuthTokenRecord, 'persistAuthTokenRecord');
        assert.equal(value.deps.now, 'now');
        assert.equal(value.deps.LOGIN_SIWE_MAX_AGE_MS, 300000);
        assert.equal(value.deps.LOGIN_SIWE_FUTURE_SKEW_MS, 60000);
        assert.equal(value.deps.TOKEN_TTL_SECONDS, 86400);
        assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
        assert.equal(value.deps.SESSION_CONFIG_NOT_FOUND_ERROR, 'Session config not found.');
        assert.equal(await value.deps.consumeNonce(env, 'session-a', '0xabc', 'nonce-1'), 'consumeNonceResult');
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
  const warnings = [];

  const routeShell = createWorkerRouteShellWithWorkerDeps({
    deps: {
      ...createBaseDeps(),
      log: {
        warn: (...args) => warnings.push(args),
      },
      resolveTopLevelRouteSelection: () => ({
        kind: 'arweave-upload',
        hasAuthorizationHeader: true,
      }),
      getRouteBaseHeaders: () => ({ 'Access-Control-Allow-Origin': 'https://allowed.example' }),
      getDefaultWorkerSessionSlug: () => 'env-slug',
      dispatchBootstrapArweaveUpload: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.hasAuthorization, true);
        assert.equal(value.deps.corsHeaders, 'corsHeaders');
        assert.equal(value.deps.readArweaveBootstrapUploadPayload, 'readArweaveBootstrapUploadPayload');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
        assert.equal(
          value.deps.BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR,
          'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.',
        );
        assert.equal(value.deps.getCorsContext, 'getCorsContext');
        value.deps.logBootstrapPayload({
          requestId: 'bootstrap-1',
          body: {
            address: '0xabc',
            message: 'message',
            signature: 'sig',
            sessionSlug: 'session-a',
            groupSlug: 'legacy-a',
          },
        });
        value.deps.logBootstrapConfigMissing({
          targetSlug: 'session-a',
          requestId: 'bootstrap-2',
        });
        value.deps.logBootstrapCorsReject({
          requestId: 'bootstrap-3',
          targetSlug: 'session-a',
          allowOrigins: ['https://allowed.example'],
        });
        return {
          handled: true,
          response,
        };
      },
      dispatchAuthenticatedRouteEntry: async () => {
        assert.fail('authenticated fallback should not run when bootstrap handled the upload');
      },
    },
    constants: createBaseConstants(),
  });

  const result = await routeShell.fetch(request, env);

  assert.equal(result, response);
  assert.deepEqual(warnings, [
    ['[arweave] bootstrap config missing', {
      targetSlug: 'session-a',
      requestId: 'bootstrap-2',
    }],
    ['[arweave] cors reject', {
      requestId: 'bootstrap-3',
      origin: '',
      targetSlug: 'session-a',
      allowOrigins: ['https://allowed.example'],
    }],
  ]);
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
        consumeNonce: async (...args) => {
          assert.deepEqual(args, [
            env,
            'session-a',
            '0xabc',
            'nonce-1',
            { usedNonceTtlSeconds: 600 },
          ]);
          return 'consumeNonceResult';
        },
        dispatchAdminRequest: async (value) => {
          assert.equal(value.request, request);
          assert.equal(value.env, env);
          assert.equal(value.baseHeaders, baseHeaders);
          assert.equal(value.slug, 'env-slug');
          assert.equal(value.action, 'set-config');
          assert.equal(value.deps.json, 'json');
          assert.equal(value.deps.normalizeSignedWorkerRequest, 'normalizeSignedWorkerRequest');
          assert.equal(value.deps.resolveWorkerBodySlugContext, 'resolveWorkerBodySlugContext');
          assert.equal(value.deps.isAddress, 'isAddress');
          assert.equal(value.deps.getAddress, 'getAddress');
          assert.equal(value.deps.resolveExistingSessionCors, 'resolveExistingSessionCors');
          assert.equal(value.deps.verifyMessage, 'verifyMessage');
          assert.equal(value.deps.validateRecoveredAddressMatchesRequest, 'validateRecoveredAddressMatchesRequest');
          assert.equal(value.deps.parseSiweMessage, 'parseSiweMessage');
          assert.equal(value.deps.validateSiwe, 'validateSiwe');
          assert.equal(value.deps.validateSiweAddressMatchesRequest, 'validateSiweAddressMatchesRequest');
          assert.equal(value.deps.validateBootstrapAdmin, 'validateBootstrapAdmin');
          assert.equal(value.deps.validateAdmin, 'validateAdmin');
          assert.equal(value.deps.mergeWorkerConfigRecords, 'mergeWorkerConfigRecords');
          assert.equal(value.deps.mergeWorkerLimitRecords, 'mergeWorkerLimitRecords');
          assert.equal(value.deps.putSessionConfig, 'putSessionConfig');
          assert.equal(value.deps.getSessionSecrets, 'getSessionSecrets');
          assert.equal(value.deps.normalizeSecretValue, 'normalizeSecretValue');
          assert.equal(value.deps.putSessionSecrets, 'putSessionSecrets');
          assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
          assert.equal(await value.deps.consumeNonce(env, 'session-a', '0xabc', 'nonce-1'), 'consumeNonceResult');
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
        getSessionSecrets: async (receivedEnv, slug) => {
          assert.equal(receivedEnv, env);
          assert.equal(slug, 'session-a');
          return { openaiKey: 'sk-worker' };
        },
        dispatchAnonymousRouteEntry: async (value) => {
          assert.equal(value.path, '/ai');
          assert.equal(value.anonymousRoute, 'ai');
          assert.equal(value.request, request);
          assert.equal(value.env, env);
          assert.equal(value.slugHint, 'env-slug');
          assert.equal(value.baseHeaders, baseHeaders);
          assert.equal(value.deps.resolveRequestSlugWithoutToken, 'resolveRequestSlugWithoutToken');
          assert.equal(value.deps.json, 'json');
          assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
          assert.equal(value.deps.getSessionConfig, 'getSessionConfig');
          assert.equal(value.deps.SESSION_CONFIG_NOT_FOUND_ERROR, 'Session config not found.');
          assert.equal(value.deps.getCorsContext, 'getCorsContext');
          assert.equal(value.deps.resolveAnonymousRateIdentity, 'resolveAnonymousRateIdentity');
          assert.equal(value.deps.checkRateLimit, 'checkRateLimit');
          const dispatchResponse = await value.deps.dispatchAnonymousRoute({
            path: '/ai',
            request,
            anonymousContext: { slug: 'session-a' },
          });
          assert.equal(dispatchResponse, 'anonymousDispatchResponse');
          return response;
        },
        dispatchAnonymousRoute: async (value) => {
          assert.equal(value.path, '/ai');
          assert.equal(value.request, request);
          assert.deepEqual(value.anonymousContext, { slug: 'session-a' });
          assert.equal(value.deps.storageRoute, 'storageRoute');
          assert.equal(value.deps.readTranscribeRequestPayload, 'readTranscribeRequestPayload');
          assert.equal(value.deps.evaluateAnonymousRouteAccess, 'evaluateAnonymousRouteAccess');
          assert.deepEqual(await value.deps.getSessionSecrets('session-a'), { openaiKey: 'sk-worker' });
          assert.equal(value.deps.transcribe, 'transcribe');
          assert.equal(value.deps.readAiRequestPayload, 'readAiRequestPayload');
          assert.equal(value.deps.validateAnonymousAiRequest, 'validateAnonymousAiRequest');
          assert.equal(value.deps.proxyAnthropic, 'proxyAnthropic');
          assert.equal(value.deps.proxyOpenAI, 'proxyOpenAI');
          assert.equal(value.deps.proxyOpenRouter, 'proxyOpenRouter');
          assert.equal(value.deps.proxyCustomRPC, 'proxyCustomRPC');
          assert.equal(value.deps.json, 'json');
          assert.equal(value.deps.now, 'now');
          assert.equal(
            value.deps.ANONYMOUS_ROUTE_DENIED_ERROR,
            'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.',
          );
          return 'anonymousDispatchResponse';
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
      resolveAuthenticatedRouteContext: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.deps.getSessionConfig, 'getSessionConfig');
        assert.equal(value.deps.getCorsContext, 'getCorsContext');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.SESSION_CONFIG_NOT_FOUND_ERROR, 'Session config not found.');
        return 'contextResponse';
      },
      dispatchAuthenticatedRoute: async (value) => {
        assert.equal(value.path, '/arweave/upload');
        assert.equal(value.method, 'POST');
        assert.equal(value.request, request);
        assert.equal(value.authenticatedContext, 'authenticatedContext');
        assert.equal(value.deps.readAuthenticatedActionPayload, 'readAuthenticatedActionPayload');
        assert.equal(value.deps.json, 'json');
        assert.equal(
          await value.deps.dispatchAuthenticatedSecretPathRoute({ path: '/transcribe' }),
          'secretPathResponse',
        );
        assert.equal(
          await value.deps.dispatchAuthenticatedNonSecretActionRoute({ action: 'fetch_url' }),
          'nonSecretResponse',
        );
        assert.equal(
          await value.deps.dispatchAuthenticatedSecretActionRoute({ action: 'ai' }),
          'secretActionResponse',
        );
        return 'dispatchResponse';
      },
      dispatchAuthenticatedSecretPathRoute: async (value) => {
        assert.equal(value.env, env);
        assert.equal(value.path, '/transcribe');
        assert.equal(value.deps.evaluateAuthenticatedRoutePreflight, 'evaluateAuthenticatedRoutePreflight');
        assert.equal(value.deps.computeScopesForLogin, 'computeScopesForLogin');
        assert.equal(value.deps.resolveAuthenticatedRouteSecrets, 'resolveAuthenticatedRouteSecrets');
        assert.equal(value.deps.checkRateLimit, 'checkRateLimit');
        assert.equal(value.deps.getSessionSecrets, 'getSessionSecrets');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.isAddress, 'isAddress');
        assert.equal(value.deps.getAddress, 'getAddress');
        assert.equal(value.deps.transcribe, 'transcribe');
        assert.equal(value.deps.arweaveUpload, 'arweaveUpload');
        assert.equal(value.deps.storageRoute, 'storageRoute');
        assert.equal(value.deps.now, 'now');
        return 'secretPathResponse';
      },
      dispatchAuthenticatedNonSecretActionRoute: async (value) => {
        assert.equal(value.env, env);
        assert.equal(value.action, 'fetch_url');
        assert.equal(value.deps.evaluateAuthenticatedRoutePreflight, 'evaluateAuthenticatedRoutePreflight');
        assert.equal(value.deps.computeScopesForLogin, 'computeScopesForLogin');
        assert.equal(value.deps.fetchImage, 'fetchImage');
        assert.equal(value.deps.fetchUrl, 'fetchUrl');
        assert.equal(value.deps.checkRateLimit, 'checkRateLimit');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.now, 'now');
        return 'nonSecretResponse';
      },
      dispatchAuthenticatedSecretActionRoute: async (value) => {
        assert.equal(value.env, env);
        assert.equal(value.action, 'ai');
        assert.equal(value.deps.evaluateAuthenticatedRoutePreflight, 'evaluateAuthenticatedRoutePreflight');
        assert.equal(value.deps.computeScopesForLogin, 'computeScopesForLogin');
        assert.equal(value.deps.resolveAuthenticatedRouteSecrets, 'resolveAuthenticatedRouteSecrets');
        assert.equal(value.deps.normalizeAiRequestPayload, 'normalizeAiRequestPayload');
        assert.equal(value.deps.proxyAnthropic, 'proxyAnthropic');
        assert.equal(value.deps.proxyOpenAI, 'proxyOpenAI');
        assert.equal(value.deps.proxyOpenRouter, 'proxyOpenRouter');
        assert.equal(value.deps.proxyCustomRPC, 'proxyCustomRPC');
        assert.equal(value.deps.faucet, 'faucet');
        assert.equal(value.deps.checkRateLimit, 'checkRateLimit');
        assert.equal(value.deps.getSessionSecrets, 'getSessionSecrets');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.now, 'now');
        return 'secretActionResponse';
      },
      dispatchBootstrapArweaveUpload: async () => ({ handled: false }),
      dispatchAuthenticatedRouteEntry: async (value) => {
        assert.equal(value.path, '/arweave/upload');
        assert.equal(value.method, 'POST');
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.requireAuth, 'requireAuth');
        assert.equal(
          await value.deps.resolveAuthenticatedRouteContext({
            request,
            env,
            baseHeaders,
          }),
          'contextResponse',
        );
        assert.equal(
          await value.deps.dispatchAuthenticatedRoute({
            path: '/arweave/upload',
            method: 'POST',
            request,
            authenticatedContext: 'authenticatedContext',
          }),
          'dispatchResponse',
        );
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
      dispatchAdminRequest: async () => {
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

for (const contentLength of [null, '1']) {
  test(`request boundary rejects oversized bytes before route parsing, content-length=${contentLength}`, async () => {
    let cancelled = false;
    let dispatched = false;
    const headers = { 'content-type': 'application/json' };
    if (contentLength) headers['content-length'] = contentLength;
    const request = new Request('https://worker.example/auth/login', {
      method: 'POST', headers, duplex: 'half',
      body: new ReadableStream({
        pull(controller) { controller.enqueue(new Uint8Array(9)); },
        cancel() { cancelled = true; },
      }),
    });
    const shell = createWorkerRouteShellWithWorkerDeps({ deps: {
      getRouteBaseHeaders: () => ({ 'X-Test': 'cors' }),
      dispatchAuthLoginRequest: () => { dispatched = true; return new Response(); },
    } });
    const result = await shell.fetch(request, { CE_MAX_UPLOAD_BYTES: '8' });
    assert.equal(result.status, 413);
    assert.equal(result.headers.get('X-Test'), 'cors');
    assert.equal(dispatched, false);
    assert.equal(cancelled, true);
  });
}

test('request boundary preserves exact UTF-8 signature bytes and request metadata at the limit', async () => {
  const body = '{ "message": "é\\r\\n", "signature": "0x1234" }';
  const shell = createWorkerRouteShellWithWorkerDeps({ deps: {
    getRouteBaseHeaders: () => ({}),
    dispatchAuthLoginRequest: async ({ request }) => {
      assert.equal(request.headers.get('Authorization'), 'Bearer fixture');
      assert.equal(request.url, 'https://worker.example/auth/login?sessionSlug=fixture');
      assert.equal(await request.text(), body);
      return new Response('preserved');
    },
  } });
  const response = await shell.fetch(new Request('https://worker.example/auth/login?sessionSlug=fixture', {
    method: 'POST', body, headers: { Authorization: 'Bearer fixture', 'content-type': 'application/json' },
  }), { CE_MAX_UPLOAD_BYTES: new TextEncoder().encode(body).byteLength });
  assert.equal(await response.text(), 'preserved');
});
