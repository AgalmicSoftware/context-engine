import {
  removeKeys,
  safeJsonRead,
  safeJsonWrite,
  type RemoveKeysResult,
  type SafeJsonWriteResult,
} from '../../utilities/cache/storageJson.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { normalizeOrigin } from '../../utilities/urlUtils.js';

/** Legacy single-record key; retained only for safe migration/cleanup. */
export const SESSION_WIZARD_WORKER_SETTLEMENT_KEY = 'ce:sessionWizardWorkerSettlement:v1';
export const SESSION_WIZARD_WORKER_SETTLEMENT_KEY_PREFIX = 'ce:sessionWizardWorkerSettlement:v2:';

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
  key?: (index: number) => string | null;
  length?: number;
};

type SettlementStorageOptions = {
  storage?: StorageLike | null;
  identity?: SessionWizardWorkerSettlementInput | null;
};

export type SessionWizardWorkerSettlement = {
  version: 2;
  workerUrl: string;
  slug: string;
  sessionId: string;
  settledAt: number;
};

export type SessionWizardWorkerSettlementInput = {
  workerUrl?: unknown;
  slug?: unknown;
  sessionId?: unknown;
  settledAt?: unknown;
};

export type SessionWizardWorkerSettlementClearResult =
  RemoveKeysResult | { ok: false; removed: 0; failed: 1; status: 'invalid-identity' };

const normalizeSettlementSessionId = (value: unknown): string => {
  const rawSessionId = toStr(value).trim();
  // Regression guard: the wizard starts with a UUID but worker persistence returns the same bytes16 as hex.
  // One canonical form keeps cross-tab comparisons and durable storage keys aligned across that boundary.
  return normalizeWorkerCanonicalSessionIdHex(rawSessionId) || rawSessionId;
};

const getLocalStorage = (storageIn?: StorageLike | null): StorageLike | null => {
  if (storageIn !== undefined) return storageIn;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (_) {}
  return null;
};

export const createSessionWizardWorkerSettlement = (value: unknown): SessionWizardWorkerSettlement | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const workerUrl = normalizeOrigin(candidate.workerUrl);
  const slug = toStr(candidate.slug).trim();
  const sessionId = normalizeSettlementSessionId(candidate.sessionId);
  const settledAt = Number(candidate.settledAt ?? Date.now());
  if (!workerUrl || !slug || !sessionId || !Number.isFinite(settledAt) || settledAt <= 0) return null;
  return { version: 2, workerUrl, slug, sessionId, settledAt };
};

const normalizeStoredSettlement = (value: unknown): SessionWizardWorkerSettlement | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 && candidate.version !== 2) return null;
  return createSessionWizardWorkerSettlement(candidate);
};

export const getSessionWizardWorkerSettlementStorageKey = (input: SessionWizardWorkerSettlementInput): string => {
  const settlement = createSessionWizardWorkerSettlement(input);
  if (!settlement) return '';
  const identity = [settlement.workerUrl, settlement.slug, settlement.sessionId]
    .map((part) => encodeURIComponent(part))
    .join(':');
  return `${SESSION_WIZARD_WORKER_SETTLEMENT_KEY_PREFIX}${identity}`;
};

const readSettlementAtKey = (storage: StorageLike, key: string): SessionWizardWorkerSettlement | null => {
  const result = safeJsonRead(storage, key, null, { clearInvalid: true });
  if (!result.ok) return null;
  const settlement = normalizeStoredSettlement(result.value);
  if (!settlement || getSessionWizardWorkerSettlementStorageKey(settlement) !== key) {
    removeKeys(storage, key);
    return null;
  }
  return settlement;
};

const readLegacySettlement = (storage: StorageLike): SessionWizardWorkerSettlement | null => {
  const result = safeJsonRead(storage, SESSION_WIZARD_WORKER_SETTLEMENT_KEY, null, { clearInvalid: true });
  if (!result.ok) return null;
  const settlement = normalizeStoredSettlement(result.value);
  if (!settlement) removeKeys(storage, SESSION_WIZARD_WORKER_SETTLEMENT_KEY);
  return settlement;
};

export const isSessionWizardWorkerSettlementForIdentity = (
  settlement: SessionWizardWorkerSettlement | null | undefined,
  identity: SessionWizardWorkerSettlementInput | null | undefined,
): boolean => {
  const normalizedIdentity = createSessionWizardWorkerSettlement(identity);
  return !!(
    settlement &&
    normalizedIdentity &&
    settlement.workerUrl === normalizedIdentity.workerUrl &&
    settlement.slug === normalizedIdentity.slug &&
    settlement.sessionId === normalizedIdentity.sessionId
  );
};

export const readSessionWizardWorkerSettlement = ({
  storage,
  identity,
}: SettlementStorageOptions = {}): SessionWizardWorkerSettlement | null => {
  const storageRef = getLocalStorage(storage);
  if (!storageRef) return null;

  if (identity) {
    const key = getSessionWizardWorkerSettlementStorageKey(identity);
    if (!key) return null;
    const settlement = readSettlementAtKey(storageRef, key);
    if (settlement) return settlement;
    const legacySettlement = readLegacySettlement(storageRef);
    return isSessionWizardWorkerSettlementForIdentity(legacySettlement, identity) ? legacySettlement : null;
  }

  let newest: SessionWizardWorkerSettlement | null = null;
  if (typeof storageRef.key === 'function' && Number.isFinite(Number(storageRef.length))) {
    for (let index = 0; index < Number(storageRef.length); index += 1) {
      const key = storageRef.key(index);
      if (!key?.startsWith(SESSION_WIZARD_WORKER_SETTLEMENT_KEY_PREFIX)) continue;
      const settlement = readSettlementAtKey(storageRef, key);
      if (settlement && (!newest || settlement.settledAt > newest.settledAt)) newest = settlement;
    }
  }
  return newest || readLegacySettlement(storageRef);
};

export const writeSessionWizardWorkerSettlement = (
  input: SessionWizardWorkerSettlementInput,
  { storage }: SettlementStorageOptions = {},
): SafeJsonWriteResult => {
  const storageRef = getLocalStorage(storage);
  const settlement = createSessionWizardWorkerSettlement(input);
  const key = settlement ? getSessionWizardWorkerSettlementStorageKey(settlement) : '';
  if (!settlement || !key) {
    return {
      ok: false,
      status: 'not-serializable',
      error: 'A worker URL, slug, session ID, and settlement timestamp are required.',
    };
  }
  return safeJsonWrite(storageRef, key, settlement);
};

export const clearSessionWizardWorkerSettlement = (
  identity: SessionWizardWorkerSettlementInput,
  { storage }: SettlementStorageOptions = {},
): SessionWizardWorkerSettlementClearResult => {
  const storageRef = getLocalStorage(storage);
  const key = getSessionWizardWorkerSettlementStorageKey(identity);
  if (!key) return { ok: false, removed: 0, failed: 1, status: 'invalid-identity' };
  if (!storageRef) return { ok: false, removed: 0, failed: 1, status: 'missing-storage' };

  const keys = [key];
  const legacySettlement = readLegacySettlement(storageRef);
  if (isSessionWizardWorkerSettlementForIdentity(legacySettlement, identity)) {
    keys.push(SESSION_WIZARD_WORKER_SETTLEMENT_KEY);
  }
  return removeKeys(storageRef, keys);
};

export const parseSessionWizardWorkerSettlementStorageEvent = ({
  key,
  newValue,
}: {
  key?: string | null;
  newValue?: string | null;
}): SessionWizardWorkerSettlement | null => {
  if (!key?.startsWith(SESSION_WIZARD_WORKER_SETTLEMENT_KEY_PREFIX) || !newValue) return null;
  try {
    const settlement = normalizeStoredSettlement(JSON.parse(newValue));
    return settlement && getSessionWizardWorkerSettlementStorageKey(settlement) === key ? settlement : null;
  } catch (_) {
    return null;
  }
};
