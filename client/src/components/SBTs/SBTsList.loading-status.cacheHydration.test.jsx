import {
  React,
  act,
  render,
  screen,
  waitFor,
  SBTsList,
  mockPeekCacheSync,
  mockReadCache,
  setupSBTsListLoadingStatusTestLifecycle,
} from './SBTsList.loadingStatus.testUtils';

describe('SBTsList cache hydration loading status', () => {
  setupSBTsListLoadingStatusTestLifecycle();

  it('keeps cached SBT cards visible while refresh reads are still pending', async () => {
    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:fullScanInProgress:beta');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:beta');

    let resolveReadCache;
    const pendingReadCache = new Promise((resolve) => {
      resolveReadCache = resolve;
    });
    mockReadCache.mockImplementation(() => pendingReadCache);

    const alphaAddress = '0x00000000000000000000000000000000000000aa';
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized !== 'alpha') {
        return { 84532: { lastBlock: 0, sbtList: {} } };
      }
      return {
        84532: {
          lastBlock: 1100,
          sbtList: {
            [alphaAddress.toLowerCase()]: {
              sbtAddress: alphaAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Primed Alpha Badge',
                description: 'should remain visible while cache refresh is pending',
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
          },
        },
      };
    });

    render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug=""
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Primed Alpha Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();

    await act(async () => {
      resolveReadCache({
        84532: {
          sbtList: {},
          lastBlock: 0,
        },
      });
      await Promise.resolve();
    });
  });

  it('shows single-session cards from sync cache before light discovery settles', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000ab';
    const alphaLower = alphaAddress.toLowerCase();
    let exposePrimedCard = false;
    const pendingDiscovery = new Promise(() => {});
    const ensureLightSbtDiscovery = jest.fn(() => pendingDiscovery);

    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized !== 'alpha') {
        return { 84532: { lastBlock: 0, sbtList: {} } };
      }
      if (!exposePrimedCard) {
        return { 84532: { lastBlock: 0, sbtList: {} } };
      }
      return {
        84532: {
          lastBlock: 1050,
          sbtList: {
            [alphaLower]: {
              sbtAddress: alphaAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Progressive Alpha Badge',
                description: 'should appear before light discovery settles',
                mintingEndTime: 0,
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1050,
            },
          },
        },
      };
    });

    const { rerender } = render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={ensureLightSbtDiscovery}
        sbtScanProgressBySlug={{}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Loading Groups/i)).toBeInTheDocument();
    });

    exposePrimedCard = true;
    rerender(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={ensureLightSbtDiscovery}
        sbtScanProgressBySlug={{
          alpha: { currentBlock: 1050, latestBlock: 1100 },
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Progressive Alpha Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();
    expect(ensureLightSbtDiscovery).toHaveBeenCalledTimes(1);
  });

  it('keeps mid-scan single-session cards visible across later progress ticks without restoring the blocking loader', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000ac';
    const alphaLower = alphaAddress.toLowerCase();
    let cacheState = 'empty';
    const pendingDiscovery = new Promise(() => {});
    const ensureLightSbtDiscovery = jest.fn(() => pendingDiscovery);

    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized !== 'alpha') {
        return { 84532: { lastBlock: 0, sbtList: {} } };
      }
      if (cacheState !== 'primed') {
        return { 84532: { lastBlock: 0, sbtList: {} } };
      }
      return {
        84532: {
          lastBlock: 1060,
          sbtList: {
            [alphaLower]: {
              sbtAddress: alphaAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Sticky Alpha Badge',
                description: 'should not disappear on later progress ticks',
                mintingEndTime: 0,
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1060,
            },
          },
        },
      };
    });

    const { rerender } = render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={ensureLightSbtDiscovery}
        sbtScanProgressBySlug={{}}
      />,
    );

    cacheState = 'primed';
    rerender(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={ensureLightSbtDiscovery}
        sbtScanProgressBySlug={{
          alpha: { currentBlock: 1060, latestBlock: 1100 },
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Sticky Alpha Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();

    cacheState = 'empty';
    rerender(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={ensureLightSbtDiscovery}
        sbtScanProgressBySlug={{
          alpha: { currentBlock: 1070, latestBlock: 1100 },
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Sticky Alpha Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();
  });
});
