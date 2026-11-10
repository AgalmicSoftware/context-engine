// The Deploy to Cloudflare template provisions one KV namespace, so it opts in to keeping
// Cloudflare payloads in GROUP_KV. Any other Worker offers that storage only by binding an index.
export const getStorageIndexBinding = (env = {}) =>
  env.CE_STORAGE_INDEX_KV ||
  env.STORAGE_INDEX_KV ||
  env.STORAGE_KV ||
  (env.CE_STORAGE_IN_GROUP_KV === '1' ? env.GROUP_KV : null) ||
  null;

export const getStorageAuditBinding = (env = {}) => env.CE_STORAGE_AUDIT_KV || getStorageIndexBinding(env);
