import { readCurrentSessionConfig, callSessionConfigCoordinator } from '../sessionConfigAuthority.js';
import { resolveCanonicalWorkerSessionIdHex } from '../sessionConfigMutation.js';
import { readAuthorizationEpoch } from '../authorizationScopeFreshness.js';
import { buildAuthTokenJti, persistAuthTokenRecord, revokeAuthTokenRecord } from '../authTokenClaims.js';
import { signToken } from '../tokenSigning.js';
import { executeCoordinatedSessionConfigMutation } from '../sessionWriteCoordinator.js';
import { readCoordinatedWorkerGroupMemberships } from '../workerGroups.js';
import { resolveSessionAiModel } from '../aiRequestPolicy.js';
import { authorityError, agentHttpEnabled, validateCredentialAuthority, validateMemberSource } from './authority.mjs';
import { proxyOpenAI, proxyAnthropic, proxyOpenRouter } from '../aiProviderExecution.js';
import { boundedAgentFetch } from './transport.mjs';
import { createAgentPagination } from './pagination.mjs';
import { loadAgentCredentialHash } from './agentCredentials.mjs';
import { buildSessionEndedResponse } from '../../shared/sessionLifecycle.mjs';
import { evaluateAuthenticatedRoutePreflight } from '../authenticatedRoutePreflight.js';
import { createAgentStorage } from './storage.mjs';
import { persistRecoveryMessage, retainOutcomeForRecovery } from './agentSubmitQueue.mjs';

const activeAi = new Map();
export const createAgentServices = ({ env, agentEnv, deps }) => {
  const ctx = agentEnv.AGENT_CONTEXT;
  const expectedAuthority = () => ({ actor: ctx.address.toLowerCase(), revision: ctx.revision, authzEpoch: ctx.authzEpoch });
  const current = async () => {
    const next = await (deps.readCurrentSessionConfig || readCurrentSessionConfig)({ env, slug: ctx.slug });
    if (next.revision !== ctx.revision || resolveCanonicalWorkerSessionIdHex(next.config) !== ctx.sessionId ||
        readAuthorizationEpoch(next.config) !== ctx.authzEpoch || !agentHttpEnabled(next.config)) throw authorityError('agent_authority_changed', 409);
    if (ctx.auth?.delegation) {
      const loaded = await loadAgentCredentialHash({ env: agentEnv, tokenHash: ctx.auth.delegation.tokenHash, now: new Date(ctx.now()).toISOString() });
      if (!loaded.ok) throw authorityError('agent_credential_source_inactive', 401);
      await validateCredentialAuthority({ env: agentEnv, record: loaded.record,
        validateSourceJwt: payload => validateMemberSource({ env, context: ctx, payload, deps }) });
    }
    if (ctx.address) {
      try { ctx.scopes = await deps.computeScopesForLogin({ env, slug: ctx.slug, config: next.config, address: ctx.address }); }
      catch { throw authorityError('agent_membership_denied', 403); }
    }
    return next;
  };
  const admin = async () => {
    await current();
    const ok = !!ctx.address && await deps.validateAdmin({ env, slug: ctx.slug, address: ctx.address, config: ctx.config });
    return { ok: !!ok, accountAddress: ctx.address };
  };
  const submitJournal = async (operation, record) => {
    if (record.sessionId !== ctx.sessionId || record.sessionSlug !== ctx.slug || record.workerOrigin !== ctx.origin) throw authorityError('submit_outcome_identity_mismatch');
    const result = await callSessionConfigCoordinator({ env, slug: ctx.slug, path: `agent-submit/${operation}`, record,
      ...(['begin', 'claim'].includes(operation) ? { expectedAuthority: expectedAuthority() } : {}) });
    if (!result.ok) return { ok: false, retryable: true, reason: result.body?.reason || 'submit_coordinator_unavailable' };
    return result.body;
  };
  return Object.freeze({
    current,
    async commitWrappedResearch(record) {
      await current();
      const result = await callSessionConfigCoordinator({ env, slug: ctx.slug, path: 'agent-wrapped/commit',
        expectedAuthority: expectedAuthority(), record: { ...record, sessionId: ctx.sessionId, sessionSlug: ctx.slug } });
      return result.body || { ok: false, status: 503, reason: 'wrapped_coordinator_unavailable', retryable: true };
    },
    claimAnswerSubmission: record => submitJournal('claim', record),
    readSubmitRecord: record => submitJournal('read', record),
    async persistSubmitIntent(record) {
      await current();
      return submitJournal('begin', record);
    },
    recoverSubmitOutcome: record => submitJournal('finish', record),
    async persistSubmitOutcome(record) {
      if (record.sessionId !== ctx.sessionId || record.sessionSlug !== ctx.slug || record.workerOrigin !== ctx.origin ||
          record.accountAddress !== ctx.address || record.sourceCredentialHash !== ctx.auth?.delegation?.tokenHash) {
        throw authorityError('submit_outcome_identity_mismatch');
      }
      // An already-admitted effect must remain recoverable if authority changes
      // while it runs. This narrow path only stores outcomes for an existing intent.
      const persistenceEnv = { ...agentEnv, AGENT_ACTION_KV: createAgentStorage({ kv: env.GROUP_KV, sessionId: ctx.sessionId, cursorSecret: env.TOKEN_HMAC_SECRET }) };
      const result = record.submissionJournal === true ? await submitJournal('finish', record)
        : await persistRecoveryMessage({ env: persistenceEnv, body: { requestId: record.requestId, record }, requireExisting: true });
      return result.ok || result.replayed ? result : retainOutcomeForRecovery(persistenceEnv, record, new Error(result.reason));
    },
    paginate: createAgentPagination(env.TOKEN_HMAC_SECRET, ctx),
    admin,
    async login({ source }) {
      await current();
      const remaining = Math.floor((Date.parse(source.expiresAt) - ctx.now()) / 1000);
      const ttlSeconds = Math.min(4 * 60 * 60, remaining);
      if (ttlSeconds <= 0) throw authorityError('agent_token_expired', 401);
      const payload = { sub: source.accountAddress, slug: ctx.slug, sessionId: ctx.sessionId,
        authzEpoch: ctx.authzEpoch, scopes: ctx.scopes, exp: Math.floor(ctx.now() / 1000) + ttlSeconds,
        jti: buildAuthTokenJti(), agentSource: source.tokenHash };
      const token = await (deps.signToken || signToken)(payload, env.TOKEN_HMAC_SECRET);
      await persistAuthTokenRecord({ env, ...payload, ttlSeconds: Math.max(60, ttlSeconds) });
      return { token, payload, exp: payload.exp, accountAddress: payload.sub, sessionId: ctx.sessionId, workerUrl: ctx.origin };
    },
    revokeLogin: payload => revokeAuthTokenRecord({ env, ...payload }),
    async memberships() {
      await current();
      return readCoordinatedWorkerGroupMemberships({ env, slug: ctx.slug, sessionId: ctx.sessionId,
        principal: { kind: 'evm_address', address: ctx.address } });
    },
    async storage(path, { method = 'GET', body, headers = {} } = {}) {
      const { config } = await current();
      if (!ctx.address) throw authorityError('agent_credential_required', 401);
      const url = new URL(path, ctx.origin);
      if (url.origin !== ctx.origin || !['/storage/read', '/storage/list', '/storage/upload'].includes(url.pathname)) throw authorityError('agent_storage_route_denied');
      if (url.pathname === '/storage/upload' && method === 'POST') {
        // Same session-end, current-scope and rate-limit preflight as the
        // public participant upload route; agents get no extra write path.
        const json = (payload, status) => Response.json(payload, { status });
        if (buildSessionEndedResponse({ config, json, now: ctx.now })) throw authorityError('agent_session_ended', 410);
        const preflight = await evaluateAuthenticatedRoutePreflight({
          scopes: ctx.scopes, scope: ctx.scopes?.storage === true ? 'storage' : 'arweave', route: 'storage',
          config, env, slug: ctx.slug, address: ctx.address, limit: config.limits?.perWalletPerDay || 0,
          deps: { checkRateLimit: deps.checkRateLimit, computeScopesForLogin: deps.computeScopesForLogin, json },
        });
        if (!preflight?.ok) throw authorityError('agent_storage_denied', preflight?.response?.status || 403);
      }
      const request = new Request(url, { method, headers: { 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(headers)) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return deps.storageRoute({ path: url.pathname, method, request, env, config: ctx.config, slug: ctx.slug,
        uploaderAddress: ctx.address, authScopes: ctx.scopes, expectedAuthority: expectedAuthority(), baseHeaders: {} });
    },
    async faucet() {
      await current();
      if (!ctx.scopes?.faucet || ctx.config.agentHttp?.sponsoredFaucetAllowed !== true) return { ok: false, skipped: true, reason: 'session_faucet_not_allowed' };
      const secrets = await deps.getSessionSecrets(env, ctx.slug);
      const response = await deps.faucet({ payload: { to: ctx.address }, secrets, config: ctx.config, slug: ctx.slug,
        requesterAddress: ctx.address, tokenHasFaucetScope: true, baseHeaders: {} });
      const body = await response.json();
      return response.ok ? { ok: true, ...body } : { ok: false, reason: 'faucet_request_failed', status: response.status,
        ...(body.txHash ? { txHash: body.txHash } : {}) };
    },
    async uploadArweave(payload) {
      await current();
      if (!ctx.scopes.arweave) throw authorityError('agent_upload_scope_denied');
      const secrets = await deps.getSessionSecrets(env, ctx.slug);
      return deps.arweaveUpload({ env, config: ctx.config, slug: ctx.slug, secrets, ...payload, baseHeaders: {} });
    },
    async posterFetch(url, init) {
      await current();
      if (ctx.config.agentHttp?.wrapped?.posterEnabled !== true || ctx.config.agentHttp?.wrapped?.posterRenderer !== 'openai' || !agentEnv.AGENT_POSTER_API_KEY) throw authorityError('agent_poster_unavailable', 503);
      if (!await deps.checkRateLimit({ env, slug: ctx.slug, address: ctx.address, route: 'agent-poster', limit: 10 }) ||
          !await deps.checkRateLimit({ env, slug: ctx.slug, address: ctx.sessionId, route: 'agent-poster-session', limit: 40 })) throw authorityError('agent_poster_rate_limited', 429);
      return boundedAgentFetch(deps.fetch || fetch, { timeoutMs: 60_000, maxBytes: 8 * 1024 * 1024 })(url, init);
    },
    async ai(payload) {
      await current();
      if (!ctx.scopes?.ai) throw authorityError('agent_ai_scope_denied');
      if (!await deps.checkRateLimit({ env, slug: ctx.slug, address: ctx.address, limit: ctx.config.limits?.perWalletPerDay || 0 })) throw authorityError('agent_ai_rate_limited', 429);
      const key = ctx.sessionId;
      if ((activeAi.get(key) || 0) >= 2) throw authorityError('agent_ai_busy', 429);
      const model = resolveSessionAiModel(ctx.config, { taskType: payload.taskType || 'analysis' });
      const proxy = { openai: proxyOpenAI, anthropic: proxyAnthropic, openrouter: proxyOpenRouter }[model.provider];
      if (!proxy) throw authorityError('agent_ai_provider_unavailable', 503);
      const secrets = await deps.getSessionSecrets(env, ctx.slug);
      const safe = { ...payload, model: model.model, taskType: payload.taskType || 'analysis' };
      delete safe.apiKey; delete safe.rpcKey;
      activeAi.set(key, (activeAi.get(key) || 0) + 1);
      try {
        const response = await proxy({ payload: safe, secrets, config: ctx.config, baseHeaders: {}, deps: { fetch: boundedAgentFetch(deps.fetch || fetch) } });
        const body = await response.json();
        if (!response.ok) throw authorityError('agent_ai_request_failed', response.status);
        return body;
      } finally {
        const remaining = (activeAi.get(key) || 1) - 1;
        if (remaining) activeAi.set(key, remaining); else activeAi.delete(key);
      }
    },
    async updateConfig(patch) {
      if (ctx.auth?.signed !== true || !(await admin()).ok) throw authorityError('signed_session_admin_required');
      return executeCoordinatedSessionConfigMutation({ env, slug: ctx.slug, existingConfig: ctx.config,
        expectedAuthority: expectedAuthority(), mutation: { kind: 'set-config', incomingConfig: patch } });
    },
    async invite(operation, payload) {
      await current();
      const result = await callSessionConfigCoordinator({ env, slug: ctx.slug, path: `agent-invite/${operation}`,
        sessionId: ctx.sessionId, revision: ctx.revision, ...payload });
      return { ...result.body, ok: result.ok, status: result.status };
    },
  });
};
