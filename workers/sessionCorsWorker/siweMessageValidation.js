import {
  ADMIN_ACTION_DOMAIN,
  ADMIN_ACTION_TYPES,
} from './adminTypedData.mjs';
import { trimIfString, toStr } from './stringCoercion.js';

export {
  ADMIN_ACTION_DOMAIN,
  ADMIN_ACTION_TYPES,
};

export const TRUSTED_ORIGINS = Object.freeze([
  'https://contextengine.sh',
  'https://www.contextengine.sh',
  'https://contextengine.xyz',
  'https://www.contextengine.xyz',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:7391',
  'http://127.0.0.1:7391',
]);

const getSiweFieldValue = (line, prefix) => (
  line.startsWith(prefix) ? line.slice(prefix.length).trim() : null
);

const normalizeOrigin = (value) => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
};

const splitOriginListInput = (value) => {
  const trimmed = toStr(value).trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const coerceOriginListInput = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => splitOriginListInput(entry));
  }
  return splitOriginListInput(value);
};

const resolveConfiguredAdminOrigins = (...configs) => {
  const seen = new Set();
  const out = [];
  configs.forEach((config) => {
    coerceOriginListInput(config?.allowOrigins)
      .map((entry) => normalizeOrigin(entry))
      .filter(Boolean)
      .forEach((entry) => {
        if (seen.has(entry)) return;
        seen.add(entry);
        out.push(entry);
      });
  });
  return out;
};

export const resolveTrustedAdminOrigins = (env) => {
  const raw = toStr(env?.ADMIN_TRUSTED_ORIGINS).trim();
  if (!raw) return [...TRUSTED_ORIGINS];

  const parsed = raw
    .split(/[\s,]+/)
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);

  return parsed.length ? parsed : [...TRUSTED_ORIGINS];
};

export const resolveTrustedLoginOrigins = ({
  env,
  config,
  allowTrustedAdminOrigins = false,
} = {}, deps) => {
  const seen = new Set();
  const out = [];
  const append = (value) => {
    const normalized = normalizeOrigin(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const configuredOrigins = resolveConfiguredAdminOrigins(config);
  configuredOrigins.forEach(append);

  const trustedAdminOrigins = typeof deps?.resolveTrustedAdminOrigins === 'function'
    ? deps.resolveTrustedAdminOrigins(env)
    : resolveTrustedAdminOrigins(env);
  const envLoginOrigins = coerceOriginListInput(env?.LOGIN_TRUSTED_ORIGINS);
  if (envLoginOrigins.length) {
    envLoginOrigins.forEach(append);
  } else {
    trustedAdminOrigins.forEach(append);
  }

  if (allowTrustedAdminOrigins) {
    trustedAdminOrigins.forEach(append);
  }

  return out;
};

export const validateTrustedLoginRequestOrigin = ({
  request,
  env,
  config,
  allowTrustedAdminOrigins = false,
} = {}, deps) => {
  const requestOrigin = normalizeOrigin(
    request?.headers?.get?.('Origin') || request?.headers?.get?.('origin') || ''
  );
  if (!requestOrigin) {
    return { ok: false, error: 'Missing Origin for worker login.' };
  }

  const trustedOrigins = resolveTrustedLoginOrigins({
    env,
    config,
    allowTrustedAdminOrigins,
  }, deps);
  if (!trustedOrigins.includes(requestOrigin)) {
    return { ok: false, error: 'Untrusted worker login origin.' };
  }

  return {
    ok: true,
    origin: requestOrigin,
  };
};

export const validateBrowserLoginOrigin = ({
  request,
  siwe,
  env,
  config,
} = {}, deps) => {
  const requestOriginCheck = validateTrustedLoginRequestOrigin({
    request,
    env,
    config,
  }, deps);
  if (!requestOriginCheck?.ok) return requestOriginCheck;
  const requestOrigin = requestOriginCheck.origin;

  let siweOrigin = '';
  try {
    siweOrigin = normalizeOrigin(siwe?.uri);
  } catch {
    siweOrigin = '';
  }
  if (!siweOrigin) {
    return { ok: false, error: 'Invalid SIWE uri.' };
  }
  if (siweOrigin !== requestOrigin) {
    return { ok: false, error: 'SIWE uri origin does not match request Origin.' };
  }

  return {
    ok: true,
    origin: requestOrigin,
  };
};

export const validateAdminActionAudience = ({
  audience,
  request,
  env,
  config,
  initializingConfig,
} = {}, deps) => {
  const normalizedAudience = normalizeOrigin(audience);
  if (!normalizedAudience) {
    return { ok: false, error: 'Invalid admin audience.' };
  }

  const requestOrigin = normalizeOrigin(
    request?.headers?.get?.('Origin') || request?.headers?.get?.('origin') || ''
  );
  if (requestOrigin && requestOrigin !== normalizedAudience) {
    return { ok: false, error: 'Admin audience does not match request origin.' };
  }

  const trustedOrigins = (
    typeof deps?.resolveTrustedAdminOrigins === 'function'
      ? deps.resolveTrustedAdminOrigins(env)
      : resolveTrustedAdminOrigins(env)
  )
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);
  const configuredOrigins = resolveConfiguredAdminOrigins(
    config,
    initializingConfig,
  );

  const workerOrigin = normalizeOrigin(request?.url || env?.WORKER_URL || '');
  if (
    !trustedOrigins.includes(normalizedAudience) &&
    !configuredOrigins.includes(normalizedAudience) &&
    (!workerOrigin || workerOrigin !== normalizedAudience)
  ) {
    return { ok: false, error: 'Untrusted admin audience.' };
  }

  return {
    ok: true,
    audience: normalizedAudience,
  };
};

export const parseSiweMessage = (message) => {
  const text = toStr(message);
  const lines = text.split('\n').map((line) => trimIfString(line));
  const firstLine = lines[0] || '';
  const domainMatch = firstLine.match(/^(.*) wants you to sign in with your Ethereum account:/);
  const domain = domainMatch ? trimIfString(domainMatch[1]) || '' : '';
  const address = lines[1] || '';

  const fields = {};
  lines.forEach((line) => {
    const uri = getSiweFieldValue(line, 'URI:');
    if (uri != null) fields.uri = uri;

    const version = getSiweFieldValue(line, 'Version:');
    if (version != null) fields.version = version;

    const chainId = getSiweFieldValue(line, 'Chain ID:');
    if (chainId != null) fields.chainId = chainId;

    const nonce = getSiweFieldValue(line, 'Nonce:');
    if (nonce != null) fields.nonce = nonce;

    const issuedAt = getSiweFieldValue(line, 'Issued At:');
    if (issuedAt != null) fields.issuedAt = issuedAt;

    const expirationTime = getSiweFieldValue(line, 'Expiration Time:');
    if (expirationTime != null) fields.expirationTime = expirationTime;
  });

  return {
    domain,
    address,
    uri: fields.uri || '',
    chainId: fields.chainId || '',
    nonce: fields.nonce || '',
    issuedAt: fields.issuedAt || '',
    expirationTime: fields.expirationTime || '',
  };
};

export const validateSiwe = (siwe, deps) => {
  if (!siwe.domain) return { ok: false, error: 'Missing SIWE domain.' };
  if (!siwe.uri) return { ok: false, error: 'Missing SIWE uri.' };
  if (!siwe.chainId) return { ok: false, error: 'Missing SIWE chainId.' };
  if (!siwe.nonce) return { ok: false, error: 'Missing SIWE nonce.' };

  try {
    const uri = new URL(siwe.uri);
    if (uri.host !== siwe.domain) {
      return { ok: false, error: 'SIWE domain does not match URI host.' };
    }
  } catch {
    return { ok: false, error: 'Invalid SIWE uri.' };
  }

  if (siwe.expirationTime) {
    const expMs = Date.parse(siwe.expirationTime);
    if (!Number.isFinite(expMs)) return { ok: false, error: 'Invalid SIWE expiration time.' };

    const now = typeof deps?.now === 'function' ? deps.now : Date.now;
    if (now() >= expMs) return { ok: false, error: 'SIWE message expired.' };
  }

  if (deps?.requireIssuedAt) {
    if (!siwe.issuedAt) return { ok: false, error: 'Missing SIWE issuedAt.' };

    const issuedMs = Date.parse(siwe.issuedAt);
    if (!Number.isFinite(issuedMs)) return { ok: false, error: 'Invalid SIWE issuedAt.' };

    const now = typeof deps?.now === 'function' ? deps.now : Date.now;
    const nowMs = now();
    const maxAgeMs = Number.isFinite(Number(deps?.maxIssuedAtAgeMs))
      ? Math.max(0, Number(deps.maxIssuedAtAgeMs))
      : 5 * 60 * 1000;
    const futureSkewMs = Number.isFinite(Number(deps?.issuedAtFutureSkewMs))
      ? Math.max(0, Number(deps.issuedAtFutureSkewMs))
      : 60 * 1000;

    if (issuedMs > nowMs + futureSkewMs) {
      return { ok: false, error: 'SIWE issuedAt is too far in the future.' };
    }
    if (nowMs - issuedMs > maxAgeMs) {
      return { ok: false, error: 'SIWE message is too old.' };
    }
  }

  return { ok: true };
};
