export const SBT_PASSWORD_RECOVERY_STORAGE_KEY = 'ce:sbtPasswordRecovery:v1';
export const SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY = 'ce:sbtPasswordRecovery:v2';
export const SBT_PASSWORD_RECOVERY_INDEXED_DB_NAME = 'ce-sbt-password-recovery-keys';
export const SBT_PASSWORD_RECOVERY_ENVELOPE_VERSION = 1;
export const SBT_PASSWORD_RECOVERY_KIND = 'sbt-password-recovery';
export const SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

type IndexedDbLike = {
  deleteDatabase?: (name: string) => unknown;
};

type SbtPasswordRecoveryEntry = {
  chainId: number | null;
  sbtAddress: string;
  passwords: string[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

type SbtPasswordRecoveryStoreEnvelope = {
  v: typeof SBT_PASSWORD_RECOVERY_ENVELOPE_VERSION;
  kind: typeof SBT_PASSWORD_RECOVERY_KIND;
  updatedAt: number;
  entries: Record<string, SbtPasswordRecoveryEntry>;
};

type RecoveryScope = {
  chainId?: unknown;
  sbtAddress?: unknown;
  storage?: StorageLike | null;
  now?: number;
};

const tabMemoryEntries = new Map<string, SbtPasswordRecoveryEntry>();

const normalizeAddress = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeChainId = (value: unknown): number | null => {
  const chainId = Number(value || 0);
  return Number.isSafeInteger(chainId) && chainId > 0 ? chainId : null;
};

const normalizePasswords = (passwords: unknown): string[] => {
  const seen = new Set<string>();
  return (Array.isArray(passwords) ? passwords : [])
    .map((password) => String(password || '').trim())
    .filter((password) => {
      if (!password || seen.has(password)) return false;
      seen.add(password);
      return true;
    });
};

const getDefaultStorage = (name: 'localStorage' | 'sessionStorage'): StorageLike | null => {
  try {
    if (typeof window !== 'undefined' && window[name]) return window[name];
  } catch (_) {
    // Browser storage can be disabled by policy. Purging remains best effort.
  }
  return null;
};

const getDefaultIndexedDb = (): IndexedDbLike | null => {
  try {
    return typeof indexedDB !== 'undefined' ? indexedDB : null;
  } catch (_) {
    return null;
  }
};

export const purgeLegacySbtPasswordRecoveryArtifacts = ({
  indexedDbRef = getDefaultIndexedDb(),
  localStorageRef = getDefaultStorage('localStorage'),
  sessionStorageRef = getDefaultStorage('sessionStorage'),
  storage = null,
}: {
  indexedDbRef?: IndexedDbLike | null;
  localStorageRef?: StorageLike | null;
  sessionStorageRef?: StorageLike | null;
  storage?: StorageLike | null;
} = {}): { ok: true; status: 'purged' } => {
  const stores = new Set<StorageLike>(
    [storage, localStorageRef, sessionStorageRef].filter((candidate): candidate is StorageLike => !!candidate),
  );
  stores.forEach((storageRef) => {
    try {
      storageRef.removeItem?.(SBT_PASSWORD_RECOVERY_STORAGE_KEY);
      storageRef.removeItem?.(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY);
    } catch (_) {
      // Clearing one unavailable storage surface must not block the remaining purge.
    }
  });
  try {
    indexedDbRef?.deleteDatabase?.(SBT_PASSWORD_RECOVERY_INDEXED_DB_NAME);
  } catch (_) {
    // The database may be unavailable, blocked, or already absent.
  }
  return { ok: true, status: 'purged' };
};

export const getSbtPasswordRecoveryKey = ({
  chainId,
  sbtAddress,
}: {
  chainId?: unknown;
  sbtAddress?: unknown;
} = {}): string => {
  const address = normalizeAddress(sbtAddress);
  if (!address) return '';
  return `${normalizeChainId(chainId) || 'unknown'}:${address}`;
};

const pruneExpiredMemoryEntries = (now: number): void => {
  tabMemoryEntries.forEach((entry, key) => {
    if (entry.expiresAt <= now) tabMemoryEntries.delete(key);
  });
};

const buildMemoryEnvelope = (now: number): SbtPasswordRecoveryStoreEnvelope => {
  pruneExpiredMemoryEntries(now);
  return {
    v: SBT_PASSWORD_RECOVERY_ENVELOPE_VERSION,
    kind: SBT_PASSWORD_RECOVERY_KIND,
    updatedAt: now,
    entries: Object.fromEntries(
      Array.from(tabMemoryEntries.entries(), ([key, entry]) => [
        key,
        {
          ...entry,
          passwords: [...entry.passwords],
        },
      ]),
    ),
  };
};

export const readSbtPasswordRecoveryStore = ({
  storage,
  now = Date.now(),
}: {
  storage?: StorageLike | null;
  now?: number;
  clearInvalid?: boolean;
} = {}): SbtPasswordRecoveryStoreEnvelope => {
  purgeLegacySbtPasswordRecoveryArtifacts({ storage });
  return buildMemoryEnvelope(now);
};

export const writeSbtPasswordRecoveryStore = (
  _store: unknown,
  {
    storage,
  }: {
    storage?: StorageLike | null;
    now?: number;
  } = {},
): { ok: false; status: 'browser-persistence-disabled' } => {
  purgeLegacySbtPasswordRecoveryArtifacts({ storage });
  return { ok: false, status: 'browser-persistence-disabled' };
};

export const getSbtPasswordRecoveryCodes = ({
  chainId,
  sbtAddress,
  storage,
  now = Date.now(),
}: RecoveryScope = {}): string[] => {
  purgeLegacySbtPasswordRecoveryArtifacts({ storage });
  pruneExpiredMemoryEntries(now);
  const exactKey = getSbtPasswordRecoveryKey({ chainId, sbtAddress });
  const exact = exactKey ? tabMemoryEntries.get(exactKey) : null;
  if (exact) return [...exact.passwords];

  const address = normalizeAddress(sbtAddress);
  const unknownKey = getSbtPasswordRecoveryKey({ sbtAddress });
  const unknown = unknownKey ? tabMemoryEntries.get(unknownKey) : null;
  const normalizedChainId = normalizeChainId(chainId);
  if (unknown && normalizedChainId && exactKey) {
    tabMemoryEntries.set(exactKey, {
      ...unknown,
      chainId: normalizedChainId,
      updatedAt: now,
    });
    tabMemoryEntries.delete(unknownKey);
    return [...unknown.passwords];
  }
  if (!normalizedChainId && address) {
    const addressEntry = Array.from(tabMemoryEntries.values()).find((candidate) => candidate.sbtAddress === address);
    if (addressEntry) return [...addressEntry.passwords];
  }
  return [];
};

export const upsertSbtPasswordRecoveryCodes = ({
  chainId,
  sbtAddress,
  passwords,
  mode = 'replace',
  storage,
  now = Date.now(),
  ttlMs = SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS,
}: RecoveryScope & {
  passwords?: unknown;
  mode?: string;
  ttlMs?: unknown;
} = {}) => {
  purgeLegacySbtPasswordRecoveryArtifacts({ storage });
  const key = getSbtPasswordRecoveryKey({ chainId, sbtAddress });
  const nextPasswords = normalizePasswords(passwords);
  if (!key || nextPasswords.length === 0) {
    return {
      ok: false,
      status: 'empty-recovery-payload',
      key,
      passwords: nextPasswords,
    };
  }

  pruneExpiredMemoryEntries(now);
  const previous = tabMemoryEntries.get(key);
  const merged =
    mode === 'append' ? normalizePasswords([...(previous?.passwords || []), ...nextPasswords]) : nextPasswords;
  const expiresAt = now + Math.max(1, Number(ttlMs) || SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS);
  const entry: SbtPasswordRecoveryEntry = {
    chainId: normalizeChainId(chainId),
    sbtAddress: normalizeAddress(sbtAddress),
    passwords: merged,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    expiresAt,
  };
  tabMemoryEntries.set(key, entry);
  return {
    ok: true,
    status: 'memory-only',
    key,
    passwords: [...merged],
    expiresAt,
  };
};

export const clearSbtPasswordRecoveryCodes = ({ chainId, sbtAddress, storage }: RecoveryScope = {}): {
  ok: true;
  status: 'cleared';
  key: string;
} => {
  purgeLegacySbtPasswordRecoveryArtifacts({ storage });
  const key = getSbtPasswordRecoveryKey({ chainId, sbtAddress });
  if (key) {
    tabMemoryEntries.delete(key);
    if (normalizeChainId(chainId)) tabMemoryEntries.delete(getSbtPasswordRecoveryKey({ sbtAddress }));
  } else {
    tabMemoryEntries.clear();
  }
  return { ok: true, status: 'cleared', key };
};

export const clearAllSbtPasswordRecoveryMemory = (): void => {
  tabMemoryEntries.clear();
};

purgeLegacySbtPasswordRecoveryArtifacts();

const sbtPasswordRecoveryStore = {
  clearAllSbtPasswordRecoveryMemory,
  clearSbtPasswordRecoveryCodes,
  getSbtPasswordRecoveryCodes,
  getSbtPasswordRecoveryKey,
  purgeLegacySbtPasswordRecoveryArtifacts,
  readSbtPasswordRecoveryStore,
  upsertSbtPasswordRecoveryCodes,
  writeSbtPasswordRecoveryStore,
};

export default sbtPasswordRecoveryStore;
