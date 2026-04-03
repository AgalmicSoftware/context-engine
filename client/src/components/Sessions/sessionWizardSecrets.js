import { toStr } from '../../utilities/shared/primitives.js';

export const resolveWorkerSecretsSnapshot = ({
  workerSecretsRef = null,
  workerSecrets = null,
  defaults = null,
} = {}) => {
  const fallbackSecrets = defaults && typeof defaults === 'object' ? defaults : {};
  const stateSecrets = workerSecrets && typeof workerSecrets === 'object' ? workerSecrets : {};
  const refSecrets = (
    workerSecretsRef &&
    typeof workerSecretsRef === 'object' &&
    workerSecretsRef.current &&
    typeof workerSecretsRef.current === 'object'
  ) ? workerSecretsRef.current : {};

  return {
    ...fallbackSecrets,
    ...stateSecrets,
    ...refSecrets,
  };
};

export const buildWorkerSecretsPayload = (workerSecrets = {}) => (
  Object.entries(workerSecrets || {}).reduce((acc, [key, value]) => {
    const trimmed = toStr(value).trim();
    if (!trimmed) return acc;
    acc[key] = trimmed;
    return acc;
  }, {})
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

const defaultWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toErrorMessage = (err) => toStr(err?.message || err).trim();

export const isTransientSecretsSyncError = (err) => {
  const message = toErrorMessage(err).toLowerCase();
  if (!message) return false;
  return TRANSIENT_SYNC_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const isSecretsSyncConfigError = (err) => {
  const message = toErrorMessage(err).toLowerCase();
  if (!message) return false;
  return CONFIG_SYNC_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const isSecretsSyncConfigBootstrapError = (err) => {
  const message = toErrorMessage(err).toLowerCase();
  if (!message) return false;
  return (
    message.includes('admin authorization failed') ||
    message.includes('session config not found')
  );
};

export const syncWorkerSecretsAfterDeploy = async ({
  workerUrl = '',
  account = '',
  slug = '',
  deploySecrets = {},
  signAdminAction,
  postSecrets,
  ensureSessionConfig,
  helperWritesSecrets = true,
  retryDelaysMs = [350, 700, 1400, 2200],
  wait = defaultWait,
} = {}) => {
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

  let lastErr = null;
  let configSeedAttempted = false;
  const delays = Array.isArray(retryDelaysMs) ? retryDelaysMs : [];
  const attemptCount = delays.length + 1;
  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    try {
      const requestBody = {
        sessionSlug: slug,
        secrets,
      };
      const auth = await signAdminAction({
        action: 'set-secrets',
        body: requestBody,
        targetSlug: slug,
        workerUrl: resolvedWorkerUrl,
      });
      await postSecrets({ auth, secrets, body: requestBody, workerUrl: resolvedWorkerUrl, slug });
      return { warning: '', note: '', synced: true, attempts: attempt + 1 };
    } catch (err) {
      lastErr = err;
      if (
        !configSeedAttempted &&
        typeof ensureSessionConfig === 'function' &&
        isSecretsSyncConfigBootstrapError(err)
      ) {
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
      if (attempt < delays.length && isTransientSecretsSyncError(err)) {
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
} = {}) => {
  if (deployResponse?.partial !== true) {
    return { warning: '', note: '', synced: false, skipped: true };
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

export const withSecretsSyncWarning = (baseStatus = '', warning = '') => {
  const status = toStr(baseStatus).trim();
  const note = toStr(warning).trim();
  if (!note) return status;
  return `${status || 'Worker deployed.'} Secrets sync warning: ${note}`;
};

export const withWorkerConfigSyncWarning = (baseStatus = '', warning = '') => {
  const status = toStr(baseStatus).trim();
  const note = toStr(warning).trim();
  if (!note) return status;
  return `${status || 'Worker deployed.'} Config sync warning: ${note}`;
};

export const withSecretsSyncStatus = (baseStatus = '', { warning = '', note = '' } = {}) => {
  const status = toStr(baseStatus).trim();
  const warningText = toStr(warning).trim();
  const noteText = toStr(note).trim();
  const prefix = status || 'Worker deployed.';
  if (warningText) return withSecretsSyncWarning(prefix, warningText);
  if (noteText) return `${prefix} Secrets sync note: ${noteText}`;
  return prefix;
};
