import { ethers } from 'ethers';
import { toStr } from '../shared/primitives.js';

export const normalizeAddress = (addr: unknown): string => {
  const raw = toStr(addr).trim();
  if (!raw) return '';
  try {
    return ethers.utils.getAddress(raw).toLowerCase();
  } catch (err) {
    void err;
    return raw.toLowerCase();
  }
};
