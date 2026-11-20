// Signing a person in to the account their AI agent set up (shared/agentSignIn.mjs says how it works).
//
// - POST /auth/agent-link/create: the agent proves it holds the account's key with a fresh signed message, as for
//   a sign-in but saying what it asks for, and gets a one-time code. No web page can make this request.
// - POST /auth/agent-link/exchange: the session page swaps the code for a sign-in as that account. The code
//   works once, for thirty minutes, from the site it was made for, and never for an admin's account.
// - POST /auth/agent-link/attach: signed in from a code, the person attaches a passkey, which signs its consent.
// - POST /auth/agent-link/passkey-signin: a passkey's own sign-in is swapped for the account's.
// - POST /auth/agent-link/access: signed in with the passkey, the person ends the agent's access, or allows it.
// - POST /auth/agent-link/detach: the passkey comes off, by the passkey or by the account's own key.
// - POST /auth/agent-link/state: what the Worker keeps about the signed-in account, for the page to show.
//
// A sign-in made here says how it was made (`via`), carries no admin power, and is checked against the
// coordinator's record on every request, so ending the agent's access or removing the passkey ends it at once.
import {
  AGENT_ACCESS,
  AGENT_CLIENT_HEADER,
  AGENT_SIGN_IN_CODE_TTL_SECONDS,
  AGENT_SIGN_IN_LINK_STATEMENT,
  AGENT_SIGN_IN_PATHS,
  AGENT_SIGN_IN_VIA,
  agentParticipationOn,
  formatAgentSignInCode,
  isAgentSignInCode,
  readAgentPasskeyAttachStatement,
} from '../../shared/agentSignIn.mjs';
import { callAgentSignInStore } from './agentSignInStore.js';
import { resolveAuthLoginRequestAuthority } from './authLoginRequestAuthority.js';
import { buildAuthTokenJti, buildAuthTokenKey, persistAuthTokenRecord, revokeAuthTokenRecord } from './authTokenClaims.js';
import { resolveAuthenticatedRouteContext } from './authenticatedRouteContextResolution.js';
import { readAuthorizationEpoch } from './authorizationScopeFreshness.js';
import { rateLimitRefusal } from './rateLimitRefusal.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import { sessionSlugStorageKey } from './sessionSlugResolution.js';
import { validateTrustedLoginRequestOrigin } from './siweMessageValidation.js';

export const AGENT_SIGN_IN_ROUTE_PATHS = Object.freeze(Object.values(AGENT_SIGN_IN_PATHS));

// How often each may be asked in a day: codes and attachments by the account, exchanges by the network they come
// from (a code is 256 random bits, so this bounds cost, not guessing), the rest by the account.
export const AGENT_SIGN_IN_LIMITS = Object.freeze({ create: 24, exchange: 300, attach: 6, passkeySignIn: 200, access: 20 });

const CODE_INVALID = Object.freeze({
  error: 'This sign-in link has expired or was already used. Ask your agent for a new one.',
  reason: 'sign_in_code_invalid',
});
const OFF = Object.freeze({ error: 'This session has AI agents switched off.', reason: 'agent_participation_off' });
const CANCELLED = Object.freeze({
  error: 'The person this account belongs to has ended agent access to it in this session.',
  reason: 'agent_access_cancelled',
});
const UNAVAILABLE = Object.freeze({ error: 'Sign-in could not be checked just now. Try again.', reason: 'agent_sign_in_unavailable', retryable: true });
const REASON_TEXT = Object.freeze({
  account_has_passkey: 'This account already has a passkey attached.',
  passkey_in_use: 'This passkey is already attached to an account in this session.',
  invalid_passkey: 'This passkey can’t be attached to this account.',
  passkey_not_attached: 'This passkey isn’t attached to this account.',
  agent_access_cancelled_first: 'Let your agent use the account again before removing the passkey, or nobody could sign in to it.',
  invalid_agent_access: 'Choose whether the agent may use the account.',
});

const lower = (value) => String(value ?? '').trim().toLowerCase();
const isWorkerCanonical = (config) => lower(config?.sessionModeProfile?.authority?.mode) === 'worker_canonical';
const nowMs = (deps) => Number(deps?.now?.() ?? Date.now());

const sha256Hex = async (text) => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const originOf = (value) => {
  try {
    return new URL(String(value)).origin;
  } catch {
    return '';
  }
};

// A browser sends these with every request a page makes, and a page can't remove them.
const fromBrowserPage = (request) => ['sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest'].some((name) => request?.headers?.get?.(name));
export const saysItIsAnAgent = (request) => !!String(request?.headers?.get?.(AGENT_CLIENT_HEADER) || '').trim();

/** What the store answered, as a reply: a refusal in words, or unavailable. */
const storeRefusal = (result, json, headers) => {
  if (result?.unavailable) return json(UNAVAILABLE, 503, headers);
  if (result?.reason === 'agent_access_cancelled') return json(CANCELLED, 403, headers);
  if (result?.reason === 'sign_in_code_invalid') return json(CODE_INVALID, 401, headers);
  return json({ error: REASON_TEXT[result?.reason] || 'This could not be done.', reason: result?.reason || 'refused' }, result?.status || 409, headers);
};

// A sign-in for `account` that names how it was made. It never carries admin power.
const mintSignIn = async ({ env, slug, config, account, via, actor, deps }) => {
  let scopes;
  try {
    scopes = await deps.computeScopesForLogin({ env, slug, address: account, config });
  } catch (error) {
    return { ok: false, status: 403, body: { error: error?.message || 'Gate check failed.' } };
  }
  if (scopes?.admin === true) return { ok: false, status: 403, body: { error: 'An admin’s account can’t be signed in to this way.', reason: 'admin_account_not_supported' } };
  const authzEpoch = readAuthorizationEpoch(config);
  const sessionId = resolveCanonicalWorkerSessionIdHex(config);
  if (authzEpoch === null || !sessionId) return { ok: false, status: 500, body: { error: 'Worker session identity is invalid.' } };
  const exp = Math.floor(nowMs(deps) / 1000) + deps.TOKEN_TTL_SECONDS;
  const sub = deps.getAddress(account);
  const jti = (deps.buildAuthTokenJti || buildAuthTokenJti)({});
  const payload = { sub, slug, sessionId, authzEpoch, scopes, exp, jti, via, ...(actor ? { actor: lower(actor) } : {}) };
  try {
    const token = await deps.signToken(payload, env?.TOKEN_HMAC_SECRET);
    await (deps.persistAuthTokenRecord || persistAuthTokenRecord)({ env, slug, sub, jti, ttlSeconds: deps.TOKEN_TTL_SECONDS });
    return { ok: true, token, exp, sub, jti, sessionId };
  } catch {
    return { ok: false, status: 500, body: { error: 'Sign-in could not be made.' } };
  }
};

// Ends every sign-in for the account but one. Sign-ins made once a passkey was attached are also checked on each
// request, so this is what reaches the ones made before.
const endOtherSignIns = async ({ env, slug, account, keepJti }) => {
  const kv = env?.GROUP_KV;
  const prefix = buildAuthTokenKey({ slug, sub: account, jti: 'x' }).slice(0, -1);
  const keep = buildAuthTokenKey({ slug, sub: account, jti: keepJti || 'none' });
  if (!prefix || typeof kv?.list !== 'function' || typeof kv?.delete !== 'function') return { ended: 0, complete: false };
  let ended = 0;
  let cursor;
  for (let page = 0; page < 20; page += 1) {
    const listed = await kv.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const { name } of listed?.keys || []) {
      if (name === keep) continue;
      await kv.delete(name);
      ended += 1;
    }
    if (listed?.list_complete !== false || !listed?.cursor) return { ended, complete: true };
    cursor = listed.cursor;
  }
  return { ended, complete: false };
};

const countOrRefuse = async ({ deps, env, slug, identity, route, limit, headers }) => {
  const allowed = await deps.checkRateLimit({ env, slug, address: identity, route, limit });
  return allowed ? null : rateLimitRefusal(allowed, deps.json, headers);
};

// The signed-in caller of a route that needs one: its claims, the session as it is now, and reply headers.
const signedIn = async ({ request, env, baseHeaders, slug, deps }) => {
  const auth = await deps.requireAuth({ request, env, baseHeaders, slugHint: slug });
  if (!auth?.ok) return { response: auth?.response };
  const context = await (deps.resolveAuthenticatedRouteContext || resolveAuthenticatedRouteContext)({ request, env, auth, baseHeaders, deps });
  if (!context?.ok) return { response: context?.response };
  const headers = new Headers(context.headers || {});
  headers.set('cache-control', 'no-store');
  if (!isWorkerCanonical(context.config)) return { response: deps.json({ error: 'Not available in this session.', reason: 'hosted_session_required' }, 400, headers) };
  return { auth, context, headers, account: lower(context.address), claims: auth.payload || {} };
};

const readBody = async (request) => {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
};

// A signed message checked as a sign-in's is: the signature, the session, the site, a nonce used once. `loginDeps`
// is what /auth/login is given. The statement is read first, so a message for anything else spends no nonce.
const signedMessage = async ({ request, env, body, slug, baseHeaders, deps, statementOk }) => {
  let siwe;
  try {
    siwe = deps.loginDeps.parseSiweMessage(body?.message);
  } catch {
    siwe = null;
  }
  if (!siwe || !statementOk(siwe.statement)) {
    return { ok: false, response: deps.json({ error: 'This message is not for this request.', reason: 'wrong_statement' }, 400, baseHeaders) };
  }
  const authority = await (deps.resolveAuthLoginRequestAuthority || resolveAuthLoginRequestAuthority)({
    env, request, body, slugHint: slug, baseHeaders, deps: deps.loginDeps,
  });
  return authority?.ok ? { ...authority, siwe } : { ok: false, response: authority?.response };
};

const create = async ({ request, env, baseHeaders, slug, deps }) => {
  // Only a program that says it is an agent's, and never a web page.
  if (!saysItIsAnAgent(request) || fromBrowserPage(request)) {
    return deps.json({ error: 'Only an agent’s own client can ask for a sign-in link.', reason: 'agent_client_required' }, 403, baseHeaders);
  }
  const body = await readBody(request);
  if (!body) return deps.json({ error: 'Invalid JSON.' }, 400, baseHeaders);
  const signed = await signedMessage({
    request, env, body, slug, baseHeaders, deps, statementOk: (statement) => statement === AGENT_SIGN_IN_LINK_STATEMENT,
  });
  if (!signed.ok) return signed.response;
  const { address, config, headers, scopes, targetSlug, siwe } = signed;
  const reply = new Headers(headers || {});
  reply.set('cache-control', 'no-store');
  if (!isWorkerCanonical(config)) return deps.json({ error: 'Not available in this session.', reason: 'hosted_session_required' }, 400, reply);
  if (!agentParticipationOn(config)) return deps.json(OFF, 403, reply);
  if (scopes?.admin === true) return deps.json({ error: 'An admin’s account can’t be signed in to this way.', reason: 'admin_account_not_supported' }, 403, reply);
  const account = lower(address);
  const limited = await countOrRefuse({ deps, env, slug: targetSlug, identity: account, route: 'agent-link-create', limit: AGENT_SIGN_IN_LIMITS.create, headers: reply });
  if (limited) return limited;
  // The site the code is for: the one the signed message names, which the request's own origin was held to.
  const origin = originOf(siwe.uri);
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const code = formatAgentSignInCode(bytes);
  const now = nowMs(deps);
  const expiresAt = now + AGENT_SIGN_IN_CODE_TTL_SECONDS * 1000;
  const stored = await callAgentSignInStore(env, targetSlug, 'code-create', { address: account, codeHash: await sha256Hex(code), origin, expiresAt, now });
  if (!stored.ok) return storeRefusal(stored, deps.json, reply);
  return deps.json({ ok: true, code, expiresAt, address: deps.getAddress(account), origin, sessionSlug: targetSlug }, 200, reply);
};

const exchange = async ({ request, env, baseHeaders, slug, deps }) => {
  const body = await readBody(request);
  if (!body) return deps.json({ error: 'Invalid JSON.' }, 400, baseHeaders);
  const slugContext = deps.resolveWorkerBodySlugContext({ body, env, slugHint: slug }) || {};
  if (!slugContext.ok || !slugContext.targetSlug || !(slugContext.explicitSlugProvided || slugContext.envSlug || slugContext.slugPayload?.hasAnySlug)) {
    return deps.json({ error: slugContext.error || 'Missing session.' }, 400, baseHeaders);
  }
  const targetSlug = slugContext.targetSlug;
  const cors = await deps.resolveExistingSessionCors({ request, env, slug: targetSlug, baseHeaders });
  if (!cors?.ok) return cors?.response;
  const headers = new Headers(cors.headers || {});
  headers.set('cache-control', 'no-store');
  const config = cors.config;
  // From a page of the session's own site, and from nowhere else.
  const origin = originOf(request.headers.get('origin') || '');
  const trusted = (deps.validateTrustedLoginRequestOrigin || validateTrustedLoginRequestOrigin)(
    { request, env, config }, { resolveTrustedAdminOrigins: deps.resolveTrustedAdminOrigins },
  );
  if (!origin || !trusted?.ok) return deps.json({ error: trusted?.error || 'Browser origin not allowed.', reason: 'origin_not_allowed' }, 403, headers);
  if (!config || !isWorkerCanonical(config)) return deps.json({ error: 'Not available in this session.', reason: 'hosted_session_required' }, 400, headers);
  if (resolveCanonicalWorkerSessionIdHex({ sessionId: body.sessionId }) !== resolveCanonicalWorkerSessionIdHex(config)) {
    return deps.json({ error: 'Session identity does not match worker session.' }, 409, headers);
  }
  const limited = await countOrRefuse({
    deps, env, slug: targetSlug, identity: deps.resolveAnonymousRateIdentity(request), route: 'agent-link-exchange', limit: AGENT_SIGN_IN_LIMITS.exchange, headers,
  });
  if (limited) return limited;
  if (!agentParticipationOn(config)) return deps.json(OFF, 403, headers);
  if (!isAgentSignInCode(body.code)) return deps.json(CODE_INVALID, 401, headers);
  const redeemed = await callAgentSignInStore(env, targetSlug, 'code-redeem', { codeHash: await sha256Hex(body.code), origin, now: nowMs(deps) });
  if (!redeemed.ok) return storeRefusal(redeemed, deps.json, headers);
  const minted = await mintSignIn({ env, slug: targetSlug, config, account: redeemed.account, via: AGENT_SIGN_IN_VIA.LINK, deps });
  if (!minted.ok) return deps.json(minted.body, minted.status, headers);
  return deps.json({
    token: minted.token, exp: minted.exp, sessionSlug: targetSlug, sessionId: minted.sessionId, address: minted.sub,
    via: AGENT_SIGN_IN_VIA.LINK, passkeyAttached: !!redeemed.link, agentAccess: AGENT_ACCESS.ACTIVE,
  }, 200, headers);
};

const attach = async ({ request, env, baseHeaders, slug, deps }) => {
  const caller = await signedIn({ request: request.clone(), env, baseHeaders, slug, deps });
  if (caller.response) return caller.response;
  const { context, headers, account, claims } = caller;
  // Only from the sign-in a code gave: the person, in a browser, holding the account now.
  if (claims.via !== AGENT_SIGN_IN_VIA.LINK) return deps.json({ error: 'Open the session from your agent’s sign-in link to attach a passkey.', reason: 'sign_in_link_required' }, 403, headers);
  const body = await readBody(request);
  const passkey = body?.passkey && typeof body.passkey === 'object' ? body.passkey : null;
  if (!passkey) return deps.json({ error: 'Invalid JSON.' }, 400, headers);
  // The passkey's own signed consent, naming this account, checked as its sign-in would be.
  const signed = await signedMessage({
    request, env, slug: context.slug, baseHeaders: headers, deps,
    body: { address: passkey.address, message: passkey.message, signature: passkey.signature, sessionSlug: context.slug, sessionId: body.sessionId },
    statementOk: (statement) => readAgentPasskeyAttachStatement(statement) === account,
  });
  if (!signed.ok) return signed.response;
  const passkeyAddress = lower(signed.address);
  if (passkeyAddress === account) return deps.json({ error: REASON_TEXT.invalid_passkey, reason: 'invalid_passkey' }, 400, headers);
  if (signed.scopes?.admin === true) return deps.json({ error: 'An admin’s passkey can’t be attached to another account.', reason: 'passkey_is_admin' }, 403, headers);
  const limited = await countOrRefuse({ deps, env, slug: context.slug, identity: account, route: 'agent-link-attach', limit: AGENT_SIGN_IN_LIMITS.attach, headers });
  if (limited) return limited;
  const attached = await callAgentSignInStore(env, context.slug, 'attach', { address: account, passkey: passkeyAddress, now: nowMs(deps) });
  if (!attached.ok) return storeRefusal(attached, deps.json, headers);
  const minted = await mintSignIn({ env, slug: context.slug, config: context.config, account, via: AGENT_SIGN_IN_VIA.PASSKEY, actor: passkeyAddress, deps });
  if (!minted.ok) return deps.json(minted.body, minted.status, headers);
  // Every sign-in the account had is ended, the agent's included: its next one says a passkey is attached, and
  // is then checked on each request. The agent's client signs in again by itself.
  await endOtherSignIns({ env, slug: context.slug, account, keepJti: minted.jti });
  return deps.json({
    ok: true, token: minted.token, exp: minted.exp, sessionSlug: context.slug, sessionId: minted.sessionId, address: minted.sub,
    via: AGENT_SIGN_IN_VIA.PASSKEY, passkey: deps.getAddress(passkeyAddress), agentAccess: attached.link.agentAccess,
  }, 200, headers);
};

const passkeySignIn = async ({ request, env, baseHeaders, slug, deps }) => {
  const caller = await signedIn({ request, env, baseHeaders, slug, deps });
  if (caller.response) return caller.response;
  const { context, headers, account: passkeyAddress, claims } = caller;
  // The passkey's own sign-in, made with its key: not one made here, or by an agent's key.
  if (claims.via || claims.agentSource) return deps.json({ error: 'Sign in with your passkey first.', reason: 'passkey_sign_in_required' }, 403, headers);
  const limited = await countOrRefuse({ deps, env, slug: context.slug, identity: passkeyAddress, route: 'agent-link-passkey', limit: AGENT_SIGN_IN_LIMITS.passkeySignIn, headers });
  if (limited) return limited;
  const state = await callAgentSignInStore(env, context.slug, 'state', { address: passkeyAddress });
  if (!state.ok) return storeRefusal(state, deps.json, headers);
  if (!state.asPasskey) return deps.json({ error: 'This passkey isn’t attached to an agent’s account in this session.', reason: 'passkey_not_attached' }, 404, headers);
  const account = state.asPasskey.account;
  const link = await callAgentSignInStore(env, context.slug, 'state', { address: account });
  if (!link.ok) return storeRefusal(link, deps.json, headers);
  if (link.asAccount?.passkey !== passkeyAddress) return deps.json({ error: REASON_TEXT.passkey_not_attached, reason: 'passkey_not_attached' }, 404, headers);
  const minted = await mintSignIn({ env, slug: context.slug, config: context.config, account, via: AGENT_SIGN_IN_VIA.PASSKEY, actor: passkeyAddress, deps });
  if (!minted.ok) return deps.json(minted.body, minted.status, headers);
  return deps.json({
    token: minted.token, exp: minted.exp, sessionSlug: context.slug, sessionId: minted.sessionId, address: minted.sub,
    via: AGENT_SIGN_IN_VIA.PASSKEY, passkey: deps.getAddress(passkeyAddress), agentAccess: link.asAccount.agentAccess,
  }, 200, headers);
};

const access = async ({ request, env, baseHeaders, slug, deps }) => {
  const caller = await signedIn({ request: request.clone(), env, baseHeaders, slug, deps });
  if (caller.response) return caller.response;
  const { context, headers, account, claims } = caller;
  // Only signed in with the attached passkey.
  if (claims.via !== AGENT_SIGN_IN_VIA.PASSKEY || !claims.actor) {
    return deps.json({ error: 'Sign in with the passkey attached to this account to change this.', reason: 'passkey_sign_in_required' }, 403, headers);
  }
  const body = await readBody(request);
  const limited = await countOrRefuse({ deps, env, slug: context.slug, identity: account, route: 'agent-link-access', limit: AGENT_SIGN_IN_LIMITS.access, headers });
  if (limited) return limited;
  const changed = await callAgentSignInStore(env, context.slug, 'access', { address: account, passkey: claims.actor, agentAccess: body?.agentAccess, now: nowMs(deps) });
  if (!changed.ok) return storeRefusal(changed, deps.json, headers);
  // Cancelled in the record first, so no new sign-in or code can be made; then every sign-in but this one ends.
  const ended = changed.link.agentAccess === AGENT_ACCESS.CANCELLED
    ? await endOtherSignIns({ env, slug: context.slug, account, keepJti: claims.jti })
    : null;
  return deps.json({ ok: true, agentAccess: changed.link.agentAccess, ...(ended ? { signInsEnded: ended.ended } : {}) }, 200, headers);
};

const detach = async ({ request, env, baseHeaders, slug, deps }) => {
  const caller = await signedIn({ request, env, baseHeaders, slug, deps });
  if (caller.response) return caller.response;
  const { context, headers, account, claims } = caller;
  // By the passkey itself, or by the account's own key; not by a sign-in a code or another key made.
  const byPasskey = claims.via === AGENT_SIGN_IN_VIA.PASSKEY && !!claims.actor;
  if (!byPasskey && (claims.via || claims.agentSource)) {
    return deps.json({ error: 'Sign in with the passkey, or as the account itself, to remove its passkey.', reason: 'passkey_sign_in_required' }, 403, headers);
  }
  const limited = await countOrRefuse({ deps, env, slug: context.slug, identity: account, route: 'agent-link-access', limit: AGENT_SIGN_IN_LIMITS.access, headers });
  if (limited) return limited;
  const removed = await callAgentSignInStore(env, context.slug, 'detach', { address: account, ...(byPasskey ? { passkey: claims.actor } : {}) });
  if (!removed.ok) return storeRefusal(removed, deps.json, headers);
  // The passkey's sign-ins as this account stop with the record; the one asking with, if it was the passkey's.
  if (byPasskey) await revokeAuthTokenRecord({ env, slug: context.slug, sub: claims.sub, jti: claims.jti });
  return deps.json({ ok: true, detached: removed.detached === true }, 200, headers);
};

const state = async ({ request, env, baseHeaders, slug, deps }) => {
  const caller = await signedIn({ request, env, baseHeaders, slug, deps });
  if (caller.response) return caller.response;
  const { context, headers, account, claims } = caller;
  const kept = await callAgentSignInStore(env, context.slug, 'state', { address: account });
  if (!kept.ok) return storeRefusal(kept, deps.json, headers);
  return deps.json({
    ok: true,
    address: deps.getAddress(account),
    via: claims.via || null,
    agentParticipation: agentParticipationOn(context.config),
    attachedPasskey: kept.asAccount ? { address: deps.getAddress(kept.asAccount.passkey), agentAccess: kept.asAccount.agentAccess, linkedAt: kept.asAccount.linkedAt } : null,
    linkedAgentAccount: kept.asPasskey ? { address: deps.getAddress(kept.asPasskey.account) } : null,
  }, 200, headers);
};

const ROUTES = Object.freeze({
  [AGENT_SIGN_IN_PATHS.create]: create,
  [AGENT_SIGN_IN_PATHS.exchange]: exchange,
  [AGENT_SIGN_IN_PATHS.attach]: attach,
  [AGENT_SIGN_IN_PATHS.passkeySignIn]: passkeySignIn,
  [AGENT_SIGN_IN_PATHS.access]: access,
  [AGENT_SIGN_IN_PATHS.detach]: detach,
  [AGENT_SIGN_IN_PATHS.state]: state,
});

export const dispatchAgentSignInLinkRequest = async ({ path, request, env, baseHeaders, slug, deps } = {}) => {
  const route = Object.hasOwn(ROUTES, path) ? ROUTES[path] : null;
  if (!route) return deps?.json?.({ error: 'Not found.' }, 404, baseHeaders);
  return route({ request, env, baseHeaders, slug, deps });
};

/**
 * What a sign-in with an account's own key must pass, and carry, in a session this Worker hosts: refused where
 * the session has agents off and the client says it is one, or where the account's person has ended agent
 * access; told of a passkey attached to it, or of the agent's account its passkey is for. Unreadable is refused.
 */
export const checkAgentSignInAtLogin = async ({ env, request, slug, address, config, scopes } = {}) => {
  if (!isWorkerCanonical(config)) return {};
  if (!agentParticipationOn(config) && saysItIsAnAgent(request) && scopes?.admin !== true) return { refusal: { status: 403, body: OFF } };
  const kept = await callAgentSignInStore(env, slug, 'state', { address: lower(address) });
  if (!kept.ok) return { refusal: { status: 503, body: UNAVAILABLE } };
  if (kept.asAccount?.agentAccess === AGENT_ACCESS.CANCELLED) return { refusal: { status: 403, body: CANCELLED } };
  return {
    claims: kept.asAccount ? { agentLinked: true } : {},
    reply: {
      ...(kept.asAccount ? { attachedPasskey: { address: kept.asAccount.passkey } } : {}),
      ...(kept.asPasskey ? { linkedAgentAccount: { address: kept.asPasskey.account } } : {}),
    },
  };
};

/**
 * Whether a sign-in still stands, for the ones the coordinator's record can end: one a code made (while the
 * agent may use the account), one the attached passkey made (while that passkey is attached), and the account's
 * own once a passkey was attached (while the agent may use it). Every other sign-in is not looked up.
 */
export const validateAgentSignInToken = async ({ env, payload, slug } = {}) => {
  if (!payload?.via && payload?.agentLinked !== true) return { ok: true };
  const kept = await callAgentSignInStore(env, sessionSlugStorageKey(slug) ? slug : payload.slug, 'state', { address: lower(payload.sub) });
  if (!kept.ok) return { ok: false, status: 503, error: UNAVAILABLE.error };
  const link = kept.asAccount;
  if (payload.via === AGENT_SIGN_IN_VIA.PASSKEY) {
    return link && link.passkey === lower(payload.actor) ? { ok: true } : { ok: false, status: 401, error: 'Invalid token.' };
  }
  if (payload.via && payload.via !== AGENT_SIGN_IN_VIA.LINK) return { ok: false, status: 401, error: 'Invalid token.' };
  return link?.agentAccess === AGENT_ACCESS.CANCELLED ? { ok: false, status: 401, error: 'Invalid token.' } : { ok: true };
};
