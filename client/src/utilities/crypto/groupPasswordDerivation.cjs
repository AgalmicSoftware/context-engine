// The SBT contract stores keccak256(signer address) publicly, so the group
// password is stretched with a slow KDF, salted by the SBT address, before it
// becomes the group signing key. Browsers, Jest and Node 20+ scripts all share
// this module, so it relies only on WebCrypto and an ethers v5 instance.
const GROUP_PASSWORD_DERIVATION = 'sbt-group-password-v4';
const GROUP_PASSWORD_PBKDF2_ITERATIONS = 600000;

const createGroupPasswordDerivation = (ethers) => {
  if (!ethers?.utils || !ethers?.Wallet || !ethers?.constants?.AddressZero) {
    throw new Error('An ethers v5-compatible API is required for group password derivation.');
  }

  const requirePassword = (password) => {
    // NFKC keeps the same password typed on different keyboards or devices equal.
    const normalized = typeof password === 'string' ? password.normalize('NFKC') : '';
    if (!normalized) {
      throw new Error('A group password is required.');
    }
    return normalized;
  };

  const requireSbtAddress = (sbtAddress) => {
    let address = '';
    try {
      address = ethers.utils.getAddress(String(sbtAddress || ''));
    } catch (_) {
      address = '';
    }
    if (!address || address === ethers.constants.AddressZero) {
      throw new Error('A group password needs the SBT contract address it belongs to.');
    }
    return address;
  };

  const requireSubtleCrypto = () => {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle) {
      throw new Error('Group passwords need WebCrypto (crypto.subtle), which this environment does not provide.');
    }
    return subtle;
  };

  /**
   * @param {{ password?: unknown, sbtAddress?: unknown }} input
   * @returns {Promise<import('ethers').Wallet>}
   */
  const deriveGroupPasswordWallet = async ({ password, sbtAddress }) => {
    const passwordBytes = ethers.utils.toUtf8Bytes(requirePassword(password));
    const salt = ethers.utils.arrayify(
      ethers.utils.solidityKeccak256(['string', 'address'], [GROUP_PASSWORD_DERIVATION, requireSbtAddress(sbtAddress)]),
    );
    const subtle = requireSubtleCrypto();
    const key = await subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: GROUP_PASSWORD_PBKDF2_ITERATIONS },
      key,
      256,
    );
    return new ethers.Wallet(ethers.utils.keccak256(new Uint8Array(bits)));
  };

  /**
   * @param {{ password?: unknown, sbtAddress?: unknown }} input
   * @returns {Promise<string>}
   */
  const computeGroupPasswordHash = async (input) => {
    const wallet = await deriveGroupPasswordWallet(input);
    return ethers.utils.solidityKeccak256(['address'], [wallet.address]);
  };

  return Object.freeze({
    derivation: GROUP_PASSWORD_DERIVATION,
    computeGroupPasswordHash,
    deriveGroupPasswordWallet,
  });
};

module.exports = { createGroupPasswordDerivation };
