import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAdminRequestWithWorkerDeps } from './adminRequestBinding.js';

test('dispatchAdminRequestWithWorkerDeps preserves admin-request wiring and used-nonce ttl binding', async () => {
  const request = new Request('https://worker.example/admin/set-config', { method: 'POST' });
  const env = { GROUP_KV: { id: 'kv' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const response = new Response('ok');
  const consumeCalls = [];

  const result = await dispatchAdminRequestWithWorkerDeps({
    request,
    env,
    baseHeaders,
    slug: 'env-slug',
    action: 'set-config',
    deps: {
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
      getAddress: 'getAddress',
      resolveExistingSessionCors: 'resolveExistingSessionCors',
      verifyMessage: 'verifyMessage',
      validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
      parseSiweMessage: 'parseSiweMessage',
      validateSiwe: 'validateSiwe',
      validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
      consumeNonce: async (...args) => {
        consumeCalls.push(args);
        return 'consumeNonceResult';
      },
      validateBootstrapAdmin: 'validateBootstrapAdmin',
      validateAdmin: 'validateAdmin',
      mergeWorkerConfigRecords: 'mergeWorkerConfigRecords',
      mergeWorkerLimitRecords: 'mergeWorkerLimitRecords',
      putSessionConfig: 'putSessionConfig',
      getSessionSecrets: 'getSessionSecrets',
      normalizeSecretValue: 'normalizeSecretValue',
      putSessionSecrets: 'putSessionSecrets',
    },
    constants: {
      usedNonceTtlSeconds: 600,
      missingSlugError: 'Missing sessionSlug.',
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
