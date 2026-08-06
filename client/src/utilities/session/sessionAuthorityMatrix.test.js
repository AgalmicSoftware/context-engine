import {
  AUTHORITY_MATRIX,
  AUTHORITY_SOURCES,
  WORKER_CANONICAL_AUTHORITY_MATRIX,
  isDemoSourceAllowed,
  resolveSessionAuthorityGroup,
} from './sessionAuthorityMatrix.js';

describe('sessionAuthorityMatrix', () => {
  it('freezes the authority matrix for read-only documentation', () => {
    expect(Object.isFrozen(AUTHORITY_MATRIX)).toBe(true);
    expect(Object.isFrozen(AUTHORITY_MATRIX.identity)).toBe(true);
    expect(AUTHORITY_MATRIX.identity.authoritativeSource).toBe(AUTHORITY_SOURCES.REGISTRY);
  });

  it('only enables demo fallbacks in demo or off-chain modes', () => {
    expect(isDemoSourceAllowed('identity', 'demo')).toBe(true);
    expect(isDemoSourceAllowed('textMetadata', 'off-chain')).toBe(true);
    expect(isDemoSourceAllowed('identity', 'production')).toBe(false);
    expect(isDemoSourceAllowed('workerConfig', 'demo')).toBe(false);
  });

  it('documents registry authority, faucet, and discovery boundaries', () => {
    expect(AUTHORITY_MATRIX.slugNormalization).toEqual(
      expect.objectContaining({
        authoritativeSource: AUTHORITY_SOURCES.REGISTRY,
        fields: expect.arrayContaining(['registrySlug', 'legacyExactSlug']),
      }),
    );
    expect(AUTHORITY_MATRIX.faucetEligibility).toEqual(
      expect.objectContaining({
        authoritativeSource: AUTHORITY_SOURCES.REGISTRY,
        allowedFallbacks: [],
        fields: expect.arrayContaining(['txGas']),
      }),
    );
    expect(AUTHORITY_MATRIX.registryDiscovery).toEqual(
      expect.objectContaining({
        authoritativeSource: AUTHORITY_SOURCES.DISCOVERY,
        allowedFallbacks: expect.arrayContaining([AUTHORITY_SOURCES.BROWSER, AUTHORITY_SOURCES.BUNDLED]),
      }),
    );
  });

  it('stores Lit Chipotle identifiers in worker config authority instead of worker secrets', () => {
    expect(AUTHORITY_MATRIX.workerConfig.fields).toContain('litCredentials');
    expect(AUTHORITY_MATRIX.secrets.fields).not.toContain('litCredentials');
    expect(AUTHORITY_MATRIX.secrets.fields).toEqual(expect.arrayContaining(['litAccountApiKey', 'litUsageApiKey']));
  });

  it('classifies worker authorization policy as Worker config', () => {
    expect(AUTHORITY_MATRIX.workerConfig.fields).toContain('workerAuthority');
  });

  it('switches identity, metadata, gates, and slug authority to worker KV only for worker-canonical mode', () => {
    expect(Object.isFrozen(WORKER_CANONICAL_AUTHORITY_MATRIX)).toBe(true);
    expect(resolveSessionAuthorityGroup('identity', 'worker_canonical')).toEqual(
      expect.objectContaining({
        authoritativeSource: AUTHORITY_SOURCES.WORKER_KV,
        allowedFallbacks: [],
      }),
    );
    expect(resolveSessionAuthorityGroup('textMetadata', 'worker_canonical').authoritativeSource).toBe(
      AUTHORITY_SOURCES.WORKER_KV,
    );
    expect(resolveSessionAuthorityGroup('gates', 'worker_canonical')).toEqual(
      expect.objectContaining({
        authoritativeSource: AUTHORITY_SOURCES.WORKER_KV,
        fields: expect.arrayContaining(['gates', 'sponsored', 'sponsoredSbtAddress']),
      }),
    );
    expect(resolveSessionAuthorityGroup('slugNormalization', 'worker_canonical').authoritativeSource).toBe(
      AUTHORITY_SOURCES.WORKER_KV,
    );
  });

  it('preserves registry and Arweave authority for every non-worker-canonical mode', () => {
    for (const mode of ['', 'on-chain', 'production', 'worker_with_public_anchor', 'evm_registry_canonical']) {
      expect(resolveSessionAuthorityGroup('identity', mode)).toBe(AUTHORITY_MATRIX.identity);
      expect(resolveSessionAuthorityGroup('gates', mode)).toBe(AUTHORITY_MATRIX.gates);
      expect(resolveSessionAuthorityGroup('textMetadata', mode)).toBe(AUTHORITY_MATRIX.textMetadata);
    }
  });
});
