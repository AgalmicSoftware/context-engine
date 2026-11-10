import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { createWorkerRuntime } from './worker.js';
import { buildAuthTokenKey, revokeAuthTokenRecord } from './authTokenClaims.js';
import { verifyToken } from './tokenSigning.js';
import { buildSiweMessage, installSessionCoordinatorBinding, makeJsonRequest } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';

const origin = 'https://client.example.test';
const setup = async () => {
  const values = new Map();
  const kv = { get: async key => values.get(key) ?? null, put: async (key, value) => values.set(key, value),
    delete: async key => values.delete(key), list: async ({ prefix = '' } = {}) => ({ keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
  const wallet = new Wallet(`0x${'1'.repeat(64)}`);
  const ids = { '': `0x${'a'.repeat(32)}`, named: `0x${'b'.repeat(32)}` };
  for (const slug of ['', 'named']) await kv.put(`session:${slug}:config`, JSON.stringify({
    slug, sessionId: ids[slug], authzEpoch: 1, adminAddress: wallet.address, allowOrigins: [origin],
    workerAuthority: { version: 1, participantScopes: ['storage'], anonymousScopes: [] },
    sessionModeProfile: { authority: { mode: 'worker_canonical' }, surfaces: { browser: true } },
  }));
  const env = installSessionCoordinatorBinding({ GROUP_KV: kv, TOKEN_HMAC_SECRET: 'synthetic-general-auth-secret', LOGIN_TRUSTED_ORIGINS: origin });
  const worker = createWorkerRuntime(env, { fetch: async () => assert.fail('No external requests'), rpcFetch: async () => assert.fail('No RPC requests') });
  const request = (path, body) => worker.fetch(makeJsonRequest(path, body, { headers: { Origin: origin } }), env);
  const authenticate = async (slug) => {
    const sessionId = ids[slug === 'general' ? '' : slug];
    const nonceResponse = await request('/auth/nonce', { address: wallet.address, sessionSlug: slug, sessionId });
    const nonce = await nonceResponse.json();
    assert.equal(nonceResponse.status, 200, nonce.error);
    const message = buildSiweMessage({ domain: new URL(origin).host, uri: origin, address: wallet.address, nonce: nonce.nonce, sessionSlug: slug, sessionId });
    const body = { address: wallet.address, sessionSlug: slug, sessionId, message, signature: await wallet.signMessage(message) };
    const response = await request('/auth/login', body);
    const result = await response.json();
    assert.equal(response.status, 200, result.error);
    return { ...result, body };
  };
  const health = (token, slug) => worker.fetch(new Request('https://worker.example/health', { headers: { Origin: origin, Authorization: `Bearer ${token}`, 'X-Session-Slug': slug } }), env);
  return { env, request, authenticate, health };
};

for (const slug of ['', 'general', 'named']) test(`real auth lifecycle stores, validates and revokes ${slug || 'empty General'} tokens`, async () => {
  const f = await setup();
  const login = await f.authenticate(slug);
  assert.equal((await f.health(login.token, slug)).status, 200);
  const replay = await f.request('/auth/login', login.body);
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, 'Nonce already used.');
  const verification = await verifyToken(login.token, f.env.TOKEN_HMAC_SECRET);
  assert.equal(verification.ok, true);
  assert.equal(await revokeAuthTokenRecord({ env: f.env, ...verification.payload, slug: slug === '' ? 'general' : slug }), true);
  assert.equal((await f.health(login.token, slug)).status, 401);
});

test('General and named session tokens remain isolated', async () => {
  const f = await setup();
  const general = await f.authenticate('general');
  const named = await f.authenticate('named');
  assert.equal((await f.health(general.token, '')).status, 200);
  assert.equal((await f.health(general.token, 'named')).status, 403);
  assert.equal((await f.health(named.token, 'general')).status, 403);
});

test('a non-string session slug cannot create a token key', () => {
  for (const slug of [undefined, null, 0, {}, []]) assert.equal(buildAuthTokenKey({ slug, sub: '0xabc', jti: 'token-id' }), '');
});
