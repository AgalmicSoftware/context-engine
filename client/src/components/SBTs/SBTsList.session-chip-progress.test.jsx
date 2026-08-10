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

jest.mock('../../utilities/session/sessionNaming.js', () => {
  const actual = jest.requireActual('../../utilities/session/sessionNaming.js');
  return {
    ...actual,
    normalizeSessionSlug: (...args) =>
      typeof mockNormalizeSessionSlug === 'function'
        ? mockNormalizeSessionSlug(...args)
        : actual.normalizeSessionSlug(...args),
  };
});

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

describe('SBTsList session chip progress display', () => {
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
      />,
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
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') return { 84532: { lastBlock: 1050, sbtList: {} } };
      if (normalized === 'beta') return null;
      return { 84532: { lastBlock: 0, sbtList: {} } };
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
      />,
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
    mockGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);
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
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(/^15 remaining$/);
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
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(/^15 remaining$/);
    });

    rerender(<SBTsList {...baseProps} sbtScanProgressBySlug={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(/^50 remaining$/);
    });
  });

  it('hides chip progress after scan completion even if bridged live progress is still available', async () => {
    let alphaLastBlock = 1050;
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') {
        return { 84532: { lastBlock: alphaLastBlock, sbtList: {} } };
      }
      if (normalized === 'beta') {
        return { 84532: { lastBlock: 2060, sbtList: {} } };
      }
      return { 84532: { lastBlock: 0, sbtList: {} } };
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
      />,
    );

    await openSessionSelector();
    expect(screen.queryByTestId('session-chip-progress-text-alpha')).not.toBeInTheDocument();

    rerender(<SBTsList {...baseProps} sbtScanProgressBySlug={{}} />);

    expect(screen.queryByTestId('session-chip-progress-text-alpha')).not.toBeInTheDocument();

    alphaLastBlock = 1100;
    rerender(<SBTsList {...baseProps} sbtCacheRevision={1} sbtScanProgressBySlug={{}} />);

    expect(screen.queryByTestId('session-chip-progress-text-alpha')).not.toBeInTheDocument();
  });

  it('keeps chip progress visibility sticky for 5 seconds after loading settles', async () => {
    let alphaLastBlock = 1050;
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') {
        return { 84532: { lastBlock: alphaLastBlock, sbtList: {} } };
      }
      return { 84532: { lastBlock: 0, sbtList: {} } };
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

    const { rerender } = render(<SBTsList {...baseProps} />);

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-wrap-alpha')).toBeInTheDocument();
    });

    localStorage.removeItem('dg:sbt:fullScanInProgress:alpha');
    localStorage.removeItem('dg:sbt:deferredFullScanNeeded:alpha');
    alphaLastBlock = 1100;
    rerender(<SBTsList {...baseProps} sbtCacheRevision={1} />);

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
    mockGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') {
        return { 84532: { lastBlock: 0, sbtList: {} } };
      }
      return { 84532: { lastBlock: 0, sbtList: {} } };
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
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(/^100 remaining$/);
    });
  });

  it('refresh updates chip remaining count using a forced latest-block read', async () => {
    mockGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') {
        return { 84532: { lastBlock: 0, sbtList: {} } };
      }
      return { 84532: { lastBlock: 0, sbtList: {} } };
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
      />,
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
    mockGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') {
        return { 84532: { lastBlock: 1000, sbtList: {} } };
      }
      return { 84532: { lastBlock: 0, sbtList: {} } };
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
      />,
    );

    await openSessionSelector();
    await waitFor(() => {
      expect(screen.getByTestId('session-chip-progress-wrap-alpha')).toBeInTheDocument();
    });
    expect(screen.getByTestId('session-chip-progress-text-alpha')).toHaveTextContent(/^Syncing$/);
    expect(mockGetRelevantBlockWindowForFilter).not.toHaveBeenCalled();
  });

  it('rechecks passive latest-block research only after the configured 50-block step', async () => {
    mockGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);

    let alphaLastBlock = 1000;
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') {
        return { 84532: { lastBlock: alphaLastBlock, sbtList: {} } };
      }
      return { 84532: { lastBlock: 0, sbtList: {} } };
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

    const { rerender } = render(<SBTsList {...baseProps} />);

    await openSessionSelector();
    await waitFor(() => {
      expect(mockGetRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);
    });

    alphaLastBlock = 1049;
    rerender(<SBTsList {...baseProps} sbtCacheRevision={1} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockGetRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);

    alphaLastBlock = 1050;
    rerender(<SBTsList {...baseProps} sbtCacheRevision={2} />);

    await waitFor(() => {
      expect(mockGetRelevantBlockWindowForFilter).toHaveBeenCalledTimes(2);
    });
  });

  it('uses async cache-read metadata to clear stale chip remaining counts after cards load', async () => {
    mockGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);
    mockSessionRegistryGetAllSessionEntries.mockReturnValue([['alpha', { slug: 'alpha' }]]);

    const alphaAddress = '0x0000000000000000000000000000000000000a11';
    mockPeekCacheSync.mockImplementation((_namespace, slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'alpha') {
        return { 84532: { lastBlock: 0, sbtList: {} } };
      }
      return { 84532: { lastBlock: 0, sbtList: {} } };
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
      const normalized = String(slugInput && typeof slugInput === 'object' ? slugInput.slug || '' : slugInput || '')
        .trim()
        .toLowerCase();
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
      />,
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
});
