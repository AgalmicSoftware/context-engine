jest.mock('wagmi/actions', () => ({ disconnect: jest.fn(async () => {}) }));
import { buildSbtActivityCacheEntry } from '../../utilities/sbt/sbtActivityCacheEntry.js';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider, connect } from 'react-redux';
import { applyMiddleware, combineReducers, createStore } from 'redux';
import thunk from 'redux-thunk';
import ConnectedCommunityTab, {
  CommunityTab,
  QUESTIONS_LOAD_LIMIT_MS,
  WORKER_LISTING_COUNTS_WAIT_MS,
} from './CommunityTab';
import { LoginAndSettingsModal } from '../Account/LoginAndSettingsModal';
import sessionStateReducer from '../../reducers/sessionStateReducer';
import { updateGlobalSessionSelection } from '../../actions/sessionStateActions';

jest.mock('../HooksHOC/withWagmiBridge', () => ({ WagmiHooksHOC: (Component) => Component }));
jest.mock('@rainbow-me/rainbowkit', () => ({ ConnectButton: () => null }));
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import * as polisReportModule from '../PolisReport/PolisReport';
import {
  initCacheManager,
  clearCacheNamespace,
  peekCacheSync,
  readCache,
  writeCache,
} from '../../utilities/cache/cacheScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import contractScripts, * as chainGateway from '../../utilities/web3/chainGateway.js';
import * as sessionSources from '../../utilities/session/sessionSourceResolver';
import * as workerConfigCache from '../../utilities/session/sessionWorkerConfigCache';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT } from '../../utilities/web3/sessionRegistry';
import * as workerGroupPorts from '../../domains/worker/workerGroupPorts';
import * as workerAuth from '../../utilities/worker/workerAuth';
import * as resourcePresence from '../../utilities/worker/workerResourcePresence';
import { dispatchWorkerGroupsChanged } from '../../utilities/worker/workerGroupChangeEvents';
import {
  WORKER_CANONICAL_CACHE_SCOPE_KEY,
  resolveWorkerCanonicalCacheIdentity,
  withWorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import { WORKER_GROUP_COUNT_TIMEOUT_MS, WORKER_GROUP_COUNT_WAIT_MS } from './communityWorkerGroupStats';
import { CommunitySessionDialog } from './CommunitySessionDialogs';
import { loadCommunityWorkerQuestions } from './communityWorkerQuestions';

// An opened Worker session's questions are read only where this browser holds none; tests say what each read gives.
jest.mock('./communityWorkerQuestions', () => ({
  loadCommunityWorkerQuestions: jest.fn(() => new Promise(() => {})),
}));

// The Stats tiles count a Worker-hosted session from its listings. Tests name what each session's listings hold;
// a session not named here lists nothing.
const mockListingCounts = {};
jest.mock('./communityWorkerListingCounts', () => ({
  // People are counted here as on a session whose answers every reader may list; the module's own tests cover
  // sessions where each person is listed only their own.
  listsEveryAnswer: () => true,
  settingsHiddenQuestionIds: jest.requireActual('./communityWorkerListingCounts').settingsHiddenQuestionIds,
  loadWorkerListingCounts: jest.fn(async ({ sessionSlug }) => {
    const counts = mockListingCounts[sessionSlug];
    if (counts instanceof Error) throw counts;
    return counts || { questions: 0, surveys: 0, responders: [] };
  }),
}));
// Lets the listing reads started by a refresh settle, then runs the refresh they ask for.
const settleListingCounts = async (instance) => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await instance._runStatsRefreshCycle({ force: true });
};
import BeeswarmPlot from '../Shared/BeeswarmPlot/BeeswarmPlot';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath';
import { buildWorkerGroupsPath } from '../../utilities/worker/workerGroupRoutes';
import SBTFilter from '../SBTs/SBTFilter';
import { POLIS_DEMO_DATA_AUTOLOAD_SLUGS } from '../../variables/appConfig.js';
import demoSessions from '../../variables/demo/demo_sessions.json';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { writeGlobalSessionSelection } from '../../utilities/session/globalSessionState';

const ORIGINAL_SESSION_SCAN_SCOPE = globalThis.CE_SESSION_SCAN_SCOPE;
const ORIGINAL_SESSION_SCAN_SLUGS = globalThis.CE_SESSION_SCAN_SLUGS;

const MANAGED_NAMESPACES = ['questionsCache', 'surveysCache', 'bookmarksCache', 'filters', 'sbtCache', 'userCache'];
const WORKER_SESSION_CONFIG = demoSessions['demo-sh'];
let canvasCreateElementSpy;

const writeWorkerStatsCaches = async ({
  numericQuestions = { staleNumericQuestion: { type: 'binary', prompt: 'Stale numeric question' } },
  workerQuestions = { workerQuestion: { type: 'binary', prompt: 'Worker question', creator: '0xabc' } },
  workerQuestionResponses = {
    workerQuestion: {
      '0xdef': { type: 'binary', answer: { value: 'Agree' } },
    },
  },
  numericSurveys = { staleNumericSurvey: { title: 'Stale numeric survey' } },
  workerSurveys = { workerSurvey: { title: 'Worker survey', creator: '0xabc', questionIDs: ['workerQuestion'] } },
} = {}) => {
  // What the fixture session's own listings hold: one question, one survey, answers from three people.
  mockListingCounts['demo-sh'] = {
    questions: 1,
    surveys: 1,
    responders: [
      '0x00000000000000000000000000000000000000a1',
      '0x00000000000000000000000000000000000000a2',
      '0x00000000000000000000000000000000000000a3',
    ],
  };
  const identity = resolveWorkerCanonicalCacheIdentity({
    sessionConfig: WORKER_SESSION_CONFIG,
    sessionSlug: 'demo-sh',
  });
  const numericKey = String(WORKER_SESSION_CONFIG.networkChainId);
  await writeCache('questionsCache', 'demo-sh', {
    [numericKey]: {
      questions: numericQuestions,
      questionResponses: {},
    },
    [WORKER_CANONICAL_CACHE_SCOPE_KEY]: withWorkerCanonicalCacheIdentity(
      {
        questions: workerQuestions,
        questionResponses: workerQuestionResponses,
      },
      identity,
    ),
  });
  await writeCache('surveysCache', 'demo-sh', {
    [numericKey]: {
      surveys: numericSurveys,
      surveyResponses: {},
    },
    [WORKER_CANONICAL_CACHE_SCOPE_KEY]: withWorkerCanonicalCacheIdentity(
      {
        surveys: workerSurveys,
        surveyResponses: {},
      },
      identity,
    ),
  });
  await writeCache('sbtCache', 'demo-sh', {
    [numericKey]: {
      sbtList: {
        '0x1': { sbtAddress: '0x1', sbtInfo: {}, mintedAddresses: [], burnedAddresses: [] },
      },
    },
    [WORKER_CANONICAL_CACHE_SCOPE_KEY]: withWorkerCanonicalCacheIdentity({}, identity),
  });
};

const clearManagedCaches = async () => {
  await initCacheManager();
  for (const namespace of MANAGED_NAMESPACES) {
    // Namespace invalidation clears the mirror even when this fixture has no IDB.
    await clearCacheNamespace(namespace);
  }
};

const attachMutableSetState = (instance) => {
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });
  return instance;
};

const collectTreeNodes = (node, predicate, acc = []) => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  const children = node?.props?.children;
  if (children !== undefined) collectTreeNodes(children, predicate, acc);
  return acc;
};

const collectNodeText = (node) => {
  if (node == null) return '';
  if (Array.isArray(node)) return node.map((child) => collectNodeText(child)).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (typeof node !== 'object') return '';
  return collectNodeText(node?.props?.children);
};

describe('CommunityTab helpers', () => {
  beforeEach(async () => {
    try {
      window.history.replaceState({}, '', '/');
    } catch (_) {}
    localStorage.clear();
    Object.keys(mockListingCounts).forEach((slug) => delete mockListingCounts[slug]);
    globalThis.CE_SESSION_SCAN_SCOPE = 'active';
    globalThis.CE_SESSION_SCAN_SLUGS = [];
    // Stats count the groups of every bundled Worker session; tests stub those reads instead of calling live Workers.
    jest.spyOn(workerGroupPorts, 'loadPublicWorkerGroups').mockResolvedValue([]);
    const nativeCreateElement = document.createElement.bind(document);
    canvasCreateElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ fillStyle: '', fillRect: jest.fn() }),
          toDataURL: () => 'data:image/png;base64,mock-blockie',
        };
      }
      return nativeCreateElement(tagName, options);
    });
    await clearManagedCaches();
  });

  afterEach(() => {
    if (canvasCreateElementSpy) {
      canvasCreateElementSpy.mockRestore();
      canvasCreateElementSpy = null;
    }
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (typeof ORIGINAL_SESSION_SCAN_SCOPE === 'undefined') {
      try {
        delete globalThis.CE_SESSION_SCAN_SCOPE;
      } catch (_) {}
    } else {
      globalThis.CE_SESSION_SCAN_SCOPE = ORIGINAL_SESSION_SCAN_SCOPE;
    }
    if (typeof ORIGINAL_SESSION_SCAN_SLUGS === 'undefined') {
      try {
        delete globalThis.CE_SESSION_SCAN_SLUGS;
      } catch (_) {}
    } else {
      globalThis.CE_SESSION_SCAN_SLUGS = ORIGINAL_SESSION_SCAN_SLUGS;
    }
  });

  it('prefers activeSessionSlug over URL parsing', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    expect(instance._currentSlug()).toBe('edge');
  });

  it('shows a cached faucet offer for an already-loaded session without per-row requests', () => {
    const config = {
      slug: 'hosted-faucet',
      networkChainId: 11155420,
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
      workerAuthority: { participantScopes: ['faucet'] },
    };
    jest.spyOn(chainGateway, 'getSessionConfigBySlug').mockReturnValue(null);
    jest.spyOn(resourcePresence, 'getCachedWorkerResourcePresence').mockReturnValue({ txGas: true });
    const read = jest.spyOn(resourcePresence, 'readWorkerResourcePresence');
    const instance = new CommunityTab({ sessionConfig: config });
    instance.state.sessions = [
      { slug: config.slug, name: 'Funded session', kind: 'centralized', href: '/session/hosted-faucet' },
    ];
    render(instance.renderSessionsModalContent());
    expect(screen.getByTestId('ce-session-test-eth-badge')).toHaveTextContent('Test ETH');
    expect(read).not.toHaveBeenCalled();
  });

  it('starts fresh global Stats selection at ALL', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    expect(instance._isUniverseEnabled()).toBe(true);
  });

  it('keeps actual Stats counters and Settings selection synchronized through the shared Redux action', async () => {
    const configs = {
      alpha: { slug: 'alpha', sessionName: 'Alpha discussion', networkChainId: 11155420, contracts: {} },
      beta: { slug: 'beta', sessionName: 'Beta discussion', networkChainId: 11155420, contracts: {} },
    };
    jest.spyOn(chainGateway, 'getAllSessionSlugs').mockReturnValue(['alpha', 'beta']);
    jest.spyOn(chainGateway, 'getAllSessionEntries').mockReturnValue(Object.entries(configs));
    jest.spyOn(chainGateway, 'getSessionConfigBySlug').mockImplementation((slug) => configs[slug] || null);
    jest.spyOn(chainGateway, 'getSessionChainId').mockReturnValue(11155420);
    for (const [index, slug] of ['alpha', 'beta'].entries()) {
      await writeCache('questionsCache', slug, {
        11155420: {
          questions: Object.fromEntries(
            Array.from({ length: index + 1 }, (_, n) => [
              `${slug}-q${n}`,
              { type: 'binary', creator: `0x${index + 1}`, prompt: `${slug} question ${n + 1}` },
            ]),
          ),
          questionResponses: {},
        },
      });
      await writeCache('surveysCache', slug, {
        11155420: { surveys: { [slug]: { title: `${slug} survey`, creator: `0x${index + 1}` } }, surveyResponses: {} },
      });
    }
    writeGlobalSessionSelection({ primarySessionSlug: 'alpha', selectedSessionScope: 'active' });
    const store = createStore(combineReducers({ sessionState: sessionStateReducer }), applyMiddleware(thunk));
    let statsInstance;
    const ensureUniverse = jest.fn();
    jest.spyOn(CommunityTab.prototype, 'componentDidMount').mockImplementation(function () {
      statsInstance = this;
      this._isUnmounted = false;
      this._hydrateWorkerGroupCounts = jest.fn(async () => {});
      this._isDocumentHidden = () => false;
      this._scheduleNextStatsPoll = jest.fn();
      this.setState({ initialLoadDone: true, loadingSbtsCreated: false, loadingSurveyData: false });
      this._refreshSessionCatalog();
      this._ensureUniverseWarmup();
    });
    class SettingsView extends LoginAndSettingsModal {
      componentDidMount() {
        this._isMounted = true;
      }
      componentWillUnmount() {
        this._isMounted = false;
      }
      loadAiSettings = jest.fn();
      loadResourceKeys = jest.fn();
      loadSponsoredAccess = jest.fn();
      syncPasskeyWalletChain = jest.fn();
      checkAndSendTestFundsIfNeeded = jest.fn();
      render() {
        return (
          <>
            {this.renderGlobalSessionSelector({ testId: 'settings-selector' })}
            {this.renderGlobalSessionSettings({ scopePrefix: 'settings-scope' })}
          </>
        );
      }
    }
    const Settings = connect((state) => state.sessionState, { updateGlobalSessionSelection })(SettingsView);
    const view = render(
      <Provider store={store}>
        <ConnectedCommunityTab activeSessionSlug="stale-route" ensureLightSbtUniverse={ensureUniverse} />
        <Settings provider="" network={null} account="" toggleLoginModal={jest.fn()} />
      </Provider>,
    );
    try {
      await act(async () => {
        await statsInstance._runStatsRefreshCycle({ force: true });
      });
      expect(screen.getByTestId('ce-community-stat-questions')).toHaveAttribute('data-ce-count', '1');
      expect(ensureUniverse).not.toHaveBeenCalled();
      const statsSelector = screen.getByTestId('ce-community-session-select');
      const settingsSelector = screen.getByTestId('settings-selector');
      const allValue = Array.from(statsSelector.options).find((option) => option.text === 'ALL').value;
      fireEvent.click(screen.getByTestId('ce-community-stat-users'));
      const usersSelector = await screen.findByTestId('ce-community-users-session-select');
      expect(usersSelector).toHaveValue('alpha');
      fireEvent.change(usersSelector, { target: { value: allValue } });
      await waitFor(() =>
        expect(screen.getByTestId('ce-community-stat-questions')).toHaveAttribute('data-ce-count', '3'),
      );
      expect(settingsSelector).toHaveValue(allValue);
      expect(statsSelector).toHaveValue(allValue);
      await waitFor(() => expect(statsInstance.state.filteredUsers).toEqual(['0x1', '0x2']));
      expect(screen.getByTestId('ce-community-stat-sessions')).toBeVisible();
      expect(screen.getByTestId('ce-community-stat-surveys')).toHaveAttribute('data-ce-count', '2');
      expect(ensureUniverse).toHaveBeenCalledTimes(1);
      fireEvent.change(settingsSelector, { target: { value: 'beta' } });
      await waitFor(() =>
        expect(screen.getByTestId('ce-community-stat-questions')).toHaveAttribute('data-ce-count', '2'),
      );
      expect(statsSelector).toHaveValue('beta');
      expect(usersSelector).toHaveValue('beta');
      await waitFor(() => expect(statsInstance.state.filteredUsers).toEqual(['0x2']));
      expect(screen.queryByTestId('ce-community-stat-sessions')).not.toBeInTheDocument();
      fireEvent.change(screen.getByTestId('settings-scope-mode'), { target: { value: 'list' } });
      fireEvent.change(statsSelector, { target: { value: 'alpha' } });
      await waitFor(() => expect(screen.getByTestId('settings-scope-mode')).toHaveValue('active'));
      expect(screen.queryByRole('button', { name: 'Save session settings' })).not.toBeInTheDocument();
      expect(store.getState().sessionState).toMatchObject({
        primarySessionSlug: 'alpha',
        selectedSessionScope: 'active',
      });
      fireEvent.change(settingsSelector, { target: { value: '' } });
      await waitFor(() =>
        expect(screen.getByTestId('ce-community-stat-questions')).toHaveAttribute('data-ce-count', '0'),
      );
      expect(statsSelector).toHaveValue('');
      expect(usersSelector).toHaveValue('');
      await waitFor(() => expect(statsInstance.state.filteredUsers).toEqual([]));
      fireEvent.change(statsSelector, { target: { value: allValue } });
      await waitFor(() =>
        expect(screen.getByTestId('ce-community-stat-questions')).toHaveAttribute('data-ce-count', '3'),
      );
      expect(ensureUniverse).toHaveBeenCalledTimes(1);
      expect(usersSelector).toHaveValue(allValue);
    } finally {
      view.unmount();
    }
  });

  it.each([
    { selectedSessionScope: 'active', primarySessionSlug: 'edge', selectedSessionSlugs: [], expected: ['edge'] },
    { selectedSessionScope: 'general', primarySessionSlug: '', selectedSessionSlugs: [], expected: [''] },
    {
      selectedSessionScope: 'list',
      primarySessionSlug: 'edge',
      selectedSessionSlugs: ['edge', 'alpha'],
      expected: ['edge', 'alpha'],
    },
  ])('hides Sessions and scopes details to the saved $selectedSessionScope selection', ({ expected, ...selection }) => {
    writeGlobalSessionSelection(selection);
    const instance = new CommunityTab({ activeSessionSlug: 'demo' });
    jest.spyOn(instance, 'listAllSlugs').mockReturnValue(['demo', '', 'edge', 'alpha']);
    expect(instance._getSelectedSessionSlugs()).toEqual(expected);
    expect(
      collectTreeNodes(instance.render(), (node) => node.props?.['data-testid'] === 'ce-community-stat-sessions'),
    ).toHaveLength(0);
    expect(
      collectTreeNodes(instance.render(), (node) => node.props?.testId === 'ce-community-session-select'),
    ).toHaveLength(1);
  });

  it('opens a session directory with authority totals and links independently of the selected stats scope', () => {
    jest.spyOn(chainGateway, 'getAllSessionEntries').mockReturnValue([
      [
        'cloud',
        { slug: 'cloud', sessionName: 'Cloud forum', sessionModeProfile: { authority: { mode: 'worker_canonical' } } },
      ],
      [
        'chain',
        {
          slug: 'chain',
          sessionName: 'Chain forum',
          sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } },
        },
      ],
    ]);
    jest.spyOn(sessionSources, 'getAllDemoSessionConfigs').mockReturnValue([]);
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: 'cloud' }));
    instance._refreshSessionCatalog();
    const [stat] = collectTreeNodes(
      instance.render(),
      (node) => node.props?.['data-testid'] === 'ce-community-stat-sessions',
    );
    expect(stat.type).toBe('button');
    expect(stat.props['data-ce-count']).toBe('2');
    stat.props.onClick();
    expect(instance.state).toMatchObject({ showModal: true, modalType: 'sessions', modalTitle: 'Sessions Details' });
    const content = instance.renderModalContent();
    expect(collectNodeText(content)).toContain('1Centralized1Decentralized');
    const links = collectTreeNodes(content, (node) => node.type === 'a');
    expect(links.map((node) => node.props.href)).toEqual(['/session/chain', '/session/cloud']);
    expect(collectTreeNodes(content, (node) => node.props?.['aria-label'] === 'Session list')[0].props.tabIndex).toBe(
      0,
    );
  });

  it('refreshes the session count when registry discovery changes and removes its listener on unmount', () => {
    const entries = jest.spyOn(chainGateway, 'getAllSessionEntries').mockReturnValue([]);
    jest.spyOn(sessionSources, 'getAllDemoSessionConfigs').mockReturnValue([]);
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    instance._scheduleNextStatsPoll = jest.fn();
    instance.componentDidMount();
    expect(instance.state.sessions).toHaveLength(0);
    entries.mockReturnValue([['new-session', { slug: 'new-session', sessionName: 'New session' }]]);
    window.dispatchEvent(new Event(SESSION_REGISTRY_CACHE_UPDATED_EVENT));
    expect(instance.state.sessions).toHaveLength(1);
    instance.componentWillUnmount();
    entries.mockClear();
    window.dispatchEvent(new Event(SESSION_REGISTRY_CACHE_UPDATED_EVENT));
    expect(entries).not.toHaveBeenCalled();
  });

  it('shows a useful empty state in the session directory', () => {
    const instance = new CommunityTab({});
    instance.state.modalType = 'sessions';
    expect(collectNodeText(instance.renderModalContent())).toContain('No sessions discovered yet.');
  });

  it('toggles session filters from the modal header, filters rows and counts, and clears them', () => {
    const instance = attachMutableSetState(new CommunityTab({}));
    instance.state.modalType = 'sessions';
    instance.state.modalTitle = 'Sessions Details';
    instance.state.sessions = [
      {
        slug: 'cloud',
        name: 'Cloud',
        kind: 'centralized',
        href: '/session/cloud',
        createdAt: new Date(2026, 1, 1).getTime(),
        lastActivityAt: new Date(2026, 1, 3).getTime(),
        adminAddresses: ['0x1111111111111111111111111111111111111111'],
      },
      {
        slug: 'chain',
        name: 'Chain',
        kind: 'decentralized',
        href: '/session/chain',
        createdAt: null,
        lastActivityAt: null,
        adminAddresses: [],
      },
    ];
    const toggle = () =>
      collectTreeNodes(instance.render(), (node) => node.props?.['aria-label'] === 'Session filters')[0];
    expect(toggle().props['aria-expanded']).toBe(false);
    expect(collectNodeText(instance.renderModalContent())).not.toContain('Sessions discovered by this app.');
    toggle().props.onClick();
    expect(toggle().props['aria-expanded']).toBe(true);
    const controls = () =>
      collectTreeNodes(instance.renderModalContent(), (node) => ['select', 'input'].includes(node.type));
    controls()
      .find((node) => node.type === 'select')
      .props.onChange({ target: { value: 'centralized' } });
    controls()
      .find((node) => node.props.type === 'search')
      .props.onChange({ target: { value: '0x1111' } });
    controls()
      .find((node) => node.props['aria-label'] === 'Date created from')
      .props.onChange({ target: { value: '2026-02-01' } });
    controls()
      .find((node) => node.props['aria-label'] === 'Last activity through')
      .props.onChange({ target: { value: '2026-02-03' } });
    expect(
      collectTreeNodes(instance.renderModalContent(), (node) => node.type === 'a').map((node) => node.props.href),
    ).toEqual(['/session/cloud']);
    expect(collectNodeText(instance.renderModalContent())).toContain('1 of 2 sessions1Centralized0Decentralized');
    // A disclosure button: no toggle-button state; the filtered summary describes it.
    const [summary] = collectTreeNodes(instance.renderModalContent(), (node) => node.props?.role === 'status');
    expect(toggle().props).not.toHaveProperty('aria-pressed');
    expect(toggle().props['aria-describedby']).toBe(summary.props.id);
    expect(collectNodeText(summary)).toBe('Filtered: 1 of 2 sessions');
    toggle().props.onClick();
    expect(toggle().props['aria-expanded']).toBe(false);
    // Collapsed filters stay mounted (hidden) so aria-controls always resolves.
    const panels = () =>
      collectTreeNodes(instance.renderModalContent(), (node) => node.props?.id === toggle().props['aria-controls']);
    expect(panels()).toHaveLength(1);
    expect(panels()[0].props.hidden).toBe(true);
    expect(collectTreeNodes(instance.renderModalContent(), (node) => node.type === 'a')).toHaveLength(1);
    toggle().props.onClick();
    controls()
      .find((node) => node.props.type === 'search')
      .props.onChange({ target: { value: 'unmatched' } });
    expect(collectNodeText(instance.renderModalContent())).toContain('No sessions match these filters.');
    collectTreeNodes(
      instance.renderModalContent(),
      (node) => node.type === 'button' && collectNodeText(node) === 'Clear filters',
    )[0].props.onClick();
    expect(collectTreeNodes(instance.renderModalContent(), (node) => node.type === 'a')).toHaveLength(2);
    expect(toggle().props['aria-describedby']).toBeUndefined();
    expect(panels()[0].props.hidden).toBe(false);
  });

  it('keeps undated sessions under a date filter and marks them date unavailable', () => {
    const instance = attachMutableSetState(new CommunityTab({}));
    instance.state.modalType = 'sessions';
    instance.state.sessions = [
      {
        slug: 'cloud',
        name: 'Cloud',
        kind: 'centralized',
        href: '/session/cloud',
        createdAt: null,
        lastActivityAt: null,
        adminAddresses: [],
      },
      {
        slug: 'chain',
        name: 'Chain',
        kind: 'decentralized',
        href: '/session/chain',
        createdAt: new Date(2026, 1, 1).getTime(),
        lastActivityAt: new Date(2026, 1, 1).getTime(),
        adminAddresses: [],
      },
    ];
    instance.state.sessionFilters = { ...instance.state.sessionFilters, createdFrom: '2026-03-01' };

    const content = instance.renderModalContent();
    expect(collectTreeNodes(content, (node) => node.type === 'a').map((node) => node.props.href)).toEqual([
      '/session/cloud',
    ]);
    expect(collectNodeText(content)).toContain('cloud · date unavailable');
    expect(collectNodeText(content)).toContain('1 of 2 sessions1Centralized0Decentralized');
  });

  it.each([false, true])('shows only the Stats counters while the lower panels are hidden (demo: %s)', (demo) => {
    const instance = new CommunityTab({ activeSessionSlug: 'cloud' });
    instance._shouldUseDemoBeeswarmData = jest.fn(() => demo);
    const tree = instance.render();
    const counters = collectTreeNodes(tree, (node) => node.type === 'button' && node.props?.['data-ce-count']);
    expect(counters.map((node) => node.props['data-testid'])).toEqual([
      'ce-community-stat-users',
      'ce-community-stat-questions',
      'ce-community-stat-surveys',
      'ce-community-stat-groups',
      'ce-community-stat-sessions',
    ]);
    for (const id of [
      'ce-community-session-section',
      'ce-community-session-scope',
      'ce-community-leaderboard-section',
      'ce-community-beeswarm-section',
    ]) {
      expect(collectTreeNodes(tree, (node) => node.props?.['data-testid'] === id)).toHaveLength(0);
    }
    expect(collectTreeNodes(tree, (node) => node.props?.['aria-label'] === 'Leaderboard filters')).toHaveLength(0);
    expect(collectTreeNodes(tree, (node) => node.type === BeeswarmPlot)).toHaveLength(0);
  });

  it.each([
    ['users', 'users'],
    ['questions', 'questions'],
    ['surveys', 'surveys'],
    ['groups', 'sbtgroups'],
    ['sessions', 'sessions'],
  ])('keeps the %s counter opening its detail modal after hiding the lower panels', (id, modalType) => {
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    attachMutableSetState(instance);
    const [counter] = collectTreeNodes(
      instance.render(),
      (node) => node.props?.['data-testid'] === `ce-community-stat-${id}`,
    );
    counter.props.onClick();
    expect(instance.state).toMatchObject({ showModal: true, modalType });
    const tree = instance.render();
    expect(collectTreeNodes(tree, (node) => node.type === Modal)[0].props.isOpen).toBe(true);
    if (modalType === 'questions') {
      const [body] = collectTreeNodes(tree, (node) => node.type === ModalBody);
      expect(collectTreeNodes(body, (node) => node.type === CommunitySessionDialog)).toHaveLength(1);
    }
  });

  it('names selected sessions and uses an all-session label for combined scope', () => {
    writeGlobalSessionSelection({ selectedSessionScope: 'list', selectedSessionSlugs: ['alpha', 'beta'] });
    jest.spyOn(chainGateway, 'getSessionConfigBySlug').mockReturnValue(null);
    jest.spyOn(chainGateway, 'getDemoSessionConfigBySlug').mockReturnValue(null);
    const instance = new CommunityTab({
      activeSessionSlug: 'alpha',
      sessionConfig: { slug: 'unrelated', sessionName: 'Wrong name' },
    });
    instance._getSelectedSessionSlugs = jest.fn(() => ['alpha', 'beta']);
    instance._shouldUseDemoBeeswarmData = jest.fn(() => false);
    instance._beeswarmPoints = [{ questionId: 'q1', total: 1 }];
    expect(instance._communityScopeLabel()).toBe('Sessions: alpha, beta');
    instance._isUniverseEnabled = jest.fn(() => true);
    expect(instance._communityScopeLabel()).toBe('All sessions');
  });

  it('reuses the scope label until its session inputs change', () => {
    writeGlobalSessionSelection({ selectedSessionScope: 'active', primarySessionSlug: 'alpha' });
    const configLookup = jest.spyOn(chainGateway, 'getSessionConfigBySlug').mockReturnValue(null);
    jest.spyOn(chainGateway, 'getDemoSessionConfigBySlug').mockReturnValue(null);
    const instance = new CommunityTab({ activeSessionSlug: 'alpha' });
    instance._getSelectedSessionSlugs = jest.fn(() => ['alpha']);

    expect(instance._communityScopeLabel()).toBe('Session: alpha');
    expect(instance._communityScopeLabel()).toBe('Session: alpha');
    expect(instance._getSelectedSessionSlugs).toHaveBeenCalledTimes(1);
    expect(configLookup).toHaveBeenCalledTimes(1);

    // A refreshed session catalog (registry or Worker records changed) recomputes it.
    instance.state.sessions = [...instance.state.sessions];
    configLookup.mockReturnValue({ slug: 'alpha', sessionName: 'Alpha forum' });
    expect(instance._communityScopeLabel()).toBe('Session: Alpha forum (alpha)');
    expect(instance._getSelectedSessionSlugs).toHaveBeenCalledTimes(2);
  });

  it('labels bundled demo fallback separately from the selected live session', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'cloud' });
    instance._shouldUseDemoBeeswarmData = jest.fn(() => false);
    instance._beeswarmPoints = [{ questionId: 'demo-question', total: 0 }];
    instance._isZeroResponseBundledDemoPointSet = jest.fn(() => true);
    instance._buildDemoBeeswarmPoints = jest.fn(() => [{ questionId: 'demo-question', total: 10 }]);
    instance._sessionDisplayName = jest.fn((slug) => slug);
    expect(instance._getQuestionSwarmView()).toEqual({
      points: [{ questionId: 'demo-question', total: 10 }],
      scopeLabel: 'Demo session: demo',
      isDemoFallback: true,
    });
  });

  it('keeps /session/debate as its explicit slug', () => {
    window.history.pushState({}, '', '/session/debate');
    const instance = new CommunityTab({ activeSessionSlug: null });
    expect(instance._currentSlug()).toBe('debate');
    window.history.pushState({}, '', '/');
  });

  it('inherits the global active-session scope before any local community override', () => {
    localStorage.setItem('ce:primarySessionSlug', 'edge');
    localStorage.setItem('ce:selectedSessionScope', 'active');
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });

    expect(instance._isUniverseEnabled()).toBe(false);
    expect(instance._getSelectedSessionSlugs()).toEqual(['edge']);
  });

  it('inherits the full global list scope without collapsing it to a single session', () => {
    localStorage.setItem('ce:primarySessionSlug', 'edge');
    localStorage.setItem('ce:selectedSessionScope', 'list');
    localStorage.setItem('ce:selectedSessionSlugs', JSON.stringify(['general', 'edge']));
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });

    expect(instance._isUniverseEnabled()).toBe(false);
    expect(instance._getSelectedSessionSlugs()).toEqual(expect.arrayContaining(['', 'edge']));
    expect(instance._getSelectedSessionSlugs()).toHaveLength(2);
  });

  it('keeps single-session readiness false when the latest block is unavailable', async () => {
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    instance._iterScopeCaches = jest.fn(() => [
      {
        slug: 'edge',
        netKey: '84532',
        surveysCache: { surveysLatestBlock: 10 },
        questionsCache: { questionsLatestBlock: 10 },
        sbtCache: { lastBlock: 10 },
      },
    ]);
    jest.spyOn(contractScripts, 'getRelevantBlockWindowForFilter').mockResolvedValue({ toBlock: 0 });

    await expect(instance.checkIfInitialLoadDone()).resolves.toBe(false);
  });

  it('does not wait in ALL for a chain session this browser holds nothing for', async () => {
    const instance = new CommunityTab({ activeSessionSlug: 'picked' });
    const worker = (slug) => ({
      slug,
      isWorkerCanonical: true,
      workerCanonicalIdentity: null,
      workerGroupsStatus: 'idle',
      sessionConfig: { slug, corsWorkerUrl: `https://${slug}.example.workers.dev` },
      questionsCache: {},
      surveysCache: {},
    });
    instance._iterScopeCaches = jest.fn(() => [
      worker('picked'),
      { slug: '', netKey: '11155420', surveysCache: {}, questionsCache: {}, sbtCache: {} },
      worker('other'),
    ]);
    const blockSpy = jest.spyOn(contractScripts, 'getRelevantBlockWindowForFilter').mockResolvedValue({ toBlock: 10 });
    // Until each Worker session's listing is read, the view is still loading.
    await expect(instance.checkIfInitialLoadDone()).resolves.toBe(false);
    for (const slug of ['picked', 'other']) {
      instance._workerListingCounts.set(instance._workerListingKey(worker(slug)), {
        counts: { questions: 1, surveys: 0, responders: [] },
        failed: false,
        loading: false,
        at: Date.now(),
      });
    }
    await expect(instance.checkIfInitialLoadDone()).resolves.toBe(true);
    expect(blockSpy).not.toHaveBeenCalled();
  });

  it('checks readiness for a new selection, not trusting the flag of the one before', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: 'picked' }));
    instance.state = { ...instance.state, initialLoadDone: true, initialLoadSelectionKey: 'the one before' };
    expect(instance._computeFallbackPollDelayMs()).toBe(15000);
    jest.spyOn(instance, '_iterScopeCaches').mockReturnValue([]);
    jest.spyOn(instance, '_buildCommunityBeeswarmPoints').mockReturnValue([]);
    const check = jest.spyOn(instance, 'checkIfInitialLoadDone').mockResolvedValue(false);
    const poll = jest.spyOn(instance, '_scheduleNextStatsPoll').mockImplementation(() => {});
    // The first cycle of the new selection checks at once.
    await instance._runStatsRefreshCycle();
    expect(check).toHaveBeenCalledTimes(1);
    // The next, moments later, is put off by the short wait between checks: run when it may be, not at the next poll.
    await instance._runStatsRefreshCycle();
    expect(check).toHaveBeenCalledTimes(1);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(poll.mock.calls[0][0]).toBeGreaterThan(0);
    expect(poll.mock.calls[0][0]).toBeLessThanOrEqual(2000);
    check.mockResolvedValue(true);
    await instance._runStatsRefreshCycle({ force: true });
    expect(check).toHaveBeenCalledTimes(2);
    // The check runs beside the refresh, not inside it, so its answer lands a moment later.
    await waitFor(() => expect(instance.state.initialLoadDone).toBe(true));
    expect(instance._computeFallbackPollDelayMs()).toBe(60000);
  });

  it('still waits in ALL for the chain session whose page is open', async () => {
    const instance = new CommunityTab({ activeSessionSlug: 'here' });
    instance._iterScopeCaches = jest.fn(() =>
      ['here', 'elsewhere'].map((slug) => ({
        slug,
        netKey: '84532',
        surveysCache: {},
        questionsCache: {},
        sbtCache: {},
      })),
    );
    jest.spyOn(contractScripts, 'getRelevantBlockWindowForFilter').mockResolvedValue({ toBlock: 10 });
    await expect(instance.checkIfInitialLoadDone()).resolves.toBe(false);
  });

  it('keeps multi-session readiness false when any latest block is unavailable', async () => {
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    instance._iterScopeCaches = jest.fn(() =>
      ['edge', 'alpha'].map((slug) => ({
        slug,
        netKey: '84532',
        surveysCache: { surveysLatestBlock: 10 },
        questionsCache: { questionsLatestBlock: 10 },
        sbtCache: { lastBlock: 10 },
      })),
    );
    jest.spyOn(contractScripts, 'getRelevantBlockWindowForFilter').mockResolvedValue({ toBlock: 0 });

    await expect(instance.checkIfInitialLoadDone()).resolves.toBe(false);
  });

  it('uses authority-scoped Worker caches for Cloudflare questions and surveys', async () => {
    await writeWorkerStatsCaches({
      numericQuestions: {
        staleOne: { type: 'binary', prompt: 'Stale one' },
        staleTwo: { type: 'binary', prompt: 'Stale two' },
      },
      workerQuestions: {
        workerOne: { type: 'binary', prompt: 'Worker one' },
        workerTwo: { type: 'binary', prompt: 'Worker two' },
        workerThree: { type: 'multichoice', prompt: 'Worker three' },
      },
      numericSurveys: {
        staleOne: { title: 'Stale one' },
        staleTwo: { title: 'Stale two' },
      },
      workerSurveys: { workerSurvey: { title: 'Worker survey', questionIDs: ['workerOne'] } },
    });
    const instance = new CommunityTab({
      activeSessionSlug: 'demo-sh',
      sessionConfig: WORKER_SESSION_CONFIG,
    });

    const [scopeEntry] = instance._iterScopeCaches({ clone: false });
    const snapshot = instance._computeStatsSnapshot([scopeEntry]);

    expect(scopeEntry).toEqual(
      expect.objectContaining({
        slug: 'demo-sh',
        cacheScope: WORKER_CANONICAL_CACHE_SCOPE_KEY,
        isWorkerCanonical: true,
      }),
    );
    expect(Object.keys(scopeEntry.questionsCache.questions)).toEqual(['workerOne', 'workerTwo', 'workerThree']);
    expect(Object.keys(scopeEntry.surveysCache.surveys)).toEqual(['workerSurvey']);
    expect(snapshot.uniqueQuestionsCount).toBe(3);
    expect(snapshot.surveysCreatedCount).toBe(1);
  });

  it('counts the public Worker group catalog for an active Cloudflare session', async () => {
    writeGlobalSessionSelection({ selectedSessionScope: 'active', primarySessionSlug: 'demo-sh' });
    await writeWorkerStatsCaches();
    jest.spyOn(workerGroupPorts, 'loadPublicWorkerGroups').mockResolvedValue([
      {
        groupId: 'reviewers',
        sessionSlug: 'demo-sh',
        label: 'Reviewers',
        adminAddress: '0x0000000000000000000000000000000000000011',
        joinMode: 'open',
        memberVisibility: 'session',
      },
      {
        groupId: 'facilitators',
        sessionSlug: 'demo-sh',
        label: 'Facilitators',
        joinMode: 'open',
        memberVisibility: 'session',
      },
    ]);
    const instance = attachMutableSetState(
      new CommunityTab({
        activeSessionSlug: 'demo-sh',
        sessionConfig: WORKER_SESSION_CONFIG,
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
      }),
    );
    jest.spyOn(instance, '_shouldUseDemoBeeswarmData').mockReturnValue(false);

    await instance._runStatsRefreshCycle({ force: true, markLoading: false });

    expect(workerGroupPorts.loadPublicWorkerGroups).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: WORKER_SESSION_CONFIG.sessionId,
        sessionSlug: 'demo-sh',
      }),
    );
    expect(instance.state.stats.find((stat) => stat.label === 'Questions').count).toBe(1);
    expect(instance.state.stats.find((stat) => stat.label === 'Surveys').count).toBe(1);
    expect(instance.state.stats.find((stat) => stat.label === 'Groups').count).toBe(2);
    expect(instance.state.stats.find((stat) => stat.label === 'Users').count).toBe(3);
    expect(instance.state.uniqueUsers).toContain('0x0000000000000000000000000000000000000011');
  });

  it('publishes cached Stats while a Worker sign-in is still unanswered', async () => {
    writeGlobalSessionSelection({ selectedSessionScope: 'active', primarySessionSlug: 'demo-sh' });
    await writeWorkerStatsCaches();
    let answerSignIn = () => {};
    jest
      .spyOn(workerAuth, 'getWorkerSessionToken')
      .mockImplementation(() => new Promise((resolve) => (answerSignIn = () => resolve('worker-token'))));
    jest.spyOn(workerGroupPorts, 'loadWorkerGroupOverview').mockResolvedValue({ groups: [], memberships: [] });
    const instance = attachMutableSetState(
      new CommunityTab({
        activeSessionSlug: 'demo-sh',
        sessionConfig: WORKER_SESSION_CONFIG,
        account: '0x00000000000000000000000000000000000000aa',
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
      }),
    );
    jest.spyOn(instance, '_shouldUseDemoBeeswarmData').mockReturnValue(false);
    jest.spyOn(instance, 'checkIfInitialLoadDone').mockResolvedValue(true);
    const queueRefresh = jest.spyOn(instance, '_queueCacheDrivenRefresh').mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      const refresh = instance._refreshCommunityStats({ force: true, markLoading: true });
      await jest.advanceTimersByTimeAsync(WORKER_GROUP_COUNT_WAIT_MS);

      expect(instance.state.stats.find((stat) => stat.label === 'Questions').count).toBe(1);
      expect(instance.state.loadingSurveyData).toBe(false);
      expect(instance._statsRefreshInFlight).toBe(false);
      // Only the light refresh a finished listing read asks for; nothing forces a recount.
      expect(queueRefresh).not.toHaveBeenCalledWith({ force: true });

      answerSignIn();
      await jest.advanceTimersByTimeAsync(0);
      expect(queueRefresh).toHaveBeenCalledWith({ force: true });
      await refresh;
    } finally {
      jest.useRealTimers();
    }
  });

  it('waits for a late Worker group count only once', async () => {
    jest.spyOn(workerAuth, 'getWorkerSessionToken').mockImplementation(() => new Promise(() => {}));
    const instance = new CommunityTab({
      activeSessionSlug: 'demo-sh',
      sessionConfig: WORKER_SESSION_CONFIG,
      account: '0x00000000000000000000000000000000000000aa',
    });
    jest.spyOn(instance, '_queueCacheDrivenRefresh').mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      const first = instance._hydrateWorkerGroupCounts(instance._buildScopeEntriesFromSlugs(['demo-sh']));
      await jest.advanceTimersByTimeAsync(WORKER_GROUP_COUNT_WAIT_MS);
      await first;

      let secondDone = false;
      const second = instance
        ._hydrateWorkerGroupCounts(instance._buildScopeEntriesFromSlugs(['demo-sh']))
        .then(() => (secondDone = true));
      await jest.advanceTimersByTimeAsync(0);
      expect(secondDone).toBe(true);
      await second;
    } finally {
      jest.useRealTimers();
    }
  });

  it('only authenticates the active Worker while counting the broader catalog', async () => {
    const token = jest.spyOn(workerAuth, 'getWorkerSessionToken').mockResolvedValue('worker-token');
    jest
      .spyOn(workerGroupPorts, 'loadWorkerGroupOverview')
      .mockResolvedValue({ groups: [{ groupId: 'private-active' }], memberships: [] });
    const publicGroups = jest
      .spyOn(workerGroupPorts, 'loadPublicWorkerGroups')
      .mockResolvedValue([{ groupId: 'public-catalog' }]);
    const instance = new CommunityTab({
      activeSessionSlug: 'demo-sh',
      sessionConfig: WORKER_SESSION_CONFIG,
      account: '0xparticipant',
    });
    const entries = instance._buildScopeEntriesFromSlugs(['demo-sh', 'demo-interview']);
    await instance._hydrateWorkerGroupCounts(entries);
    expect(token.mock.calls.map(([request]) => request.sessionSlug)).toEqual(['demo-sh']);
    expect(publicGroups).toHaveBeenCalledWith(expect.objectContaining({ sessionSlug: 'demo-interview' }));
    expect(entries.map((entry) => entry.workerGroupIds)).toEqual([['private-active'], ['public-catalog']]);
    expect(instance._getWorkerGroupCountCacheKey(entries[1].workerCanonicalIdentity)).toMatch(/\nanonymous$/);
    instance.props = { ...instance.props, activeSessionSlug: 'demo-interview' };
    const nextEntries = instance._buildScopeEntriesFromSlugs(['demo-sh', 'demo-interview']);
    expect(nextEntries.map((entry) => entry.workerGroupIds)).toEqual([[], []]);
    await instance._hydrateWorkerGroupCounts(nextEntries);
    expect(token.mock.calls.map(([request]) => request.sessionSlug)).toEqual(['demo-sh', 'demo-interview']);
    expect(nextEntries.map((entry) => entry.workerGroupIds)).toEqual([['public-catalog'], ['private-active']]);
  });

  it('counts only public groups, without asking, when signing in would prompt', async () => {
    const token = jest
      .spyOn(workerAuth, 'getWorkerSessionToken')
      .mockRejectedValue(new workerAuth.WorkerSignInNeededError());
    const overview = jest.spyOn(workerGroupPorts, 'loadWorkerGroupOverview');
    jest.spyOn(workerGroupPorts, 'loadPublicWorkerGroups').mockResolvedValue([{ groupId: 'public-catalog' }]);
    const instance = new CommunityTab({
      activeSessionSlug: 'demo-sh',
      sessionConfig: WORKER_SESSION_CONFIG,
      account: '0xparticipant',
    });
    const entries = instance._buildScopeEntriesFromSlugs(['demo-sh']);
    await instance._hydrateWorkerGroupCounts(entries);
    expect(token).toHaveBeenCalledWith(expect.objectContaining({ prompt: false }));
    expect(overview).not.toHaveBeenCalled();
    expect(entries.map((entry) => entry.workerGroupIds)).toEqual([['public-catalog']]);
  });

  it('counts nothing on a private session, without asking or failing, when signing in would prompt', async () => {
    const token = jest
      .spyOn(workerAuth, 'getWorkerSessionToken')
      .mockRejectedValue(new workerAuth.WorkerSignInNeededError());
    const publicGroups = jest.spyOn(workerGroupPorts, 'loadPublicWorkerGroups').mockResolvedValue([]);
    const instance = new CommunityTab({
      activeSessionSlug: 'demo-sh',
      sessionConfig: WORKER_SESSION_CONFIG,
      account: '0xparticipant',
    });
    const [entry] = instance._buildScopeEntriesFromSlugs(['demo-sh']);
    entry.sessionConfig = {
      ...entry.sessionConfig,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    await instance._hydrateWorkerGroupCounts([entry]);
    expect(token).toHaveBeenCalledWith(expect.objectContaining({ prompt: false }));
    expect(publicGroups).not.toHaveBeenCalled();
    expect(entry.workerGroupsStatus).toBe('unavailable');
  });

  it('does not turn a nonactive gated Worker into an anonymous group read', async () => {
    const token = jest.spyOn(workerAuth, 'getWorkerSessionToken').mockResolvedValue('worker-token');
    const publicGroups = jest.spyOn(workerGroupPorts, 'loadPublicWorkerGroups').mockResolvedValue([]);
    const instance = new CommunityTab({
      activeSessionSlug: 'demo-sh',
      sessionConfig: WORKER_SESSION_CONFIG,
      account: '0xparticipant',
    });
    const [entry] = instance._buildScopeEntriesFromSlugs(['demo-interview']);
    entry.sessionConfig = {
      ...entry.sessionConfig,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    await instance._hydrateWorkerGroupCounts([entry]);
    expect(token).not.toHaveBeenCalled();
    expect(publicGroups).not.toHaveBeenCalled();
    expect(entry.workerGroupsStatus).toBe('unavailable');
  });

  it('counts every Questions table row while the plot remains binary-only', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: 'edge' }));
    const entries = ['edge', 'other'].map((slug) => ({
      slug,
      netKey: '11155420',
      sessionConfig: { slug },
      surveysCache: {},
      sbtCache: {},
      questionsCache: {
        questions: {
          repeated: { type: 'binary', prompt: 'Binary prompt' },
          text: { type: 'freeform', prompt: 'Text prompt' },
        },
      },
    }));
    jest.spyOn(instance, '_iterScopeCaches').mockReturnValue(entries);
    jest.spyOn(instance, 'checkIfInitialLoadDone').mockResolvedValue(true);
    await instance._runStatsRefreshCycle({ force: true });
    expect(instance._getQuestionDetailsRows(entries)).toHaveLength(4);
    expect(instance.state.stats.find(({ label }) => label === 'Questions').count).toBe(4);
    expect(instance._beeswarmPoints).toHaveLength(1);
  });

  it('keeps zero counts pending until this selection is ready and never flashes prior counts', async () => {
    const selection = { primarySessionSlug: 'alpha', selectedSessionScope: 'active', selectedSessionSlugs: [] };
    const instance = attachMutableSetState(new CommunityTab({ globalSessionSelection: selection }));
    const tile = (label) =>
      collectTreeNodes(instance.render(), (node) => node.props?.['data-testid'] === `ce-community-stat-${label}`)[0];
    jest.spyOn(instance, '_iterScopeCaches').mockReturnValue([]);
    jest.spyOn(instance, 'checkIfInitialLoadDone').mockResolvedValue(false);
    await instance._runStatsRefreshCycle({ force: true });
    expect(collectNodeText(tile('questions'))).toBe('Questions');
    expect(tile('questions').props['aria-busy']).toBe(true);
    instance.checkIfInitialLoadDone.mockResolvedValue(true);
    await instance._runStatsRefreshCycle({ force: true });
    // The readiness check runs beside the refresh, so its answer lands a moment after it.
    await waitFor(() => expect(collectNodeText(tile('questions'))).toBe('0Questions'));
    instance.state.stats = instance._buildStatsArray(instance.state.stats, {
      users: 7,
      questions: 9,
      surveys: 4,
      groups: 3,
    });
    instance.props = { ...instance.props, globalSessionSelection: { ...selection, primarySessionSlug: 'beta' } };
    expect(collectNodeText(tile('questions'))).toBe('Questions');
    instance.checkIfInitialLoadDone.mockResolvedValue(false);
    await instance._runStatsRefreshCycle({ force: true });
    expect(collectNodeText(tile('questions'))).toBe('Questions');
    instance.checkIfInitialLoadDone.mockResolvedValue(true);
    await instance._runStatsRefreshCycle({ force: true });
    await waitFor(() => expect(collectNodeText(tile('questions'))).toBe('0Questions'));
  });

  it('counts a Worker session from its own listings, whichever session the app has loaded', async () => {
    const A = '0x00000000000000000000000000000000000000aa';
    const B = '0x00000000000000000000000000000000000000bb';
    // The dropdown names a session that is not the app's current one, so the caches hold nothing for it.
    const selection = { primarySessionSlug: 'other', selectedSessionScope: 'active', selectedSessionSlugs: [] };
    const instance = attachMutableSetState(new CommunityTab({ globalSessionSelection: selection }));
    const tile = (label) =>
      collectTreeNodes(instance.render(), (node) => node.props?.['data-testid'] === `ce-community-stat-${label}`)[0];
    const entry = {
      slug: 'other',
      isWorkerCanonical: true,
      // Its Settings hide one question: the count leaves it out, as the session page does.
      sessionConfig: {
        slug: 'other',
        corsWorkerUrl: 'https://other.example.workers.dev',
        BLOCKED_QUESTION_IDS: ['Q-Hidden'],
      },
      workerGroupsStatus: 'ready',
      questionsCache: {},
      surveysCache: {},
    };
    let release;
    mockListingCounts.other = undefined;
    const { loadWorkerListingCounts } = jest.requireMock('./communityWorkerListingCounts');
    loadWorkerListingCounts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    jest.spyOn(instance, '_iterScopeCaches').mockReturnValue([entry]);
    jest.spyOn(instance, '_hydrateWorkerGroupCounts').mockResolvedValue(undefined);
    jest.spyOn(instance, '_computeStatsSnapshot').mockImplementation(() => ({
      uniqueUsers: [],
      surveysCreatedCount: 0,
      surveyResponsesCount: 0,
      uniqueQuestionsCount: 0,
      surveysList: [],
      sbtsCreatedCount: 0,
    }));
    jest.spyOn(instance, '_buildCommunityBeeswarmPoints').mockReturnValue([]);
    jest.spyOn(instance, 'checkIfInitialLoadDone').mockResolvedValue(true);

    // While its listings are being read the three tiles say loading: never a zero that was not read.
    await instance._runStatsRefreshCycle({ force: true });
    expect(loadWorkerListingCounts).toHaveBeenCalledWith(
      expect.objectContaining({ sessionSlug: 'other', hiddenQuestionIds: ['q-hidden'] }),
    );
    // A changed list is a new read, not the held count.
    expect(instance._workerListingKey(entry)).not.toBe(
      instance._workerListingKey({ ...entry, sessionConfig: { ...entry.sessionConfig, BLOCKED_QUESTION_IDS: [] } }),
    );
    expect(tile('questions').props['aria-busy']).toBe(true);
    expect(collectNodeText(tile('questions'))).toBe('Questions');
    expect(tile('users').props['aria-busy']).toBe(true);
    expect(tile('surveys')).toBeUndefined();

    // The listings arrive: forty questions, two people, no surveys.
    release({ questions: 40, surveys: 0, responders: [A, B] });
    await settleListingCounts(instance);
    expect(collectNodeText(tile('questions'))).toBe('40Questions');
    expect(collectNodeText(tile('users'))).toBe('2Users');
    expect(tile('questions').props['aria-busy']).toBe(false);
    // None were listed, so this session has no Surveys tile; the ALL view keeps it.
    expect(tile('surveys')).toBeUndefined();
    jest.spyOn(instance, '_isUniverseEnabled').mockReturnValue(true);
    expect(tile('surveys')).toBeDefined();
  });

  it('shows no number for a Worker session whose listings could not be read', async () => {
    const selection = { primarySessionSlug: 'closed', selectedSessionScope: 'active', selectedSessionSlugs: [] };
    const instance = attachMutableSetState(new CommunityTab({ globalSessionSelection: selection }));
    const tile = (label) =>
      collectTreeNodes(instance.render(), (node) => node.props?.['data-testid'] === `ce-community-stat-${label}`)[0];
    mockListingCounts.closed = new Error('Storage list failed (401).');
    jest.spyOn(instance, '_iterScopeCaches').mockReturnValue([
      {
        slug: 'closed',
        isWorkerCanonical: true,
        sessionConfig: { slug: 'closed', corsWorkerUrl: 'https://closed.example.workers.dev' },
        workerGroupsStatus: 'ready',
        questionsCache: {},
        surveysCache: {},
      },
    ]);
    jest.spyOn(instance, '_hydrateWorkerGroupCounts').mockResolvedValue(undefined);
    jest.spyOn(instance, '_computeStatsSnapshot').mockImplementation(() => ({
      uniqueUsers: ['0x1'],
      surveysCreatedCount: 3,
      surveyResponsesCount: 0,
      uniqueQuestionsCount: 5,
      surveysList: [],
      sbtsCreatedCount: 0,
    }));
    jest.spyOn(instance, '_buildCommunityBeeswarmPoints').mockReturnValue([]);
    jest.spyOn(instance, 'checkIfInitialLoadDone').mockResolvedValue(true);
    await instance._runStatsRefreshCycle({ force: true });
    await settleListingCounts(instance);
    // Whatever the caches hold for it is not shown as its count.
    expect(collectNodeText(tile('questions'))).toBe('–Questions');
    expect(collectNodeText(tile('users'))).toBe('–Users');
    expect(tile('questions').props['aria-busy']).toBe(false);
  });

  it('keeps each tile to what was read: no people count where answers are private, and a plus for a partial sum', async () => {
    const selection = { primarySessionSlug: 'one', selectedSessionScope: 'active', selectedSessionSlugs: [] };
    const instance = attachMutableSetState(new CommunityTab({ globalSessionSelection: selection }));
    const tile = (label) =>
      collectTreeNodes(instance.render(), (node) => node.props?.['data-testid'] === `ce-community-stat-${label}`)[0];
    const entry = (slug) => ({
      slug,
      isWorkerCanonical: true,
      sessionConfig: { slug, corsWorkerUrl: `https://${slug}.example.workers.dev` },
      workerGroupsStatus: 'ready',
      questionsCache: {},
      surveysCache: {},
    });
    // Its questions were listed; its answers were not (each person is listed only their own there).
    mockListingCounts.one = { questions: 5, surveys: 0, responders: null };
    mockListingCounts.two = new Error('Storage list failed (403).');
    const scope = jest.spyOn(instance, '_iterScopeCaches').mockReturnValue([entry('one')]);
    jest.spyOn(instance, '_hydrateWorkerGroupCounts').mockResolvedValue(undefined);
    jest.spyOn(instance, '_computeStatsSnapshot').mockImplementation(() => ({
      uniqueUsers: [],
      surveysCreatedCount: 0,
      surveyResponsesCount: 0,
      uniqueQuestionsCount: 0,
      surveysList: [],
      sbtsCreatedCount: 0,
    }));
    jest.spyOn(instance, '_buildCommunityBeeswarmPoints').mockReturnValue([]);
    jest.spyOn(instance, 'checkIfInitialLoadDone').mockResolvedValue(true);
    await instance._runStatsRefreshCycle({ force: true });
    await settleListingCounts(instance);
    expect(collectNodeText(tile('questions'))).toBe('5Questions');
    expect(collectNodeText(tile('users'))).toBe('–Users');

    // With a second session whose listings were refused, the sum says it leaves something out.
    scope.mockReturnValue([entry('one'), entry('two')]);
    await instance._runStatsRefreshCycle({ force: true });
    await settleListingCounts(instance);
    expect(collectNodeText(tile('questions'))).toBe('5+Questions');
  });

  it('settles a Worker session never opened here: its groups show as unread and nothing waits on them', async () => {
    const selection = { primarySessionSlug: 'unopened', selectedSessionScope: 'active', selectedSessionSlugs: [] };
    const instance = attachMutableSetState(new CommunityTab({ globalSessionSelection: selection }));
    const tile = (label) =>
      collectTreeNodes(instance.render(), (node) => node.props?.['data-testid'] === `ce-community-stat-${label}`)[0];
    mockListingCounts.unopened = {
      questions: 4,
      surveys: 0,
      responders: ['0x0000000000000000000000000000000000000001'],
    };
    // No Worker identity on this device, so no group count is ever started for it.
    jest.spyOn(instance, '_iterScopeCaches').mockReturnValue([
      {
        slug: 'unopened',
        isWorkerCanonical: true,
        workerCanonicalIdentity: null,
        sessionConfig: { slug: 'unopened', corsWorkerUrl: 'https://unopened.example.workers.dev' },
        workerGroupsStatus: 'idle',
        questionsCache: {},
        surveysCache: {},
      },
    ]);
    jest.spyOn(instance, '_buildCommunityBeeswarmPoints').mockReturnValue([]);
    await instance._runStatsRefreshCycle({ force: true });
    await settleListingCounts(instance);
    expect(collectNodeText(tile('questions'))).toBe('4Questions');
    expect(collectNodeText(tile('groups'))).toMatch(/^–/);
    expect(tile('groups').props['aria-busy']).toBe(false);
    await expect(instance.checkIfInitialLoadDone()).resolves.toBe(true);
    expect(instance.state.initialLoadDone).toBe(true);
  });

  it('leaves a Worker whose listing does not answer in time out of the sum, and adds it when it answers', async () => {
    const selection = { primarySessionSlug: 'one', selectedSessionScope: 'active', selectedSessionSlugs: [] };
    const instance = attachMutableSetState(new CommunityTab({ globalSessionSelection: selection }));
    const tile = (label) =>
      collectTreeNodes(instance.render(), (node) => node.props?.['data-testid'] === `ce-community-stat-${label}`)[0];
    const entry = (slug) => ({
      slug,
      isWorkerCanonical: true,
      sessionConfig: { slug, corsWorkerUrl: `https://${slug}.example.workers.dev` },
      workerGroupsStatus: 'ready',
      questionsCache: {},
      surveysCache: {},
    });
    mockListingCounts.one = { questions: 5, surveys: 0, responders: [] };
    let answerSlow;
    const { loadWorkerListingCounts } = jest.requireMock('./communityWorkerListingCounts');
    loadWorkerListingCounts.mockClear();
    loadWorkerListingCounts.mockImplementation(async ({ sessionSlug }) =>
      sessionSlug === 'slow' ? new Promise((resolve) => (answerSlow = resolve)) : mockListingCounts[sessionSlug],
    );
    jest.spyOn(instance, '_iterScopeCaches').mockReturnValue([entry('one'), entry('slow')]);
    jest.spyOn(instance, '_queueCacheDrivenRefresh').mockImplementation(() => {});
    jest.spyOn(instance, '_buildCommunityBeeswarmPoints').mockReturnValue([]);
    jest.spyOn(instance, 'checkIfInitialLoadDone').mockResolvedValue(false);
    jest.useFakeTimers();
    try {
      await instance._runStatsRefreshCycle({ force: true });
      await settleListingCounts(instance);
      expect(tile('questions').props['aria-busy']).toBe(true);

      await jest.advanceTimersByTimeAsync(WORKER_LISTING_COUNTS_WAIT_MS);
      await instance._runStatsRefreshCycle({ force: true });
      expect(collectNodeText(tile('questions'))).toBe('5+Questions');
      expect(tile('questions').props['aria-busy']).toBe(false);

      answerSlow({ questions: 2, surveys: 0, responders: [] });
      await settleListingCounts(instance);
      expect(collectNodeText(tile('questions'))).toBe('7Questions');
      // Kept for the visit: no second read of either.
      await instance._runStatsRefreshCycle({ force: true });
      expect(loadWorkerListingCounts).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
      loadWorkerListingCounts.mockReset();
      loadWorkerListingCounts.mockImplementation(async ({ sessionSlug }) => {
        const counts = mockListingCounts[sessionSlug];
        if (counts instanceof Error) throw counts;
        return counts || { questions: 0, surveys: 0, responders: [] };
      });
    }
  });

  // The readiness check reads each chain session's latest block, one at a time and with retries, so in the ALL
  // view it can take minutes. A refresh that waited on it held every later refresh of the same choice, and the
  // counts that came in meanwhile stayed on spinners until it was done.
  it('shows the counts that come in while the readiness check is still out', async () => {
    const selection = { primarySessionSlug: 'one', selectedSessionScope: 'active', selectedSessionSlugs: [] };
    const instance = attachMutableSetState(new CommunityTab({ globalSessionSelection: selection }));
    const tile = (label) =>
      collectTreeNodes(instance.render(), (node) => node.props?.['data-testid'] === `ce-community-stat-${label}`)[0];
    let answerListing;
    const { loadWorkerListingCounts } = jest.requireMock('./communityWorkerListingCounts');
    loadWorkerListingCounts.mockImplementationOnce(() => new Promise((resolve) => (answerListing = resolve)));
    jest.spyOn(instance, '_iterScopeCaches').mockReturnValue([
      {
        slug: 'one',
        isWorkerCanonical: true,
        sessionConfig: { slug: 'one', corsWorkerUrl: 'https://one.example.workers.dev' },
        workerGroupsStatus: 'ready',
        questionsCache: {},
        surveysCache: {},
      },
    ]);
    jest.spyOn(instance, '_buildCommunityBeeswarmPoints').mockReturnValue([]);
    const check = jest.spyOn(instance, 'checkIfInitialLoadDone').mockReturnValue(new Promise(() => {}));
    try {
      void instance._refreshCommunityStats({ force: true });
      await waitFor(() => expect(check).toHaveBeenCalled());
      expect(tile('questions').props['aria-busy']).toBe(true);
      // The listing answers once the check is out.
      answerListing({ questions: 3, surveys: 0, responders: ['0x0000000000000000000000000000000000000001'] });
      await waitFor(() => expect(collectNodeText(tile('questions'))).toBe('3Questions'));
      expect(collectNodeText(tile('users'))).toBe('1Users');
      expect(tile('questions').props['aria-busy']).toBe(false);
      // One check at a time for a choice, however many refreshes run meanwhile.
      expect(check).toHaveBeenCalledTimes(1);
    } finally {
      instance._isUnmounted = true;
      instance._clearStatsPollTimer();
    }
  });

  it('marks a Worker group count with no answer in time as unread, until the answer comes', async () => {
    let answer;
    jest
      .spyOn(workerAuth, 'getWorkerSessionToken')
      .mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const instance = new CommunityTab({
      activeSessionSlug: 'demo-sh',
      sessionConfig: WORKER_SESSION_CONFIG,
      account: '0x00000000000000000000000000000000000000aa',
    });
    jest.spyOn(instance, '_queueCacheDrivenRefresh').mockImplementation(() => {});
    const status = () => instance._buildScopeEntriesFromSlugs(['demo-sh'])[0].workerGroupsStatus;
    jest.useFakeTimers();
    try {
      const hydrated = instance._hydrateWorkerGroupCounts(instance._buildScopeEntriesFromSlugs(['demo-sh']));
      await jest.advanceTimersByTimeAsync(WORKER_GROUP_COUNT_WAIT_MS);
      await hydrated;
      expect(status()).toBe('loading');
      await jest.advanceTimersByTimeAsync(WORKER_GROUP_COUNT_TIMEOUT_MS);
      expect(status()).toBe('error');
      // The Worker answers late: no token, so the public groups are counted after all, and Stats is refreshed.
      const refreshes = instance._queueCacheDrivenRefresh.mock.calls.length;
      answer('');
      await jest.advanceTimersByTimeAsync(0);
      expect(status()).toBe('ready');
      expect(instance._queueCacheDrivenRefresh.mock.calls.length).toBe(refreshes + 1);

      // Counted again later: while that runs, the tile keeps what was counted rather than a spinner.
      jest.spyOn(workerAuth, 'getWorkerSessionToken').mockImplementation(() => new Promise(() => {}));
      await jest.advanceTimersByTimeAsync(60_000);
      void instance._hydrateWorkerGroupCounts(instance._buildScopeEntriesFromSlugs(['demo-sh']));
      await jest.advanceTimersByTimeAsync(WORKER_GROUP_COUNT_WAIT_MS);
      expect(status()).toBe('ready');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not mistake an empty identity-bound Worker cache for completed metadata hydration', async () => {
    writeGlobalSessionSelection({ selectedSessionScope: 'active', primarySessionSlug: 'demo-sh' });
    await writeWorkerStatsCaches({ workerQuestions: {}, workerQuestionResponses: {}, workerSurveys: {} });
    const instance = new CommunityTab({ activeSessionSlug: 'demo-sh', sessionConfig: WORKER_SESSION_CONFIG });
    const [entry] = instance._iterScopeCaches();
    entry.workerGroupsStatus = 'ready';
    expect(instance._isWorkerScopeEntryReady(entry)).toBe(false);
    instance.props = { ...instance.props, isQuestionCacheReady: true, isSurveyCacheReady: true };
    expect(instance._isWorkerScopeEntryReady(entry)).toBe(true);
    entry.questionsCache.workerMetadataHydrationStatus = 'loading';
    entry.surveysCache.workerMetadataHydrationStatus = 'loading';
    expect(instance._isWorkerScopeEntryReady(entry)).toBe(false);
    instance.props = { ...instance.props, activeSessionSlug: 'another-worker' };
    expect(instance._isWorkerScopeEntryReady(entry)).toBe(false);
    entry.questionsCache.workerMetadataHydrationStatus = 'complete';
    entry.surveysCache.workerMetadataHydrationStatus = 'complete';
    expect(instance._isWorkerScopeEntryReady(entry)).toBe(true);
  });

  it('counts authorized Worker groups for a signed-in Cloudflare session', async () => {
    writeGlobalSessionSelection({ selectedSessionScope: 'active', primarySessionSlug: 'demo-sh' });
    await writeWorkerStatsCaches();
    jest.spyOn(workerAuth, 'getWorkerSessionToken').mockResolvedValue('worker-token');
    jest.spyOn(workerGroupPorts, 'loadPublicWorkerGroups');
    jest.spyOn(workerGroupPorts, 'loadWorkerGroupOverview').mockResolvedValue({
      groups: [
        {
          groupId: 'session-visible',
          sessionSlug: 'demo-sh',
          label: 'Session visible',
          adminAddress: '0x00000000000000000000000000000000000000bb',
          joinMode: 'open',
          memberVisibility: 'session',
        },
      ],
      memberships: [
        {
          group: {
            groupId: 'member-only',
            sessionSlug: 'demo-sh',
            label: 'Member only',
            joinMode: 'admin_add',
            memberVisibility: 'members',
          },
          member: {
            groupId: 'member-only',
            sessionSlug: 'demo-sh',
            principal: {
              kind: 'passkey_account',
              address: '0x00000000000000000000000000000000000000aa',
            },
          },
        },
      ],
    });
    const instance = attachMutableSetState(
      new CommunityTab({
        activeSessionSlug: 'demo-sh',
        sessionConfig: WORKER_SESSION_CONFIG,
        account: '0x00000000000000000000000000000000000000aa',
        provider: 'passkey-provider',
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
      }),
    );
    jest.spyOn(instance, '_shouldUseDemoBeeswarmData').mockReturnValue(false);

    await instance._runStatsRefreshCycle({ force: true, markLoading: false });

    expect(workerAuth.getWorkerSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'demo-sh',
        sessionConfig: WORKER_SESSION_CONFIG,
        context: expect.objectContaining({
          account: '0x00000000000000000000000000000000000000aa',
          providerLike: 'passkey-provider',
        }),
      }),
    );
    expect(workerGroupPorts.loadWorkerGroupOverview).toHaveBeenCalledWith(
      expect.objectContaining({ credentialToken: 'worker-token', sessionSlug: 'demo-sh' }),
    );
    expect(workerGroupPorts.loadPublicWorkerGroups).not.toHaveBeenCalled();
    expect(instance.state.stats.find((stat) => stat.label === 'Groups').count).toBe(2);
    // The Users tile counts the people the session's listing shows answers from, not group members.
    expect(instance.state.stats.find((stat) => stat.label === 'Users').count).toBe(3);
    expect(instance.state.uniqueUsers).toEqual(
      expect.arrayContaining([
        '0x00000000000000000000000000000000000000aa',
        '0x00000000000000000000000000000000000000bb',
      ]),
    );
  });

  it('evicts a matching Worker group count as soon as that session mutates', () => {
    const instance = attachMutableSetState(
      new CommunityTab({
        activeSessionSlug: 'demo-sh',
        sessionConfig: WORKER_SESSION_CONFIG,
      }),
    );
    const identity = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: WORKER_SESSION_CONFIG,
      sessionSlug: 'demo-sh',
    });
    const cacheKey = instance._getWorkerGroupCountCacheKey(identity);
    instance._workerGroupCountCache.set(cacheKey, {
      count: 1,
      groupIds: ['stale-group'],
      visibleUserIds: [],
      status: 'ready',
      updatedAtMs: Date.now(),
    });
    instance._scheduleNextStatsPoll = jest.fn();
    instance._queueCacheDrivenRefresh = jest.fn();

    instance.componentDidMount();
    dispatchWorkerGroupsChanged({
      sessionSlug: 'demo-sh',
      sessionId: WORKER_SESSION_CONFIG.sessionId,
    });

    expect(instance._workerGroupCountCache.has(cacheKey)).toBe(false);
    expect(instance._queueCacheDrivenRefresh).toHaveBeenCalledWith({ force: true });
    instance.componentWillUnmount();
  });

  it('does not let an in-flight Worker catalog read restore an invalidated count', async () => {
    let resolveGroups;
    const groupsPromise = new Promise((resolve) => {
      resolveGroups = resolve;
    });
    jest.spyOn(workerGroupPorts, 'loadPublicWorkerGroups').mockReturnValue(groupsPromise);
    const instance = new CommunityTab({
      activeSessionSlug: 'demo-sh',
      sessionConfig: WORKER_SESSION_CONFIG,
    });
    const [scopeEntry] = instance._iterScopeCaches({ clone: false });
    const identity = scopeEntry.workerCanonicalIdentity;
    const cacheKey = instance._getWorkerGroupCountCacheKey(identity);

    const loadPromise = instance._loadWorkerGroupCount(scopeEntry);
    expect(instance._workerGroupCountCache.get(cacheKey)?.status).toBe('loading');
    instance._queueCacheDrivenRefresh = jest.fn();
    instance._handleWorkerGroupsChanged({
      sessionSlug: 'demo-sh',
      sessionId: WORKER_SESSION_CONFIG.sessionId,
    });
    resolveGroups([
      {
        groupId: 'stale-group',
        sessionSlug: 'demo-sh',
        label: 'Stale group',
        joinMode: 'open',
        memberVisibility: 'session',
      },
    ]);
    await loadPromise;

    expect(instance._workerGroupCountCache.has(cacheKey)).toBe(false);
  });

  it('does not wait for EVM block readiness for a Worker-canonical scope', async () => {
    const instance = new CommunityTab({
      activeSessionSlug: 'demo-sh',
      sessionConfig: WORKER_SESSION_CONFIG,
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
    });
    instance._iterScopeCaches = jest.fn(() => [
      {
        slug: 'demo-sh',
        cacheScope: WORKER_CANONICAL_CACHE_SCOPE_KEY,
        isWorkerCanonical: true,
        surveysCache: { surveys: {} },
        questionsCache: { questions: {} },
        sbtCache: {},
        workerGroupsStatus: 'ready',
      },
    ]);
    const blockSpy = jest
      .spyOn(contractScripts, 'getRelevantBlockWindowForFilter')
      .mockRejectedValue(new Error('EVM should not be queried'));

    await expect(instance.checkIfInitialLoadDone()).resolves.toBe(true);
    expect(blockSpy).not.toHaveBeenCalled();
  });

  it('uses demo beeswarm data for auto-demo sessions in list scope when caches are empty', () => {
    const priorUrl = window.location.href;
    try {
      localStorage.setItem('ce:sessionScanScope', 'list');
      localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['demo-sh']));
      window.history.replaceState({}, '', '/session/demo');

      const instance = new CommunityTab({ activeSessionSlug: null });
      instance._beeswarmPoints = [{ questionId: 'stale', label: 'Stale point', total: 1 }];
      const points = instance._buildCommunityBeeswarmPoints([]);
      const tree = instance.renderQuestionSwarm();
      const [plotNode] = collectTreeNodes(tree, (node) => node?.type === BeeswarmPlot);
      const headings = collectTreeNodes(tree, (node) => node?.type === 'h2');
      const demoDataset = polisReportModule.getPolisDemoDatasetForSlug('demo');
      const expectedDemoLabels = (Array.isArray(demoDataset?.comments) ? demoDataset.comments : [])
        .filter((comment) => {
          const type = String(comment?.type || 'binary')
            .trim()
            .toLowerCase();
          return type === 'binary';
        })
        .map((comment) => String(comment?.commentBody || '').trim())
        .filter(Boolean);

      expect(points).toHaveLength(expectedDemoLabels.length);
      expect(points[0]).toEqual(
        expect.objectContaining({
          questionId: expect.any(String),
          label: expectedDemoLabels[0],
          total: expect.any(Number),
        }),
      );
      expect(plotNode.props.points).toHaveLength(expectedDemoLabels.length);
      expect(plotNode.props.domain).toEqual([0, 1]);
      expect(plotNode.props.showIdleSummary).toBe(false);
      expect(plotNode.props.points[0]).toEqual(
        expect.objectContaining({
          label: expectedDemoLabels[0],
        }),
      );
      expect(headings).toHaveLength(0);
    } finally {
      localStorage.removeItem('ce:sessionScanScope');
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('uses the default demo report votes for an auto-demo alias so the default session keeps its real cluster', () => {
    const priorUrl = window.location.href;
    try {
      writeGlobalSessionSelection({ selectedSessionScope: 'active', primarySessionSlug: 'demo-sh' });
      globalThis.CE_SESSION_SCAN_SCOPE = 'active';
      window.history.replaceState({}, '', '/session/demo-sh');

      const instance = new CommunityTab({ activeSessionSlug: null });
      const points = instance._getQuestionSwarmPoints();

      expect(instance._shouldUseDemoBeeswarmData()).toBe(true);
      expect(points).toHaveLength(30);
      expect(points.every((point) => point.total > 0)).toBe(true);
      expect(points.some((point) => point.agrees > 0 && point.disagrees > 0)).toBe(true);
      expect(Math.min(...points.map((point) => point.value))).toBeGreaterThanOrEqual(0);
      expect(Math.max(...points.map((point) => point.value))).toBeLessThanOrEqual(1);
      expect(new Set(points.map((point) => point.value.toFixed(3))).size).toBeGreaterThan(10);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('hydrates an exact zero-response copy of the bundled demo questions without changing real session data', () => {
    const demoDataset = polisReportModule.getPolisDemoDatasetForSlug('demo');
    const zeroResponseDemoPoints = demoDataset.comments
      .filter((comment) => !comment.type || comment.type === 'binary')
      .map((comment) => ({
        questionId: comment.commentId,
        label: comment.commentBody,
        agrees: 0,
        disagrees: 0,
        unsure: 0,
        total: 0,
        value: 0,
      }));
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    instance._beeswarmPoints = zeroResponseDemoPoints;

    const points = instance._getQuestionSwarmPoints();

    expect(points).toHaveLength(30);
    expect(points.every((point) => point.total > 0)).toBe(true);
    expect(points.some((point) => point.agrees > 0 && point.disagrees > 0)).toBe(true);

    instance._beeswarmPoints = [
      { questionId: 'real-q1', label: 'Real prompt', agrees: 0, disagrees: 0, total: 0, value: 0 },
    ];
    expect(instance._getQuestionSwarmPoints()).toEqual(instance._beeswarmPoints);
  });

  it('only auto-enables community demo beeswarm data when demo is in the global auto-demo list', () => {
    const priorUrl = window.location.href;
    const priorDemoSlugs = [...POLIS_DEMO_DATA_AUTOLOAD_SLUGS];
    try {
      POLIS_DEMO_DATA_AUTOLOAD_SLUGS.splice(0, POLIS_DEMO_DATA_AUTOLOAD_SLUGS.length);
      localStorage.setItem('ce:sessionScanScope', 'list');
      window.history.replaceState({}, '', '/session/demo');

      const instance = new CommunityTab({ activeSessionSlug: null });

      expect(instance._shouldUseDemoBeeswarmData()).toBe(false);
      expect(instance._buildCommunityBeeswarmPoints([])).toEqual([]);
    } finally {
      POLIS_DEMO_DATA_AUTOLOAD_SLUGS.splice(0, POLIS_DEMO_DATA_AUTOLOAD_SLUGS.length, ...priorDemoSlugs);
      localStorage.removeItem('ce:sessionScanScope');
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('treats demo comments with missing types as binary for backwards compatibility', () => {
    const demoSpy = jest.spyOn(polisReportModule, 'getPolisDemoDatasetForSlug').mockReturnValue({
      comments: [
        {
          commentId: 'legacy-binary',
          commentBody: 'Legacy binary comment without a type',
        },
        {
          commentId: 'not-binary',
          commentBody: 'Which option?',
          type: 'multichoice',
        },
      ],
      participantsVotes: [
        {
          participant: 'participant-1',
          votes: {
            0: 1,
            1: -1,
          },
        },
        {
          participant: 'participant-2',
          votes: {
            0: 0,
            1: 1,
          },
        },
      ],
    });

    try {
      const instance = new CommunityTab({ activeSessionSlug: null });
      const points = instance._buildDemoBeeswarmPoints();

      expect(points).toHaveLength(1);
      expect(points[0]).toEqual(
        expect.objectContaining({
          questionId: 'legacy-binary',
          label: 'Legacy binary comment without a type',
          value: 0,
          agrees: 1,
          disagrees: 0,
          unsure: 1,
          total: 2,
        }),
      );
    } finally {
      demoSpy.mockRestore();
    }
  });

  it('includes unsure votes in community beeswarm point totals', () => {
    const instance = new CommunityTab({ activeSessionSlug: null });
    const points = instance._buildCommunityBeeswarmPoints([
      {
        slug: 'edge',
        questionsCache: {
          questions: {
            q1: { type: 'binary', prompt: 'Prompt one' },
          },
          questionResponses: {
            q1: {
              '0xaaa': { type: 'binary', answer: { value: 'Agree' } },
              '0xbbb': { type: 'binary', answer: { value: 'Unsure' } },
              '0xccc': { type: 'binary', answer: { value: 'Disagree' } },
            },
          },
        },
        surveysCache: {},
        sbtCache: {},
      },
    ]);

    expect(points).toEqual([
      expect.objectContaining({
        questionId: 'q1',
        value: 1,
        agrees: 1,
        disagrees: 1,
        unsure: 1,
        total: 3,
      }),
    ]);
  });

  it('limits the default community aggregate selection to listed sessions in list scope', () => {
    localStorage.setItem('ce:sessionScanScope', 'list');
    localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['general', 'edge', 'alpha']));

    const instance = new CommunityTab({ activeSessionSlug: null });
    const readSpy = jest.spyOn(instance, '_readCache').mockReturnValue({});
    const options = instance._getSessionSelectorOptions();

    instance._iterScopeCaches();

    expect(instance.listAllSlugs()).toEqual(['', 'edge', 'alpha']);
    expect(instance._getSelectedSessionSlugs()).toEqual(['', 'edge', 'alpha']);
    expect(options.map((option) => option.value)).toEqual(['', 'edge', 'alpha']);
    expect([...new Set(readSpy.mock.calls.map(([, slug]) => slug))]).toEqual(['', 'edge', 'alpha']);
  });

  it('uses the global selected-session scope when aggregating community stats', () => {
    localStorage.setItem('ce:selectedSessionScope', 'all');
    const instance = new CommunityTab({ activeSessionSlug: 'demo' });
    jest.spyOn(instance, 'listAllSlugs').mockReturnValue(['demo', 'edge', 'alpha']);

    expect(instance._isUniverseEnabled()).toBe(true);
    expect(instance._getSelectedSessionSlugs()).toEqual(['demo', '', 'edge', 'alpha']);
    expect(instance._currentSlug()).toBe('demo');
  });

  it('keeps retired Stats session and leaderboard controls out of the page', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'demo' });

    const tree = instance.render();
    const [toggleNode] = collectTreeNodes(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-community-session-selector-toggle',
    );
    const [panelNode] = collectTreeNodes(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-community-session-selector-panel',
    );
    const [leaderboardToggleNode] = collectTreeNodes(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-community-leaderboard-controls-toggle',
    );

    expect(toggleNode).toBeFalsy();
    expect(panelNode).toBeFalsy();
    expect(leaderboardToggleNode).toBeFalsy();
  });

  it('renders leaderboard hide filters behind a cog panel', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'demo' });
    instance.state = {
      ...instance.state,
      showLeaderboardControls: true,
      hideSimulatedUsers: true,
      hideHumanUsers: false,
    };

    const tree = instance.renderLeaderboardControls();
    const [toggleNode] = collectTreeNodes(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-community-leaderboard-controls-toggle',
    );
    const [panelNode] = collectTreeNodes(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-community-leaderboard-controls-panel',
    );
    const [hideSimulatedNode] = collectTreeNodes(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-community-hide-simulated-users',
    );
    const [hideUsersNode] = collectTreeNodes(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-community-hide-users',
    );

    expect(toggleNode).toBeTruthy();
    expect(panelNode).toBeTruthy();
    expect(hideSimulatedNode.props.checked).toBe(true);
    expect(hideUsersNode.props.checked).toBe(false);
  });

  it('renders the community modal as centered and scrollable when open', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'demo' });
    instance.state = {
      ...instance.state,
      showModal: true,
      modalType: 'surveys',
      modalTitle: 'Surveys',
    };

    const tree = instance.render();
    const [modalNode] = collectTreeNodes(
      tree,
      (node) =>
        node?.props?.isOpen === true && node?.props?.size === 'lg' && node?.props?.toggle === instance.toggleModal,
    );

    expect(modalNode).toBeTruthy();
    expect(modalNode.props.centered).toBe(true);
    expect(modalNode.props.scrollable).toBe(true);
  });

  it('keeps retired section headings out of the Stats page', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'demo' });
    const tree = instance.render();
    const headings = collectTreeNodes(tree, (node) => node?.type === 'h2');
    const headingText = headings.map((node) => collectNodeText(node).trim()).filter(Boolean);

    expect(headingText).not.toContain('Leaderboard');
    expect(headingText).not.toContain('Statistics');
    expect(headingText).toEqual([]);
  });

  it('renders survey links with session query suffix in modal content', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      modalType: 'surveys',
      surveysList: [
        { id: '0xabc', title: 'Survey A', responsesCount: 2, questionsCount: 3, slug: 'test-10' },
        { id: '0xdef', title: 'Survey B', responsesCount: 1, questionsCount: 1, slug: '' },
      ],
    };

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const tree = instance.renderModalContent();
    const anchors = collectTreeNodes(tree, (node) => node?.type === 'a' && typeof node?.props?.href === 'string');
    expect(anchors.map((node) => node.props.href)).toEqual([
      '/survey/0xabc?session=test-10',
      '/survey/0xdef?session=edge',
    ]);

    const responseSpans = collectTreeNodes(
      tree,
      (node) => node?.type === 'span' && typeof node?.props?.onClick === 'function',
    );
    responseSpans[0].props.onClick();
    responseSpans[1].props.onClick();
    expect(openSpy).toHaveBeenNthCalledWith(
      1,
      '/survey/0xabc/results?session=test-10',
      '_blank',
      'noopener,noreferrer',
    );
    expect(openSpy).toHaveBeenNthCalledWith(2, '/survey/0xdef/results?session=edge', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('renders community internal routes under the configured PUBLIC_URL base path', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce';
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    try {
      const instance = new CommunityTab({ activeSessionSlug: 'edge' });
      instance.state = {
        ...instance.state,
        modalType: 'surveys',
        surveysList: [{ id: '0xabc', title: 'Survey A', responsesCount: 2, questionsCount: 3, slug: 'test-10' }],
      };

      const surveysTree = instance.renderModalContent();
      const [surveyAnchor] = collectTreeNodes(
        surveysTree,
        (node) => node?.type === 'a' && typeof node?.props?.href === 'string',
      );
      expect(surveyAnchor.props.href).toBe('/ce/survey/0xabc?session=test-10');

      const [responseSpan] = collectTreeNodes(
        surveysTree,
        (node) => node?.type === 'span' && typeof node?.props?.onClick === 'function',
      );
      responseSpan.props.onClick();
      expect(openSpy).toHaveBeenNthCalledWith(
        1,
        '/ce/survey/0xabc/results?session=test-10',
        '_blank',
        'noopener,noreferrer',
      );

      instance.handleUserClick({ username: '0xabc' });
      instance.handleUserClick({ username: 'ada' });
      expect(openSpy).toHaveBeenNthCalledWith(2, '/ce/u/0xabc', '_blank', 'noopener,noreferrer');
      expect(openSpy).toHaveBeenNthCalledWith(3, '/ce/su/ada', '_blank', 'noopener,noreferrer');
    } finally {
      openSpy.mockRestore();
      if (previousPublicUrl === undefined) {
        delete process.env.PUBLIC_URL;
      } else {
        process.env.PUBLIC_URL = previousPublicUrl;
      }
    }
  });

  describe('Questions dialog', () => {
    const chainEntry = (slug, questions, extra = {}) => ({
      slug,
      netKey: '84532',
      isWorkerCanonical: false,
      sessionConfig: {},
      questionsCache: { questions },
      surveysCache: {},
      sbtCache: {},
      ...extra,
    });
    beforeEach(() => {
      loadCommunityWorkerQuestions.mockReset();
      loadCommunityWorkerQuestions.mockImplementation(() => new Promise(() => {}));
    });
    const answers = (votes) =>
      Object.fromEntries(votes.map((value, index) => [`0x${index + 1}`, { type: 'binary', answer: { value } }]));
    const renderQuestions = (instance, entries) => {
      instance._iterScopeCaches = jest.fn(() => entries);
      return render(instance.renderQuestionsDialog());
    };
    const workerEntry = (instance, slug, { questions = 0, questionsCache = {}, sessionConfig } = {}) => {
      const entry = {
        slug,
        netKey: 'worker',
        isWorkerCanonical: true,
        sessionConfig: sessionConfig || { ...WORKER_SESSION_CONFIG, slug, sessionName: `${slug} session` },
        workerCanonicalIdentity: { workerOrigin: 'https://worker.example' },
        questionsCache,
        surveysCache: {},
        sbtCache: {},
      };
      instance._workerListingCounts.set(instance._workerListingKey(entry), {
        counts: { questions, surveys: 0, responders: [] },
        failed: false,
        loading: false,
        at: Date.now(),
      });
      return entry;
    };

    it('lists each session with its count and opens one to its questions of every kind', () => {
      const previousPublicUrl = process.env.PUBLIC_URL;
      process.env.PUBLIC_URL = '/ce/';
      try {
        renderQuestions(new CommunityTab({ activeSessionSlug: 'active' }), [
          chainEntry('', {
            repeated: { prompt: 'General freeform question', type: 'freeform' },
            rating: { prompt: 'General rating question', type: 'rating' },
          }),
          chainEntry(
            'edge session',
            {
              repeated: { prompt: 'Named session binary question', type: 'binary' },
              multi: { prompt: 'Named multiple choice question', type: 'multichoice' },
              quadratic: { prompt: 'Named allocation question', type: 'quadratic' },
            },
            { sessionConfig: { slug: 'edge session', sessionName: 'Edge discussion' } },
          ),
          chainEntry('empty', {}),
        ]);
        const dialog = screen.getByTestId('ce-community-questions-dialog');
        expect(dialog).toHaveTextContent('2 sessions, 5 questions');
        expect(
          within(dialog)
            .getAllByRole('button')
            .map((row) => row.textContent),
        ).toEqual(['Edge discussion3 questions ', 'General2 questions ']);

        fireEvent.click(screen.getByRole('button', { name: /^Edge discussion/ }));
        const opened = screen.getByTestId('ce-community-questions-dialog-session');
        expect(within(opened).getByRole('heading')).toHaveTextContent('Edge discussion: 3 questions');
        expect(opened).toHaveTextContent('1 agree/disagree, 1 choice, 1 quadratic');
        // No answers to place: no chart to choose.
        expect(within(opened).queryByRole('group', { name: 'Show questions as' })).not.toBeInTheDocument();
        expect(
          within(opened)
            .getAllByRole('link')
            .map((link) => [link.textContent, link.getAttribute('href')]),
        ).toEqual([
          ['Named session binary questionagree/disagree', '/ce/session/edge%20session#report'],
          ['Named multiple choice questionchoice', '/ce/session/edge%20session#report'],
          ['Named allocation questionquadratic', '/ce/session/edge%20session#report'],
        ]);
      } finally {
        if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
        else process.env.PUBLIC_URL = previousPublicUrl;
      }
    });

    it('totals the questions as the Questions tile counts them', () => {
      const instance = new CommunityTab({});
      const chain = [
        chainEntry('alpha', {
          shared: { prompt: 'Asked in both', type: 'binary' },
          own: { prompt: 'Alpha only', type: 'rating' },
        }),
        chainEntry('beta', { shared: { prompt: 'Asked in both', type: 'binary' } }),
      ];
      const entries = [
        ...chain,
        workerEntry(instance, 'wk', { questions: 4 }),
        workerEntry(instance, 'w2', { questions: 7 }),
      ];
      renderQuestions(instance, entries);

      // As the tile adds them up: chain sessions from their caches, Worker sessions from their listings.
      const tile = instance._getQuestionDetailsRows(chain).length + instance._workerListingTotals(entries).questions;
      const shown = screen.getByTestId('ce-community-questions-dialog').textContent.match(/sessions, (\d+) questions?/);
      expect(Number(shown?.[1])).toBe(tile);
    });

    it('leaves hidden questions out of the count and the list, as the session page does', () => {
      const instance = new CommunityTab({});
      const entry = chainEntry(
        'alpha',
        {
          shown: { prompt: 'Shown question', type: 'binary' },
          SettingsHidden: { prompt: 'Hidden in Settings', type: 'binary' },
          marked: { prompt: 'Marked hidden', type: 'binary', hidden: true },
          answeredOnly: { prompt: 'Named by an answer', type: 'binary', source: 'worker-response-payload' },
        },
        { sessionConfig: { BLOCKED_QUESTION_IDS: ['settingshidden'] } },
      );
      expect(instance._getQuestionDetailsRows([entry]).map(({ questionId }) => questionId)).toEqual(['shown']);
      renderQuestions(instance, [entry]);
      const opened = screen.getByTestId('ce-community-questions-dialog-session');
      expect(within(opened).getByRole('heading')).toHaveTextContent('alpha: 1 question');
      expect(
        within(opened)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Shown questionagree/disagree']);
    });

    it('shows a chart first where three agree/disagree questions have answers, each dot opening the results', () => {
      const instance = new CommunityTab({});
      instance._openResults = jest.fn();
      const questions = Object.fromEntries(
        ['q1', 'q2', 'q3'].map((id) => [id, { prompt: `Binary ${id}`, type: 'binary' }]),
      );
      questions.q4 = { prompt: 'Written one', type: 'freeform' };
      renderQuestions(instance, [
        chainEntry('alpha', questions, {
          questionsCache: {
            questions,
            questionResponses: {
              q1: answers(['Agree', 'Agree']),
              q2: answers(['Agree', 'Disagree']),
              q3: answers(['Disagree', 'Unsure']),
            },
          },
        }),
      ]);
      const opened = screen.getByTestId('ce-community-questions-dialog-session');
      expect(opened).toHaveTextContent('3 agree/disagree, 1 written');
      expect(within(opened).getByRole('button', { name: 'Chart' })).toHaveAttribute('aria-pressed', 'true');
      expect(opened).toHaveTextContent('Click a dot to open its results.');
      fireEvent.click(screen.getByTestId('ce-community-questions-plot-point-0'));
      expect(instance._openResults).toHaveBeenCalledWith('/session/alpha#report');

      fireEvent.click(within(opened).getByRole('button', { name: 'List' }));
      expect(within(opened).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(opened).getAllByRole('link')).toHaveLength(4);
    });

    it('shows the list first where fewer questions have answers, with the chart a click away', () => {
      const questions = { q1: { prompt: 'Binary q1', type: 'binary' }, q2: { prompt: 'Binary q2', type: 'binary' } };
      renderQuestions(new CommunityTab({}), [
        chainEntry('alpha', questions, {
          questionsCache: { questions, questionResponses: { q1: answers(['Agree']), q2: answers(['Disagree']) } },
        }),
      ]);
      const opened = screen.getByTestId('ce-community-questions-dialog-session');
      expect(within(opened).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(within(opened).getByRole('button', { name: 'Chart' }));
      expect(screen.getByTestId('ce-community-questions-plot-point-1')).toBeInTheDocument();
    });

    it('counts a Worker session from its listing and opens it from what this browser holds', async () => {
      await writeWorkerStatsCaches();
      peekCacheSync('questionsCache', 'demo-sh', { clone: false })[
        WORKER_CANONICAL_CACHE_SCOPE_KEY
      ].workerMetadataHydrationStatus = 'complete';
      const instance = new CommunityTab({ activeSessionSlug: 'demo-sh', sessionConfig: WORKER_SESSION_CONFIG });
      instance._getSelectedSessionSlugs = jest.fn(() => ['demo-sh']);
      const entry = instance._iterScopeCaches({ clone: false }).find(({ slug }) => slug === 'demo-sh');
      instance._iterScopeCaches = jest.fn(() => [entry]);
      instance._workerListingCounts.set(instance._workerListingKey(entry), {
        counts: { questions: 1, surveys: 1, responders: [] },
        failed: false,
        loading: false,
        at: Date.now(),
      });
      render(instance.renderQuestionsDialog());
      const opened = screen.getByTestId('ce-community-questions-dialog-session');
      expect(opened).toHaveTextContent('Worker question');
      expect(opened).not.toHaveTextContent('Stale numeric question');
      expect(
        within(opened)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
      ).toEqual(['/session/demo-sh#report']);
      expect(loadCommunityWorkerQuestions).not.toHaveBeenCalled();
    });

    it('reads a Worker session this browser holds none of when it is opened, with a limit and Try again', async () => {
      jest.useFakeTimers();
      try {
        const instance = attachMutableSetState(new CommunityTab({}));
        const wk = workerEntry(instance, 'wk', { questions: 2 });
        const other = chainEntry('alpha', { q: { prompt: 'Chain question', type: 'binary' } });
        instance._iterScopeCaches = jest.fn(() => [wk, other]);
        let resolveLoad;
        loadCommunityWorkerQuestions.mockImplementation(() => new Promise(() => {}));
        const view = render(instance.renderQuestionsDialog());
        const rerender = () => view.rerender(instance.renderQuestionsDialog());

        fireEvent.click(screen.getByRole('button', { name: /^wk session\s*2 questions/ }));
        expect(screen.getByTestId('ce-community-questions-dialog-session')).toHaveTextContent('Reading questions…');
        expect(loadCommunityWorkerQuestions).toHaveBeenCalledTimes(1);
        expect(loadCommunityWorkerQuestions.mock.calls[0][0]).toMatchObject({ sessionSlug: 'wk' });

        act(() => jest.advanceTimersByTime(QUESTIONS_LOAD_LIMIT_MS));
        rerender();
        expect(screen.getByRole('status')).toHaveTextContent('This is taking too long.');

        loadCommunityWorkerQuestions.mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveLoad = resolve;
            }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        rerender();
        expect(loadCommunityWorkerQuestions).toHaveBeenCalledTimes(2);
        expect(loadCommunityWorkerQuestions.mock.calls[0][0].signal.aborted).toBe(true);
        expect(screen.getByRole('status')).toHaveTextContent('Reading questions…');

        await act(async () =>
          resolveLoad({
            questionsCache: {
              questions: {
                a: { prompt: 'Read question', type: 'binary' },
                b: { prompt: '[encrypted]', type: 'binary' },
              },
              questionResponses: {},
            },
            answersPublic: false,
          }),
        );
        rerender();
        const opened = screen.getByTestId('ce-community-questions-dialog-session');
        expect(
          within(opened)
            .getAllByRole('link')
            .map((link) => link.textContent),
        ).toEqual(['Read questionagree/disagree', 'Encrypted questionagree/disagree']);
        expect(opened).toHaveTextContent('Answers to this session are not public.');
        // Going back and opening it again reads nothing new.
        fireEvent.click(within(opened).getByRole('button', { name: 'All sessions' }));
        fireEvent.click(screen.getByRole('button', { name: /^wk session/ }));
        expect(loadCommunityWorkerQuestions).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('says when a Worker session cannot be read, and when it has not been opened in this browser', async () => {
      const instance = attachMutableSetState(new CommunityTab({}));
      const wk = workerEntry(instance, 'wk', { questions: 2 });
      const unopened = workerEntry(instance, 'far', { questions: 3, sessionConfig: { slug: 'far' } });
      instance._iterScopeCaches = jest.fn(() => [wk, unopened]);
      loadCommunityWorkerQuestions.mockRejectedValueOnce(new Error('refused'));
      const view = render(instance.renderQuestionsDialog());

      fireEvent.click(screen.getByRole('button', { name: /^far/ }));
      const opened = screen.getByTestId('ce-community-questions-dialog-session');
      expect(opened).toHaveTextContent('This session’s questions can be read here once it has been opened.');
      expect(within(opened).getByRole('link', { name: /Open the session/ })).toHaveAttribute(
        'href',
        '/session/far#report',
      );
      expect(loadCommunityWorkerQuestions).not.toHaveBeenCalled();

      fireEvent.click(within(opened).getByRole('button', { name: 'All sessions' }));
      fireEvent.click(screen.getByRole('button', { name: /^wk/ }));
      await act(async () => {});
      view.rerender(instance.renderQuestionsDialog());
      expect(screen.getByRole('status')).toHaveTextContent('This session’s questions can’t be read here.');
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('lists a Worker session still being counted, or whose listing could not be read, without opening it', () => {
      const instance = new CommunityTab({});
      const counting = workerEntry(instance, 'counting');
      const unread = workerEntry(instance, 'unread');
      instance._workerListingCounts.set(instance._workerListingKey(counting), { loading: true, counts: null });
      instance._workerListingCounts.set(instance._workerListingKey(unread), {
        loading: false,
        failed: true,
        counts: null,
      });
      renderQuestions(instance, [counting, unread, chainEntry('alpha', { q: { prompt: 'One', type: 'binary' } })]);
      const dialog = screen.getByTestId('ce-community-questions-dialog');
      expect(dialog).toHaveTextContent('3 sessions, 1 question');
      expect(dialog).toHaveTextContent(/counting session.*counting/);
      expect(dialog).toHaveTextContent('can’t be read here');
      expect(
        within(dialog)
          .getAllByRole('button')
          .map((row) => row.textContent),
      ).toEqual(['alpha1 question ']);
    });

    it('keeps unknown session labels and empty sessions free of unrelated demo fallbacks', () => {
      const instance = new CommunityTab({ activeSessionSlug: 'unknown' });
      jest
        .spyOn(chainGateway, 'getDemoSessionConfigBySlug')
        .mockReturnValue({ slug: 'demo', sessionName: 'Unrelated demo' });
      const view = renderQuestions(instance, [
        chainEntry('unknown', { unnamed: {}, encrypted: { prompt: '[encrypted]' } }),
      ]);
      const opened = screen.getByTestId('ce-community-questions-dialog-session');
      expect(opened).toHaveTextContent('unknown: 2 questions');
      expect(opened).not.toHaveTextContent('Unrelated demo');
      expect(opened).toHaveTextContent('Question unnamed');
      expect(opened).toHaveTextContent('Encrypted question');
      view.unmount();
      renderQuestions(instance, [chainEntry('unknown', {})]);
      expect(screen.getByTestId('ce-community-questions-dialog-session')).toHaveTextContent(
        'No questions in this session yet.',
      );
    });

    it('uses exact-session demo question names only when that demo has no cached questions', () => {
      const lookup = jest
        .spyOn(polisReportModule, 'getPolisDemoDatasetForSlug')
        .mockImplementation((slug, options) =>
          slug === 'demo' && options?.allowFallback === false
            ? { comments: [{ commentId: 'demo-1', commentBody: 'Exact demo question', type: 'rating' }] }
            : { comments: [{ commentId: 'wrong', commentBody: 'Wrong fallback' }] },
        );
      renderQuestions(new CommunityTab({ activeSessionSlug: 'demo' }), [
        chainEntry('demo', {}, { sessionConfig: { slug: 'demo', sessionName: 'Demo Session' }, questionsCache: {} }),
        chainEntry('unknown', {}, { questionsCache: {} }),
      ]);
      const opened = screen.getByTestId('ce-community-questions-dialog-session');
      expect(opened).toHaveTextContent('Exact demo question');
      expect(opened).not.toHaveTextContent('Wrong fallback');
      expect(
        within(opened)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
      ).toEqual(['/session/demo#report']);
      expect(lookup).toHaveBeenCalledWith('demo', { allowFallback: false });
    });

    it('opens in the Sessions dialog panel, titled Questions, with no link in its header', () => {
      const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: 'edge' }));
      const [counter] = collectTreeNodes(
        instance.render(),
        (node) => node.props?.['data-testid'] === 'ce-community-stat-questions',
      );
      counter.props.onClick();
      const tree = instance.render();
      const [modal] = collectTreeNodes(tree, (node) => node.type === Modal);
      const [header] = collectTreeNodes(tree, (node) => node.type === ModalHeader);
      expect(modal.props.className).toContain('sessionsModal');
      expect(collectNodeText(header)).toBe('Questions');
      expect(header.props.tag).toBe('h5');
      expect(collectTreeNodes(header, (node) => node.type === 'a')).toHaveLength(0);
    });
  });

  describe('Groups dialog', () => {
    const chainEntry = (slug, sbtList, sessionName = '') => ({
      slug,
      netKey: '84532',
      cacheScope: '84532',
      isWorkerCanonical: false,
      sessionConfig: { sessionName },
      workerCanonicalIdentity: null,
      workerGroupIds: [],
      workerGroups: [],
      workerVisibleUserIds: [],
      workerGroupsCount: 0,
      workerGroupsStatus: 'idle',
      surveysCache: {},
      questionsCache: {},
      sbtCache: { sbtList },
    });
    const workerEntry = (slug, status, groups = [], identity = { workerOrigin: 'https://worker.example' }) => ({
      ...chainEntry(slug, {}, `${slug} session`),
      netKey: 'worker',
      cacheScope: 'worker',
      isWorkerCanonical: true,
      workerCanonicalIdentity: identity,
      workerGroupIds: groups.map(({ groupId }) => groupId),
      workerGroups: groups,
      workerGroupsCount: groups.length,
      workerGroupsStatus: status,
    });
    const sbt = (address, sbtInfo) => ({ sbtAddress: address, sbtInfo, mintedAddresses: [], burnedAddresses: [] });
    const renderGroupsDialog = (entries) => {
      const instance = new CommunityTab({});
      instance._iterScopeCaches = jest.fn(() => entries);
      return render(instance.renderGroupsDialog());
    };

    it('lists each session in view with the groups the tile counts, counting shared ones once', () => {
      const shared = sbt('0xA1', { name: 'Open badge', mintingEndTime: 0 });
      renderGroupsDialog([
        chainEntry(
          'alpha',
          {
            '0xa1': shared,
            '0xa2': sbt('0xa2', { name: 'Closed badge', mintingEndTime: 1 }),
            '0xa3': sbt('0xa3', { name: 'Hidden badge', hidden: true }),
          },
          'Alpha session',
        ),
        chainEntry('beta', { '0xa1': shared }, 'Beta session'),
        workerEntry('wk', 'ready', [{ groupId: 'g1', label: 'Breakout', open: true }]),
        workerEntry('private-wk', 'unavailable'),
        workerEntry('slow-wk', 'loading'),
        workerEntry('dead-wk', 'error'),
        workerEntry('never-opened', 'idle', [], null),
      ]);

      const dialog = screen.getByTestId('ce-community-groups-dialog');
      expect(dialog).toHaveTextContent('6 sessions, 3 groups');
      expect(screen.getByRole('button', { name: 'About the group total' })).toBeInTheDocument();
      expect(
        within(dialog)
          .getAllByRole('listitem')
          .map((row) => row.textContent),
      ).toEqual([
        'Alpha session2 groups ',
        'Beta session1 group ',
        'wk session1 group ',
        expect.stringMatching(/^dead-wk sessioncan’t be read here/),
        expect.stringMatching(/^private-wk sessiongroups not public/),
        expect.stringMatching(/^slow-wk session.*counting/),
      ]);
      expect(dialog).not.toHaveTextContent('never-opened');
    });

    it('lists the groups a failed re-read kept, as the tile still counts them', () => {
      renderGroupsDialog([
        chainEntry('alpha', { '0xa1': sbt('0xa1', { name: 'Open badge', mintingEndTime: 0 }) }, 'Alpha session'),
        workerEntry('dead-wk', 'error', [{ groupId: 'g1', label: 'Kept group', open: false }]),
      ]);
      expect(screen.getByTestId('ce-community-groups-dialog')).toHaveTextContent('2 sessions, 2 groups');
      fireEvent.click(screen.getByRole('button', { name: /^dead-wk/ }));

      const opened = screen.getByTestId('ce-community-groups-dialog-session');
      expect(within(opened).getByRole('heading')).toHaveTextContent('dead-wk session: 1 group');
      expect(within(opened).getAllByRole('link')[0]).toHaveTextContent('Kept groupClosed');
    });

    it('totals the groups as the Groups tile counts them', () => {
      const shared = sbt('0xA1', { name: 'Open badge', mintingEndTime: 0 });
      const views = [
        [
          chainEntry('alpha', { '0xa1': shared, '0xa3': sbt('0xa3', { name: 'Hidden badge', hidden: true }) }),
          chainEntry('beta', { '0xa1': shared, '0xb1': sbt('0xb1', { name: 'Beta badge' }) }),
          workerEntry('wk', 'ready', [
            { groupId: 'g1', label: 'Breakout', open: true },
            { groupId: 'g2', label: 'Plenary', open: false },
          ]),
          workerEntry('dead-wk', 'error', [{ groupId: 'g1', label: 'Kept group', open: true }]),
          workerEntry('private-wk', 'unavailable'),
          workerEntry('slow-wk', 'loading'),
          workerEntry('never-opened', 'idle', [], null),
        ],
        [workerEntry('wk', 'ready', [{ groupId: 'g1', label: 'Breakout', open: true }]), workerEntry('w2', 'error')],
        [chainEntry('alpha', { '0xa1': shared }), chainEntry('beta', { '0xa1': shared })],
      ];
      views.forEach((entries) => {
        const instance = new CommunityTab({});
        instance._iterScopeCaches = jest.fn(() => entries);
        const view = render(instance.renderGroupsDialog());
        const tile = instance._computeStatsSnapshot(entries).sbtsCreatedCount;
        const shown = screen.getByTestId('ce-community-groups-dialog').textContent.match(/sessions, (\d+) groups?/);
        expect(Number(shown?.[1])).toBe(tile);
        view.unmount();
      });
    });

    it('opens an on-chain session to its groups, open or closed, each linking to its page', () => {
      renderGroupsDialog([
        chainEntry('alpha', {
          '0xa1': sbt('0xa1', { name: 'Open badge', mintingEndTime: 0 }),
          '0xa2': sbt('0xa2', { name: 'Closed badge', mintingEndTime: 1 }),
        }),
        chainEntry('beta', { '0xb1': sbt('0xb1', { name: 'Beta badge' }) }),
      ]);
      fireEvent.click(screen.getByRole('button', { name: /^alpha/ }));

      const opened = screen.getByTestId('ce-community-groups-dialog-session');
      expect(within(opened).getByRole('heading')).toHaveTextContent('alpha: 2 groups');
      const links = within(opened).getAllByRole('link');
      expect(links.map((link) => [link.textContent.trim(), link.getAttribute('href')])).toEqual([
        ['Open badgeOpen to join', buildSbtDetailPath('0xa1', 'alpha')],
        ['Closed badgeClosed', buildSbtDetailPath('0xa2', 'alpha')],
        ['See all of this session’s groups', '/groups/alpha'],
      ]);
      fireEvent.click(within(opened).getByRole('button', { name: 'All sessions' }));
      expect(screen.getByTestId('ce-community-groups-dialog')).toHaveTextContent('2 sessions, 3 groups');
    });

    it('opens straight to a lone Worker session, its groups linking through its Worker', () => {
      renderGroupsDialog([
        workerEntry('wk', 'ready', [
          { groupId: 'g1', label: 'Breakout', open: true },
          { groupId: 'g2', label: '', open: false },
        ]),
      ]);
      const opened = screen.getByTestId('ce-community-groups-dialog-session');
      expect(within(opened).queryByRole('button', { name: 'All sessions' })).not.toBeInTheDocument();
      const workerUrl = 'https://worker.example';
      expect(
        within(opened)
          .getAllByRole('link')
          .map((link) => [link.textContent.trim(), link.getAttribute('href')]),
      ).toEqual([
        ['BreakoutOpen to join', buildWorkerGroupsPath({ groupId: 'g1', sessionSlug: 'wk', workerUrl })],
        ['Unnamed groupClosed', buildWorkerGroupsPath({ groupId: 'g2', sessionSlug: 'wk', workerUrl })],
        ['See all of this session’s groups', buildWorkerGroupsPath({ sessionSlug: 'wk', workerUrl })],
      ]);
    });

    it('says so when no session in view has groups', () => {
      renderGroupsDialog([chainEntry('alpha', {}), chainEntry('beta', {})]);
      expect(screen.getByTestId('ce-community-groups-dialog')).toHaveTextContent('No sessions with groups yet.');
    });

    it('opens in the Sessions dialog panel', () => {
      const instance = new CommunityTab({});
      instance.state.showModal = true;
      instance.state.modalType = 'groups';
      instance._iterScopeCaches = jest.fn(() => []);
      const [modal] = collectTreeNodes(instance.render(), (node) => node.type === Modal);
      expect(modal.props.className).toContain('sessionsModal');
    });
  });

  it('canonicalizes reserved session aliases in modal survey links', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      modalType: 'surveys',
      surveysList: [
        { id: '0xabc', title: 'Survey A', responsesCount: 2, questionsCount: 3, slug: 'DEBATE' },
        { id: '0xdef', title: 'Survey B', responsesCount: 1, questionsCount: 1, slug: 'general' },
      ],
    };

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const tree = instance.renderModalContent();
    const anchors = collectTreeNodes(tree, (node) => node?.type === 'a' && typeof node?.props?.href === 'string');
    expect(anchors.map((node) => node.props.href)).toEqual(['/survey/0xabc?session=DEBATE', '/survey/0xdef']);

    const responseSpans = collectTreeNodes(
      tree,
      (node) => node?.type === 'span' && typeof node?.props?.onClick === 'function',
    );
    responseSpans[0].props.onClick();
    responseSpans[1].props.onClick();
    expect(openSpy).toHaveBeenNthCalledWith(1, '/survey/0xabc/results?session=DEBATE', '_blank', 'noopener,noreferrer');
    expect(openSpy).toHaveBeenNthCalledWith(2, '/survey/0xdef/results', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('reads cache keys as-is without legacy numeric-key migration', async () => {
    const instance = new CommunityTab({ activeSessionSlug: '' });
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    const legacyKey = `0${netKey}`;
    await writeCache('questionsCache', '', {
      [legacyKey]: { questions: { q1: { id: 'q1' } } },
    });

    const result = instance._readCache('questionsCache', '');

    expect(result[legacyKey]).toBeDefined();
    expect(result[netKey]).toBeUndefined();
    const stored = await readCache('questionsCache', '');
    expect(stored[legacyKey]).toBeDefined();
  });

  it('picks the only network entry when netKey is missing', () => {
    const instance = new CommunityTab({});
    const picked = instance._pickNet({ alpha: { count: 3 } }, '');
    expect(picked).toEqual({ count: 3 });
  });

  it('filters SBT entries by hidden/ignored/featured rules', () => {
    const instance = new CommunityTab({});
    const ignoredAddr = '0x5E1B80A3eBdf5c575c4Cb8148fB5B0c118c55A5f';
    const featuredAddr = '0xd417C701Cf8ef4282CB62bFBf047B338b2f4FeB8';

    expect(instance._shouldCountSbt({ sbtAddress: '0xabc', sbtInfo: { hidden: true } }, 'rxc')).toBe(false);

    expect(instance._shouldCountSbt({ sbtAddress: ignoredAddr, sbtInfo: {} }, 'rxc')).toBe(true);

    expect(instance._shouldCountSbt({ sbtAddress: featuredAddr, sbtInfo: { unlisted: true } }, 'rxc')).toBe(false);

    expect(instance._shouldCountSbt({ sbtAddress: '0xdef', sbtInfo: {} }, 'rxc')).toBe(true);
  });

  it('dedupes leaderboard users by username while preserving simulated-user precedence', () => {
    const instance = new CommunityTab({});
    instance.state = {
      ...instance.state,
      uniqueUsers: ['Franklin', '0xbbb', '0xbbb'],
      hideSimulatedUsers: false,
      hideHumanUsers: false,
    };

    const leaderboard = instance.getMemoizedLeaderboardData();
    const franklinRows = leaderboard.filter((row) => row.username === 'Franklin');
    const humanRows = leaderboard.filter((row) => row.username === '0xbbb');

    expect(franklinRows).toHaveLength(1);
    expect(franklinRows[0].name).toBe('Benjamin Franklin');
    expect(humanRows).toHaveLength(1);
  });

  it('renders simulated leaderboard users with local historical avatars or blockie fallbacks instead of remote photos', () => {
    const instance = new CommunityTab({});
    instance.state = {
      ...instance.state,
      uniqueUsers: [],
      hideSimulatedUsers: false,
      hideHumanUsers: true,
    };

    const tree = instance.renderLeaderboard();
    const avatarNodes = collectTreeNodes(tree, (node) => node?.type === 'img');

    expect(avatarNodes.length).toBeGreaterThan(0);
    expect(avatarNodes[0].props.src).toMatch(/^\/historical-avatars\/|^data:image\/png;base64,/);
  });

  it('keeps leaderboard ordering sorted by display name', () => {
    const instance = new CommunityTab({});
    instance.state = {
      ...instance.state,
      uniqueUsers: ['0xccc', '0xaaa', '0xbbb'],
      hideSimulatedUsers: true,
      hideHumanUsers: false,
    };

    const leaderboard = instance.getMemoizedLeaderboardData();
    expect(leaderboard.map((row) => row.username)).toEqual(['0xaaa', '0xbbb', '0xccc']);
  });

  it('reuses memoized leaderboard list when render inputs are unchanged', () => {
    const instance = new CommunityTab({});
    instance.state = {
      ...instance.state,
      uniqueUsers: ['0xaaa', '0xbbb'],
      hideSimulatedUsers: true,
      hideHumanUsers: false,
    };

    const first = instance.getMemoizedLeaderboardData();
    const second = instance.getMemoizedLeaderboardData();
    expect(second).toBe(first);

    instance.state = {
      ...instance.state,
      uniqueUsers: ['0xaaa', '0xbbb', '0xccc'],
    };
    const third = instance.getMemoizedLeaderboardData();
    expect(third).not.toBe(first);
  });

  it('recomputes leaderboard memo when uniqueUsers mutates in place', () => {
    const instance = new CommunityTab({});
    const uniqueUsers = ['0xaaa', '0xbbb'];
    instance.state = {
      ...instance.state,
      uniqueUsers,
      hideSimulatedUsers: true,
      hideHumanUsers: false,
    };

    const first = instance.getMemoizedLeaderboardData();
    uniqueUsers[1] = '0xccc';
    const second = instance.getMemoizedLeaderboardData();

    expect(second).not.toBe(first);
    expect(second.map((row) => row.username)).toEqual(['0xaaa', '0xccc']);
  });

  it('builds stable cache signatures and detects top-level cache shape changes', async () => {
    const instance = new CommunityTab({ activeSessionSlug: '' });
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('surveysCache', '', {
      [netKey]: {
        surveysLatestBlock: 10,
        surveys: { s1: { title: 'Survey 1' } },
        surveyResponses: { s1: { '0xabc': {} } },
      },
    });
    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 10,
        questions: { q1: { creator: '0xabc' } },
        questionResponses: { q1: { '0xdef': {} } },
      },
    });
    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {
          '0x1': {
            ...buildSbtActivityCacheEntry({ sbtAddress: '0x1' }),
            sbtAddress: '0x1',
            sbtInfo: {},
            mintedAddresses: [],
            burnedAddresses: [],
          },
        },
      },
    });

    const sig1 = instance._buildCacheSignature(instance._iterScopeCaches({ clone: false }));
    const sig2 = instance._buildCacheSignature(instance._iterScopeCaches({ clone: false }));
    expect(sig2).toBe(sig1);

    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 11,
        questions: {
          q1: { creator: '0xabc' },
          q2: { creator: '0xdef' },
        },
        questionResponses: { q1: { '0xdef': {} } },
      },
    });

    const sig3 = instance._buildCacheSignature(instance._iterScopeCaches({ clone: false }));
    expect(sig3).not.toBe(sig1);
  });

  it('changes cache signature when responder members change in-place with equal counts', async () => {
    const instance = new CommunityTab({ activeSessionSlug: '' });
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('surveysCache', '', {
      [netKey]: {
        surveysLatestBlock: 10,
        surveys: { s1: { title: 'Survey 1' } },
        surveyResponses: { s1: { '0xaaa': {} } },
      },
    });
    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 10,
        questions: { q1: { creator: '0xabc' } },
        questionResponses: { q1: { '0xbbb': {} } },
      },
    });
    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {},
      },
    });

    const sig1 = instance._buildCacheSignature(instance._iterScopeCaches({ clone: false }));
    const surveysCacheRef = peekCacheSync('surveysCache', '', { clone: false });
    const questionsCacheRef = peekCacheSync('questionsCache', '', { clone: false });
    expect(Object.keys(surveysCacheRef[netKey].surveyResponses.s1 || {})).toHaveLength(1);
    expect(Object.keys(questionsCacheRef[netKey].questionResponses.q1 || {})).toHaveLength(1);

    delete surveysCacheRef[netKey].surveyResponses.s1['0xaaa'];
    surveysCacheRef[netKey].surveyResponses.s1['0xccc'] = {};
    delete questionsCacheRef[netKey].questionResponses.q1['0xbbb'];
    questionsCacheRef[netKey].questionResponses.q1['0xddd'] = {};

    expect(Object.keys(surveysCacheRef[netKey].surveyResponses.s1 || {})).toHaveLength(1);
    expect(Object.keys(questionsCacheRef[netKey].questionResponses.q1 || {})).toHaveLength(1);
    const sig2 = instance._buildCacheSignature(instance._iterScopeCaches({ clone: false }));
    expect(sig2).not.toBe(sig1);
  });

  it('changes cache signature when survey metadata mutates in-place with equal counts', async () => {
    const instance = new CommunityTab({ activeSessionSlug: '' });
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('surveysCache', '', {
      [netKey]: {
        surveysLatestBlock: 10,
        surveys: { s1: { title: 'Survey 1', creator: '0xabc', questionIDs: ['q1'] } },
        surveyResponses: { s1: { '0xaaa': {} } },
      },
    });
    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 10,
        questions: { q1: { creator: '0xabc' } },
        questionResponses: { q1: { '0xbbb': {} } },
      },
    });
    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {},
      },
    });

    const sig1 = instance._buildCacheSignature(instance._iterScopeCaches({ clone: false }));
    const surveysCacheRef = peekCacheSync('surveysCache', '', { clone: false });
    surveysCacheRef[netKey].surveys.s1.title = 'Survey 1 Updated';
    const sig2 = instance._buildCacheSignature(instance._iterScopeCaches({ clone: false }));

    expect(sig2).not.toBe(sig1);
  });

  it('changes cache signature when sbt holder members mutate in-place with equal counts', async () => {
    const instance = new CommunityTab({ activeSessionSlug: '' });
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('surveysCache', '', {
      [netKey]: {
        surveysLatestBlock: 10,
        surveys: {},
        surveyResponses: {},
      },
    });
    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 10,
        questions: {},
        questionResponses: {},
      },
    });
    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {
          '0x1': {
            ...buildSbtActivityCacheEntry({ sbtAddress: '0x1' }),
            sbtAddress: '0x1',
            sbtInfo: { name: 'Badge 1' },
            mintedAddresses: ['0xaaa'],
            burnedAddresses: ['0xbbb'],
          },
        },
      },
    });

    const sig1 = instance._buildCacheSignature(instance._iterScopeCaches({ clone: false }));
    const sbtCacheRef = peekCacheSync('sbtCache', '', { clone: false });
    sbtCacheRef[netKey].sbtList['0x1'].mintedAddresses = ['0xccc'];
    sbtCacheRef[netKey].sbtList['0x1'].burnedAddresses = ['0xddd'];
    const sig2 = instance._buildCacheSignature(instance._iterScopeCaches({ clone: false }));

    expect(sig2).not.toBe(sig1);
  });

  it('skips full recompute when the cache signature is unchanged', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('surveysCache', '', {
      [netKey]: {
        surveysLatestBlock: 10,
        surveys: { s1: { creator: '0xabc', title: 'Survey 1', questionIDs: [] } },
        surveyResponses: { s1: { '0xdef': {} } },
      },
    });
    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 10,
        questions: { q1: { creator: '0xabc' } },
        questionResponses: { q1: { '0xdef': {} } },
      },
    });
    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {
          '0x1': {
            ...buildSbtActivityCacheEntry({ sbtAddress: '0x1' }),
            sbtAddress: '0x1',
            sbtInfo: { creator: '0xabc' },
            mintedAddresses: [],
            burnedAddresses: [],
          },
        },
      },
    });

    instance.checkIfInitialLoadDone = jest.fn().mockResolvedValue(false);
    const computeSpy = jest.spyOn(instance, '_computeStatsSnapshot');
    const deepSigSpy = jest.spyOn(instance, '_buildCacheSignature');

    await instance._runStatsRefreshCycle({ force: false, markLoading: false });
    await instance._runStatsRefreshCycle({ force: false, markLoading: false });

    // One count for the tables and one for the chain sessions' share of the tiles (Worker sessions in view are
    // counted from their listings); the second cycle, with nothing changed, counts nothing again.
    expect(computeSpy).toHaveBeenCalledTimes(2);
    expect(deepSigSpy).toHaveBeenCalledTimes(1);
    expect(instance._statsUnchangedStreak).toBeGreaterThan(0);
  });

  it('recomputes stats when cache content mutates in place with stable counts', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('surveysCache', '', {
      [netKey]: {
        surveysLatestBlock: 10,
        surveys: { s1: { creator: '0xabc', title: 'Survey 1', questionIDs: [] } },
        surveyResponses: { s1: { '0xdef': {} } },
      },
    });
    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 10,
        questions: { q1: { creator: '0xabc' } },
        questionResponses: { q1: { '0xdef': {} } },
      },
    });
    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {
          '0x1': {
            ...buildSbtActivityCacheEntry({ sbtAddress: '0x1' }),
            sbtAddress: '0x1',
            sbtInfo: { creator: '0xabc' },
            mintedAddresses: [],
            burnedAddresses: [],
          },
        },
      },
    });

    instance.checkIfInitialLoadDone = jest.fn().mockResolvedValue(false);
    const computeSpy = jest.spyOn(instance, '_computeStatsSnapshot');
    const deepSigSpy = jest.spyOn(instance, '_buildCacheSignature');

    await instance._runStatsRefreshCycle({ force: false, markLoading: false });
    const surveysCacheRef = peekCacheSync('surveysCache', '', { clone: false });
    surveysCacheRef[netKey].surveys.s1.title = 'Survey 1 Updated';
    await instance._runStatsRefreshCycle({ force: false, markLoading: false });

    expect(deepSigSpy).toHaveBeenCalledTimes(2);
    // Two counts per change: the tables, and the chain sessions' share of the tiles.
    expect(computeSpy).toHaveBeenCalledTimes(4);
  });

  it('recomputes stats when question metadata mutates in place with stable counts', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('surveysCache', '', {
      [netKey]: {
        surveysLatestBlock: 10,
        surveys: {},
        surveyResponses: {},
      },
    });
    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 10,
        questions: { q1: { creator: '0xaaa' } },
        questionResponses: {},
      },
    });
    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {},
      },
    });

    instance.checkIfInitialLoadDone = jest.fn().mockResolvedValue(false);
    const computeSpy = jest.spyOn(instance, '_computeStatsSnapshot');
    const deepSigSpy = jest.spyOn(instance, '_buildCacheSignature');

    await instance._runStatsRefreshCycle({ force: false, markLoading: false });
    const questionsCacheRef = peekCacheSync('questionsCache', '', { clone: false });
    questionsCacheRef[netKey].questions.q1.creator = '0xbbb';
    await instance._runStatsRefreshCycle({ force: false, markLoading: false });

    expect(deepSigSpy).toHaveBeenCalledTimes(2);
    // Two counts per change: the tables, and the chain sessions' share of the tiles.
    expect(computeSpy).toHaveBeenCalledTimes(4);
    expect(instance.state.uniqueUsers).toContain('0xbbb');
    expect(instance.state.uniqueUsers).not.toContain('0xaaa');
  });

  it('recomputes stats when SBT admin metadata mutates in place with stable holder lists', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('surveysCache', '', {
      [netKey]: {
        surveysLatestBlock: 10,
        surveys: {},
        surveyResponses: {},
      },
    });
    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 10,
        questions: {},
        questionResponses: {},
      },
    });
    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {
          '0x1': {
            ...buildSbtActivityCacheEntry({ sbtAddress: '0x1' }),
            sbtAddress: '0x1',
            sbtInfo: { admin: '0xaaa' },
            mintedAddresses: ['0x111'],
            burnedAddresses: [],
          },
        },
      },
    });

    instance.checkIfInitialLoadDone = jest.fn().mockResolvedValue(false);
    const computeSpy = jest.spyOn(instance, '_computeStatsSnapshot');
    const deepSigSpy = jest.spyOn(instance, '_buildCacheSignature');

    await instance._runStatsRefreshCycle({ force: false, markLoading: false });
    const sbtCacheRef = peekCacheSync('sbtCache', '', { clone: false });
    sbtCacheRef[netKey].sbtList['0x1'].sbtInfo.admin = '0xbbb';
    await instance._runStatsRefreshCycle({ force: false, markLoading: false });

    expect(deepSigSpy).toHaveBeenCalledTimes(2);
    // Two counts per change: the tables, and the chain sessions' share of the tiles.
    expect(computeSpy).toHaveBeenCalledTimes(4);
    expect(instance.state.uniqueUsers).toContain('0xbbb');
    expect(instance.state.uniqueUsers).not.toContain('0xaaa');
  });

  it('recomputes stats when SBT creator metadata mutates in place with stable holder lists', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('surveysCache', '', {
      [netKey]: {
        surveysLatestBlock: 10,
        surveys: {},
        surveyResponses: {},
      },
    });
    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 10,
        questions: {},
        questionResponses: {},
      },
    });
    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {
          '0x1': {
            ...buildSbtActivityCacheEntry({ sbtAddress: '0x1' }),
            sbtAddress: '0x1',
            sbtInfo: { creator: '0xaaa' },
            mintedAddresses: ['0x111'],
            burnedAddresses: [],
          },
        },
      },
    });

    instance.checkIfInitialLoadDone = jest.fn().mockResolvedValue(false);
    const computeSpy = jest.spyOn(instance, '_computeStatsSnapshot');
    const deepSigSpy = jest.spyOn(instance, '_buildCacheSignature');

    await instance._runStatsRefreshCycle({ force: false, markLoading: false });
    const sbtCacheRef = peekCacheSync('sbtCache', '', { clone: false });
    sbtCacheRef[netKey].sbtList['0x1'].sbtInfo.creator = '0xbbb';
    await instance._runStatsRefreshCycle({ force: false, markLoading: false });

    expect(deepSigSpy).toHaveBeenCalledTimes(2);
    // Two counts per change: the tables, and the chain sessions' share of the tiles.
    expect(computeSpy).toHaveBeenCalledTimes(4);
    expect(instance.state.uniqueUsers).toContain('0xbbb');
    expect(instance.state.uniqueUsers).not.toContain('0xaaa');
  });

  it('recomputes stats when SBT hidden metadata mutates in place with stable holder lists', async () => {
    writeGlobalSessionSelection({ selectedSessionScope: 'general', primarySessionSlug: '' });
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('surveysCache', '', {
      [netKey]: {
        surveysLatestBlock: 10,
        surveys: {},
        surveyResponses: {},
      },
    });
    await writeCache('questionsCache', '', {
      [netKey]: {
        questionsLatestBlock: 10,
        questions: {},
        questionResponses: {},
      },
    });
    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {
          '0x1': {
            ...buildSbtActivityCacheEntry({ sbtAddress: '0x1' }),
            sbtAddress: '0x1',
            sbtInfo: { hidden: false },
            mintedAddresses: ['0x111'],
            burnedAddresses: [],
          },
        },
      },
    });

    instance.checkIfInitialLoadDone = jest.fn().mockResolvedValue(false);
    const computeSpy = jest.spyOn(instance, '_computeStatsSnapshot');
    const deepSigSpy = jest.spyOn(instance, '_buildCacheSignature');

    await instance._runStatsRefreshCycle({ force: false, markLoading: false });
    expect(instance.state.sbtsCreatedCount).toBe(1);

    const sbtCacheRef = peekCacheSync('sbtCache', '', { clone: false });
    sbtCacheRef[netKey].sbtList['0x1'].sbtInfo.hidden = true;
    await instance._runStatsRefreshCycle({ force: false, markLoading: false });

    expect(deepSigSpy).toHaveBeenCalledTimes(2);
    // No Worker session is in view in this one, so there is a single count per change.
    expect(computeSpy).toHaveBeenCalledTimes(2);
    expect(instance.state.sbtsCreatedCount).toBe(0);
  });

  it('forces a stats refresh after users-modal holder hydration completes', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    instance.state = {
      ...instance.state,
      showModal: true,
      modalType: 'users',
    };

    jest.spyOn(instance, '_isUniverseEnabled').mockReturnValue(false);
    jest.spyOn(instance, '_currentSlug').mockReturnValue('');
    const hydrateSlugSpy = jest.spyOn(instance, '_hydrateSbtHoldersForSlug').mockResolvedValue(undefined);
    const refreshSpy = jest.spyOn(instance, '_refreshCommunityStats').mockResolvedValue({ changed: true });

    await instance._hydrateSbtHoldersForUsersModal();

    expect(hydrateSlugSpy).toHaveBeenCalledWith('');
    expect(refreshSpy).toHaveBeenCalledWith({ force: true, markLoading: false });
  });

  it('persists the scanned holder watermark when hydrating SBT counts', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {
          '0x1': {
            ...buildSbtActivityCacheEntry({ sbtAddress: '0x1' }),
            sbtAddress: '0x1',
            creationBlock: 1,
            countsLoaded: false,
          },
        },
      },
    });
    jest.spyOn(contractScripts, 'getSbtMintBurnCountsByAddress').mockResolvedValue({
      mintedCountByAddress: { '0xabc': 1 },
      burnedCountByAddress: {},
      mintedEventCount: 1,
      burnedEventCount: 0,
      scannedToBlock: 25,
      ok: true,
    });

    await instance._hydrateSbtHoldersForSlug('');

    const cache = await readCache('sbtCache', '');
    expect(cache[netKey].sbtList['0x1']).toEqual(
      expect.objectContaining({
        mintedAddresses: ['0xabc'],
        burnedAddresses: [],
        countsLoaded: true,
        blockNumber: 25,
      }),
    );
  });

  it('preserves concurrent SBT cache rows while hydrating holder counts', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    const netKey = String(instance._resolveNetKeyForSlug('') || '');
    expect(netKey).not.toBe('');

    await writeCache('sbtCache', '', {
      [netKey]: {
        lastBlock: 10,
        sbtList: {
          '0x1': {
            ...buildSbtActivityCacheEntry({ sbtAddress: '0x1' }),
            sbtAddress: '0x1',
            creationBlock: 1,
            countsLoaded: false,
          },
        },
      },
    });
    jest.spyOn(contractScripts, 'getSbtMintBurnCountsByAddress').mockImplementation(async () => {
      await cacheScripts.updateCacheAtomic('sbtCache', '', (current) => ({
        ...(current || {}),
        [netKey]: {
          ...((current || {})[netKey] || {}),
          sbtList: {
            ...(((current || {})[netKey] || {}).sbtList || {}),
            '0x2': {
              ...buildSbtActivityCacheEntry({ sbtAddress: '0x2' }),
              sbtAddress: '0x2',
              creationBlock: 2,
              countsLoaded: false,
            },
          },
        },
      }));
      return {
        mintedCountByAddress: { '0xabc': 1 },
        burnedCountByAddress: {},
        mintedEventCount: 1,
        burnedEventCount: 0,
        scannedToBlock: 25,
        ok: true,
      };
    });

    await instance._hydrateSbtHoldersForSlug('');

    const cache = await readCache('sbtCache', '');
    expect(cache[netKey].sbtList['0x1']).toEqual(
      expect.objectContaining({
        mintedAddresses: ['0xabc'],
        countsLoaded: true,
      }),
    );
    expect(cache[netKey].sbtList['0x2']).toEqual(
      expect.objectContaining({
        sbtAddress: '0x2',
        countsLoaded: false,
      }),
    );
  });

  it('keeps users modal default filtered list in sync when unique users grows after hydration', async () => {
    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    instance.state = {
      ...instance.state,
      showModal: true,
      modalType: 'users',
      loadingFilter: false,
      uniqueUsers: ['0xaaa'],
      filteredUsers: ['0xaaa'],
      initialLoadDone: true,
    };

    jest.spyOn(instance, '_iterScopeCaches').mockReturnValue([]);
    jest.spyOn(instance, '_buildCoarseCacheSignature').mockReturnValue('coarse:next');
    jest.spyOn(instance, '_buildCacheSignature').mockReturnValue('sig:next');
    jest.spyOn(instance, '_computeStatsSnapshot').mockReturnValue({
      uniqueUsers: ['0xaaa', '0xbbb'],
      surveysCreatedCount: 1,
      surveyResponsesCount: 1,
      uniqueQuestionsCount: 1,
      surveysList: [],
      sbtsCreatedCount: 1,
    });
    instance._latestCoarseCacheSignature = 'coarse:prev';
    instance._latestCacheSignature = 'sig:prev';

    await instance._runStatsRefreshCycle({ force: false, markLoading: false });

    expect(instance.state.uniqueUsers).toEqual(['0xaaa', '0xbbb']);
    expect(instance.state.filteredUsers).toEqual(['0xaaa', '0xbbb']);
  });

  it('resets Users filters only on session changes and rejects callbacks across revisits and reopen', async () => {
    const alpha = { primarySessionSlug: 'alpha', selectedSessionScope: 'active', selectedSessionSlugs: [] };
    const beta = { ...alpha, primarySessionSlug: 'beta' };
    const instance = attachMutableSetState(new CommunityTab({ globalSessionSelection: alpha }));
    instance.state.initialLoadDone = true;
    jest.spyOn(instance, '_resolveNetKeyForSlug').mockReturnValue('11155420');
    jest.spyOn(instance, '_refreshSessionCatalog').mockImplementation(() => {});
    jest.spyOn(instance, '_scheduleNextStatsPoll').mockImplementation(() => {});
    jest.spyOn(instance, '_queueCacheDrivenRefresh').mockImplementation(() => {});
    jest.spyOn(instance, '_hydrateSbtHoldersForUsersModal').mockResolvedValue(undefined);
    for (const [slug, creator] of [
      ['alpha', '0xaaa'],
      ['beta', '0xbbb'],
    ]) {
      await writeCache('questionsCache', slug, { 11155420: { questions: { q: { type: 'binary', creator } } } });
    }
    const filter = () => collectTreeNodes(instance.renderModalContent(), (node) => node.type === SBTFilter)[0];
    const changeScope = (selection) => {
      const previousProps = instance.props;
      const previousState = instance.state;
      instance.props = { ...instance.props, globalSessionSelection: selection };
      instance.componentDidUpdate(previousProps, previousState);
    };
    await instance._runStatsRefreshCycle({ force: true });
    instance.handleStatClick({ label: 'Users' });
    const original = filter();
    original.props.onFilter([]);
    await instance._runStatsRefreshCycle({ force: true });
    expect(filter().key).toBe(original.key);
    expect(instance.state.filteredUsers).toEqual([]);

    changeScope(beta);
    expect(filter()).toBeUndefined();
    expect(collectNodeText(instance.renderModalContent())).not.toContain('0xaaa');
    original.props.onFilter(['0xstale']);
    original.props.setFilterLoading(false);
    expect(instance.state.filteredUsers).toEqual([]);
    expect(instance.state.loadingFilter).toBe(true);
    await instance._runStatsRefreshCycle({ force: true });
    const second = filter();
    expect(second.key).not.toBe(original.key);
    expect(second.props.items).toEqual(['0xbbb']);
    expect(instance.state.filteredUsers).toEqual(['0xbbb']);

    changeScope(alpha);
    await instance._runStatsRefreshCycle({ force: true });
    expect(filter().key).not.toBe(original.key);
    original.props.onFilter(['0xstale']);
    original.props.setFilterLoading(true);
    second.props.onFilter(['0xstale']);
    expect(instance.state.filteredUsers).toEqual(['0xaaa']);
    expect(instance.state.loadingFilter).toBe(false);
    const beforeClose = filter();
    instance.toggleModal();
    instance.handleStatClick({ label: 'Users' });
    beforeClose.props.onFilter(['0xstale']);
    beforeClose.props.setFilterLoading(true);
    expect(filter().key).not.toBe(beforeClose.key);
    expect(instance.state.filteredUsers).toEqual(['0xaaa']);
    expect(instance.state.loadingFilter).toBe(false);
  });

  it('does not expose old Users when opened before the new scope snapshot is ready', async () => {
    const alpha = { primarySessionSlug: 'alpha', selectedSessionScope: 'active', selectedSessionSlugs: [] };
    const instance = attachMutableSetState(new CommunityTab({ globalSessionSelection: alpha }));
    instance.state.initialLoadDone = true;
    jest.spyOn(instance, '_refreshSessionCatalog').mockImplementation(() => {});
    jest.spyOn(instance, '_queueCacheDrivenRefresh').mockImplementation(() => {});
    jest.spyOn(instance, '_iterScopeCaches').mockReturnValue([]);
    jest.spyOn(instance, '_computeStatsSnapshot').mockReturnValue({
      uniqueUsers: ['0xaaa'],
      surveysCreatedCount: 0,
      surveyResponsesCount: 0,
      uniqueQuestionsCount: 0,
      surveysList: [],
      sbtsCreatedCount: 0,
    });
    await instance._runStatsRefreshCycle({ force: true });
    instance.props = { ...instance.props, globalSessionSelection: { ...alpha, primarySessionSlug: 'beta' } };
    instance.handleStatClick({ label: 'Users' });
    expect(instance.state.filteredUsers).toEqual([]);
    expect(instance.state.loadingFilter).toBe(true);
    expect(collectTreeNodes(instance.renderModalContent(), (node) => node.type === SBTFilter)).toHaveLength(0);
    expect(
      collectTreeNodes(
        instance.renderModalContent(),
        (node) => node.props?.testId === 'ce-community-users-session-select',
      ),
    ).toHaveLength(1);
  });

  it('publishes the newly selected scope while old hydration and current readiness are still pending', async () => {
    const alpha = { primarySessionSlug: 'alpha', selectedSessionScope: 'active', selectedSessionSlugs: [] };
    const general = { primarySessionSlug: '', selectedSessionScope: 'general', selectedSessionSlugs: [] };
    const instance = attachMutableSetState(
      new CommunityTab({ globalSessionSelection: alpha, activeSessionSlug: 'alpha' }),
    );
    let releaseOldHydration;
    let releaseGeneralReadiness;
    const oldHydration = new Promise((resolve) => {
      releaseOldHydration = resolve;
    });
    const generalReadiness = new Promise((resolve) => {
      releaseGeneralReadiness = resolve;
    });
    jest.spyOn(instance, '_refreshSessionCatalog').mockImplementation(() => {});
    jest.spyOn(instance, '_resolveNetKeyForSlug').mockReturnValue('11155420');
    jest
      .spyOn(instance, '_hydrateWorkerGroupCounts')
      .mockImplementation((entries) => (entries[0]?.slug === 'alpha' ? oldHydration : Promise.resolve()));
    jest.spyOn(instance, 'checkIfInitialLoadDone').mockReturnValue(generalReadiness);
    await writeCache('questionsCache', 'alpha', {
      11155420: { questions: { alpha: { type: 'binary', prompt: 'Alpha', creator: '0xaaa' } } },
    });
    await writeCache('questionsCache', '', {
      11155420: { questions: { general: { type: 'binary', prompt: 'General', creator: '0xbbb' } } },
    });
    const oldRefresh = instance._refreshCommunityStats({ force: true });
    instance.props = { ...instance.props, globalSessionSelection: general };
    const currentRefresh = instance._refreshCommunityStats({ force: true });
    try {
      await Promise.resolve();
      await Promise.resolve();
      expect(instance.state.uniqueUsers).toEqual(['0xbbb']);
      expect(instance.state.stats.find(({ label }) => label === 'Questions').count).toBe(1);
      const latestSignature = instance._latestCacheSignature;
      const latestPoints = instance._beeswarmPoints;
      releaseOldHydration();
      await oldRefresh;
      expect(instance.state.uniqueUsers).toEqual(['0xbbb']);
      expect(instance._latestCacheSignature).toBe(latestSignature);
      expect(instance._beeswarmPoints).toBe(latestPoints);
      // The current refresh is done; only its readiness check is still out, and holds no later refresh.
      await currentRefresh;
      expect(instance._statsRefreshInFlight).toBe(false);
      expect(instance.state.initialLoadDone).toBe(false);
      releaseGeneralReadiness(true);
      await waitFor(() => expect(instance.state.initialLoadDone).toBe(true));
    } finally {
      releaseOldHydration();
      releaseGeneralReadiness(true);
      await Promise.all([oldRefresh, currentRefresh]);
      instance._isUnmounted = true;
    }
  });

  it('includes known Worker-only sessions in ALL after General without admitting numeric or mismatched caches', async () => {
    const bundled = WORKER_SESSION_CONFIG;
    const discovered = {
      ...bundled,
      slug: 'worker-discovered',
      sessionName: 'Discovered Worker',
      sessionId: '0x00112233445566778899aabbccddeeff',
      corsWorkerUrl: 'https://worker.example',
    };
    const bundledHint = {
      slug: bundled.slug,
      sessionId: bundled.sessionId,
      sessionName: bundled.sessionName,
      corsWorkerUrl: bundled.corsWorkerUrl,
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    };
    const configs = { [bundled.slug]: bundled, [discovered.slug]: discovered };
    jest.spyOn(chainGateway, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(chainGateway, 'getAllSessionEntries').mockReturnValue([]);
    jest.spyOn(chainGateway, 'getSessionConfigBySlug').mockReturnValue(null);
    jest
      .spyOn(chainGateway, 'getDemoSessionConfigBySlug')
      .mockImplementation((slug) => (slug === bundled.slug ? bundledHint : null));
    jest.spyOn(sessionSources, 'getAllDemoSessionConfigs').mockReturnValue([[bundled.slug, bundledHint]]);
    const all = { primarySessionSlug: '', selectedSessionScope: 'all', selectedSessionSlugs: [] };
    const instance = attachMutableSetState(new CommunityTab({ globalSessionSelection: all, activeSessionSlug: '' }));
    instance.state.initialLoadDone = true;
    instance._hydrateWorkerGroupCounts = jest.fn(async () => {});
    instance._resolveNetKeyForSlug = () => '11155420';
    for (const [index, config] of Object.values(configs).entries()) {
      expect(
        workerConfigCache.upsertWorkerCanonicalSessionBootstrap({
          slug: config.slug,
          sessionIdHex: config.sessionId,
          workerOrigin: config.corsWorkerUrl,
          config,
        }).status,
      ).toBe('cached');
      mockListingCounts[config.slug] = { questions: 1, surveys: 0, responders: [] };
      const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: config, sessionSlug: config.slug });
      await writeCache('questionsCache', config.slug, {
        11155420: { questions: { stale: { type: 'binary', prompt: 'Wrong numeric question', creator: '0xstale' } } },
        worker: withWorkerCanonicalCacheIdentity(
          { questions: { [config.slug]: { type: 'binary', prompt: config.sessionName, creator: `0x${index + 1}` } } },
          identity,
        ),
      });
      instance._workerGroupCountCache.set(instance._getWorkerGroupCountCacheKey(identity), {
        count: index + 1,
        groupIds: Array.from({ length: index + 1 }, (_, n) => `group-${n}`),
        groups: Array.from({ length: index + 1 }, (_, n) => ({
          groupId: `group-${n}`,
          label: `Group ${n}`,
          open: true,
        })),
        visibleUserIds: [],
        status: 'ready',
        updatedAtMs: Date.now(),
      });
    }
    await writeCache('questionsCache', '', {
      11155420: { questions: { general: { type: 'binary', prompt: 'General seed' } } },
    });
    await instance._runStatsRefreshCycle({ force: true });
    expect(instance.state.sessions.map(({ slug }) => slug)).toEqual(expect.arrayContaining(Object.keys(configs)));
    expect(instance._iterScopeCaches().map(({ slug }) => slug)).toEqual(expect.arrayContaining(Object.keys(configs)));
    expect(instance.state.uniqueUsers).toEqual(['0x1', '0x2']);
    expect(instance.state.sbtsCreatedCount).toBe(3);
    const groupsDialog = render(instance.renderGroupsDialog());
    expect(screen.getByTestId('ce-community-groups-dialog')).toHaveTextContent('2 sessions, 3 groups');
    groupsDialog.unmount();
    expect(instance.state.stats.find(({ label }) => label === 'Questions').count).toBe(3);
    instance.props = { ...instance.props, globalSessionSelection: { ...all, selectedSessionScope: 'general' } };
    await instance._runStatsRefreshCycle({ force: true });
    expect(instance.state.uniqueUsers).toEqual([]);
    expect(instance.state.sbtsCreatedCount).toBe(0);
    instance.props = { ...instance.props, globalSessionSelection: all };
    await instance._runStatsRefreshCycle({ force: true });
    expect(instance.state.uniqueUsers).toEqual(['0x1', '0x2']);
    const badIdentity = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: { ...discovered, corsWorkerUrl: 'https://mismatch.example' },
      sessionSlug: discovered.slug,
    });
    await writeCache('questionsCache', discovered.slug, {
      worker: withWorkerCanonicalCacheIdentity(
        { questions: { wrong: { type: 'binary', creator: '0xwrong' } } },
        badIdentity,
      ),
    });
    await instance._runStatsRefreshCycle({ force: true });
    expect(instance.state.uniqueUsers).toEqual(['0x1']);
    // The mismatched cache is still kept out of the tables; the tile counts each Worker session from its own
    // listing, which does not depend on what this browser cached.
    expect(instance.state.stats.find(({ label }) => label === 'Questions').count).toBe(3);
  });

  it.each(['missing', 'wrong-slug', 'wrong-origin', 'wrong-session-id', 'ambiguous'])(
    'keeps %s Worker bootstrap authority fail-closed for Stats caches',
    async (variant) => {
      const config = { ...WORKER_SESSION_CONFIG, slug: 'worker-only', corsWorkerUrl: 'https://worker.example' };
      const hint = {
        slug: config.slug,
        sessionId: config.sessionId,
        corsWorkerUrl: config.corsWorkerUrl,
        sessionModeProfile: { authority: { mode: 'worker_canonical' } },
      };
      jest.spyOn(chainGateway, 'getSessionConfigBySlug').mockReturnValue(null);
      jest.spyOn(chainGateway, 'getDemoSessionConfigBySlug').mockReturnValue(variant === 'ambiguous' ? null : hint);
      if (variant !== 'missing') {
        const { cacheKey } = workerConfigCache.upsertWorkerCanonicalSessionBootstrap({
          slug: config.slug,
          sessionIdHex: config.sessionId,
          workerOrigin: config.corsWorkerUrl,
          config,
        });
        const store = workerConfigCache.readSessionWorkerConfigCache();
        const record = store.bySession[cacheKey];
        if (variant === 'wrong-slug') record.canonicalConfig.slug = 'unrelated';
        if (variant === 'wrong-origin') record.canonicalConfig.corsWorkerUrl = 'https://unrelated.example';
        if (variant === 'wrong-session-id') record.canonicalConfig.sessionId = '0x00112233445566778899aabbccddeeff';
        if (variant === 'ambiguous') {
          const otherId = '0x00112233445566778899aabbccddeeff';
          store.bySession[`session:0:${otherId}`] = {
            ...record,
            sessionIdHex: otherId,
            workerOrigin: 'https://unrelated.example',
            canonicalConfig: { ...config, sessionId: otherId, corsWorkerUrl: 'https://unrelated.example' },
          };
        }
        localStorage.setItem('ce:sessionWorkerConfigCache:v1', JSON.stringify(store));
      }
      const instance = new CommunityTab({});
      instance._resolveNetKeyForSlug = () => '11155420';
      const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: config, sessionSlug: config.slug });
      await writeCache('questionsCache', config.slug, {
        11155420: { questions: { wrongNumeric: {} } },
        worker: withWorkerCanonicalCacheIdentity({ questions: { wrongWorker: {} } }, identity),
      });
      const [scope] = instance._buildScopeEntriesFromSlugs([config.slug]);
      expect(scope.isWorkerCanonical).toBe(true);
      expect(scope.workerCanonicalIdentity).toBeNull();
      expect(scope.questionsCache).toEqual({});
    },
  );

  it('keeps a configured registry session authoritative over a cached Worker with the same slug', () => {
    const config = { ...WORKER_SESSION_CONFIG, slug: 'registered', corsWorkerUrl: 'https://worker.example' };
    workerConfigCache.upsertWorkerCanonicalSessionBootstrap({
      slug: config.slug,
      sessionIdHex: config.sessionId,
      workerOrigin: config.corsWorkerUrl,
      config,
    });
    const registered = {
      slug: config.slug,
      networkChainId: 11155420,
      sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } },
    };
    jest.spyOn(chainGateway, 'getSessionConfigBySlug').mockReturnValue(registered);
    const instance = new CommunityTab({});
    expect(instance._resolveScopeAuthority(config.slug)).toMatchObject({
      isWorkerCanonical: false,
      sessionConfig: registered,
      workerCanonicalIdentity: null,
    });
  });

  it('isolates new tabs opened from filtered user results', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      modalType: 'users',
      loadingFilter: false,
      uniqueUsers: [address],
      filteredUsers: [address],
      usersFilterSelectionKey: instance._statsSelectionKey(),
    };
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    const tree = instance.renderModalContent();
    const [userResult] = collectTreeNodes(
      tree,
      (node) => node?.type === 'div' && typeof node?.props?.onClick === 'function',
    );
    userResult.props.onClick();

    expect(openSpy).toHaveBeenCalledWith(`/u/${address}`, '_blank', 'noopener,noreferrer');
  });

  it('uses adaptive timeout delays for unchanged polling streaks', () => {
    const instance = new CommunityTab({});

    instance._statsPollStartedAtMs = Date.now();
    instance._statsUnchangedStreak = 0;
    expect(instance._computeNextPollDelayMs()).toBe(1000);

    instance._statsUnchangedStreak = 6;
    expect(instance._computeNextPollDelayMs()).toBe(2500);

    instance._statsUnchangedStreak = 11;
    expect(instance._computeNextPollDelayMs()).toBe(5000);

    instance._statsPollStartedAtMs = Date.now() - 31000;
    instance._statsUnchangedStreak = 0;
    expect(instance._computeNextPollDelayMs()).toBe(30000);

    instance._statsUnchangedStreak = 4;
    expect(instance._computeNextPollDelayMs()).toBe(45000);

    instance._statsPollStartedAtMs = Date.now() - 121000;
    expect(instance._computeNextPollDelayMs()).toBe(60000);
  });

  it('does not run unconditional group recount work in componentDidUpdate', () => {
    const provider = {};
    const props = {
      network: { id: 1 },
      provider,
      sbtCacheRevision: 1,
      isSBTCacheReady: false,
      isSurveyCacheReady: false,
      isQuestionCacheReady: false,
      activeSessionSlug: '',
    };
    const instance = new CommunityTab(props);
    const recountSpy = jest.spyOn(instance, 'updateSbtGroupsCountFromCache');
    const refreshSpy = jest.spyOn(instance, '_refreshCommunityStats').mockResolvedValue({ changed: false });

    const prevProps = { ...props, provider };
    const prevState = { ...instance.state, showModal: false };
    instance.componentDidUpdate(prevProps, prevState);

    expect(recountSpy).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('coalesces bursty managed-cache updates into one stats refresh', async () => {
    jest.useFakeTimers();
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = undefined;
    window.cancelAnimationFrame = undefined;

    let cacheHandler = null;
    const unsubscribe = jest.fn();
    jest.spyOn(cacheScripts, 'subscribeCacheUpdates').mockImplementation((handler) => {
      cacheHandler = handler;
      return unsubscribe;
    });

    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    instance._scheduleNextStatsPoll = jest.fn();
    const refreshSpy = jest.spyOn(instance, '_refreshCommunityStats').mockResolvedValue({ changed: false });

    instance.componentDidMount();
    refreshSpy.mockClear();

    cacheHandler({ namespace: 'questionsCache' });
    cacheHandler({ namespace: 'questionsCache' });
    cacheHandler({ namespace: 'questionsCache' });
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledWith({ force: false, markLoading: false });

    instance.componentWillUnmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
    jest.useRealTimers();
  });

  it('skips cache-driven refresh scheduling while hidden', async () => {
    jest.useFakeTimers();
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = undefined;
    window.cancelAnimationFrame = undefined;

    let cacheHandler = null;
    const unsubscribe = jest.fn();
    jest.spyOn(cacheScripts, 'subscribeCacheUpdates').mockImplementation((handler) => {
      cacheHandler = handler;
      return unsubscribe;
    });

    const instance = attachMutableSetState(new CommunityTab({ activeSessionSlug: '' }));
    instance._scheduleNextStatsPoll = jest.fn();
    const refreshSpy = jest.spyOn(instance, '_refreshCommunityStats').mockResolvedValue({ changed: false });
    instance.componentDidMount();
    refreshSpy.mockClear();

    instance._isDocumentHidden = jest.fn(() => true);
    cacheHandler({ namespace: 'sbtCache' });
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(refreshSpy).not.toHaveBeenCalled();

    instance.componentWillUnmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
    jest.useRealTimers();
  });

  it.each([
    {
      rule: 'same address on different chains counts twice',
      chains: ['1', '10'],
      addresses: ['0x' + 'ab'.repeat(20), '0x' + 'ab'.repeat(20)],
      count: 2,
    },
    {
      rule: 'different addresses on the same chain count twice',
      chains: ['1', '1'],
      addresses: ['0x' + 'ab'.repeat(20), '0x' + 'cd'.repeat(20)],
      count: 2,
    },
    {
      rule: 'same chain and address across sessions counts once',
      chains: ['10', '10'],
      addresses: ['0x' + 'AB'.repeat(20), '0x' + 'ab'.repeat(20)],
      count: 1,
    },
  ])('$rule without counting an account twice', async ({ chains, addresses, count }) => {
    const slugs = ['chain-fixture-a', 'chain-fixture-b'];
    const instance = new CommunityTab({});
    instance._resolveNetKeyForSlug = jest.fn((slug) => chains[slugs.indexOf(slug)]);
    instance._resolveScopeAuthority = jest.fn(() => ({ isWorkerCanonical: false, workerCanonicalIdentity: null }));
    for (const [index, slug] of slugs.entries()) {
      await writeCache('sbtCache', slug, {
        [chains[index]]: {
          sbtList: {
            [addresses[index].toLowerCase()]: {
              ...buildSbtActivityCacheEntry({ sbtAddress: addresses[index] }),
              sbtAddress: addresses[index],
              sbtInfo: { creator: '0x123', admin: '0x123' },
              mintedAddresses: ['0x123'],
              burnedAddresses: [],
            },
          },
        },
      });
    }
    const entries = instance._buildScopeEntriesFromSlugs(slugs);
    expect(entries.map((entry) => entry.netKey)).toEqual(chains);
    const stats = instance._computeUniverseStatsSnapshot(entries);
    expect(stats.sbtsCreatedCount).toBe(count);
    expect(stats.uniqueUsers).toEqual(['0x123']);
    // The Groups dialog's total is the tile's.
    instance._iterScopeCaches = jest.fn(() => entries);
    render(instance.renderGroupsDialog());
    expect(screen.getByTestId('ce-community-groups-dialog')).toHaveTextContent(`2 sessions, ${count} group`);
  });
});
