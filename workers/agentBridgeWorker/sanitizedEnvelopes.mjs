import { AGENT_BRIDGE_WORKER_VERSION } from './constants.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { assertNoSecretShape, redactSecrets, sanitizeForGroup } from './redaction.mjs';

export function buildSanitizedEnvelope({
  envelopeType = 'agent_bridge_envelope',
  lane = '',
  publicSummary = {},
  privateRefs = {},
  createdAt = null,
} = {}) {
  const envelope = {
    type: envelopeType,
    version: AGENT_BRIDGE_WORKER_VERSION,
    envelopeId: buildOpaqueActionId(`${envelopeType}|${JSON.stringify(publicSummary)}|${createdAt || ''}`),
    lane: String(lane || '').trim() || null,
    publicSummary: sanitizeForGroup(publicSummary),
    privateRefs: redactSecrets(privateRefs),
    createdAt,
  };
  assertNoSecretShape(envelope.publicSummary, 'Public summaries must not contain secrets.');
  return envelope;
}

export function groupSafeQuestionSummary(question = {}) {
  return sanitizeForGroup({
    type: 'telegram_group_question_summary',
    questionId: String(question.questionId || question.id || '').trim(),
    questionText: String(question.questionText || question.prompt || '').trim(),
    questionType: String(question.questionType || question.type || 'freeform').trim(),
    answerLabels: Array.isArray(question.answerLabels)
      ? question.answerLabels.map((entry) => String(entry || '').trim()).filter(Boolean)
      : (Array.isArray(question.options) ? question.options.map((entry) => String(entry?.label || entry || '').trim()).filter(Boolean) : []),
    aggregateCount: Number.isFinite(Number(question.aggregateCount)) ? Number(question.aggregateCount) : null,
  });
}
