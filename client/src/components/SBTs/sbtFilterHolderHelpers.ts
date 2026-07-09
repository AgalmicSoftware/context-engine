import { asSelectedSbtEntry } from './sbtFilterSelectionHelpers';
import type { SbtFilterSelectedSbtEntry } from './sbtFilterSelectionHelpers';

type UnknownRecord = Record<string, unknown>;

export type AddressCountMap = Record<string, number>;

type HistorySummaryCountArgs = {
  burnedCountByAddress?: unknown;
  burnedEventCount?: unknown;
  mintedCountByAddress?: unknown;
  mintedEventCount?: unknown;
};

type SbtFilterHolderRevisionKeyArgs = {
  burnedCountFingerprint?: unknown;
  burnedListFingerprint?: unknown;
  countsLoaded?: unknown;
  creationBlock?: unknown;
  mintedCountFingerprint?: unknown;
  mintedListFingerprint?: unknown;
  netKey?: unknown;
  sbtAddress?: unknown;
  sbtCacheRevision?: unknown;
  sbtSlug?: unknown;
  shouldUseEntryCountMaps?: unknown;
};

type ResolveSbtFilterCreationBlockArgs = {
  entry?: unknown;
  entrySbtInfo?: unknown;
  sbtInfoRecord?: unknown;
  sbtRecord?: unknown;
};

type ResolveSbtFilterEntryCountMapUsageArgs = {
  entry?: unknown;
  entryBurned?: unknown;
  entryBurnedCountMap?: unknown;
  entryMinted?: unknown;
  entryMintedCountMap?: unknown;
  rawEntryBurnedCounts?: unknown;
  rawEntryMintedCounts?: unknown;
};

type SbtFilterEntryCountMapUsage = {
  checkpointBackedPartialCounts: boolean;
  hasAuthoritativeEntryCountMaps: boolean;
  hasStructuredEntryCountMaps: boolean;
  shouldUseEntryCountMaps: boolean;
};

type SbtFilterHolderRequestKeyArgs = {
  fromBlock?: unknown;
  netKey?: unknown;
  sbtAddress?: unknown;
  sbtSlug?: unknown;
};

type BuildSbtFilterHolderFetchResultArgs = {
  counts?: unknown;
  resolveHoldersSet?:
    ((mintedCountByAddress: AddressCountMap, burnedCountByAddress: AddressCountMap) => Set<string>) | null;
};

type BuildSbtFilterFetchedHolderCacheEntryPatchArgs = {
  fetched?: Partial<SbtFilterHolderFetchResult> | null;
};

type BuildSbtFilterFetchedHolderRevisionKeyArgs = {
  fetched?: Partial<SbtFilterHolderFetchResult> | null;
  fromBlock?: unknown;
  netKey?: unknown;
  sbtAddress?: unknown;
  sbtCacheRevision?: unknown;
  sbtSlug?: unknown;
};

type BuildSbtFilterHolderSelectionSetsArgs = {
  excludedSBTGroups?: unknown;
  excludedSBTGroupsCreator?: unknown;
  excludedSBTGroupsResponder?: unknown;
  sbtHoldersMap?: SbtHolderSetMap;
  selectedSBTGroups?: unknown;
  selectedSBTGroupsCreator?: unknown;
  selectedSBTGroupsResponder?: unknown;
};

type SbtFilterHolderSelectionSets = {
  excludedAddressHolderSet: Set<string>;
  excludedCreatorHolderSet: Set<string>;
  excludedResponderHolderSet: Set<string>;
  selectedAddressHolderSet: Set<string>;
  selectedCreatorHolderSet: Set<string>;
  selectedResponderHolderSet: Set<string>;
};

export type SbtFilterHolderFetchResult = {
  burnedAddresses: string[];
  burnedCountByAddress: AddressCountMap;
  burnedEventCount: number;
  holdersSet: Set<string>;
  mintedAddresses: string[];
  mintedCountByAddress: AddressCountMap;
  mintedEventCount: number;
  scannedToBlock: number | null;
};

export type SbtHolderSetMap = Record<string, Set<string>>;

const asHolderRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

export const normalizeAddressCountMap = (value: unknown = null): AddressCountMap => {
  const out: AddressCountMap = {};
  Object.entries(asHolderRecord(value)).forEach(([addrRaw, countRaw]) => {
    const addr = String(addrRaw || '').toLowerCase();
    if (!addr) return;
    const count = Math.max(0, Math.floor(Number(countRaw || 0)));
    if (count <= 0) return;
    out[addr] = count;
  });
  return out;
};

export const countMapFingerprint = (value: unknown = null): string => {
  const entries = Object.entries(normalizeAddressCountMap(value)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (!entries.length) return 'nil';
  let hash = 0;
  entries.forEach(([addr, count]) => {
    const token = `${addr}:${count}`;
    for (let i = 0; i < token.length; i += 1) {
      hash = (hash * 31 + token.charCodeAt(i)) | 0;
    }
    hash = (hash * 131 + 1) | 0;
  });
  return `${entries.length}:${hash}`;
};

export const resolveSbtFilterEntryCountMapUsage = ({
  entry = null,
  entryBurned = null,
  entryBurnedCountMap = {},
  entryMinted = null,
  entryMintedCountMap = {},
  rawEntryBurnedCounts = null,
  rawEntryMintedCounts = null,
}: ResolveSbtFilterEntryCountMapUsageArgs = {}): SbtFilterEntryCountMapUsage => {
  const entryRecord = asHolderRecord(entry);
  const mintedCountMapRecord = asHolderRecord(entryMintedCountMap);
  const burnedCountMapRecord = asHolderRecord(entryBurnedCountMap);
  const checkpointBackedPartialCounts =
    entryRecord.countsLoaded !== true &&
    !!entryRecord.countsScanCheckpoint &&
    typeof entryRecord.countsScanCheckpoint === 'object';
  const hasStructuredEntryCountMaps =
    (!!rawEntryMintedCounts && typeof rawEntryMintedCounts === 'object' && !Array.isArray(rawEntryMintedCounts)) ||
    (!!rawEntryBurnedCounts && typeof rawEntryBurnedCounts === 'object' && !Array.isArray(rawEntryBurnedCounts));
  const hasAuthoritativeEntryCountMaps =
    Object.keys(mintedCountMapRecord).length > 0 ||
    Object.keys(burnedCountMapRecord).length > 0 ||
    (entryRecord.countsLoaded === true && hasStructuredEntryCountMaps && !entryMinted && !entryBurned);
  return {
    checkpointBackedPartialCounts,
    hasAuthoritativeEntryCountMaps,
    hasStructuredEntryCountMaps,
    shouldUseEntryCountMaps: !checkpointBackedPartialCounts && hasAuthoritativeEntryCountMaps,
  };
};

export const computeHolderListFingerprint = (addresses: unknown): string => {
  if (!Array.isArray(addresses)) return 'nil';
  let hash = 0;
  for (let i = 0; i < addresses.length; i += 1) {
    const normalized = String(addresses[i] || '').toLowerCase();
    for (let j = 0; j < normalized.length; j += 1) {
      hash = (hash * 31 + normalized.charCodeAt(j)) | 0;
    }
    hash = (hash * 131 + 1) | 0;
  }
  return `${addresses.length}:${hash}`;
};

export const buildSbtFilterHolderRevisionKey = ({
  burnedCountFingerprint = '',
  burnedListFingerprint = '',
  countsLoaded = false,
  creationBlock = '',
  mintedCountFingerprint = '',
  mintedListFingerprint = '',
  netKey = '',
  sbtAddress = '',
  sbtCacheRevision = 0,
  sbtSlug = '',
  shouldUseEntryCountMaps = false,
}: SbtFilterHolderRevisionKeyArgs = {}): string =>
  [
    String(sbtSlug || ''),
    String(netKey || ''),
    String(sbtAddress || ''),
    String(sbtCacheRevision || 0),
    String(countsLoaded === true ? 1 : 0),
    String(shouldUseEntryCountMaps ? 1 : 0),
    String(mintedCountFingerprint),
    String(burnedCountFingerprint),
    String(mintedListFingerprint),
    String(burnedListFingerprint),
    String(creationBlock ?? ''),
  ].join('|');

export const resolveSbtFilterCreationBlock = ({
  entry = null,
  entrySbtInfo = null,
  sbtInfoRecord = null,
  sbtRecord = null,
}: ResolveSbtFilterCreationBlockArgs = {}): unknown => {
  const entryRecord = asHolderRecord(entry);
  const entryInfoRecord = asHolderRecord(entrySbtInfo);
  const selectedSbtRecord = asHolderRecord(sbtRecord);
  const selectedSbtInfoRecord = asHolderRecord(sbtInfoRecord);
  return (
    entryRecord.creationBlock ??
    entryInfoRecord.creationBlock ??
    selectedSbtRecord.creationBlock ??
    selectedSbtInfoRecord.creationBlock
  );
};

export const resolveSbtFilterHolderScanFromBlock = (rawCreationBlock: unknown): number => {
  const creationBlock = rawCreationBlock != null ? Number(rawCreationBlock) : NaN;
  return Number.isFinite(creationBlock) && creationBlock >= 0 ? Math.floor(creationBlock) : 0;
};

export const buildSbtFilterHolderRequestKey = ({
  fromBlock = 0,
  netKey = '',
  sbtAddress = '',
  sbtSlug = '',
}: SbtFilterHolderRequestKeyArgs = {}): string =>
  [String(sbtSlug || ''), String(netKey || ''), String(sbtAddress || ''), String(fromBlock || 0)].join('|');

export const setBoundedSbtHolderMemoEntry = (
  memo: Map<string, Set<string>>,
  key: unknown,
  value: Set<string>,
  maxEntries: number,
): void => {
  const memoKey = String(key || '');
  if (!memoKey) return;
  if (memo.has(memoKey)) {
    memo.delete(memoKey);
  }
  while (memo.size >= maxEntries) {
    const oldest = memo.keys().next();
    if (oldest.done) break;
    memo.delete(oldest.value);
  }
  memo.set(memoKey, value);
};

export const buildHistorySummaryFromCounts = ({
  mintedCountByAddress = {},
  burnedCountByAddress = {},
  mintedEventCount = 0,
  burnedEventCount = 0,
}: HistorySummaryCountArgs = {}) => {
  const mintedMap = normalizeAddressCountMap(mintedCountByAddress);
  const burnedMap = normalizeAddressCountMap(burnedCountByAddress);
  const sumCounts = (value: AddressCountMap = {}) =>
    Object.values(value).reduce((sum, count) => sum + Math.max(0, Math.floor(Number(count || 0))), 0);
  let activeSupply = 0;
  let currentHolderCount = 0;
  Object.keys(mintedMap).forEach((addr) => {
    const minted = Math.max(0, Math.floor(Number(mintedMap[addr] || 0)));
    const burned = Math.max(0, Math.floor(Number(burnedMap[addr] || 0)));
    const net = Math.max(0, minted - burned);
    if (net > 0) currentHolderCount += 1;
    activeSupply += net;
  });
  return {
    totalMinted: String(Math.max(0, Math.floor(Number(mintedEventCount || 0))) || sumCounts(mintedMap)),
    totalBurned: String(Math.max(0, Math.floor(Number(burnedEventCount || 0))) || sumCounts(burnedMap)),
    activeSupply: String(activeSupply),
    currentHolderCount: String(currentHolderCount),
    historicalHolderCount: String(Object.keys(mintedMap).length),
  };
};

export const buildNetHoldersSet = (mintedAddresses: unknown = [], burnedAddresses: unknown = []): Set<string> => {
  const burnedSet = new Set<string>(
    (Array.isArray(burnedAddresses) ? burnedAddresses : []).map((addr) => String(addr || '').toLowerCase()),
  );
  const holders = new Set<string>();
  (Array.isArray(mintedAddresses) ? mintedAddresses : []).forEach((addr) => {
    const lower = String(addr || '').toLowerCase();
    if (!lower || burnedSet.has(lower)) return;
    holders.add(lower);
  });
  return holders;
};

export const buildNetHoldersSetFromCounts = (
  mintedCountByAddress: unknown = {},
  burnedCountByAddress: unknown = {},
): Set<string> => {
  const mintedMap = normalizeAddressCountMap(mintedCountByAddress);
  const burnedMap = normalizeAddressCountMap(burnedCountByAddress);
  const holders = new Set<string>();
  Object.keys(mintedMap).forEach((addr) => {
    const minted = Math.max(0, Math.floor(Number(mintedMap[addr] || 0)));
    const burned = Math.max(0, Math.floor(Number(burnedMap[addr] || 0)));
    if (minted - burned > 0) {
      holders.add(addr);
    }
  });
  return holders;
};

export const buildSbtFilterHolderFetchResult = ({
  counts = null,
  resolveHoldersSet = null,
}: BuildSbtFilterHolderFetchResultArgs = {}): SbtFilterHolderFetchResult => {
  const countsRecord = asHolderRecord(counts);
  const mintedCountByAddress = normalizeAddressCountMap(countsRecord.mintedCountByAddress);
  const burnedCountByAddress = normalizeAddressCountMap(countsRecord.burnedCountByAddress);
  const holdersResolver = typeof resolveHoldersSet === 'function' ? resolveHoldersSet : buildNetHoldersSetFromCounts;

  return {
    mintedAddresses: Object.keys(mintedCountByAddress),
    burnedAddresses: Object.keys(burnedCountByAddress),
    mintedCountByAddress,
    burnedCountByAddress,
    mintedEventCount: Math.max(0, Math.floor(Number(countsRecord.mintedEventCount || 0))),
    burnedEventCount: Math.max(0, Math.floor(Number(countsRecord.burnedEventCount || 0))),
    scannedToBlock: Number.isFinite(Number(countsRecord.scannedToBlock))
      ? Math.floor(Number(countsRecord.scannedToBlock))
      : null,
    holdersSet: holdersResolver(mintedCountByAddress, burnedCountByAddress),
  };
};

export const buildSbtFilterFetchedHolderCacheEntryPatch = ({
  fetched = null,
}: BuildSbtFilterFetchedHolderCacheEntryPatchArgs = {}): UnknownRecord => {
  const mintedAddresses = fetched?.mintedAddresses || [];
  const burnedAddresses = fetched?.burnedAddresses || [];
  const mintedCountByAddress = fetched?.mintedCountByAddress || {};
  const burnedCountByAddress = fetched?.burnedCountByAddress || {};
  const mintedEventCount = fetched?.mintedEventCount || 0;
  const burnedEventCount = fetched?.burnedEventCount || 0;

  return {
    mintedAddresses,
    burnedAddresses,
    mintedCountByAddress,
    burnedCountByAddress,
    mintedEventCount,
    burnedEventCount,
    historySummary: buildHistorySummaryFromCounts({
      mintedCountByAddress,
      burnedCountByAddress,
      mintedEventCount,
      burnedEventCount,
    }),
    blockNumber: Number.isFinite(Number(fetched?.scannedToBlock))
      ? Math.floor(Number(fetched?.scannedToBlock))
      : undefined,
    countsLoaded: true,
    countsScanCheckpoint: null,
  };
};

export const buildSbtFilterFetchedHolderRevisionKey = ({
  fetched = null,
  fromBlock = 0,
  netKey = '',
  sbtAddress = '',
  sbtCacheRevision = 0,
  sbtSlug = '',
}: BuildSbtFilterFetchedHolderRevisionKeyArgs = {}): string => {
  const mintedAddresses = fetched?.mintedAddresses || [];
  const burnedAddresses = fetched?.burnedAddresses || [];
  const mintedCountByAddress = fetched?.mintedCountByAddress || {};
  const burnedCountByAddress = fetched?.burnedCountByAddress || {};

  return buildSbtFilterHolderRevisionKey({
    sbtSlug,
    netKey,
    sbtAddress,
    sbtCacheRevision,
    countsLoaded: true,
    shouldUseEntryCountMaps: true,
    mintedCountFingerprint: countMapFingerprint(mintedCountByAddress),
    burnedCountFingerprint: countMapFingerprint(burnedCountByAddress),
    mintedListFingerprint: computeHolderListFingerprint(mintedAddresses),
    burnedListFingerprint: computeHolderListFingerprint(burnedAddresses),
    creationBlock: fromBlock || 0,
  });
};

export const buildHolderUnionSet = (sbtEntries: unknown = [], sbtHoldersMap: SbtHolderSetMap = {}): Set<string> => {
  const union = new Set<string>();
  (Array.isArray(sbtEntries) ? sbtEntries : []).forEach((sbtInput) => {
    const sbt = asSelectedSbtEntry(sbtInput);
    const sbtAddr = String(sbt.address || '').toLowerCase();
    if (!sbtAddr) return;
    const holders = sbtHoldersMap[sbtAddr];
    if (!holders || holders.size === 0) return;
    holders.forEach((holder) => union.add(holder));
  });
  return union;
};

export const buildSbtFilterHolderSelectionSets = ({
  excludedSBTGroups = [],
  excludedSBTGroupsCreator = [],
  excludedSBTGroupsResponder = [],
  sbtHoldersMap = {},
  selectedSBTGroups = [],
  selectedSBTGroupsCreator = [],
  selectedSBTGroupsResponder = [],
}: BuildSbtFilterHolderSelectionSetsArgs = {}): SbtFilterHolderSelectionSets => ({
  selectedCreatorHolderSet: buildHolderUnionSet(selectedSBTGroupsCreator, sbtHoldersMap),
  excludedCreatorHolderSet: buildHolderUnionSet(excludedSBTGroupsCreator, sbtHoldersMap),
  selectedResponderHolderSet: buildHolderUnionSet(selectedSBTGroupsResponder, sbtHoldersMap),
  excludedResponderHolderSet: buildHolderUnionSet(excludedSBTGroupsResponder, sbtHoldersMap),
  selectedAddressHolderSet: buildHolderUnionSet(selectedSBTGroups, sbtHoldersMap),
  excludedAddressHolderSet: buildHolderUnionSet(excludedSBTGroups, sbtHoldersMap),
});
