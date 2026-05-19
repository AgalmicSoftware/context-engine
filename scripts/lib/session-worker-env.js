'use strict';

const SESSION_WORKER_URL_ENV_KEYS = Object.freeze([
  'SESSION_WORKER_URL',
  'SESSION_CORS_WORKER_URL',
  'CE_SESSION_WORKER_BASE_URL',
  'AGENT_BRIDGE_SESSION_WORKER_URL',
  'CORS_WORKER_URL',
]);

const LEGACY_SESSION_WORKER_URL_ENV_KEY = 'WORKER_URL';
const AGENT_BRIDGE_PUBLIC_URL_ENV_KEYS = Object.freeze([
  'AGENT_BRIDGE_PUBLIC_URL',
  'TELEGRAM_AGENT_BRIDGE_URL',
]);

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const toBool = (value) => /^(1|true|yes|y|on)$/i.test(toStr(value).trim());

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

const normalizeUrlForCompare = (value) => normalizeSessionWorkerUrl(value).toLowerCase();

const allowLegacyAgentBridgeWorkerUrl = (env = process.env) => toBool(
  env.E2E_ALLOW_WORKER_URL_AGENT_BRIDGE ||
  env.E2E_WORKER_URL_ALLOW_AGENT_BRIDGE ||
  '',
);

const isAgentBridgeWorkerUrl = (value, env = process.env) => {
  const normalized = normalizeSessionWorkerUrl(value);
  if (!normalized) return false;

  const cmp = normalized.toLowerCase();
  for (const key of AGENT_BRIDGE_PUBLIC_URL_ENV_KEYS) {
    const configured = normalizeUrlForCompare(env?.[key]);
    if (configured && configured === cmp) return true;
  }

  try {
    const parsed = new URL(normalized);
    const haystack = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    return haystack.includes('agent-bridge') || haystack.includes('agentbridge');
  } catch (_) {
    return false;
  }
};

const resolveSessionWorkerUrlEnv = (env = process.env, {
  includeLegacy = true,
} = {}) => {
  const ignored = [];
  const allowAgentBridge = allowLegacyAgentBridgeWorkerUrl(env);

  for (const key of SESSION_WORKER_URL_ENV_KEYS) {
    const url = normalizeSessionWorkerUrl(env?.[key]);
    if (!url) continue;
    if (isAgentBridgeWorkerUrl(url, env) && !allowAgentBridge) {
      ignored.push({ key, url, reason: 'agent-bridge-url' });
      continue;
    }
    return { url, source: key, ignored };
  }

  if (includeLegacy) {
    const legacyUrl = normalizeSessionWorkerUrl(env?.[LEGACY_SESSION_WORKER_URL_ENV_KEY]);
    if (legacyUrl) {
      if (isAgentBridgeWorkerUrl(legacyUrl, env) && !allowAgentBridge) {
        ignored.push({
          key: LEGACY_SESSION_WORKER_URL_ENV_KEY,
          url: legacyUrl,
          reason: 'agent-bridge-url',
        });
      } else {
        return { url: legacyUrl, source: LEGACY_SESSION_WORKER_URL_ENV_KEY, ignored };
      }
    }
  }

  return { url: '', source: '', ignored };
};

const sanitizeSessionWorkerEnv = (env = process.env) => {
  const targetEnv = env || process.env;
  const resolved = resolveSessionWorkerUrlEnv(targetEnv);
  const legacyUrl = normalizeSessionWorkerUrl(targetEnv[LEGACY_SESSION_WORKER_URL_ENV_KEY]);
  const legacyAgentBridgeUrl = (
    legacyUrl &&
    isAgentBridgeWorkerUrl(legacyUrl, targetEnv) &&
    !allowLegacyAgentBridgeWorkerUrl(targetEnv)
  ) ? legacyUrl : '';
  const ignoredLegacy = resolved.ignored.find((entry) => entry.key === LEGACY_SESSION_WORKER_URL_ENV_KEY);
  const agentBridgeFromLegacy = ignoredLegacy?.url || legacyAgentBridgeUrl || '';

  if (agentBridgeFromLegacy) {
    if (!toStr(targetEnv.AGENT_BRIDGE_PUBLIC_URL).trim()) {
      targetEnv.AGENT_BRIDGE_PUBLIC_URL = agentBridgeFromLegacy;
    }
    targetEnv[LEGACY_SESSION_WORKER_URL_ENV_KEY] = '';
  }

  if (resolved.url) {
    if (!toStr(targetEnv.SESSION_WORKER_URL).trim()) {
      targetEnv.SESSION_WORKER_URL = resolved.url;
    }
    if (
      !legacyUrl ||
      agentBridgeFromLegacy ||
      resolved.source !== LEGACY_SESSION_WORKER_URL_ENV_KEY
    ) {
      targetEnv[LEGACY_SESSION_WORKER_URL_ENV_KEY] = resolved.url;
    }
  }

  return resolved;
};

module.exports = {
  AGENT_BRIDGE_PUBLIC_URL_ENV_KEYS,
  LEGACY_SESSION_WORKER_URL_ENV_KEY,
  SESSION_WORKER_URL_ENV_KEYS,
  allowLegacyAgentBridgeWorkerUrl,
  isAgentBridgeWorkerUrl,
  normalizeSessionWorkerUrl,
  resolveSessionWorkerUrlEnv,
  sanitizeSessionWorkerEnv,
};
