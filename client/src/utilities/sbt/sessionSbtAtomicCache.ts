type CacheRecord = Record<string, unknown>;
type CacheUpdater = (current: CacheRecord | null) => CacheRecord | Promise<CacheRecord>;
type AtomicPort = (slug: string, updater: CacheUpdater) => Promise<unknown>;

interface SessionSbtAtomicHost {
  updateSbtCacheAtomic?: AtomicPort;
  updateUserCacheAtomic?: AtomicPort;
}

interface SessionSbtAtomicWriterOptions {
  host: SessionSbtAtomicHost;
  mergeLegacyNumericNetworkKey: (cache: CacheRecord, networkID: string) => boolean;
}

interface HolderSbtEntry extends CacheRecord {
  sbtAddress?: unknown;
  sbtInfo?: CacheRecord | null;
}

interface MergeHolderAdditionsOptions {
  baseTo: number;
  networkID: string;
  scanTimestamp: number;
  userSbtAdditions: Map<string, Map<string, HolderSbtEntry>>;
}

interface CheckpointWriteQueueOptions<T> {
  minIntervalMs: number;
  write: (value: T) => Promise<unknown>;
}

interface MergeCountsCheckpointOptions {
  checkpoint: CacheRecord;
  metadata: CacheRecord | null;
  normalizeCheckpoint: (value: unknown) => CacheRecord | null;
  sbtAddress: string;
}

const isCacheRecord = (value: unknown): value is CacheRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const markPersistenceFailure = (error: unknown, cacheName: string, slug: string) => {
  const failure = error instanceof Error ? error : new Error(String(error));
  (failure as Error & { cachePersistenceFailed?: boolean }).cachePersistenceFailed = true;
  failure.message = `${cacheName} persistence failed for ${slug}: ${failure.message}`;
  return failure;
};

export const createSessionSbtAtomicCacheWriter = ({
  host,
  mergeLegacyNumericNetworkKey,
}: SessionSbtAtomicWriterOptions) => {
  const callPort = async (port: AtomicPort | undefined, cacheName: string, slug: string, updater: CacheUpdater) => {
    if (typeof port !== 'function') {
      throw markPersistenceFailure(
        new Error(`Session cache persistence requires an atomic ${cacheName} port.`),
        cacheName,
        slug,
      );
    }
    try {
      return await port(slug, updater);
    } catch (error) {
      throw markPersistenceFailure(error, cacheName, slug);
    }
  };

  const updateSbtCacheAtomic = (slug: string, updater: CacheUpdater) =>
    callPort(host.updateSbtCacheAtomic, 'sbtCache', slug, updater);
  const updateUserCacheAtomic = (slug: string, updater: CacheUpdater) =>
    callPort(host.updateUserCacheAtomic, 'userCache', slug, updater);
  // Regression guard: mutate the latest queued snapshot by network. Feeding a
  // previously-read whole cache here erases concurrent realtime or scan work.
  const updateSbtNetworkCacheAtomic = (
    slug: string,
    networkID: string,
    initialLastBlock: number,
    mutate: (networkCache: CacheRecord, rootCache: CacheRecord) => void,
  ) =>
    updateSbtCacheAtomic(slug, (currentIn) => {
      const next = isCacheRecord(currentIn) ? { ...currentIn } : {};
      mergeLegacyNumericNetworkKey(next, String(networkID));
      const currentNetwork = isCacheRecord(next[networkID]) ? next[networkID] : {};
      const networkCache = {
        ...currentNetwork,
        sbtList: isCacheRecord(currentNetwork.sbtList) ? { ...currentNetwork.sbtList } : {},
        lastBlock: Math.max(Number(currentNetwork.lastBlock) || 0, Number(initialLastBlock) || 0),
      };
      next[networkID] = networkCache;
      mutate(networkCache, next);
      return next;
    });

  return { updateSbtNetworkCacheAtomic, updateUserCacheAtomic };
};

export const mergeSessionSbtHolderAdditions = (
  currentIn: CacheRecord | null,
  { baseTo, networkID, scanTimestamp, userSbtAdditions }: MergeHolderAdditionsOptions,
): CacheRecord => {
  const next = isCacheRecord(currentIn) ? { ...currentIn } : {};
  userSbtAdditions.forEach((additions, holderLower) => {
    const holderNode = isCacheRecord(next[holderLower]) ? { ...next[holderLower] } : {};
    const currentChain = isCacheRecord(holderNode[networkID]) ? holderNode[networkID] : {};
    const currentData = isCacheRecord(currentChain.data) ? currentChain.data : {};
    const sbts: HolderSbtEntry[] = Array.isArray(currentData.sbts) ? currentData.sbts.slice() : [];
    const indexByAddress = new Map(sbts.map((entry, index) => [String(entry?.sbtAddress || '').toLowerCase(), index]));
    additions.forEach((entry, address) => {
      const existingIndex = indexByAddress.get(address);
      if (existingIndex == null) {
        indexByAddress.set(address, sbts.length);
        sbts.push(entry);
        return;
      }
      sbts[existingIndex] = {
        ...sbts[existingIndex],
        ...entry,
        sbtInfo: { ...(sbts[existingIndex]?.sbtInfo || {}), ...(entry.sbtInfo || {}) },
      };
    });
    holderNode[networkID] = {
      ...currentChain,
      lastBlockScanned: Math.max(Number(currentChain.lastBlockScanned) || 0, baseTo),
      lastScanTimestamp: Math.max(Number(currentChain.lastScanTimestamp) || 0, scanTimestamp),
      data: { ...currentData, sbts },
    };
    next[holderLower] = holderNode;
  });
  return next;
};

export const createSessionSbtCheckpointWriteQueue = <T>({ minIntervalMs, write }: CheckpointWriteQueueOptions<T>) => {
  let pending: T | null = null;
  let lastWriteMs = 0;
  let chain: Promise<unknown> = Promise.resolve();
  // Regression guard: checkpoint writes must remain ordered and awaitable;
  // fire-and-forget writes can land after the final entry and make scans rewind.
  const flush = ({ force = false } = {}) => {
    if (pending === null) return chain;
    const nowMs = Date.now();
    if (!force && nowMs - lastWriteMs < minIntervalMs) return chain;
    const value = pending;
    pending = null;
    lastWriteMs = nowMs;
    chain = chain.then(() => write(value));
    return chain;
  };
  const queue = (value: T, options: { force?: boolean } = {}) => {
    pending = value;
    return flush(options);
  };
  return { flush, queue };
};

export const mergeSessionSbtCountsCheckpointEntry = (
  currentIn: unknown,
  { checkpoint, metadata, normalizeCheckpoint, sbtAddress }: MergeCountsCheckpointOptions,
): CacheRecord | null => {
  const current = isCacheRecord(currentIn) ? currentIn : {};
  const checkpointBlock = Number(checkpoint.blockNumber);
  if (
    current.countsLoaded === true &&
    Number.isFinite(checkpointBlock) &&
    Number(current.blockNumber) >= checkpointBlock
  ) {
    return null;
  }
  const currentCheckpoint = normalizeCheckpoint(current.countsScanCheckpoint);
  if (
    Number.isFinite(Number(currentCheckpoint?.blockNumber)) &&
    Number(currentCheckpoint?.blockNumber) > checkpointBlock
  ) {
    return null;
  }
  return {
    ...current,
    sbtAddress,
    ...(metadata ? { sbtInfo: { ...(isCacheRecord(current.sbtInfo) ? current.sbtInfo : {}), ...metadata } } : {}),
    countsLoaded: false,
    countsScanCheckpoint: checkpoint,
  };
};
