/**
 * @module storageManager
 * @description IndexedDB/localStorage storage abstraction — provides durable key-value storage
 *              with quota management, namespace isolation, and schema migration.
 *
 * Key exports: storageManager (default)
 */
import { createLogger } from '../logging.js';

const storageLog = createLogger('cache');

const DG_PREFIX = 'dg:';

const DB_NAME = 'ce_dg_cache_db';
const DB_VERSION = 1;
const DB_STORE = 'dg_cache_entries';

const BROADCAST_CHANNEL_NAME = 'ce_dg_cache_v1';

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ARRAY_ENTRIES = 500;

const clientId = (() => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {
    storageLog.warn('storageManager: fallback', e);
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
})();

let broadcastChannel = null;

const getBroadcastChannel = () => {
  if (broadcastChannel) return broadcastChannel;
  try {
    if (typeof BroadcastChannel === 'undefined') return null;
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    return broadcastChannel;
  } catch (_) {
    broadcastChannel = null;
    return null;
  }
};

const broadcast = (message) => {
  const chan = getBroadcastChannel();
  if (!chan) return;
  try {
    chan.postMessage({
      ...(message || {}),
      _dg: true,
      sourceId: clientId,
      ts: Date.now(),
    });
  } catch (e) {
    storageLog.warn('storageManager: fallback', e);
  }
};

const isQuotaExceeded = (err) => {
  if (!err) return false;
  if (err?.name === 'QuotaExceededError') return true;
  const msg = String(err?.message || err);
  return /quota/i.test(msg) && /exceed/i.test(msg);
};

const parseDgKey = (key) => {
  const k = String(key || '');
  if (!k.startsWith(DG_PREFIX)) return null;
  const rest = k.slice(DG_PREFIX.length);
  const lastColon = rest.lastIndexOf(':');
  if (lastColon === -1) return null;
  return {
    name: rest.slice(0, lastColon),
    slug: rest.slice(lastColon + 1),
    key: k,
  };
};

const makeKey = (name, slug) => `${DG_PREFIX}${String(name || '')}:${String(slug || '')}`;

const trimLargeArraysInPlace = (value, maxEntries = MAX_ARRAY_ENTRIES, seen = new Set()) => {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    if (value.length > maxEntries) {
      value.splice(0, value.length - maxEntries);
    }
    value.forEach((item) => trimLargeArraysInPlace(item, maxEntries, seen));
    return;
  }

  Object.keys(value).forEach((k) => {
    trimLargeArraysInPlace(value[k], maxEntries, seen);
  });
};

// -------- IndexedDB helpers --------
let dbPromise = null;
let idbUnavailable = false;
let migrationPromise = null;

const openDb = () => {
  if (idbUnavailable) return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      idbUnavailable = true;
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      idbUnavailable = true;
      reject(request.error || new Error('Failed to open cache DB'));
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        const store = db.createObjectStore(DB_STORE, { keyPath: 'key' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      try {
        db.onversionchange = () => {
          try {
            db.close();
          } catch (e) {
            storageLog.warn('storageManager: cleanup', e);
          }
          dbPromise = null;
        };
      } catch (e) {
        storageLog.warn('storageManager: cleanup', e);
      }
      resolve(db);
    };
  });

  return dbPromise;
};

const idbTx = (db, mode, fn) => {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(DB_STORE, mode);
      const store = tx.objectStore(DB_STORE);
      const req = fn(store);

      const finish = (handler) => {
        try {
          handler();
        } catch (e) {
          reject(e);
        }
      };

      if (req && typeof req.onsuccess !== 'undefined') {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }

      tx.oncomplete = () => finish(() => resolve(req ? req.result : undefined));
      tx.onerror = () => reject(tx.error || req?.error);
      tx.onabort = () => reject(tx.error || req?.error);
    } catch (e) {
      reject(e);
    }
  });
};

const idbGetRecord = async (db, key) => {
  return idbTx(db, 'readonly', (store) => store.get(key));
};

const idbPutRecord = async (db, record) => {
  await idbTx(db, 'readwrite', (store) => store.put(record));
};

const idbDeleteRecord = async (db, key) => {
  await idbTx(db, 'readwrite', (store) => store.delete(key));
};

const idbGetAllRecords = async (db) => {
  try {
    // `getAll` is widely supported in modern browsers.
    const records = await idbTx(db, 'readonly', (store) => store.getAll());
    return Array.isArray(records) ? records : [];
  } catch (_) {
    return [];
  }
};

const migrateLocalStorageToIdb = async (db) => {
  if (typeof localStorage === 'undefined') return;

  let keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DG_PREFIX)) keys.push(key);
    }
  } catch (_) {
    keys = [];
  }

  if (!keys.length) return;

  const now = Date.now();
  for (const key of keys) {
    const parsed = parseDgKey(key);
    if (!parsed) continue;

    let raw = null;
    try {
      raw = localStorage.getItem(key);
    } catch (_) {
      raw = null;
    }

    if (raw == null) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        storageLog.warn('storageManager: fallback', e);
      }
      continue;
    }

    let value = null;
    try {
      value = JSON.parse(raw);
    } catch (_) {
      value = raw;
    }

    try {
      const existing = await idbGetRecord(db, key);
      const createdAt = Number(existing?.createdAt) || now;
      await idbPutRecord(db, {
        key,
        name: parsed.name,
        slug: parsed.slug,
        value,
        createdAt,
        updatedAt: now,
      });
      localStorage.removeItem(key);
    } catch (e) {
      storageLog.warn('DG migration failed for key:', key, e);
    }
  }
};

const ensureMigration = async (db) => {
  if (migrationPromise) return migrationPromise;
  migrationPromise = migrateLocalStorageToIdb(db);
  return migrationPromise;
};

const evictOldIdbEntries = async (db, { maxAgeMs = CACHE_MAX_AGE_MS } = {}) => {
  const threshold = Date.now() - maxAgeMs;
  const records = await idbGetAllRecords(db);
  const toDelete = records
    .filter((rec) => (Number(rec?.updatedAt) || 0) < threshold)
    .map((rec) => rec.key)
    .filter(Boolean);
  for (const key of toDelete) {
    try {
      await idbDeleteRecord(db, key);
    } catch (e) {
      storageLog.warn('storageManager: fallback', e);
    }
  }
  return toDelete.length;
};

const trimIdbArrays = async (db, { maxEntries = MAX_ARRAY_ENTRIES } = {}) => {
  const records = await idbGetAllRecords(db);
  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue;
    if (!rec.value || typeof rec.value !== 'object') continue;
    try {
      trimLargeArraysInPlace(rec.value, maxEntries);
      await idbPutRecord(db, rec);
    } catch (e) {
      storageLog.warn('storageManager: fallback', e);
    }
  }
};

// -------- localStorage fallback helpers --------
const LS_META_KEY = 'dg_meta_v1';

const readLocalStorageMeta = () => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
};

const writeLocalStorageMeta = (meta) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_META_KEY, JSON.stringify(meta || {}));
  } catch (e) {
    storageLog.warn('storageManager: fallback', e);
  }
};

const evictOldLocalStorageEntries = ({ maxAgeMs = CACHE_MAX_AGE_MS } = {}) => {
  if (typeof localStorage === 'undefined') return 0;
  const threshold = Date.now() - maxAgeMs;
  const meta = readLocalStorageMeta();
  let deleted = 0;

  Object.keys(meta).forEach((key) => {
    if (!key.startsWith(DG_PREFIX)) return;
    const ts = Number(meta[key] || 0);
    if (ts && ts >= threshold) return;
    try {
      localStorage.removeItem(key);
      deleted += 1;
    } catch (e) {
      storageLog.warn('storageManager: fallback', e);
    }
    delete meta[key];
  });

  writeLocalStorageMeta(meta);
  return deleted;
};

const trimLocalStorageArrays = ({ maxEntries = MAX_ARRAY_ENTRIES } = {}) => {
  if (typeof localStorage === 'undefined') return;
  const meta = readLocalStorageMeta();

  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DG_PREFIX)) keys.push(key);
    }
  } catch (e) {
    storageLog.warn('storageManager: fallback', e);
  }

  const now = Date.now();

  keys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      trimLargeArraysInPlace(parsed, maxEntries);
      localStorage.setItem(key, JSON.stringify(parsed));
      meta[key] = now;
    } catch (e) {
      storageLog.warn('storageManager: fallback', e);
    }
  });

  writeLocalStorageMeta(meta);
};

// -------- Public API --------
const storageManager = {
  key: makeKey,

  subscribe: (handler) => {
    const chan = getBroadcastChannel();
    if (!chan) return () => {};

    const listener = (event) => {
      const msg = event?.data;
      if (!msg || msg._dg !== true) return;
      if (msg.sourceId && msg.sourceId === clientId) return;
      try {
        handler(msg);
      } catch (e) {
        storageLog.warn('storageManager: callback', e);
      }
    };

    try {
      chan.addEventListener('message', listener);
    } catch (_) {
      try {
        chan.onmessage = listener;
      } catch (e) {
        storageLog.warn('storageManager: fallback', e);
      }
    }

    return () => {
      try {
        chan.removeEventListener('message', listener);
      } catch (e) {
        storageLog.warn('storageManager: cleanup', e);
      }
    };
  },

  read: async (name, slug) => {
    const key = makeKey(name, slug);

    let db = null;
    try {
      db = await openDb();
      await ensureMigration(db);
    } catch (_) {
      db = null;
      idbUnavailable = true;
    }

    if (db) {
      try {
        const record = await idbGetRecord(db, key);
        return record && Object.prototype.hasOwnProperty.call(record, 'value') ? record.value : null;
      } catch (e) {
        storageLog.warn('DG.read IndexedDB failed; falling back to localStorage', e);
      }
    }

    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (_) {
      return null;
    }
  },

  write: async (name, slug, obj) => {
    const key = makeKey(name, slug);

    let db = null;
    try {
      db = await openDb();
      await ensureMigration(db);
    } catch (_) {
      db = null;
      idbUnavailable = true;
    }

    const now = Date.now();

    if (db) {
      try {
        const existing = await idbGetRecord(db, key);
        const createdAt = Number(existing?.createdAt) || now;
        await idbPutRecord(db, {
          key,
          name: String(name || ''),
          slug: String(slug || ''),
          value: obj,
          createdAt,
          updatedAt: now,
        });
        broadcast({ action: 'write', key, name, slug });
        return;
      } catch (e) {
        if (isQuotaExceeded(e)) {
          storageLog.warn('DG.write IndexedDB quota exceeded; evicting/compacting...', e);
          try {
            await evictOldIdbEntries(db);
            await trimIdbArrays(db);
            trimLargeArraysInPlace(obj, MAX_ARRAY_ENTRIES);
            const existing = await idbGetRecord(db, key);
            const createdAt = Number(existing?.createdAt) || now;
            await idbPutRecord(db, {
              key,
              name: String(name || ''),
              slug: String(slug || ''),
              value: obj,
              createdAt,
              updatedAt: Date.now(),
            });
            broadcast({ action: 'write', key, name, slug, compacted: true });
            return;
          } catch (retryErr) {
            storageLog.error('DG.write IndexedDB retry failed; falling back to localStorage', retryErr);
          }
        } else {
          storageLog.warn('DG.write IndexedDB failed; falling back to localStorage', e);
        }
      }
    }

    // localStorage fallback
    const meta = readLocalStorageMeta();
    try {
      localStorage.setItem(key, JSON.stringify(obj));
      meta[key] = now;
      writeLocalStorageMeta(meta);
      broadcast({ action: 'write', key, name, slug, fallback: 'localStorage' });
      return;
    } catch (e) {
      if (!isQuotaExceeded(e)) {
        storageLog.warn('DG.write localStorage failed', e);
        return;
      }
    }

    // Quota exceeded: evict older caches, trim arrays, retry once.
    try {
      evictOldLocalStorageEntries();
      trimLocalStorageArrays();
      trimLargeArraysInPlace(obj, MAX_ARRAY_ENTRIES);
    } catch (e) {
      storageLog.warn('storageManager: fallback', e);
    }

    try {
      localStorage.setItem(key, JSON.stringify(obj));
      meta[key] = Date.now();
      writeLocalStorageMeta(meta);
      broadcast({ action: 'write', key, name, slug, compacted: true, fallback: 'localStorage' });
    } catch (e) {
      storageLog.error('DG.write localStorage still failing after eviction/trim', e);
    }
  },

  remove: async (name, slug) => {
    const key = makeKey(name, slug);

    let db = null;
    try {
      db = await openDb();
      await ensureMigration(db);
    } catch (_) {
      db = null;
      idbUnavailable = true;
    }

    if (db) {
      try {
        await idbDeleteRecord(db, key);
        broadcast({ action: 'remove', key, name, slug });
        return;
      } catch (e) {
        storageLog.warn('DG.remove IndexedDB failed; falling back to localStorage', e);
      }
    }

    try {
      localStorage.removeItem(key);
    } catch (e) {
      storageLog.warn('storageManager: fallback', e);
    }

    try {
      const meta = readLocalStorageMeta();
      delete meta[key];
      writeLocalStorageMeta(meta);
    } catch (e) {
      storageLog.warn('storageManager: fallback', e);
    }

    broadcast({ action: 'remove', key, name, slug, fallback: 'localStorage' });
  },
};

export default storageManager;
