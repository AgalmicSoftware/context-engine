import {
  DEFAULT_ALLOWED_ORIGINS,
  DEPLOY_HELPER_ORIGINS_KEY,
  normalizeOriginList,
  parseAllowList,
  parseStoredAllowList,
} from './deployHelperCore.mjs';

export const resolveDeployHelperAllowList = async (env) => {
  const kv = env?.DEPLOY_HELPER_KV;
  if (kv && typeof kv.get === 'function') {
    const stored = await kv.get(DEPLOY_HELPER_ORIGINS_KEY);
    const storedOrigins = parseStoredAllowList(stored);
    if (storedOrigins.length) {
      return { origins: storedOrigins, source: 'kv' };
    }
  }

  const envOrigins = parseAllowList(env?.ALLOWED_ORIGINS);
  if (envOrigins.length) {
    return { origins: envOrigins, source: 'env' };
  }

  return { origins: normalizeOriginList(DEFAULT_ALLOWED_ORIGINS), source: 'default' };
};

export const resolveDeployHelperFallbackAllowList = (env) => {
  const envOrigins = parseAllowList(env?.ALLOWED_ORIGINS);
  if (envOrigins.length) return envOrigins;
  return normalizeOriginList(DEFAULT_ALLOWED_ORIGINS);
};
