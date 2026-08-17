export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonRecord;
export type JsonRecord = { [key: string]: JsonValue };
export type UnknownRecord = { [key: string]: unknown };

export interface AgentSessionWrappedCapability {
  version: 1;
  enabled: boolean;
  origin: string;
  protocolVersion: string;
  revision: string;
  verifiedAt: string;
}

export interface SessionIdentity {
  slug: string;
  sessionId: string;
  metadataURI: string;
  chainId: number | null;
}

export interface SessionGateConfig extends UnknownRecord {
  id?: string;
  gateId?: string;
  type?: string;
  label?: string;
  mode?: string;
  sbtAddress?: string;
  sbtAddresses?: string[];
  chainId?: number;
  litChain?: string;
}

export interface SessionContractRef extends UnknownRecord {
  address?: string;
  chainId?: number | string;
}

export interface SessionAppearance extends UnknownRecord {
  colorSchemeId?: string;
}

export type SessionContractsConfig = Record<string, SessionContractRef> & {
  sessionRegistry?: SessionContractRef;
  surveys?: SessionContractRef;
  sbtFactory?: SessionContractRef;
};

export interface SessionMetadata extends UnknownRecord {
  slug?: string;
  sessionName?: string;
  sessionInfo?: string;
  sessionEndsAt?: string;
  defaultTags?: string;
  defaultGroupTags?: string | string[];
  defaultSbtTags?: string;
  questionsGenPrompt?: string;
  defaultFilterState?: UnknownRecord | null;
  sessionInfoEncrypted?: string | JsonRecord | null;
  encryptedSessionInfo?: string | JsonRecord | null;
  orgName?: string;
  orgInfo?: string;
  orgInfoEncrypted?: string | JsonRecord | null;
  encryptedOrgInfo?: string | JsonRecord | null;
  tags?: string[];
  lit?: UnknownRecord;
  litNetwork?: string;
  gates?: SessionGateConfig[] | Record<string, SessionGateConfig>;
  sponsored?: UnknownRecord;
  sponsoredSbtAddress?: string;
  contracts?: SessionContractsConfig;
  blockLimits?: UnknownRecord;
  faucet?: UnknownRecord;
  ai?: UnknownRecord;
  agentSessionWrapped?: AgentSessionWrappedCapability;
  appearance?: SessionAppearance;
}

export interface RegistrySessionDetails extends UnknownRecord {
  sessionId?: string;
  sessionIdHex?: string;
  metadataURI?: string;
  chainId?: number | string;
  registryChainId?: number | string;
  updatedAt?: number | string;
}

export interface SessionConfig extends SessionMetadata {
  sessionId?: string;
  sessionIdHex?: string;
  metadataURI?: string;
  chainId?: number | string;
  networkChainId?: number | string;
  registryChainId?: number | string;
  __registry?: RegistrySessionDetails;
}

export interface RegistrySessionConfig extends SessionConfig {
  __registry?: RegistrySessionDetails;
}

export interface SessionWorkerConfig extends UnknownRecord {
  corsWorkerUrl: string;
  allowOrigins: string[];
  limits: UnknownRecord;
  rpcEndpoint: string;
  embeddedDeployHelperEnabled?: boolean;
  litCredentials?: UnknownRecord;
  workerAuthority?: UnknownRecord;
}

export interface SessionWorkerConfigFieldPresence {
  allowOrigins: boolean;
  limits: boolean;
  rpcEndpoint: boolean;
  embeddedDeployHelperEnabled: boolean;
}

export interface SessionWorkerConfigCacheRecord extends UnknownRecord {
  config: SessionWorkerConfig;
  cachedAtMs: number;
  writeNonce: number;
  slug: string;
  sessionIdHex: string;
  registryChainId: number | null;
  fieldPresence: SessionWorkerConfigFieldPresence;
}

export interface SessionWorkerConfigReplicaMeta extends UnknownRecord {
  applied: boolean;
  cachedConfig: SessionWorkerConfig | null;
  cachedAtMs: number | null;
  writeNonce: number;
  registryUpdatedAtMs: number | null;
  reason: string;
  sourceConfig: UnknownRecord | null;
}

export interface SessionWorkerConfigReplica extends SessionConfig {
  corsWorkerUrl?: string;
  allowOrigins?: string[];
  limits?: UnknownRecord;
  rpcEndpoint?: string;
  rpcUrl?: string;
  embeddedDeployHelperEnabled?: boolean;
  __workerConfigReplicaMeta?: SessionWorkerConfigReplicaMeta;
}

export interface LocalResourceOverrides {
  rpc: { useLocal: boolean; apiKey: string };
  arweave: { useLocal: boolean; jwk: string };
  faucet: { useLocal: boolean; privateKey: string };
}

export type SessionConfigLike = SessionConfig;
export type SessionMetadataRecord = SessionMetadata;
export type WorkerConfigRecord = SessionWorkerConfigCacheRecord;
