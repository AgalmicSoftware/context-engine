import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchBootstrapLitPaymentDelegation } from './bootstrapLitPaymentDelegationDispatch.js';

test('dispatchBootstrapLitPaymentDelegation derives audience from the request origin', async () => {
  const request = {
    json: async () => ({
      sessionSlug: 'session-a',
      sessionPublicKey: '6e28158980f0a619cb6c90ddc396e5c79bdf65cf60b1ab5df0e9972620c07ef4',
      audience: 'https://phishing.example',
      expiresAt: '2099-01-01T00:00:00.000Z',
    }),
    headers: new Headers({ Origin: 'https://allowed.example' }),
  };

  const result = await dispatchBootstrapLitPaymentDelegation({
    request,
    deps: {
      corsHeaders: () => ({ 'Access-Control-Allow-Origin': 'https://allowed.example' }),
      json: (body, status, headers) => ({ body, status, headers }),
      resolveWorkerBodySlugContext: () => ({ ok: true, targetSlug: 'session-a' }),
      getSessionConfig: async () => ({ lit: { network: 'naga-test' } }),
      getCorsContext: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      }),
      verifyAdminSignature: async () => ({
        ok: true,
        address: '0x00000000000000000000000000000000000000aa',
      }),
      getSessionSecrets: async () => ({ litPayerPrivateKey: '0xabc123' }),
      issueLitPaymentDelegation: async (value) => {
        assert.deepEqual(value, {
          requesterAddress: '0x00000000000000000000000000000000000000aa',
          sessionPublicKey: '6e28158980f0a619cb6c90ddc396e5c79bdf65cf60b1ab5df0e9972620c07ef4',
          litNetwork: 'naga-test',
          litPayerPrivateKey: '0xabc123',
          audience: 'https://allowed.example',
          expiresAt: '2099-01-01T00:00:00.000Z',
        });
        return {
          capabilityAuthSig: { sig: '0xsig' },
          payerAddress: '0x00000000000000000000000000000000000000bb',
        };
      },
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
      BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR:
        'Session config not found. Provide litPayerPrivateKey for bootstrap delegation or register session config first.',
    },
  });

  assert.deepEqual(result, {
    handled: true,
    response: {
      body: {
        ok: true,
        capabilityAuthSig: { sig: '0xsig' },
        payerAddress: '0x00000000000000000000000000000000000000bb',
      },
      status: 200,
      headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    },
  });
});

test('dispatchBootstrapLitPaymentDelegation accepts an explicit general-session slug', async () => {
  const request = {
    json: async () => ({
      sessionSlug: 'general',
      sessionPublicKey: '6e28158980f0a619cb6c90ddc396e5c79bdf65cf60b1ab5df0e9972620c07ef4',
      expiresAt: '2099-01-01T00:00:00.000Z',
    }),
    headers: new Headers({ Origin: 'https://allowed.example' }),
  };

  const result = await dispatchBootstrapLitPaymentDelegation({
    request,
    deps: {
      corsHeaders: () => ({ 'Access-Control-Allow-Origin': 'https://allowed.example' }),
      json: (body, status, headers) => ({ body, status, headers }),
      resolveWorkerBodySlugContext: () => ({ ok: true, targetSlug: '', explicitSlugProvided: true }),
      getSessionConfig: async (slug) => {
        assert.equal(slug, '');
        return { lit: { network: 'naga-test' } };
      },
      getCorsContext: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      }),
      verifyAdminSignature: async (value) => {
        assert.equal(value.slugHint, '');
        return {
          ok: true,
          address: '0x00000000000000000000000000000000000000aa',
        };
      },
      getSessionSecrets: async (slug) => {
        assert.equal(slug, '');
        return { litPayerPrivateKey: '0xabc123' };
      },
      issueLitPaymentDelegation: async (value) => {
        assert.equal(value.litNetwork, 'naga-test');
        return {
          capabilityAuthSig: { sig: '0xsig' },
          payerAddress: '0x00000000000000000000000000000000000000bb',
        };
      },
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
      BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR:
        'Session config not found. Provide litPayerPrivateKey for bootstrap delegation or register session config first.',
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response.status, 200);
});
