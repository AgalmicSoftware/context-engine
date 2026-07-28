const SESSION_SLUG_RE = /^[a-z0-9_-]{1,128}$/;
const ELIGIBLE_PRINCIPAL_KINDS = new Set(['evm_address', 'passkey_account']);
export const SESSION_WORKER_MEMBER_EXCHANGE_KV_PREFIX = 'agent:member-exchange:v1:';

function safeString(value) {
  return String(value || '').trim();
}

function parseJsonObject(value = '') {
  try {
    const parsed = JSON.parse(safeString(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

function decodeBase64UrlJson(value = '') {
  try {
    const normalized = safeString(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    return parseJsonObject(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function decodeWorkerCredentialClaims(credential = '') {
  const parts = safeString(credential).split('.');
  return parts.length === 3 ? decodeBase64UrlJson(parts[1]) : null;
}

function nowSeconds(now = null) {
  const value = now instanceof Date ? now.getTime() : Date.parse(safeString(now));
  return Math.floor((Number.isFinite(value) ? value : Date.now()) / 1000);
}

async function sha256Hex(input = '') {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(input || '')),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeAddress(value = '') {
  const address = safeString(value);
  return /^0x[0-9a-f]{40}$/i.test(address) ? address : '';
}

export function resolvePinnedSessionWorkerAuthority({
  policyJson = '',
  sessionWorkerOrigin = '',
} = {}) {
  const policy = parseJsonObject(policyJson);
  if (!policy) {
    return { ok: false, reason: 'dedicated session policy must be valid JSON' };
  }
  const sessions = Array.isArray(policy.sessions)
    ? policy.sessions
    : (Array.isArray(policy.linkedSessions) ? policy.linkedSessions : []);
  if (sessions.length !== 1 || !sessions[0] || typeof sessions[0] !== 'object' || Array.isArray(sessions[0])) {
    return { ok: false, reason: 'dedicated session policy must contain exactly one session' };
  }
  const session = sessions[0];
  const sessionSlug = safeString(session.sessionSlug || session.slug).toLowerCase();
  if (!SESSION_SLUG_RE.test(sessionSlug)) {
    return { ok: false, reason: 'dedicated session policy requires one valid session slug' };
  }
  const defaultSessionSlug = safeString(policy.defaultSessionSlug || policy.defaultSession).toLowerCase();
  if (defaultSessionSlug !== sessionSlug) {
    return { ok: false, reason: 'dedicated session policy default must match its only session slug' };
  }
  const accessEnabled = session.sessionModeProfile?.surfaces?.agentHttp;
  if (typeof accessEnabled !== 'boolean') {
    return { ok: false, reason: 'dedicated session policy requires an explicit surfaces.agentHttp boolean' };
  }
  const configuredOrigin = normalizeHttpsOrigin(sessionWorkerOrigin);
  const policyOrigin = normalizeHttpsOrigin(
    session.sessionWorkerOrigin ||
    session.sessionWorkerUrl ||
    session.workerUrl ||
    session.corsWorkerUrl
  );
  if (!configuredOrigin || !policyOrigin || configuredOrigin !== policyOrigin) {
    return { ok: false, reason: 'dedicated session policy must pin the configured session Worker origin' };
  }
  return {
    ok: true,
    accessEnabled,
    sessionSlug,
    sessionWorkerOrigin: configuredOrigin,
  };
}

export async function verifySessionWorkerMembership({
  authority = {},
  credential = '',
  fetchImpl = globalThis.fetch,
  now = null,
} = {}) {
  const sessionSlug = safeString(authority.sessionSlug).toLowerCase();
  const sessionWorkerOrigin = normalizeHttpsOrigin(authority.sessionWorkerOrigin);
  const suppliedCredential = safeString(credential);
  if (!sessionSlug || !sessionWorkerOrigin) {
    return { ok: false, status: 503, reason: 'session_worker_authority_not_configured' };
  }
  if (!suppliedCredential) {
    return { ok: false, status: 401, reason: 'session_worker_credential_missing' };
  }
  const claims = decodeWorkerCredentialClaims(suppliedCredential);
  if (!claims || !safeString(claims.jti)) {
    return { ok: false, status: 401, reason: 'session_worker_credential_invalid' };
  }
  if (safeString(claims.slug).toLowerCase() !== sessionSlug) {
    return { ok: false, status: 403, reason: 'session_worker_credential_session_mismatch' };
  }
  const audience = safeString(claims.aud);
  if (audience && normalizeHttpsOrigin(audience) !== sessionWorkerOrigin) {
    return { ok: false, status: 403, reason: 'session_worker_credential_audience_mismatch' };
  }
  const exp = Math.floor(Number(claims.exp));
  const currentSeconds = nowSeconds(now);
  if (!Number.isFinite(exp) || exp <= currentSeconds) {
    return { ok: false, status: 401, reason: 'session_worker_credential_expired' };
  }
  if (claims.scopes?.groups !== true) {
    return { ok: false, status: 403, reason: 'session_worker_credential_ineligible' };
  }
  if (typeof fetchImpl !== 'function') {
    return { ok: false, status: 503, reason: 'session_worker_authority_unavailable' };
  }

  let response;
  let body;
  try {
    response = await fetchImpl(`${sessionWorkerOrigin}/groups/my-memberships`, {
      method: 'GET',
      headers: { authorization: `Bearer ${suppliedCredential}` },
      cache: 'no-store',
    });
    body = await response.json();
  } catch {
    return { ok: false, status: 503, reason: 'session_worker_authority_unavailable' };
  }
  if (!response.ok || body?.ok !== true) {
    if (response.status === 401) {
      const reason = [
        'session_worker_credential_invalid',
        'session_worker_credential_expired',
        'session_worker_credential_revoked',
      ].includes(safeString(body?.reason))
        ? safeString(body.reason)
        : 'session_worker_credential_invalid';
      return { ok: false, status: 401, reason };
    }
    if (response.status === 403) {
      return { ok: false, status: 403, reason: 'session_worker_membership_denied' };
    }
    return { ok: false, status: 503, reason: 'session_worker_authority_unavailable' };
  }
  if (!Array.isArray(body.memberships)) {
    return { ok: false, status: 503, reason: 'session_worker_authority_invalid_response' };
  }
  const principalKind = safeString(body.principal?.kind).toLowerCase();
  const principalAddress = normalizeAddress(body.principal?.address);
  if (!ELIGIBLE_PRINCIPAL_KINDS.has(principalKind) || !principalAddress) {
    return { ok: false, status: 403, reason: 'session_worker_principal_ineligible' };
  }
  if (safeString(claims.sub).toLowerCase() !== principalAddress.toLowerCase()) {
    return { ok: false, status: 403, reason: 'session_worker_principal_mismatch' };
  }
  return {
    ok: true,
    sessionSlug,
    principal: { kind: principalKind, address: principalAddress },
    memberships: body.memberships,
    workerCredentialExpiresAt: new Date(exp * 1000).toISOString(),
    remainingTtlSeconds: Math.max(1, exp - currentSeconds),
  };
}

export async function readSessionWorkerMemberExchange({ env = {}, credential = '' } = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!safeString(credential) || !kv || typeof kv.get !== 'function') {
    return { ok: false, reason: 'session_worker_exchange_store_unavailable' };
  }
  const credentialHash = await sha256Hex(credential);
  const key = `${SESSION_WORKER_MEMBER_EXCHANGE_KV_PREFIX}${credentialHash}`;
  try {
    const value = await kv.get(key);
    return { ok: true, key, credentialHash, consumed: Boolean(value) };
  } catch {
    return { ok: false, reason: 'session_worker_exchange_store_unavailable' };
  }
}

export async function persistSessionWorkerMemberExchange({
  env = {},
  credential = '',
  sessionSlug = '',
  principalId = '',
  ttlSeconds = 1,
  createdAt = null,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!safeString(credential) || !kv || typeof kv.put !== 'function') {
    return { ok: false, reason: 'session_worker_exchange_store_unavailable' };
  }
  const credentialHash = await sha256Hex(credential);
  const key = `${SESSION_WORKER_MEMBER_EXCHANGE_KV_PREFIX}${credentialHash}`;
  const ttl = Math.max(1, Math.floor(Number(ttlSeconds) || 1));
  const record = {
    type: 'session_worker_member_exchange',
    version: 1,
    credentialHash,
    sessionSlug: safeString(sessionSlug).toLowerCase(),
    principalId: safeString(principalId),
    createdAt: safeString(createdAt) || new Date().toISOString(),
  };
  try {
    await kv.put(key, JSON.stringify(record), {
      expirationTtl: ttl,
      metadata: { v: 1, sg: record.sessionSlug, p: record.principalId },
    });
    return { ok: true, key, credentialHash };
  } catch {
    return { ok: false, reason: 'session_worker_exchange_store_unavailable' };
  }
}

export const __test__sessionWorkerAuthority = {
  decodeWorkerCredentialClaims,
  normalizeHttpsOrigin,
  sha256Hex,
};
