import React from 'react';
import { act, render, screen } from '@testing-library/react';
import CommunityTab from './CommunityTab';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import * as polisReportModule from '../PolisReport/PolisReport';
import {
  initCacheManager,
  listNamespaceEntriesSync,
  peekCacheSync,
  readCache,
  removeCache,
  writeCache,
} from '../../utilities/cache/cacheScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import contractScripts, * as chainGateway from '../../utilities/web3/chainGateway.js';
import * as sessionSources from '../../utilities/session/sessionSourceResolver';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT } from '../../utilities/web3/sessionRegistry';
import * as workerGroupPorts from '../../domains/worker/workerGroupPorts';
import * as workerAuth from '../../utilities/worker/workerAuth';
import { dispatchWorkerGroupsChanged } from '../../utilities/worker/workerGroupChangeEvents';
import {
  WORKER_CANONICAL_CACHE_SCOPE_KEY,
  resolveWorkerCanonicalCacheIdentity,
  withWorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import BeeswarmPlot from '../Shared/BeeswarmPlot/BeeswarmPlot';
import SBTsList from '../SBTs/SBTsList';
import { POLIS_DEMO_DATA_AUTOLOAD_SLUGS } from '../../variables/appConfig.js';
import demoSessions from '../../variables/demo/demo_sessions.json';

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
    const entries = listNamespaceEntriesSync(namespace);
    await Promise.all(entries.map((entry) => removeCache(namespace, entry?.slug || '')));
    await removeCache(namespace, '');
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
    globalThis.CE_SESSION_SCAN_SCOPE = 'active';
    globalThis.CE_SESSION_SCAN_SLUGS = [];
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
      expect(collectTreeNodes(body, (node) => node.type === 'table')).toHaveLength(1);
    }
  });

  it('names selected sessions and uses an all-session label for combined scope', () => {
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

  it('counts authorized Worker groups for a signed-in Cloudflare session', async () => {
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
    expect(instance.state.stats.find((stat) => stat.label === 'Users').count).toBe(4);
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
      localStorage.removeItem('ce:sessionScanScope');
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

      instance.state = {
        ...instance.state,
        modalType: 'questions',
      };
      const [questionsTree] = collectTreeNodes(instance.render(), (node) => node.type === ModalHeader);
      const [questionsAnchor] = collectTreeNodes(
        questionsTree,
        (node) => node?.type === 'a' && typeof node?.props?.href === 'string',
      );
      expect(questionsAnchor.props.href).toBe('/ce/session/edge');

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

  it('lists scoped questions of every type with their own session report links', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';
    try {
      const instance = new CommunityTab({ activeSessionSlug: 'active' });
      instance.state.modalType = 'questions';
      instance._iterScopeCaches = jest.fn(() => [
        {
          slug: '',
          sessionConfig: {},
          questionsCache: {
            questions: {
              repeated: { prompt: 'General freeform question', type: 'freeform' },
              rating: { prompt: 'General rating question', type: 'rating' },
            },
          },
        },
        {
          slug: 'edge session',
          sessionConfig: { slug: 'edge session', sessionName: 'Edge discussion' },
          questionsCache: {
            questions: {
              repeated: { prompt: 'Named session binary question', type: 'binary' },
              multi: { prompt: 'Named multiple choice question', type: 'multichoice' },
              quadratic: { prompt: 'Named allocation question', type: 'quadratic' },
            },
          },
        },
      ]);
      const tree = instance.renderModalContent();
      const [table] = collectTreeNodes(tree, (node) => node.type === 'table');
      expect(table.props['aria-label']).toBe('Questions by session');
      expect(collectTreeNodes(table, (node) => node.type === 'th').map(collectNodeText)).toEqual([
        'Session',
        'Question',
      ]);
      const rows = collectTreeNodes(table, (node) => node.props?.['data-ce-question-id']);
      expect(rows).toHaveLength(5);
      expect(rows.map((row) => row.props['data-ce-session-slug'])).toEqual([
        '',
        '',
        'edge session',
        'edge session',
        'edge session',
      ]);
      expect(
        collectTreeNodes(rows, (node) => node.type === 'a').map((node) => [collectNodeText(node), node.props.href]),
      ).toEqual([
        ['General freeform question', '/ce/session#report'],
        ['General rating question', '/ce/session#report'],
        ['Named session binary question', '/ce/session/edge%20session#report'],
        ['Named multiple choice question', '/ce/session/edge%20session#report'],
        ['Named allocation question', '/ce/session/edge%20session#report'],
      ]);
      expect(collectNodeText(rows[0])).toContain('General');
      expect(collectNodeText(rows[2])).toContain('Edge discussion');
      expect(new Set(rows.map((row) => row.key)).size).toBe(5);
      expect(collectTreeNodes(tree, (node) => node.type === BeeswarmPlot)).toHaveLength(0);
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('refreshes open question titles as cached metadata arrives without recounting Stats', async () => {
    class QuestionsTableView extends CommunityTab {
      componentDidMount() {}
      componentDidUpdate() {}
      render() {
        return this.renderQuestionsModalContent();
      }
    }
    const ref = React.createRef();
    const view = render(<QuestionsTableView ref={ref} activeSessionSlug="" />);
    const instance = ref.current;
    const netKey = String(instance._resolveNetKeyForSlug(''));
    const writeQuestion = (question) =>
      writeCache('questionsCache', '', {
        [netKey]: { questionsLatestBlock: 10, questions: { q1: question }, questionResponses: {} },
      });
    const refresh = () =>
      act(async () => {
        await instance._runStatsRefreshCycle({ force: false });
      });
    try {
      await writeQuestion({ creator: '0xabc', type: 'freeform' });
      act(() => instance.setState({ showModal: true, modalType: 'questions', initialLoadDone: true }));
      await refresh();
      expect(screen.getByRole('link', { name: 'Question q1' })).toBeVisible();
      const originalStats = instance.state.stats;
      const computeStats = jest.spyOn(instance, '_computeStatsSnapshot');
      const renderTable = jest.spyOn(instance, 'renderQuestionsModalContent');
      await writeQuestion({ creator: '0xabc', type: 'freeform', prompt: 'Hydrated question title' });
      await refresh();
      expect(screen.getByRole('link', { name: 'Hydrated question title' })).toHaveAttribute('href', '/session#report');
      expect(instance.state.stats).toBe(originalStats);
      expect(computeStats).not.toHaveBeenCalled();
      renderTable.mockClear();
      await refresh();
      expect(renderTable).not.toHaveBeenCalled();
      peekCacheSync('questionsCache', '', { clone: false })[netKey].questions.q1.prompt = 'Updated in place';
      await refresh();
      expect(screen.getByRole('link', { name: 'Updated in place' })).toBeVisible();
      act(() => instance.setState({ showModal: false, modalType: null }));
      renderTable.mockClear();
      await writeQuestion({ creator: '0xabc', type: 'freeform', prompt: 'Changed while closed' });
      await refresh();
      expect(renderTable).not.toHaveBeenCalled();
      act(() => instance.setState({ showModal: true, modalType: 'questions' }));
      expect(screen.getByRole('link', { name: 'Changed while closed' })).toBeVisible();
    } finally {
      view.unmount();
    }
  });

  it('uses identity-matched Worker questions without stale numeric metadata', async () => {
    await writeWorkerStatsCaches();
    const instance = new CommunityTab({ activeSessionSlug: 'demo-sh', sessionConfig: WORKER_SESSION_CONFIG });
    instance.state.modalType = 'questions';
    instance._getSelectedSessionSlugs = jest.fn(() => ['demo-sh']);
    const content = instance.renderModalContent();
    expect(collectNodeText(content)).toContain('Worker question');
    expect(collectNodeText(content)).not.toContain('Stale numeric question');
    expect(collectTreeNodes(content, (node) => node.type === 'a').map((node) => node.props.href)).toEqual([
      '/session/demo-sh#report',
    ]);
  });

  it('keeps unknown session labels and empty scopes free of unrelated demo fallbacks', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'unknown' });
    instance.state.modalType = 'questions';
    jest
      .spyOn(chainGateway, 'getDemoSessionConfigBySlug')
      .mockReturnValue({ slug: 'demo', sessionName: 'Unrelated demo' });
    instance._iterScopeCaches = jest.fn(() => [
      {
        slug: 'unknown',
        sessionConfig: {},
        questionsCache: {
          questions: {
            unnamed: {},
            encrypted: { prompt: '[encrypted]' },
          },
        },
      },
    ]);
    const text = collectNodeText(instance.renderModalContent());
    expect(text).toContain('unknown');
    expect(text).not.toContain('Unrelated demo');
    expect(text).toContain('Question unnamed');
    expect(text).toContain('Encrypted question');
    instance._iterScopeCaches.mockReturnValue([{ slug: 'unknown', sessionConfig: {}, questionsCache: {} }]);
    const empty = instance.renderModalContent();
    expect(collectNodeText(empty)).toContain('No questions available for the selected sessions.');
    expect(collectTreeNodes(empty, (node) => node.type === 'a')).toHaveLength(0);
  });

  it('uses exact-session demo question names only when that demo has no cached questions', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'demo' });
    instance.state.modalType = 'questions';
    const exactDataset = { comments: [{ commentId: 'demo-1', commentBody: 'Exact demo question', type: 'rating' }] };
    const lookup = jest
      .spyOn(polisReportModule, 'getPolisDemoDatasetForSlug')
      .mockImplementation((slug, options) =>
        slug === 'demo' && options?.allowFallback === false
          ? exactDataset
          : { comments: [{ commentId: 'wrong', commentBody: 'Wrong fallback' }] },
      );
    instance._iterScopeCaches = jest.fn(() => [
      { slug: 'demo', sessionConfig: { slug: 'demo', sessionName: 'Demo Session' }, questionsCache: {} },
      { slug: 'unknown', sessionConfig: {}, questionsCache: {} },
      { slug: 'demo-sh', isWorkerCanonical: true, sessionConfig: WORKER_SESSION_CONFIG, questionsCache: {} },
    ]);
    const content = instance.renderModalContent();
    expect(collectNodeText(content)).toContain('Exact demo question');
    expect(collectNodeText(content)).not.toContain('Wrong fallback');
    expect(collectTreeNodes(content, (node) => node.type === 'a').map((node) => node.props.href)).toEqual([
      '/session/demo#report',
    ]);
    expect(lookup).toHaveBeenCalledWith('demo', { allowFallback: false });
    expect(lookup).not.toHaveBeenCalledWith('demo-sh', expect.anything());
  });

  it('keeps the questions table in the body and links the active session from the Details header', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      modalType: 'questions',
      modalTitle: 'Questions Details',
    };
    instance._getSelectedSessionSlugs = jest.fn(() => ['other-session', 'edge']);
    instance._iterScopeCaches = jest.fn(() => [
      {
        slug: 'other-session',
        sessionConfig: {},
        questionsCache: { questions: { q1: { prompt: 'Prompt one' } } },
      },
    ]);

    const tree = instance.render();
    const [header] = collectTreeNodes(tree, (node) => node.type === ModalHeader);
    const [body] = collectTreeNodes(tree, (node) => node.type === ModalBody);
    const [table] = collectTreeNodes(body, (node) => node.type === 'table');
    const [anchorNode] = collectTreeNodes(header, (node) => node.type === 'a');

    expect(collectNodeText(table)).toContain('Prompt one');
    expect(anchorNode).toBeTruthy();
    expect(anchorNode.props.href).toBe('/session/edge');
    expect(collectNodeText(anchorNode)).toBe('View Full Questions');
    expect(anchorNode.props.target).toBeUndefined();
    expect(anchorNode.props.rel).toBeUndefined();
    expect(collectTreeNodes(header, (node) => node.type === 'h5').map(collectNodeText)).toEqual(['Questions Details']);
    expect(header.props.tag).toBe('div');
    expect(header.props.toggle).toBe(instance.toggleModal);
    expect(collectTreeNodes(body, (node) => node.type === 'a')[0].props.href).toBe('/session/other-session#report');
  });

  it.each([
    ['', '', '/session'],
    ['general', '/ce/', '/ce/session'],
    [' Edge Session ', '/ce/', '/ce/session/edge%20session'],
  ])('uses the active session route for %p under base path %p', (activeSessionSlug, publicUrl, expectedHref) => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = publicUrl;
    try {
      const instance = new CommunityTab({ activeSessionSlug });
      instance.state.modalType = 'questions';
      instance._getSelectedSessionSlugs = jest.fn(() => ['different-session']);
      const [header] = collectTreeNodes(instance.render(), (node) => node.type === ModalHeader);
      expect(collectTreeNodes(header, (node) => node.type === 'a')[0].props.href).toBe(expectedHref);
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it.each(['users', 'surveys', 'sbtgroups', 'sessions'])(
    'keeps the questions link out of the %s modal header',
    (type) => {
      const instance = new CommunityTab({ activeSessionSlug: 'edge' });
      instance.state.modalType = type;
      const [header] = collectTreeNodes(instance.render(), (node) => node.type === ModalHeader);
      expect(collectTreeNodes(header, (node) => node.type === 'a')).toHaveLength(0);
      expect(header.props.tag).toBe(type === 'sessions' ? 'div' : 'h5');
    },
  );

  it('opts the CommunityTab SBT modal into compact SBT settings without affecting other SBTsList uses', () => {
    const instance = new CommunityTab({
      provider: 'mock-provider',
      network: { id: 84532, name: 'Base Sepolia' },
      account: '0xabc',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      isSBTCacheReady: false,
      sbtRealtimeCoverageBySlug: { alpha: true },
      ensureLightSbtDiscovery: jest.fn(),
      ensureLightSbtUniverse: jest.fn(),
    });
    instance.state = {
      ...instance.state,
      modalType: 'sbts',
    };

    const tree = instance.renderModalContent();
    const [sbtListNode] = collectTreeNodes(tree, (node) => node?.type === SBTsList);

    expect(sbtListNode).toBeTruthy();
    expect(sbtListNode.props.communityTabCompactSettings).toBe(true);
    expect(sbtListNode.props.interactiveMiniCards).toBe(true);
    expect(sbtListNode.props.miniaturized).toBe(true);
    expect(sbtListNode.props.viewMode).toBe('modal');
    expect(sbtListNode.props.sbtRealtimeCoverageBySlug).toEqual({ alpha: true });
  });

  it('routes the Groups modal through the exact active Worker session', () => {
    const instance = new CommunityTab({
      activeSessionSlug: 'demo-sh',
      sessionConfig: WORKER_SESSION_CONFIG,
      provider: 'mock-provider',
      network: { id: 11155420, name: 'OP Sepolia' },
      account: '',
      loginComplete: false,
      toggleLoginModal: jest.fn(),
    });
    instance.state = {
      ...instance.state,
      modalType: 'groups',
    };

    const tree = instance.renderModalContent();
    const [sbtListNode] = collectTreeNodes(tree, (node) => node?.type === SBTsList);

    expect(sbtListNode.props.sessionSlug).toBe('demo-sh');
    expect(sbtListNode.props.sessionConfig).toBe(WORKER_SESSION_CONFIG);
    expect(sbtListNode.props.embeddedMode).toBe(true);
    expect(sbtListNode.props.allSessionsMode).toBe(false);
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

    expect(computeSpy).toHaveBeenCalledTimes(1);
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
    expect(computeSpy).toHaveBeenCalledTimes(2);
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
    expect(computeSpy).toHaveBeenCalledTimes(2);
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
    expect(computeSpy).toHaveBeenCalledTimes(2);
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
    expect(computeSpy).toHaveBeenCalledTimes(2);
    expect(instance.state.uniqueUsers).toContain('0xbbb');
    expect(instance.state.uniqueUsers).not.toContain('0xaaa');
  });

  it('recomputes stats when SBT hidden metadata mutates in place with stable holder lists', async () => {
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

  it('isolates new tabs opened from filtered user results', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      modalType: 'users',
      loadingFilter: false,
      uniqueUsers: [address],
      filteredUsers: [address],
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
});
