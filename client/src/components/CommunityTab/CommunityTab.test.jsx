import CommunityTab from './CommunityTab';
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
import contractScripts from '../../utilities/web3/chainGateway.js';
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

  it('removes the community stats session selector while keeping the leaderboard controls gear', () => {
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
    expect(leaderboardToggleNode).toBeTruthy();
  });

  it('renders leaderboard hide filters behind a cog panel', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'demo' });
    instance.state = {
      ...instance.state,
      showLeaderboardControls: true,
      hideSimulatedUsers: true,
      hideHumanUsers: false,
    };

    const tree = instance.render();
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

  it('keeps the default layout minimal while exposing the classic participant window label', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'demo' });
    const tree = instance.render();
    const headings = collectTreeNodes(tree, (node) => node?.type === 'h2');
    const headingText = headings.map((node) => collectNodeText(node).trim()).filter(Boolean);

    expect(headingText).not.toContain('Leaderboard');
    expect(headingText).not.toContain('Statistics');
    expect(headingText).toEqual(expect.arrayContaining([expect.stringMatching(/^Participants \(\d+\)$/)]));
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
      const questionsTree = instance.renderModalContent();
      const [questionsAnchor] = collectTreeNodes(
        questionsTree,
        (node) => node?.type === 'a' && typeof node?.props?.href === 'string',
      );
      expect(questionsAnchor.props.href).toBe('/ce/questions');

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

  it('renders a beeswarm preview alongside the full questions link in modal content', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      modalType: 'questions',
    };
    instance._beeswarmPoints = [
      {
        questionId: 'q1',
        label: 'Prompt one',
        value: 0.34,
        agrees: 2,
        disagrees: 1,
        unsure: 0,
        total: 3,
      },
    ];

    const tree = instance.renderModalContent();
    const [plotNode] = collectTreeNodes(tree, (node) => node?.type === BeeswarmPlot);
    const [anchorNode] = collectTreeNodes(tree, (node) => node?.type === 'a' && node?.props?.href === '/questions');
    const modalChildren = Array.isArray(tree?.props?.children)
      ? tree.props.children
      : [tree?.props?.children].filter(Boolean);
    const [topBarNode, plotWrapNode] = modalChildren;

    expect(plotNode).toBeTruthy();
    expect(plotNode.props.points).toEqual(instance._beeswarmPoints);
    expect(plotNode.props.domain).toEqual([0, 1]);
    expect(plotNode.props.height).toBe(240);
    expect(plotNode.props.showIdleSummary).toBe(false);
    expect(anchorNode).toBeTruthy();
    expect(collectNodeText(anchorNode)).toBe('View Full Questions');
    expect(anchorNode.props.target).toBeUndefined();
    expect(anchorNode.props.rel).toBeUndefined();
    expect(topBarNode).toBeTruthy();
    expect(plotWrapNode).toBeTruthy();
    expect(
      collectTreeNodes(topBarNode, (node) => node?.type === 'a' && node?.props?.href === '/questions'),
    ).toHaveLength(1);
    expect(collectTreeNodes(plotWrapNode, (node) => node?.type === BeeswarmPlot)).toHaveLength(1);
  });

  it('falls back to computed beeswarm points in the questions modal when no cached points exist', () => {
    const instance = new CommunityTab({ activeSessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      modalType: 'questions',
    };
    instance._beeswarmPoints = [];
    const fallbackPoints = [
      {
        questionId: 'q-fallback',
        label: 'Fallback prompt',
        value: 0,
        agrees: 0,
        disagrees: 0,
        unsure: 0,
        total: 0,
      },
    ];
    jest.spyOn(instance, '_shouldUseDemoBeeswarmData').mockReturnValue(false);
    const buildSpy = jest.spyOn(instance, '_buildCommunityBeeswarmPoints').mockReturnValue(fallbackPoints);

    const tree = instance.renderModalContent();
    const [plotNode] = collectTreeNodes(tree, (node) => node?.type === BeeswarmPlot);

    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(plotNode).toBeTruthy();
    expect(plotNode.props.points).toBe(fallbackPoints);
  });

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
