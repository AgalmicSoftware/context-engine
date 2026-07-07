/**
 * @file cacheScripts.idb.impl.js
 * @description Private IndexedDB helper for cacheScripts' key/value persistence.
 *              This intentionally mirrors only the tiny subset of the old
 *              idb-keyval API that cacheScripts actually uses.
 */

const DEFAULT_DB_VERSION = 1;
type CacheIdbStore = {
  dbName: string;
  storeName: string;
};

type CacheIdbEntry = [IDBValidKey, unknown];

const dbPromises = new Map<string, Promise<IDBDatabase>>();

const getStoreIdentity = (store: Partial<CacheIdbStore> = {}): string =>
  `${String(store.dbName || 'keyval-store')}::${String(store.storeName || 'keyval')}`;

const getStoreShape = (store: Partial<CacheIdbStore> = {}): CacheIdbStore => ({
  dbName: String(store.dbName || 'keyval-store'),
  storeName: String(store.storeName || 'keyval'),
});

const getOrOpenDatabase = (store: Partial<CacheIdbStore>): Promise<IDBDatabase> => {
  const normalizedStore = getStoreShape(store);
  const identity = getStoreIdentity(normalizedStore);

  const existingDbPromise = dbPromises.get(identity);
  if (existingDbPromise) {
    return existingDbPromise;
  }

  const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(normalizedStore.dbName, DEFAULT_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(normalizedStore.storeName)) {
        db.createObjectStore(normalizedStore.storeName);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        try {
          db.close();
        } catch (_) {}
        dbPromises.delete(identity);
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromises.delete(identity);
      reject(request.error || new Error(`Failed to open IndexedDB store ${identity}`));
    };
  });

  dbPromises.set(identity, dbPromise);
  return dbPromise;
};

const runTransaction = async <T>(
  store: Partial<CacheIdbStore> | undefined,
  mode: IDBTransactionMode,
  executeRequest: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> => {
  const normalizedStore = getStoreShape(store);
  const db = await getOrOpenDatabase(normalizedStore);

  return new Promise((resolve, reject) => {
    let request: IDBRequest<T> | null = null;
    try {
      const tx = db.transaction(normalizedStore.storeName, mode);
      const objectStore = tx.objectStore(normalizedStore.storeName);
      request = executeRequest(objectStore);

      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error || request?.error || new Error(`IndexedDB ${mode} failed`));
      tx.onabort = () => reject(tx.error || request?.error || new Error(`IndexedDB ${mode} aborted`));
    } catch (error) {
      reject(error);
    }
  });
};

export const createStore = (dbName?: unknown, storeName?: unknown): CacheIdbStore =>
  getStoreShape({ dbName: String(dbName || ''), storeName: String(storeName || '') });

export const get = async (key: IDBValidKey, store?: Partial<CacheIdbStore>): Promise<unknown> =>
  runTransaction(store, 'readonly', (objectStore) => objectStore.get(key));

export const set = async (key: IDBValidKey, value: unknown, store?: Partial<CacheIdbStore>): Promise<void> => {
  await runTransaction(store, 'readwrite', (objectStore) => objectStore.put(value, key));
};

export const del = async (key: IDBValidKey, store?: Partial<CacheIdbStore>): Promise<void> => {
  await runTransaction(store, 'readwrite', (objectStore) => objectStore.delete(key));
};

export const entries = async (store?: Partial<CacheIdbStore>): Promise<CacheIdbEntry[]> => {
  const normalizedStore = getStoreShape(store);
  const db = await getOrOpenDatabase(normalizedStore);

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(normalizedStore.storeName, 'readonly');
      const objectStore = tx.objectStore(normalizedStore.storeName);
      const collected: CacheIdbEntry[] = [];
      const cursorRequest = objectStore.openCursor();

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        collected.push([cursor.key, cursor.value]);
        cursor.continue();
      };

      cursorRequest.onerror = () => {
        reject(cursorRequest.error || new Error('Failed to read IndexedDB entries'));
      };

      tx.oncomplete = () => resolve(collected);
      tx.onerror = () => reject(tx.error || cursorRequest.error || new Error('Failed to read IndexedDB entries'));
      tx.onabort = () => reject(tx.error || cursorRequest.error || new Error('Failed to read IndexedDB entries'));
    } catch (error) {
      reject(error);
    }
  });
};
