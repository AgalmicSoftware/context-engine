export type SbtListRuntimeRecord = Record<string, unknown>;

export type SbtListBlockWindow = SbtListRuntimeRecord & {
  toBlock?: unknown;
};

export type SbtGroupPasswordHashReader = {
  getGroupPasswordHash: (
    providerName: string,
    sbtAddress: string,
    groupKeyOrCfg?: unknown,
    options?: unknown
  ) => Promise<unknown>;
};

export type SbtRelevantBlockWindowReader = {
  getRelevantBlockWindowForFilter: (
    scopeRef: unknown
  ) => Promise<SbtListBlockWindow | unknown>;
};

export type SbtListContractScriptsBoundary =
  SbtGroupPasswordHashReader &
  SbtRelevantBlockWindowReader;

export type HasCachedCreateSbtFormReader = (
  options?: SbtListRuntimeRecord
) => boolean;

type SbtListRuntimePortGetter = () => unknown;

type BindSbtListRuntimePortsArgs = {
  contractScripts: SbtListRuntimePortGetter;
  hasCachedCreateSbtForm: SbtListRuntimePortGetter;
};

export type SbtListRuntimePorts = {
  contractScripts: SbtListContractScriptsBoundary;
  hasCachedCreateSbtForm: HasCachedCreateSbtFormReader;
};

export const bindSbtListRuntimePorts = ({
  contractScripts,
  hasCachedCreateSbtForm,
}: BindSbtListRuntimePortsArgs): SbtListRuntimePorts => {
  const readContractScripts = (): SbtListContractScriptsBoundary => (
    contractScripts() as unknown as SbtListContractScriptsBoundary
  );
  const readHasCachedCreateSbtForm = (): HasCachedCreateSbtFormReader => (
    hasCachedCreateSbtForm() as unknown as HasCachedCreateSbtFormReader
  );

  return {
    contractScripts: {
      getGroupPasswordHash: (providerName, sbtAddress, groupKeyOrCfg, options) => (
        readContractScripts().getGroupPasswordHash(
          providerName,
          sbtAddress,
          groupKeyOrCfg,
          options
        )
      ),
      getRelevantBlockWindowForFilter: (scopeRef) => (
        readContractScripts().getRelevantBlockWindowForFilter(scopeRef)
      ),
    },
    hasCachedCreateSbtForm: (options) => readHasCachedCreateSbtForm()(options),
  };
};
