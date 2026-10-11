import { ethers } from 'ethers';
import groupPasswordDerivation from './groupPasswordDerivation.cjs';

type SbtAuthorizationInput = {
  password?: unknown;
  chainId?: unknown;
  sbtAddress?: unknown;
  userAddress?: unknown;
  nonce?: unknown;
  // The on-chain hash. When set, signing stops with a mismatch error unless the password derives it.
  groupPasswordHash?: unknown;
};
type SbtInviteSigningInput = Omit<SbtAuthorizationInput, 'nonce' | 'userAddress'> & {
  nonces?: unknown;
};

const GROUP_PASSWORD_MISMATCH = 'GROUP_PASSWORD_MISMATCH';

const { deriveGroupPasswordWallet } = groupPasswordDerivation.createGroupPasswordDerivation(ethers);

export const isGroupPasswordMismatchError = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { code?: unknown }).code === GROUP_PASSWORD_MISMATCH;

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

// The slow KDF runs once per call; callers validate everything else first.
const deriveGroupSigner = async ({ password, sbtAddress, groupPasswordHash }: SbtAuthorizationInput) => {
  const signer = await deriveGroupPasswordWallet({ password, sbtAddress });
  if (groupPasswordHash != null) {
    const signerHash = ethers.utils.solidityKeccak256(['address'], [signer.address]);
    if (signerHash !== String(groupPasswordHash).trim().toLowerCase()) {
      throw Object.assign(new Error('The group password does not match this group.'), {
        code: GROUP_PASSWORD_MISMATCH,
      });
    }
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
}: SbtAuthorizationInput) => {
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
