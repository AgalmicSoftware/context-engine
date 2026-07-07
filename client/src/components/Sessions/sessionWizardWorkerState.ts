import { normalizeWorkerUrl as normalizeWorkerAuthUrl } from '../../utilities/worker/workerAuth.js';
import { toStr } from '../../utilities/shared/primitives.js';

type SessionWizardConfigSyncStatus = Record<string, unknown> & {
  synced?: unknown;
};

export const resolveDeployWorkerState = ({
  responseWorkerUrl,
  configuredWorkerUrl,
}: {
  responseWorkerUrl?: unknown;
  configuredWorkerUrl?: unknown;
} = {}) => {
  const resolvedDeployWorkerUrl = normalizeWorkerAuthUrl(toStr(responseWorkerUrl).trim());
  const displayWorkerUrl = resolvedDeployWorkerUrl || normalizeWorkerAuthUrl(toStr(configuredWorkerUrl).trim());
  return {
    resolvedDeployWorkerUrl,
    displayWorkerUrl,
    deployComplete: !!resolvedDeployWorkerUrl,
  };
};

export const resolveSessionWizardWorkerBaseUrl = ({
  configuredWorkerUrl = '',
  deployWorkerUrl = '',
  fallbackWorkerUrl = '',
  workerMode = 'default',
}: {
  configuredWorkerUrl?: unknown;
  deployWorkerUrl?: unknown;
  fallbackWorkerUrl?: unknown;
  workerMode?: unknown;
} = {}) => {
  const configured = normalizeWorkerAuthUrl(toStr(configuredWorkerUrl).trim());
  if (configured) return configured;
  const deployed = normalizeWorkerAuthUrl(toStr(deployWorkerUrl).trim());
  if (deployed) return deployed;
  return toStr(workerMode).trim().toLowerCase() === 'default'
    ? normalizeWorkerAuthUrl(toStr(fallbackWorkerUrl).trim())
    : '';
};

export const resolveSessionWizardWorkerVerificationUiState = ({
  configuredWorkerUrl = '',
  deployWorkerUrl = '',
  defaultWorkerUrl = '',
  deployComplete = false,
  normalModeRequiresCustomWorker = false,
}: {
  configuredWorkerUrl?: unknown;
  deployWorkerUrl?: unknown;
  defaultWorkerUrl?: unknown;
  deployComplete?: boolean;
  normalModeRequiresCustomWorker?: boolean;
} = {}) => {
  const configured = normalizeWorkerAuthUrl(toStr(configuredWorkerUrl).trim());
  const deployed = normalizeWorkerAuthUrl(toStr(deployWorkerUrl).trim());
  const fallback = normalizeWorkerAuthUrl(toStr(defaultWorkerUrl).trim());
  const deployVerifiedInUi = !!deployComplete;
  const effectiveConfiguredWorkerUrl =
    deployVerifiedInUi &&
    !!normalModeRequiresCustomWorker &&
    !!deployed &&
    (!configured || (configured && fallback && configured === fallback))
      ? deployed
      : configured;
  return {
    deployVerifiedInUi,
    effectiveConfiguredWorkerUrl,
  };
};

export const shouldCacheSessionWorkerConfigAfterDeploy = ({
  deployStatusCode,
  configSyncStatus,
  workerUrl,
}: {
  deployStatusCode?: unknown;
  configSyncStatus?: SessionWizardConfigSyncStatus | null;
  workerUrl?: unknown;
} = {}) =>
  !!normalizeWorkerAuthUrl(toStr(workerUrl).trim()) &&
  (Number(deployStatusCode || 0) === 200 || configSyncStatus?.synced === true);
