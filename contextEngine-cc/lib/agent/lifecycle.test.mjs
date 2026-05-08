// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_CONNECT_REQUEST_STATUS,
  AGENT_EXECUTION_POLICIES,
  AGENT_GRANT_SCOPES,
  AGENT_RISK_LEVELS,
  buildAgentConnectRequestFingerprint,
  buildAgentGrantFromConnectRequest,
  evaluateAgentConnectRequestApproval,
  evaluateAgentGrantForRequest,
  evaluateAgentRequestLifecycle,
  evaluateScopedDelegatedExecutionGrant,
  normalizeAgentConnectRequest,
  normalizeAgentGrantAllowedActions,
  normalizeAgentGrantExecutionPolicy,
  normalizeAgentGrantLifecycle,
  normalizeAgentGrantRiskCeiling,
  normalizeAgentGrantScopes,
  normalizeAgentPublicSessionSlug,
  normalizeAgentPublicSessions,
  validateAgentConnectRequestForCreation,
} from './lifecycle.mjs';

const NOW_MS = Date.parse('2026-05-06T00:00:00.000Z');

test('agent connect requests normalize scopes and sessions without authority grants', () => {
  const request = normalizeAgentConnectRequest({
    requestId: 'agent_req_connect_1',
    subject: 'telegram:123',
    requestedScopes: [
      AGENT_GRANT_SCOPES.DRAFT,
      AGENT_GRANT_SCOPES.SUBMIT_REQUEST,
      AGENT_GRANT_SCOPES.DELEGATED_EXECUTE,
      'agent:sign',
      AGENT_GRANT_SCOPES.DRAFT,
    ],
    requestedSessions: [' general ', 'alpha', '', '../bad'],
    requestedActions: ['agent.response.delegated_execute', 'bad action', 'agent.response.delegated_execute'],
    riskCeiling: 'medium',
    executionPolicy: AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE,
    status: AGENT_CONNECT_REQUEST_STATUS.APPROVED,
    signingAuthority: true,
    workerTokenAuthority: true,
  });

  assert.deepEqual(request.requestedScopes, [
    AGENT_GRANT_SCOPES.DRAFT,
    AGENT_GRANT_SCOPES.SUBMIT_REQUEST,
    AGENT_GRANT_SCOPES.DELEGATED_EXECUTE,
  ]);
  assert.deepEqual(request.requestedSessions, ['general', 'alpha']);
  assert.deepEqual(request.requestedActions, ['agent.response.delegated_execute']);
  assert.equal(request.riskCeiling, AGENT_RISK_LEVELS.MEDIUM);
  assert.equal(request.executionPolicy, AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE);
  assert.equal(request.auditRequired, true);
  assert.equal(request.status, AGENT_CONNECT_REQUEST_STATUS.APPROVED);
  assert.equal(request.signingAuthority, false);
  assert.equal(request.workerTokenAuthority, false);
});

test('agent connect request creation requires bounded scoped grant fields and fingerprints them', () => {
  const valid = validateAgentConnectRequestForCreation({
    requestId: 'agent_req_connect123',
    humanPrincipal: '0xABC',
    agentId: 'telegram:agent-1',
    requestedScopes: [AGENT_GRANT_SCOPES.DELEGATED_EXECUTE],
    requestedSessions: ['alpha'],
    requestedActions: ['agent.response.delegated_execute'],
    riskCeiling: 'medium',
    executionPolicy: AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE,
    auditRequired: true,
    expiresAt: '2026-05-06T00:10:00.000Z',
    idempotencyKey: 'telegram:alpha.0001',
  }, { nowMs: NOW_MS });

  assert.equal(valid.ok, true);
  assert.equal(valid.request.humanPrincipal, '0xabc');
  assert.equal(valid.request.agentId, 'telegram:agent-1');
  assert.equal(valid.request.idempotencyKey, 'telegram:alpha.0001');
  assert.equal(
    valid.request.fingerprint,
    buildAgentConnectRequestFingerprint(valid.request),
  );
  assert.match(valid.request.fingerprint, /^connect_grant_request\|0xabc\|telegram:agent-1\|/);
  assert.equal(valid.request.signingAuthority, false);
  assert.equal(valid.request.workerTokenAuthority, false);

  for (const [reason, patch] of [
    ['agent_identity_required', { agentId: '', subject: '' }],
    ['invalid_requested_scopes', { requestedScopes: ['agent:delegated-execute', 'agent:sign'] }],
    ['invalid_requested_sessions', { requestedSessions: ['alpha', '../bad'] }],
    ['invalid_requested_actions', { requestedActions: ['agent.response.delegated_execute', '../bad'] }],
    ['risk_ceiling_required', { riskCeiling: '' }],
    ['invalid_execution_policy', { executionPolicy: 'remote_auto_submit' }],
    ['trusted_local_auto_submit_local_only', { executionPolicy: AGENT_EXECUTION_POLICIES.TRUSTED_LOCAL_AUTO_SUBMIT }],
    ['request_expired', { expiresAt: '2026-05-05T23:59:00.000Z' }],
    ['invalid_idempotency_key', { idempotencyKey: 'short' }],
    ['remote_signing_authority_denied', { signingAuthority: true }],
    ['action_scope_mismatch', { requestedScopes: [AGENT_GRANT_SCOPES.DRAFT] }],
  ]) {
    const result = validateAgentConnectRequestForCreation({
      ...valid.request,
      ...patch,
    }, { nowMs: NOW_MS });
    assert.equal(result.reason, reason);
  }
});

test('agent connect request approval denies replay and scope mismatch attempts', () => {
  const connectRequest = validateAgentConnectRequestForCreation({
    requestId: 'agent_req_connect456',
    humanPrincipal: '0xABC',
    agentId: 'telegram:agent-1',
    requestedScopes: [AGENT_GRANT_SCOPES.DELEGATED_EXECUTE],
    requestedSessions: ['alpha'],
    requestedActions: ['agent.response.delegated_execute'],
    riskCeiling: 'medium',
    executionPolicy: AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE,
    auditRequired: true,
    expiresAt: '2026-05-06T00:10:00.000Z',
    idempotencyKey: 'telegram:alpha.0002',
  }, { nowMs: NOW_MS }).request;

  const baseApproval = {
    humanPrincipal: '0xabc',
    agentId: 'telegram:agent-1',
    session: 'alpha',
    actionId: 'agent.response.delegated_execute',
    riskLevel: AGENT_RISK_LEVELS.MEDIUM,
    nowMs: NOW_MS,
  };
  assert.equal(evaluateAgentConnectRequestApproval(connectRequest, baseApproval).reason, 'connect_request_approvable');
  assert.equal(evaluateAgentConnectRequestApproval(connectRequest, {
    ...baseApproval,
    humanPrincipal: '0x9999',
  }).reason, 'human_principal_mismatch');
  assert.equal(evaluateAgentConnectRequestApproval(connectRequest, {
    ...baseApproval,
    agentId: 'openclaw:other',
  }).reason, 'agent_identity_mismatch');
  assert.equal(evaluateAgentConnectRequestApproval(connectRequest, {
    ...baseApproval,
    session: 'beta',
  }).reason, 'session_mismatch');
  assert.equal(evaluateAgentConnectRequestApproval(connectRequest, {
    ...baseApproval,
    actionId: 'agent.response.submit_request',
  }).reason, 'action_mismatch');
  assert.equal(evaluateAgentConnectRequestApproval(connectRequest, {
    ...baseApproval,
    riskLevel: AGENT_RISK_LEVELS.HIGH,
  }).reason, 'risk_ceiling_exceeded');
  assert.equal(evaluateAgentConnectRequestApproval({
    ...connectRequest,
    status: AGENT_CONNECT_REQUEST_STATUS.APPROVED,
  }, baseApproval).reason, 'connect_request_not_pending');
  assert.equal(evaluateAgentConnectRequestApproval({
    ...connectRequest,
    fingerprint: 'tampered',
  }, baseApproval).reason, 'connect_request_fingerprint_mismatch');

  const grant = buildAgentGrantFromConnectRequest(connectRequest, {
    grantId: 'agent_grant_connect456',
    approvedAt: '2026-05-06T00:01:00.000Z',
  });
  assert.equal(grant.grantId, 'agent_grant_connect456');
  assert.equal(grant.humanPrincipal, '0xabc');
  assert.equal(grant.agentId, 'telegram:agent-1');
  assert.deepEqual(grant.sessions, ['alpha']);
  assert.deepEqual(grant.allowedActions, ['agent.response.delegated_execute']);
  assert.equal(grant.executionPolicy, AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE);
  assert.equal(grant.signingAuthority, false);
  assert.equal(grant.workerTokenAuthority, false);
});

test('agent grant lifecycle keeps explicit scopes and public sessions', () => {
  assert.deepEqual(normalizeAgentGrantScopes([
    ' AGENT:DRAFT ',
    AGENT_GRANT_SCOPES.DELEGATED_EXECUTE,
    AGENT_GRANT_SCOPES.DECRYPT_REQUEST,
    'agent:unknown',
  ]), [
    AGENT_GRANT_SCOPES.DRAFT,
    AGENT_GRANT_SCOPES.DELEGATED_EXECUTE,
    AGENT_GRANT_SCOPES.DECRYPT_REQUEST,
  ]);
  assert.deepEqual(normalizeAgentGrantAllowedActions([
    ' Agent.Response.Delegated_Execute ',
    '../bad',
    'agent.response.delegated_execute',
  ]), ['agent.response.delegated_execute']);
  assert.equal(normalizeAgentGrantRiskCeiling('HIGH'), AGENT_RISK_LEVELS.HIGH);
  assert.equal(normalizeAgentGrantRiskCeiling('unknown'), AGENT_RISK_LEVELS.LOW);
  assert.equal(
    normalizeAgentGrantExecutionPolicy('scoped_delegated_execute'),
    AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE,
  );
  assert.equal(normalizeAgentPublicSessionSlug(' general ').session, 'general');
  assert.equal(normalizeAgentPublicSessionSlug('').ok, false);
  assert.deepEqual(normalizeAgentPublicSessions(['alpha', 'general', 'alpha', '..']), ['alpha', 'general']);

  const grant = normalizeAgentGrantLifecycle({
    grantId: 'grant-1',
    humanPrincipal: '0xABC',
    agentId: 'telegram:123',
    scopes: [AGENT_GRANT_SCOPES.DRAFT, AGENT_GRANT_SCOPES.DELEGATED_EXECUTE],
    sessions: ['general', 'alpha'],
    allowedActions: ['agent.response.delegated_execute'],
    riskCeiling: 'medium',
    executionPolicy: AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE,
    expiresAt: '2026-05-06T00:10:00.000Z',
    signingAuthority: true,
    workerTokenAuthority: true,
  });

  assert.equal(grant.scope, AGENT_GRANT_SCOPES.DRAFT);
  assert.equal(grant.humanPrincipal, '0xabc');
  assert.equal(grant.agentId, 'telegram:123');
  assert.deepEqual(grant.scopes, [AGENT_GRANT_SCOPES.DRAFT, AGENT_GRANT_SCOPES.DELEGATED_EXECUTE]);
  assert.deepEqual(grant.sessions, ['general', 'alpha']);
  assert.deepEqual(grant.allowedActions, ['agent.response.delegated_execute']);
  assert.equal(grant.riskCeiling, AGENT_RISK_LEVELS.MEDIUM);
  assert.equal(grant.executionPolicy, AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE);
  assert.equal(grant.auditRequired, true);
  assert.equal(grant.signingAuthority, false);
  assert.equal(grant.workerTokenAuthority, false);
});

test('agent grant access denies expired revoked scope and session mismatches', () => {
  const activeGrant = {
    grantId: 'grant-1',
    subject: 'telegram:123',
    scopes: [AGENT_GRANT_SCOPES.DRAFT],
    sessions: ['general'],
    expiresAt: '2026-05-06T00:10:00.000Z',
  };

  assert.equal(evaluateAgentGrantForRequest(activeGrant, {
    requiredScope: AGENT_GRANT_SCOPES.DRAFT,
    session: 'general',
    nowMs: NOW_MS,
  }).ok, true);
  assert.equal(evaluateAgentGrantForRequest({
    ...activeGrant,
    revokedAt: '2026-05-05T23:59:00.000Z',
  }, {
    requiredScope: AGENT_GRANT_SCOPES.DRAFT,
    session: 'general',
    nowMs: NOW_MS,
  }).reason, 'grant_revoked');
  assert.equal(evaluateAgentGrantForRequest({
    ...activeGrant,
    expiresAt: '2026-05-05T23:59:00.000Z',
  }, {
    requiredScope: AGENT_GRANT_SCOPES.DRAFT,
    session: 'general',
    nowMs: NOW_MS,
  }).reason, 'grant_expired');
  assert.equal(evaluateAgentGrantForRequest(activeGrant, {
    requiredScope: AGENT_GRANT_SCOPES.SUBMIT_REQUEST,
    session: 'general',
    nowMs: NOW_MS,
  }).reason, 'scope_mismatch');
  assert.equal(evaluateAgentGrantForRequest(activeGrant, {
    requiredScope: AGENT_GRANT_SCOPES.DRAFT,
    session: 'alpha',
    nowMs: NOW_MS,
  }).reason, 'session_mismatch');
});

test('scoped delegated execution decisions enforce action risk identity audit and authority boundaries', () => {
  const grant = {
    grantId: 'agent_grant_valid123',
    humanPrincipal: '0x1234',
    agentId: 'telegram:agent-1',
    scopes: [AGENT_GRANT_SCOPES.DELEGATED_EXECUTE],
    sessions: ['alpha'],
    allowedActions: ['agent.response.delegated_execute'],
    riskCeiling: AGENT_RISK_LEVELS.MEDIUM,
    executionPolicy: AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE,
    auditRequired: true,
    expiresAt: '2026-05-06T00:10:00.000Z',
  };
  const baseRequest = {
    requiredScope: AGENT_GRANT_SCOPES.DELEGATED_EXECUTE,
    session: 'alpha',
    actionId: 'agent.response.delegated_execute',
    riskLevel: AGENT_RISK_LEVELS.MEDIUM,
    humanPrincipal: '0x1234',
    agentId: 'telegram:agent-1',
    nowMs: NOW_MS,
    auditWillBeRecorded: true,
  };

  assert.equal(evaluateScopedDelegatedExecutionGrant(grant, baseRequest).reason, 'delegated_execution_allowed');
  assert.equal(evaluateScopedDelegatedExecutionGrant(grant, {
    ...baseRequest,
    session: 'beta',
  }).reason, 'session_mismatch');
  assert.equal(evaluateScopedDelegatedExecutionGrant(grant, {
    ...baseRequest,
    actionId: 'agent.response.other',
  }).reason, 'action_mismatch');
  assert.equal(evaluateScopedDelegatedExecutionGrant(grant, {
    ...baseRequest,
    riskLevel: AGENT_RISK_LEVELS.HIGH,
  }).reason, 'risk_ceiling_exceeded');
  assert.equal(evaluateScopedDelegatedExecutionGrant(grant, {
    ...baseRequest,
    humanPrincipal: '0x9999',
  }).reason, 'human_principal_mismatch');
  assert.equal(evaluateScopedDelegatedExecutionGrant(grant, {
    ...baseRequest,
    agentId: 'openclaw:other',
  }).reason, 'agent_identity_mismatch');
  assert.equal(evaluateScopedDelegatedExecutionGrant(grant, {
    ...baseRequest,
    auditWillBeRecorded: false,
  }).reason, 'audit_required');
  assert.equal(evaluateScopedDelegatedExecutionGrant(grant, {
    ...baseRequest,
    exposesRemoteSigningAuthority: true,
  }).reason, 'remote_signing_authority_denied');
  assert.equal(evaluateScopedDelegatedExecutionGrant(grant, {
    ...baseRequest,
    requiresSigningAuthority: true,
  }).reason, 'ce_owned_execution_required');
  assert.equal(evaluateScopedDelegatedExecutionGrant(grant, {
    ...baseRequest,
    requiresSigningAuthority: true,
    ceOwnedExecution: true,
  }).reason, 'delegated_execution_allowed');
  assert.equal(evaluateScopedDelegatedExecutionGrant({
    ...grant,
    executionPolicy: AGENT_EXECUTION_POLICIES.APPROVAL_REQUIRED,
  }, baseRequest).reason, 'approval_required');
  assert.equal(evaluateScopedDelegatedExecutionGrant({
    ...grant,
    executionPolicy: AGENT_EXECUTION_POLICIES.TRUSTED_LOCAL_AUTO_SUBMIT,
  }, baseRequest).reason, 'trusted_local_auto_submit_local_only');
});

test('agent request lifecycle keeps approval states explicit', () => {
  assert.deepEqual(evaluateAgentRequestLifecycle({
    status: 'pending_approval',
    expiresAt: '2026-05-06T00:10:00.000Z',
  }, { nowMs: NOW_MS }), {
    ok: true,
    status: 'pending_approval',
    reason: 'request_active',
  });
  assert.deepEqual(evaluateAgentRequestLifecycle({
    status: 'pending_approval',
    expiresAt: '2026-05-05T23:59:00.000Z',
  }, { nowMs: NOW_MS }), {
    ok: false,
    status: 'expired',
    reason: 'request_expired',
  });
  assert.deepEqual(evaluateAgentRequestLifecycle({
    status: 'revoked',
    expiresAt: '2026-05-06T00:10:00.000Z',
  }, { nowMs: NOW_MS }), {
    ok: false,
    status: 'revoked',
    reason: 'request_revoked',
  });
  assert.deepEqual(evaluateAgentRequestLifecycle({
    status: 'rejected',
  }, { nowMs: NOW_MS }), {
    ok: false,
    status: 'rejected',
    reason: 'request_rejected',
  });
  assert.deepEqual(evaluateAgentRequestLifecycle({
    status: 'denied',
  }, { nowMs: NOW_MS }), {
    ok: false,
    status: 'denied',
    reason: 'request_denied',
  });
  assert.deepEqual(evaluateAgentRequestLifecycle({
    status: 'failed',
  }, { nowMs: NOW_MS }), {
    ok: false,
    status: 'failed',
    reason: 'request_failed',
  });
});
