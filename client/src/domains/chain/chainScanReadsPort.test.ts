import { bindChainScanReadsPort } from './chainScanReadsPort';

describe('ChainScanReadsPort', () => {
  it('routes chain reads through call-time chainGateway lookup', async () => {
    const firstProvider = { getTransactionReceipt: jest.fn() };
    const secondProvider = { getTransactionReceipt: jest.fn() };
    const firstChainGateway = {
      getLatestBlockNumber: jest.fn(async () => 10),
      getRelevantBlockWindowForFilter: jest.fn(async () => ({ fromBlock: 1, toBlock: 10 })),
      getReadProviderForSession: jest.fn(() => firstProvider),
    };
    const secondChainGateway = {
      getLatestBlockNumber: jest.fn(async () => 20),
      getRelevantBlockWindowForFilter: jest.fn(async () => ({ fromBlock: 11, toBlock: 20 })),
      getReadProviderForSession: jest.fn(() => secondProvider),
    };
    let currentChainGateway = firstChainGateway;
    const port = bindChainScanReadsPort({
      chainGateway: () => currentChainGateway,
    });

    await expect(port.getLatestBlockNumber('none', 'alpha')).resolves.toBe(10);
    await expect(port.getLatestBlockNumber(undefined, 'fallback-session')).resolves.toBe(10);

    currentChainGateway = secondChainGateway;

    await expect(port.getRelevantBlockWindowForFilter('beta', { strict: true })).resolves.toEqual({
      fromBlock: 11,
      toBlock: 20,
    });
    expect(port.getReadProviderForSession('beta')).toBe(secondProvider);

    expect(firstChainGateway.getLatestBlockNumber).toHaveBeenCalledWith('none', 'alpha');
    expect(firstChainGateway.getLatestBlockNumber).toHaveBeenCalledWith(undefined, 'fallback-session');
    expect(secondChainGateway.getRelevantBlockWindowForFilter).toHaveBeenCalledWith('beta', { strict: true });
    expect(secondChainGateway.getReadProviderForSession).toHaveBeenCalledWith('beta');
  });
});
