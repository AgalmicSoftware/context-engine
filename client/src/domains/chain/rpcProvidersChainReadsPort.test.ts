import type { BigNumberish } from 'ethers';
import { bindRpcProvidersChainReadsPort } from './rpcProvidersChainReadsPort';

describe('RpcProvidersChainReadsPort', () => {
  it('reads latest block and native balance through purpose-specific methods', async () => {
    const latestBlock = 12345678;
    const balanceWei: BigNumberish = '420000000000000000';
    const provider = {
      getBlockNumber: jest.fn(async () => latestBlock),
      getBalance: jest.fn(async () => balanceWei),
      providerMarker: 'low-level-provider',
    };
    const getReadProviderForChain = jest.fn(() => provider);
    const port = bindRpcProvidersChainReadsPort({
      rpcProviders: () => ({ getReadProviderForChain }),
    });

    await expect(port.getLatestBlockNumberForChain(11155420)).resolves.toBe(latestBlock);
    await expect(port.getNativeBalanceWeiForChain(84532, '0xabc')).resolves.toBe(balanceWei);

    expect(getReadProviderForChain).toHaveBeenNthCalledWith(1, 11155420);
    expect(getReadProviderForChain).toHaveBeenNthCalledWith(2, 84532);
    expect(provider.getBlockNumber).toHaveBeenCalledTimes(1);
    expect(provider.getBalance).toHaveBeenCalledWith('0xabc');
    expect(port).not.toHaveProperty('getReadProviderForChain');
    expect(port).not.toHaveProperty('provider');
  });
});
