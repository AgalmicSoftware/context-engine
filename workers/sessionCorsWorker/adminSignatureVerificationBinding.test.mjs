import test from 'node:test';
import assert from 'node:assert/strict';

import { createVerifyAdminSignatureWithWorkerDeps } from './adminSignatureVerificationBinding.js';

test('createVerifyAdminSignatureWithWorkerDeps preserves admin-signature wiring and used-nonce ttl binding', async () => {
  const env = { GROUP_KV: { id: 'kv' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const body = { sessionSlug: 'session-a' };
  const logs = [];
  const consumeCalls = [];
  const response = { ok: true, slug: 'session-a', address: '0xabc' };

  const verifyAdminSignature = createVerifyAdminSignatureWithWorkerDeps({
    deps: {
      verifyAdminSignature: async (value) => {
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.slugHint, 'session-a');
        assert.equal(value.body, body);
        assert.deepEqual(value.config, { adminAddress: '0xadmin' });
        assert.equal(value.allowBootstrapWithoutConfig, true);
        assert.equal(value.deps.normalizeSignedWorkerRequest, 'normalizeSignedWorkerRequest');
        assert.equal(value.deps.resolveWorkerBodySlugContext, 'resolveWorkerBodySlugContext');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.isAddress, 'isAddress');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.verifyMessage, 'verifyMessage');
        assert.equal(value.deps.validateRecoveredAddressMatchesRequest, 'validateRecoveredAddressMatchesRequest');
        assert.equal(value.deps.parseSiweMessage, 'parseSiweMessage');
        assert.equal(value.deps.validateSiwe, 'validateSiwe');
        assert.equal(value.deps.validateSiweAddressMatchesRequest, 'validateSiweAddressMatchesRequest');
        assert.equal(value.deps.validateAdmin, 'validateAdmin');
        assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
        assert.equal(value.deps.SLUG_ALIAS_MISMATCH_ERROR, 'sessionSlug aliases do not match.');
        assert.equal(value.deps.SLUG_MISMATCH_ERROR, 'sessionSlug does not match worker session.');

        const consumeResponse = await value.deps.consumeNonce(
          env,
          'session-a',
          '0xabc',
          'nonce-1',
        );
        assert.equal(consumeResponse, 'consumeNonceResult');

        value.deps.log('[arweave] admin verify start', { requestId: 'req-1' });
        return response;
      },
      normalizeSignedWorkerRequest: 'normalizeSignedWorkerRequest',
      resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
      toStr: 'toStr',
      isAddress: 'isAddress',
      json: 'json',
      verifyMessage: 'verifyMessage',
      validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
      parseSiweMessage: 'parseSiweMessage',
      validateSiwe: 'validateSiwe',
      validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
      consumeNonce: async (...args) => {
        consumeCalls.push(args);
        return 'consumeNonceResult';
      },
      validateAdmin: 'validateAdmin',
      log: (...args) => {
        logs.push(args);
      },
    },
    constants: {
      usedNonceTtlSeconds: 600,
      missingSlugError: 'Missing sessionSlug.',
      slugAliasMismatchError: 'sessionSlug aliases do not match.',
      slugMismatchError: 'sessionSlug does not match worker session.',
    },
  });

  const result = await verifyAdminSignature({
    env,
    baseHeaders,
    slugHint: 'session-a',
    body,
    config: { adminAddress: '0xadmin' },
    allowBootstrapWithoutConfig: true,
  });

  assert.equal(result, response);
  assert.deepEqual(consumeCalls, [[
    env,
    'session-a',
    '0xabc',
    'nonce-1',
    { usedNonceTtlSeconds: 600 },
  ]]);
  assert.deepEqual(logs, [[
    '[arweave] admin verify start',
    { requestId: 'req-1' },
  ]]);
});
