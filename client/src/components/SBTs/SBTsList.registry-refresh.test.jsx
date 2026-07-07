// Focused SBTsList registry-refresh coverage owns list-mode pending state, refresh re-arming, and registry cache update handling.
import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SBTsList from './SBTsList';

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

describe('SBTsList registry refresh coordination', () => {
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
      try {
        delete globalThis.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP;
      } catch (_) {}
    } else {
      globalThis.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP = ORIGINAL_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP;
    }
  });

  it('refresh in all-groups mode re-syncs universe slugs and calls universe discovery hook', async () => {
    let dynamicRegistryEntries = [['alpha', { slug: 'alpha' }]];
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
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    });
    expect(ensureLightSbtUniverse).not.toHaveBeenCalled();

    await waitFor(() => expect(screen.getByRole('button', { name: /Refresh/i })).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    });

    await waitFor(() => {
      expect(refreshSessionUniverseRegistryCache).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId('session-universe-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('sbt-refresh-busy-spinner')).toBeInTheDocument();

    await waitFor(() => {
      expect(ensureLightSbtUniverse).toHaveBeenCalledWith(
        expect.arrayContaining(['alpha', 'gamma']),
        expect.objectContaining({ force: true }),
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
      />,
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
      />,
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
      />,
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
      />,
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

    const refreshSessionUniverseRegistryCache = jest.fn().mockImplementation(() =>
      refreshPromise.then(() => {
        registryCache = {
          sessions: {},
          groups: {},
          sessionsById: {},
          __hadLoadErrors: true,
        };
      }),
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
        ensureLightSbtDiscovery={jest.fn()}
        refreshSessionUniverseRegistryCache={refreshSessionUniverseRegistryCache}
      />,
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
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-alpha')).toBeInTheDocument();
      expect(screen.getByTestId('session-chip-beta')).toBeInTheDocument();
    });

    await waitFor(() => expect(screen.getByRole('button', { name: /Clear Cache/i })).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Clear Cache/i }));
    });

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
      />,
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
      />,
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
    let dynamicGroupEntries = [['alpha', { slug: 'alpha' }]];
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
      />,
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
