const { resolveSbtRealtimeEventBlockNumber } = require('./sbtRealtimeEventBlockResolver.js');

const createDeps = (overrides = {}) => ({
  getReadProviderForSession: jest.fn(() => null),
  getRelevantBlockWindowForFilter: jest.fn(async () => ({ fromBlock: 10, toBlock: 42 })),
  log: {
    error: jest.fn(),
    warn: jest.fn(),
  },
  slug: 'alpha',
  ...overrides,
});

describe('resolveSbtRealtimeEventBlockNumber', () => {
  it('uses the event block number when present', async () => {
    const deps = createDeps();

    await expect(
      resolveSbtRealtimeEventBlockNumber({
        ...deps,
        event: { blockNumber: 20 },
      }),
    ).resolves.toBe(20);

    expect(deps.getReadProviderForSession).not.toHaveBeenCalled();
    expect(deps.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
  });

  it('resolves the block from a transaction receipt when a read provider is available', async () => {
    const readProvider = {
      getTransactionReceipt: jest.fn(async () => ({ blockNumber: 30 })),
    };
    const deps = createDeps({
      getReadProviderForSession: jest.fn(() => readProvider),
    });

    await expect(
      resolveSbtRealtimeEventBlockNumber({
        ...deps,
        event: { transactionHash: '0xabc' },
      }),
    ).resolves.toBe(30);

    expect(deps.getReadProviderForSession).toHaveBeenCalledWith('alpha');
    expect(readProvider.getTransactionReceipt).toHaveBeenCalledWith('0xabc');
    expect(deps.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
  });

  it('falls back to the current block window when receipt lookup fails', async () => {
    const error = new Error('receipt failed');
    const readProvider = {
      getTransactionReceipt: jest.fn(async () => {
        throw error;
      }),
    };
    const deps = createDeps({
      getReadProviderForSession: jest.fn(() => readProvider),
    });

    await expect(
      resolveSbtRealtimeEventBlockNumber({
        ...deps,
        event: { transactionHash: '0xabc' },
      }),
    ).resolves.toBe(42);

    expect(deps.log.error).toHaveBeenCalledWith(
      'Failed to get block number from transaction hash for SBT event',
      error,
    );
    expect(deps.getRelevantBlockWindowForFilter).toHaveBeenCalledWith('alpha');
  });

  it('falls back to the block window when no read provider is available', async () => {
    const deps = createDeps();

    await expect(
      resolveSbtRealtimeEventBlockNumber({
        ...deps,
        event: { transactionHash: '0xabc' },
      }),
    ).resolves.toBe(42);

    expect(deps.getRelevantBlockWindowForFilter).toHaveBeenCalledWith('alpha');
  });

  it('logs provider lookup errors and falls back to the block window', async () => {
    const error = new Error('provider failed');
    const deps = createDeps({
      getReadProviderForSession: jest.fn(() => {
        throw error;
      }),
    });

    await expect(
      resolveSbtRealtimeEventBlockNumber({
        ...deps,
        event: { transactionHash: '0xabc' },
      }),
    ).resolves.toBe(42);

    expect(deps.log.warn).toHaveBeenCalledWith('MainSite: fallback', error);
    expect(deps.getRelevantBlockWindowForFilter).toHaveBeenCalledWith('alpha');
  });

  it('falls back to the block window when the event has no block or transaction hash', async () => {
    const deps = createDeps();

    await expect(
      resolveSbtRealtimeEventBlockNumber({
        ...deps,
        event: {},
      }),
    ).resolves.toBe(42);

    expect(deps.getRelevantBlockWindowForFilter).toHaveBeenCalledWith('alpha');
  });
});
