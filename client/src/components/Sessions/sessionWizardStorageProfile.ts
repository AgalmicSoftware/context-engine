import {
  STORAGE_BACKENDS,
  normalizeStorageBackend,
} from '../../utilities/storage/storageRefs.js';
import type { AnyRecord } from '../shellTypes';

export const SESSION_STORAGE_BACKENDS = STORAGE_BACKENDS;

export const SESSION_STORAGE_RESOURCE_STAGES = Object.freeze({
  ACTIVE: 'active',
  STAGED: 'staged',
});

export const SESSION_STORAGE_CLOUDFLARE_PRIMITIVES = Object.freeze({
  r2: ['session_context_payloads', 'question_payloads', 'survey_payloads', 'response_payloads', 'media_blob_payloads'],
  d1: ['metadata_indexes', 'audit_events', 'queryable_records'],
  kv: ['metadata_indexes', 'short_lived_action_ids', 'webhook_replay_cache', 'ephemeral_start_params'],
  durableObjects: ['signer_runtime_coordination_only', 'coordination_locks'],
});

export const SESSION_STORAGE_PAYLOAD_ACCESS_MODES = Object.freeze({
  WORKER_SBT_GATE: 'worker_sbt_gate',
  LIT_ENCRYPTED: 'lit_encrypted',
});

export const SESSION_STORAGE_PAYLOAD_ACCESS_RESOURCE_GATES = Object.freeze({
  docsContext: 'docUploads',
  questions: 'questionResponses',
  surveys: 'surveyResponses',
  responses: 'questionResponses',
  generatedArtifacts: 'surveyResponses',
  media: 'docUploads',
  images: 'docUploads',
});

const isObj = (value: unknown): value is AnyRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const trim = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();

const normalizeBackend = (value: unknown): string => normalizeStorageBackend(value);
export const normalizeSessionStoragePayloadAccessMode = (value: unknown): string => {
  const normalized = trim(value).toLowerCase();
  if (normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  }
  return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE;
};

export const buildSessionStoragePayloadAccessControl = (
  mode: unknown = SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE,
): AnyRecord => {
  const normalizedMode = normalizeSessionStoragePayloadAccessMode(mode);
  const litEncrypted = normalizedMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  return {
    mode: normalizedMode,
    enforcement: litEncrypted ? 'lit_access_control_conditions' : 'session_worker_sbt_gate',
    litRequired: litEncrypted,
    label: litEncrypted
      ? 'Lit-encrypted Cloudflare payloads'
      : 'Worker-enforced SBT access control',
    resources: { ...SESSION_STORAGE_PAYLOAD_ACCESS_RESOURCE_GATES },
  };
};

export const sessionStoragePayloadAccessRequiresLit = (profile: unknown): boolean => {
  if (!isObj(profile)) return false;
  if (normalizeBackend(profile.backend) !== SESSION_STORAGE_BACKENDS.CLOUDFLARE) return false;
  const mode = normalizeSessionStoragePayloadAccessMode(
    (isObj(profile.payloadAccessControl) ? profile.payloadAccessControl.mode : '') ||
    (isObj(profile.cloudflare) ? profile.cloudflare.payloadAccessMode : '') ||
    profile.payloadAccessMode ||
    profile.accessControlMode
  );
  return mode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
};

export const isWorkerSbtGateCloudflareStorageProfile = (profile: unknown): boolean => {
  if (!isObj(profile)) return false;
  if (normalizeBackend(profile.backend) !== SESSION_STORAGE_BACKENDS.CLOUDFLARE) return false;
  return !sessionStoragePayloadAccessRequiresLit(profile);
};

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
    generatedArtifacts: SESSION_STORAGE_RESOURCE_STAGES.STAGED,
    media: SESSION_STORAGE_RESOURCE_STAGES.STAGED,
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
  const defaultCanonicalStage = backend === SESSION_STORAGE_BACKENDS.CLOUDFLARE
    ? SESSION_STORAGE_RESOURCE_STAGES.ACTIVE
    : SESSION_STORAGE_RESOURCE_STAGES.STAGED;
  const docsContext = trim(rawResources.docsContext || raw.docsContext || '').toLowerCase();
  const normalizeResourceStage = (value: unknown, fallback: string): string => {
    const normalized = trim(value).toLowerCase();
    if (normalized === SESSION_STORAGE_RESOURCE_STAGES.ACTIVE) return SESSION_STORAGE_RESOURCE_STAGES.ACTIVE;
    if (normalized === SESSION_STORAGE_RESOURCE_STAGES.STAGED) return SESSION_STORAGE_RESOURCE_STAGES.STAGED;
    return fallback;
  };
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
      questions: normalizeResourceStage(rawResources.questions || raw.questions, defaultCanonicalStage),
      surveys: normalizeResourceStage(rawResources.surveys || raw.surveys, defaultCanonicalStage),
      responses: normalizeResourceStage(rawResources.responses || raw.responses, defaultCanonicalStage),
      generatedArtifacts: normalizeResourceStage(
        rawResources.generatedArtifacts || raw.generatedArtifacts,
        defaultCanonicalStage
      ),
      media: normalizeResourceStage(rawResources.media || raw.media, defaultCanonicalStage),
      images: normalizeResourceStage(rawResources.images || raw.images, defaultCanonicalStage),
    },
    sbtGatedAccess: {
      ...base.sbtGatedAccess,
      ...(isObj(raw.sbtGatedAccess) ? raw.sbtGatedAccess : {}),
      litRequired: 'payload_encrypted_only',
    },
  };

  if (backend === SESSION_STORAGE_BACKENDS.CLOUDFLARE) {
    const accessMode = normalizeSessionStoragePayloadAccessMode(
      (isObj(raw.payloadAccessControl) ? raw.payloadAccessControl.mode : '') ||
      (isObj(raw.cloudflare) ? raw.cloudflare.payloadAccessMode : '') ||
      raw.payloadAccessMode ||
      raw.accessControlMode
    );
    const payloadAccessControl = buildSessionStoragePayloadAccessControl(accessMode);
    normalized.payloadAccessControl = payloadAccessControl;
    normalized.sbtGatedAccess = {
      ...normalized.sbtGatedAccess,
      litRequired: payloadAccessControl.litRequired
        ? 'required_for_cloudflare_payload_encryption'
        : 'not_required_worker_enforced',
    };
    normalized.cloudflare = {
      primitives: SESSION_STORAGE_CLOUDFLARE_PRIMITIVES,
      payloadAccessMode: payloadAccessControl.mode,
      credentialSource: 'worker_secret_or_cloudflare_binding',
      exposesAccountId: false,
      exposesBucketName: false,
      exposesWorkerToken: false,
      exposesRawStoragePath: false,
      exposesLongLivedUrl: false,
    };
  } else {
    normalized.cloudflare = null;
    delete normalized.payloadAccessControl;
  }

  return normalized;
};
