import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, wallet, sessionId } from './agentTestFixture.mjs';
import { signToken } from './tokenSigning.js';
import { persistAuthTokenRecord } from './authTokenClaims.js';

async function signIn(f, address) {
  const claims = { sub: address, slug: 'fixture', sessionId, authzEpoch: 1, scopes: { storage: true },
    exp: Math.floor(Date.now() / 1000) + 3600, jti: crypto.randomUUID() };
  await persistAuthTokenRecord({ env: f.env, ...claims, ttlSeconds: 3600 });
  return signToken(claims, f.env.TOKEN_HMAC_SECRET);
}

test("a person's agent stores at most five answers per question, as the web page does", async () => {
  const f = fixture();
  f.withCoordinator();
  f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'public', encryption: 'none' } };
  f.config.agentHttp.managedAccountSubmitAllowed = true;
  const ok = async (path, options) => {
    const response = await f.request(path, options);
    assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`);
    return response.json();
  };
  const data = { id: `0x${'1'.padStart(64, '0')}`, type: 'binary', prompt: 'Salon statement', sessionSlug: 'fixture' };
  await ok('/storage/upload', { method: 'POST', token: await signIn(f, wallet.address),
    headers: { origin: 'https://client.example', 'x-session-slug': 'fixture', 'content-type': 'application/json' },
    body: { data, contentType: 'application/json', resource: 'questions' } });

  const key = await ok('/api/agent/credentials/delegate', { method: 'POST', token: await signIn(f, `0x${'5'.repeat(40)}`), body: {} });
  const [question] = (await ok('/api/agent/questions', { token: key.token })).questions;
  const submit = (value) => f.request('/api/agent/preferences', { method: 'POST', token: key.token, body: {
    preferences: [{ questionId: question.questionId, value }], submit: true, humanApproved: true } });
  for (let row = 0; row < 5; row += 1) {
    const stored = await submit(row % 2 ? 'Agree' : 'Disagree');
    assert.equal(stored.status, 200, await stored.clone().text());
  }
  // The sixth is refused by the row limit; the version limit is 20.
  const refused = await (await submit('Agree')).json();
  assert.equal(refused.submittedCount, 0, JSON.stringify(refused));
  assert.deepEqual(refused.skipped.map((item) => item.reason), ['hosted_submit_failed']);
});
