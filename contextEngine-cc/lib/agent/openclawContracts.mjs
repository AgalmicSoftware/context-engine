import { normalizeAgentIdempotencyKey } from './approvalResponses.mjs';

export const OPENCLAW_THREAD_ADAPTER_CONTRACT = Object.freeze({
  name: 'OpenClawThreadAdapter',
  version: 'agent-contract-v1',
  dependency: 'optional',
  transport: 'adapter',
  methods: Object.freeze([
    'forwardApprovalRequired',
    'forwardAgentDraft',
    'syncRequestStatus',
  ]),
  constraints: Object.freeze([
    'Direct HTTP must work without OpenClaw.',
    'MCP outputs mirror canonical /api/agent/* responses.',
    'Thread forwarding is optional and must not scrape browser DOM.',
  ]),
});

export const OPENCLAW_THREAD_EVENT_STATES = Object.freeze([
  'delivered',
  'drafted',
  'submit_requested',
  'approved',
  'submitted',
  'failed',
]);

const OPENCLAW_THREAD_EVENT_STATE_SET = new Set(OPENCLAW_THREAD_EVENT_STATES);
const PUBLIC_SESSION_RE = /^[a-z0-9_-]+$/i;
const MAX_PUBLIC_SESSION_LENGTH = 128;

function normalizePublicAgentSession(session, {
  required = false,
  context = 'OpenClaw forwarding',
} = {}) {
  const normalized = String(session || '').trim();
  if (!normalized) {
    if (required) {
      throw new Error(`${context} requires an explicit session; use "general" for the general session.`);
    }
    return '';
  }
  if (normalized.length > MAX_PUBLIC_SESSION_LENGTH || !PUBLIC_SESSION_RE.test(normalized)) {
    throw new Error('Invalid OpenClaw public session slug.');
  }
  return normalized;
}

export function buildOpenClawApprovalForward({
  threadId = '',
  requestId = '',
  approvalUrl = '',
  message = 'Human approval is required before submission.',
} = {}) {
  return {
    adapter: OPENCLAW_THREAD_ADAPTER_CONTRACT.name,
    version: OPENCLAW_THREAD_ADAPTER_CONTRACT.version,
    event: 'approval_required',
    threadId: String(threadId || '').trim() || null,
    requestId: String(requestId || '').trim(),
    approvalUrl: String(approvalUrl || '').trim(),
    message,
    http: {
      method: 'GET',
      path: requestId ? `/api/agent/requests/${encodeURIComponent(requestId)}` : '/api/agent/requests/:id',
    },
  };
}

export function buildOpenClawThreadEventEnvelope({
  event = '',
  threadId = '',
  requestId = '',
  approvalUrl = '',
  status = '',
  session = '',
  questionId = '',
  idempotencyKey = '',
  payload = {},
  http = {},
} = {}) {
  const normalizedEvent = String(event || '').trim();
  if (!OPENCLAW_THREAD_EVENT_STATE_SET.has(normalizedEvent)) {
    throw new Error('Invalid OpenClaw thread event state.');
  }
  const normalizedIdempotencyKey = normalizeAgentIdempotencyKey(idempotencyKey);
  if (idempotencyKey && !normalizedIdempotencyKey) {
    throw new Error('OpenClaw idempotency keys must be stable and non-secret.');
  }
  const normalizedRequestId = String(requestId || '').trim();
  const normalizedSession = normalizePublicAgentSession(session);
  const path = String(http.path || '').trim()
    || (normalizedRequestId
      ? `/api/agent/requests/${encodeURIComponent(normalizedRequestId)}`
      : '/api/agent/inbox');

  return {
    adapter: OPENCLAW_THREAD_ADAPTER_CONTRACT.name,
    version: OPENCLAW_THREAD_ADAPTER_CONTRACT.version,
    event: normalizedEvent,
    threadId: String(threadId || '').trim() || null,
    requestId: normalizedRequestId || null,
    approvalUrl: String(approvalUrl || '').trim() || null,
    status: String(status || normalizedEvent).trim(),
    session: normalizedSession || null,
    questionId: String(questionId || '').trim() || null,
    idempotencyKey: normalizedIdempotencyKey || null,
    payload,
    http: {
      method: String(http.method || 'GET').trim().toUpperCase(),
      path,
    },
  };
}

export function buildOpenClawDraftForward({
  threadId = '',
  session = '',
  questionId = '',
  draft = {},
} = {}) {
  const normalizedSession = normalizePublicAgentSession(session, {
    required: true,
    context: 'OpenClaw draft forwarding',
  });
  return {
    adapter: OPENCLAW_THREAD_ADAPTER_CONTRACT.name,
    version: OPENCLAW_THREAD_ADAPTER_CONTRACT.version,
    event: 'draft_saved',
    threadId: String(threadId || '').trim() || null,
    session: normalizedSession,
    questionId: String(questionId || '').trim(),
    draft,
    http: {
      method: 'GET',
      path: `/api/agent/responses/drafts?session=${encodeURIComponent(normalizedSession)}`,
    },
  };
}

export function normalizeOpenClawThreadTarget(target = {}) {
  return {
    enabled: target?.enabled === true,
    threadId: String(target?.threadId || '').trim() || null,
    adapterName: String(target?.adapterName || OPENCLAW_THREAD_ADAPTER_CONTRACT.name).trim(),
  };
}

export function validateOpenClawAdapterEnvelope(envelope = {}) {
  const path = String(envelope?.http?.path || '').trim();
  if (!path.startsWith('/api/agent/')) {
    return { ok: false, error: 'OpenClaw adapter envelopes must point to canonical /api/agent routes.' };
  }
  const serialized = JSON.stringify(envelope).toLowerCase();
  if (serialized.includes('queryselector') || serialized.includes('document.') || serialized.includes('dom')) {
    return { ok: false, error: 'OpenClaw adapter envelopes must not depend on browser DOM scraping.' };
  }
  return { ok: true };
}
