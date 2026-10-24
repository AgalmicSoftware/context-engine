import test from 'node:test';
import assert from 'node:assert/strict';
import { __test__sessionQuestions } from './sessionQuestions.mjs';
import { buildAgentQuestionAnswerSchema } from './agentAnswerSchema.mjs';
import { normalizeAgentRatingAnswer } from './ratingScale.mjs';
import { persistAnswerDraft, readAnswerDraft, persistAgentSubmitRequest, SUBMIT_REQUEST_KV_PREFIX } from './agentSessionRuntime.mjs';
import { buildAgentResponsePayload } from './onChainResponses.mjs';
import { processQueuedAgentSubmitRecord } from './agentSubmitQueue.mjs';
class MemoryKv {
  constructor() { this.store = new Map(); }
  async put(key, value) { this.store.set(key, value); }
  async get(key) { return this.store.get(key) || null; }
  async delete(key) { this.store.delete(key); }
  async list({ prefix = '' } = {}) { return { keys: [...this.store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
const qid = `0x${'ab'.repeat(32)}`;
const NORMALIZED = { user: { telegramUserId: '424242', username: 'sample' }, chat: { chatId: '424242', type: 'private' } };

for (const [scale, tapped] of [[{ min: 0, max: 100 }, 50], [{ min: -5, max: 5 }, -5]]) {
  test(`saved rating ${tapped} on a ${scale.min}..${scale.max} question reaches the upload payload unchanged`, async () => {
    const question = __test__sessionQuestions.normalizeQuestionPayload(
      { id: qid, prompt: 'How likely?', type: 'rating', scale, sessionSlug: 'alpha' },
      { questionId: qid, pointerId: 'x'.repeat(43), sessionSlug: 'alpha' },
    );
    assert.ok(buildAgentQuestionAnswerSchema(question).answerSchema.values.includes(tapped));
    const sent = [];
    const env = {
      AGENT_ACTION_KV: new MemoryKv(),
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{ questionId: qid, prompt: 'How likely?', type: 'rating', scale, sessionSlug: 'alpha' }]),
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({ defaultSessionSlug: 'alpha', sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', sessionWorkerUrl: 'https://worker.example.test', chainId: 11155420, surveysAddress: '0x1111111111111111111111111111111111111111', telegramBridgeEnabled: true, managedAccountSubmitAllowed: true }] }),
      AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED: 'true',
      AGENT_RESPONSE_QUEUE: { send: async (message) => { sent.push(message); } },
      DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    };
    // makeAnswerButton's serverContextRef -> persistAnswerDraft (answerValue = String(control.value))
    await persistAnswerDraft({ env, normalized: NORMALIZED, sessionSlug: 'alpha', selectedQuestionId: qid, answerLabel: String(tapped), answerValue: String(tapped), controlType: 'rating_button', createdAt: '2026-10-01T10:00:00.000Z' });
    const draft = await readAnswerDraft({ env, normalized: NORMALIZED, sessionSlug: 'alpha', selectedQuestionId: qid });
    const submitted = await persistAgentSubmitRequest({ env, normalized: NORMALIZED, draft, sessionSlug: 'alpha', selectedQuestionId: qid, createdAt: '2026-10-01T10:01:00.000Z' });
    assert.equal(submitted.ok, true, JSON.stringify(submitted));
    const key = [...env.AGENT_ACTION_KV.store.keys()].find((k) => k.startsWith(SUBMIT_REQUEST_KV_PREFIX));
    const record = JSON.parse(env.AGENT_ACTION_KV.store.get(key));
    // agentSubmitQueue.mjs processQueuedTelegramSubmitRecord passes exactly these to submitTelegramResponseOnChain
    const payload = buildAgentResponsePayload({ sessionSlug: record.sessionSlug, questionRef: { sessionSlug: record.sessionSlug, questionId: record.questionId, ratingScale: record.ratingScale }, answer: record.onChainAnswer || record.answer });
    assert.equal(payload.answer.value, tapped, `upload stores ${payload.answer.value} for the saved ${tapped}`);
    let uploaded = null;
    env.AGENT_BRIDGE_FETCH = async (url, init) => {
      let data;
      if (url.endsWith('/auth/nonce')) data = { nonce: 'sample-nonce' };
      else if (url.endsWith('/auth/login')) data = { token: 'sample-token', exp: 2000000000 };
      else if (url.endsWith('/storage/upload')) {
        uploaded = JSON.parse(init.body).data;
        data = { id: Buffer.alloc(32, 7).toString('base64url') };
      } else throw new Error(`Unexpected network call ${url}`);
      return new Response(JSON.stringify(data), { status: 200 });
    };
    const processed = await processQueuedAgentSubmitRecord({ env, record,
      contractFactory: () => ({ submitResponses: async () => ({ hash: 'sample-tx', wait: async () => ({ status: 1 }) }) }) });
    assert.equal(processed.ok, true, JSON.stringify(processed));
    assert.equal(uploaded.answer.value, tapped);

  });
}

for (const [scale, value, accepted] of [
  [{ min: 1, max: 10, step: 1 }, 0, false],
  [{ min: 0, max: 100, step: 5 }, 50, true],
  [{ min: -5, max: 5, step: 1 }, -5, true],
  [{ min: 0, max: 100, step: 5 }, 52, false],
]) {
  test(`trusted scale validates ${value} against authoritative metadata and upload`, () => {
    const questionRef = { questionType: 'rating', questionId: qid, ratingScale: scale };
    const answer = { questionType: 'rating', value, ratingScale: { min: -1000, max: 1000, step: 1 } };
    assert.equal(normalizeAgentRatingAnswer(value, questionRef) !== null, accepted);
    if (accepted) assert.equal(buildAgentResponsePayload({ questionRef, answer }).answer.value, value);
    else assert.throws(() => buildAgentResponsePayload({ questionRef, answer }), /rating_answer_invalid/);
  });
}
