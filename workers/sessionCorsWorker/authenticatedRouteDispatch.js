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
    limit,
  } = authenticatedContext || {};

  const secretPathRoute = await deps?.dispatchAuthenticatedSecretPathRoute?.({
    path,
    method,
    request,
    config,
    slug,
    address,
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

  const nonSecretActionRoute = await deps?.dispatchAuthenticatedNonSecretActionRoute?.({
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
