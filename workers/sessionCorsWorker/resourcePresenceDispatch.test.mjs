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

for (const [name, config, secrets, access, ready] of [
  ['configured voice', {}, { openaiKey: 'fixture-openai' }, true, true],
  ['another AI provider key only', {}, { anthropicKey: 'fixture-anthropic' }, true, false],
  ['blank key', {}, { openaiKey: '  ' }, true, false],
  ['voice disabled', { interviewMode: { enabled: false } }, { openaiKey: 'fixture-openai' }, true, false],
  ['unsupported provider', { interviewMode: { provider: 'other' } }, { openaiKey: 'fixture-openai' }, true, false],
  ['access denied', {}, { openaiKey: 'fixture-openai' }, false, false],
  ['ended session', { sessionEndsAt: '2000-01-01T00:00:00Z' }, { openaiKey: 'fixture-openai' }, true, false],
]) {
  test(`voice readiness: ${name}`, async () => {
    const result = await dispatchResourcePresenceRequest({
      request: new Request('https://worker.example/resource-presence?interview=1'), env: {},
      deps: {
        resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
        getSessionConfig: async () => config,
        getCorsContext: async () => ({ ok: true, headers: {} }),
        getSessionSecrets: async () => secrets,
        evaluateAnonymousRouteAccess: async ({ route }) => { assert.equal(route, 'realtime'); return { ok: access }; },
        json: (body) => body,
      },
    });
    assert.equal(result.interview.ready, ready);
    if (!ready) assert.ok(result.interview.reason);
    assert.equal(JSON.stringify(result).includes('fixture-'), false);
  });
}
