export const SBT_MINT_MODE = Object.freeze({
  PUBLIC_CLAIM: 0,
  PASSWORD_COMMIT_REVEAL: 1,
  UNLIMITED_GROUP_SIGNATURE: 2,
  LIMITED_INVITE_SIGNATURE: 3,
});

export const normalizeSbtMintMode = (value: unknown, fallback: number = SBT_MINT_MODE.PUBLIC_CLAIM): number => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 && normalized <= 3 ? normalized : fallback;
};

export const hasPasswordMintForSbtMintMode = (mintMode: unknown): boolean => {
  const normalized = normalizeSbtMintMode(mintMode);
  return normalized === SBT_MINT_MODE.PASSWORD_COMMIT_REVEAL || normalized === SBT_MINT_MODE.LIMITED_INVITE_SIGNATURE;
};

export const usesInviteCodesForSbtMintMode = (mintMode: unknown): boolean =>
  normalizeSbtMintMode(mintMode) === SBT_MINT_MODE.LIMITED_INVITE_SIGNATURE;

export const usesClaimPasswordsForSbtMintMode = (mintMode: unknown): boolean =>
  normalizeSbtMintMode(mintMode) === SBT_MINT_MODE.PASSWORD_COMMIT_REVEAL;

export const deriveSbtMintModeFromDistribution = ({
  distributionOption = '',
  isLimited = false,
}: {
  distributionOption?: unknown;
  isLimited?: unknown;
} = {}): number => {
  if (distributionOption === 'hasPasswords') {
    return SBT_MINT_MODE.PASSWORD_COMMIT_REVEAL;
  }

  if (distributionOption === 'groupPassword') {
    return isLimited ? SBT_MINT_MODE.LIMITED_INVITE_SIGNATURE : SBT_MINT_MODE.UNLIMITED_GROUP_SIGNATURE;
  }

  return SBT_MINT_MODE.PUBLIC_CLAIM;
};
