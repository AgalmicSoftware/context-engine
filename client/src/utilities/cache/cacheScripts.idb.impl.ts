/**
 * @file cacheScripts.idb.impl.js
 * @description Private IndexedDB helper for cacheScripts' key/value persistence.
 *              This intentionally mirrors only the tiny subset of the old
 *              idb-keyval API that cacheScripts actually uses.
 */

const DEFAULT_DB_VERSION = 1;
// Every tab of the site shares this store, and a write to it waits for any other tab's write to end. A phone can
// suspend a tab in the middle of one, and the store then stays held for as long as that tab sleeps; WebKit can also
// leave an open unanswered. So an open, or a transaction on a connection that makes no progress, fails after this
// long, and the caller's fallback takes over, rather than every cache read waiting with it.
export const IDB_STALL_MS = 5_000;

const stalledError = (what: string): Error =>
  new Error(`IndexedDB ${what} made no progress for ${IDB_STALL_MS / 1000} seconds.`);

// When each connection last moved: a transaction completed or a cursor stepped. A transaction aborted for making no
// progress doesn't count, so one failing can't hold back the failure of the others waiting with it.
const lastProgressAt = new WeakMap<IDBDatabase, number>();
const noteProgress = (db: IDBDatabase): void => {
  lastProgressAt.set(db, Date.now());
};

// Fails a transaction once its connection has made no progress for IDB_STALL_MS. Counted from the connection's last
// progress, not from the transaction's start, so a long queue of this tab's own work runs as long as it moves. The
// transaction is aborted, so a write given up can't land after its fallback, and the connection, which the caller
// forgets, is closed. Returns the function that stops the check.
const failWhenStalled = (db: IDBDatabase, tx: IDBTransaction, onStalled: (error: Error) => void): (() => void) => {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = (): void => {
    const idle = Date.now() - Math.max(startedAt, lastProgressAt.get(db) ?? 0);
    if (idle < IDB_STALL_MS) {
      timer = setTimeout(check, IDB_STALL_MS - idle);
      return;
    }
    try {
      tx.abort();
    } catch (_) {
      // Already finishing: the failure stands, as its outcome may never arrive.
    }
    try {
      db.close();
    } catch (_) {}
    onStalled(stalledError('transaction'));
  };
  timer = setTimeout(check, IDB_STALL_MS);
  return () => clearTimeout(timer);
};

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

// A failed operation may mean a lost connection, which fails every later one too, so the next one reopens.
const forgetDatabase = (identity: string, dbPromise: Promise<IDBDatabase>): void => {
  if (dbPromises.get(identity) === dbPromise) dbPromises.delete(identity);
};

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
    let gaveUp = false;
    const stall = setTimeout(() => {
      gaveUp = true;
      forgetDatabase(identity, dbPromise);
      reject(stalledError('open'));
    }, IDB_STALL_MS);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(normalizedStore.storeName)) {
        db.createObjectStore(normalizedStore.storeName);
      }
    };

    request.onsuccess = () => {
      clearTimeout(stall);
      const db = request.result;
      // Answered after it was given up: no operation holds this connection.
      if (gaveUp) {
        db.close();
        return;
      }
      // WebKit can lose a connection, such as after iOS suspends the page: the next operation opens a new one.
      db.onclose = () => forgetDatabase(identity, dbPromise);
      db.onversionchange = () => {
        try {
          db.close();
        } catch (_) {}
        forgetDatabase(identity, dbPromise);
      };
      resolve(db);
    };

    request.onerror = () => {
      clearTimeout(stall);
      if (gaveUp) return;
      forgetDatabase(identity, dbPromise);
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
  const dbPromise = getOrOpenDatabase(normalizedStore);
  const db = await dbPromise;
  const fail = (reject: (error: unknown) => void, error: unknown) => {
    forgetDatabase(getStoreIdentity(normalizedStore), dbPromise);
    reject(error);
  };

  return new Promise((resolve, reject) => {
    let request: IDBRequest<T> | null = null;
    let stopStallCheck: (() => void) | undefined;
    try {
      const tx = db.transaction(normalizedStore.storeName, mode);
      stopStallCheck = failWhenStalled(db, tx, (error) => fail(reject, error));
      const objectStore = tx.objectStore(normalizedStore.storeName);
      request = executeRequest(objectStore);

      tx.oncomplete = () => {
        stopStallCheck?.();
        noteProgress(db);
        resolve(request ? request.result : undefined);
      };
      tx.onerror = () => {
        stopStallCheck?.();
        fail(reject, tx.error || request?.error || new Error(`IndexedDB ${mode} failed`));
      };
      tx.onabort = () => {
        stopStallCheck?.();
        fail(reject, tx.error || request?.error || new Error(`IndexedDB ${mode} aborted`));
      };
    } catch (error) {
      stopStallCheck?.();
      fail(reject, error);
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
  const dbPromise = getOrOpenDatabase(normalizedStore);
  const db = await dbPromise;
  const fail = (reject: (error: unknown) => void, error: unknown) => {
    forgetDatabase(getStoreIdentity(normalizedStore), dbPromise);
    reject(error);
  };

  return new Promise((resolve, reject) => {
    let stopStallCheck: (() => void) | undefined;
    try {
      const tx = db.transaction(normalizedStore.storeName, 'readonly');
      stopStallCheck = failWhenStalled(db, tx, (error) => fail(reject, error));
      const objectStore = tx.objectStore(normalizedStore.storeName);
      const collected: CacheIdbEntry[] = [];
      const cursorRequest = objectStore.openCursor();

      cursorRequest.onsuccess = () => {
        // Each entry read is progress: reading a large store takes as long as it needs.
        noteProgress(db);
        const cursor = cursorRequest.result;
        if (!cursor) return;
        collected.push([cursor.key, cursor.value]);
        cursor.continue();
      };

      cursorRequest.onerror = () => {
        stopStallCheck?.();
        fail(reject, cursorRequest.error || new Error('Failed to read IndexedDB entries'));
      };

      tx.oncomplete = () => {
        stopStallCheck?.();
        noteProgress(db);
        resolve(collected);
      };
      tx.onerror = () => {
        stopStallCheck?.();
        fail(reject, tx.error || cursorRequest.error || new Error('Failed to read IndexedDB entries'));
      };
      tx.onabort = () => {
        stopStallCheck?.();
        fail(reject, tx.error || cursorRequest.error || new Error('Failed to read IndexedDB entries'));
      };
    } catch (error) {
      stopStallCheck?.();
      fail(reject, error);
    }
  });
};
