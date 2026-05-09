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

function encodeStringTail(value = '') {
  const bytes = new TextEncoder().encode(String(value));
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const paddedLength = Math.ceil(hex.length / 64) * 64;
  return `${word(bytes.length)}${hex.padEnd(paddedLength, '0')}`;
}

function encodeSessionTuple({
  slug = 'demo',
  chainId = 11155420,
  metadataURI = '',
  encryptedMetadataURI = '',
  adminAddress = '0x2222222222222222222222222222222222222222',
  createdAt = 1,
  updatedAt = 2,
  sessionIdHex = `0x${'00'.repeat(16)}`,
} = {}) {
  const heads = Array(8).fill(word(0));
  let tail = '';
  const pushString = (slot, value) => {
    heads[slot] = word(32 * heads.length + tail.length / 2);
    tail += encodeStringTail(value);
  };
  pushString(0, slug);
  heads[1] = word(chainId);
  pushString(2, metadataURI);
  pushString(3, encryptedMetadataURI);
  heads[4] = String(adminAddress).replace(/^0x/i, '').padStart(64, '0');
  heads[5] = word(createdAt);
  heads[6] = word(updatedAt);
  heads[7] = String(sessionIdHex).replace(/^0x/i, '').padEnd(64, '0');
  return `0x${heads.join('')}${tail}`;
}

function dataJsonUri(value) {
  return `data:application/json;base64,${Buffer.from(JSON.stringify(value)).toString('base64')}`;
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

test('listCachedSessionQuestionsForBridge refuses unscoped fallback scans by default', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const env = baseEnv({
    AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY: '1',
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push([url, init]);
    const body = JSON.parse(init.body || '{}');
    if (body.method === 'eth_blockNumber') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x64' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected ${body.method}`);
  };

  const result = await listCachedSessionQuestionsForBridge({
    env,
    sessionSlug: 'demo',
    fetchImpl,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'question_scan_window_unscoped');
  assert.equal(result.scanWindow.source, 'fallback_recent_blocks');
  assert.equal(env.AGENT_ACTION_KV.store.has('telegram:questions:v1:demo'), false);
  assert.equal(calls.some(([, init]) => JSON.parse(init.body || '{}').method === 'eth_getLogs'), false);
});

test('listCachedSessionQuestionsForBridge uses registry metadata block limits for scoped scans', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const questionId = `0x${'44'.repeat(32)}`;
  const pointerBytes = `0x${'55'.repeat(32)}`;
  const txId = __test__sessionQuestions.hexToBase64url(pointerBytes);
  const metadataURI = dataJsonUri({ blockLimits: { start: 42, end: 44 } });
  const env = baseEnv({
    AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY: '',
    AGENT_BRIDGE_SURVEYS_ADDRESS: '',
  });
  const logRanges = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url).startsWith('https://ar-io.dev/')) {
      assert.equal(String(url), `https://ar-io.dev/${txId}`);
      return new Response(JSON.stringify({
        id: questionId,
        type: 'freeform',
        prompt: 'Question from scoped metadata?',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.parse(init.body || '{}');
    const data = String(body.params?.[0]?.data || '');
    if (body.method === 'eth_call' && data.startsWith(__test__sessionQuestions.SELECTORS.getSessionBySlug)) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: encodeSessionTuple({ slug: 'demo', metadataURI }),
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (
      body.method === 'eth_call' &&
      data.startsWith(__test__sessionQuestions.SELECTORS.getQuestionHash)
    ) {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: pointerBytes }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (body.method === 'eth_blockNumber') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x64' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (body.method === 'eth_getLogs') {
      logRanges.push({
        fromBlock: body.params?.[0]?.fromBlock,
        toBlock: body.params?.[0]?.toBlock,
      });
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
    throw new Error(`unexpected ${body.method}`);
  };

  const result = await listCachedSessionQuestionsForBridge({
    env,
    sessionSlug: 'demo',
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, 'live_questions_loaded');
  assert.equal(result.scanWindow.source, 'session_block_limits');
  assert.equal(result.scanWindow.sessionScoped, true);
  assert.deepEqual(logRanges, [{ fromBlock: '0x2a', toBlock: '0x2c' }]);
  assert.equal(result.questions[0].prompt, 'Question from scoped metadata?');
});

test('listCachedSessionQuestionsForBridge does not cache failed log scans', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const env = baseEnv();
  const fetchImpl = async (_url, init = {}) => {
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
        error: { message: 'range too wide' },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected ${body.method}`);
  };

  const result = await listCachedSessionQuestionsForBridge({
    env,
    sessionSlug: 'demo',
    fetchImpl,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'question_log_scan_failed');
  assert.equal(result.scan.chunksFailed, 1);
  assert.equal(env.AGENT_ACTION_KV.store.has('telegram:questions:v1:demo'), false);
});

test('listCachedSessionQuestionsForBridge does not cache payload load failures as empty results', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const questionId = `0x${'66'.repeat(32)}`;
  const env = baseEnv();
  const fetchImpl = async (_url, init = {}) => {
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
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        error: { message: 'Question does not exist' },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected ${body.method}`);
  };

  const result = await listCachedSessionQuestionsForBridge({
    env,
    sessionSlug: 'demo',
    fetchImpl,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'question_payload_load_failed');
  assert.equal(result.discoveredCount, 1);
  assert.equal(result.payloadFailureCount, 1);
  assert.equal(env.AGENT_ACTION_KV.store.has('telegram:questions:v1:demo'), false);
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
