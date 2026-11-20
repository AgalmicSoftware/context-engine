import {
  resolveAuthLoginRequestAuthority,
} from './authLoginRequestAuthority.js';
import {
  buildAuthTokenJti,
  persistAuthTokenRecord,
} from './authTokenClaims.js';
import {
  ABUSE_COUNTER_TYPES,
  recordAbuseEvent as recordAbuseEventBoundary,
} from './abuseObservability.js';
import { readAuthorizationEpoch } from './authorizationScopeFreshness.js';
import { AGENT_SIGN_IN_LINK_STATEMENT } from '../../shared/agentSignIn.mjs';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';

const recordAuthFailure = async ({ env, deps } = {}) => {
  try {
    await (deps?.recordAbuseEvent || recordAbuseEventBoundary)({
      env,
      type: ABUSE_COUNTER_TYPES.AUTH_FAILURE,
      now: deps?.now,
    });
  } catch {
    // Auth telemetry must not alter login failure responses.
  }
};

export const dispatchAuthLoginRequest = async ({
  request,
  env,
  baseHeaders,
  slug,
  deps,
} = {}) => {
  let body;
  try {
    body = await request?.json?.();
  } catch {
    return deps?.json?.({ error: 'Invalid JSON.' }, 400, baseHeaders);
  }

  // A message that asks for a sign-in link, or attaches a passkey, is not a sign-in: refused before its nonce is spent.
  if (typeof body?.message === 'string' && (body.message.includes(`\n\n${AGENT_SIGN_IN_LINK_STATEMENT}\n`) ||
      /\n\nAttach this passkey to the Context Engine account /.test(body.message))) {
    return deps?.json?.({ error: 'This message is not a sign-in.', reason: 'wrong_statement' }, 400, baseHeaders);
  }

  const authorityResult = await (
    deps?.resolveAuthLoginRequestAuthority || resolveAuthLoginRequestAuthority
  )({
    env,
    request,
    body,
    slugHint: slug,
    baseHeaders,
    deps: {
      json: deps?.json,
      normalizeSignedWorkerRequest: deps?.normalizeSignedWorkerRequest,
      resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
      isAddress: deps?.isAddress,
      resolveExistingSessionCors: deps?.resolveExistingSessionCors,
      verifyMessage: deps?.verifyMessage,
      validateRecoveredAddressMatchesRequest: deps?.validateRecoveredAddressMatchesRequest,
      parseSiweMessage: deps?.parseSiweMessage,
      validateSiwe: deps?.validateSiwe,
      validateBrowserLoginOrigin: deps?.validateBrowserLoginOrigin,
      resolveTrustedAdminOrigins: deps?.resolveTrustedAdminOrigins,
      validateSiweAddressMatchesRequest: deps?.validateSiweAddressMatchesRequest,
      consumeNonce: deps?.consumeNonce,
      computeScopesForLogin: deps?.computeScopesForLogin,
      now: deps?.now,
      LOGIN_SIWE_MAX_AGE_MS: deps?.LOGIN_SIWE_MAX_AGE_MS,
      LOGIN_SIWE_FUTURE_SKEW_MS: deps?.LOGIN_SIWE_FUTURE_SKEW_MS,
      MISSING_SLUG_ERROR: deps?.MISSING_SLUG_ERROR,
      SESSION_CONFIG_NOT_FOUND_ERROR: deps?.SESSION_CONFIG_NOT_FOUND_ERROR,
    },
  });
  if (!authorityResult?.ok) {
    await recordAuthFailure({ env, deps });
    return authorityResult?.response;
  }

  const {
    address,
    config,
    headers,
    scopes,
    targetSlug,
  } = authorityResult;

  // An account with a passkey attached, or a passkey attached to one: the sign-in is refused where the account's
  // person ended agent access, and otherwise says what is attached. A session with agents off refuses one.
  let agentSignIn = {};
  if (typeof deps?.checkAgentSignInAtLogin === 'function') {
    agentSignIn = (await deps.checkAgentSignInAtLogin({ env, request, slug: targetSlug, address, config, scopes })) || {};
    if (agentSignIn.refusal) {
      return deps?.json?.(agentSignIn.refusal.body, agentSignIn.refusal.status, headers);
    }
  }

  const exp = Math.floor((deps?.now?.() ?? Date.now()) / 1000) + deps?.TOKEN_TTL_SECONDS;
  const sub = deps?.getAddress?.(address);
  const authzEpoch = readAuthorizationEpoch(config);
  if (authzEpoch === null) {
    return deps?.json?.({ error: 'Session authorization epoch is invalid.' }, 500, headers);
  }
  const sessionId = resolveCanonicalWorkerSessionIdHex(config);
  const workerCanonical = String(config?.sessionModeProfile?.authority?.mode || '').trim().toLowerCase() ===
    'worker_canonical';
  const requestedSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: body?.sessionId });
  if (workerCanonical && !sessionId) {
    return deps?.json?.({ error: 'Worker session identity is invalid.' }, 500, headers);
  }
  if (workerCanonical && requestedSessionId !== sessionId) {
    return deps?.json?.({ error: 'Session identity does not match worker session.' }, 409, headers);
  }
  const buildJti = typeof deps?.buildAuthTokenJti === 'function'
    ? deps.buildAuthTokenJti
    : buildAuthTokenJti;
  const jti = buildJti({
    randomUUID: deps?.randomUUID,
    getRandomValues: deps?.getRandomValues,
    base64UrlEncode: deps?.base64UrlEncode,
  });
  const payload = {
    sub,
    slug: targetSlug,
    ...(sessionId ? { sessionId } : {}),
    authzEpoch,
    scopes,
    exp,
    jti,
    ...(agentSignIn.claims || {}),
  };

  let token;
  try {
    token = await deps?.signToken?.(payload, env?.TOKEN_HMAC_SECRET);
  } catch (err) {
    return deps?.json?.({ error: err?.message || 'Token signing failed.' }, 500, headers);
  }

  const persistTokenRecord = typeof deps?.persistAuthTokenRecord === 'function'
    ? deps.persistAuthTokenRecord
    : persistAuthTokenRecord;
  try {
    await persistTokenRecord({
      env,
      slug: targetSlug,
      sub,
      jti,
      ttlSeconds: deps?.TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    return deps?.json?.({ error: err?.message || 'Token persistence failed.' }, 500, headers);
  }

  return deps?.json?.({
    token,
    exp,
    sessionSlug: targetSlug,
    ...(sessionId ? { sessionId } : {}),
    ...(agentSignIn.reply || {}),
  }, 200, headers);
};
