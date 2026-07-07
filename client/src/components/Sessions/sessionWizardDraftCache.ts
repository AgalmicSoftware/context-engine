import {
  removeKeys,
  safeJsonRead,
  safeJsonWrite,
  type RemoveKeysResult,
  type SafeJsonWriteResult,
} from '../../utilities/cache/storageJson.js';
import {
  createSessionWizardWorkerSettlement,
  type SessionWizardWorkerSettlementInput,
} from './sessionWizardWorkerSettlement.js';
import { WORKER_SECRET_CACHE_SAFE_FIELDS } from './sessionWizardWorkerSecretSupport.js';
import { sanitizeSessionWizardDraftForBrowserCache } from './sessionWizardBrowserCacheSanitization.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { toStr } from '../../utilities/shared/primitives.js';

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
  expectedCachedPayload?: unknown;
  maxBytes?: unknown;
};

type SessionWizardDraftCacheClearOptions = SessionWizardDraftCacheOptions & {
  clearPendingSbtDrafts?: (() => RemoveKeysResult) | null;
  expectedPublicationIdentity?: SessionWizardPublicationIdentityInput | null;
  expectedWorkerIdentity?: SessionWizardWorkerSettlementInput | null;
  workerSettlement?: SessionWizardWorkerSettlementInput | null;
};

export type SessionWizardPublicationIdentityInput = {
  workerUrl?: unknown;
  slug?: unknown;
  sessionId?: unknown;
};

type SessionWizardDraftClearOutcome =
  | RemoveKeysResult
  | { ok: true; removed: 0; failed: 0; status: 'poisoned' | 'preserved-foreign-draft' }
  | {
      ok: false;
      removed: 0;
      failed: 1;
      status:
        | 'invalid-identity'
        | 'missing-storage'
        | 'not-serializable'
        | 'parse-failed'
        | 'read-failed'
        | 'too-large'
        | 'stringify-failed'
        | 'write-failed';
    };

export type SessionWizardDraftCacheWriteResult =
  | SafeJsonWriteResult
  | { ok: true; bytes: 0; key: string; status: 'preserved-foreign-draft' }
  | {
      ok: false;
      error: string;
      status: 'missing-storage' | 'parse-failed' | 'read-failed';
    };

export type SessionWizardDraftCacheClearResult = {
  ok: boolean;
  removed: number;
  failed: number;
  status: 'ok' | 'partial-failure' | 'missing-storage';
  draft: SessionWizardDraftClearOutcome;
  pendingSbtDrafts: RemoveKeysResult;
  poisoned: boolean;
};

const getDraftStorage = (storageIn?: StorageLike | null): StorageLike | null => {
  if (storageIn !== undefined) return storageIn;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch (_) {}
  return null;
};

const getLegacyDraftStorage = (): StorageLike | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (_) {}
  return null;
};

export const readSessionWizardDraftCache = ({ storage }: SessionWizardDraftCacheOptions = {}): unknown | null => {
  const storageRef = getLocalStorage(storage);
  if (!storageRef) return null;
  let result = safeJsonRead(storageRef, SESSION_WIZARD_CACHE_KEY, null, { clearInvalid: true });
  if (!result.ok && result.status === 'parse-failed') {
    // Confirm that clearInvalid actually removed the malformed value. A storage
    // denial stays fail-closed; a successful cleanup restores the missing-cache
    // state so this tab can resume autosaving (or seed the legacy draft below).
    result = safeJsonRead(storageRef, SESSION_WIZARD_CACHE_KEY);
  }
  if (result.ok) {
    const sanitized = sanitizeSessionWizardDraftCacheCredentials(result.value);
    if (!sanitized.changed) return sanitized.value;
    const cleanup = safeJsonWrite(storageRef, SESSION_WIZARD_CACHE_KEY, sanitized.value, {
      maxBytes: SESSION_WIZARD_DRAFT_CACHE_MAX_BYTES,
    });
    if (cleanup.ok) return sanitized.value;
    removeKeys(storageRef, SESSION_WIZARD_CACHE_KEY);
    return null;
  }
  if (storage !== undefined || result.status !== 'missing') return null;

  const legacyStorage = getLegacyDraftStorage();
  const legacyResult = safeJsonRead(legacyStorage, SESSION_WIZARD_CACHE_KEY);
  if (!legacyResult.ok) return null;
  const sanitizedLegacy = sanitizeSessionWizardDraftCacheCredentials(legacyResult.value);
  if (sanitizedLegacy.changed) {
    const cleanup = safeJsonWrite(legacyStorage, SESSION_WIZARD_CACHE_KEY, sanitizedLegacy.value, {
      maxBytes: SESSION_WIZARD_DRAFT_CACHE_MAX_BYTES,
    });
    if (!cleanup.ok) return null;
  }
  // Seed the old shared draft into this tab, then retire the legacy copy on a
  // best-effort basis. Web Storage has no cross-tab compare-and-swap primitive,
  // so concurrent old tabs may both seed a copy; all subsequent writes remain
  // isolated in sessionStorage and a stale legacy key must not wedge autosave.
  const migrationWrite = safeJsonWrite(storageRef, SESSION_WIZARD_CACHE_KEY, sanitizedLegacy.value, {
    maxBytes: SESSION_WIZARD_DRAFT_CACHE_MAX_BYTES,
  });
  if (!migrationWrite.ok) return null;
  removeKeys(legacyStorage, SESSION_WIZARD_CACHE_KEY);
  return sanitizedLegacy.value;
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
      error: 'sessionStorage is unavailable.',
    };
  }
  if (Object.prototype.hasOwnProperty.call(options, 'expectedCachedPayload')) {
    // Draft storage is tab-scoped; this snapshot guard also blocks stale writes
    // from overlapping effects within the same tab.
    const expectedCacheIsMissing = options.expectedCachedPayload == null;
    let cachedResult = safeJsonRead(storageRef, SESSION_WIZARD_CACHE_KEY, null, {
      clearInvalid: expectedCacheIsMissing,
    });
    if (expectedCacheIsMissing && !cachedResult.ok && cachedResult.status === 'parse-failed') {
      cachedResult = safeJsonRead(storageRef, SESSION_WIZARD_CACHE_KEY);
    }
    const cacheMatches = cachedResult.ok
      ? !expectedCacheIsMissing &&
        getJsonValueSignature(cachedResult.value) === getJsonValueSignature(options.expectedCachedPayload)
      : cachedResult.status === 'missing' && expectedCacheIsMissing;
    if (!cacheMatches) {
      if (!cachedResult.ok && cachedResult.status !== 'missing') {
        return {
          ok: false,
          error: cachedResult.error || `Could not read ${SESSION_WIZARD_CACHE_KEY}.`,
          status: cachedResult.status,
        };
      }
      return {
        ok: true,
        bytes: 0,
        key: SESSION_WIZARD_CACHE_KEY,
        status: 'preserved-foreign-draft',
      };
    }
  }
  return safeJsonWrite(storageRef, SESSION_WIZARD_CACHE_KEY, sanitizedPayload, {
    maxBytes: maxBytes ?? SESSION_WIZARD_DRAFT_CACHE_MAX_BYTES,
  });
};

export const clearSessionWizardDraftCache = ({
  storage,
  clearPendingSbtDrafts,
  expectedPublicationIdentity,
  expectedWorkerIdentity,
  workerSettlement,
}: SessionWizardDraftCacheClearOptions = {}): SessionWizardDraftCacheClearResult => {
  const storageRef = getDraftStorage(storage);
  let poisoned = false;
  let draft: SessionWizardDraftClearOutcome;
  const terminalWorkerSettlement = createSessionWizardWorkerSettlement(workerSettlement);
  const comparisonIdentityInput =
    workerSettlement != null
      ? workerSettlement
      : expectedPublicationIdentity != null
        ? expectedPublicationIdentity
        : expectedWorkerIdentity;
  const comparisonIdentitySupplied = comparisonIdentityInput != null;
  const expectedIdentity = normalizePublicationIdentity(comparisonIdentityInput);
  if (storageRef && comparisonIdentitySupplied && !expectedIdentity) {
    draft = { ok: false, removed: 0, failed: 1, status: 'invalid-identity' };
  } else if (storageRef && expectedIdentity) {
    const cachedResult = safeJsonRead(storageRef, SESSION_WIZARD_CACHE_KEY);
    const cacheIsMissing = !cachedResult.ok && cachedResult.status === 'missing';
    const cachedIdentity = cachedResult.ok ? readCachedPublicationIdentity(cachedResult.value) : null;
    const canMutateCache = cacheIsMissing || publicationIdentitiesMatch(cachedIdentity, expectedIdentity);

    // Treat the tab's current identity as a compare guard so completion for X
    // cannot erase a newer draft Y written by a later effect in this tab.
    if (!cachedResult.ok && cachedResult.status !== 'missing') {
      draft = { ok: false, removed: 0, failed: 1, status: cachedResult.status };
    } else if (cachedResult.ok && !cachedIdentity) {
      draft = { ok: false, removed: 0, failed: 1, status: 'invalid-identity' };
    } else if (!canMutateCache) {
      draft = preserveForeignDraft();
    } else if (terminalWorkerSettlement) {
      const poisonResult = safeJsonWrite(
        storageRef,
        SESSION_WIZARD_CACHE_KEY,
        { terminalWorkerSettlement },
        { maxBytes: SESSION_WIZARD_DRAFT_CACHE_MAX_BYTES },
      );
      if (poisonResult.ok) {
        poisoned = true;
        draft = { ok: true, removed: 0, failed: 0, status: 'poisoned' };
      } else {
        // Never fall back to deleting the draft. The durable per-identity marker is
        // written first, so retaining a matching draft lets reload recover the lock.
        draft = { ok: false, removed: 0, failed: 1, status: poisonResult.status };
      }
    } else {
      draft = removeKeys(storageRef, SESSION_WIZARD_CACHE_KEY);
    }
  } else {
    draft = storageRef
      ? removeKeys(storageRef, SESSION_WIZARD_CACHE_KEY)
      : { ok: false, removed: 0, failed: 1, status: 'missing-storage' };
  }

  let pendingSbtDrafts: RemoveKeysResult = { ok: true, removed: 0, failed: 0, status: 'ok' };
  if (draft.ok && draft.status !== 'preserved-foreign-draft') {
    try {
      const result = typeof clearPendingSbtDrafts === 'function' ? clearPendingSbtDrafts() : null;
      pendingSbtDrafts =
        result && typeof result === 'object' && typeof result.ok === 'boolean'
          ? result
          : { ok: false, removed: 0, failed: 1, status: 'missing-storage' };
    } catch (_) {
      pendingSbtDrafts = { ok: false, removed: 0, failed: 1, status: 'partial-failure' };
    }
  }

  const ok = draft.ok && pendingSbtDrafts.ok;
  const status = ok
    ? 'ok'
    : draft.status === 'missing-storage' && pendingSbtDrafts.status === 'missing-storage'
      ? 'missing-storage'
      : 'partial-failure';
  return {
    ok,
    removed: draft.removed + pendingSbtDrafts.removed,
    failed: draft.failed + pendingSbtDrafts.failed,
    status,
    draft,
    pendingSbtDrafts,
    poisoned,
  };
};
