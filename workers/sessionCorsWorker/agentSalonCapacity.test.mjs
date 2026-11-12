import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fixture, wallet, sessionId } from './agentTestFixture.mjs';
import { signToken } from './tokenSigning.js';
import { persistAuthTokenRecord } from './authTokenClaims.js';

// Cloudflare ends a Worker or Durable Object invocation after 1,000 KV
// operations, and counts a bulk read of up to 100 keys as one. Local runtimes
// do not enforce it, so this KV counts each invocation's operations itself.
const KV_OPERATION_LIMIT = 1000;
const PEOPLE = 80;
const QUESTIONS = 30;
const CHANGED = 16;
const VOTES = ['Agree', 'Disagree', 'Unsure'];

function limitKvOperations(f) {
  const invocation = new AsyncLocalStorage();
  const counts = [];
  const spend = () => {
    const count = invocation.getStore();
    if (count && ++count.ops > KV_OPERATION_LIMIT) throw new Error('Too many API requests by single worker invocation.');
  };
  const kv = f.env.GROUP_KV;
  const { get, put, delete: remove } = kv;
  kv.get = async (key, options) => {
    spend();
    if (Array.isArray(key) && key.length > 100) throw new Error('A bulk KV read takes at most 100 keys.');
    return get(key, options);
  };
  kv.put = async (...args) => { spend(); return put(...args); };
  kv.delete = async (key) => { spend(); return remove(key); };
  // Like Cloudflare, list pages of at most 1,000 keys in key order.
  kv.list = async ({ prefix = '', limit = 1000, cursor } = {}) => {
    spend();
    const names = [...f.records.keys()].filter(name => name.startsWith(prefix)).sort();
    const start = Number(cursor || 0);
    const end = Math.min(start + Math.min(limit, 1000), names.length);
    return { keys: names.slice(start, end).map(name => ({ name, metadata: f.metadata.get(name) })),
      list_complete: end === names.length, ...(end < names.length ? { cursor: String(end) } : {}) };
  };
  const run = async (operation) => {
    const count = { ops: 0 };
    try { return await invocation.run(count, operation); } finally { counts.push(count.ops); }
  };
  const coordinator = f.env.CE_SESSION_COORDINATOR;
  f.env.CE_SESSION_COORDINATOR = { ...coordinator, get: (...args) => {
    const stub = coordinator.get(...args);
    return { fetch: (...request) => run(() => stub.fetch(...request)) };
  } };
  return { counts, request: (path, options) => run(() => f.request(path, options)) };
}

// A passkey sign-in. The fixture's wallet is the session's host.
async function signIn(f, address) {
  const claims = { sub: address, slug: 'fixture', sessionId, authzEpoch: 1, scopes: { storage: true },
    exp: Math.floor(Date.now() / 1000) + 3600, jti: crypto.randomUUID() };
  await persistAuthTokenRecord({ env: f.env, ...claims, ttlSeconds: 3600 });
  return signToken(claims, f.env.TOKEN_HMAC_SECRET);
}

// A hosted session with the host's website questions, uploaded as the browser does.
async function hostedSession(questionCount) {
  const f = fixture();
  f.withCoordinator();
  f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'public', encryption: 'none' } };
  f.config.agentHttp.managedAccountSubmitAllowed = true;
  const limited = limitKvOperations(f);
  const ok = async (path, options) => {
    const response = await limited.request(path, options);
    assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`);
    return response.json();
  };
  const hostToken = await signIn(f, wallet.address);
  for (let index = 1; index <= questionCount; index += 1) {
    const data = { id: `0x${index.toString(16).padStart(64, '0')}`, type: 'binary', prompt: `Salon statement ${index}`, sessionSlug: 'fixture' };
    await ok('/storage/upload', { method: 'POST', token: hostToken,
      headers: { origin: 'https://client.example', 'x-session-slug': 'fixture', 'content-type': 'application/json' },
      body: { data, contentType: 'application/json', resource: 'questions' } });
  }
  f.config.resultsExposure = { aggregateResultsEnabled: true, anonymizedGroupsEnabled: true };
  return { f, limited, ok };
}

test('a salon of 80 agents answering 30 questions stays within each invocation\'s KV limit', async () => {
  const { f, limited, ok } = await hostedSession(QUESTIONS);
  const agents = [];
  for (let person = 0; person < PEOPLE; person += 1) {
    agents.push(await f.credential({ scopes: ['read_questions', 'draft_answers'], principal: `salon-agent-${person}` }));
  }
  const { questions, hasMore } = await ok('/api/agent/questions', { token: agents[0].token });
  assert.equal(questions.length, QUESTIONS);
  assert.equal(hasMore, false);
  const submitAll = async (agent, shift) => {
    const body = await ok('/api/agent/preferences', { method: 'POST', token: agent.token, body: {
      preferences: questions.map((question, index) => ({ questionId: question.questionId, value: VOTES[(shift + index) % 3] })),
      submit: true, humanApproved: true } });
    assert.equal(body.submittedCount, QUESTIONS);
  };
  for (const [person, agent] of agents.entries()) await submitAll(agent, person);
  for (const [person, agent] of agents.slice(0, CHANGED).entries()) await submitAll(agent, person + 1);

  const reader = agents[0].token;
  await ok('/api/agent/questions/next', { token: reader });
  await ok('/api/agent/tags', { token: reader });
  for (const view of ['consensus', 'difference']) {
    const result = await ok(`/api/agent/results?view=${view}`, { token: reader });
    assert.equal(result.responseCount, PEOPLE * QUESTIONS);
  }
  // Everyone answered the first listed question with their own vote; 16 changed it.
  const consensus = await ok('/api/agent/results?view=consensus', { token: reader });
  const first = consensus.questions.find(row => row.questionId === questions[0].questionId);
  assert.equal(first.participants, PEOPLE);
  assert.deepEqual(first.counts, [{ label: 'Agree', count: 26 }, { label: 'Disagree', count: 28 }, { label: 'Unsure', count: 26 }]);
  for (const view of ['topic-map', 'groups', 'polis']) await ok(`/api/agent/results?view=${view}`, { token: reader });
  const image = await limited.request('/api/agent/results-image?view=consensus', { token: reader });
  assert.equal(image.status, 200);
  await ok('/api/agent/preferences', { method: 'POST', token: agents[1].token,
    body: { preferences: [{ questionId: questions[0].questionId, value: 'Agree' }] } });

  assert.ok(Math.max(...limited.counts) <= KV_OPERATION_LIMIT);
});

// A person's own key checks the sign-in it came from once per request, so it
// costs what an agent's own key does.
test("a person's agent submits 50 answers in one request within the KV limit", async () => {
  const { f, limited, ok } = await hostedSession(50);
  const key = await ok('/api/agent/credentials/delegate', { method: 'POST', token: await signIn(f, `0x${'5'.repeat(40)}`), body: {} });
  const { questions } = await ok('/api/agent/questions', { token: key.token });
  const body = await ok('/api/agent/preferences', { method: 'POST', token: key.token, body: {
    preferences: questions.map(question => ({ questionId: question.questionId, value: 'Agree' })), submit: true, humanApproved: true } });
  assert.equal(body.submittedCount, 50);
  assert.ok(Math.max(...limited.counts) <= KV_OPERATION_LIMIT);
});
