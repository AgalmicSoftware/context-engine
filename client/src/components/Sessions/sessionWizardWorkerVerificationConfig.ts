import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord, WorkerSecretsLike } from '../shellTypes';
import type { SessionWizardWorkerDeployRuntime } from './hooks/useSessionWizardWorkerDeploy';
import {
  parseSessionWizardAllowOriginsInput,
  resolveSessionWizardWorkerFaucetConfigFromDraft,
  resolveSessionWizardWorkerRpcUrlFromDraft,
  resolveSessionWizardWorkerRpcUrlMapFromDraft,
} from './sessionWizardWorkerRuntimeSupport';
import { buildSessionWizardWorkerConfigPayload } from './sessionWizardWriteNormalization.js';

export const buildSessionWizardWorkerVerificationConfig = ({
  runtime,
  draft = runtime?.draft && typeof runtime.draft === 'object' ? runtime.draft : {},
  adminAddress,
  workerUrl,
  workerSecrets = {},
  allowOrigins = parseSessionWizardAllowOriginsInput(runtime?.workerAllowOrigins),
}: {
  runtime?: SessionWizardWorkerDeployRuntime | null;
  draft?: AnyRecord;
  adminAddress?: unknown;
  workerUrl?: unknown;
  workerSecrets?: WorkerSecretsLike;
  allowOrigins?: unknown;
} = {}): AnyRecord => {
  const resolvedRuntime = runtime && typeof runtime === 'object' ? runtime : {};
  const resolvedDraft = draft && typeof draft === 'object' ? draft : {};
  const resolvedAllowOrigins = Array.isArray(allowOrigins) ? allowOrigins : [];
  const resolvedAdminAddress =
    adminAddress == null
      ? resolvedRuntime.loginComplete === false
        ? ''
        : toStr(resolvedRuntime.account || resolvedRuntime.resolvedAdminAddress).trim()
      : toStr(adminAddress).trim();
  const config = buildSessionWizardWorkerConfigPayload({
    slug: toStr(resolvedDraft.slug).trim(),
    draft: resolvedDraft,
    deployPayload: {
      adminAddress: resolvedAdminAddress,
      rpcUrl: resolveSessionWizardWorkerRpcUrlFromDraft({
        draft: resolvedDraft,
        registryChainId: resolvedRuntime.registryChainId,
        networkId: resolvedRuntime.network?.id,
      }),
      rpcUrlsByChainId: resolveSessionWizardWorkerRpcUrlMapFromDraft({
        draft: resolvedDraft,
        registryChainId: resolvedRuntime.registryChainId,
        networkId: resolvedRuntime.network?.id,
      }),
      allowOrigins: resolvedAllowOrigins,
      limits: Number(resolvedRuntime.workerLimitPerWallet || 0)
        ? { perWalletPerDay: Number(resolvedRuntime.workerLimitPerWallet) }
        : {},
      scopes: {},
      embeddedDeployHelperEnabled: resolvedRuntime.embeddedDeployHelperEnabled,
    },
    account: resolvedAdminAddress,
    registryAddress: resolvedRuntime.registryAddress,
    registryChainId: resolvedRuntime.registryChainId,
    networkChainId: resolvedDraft.networkChainId,
    sessionId: toStr(resolvedRuntime.sessionId || resolvedRuntime.sessionIdHex).trim(),
    latestChainBlock: resolvedRuntime.latestChainBlock,
    workerUrl: toStr(workerUrl || resolvedDraft.corsWorkerUrl).trim(),
    resolveWorkerFaucetConfig: () =>
      resolveSessionWizardWorkerFaucetConfigFromDraft({
        draft: resolvedDraft,
        registryChainId: resolvedRuntime.registryChainId,
        networkId: resolvedRuntime.network?.id,
      }),
    workerSecrets,
  });
  return config;
};
