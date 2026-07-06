/** @file sessionStorageConfig.ts */

import {
  STORAGE_BACKENDS,
  normalizeStorageBackend,
} from './storageRefs.js';
import type { StorageBackend } from './storageRefs.js';
import { toStr } from '../shared/primitives.js';

type UnknownRecord = Record<string, unknown>;

const isObj = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);

export const SESSION_STORAGE_RESOURCE_STAGES = Object.freeze({
  ACTIVE: 'active',
  STAGED: 'staged',
} as const);

export const SESSION_STORAGE_PAYLOAD_ACCESS_MODES = Object.freeze({
  PUBLIC_READ: 'public_read',
  WORKER_SBT_GATE: 'worker_sbt_gate',
  LIT_ENCRYPTED: 'lit_encrypted',
} as const);

export const SESSION_STORAGE_PAYLOAD_ACCESS_GATES = Object.freeze({
  NONE: 'none',
  SBT_GATE: 'sbt_gate',
  GROUP_GATE: 'group_gate',
  ROLE_GATE: 'role_gate',
} as const);

export const SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES = Object.freeze({
  NONE: 'none',
  WORKER_ENVELOPE: 'worker_envelope',
  LIT: 'lit',
} as const);

type SessionStorageResourceStage = typeof SESSION_STORAGE_RESOURCE_STAGES[keyof typeof SESSION_STORAGE_RESOURCE_STAGES];
export type SessionStoragePayloadAccessMode = typeof SESSION_STORAGE_PAYLOAD_ACCESS_MODES[keyof typeof SESSION_STORAGE_PAYLOAD_ACCESS_MODES];
export type SessionStoragePayloadAccessGate = typeof SESSION_STORAGE_PAYLOAD_ACCESS_GATES[keyof typeof SESSION_STORAGE_PAYLOAD_ACCESS_GATES];
export type SessionStoragePayloadEncryptionMode = typeof SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES[keyof typeof SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES];

export interface SessionStoragePayloadAccessControl {
  gate: SessionStoragePayloadAccessGate;
  encryption: SessionStoragePayloadEncryptionMode;
  mode: SessionStoragePayloadAccessMode;
  accessConditions?: UnknownRecord;
}

interface SessionStorageResources extends Record<string, string> {
  docsContext: string;
  questions: string;
  surveys: string;
  responses: string;
  generatedArtifacts: string;
  media: string;
}

interface NormalizedSessionStorageConfig {
  backend: StorageBackend;
  resources: SessionStorageResources;
  payloadAccessControl: SessionStoragePayloadAccessControl;
}

interface ResolveSessionStorageBackendOptions {
  resource?: unknown;
  encrypted?: unknown;
}

const normalizePayloadAccessGate = (value: unknown, fallback: SessionStoragePayloadAccessGate = SESSION_STORAGE_PAYLOAD_ACCESS_GATES.SBT_GATE): SessionStoragePayloadAccessGate => {
  const normalized = toStr(value).trim().toLowerCase().replace(/-/g, '_');
  if (!normalized) return fallback;
  if (normalized === 'none' || normalized === 'public' || normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_GATES.NONE;
  }
  if (
    normalized === 'sbt' ||
    normalized === 'sbt_gate' ||
    normalized === 'worker_sbt' ||
    normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE
  ) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_GATES.SBT_GATE;
  }
  if (normalized === 'group' || normalized === 'group_gate' || normalized === 'worker_group') {
    return SESSION_STORAGE_PAYLOAD_ACCESS_GATES.GROUP_GATE;
  }
  if (normalized === 'role' || normalized === 'role_gate' || normalized === 'worker_role') {
    return SESSION_STORAGE_PAYLOAD_ACCESS_GATES.ROLE_GATE;
  }
  return fallback;
};

const normalizePayloadEncryptionMode = (
  value: unknown,
  fallback: SessionStoragePayloadEncryptionMode = SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.NONE
): SessionStoragePayloadEncryptionMode => {
  const raw = isObj(value) ? value.mode : value;
  const normalized = toStr(raw).trim().toLowerCase().replace(/-/g, '_');
  if (!normalized) return fallback;
  if (normalized === 'none' || normalized === 'plain' || normalized === 'plaintext') {
    return SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.NONE;
  }
  if (normalized === 'worker_envelope' || normalized === 'cloudflare_envelope') {
    return SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE;
  }
  if (normalized === 'lit' || normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED) {
    return SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT;
  }
  return fallback;
};

export const normalizeSessionStoragePayloadAccessMode = (value: unknown): SessionStoragePayloadAccessMode => {
  const normalized = toStr(value).trim().toLowerCase().replace(/-/g, '_');
  if (
    normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ ||
    normalized === 'public'
  ) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  }
  if (
    normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED ||
    normalized === 'lit' ||
    normalized === 'encrypted'
  ) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  }
  return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE;
};

export const deriveLegacyPayloadAccessMode = (
  accessControl: Pick<SessionStoragePayloadAccessControl, 'gate' | 'encryption'>
): SessionStoragePayloadAccessMode => {
  if (accessControl.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  }
  if (accessControl.gate === SESSION_STORAGE_PAYLOAD_ACCESS_GATES.NONE) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  }
  return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE;
};

export const normalizeSessionStoragePayloadAccessControl = (raw: unknown): SessionStoragePayloadAccessControl => {
  const rawRecord = isObj(raw) ? raw : {};
  const payloadAccessControl = rawRecord.payloadAccessControl as UnknownRecord | null | undefined;
  const cloudflare = rawRecord.cloudflare as { payloadAccessMode?: unknown } | null | undefined;
  const legacyMode = normalizeSessionStoragePayloadAccessMode(
    isObj(raw)
      ? (
        payloadAccessControl?.mode ||
        cloudflare?.payloadAccessMode ||
        rawRecord.payloadAccessMode ||
        rawRecord.accessControlMode
      )
      : raw
  );
  const fallbackGate = (
    legacyMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ ||
    legacyMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED
  )
    ? SESSION_STORAGE_PAYLOAD_ACCESS_GATES.NONE
    : SESSION_STORAGE_PAYLOAD_ACCESS_GATES.SBT_GATE;
  const fallbackEncryption = legacyMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED
    ? SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT
    : SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.NONE;
  const source = (
    isObj(raw) &&
    !Object.prototype.hasOwnProperty.call(rawRecord, 'payloadAccessControl') &&
    (
      Object.prototype.hasOwnProperty.call(rawRecord, 'gate') ||
      Object.prototype.hasOwnProperty.call(rawRecord, 'encryption')
    )
  ) ? rawRecord : payloadAccessControl;
  const gate = normalizePayloadAccessGate(
    isObj(source) ? source.gate : undefined,
    fallbackGate
  );
  const encryption = normalizePayloadEncryptionMode(
    isObj(source) ? source.encryption : undefined,
    fallbackEncryption
  );
  const accessConditions = isObj(source?.accessConditions)
    ? JSON.parse(JSON.stringify(source.accessConditions))
    : (isObj(source?.conditions) ? JSON.parse(JSON.stringify(source.conditions)) : null);
  return {
    gate,
    encryption,
    mode: deriveLegacyPayloadAccessMode({ gate, encryption }),
    ...(accessConditions ? { accessConditions } : {}),
  };
};

export const normalizeSessionStorageConfig = (sessionConfig: unknown = null): NormalizedSessionStorageConfig => {
  const cfg = isObj(sessionConfig) ? sessionConfig : {};
  const raw = isObj(cfg.storageProfile)
    ? cfg.storageProfile
    : (isObj(cfg.sessionStorageConfig) ? cfg.sessionStorageConfig : {});
  const backend = normalizeStorageBackend(
    raw.backend ||
    cfg.storageBackend ||
    (cfg.docLibrary as { provider?: unknown } | null | undefined)?.provider
  );
  const resources = isObj(raw.resources) ? raw.resources : {};
  const defaultCanonicalStage: SessionStorageResourceStage = backend === STORAGE_BACKENDS.CLOUDFLARE
    ? SESSION_STORAGE_RESOURCE_STAGES.ACTIVE
    : SESSION_STORAGE_RESOURCE_STAGES.STAGED;
  return {
    backend,
    resources: {
      docsContext: toStr(resources.docsContext || '').trim().toLowerCase() || SESSION_STORAGE_RESOURCE_STAGES.ACTIVE,
      questions: toStr(resources.questions || '').trim().toLowerCase() || defaultCanonicalStage,
      surveys: toStr(resources.surveys || '').trim().toLowerCase() || defaultCanonicalStage,
      responses: toStr(resources.responses || '').trim().toLowerCase() || defaultCanonicalStage,
      generatedArtifacts: toStr(resources.generatedArtifacts || '').trim().toLowerCase() || defaultCanonicalStage,
      media: toStr(resources.media || '').trim().toLowerCase() || defaultCanonicalStage,
    },
    payloadAccessControl: backend === STORAGE_BACKENDS.CLOUDFLARE
      ? normalizeSessionStoragePayloadAccessControl(raw)
      : normalizeSessionStoragePayloadAccessControl(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED),
  };
};

export const resolveSessionStorageBackend = (sessionConfig: unknown = null, {
  resource = 'docsContext',
  encrypted = false,
}: ResolveSessionStorageBackendOptions = {}): StorageBackend => {
  const storageConfig = normalizeSessionStorageConfig(sessionConfig);
  const resourceKey = toStr(resource).trim() || 'docsContext';
  const resourceStage = storageConfig.resources[resourceKey] || SESSION_STORAGE_RESOURCE_STAGES.ACTIVE;
  const isActiveResource = resourceStage === SESSION_STORAGE_RESOURCE_STAGES.ACTIVE;
  if (isActiveResource && storageConfig.backend === STORAGE_BACKENDS.CLOUDFLARE) return STORAGE_BACKENDS.CLOUDFLARE;
  if (isActiveResource && storageConfig.backend === STORAGE_BACKENDS.LIT_ARWEAVE) return STORAGE_BACKENDS.LIT_ARWEAVE;
  if (encrypted) return STORAGE_BACKENDS.LIT_ARWEAVE;
  return STORAGE_BACKENDS.ARWEAVE;
};

export const requiresLitForSessionStorage = (sessionConfig: unknown = null, opts: ResolveSessionStorageBackendOptions = {}): boolean => (
  resolveSessionStorageBackend(sessionConfig, opts) === STORAGE_BACKENDS.LIT_ARWEAVE ||
  (
    resolveSessionStorageBackend(sessionConfig, opts) === STORAGE_BACKENDS.CLOUDFLARE &&
    normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT
  )
);

export const usesCloudflareSessionStorage = (sessionConfig: unknown = null, opts: ResolveSessionStorageBackendOptions = {}): boolean => (
  resolveSessionStorageBackend(sessionConfig, opts) === STORAGE_BACKENDS.CLOUDFLARE
);

export const usesWorkerSbtGateCloudflareStorage = (sessionConfig: unknown = null, opts: ResolveSessionStorageBackendOptions = {}): boolean => (
  usesCloudflareSessionStorage(sessionConfig, opts) &&
  normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.gate === SESSION_STORAGE_PAYLOAD_ACCESS_GATES.SBT_GATE &&
  normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.encryption !== SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT
);

export const usesPublicReadCloudflareStorage = (sessionConfig: unknown = null, opts: ResolveSessionStorageBackendOptions = {}): boolean => (
  usesCloudflareSessionStorage(sessionConfig, opts) &&
  normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.gate === SESSION_STORAGE_PAYLOAD_ACCESS_GATES.NONE &&
  normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.encryption !== SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT
);
