// Browser ESM twin; the group-password regression test pins parity with the CJS helper.
export const createGroupPasswordDerivation = (ethers) => {
  if (!ethers?.utils || !ethers?.Wallet || !ethers?.constants?.AddressZero) {
    throw new Error('An ethers v5-compatible API is required for group password derivation.');
  }

  const normalizeScopeAddress = (sbtAddress) => {
    const rawAddress = typeof sbtAddress === 'string' ? sbtAddress : '';
    return rawAddress && ethers.utils.isAddress(rawAddress)
      ? ethers.utils.getAddress(rawAddress)
      : ethers.constants.AddressZero;
  };

  const buildGroupPasswordSalt = (sbtAddress) =>
    ethers.utils.solidityKeccak256(['string', 'address'], ['sbt-group-password-v3', normalizeScopeAddress(sbtAddress)]);

  const deriveGroupPasswordWallet = ({ password, sbtAddress }) => {
    const passwordHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(String(password || '')));
    const salt = buildGroupPasswordSalt(sbtAddress);
    const seed = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [passwordHash, salt]);
    const privateKey = ethers.utils.keccak256(ethers.utils.arrayify(seed));
    return new ethers.Wallet(privateKey);
  };

  const computeGroupPasswordHash = ({ password, sbtAddress }) => {
    const wallet = deriveGroupPasswordWallet({ password, sbtAddress });
    return ethers.utils.solidityKeccak256(['address'], [wallet.address]);
  };

  const resolveGroupPasswordWalletScopeAddress = ({ password, sbtAddress, groupPasswordHash }) => {
    const expectedHash = String(groupPasswordHash || '')
      .trim()
      .toLowerCase();
    if (!expectedHash || expectedHash === ethers.constants.HashZero.toLowerCase()) {
      return null;
    }

    const normalizedSbtAddress =
      typeof sbtAddress === 'string' && ethers.utils.isAddress(sbtAddress) ? ethers.utils.getAddress(sbtAddress) : '';
    if (
      normalizedSbtAddress &&
      computeGroupPasswordHash({ password, sbtAddress: normalizedSbtAddress }).toLowerCase() === expectedHash
    ) {
      return normalizedSbtAddress;
    }

    if (computeGroupPasswordHash({ password, sbtAddress: '' }).toLowerCase() === expectedHash) {
      return '';
    }

    return null;
  };

  return Object.freeze({
    buildGroupPasswordSalt,
    computeGroupPasswordHash,
    deriveGroupPasswordWallet,
    normalizeScopeAddress,
    resolveGroupPasswordWalletScopeAddress,
  });
};
