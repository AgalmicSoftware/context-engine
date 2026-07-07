export type AnyRecord = Record<string, any>;

export type ChainIdLike = number | string | null | undefined;

export type NetworkLike =
  | {
      id?: ChainIdLike;
      chainId?: ChainIdLike;
      [key: string]: any;
    }
  | null
  | undefined;

export type SessionContractLike = {
  address?: string;
  contractAddress?: string;
  chainId?: ChainIdLike;
  [key: string]: any;
};

export type SessionContractsLike = Record<string, SessionContractLike>;

export type SessionConfigLike = AnyRecord & {
  slug?: string;
  sessionSlug?: string;
  networkChainId?: ChainIdLike;
  lit?: AnyRecord;
  __registry?: AnyRecord;
  sponsored?: AnyRecord;
  contracts?: SessionContractsLike;
};

export type WorkerSecretsLike = Record<string, string | null | undefined>;

export type WorkerSecretsRefLike =
  | {
      current?: WorkerSecretsLike | null;
    }
  | null
  | undefined;

export type WorkerSecretSyncResult = {
  warning: string;
  note: string;
  synced: boolean;
  deferred?: boolean;
  skipped?: boolean;
  attempts?: number;
};

export type ContractViewerAddressLike = {
  address: string;
  id?: number;
  testnet?: boolean;
  explorerUrl?: string;
};

export type ContractViewerContractLike = {
  key: string;
  name: string;
  explainer?: any;
  sourceFile?: string;
  source?: string;
  extraAction?: any;
  addresses?: ContractViewerAddressLike[];
};

export type ResolveSessionConfigBySlug = (slug: string) => SessionConfigLike | null | undefined;

export type ResolveSessionConfigById = (sessionId: string | number) => SessionConfigLike | null | undefined;

export type SessionResolutionResult = {
  sessionSlug: string;
  sessionConfig: SessionConfigLike | null;
  scopedSessionSlugs?: string[];
  networkId?: number | null;
  networkIdStr?: string;
  networkSourceSlug?: string;
  [key: string]: any;
};
