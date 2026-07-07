type SbtInstanceListenerPlanReason =
  'missing-network' | 'empty-cache' | 'disabled' | 'max-disabled' | 'too-many' | 'attach';

interface SbtInstanceListenerPlanOptions {
  allowInstanceListeners?: unknown;
  maxOverridePresent?: unknown;
  maxOverrideValue?: unknown;
  networkID?: unknown;
  sbtList?: unknown;
}

interface SbtInstanceListenerPlan {
  addresses: unknown[];
  count: number;
  hasMaxOverride: boolean;
  maxInstanceListeners: number;
  networkID: string;
  reason: SbtInstanceListenerPlanReason;
  shouldAttach: boolean;
  shouldMarkCoverage: boolean;
}

export const getSbtInstanceListenerPlan = ({
  allowInstanceListeners = true,
  maxOverridePresent = false,
  maxOverrideValue = undefined,
  networkID = '',
  sbtList = {},
}: SbtInstanceListenerPlanOptions = {}): SbtInstanceListenerPlan => {
  const safeNetworkID = String(networkID || '');
  if (!safeNetworkID) {
    return {
      addresses: [],
      count: 0,
      hasMaxOverride: false,
      maxInstanceListeners: 25,
      networkID: safeNetworkID,
      reason: 'missing-network',
      shouldAttach: false,
      shouldMarkCoverage: false,
    };
  }

  const addresses = Object.values((sbtList || {}) as Record<string, unknown>)
    .map((entry) => entry && (entry as { sbtAddress?: unknown }).sbtAddress)
    .filter(Boolean);

  const hasMaxOverride = !!maxOverridePresent;
  let maxInstanceListeners = 25;
  if (hasMaxOverride) {
    const n = Number(maxOverrideValue);
    if (Number.isFinite(n)) maxInstanceListeners = n;
  }

  if (!addresses.length) {
    return {
      addresses,
      count: 0,
      hasMaxOverride,
      maxInstanceListeners,
      networkID: safeNetworkID,
      reason: 'empty-cache',
      shouldAttach: false,
      shouldMarkCoverage: true,
    };
  }

  if (!allowInstanceListeners) {
    return {
      addresses,
      count: addresses.length,
      hasMaxOverride,
      maxInstanceListeners,
      networkID: safeNetworkID,
      reason: 'disabled',
      shouldAttach: false,
      shouldMarkCoverage: false,
    };
  }

  if (hasMaxOverride && maxInstanceListeners <= 0) {
    return {
      addresses,
      count: addresses.length,
      hasMaxOverride,
      maxInstanceListeners,
      networkID: safeNetworkID,
      reason: 'max-disabled',
      shouldAttach: false,
      shouldMarkCoverage: false,
    };
  }

  if (addresses.length > maxInstanceListeners) {
    return {
      addresses,
      count: addresses.length,
      hasMaxOverride,
      maxInstanceListeners,
      networkID: safeNetworkID,
      reason: 'too-many',
      shouldAttach: false,
      shouldMarkCoverage: false,
    };
  }

  return {
    addresses,
    count: addresses.length,
    hasMaxOverride,
    maxInstanceListeners,
    networkID: safeNetworkID,
    reason: 'attach',
    shouldAttach: true,
    shouldMarkCoverage: true,
  };
};
