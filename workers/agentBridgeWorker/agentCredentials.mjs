import { safeString, safeJsonParse, nowIso } from './runtimePrimitives.mjs';
import { AGENT_BRIDGE_WORKER_VERSION } from './constants.mjs';
import { createOpaqueAgentPrincipalId, normalizeAgentPrincipal } from './agentPrincipal.mjs';
import { assertNoSecretShape } from './redaction.mjs';

export { createOpaqueAgentPrincipalId, normalizeAgentPrincipal } from './agentPrincipal.mjs';

export const AGENT_CREDENTIAL_KV_PREFIX = 'agent:credential:v2:';
export const AGENT_CREDENTIAL_SLOT_KV_PREFIX = 'agent:credential-slot:v2:';
export const AGENT_CREDENTIAL_DEFAULT_TTL_SECONDS = 28 * 24 * 60 * 60;
export const AGENT_BROWSER_CREDENTIAL_TTL_SECONDS = 60 * 60;
export const AGENT_MEMBER_CREDENTIAL_MAX_TTL_SECONDS = 24 * 60 * 60;

export const AGENT_CREDENTIAL_AUDIENCES = Object.freeze({
  AGENT_BRIDGE: 'agent_bridge',
  AGENT_BRIDGE_BROWSER: 'agent_bridge_browser',
});

export const AGENT_CREDENTIAL_KINDS = Object.freeze({
  USER: 'user',
  SERVICE: 'service',
  BROWSER: 'browser',
  MEMBER: 'member',
  AGENT_ONLY: 'agent_only',
});

export const AGENT_CREDENTIAL_SCOPES = Object.freeze({
  READ_QUESTIONS: 'read_questions',
  DRAFT_ANSWERS: 'draft_answers',
  RECOMMEND_QUESTION_VOTES: 'recommend_question_votes',
  APPLY_QUESTION_VOTES: 'apply_question_votes',
  READ_GROUPS: 'read_groups',
  PROPOSE_GROUPS: 'propose_groups',
  POSE_QUESTIONS: 'pose_questions',
  MANAGE_GROUP_APPROVALS: 'manage_group_approvals',
  AGENT_AUTOFILL: 'agent_autofill',
});

export const AGENT_CREDENTIAL_DEFAULT_SCOPES = Object.freeze([
  AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS,
  AGENT_CREDENTIAL_SCOPES.DRAFT_ANSWERS,
  AGENT_CREDENTIAL_SCOPES.RECOMMEND_QUESTION_VOTES,
  AGENT_CREDENTIAL_SCOPES.APPLY_QUESTION_VOTES,
  AGENT_CREDENTIAL_SCOPES.READ_GROUPS,
  AGENT_CREDENTIAL_SCOPES.PROPOSE_GROUPS,
  AGENT_CREDENTIAL_SCOPES.POSE_QUESTIONS,
]);

// Compatibility exports for the Telegram adapter. New transport-neutral code
// should use the AGENT_CREDENTIAL names above.
export const TELEGRAM_AGENT_DELEGATION_TOKEN_KV_PREFIX = AGENT_CREDENTIAL_KV_PREFIX;
export const TELEGRAM_AGENT_DELEGATION_TOKEN_USER_KV_PREFIX = AGENT_CREDENTIAL_SLOT_KV_PREFIX;
export const TELEGRAM_AGENT_ONLY_TOKEN_USER_KV_PREFIX = AGENT_CREDENTIAL_SLOT_KV_PREFIX;
export const TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_TTL_SECONDS = AGENT_CREDENTIAL_DEFAULT_TTL_SECONDS;
export const TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES = AGENT_CREDENTIAL_SCOPES;
export const TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_SCOPES = AGENT_CREDENTIAL_DEFAULT_SCOPES;

const textEncoder = new TextEncoder();

function normalizeSessionId(value = '') {
  const normalized = safeString(value).toLowerCase().replace(/^0x/, '').replace(/-/g, '');
  return /^[0-9a-f]{32}$/.test(normalized) && !/^0+$/.test(normalized) ? `0x${normalized}` : '';
}

function normalizeHttpsOrigin(value = '') {
  try {
    const parsed = new URL(safeString(value));
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

function createdAtMs(value = '') {
  const parsed = Date.parse(safeString(value));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function base64Url(bytes = new Uint8Array()) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomSecret(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input = '') {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', textEncoder.encode(String(input || '')));
  return bytesToHex(new Uint8Array(digest));
}

function tokenKvKey(tokenHash = '') {
  const hash = safeString(tokenHash).toLowerCase();
  return /^[0-9a-f]{64}$/.test(hash) ? `${AGENT_CREDENTIAL_KV_PREFIX}${hash}` : '';
}

function slotPart(value = '') {
  return encodeURIComponent(safeString(value).slice(0, 160));
}

function credentialSlotKey({
  principalId = '',
  sessionSlug = '',
  audience = AGENT_CREDENTIAL_AUDIENCES.AGENT_BRIDGE,
  credentialKind = AGENT_CREDENTIAL_KINDS.USER,
} = {}) {
  const id = safeString(principalId);
  const slug = safeString(sessionSlug);
  const target = safeString(audience);
  const kind = safeString(credentialKind);
  if (!id || !slug || !target || !kind) return '';
  return `${AGENT_CREDENTIAL_SLOT_KV_PREFIX}${slotPart(kind)}:${slotPart(target)}:${slotPart(slug)}:${slotPart(id)}`;
}

function normalizeScopes(scopes = [], { defaultIfEmpty = false } = {}) {
  const allowed = new Set(Object.values(AGENT_CREDENTIAL_SCOPES));
  const source = Array.isArray(scopes) ? scopes : safeString(scopes).split(',');
  const normalized = source
    .map((scope) => safeString(scope))
    .filter((scope) => allowed.has(scope))
    .filter((scope, index, values) => values.indexOf(scope) === index);
  return normalized.length || !defaultIfEmpty ? normalized : [...AGENT_CREDENTIAL_DEFAULT_SCOPES];
}

function normalizeTtlSeconds(value, fallback = AGENT_CREDENTIAL_DEFAULT_TTL_SECONDS) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}

async function readKvJson(kv, key) {
  try {
    return { ok: true, value: safeJsonParse(await kv.get(key), null) };
  } catch {
    return { ok: false, reason: 'agent_token_storage_unavailable' };
  }
}

async function deleteKvBestEffort(kv, key) {
  try {
    if (key && typeof kv?.delete === 'function') await kv.delete(key);
  } catch {
    // The slot pointer is authoritative. Stale token rows are harmless and
    // retain their normal TTL when best-effort cleanup is unavailable.
  }
}

export function telegramAgentPrincipal({ telegramUserId = '', username = '' } = {}) {
  const adapterUserId = safeString(telegramUserId);
  return normalizeAgentPrincipal({
    principalId: adapterUserId ? `telegram:${adapterUserId}` : '',
    kind: AGENT_CREDENTIAL_KINDS.USER,
    adapter: 'telegram',
    adapterUserId,
    label: safeString(username),
  });
}

export async function readAgentCredentialSlot({
  env = {},
  principal = {},
  sessionSlug = '',
  audience = AGENT_CREDENTIAL_AUDIENCES.AGENT_BRIDGE,
  credentialKind = AGENT_CREDENTIAL_KINDS.USER,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  const normalizedPrincipal = normalizeAgentPrincipal(principal);
  const key = credentialSlotKey({
    principalId: normalizedPrincipal.principalId,
    sessionSlug,
    audience,
    credentialKind,
  });
  if (!key || !kv || typeof kv.get !== 'function') return {};
  const loaded = await readKvJson(kv, key);
  if (!loaded.ok) return { ok: false, reason: loaded.reason };
  const parsed = loaded.value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  assertNoSecretShape(parsed, 'Agent credential slots must not serialize bearer tokens.');
  const tokenHash = safeString(parsed.tokenHash).toLowerCase();
  return /^[0-9a-f]{64}$/.test(tokenHash)
    ? {
        ok: true,
        key,
        tokenHash,
        issuedAt: safeString(parsed.issuedAt),
        updatedAt: safeString(parsed.updatedAt),
      }
    : {};
}

export async function issueAgentCredential({
  env = {},
  principal = {},
  sessionSlug = '',
  sessionId = '',
  sessionWorkerOrigin = '',
  sessionAuthorityMode = '',
  accountAddress = '',
  scopes = AGENT_CREDENTIAL_DEFAULT_SCOPES,
  audience = AGENT_CREDENTIAL_AUDIENCES.AGENT_BRIDGE,
  credentialKind = AGENT_CREDENTIAL_KINDS.USER,
  ttlSeconds = AGENT_CREDENTIAL_DEFAULT_TTL_SECONDS,
  createdAt = null,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function' || typeof kv.get !== 'function') {
    return { ok: false, reason: 'agent_token_storage_unavailable' };
  }
  const normalizedPrincipal = normalizeAgentPrincipal(principal);
  const slug = safeString(sessionSlug);
  if (!normalizedPrincipal.principalId) return { ok: false, reason: 'agent_principal_required' };
  if (!slug) return { ok: false, reason: 'session_required' };
  const normalizedAudience = safeString(audience);
  const normalizedKind = safeString(credentialKind);
  const memberCredential = normalizedKind === AGENT_CREDENTIAL_KINDS.MEMBER;
  const normalizedSessionAuthorityMode = safeString(sessionAuthorityMode).toLowerCase();
  const workerCanonicalBrowserCredential =
    normalizedKind === AGENT_CREDENTIAL_KINDS.BROWSER && normalizedSessionAuthorityMode === 'worker_canonical';
  const authorityBoundCredential = memberCredential || workerCanonicalBrowserCredential;
  const rawSessionId = safeString(sessionId);
  const normalizedSessionId = normalizeSessionId(rawSessionId);
  const normalizedSessionWorkerOrigin = normalizeHttpsOrigin(sessionWorkerOrigin);
  if (authorityBoundCredential && rawSessionId && !normalizedSessionId) {
    return {
      ok: false,
      reason: workerCanonicalBrowserCredential
        ? 'agent_browser_credential_session_identity_invalid'
        : 'agent_member_credential_session_identity_invalid',
    };
  }
  if (workerCanonicalBrowserCredential && !normalizedSessionId) {
    return {
      ok: false,
      reason: 'agent_browser_credential_session_identity_invalid',
    };
  }
  if (authorityBoundCredential && !normalizedSessionWorkerOrigin) {
    return {
      ok: false,
      reason: workerCanonicalBrowserCredential
        ? 'agent_browser_credential_worker_origin_invalid'
        : 'agent_member_credential_worker_origin_invalid',
    };
  }
  const slotKey = credentialSlotKey({
    principalId: normalizedPrincipal.principalId,
    sessionSlug: slug,
    audience: normalizedAudience,
    credentialKind: normalizedKind,
  });
  if (!slotKey) return { ok: false, reason: 'agent_credential_slot_invalid' };

  const previous = await readAgentCredentialSlot({
    env,
    principal: normalizedPrincipal,
    sessionSlug: slug,
    audience: normalizedAudience,
    credentialKind: normalizedKind,
  });
  if (previous.ok === false) return previous;

  const normalizedTtl = normalizeTtlSeconds(ttlSeconds);
  const issuedAt = safeString(createdAt) || nowIso();
  const expiresAt = new Date(createdAtMs(issuedAt) + normalizedTtl * 1000).toISOString();
  const token = `ceagt_${randomSecret()}`;
  const tokenHash = await sha256Hex(token);
  const record = {
    type: 'agent_credential',
    version: 2,
    workerVersion: AGENT_BRIDGE_WORKER_VERSION,
    tokenHash,
    tokenPrefix: token.slice(0, 12),
    status: 'active',
    principal: normalizedPrincipal,
    sessionSlug: slug,
    ...(authorityBoundCredential
      ? {
          ...(normalizedSessionId ? { sessionId: normalizedSessionId } : {}),
          sessionWorkerOrigin: normalizedSessionWorkerOrigin,
          ...(normalizedSessionAuthorityMode ? { sessionAuthorityMode: normalizedSessionAuthorityMode } : {}),
        }
      : {}),
    accountAddress: safeString(accountAddress),
    scopes: normalizeScopes(scopes, { defaultIfEmpty: true }),
    audience: normalizedAudience,
    credentialKind: normalizedKind,
    slotKey,
    issuedAt,
    expiresAt,
    ttlSeconds: normalizedTtl,
  };
  assertNoSecretShape(record, 'Agent credential records must not serialize bearer tokens.');
  const metadata = {
    v: 2,
    t: 'agent_credential',
    sg: slug,
    p: normalizedPrincipal.principalId,
    a: normalizedAudience,
    k: normalizedKind,
    c: issuedAt,
  };
  assertNoSecretShape(metadata, 'Agent credential metadata must not serialize secrets.');
  const recordKey = tokenKvKey(tokenHash);
  try {
    await kv.put(recordKey, JSON.stringify(record), {
      expirationTtl: normalizedTtl,
      metadata,
    });
  } catch {
    return { ok: false, reason: 'agent_token_create_failed' };
  }

  const slot = {
    type: 'agent_credential_slot',
    version: 2,
    principalId: normalizedPrincipal.principalId,
    sessionSlug: slug,
    ...(authorityBoundCredential
      ? {
          ...(normalizedSessionId ? { sessionId: normalizedSessionId } : {}),
          sessionWorkerOrigin: normalizedSessionWorkerOrigin,
          ...(normalizedSessionAuthorityMode ? { sessionAuthorityMode: normalizedSessionAuthorityMode } : {}),
        }
      : {}),
    audience: normalizedAudience,
    credentialKind: normalizedKind,
    tokenHash,
    issuedAt,
    updatedAt: issuedAt,
  };
  assertNoSecretShape(slot, 'Agent credential slots must not serialize bearer tokens.');
  try {
    await kv.put(slotKey, JSON.stringify(slot), {
      expirationTtl: normalizedTtl,
    });
  } catch {
    await deleteKvBestEffort(kv, recordKey);
    return { ok: false, reason: 'agent_token_pointer_write_failed' };
  }

  if (previous.tokenHash && previous.tokenHash !== tokenHash) {
    await deleteKvBestEffort(kv, tokenKvKey(previous.tokenHash));
  }
  return {
    ok: true,
    token,
    tokenHash,
    tokenPrefix: record.tokenPrefix,
    record,
  };
}

export async function loadAgentCredential({ env = {}, token = '', now = null } = {}) {
  const supplied = safeString(token);
  if (!supplied) return { ok: false, reason: 'agent_token_missing' };
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.get !== 'function') {
    return { ok: false, reason: 'agent_token_storage_unavailable' };
  }
  const tokenHash = await sha256Hex(supplied);
  const key = tokenKvKey(tokenHash);
  const loaded = key ? await readKvJson(kv, key) : { ok: true, value: null };
  if (!loaded.ok) return { ok: false, reason: loaded.reason };
  const parsed = loaded.value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== 2) {
    return { ok: false, reason: 'agent_token_not_found' };
  }
  assertNoSecretShape(parsed, 'Agent credential records must not serialize bearer tokens.');
  if (safeString(parsed.status || 'active') !== 'active') {
    return { ok: false, reason: 'agent_token_inactive' };
  }
  const slotKey = safeString(parsed.slotKey);
  const active = slotKey ? await readKvJson(kv, slotKey) : { ok: true, value: null };
  if (!active.ok) return { ok: false, reason: active.reason };
  if (safeString(active.value?.tokenHash).toLowerCase() !== tokenHash) {
    return { ok: false, reason: 'agent_token_inactive' };
  }
  const nowMs = createdAtMs(now || nowIso());
  const expiresMs = Date.parse(safeString(parsed.expiresAt));
  if (Number.isFinite(expiresMs) && expiresMs <= nowMs) {
    return { ok: false, reason: 'agent_token_expired' };
  }
  return {
    ok: true,
    tokenHash,
    record: {
      ...parsed,
      principal: normalizeAgentPrincipal(parsed.principal),
      scopes: normalizeScopes(parsed.scopes),
    },
  };
}

export async function revokeAgentCredentialHash({ env = {}, tokenHash = '' } = {}) {
  const kv = env?.AGENT_ACTION_KV;
  const key = tokenKvKey(tokenHash);
  if (!key || !kv || typeof kv.get !== 'function' || typeof kv.delete !== 'function') {
    return { ok: false, reason: 'agent_token_storage_unavailable' };
  }
  const loaded = await readKvJson(kv, key);
  if (!loaded.ok) return { ok: false, reason: loaded.reason };
  const slotKey = safeString(loaded.value?.slotKey);
  if (slotKey) {
    const slot = await readKvJson(kv, slotKey);
    if (!slot.ok) return { ok: false, reason: slot.reason };
    if (safeString(slot.value?.tokenHash).toLowerCase() === safeString(tokenHash).toLowerCase()) {
      try {
        await kv.delete(slotKey);
      } catch {
        return { ok: false, reason: 'agent_token_storage_unavailable' };
      }
    }
  }
  await deleteKvBestEffort(kv, key);
  return { ok: true, tokenHash: safeString(tokenHash).toLowerCase() };
}

export function agentCredentialHasScope(record = {}, scope = '') {
  const scopes = new Set(normalizeScopes(record.scopes || []));
  return scopes.has(scope);
}

export async function createTelegramAgentDelegationToken({
  env = {},
  telegramUserId = '',
  username = '',
  credentialKind = AGENT_CREDENTIAL_KINDS.USER,
  ...rest
} = {}) {
  const principal = telegramAgentPrincipal({ telegramUserId, username });
  if (!principal.principalId) return { ok: false, reason: 'telegram_user_required' };
  return issueAgentCredential({ env, principal, credentialKind, ...rest });
}

export const loadTelegramAgentDelegationToken = loadAgentCredential;

export async function readTelegramAgentDelegationTokenUserPointer({
  env = {},
  telegramUserId = '',
  sessionSlug = '',
  credentialKind = AGENT_CREDENTIAL_KINDS.USER,
} = {}) {
  if (!sessionSlug) return {};
  return readAgentCredentialSlot({
    env,
    principal: telegramAgentPrincipal({ telegramUserId }),
    sessionSlug,
    credentialKind,
  });
}

export async function writeTelegramAgentDelegationTokenUserPointer({
  env = {},
  telegramUserId = '',
  tokenHash = '',
  sessionSlug = '',
  credentialKind = AGENT_CREDENTIAL_KINDS.USER,
} = {}) {
  const existing = await readAgentCredentialSlot({
    env,
    principal: telegramAgentPrincipal({ telegramUserId }),
    sessionSlug,
    credentialKind,
  });
  return existing.tokenHash === safeString(tokenHash).toLowerCase()
    ? { ok: true, tokenHash: existing.tokenHash }
    : { ok: false, reason: 'agent_token_pointer_mismatch' };
}

export async function readTelegramAgentOnlyTokenUserPointer(args = {}) {
  return readTelegramAgentDelegationTokenUserPointer({
    ...args,
    credentialKind: AGENT_CREDENTIAL_KINDS.AGENT_ONLY,
  });
}

export async function writeTelegramAgentOnlyTokenUserPointer(args = {}) {
  return writeTelegramAgentDelegationTokenUserPointer({
    ...args,
    credentialKind: AGENT_CREDENTIAL_KINDS.AGENT_ONLY,
  });
}

export const revokeTelegramAgentDelegationTokenHash = revokeAgentCredentialHash;
export const delegationTokenHasScope = agentCredentialHasScope;

export const __test__agentCredentials = {
  normalizePrincipal: normalizeAgentPrincipal,
  normalizeScopes,
  sha256Hex,
  tokenKvKey,
  credentialSlotKey,
};
