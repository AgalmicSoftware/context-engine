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
const mockSBTPage = jest.fn();

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
      <button type="button" data-testid="mock-sbt-nested-button">Nested Action</button>
      <div
        role="button"
        tabIndex={0}
        data-testid="mock-sbt-ignore-nav"
        data-featured-card-ignore-nav="true"
      >
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

jest.mock('../../utilities/web3/contractScripts.js', () => ({
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
  mockNormalizeSessionSlug.mockImplementation((value = '') => String(value || '').trim().toLowerCase());
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
    const normalized = String(sessionName || '').trim().toLowerCase();
    if (normalized === 'alpha') return 'alpha';
    if (normalized === 'beta') return 'beta';
    if (normalized === 'general' || normalized === 'context engine') return '';
    return '';
  });
  mockGetDemoSessionConfigBySlug.mockImplementation((slug) => {
    const normalized = String(slug || '').trim().toLowerCase();
    if (normalized === 'edge') {
      return {
        slug: 'edge',
        sessionName: 'Edge 2025',
      };
    }
    return null;
  });
  mockGetSessionConfigBySlug.mockImplementation((slug) => {
    const normalized = String(slug || '').trim().toLowerCase();
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
    const normalized = String(slug || '').trim().toLowerCase();
    if (normalized === 'alpha') {
      return {
        '84532': { lastBlock: 1050, sbtList: {} },
      };
    }
    if (normalized === 'beta') {
      return {
        '84532': { lastBlock: 2060, sbtList: {} },
      };
    }
    return {
      '84532': { lastBlock: 0, sbtList: {} },
    };
  });
  mockReadCache.mockResolvedValue({
    '84532': {
      sbtList: {},
      lastBlock: 0,
    },
  });
  mockListNamespaceEntriesSync.mockReturnValue([]);
  mockGetRelevantBlockWindowForFilter.mockImplementation(async (slugInput) => {
    const normalized = String(
      slugInput && typeof slugInput === 'object'
        ? (slugInput.slug || '')
        : (slugInput || '')
    ).trim().toLowerCase();
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

describe('SBTsList per-session loader countdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateGroup.mockReset();
    setupGroupMocks();
    globalThis.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP = 50;
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
      try { delete globalThis.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP; } catch (_) {}
    } else {
      globalThis.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP = ORIGINAL_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP;
    }
  });

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

  it('shows create-group control above universe selector in embedded all-groups mode', async () => {
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
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/^Sessions$/i)).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /Create Group/i });
    const universeLabel = screen.getByText(/^Sessions$/i);
    const position = createButton.compareDocumentPosition(universeLabel);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders create-group panel above universe when expanded in embedded all-groups mode', async () => {
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
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /Create Group/i }));

    const panel = await screen.findByTestId('create-group-panel');
    const universeLabel = screen.getByText(/^Sessions$/i);
    const position = panel.compareDocumentPosition(universeLabel);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not auto-expand create group from a name-only cached draft', async () => {
    sessionStorage.setItem(
      'createSbtFormCache',
      JSON.stringify({ sbtName: 'Alpha' })
    );

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
      />
    );

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
      })
    );

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
      />
    );

    await screen.findByRole('button', { name: /Exit Group Creation/i });
    expect(await screen.findByTestId('create-group-panel')).toBeInTheDocument();
  });

  it('passes the selected-session lock gate sources only to the embedded SBTsList create panel in list scope mode', async () => {
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
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /Create Group/i }));
    await screen.findByTestId('create-group-panel');

    await waitFor(() => {
      const latestProps = mockCreateGroup.mock.calls[mockCreateGroup.mock.calls.length - 1]?.[0];
      expect(latestProps).toEqual(expect.objectContaining({
        sessionSlug: 'alpha',
        lockGatePreferredSessionSlug: 'alpha',
      }));
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
      />
    );

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
      />
    );

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
      />
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
      />
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
      />
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
      />
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
        '84532': {
          sbtList: {},
          lastBlock: 0,
        },
      });
      await Promise.resolve();
    });
  });

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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { lastBlock: 0, sbtList: {} } };
      }
      return {
        '84532': {
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
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Primed Alpha Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();

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

  it('shows single-session cards from sync cache before light discovery settles', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000ab';
    const alphaLower = alphaAddress.toLowerCase();
    let exposePrimedCard = false;
    const pendingDiscovery = new Promise(() => {});
    const ensureLightSbtDiscovery = jest.fn(() => pendingDiscovery);

    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { lastBlock: 0, sbtList: {} } };
      }
      if (!exposePrimedCard) {
        return { '84532': { lastBlock: 0, sbtList: {} } };
      }
      return {
        '84532': {
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
      />
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
      />
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { lastBlock: 0, sbtList: {} } };
      }
      if (cacheState !== 'primed') {
        return { '84532': { lastBlock: 0, sbtList: {} } };
      }
      return {
        '84532': {
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
      />
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
      />
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
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sticky Alpha Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();
  });

  it('renders General chip label with dedicated styling', async () => {
    mockGetAllSessionEntries.mockReturnValue([
      ['general', { slug: '' }],
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['general', { slug: '' }],
      ['alpha', { slug: 'alpha' }],
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
      />
    );

    await openSessionSelector();
    const generalChip = await screen.findByTestId('session-chip-general');
    expect(screen.getByRole('button', { name: 'General' })).toBeInTheDocument();
    expect(generalChip).toHaveClass('chipGeneral');
  });

  it('marks loaded vs unloaded session chips using cache presence', async () => {
    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:fullScanInProgress:beta');
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return { '84532': { lastBlock: 1050, sbtList: {} } };
      if (normalized === 'beta') return null;
      return { '84532': { lastBlock: 0, sbtList: {} } };
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
      />
    );

    await openSessionSelector();
    const alphaChip = await screen.findByTestId('session-chip-alpha');
    const betaChip = await screen.findByTestId('session-chip-beta');
    expect(alphaChip).toHaveAttribute('data-session-loaded', 'true');
    expect(alphaChip).toHaveClass('chipLoaded');
    expect(betaChip).toHaveAttribute('data-session-loaded', 'false');
    expect(betaChip).toHaveClass('chipUnloaded');
  });

  it('shows per-session chip progress bars while sessions are still loading', async () => {
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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-wrap-alpha')).toBeInTheDocument();
    });

    const chipButton = screen.getByTestId('session-chip-alpha');
    const progressTrack = screen.getByTestId('session-chip-progress-track-alpha');
    const progressFill = screen.getByTestId('session-chip-progress-fill-alpha');
    const progressText = screen.getByTestId('session-chip-progress-text-alpha');

    expect(progressTrack).toBeInTheDocument();
    expect(progressFill).toBeInTheDocument();
    expect(progressText.textContent || '').toMatch(/remaining|synced|syncing/i);
    expect(chipButton.style.getPropertyValue('--ce-chip-progress-width')).toMatch(/%/);
  });

  it('prefers live session scan progress over the cached watermark while loading', async () => {
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    localStorage.setItem('dg:sbt:fullScanInProgress:alpha', 'true');
    localStorage.removeItem('dg:sbt:fullScanInProgress:beta');
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
        embeddedMode
        sbtScanProgressBySlug={{
          alpha: {
            currentBlock: 1085,
            latestBlock: 1100,
          },
        }}
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(
        /^15 remaining$/
      );
    });
    expect(mockGetRelevantBlockWindowForFilter).not.toHaveBeenCalled();
  });

  it('falls back to cached session progress after live scan progress clears', async () => {
    localStorage.setItem('dg:sbt:fullScanInProgress:alpha', 'true');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');

    const baseProps = {
      provider: 'mock',
      network: { id: 84532, name: 'Base Sepolia' },
      account: '',
      sessionSlug: '',
      loginComplete: true,
      miniaturized: false,
      toggleLoginModal: jest.fn(),
      sbtCacheRevision: 0,
      onRequestSbtCacheRefresh: jest.fn(),
      isSBTCacheReady: true,
      refreshSbtData: jest.fn(),
      latestBlockNumber: 0,
      allSessionsMode: true,
      embeddedMode: true,
      ensureLightSbtDiscovery: jest.fn(),
    };

    const { rerender } = render(
      <SBTsList
        {...baseProps}
        sbtScanProgressBySlug={{
          alpha: {
            currentBlock: 1085,
            latestBlock: 1100,
          },
        }}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(
        /^15 remaining$/
      );
    });

    rerender(
      <SBTsList
        {...baseProps}
        sbtScanProgressBySlug={{}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(
        /^50 remaining$/
      );
    });
  });

  it('hides chip progress after scan completion even if bridged live progress is still available', async () => {
    let alphaLastBlock = 1050;
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') {
        return { '84532': { lastBlock: alphaLastBlock, sbtList: {} } };
      }
      if (normalized === 'beta') {
        return { '84532': { lastBlock: 2060, sbtList: {} } };
      }
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });

    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');

    const baseProps = {
      provider: 'mock',
      network: { id: 84532, name: 'Base Sepolia' },
      account: '',
      sessionSlug: '',
      loginComplete: true,
      miniaturized: false,
      toggleLoginModal: jest.fn(),
      sbtCacheRevision: 0,
      onRequestSbtCacheRefresh: jest.fn(),
      isSBTCacheReady: true,
      refreshSbtData: jest.fn(),
      latestBlockNumber: 0,
      allSessionsMode: true,
      embeddedMode: true,
      ensureLightSbtDiscovery: jest.fn(),
    };

    const { rerender } = render(
      <SBTsList
        {...baseProps}
        sbtScanProgressBySlug={{
          alpha: {
            currentBlock: 1099,
            latestBlock: 1100,
          },
        }}
      />
    );

    await openSessionSelector();
    expect(screen.queryByTestId('session-chip-progress-text-alpha')).not.toBeInTheDocument();

    rerender(
      <SBTsList
        {...baseProps}
        sbtScanProgressBySlug={{}}
      />
    );

    expect(screen.queryByTestId('session-chip-progress-text-alpha')).not.toBeInTheDocument();

    alphaLastBlock = 1100;
    rerender(
      <SBTsList
        {...baseProps}
        sbtCacheRevision={1}
        sbtScanProgressBySlug={{}}
      />
    );

    expect(screen.queryByTestId('session-chip-progress-text-alpha')).not.toBeInTheDocument();
  });

  it('keeps chip progress visibility sticky for 5 seconds after loading settles', async () => {
    let alphaLastBlock = 1050;
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') {
        return { '84532': { lastBlock: alphaLastBlock, sbtList: {} } };
      }
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });

    const baseProps = {
      provider: 'mock',
      network: { id: 84532, name: 'Base Sepolia' },
      account: '',
      sessionSlug: '',
      loginComplete: true,
      miniaturized: false,
      toggleLoginModal: jest.fn(),
      sbtCacheRevision: 0,
      onRequestSbtCacheRefresh: jest.fn(),
      isSBTCacheReady: true,
      refreshSbtData: jest.fn(),
      latestBlockNumber: 0,
      allSessionsMode: true,
      embeddedMode: true,
      ensureLightSbtDiscovery: jest.fn(),
    };

    const { rerender } = render(
      <SBTsList
        {...baseProps}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-wrap-alpha')).toBeInTheDocument();
    });

    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');
    alphaLastBlock = 1100;
    rerender(
      <SBTsList
        {...baseProps}
        sbtCacheRevision={1}
      />
    );

    expect(screen.getByTestId('session-chip-progress-wrap-alpha')).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
    });
    expect(screen.getByTestId('session-chip-progress-wrap-alpha')).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    });
    await waitFor(() => {
      expect(screen.queryByTestId('session-chip-progress-wrap-alpha')).not.toBeInTheDocument();
    });
  }, 15000);

  it('uses session startBlock as current progress baseline when cache lastBlock is zero', async () => {
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') {
        return { '84532': { lastBlock: 0, sbtList: {} } };
      }
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });
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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(
        /^100 remaining$/
      );
    });
  });

  it('refresh updates chip remaining count using a forced latest-block read', async () => {
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') {
        return { '84532': { lastBlock: 0, sbtList: {} } };
      }
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });

    let forcedLatestCallCount = 0;
    mockGetRelevantBlockWindowForFilter.mockImplementation(async (groupRef) => {
      const forceFlag = !!(groupRef && typeof groupRef === 'object' && groupRef.__forceLatestBlock === true);
      if (forceFlag) {
        forcedLatestCallCount += 1;
        return { fromBlock: 1000, toBlock: 1200 };
      }
      return { fromBlock: 1000, toBlock: 1100 };
    });

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
        embeddedMode={false}
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(/^100 remaining$/);
    });
    expect(forcedLatestCallCount).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(forcedLatestCallCount).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(/^200 remaining$/);
    });
  });

  it('skips passive latest-block research when MainSite reports realtime SBT listener coverage', async () => {
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') {
        return { '84532': { lastBlock: 1000, sbtList: {} } };
      }
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });

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
        embeddedMode
        sbtRealtimeCoverageBySlug={{ alpha: true }}
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-wrap-alpha')).toBeInTheDocument();
    });
    expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(/^Syncing$/);
    expect(mockGetRelevantBlockWindowForFilter).not.toHaveBeenCalled();
  });

  it('rechecks passive latest-block research only after the configured 50-block step', async () => {
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);

    let alphaLastBlock = 1000;
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') {
        return { '84532': { lastBlock: alphaLastBlock, sbtList: {} } };
      }
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });
    mockGetRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1000, toBlock: 1100 });

    localStorage.setItem('dg:sbt:fullScanInProgress:alpha', 'true');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');

    const baseProps = {
      provider: 'mock',
      network: { id: 84532, name: 'Base Sepolia' },
      account: '',
      sessionSlug: '',
      loginComplete: true,
      miniaturized: false,
      toggleLoginModal: jest.fn(),
      sbtCacheRevision: 0,
      onRequestSbtCacheRefresh: jest.fn(),
      isSBTCacheReady: true,
      refreshSbtData: jest.fn(),
      latestBlockNumber: 0,
      allSessionsMode: true,
      embeddedMode: true,
      ensureLightSbtDiscovery: jest.fn(),
    };

    const { rerender } = render(
      <SBTsList
        {...baseProps}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(mockGetRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);
    });

    alphaLastBlock = 1049;
    rerender(
      <SBTsList
        {...baseProps}
        sbtCacheRevision={1}
      />
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockGetRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);

    alphaLastBlock = 1050;
    rerender(
      <SBTsList
        {...baseProps}
        sbtCacheRevision={2}
      />
    );

    await waitFor(() => {
      expect(mockGetRelevantBlockWindowForFilter).toHaveBeenCalledTimes(2);
    });
  });

  it('uses async cache-read metadata to clear stale chip remaining counts after cards load', async () => {
    mockGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['alpha', { slug: 'alpha' }],
    ]);

    const alphaAddress = '0x0000000000000000000000000000000000000a11';
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') {
        return { '84532': { lastBlock: 0, sbtList: {} } };
      }
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
          lastBlock: 1100,
          sbtList: {
            [alphaAddress.toLowerCase()]: {
              sbtAddress: alphaAddress,
              slug: 'alpha',
              sbtInfo: {
                name: 'Alpha Meta Synced Badge',
                description: 'async read metadata should clear stale remaining count',
                sessionSlug: 'alpha',
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
      };
    });
    mockGetRelevantBlockWindowForFilter.mockImplementation(async (slugInput) => {
      const normalized = String(
        slugInput && typeof slugInput === 'object'
          ? (slugInput.slug || '')
          : (slugInput || '')
      ).trim().toLowerCase();
      if (normalized === 'alpha') return { fromBlock: 1000, toBlock: 1100 };
      return { fromBlock: 1, toBlock: 1 };
    });

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
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Meta Synced Badge')).toBeInTheDocument();
    });

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-alpha')).toHaveAttribute('data-session-loaded', 'true');
    });
    expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(/^Synced$/);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5200));
    });
    await waitFor(() => {
      expect(screen.queryByTestId('session-chip-progress-text-alpha')).not.toBeInTheDocument();
    });
  }, 15000);

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
      />
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
      '84532': {
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return syncedCache;
      return { '84532': { lastBlock: 0, sbtList: {} } };
    });
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return syncedCache;
      return { '84532': { lastBlock: 0, sbtList: {} } };
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
      />
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
    await waitFor(() => {
      expect(screen.queryByTestId('section-spinner-live')).not.toBeInTheDocument();
    }, { timeout: 2500 });
  }, 15000);

  it('clears stale scan flags and marks session loaded after failed fetch when worker URL is missing', async () => {
    localStorage.clear();
    localStorage.setItem('dg:lastActiveSbtSession', 'test-4');
    localStorage.setItem('dg:sbt:fullScanInProgress:test-4', 'true');
    localStorage.setItem('dg:sbt:deferredFullScanNeeded:test-4', 'true');

    mockGetAllSessionEntries.mockReturnValue([
      ['test-4', { slug: 'test-4' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['test-4', { slug: 'test-4' }],
    ]);
    mockGetSessionChainId.mockImplementation((slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'test-4') return null;
      return 84532;
    });
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
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
      />
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

    mockGetAllSessionEntries.mockReturnValue([
      ['test-4', { slug: 'test-4' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['test-4', { slug: 'test-4' }],
    ]);
    mockGetSessionChainId.mockImplementation((slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'test-4') return null;
      return 84532;
    });
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
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
      />
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

    mockGetAllSessionEntries.mockReturnValue([
      ['edge', { slug: 'edge' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['edge', { slug: 'edge' }],
    ]);
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'edge') return null;
      return {
        sessionName: normalized || 'General',
        blockLimits: { start: 1 },
        corsWorkerUrl: 'https://worker.example',
      };
    });
    mockGetDemoSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
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
      />
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
      />
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
      />
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
      />
    );

    await openSessionSelector();
    fireEvent.click(await screen.findByRole('button', { name: /Show More Sessions \(\d+\)/i }));

    await waitFor(() => {
      expect(ensureLightSbtUniverse).toHaveBeenCalledWith(
        expect.arrayContaining(['beta']),
        expect.objectContaining({ force: true })
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
      />
    );

    await waitFor(() => {
      expect(ensureLightSbtDiscovery).toHaveBeenCalledWith(
        'alpha',
        expect.objectContaining({ forceScopeSlug: 'alpha' })
      );
    });

    await openSessionSelector();
    fireEvent.click(await screen.findByRole('button', { name: /Show More Sessions \(\d+\)/i }));

    await waitFor(() => {
      expect(ensureLightSbtUniverse).toHaveBeenCalledWith(
        expect.arrayContaining(['beta']),
        expect.objectContaining({ force: true })
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
      />
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
      />
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
      />
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
      />
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
    mockGetAllSessionEntries.mockReturnValue([
      ['edge', { slug: 'edge' }],
    ]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([
      ['edge', { slug: 'edge' }],
    ]);
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'edge') return null;
      return {
        sessionName: normalized || 'General',
        blockLimits: { start: 1 },
      };
    });
    mockGetDemoSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
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
      />
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
      '84532': {
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
      '84532': {
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return alphaCache;
      if (normalized === 'beta') return betaCache;
      return { '84532': { sbtList: {}, lastBlock: 0 } };
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
      />
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
      expect(ensureLightSbtDiscovery).toHaveBeenCalledWith(
        'beta',
        expect.objectContaining({ forceScopeSlug: 'beta' })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Beta Selected Badge')).toBeInTheDocument();
    });
  });

  it('adds a "No Session" chip when list-mode cache contains unassociated SBT metadata', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const unassignedAddress = '0x00000000000000000000000000000000000000a9';
    const alphaCache = {
      '84532': {
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return alphaCache;
      return { '84532': { sbtList: {}, lastBlock: 0 } };
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
      />
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
      '84532': {
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return alphaCache;
      return { '84532': { sbtList: {}, lastBlock: 0 } };
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
      />
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
      '84532': {
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') return alphaCache;
      return { '84532': { sbtList: {}, lastBlock: 0 } };
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
      />
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
      '84532': {
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
      '84532': {
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') return { '84532': { sbtList: {}, lastBlock: 0 } };
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
      />
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
      />
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

  it('shows only SBTs associated with the highlighted sessionSlug in all-sessions mode', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const betaAddress = '0x00000000000000000000000000000000000000b1';
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Session Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Beta Session Badge')).not.toBeInTheDocument();
  });

  it('falls back to cached entry slug when sessionSlug is inferred (not explicit)', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
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
      '84532': {
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
          '84532': {
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
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Archive Alpha Explicit Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Archive Beta Explicit Badge')).not.toBeInTheDocument();
  });

  it('retries cold-load live-session fetches when registry hydration later supplies the chain config', async () => {
    const liveDemoAddress = '0x00000000000000000000000000000000000000c9';
    let demoRegistryReady = false;

    mockGetSessionChainId.mockImplementation((slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'demo') return demoRegistryReady ? 84532 : null;
      return 84532;
    });
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'demo') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
    );

    expect(screen.queryByText('Live Demo Registry Badge')).not.toBeInTheDocument();

    await act(async () => {
      demoRegistryReady = true;
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
    );

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
      '84532': {
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
          '84532': {
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
      />
    );

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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
    );

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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Session Badge')).toBeInTheDocument();
    });
    expect(screen.queryByText('Beta Session Badge')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma Session Badge')).not.toBeInTheDocument();
  });

  it('opens the terminology-aware detail route when a featured card in SBTsList is clicked', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [alphaAddress],
      ignored_SBTs_LIST: [],
    });
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
    );

    const featuredCard = await screen.findByTestId(`featured-sbt-link-${alphaAddress.toLowerCase()}`);
    expect(featuredCard.tagName).toBe('A');
    expect(featuredCard).toHaveAttribute('href', buildSbtDetailPath(alphaAddress, 'alpha'));
    fireEvent.click(featuredCard);
    expect(onNavigateToSbt).toHaveBeenCalledWith(alphaAddress, buildSbtDetailPath(alphaAddress, 'alpha'));
  });

  it('does not duplicate featured SBT addresses in minting sections', async () => {
    const featuredAddress = '0x00000000000000000000000000000000000000f1';
    const liveAddress = '0x00000000000000000000000000000000000000f2';

    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [featuredAddress],
      ignored_SBTs_LIST: [],
    });

    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized === 'alpha') {
        return {
          '84532': {
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
          '84532': {
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
      return { '84532': { sbtList: {}, lastBlock: 0 } };
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
      />
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
    );

    const liveCardLink = await screen.findByRole('link', { name: /Alpha Live Badge/i });
    expect(liveCardLink).toHaveAttribute('href', buildSbtDetailPath(alphaAddress, 'alpha'));
  });

  it('toggles standard-card details from tag and document fallbacks only when present', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000b1';
    const betaAddress = '0x00000000000000000000000000000000000000b2';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [],
      ignored_SBTs_LIST: [],
    });
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
              sbtInfo: {
                name: 'Beta Plain Badge',
                description: 'no expandable details',
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
      />
    );

    const toggleButton = await screen.findByRole('button', { name: /show details for Alpha Detailed Badge/i });
    expect(screen.queryByRole('button', { name: /show details for Beta Plain Badge/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Governance')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    const docLink = screen.getByRole('link', { name: /alpha-blueprint/i });
    expect(docLink).toHaveAttribute('href', 'https://example.com/docs/alpha-blueprint');
    expect(docLink).toHaveAttribute('target', '_blank');
    expect(docLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Governance')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide details for Alpha Detailed Badge/i }));

    await waitFor(() => {
      expect(screen.queryByText('Governance')).not.toBeInTheDocument();
    });
  });

  it('renders modal featured cards as anchor cards instead of nested mini SBT pages', async () => {
    const alphaAddress = '0x00000000000000000000000000000000000000c1';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [alphaAddress],
      ignored_SBTs_LIST: [],
    });
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
    );

    expect(await screen.findByTestId('mock-sbt-page')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Alpha Interactive Featured Badge/i })).not.toBeInTheDocument();
    const renderedProps = mockSBTPage.mock.calls.map(([props]) => props).filter(Boolean);
    expect(renderedProps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        SBTAddress: alphaAddress,
        sessionSlug: 'alpha',
        miniaturized: true,
        miniMintable: true,
      }),
    ]));
  });

  it('renders modal live and expired cards as interactive mini SBT pages when interactiveMiniCards is enabled', async () => {
    const liveAddress = '0x00000000000000000000000000000000000000c2';
    const expiredAddress = '0x00000000000000000000000000000000000000c3';
    mockGetSessionLists.mockReturnValue({
      featured_SBTs_LIST: [],
      ignored_SBTs_LIST: [],
    });
    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
    );

    await waitFor(() => {
      const renderedAddresses = mockSBTPage.mock.calls
        .map(([props]) => props?.SBTAddress)
        .filter(Boolean);
      expect(renderedAddresses).toEqual(expect.arrayContaining([
        liveAddress,
        expiredAddress,
      ]));
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') {
        return { '84532': { sbtList: {}, lastBlock: 0 } };
      }
      return {
        '84532': {
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
      />
    );

    const nestedIgnoreNav = await screen.findByTestId('mock-sbt-ignore-nav');
    fireEvent.click(nestedIgnoreNav);
    expect(onNavigateToSbt).not.toHaveBeenCalled();
  });

  it('keeps loaded cards visible while section-header spinner runs and applies hide hysteresis', async () => {
    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const liveCache = {
      '84532': {
        sbtList: {
          [alphaAddress.toLowerCase()]: {
            sbtAddress: alphaAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'Alpha Live Badge',
              description: 'visible while refresh runs',
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

    let alphaReadCount = 0;
    let resolveSecondRead;
    const secondRead = new Promise((resolve) => {
      resolveSecondRead = resolve;
    });

    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') return { '84532': { sbtList: {}, lastBlock: 0 } };
      alphaReadCount += 1;
      if (alphaReadCount === 1) return liveCache;
      return secondRead;
    });

    const { rerender } = render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized={false}
        embeddedMode
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Live Badge')).toBeInTheDocument();
    });

    rerender(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized={false}
        embeddedMode
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={1}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Live Badge')).toBeInTheDocument();
    });
    expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();
    expect(screen.getByText('Alpha Live Badge')).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();
    expect(screen.getByText('Alpha Live Badge')).toBeInTheDocument();

    await act(async () => {
      resolveSecondRead(liveCache);
      await Promise.resolve();
    });

    expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('section-spinner-live')).not.toBeInTheDocument();
      expect(screen.getByText('Alpha Live Badge')).toBeInTheDocument();
    }, { timeout: 2500 });
  });

  it('does not disable admin refresh controls during revision-only cache refresh ticks', async () => {
    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const liveCache = {
      '84532': {
        sbtList: {
          [alphaAddress.toLowerCase()]: {
            sbtAddress: alphaAddress,
            slug: 'alpha',
            sbtInfo: {
              name: 'Alpha Stable Badge',
              description: 'keeps controls enabled',
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

    let alphaReadCount = 0;
    let resolveSecondRead;
    const secondRead = new Promise((resolve) => {
      resolveSecondRead = resolve;
    });

    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') return { '84532': { sbtList: {}, lastBlock: 0 } };
      alphaReadCount += 1;
      if (alphaReadCount === 1) return liveCache;
      return secondRead;
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
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Stable Badge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Group list settings/i }));
    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    const clearCacheButton = screen.getByRole('button', { name: /Clear Cache/i });
    expect(refreshButton).not.toBeDisabled();
    expect(clearCacheButton).not.toBeDisabled();

    rerender(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized={false}
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={1}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha Stable Badge')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Refresh/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Clear Cache/i })).not.toBeDisabled();

    await act(async () => {
      resolveSecondRead(liveCache);
      await Promise.resolve();
    });
  });

  it('keeps empty-state copy stable during background refresh after first load settles', async () => {
    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');
    const emptyCache = {
      '84532': {
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') return emptyCache;
      alphaReadCount += 1;
      if (alphaReadCount === 1) return emptyCache;
      return secondRead;
    });

    const { rerender } = render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized={false}
        embeddedMode
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.getByText('No live groups.')).toBeInTheDocument();
    }, { timeout: 2500 });

    rerender(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug="alpha"
        loginComplete
        miniaturized={false}
        embeddedMode
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={1}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();
      expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('No live groups.')).not.toBeInTheDocument();

    await act(async () => {
      resolveSecondRead(emptyCache);
      await Promise.resolve();
    });
  });

  it('in list-mode all-groups keeps loading hint active when readiness is false and cache has watermark progress', async () => {
    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const watermarkEmptyCache = {
      '84532': {
        sbtList: {},
        lastBlock: 1100,
      },
    };

    mockReadCache.mockImplementation(async (_namespace, slug) => {
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') return { '84532': { sbtList: {}, lastBlock: 0 } };
      return watermarkEmptyCache;
    });

    render(
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
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
      expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1400));
    });

    expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();
    expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
    expect(screen.queryByText('No live groups.')).not.toBeInTheDocument();
  });

  it('in list-mode all-groups suppresses empty-state copy during revision-only refresh from empty baseline', async () => {
    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const emptyCache = {
      '84532': {
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
      const normalized = String(slug || '').trim().toLowerCase();
      if (normalized !== 'alpha') return emptyCache;
      alphaReadCount += 1;
      if (alphaReadCount === 1) return emptyCache;
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
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No live groups.')).toBeInTheDocument();
    }, { timeout: 2500 });

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
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();
      expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('No live groups.')).not.toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300));
    });

    expect(screen.getByTestId('section-spinner-live')).toBeInTheDocument();
    expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
    expect(screen.queryByText('No live groups.')).not.toBeInTheDocument();

    await act(async () => {
      resolveSecondRead(emptyCache);
      await Promise.resolve();
    });
  });

  it('refresh in all-groups mode re-syncs universe slugs and calls universe discovery hook', async () => {
    let dynamicRegistryEntries = [
      ['alpha', { slug: 'alpha' }],
    ];
    mockSessionRegistryGetAllSessionEntries.mockImplementation(() => dynamicRegistryEntries);
    const ensureLightSbtUniverse = jest.fn().mockResolvedValue(undefined);
    const refreshSessionUniverseRegistryCache = jest.fn().mockImplementation(async () => {
      dynamicRegistryEntries = [
        ['alpha', { slug: 'alpha' }],
        ['gamma', { slug: 'gamma' }],
      ];
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
        ensureLightSbtUniverse={ensureLightSbtUniverse}
        refreshSessionUniverseRegistryCache={refreshSessionUniverseRegistryCache}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    });
    expect(ensureLightSbtUniverse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(refreshSessionUniverseRegistryCache).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId('session-universe-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('sbt-refresh-busy-spinner')).toBeInTheDocument();

    await waitFor(() => {
      expect(ensureLightSbtUniverse).toHaveBeenCalledWith(
        expect.arrayContaining(['alpha', 'gamma']),
        expect.objectContaining({ force: true })
      );
    });
  });

  it('re-arms list-mode registry refresh when pending clears and then returns', async () => {
    localStorage.clear();
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    let dynamicRegistryEntries = [];
    mockSessionRegistryGetAllSessionEntries.mockImplementation(() => dynamicRegistryEntries);

    const refreshSessionUniverseRegistryCache = jest.fn().mockResolvedValue(undefined);

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
        refreshSessionUniverseRegistryCache={refreshSessionUniverseRegistryCache}
      />
    );

    await waitFor(() => {
      expect(refreshSessionUniverseRegistryCache).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      dynamicRegistryEntries = [['alpha', { slug: 'alpha' }]];
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
      await Promise.resolve();
    });

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-alpha')).toBeInTheDocument();
    });

    await act(async () => {
      dynamicRegistryEntries = [];
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(refreshSessionUniverseRegistryCache).toHaveBeenCalledTimes(2);
    });
  });

  it('re-arms list-mode refresh after an empty registry cache becomes hydrated and then missing again', async () => {
    localStorage.clear();
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    let registryCache = null;
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([]);
    mockSessionRegistryReadCache.mockImplementation(() => registryCache);

    const refreshSessionUniverseRegistryCache = jest.fn().mockImplementation(async () => {
      registryCache = {
        sessions: {},
        groups: {},
        sessionsById: {},
        __hadLoadErrors: false,
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
        refreshSessionUniverseRegistryCache={refreshSessionUniverseRegistryCache}
      />
    );

    await waitFor(() => {
      expect(refreshSessionUniverseRegistryCache).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      registryCache = null;
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(refreshSessionUniverseRegistryCache).toHaveBeenCalledTimes(2);
    });
  });

  it('treats a legacy empty registry cache without a hydration flag as pending', async () => {
    localStorage.clear();
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const refreshSessionUniverseRegistryCache = jest.fn().mockResolvedValue(undefined);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([]);
    mockSessionRegistryReadCache.mockReturnValue({
      sessions: {},
      groups: {},
      sessionsById: {},
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
        refreshSessionUniverseRegistryCache={refreshSessionUniverseRegistryCache}
      />
    );

    await waitFor(() => {
      expect(refreshSessionUniverseRegistryCache).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('session-universe-spinner')).toBeInTheDocument();
  });

  it('treats a legacy registry cache with sessions and no hydration flag as hydrated', async () => {
    localStorage.clear();
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    const refreshSessionUniverseRegistryCache = jest.fn().mockResolvedValue(undefined);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([]);
    mockSessionRegistryReadCache.mockReturnValue({
      sessions: {
        alpha: { slug: 'alpha' },
      },
      groups: {},
      sessionsById: {},
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
        refreshSessionUniverseRegistryCache={refreshSessionUniverseRegistryCache}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-alpha')).toBeInTheDocument();
    });
    expect(refreshSessionUniverseRegistryCache).not.toHaveBeenCalled();
  });

  it('keeps list-mode registry pending when the cache only reflects load errors', async () => {
    localStorage.clear();
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha']);

    let registryCache = null;
    let resolveRefresh;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([]);
    mockSessionRegistryReadCache.mockImplementation(() => registryCache);

    const refreshSessionUniverseRegistryCache = jest.fn().mockImplementation(() => (
      refreshPromise.then(() => {
        registryCache = {
          sessions: {},
          groups: {},
          sessionsById: {},
          __hadLoadErrors: true,
        };
      })
    ));

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
        refreshSessionUniverseRegistryCache={refreshSessionUniverseRegistryCache}
      />
    );

    await waitFor(() => {
      expect(refreshSessionUniverseRegistryCache).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveRefresh();
      await refreshPromise;
      await Promise.resolve();
    });

    expect(screen.getByTestId('session-universe-spinner')).toBeInTheDocument();
  });

  it('clear-cache wipes all selected sessions in list-mode all-groups view', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha', 'beta']);
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
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={ensureLightSbtDiscovery}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-alpha')).toBeInTheDocument();
      expect(screen.getByTestId('session-chip-beta')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Clear Cache/i }));

    await waitFor(() => {
      expect(mockRemoveCache).toHaveBeenCalledWith('sbtCache', 'alpha');
      expect(mockRemoveCache).toHaveBeenCalledWith('sbtCache', 'beta');
    });
  });

  it('refresh keeps cached view visible while all-groups sync runs', async () => {
    let resolveUniverseSync;
    const pendingUniverseSync = new Promise((resolve) => {
      resolveUniverseSync = resolve;
    });
    const ensureLightSbtUniverse = jest.fn().mockImplementation(() => pendingUniverseSync);

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
        ensureLightSbtUniverse={ensureLightSbtUniverse}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Collecting Live/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Group list settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    expect(screen.queryByText(/Loading Groups/i)).not.toBeInTheDocument();

    await act(async () => {
      resolveUniverseSync();
      await Promise.resolve();
    });
  });

  it('renders expanded settings panel above the session universe section', async () => {
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
      />
    );

    const settingsButton = await screen.findByRole('button', { name: /Group list settings/i });
    expect(screen.queryByTestId('session-selector-panel')).not.toBeInTheDocument();
    fireEvent.click(settingsButton);

    const settingsLabel = await screen.findByText(/Exclude Password-Locked Groups/i);
    const universePanel = await screen.findByTestId('session-selector-panel');
    const universeLabel = screen.getByText(/^Sessions$/i);
    const position = settingsLabel.compareDocumentPosition(universeLabel);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(universePanel).toBeInTheDocument();
  });

  it('uses a local Sessions cog in embedded all-groups view to reveal the selector inline', async () => {
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
      />
    );

    expect(screen.queryByRole('button', { name: /Group list settings/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('session-selector-toggle')).toHaveAttribute('aria-label', 'Show session selector');
    expect(screen.queryByTestId('session-selector-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('session-selector-toggle'));

    expect(await screen.findByTestId('session-selector-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
  });

  it('keeps the legacy password filter visible by default in modal mini mode unless CommunityTab opts into compact settings', async () => {
    render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug=""
        loginComplete
        miniaturized
        viewMode="modal"
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    expect(await screen.findByText(/Exclude Password-Locked Groups/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Group list settings/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('session-selector-toggle')).toHaveAttribute('aria-label', 'Show session selector');
    expect(screen.queryByTestId('session-selector-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('session-selector-toggle'));

    expect(await screen.findByTestId('session-selector-panel')).toBeInTheDocument();
    expect(screen.getByText(/Exclude Password-Locked Groups/i)).toBeInTheDocument();
  });

  it('renders a compact settings cog only for the CommunityTab mini modal path', async () => {
    render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug=""
        loginComplete
        miniaturized
        viewMode="modal"
        communityTabCompactSettings
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    const settingsButton = await screen.findByRole('button', { name: /Group list settings/i });
    expect(screen.queryByText(/Exclude Password-Locked Groups/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^No Password Groups$/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('session-selector-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('session-selector-panel')).not.toBeInTheDocument();

    fireEvent.click(settingsButton);

    expect(screen.getByText(/^No Password Groups$/i)).toBeInTheDocument();
    expect(screen.getByTestId('session-selector-panel')).toBeInTheDocument();
    expect(settingsButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders the compact settings cog above the session universe section in the CommunityTab mini modal path', async () => {
    render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug=""
        loginComplete
        miniaturized
        viewMode="modal"
        communityTabCompactSettings
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    const settingsButton = await screen.findByRole('button', { name: /Group list settings/i });
    const universeLabel = screen.getByText(/^Sessions$/i);
    const position = settingsButton.compareDocumentPosition(universeLabel);

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides the session summary when the CommunityTab mini modal session universe is collapsed', async () => {
    render(
      <SBTsList
        provider="mock"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        sessionSlug=""
        loginComplete
        miniaturized
        viewMode="modal"
        communityTabCompactSettings
        toggleLoginModal={jest.fn()}
        sbtCacheRevision={0}
        onRequestSbtCacheRefresh={jest.fn()}
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    const settingsButton = await screen.findByRole('button', { name: /Group list settings/i });
    fireEvent.click(settingsButton);

    await screen.findByTestId('session-selector-panel');
    expect(screen.queryByTestId('session-selector-summary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Collapse session universe/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Expand session universe/i })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('session-universe-collapsed-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('session-collapsed-chip-alpha')).not.toBeInTheDocument();
    expect(screen.queryByTestId('session-collapsed-chip-beta')).not.toBeInTheDocument();
  });

  it('shows selected sessions in collapsed session universe summary', async () => {
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
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-alpha')).toBeInTheDocument();
      expect(screen.getByTestId('session-chip-beta')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Collapse session universe/i }));

    const collapsedSummary = await screen.findByTestId('session-universe-collapsed-summary');
    expect(collapsedSummary).toBeInTheDocument();
    expect(screen.getByTestId('session-collapsed-chip-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('session-collapsed-chip-beta')).toBeInTheDocument();
    expect(screen.getByTestId('session-collapsed-chip-progress-alpha')).toHaveTextContent('1,050 / 1,100');
    expect(screen.getByTestId('session-collapsed-chip-progress-beta')).toHaveTextContent('2,060 / 2,200');
  });

  it('renders closed-summary session link icons and opens the session without revealing the selector', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha', 'beta']);
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
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    const closedSummary = await screen.findByTestId('session-selector-summary');
    expect(closedSummary).toBeInTheDocument();
    expect(screen.queryByTestId('session-selector-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('session-collapsed-chip-open-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('session-collapsed-chip-open-beta')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('session-collapsed-chip-open-beta'));

    expect(openSpy).toHaveBeenCalledWith('/session/beta', '_blank', 'noopener,noreferrer');
    expect(screen.queryByTestId('session-selector-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show session selector/i })).toBeInTheDocument();
    openSpy.mockRestore();
  });

  it('prepends PUBLIC_URL when opening a collapsed-summary session link', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha', 'beta']);
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    try {
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
        />
      );

      await screen.findByTestId('session-selector-summary');
      fireEvent.click(screen.getByTestId('session-collapsed-chip-open-beta'));

      expect(openSpy).toHaveBeenCalledWith('/ce/session/beta', '_blank', 'noopener,noreferrer');
    } finally {
      openSpy.mockRestore();
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('opens in-panel collapsed summary session links without expanding the section', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['alpha', 'beta']);
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
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    await openSessionSelector();
    fireEvent.click(screen.getByRole('button', { name: /Collapse session universe/i }));

    const collapsedSummary = await screen.findByTestId('session-universe-collapsed-summary');
    expect(collapsedSummary).toBeInTheDocument();
    expect(screen.getByTestId('session-collapsed-chip-open-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('session-collapsed-chip-open-beta')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('session-collapsed-chip-open-alpha'));

    expect(openSpy).toHaveBeenCalledWith('/session/alpha', '_blank', 'noopener,noreferrer');
    expect(screen.getByTestId('session-universe-collapsed-summary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expand session universe/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alpha' })).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it('keeps the closed-summary general session link canonical as /session', async () => {
    mockReadSessionScanScope.mockReturnValue('list');
    mockReadSessionScanSlugs.mockReturnValue(['']);
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
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        allSessionsMode
        embeddedMode
        ensureLightSbtDiscovery={jest.fn()}
      />
    );

    const closedSummary = await screen.findByTestId('session-selector-summary');
    expect(closedSummary).toBeInTheDocument();
    expect(screen.getByTestId('session-collapsed-chip-general')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('session-collapsed-chip-open-general'));

    expect(openSpy).toHaveBeenCalledWith('/session', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('allows collapsing and expanding the universe chips section', async () => {
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
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Collapse session universe/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Alpha' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Expand session universe/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Expand session universe/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Collapse session universe/i })).toBeInTheDocument();
    });
  });

  it('ignores registry cache update events in single-session mode so light discovery does not restart', async () => {
    const ensureLightSbtDiscovery = jest.fn().mockResolvedValue(undefined);

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
        isSBTCacheReady={false}
        refreshSbtData={jest.fn()}
        latestBlockNumber={0}
        embeddedMode
        ensureLightSbtDiscovery={ensureLightSbtDiscovery}
      />
    );

    await waitFor(() => {
      expect(ensureLightSbtDiscovery).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
      await Promise.resolve();
    });

    expect(ensureLightSbtDiscovery).toHaveBeenCalledTimes(1);
  });

  it('re-syncs session universe chips immediately on registry cache update events', async () => {
    let dynamicGroupEntries = [
      ['alpha', { slug: 'alpha' }],
    ];
    mockGetAllSessionEntries.mockImplementation(() => dynamicGroupEntries);
    mockSessionRegistryGetAllSessionEntries.mockImplementation(() => dynamicGroupEntries);

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
      />
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /alpha/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /gamma/i })).not.toBeInTheDocument();
    });

    dynamicGroupEntries = [
      ['alpha', { slug: 'alpha' }],
      ['gamma', { slug: 'gamma' }],
    ];

    await act(async () => {
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /gamma/i })).toBeInTheDocument();
    });
  });
});
