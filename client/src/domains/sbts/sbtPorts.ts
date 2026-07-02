export type SbtGroupKeyOrConfig = unknown;

export type SbtReadOptions = {
  allowInjectedReadFallback?: boolean;
  [key: string]: unknown;
};

export type SbtMetadataRecord = Record<string, unknown>;

export type SbtOnChainConfig = {
  maxTokens: unknown;
  collectionBurnAuth: unknown;
  mintingEndTime: unknown;
  hasPasswordMint: unknown;
  admin: unknown;
  owner: unknown;
};

export type SbtOnChainConfigFields = {
  maxTokens?: boolean;
  collectionBurnAuth?: boolean;
  mintingEndTime?: boolean;
  hasPasswordMint?: boolean;
  adminAndOwner?: boolean;
};

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
  getSbtOnChainConfig: (
    providerName: string,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
    fields?: SbtOnChainConfigFields
  ) => Promise<SbtOnChainConfig>;
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

export type SbtGroupPasswordHashInput = {
  password: string;
  sbtAddress: string | null;
  adminAddress?: string;
  chainId?: string | number;
  name?: string;
  symbol?: string;
  tokenURI?: string;
};

export type SbtGroupMintAuthorizationInput = {
  password: string;
  sbtAddress: string;
  userAddress: string;
  walletScopeSbtAddress?: string | null;
};

export type SbtInvitePayload = {
  nonce: string | number;
  signature: string;
  inviteCode: string;
};

export type SbtInvitePayloadsInput = {
  password: string;
  sbtAddress: string;
  nonces: Array<string | number>;
  walletScopeSbtAddress?: string | null;
};

export type SbtGroupMintAuthorizationPort = {
  computeGroupPasswordHash: (
    input: SbtGroupPasswordHashInput
  ) => string;
  signGroupMintAuthorization: (
    input: SbtGroupMintAuthorizationInput
  ) => Promise<string>;
  generateInvitePayloads: (
    input: SbtInvitePayloadsInput
  ) => Promise<SbtInvitePayload[]>;
};
