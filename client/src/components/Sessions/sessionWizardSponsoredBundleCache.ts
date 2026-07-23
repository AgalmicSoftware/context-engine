import {
  hasSponsoredBundleFields,
  normalizeSparseSponsoredBundlePayload,
} from '../../utilities/arweave/sponsoredBundles.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord } from '../shellTypes';

const LEGACY_SPONSORED_BUNDLE_SESSION_STORAGE_KEYS = Object.freeze([
  'ce:sessionWizardSponsoredBundle:v1',
  'ce:sessionWizardSponsoredBundle:ek:v1',
  'ce:sessionWizardSponsoredBundle:tabId:v1',
]);
const LEGACY_SPONSORED_BUNDLE_KEY_DB_NAME = 'ce-sponsored-bundle-keys';

const sponsoredBundleMemoryCache = new Map<string, AnyRecord>();
let legacySponsoredBundleDatabasePurgePromise: Promise<void> | null = null;

const removeLegacySponsoredBundleSessionStorage = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const storage = window.sessionStorage;
    LEGACY_SPONSORED_BUNDLE_SESSION_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
  } catch (_) {}
};

const deleteLegacySponsoredBundleKeyDatabase = (): Promise<void> => {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.deleteDatabase !== 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(LEGACY_SPONSORED_BUNDLE_KEY_DB_NAME);
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      request.onsuccess = finish;
      request.onerror = finish;
      request.onblocked = finish;
    } catch (_) {
      resolve();
    }
  });
};

export const purgeLegacySessionWizardSponsoredBundleStorage = async (): Promise<void> => {
  removeLegacySponsoredBundleSessionStorage();
  if (!legacySponsoredBundleDatabasePurgePromise) {
    legacySponsoredBundleDatabasePurgePromise = deleteLegacySponsoredBundleKeyDatabase();
  }
  await legacySponsoredBundleDatabasePurgePromise;
};

export const __test__resetSessionWizardSponsoredBundleCacheKey = (): void => {
  sponsoredBundleMemoryCache.clear();
  legacySponsoredBundleDatabasePurgePromise = null;
};

export const readSessionWizardSponsoredBundleCache = async (txId = ''): Promise<AnyRecord | null> => {
  await purgeLegacySessionWizardSponsoredBundleStorage();
  const normalizedTxId = toStr(txId).trim();
  if (!normalizedTxId) return null;
  const normalizedBundle = normalizeSparseSponsoredBundlePayload(sponsoredBundleMemoryCache.get(normalizedTxId));
  return hasSponsoredBundleFields(normalizedBundle) ? normalizedBundle : null;
};

export const writeSessionWizardSponsoredBundleCache = async (
  txId = '',
  bundle: AnyRecord | null = null,
): Promise<void> => {
  await purgeLegacySessionWizardSponsoredBundleStorage();
  const normalizedTxId = toStr(txId).trim();
  if (!normalizedTxId) return;
  const normalizedBundle = normalizeSparseSponsoredBundlePayload(bundle);
  if (hasSponsoredBundleFields(normalizedBundle)) {
    sponsoredBundleMemoryCache.set(normalizedTxId, normalizedBundle);
  } else {
    sponsoredBundleMemoryCache.delete(normalizedTxId);
  }
};

if (typeof window !== 'undefined') {
  void purgeLegacySessionWizardSponsoredBundleStorage();
}
