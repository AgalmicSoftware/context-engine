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

const flushSbtListEffects = async (cycles = 4) => {
  await act(async () => {
    for (let i = 0; i < cycles; i += 1) {
      await Promise.resolve();
    }
  });
};

describe('SBTsList list-mode routing and filtering', () => {
  beforeEach(resetSBTsListListModeTestState);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(restoreSBTsListSyncBarStep);

  it('retries cold-load live-session fetches when registry hydration later supplies the chain config', async () => {
    const liveDemoAddress = '0x00000000000000000000000000000000000000c9';
    let demoRegistryReady = false;

    mockGetSessionChainId.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'demo') return demoRegistryReady ? 84532 : null;
      return 84532;
    });
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'demo') {
        return demoRegistryReady
          ? {
              slug: 'demo',
              sessionName: 'Demo',
              networkChainId: 84532,
              blockLimits: { start: 1 },
              corsWorkerUrl: 'https://worker.example',
            }
          : null;
      }
      return {
        sessionName: normalized || 'General',
        blockLimits: { start: 1 },
        corsWorkerUrl: 'https://worker.example',
      };
    });
    mockGetDemoSessionConfigBySlug.mockReturnValue(null);
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized !== 'demo') {
        return { 84532: { sbtList: {}, lastBlock: 0 } };
      }
      return {
        84532: {
          sbtList: {
            [liveDemoAddress.toLowerCase()]: {
              sbtAddress: liveDemoAddress,
              slug: 'demo',
              sbtInfo: {
                name: 'Live Demo Registry Badge',
                description: 'appears after the live session registry config lands',
                sessionSlug: 'demo',
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
    });

    render(
      <SBTsList
        provider="mock"
        network={{}}
        account=""
        sessionSlug="demo"
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

    expect(screen.queryByText('Live Demo Registry Badge')).not.toBeInTheDocument();

    await act(async () => {
      demoRegistryReady = true;
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Live Demo Registry Badge')).toBeInTheDocument();
    });
  });

  it('in list-mode does not keep bucket-only or inferred fallback cards under the selected session', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const explicitAddress = '0x00000000000000000000000000000000000000b1';
    const legacySlugAddress = '0x00000000000000000000000000000000000000b2';
    const legacyTopLevelGroupSlugAddress = '0x00000000000000000000000000000000000000b3';
    const inferredAddress = '0x00000000000000000000000000000000000000b4';
    const bucketOnlyAddress = '0x00000000000000000000000000000000000000b5';
    const inferredNameAddress = '0x00000000000000000000000000000000000000b6';

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
                name: 'List Alpha Explicit Badge',
                description: 'authoritative alpha card should stay selected',
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
                name: 'List Alpha Legacy Slug Badge',
                description: 'legacy metadata slug should stay selected',
                slug: 'alpha',
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
                name: 'List Alpha Top-Level SessionSlug Badge',
                description: 'top-level sessionSlug should stay selected',
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
                name: 'List Alpha Inferred Badge',
                description: 'inferred alpha metadata should move out of alpha',
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
                name: 'List Alpha Bucket Only Badge',
                description: 'bucket slug alone should not stay selected',
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
                name: 'List Alpha Inferred Name Badge',
                description: 'sessionName-only fallback should not stay selected',
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

    await flushSbtListEffects();
    await waitFor(() => {
      expect(screen.getByText('List Alpha Explicit Badge')).toBeInTheDocument();
    });
    expect(screen.getByText('List Alpha Legacy Slug Badge')).toBeInTheDocument();
    expect(screen.getByText('List Alpha Top-Level SessionSlug Badge')).toBeInTheDocument();
    expect(screen.queryByText('List Alpha Inferred Badge')).not.toBeInTheDocument();
    expect(screen.queryByText('List Alpha Bucket Only Badge')).not.toBeInTheDocument();
    expect(screen.queryByText('List Alpha Inferred Name Badge')).not.toBeInTheDocument();
  });

  it('in list-mode includes linked SBTs from other cache buckets when their binding slug is selected', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const linkedAddress = '0x00000000000000000000000000000000000000d1';
    const otherAddress = '0x00000000000000000000000000000000000000d2';

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
                  name: 'List Linked Alpha Badge',
                  description: 'selected alpha binding should stay visible',
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
                  name: 'List Linked Beta Badge',
                  description: 'unselected beta binding should stay hidden',
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

    await flushSbtListEffects();
    await waitFor(() => {
      expect(screen.getByText('List Linked Alpha Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('List Linked Beta Badge')).not.toBeInTheDocument();
  });

  it('in list-mode routes cards by authoritative metadata sessionSlug when source slug conflicts', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const alphaKeepAddress = '0x00000000000000000000000000000000000000a2';
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
            [alphaKeepAddress.toLowerCase()]: {
              sbtAddress: alphaKeepAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Keep Badge',
                description: 'authoritative alpha card should stay visible',
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [alphaAddress.toLowerCase()]: {
              sbtAddress: alphaAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Source-Slug Badge',
                description: 'metadata slug mismatch should move this card out of alpha',
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

    await flushSbtListEffects();
    await waitFor(() => {
      expect(screen.getByText('Alpha Keep Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alpha Source-Slug Badge')).not.toBeInTheDocument();
  });

  it('in list-mode only shows cards whose authoritative metadata sessionSlug is selected', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
      ['gamma', { slug: 'gamma' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
      ['beta', { slug: 'beta' }],
      ['gamma', { slug: 'gamma' }],
    ]);

    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const betaAddress = '0x00000000000000000000000000000000000000b1';
    const gammaAddress = '0x00000000000000000000000000000000000000c1';

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
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
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
                sessionSlug: 'beta',
                sessionSlugExplicit: true,
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [gammaAddress.toLowerCase()]: {
              sbtAddress: gammaAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Gamma Session Badge',
                sessionSlug: 'gamma',
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

    await flushSbtListEffects();
    await waitFor(() => {
      expect(screen.getByText('Alpha Session Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Beta Session Badge')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma Session Badge')).not.toBeInTheDocument();
  });
});
