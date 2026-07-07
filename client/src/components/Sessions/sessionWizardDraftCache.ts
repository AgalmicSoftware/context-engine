import {
  removeKeys,
  safeJsonRead,
  safeJsonWrite,
  type RemoveKeysResult,
  type SafeJsonWriteResult,
} from '../../utilities/cache/storageJson.js';

export const SESSION_WIZARD_CACHE_KEY = 'ce:sessionWizardDraft:v1';
export const SESSION_WIZARD_DRAFT_CACHE_MAX_BYTES = 4 * 1024 * 1024;

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

type SessionWizardDraftCacheOptions = {
  storage?: StorageLike | null;
};

type SessionWizardDraftCacheWriteOptions = SessionWizardDraftCacheOptions & {
  maxBytes?: unknown;
};

type SessionWizardDraftCacheClearOptions = SessionWizardDraftCacheOptions & {
  clearPendingSbtDrafts?: (() => void) | null;
};

const getLocalStorage = (storageIn?: StorageLike | null): StorageLike | null => {
  if (storageIn !== undefined) return storageIn;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (_) {}
  return null;
};

export const readSessionWizardDraftCache = ({ storage }: SessionWizardDraftCacheOptions = {}): unknown | null => {
  const storageRef = getLocalStorage(storage);
  if (!storageRef) return null;
  const result = safeJsonRead(storageRef, SESSION_WIZARD_CACHE_KEY);
  return result.ok ? result.value : null;
};

export const writeSessionWizardDraftCache = (
  payload: unknown,
  { storage, maxBytes }: SessionWizardDraftCacheWriteOptions = {},
): SafeJsonWriteResult => {
  const storageRef = getLocalStorage(storage);
  if (!storageRef) {
    return {
      ok: false,
      status: 'missing-storage',
      error: 'localStorage is unavailable.',
    };
  }
  return safeJsonWrite(storageRef, SESSION_WIZARD_CACHE_KEY, payload, {
    maxBytes: maxBytes ?? SESSION_WIZARD_DRAFT_CACHE_MAX_BYTES,
  });
};

export const clearSessionWizardDraftCache = ({
  storage,
  clearPendingSbtDrafts,
}: SessionWizardDraftCacheClearOptions = {}): RemoveKeysResult => {
  const storageRef = getLocalStorage(storage);
  const result = storageRef
    ? removeKeys(storageRef, SESSION_WIZARD_CACHE_KEY)
    : {
        ok: false,
        removed: 0,
        failed: 1,
        status: 'missing-storage' as const,
      };

  if (typeof clearPendingSbtDrafts === 'function') {
    clearPendingSbtDrafts();
  }

  return result;
};
