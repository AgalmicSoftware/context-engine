import { __test__resetRpcReadCache, evictExpiredEntries, wrapEthersJsonRpcSend } from './rpcReadCache.js';

const getCache = () => globalThis.__CE_RPC_READ_CACHE__;
const RPC_META = Object.freeze({
  chainId: 84532,
  providerKey: 'base-sepolia-test',
  url: 'https://rpc.test.invalid',
});
const LOG_ADDRESS = '0x00000000000000000000000000000000000000aa';

const createWrappedProvider = (sendImpl) => {
  const originalSend = jest.fn(sendImpl);
  const provider = { send: originalSend };
  wrapEthersJsonRpcSend(provider, RPC_META);
  return { originalSend, provider };
};

describe('rpcReadCache evictExpiredEntries', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    delete globalThis.CE_RPC_CACHE_DISABLED;
    delete globalThis.ENABLE_RPC_DEBUG_STATS;
    delete globalThis.ENABLE_RPC_DEBUG_TRACE;
    delete globalThis.__CE_RPC_READ_CACHE__;
    evictExpiredEntries();
    __test__resetRpcReadCache();
  });

  afterEach(() => {
    __test__resetRpcReadCache();
    delete globalThis.CE_RPC_CACHE_DISABLED;
    delete globalThis.ENABLE_RPC_DEBUG_STATS;
    delete globalThis.ENABLE_RPC_DEBUG_TRACE;
    delete globalThis.__CE_RPC_READ_CACHE__;
    jest.restoreAllMocks();
  });

  it('removes entries where expiresAt is before Date.now()', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);

    const cache = getCache();
    cache.cacheByMethod.eth_call.set('expired-call', { value: 'call', expiresAt: 999 });
    cache.cacheByMethod.eth_call.set('fresh-call', { value: 'call-fresh', expiresAt: 1_001 });
    cache.cacheByMethod.eth_getLogs.set('expired-logs', { value: 'logs', expiresAt: 500 });

    expect(evictExpiredEntries()).toBe(2);
    expect(Array.from(cache.cacheByMethod.eth_call.keys())).toEqual(['fresh-call']);
    expect(Array.from(cache.cacheByMethod.eth_getLogs.keys())).toEqual([]);
  });

  it('keeps entries where expiresAt is after Date.now()', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);

    const cache = getCache();
    cache.cacheByMethod.eth_blockNumber.set('fresh-block', { value: '0x10', expiresAt: 1_001 });
    cache.cacheByMethod.eth_chainId.set('fresh-chain', { value: '0x14a34', expiresAt: 2_000 });

    expect(evictExpiredEntries()).toBe(0);
    expect(Array.from(cache.cacheByMethod.eth_blockNumber.keys())).toEqual(['fresh-block']);
    expect(Array.from(cache.cacheByMethod.eth_chainId.keys())).toEqual(['fresh-chain']);
  });

  it('treats safe-to-numeric eth_getLogs filters as short-lived instead of immutable', async () => {
    let now = 1_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    let callCount = 0;
    const { originalSend, provider } = createWrappedProvider(async () => ({ id: ++callCount }));
    const filter = { fromBlock: 'safe', toBlock: '0x10', topics: [] };

    await expect(provider.send('eth_getLogs', [filter])).resolves.toEqual({ id: 1 });

    now = 4_100;

    await expect(provider.send('eth_getLogs', [{ ...filter }])).resolves.toEqual({ id: 2 });
    expect(originalSend).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      'single-address arrays to the same key as a plain address',
      { address: LOG_ADDRESS, fromBlock: '0x1', toBlock: '0x1', topics: [] },
      { address: [LOG_ADDRESS], fromBlock: '0x1', toBlock: '0x1', topics: [] },
    ],
    [
      'empty-address arrays to the same key as a missing address',
      { address: [], fromBlock: '0x1', toBlock: '0x1', topics: [] },
      { fromBlock: '0x1', toBlock: '0x1', topics: [] },
    ],
    [
      'missing block tags to the same key as explicit latest tags',
      { address: LOG_ADDRESS, topics: [] },
      { address: LOG_ADDRESS, fromBlock: 'latest', toBlock: 'latest', topics: [] },
    ],
  ])('normalizes eth_getLogs cache keys for %s', async (_label, firstFilter, secondFilter) => {
    let callCount = 0;
    const { originalSend, provider } = createWrappedProvider(async () => ({ id: ++callCount }));

    await expect(provider.send('eth_getLogs', [firstFilter])).resolves.toEqual({ id: 1 });
    await expect(provider.send('eth_getLogs', [secondFilter])).resolves.toEqual({ id: 1 });

    expect(originalSend).toHaveBeenCalledTimes(1);
  });
});
