import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import { SessionWriteCoordinator } from './worker.js';
import {
  SESSION_ID, SLUG, createSessionEnv, fetchWorker, login, makeRequest, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';
import { sha256Hex } from '../shared/deployHelperCore.mjs';

// Every request in a session reads its config from one coordinator object,
// which Cloudflare runs on a single thread and refuses calls to once they
// queue. These tests hold that object's share of the work to a budget.
const session = { sessionId: SESSION_ID, sessionSlug: SLUG };
const ROUND_TRIP_MS = 10;

const setup = async ({ questions = 28, configOverrides } = {}) => {
  const created = createSessionEnv({ configOverrides });
  const { env } = created;
  const sessionObject = `memory:${await sha256Hex(`session-config:${SLUG}`)}`;
  const calls = [];
  const get = env.CE_SESSION_COORDINATOR.get;
  // Each call to the session's object crosses the network, as on Cloudflare.
  env.CE_SESSION_COORDINATOR.get = (id) => {
    const stub = get(id);
    if (id !== sessionObject) return stub;
    return { fetch: async (input, init) => {
      calls.push(new URL(input instanceof Request ? input.url : input).pathname);
      await new Promise((resolve) => setTimeout(resolve, ROUND_TRIP_MS));
      return stub.fetch(input, init);
    } };
  };
  const adminToken = await login({ env, wallet: created.admin });
  const questionIds = Array.from({ length: questions }, (_, index) => `q-${index}`);
  for (const id of questionIds) {
    assert.equal((await uploadJson({ env, token: adminToken, resource: 'questions', data: { id, type: 'binary', prompt: `Statement ${id}`, ...session } })).status, 200);
  }
  const measure = async (work) => {
    calls.length = 0;
    await work();
    const byPath = {};
    for (const path of calls) byPath[path] = (byPath[path] || 0) + 1;
    return { total: calls.length, byPath };
  };
  return { env, questionIds, measure };
};

const answer = (questionID) => ({ questionID, answer: { value: 'Agree', encrypted: false }, ...session });

test('an answer costs the session coordinator three calls when AI Views run by hand', async () => {
  const { env, questionIds, measure } = await setup({ questions: 3 });
  const token = await login({ env, wallet: Wallet.createRandom() });
  const { total, byPath } = await measure(async () => {
    for (const questionID of questionIds) assert.equal((await uploadJson({ env, token, resource: 'responses', data: answer(questionID) })).status, 200);
  });
  assert.equal(byPath['/results-analysis/auto/enqueue'], undefined, JSON.stringify(byPath));
  assert.ok(total <= 3 * questionIds.length, JSON.stringify(byPath));
});

test('a session that runs AI Views automatically still queues a run per answer', async () => {
  const { env, questionIds, measure } = await setup({ questions: 1, configOverrides: { resultsAnalysis: { generationMode: 'automatic' } } });
  const token = await login({ env, wallet: Wallet.createRandom() });
  const { byPath } = await measure(async () => {
    assert.equal((await uploadJson({ env, token, resource: 'responses', data: answer(questionIds[0]) })).status, 200);
  });
  assert.equal(byPath['/results-analysis/auto/enqueue'], 1, JSON.stringify(byPath));
});

test('100 signed-out readers at once share a few config reads', async () => {
  const { env, measure } = await setup({ questions: 1 });
  const { total } = await measure(async () => {
    const replies = await Promise.all(Array.from({ length: 100 }, (_, index) => fetchWorker(
      makeRequest(index % 2 ? '/storage/list?resource=questions&limit=100' : `/capabilities?slug=${SLUG}`), env,
    )));
    assert.deepEqual([...new Set(replies.map((reply) => reply.status))], [200]);
  });
  assert.ok(total <= 10, `${total} coordinator calls for 100 reads`);
});

test('100 people answering at once stay within the coordinator budget, and all 500 answers are listed once', async () => {
  const { env, questionIds, measure } = await setup();
  const people = await Promise.all(Array.from({ length: 100 }, () => login({ env, wallet: Wallet.createRandom() })));
  const ANSWERS = 5;
  const { total, byPath } = await measure(async () => {
    await Promise.all(people.map(async (token, person) => {
      for (let n = 0; n < ANSWERS; n += 1) {
        const stored = await uploadJson({ env, token, resource: 'responses', data: answer(questionIds[(person + n) % questionIds.length]), requestId: `p${person}-a${n}` });
        assert.equal(stored.status, 200, JSON.stringify(stored.body));
      }
    }));
  });
  const answers = people.length * ANSWERS;
  assert.ok(total <= 2.5 * answers, `${total} coordinator calls for ${answers} answers: ${JSON.stringify(byPath)}`);
  const listed = [];
  let cursor = '';
  for (;;) {
    const page = await (await fetchWorker(makeRequest(`/storage/list?resource=responses&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`), env)).json();
    listed.push(...page.items);
    if (page.listComplete) break;
    cursor = page.cursor;
  }
  assert.equal(listed.length, answers);
});

// Storage that pages lists as Cloudflare's does and counts the keys it returns.
const pagedStorage = () => {
  const values = new Map();
  let listed = 0;
  let alarm = null;
  let tail = Promise.resolve();
  const view = {
    get: async (key) => structuredClone(values.get(key)),
    put: async (key, value) => { values.set(key, structuredClone(value)); },
    delete: async (key) => values.delete(key),
    list: async ({ prefix = '', startAfter = '', limit = Infinity } = {}) => {
      const keys = [...values.keys()].filter((key) => key.startsWith(prefix) && key > startAfter).sort().slice(0, limit);
      listed += keys.length;
      return new Map(keys.map((key) => [key, structuredClone(values.get(key))]));
    },
  };
  return {
    ...view,
    values,
    listed: () => listed,
    alarmAt: () => alarm,
    setAlarm: async (at) => { alarm = at; },
    getAlarm: async () => alarm,
    transaction: (callback) => { const run = tail.then(() => callback(view)); tail = run.catch(() => {}); return run; },
  };
};

test('each alarm checks a bounded page of AI Views upload receipts and still removes expired ones', async () => {
  let now = 1_000;
  const storage = pagedStorage();
  const coordinator = new SessionWriteCoordinator({ storage }, {}, { now: () => now, runResultsAnalysisAutoJob: async () => ({ ok: true }) });
  for (let index = 0; index < 1_200; index += 1) {
    await coordinator.enqueueResultsAnalysisAutoJob({ slug: SLUG, requestId: `auto-upload:answer-${index}` });
  }
  const receipts = () => [...storage.values.keys()].filter((key) => key.startsWith('results-analysis-upload-v1:')).length;
  assert.equal(receipts(), 1_200);
  now += 7 * 24 * 60 * 60 * 1000 + 1;
  // A fresh upload receipt wants its own cleanup days away; it must not push back the next page.
  storage.values.set('upload-receipt-v1:fresh', { state: 'settled', settledAt: now });
  for (let alarm = 0; alarm < 3; alarm += 1) {
    const before = storage.listed();
    await coordinator.alarm();
    assert.ok(storage.listed() - before <= 600, `one alarm listed ${storage.listed() - before} keys`);
    if (alarm < 2) assert.ok(storage.alarmAt() <= now + 1_000, `next page waits ${storage.alarmAt() - now} ms`);
  }
  assert.equal(receipts(), 0);
});
