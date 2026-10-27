import { safeString, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { AGENT_EVENT_TYPES } from './constants.mjs';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import { resolveAgentHttpSessionInvocation } from './sessionPolicy.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { AGENT_CREDENTIAL_KINDS, createOpaqueAgentPrincipalId, issueAgentCredential, AGENT_CREDENTIAL_DEFAULT_TTL_SECONDS, AGENT_CREDENTIAL_SCOPES } from './agentCredentials.mjs';
import { json, readRequestJson } from './httpInput.mjs';


export async function handleServiceCredentialBootstrapRequest({ request, env = {}, createdAt = null } = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, { status: 405 });
  }
  if (env.AGENT_CONTEXT?.auth?.authMode !== 'session_admin') return json({ ok: false, reason: 'session_admin_required' }, { status: 403 });
  const body = await readRequestJson(request);
  const label = safeString(body.name || body.label).slice(0, 120);
  const sessionSlug = sanitizeSessionSlug(body.sessionSlug);
  const requestedScopes = Array.isArray(body.scopes)
    ? body.scopes.map((scope) => safeString(scope)).filter(Boolean)
    : [];
  const allowedScopes = new Set(Object.values(AGENT_CREDENTIAL_SCOPES));
  if (!label) return json({ ok: false, reason: 'service_name_required' }, { status: 400 });
  if (!sessionSlug) return json({ ok: false, reason: 'session_required' }, { status: 400 });
  if (!requestedScopes.length || requestedScopes.some((scope) => !allowedScopes.has(scope))) {
    return json({ ok: false, reason: 'service_scopes_invalid' }, { status: 400 });
  }
  const policy = await loadSessionPolicy(env);
  const resolved = resolveAgentHttpSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return json(
      {
        ok: false,
        reason: resolved.reason || 'session_not_found',
        sessionSlug,
      },
      { status: 404 },
    );
  }
  const principal = {
    principalId: createOpaqueAgentPrincipalId(AGENT_CREDENTIAL_KINDS.SERVICE),
    kind: AGENT_CREDENTIAL_KINDS.SERVICE,
    adapter: 'bootstrap',
    label,
  };
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_CONTEXT.sessionId,
    rootSecret: env.AGENT_MANAGED_ROOT_SECRET || '',
    lifecycle: AGENT_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt,
  });
  const issued = await issueAgentCredential({
    env,
    principal,
    sessionSlug: resolved.session.sessionSlug,
    accountAddress: account.accountAddress,
    scopes: requestedScopes,
    credentialKind: AGENT_CREDENTIAL_KINDS.SERVICE,
    ttlSeconds: AGENT_CREDENTIAL_DEFAULT_TTL_SECONDS,
    createdAt,
  });
  if (!issued.ok) {
    return json(
      {
        ok: false,
        reason: issued.reason || 'service_credential_create_failed',
      },
      {
        status: issued.reason === 'agent_token_storage_unavailable' ? 503 : 500,
      },
    );
  }
  const response = {
    ok: true,
    token: issued.token,
    principal: issued.record.principal,
    sessionSlug: issued.record.sessionSlug,
    scopes: issued.record.scopes,
    expiresAt: issued.record.expiresAt,
    accountAddress: account.accountAddress,
  };
  const { token: _token, ...secretFree } = response;
  assertNoSecretShape(secretFree, 'Service credential bootstrap metadata must not serialize bearer secrets.');
  return json(response);
}
