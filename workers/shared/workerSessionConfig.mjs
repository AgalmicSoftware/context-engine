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

const normalizeKey = (value) => toStr(value).replace(/[^a-z0-9]/gi, '').toLowerCase();

const isSecretAdjacentKey = (key) => {
  const normalized = normalizeKey(key);
  if (normalized === 'keyprovider') return false;
  if (normalized.startsWith('faucet')) return true;
  if (normalized === 'litcredentials') return true;
  if (normalized === 'rpc' || normalized.includes('rpcurl') || normalized.includes('rpcendpoint')) return true;
  return (
    normalized === 'secrets' ||
    normalized === 'credentials' ||
    normalized.endsWith('apikey') ||
    normalized.endsWith('privatekey') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('token') ||
    normalized.endsWith('password') ||
    normalized.endsWith('jwk')
  );
};

const sanitizePublicValue = (value) => {
  if (Array.isArray(value)) return value.map((entry) => sanitizePublicValue(entry));
  if (!isObj(value)) return value;
  return Object.keys(value).reduce((acc, key) => {
    if (isSecretAdjacentKey(key)) return acc;
    acc[key] = sanitizePublicValue(value[key]);
    return acc;
  }, {});
};

const selectFields = (source, keys) => keys.reduce((acc, key) => {
  if (!Object.prototype.hasOwnProperty.call(source || {}, key)) return acc;
  acc[key] = sanitizePublicValue(source[key]);
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
    if ([
      'apitoken',
      'cloudflareapitoken',
      'cloudflaretoken',
      'cloudflareaccesstoken',
      'cloudflareworkertoken',
    ].includes(normalized)) {
      return `${path}.${key}`;
    }
    const nested = findForbiddenCloudflareDeploymentTokenPath(value[key], `${path}.${key}`);
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
