import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { fixture, sessionId, wallet } from './agentTestFixture.mjs';
import { signToken } from './tokenSigning.js';
import { persistAuthTokenRecord, revokeAuthTokenRecord } from './authTokenClaims.js';
import { createRegistryLoginBootstrapAdaptersWithWorkerDeps } from './registryLoginBootstrapBinding.js';

const jsonOk = async (response, status = 200) => {
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
};

// A passkey sign-in. The fixture's wallet is the session's admin.
async function signIn(f, address, seconds = 3600) {
  const payload = { sub: address, slug: 'fixture', sessionId, authzEpoch: 1, scopes: { storage: true },
    exp: Math.floor(Date.now() / 1000) + seconds, jti: crypto.randomUUID() };
  await persistAuthTokenRecord({ env: f.env, ...payload, ttlSeconds: seconds });
  return { payload, token: await signToken(payload, f.env.TOKEN_HMAC_SECRET) };
}
const makeKey = (f, token) => f.request('/api/agent/credentials/delegate', { method: 'POST', token, body: {} });

test("a person's key lets their agent draft, then submit answers that count as theirs", async () => {
  const f = fixture(); f.withCoordinator(); f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'public', encryption: 'none' } };
  f.config.agentHttp.managedAccountSubmitAllowed = true;
  const author = await f.credential({ scopes: ['read_questions', 'pose_questions'] });
  await jsonOk(await f.request('/api/agent/questions/create', { method: 'POST', token: author.token,
    body: { questions: [{ prompt: 'Should agents say whose they are?', questionType: 'binary' }] } }));
  const person = Wallet.createRandom().address;
  const signedIn = await signIn(f, person);
  const key = await jsonOk(await makeKey(f, signedIn.token));
  assert.match(key.token, /^ceagt_/);
  assert.deepEqual(key.scopes, ['read_questions', 'draft_answers']);
  assert.equal(key.accountAddress, person);
  assert.equal(key.submitAnswers, true);
  assert.ok(Date.parse(key.expiresAt) <= signedIn.payload.exp * 1000, 'a key ends no later than its sign-in');

  const [question] = (await jsonOk(await f.request('/api/agent/questions', { token: key.token }))).questions;
  const preferences = [{ questionId: question.questionId, value: 'Agree' }];
  const draft = await jsonOk(await f.request('/api/agent/preferences', { method: 'POST', token: key.token, body: { preferences } }));
  assert.deepEqual([draft.draftCount, draft.submittedCount], [1, 0]);
  const sent = await jsonOk(await f.request('/api/agent/preferences', { method: 'POST', token: key.token,
    body: { preferences, submit: true, humanApproved: true } }));
  assert.equal(sent.submittedCount, 1);
  const stored = [...f.records].filter(([name]) => name.startsWith('ce-storage-payload:'))
    .map(([, value]) => JSON.parse(Buffer.from(JSON.parse(value).payloadBase64url, 'base64url').toString()))
    .filter(payload => payload.questionID === question.questionId);
  assert.deepEqual(stored.map(payload => [payload.responder, payload.source, payload.answer.value]), [[person, 'session-agent', 'Agree']]);

  const asked = await f.request('/api/agent/questions/create', { method: 'POST', token: key.token,
    body: { questions: [{ prompt: 'A question the key may not add?', questionType: 'binary' }] } });
  assert.equal(asked.status, 403);
  assert.equal((await f.request('/api/agent/agent-only/statements', { token: key.token })).status, 403);
  // Nor can the key sign in to the website as the person.
  const login = await f.request('/api/agent/client-login/exchange', { method: 'POST', body: { token: key.token, sessionSlug: 'fixture' } });
  assert.equal(login.status, 403);
});

test('on chain, where the answer would not be signed as the person, a key only drafts', async () => {
  // A registry session's sign-in scopes come from the chain; this one grants storage.
  const f = fixture({ createRegistryLoginBootstrapAdaptersWithWorkerDeps: args => ({
    ...createRegistryLoginBootstrapAdaptersWithWorkerDeps(args), computeScopesForLogin: async () => ({ storage: true }) }) });
  f.config.sessionModeProfile.authority.mode = 'registry_canonical';
  f.config.agentHttp.managedAccountSubmitAllowed = true;
  const author = await f.credential({ scopes: ['read_questions', 'pose_questions'] });
  await jsonOk(await f.request('/api/agent/questions/create', { method: 'POST', token: author.token,
    body: { questions: [{ prompt: 'Should a key answer on chain?', questionType: 'binary' }] } }));
  const key = await jsonOk(await makeKey(f, (await signIn(f, Wallet.createRandom().address)).token));
  assert.equal(key.submitAnswers, false);
  // Asking to submit anyway saves a draft and submits nothing.
  const [question] = (await jsonOk(await f.request('/api/agent/questions', { token: key.token }))).questions;
  const sent = await jsonOk(await f.request('/api/agent/preferences', { method: 'POST', token: key.token,
    body: { preferences: [{ questionId: question.questionId, value: 'Agree' }], submit: true, humanApproved: true } }));
  assert.deepEqual([sent.draftCount, sent.submittedCount, sent.reviewRequired], [1, 0, true]);
});

test('a key stops when a new one is made or its sign-in ends', async () => {
  const f = fixture();
  const signedIn = await signIn(f, Wallet.createRandom().address);
  const first = await jsonOk(await makeKey(f, signedIn.token));
  const second = await jsonOk(await makeKey(f, signedIn.token));
  assert.equal((await f.request('/api/agent/actions', { token: first.token })).status, 401);
  assert.equal((await f.request('/api/agent/actions', { token: second.token })).status, 200);
  await revokeAuthTokenRecord({ env: f.env, ...signedIn.payload });
  assert.equal((await f.request('/api/agent/actions', { token: second.token })).status, 401);
});

test("a key stops when its sign-in expires or the session's sign-in epoch changes", async () => {
  let later = 0;
  const f = fixture({ now: () => Date.now() + later });
  const key = await jsonOk(await makeKey(f, (await signIn(f, Wallet.createRandom().address, 600)).token));
  await jsonOk(await f.request('/api/agent/actions', { token: key.token }));
  later = 601 * 1000;
  assert.equal((await jsonOk(await f.request('/api/agent/actions', { token: key.token }), 401)).reason, 'agent_token_expired');

  const g = fixture();
  const other = await jsonOk(await makeKey(g, (await signIn(g, Wallet.createRandom().address)).token));
  g.config.authzEpoch = 2;
  assert.equal((await jsonOk(await g.request('/api/agent/actions', { token: other.token }), 401)).reason,
    'agent_credential_authority_stale');
});

test("a session admin's key answers as them, without their admin powers", async () => {
  const f = fixture(); f.withCoordinator();
  const author = await f.credential({ scopes: ['read_questions', 'pose_questions'] });
  await jsonOk(await f.request('/api/agent/questions/create', { method: 'POST', token: author.token,
    body: { questions: [{ prompt: 'Should this question stay?', questionType: 'binary' }] } }));
  const key = await jsonOk(await makeKey(f, (await signIn(f, wallet.address)).token));
  const [question] = (await jsonOk(await f.request('/api/agent/questions', { token: key.token }))).questions;
  assert.equal((await jsonOk(await f.request('/api/agent/admin/status', { token: key.token }))).admin, false);
  for (const [path, init] of [
    ['/api/agent/admin/metrics', {}],
    ['/api/agent/admin/agent-only/config', {}],
    ['/api/agent/admin/agent-only/export?view=answers&format=jsonl', {}],
    ['/api/agent/admin/questions/delete', { method: 'POST', body: { mode: 'delete', questionIds: [question.questionId] } }],
    ['/api/agent/question-queue/plan', { method: 'POST', body: { questions: [{ prompt: 'One more?', questionType: 'binary' }] } }],
  ]) assert.equal((await f.request(path, { token: key.token, ...init })).status, 403, path);
  assert.equal((await jsonOk(await f.request('/api/agent/questions', { token: key.token }))).questions.length, 1);
});

test("an agent's own sign-in cannot make a person's key", async () => {
  const f = fixture();
  const source = await f.credential();
  const exchange = await jsonOk(await f.request('/api/agent/client-login/exchange', { method: 'POST',
    body: { token: source.token, sessionSlug: 'fixture' } }));
  const refused = await makeKey(f, exchange.workerCredential.token);
  assert.equal(refused.status, 403);
  assert.equal((await refused.json()).reason, 'agent_delegate_person_required');
});

test('no key is made while the session has Agent HTTP off', async () => {
  const f = fixture();
  const { token } = await signIn(f, Wallet.createRandom().address);
  f.config.sessionModeProfile.surfaces.agentHttp = false;
  const refused = await jsonOk(await makeKey(f, token), 403);
  assert.equal(refused.reason, 'agent_http_disabled');
  assert.equal(JSON.stringify(refused).includes('ceagt_'), false);
});
