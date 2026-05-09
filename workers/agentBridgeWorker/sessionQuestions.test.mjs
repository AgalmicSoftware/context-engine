import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __test__sessionQuestions,
  listCachedSessionQuestionsForBridge,
} from './sessionQuestions.mjs';

class MemoryKv {
  constructor(seed = {}) {
    this.store = new Map(Object.entries(seed));
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async get(key) {
    return this.store.get(key) || null;
  }
}

function word(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function encodeBytes32Array(ids = []) {
  return `${word(ids.length)}${ids.map((id) => String(id).replace(/^0x/i, '')).join('')}`;
}

function encodeQuestionsAddedData(questionIds = [], surveyIds = []) {
  const encodedQuestions = encodeBytes32Array(questionIds);
  const encodedSurveys = encodeBytes32Array(surveyIds);
  const secondOffsetBytes = 64 + encodedQuestions.length / 2;
  return `0x${word(64)}${word(secondOffsetBytes)}${encodedQuestions}${encodedSurveys}`;
}

function baseEnv(overrides = {}) {
  return {
    DEFAULT_CHAIN_ID: '11155420',
    DEFAULT_RPC_URL: 'https://rpc.example.test',
    AGENT_BRIDGE_SURVEYS_ADDRESS: '0x1111111111111111111111111111111111111111',
    AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: '90',
    AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: '100',
    AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY: '1',
    AGENT_ACTION_KV: new MemoryKv(),
    ...overrides,
  };
}

function makeQuestionFetch({
  questionId = `0x${'11'.repeat(32)}`,
  pointerBytes = `0x${'22'.repeat(32)}`,
  prompt = 'Should the demo use real session questions?',
} = {}) {
  const calls = [];
  const txId = __test__sessionQuestions.hexToBase64url(pointerBytes);
  const fetchImpl = async (url, init = {}) => {
    calls.push([url, init]);
    if (String(url).startsWith('https://ar-io.dev/')) {
      assert.equal(String(url), `https://ar-io.dev/${txId}`);
      return new Response(JSON.stringify({
        id: questionId,
        type: 'freeform',
        prompt,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.parse(init.body || '{}');
    if (body.method === 'eth_blockNumber') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x64' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (body.method === 'eth_getLogs') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: [{
          address: '0x1111111111111111111111111111111111111111',
          topics: [__test__sessionQuestions.QUESTIONS_ADDED_TOPIC0],
          data: encodeQuestionsAddedData([questionId], []),
        }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (
      body.method === 'eth_call' &&
      String(body.params?.[0]?.data || '').startsWith(__test__sessionQuestions.SELECTORS.getQuestionHash)
    ) {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: pointerBytes }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: body.id,
      error: { message: `unexpected ${body.method}` },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { calls, fetchImpl, txId };
}

test('listCachedSessionQuestionsForBridge reads live public questions and writes KV cache', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const questionId = `0x${'11'.repeat(32)}`;
  const { calls, fetchImpl, txId } = makeQuestionFetch({ questionId });
  const env = baseEnv();

  const result = await listCachedSessionQuestionsForBridge({
    env,
    sessionSlug: 'demo',
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, 'live_questions_loaded');
  assert.equal(result.cacheLayer, 'fresh');
  assert.equal(result.questionCount, 1);
  assert.equal(result.questions[0].questionId, questionId);
  assert.equal(result.questions[0].prompt, 'Should the demo use real session questions?');
  assert.equal(result.questions[0].arweaveTxId, txId);
  assert.equal(result.questions[0].source, 'live_session_question');
  assert.equal(calls.some(([url]) => String(url).startsWith('https://ar-io.dev/')), true);
  assert.equal(env.AGENT_ACTION_KV.store.has('telegram:questions:v1:demo'), true);
});

test('listCachedSessionQuestionsForBridge serves KV cache without RPC calls', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const cached = {
    ok: true,
    reason: 'live_questions_loaded',
    sessionSlug: 'demo',
    source: 'live_session_question_cache',
    cachedAtMs: Date.now(),
    questions: [{
      questionId: `0x${'33'.repeat(32)}`,
      id: `0x${'33'.repeat(32)}`,
      questionType: 'freeform',
      prompt: 'Cached question?',
      visibility: 'public',
      source: 'live_session_question',
    }],
    questionCount: 1,
  };
  const env = baseEnv({
    AGENT_ACTION_KV: new MemoryKv({
      'telegram:questions:v1:demo': JSON.stringify(cached),
    }),
  });

  const result = await listCachedSessionQuestionsForBridge({
    env,
    sessionSlug: 'demo',
    fetchImpl: async () => {
      throw new Error('network should not be called');
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.cacheLayer, 'kv');
  assert.equal(result.questions[0].prompt, 'Cached question?');
});
