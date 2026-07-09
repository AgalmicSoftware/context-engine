type MaybePromise<T> = T | Promise<T>;

interface SbtRealtimeBlockWindow {
  toBlock?: unknown;
}

interface SbtRealtimeEventLike {
  blockNumber?: unknown;
  transactionHash?: unknown;
}

interface SbtRealtimeReadProvider {
  getTransactionReceipt?: (transactionHash: unknown) => MaybePromise<{ blockNumber?: unknown } | null | undefined>;
}

interface SbtRealtimeEventBlockResolverLog {
  error?: (...args: unknown[]) => unknown;
  warn?: (...args: unknown[]) => unknown;
}

interface SbtRealtimeEventBlockResolverOptions {
  event?: SbtRealtimeEventLike | null;
  getReadProviderForSession?: ((slug: unknown) => SbtRealtimeReadProvider | null | undefined) | null;
  getRelevantBlockWindowForFilter?: ((slug: unknown) => MaybePromise<SbtRealtimeBlockWindow>) | null;
  log?: SbtRealtimeEventBlockResolverLog | null;
  slug?: unknown;
}

type GetRelevantBlockWindowForFilter = NonNullable<
  SbtRealtimeEventBlockResolverOptions['getRelevantBlockWindowForFilter']
>;

export const resolveSbtRealtimeEventBlockNumber = async ({
  event = {},
  getReadProviderForSession: getProvider = null,
  getRelevantBlockWindowForFilter = null,
  log = null,
  slug = '',
}: SbtRealtimeEventBlockResolverOptions = {}): Promise<unknown> => {
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
        const { toBlock: baseTo } = await (getRelevantBlockWindowForFilter as GetRelevantBlockWindowForFilter)(slug);
        eventBlockNumber = baseTo;
      }
    } else {
      const { toBlock: baseTo } = await (getRelevantBlockWindowForFilter as GetRelevantBlockWindowForFilter)(slug);
      eventBlockNumber = baseTo;
    }
  } else {
    const { toBlock: baseTo } = await (getRelevantBlockWindowForFilter as GetRelevantBlockWindowForFilter)(slug);
    eventBlockNumber = baseTo;
  }

  return eventBlockNumber;
};
