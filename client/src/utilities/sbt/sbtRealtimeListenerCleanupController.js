import { normalizeSessionSlug } from '../web3/contractScripts.js';

export const createSbtRealtimeListenerCleanupController = ({
  clearCoverage = null,
  contractScripts = null,
} = {}) => {
  const removeSbtRealtimeListenersForGroup = (slugIn, {
    removeFactory = true,
    removeInstance = true,
  } = {}) => {
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
