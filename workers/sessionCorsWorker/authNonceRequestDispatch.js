export const dispatchAuthNonceRequest = async ({
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

  const address = (deps?.toStr?.(body?.address) ?? '').trim();
  if (!address || !deps?.isAddress?.(address)) {
    return deps?.json?.({ error: 'Invalid address.' }, 400, baseHeaders);
  }

  const slugContext = deps?.resolveWorkerBodySlugContext?.({ body, env, slugHint: slug }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugContext?.ok) {
    return deps?.json?.({ error: slugContext?.error }, 400, baseHeaders);
  }

  const explicitSlugProvided = slugContext?.explicitSlugProvided === true || !!slugContext?.targetSlug;
  const targetSlug = slugContext?.targetSlug ?? '';
  if (!explicitSlugProvided) {
    return deps?.json?.({ error: deps?.MISSING_SLUG_ERROR }, 400, baseHeaders);
  }

  // Regression guard: admin repair flows still need a nonce even when the
  // session allowlist has drifted away from the trusted admin UI origin.
  const allowTrustedAdminAuthOrigin = body?.adminAction === true;
  const corsState = await deps?.resolveExistingSessionCors?.({
    request,
    env,
    slug: targetSlug,
    baseHeaders,
    allowTrustedAdminAuthOrigin,
  });
  if (!corsState?.ok) return corsState?.response;
  const headers = corsState.headers;

  const nonce = deps?.buildNonce?.();
  const key = `nonce:${targetSlug}:${address.toLowerCase()}`;
  await deps?.putNonce?.(env, key, nonce, deps?.NONCE_TTL_SECONDS);

  return deps?.json?.({ nonce }, 200, headers);
};
