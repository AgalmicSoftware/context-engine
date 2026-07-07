import { __test__contractScriptsErrors } from './chainGateway.js';

describe('contractScripts nonexistent token error detection', () => {
  const { isNonexistentTokenError } = __test__contractScriptsErrors;

  it('matches custom error name directly', () => {
    expect(isNonexistentTokenError({ errorName: 'ERC721NonexistentToken' })).toBe(true);
  });

  it('matches nested custom error name', () => {
    expect(isNonexistentTokenError({ error: { errorName: 'ERC721NonexistentToken' } })).toBe(true);
  });

  it('matches provider message variants', () => {
    expect(isNonexistentTokenError({ message: 'owner query for nonexistent token' })).toBe(true);
    expect(isNonexistentTokenError({ message: 'execution reverted: nonexistent token' })).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isNonexistentTokenError({ message: 'network timeout' })).toBe(false);
  });
});
