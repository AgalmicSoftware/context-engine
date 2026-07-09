import { normalizeSessionSlug } from '../web3/chainGateway.js';

interface SbtRealtimeListenerContractScripts {
  removeSBTEventListener?: (provider: string, sessionSlug: string) => unknown;
  removeSBTInstanceEventsListener?: (provider: string, addresses: unknown[], sessionSlug: string) => unknown;
}

interface SbtRealtimeListenerCleanupOptions {
  clearCoverage?: ((sessionSlug: string) => unknown) | null;
  contractScripts?: SbtRealtimeListenerContractScripts | null;
}

interface SbtRealtimeListenerRemovalOptions {
  removeFactory?: boolean;
  removeInstance?: boolean;
}

export const createSbtRealtimeListenerCleanupController = ({
  clearCoverage = null,
  contractScripts = null,
}: SbtRealtimeListenerCleanupOptions = {}) => {
  const removeSbtRealtimeListenersForGroup = (
    slugIn: unknown,
    { removeFactory = true, removeInstance = true }: SbtRealtimeListenerRemovalOptions = {},
  ) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (typeof clearCoverage === 'function') {
      clearCoverage(slug);
    }
    if (removeFactory && typeof contractScripts?.removeSBTEventListener === 'function') {
      contractScripts.removeSBTEventListener('none', slug);
    }
    if (removeInstance && typeof contractScripts?.removeSBTInstanceEventsListener === 'function') {
      contractScripts.removeSBTInstanceEventsListener('none', [], slug);
    }
  };

  return {
    removeSbtRealtimeListenersForGroup,
  };
};
