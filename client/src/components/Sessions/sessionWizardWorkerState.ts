import { normalizeWorkerUrl as normalizeWorkerAuthUrl } from '../../utilities/worker/workerAuth.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type { SessionWizardWorkerRequirementProof } from './sessionWizardWorkerRequirementProof';

type WorkerDeployRuntimeSnapshot = {
  draft?: Record<string, unknown> | null;
  workerMode?: string;
  deployComplete?: boolean;
  deployWorkerUrl?: string;
  workerRequirementProof?: SessionWizardWorkerRequirementProof | null;
};

type WorkerDeployRuntimeRef<Runtime extends WorkerDeployRuntimeSnapshot> = {
  current: Runtime | null;
};

export const publishVerifiedRuntime = <Runtime extends WorkerDeployRuntimeSnapshot>(
  runtimeRef: WorkerDeployRuntimeRef<Runtime> | undefined,
  fallbackDraft: Record<string, unknown>,
  workerUrl: string,
  displayWorkerUrl: string,
  deployComplete: boolean,
  workerRequirementProof: SessionWizardWorkerRequirementProof | null,
  verifiedDraftOverlay: Record<string, unknown> = {},
): void => {
  if (!runtimeRef || !workerUrl) return;
  // React state setters do not flush inside the awaited deploy callback. Keep
  // concurrent draft edits while publishing the verified tuple synchronously.
  const runtime = runtimeRef.current && typeof runtimeRef.current === 'object' ? runtimeRef.current : ({} as Runtime);
  const draft = runtime.draft && typeof runtime.draft === 'object' ? runtime.draft : fallbackDraft;
  runtimeRef.current = {
    ...runtime,
    workerMode: 'custom',
    deployComplete,
    deployWorkerUrl: displayWorkerUrl,
    workerRequirementProof,
    draft: { ...draft, ...verifiedDraftOverlay, corsWorkerUrl: workerUrl },
  } as Runtime;
};

type SessionWizardConfigSyncStatus = Record<string, unknown> & {
  synced?: unknown;
};

export const resolveDeployWorkerState = ({
  responseWorkerUrl,
  configuredWorkerUrl,
  publicConfigVerified = false,
}: {
  responseWorkerUrl?: unknown;
  configuredWorkerUrl?: unknown;
  publicConfigVerified?: boolean;
} = {}) => {
  const resolvedDeployWorkerUrl = normalizeWorkerAuthUrl(toStr(responseWorkerUrl).trim());
  const displayWorkerUrl = resolvedDeployWorkerUrl || normalizeWorkerAuthUrl(toStr(configuredWorkerUrl).trim());
  return {
    resolvedDeployWorkerUrl,
    displayWorkerUrl,
    deployComplete: !!resolvedDeployWorkerUrl && publicConfigVerified,
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
  deployPartial,
  configSyncStatus,
  workerUrl,
}: {
  deployStatusCode?: unknown;
  deployPartial?: unknown;
  configSyncStatus?: SessionWizardConfigSyncStatus | null;
  workerUrl?: unknown;
} = {}) => {
  if (!normalizeWorkerAuthUrl(toStr(workerUrl).trim())) return false;
  // A partial 200 proves infrastructure survival, not config authority. Cache
  // the draft only after the signed recovery write confirms the current config.
  if (deployPartial === true) return configSyncStatus?.synced === true;
  return Number(deployStatusCode || 0) === 200 || configSyncStatus?.synced === true;
};
