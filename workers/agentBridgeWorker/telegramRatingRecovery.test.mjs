import test from 'node:test';
import assert from 'node:assert/strict';
import { __test__sessionQuestions } from './sessionQuestions.mjs';
import { buildTelegramCommandResponse } from './telegramCommands.mjs';
import { processTelegramSubmitQueueBatch } from './telegramSubmitQueue.mjs';

class MemoryKv {
  constructor() { this.store = new Map(); this.metadata = new Map(); }
  async put(k, v, o) { this.store.set(k, v); if (o?.metadata) this.metadata.set(k, o.metadata); }
  async get(k) { return this.store.get(k) || null; }
  async delete(k) { this.store.delete(k); }
  async list({ prefix = '' } = {}) {
    return { keys: [...this.store.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name, metadata: this.metadata.get(name) })), list_complete: true };
  }
}
const QID = `0x${'ab'.repeat(32)}`;
const CACHE_KEY = `${__test__sessionQuestions.QUESTION_CACHE_PREFIX}alpha`;
const cachedQuestion = (raw) => __test__sessionQuestions.normalizeQuestionPayload(
  { sessionSlug: 'alpha', prompt: 'How likely is it?', ...raw },
  { questionId: raw.id, pointerId: 'x'.repeat(43), sessionSlug: 'alpha' },
);
async function seedIndex(kv, questions, { ageMs = 0 } = {}) {
  await kv.put(CACHE_KEY, JSON.stringify({
    ok: true, complete: true, cachedAtMs: Date.now() - ageMs, sessionSlug: 'alpha',
    questions, questionCount: questions.length, indexedFromBlock: 1, indexedToBlock: 100,
  }));
}
function makeEnv({ kv, overrides = {} } = {}) {
  const uploads = [];
  const env = {
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot', TELEGRAM_BOT_TOKEN: '123456:test-token',
    DEFAULT_CHAIN_ID: '11155420', DEFAULT_RPC_URL: 'https://rpc.example.test', DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token',
    AGENT_BRIDGE_SURVEYS_ADDRESS: '0x1111111111111111111111111111111111111111',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({ defaultSessionSlug: 'alpha', riskCeiling: 'submit', sessions: [{
      sessionSlug: 'alpha', sessionName: 'Alpha', default: true, telegramBridgeEnabled: true, telegramGroupOpenAccess: true,
      managedAccountSubmitAllowed: true, sessionWorkerUrl: 'https://worker.example.test', chainId: 11155420,
      surveysAddress: '0x1111111111111111111111111111111111111111' }] }),
    AGENT_ACTION_KV: kv,
    // Live question refresh (registry RPC / payload reads) is unavailable unless a test overrides it.
    QUESTION_FETCH: async () => { throw new Error('question rpc unavailable'); },
    AGENT_BRIDGE_FETCH: async (url, init) => {
      let data;
      if (url.endsWith('/auth/nonce')) data = { nonce: 'sample-nonce' };
      else if (url.endsWith('/auth/login')) data = { token: 'sample-token', exp: 2000000000 };
      else if (url.endsWith('/storage/upload')) { uploads.push(JSON.parse(init.body).data); data = { id: Buffer.alloc(32, 7).toString('base64url') }; }
      else throw new Error(`Unexpected network call ${url}`);
      return new Response(JSON.stringify(data), { status: 200 });
    },
    AGENT_BRIDGE_CONTRACT_FACTORY: () => ({ submitResponses: async () => ({ hash: '0xsample', wait: async () => ({ status: 1, blockNumber: 1 }) }) }),
    ...overrides,
  };
  return { env, uploads };
}
const groupMessage = (text) => ({ update_id: 7001, message: { message_id: 11, text, chat: { id: -100123, type: 'supergroup', title: 'Alpha' }, from: { id: 42, username: 'host' } } });
const tapUpdate = (data, n) => ({ update_id: 7100 + n, callback_query: { id: `cb-${n}`, data, from: { id: 42, username: 'host' }, message: { message_id: 61, chat: { id: -100123, type: 'supergroup' } } } });
async function renderButtons(env, waitUntil = null) {
  const posed = await buildTelegramCommandResponse({ update: groupMessage('/q 1'), env, now: '2026-10-02T10:00:00.000Z', waitUntil });
  return (posed.response?.replyMarkup?.inline_keyboard || []).flat();
}
const submitRecords = (kv) => [...kv.store.entries()].filter(([k]) => k.startsWith('telegram:submit-request:') && !k.includes('-by-')).map(([, v]) => JSON.parse(v));

const setupQuestion = async () => {
  __test__sessionQuestions.clearCaches();
  const kv = new MemoryKv();
  const question = cachedQuestion({ id: QID, type: 'rating', scale: { min: 0, max: 100, step: 1 } });
  await seedIndex(kv, [question]);
  const sent = [];
  const { env, uploads } = makeEnv({ kv, overrides: {
    AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED: 'true',
    AGENT_RESPONSE_QUEUE: { send: async (message) => { sent.push(message); } },
  } });
  const button = (await renderButtons(env)).find((b) => b.text === '50');
  assert.ok(button);
  const tap = (n = 1) => buildTelegramCommandResponse({ update: tapUpdate(button.callback_data, n), env });
  const removeCache = async () => { await kv.delete(CACHE_KEY); __test__sessionQuestions.clearCaches(); };
  const restoreCache = async () => { await seedIndex(kv, [question]); __test__sessionQuestions.clearCaches(); };
  return { kv, question, sent, env, uploads, button, tap, removeCache, restoreCache };
};
const processMessage = async (env, body) => {
  const actions = [];
  const result = await processTelegramSubmitQueueBatch({ messages: [{ body, ack: () => actions.push('ack'), retry: () => actions.push('retry') }] }, env);
  return { result, actions };
};

test('a rating button carries its server scale through a cache miss and queue upload', async () => {
  const h = await setupQuestion();
  await h.removeCache();
  const tapped = await h.tap();
  assert.equal(tapped.ok, true, tapped.reason);
  assert.deepEqual(h.sent[0].record.ratingScale, { min: 0, max: 100, step: 1 });
  const processed = await processMessage(h.env, h.sent[0]);
  assert.deepEqual(processed.actions, ['ack']);
  assert.equal(processed.result.ok, true);
  assert.deepEqual(h.uploads.map((upload) => upload.answer.value), [50]);
});

test('an older button fails retryably before creating a submit request if its scale is unavailable', async () => {
  const h = await setupQuestion();
  // Pre-deploy callbacks had only the question ID and selected value.
  for (const [key, raw] of h.kv.store) {
    const action = JSON.parse(raw);
    if (action.serverContextRef?.controlType !== 'rating_button') continue;
    delete action.serverContextRef.ratingScale;
    await h.kv.put(key, JSON.stringify(action));
  }
  await h.removeCache();
  const tapped = await h.tap();
  assert.equal(tapped.ok, false);
  assert.equal(tapped.reason, 'rating_scale_unavailable');
  assert.match(tapped.callbackAnswerText, /Try again/);
  assert.equal(submitRecords(h.kv).length, 0);
  assert.equal(h.sent.length, 0);
  await h.restoreCache();
  assert.equal((await h.tap(2)).ok, true);
  const processed = await processMessage(h.env, h.sent[0]);
  assert.equal(processed.result.ok, true);
  assert.deepEqual(h.uploads.map((upload) => upload.answer.value), [50]);
});

for (const cacheMiss of [false, true]) {
  test('an older queued rating resolves its question scale; cache miss: ' + cacheMiss, async () => {
    const h = await setupQuestion();
    assert.equal((await h.tap()).ok, true);
    for (const [key, raw] of h.kv.store) {
      if (!key.startsWith('telegram:submit-request')) continue;
      const record = JSON.parse(raw);
      delete record.ratingScale;
      await h.kv.put(key, JSON.stringify(record));
    }
    delete h.sent[0].record.ratingScale;
    if (cacheMiss) {
      await h.removeCache();
      const pending = await processMessage(h.env, h.sent[0]);
      assert.deepEqual(pending.actions, ['retry']);
      assert.equal(h.uploads.length, 0);
      assert.equal(submitRecords(h.kv)[0].status, 'submit_queued');
      await h.restoreCache();
    }
    const processed = await processMessage(h.env, h.sent[0]);
    assert.deepEqual(processed.actions, ['ack']);
    assert.equal(processed.result.ok, true);
    assert.deepEqual(h.uploads.map((upload) => upload.answer.value), [50]);
  });
}
