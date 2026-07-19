import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthCorsAdminAdaptersWithWorkerDeps } from './authCorsAdminBinding.js';

test('createAuthCorsAdminAdaptersWithWorkerDeps preserves worker-specific auth/CORS/admin deps bundles', async () => {
  const request = new Request('https://worker.example/path', {
    headers: {
      Authorization: 'Bearer test-token',
      Origin: 'https://allowed.example',
    },
  });
  const env = {
    GROUP_KV: {},
    TOKEN_HMAC_SECRET: 'secret',
  };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const config = { allowOrigins: ['https://allowed.example'] };
  const responses = {
    cors: { ok: true, headers: new Headers({ 'Access-Control-Allow-Origin': 'https://allowed.example' }) },
    existing: { ok: true, headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' }, config },
    auth: { ok: true, payload: { sub: '0xabc' }, slug: 'session-a' },
    admin: true,
  };
  const calls = [];

  const adapters = createAuthCorsAdminAdaptersWithWorkerDeps({
    deps: {
      getCorsContext: async (value) => {
        calls.push('getCorsContext');
        assert.equal(value.request, request);
        assert.equal(value.config, config);
        assert.deepEqual(value.deps, {
          parseAllowOrigins: 'parseAllowOrigins',
          originAllowed: 'originAllowed',
          corsHeaders: 'corsHeaders',
          json: 'json',
        });
        return responses.cors;
      },
      resolveExistingSessionCors: async (value) => {
        calls.push('resolveExistingSessionCors');
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.slug, 'session-a');
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.deps.normalizeWorkerSessionSlug, 'normalizeWorkerSessionSlug');
        assert.equal(value.deps.getSessionConfig, 'getSessionConfig');
        assert.equal(value.deps.corsHeaders, 'corsHeaders');
        assert.equal(value.deps.resolveTrustedAdminOrigins, 'resolveTrustedAdminOrigins');
        assert.equal(
          await value.deps.getCorsContext({ request, config }),
          responses.cors,
        );
        return responses.existing;
      },
      requireAuth: async (value) => {
        calls.push('requireAuth');
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.slugHint, 'slug-hint');
        assert.deepEqual(value.deps, {
          verifyToken: 'verifyToken',
          validateAuthTokenRecord: 'validateAuthTokenRecord',
          resolveWorkerRequestSlugContext: 'resolveWorkerRequestSlugContext',
          json: 'json',
          MISSING_SLUG_ERROR: 'Missing sessionSlug.',
        });
        return responses.auth;
      },
      validateAdmin: async (value) => {
        calls.push('validateAdmin');
        assert.equal(value.env, env);
        assert.equal(value.slug, 'session-a');
        assert.equal(value.address, '0xabc');
        assert.deepEqual(value.config, { adminAddress: '0xabc' });
        assert.deepEqual(value.body, { action: 'set-config' });
        assert.deepEqual(value.deps, {
          toStr: 'toStr',
          isAddress: 'isAddress',
          resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
          getHatsInterface: 'getHatsInterface',
          callContractFunction: 'callContractFunction',
          rpcRequest: 'rpcRequest',
          toChainId: 'toChainId',
        });
        return responses.admin;
      },
      parseAllowOrigins: 'parseAllowOrigins',
      originAllowed: 'originAllowed',
      corsHeaders: 'corsHeaders',
      json: 'json',
      normalizeWorkerSessionSlug: 'normalizeWorkerSessionSlug',
      getSessionConfig: 'getSessionConfig',
      resolveTrustedAdminOrigins: 'resolveTrustedAdminOrigins',
      verifyToken: 'verifyToken',
      validateAuthTokenRecord: 'validateAuthTokenRecord',
      resolveWorkerRequestSlugContext: 'resolveWorkerRequestSlugContext',
      toStr: 'toStr',
      isAddress: 'isAddress',
      resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
      getHatsInterface: 'getHatsInterface',
      callContractFunction: 'callContractFunction',
      rpcRequest: 'rpcRequest',
      toChainId: 'toChainId',
    },
    constants: {
      missingSlugError: 'Missing sessionSlug.',
    },
  });

  assert.equal(
    await adapters.getCorsContext({ request, config }),
    responses.cors,
  );
  assert.equal(
    await adapters.resolveExistingSessionCors({ request, env, slug: 'session-a', baseHeaders }),
    responses.existing,
  );
  assert.equal(
    await adapters.requireAuth({ request, env, baseHeaders, slugHint: 'slug-hint' }),
    responses.auth,
  );
  assert.equal(
    await adapters.validateAdmin({
      env,
      slug: 'session-a',
      address: '0xabc',
      config: { adminAddress: '0xabc' },
      body: { action: 'set-config' },
    }),
    responses.admin,
  );

  assert.deepEqual(calls, [
    'getCorsContext',
    'resolveExistingSessionCors',
    'getCorsContext',
    'requireAuth',
    'validateAdmin',
  ]);
});
