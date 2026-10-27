import { safeString } from './runtimePrimitives.mjs';
import { RISK_CEILINGS, RISK_RANK } from './constants.mjs';

export function sessionAuthorityMode(session = {}) {
  return safeString(session.sessionModeProfile?.authority?.mode);
}
export function isHostedAgentHttpSession(session = {}) {
  return sessionAuthorityMode(session) === 'worker_canonical' && session.sessionModeProfile?.surfaces?.agentHttp === true;
}

// This is a domain projection of the one persisted Session Worker config. It
// never discovers sessions or accepts transport flags as an authority fallback.
export function normalizeSessionPolicy(input = {}) {
  const linkedSessions = (input.sessions || []).map(session => {
    const exposure = session.sessionModeProfile?.results?.exposure || session.resultsExposure || {};
    return {
      sessionSlug: safeString(session.sessionSlug), sessionName: safeString(session.sessionName || session.sessionSlug),
      sessionIdHex: session.sessionIdHex, sessionModeProfile: session.sessionModeProfile,
      sessionContext: safeString(session.sessionContext || session.description).slice(0, 1200),
      createdAt: session.createdAt, createdTimestamp: session.createdTimestamp,
      agentHttpEnabled: session.sessionModeProfile?.surfaces?.agentHttp === true,
      managedAccountSubmitAllowed: session.managedAccountSubmitAllowed === true,
      sponsoredAiAllowed: session.sponsoredAiAllowed === true,
      sponsoredRpcAllowed: session.sponsoredRpcAllowed === true,
      sponsoredFaucetAllowed: session.sponsoredFaucetAllowed === true,
      questionAuthoringPermissionMode: session.questionAuthoringPermissionMode || 'session_policy',
      questionTags: Array.isArray(session.questionTags) ? session.questionTags.slice(0, 20) : [],
      tags: Array.isArray(session.tags) ? session.tags.slice(0, 20) : [],
      lightweightGroups: Array.isArray(session.lightweightGroups) ? session.lightweightGroups : [],
      requiredSbtGroups: Array.isArray(session.requiredSbtGroups) ? session.requiredSbtGroups : [],
      resultsExposure: {
        metricsEnabled: true, publishedQuestionsEnabled: exposure.publishedQuestionsEnabled === true,
        aggregateResultsEnabled: exposure.aggregateResultsEnabled !== false,
        anonymizedGroupsEnabled: exposure.anonymizedGroupsEnabled === true,
        minGroupSize: Math.max(2, Math.floor(Number(exposure.minGroupSize) || 2)),
      },
      exportScope: session.sessionModeProfile?.export?.scope || session.exportScope,
      storageProfile: session.storageProfile,
      sessionWorkerUrl: session.sessionWorkerUrl, sessionWorkerSlug: session.sessionWorkerSlug,
      allowOrigins: Array.isArray(session.allowOrigins) ? session.allowOrigins : [],
      surveysAddress: session.surveysAddress, chainId: session.chainId,
    };
  });
  return {
    type: 'session_agent_policy', linkedSessions, defaultSessionSlug: input.defaultSessionSlug,
    riskCeiling: Object.hasOwn(RISK_RANK, input.riskCeiling) ? input.riskCeiling : RISK_CEILINGS.READ,
    allowQuestionGeneration: input.allowQuestionGeneration === true,
    allowAddQuestion: input.allowAddQuestion === true,
    allowGenerateQuestion: input.allowGenerateQuestion === true || input.allowQuestionGeneration === true,
  };
}
export function resolveAgentHttpSessionInvocation(policy = {}, slug = '') {
  const session = (policy.linkedSessions || []).find(entry => entry.sessionSlug === (slug || policy.defaultSessionSlug));
  if (!session) return { ok: false, reason: 'session_not_linked', sessionSlug: slug };
  if (!session.agentHttpEnabled) return { ok: false, reason: 'agent_http_disabled', sessionSlug: slug };
  return { ok: true, session, policy };
}
export const resolveSessionInvocation = resolveAgentHttpSessionInvocation;
