import {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  SBTsList,
  writeGlobalSessionSelection,
  upsertCachedSessionWorkerConfig,
  buildSbtDetailPath,
  sbtsListPath,
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
  resetSBTsListListModeTestState,
  restoreSBTsListSyncBarStep,
} from './SBTsList.listModeRouting.testUtils';

describe('SBTsList list-mode routing and filtering', () => {
  beforeEach(resetSBTsListListModeTestState);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(restoreSBTsListSyncBarStep);

  it('in list-mode scope shows only configured session chips until show-more is used', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
      ['private', { slug: '6cbb4a26-43f0-4478-ac5f-2e8703f8f3fb' }],
    ]);

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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    expect(await screen.findByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Beta' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show More Sessions \(\d+\)/i })).toBeInTheDocument();
  });

  it('in list-mode scope shows "Show More Sessions" from fallback universe before registry hydration', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([]);

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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    expect(await screen.findByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Beta' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show More Sessions \(\d+\)/i })).toBeInTheDocument();
  });

  it('show-more reveals remaining registry session chips in list-mode scope', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
    ]);
    const ensureLightSbtUniverse = jest.fn().mockResolvedValue(undefined);

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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
        ensureLightSbtUniverse={ensureLightSbtUniverse}
      />,
    );

    await openSessionSelector();
    fireEvent.click(await screen.findByRole('button', { name: /Show More Sessions \(\d+\)/i }));

    await waitFor(() => {
      expect(ensureLightSbtUniverse).toHaveBeenCalledWith(
        expect.arrayContaining(['beta']),
        expect.objectContaining({ force: true }),
      );
    });

    expect(await screen.findByRole('button', { name: 'Beta' })).toBeInTheDocument();
  });

  it('only shows list-mode chip sync progress for selected sessions', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
    ]);
    const ensureLightSbtDiscovery = jest.fn().mockResolvedValue(undefined);
    const ensureLightSbtUniverse = jest.fn().mockResolvedValue(undefined);

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
        embeddedMode
        ensureLightSbtDiscovery={ensureLightSbtDiscovery}
        ensureLightSbtUniverse={ensureLightSbtUniverse}
      />,
    );

    await waitFor(() => {
      expect(ensureLightSbtDiscovery).toHaveBeenCalledWith(
        'alpha',
        expect.objectContaining({ forceScopeSlug: 'alpha' }),
      );
    });

    await openSessionSelector();
    fireEvent.click(await screen.findByRole('button', { name: /Show More Sessions \(\d+\)/i }));

    await waitFor(() => {
      expect(ensureLightSbtUniverse).toHaveBeenCalledWith(
        expect.arrayContaining(['beta']),
        expect.objectContaining({ force: true }),
      );
    });

    const alphaChip = await screen.findByTestId('session-chip-alpha');
    const betaChip = await screen.findByTestId('session-chip-beta');

    expect(alphaChip).toHaveAttribute('data-session-selected', 'true');
    expect(betaChip).toHaveAttribute('data-session-selected', 'false');

    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-wrap-alpha')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('session-chip-progress-wrap-beta')).not.toBeInTheDocument();
  });

  it('selects configured list-mode slugs by default', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha', 'beta']);

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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    const alphaChip = await screen.findByTestId('session-chip-alpha');
    const betaChip = await screen.findByTestId('session-chip-beta');
    expect(alphaChip).toHaveAttribute('data-session-selected', 'true');
    expect(betaChip).toHaveAttribute('data-session-selected', 'true');
    expect(screen.getByTestId('session-chip-check-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('session-chip-check-beta')).toBeInTheDocument();
  });

  it('restores stored list-mode selection across reloads', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
    ]);
    localStorage.setItem('dg:sbtListModeSelectedSessions', JSON.stringify(['beta']));

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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    const alphaChip = await screen.findByTestId('session-chip-alpha');
    const betaChip = await screen.findByTestId('session-chip-beta');
    expect(alphaChip).toHaveAttribute('data-session-selected', 'false');
    expect(betaChip).toHaveAttribute('data-session-selected', 'true');
    expect(screen.queryByTestId('session-chip-check-alpha')).not.toBeInTheDocument();
    expect(screen.getByTestId('session-chip-check-beta')).toBeInTheDocument();
  });

  it('opens session chip external links in a new tab without toggling selection', async () => {
    mockReadSessionScanScope.mockReturnValue('all');
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    const alphaChip = await screen.findByTestId('session-chip-alpha');
    const betaChip = await screen.findByTestId('session-chip-beta');
    expect(alphaChip).toHaveAttribute('data-session-selected', 'true');
    expect(betaChip).toHaveAttribute('data-session-selected', 'false');

    const alphaOpen = screen.getByTestId('session-chip-open-alpha');
    const betaOpen = screen.getByTestId('session-chip-open-beta');
    expect(alphaChip).toContainElement(alphaOpen);
    expect(betaChip).toContainElement(betaOpen);

    fireEvent.click(betaOpen);

    expect(openSpy).toHaveBeenCalledWith('/session/beta', '_blank', 'noopener,noreferrer');
    expect(alphaChip).toHaveAttribute('data-session-selected', 'true');
    expect(betaChip).toHaveAttribute('data-session-selected', 'false');
    openSpy.mockRestore();
  });

  it('keeps the general session chip link canonical as /session when no session id token exists', async () => {
    mockReadSessionScanScope.mockReturnValue('all');
    mockGetAllSessionEntries.mockReturnValue([
      ['general', { slug: '' }],
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['general', { slug: '' }],
      ['alpha', { slug: 'alpha' }],
    ]);
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    const generalChip = await screen.findByTestId('session-chip-general');
    expect(generalChip).toHaveTextContent('General');

    fireEvent.click(screen.getByTestId('session-chip-open-general'));

    expect(openSpy).toHaveBeenCalledWith('/session', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('uses demo-only session labels and route tokens for session chips when strict config is missing', async () => {
    mockReadSessionScanScope.mockReturnValue('all');
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
        sessionId: 'edge-demo-route',
      };
    });
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    const edgeChip = await screen.findByTestId('session-chip-edge');
    expect(edgeChip).toHaveTextContent('Edge 2025');

    fireEvent.click(screen.getByTestId('session-chip-open-edge'));

    expect(openSpy).toHaveBeenCalledWith('/session/edge-demo-route', '_blank', 'noopener,noreferrer');
    expect(mockGetDemoSessionConfigBySlug).toHaveBeenCalledWith('edge', { allowDemoFallback: true });
    openSpy.mockRestore();
  });

  it('keeps newly revealed list-mode sessions unselected until manually selected, then loads them', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
    ]);

    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const betaAddress = '0x00000000000000000000000000000000000000b1';
    const alphaCache = {
      84532: {
        sbtList: {
          [alphaAddress.toLowerCase()]: {
            sbtAddress: alphaAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'Alpha Selected Badge',
              description: 'belongs to alpha',
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
    const betaCache = {
      84532: {
        sbtList: {
          [betaAddress.toLowerCase()]: {
            sbtAddress: betaAddress,
            slug: 'beta',
            sbtInfo: {
              name: 'Beta Selected Badge',
              description: 'belongs to beta',
              sessionSlug: 'beta',
              mintingEndTime: 0,
            },
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1200,
          },
        },
        lastBlock: 1200,
      },
    };

    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') return alphaCache;
      if (normalized === 'beta') return betaCache;
      return { 84532: { sbtList: {}, lastBlock: 0 } };
    });

    const ensureLightSbtDiscovery = jest.fn().mockResolvedValue(undefined);

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
        embeddedMode
        ensureLightSbtDiscovery={ensureLightSbtDiscovery}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Selected Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Beta Selected Badge')).not.toBeInTheDocument();

    await openSessionSelector();
    fireEvent.click(await screen.findByRole('button', { name: /Show More Sessions \(\d+\)/i }));

    const betaChip = await screen.findByTestId('session-chip-beta');
    expect(betaChip).toHaveAttribute('data-session-selected', 'false');
    expect(screen.queryByTestId('session-chip-check-beta')).not.toBeInTheDocument();

    fireEvent.click(betaChip);

    await waitFor(() => {
      expect(screen.getByTestId('session-chip-beta')).toHaveAttribute('data-session-selected', 'true');
    });
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-check-beta')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(ensureLightSbtDiscovery).toHaveBeenCalledWith('beta', expect.objectContaining({ forceScopeSlug: 'beta' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Beta Selected Badge')).toBeInTheDocument();
    });
  });
});
