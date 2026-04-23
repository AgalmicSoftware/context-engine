import {
  safeJsonRead,
  safeJsonWrite,
} from '../cache/storageJson.js';

export const SBT_PASSWORD_RECOVERY_STORAGE_KEY = 'ce:sbtPasswordRecovery:v1';
export const SBT_PASSWORD_RECOVERY_ENVELOPE_VERSION = 1;
export const SBT_PASSWORD_RECOVERY_KIND = 'sbt-password-recovery';
export const SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const getLocalStorage = (storageIn) => {
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

const normalizeAddress = (value) => String(value || '').trim().toLowerCase();

const normalizeChainId = (value) => {
  const chainId = Number(value || 0);
  return Number.isFinite(chainId) && chainId > 0 ? chainId : null;
};

const normalizeTimestamp = (value, fallback = 0) => {
  const timestamp = Number(value || 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
};

const normalizePasswords = (passwords) => {
  const source = Array.isArray(passwords) ? passwords : [];
  const seen = new Set();
  return source
    .map((password) => String(password || '').trim())
    .filter((password) => {
      if (!password || seen.has(password)) return false;
      seen.add(password);
      return true;
    });
};

const buildEmptyStore = (now) => ({
  v: SBT_PASSWORD_RECOVERY_ENVELOPE_VERSION,
  kind: SBT_PASSWORD_RECOVERY_KIND,
  updatedAt: now,
  entries: {},
});

export const getSbtPasswordRecoveryKey = ({ chainId, sbtAddress } = {}) => {
  const address = normalizeAddress(sbtAddress);
  if (!address) return '';
  return `${normalizeChainId(chainId) || 'unknown'}:${address}`;
};

const normalizeEntry = (entry, fallbackKey, now) => {
  if (!entry || typeof entry !== 'object') return null;
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

const normalizeStore = (parsed, now) => {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('SBT password recovery store must be a JSON object.');
  }
  if (
    parsed.v !== SBT_PASSWORD_RECOVERY_ENVELOPE_VERSION ||
    parsed.kind !== SBT_PASSWORD_RECOVERY_KIND
  ) {
    throw new Error('Unsupported SBT password recovery store envelope.');
  }

  const entries = {};
  Object.entries(parsed.entries || {}).forEach(([key, entry]) => {
    const normalized = normalizeEntry(entry, key, now);
    if (!normalized) return;
    entries[getSbtPasswordRecoveryKey({
      chainId: normalized.chainId,
      sbtAddress: normalized.sbtAddress,
    })] = normalized;
  });

  return {
    v: SBT_PASSWORD_RECOVERY_ENVELOPE_VERSION,
    kind: SBT_PASSWORD_RECOVERY_KIND,
    updatedAt: normalizeTimestamp(parsed.updatedAt, now),
    entries,
  };
};

export const readSbtPasswordRecoveryStore = ({ storage, now = Date.now(), clearInvalid = true } = {}) => {
  const storageRef = getLocalStorage(storage);
  if (!storageRef) return buildEmptyStore(now);

  const result = safeJsonRead(
    storageRef,
    SBT_PASSWORD_RECOVERY_STORAGE_KEY,
    (parsed) => normalizeStore(parsed, now),
    { clearInvalid }
  );

  return result.ok ? result.value : buildEmptyStore(now);
};

export const writeSbtPasswordRecoveryStore = (store, { storage, now = Date.now() } = {}) => {
  const storageRef = getLocalStorage(storage);
  if (!storageRef) {
    return {
      ok: false,
      status: 'missing-storage',
    };
  }
  let normalizedStore;
  try {
    normalizedStore = normalizeStore({
      ...store,
      updatedAt: now,
    }, now);
  } catch (error) {
    return {
      ok: false,
      status: 'invalid-store',
      error: error?.message || String(error || 'Invalid SBT password recovery store.'),
    };
  }
  return safeJsonWrite(storageRef, SBT_PASSWORD_RECOVERY_STORAGE_KEY, normalizedStore);
};

export const getSbtPasswordRecoveryCodes = ({
  chainId,
  sbtAddress,
  storage,
  now = Date.now(),
} = {}) => {
  const store = readSbtPasswordRecoveryStore({ storage, now });
  const key = getSbtPasswordRecoveryKey({ chainId, sbtAddress });
  const entry = key ? store.entries[key] : null;
  if (entry && Array.isArray(entry.passwords) && entry.passwords.length > 0) {
    return [...entry.passwords];
  }

  if (!chainId) {
    const address = normalizeAddress(sbtAddress);
    const addressEntry = Object.values(store.entries).find(
      (candidate) => candidate.sbtAddress === address
    );
    if (addressEntry?.passwords?.length > 0) return [...addressEntry.passwords];
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
} = {}) => {
  const key = getSbtPasswordRecoveryKey({ chainId, sbtAddress });
  const nextPasswords = normalizePasswords(passwords);
  if (!key || nextPasswords.length === 0) {
    return {
      ok: false,
      status: 'empty-recovery-payload',
      key,
    };
  }

  const store = readSbtPasswordRecoveryStore({ storage, now });
  const previous = store.entries[key];
  const passwordsForEntry = mode === 'append'
    ? normalizePasswords([...(previous?.passwords || []), ...nextPasswords])
    : nextPasswords;
  const expiresAt = now + Math.max(1, Number(ttlMs) || SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS);

  store.entries[key] = {
    chainId: normalizeChainId(chainId),
    sbtAddress: normalizeAddress(sbtAddress),
    passwords: passwordsForEntry,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    expiresAt,
  };
  store.updatedAt = now;

  const write = writeSbtPasswordRecoveryStore(store, { storage, now });
  return {
    ok: write.ok,
    status: write.ok ? 'ok' : write.status,
    key,
    passwords: passwordsForEntry,
    expiresAt,
    write,
  };
};

const sbtPasswordRecoveryStore = {
  getSbtPasswordRecoveryCodes,
  getSbtPasswordRecoveryKey,
  readSbtPasswordRecoveryStore,
  upsertSbtPasswordRecoveryCodes,
  writeSbtPasswordRecoveryStore,
};

export default sbtPasswordRecoveryStore;
