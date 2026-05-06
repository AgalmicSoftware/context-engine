export const AGENT_API_PREFIX = '/api/agent';

export const AGENT_ENDPOINT_FAMILIES = Object.freeze([
  {
    family: 'identity',
    routes: Object.freeze(['GET /api/agent/me']),
    purpose: 'Expose the authenticated local agent identity and capability modes.',
  },
  {
    family: 'sessions',
    routes: Object.freeze(['GET /api/agent/sessions']),
    purpose: 'List sessions through the same local scan scope as the legacy CE-CC API.',
  },
  {
    family: 'questions',
    routes: Object.freeze(['GET /api/agent/questions']),
    purpose: 'Fetch the next safe question payload for a session without browser DOM scraping.',
  },
  {
    family: 'inbox',
    routes: Object.freeze(['GET /api/agent/inbox']),
    purpose: 'Expose local pending-response/request summaries for human review surfaces.',
  },
  {
    family: 'responses',
    routes: Object.freeze([
      'POST /api/agent/responses/draft',
      'GET /api/agent/responses/drafts',
      'POST /api/agent/responses/submit-request',
    ]),
    purpose: 'Split draft storage from submit requests so remote agents do not gain signing authority.',
  },
  {
    family: 'requests',
    routes: Object.freeze(['GET /api/agent/requests/:id']),
    purpose: 'Inspect approval-gated request state by opaque request id.',
  },
]);

export const AGENT_SENSITIVE_FIELD_RE = /(?:privatekey|private_key|worker.?token|bearer|jwt|authorization|secret|signature|mnemonic|seed|password)/i;

export function buildAgentOk(data = {}, { status = 'ok' } = {}) {
  return {
    ok: true,
    status,
    ...data,
  };
}

export function buildAgentError(error, {
  status = 'error',
  code = 'agent_error',
  fields = {},
} = {}) {
  return {
    ok: false,
    status,
    code,
    error: String(error || 'Agent request failed.'),
    ...fields,
  };
}

export function normalizeAgentQuestionPayload({ session = '', question = null, fields = {} } = {}) {
  const normalizedSession = String(session || '').trim();
  const questions = question ? [question] : [];
  return buildAgentOk({
    session: normalizedSession,
    question,
    questions,
    count: questions.length,
    ...fields,
  });
}

export function summarizePendingResponseForAgent(response = {}, { session = '' } = {}) {
  return {
    type: 'response_draft',
    session: String(session || response.session || '').trim(),
    questionId: String(response.questionId || '').trim(),
    questionType: String(response.questionType || 'unknown').trim() || 'unknown',
    respondent: String(response.respondent || '').trim(),
    status: response.submitted ? 'submitted' : 'draft',
    submitted: !!response.submitted,
    timestamp: response.timestamp || null,
    submittedAt: response.submittedAt || null,
    txHash: response.txHash || null,
  };
}

export function summarizeRequestForAgent(request = {}) {
  return {
    type: String(request.type || 'agent_request'),
    requestId: String(request.requestId || '').trim(),
    status: String(request.status || 'pending_approval').trim(),
    requiresApproval: request.requiresApproval !== false,
    approvalUrl: request.approvalUrl || null,
    session: request.session || null,
    questionIds: Array.isArray(request.questionIds) ? request.questionIds.slice() : [],
    requester: request.requester || null,
    createdAt: request.createdAt || null,
    updatedAt: request.updatedAt || null,
  };
}

export function redactAgentSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => redactAgentSensitiveFields(entry));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (AGENT_SENSITIVE_FIELD_RE.test(key)) return [key, '[redacted]'];
    return [key, redactAgentSensitiveFields(entry)];
  }));
}
