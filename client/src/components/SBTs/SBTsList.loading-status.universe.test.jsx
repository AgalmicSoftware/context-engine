import {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  SBTsList,
  mockGetAllSessionEntries,
  mockSessionRegistryGetAllSessionEntries,
  mockReadSessionScanScope,
  mockReadSessionScanSlugs,
  mockCreateGroup,
  mockReadCache,
  openSessionSelector,
  renderSBTsList,
  setupSBTsListLoadingStatusTestLifecycle,
} from './SBTsList.loadingStatus.testUtils';

describe('SBTsList create group and session universe loading status', () => {
  setupSBTsListLoadingStatusTestLifecycle();

  it('shows create-group control above universe selector in embedded all-groups mode', async () => {
    renderSBTsList({
      isSBTCacheReady: false,
      embeddedMode: true,
    });

    await waitFor(() => {
      expect(screen.getByText(/^Sessions$/i)).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /Create Group/i });
    const universeLabel = screen.getByText(/^Sessions$/i);
    const position = createButton.compareDocumentPosition(universeLabel);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders create-group panel above universe when expanded in embedded all-groups mode', async () => {
    renderSBTsList({
      isSBTCacheReady: false,
      embeddedMode: true,
    });

    fireEvent.click(await screen.findByRole('button', { name: /Create Group/i }));

    const panel = await screen.findByTestId('create-group-panel');
    const universeLabel = screen.getByText(/^Sessions$/i);
    const position = panel.compareDocumentPosition(universeLabel);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not auto-expand create group from a name-only cached draft', async () => {
    sessionStorage.setItem('createSbtFormCache', JSON.stringify({ sbtName: 'Alpha' }));

    renderSBTsList({
      isSBTCacheReady: false,
      embeddedMode: true,
    });

    await screen.findByRole('button', { name: /Create Group/i });

    expect(screen.queryByRole('button', { name: /Exit Group Creation/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('create-group-panel')).not.toBeInTheDocument();
  });

  it('auto-expands create group from a cached draft with name and additional data', async () => {
    sessionStorage.setItem(
      'createSbtFormCache',
      JSON.stringify({
        sbtName: 'Alpha',
        sbtDescription: 'Cached draft details',
      }),
    );

    renderSBTsList({
      isSBTCacheReady: false,
      embeddedMode: true,
    });

    await screen.findByRole('button', { name: /Exit Group Creation/i });
    expect(await screen.findByTestId('create-group-panel')).toBeInTheDocument();
  });

  it('passes the selected-session lock gate sources only to the embedded SBTsList create panel in list scope mode', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha', 'beta']);

    renderSBTsList({
      isSBTCacheReady: false,
      embeddedMode: true,
    });

    fireEvent.click(await screen.findByRole('button', { name: /Create Group/i }));
    await screen.findByTestId('create-group-panel');

    await waitFor(() => {
      const latestProps = mockCreateGroup.mock.calls[mockCreateGroup.mock.calls.length - 1]?.[0];
      expect(latestProps).toEqual(
        expect.objectContaining({
          sessionSlug: 'alpha',
          lockGatePreferredSessionSlug: 'alpha',
        }),
      );
      expect(latestProps.lockGateSessionSources).toEqual([
        expect.objectContaining({
          sessionSlug: 'alpha',
          sessionConfig: expect.objectContaining({ sessionName: 'Alpha' }),
        }),
        expect.objectContaining({
          sessionSlug: 'beta',
          sessionConfig: expect.objectContaining({ sessionName: 'Beta' }),
        }),
      ]);
    });
  });

  it('keeps fallback slugs visible while on-chain registry entries are still pending', async () => {
    mockGetAllSessionEntries.mockReturnValue([
      ['fallback1', { slug: 'alpha' }],
      ['fallback2', { slug: 'beta' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([]);

    renderSBTsList({
      isSBTCacheReady: false,
      embeddedMode: true,
    });

    expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Sessions$/i)).toBeInTheDocument();
    expect(screen.getByTestId('session-universe-spinner')).toBeInTheDocument();
    await openSessionSelector();
    expect(screen.getByRole('button', { name: /alpha/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /beta/i })).toBeInTheDocument();
  });

  it('hides baseline demo placeholders from fallback universe chips when SHOW_DEMO_SESSIONS is disabled', async () => {
    mockGetAllSessionEntries.mockReturnValue([
      ['general', { slug: '' }],
      ['legacyReading', { slug: 'reading-group' }],
      ['rxc', { slug: 'rxc' }],
      ['legacyEdge', { slug: 'legacy-edge' }],
      ['test', { slug: 'test' }],
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([]);

    renderSBTsList({
      isSBTCacheReady: false,
      embeddedMode: true,
    });

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'General' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /reading group/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /weyl v\. yarvin debate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /legacy edge/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^test$/i })).not.toBeInTheDocument();
  });

  it('keeps custom demo sessions while hiding baseline fallback defaults once registry is populated', async () => {
    mockGetAllSessionEntries.mockReturnValue([
      ['fallback1', { slug: 'context-engine' }],
      ['fallback2', { slug: 'reading-group' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
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
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /custom universe session/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /context-engine/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reading-group/i })).not.toBeInTheDocument();
  });

  it('refreshes session universe chips when available slugs change after mount', async () => {
    let dynamicRegistryEntries = [
      ['fallback1', { slug: 'context-engine' }],
      ['fallback2', { slug: 'reading-group' }],
    ];
    mockSessionRegistryGetAllSessionEntries.mockImplementation(() => dynamicRegistryEntries);

    const { rerender } = render(
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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /context-engine/i })).toBeInTheDocument();
    });

    dynamicRegistryEntries = [
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
    ];

    rerender(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug=""
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={1}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /context-engine/i })).not.toBeInTheDocument();
  });

  it('shows session universe promptly (without big loader) while cache readiness is still pending', async () => {
    let resolveReadCache;
    const pendingReadCache = new Promise((resolve) => {
      resolveReadCache = resolve;
    });
    mockReadCache.mockImplementation(() => pendingReadCache);

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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/^Sessions$/i)).toBeInTheDocument();
    });

    await openSessionSelector();
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();

    expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('session-universe-spinner')).toBeInTheDocument();

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
});
