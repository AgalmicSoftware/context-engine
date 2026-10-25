import test from 'node:test';
import assert from 'node:assert/strict';
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
