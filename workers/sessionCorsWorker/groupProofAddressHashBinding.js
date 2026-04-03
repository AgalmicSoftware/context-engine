const ZERO_BYTES32_FALLBACK = `0x${'0'.repeat(64)}`;

const toStr = (value, deps) => (
  typeof deps?.toStr === 'function'
    ? deps.toStr(value)
    : typeof value === 'string'
      ? value
      : value == null
        ? ''
        : String(value)
);

const isBytes32Hex = (value, deps) => /^0x[0-9a-fA-F]{64}$/.test(toStr(value, deps).trim());

export const createGroupProofAddressHashHelpersWithWorkerDeps = ({
  deps,
  constants,
} = {}) => {
  const isAddress = typeof deps?.isAddress === 'function' ? deps.isAddress : () => false;
  const getAddress = typeof deps?.getAddress === 'function' ? deps.getAddress : (value) => value;
  const verifyMessage = typeof deps?.verifyMessage === 'function'
    ? deps.verifyMessage
    : () => {
      throw new Error('verifyMessage unavailable');
    };
  const getBytes = typeof deps?.getBytes === 'function'
    ? deps.getBytes
    : () => {
      throw new Error('getBytes unavailable');
    };
  const solidityKeccak256 = typeof deps?.solidityKeccak256 === 'function'
    ? deps.solidityKeccak256
    : () => {
      throw new Error('solidityKeccak256 unavailable');
    };

  const normalizeAddressLower = (value) => {
    const raw = toStr(value, deps).trim();
    if (!raw || !isAddress(raw)) return '';
    try {
      return getAddress(raw).toLowerCase();
    } catch {
      return raw.toLowerCase();
    }
  };

  const computeGroupMintMessageHash = ({ sbtAddress, recipientAddress } = {}) => {
    if (!isAddress(sbtAddress) || !isAddress(recipientAddress)) {
      throw new Error('Invalid address for group faucet proof.');
    }
    return solidityKeccak256(
      ['address', 'address'],
      [getAddress(sbtAddress), getAddress(recipientAddress)],
    );
  };

  const verifyGroupSignatureForFaucet = ({
    sbtAddress,
    recipientAddress,
    signature,
    expectedGroupPasswordHash,
  } = {}) => {
    const normalizedSignature = toStr(signature, deps).trim();
    if (!normalizedSignature) {
      return { ok: false, status: 400, error: 'Missing group signature.' };
    }

    const expectedHash = toStr(expectedGroupPasswordHash, deps).trim().toLowerCase();
    const zeroBytes32 = toStr(constants?.zeroBytes32, deps).trim().toLowerCase() || ZERO_BYTES32_FALLBACK;
    if (!isBytes32Hex(expectedGroupPasswordHash, deps) || expectedHash === zeroBytes32) {
      return { ok: false, status: 400, error: 'Missing group password hash.' };
    }

    try {
      const messageHash = computeGroupMintMessageHash({ sbtAddress, recipientAddress });
      const signer = normalizeAddressLower(verifyMessage(getBytes(messageHash), normalizedSignature));
      if (!signer) {
        return { ok: false, status: 403, error: 'Invalid group signature.' };
      }
      const signerHash = toStr(solidityKeccak256(['address'], [getAddress(signer)]), deps).trim().toLowerCase();
      if (signerHash !== expectedHash) {
        return { ok: false, status: 403, error: 'Invalid group signature.' };
      }
      return { ok: true, signer };
    } catch (err) {
      return {
        ok: false,
        status: 400,
        error: toStr(err?.message || err || 'Group signature verification failed.', deps).trim() || 'Invalid group signature.',
      };
    }
  };

  return {
    normalizeAddressLower,
    computeGroupMintMessageHash,
    verifyGroupSignatureForFaucet,
  };
};
