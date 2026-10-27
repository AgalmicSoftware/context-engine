

import { json } from './httpInput.mjs';
import { handleSessionMetaHttpRequest, sessionWrappedSkillRedirectResponse, sessionWrappedSkillVersionPayload, skillRedirectResponse, skillVersionPayloadWithFlag } from './discovery.mjs';


import { handleServiceCredentialBootstrapRequest } from './credentialBootstrap.mjs';
import { handleCreateQuestionsRequest, handleGeoBacklinkRequest, handleQuestionsRequest, handleTagsRequest } from './questions.mjs';
import { handleNextQuestionRequest, handleQuestionQueueApplyRequest, handleQuestionQueuePlanRequest, handleQuestionQueueRequest } from './questionQueue.mjs';

import { handleAdminAgentOnlyConfigRequest, handleAdminAgentOnlyExportRequest, handleAdminMetricsRequest, handleAdminQuestionsDeleteRequest, handleAdminSkillUpdateRequest, handleAdminStatusRequest } from './admin.mjs';
import { handleChildSessionRequest, handleGroupProposalRequest, handleGroupsRequest, handleOnboardingRequest } from './groups.mjs';
import { handleResultViewCacheRequest, handleResultsImageRequest, handleResultsRequest } from './results.mjs';
import { handleAgentOnlyAnswersBulkRequest, handleAgentOnlyStartRequest, handleAgentOnlyStatementsRequest, handleAgentOnlyTokenVotesBulkRequest, handleAgentOnlyWrappedImageRequest, handleAgentOnlyWrappedImageViewRequest } from './wrapped.mjs';
import { handleActionsRequest, handleQuestionVoteApplyRequest, handleQuestionVoteRecommendationsRequest } from './questionVotes.mjs';
import { handlePreferencesRequest } from './participation.mjs';
import { handleInviteOnboardRequest } from './invites.mjs';
import { handleClientLoginExchangeRequest, handleWrappedMemberExchangeRequest } from './exchanges.mjs';

import { AGENT_ROUTES } from './routes.mjs';
export const AGENT_HTTP_ROUTES = new Set(Object.keys(AGENT_ROUTES));
const handlers = {
  '/api/agent/credentials/service': handleServiceCredentialBootstrapRequest,
  '/api/agent/invite/onboard': handleInviteOnboardRequest,
  '/api/agent/client-login/exchange': handleClientLoginExchangeRequest,
  '/api/agent/wrapped/member-exchange': handleWrappedMemberExchangeRequest,
  '/api/agent/session-meta': handleSessionMetaHttpRequest,
  '/api/agent/agent-only/start': handleAgentOnlyStartRequest,
  '/api/agent/questions': handleQuestionsRequest,
  '/api/agent/tags': handleTagsRequest,
  '/api/agent/questions/next': handleNextQuestionRequest,
  '/api/agent/questions/create': handleCreateQuestionsRequest,
  '/api/agent/question-queue': handleQuestionQueueRequest,
  '/api/agent/question-queue/plan': handleQuestionQueuePlanRequest,
  '/api/agent/question-queue/apply': handleQuestionQueueApplyRequest,
  '/api/agent/question-votes/recommend': handleQuestionVoteRecommendationsRequest,
  '/api/agent/question-votes/apply': handleQuestionVoteApplyRequest,
  '/api/agent/actions': handleActionsRequest,
  '/api/agent/preferences': handlePreferencesRequest,
  '/api/agent/onboarding': handleOnboardingRequest,
  '/api/agent/groups': handleGroupsRequest,
  '/api/agent/groups/propose': handleGroupProposalRequest,
  '/api/agent/sessions/child': handleChildSessionRequest,
  '/api/agent/results': handleResultsRequest,
  '/api/agent/results-image': handleResultsImageRequest,
  '/api/agent/result-view-cache': handleResultViewCacheRequest,
  '/api/agent/geo-backlink': handleGeoBacklinkRequest,
  '/api/agent/agent-only/statements': handleAgentOnlyStatementsRequest,
  '/api/agent/agent-only/answers/bulk': handleAgentOnlyAnswersBulkRequest,
  '/api/agent/agent-only/token-votes/bulk': handleAgentOnlyTokenVotesBulkRequest,
  '/api/agent/agent-only/wrapped-image': handleAgentOnlyWrappedImageRequest,
  '/api/agent/admin/status': handleAdminStatusRequest,
  '/api/agent/admin/metrics': handleAdminMetricsRequest,
  '/api/agent/admin/questions/delete': handleAdminQuestionsDeleteRequest,
  '/api/agent/admin/skill-update': handleAdminSkillUpdateRequest,
  '/api/agent/admin/agent-only/config': handleAdminAgentOnlyConfigRequest,
  '/api/agent/admin/agent-only/export': handleAdminAgentOnlyExportRequest,
};
// Authorization and method validation are complete at the Session Worker
// boundary. Domain handlers receive only its immutable session/caller context.
export async function handleAgentHttpRequest({ request, env, body = {}, context, input, route, waitUntil, fetchImpl }) {
  if (route.path === '/api/agent/skill') return skillRedirectResponse(env);
  if (route.path === '/api/agent/skill-version') return json(await skillVersionPayloadWithFlag(env));
  if (route.path === '/api/agent/session-wrapped/skill') return sessionWrappedSkillRedirectResponse(env);
  if (route.path === '/api/agent/session-wrapped/skill-version') return json(sessionWrappedSkillVersionPayload(env));
  if (route.path.endsWith('/view/:id')) {
    let imageViewId;
    try { imageViewId = decodeURIComponent(new URL(request.url).pathname.split('/').pop()); } catch { return json({ ok: false, reason: 'image_not_found' }, { status: 404 }); }
    return handleAgentOnlyWrappedImageViewRequest({ env, imageViewId, method: request.method });
  }
  return handlers[route.path]({ request, env, body, context, input, method: request.method, waitUntil, fetchImpl });
}
