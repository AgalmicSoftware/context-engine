/**
 * @module components/MainSite/storageEviction
 */

import { createLogger } from 'utilities/logging.js';

const mainSiteLog = createLogger('mainSite');
const DG_META_STORAGE_KEY = 'dg_meta_v1';

export function trimLargeArrays(obj: any, max = 500, seen?: Set<any>): void {
  if (!obj || typeof obj !== 'object') return;
  if (!seen) seen = new Set();
  if (seen.has(obj)) return;
  seen.add(obj);
  if (Array.isArray(obj)) {
    if (obj.length > max) obj.splice(0, obj.length - max);
    obj.forEach(item => trimLargeArrays(item, max, seen));
    return;
  }
  Object.keys(obj).forEach(k => trimLargeArrays(obj[k], max, seen));
}

export function evictOldDgEntries(maxAgeMs = 7 * 24 * 60 * 60 * 1000): number {
  let meta: Record<string, any> = {};
  try { meta = JSON.parse(localStorage.getItem(DG_META_STORAGE_KEY) || '{}'); } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
  const threshold = Date.now() - maxAgeMs;
  let deleted = 0;
  Object.keys(meta).forEach(key => {
    if (!key.startsWith('dg:')) return;
    if (Number(meta[key] || 0) >= threshold) return;
    try { localStorage.removeItem(key); deleted++; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    delete meta[key];
  });
  try { localStorage.setItem(DG_META_STORAGE_KEY, JSON.stringify(meta)); } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
  return deleted;
}

export function updateDgMetaTimestamp(storageKey: string): void {
  try {
    let meta: Record<string, any> = {};
    try { meta = JSON.parse(localStorage.getItem(DG_META_STORAGE_KEY) || '{}'); } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    meta[storageKey] = Date.now();
    localStorage.setItem(DG_META_STORAGE_KEY, JSON.stringify(meta));
  } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
}

export function removeDgMetaTimestamp(storageKey: string): void {
  try {
    let meta: Record<string, any> = {};
    try { meta = JSON.parse(localStorage.getItem(DG_META_STORAGE_KEY) || '{}'); } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    if (meta[storageKey] !== undefined) {
      delete meta[storageKey];
      localStorage.setItem(DG_META_STORAGE_KEY, JSON.stringify(meta));
    }
  } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
}
