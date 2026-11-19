import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { SESSION_ID, SLUG, createSessionEnv, login, uploadJson } from './sessionWorkerRuntimeFixture.mjs';
import { QUESTION_SET_TTL_MS } from './responseAnswerValidation.js';
import { persistAgentProposedQuestion } from './agent/agentQuestionProposals.mjs';
import { createAgentStorage } from './agent/storage.mjs';

// Each answer is checked against the session's questions. An isolate keeps
// the set it read for a few seconds, so one person's Submit reads it once.
const session = { sessionId: SESSION_ID, sessionSlug: SLUG };
const QUESTION_PREFIX = `ce-storage:${SLUG}:questions:`;

const setup = async () => {
  const { admin, env } = createSessionEnv();
  const kv = env.CE_STORAGE_INDEX_KV;
  const lists = { questions: 0 };
  const list = kv.list.bind(kv);
  kv.list = (options = {}) => {
    if (String(options.prefix || '').startsWith(QUESTION_PREFIX)) lists.questions += 1;
    return list(options);
  };
  const adminToken = await login({ env, wallet: admin });
  const person = await login({ env, wallet: Wallet.createRandom() });
  const ask = (data, onEnv = env, token = adminToken) => uploadJson({ env: onEnv, token, resource: 'questions', data: { ...data, ...session } });
  const answer = (questionID, value, onEnv = env) => uploadJson({
    env: onEnv, token: person, resource: 'responses', data: { questionID, answer: { value, encrypted: false }, ...session },
  });
  // Another isolate: the same storage behind a binding this one never cached.
  const elsewhere = { ...env, CE_STORAGE_INDEX_KV: Object.create(kv) };
  return { env, kv, lists, ask, answer, elsewhere, adminToken };
};

const withClock = (t) => {
  const realNow = Date.now;
  let offset = 0;
  Date.now = () => realNow() + offset;
  t.after(() => { Date.now = realNow; });
  return (ms) => { offset += ms; };
};

test('one person’s answers read the session’s questions once', async () => {
  const { lists, ask, answer } = await setup();
  for (let q = 0; q < 10; q += 1) assert.equal((await ask({ id: `q-${q}`, type: 'binary', prompt: `Statement ${q}` })).status, 200);
  lists.questions = 0;
  for (let q = 0; q < 10; q += 1) assert.equal((await answer(`q-${q}`, 'Agree')).status, 200);
  assert.equal(lists.questions, 1);
});

test('a question another isolate added is read again, not refused', async () => {
  const { lists, ask, answer, elsewhere } = await setup();
  await ask({ id: 'q-0', type: 'binary', prompt: 'First' });
  assert.equal((await answer('q-0', 'Agree')).status, 200);
  assert.equal((await ask({ id: 'q-new', type: 'binary', prompt: 'Added elsewhere' }, elsewhere)).status, 200);
  lists.questions = 0;
  assert.equal((await answer('q-new', 'Agree')).status, 200);
  assert.equal(lists.questions, 1);
  const unknown = await answer('q-missing', 'Agree');
  assert.equal(unknown.status, 422);
  assert.equal(unknown.body.reason, 'response_question_unknown');
});

test('a question changed through this isolate is checked as changed at once', async () => {
  const { ask, answer } = await setup();
  await ask({ id: 'q-0', type: 'freeform', prompt: 'Say anything' });
  assert.equal((await answer('q-0', 'hello')).status, 200);
  assert.equal((await ask({ id: 'q-0', type: 'binary', prompt: 'Agree or not' })).status, 200);
  const refused = await answer('q-0', 'hello again');
  assert.equal(refused.status, 422);
  assert.equal(refused.body.reason, 'response_answer_invalid');
});

test('a question another isolate changed is checked as changed within a few seconds', async (t) => {
  const advance = withClock(t);
  const { ask, answer, elsewhere } = await setup();
  await ask({ id: 'q-0', type: 'freeform', prompt: 'Say anything' });
  assert.equal((await answer('q-0', 'hello')).status, 200);
  assert.equal((await ask({ id: 'q-0', type: 'binary', prompt: 'Agree or not' }, elsewhere)).status, 200);
  // Checked as the page that sent it showed the question.
  assert.equal((await answer('q-0', 'still freeform')).status, 200);
  advance(QUESTION_SET_TTL_MS);
  const refused = await answer('q-0', 'too late');
  assert.equal(refused.status, 422);
  assert.equal(refused.body.reason, 'response_answer_invalid');
});

test('a failed read of the questions is not kept', async () => {
  const { kv, lists, ask, answer } = await setup();
  await ask({ id: 'q-0', type: 'binary', prompt: 'First' });
  const list = kv.list;
  let failures = 1;
  kv.list = (options = {}) => {
    if (String(options.prefix || '').startsWith(QUESTION_PREFIX) && failures > 0) {
      failures -= 1;
      return Promise.reject(new Error('KV list unavailable'));
    }
    return list(options);
  };
  assert.equal((await answer('q-0', 'Agree')).status, 500);
  lists.questions = 0;
  assert.equal((await answer('q-0', 'Agree')).status, 200);
  assert.equal(lists.questions, 1);
});

test('an unknown question on a cold read is listed once, not twice', async () => {
  const { lists, ask, answer } = await setup();
  await ask({ id: 'q-0', type: 'binary', prompt: 'First' });
  lists.questions = 0;
  assert.equal((await answer('q-missing', 'Agree')).body.reason, 'response_question_unknown');
  assert.equal(lists.questions, 1);
});

test('agents’ proposed questions and legacy rows are found through a kept set', async () => {
  const { env, kv, lists, ask, answer } = await setup();
  await ask({ id: 'q-0', type: 'binary', prompt: 'First' });
  await ask({ id: 'q-legacy', type: 'binary', prompt: 'Stored before ids were recorded' });
  // A row from before uploads recorded their question's id names it only in its payload.
  const legacyKey = [...kv.values.keys()].find((key) => key.startsWith(QUESTION_PREFIX) && kv.values.get(key).includes('q-legacy'));
  const { resourceId: _id, ...legacy } = JSON.parse(kv.values.get(legacyKey));
  kv.values.set(legacyKey, JSON.stringify(legacy));
  const agentKv = { AGENT_ACTION_KV: createAgentStorage({ kv: env.GROUP_KV, sessionId: SESSION_ID }) };
  const proposed = await persistAgentProposedQuestion({ env: agentKv, sessionSlug: SLUG, prompt: 'Agents should vote?', questionType: 'binary' });
  assert.equal(proposed.ok, true);
  assert.equal((await answer('q-0', 'Agree')).status, 200);
  lists.questions = 0;
  for (let round = 0; round < 2; round += 1) {
    assert.equal((await answer(proposed.questionId, 'Agree')).status, 200);
    assert.equal((await answer('q-legacy', 'Disagree')).status, 200);
    assert.equal((await answer('q-legacy', 'not an option')).body.reason, 'response_answer_invalid');
  }
  assert.equal(lists.questions, 0);
});
