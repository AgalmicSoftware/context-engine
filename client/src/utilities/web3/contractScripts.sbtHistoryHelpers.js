/**
 * @module contractScriptsSbtHistoryHelpers
 * @description Helpers for normalizing and deriving SBT holder history summaries.
 */

import { ethers } from 'ethers';

export const normalizeHistorySummaryCount = (value) => {
  if (value == null) return null;
  let raw = '';
  try {
    raw = ethers.BigNumber.isBigNumber(value)
      ? value.toString()
      : String(value).trim();
  } catch (_) {
    raw = '';
  }
  if (!/^\d+$/.test(raw)) return null;
  return raw.replace(/^0+(?=\d)/, '') || '0';
};

export const normalizeSbtHistorySummary = (value) => {
  if (!value || typeof value !== 'object') return null;
  const totalMinted = normalizeHistorySummaryCount(value.totalMinted ?? value[0]);
  const totalBurned = normalizeHistorySummaryCount(value.totalBurned ?? value[1]);
  const activeSupply = normalizeHistorySummaryCount(value.activeSupply ?? value[2]);
  const currentHolderCount = normalizeHistorySummaryCount(value.currentHolderCount ?? value[3]);
  const historicalHolderCount = normalizeHistorySummaryCount(value.historicalHolderCount ?? value[4]);
  if (
    totalMinted == null ||
    totalBurned == null ||
    activeSupply == null ||
    currentHolderCount == null ||
    historicalHolderCount == null
  ) {
    return null;
  }
  return {
    totalMinted,
    totalBurned,
    activeSupply,
    currentHolderCount,
    historicalHolderCount,
  };
};

export const deriveSbtHistorySummaryFromCounts = ({
  mintedCountByAddress = {},
  burnedCountByAddress = {},
  mintedEventCount = 0,
  burnedEventCount = 0,
} = {}) => {
  let activeSupply = 0;
  let currentHolderCount = 0;

  Object.keys(mintedCountByAddress || {}).forEach((addrRaw) => {
    const addr = String(addrRaw || '').toLowerCase();
    if (!addr) return;
    const minted = Math.max(0, Math.floor(Number(mintedCountByAddress?.[addr] || 0)));
    const burned = Math.max(0, Math.floor(Number(burnedCountByAddress?.[addr] || 0)));
    const net = Math.max(0, minted - burned);
    if (net > 0) currentHolderCount += 1;
    activeSupply += net;
  });

  return normalizeSbtHistorySummary({
    totalMinted: String(Math.max(0, Math.floor(Number(mintedEventCount || 0)))),
    totalBurned: String(Math.max(0, Math.floor(Number(burnedEventCount || 0)))),
    activeSupply: String(activeSupply),
    currentHolderCount: String(currentHolderCount),
    historicalHolderCount: String(Object.keys(mintedCountByAddress || {}).length),
  });
};
