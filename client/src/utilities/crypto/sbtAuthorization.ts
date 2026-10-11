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

const { deriveGroupPasswordWallet } = groupPasswordDerivation.createGroupPasswordDerivation(ethers);

const withGroupPasswordCode = (error: unknown, code: string): Error =>
  Object.assign(error instanceof Error ? error : new Error(String(error)), { code });

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
    throw withGroupPasswordCode(
      new Error("Could not read this group's password check from the chain. Check the network and try again."),
      GROUP_PASSWORD_UNVERIFIABLE,
    );
  }
  const signer = await deriveGroupPasswordWallet({ password, sbtAddress }).catch((error: unknown) => {
    throw withGroupPasswordCode(error, GROUP_PASSWORD_UNVERIFIABLE);
  });
  if (ethers.utils.solidityKeccak256(['address'], [signer.address]) !== expectedHash) {
    throw withGroupPasswordCode(new Error('The group password does not match this group.'), GROUP_PASSWORD_MISMATCH);
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
