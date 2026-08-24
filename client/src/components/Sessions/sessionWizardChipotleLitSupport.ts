import { toStr } from '../../utilities/shared/primitives.js';
import { DEFAULT_CHIPOTLE_ACTION, DEFAULT_CHIPOTLE_ACTION_NAME } from '../../utilities/crypto/litChipotleCatalog.js';
import type { AnyRecord, WorkerSecretSyncResult, WorkerSecretsLike } from '../shellTypes';

type AsyncShellResult = AnyRecord | null | undefined;
type AsyncShellCallback<TResult = AsyncShellResult | void> = (input: AnyRecord) => Promise<TResult>;

export type LitProvisionSyncResult = WorkerSecretSyncResult & {
  litActionCid?: string;
  litGroupId?: string;
};

export type LitBootstrapSyncResult = WorkerSecretSyncResult & {
  apiBase?: string;
  litActionCid?: string;
  litGroupId?: string;
  litPkpId?: string;
};

const toTrimmedString = (value: unknown): string => toStr(value).trim();
const toErrorMessage = (err: unknown): string => toTrimmedString((err as AnyRecord)?.message || err);
const defaultWait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const TRANSIENT_LIT_SYNC_ERROR_PATTERNS = [
  'failed to reach worker auth endpoint',
  'failed to fetch',
  'networkerror',
  'network request failed',
  'load failed',
  'fetch failed',
];

const isTransientLitSyncError = (err: unknown): boolean => {
  const message = toErrorMessage(err).toLowerCase();
  if (!message) return false;
  return TRANSIENT_LIT_SYNC_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const SESSION_WIZARD_CHIPOTLE_ACTION_NAME = DEFAULT_CHIPOTLE_ACTION_NAME;
export const SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION = DEFAULT_CHIPOTLE_ACTION;

export const buildSessionWizardLitBootstrapRequest = (
  workerSecrets: WorkerSecretsLike | AnyRecord = {},
  {
    sessionName = '',
  }: {
    sessionName?: unknown;
  } = {},
): AnyRecord | null => {
  const litApiBase = toTrimmedString((workerSecrets as AnyRecord)?.litApiBase);
  const litGroupId = toTrimmedString((workerSecrets as AnyRecord)?.litGroupId);
  const litPkpId = toTrimmedString((workerSecrets as AnyRecord)?.litPkpId);
  const litActionCid = toTrimmedString((workerSecrets as AnyRecord)?.litActionCid);
  const litAccountApiKey = toTrimmedString((workerSecrets as AnyRecord)?.litAccountApiKey);
  const litUsageApiKey = toTrimmedString((workerSecrets as AnyRecord)?.litUsageApiKey);

  if (litAccountApiKey) {
    return {
      litAccountApiKey,
      ...(toTrimmedString(sessionName) ? { sessionName: toTrimmedString(sessionName) } : {}),
      actionCode: SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION.code,
      actionName: SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION.name,
      actionDescription: SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION.description,
    };
  }

  if (!(litApiBase || litAccountApiKey) || litGroupId || litPkpId || litActionCid || litUsageApiKey) {
    return null;
  }

  return {
    ...(litApiBase ? { litApiBase } : {}),
    ...(litAccountApiKey ? { litAccountApiKey } : {}),
    ...(toTrimmedString(sessionName) ? { sessionName: toTrimmedString(sessionName) } : {}),
    actionCode: SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION.code,
    actionName: SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION.name,
    actionDescription: SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION.description,
  };
};

export const buildSessionWizardLitProvisionRequest = (
  workerSecrets: WorkerSecretsLike | AnyRecord = {},
): AnyRecord | null => {
  const litApiBase = toTrimmedString((workerSecrets as AnyRecord)?.litApiBase);
  const litGroupId = toTrimmedString((workerSecrets as AnyRecord)?.litGroupId);
  const litPkpId = toTrimmedString((workerSecrets as AnyRecord)?.litPkpId);
  const litActionCid = toTrimmedString((workerSecrets as AnyRecord)?.litActionCid);

  if (litActionCid || !litApiBase || !litGroupId || !litPkpId) {
    return null;
  }

  return {
    litApiBase,
    litGroupId,
    litPkpId,
    actionCode: SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION.code,
    actionName: SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION.name,
    actionDescription: SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION.description,
  };
};

const isLitProvisionConfigBootstrapError = (err: unknown): boolean => {
  const message = toErrorMessage(err).toLowerCase();
  if (!message) return false;
  return message.includes('admin authorization failed') || message.includes('session config not found');
};

export const syncWorkerLitActionProvisionAfterDeploy = async ({
  workerUrl = '',
  account = '',
  slug = '',
  provisionRequest = null,
  signAdminAction,
  postProvision,
  ensureSessionConfig,
  applyProvisionedConfig,
  retryDelaysMs = [350, 700, 1400, 2200],
  wait = defaultWait,
}: {
  workerUrl?: string;
  account?: string;
  slug?: string;
  provisionRequest?: AnyRecord | null;
  signAdminAction?: AsyncShellCallback;
  postProvision?: AsyncShellCallback<AsyncShellResult>;
  ensureSessionConfig?: AsyncShellCallback;
  applyProvisionedConfig?: AsyncShellCallback;
  retryDelaysMs?: number[];
  wait?: (ms: number) => Promise<void>;
} = {}): Promise<LitProvisionSyncResult> => {
  const requestBody = provisionRequest && typeof provisionRequest === 'object' ? { ...provisionRequest } : null;
  if (!requestBody || !toTrimmedString(requestBody.actionCode)) {
    return { warning: '', note: '', synced: false, skipped: true };
  }

  const resolvedWorkerUrl = toTrimmedString(workerUrl);
  if (!resolvedWorkerUrl) {
    return {
      warning: 'Worker URL unavailable; unable to auto-provision the Lit action.',
      note: '',
      synced: false,
    };
  }

  if (!toTrimmedString(account)) {
    return {
      warning: 'Connect a wallet, then re-save the worker to auto-provision the Lit action.',
      note: '',
      synced: false,
    };
  }

  let lastErr: unknown = null;
  let configSeedAttempted = false;
  const delays = Array.isArray(retryDelaysMs) ? retryDelaysMs : [];
  const maxAttempts = Math.max(2, delays.length + 1);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const auth = await signAdminAction?.({
        action: 'lit-chipotle-provision',
        body: {
          sessionSlug: slug,
          ...requestBody,
        },
        targetSlug: slug,
        workerUrl: resolvedWorkerUrl,
      });
      const result = await postProvision?.({
        auth,
        requestBody,
        workerUrl: resolvedWorkerUrl,
        slug,
      });
      const litActionCid = toTrimmedString(result?.litActionCid);
      const litGroupId = toTrimmedString(result?.litGroupId);
      if (!litActionCid) {
        return {
          warning: 'Lit provisioning did not return a Lit Action CID.',
          note: '',
          synced: false,
        };
      }
      if (typeof applyProvisionedConfig === 'function') {
        await applyProvisionedConfig({
          litActionCid,
          litGroupId,
          workerUrl: resolvedWorkerUrl,
          slug,
          account,
        });
      }
      return {
        warning: '',
        note: 'Lit action auto-provisioned.',
        synced: true,
        litActionCid,
        litGroupId,
      };
    } catch (err) {
      lastErr = err;
      if (
        !configSeedAttempted &&
        typeof ensureSessionConfig === 'function' &&
        isLitProvisionConfigBootstrapError(err)
      ) {
        configSeedAttempted = true;
        try {
          await ensureSessionConfig({ workerUrl: resolvedWorkerUrl, slug, account });
          continue;
        } catch (configErr) {
          lastErr = configErr;
        }
      }
      if (attempt < delays.length && isTransientLitSyncError(err)) {
        const delayMs = Number(delays[attempt] || 0);
        if (delayMs > 0) {
          await wait(delayMs);
        }
        continue;
      }
      break;
    }
  }

  return {
    warning: toErrorMessage(lastErr) || 'Failed to auto-provision the Lit action.',
    note: '',
    synced: false,
  };
};

export const syncWorkerLitSessionBootstrapAfterDeploy = async ({
  workerUrl = '',
  account = '',
  slug = '',
  bootstrapRequest = null,
  signAdminAction,
  postBootstrap,
  ensureSessionConfig,
  applyBootstrappedConfig,
  retryDelaysMs = [350, 700, 1400, 2200],
  wait = defaultWait,
}: {
  workerUrl?: string;
  account?: string;
  slug?: string;
  bootstrapRequest?: AnyRecord | null;
  signAdminAction?: AsyncShellCallback;
  postBootstrap?: AsyncShellCallback<AsyncShellResult>;
  ensureSessionConfig?: AsyncShellCallback;
  applyBootstrappedConfig?: AsyncShellCallback;
  retryDelaysMs?: number[];
  wait?: (ms: number) => Promise<void>;
} = {}): Promise<LitBootstrapSyncResult> => {
  const requestBody = bootstrapRequest && typeof bootstrapRequest === 'object' ? { ...bootstrapRequest } : null;
  if (!requestBody || !toTrimmedString(requestBody.actionCode)) {
    return { warning: '', note: '', synced: false, skipped: true };
  }

  const resolvedWorkerUrl = toTrimmedString(workerUrl);
  if (!resolvedWorkerUrl) {
    return {
      warning: 'Worker URL unavailable; unable to auto-bootstrap the Lit session account.',
      note: '',
      synced: false,
    };
  }

  if (!toTrimmedString(account)) {
    return {
      warning: 'Connect a wallet, then re-save the worker to auto-bootstrap the Lit session account.',
      note: '',
      synced: false,
    };
  }

  let lastErr: unknown = null;
  let configSeedAttempted = false;
  const delays = Array.isArray(retryDelaysMs) ? retryDelaysMs : [];
  const maxAttempts = Math.max(2, delays.length + 1);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const auth = await signAdminAction?.({
        action: 'lit-chipotle-bootstrap-session',
        body: {
          sessionSlug: slug,
          ...requestBody,
        },
        targetSlug: slug,
        workerUrl: resolvedWorkerUrl,
      });
      const result = await postBootstrap?.({
        auth,
        requestBody,
        workerUrl: resolvedWorkerUrl,
        slug,
      });
      const litActionCid = toTrimmedString(result?.litActionCid);
      const litGroupId = toTrimmedString(result?.litGroupId);
      const litPkpId = toTrimmedString(result?.litPkpId);
      const apiBase = toTrimmedString(result?.apiBase || result?.litCredentials?.litApiBase);
      if (!litActionCid || !litGroupId || !litPkpId) {
        return {
          warning: 'Lit bootstrap did not return the full Lit session credentials.',
          note: '',
          synced: false,
        };
      }
      if (typeof applyBootstrappedConfig === 'function') {
        await applyBootstrappedConfig({
          apiBase,
          litActionCid,
          litGroupId,
          litPkpId,
          workerUrl: resolvedWorkerUrl,
          slug,
          account,
          result,
        });
      }
      return {
        warning: '',
        note: 'Lit session account auto-created.',
        synced: true,
        apiBase,
        litActionCid,
        litGroupId,
        litPkpId,
      };
    } catch (err) {
      lastErr = err;
      if (
        !configSeedAttempted &&
        typeof ensureSessionConfig === 'function' &&
        isLitProvisionConfigBootstrapError(err)
      ) {
        configSeedAttempted = true;
        try {
          await ensureSessionConfig({ workerUrl: resolvedWorkerUrl, slug, account });
          continue;
        } catch (configErr) {
          lastErr = configErr;
        }
      }
      if (attempt < delays.length && isTransientLitSyncError(err)) {
        const delayMs = Number(delays[attempt] || 0);
        if (delayMs > 0) {
          await wait(delayMs);
        }
        continue;
      }
      break;
    }
  }

  return {
    warning: toErrorMessage(lastErr) || 'Failed to auto-bootstrap the Lit session account.',
    note: '',
    synced: false,
  };
};

export const withLitBootstrapSyncStatus = (
  baseStatus = '',
  { warning = '', note = '' }: Partial<LitBootstrapSyncResult> = {},
): string => {
  const status = toTrimmedString(baseStatus) || 'Worker deployed.';
  const warningText = toTrimmedString(warning);
  const noteText = toTrimmedString(note);
  if (warningText) return `${status} Lit bootstrap warning: ${warningText}`;
  if (noteText) return `${status} Lit bootstrap note: ${noteText}`;
  return status;
};

export const withLitProvisionSyncStatus = (
  baseStatus = '',
  { warning = '', note = '' }: Partial<LitProvisionSyncResult> = {},
): string => {
  const status = toTrimmedString(baseStatus) || 'Worker deployed.';
  const warningText = toTrimmedString(warning);
  const noteText = toTrimmedString(note);
  if (warningText) return `${status} Lit provisioning warning: ${warningText}`;
  if (noteText) return `${status} Lit provisioning note: ${noteText}`;
  return status;
};
