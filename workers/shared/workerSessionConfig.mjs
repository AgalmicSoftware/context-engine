const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const PUBLIC_CONFIG_KEYS = Object.freeze([
  'slug',
  'sessionId',
  'sessionIdHex',
  'configRevision',
  'sessionName',
  'sessionInfo',
  'sessionHeaderImg',
  'adminAddress',
  'adminAddresses',
  'corsWorkerUrl',
  'allowOrigins',
  'sessionModeProfile',
  'workerAuthority',
  'storageProfile',
  'ai',
  'limits',
  'scopes',
  'blockLimits',
  'contracts',
  'registryChainId',
  'networkChainId',
  'embeddedDeployHelperEnabled',
]);

const DEPLOY_CANONICAL_CONFIG_KEYS = Object.freeze([
  'sessionId',
  'sessionIdHex',
  'configRevision',
  'sessionName',
  'sessionInfo',
  'sessionHeaderImg',
  'sessionModeProfile',
  'workerAuthority',
  'ai',
  'contracts',
]);

const OPEN_CONFIG_SUBTREE_KEYS = Object.freeze([
  'ai',
  'contracts',
  'limits',
  'scopes',
  'sessionModeProfile',
  'storageProfile',
  'workerAuthority',
]);

const normalizeKey = (value) => toStr(value).replace(/[^a-z0-9]/gi, '').toLowerCase();
const OMIT_PUBLIC_VALUE = Symbol('omit-public-worker-config-value');
const SAFE_PUBLIC_KEY_FIELD_NAMES = new Set(['keyprovider', 'publickey', 'resourcekey']);
const TOP_LEVEL_PROVIDER_KEY_NAMES = new Set([
  'aikey',
  'anthropickey',
  'geminikey',
  'googleaikey',
  'groqkey',
  'mistralkey',
  'openaikey',
  'openrouterkey',
]);
const hasSensitiveTokenValue = (value) => {
  if (value == null || value === false) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

const isSecretAdjacentKey = (key, value) => {
  const normalized = normalizeKey(key);
  if (SAFE_PUBLIC_KEY_FIELD_NAMES.has(normalized)) return false;
  if (normalized.startsWith('exposes') && typeof value === 'boolean') return false;
  if (normalized.startsWith('faucet')) return true;
  if (normalized === 'litcredentials') return true;
  if (normalized === 'rpc' || normalized.includes('rpcurl') || normalized.includes('rpcendpoint')) return true;
  return (
    normalized === 'auth' ||
    normalized === 'authorizationheader' ||
    normalized === 'credential' ||
    normalized === 'headers' ||
    normalized === 'key' ||
    normalized === 'secrets' ||
    normalized === 'credentials' ||
    normalized.endsWith('apikey') ||
    normalized.endsWith('key') ||
    normalized.endsWith('privatekey') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('token') ||
    normalized.endsWith('password') ||
    normalized.endsWith('jwk')
  );
};

const hasUrlCredentials = (value) => {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) return false;
  try {
    const parsed = new URL(value);
    return !!parsed.username || !!parsed.password;
  } catch {
    return false;
  }
};

const sanitizePublicValue = (value) => {
  if (hasUrlCredentials(value)) return OMIT_PUBLIC_VALUE;
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizePublicValue(entry))
      .filter((entry) => entry !== OMIT_PUBLIC_VALUE);
  }
  if (!isObj(value)) return value;
  return Object.keys(value).reduce((acc, key) => {
    if (isSecretAdjacentKey(key, value[key])) return acc;
    const sanitized = sanitizePublicValue(value[key]);
    if (sanitized !== OMIT_PUBLIC_VALUE) acc[key] = sanitized;
    return acc;
  }, {});
};

const projectPublicAiConfig = (value) => {
  const ai = isObj(value) ? value : {};
  return selectFields(ai, ['models']);
};

const selectFields = (source, keys) => keys.reduce((acc, key) => {
  if (!Object.prototype.hasOwnProperty.call(source || {}, key)) return acc;
  const sanitized = key === 'ai' ? projectPublicAiConfig(source[key]) : sanitizePublicValue(source[key]);
  if (sanitized !== OMIT_PUBLIC_VALUE) acc[key] = sanitized;
  return acc;
}, {});

export const findForbiddenCloudflareDeploymentTokenPath = (value, path = 'config') => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findForbiddenCloudflareDeploymentTokenPath(value[index], `${path}.${index}`);
      if (nested) return nested;
    }
    return '';
  }
  if (!isObj(value)) return '';
  for (const key of Object.keys(value)) {
    const normalized = normalizeKey(key);
    const normalizedPath = normalizeKey(path);
    const isCloudflareContext = normalizedPath.includes('cloudflare') || normalized.startsWith('cloudflare');
    const isCloudflareTokenAlias = (
      ['apitoken', 'cfapitoken', 'cloudflareapitoken', 'cloudflaretoken', 'cloudflareaccesstoken',
        'cloudflareworkertoken'].includes(normalized) ||
      (isCloudflareContext && normalized.endsWith('token'))
    );
    if (isCloudflareTokenAlias && hasSensitiveTokenValue(value[key])) {
      return `${path}.${key}`;
    }
    const nested = findForbiddenCloudflareDeploymentTokenPath(value[key], `${path}.${key}`);
    if (nested) return nested;
  }
  return '';
};

const findForbiddenOpenConfigSecretPath = (value, path) => {
  if (hasUrlCredentials(value)) return path;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findForbiddenOpenConfigSecretPath(value[index], `${path}.${index}`);
      if (nested) return nested;
    }
    return '';
  }
  if (!isObj(value)) return '';
  for (const key of Object.keys(value)) {
    if (isSecretAdjacentKey(key, value[key])) return `${path}.${key}`;
    const nested = findForbiddenOpenConfigSecretPath(value[key], `${path}.${key}`);
    if (nested) return nested;
  }
  return '';
};

export const findForbiddenWorkerConfigSecretPath = (config, path = 'config') => {
  const source = isObj(config) ? config : {};
  for (const key of Object.keys(source)) {
    if (TOP_LEVEL_PROVIDER_KEY_NAMES.has(normalizeKey(key))) return `${path}.${key}`;
  }
  for (const key of OPEN_CONFIG_SUBTREE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const nested = findForbiddenOpenConfigSecretPath(source[key], `${path}.${key}`);
    if (nested) return nested;
  }
  return '';
};

export const projectPublicWorkerSessionConfig = (config) => (
  selectFields(isObj(config) ? config : {}, PUBLIC_CONFIG_KEYS)
);

export const selectDeployWorkerSessionConfigFields = (body) => (
  selectFields(isObj(body) ? body : {}, DEPLOY_CANONICAL_CONFIG_KEYS)
);

export const sanitizeWorkerConfigOpenSubtree = (value) => {
  const sanitized = sanitizePublicValue(value);
  return sanitized === OMIT_PUBLIC_VALUE ? {} : sanitized;
};
