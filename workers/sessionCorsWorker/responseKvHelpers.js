export const json = (data, status, baseHeaders) => {
  const headers = new Headers(baseHeaders);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { status, headers });
};

export const getKvJson = async (env, key) => {
  const raw = await env.GROUP_KV.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const putKvJson = async (env, key, value, ttlSeconds) => {
  const opts = ttlSeconds ? { expirationTtl: ttlSeconds } : {};
  await env.GROUP_KV.put(key, JSON.stringify(value), opts);
};
