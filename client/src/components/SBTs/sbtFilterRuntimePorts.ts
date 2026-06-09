import type {
  UnknownRecord,
} from './sbtFilterHelpers';

export type SbtFilterCacheWriter = (
  namespace: string,
  slug: string,
  value: unknown
) => Promise<unknown>;

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

type BindSbtFilterRuntimePortsArgs = {
  contractScripts: unknown;
  writeCache: unknown;
};

export type SbtFilterRuntimePorts = {
  contractScripts: SbtFilterContractScriptsBoundary;
  writeCache: SbtFilterCacheWriter;
};

export const bindSbtFilterRuntimePorts = ({
  contractScripts,
  writeCache,
}: BindSbtFilterRuntimePortsArgs): SbtFilterRuntimePorts => ({
  contractScripts: contractScripts as unknown as SbtFilterContractScriptsBoundary,
  writeCache: writeCache as unknown as SbtFilterCacheWriter,
});
