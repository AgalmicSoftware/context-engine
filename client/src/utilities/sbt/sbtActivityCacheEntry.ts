import { hydrateLegacySbtCountState, type SbtCountMap } from './sbtCountHelpers.js';
import { buildSbtHistorySummaryFromCounts, normalizeSbtHistorySummary } from './sbtHistoryHelpers.js';

const EMPTY_HISTORY_SUMMARY = Object.freeze({
  totalMinted: '0',
  totalBurned: '0',
  activeSupply: '0',
  currentHolderCount: '0',
  historicalHolderCount: '0',
});

export interface SbtActivityCacheEntry {
  sbtAddress?: string;
  sbtInfo?: { creationBlock?: unknown } | null;
  mintedAddresses?: string[];
  burnedAddresses?: string[];
  blockNumber?: number;
  creationBlock?: unknown;
  mintedCountByAddress?: SbtCountMap | null;
  burnedCountByAddress?: SbtCountMap | null;
  mintedEventCount?: number;
  burnedEventCount?: number;
  historySummary?: unknown;
  countsLoaded?: boolean;
  [key: string]: unknown;
}

export interface BuildSbtActivityCacheEntryInput {
  sbtAddress: string;
  sbtInfo?: SbtActivityCacheEntry['sbtInfo'];
}

export interface ApplySbtActivityCacheEntryUpdateInput {
  account: string;
  burned: boolean;
  eventBlockNumber: number;
}

const ensureMutableCountMap = (value: unknown): SbtCountMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as SbtCountMap;
};

export const buildSbtActivityCacheEntry = ({
  sbtAddress,
  sbtInfo = null,
}: BuildSbtActivityCacheEntryInput): SbtActivityCacheEntry => ({
  sbtAddress,
  sbtInfo,
  mintedAddresses: [],
  burnedAddresses: [],
  blockNumber: 0,
  creationBlock: sbtInfo?.creationBlock ?? null,
  mintedCountByAddress: {},
  burnedCountByAddress: {},
  mintedEventCount: 0,
  burnedEventCount: 0,
  historySummary: { ...EMPTY_HISTORY_SUMMARY },
  countsLoaded: false,
});

export const applySbtActivityCacheEntryUpdate = (
  entry: SbtActivityCacheEntry,
  { account, burned, eventBlockNumber }: ApplySbtActivityCacheEntryUpdateInput,
): SbtActivityCacheEntry => {
  if (!Array.isArray(entry.mintedAddresses)) entry.mintedAddresses = [];
  if (!Array.isArray(entry.burnedAddresses)) entry.burnedAddresses = [];
  entry.mintedCountByAddress = ensureMutableCountMap(entry.mintedCountByAddress);
  entry.burnedCountByAddress = ensureMutableCountMap(entry.burnedCountByAddress);
  if (typeof entry.mintedEventCount !== 'number') entry.mintedEventCount = 0;
  if (typeof entry.burnedEventCount !== 'number') entry.burnedEventCount = 0;
  if (typeof entry.countsLoaded !== 'boolean') entry.countsLoaded = false;
  hydrateLegacySbtCountState(entry);

  const accountLower = String(account || '').toLowerCase();
  if (burned) {
    if (!entry.burnedAddresses.includes(accountLower)) {
      entry.burnedAddresses.push(accountLower);
    }
    const previousBurnedCount = Math.max(0, Math.floor(Number(entry.burnedCountByAddress[accountLower] || 0)));
    entry.burnedCountByAddress[accountLower] = previousBurnedCount + 1;
    entry.burnedEventCount += 1;
  } else {
    if (!entry.mintedAddresses.includes(accountLower)) {
      entry.mintedAddresses.push(accountLower);
    }
    const previousMintedCount = Math.max(0, Math.floor(Number(entry.mintedCountByAddress[accountLower] || 0)));
    entry.mintedCountByAddress[accountLower] = previousMintedCount + 1;
    entry.mintedEventCount += 1;
  }

  entry.historySummary =
    buildSbtHistorySummaryFromCounts({
      mintedCountByAddress: entry.mintedCountByAddress,
      burnedCountByAddress: entry.burnedCountByAddress,
      mintedEventCount: entry.mintedEventCount,
      burnedEventCount: entry.burnedEventCount,
    }) || normalizeSbtHistorySummary(entry.historySummary);

  entry.blockNumber = Math.max(entry.blockNumber || 0, eventBlockNumber);
  return entry;
};
