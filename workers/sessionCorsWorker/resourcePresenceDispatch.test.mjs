import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSponsoredResourcePresence,
  dispatchResourcePresenceRequest,
} from './resourcePresenceDispatch.js';

test('buildSponsoredResourcePresence exposes only resource booleans', () => {
  assert.deepEqual(
    buildSponsoredResourcePresence({
      openaiKey: 'sk-secret',
      anthropicKey: '',
      arweaveJwk: { kty: 'RSA', d: 'private' },
      customRpcUrl: 'https://rpc.example.test/key',
      customRpcKey: 'rpc-secret',
      faucetPrivateKey: '0xprivate',
    }),
    {
      ai: true,
      arweave: true,
      rpc: true,
      txGas: true,
    },
  );
});

test('dispatchResourcePresenceRequest validates session CORS and never returns secrets', async () => {
  const response = await dispatchResourcePresenceRequest({
    request: { headers: { get: () => 'demo-1' } },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      resolveRequestSlugWithoutToken: () => ({
        ok: true,
        slug: 'demo-1',
        explicitSlugProvided: true,
      }),
      getSessionConfig: async () => ({ slug: 'demo-1' }),
      getCorsContext: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://app.example.test' },
      }),
      getSessionSecrets: async () => ({
        openaiKey: 'sk-secret',
        arweaveJwk: '{"kty":"RSA","d":"private"}',
        customRpcUrl: 'https://rpc.example.test/key',
        faucetPrivateKey: '0xprivate',
      }),
      json: (body, status, headers) => ({ body, status, headers }),
    },
    constants: {
      missingSlugError: 'Session slug is required.',
      sessionConfigNotFoundError: 'Session config not found.',
    },
  });

  assert.deepEqual(response, {
    body: {
      ok: true,
      sessionSlug: 'demo-1',
      resources: { ai: true, arweave: true, rpc: true, txGas: true },
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://app.example.test' },
  });
  assert.equal(JSON.stringify(response).includes('sk-secret'), false);
  assert.equal(JSON.stringify(response).includes('private'), false);
});
