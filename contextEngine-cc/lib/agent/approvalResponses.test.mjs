import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApprovalRequiredResponse,
  buildApprovalUrl,
  createApprovalRequestId,
  isApprovalRequiredResponse,
  isValidApprovalRequestId,
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
