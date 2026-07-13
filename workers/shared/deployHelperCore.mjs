import rpcDefaults from '../../client/src/variables/rpcDefaults.js';
import {
  STORAGE_BACKENDS,
  normalizeStorageBackend,
} from '../sessionCorsWorker/storageRefNormalization.js';
import { buildSessionSecretsEnvelope } from './sessionSecretsEnvelope.mjs';
import { resolveCloudflareApiBaseUrl } from './deployHelperEndpointConfig.mjs';
import {
  findForbiddenCloudflareDeploymentTokenPath,
  findForbiddenWorkerConfigSecretPath,
  sanitizeWorkerConfigOpenSubtree,
  selectDeployWorkerSessionConfigFields,
} from './workerSessionConfig.mjs';

const { getPathRpcUrl } = rpcDefaults;

export const DEFAULT_COMPAT_DATE = '2024-09-02';
export const DEFAULT_FAUCET_RPC_URL = getPathRpcUrl(11155420) || '';
export const DEFAULT_FAUCET_AMOUNT_ETH = '0.0002';
export const DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH = '0.001';
export const DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED = true;
// Fail closed for self-hosted/manual deploys that forgot to configure
// ALLOWED_ORIGINS. The broader CE/local bootstrap defaults belong in the
// publish CLI, not in the runtime fallback for a misconfigured helper.
export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
];
export const DEPLOY_HELPER_ORIGINS_KEY = 'deploy-helper:origins';

const TRUE_STRINGS = new Set(['1', 'true', 'yes', 'on']);
const FALSE_STRINGS = new Set(['0', 'false', 'no', 'off']);
const STORAGE_RESOURCE_STAGES = Object.freeze({
  ACTIVE: 'active',
  STAGED: 'staged',
});
const DEFAULT_STORAGE_RESOURCES = Object.freeze({
  docsContext: STORAGE_RESOURCE_STAGES.ACTIVE,
  questions: STORAGE_RESOURCE_STAGES.STAGED,
  surveys: STORAGE_RESOURCE_STAGES.STAGED,
  responses: STORAGE_RESOURCE_STAGES.STAGED,
  generatedArtifacts: STORAGE_RESOURCE_STAGES.STAGED,
  media: STORAGE_RESOURCE_STAGES.STAGED,
  images: STORAGE_RESOURCE_STAGES.STAGED,
});
const DEFAULT_PAYLOAD_ACCESS_RESOURCES = Object.freeze({
  docsContext: 'docUploads',
  questions: 'questionResponses',
  surveys: 'surveyResponses',
  responses: 'questionResponses',
  generatedArtifacts: 'surveyResponses',
  media: 'docUploads',
  images: 'docUploads',
});
const DEFAULT_CLOUDFLARE_PRIMITIVES = Object.freeze({
  r2: ['session_context_payloads', 'question_payloads', 'survey_payloads', 'response_payloads', 'media_blob_payloads'],
  d1: ['metadata_indexes', 'audit_events', 'queryable_records'],
  kv: ['metadata_indexes', 'short_lived_action_ids', 'webhook_replay_cache', 'ephemeral_start_params'],
  durableObjects: ['signer_runtime_coordination_only', 'coordination_locks'],
});
const PAYLOAD_ACCESS_MODES = Object.freeze({
  PUBLIC_READ: 'public_read',
  WORKER_SBT_GATE: 'worker_sbt_gate',
  LIT_ENCRYPTED: 'lit_encrypted',
});
const PAYLOAD_ACCESS_GATES = Object.freeze({
  NONE: 'none',
  SBT_GATE: 'sbt_gate',
  GROUP_GATE: 'group_gate',
  ROLE_GATE: 'role_gate',
});
const PAYLOAD_ENCRYPTION_MODES = Object.freeze({
  NONE: 'none',
  WORKER_ENVELOPE: 'worker_envelope',
  LIT: 'lit',
});
const STORAGE_ENVELOPE_KEK_SECRET_NAME = 'CE_STORAGE_ENVELOPE_KEK';
const DEPLOYMENT_ID_BINDING_NAME = 'CE_DEPLOYMENT_ID';
const R2_BUCKET_NAME_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const ALLOWED_WORKER_AUTHORITY_SCOPES = new Set([
  'ai',
  'transcribe',
  'storage',
  'groups',
  'arweave',
  'faucet',
  'fetch',
  'lit',
]);
const DEFAULT_WORKER_CANONICAL_AUTHORITY = Object.freeze({
  version: 1,
  participantScopes: Object.freeze(['ai', 'transcribe', 'storage', 'groups', 'fetch']),
  anonymousScopes: Object.freeze([]),
});

export const toStr = (val) => (typeof val === 'string' ? val : val == null ? '' : String(val));
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
export const hasScheme = (value) => /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
export const ensureHttpUrl = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return '';
  if (hasScheme(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return trimmed;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
};
export const normalizeOrigin = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return '';
  const withScheme = ensureHttpUrl(trimmed);
  if (withScheme.startsWith('/')) return '';
  try {
    return new URL(withScheme).origin;
  } catch {
    return '';
  }
};
export const normalizeOriginList = (list) => {
  const entries = Array.isArray(list) ? list : [list];
  const cleaned = entries.map((entry) => normalizeOrigin(entry)).filter(Boolean);
  return Array.from(new Set(cleaned));
};
export const normalizeAllowList = (list, fallback = DEFAULT_ALLOWED_ORIGINS) => {
  const normalized = normalizeOriginList(list);
  if (normalized.length) return normalized;
  return normalizeOriginList(fallback);
};
export const normalizeSlug = (raw) => {
  const slug = toStr(raw).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!slug) return '';
  return slug === 'general' ? '' : slug;
};
export const validateInboundSlug = (raw) => {
  if (raw == null) return { ok: true, slug: '', error: '' };
  const rawStr = toStr(raw).trim();
  if (!rawStr) return { ok: true, slug: '', error: '' };
  if (rawStr.toLowerCase() === 'general') return { ok: true, slug: '', error: '' };
  const canonicalSlug = rawStr.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (rawStr !== canonicalSlug) {
    return {
      ok: false,
      slug: '',
      error: 'Invalid session slug. Use lowercase letters, numbers, "_" or "-".',
    };
  }
  return { ok: true, slug: canonicalSlug, error: '' };
};

export const parseAllowList = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return [];
  return normalizeOriginList(trimmed.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean));
};
export const parseStoredAllowList = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return normalizeOriginList(parsed);
  } catch {}
  return parseAllowList(trimmed);
};

export const readJsonOrText = async (resp) => {
  let text = '';
  try {
    text = await resp.text();
  } catch {
    return {};
  }
  const trimmed = toStr(text).trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return { message: trimmed };
  }
};

export const cfFetch = async (
  token,
  path,
  options = {},
  {
    fetchImpl = globalThis.fetch,
    apiBaseUrl = '',
    env = null,
  } = {}
) => {
  const cloudflareApiBaseUrl = resolveCloudflareApiBaseUrl({ apiBaseUrl, env });
  let resp;
  try {
    resp = await fetchImpl(`${cloudflareApiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: `Cloudflare API request failed: ${toStr(err?.message || err).trim() || 'Unknown error.'}`,
      detail: undefined,
      status: 502,
      data: null,
    };
  }
  const data = await readJsonOrText(resp);
  if (!resp.ok || data?.success === false) {
    const err = data?.errors?.[0]?.message || data?.message || `Cloudflare API error (${resp.status})`;
    const detail = data?.errors?.length ? data.errors : undefined;
    return { ok: false, error: err, detail, status: resp.status, data };
  }
  return { ok: true, data };
};

const NEW_KV_NAMESPACE_RETRY_DELAYS_MS = Object.freeze([250, 500, 1000]);

// A newly created namespace can briefly return 404/10013. Retry only the
// first idempotent config write; every later deploy write remains fail-closed.
const isNewKvNamespacePropagationFailure = (result) => {
  if (!result || result.ok || Number(result.status || 0) !== 404) return false;
  const detail = Array.isArray(result.detail) ? result.detail : [];
  if (detail.some((entry) => Number(entry?.code || 0) === 10013)) return true;
  const message = [result.error, ...detail.map((entry) => entry?.message)]
    .map((value) => toStr(value).trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
  return message.includes('get namespace') && message.includes('namespace not found');
};

const putFreshKvNamespaceValue = async ({ apiToken, path, options, cfFetchOptions }) => {
  let result = await cfFetch(apiToken, path, options, cfFetchOptions);
  for (const delayMs of NEW_KV_NAMESPACE_RETRY_DELAYS_MS) {
    if (!isNewKvNamespacePropagationFailure(result)) return result;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    result = await cfFetch(apiToken, path, options, cfFetchOptions);
  }
  return result;
};

export const lookupCloudflareAccount = async ({
  apiToken,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = '',
  env = null,
} = {}) => {
  const accountsResp = await cfFetch(apiToken, '/accounts?per_page=5', {}, {
    fetchImpl,
    apiBaseUrl,
    env,
  });
  if (!accountsResp.ok) {
    const status = Number(accountsResp.status || 0) || 502;
    return {
      ok: false,
      error: accountsResp.error,
      detail: accountsResp.detail,
      status,
      fallbackEligible: status >= 500 || status === 429,
    };
  }
  const accounts = Array.isArray(accountsResp.data?.result) ? accountsResp.data.result : [];
  const totalCount = Number(accountsResp.data?.result_info?.total_count || accounts.length);
  if (accounts.length > 1 || totalCount > 1) {
    return {
      ok: false,
      error: 'Multiple accounts are available for this token. Choose an account explicitly or restrict the token to one account.',
      detail: undefined,
      status: 409,
      fallbackEligible: false,
    };
  }
  const account = accounts[0] || null;
  if (!account || !account.id) {
    return {
      ok: false,
      error: 'No accounts found for token.',
      detail: undefined,
      status: 404,
      fallbackEligible: false,
    };
  }
  return {
    ok: true,
    accountId: account.id,
    accountName: account.name || '',
  };
};

export const randomSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};
export const sha256Hex = async (value) => {
  const input = new TextEncoder().encode(toStr(value));
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
export const buildBundleDiagnostics = async (bundleSource, sourceKind) => {
  const normalized = toStr(bundleSource);
  return {
    source: toStr(sourceKind).trim() || 'unknown',
    length: normalized.length,
    sha256: await sha256Hex(normalized),
    hasAnyExport: normalized.includes('export '),
    hasExportDefault: normalized.includes('export default'),
    hasNamedDefaultExport: normalized.includes(' as default') || normalized.includes('worker_default'),
    hasStringExportWrapper: (
      /^export\s+default\s+["'`]/.test(normalized) ||
      /^module\.exports\s*=\s*["'`]/.test(normalized)
    ),
    hasFetchHandler: normalized.includes('fetch('),
    hasServiceWorkerFetch: (
      normalized.includes(`addEventListener('fetch'`) ||
      normalized.includes('addEventListener("fetch"')
    ),
    prefix: normalized.slice(0, 120),
    suffix: normalized.slice(-120),
  };
};
export const formatBundleDiagnostics = (diagnostics = {}) => {
  const sha256 = toStr(diagnostics?.sha256).trim();
  return [
    `source=${toStr(diagnostics?.source).trim() || 'unknown'}`,
    `len=${Number(diagnostics?.length || 0) || 0}`,
    `sha256=${sha256 ? sha256.slice(0, 16) : 'n/a'}`,
    `export=${diagnostics?.hasAnyExport === true ? '1' : '0'}`,
    `default=${diagnostics?.hasExportDefault === true ? '1' : '0'}`,
    `namedDefault=${diagnostics?.hasNamedDefaultExport === true ? '1' : '0'}`,
    `stringWrap=${diagnostics?.hasStringExportWrapper === true ? '1' : '0'}`,
    `fetch=${diagnostics?.hasFetchHandler === true ? '1' : '0'}`,
    `swFetch=${diagnostics?.hasServiceWorkerFetch === true ? '1' : '0'}`,
  ].join(' ');
};

export const normalizeSecretValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return toStr(value).trim();
};

export const sanitizeSecrets = (incoming) => {
  const allowed = [
    'openaiKey',
    'anthropicKey',
    'openrouterKey',
    'customRpcUrl',
    'customRpcKey',
    'arweaveJwk',
    'faucetPrivateKey',
    'litAccountApiKey',
    'litUsageApiKey',
  ];
  const out = {};
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(incoming || {}, key)) {
      out[key] = normalizeSecretValue(incoming[key]);
    }
  });
  return out;
};

export const sanitizeBlockLimits = (incoming) => {
  if (!incoming || typeof incoming !== 'object') return null;
  const start = Number(incoming.start);
  if (!Number.isFinite(start) || start <= 0) return null;
  const normalizedStart = Math.floor(start);
  const endRaw = incoming.end;
  const parsedEnd = (endRaw == null || endRaw === '') ? null : Number(endRaw);
  const normalizedEnd = Number.isFinite(parsedEnd) && parsedEnd > 0 && parsedEnd >= normalizedStart
    ? Math.floor(parsedEnd)
    : null;
  return {
    start: normalizedStart,
    end: normalizedEnd,
  };
};

const normalizeWorkerAuthorityScopes = (value, field) => {
  if (!Array.isArray(value)) {
    return { ok: false, error: `Worker-canonical authority ${field} must be an array.` };
  }
  const normalized = value.map((scope) => toStr(scope).trim().toLowerCase());
  if (normalized.some((scope) => !ALLOWED_WORKER_AUTHORITY_SCOPES.has(scope))) {
    return { ok: false, error: `Worker-canonical authority ${field} contains an unsupported scope.` };
  }
  return { ok: true, value: [...new Set(normalized)] };
};

const normalizeWorkerAuthorityLoginGate = (value) => {
  if (value == null) return { ok: true, value: null };
  if (!isObj(value) || !Array.isArray(value.conditions)) {
    return { ok: false, error: 'Worker-canonical authority loginGate must contain a conditions array.' };
  }
  const match = toStr(value.match).trim().toLowerCase();
  if (match && match !== 'any' && match !== 'all') {
    return { ok: false, error: 'Worker-canonical authority loginGate.match must be "any" or "all".' };
  }
  const conditions = [];
  for (const condition of value.conditions) {
    if (!isObj(condition)) {
      return { ok: false, error: 'Worker-canonical authority loginGate contains an invalid condition.' };
    }
    const kind = toStr(condition.kind).trim().toLowerCase();
    if (kind === 'worker_role') {
      const role = toStr(condition.role || 'admin').trim().toLowerCase() || 'admin';
      conditions.push({ kind, role });
      continue;
    }
    if (kind === 'worker_group') {
      const groupId = toStr(condition.groupId).trim();
      if (!groupId) {
        return { ok: false, error: 'Worker-canonical worker_group conditions require groupId.' };
      }
      conditions.push({ kind, groupId });
      continue;
    }
    return { ok: false, error: 'Worker-canonical authority loginGate contains an unsupported condition.' };
  }
  return {
    ok: true,
    value: {
      match: match || 'any',
      conditions,
    },
  };
};

const resolveWorkerCanonicalAuthorityForDeploy = (incoming) => {
  if (incoming == null) {
    return {
      ok: true,
      value: {
        version: DEFAULT_WORKER_CANONICAL_AUTHORITY.version,
        participantScopes: [...DEFAULT_WORKER_CANONICAL_AUTHORITY.participantScopes],
        anonymousScopes: [...DEFAULT_WORKER_CANONICAL_AUTHORITY.anonymousScopes],
      },
    };
  }
  if (!isObj(incoming) || Number(incoming.version) !== 1) {
    return { ok: false, error: 'Worker-canonical authority policy must use version 1.' };
  }
  const participantScopes = normalizeWorkerAuthorityScopes(incoming.participantScopes, 'participantScopes');
  if (!participantScopes.ok) return participantScopes;
  const anonymousScopes = normalizeWorkerAuthorityScopes(incoming.anonymousScopes, 'anonymousScopes');
  if (!anonymousScopes.ok) return anonymousScopes;
  const loginGate = normalizeWorkerAuthorityLoginGate(incoming.loginGate);
  if (!loginGate.ok) return loginGate;
  return {
    ok: true,
    value: {
      version: 1,
      participantScopes: participantScopes.value,
      anonymousScopes: anonymousScopes.value,
      ...(loginGate.value ? { loginGate: loginGate.value } : {}),
    },
  };
};

const workerAuthorityPoliciesMatch = (expected, actual) => (
  JSON.stringify(expected || null) === JSON.stringify(actual || null)
);

const buildWorkerCanonicalDeploymentName = (requestedName, deploymentId) => {
  const base = toStr(requestedName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'ce-session-worker';
  return `${base}-${toStr(deploymentId).slice(0, 12)}`;
};

const normalizeResourceStage = (value, fallback) => {
  const normalized = toStr(value).trim().toLowerCase();
  if (normalized === STORAGE_RESOURCE_STAGES.ACTIVE) return STORAGE_RESOURCE_STAGES.ACTIVE;
  if (normalized === STORAGE_RESOURCE_STAGES.STAGED) return STORAGE_RESOURCE_STAGES.STAGED;
  return fallback;
};

const normalizePayloadAccessMode = (value) => {
  const normalized = toStr(value).trim().toLowerCase();
  if (normalized === PAYLOAD_ACCESS_MODES.PUBLIC_READ || normalized === 'public' || normalized === 'public-read') {
    return PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  }
  if (normalized === PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED) return PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  return PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE;
};

const normalizePayloadAccessGate = (value, fallback = PAYLOAD_ACCESS_GATES.SBT_GATE) => {
  const normalized = toStr(value).trim().toLowerCase().replace(/-/g, '_');
  if (!normalized) return fallback;
  if (normalized === 'none' || normalized === 'public' || normalized === PAYLOAD_ACCESS_MODES.PUBLIC_READ) {
    return PAYLOAD_ACCESS_GATES.NONE;
  }
  if (
    normalized === 'sbt' ||
    normalized === 'sbt_gate' ||
    normalized === 'worker_sbt' ||
    normalized === PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE
  ) {
    return PAYLOAD_ACCESS_GATES.SBT_GATE;
  }
  if (normalized === 'group' || normalized === 'group_gate' || normalized === 'worker_group') {
    return PAYLOAD_ACCESS_GATES.GROUP_GATE;
  }
  if (normalized === 'role' || normalized === 'role_gate' || normalized === 'worker_role') {
    return PAYLOAD_ACCESS_GATES.ROLE_GATE;
  }
  return fallback;
};

const normalizePayloadEncryptionMode = (value, fallback = PAYLOAD_ENCRYPTION_MODES.NONE) => {
  const raw = isObj(value) ? value.mode : value;
  const normalized = toStr(raw).trim().toLowerCase().replace(/-/g, '_');
  if (!normalized) return fallback;
  if (normalized === 'none' || normalized === 'plain' || normalized === 'plaintext') {
    return PAYLOAD_ENCRYPTION_MODES.NONE;
  }
  if (normalized === 'worker_envelope' || normalized === 'cloudflare_envelope') {
    return PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE;
  }
  if (normalized === 'lit' || normalized === PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED) {
    return PAYLOAD_ENCRYPTION_MODES.LIT;
  }
  return fallback;
};

const deriveLegacyPayloadAccessMode = ({ gate, encryption }) => {
  if (encryption === PAYLOAD_ENCRYPTION_MODES.LIT) return PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  if (gate === PAYLOAD_ACCESS_GATES.NONE) return PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  return PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE;
};

const cloneAccessConditions = (source) => {
  const conditions = isObj(source?.accessConditions)
    ? source.accessConditions
    : (isObj(source?.conditions) ? source.conditions : null);
  return conditions ? JSON.parse(JSON.stringify(conditions)) : null;
};

const normalizePayloadAccessControl = (raw) => {
  const rawRecord = isObj(raw) ? raw : {};
  const rawAccess = isObj(rawRecord.payloadAccessControl) ? rawRecord.payloadAccessControl : {};
  const rawCloudflare = isObj(rawRecord.cloudflare) ? rawRecord.cloudflare : {};
  const legacyMode = normalizePayloadAccessMode(
    rawAccess.mode ||
    rawCloudflare.payloadAccessMode ||
    rawRecord.payloadAccessMode ||
    rawRecord.accessControlMode
  );
  const fallbackGate = (
    legacyMode === PAYLOAD_ACCESS_MODES.PUBLIC_READ ||
    legacyMode === PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED
  )
    ? PAYLOAD_ACCESS_GATES.NONE
    : PAYLOAD_ACCESS_GATES.SBT_GATE;
  const fallbackEncryption = legacyMode === PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED
    ? PAYLOAD_ENCRYPTION_MODES.LIT
    : PAYLOAD_ENCRYPTION_MODES.NONE;
  const directV2 = (
    Object.prototype.hasOwnProperty.call(rawRecord, 'gate') ||
    Object.prototype.hasOwnProperty.call(rawRecord, 'encryption')
  );
  const source = directV2 ? rawRecord : rawAccess;
  const gate = normalizePayloadAccessGate(isObj(source) ? source.gate : undefined, fallbackGate);
  const encryption = normalizePayloadEncryptionMode(isObj(source) ? source.encryption : undefined, fallbackEncryption);
  const accessConditions = cloneAccessConditions(source);
  return {
    gate,
    encryption,
    mode: deriveLegacyPayloadAccessMode({ gate, encryption }),
    ...(accessConditions ? { accessConditions } : {}),
  };
};

const normalizeStorageProfileInput = (incoming) => {
  if (incoming == null) return null;
  if (isObj(incoming)) return incoming;
  const trimmed = toStr(incoming).trim();
  return trimmed ? { backend: trimmed } : null;
};

export const normalizeDeployStorageProfile = (incoming) => {
  const raw = normalizeStorageProfileInput(incoming);
  if (!raw) return null;
  const backend = normalizeStorageBackend(raw.backend || raw.profile || raw.storageProfile);
  const rawResources = isObj(raw.resources) ? raw.resources : {};
  const defaultCanonicalStage = backend === STORAGE_BACKENDS.CLOUDFLARE
    ? STORAGE_RESOURCE_STAGES.ACTIVE
    : STORAGE_RESOURCE_STAGES.STAGED;
  const docsContext = normalizeResourceStage(rawResources.docsContext || raw.docsContext, STORAGE_RESOURCE_STAGES.ACTIVE);
  const profile = {
    type: 'session_storage_profile',
    version: 'session-storage-profile-v1',
    backend,
    sessionOwned: true,
    telegramOwned: false,
    resources: {
      ...DEFAULT_STORAGE_RESOURCES,
      docsContext,
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
      uploads: 'session_worker_gate',
      snippets: 'session_worker_gate',
      shortLivedReads: 'session_worker_gate',
      downloads: 'session_worker_gate',
      litRequired: 'payload_encrypted_only',
    },
    cloudflare: null,
  };
  if (backend !== STORAGE_BACKENDS.CLOUDFLARE) return profile;

  const accessControl = normalizePayloadAccessControl(raw);
  const accessMode = accessControl.mode;
  const litEncrypted = accessMode === PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  const workerEnvelope = accessControl.encryption === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE;
  const publicRead = accessMode === PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  profile.payloadAccessControl = {
    gate: accessControl.gate,
    encryption: accessControl.encryption,
    mode: accessMode,
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
    resources: {
      ...DEFAULT_PAYLOAD_ACCESS_RESOURCES,
      ...(isObj(raw.payloadAccessControl?.resources) ? raw.payloadAccessControl.resources : {}),
    },
    ...(accessControl.accessConditions ? { accessConditions: accessControl.accessConditions } : {}),
  };
  profile.sbtGatedAccess = {
    ...profile.sbtGatedAccess,
    litRequired: litEncrypted
      ? 'required_for_cloudflare_payload_encryption'
      : (publicRead ? 'not_required_public_read' : 'not_required_worker_enforced'),
  };
  profile.cloudflare = {
    primitives: DEFAULT_CLOUDFLARE_PRIMITIVES,
    payloadAccessMode: accessMode,
    credentialSource: 'worker_secret_or_cloudflare_binding',
    exposesAccountId: false,
    exposesBucketName: false,
    exposesWorkerToken: false,
    exposesRawStoragePath: false,
    exposesLongLivedUrl: false,
  };
  return profile;
};

const deployStorageRequiresEnvelopeKek = (storageProfile) => (
  storageProfile?.backend === STORAGE_BACKENDS.CLOUDFLARE &&
  storageProfile?.payloadAccessControl?.encryption === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE
);

const firstTrimmed = (...values) => {
  for (const value of values) {
    const trimmed = toStr(value).trim();
    if (trimmed) return trimmed;
  }
  return '';
};

const resolveRequestedR2BucketName = (incoming) => {
  const raw = normalizeStorageProfileInput(incoming);
  if (!raw) return '';
  const cloudflare = isObj(raw.cloudflare) ? raw.cloudflare : {};
  const r2 = isObj(cloudflare.r2) ? cloudflare.r2 : {};
  return firstTrimmed(
    raw.r2BucketName,
    raw.r2Bucket,
    raw.bucketName,
    raw.bucket,
    cloudflare.r2BucketName,
    cloudflare.r2Bucket,
    cloudflare.bucketName,
    cloudflare.bucket,
    r2.bucketName,
    r2.bucket
  );
};

const truthyR2Marker = (value) => {
  if (value === true) return true;
  const normalized = toStr(value).trim().toLowerCase();
  return normalized === 'r2' || TRUE_STRINGS.has(normalized);
};

const hasExplicitR2Request = (incoming, bucketName = '') => {
  if (bucketName) return true;
  const raw = normalizeStorageProfileInput(incoming);
  if (!raw) return false;
  const cloudflare = isObj(raw.cloudflare) ? raw.cloudflare : {};
  return truthyR2Marker(raw.useR2) ||
    truthyR2Marker(raw.payloadStorage) ||
    truthyR2Marker(raw.storageLayer) ||
    truthyR2Marker(cloudflare.useR2) ||
    truthyR2Marker(cloudflare.payloadStorage) ||
    truthyR2Marker(cloudflare.storageLayer) ||
    truthyR2Marker(cloudflare.r2);
};

export const resolveDeployStorageBindingPlan = (incoming, storageProfile) => {
  if (!storageProfile || storageProfile.backend !== STORAGE_BACKENDS.CLOUDFLARE) {
    return { ok: true, r2BucketName: '', requiresStorageIndexKv: false };
  }
  const r2BucketName = resolveRequestedR2BucketName(incoming);
  if (r2BucketName && (
    !R2_BUCKET_NAME_RE.test(r2BucketName) ||
    r2BucketName.includes('..') ||
    r2BucketName.includes('-.') ||
    r2BucketName.includes('.-')
  )) {
    return {
      ok: false,
      error: 'Invalid Cloudflare R2 bucket name. Use the existing bucket name without URLs, paths, or credentials.',
    };
  }
  if (hasExplicitR2Request(incoming, r2BucketName) && !r2BucketName) {
    return {
      ok: false,
      error: 'Cloudflare R2 storage requires r2BucketName when R2 is explicitly requested.',
    };
  }
  return {
    ok: true,
    r2BucketName,
    requiresStorageIndexKv: true,
  };
};

export const normalizeEmbeddedDeployHelperEnabled = (
  value,
  fallback = DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED
) => {
  if (typeof value === 'boolean') return value;
  const trimmed = toStr(value).trim().toLowerCase();
  if (!trimmed) return fallback;
  if (TRUE_STRINGS.has(trimmed)) return true;
  if (FALSE_STRINGS.has(trimmed)) return false;
  return fallback;
};

const buildFailure = (status, body, { fallbackEligible = false } = {}) => ({
  ok: false,
  status,
  body,
  fallbackEligible,
});

const buildSuccess = (status, body) => ({
  ok: true,
  status,
  body,
  fallbackEligible: false,
});

const shouldAllowFallbackForCloudflareFailure = (result = {}) => {
  const status = Number(result?.status || 0);
  if (!status) return true;
  return status >= 500 || status === 429;
};

export const ensureWorkersDevSubdomain = async ({
  apiToken,
  accountId,
  workerName,
  requestedSubdomain = '',
  fetchImpl = globalThis.fetch,
  apiBaseUrl = '',
  env = null,
} = {}) => {
  let subdomain = null;
  let subdomainStatus = '';
  let subdomainEnabled = false;
  let subdomainError = '';
  let scriptSubdomainEnabled = false;
  let scriptSubdomainError = '';

  const fallbackSubdomain = accountId
    ? `ce-${toStr(accountId).replace(/[^a-z0-9-]/gi, '').slice(0, 10)}`
    : '';

  const cfFetchOptions = { fetchImpl, apiBaseUrl, env };

  const subdomainResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/subdomain`, {}, cfFetchOptions);
  if (subdomainResp.ok) {
    subdomain = subdomainResp.data?.result?.subdomain || null;
    subdomainStatus = subdomainResp.data?.result?.status || '';
  } else {
    subdomainError = subdomainResp.error || subdomainError;
  }

  const ensureAccountSubdomain = async (candidate) => {
    if (!candidate) return;
    const enableResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/subdomain`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain: candidate }),
    }, cfFetchOptions);
    if (enableResp.ok) {
      subdomain = enableResp.data?.result?.subdomain || candidate;
      subdomainStatus = enableResp.data?.result?.status || subdomainStatus || 'active';
      subdomainEnabled = true;
      subdomainError = '';
    } else {
      subdomainError = enableResp.error || 'Failed to enable workers.dev subdomain.';
    }
  };

  if (!subdomain) {
    await ensureAccountSubdomain(toStr(requestedSubdomain).trim() || fallbackSubdomain);
  } else if (subdomainStatus && subdomainStatus !== 'active') {
    await ensureAccountSubdomain(subdomain);
  }

  if (subdomain) {
    const scriptSubdomainResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }, cfFetchOptions);
    if (scriptSubdomainResp.ok) {
      scriptSubdomainEnabled = scriptSubdomainResp.data?.result?.enabled === true;
      if (!scriptSubdomainEnabled) {
        scriptSubdomainError = 'Cloudflare did not enable workers.dev for this Worker.';
      }
    } else {
      scriptSubdomainError = scriptSubdomainResp.error || 'Failed to enable workers.dev for script.';
    }
  }

  const workerUrl = subdomain && scriptSubdomainEnabled ? `https://${workerName}.${subdomain}.workers.dev/` : '';
  return {
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
    workerUrl,
  };
};

const resolveDeploymentAccountId = async ({
  body,
  fetchImpl,
  apiBaseUrl = '',
  env = null,
} = {}) => {
  const explicitAccountId = toStr(body?.accountId).trim();
  if (explicitAccountId) {
    return {
      ok: true,
      accountId: explicitAccountId,
      accountName: '',
    };
  }

  const lookup = await lookupCloudflareAccount({
    apiToken: toStr(body?.apiToken || body?.token).trim(),
    fetchImpl,
    apiBaseUrl,
    env,
  });
  if (!lookup.ok) {
    return lookup;
  }
  return lookup;
};

export const executeDeployHelperRequest = async ({
  body,
  env,
  requestOrigin = '',
  fetchImpl = globalThis.fetch,
  consoleImpl = console,
} = {}) => {
  const sessionSlugCheck = validateInboundSlug(body?.sessionSlug);
  if (!sessionSlugCheck.ok) {
    return buildFailure(400, { error: sessionSlugCheck.error });
  }
  if (body?.groupSlug != null && body?.sessionSlug == null) {
    return buildFailure(400, {
      error: 'Legacy groupSlug is no longer accepted. Use sessionSlug instead.',
    });
  }

  const apiToken = toStr(body?.apiToken || body?.token).trim();
  const apiBaseUrl = resolveCloudflareApiBaseUrl({ env });
  const cfFetchOptions = { fetchImpl, apiBaseUrl };
  const requestedWorkerName = toStr(body?.workerName).trim();
  let workerName = requestedWorkerName;
  const defaultSlug = normalizeSlug(env?.DEFAULT_SESSION_SLUG ?? env?.DEFAULT_GROUP_SLUG ?? '');
  const sessionSlug = body?.sessionSlug != null ? sessionSlugCheck.slug : defaultSlug;
  const displaySlug = sessionSlug || 'general';
  const bundleText = typeof body?.bundleText === 'string'
    ? body.bundleText
    : toStr(body?.bundleText);
  const hasBundleText = bundleText.trim() !== '';
  const bundleUrl = toStr(body?.bundleUrl || env?.WORKER_BUNDLE_URL).trim();

  if (!apiToken) return buildFailure(400, { error: 'Missing apiToken.' });
  if (!requestedWorkerName) return buildFailure(400, { error: 'Missing workerName.' });
  if (!hasBundleText && !bundleUrl) {
    return buildFailure(400, {
      error: 'Missing bundleText or bundleUrl (set WORKER_BUNDLE_URL or pass bundleUrl).',
    });
  }

  const rawStorageProfile = body?.storageProfile ?? body?.storageBackend ?? null;
  const storageProfile = normalizeDeployStorageProfile(rawStorageProfile);
  const storageBindingPlan = resolveDeployStorageBindingPlan(rawStorageProfile, storageProfile);
  if (!storageBindingPlan.ok) {
    return buildFailure(400, { error: storageBindingPlan.error });
  }

  const accountLookup = await resolveDeploymentAccountId({
    body: {
      ...body,
      apiToken,
    },
    fetchImpl,
    apiBaseUrl,
  });
  if (!accountLookup.ok) {
    return buildFailure(502, {
      error: accountLookup.error || 'Failed to resolve Cloudflare account.',
      detail: accountLookup.detail,
    }, {
      fallbackEligible: accountLookup.fallbackEligible === true,
    });
  }
  const accountId = toStr(accountLookup.accountId).trim();
  if (!accountId) {
    return buildFailure(404, { error: 'No accounts found for token.' });
  }

  const registryAddress = toStr(body?.registryAddress).trim();
  const registryChainId = Number(body?.registryChainId || 0) || 0;
  const hatsAddress = toStr(body?.hatsAddress).trim();
  const adminHatId = toStr(body?.adminHatId).trim();
  const adminAddress = toStr(body?.adminAddress).trim();
  const workerCanonicalRequested = (
    toStr(body?.sessionModeProfile?.authority?.mode).trim().toLowerCase() === 'worker_canonical'
  );
  if (workerCanonicalRequested && !/^0x[0-9a-f]{40}$/i.test(adminAddress)) {
    return buildFailure(400, { error: 'A valid adminAddress is required for worker-canonical deploys.' });
  }
  const workerCanonicalAuthority = workerCanonicalRequested
    ? resolveWorkerCanonicalAuthorityForDeploy(body?.workerAuthority)
    : { ok: true, value: null };
  if (!workerCanonicalAuthority.ok) {
    return buildFailure(400, { error: workerCanonicalAuthority.error });
  }
  const deploymentId = randomSecret();
  if (workerCanonicalRequested) {
    workerName = buildWorkerCanonicalDeploymentName(requestedWorkerName, deploymentId);
  }
  const workerNamePreflight = await cfFetch(
    apiToken,
    `/accounts/${accountId}/workers/scripts/${workerName}/settings`,
    { method: 'GET' },
    cfFetchOptions,
  );
  const workerNameConfirmedAbsent = !workerNamePreflight.ok && Number(workerNamePreflight.status || 0) === 404;
  // Legacy deploys historically update a named script, so their preflight is
  // advisory. An existing or indeterminate script is nevertheless protected
  // from rollback deletion. Worker-canonical deploys use an isolated physical
  // name and require an authoritative absence result before any mutation.
  const preserveWorkerOnRollback = workerNamePreflight.ok || !workerNameConfirmedAbsent;
  if (workerCanonicalRequested && workerNamePreflight.ok) {
    return buildFailure(409, {
      error: `Worker name "${workerName}" already exists. Choose a new worker name before retrying.`,
    });
  }
  if (workerCanonicalRequested && !workerNamePreflight.ok && !workerNameConfirmedAbsent) {
    return buildFailure(502, {
      error: workerNamePreflight.error || 'Failed to verify that the worker name is available.',
      detail: workerNamePreflight.detail,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(workerNamePreflight),
    });
  }
  const rpcUrl = toStr(body?.rpcUrl).trim();
  const rpcUrlsByChainId = (body?.rpcUrlsByChainId && typeof body.rpcUrlsByChainId === 'object')
    ? body.rpcUrlsByChainId
    : {};
  const allowOriginsInput = Array.isArray(body?.allowOrigins) ? body.allowOrigins : [];
  const allowOrigins = normalizeAllowList(
    allowOriginsInput.length ? allowOriginsInput : [requestOrigin]
  );
  const limits = sanitizeWorkerConfigOpenSubtree(body?.limits || {});
  const scopes = sanitizeWorkerConfigOpenSubtree(body?.scopes || {});
  const faucetInput = body?.faucet && typeof body.faucet === 'object' ? body.faucet : {};
  const faucet = {
    rpcUrl: toStr(faucetInput.rpcUrl).trim() || DEFAULT_FAUCET_RPC_URL,
    amountEth: toStr(faucetInput.amountEth).trim() || DEFAULT_FAUCET_AMOUNT_ETH,
    balanceThresholdEth: toStr(faucetInput.balanceThresholdEth).trim() || DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH,
  };
  const embeddedDeployHelperEnabled = normalizeEmbeddedDeployHelperEnabled(
    body?.embeddedDeployHelperEnabled ?? body?.deployHelperEnabled,
    true
  );

  let bundleSource = hasBundleText ? bundleText : '';
  let bundleSourceKind = hasBundleText ? 'bundleText' : 'bundleUrl';
  if (!bundleSource) {
    let bundleResp;
    try {
      bundleResp = await fetchImpl(bundleUrl);
    } catch (err) {
      return buildFailure(502, {
        error: `Failed to fetch bundle: ${toStr(err?.message || err).trim() || 'Unknown error.'}`,
      }, {
        fallbackEligible: true,
      });
    }
    if (!bundleResp.ok) {
      return buildFailure(502, {
        error: `Failed to fetch bundle (${bundleResp.status}).`,
      }, {
        fallbackEligible: bundleResp.status >= 500 || bundleResp.status === 429,
      });
    }
    bundleSource = await bundleResp.text();
  }
  const bundleDiagnostics = await buildBundleDiagnostics(bundleSource, bundleSourceKind);
  consoleImpl?.log?.('[deploy-helper] bundle diagnostics', JSON.stringify({
    workerName,
    sessionSlug: displaySlug,
    diagnostics: {
      ...bundleDiagnostics,
      prefix: bundleDiagnostics.prefix,
      suffix: bundleDiagnostics.suffix,
    },
  }));

  const config = {
    slug: sessionSlug,
    adminAddress,
    allowOrigins,
    limits,
    scopes,
    embeddedDeployHelperEnabled,
    ...(!workerCanonicalRequested
      ? {
          registryAddress,
          registryChainId,
          hatsAddress,
          adminHatId,
          rpcUrl,
          rpcUrlsByChainId,
          faucet,
        }
      : {}),
    ...selectDeployWorkerSessionConfigFields(body),
  };
  if (workerCanonicalRequested) {
    config.workerAuthority = workerCanonicalAuthority.value;
  }
  if (storageProfile) {
    config.storageProfile = storageProfile;
  }
  const blockLimits = sanitizeBlockLimits(body?.blockLimits);
  if (blockLimits && !workerCanonicalRequested) {
    config.blockLimits = blockLimits;
  }
  if (findForbiddenCloudflareDeploymentTokenPath(config)) {
    return buildFailure(400, { error: 'Cloudflare deployment tokens are not allowed in session config.' });
  }
  if (findForbiddenWorkerConfigSecretPath(config)) {
    return buildFailure(400, { error: 'Secret-like values are not allowed in public session config fields.' });
  }

  const sessionConfigKey = `session:${sessionSlug}:config`;
  const sessionSecretsKey = `session:${sessionSlug}:secrets`;
  const secrets = sanitizeSecrets(body?.secrets || {});
  const secretsEnvelope = buildSessionSecretsEnvelope(secrets);

  const kvCreate = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `ContextEngineSessionCorsWorker:${displaySlug}` }),
  }, cfFetchOptions);
  if (!kvCreate.ok) {
    return buildFailure(502, {
      error: kvCreate.error,
      detail: kvCreate.detail,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(kvCreate),
    });
  }
  const kvId = kvCreate.data?.result?.id;
  if (!kvId) {
    return buildFailure(502, { error: 'Failed to create KV namespace.' }, { fallbackEligible: true });
  }
  const cleanupStagedKv = async () => {
    const kvCleanup = await cfFetch(
      apiToken,
      `/accounts/${accountId}/storage/kv/namespaces/${kvId}`,
      { method: 'DELETE' },
      cfFetchOptions,
    );
    return kvCleanup.ok ? '' : kvId;
  };

  // Establish the signed admin binding before the runnable script can ever be
  // attached to this namespace. Otherwise a redeployed workers.dev hostname
  // has a first-write interval where an unrelated signer can claim the slug.
  const configPut = await putFreshKvNamespaceValue({
    apiToken,
    path: `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionConfigKey}`,
    options: {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    },
    cfFetchOptions,
  });
  if (!configPut.ok) {
    const orphanKvNamespaceId = await cleanupStagedKv();
    return buildFailure(502, {
      error: configPut.error,
      detail: configPut.detail,
      orphanResources: { kvNamespaceId: orphanKvNamespaceId, workerName: '' },
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(configPut),
    });
  }

  const tokenSecret = randomSecret();
  const metadata = {
    main_module: 'worker.mjs',
    bindings: [
      { name: 'GROUP_KV', type: 'kv_namespace', namespace_id: kvId },
      ...(storageBindingPlan.requiresStorageIndexKv
        ? [{ name: 'CE_STORAGE_INDEX_KV', type: 'kv_namespace', namespace_id: kvId }]
        : []),
      ...(storageBindingPlan.r2BucketName
        ? [{ name: 'CE_STORAGE_R2', type: 'r2_bucket', bucket_name: storageBindingPlan.r2BucketName }]
        : []),
      { name: 'DEFAULT_SESSION_SLUG', type: 'plain_text', text: sessionSlug },
      ...(adminAddress
        ? [{ name: 'BOOTSTRAP_ADMIN_ADDRESS', type: 'plain_text', text: adminAddress }]
        : []),
      { name: DEPLOYMENT_ID_BINDING_NAME, type: 'plain_text', text: deploymentId },
      { name: 'DEPLOY_HELPER_ENABLED', type: 'plain_text', text: embeddedDeployHelperEnabled ? '1' : '0' },
    ],
    compatibility_date: toStr(env?.WORKER_COMPATIBILITY_DATE || DEFAULT_COMPAT_DATE),
    compatibility_flags: ['nodejs_compat'],
  };
  let scriptUploadCompleted = false;

  const cleanupDeploymentResources = async () => {
    let removableWorkerName = '';
    let workerCleanupStatus = '';
    const cleanupWorkerIfOwned = async () => {
      if (preserveWorkerOnRollback) {
        workerCleanupStatus = workerNamePreflight.ok ? 'preserved-existing' : 'ownership-unverified';
        return;
      }
      const settingsResp = await cfFetch(
        apiToken,
        `/accounts/${accountId}/workers/scripts/${workerName}/settings`,
        { method: 'GET' },
        cfFetchOptions,
      );
      if (!settingsResp.ok) {
        if (Number(settingsResp.status || 0) !== 404) workerCleanupStatus = 'ownership-unverified';
        return;
      }
      const bindings = Array.isArray(settingsResp.data?.result?.bindings)
        ? settingsResp.data.result.bindings
        : [];
      const deploymentStillOwned = bindings.some((binding) => (
        toStr(binding?.name).trim() === DEPLOYMENT_ID_BINDING_NAME &&
        toStr(binding?.text).trim() === deploymentId
      ));
      if (!deploymentStillOwned) {
        workerCleanupStatus = 'ownership-changed';
        return;
      }
      const scriptCleanup = await cfFetch(
        apiToken,
        `/accounts/${accountId}/workers/scripts/${workerName}`,
        { method: 'DELETE' },
        cfFetchOptions,
      );
      if (!scriptCleanup.ok) {
        removableWorkerName = workerName;
        workerCleanupStatus = 'owned-delete-failed';
      }
    };
    // A legacy named-worker upload replaces the script metadata in place, so
    // the preserved script may already point at this deployment's fresh KV.
    // Without a restorable pre-upload snapshot, retaining and reporting that
    // KV is the only rollback path that cannot leave the live script broken.
    if (preserveWorkerOnRollback && scriptUploadCompleted) {
      await cleanupWorkerIfOwned();
      return {
        kvNamespaceId: kvId,
        workerName: removableWorkerName,
        ...(workerCleanupStatus ? { workerCleanupStatus } : {}),
      };
    }
    const [, kvCleanup] = await Promise.all([
      cleanupWorkerIfOwned(),
      cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces/${kvId}`, { method: 'DELETE' }, cfFetchOptions),
    ]);
    return {
      kvNamespaceId: kvCleanup.ok ? '' : kvId,
      workerName: removableWorkerName,
      ...(workerCleanupStatus ? { workerCleanupStatus } : {}),
    };
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  form.append('worker.mjs', new Blob([bundleSource], { type: 'application/javascript+module' }), 'worker.mjs');

  const scriptUpload = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}`, {
    method: 'PUT',
    body: form,
  }, cfFetchOptions);
  if (!scriptUpload.ok) {
    consoleImpl?.error?.('[deploy-helper] script upload failed', JSON.stringify({
      workerName,
      sessionSlug: displaySlug,
      error: scriptUpload.error,
      detail: scriptUpload.detail,
      diagnostics: bundleDiagnostics,
    }));
    const bundleSummary = formatBundleDiagnostics(bundleDiagnostics);
    const orphanResources = await cleanupDeploymentResources();
    return buildFailure(502, {
      error: `${scriptUpload.error} Bundle diagnostics: ${bundleSummary}`,
      detail: scriptUpload.detail,
      bundleDiagnostics,
      orphanResources,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(scriptUpload),
    });
  }
  scriptUploadCompleted = true;

  const envelopeKekSecretRequired = deployStorageRequiresEnvelopeKek(storageProfile);
  let envelopeKekSecretSet = false;

  const {
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
    workerUrl,
  } = await ensureWorkersDevSubdomain({
    apiToken,
    accountId,
    workerName,
    requestedSubdomain: toStr(body?.subdomain || body?.workersSubdomain).trim(),
    fetchImpl,
    apiBaseUrl,
  });
  const deploymentPayload = {
    ok: true,
    workerName,
    workerUrl,
    resolvedSlug: displaySlug,
    kvNamespaceId: kvId,
    sessionConfigKey,
    sessionSecretsKey,
    sessionKvPrefix: 'session',
    writesSessionConfig: true,
    writesSessionSecrets: true,
    tokenSecretSet: false,
    envelopeKekSecretSet,
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
  };
  if (!workerUrl) {
    const orphanResources = await cleanupDeploymentResources();
    return buildFailure(502, {
      error: subdomainError || scriptSubdomainError || 'Cloudflare did not return a shareable worker URL.',
      orphanResources,
    });
  }
  if (workerUrl) {
    const configWithWorkerUrl = {
      ...config,
      corsWorkerUrl: workerUrl,
    };
    const configUpdate = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionConfigKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configWithWorkerUrl),
    }, cfFetchOptions);
    if (!configUpdate.ok) {
      const orphanResources = await cleanupDeploymentResources();
      return buildFailure(502, {
        error: configUpdate.error || 'Failed to persist the final worker config.',
        detail: configUpdate.detail,
        orphanResources,
      });
    }
    const configReadback = await cfFetch(
      apiToken,
      `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionConfigKey}`,
      { method: 'GET' },
      cfFetchOptions,
    );
    const readbackConfig = configReadback.data?.result || configReadback.data || {};
    const expectedAuthorityMode = toStr(configWithWorkerUrl?.sessionModeProfile?.authority?.mode).trim();
    const verified = (
      configReadback.ok &&
      toStr(readbackConfig.slug).trim() === toStr(configWithWorkerUrl.slug).trim() &&
      toStr(readbackConfig.corsWorkerUrl).trim() === toStr(configWithWorkerUrl.corsWorkerUrl).trim() &&
      (!configWithWorkerUrl.configRevision ||
        toStr(readbackConfig.configRevision).trim() === toStr(configWithWorkerUrl.configRevision).trim()) &&
      (!configWithWorkerUrl.sessionId ||
        toStr(readbackConfig.sessionId).trim() === toStr(configWithWorkerUrl.sessionId).trim()) &&
      (!expectedAuthorityMode ||
        toStr(readbackConfig?.sessionModeProfile?.authority?.mode).trim() === expectedAuthorityMode) &&
      (!workerCanonicalRequested ||
        workerAuthorityPoliciesMatch(configWithWorkerUrl.workerAuthority, readbackConfig.workerAuthority))
    );
    if (!verified) {
      const orphanResources = await cleanupDeploymentResources();
      return buildFailure(502, {
        error: 'Worker config verification failed after deployment.',
        orphanResources,
      });
    }
    deploymentPayload.configVerified = true;
  }

  // Runtime and session secrets are written only after the public worker URL
  // and canonical config have both been verified.
  const secretResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}/secrets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'TOKEN_HMAC_SECRET', type: 'secret_text', text: tokenSecret }),
  }, cfFetchOptions);
  if (!secretResp.ok) {
    const orphanResources = await cleanupDeploymentResources();
    return buildFailure(502, {
      error: secretResp.error,
      detail: secretResp.detail,
      orphanResources,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(secretResp),
    });
  }
  deploymentPayload.tokenSecretSet = true;

  if (envelopeKekSecretRequired) {
    const envelopeKekResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}/secrets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: STORAGE_ENVELOPE_KEK_SECRET_NAME,
        type: 'secret_text',
        text: randomSecret(),
      }),
    }, cfFetchOptions);
    if (!envelopeKekResp.ok) {
      const orphanResources = await cleanupDeploymentResources();
      return buildFailure(502, {
        error: envelopeKekResp.error,
        detail: envelopeKekResp.detail,
        orphanResources,
      }, {
        fallbackEligible: shouldAllowFallbackForCloudflareFailure(envelopeKekResp),
      });
    }
    envelopeKekSecretSet = true;
    deploymentPayload.envelopeKekSecretSet = true;
  }

  const secretsPut = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionSecretsKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(secretsEnvelope),
  }, cfFetchOptions);
  if (!secretsPut.ok) {
    const orphanResources = await cleanupDeploymentResources();
    return buildFailure(502, {
      error: secretsPut.error,
      detail: secretsPut.detail,
      orphanResources,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(secretsPut),
    });
  }

  return buildSuccess(200, deploymentPayload);
};
