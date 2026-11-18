import { SESSION_AGENT_PATHS } from './sessionAgentRoute.js';
import { FEEDBACK_PATH } from './sessionFeedbackRoute.js';
import { SET_NAME_PATH } from './sessionNames.js';
import { ANALYSIS_CARD_PICTURE_PATH } from './analysisCardPictureRoute.js';
import { ANALYSIS_CARD_SAVED_PATHS } from './analysisCardSavedRoute.js';

// Paths that answer for their own request, whatever action a body names: a
// private session opens some of them to people its rule doesn't admit.
const PATH_OWNED = new Set([...SESSION_AGENT_PATHS, FEEDBACK_PATH, SET_NAME_PATH, ANALYSIS_CARD_PICTURE_PATH]);
for (const path of ANALYSIS_CARD_SAVED_PATHS) PATH_OWNED.add(path);

export const dispatchAuthenticatedRoute = async ({
  path,
  method,
  request,
  authenticatedContext,
  deps,
} = {}) => {
  const {
    slug,
    config,
    headers,
    scopes,
    address,
    expectedAuthority,
    limit,
  } = authenticatedContext || {};

  const secretPathRoute = await deps?.dispatchAuthenticatedSecretPathRoute?.({
    path,
    method,
    request,
    config,
    slug,
    address,
    expectedAuthority,
    limit,
    headers,
    scopes,
  });
  if (secretPathRoute?.handled) return secretPathRoute.response;

  let body = null;
  let action = '';
  if (method === 'POST') {
    const authenticatedAction = await deps?.readAuthenticatedActionPayload?.({ request });
    if (!authenticatedAction?.ok) {
      return deps?.json?.(
        { error: authenticatedAction?.error },
        authenticatedAction?.status || 400,
        headers,
      );
    }
    body = authenticatedAction.payload;
    action = authenticatedAction.action;
  }

  const nonSecretActionRoute = PATH_OWNED.has(path) ? null : await deps?.dispatchAuthenticatedNonSecretActionRoute?.({
    action,
    body,
    config,
    slug,
    address,
    limit,
    headers,
    scopes,
  });
  if (nonSecretActionRoute?.handled) return nonSecretActionRoute.response;

  const secretActionRoute = await deps?.dispatchAuthenticatedSecretActionRoute?.({
    path,
    action,
    body,
    config,
    slug,
    address,
    limit,
    headers,
    scopes,
  });
  if (secretActionRoute?.handled) return secretActionRoute.response;

  return deps?.json?.({ error: 'Not found.' }, 404, headers);
};
