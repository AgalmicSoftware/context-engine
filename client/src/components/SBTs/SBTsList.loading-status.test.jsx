// Remaining broad SBTsList loading-status coverage owns initial loader/cache hydration, refresh timing, registry refresh, and settings edge cases.
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
