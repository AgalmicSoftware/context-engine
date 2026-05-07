import { AGENT_REQUEST_STATUS } from './approvalResponses.mjs';
import {
  AGENT_CONTRACT_VERSION,
  AGENT_GRANT_STATUS,
  normalizeAgentGrant,
} from './schemas.mjs';

const SESSION_SLUG_RE = /^[a-z0-9_-]+$/i;
const MAX_SESSION_SLUG_LENGTH = 128;

export const AGENT_GRANT_SCOPES = Object.freeze({
  READ: 'agent:read',
  DRAFT: 'agent:draft',
  SUBMIT_REQUEST: 'agent:submit-request',
  CREATE_QUESTION_REQUEST: 'agent:create-question-request',
  DECRYPT_REQUEST: 'agent:decrypt-request',
  REVOKE_GRANT: 'agent:revoke-grant',
});

export const AGENT_CONNECT_REQUEST_STATUS = Object.freeze({
  PENDING_APPROVAL: AGENT_REQUEST_STATUS.PENDING_APPROVAL,
  APPROVED: AGENT_REQUEST_STATUS.APPROVED,
  REJECTED: AGENT_REQUEST_STATUS.REJECTED,
  REVOKED: AGENT_REQUEST_STATUS.REVOKED,
  EXPIRED: AGENT_REQUEST_STATUS.EXPIRED,
});

const GRANT_SCOPE_SET = new Set(Object.values(AGENT_GRANT_SCOPES));
const CONNECT_STATUS_SET = new Set(Object.values(AGENT_CONNECT_REQUEST_STATUS));

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function unique(values) {
  return [...new Set(values)];
}

function parseTimestampState(value, { nowMs = Date.now() } = {}) {
  if (!value) return { state: 'none' };
  const time = Date.parse(String(value));
  if (!Number.isFinite(time)) return { state: 'invalid' };
  return { state: time <= nowMs ? 'expired' : 'active', time };
}

export function normalizeAgentGrantScopes(value = []) {
  return unique(toArray(value)
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter((entry) => GRANT_SCOPE_SET.has(entry)));
}

export function normalizeAgentPublicSessionSlug(value) {
  const session = String(value || '').trim();
  if (!session) {
    return {
      ok: false,
      error: 'Agent public sessions must be explicit; use "general" for the general session.',
    };
  }
  if (session.length > MAX_SESSION_SLUG_LENGTH || !SESSION_SLUG_RE.test(session)) {
    return { ok: false, error: 'Invalid agent public session slug.' };
  }
  return { ok: true, session };
}

export function normalizeAgentPublicSessions(value = []) {
  return unique(toArray(value)
    .map((entry) => normalizeAgentPublicSessionSlug(entry))
    .filter((entry) => entry.ok)
    .map((entry) => entry.session));
}

export function normalizeAgentConnectRequest(request = {}) {
  const requestedScopes = normalizeAgentGrantScopes(
    request.requestedScopes ?? request.scopes ?? request.scope,
  );
  const requestedSessions = normalizeAgentPublicSessions(
    request.requestedSessions ?? request.sessions ?? request.session,
  );
  const status = String(request.status || AGENT_CONNECT_REQUEST_STATUS.PENDING_APPROVAL).trim();

  return {
    type: 'agent_connect_request',
    version: AGENT_CONTRACT_VERSION,
    requestId: String(request.requestId || '').trim(),
    subject: String(request.subject || '').trim(),
    status: CONNECT_STATUS_SET.has(status) ? status : AGENT_CONNECT_REQUEST_STATUS.PENDING_APPROVAL,
    requestedScopes,
    requestedSessions,
    approvalUrl: request.approvalUrl || null,
    createdAt: request.createdAt || null,
    expiresAt: request.expiresAt || null,
    signingAuthority: false,
    workerTokenAuthority: false,
  };
}

export function normalizeAgentGrantLifecycle(grant = {}) {
  const base = normalizeAgentGrant(grant);
  const scopes = normalizeAgentGrantScopes(grant.scopes ?? grant.scope);
  const sessions = normalizeAgentPublicSessions(grant.sessions ?? grant.session);

  return {
    ...base,
    scope: scopes[0] || base.scope || '',
    scopes,
    sessions,
  };
}

export function evaluateAgentGrantForRequest(grant = {}, {
  requiredScope = '',
  session = '',
  nowMs = Date.now(),
} = {}) {
  const normalized = normalizeAgentGrantLifecycle(grant);
  const expiry = parseTimestampState(normalized.expiresAt, { nowMs });
  const scope = String(requiredScope || '').trim().toLowerCase();

  if (normalized.status === AGENT_GRANT_STATUS.REVOKED || normalized.revokedAt) {
    return { ok: false, status: AGENT_GRANT_STATUS.REVOKED, reason: 'grant_revoked', grant: normalized };
  }
  if (normalized.status === AGENT_GRANT_STATUS.EXPIRED || expiry.state === 'expired') {
    return { ok: false, status: AGENT_GRANT_STATUS.EXPIRED, reason: 'grant_expired', grant: normalized };
  }
  if (expiry.state === 'invalid') {
    return { ok: false, status: 'invalid', reason: 'invalid_expiration', grant: normalized };
  }
  if (scope && !normalized.scopes.includes(scope)) {
    return { ok: false, status: 'denied', reason: 'scope_mismatch', grant: normalized };
  }
  if (normalized.sessions.length) {
    const sessionResult = normalizeAgentPublicSessionSlug(session);
    if (!sessionResult.ok) {
      return { ok: false, status: 'denied', reason: 'invalid_session', grant: normalized };
    }
    if (!normalized.sessions.includes(sessionResult.session)) {
      return { ok: false, status: 'denied', reason: 'session_mismatch', grant: normalized };
    }
  }
  return { ok: true, status: AGENT_GRANT_STATUS.ACTIVE, reason: 'grant_allowed', grant: normalized };
}

export function evaluateAgentRequestLifecycle(request = {}, { nowMs = Date.now() } = {}) {
  const status = String(request.status || AGENT_REQUEST_STATUS.PENDING_APPROVAL).trim();
  const expiry = parseTimestampState(request.expiresAt, { nowMs });

  if (status === AGENT_REQUEST_STATUS.REVOKED || request.revokedAt) {
    return { ok: false, status: AGENT_REQUEST_STATUS.REVOKED, reason: 'request_revoked' };
  }
  if (status === AGENT_REQUEST_STATUS.EXPIRED || expiry.state === 'expired') {
    return { ok: false, status: AGENT_REQUEST_STATUS.EXPIRED, reason: 'request_expired' };
  }
  if (expiry.state === 'invalid') {
    return { ok: false, status: 'invalid', reason: 'invalid_expiration' };
  }
  if (status === AGENT_REQUEST_STATUS.REJECTED) {
    return { ok: false, status, reason: 'request_rejected' };
  }
  if (status === AGENT_REQUEST_STATUS.DENIED) {
    return { ok: false, status, reason: 'request_denied' };
  }
  if (status === AGENT_REQUEST_STATUS.FAILED) {
    return { ok: false, status, reason: 'request_failed' };
  }
  return { ok: true, status, reason: 'request_active' };
}
