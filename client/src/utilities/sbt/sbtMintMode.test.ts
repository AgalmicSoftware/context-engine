import {
  SBT_MINT_MODE,
  deriveSbtMintModeFromDistribution,
  hasPasswordMintForSbtMintMode,
  normalizeSbtMintMode,
  usesClaimPasswordsForSbtMintMode,
  usesInviteCodesForSbtMintMode,
} from './sbtMintMode.js';

describe('sbtMintMode', () => {
  it('normalizes mint mode values and preserves fallback behavior', () => {
    expect(normalizeSbtMintMode('0')).toBe(SBT_MINT_MODE.PUBLIC_CLAIM);
    expect(normalizeSbtMintMode(1)).toBe(SBT_MINT_MODE.PASSWORD_COMMIT_REVEAL);
    expect(normalizeSbtMintMode(3)).toBe(SBT_MINT_MODE.LIMITED_INVITE_SIGNATURE);
    expect(normalizeSbtMintMode(4, SBT_MINT_MODE.UNLIMITED_GROUP_SIGNATURE)).toBe(
      SBT_MINT_MODE.UNLIMITED_GROUP_SIGNATURE,
    );
    expect(normalizeSbtMintMode('bad')).toBe(SBT_MINT_MODE.PUBLIC_CLAIM);
  });

  it('derives password and invite behavior from distribution mode', () => {
    expect(hasPasswordMintForSbtMintMode(SBT_MINT_MODE.PASSWORD_COMMIT_REVEAL)).toBe(true);
    expect(hasPasswordMintForSbtMintMode(SBT_MINT_MODE.LIMITED_INVITE_SIGNATURE)).toBe(true);
    expect(hasPasswordMintForSbtMintMode(SBT_MINT_MODE.PUBLIC_CLAIM)).toBe(false);
    expect(usesInviteCodesForSbtMintMode(SBT_MINT_MODE.LIMITED_INVITE_SIGNATURE)).toBe(true);
    expect(usesClaimPasswordsForSbtMintMode(SBT_MINT_MODE.PASSWORD_COMMIT_REVEAL)).toBe(true);

    expect(deriveSbtMintModeFromDistribution({ distributionOption: 'hasPasswords' })).toBe(
      SBT_MINT_MODE.PASSWORD_COMMIT_REVEAL,
    );
    expect(
      deriveSbtMintModeFromDistribution({
        distributionOption: 'groupPassword',
        isLimited: true,
      }),
    ).toBe(SBT_MINT_MODE.LIMITED_INVITE_SIGNATURE);
    expect(deriveSbtMintModeFromDistribution({ distributionOption: 'groupPassword' })).toBe(
      SBT_MINT_MODE.UNLIMITED_GROUP_SIGNATURE,
    );
    expect(deriveSbtMintModeFromDistribution()).toBe(SBT_MINT_MODE.PUBLIC_CLAIM);
  });
});
