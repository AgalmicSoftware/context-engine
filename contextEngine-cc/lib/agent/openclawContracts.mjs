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

function normalizePublicAgentSession(session) {
  const normalized = String(session || '').trim();
  if (!normalized) {
    throw new Error('OpenClaw draft forwarding requires an explicit session; use "general" for the general session.');
  }
  return normalized;
}

export function buildOpenClawDraftForward({
  threadId = '',
  session = '',
  questionId = '',
  draft = {},
} = {}) {
  const normalizedSession = normalizePublicAgentSession(session);
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
