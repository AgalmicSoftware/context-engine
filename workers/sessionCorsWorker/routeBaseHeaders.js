export const getRouteBaseHeaders = ({
  request,
  deps,
} = {}) => {
  const origin = request?.headers?.get?.('Origin') ?? null;
  return deps?.corsHeaders?.(origin, null);
};
