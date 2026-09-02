import { toStr } from '../../utilities/shared/primitives.js';
import { fingerprintSessionWizardJson } from './sessionWizardCanonicalJson';

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

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const isStructuredSessionWizardDeployAttemptConflict = (responseBody: unknown): boolean => {
  const body = isRecord(responseBody) ? responseBody : {};
  return body.deploymentRequestConflict === true && body.deploymentRequestTerminal === true;
};

export const shouldRetainSessionWizardDeployAttemptIdentity = (status: number, responseBody: unknown): boolean => {
  const body = isRecord(responseBody) ? responseBody : {};
  if (body.deploymentRequestPending === true) return true;
  // Only a server-declared terminal conflict may rotate the next attempt.
  // A generic conflict can still belong to an in-flight peer tab.
  if (body.deploymentRequestTerminal === true) return false;
  if (body.deploymentRequestConflict === true || body.deploymentRequestIdConflict === true) return true;
  const errorMessage = toStr(body.error).trim();
  if (
    status === 409 &&
    /^deploymentRequestId was already used with a different request payload\.?$/i.test(errorMessage)
  ) {
    // Compatibility for helpers deployed before the structured conflict field.
    return true;
  }
  const hasOrphanOutcome = isRecord(body.orphanResources) && Object.keys(body.orphanResources).length > 0;
  if (hasOrphanOutcome) return false;
  return status === 408 || status === 425 || status === 429 || status >= 500;
};

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
  const scopeDigest = fingerprintSessionWizardJson('context-engine:worker-deploy-scope:v1', scope);
  const storageKey = `${STORAGE_KEY_PREFIX}${scopeDigest}`;
  const record = readAttemptRecord(storageRef, storageKey);
  if (!writeAttemptRecord(storageRef, storageKey, record)) {
    throw new Error('Durable browser storage is required for safe worker deployment retries.');
  }
  return {
    deploymentRequestId: `deploy:${fingerprintSessionWizardJson('context-engine:worker-deploy-attempt:v1', {
      scopeDigest,
      generation: record.generation,
    })}`,
    configRevision: `revision:${fingerprintSessionWizardJson('context-engine:worker-deploy-config:v1', {
      scopeDigest,
      generation: record.generation,
    })}`,
    ...record,
    storageKey,
  };
};

export const advanceSessionWizardDeployAttemptGeneration = (
  identity: SessionWizardDeployAttemptIdentity,
  {
    storage,
    allowCompletedTerminalConflict = false,
  }: {
    storage?: StorageLike | null;
    allowCompletedTerminalConflict?: boolean;
  } = {},
): boolean => {
  const storageRef = getStorage(storage);
  if (!storageRef) return false;
  const current = readAttemptRecord(storageRef, identity.storageKey);
  // A successful peer tab makes this scope terminal. A stale failure callback must
  // never reopen it unless the server proves this ID is terminally bound elsewhere.
  if (current.status === 'completed' && !allowCompletedTerminalConflict) return true;
  const minimumNextGeneration =
    current.status === 'completed' && allowCompletedTerminalConflict ? current.generation + 1 : identity.generation + 1;
  const next = Math.min(Math.max(current.generation, minimumNextGeneration), MAX_GENERATION);
  return writeAttemptRecord(storageRef, identity.storageKey, { generation: next, status: 'active' });
};

export const markSessionWizardDeployAttemptCompleted = (
  identity: SessionWizardDeployAttemptIdentity,
  { storage }: { storage?: StorageLike | null } = {},
): boolean => {
  const storageRef = getStorage(storage);
  if (!storageRef) return false;
  const current = readAttemptRecord(storageRef, identity.storageKey);
  // Peer tabs may finish out of order. Never let an older success move durable
  // state backward, while still allowing a newer success to repair/supersede an
  // older completed record left by a stale callback or previous client version.
  if (current.generation > identity.generation) return true;
  if (current.generation === identity.generation && current.status === 'completed') return true;
  return writeAttemptRecord(storageRef, identity.storageKey, {
    generation: identity.generation,
    status: 'completed',
  });
};
