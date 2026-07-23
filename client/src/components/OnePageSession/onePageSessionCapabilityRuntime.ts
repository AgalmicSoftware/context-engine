import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';

export const sessionAllowsLitRuntime = (sessionConfig: unknown): boolean => {
  const capabilities = resolveSessionCapabilityProjection(sessionConfig);
  return !(
    capabilities.source === 'invalid_profile' ||
    capabilities.source === 'missing' ||
    (capabilities.source === 'profile' && !capabilities.usesLit)
  );
};

export const resolveOnePageSessionNetworkRuntime = <Network>(
  sessionConfig: unknown,
  network: Network,
): { network: Network | Record<string, unknown>; networkChainId: number | null } => {
  const capabilities = resolveSessionCapabilityProjection(sessionConfig);
  if (capabilities.showNetworkControls) {
    return {
      network,
      networkChainId: capabilities.chainId,
    };
  }
  return {
    network: {
      ...(network && typeof network === 'object' ? (network as Record<string, unknown>) : {}),
      id: null,
      chainId: null,
    },
    networkChainId: null,
  };
};
