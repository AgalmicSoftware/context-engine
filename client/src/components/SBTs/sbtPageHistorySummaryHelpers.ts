import { sanitizeSbtPageMintedTokensOverride } from './sbtPageAutoMintHelpers';

export type SbtPageHistorySummary = {
  activeSupply: string;
  currentHolderCount: string;
  historicalHolderCount: string;
  totalBurned: string;
  totalMinted: string;
};

export type SbtPageHistorySummaryInput = Record<string, unknown> & {
  activeSupply?: unknown;
  currentHolderCount?: unknown;
  historicalHolderCount?: unknown;
  totalBurned?: unknown;
  totalMinted?: unknown;
};

type ApplySbtPageHistorySummaryFallbackArgs = {
  mintedTokensOverride?: string | null;
  mintedTokensSource?: string | null;
  ownerLookupUpperBound?: string | null;
  sourceLabel?: unknown;
  summaryValue?: unknown;
};

type SbtPageHistorySummaryFallbackState = {
  mintedTokensOverride: string | null;
  mintedTokensSource: string | null;
  ownerLookupUpperBound: string | null;
};

const isSbtPageHistoryRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

export const normalizeSbtPageHistorySummary = (value: unknown): SbtPageHistorySummary | null => {
  if (!isSbtPageHistoryRecord(value)) return null;
  const summary = value as SbtPageHistorySummaryInput;
  const normalizeField = (fieldValue: unknown): string | null => {
    const raw = String(fieldValue ?? '').trim();
    if (!/^\d+$/.test(raw)) return null;
    return raw.replace(/^0+(?=\d)/, '') || '0';
  };
  const totalMinted = normalizeField(summary.totalMinted);
  const totalBurned = normalizeField(summary.totalBurned);
  const activeSupply = normalizeField(summary.activeSupply);
  const currentHolderCount = normalizeField(summary.currentHolderCount);
  const historicalHolderCount = normalizeField(summary.historicalHolderCount);
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

export const applySbtPageHistorySummaryFallback = ({
  mintedTokensOverride = null,
  mintedTokensSource = null,
  ownerLookupUpperBound = null,
  sourceLabel = '',
  summaryValue = null,
}: ApplySbtPageHistorySummaryFallbackArgs = {}): SbtPageHistorySummaryFallbackState => {
  const summaryRecord = isSbtPageHistoryRecord(summaryValue) ? (summaryValue as SbtPageHistorySummaryInput) : {};
  const holderCount = sanitizeSbtPageMintedTokensOverride(summaryRecord.currentHolderCount);
  const totalMinted = sanitizeSbtPageMintedTokensOverride(summaryRecord.totalMinted);
  return {
    mintedTokensOverride: holderCount != null ? holderCount : mintedTokensOverride,
    mintedTokensSource: holderCount != null ? String(sourceLabel || '') : mintedTokensSource,
    ownerLookupUpperBound: totalMinted != null ? totalMinted : ownerLookupUpperBound,
  };
};
