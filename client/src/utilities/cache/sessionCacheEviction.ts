/**
 * @module utilities/cache/sessionCacheEviction
 */

import { createLogger } from 'utilities/logging.js';

const mainSiteLog = createLogger('mainSite');
const DG_META_STORAGE_KEY = 'dg_meta_v1';

type StorageRecord = Record<string, unknown>;

const isStorageRecord = (value: unknown): value is StorageRecord => value !== null && typeof value === 'object';

const readDgMeta = (): StorageRecord => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DG_META_STORAGE_KEY) || '{}');
    return isStorageRecord(parsed) ? parsed : {};
  } catch (e) {
    mainSiteLog.warn('MainSite: fallback', e);
    return {};
  }
};

const writeDgMeta = (meta: StorageRecord): void => {
  try {
    localStorage.setItem(DG_META_STORAGE_KEY, JSON.stringify(meta));
  } catch (e) {
    mainSiteLog.warn('MainSite: fallback', e);
  }
};

export function trimLargeArrays(obj: unknown, max = 500, seen?: Set<unknown>): void {
  if (!obj || typeof obj !== 'object') return;
  if (!seen) seen = new Set();
  if (seen.has(obj)) return;
  seen.add(obj);
  if (Array.isArray(obj)) {
    if (obj.length > max) obj.splice(0, obj.length - max);
    obj.forEach((item) => trimLargeArrays(item, max, seen));
    return;
  }
  const record = obj as StorageRecord;
  Object.keys(record).forEach((k) => trimLargeArrays(record[k], max, seen));
}

export function evictOldDgEntries(maxAgeMs = 7 * 24 * 60 * 60 * 1000): number {
  const meta = readDgMeta();
  const threshold = Date.now() - maxAgeMs;
  let deleted = 0;
  Object.keys(meta).forEach((key) => {
    if (!key.startsWith('dg:')) return;
    if (Number(meta[key] || 0) >= threshold) return;
    try {
      localStorage.removeItem(key);
      deleted++;
    } catch (e) {
      mainSiteLog.warn('MainSite: fallback', e);
    }
    delete meta[key];
  });
  writeDgMeta(meta);
  return deleted;
}

export function updateDgMetaTimestamp(storageKey: string): void {
  try {
    const meta = readDgMeta();
    meta[storageKey] = Date.now();
    writeDgMeta(meta);
  } catch (e) {
    mainSiteLog.warn('MainSite: fallback', e);
  }
}

export function removeDgMetaTimestamp(storageKey: string): void {
  try {
    const meta = readDgMeta();
    if (meta[storageKey] !== undefined) {
      delete meta[storageKey];
      writeDgMeta(meta);
    }
  } catch (e) {
    mainSiteLog.warn('MainSite: fallback', e);
  }
}
