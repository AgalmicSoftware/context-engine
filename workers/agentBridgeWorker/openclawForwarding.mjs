import { AGENT_BRIDGE_WORKER_VERSION } from './constants.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { buildTelegramPoseQuestionState } from './questionUi.mjs';
import { assertNoSecretShape, sanitizeForGroup } from './redaction.mjs';

export const MOCK_OPENCLAW_FORWARDING_EVENTS = Object.freeze([
  'delivered_question',
  'draft_created',
  'submit_request_created',
  'approval_required',
  'failed',
  'final_status',
]);

const EVENT_SET = new Set(MOCK_OPENCLAW_FORWARDING_EVENTS);
const safeString = (value) => String(value || '').trim();

export function buildMockOpenClawForwardingEnvelope({
  event = 'delivered_question',
  sessionSlug = '',
  question = {},
  draftRef = '',
  requestId = '',
  status = '',
  failureCode = '',
  createdAt = null,
} = {}) {
  const normalizedEvent = safeString(event);
  if (!EVENT_SET.has(normalizedEvent)) {
    throw new Error('Unsupported mock OpenClaw forwarding event.');
  }
  const poseState = question && Object.keys(question).length
    ? buildTelegramPoseQuestionState({ sessionSlug, question, createdAt })
    : null;
  const publicSummary = sanitizeForGroup({
    event: normalizedEvent,
    sessionSlug: safeString(sessionSlug),
    question: poseState?.groupSafeOutput || null,
    draftPresent: !!safeString(draftRef),
    requestId: safeString(requestId) || null,
    status: safeString(status || normalizedEvent),
    failureCode: safeString(failureCode) || null,
  });
  const envelope = {
    type: 'mock_openclaw_forwarding_envelope',
    version: AGENT_BRIDGE_WORKER_VERSION,
    transport: 'mock_contract_only',
    realHttpTransportImplemented: false,
    envelopeId: buildOpaqueActionId(`openclaw|${normalizedEvent}|${sessionSlug}|${requestId}|${draftRef}`),
    publicSummary,
    refs: sanitizeForGroup({
      draftRef: safeString(draftRef) || null,
      requestId: safeString(requestId) || null,
      questionId: safeString(question.questionId || question.id) || null,
    }),
    canonicalApiRequest: {
      method: normalizedEvent === 'delivered_question' ? 'GET' : 'POST',
      path: normalizedEvent === 'delivered_question'
        ? '/api/agent/questions'
        : '/api/agent/events/forward-openclaw',
      status: 'planned_contract_only',
    },
    createdAt,
  };
  assertNoSecretShape(envelope, 'Mock OpenClaw forwarding envelopes must not serialize secrets.');
  return envelope;
}
