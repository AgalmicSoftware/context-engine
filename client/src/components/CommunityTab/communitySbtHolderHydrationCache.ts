import { updateCacheAtomic } from '../../utilities/cache/cacheScripts.js';
import { mergeSbtActivityCacheEntryCounts } from '../../utilities/sbt/sbtActivityCacheEntry.js';

type CommunitySbtCacheEntry = {
  blockNumber?: unknown;
  burnedAddresses?: unknown;
  burnedCountByAddress?: unknown;
  burnedEventCount?: unknown;
  countsScanCheckpoint?: unknown;
  mintedAddresses?: unknown;
  mintedCountByAddress?: unknown;
  mintedEventCount?: unknown;
  sbtAddress?: unknown;
};

type CommunitySbtNetworkCache = Record<string, unknown> & {
  sbtList?: Record<string, CommunitySbtCacheEntry>;
};

type CommunitySbtCache = Record<string, CommunitySbtNetworkCache>;

type HolderCountsPayload = {
  burnedCountByAddress?: unknown;
  burnedEventCount?: unknown;
  mintedCountByAddress?: unknown;
  mintedEventCount?: unknown;
  scannedToBlock?: unknown;
};

export type CommunitySbtHolderHydrationResult = {
  addr?: unknown;
  burnedAddresses?: unknown;
  counts?: HolderCountsPayload | null;
  countsOk?: boolean;
  lower?: string;
  mintedAddresses?: unknown;
} | null;

const asObject = <TRecord extends Record<string, unknown>>(value: unknown): TRecord =>
  value && typeof value === 'object' ? (value as TRecord) : ({} as TRecord);

export const persistCommunitySbtHolderHydrationResults = async ({
  slug,
  netKey,
  results,
}: {
  slug: string;
  netKey: string;
  results: CommunitySbtHolderHydrationResult[];
}) =>
  updateCacheAtomic<CommunitySbtCache>('sbtCache', slug, (current) => {
    const nextCache = asObject<CommunitySbtCache>(current);
    const currentNet = asObject<CommunitySbtNetworkCache>(nextCache[netKey]);
    const currentList = {
      ...(currentNet.sbtList || {}),
    };

    results.forEach((res) => {
      if (!res || res.countsOk === false || !res.lower) return;
      const existing = currentList[res.lower] || {};
      currentList[res.lower] = mergeSbtActivityCacheEntryCounts(existing, {
        sbtAddress: existing.sbtAddress || res.addr,
        mintedAddresses: res.mintedAddresses,
        burnedAddresses: res.burnedAddresses,
        countsLoaded: true,
        mintedCountByAddress: res.counts?.mintedCountByAddress || {},
        burnedCountByAddress: res.counts?.burnedCountByAddress || {},
        mintedEventCount: res.counts?.mintedEventCount || 0,
        burnedEventCount: res.counts?.burnedEventCount || 0,
        blockNumber: Number.isFinite(Number(res.counts?.scannedToBlock))
          ? Math.floor(Number(res.counts?.scannedToBlock))
          : null,
        countsScanCheckpoint: null,
      });
    });

    nextCache[netKey] = {
      ...currentNet,
      sbtList: currentList,
    };
    return nextCache;
  });
