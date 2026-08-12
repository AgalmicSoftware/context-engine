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

const asEntryRecord = (value: unknown): LegacySbtActivityCacheEntry =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as LegacySbtActivityCacheEntry) } : {};

const mergeMonotonicCountMaps = (left: unknown, right: unknown): SbtCountMap => {
  const merged: SbtCountMap = {};
  for (const source of [left, right]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const [address, countIn] of Object.entries(source)) {
      const addressLower = String(address || '').toLowerCase();
      const count = Math.max(0, Math.floor(Number(countIn) || 0));
      if (!addressLower || count <= 0) continue;
      merged[addressLower] = Math.max(merged[addressLower] || 0, count);
    }
  }
  return merged;
};

const unionAddresses = (left: unknown, right: unknown): string[] =>
  Array.from(
    new Set(
      [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])]
        .map((address) => String(address || '').toLowerCase())
        .filter(Boolean),
    ),
  );

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

/** Merge metadata without allowing a delayed hydration to erase holder activity. */
export const mergeSbtActivityCacheEntryMetadata = (currentIn: unknown, patchIn: unknown): SbtActivityCacheEntry => {
  const current = asEntryRecord(currentIn);
  const patch = asEntryRecord(patchIn);
  const currentInfo = current.sbtInfo && typeof current.sbtInfo === 'object' ? current.sbtInfo : null;
  const patchInfo = patch.sbtInfo && typeof patch.sbtInfo === 'object' ? patch.sbtInfo : null;
  return hydrateSbtActivityCacheEntry({
    ...current,
    ...patch,
    sbtInfo: currentInfo || patchInfo ? { ...(currentInfo || {}), ...(patchInfo || {}) } : patch.sbtInfo ?? current.sbtInfo ?? null,
    blockNumber: Math.max(Number(current.blockNumber) || 0, Number(patch.blockNumber) || 0),
    mintedAddresses: current.mintedAddresses,
    burnedAddresses: current.burnedAddresses,
    mintedCountByAddress: current.mintedCountByAddress,
    burnedCountByAddress: current.burnedCountByAddress,
    mintedEventCount: current.mintedEventCount,
    burnedEventCount: current.burnedEventCount,
    countsLoaded: current.countsLoaded,
    countsScanCheckpoint: current.countsScanCheckpoint,
    historySummary: current.historySummary,
  }) as SbtActivityCacheEntry;
};

/** Merge a completed/partial scan monotonically with any newer realtime holder activity. */
export const mergeSbtActivityCacheEntryCounts = (currentIn: unknown, scanIn: unknown): SbtActivityCacheEntry => {
  const current = asEntryRecord(currentIn);
  const scan = asEntryRecord(scanIn);
  const mintedCountByAddress = mergeMonotonicCountMaps(current.mintedCountByAddress, scan.mintedCountByAddress);
  const burnedCountByAddress = mergeMonotonicCountMaps(current.burnedCountByAddress, scan.burnedCountByAddress);
  const mintedEventCount = Math.max(Number(current.mintedEventCount) || 0, Number(scan.mintedEventCount) || 0);
  const burnedEventCount = Math.max(Number(current.burnedEventCount) || 0, Number(scan.burnedEventCount) || 0);
  const blockCandidates = [current.blockNumber, scan.blockNumber]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => Number(value))
    .filter(Number.isFinite);
  const blockNumber = blockCandidates.length > 0 ? Math.max(...blockCandidates) : null;
  const checkpointBlock = Number(
    current.countsScanCheckpoint && typeof current.countsScanCheckpoint === 'object'
      ? (current.countsScanCheckpoint as { blockNumber?: unknown }).blockNumber
      : NaN,
  );
  const scanFinalized = scan.countsLoaded === true;
  const canClearCheckpoint = scanFinalized && (!Number.isFinite(checkpointBlock) || Number(scan.blockNumber) >= checkpointBlock);

  return hydrateSbtActivityCacheEntry({
    ...current,
    ...scan,
    sbtInfo: {
      ...(current.sbtInfo && typeof current.sbtInfo === 'object' ? current.sbtInfo : {}),
      ...(scan.sbtInfo && typeof scan.sbtInfo === 'object' ? scan.sbtInfo : {}),
    },
    blockNumber,
    mintedAddresses: unionAddresses(current.mintedAddresses, scan.mintedAddresses),
    burnedAddresses: unionAddresses(current.burnedAddresses, scan.burnedAddresses),
    mintedCountByAddress,
    burnedCountByAddress,
    mintedEventCount,
    burnedEventCount,
    countsLoaded: current.countsLoaded === true || scanFinalized,
    countsScanCheckpoint: canClearCheckpoint
      ? null
      : scan.countsScanCheckpoint || current.countsScanCheckpoint || null,
    historySummary:
      buildSbtHistorySummaryFromCounts({
        mintedCountByAddress,
        burnedCountByAddress,
        mintedEventCount,
        burnedEventCount,
      }) || normalizeSbtHistorySummary(scan.historySummary) || normalizeSbtHistorySummary(current.historySummary),
  }) as SbtActivityCacheEntry;
};

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
