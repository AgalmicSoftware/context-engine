import contractScripts from '../../utilities/web3/contractScripts.js';

export type ChainBlockWindow = {
  fromBlock: number;
  toBlock: number;
};

export type ChainReadProvider = {
  getTransactionReceipt: (
    transactionHash: string
  ) => Promise<{ blockNumber?: number | null } | null | undefined>;
};

type ChainScanReadsContractScripts = {
  getLatestBlockNumber: (
    providerName: string,
    groupKeyOrCfg?: unknown
  ) => Promise<number>;
  getRelevantBlockWindowForFilter: (
    groupKeyOrCfg?: unknown,
    options?: Record<string, unknown>
  ) => Promise<ChainBlockWindow>;
  getReadProviderForSession?: (
    sessionSlug: string
  ) => ChainReadProvider | null | undefined;
};

export type ChainScanReadsPort = {
  getLatestBlockNumber: (
    providerName: string,
    groupKeyOrCfg?: unknown
  ) => Promise<number>;
  getRelevantBlockWindowForFilter: (
    groupKeyOrCfg?: unknown,
    options?: Record<string, unknown>
  ) => Promise<ChainBlockWindow>;
  getReadProviderForSession: (
    sessionSlug: string
  ) => ChainReadProvider | null | undefined;
};

type BindChainScanReadsPortArgs = {
  contractScripts: () => ChainScanReadsContractScripts;
};

export const bindChainScanReadsPort = ({
  contractScripts: readContractScripts,
}: BindChainScanReadsPortArgs): ChainScanReadsPort => ({
  getLatestBlockNumber: (providerName, groupKeyOrCfg) => (
    readContractScripts().getLatestBlockNumber(providerName, groupKeyOrCfg)
  ),
  getRelevantBlockWindowForFilter: (groupKeyOrCfg, options) => (
    options === undefined
      ? readContractScripts().getRelevantBlockWindowForFilter(groupKeyOrCfg)
      : readContractScripts().getRelevantBlockWindowForFilter(groupKeyOrCfg, options)
  ),
  getReadProviderForSession: (sessionSlug) => (
    readContractScripts().getReadProviderForSession?.(sessionSlug) ?? null
  ),
});

export const chainScanReadsPort = bindChainScanReadsPort({
  contractScripts: () => contractScripts,
});
