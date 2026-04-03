import { ethers } from 'ethers';
import { toStr } from '../shared/primitives.js';

export const normalizeLitPayerPrivateKey = (value) => {
  const trimmed = toStr(value).trim();
  if (!trimmed) return '';
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return `0x${trimmed}`;
  return trimmed;
};

export const deriveLitPayerAddress = (privateKey) => {
  const normalized = normalizeLitPayerPrivateKey(privateKey);
  if (!normalized) return '';
  try {
    return ethers.utils.getAddress(new ethers.Wallet(normalized).address);
  } catch (_) {
    return '';
  }
};

export const createLitPayerWallet = () => {
  const wallet = ethers.Wallet.createRandom();
  return {
    privateKey: toStr(wallet.privateKey).trim(),
    address: toStr(wallet.address).trim(),
  };
};

export const getLitPayerWalletStatus = (privateKey) => {
  const normalizedPrivateKey = normalizeLitPayerPrivateKey(privateKey);
  if (!normalizedPrivateKey) {
    return {
      privateKey: '',
      address: '',
      ready: false,
      valid: false,
      error: '',
    };
  }
  try {
    const wallet = new ethers.Wallet(normalizedPrivateKey);
    return {
      privateKey: normalizedPrivateKey,
      address: ethers.utils.getAddress(wallet.address),
      ready: true,
      valid: true,
      error: '',
    };
  } catch (error) {
    return {
      privateKey: normalizedPrivateKey,
      address: '',
      ready: false,
      valid: false,
      error: toStr(error?.message || 'Invalid private key.'),
    };
  }
};
