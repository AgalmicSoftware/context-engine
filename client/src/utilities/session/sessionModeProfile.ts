import { STORAGE_BACKENDS, normalizeStorageBackend } from '../storage/storageRefs.js';
import {
  SESSION_STORAGE_PAYLOAD_ACCESS_GATES,
  SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES,
  deriveLegacyPayloadAccessMode,
  normalizeSessionStoragePayloadAccessControl,
} from '../storage/sessionStorageConfig.js';

type UnknownRecord = Record<string, unknown>;

export const SESSION_MODE_PROFILE_VERSION = 1 as const;
export const SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID = 11155420;

export const SESSION_MODE_PRESET_IDS = Object.freeze({
  FAST_CHEAP_CLOUDFLARE: 'fast_cheap_cloudflare',
  TRUSTLESS_PUBLIC_DECENTRALIZED: 'trustless_public_decentralized',
  CUSTOM: 'custom',
} as const);

export type SessionModePresetId = (typeof SESSION_MODE_PRESET_IDS)[keyof typeof SESSION_MODE_PRESET_IDS];

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

const SESSION_MODE_RESOURCE_KEYS: SessionModeResourceKey[] = [
  'docsContext',
  'questions',
  'surveys',
  'responses',
  'generatedArtifacts',
  'media',
  'images',
];

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const trim = (value: unknown): string => String(value ?? '').trim();
const lower = (value: unknown): string => trim(value).toLowerCase();

const normalizeModeValue = (value: unknown): string => lower(value);

const normalizeMatch = (value: unknown): 'any' | 'all' => (normalizeModeValue(value) === 'all' ? 'all' : 'any');

const normalizeAnyOrAll = (value: unknown): 'any' | 'all' => (normalizeModeValue(value) === 'all' ? 'all' : 'any');

export const normalizeSessionModeAccessConditions = (value: unknown): SessionModeAccessConditionDocument | null => {
  const raw = isRecord(value) ? value : {};
  const conditions = Array.isArray(raw.conditions) ? raw.conditions : [];
  const normalized = conditions
    .filter(isRecord)
    .map((condition) => {
      const kind = normalizeModeValue(condition.kind);
      if (kind === 'worker_role') {
        return { kind, role: trim(condition.role || 'admin') || 'admin' };
      }
      if (kind === 'sbt_onchain') {
        return {
          kind,
          chainId: normalizeRegistryChainId(condition.chainId || condition.networkChainId) || 0,
          contract: trim(condition.contract || condition.address),
          anyOrAll: normalizeAnyOrAll(condition.anyOrAll || condition.mode || condition.match),
        };
      }
      if (kind === 'agent_grant_scope') {
        return { kind, scope: trim(condition.scope || condition.value) };
      }
      return null;
    })
    .filter((condition): condition is SessionModeAccessConditionDocument['conditions'][number] => !!condition);
  return {
    match: normalizeMatch(raw.match),
    conditions: normalized,
  };
};

export const hasLegacyTelegramFirstSessionFlags = (metadata: unknown): boolean => {
  const config = isRecord(metadata) ? metadata : {};
  const telegramConfig = isRecord(config.telegram) ? config.telegram : {};
  return (
    config.telegramOnly === true ||
    config.telegram_only === true ||
    normalizeModeValue(config.sessionMode) === 'telegram_only' ||
    normalizeModeValue(config.telegramMode) === 'telegram_only' ||
    telegramConfig.only === true ||
    normalizeModeValue(telegramConfig.mode) === 'telegram_only'
  );
};

export const isSessionModeProfileTelegramFirst = (metadata: unknown): boolean => {
  const config = isRecord(metadata) ? metadata : {};
  const profile = isRecord(config.sessionModeProfile)
    ? config.sessionModeProfile
    : isRecord(metadata) && isRecord(metadata.authority)
      ? metadata
      : null;
  if (!profile) return false;
  const authority = isRecord(profile.authority) ? profile.authority : {};
  const surfaces = isRecord(profile.surfaces) ? profile.surfaces : {};
  return authority.mode === 'worker_canonical' && surfaces.telegram === true;
};

const resourceStagesForBackend = (
  backend: SessionModeStorageBackend,
  resources: SessionModeProfile['storage']['resources'] = {},
): Record<SessionModeResourceKey, string> => {
  const defaultStage = backend === 'cloudflare' ? 'active' : 'staged';
  return SESSION_MODE_RESOURCE_KEYS.reduce<Record<SessionModeResourceKey, string>>(
    (acc, key) => {
      const stage = resources?.[key]?.stage;
      acc[key] = stage === 'active' || stage === 'staged' ? stage : key === 'docsContext' ? 'active' : defaultStage;
      return acc;
    },
    {} as Record<SessionModeResourceKey, string>,
  );
};

const normalizeExposure = (
  exposure: SessionModeProfile['results']['exposure'] | undefined,
): CompiledSessionModeProfile['resultsExposure'] => ({
  aggregateResultsEnabled: exposure?.aggregateResultsEnabled !== false,
  anonymizedGroupsEnabled: exposure?.anonymizedGroupsEnabled === true,
  minGroupSize: Math.max(2, Math.floor(Number(exposure?.minGroupSize || 2) || 2)),
});

const hasParticipantGate = (profile: SessionModeProfile): boolean =>
  profile.storage.backend === 'cloudflare' ||
  profile.authorization.mechanisms.some(
    (mechanism) =>
      mechanism === 'sbt_onchain' ||
      mechanism === 'worker_groups' ||
      mechanism === 'evm_address_allowlist' ||
      mechanism === 'agent_grant',
  );

const resolveProfilePayloadAccessControl = (
  profile: SessionModeProfile,
): CompiledSessionModeProfile['payloadAccessControl'] => {
  const explicitStorageAccess = isRecord(profile.storage.payloadAccessControl)
    ? normalizeSessionStoragePayloadAccessControl(profile.storage.payloadAccessControl)
    : null;
  const encryption =
    profile.encryption.mode === 'lit'
      ? SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT
      : profile.encryption.mode === 'worker_envelope'
        ? SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE
        : SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.NONE;
  const gate =
    encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT
      ? SESSION_STORAGE_PAYLOAD_ACCESS_GATES.NONE
      : explicitStorageAccess?.gate ||
        (hasParticipantGate(profile)
          ? SESSION_STORAGE_PAYLOAD_ACCESS_GATES.SBT_GATE
          : SESSION_STORAGE_PAYLOAD_ACCESS_GATES.NONE);
  const accessConditions = normalizeSessionModeAccessConditions(
    profile.encryption.accessConditions || profile.storage.payloadAccessControl?.accessConditions,
  );
  return {
    gate,
    encryption,
    ...(accessConditions?.conditions.length ? { accessConditions } : {}),
  };
};

export const SESSION_MODE_PRESETS: Readonly<Record<Exclude<SessionModePresetId, 'custom'>, SessionModeProfile>> =
  Object.freeze({
    fast_cheap_cloudflare: {
      profileVersion: SESSION_MODE_PROFILE_VERSION,
      preset: SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE,
      authority: { mode: 'worker_canonical' },
      evm: { registryChainId: null },
      storage: {
        backend: 'cloudflare',
        // Regression guard: the default has no registry/RPC. Keep admin access and
        // authenticated participant storage explicit instead of falling back to SBT.
        payloadAccessControl: {
          gate: 'role_gate',
          encryption: 'worker_envelope',
          accessConditions: {
            match: 'any',
            conditions: [
              { kind: 'worker_role', role: 'admin' },
              { kind: 'agent_grant_scope', scope: 'storage' },
            ],
          },
        },
      },
      identity: { default: 'passkey', enabled: ['passkey'] },
      authorization: { mechanisms: ['worker_roles'] },
      encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
      surfaces: {
        web: true,
        telegram: false,
        miniApp: false,
        agentHttp: false,
        mcp: false,
        ceCc: false,
      },
      results: {
        visibility: 'participant_aggregate',
        exposure: {
          aggregateResultsEnabled: true,
          anonymizedGroupsEnabled: false,
          minGroupSize: 2,
        },
      },
      export: { scope: 'admin_raw' },
    },
    trustless_public_decentralized: {
      profileVersion: SESSION_MODE_PROFILE_VERSION,
      preset: SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
      authority: { mode: 'evm_registry_canonical' },
      evm: { registryChainId: SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID },
      storage: { backend: 'arweave' },
      identity: { default: 'wallet', enabled: ['wallet', 'passkey'] },
      authorization: { mechanisms: ['sbt_onchain'] },
      encryption: { mode: 'none' },
      surfaces: {
        web: true,
        telegram: false,
        miniApp: false,
        agentHttp: false,
        mcp: false,
        ceCc: false,
      },
      results: {
        visibility: 'public_full_if_storage_public',
        exposure: {
          aggregateResultsEnabled: true,
          anonymizedGroupsEnabled: false,
          minGroupSize: 2,
        },
      },
      export: { scope: 'all_session' },
    },
  });

export const cloneSessionModePreset = (preset: Exclude<SessionModePresetId, 'custom'>): SessionModeProfile =>
  deepClone(SESSION_MODE_PRESETS[preset]);

export const mergeSessionModeProfileStorageAccess = (
  profile: SessionModeProfile,
  storageProfile: unknown,
): SessionModeProfile => {
  const next = deepClone(profile);
  if (!isRecord(storageProfile) || !trim(storageProfile.backend)) return next;
  const storage = isRecord(storageProfile) ? storageProfile : {};
  const backend = normalizeStorageBackend(storage.backend);
  if (backend === STORAGE_BACKENDS.CLOUDFLARE && isRecord(storage.payloadAccessControl)) {
    const accessControl = normalizeSessionStoragePayloadAccessControl(storage.payloadAccessControl);
    next.storage = {
      ...next.storage,
      payloadAccessControl: {
        gate: accessControl.gate,
        encryption: accessControl.encryption,
        ...(isRecord(storage.payloadAccessControl) && isRecord(storage.payloadAccessControl.accessConditions)
          ? {
              accessConditions:
                normalizeSessionModeAccessConditions(storage.payloadAccessControl.accessConditions) || undefined,
            }
          : {}),
      },
    };
  } else if (next.storage?.payloadAccessControl) {
    next.storage = { ...next.storage };
    delete next.storage.payloadAccessControl;
  }
  return next;
};

export const validateSessionModeProfile = (
  profile: SessionModeProfile,
  _opts: { enableWorkerEnvelope?: boolean } = {},
): { valid: boolean; issues: SessionModeProfileValidationIssue[] } => {
  const issues: SessionModeProfileValidationIssue[] = [];
  const addIssue = (path: string, code: string, message: string) => {
    issues.push({ path, code, message });
  };

  if (!profile || profile.profileVersion !== SESSION_MODE_PROFILE_VERSION) {
    addIssue('profileVersion', 'invalid_profile_version', 'Session mode profile must use profileVersion 1.');
  }
  if (profile.authority?.mode === 'org_private_chain') {
    addIssue('authority.mode', 'reserved', 'Private-chain authority is reserved for a later implementation.');
  }
  if (profile.encryption?.mode === 'worker_envelope' && profile.storage?.backend !== 'cloudflare') {
    addIssue(
      'encryption.mode',
      'worker_envelope_requires_cloudflare',
      'Worker envelope encryption is available only with Cloudflare storage.',
    );
  }
  if (
    profile.encryption?.mode === 'worker_envelope' &&
    profile.encryption?.keyProvider &&
    profile.encryption.keyProvider !== 'worker_secret'
  ) {
    addIssue(
      'encryption.keyProvider',
      'reserved',
      'Only the worker_secret key provider is implemented for worker envelope encryption.',
    );
  }
  if (profile.encryption?.mode === 'lit' && profile.authority?.mode === 'org_private_chain') {
    addIssue('encryption.mode', 'lit_private_chain_invalid', 'Lit encryption cannot evaluate private-chain state.');
  }
  if (profile.encryption?.mode === 'lit' && profile.evm?.registryChainId == null) {
    addIssue('evm.registryChainId', 'lit_requires_registry_chain', 'Lit encryption requires a registry chain id.');
  }
  const accessConditions = normalizeSessionModeAccessConditions(profile.encryption?.accessConditions);
  if (profile.encryption?.mode === 'worker_envelope' && accessConditions?.conditions.length) {
    accessConditions.conditions.forEach((condition, index) => {
      if (condition.kind === 'worker_role' && !trim(condition.role)) {
        addIssue(
          `encryption.accessConditions.conditions.${index}.role`,
          'worker_role_required',
          'Worker role conditions require a role.',
        );
      }
      if (condition.kind === 'agent_grant_scope' && !trim(condition.scope)) {
        addIssue(
          `encryption.accessConditions.conditions.${index}.scope`,
          'agent_grant_scope_required',
          'Agent grant conditions require a scope.',
        );
      }
      if (condition.kind === 'sbt_onchain') {
        if (!profile.evm?.registryChainId) {
          addIssue(
            'evm.registryChainId',
            'sbt_condition_requires_registry_chain',
            'SBT envelope conditions require a registry chain id.',
          );
        }
        if (!condition.chainId) {
          addIssue(
            `encryption.accessConditions.conditions.${index}.chainId`,
            'sbt_condition_chain_required',
            'SBT envelope conditions require a chain id.',
          );
        }
        if (!trim(condition.contract)) {
          addIssue(
            `encryption.accessConditions.conditions.${index}.contract`,
            'sbt_condition_contract_required',
            'SBT envelope conditions require a contract address.',
          );
        }
      }
    });
  }
  if (profile.export?.scope === 'encrypted_envelopes_only' && profile.encryption?.mode === 'none') {
    addIssue('export.scope', 'encrypted_export_requires_encryption', 'Encrypted-envelope export requires encryption.');
  }
  const mechanisms = Array.isArray(profile.authorization?.mechanisms) ? profile.authorization.mechanisms : [];
  if (
    mechanisms.length === 1 &&
    mechanisms[0] === 'telegram_account_role' &&
    ['admin_raw', 'all_session', 'selected_surfaces', 'encrypted_envelopes_only'].includes(profile.export?.scope)
  ) {
    addIssue(
      'authorization.mechanisms',
      'telegram_role_cannot_be_sole_admin_export_gate',
      'Telegram account role cannot be the only admin or export gate.',
    );
  }
  if (profile.surfaces?.web !== true) {
    addIssue('surfaces.web', 'web_surface_fixed_on', 'The web surface is fixed on in v1.');
  }

  return { valid: issues.length === 0, issues };
};

export const compileSessionModeProfile = (profile: SessionModeProfile): CompiledSessionModeProfile => {
  const storageBackend =
    profile.storage.backend === 'cloudflare' ? STORAGE_BACKENDS.CLOUDFLARE : STORAGE_BACKENDS.ARWEAVE;
  const payloadAccessControl = resolveProfilePayloadAccessControl(profile);
  const payloadAccessMode = deriveLegacyPayloadAccessMode(payloadAccessControl);
  const storageProfile: UnknownRecord = {
    type: 'session_storage_profile',
    version: 'session-storage-profile-v1',
    backend: storageBackend,
    sessionOwned: true,
    telegramOwned: false,
    resources: resourceStagesForBackend(profile.storage.backend, profile.storage.resources),
  };

  if (storageBackend === STORAGE_BACKENDS.CLOUDFLARE) {
    storageProfile.payloadAccessControl = {
      gate: payloadAccessControl.gate,
      encryption: payloadAccessControl.encryption,
      ...(payloadAccessControl.accessConditions
        ? { accessConditions: deepClone(payloadAccessControl.accessConditions) }
        : {}),
    };
    storageProfile.cloudflare = { payloadAccessMode };
  }

  return {
    storageProfile,
    payloadAccessControl,
    payloadAccessMode,
    authorityMode: profile.authority.mode,
    telegramBridgeEnabled: profile.surfaces.telegram === true,
    miniAppEnabled: profile.surfaces.miniApp === true,
    agentHttpEnabled: profile.surfaces.agentHttp === true,
    resultsExposure: normalizeExposure(profile.results.exposure),
    exportScope: profile.export.scope,
    exportSurfaceFilter: Array.isArray(profile.export.surfaceFilter) ? [...profile.export.surfaceFilter] : [],
  };
};

const normalizeRegistryChainId = (value: unknown): number | null => {
  const chainId = Number(value || 0);
  return Number.isFinite(chainId) && chainId > 0 ? chainId : null;
};

export const profileFromLegacyConfig = (sessionConfig: unknown): SessionModeProfile => {
  const config = isRecord(sessionConfig) ? sessionConfig : {};
  const storageProfile = isRecord(config.storageProfile)
    ? config.storageProfile
    : isRecord(config.sessionStorageProfile)
      ? config.sessionStorageProfile
      : {};
  const normalizedBackend = normalizeStorageBackend(storageProfile.backend || config.storageBackend || config.storage);
  if (hasLegacyTelegramFirstSessionFlags(config)) {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.surfaces.telegram = true;
    profile.surfaces.miniApp = true;
    profile.surfaces.web = true;
    return profile;
  }

  const profile = cloneSessionModePreset(
    normalizedBackend === STORAGE_BACKENDS.CLOUDFLARE
      ? SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE
      : SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
  );
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.evm.registryChainId = normalizeRegistryChainId(
    config.registryChainId || config.networkChainId || (isRecord(config.evm) ? config.evm.registryChainId : null),
  );

  if (normalizedBackend === STORAGE_BACKENDS.LIT_ARWEAVE) {
    profile.storage.backend = 'arweave';
    profile.encryption = { mode: 'lit' };
  } else if (normalizedBackend === STORAGE_BACKENDS.CLOUDFLARE) {
    profile.authority.mode = 'worker_canonical';
    profile.storage.backend = 'cloudflare';
    const access = normalizeSessionStoragePayloadAccessControl(storageProfile);
    profile.storage.payloadAccessControl = {
      gate: access.gate,
      encryption: access.encryption,
    };
    // Mode switches replace, rather than merge, mode-specific key metadata.
    // Carrying worker_secret into Lit/none profiles misstates the decrypt path.
    profile.encryption =
      access.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE
        ? { mode: 'worker_envelope', keyProvider: 'worker_secret' }
        : access.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT
          ? { mode: 'lit' }
          : { mode: 'none' };
    if (
      isRecord(storageProfile.payloadAccessControl) &&
      isRecord(storageProfile.payloadAccessControl.accessConditions)
    ) {
      const accessConditions = normalizeSessionModeAccessConditions(
        storageProfile.payloadAccessControl.accessConditions,
      );
      if (accessConditions?.conditions.length) profile.encryption.accessConditions = accessConditions;
    }
  } else {
    profile.authority.mode = 'evm_registry_canonical';
    profile.storage.backend = 'arweave';
    profile.encryption = { mode: 'none' };
  }

  return profile;
};
