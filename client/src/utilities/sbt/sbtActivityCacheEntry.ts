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
  schemaVersion: typeof SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION;
  sbtAddress?: string;
  sbtInfo?: ({ creationBlock?: unknown } & Record<string, unknown>) | null;
  mintedAddresses?: string[];
  burnedAddresses?: string[];
  blockNumber?: number | null;
  creationBlock?: unknown;
  mintedCountByAddress?: SbtCountMap | null;
  burnedCountByAddress?: SbtCountMap | null;
  mintedEventCount?: number;
  burnedEventCount?: number;
  historySummary?: unknown;
  countsLoaded?: boolean;
  countsScanCheckpoint?: unknown;
  slug?: string;
  sessionSlug?: string;
  sessionSlugExplicit?: boolean;
}

export const SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION = 1 as const;

export type LegacySbtActivityCacheEntry = Omit<Partial<SbtActivityCacheEntry>, 'schemaVersion'> &
  Record<string, unknown> & {
    schemaVersion?: unknown;
  };

export interface BuildSbtActivityCacheEntryInput {
  sbtAddress: string;
  sbtInfo?: SbtActivityCacheEntry['sbtInfo'];
  creationBlock?: unknown;
  blockNumber?: number;
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

export const isSbtActivityCacheEntry = (value: unknown): value is SbtActivityCacheEntry =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as { schemaVersion?: unknown }).schemaVersion === SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION;

export const hydrateSbtActivityCacheEntry = (value: unknown): SbtActivityCacheEntry | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const legacyEntry = value as LegacySbtActivityCacheEntry;
  legacyEntry.schemaVersion = SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION;
  return legacyEntry as SbtActivityCacheEntry;
};

export const buildSbtActivityCacheEntry = ({
  sbtAddress,
  sbtInfo = null,
  creationBlock = sbtInfo?.creationBlock ?? null,
  blockNumber = 0,
}: BuildSbtActivityCacheEntryInput): SbtActivityCacheEntry => ({
  schemaVersion: SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION,
  sbtAddress,
  sbtInfo,
  mintedAddresses: [],
  burnedAddresses: [],
  blockNumber,
  creationBlock,
  mintedCountByAddress: {},
  burnedCountByAddress: {},
  mintedEventCount: 0,
  burnedEventCount: 0,
  historySummary: { ...EMPTY_HISTORY_SUMMARY },
  countsLoaded: false,
});

export const applySbtActivityCacheEntryUpdate = (
  entry: SbtActivityCacheEntry | LegacySbtActivityCacheEntry,
  { account, burned, eventBlockNumber }: ApplySbtActivityCacheEntryUpdateInput,
): SbtActivityCacheEntry => {
  const versionedEntry = hydrateSbtActivityCacheEntry(entry);
  if (!versionedEntry) {
    throw new TypeError('Invalid SBT activity cache entry.');
  }
  entry = versionedEntry;
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
