import { ethers } from 'ethers';
import { hasNonZeroHashValue, isEmptyRevertDataValue, normalizeCreate2Salt } from './deterministicFactoryHelpers.js';

describe('deterministicFactoryHelpers', () => {
  it('preserves blank and full-length hex salts', () => {
    const fullSalt = ethers.utils.hexZeroPad('0x1234', 32);

    expect(normalizeCreate2Salt('')).toBe('');
    expect(normalizeCreate2Salt(fullSalt)).toBe(fullSalt);
  });

  it('pads short hex salts and hashes plain-text salts', () => {
    expect(normalizeCreate2Salt('0x1234')).toBe(ethers.utils.hexZeroPad('0x1234', 32));
    expect(normalizeCreate2Salt('session-slug')).toBe(ethers.utils.id('session-slug'));
  });

  it('detects non-zero hashes and empty revert payload markers', () => {
    expect(hasNonZeroHashValue('')).toBe(false);
    expect(hasNonZeroHashValue(ethers.constants.HashZero)).toBe(false);
    expect(hasNonZeroHashValue('0x1234')).toBe(true);

    expect(isEmptyRevertDataValue('0x')).toBe(true);
    expect(isEmptyRevertDataValue('0x0')).toBe(true);
    expect(isEmptyRevertDataValue('0x00')).toBe(false);
  });
});
