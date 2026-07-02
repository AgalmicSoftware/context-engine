import { bindChainScanReadsPort } from './contractScriptsChainScanReadsPort';

describe('ChainScanReadsPort', () => {
  it('routes chain reads through call-time contractScripts lookup', async () => {
    const firstProvider = { getTransactionReceipt: jest.fn() };
    const secondProvider = { getTransactionReceipt: jest.fn() };
    const firstContractScripts = {
      getLatestBlockNumber: jest.fn(async () => 10),
      getRelevantBlockWindowForFilter: jest.fn(async () => ({ fromBlock: 1, toBlock: 10 })),
      getReadProviderForSession: jest.fn(() => firstProvider),
    };
    const secondContractScripts = {
      getLatestBlockNumber: jest.fn(async () => 20),
      getRelevantBlockWindowForFilter: jest.fn(async () => ({ fromBlock: 11, toBlock: 20 })),
      getReadProviderForSession: jest.fn(() => secondProvider),
    };
    let currentContractScripts = firstContractScripts;
    const port = bindChainScanReadsPort({
      contractScripts: () => currentContractScripts,
    });

    await expect(port.getLatestBlockNumber('none', 'alpha')).resolves.toBe(10);
    await expect(port.getLatestBlockNumber(undefined, 'fallback-session')).resolves.toBe(10);

    currentContractScripts = secondContractScripts;

    await expect(port.getRelevantBlockWindowForFilter('beta', { strict: true }))
      .resolves.toEqual({ fromBlock: 11, toBlock: 20 });
    expect(port.getReadProviderForSession('beta')).toBe(secondProvider);

    expect(firstContractScripts.getLatestBlockNumber).toHaveBeenCalledWith('none', 'alpha');
    expect(firstContractScripts.getLatestBlockNumber).toHaveBeenCalledWith(undefined, 'fallback-session');
    expect(secondContractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledWith('beta', { strict: true });
    expect(secondContractScripts.getReadProviderForSession).toHaveBeenCalledWith('beta');
  });
});
