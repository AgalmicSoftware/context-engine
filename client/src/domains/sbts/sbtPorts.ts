export type SbtGroupKeyOrConfig = unknown;

export type SbtReadOptions = {
  allowInjectedReadFallback?: boolean;
  [key: string]: unknown;
};

export type SbtMetadataRecord = Record<string, unknown>;

export type SbtTransactionResult = Record<string, unknown> & {
  transactionHash: string;
};

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

export type SbtMintExecutionPort = {
  claim: (
    providerName: string,
    sbtAddress: string
  ) => Promise<SbtTransactionResult>;
  claimWithInvite: (
    providerName: string,
    sbtAddress: string,
    nonce: string | number,
    signature: string
  ) => Promise<SbtTransactionResult>;
  mintWithGroupSignature: (
    providerName: string,
    sbtAddress: string,
    signature: string
  ) => Promise<SbtTransactionResult>;
};
