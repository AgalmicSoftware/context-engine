// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_REQUEST_STATUS,
  AGENT_REQUEST_TYPES,
  buildAgentRequestFingerprint,
  buildAgentRequestRecord,
  buildApprovalRequiredResponse,
  buildApprovalUrl,
  createApprovalRequestId,
  isApprovalRequiredResponse,
  isValidApprovalRequestId,
  normalizeAgentIdempotencyKey,
} from './approvalResponses.mjs';

test('approval request ids are opaque and URL-safe', () => {
  const requestId = createApprovalRequestId('ABC 123 !');
  assert.equal(requestId, 'agent_req_abc-123--');
  assert.equal(isValidApprovalRequestId(requestId), true);
});

test('approval-required response follows the canonical pending shape', () => {
  const response = buildApprovalRequiredResponse({
    requestId: 'agent_req_12345678',
    serverUrl: 'http://localhost:7391/',
  });

  assert.equal(response.ok, false);
  assert.equal(response.requiresApproval, true);
  assert.equal(response.status, 'pending_approval');
  assert.equal(response.approvalUrl, 'http://localhost:7391/agent/requests/agent_req_12345678');
  assert.equal(isApprovalRequiredResponse(response), true);
});

test('approval URL builder trims the server URL', () => {
  assert.equal(
    buildApprovalUrl({ serverUrl: 'http://localhost:7391///', requestId: 'agent_req_abcdef12' }),
    'http://localhost:7391/agent/requests/agent_req_abcdef12',
  );
});

test('idempotency keys are explicit, bounded, and non-secret shaped', () => {
  assert.equal(normalizeAgentIdempotencyKey(' Draft:Alpha.0001 '), 'draft:alpha.0001');
  assert.equal(normalizeAgentIdempotencyKey('short'), '');
  assert.equal(normalizeAgentIdempotencyKey('has spaces inside'), '');
});

test('agent request fingerprints are stable across question id ordering', () => {
  const a = buildAgentRequestFingerprint({
    type: AGENT_REQUEST_TYPES.RESPONSE_SUBMIT,
    requester: '0xABC',
    session: 'Alpha',
    questionIds: ['0x2', '0x1', '0x1'],
  });
  const b = buildAgentRequestFingerprint({
    type: AGENT_REQUEST_TYPES.RESPONSE_SUBMIT,
    requester: '0xabc',
    session: 'alpha',
    questionIds: ['0x1', '0x2'],
  });

  assert.equal(a, b);
  assert.equal(a, 'response_submit_request|0xabc|alpha|0x1|0x2');
});

test('agent request records normalize approval and idempotency metadata', () => {
  const record = buildAgentRequestRecord({
    requestId: 'agent_req_abcdef12',
    approvalUrl: 'http://localhost:7391/agent/requests/agent_req_abcdef12',
    session: 'Alpha',
    requester: '0xABC',
    questionIds: ['0xQ'],
    idempotencyKey: 'Submit:Alpha.0001',
    createdAt: '2026-05-06T00:00:00.000Z',
  });

  assert.equal(record.status, AGENT_REQUEST_STATUS.PENDING_APPROVAL);
  assert.equal(record.requiresApproval, true);
  assert.equal(record.requester, '0xabc');
  assert.equal(record.session, 'Alpha');
  assert.equal(record.questionIds[0], '0xq');
  assert.equal(record.idempotencyKey, 'submit:alpha.0001');
  assert.equal(record.fingerprint, 'response_submit_request|0xabc|alpha|0xq');
});

test('delegated execution fingerprints include grant and action boundaries', () => {
  const record = buildAgentRequestRecord({
    type: AGENT_REQUEST_TYPES.RESPONSE_DELEGATED_EXECUTE,
    requestId: 'agent_req_delegate1',
    status: AGENT_REQUEST_STATUS.APPROVED,
    requiresApproval: false,
    session: 'Alpha',
    requester: '0xABC',
    actionId: 'agent.response.delegated_execute',
    grantId: 'agent_grant_abcdef12',
    questionIds: ['0x2', '0x1'],
  });

  assert.equal(record.requiresApproval, false);
  assert.equal(record.actionId, 'agent.response.delegated_execute');
  assert.equal(record.grantId, 'agent_grant_abcdef12');
  assert.equal(
    record.fingerprint,
    'response_delegated_execute|0xabc|alpha|agent.response.delegated_execute|agent_grant_abcdef12|0x1|0x2',
  );
});
