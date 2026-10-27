import { readBodyBytes } from '../../shared/bodyByteLimit.mjs';
import { resolveWorkerBodySlugContext, validateInboundWorkerSessionSlug } from '../sessionSlugResolution.js';
import { readCurrentSessionConfig } from '../sessionConfigAuthority.js';
import { resolveAdminRequestAuthority } from '../adminRequestAuthority.js';
import { resolveAuthenticatedRouteContext } from '../authenticatedRouteContextResolution.js';
import { createAgentEnvironment, agentHttpEnabled, authorityError, validateCredentialAuthority, validateMemberSource } from './authority.mjs';
import { loadAgentCredential } from './agentCredentials.mjs';
import { extractAgentToken, suppliedAgentToken, applyDelegationToInput, resolveHandoffContext } from './httpAuth.mjs';
import { inputFromRequest, json } from './httpInput.mjs';
import { resolveAgentRoute } from './routes.mjs';
import { handleAgentHttpRequest } from './dispatch.mjs';
import { aggregateResultsEnabledForAgent, authorizeSessionMemberAggregateResults } from './results.mjs';
import { createAgentServices } from './services.mjs';

export const dispatchSessionAgentRequest = async ({ request, env, deps, baseHeaders = {} }) => {
  const url = new URL(request.url);
  const route = resolveAgentRoute(url.pathname);
  if (!route) return json({ ok: false, reason: 'agent_route_not_found' }, { status: 404 });
  const method = request.method.toUpperCase();
  if (!(route.methods.includes(method) || method === 'OPTIONS' && route.cors)) {
    return json({ ok: false, reason: 'method_not_allowed' }, { status: 405, headers: { Allow: route.methods.join(', ') } });
  }
  let headers = {};
  try {
    let body = {};
    if (request.body) {
      const bytes = await readBodyBytes(request, 512 * 1024);
      request = new Request(request, { body: bytes });
      try { body = await request.clone().json(); } catch { throw authorityError('invalid_json', 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw authorityError('invalid_json', 400);
    }
    const slugs = [body.sessionSlug, body.slug, body.groupSlug, url.searchParams.get('sessionSlug'), url.searchParams.get('slug'),
      request.headers.get('x-session-slug'), request.headers.get('x-group-slug')].filter(value => value != null);
    const values = slugs.map(value => validateInboundWorkerSessionSlug(value));
    if (values.some(value => !value.ok) || new Set(values.map(value => value.slug)).size > 1) throw authorityError('agent_session_mismatch', 400);
    const selection = resolveWorkerBodySlugContext({ body: slugs.length ? { sessionSlug: values[0].slug } : {}, env });
    if (!selection.ok || !selection.explicitSlugProvided || !selection.targetSlug) throw authorityError('agent_session_required', 400);
    const slug = selection.targetSlug;
    const { config, revision } = await (deps.readCurrentSessionConfig || readCurrentSessionConfig)({ env, slug });
    if (!config) throw authorityError('session_not_found', 404);
    const cors = await deps.getCorsContext({ request, config });
    if (!cors?.ok) return cors?.response || json({ ok: false, reason: 'origin_not_allowed' }, { status: 403 });
    headers = { ...Object.fromEntries(new Headers(cors.headers)), 'Cache-Control': 'no-store' };
    if (method === 'OPTIONS') {
      const requestedMethod = request.headers.get('Access-Control-Request-Method');
      const methods = ['/api/agent/questions', '/api/agent/results'].includes(route.path) ? ['GET'] : route.methods;
      if (requestedMethod && !methods.includes(requestedMethod.toUpperCase())) throw authorityError('method_not_allowed', 405);
      return new Response(null, { status: 204, headers: { ...Object.fromEntries(new Headers(headers)), 'Access-Control-Allow-Methods': [...methods, 'OPTIONS'].join(', '),
        'Access-Control-Allow-Headers': 'authorization, content-type, x-session-slug, x-ce-agent-token, x-context-engine-agent-token' } });
    }
    if (!agentHttpEnabled(config) && !route.descriptor) throw authorityError('agent_http_disabled');
    const agentEnv = createAgentEnvironment({ env, config, revision, slug, origin: url.origin, now: deps.now, fetchImpl: deps.fetch });
    const ctx = agentEnv.AGENT_CONTEXT;
    const requestedIds = [body.sessionId, body.sessionIdHex, url.searchParams.get('sessionId')].filter(value => value != null);
    if (requestedIds.some(value => typeof value !== 'string' || value.toLowerCase() !== ctx.sessionId)) throw authorityError('agent_session_identity_mismatch', 403);
    ctx.headers = headers;
    let rawInput = { ...inputFromRequest(request, body), sessionSlug: slug };
    const access = route.access === 'cache' ? method === 'POST' ? 'operator' : 'agent' :
      route.access === 'skillAdmin' ? method === 'GET' ? 'admin' : 'operator' : route.access;
    const supplied = suppliedAgentToken(request) || (access === 'exchange' ? extractAgentToken(body.token || body.agentToken) : '');
    const sourceJwtCheck = payload => validateMemberSource({ env, context: ctx, payload, deps });
    let auth = { ok: true, authMode: 'public' };
    if (access === 'participant') {
      const suppliedJwt = request.headers.get('authorization') ||
        `Bearer ${body.sessionWorkerCredential || body.workerCredential || body.sessionWorkerToken || ''}`;
      const jwtRequest = new Request(request, { headers: { ...Object.fromEntries(request.headers), authorization: suppliedJwt, 'x-session-slug': slug } });
      const verified = await deps.requireAuth({ request: jwtRequest, env, baseHeaders: headers });
      if (!verified?.ok) return verified.response;
      await sourceJwtCheck(verified.payload);
      auth = { ok: true, authMode: 'participant', payload: verified.payload, address: verified.payload.sub };
    } else if (access !== 'public' && supplied && access !== 'operator') {
      const loaded = await loadAgentCredential({ env: agentEnv, token: supplied, now: new Date(ctx.now()).toISOString() });
      if (!loaded.ok) throw authorityError(loaded.reason, loaded.reason === 'agent_token_storage_unavailable' ? 503 : 401);
      await validateCredentialAuthority({ env: agentEnv, record: loaded.record, validateSourceJwt: sourceJwtCheck });
      const wrapped = loaded.record.scopes.includes('agent_autofill') || ['member', 'agent_only'].includes(loaded.record.credentialKind);
      if (wrapped !== (access === 'wrapped')) throw authorityError('agent_credential_purpose_denied');
      auth = { ok: true, authMode: 'agent_credential', delegation: loaded.record, address: loaded.record.accountAddress };
    } else if (['operator', 'admin', 'status'].includes(access)) {
      if (supplied) throw authorityError('session_admin_required');
      const writes = !['GET', 'HEAD'].includes(method) && !route.operatorRead && access !== 'status';
      if (writes) {
        // The method is part of the signed body hash. Query parameters cannot
        // change an authorized write's semantics after signing.
        if (body.httpMethod !== method) throw authorityError('agent_signed_method_mismatch', 400);
        const verified = await resolveAdminRequestAuthority({ env, request, body, slugHint: slug,
          action: route.path.slice('/api/agent/'.length), baseHeaders: headers, deps });
        if (!verified?.ok) return verified.response;
        if (verified.targetSlug !== slug || verified.expectedAuthority.revision !== revision) throw authorityError('agent_authority_changed', 409);
        auth = { ok: true, authMode: 'session_admin', address: verified.address, signed: true, expectedAuthority: verified.expectedAuthority };
      } else {
        const verified = await deps.requireAuth({ request: new Request(request, { headers: { ...Object.fromEntries(request.headers), 'x-session-slug': slug } }), env, baseHeaders: headers });
        if (!verified?.ok) return verified.response;
        const current = await resolveAuthenticatedRouteContext({ request, env, auth: verified, baseHeaders: headers, deps });
        if (!current?.ok) return current.response;
        if (current.slug !== slug || !await deps.validateAdmin({ env, slug, address: current.address, config })) throw authorityError('session_admin_required');
        auth = { ok: true, authMode: 'session_admin', address: current.address, expectedAuthority: current.expectedAuthority };
      }
      auth.slug = slug;
      auth.principal = { principalId: `admin:${auth.address.toLowerCase()}`, kind: 'service', adapter: 'session_admin' };
    } else if (access !== 'public') {
      throw authorityError('agent_credential_required', 401);
    }
    if (auth.signed) rawInput = { ...inputFromRequest(new Request(`${url.origin}${url.pathname}`, { method }), body), sessionSlug: slug };
    ctx.auth = auth;
    ctx.address = auth.address || '';
    if (ctx.address) {
      try { ctx.scopes = await deps.computeScopesForLogin({ env, slug, config, address: ctx.address }); }
      catch { throw authorityError('agent_membership_denied'); }
    }
    agentEnv.AGENT_SERVICES = createAgentServices({ env, agentEnv, deps });
    if (route.hosted && config.sessionModeProfile?.authority?.mode !== 'worker_canonical') throw authorityError('hosted_session_required');
    if (access === 'admin' && !(await agentEnv.AGENT_SERVICES.admin()).ok) throw authorityError('session_admin_required');
    if (route.authoring) {
      const mode = config.agentHttp?.questionAuthoringPermissionMode || 'session_policy';
      if (mode !== 'session_policy' || !(ctx.scopes?.storage || ctx.scopes?.arweave)) throw authorityError('question_authoring_denied');
    }
    let input = rawInput;
    let context = null;
    if (['agent_credential', 'session_admin'].includes(auth.authMode) && access !== 'exchange') {
      const delegated = applyDelegationToInput(auth, rawInput, route.path, method);
      if (!delegated.ok) throw authorityError(delegated.reason, delegated.status);
      input = delegated.input;
      context = await resolveHandoffContext({ env: agentEnv, auth, input });
      if (!context.ok) throw authorityError(context.reason, context.status);
    }
    if (route.results) {
      await agentEnv.AGENT_SERVICES.current();
      const visibility = config.sessionModeProfile?.results?.visibility;
      if (!aggregateResultsEnabledForAgent(context.session) || ['private_admin', 'public_redacted_snapshot'].includes(visibility)) throw authorityError('agent_results_hidden');
      const membership = await authorizeSessionMemberAggregateResults({ env: agentEnv, context, input: {} });
      if (!membership.ok) throw authorityError(membership.reason, membership.status);
    }
    const response = await handleAgentHttpRequest({ request, env: agentEnv, body, context, input, route, waitUntil: deps.waitUntil, fetchImpl: deps.fetch });
    const output = new Response(method === 'HEAD' ? null : response.body, response);
    new Headers(headers).forEach((value, key) => output.headers.set(key, value));
    return output;
  } catch (error) {
    const reason = error.reason || (error.message === 'managed_demo_root_secret_missing' ? 'managed_demo_signer_not_configured' : 'agent_request_failed');
    const status = error.status || (reason === 'managed_demo_signer_not_configured' ? 503 : 500);
    return json({ ok: false, reason }, { status, headers });
  }
};
