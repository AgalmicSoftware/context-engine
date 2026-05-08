import {
  AGENT_REQUEST_STATUS,
  AGENT_REQUEST_TYPES,
  normalizeAgentIdempotencyKey,
} from './approvalResponses.mjs';
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
  DELEGATED_EXECUTE: 'agent:delegated-execute',
  CREATE_QUESTION_REQUEST: 'agent:create-question-request',
  DECRYPT_REQUEST: 'agent:decrypt-request',
  REVOKE_GRANT: 'agent:revoke-grant',
});

export const AGENT_EXECUTION_POLICIES = Object.freeze({
  APPROVAL_REQUIRED: 'approval_required',
  SCOPED_DELEGATED_EXECUTE: 'scoped_delegated_execute',
  TRUSTED_LOCAL_AUTO_SUBMIT: 'trusted_local_auto_submit',
});

export const AGENT_RISK_LEVELS = Object.freeze({
  READ: 'read',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
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
const EXECUTION_POLICY_SET = new Set(Object.values(AGENT_EXECUTION_POLICIES));
const RISK_RANK = Object.freeze({
  [AGENT_RISK_LEVELS.READ]: 0,
  [AGENT_RISK_LEVELS.LOW]: 1,
  [AGENT_RISK_LEVELS.MEDIUM]: 2,
  [AGENT_RISK_LEVELS.HIGH]: 3,
  [AGENT_RISK_LEVELS.CRITICAL]: 4,
});
const ACTION_ID_RE = /^[a-z][a-z0-9_]*(?:[._:-][a-z0-9_]+)*$/;

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function unique(values) {
  return [...new Set(values)];
}

const normalizeComparableIdentity = (value) => String(value || '').trim().toLowerCase();

function normalizeActionId(value) {
  const actionId = String(value || '').trim().toLowerCase();
  return ACTION_ID_RE.test(actionId) ? actionId : '';
}

function normalizeRiskLevel(value, fallback = AGENT_RISK_LEVELS.LOW) {
  const risk = String(value || '').trim().toLowerCase();
  return Object.hasOwn(RISK_RANK, risk) ? risk : fallback;
}

function riskAllowed({ requestedRisk = AGENT_RISK_LEVELS.LOW, riskCeiling = AGENT_RISK_LEVELS.LOW } = {}) {
  return RISK_RANK[normalizeRiskLevel(requestedRisk)] <= RISK_RANK[normalizeRiskLevel(riskCeiling)];
}

function sortedUniqueLower(values = []) {
  return unique(toArray(values)
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean))
    .sort();
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

export function normalizeAgentGrantAllowedActions(value = []) {
  return unique(toArray(value)
    .map((entry) => normalizeActionId(entry))
    .filter(Boolean));
}

export function normalizeAgentGrantRiskCeiling(value) {
  return normalizeRiskLevel(value, AGENT_RISK_LEVELS.LOW);
}

export function normalizeAgentGrantExecutionPolicy(value) {
  const policy = String(value || '').trim().toLowerCase();
  return EXECUTION_POLICY_SET.has(policy)
    ? policy
    : AGENT_EXECUTION_POLICIES.APPROVAL_REQUIRED;
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

export function buildAgentConnectRequestFingerprint(request = {}) {
  const requestedScopes = normalizeAgentGrantScopes(
    request.requestedScopes ?? request.scopes ?? request.scope,
  );
  const requestedSessions = normalizeAgentPublicSessions(
    request.requestedSessions ?? request.sessions ?? request.session,
  );
  const requestedActions = normalizeAgentGrantAllowedActions(
    request.requestedActions ?? request.allowedActions ?? request.action,
  );
  return [
    AGENT_REQUEST_TYPES.CONNECT_GRANT,
    normalizeComparableIdentity(request.humanPrincipal ?? request.requester ?? request.principal),
    normalizeComparableIdentity(request.agentId ?? request.subject),
    ...sortedUniqueLower(requestedScopes).map((entry) => `scope:${entry}`),
    ...sortedUniqueLower(requestedSessions).map((entry) => `session:${entry}`),
    ...sortedUniqueLower(requestedActions).map((entry) => `action:${entry}`),
    `risk:${normalizeAgentGrantRiskCeiling(request.riskCeiling)}`,
    `policy:${normalizeAgentGrantExecutionPolicy(request.executionPolicy)}`,
    `audit:${request.auditRequired === false ? 'optional' : 'required'}`,
    `expires:${String(request.expiresAt || '').trim()}`,
  ].join('|');
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
    type: AGENT_REQUEST_TYPES.CONNECT_GRANT,
    version: AGENT_CONTRACT_VERSION,
    requestId: String(request.requestId || '').trim(),
    humanPrincipal: String(request.humanPrincipal || request.requester || request.principal || '').trim().toLowerCase(),
    agentId: String(request.agentId || request.subject || '').trim(),
    subject: String(request.subject || request.agentId || '').trim(),
    status: CONNECT_STATUS_SET.has(status) ? status : AGENT_CONNECT_REQUEST_STATUS.PENDING_APPROVAL,
    requestedScopes,
    requestedSessions,
    requestedActions: normalizeAgentGrantAllowedActions(
      request.requestedActions ?? request.allowedActions ?? request.action,
    ),
    riskCeiling: normalizeAgentGrantRiskCeiling(request.riskCeiling),
    executionPolicy: normalizeAgentGrantExecutionPolicy(request.executionPolicy),
    auditRequired: request.auditRequired !== false,
    idempotencyKey: normalizeAgentIdempotencyKey(request.idempotencyKey),
    fingerprint: String(request.fingerprint || buildAgentConnectRequestFingerprint(request)).trim(),
    approvalUrl: request.approvalUrl || null,
    createdAt: request.createdAt || null,
    updatedAt: request.updatedAt || null,
    approvedAt: request.approvedAt || null,
    deniedAt: request.deniedAt || null,
    grantId: request.grantId || null,
    expiresAt: request.expiresAt || null,
    signingAuthority: false,
    workerTokenAuthority: false,
    privateKeyAuthority: false,
    longLivedBearerAuthority: false,
  };
}

export function validateAgentConnectRequestForCreation(input = {}, {
  humanPrincipal = input.humanPrincipal || input.requester || input.principal || '',
  nowMs = Date.now(),
} = {}) {
  const request = normalizeAgentConnectRequest({
    ...input,
    humanPrincipal,
  });
  const rawScopes = toArray(input.requestedScopes ?? input.scopes ?? input.scope)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  const rawSessions = toArray(input.requestedSessions ?? input.sessions ?? input.session)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  const rawActions = toArray(input.requestedActions ?? input.allowedActions ?? input.action)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  const rawRisk = String(input.riskCeiling || '').trim().toLowerCase();
  const rawPolicy = String(input.executionPolicy || '').trim().toLowerCase();
  const expiry = parseTimestampState(request.expiresAt, { nowMs });

  if (!request.humanPrincipal) {
    return { ok: false, reason: 'human_principal_required', request };
  }
  if (!request.agentId) {
    return { ok: false, reason: 'agent_identity_required', request };
  }
  if (!rawScopes.length) {
    return { ok: false, reason: 'requested_scopes_required', request };
  }
  if (request.requestedScopes.length !== sortedUniqueLower(rawScopes).length) {
    return { ok: false, reason: 'invalid_requested_scopes', request };
  }
  if (!rawSessions.length) {
    return { ok: false, reason: 'requested_sessions_required', request };
  }
  if (request.requestedSessions.length !== sortedUniqueLower(rawSessions).length) {
    return { ok: false, reason: 'invalid_requested_sessions', request };
  }
  if (!rawActions.length) {
    return { ok: false, reason: 'requested_actions_required', request };
  }
  if (request.requestedActions.length !== sortedUniqueLower(rawActions).length) {
    return { ok: false, reason: 'invalid_requested_actions', request };
  }
  if (!rawRisk) {
    return { ok: false, reason: 'risk_ceiling_required', request };
  }
  if (!Object.hasOwn(RISK_RANK, rawRisk)) {
    return { ok: false, reason: 'invalid_risk_ceiling', request };
  }
  if (!rawPolicy) {
    return { ok: false, reason: 'execution_policy_required', request };
  }
  if (!EXECUTION_POLICY_SET.has(rawPolicy)) {
    return { ok: false, reason: 'invalid_execution_policy', request };
  }
  if (request.executionPolicy === AGENT_EXECUTION_POLICIES.TRUSTED_LOCAL_AUTO_SUBMIT) {
    return { ok: false, reason: 'trusted_local_auto_submit_local_only', request };
  }
  if (!request.expiresAt) {
    return { ok: false, reason: 'expires_at_required', request };
  }
  if (expiry.state === 'invalid') {
    return { ok: false, reason: 'invalid_expiration', request };
  }
  if (expiry.state === 'expired') {
    return { ok: false, reason: 'request_expired', request };
  }
  if (!request.idempotencyKey) {
    return { ok: false, reason: 'invalid_idempotency_key', request };
  }
  if (
    input.signingAuthority
    || input.workerTokenAuthority
    || input.privateKeyAuthority
    || input.longLivedBearerAuthority
  ) {
    return { ok: false, reason: 'remote_signing_authority_denied', request };
  }
  if (
    request.requestedActions.includes('agent.response.delegated_execute')
    && !request.requestedScopes.includes(AGENT_GRANT_SCOPES.DELEGATED_EXECUTE)
  ) {
    return { ok: false, reason: 'action_scope_mismatch', request };
  }
  if (
    request.executionPolicy === AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE
    && !request.requestedScopes.includes(AGENT_GRANT_SCOPES.DELEGATED_EXECUTE)
  ) {
    return { ok: false, reason: 'delegated_execute_scope_required', request };
  }

  return {
    ok: true,
    reason: 'connect_request_valid',
    request: {
      ...request,
      fingerprint: buildAgentConnectRequestFingerprint(request),
    },
  };
}

export function evaluateAgentConnectRequestApproval(request = {}, {
  humanPrincipal = '',
  agentId = '',
  session = '',
  actionId = '',
  riskLevel = '',
  nowMs = Date.now(),
} = {}) {
  const normalized = normalizeAgentConnectRequest(request);
  const lifecycle = evaluateAgentRequestLifecycle(normalized, { nowMs });
  if (!lifecycle.ok) {
    return { ...lifecycle, request: normalized };
  }
  if (normalized.status !== AGENT_CONNECT_REQUEST_STATUS.PENDING_APPROVAL) {
    return { ok: false, status: normalized.status, reason: 'connect_request_not_pending', request: normalized };
  }
  if (normalized.fingerprint !== buildAgentConnectRequestFingerprint(normalized)) {
    return { ok: false, status: 'denied', reason: 'connect_request_fingerprint_mismatch', request: normalized };
  }
  const requestedHuman = normalizeComparableIdentity(humanPrincipal);
  if (normalized.humanPrincipal && requestedHuman && normalizeComparableIdentity(normalized.humanPrincipal) !== requestedHuman) {
    return { ok: false, status: 'denied', reason: 'human_principal_mismatch', request: normalized };
  }
  const requestedAgent = normalizeComparableIdentity(agentId);
  if (normalized.agentId && requestedAgent && normalizeComparableIdentity(normalized.agentId) !== requestedAgent) {
    return { ok: false, status: 'denied', reason: 'agent_identity_mismatch', request: normalized };
  }
  const requestedSession = String(session || '').trim();
  if (requestedSession) {
    const sessionResult = normalizeAgentPublicSessionSlug(requestedSession);
    if (!sessionResult.ok) {
      return { ok: false, status: 'denied', reason: 'invalid_session', request: normalized };
    }
    if (!normalized.requestedSessions.includes(sessionResult.session)) {
      return { ok: false, status: 'denied', reason: 'session_mismatch', request: normalized };
    }
  }
  const normalizedActionId = normalizeActionId(actionId);
  if (normalizedActionId && !normalized.requestedActions.includes(normalizedActionId)) {
    return { ok: false, status: 'denied', reason: 'action_mismatch', request: normalized };
  }
  if (riskLevel && !riskAllowed({ requestedRisk: riskLevel, riskCeiling: normalized.riskCeiling })) {
    return { ok: false, status: 'denied', reason: 'risk_ceiling_exceeded', request: normalized };
  }
  if (
    normalized.signingAuthority
    || normalized.workerTokenAuthority
    || normalized.privateKeyAuthority
    || normalized.longLivedBearerAuthority
  ) {
    return { ok: false, status: 'denied', reason: 'remote_signing_authority_denied', request: normalized };
  }
  return { ok: true, status: normalized.status, reason: 'connect_request_approvable', request: normalized };
}

export function buildAgentGrantFromConnectRequest(request = {}, {
  grantId = '',
  approvedAt = new Date().toISOString(),
} = {}) {
  const normalized = normalizeAgentConnectRequest(request);
  return normalizeAgentGrantLifecycle({
    grantId,
    humanPrincipal: normalized.humanPrincipal,
    agentId: normalized.agentId,
    subject: normalized.agentId,
    scopes: normalized.requestedScopes,
    sessions: normalized.requestedSessions,
    allowedActions: normalized.requestedActions,
    riskCeiling: normalized.riskCeiling,
    executionPolicy: normalized.executionPolicy,
    auditRequired: normalized.auditRequired,
    status: AGENT_GRANT_STATUS.ACTIVE,
    expiresAt: normalized.expiresAt,
    createdAt: approvedAt,
    updatedAt: approvedAt,
    revokedAt: null,
    connectRequestId: normalized.requestId,
    signingAuthority: false,
    workerTokenAuthority: false,
    privateKeyAuthority: false,
    longLivedBearerAuthority: false,
  });
}

export function normalizeAgentGrantLifecycle(grant = {}) {
  const base = normalizeAgentGrant(grant);
  const scopes = normalizeAgentGrantScopes(grant.scopes ?? grant.scope);
  const sessions = normalizeAgentPublicSessions(grant.sessions ?? grant.session);
  const allowedActions = normalizeAgentGrantAllowedActions(
    grant.allowedActions ?? grant.actions ?? grant.action,
  );

  return {
    ...base,
    scope: scopes[0] || base.scope || '',
    scopes,
    sessions,
    allowedActions,
    action: allowedActions[0] || base.action || '',
    riskCeiling: normalizeAgentGrantRiskCeiling(grant.riskCeiling ?? base.riskCeiling),
    executionPolicy: normalizeAgentGrantExecutionPolicy(grant.executionPolicy ?? base.executionPolicy),
    auditRequired: grant.auditRequired !== false && base.auditRequired !== false,
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

export function evaluateScopedDelegatedExecutionGrant(grant = {}, {
  requiredScope = AGENT_GRANT_SCOPES.DELEGATED_EXECUTE,
  session = '',
  actionId = '',
  riskLevel = AGENT_RISK_LEVELS.LOW,
  humanPrincipal = '',
  agentId = '',
  nowMs = Date.now(),
  auditWillBeRecorded = true,
  exposesRemoteSigningAuthority = false,
  exposesRemoteWorkerAuthority = false,
  requiresSigningAuthority = false,
  requiresWorkerAuthority = false,
  ceOwnedExecution = false,
} = {}) {
  const normalized = normalizeAgentGrantLifecycle(grant);
  const lifecycle = evaluateAgentGrantForRequest(normalized, {
    requiredScope,
    session,
    nowMs,
  });
  if (!lifecycle.ok) {
    return { ...lifecycle, grant: normalized };
  }
  if (!normalized.expiresAt) {
    return { ok: false, status: 'denied', reason: 'expiry_required', grant: normalized };
  }

  if (normalized.executionPolicy !== AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE) {
    return {
      ok: false,
      status: 'denied',
      reason: normalized.executionPolicy === AGENT_EXECUTION_POLICIES.TRUSTED_LOCAL_AUTO_SUBMIT
        ? 'trusted_local_auto_submit_local_only'
        : 'approval_required',
      grant: normalized,
    };
  }

  if (!normalized.humanPrincipal) {
    return { ok: false, status: 'denied', reason: 'human_principal_required', grant: normalized };
  }
  if (!normalized.agentId) {
    return { ok: false, status: 'denied', reason: 'agent_identity_required', grant: normalized };
  }
  if (!normalized.sessions.length) {
    return { ok: false, status: 'denied', reason: 'session_scope_required', grant: normalized };
  }

  const requestedHuman = normalizeComparableIdentity(humanPrincipal);
  if (normalized.humanPrincipal && requestedHuman && normalizeComparableIdentity(normalized.humanPrincipal) !== requestedHuman) {
    return { ok: false, status: 'denied', reason: 'human_principal_mismatch', grant: normalized };
  }

  const requestedAgent = normalizeComparableIdentity(agentId);
  if (normalized.agentId && requestedAgent && normalizeComparableIdentity(normalized.agentId) !== requestedAgent) {
    return { ok: false, status: 'denied', reason: 'agent_identity_mismatch', grant: normalized };
  }

  const normalizedActionId = normalizeActionId(actionId);
  if (!normalizedActionId || !normalized.allowedActions.includes(normalizedActionId)) {
    return { ok: false, status: 'denied', reason: 'action_mismatch', grant: normalized };
  }

  if (!riskAllowed({ requestedRisk: riskLevel, riskCeiling: normalized.riskCeiling })) {
    return { ok: false, status: 'denied', reason: 'risk_ceiling_exceeded', grant: normalized };
  }

  if (normalized.auditRequired && auditWillBeRecorded !== true) {
    return { ok: false, status: 'denied', reason: 'audit_required', grant: normalized };
  }

  if (
    exposesRemoteSigningAuthority
    || exposesRemoteWorkerAuthority
    || normalized.signingAuthority
    || normalized.workerTokenAuthority
  ) {
    return { ok: false, status: 'denied', reason: 'remote_signing_authority_denied', grant: normalized };
  }

  if ((requiresSigningAuthority || requiresWorkerAuthority) && ceOwnedExecution !== true) {
    return { ok: false, status: 'denied', reason: 'ce_owned_execution_required', grant: normalized };
  }

  return {
    ok: true,
    status: AGENT_GRANT_STATUS.ACTIVE,
    reason: 'delegated_execution_allowed',
    grant: normalized,
    actionId: normalizedActionId,
    riskLevel: normalizeRiskLevel(riskLevel),
    auditRequired: normalized.auditRequired,
  };
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
