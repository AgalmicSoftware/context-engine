import {
  STORAGE_BACKENDS,
  normalizeStorageBackend,
} from '../../utilities/storage/storageRefs.js';
import {
  SESSION_STORAGE_PAYLOAD_ACCESS_GATES,
  SESSION_STORAGE_PAYLOAD_ACCESS_MODES,
  SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES,
  SESSION_STORAGE_RESOURCE_STAGES,
  normalizeSessionStoragePayloadAccessControl,
  normalizeSessionStoragePayloadAccessMode,
} from '../../utilities/storage/sessionStorageConfig.js';
import type { AnyRecord } from '../shellTypes';

export const SESSION_STORAGE_BACKENDS = STORAGE_BACKENDS;
export {
  SESSION_STORAGE_PAYLOAD_ACCESS_MODES,
  SESSION_STORAGE_RESOURCE_STAGES,
  normalizeSessionStoragePayloadAccessMode,
};

export const SESSION_STORAGE_CLOUDFLARE_PRIMITIVES = Object.freeze({
  r2: ['session_context_payloads', 'question_payloads', 'survey_payloads', 'response_payloads', 'media_blob_payloads'],
  d1: ['metadata_indexes', 'audit_events', 'queryable_records'],
  kv: ['metadata_indexes', 'short_lived_action_ids', 'webhook_replay_cache', 'ephemeral_start_params'],
  durableObjects: ['signer_runtime_coordination_only', 'coordination_locks'],
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

export type SessionStorageBackendOptionDescriptor = {
  backend: string;
  label: string;
  selected: boolean;
};

export type SessionStoragePayloadAccessOptionDescriptor = {
  mode: string;
  label: string;
  selected: boolean;
};

export type SessionStorageProfileDisplayDescriptor = {
  backend: string;
  backendOptions: SessionStorageBackendOptionDescriptor[];
  backendHelperText: string;
  showCloudflarePayloadAccessControls: boolean;
  cloudflarePayloadAccessMode: string;
  cloudflarePayloadAccessOptions: SessionStoragePayloadAccessOptionDescriptor[];
  cloudflarePayloadAccessHelperText: string;
};

const SESSION_STORAGE_BACKEND_DISPLAY_OPTIONS = Object.freeze([
  { backend: SESSION_STORAGE_BACKENDS.ARWEAVE, label: 'Arweave' },
  { backend: SESSION_STORAGE_BACKENDS.LIT_ARWEAVE, label: 'Lit-Arweave' },
  { backend: SESSION_STORAGE_BACKENDS.CLOUDFLARE, label: 'Cloudflare' },
]);

const SESSION_STORAGE_PAYLOAD_ACCESS_DISPLAY_OPTIONS = Object.freeze([
  {
    mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ,
    label: 'Public read',
  },
  {
    mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE,
    label: 'Worker SBT gate',
  },
  {
    mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED,
    label: 'Lit encrypted',
  },
]);

export const SESSION_STORAGE_PROFILE_DISPLAY_COPY = Object.freeze({
  litArweave:
    'Lit-Arweave stores encrypted Arweave payloads for session documents and context.',
  cloudflare:
    'Cloudflare stores canonical CE payloads through the session worker: R2 for blobs, D1 or KV for metadata/indexes, and Durable Objects only for signer/runtime coordination.',
  publicRead:
    'Public-read mode stores canonical payloads in Cloudflare and serves reads through the session worker without wallet auth. Writes still require an authenticated session worker request.',
  litEncrypted:
    'Lit-encrypted mode is configured for encrypted Cloudflare payload envelopes. Lit credentials are required; plaintext Cloudflare uploads are rejected until the Lit envelope path supplies payloadEncrypted data.',
  workerSbtGate:
    "Worker SBT gate mode is worker-enforced access control, not end-to-end encryption. The session worker checks the requester's SBT on the configured chain/RPC before serving Cloudflare objects.",
});

const isObj = (value: unknown): value is AnyRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const trim = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();

const normalizeBackend = (value: unknown): string => normalizeStorageBackend(value);

export const buildSessionStoragePayloadAccessControl = (
  mode: unknown = SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE,
): AnyRecord => {
  const accessControl = normalizeSessionStoragePayloadAccessControl(mode);
  const normalizedMode = accessControl.mode;
  const litEncrypted = normalizedMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  const publicRead = normalizedMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  const workerEnvelope = accessControl.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE;
  return {
    gate: accessControl.gate,
    encryption: accessControl.encryption,
    mode: normalizedMode,
    enforcement: litEncrypted
      ? 'lit_access_control_conditions'
      : (workerEnvelope
        ? 'session_worker_envelope_conditions'
        : (publicRead ? 'session_worker_public_read' : 'session_worker_sbt_gate')),
    litRequired: litEncrypted,
    label: litEncrypted
      ? 'Lit-encrypted Cloudflare payloads'
      : (workerEnvelope
        ? 'Worker-envelope encrypted Cloudflare payloads'
        : (publicRead ? 'Public-read Cloudflare payloads' : 'Worker-enforced SBT access control')),
    resources: { ...SESSION_STORAGE_PAYLOAD_ACCESS_RESOURCE_GATES },
    ...(accessControl.accessConditions ? { accessConditions: accessControl.accessConditions } : {}),
  };
};

export const sessionStoragePayloadAccessRequiresLit = (profile: unknown): boolean => {
  if (!isObj(profile)) return false;
  if (normalizeBackend(profile.backend) !== SESSION_STORAGE_BACKENDS.CLOUDFLARE) return false;
  return normalizeSessionStoragePayloadAccessControl(profile).encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT;
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
    const payloadAccessControl = buildSessionStoragePayloadAccessControl(raw);
    normalized.payloadAccessControl = payloadAccessControl;
    normalized.sbtGatedAccess = {
      ...normalized.sbtGatedAccess,
      litRequired: payloadAccessControl.litRequired
        ? 'required_for_cloudflare_payload_encryption'
        : (payloadAccessControl.gate === SESSION_STORAGE_PAYLOAD_ACCESS_GATES.NONE
          ? 'not_required_public_read'
          : 'not_required_worker_enforced'),
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

export const buildSessionStorageProfileDisplayDescriptor = (
  input: unknown = {}
): SessionStorageProfileDisplayDescriptor => {
  const profile = normalizeSessionStorageProfileConfig(input);
  const backend = trim(profile.backend);
  const showCloudflarePayloadAccessControls = backend === SESSION_STORAGE_BACKENDS.CLOUDFLARE;
  const cloudflarePayloadAccessMode = showCloudflarePayloadAccessControls
    ? normalizeSessionStoragePayloadAccessMode(
      isObj(profile.payloadAccessControl) ? profile.payloadAccessControl.mode : ''
    )
    : '';
  const backendHelperText = backend === SESSION_STORAGE_BACKENDS.LIT_ARWEAVE
    ? SESSION_STORAGE_PROFILE_DISPLAY_COPY.litArweave
    : (showCloudflarePayloadAccessControls ? SESSION_STORAGE_PROFILE_DISPLAY_COPY.cloudflare : '');
  const cloudflarePayloadAccessHelperText = !showCloudflarePayloadAccessControls
    ? ''
    : cloudflarePayloadAccessMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ
      ? SESSION_STORAGE_PROFILE_DISPLAY_COPY.publicRead
      : cloudflarePayloadAccessMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED
        ? SESSION_STORAGE_PROFILE_DISPLAY_COPY.litEncrypted
        : SESSION_STORAGE_PROFILE_DISPLAY_COPY.workerSbtGate;

  return {
    backend,
    backendOptions: SESSION_STORAGE_BACKEND_DISPLAY_OPTIONS.map((option) => ({
      ...option,
      selected: backend === option.backend,
    })),
    backendHelperText,
    showCloudflarePayloadAccessControls,
    cloudflarePayloadAccessMode,
    cloudflarePayloadAccessOptions: showCloudflarePayloadAccessControls
      ? SESSION_STORAGE_PAYLOAD_ACCESS_DISPLAY_OPTIONS.map((option) => ({
        ...option,
        selected: cloudflarePayloadAccessMode === option.mode,
      }))
      : [],
    cloudflarePayloadAccessHelperText,
  };
};
