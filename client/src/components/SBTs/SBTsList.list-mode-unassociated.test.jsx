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

  it('adds a "No Session" chip when list-mode cache contains unassociated SBT metadata', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const unassignedAddress = '0x00000000000000000000000000000000000000a9';
    const alphaCache = {
      84532: {
        sbtList: {
          [unassignedAddress.toLowerCase()]: {
            sbtAddress: unassignedAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'Unassigned Badge',
              description: 'no session association',
              sessionSlug: '',
              sessionSlugExplicit: true,
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
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') return alphaCache;
      return { 84532: { sbtList: {}, lastBlock: 0 } };
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
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    const noSessionChip = await screen.findByTestId('session-chip-__no_session__');
    expect(noSessionChip).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No Session' })).toBeInTheDocument();
    expect(noSessionChip).toHaveAttribute('data-session-selected', 'false');
  });

  it('keeps unassociated SBTs accessible through No Session selection without querying synthetic slug', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const unassignedAddress = '0x00000000000000000000000000000000000000a9';
    const alphaCache = {
      84532: {
        sbtList: {
          [alphaAddress.toLowerCase()]: {
            sbtAddress: alphaAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'Alpha Scoped Badge',
              description: 'belongs to alpha',
              sessionSlug: 'alpha',
              sessionSlugExplicit: true,
              mintingEndTime: 0,
            },
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1100,
          },
          [unassignedAddress.toLowerCase()]: {
            sbtAddress: unassignedAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'Unassigned Badge',
              description: 'no session association',
              sessionSlug: '',
              sessionSlugExplicit: true,
              mintingEndTime: 0,
            },
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1101,
          },
        },
        lastBlock: 1101,
      },
    };
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') return alphaCache;
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
      expect(screen.getByText('Alpha Scoped Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Unassigned Badge')).not.toBeInTheDocument();

    await openSessionSelector();
    const noSessionChip = await screen.findByTestId('session-chip-__no_session__');
    fireEvent.click(noSessionChip);

    const alphaChip = await screen.findByTestId('session-chip-alpha');
    fireEvent.click(alphaChip);

    await waitFor(() => {
      expect(screen.getByText('Unassigned Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alpha Scoped Badge')).not.toBeInTheDocument();

    const calledSlugs = ensureLightSbtDiscovery.mock.calls.map(([slug]) => String(slug || ''));
    expect(calledSlugs).not.toContain('__no_session__');
  });

  it('routes list-mode cards with missing sessionSlug metadata into No Session', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const alphaAddress = '0x00000000000000000000000000000000000000b1';
    const noSessionAddress = '0x00000000000000000000000000000000000000b9';
    const alphaCache = {
      84532: {
        sbtList: {
          [alphaAddress.toLowerCase()]: {
            sbtAddress: alphaAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'Alpha Explicit Badge',
              description: 'belongs to alpha',
              sessionSlug: 'alpha',
              sessionSlugExplicit: true,
              mintingEndTime: 0,
            },
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1100,
          },
          [noSessionAddress.toLowerCase()]: {
            sbtAddress: noSessionAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'No Session Missing Slug Badge',
              description: 'sessionSlug field missing should map to no-session',
              mintingEndTime: 0,
            },
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1101,
          },
        },
        lastBlock: 1101,
      },
    };
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') return alphaCache;
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
      expect(screen.getByText('Alpha Explicit Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('No Session Missing Slug Badge')).not.toBeInTheDocument();

    await openSessionSelector();
    const noSessionChip = await screen.findByTestId('session-chip-__no_session__');
    fireEvent.click(noSessionChip);

    const alphaChip = await screen.findByTestId('session-chip-alpha');
    fireEvent.click(alphaChip);

    await waitFor(() => {
      expect(screen.getByText('No Session Missing Slug Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alpha Explicit Badge')).not.toBeInTheDocument();

    const calledSlugs = ensureLightSbtDiscovery.mock.calls.map(([slug]) => String(slug || ''));
    expect(calledSlugs).not.toContain('__no_session__');
  });

  it('keeps selected list-mode cards visible during revision refresh even if the next cache read is empty', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);
    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');

    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const liveCache = {
      84532: {
        sbtList: {
          [alphaAddress.toLowerCase()]: {
            sbtAddress: alphaAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'Alpha Sticky Badge',
              description: 'stays visible during refresh',
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
    const emptyCache = {
      84532: {
        sbtList: {},
        lastBlock: 1100,
      },
    };

    let alphaReadCount = 0;
    let resolveSecondRead;
    const secondRead = new Promise((resolve) => {
      resolveSecondRead = resolve;
    });

    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized !== 'alpha') return { 84532: { sbtList: {}, lastBlock: 0 } };
      alphaReadCount += 1;
      if (alphaReadCount === 1) return liveCache;
      return secondRead;
    });

    const { rerender } = render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug=""
        loginComplete
        miniaturized={false}
        embeddedMode
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
      expect(screen.getByText('Alpha Sticky Badge')).toBeInTheDocument();
    });

    rerender(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug=""
        loginComplete
        miniaturized={false}
        embeddedMode
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={1}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();
      expect(screen.getByText('Alpha Sticky Badge')).toBeInTheDocument();
      expect(screen.queryByText('No live groups.')).not.toBeInTheDocument();
    });

    await act(async () => {
      resolveSecondRead(emptyCache);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Alpha Sticky Badge')).toBeInTheDocument();
      expect(screen.queryByText('No live groups.')).not.toBeInTheDocument();
    });
  });
});
