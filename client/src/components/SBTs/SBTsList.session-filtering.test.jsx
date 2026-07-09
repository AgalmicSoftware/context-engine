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
  mockListNamespaceEntriesSync,
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

  it('shows only SBTs associated with the highlighted sessionSlug in all-sessions mode', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const betaAddress = '0x00000000000000000000000000000000000000b1';
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized !== 'alpha') {
        return { 84532: { sbtList: {}, lastBlock: 0 } };
      }
      return {
        84532: {
          sbtList: {
            [alphaAddress.toLowerCase()]: {
              sbtAddress: alphaAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Session Badge',
                description: 'belongs to alpha',
                sessionSlug: 'alpha',
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [betaAddress.toLowerCase()]: {
              sbtAddress: betaAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Beta Session Badge',
                description: 'belongs to beta',
                sessionSlug: 'beta',
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
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Session Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Beta Session Badge')).not.toBeInTheDocument();
  });

  it('falls back to cached entry slug when sessionSlug is inferred (not explicit)', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized !== 'alpha') {
        return { 84532: { sbtList: {}, lastBlock: 0 } };
      }
      return {
        84532: {
          sbtList: {
            [alphaAddress.toLowerCase()]: {
              sbtAddress: alphaAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Inferred SessionSlug Badge',
                description: 'should remain in alpha list',
                sessionSlug: 'beta',
                sessionSlugExplicit: false,
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
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Inferred SessionSlug Badge')).toBeInTheDocument();
    });
  });

  it('filters concrete session lists to authoritative or supported legacy metadata bindings only', async () => {
    const explicitAddress = '0x00000000000000000000000000000000000000a1';
    const legacySlugAddress = '0x00000000000000000000000000000000000000a2';
    const legacyNameAddress = '0x00000000000000000000000000000000000000a3';
    const legacyTopLevelGroupSlugAddress = '0x00000000000000000000000000000000000000a4';
    const inferredAddress = '0x00000000000000000000000000000000000000a5';
    const bucketOnlyAddress = '0x00000000000000000000000000000000000000a6';
    const inferredNameAddress = '0x00000000000000000000000000000000000000a7';

    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized !== 'alpha') {
        return { 84532: { sbtList: {}, lastBlock: 0 } };
      }
      return {
        84532: {
          sbtList: {
            [explicitAddress.toLowerCase()]: {
              sbtAddress: explicitAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Explicit Badge',
                description: 'authoritative metadata session slug should stay visible',
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [legacySlugAddress.toLowerCase()]: {
              sbtAddress: legacySlugAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Legacy Slug Badge',
                description: 'legacy metadata slug should stay visible',
                slug: 'alpha',
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [legacyNameAddress.toLowerCase()]: {
              sbtAddress: legacyNameAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Legacy Name Badge',
                description: 'legacy sessionName mapping should stay visible',
                sessionName: 'Alpha',
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [legacyTopLevelGroupSlugAddress.toLowerCase()]: {
              sbtAddress: legacyTopLevelGroupSlugAddress,
              slug: 'beta',
              sessionSlug: 'alpha',
              sbtInfo: {
                name: 'Alpha Top-Level SessionSlug Badge',
                description: 'top-level sessionSlug should stay visible',
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [inferredAddress.toLowerCase()]: {
              sbtAddress: inferredAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Inferred Badge',
                description: 'inferred session slug should not keep this in alpha',
                sessionSlug: 'alpha',
                sessionSlugExplicit: false,
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [bucketOnlyAddress.toLowerCase()]: {
              sbtAddress: bucketOnlyAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Bucket Only Badge',
                description: 'bucket slug alone should not keep this in alpha',
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [inferredNameAddress.toLowerCase()]: {
              sbtAddress: inferredNameAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Inferred Name Badge',
                description: 'sessionName-only fallback should not keep this in alpha',
                sessionSlug: 'alpha',
                sessionSlugExplicit: false,
                sessionName: 'Alpha',
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
    });

    render(
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
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Explicit Badge')).toBeInTheDocument();
    });
    expect(screen.getByText('Alpha Legacy Slug Badge')).toBeInTheDocument();
    expect(screen.getByText('Alpha Legacy Name Badge')).toBeInTheDocument();
    expect(screen.getByText('Alpha Top-Level SessionSlug Badge')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Inferred Badge')).not.toBeInTheDocument();
    expect(screen.queryByText('Alpha Bucket Only Badge')).not.toBeInTheDocument();
    expect(screen.queryByText('Alpha Inferred Name Badge')).not.toBeInTheDocument();
  });

  it('merges concrete-session slug matches from other known cache buckets', async () => {
    const linkedAddress = '0x00000000000000000000000000000000000000c1';
    const otherAddress = '0x00000000000000000000000000000000000000c2';

    mockReadCache.mockResolvedValue({
      84532: {
        sbtList: {},
        lastBlock: 1100,
      },
    });
    mockListNamespaceEntriesSync.mockReturnValue([
      {
        namespace: 'sbtCache',
        slug: 'archive',
        key: 'dg:sbtCache:archive',
        value: {
          84532: {
            sbtList: {
              [linkedAddress.toLowerCase()]: {
                sbtAddress: linkedAddress,
                slug: 'archive',
                sbtInfo: {
                  name: 'Archive Alpha Explicit Badge',
                  description: 'linked from archive but authoritatively belongs to alpha',
                  sessionSlug: 'alpha',
                  sessionSlugExplicit: true,
                  mintingEndTime: 0,
                },
                mintedAddresses: [],
                burnedAddresses: [],
                countsLoaded: true,
                blockNumber: 1100,
              },
              [otherAddress.toLowerCase()]: {
                sbtAddress: otherAddress,
                slug: 'archive',
                sbtInfo: {
                  name: 'Archive Beta Explicit Badge',
                  description: 'should not appear in alpha',
                  sessionSlug: 'beta',
                  sessionSlugExplicit: true,
                  mintingEndTime: 0,
                },
                mintedAddresses: [],
                burnedAddresses: [],
                countsLoaded: true,
                blockNumber: 1100,
              },
            },
          },
        },
      },
    ]);

    render(
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
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Archive Alpha Explicit Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Archive Beta Explicit Badge')).not.toBeInTheDocument();
  });
});
