import chainGateway from '../../utilities/web3/chainGateway.js';

export type ChainBlockWindow = {
  fromBlock: number;
  toBlock: number;
};

export type ChainReadProvider = {
  getTransactionReceipt: (transactionHash: string) => Promise<{ blockNumber?: number | null } | null | undefined>;
};

export type ChainProviderRef = string | undefined;

export type ChainScanReadsPort = {
  getLatestBlockNumber: (providerName: ChainProviderRef, groupKeyOrCfg?: unknown) => Promise<number>;
  getRelevantBlockWindowForFilter: (
    groupKeyOrCfg?: unknown,
    options?: Record<string, unknown>,
  ) => Promise<ChainBlockWindow>;
  getReadProviderForSession: (sessionSlug: string) => ChainReadProvider | null | undefined;
};

export const chainScanReadsPort: ChainScanReadsPort = {
  getLatestBlockNumber: (providerName, groupKeyOrCfg) =>
    chainGateway.getLatestBlockNumber(providerName, groupKeyOrCfg),
  getRelevantBlockWindowForFilter: (groupKeyOrCfg, options) =>
    options === undefined
      ? chainGateway.getRelevantBlockWindowForFilter(groupKeyOrCfg)
      : chainGateway.getRelevantBlockWindowForFilter(groupKeyOrCfg, options),
  getReadProviderForSession: (sessionSlug) => chainGateway.getReadProviderForSession?.(sessionSlug) ?? null,
};
