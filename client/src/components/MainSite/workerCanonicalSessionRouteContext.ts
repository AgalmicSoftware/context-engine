import type { MainSiteSessionConfigLike } from '../../utilities/session/mainSiteSessionConfig.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { getChainById } from '../../variables/chains.js';

type MainSiteRouteNetwork = Record<string, unknown> | null | undefined;

export const resolveExplicitWorkerSessionConfig = ({
  workerOrigin,
  sessionConfig,
}: {
  workerOrigin: string;
  sessionConfig: MainSiteSessionConfigLike;
}): MainSiteSessionConfigLike => {
  if (!workerOrigin) return sessionConfig;
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  if (!projection.profileValid || !projection.isWorkerCanonical) return sessionConfig;
  const chainId = Number(projection.chainId || 0);
  if (!projection.showNetworkControls || !Number.isSafeInteger(chainId) || chainId <= 0) {
    return Number(sessionConfig.networkChainId || 0) > 0 ? { ...sessionConfig, networkChainId: null } : sessionConfig;
  }
  if (Number(sessionConfig.networkChainId || 0) === chainId) return sessionConfig;
  // The validated profile drives Lit/SBT consumers; never leave a stale
  // top-level chain override.
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
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  if (!projection.profileValid || !projection.isWorkerCanonical || !projection.showNetworkControls) return null;
  const chainId = Number(projection.chainId || 0);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) return null;
  return getChainById(chainId) || { id: chainId, chainId };
};
