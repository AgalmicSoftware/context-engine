import {
  removeKeys,
  safeJsonRead,
  safeJsonWrite,
  type RemoveKeysResult,
  type SafeJsonWriteResult,
} from '../../utilities/cache/storageJson.js';
import {
  createSessionWizardWorkerSettlement,
  isSessionWizardWorkerSettlementForIdentity,
  type SessionWizardWorkerSettlementInput,
} from './sessionWizardWorkerSettlement.js';

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
  clearPendingSbtDrafts?: (() => RemoveKeysResult) | null;
  expectedWorkerIdentity?: SessionWizardWorkerSettlementInput | null;
  workerSettlement?: SessionWizardWorkerSettlementInput | null;
};

type SessionWizardDraftClearOutcome =
  | RemoveKeysResult
  | { ok: true; removed: 0; failed: 0; status: 'poisoned' | 'preserved-foreign-draft' }
  | {
      ok: false;
      removed: 0;
      failed: 1;
      status: 'missing-storage' | 'not-serializable' | 'too-large' | 'stringify-failed' | 'write-failed';
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

const getLocalStorage = (storageIn?: StorageLike | null): StorageLike | null => {
  if (storageIn !== undefined) return storageIn;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (_) {}
  return null;
};

const readCachedWorkerIdentity = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const cached = value as Record<string, unknown>;
  const terminalSettlement = createSessionWizardWorkerSettlement(cached.terminalWorkerSettlement);
  if (terminalSettlement) return terminalSettlement;
  const draft = cached.draft && typeof cached.draft === 'object' && !Array.isArray(cached.draft)
    ? cached.draft as Record<string, unknown>
    : {};
  return createSessionWizardWorkerSettlement({
    workerUrl: cached.deployWorkerUrl || draft.corsWorkerUrl,
    slug: draft.slug,
    sessionId: cached.sessionId,
    settledAt: 1,
  });
};

const preserveForeignDraft = (): SessionWizardDraftClearOutcome => ({
  ok: true,
  removed: 0,
  failed: 0,
  status: 'preserved-foreign-draft',
});

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
  expectedWorkerIdentity,
  workerSettlement,
}: SessionWizardDraftCacheClearOptions = {}): SessionWizardDraftCacheClearResult => {
  const storageRef = getLocalStorage(storage);
  let poisoned = false;
  let draft: SessionWizardDraftClearOutcome;
  const terminalWorkerSettlement = createSessionWizardWorkerSettlement(workerSettlement);
  const expectedIdentity = terminalWorkerSettlement || createSessionWizardWorkerSettlement(expectedWorkerIdentity);
  if (storageRef && expectedIdentity) {
    const cachedResult = safeJsonRead(storageRef, SESSION_WIZARD_CACHE_KEY);
    const cacheIsMissing = !cachedResult.ok && cachedResult.status === 'missing';
    const cachedIdentity = cachedResult.ok ? readCachedWorkerIdentity(cachedResult.value) : null;
    const canMutateCache = cacheIsMissing || isSessionWizardWorkerSettlementForIdentity(cachedIdentity, expectedIdentity);

    // The wizard cache is a legacy singleton shared by every tab. Treat its identity
    // as a compare guard so publishing/clearing session X cannot erase a newer draft Y.
    if (!canMutateCache) {
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

  let pendingSbtDrafts: RemoveKeysResult;
  try {
    const result = typeof clearPendingSbtDrafts === 'function' ? clearPendingSbtDrafts() : null;
    pendingSbtDrafts =
      result && typeof result === 'object' && typeof result.ok === 'boolean'
        ? result
        : { ok: false, removed: 0, failed: 1, status: 'missing-storage' };
  } catch (_) {
    pendingSbtDrafts = { ok: false, removed: 0, failed: 1, status: 'partial-failure' };
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
