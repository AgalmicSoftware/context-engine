import chainGateway from '../../utilities/web3/chainGateway.js';
import { chainScanReadsPort } from './chainScanReadsPort';

describe('ChainScanReadsPort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes chain reads through call-time chainGateway property lookup', async () => {
    const getLatestBlockNumber = jest.spyOn(chainGateway, 'getLatestBlockNumber').mockResolvedValue(10);
    const getRelevantBlockWindowForFilter = jest
      .spyOn(chainGateway, 'getRelevantBlockWindowForFilter')
      .mockResolvedValue({ fromBlock: 11, toBlock: 20 });

    await expect(chainScanReadsPort.getLatestBlockNumber('none', 'alpha')).resolves.toBe(10);
    await expect(chainScanReadsPort.getLatestBlockNumber(undefined, 'fallback-session')).resolves.toBe(10);
    await expect(chainScanReadsPort.getRelevantBlockWindowForFilter('beta', { strict: true })).resolves.toEqual({
      fromBlock: 11,
      toBlock: 20,
    });
    expect(chainScanReadsPort.getReadProviderForSession('beta')).toBeNull();

    expect(getLatestBlockNumber).toHaveBeenCalledWith('none', 'alpha');
    expect(getLatestBlockNumber).toHaveBeenCalledWith(undefined, 'fallback-session');
    expect(getRelevantBlockWindowForFilter).toHaveBeenCalledWith('beta', { strict: true });
  });
});
