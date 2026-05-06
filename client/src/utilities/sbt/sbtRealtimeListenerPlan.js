export const getSbtInstanceListenerPlan = ({
  allowInstanceListeners = true,
  maxOverridePresent = false,
  maxOverrideValue = undefined,
  networkID = '',
  sbtList = {},
} = {}) => {
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

  const addresses = Object.values(sbtList || {})
    .map((entry) => entry && entry.sbtAddress)
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
