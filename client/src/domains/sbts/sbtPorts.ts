export type SbtGroupKeyOrConfig = unknown;

export type SbtReadOptions = {
  allowInjectedReadFallback?: boolean;
  [key: string]: unknown;
};

export type SbtMetadataRecord = Record<string, unknown>;

export type SbtMetadataReadsPort = {
  getSbtMetadata: (
    providerName: string,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig
  ) => Promise<SbtMetadataRecord | null | undefined>;
  getMintedTokens: (
    providerName: string,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
    options?: SbtReadOptions
  ) => Promise<unknown>;
  getGroupPasswordHash: (
    providerName: string,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
    options?: SbtReadOptions
  ) => Promise<string | null>;
};
