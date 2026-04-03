export const resolveAnonymousRequestSlug = ({
  request,
  env,
  slugHint,
  deps,
} = {}) => {
  const headerRaw = request?.headers?.get('x-session-slug') ?? request?.headers?.get('x-group-slug');
  const slugContext = deps?.resolveWorkerRequestSlugContext?.({
    headerSlug: headerRaw,
    env,
    slugHint,
    countEmptyHeaderAsExplicit: false,
  }) || { ok: false, error: 'resolveWorkerRequestSlugContext unavailable.' };

  if (!slugContext.ok) {
    return {
      ok: false,
      error: slugContext.error || 'Invalid session slug.',
    };
  }

  return {
    ok: true,
    slug: slugContext.slug,
    explicitSlugProvided: slugContext.explicitSlugProvided,
  };
};
