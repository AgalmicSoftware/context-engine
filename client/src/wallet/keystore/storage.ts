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
