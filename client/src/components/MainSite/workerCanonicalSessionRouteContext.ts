import type { MainSiteSessionConfigLike } from '../../utilities/session/mainSiteSessionConfig.js';
import { getChainById } from '../../variables/chains.js';
import { resolveValidatedWorkerCanonicalLitProfile } from './litSessionConfig';

type MainSiteRouteNetwork = Record<string, unknown> | null | undefined;

export const resolveExplicitWorkerSessionConfig = ({
  workerOrigin,
  sessionConfig,
}: {
  workerOrigin: string;
  sessionConfig: MainSiteSessionConfigLike;
}): MainSiteSessionConfigLike => {
  if (!workerOrigin) return sessionConfig;
  const validatedLitProfile = resolveValidatedWorkerCanonicalLitProfile(sessionConfig.sessionModeProfile);
  const chainId = Number(validatedLitProfile?.evm.registryChainId || 0);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) return sessionConfig;
  if (Number(sessionConfig.networkChainId || 0) === chainId) return sessionConfig;
  // The validated Lit profile drives both hook construction and downstream
  // response-gate/mint consumers; never leave a stale top-level chain override.
  return { ...sessionConfig, networkChainId: chainId };
};

export const resolveExplicitWorkerSessionNetwork = ({
  workerOrigin,
  sessionConfig,
  fallbackNetwork,
}: {
  workerOrigin: string;
  sessionConfig: MainSiteSessionConfigLike;
  fallbackNetwork: MainSiteRouteNetwork;
}): MainSiteRouteNetwork => {
  if (!workerOrigin) return fallbackNetwork;
  const chainId = Number(sessionConfig.networkChainId || 0);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) return null;
  return getChainById(chainId) || { id: chainId, chainId };
};
