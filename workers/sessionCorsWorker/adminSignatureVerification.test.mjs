import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyAdminSignature } from './adminSignatureVerification.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

const createSignedBody = (overrides = {}) => ({
  address: '0xabc',
  message: 'signed-message',
  signature: '0xsig',
  requestId: 'req-1',
  ...overrides,
});

const createVerifyDeps = (overrides = {}) => ({
  normalizeSignedWorkerRequest: (body) => ({
    address: body.address,
    message: body.message,
    signature: body.signature,
    requestId: body.requestId,
  }),
  resolveWorkerBodySlugContext: () => ({
    ok: true,
    envSlug: '',
    slugPayload: {
      hasSessionSlug: true,
      hasGroupSlug: false,
      requestedSlug: 'session-a',
    },
    targetSlug: 'session-a',
  }),
  toStr: (value) => `${value ?? ''}`,
  isAddress: () => true,
  json: createJsonStub(),
  log: () => {},
  MISSING_SLUG_ERROR: 'Missing sessionSlug.',
  SLUG_ALIAS_MISMATCH_ERROR: 'sessionSlug aliases do not match.',
  SLUG_MISMATCH_ERROR: 'sessionSlug does not match worker session.',
  ...overrides,
});

test('verifyAdminSignature preserves slug-alias mismatch failure before admin authority work', async () => {
  let authorityCalled = false;

  const result = await verifyAdminSignature({
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slugHint: '',
    body: createSignedBody({
      sessionSlug: 'alpha',
      groupSlug: 'beta',
    }),
    config: null,
    deps: createVerifyDeps({
      resolveWorkerBodySlugContext: () => ({
        ok: false,
        error: 'sessionSlug aliases do not match.',
        envSlug: '',
        slugPayload: {
          sessionSlug: 'alpha',
          groupSlug: 'beta',
          requestedSlug: 'alpha',
        },
      }),
      resolveAdminSignatureAuthority: async () => {
        authorityCalled = true;
        return { ok: true };
      },
    }),
  });

  assert.equal(authorityCalled, false);
  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'sessionSlug aliases do not match.' },
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  });
});

test('verifyAdminSignature preserves admin authority failure passthrough and reject logging', async () => {
  const logs = [];

  const result = await verifyAdminSignature({
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    slugHint: '',
    body: createSignedBody(),
    config: {
      adminAddress: '0xadmin',
      hatsAddress: '0xhats',
      adminHatId: '7',
    },
    deps: createVerifyDeps({
      log: (...args) => logs.push(args),
      resolveAdminSignatureAuthority: async (value) => {
        assert.deepEqual(value.env, { GROUP_KV: {} });
        assert.deepEqual(value.body, createSignedBody());
        assert.deepEqual(value.config, {
          adminAddress: '0xadmin',
          hatsAddress: '0xhats',
          adminHatId: '7',
        });
        assert.equal(value.allowBootstrapWithoutConfig, false);
        assert.equal(value.address, '0xabc');
        assert.equal(value.message, 'signed-message');
        assert.equal(value.signature, '0xsig');
        assert.equal(value.targetSlug, 'session-a');
        assert.deepEqual(value.flags, {
          adminAddressSet: true,
          hatsAddressSet: true,
          adminHatIdSet: true,
        });
        assert.equal(typeof value.deps.isAddress, 'function');
        assert.equal(value.deps.verifyMessage, undefined);
        assert.equal(value.deps.validateRecoveredAddressMatchesRequest, undefined);
        assert.equal(value.deps.parseSiweMessage, undefined);
        assert.equal(value.deps.validateSiwe, undefined);
        assert.equal(value.deps.validateSiweAddressMatchesRequest, undefined);
        assert.equal(value.deps.consumeNonce, undefined);
        assert.equal(value.deps.validateAdmin, undefined);
        assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
        return {
          ok: false,
          status: 403,
          error: 'Admin authorization failed.',
          reason: 'admin_authorization_failed',
          logExtra: {
            adminAddressSet: true,
            hatsAddressSet: true,
            adminHatIdSet: true,
          },
        };
      },
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'Admin authorization failed.' },
      status: 403,
      headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    },
  });
  assert.deepEqual(logs, [
    [
      '[arweave] admin verify start',
      {
        requestId: 'req-1',
        address: '0xabc',
        targetSlug: 'session-a',
        hasMessage: true,
        hasSignature: true,
        hasSessionSlug: true,
        hasGroupSlug: false,
        envSlug: null,
        requestedSlug: 'session-a',
      },
    ],
    [
      '[arweave] admin verify reject',
      {
        requestId: 'req-1',
        reason: 'admin_authorization_failed',
        address: '0xabc',
        targetSlug: 'session-a',
        adminAddressSet: true,
        hatsAddressSet: true,
        adminHatIdSet: true,
      },
    ],
  ]);
});

test('verifyAdminSignature preserves admin authority success passthrough and bootstrap ok logging', async () => {
  const logs = [];

  const result = await verifyAdminSignature({
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    slugHint: 'session-a',
    body: createSignedBody(),
    config: null,
    allowBootstrapWithoutConfig: true,
    deps: createVerifyDeps({
      log: (...args) => logs.push(args),
      resolveAdminSignatureAuthority: async () => ({
        ok: true,
        slug: 'session-a',
        address: '0xabc',
        reason: 'bootstrap-no-config',
      }),
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    slug: 'session-a',
    address: '0xabc',
  });
  assert.deepEqual(logs, [
    [
      '[arweave] admin verify start',
      {
        requestId: 'req-1',
        address: '0xabc',
        targetSlug: 'session-a',
        hasMessage: true,
        hasSignature: true,
        hasSessionSlug: true,
        hasGroupSlug: false,
        envSlug: null,
        requestedSlug: 'session-a',
      },
    ],
    [
      '[arweave] admin verify ok (bootstrap no config)',
      {
        requestId: 'req-1',
        address: '0xabc',
        targetSlug: 'session-a',
      },
    ],
  ]);
});
