export const resolveSbtRealtimeEventBlockNumber = async ({
  event = {},
  getReadProviderForSession: getProvider = null,
  getRelevantBlockWindowForFilter = null,
  log = null,
  slug = '',
} = {}) => {
  let eventBlockNumber = event?.blockNumber;
  if (eventBlockNumber) return eventBlockNumber;

  if (event?.transactionHash) {
    let readProvider = null;
    try {
      readProvider = typeof getProvider === 'function' ? getProvider(slug) : null;
    } catch (e) {
      if (typeof log?.warn === 'function') {
        log.warn('MainSite: fallback', e);
      }
    }
    if (readProvider && typeof readProvider.getTransactionReceipt === 'function') {
      try {
        const receipt = await readProvider.getTransactionReceipt(event.transactionHash);
        eventBlockNumber = receipt?.blockNumber;
      } catch (e) {
        if (typeof log?.error === 'function') {
          log.error('Failed to get block number from transaction hash for SBT event', e);
        }
        const { toBlock: baseTo } = await getRelevantBlockWindowForFilter(slug);
        eventBlockNumber = baseTo;
      }
    } else {
      const { toBlock: baseTo } = await getRelevantBlockWindowForFilter(slug);
      eventBlockNumber = baseTo;
    }
  } else {
    const { toBlock: baseTo } = await getRelevantBlockWindowForFilter(slug);
    eventBlockNumber = baseTo;
  }

  return eventBlockNumber;
};
