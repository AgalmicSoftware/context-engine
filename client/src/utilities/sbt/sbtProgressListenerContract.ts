import type { SbtRealtimeEventCursor } from './sbtRealtimeCursorHelpers.js';

type CacheRecord = Record<string, unknown>;

export interface SbtLiveProgressPatch extends CacheRecord {
  currentBlock?: number;
  latestBlock?: number;
  slug?: string;
  updatedAtMs?: number;
}

export interface RemoveSbtRealtimeListenersOptions {
  removeFactory?: boolean;
  removeInstance?: boolean;
}

export interface SbtRealtimeEventLike extends CacheRecord {
  blockNumber?: number | string | null;
  logIndex?: number | string | null;
  sbtAddress?: string | null;
  to?: string | null;
  transactionIndex?: number | string | null;
  type?: string | null;
}

export type SbtRealtimeCursorRecord = SbtRealtimeEventCursor;

export interface SbtRealtimeListenerCleanupHandle {
  dispose: () => unknown;
}

export interface SbtHydrationQueueEntry {
  address: string;
  addressKey: string;
}

export const buildSbtHydrationQueueEntry = (
  addressIn: unknown,
  {
    ignoredAddressKeys = new Set<string>(),
    queuedAddressKeys = new Set<string>(),
  }: {
    ignoredAddressKeys?: ReadonlySet<string>;
    queuedAddressKeys?: ReadonlySet<string>;
  } = {},
): SbtHydrationQueueEntry | null => {
  const address = String(addressIn || '').trim();
  if (!address) return null;
  const addressKey = address.toLowerCase();
  if (ignoredAddressKeys.has(addressKey) || queuedAddressKeys.has(addressKey)) return null;
  return { address, addressKey };
};

export const buildSbtLightDiscoveryInFlightKey = ({
  force = false,
  forcedScopeSlug = '',
  sessionSlug = '',
}: {
  force?: boolean;
  forcedScopeSlug?: string;
  sessionSlug?: string;
} = {}): string => `${sessionSlug}|${forcedScopeSlug}|${force ? '1' : '0'}`;
