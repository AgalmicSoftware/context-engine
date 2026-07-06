/**
 * @module contractScriptsSbtHistoryHelpers
 * @description Helpers for normalizing and deriving SBT holder history summaries.
 */

import { ethers } from 'ethers';

type SbtHistorySummaryRecord = Record<string, unknown>;
type SbtHistorySummary = {
  totalMinted: string;
  totalBurned: string;
  activeSupply: string;
  currentHolderCount: string;
  historicalHolderCount: string;
};

export const normalizeHistorySummaryCount = (value: unknown): string | null => {
  if (value == null) return null;
  let raw = '';
  try {
    raw = ethers.BigNumber.isBigNumber(value)
      ? value.toString()
      : String(value).trim();
  } catch {
    raw = '';
  }
  if (!/^\d+$/.test(raw)) return null;
  return raw.replace(/^0+(?=\d)/, '') || '0';
};

export const normalizeSbtHistorySummary = (value: unknown): SbtHistorySummary | null => {
  if (!value || typeof value !== 'object') return null;
  const summary = value as SbtHistorySummaryRecord;
  const totalMinted = normalizeHistorySummaryCount(summary.totalMinted ?? summary[0]);
  const totalBurned = normalizeHistorySummaryCount(summary.totalBurned ?? summary[1]);
  const activeSupply = normalizeHistorySummaryCount(summary.activeSupply ?? summary[2]);
  const currentHolderCount = normalizeHistorySummaryCount(summary.currentHolderCount ?? summary[3]);
  const historicalHolderCount = normalizeHistorySummaryCount(summary.historicalHolderCount ?? summary[4]);
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
}: {
  mintedCountByAddress?: Record<string, unknown>;
  burnedCountByAddress?: Record<string, unknown>;
  mintedEventCount?: unknown;
  burnedEventCount?: unknown;
} = {}): SbtHistorySummary | null => {
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
