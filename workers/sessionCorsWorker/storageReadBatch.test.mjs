import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import {
  SESSION_ID, SLUG, createSessionEnv, fetchWorker, login, makeRequest, readJson, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';

const session = { sessionId: SESSION_ID, sessionSlug: SLUG };

// A session with questions and each person's answer to every one.
const seed = async ({ people, questions, configOverrides } = {}) => {
  let coordinatorCalls = 0;
  const { admin, env } = createSessionEnv({ configOverrides, onCoordinatorFetch: () => { coordinatorCalls += 1; } });
  const adminToken = await login({ env, wallet: admin });
  const questionIds = Array.from({ length: questions }, (_, index) => `q-${index}`);
  for (const id of questionIds) {
    assert.equal((await uploadJson({ env, token: adminToken, resource: 'questions', data: { id, type: 'binary', prompt: `Statement ${id}`, ...session } })).status, 200);
  }
  const participants = [];
  for (let person = 0; person < people; person += 1) {
    const wallet = Wallet.createRandom();
    const token = await login({ env, wallet });
    participants.push({ wallet, token });
    await Promise.all(questionIds.map(async (questionID) => {
      const stored = await uploadJson({ env, token, resource: 'responses', data: { questionID, answer: { value: 'Agree', encrypted: false }, ...session } });
      assert.equal(stored.status, 200, JSON.stringify(stored.body));
    }));
  }
  return { env, participants, coordinatorCalls: () => coordinatorCalls };
};

const signedOut = (env) => {
  let requests = 0;
  const call = async (path, options) => {
    requests += 1;
    return readJson(await fetchWorker(makeRequest(path, options), env));
  };
  return { call, requests: () => requests };
};

const listAll = async (call, token) => {
  const ids = [];
  let cursor = '';
  for (;;) {
    const page = await call(`/storage/list?resource=responses&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { token });
    assert.equal(page.status, 200, JSON.stringify(page.body));
    ids.push(page.body.items.map((item) => item.storageRef.id));
    if (page.body.listComplete) return ids;
    cursor = page.body.cursor;
  }
};

// Each request still reads the session's config from its coordinator, or a
// copy at most a second old, so a session made private stops serving answers
// within a second.
test('a signed-out Results view of 500 answers takes at most 2 Worker requests per 100', async () => {
  const { env, coordinatorCalls } = await seed({ people: 25, questions: 20 });
  const before = coordinatorCalls();
  const { call, requests } = signedOut(env);
  const answers = [];
  for (const ids of await listAll(call)) {
    const batch = await call('/storage/read-batch', { method: 'POST', body: { ids } });
    assert.equal(batch.status, 200, JSON.stringify(batch.body));
    assert.deepEqual(batch.body.items.map((item) => item.id), ids);
    for (const item of batch.body.items) {
      assert.equal(item.status, 200, JSON.stringify(item));
      answers.push(JSON.parse(item.text));
    }
  }
  assert.equal(answers.length, 500);
  assert.ok(answers.every((answer) => answer.answer.value === 'Agree'));
  assert.ok(requests() <= 2 * Math.ceil(500 / 100), `${requests()} Worker requests`);
  assert.ok(coordinatorCalls() - before <= requests(), `${coordinatorCalls() - before} coordinator calls`);
});

test('a batch shows exactly what single reads show, item by item', async () => {
  // Participants see their own answers only; visitors see none.
  const { env, participants } = await seed({
    people: 2,
    questions: 2,
    configOverrides: { sessionModeProfile: { ...createSessionEnv().config.sessionModeProfile, results: { visibility: 'participant_aggregate' } } },
  });
  const [first] = participants;
  const { call } = signedOut(env);
  const asAdminIds = (await listAll(call, await login({ env, wallet: Wallet.createRandom() }))).flat();
  assert.equal(asAdminIds.length, 0, 'a stranger lists none');
  const ownIds = (await listAll(call, first.token)).flat();
  assert.equal(ownIds.length, 2);

  const visitor = await call('/storage/read-batch', { method: 'POST', body: { ids: ownIds } });
  assert.equal(visitor.status, 200);
  for (const item of visitor.body.items) {
    const single = await call(`/storage/read?id=${item.id}`);
    assert.equal(item.status, single.status);
    assert.equal(item.status, 403);
    // The reason tells a signed-out reader that signing in may lift the refusal.
    assert.equal(item.reason, single.body.reason);
    assert.equal(item.reason, 'private_response_owner_required');
  }

  const owner = await call('/storage/read-batch', { method: 'POST', token: first.token, body: { ids: ownIds } });
  assert.deepEqual(owner.body.items.map((item) => item.status), [200, 200]);
  const other = await call('/storage/read-batch', { method: 'POST', token: participants[1].token, body: { ids: ownIds } });
  assert.deepEqual(other.body.items.map((item) => item.status), [403, 403]);
});

test('on a members-only session a batch refuses visitors with the reason, and serves members', async () => {
  const { env, participants } = await seed({
    people: 2,
    questions: 2,
    configOverrides: { sessionModeProfile: { ...createSessionEnv().config.sessionModeProfile, results: { visibility: 'session_member_full' } } },
  });
  const { call } = signedOut(env);
  const ids = (await listAll(call, participants[0].token)).flat();
  assert.equal(ids.length, 4, 'a member lists everyone\'s answers');
  const visitor = await call('/storage/read-batch', { method: 'POST', body: { ids } });
  assert.deepEqual(visitor.body.items.map((item) => [item.status, item.reason]), ids.map(() => [403, 'private_response_owner_required']));
  const member = await call('/storage/read-batch', { method: 'POST', token: participants[1].token, body: { ids } });
  assert.deepEqual(member.body.items.map((item) => item.status), [200, 200, 200, 200]);
});

test('a batch stops reading once it holds 8 MiB and leaves the rest to single reads', async () => {
  const { admin, env } = createSessionEnv();
  const adminToken = await login({ env, wallet: admin });
  const questionIds = Array.from({ length: 40 }, (_, index) => `q-long-${index}`);
  for (const id of questionIds) {
    assert.equal((await uploadJson({ env, token: adminToken, resource: 'questions', data: { id, type: 'freeform', prompt: `Why ${id}?`, ...session } })).status, 200);
  }
  // Seven survey bundles of about 1.7 MiB each: the first five read together pass 8 MiB.
  const token = await login({ env, wallet: Wallet.createRandom() });
  const ids = [];
  for (let bundle = 0; bundle < 7; bundle += 1) {
    const responses = questionIds.map((questionID) => ({ questionID, answer: { value: `${bundle}`.repeat(42_000), encrypted: false }, ...session }));
    const stored = await uploadJson({ env, token, resource: 'responses', data: { surveyID: 's-long', ...session, responses } });
    assert.equal(stored.status, 200, JSON.stringify(stored.body).slice(0, 200));
    ids.push(stored.body.storageRef.id);
  }
  const { call } = signedOut(env);
  const batch = await call('/storage/read-batch', { method: 'POST', body: { ids } });
  assert.deepEqual(batch.body.items.map((item) => item.status), [200, 200, 200, 200, 200, 413, 413]);
  // What the batch left out is still there to read on its own.
  assert.equal((await call(`/storage/read?id=${ids[6]}`)).status, 200);
});

test('an answer whose own rule the chain cannot answer hides only itself from a list', async () => {
  const { env, participants } = await seed({ people: 2, questions: 1 });
  const [author, reader] = participants;
  // No RPC is set up for this chain, so the rule can be neither passed nor failed.
  const accessConditions = { match: 'any', conditions: [{ kind: 'sbt_onchain', contract: `0x${'c'.repeat(40)}`, chainId: 31337 }] };
  const gated = await readJson(await fetchWorker(makeRequest('/storage/upload', { method: 'POST', token: author.token, body: {
    data: { questionID: 'q-0', answer: { value: 'Disagree', encrypted: false }, ...session }, contentType: 'application/json', resource: 'responses', accessConditions,
  } }), env));
  assert.equal(gated.status, 200, JSON.stringify(gated.body));
  const { call } = signedOut(env);
  const single = await call(`/storage/read?id=${gated.body.storageRef.id}`, { token: reader.token });
  assert.equal(single.status, 503, 'the row itself is an outage to retry');
  const listed = await call('/storage/list?resource=responses&limit=100', { token: reader.token });
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  const ids = listed.body.items.map((item) => item.storageRef.id);
  assert.equal(ids.length, 2, 'everyone else still lists the other answers');
  assert.equal(ids.includes(gated.body.storageRef.id), false);
});

test('a batch takes 1 to 100 distinct valid ids, and reports a missing one on its own', async () => {
  const { env } = await seed({ people: 1, questions: 1 });
  const { call } = signedOut(env);
  const [ids] = await listAll(call);
  const missing = 'cf_missing_answer_id';
  for (const body of [{ ids: [] }, { ids: [...ids, ...ids] }, { ids: ['../escape'] }, { ids: Array.from({ length: 101 }, (_, index) => `cf_${index}`) }, {}]) {
    const refused = await call('/storage/read-batch', { method: 'POST', body });
    assert.equal(refused.status, 400, JSON.stringify(body).slice(0, 80));
  }
  const mixed = await call('/storage/read-batch', { method: 'POST', body: { ids: [...ids, missing] } });
  assert.deepEqual(mixed.body.items.map((item) => item.status), [200, 404]);
  const capabilities = await call('/capabilities');
  assert.ok(capabilities.body.features.includes('storage_read_batch_v1'));
});
