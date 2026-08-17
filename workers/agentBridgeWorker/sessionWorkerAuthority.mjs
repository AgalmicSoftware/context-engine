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
  if (parts.length === 2) return decodeBase64UrlJson(parts[0]);
  if (parts.length === 3) return decodeBase64UrlJson(parts[1]);
  return null;
}

function nowSeconds(now = null) {
  const value = now instanceof Date ? now.getTime() : Date.parse(safeString(now));
  return Math.floor((Number.isFinite(value) ? value : Date.now()) / 1000);
}

async function sha256Hex(input = '') {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(input || '')));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeAddress(value = '') {
  const address = safeString(value);
  return /^0x[0-9a-f]{40}$/i.test(address) ? address : '';
}

function normalizeSessionId(value = '') {
  const normalized = safeString(value).toLowerCase().replace(/^0x/, '').replace(/-/g, '');
  return /^[0-9a-f]{32}$/.test(normalized) && !/^0+$/.test(normalized) ? `0x${normalized}` : '';
}

function resolveSessionId(session = {}) {
  const rawValues = [session.sessionId, session.sessionIdHex].filter((value) => safeString(value));
  const normalized = rawValues.map(normalizeSessionId);
  const unique = new Set(normalized.filter(Boolean));
  return normalized.some((value) => !value) || unique.size !== 1 ? '' : [...unique][0];
}

function resolveSessionWorkerOrigin(session = {}) {
  const rawValues = [
    session.sessionWorkerOrigin,
    session.sessionWorkerUrl,
    session.workerUrl,
    session.corsWorkerUrl,
    session.ceSessionWorkerBaseUrl,
    session.CE_SESSION_WORKER_BASE_URL,
  ].filter((value) => safeString(value));
  const normalized = rawValues.map(normalizeHttpsOrigin);
  const unique = new Set(normalized.filter(Boolean));
  return normalized.some((value) => !value) || unique.size !== 1 ? '' : [...unique][0];
}

export function resolvePinnedSessionWorkerAuthority({ policyJson = '', sessionWorkerOrigin = '' } = {}) {
  const policy = parseJsonObject(policyJson);
  if (!policy) {
    return { ok: false, reason: 'dedicated session policy must be valid JSON' };
  }
  const sessions = Array.isArray(policy.sessions)
    ? policy.sessions
    : Array.isArray(policy.linkedSessions)
      ? policy.linkedSessions
      : [];
  if (sessions.length !== 1 || !sessions[0] || typeof sessions[0] !== 'object' || Array.isArray(sessions[0])) {
    return {
      ok: false,
      reason: 'dedicated session policy must contain exactly one session',
    };
  }
  const session = sessions[0];
  const sessionSlug = safeString(session.sessionSlug || session.slug).toLowerCase();
  if (!SESSION_SLUG_RE.test(sessionSlug)) {
    return {
      ok: false,
      reason: 'dedicated session policy requires one valid session slug',
    };
  }
  const defaultSessionSlug = safeString(policy.defaultSessionSlug || policy.defaultSession).toLowerCase();
  if (defaultSessionSlug !== sessionSlug) {
    return {
      ok: false,
      reason: 'dedicated session policy default must match its only session slug',
    };
  }
  const accessEnabled = session.sessionModeProfile?.surfaces?.agentHttp;
  if (typeof accessEnabled !== 'boolean') {
    return {
      ok: false,
      reason: 'dedicated session policy requires an explicit surfaces.agentHttp boolean',
    };
  }
  const configuredOrigin = normalizeHttpsOrigin(sessionWorkerOrigin);
  const policyOrigin = normalizeHttpsOrigin(
    session.sessionWorkerOrigin || session.sessionWorkerUrl || session.workerUrl || session.corsWorkerUrl,
  );
  if (!configuredOrigin || !policyOrigin || configuredOrigin !== policyOrigin) {
    return {
      ok: false,
      reason: 'dedicated session policy must pin the configured session Worker origin',
    };
  }
  const workerCanonical = safeString(session.sessionModeProfile?.authority?.mode).toLowerCase() === 'worker_canonical';
  const authorityMode = safeString(session.sessionModeProfile?.authority?.mode).toLowerCase();
  const sessionId = resolveSessionId(session);
  if (workerCanonical && !sessionId) {
    return {
      ok: false,
      reason: 'dedicated Worker session policy requires one canonical session id',
    };
  }
  return {
    ok: true,
    accessEnabled,
    ...(sessionId ? { sessionId } : {}),
    sessionSlug,
    sessionWorkerOrigin: configuredOrigin,
    authorityMode,
  };
}

export function validateSessionWorkerMemberCredentialBinding({ authority = {}, credentialRecord = {} } = {}) {
  const authoritySlug = safeString(authority.sessionSlug).toLowerCase();
  const authorityOrigin = normalizeHttpsOrigin(authority.sessionWorkerOrigin);
  const authorityMode = safeString(authority.authorityMode).toLowerCase();
  const authoritySessionId = normalizeSessionId(authority.sessionId);
  const credentialSlug = safeString(credentialRecord.sessionSlug).toLowerCase();
  const credentialOrigin = normalizeHttpsOrigin(credentialRecord.sessionWorkerOrigin);
  const rawCredentialSessionId = safeString(credentialRecord.sessionId);
  const credentialSessionId = normalizeSessionId(rawCredentialSessionId);
  if (
    authority.accessEnabled !== true ||
    !authoritySlug ||
    !authorityOrigin ||
    credentialSlug !== authoritySlug ||
    credentialOrigin !== authorityOrigin ||
    (rawCredentialSessionId && !credentialSessionId) ||
    credentialSessionId !== authoritySessionId
  ) {
    return {
      ok: false,
      status: 401,
      reason: 'agent_member_credential_authority_stale',
    };
  }
  return {
    ok: true,
    ...(authoritySessionId ? { sessionId: authoritySessionId } : {}),
    sessionSlug: authoritySlug,
    sessionWorkerOrigin: authorityOrigin,
    authorityMode,
  };
}

export function validateSessionWorkerBrowserCredentialBinding({ session = {}, credentialRecord = {} } = {}) {
  const authorityMode = safeString(session.sessionModeProfile?.authority?.mode).toLowerCase();
  const credentialAuthorityMode = safeString(credentialRecord.sessionAuthorityMode).toLowerCase();
  const rawCredentialSessionId = safeString(credentialRecord.sessionId);
  const rawCredentialOrigin = safeString(credentialRecord.sessionWorkerOrigin);
  const credentialCarriesAuthorityBinding = Boolean(
    credentialAuthorityMode || rawCredentialSessionId || rawCredentialOrigin,
  );

  if (authorityMode !== 'worker_canonical') {
    return credentialCarriesAuthorityBinding
      ? {
          ok: false,
          status: 401,
          reason: 'agent_browser_credential_authority_stale',
        }
      : {
          ok: true,
          sessionSlug: safeString(session.sessionSlug || session.slug).toLowerCase(),
          authorityMode,
        };
  }

  const authoritySlug = safeString(session.sessionSlug || session.slug).toLowerCase();
  const authoritySessionId = resolveSessionId(session);
  const authorityOrigin = resolveSessionWorkerOrigin(session);
  const credentialSlug = safeString(credentialRecord.sessionSlug).toLowerCase();
  const credentialSessionId = normalizeSessionId(rawCredentialSessionId);
  const credentialOrigin = normalizeHttpsOrigin(rawCredentialOrigin);
  if (
    !SESSION_SLUG_RE.test(authoritySlug) ||
    !authoritySessionId ||
    !authorityOrigin ||
    credentialAuthorityMode !== 'worker_canonical' ||
    credentialSlug !== authoritySlug ||
    credentialSessionId !== authoritySessionId ||
    credentialOrigin !== authorityOrigin
  ) {
    return {
      ok: false,
      status: 401,
      reason: 'agent_browser_credential_authority_stale',
    };
  }
  return {
    ok: true,
    sessionId: authoritySessionId,
    sessionSlug: authoritySlug,
    sessionWorkerOrigin: authorityOrigin,
    authorityMode,
  };
}

export async function verifySessionWorkerMembership({
  authority = {},
  credential = '',
  fetchImpl = globalThis.fetch,
  now = null,
} = {}) {
  const sessionSlug = safeString(authority.sessionSlug).toLowerCase();
  const sessionId = normalizeSessionId(authority.sessionId);
  const sessionWorkerOrigin = normalizeHttpsOrigin(authority.sessionWorkerOrigin);
  const suppliedCredential = safeString(credential);
  if (!sessionSlug || !sessionWorkerOrigin) {
    return {
      ok: false,
      status: 503,
      reason: 'session_worker_authority_not_configured',
    };
  }
  if (!suppliedCredential) {
    return {
      ok: false,
      status: 401,
      reason: 'session_worker_credential_missing',
    };
  }
  const claims = decodeWorkerCredentialClaims(suppliedCredential);
  if (!claims || !safeString(claims.jti)) {
    return {
      ok: false,
      status: 401,
      reason: 'session_worker_credential_invalid',
    };
  }
  if (safeString(claims.slug).toLowerCase() !== sessionSlug) {
    return {
      ok: false,
      status: 403,
      reason: 'session_worker_credential_session_mismatch',
    };
  }
  if (sessionId && normalizeSessionId(claims.sessionId) !== sessionId) {
    return {
      ok: false,
      status: 403,
      reason: 'session_worker_credential_session_identity_mismatch',
    };
  }
  const audience = safeString(claims.aud);
  if (audience && normalizeHttpsOrigin(audience) !== sessionWorkerOrigin) {
    return {
      ok: false,
      status: 403,
      reason: 'session_worker_credential_audience_mismatch',
    };
  }
  const exp = Math.floor(Number(claims.exp));
  const currentSeconds = nowSeconds(now);
  if (!Number.isFinite(exp) || exp <= currentSeconds) {
    return {
      ok: false,
      status: 401,
      reason: 'session_worker_credential_expired',
    };
  }
  if (claims.scopes?.groups !== true) {
    return {
      ok: false,
      status: 403,
      reason: 'session_worker_credential_ineligible',
    };
  }
  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      status: 503,
      reason: 'session_worker_authority_unavailable',
    };
  }

  let response;
  let body;
  try {
    const membershipUrl = sessionId
      ? `${sessionWorkerOrigin}/groups/my-memberships?sessionId=${encodeURIComponent(sessionId)}`
      : `${sessionWorkerOrigin}/groups/my-memberships`;
    response = await fetchImpl(membershipUrl, {
      method: 'GET',
      headers: { authorization: `Bearer ${suppliedCredential}` },
      cache: 'no-store',
    });
    body = await response.json();
  } catch {
    return {
      ok: false,
      status: 503,
      reason: 'session_worker_authority_unavailable',
    };
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
      return {
        ok: false,
        status: 403,
        reason: 'session_worker_membership_denied',
      };
    }
    return {
      ok: false,
      status: 503,
      reason: 'session_worker_authority_unavailable',
    };
  }
  if (!Array.isArray(body.memberships)) {
    return {
      ok: false,
      status: 503,
      reason: 'session_worker_authority_invalid_response',
    };
  }
  if (
    sessionId &&
    (safeString(body.sessionSlug).toLowerCase() !== sessionSlug || normalizeSessionId(body.sessionId) !== sessionId)
  ) {
    return {
      ok: false,
      status: 503,
      reason: 'session_worker_authority_invalid_response',
    };
  }
  const principalKind = safeString(body.principal?.kind).toLowerCase();
  const principalAddress = normalizeAddress(body.principal?.address);
  if (!ELIGIBLE_PRINCIPAL_KINDS.has(principalKind) || !principalAddress) {
    return {
      ok: false,
      status: 403,
      reason: 'session_worker_principal_ineligible',
    };
  }
  if (safeString(claims.sub).toLowerCase() !== principalAddress.toLowerCase()) {
    return {
      ok: false,
      status: 403,
      reason: 'session_worker_principal_mismatch',
    };
  }
  return {
    ok: true,
    ...(sessionId ? { sessionId } : {}),
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
