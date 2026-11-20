import { agentParticipationOn } from '../../shared/agentSignIn.mjs';
import { saysItIsAnAgent } from './agentSignInLink.js';
import { SESSION_AGENT_PATHS } from './sessionAgentRoute.js';
import { evaluatePrivateSessionAccess, privateSessionRefusal } from './privateSessionAccess.js';

// Every path a signed-in request other than a POST can reach. A POST may carry
// its action in the body to any path, so only POSTs reach sign-in unrouted.
export const NON_POST_PATHS = new Set([
  '/health', '/ai', '/lit/chipotle-action',
  '/storage/read', '/storage/list', '/storage/export-envelopes',
  '/groups/my-memberships', '/groups/members', '/groups/list',
  ...SESSION_AGENT_PATHS,
]);

// What a private session lets someone signed in reach without its rule
// admitting them: storage reads and uploads, which hold each request to the
// rule themselves; joining or leaving a group by its id; and the switches over
// their own answers and drafts, which stay theirs after they lose access. Its
// group list stays behind the rule, as it does signed out. Each is routed by
// its path in every method that gets this far, never by an action in a body.
const OPEN_TO_NON_MEMBERS = new Set([
  '/storage/read', '/storage/list', '/storage/read-batch', '/storage/upload',
  '/groups/my-memberships', '/groups/join', '/groups/leave',
  '/session-agent/opt-out', '/session-agent/attribution', '/storage/draft-text/delete',
]);

export const dispatchAuthenticatedRouteEntry = async ({
  path,
  method,
  request,
  env,
  baseHeaders,
  deps,
} = {}) => {
  // No route at all is the same answer signed in or not, so it needs no sign-in.
  if (method !== 'POST' && !NON_POST_PATHS.has(path)) {
    return deps?.json?.({ error: 'Not found.' }, 404, baseHeaders);
  }
  const auth = await deps?.requireAuth?.({ request, env, baseHeaders });
  if (!auth?.ok) return auth?.response;

  if (path === '/health') {
    return deps?.json?.({ ok: true, ts: deps?.now?.() ?? Date.now() }, 200, baseHeaders);
  }

  const authenticatedContext = await deps?.resolveAuthenticatedRouteContext?.({
    request,
    env,
    auth,
    baseHeaders,
  });
  if (!authenticatedContext?.ok) return authenticatedContext?.response;
  // A session with AI agents off answers no signed-in request that says it is an agent's, whenever it signed in.
  if (!agentParticipationOn(authenticatedContext.config) && saysItIsAnAgent(request) && authenticatedContext.scopes?.admin !== true) {
    return deps?.json?.(
      { error: 'This session has AI agents switched off.', reason: 'agent_participation_off' }, 403, authenticatedContext.headers,
    );
  }
  if (!OPEN_TO_NON_MEMBERS.has(path)) {
    const { config, slug, address, scopes, headers } = authenticatedContext;
    const access = await evaluatePrivateSessionAccess({ env, slug, config, request, requesterAddress: address, authScopes: scopes });
    if (!access.ok) return privateSessionRefusal({ access, json: deps?.json, headers });
  }

  return deps?.dispatchAuthenticatedRoute?.({
    path,
    method,
    request,
    authenticatedContext,
  });
};
