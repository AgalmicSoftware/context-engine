import { ethers } from 'ethers';
import type { HexString, SoftSessionPolicy } from '../types.js';

export const createSoftSessionPolicy = ({
  address,
  ttlSeconds,
  now = Date.now(),
  allowedMethods,
  allowedChainIds,
  allowedTargets,
  maxTransactionValueWei = '0',
}: {
  address: HexString;
  ttlSeconds: number;
  now?: number;
  allowedMethods?: SoftSessionPolicy['allowedMethods'];
  allowedChainIds?: number[];
  allowedTargets?: HexString[];
  maxTransactionValueWei?: string;
}): SoftSessionPolicy => ({
  sessionId: `soft:${address.toLowerCase()}:${now}`,
  address,
  createdAt: now,
  expiresAt: now + Math.max(1, ttlSeconds) * 1000,
  allowedMethods: allowedMethods || ['personal_sign', 'eth_signTypedData_v4', 'eth_sendTransaction'],
  allowedChainIds,
  allowedTargets,
  maxTransactionValueWei,
});

export const isSoftSessionExpired = (policy: SoftSessionPolicy, now = Date.now()): boolean =>
  now >= Number(policy.expiresAt || 0);

const normalizeAddress = (value: unknown): string => {
  try {
    return ethers.utils.getAddress(String(value || '')).toLowerCase();
  } catch (_) {
    return '';
  }
};

const valueToWei = (value: unknown): bigint => {
  if (value == null || value === '') return 0n;
  if (typeof value === 'bigint') return value >= 0n ? value : 0n;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? BigInt(Math.trunc(value)) : 0n;
  }
  const raw = String(value || '').trim();
  if (!raw) return 0n;
  try {
    if (/^0x[0-9a-f]+$/i.test(raw)) return BigInt(raw);
    if (/^\d+$/.test(raw)) return BigInt(raw);
  } catch (_) {
    return 0n;
  }
  return 0n;
};

const chainIdToNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  if (typeof value === 'bigint') return value > 0n && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const parsed = /^0x[0-9a-f]+$/i.test(raw) ? Number(BigInt(raw)) : Number(raw);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  } catch (_) {
    return null;
  }
};

export const assertSoftSessionAllowed = ({
  policy,
  method,
  tx,
  chainId,
  now = Date.now(),
}: {
  policy: SoftSessionPolicy | null;
  method: SoftSessionPolicy['allowedMethods'][number];
  tx?: Record<string, unknown>;
  chainId?: number;
  now?: number;
}): void => {
  if (!policy) throw new Error('Passkey wallet is locked.');
  if (isSoftSessionExpired(policy, now)) throw new Error('Passkey wallet session expired.');
  if (!policy.allowedMethods.includes(method)) {
    throw new Error(`Soft session does not allow ${method}.`);
  }
  const requestChainId = chainIdToNumber(tx?.chainId);
  const activeChainId = chainIdToNumber(chainId);
  if (requestChainId && activeChainId && requestChainId !== activeChainId) {
    throw new Error('Soft session transaction chain does not match the active chain.');
  }
  const effectiveChainId = requestChainId || activeChainId;
  if (
    effectiveChainId &&
    Array.isArray(policy.allowedChainIds) &&
    policy.allowedChainIds.length > 0 &&
    !policy.allowedChainIds.includes(effectiveChainId)
  ) {
    throw new Error('Soft session does not allow this chain.');
  }
  if (method !== 'eth_sendTransaction' && method !== 'eth_signTransaction') return;
  const from = normalizeAddress(tx?.from);
  const sessionAddress = normalizeAddress(policy.address);
  if (from && sessionAddress && from !== sessionAddress) {
    throw new Error('Soft session transaction sender does not match the unlocked wallet.');
  }
  const target = normalizeAddress(tx?.to);
  if (Array.isArray(policy.allowedTargets) && policy.allowedTargets.length > 0) {
    const allowedTargets = policy.allowedTargets.map(normalizeAddress).filter(Boolean);
    if (!target || !allowedTargets.includes(target)) {
      throw new Error('Soft session does not allow this transaction target.');
    }
  }
  const maxValue = valueToWei(policy.maxTransactionValueWei);
  const value = valueToWei(tx?.value);
  if (value > maxValue) {
    throw new Error('Value-bearing transactions require explicit wallet confirmation.');
  }
};
