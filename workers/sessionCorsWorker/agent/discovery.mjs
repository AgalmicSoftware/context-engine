
import { readAgentSkillUpdateFlag } from './agentSessionRuntime.mjs';


import { assertNoSecretShape } from './redaction.mjs';
import { AGENT_ONLY_ENDPOINTS } from './agentOnlyMode.mjs';

import { CE_AGENT_ACCESS_SKILL_VERSION, CE_SESSION_WRAPPED_SKILL_VERSION, DEFAULT_AGENT_RAW_SKILL_URL, DEFAULT_SESSION_WRAPPED_RAW_SKILL_URL } from './httpConstants.mjs';
import { toCanonicalAgentApiPathname } from './httpInput.mjs';
import { jsonSessionMeta } from './cors.mjs';

export function agentSkillUrl(env) { return new URL(`/api/agent/skill?sessionSlug=${encodeURIComponent(env.AGENT_CONTEXT.slug)}`, env.AGENT_CONTEXT.origin).href; }
export function sessionWrappedSkillUrl(env) { return new URL(`/api/agent/session-wrapped/skill?sessionSlug=${encodeURIComponent(env.AGENT_CONTEXT.slug)}`, env.AGENT_CONTEXT.origin).href; }

export function skillVersionPayload(env = {}) {
  const skillUrl = agentSkillUrl(env);
  return {
    ok: true,
    version: CE_AGENT_ACCESS_SKILL_VERSION,
    skill: 'context-engine',
    skillUrl,
  };
}

export async function skillVersionPayloadWithFlag(env = {}) {
  const base = skillVersionPayload(env);
  const flag = await readAgentSkillUpdateFlag(env);
  const payload = {
    ...base,
    updateAvailable: flag.updateAvailable === true,
    latestVersion: flag.latestVersion || base.version,
    updateNote: flag.note || '',
  };
  assertNoSecretShape(payload, "Agent skill-version response must not serialize secrets.");
  return payload;
}

export function sessionWrappedSkillVersionPayload(env = {}) {
  const payload = {
    ok: true,
    version: CE_SESSION_WRAPPED_SKILL_VERSION,
    protocolVersion: CE_AGENT_ACCESS_SKILL_VERSION,
    skill: 'ce-session-wrapped',
    skillUrl: sessionWrappedSkillUrl(env),
    workerSkillVersionEndpoint: '/api/agent/skill-version',
    startEndpoint: toCanonicalAgentApiPathname(AGENT_ONLY_ENDPOINTS.start),
    wrappedImageEndpoint: toCanonicalAgentApiPathname(AGENT_ONLY_ENDPOINTS.wrappedImage),
  };
  assertNoSecretShape(payload, 'Session Wrapped skill-version response must not serialize secrets.');
  return payload;
}

export function skillRedirectResponse() {
  const redirectUrl = new URL(DEFAULT_AGENT_RAW_SKILL_URL);
  redirectUrl.searchParams.set('v', CE_AGENT_ACCESS_SKILL_VERSION.replace(/[^0-9A-Za-z_-]+/g, '-'));
  return Response.redirect(redirectUrl.toString(), 302);
}

export function sessionWrappedSkillRedirectResponse() {
  const redirectUrl = new URL(DEFAULT_SESSION_WRAPPED_RAW_SKILL_URL);
  redirectUrl.searchParams.set('v', CE_SESSION_WRAPPED_SKILL_VERSION.replace(/[^0-9A-Za-z_-]+/g, '-'));
  return Response.redirect(redirectUrl.toString(), 302);
}

export async function resolveSessionMetaPayload(env, sessionSlug) {
  const ctx = env.AGENT_CONTEXT;
  if (sessionSlug !== ctx.slug) return { ok: false, reason: 'session_not_found' };
  const enabled = ctx.config.sessionModeProfile?.surfaces?.agentHttp === true;
  return { ok: true, sessionSlug: ctx.slug, sessionId: ctx.sessionId, revision: ctx.revision,
    agentHttpEnabled: enabled, authorityMode: ctx.config.sessionModeProfile?.authority?.mode,
    workerUrl: ctx.origin, clientSubmitReady: enabled && ctx.config.agentHttp?.managedAccountSubmitAllowed === true };
}
export async function handleSessionMetaHttpRequest({ request, env }) {
  return jsonSessionMeta(request, env, await resolveSessionMetaPayload(env, env.AGENT_CONTEXT.slug));
}
