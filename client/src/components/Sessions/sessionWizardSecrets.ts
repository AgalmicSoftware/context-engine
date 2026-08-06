import { toStr } from '../../utilities/shared/primitives.js';
import { WORKER_SECRET_PERSISTED_FIELDS } from './sessionWizardWorkerSecretSupport';
import type { AnyRecord, WorkerSecretSyncResult, WorkerSecretsLike, WorkerSecretsRefLike } from '../shellTypes';

type AsyncShellCallback = (input?: AnyRecord) => Promise<any>;

export const resolveWorkerSecretsSnapshot = ({
  workerSecretsRef = null,
  workerSecrets = null,
  defaults = null,
}: {
  workerSecretsRef?: WorkerSecretsRefLike;
  workerSecrets?: WorkerSecretsLike | null;
  defaults?: WorkerSecretsLike | null;
} = {}): WorkerSecretsLike => {
  const fallbackSecrets = defaults && typeof defaults === 'object' ? defaults : {};
  const stateSecrets = workerSecrets && typeof workerSecrets === 'object' ? workerSecrets : {};
  const refSecrets =
    workerSecretsRef &&
    typeof workerSecretsRef === 'object' &&
    workerSecretsRef.current &&
    typeof workerSecretsRef.current === 'object'
      ? workerSecretsRef.current
      : {};

  return {
    ...fallbackSecrets,
    ...stateSecrets,
    ...refSecrets,
  };
};

export const buildWorkerSecretsPayload = (workerSecrets: WorkerSecretsLike = {}): Record<string, string> =>
  WORKER_SECRET_PERSISTED_FIELDS.reduce(
    (acc, key) => {
      const trimmed = toStr(workerSecrets?.[key]).trim();
      if (!trimmed) return acc;
      acc[key] = trimmed;
      return acc;
    },
    {} as Record<string, string>,
  );

const TRANSIENT_SYNC_ERROR_PATTERNS = [
  'failed to reach worker auth endpoint',
  'failed to fetch',
  'networkerror',
  'network request failed',
  'load failed',
  'fetch failed',
];

const CONFIG_SYNC_ERROR_PATTERNS = [
  'alloworigins',
  'origin not allowed',
  'sessionSlug does not match'.toLowerCase(),
  'missing sessionslug',
  'admin authorization failed',
  'session config not found',
];

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const toErrorMessage = (err: unknown) => toStr((err as AnyRecord)?.message || err).trim();

export const isTransientSecretsSyncError = (err: unknown): boolean => {
  const message = toErrorMessage(err).toLowerCase();
  if (!message) return false;
  return TRANSIENT_SYNC_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const isSecretsSyncConfigError = (err: unknown): boolean => {
  const message = toErrorMessage(err).toLowerCase();
  if (!message) return false;
  return CONFIG_SYNC_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const isSecretsSyncConfigBootstrapError = (err: unknown): boolean => {
  const message = toErrorMessage(err).toLowerCase();
  if (!message) return false;
  return message.includes('admin authorization failed') || message.includes('session config not found');
};

export const syncWorkerSecretsAfterDeploy = async ({
  workerUrl = '',
  account = '',
  slug = '',
  sessionId = '',
  deploySecrets = {},
  signAdminAction,
  postSecrets,
  ensureSessionConfig,
  helperWritesSecrets = true,
  retryDelaysMs = [350, 700, 1400, 2200],
  wait = defaultWait,
}: {
  workerUrl?: string;
  account?: string;
  slug?: string;
  sessionId?: string;
  deploySecrets?: WorkerSecretsLike | null;
  signAdminAction?: AsyncShellCallback;
  postSecrets?: AsyncShellCallback;
  ensureSessionConfig?: AsyncShellCallback;
  helperWritesSecrets?: boolean;
  retryDelaysMs?: readonly number[];
  wait?: (ms: number) => Promise<void>;
} = {}): Promise<WorkerSecretSyncResult> => {
  const secrets = deploySecrets && typeof deploySecrets === 'object' ? deploySecrets : {};
  if (!Object.keys(secrets).length) {
    return { warning: '', note: '', synced: false, skipped: true };
  }

  if (helperWritesSecrets) {
    return {
      warning: '',
      note: 'Deploy helper already wrote secrets; skipped browser post-deploy secret sync.',
      synced: false,
      deferred: true,
      skipped: true,
    };
  }

  const resolvedWorkerUrl = toStr(workerUrl).trim();
  if (!resolvedWorkerUrl) {
    return {
      warning: 'Worker URL unavailable; unable to verify or sync worker secrets.',
      note: '',
      synced: false,
    };
  }

  if (!toStr(account).trim()) {
    return {
      warning: 'Connect a wallet, then save worker secrets from /admin.',
      note: '',
      synced: false,
    };
  }

  let lastErr: unknown = null;
  let configSeedAttempted = false;
  const delays = Array.isArray(retryDelaysMs) ? retryDelaysMs : [];
  const attemptCount = delays.length + 1;
  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    try {
      const requestBody: AnyRecord = {
        sessionSlug: slug,
        ...(toStr(sessionId).trim() ? { sessionId: toStr(sessionId).trim() } : {}),
        secrets,
      };
      const auth =
        (await signAdminAction?.({
          action: 'set-secrets',
          body: requestBody,
          targetSlug: slug,
          workerUrl: resolvedWorkerUrl,
        })) || {};
      await postSecrets?.({ auth, secrets, body: requestBody, workerUrl: resolvedWorkerUrl, slug });
      return { warning: '', note: '', synced: true, attempts: attempt + 1 };
    } catch (err) {
      lastErr = err;
      if (!configSeedAttempted && typeof ensureSessionConfig === 'function' && isSecretsSyncConfigBootstrapError(err)) {
        configSeedAttempted = true;
        try {
          await ensureSessionConfig({
            workerUrl: resolvedWorkerUrl,
            slug,
            account,
          });
          attempt -= 1;
          continue;
        } catch (configErr) {
          lastErr = configErr;
        }
      }
      if (attempt < delays.length && (isTransientSecretsSyncError(err) || isSecretsSyncConfigBootstrapError(err))) {
        const delayMs = Number(delays[attempt] || 0);
        if (delayMs > 0) {
          await wait(delayMs);
        }
        continue;
      }
      break;
    }
  }

  const message = toErrorMessage(lastErr) || 'Failed to sync worker secrets after deploy.';
  return { warning: message, note: '', synced: false };
};

export const syncWorkerConfigAfterPartialDeploy = async ({
  deployResponse = null,
  workerUrl = '',
  account = '',
  slug = '',
  ensureSessionConfig,
}: {
  deployResponse?: AnyRecord | null;
  workerUrl?: string;
  account?: string;
  slug?: string;
  ensureSessionConfig?: AsyncShellCallback;
} = {}): Promise<WorkerSecretSyncResult> => {
  if (deployResponse?.partial !== true) {
    return { warning: '', note: '', synced: false, skipped: true };
  }

  if (typeof ensureSessionConfig !== 'function') {
    return {
      warning: 'Worker config sync callback unavailable after partial deploy.',
      note: '',
      synced: false,
    };
  }

  try {
    await ensureSessionConfig({ workerUrl, slug, account });
    return { warning: '', note: '', synced: true };
  } catch (err) {
    const deployWriteMessage = toErrorMessage(deployResponse?.configWriteError);
    return {
      warning: toErrorMessage(err) || deployWriteMessage || 'Failed to sync worker config after deploy.',
      note: '',
      synced: false,
    };
  }
};

export const withSecretsSyncWarning = (baseStatus = '', warning = ''): string => {
  const status = toStr(baseStatus).trim();
  const note = toStr(warning).trim();
  if (!note) return status;
  return `${status || 'Worker deployed.'} Secrets sync warning: ${note}`;
};

export const withWorkerConfigSyncWarning = (baseStatus = '', warning = ''): string => {
  const status = toStr(baseStatus).trim();
  const note = toStr(warning).trim();
  if (!note) return status;
  return `${status || 'Worker deployed.'} Config sync warning: ${note}`;
};

export const withSecretsSyncStatus = (
  baseStatus = '',
  { warning = '', note = '' }: Partial<WorkerSecretSyncResult> = {},
): string => {
  const status = toStr(baseStatus).trim();
  const warningText = toStr(warning).trim();
  const noteText = toStr(note).trim();
  const prefix = status || 'Worker deployed.';
  if (warningText) return withSecretsSyncWarning(prefix, warningText);
  if (noteText) return `${prefix} Secrets sync note: ${noteText}`;
  return prefix;
};
