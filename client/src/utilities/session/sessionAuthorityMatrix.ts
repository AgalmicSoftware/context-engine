/**
 * @module sessionAuthorityMatrix
 * @description Canonical authority rules for session config resolution across registry, metadata,
 *              worker config, browser overrides, and cache replicas.
 *
 * Key exports: AUTHORITY_SOURCES, AUTHORITY_MATRIX, WORKER_CANONICAL_AUTHORITY_MATRIX,
 *              resolveSessionAuthorityGroup, isDemoSourceAllowed
 */
type AuthorityGroup = {
  fields: string[];
  authoritativeSource: string | null;
  allowedFallbacks: string[];
  mustNotOverride: string[];
};

type AuthorityMatrix = Record<string, AuthorityGroup>;

const deepFreeze = <T>(value: T): T => {
  if (!value || typeof value !== 'object') return value;
  Object.getOwnPropertyNames(value).forEach((key) => {
    const next = (value as Record<string, unknown>)[key];
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
  DISCOVERY: 'discovery',
  BUNDLED: 'bundled',
  BROWSER: 'browser',
  DEMO: 'demo',
  CACHE: 'cache',
} as const);

export const AUTHORITY_MATRIX = deepFreeze<AuthorityMatrix>({
  identity: {
    fields: ['slug', 'sessionId', 'metadataURI', 'chainId'],
    authoritativeSource: AUTHORITY_SOURCES.REGISTRY,
    allowedFallbacks: [AUTHORITY_SOURCES.DEMO],
    mustNotOverride: [AUTHORITY_SOURCES.ARWEAVE, AUTHORITY_SOURCES.BROWSER, AUTHORITY_SOURCES.CACHE],
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
  slugNormalization: {
    fields: ['slug', 'registrySlug', 'legacyExactSlug'],
    authoritativeSource: AUTHORITY_SOURCES.REGISTRY,
    allowedFallbacks: [AUTHORITY_SOURCES.DEMO],
    mustNotOverride: [AUTHORITY_SOURCES.ARWEAVE, AUTHORITY_SOURCES.BROWSER, AUTHORITY_SOURCES.CACHE],
  },
  faucetEligibility: {
    fields: ['txGas', 'faucetFallbackResources'],
    authoritativeSource: AUTHORITY_SOURCES.REGISTRY,
    allowedFallbacks: [],
    mustNotOverride: [
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.BROWSER,
      AUTHORITY_SOURCES.DEMO,
      AUTHORITY_SOURCES.CACHE,
    ],
  },
  registryDiscovery: {
    fields: ['sessionRegistryAddress', 'sessionContractsByChain'],
    authoritativeSource: AUTHORITY_SOURCES.DISCOVERY,
    allowedFallbacks: [AUTHORITY_SOURCES.BROWSER, AUTHORITY_SOURCES.BUNDLED],
    mustNotOverride: [AUTHORITY_SOURCES.ARWEAVE, AUTHORITY_SOURCES.DEMO, AUTHORITY_SOURCES.CACHE],
  },
  textMetadata: {
    fields: ['sessionName', 'sessionInfo', 'tags', 'ai', 'lit', 'encryption'],
    authoritativeSource: AUTHORITY_SOURCES.ARWEAVE,
    allowedFallbacks: [AUTHORITY_SOURCES.DEMO, AUTHORITY_SOURCES.CACHE],
    mustNotOverride: [AUTHORITY_SOURCES.BROWSER],
  },
  workerConfig: {
    fields: ['corsWorkerUrl', 'allowOrigins', 'limits', 'rpcEndpoint', 'litCredentials'],
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
    fields: ['arweaveJwk', 'apiKey', 'privateKey', 'litAccountApiKey', 'litUsageApiKey'],
    authoritativeSource: AUTHORITY_SOURCES.WORKER_SECRETS,
    allowedFallbacks: [AUTHORITY_SOURCES.BROWSER],
    mustNotOverride: [AUTHORITY_SOURCES.ARWEAVE, AUTHORITY_SOURCES.DEMO, AUTHORITY_SOURCES.CACHE],
  },
  localPreferences: {
    fields: ['rpc.useLocal', 'rpc.apiKey', 'arweave.useLocal', 'arweave.jwk', 'faucet.useLocal', 'faucet.privateKey'],
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

export const WORKER_CANONICAL_AUTHORITY_MATRIX = deepFreeze<AuthorityMatrix>({
  identity: {
    fields: ['slug', 'sessionId'],
    authoritativeSource: AUTHORITY_SOURCES.WORKER_KV,
    allowedFallbacks: [],
    mustNotOverride: [
      AUTHORITY_SOURCES.REGISTRY,
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.BROWSER,
      AUTHORITY_SOURCES.CACHE,
    ],
  },
  gates: {
    fields: ['sponsored', 'sponsoredSbtAddress', 'gates'],
    authoritativeSource: AUTHORITY_SOURCES.WORKER_KV,
    allowedFallbacks: [],
    mustNotOverride: [
      AUTHORITY_SOURCES.REGISTRY,
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.BROWSER,
      AUTHORITY_SOURCES.DEMO,
      AUTHORITY_SOURCES.CACHE,
    ],
  },
  slugNormalization: {
    fields: ['slug'],
    authoritativeSource: AUTHORITY_SOURCES.WORKER_KV,
    allowedFallbacks: [],
    mustNotOverride: [
      AUTHORITY_SOURCES.REGISTRY,
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.BROWSER,
      AUTHORITY_SOURCES.CACHE,
    ],
  },
  textMetadata: {
    fields: ['sessionName', 'sessionInfo', 'tags', 'ai', 'lit', 'encryption'],
    authoritativeSource: AUTHORITY_SOURCES.WORKER_KV,
    allowedFallbacks: [],
    mustNotOverride: [
      AUTHORITY_SOURCES.REGISTRY,
      AUTHORITY_SOURCES.ARWEAVE,
      AUTHORITY_SOURCES.BROWSER,
      AUTHORITY_SOURCES.DEMO,
      AUTHORITY_SOURCES.CACHE,
    ],
  },
  workerConfig: AUTHORITY_MATRIX.workerConfig,
});

export const resolveSessionAuthorityGroup = (fieldGroup: string, authorityMode: string): AuthorityGroup | undefined => {
  if (authorityMode === 'worker_canonical' && WORKER_CANONICAL_AUTHORITY_MATRIX[fieldGroup]) {
    return WORKER_CANONICAL_AUTHORITY_MATRIX[fieldGroup];
  }
  return AUTHORITY_MATRIX[fieldGroup];
};

export const isDemoSourceAllowed = (fieldGroup: string, mode: string): boolean => {
  if (mode !== 'demo' && mode !== 'off-chain') return false;
  const group = AUTHORITY_MATRIX[fieldGroup];
  if (!group || !Array.isArray(group.allowedFallbacks)) return false;
  return group.allowedFallbacks.includes(AUTHORITY_SOURCES.DEMO);
};
