import { createHash } from 'node:crypto';
import {
  getLegacyArweaveTxId,
  resolvePayloadStorageRef,
} from '../storageRefs.mjs';

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
    purpose: 'Expose local pending-response, approval-request, and activity summaries for human review surfaces.',
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
    family: 'connect-requests',
    routes: Object.freeze([
      'POST /api/agent/connect-requests',
      'GET /api/agent/connect-requests/:id',
      'POST /api/agent/connect-requests/approve',
      'POST /api/agent/connect-requests/deny',
    ]),
    purpose: 'Create and review human-approved scoped grant requests without giving remote agents authority.',
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
  {
    family: 'accounts',
    routes: Object.freeze([
      'POST /api/agent/accounts/create',
      'POST /api/agent/accounts/link-request',
    ]),
    purpose: 'Create/recover managed demo account metadata and request account links without exporting secrets.',
  },
]);

export const AGENT_SENSITIVE_FIELD_RE = /(?:privatekey|private_key|worker.?token|bearer|jwt|authorization|secret|signature|mnemonic|seed|password)/i;
export const AGENT_SENSITIVE_VALUE_RE = /(?:bearer\s+[a-z0-9._:-]+|eyj[a-z0-9_-]*\.[a-z0-9_-]*\.|0x[0-9a-f]{64})/i;
export const CE_ACTIVITY_ACTOR_TYPES = Object.freeze(['human_passkey', 'agent', 'telegram', 'openclaw', 'ce_cc']);
const CE_ACTIVITY_EPOCH = '1970-01-01T00:00:00.000Z';

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
  const storageRef = resolvePayloadStorageRef(question, { resource: 'questions' });
  const arweaveTxId = getLegacyArweaveTxId(question) || null;
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
    arweaveTxId,
    ...(storageRef ? { storageRef } : {}),
  };
}

export function normalizeAgentDraftResponse(response = {}, { session = '', includeAnswer = false } = {}) {
  const storageRef = resolvePayloadStorageRef(response, { resource: 'responses' });
  const arweaveTxId = getLegacyArweaveTxId(response);
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
    ...(arweaveTxId ? { arweaveTxId } : {}),
    ...(storageRef ? { storageRef } : {}),
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
  const storageRef = resolvePayloadStorageRef(response, { resource: 'responses' });
  const arweaveTxId = getLegacyArweaveTxId(response);
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
    ...(arweaveTxId ? { arweaveTxId } : {}),
    ...(storageRef ? { storageRef } : {}),
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

function stableActivityHash(value = '', length = 24) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, length);
}

function safeActivityString(value, { max = 256, lower = false } = {}) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const redacted = redactAgentSensitiveFields(raw);
  if (redacted === '[redacted]') return '';
  const normalized = String(redacted).slice(0, max);
  return lower ? normalized.toLowerCase() : normalized;
}

function normalizeActivityDate(value) {
  const raw = safeActivityString(value, { max: 128 });
  if (!raw) return CE_ACTIVITY_EPOCH;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : raw;
}

function inferActivityActorType(value = '', actorId = '') {
  const explicit = safeActivityString(value, { max: 32, lower: true });
  if (CE_ACTIVITY_ACTOR_TYPES.includes(explicit)) return explicit;
  const normalizedActorId = safeActivityString(actorId, { max: 128, lower: true });
  if (normalizedActorId.startsWith('telegram:')) return 'telegram';
  if (normalizedActorId.startsWith('openclaw:')) return 'openclaw';
  if (normalizedActorId.startsWith('passkey:')) return 'human_passkey';
  if (normalizedActorId.includes('ce-cc') || normalizedActorId.includes('contextengine-cc')) return 'ce_cc';
  return 'agent';
}

function normalizeActivityResourceRef(value, prefix = 'resource') {
  const candidate = String(value || '').replace(/\s+/g, ' ').trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(candidate)) {
    return `${prefix}:${candidate.slice(0, 10)}...${candidate.slice(-6)}`;
  }
  const raw = safeActivityString(candidate, { max: 256 });
  if (!raw) return '';
  return raw.slice(0, 160);
}

function normalizeActivityEventType(value) {
  return safeActivityString(value || 'activity_recorded', { max: 96, lower: true })
    .replace(/[^a-z0-9._:-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'activity_recorded';
}

function normalizeActivitySummary(value, fallback = 'Activity recorded.') {
  const normalized = safeActivityString(value, { max: 240 });
  return normalized || fallback;
}

export function normalizeCeActivityEvent(event = {}) {
  const accountId = safeActivityString(
    event.accountId || event.accountPrincipalId || event.principalId || event.subjectAddress || 'unknown',
    { max: 160 },
  ) || 'unknown';
  const subjectAddress = safeActivityString(event.subjectAddress, { max: 128 });
  const session = safeActivityString(event.session, { max: 128 });
  const actorId = safeActivityString(event.actorId || event.subject || event.agentId || 'context-engine-agent', {
    max: 160,
  }) || 'context-engine-agent';
  const actorType = inferActivityActorType(event.actorType, actorId);
  const eventType = normalizeActivityEventType(event.eventType);
  const requestId = safeActivityString(event.requestId, { max: 128 });
  const grantId = safeActivityString(event.grantId, { max: 128 });
  const resourceRef = normalizeActivityResourceRef(event.resourceRef);
  const createdAt = normalizeActivityDate(event.createdAt);
  const eventId = safeActivityString(event.eventId, { max: 128 }) || `ce_activity_${stableActivityHash(JSON.stringify({
    accountId,
    subjectAddress,
    session,
    actorType,
    actorId,
    eventType,
    requestId,
    grantId,
    resourceRef,
    createdAt,
  }))}`;
  const safeSummary = normalizeActivitySummary(event.safeSummary);

  return {
    eventId,
    accountId,
    ...(subjectAddress ? { subjectAddress } : {}),
    ...(session ? { session } : {}),
    actorType,
    actorId,
    eventType,
    ...(requestId ? { requestId } : {}),
    ...(grantId ? { grantId } : {}),
    ...(resourceRef ? { resourceRef } : {}),
    safeSummary,
    createdAt,
  };
}

function summarizeRequestActivityText(summary = {}) {
  const status = safeActivityString(summary.status || 'pending_approval', { max: 64 }).replace(/_/g, ' ');
  const session = safeActivityString(summary.session, { max: 128 });
  const questionCount = Array.isArray(summary.questionIds) ? summary.questionIds.length : 0;
  const questionText = questionCount > 0 ? ` (${questionCount} question${questionCount === 1 ? '' : 's'})` : '';
  return `Agent request ${status}${session ? ` for ${session}` : ''}${questionText}.`;
}

export function summarizeAgentRequestActivityEvent(request = {}, { accountId = '', actorType = '', actorId = '' } = {}) {
  const summary = summarizeRequestForAgent(request);
  const normalizedAccountId = safeActivityString(accountId || summary.requester || request.humanPrincipal || 'unknown', {
    max: 160,
  }) || 'unknown';
  const normalizedActorId = safeActivityString(
    actorId || request.agentId || request.subject || request.source || 'agent',
    { max: 160 },
  ) || 'agent';
  return normalizeCeActivityEvent({
    accountId: normalizedAccountId,
    subjectAddress: summary.requester || request.humanPrincipal || '',
    session: summary.session,
    actorType: actorType || inferActivityActorType('', normalizedActorId),
    actorId: normalizedActorId,
    eventType: `${summary.type || 'agent_request'}.${summary.status || 'pending_approval'}`,
    requestId: summary.requestId,
    grantId: request.grantId,
    resourceRef: summary.requestId,
    safeSummary: summarizeRequestActivityText(summary),
    createdAt: summary.updatedAt || summary.createdAt || request.expiresAt,
  });
}

export function summarizePendingResponseActivityEvent(response = {}, { accountId = '', session = '' } = {}) {
  const summary = summarizePendingResponseForAgent(response, { session });
  const source = safeActivityString(summary.source || response.source || 'contextengine-cc', { max: 160 });
  const eventType = summary.submitted ? 'response_draft.submitted' : 'response_draft.saved';
  return normalizeCeActivityEvent({
    accountId: accountId || summary.respondent || 'unknown',
    subjectAddress: summary.respondent,
    session: summary.session,
    actorType: inferActivityActorType('', source),
    actorId: source || 'contextengine-cc',
    eventType,
    resourceRef: normalizeActivityResourceRef(summary.questionId, 'question'),
    safeSummary: `Draft response ${summary.submitted ? 'submitted' : 'saved'} for ${summary.session || 'session'}.`,
    createdAt: summary.submittedAt || summary.timestamp,
  });
}

function summarizeBridgeActivityText(event = {}) {
  const eventType = normalizeActivityEventType(event.eventType).replace(/_/g, ' ');
  const session = safeActivityString(event.scope?.session || event.session, { max: 128 });
  return `Agent activity ${eventType}${session ? ` for ${session}` : ''}.`;
}

export function summarizeAgentBridgeActivityEvent(event = {}, { accountId = '' } = {}) {
  const scope = event.scope || {};
  const integrationPrincipal = scope.integrationPrincipal || {};
  const agentPrincipal = scope.agentPrincipal || {};
  const summary = event.summary && typeof event.summary === 'object' ? event.summary : {};
  const actorPrincipal = integrationPrincipal.principalId && integrationPrincipal.principalId !== 'integration:unknown'
    ? integrationPrincipal
    : agentPrincipal;
  const actorId = safeActivityString(actorPrincipal.principalId || agentPrincipal.principalId || 'agent', { max: 160 });
  const actorType = inferActivityActorType(actorPrincipal.principalKind, actorId);
  const requestId = safeActivityString(summary.requestId || event.actionRecordId, { max: 128 });

  return normalizeCeActivityEvent({
    eventId: event.eventId,
    accountId: accountId || scope.accountPrincipal?.principalId || summary.accountId || 'unknown',
    subjectAddress: summary.accountAddress || '',
    session: scope.session || event.session,
    actorType,
    actorId,
    eventType: event.eventType || 'agent_bridge_event',
    requestId: requestId.startsWith('agent_req_') ? requestId : '',
    grantId: scope.grantId || summary.grantId || '',
    resourceRef: summary.accountId || event.refs?.payloadRef?.refId || event.actionRecordId,
    safeSummary: summarizeBridgeActivityText(event),
    createdAt: event.createdAt,
  });
}

export function summarizeCeActivityEventCounts(events = []) {
  const counts = {};
  for (const event of Array.isArray(events) ? events : []) {
    const eventType = normalizeActivityEventType(event?.eventType);
    counts[eventType] = (counts[eventType] || 0) + 1;
  }
  return counts;
}

export function sortCeActivityEvents(events = []) {
  return [...(Array.isArray(events) ? events : [])].sort((a, b) => {
    const bTime = Date.parse(b?.createdAt || CE_ACTIVITY_EPOCH);
    const aTime = Date.parse(a?.createdAt || CE_ACTIVITY_EPOCH);
    if (Number.isFinite(bTime) && Number.isFinite(aTime) && bTime !== aTime) return bTime - aTime;
    return String(b?.eventId || '').localeCompare(String(a?.eventId || ''));
  });
}
