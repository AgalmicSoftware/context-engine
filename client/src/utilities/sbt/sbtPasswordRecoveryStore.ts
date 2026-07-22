import { safeJsonRead, safeJsonWrite } from '../cache/storageJson.js';

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

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

const errorMessage = (error: unknown, fallback: string): string =>
  error && typeof error === 'object' && 'message' in error && error.message
    ? String(error.message)
    : String(error || fallback);

const getLocalStorage = (storageIn?: StorageLike | null): StorageLike | null => {
  if (storageIn !== undefined) return storageIn;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (e) {
    void e;
  }
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) {
    void e;
  }
  return null;
};

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

export const getSbtPasswordRecoveryKey = ({
  chainId,
  sbtAddress,
}: { chainId?: unknown; sbtAddress?: unknown } = {}): string => {
  const address = normalizeAddress(sbtAddress);
  if (!address) return '';
  return `${normalizeChainId(chainId) || 'unknown'}:${address}`;
};

const getUnknownSbtPasswordRecoveryKey = ({ sbtAddress }: { sbtAddress?: unknown } = {}): string =>
  getSbtPasswordRecoveryKey({ chainId: null, sbtAddress });

const normalizeEntry = (entry: unknown, fallbackKey: string, now: number): SbtPasswordRecoveryEntry | null => {
  if (!isRecord(entry)) return null;
  const keyParts = String(fallbackKey || '').split(':');
  const chainId = normalizeChainId(entry.chainId) || normalizeChainId(keyParts[0]);
  const sbtAddress = normalizeAddress(entry.sbtAddress || keyParts.slice(1).join(':'));
  const passwords = normalizePasswords(entry.passwords);
  const expiresAt = normalizeTimestamp(entry.expiresAt, 0);
  if (!sbtAddress || passwords.length === 0 || !expiresAt || expiresAt <= now) return null;

  const createdAt = normalizeTimestamp(entry.createdAt, now);
  const updatedAt = normalizeTimestamp(entry.updatedAt, createdAt);
  return {
    chainId,
    sbtAddress,
    passwords,
    createdAt,
    updatedAt,
    expiresAt,
  };
};

const normalizeStore = (parsed: unknown, now: number): SbtPasswordRecoveryStoreEnvelope => {
  if (!isRecord(parsed)) {
    throw new Error('SBT password recovery store must be a JSON object.');
  }
  if (parsed.v !== SBT_PASSWORD_RECOVERY_ENVELOPE_VERSION || parsed.kind !== SBT_PASSWORD_RECOVERY_KIND) {
    throw new Error('Unsupported SBT password recovery store envelope.');
  }

  const sourceEntries = isRecord(parsed.entries) ? parsed.entries : {};
  const entries: Record<string, SbtPasswordRecoveryEntry> = {};
  Object.entries(sourceEntries).forEach(([key, entry]) => {
    const normalized = normalizeEntry(entry, key, now);
    if (!normalized) return;
    entries[
      getSbtPasswordRecoveryKey({
        chainId: normalized.chainId,
        sbtAddress: normalized.sbtAddress,
      })
    ] = normalized;
  });

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
  const storageRef = getLocalStorage(storage);
  if (!storageRef) return buildEmptyStore(now);

  const result = safeJsonRead<SbtPasswordRecoveryStoreEnvelope>(
    storageRef,
    SBT_PASSWORD_RECOVERY_STORAGE_KEY,
    (parsed) => normalizeStore(parsed, now),
    { clearInvalid },
  );

  return result.ok ? result.value : buildEmptyStore(now);
};

export const writeSbtPasswordRecoveryStore = (
  _store: unknown,
  {
    storage,
  }: {
    storage?: StorageLike | null;
    now?: number;
  } = {},
) => {
  const storageRef = getLocalStorage(storage);
  if (!storageRef) {
    return {
      ok: false,
      status: 'missing-storage',
    };
  }
  let normalizedStore;
  try {
    normalizedStore = normalizeStore(
      isRecord(store)
        ? {
            ...store,
            updatedAt: now,
          }
        : store,
      now,
    );
  } catch (error) {
    return {
      ok: false,
      status: 'invalid-store',
      error: errorMessage(error, 'Invalid SBT password recovery store.'),
    };
  }
  return safeJsonWrite(storageRef, SBT_PASSWORD_RECOVERY_STORAGE_KEY, normalizedStore);
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
  const key = getSbtPasswordRecoveryKey({ chainId: normalizedChainId, sbtAddress });
  const entry = key ? store.entries[key] : null;
  if (entry && Array.isArray(entry.passwords) && entry.passwords.length > 0) {
    return [...entry.passwords];
  }

  const unknownKey = getUnknownSbtPasswordRecoveryKey({ sbtAddress });
  const unknownEntry = unknownKey ? store.entries[unknownKey] : null;
  if (normalizedChainId && unknownEntry && Array.isArray(unknownEntry.passwords) && unknownEntry.passwords.length > 0) {
    // Regression guard: earlier writes could land under unknown:<address>
    // before the UI resolved a chain id. Promote that entry on first exact read.
    store.entries[key] = {
      ...unknownEntry,
      chainId: normalizedChainId,
      updatedAt: now,
    });
    tabMemoryEntries.delete(unknownKey);
    return [...unknown.passwords];
  }

  if (!normalizedChainId) {
    const address = normalizeAddress(sbtAddress);
    const addressEntry = Object.values(store.entries).find((candidate) => candidate.sbtAddress === address);
    if (addressEntry && addressEntry.passwords.length > 0) return [...addressEntry.passwords];
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

  const store = readSbtPasswordRecoveryStore({ storage, now });
  const previous = store.entries[key];
  const passwordsForEntry =
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

export const clearSbtPasswordRecoveryCodes = ({
  chainId,
  sbtAddress,
  storage,
  now = Date.now(),
}: {
  chainId?: unknown;
  sbtAddress?: unknown;
  storage?: StorageLike | null;
  now?: number;
} = {}) => {
  const key = getSbtPasswordRecoveryKey({ chainId, sbtAddress });
  if (!key) return { ok: false, status: 'empty-recovery-key' };
  const store = readSbtPasswordRecoveryStore({ storage, now });
  delete store.entries[key];
  store.updatedAt = now;
  const write = writeSbtPasswordRecoveryStore(store, { storage, now });
  return { ok: write.ok, status: write.ok ? 'cleared' : write.status };
};

const sbtPasswordRecoveryStore = {
  clearSbtPasswordRecoveryCodes,
  getSbtPasswordRecoveryCodes,
  getSbtPasswordRecoveryKey,
  purgeLegacySbtPasswordRecoveryArtifacts,
  readSbtPasswordRecoveryStore,
  upsertSbtPasswordRecoveryCodes,
  writeSbtPasswordRecoveryStore,
};

export default sbtPasswordRecoveryStore;
