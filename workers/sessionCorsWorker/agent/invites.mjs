import { safeString, timingSafeEqualString, lower, sanitizeSessionSlug, sha256Hex } from './runtimePrimitives.mjs';
import { AGENT_EVENT_TYPES } from './constants.mjs';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import { resolveAgentHttpSessionInvocation } from './sessionPolicy.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { finalizeAgentInviteRedemption, releaseAgentInviteRedemption, reserveAgentInviteRedemption } from './agentInviteRedemptionCoordinator.mjs';
import { AGENT_CREDENTIAL_KINDS, createOpaqueAgentPrincipalId, issueAgentCredential, revokeAgentCredentialHash, AGENT_CREDENTIAL_DEFAULT_TTL_SECONDS, AGENT_CREDENTIAL_SCOPES } from './agentCredentials.mjs';
import { AGENT_ONLY_ENDPOINTS, agentOnlyTokenTtlSeconds } from './agentOnlyMode.mjs';
import { sessionAgentOrigin, json, readRequestJson, toCanonicalAgentApiPathname } from './httpInput.mjs';
import { agentSkillUrl, sessionWrappedSkillUrl } from './discovery.mjs';

export function isSessionWrappedOnboardingRequest(body = {}) {
  const labels = [
    body.skill,
    body.flow,
    body.modeLabel,
    body.source,
    body.contextEngine?.skill,
    body.contextEngine?.flow,
    body.contextEngine?.source,
  ].map((value) => lower(value));
  return labels.some(
    (label) =>
      label === 'ce-session-wrapped' ||
      label === 'session-wrapped' ||
      label === 'session_wrapped' ||
      label.includes('session-wrapped'),
  );
}

export function trustedOnboardingInviteRecords(env = {}) {
  const ctx = env.AGENT_CONTEXT;
  const configured = ctx.config.agentHttp?.invites;
  return (Array.isArray(configured) ? configured : []).filter(record => record && /^[a-f0-9]{64}$/.test(record.tokenHash || '') && record.enabled !== false)
    .map(record => ({ tokenHash: record.tokenHash, sessionSlug: ctx.slug, label: safeString(record.label).slice(0, 120), source: safeString(record.source).slice(0, 160) }));
}

export async function resolveTrustedOnboardingInvite(env = {}, inviteToken = '') {
  const supplied = safeString(inviteToken);
  if (!supplied) return { ok: false, status: 400, reason: 'invite_token_required' };
  const records = trustedOnboardingInviteRecords(env);
  if (!records.length)
    return {
      ok: false,
      status: 503,
      reason: 'invite_onboarding_not_configured',
    };
  const suppliedHash = await sha256Hex(supplied);
  for (const record of records) {
    const recordHash = /^[0-9a-f]{64}$/.test(safeString(record.tokenHash))
      ? safeString(record.tokenHash).toLowerCase()
      : record.token
        ? await sha256Hex(record.token)
        : '';
    if (recordHash && timingSafeEqualString(recordHash, suppliedHash)) {
      return {
        ok: true,
        tokenHash: suppliedHash,
        invite: {
          sessionSlug: sanitizeSessionSlug(record.sessionSlug),
          label: safeString(record.label),
          source: safeString(record.source),
        },
      };
    }
  }
  return { ok: false, status: 401, reason: 'invite_token_invalid' };
}

export async function handleInviteOnboardRequest({ request, env = {}, createdAt = null } = {}) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }
  if (request.method !== 'POST') {
    const payload = { ok: false, reason: 'method_not_allowed' };
    assertNoSecretShape(payload, 'Agent invite onboarding method response must not serialize secrets.');
    return json(payload, { status: 405 });
  }

  const body = await readRequestJson(request);
  const inviteToken = safeString(
    body.inviteToken || body.contextEngineInviteToken || body.contextEngine?.inviteToken || body.invite || body.token,
  );
  const invite = await resolveTrustedOnboardingInvite(env, inviteToken);
  if (!invite.ok) {
    const payload = { ok: false, reason: invite.reason };
    assertNoSecretShape(payload, 'Agent invite onboarding denial must not serialize secrets.');
    return json(payload, { status: invite.status || 401 });
  }
  const policy = await loadSessionPolicy(env);
  const requestedSessionSlug = sanitizeSessionSlug(body.sessionSlug || body.defaultSessionSlug || body.slug);
  const invitedSessionSlug = sanitizeSessionSlug(invite.invite.sessionSlug);
  if (invitedSessionSlug && requestedSessionSlug && invitedSessionSlug !== requestedSessionSlug) {
    return json(
      {
        ok: false,
        reason: 'invite_session_mismatch',
        sessionSlug: invitedSessionSlug,
      },
      { status: 403 },
    );
  }
  if (!requestedSessionSlug) return json({ ok: false, reason: 'session_required' }, { status: 400 });
  const explicitSessionSlug = requestedSessionSlug;
  const principal = {
        principalId: createOpaqueAgentPrincipalId(AGENT_CREDENTIAL_KINDS.USER),
        kind: AGENT_CREDENTIAL_KINDS.USER,
        adapter: 'invite',
        label: safeString(body.label || body.name || invite.invite.label).slice(0, 120),
  };
  const resolved = resolveAgentHttpSessionInvocation(policy, explicitSessionSlug || policy.defaultSessionSlug);
  if (!resolved.ok) {
    const payload = {
      ok: false,
      reason: resolved.reason || 'session_not_found',
      sessionSlug: resolved.sessionSlug || explicitSessionSlug || '',
    };
    assertNoSecretShape(payload, 'Agent invite onboarding session response must not serialize secrets.');
    return json(payload, { status: 404 });
  }

  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_CONTEXT.sessionId,
    rootSecret: env.AGENT_MANAGED_ROOT_SECRET || '',
    lifecycle: AGENT_EVENT_TYPES.ACCOUNT_RECOVERED,
    createdAt,
  });
  const onboardingMode = lower(body.mode || body.onboardingMode);
  const agentOnly = onboardingMode === 'agent_only';
  const reservationId = globalThis.crypto.randomUUID();
  const reservation = await reserveAgentInviteRedemption({
    env,
    tokenHash: invite.tokenHash,
    body: {
      reservationId,
      createdAt,
    },
  });
  if (!reservation.ok) {
    return json(
      { ok: false, reason: reservation.reason || 'invite_reservation_failed' },
      { status: reservation.status || 503 },
    );
  }
  const issued = await issueAgentCredential({
    env,
    principal,
    sessionSlug: resolved.session.sessionSlug,
    accountAddress: account.accountAddress,
    scopes: agentOnly ? [AGENT_CREDENTIAL_SCOPES.AGENT_AUTOFILL] : undefined,
    credentialKind: agentOnly ? AGENT_CREDENTIAL_KINDS.AGENT_ONLY : AGENT_CREDENTIAL_KINDS.USER,
    ttlSeconds: agentOnly ? agentOnlyTokenTtlSeconds(env) : AGENT_CREDENTIAL_DEFAULT_TTL_SECONDS,
    createdAt,
  });
  if (!issued.ok) {
    // A failed storage acknowledgement can still leave a live credential.
    if (!issued.credentialMayExist) {
      await releaseAgentInviteRedemption({
        env,
        tokenHash: invite.tokenHash,
        body: { reservationId },
      });
    }
    const payload = {
      ok: false,
      reason: issued.reason || 'agent_token_create_failed',
    };
    assertNoSecretShape(payload, 'Agent invite onboarding token failure must not serialize secrets.');
    return json(payload, {
      status: issued.reason === 'agent_token_storage_unavailable' ? 503 : 500,
    });
  }
  const consumed = await finalizeAgentInviteRedemption({
    env,
    tokenHash: invite.tokenHash,
    body: {
      reservationId,
      principalId: safeString(issued.record?.principal?.principalId),
      sessionSlug: sanitizeSessionSlug(issued.record?.sessionSlug),
      credentialHash: safeString(issued.tokenHash),
      createdAt,
    },
  });
  if (!consumed.ok) {
    // Keep the reservation even when best-effort revocation reports success:
    // eventual/failed storage writes cannot prove this invite is safe to reuse.
    await revokeAgentCredentialHash({ env, tokenHash: issued.tokenHash });
    return json(
      { ok: false, reason: consumed.reason || 'invite_redemption_finalize_failed' },
      { status: consumed.status || 503 },
    );
  }

  const wrappedOnboarding = agentOnly && isSessionWrappedOnboardingRequest(body);
  const response = {
    ok: true,
    token: issued.token,
    worker: sessionAgentOrigin(env),
    skill: wrappedOnboarding ? 'ce-session-wrapped' : 'context-engine',
    skillUrl: wrappedOnboarding ? sessionWrappedSkillUrl(env) : agentSkillUrl(env),
    sessionSlug: resolved.session.sessionSlug,
    expiresAt: issued.record.expiresAt,
    principal: issued.record.principal,
    accountAddress: account.accountAddress,
    inviteLabel: invite.invite.label || '',
    inviteSource: safeString(body.source || invite.invite.source).slice(0, 160),
    ...(agentOnly
      ? {
          mode: 'agent_only',
          start: `${sessionAgentOrigin(env)}${toCanonicalAgentApiPathname(AGENT_ONLY_ENDPOINTS.start)}?sessionSlug=${encodeURIComponent(env.AGENT_CONTEXT.slug)}`,
        }
      : {}),
  };

  const { token: _token, ...secretFree } = response;
  assertNoSecretShape(secretFree, 'Agent invite onboarding token response metadata must not serialize secrets.');
  return json(response);
}
