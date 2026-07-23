import { STORAGE_BACKENDS, normalizeStorageBackend } from '../storage/storageRefs.js';
import {
  SESSION_STORAGE_PAYLOAD_ACCESS_GATES,
  SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES,
  normalizeSessionStoragePayloadAccessControl,
} from '../storage/sessionStorageConfig.js';
import { normalizeSessionModeAccessConditions } from './sessionModeAccessConditions';
import type {
  CompiledSessionModeProfile,
  SessionModePresetId,
  SessionModeProfile,
  SessionModeResourceKey,
  SessionModeStorageBackend,
} from './sessionModeProfileTypes';

type UnknownRecord = Record<string, unknown>;

export const SESSION_MODE_PROFILE_VERSION = 1 as const;
export const SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID = 11155420;
export const SESSION_MODE_PRESET_IDS = Object.freeze({
  FAST_CHEAP_CLOUDFLARE: 'fast_cheap_cloudflare',
  TRUSTLESS_PUBLIC_DECENTRALIZED: 'trustless_public_decentralized',
  CUSTOM: 'custom',
} as const);

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

export const resourceStagesForBackend = (
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

export const normalizeExposure = (
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

export const resolveProfilePayloadAccessControl = (
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
    const accessControl = normalizeSessionStoragePayloadAccessControl(storage);
    const accessConditions = isRecord(storage.payloadAccessControl.accessConditions)
      ? normalizeSessionModeAccessConditions(storage.payloadAccessControl.accessConditions)
      : undefined;
    next.storage = {
      ...next.storage,
      payloadAccessControl: {
        gate: accessControl.gate,
        encryption: accessControl.encryption,
        ...(accessConditions ? { accessConditions } : {}),
      },
    };
    if (accessControl.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE) {
      next.encryption = {
        mode: 'worker_envelope',
        keyProvider:
          next.encryption.mode === 'worker_envelope' && next.encryption.keyProvider
            ? next.encryption.keyProvider
            : 'worker_secret',
      };
    } else if (accessControl.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT) {
      next.encryption = { mode: 'lit' };
    } else {
      next.encryption = { mode: 'none' };
    }
  } else if (backend !== STORAGE_BACKENDS.CLOUDFLARE && next.storage?.payloadAccessControl) {
    next.storage = { ...next.storage };
    delete next.storage.payloadAccessControl;
  }
  return next;
};
