import test from 'node:test';
import assert from 'node:assert/strict';
import { __test__sessionQuestions } from './sessionQuestions.mjs';
import { buildTelegramCommandResponse } from './telegramCommands.mjs';
import { processTelegramSubmitQueueBatch } from './telegramSubmitQueue.mjs';
import { handleTelegramAgentHandoffRequest } from './telegramAgentHandoff.mjs';

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

for (const queued of [false, true]) {
  test('human-approved typed answers preserve values and comments; queued: ' + queued, async () => {
    __test__sessionQuestions.clearCaches();
    const kv = new MemoryKv();
    const binaryId = '0x' + 'cd'.repeat(32);
    const choiceId = '0x' + 'ef'.repeat(32);
    const textId = '0x' + '98'.repeat(32);
    await seedIndex(kv, [
      cachedQuestion({ id: QID, type: 'rating', scale: { min: 0, max: 100, step: 1 } }),
      cachedQuestion({ id: binaryId, type: 'binary' }),
      cachedQuestion({ id: choiceId, type: 'multichoice', options: ['Option A', 'Option B'] }),
      cachedQuestion({ id: textId, type: 'freeform' }),
    ]);
    const sent = [];
    const { env, uploads } = makeEnv({ kv, overrides: queued ? {
      AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED: 'true', AGENT_RESPONSE_QUEUE: { send: async (m) => { sent.push(m); } },
    } : {} });
    await buildTelegramCommandResponse({ update: groupMessage('/join alpha'), env });
    const response = await handleTelegramAgentHandoffRequest({
      request: new Request('https://bridge.example/telegram/agent/api/preferences', {
        method: 'POST', headers: { authorization: 'Bearer agent-test-token', 'content-type': 'application/json' },
        body: JSON.stringify({ telegramUserId: '42', groupChatId: '-100123', sessionSlug: 'alpha', submit: true, humanApproved: true,
          preferences: { answersByQuestionId: {
            [QID]: { value: 50, comments: 'Rating explanation' },
            [binaryId]: { value: 'agree', comments: 'Binary explanation' },
            [choiceId]: { values: ['Option A', 'Option B'], comments: 'Choice explanation' },
            [textId]: { text: 'An answer with context', comments: 'Text explanation' },
          } } }),
      }), env,
    });
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
    if (queued) {
      assert.equal(sent.length, 4);
      const result = await processTelegramSubmitQueueBatch({ messages: sent.map((body) => ({ body })) }, env);
      assert.equal(result.ok, true, JSON.stringify(result));
    }
    assert.deepEqual(Object.fromEntries(uploads.map((u) => [u.questionID, [u.answer.value, u.additional.value]])), {
      [QID]: [50, 'Rating explanation'],
      [binaryId]: ['Agree', 'Binary explanation'],
      [choiceId]: [['Option A', 'Option B'], 'Choice explanation'],
      [textId]: ['An answer with context', 'Text explanation'],
    });
  });
}
