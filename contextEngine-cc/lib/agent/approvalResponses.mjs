import { randomUUID } from 'node:crypto';

export const AGENT_REQUEST_ID_RE = /^agent_req_[a-z0-9-]{8,96}$/;

export function createApprovalRequestId(id = randomUUID()) {
  const normalized = String(id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `agent_req_${normalized.slice(0, 96)}`;
}

export function isValidApprovalRequestId(requestId) {
  return AGENT_REQUEST_ID_RE.test(String(requestId || '').trim());
}

export function buildApprovalUrl({ serverUrl = 'http://localhost:7391', requestId } = {}) {
  const base = String(serverUrl || 'http://localhost:7391').trim().replace(/\/+$/, '');
  const id = String(requestId || '').trim();
  return `${base}/agent/requests/${encodeURIComponent(id)}`;
}

export function buildApprovalRequiredResponse({
  requestId = createApprovalRequestId(),
  approvalUrl = null,
  serverUrl = 'http://localhost:7391',
  reason = 'human_approval_required',
  message = 'Human approval is required before this agent request can be submitted.',
  fields = {},
} = {}) {
  const id = String(requestId || '').trim();
  return {
    ok: false,
    requiresApproval: true,
    requestId: id,
    approvalUrl: approvalUrl || buildApprovalUrl({ serverUrl, requestId: id }),
    status: 'pending_approval',
    reason,
    message,
    ...fields,
  };
}

export function isApprovalRequiredResponse(value) {
  return value?.ok === false
    && value?.requiresApproval === true
    && value?.status === 'pending_approval'
    && isValidApprovalRequestId(value?.requestId);
}
