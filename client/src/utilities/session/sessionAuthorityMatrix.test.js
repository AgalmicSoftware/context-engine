import {
  AUTHORITY_MATRIX,
  AUTHORITY_SOURCES,
  isDemoSourceAllowed,
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
});
