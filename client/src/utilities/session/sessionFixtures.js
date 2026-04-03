/**
 * @module sessionFixtures
 * @description Reusable session utility fixtures for parser and canonical resolver tests.
 *
 * Key exports: VALID_REGISTRY_SESSION, VALID_ARWEAVE_METADATA, VALID_WORKER_CONFIG,
 *              VALID_LOCAL_OVERRIDES, CORRUPT_METADATA_TYPES, STALE_CACHE_SESSION,
 *              DEMO_SESSION, SLUG_MISMATCH, MISSING_SOURCES
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

export const VALID_REGISTRY_SESSION = deepFreeze({
  slug: 'alpha',
  sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  metadataURI: 'ar://alpha-session-metadata',
  chainId: 84532,
  contracts: {
    sessionRegistry: {
      address: '0x0000000000000000000000000000000000000001',
      chainId: 84532,
    },
    surveys: {
      address: '0x0000000000000000000000000000000000000002',
      chainId: 84532,
    },
  },
});

export const VALID_ARWEAVE_METADATA = deepFreeze({
  sessionName: 'Alpha Session',
  sessionInfo: 'Fixture metadata for parser tests.',
  tags: ['alpha', 'fixture'],
  lit: { network: 'naga-dev' },
});

export const VALID_WORKER_CONFIG = deepFreeze({
  corsWorkerUrl: 'https://worker.example.com',
  allowOrigins: ['https://example.com'],
});

export const VALID_LOCAL_OVERRIDES = deepFreeze({
  rpc: { useLocal: false, apiKey: '' },
  arweave: { useLocal: false, jwk: '' },
  faucet: { useLocal: false, privateKey: '' },
});

export const CORRUPT_METADATA_TYPES = deepFreeze({
  sessionName: 123,
  sessionInfo: null,
  tags: 'not-array',
});

export const STALE_CACHE_SESSION = deepFreeze({
  slug: 'stale',
  sessionName: 'Stale Cache',
  __fromCache: true,
});

export const DEMO_SESSION = deepFreeze({
  slug: 'demo',
  sessionName: 'Demo Session',
});

export const SLUG_MISMATCH = deepFreeze({
  requested: 'alpha',
  config: { slug: 'beta' },
});

export const MISSING_SOURCES = Object.freeze({});
