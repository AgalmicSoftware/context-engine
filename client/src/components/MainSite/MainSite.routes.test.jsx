import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MainSite, mainSiteDispatchActions } from './MainSite';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import contractScripts from '../../utilities/web3/contractScripts.js';
import { initCacheManager } from '../../utilities/cache/cacheScripts.js';
import {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import {
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
  loadGroupRegistryCache,
  sessionRegistryStore,
} from '../../utilities/web3/sessionRegistry.js';
import { FIRST_VISIT_STORAGE_KEY } from '../Onboarding/onboardingConfig.js';
import { FIRST_VISIT_ROOT_REDIRECT_CONSUMED_STORAGE_KEY } from './sessionFallbackRedirect.js';
import { getPolisDemoQuestionPool } from '../SurveyTool/surveyPolisDemoQuestionPool';

const mockAdminPage = jest.fn(() => null);
const mockSponsorPage = jest.fn(() => null);
const mockSessionWizard = jest.fn(() => null);
const mockSurveyPage = jest.fn(() => null);
const mockSessionDocumentsPage = jest.fn(() => null);
const mockOnePageSession = jest.fn(() => null);
const mockSBTPage = jest.fn(() => null);
const mockSBTsPage = jest.fn(() => null);
const mockCompareAddresses = jest.fn(() => null);
const mockTagPage = jest.fn(() => null);
const mockDebateMap = jest.fn(() => null);
const ORIGINAL_SESSION_SCAN_SCOPE = globalThis.CE_SESSION_SCAN_SCOPE;
const ORIGINAL_SESSION_SCAN_SLUGS = globalThis.CE_SESSION_SCAN_SLUGS;

const restoreSessionScanGlobals = () => {
  if (typeof ORIGINAL_SESSION_SCAN_SCOPE === 'undefined') {
    try { delete globalThis.CE_SESSION_SCAN_SCOPE; } catch (_) {}
  } else {
    globalThis.CE_SESSION_SCAN_SCOPE = ORIGINAL_SESSION_SCAN_SCOPE;
  }

  if (typeof ORIGINAL_SESSION_SCAN_SLUGS === 'undefined') {
    try { delete globalThis.CE_SESSION_SCAN_SLUGS; } catch (_) {}
  } else {
    globalThis.CE_SESSION_SCAN_SLUGS = ORIGINAL_SESSION_SCAN_SLUGS;
  }
};

jest.mock('react-redux', () => ({
  connect: jest.fn((_mapStateToProps, _mapDispatchToProps) => (Comp) => Comp),
}));

jest.mock('../HooksHOC/withWagmiBridge', () => ({
  WagmiHooksHOC: (Comp) => Comp,
}));

jest.mock('../Navbar/Navbar', () => () => null);
jest.mock('../MainContent/MainAreaTabs', () => () => null);
jest.mock('../Onboarding/OnboardingOverlay', () => () => null);
jest.mock('../Footer/Footer', () => () => null);
jest.mock('../UserPage/SimUserPage', () => () => null);
jest.mock('../Shared/LazyFallback', () => () => null);
jest.mock('../E2E/DevE2eNav', () => () => null);
jest.mock('../ErrorBoundary/RouteErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }) => children,
}));

jest.mock('../Admin/AdminPage', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockAdminPage(props);
      return React.createElement('div', {
        'data-testid': 'mock-admin-page',
        'data-initial-registry-chain-id': String(props.initialRegistryChainId ?? ''),
        'data-initial-session-id': String(props.initialSessionId || ''),
        'data-network-id': String(props.network?.id || ''),
      });
    },
  };
});

jest.mock('../Sponsor/SponsorPage', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockSponsorPage(props);
      return React.createElement('div', {
        'data-testid': 'mock-sponsor-page',
        'data-initial-registry-chain-id': String(props.initialRegistryChainId ?? ''),
        'data-initial-session-id': String(props.initialSessionId || ''),
        'data-network-id': String(props.network?.id || ''),
      });
    },
  };
});

jest.mock('../Sessions/SessionWizard', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockSessionWizard(props);
      return React.createElement('div', {
        'data-testid': 'mock-session-wizard',
        'data-active-session-slug': String(props.activeSessionSlug || ''),
        'data-initial-registry-chain-id': String(props.initialRegistryChainId ?? ''),
        'data-initial-session-id': String(props.initialSessionId || ''),
        'data-initial-sponsored-bundle-id': String(props.initialSponsoredBundleId || ''),
        'data-initial-sponsored-bundle-key': String(props.initialSponsoredBundleKey || ''),
        'data-network-id': String(props.network?.id || ''),
      });
    },
  };
});

jest.mock('../SurveyTool/SurveyPage', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockSurveyPage(props);
      return React.createElement('div', {
        'data-testid': 'mock-survey-page',
        'data-active-session-slug': String(props.activeSessionSlug || ''),
        'data-network-id': String(props.network?.id || ''),
        'data-survey-id': String(props.surveyID || ''),
      });
    },
  };
});

jest.mock('../DocumentLibrary/SessionDocumentsPage', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockSessionDocumentsPage(props);
      return React.createElement('div', {
        'data-testid': 'mock-session-docs-page',
        'data-session-id-hex': String(props.sessionIdHex || ''),
        'data-session-slug': String(props.sessionSlug || ''),
        'data-session-token': String(props.sessionToken || ''),
      });
    },
  };
});

jest.mock('../OnePageSession/OnePageSession', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockOnePageSession(props);
      return React.createElement('div', {
        'data-testid': 'mock-one-page-demo',
        'data-session-name': String(props.sessionName || ''),
        'data-session-info': String(props.sessionInfo || ''),
        'data-session-slug': String(props.slug || ''),
        'data-question-session-slug': String(props.questionSessionSlug || ''),
      });
    },
  };
});

jest.mock('../SBTs/SBTPage', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockSBTPage(props);
      return React.createElement('div', {
        'data-testid': 'mock-sbt-page',
        'data-session-slug': String(props.sessionSlug || ''),
        'data-network-id': String(props.network?.id || ''),
        'data-sbt-address': String(props.SBTAddress || ''),
      });
    },
  };
});

jest.mock('../SBTs/SBTsList', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockSBTsPage(props);
      return React.createElement('div', {
        'data-testid': 'mock-sbts-page',
        'data-network-id': String(props.network?.id || ''),
        'data-session-slug': String(props.sessionSlug || ''),
        'data-all-sessions-mode': String(props.allSessionsMode === true),
      });
    },
  };
});

jest.mock('../UserPage/CompareAddresses', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockCompareAddresses(props);
      return React.createElement('div', {
        'data-testid': 'mock-compare-addresses',
        'data-first-address': String(props.firstAddress || ''),
      });
    },
  };
});

jest.mock('../TagPage/TagPage', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockTagPage(props);
      return React.createElement('div', {
        'data-testid': 'mock-tag-page',
        'data-active-session-slug': String(props.activeSessionSlug || ''),
        'data-network-id': String(props.network?.id || ''),
        'data-path': String(props.path || ''),
      });
    },
  };
});

jest.mock('../DebateMap/DebateMap', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockDebateMap(props);
      return React.createElement('div', {
        'data-testid': 'mock-debate-map',
        'data-demo-mode': typeof props.demoMode === 'undefined' ? '' : String(props.demoMode),
      });
    },
  };
});

jest.mock('../../utilities/web3/contractScripts.js', () => {
  const contractScripts = {
    decryptQuestionPayloadInPlace: jest.fn(),
    getAllSbtAddressesCached: jest.fn(),
    getLatestBlockNumber: jest.fn(),
    getQuestionData: jest.fn(),
    getReadProviderForSession: jest.fn(),
    getResponse: jest.fn(),
    getRelevantBlockWindowForFilter: jest.fn(),
    getSbtCreationBlockByAddress: jest.fn(),
    getSbtHistorySummary: jest.fn(),
    getSbtMintBurnCountsByAddress: jest.fn(),
    getSbtMetadata: jest.fn(),
    getSBTsForUser: jest.fn(),
    getSurveyDataById: jest.fn(),
    getSurveyHash: jest.fn(),
    getSurveyResponse: jest.fn(),
    getUserActivity: jest.fn(),
    listenForSBTEvents: jest.fn(),
    listenForSBTInstanceEvents: jest.fn(),
    listenForSurveyEvents: jest.fn(),
    removeSBTEventListener: jest.fn(),
    removeSBTInstanceEventsListener: jest.fn(),
    removeSurveyEventsListener: jest.fn(),
    sendTestnetFunds: jest.fn(),
  };
  return {
    __esModule: true,
    default: contractScripts,
    getAllSessionSlugs: jest.fn(() => []),
    getDemoSessionConfigBySlug: jest.fn(() => null),
    getSessionConfigBySlug: jest.fn(() => null),
    getSessionConfigBySlugOrDefault: jest.fn(() => ({})),
    getSessionSlugByName: jest.fn(() => ''),
    getSessionChainId: jest.fn(() => null),
    getSessionNetwork: jest.fn(() => null),
    getReadProviderForSession: jest.fn(() => null),
    normalizeSessionSlug: jest.fn((value = '') => String(value || '').trim().toLowerCase()),
  };
});

jest.mock('../../utilities/ui/uiRuntimeStats.js', () => ({
  __esModule: true,
  recordCeRuntimeCacheEvent: jest.fn(),
  shouldAutoStartCeRuntimeStats: jest.fn(() => false),
  startCeRuntimeStats: jest.fn(),
  stopCeRuntimeStats: jest.fn(),
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  __esModule: true,
  createLitHooks: jest.fn(() => ({})),
  attachLitDevTools: jest.fn(),
  getGlobalLitHooks: jest.fn(() => null),
  setGlobalLitHooks: jest.fn(),
}));

jest.mock('../../utilities/arweave/arweaveUrls.js', () => ({
  __esModule: true,
  normalizeArweaveUrl: jest.fn((value = '') => String(value || '').trim()),
}));

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  __esModule: true,
  initCacheManager: jest.fn(() => Promise.resolve()),
  subscribeCacheUpdates: jest.fn(() => jest.fn()),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => {
  const readCache = () => {
    try {
      return JSON.parse(globalThis.localStorage?.getItem('dg:sessionRegistryCache:v1') || '{}');
    } catch (_) {
      return {};
    }
  };
  return {
    __esModule: true,
    SESSION_REGISTRY_CACHE_UPDATED_EVENT: 'ce:session-registry-cache-updated',
    fetchSessionFromRegistry: jest.fn(),
    loadGroupRegistryCache: jest.fn(),
    sessionRegistryStore: {
      getSessionConfig: jest.fn((slug) => {
        const cache = readCache();
        return cache?.sessions?.[slug] || null;
      }),
      getSessionConfigById: jest.fn((sessionId) => {
        const cache = readCache();
        return cache?.sessionsById?.[sessionId] || null;
      }),
      getAllSessionEntries: jest.fn(() => {
        const cache = readCache();
        return Object.entries(cache?.sessions || {});
      }),
    },
    sessionRegistryUtils: {
      formatSessionId: jest.fn((value = '') => String(value || '').trim()),
      normalizeSessionIdHex: jest.fn((value = '') => String(value || '').trim()),
    },
    upsertSessionRegistryCache: jest.fn(),
  };
});

const DEFAULT_NETWORK = {
  id: 84532,
  chainId: 84532,
  name: 'Base Sepolia',
};

const SESSION_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const buildProps = (overrides = {}) => ({
  fetchSessionState: jest.fn(),
  fetchAccount: jest.fn(),
  changeAccount: jest.fn(),
  changeFocusedTab: jest.fn(),
  toggleLoginModal: jest.fn(),
  updateLoginInfo: jest.fn(),
  toggleDemoMode: jest.fn(),
  demoMode: { tools: false },
  demoSurfaceMode: true,
  changeActiveSessionSlug: jest.fn(),
  network: DEFAULT_NETWORK,
  ...overrides,
});

const buildSessionConfig = (overrides = {}) => ({
  slug: 'edge',
  sessionName: 'Edge Session',
  sessionInfo: 'Edge session info',
  sessionHeader: 'https://example.com/edge-session.png',
  contracts: {},
  blockLimits: { start: null, end: null },
  defaultFeaturedSBTs: [],
  networkChainId: 84532,
  __registry: {
    sessionIdHex: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
  ...overrides,
});

const setRoute = (path, search = '') => {
  window.history.pushState({}, '', `${path}${search}`);
};

const seedSessionRegistryCache = (sessionConfig) => {
  localStorage.setItem('dg:sessionRegistryCache:v1', JSON.stringify({
    ts: Date.now(),
    chains: {},
    sessions: {
      [sessionConfig.slug]: sessionConfig,
    },
    groups: {
      [sessionConfig.slug]: sessionConfig,
    },
    sessionsById: {
      [sessionConfig.__registry.sessionIdHex]: sessionConfig,
      [SESSION_ID]: sessionConfig,
    },
  }));
};

const syncSessionRegistryStoreMocks = () => {
  sessionRegistryStore.getSessionConfig.mockImplementation((slug) => {
    try {
      const cache = JSON.parse(localStorage.getItem('dg:sessionRegistryCache:v1') || '{}');
      return cache?.sessions?.[slug] || null;
    } catch (_) {
      return null;
    }
  });
  sessionRegistryStore.getSessionConfigById.mockImplementation((sessionId) => {
    try {
      const cache = JSON.parse(localStorage.getItem('dg:sessionRegistryCache:v1') || '{}');
      return cache?.sessionsById?.[sessionId] || null;
    } catch (_) {
      return null;
    }
  });
  sessionRegistryStore.getAllSessionEntries.mockImplementation(() => {
    try {
      const cache = JSON.parse(localStorage.getItem('dg:sessionRegistryCache:v1') || '{}');
      return Object.entries(cache?.sessions || {});
    } catch (_) {
      return [];
    }
  });
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

const createSubject = ({
  path = '/',
  search = '',
  activeSessionSlug = 'edge',
  demoSurfaceMode = true,
  firstVisit = false,
  sessionConfig = null,
} = {}) => {
  setRoute(path, search);
  getSessionConfigBySlug.mockImplementation((slug) => {
    if (!sessionConfig) return null;
    return slug === sessionConfig.slug ? sessionConfig : null;
  });

  const subject = new MainSite(buildProps({
    path,
    firstVisit,
    demoSurfaceMode,
    sessionState: {
      primarySessionSlug: activeSessionSlug,
      primarySessionExplicit: true,
    },
  }));
  subject.state = {
    ...subject.state,
    isCacheManagerReady: true,
    cacheHasLoaded: true,
    isAllCachesReady: true,
    isSurveyCacheReady: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    isSBTCacheReady: true,
  };
  subject.setState = jest.fn((next) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    subject.state = { ...subject.state, ...(patch || {}) };
    return patch;
  });
  sessionRegistryStore.getSessionConfigById.mockImplementation((sessionId) => {
    if (!sessionConfig) return null;
    if (
      sessionId === SESSION_ID ||
      sessionId === sessionConfig.__registry?.sessionIdHex
    ) {
      return sessionConfig;
    }
    try {
      const cache = JSON.parse(localStorage.getItem('dg:sessionRegistryCache:v1') || '{}');
      return cache?.sessionsById?.[sessionId] || null;
    } catch (_) {
      return null;
    }
  });
  subject.getActiveSessionSlug = jest.fn(() => activeSessionSlug);
  subject.getSessionNetwork = jest.fn(() => DEFAULT_NETWORK);
  subject.getSessionChainId = jest.fn(() => DEFAULT_NETWORK.id);
  subject.getSessionCfg = jest.fn((slug) => {
    if (sessionConfig && slug === sessionConfig.slug) return sessionConfig;
    return sessionConfig || {};
  });
  subject.resolveSessionSlugFromPathToken = jest.fn((sessionToken) => {
    if (!sessionConfig) return String(sessionToken || '').trim();
    if (
      sessionToken === SESSION_ID ||
      sessionToken === sessionConfig.__registry?.sessionIdHex
    ) {
      return sessionConfig.slug;
    }
    return String(sessionToken || '').trim();
  });
  subject.getSessionInfoForGroup = jest.fn((cfg) => cfg?.sessionInfo || 'Edge session info');
  subject.getSessionNameForGroup = jest.fn((cfg) => cfg?.sessionName || 'Edge Session');
  subject.getSessionHeaderForGroup = jest.fn((cfg) => cfg?.sessionHeader || 'https://example.com/edge-session.png');
  subject.refreshSbtData = jest.fn();
  subject.refreshSurveyResponsesByID = jest.fn();
  subject.refreshSurveyResponsesByIDForGroup = jest.fn();
  subject.refreshQuestionMetadata = jest.fn();
  subject.refreshQuestionMetadataForGroup = jest.fn();
  subject.refreshQuestionResponses = jest.fn();
  subject.scanForSurveyGroup = jest.fn();
  subject.readFlag = jest.fn(() => false);
  subject.DG = {
    read: jest.fn(() => null),
    write: jest.fn(),
    remove: jest.fn(),
  };
  return subject;
};

const stubMainSiteMountSideEffects = (subject) => {
  subject.applySessionFallbackRedirect = jest.fn(() => null);
  subject.syncSessionFallbackRedirectConsumption = jest.fn();
  subject.manageAutoHashPersistence = jest.fn();
  subject.getDisplaySessionChainId = jest.fn(() => DEFAULT_NETWORK.id);
  subject.getDisplaySessionNetwork = jest.fn(() => DEFAULT_NETWORK);
  subject.resolveSessionPathSlug = jest.fn();
  subject.syncLitHooks = jest.fn();
  subject.refreshSessionInfo = jest.fn();
  subject.refreshSessionMetaFields = jest.fn();
  subject.refreshGroupCredentials = jest.fn();
  subject.hasPersistedManagedCacheData = jest.fn(async () => false);
  subject.syncCacheHasLoadedFlagFromPersistent = jest.fn(async () => undefined);
  subject.syncCacheHasLoadedFlagOnTransition = jest.fn(async () => undefined);
  subject.getSessionNetwork = jest.fn(() => null);
  subject.getInitializableSessionNetwork = jest.fn(() => null);
  subject.setReadinessStateIfChanged = jest.fn((patch) => {
    subject.state = { ...subject.state, ...(patch || {}) };
  });
  subject.checkAllCachesReady = jest.fn();
  subject.handleDeepLinkScan = jest.fn();
  return subject;
};

const attachDgStore = (subject, initial = {}) => {
  const store = new Map(Object.entries(initial));
  const key = (name, slug) => `${name}:${slug || ''}`;
  subject.DG = {
    read: jest.fn((name, slug) => store.get(key(name, slug)) || null),
    write: jest.fn((name, slug, value) => {
      store.set(key(name, slug), value);
      return value;
    }),
    remove: jest.fn((name, slug) => {
      store.delete(key(name, slug));
    }),
    key: jest.fn(key),
  };
  return {
    store,
    read: (name, slug) => store.get(key(name, slug)) || null,
    write: (name, slug, value) => {
      store.set(key(name, slug), value);
      return value;
    },
  };
};

describe('MainSite connected export wiring', () => {
  it('wires changeAccount into the connected MainSite export for wagmi hydration', () => {
    expect(mainSiteDispatchActions).toEqual(expect.objectContaining({
      changeAccount: expect.any(Function),
      updateLoginInfo: expect.any(Function),
    }));
  });
});

describe('MainSite route render smoke', () => {
  const originalPublicUrl = process.env.PUBLIC_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    initCacheManager.mockResolvedValue(undefined);
    getSessionConfigBySlug.mockImplementation(() => null);
    normalizeSessionSlug.mockImplementation((value = '') => String(value || '').trim().toLowerCase());
    localStorage.clear();
    syncSessionRegistryStoreMocks();
    if (originalPublicUrl === undefined) {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
    restoreSessionScanGlobals();
    window.history.replaceState({}, '', '/');
    window.sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    initCacheManager.mockResolvedValue(undefined);
    getSessionConfigBySlug.mockImplementation(() => null);
    normalizeSessionSlug.mockImplementation((value = '') => String(value || '').trim().toLowerCase());
    localStorage.clear();
    syncSessionRegistryStoreMocks();
    if (originalPublicUrl === undefined) {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
    restoreSessionScanGlobals();
    window.history.replaceState({}, '', '/');
    window.sessionStorage.clear();
  });

  it('seeds built-in demo questions into canonical live-result buckets without scanning blocks', () => {
    const subject = createSubject({
      path: '/session/demo',
      activeSessionSlug: 'demo',
      sessionConfig: {
        slug: 'demo',
        sessionName: 'Context Engine',
        networkChainId: 11155420,
      },
    });
    const cacheStore = {};
    subject.DG = {
      read: jest.fn((name, slug) => cacheStore[`${name}:${slug}`] || null),
      write: jest.fn((name, slug, value) => {
        cacheStore[`${name}:${slug}`] = value;
      }),
      remove: jest.fn(),
    };
    subject.getDisplaySessionChainId = jest.fn(() => 11155420);
    subject.setReadinessStateIfChanged = jest.fn((patch) => {
      subject.state = { ...subject.state, ...(patch || {}) };
    });
    subject.checkAllCachesReady = jest.fn();

    const demoQuestions = getPolisDemoQuestionPool();
    const firstQuestion = demoQuestions[0];
    expect(firstQuestion?.id).toBeTruthy();

    expect(subject.seedBuiltInDemoQuestionCache()).toBe(true);

    const generalQuestions =
      cacheStore['questionsCache:']?.['11155420']?.questions || {};
    const scopedQuestions =
      cacheStore['questionsCache:demo']?.['11155420']?.questions || {};
    expect(Object.keys(generalQuestions)).toHaveLength(demoQuestions.length);
    expect(Object.keys(scopedQuestions)).toHaveLength(demoQuestions.length);
    expect(generalQuestions[firstQuestion.id]).toEqual(expect.objectContaining({
      id: firstQuestion.id,
      prompt: firstQuestion.prompt,
      sessionSlug: '',
    }));
    expect(scopedQuestions[firstQuestion.id]).toEqual(expect.objectContaining({
      id: firstQuestion.id,
      prompt: firstQuestion.prompt,
      sessionSlug: 'demo',
    }));
    expect(subject.setReadinessStateIfChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        isQuestionCacheReady: true,
        questionScanProgress: null,
      }),
      expect.any(Function)
    );
  });

  it('short-circuits built-in demo question initialization to the canonical seed', async () => {
    const subject = createSubject({
      path: '/session/demo',
      activeSessionSlug: 'demo',
      sessionConfig: {
        slug: 'demo',
        sessionName: 'Context Engine',
        networkChainId: 11155420,
      },
    });
    subject.isBuiltInDemoSessionRoutePath = jest.fn(() => true);
    subject.seedBuiltInDemoQuestionCache = jest.fn(() => true);
    subject._questionCacheController.initializeQuestionCacheForGroup = jest.fn();

    await subject.initializeQuestionCacheForGroup('demo');

    expect(subject.seedBuiltInDemoQuestionCache).toHaveBeenCalledTimes(1);
    expect(subject._questionCacheController.initializeQuestionCacheForGroup).not.toHaveBeenCalled();
  });

  it('renders the wizard root for /new, canonicalizes the alias, and forwards query params', async () => {
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    const subject = createSubject({
      path: '/new',
      search: '?sessionId=edge-session-id&chainId=chain-84532&sponsored=sponsor-tx-id',
    });
    window.history.replaceState({}, '', '/new?sessionId=edge-session-id&chainId=chain-84532&sponsored=sponsor-tx-id#k=sponsor-secret');

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_WIZARD_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-session-wizard')).toHaveAttribute('data-active-session-slug', 'edge');
    expect(screen.getByTestId('mock-session-wizard')).toHaveAttribute('data-initial-session-id', 'edge-session-id');
    expect(screen.getByTestId('mock-session-wizard')).toHaveAttribute('data-initial-registry-chain-id', '84532');
    expect(screen.getByTestId('mock-session-wizard')).toHaveAttribute('data-initial-sponsored-bundle-id', 'sponsor-tx-id');
    expect(screen.getByTestId('mock-session-wizard')).toHaveAttribute('data-initial-sponsored-bundle-key', 'sponsor-secret');
    expect(screen.getByTestId('mock-session-wizard')).toHaveAttribute('data-network-id', '84532');
    expect(mockSessionWizard.mock.calls[mockSessionWizard.mock.calls.length - 1][0]?.ensureLightSbtUniverse)
      .toBe(subject.ensureLightSbtUniverse);
    expect(replaceStateSpy).toHaveBeenCalledWith(
      {},
      '',
      '/session/new?sessionId=edge-session-id&chainId=chain-84532&sponsored=sponsor-tx-id#k=sponsor-secret'
    );
  });

  it('renders the admin root and forwards session query params to AdminPage', async () => {
    const subject = createSubject({
      path: '/admin',
      search: '?sessionID=edge-session-id&chainId=registry-84532',
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_ADMIN_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-admin-page')).toHaveAttribute('data-initial-session-id', 'edge-session-id');
    expect(screen.getByTestId('mock-admin-page')).toHaveAttribute('data-initial-registry-chain-id', '84532');
    expect(screen.getByTestId('mock-admin-page')).toHaveAttribute('data-network-id', '84532');
    expect(mockAdminPage.mock.calls[mockAdminPage.mock.calls.length - 1][0]?.ensureLightSbtUniverse)
      .toBe(subject.ensureLightSbtUniverse);
  });

  it('prefers the live browser pathname when the path prop is stale after a direct history rewrite', async () => {
    const sessionConfig = buildSessionConfig({
      slug: 'demo',
      sessionName: 'Demo Session',
    });
    const subject = createSubject({
      path: '/',
      activeSessionSlug: 'demo',
      sessionConfig,
    });
    window.history.replaceState({}, '', '/session/demo');

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-one-page-demo')).toHaveAttribute('data-session-slug', 'demo');
    expect(screen.getByTestId('mock-one-page-demo')).toHaveAttribute('data-question-session-slug', 'demo');
  });

  it('redirects a first-visit root load to the about page', async () => {
    const subject = createSubject({
      path: '/',
      firstVisit: true,
    });
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    subject.applySessionFallbackRedirect = jest.fn(() => null);
    subject.syncSessionFallbackRedirectConsumption = jest.fn();
    subject.manageAutoHashPersistence = jest.fn();
    subject.getDisplaySessionChainId = jest.fn(() => DEFAULT_NETWORK.id);
    subject.getDisplaySessionNetwork = jest.fn(() => DEFAULT_NETWORK);
    subject.resolveSessionPathSlug = jest.fn();
    subject.syncLitHooks = jest.fn();
    subject.refreshSessionInfo = jest.fn();
    subject.refreshSessionMetaFields = jest.fn();
    subject.refreshGroupCredentials = jest.fn();
    subject.hasPersistedManagedCacheData = jest.fn(async () => false);
    subject.syncCacheHasLoadedFlagFromPersistent = jest.fn(async () => undefined);
    subject.syncCacheHasLoadedFlagOnTransition = jest.fn(async () => undefined);
    subject.getSessionNetwork = jest.fn(() => null);
    subject.setReadinessStateIfChanged = jest.fn((patch) => {
      subject.state = { ...subject.state, ...(patch || {}) };
    });
    subject.checkAllCachesReady = jest.fn();
    subject.handleDeepLinkScan = jest.fn();

    await act(async () => {
      await subject.componentDidMount();
    });

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/about');
    expect(window.location.pathname).toBe('/about');

    render(
      <MemoryRouter initialEntries={['/about']}>
        {subject.render()}
      </MemoryRouter>
    );

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_ABOUT_ROOT)).toBeInTheDocument();
    subject.componentWillUnmount();
  });

  it('redirects a cached root load to the about page', async () => {
    localStorage.setItem(FIRST_VISIT_STORAGE_KEY, 'false');
    const subject = stubMainSiteMountSideEffects(createSubject({
      path: '/',
      firstVisit: false,
    }));
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    await act(async () => {
      await subject.componentDidMount();
    });

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/about');
    expect(window.location.pathname).toBe('/about');
    expect(localStorage.getItem(FIRST_VISIT_STORAGE_KEY)).toBe('false');
    subject.componentWillUnmount();
  });

  it('redirects a root refresh to about even after the old one-time toggle is consumed', async () => {
    localStorage.setItem(FIRST_VISIT_STORAGE_KEY, 'false');
    localStorage.setItem(FIRST_VISIT_ROOT_REDIRECT_CONSUMED_STORAGE_KEY, 'true');
    const subject = stubMainSiteMountSideEffects(createSubject({
      path: '/',
      firstVisit: false,
    }));
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    await act(async () => {
      await subject.componentDidMount();
    });

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/about');
    expect(window.location.pathname).toBe('/about');
    subject.componentWillUnmount();
  });

  it('temporarily redirects cached session page refreshes to the about page', async () => {
    const subject = stubMainSiteMountSideEffects(createSubject({
      path: '/session/demo-1',
      firstVisit: false,
    }));
    subject.hasPersistedManagedCacheData = jest.fn(async (slug) => slug === 'demo-1');
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    await act(async () => {
      await subject.componentDidMount();
    });

    expect(subject.hasPersistedManagedCacheData).toHaveBeenCalledWith('demo-1');
    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/about');
    expect(window.location.pathname).toBe('/about');
    subject.componentWillUnmount();
  });

  it('does not redirect first-time direct session loads without persisted session cache', async () => {
    const subject = stubMainSiteMountSideEffects(createSubject({
      path: '/session/demo-1',
      firstVisit: true,
    }));
    subject.hasPersistedManagedCacheData = jest.fn(async () => false);
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    await act(async () => {
      await subject.componentDidMount();
    });

    expect(subject.hasPersistedManagedCacheData).toHaveBeenCalledWith('demo-1');
    expect(replaceStateSpy).not.toHaveBeenCalledWith({}, '', '/about');
    expect(window.location.pathname).toBe('/session/demo-1');
    subject.componentWillUnmount();
  });

  it('redirects a first-visit root load to the about page', async () => {
    const subject = createSubject({
      path: '/',
      firstVisit: true,
    });
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    subject.applySessionFallbackRedirect = jest.fn(() => null);
    subject.syncSessionFallbackRedirectConsumption = jest.fn();
    subject.manageAutoHashPersistence = jest.fn();
    subject.getDisplaySessionChainId = jest.fn(() => DEFAULT_NETWORK.id);
    subject.getDisplaySessionNetwork = jest.fn(() => DEFAULT_NETWORK);
    subject.resolveSessionPathSlug = jest.fn();
    subject.syncLitHooks = jest.fn();
    subject.refreshSessionInfo = jest.fn();
    subject.refreshSessionMetaFields = jest.fn();
    subject.refreshGroupCredentials = jest.fn();
    subject.hasPersistedManagedCacheData = jest.fn(async () => false);
    subject.syncCacheHasLoadedFlagFromPersistent = jest.fn(async () => undefined);
    subject.syncCacheHasLoadedFlagOnTransition = jest.fn(async () => undefined);
    subject.getSessionNetwork = jest.fn(() => null);
    subject.setReadinessStateIfChanged = jest.fn((patch) => {
      subject.state = { ...subject.state, ...(patch || {}) };
    });
    subject.checkAllCachesReady = jest.fn();
    subject.handleDeepLinkScan = jest.fn();

    await act(async () => {
      await subject.componentDidMount();
    });

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/about');
    expect(window.location.pathname).toBe('/about');

    render(
      <MemoryRouter initialEntries={['/about']}>
        {subject.render()}
      </MemoryRouter>
    );

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_ABOUT_ROOT)).toBeInTheDocument();
    subject.componentWillUnmount();
  });

  it('does not restore the mount session after navigating during cache initialization', async () => {
    const deferredCacheInit = createDeferred();
    initCacheManager.mockReturnValueOnce(deferredCacheInit.promise);
    const props = buildProps({
      path: '/session/edge',
      sessionState: {
        primarySessionSlug: 'edge',
        primarySessionExplicit: true,
      },
    });
    setRoute('/session/edge');
    const subject = new MainSite(props);
    subject.setState = jest.fn((next) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      return patch;
    });
    subject.applySessionFallbackRedirect = jest.fn(() => null);
    subject.syncSessionFallbackRedirectConsumption = jest.fn();
    subject.manageAutoHashPersistence = jest.fn();
    subject.getDisplaySessionChainId = jest.fn(() => DEFAULT_NETWORK.id);
    subject.getDisplaySessionNetwork = jest.fn(() => DEFAULT_NETWORK);
    subject.resolveSessionPathSlug = jest.fn();
    subject.syncLitHooks = jest.fn();
    subject.refreshSessionInfo = jest.fn();
    subject.refreshSessionMetaFields = jest.fn();
    subject.refreshGroupCredentials = jest.fn();
    subject.hasPersistedManagedCacheData = jest.fn(async () => false);
    subject.syncCacheHasLoadedFlagOnTransition = jest.fn(async () => undefined);
    subject.getSessionNetwork = jest.fn(() => null);
    subject.setReadinessStateIfChanged = jest.fn((patch) => {
      subject.state = { ...subject.state, ...(patch || {}) };
    });
    subject.checkAllCachesReady = jest.fn();
    subject.handleDeepLinkScan = jest.fn();

    const mountPromise = subject.componentDidMount();
    await Promise.resolve();

    setRoute('/session/alpha');
    await act(async () => {
      deferredCacheInit.resolve();
      await mountPromise;
    });

    expect(props.changeActiveSessionSlug).not.toHaveBeenCalledWith('edge');
    expect(props.changeActiveSessionSlug).not.toHaveBeenCalled();
  });

  it('routes survey listener events through the MainSite survey controller host', () => {
    const subject = createSubject({
      path: '/surveys',
      activeSessionSlug: 'edge',
    });
    subject.onNewSurveyEventDetectedForGroup = jest.fn();

    expect(subject.startSurveyAndQuestionEventListenerForGroup('edge')).toBe(true);

    expect(contractScripts.removeSurveyEventsListener).toHaveBeenCalledWith('none', 'edge');
    expect(contractScripts.listenForSurveyEvents).toHaveBeenCalledWith(
      'none',
      expect.any(Function),
      'edge'
    );

    const handler = contractScripts.listenForSurveyEvents.mock.calls[0][1];
    const event = { type: 'SurveyCreated', surveyId: '0xsurvey' };
    handler(event);

    expect(subject.onNewSurveyEventDetectedForGroup).toHaveBeenCalledWith('edge', event);
  });

  it('redirects a general route to the first list-scoped session once and consumes the redirect', async () => {
    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = [' Edge ', 'alpha'];

    const sessionConfig = buildSessionConfig({
      slug: 'edge',
      sessionName: 'Edge Session',
    });
    const subject = createSubject({
      path: '/session/general',
      activeSessionSlug: 'edge',
      sessionConfig,
    });
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    expect(subject.getSessionFallbackPreferredTarget()).toEqual({
      slug: 'edge',
      path: '/session/edge',
    });

    const firstRender = render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-one-page-demo')).toHaveAttribute('data-session-slug', 'edge');
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/session/edge');
    expect(window.location.pathname).toBe('/session/edge');

    const storageKey = subject.getSessionFallbackRedirectStorageKey('edge');
    expect(window.sessionStorage.getItem(storageKey)).toBe('true');

    firstRender.unmount();
    replaceStateSpy.mockClear();

    const secondSubject = createSubject({
      path: '/session/general',
      activeSessionSlug: 'edge',
      sessionConfig,
    });

    render(secondSubject.render());

    expect(window.location.pathname).toBe('/session/general');
    expect(window.sessionStorage.getItem(storageKey)).toBe('true');
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('keeps PUBLIC_URL when canonicalizing /new to /session/new', async () => {
    // Synthetic subpath fixture: current deploys use '/', but we intentionally
    // keep this coverage so optional subpath hosting keeps working.
    process.env.PUBLIC_URL = '/ce/';
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    const subject = createSubject({
      path: '/new',
      search: '?sessionId=edge-session-id',
    });
    window.history.replaceState({}, '', '/ce/new?sessionId=edge-session-id#k=sponsor-secret');

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_WIZARD_ROOT)).toBeInTheDocument();
    expect(replaceStateSpy).toHaveBeenCalledWith(
      {},
      '',
      '/ce/session/new?sessionId=edge-session-id#k=sponsor-secret'
    );
  });

  it('renders the sponsor root and forwards session query params to SponsorPage', async () => {
    const subject = createSubject({
      path: '/sponsor',
      search: '?sessionID=edge-session-id&chainId=registry-84532',
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SPONSOR_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-sponsor-page')).toHaveAttribute('data-initial-session-id', 'edge-session-id');
    expect(screen.getByTestId('mock-sponsor-page')).toHaveAttribute('data-initial-registry-chain-id', '84532');
    expect(screen.getByTestId('mock-sponsor-page')).toHaveAttribute('data-network-id', '84532');
  });

  it('does not expose the private Telegram demo setup route', async () => {
    const subject = createSubject({
      path: '/telegram-demo-setup',
      activeSessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      isCacheManagerReady: false,
      cacheHasLoaded: false,
      isAllCachesReady: false,
    };

    render(subject.render());

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText(/This URL is not part of the supported public surface/i)).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Path: /telegram-demo-setup')).toBeInTheDocument();
  });

  it.each([
    ['/debate', /Debate view is not part of the supported public surface yet\./i],
  ])('renders the experimental stub for %s without waiting for cache bootstrap', async (path, descriptionMatcher) => {
    const subject = createSubject({ path });
    subject.state = {
      ...subject.state,
      isCacheManagerReady: false,
      cacheHasLoaded: false,
      isAllCachesReady: false,
      isSurveyCacheReady: false,
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      isSBTCacheReady: false,
    };

    render(subject.render());

    expect(await screen.findByRole('heading', { name: /this feature is in development/i })).toBeInTheDocument();
    expect(screen.getByText(descriptionMatcher)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });

  it('renders the tag page route without waiting for cache bootstrap', async () => {
    const subject = createSubject({ path: '/tag/governance+ai' });
    subject.state = {
      ...subject.state,
      isCacheManagerReady: false,
      cacheHasLoaded: false,
      isAllCachesReady: false,
      isSurveyCacheReady: false,
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      isSBTCacheReady: false,
    };

    render(subject.render());

    expect(await screen.findByTestId('mock-tag-page')).toHaveAttribute('data-path', '/tag/governance+ai');
    expect(screen.getByTestId('mock-tag-page')).toHaveAttribute('data-active-session-slug', 'edge');
    expect(screen.getByTestId('mock-tag-page')).toHaveAttribute('data-network-id', '84532');
  });

  it('renders a clean 404 for unsupported routes without waiting for cache bootstrap', async () => {
    const path = '/not-a-supported-route';
    const subject = createSubject({ path });
    subject.state = {
      ...subject.state,
      isCacheManagerReady: false,
      cacheHasLoaded: false,
      isAllCachesReady: false,
      isSurveyCacheReady: false,
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      isSBTCacheReady: false,
    };

    render(subject.render());

    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByText(/not part of the supported public surface/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });

  it.each(['/sessionevil', '/sessions'])('renders a clean 404 for invalid session prefix %s', async (path) => {
    const subject = createSubject({ path });

    render(subject.render());

    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).not.toBeInTheDocument();
    expect(mockOnePageSession).not.toHaveBeenCalled();
  });

  it.each(['/atlas-old', '/surveys-old', '/questions-old', '/foo/question/abc'])(
    'renders a clean 404 for invalid lookalike route %s',
    async (path) => {
      const subject = createSubject({ path });

      render(subject.render());

      expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.PAGE_ATLAS_ROOT)).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.PAGE_SURVEYS_ROOT)).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.PAGE_QUESTIONS_ROOT)).not.toBeInTheDocument();
      expect(mockSurveyPage).not.toHaveBeenCalled();
    }
  );

  it.each(['/compare', '/compare/'])('renders the compare route root for %s', async (path) => {
    const subject = createSubject({ path });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_COMPARE_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-compare-addresses')).toHaveAttribute('data-first-address', '');
  });

  it('switches page roots cleanly when navigating between surveys and questions routes', async () => {
    const { rerender } = render(createSubject({ path: '/surveys' }).render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SURVEYS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-survey-page')).toHaveAttribute('data-active-session-slug', 'edge');
    expect(screen.getByTestId('mock-survey-page')).toHaveAttribute('data-network-id', '84532');
    expect(screen.getByTestId('mock-survey-page')).toHaveAttribute('data-survey-id', '');

    rerender(createSubject({ path: '/questions' }).render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_QUESTIONS_ROOT)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.PAGE_SURVEYS_ROOT)).not.toBeInTheDocument();
  });

  it('keeps an explicit demo-only query session slug for survey route display context after cache bootstrap', async () => {
    const demoConfig = buildSessionConfig({
      slug: 'rxc',
      sessionName: 'Weyl v. Yarvin Debate',
      __registry: {},
    });
    const subject = createSubject({
      path: '/surveys',
      search: '?session=DEBATE',
      activeSessionSlug: 'edge',
      sessionConfig: null,
    });
    getDemoSessionConfigBySlug.mockImplementation((slug) => (
      slug === 'rxc' ? demoConfig : null
    ));

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SURVEYS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-survey-page')).toHaveAttribute('data-active-session-slug', 'edge');
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('DEBATE', { allowDemoFallback: true });
  });

  it('pins generic question results to the explicit query session slug and scopes refresh callbacks', async () => {
    const sessionConfig = buildSessionConfig();
    const subject = createSubject({
      path: '/questions/results',
      search: '?session=edge',
      activeSessionSlug: 'stale',
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_QUESTIONS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-survey-page')).toHaveAttribute('data-active-session-slug', 'edge');
    const latestProps = mockSurveyPage.mock.calls[mockSurveyPage.mock.calls.length - 1][0] || {};
    expect(latestProps.autoOpenResults).toBe(true);
    expect(latestProps.sessionSlug).toBe('edge');
    expect(latestProps.sessionSlugPinned).toBe(true);

    latestProps.refreshQuestionResponses(['q1']);
    expect(subject.refreshQuestionResponses).toHaveBeenCalledWith(['q1'], { slug: 'edge' });
  });

  it('refreshes both built-in demo question sources for direct demo results routes', async () => {
    const sessionConfig = buildSessionConfig({
      slug: 'demo',
      sessionName: 'Context Engine',
      __registry: {},
    });
    const subject = createSubject({
      path: '/questions/results',
      search: '?session=demo',
      activeSessionSlug: 'stale',
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_QUESTIONS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-survey-page')).toHaveAttribute('data-active-session-slug', 'demo');
    const latestProps = mockSurveyPage.mock.calls[mockSurveyPage.mock.calls.length - 1][0] || {};
    expect(latestProps.autoOpenResults).toBe(true);
    expect(latestProps.sessionSlug).toBe('demo');
    expect(latestProps.sessionSlugPinned).toBe(true);

    await latestProps.refreshQuestionMetadata({ reason: 'test' });
    await latestProps.refreshQuestionResponses(['q1']);
    await latestProps.refreshSurveyResponsesByID('survey-1');

    expect(subject.refreshQuestionMetadataForGroup).toHaveBeenCalledWith('demo', { reason: 'test' });
    expect(subject.refreshQuestionMetadataForGroup).toHaveBeenCalledWith('', { reason: 'test' });
    expect(subject.refreshQuestionResponses).toHaveBeenCalledWith(['q1'], { slug: 'demo' });
    expect(subject.refreshQuestionResponses).toHaveBeenCalledWith(['q1'], { slug: '' });
    expect(subject.refreshSurveyResponsesByIDForGroup).toHaveBeenCalledWith('demo', 'survey-1');
    expect(subject.refreshSurveyResponsesByIDForGroup).toHaveBeenCalledWith('', 'survey-1');
  });

  it('does not block direct demo question results on a stale inherited active session', async () => {
    const demoConfig = buildSessionConfig({
      slug: '',
      sessionName: 'Context Engine',
      networkChainId: 11155420,
      __registry: {},
    });
    const subject = createSubject({
      path: '/questions/results',
      search: '?session=demo',
      activeSessionSlug: 'stale',
      sessionConfig: null,
    });
    getDemoSessionConfigBySlug.mockImplementation((slug, opts = {}) => (
      slug === '' && opts?.allowDemoFallback === true ? demoConfig : null
    ));
    subject.getSessionCfg = jest.fn(() => null);
    subject.getSessionChainId = jest.fn(() => null);
    subject.getSessionNetwork = jest.fn(() => null);
    subject.resolveSessionPathSlug = jest.fn();
    subject._sessionPathResolver.getSlugStatus = jest.fn(() => ({
      hasAttempted: true,
      isPending: false,
      retryCount: 0,
      lastErrorTs: null,
    }));

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_QUESTIONS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-survey-page')).toHaveAttribute('data-active-session-slug', 'demo');
    const latestProps = mockSurveyPage.mock.calls[mockSurveyPage.mock.calls.length - 1][0] || {};
    expect(latestProps.autoOpenResults).toBe(true);
    expect(latestProps.sessionSlug).toBe('demo');
    expect(latestProps.sessionSlugPinned).toBe(true);
    expect(subject.resolveSessionPathSlug).not.toHaveBeenCalledWith('stale');
    expect(subject.resolveSessionPathSlug).toHaveBeenCalledWith('demo');
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('demo', { allowDemoFallback: true });
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('', { allowDemoFallback: true });
  });

  it('resolves direct demo question results before mounting display-only fallback contracts', async () => {
    const demoConfig = buildSessionConfig({
      slug: '',
      sessionName: 'Context Engine',
      networkChainId: 11155420,
      __registry: {},
    });
    const subject = createSubject({
      path: '/questions/results',
      search: '?session=demo',
      activeSessionSlug: 'stale',
      sessionConfig: null,
    });
    getDemoSessionConfigBySlug.mockImplementation((slug, opts = {}) => (
      slug === '' && opts?.allowDemoFallback === true ? demoConfig : null
    ));
    subject.getSessionCfg = jest.fn(() => null);
    subject.getSessionChainId = jest.fn(() => null);
    subject.getSessionNetwork = jest.fn(() => null);
    subject.resolveSessionPathSlug = jest.fn();

    render(subject.render());

    expect(mockSurveyPage).not.toHaveBeenCalled();
    expect(subject.resolveSessionPathSlug).toHaveBeenCalledWith('demo');
    expect(subject.resolveSessionPathSlug).not.toHaveBeenCalledWith('stale');
  });

  it('renders the session docs route with the resolved session config', async () => {
    const sessionConfig = buildSessionConfig();
    seedSessionRegistryCache(sessionConfig);
    const subject = createSubject({
      path: `/session/${SESSION_ID}/docs`,
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_DOCS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-session-docs-page')).toHaveAttribute('data-session-token', SESSION_ID);
    expect(screen.getByTestId('mock-session-docs-page')).toHaveAttribute('data-session-slug', 'edge');
    expect(screen.getByTestId('mock-session-docs-page')).toHaveAttribute(
      'data-session-id-hex',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
  });

  it('renders the session route with resolved session metadata', async () => {
    const sessionConfig = buildSessionConfig({
      sessionName: 'Signals Session',
      sessionInfo: 'Session detail copy',
      sessionHeader: 'https://example.com/signals-session.png',
    });
    seedSessionRegistryCache(sessionConfig);
    const subject = createSubject({
      path: `/session/${SESSION_ID}`,
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-one-page-demo')).toHaveAttribute('data-session-name', 'Signals Session');
    expect(screen.getByTestId('mock-one-page-demo')).toHaveAttribute('data-session-slug', 'edge');
    expect(mockOnePageSession.mock.calls[mockOnePageSession.mock.calls.length - 1][0]?.ensureLightSbtDiscovery).toBe(subject.ensureLightSbtDiscovery);
    expect(mockOnePageSession.mock.calls[mockOnePageSession.mock.calls.length - 1][0]?.ensureLightSbtUniverse).toBe(subject.ensureLightSbtUniverse);
  });

  it('prefers registry-backed slug session configs and forwards scoped Lit hooks', async () => {
    const litHooks = { saveKey: jest.fn(), getKey: jest.fn() };
    const sessionConfig = buildSessionConfig({
      slug: 'live-session',
      sessionName: 'Live Registry Session',
      networkChainId: 11155420,
      corsWorkerUrl: 'https://worker.example.test',
      __registry: {
        sessionIdHex: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            sbtAddresses: ['0x0000000000000000000000000000000000000101'],
            chainId: 11155420,
            mode: 'any',
          },
        },
      },
    });
    seedSessionRegistryCache(sessionConfig);
    sessionRegistryStore.getSessionConfig.mockImplementation((slug) => (
      slug === 'live-session' ? sessionConfig : null
    ));
    const subject = createSubject({
      path: '/session/live-session',
      activeSessionSlug: 'live-session',
      sessionConfig: null,
    });
    subject.state = {
      ...subject.state,
      litHooks,
    };

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-one-page-demo')).toHaveAttribute('data-session-name', 'Live Registry Session');
    const latestProps = mockOnePageSession.mock.calls[mockOnePageSession.mock.calls.length - 1][0] || {};
    expect(sessionRegistryStore.getSessionConfig).toHaveBeenCalledWith('live-session');
    expect(latestProps.sessionConfig).toEqual(expect.objectContaining({
      slug: 'live-session',
      corsWorkerUrl: 'https://worker.example.test',
    }));
    expect(latestProps.litHooks).toBe(litHooks);
  });

  it('matches PUBLIC_URL-prefixed session routes when the app is served from a subpath', async () => {
    // '/ce/' is a representative subpath fixture, not a special production-only
    // route. It guards the optional PUBLIC_URL deployment mode.
    process.env.PUBLIC_URL = '/ce/';
    const sessionConfig = buildSessionConfig({
      sessionName: 'Signals Session',
      sessionInfo: 'Session detail copy',
      sessionHeader: 'https://example.com/signals-session.png',
    });
    seedSessionRegistryCache(sessionConfig);
    const subject = createSubject({
      path: '/ce/session/edge',
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-one-page-demo')).toHaveAttribute('data-session-name', 'Signals Session');
    expect(screen.getByTestId('mock-one-page-demo')).toHaveAttribute('data-session-slug', 'edge');
  });

  it('resolves PUBLIC_URL-prefixed SBT detail paths during route reinitialization', () => {
    process.env.PUBLIC_URL = '/ce/';
    const sbtAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const subject = createSubject({ path: `/ce/group/${sbtAddress}` });

    expect(subject.getSbtAddressFromPath(`/ce/group/${sbtAddress}`)).toBe(sbtAddress);
  });

  it('renders the session route with explicit demo-session metadata when strict shared config misses', async () => {
    const demoConfig = buildSessionConfig({
      slug: 'rxc',
      sessionName: 'Weyl v. Yarvin Debate',
      sessionInfo: 'Debate session info',
      sessionHeader: 'https://example.com/rxc-session.png',
      __registry: {},
    });
    const subject = createSubject({
      path: '/session/rxc',
      activeSessionSlug: 'edge',
      sessionConfig: null,
    });
    getDemoSessionConfigBySlug.mockImplementation((slug) => (
      slug === 'rxc' ? demoConfig : null
    ));

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-one-page-demo')).toHaveAttribute('data-session-name', 'Weyl v. Yarvin Debate');
    expect(screen.getByTestId('mock-one-page-demo')).toHaveAttribute('data-session-slug', 'rxc');
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('rxc', { allowDemoFallback: true });
  });

  it('keeps /session/demo as a demo UI route while sourcing questions from the default bucket', async () => {
    const demoConfig = buildSessionConfig({
      slug: '',
      sessionName: 'Context Engine',
      sessionInfo: 'Default demo session info',
      __registry: undefined,
    });
    const subject = createSubject({
      path: '/session/demo',
      activeSessionSlug: 'demo',
      sessionConfig: null,
    });
    getDemoSessionConfigBySlug.mockImplementation((slug) => (
      slug === 'demo' || slug === '' ? demoConfig : null
    ));
    subject.resolveSessionPathSlug = jest.fn();

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-one-page-demo')).toHaveAttribute('data-session-slug', 'demo');
    expect(screen.getByTestId('mock-one-page-demo')).toHaveAttribute('data-question-session-slug', '');
    const latestProps = mockOnePageSession.mock.calls[mockOnePageSession.mock.calls.length - 1][0] || {};
    await latestProps.refreshQuestionMetadata({ reason: 'test' });
    await latestProps.refreshQuestionResponses(['q1']);
    await latestProps.refreshSurveyResponsesByID('survey-1');
    expect(subject.refreshQuestionMetadataForGroup).toHaveBeenCalledWith('', { reason: 'test' });
    expect(subject.refreshQuestionMetadataForGroup).toHaveBeenCalledWith('demo', { reason: 'test' });
    expect(subject.refreshQuestionResponses).toHaveBeenCalledWith(['q1'], { slug: '' });
    expect(subject.refreshQuestionResponses).toHaveBeenCalledWith(['q1'], { slug: 'demo' });
    expect(subject.refreshSurveyResponsesByIDForGroup).toHaveBeenCalledWith('', 'survey-1');
    expect(subject.refreshSurveyResponsesByIDForGroup).toHaveBeenCalledWith('demo', 'survey-1');
    expect(subject.resolveSessionPathSlug).toHaveBeenCalledWith('demo');
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('demo', { allowDemoFallback: true });
  });

  it('uses registry-backed /session/demo metadata instead of the placeholder display fallback', async () => {
    const registryConfig = buildSessionConfig({
      slug: 'demo',
      sessionName: 'demo',
      sessionInfo: 'Registry demo session info',
      sessionHeader: 'https://example.com/registry-demo-session.png',
      networkChainId: 11155420,
      __registry: {
        registryChainId: 11155420,
        sessionIdHex: '0xe2910e4d8ca642b0b952a20f1bcdf8be',
        metadataURI: 'ar://U95-Z7iN8UmWXWuqz_Zk_OwFiqqgjHmubhFuQ1XHG1U',
      },
    });
    const placeholderConfig = buildSessionConfig({
      slug: '',
      sessionName: 'Context Engine',
      sessionInfo: 'Default demo session info',
      __registry: undefined,
    });
    seedSessionRegistryCache(registryConfig);
    const subject = createSubject({
      path: '/session/demo',
      activeSessionSlug: 'demo',
      sessionConfig: null,
    });
    getDemoSessionConfigBySlug.mockImplementation((slug) => (
      slug === 'demo' ? placeholderConfig : null
    ));
    subject.resolveSessionPathSlug = jest.fn();

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-one-page-demo')).toHaveAttribute('data-session-name', 'demo');
    expect(screen.getByTestId('mock-one-page-demo')).toHaveAttribute('data-session-info', 'Registry demo session info');
    expect(screen.getByTestId('mock-one-page-demo')).toHaveAttribute('data-session-slug', 'demo');
    expect(screen.getByTestId('mock-one-page-demo')).toHaveAttribute('data-question-session-slug', 'demo');
    expect(subject.resolveSessionPathSlug).not.toHaveBeenCalled();
  });

  it('uses the default bucket for /session/demo cache bootstrap when only display fallback exists', () => {
    const demoConfig = buildSessionConfig({
      slug: '',
      sessionName: 'Context Engine',
      __registry: undefined,
    });
    const subject = createSubject({
      path: '/session/demo',
      activeSessionSlug: 'demo',
      sessionConfig: null,
    });
    getDemoSessionConfigBySlug.mockImplementation((slug) => (
      slug === 'demo' || slug === '' ? demoConfig : null
    ));

    expect(subject.getActiveSessionSourceSlug()).toBe('');
  });

  it('renders /session/demo from default fallback metadata when no registry session exists', async () => {
    const demoConfig = buildSessionConfig({
      slug: '',
      sessionName: 'Context Engine',
      __registry: undefined,
    });
    const subject = createSubject({
      path: '/session/demo',
      activeSessionSlug: 'demo',
      sessionConfig: null,
    });
    getDemoSessionConfigBySlug.mockImplementation((slug) => (
      slug === '' ? demoConfig : null
    ));

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).toBeInTheDocument();
    expect(screen.getByTestId('mock-one-page-demo')).toHaveAttribute('data-question-session-slug', '');
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('demo', { allowDemoFallback: true });
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('', { allowDemoFallback: true });
  });

  it('initializes session-route caches when only display fallback metadata provides the network', async () => {
    const demoConfig = buildSessionConfig({
      slug: 'demo-1',
      sessionName: 'Demo Session',
      networkChainId: DEFAULT_NETWORK.id,
      __registry: undefined,
    });
    const subject = createSubject({
      path: '/session/demo-1',
      activeSessionSlug: 'demo-1',
      sessionConfig: null,
    });
    getDemoSessionConfigBySlug.mockImplementation((slug) => (
      slug === 'demo-1' ? demoConfig : null
    ));
    subject.applySessionFallbackRedirect = jest.fn(() => null);
    subject.syncSessionFallbackRedirectConsumption = jest.fn();
    subject.manageAutoHashPersistence = jest.fn();
    subject.isFirstVisitRootRedirectEnabled = jest.fn(() => false);
    subject.resolveSessionPathSlug = jest.fn();
    subject.syncLitHooks = jest.fn();
    subject.refreshSessionInfo = jest.fn();
    subject.refreshSessionMetaFields = jest.fn();
    subject.refreshGroupCredentials = jest.fn();
    subject.hasPersistedManagedCacheData = jest.fn(async () => false);
    subject.syncCacheHasLoadedFlagFromPersistent = jest.fn(async () => undefined);
    subject.syncCacheHasLoadedFlagOnTransition = jest.fn(async () => undefined);
    subject.getSessionNetwork = jest.fn(() => null);
    subject.getDisplaySessionNetwork = jest.fn(() => DEFAULT_NETWORK);
    subject.initializeQuestionCache = jest.fn(async () => undefined);
    subject.initializeSbtCache = jest.fn(async () => undefined);
    subject.fetchQuestionResponsesChunked = jest.fn(async () => undefined);
    subject.initializeSurveyCache = jest.fn(async () => undefined);
    subject.startSbtEventListener = jest.fn();
    subject.startSurveyAndQuestionEventListener = jest.fn();
    subject.setReadinessStateIfChanged = jest.fn((patch) => {
      subject.state = { ...subject.state, ...(patch || {}) };
    });
    subject.checkAllCachesReady = jest.fn();
    subject.handleDeepLinkScan = jest.fn();

    await act(async () => {
      await subject.componentDidMount();
    });

    expect(subject.getDisplaySessionNetwork).toHaveBeenCalledWith('demo-1');
    expect(subject.initializeQuestionCache).toHaveBeenCalledTimes(1);
    expect(subject.initializeSbtCache).toHaveBeenCalledWith({ mode: 'partial' });
    expect(subject.fetchQuestionResponsesChunked).toHaveBeenCalledTimes(1);
    expect(subject.initializeSurveyCache).toHaveBeenCalledTimes(1);

    subject.componentWillUnmount();
  });

  it('preloads the primary demo session data when the about page mounts', async () => {
    const demoConfig = buildSessionConfig({
      slug: 'demo-1',
      sessionName: 'Demo Session',
      networkChainId: DEFAULT_NETWORK.id,
      __registry: undefined,
    });
    const subject = createSubject({
      path: '/about',
      activeSessionSlug: '',
      sessionConfig: null,
    });
    getDemoSessionConfigBySlug.mockImplementation((slug) => (
      slug === 'demo-1' ? demoConfig : null
    ));
    subject.applySessionFallbackRedirect = jest.fn(() => null);
    subject.syncSessionFallbackRedirectConsumption = jest.fn();
    subject.manageAutoHashPersistence = jest.fn();
    subject.resolveSessionPathSlug = jest.fn();
    subject.syncLitHooks = jest.fn();
    subject.refreshSessionInfo = jest.fn();
    subject.refreshSessionMetaFields = jest.fn();
    subject.refreshGroupCredentials = jest.fn();
    subject.hasPersistedManagedCacheData = jest.fn(async () => false);
    subject.syncCacheHasLoadedFlagFromPersistent = jest.fn(async () => undefined);
    subject.syncCacheHasLoadedFlagOnTransition = jest.fn(async () => undefined);
    subject.getSessionNetwork = jest.fn(() => null);
    subject.getDisplaySessionNetwork = jest.fn((slug) => (
      slug === 'demo-1' ? DEFAULT_NETWORK : null
    ));
    subject.initializeQuestionCacheForGroup = jest.fn(async () => undefined);
    subject.fetchQuestionResponsesChunkedForGroup = jest.fn(async () => undefined);
    subject.initializeSurveyCacheForGroup = jest.fn(async () => undefined);
    subject.initializeSbtCacheForGroup = jest.fn(async () => undefined);
    subject.initializeQuestionCache = jest.fn(async () => undefined);
    subject.initializeSbtCache = jest.fn(async () => undefined);
    subject.fetchQuestionResponsesChunked = jest.fn(async () => undefined);
    subject.initializeSurveyCache = jest.fn(async () => undefined);
    subject.startSbtEventListener = jest.fn();
    subject.startSurveyAndQuestionEventListener = jest.fn();
    subject.setReadinessStateIfChanged = jest.fn((patch) => {
      subject.state = { ...subject.state, ...(patch || {}) };
    });
    subject.checkAllCachesReady = jest.fn();
    subject.handleDeepLinkScan = jest.fn();

    await act(async () => {
      await subject.componentDidMount();
    });

    expect(subject.getDisplaySessionNetwork).toHaveBeenCalledWith('demo-1');
    expect(subject.initializeQuestionCacheForGroup).toHaveBeenCalledWith('demo-1', { background: true });
    expect(subject.fetchQuestionResponsesChunkedForGroup).toHaveBeenCalledWith('demo-1', { background: true });
    expect(subject.initializeSurveyCacheForGroup).toHaveBeenCalledWith('demo-1', { background: true });
    expect(subject.initializeSbtCacheForGroup).toHaveBeenCalledWith('demo-1', {
      mode: 'partial',
      background: true,
    });

    subject.componentWillUnmount();
  });

  it('preserves session question-results subroutes and forwards route-open flags to OnePageSession', async () => {
    const sessionConfig = buildSessionConfig({
      sessionName: 'Signals Session',
    });
    seedSessionRegistryCache(sessionConfig);
    const subject = createSubject({
      path: '/session/edge/questions/results',
      search: '?session=edge',
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SESSION_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-one-page-demo')).toHaveAttribute('data-session-name', 'Signals Session');
    expect(window.location.pathname).toBe('/session/edge/questions/results');
    const latestProps = mockOnePageSession.mock.calls[mockOnePageSession.mock.calls.length - 1][0] || {};
    expect(latestProps.routeQuestionsOpen).toBe(true);
    expect(latestProps.routeAutoOpenResults).toBe(true);
  });

  it('renders the SBT route with the query session slug hint', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f1';
    const sessionConfig = buildSessionConfig();
    const subject = createSubject({
      path: `/sbt/${sbtAddress}`,
      search: '?session=edge',
      activeSessionSlug: 'stale',
      sessionConfig,
    });
    subject.state = {
      ...subject.state,
      sbtScanProgressBySlug: {
        edge: {
          currentBlock: 1600,
          latestBlock: 2000,
        },
      },
    };

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SBT_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-sbt-page')).toHaveAttribute('data-session-slug', 'edge');
    expect(screen.getByTestId('mock-sbt-page')).toHaveAttribute('data-network-id', '84532');
    expect(screen.getByTestId('mock-sbt-page')).toHaveAttribute('data-sbt-address', sbtAddress);
    const latestProps = mockSBTPage.mock.calls[mockSBTPage.mock.calls.length - 1][0] || {};
    expect(latestProps.sbtScanProgress).toEqual({
      currentBlock: 1600,
      latestBlock: 2000,
    });
  });

  it('renders the group alias route with the same SBT detail props', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f4';
    const sessionConfig = buildSessionConfig();
    const subject = createSubject({
      path: `/group/${sbtAddress}`,
      search: '?session=edge',
      activeSessionSlug: 'stale',
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SBT_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-sbt-page')).toHaveAttribute('data-session-slug', 'edge');
    expect(screen.getByTestId('mock-sbt-page')).toHaveAttribute('data-network-id', '84532');
    expect(screen.getByTestId('mock-sbt-page')).toHaveAttribute('data-sbt-address', sbtAddress);
  });

  it('renders the SBT route with a slug resolved from sessionId query params', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f2';
    const sessionConfig = buildSessionConfig();
    seedSessionRegistryCache(sessionConfig);
    const subject = createSubject({
      path: `/sbt/${sbtAddress}`,
      search: `?sessionId=${SESSION_ID}`,
      activeSessionSlug: 'stale',
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SBT_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-sbt-page')).toHaveAttribute('data-session-slug', 'edge');
    expect(screen.getByTestId('mock-sbt-page')).toHaveAttribute('data-network-id', '84532');
    expect(screen.getByTestId('mock-sbt-page')).toHaveAttribute('data-sbt-address', sbtAddress);
  });

  it('ignores unknown query session hints on the SBT route until bootstrap discovery resolves the owner session', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f3';
    const sessionConfig = buildSessionConfig();
    const subject = createSubject({
      path: `/sbt/${sbtAddress}`,
      search: '?session=stale-slug',
      activeSessionSlug: 'edge',
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SBT_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-sbt-page')).toHaveAttribute('data-session-slug', 'edge');
  });

  it.each(['/groups', '/groups/'])('renders the group list alias route for %s', async (path) => {
    const sessionConfig = buildSessionConfig();
    const subject = createSubject({
      path,
      activeSessionSlug: 'edge',
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SBTS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-sbts-page')).toHaveAttribute('data-network-id', '84532');
    expect(screen.getByTestId('mock-sbts-page')).toHaveAttribute('data-all-sessions-mode', 'true');
    expect(screen.getByTestId('mock-sbts-page')).toHaveAttribute('data-session-slug', '');
  });

  it.each(['/sbts/edge', '/groups/edge'])('passes the route session slug through for %s', async (path) => {
    const sessionConfig = buildSessionConfig();
    const subject = createSubject({
      path,
      activeSessionSlug: 'stale',
      sessionConfig,
    });

    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_SBTS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-sbts-page')).toHaveAttribute('data-network-id', '84532');
    expect(screen.getByTestId('mock-sbts-page')).toHaveAttribute('data-all-sessions-mode', 'false');
    expect(screen.getByTestId('mock-sbts-page')).toHaveAttribute('data-session-slug', 'edge');
  });

  it('does not access window directly while rendering atlas and stubbed experimental routes', () => {
    const debateSubject = createSubject({ path: '/debate' });
    const atlasSubject = createSubject({ path: '/atlas' });
    const tagSubject = createSubject({ path: '/tag/governance' });
    const originalWindow = global.window;

    try {
      delete global.window;
      expect(() => debateSubject.render()).not.toThrow();
      expect(() => atlasSubject.render()).not.toThrow();
      expect(() => tagSubject.render()).not.toThrow();
    } finally {
      global.window = originalWindow;
    }
  });

  it('treats the atlas demoSurfaceMode as enabled by default and only disables it when false', async () => {
    const defaultSubject = createSubject({ path: '/atlas', demoSurfaceMode: null });
    const { unmount } = render(defaultSubject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_ATLAS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-debate-map')).toHaveAttribute('data-demo-mode', 'true');

    unmount();

    const enabledSubject = createSubject({ path: '/atlas', demoSurfaceMode: true });
    const enabledRender = render(enabledSubject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_ATLAS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-debate-map')).toHaveAttribute('data-demo-mode', 'true');

    enabledRender.unmount();

    const disabledSubject = createSubject({ path: '/atlas', demoSurfaceMode: false });
    render(disabledSubject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_ATLAS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-debate-map')).toHaveAttribute('data-demo-mode', 'false');
  });

  it('still honors atlas demo deep links when demoSurfaceMode is disabled', async () => {
    const subject = createSubject({ path: '/atlas', search: '?demo=1', demoSurfaceMode: false });
    render(subject.render());

    expect(await screen.findByTestId(E2E_TESTIDS.PAGE_ATLAS_ROOT)).toBeInTheDocument();
    expect(await screen.findByTestId('mock-debate-map')).toHaveAttribute('data-demo-mode', 'true');
  });

  it('registers listener pairs once across mount, stable updates, and unmount', async () => {
    const subject = stubMainSiteMountSideEffects(createSubject({
      path: '/session/edge',
      activeSessionSlug: 'edge',
      sessionConfig: buildSessionConfig({
        blockLimits: { start: 100, end: null },
      }),
    }));
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    subject.getCurrentPathname = jest.fn(() => '/session/edge');
    subject.getInitializableSessionNetwork = jest.fn(() => DEFAULT_NETWORK);
    subject.getDisplaySessionNetwork = jest.fn(() => DEFAULT_NETWORK);
    subject.getDisplaySessionChainId = jest.fn(() => DEFAULT_NETWORK.id);
    subject.isBuiltInDemoSessionRoutePath = jest.fn(() => false);
    subject.initializeQuestionCache = jest.fn(async () => undefined);
    subject.initializeSbtCache = jest.fn(async () => undefined);
    subject.initializeSurveyCache = jest.fn(async () => undefined);
    subject.fetchQuestionResponsesChunked = jest.fn(async () => undefined);
    subject.shouldAutoRunFullSbtScan = jest.fn(() => false);
    subject.checkAllCachesReady = jest.fn();
    loadGroupRegistryCache.mockResolvedValue({});

    await act(async () => {
      await subject.componentDidMount();
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      SESSION_REGISTRY_CACHE_UPDATED_EVENT,
      subject.handleSessionRegistryCacheUpdated
    );
    expect(contractScripts.removeSBTEventListener).toHaveBeenCalledWith('none', 'edge');
    expect(contractScripts.removeSurveyEventsListener).toHaveBeenCalledWith('none', 'edge');
    expect(contractScripts.listenForSBTEvents).toHaveBeenCalledWith(
      'none',
      expect.any(Function),
      'edge'
    );
    expect(contractScripts.listenForSurveyEvents).toHaveBeenCalledWith(
      'none',
      expect.any(Function),
      'edge'
    );
    const sbtHandler = contractScripts.listenForSBTEvents.mock.calls[0][1];
    const surveyHandler = contractScripts.listenForSurveyEvents.mock.calls[0][1];

    subject.componentDidUpdate(subject.props, subject.state);

    expect(contractScripts.listenForSBTEvents).toHaveBeenCalledTimes(1);
    expect(contractScripts.listenForSurveyEvents).toHaveBeenCalledTimes(1);
    expect(contractScripts.listenForSBTEvents.mock.calls[0][1]).toBe(sbtHandler);
    expect(contractScripts.listenForSurveyEvents.mock.calls[0][1]).toBe(surveyHandler);

    subject.componentWillUnmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      SESSION_REGISTRY_CACHE_UPDATED_EVENT,
      subject.handleSessionRegistryCacheUpdated
    );
    expect(contractScripts.removeSBTEventListener).toHaveBeenLastCalledWith('none', 'edge');
    expect(contractScripts.removeSurveyEventsListener).toHaveBeenLastCalledWith('none', 'edge');
    expect(contractScripts.removeSBTInstanceEventsListener).toHaveBeenLastCalledWith('none', [], 'edge');
  });

  it('wires registry bootstrap promise state through MainSite and clears failures', async () => {
    const subject = stubMainSiteMountSideEffects(createSubject({
      path: '/session/edge',
      activeSessionSlug: 'edge',
      sessionConfig: buildSessionConfig(),
    }));
    const mountBootstrap = createDeferred();
    loadGroupRegistryCache.mockReturnValueOnce(mountBootstrap.promise);

    await act(async () => {
      await subject.componentDidMount();
    });

    expect(loadGroupRegistryCache).toHaveBeenCalledWith(expect.objectContaining({
      chainIds: undefined,
      force: true,
      bootstrapRpc: true,
    }));
    expect(subject._registryBootstrapPromise).toBe(mountBootstrap.promise);
    expect(subject._registryBootstrapScopeKey).toBe('all');

    mountBootstrap.reject(new Error('bootstrap failed'));
    await mountBootstrap.promise.catch(() => null);
    await Promise.resolve();

    expect(subject._registryBootstrapPromise).toBeNull();
    expect(subject._registryBootstrapScopeKey).toBe('');
  });

  it('reuses registry hydration in flight for a scope and restarts on scope changes', async () => {
    const subject = createSubject({
      path: '/session/edge',
      activeSessionSlug: 'edge',
      sessionConfig: buildSessionConfig(),
    });
    const sameScope = createDeferred();
    subject._registryBootstrapPromise = sameScope.promise;
    subject._registryBootstrapScopeKey = subject.getRegistryBootstrapScopeKey();
    sessionRegistryStore.getAllSessionEntries.mockReturnValue([['edge', buildSessionConfig()]]);

    const first = subject.ensureRegistryHydratedForProfileScan();
    const second = subject.ensureRegistryHydratedForProfileScan();
    sameScope.resolve({ __loadMeta: { hadLoadErrors: false } });

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ hasEntries: true }),
      expect.objectContaining({ hasEntries: true }),
    ]);
    expect(loadGroupRegistryCache).not.toHaveBeenCalled();

    const mismatched = createDeferred();
    subject._registryBootstrapPromise = sameScope.promise;
    subject._registryBootstrapScopeKey = '11155420';
    loadGroupRegistryCache.mockReturnValueOnce(mismatched.promise);

    const restarted = subject.ensureRegistryHydratedForProfileScan();

    expect(loadGroupRegistryCache).toHaveBeenCalledTimes(1);
    expect(subject._registryBootstrapPromise).toBe(mismatched.promise);
    expect(subject._registryBootstrapScopeKey).toBe('all');

    mismatched.resolve({ __loadMeta: { hadLoadErrors: false } });
    await expect(restarted).resolves.toEqual(expect.objectContaining({ hasEntries: true }));
  });

  it('exits invalid profile scans before touching contract or registry seams', async () => {
    const subject = createSubject({ path: '/u/not-an-address' });

    await expect(subject.scanSpecificUserProfile('not-an-address')).resolves.toBeNull();

    expect(loadGroupRegistryCache).not.toHaveBeenCalled();
    expect(contractScripts.getLatestBlockNumber).not.toHaveBeenCalled();
    expect(contractScripts.getSBTsForUser).not.toHaveBeenCalled();
    expect(contractScripts.getUserActivity).not.toHaveBeenCalled();
  });

  it('dedupes user-profile fan-out and writes discovered boundary-backed caches', async () => {
    const target = '0x00000000000000000000000000000000000000ab';
    const sbtAddress = '0x00000000000000000000000000000000000000c1';
    const surveyId = `0x${'1'.repeat(64)}`;
    const questionId = `0x${'2'.repeat(64)}`;
    const sessionConfig = buildSessionConfig({
      blockLimits: { start: 100, end: null },
    });
    const subject = createSubject({
      path: `/u/${target}`,
      activeSessionSlug: 'edge',
      sessionConfig,
    });
    subject._mounted = true;
    const dg = attachDgStore(subject);
    subject.getUserProfileAllSessionsScanMode = jest.fn(() => ({
      legacyAllSessions: false,
      useAllSessionsSbtScan: false,
      useAllSessionsSurveyActivityScan: false,
      useAllSessionsQuestionActivityScan: false,
      useAllSessionsActivityScan: false,
      useAllSessionsScan: false,
    }));
    subject.getProfileScanScopeContext = jest.fn(() => ({
      scope: 'active',
      list: [],
      activeSlug: 'edge',
      activeSlugFromRoute: true,
    }));
    subject.ensureRegistryHydratedForProfileScan = jest.fn(async () => null);
    subject.resolveProfileDeepScanPlan = jest.fn(() => ({
      slugs: ['edge'],
      usedAllSessions: false,
      coverageComplete: true,
      coverageReason: '',
      registryEntryCount: 1,
      rawAllSlugCount: 1,
      activeChainSlugCount: 1,
      scopedFallbackSlugCount: 0,
      relevantSlugs: ['edge'],
      prioritizedGeneralFirst: false,
      scanOrdering: 'active',
    }));
    subject.readProfileScanStepTimeoutMs = jest.fn(() => 5000);
    subject.readProfileScanSbtBurstSize = jest.fn(() => 1);
    subject.readProfileScanActivityLookbackBlocks = jest.fn(() => 0);
    subject.emitProfileScanColdDiag = jest.fn();
    subject.emitProfileScanTelemetry = jest.fn();
    subject.scheduleProfileScanRetryAfterRegistryHydration = jest.fn();
    subject.queueLocalRevisionUpdate = jest.fn();
    contractScripts.getLatestBlockNumber.mockResolvedValue(125);
    contractScripts.getSBTsForUser.mockResolvedValue({
      data: [{ sbtAddress, sbtInfo: { name: 'Badge' } }],
      hadError: false,
    });
    contractScripts.getUserActivity.mockResolvedValue({
      data: {
        createdSurveys: [{ id: surveyId, data: { title: 'Survey' } }],
        createdQuestions: [{ id: questionId, data: { prompt: 'Question' } }],
        surveyResponses: [],
        questionResponses: [],
      },
      hadError: false,
    });

    const first = subject.scanSpecificUserProfile(target);
    const second = subject.scanSpecificUserProfile(target);
    const [firstReport, secondReport] = await Promise.all([first, second]);

    expect(firstReport).toBe(secondReport);
    expect(contractScripts.getLatestBlockNumber).toHaveBeenCalledTimes(1);
    expect(contractScripts.getSBTsForUser).toHaveBeenCalledWith(
      target,
      'edge',
      100,
      expect.objectContaining({
        returnMeta: true,
        ignoreScope: false,
      })
    );
    expect(contractScripts.getUserActivity).toHaveBeenCalledWith(
      target,
      'edge',
      100,
      expect.objectContaining({
        returnMeta: true,
        includeSurveyActivity: true,
        includeQuestionActivity: true,
        forceArweaveFetch: true,
      })
    );
    expect(dg.read('userCache', 'edge')?.[target.toLowerCase()]?.['84532']?.data?.sbts)
      .toEqual([expect.objectContaining({ sbtAddress })]);
    expect(dg.read('sbtCache', 'edge')?.['84532']?.sbtList?.[sbtAddress.toLowerCase()])
      .toEqual(expect.objectContaining({
        sbtAddress,
        mintedAddresses: [target.toLowerCase()],
      }));
    expect(dg.read('surveysCache', 'edge')?.['84532']?.surveys?.[surveyId])
      .toEqual(expect.objectContaining({ surveyID: surveyId }));
    expect(dg.read('questionsCache', 'edge')?.['84532']?.questions?.[questionId])
      .toEqual(expect.objectContaining({ id: questionId }));
  });

  it('reconciles survey events into survey and question caches without dropping arweave branches', async () => {
    const surveyId = `0x${'3'.repeat(64)}`;
    const questionId = `0x${'4'.repeat(64)}`;
    const subject = createSubject({
      path: '/session/edge',
      activeSessionSlug: 'edge',
      sessionConfig: buildSessionConfig(),
    });
    const dg = attachDgStore(subject, {
      'questionsCache:edge': {
        '84532': {
          questionsLatestBlock: 12,
          questions: {},
          questionResponses: {},
          questionResponsesMeta: {},
          arweaveTxCache: { keep: 'cached-tx' },
          arweaveTxFailureCache: { keep: 'cached-failure' },
          questionHydrationMeta: { keep: 'hydration' },
        },
      },
    });
    subject.buildMetadataSessionCacheEnvelope = jest.fn((metadata, slug) => ({
      targetSlug: slug,
      metadata: {
        ...metadata,
        sessionSlug: slug,
        slug,
      },
    }));
    subject.buildQuestionDecryptContext = jest.fn(() => ({ sessionSlug: 'edge' }));
    subject.setReadinessStateIfChanged = jest.fn((patch, cb) => {
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    });
    subject.queueLocalRevisionUpdate = jest.fn();
    subject.checkAllCachesReady = jest.fn();
    contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({
      fromBlock: 10,
      toBlock: 20,
    });
    contractScripts.getSurveyDataById.mockResolvedValue({
      questionIDs: [questionId.toUpperCase()],
      creator: '',
      title: 'Survey',
    });
    contractScripts.getQuestionData.mockResolvedValue({
      prompt: 'Question',
    });

    await subject.onNewSurveyEventDetectedForGroup('edge', {
      type: 'SurveyAdded',
      surveyId: surveyId.toUpperCase(),
      blockNumber: 30,
    });

    expect(contractScripts.getSurveyDataById).toHaveBeenCalledWith('none', surveyId, 'edge');
    expect(contractScripts.getQuestionData).toHaveBeenCalledWith(
      'none',
      questionId,
      'edge',
      expect.objectContaining({
        decryptContext: { sessionSlug: 'edge' },
        skipDecrypt: true,
      })
    );
    expect(dg.read('surveysCache', 'edge')?.['84532']?.surveys?.[surveyId])
      .toEqual(expect.objectContaining({
        surveyID: surveyId,
        creationBlock: 30,
        sessionSlug: 'edge',
      }));
    const questionNet = dg.read('questionsCache', 'edge')?.['84532'];
    expect(questionNet?.questions?.[questionId]).toEqual(expect.objectContaining({
      id: questionId,
      sessionSlug: 'edge',
    }));
    expect(questionNet?.questionsLatestBlock).toBe(30);
    expect(questionNet?.arweaveTxCache).toEqual({ keep: 'cached-tx' });
    expect(questionNet?.arweaveTxFailureCache).toEqual({ keep: 'cached-failure' });
    expect(questionNet?.questionHydrationMeta).toEqual({ keep: 'hydration' });
    expect(subject.setReadinessStateIfChanged).toHaveBeenNthCalledWith(
      1,
      { isSurveyCacheReady: false, isQuestionCacheReady: false }
    );
    expect(subject.queueLocalRevisionUpdate).toHaveBeenCalledWith({
      needsQuestionResponsesNonce: true,
      checkAllCachesReady: true,
    });
  });

  it('tears down SBT detail listeners before rebuilding network caches', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000d1';
    const subject = createSubject({
      path: `/sbt/${sbtAddress}`,
      activeSessionSlug: 'edge',
      sessionConfig: buildSessionConfig(),
    });
    const order = [];
    subject.startCacheReinitRun = jest.fn(() => 'run-1');
    subject.isCacheReinitRunActive = jest.fn(() => true);
    subject.getCurrentPathname = jest.fn(() => `/sbt/${sbtAddress}`);
    subject.getInitializableSessionNetwork = jest.fn(() => DEFAULT_NETWORK);
    subject.getSbtAddressFromPath = jest.fn(() => sbtAddress);
    subject.resolvePinnedSbtDetailRouteSlug = jest.fn(async () => {
      order.push('resolve-detail');
      return 'detail';
    });
    subject.removeSbtRealtimeListenersForGroup = jest.fn((slug) => {
      order.push(`remove:${slug}`);
    });
    subject.refreshSbtData = jest.fn(async () => {
      order.push('refresh-sbt');
    });
    subject.shouldAttachSbtDetailInstanceListener = jest.fn(() => true);
    subject.shouldAutoRunFullSbtScan = jest.fn(() => false);
    subject.startSbtDetailInstanceListenerForGroup = jest.fn((slug, addresses) => {
      order.push(`start-detail:${slug}:${addresses[0]}`);
    });
    subject.initializeSurveyCache = jest.fn(async () => {
      order.push('init-surveys');
    });
    subject.initializeQuestionCache = jest.fn(async () => {
      order.push('init-questions');
    });
    subject.startSurveyAndQuestionEventListener = jest.fn(() => {
      order.push('start-survey-listener');
      return true;
    });
    subject.fetchQuestionResponsesChunked = jest.fn(async () => {
      order.push('fetch-responses');
    });
    subject.setReadinessStateIfChanged = jest.fn((patch) => {
      if (patch?.isAllCachesReady === false) order.push('reset-readiness');
      if (patch?.isSBTCacheReady === true) order.push('sbt-ready');
      if (patch?.isSurveyCacheReady === true) order.push('survey-ready');
    });
    subject.checkAllCachesReady = jest.fn(() => {
      order.push('check-ready');
    });

    await subject.handleNetworkChange();

    expect(order).toEqual([
      'reset-readiness',
      'resolve-detail',
      'remove:edge',
      'remove:detail',
      'refresh-sbt',
      'sbt-ready',
      `start-detail:detail:${sbtAddress}`,
      'init-surveys',
      'survey-ready',
      'init-questions',
      'start-survey-listener',
      'fetch-responses',
      'check-ready',
    ]);
  });
});

describe('MainSite single-SBT counts checkpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({
      fromBlock: 100,
      toBlock: 200,
    });
    contractScripts.getSbtCreationBlockByAddress.mockResolvedValue(100);
    contractScripts.getSbtMetadata.mockResolvedValue({
      name: 'Badge',
      tokenURI: 'ar://badge-metadata',
      image: 'https://example.com/badge.png',
      mintingEndTime: 0,
      burnAuth: 0,
      hasPasswordMint: false,
      maxTokens: '0',
      admin: '0x00000000000000000000000000000000000000a2',
    });
  });

  it('persists and resumes partial holder scan checkpoints for a single SBT refresh', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f3';
    const holderAddress = '0x00000000000000000000000000000000000000b1';
    const sbtLower = sbtAddress.toLowerCase();
    const subject = createSubject({
      path: `/sbt/${sbtAddress}`,
      activeSessionSlug: 'edge',
    });
    subject.isSbtHistoryScanEnabled = jest.fn(() => true);

    let cacheState = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: 'Badge',
              tokenURI: 'ar://badge-metadata',
              image: 'https://example.com/badge.png',
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
            },
            creationBlock: 100,
          },
        },
        lastBlock: 99,
      },
    };

    subject.DG.read.mockImplementation((namespace, slug) => {
      if (namespace === 'sbtCache' && slug === 'edge') {
        return JSON.parse(JSON.stringify(cacheState));
      }
      return null;
    });
    subject.DG.write.mockImplementation((namespace, slug, value) => {
      if (namespace === 'sbtCache' && slug === 'edge') {
        cacheState = JSON.parse(JSON.stringify(value));
      }
      return value;
    });

    contractScripts.getSbtMintBurnCountsByAddress
      .mockImplementationOnce(async (...args) => {
        const opts = args[5] || {};
        expect(opts.resumeState).toBeUndefined();
        expect(typeof opts.onCheckpoint).toBe('function');
        opts.onCheckpoint({
          phase: 'activity',
          blockNumber: 149,
          mintedCountByAddress: {
            [holderAddress]: 1,
          },
          burnedCountByAddress: {},
          mintedEventCount: 1,
          burnedEventCount: 0,
        });
        return {
          mintedCountByAddress: {},
          burnedCountByAddress: {},
          mintedEventCount: 0,
          burnedEventCount: 0,
          ok: false,
        };
      })
      .mockImplementationOnce(async (...args) => {
        const opts = args[5] || {};
        expect(opts.resumeState).toMatchObject({
          phase: 'activity',
          blockNumber: 149,
          mintedCountByAddress: {
            [holderAddress]: 1,
          },
        });
        return {
          mintedCountByAddress: {
            [holderAddress]: 1,
          },
          burnedCountByAddress: {},
          mintedEventCount: 1,
          burnedEventCount: 0,
          ok: true,
        };
      });

    await subject.refreshSbtDataForGroup('edge', sbtAddress, { forceCounts: true });

    const checkpointEntry = cacheState['84532'].sbtList[sbtLower];
    expect(checkpointEntry.countsLoaded).toBe(false);
    expect(checkpointEntry.blockNumber).toBeNull();
    expect(checkpointEntry.mintedCountByAddress).toEqual({});
    expect(checkpointEntry.countsScanCheckpoint).toMatchObject({
      phase: 'activity',
      blockNumber: 149,
    });

    await subject.refreshSbtDataForGroup('edge', sbtAddress, { forceCounts: true });

    const finalEntry = cacheState['84532'].sbtList[sbtLower];
    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenNthCalledWith(
      2,
      'none',
      sbtAddress,
      100,
      200,
      'edge',
      expect.objectContaining({
        resumeState: expect.objectContaining({
          phase: 'activity',
          blockNumber: 149,
        }),
      })
    );
    expect(finalEntry.countsLoaded).toBe(true);
    expect(finalEntry.blockNumber).toBe(200);
    expect(finalEntry.mintedCountByAddress).toEqual({
      [holderAddress.toLowerCase()]: 1,
    });
    expect(finalEntry.countsScanCheckpoint).toBeNull();
  });
});
