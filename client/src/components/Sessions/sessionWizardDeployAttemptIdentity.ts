import sha256 from 'crypto-js/sha256';

type UnknownRecord = Record<string, unknown>;

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

export type SessionWizardDeployAttemptIdentity = {
  deploymentRequestId: string;
  configRevision: string;
  generation: number;
  storageKey: string;
};

const STORAGE_KEY_PREFIX = 'ce:sessionWizardDeployAttempt:v1:';
const MAX_GENERATION = Number.MAX_SAFE_INTEGER - 1;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as UnknownRecord)
    .sort()
    .reduce<UnknownRecord>((result, key) => {
      const entry = (value as UnknownRecord)[key];
      if (entry !== undefined) result[key] = canonicalize(entry);
      return result;
    }, {});
};

const digest = (namespace: string, value: unknown): string =>
  sha256(`${namespace}:${JSON.stringify(canonicalize(value))}`).toString();

const getStorage = (storage?: StorageLike | null): StorageLike | null => {
  if (storage !== undefined) return storage;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch (_) {
    return null;
  }
};

const readGeneration = (storage: StorageLike, storageKey: string): number => {
  try {
    const raw = storage.getItem?.(storageKey);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { generation?: unknown };
    const generation = Number(parsed?.generation);
    return Number.isSafeInteger(generation) && generation >= 0 ? Math.min(generation, MAX_GENERATION) : 0;
  } catch (_) {
    return 0;
  }
};

const writeGeneration = (storage: StorageLike, storageKey: string, generation: number): boolean => {
  try {
    if (typeof storage.setItem !== 'function') return false;
    storage.setItem(storageKey, JSON.stringify({ version: 1, generation }));
    return true;
  } catch (_) {
    return false;
  }
};

export const resolveSessionWizardDeployAttemptIdentity = ({
  scope,
  storage,
}: {
  scope: UnknownRecord;
  storage?: StorageLike | null;
}): SessionWizardDeployAttemptIdentity => {
  const storageRef = getStorage(storage);
  if (!storageRef) throw new Error('Durable browser storage is required for safe worker deployment retries.');
  const scopeDigest = digest('context-engine:worker-deploy-scope:v1', scope);
  const storageKey = `${STORAGE_KEY_PREFIX}${scopeDigest}`;
  const generation = readGeneration(storageRef, storageKey);
  if (!writeGeneration(storageRef, storageKey, generation)) {
    throw new Error('Durable browser storage is required for safe worker deployment retries.');
  }
  return {
    deploymentRequestId: `deploy:${digest('context-engine:worker-deploy-attempt:v1', { scopeDigest, generation })}`,
    configRevision: `revision:${digest('context-engine:worker-deploy-config:v1', { scopeDigest, generation })}`,
    generation,
    storageKey,
  };
};

export const advanceSessionWizardDeployAttemptGeneration = (
  identity: SessionWizardDeployAttemptIdentity,
  { storage }: { storage?: StorageLike | null } = {},
): boolean => {
  const storageRef = getStorage(storage);
  if (!storageRef) return false;
  const current = readGeneration(storageRef, identity.storageKey);
  const next = Math.min(Math.max(current, identity.generation + 1), MAX_GENERATION);
  return writeGeneration(storageRef, identity.storageKey, next);
};

export const clearSessionWizardDeployAttemptIdentity = (
  identity: SessionWizardDeployAttemptIdentity,
  { storage }: { storage?: StorageLike | null } = {},
): boolean => {
  const storageRef = getStorage(storage);
  if (!storageRef || typeof storageRef.removeItem !== 'function') return false;
  if (readGeneration(storageRef, identity.storageKey) !== identity.generation) return true;
  try {
    storageRef.removeItem(identity.storageKey);
    return true;
  } catch (_) {
    return false;
  }
};
