import test from 'node:test';
import assert from 'node:assert/strict';

import * as NEW from './sessionQuestions.mjs';
import { buildTelegramQuestionCard } from './questionUi.mjs';

class MemoryKv {
  constructor() { this.store = new Map(); }
  async put(key, value) { this.store.set(key, value); }
  async get(key) { return this.store.get(key) || null; }
}
const word = (value) => BigInt(value).toString(16).padStart(64, '0');
const encodeBytes32Array = (ids = []) => `${word(ids.length)}${ids.map((id) => String(id).replace(/^0x/i, '')).join('')}`;
const encodeQuestionsAddedData = (questionIds = []) => {
  const encodedQuestions = encodeBytes32Array(questionIds);
  return `0x${word(64)}${word(64 + encodedQuestions.length / 2)}${encodedQuestions}${encodeBytes32Array([])}`;
};
const questionId = `0x${'11'.repeat(32)}`;
const pointerBytes = `0x${'22'.repeat(32)}`;
const rpc = (body, result) => new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { status: 200, headers: { 'content-type': 'application/json' } });
const fetchImpl = async (url, init = {}) => {
  if (String(url).startsWith('https://ar-io.dev/')) {
    return new Response(JSON.stringify({
      id: questionId, sessionSlug: 'demo', type: 'rating', prompt: 'How much do you trust AI summaries?',
      scale: { min: 1, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  const body = JSON.parse(init.body || '{}');
  if (body.method === 'eth_blockNumber') return rpc(body, '0x64');
  if (body.method === 'eth_getLogs') return rpc(body, [{ address: '0x1111111111111111111111111111111111111111', topics: [NEW.__test__sessionQuestions.QUESTIONS_ADDED_TOPIC0], data: encodeQuestionsAddedData([questionId]) }]);
  if (body.method === 'eth_call') return rpc(body, pointerBytes);
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { message: `unexpected ${body.method}` } }), { status: 200 });
};
const baseEnv = () => ({
  DEFAULT_CHAIN_ID: '11155420', DEFAULT_RPC_URL: 'https://rpc.example.test',
  AGENT_BRIDGE_SURVEYS_ADDRESS: '0x1111111111111111111111111111111111111111',
  AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: '90', AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: '100',
  AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY: '1', AGENT_ACTION_KV: new MemoryKv(),
});

test('refresh ignores legacy v5 records missing the stored rating scale', async () => {
  const fresh = await NEW.listCachedSessionQuestionsForBridge({ env: baseEnv(), sessionSlug: 'demo', fetchImpl });
  assert.deepEqual(buildTelegramQuestionCard(fresh.questions[0]).ratingScale, { min: 1, max: 10, step: 1 });

  NEW.__test__sessionQuestions.clearCaches();
  const env = baseEnv();
  await NEW.listCachedSessionQuestionsForBridge({ env, sessionSlug: 'demo', fetchImpl });
  const legacy = JSON.parse([...env.AGENT_ACTION_KV.store.values()][0]);
  legacy.questions.forEach((question) => { delete question.scale; });
  env.AGENT_ACTION_KV.store.clear();
  await env.AGENT_ACTION_KV.put('telegram:questions:v5:demo', JSON.stringify(legacy));
  NEW.__test__sessionQuestions.clearCaches();
  const reused = await NEW.listCachedSessionQuestionsForBridge({ env, sessionSlug: 'demo', fetchImpl, forceRefresh: true });
  const card = buildTelegramQuestionCard(reused.questions[0]).ratingScale;
  assert.deepEqual(card, { min: 1, max: 10, step: 1 });
});

test('refresh ignores v6 records that lost the stored step', async () => {
  const env = baseEnv();
  const steppedFetch = async (url, init) => {
    const response = await fetchImpl(url, init);
    if (!String(url).startsWith('https://ar-io.dev/')) return response;
    const payload = await response.json(); payload.scale.step = 3;
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  NEW.__test__sessionQuestions.clearCaches();
  await NEW.listCachedSessionQuestionsForBridge({ env, sessionSlug: 'demo', fetchImpl: steppedFetch });
  const legacy = JSON.parse([...env.AGENT_ACTION_KV.store.values()][0]);
  legacy.questions.forEach((question) => { delete question.scale.step; });
  env.AGENT_ACTION_KV.store.clear();
  await env.AGENT_ACTION_KV.put('telegram:questions:v6:demo', JSON.stringify(legacy));
  NEW.__test__sessionQuestions.clearCaches();
  const refreshed = await NEW.listCachedSessionQuestionsForBridge({ env, sessionSlug: 'demo', fetchImpl: steppedFetch, forceRefresh: true });
  assert.equal(refreshed.questions[0].scale.step, 3);
});
