import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord } from '../shellTypes';

export const SESSION_STORAGE_BACKENDS = Object.freeze({
  ARWEAVE: 'arweave',
  CLOUDFLARE: 'cloudflare',
});

export const SESSION_STORAGE_RESOURCE_STAGES = Object.freeze({
  ACTIVE: 'active',
  STAGED: 'staged',
});

export const SESSION_STORAGE_CLOUDFLARE_PRIMITIVES = Object.freeze({
  r2: ['docs_context_payloads', 'media_blob_payloads'],
  d1: ['metadata_indexes', 'audit_events', 'queryable_records'],
  kv: ['short_lived_action_ids', 'webhook_replay_cache', 'ephemeral_start_params'],
  durableObjects: ['managed_signer_runtime', 'coordination_locks'],
});

const isObj = (value: unknown): value is AnyRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const trim = (value: unknown): string => toStr(value).trim();

const normalizeBackend = (value: unknown): string => (
  trim(value).toLowerCase() === SESSION_STORAGE_BACKENDS.CLOUDFLARE
    ? SESSION_STORAGE_BACKENDS.CLOUDFLARE
    : SESSION_STORAGE_BACKENDS.ARWEAVE
);

export const buildDefaultSessionStorageProfile = (): AnyRecord => ({
  type: 'session_storage_profile',
  version: 'session-storage-profile-v1',
  backend: SESSION_STORAGE_BACKENDS.ARWEAVE,
  sessionOwned: true,
  telegramOwned: false,
  resources: {
    docsContext: SESSION_STORAGE_RESOURCE_STAGES.ACTIVE,
    questions: SESSION_STORAGE_RESOURCE_STAGES.STAGED,
    surveys: SESSION_STORAGE_RESOURCE_STAGES.STAGED,
    responses: SESSION_STORAGE_RESOURCE_STAGES.STAGED,
    images: SESSION_STORAGE_RESOURCE_STAGES.STAGED,
  },
  sbtGatedAccess: {
    uploads: 'session_worker_gate',
    snippets: 'session_worker_gate',
    shortLivedReads: 'session_worker_gate',
    downloads: 'session_worker_gate',
    litRequired: 'payload_encrypted_only',
  },
  cloudflare: null,
});

export const normalizeSessionStorageProfileConfig = (input: unknown = {}): AnyRecord => {
  const raw = isObj(input) ? input : {};
  const backend = normalizeBackend(raw.backend || raw.profile || raw.storageProfile);
  const base = buildDefaultSessionStorageProfile();
  const rawResources = isObj(raw.resources) ? raw.resources : {};
  const docsContext = trim(rawResources.docsContext || raw.docsContext || '').toLowerCase();
  const normalized: AnyRecord = {
    ...base,
    backend,
    sessionOwned: true,
    telegramOwned: false,
    resources: {
      ...base.resources,
      docsContext: docsContext === SESSION_STORAGE_RESOURCE_STAGES.STAGED
        ? SESSION_STORAGE_RESOURCE_STAGES.STAGED
        : SESSION_STORAGE_RESOURCE_STAGES.ACTIVE,
    },
    sbtGatedAccess: {
      ...base.sbtGatedAccess,
      ...(isObj(raw.sbtGatedAccess) ? raw.sbtGatedAccess : {}),
      litRequired: 'payload_encrypted_only',
    },
  };

  if (backend === SESSION_STORAGE_BACKENDS.CLOUDFLARE) {
    normalized.cloudflare = {
      primitives: SESSION_STORAGE_CLOUDFLARE_PRIMITIVES,
      credentialSource: 'worker_secret_or_cloudflare_binding',
      exposesAccountId: false,
      exposesBucketName: false,
      exposesWorkerToken: false,
      exposesRawStoragePath: false,
      exposesLongLivedUrl: false,
    };
  } else {
    normalized.cloudflare = null;
  }

  return normalized;
};
