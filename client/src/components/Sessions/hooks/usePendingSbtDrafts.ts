/** @file usePendingSbtDrafts.js */
import { useCallback, useMemo, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { ethers } from 'ethers';
import { toStr } from '../../../utilities/shared/primitives.js';
import type { AnyRecord } from '../../shellTypes';

export const SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY = 'ce:sessionWizardPendingSbtDrafts:v1';

export type PendingSbtDraft = AnyRecord & {
  id?: string;
  predictedAddress?: string;
  address?: string;
  displayName?: string;
  name?: string;
  tokenURI?: string;
  metadataUploadStatus?: string;
  deployed?: boolean;
};

type SessionStorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

type PendingSbtDraftStorageResult = {
  ok: boolean;
  removed: number;
  failed: number;
  status: 'memory-only' | 'ok' | 'partial-failure';
};

type PendingSbtDraftClearResult = {
  ok: boolean;
  removed: number;
  failed: number;
  status: 'ok' | 'partial-failure';
};

let tabMemoryPendingSbtDrafts: PendingSbtDraft[] = [];
const emptyPendingSbtDrafts: PendingSbtDraft[] = [];
const pendingSbtDraftListeners = new Set<() => void>();

const emitPendingSbtDraftChange = () => {
  pendingSbtDraftListeners.forEach((listener) => listener());
};

const subscribeToPendingSbtDrafts = (listener: () => void) => {
  pendingSbtDraftListeners.add(listener);
  return () => pendingSbtDraftListeners.delete(listener);
};

const getPendingSbtDraftSnapshot = () => tabMemoryPendingSbtDrafts;
const getPendingSbtDraftServerSnapshot = () => emptyPendingSbtDrafts;

export const normalizePendingSbtDrafts = (value: unknown): PendingSbtDraft[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((entry): PendingSbtDraft | null => {
      const predictedAddress = toStr(entry?.predictedAddress || entry?.address).trim();
      if (!predictedAddress || !ethers.utils.isAddress(predictedAddress)) return null;
      const key = predictedAddress.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        ...entry,
        id: toStr(entry?.id).trim() || key,
        predictedAddress,
        displayName: toStr(entry?.displayName || entry?.name || predictedAddress).trim() || predictedAddress,
        tokenURI: toStr(entry?.tokenURI).trim(),
        metadataUploadStatus:
          toStr(entry?.metadataUploadStatus).trim() || (toStr(entry?.tokenURI).trim() ? 'ready' : 'pending-upload'),
      };
    })
    .filter((entry): entry is PendingSbtDraft => !!entry);
};

const getBrowserStorage = (name: 'localStorage' | 'sessionStorage'): SessionStorageLike | null => {
  try {
    return typeof window !== 'undefined' && window[name] ? window[name] : null;
  } catch (_) {
    return null;
  }
};

export const purgeLegacySessionWizardPendingSbtDrafts = ({
  localStorageRef = getBrowserStorage('localStorage'),
  sessionStorageRef = getBrowserStorage('sessionStorage'),
  storage = null,
}: {
  localStorageRef?: SessionStorageLike | null;
  sessionStorageRef?: SessionStorageLike | null;
  storage?: SessionStorageLike | null;
} = {}): PendingSbtDraftClearResult => {
  let removed = 0;
  let failed = 0;
  const stores = new Set<SessionStorageLike>(
    [storage, localStorageRef, sessionStorageRef].filter((candidate): candidate is SessionStorageLike => !!candidate),
  );
  stores.forEach((storageRef) => {
    try {
      storageRef.removeItem?.(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY);
      removed += 1;
    } catch (_) {
      failed += 1;
    }
  });
  return {
    ok: failed === 0,
    removed,
    failed,
    status: failed === 0 ? 'ok' : 'partial-failure',
  };
};

export const readSessionWizardPendingSbtDraftsCache = (): PendingSbtDraft[] => {
  purgeLegacySessionWizardPendingSbtDrafts();
  return normalizePendingSbtDrafts(tabMemoryPendingSbtDrafts);
};

export const writeSessionWizardPendingSbtDraftsCache = (
  payload: PendingSbtDraft[] = [],
  { storage }: { storage?: SessionStorageLike | null } = {},
): PendingSbtDraftStorageResult => {
  const purgeResult = purgeLegacySessionWizardPendingSbtDrafts({ storage });
  tabMemoryPendingSbtDrafts = normalizePendingSbtDrafts(payload);
  emitPendingSbtDraftChange();
  return {
    ...purgeResult,
    status: purgeResult.ok ? 'memory-only' : 'partial-failure',
  };
};

export const clearSessionWizardPendingSbtDraftsCache = ({
  storage,
}: {
  storage?: SessionStorageLike | null;
} = {}): PendingSbtDraftClearResult => {
  tabMemoryPendingSbtDrafts = [];
  const purgeResult = purgeLegacySessionWizardPendingSbtDrafts({ storage });
  emitPendingSbtDraftChange();
  return purgeResult;
};

const usePendingSbtDrafts = () => {
  purgeLegacySessionWizardPendingSbtDrafts();
  const pendingSbtDrafts = useSyncExternalStore(
    subscribeToPendingSbtDrafts,
    getPendingSbtDraftSnapshot,
    getPendingSbtDraftServerSnapshot,
  );
  const setPendingSbtDrafts = useCallback<Dispatch<SetStateAction<PendingSbtDraft[]>>>((nextValue) => {
    const resolved = typeof nextValue === 'function' ? nextValue(tabMemoryPendingSbtDrafts) : nextValue;
    const normalized = normalizePendingSbtDrafts(resolved);
    writeSessionWizardPendingSbtDraftsCache(normalized);
  }, []);
  const normalizedPendingSbtDrafts = useMemo(() => normalizePendingSbtDrafts(pendingSbtDrafts), [pendingSbtDrafts]);
  const hasUndeployedPendingSbtDrafts = normalizedPendingSbtDrafts.some((entry) => entry.deployed !== true);

  return {
    pendingSbtDrafts,
    setPendingSbtDrafts,
    normalizedPendingSbtDrafts,
    hasUndeployedPendingSbtDrafts,
  };
};

purgeLegacySessionWizardPendingSbtDrafts();

export default usePendingSbtDrafts;
