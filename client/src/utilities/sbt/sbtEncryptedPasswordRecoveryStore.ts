import { safeJsonRead, safeJsonWrite } from '../cache/storageJson.js';
import { SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS, getSbtPasswordRecoveryKey } from './sbtPasswordRecoveryStore.js';

export const SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY = 'ce:sbtPasswordRecovery:v2';
export const SBT_ENCRYPTED_PASSWORD_RECOVERY_VERSION = 2;
export const SBT_ENCRYPTED_PASSWORD_RECOVERY_KIND = 'sbt-password-recovery';
export const SBT_ENCRYPTED_PASSWORD_RECOVERY_KEY_REF = 'browser-local-v1';

const KEY_DB_NAME = 'ce-sbt-password-recovery-keys';
const KEY_DB_VERSION = 1;
const KEY_DB_STORE = 'keys';

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

export type SbtPasswordRecoveryKeyStore = {
  read: () => Promise<CryptoKey | null>;
  write: (key: CryptoKey) => Promise<void>;
};

type EncryptedEntry = {
  chainId: number;
  sbtAddress: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  cipher: 'AES-GCM';
  keyRef: typeof SBT_ENCRYPTED_PASSWORD_RECOVERY_KEY_REF;
  iv: string;
  ciphertext: string;
};

type EncryptedEnvelope = {
  v: typeof SBT_ENCRYPTED_PASSWORD_RECOVERY_VERSION;
  kind: typeof SBT_ENCRYPTED_PASSWORD_RECOVERY_KIND;
  updatedAt: number;
  entries: Record<string, EncryptedEntry>;
};

type RecoveryArgs = {
  chainId?: unknown;
  sbtAddress?: unknown;
  cryptoApi?: Crypto | null;
  keyStore?: SbtPasswordRecoveryKeyStore | null;
  storage?: StorageLike | null;
  now?: number;
};

type UpsertArgs = RecoveryArgs & {
  mode?: 'replace' | 'append' | string;
  passwords?: unknown;
  ttlMs?: unknown;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const keyCreationPromises = new WeakMap<object, Promise<CryptoKey>>();

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

const normalizeAddress = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeChainId = (value: unknown): number => {
  const chainId = Number(value || 0);
  return Number.isSafeInteger(chainId) && chainId > 0 ? chainId : 0;
};

const normalizeTimestamp = (value: unknown): number => {
  const timestamp = Number(value || 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
};

const normalizePasswords = (value: unknown): string[] => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map((entry) => String(entry || '').trim())
    .filter((entry) => {
      if (!entry || seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const getStorage = (storageIn?: StorageLike | null): StorageLike | null => {
  if (storageIn !== undefined) return storageIn;
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch (_) {
    return null;
  }
};

const getCrypto = (cryptoIn?: Crypto | null): Crypto | null => {
  if (cryptoIn !== undefined) return cryptoIn;
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  return cryptoApi?.subtle && typeof cryptoApi.getRandomValues === 'function' ? cryptoApi : null;
};

const buildEmptyEnvelope = (now: number): EncryptedEnvelope => ({
  v: SBT_ENCRYPTED_PASSWORD_RECOVERY_VERSION,
  kind: SBT_ENCRYPTED_PASSWORD_RECOVERY_KIND,
  updatedAt: now,
  entries: {},
});

const normalizeEntry = (value: unknown, key: string, now: number): EncryptedEntry | null => {
  if (!isRecord(value)) return null;
  const chainId = normalizeChainId(value.chainId);
  const sbtAddress = normalizeAddress(value.sbtAddress);
  const createdAt = normalizeTimestamp(value.createdAt);
  const updatedAt = normalizeTimestamp(value.updatedAt);
  const expiresAt = normalizeTimestamp(value.expiresAt);
  const iv = String(value.iv || '');
  const ciphertext = String(value.ciphertext || '');
  if (
    !chainId ||
    !sbtAddress ||
    getSbtPasswordRecoveryKey({ chainId, sbtAddress }) !== key ||
    !createdAt ||
    !updatedAt ||
    !expiresAt ||
    expiresAt <= now ||
    value.cipher !== 'AES-GCM' ||
    value.keyRef !== SBT_ENCRYPTED_PASSWORD_RECOVERY_KEY_REF ||
    !iv ||
    !ciphertext
  ) {
    return null;
  }
  return {
    chainId,
    sbtAddress,
    createdAt,
    updatedAt,
    expiresAt,
    cipher: 'AES-GCM',
    keyRef: SBT_ENCRYPTED_PASSWORD_RECOVERY_KEY_REF,
    iv,
    ciphertext,
  };
};

const normalizeEnvelope = (value: unknown, now: number): EncryptedEnvelope => {
  if (!isRecord(value)) throw new Error('Encrypted SBT recovery store must be an object.');
  if (value.v !== SBT_ENCRYPTED_PASSWORD_RECOVERY_VERSION || value.kind !== SBT_ENCRYPTED_PASSWORD_RECOVERY_KIND) {
    throw new Error('Unsupported encrypted SBT recovery envelope.');
  }
  const entries: Record<string, EncryptedEntry> = {};
  if (isRecord(value.entries)) {
    Object.entries(value.entries).forEach(([key, entry]) => {
      const normalized = normalizeEntry(entry, key, now);
      if (normalized) entries[key] = normalized;
    });
  }
  return {
    v: SBT_ENCRYPTED_PASSWORD_RECOVERY_VERSION,
    kind: SBT_ENCRYPTED_PASSWORD_RECOVERY_KIND,
    updatedAt: normalizeTimestamp(value.updatedAt) || now,
    entries,
  };
};

const readEnvelope = (storage: StorageLike, now: number): EncryptedEnvelope => {
  const result = safeJsonRead<EncryptedEnvelope>(
    storage,
    SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY,
    (parsed) => normalizeEnvelope(parsed, now),
    { clearInvalid: true },
  );
  if (!result.ok) return buildEmptyEnvelope(now);

  const raw = storage.getItem?.(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY);
  const parsed = raw ? JSON.parse(raw) : null;
  const sourceCount = isRecord(parsed) && isRecord(parsed.entries) ? Object.keys(parsed.entries).length : 0;
  if (sourceCount !== Object.keys(result.value.entries).length) {
    safeJsonWrite(storage, SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY, {
      ...result.value,
      updatedAt: now,
    });
  }
  return result.value;
};

const entryAad = (key: string, entry: Omit<EncryptedEntry, 'iv' | 'ciphertext'>): Uint8Array =>
  textEncoder.encode(
    JSON.stringify({
      v: SBT_ENCRYPTED_PASSWORD_RECOVERY_VERSION,
      kind: SBT_ENCRYPTED_PASSWORD_RECOVERY_KIND,
      key,
      ...entry,
    }),
  );

const openKeyDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = indexedDB.open(KEY_DB_NAME, KEY_DB_VERSION);
    request.onerror = () => reject(request.error || new Error('Failed to open encrypted recovery key store.'));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(KEY_DB_STORE)) request.result.createObjectStore(KEY_DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
  });

const runKeyDbTransaction = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> => {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    let requestResult: T | undefined;
    const tx = db.transaction(KEY_DB_STORE, mode);
    const request = action(tx.objectStore(KEY_DB_STORE));
    request.onsuccess = () => {
      requestResult = request.result;
    };
    request.onerror = () => reject(request.error || tx.error || new Error('Encrypted recovery key request failed.'));
    tx.oncomplete = () => {
      db.close();
      resolve(requestResult);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || request.error || new Error('Encrypted recovery key transaction failed.'));
    };
    tx.onabort = tx.onerror;
  });
};

const indexedDbKeyStore: SbtPasswordRecoveryKeyStore = {
  async read() {
    return (
      (await runKeyDbTransaction('readonly', (store) => store.get(SBT_ENCRYPTED_PASSWORD_RECOVERY_KEY_REF))) || null
    );
  },
  async write(key) {
    await runKeyDbTransaction('readwrite', (store) => store.put(key, SBT_ENCRYPTED_PASSWORD_RECOVERY_KEY_REF));
  },
};

const resolveKeyStore = (keyStore?: SbtPasswordRecoveryKeyStore | null): SbtPasswordRecoveryKeyStore | null => {
  if (keyStore !== undefined) return keyStore;
  return typeof indexedDB === 'undefined' ? null : indexedDbKeyStore;
};

const isAesKey = (key: CryptoKey | null): key is CryptoKey =>
  !!key && key.type === 'secret' && String((key.algorithm as KeyAlgorithm | undefined)?.name || '') === 'AES-GCM';

const getOrCreateKey = async (cryptoApi: Crypto, keyStore: SbtPasswordRecoveryKeyStore): Promise<CryptoKey> => {
  const existingPromise = keyCreationPromises.get(keyStore as object);
  if (existingPromise) return existingPromise;
  const promise = (async () => {
    const storedKey = await keyStore.read();
    if (isAesKey(storedKey)) return storedKey;
    const key = await cryptoApi.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await keyStore.write(key);
    return key;
  })();
  keyCreationPromises.set(keyStore as object, promise);
  try {
    return await promise;
  } catch (error) {
    keyCreationPromises.delete(keyStore as object);
    throw error;
  }
};

const decryptEntry = async ({
  cryptoApi,
  entry,
  key,
  recoveryKey,
}: {
  cryptoApi: Crypto;
  entry: EncryptedEntry;
  key: string;
  recoveryKey: CryptoKey;
}): Promise<string[]> => {
  const { iv, ciphertext, ...authenticatedMetadata } = entry;
  const plaintext = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv), additionalData: entryAad(key, authenticatedMetadata) },
    recoveryKey,
    base64ToBytes(ciphertext),
  );
  return normalizePasswords(JSON.parse(textDecoder.decode(plaintext)));
};

export const readEncryptedSbtPasswordRecoveryCodes = async ({
  chainId,
  sbtAddress,
  cryptoApi: cryptoIn,
  keyStore: keyStoreIn,
  storage: storageIn,
  now = Date.now(),
}: RecoveryArgs = {}) => {
  const storage = getStorage(storageIn);
  const key = getSbtPasswordRecoveryKey({ chainId, sbtAddress });
  if (!storage || !key) return { ok: false, status: 'unavailable', passwords: [] as string[] };
  const envelope = readEnvelope(storage, now);
  const entry = envelope.entries[key];
  if (!entry) return { ok: true, status: 'empty', passwords: [] as string[] };

  const cryptoApi = getCrypto(cryptoIn);
  const keyStore = resolveKeyStore(keyStoreIn);
  if (!cryptoApi || !keyStore) return { ok: false, status: 'unavailable', passwords: [] as string[] };
  try {
    const recoveryKey = await keyStore.read();
    if (!isAesKey(recoveryKey)) return { ok: false, status: 'missing-key', passwords: [] as string[] };
    const passwords = await decryptEntry({ cryptoApi, entry, key, recoveryKey });
    return { ok: true, status: 'ok', passwords };
  } catch (_) {
    return { ok: false, status: 'decrypt-failed', passwords: [] as string[] };
  }
};

export const upsertEncryptedSbtPasswordRecoveryCodes = async ({
  chainId,
  sbtAddress,
  passwords,
  mode = 'replace',
  cryptoApi: cryptoIn,
  keyStore: keyStoreIn,
  storage: storageIn,
  now = Date.now(),
  ttlMs = SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS,
}: UpsertArgs = {}) => {
  const storage = getStorage(storageIn);
  const cryptoApi = getCrypto(cryptoIn);
  const keyStore = resolveKeyStore(keyStoreIn);
  const key = getSbtPasswordRecoveryKey({ chainId, sbtAddress });
  const nextPasswords = normalizePasswords(passwords);
  if (!storage || !cryptoApi || !keyStore) return { ok: false, status: 'unavailable' };
  if (!key || nextPasswords.length === 0) return { ok: false, status: 'empty-recovery-payload' };

  const envelope = readEnvelope(storage, now);
  try {
    const recoveryKey = await getOrCreateKey(cryptoApi, keyStore);
    let passwordsToStore = nextPasswords;
    const previous = envelope.entries[key];
    if (mode === 'append' && previous) {
      const previousPasswords = await decryptEntry({ cryptoApi, entry: previous, key, recoveryKey });
      passwordsToStore = normalizePasswords([...previousPasswords, ...nextPasswords]);
    }

    const previousCreatedAt = previous?.createdAt || now;
    const expiresAt = now + Math.max(1, Number(ttlMs) || SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS);
    const metadata = {
      chainId: normalizeChainId(chainId),
      sbtAddress: normalizeAddress(sbtAddress),
      createdAt: previousCreatedAt,
      updatedAt: now,
      expiresAt,
      cipher: 'AES-GCM' as const,
      keyRef: SBT_ENCRYPTED_PASSWORD_RECOVERY_KEY_REF as typeof SBT_ENCRYPTED_PASSWORD_RECOVERY_KEY_REF,
    };
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const ciphertext = await cryptoApi.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: entryAad(key, metadata) },
      recoveryKey,
      textEncoder.encode(JSON.stringify(passwordsToStore)),
    );
    envelope.entries[key] = {
      ...metadata,
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
    envelope.updatedAt = now;
    const write = safeJsonWrite(storage, SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY, envelope);
    return { ok: write.ok, status: write.ok ? 'ok' : write.status, expiresAt };
  } catch (_) {
    return { ok: false, status: 'encrypt-failed' };
  }
};

export const clearEncryptedSbtPasswordRecoveryCodes = async ({
  chainId,
  sbtAddress,
  storage: storageIn,
  now = Date.now(),
}: RecoveryArgs = {}) => {
  const storage = getStorage(storageIn);
  const key = getSbtPasswordRecoveryKey({ chainId, sbtAddress });
  if (!storage || !key) return { ok: false, status: 'unavailable' };
  const envelope = readEnvelope(storage, now);
  delete envelope.entries[key];
  envelope.updatedAt = now;
  const write = safeJsonWrite(storage, SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY, envelope);
  return { ok: write.ok, status: write.ok ? 'cleared' : write.status };
};
