import { __test__resetRpcReadCache, evictExpiredEntries, wrapEthersJsonRpcSend } from './rpcReadCache.js';

const getCache = () => globalThis.__CE_RPC_READ_CACHE__;
const RPC_META = Object.freeze({
  chainId: 84532,
  providerKey: 'base-sepolia-test',
  url: 'https://rpc.test.invalid',
});
const LOG_ADDRESS = '0x00000000000000000000000000000000000000aa';

const createWrappedProvider = (sendImpl, meta = RPC_META) => {
  const originalSend = jest.fn(sendImpl);
  const provider = { send: originalSend };
  wrapEthersJsonRpcSend(provider, meta);
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

  it('backs off an endpoint exponentially after HTTP 429s instead of issuing more sends', async () => {
    let now = 10_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    let callCount = 0;
    const { originalSend, provider } = createWrappedProvider(async () => {
      callCount += 1;
      if (callCount <= 2) {
        throw Object.assign(new Error('Too Many Requests'), { status: 429 });
      }
      return '0x14a34';
    });

    await expect(provider.send('eth_blockNumber', [])).rejects.toMatchObject({ status: 429 });

    let state = Array.from(getCache().rateLimits.values())[0];
    expect(state.retryAfterMs).toBe(60000);

    await expect(provider.send('eth_getBalance', [LOG_ADDRESS, 'latest'])).rejects.toMatchObject({
      code: 'CE_RPC_RATE_LIMIT_BACKOFF',
      status: 429,
    });
    expect(originalSend).toHaveBeenCalledTimes(1);

    now += state.retryAfterMs + 1;
    await expect(provider.send('eth_getBalance', [LOG_ADDRESS, 'latest'])).rejects.toMatchObject({ status: 429 });

    state = Array.from(getCache().rateLimits.values())[0];
    expect(state.retryAfterMs).toBe(120000);

    await expect(provider.send('eth_chainId', [])).rejects.toMatchObject({
      code: 'CE_RPC_RATE_LIMIT_BACKOFF',
      status: 429,
    });
    expect(originalSend).toHaveBeenCalledTimes(2);

    now += state.retryAfterMs + 1;
    await expect(provider.send('eth_chainId', [])).resolves.toBe('0x14a34');

    expect(originalSend).toHaveBeenCalledTimes(3);
    expect(Array.from(getCache().rateLimits.values())).toEqual([]);
  });

  it('shields neighboring in-flight endpoint reads after the first request records a 429', async () => {
    let rejectFirst;
    let callCount = 0;
    const { originalSend, provider } = createWrappedProvider(async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise((_, reject) => {
          rejectFirst = reject;
        });
      }
      return '0x14a34';
    });

    const first = provider.send('eth_blockNumber', []);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = provider.send('eth_getBalance', [LOG_ADDRESS, 'latest']);
    await Promise.resolve();

    rejectFirst(Object.assign(new Error('Too Many Requests'), { status: 429 }));

    await expect(first).rejects.toMatchObject({ status: 429 });
    await expect(second).rejects.toMatchObject({
      code: 'CE_RPC_RATE_LIMIT_BACKOFF',
      status: 429,
    });
    expect(originalSend).toHaveBeenCalledTimes(1);
  });

  it('keeps a slow neighboring request behind the endpoint probe before applying 429 backoff', async () => {
    jest.useFakeTimers();
    let rejectFirst;
    const { originalSend, provider } = createWrappedProvider(async () => {
      if (originalSend.mock.calls.length === 1) {
        return new Promise((_, reject) => {
          rejectFirst = reject;
        });
      }
      return '0x14a34';
    });

    const first = provider.send('eth_blockNumber', []);
    await Promise.resolve();
    const second = provider.send('eth_getBalance', [LOG_ADDRESS, 'latest']);
    await Promise.resolve();

    jest.advanceTimersByTime(501);
    await Promise.resolve();
    expect(originalSend).toHaveBeenCalledTimes(1);

    rejectFirst(Object.assign(new Error('Too Many Requests'), { status: 429 }));
    await expect(first).rejects.toMatchObject({ status: 429 });
    await expect(second).rejects.toMatchObject({
      code: 'CE_RPC_RATE_LIMIT_BACKOFF',
      status: 429,
    });
    expect(originalSend).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('lets fallback callers skip a cooling-down primary endpoint without another network send', async () => {
    const primary = createWrappedProvider(async () => {
      throw Object.assign(new Error('Too Many Requests'), { status: 429 });
    });
    const secondary = createWrappedProvider(async () => '0x14a34', {
      ...RPC_META,
      url: 'https://rpc-fallback.test.invalid',
    });
    const requestWithFallback = async () => {
      try {
        return await primary.provider.send('eth_getBalance', [LOG_ADDRESS, 'latest']);
      } catch (_) {
        return secondary.provider.send('eth_getBalance', [LOG_ADDRESS, 'latest']);
      }
    };

    await expect(requestWithFallback()).resolves.toBe('0x14a34');
    await expect(requestWithFallback()).resolves.toBe('0x14a34');

    expect(primary.originalSend).toHaveBeenCalledTimes(1);
    expect(secondary.originalSend).toHaveBeenCalledTimes(2);
  });
});
