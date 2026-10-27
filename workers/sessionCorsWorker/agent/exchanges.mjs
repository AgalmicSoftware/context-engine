import { AGENT_BROWSER_CREDENTIAL_TTL_SECONDS, AGENT_CREDENTIAL_AUDIENCES, AGENT_CREDENTIAL_KINDS, AGENT_MEMBER_CREDENTIAL_MAX_TTL_SECONDS, issueAgentCredential, revokeAgentCredentialHash } from './agentCredentials.mjs';
import { loadAgentLightweightGroups } from './agentGroups.mjs';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';
import { sha256Hex } from './runtimePrimitives.mjs';
import { json } from './httpInput.mjs';

export async function handleClientLoginExchangeRequest({ env }) {
  const ctx = env.AGENT_CONTEXT;
  const source = ctx.auth.delegation;
  if (!['user', 'service'].includes(source?.credentialKind) || source.audience !== AGENT_CREDENTIAL_AUDIENCES.SESSION_AGENT ||
      source.scopes.includes('agent_autofill')) return json({ ok: false, reason: 'agent_credential_exchange_denied' }, { status: 403 });
  if (source.credentialKind === 'service' && !source.scopes.includes('session_login')) {
    return json({ ok: false, reason: 'agent_credential_session_login_denied' }, { status: 403 });
  }
  const remaining = Math.floor((Date.parse(source.expiresAt) - ctx.now()) / 1000);
  if (remaining <= 0) return json({ ok: false, reason: 'agent_token_expired' }, { status: 401 });
  const login = await env.AGENT_SERVICES.login({ source });
  const issued = await issueAgentCredential({ env, principal: source.principal, sessionSlug: ctx.slug,
    accountAddress: source.accountAddress, scopes: source.scopes, audience: AGENT_CREDENTIAL_AUDIENCES.SESSION_AGENT_BROWSER,
    credentialKind: AGENT_CREDENTIAL_KINDS.BROWSER, sourceCredentialHash: source.tokenHash,
    createdAt: new Date(ctx.now()).toISOString(), ttlSeconds: Math.min(AGENT_BROWSER_CREDENTIAL_TTL_SECONDS, remaining) });
  if (!issued.ok) {
    await env.AGENT_SERVICES.revokeLogin(login.payload);
    return json({ ok: false, reason: issued.reason }, { status: 503 });
  }
  const policy = await loadSessionPolicy(env);
  const session = policy.linkedSessions[0];
  const groups = await loadAgentLightweightGroups({ env, session, telegramUserId: source.principal.principalId, accountAddress: source.accountAddress });
  const has = scope => source.scopes.includes(scope);
  return json({ ok: true, sessionSlug: ctx.slug, sessionId: ctx.sessionId, accountAddress: source.accountAddress,
    workerUrl: ctx.origin,
    agentCredential: { kind: 'session_agent_browser_token', token: issued.token, expiresAt: issued.record.expiresAt },
    workerCredential: { kind: 'session_worker_jwt', token: login.token, expiresAt: new Date(login.exp * 1000).toISOString() },
    expiresAt: issued.record.expiresAt,
    capabilities: { readQuestions: has('read_questions'), draftAnswers: has('draft_answers'),
      submitAnswers: has('draft_answers') && session.managedAccountSubmitAllowed && !!(ctx.scopes.storage || ctx.scopes.arweave),
      voteQuestions: has('apply_question_votes'), poseQuestions: has('pose_questions'), readResults: has('read_questions'),
      readGroups: has('read_groups'), admin: false, export: false }, buckets: groups,
  });
}

export async function handleWrappedMemberExchangeRequest({ env }) {
  const ctx = env.AGENT_CONTEXT;
  const payload = ctx.auth.payload;
  const kv = env.AGENT_ACTION_KV;
  if (!kv) return json({ ok: false, reason: 'agent_token_storage_unavailable' }, { status: 503 });
  const replayKey = `agent:member-exchange:v2:${await sha256Hex(`${ctx.sessionId}:${payload.sub.toLowerCase()}:${payload.jti}`)}`;
  if (await kv.get(replayKey)) return json({ ok: false, reason: 'session_worker_credential_replayed' }, { status: 409 });
  const remaining = payload.exp - Math.floor(ctx.now() / 1000);
  const ttlSeconds = Math.min(AGENT_MEMBER_CREDENTIAL_MAX_TTL_SECONDS, remaining);
  if (ttlSeconds <= 0) return json({ ok: false, reason: 'session_worker_credential_expired' }, { status: 401 });
  const principal = { principalId: `session-member:${payload.sub.toLowerCase()}`, kind: 'user', adapter: 'session_worker', label: 'Session member' };
  const issued = await issueAgentCredential({ env, principal, sessionSlug: ctx.slug,
    accountAddress: payload.sub, scopes: ['agent_autofill'], credentialKind: AGENT_CREDENTIAL_KINDS.MEMBER,
    sourceParticipant: payload, ttlSeconds, createdAt: new Date(ctx.now()).toISOString() });
  if (!issued.ok) return json({ ok: false, reason: issued.reason }, { status: 503 });
  try { await kv.put(replayKey, JSON.stringify({ sourceJti: payload.jti, credentialHash: issued.tokenHash }), { expirationTtl: Math.max(60, remaining) }); }
  catch {
    await revokeAgentCredentialHash({ env, tokenHash: issued.tokenHash });
    return json({ ok: false, reason: 'member_exchange_persistence_failed' }, { status: 503 });
  }
  return json({ ok: true, token: issued.token, sessionSlug: ctx.slug, sessionId: ctx.sessionId,
    sessionWorkerOrigin: ctx.origin, principal, accountAddress: payload.sub, scopes: issued.record.scopes,
    audience: issued.record.audience, expiresAt: issued.record.expiresAt,
    workerCredentialExpiresAt: new Date(payload.exp * 1000).toISOString(), revocationBoundSeconds: ttlSeconds });
}
