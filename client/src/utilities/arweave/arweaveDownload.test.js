import { ethers } from 'ethers';
import { createArweaveDownloadOps } from './arweaveDownload';
import { createContractScriptsCache } from '../cache/contractScriptsCache';
import { initCacheManager, removeCache } from '../cache/cacheScripts';

const groupKeyOrCfg = { slug: 'refresh-fixture', networkChainId: 11155420, contracts: {} };
const cache = createContractScriptsCache({
  resolveSession: () => groupKeyOrCfg,
  normalizeSessionSlug: (value) => String(value || ''),
  getSessionAddresses: () => ({}),
  shouldBypassSessionScopeWindow: () => false,
  sessionRegistryStore: { getSessionConfig: () => null },
  sessionRegistryUtils: {
    toRegistrySlug: (value) => value,
    getRegistryContract: () => null,
    upsertSessionRegistryCache: () => {},
  },
  DEFAULT_CHAIN_ID: 11155420,
  contractsLog: { warn: () => {} },
  parsePositiveBlockNumber: (value) => Number(value) || null,
  ethers,
});
const ops = createArweaveDownloadOps(cache);
const options = {
  gateways: ['https://gateway.example.test'],
  retries: 0,
  disableExistencePrecheck: true,
  includeRawRoute: false,
  includeTxDataRoute: false,
  useWayfinder: false,
};
const response = (body, status = 200) => ({
  ok: status === 200,
  status,
  text: async () => body,
  headers: { get: () => 'application/json' },
});
const read = (txId, arweaveOpts = {}) =>
  ops.downloadArweaveTextForGroup({ txId, groupKeyOrCfg, arweaveOpts: { ...options, ...arweaveOpts } });

beforeAll(() => initCacheManager());
beforeEach(async () => {
  globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = false;
  global.fetch = jest.fn();
  await removeCache('questionsCache', groupKeyOrCfg.slug);
  cache.clearReadCachesForGroup(groupKeyOrCfg);
});
afterAll(async () => {
  delete globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO;
  await removeCache('questionsCache', groupKeyOrCfg.slug);
});

test('a forced refresh fetches healthy metadata after cached malformed text', async () => {
  global.fetch.mockResolvedValueOnce(response('{bad')).mockResolvedValueOnce(response('{"title":"Recovered"}'));
  expect(await read('forced-recovery')).toBe('{bad');
  expect(JSON.parse(await read('forced-recovery', { cacheBypass: true }))).toEqual({ title: 'Recovered' });
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('invalid JSON is evicted from both caches and the next ordinary read recovers', async () => {
  global.fetch.mockResolvedValueOnce(response('{bad')).mockResolvedValueOnce(response('{"title":"Recovered"}'));
  expect(await read('ordinary-recovery')).toBe('{bad');
  await ops.recordTerminalArweaveInvalidFailure({ txId: 'ordinary-recovery', groupKeyOrCfg, message: 'Invalid JSON' });
  expect(await cache.readArweaveTxCacheEntry({ txId: 'ordinary-recovery', groupKeyOrCfg })).toBeNull();
  expect(JSON.parse(await read('ordinary-recovery'))).toEqual({ title: 'Recovered' });
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('ordinary good reads stay cached', async () => {
  global.fetch.mockResolvedValue(response('{"title":"Cached"}'));
  expect(await read('normal-cache')).toBe(await read('normal-cache'));
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('a forced refresh does not reuse either layer of an in-flight request', async () => {
  let release;
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  global.fetch
    .mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    })
    .mockResolvedValue(response('{"fresh":true}'));
  const earlier = read('inflight-refresh');
  await ready;
  const fresh = read('inflight-refresh', { cacheBypass: true });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const count = global.fetch.mock.calls.length;
  release(response('{"old":true}'));
  expect(await fresh).toBe('{"fresh":true}');
  await earlier;
  expect(count).toBe(2);
});

test('a forced refresh bypasses both layers of failure cooldowns', async () => {
  global.fetch.mockResolvedValueOnce(response('Unavailable', 503)).mockResolvedValue(response('{"recovered":true}'));
  await expect(read('failure-refresh')).rejects.toThrow();
  expect(await read('failure-refresh', { cacheBypass: true })).toBe('{"recovered":true}');
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('a forced refresh does not read unavailable persistent caches', async () => {
  const unavailable = jest.fn(async () => {
    throw new Error('Cache unavailable');
  });
  const forced = createArweaveDownloadOps({
    ...cache,
    readArweaveTxCacheEntry: unavailable,
    readArweaveTxFailureCacheEntry: unavailable,
  });
  global.fetch.mockResolvedValue(response('{"fresh":true}'));
  expect(
    await forced.downloadArweaveTextForGroup({
      txId: 'unavailable-cache',
      groupKeyOrCfg,
      arweaveOpts: { ...options, cacheBypass: true },
    }),
  ).toBe('{"fresh":true}');
  expect(unavailable).not.toHaveBeenCalled();
});
