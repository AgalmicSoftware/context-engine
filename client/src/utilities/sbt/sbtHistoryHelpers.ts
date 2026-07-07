import { normalizeSbtCountMap, sumSbtCountMap } from './sbtCountHelpers.js';

export interface SbtHistorySummary {
  totalMinted: string;
  totalBurned: string;
  activeSupply: string;
  currentHolderCount: string;
  historicalHolderCount: string;
}

type SbtHistorySummaryInput = Partial<Record<keyof SbtHistorySummary, unknown>>;

export const normalizeSbtHistorySummary = (summaryIn: unknown): SbtHistorySummary | null => {
  if (!summaryIn || typeof summaryIn !== 'object') return null;
  const normalizeField = (value: unknown): string | null => {
    const raw = String(value ?? '').trim();
    if (!/^\d+$/.test(raw)) return null;
    return raw.replace(/^0+(?=\d)/, '') || '0';
  };
  const totalMinted = normalizeField((summaryIn as SbtHistorySummaryInput).totalMinted);
  const totalBurned = normalizeField((summaryIn as SbtHistorySummaryInput).totalBurned);
  const activeSupply = normalizeField((summaryIn as SbtHistorySummaryInput).activeSupply);
  const currentHolderCount = normalizeField((summaryIn as SbtHistorySummaryInput).currentHolderCount);
  const historicalHolderCount = normalizeField((summaryIn as SbtHistorySummaryInput).historicalHolderCount);
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

export const buildSbtHistorySummaryFromCounts = (
  counts?: {
    mintedCountByAddress?: Record<string, unknown> | null;
    burnedCountByAddress?: Record<string, unknown> | null;
    mintedEventCount?: unknown;
    burnedEventCount?: unknown;
  } | null,
): SbtHistorySummary | null => {
  const mintedCountByAddress = normalizeSbtCountMap(counts?.mintedCountByAddress);
  const burnedCountByAddress = normalizeSbtCountMap(counts?.burnedCountByAddress);
  const mintedEventCount = Math.max(0, Math.floor(Number(counts?.mintedEventCount || 0)));
  const burnedEventCount = Math.max(0, Math.floor(Number(counts?.burnedEventCount || 0)));
  let activeSupply = 0;
  let currentHolderCount = 0;
  Object.keys(mintedCountByAddress).forEach((addr) => {
    const minted = Math.max(0, Math.floor(Number(mintedCountByAddress?.[addr] || 0)));
    const burned = Math.max(0, Math.floor(Number(burnedCountByAddress?.[addr] || 0)));
    const net = Math.max(0, minted - burned);
    if (net > 0) currentHolderCount += 1;
    activeSupply += net;
  });
  return normalizeSbtHistorySummary({
    totalMinted: String(mintedEventCount || sumSbtCountMap(mintedCountByAddress)),
    totalBurned: String(burnedEventCount || sumSbtCountMap(burnedCountByAddress)),
    activeSupply: String(activeSupply),
    currentHolderCount: String(currentHolderCount),
    historicalHolderCount: String(Object.keys(mintedCountByAddress).length),
  });
};
