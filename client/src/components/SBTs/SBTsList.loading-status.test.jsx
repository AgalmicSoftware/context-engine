import {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  SBTsList,
  writeGlobalSessionSelection,
  sbtsListPath,
  mockGetRelevantBlockWindowForFilter,
  mockGetAllSessionEntries,
  mockGetSessionChainId,
  mockSessionRegistryGetAllSessionEntries,
  mockReadSessionScanScope,
  mockReadSessionScanSlugs,
  mockPeekCacheSync,
  mockReadCache,
  openSessionSelector,
  buildSBTsListProps,
  renderSBTsList,
  setupSBTsListLoadingStatusTestLifecycle,
} from './SBTsList.loadingStatus.testUtils';

describe('SBTsList selector and initial loading status', () => {
  setupSBTsListLoadingStatusTestLifecycle();

  it('inherits the global primary session for the all-sessions selector when there is no local override', async () => {
    localStorage.removeItem('dg:lastActiveSbtSession');
    localStorage.setItem('ce:primarySessionSlug', 'beta');

    renderSBTsList();

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-beta')).toHaveAttribute('data-session-selected', 'true');
    });
    expect(screen.getByTestId('session-chip-alpha')).toHaveAttribute('data-session-selected', 'false');
  });

  it('returns the all-sessions selector to General when the global primary resets there', async () => {
    localStorage.removeItem('dg:lastActiveSbtSession');
    mockGetAllSessionEntries.mockReturnValue([
      ['general', { slug: '' }],
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['general', { slug: '' }],
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
    ]);
    localStorage.setItem('ce:primarySessionSlug', 'beta');

    renderSBTsList();

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-beta')).toHaveAttribute('data-session-selected', 'true');
    });

    await act(async () => {
      writeGlobalSessionSelection({
        primarySessionSlug: '',
        selectedSessionScope: 'all',
        selectedSessionSlugs: [],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-chip-general')).toHaveAttribute('data-session-selected', 'true');
    });
    expect(screen.getByTestId('session-chip-beta')).toHaveAttribute('data-session-selected', 'false');
  });

  it('renders locked-name cards as [encrypted] instead of placeholder contract names', async () => {
    const liveCache = {
      '84532': {
        sbtList: {
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': {
            sbtAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            sbtInfo: {
              name: '',
              contractName: 'CE-SBT-12',
              nameLocked: true,
              description: '',
              descriptionLocked: true,
              image: 'https://example.com/locked.png',
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
              sessionSlug: 'alpha',
            },
            mintedAddresses: ['0x00000000000000000000000000000000000000b1'],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1100,
          },
        },
        lastBlock: 1100,
      },
    };

    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return liveCache;
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return liveCache;
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });

    renderSBTsList();

    await waitFor(() => {
      expect(screen.getAllByText('[encrypted]').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText('CE-SBT-12')).not.toBeInTheDocument();
  });

  it('keeps all-groups shell visible while multi-session discovery is still loading', async () => {
    let resolveReadCache;
    const pendingReadCache = new Promise((resolve) => {
      resolveReadCache = resolve;
    });
    mockReadCache.mockImplementation(() => pendingReadCache);

    const ensureLightSbtDiscovery = jest.fn();

    renderSBTsList({
      isSBTCacheReady: false,
      ensureLightSbtDiscovery,
    });

    await waitFor(() => {
      expect(ensureLightSbtDiscovery).toHaveBeenCalledWith(
        'alpha',
        expect.objectContaining({ forceScopeSlug: 'alpha' })
      );
    });

    await waitFor(() => {
      const calledSlugs = mockGetRelevantBlockWindowForFilter.mock.calls.map(([arg]) => (
        arg && typeof arg === 'object' ? arg.slug : arg
      ));
      expect(calledSlugs).toEqual(expect.arrayContaining(['alpha', 'beta']));
    });

    await waitFor(() => {
      expect(screen.getByText(/^Sessions$/i)).toBeInTheDocument();
    });

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument();
    });

    expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('section-spinner-featured')).toBeInTheDocument();
    expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();
    expect(screen.getByTestId('section-spinner-expired')).toBeInTheDocument();

    await act(async () => {
      resolveReadCache({
        '84532': {
          sbtList: {},
          lastBlock: 0,
        },
      });
      await Promise.resolve();
    });
  });

  it('treats the terminology-aware all-groups route as an alias', async () => {
    const previousUrl = window.location.pathname || '/';
    window.history.replaceState({}, '', sbtsListPath());

    try {
      renderSBTsList({
        allSessionsMode: undefined,
        isSBTCacheReady: false,
      });

      await waitFor(() => {
        expect(screen.getByText(/^Sessions$/i)).toBeInTheDocument();
      });

      await openSessionSelector();
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();

      expect(screen.getByText(/Collecting Live/i)).toBeInTheDocument();
    } finally {
      window.history.replaceState({}, '', previousUrl);
    }
  });

  it('exits initial loader when all-groups mode has no configured slugs', async () => {
    localStorage.clear();
    mockGetAllSessionEntries.mockReturnValue([]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([]);
    mockGetSessionChainId.mockImplementation((slug) => (String(slug || '').trim() ? 84532 : null));

    const ensureLightSbtDiscovery = jest.fn();

    renderSBTsList({
      isSBTCacheReady: false,
      ensureLightSbtDiscovery,
    });

    await waitFor(() => {
      expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Collecting Live/i)).toBeInTheDocument();
    expect(screen.queryByText(/Loading latest block/i)).not.toBeInTheDocument();
    expect(mockGetRelevantBlockWindowForFilter).not.toHaveBeenCalled();
    expect(ensureLightSbtDiscovery).not.toHaveBeenCalled();
  });

  it('exits initial loader when list-scope has no selectable slugs and registry is pending', async () => {
    localStorage.clear();
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue([]);
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([]);
    mockGetSessionChainId.mockImplementation((slug) => (String(slug || '').trim() ? 84532 : null));

    const ensureLightSbtDiscovery = jest.fn();

    renderSBTsList({
      isSBTCacheReady: false,
      ensureLightSbtDiscovery,
    });

    await waitFor(() => {
      expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/^Sessions$/i)).toBeInTheDocument();
    expect(screen.queryByText(/Loading latest block/i)).not.toBeInTheDocument();
    expect(mockGetRelevantBlockWindowForFilter).not.toHaveBeenCalled();
    expect(ensureLightSbtDiscovery).not.toHaveBeenCalled();
  });

  it('releases global loading after list-scope early exit so cached follow-up renders keep refresh enabled', async () => {
    localStorage.clear();
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue([]);
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([]);

    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const liveCache = {
      '84532': {
        sbtList: {
          [alphaAddress.toLowerCase()]: {
            sbtAddress: alphaAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'Alpha Stable Badge',
              description: 'cached follow-up render',
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return liveCache;
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return liveCache;
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });

    const ensureLightSbtDiscovery = jest.fn();
    const { unmount } = renderSBTsList({
      isSBTCacheReady: false,
      ensureLightSbtDiscovery,
    });

    await waitFor(() => {
      expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();
    });

    mockReadSessionScanSlugs.mockReturnValue(['alpha']);
    unmount();

    renderSBTsList({
      sbtCacheRevision: 1,
      ensureLightSbtDiscovery,
    });

    await waitFor(() => {
      expect(screen.getByText('Alpha Stable Badge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Group list settings/i }));
    expect(screen.getByRole('button', { name: /Refresh/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Clear Cache/i })).not.toBeDisabled();
  });

  it('filters session-id style private entries from all-groups slug discovery', async () => {
    const privateSessionIdSlug = '6cbb4a26-43f0-4478-ac5f-2e8703f8f3fb';
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['private', { slug: privateSessionIdSlug }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['private', { slug: privateSessionIdSlug }],
    ]);
    localStorage.setItem('dg:sbt:fullScanInProgress:alpha', 'true');
    localStorage.setItem(`dg:sbt:fullScanInProgress:${privateSessionIdSlug}`, 'true');

    let resolveReadCache;
    const pendingReadCache = new Promise((resolve) => {
      resolveReadCache = resolve;
    });
    mockReadCache.mockImplementation(() => pendingReadCache);

    const ensureLightSbtDiscovery = jest.fn();

    renderSBTsList({
      isSBTCacheReady: false,
      ensureLightSbtDiscovery,
    });

    await waitFor(() => {
      const calledSlugs = mockGetRelevantBlockWindowForFilter.mock.calls.map(([arg]) => (
        arg && typeof arg === 'object' ? arg.slug : arg
      ));
      expect(calledSlugs).toEqual(expect.arrayContaining(['alpha']));
    });

    const calledSlugs = mockGetRelevantBlockWindowForFilter.mock.calls.map(([arg]) => (
      arg && typeof arg === 'object' ? arg.slug : arg
    ));
    expect(calledSlugs).not.toContain(privateSessionIdSlug);
    expect(ensureLightSbtDiscovery).toHaveBeenCalledWith(
      'alpha',
      expect.objectContaining({ forceScopeSlug: 'alpha' })
    );

    await act(async () => {
      resolveReadCache({
        '84532': {
          sbtList: {},
          lastBlock: 0,
        },
      });
      await Promise.resolve();
    });
  });

  it('clears stale cards immediately when switching slug scope before next cache read resolves', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const betaAddress = '0x00000000000000000000000000000000000000b1';
    const buildCache = (address, name) => ({
      '84532': {
        sbtList: {
          [address.toLowerCase()]: {
            sbtAddress: address,
            sbtInfo: {
              name,
              description: `${name} description`,
              sessionSlug: name.startsWith('Alpha') ? 'alpha' : 'beta',
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
    });

    let resolveBetaRead;
    const pendingBetaRead = new Promise((resolve) => {
      resolveBetaRead = resolve;
    });
    mockReadCache.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return Promise.resolve(buildCache(alphaAddress, 'Alpha Badge'));
      if (normalized === 'beta') return pendingBetaRead;
      return Promise.resolve({ '84532': { sbtList: {}, lastBlock: 0 } });
    });

    const ensureLightSbtDiscovery = jest.fn();
    const { rerender } = renderSBTsList({
      sessionSlug: 'alpha',
      allSessionsMode: undefined,
      ensureLightSbtDiscovery,
    });

    await waitFor(() => {
      expect(screen.getByText('Alpha Badge')).toBeInTheDocument();
    });

    rerender(
      <SBTsList {...buildSBTsListProps({
        sessionSlug: 'beta',
        allSessionsMode: undefined,
        ensureLightSbtDiscovery,
      })}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Alpha Badge')).not.toBeInTheDocument();
    });

    await act(async () => {
      resolveBetaRead(buildCache(betaAddress, 'Beta Badge'));
      await Promise.resolve();
    });
  });
});
