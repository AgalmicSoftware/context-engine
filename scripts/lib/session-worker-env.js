'use strict';

const SESSION_WORKER_URL_ENV_KEYS = Object.freeze([
  'SESSION_WORKER_URL',
  'SESSION_CORS_WORKER_URL',
  'CE_SESSION_WORKER_BASE_URL',
  'CORS_WORKER_URL',
]);

const LEGACY_SESSION_WORKER_URL_ENV_KEY = 'WORKER_URL';

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const normalizeSessionWorkerUrl = (value) => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return pathname && pathname !== '/'
      ? `${parsed.origin}${pathname}`
      : parsed.origin;
  } catch (_) {
    return '';
  }
};

const resolveSessionWorkerUrlEnv = (env = process.env, {
  includeLegacy = true,
} = {}) => {
  for (const key of SESSION_WORKER_URL_ENV_KEYS) {
    const url = normalizeSessionWorkerUrl(env?.[key]);
    if (url) return { url, source: key };
  }

  if (includeLegacy) {
    const legacyUrl = normalizeSessionWorkerUrl(env?.[LEGACY_SESSION_WORKER_URL_ENV_KEY]);
    if (legacyUrl) return { url: legacyUrl, source: LEGACY_SESSION_WORKER_URL_ENV_KEY };
  }

  return { url: '', source: '' };
};

const sanitizeSessionWorkerEnv = (env = process.env) => {
  const targetEnv = env || process.env;
  const resolved = resolveSessionWorkerUrlEnv(targetEnv);

  if (resolved.url) {
    if (!toStr(targetEnv.SESSION_WORKER_URL).trim()) {
      targetEnv.SESSION_WORKER_URL = resolved.url;
    }
    if (resolved.source !== LEGACY_SESSION_WORKER_URL_ENV_KEY) {
      targetEnv[LEGACY_SESSION_WORKER_URL_ENV_KEY] = resolved.url;
    }
  }

  return resolved;
};

module.exports = {
  LEGACY_SESSION_WORKER_URL_ENV_KEY,
  SESSION_WORKER_URL_ENV_KEYS,
  normalizeSessionWorkerUrl,
  resolveSessionWorkerUrlEnv,
  sanitizeSessionWorkerEnv,
};
