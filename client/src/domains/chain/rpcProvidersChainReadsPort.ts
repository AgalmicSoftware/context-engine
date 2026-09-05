import type { BigNumberish } from 'ethers';
import * as rpcProviders from '../../utilities/web3/rpcProviders.js';

export type RpcProviderChainId = number;
export type NativeBalanceWei = BigNumberish;

type RpcReadProvider = {
  getBlockNumber: () => Promise<number>;
  getBalance: (address: string) => Promise<NativeBalanceWei>;
};

export type RpcProvidersChainReadsPort = {
  getLatestBlockNumberForChain: (chainId: RpcProviderChainId) => Promise<number>;
  getNativeBalanceWeiForChain: (chainId: RpcProviderChainId, address: string) => Promise<NativeBalanceWei>;
};

export const rpcProvidersChainReadsPort: RpcProvidersChainReadsPort = {
  getLatestBlockNumberForChain: (chainId) =>
    (rpcProviders.getReadProviderForChain(chainId) as RpcReadProvider).getBlockNumber(),
  getNativeBalanceWeiForChain: (chainId, address) =>
    (rpcProviders.getReadProviderForChain(chainId) as RpcReadProvider).getBalance(address),
};
