import rpcDefaults from '../../client/src/variables/rpcDefaults.js';
import {
  STORAGE_BACKENDS,
  normalizeStorageBackend,
} from '../sessionCorsWorker/storageRefNormalization.js';
import { buildSessionSecretsEnvelope } from './sessionSecretsEnvelope.mjs';
import {
  AGENT_SESSION_WRAPPED_DEPLOYMENT_KIND,
  executeAgentSessionWrappedDeployment,
} from './agentSessionWrappedDeployment.mjs';
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
const DEPLOYMENT_JOURNAL_PREFIX = 'deploy-helper:deployment:';
const DEPLOYMENT_JOURNAL_VERSION = 1;
const DEPLOYMENT_JOURNAL_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEPLOYMENT_REQUEST_ID_RE = /^[a-z0-9._:-]{8,128}$/i;
const KV_NAMESPACE_TITLE_MAX_LENGTH = 512;
const SESSION_SLUG_MAX_LENGTH = 128;

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
  kv: ['metadata_indexes', 'audit_events', 'short_lived_action_ids', 'webhook_replay_cache', 'ephemeral_start_params'],
  durableObjects: ['signer_runtime_coordination_only', 'coordination_locks'],
});
const PAYLOAD_ACCESS_MODES = Object.freeze({
  PUBLIC_READ: 'public_read',
  WORKER_SBT_GATE: 'worker_sbt_gate',
  LIT_ENCRYPTED: 'lit_encrypted',
});
const R2_BUCKET_NAME_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

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
  if (rawStr !== canonicalSlug || canonicalSlug.length > SESSION_SLUG_MAX_LENGTH) {
    return {
      ok: false,
      slug: '',
      error: `Invalid session slug. Use at most ${SESSION_SLUG_MAX_LENGTH} lowercase letters, numbers, "_" or "-".`,
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
const FINAL_CONFIG_READBACK_RETRY_DELAYS_MS = Object.freeze([250, 500, 1000]);

// A newly created namespace can briefly return 404/10013. Retry only the two
// idempotent seed writes; every later deploy write remains fail-closed.
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
      error: 'Multiple accounts are available for this token. Restrict the token to exactly one account and retry.',
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

const canonicalizeJsonValue = (value, arrayEntry = false) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeJsonValue(entry, true));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        const entry = value[key];
        if (entry === undefined || typeof entry === 'function' || typeof entry === 'symbol') return out;
        out[key] = canonicalizeJsonValue(entry);
        return out;
      }, Object.create(null));
  }
  return arrayEntry ? null : undefined;
};

export const stableCanonicalSerialize = (value) => JSON.stringify(canonicalizeJsonValue(value));
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

const buildFreshDeploymentName = (requestedName, deploymentId) => {
  const base = toStr(requestedName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'ce-session-worker';
  return `${base}-${toStr(deploymentId).slice(0, 12)}`;
};

const normalizeDeploymentRequestId = (value) => {
  const normalized = toStr(value).trim();
  return DEPLOYMENT_REQUEST_ID_RE.test(normalized) ? normalized : '';
};

const collectKnownRequestCredentials = (body) => {
  const credentials = new Set();
  const visit = (value, sensitive = false) => {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (sensitive && normalized.length >= 4) credentials.add(normalized);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, sensitive));
      return;
    }
    if (!isObj(value)) return;
    Object.entries(value).forEach(([key, entry]) => {
      const credentialField = sensitive || /(?:token|secret|password|api[_-]?key|private[_-]?key)/i.test(key);
      visit(entry, credentialField);
    });
  };
  visit(body);
  return [...credentials].sort((a, b) => b.length - a.length);
};

const redactKnownCredentials = (value, credentials) => {
  let redacted = toStr(value);
  credentials.forEach((credential) => {
    redacted = redacted.split(credential).join('[REDACTED]');
  });
  return redacted;
};

const buildSafeDeployJournalResult = (result = {}, credentials = []) => {
  const incomingBody = isObj(result?.body) ? result.body : {};
  const body = {};
  [
    'ok',
    'error',
    'step',
    'deploymentKind',
    'accountId',
    'workerName',
    'workerUrl',
    'sessionSlug',
    'sessionWorkerOrigin',
    'telegramConfigured',
    'resolvedSlug',
    'kvNamespaceId',
    'deploymentId',
    'sessionConfigKey',
    'sessionSecretsKey',
    'sessionKvPrefix',
    'partial',
    'writesSessionConfig',
    'writesSessionSecrets',
    'tokenSecretSet',
    'tokenSecretPreserved',
    'envelopeKekSecretSet',
    'envelopeKekSecretPreserved',
    'subdomain',
    'subdomainStatus',
    'subdomainEnabled',
    'subdomainError',
    'scriptSubdomainEnabled',
    'scriptSubdomainError',
    'configVerified',
    'deploymentRequestPending',
    'deploymentRequestConflict',
  ].forEach((key) => {
    const value = incomingBody[key];
    if (typeof value === 'string') {
      body[key] = redactKnownCredentials(value, credentials);
    } else if (typeof value === 'boolean' || Number.isFinite(value)) {
      body[key] = value;
    }
  });
  if (isObj(incomingBody.orphanResources)) {
    body.orphanResources = {};
    ['kvNamespaceId', 'kvCleanupStatus', 'workerName', 'workerCleanupStatus'].forEach((key) => {
      const value = incomingBody.orphanResources[key];
      if (typeof value === 'string') body.orphanResources[key] = value;
    });
  }
  if (isObj(incomingBody.bundleDiagnostics)) {
    body.bundleDiagnostics = {};
    [
      'source',
      'length',
      'sha256',
      'hasAnyExport',
      'hasExportDefault',
      'hasNamedDefaultExport',
      'hasStringExportWrapper',
      'hasFetchHandler',
      'hasServiceWorkerFetch',
    ].forEach((key) => {
      const value = incomingBody.bundleDiagnostics[key];
      if (typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value)) {
        body.bundleDiagnostics[key] = value;
      }
    });
  }
  if (isObj(incomingBody.resources)) {
    body.resources = {};
    ['kvNamespaceId', 'kvReused'].forEach((key) => {
      const value = incomingBody.resources[key];
      if (typeof value === 'string') body.resources[key] = redactKnownCredentials(value, credentials);
      else if (typeof value === 'boolean' || Number.isFinite(value)) body.resources[key] = value;
    });
  }
  if (isObj(incomingBody.upload)) {
    body.upload = {};
    ['reused', 'bundleSha256'].forEach((key) => {
      const value = incomingBody.upload[key];
      if (typeof value === 'string') body.upload[key] = redactKnownCredentials(value, credentials);
      else if (typeof value === 'boolean' || Number.isFinite(value)) body.upload[key] = value;
    });
    if (isObj(incomingBody.upload.metadata) && typeof incomingBody.upload.metadata.main_module === 'string') {
      body.upload.metadata = { main_module: incomingBody.upload.metadata.main_module };
    } else if (incomingBody.upload.metadata === null) {
      body.upload.metadata = null;
    }
  }
  if (isObj(incomingBody.secrets)) {
    body.secrets = {};
    ['generated', 'preserved'].forEach((key) => {
      if (Array.isArray(incomingBody.secrets[key])) {
        body.secrets[key] = incomingBody.secrets[key]
          .filter((value) => typeof value === 'string')
          .map((value) => redactKnownCredentials(value, credentials));
      }
    });
  }
  if (isObj(incomingBody.health)) {
    body.health = {};
    ['ok', 'protocolVersion', 'authorityPinned'].forEach((key) => {
      const value = incomingBody.health[key];
      if (typeof value === 'string') body.health[key] = redactKnownCredentials(value, credentials);
      else if (typeof value === 'boolean' || Number.isFinite(value)) body.health[key] = value;
    });
  }
  if (isObj(incomingBody.agentSessionWrapped)) {
    body.agentSessionWrapped = {};
    ['version', 'enabled', 'origin', 'protocolVersion', 'revision', 'verifiedAt'].forEach((key) => {
      const value = incomingBody.agentSessionWrapped[key];
      if (typeof value === 'string') body.agentSessionWrapped[key] = redactKnownCredentials(value, credentials);
      else if (typeof value === 'boolean' || Number.isFinite(value)) body.agentSessionWrapped[key] = value;
    });
  }
  if (result?.ok !== true) body.deploymentRequestTerminal = true;
  return {
    ok: result?.ok === true,
    status: Number(result?.status || 0) || 500,
    body,
    fallbackEligible: result?.fallbackEligible === true,
  };
};

const resolveDeployJournalBinding = (env) => {
  for (const binding of [env?.DEPLOY_HELPER_KV, env?.GROUP_KV]) {
    if (typeof binding?.get === 'function' && typeof binding?.put === 'function') return binding;
  }
  return null;
};

const buildDeploymentRequestContext = async ({ body, requestOrigin = '' } = {}) => {
  const deploymentRequestId = normalizeDeploymentRequestId(body?.deploymentRequestId);
  if (!deploymentRequestId) return null;
  const digestBody = { ...(isObj(body) ? body : {}) };
  delete digestBody.deploymentRequestId;
  delete digestBody.accountId;
  digestBody.apiToken = toStr(digestBody.apiToken || digestBody.token).trim();
  delete digestBody.token;
  const requestDigest = await sha256Hex(stableCanonicalSerialize({
    body: digestBody,
    requestOrigin: normalizeOrigin(requestOrigin) || toStr(requestOrigin).trim(),
  }));
  const immutableIdentityDigest = await sha256Hex(stableCanonicalSerialize({
    requestOrigin: normalizeOrigin(requestOrigin) || toStr(requestOrigin).trim(),
    deploymentKind: toStr(body?.deploymentKind).trim(),
    sessionDeploymentIdentity: toStr(body?.sessionDeploymentIdentity).trim(),
    requestedWorkerName: toStr(body?.workerName).trim(),
    sessionSlug: toStr(body?.sessionSlug).trim(),
    sessionWorkerOrigin: toStr(body?.sessionWorkerOrigin || body?.sessionWorkerUrl).trim(),
    authorityMode: toStr(body?.authorityMode).trim(),
    sessionId: toStr(body?.sessionId).trim().toLowerCase(),
    sessionIdHex: toStr(body?.sessionIdHex).trim().toLowerCase(),
    adminAddress: toStr(body?.adminAddress).trim().toLowerCase(),
  }));
  const bundleCorrectionBody = { ...(isObj(body) ? body : {}) };
  delete bundleCorrectionBody.deploymentRequestId;
  delete bundleCorrectionBody.accountId;
  delete bundleCorrectionBody.apiToken;
  delete bundleCorrectionBody.token;
  delete bundleCorrectionBody.bundleText;
  delete bundleCorrectionBody.bundleUrl;
  const bundleCorrectionDigest = await sha256Hex(stableCanonicalSerialize({
    body: bundleCorrectionBody,
    requestOrigin: normalizeOrigin(requestOrigin) || toStr(requestOrigin).trim(),
  }));
  const deploymentId = await sha256Hex(`context-engine-deployment:${deploymentRequestId}`);
  return {
    deploymentRequestId,
    requestDigest,
    // Keep the payload-specific digest even when coordinated recovery swaps
    // requestDigest for a stable infrastructure identity below.
    fullRequestDigest: requestDigest,
    immutableIdentityDigest,
    bundleCorrectionDigest,
    deploymentId,
    requestMarker: deploymentId.slice(0, 16),
    workerName: buildFreshDeploymentName(body?.workerName, deploymentId),
    journalKey: `${DEPLOYMENT_JOURNAL_PREFIX}${deploymentId}`,
    uploadJournalKey: `${DEPLOYMENT_JOURNAL_PREFIX}${deploymentId}:upload`,
    uploadRejectedJournalKey: `${DEPLOYMENT_JOURNAL_PREFIX}${deploymentId}:upload-rejected`,
    terminalJournalKey: `${DEPLOYMENT_JOURNAL_PREFIX}${deploymentId}:terminal`,
    isReplay: false,
  };
};

const readDeployJournalRecord = async (binding, key) => {
  const raw = await binding.get(key);
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return isObj(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeDeployJournalRecord = async (binding, key, record) => binding.put(
  key,
  JSON.stringify(record),
  { expirationTtl: DEPLOYMENT_JOURNAL_TTL_SECONDS },
);

// A rejected bundle may need correction after the ordinary replay journals
// expire. Keep this non-secret authority until a terminal receipt commits;
// using a distinct key also avoids Workers KV's same-key write-rate limit.
const writeDurableDeployJournalRecord = async (binding, key, record) => binding.put(
  key,
  JSON.stringify(record),
);

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

  const rawCloudflare = isObj(raw.cloudflare) ? raw.cloudflare : {};
  const rawAccess = isObj(raw.payloadAccessControl) ? raw.payloadAccessControl : {};
  const accessMode = normalizePayloadAccessMode(
    rawAccess.mode ||
    rawCloudflare.payloadAccessMode ||
    raw.payloadAccessMode ||
    raw.accessControlMode
  );
  const litEncrypted = accessMode === PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  const publicRead = accessMode === PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  profile.payloadAccessControl = {
    mode: accessMode,
    enforcement: litEncrypted
      ? 'lit_access_control_conditions'
      : (publicRead ? 'session_worker_public_read' : 'session_worker_sbt_gate'),
    litRequired: litEncrypted,
    label: litEncrypted
      ? 'Lit-encrypted Cloudflare payloads'
      : (publicRead ? 'Public-read Cloudflare payloads' : 'Worker-enforced SBT access control'),
    resources: {
      ...DEFAULT_PAYLOAD_ACCESS_RESOURCES,
      ...(isObj(rawAccess.resources) ? rawAccess.resources : {}),
    },
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

const isAmbiguousCloudflareMutationFailure = (result = {}) => {
  const status = Number(result?.status || 0);
  return !status || status >= 500 || [408, 409, 412, 425, 429, 499].includes(status);
};

const isDefinitiveWorkerUploadRejection = (result = {}) => {
  const status = Number(result?.status || 0);
  if (status < 400 || status >= 500) return false;
  // Timeout, conflict, precondition, early-data, throttling, and client-closed
  // responses can race a concurrent or partially observed mutation. Preserve
  // staged resources for those ambiguous cases; ordinary validation/auth 4xx
  // responses prove that this upload did not install the script.
  return !new Set([408, 409, 412, 425, 429, 499]).has(status);
};

export const ensureWorkersDevAccountSubdomain = async ({
  apiToken,
  accountId,
  requestedSubdomain = '',
  fetchImpl = globalThis.fetch,
  apiBaseUrl = '',
  env = null,
} = {}) => {
  let subdomain = null;
  let subdomainStatus = '';
  let subdomainEnabled = false;
  let subdomainError = '';
  const activationFailures = [];

  const fallbackSubdomain = accountId
    ? `ce-${toStr(accountId).replace(/[^a-z0-9-]/gi, '').slice(0, 10)}`
    : '';

  const cfFetchOptions = { fetchImpl, apiBaseUrl, env };

  const subdomainResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/subdomain`, {}, cfFetchOptions);
  if (subdomainResp.ok) {
    subdomain = subdomainResp.data?.result?.subdomain || null;
    subdomainStatus = subdomainResp.data?.result?.status || '';
  } else {
    activationFailures.push(subdomainResp);
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
      activationFailures.push(enableResp);
      subdomainError = enableResp.error || 'Failed to enable workers.dev subdomain.';
    }
  };

  if (!subdomain) {
    await ensureAccountSubdomain(toStr(requestedSubdomain).trim() || fallbackSubdomain);
  } else if (subdomainStatus && subdomainStatus !== 'active') {
    await ensureAccountSubdomain(subdomain);
  }

  const fallbackEligible = !subdomain && activationFailures.length > 0 &&
    activationFailures.every((failure) => shouldAllowFallbackForCloudflareFailure(failure));
  return {
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    fallbackEligible,
  };
};

export const ensureWorkersDevSubdomain = async ({
  apiToken,
  accountId,
  workerName,
  requestedSubdomain = '',
  knownAccountSubdomain = null,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = '',
  env = null,
} = {}) => {
  const cfFetchOptions = { fetchImpl, apiBaseUrl, env };
  const accountSubdomain = knownAccountSubdomain || await ensureWorkersDevAccountSubdomain({
    apiToken,
    accountId,
    requestedSubdomain,
    fetchImpl,
    apiBaseUrl,
    env,
  });
  const {
    subdomain = null,
    subdomainStatus = '',
    subdomainEnabled = false,
    subdomainError = '',
  } = accountSubdomain;
  let scriptSubdomainEnabled = false;
  let scriptSubdomainError = '';
  const activationFailures = [];
  if (!subdomain && accountSubdomain?.fallbackEligible) activationFailures.push({ status: 503 });

  if (subdomain) {
    const scriptSubdomainResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }, cfFetchOptions);
    if (scriptSubdomainResp.ok) {
      scriptSubdomainEnabled = scriptSubdomainResp.data?.result?.enabled === true;
      if (!scriptSubdomainEnabled) {
        activationFailures.push({ status: 503 });
        scriptSubdomainError = 'Cloudflare did not enable workers.dev for this Worker.';
      }
    } else {
      activationFailures.push(scriptSubdomainResp);
      scriptSubdomainError = scriptSubdomainResp.error || 'Failed to enable workers.dev for script.';
    }
  }

  const workerUrl = subdomain && scriptSubdomainEnabled ? `https://${workerName}.${subdomain}.workers.dev/` : '';
  const fallbackEligible = !workerUrl && activationFailures.length > 0 &&
    activationFailures.every((failure) => shouldAllowFallbackForCloudflareFailure(failure));
  return {
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
    workerUrl,
    fallbackEligible,
  };
};

const resolveDeploymentAccountId = async ({
  body,
  fetchImpl,
  apiBaseUrl = '',
  env = null,
} = {}) => {
  // Account selection is a property of the token, never caller input. This
  // keeps embedded and sponsored deploys inside the token's single-account scope.
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

const executeDeployHelperRequestCore = async ({
  body,
  env,
  requestOrigin = '',
  fetchImpl = globalThis.fetch,
  consoleImpl = console,
  idempotencyContext = null,
  resolvedAccountId = '',
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
  if (body?.deploymentKind === AGENT_SESSION_WRAPPED_DEPLOYMENT_KIND) {
    if (!apiToken) return buildFailure(400, { error: 'Missing apiToken.' });
    const accountLookup = toStr(resolvedAccountId).trim()
      ? { ok: true, accountId: toStr(resolvedAccountId).trim() }
      : await resolveDeploymentAccountId({ body, fetchImpl, apiBaseUrl, env });
    if (!accountLookup.ok) {
      const lookupStatus = Number(accountLookup.status || 0);
      return buildFailure(lookupStatus === 404 || lookupStatus === 409 ? lookupStatus : 502, {
        error: accountLookup.error || 'Failed to resolve Cloudflare account.',
        detail: accountLookup.detail,
      }, { fallbackEligible: accountLookup.fallbackEligible === true });
    }
    return executeAgentSessionWrappedDeployment({
      body,
      env,
      accountId: toStr(accountLookup.accountId).trim(),
      cfFetchImpl: (token, path, options) => cfFetch(token, path, options, cfFetchOptions),
      fetchImpl,
      markMutationStarted: idempotencyContext?.markMutationStarted,
    });
  }
  const requestedWorkerName = toStr(body?.workerName).trim();
  const defaultSlugInput = env?.DEFAULT_SESSION_SLUG ?? env?.DEFAULT_GROUP_SLUG ?? '';
  const defaultSlugCheck = validateInboundSlug(defaultSlugInput);
  if (body?.sessionSlug == null && !defaultSlugCheck.ok) {
    return buildFailure(400, { error: defaultSlugCheck.error });
  }
  const defaultSlug = defaultSlugCheck.slug;
  const sessionSlug = body?.sessionSlug != null ? sessionSlugCheck.slug : defaultSlug;
  const displaySlug = sessionSlug || 'general';
  const bundleText = typeof body?.bundleText === 'string'
    ? body.bundleText
    : toStr(body?.bundleText);
  const hasBundleText = bundleText.trim() !== '';
  const bundleUrl = toStr(body?.bundleUrl || env?.WORKER_BUNDLE_URL).trim();
  const expectedInlineBundleSha256 = hasBundleText ? await sha256Hex(bundleText) : '';
  const suppliedBundleSha256 = toStr(body?.bundleSha256).trim();
  let expectedBundleSha256 = normalizeWorkerBundleSha256(suppliedBundleSha256);
  let bundleSource = hasBundleText ? bundleText : '';
  const bundleSourceKind = hasBundleText ? 'bundleText' : 'bundleUrl';
  let bundleDiagnostics = null;

  if (!apiToken) return buildFailure(400, { error: 'Missing apiToken.' });
  if (!requestedWorkerName) return buildFailure(400, { error: 'Missing workerName.' });
  if (suppliedBundleSha256 && !expectedBundleSha256) {
    return buildFailure(400, { error: 'bundleSha256 must be a complete SHA-256 hex digest.' });
  }
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
  });
  if (!accountLookup.ok) {
    const lookupStatus = Number(accountLookup.status || 0);
    const responseStatus = lookupStatus === 404 || lookupStatus === 409 ? lookupStatus : 502;
    return buildFailure(responseStatus, {
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
  const groupCreationPolicy = body?.groupCreationPolicy == null
    ? 'admin_only'
    : toStr(body.groupCreationPolicy).trim().toLowerCase();
  if (!['admin_only', 'participants'].includes(groupCreationPolicy)) {
    return buildFailure(400, {
      error: 'groupCreationPolicy must be "admin_only" or "participants".',
    });
  }
  if (workerCanonicalRequested && !/^0x[0-9a-f]{40}$/i.test(adminAddress)) {
    return buildFailure(400, { error: 'A valid adminAddress is required for worker-canonical deploys.' });
  }
  const workerCanonicalAuthority = workerCanonicalRequested
    ? resolveWorkerCanonicalAuthorityForDeploy(body?.workerAuthority)
    : { ok: true, value: null };
  if (!workerCanonicalAuthority.ok) {
    return buildFailure(400, { error: workerCanonicalAuthority.error });
  }
  const deploymentId = toStr(idempotencyContext?.deploymentId).trim() || randomSecret();
  // Treat the caller-supplied name as a readable prefix. Legacy requests get a
  // random suffix; stable request IDs derive one deterministic suffix so lost
  // responses converge on the same physical script instead of creating peers.
  const workerName = toStr(idempotencyContext?.workerName).trim()
    || buildFreshDeploymentName(requestedWorkerName, deploymentId);
  const buildDeploymentFailure = (status, payload, options) => buildFailure(status, {
    ...payload,
    // This is the non-secret marker embedded in CE_DEPLOYMENT_ID. Preserve it
    // on partial-deploy failures so a caller can verify ownership before
    // retrying cleanup of any reported orphan resources.
    ...(Object.hasOwn(payload || {}, 'orphanResources') ? { accountId, deploymentId } : {}),
  }, options);
  const workerNamePreflight = await cfFetch(
    apiToken,
    `/accounts/${accountId}/workers/scripts/${workerName}/settings`,
    { method: 'GET' },
    cfFetchOptions,
  );
  const workerNameConfirmedAbsent = !workerNamePreflight.ok && Number(workerNamePreflight.status || 0) === 404;
  // A non-404 lookup failure cannot distinguish an available name from a live
  // worker, so every deploy mode fails closed before provisioning resources.
  if (!workerNamePreflight.ok && !workerNameConfirmedAbsent) {
    return buildFailure(502, {
      error: workerNamePreflight.error || 'Failed to determine whether the worker already exists.',
      detail: workerNamePreflight.detail,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(workerNamePreflight),
    });
  }
  // Updating a named worker in place cannot be rollback-safe while its KV
  // namespace may contain auth markers, groups, storage indexes, and wrapped
  // envelope keys that are not part of this deploy request. Require a fresh
  // script name until an explicit state-migration workflow exists.
  if (workerNamePreflight.ok) {
    return buildFailure(409, {
      error: `Worker name "${workerName}" already exists. In-place redeploy is disabled to protect existing worker state. Choose a new worker name before retrying.`,
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

  const prepareBundleDiagnostics = async () => {
    if (bundleDiagnostics) return { ok: true };
    if (!bundleSource) {
      let bundleResp;
      try {
        bundleResp = await fetchImpl(bundleUrl);
      } catch (err) {
        return {
          ok: false,
          result: buildFailure(502, {
            error: `Failed to fetch bundle: ${toStr(err?.message || err).trim() || 'Unknown error.'}`,
          }, { fallbackEligible: true }),
        };
      }
      if (!bundleResp.ok) {
        return {
          ok: false,
          result: buildFailure(502, {
            error: `Failed to fetch bundle (${bundleResp.status}).`,
          }, {
            fallbackEligible: bundleResp.status >= 500 || bundleResp.status === 429,
          }),
        };
      }
      bundleSource = await bundleResp.text();
    }
    bundleDiagnostics = await buildBundleDiagnostics(bundleSource, bundleSourceKind);
    if (expectedBundleSha256 && bundleDiagnostics.sha256 !== expectedBundleSha256) {
      return {
        ok: false,
        result: buildFailure(409, {
          error: 'Worker bundle SHA-256 does not match the verified release manifest.',
        }),
      };
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

  const kvCreate = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `ContextEngineSessionCorsWorker:${displaySlug}` }),
  }, { fetchImpl });
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
      { name: 'DEPLOY_HELPER_ENABLED', type: 'plain_text', text: embeddedDeployHelperEnabled ? '1' : '0' },
    ],
    compatibility_date: toStr(env?.WORKER_COMPATIBILITY_DATE || DEFAULT_COMPAT_DATE),
    compatibility_flags: ['nodejs_compat'],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  form.append('worker.mjs', new Blob([bundleSource], { type: 'application/javascript+module' }), 'worker.mjs');

  const scriptUpload = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}`, {
    method: 'PUT',
    body: form,
  }, { fetchImpl });
  if (!scriptUpload.ok) {
    consoleImpl?.error?.('[deploy-helper] script upload failed', JSON.stringify({
      workerName,
      sessionSlug: displaySlug,
      diagnostics: {
        ...bundleDiagnostics,
        prefix: bundleDiagnostics.prefix,
        suffix: bundleDiagnostics.suffix,
      },
    }));
    return { ok: true };
  };

  const config = {
    slug: sessionSlug,
    authzEpoch: 1,
    workerGroupsBootstrap: {
      version: 2,
      state: 'fresh_empty',
      bootstrapId: deploymentId,
    },
    adminAddress,
    allowOrigins,
    limits,
    scopes,
    corsWorkerUrl: anticipatedWorkerUrl,
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
    groupCreationPolicy,
  };
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
  // Every Session Worker needs a KEK for its canonical secret record, even
  // when payload-level worker-envelope encryption is not selected. The shared
  // envelope helper derives a domain-separated AES key from this value.
  const envelopeKekSecretRequired = true;
  const candidateEnvelopeKekSecret = randomSecret();
  const secretsEnvelope = await buildEncryptedSessionSecretsEnvelope(secrets, {
    env: { [STORAGE_ENVELOPE_KEK_SECRET_NAME]: candidateEnvelopeKekSecret },
    slug: sessionSlug || displaySlug,
  });

  const requestMarker = toStr(idempotencyContext?.requestMarker).trim();
  const kvTitleSuffix = requestMarker ? `:req-${requestMarker}` : '';
  const kvTitlePrefix = `ContextEngineSessionCorsWorker:${displaySlug}`
    .slice(0, KV_NAMESPACE_TITLE_MAX_LENGTH - kvTitleSuffix.length);
  const kvNamespaceTitle = `${kvTitlePrefix}${kvTitleSuffix}`;
  const findRequestMarkedKvNamespaces = async () => {
    const matches = [];
    let page = 1;
    let totalPages = 1;
    do {
      const listResult = await cfFetch(
        apiToken,
        `/accounts/${accountId}/storage/kv/namespaces?per_page=100&page=${page}`,
        { method: 'GET' },
        cfFetchOptions,
      );
      if (!listResult.ok) return { ok: false, result: listResult, matches: [] };
      const namespaces = Array.isArray(listResult.data?.result) ? listResult.data.result : [];
      matches.push(...namespaces.filter((namespace) => (
        toStr(namespace?.title).trim() === kvNamespaceTitle && toStr(namespace?.id).trim()
      )));
      const reportedTotalPages = Number(listResult.data?.result_info?.total_pages || 1) || 1;
      if (reportedTotalPages > 1000) {
        return {
          ok: false,
          result: { error: 'KV namespace inventory is too large to reconcile safely.', status: 409 },
          matches: [],
        };
      }
      totalPages = Math.max(1, reportedTotalPages);
      page += 1;
    } while (page <= totalPages);
    return { ok: true, matches };
  };

  const workerSettingsMatchDeployment = (
    settingsResult,
    namespaceId,
    { ignoreBundleIdentity = false } = {},
  ) => {
    if (!settingsResult?.ok || !namespaceId) return false;
    const settings = settingsResult.data?.result || {};
    const bindings = Array.isArray(settings?.bindings)
      ? settings.bindings
      : [];
    const named = (name) => bindings.filter((binding) => toStr(binding?.name).trim() === name);
    const hasExactPlainText = (name, expected, { caseInsensitive = false } = {}) => {
      const matches = named(name);
      if (matches.length !== 1 || toStr(matches[0]?.type).trim() !== 'plain_text') return false;
      const actual = toStr(matches[0]?.text).trim();
      return caseInsensitive ? actual.toLowerCase() === expected.toLowerCase() : actual === expected;
    };
    const hasExactKv = (name, expectedNamespaceId) => {
      const matches = named(name);
      return matches.length === 1 &&
        toStr(matches[0]?.type).trim() === 'kv_namespace' &&
        toStr(matches[0]?.namespace_id).trim() === expectedNamespaceId;
    };
    const hasExactR2 = (name, expectedBucketName) => {
      const matches = named(name);
      return matches.length === 1 &&
        toStr(matches[0]?.type).trim() === 'r2_bucket' &&
        toStr(matches[0]?.bucket_name).trim() === expectedBucketName;
    };
    const hasExactDurableObject = (name, expectedClassName) => {
      const matches = named(name);
      return matches.length === 1 &&
        toStr(matches[0]?.type).trim() === 'durable_object_namespace' &&
        toStr(matches[0]?.class_name).trim() === expectedClassName;
    };
    const observedMainModule = toStr(settings?.main_module).trim();
    const moduleIdentityMatches = !observedMainModule || observedMainModule === 'worker.mjs';
    const storageIndexMatches = storageBindingPlan.requiresStorageIndexKv
      ? hasExactKv('CE_STORAGE_INDEX_KV', namespaceId)
      : named('CE_STORAGE_INDEX_KV').length === 0;
    const r2Matches = storageBindingPlan.r2BucketName
      ? hasExactR2('CE_STORAGE_R2', storageBindingPlan.r2BucketName)
      : named('CE_STORAGE_R2').length === 0;
    const adminMatches = adminAddress
      ? hasExactPlainText('BOOTSTRAP_ADMIN_ADDRESS', adminAddress, { caseInsensitive: true })
      : named('BOOTSTRAP_ADMIN_ADDRESS').length === 0;
    const bundleIdentityBindings = named(BUNDLE_SHA256_BINDING_NAME);
    const observedBundleSha256 = bundleIdentityBindings.length === 1 &&
      toStr(bundleIdentityBindings[0]?.type).trim() === 'plain_text'
      ? toStr(bundleIdentityBindings[0]?.text).trim().toLowerCase()
      : '';
    const expectedBundleSha256 = bundleDiagnostics?.sha256 ||
      expectedInlineBundleSha256 ||
      toStr(idempotencyContext?.bundleSha256).trim().toLowerCase();
    const bundleIdentityMatches = /^[0-9a-f]{64}$/.test(observedBundleSha256) &&
      (ignoreBundleIdentity || !expectedBundleSha256 || observedBundleSha256 === expectedBundleSha256);
    const requestDigestMatches = requestMarker
      ? hasExactPlainText(DEPLOYMENT_REQUEST_DIGEST_BINDING_NAME, toStr(idempotencyContext?.requestDigest).trim())
      : named(DEPLOYMENT_REQUEST_DIGEST_BINDING_NAME).length === 0;
    return moduleIdentityMatches &&
      hasExactPlainText(DEPLOYMENT_ID_BINDING_NAME, deploymentId) &&
      requestDigestMatches &&
      bundleIdentityMatches &&
      hasExactDurableObject(SESSION_COORDINATOR_BINDING_NAME, SESSION_COORDINATOR_CLASS_NAME) &&
      hasExactKv('GROUP_KV', namespaceId) &&
      storageIndexMatches &&
      r2Matches &&
      adminMatches &&
      hasExactPlainText('DEFAULT_SESSION_SLUG', sessionSlug) &&
      hasExactPlainText('DEPLOY_HELPER_ENABLED', embeddedDeployHelperEnabled ? '1' : '0');
  };
  const readWorkerBundleSha256 = (settingsResult) => {
    const bindings = Array.isArray(settingsResult?.data?.result?.bindings)
      ? settingsResult.data.result.bindings
      : [];
    const matches = bindings.filter((binding) => (
      toStr(binding?.name).trim() === BUNDLE_SHA256_BINDING_NAME &&
      toStr(binding?.type).trim() === 'plain_text'
    ));
    const value = matches.length === 1 ? toStr(matches[0]?.text).trim().toLowerCase() : '';
    return /^[0-9a-f]{64}$/.test(value) ? value : '';
  };

  let kvId = '';
  let resumeUploadedWorker = false;
  let resumeWorkerSettings = mayResumeExistingWorker ? workerNamePreflight : null;
  let replaceRejectedWorker = idempotencyContext?.definitiveUploadRejected === true;
  let createdKvThisInvocation = false;
  let uploadedWorkerThisInvocation = false;
  if (requestMarker) {
    const existingMarkedNamespaces = await findRequestMarkedKvNamespaces();
    if (!existingMarkedNamespaces.ok) {
      const reconciliationRetryable = Number(existingMarkedNamespaces.result?.status || 0) === 404 ||
        shouldAllowFallbackForCloudflareFailure(existingMarkedNamespaces.result);
      return buildFailure(502, {
        error: existingMarkedNamespaces.result?.error || 'Failed to reconcile deployment KV namespace.',
        detail: existingMarkedNamespaces.result?.detail,
        ...(reconciliationRetryable ? { deploymentRequestPending: true } : {}),
      }, {
        fallbackEligible: reconciliationRetryable,
      });
    }
    if (existingMarkedNamespaces.matches.length > 1) {
      return buildFailure(409, {
        error: 'Multiple KV namespaces share this deployment request marker; deployment stopped.',
      });
    }
    if (mayResumeExistingWorker && existingMarkedNamespaces.matches.length === 0) {
      return buildFailure(503, {
        error: 'Existing worker is visible before its request-marked KV namespace. Retry the same deployment request.',
        deploymentRequestPending: true,
      }, {
        fallbackEligible: true,
      });
    }
    if (existingMarkedNamespaces.matches.length === 1) {
      if (idempotencyContext?.isReplay !== true && !mayResumeExistingWorker) {
        return buildFailure(409, {
          error: 'A KV namespace already uses this new deployment request marker; deployment stopped.',
          deploymentRequestPending: true,
        });
      }
      kvId = toStr(existingMarkedNamespaces.matches[0]?.id).trim();
    }
  }

  if (
    !resumeWorkerSettings &&
    workerNameConfirmedAbsent &&
    idempotencyContext?.isReplay === true &&
    idempotencyContext?.uploadStarted === true &&
    kvId
  ) {
    // A request-marked namespace proves mutation may already have happened.
    // Recheck an initially invisible script before any staging write; a
    // persistent 404 remains pending instead of risking an overwrite.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const retrySettings = await cfFetch(
        apiToken,
        `/accounts/${accountId}/workers/scripts/${workerName}/settings`,
        { method: 'GET' },
        cfFetchOptions,
      );
      if (retrySettings.ok) {
        resumeWorkerSettings = retrySettings;
        break;
      }
      if (Number(retrySettings.status || 0) !== 404) {
        return buildFailure(502, {
          error: retrySettings.error || 'Failed to recheck deployment Worker during resume.',
          detail: retrySettings.detail,
          deploymentRequestPending: true,
        }, { fallbackEligible: true });
      }
    }
  }

  if (resumeWorkerSettings) {
    if (idempotencyContext?.definitiveUploadRejected === true) {
      const preparedBundle = await prepareBundleDiagnostics();
      if (!preparedBundle.ok) return preparedBundle.result;
      if (!workerSettingsMatchDeployment(resumeWorkerSettings, kvId, { ignoreBundleIdentity: true })) {
        return buildFailure(409, {
          error: 'Existing worker does not match this deployment request; required bindings differ and resume stopped.',
          deploymentRequestPending: true,
        });
      }
      if (readWorkerBundleSha256(resumeWorkerSettings) === bundleDiagnostics.sha256) {
        resumeUploadedWorker = true;
      } else {
        replaceRejectedWorker = true;
      }
      idempotencyContext.mutationStarted = true;
    } else if (!workerSettingsMatchDeployment(resumeWorkerSettings, kvId)) {
      return buildFailure(409, {
        error: 'Existing worker does not match this deployment request; required bindings differ and resume stopped.',
        deploymentRequestPending: true,
      });
    } else {
      resumeUploadedWorker = true;
      idempotencyContext.mutationStarted = true;
    }
  }

  // An exactly owned uploaded Worker already contains the requested module.
  // Do not make recovery depend on the original bundle host still being
  // reachable; bundle acquisition belongs only to the upload path.
  if (!resumeUploadedWorker) {
    const preparedBundle = await prepareBundleDiagnostics();
    if (!preparedBundle.ok) return preparedBundle.result;
    if (
      idempotencyContext?.bundleSha256 &&
      toStr(idempotencyContext.bundleSha256).trim().toLowerCase() !== bundleDiagnostics.sha256 &&
      idempotencyContext?.definitiveUploadRejected !== true
    ) {
      return buildFailure(409, {
        error: 'Deployment bundle content changed after this request started; upload was stopped.',
        deploymentRequestPending: true,
      });
    }
  }

  let kvCreate = null;
  if (!kvId) {
    try {
      // Keep the durable stage transition immediately adjacent to the first
      // mutation. Reserved requests may retry preflight; started requests only
      // re-POST the same uniqueness-enforced title and reconcile its result.
      await idempotencyContext?.markMutationStarted?.();
    } catch (error) {
      return buildFailure(503, {
        error: `Failed to advance deployment request journal: ${toStr(error?.message || error).trim() || 'Unknown error.'}`,
      }, { fallbackEligible: true });
    }
    kvCreate = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: kvNamespaceTitle }),
    }, cfFetchOptions);
    kvId = toStr(kvCreate.data?.result?.id).trim();
    createdKvThisInvocation = kvCreate.ok && !!kvId;
    if (!kvId && requestMarker) {
      for (let attempt = 0; attempt <= NEW_KV_NAMESPACE_RETRY_DELAYS_MS.length; attempt += 1) {
        const reconciled = await findRequestMarkedKvNamespaces();
        if (!reconciled.ok) break;
        if (reconciled.matches.length > 1) {
          return buildFailure(409, {
            error: 'Multiple KV namespaces share this deployment request marker; deployment stopped.',
          });
        }
        if (reconciled.matches.length === 1) {
          kvId = toStr(reconciled.matches[0]?.id).trim();
          break;
        }
        const delayMs = NEW_KV_NAMESPACE_RETRY_DELAYS_MS[attempt];
        if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    if (!kvId) {
      const createStatus = Number(kvCreate?.status || 0);
      const createMayHaveCommitted = (
        requestMarker && (
          kvCreate?.ok === true ||
          createStatus === 400 ||
          createStatus === 409 ||
          shouldAllowFallbackForCloudflareFailure(kvCreate)
        )
      );
      return buildFailure(createMayHaveCommitted ? 503 : 502, {
        error: kvCreate?.error || 'Failed to create or reconcile KV namespace.',
        detail: kvCreate?.detail,
        ...(createMayHaveCommitted ? { deploymentRequestPending: true } : {}),
      }, {
        fallbackEligible: kvCreate ? shouldAllowFallbackForCloudflareFailure(kvCreate) : true,
      });
    }
  }
  const cleanupStagedKv = async () => {
    if (!createdKvThisInvocation) {
      return { kvNamespaceId: kvId, kvCleanupStatus: 'retained-pre-existing' };
    }
    const kvCleanup = await cfFetch(
      apiToken,
      `/accounts/${accountId}/storage/kv/namespaces/${kvId}`,
      { method: 'DELETE' },
      cfFetchOptions,
    );
    return kvCleanup.ok
      ? { kvNamespaceId: '' }
      : { kvNamespaceId: kvId, kvCleanupStatus: 'delete-failed' };
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
    const orphanKv = await cleanupStagedKv();
    return buildFailure(502, {
      error: configPut.error,
      detail: configPut.detail,
      orphanResources: { ...orphanKv, workerName: '' },
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(configPut),
    });
    if (!configPut.ok) {
      const orphanKv = await cleanupStagedKv();
      return buildDeploymentFailure(502, {
        error: configPut.error,
        detail: configPut.detail,
        orphanResources: { ...orphanKv, workerName: '' },
      }, {
        fallbackEligible: shouldAllowFallbackForCloudflareFailure(configPut),
      });
    }

    // Stage both canonical records before a new script can become reachable.
    // This avoids a first-write or missing-secret interval during fresh deploys.
    const secretsEnvelopeBody = JSON.stringify(secretsEnvelope);
    const secretsPut = await putFreshKvNamespaceValue({
      apiToken,
      path: `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionSecretsKey}`,
      options: {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: secretsEnvelopeBody,
      },
      cfFetchOptions,
    });
    if (!secretsPut.ok) {
      const orphanKv = await cleanupStagedKv();
      return buildDeploymentFailure(502, {
        error: secretsPut.error,
        detail: secretsPut.detail,
        orphanResources: { ...orphanKv, workerName: '' },
      }, {
        fallbackEligible: shouldAllowFallbackForCloudflareFailure(secretsPut),
      });
    }
  }

  // Stage both canonical records before a new script can become reachable.
  // This avoids a first-write or missing-secret interval during fresh deploys.
  const secretsPut = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionSecretsKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(secretsEnvelope),
  }, cfFetchOptions);
  if (!secretsPut.ok) {
    const orphanKv = await cleanupStagedKv();
    return buildFailure(502, {
      error: secretsPut.error,
      detail: secretsPut.detail,
      orphanResources: { ...orphanKv, workerName: '' },
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(secretsPut),
    });
  }

  const envelopeKekSecretRequired = deployStorageRequiresEnvelopeKek(storageProfile);
  const tokenSecret = randomSecret();
  const envelopeKekSecret = envelopeKekSecretRequired ? randomSecret() : '';
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
      ...(requestMarker
        ? [{ name: DEPLOYMENT_REQUEST_DIGEST_BINDING_NAME, type: 'plain_text', text: idempotencyContext.requestDigest }]
        : []),
      { name: BUNDLE_SHA256_BINDING_NAME, type: 'plain_text', text: bundleDiagnostics?.sha256 || expectedInlineBundleSha256 },
      {
        name: SESSION_COORDINATOR_BINDING_NAME,
        type: 'durable_object_namespace',
        class_name: SESSION_COORDINATOR_CLASS_NAME,
      },
      { name: 'DEPLOY_HELPER_ENABLED', type: 'plain_text', text: embeddedDeployHelperEnabled ? '1' : '0' },
    ],
    migrations: {
      old_tag: '',
      new_tag: SESSION_COORDINATOR_MIGRATION_TAG,
      new_sqlite_classes: [SESSION_COORDINATOR_CLASS_NAME],
    },
    compatibility_date: toStr(env?.WORKER_COMPATIBILITY_DATE || DEFAULT_COMPAT_DATE),
    compatibility_flags: ['nodejs_compat'],
  };
  const cleanupDeploymentResources = async () => {
    let removableWorkerName = '';
    let workerCleanupStatus = '';
    const cleanupWorkerIfOwned = async () => {
      const settingsResp = await cfFetch(
        apiToken,
        `/accounts/${accountId}/workers/scripts/${workerName}/settings`,
        { method: 'GET' },
        cfFetchOptions,
      );
      if (!settingsResp.ok) {
        if (Number(settingsResp.status || 0) === 404) return true;
        workerCleanupStatus = 'ownership-unverified';
        return false;
      }
      const settingsResp = await readWorkerSettingsAfterUpload();
      if (!settingsResp.ok) {
        workerCleanupStatus = 'ownership-unverified';
        return false;
      }
      const deploymentStillOwned = workerSettingsMatchDeployment(settingsResp, kvId);
      if (!deploymentStillOwned) {
        workerCleanupStatus = 'ownership-changed';
        return false;
      }
      const scriptCleanup = await cfFetch(
        apiToken,
        `/accounts/${accountId}/workers/scripts/${workerName}?force=true`,
        { method: 'DELETE' },
        cfFetchOptions,
      );
      if (!scriptCleanup.ok) {
        removableWorkerName = workerName;
        workerCleanupStatus = 'owned-delete-failed';
        return false;
      }
      return true;
    };
    // The uploaded script may have been applied even when Cloudflare's response
    // was lost. Delete its KV only after the script is confirmed absent or an
    // exactly-owned deployment is deleted; otherwise retain the namespace so a
    // live or concurrently changed script is never left with a broken binding.
    const workerConfirmedAbsent = await cleanupWorkerIfOwned();
    if (!workerConfirmedAbsent) {
      return {
        kvNamespaceId: kvId,
        kvCleanupStatus: 'retained-live-worker',
        workerName: removableWorkerName,
        ...(workerCleanupStatus ? { workerCleanupStatus } : {}),
      };
    }
    const kvCleanup = await cfFetch(
      apiToken,
      `/accounts/${accountId}/storage/kv/namespaces/${kvId}`,
      { method: 'DELETE' },
      cfFetchOptions,
    );
    return {
      kvNamespaceId: kvCleanup.ok ? '' : kvId,
      ...(!kvCleanup.ok ? { kvCleanupStatus: 'delete-failed' } : {}),
      workerName: removableWorkerName,
      ...(workerCleanupStatus ? { workerCleanupStatus } : {}),
    };
  };

  const buildScriptUploadForm = ({ omitMigrations = false } = {}) => {
    const uploadMetadata = {
      ...metadata,
      ...(replaceRejectedWorker ? { keep_bindings: ['secret_text'] } : {}),
    };
    if (omitMigrations) delete uploadMetadata.migrations;
    const uploadForm = new FormData();
    uploadForm.append(
      'metadata',
      new Blob([JSON.stringify(uploadMetadata)], { type: 'application/json' }),
      'metadata.json',
    );
    uploadForm.append(
      'worker.mjs',
      new Blob([bundleSource], { type: 'application/javascript+module' }),
      'worker.mjs',
    );
    return uploadForm;
  };

  const scriptUploadPath = `/accounts/${accountId}/workers/scripts/${workerName}`;
  const scriptUpload = await cfFetch(apiToken, scriptUploadPath, {
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
    return buildDeploymentFailure(uploadedWorkerSettings.ok ? 409 : 502, {
      error: uploadedWorkerSettings.ok
        ? 'Worker ownership changed during deployment; runtime activation was stopped.'
        : uploadedWorkerSettings.error || 'Failed to verify worker ownership after upload.',
      detail: uploadedWorkerSettings.detail,
      orphanResources,
    }, {
      fallbackEligible: settingsVisibilityPending ||
        (!uploadedWorkerSettings.ok && shouldAllowFallbackForCloudflareFailure(uploadedWorkerSettings)),
    });
  }

  let envelopeKekSecretSet = false;
  const tokenSecretPreserved = resumedSecretBindings.has('TOKEN_HMAC_SECRET');
  const envelopeKekSecretPreserved = envelopeKekSecretRequired &&
    resumedSecretBindings.has(STORAGE_ENVELOPE_KEK_SECRET_NAME);
  const tokenSecret = tokenSecretPreserved
    ? ''
    : randomSecret();
  const envelopeKekSecret = envelopeKekSecretRequired && !envelopeKekSecretPreserved
    ? candidateEnvelopeKekSecret
    : '';

  const {
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
    workerUrl,
    fallbackEligible: activationFallbackEligible,
  } = await ensureWorkersDevSubdomain({
    apiToken,
    accountId,
    workerName,
    requestedSubdomain: toStr(body?.subdomain || body?.workersSubdomain).trim(),
    knownAccountSubdomain: accountSubdomain,
    fetchImpl,
    apiBaseUrl,
    env,
  });
  const deploymentPayload = {
    ok: true,
    accountId,
    workerName,
    workerUrl,
    resolvedSlug: displaySlug,
    kvNamespaceId: kvId,
    deploymentId,
    sessionConfigKey,
    sessionSecretsKey,
    sessionKvPrefix: 'session',
    writesSessionConfig: true,
    // A resumed upload preserves the namespace's existing secret envelope.
    // Mutable retry secrets must be applied by the signed post-deploy sync.
    writesSessionSecrets: !resumeUploadedWorker,
    tokenSecretSet: false,
    tokenSecretPreserved: false,
    envelopeKekSecretSet,
    envelopeKekSecretPreserved: false,
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
  };
  if (!workerUrl) {
    const orphanResources = await cleanupDeploymentResources();
    return buildDeploymentFailure(502, {
      error: subdomainError || scriptSubdomainError || 'Cloudflare did not return a shareable worker URL.',
      orphanResources,
    }, {
      fallbackEligible: activationFallbackEligible,
    });
  }
  if (workerUrl) {
    const configWithWorkerUrl = {
      ...config,
      corsWorkerUrl: workerUrl,
    };
    const readbackMatches = (result) => {
      const readbackConfig = result?.data?.result || result?.data || {};
      return result?.ok &&
        stableCanonicalSerialize(readbackConfig) === stableCanonicalSerialize(configWithWorkerUrl);
    };
    const configReadbackPath = `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionConfigKey}`;
    const resumedReadbackHasCompatibleIdentity = (result) => {
      if (!resumeUploadedWorker || !result?.ok) return false;
      const readbackConfig = result.data?.result || result.data || {};
      if (Object.keys(readbackConfig).length === 0) return false;
      return (
        toStr(readbackConfig.slug).trim() === toStr(configWithWorkerUrl.slug).trim() &&
        (!configWithWorkerUrl.sessionId ||
          toStr(readbackConfig.sessionId).trim() === toStr(configWithWorkerUrl.sessionId).trim()) &&
        (!configWithWorkerUrl.adminAddress ||
          toStr(readbackConfig.adminAddress).trim().toLowerCase() ===
            toStr(configWithWorkerUrl.adminAddress).trim().toLowerCase()) &&
        (!workerCanonicalRequested ||
          workerAuthorityPoliciesMatch(configWithWorkerUrl.workerAuthority, readbackConfig.workerAuthority))
      );
    };
    const readbackIsRetryable = (result) => {
      if (!result?.ok) {
        return isNewKvNamespacePropagationFailure(result) || shouldAllowFallbackForCloudflareFailure(result);
      }
      const readbackConfig = result.data?.result || result.data || {};
      if (Object.keys(readbackConfig).length === 0) return true;
      return false;
    };
    const readConfigWithRetry = async () => {
      let result = await cfFetch(apiToken, configReadbackPath, { method: 'GET' }, cfFetchOptions);
      for (const delayMs of FINAL_CONFIG_READBACK_RETRY_DELAYS_MS) {
        if (readbackMatches(result)) break;
        // Retry only classified transport/API failures or an empty read while
        // the initial KV write propagates. Non-empty config is evaluated once.
        if (!readbackIsRetryable(result)) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        result = await cfFetch(apiToken, configReadbackPath, { method: 'GET' }, cfFetchOptions);
      }
      return result;
    };

    const configReadback = await readConfigWithRetry();
    const configExactlyVerified = readbackMatches(configReadback);
    const resumedCompatibleConfig = !configExactlyVerified &&
      resumedReadbackHasCompatibleIdentity(configReadback);
    if (resumedCompatibleConfig) {
      // Never whole-replace a live identity-compatible config: runtime envelope
      // keys and publication markers are merged later through signed admin APIs.
      deploymentPayload.partial = true;
      deploymentPayload.writesSessionConfig = false;
    }
    const verified = configExactlyVerified || resumedCompatibleConfig;
    if (!verified) {
      const propagationPending = readbackIsRetryable(configReadback);
      const orphanResources = propagationPending
        ? {
            kvNamespaceId: kvId,
            kvCleanupStatus: 'retained-config-propagation-pending',
            workerName,
            workerCleanupStatus: 'retained-config-propagation-pending',
          }
        : await cleanupDeploymentResources();
      return buildDeploymentFailure(502, {
        error: 'Worker config verification failed after deployment.',
        orphanResources,
        ...(propagationPending ? { deploymentRequestPending: true } : {}),
      }, {
        fallbackEligible: propagationPending,
      });
    }
    deploymentPayload.configVerified = configExactlyVerified;
  }

  // Runtime secrets are written only after the public worker URL and canonical
  // config have both been verified. Existing scripts never reach this path.
  if (!deploymentPayload.tokenSecretSet) {
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
  }

  if (envelopeKekSecretRequired) {
    if (!deploymentPayload.envelopeKekSecretPreserved) {
      const envelopeKekResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}/secrets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: STORAGE_ENVELOPE_KEK_SECRET_NAME,
          type: 'secret_text',
          text: envelopeKekSecret,
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
    }
    envelopeKekSecretSet = true;
    deploymentPayload.envelopeKekSecretSet = true;
  }

  return buildSuccess(200, deploymentPayload);
};

const resolveDeploymentBundleProvenance = async ({ body = {}, env = {}, fetchImpl = globalThis.fetch } = {}) => {
  const resolvedBody = { ...(isObj(body) ? body : {}) };
  if (!toStr(resolvedBody.bundleManifestUrl)) {
    const defaultBundleManifestUrl = toStr(
      resolvedBody.deploymentKind === AGENT_SESSION_WRAPPED_DEPLOYMENT_KIND
        ? env?.AGENT_BRIDGE_BUNDLE_MANIFEST_URL
        : env?.WORKER_BUNDLE_MANIFEST_URL,
    );
    if (defaultBundleManifestUrl) resolvedBody.bundleManifestUrl = defaultBundleManifestUrl;
  }
  if (!toStr(resolvedBody.agentBridgeBundleManifestUrl)) {
    const defaultAgentManifestUrl = toStr(env?.AGENT_BRIDGE_BUNDLE_MANIFEST_URL);
    if (defaultAgentManifestUrl) resolvedBody.agentBridgeBundleManifestUrl = defaultAgentManifestUrl;
  }
  const resolveOne = async ({ manifestField, digestField, artifactFile, artifactKind }) => {
    const manifestUrl = toStr(resolvedBody[manifestField]).trim();
    if (!manifestUrl) return null;
    const manifestDigest = await fetchExpectedWorkerBundleDigest({
      manifestUrl,
      artifactFile,
      artifactKind,
      fetchImpl,
    });
    if (!manifestDigest.ok) return buildFailure(502, { error: manifestDigest.error });
    const supplied = toStr(resolvedBody[digestField]).trim();
    const suppliedDigest = normalizeWorkerBundleSha256(supplied);
    if (supplied && !suppliedDigest) {
      return buildFailure(400, { error: `${digestField} must be a complete SHA-256 hex digest.` });
    }
    if (suppliedDigest && suppliedDigest !== manifestDigest.digest) {
      return buildFailure(409, { error: `Worker release manifest digest conflicts with ${digestField}.` });
    }
    resolvedBody[digestField] = manifestDigest.digest;
    return null;
  };

  if (resolvedBody.deploymentKind === AGENT_SESSION_WRAPPED_DEPLOYMENT_KIND) {
    const failure = await resolveOne({
      manifestField: 'bundleManifestUrl',
      digestField: 'bundleSha256',
      artifactFile: 'agentBridgeWorker.bundle.js',
      artifactKind: 'agent-bridge-worker',
    });
    if (failure) return { ok: false, failure };
  } else {
    const sessionFailure = await resolveOne({
      manifestField: 'bundleManifestUrl',
      digestField: 'bundleSha256',
      artifactFile: 'sessionCorsWorker.bundle.js',
      artifactKind: 'session-cors-worker',
    });
    if (sessionFailure) return { ok: false, failure: sessionFailure };
    const bridgeFailure = await resolveOne({
      manifestField: 'agentBridgeBundleManifestUrl',
      digestField: 'agentBridgeBundleSha256',
      artifactFile: 'agentBridgeWorker.bundle.js',
      artifactKind: 'agent-bridge-worker',
    });
    if (bridgeFailure) return { ok: false, failure: bridgeFailure };
  }
  return { ok: true, body: resolvedBody };
};

export const executeDeployHelperRequest = async (options = {}) => {
  const provenance = await resolveDeploymentBundleProvenance({
    body: options?.body,
    env: options?.env,
    fetchImpl: options?.fetchImpl,
  });
  if (!provenance.ok) return provenance.failure;
  options = { ...options, body: provenance.body };
  const rawRequestId = toStr(options?.body?.deploymentRequestId).trim();
  if (!rawRequestId) return executeDeployHelperRequestCore(options);

  const context = await buildDeploymentRequestContext({
    body: options?.body,
    requestOrigin: options?.requestOrigin,
  });
  if (!context) {
    return buildFailure(400, {
      error: 'deploymentRequestId must contain 8-128 safe identifier characters.',
    });
  }
  const coordinatedRequestDigest = toStr(options?.coordinatedRequestDigest).trim().toLowerCase();
  if (options?.coordinationBypass === true && /^[0-9a-f]{64}$/.test(coordinatedRequestDigest)) {
    // Direct stable-ID requests are already serialized and bound to immutable
    // identity plus the token-derived account by the Durable Object. Use that
    // non-secret identity digest for the inner recovery journal so rotating a
    // token or editing mutable config cannot strand an otherwise safe retry.
    context.requestDigest = coordinatedRequestDigest;
  }
  if (options?.coordinationBypass !== true) {
    const coordinator = options?.env?.CE_SESSION_COORDINATOR;
    if (!coordinator?.idFromName || !coordinator?.get) {
      return buildFailure(503, {
        error: 'CE_SESSION_COORDINATOR is required for stable deployment requests; no Cloudflare mutation was attempted.',
        deploymentRequestPending: true,
      }, { fallbackEligible: true });
    }
    const coordinatorName = await sha256Hex(`direct-deploy:${context.deploymentId}`);
    const stub = coordinator.get(coordinator.idFromName(coordinatorName));
    let response;
    try {
      response = await stub.fetch('https://session-coordinator.internal/deploy-helper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestDigest: context.requestDigest,
          immutableIdentityDigest: context.immutableIdentityDigest,
          deployBody: options.body,
          requestOrigin: options.requestOrigin || '',
          sensitiveValues: collectKnownRequestCredentials(options.body),
        }),
      });
    } catch {
      return buildFailure(503, {
        error: 'Deployment coordination was interrupted; retry the same request.',
        deploymentRequestPending: true,
      }, { fallbackEligible: true });
    }
    const result = await response.json().catch(() => ({}));
    if (isObj(result?.body) && Number(result?.status || 0)) {
      return {
        ok: result.ok === true,
        status: Number(result.status),
        body: result.body,
        fallbackEligible: result.fallbackEligible === true,
      };
    }
    return buildFailure(Number(response.status || 0) || 502, isObj(result) ? result : {
      error: 'Deployment coordinator returned an invalid response.',
    });
  }
  const journalBinding = resolveDeployJournalBinding(options?.env);
  if (!journalBinding) {
    return buildFailure(503, {
      error: 'DEPLOY_HELPER_KV or GROUP_KV is required for idempotent deployment requests.',
    }, { fallbackEligible: true });
  }
  const buildRequestDigestConflict = () => buildFailure(409, {
    error: 'deploymentRequestId was already used with a different request payload.',
    deploymentRequestConflict: true,
  });
  const clearRejectedBundleAuthority = async (required) => {
    if (!required) return null;
    if (typeof journalBinding.delete !== 'function') {
      return buildFailure(503, {
        error: 'Failed to clear rejected-bundle correction authority; retry the same deployment request.',
        deploymentRequestPending: true,
      }, { fallbackEligible: true });
    }
    try {
      await journalBinding.delete(context.uploadRejectedJournalKey);
      return null;
    } catch {
      return buildFailure(503, {
        error: 'Failed to clear rejected-bundle correction authority; retry the same deployment request.',
        deploymentRequestPending: true,
      }, { fallbackEligible: true });
    }
  };
  const buildTerminalJournalReplay = (record) => {
    const result = record?.result;
    if (result?.ok !== true) return result;
    const recordedFullRequestDigest = toStr(record?.fullRequestDigest).trim().toLowerCase();
    const fullRequestDigestMatches = recordedFullRequestDigest
      ? recordedFullRequestDigest === context.fullRequestDigest
      : context.requestDigest === context.fullRequestDigest;
    if (fullRequestDigestMatches) return result;
    // The stable journal proves infrastructure success, not that this retry's
    // mutable config or secrets were written. Force the signed recovery merge.
    return {
      ...result,
      body: {
        ...(isObj(result?.body) ? result.body : {}),
        partial: true,
        configVerified: false,
        writesSessionConfig: false,
        writesSessionSecrets: false,
      },
    };
  };

  let existingRecord;
  let terminalRecord;
  let uploadRecord;
  let uploadRejectedRecord;
  try {
    [terminalRecord, uploadRecord, uploadRejectedRecord, existingRecord] = await Promise.all([
      readDeployJournalRecord(journalBinding, context.terminalJournalKey),
      readDeployJournalRecord(journalBinding, context.uploadJournalKey),
      readDeployJournalRecord(journalBinding, context.uploadRejectedJournalKey),
      readDeployJournalRecord(journalBinding, context.journalKey),
    ]);
  } catch (error) {
    return buildFailure(503, {
      error: `Failed to read deployment request journal: ${toStr(error?.message || error).trim() || 'Unknown error.'}`,
    }, { fallbackEligible: true });
  }
  if (terminalRecord) {
    if (
      Number(terminalRecord.version || 0) !== DEPLOYMENT_JOURNAL_VERSION ||
      toStr(terminalRecord.requestDigest).trim() !== context.requestDigest
    ) {
      return buildRequestDigestConflict();
    }
    if (terminalRecord.state === 'terminal' && isObj(terminalRecord.result)) {
      // Workers KV may expose the terminal receipt before a still-present
      // rejected-bundle marker. Delete by deterministic key on every terminal
      // replay; conditioning cleanup on a prior read can preserve stale bundle
      // replacement authority after success.
      const authorityCleanupFailure = await clearRejectedBundleAuthority(true);
      if (authorityCleanupFailure) return authorityCleanupFailure;
      return buildTerminalJournalReplay(terminalRecord);
    }
    return buildFailure(409, { error: 'Deployment request terminal journal state is invalid.' });
  }
  if (uploadRejectedRecord) {
    const rejectedBundleSha256 = toStr(uploadRejectedRecord.bundleSha256).trim().toLowerCase();
    if (toStr(uploadRejectedRecord.requestDigest).trim() !== context.requestDigest) {
      return buildRequestDigestConflict();
    }
    if (
      Number(uploadRejectedRecord.version || 0) !== DEPLOYMENT_JOURNAL_VERSION ||
      uploadRejectedRecord.state !== 'definitive_upload_rejected' ||
      !/^[0-9a-f]{64}$/.test(toStr(uploadRejectedRecord.bundleCorrectionDigest).trim().toLowerCase()) ||
      toStr(uploadRejectedRecord.deploymentId).trim() !== context.deploymentId ||
      toStr(uploadRejectedRecord.workerName).trim() !== context.workerName ||
      toStr(uploadRejectedRecord.requestMarker).trim() !== context.requestMarker ||
      !/^[0-9a-f]{64}$/.test(rejectedBundleSha256)
    ) {
      return buildFailure(409, { error: 'Deployment request upload-rejection journal state is invalid.' });
    }
    if (
      toStr(uploadRejectedRecord.bundleCorrectionDigest).trim().toLowerCase() !==
      context.bundleCorrectionDigest
    ) {
      return buildFailure(409, {
        error: 'A rejected deployment bundle may be corrected only when every non-bundle deployment field is unchanged.',
        deploymentRequestConflict: true,
        deploymentRequestPending: true,
      });
    }
    context.definitiveUploadRejected = true;
    context.rejectedBundleSha256 = rejectedBundleSha256;
  }
  if (uploadRecord) {
    if (toStr(uploadRecord.requestDigest).trim() !== context.requestDigest) {
      return buildRequestDigestConflict();
    }
    if (
      Number(uploadRecord.version || 0) !== DEPLOYMENT_JOURNAL_VERSION ||
      uploadRecord.state !== 'upload_started' ||
      !/^[0-9a-f]{64}$/.test(toStr(uploadRecord.bundleSha256).trim().toLowerCase())
    ) {
      return buildFailure(409, { error: 'Deployment request upload journal state is invalid.' });
    }
    context.uploadStarted = true;
    context.bundleSha256 = toStr(uploadRecord.bundleSha256).trim().toLowerCase();
  }
  if (
    context.definitiveUploadRejected === true &&
    context.bundleSha256 &&
    context.bundleSha256 !== context.rejectedBundleSha256
  ) {
    return buildFailure(409, { error: 'Deployment request upload journal conflicts with its rejection state.' });
  }
  if (context.definitiveUploadRejected === true && !context.bundleSha256) {
    // The short-lived upload journal may have expired. The durable rejection
    // record preserves its original non-secret bundle identity for recovery.
    context.uploadStarted = true;
    context.bundleSha256 = context.rejectedBundleSha256;
  }
  if (existingRecord) {
    if (
      Number(existingRecord.version || 0) !== DEPLOYMENT_JOURNAL_VERSION ||
      toStr(existingRecord.requestDigest).trim() !== context.requestDigest
    ) {
      return buildRequestDigestConflict();
    }
    if (existingRecord.state === 'terminal' && isObj(existingRecord.result)) {
      return buildTerminalJournalReplay(existingRecord);
    }
    if (existingRecord.state !== 'reserved' && existingRecord.state !== 'mutation_started') {
      return buildFailure(409, { error: 'Deployment request journal state is invalid.' });
    }
    context.isReplay = true;
    context.mutationStarted = existingRecord.state === 'mutation_started';
  } else {
    try {
      // Regression guard: this non-secret digest/marker record must commit
      // before any Cloudflare mutation can be attempted for a stable request ID.
      await writeDeployJournalRecord(journalBinding, context.journalKey, {
        version: DEPLOYMENT_JOURNAL_VERSION,
        state: 'reserved',
        requestDigest: context.requestDigest,
        deploymentId: context.deploymentId,
        workerName: context.workerName,
        requestMarker: context.requestMarker,
      });
    } catch (error) {
      return buildFailure(503, {
        error: `Failed to initialize deployment request journal: ${toStr(error?.message || error).trim() || 'Unknown error.'}`,
      }, { fallbackEligible: true });
    }
  }
  if (context.definitiveUploadRejected === true) context.isReplay = true;

  context.markMutationStarted = async () => {
    if (context.mutationStarted) return;
    // The reservation is already durable. A second write to the same Workers
    // KV key inside one second is rejected by Cloudflare, so recovery derives
    // mutation progress from deterministic resource markers instead of
    // rewriting the reservation in place.
    context.mutationStarted = true;
  };
  context.markUploadStarted = async (bundleSha256) => {
    const normalizedBundleSha256 = toStr(bundleSha256).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalizedBundleSha256)) {
      throw new TypeError('Cannot journal an invalid deployment bundle identity.');
    }
    if (
      context.bundleSha256 &&
      context.bundleSha256 !== normalizedBundleSha256 &&
      context.definitiveUploadRejected !== true
    ) {
      throw new TypeError('Deployment bundle content changed after this request started.');
    }
    if (!context.uploadStarted) {
      await writeDeployJournalRecord(journalBinding, context.uploadJournalKey, {
        version: DEPLOYMENT_JOURNAL_VERSION,
        state: 'upload_started',
        requestDigest: context.requestDigest,
        deploymentId: context.deploymentId,
        workerName: context.workerName,
        requestMarker: context.requestMarker,
        bundleSha256: normalizedBundleSha256,
      });
      context.uploadStarted = true;
      context.bundleSha256 = normalizedBundleSha256;
    }
  };
  context.markDefinitiveUploadRejected = async (bundleSha256) => {
    const normalizedBundleSha256 = toStr(bundleSha256).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalizedBundleSha256)) {
      throw new TypeError('Cannot journal an invalid rejected bundle identity.');
    }
    if (context.definitiveUploadRejected === true) return;
    await writeDurableDeployJournalRecord(journalBinding, context.uploadRejectedJournalKey, {
      version: DEPLOYMENT_JOURNAL_VERSION,
      state: 'definitive_upload_rejected',
      requestDigest: context.requestDigest,
      deploymentId: context.deploymentId,
      workerName: context.workerName,
      requestMarker: context.requestMarker,
      bundleSha256: normalizedBundleSha256,
      bundleCorrectionDigest: context.bundleCorrectionDigest,
    });
    context.definitiveUploadRejected = true;
    context.rejectedBundleSha256 = normalizedBundleSha256;
  };

  const result = await executeDeployHelperRequestCore({
    ...options,
    idempotencyContext: context,
  });
  if (context.definitiveUploadRejected === true && result?.ok !== true) {
    return {
      ...result,
      body: {
        ...(isObj(result?.body) ? result.body : {}),
        deploymentRequestPending: true,
      },
    };
  }
  if (result?.body?.deploymentRequestPending === true) return result;
  if (result?.ok !== true && result?.fallbackEligible === true) {
    if (context.mutationStarted === true) {
      return {
        ...result,
        body: {
          ...(isObj(result?.body) ? result.body : {}),
          deploymentRequestPending: true,
        },
      };
    }
    return result;
  }

  const safeResult = buildSafeDeployJournalResult(
    result,
    collectKnownRequestCredentials(options?.body),
  );
  // Terminal persistence intentionally precedes the HTTP response. If this put
  // commits and its response is lost, the next call replays the stored receipt.
  await writeDeployJournalRecord(journalBinding, context.terminalJournalKey, {
    version: DEPLOYMENT_JOURNAL_VERSION,
    state: 'terminal',
    requestDigest: context.requestDigest,
    fullRequestDigest: context.fullRequestDigest,
    deploymentId: context.deploymentId,
    workerName: context.workerName,
    requestMarker: context.requestMarker,
    result: safeResult,
  });
  const authorityCleanupFailure = await clearRejectedBundleAuthority(
    context.definitiveUploadRejected === true,
  );
  if (authorityCleanupFailure) return authorityCleanupFailure;
  return safeResult;
};
