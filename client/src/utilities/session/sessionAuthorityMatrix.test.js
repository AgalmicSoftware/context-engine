import { AUTHORITY_MATRIX, AUTHORITY_SOURCES, isDemoSourceAllowed } from './sessionAuthorityMatrix.js';

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
});
