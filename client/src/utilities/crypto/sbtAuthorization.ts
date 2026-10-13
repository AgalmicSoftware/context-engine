import { ethers } from 'ethers';
import groupPasswordDerivation from './groupPasswordDerivation.cjs';

type SbtAuthorizationInput = {
  password?: unknown;
  chainId?: unknown;
  sbtAddress?: unknown;
  userAddress?: unknown;
  nonce?: unknown;
};
type SbtGroupSigningInput = SbtAuthorizationInput & {
  // The on-chain hash. Required: signing stops unless the password derives it.
  groupPasswordHash: unknown;
};
type SbtInviteSigningInput = Omit<SbtGroupSigningInput, 'nonce' | 'userAddress'> & {
  nonces?: unknown;
};

const GROUP_PASSWORD_MISMATCH = 'GROUP_PASSWORD_MISMATCH';
// The password could not be checked at all, e.g. without WebCrypto or without the on-chain hash.
const GROUP_PASSWORD_UNVERIFIABLE = 'GROUP_PASSWORD_UNVERIFIABLE';
const BYTES32_HEX = /^0x[0-9a-f]{64}$/;
// ethers cannot encode a high surrogate without its low half; it would throw "invalid utf-8 string".
const UNPAIRED_HIGH_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;

export const GROUP_PASSWORD_INVALID_CHARACTER_MESSAGE =
  'The group password contains an invalid character. Retype it and try again.';
// Hash reads return null when they fail, which is not the same as a group without a password (a zero hash).
export const GROUP_PASSWORD_HASH_UNREADABLE_MESSAGE =
  "Could not read this group's password check from the chain. Check the network and try again.";

const { deriveGroupPasswordWallet } = groupPasswordDerivation.createGroupPasswordDerivation(ethers);

// Always a new Error: some errors, such as WebCrypto's DOMException, have a read-only `code`.
const groupPasswordError = (message: string, code: string, cause?: unknown): Error =>
  Object.assign(new Error(message, cause === undefined ? undefined : { cause }), { code });

// The derivation's own errors (no WebCrypto, empty password) are written for users; WebCrypto's are not.
const describeDerivationFailure = (error: unknown): string =>
  error instanceof Error && !(typeof DOMException !== 'undefined' && error instanceof DOMException)
    ? error.message
    : 'This browser could not check the group password. Try again, or use another browser.';

// For callers that read the hash themselves: the same "could not read" error signing raises, so the UI can tell
// it apart and offer Retry.
export const createGroupPasswordHashUnreadableError = (): Error =>
  groupPasswordError(GROUP_PASSWORD_HASH_UNREADABLE_MESSAGE, GROUP_PASSWORD_UNVERIFIABLE);

export const hasInvalidGroupPasswordCharacter = (password: unknown): boolean =>
  typeof password === 'string' && UNPAIRED_HIGH_SURROGATE.test(password);

const hasGroupPasswordCode = (error: unknown, code: string): boolean =>
  !!error && typeof error === 'object' && (error as { code?: unknown }).code === code;

export const isGroupPasswordMismatchError = (error: unknown): boolean =>
  hasGroupPasswordCode(error, GROUP_PASSWORD_MISMATCH);

// These errors carry a message users can act on, such as "Group passwords need WebCrypto".
export const isGroupPasswordUnverifiableError = (error: unknown): boolean =>
  hasGroupPasswordCode(error, GROUP_PASSWORD_UNVERIFIABLE);

export const positiveSbtUint = (value: unknown): string => {
  if (typeof value !== 'string' && typeof value !== 'number' && !ethers.BigNumber.isBigNumber(value)) {
    throw new Error('SBT authorization requires a positive integer');
  }
  const number = ethers.BigNumber.from(value);
  if (number.lte(0) || number.gt(ethers.constants.MaxUint256)) {
    throw new Error('SBT authorization requires a positive uint256');
  }
  return number.toString();
};

const hashSbtAuthorization = (
  domain: 'GroupMint' | 'Invite',
  chainId: unknown,
  sbtAddress: unknown,
  subject: unknown,
): string => {
  const collection = String(sbtAddress || '');
  if (!ethers.utils.isAddress(collection) || collection === ethers.constants.AddressZero) {
    throw new Error('Invalid SBT authorization collection');
  }
  const claimant = String(subject || '');
  if (domain === 'GroupMint' && (!ethers.utils.isAddress(claimant) || claimant === ethers.constants.AddressZero)) {
    throw new Error('Invalid SBT authorization claimant');
  }
  // Keep the protocol domains and abi.encode layout aligned with CustomSBT.sol.
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'uint256', 'address', domain === 'GroupMint' ? 'address' : 'uint256'],
      [
        ethers.utils.id(`ContextEngine.SBT.${domain}:1`),
        positiveSbtUint(chainId),
        collection,
        domain === 'GroupMint' ? claimant : positiveSbtUint(subject),
      ],
    ),
  );
};

// The slow KDF runs once per call, after everything else is validated.
const deriveGroupSigner = async ({ password, sbtAddress, groupPasswordHash }: SbtGroupSigningInput) => {
  const expectedHash = String(groupPasswordHash ?? '')
    .trim()
    .toLowerCase();
  if (!BYTES32_HEX.test(expectedHash)) {
    throw createGroupPasswordHashUnreadableError();
  }
  // A zero hash means the group has no group password: no password can match, so skip the slow KDF.
  if (expectedHash === ethers.constants.HashZero) {
    throw groupPasswordError(
      "This group has no group password, so it can't be joined with one.",
      GROUP_PASSWORD_UNVERIFIABLE,
    );
  }
  if (hasInvalidGroupPasswordCharacter(password)) {
    throw groupPasswordError(GROUP_PASSWORD_INVALID_CHARACTER_MESSAGE, GROUP_PASSWORD_UNVERIFIABLE);
  }
  const signer = await deriveGroupPasswordWallet({ password, sbtAddress }).catch((error: unknown) => {
    throw groupPasswordError(describeDerivationFailure(error), GROUP_PASSWORD_UNVERIFIABLE, error);
  });
  if (ethers.utils.solidityKeccak256(['address'], [signer.address]) !== expectedHash) {
    throw groupPasswordError('The group password does not match this group.', GROUP_PASSWORD_MISMATCH);
  }
  return signer;
};

export const computeGroupMintMessageHash = (sbtAddress: string, userAddress: string, chainId: unknown) =>
  hashSbtAuthorization('GroupMint', chainId, sbtAddress, userAddress);

export const signGroupMintAuthorization = async ({
  password,
  sbtAddress,
  userAddress,
  chainId,
  groupPasswordHash,
}: SbtGroupSigningInput) => {
  const messageHash = computeGroupMintMessageHash(String(sbtAddress || ''), String(userAddress || ''), chainId);
  const signer = await deriveGroupSigner({ password, sbtAddress, groupPasswordHash });
  return signer.signMessage(ethers.utils.arrayify(messageHash));
};

export const buildInviteMessageHash = ({ sbtAddress, nonce, chainId }: SbtAuthorizationInput) =>
  hashSbtAuthorization('Invite', chainId, sbtAddress, nonce);

export const signInvites = async ({
  password,
  sbtAddress,
  nonces,
  chainId,
  groupPasswordHash,
}: SbtInviteSigningInput): Promise<string[]> => {
  if (!Array.isArray(nonces) || nonces.length === 0) {
    throw new Error('Invite signing requires at least one slot');
  }
  const messageHashes = nonces.map((nonce) => buildInviteMessageHash({ sbtAddress, nonce, chainId }));
  const signer = await deriveGroupSigner({ password, sbtAddress, groupPasswordHash });
  const signatures: string[] = [];
  for (const messageHash of messageHashes) {
    signatures.push(await signer.signMessage(ethers.utils.arrayify(messageHash)));
  }
  return signatures;
};
