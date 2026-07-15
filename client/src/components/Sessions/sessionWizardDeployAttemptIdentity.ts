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
  status: 'active' | 'completed';
  storageKey: string;
};

type SessionWizardDeployAttemptRecord = Pick<SessionWizardDeployAttemptIdentity, 'generation' | 'status'>;

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

const readAttemptRecord = (storage: StorageLike, storageKey: string): SessionWizardDeployAttemptRecord => {
  try {
    const raw = storage.getItem?.(storageKey);
    if (!raw) return { generation: 0, status: 'active' };
    const parsed = JSON.parse(raw) as { generation?: unknown; status?: unknown };
    const generation = Number(parsed?.generation);
    return {
      generation: Number.isSafeInteger(generation) && generation >= 0 ? Math.min(generation, MAX_GENERATION) : 0,
      status: parsed?.status === 'completed' ? 'completed' : 'active',
    };
  } catch (_) {
    return { generation: 0, status: 'active' };
  }
};

const writeAttemptRecord = (
  storage: StorageLike,
  storageKey: string,
  record: SessionWizardDeployAttemptRecord,
): boolean => {
  try {
    if (typeof storage.setItem !== 'function') return false;
    storage.setItem(storageKey, JSON.stringify({ version: 1, ...record }));
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
  const record = readAttemptRecord(storageRef, storageKey);
  if (!writeAttemptRecord(storageRef, storageKey, record)) {
    throw new Error('Durable browser storage is required for safe worker deployment retries.');
  }
  return {
    deploymentRequestId: `deploy:${digest('context-engine:worker-deploy-attempt:v1', {
      scopeDigest,
      generation: record.generation,
    })}`,
    configRevision: `revision:${digest('context-engine:worker-deploy-config:v1', {
      scopeDigest,
      generation: record.generation,
    })}`,
    ...record,
    storageKey,
  };
};

export const advanceSessionWizardDeployAttemptGeneration = (
  identity: SessionWizardDeployAttemptIdentity,
  { storage }: { storage?: StorageLike | null } = {},
): boolean => {
  const storageRef = getStorage(storage);
  if (!storageRef) return false;
  const current = readAttemptRecord(storageRef, identity.storageKey);
  // A successful peer tab makes this scope terminal. A stale failure callback must
  // never reopen it at a new generation and create a second set of Cloudflare resources.
  if (current.status === 'completed') return true;
  const next = Math.min(Math.max(current.generation, identity.generation + 1), MAX_GENERATION);
  return writeAttemptRecord(storageRef, identity.storageKey, { generation: next, status: 'active' });
};

export const markSessionWizardDeployAttemptCompleted = (
  identity: SessionWizardDeployAttemptIdentity,
  { storage }: { storage?: StorageLike | null } = {},
): boolean => {
  const storageRef = getStorage(storage);
  if (!storageRef) return false;
  const current = readAttemptRecord(storageRef, identity.storageKey);
  if (current.status === 'completed') return true;
  return writeAttemptRecord(storageRef, identity.storageKey, {
    generation: identity.generation,
    status: 'completed',
  });
};
