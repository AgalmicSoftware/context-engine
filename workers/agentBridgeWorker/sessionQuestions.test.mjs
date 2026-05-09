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

function encodeSessionCreatedData({
  slug = 'demo',
  chainId = 11155420,
  metadataURI = '',
  encryptedMetadataURI = '',
} = {}) {
  const heads = Array(4).fill(word(0));
  let tail = '';
  const pushString = (slot, value) => {
    heads[slot] = word(32 * heads.length + tail.length / 2);
    tail += encodeStringTail(value);
  };
  pushString(0, slug);
  heads[1] = word(chainId);
  pushString(2, metadataURI);
  pushString(3, encryptedMetadataURI);
  return `0x${heads.join('')}${tail}`;
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
  assert.equal(result.reason, 'live_questions_indexed');
  assert.equal(result.cacheLayer, 'fresh');
  assert.equal(result.questionCount, 1);
  assert.equal(result.questions[0].questionId, questionId);
  assert.equal(result.questions[0].prompt, 'Should the demo use real session questions?');
  assert.equal(result.questions[0].arweaveTxId, txId);
  assert.equal(result.questions[0].source, 'live_session_question');
  assert.equal(calls.some(([url]) => String(url).startsWith('https://ar-io.dev/')), true);
  assert.equal(env.AGENT_ACTION_KV.store.has('telegram:questions:v2:demo'), true);
});

test('listCachedSessionQuestionsForBridge serves first available questions while background indexes remaining blocks', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const recentQuestionId = `0x${'aa'.repeat(32)}`;
  const olderQuestionId = `0x${'bb'.repeat(32)}`;
  const recentPointer = `0x${'22'.repeat(32)}`;
  const olderPointer = `0x${'33'.repeat(32)}`;
  const txByPointer = {
    [recentPointer]: __test__sessionQuestions.hexToBase64url(recentPointer),
    [olderPointer]: __test__sessionQuestions.hexToBase64url(olderPointer),
  };
  const pointerByQuestion = {
    [recentQuestionId]: recentPointer,
    [olderQuestionId]: olderPointer,
  };
  const promptByTx = {
    [txByPointer[recentPointer]]: 'Recent question should show first',
    [txByPointer[olderPointer]]: 'Older question should finish in background',
  };
  const env = baseEnv({
    AGENT_BRIDGE_QUESTION_LOG_CHUNK_SIZE: '5',
  });
  const background = [];
  const logRanges = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url).startsWith('https://ar-io.dev/')) {
      const txId = String(url).split('/').pop();
      return new Response(JSON.stringify({
        id: txId === txByPointer[recentPointer] ? recentQuestionId : olderQuestionId,
        type: 'freeform',
        prompt: promptByTx[txId],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.parse(init.body || '{}');
    const data = String(body.params?.[0]?.data || '');
    if (body.method === 'eth_blockNumber') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x64' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (body.method === 'eth_getLogs') {
      const fromBlock = Number(BigInt(body.params?.[0]?.fromBlock || '0x0'));
      const toBlock = Number(BigInt(body.params?.[0]?.toBlock || '0x0'));
      logRanges.push([fromBlock, toBlock]);
      const ids = [];
      if (fromBlock <= 100 && toBlock >= 96) ids.push(recentQuestionId);
      if (fromBlock <= 95 && toBlock >= 91) ids.push(olderQuestionId);
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: ids.length ? [{
          address: '0x1111111111111111111111111111111111111111',
          topics: [__test__sessionQuestions.QUESTIONS_ADDED_TOPIC0],
          data: encodeQuestionsAddedData(ids, []),
        }] : [],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (
      body.method === 'eth_call' &&
      data.startsWith(__test__sessionQuestions.SELECTORS.getQuestionHash)
    ) {
      const questionId = `0x${data.slice(__test__sessionQuestions.SELECTORS.getQuestionHash.length)}`.toLowerCase();
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: pointerByQuestion[questionId] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected ${body.method}`);
  };

  const first = await listCachedSessionQuestionsForBridge({
    env,
    sessionSlug: 'demo',
    fetchImpl,
    waitUntil: (promise) => background.push(promise),
  });

  assert.equal(first.ok, true);
  assert.equal(first.reason, 'live_questions_index_partial');
  assert.equal(first.complete, false);
  assert.equal(first.nextScanToBlock, 95);
  assert.deepEqual(first.questions.map((question) => question.prompt), ['Recent question should show first']);
  assert.equal(background.length, 1);

  await Promise.all(background);
  const cached = JSON.parse(env.AGENT_ACTION_KV.store.get('telegram:questions:v2:demo'));
  assert.equal(cached.complete, true);
  assert.deepEqual(cached.questions.map((question) => question.prompt), [
    'Recent question should show first',
    'Older question should finish in background',
  ]);
  assert.deepEqual(logRanges, [[96, 100], [91, 95], [90, 90]]);
});

test('listCachedSessionQuestionsForBridge replies after bounded foreground indexing when no question is found yet', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const olderQuestionId = `0x${'cc'.repeat(32)}`;
  const olderPointer = `0x${'44'.repeat(32)}`;
  const olderTx = __test__sessionQuestions.hexToBase64url(olderPointer);
  const env = baseEnv({
    AGENT_BRIDGE_QUESTION_LOG_CHUNK_SIZE: '5',
    AGENT_BRIDGE_QUESTION_FOREGROUND_CHUNKS: '1',
  });
  const background = [];
  const logRanges = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url).startsWith('https://ar-io.dev/')) {
      assert.equal(String(url), `https://ar-io.dev/${olderTx}`);
      return new Response(JSON.stringify({
        id: olderQuestionId,
        type: 'freeform',
        prompt: 'Older question appears after background indexing',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.parse(init.body || '{}');
    const data = String(body.params?.[0]?.data || '');
    if (body.method === 'eth_blockNumber') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x64' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (body.method === 'eth_getLogs') {
      const fromBlock = Number(BigInt(body.params?.[0]?.fromBlock || '0x0'));
      const toBlock = Number(BigInt(body.params?.[0]?.toBlock || '0x0'));
      logRanges.push([fromBlock, toBlock]);
      const ids = fromBlock <= 95 && toBlock >= 91 ? [olderQuestionId] : [];
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: ids.length ? [{
          address: '0x1111111111111111111111111111111111111111',
          topics: [__test__sessionQuestions.QUESTIONS_ADDED_TOPIC0],
          data: encodeQuestionsAddedData(ids, []),
        }] : [],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (
      body.method === 'eth_call' &&
      data.startsWith(__test__sessionQuestions.SELECTORS.getQuestionHash)
    ) {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: olderPointer }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected ${body.method}`);
  };

  const first = await listCachedSessionQuestionsForBridge({
    env,
    sessionSlug: 'demo',
    fetchImpl,
    waitUntil: (promise) => background.push(promise),
  });

  assert.equal(first.ok, true);
  assert.equal(first.reason, 'live_questions_indexing');
  assert.equal(first.complete, false);
  assert.equal(first.nextScanToBlock, 95);
  assert.deepEqual(first.questions, []);
  assert.equal(background.length, 1);

  await Promise.all(background);
  const cached = JSON.parse(env.AGENT_ACTION_KV.store.get('telegram:questions:v2:demo'));
  assert.equal(cached.complete, true);
  assert.deepEqual(cached.questions.map((question) => question.prompt), [
    'Older question appears after background indexing',
  ]);
  assert.deepEqual(logRanges, [[96, 100], [91, 95], [90, 90]]);
});

test('listCachedSessionQuestionsForBridge schedules background refresh for fresh partial indexes', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const olderQuestionId = `0x${'dd'.repeat(32)}`;
  const olderPointer = `0x${'77'.repeat(32)}`;
  const olderTx = __test__sessionQuestions.hexToBase64url(olderPointer);
  const partial = {
    ok: true,
    reason: 'live_questions_indexing',
    sessionSlug: 'demo',
    source: 'telegram_worker_question_index',
    cachedAtMs: Date.now(),
    indexedFromBlock: 96,
    indexedToBlock: 100,
    targetFromBlock: 90,
    targetToBlock: 100,
    nextScanToBlock: 95,
    complete: false,
    scan: { ids: [], chunksAttempted: 1, chunksSucceeded: 1, chunksFailed: 0, errors: [] },
    questions: [],
  };
  const env = baseEnv({
    AGENT_BRIDGE_QUESTION_LOG_CHUNK_SIZE: '5',
    AGENT_ACTION_KV: new MemoryKv({
      'telegram:questions:v2:demo': JSON.stringify(partial),
    }),
  });
  const background = [];
  const logRanges = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url).startsWith('https://ar-io.dev/')) {
      assert.equal(String(url), `https://ar-io.dev/${olderTx}`);
      return new Response(JSON.stringify({
        id: olderQuestionId,
        type: 'freeform',
        prompt: 'Fresh partial cache continued in background',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.parse(init.body || '{}');
    const data = String(body.params?.[0]?.data || '');
    if (body.method === 'eth_blockNumber') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x64' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (body.method === 'eth_getLogs') {
      const fromBlock = Number(BigInt(body.params?.[0]?.fromBlock || '0x0'));
      const toBlock = Number(BigInt(body.params?.[0]?.toBlock || '0x0'));
      logRanges.push([fromBlock, toBlock]);
      const ids = fromBlock <= 95 && toBlock >= 91 ? [olderQuestionId] : [];
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: ids.length ? [{
          address: '0x1111111111111111111111111111111111111111',
          topics: [__test__sessionQuestions.QUESTIONS_ADDED_TOPIC0],
          data: encodeQuestionsAddedData(ids, []),
        }] : [],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (
      body.method === 'eth_call' &&
      data.startsWith(__test__sessionQuestions.SELECTORS.getQuestionHash)
    ) {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: olderPointer }), {
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
    waitUntil: (promise) => background.push(promise),
  });

  assert.equal(result.cacheLayer, 'kv');
  assert.equal(result.complete, false);
  assert.deepEqual(result.questions, []);
  assert.equal(background.length, 1);

  await Promise.all(background);
  const cached = JSON.parse(env.AGENT_ACTION_KV.store.get('telegram:questions:v2:demo'));
  assert.equal(cached.complete, true);
  assert.deepEqual(cached.questions.map((question) => question.prompt), [
    'Fresh partial cache continued in background',
  ]);
  assert.deepEqual(logRanges, [[91, 95], [90, 90]]);
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
  assert.equal(env.AGENT_ACTION_KV.store.has('telegram:questions:v2:demo'), false);
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
  assert.equal(result.reason, 'live_questions_indexed');
  assert.equal(result.scanWindow.source, 'session_block_limits');
  assert.equal(result.scanWindow.sessionScoped, true);
  assert.deepEqual(logRanges, [{ fromBlock: '0x2a', toBlock: '0x2c' }]);
  assert.equal(result.questions[0].prompt, 'Question from scoped metadata?');
});

test('listCachedSessionQuestionsForBridge falls through empty registry tuples to the next RPC', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const questionId = `0x${'14'.repeat(32)}`;
  const pointerBytes = `0x${'15'.repeat(32)}`;
  const txId = __test__sessionQuestions.hexToBase64url(pointerBytes);
  const metadataURI = dataJsonUri({ blockLimits: { start: 80, end: 81 } });
  const env = baseEnv({
    DEFAULT_RPC_URL: 'https://stale-rpc.example',
    ADDITIONAL_RPC_URL: 'https://fresh-rpc.example',
    AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY: '',
    AGENT_BRIDGE_SURVEYS_ADDRESS: '',
  });
  const sessionRpcUrls = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url).startsWith('https://ar-io.dev/')) {
      assert.equal(String(url), `https://ar-io.dev/${txId}`);
      return new Response(JSON.stringify({
        id: questionId,
        type: 'freeform',
        prompt: 'Question after stale RPC fallback?',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.parse(init.body || '{}');
    const data = String(body.params?.[0]?.data || '');
    if (body.method === 'eth_call' && data.startsWith(__test__sessionQuestions.SELECTORS.getSessionBySlug)) {
      sessionRpcUrls.push(String(url));
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: String(url).includes('stale-rpc')
          ? '0x'
          : encodeSessionTuple({ slug: 'demo-4', metadataURI }),
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
    sessionSlug: 'demo-4',
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(sessionRpcUrls, ['https://stale-rpc.example', 'https://fresh-rpc.example']);
  assert.equal(result.scanWindow.source, 'session_block_limits');
  assert.equal(result.questions[0].prompt, 'Question after stale RPC fallback?');
});

test('listCachedSessionQuestionsForBridge falls back across Arweave gateways for metadata and payloads', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const questionId = `0x${'77'.repeat(32)}`;
  const pointerBytes = `0x${'88'.repeat(32)}`;
  const txId = __test__sessionQuestions.hexToBase64url(pointerBytes);
  const metadataTxId = __test__sessionQuestions.hexToBase64url(`0x${'99'.repeat(32)}`);
  const env = baseEnv({
    AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY: '',
    AGENT_BRIDGE_SURVEYS_ADDRESS: '',
  });
  const arweaveUrls = [];
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    if (urlText.startsWith('https://ar-io.dev/') || urlText.startsWith('https://arweave.net/')) {
      arweaveUrls.push(urlText);
      if (urlText.startsWith('https://ar-io.dev/')) {
        return new Response('gateway unavailable', { status: 504 });
      }
      if (urlText.endsWith(`/${metadataTxId}`)) {
        return new Response(JSON.stringify({ blockLimits: { start: 50, end: 60 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      assert.equal(urlText, `https://arweave.net/${txId}`);
      return new Response(JSON.stringify({
        id: questionId,
        type: 'freeform',
        prompt: 'Question from fallback gateway?',
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
        result: encodeSessionTuple({ slug: 'demo', metadataURI: `ar://${metadataTxId}` }),
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
  assert.equal(result.reason, 'live_questions_indexed');
  assert.equal(result.questions[0].prompt, 'Question from fallback gateway?');
  assert.deepEqual(arweaveUrls, [
    `https://ar-io.dev/${metadataTxId}`,
    `https://arweave.net/${metadataTxId}`,
    `https://ar-io.dev/${txId}`,
    `https://arweave.net/${txId}`,
  ]);
});

test('listCachedSessionQuestionsForBridge derives scoped start from SessionCreated when metadata is unavailable', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const questionId = `0x${'31'.repeat(32)}`;
  const pointerBytes = `0x${'32'.repeat(32)}`;
  const txId = __test__sessionQuestions.hexToBase64url(pointerBytes);
  const metadataTxId = __test__sessionQuestions.hexToBase64url(`0x${'33'.repeat(32)}`);
  const registryAddress = '0x2222222222222222222222222222222222222222';
  const surveysAddress = '0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A';
  const env = baseEnv({
    AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY: '',
    AGENT_BRIDGE_SURVEYS_ADDRESS: '',
    AGENT_BRIDGE_SESSION_REGISTRY_ADDRESS: registryAddress,
  });
  const logRanges = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url).startsWith('https://ar-io.dev/') || String(url).startsWith('https://arweave.net/')) {
      return new Response('metadata unavailable', { status: 504 });
    }
    const body = JSON.parse(init.body || '{}');
    const data = String(body.params?.[0]?.data || '');
    const address = String(body.params?.[0]?.address || '').toLowerCase();
    if (body.method === 'eth_call' && data.startsWith(__test__sessionQuestions.SELECTORS.getSessionBySlug)) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: encodeSessionTuple({ slug: 'demo-4', metadataURI: `ar://${metadataTxId}` }),
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
    if (body.method === 'eth_getLogs' && address === registryAddress.toLowerCase()) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: [{
          address: registryAddress,
          blockNumber: '0x37',
          topics: ['0xda4a316a58925980f9d609158916dd8a071a29c9118777e57a5daed4ba17744f'],
          data: encodeSessionCreatedData({ slug: 'demo-4', metadataURI: `ar://${metadataTxId}` }),
        }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (body.method === 'eth_getLogs' && address === surveysAddress.toLowerCase()) {
      logRanges.push({
        fromBlock: body.params?.[0]?.fromBlock,
        toBlock: body.params?.[0]?.toBlock,
      });
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: [{
          address: surveysAddress,
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
    sessionSlug: 'demo-4',
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.scanWindow.source, 'session_block_limits');
  assert.equal(result.scanWindow.fromBlock, 55);
  assert.deepEqual(logRanges, [{ fromBlock: '0x37', toBlock: '0x64' }]);
  assert.equal(result.questions[0].questionId, questionId);
  assert.equal(result.questions[0].payloadUnavailable, true);
  assert.equal(result.questions[0].arweaveTxId, txId);
});

test('listCachedSessionQuestionsForBridge honors session metadata Surveys address', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const questionId = `0x${'12'.repeat(32)}`;
  const pointerBytes = `0x${'13'.repeat(32)}`;
  const txId = __test__sessionQuestions.hexToBase64url(pointerBytes);
  const metadataSurveys = '0x3333333333333333333333333333333333333333';
  const metadataURI = dataJsonUri({
    blockLimits: { start: 70, end: 72 },
    contracts: {
      surveys: { address: metadataSurveys, chainId: 11155420 },
    },
  });
  const env = baseEnv({
    AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: undefined,
    AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY: '',
    AGENT_BRIDGE_SURVEYS_ADDRESS: '',
  });
  const logAddresses = [];
  const callAddresses = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url).startsWith('https://ar-io.dev/')) {
      assert.equal(String(url), `https://ar-io.dev/${txId}`);
      return new Response(JSON.stringify({
        id: questionId,
        type: 'freeform',
        prompt: 'Question from metadata contract?',
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
      callAddresses.push(String(body.params?.[0]?.to || '').toLowerCase());
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
      logAddresses.push(String(body.params?.[0]?.address || '').toLowerCase());
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: [{
          address: metadataSurveys,
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
  assert.equal(result.surveysAddress, metadataSurveys);
  assert.deepEqual(logAddresses, [metadataSurveys]);
  assert.deepEqual(callAddresses, [metadataSurveys]);
  assert.equal(result.questions[0].prompt, 'Question from metadata contract?');
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
  assert.equal(env.AGENT_ACTION_KV.store.has('telegram:questions:v2:demo'), false);
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
  assert.equal(env.AGENT_ACTION_KV.store.has('telegram:questions:v2:demo'), false);
});

test('listCachedSessionQuestionsForBridge keeps on-chain question IDs when payload gateways fail', async () => {
  __test__sessionQuestions.questionMemoryCache.clear();
  const questionId = `0x${'21'.repeat(32)}`;
  const pointerBytes = `0x${'22'.repeat(32)}`;
  const env = baseEnv();
  const fetchImpl = async (url, init = {}) => {
    if (String(url).startsWith('https://ar-io.dev/') || String(url).startsWith('https://arweave.net/')) {
      return new Response('gateway timeout', { status: 504 });
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
    throw new Error(`unexpected ${body.method}`);
  };

  const result = await listCachedSessionQuestionsForBridge({
    env,
    sessionSlug: 'demo',
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.questionCount, 1);
  assert.equal(result.questions[0].questionId, questionId);
  assert.equal(result.questions[0].visibility, 'lit_encrypted');
  assert.equal(result.questions[0].payloadUnavailable, true);
  assert.equal(result.questions[0].title, 'Locked question');
  assert.equal(env.AGENT_ACTION_KV.store.has('telegram:questions:v2:demo'), true);
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
      'telegram:questions:v2:demo': JSON.stringify(cached),
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
