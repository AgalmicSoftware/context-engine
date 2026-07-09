import chainGateway from '../../utilities/web3/chainGateway.js';

export type ChainBlockWindow = {
  fromBlock: number;
  toBlock: number;
};

export type ChainReadProvider = {
  getTransactionReceipt: (transactionHash: string) => Promise<{ blockNumber?: number | null } | null | undefined>;
};

export type ChainProviderRef = string | undefined;

type ChainScanReadsChainGateway = {
  getLatestBlockNumber: (providerName: ChainProviderRef, groupKeyOrCfg?: unknown) => Promise<number>;
  getRelevantBlockWindowForFilter: (
    groupKeyOrCfg?: unknown,
    options?: Record<string, unknown>,
  ) => Promise<ChainBlockWindow>;
  getReadProviderForSession?: (sessionSlug: string) => ChainReadProvider | null | undefined;
};

export type ChainScanReadsPort = {
  getLatestBlockNumber: (providerName: ChainProviderRef, groupKeyOrCfg?: unknown) => Promise<number>;
  getRelevantBlockWindowForFilter: (
    groupKeyOrCfg?: unknown,
    options?: Record<string, unknown>,
  ) => Promise<ChainBlockWindow>;
  getReadProviderForSession: (sessionSlug: string) => ChainReadProvider | null | undefined;
};

type BindChainScanReadsPortArgs = {
  chainGateway: () => ChainScanReadsChainGateway;
};

export const bindChainScanReadsPort = ({
  chainGateway: readChainGateway,
}: BindChainScanReadsPortArgs): ChainScanReadsPort => ({
  getLatestBlockNumber: (providerName, groupKeyOrCfg) =>
    readChainGateway().getLatestBlockNumber(providerName, groupKeyOrCfg),
  getRelevantBlockWindowForFilter: (groupKeyOrCfg, options) =>
    options === undefined
      ? readChainGateway().getRelevantBlockWindowForFilter(groupKeyOrCfg)
      : readChainGateway().getRelevantBlockWindowForFilter(groupKeyOrCfg, options),
  getReadProviderForSession: (sessionSlug) => readChainGateway().getReadProviderForSession?.(sessionSlug) ?? null,
});

export const chainScanReadsPort = bindChainScanReadsPort({
  chainGateway: () => chainGateway,
});
