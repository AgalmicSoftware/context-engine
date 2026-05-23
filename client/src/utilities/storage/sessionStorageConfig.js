/** @file sessionStorageConfig.js */

import {
  STORAGE_BACKENDS,
  normalizeStorageBackend,
} from './storageRefs.js';
import { toStr } from '../shared/primitives.js';

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const SESSION_STORAGE_RESOURCE_STAGES = Object.freeze({
  ACTIVE: 'active',
  STAGED: 'staged',
});

export const SESSION_STORAGE_PAYLOAD_ACCESS_MODES = Object.freeze({
  PUBLIC_READ: 'public_read',
  WORKER_SBT_GATE: 'worker_sbt_gate',
  LIT_ENCRYPTED: 'lit_encrypted',
});

const normalizePayloadAccessMode = (value) => {
  const normalized = toStr(value).trim().toLowerCase();
  if (
    normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ ||
    normalized === 'public' ||
    normalized === 'public-read'
  ) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  }
  if (normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  }
  return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE;
};

const resolvePayloadAccessMode = (raw) => normalizePayloadAccessMode(
  raw?.payloadAccessControl?.mode ||
  raw?.cloudflare?.payloadAccessMode ||
  raw?.payloadAccessMode ||
  raw?.accessControlMode
);

export const normalizeSessionStorageConfig = (sessionConfig = null) => {
  const cfg = isObj(sessionConfig) ? sessionConfig : {};
  const raw = isObj(cfg.storageProfile)
    ? cfg.storageProfile
    : (isObj(cfg.sessionStorageConfig) ? cfg.sessionStorageConfig : {});
  const backend = normalizeStorageBackend(raw.backend || cfg.storageBackend || cfg.docLibrary?.provider);
  const resources = isObj(raw.resources) ? raw.resources : {};
  const defaultCanonicalStage = backend === STORAGE_BACKENDS.CLOUDFLARE
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
    payloadAccessControl: {
      mode: backend === STORAGE_BACKENDS.CLOUDFLARE
        ? resolvePayloadAccessMode(raw)
        : SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED,
    },
  };
};

export const resolveSessionStorageBackend = (sessionConfig = null, {
  resource = 'docsContext',
  encrypted = false,
} = {}) => {
  const storageConfig = normalizeSessionStorageConfig(sessionConfig);
  const resourceKey = toStr(resource).trim() || 'docsContext';
  const resourceStage = storageConfig.resources[resourceKey] || SESSION_STORAGE_RESOURCE_STAGES.ACTIVE;
  const isActiveResource = resourceStage === SESSION_STORAGE_RESOURCE_STAGES.ACTIVE;
  if (isActiveResource && storageConfig.backend === STORAGE_BACKENDS.CLOUDFLARE) return STORAGE_BACKENDS.CLOUDFLARE;
  if (isActiveResource && storageConfig.backend === STORAGE_BACKENDS.LIT_ARWEAVE) return STORAGE_BACKENDS.LIT_ARWEAVE;
  if (encrypted) return STORAGE_BACKENDS.LIT_ARWEAVE;
  return STORAGE_BACKENDS.ARWEAVE;
};

export const requiresLitForSessionStorage = (sessionConfig = null, opts = {}) => (
  resolveSessionStorageBackend(sessionConfig, opts) === STORAGE_BACKENDS.LIT_ARWEAVE ||
  (
    resolveSessionStorageBackend(sessionConfig, opts) === STORAGE_BACKENDS.CLOUDFLARE &&
    normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.mode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED
  )
);

export const usesCloudflareSessionStorage = (sessionConfig = null, opts = {}) => (
  resolveSessionStorageBackend(sessionConfig, opts) === STORAGE_BACKENDS.CLOUDFLARE
);

export const usesWorkerSbtGateCloudflareStorage = (sessionConfig = null, opts = {}) => (
  usesCloudflareSessionStorage(sessionConfig, opts) &&
  normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.mode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE
);

export const usesPublicReadCloudflareStorage = (sessionConfig = null, opts = {}) => (
  usesCloudflareSessionStorage(sessionConfig, opts) &&
  normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.mode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ
);
