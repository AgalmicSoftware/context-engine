import { ethers } from 'ethers';
import groupPasswordDerivation from './groupPasswordDerivation.cjs';

type SbtAuthorizationInput = {
  password?: unknown;
  chainId?: unknown;
  sbtAddress?: unknown;
  userAddress?: unknown;
  nonce?: unknown;
  walletScopeSbtAddress?: unknown;
};

const { deriveGroupPasswordWallet } = groupPasswordDerivation.createGroupPasswordDerivation(ethers);

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
  domain: 'GroupMint' | 'Invite', chainId: unknown, sbtAddress: unknown, subject: unknown,
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
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
    ['bytes32', 'uint256', 'address', domain === 'GroupMint' ? 'address' : 'uint256'],
    [ethers.utils.id(`ContextEngine.SBT.${domain}:1`), positiveSbtUint(chainId), collection,
      domain === 'GroupMint' ? claimant : positiveSbtUint(subject)],
  ));
};

export const computeGroupMintMessageHash = (sbtAddress: string, userAddress: string, chainId: unknown) =>
  hashSbtAuthorization('GroupMint', chainId, sbtAddress, userAddress);

export const signGroupMintAuthorization = async ({
  password, sbtAddress, userAddress, chainId, walletScopeSbtAddress = sbtAddress,
}: SbtAuthorizationInput) => {
  const messageHash = computeGroupMintMessageHash(String(sbtAddress || ''), String(userAddress || ''), chainId);
  const tmpWallet = deriveGroupPasswordWallet({ password, sbtAddress: walletScopeSbtAddress });
  return tmpWallet.signMessage(ethers.utils.arrayify(messageHash));
};

export const buildInviteMessageHash = ({ sbtAddress, nonce, chainId }: SbtAuthorizationInput) =>
  hashSbtAuthorization('Invite', chainId, sbtAddress, nonce);

export const signInvite = async ({ password, sbtAddress, nonce, chainId, walletScopeSbtAddress = sbtAddress }: SbtAuthorizationInput) => {
  const messageHash = buildInviteMessageHash({ sbtAddress, nonce, chainId });
  const tmpWallet = deriveGroupPasswordWallet({ password, sbtAddress: walletScopeSbtAddress });
  return tmpWallet.signMessage(ethers.utils.arrayify(messageHash));
};
