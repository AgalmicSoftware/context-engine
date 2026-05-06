export const SBT_MINT_MODE = Object.freeze({
  PUBLIC_CLAIM: 0,
  PASSWORD_COMMIT_REVEAL: 1,
  UNLIMITED_GROUP_SIGNATURE: 2,
  LIMITED_INVITE_SIGNATURE: 3,
});

export const normalizeSbtMintMode = (value, fallback = SBT_MINT_MODE.PUBLIC_CLAIM) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 && normalized <= 3
    ? normalized
    : fallback;
};

export const hasPasswordMintForSbtMintMode = (mintMode) => {
  const normalized = normalizeSbtMintMode(mintMode);
  return normalized === SBT_MINT_MODE.PASSWORD_COMMIT_REVEAL
    || normalized === SBT_MINT_MODE.LIMITED_INVITE_SIGNATURE;
};

export const usesInviteCodesForSbtMintMode = (mintMode) => (
  normalizeSbtMintMode(mintMode) === SBT_MINT_MODE.LIMITED_INVITE_SIGNATURE
);

export const usesClaimPasswordsForSbtMintMode = (mintMode) => (
  normalizeSbtMintMode(mintMode) === SBT_MINT_MODE.PASSWORD_COMMIT_REVEAL
);

export const deriveSbtMintModeFromDistribution = ({
  distributionOption = '',
  isLimited = false,
} = {}) => {
  if (distributionOption === 'hasPasswords') {
    return SBT_MINT_MODE.PASSWORD_COMMIT_REVEAL;
  }

  if (distributionOption === 'groupPassword') {
    return isLimited
      ? SBT_MINT_MODE.LIMITED_INVITE_SIGNATURE
      : SBT_MINT_MODE.UNLIMITED_GROUP_SIGNATURE;
  }

  return SBT_MINT_MODE.PUBLIC_CLAIM;
};
