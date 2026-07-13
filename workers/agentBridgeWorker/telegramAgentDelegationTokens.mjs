import { AGENT_BRIDGE_WORKER_VERSION } from './constants.mjs';
import { assertNoSecretShape } from './redaction.mjs';

export const TELEGRAM_AGENT_DELEGATION_TOKEN_KV_PREFIX = 'telegram:agent-delegation-token:v1:';
export const TELEGRAM_AGENT_DELEGATION_TOKEN_USER_KV_PREFIX = 'telegram:agent-token:user:';
export const TELEGRAM_AGENT_ONLY_TOKEN_USER_KV_PREFIX = 'telegram:agent-only-token:user:';
export const TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_TTL_SECONDS = 28 * 24 * 60 * 60;
export const TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES = Object.freeze({
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
export const TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_SCOPES = Object.freeze([
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.DRAFT_ANSWERS,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.RECOMMEND_QUESTION_VOTES,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.APPLY_QUESTION_VOTES,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_GROUPS,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.PROPOSE_GROUPS,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.POSE_QUESTIONS,
]);

const textEncoder = new TextEncoder();

function safeString(value) {
  return String(value || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(value, fallback = null) {
  const text = safeString(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
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

function randomTokenSecret() {
  const bytes = new Uint8Array(32);
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
  return /^[0-9a-f]{64}$/.test(hash) ? `${TELEGRAM_AGENT_DELEGATION_TOKEN_KV_PREFIX}${hash}` : '';
}

function tokenUserPointerKvKey(telegramUserId = '', prefix = TELEGRAM_AGENT_DELEGATION_TOKEN_USER_KV_PREFIX) {
  const userId = safeString(telegramUserId)
    .replace(/[^0-9A-Za-z_-]+/g, '_')
    .slice(0, 64);
  return userId ? `${prefix}${userId}` : '';
}

function normalizeScopes(scopes = [], { defaultIfEmpty = false } = {}) {
  const allowed = new Set(Object.values(TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES));
  const source = Array.isArray(scopes) ? scopes : safeString(scopes).split(',');
  const normalized = source
    .map((scope) => safeString(scope))
    .filter((scope) => allowed.has(scope))
    .filter((scope, index, values) => values.indexOf(scope) === index);
  return normalized.length || !defaultIfEmpty ? normalized : [...TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_SCOPES];
}

export async function createTelegramAgentDelegationToken({
  env = {},
  telegramUserId = '',
  username = '',
  sessionSlug = '',
  accountAddress = '',
  scopes = TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_SCOPES,
  ttlSeconds = TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_TTL_SECONDS,
  createdAt = null,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') {
    return { ok: false, reason: 'agent_token_storage_unavailable' };
  }
  const userId = safeString(telegramUserId);
  const slug = safeString(sessionSlug);
  if (!userId) return { ok: false, reason: 'telegram_user_required' };
  if (!slug) return { ok: false, reason: 'session_required' };

  const normalizedTtl = Number.isFinite(Number(ttlSeconds)) && Number(ttlSeconds) > 0
    ? Math.floor(Number(ttlSeconds))
    : TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_TTL_SECONDS;
  const issuedAt = safeString(createdAt) || nowIso();
  const expiresAt = new Date(createdAtMs(issuedAt) + normalizedTtl * 1000).toISOString();
  const token = `ceagt_${randomTokenSecret()}`;
  const tokenHash = await sha256Hex(token);
  const record = {
    type: 'telegram_agent_delegation_token',
    version: 1,
    workerVersion: AGENT_BRIDGE_WORKER_VERSION,
    tokenHash,
    tokenPrefix: token.slice(0, 12),
    status: 'active',
    telegramUserId: userId,
    username: safeString(username),
    sessionSlug: slug,
    accountAddress: safeString(accountAddress),
    scopes: normalizeScopes(scopes, { defaultIfEmpty: true }),
    issuedAt,
    expiresAt,
    ttlSeconds: normalizedTtl,
  };
  assertNoSecretShape(record, 'Telegram agent delegation token records must not serialize bearer tokens.');
  const metadata = {
    v: 1,
    t: 'agent_delegation_token',
    sg: slug,
    u: userId,
    c: issuedAt,
  };
  assertNoSecretShape(metadata, 'Telegram agent delegation token metadata must not serialize secrets.');
  await kv.put(tokenKvKey(tokenHash), JSON.stringify(record), {
    expirationTtl: normalizedTtl,
    metadata,
  });
  return {
    ok: true,
    token,
    tokenHash,
    tokenPrefix: record.tokenPrefix,
    record,
  };
}

export async function loadTelegramAgentDelegationToken({
  env = {},
  token = '',
  now = null,
} = {}) {
  const supplied = safeString(token);
  if (!supplied) return { ok: false, reason: 'agent_token_missing' };
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.get !== 'function') {
    return { ok: false, reason: 'agent_token_storage_unavailable' };
  }
  const tokenHash = await sha256Hex(supplied);
  const key = tokenKvKey(tokenHash);
  const parsed = key ? safeJsonParse(await kv.get(key).catch(() => null), null) : null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'agent_token_not_found' };
  }
  assertNoSecretShape(parsed, 'Telegram agent delegation token records must not serialize bearer tokens.');
  if (safeString(parsed.status || 'active') !== 'active') {
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
      scopes: normalizeScopes(parsed.scopes),
    },
  };
}

export async function readTelegramAgentDelegationTokenUserPointer({
  env = {},
  telegramUserId = '',
  prefix = TELEGRAM_AGENT_DELEGATION_TOKEN_USER_KV_PREFIX,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  const key = tokenUserPointerKvKey(telegramUserId, prefix);
  if (!key || !kv || typeof kv.get !== 'function') return {};
  const parsed = safeJsonParse(await kv.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  assertNoSecretShape(parsed, 'Telegram agent token user pointers must not serialize bearer tokens.');
  const tokenHash = safeString(parsed.tokenHash).toLowerCase();
  return /^[0-9a-f]{64}$/.test(tokenHash)
    ? {
      tokenHash,
      issuedAt: safeString(parsed.issuedAt),
      updatedAt: safeString(parsed.updatedAt),
    }
    : {};
}

export async function writeTelegramAgentDelegationTokenUserPointer({
  env = {},
  telegramUserId = '',
  tokenHash = '',
  issuedAt = '',
  createdAt = null,
  prefix = TELEGRAM_AGENT_DELEGATION_TOKEN_USER_KV_PREFIX,
  type = 'telegram_agent_token_user_pointer',
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  const key = tokenUserPointerKvKey(telegramUserId, prefix);
  const hash = safeString(tokenHash).toLowerCase();
  if (!key || !kv || typeof kv.put !== 'function') {
    return { ok: false, reason: 'agent_token_pointer_storage_unavailable' };
  }
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return { ok: false, reason: 'agent_token_hash_invalid' };
  }
  const record = {
    version: 1,
    type,
    telegramUserId: safeString(telegramUserId).slice(0, 64),
    tokenHash: hash,
    issuedAt: safeString(issuedAt) || safeString(createdAt) || nowIso(),
    updatedAt: safeString(createdAt) || nowIso(),
  };
  assertNoSecretShape(record, 'Telegram agent token user pointers must not serialize bearer tokens.');
  await kv.put(key, JSON.stringify(record));
  return { ok: true, tokenHash: hash };
}

export async function readTelegramAgentOnlyTokenUserPointer(args = {}) {
  return readTelegramAgentDelegationTokenUserPointer({
    ...args,
    prefix: TELEGRAM_AGENT_ONLY_TOKEN_USER_KV_PREFIX,
  });
}

export async function writeTelegramAgentOnlyTokenUserPointer(args = {}) {
  return writeTelegramAgentDelegationTokenUserPointer({
    ...args,
    prefix: TELEGRAM_AGENT_ONLY_TOKEN_USER_KV_PREFIX,
    type: 'telegram_agent_only_token_user_pointer',
  });
}

export async function revokeTelegramAgentDelegationTokenHash({
  env = {},
  tokenHash = '',
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  const key = tokenKvKey(tokenHash);
  if (!key || !kv || typeof kv.delete !== 'function') {
    return { ok: false, reason: 'agent_token_storage_unavailable' };
  }
  await kv.delete(key);
  return { ok: true, tokenHash: safeString(tokenHash).toLowerCase() };
}

export function delegationTokenHasScope(record = {}, scope = '') {
  const scopes = new Set(normalizeScopes(record.scopes || []));
  return scopes.has(scope);
}

export const __test__telegramAgentDelegationTokens = {
  normalizeScopes,
  sha256Hex,
  tokenKvKey,
  tokenUserPointerKvKey,
  agentOnlyTokenUserPointerKvKey: (telegramUserId = '') => tokenUserPointerKvKey(
    telegramUserId,
    TELEGRAM_AGENT_ONLY_TOKEN_USER_KV_PREFIX,
  ),
};
