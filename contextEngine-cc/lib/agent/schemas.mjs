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

export const AGENT_DRAFT_RESPONSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
});

export const AGENT_GRANT_STATUS = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

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
  return {
    type: 'agent_grant',
    version: AGENT_CONTRACT_VERSION,
    grantId: String(grant.grantId || '').trim(),
    subject: String(grant.subject || '').trim(),
    scope: String(grant.scope || '').trim(),
    status: Object.values(AGENT_GRANT_STATUS).includes(grant.status)
      ? grant.status
      : AGENT_GRANT_STATUS.ACTIVE,
    expiresAt: grant.expiresAt || null,
    createdAt: grant.createdAt || null,
    revokedAt: grant.revokedAt || null,
    signingAuthority: false,
    workerTokenAuthority: false,
  };
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
