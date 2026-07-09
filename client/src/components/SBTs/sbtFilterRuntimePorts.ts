import type { UnknownRecord } from './sbtFilterHelpers';

export type SbtFilterCacheWriter = (namespace: string, slug: string, value: unknown) => Promise<unknown>;

export type SbtMintBurnCountsResult = UnknownRecord & {
  burnedAddresses?: unknown;
  burnedCountByAddress?: unknown;
  mintedAddresses?: unknown;
  mintedCountByAddress?: unknown;
  ok?: unknown;
};

export type SbtFilterContractScriptsBoundary = {
  getSbtMintBurnCountsByAddress: (...args: unknown[]) => Promise<SbtMintBurnCountsResult>;
};

type SbtFilterRuntimePortGetter = () => unknown;

type BindSbtFilterRuntimePortsArgs = {
  contractScripts: SbtFilterRuntimePortGetter;
  writeCache: SbtFilterRuntimePortGetter;
};

export type SbtFilterRuntimePorts = {
  contractScripts: SbtFilterContractScriptsBoundary;
  writeCache: SbtFilterCacheWriter;
};

export const bindSbtFilterRuntimePorts = ({
  contractScripts,
  writeCache,
}: BindSbtFilterRuntimePortsArgs): SbtFilterRuntimePorts => {
  const readContractScripts = (): SbtFilterContractScriptsBoundary =>
    contractScripts() as unknown as SbtFilterContractScriptsBoundary;
  const readWriteCache = (): SbtFilterCacheWriter => writeCache() as unknown as SbtFilterCacheWriter;

  return {
    contractScripts: {
      getSbtMintBurnCountsByAddress: (...args) => readContractScripts().getSbtMintBurnCountsByAddress(...args),
    },
    writeCache: (namespace, slug, value) => readWriteCache()(namespace, slug, value),
  };
};
