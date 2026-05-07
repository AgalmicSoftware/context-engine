export const AGENT_API_PREFIX = '/api/agent';
export const AGENT_CONTRACT_VERSION = 'agent-contract-v1';

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
      'POST /api/agent/responses/delegated-execute',
    ]),
    purpose: 'Split draft storage from submit requests so remote agents do not gain signing authority.',
  },
  {
    family: 'requests',
    routes: Object.freeze(['GET /api/agent/requests/:id']),
    purpose: 'Inspect approval-gated request state by opaque request id.',
  },
  {
    family: 'grants',
    routes: Object.freeze([
      'GET /api/agent/grants',
      'GET /api/agent/grants/:id',
      'POST /api/agent/grants/revoke',
    ]),
    purpose: 'Read and revoke scoped delegated grants without creating authority from remote payloads.',
  },
]);

export const AGENT_SENSITIVE_FIELD_RE = /(?:privatekey|private_key|worker.?token|bearer|jwt|authorization|secret|signature|mnemonic|seed|password)/i;
export const AGENT_SENSITIVE_VALUE_RE = /(?:bearer\s+[a-z0-9._:-]+|eyj[a-z0-9_-]*\.[a-z0-9_-]*\.|0x[0-9a-f]{64})/i;

export const AGENT_DRAFT_RESPONSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
});

const TERMINAL_AGENT_REQUEST_STATUSES = new Set([
  'denied',
  'expired',
  'failed',
  'rejected',
  'revoked',
  'submitted',
]);

export const AGENT_GRANT_STATUS = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

export const AGENT_GRANT_ID_RE = /^agent_grant_[a-z0-9-]{8,96}$/;

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
  const normalizedQuestion = normalizeAgentQuestion(question, { session: normalizedSession });
  const questions = normalizedQuestion ? [normalizedQuestion] : [];
  return buildAgentOk({
    session: normalizedSession,
    question: normalizedQuestion,
    questions,
    count: questions.length,
    ...fields,
  });
}

export function normalizeAgentQuestion(question = {}, { session = '' } = {}) {
  if (!question || typeof question !== 'object') return null;
  return {
    type: 'agent_question',
    version: AGENT_CONTRACT_VERSION,
    session: String(session || question.session || '').trim(),
    questionId: String(question.questionId || question.id || '').trim(),
    id: String(question.id || question.questionId || '').trim(),
    questionType: String(question.questionType || question.type || 'unknown').trim() || 'unknown',
    prompt: String(question.prompt || '').trim(),
    options: Array.isArray(question.options) ? question.options.slice() : [],
    tags: Array.isArray(question.tags) ? question.tags.slice() : [],
    associatedSurveyId: question.associatedSurveyId || null,
    arweaveTxId: question.arweaveTxId || null,
  };
}

export function normalizeAgentDraftResponse(response = {}, { session = '', includeAnswer = false } = {}) {
  const draft = {
    type: 'agent_draft_response',
    version: AGENT_CONTRACT_VERSION,
    session: String(session || response.session || '').trim(),
    questionId: String(response.questionId || '').trim(),
    questionType: String(response.questionType || 'unknown').trim() || 'unknown',
    respondent: String(response.respondent || '').trim(),
    status: response.submitted ? AGENT_DRAFT_RESPONSE_STATUS.SUBMITTED : AGENT_DRAFT_RESPONSE_STATUS.DRAFT,
    submitted: !!response.submitted,
    timestamp: response.timestamp || null,
    submittedAt: response.submittedAt || null,
    txHash: response.txHash || null,
    source: response.source || null,
  };
  if (includeAnswer) {
    draft.answer = response.answer ?? null;
    draft.additional = response.additional ?? null;
  }
  return draft;
}

export function normalizeAgentGrant(grant = {}) {
  const subject = String(grant.subject || grant.agentId || '').trim();
  return {
    type: 'agent_grant',
    version: AGENT_CONTRACT_VERSION,
    grantId: String(grant.grantId || '').trim(),
    humanPrincipal: String(grant.humanPrincipal || grant.wallet || grant.principal || '').trim().toLowerCase(),
    agentId: String(grant.agentId || subject).trim(),
    subject,
    scope: String(grant.scope || '').trim(),
    action: String(grant.action || '').trim(),
    allowedActions: Array.isArray(grant.allowedActions) ? grant.allowedActions.slice() : [],
    riskCeiling: String(grant.riskCeiling || 'low').trim().toLowerCase(),
    executionPolicy: String(grant.executionPolicy || 'approval_required').trim().toLowerCase(),
    auditRequired: grant.auditRequired !== false,
    status: Object.values(AGENT_GRANT_STATUS).includes(grant.status)
      ? grant.status
      : AGENT_GRANT_STATUS.ACTIVE,
    expiresAt: grant.expiresAt || null,
    createdAt: grant.createdAt || null,
    revokedAt: grant.revokedAt || null,
    updatedAt: grant.updatedAt || null,
    signingAuthority: false,
    workerTokenAuthority: false,
    privateKeyAuthority: false,
    longLivedBearerAuthority: false,
  };
}

export function isValidAgentGrantId(grantId) {
  return AGENT_GRANT_ID_RE.test(String(grantId || '').trim());
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
  const status = String(request.status || 'pending_approval').trim();
  const terminal = TERMINAL_AGENT_REQUEST_STATUSES.has(status);
  return {
    type: String(request.type || 'agent_request'),
    requestId: String(request.requestId || '').trim(),
    status,
    requiresApproval: status === 'pending_approval' && request.requiresApproval !== false,
    terminal,
    approvalUrl: request.approvalUrl || null,
    session: request.session || null,
    questionIds: Array.isArray(request.questionIds) ? request.questionIds.slice() : [],
    requester: request.requester || null,
    createdAt: request.createdAt || null,
    updatedAt: request.updatedAt || null,
  };
}

export function summarizeAgentRequestStatusCounts(requests = []) {
  const counts = {};
  for (const request of Array.isArray(requests) ? requests : []) {
    const status = String(request?.status || 'pending_approval').trim();
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

export function redactAgentSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => redactAgentSensitiveFields(entry));
  }
  if (typeof value === 'string' && AGENT_SENSITIVE_VALUE_RE.test(value)) {
    return '[redacted]';
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (AGENT_SENSITIVE_FIELD_RE.test(key)) return [key, '[redacted]'];
    return [key, redactAgentSensitiveFields(entry)];
  }));
}
