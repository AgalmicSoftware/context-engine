import test from 'node:test';
import assert from 'node:assert/strict';
import { listCachedSessionQuestions } from './registryQuestions.mjs';
import { questionMemoryCache, DEFAULT_CACHE_TTL_SECONDS } from './registryQuestionCore.mjs';

const questionId = number => `0x${number.toString(16).padStart(64, '0')}`;
const word = number => BigInt(number).toString(16).padStart(64, '0');
const questionLogs = ids => [{ data: `0x${word(32)}${word(ids.length)}${ids.map(id => id.slice(2)).join('')}` }];
const fixture = () => {
  questionMemoryCache.clear();
  const stored = new Map();
  let head = 10;
  let releaseHead = () => {};
  let headGate = Promise.resolve();
  const calls = [];
  const env = {
    DEFAULT_RPC_URL: 'https://rpc.example.test',
    AGENT_ACTION_KV: { get: async key => stored.get(key) ?? null, put: async (key, value) => stored.set(key, value) },
    AGENT_SERVICES: { current: async () => {} },
    AGENT_CONTEXT: { sessionId: 'synthetic-index', revision: 1, address: `0x${'11'.repeat(20)}`, slug: 'fixture', config: {
      networkChainId: 11155420, contracts: { surveys: { address: `0x${'22'.repeat(20)}` } }, blockLimits: { start: 1 },
    } },
  };
  const fetchImpl = async (url, init = {}) => {
    if (new URL(url).hostname === 'ar-io.dev') {
      const id = `0x${Buffer.from(new URL(url).pathname.slice(1), 'base64url').toString('hex')}`;
      return Response.json({ id, sessionSlug: 'fixture', type: 'binary', prompt: `Synthetic question ${id}` });
    }
    assert.equal(String(url), env.DEFAULT_RPC_URL, 'all traffic uses local test doubles');
    const body = JSON.parse(init.body);
    calls.push(body);
    let result;
    if (body.method === 'eth_blockNumber') {
      await headGate;
      result = `0x${head.toString(16)}`;
    } else if (body.method === 'eth_getLogs') {
      const { fromBlock, toBlock } = body.params[0];
      result = questionLogs([[5, 1], [20, 2]].filter(([block]) => block >= Number(fromBlock) && block <= Number(toBlock))
        .map(([, id]) => questionId(id)));
    } else if (body.method === 'eth_call') result = `0x${body.params[0].data.slice(-64)}`;
    else assert.fail(`Unexpected RPC method: ${body.method}`);
    return Response.json({ jsonrpc: '2.0', id: body.id, result });
  };
  return { env, stored, calls, fetchImpl,
    read: options => listCachedSessionQuestions({ env, sessionSlug: 'fixture', fetchImpl, ...options }),
    setHead: value => { head = value; },
    holdHead: () => { headGate = new Promise(resolve => { releaseHead = resolve; }); },
    releaseHead: () => releaseHead(),
  };
};

for (const layer of ['memory', 'kv']) test(`an expired complete ${layer} index refreshes once to the current head`, async () => {
  const f = fixture();
  const original = await f.read();
  assert.equal(original.complete, true);
  assert.equal(original.indexedToBlock, 10);
  assert.deepEqual(original.questions.map(q => q.id), [questionId(1)]);
  original.cachedAtMs = Date.now() - (DEFAULT_CACHE_TTL_SECONDS + 1) * 1000;
  const key = [...questionMemoryCache.keys()][0];
  if (layer === 'memory') {
    questionMemoryCache.set(key, original);
    f.stored.clear();
  } else {
    questionMemoryCache.clear();
    f.stored.set(key, JSON.stringify(original));
  }
  f.setHead(20);
  f.holdHead();
  const pending = [];
  try {
    const cached = await Promise.all(Array.from({ length: 3 }, () => f.read({ waitUntil: promise => pending.push(promise) })));
    for (const result of cached) {
      assert.equal(result.indexedToBlock, 10);
      assert.deepEqual(result.questions.map(q => q.id), [questionId(1)]);
    }
    assert.equal(pending.length, 1, 'concurrent stale reads schedule one refresh');
  } finally {
    f.releaseHead();
    await Promise.all(pending);
  }
  const refreshed = await f.read({ waitUntil: () => assert.fail('a fresh complete index needs no refresh') });
  assert.equal(refreshed.indexedToBlock, 20);
  assert.equal(refreshed.complete, true);
  assert.deepEqual(refreshed.questions.map(q => q.id), [questionId(2), questionId(1)]);
  assert.equal(f.calls.filter(call => call.method === 'eth_blockNumber').length, 2);
});

test('a fresh complete question index is reused without scanning', async () => {
  const f = fixture();
  await f.read();
  const callCount = f.calls.length;
  const cached = await f.read({ waitUntil: () => assert.fail('no background scan is needed') });
  assert.equal(cached.indexedToBlock, 10);
  assert.equal(f.calls.length, callCount);
});

test('a fresh unfinished question index still schedules its historical continuation', async () => {
  const f = fixture();
  const original = await f.read();
  const key = [...questionMemoryCache.keys()][0];
  const unfinished = { ...original, questions: [], complete: false, indexedFromBlock: 6, nextScanToBlock: 5 };
  questionMemoryCache.set(key, unfinished);
  f.stored.set(key, JSON.stringify(unfinished));
  const pending = [];
  await f.read({ waitUntil: promise => pending.push(promise) });
  assert.equal(pending.length, 1);
  await Promise.all(pending);
  const complete = await f.read();
  assert.equal(complete.complete, true);
  assert.deepEqual(complete.questions.map(q => q.id), [questionId(1)]);
});
