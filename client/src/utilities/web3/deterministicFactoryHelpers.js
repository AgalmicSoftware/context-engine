/**
 * @module deterministicFactoryHelpers
 * @description Pure helpers for deterministic factory inputs and revert-data checks.
 */

import { ethers } from 'ethers';
import { toStr } from '../shared/primitives.js';

export function normalizeCreate2Salt(raw) {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return '';
  if (ethers.utils.isHexString(trimmed, 32)) return trimmed;
  if (ethers.utils.isHexString(trimmed)) return ethers.utils.hexZeroPad(trimmed, 32);
  return ethers.utils.id(trimmed);
}

export function hasNonZeroHashValue(raw) {
  const normalized = toStr(raw).trim().toLowerCase();
  return !!normalized && normalized !== ethers.constants.HashZero.toLowerCase();
}

export function isEmptyRevertDataValue(value) {
  const normalized = toStr(value).trim().toLowerCase();
  return normalized === '0x' || normalized === '0x0';
}
