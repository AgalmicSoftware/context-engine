import {
  mergeSbtCountsPayload,
  normalizeSbtCountMap,
  sumSbtCountMap,
  type SbtCountMap,
  type SbtCountsPayload,
} from './sbtCountHelpers.js';
import { buildSbtHistorySummaryFromCounts } from './sbtHistoryHelpers.js';

export const SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION = 2 as const;

type PendingSbtActivity = { account: string; burned: boolean; blockNumber: number };
export interface SbtActivityCacheEntry {
  schemaVersion: typeof SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION;
  sbtAddress?: string;
  sbtInfo?: ({ creationBlock?: unknown } & Record<string, unknown>) | null;
  mintedAddresses?: string[];
  burnedAddresses?: string[];
  /** Contiguous scan coverage, never advanced by a live event. */
  blockNumber: number;
  lastActivityBlock: number;
  coveredCounts: SbtCountsPayload;
  pendingActivity: Record<string, PendingSbtActivity>;
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

type SbtActivityPatch = Omit<Partial<SbtActivityCacheEntry>, 'schemaVersion'> & Record<string, unknown>;
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
  eventId: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const asPatch = (value: unknown): SbtActivityPatch => (isRecord(value) ? (value as SbtActivityPatch) : {});
const normalizedCounts = (value: unknown): SbtCountsPayload => {
  const counts = asPatch(value);
  const mintedCountByAddress = normalizeSbtCountMap(counts.mintedCountByAddress);
  const burnedCountByAddress = normalizeSbtCountMap(counts.burnedCountByAddress);
  return {
    mintedCountByAddress,
    burnedCountByAddress,
    mintedEventCount: Math.max(Number(counts.mintedEventCount) || 0, sumSbtCountMap(mintedCountByAddress)),
    burnedEventCount: Math.max(Number(counts.burnedEventCount) || 0, sumSbtCountMap(burnedCountByAddress)),
  };
};

const isCurrentSbtActivityEntry = (value: unknown): value is SbtActivityCacheEntry =>
  isRecord(value) &&
  value.schemaVersion === SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION &&
  isRecord(value.coveredCounts) &&
  isRecord(value.pendingActivity) &&
  typeof value.blockNumber === 'number' &&
  Number.isFinite(value.blockNumber);

export const hydrateSbtActivityCacheEntry = (value: unknown): SbtActivityCacheEntry | null =>
  isCurrentSbtActivityEntry(value) ? value : null;

const materializeCounts = (entry: SbtActivityCacheEntry): SbtActivityCacheEntry => {
  let counts = normalizedCounts(entry.coveredCounts);
  for (const event of Object.values(entry.pendingActivity)) {
    counts = mergeSbtCountsPayload(
      counts,
      event.burned
        ? { burnedCountByAddress: { [event.account]: 1 }, burnedEventCount: 1 }
        : { mintedCountByAddress: { [event.account]: 1 }, mintedEventCount: 1 },
    );
  }
  Object.assign(entry, counts, {
    mintedAddresses: Object.keys(counts.mintedCountByAddress),
    burnedAddresses: Object.keys(counts.burnedCountByAddress),
    historySummary: buildSbtHistorySummaryFromCounts(counts),
  });
  return entry;
};

export const buildSbtActivityCacheEntry = ({
  sbtAddress,
  sbtInfo = null,
  creationBlock = sbtInfo?.creationBlock ?? null,
  blockNumber = 0,
}: BuildSbtActivityCacheEntryInput): SbtActivityCacheEntry =>
  materializeCounts({
    schemaVersion: SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION,
    sbtAddress,
    sbtInfo,
    creationBlock,
    blockNumber: 0,
    lastActivityBlock: blockNumber,
    coveredCounts: normalizedCounts(null),
    pendingActivity: {},
    countsLoaded: false,
  });

/** Metadata cannot establish scan coverage or replace activity. */
export const mergeSbtActivityCacheEntryMetadata = (currentIn: unknown, patchIn: unknown): SbtActivityCacheEntry => {
  const patch = asPatch(patchIn);
  const current =
    hydrateSbtActivityCacheEntry(currentIn) ||
    buildSbtActivityCacheEntry({ sbtAddress: String(patch.sbtAddress || '') });
  return {
    ...patch,
    ...current,
    sbtAddress: patch.sbtAddress || current.sbtAddress,
    creationBlock: patch.creationBlock ?? current.creationBlock,
    lastActivityBlock: Math.max(current.lastActivityBlock, Number(patch.lastActivityBlock) || 0),
    sbtInfo: current.sbtInfo || patch.sbtInfo ? { ...(current.sbtInfo || {}), ...(patch.sbtInfo || {}) } : null,
    ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
    ...(patch.sessionSlug !== undefined ? { sessionSlug: patch.sessionSlug } : {}),
    ...(patch.sessionSlugExplicit !== undefined ? { sessionSlugExplicit: patch.sessionSlugExplicit } : {}),
  };
};

/** A scan supplies cumulative covered counts; pending live events are overlaid only beyond that range. */
export const mergeSbtActivityCacheEntryCounts = (currentIn: unknown, scanIn: unknown): SbtActivityCacheEntry => {
  const current = hydrateSbtActivityCacheEntry(currentIn);
  const scan = asPatch(scanIn);
  const next = mergeSbtActivityCacheEntryMetadata(current, scan);
  const scanBlock = scan.blockNumber == null ? NaN : Number(scan.blockNumber);
  const currentCheckpoint = asPatch(current?.countsScanCheckpoint);
  const scanCheckpoint = asPatch(scan.countsScanCheckpoint);
  const checkpointBlock = Number(currentCheckpoint.blockNumber) || 0;
  const acceptsScan =
    scan.countsLoaded === true &&
    Number.isFinite(scanBlock) &&
    scanBlock >= Math.max(next.blockNumber, checkpointBlock);
  if (acceptsScan) {
    next.blockNumber = scanBlock;
    next.coveredCounts = normalizedCounts(scan.coveredCounts || scan);
    next.countsLoaded = true;
    next.countsScanCheckpoint = null;
  } else if ((Number(scanCheckpoint.blockNumber) || 0) > checkpointBlock) {
    next.countsScanCheckpoint = scan.countsScanCheckpoint;
  }
  next.pendingActivity = Object.fromEntries(
    Object.entries({
      ...(hydrateSbtActivityCacheEntry(scanIn)?.pendingActivity || {}),
      ...(current?.pendingActivity || {}),
    }).filter(([, event]) => event.blockNumber > next.blockNumber),
  );
  next.lastActivityBlock = Math.max(
    next.lastActivityBlock,
    ...Object.values(next.pendingActivity).map((event) => event.blockNumber),
  );
  return materializeCounts(next);
};

export const applySbtActivityCacheEntryUpdate = (
  entry: SbtActivityCacheEntry,
  { account, burned, eventBlockNumber, eventId }: ApplySbtActivityCacheEntryUpdateInput,
): SbtActivityCacheEntry => {
  if (!hydrateSbtActivityCacheEntry(entry)) throw new TypeError('Invalid SBT activity cache entry.');
  if (!eventId || !Number.isFinite(eventBlockNumber))
    throw new TypeError('SBT activity requires an event identity and block.');
  if (eventBlockNumber <= entry.blockNumber) return entry;
  entry.pendingActivity[eventId] = { account: String(account).toLowerCase(), burned, blockNumber: eventBlockNumber };
  entry.lastActivityBlock = Math.max(entry.lastActivityBlock, eventBlockNumber);
  return materializeCounts(entry);
};

/** Discard incompatible entries and their discovery cursor so they can be rebuilt. */
export const discardOutdatedSbtActivityEntries = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const next = { ...value };
  for (const [network, bucket] of Object.entries(next)) {
    if (!isRecord(bucket) || !isRecord(bucket.sbtList)) continue;
    const entries = Object.entries(bucket.sbtList);
    const valid = entries.filter(([, entry]) => hydrateSbtActivityCacheEntry(entry));
    if (valid.length !== entries.length) {
      next[network] = { sbtList: Object.fromEntries(valid), lastBlock: 0 };
    }
  }
  return next;
};
