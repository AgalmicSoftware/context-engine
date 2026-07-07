import {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  SBTsList,
  upsertCachedSessionWorkerConfig,
  mockGetRelevantBlockWindowForFilter,
  mockGetAllSessionEntries,
  mockGetDemoSessionConfigBySlug,
  mockGetSessionChainId,
  mockGetSessionConfigBySlug,
  mockSessionRegistryGetAllSessionEntries,
  mockReadSessionScanScope,
  mockReadSessionScanSlugs,
  mockPeekCacheSync,
  mockReadCache,
  openSessionSelector,
  setupSBTsListLoadingStatusTestLifecycle,
} from './SBTsList.loadingStatus.testUtils';

describe('SBTsList progress and scan flag loading status', () => {
  setupSBTsListLoadingStatusTestLifecycle();

  it('shows both the refresh-adjacent spinner and the universe corner spinner while a selected-session search is active', async () => {
    localStorage.setItem('dg:sbt:fullScanInProgress:alpha', 'true');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');

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
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Group list settings/i }));

    await waitFor(() => {
      expect(screen.getByTestId('session-universe-spinner')).toBeInTheDocument();
      expect(screen.getByTestId('sbt-refresh-busy-spinner')).toBeInTheDocument();
    });
  });

  it('ignores stale all-groups scan flags once a session cache watermark is already synced', async () => {
    localStorage.clear();
    localStorage.setItem('dg:sbt:fullScanInProgress:alpha', 'true');
    localStorage.setItem('dg:sbt:deferredFullScanNeeded:alpha', 'true');
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const syncedCache = {
      84532: {
        sbtList: {
          [alphaAddress.toLowerCase()]: {
            sbtAddress: alphaAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'Alpha Synced Badge',
              description: 'synced despite stale flags',
              sessionSlug: 'alpha',
              mintingEndTime: 0,
            },
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1100,
          },
        },
        lastBlock: 1100,
      },
    };

    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') return syncedCache;
      return { 84532: { lastBlock: 0, sbtList: {} } };
    });
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') return syncedCache;
      return { 84532: { lastBlock: 0, sbtList: {} } };
    });
    mockGetRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1000, toBlock: 1100 });

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
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Synced Badge')).toBeInTheDocument();
    });

    await openSessionSelector();
    expect(screen.getByTestId('session-chip-progress-wrap-alpha')).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5200));
    });
    await waitFor(() => {
      expect(screen.queryByTestId('session-chip-progress-wrap-alpha')).not.toBeInTheDocument();
    });
    await waitFor(
      () => {
        expect(screen.queryByTestId('section-spinner-live')).not.toBeInTheDocument();
      },
      { timeout: 2500 },
    );
  }, 15000);

  it('clears stale scan flags and marks session loaded after failed fetch when worker URL is missing', async () => {
    localStorage.clear();
    localStorage.setItem('dg:lastActiveSbtSession', 'test-4');
    localStorage.setItem('dg:sbt:fullScanInProgress:test-4', 'true');
    localStorage.setItem('dg:sbt:deferredFullScanNeeded:test-4', 'true');

    mockGetAllSessionEntries.mockReturnValue([['test-4', { slug: 'test-4' }]]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([['test-4', { slug: 'test-4' }]]);
    mockGetSessionChainId.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'test-4') return null;
      return 84532;
    });
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'test-4') {
        return {
          slug: 'test-4',
          sessionName: 'test-4',
          blockLimits: { start: 1 },
          corsWorkerUrl: '',
        };
      }
      return {
        sessionName: normalized || 'General',
        blockLimits: { start: 1 },
        corsWorkerUrl: 'https://worker.example',
      };
    });
    mockPeekCacheSync.mockReturnValue(null);
    mockReadCache.mockResolvedValue({});

    render(
      <SBTsList
        provider="mock"
        network={{}}
        account=""
        sessionSlug="test-4"
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    const chip = await screen.findByTestId('session-chip-test-4');
    await waitFor(() => {
      expect(chip).toHaveAttribute('data-session-loaded', 'true');
    });
    expect(localStorage.getItem('dg:sbt:fullScanInProgress:test-4')).toBeNull();
    expect(localStorage.getItem('dg:sbt:deferredFullScanNeeded:test-4')).toBeNull();
  });

  it('keeps stale scan flags active when the worker-config replica overlays a missing worker URL', async () => {
    localStorage.clear();
    localStorage.setItem('dg:lastActiveSbtSession', 'test-4');
    localStorage.setItem('dg:sbt:fullScanInProgress:test-4', 'true');
    localStorage.setItem('dg:sbt:deferredFullScanNeeded:test-4', 'true');
    upsertCachedSessionWorkerConfig({
      slug: 'test-4',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });

    mockGetAllSessionEntries.mockReturnValue([['test-4', { slug: 'test-4' }]]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([['test-4', { slug: 'test-4' }]]);
    mockGetSessionChainId.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'test-4') return null;
      return 84532;
    });
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'test-4') {
        return {
          slug: 'test-4',
          sessionName: 'test-4',
          blockLimits: { start: 1 },
          corsWorkerUrl: '',
        };
      }
      return {
        sessionName: normalized || 'General',
        blockLimits: { start: 1 },
        corsWorkerUrl: 'https://worker.example',
      };
    });
    mockPeekCacheSync.mockReturnValue(null);
    mockReadCache.mockResolvedValue({});

    render(
      <SBTsList
        provider="mock"
        network={{}}
        account=""
        sessionSlug="test-4"
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-wrap-test-4')).toBeInTheDocument();
    });

    const chip = screen.getByTestId('session-chip-test-4');
    expect(chip).toHaveAttribute('data-session-loaded', 'false');
    expect(localStorage.getItem('dg:sbt:fullScanInProgress:test-4')).toBe('true');
    expect(localStorage.getItem('dg:sbt:deferredFullScanNeeded:test-4')).toBe('true');
  });

  it('keeps demo-only scan flags active when display config provides worker context', async () => {
    localStorage.clear();
    localStorage.setItem('dg:lastActiveSbtSession', 'edge');
    localStorage.setItem('dg:sbt:fullScanInProgress:edge', 'true');
    localStorage.setItem('dg:sbt:deferredFullScanNeeded:edge', 'true');

    mockGetAllSessionEntries.mockReturnValue([['edge', { slug: 'edge' }]]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([['edge', { slug: 'edge' }]]);
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'edge') return null;
      return {
        sessionName: normalized || 'General',
        blockLimits: { start: 1 },
        corsWorkerUrl: 'https://worker.example',
      };
    });
    mockGetDemoSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized !== 'edge') return null;
      return {
        slug: 'edge',
        sessionName: 'Edge 2025',
        blockLimits: { start: 1 },
        corsWorkerUrl: 'https://edge-demo-worker.example',
      };
    });
    mockPeekCacheSync.mockReturnValue(null);
    mockReadCache.mockResolvedValue({});

    render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="edge"
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-wrap-edge')).toBeInTheDocument();
    });

    const chip = screen.getByTestId('session-chip-edge');
    expect(chip).toHaveAttribute('data-session-loaded', 'false');
    expect(localStorage.getItem('dg:sbt:fullScanInProgress:edge')).toBe('true');
    expect(localStorage.getItem('dg:sbt:deferredFullScanNeeded:edge')).toBe('true');
    expect(mockGetDemoSessionConfigBySlug).toHaveBeenCalledWith('edge', { allowDemoFallback: true });
  });
});
