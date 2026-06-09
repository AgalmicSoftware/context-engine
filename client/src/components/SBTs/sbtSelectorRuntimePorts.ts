export type UnknownRecord = Record<string, unknown>;

export type SbtSelectorLogMethod = (...args: unknown[]) => void;

export type SbtSelectorLogger = UnknownRecord & {
  log: SbtSelectorLogMethod;
};

export type EnsureLightSbtUniverse = (
  slugs: string[],
  options?: { forceExactSlugs?: boolean }
) => unknown;

export type SbtDisplayNameTargetedArgs = {
  address?: unknown;
  addresses?: unknown;
  chainId?: unknown;
  metadataLookupConfig?: unknown;
  preferredSlug?: unknown;
  writeBack?: boolean;
};

export type SbtDisplayNameTargetedResult = UnknownRecord & {
  address?: unknown;
  image?: unknown;
  info?: UnknownRecord | null;
  name?: unknown;
};

export type ResolveSbtDisplayLabelArgs = {
  address?: unknown;
  fallback?: string;
  preferredSlug?: unknown;
  sbtInfo?: unknown;
};

export type ResolveSbtDisplayLabelTyped = (
  args: ResolveSbtDisplayLabelArgs
) => unknown;

export type HydrateSbtDisplayNameTargeted = (
  args?: SbtDisplayNameTargetedArgs
) => Promise<SbtDisplayNameTargetedResult | null>;

export type WarmSbtDisplayNamesTargeted = (
  args?: SbtDisplayNameTargetedArgs
) => Promise<SbtDisplayNameTargetedResult[] | null | undefined>;

export type WriteCacheTyped = (
  namespace: string,
  slug?: string,
  value?: unknown
) => Promise<unknown>;

export type ContractScriptsSbtAddressLoader = UnknownRecord & {
  getAllSbtAddressesCached: (
    mode: unknown,
    discoveryRef: unknown,
    options?: {
      onDiscoveredAddresses?: (payload?: { addresses?: unknown }) => void;
    }
  ) => Promise<unknown>;
};

type BindSbtSelectorRuntimePortsArgs = {
  contractScripts: unknown;
  hydrateSbtDisplayNameTargeted: unknown;
  logger: unknown;
  resolveSbtDisplayLabel: unknown;
  warmSbtDisplayNamesTargeted: unknown;
  writeCache: unknown;
};

export type SbtSelectorRuntimePorts = {
  contractScripts: ContractScriptsSbtAddressLoader;
  hydrateSbtDisplayNameTargeted: HydrateSbtDisplayNameTargeted;
  logger: SbtSelectorLogger;
  resolveSbtDisplayLabel: ResolveSbtDisplayLabelTyped;
  warmSbtDisplayNamesTargeted: WarmSbtDisplayNamesTargeted;
  writeCache: WriteCacheTyped;
};

export const bindSbtSelectorRuntimePorts = ({
  contractScripts,
  hydrateSbtDisplayNameTargeted,
  logger,
  resolveSbtDisplayLabel,
  warmSbtDisplayNamesTargeted,
  writeCache,
}: BindSbtSelectorRuntimePortsArgs): SbtSelectorRuntimePorts => ({
  contractScripts: contractScripts as unknown as ContractScriptsSbtAddressLoader,
  hydrateSbtDisplayNameTargeted: hydrateSbtDisplayNameTargeted as unknown as HydrateSbtDisplayNameTargeted,
  logger: logger as unknown as SbtSelectorLogger,
  resolveSbtDisplayLabel: resolveSbtDisplayLabel as unknown as ResolveSbtDisplayLabelTyped,
  warmSbtDisplayNamesTargeted: warmSbtDisplayNamesTargeted as unknown as WarmSbtDisplayNamesTargeted,
  writeCache: writeCache as unknown as WriteCacheTyped,
});

export const isEnsureLightSbtUniverse = (value: unknown): value is EnsureLightSbtUniverse => (
  typeof value === 'function'
);
