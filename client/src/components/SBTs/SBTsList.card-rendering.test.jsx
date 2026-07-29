import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SBTsList from './SBTsList';
import { writeGlobalSessionSelection } from '../../utilities/session/globalSessionState.js';
import { upsertCachedSessionWorkerConfig } from '../../utilities/session/sessionWorkerConfigCache.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { sbtsListPath } from '../../utilities/ui/terminology.js';

var mockGetRelevantBlockWindowForFilter = jest.fn();
var mockGetGroupPasswordHash = jest.fn();
var mockGetAllSessionEntries = jest.fn();
var mockGetDemoSessionConfigBySlug = jest.fn();
var mockGetSessionChainId = jest.fn();
var mockGetSessionConfigBySlug = jest.fn();
var mockGetSessionLists = jest.fn();
var mockGetSessionSlugByName = jest.fn();
var mockNormalizeSessionSlug = jest.fn();
var mockSessionRegistryGetAllSessionEntries = jest.fn();
var mockSessionRegistryReadCache = jest.fn();
var mockReadSessionScanScope = jest.fn();
var mockReadSessionScanSlugs = jest.fn();
var mockCreateGroup = jest.fn();
var mockWorkerGroupCreate = jest.fn();
const mockSBTPage = jest.fn();
const mockTagModal = jest.fn();

var mockPeekCacheSync = jest.fn();
var mockReadCache = jest.fn();
var mockRemoveCache = jest.fn();
var mockWriteCache = jest.fn();
var mockListNamespaceEntriesSync = jest.fn();
const ORIGINAL_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP = globalThis.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP;

jest.mock('./SBTPage', () => (props) => {
  mockSBTPage(props);
  return (
    <div data-testid="mock-sbt-page">
      <button type="button" data-testid="mock-sbt-nested-button">
        Nested Action
      </button>
      <div role="button" tabIndex={0} data-testid="mock-sbt-ignore-nav" data-featured-card-ignore-nav="true">
        Nested Custom Action
      </div>
    </div>
  );
});
jest.mock('./CreateSBTGroup', () => {
  const React = require('react');
  return function MockCreateGroup(props) {
    mockCreateGroup(props);
    return React.createElement('div', { 'data-testid': 'create-group-panel' }, 'Create Group Panel');
  };
});
jest.mock('../OnePageSession/WorkerSessionGroupsPanel', () => (props) => {
  mockWorkerGroupCreate(props);
  return (
    <div data-testid="worker-group-create-panel">
      <span>Active session</span>
      <span>{props.sessionName}</span>
      <span>/{props.sessionSlug}</span>
    </div>
  );
});
jest.mock('../TagPage/TagModal', () => (props) => {
  mockTagModal(props);
  if (!props.isOpen) return null;
  return <div data-testid="mock-tag-modal">{props.activeTag}</div>;
});

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {
    getRelevantBlockWindowForFilter: (...args) => mockGetRelevantBlockWindowForFilter(...args),
    getGroupPasswordHash: (...args) => mockGetGroupPasswordHash(...args),
  },
  getAllSessionEntries: (...args) => mockGetAllSessionEntries(...args),
  getDemoSessionConfigBySlug: (...args) => mockGetDemoSessionConfigBySlug(...args),
  getSessionChainId: (...args) => mockGetSessionChainId(...args),
  getSessionConfigBySlug: (...args) => mockGetSessionConfigBySlug(...args),
  getSessionLists: (...args) => mockGetSessionLists(...args),
  getSessionSlugByName: (...args) => mockGetSessionSlugByName(...args),
  normalizeSessionSlug: (...args) => mockNormalizeSessionSlug(...args),
}));

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  listNamespaceEntriesSync: (...args) => mockListNamespaceEntriesSync(...args),
  peekCacheSync: (...args) => mockPeekCacheSync(...args),
  readCache: (...args) => mockReadCache(...args),
  removeCache: (...args) => mockRemoveCache(...args),
  writeCache: (...args) => mockWriteCache(...args),
}));

jest.mock('../../utilities/arweave/arweaveUrls.js', () => ({
  buildArweaveGatewayUrlCandidates: jest.fn((value = '') => [String(value || '').trim()]),
  normalizeArweaveUrl: jest.fn((value = '') => String(value || '').trim()),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  SESSION_REGISTRY_CACHE_UPDATED_EVENT: 'ce:session-registry-cache-updated',
  sessionRegistryStore: {
    getAllSessionEntries: (...args) => mockSessionRegistryGetAllSessionEntries(...args),
    readCache: (...args) => mockSessionRegistryReadCache(...args),
  },
}));

jest.mock('../../utilities/session/sessionScanScope.js', () => ({
  readSessionScanScope: (...args) => mockReadSessionScanScope(...args),
  readSessionScanSlugs: (...args) => mockReadSessionScanSlugs(...args),
}));

jest.mock('../../variables/demo/demo_sessions.json', () => ({
  general: { slug: '', sessionName: 'Context Engine' },
  legacyReading: { slug: 'reading-group', sessionName: 'Reading Group' },
  rxc: { slug: 'rxc', sessionName: 'Weyl v. Yarvin Debate' },
  legacyEdge: { slug: 'legacy-edge', sessionName: 'Legacy Edge' },
  test: { slug: 'test', sessionName: 'test' },
  customUniverseSession: { slug: 'custom-universe-session', sessionName: 'custom universe session' },
}));

jest.mock('../../utilities/session/sessionDemoCompat.js', () => {
  const actual = jest.requireActual('../../utilities/session/sessionDemoCompat.js');
  const demoSessionMap = {
    general: { slug: '', sessionName: 'Context Engine' },
    legacyReading: { slug: 'reading-group', sessionName: 'Reading Group' },
    rxc: { slug: 'rxc', sessionName: 'Weyl v. Yarvin Debate' },
    legacyEdge: { slug: 'legacy-edge', sessionName: 'Legacy Edge' },
    test: { slug: 'test', sessionName: 'test' },
    customUniverseSession: { slug: 'custom-universe-session', sessionName: 'custom universe session' },
  };
  return {
    ...actual,
    getDemoSessionMap: () => demoSessionMap,
    getBaselineDemoSessionSlugs: () => ['', 'reading-group', 'rxc', 'legacy-edge', 'test'],
    getBaselineDemoPlaceholderSlugs: () => ['reading-group', 'rxc', 'legacy-edge', 'test'],
  };
});

const setupGroupMocks = () => {
  mockNormalizeSessionSlug.mockImplementation((value = '') =>
    String(value || '')
      .trim()
      .toLowerCase(),
  );
  mockGetAllSessionEntries.mockReturnValue([
    ['alpha', { slug: 'alpha' }],
    ['beta', { slug: 'beta' }],
  ]);
  mockSessionRegistryGetAllSessionEntries.mockReturnValue([
    ['alpha', { slug: 'alpha' }],
    ['beta', { slug: 'beta' }],
  ]);
  mockSessionRegistryReadCache.mockImplementation(() => {
    const entries = mockSessionRegistryGetAllSessionEntries();
    if (!Array.isArray(entries) || entries.length <= 0) return null;
    const sessions = Object.fromEntries(entries);
    return {
      sessions,
      groups: sessions,
      sessionsById: {},
    };
  });
  mockGetSessionChainId.mockReturnValue(84532);
  mockGetSessionLists.mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
  mockReadSessionScanScope.mockReturnValue('all');
  mockReadSessionScanSlugs.mockReturnValue([]);
  mockGetSessionSlugByName.mockImplementation((sessionName) => {
    const normalized = String(sessionName || '')
      .trim()
      .toLowerCase();
    if (normalized === 'alpha') return 'alpha';
    if (normalized === 'beta') return 'beta';
    if (normalized === 'general' || normalized === 'context engine') return '';
    return '';
  });
  mockGetDemoSessionConfigBySlug.mockImplementation((slug) => {
    const normalized = String(slug || '')
      .trim()
      .toLowerCase();
    if (normalized === 'edge') {
      return {
        slug: 'edge',
        sessionName: 'Edge 2025',
      };
    }
    return null;
  });
  mockGetSessionConfigBySlug.mockImplementation((slug) => {
    const normalized = String(slug || '')
      .trim()
      .toLowerCase();
    if (normalized === 'alpha') {
      return {
        sessionName: 'Alpha',
        blockLimits: { start: 1000 },
        corsWorkerUrl: 'https://worker.example',
      };
    }
    if (normalized === 'beta') {
      return {
        sessionName: 'Beta',
        blockLimits: { start: 2000 },
        corsWorkerUrl: 'https://worker.example',
      };
    }
    if (normalized === 'custom-universe-session') {
      return {
        sessionName: 'custom universe session',
        blockLimits: { start: 3000 },
        corsWorkerUrl: 'https://worker.example',
      };
    }
    return {
      sessionName: normalized || 'General',
      blockLimits: { start: 1 },
      corsWorkerUrl: 'https://worker.example',
    };
  });
  mockPeekCacheSync.mockImplementation((_namespace, slug) => {
    const normalized = String(slug || '')
      .trim()
      .toLowerCase();
    if (normalized === 'alpha') {
      return {
        84532: { lastBlock: 1050, sbtList: {} },
      };
    }
    if (normalized === 'beta') {
      return {
        84532: { lastBlock: 2060, sbtList: {} },
      };
    }
    return {
      84532: { lastBlock: 0, sbtList: {} },
    };
  });
  mockReadCache.mockResolvedValue({
    84532: {
      sbtList: {},
      lastBlock: 0,
    },
  });
  mockListNamespaceEntriesSync.mockReturnValue([]);
  mockGetRelevantBlockWindowForFilter.mockImplementation(async (slugInput) => {
    const normalized = String(slugInput && typeof slugInput === 'object' ? slugInput.slug || '' : slugInput || '')
      .trim()
      .toLowerCase();
    if (normalized === 'alpha') return { fromBlock: 1000, toBlock: 1100 };
    if (normalized === 'beta') return { fromBlock: 2000, toBlock: 2200 };
    return { fromBlock: 1, toBlock: 1 };
  });
};

const SESSION_SELECTOR_PANEL_TEST_ID = 'session-selector-panel';
const SESSION_SELECTOR_TOGGLE_TEST_ID = 'session-selector-toggle';

const openSessionSelector = async () => {
  if (screen.queryByTestId(SESSION_SELECTOR_PANEL_TEST_ID)) {
    return screen.getByTestId(SESSION_SELECTOR_PANEL_TEST_ID);
  }

  const settingsButton = screen.queryByRole('button', { name: /Group list settings/i });
  if (settingsButton) {
    fireEvent.click(settingsButton);
  } else {
    fireEvent.click(await screen.findByTestId(SESSION_SELECTOR_TOGGLE_TEST_ID));
  }

  return screen.findByTestId(SESSION_SELECTOR_PANEL_TEST_ID);
};

describe('SBTsList card rendering and navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateGroup.mockReset();
    setupGroupMocks();
    globalThis.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP = 50;
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('dg:lastActiveSbtGroup', 'alpha');
    localStorage.setItem('dg:sbt:fullScanInProgress:alpha', 'true');
    localStorage.setItem('dg:sbt:fullScanInProgress:beta', 'true');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (typeof ORIGINAL_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP === 'undefined') {
      try {
        delete globalThis.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP;
      } catch (_) {}
    } else {
      globalThis.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP = ORIGINAL_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP;
    }
  });
  it('opens the terminology-aware detail route when a featured card in SBTsList is clicked', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [alphaAddress],
      ignored_SBTs_LIST: [],
    });
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
                name: 'Alpha Featured Badge',
                description: 'featured card',
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
    });
    const onNavigateToSbt = jest.fn();

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
        onNavigateToSbt={onNavigateToSbt}
      />,
    );

    const featuredCard = await screen.findByTestId(`featured-sbt-link-${alphaAddress.toLowerCase()}`);
    expect(featuredCard.tagName).toBe('A');
    expect(featuredCard).toHaveAttribute('href', buildSbtDetailPath(alphaAddress, 'alpha'));
    fireEvent.click(featuredCard);
    expect(onNavigateToSbt).toHaveBeenCalledWith(alphaAddress, buildSbtDetailPath(alphaAddress, 'alpha'));
  });

  it('routes list-mode creation to the active Worker session and keeps registry creation separate', async () => {
    const workerCanonicalProfile = {
      profileVersion: 1,
      preset: 'custom',
      authority: { mode: 'worker_canonical' },
      evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
      identity: { default: 'passkey', enabled: ['passkey'] },
      authorization: { mechanisms: ['worker_roles'] },
      encryption: { mode: 'none' },
      surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
      results: {
        visibility: 'public_full_if_storage_public',
        exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 },
      },
      export: { scope: 'all_session' },
    };
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') {
        return {
          sessionName: 'Alpha',
          blockLimits: { start: 1000 },
          corsWorkerUrl: 'https://worker.example',
          sessionModeProfile: workerCanonicalProfile,
        };
      }
      if (normalized === 'custom-universe-session') {
        return {
          sessionName: 'custom universe session',
          blockLimits: { start: 3000 },
          corsWorkerUrl: 'https://worker.example',
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
        };
      }
      if (normalized === 'beta') {
        return {
          sessionName: 'Beta',
          blockLimits: { start: 2000 },
          corsWorkerUrl: 'https://worker.example',
          networkChainId: 84532,
          __registry: {
            chainId: 84532,
            sessionId: '0xbeef',
            adminAddress: '0x00000000000000000000000000000000000000ad',
          },
        };
      }
      return {
        sessionName: normalized || 'General',
        blockLimits: { start: 1 },
        corsWorkerUrl: 'https://worker.example',
      };
    });

    const sharedProps = {
      provider: 'mock',
      network: { id: 84532, name: 'Base Sepolia' },
      account: '',
      loginComplete: true,
      miniaturized: false,
      toggleLoginModal: jest.fn(),
      sbtCacheRevision: 0,
      onRequestSbtCacheRefresh: jest.fn(),
      isSBTCacheReady: true,
      refreshSbtData: jest.fn(),
      latestBlockNumber: 0,
      ensureLightSbtDiscovery: jest.fn(),
    };

    window.history.replaceState({}, '', '/groups/alpha?view=public&sessionName=Wrong');
    const workerRender = render(<SBTsList {...sharedProps} sessionSlug="alpha" />);
    const sessionHero = await screen.findByTestId('ce-worker-groups-session-hero');
    expect(sessionHero).toHaveTextContent('Active session');
    expect(sessionHero).toHaveTextContent('Alpha');
    expect(sessionHero).not.toHaveTextContent('/alpha');
    expect(sessionHero).not.toHaveTextContent('Open session');
    const activeSessionLink = screen.getByRole('link', { name: 'Open session Alpha' });
    expect(activeSessionLink).toHaveAttribute('href', '/session/alpha');
    expect(activeSessionLink.querySelector('svg')).toBeInTheDocument();
    await waitFor(() => {
      const query = new URLSearchParams(window.location.search);
      expect(window.location.pathname).toBe('/groups');
      expect(query.get('sessionName')).toBe('alpha');
      expect(query.get('view')).toBe('public');
    });
    fireEvent.click((await screen.findAllByRole('button', { name: /create group/i }))[0]);
    expect(await screen.findByTestId('worker-group-create-panel')).toHaveTextContent('Alpha');
    expect(screen.getByTestId('worker-group-create-panel')).toHaveTextContent('/alpha');
    expect(mockWorkerGroupCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createOnly: false,
        sessionSlug: 'alpha',
        showCreate: true,
      }),
    );
    expect(mockGetRelevantBlockWindowForFilter).not.toHaveBeenCalled();
    expect(screen.queryByText(/Loading latest block|Blocks left/i)).not.toBeInTheDocument();
    workerRender.unmount();

    window.history.replaceState({}, '', '/groups/beta');
    const registryRender = render(<SBTsList {...sharedProps} sessionSlug="beta" />);
    fireEvent.click((await screen.findAllByRole('button', { name: /create group/i }))[0]);
    expect(await screen.findByTestId('create-group-panel')).toBeInTheDocument();
    registryRender.unmount();

    window.history.replaceState({}, '', '/groups/custom-universe-session');
    const invalidWorkerRender = render(<SBTsList {...sharedProps} sessionSlug="custom-universe-session" />);
    fireEvent.click((await screen.findAllByRole('button', { name: /create group/i }))[0]);
    expect(await screen.findByTestId('worker-group-create-panel')).toHaveTextContent('/custom-universe-session');
    invalidWorkerRender.unmount();

    window.history.replaceState({}, '', '/groups/unregistered-worker');
    render(
      <SBTsList
        {...sharedProps}
        sessionSlug="unregistered-worker"
        sessionConfig={{ slug: 'unregistered-worker', sessionModeProfile: workerCanonicalProfile }}
      />,
    );
    fireEvent.click((await screen.findAllByRole('button', { name: /create group/i }))[0]);
    expect(await screen.findByTestId('worker-group-create-panel')).toHaveTextContent('/unregistered-worker');
  });

  it('does not duplicate featured SBT addresses in minting sections', async () => {
    const featuredAddress = '0x00000000000000000000000000000000000000f1';
    const liveAddress = '0x00000000000000000000000000000000000000f2';

    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [featuredAddress],
      ignored_SBTs_LIST: [],
    });

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
            [featuredAddress.toLowerCase()]: {
              sbtAddress: featuredAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Featured Dedup Badge',
                description: 'featured address should not repeat in live list',
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [liveAddress.toLowerCase()]: {
              sbtAddress: liveAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Live Non Featured Badge',
                description: 'regular live card',
                sessionSlug: 'alpha',
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
      expect(document.querySelectorAll(`a[href="${buildSbtDetailPath(featuredAddress, 'alpha')}"]`).length).toBe(1);
      expect(document.querySelectorAll(`a[href="${buildSbtDetailPath(liveAddress, 'alpha')}"]`).length).toBe(1);
    });
  });

  it('dedupes same-address SBT cards across selected list-mode sessions', async () => {
    const sharedAddress = '0x00000000000000000000000000000000000000d1';

    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha', 'beta']);

    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') {
        return {
          84532: {
            sbtList: {
              [sharedAddress.toLowerCase()]: {
                sbtAddress: sharedAddress,
                slug: 'alpha',
                sbtInfo: {
                  name: 'Shared Address Badge',
                  description: 'alpha copy',
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
      }
      if (normalized === 'beta') {
        return {
          84532: {
            sbtList: {
              [sharedAddress.toLowerCase()]: {
                sbtAddress: sharedAddress,
                slug: 'beta',
                sbtInfo: {
                  name: 'Shared Address Badge',
                  description: 'beta copy',
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
      }
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
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    await waitFor(() => {
      const sharedLink = document.querySelector(`a[href="${buildSbtDetailPath(sharedAddress, 'alpha')}"]`);
      expect(sharedLink).toBeTruthy();
      expect(sharedLink?.getAttribute('href')).toBe(buildSbtDetailPath(sharedAddress, 'alpha'));
    });
  });

  it('renders live SBT cards as native anchor links', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [],
      ignored_SBTs_LIST: [],
    });
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
                name: 'Alpha Live Badge',
                description: 'native link target',
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

    const liveCardLink = await screen.findByRole('link', { name: /Alpha Live Badge/i });
    expect(liveCardLink).toHaveAttribute('href', buildSbtDetailPath(alphaAddress, 'alpha'));
  });

  it('renders inline tag chips, opens the tag modal, and keeps document toggles only for docs', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000b1';
    const betaAddress = '0x00000000000000000000000000000000000000b2';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [],
      ignored_SBTs_LIST: [],
    });
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
              featuredSbtTags: ['Governance', 'Research'],
              docURLs: ['https://example.com/docs/alpha-blueprint'],
              sbtInfo: {
                name: 'Alpha Detailed Badge',
                description: 'shows expandable details',
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
              featuredSbtTags: ['Culture'],
              sbtInfo: {
                name: 'Beta Tagged Badge',
                description: 'tags only',
                sessionSlug: 'alpha',
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

    const toggleButton = await screen.findByRole('button', { name: /show details for Alpha Detailed Badge/i });
    expect(screen.queryByRole('button', { name: /show details for Beta Tagged Badge/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open tag explorer for Governance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open tag explorer for Research/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open tag explorer for Culture/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open tag explorer for Governance/i }));
    expect(screen.getByTestId('mock-tag-modal')).toHaveTextContent('Governance');

    fireEvent.click(toggleButton);

    const docLink = screen.getByRole('link', { name: /alpha-blueprint/i });
    expect(docLink).toHaveAttribute('href', 'https://example.com/docs/alpha-blueprint');
    expect(docLink).toHaveAttribute('target', '_blank');
    expect(docLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('button', { name: /open tag explorer for Governance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open tag explorer for Research/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide details for Alpha Detailed Badge/i }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /alpha-blueprint/i })).not.toBeInTheDocument();
    });
  });

  it('renders featured-card tag chips inline and opens the shared tag modal', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000c1';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [alphaAddress],
      ignored_SBTs_LIST: [],
    });
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
              featuredSbtTags: ['Governance'],
              sbtInfo: {
                name: 'Alpha Featured Badge',
                description: 'featured tag modal launch',
                sessionSlug: 'alpha',
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

    const featuredTagButton = await screen.findByRole('button', { name: /open tag explorer for Governance/i });
    fireEvent.click(featuredTagButton);

    expect(screen.getByTestId('mock-tag-modal')).toHaveTextContent('Governance');
  });

  it('renders modal featured cards as anchor cards instead of nested mini SBT pages', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000c1';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [alphaAddress],
      ignored_SBTs_LIST: [],
    });
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
                name: 'Alpha Modal Featured Badge',
                description: 'modal anchor card',
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
    });

    render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized
        viewMode="modal"
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    const modalFeaturedLink = await screen.findByRole('link', { name: /Alpha Modal Featured Badge/i });
    expect(modalFeaturedLink).toHaveAttribute('href', buildSbtDetailPath(alphaAddress, 'alpha'));
    expect(screen.queryByTestId('mock-sbt-page')).not.toBeInTheDocument();
  });

  it('renders modal featured cards as interactive mini SBT pages when interactiveMiniCards is enabled', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000c1';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [alphaAddress],
      ignored_SBTs_LIST: [],
    });
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
                name: 'Alpha Interactive Featured Badge',
                description: 'interactive featured card',
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
    });

    render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized
        viewMode="modal"
        interactiveMiniCards
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    expect(await screen.findByTestId('mock-sbt-page')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Alpha Interactive Featured Badge/i })).not.toBeInTheDocument();
    const renderedProps = mockSBTPage.mock.calls.map(([props]) => props).filter(Boolean);
    expect(renderedProps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          SBTAddress: alphaAddress,
          sessionSlug: 'alpha',
          miniaturized: true,
          miniMintable: true,
        }),
      ]),
    );
  });

  it('renders modal live and expired cards as interactive mini SBT pages when interactiveMiniCards is enabled', async () => {
    const liveAddress = '0x00000000000000000000000000000000000000c2';
    const expiredAddress = '0x00000000000000000000000000000000000000c3';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [],
      ignored_SBTs_LIST: [],
    });
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
            [liveAddress.toLowerCase()]: {
              sbtAddress: liveAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Interactive Live Badge',
                description: 'interactive live card',
                sessionSlug: 'alpha',
                mintingEndTime: 0,
              },
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1100,
            },
            [expiredAddress.toLowerCase()]: {
              sbtAddress: expiredAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Interactive Expired Badge',
                description: 'interactive expired card',
                sessionSlug: 'alpha',
                mintingEndTime: 1,
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
        miniaturized
        viewMode="modal"
        interactiveMiniCards
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
      const renderedAddresses = mockSBTPage.mock.calls.map(([props]) => props?.SBTAddress).filter(Boolean);
      expect(renderedAddresses).toEqual(expect.arrayContaining([liveAddress, expiredAddress]));
    });
    expect(screen.getAllByTestId('mock-sbt-page').length).toBeGreaterThanOrEqual(2);
  });

  it('does not use list-level navigation when interactiveMiniCards is enabled', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000c4';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [alphaAddress],
      ignored_SBTs_LIST: [],
    });
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
                name: 'Alpha Interactive Nested Controls Badge',
                description: 'interactive nested controls card',
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
    });
    const onNavigateToSbt = jest.fn();

    render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized
        viewMode="modal"
        interactiveMiniCards
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        onNavigateToSbt={onNavigateToSbt}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />,
    );

    fireEvent.click(await screen.findByTestId('mock-sbt-nested-button'));
    fireEvent.keyDown(screen.getByTestId('mock-sbt-ignore-nav'), { key: 'Enter' });

    expect(onNavigateToSbt).not.toHaveBeenCalled();
  });

  it('does not navigate when pressing Enter on a nested featured-card control', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [alphaAddress],
      ignored_SBTs_LIST: [],
    });
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
                name: 'Alpha Featured Badge',
                description: 'featured card',
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
    });
    const onNavigateToSbt = jest.fn();

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
        onNavigateToSbt={onNavigateToSbt}
      />,
    );

    const nestedButton = await screen.findByTestId('mock-sbt-nested-button');
    fireEvent.keyDown(nestedButton, { key: 'Enter' });
    expect(onNavigateToSbt).not.toHaveBeenCalled();
  });

  it('does not navigate when clicking nested ignore-nav elements in featured cards', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [alphaAddress],
      ignored_SBTs_LIST: [],
    });
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
                name: 'Alpha Featured Badge',
                description: 'featured card',
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
    });
    const onNavigateToSbt = jest.fn();

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
        onNavigateToSbt={onNavigateToSbt}
      />,
    );

    const nestedIgnoreNav = await screen.findByTestId('mock-sbt-ignore-nav');
    fireEvent.click(nestedIgnoreNav);
    expect(onNavigateToSbt).not.toHaveBeenCalled();
  });
});
