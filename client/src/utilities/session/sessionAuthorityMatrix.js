/**
 * @module sessionAuthorityMatrix
 * @description Canonical authority rules for session config resolution across registry, metadata,
 *              worker config, browser overrides, and cache replicas.
 *
 * Key exports: AUTHORITY_SOURCES, AUTHORITY_MATRIX, isDemoSourceAllowed
 */
const deepFreeze = (value) => {
  if (!value || typeof value !== 'object') return value;
  Object.getOwnPropertyNames(value).forEach((key) => {
    const next = value[key];
    if (next && typeof next === 'object' && !Object.isFrozen(next)) {
      deepFreeze(next);
    }
  });
  return Object.freeze(value);
};

export const AUTHORITY_SOURCES = Object.freeze({
  REGISTRY: 'registry',
  ARWEAVE: 'arweave',
  WORKER_KV: 'worker-kv',
  WORKER_SECRETS: 'worker-secrets',
  BROWSER: 'browser',
  DEMO: 'demo',
  CACHE: 'cache',
});

export const AUTHORITY_MATRIX = deepFreeze({
  identity: {
    fields: ['slug', 'sessionId', 'metadataURI', 'chainId'],
    authoritativeSource: AUTHORITY_SOURCES.REGISTRY,
    allowedFallbacks: [AUTHORITY_SOURCES.DEMO],
    mustNotOverride: [
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.BROWSER,
      AUTHORITY_SOURCES.CACHE,
    ],
  },
  gates: {
    fields: ['sponsored', 'gates'],
    authoritativeSource: AUTHORITY_SOURCES.REGISTRY,
    allowedFallbacks: [],
    mustNotOverride: [
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.BROWSER,
      AUTHORITY_SOURCES.DEMO,
      AUTHORITY_SOURCES.CACHE,
    ],
  },
  textMetadata: {
    fields: ['sessionName', 'sessionInfo', 'tags', 'ai', 'lit', 'encryption'],
    authoritativeSource: AUTHORITY_SOURCES.ARWEAVE,
    allowedFallbacks: [AUTHORITY_SOURCES.DEMO, AUTHORITY_SOURCES.CACHE],
    mustNotOverride: [AUTHORITY_SOURCES.BROWSER],
  },
  workerConfig: {
    fields: ['corsWorkerUrl', 'allowOrigins', 'limits', 'rpcEndpoint'],
    authoritativeSource: AUTHORITY_SOURCES.WORKER_KV,
    allowedFallbacks: [],
    mustNotOverride: [
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.BROWSER,
      AUTHORITY_SOURCES.DEMO,
      AUTHORITY_SOURCES.CACHE,
    ],
  },
  secrets: {
    fields: ['arweaveJwk', 'apiKey', 'privateKey', 'litPayerPrivateKey', 'litPayerAddress', 'litCredentials'],
    authoritativeSource: AUTHORITY_SOURCES.WORKER_SECRETS,
    allowedFallbacks: [AUTHORITY_SOURCES.BROWSER],
    mustNotOverride: [
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.DEMO,
      AUTHORITY_SOURCES.CACHE,
    ],
  },
  localPreferences: {
    fields: [
      'rpc.useLocal',
      'rpc.apiKey',
      'arweave.useLocal',
      'arweave.jwk',
      'faucet.useLocal',
      'faucet.privateKey',
    ],
    authoritativeSource: AUTHORITY_SOURCES.BROWSER,
    allowedFallbacks: [],
    mustNotOverride: [
      AUTHORITY_SOURCES.REGISTRY,
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.WORKER_KV,
      AUTHORITY_SOURCES.WORKER_SECRETS,
      AUTHORITY_SOURCES.DEMO,
      AUTHORITY_SOURCES.CACHE,
    ],
  },
  cacheReplica: {
    fields: ['__fromCache'],
    authoritativeSource: null,
    allowedFallbacks: [],
    mustNotOverride: [
      AUTHORITY_SOURCES.REGISTRY,
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.WORKER_KV,
      AUTHORITY_SOURCES.WORKER_SECRETS,
      AUTHORITY_SOURCES.BROWSER,
      AUTHORITY_SOURCES.DEMO,
    ],
  },
});

export const isDemoSourceAllowed = (fieldGroup, mode) => {
  if (mode !== 'demo' && mode !== 'off-chain') return false;
  const group = AUTHORITY_MATRIX[fieldGroup];
  if (!group || !Array.isArray(group.allowedFallbacks)) return false;
  return group.allowedFallbacks.includes(AUTHORITY_SOURCES.DEMO);
};
