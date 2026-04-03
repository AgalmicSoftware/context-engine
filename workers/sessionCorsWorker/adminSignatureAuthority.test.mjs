import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAdminSignatureAuthority } from './adminSignatureAuthority.js';

const createAuthorityDeps = (overrides = {}) => ({
  isAddress: () => true,
  verifyMessage: () => '0xabc',
  validateRecoveredAddressMatchesRequest: () => ({ ok: true }),
  parseSiweMessage: () => ({ nonce: 'nonce-1' }),
  validateSiwe: () => ({ ok: true }),
  validateSiweAddressMatchesRequest: () => ({ ok: true }),
  consumeNonce: async () => ({ ok: true }),
  validateAdmin: async () => true,
  MISSING_SLUG_ERROR: 'Missing sessionSlug.',
  ...overrides,
});

const createRequest = (overrides = {}) => ({
  env: { GROUP_KV: {} },
  body: { requestId: 'req-1' },
  config: { adminAddress: '0xadmin' },
  allowBootstrapWithoutConfig: false,
  address: '0xabc',
  message: 'signed-message',
  signature: '0xsig',
  targetSlug: 'session-a',
  flags: {
    adminAddressSet: true,
    hatsAddressSet: false,
    adminHatIdSet: false,
  },
  deps: createAuthorityDeps(),
  ...overrides,
});

test('resolveAdminSignatureAuthority preserves early address/message/slug validation failures', async () => {
  assert.deepEqual(
    await resolveAdminSignatureAuthority(createRequest({
      address: '',
    })),
    {
      ok: false,
      status: 400,
      error: 'Invalid address.',
      reason: 'invalid_address',
    }
  );

  assert.deepEqual(
    await resolveAdminSignatureAuthority(createRequest({
      message: '',
    })),
    {
      ok: false,
      status: 400,
      error: 'Missing message or signature.',
      reason: 'missing_message_or_signature',
    }
  );

  assert.deepEqual(
    await resolveAdminSignatureAuthority(createRequest({
      targetSlug: '',
    })),
    {
      ok: false,
      status: 400,
      error: 'Missing sessionSlug.',
      reason: 'missing_session_slug',
    }
  );
});

test('resolveAdminSignatureAuthority accepts an explicit general-session slug when the caller marks it explicit', async () => {
  const result = await resolveAdminSignatureAuthority(createRequest({
    targetSlug: '',
    explicitSlugProvided: true,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.slug, '');
});

test('resolveAdminSignatureAuthority preserves signature and SIWE validation failures', async () => {
  assert.deepEqual(
    await resolveAdminSignatureAuthority(createRequest({
      deps: createAuthorityDeps({
        verifyMessage: () => {
          throw new Error('bad signature');
        },
      }),
    })),
    {
      ok: false,
      status: 400,
      error: 'Invalid signature.',
      reason: 'invalid_signature',
    }
  );

  assert.deepEqual(
    await resolveAdminSignatureAuthority(createRequest({
      deps: createAuthorityDeps({
        validateRecoveredAddressMatchesRequest: () => ({
          ok: false,
          error: 'Recovered address does not match request address.',
        }),
      }),
    })),
    {
      ok: false,
      status: 400,
      error: 'Recovered address does not match request address.',
      reason: 'signature_mismatch',
      logExtra: { recovered: '0xabc' },
    }
  );

  assert.deepEqual(
    await resolveAdminSignatureAuthority(createRequest({
      deps: createAuthorityDeps({
        validateSiwe: () => ({
          ok: false,
          error: 'Invalid SIWE message.',
        }),
      }),
    })),
    {
      ok: false,
      status: 400,
      error: 'Invalid SIWE message.',
      reason: 'siwe_invalid',
      logExtra: { error: 'Invalid SIWE message.' },
    }
  );

  assert.deepEqual(
    await resolveAdminSignatureAuthority(createRequest({
      deps: createAuthorityDeps({
        validateSiweAddressMatchesRequest: () => ({
          ok: false,
          error: 'SIWE address does not match request address.',
        }),
      }),
    })),
    {
      ok: false,
      status: 400,
      error: 'SIWE address does not match request address.',
      reason: 'siwe_address_mismatch',
    }
  );
});

test('resolveAdminSignatureAuthority preserves nonce failure before admin authorization', async () => {
  let adminCalled = false;

  const result = await resolveAdminSignatureAuthority(createRequest({
    deps: createAuthorityDeps({
      consumeNonce: async (env, slug, address, nonce) => {
        assert.deepEqual([env, slug, address, nonce], [
          { GROUP_KV: {} },
          'session-a',
          '0xabc',
          'nonce-1',
        ]);
        return { ok: false, error: 'Invalid or expired nonce.' };
      },
      validateAdmin: async () => {
        adminCalled = true;
        return true;
      },
    }),
  }));

  assert.equal(adminCalled, false);
  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: 'Invalid or expired nonce.',
    reason: 'nonce_invalid',
    logExtra: { error: 'Invalid or expired nonce.' },
  });
});

test('resolveAdminSignatureAuthority preserves bootstrap no-config success without admin authorization', async () => {
  let adminCalled = false;

  const result = await resolveAdminSignatureAuthority(createRequest({
    config: null,
    allowBootstrapWithoutConfig: true,
    deps: createAuthorityDeps({
      validateAdmin: async () => {
        adminCalled = true;
        return true;
      },
    }),
  }));

  assert.equal(adminCalled, false);
  assert.deepEqual(result, {
    ok: true,
    slug: 'session-a',
    address: '0xabc',
    reason: 'bootstrap-no-config',
  });
});

test('resolveAdminSignatureAuthority preserves admin authorization failure and success contracts', async () => {
  const failure = await resolveAdminSignatureAuthority(createRequest({
    flags: {
      adminAddressSet: true,
      hatsAddressSet: true,
      adminHatIdSet: true,
    },
    deps: createAuthorityDeps({
      validateAdmin: async (value) => {
        assert.deepEqual(value, {
          env: { GROUP_KV: {} },
          slug: 'session-a',
          address: '0xabc',
          config: { adminAddress: '0xadmin' },
          body: { requestId: 'req-1' },
        });
        return false;
      },
    }),
  }));

  assert.deepEqual(failure, {
    ok: false,
    status: 403,
    error: 'Admin authorization failed.',
    reason: 'admin_authorization_failed',
    logExtra: {
      adminAddressSet: true,
      hatsAddressSet: true,
      adminHatIdSet: true,
    },
  });

  const success = await resolveAdminSignatureAuthority(createRequest({
    address: '0xAbC',
  }));

  assert.deepEqual(success, {
    ok: true,
    slug: 'session-a',
    address: '0xAbC',
    reason: 'authorized',
  });
});
