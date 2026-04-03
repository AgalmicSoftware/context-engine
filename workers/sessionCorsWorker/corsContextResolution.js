export const getCorsContext = ({
  request,
  config,
  deps,
} = {}) => {
  const origin = request?.headers?.get('Origin');
  const allowList = deps?.parseAllowOrigins?.(config?.allowOrigins) ?? null;
  const headers = deps?.corsHeaders?.(origin, allowList);
  if (!deps?.originAllowed?.(origin, allowList)) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Origin not allowed.' }, 403, headers),
      headers,
    };
  }

  return {
    ok: true,
    headers,
  };
};
