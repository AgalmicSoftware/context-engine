// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_CONNECT_REQUEST_STATUS,
  AGENT_GRANT_SCOPES,
  evaluateAgentGrantForRequest,
  evaluateAgentRequestLifecycle,
  normalizeAgentConnectRequest,
  normalizeAgentGrantLifecycle,
  normalizeAgentGrantScopes,
  normalizeAgentPublicSessionSlug,
  normalizeAgentPublicSessions,
} from './lifecycle.mjs';

const NOW_MS = Date.parse('2026-05-06T00:00:00.000Z');

test('agent connect requests normalize scopes and sessions without authority grants', () => {
  const request = normalizeAgentConnectRequest({
    requestId: 'agent_req_connect_1',
    subject: 'telegram:123',
    requestedScopes: [
      AGENT_GRANT_SCOPES.DRAFT,
      AGENT_GRANT_SCOPES.SUBMIT_REQUEST,
      'agent:sign',
      AGENT_GRANT_SCOPES.DRAFT,
    ],
    requestedSessions: [' general ', 'alpha', '', '../bad'],
    status: AGENT_CONNECT_REQUEST_STATUS.APPROVED,
    signingAuthority: true,
    workerTokenAuthority: true,
  });

  assert.deepEqual(request.requestedScopes, [
    AGENT_GRANT_SCOPES.DRAFT,
    AGENT_GRANT_SCOPES.SUBMIT_REQUEST,
  ]);
  assert.deepEqual(request.requestedSessions, ['general', 'alpha']);
  assert.equal(request.status, AGENT_CONNECT_REQUEST_STATUS.APPROVED);
  assert.equal(request.signingAuthority, false);
  assert.equal(request.workerTokenAuthority, false);
});

test('agent grant lifecycle keeps explicit scopes and public sessions', () => {
  assert.deepEqual(normalizeAgentGrantScopes([
    ' AGENT:DRAFT ',
    AGENT_GRANT_SCOPES.DECRYPT_REQUEST,
    'agent:unknown',
  ]), [
    AGENT_GRANT_SCOPES.DRAFT,
    AGENT_GRANT_SCOPES.DECRYPT_REQUEST,
  ]);
  assert.equal(normalizeAgentPublicSessionSlug(' general ').session, 'general');
  assert.equal(normalizeAgentPublicSessionSlug('').ok, false);
  assert.deepEqual(normalizeAgentPublicSessions(['alpha', 'general', 'alpha', '..']), ['alpha', 'general']);

  const grant = normalizeAgentGrantLifecycle({
    grantId: 'grant-1',
    subject: 'telegram:123',
    scopes: [AGENT_GRANT_SCOPES.DRAFT, AGENT_GRANT_SCOPES.SUBMIT_REQUEST],
    sessions: ['general', 'alpha'],
    expiresAt: '2026-05-06T00:10:00.000Z',
    signingAuthority: true,
    workerTokenAuthority: true,
  });

  assert.equal(grant.scope, AGENT_GRANT_SCOPES.DRAFT);
  assert.deepEqual(grant.scopes, [AGENT_GRANT_SCOPES.DRAFT, AGENT_GRANT_SCOPES.SUBMIT_REQUEST]);
  assert.deepEqual(grant.sessions, ['general', 'alpha']);
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
});
