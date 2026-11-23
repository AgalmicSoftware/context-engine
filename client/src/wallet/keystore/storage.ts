import { readBlockedStorage } from '../../storageFallback.js';
import type { PasskeyWalletRecord, PasskeyWalletStorage } from '../types.js';

const DB_NAME = 'ce_passkey_wallet_db';
const DB_VERSION = 1;
const STORE_NAME = 'wallet_records';
const ACTIVE_WALLET_KEY = 'active';

declare global {
  interface Window {
    __CE_PASSKEY_WALLET_E2E_SEED_READY__?: Promise<unknown>;
  }
}

const waitForSeededRecord = async (): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && window.__CE_PASSKEY_WALLET_E2E_SEED_READY__) {
      await window.__CE_PASSKEY_WALLET_E2E_SEED_READY__;
    }
  } catch (_) {
    // Seed hooks are best effort; normal IndexedDB errors are handled by callers.
  }
};

const openWalletDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is required for encrypted wallet storage.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('Failed to open wallet database.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

export const indexedDbWalletStorage: PasskeyWalletStorage = {
  async read(): Promise<PasskeyWalletRecord | null> {
    await waitForSeededRecord();
    const db = await openWalletDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(ACTIVE_WALLET_KEY);
      const cleanup = () => db.close();
      request.onsuccess = () => resolve((request.result as PasskeyWalletRecord | null) || null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = cleanup;
      tx.onerror = () => {
        cleanup();
        reject(tx.error);
      };
      tx.onabort = () => {
        cleanup();
        reject(tx.error);
      };
    });
  },

  async write(record: PasskeyWalletRecord): Promise<void> {
    const db = await openWalletDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record, ACTIVE_WALLET_KEY);
      const cleanup = () => db.close();
      tx.oncomplete = () => {
        cleanup();
        resolve();
      };
      tx.onerror = () => {
        cleanup();
        reject(tx.error);
      };
      tx.onabort = () => {
        cleanup();
        reject(tx.error);
      };
    });
  },

  async clear(): Promise<void> {
    const db = await openWalletDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(ACTIVE_WALLET_KEY);
      const cleanup = () => db.close();
      tx.oncomplete = () => {
        cleanup();
        resolve();
      };
      tx.onerror = () => {
        cleanup();
        reject(tx.error);
      };
      tx.onabort = () => {
        cleanup();
        reject(tx.error);
      };
    });
  },
};

export const createMemoryWalletStorage = (initialRecord: PasskeyWalletRecord | null = null): PasskeyWalletStorage => {
  let record = initialRecord;
  return {
    async read() {
      return record ? { ...record } : null;
    },
    async write(nextRecord) {
      record = { ...nextRecord };
    },
    async clear() {
      record = null;
    },
  };
};

// A browser that blocks site data refuses this database too ("The user denied permission to access the
// database"), and sign-in then failed outright. Where the page is already running on its stand-in for blocked
// storage (storageFallback.ts), the record is kept in memory instead: sign-in works for the visit and is gone
// when the tab closes or reloads. What is held is what the database would hold, and for less time: a passkey
// record has no key in it, and a login file's key stays sealed by a key that cannot be exported. Any other
// database failure is still an error, so an account is never dropped quietly in a browser that keeps its data.
export const createWalletStorage = (
  primary: PasskeyWalletStorage = indexedDbWalletStorage,
  memory: PasskeyWalletStorage = createMemoryWalletStorage(),
  isBlocked: () => boolean = () => readBlockedStorage().length > 0,
): PasskeyWalletStorage => {
  let inMemory = false;
  // Once the database has answered, a record may be in it: a later failure must stay a failure, or a sign-out
  // would clear the empty memory copy and leave the stored record signed in.
  let primaryWorked = false;
  const run = async <T>(op: (storage: PasskeyWalletStorage) => Promise<T>): Promise<T> => {
    if (inMemory) return op(memory);
    try {
      const result = await op(primary);
      primaryWorked = true;
      return result;
    } catch (error) {
      if (primaryWorked || !isBlocked()) throw error;
      inMemory = true;
      return op(memory);
    }
  };
  // A record whose key exists nowhere else (the encrypted-private-key mode; not this site's default) is never
  // kept only in memory: the account would be lost for good at the next reload.
  const onlyCopyOfKey = (record: PasskeyWalletRecord) =>
    record.keyMode !== 'passkey-derived' && record.keyMode !== 'login-file';
  return {
    read: () => run((storage) => storage.read()),
    write: (record) =>
      run((storage) => {
        if (storage === memory && onlyCopyOfKey(record)) {
          return Promise.reject(new Error('This browser blocks site data, so this account cannot be kept here.'));
        }
        return storage.write(record);
      }),
    clear: () => run((storage) => storage.clear()),
  };
};

export const walletStorage = createWalletStorage();
