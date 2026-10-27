import { safeString, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { AGENT_CREDENTIAL_SCOPES, agentCredentialHasScope } from './agentCredentials.mjs';
import { AGENT_ONLY_ENDPOINTS } from './agentOnlyMode.mjs';
import { normalizeAgentRequestContext } from './httpInput.mjs';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';


export function extractAgentToken(value = '') {
  const raw = safeString(value).replace(/^Bearer\s+/i, '');
  return /^ceagt_[A-Za-z0-9_-]{16,}$/.test(raw) ? raw : '';
}
export function suppliedAgentToken(request) {
  return extractAgentToken(request.headers.get('authorization') || request.headers.get('x-ce-agent-token') || request.headers.get('x-context-engine-agent-token'));
}
export async function authenticateAgentHandoff(_request, env = {}) {
  return env.AGENT_CONTEXT?.auth || { ok: false, status: 401, reason: 'agent_credential_required' };
}


export function delegationScopeForRequest(pathname = '', method = 'GET') {
  const methodName = safeString(method).toUpperCase();
  if (pathname === '/api/agent/questions') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/tags') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/questions/next') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/actions') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (
    pathname === AGENT_ONLY_ENDPOINTS.statements ||
    pathname === AGENT_ONLY_ENDPOINTS.answersBulk ||
    pathname === AGENT_ONLY_ENDPOINTS.tokenVotesBulk ||
    pathname === AGENT_ONLY_ENDPOINTS.wrappedImage
  ) {
    return AGENT_CREDENTIAL_SCOPES.AGENT_AUTOFILL;
  }
  if (pathname === '/api/agent/results') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/results-image') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/result-view-cache') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/geo-backlink') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/admin/status') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/admin/metrics') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (
    pathname === '/api/agent/admin/agent-only/config' ||
    pathname === '/api/agent/admin/agent-only/export'
  ) {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/admin/questions/delete') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/admin/default-session') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/admin/skill-update') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/onboarding') {
    return methodName === 'POST'
      ? AGENT_CREDENTIAL_SCOPES.DRAFT_ANSWERS
      : AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/question-queue/plan') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/question-queue/apply') {
    return AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/api/agent/question-votes/recommend') {
    return AGENT_CREDENTIAL_SCOPES.RECOMMEND_QUESTION_VOTES;
  }
  if (pathname === '/api/agent/question-votes/apply') {
    return AGENT_CREDENTIAL_SCOPES.APPLY_QUESTION_VOTES;
  }
  if (pathname === '/api/agent/preferences') {
    return AGENT_CREDENTIAL_SCOPES.DRAFT_ANSWERS;
  }
  if (pathname === '/api/agent/groups' && methodName === 'GET') {
    return AGENT_CREDENTIAL_SCOPES.READ_GROUPS;
  }
  if (pathname === '/api/agent/groups/propose') {
    return AGENT_CREDENTIAL_SCOPES.PROPOSE_GROUPS;
  }
  if (pathname === '/api/agent/questions/create') {
    return AGENT_CREDENTIAL_SCOPES.POSE_QUESTIONS;
  }
  return '';
}


export function applyDelegationToInput(auth = {}, input = {}, pathname = '', method = 'GET') {
  const record = auth.delegation;
  if (record) {
    const scope = delegationScopeForRequest(pathname, method);
    if (!scope || !agentCredentialHasScope(record, scope)) return { ok: false, status: 403, reason: 'agent_token_scope_denied', requiredScope: scope };
    if (input.sessionSlug && sanitizeSessionSlug(input.sessionSlug) !== record.sessionSlug) return { ok: false, status: 403, reason: 'agent_token_session_mismatch' };
  }
  const principal = record?.principal || auth.principal;
  if (!principal?.principalId) return { ok: false, status: 401, reason: 'agent_principal_required' };
  return { ok: true, input: { ...input, principalId: principal.principalId, principalAdapter: principal.adapter,
    telegramUserId: '', userId: '', groupChatId: '', chatId: '', telegram: {}, adapterMetadata: {},
    username: principal.label || '', accountAddress: record?.accountAddress || auth.address,
    sessionSlug: record?.sessionSlug || auth.slug } };
}

export async function resolveHandoffContext({ env, auth = env.AGENT_CONTEXT.auth, input = {} }) {
  const policy = await loadSessionPolicy(env);
  const session = policy.linkedSessions.find(session => session.sessionSlug === env.AGENT_CONTEXT.slug);
  if (!session) return { ok: false, status: 404, reason: 'session_not_found' };
  const principal = auth.delegation?.principal || auth.principal;
  if (!principal?.principalId) return { ok: false, status: 401, reason: 'agent_principal_required' };
  const principalId = principal.principalId;
  return { ok: true, policy, session, principal, principalId, storageSubjectId: principalId,
    adapterMetadata: {}, storageContext: normalizeAgentRequestContext({ telegramUserId: principalId, username: principal.label }),
    groupBinding: null, privateBinding: null, permission: { ok: true, mode: 'session_policy' },
    delegation: auth.delegation || null, authMode: auth.authMode, scopes: env.AGENT_CONTEXT.scopes };
}
