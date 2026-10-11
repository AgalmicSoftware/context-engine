import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import {
  ADMIN_ACTION_DOMAIN,
  ADMIN_ACTION_TYPES,
} from './adminTypedData.mjs';
import { toStr } from './stringCoercion.js';

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

export const validateBrowserLoginOrigin = ({ request, siwe, env, config } = {}, deps) => {
  const requestOriginCheck = validateTrustedLoginRequestOrigin(
    {
  request,
  env,
  config,
    },
    deps,
  );
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

const SIWE_HEADER_SUFFIX = ' wants you to sign in with your Ethereum account:';
const SIWE_DOMAIN_RE = /^(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;
const SIWE_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
// EIP-4361 statement characters: RFC 3986 reserved and unreserved, and space.
const SIWE_STATEMENT_RE = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;= ]+$/;
const SIWE_VALUE_RE = /^\S+$/;
const SIWE_REQUIRED_FIELDS = Object.freeze([
  ['URI: ', 'uri'],
  ['Version: ', 'version'],
  ['Chain ID: ', 'chainId'],
  ['Nonce: ', 'nonce'],
  ['Issued At: ', 'issuedAt'],
]);
const SIWE_OPTIONAL_FIELDS = Object.freeze([
  ['Expiration Time: ', 'expirationTime'],
  ['Not Before: ', 'notBefore'],
  ['Request ID: ', 'requestId'],
]);

const malformedSiwe = (detail) => ({
  domain: '',
  address: '',
  uri: '',
  chainId: '',
  nonce: '',
  issuedAt: '',
  expirationTime: '',
  error: `Malformed SIWE message: ${detail}.`,
});

// Strict EIP-4361: every line in its fixed place, no duplicate or unknown
// lines. Wallets then recognize anything accepted here as a sign-in request
// and can warn about a mismatched domain.
export const parseSiweMessage = (message) => {
  const text = toStr(message);
  if (text.includes('\r')) return malformedSiwe('line breaks must be LF');
  const lines = text.split('\n');
  const header = lines[0] || '';
  const domain = header.endsWith(SIWE_HEADER_SUFFIX) ? header.slice(0, -SIWE_HEADER_SUFFIX.length) : '';
  if (!SIWE_DOMAIN_RE.test(domain)) return malformedSiwe('missing or invalid header');
  const address = lines[1] || '';
  if (!SIWE_ADDRESS_RE.test(address)) return malformedSiwe('invalid address line');
  if (lines[2] !== '') return malformedSiwe('expected a blank line after the address');
  let index = 3;
  let statement;
  if (lines[index] !== '') {
    statement = lines[index] || '';
    if (!SIWE_STATEMENT_RE.test(statement)) return malformedSiwe('invalid statement');
    index += 1;
  }
  if (lines[index] !== '') return malformedSiwe('expected a blank line before URI');
  index += 1;

  const fields = {};
  const readField = ([prefix, key]) => {
    const line = lines[index];
    if (typeof line !== 'string' || !line.startsWith(prefix)) return false;
    const value = line.slice(prefix.length);
    if (!SIWE_VALUE_RE.test(value)) return false;
    fields[key] = value;
    index += 1;
    return true;
  };
  const missing = SIWE_REQUIRED_FIELDS.find((field) => !readField(field));
  if (missing) return malformedSiwe(`expected ${missing[0].trim()} in order`);
  SIWE_OPTIONAL_FIELDS.forEach(readField);

  let resources;
  if (lines[index] === 'Resources:') {
    resources = [];
    index += 1;
    while (index < lines.length && lines[index].startsWith('- ')) {
      const resource = lines[index].slice(2);
      if (!SIWE_VALUE_RE.test(resource)) return malformedSiwe('invalid resource');
      resources.push(resource);
      index += 1;
    }
  }
  if (index !== lines.length) return malformedSiwe('unexpected or repeated line');
  if (fields.version !== '1') return malformedSiwe('unsupported version');
  if (!/^\d+$/.test(fields.chainId)) return malformedSiwe('invalid chain ID');

  return {
    domain,
    address,
    ...(statement === undefined ? {} : { statement }),
    uri: fields.uri,
    chainId: fields.chainId,
    nonce: fields.nonce,
    issuedAt: fields.issuedAt,
    expirationTime: fields.expirationTime || '',
    ...(fields.notBefore ? { notBefore: fields.notBefore } : {}),
    ...(fields.requestId ? { requestId: fields.requestId } : {}),
    ...(resources === undefined ? {} : { resources }),
  };
};

export const validateSiwe = (siwe, deps) => {
  if (siwe?.error) return { ok: false, error: siwe.error };
  if (!siwe?.domain) return { ok: false, error: 'Missing SIWE domain.' };
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

  if (siwe.notBefore) {
    const notBeforeMs = Date.parse(siwe.notBefore);
    if (!Number.isFinite(notBeforeMs)) return { ok: false, error: 'Invalid SIWE not-before time.' };

    const now = typeof deps?.now === 'function' ? deps.now : Date.now;
    if (now() < notBeforeMs) return { ok: false, error: 'SIWE message is not valid yet.' };
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

// Check signed destinations before consuming nonces. Keep no-Resources clients
// compatible during rollout; present Resources must bind both boundaries.
export const validateSiweResources = ({ siwe, request, config, targetSlug } = {}) => {
  if (siwe?.resources === undefined) return { ok: true };
  const workerOrigin = normalizeOrigin(request?.url);
  const canonical = toStr(config?.sessionModeProfile?.authority?.mode).trim().toLowerCase() === 'worker_canonical';
  const sessionId = resolveCanonicalWorkerSessionIdHex(config);
  const slug = toStr(targetSlug).trim().toLowerCase();
  const sessionResource = canonical
    ? `urn:context-engine:session:id:${encodeURIComponent(sessionId)}`
    : `urn:context-engine:session:slug:${encodeURIComponent(slug === 'general' ? '' : slug)}`;
  const resources = siwe.resources;
  if (!workerOrigin || (canonical && !sessionId) || !Array.isArray(resources) || resources.length !== 2 ||
      !resources.includes(workerOrigin) || !resources.includes(sessionResource)) {
    return { ok: false, error: 'Signed login resources do not match this Worker and session.' };
  }
  return { ok: true };
};
