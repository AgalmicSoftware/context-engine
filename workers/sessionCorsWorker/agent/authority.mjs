import { readCurrentSessionConfig } from '../sessionConfigAuthority.js';
import { resolveCanonicalWorkerSessionIdHex } from '../sessionConfigMutation.js';
import { readAuthorizationEpoch } from '../authorizationScopeFreshness.js';
import { validateAuthTokenRecord } from '../authTokenClaims.js';
import { createAgentStorage } from './storage.mjs';
import { loadAgentCredentialHash, AGENT_CREDENTIAL_AUDIENCES, AGENT_CREDENTIAL_KINDS } from './agentCredentials.mjs';

export const agentHttpEnabled = (config) => config?.sessionModeProfile?.surfaces?.agentHttp === true;
export const authorityError = (reason, status = 403) => Object.assign(new Error(reason), { status, reason });

export const createAgentEnvironment = ({ env, config, revision, slug, origin, now = Date.now, fetchImpl = globalThis.fetch, persistenceOnly = false }) => {
  const sessionId = resolveCanonicalWorkerSessionIdHex(config);
  const authzEpoch = readAuthorizationEpoch(config);
  if (!sessionId || authzEpoch === null) throw authorityError('agent_session_identity_invalid', 503);
  const context = { config, revision, slug, origin, sessionId, authzEpoch, now };
  // Only this adapter can see the underlying binding. No caller-chosen key or
  // cursor can escape the immutable session prefix, even on a multi-session Worker.
  const agentEnv = {
    AGENT_CONTEXT: context,
    AGENT_FETCH: fetchImpl,
    QUESTION_FETCH: fetchImpl,
    REGISTRY_FETCH: fetchImpl,
    DEFAULT_RPC_URL: env.DEFAULT_RPC_URL,
    ADDITIONAL_RPC_URL: env.ADDITIONAL_RPC_URL,
    DEFAULT_CHAIN_ID: config.networkChainId,
    SESSION_REGISTRY_ADDRESS: config.contracts?.sessionRegistry?.address || env.SESSION_REGISTRY_ADDRESS,
    AGENT_ACTION_KV: createAgentStorage({ kv: env.GROUP_KV, sessionId, cursorSecret: env.TOKEN_HMAC_SECRET, beforeWrite: persistenceOnly ? undefined : () => agentEnv.AGENT_SERVICES?.current() }),
    AGENT_MANAGED_ROOT_SECRET: env.AGENT_MANAGED_ROOT_SECRET,
    AGENT_RESPONSE_QUEUE: env.AGENT_RESPONSE_QUEUE,
    AGENT_DIRECT_SUBMIT_ENABLED: env.AGENT_DIRECT_SUBMIT_ENABLED,
    AGENT_POSTER_API_KEY: env.AGENT_POSTER_API_KEY,
  };
  return agentEnv;
};

export const validateCredentialAuthority = async ({ env, record, validateSourceJwt, depth = 0 }) => {
  const ctx = env.AGENT_CONTEXT;
  if (!ctx || !agentHttpEnabled(ctx.config)) throw authorityError('agent_http_disabled');
  if (record.sessionId !== ctx.sessionId || record.sessionSlug !== ctx.slug ||
      record.sessionWorkerOrigin !== ctx.origin || record.authzEpoch !== ctx.authzEpoch) {
    throw authorityError('agent_credential_authority_stale', 401);
  }
  if (!Object.values(AGENT_CREDENTIAL_KINDS).includes(record.credentialKind) ||
      !Object.values(AGENT_CREDENTIAL_AUDIENCES).includes(record.audience) ||
      (record.credentialKind === 'browser') !== (record.audience === AGENT_CREDENTIAL_AUDIENCES.SESSION_AGENT_BROWSER)) {
    throw authorityError('agent_credential_purpose_invalid', 401);
  }
  if (record.credentialKind === 'browser' && !record.sourceCredentialHash ||
      record.credentialKind === 'member' && !record.sourceParticipant) throw authorityError('agent_credential_source_missing', 401);
  if (record.sourceCredentialHash) {
    if (depth > 0) throw authorityError('agent_credential_source_invalid', 401);
    const source = await loadAgentCredentialHash({ env, tokenHash: record.sourceCredentialHash, now: new Date(ctx.now()).toISOString() });
    if (!source.ok) throw authorityError('agent_credential_source_inactive', 401);
    await validateCredentialAuthority({ env, record: source.record, validateSourceJwt, depth: depth + 1 });
    if (source.record.principal.principalId !== record.principal.principalId ||
        source.record.accountAddress.toLowerCase() !== record.accountAddress.toLowerCase() ||
        record.scopes.some(scope => !source.record.scopes.includes(scope)) ||
        Date.parse(record.expiresAt) > Date.parse(source.record.expiresAt)) throw authorityError('agent_credential_source_invalid', 401);
  }
  if (record.sourceParticipant) {
    if (!validateSourceJwt) throw authorityError('agent_credential_source_unavailable', 503);
    await validateSourceJwt(record.sourceParticipant);
  }
};

// Called by the ordinary participant auth path as well as agent endpoints. A
// derived JWT cannot outlive rotation, revocation, disablement or gate changes.
export const validateAgentParticipantSource = async ({ request, env, payload, slug, deps = {} }) => {
  if (!payload?.agentSource) return { ok: true };
  try {
    const { config, revision } = await (deps.readCurrentSessionConfig || readCurrentSessionConfig)({ env, slug });
    const agentEnv = createAgentEnvironment({ env, config, revision, slug, origin: new URL(request.url).origin, now: deps.now });
    const source = await loadAgentCredentialHash({ env: agentEnv, tokenHash: payload.agentSource, now: new Date(agentEnv.AGENT_CONTEXT.now()).toISOString() });
    if (!source.ok) throw authorityError('agent_credential_source_inactive', 401);
    await validateCredentialAuthority({ env: agentEnv, record: source.record });
    if (payload.sessionId !== agentEnv.AGENT_CONTEXT.sessionId || payload.authzEpoch !== agentEnv.AGENT_CONTEXT.authzEpoch ||
        payload.sub.toLowerCase() !== source.record.accountAddress.toLowerCase() ||
        payload.exp * 1000 > Date.parse(source.record.expiresAt) ||
        !['user', 'service'].includes(source.record.credentialKind) ||
        source.record.scopes.includes('agent_autofill') ||
        source.record.credentialKind === 'service' && !source.record.scopes.includes('session_login')) throw authorityError('agent_credential_source_invalid', 401);
    if (!deps.computeScopesForLogin) throw authorityError('agent_authority_unavailable', 503);
    await deps.computeScopesForLogin({ env, slug, config, address: payload.sub });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.reason || 'Agent source authority unavailable.', status: error.status || 403 };
  }
};

export const validateMemberSource = async ({ env, context, payload, deps }) => {
  if (!payload || payload.slug !== context.slug || payload.sessionId !== context.sessionId ||
      payload.authzEpoch !== context.authzEpoch || !Number.isSafeInteger(payload.exp) || payload.exp * 1000 <= context.now()) {
    throw authorityError('agent_member_source_stale', 401);
  }
  const record = await validateAuthTokenRecord({ env, payload, slug: context.slug });
  if (!record.ok) throw authorityError('agent_member_source_revoked', 401);
  const source = await validateAgentParticipantSource({ request: new Request(context.origin), env, payload, slug: context.slug, deps });
  if (!source.ok) throw authorityError('agent_member_source_revoked', 401);
  try { await deps.computeScopesForLogin({ env, slug: context.slug, config: context.config, address: payload.sub }); }
  catch { throw authorityError('agent_membership_denied', 403); }
};
