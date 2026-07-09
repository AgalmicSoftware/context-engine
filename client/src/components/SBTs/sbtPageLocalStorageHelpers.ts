type SbtPageQueuedJsonWritesLike = {
  get?: (key: string) => unknown;
};

type SbtPageStoredJsonReaderLike = {
  getItem?: (key: string) => string | null;
};

export type SerializeSbtPageLocalStorageJsonWriteArgs = {
  key?: unknown;
  value?: unknown;
};

export type SbtPageSerializedLocalStorageJsonWrite = {
  nextJson: string;
  storageKey: string;
};

export type ResolveSbtPageLocalStorageJsonWriteDecisionArgs = {
  cachedJson?: unknown;
  currentRaw?: unknown;
  nextJson?: unknown;
};

export type SbtPageLocalStorageJsonWriteDecision = 'adopt' | 'skip' | 'write';

export type ReadSbtPageQueuedOrStoredLocalStorageJsonArgs<T extends Record<string, unknown>> = {
  fallback: T;
  key?: unknown;
  queuedWrites?: SbtPageQueuedJsonWritesLike | null;
  storageRef?: SbtPageStoredJsonReaderLike | null;
};

export type AppendSbtPageTransactionHashArgs = {
  cacheObj?: unknown;
  txHash: string;
  userAddress?: unknown;
};

export type AppendSbtPageTransactionHashResult = {
  shouldWrite: boolean;
  txCache: Record<string, unknown>;
};

export type AppendSbtPageBookmarkArgs = {
  bookmarksObj?: unknown;
  sbtAddress?: unknown;
};

export type AppendSbtPageBookmarkResult = {
  bookmarks: Record<string, unknown>;
  shouldWrite: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const readSbtPageQueuedOrStoredLocalStorageJson = <T extends Record<string, unknown>>({
  fallback,
  key = '',
  queuedWrites = null,
  storageRef = null,
}: ReadSbtPageQueuedOrStoredLocalStorageJsonArgs<T>): T => {
  if (!storageRef) return fallback;
  const storageKey = String(key || '');
  if (!storageKey) return fallback;
  try {
    const pendingRaw = queuedWrites?.get ? queuedWrites.get(storageKey) : undefined;
    const raw = (typeof pendingRaw === 'string' ? pendingRaw : storageRef.getItem?.(storageKey)) || '';
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : fallback;
  } catch (_) {
    return fallback;
  }
};

export const serializeSbtPageLocalStorageJsonWrite = ({
  key = '',
  value = undefined,
}: SerializeSbtPageLocalStorageJsonWriteArgs = {}): SbtPageSerializedLocalStorageJsonWrite | null => {
  const storageKey = String(key || '');
  if (!storageKey) return null;
  try {
    const nextJson = JSON.stringify(value);
    if (typeof nextJson !== 'string') return null;
    return { storageKey, nextJson };
  } catch (_) {
    return null;
  }
};

export const resolveSbtPageLocalStorageJsonWriteDecision = ({
  cachedJson = '',
  currentRaw = '',
  nextJson = '',
}: ResolveSbtPageLocalStorageJsonWriteDecisionArgs = {}): SbtPageLocalStorageJsonWriteDecision => {
  const next = typeof nextJson === 'string' ? nextJson : '';
  if (cachedJson === next) return 'skip';
  if (currentRaw === next) return 'adopt';
  return 'write';
};

export const appendSbtPageTransactionHash = ({
  cacheObj = {},
  txHash,
  userAddress = '',
}: AppendSbtPageTransactionHashArgs): AppendSbtPageTransactionHashResult => {
  const txCache = isRecord(cacheObj) ? cacheObj : {};
  const userAddressLower = String(userAddress || '').toLowerCase();
  if (!userAddressLower) return { shouldWrite: false, txCache };

  if (!txCache[userAddressLower]) txCache[userAddressLower] = [];
  (txCache[userAddressLower] as string[]).push(txHash);
  return { shouldWrite: true, txCache };
};

export const appendSbtPageBookmark = ({
  bookmarksObj = {},
  sbtAddress = '',
}: AppendSbtPageBookmarkArgs = {}): AppendSbtPageBookmarkResult => {
  const bookmarks = isRecord(bookmarksObj) ? bookmarksObj : {};
  const address = String(sbtAddress || '');
  if (!address) return { bookmarks, shouldWrite: false };

  if (!bookmarks.sbts) bookmarks.sbts = [];
  const sbts = bookmarks.sbts as string[];
  if (!sbts.includes(address)) {
    sbts.push(address);
    return { bookmarks, shouldWrite: true };
  }
  return { bookmarks, shouldWrite: false };
};
