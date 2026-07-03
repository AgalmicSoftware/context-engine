import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dispatchAuthLoginRequestWithWorkerDeps,
  dispatchAuthNonceRequestWithWorkerDeps,
} from './authRequestBinding.js';

test('dispatchAuthNonceRequestWithWorkerDeps preserves nonce-request wiring and env-bound nonce storage', async () => {
  const request = new Request('https://worker.example/auth/nonce', { method: 'POST' });
  const writes = [];
  const env = {
    GROUP_KV: {
      put: async (...args) => {
        writes.push(args);
      },
    },
  };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const response = new Response('ok');

  const result = await dispatchAuthNonceRequestWithWorkerDeps({
    request,
    env,
    baseHeaders,
    slug: 'env-slug',
    deps: {
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
        assert.equal(value.deps.now(), 1234567890);
        assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
        assert.equal(value.deps.NONCE_TTL_SECONDS, 300);
        assert.equal(value.deps.NONCE_RATE_LIMIT_MAX, 5);
        assert.equal(value.deps.NONCE_RATE_LIMIT_WINDOW_MS, 60000);
        assert.equal(value.deps.NONCE_RATE_LIMIT_TTL_SECONDS, 60);

        const builtNonce = value.deps.buildNonce();
        assert.equal(builtNonce, 'nonce-built');

        await value.deps.putNonce(env, 'nonce:session-a:0xabc', builtNonce, 300);
        return response;
      },
      json: 'json',
      toStr: 'toStr',
      isAddress: 'isAddress',
      resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
      resolveExistingSessionCors: 'resolveExistingSessionCors',
      validateTrustedLoginRequestOrigin: 'validateTrustedLoginRequestOrigin',
      resolveTrustedAdminOrigins: 'resolveTrustedAdminOrigins',
      checkNonceRateLimit: 'checkNonceRateLimit',
      now: () => 1234567890,
      buildNonce: ({ base64UrlEncode }) => {
        assert.equal(base64UrlEncode, 'base64UrlEncode');
        return 'nonce-built';
      },
      base64UrlEncode: 'base64UrlEncode',
    },
    constants: {
      missingSlugError: 'Missing sessionSlug.',
      nonceTtlSeconds: 300,
      nonceRateLimitMax: 5,
      nonceRateLimitWindowMs: 60000,
      nonceRateLimitTtlSeconds: 60,
    },
  });

  assert.equal(result, response);
  assert.deepEqual(writes, [[
    'nonce:session-a:0xabc',
    'nonce-built',
    { expirationTtl: 300 },
  ]]);
});

test('dispatchAuthLoginRequestWithWorkerDeps preserves login-request wiring and used-nonce ttl binding', async () => {
  const request = new Request('https://worker.example/auth/login', { method: 'POST' });
  const env = { GROUP_KV: { id: 'kv' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const response = new Response('ok');
  const consumeCalls = [];

  const result = await dispatchAuthLoginRequestWithWorkerDeps({
    request,
    env,
    baseHeaders,
    slug: 'env-slug',
    deps: {
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
        assert.equal(value.deps.now(), 1234567890);
        assert.equal(value.deps.LOGIN_SIWE_MAX_AGE_MS, 300000);
        assert.equal(value.deps.LOGIN_SIWE_FUTURE_SKEW_MS, 60000);
        assert.equal(value.deps.TOKEN_TTL_SECONDS, 86400);
        assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
        assert.equal(value.deps.SESSION_CONFIG_NOT_FOUND_ERROR, 'Session config not found.');

        const consumeResponse = await value.deps.consumeNonce(
          env,
          'session-a',
          '0xabc',
          'nonce-1',
        );
        assert.equal(consumeResponse, 'consumeNonceResult');

        return response;
      },
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
      consumeNonce: async (...args) => {
        consumeCalls.push(args);
        return 'consumeNonceResult';
      },
      computeScopesForLogin: 'computeScopesForLogin',
      signToken: 'signToken',
      getAddress: 'getAddress',
      buildAuthTokenJti: 'buildAuthTokenJti',
      persistAuthTokenRecord: 'persistAuthTokenRecord',
      now: () => 1234567890,
    },
    constants: {
      usedNonceTtlSeconds: 600,
      loginSiweMaxAgeMs: 300000,
      loginSiweFutureSkewMs: 60000,
      tokenTtlSeconds: 86400,
      missingSlugError: 'Missing sessionSlug.',
      sessionConfigNotFoundError: 'Session config not found.',
    },
  });

  assert.equal(result, response);
  assert.deepEqual(consumeCalls, [[
    env,
    'session-a',
    '0xabc',
    'nonce-1',
    { usedNonceTtlSeconds: 600 },
  ]]);
});
