import {
  hasSponsoredBundleFields,
  normalizeSparseSponsoredBundlePayload,
} from '../../utilities/arweave/sponsoredBundles.js';
import { createLogger } from '../../utilities/logging';
import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord } from '../shellTypes';

const log = createLogger('general');
const SESSION_WIZARD_SPONSORED_BUNDLE_CACHE_KEY = 'ce:sessionWizardSponsoredBundle:v1';
const SESSION_WIZARD_SPONSORED_BUNDLE_TAB_ID_KEY = 'ce:sessionWizardSponsoredBundle:tabId:v1';
const SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_NAME = 'ce-sponsored-bundle-keys';
const SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_VERSION = 1;
const SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_STORE = 'keys';
const SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_ENTRY_PREFIX = 'sessionWizardSponsoredBundle';

let sessionWizardSponsoredBundleCacheKeyPromise: Promise<CryptoKey | null> | null = null;
let sessionWizardSponsoredBundleKeyDbPromise: Promise<IDBDatabase> | null = null;
let sessionWizardSponsoredBundleKeyDbUnavailable = false;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBase64 = (bytes: Uint8Array = new Uint8Array()): string => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary);
};

const base64ToBytes = (value = ''): Uint8Array => {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const generateSessionWizardSponsoredBundleTabId = (): string => {
  const cryptoApi =
    (typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : null) ||
    (typeof window !== 'undefined' && window.crypto ? window.crypto : null);
  if (cryptoApi) {
    const bytes = new Uint8Array(8);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const getSessionWizardSponsoredBundleTabId = (): string => {
  if (typeof window === 'undefined' || !window.sessionStorage) return '';
  try {
    const existing = toStr(sessionStorage.getItem(SESSION_WIZARD_SPONSORED_BUNDLE_TAB_ID_KEY)).trim();
    if (existing) return existing;
    const next = generateSessionWizardSponsoredBundleTabId();
    sessionStorage.setItem(SESSION_WIZARD_SPONSORED_BUNDLE_TAB_ID_KEY, next);
    return next;
  } catch (_) {
    return '';
  }
};

const getSessionWizardSponsoredBundleCacheKeyDbEntry = (): string => {
  const tabId = getSessionWizardSponsoredBundleTabId();
  return tabId
    ? `${SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_ENTRY_PREFIX}:${tabId}`
    : SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_ENTRY_PREFIX;
};

const getSessionWizardSponsoredBundleCacheCrypto = (): Crypto | null => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  return cryptoApi?.subtle ? cryptoApi : null;
};

const openSessionWizardSponsoredBundleKeyDb = (): Promise<IDBDatabase> => {
  if (sessionWizardSponsoredBundleKeyDbUnavailable) {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (sessionWizardSponsoredBundleKeyDbPromise) return sessionWizardSponsoredBundleKeyDbPromise;

  sessionWizardSponsoredBundleKeyDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      sessionWizardSponsoredBundleKeyDbUnavailable = true;
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(
      SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_NAME,
      SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_VERSION,
    );

    request.onerror = () => {
      sessionWizardSponsoredBundleKeyDbUnavailable = true;
      sessionWizardSponsoredBundleKeyDbPromise = null;
      reject(request.error || new Error('Failed to open sponsored bundle key store'));
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_STORE)) {
        db.createObjectStore(SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      try {
        db.onversionchange = () => {
          try {
            db.close();
          } catch (_) {}
          sessionWizardSponsoredBundleKeyDbPromise = null;
        };
      } catch (_) {}
      resolve(db);
    };
  });

  return sessionWizardSponsoredBundleKeyDbPromise;
};

const runSessionWizardSponsoredBundleKeyDbTx = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> => {
  const db = await openSessionWizardSponsoredBundleKeyDb();
  return new Promise((resolve, reject) => {
    let settled = false;
    let requestResult: T | undefined;
    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      handler();
    };

    try {
      const tx = db.transaction(SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_STORE, mode);
      const store = tx.objectStore(SESSION_WIZARD_SPONSORED_BUNDLE_KEY_DB_STORE);
      const request = action(store);

      if (request && typeof request.onsuccess !== 'undefined') {
        request.onsuccess = () => {
          requestResult = request.result;
        };
        request.onerror = () =>
          finish(() => reject(request.error || tx.error || new Error('IndexedDB request failed')));
      }

      // IndexedDB request success only means the operation was queued; the write is
      // not durable until the surrounding transaction commits successfully.
      tx.oncomplete = () => finish(() => resolve(request ? requestResult : undefined));
      tx.onerror = () => finish(() => reject(tx.error || request?.error || new Error('IndexedDB transaction failed')));
      tx.onabort = () => finish(() => reject(tx.error || request?.error || new Error('IndexedDB transaction aborted')));
    } catch (error) {
      finish(() => reject(error));
    }
  });
};

export const __test__runSessionWizardSponsoredBundleKeyDbTx = runSessionWizardSponsoredBundleKeyDbTx;

const readSessionWizardSponsoredBundleCacheKeyFromIndexedDb = async (): Promise<CryptoKey | null> => {
  try {
    return await runSessionWizardSponsoredBundleKeyDbTx('readonly', (store) =>
      store.get(getSessionWizardSponsoredBundleCacheKeyDbEntry()),
    );
  } catch (_) {
    return null;
  }
};

const writeSessionWizardSponsoredBundleCacheKeyToIndexedDb = async (key: CryptoKey | null = null): Promise<boolean> => {
  if (!key) return false;
  try {
    await runSessionWizardSponsoredBundleKeyDbTx('readwrite', (store) =>
      store.put(key, getSessionWizardSponsoredBundleCacheKeyDbEntry()),
    );
    return true;
  } catch (_) {
    return false;
  }
};

const deleteSessionWizardSponsoredBundleCacheKeyFromIndexedDb = async () => {
  try {
    await runSessionWizardSponsoredBundleKeyDbTx('readwrite', (store) =>
      store.delete(getSessionWizardSponsoredBundleCacheKeyDbEntry()),
    );
  } catch (error) {
    log.warn('SessionWizard: fallback', error);
  }
};

const getSessionWizardSponsoredBundleCacheKey = async (): Promise<CryptoKey | null> => {
  const cryptoApi = getSessionWizardSponsoredBundleCacheCrypto();
  if (!cryptoApi) return null;
  if (!sessionWizardSponsoredBundleCacheKeyPromise) {
    sessionWizardSponsoredBundleCacheKeyPromise = (async () => {
      const storedKey = await readSessionWizardSponsoredBundleCacheKeyFromIndexedDb();
      if (storedKey && storedKey.type === 'secret') {
        return storedKey;
      }
      if (storedKey != null) {
        await deleteSessionWizardSponsoredBundleCacheKeyFromIndexedDb();
      }

      const key = await cryptoApi.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await writeSessionWizardSponsoredBundleCacheKeyToIndexedDb(key);
      return key;
    })().catch((error) => {
      sessionWizardSponsoredBundleCacheKeyPromise = null;
      throw error;
    });
  }
  return sessionWizardSponsoredBundleCacheKeyPromise;
};

export const __test__resetSessionWizardSponsoredBundleCacheKey = () => {
  sessionWizardSponsoredBundleCacheKeyPromise = null;
  sessionWizardSponsoredBundleKeyDbPromise = null;
  sessionWizardSponsoredBundleKeyDbUnavailable = false;
};

const encryptSessionWizardSponsoredBundleCachePayload = async (payload: AnyRecord = {}) => {
  const cryptoApi = getSessionWizardSponsoredBundleCacheCrypto();
  const key = await getSessionWizardSponsoredBundleCacheKey();
  if (!cryptoApi || !key) return null;
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(payload));
  const ciphertext = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return JSON.stringify({
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  });
};

const decryptSessionWizardSponsoredBundleCachePayload = async (raw = '') => {
  const cryptoApi = getSessionWizardSponsoredBundleCacheCrypto();
  const key = await getSessionWizardSponsoredBundleCacheKey();
  if (!cryptoApi || !key) return null;

  const parsed = raw ? JSON.parse(raw) : null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (!parsed.iv || !parsed.ciphertext) return null;

  const plaintext = await cryptoApi.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(parsed.iv),
    },
    key,
    base64ToBytes(parsed.ciphertext),
  );

  return JSON.parse(textDecoder.decode(plaintext));
};

const clearSessionWizardSponsoredBundleCacheStorage = async () => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.removeItem(SESSION_WIZARD_SPONSORED_BUNDLE_CACHE_KEY);
    } catch (_) {}
  }
  await deleteSessionWizardSponsoredBundleCacheKeyFromIndexedDb();
  sessionWizardSponsoredBundleCacheKeyPromise = null;
};

export const readSessionWizardSponsoredBundleCache = async (txId = '') => {
  const normalizedTxId = toStr(txId).trim();
  if (!normalizedTxId || typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_WIZARD_SPONSORED_BUNDLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = await decryptSessionWizardSponsoredBundleCachePayload(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const normalizedBundle = normalizeSparseSponsoredBundlePayload(parsed[normalizedTxId]);
    return hasSponsoredBundleFields(normalizedBundle) ? normalizedBundle : null;
  } catch (_) {
    return null;
  }
};

export const writeSessionWizardSponsoredBundleCache = async (txId = '', bundle: AnyRecord | null = null) => {
  const normalizedTxId = toStr(txId).trim();
  if (!normalizedTxId || typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const raw = sessionStorage.getItem(SESSION_WIZARD_SPONSORED_BUNDLE_CACHE_KEY);
    const parsed = raw ? await decryptSessionWizardSponsoredBundleCachePayload(raw) : {};
    const next = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {};
    const normalizedBundle = normalizeSparseSponsoredBundlePayload(bundle);
    if (hasSponsoredBundleFields(normalizedBundle)) {
      next[normalizedTxId] = normalizedBundle;
    } else {
      delete next[normalizedTxId];
    }
    if (Object.keys(next).length) {
      const encryptedPayload = await encryptSessionWizardSponsoredBundleCachePayload(next);
      if (encryptedPayload) {
        sessionStorage.setItem(SESSION_WIZARD_SPONSORED_BUNDLE_CACHE_KEY, encryptedPayload);
        return;
      }
      await clearSessionWizardSponsoredBundleCacheStorage();
    } else {
      await clearSessionWizardSponsoredBundleCacheStorage();
    }
  } catch (_) {}
};
