import { safeString, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { AGENT_ONLY_INSTRUCTIONS_VERSION, AGENT_ONLY_ENDPOINTS, canonicalAgentEndpoint, AGENT_ONLY_INSTRUCTIONS } from './wrappedCore.mjs';

export function normalizeStartPayloadVisualDefaults(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    wrapped: input.wrapped === true,
    wrapped_story: false,
    political_compass: false,
  };
}

export function buildAgentOnlyStartPayload({
  sessionSlug = '',
  skillVersion = '',
  visualDefaults = {},
} = {}) {
  const payload = {
    ok: true,
    mode: 'agent_only_mode',
    instructions_version: AGENT_ONLY_INSTRUCTIONS_VERSION,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    statementEndpoint: canonicalAgentEndpoint(AGENT_ONLY_ENDPOINTS.statements),
    answerEndpoint: canonicalAgentEndpoint(AGENT_ONLY_ENDPOINTS.answersBulk),
    voteEndpoint: canonicalAgentEndpoint(AGENT_ONLY_ENDPOINTS.tokenVotesBulk),
    wrappedImageEndpoint: canonicalAgentEndpoint(AGENT_ONLY_ENDPOINTS.wrappedImage),
    budgets: { agent_linear: 100, agent_quadratic: 100 },
    visualDefaults: normalizeStartPayloadVisualDefaults(visualDefaults),
    skillVersion: safeString(skillVersion),
    instructions: AGENT_ONLY_INSTRUCTIONS,
  };
  assertNoSecretShape(payload, 'Agent-only start payload must not serialize secrets.');
  return payload;
}
