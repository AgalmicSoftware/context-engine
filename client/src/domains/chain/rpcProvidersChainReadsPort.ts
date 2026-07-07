import type { BigNumberish } from 'ethers';
import * as rpcProviders from '../../utilities/web3/rpcProviders.js';

export type RpcProviderChainId = number;
export type NativeBalanceWei = BigNumberish;

type RpcReadProvider = {
  getBlockNumber: () => Promise<number>;
  getBalance: (address: string) => Promise<NativeBalanceWei>;
};

type RpcProvidersReadsModule = {
  getReadProviderForChain: (chainId: RpcProviderChainId) => RpcReadProvider;
};

export type RpcProvidersChainReadsPort = {
  getLatestBlockNumberForChain: (chainId: RpcProviderChainId) => Promise<number>;
  getNativeBalanceWeiForChain: (chainId: RpcProviderChainId, address: string) => Promise<NativeBalanceWei>;
};

type BindRpcProvidersChainReadsPortArgs = {
  rpcProviders: () => RpcProvidersReadsModule;
};

export const bindRpcProvidersChainReadsPort = ({
  rpcProviders: readRpcProviders,
}: BindRpcProvidersChainReadsPortArgs): RpcProvidersChainReadsPort => ({
  getLatestBlockNumberForChain: (chainId) => readRpcProviders().getReadProviderForChain(chainId).getBlockNumber(),
  getNativeBalanceWeiForChain: (chainId, address) =>
    readRpcProviders().getReadProviderForChain(chainId).getBalance(address),
});

const readRealRpcProviders = (): RpcProvidersReadsModule => ({
  getReadProviderForChain: (chainId) => rpcProviders.getReadProviderForChain(chainId) as RpcReadProvider,
});

export const rpcProvidersChainReadsPort = bindRpcProvidersChainReadsPort({
  rpcProviders: readRealRpcProviders,
});
