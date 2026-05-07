import { randomUUID } from 'node:crypto';

export const AGENT_REQUEST_ID_RE = /^agent_req_[a-z0-9-]{8,96}$/;
export const AGENT_IDEMPOTENCY_KEY_RE = /^[a-z0-9][a-z0-9._:-]{7,127}$/;

export const AGENT_REQUEST_STATUS = Object.freeze({
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  DENIED: 'denied',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
  FAILED: 'failed',
  SUBMITTED: 'submitted',
});

export const AGENT_REQUEST_TYPES = Object.freeze({
  RESPONSE_SUBMIT: 'response_submit_request',
  QUESTION_CREATE: 'question_create_request',
  DECRYPT: 'decrypt_request',
  GRANT_REVOKE: 'grant_revoke_request',
});

export function createApprovalRequestId(id = randomUUID()) {
  let normalized = String(id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (normalized.length < 8) {
    normalized = randomUUID();
  }
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
    status: AGENT_REQUEST_STATUS.PENDING_APPROVAL,
    reason,
    message,
    ...fields,
  };
}

export function isApprovalRequiredResponse(value) {
  return value?.ok === false
    && value?.requiresApproval === true
    && value?.status === AGENT_REQUEST_STATUS.PENDING_APPROVAL
    && isValidApprovalRequestId(value?.requestId);
}

export function normalizeAgentIdempotencyKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (!AGENT_IDEMPOTENCY_KEY_RE.test(normalized)) {
    return '';
  }
  return normalized;
}

export function buildAgentRequestFingerprint({
  type = AGENT_REQUEST_TYPES.RESPONSE_SUBMIT,
  requester = '',
  session = '',
  questionIds = [],
} = {}) {
  const ids = Array.isArray(questionIds)
    ? [...new Set(questionIds.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean))].sort()
    : [];
  return [
    String(type || '').trim(),
    String(requester || '').trim().toLowerCase(),
    String(session || '').trim().toLowerCase(),
    ...ids,
  ].join('|');
}

export function buildAgentRequestRecord({
  type = AGENT_REQUEST_TYPES.RESPONSE_SUBMIT,
  requestId = createApprovalRequestId(),
  status = AGENT_REQUEST_STATUS.PENDING_APPROVAL,
  requiresApproval = true,
  approvalUrl = null,
  session = '',
  questionIds = [],
  requester = '',
  idempotencyKey = '',
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  source = 'agent-http',
  payload = null,
} = {}) {
  const normalizedQuestionIds = Array.isArray(questionIds)
    ? questionIds.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const record = {
    type,
    requestId,
    status,
    requiresApproval: requiresApproval !== false,
    approvalUrl,
    session: String(session || '').trim(),
    questionIds: normalizedQuestionIds,
    requester: String(requester || '').trim().toLowerCase(),
    idempotencyKey: normalizeAgentIdempotencyKey(idempotencyKey),
    fingerprint: buildAgentRequestFingerprint({
      type,
      requester,
      session,
      questionIds: normalizedQuestionIds,
    }),
    createdAt,
    updatedAt,
    source,
    payload,
  };
  return record;
}
