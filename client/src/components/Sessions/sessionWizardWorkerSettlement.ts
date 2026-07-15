import {
  removeKeys,
  safeJsonRead,
  safeJsonWrite,
  type RemoveKeysResult,
  type SafeJsonWriteResult,
} from '../../utilities/cache/storageJson.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { normalizeOrigin } from '../../utilities/urlUtils.js';

export const SESSION_WIZARD_WORKER_SETTLEMENT_KEY = 'ce:sessionWizardWorkerSettlement:v1';

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

type SettlementStorageOptions = {
  storage?: StorageLike | null;
};

export type SessionWizardWorkerSettlement = {
  version: 1;
  workerUrl: string;
  slug: string;
  sessionId: string;
  settledAt: number;
};

type SessionWizardWorkerSettlementInput = {
  workerUrl?: unknown;
  slug?: unknown;
  sessionId?: unknown;
  settledAt?: unknown;
};

const getLocalStorage = (storageIn?: StorageLike | null): StorageLike | null => {
  if (storageIn !== undefined) return storageIn;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (_) {}
  return null;
};

const normalizeSettlement = (value: unknown): SessionWizardWorkerSettlement | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const workerUrl = normalizeOrigin(candidate.workerUrl);
  const slug = toStr(candidate.slug).trim();
  const sessionId = toStr(candidate.sessionId).trim();
  const settledAt = Number(candidate.settledAt);
  if (candidate.version !== 1 || !workerUrl || !slug || !sessionId || !Number.isFinite(settledAt) || settledAt <= 0) {
    return null;
  }
  return { version: 1, workerUrl, slug, sessionId, settledAt };
};

export const readSessionWizardWorkerSettlement = ({
  storage,
}: SettlementStorageOptions = {}): SessionWizardWorkerSettlement | null => {
  const storageRef = getLocalStorage(storage);
  if (!storageRef) return null;
  const result = safeJsonRead(storageRef, SESSION_WIZARD_WORKER_SETTLEMENT_KEY, null, { clearInvalid: true });
  if (!result.ok) return null;
  const settlement = normalizeSettlement(result.value);
  if (!settlement) removeKeys(storageRef, SESSION_WIZARD_WORKER_SETTLEMENT_KEY);
  return settlement;
};

export const writeSessionWizardWorkerSettlement = (
  input: SessionWizardWorkerSettlementInput,
  { storage }: SettlementStorageOptions = {},
): SafeJsonWriteResult => {
  const storageRef = getLocalStorage(storage);
  const settlement = normalizeSettlement({
    version: 1,
    workerUrl: input.workerUrl,
    slug: input.slug,
    sessionId: input.sessionId,
    settledAt: input.settledAt ?? Date.now(),
  });
  if (!settlement) {
    return {
      ok: false,
      status: 'not-serializable',
      error: 'A worker URL, slug, session ID, and settlement timestamp are required.',
    };
  }
  return safeJsonWrite(storageRef, SESSION_WIZARD_WORKER_SETTLEMENT_KEY, settlement);
};

export const clearSessionWizardWorkerSettlement = ({
  storage,
}: SettlementStorageOptions = {}): RemoveKeysResult => {
  const storageRef = getLocalStorage(storage);
  return storageRef
    ? removeKeys(storageRef, SESSION_WIZARD_WORKER_SETTLEMENT_KEY)
    : { ok: false, removed: 0, failed: 1, status: 'missing-storage' };
};

export const isSessionWizardWorkerSettlementForWorker = (
  settlement: SessionWizardWorkerSettlement | null | undefined,
  workerUrl: unknown,
): boolean => {
  const normalizedWorkerUrl = normalizeOrigin(workerUrl);
  return !!settlement && !!normalizedWorkerUrl && settlement.workerUrl === normalizedWorkerUrl;
};

export const shouldRestoreSessionWizardWorkerSettlement = ({
  settlement,
  cachedWorkerUrl,
}: {
  settlement?: SessionWizardWorkerSettlement | null;
  cachedWorkerUrl?: unknown;
} = {}): boolean => {
  if (!settlement) return false;
  const normalizedCachedWorkerUrl = normalizeOrigin(cachedWorkerUrl);
  return !normalizedCachedWorkerUrl || isSessionWizardWorkerSettlementForWorker(settlement, normalizedCachedWorkerUrl);
};
