export const AUTHORIZATION_EPOCH_KEY = 'authzEpoch';

const RESOURCE_GATE_BY_SCOPE = Object.freeze({
  ai: 'ai',
  arweave: 'arweave',
  faucet: 'txGas',
  fetch: 'rpc',
  groups: 'default',
  lit: 'lit',
  storage: 'arweave',
  transcribe: 'ai',
});

export const normalizeAuthorizationEpoch = (value) => {
  if (value == null) return 0;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
};

export const readAuthorizationEpoch = (config) => (
  normalizeAuthorizationEpoch(config?.[AUTHORIZATION_EPOCH_KEY])
);

export const incrementAuthorizationEpoch = (config) => {
  const current = readAuthorizationEpoch(config);
  if (current === null || current >= Number.MAX_SAFE_INTEGER) return null;
  return current + 1;
};

export const selectResourceGateKeysForScopes = (resourceKeys, requestedScopes) => {
  const keys = Array.isArray(resourceKeys) ? resourceKeys : [];
  if (!Array.isArray(requestedScopes) || requestedScopes.length === 0) return keys;
  const required = new Set(['default']);
  requestedScopes.forEach((scope) => {
    const resourceKey = RESOURCE_GATE_BY_SCOPE[String(scope || '').trim().toLowerCase()];
    if (resourceKey) required.add(resourceKey);
  });
  return keys.filter((key) => required.has(key));
};
