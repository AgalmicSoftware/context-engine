import { safeJsonParse } from './runtimePrimitives.mjs';
import { CE_AGENT_ACCESS_SKILL_VERSION, CE_SESSION_WRAPPED_SKILL_VERSION } from './httpConstants.mjs';
import { sessionWrappedSkillVersionPayload, skillVersionPayload, skillVersionPayloadWithFlag } from './discovery.mjs';
import { applyDelegationToInput, authenticateAgentHandoff } from './httpAuth.mjs';
import { normalizeAgentRequestContext } from './httpInput.mjs';
import { normalizePreferenceTagHints, publicAgentQuestion, rankQuestionsByPreferences } from './questions.mjs';
import { buildQuestionVoteRecommendations } from './questionVotes.mjs';
import { normalizeDraftForQuestion, normalizePreferenceEntries } from './participation.mjs';
import { AGENT_HTTP_ROUTES } from './dispatch.mjs';

const __test__agentHttp = {
  AGENT_HTTP_ROUTES,
  CE_AGENT_ACCESS_SKILL_VERSION,
  CE_SESSION_WRAPPED_SKILL_VERSION,
  authenticateAgentHandoff,
  applyDelegationToInput,
  normalizeAgentRequestContext,
  normalizeDraftForQuestion,
  normalizePreferenceTagHints,
  normalizePreferenceEntries,
  buildQuestionVoteRecommendations,
  publicAgentQuestion,
  rankQuestionsByPreferences,
  safeJsonParse,
  skillVersionPayload,
  skillVersionPayloadWithFlag,
  sessionWrappedSkillVersionPayload,
};

export { __test__agentHttp };
