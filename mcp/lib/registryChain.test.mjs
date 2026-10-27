import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { ethers } from 'ethers';
import { scanRegistryLogs, findStartBlock, checkRegistryChain } from './registryChain.mjs';

test('scans at most 9500 blocks per request and bisects provider range limits', async () => {
  const wide = [];
  await scanRegistryLogs({ provider: { getLogs: async ({ fromBlock, toBlock }) => { wide.push([fromBlock, toBlock]); return []; } },
    filter: {}, cursor: { block: 0, offset: 0 }, toBlock: 20000 });
  assert.deepEqual(wide, [[0, 9499], [9500, 18999], [19000, 20000]]);
  const calls = [];
  const provider = { getLogs: async ({ fromBlock, toBlock }) => {
    calls.push([fromBlock, toBlock]);
    if (toBlock - fromBlock >= 2) throw new Error('block range too large');
    return [{ blockNumber: fromBlock, transactionIndex: 0, logIndex: 0 }];
  } };
  const result = await scanRegistryLogs({ provider, filter: {}, cursor: { block: 0, offset: 0 }, toBlock: 6 });
  assert.equal(result.complete, true);
  assert.equal(result.cursor.block, 7);
  assert.ok(calls.length > 4);
  assert.ok(calls.every(([from, to]) => to - from < 9500));
});

test('scan caps retain an intra-block cursor and report incomplete without losing events', async () => {
  const all = [0, 1, 2].map((logIndex) => ({ blockNumber: 1, transactionIndex: 0, logIndex }));
  const provider = { getLogs: async () => all };
  const first = await scanRegistryLogs({ provider, filter: {}, cursor: { block: 1, offset: 0 }, toBlock: 1, maxLogs: 2 });
  assert.equal(first.complete, false);
  assert.deepEqual(first.logs.map((entry) => entry.logIndex), [0, 1]);
  const second = await scanRegistryLogs({ provider, filter: {}, cursor: first.cursor, toBlock: 1, maxLogs: 2 });
  assert.deepEqual(second.logs.map((entry) => entry.logIndex), [2]);
  assert.equal(second.complete, true);
  const expired = await scanRegistryLogs({ provider, filter: {}, cursor: { block: 1, offset: 0 }, toBlock: 1, deadline: 0 });
  assert.equal(expired.complete, false);
});

test('finds the creation block and refuses wrong-chain RPCs before contract calls', async () => {
  const provider = { getBlock: async (block) => ({ timestamp: 100 + block * 10 }), send: async () => '0xaa37dc' };
  assert.equal(await findStartBlock(provider, 155, 20), 6);
  await checkRegistryChain(provider, 11155420);
  await assert.rejects(checkRegistryChain(provider, 31337), /different chain/);
});

test('newest-first scans resume inside a block and bisect without skipping older ranges', async () => {
  const all = Array.from({ length: 5 }, (_, logIndex) => ({ blockNumber: logIndex < 2 ? 1 : 4, transactionIndex: 0, logIndex }));
  const provider = { getLogs: async ({ fromBlock, toBlock }) => {
    if (toBlock - fromBlock > 1) throw new Error('block range too large');
    return all.filter((entry) => entry.blockNumber >= fromBlock && entry.blockNumber <= toBlock);
  } };
  const args = { provider, filter: {}, fromBlock: 1, toBlock: 6, descending: true, maxLogs: 2 };
  const found = [];
  let cursor = { block: 6, offset: 0 };
  let complete = false;
  for (let i = 0; i < 3; i += 1) {
    const result = await scanRegistryLogs({ ...args, cursor });
    found.push(...result.logs.map((entry) => entry.logIndex));
    cursor = result.cursor;
    complete = result.complete;
  }
  assert.deepEqual(found, [4, 3, 2, 1, 0]);
  assert.equal(complete, true);
});

const SECRET_RPC_PATH = '/v2/SYNTHETIC_RPC_SECRET_123';
const unavailable = 'The chain request failed (SERVER_ERROR: bad response). Check the RPC connection and retry.';

test('chain checks, block searches, and log scans report a live RPC failure without its URL or reply', async (t) => {
  // A keyed endpoint that refuses the request and echoes the key, as some RPC services do.
  const server = http.createServer((request, response) => {
    request.resume().on('end', () => response.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: `invalid key ${request.url}` })));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const provider = new ethers.providers.StaticJsonRpcProvider(`http://127.0.0.1:${server.address().port}${SECRET_RPC_PATH}`, 11155420);
  for (const attempt of [
    () => checkRegistryChain(provider, 11155420),
    () => findStartBlock(provider, 1, 4),
    () => scanRegistryLogs({ provider, filter: {}, cursor: { block: 0, offset: 0 }, toBlock: 4 }),
  ]) await assert.rejects(attempt(), (error) => {
    assert.equal(error.message, unavailable);
    assert.deepEqual({ ...error }, { code: 'SERVER_ERROR', retryable: true });
    return true;
  });
});

test('log scans narrow the range on raw limit errors but throw only sanitized errors', async () => {
  let requests = 0;
  const provider = { getLogs: async () => {
    requests += 1;
    throw ethers.logger.makeError('bad response', ethers.errors.SERVER_ERROR, {
      body: '{"error":{"message":"query returned more than 10000 results"}}', url: `https://rpc.example.invalid${SECRET_RPC_PATH}`,
    });
  } };
  await assert.rejects(scanRegistryLogs({ provider, filter: {}, cursor: { block: 0, offset: 0 }, toBlock: 3 }), (error) => {
    assert.equal(error.message, unavailable);
    return true;
  });
  assert.equal(requests, 3);
});
