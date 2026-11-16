// The Session Agent for someone who isn't signed in: status and one question,
// each naming its session with ?slug=. A visitor is admitted as a first
// sign-in with no memberships would be, so a session that lets only some
// people sign in, or admits only groups or SBT holders to its agent, still
// needs a sign-in. The route itself decides the rest, and bounds the cost.
import { readCurrentSessionConfig } from './sessionConfigAuthority.js';
import { SESSION_AGENT_SIGNED_OUT, dispatchSessionAgentRoute } from './sessionAgentRoute.js';
import { normalizeWorkerSessionSlug } from './sessionSlugResolution.js';
import { resolveWorkerCanonicalLoginScopes } from './workerCanonicalAuthority.js';
import { evaluatePrivateSessionAccess, privateSessionRefusal } from './privateSessionAccess.js';

export const SESSION_AGENT_SIGNED_OUT_PATHS = Object.freeze(['/session-agent/status', '/session-agent/ask']);

const querySlugOf = (request) => {
  try {
    const params = new URL(request.url).searchParams;
    return params.get('sessionSlug') ?? params.get('slug');
  } catch {
    return null;
  }
};

export const dispatchSignedOutSessionAgentRequest = async ({ request, env, path, slugHint, baseHeaders, deps, constants }) => {
  // The page names the session in the query; the resolver reads it from the header.
  const querySlug = querySlugOf(request);
  let slugRequest = request;
  if (querySlug != null && !request.headers.has('x-session-slug')) {
    const headers = new Headers(request.headers);
    headers.set('x-session-slug', querySlug);
    slugRequest = new Request(request.url, { headers });
  }
  const resolved = deps.resolveRequestSlugWithoutToken({ request: slugRequest, env, slugHint });
  if (!resolved?.ok || !resolved.explicitSlugProvided) {
    return deps.json({ error: resolved?.error || constants?.missingSlugError }, 400, baseHeaders);
  }
  const slug = resolved.slug;
  // A Worker pinned to one session answers for it alone.
  if (querySlug != null && normalizeWorkerSessionSlug(querySlug) !== slug) {
    return deps.json({ error: constants?.sessionConfigNotFoundError }, 404, baseHeaders);
  }
  let config;
  try {
    ({ config } = await (deps.readCurrentSessionConfig || readCurrentSessionConfig)({ env, slug, cache: true }));
  } catch (error) {
    return deps.json({ error: error.message }, 503, baseHeaders);
  }
  if (!config) return deps.json({ error: constants?.sessionConfigNotFoundError }, 404, baseHeaders);
  const cors = await deps.getCorsContext({ request, config });
  if (!cors.ok) return cors.response;
  // A private session's agent answers a visitor only if its rule admits them.
  const access = await evaluatePrivateSessionAccess({ env, slug, config, request });
  if (!access.ok) return privateSessionRefusal({ access, json: deps.json, headers: cors.headers });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > SESSION_AGENT_SIGNED_OUT.bodyBytes) {
    return deps.json({ error: 'That is too long to send.' }, 400, cors.headers);
  }
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = null;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return deps.json({ error: 'Send the question as a JSON object.' }, 400, cors.headers);
  }
  // What a first sign-in would be given, when the session's sign-in rule lets
  // anyone in; nothing when it doesn't, and then the route asks for a sign-in.
  let scopes = {};
  try {
    scopes = await resolveWorkerCanonicalLoginScopes({ address: '', config, env, slug, deps });
  } catch {
    scopes = {};
  }
  return (deps.dispatchSessionAgentRoute || dispatchSessionAgentRoute)({
    path, body, config, slug, address: '', env, headers: cors.headers, scopes, deps,
    signedOut: { identity: deps.resolveAnonymousRateIdentity(request) },
  });
};
