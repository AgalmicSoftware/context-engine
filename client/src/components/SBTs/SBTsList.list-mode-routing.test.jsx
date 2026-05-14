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
jest.mock('../TagPage/TagModal', () => (props) => {
  mockTagModal(props);
  if (!props.isOpen) return null;
  return (
    <div data-testid="mock-tag-modal">
      {props.activeTag}
    </div>
  );
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

describe('SBTsList list-mode routing and filtering', () => {
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
});
