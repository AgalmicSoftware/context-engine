import {
  SESSION_STORAGE_PAYLOAD_ACCESS_GATES,
  SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES,
} from '../storage/sessionStorageConfig.js';

export type UnknownRecord = Record<string, unknown>;

export type SessionModePresetId = 'fast_cheap_cloudflare' | 'trustless_public_decentralized' | 'custom';

export type SessionModeAuthorityMode =
  'worker_canonical' | 'worker_with_public_anchor' | 'evm_registry_canonical' | 'org_private_chain';

export type SessionModeStorageBackend = 'cloudflare' | 'arweave';
export type SessionModeResourceKey =
  'docsContext' | 'questions' | 'surveys' | 'responses' | 'generatedArtifacts' | 'media' | 'images';

export type SessionModeIdentityMethod = 'passkey' | 'wallet' | 'telegram' | 'agent_grant';
export type SessionModeAuthorizationMechanism =
  'worker_roles' | 'worker_groups' | 'sbt_onchain' | 'evm_address_allowlist' | 'telegram_account_role' | 'agent_grant';
export type SessionModeEncryptionMode = 'none' | 'lit' | 'worker_envelope';
export type SessionModeKeyProvider = 'worker_secret' | 'cloudflare_secrets_store' | 'external_kms';
export type SessionModeSurface = 'web' | 'telegram' | 'miniApp' | 'agentHttp' | 'mcp' | 'ceCc';
export type SessionModeResultsVisibility =
  | 'private_admin'
  | 'participant_aggregate'
  | 'session_member_aggregate'
  | 'public_redacted_snapshot'
  | 'public_full_if_storage_public';
export type SessionModeExportScope = 'admin_raw' | 'all_session' | 'selected_surfaces' | 'encrypted_envelopes_only';
export type SessionModeAccessConditionDocument = {
  match: 'any' | 'all';
  conditions: Array<
    | { kind: 'worker_role'; role: string }
    | { kind: 'sbt_onchain'; chainId: number; contract: string; anyOrAll: 'any' | 'all' }
    | { kind: 'agent_grant_scope'; scope: string }
  >;
};

export type SessionModeProfile = {
  profileVersion: 1;
  preset: SessionModePresetId;
  authority: { mode: SessionModeAuthorityMode };
  evm: { registryChainId: number | null };
  storage: {
    backend: SessionModeStorageBackend;
    payloadAccessControl?: {
      gate?: (typeof SESSION_STORAGE_PAYLOAD_ACCESS_GATES)[keyof typeof SESSION_STORAGE_PAYLOAD_ACCESS_GATES];
      encryption?: (typeof SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES)[keyof typeof SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES];
      mode?: string;
      accessConditions?: SessionModeAccessConditionDocument;
    };
    resources?: Partial<
      Record<
        SessionModeResourceKey,
        {
          stage: 'active' | 'staged';
          backendOverride?: string;
        }
      >
    >;
    mirrors?: string[];
  };
  identity: {
    default: Exclude<SessionModeIdentityMethod, 'agent_grant'>;
    enabled: SessionModeIdentityMethod[];
  };
  authorization: {
    mechanisms: SessionModeAuthorizationMechanism[];
  };
  encryption: {
    mode: SessionModeEncryptionMode;
    keyProvider?: SessionModeKeyProvider;
    accessConditions?: SessionModeAccessConditionDocument;
  };
  surfaces: Record<SessionModeSurface, boolean>;
  results: {
    visibility: SessionModeResultsVisibility;
    exposure?: {
      aggregateResultsEnabled: boolean;
      anonymizedGroupsEnabled: boolean;
      minGroupSize: number;
    };
  };
  export: {
    scope: SessionModeExportScope;
    surfaceFilter?: SessionModeSurface[];
  };
};

export type SessionModeProfileValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type SessionModeProfileSupportStatus = 'reachable' | 'schema_only' | 'unavailable' | 'invalid';

export type SessionModeProfileSupportClassification = {
  status: SessionModeProfileSupportStatus;
  validation: {
    valid: boolean;
    issues: SessionModeProfileValidationIssue[];
  };
};

export type CompiledSessionModeProfile = {
  storageProfile: UnknownRecord;
  payloadAccessControl: {
    gate: (typeof SESSION_STORAGE_PAYLOAD_ACCESS_GATES)[keyof typeof SESSION_STORAGE_PAYLOAD_ACCESS_GATES];
    encryption: (typeof SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES)[keyof typeof SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES];
    accessConditions?: SessionModeAccessConditionDocument;
  };
  payloadAccessMode: string;
  authorityMode: SessionModeAuthorityMode;
  telegramBridgeEnabled: boolean;
  miniAppEnabled: boolean;
  agentHttpEnabled: boolean;
  resultsExposure: {
    aggregateResultsEnabled: boolean;
    anonymizedGroupsEnabled: boolean;
    minGroupSize: number;
  };
  exportScope: SessionModeExportScope;
  exportSurfaceFilter: SessionModeSurface[];
};
