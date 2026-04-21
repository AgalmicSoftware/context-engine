/** @file UserPage.test.jsx */
import UserPage from './UserPage.jsx';
import styles from './UserPage.module.scss';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import { analyzeUserOpinions } from 'utilities/ai/aiScripts.js';
import { ethers } from 'ethers';

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  getGlobalLitHooks: jest.fn(() => null),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    decryptSingleField: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  checkSponsoredAccess: jest.fn(),
}));

jest.mock('utilities/ai/aiScripts.js', () => ({
  analyzeUserOpinions: jest.fn(async () => ({
    summary: 'summary',
    details: 'details',
    name: 'name',
    historicalAlignment: {},
  })),
}));

const makeInstance = (props = {}) => {
  const instance = new UserPage({
    viewAddress: '0x00000000000000000000000000000000000000aa',
    network: { id: 84532 },
    isSurveyCacheReady: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    isSBTCacheReady: true,
    sbtCacheRevision: 0,
    questionResponsesNonce: 0,
    ...props,
  });

  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function'
      ? update(instance.state, instance.props)
      : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });

  return instance;
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

const collectTreeNodes = (node, predicate, acc = []) => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

const getNodeTypeName = (node) => {
  const type = node?.type;
  if (!type) return '';
  if (typeof type === 'string') return type;
  return String(type.displayName || type.name || '');
};

const treeHasText = (node, text) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

const normalizeChildrenArray = (value) => (
  Array.isArray(value) ? value : [value].filter(Boolean)
);

describe('UserPage cache refresh pipeline', () => {
  beforeEach(() => {
    checkSponsoredAccess.mockResolvedValue({
      status: 'unknown',
      gate: null,
      resourceKey: 'default',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    try { delete globalThis.CE_USER_PROFILE_DEEP_SCAN_LOADING; } catch (_) {}
    try { delete globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS; } catch (_) {}
    try { delete globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS; } catch (_) {}
    try { delete globalThis.CE_SESSION_SCAN_SCOPE; } catch (_) {}
    try { delete globalThis.CE_SESSION_SCAN_SLUGS; } catch (_) {}
    try { localStorage.removeItem('ce:sessionScanScope'); } catch (_) {}
    try { localStorage.removeItem('ce:sessionScanSlugs'); } catch (_) {}
  });

  it('aggregates survey/question/sbt sections in one refresh pass with one setState commit', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const surveyResponsePayload = JSON.stringify({
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'yes' },
        },
      ],
    });
    const questionResponsePayload = JSON.stringify({
      answer: { value: 'value' },
    });

    const dataByNamespace = {
      surveysCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            surveys: {
              s1: {
                id: 's1',
                title: 'Survey 1',
                creator: viewAddress,
                questionIDs: ['q1'],
                tags: ['governance', 'ai'],
                documentURLs: ['https://example.com/survey-1-doc'],
              },
            },
            surveyResponses: {
              s1: {
                [viewAddress]: surveyResponsePayload,
              },
            },
          },
        },
      }],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                prompt: 'Question 1',
                type: 'freeform',
                creator: viewAddress,
              },
            },
            questionResponses: {
              q1: {
                [viewAddress]: questionResponsePayload,
              },
            },
          },
        },
      }],
      sbtCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            sbtList: {
              '0x100': {
                sbtAddress: '0x100',
                sbtInfo: { name: 'Badge 100', unlisted: false },
                mintedAddresses: [viewAddress],
                burnedAddresses: [],
              },
            },
          },
        },
      }],
      userCache: [{
        slug: 'edge',
        data: {
          [viewLower]: {
            [networkID]: {
              lastBlockScanned: 120,
              data: {},
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.setState).toHaveBeenCalledTimes(1);
    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.surveyCreationInfo).toHaveLength(1);
    expect(instance.state.surveyResponseInfo[0].tags).toEqual(['governance', 'ai']);
    expect(instance.state.surveyResponseInfo[0].documentURLs).toEqual(['https://example.com/survey-1-doc']);
    expect(instance.state.surveyCreationInfo[0].tags).toEqual(['governance', 'ai']);
    expect(instance.state.surveyCreationInfo[0].documentURLs).toEqual(['https://example.com/survey-1-doc']);
    expect(instance.state.surveyCreationInfo[0].questionIDs).toEqual(['q1']);
    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.sbtList).toHaveLength(1);
    expect(instance.state.userStats.surveysResponded).toBe(1);
    expect(instance.state.userStats.surveysCreated).toBe(1);
    expect(instance.state.userStats.questionsResponded).toBe(1);
    expect(instance.state.userStats.questionsCreated).toBe(1);
    expect(instance.state.userStats.badgesReceived).toBe(1);
    expect(instance.state.loadingSurveys).toBe(false);
    expect(instance.state.loadingQuestions).toBe(false);
    expect(instance.state.loadingSBTs).toBe(false);
    expect(Array.isArray(instance.state.deepScanTooltipLines)).toBe(true);
    expect(instance.state.deepScanTooltipLines).toHaveLength(2);
    expect(instance.state.deepScanTooltipLines[0]).toMatch(/^Session: /);
    expect(instance.state.deepScanTooltipLines[0]).toMatch(/edge/i);
    expect(instance.state.deepScanTooltipLines[1]).toBe(`${(120).toLocaleString()} scanned`);
  });

  it('toggles created-survey expanded state per survey id', () => {
    const instance = makeInstance();

    expect(instance.state.expandedSurveysCreated).toEqual({});

    instance.toggleSurveyCreated('s1');
    expect(instance.state.expandedSurveysCreated).toEqual({ s1: true });

    instance.toggleSurveyCreated('s1');
    expect(instance.state.expandedSurveysCreated).toEqual({ s1: false });

    instance.toggleSurveyCreated('s2');
    expect(instance.state.expandedSurveysCreated).toEqual({
      s1: false,
      s2: true,
    });
  });

  it('coalesces multiple refresh requests into one queued flush per tick', () => {
    jest.useFakeTimers();
    const instance = makeInstance();
    instance._refreshAllDataFromCache = jest.fn();

    instance.queueCacheRefresh({ markLoading: false });
    instance.queueCacheRefresh({ markLoading: true });
    instance.queueCacheRefresh({ force: true });

    expect(instance._refreshAllDataFromCache).not.toHaveBeenCalled();
    jest.advanceTimersByTime(16);

    expect(instance._refreshAllDataFromCache).toHaveBeenCalledTimes(1);
    expect(instance._refreshAllDataFromCache).toHaveBeenCalledWith({ force: true, markLoading: true });
  });

  it('skips repeated refresh derives when cache input signatures are unchanged', () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      latestBlockNumber: 100,
    });
    instance._dgHasAny = jest.fn((namespace) => (
      namespace === 'questionsCache' || namespace === 'userCache'
    ));
    const aggregate = {
      userCaches: [],
      surveysById: {},
      surveyResponsesById: {},
      questionsById: {},
      questionResponsesById: {},
      sbtAggregate: {},
    };
    instance._collectUnifiedCacheData = jest.fn(() => aggregate);
    instance._deriveDeepScanProgressTooltipFromCaches = jest.fn(() => null);
    instance._deriveSurveySection = jest.fn(() => ({
      surveyResponseInfo: [],
      surveyCreationInfo: [],
      detailedSurveyResponses: {},
      surveysResponded: 0,
      surveysCreated: 0,
    }));
    instance._deriveQuestionSection = jest.fn(() => ({
      questionCreationInfo: [],
      questionResponseInfo: [],
      detailedQuestionResponses: {},
      questionsCreated: 0,
      questionsResponded: 0,
    }));
    instance._deriveSbtSection = jest.fn(() => ({
      sbtList: [],
      badgesReceived: 0,
    }));
    instance._queueResponseGateAccessChecks = jest.fn();
    instance.clearResponseGateRetryTimer = jest.fn();

    instance._refreshAllDataFromCache({ force: false, markLoading: false });
    instance._refreshAllDataFromCache({ force: false, markLoading: false });

    expect(instance._collectUnifiedCacheData).toHaveBeenCalledTimes(1);
    expect(instance._deriveSurveySection).toHaveBeenCalledTimes(1);
    expect(instance._deriveQuestionSection).toHaveBeenCalledTimes(1);
    expect(instance._deriveSbtSection).toHaveBeenCalledTimes(1);
    expect(instance.setState).toHaveBeenCalledTimes(1);
  });

  it('reuses memoized aggregate and section derives when bypassSignature is requested without input changes', () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      latestBlockNumber: 100,
    });
    instance._dgHasAny = jest.fn((namespace) => (
      namespace === 'questionsCache' || namespace === 'userCache'
    ));
    const aggregate = {
      userCaches: [],
      surveysById: {},
      surveyResponsesById: {},
      questionsById: {},
      questionResponsesById: {},
      sbtAggregate: {},
    };
    instance._collectUnifiedCacheData = jest.fn(() => aggregate);
    instance._deriveDeepScanProgressTooltipFromCaches = jest.fn(() => null);
    instance._deriveSurveySection = jest.fn(() => ({
      surveyResponseInfo: [],
      surveyCreationInfo: [],
      detailedSurveyResponses: {},
      surveysResponded: 0,
      surveysCreated: 0,
    }));
    instance._deriveQuestionSection = jest.fn(() => ({
      questionCreationInfo: [],
      questionResponseInfo: [],
      detailedQuestionResponses: {},
      questionsCreated: 0,
      questionsResponded: 0,
    }));
    instance._deriveSbtSection = jest.fn(() => ({
      sbtList: [],
      badgesReceived: 0,
    }));
    instance._queueResponseGateAccessChecks = jest.fn();
    instance.clearResponseGateRetryTimer = jest.fn();

    instance._refreshAllDataFromCache({ force: false, markLoading: false });
    instance._refreshAllDataFromCache({ force: false, markLoading: false, bypassSignature: true });

    expect(instance._collectUnifiedCacheData).toHaveBeenCalledTimes(1);
    expect(instance._deriveSurveySection).toHaveBeenCalledTimes(1);
    expect(instance._deriveQuestionSection).toHaveBeenCalledTimes(1);
    expect(instance._deriveSbtSection).toHaveBeenCalledTimes(1);
  });

  it('invalidates memoized aggregates when managed cache updates arrive without prop revisions', () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      latestBlockNumber: 100,
    });
    instance._dgHasAny = jest.fn((namespace) => (
      namespace === 'questionsCache' || namespace === 'userCache'
    ));
    const aggregate = {
      userCaches: [],
      surveysById: {},
      surveyResponsesById: {},
      questionsById: {},
      questionResponsesById: {},
      sbtAggregate: {},
    };
    instance._collectUnifiedCacheData = jest.fn(() => aggregate);
    instance._deriveSurveySection = jest.fn(() => ({
      surveyResponseInfo: [],
      surveyCreationInfo: [],
      detailedSurveyResponses: {},
      surveysResponded: 0,
      surveysCreated: 0,
    }));
    instance._deriveQuestionSection = jest.fn(() => ({
      questionCreationInfo: [],
      questionResponseInfo: [],
      detailedQuestionResponses: {},
      questionsCreated: 0,
      questionsResponded: 0,
    }));
    instance._deriveSbtSection = jest.fn(() => ({
      sbtList: [],
      badgesReceived: 0,
    }));
    instance._queueResponseGateAccessChecks = jest.fn();
    instance.clearResponseGateRetryTimer = jest.fn();
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});

    instance._refreshAllDataFromCache({ force: false, markLoading: false });
    instance.handleManagedCacheUpdate({ namespace: 'userCache', slug: 'other-session', source: 'remote' });

    expect(instance._unifiedCacheAggregateMemo).toBe(null);
    expect(instance._sectionDeriveMemo).toEqual({
      survey: null,
      question: null,
      sbt: null,
    });
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false, bypassSignature: true });
  });

  it('does not trigger heavy cache recompute on block-number-only changes', () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      latestBlockNumber: 100,
    });
    instance._dgHasAny = jest.fn((namespace) => (
      namespace === 'questionsCache' || namespace === 'userCache'
    ));
    const aggregate = {
      userCaches: [],
      surveysById: {},
      surveyResponsesById: {},
      questionsById: {},
      questionResponsesById: {},
      sbtAggregate: {},
    };
    instance._collectUnifiedCacheData = jest.fn(() => aggregate);
    instance._deriveDeepScanProgressTooltipFromCaches = jest.fn(() => null);
    instance._deriveSurveySection = jest.fn(() => ({
      surveyResponseInfo: [],
      surveyCreationInfo: [],
      detailedSurveyResponses: {},
      surveysResponded: 0,
      surveysCreated: 0,
    }));
    instance._deriveQuestionSection = jest.fn(() => ({
      questionCreationInfo: [],
      questionResponseInfo: [],
      detailedQuestionResponses: {},
      questionsCreated: 0,
      questionsResponded: 0,
    }));
    instance._deriveSbtSection = jest.fn(() => ({
      sbtList: [],
      badgesReceived: 0,
    }));
    instance._queueResponseGateAccessChecks = jest.fn();
    instance.clearResponseGateRetryTimer = jest.fn();

    instance._refreshAllDataFromCache({ force: false, markLoading: false });
    instance.props = { ...instance.props, latestBlockNumber: 101 };
    instance._refreshAllDataFromCache({ force: false, markLoading: false });

    expect(instance._collectUnifiedCacheData).toHaveBeenCalledTimes(1);
    expect(instance._deriveSurveySection).toHaveBeenCalledTimes(1);
    expect(instance._deriveQuestionSection).toHaveBeenCalledTimes(1);
    expect(instance._deriveSbtSection).toHaveBeenCalledTimes(1);
    expect(instance.setState).toHaveBeenCalledTimes(1);
  });

  it('invalidates memoized aggregates and reruns derives when response nonce changes', () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      latestBlockNumber: 100,
      questionResponsesNonce: 0,
    });
    instance._dgHasAny = jest.fn((namespace) => (
      namespace === 'questionsCache' || namespace === 'userCache'
    ));
    const aggregate = {
      userCaches: [],
      surveysById: {},
      surveyResponsesById: {},
      questionsById: {},
      questionResponsesById: {},
      sbtAggregate: {},
    };
    instance._collectUnifiedCacheData = jest.fn(() => aggregate);
    instance._deriveDeepScanProgressTooltipFromCaches = jest.fn(() => null);
    instance._deriveSurveySection = jest.fn(() => ({
      surveyResponseInfo: [],
      surveyCreationInfo: [],
      detailedSurveyResponses: {},
      surveysResponded: 0,
      surveysCreated: 0,
    }));
    instance._deriveQuestionSection = jest.fn(() => ({
      questionCreationInfo: [],
      questionResponseInfo: [],
      detailedQuestionResponses: {},
      questionsCreated: 0,
      questionsResponded: 0,
    }));
    instance._deriveSbtSection = jest.fn(() => ({
      sbtList: [],
      badgesReceived: 0,
    }));
    instance._queueResponseGateAccessChecks = jest.fn();
    instance.clearResponseGateRetryTimer = jest.fn();

    instance._refreshAllDataFromCache({ force: false, markLoading: false });
    instance.props = { ...instance.props, questionResponsesNonce: 1 };
    instance._refreshAllDataFromCache({ force: false, markLoading: false });

    expect(instance._collectUnifiedCacheData).toHaveBeenCalledTimes(2);
    expect(instance._deriveSurveySection).toHaveBeenCalledTimes(2);
    expect(instance._deriveQuestionSection).toHaveBeenCalledTimes(2);
  });

  it('invalidates memoized SBT derives on sbt cache revision changes without rerunning question/survey derives', () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      latestBlockNumber: 100,
      sbtCacheRevision: 0,
    });
    instance._dgHasAny = jest.fn((namespace) => (
      namespace === 'questionsCache' || namespace === 'sbtCache' || namespace === 'userCache'
    ));
    const aggregate = {
      userCaches: [],
      surveysById: {},
      surveyResponsesById: {},
      questionsById: {},
      questionResponsesById: {},
      sbtAggregate: {},
    };
    instance._collectUnifiedCacheData = jest.fn(() => aggregate);
    instance._deriveDeepScanProgressTooltipFromCaches = jest.fn(() => null);
    instance._deriveSurveySection = jest.fn(() => ({
      surveyResponseInfo: [],
      surveyCreationInfo: [],
      detailedSurveyResponses: {},
      surveysResponded: 0,
      surveysCreated: 0,
    }));
    instance._deriveQuestionSection = jest.fn(() => ({
      questionCreationInfo: [],
      questionResponseInfo: [],
      detailedQuestionResponses: {},
      questionsCreated: 0,
      questionsResponded: 0,
    }));
    instance._deriveSbtSection = jest.fn(() => ({
      sbtList: [],
      badgesReceived: 0,
    }));
    instance._queueResponseGateAccessChecks = jest.fn();
    instance.clearResponseGateRetryTimer = jest.fn();

    instance._refreshAllDataFromCache({ force: false, markLoading: false });
    instance.props = { ...instance.props, sbtCacheRevision: 1 };
    instance._refreshAllDataFromCache({ force: false, markLoading: false });

    expect(instance._collectUnifiedCacheData).toHaveBeenCalledTimes(2);
    expect(instance._deriveSurveySection).toHaveBeenCalledTimes(1);
    expect(instance._deriveQuestionSection).toHaveBeenCalledTimes(1);
    expect(instance._deriveSbtSection).toHaveBeenCalledTimes(2);
  });

  it('preserves gate uncertainty checks when question section derives are memoized', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({
      viewAddress,
      account: '0x00000000000000000000000000000000000000bb',
    });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                prompt: 'Encrypted Question',
                type: 'freeform',
                promptEncrypted: true,
              },
            },
            questionResponses: {
              q1: {
                [viewAddress.toLowerCase()]: JSON.stringify({
                  answer: { value: '*' },
                }),
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);
    const queueGateChecksSpy = jest.spyOn(instance, '_queueResponseGateAccessChecks');
    const deriveQuestionSpy = jest.spyOn(instance, '_deriveQuestionSection');

    instance._refreshAllDataFromCache({ force: true, markLoading: true });
    expect(deriveQuestionSpy).toHaveBeenCalledTimes(1);
    expect(instance.state.hasUncertainGateAccess).toBe(true);
    expect(instance.state.loadingQuestions).toBe(true);
    expect(queueGateChecksSpy).toHaveBeenCalledTimes(1);

    queueGateChecksSpy.mockClear();
    instance._refreshAllDataFromCache({ force: false, markLoading: false, bypassSignature: true });

    expect(deriveQuestionSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(instance.state.hasUncertainGateAccess).toBe(true);
    expect(instance.state.loadingQuestions).toBe(true);
    expect(queueGateChecksSpy).toHaveBeenCalledTimes(1);
    const pendingSet = queueGateChecksSpy.mock.calls[0][0];
    expect(Array.from(pendingSet)).toContain('edge::questionResponses');
  });

  it('does not force the initial cache refresh in loadDataFromCache', () => {
    const instance = makeInstance();
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});

    instance.loadDataFromCache();

    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: true });
  });

  it('selects an AI-open session for analyze when active-session AI gate is denied', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: 'active-slug',
    });
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'summary',
      details: 'details',
      name: 'name',
      historicalAlignment: {},
    });
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['active-slug', 'open-slug']);
    jest.spyOn(instance, '_getSessionConfigForSlugExact').mockImplementation((slug) => ({ slug }));
    checkSponsoredAccess.mockImplementation(async ({ sessionSlug }) => (
      sessionSlug === 'open-slug'
        ? { status: 'no-gate', gate: null, resourceKey: 'ai' }
        : { status: 'denied', gate: { type: 'sbt' }, resourceKey: 'ai' }
    ));

    await instance.analyzeUser();

    expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
    expect(analyzeUserOpinions).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: 'open-slug',
        sessionConfig: expect.objectContaining({ slug: 'open-slug' }),
      })
    );
  });

  it('prefers in-scope open-gate session over stale cache slugs for analyze routing', async () => {
    const inScopeSlug = 'in-scope-open-session';
    const secondaryScopeSlug = 'in-scope-secondary-session';
    const staleCacheSlug = 'stale-cache-session';

    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = [
      inScopeSlug,
      secondaryScopeSlug,
    ];
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: inScopeSlug,
    });
    jest.spyOn(cacheScripts, 'listNamespaceSlugsSync').mockImplementation((namespace) => (
      namespace === 'userCache'
        ? [staleCacheSlug, inScopeSlug]
        : []
    ));
    jest.spyOn(instance, '_getSessionConfigForSlugExact').mockImplementation((slug) => ({ slug }));
    checkSponsoredAccess.mockResolvedValue({
      status: 'no-gate',
      gate: null,
      resourceKey: 'ai',
    });

    await instance.analyzeUser();

    expect(analyzeUserOpinions).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: inScopeSlug,
        sessionConfig: expect.objectContaining({ slug: inScopeSlug }),
        sessionSelection: expect.objectContaining({
          gateStatus: 'no-gate',
          reason: 'open-ai-gate',
        }),
      })
    );
  });

  it('keeps the active session candidate even when strict list scope excludes it', () => {
    const inScopeSlug = 'in-scope-open-session';
    const outOfScopeActiveSlug = 'active-out-of-scope-session';
    const staleCacheSlug = 'stale-cache-session';

    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = [inScopeSlug];
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: outOfScopeActiveSlug,
    });
    jest.spyOn(cacheScripts, 'listNamespaceSlugsSync').mockImplementation((namespace) => (
      namespace === 'userCache'
        ? [staleCacheSlug]
        : []
    ));

    const candidates = instance._getAiSessionSlugCandidates();

    expect(candidates).toEqual([
      outOfScopeActiveSlug,
      inScopeSlug,
    ]);
  });

  it('uses the active primary session for single-session behavior while preserving the full list scope for deep-scan ordering', () => {
    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = ['', 'edge'];
    const instance = makeInstance({
      activeSessionSlug: 'primary-session',
    });

    expect(instance.getBookmarksSlug()).toBe('primary-session');
    expect(instance._getDeepScanPrioritySlugs()).toEqual(['primary-session', '', 'edge']);
  });

  it('does not route analyze calls through default worker fallback when no exact session config resolves', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: 'missing-session-slug',
    });
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['missing-session-slug']);
    jest.spyOn(instance, '_getSessionConfigForSlugExact').mockReturnValue(null);

    await instance.analyzeUser();

    expect(analyzeUserOpinions).not.toHaveBeenCalled();
    expect(instance.state.analyzing).toBe(false);
    expect(instance.state.analysisError).toContain('Unable to generate analysis');
  });

  it('does not treat demo-only slugs as valid analyze-session configs', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: 'rxc',
    });
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['rxc']);
    const exactSpy = jest.spyOn(instance, '_getSessionConfigForSlugExact');
    const demoSpy = jest
      .spyOn(contractScriptsModule, 'getDemoSessionConfigBySlug')
      .mockReturnValue({
        slug: 'rxc',
        sessionName: 'Weyl v. Yarvin Debate',
      });

    try {
      const session = await instance.resolveAnalysisSessionContext();

      expect(session).toBeNull();
      expect(checkSponsoredAccess).not.toHaveBeenCalled();
      expect(analyzeUserOpinions).not.toHaveBeenCalled();
      expect(demoSpy).not.toHaveBeenCalled();
      expect(exactSpy).toHaveBeenCalledWith('rxc');
      expect(instance._getSessionConfigForSlugExact('rxc')).toBeNull();
    } finally {
      exactSpy.mockRestore();
      demoSpy.mockRestore();
    }
  });

  it('does not treat demo-only alias session keys as valid analyze-session configs', () => {
    const instance = makeInstance();
    const aliasConfig = instance._getSessionConfigForSlugExact('legacyEdge');

    expect(aliasConfig).toBeNull();
  });

  it('does not treat unknown non-general slugs as valid analyze-session configs', () => {
    const instance = makeInstance();
    const unresolved = instance._getSessionConfigForSlugExact('slug-that-does-not-exist-xyz');

    expect(unresolved).toBeNull();
  });

  it('preserves explicit general analyze-session configs when an authoritative empty-slug config exists', () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({
      sessions: {
        '': {
          slug: '',
          sessionName: 'Registry General',
        },
      },
    }));

    try {
      const instance = makeInstance();
      const general = instance._getSessionConfigForSlugExact('');

      expect(general).toEqual(expect.objectContaining({
        slug: '',
        sessionName: 'Registry General',
      }));
    } finally {
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });

  it('checks namespace presence through hasNamespaceEntriesSync helper', () => {
    const instance = makeInstance();
    const hasSpy = jest
      .spyOn(cacheScripts, 'hasNamespaceEntriesSync')
      .mockReturnValue(true);

    const result = instance._dgHasAny('questionsCache');

    expect(result).toBe(true);
    expect(hasSpy).toHaveBeenCalledWith('questionsCache');
  });

  it('checks each cache namespace presence once per refresh pass', () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      latestBlockNumber: 100,
    });
    instance._dgHasAny = jest.fn(() => true);
    const aggregate = {
      userCaches: [],
      surveysById: {},
      surveyResponsesById: {},
      questionsById: {},
      questionResponsesById: {},
      sbtAggregate: {},
    };
    instance._collectUnifiedCacheData = jest.fn(() => aggregate);
    instance._deriveDeepScanProgressTooltipFromCaches = jest.fn(() => null);
    instance._deriveSurveySection = jest.fn(() => ({
      surveyResponseInfo: [],
      surveyCreationInfo: [],
      detailedSurveyResponses: {},
      surveysResponded: 0,
      surveysCreated: 0,
    }));
    instance._deriveQuestionSection = jest.fn(() => ({
      questionCreationInfo: [],
      questionResponseInfo: [],
      detailedQuestionResponses: {},
      questionsCreated: 0,
      questionsResponded: 0,
    }));
    instance._deriveSbtSection = jest.fn(() => ({
      sbtList: [],
      badgesReceived: 0,
    }));
    instance._queueResponseGateAccessChecks = jest.fn();
    instance.clearResponseGateRetryTimer = jest.fn();

    instance._refreshAllDataFromCache({ force: true, markLoading: false });

    expect(instance._dgHasAny).toHaveBeenCalledTimes(4);
    expect(instance._dgHasAny.mock.calls.map(([name]) => name)).toEqual([
      'surveysCache',
      'questionsCache',
      'sbtCache',
      'userCache',
    ]);
  });

  it('reads bookmarks cache with clone:false and returns detached arrays', () => {
    const instance = makeInstance();
    instance.getBookmarksSlug = jest.fn(() => 'edge');
    const source = {
      surveys: ['s1'],
      questions: ['q1'],
      users: [{ address: '0x1' }],
      filters: ['f1'],
    };
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(source);

    const result = instance.getBookmarksCache();
    result.surveys.push('s2');
    result.questions.push('q2');
    result.users.push({ address: '0x2' });
    result.filters.push('f2');

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(source).toEqual({
      surveys: ['s1'],
      questions: ['q1'],
      users: [{ address: '0x1' }],
      filters: ['f1'],
    });
  });

  it('reuses parsed response payloads across refreshes when payload strings are unchanged', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });
    const surveyResponsePayload = JSON.stringify({
      responses: [{ questionID: 'q1', answer: { value: 'yes' } }],
    });
    const questionResponsePayload = JSON.stringify({
      answer: { value: 'value' },
    });

    const dataByNamespace = {
      surveysCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            surveys: {
              s1: { id: 's1', title: 'Survey 1', creator: viewAddress, questionIDs: ['q1'] },
            },
            surveyResponses: {
              s1: {
                [viewAddress]: surveyResponsePayload,
              },
            },
          },
        },
      }],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: { id: 'q1', prompt: 'Question 1', type: 'freeform', creator: viewAddress },
            },
            questionResponses: {
              q1: {
                [viewAddress]: questionResponsePayload,
              },
            },
          },
        },
      }],
      sbtCache: [],
      userCache: [{
        slug: 'edge',
        data: {
          [viewLower]: {
            [networkID]: {
              lastBlockScanned: 120,
              data: {},
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    const parseSpy = jest.spyOn(JSON, 'parse');
    instance._refreshAllDataFromCache({ force: true, markLoading: true });
    instance._refreshAllDataFromCache({ force: true, markLoading: true });
    const targetedParseCalls = parseSpy.mock.calls
      .map(([value]) => value)
      .filter((value) => value === surveyResponsePayload || value === questionResponsePayload);
    expect(targetedParseCalls).toHaveLength(2);
    parseSpy.mockRestore();
  });

  it('skips bookmark state writes when computed bookmark values are unchanged', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      bookmarked: false,
      nicknameInput: 'keep-me',
    };
    instance.getBookmarksCache = jest.fn(() => ({
      surveys: [],
      questions: [],
      users: [],
      filters: [],
    }));
    instance.setState.mockClear();

    instance.checkIfBookmarked();

    expect(instance.setState).not.toHaveBeenCalled();
  });

  it('updates bookmark state when computed bookmark or nickname values change', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      bookmarked: false,
      nicknameInput: '',
    };
    instance.getBookmarksCache = jest.fn(() => ({
      surveys: [],
      questions: [],
      users: [{ address: viewAddress, nickname: 'Alice' }],
      filters: [],
    }));
    instance.setState.mockClear();

    instance.checkIfBookmarked();

    expect(instance.setState).toHaveBeenCalledTimes(1);
    expect(instance.setState.mock.calls[0][0]).toEqual({
      bookmarked: true,
      nicknameInput: 'Alice',
    });
  });

  it('clears nickname edit state when removing a bookmarked user', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      bookmarked: true,
      nicknameInput: 'Alice',
      isEditingNickname: true,
    };
    instance.getBookmarksCache = jest.fn(() => ({
      surveys: [],
      questions: [],
      users: [{ address: viewAddress.toLowerCase(), nickname: 'Alice' }],
      filters: [],
    }));
    instance.persistBookmarksCache = jest.fn();

    instance.toggleBookmark();

    expect(instance.persistBookmarksCache).toHaveBeenCalledWith({
      surveys: [],
      questions: [],
      users: [],
      filters: [],
    }, 'toggleBookmark');
    expect(instance.state.bookmarked).toBe(false);
    expect(instance.state.isEditingNickname).toBe(false);
    expect(instance.state.nicknameInput).toBe('');
  });

  it('queues cache refresh when sbt revision and response nonce change together', () => {
    const instance = makeInstance({ sbtCacheRevision: 2, questionResponsesNonce: 3 });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});

    const prevProps = {
      ...instance.props,
      sbtCacheRevision: 1,
      questionResponsesNonce: 2,
    };
    const prevState = {
      ...instance.state,
      isDeepScanning: false,
    };

    instance.componentDidUpdate(prevProps, prevState);

    // Nonce fast-path (non-own-profile: no force) + sbt path
    expect(queueSpy).toHaveBeenCalledTimes(2);
    expect(queueSpy).toHaveBeenNthCalledWith(1, { markLoading: false });
    expect(queueSpy).toHaveBeenNthCalledWith(2, { markLoading: false });
  });

  it('forces cache refresh bypass on nonce change for own profile', () => {
    const addr = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress: addr, account: addr, questionResponsesNonce: 5 });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});

    const prevProps = { ...instance.props, questionResponsesNonce: 4 };
    const prevState = { ...instance.state, isDeepScanning: false };

    instance.componentDidUpdate(prevProps, prevState);

    expect(queueSpy).toHaveBeenCalledWith({ force: true, markLoading: false, bypassSignature: true });
  });

  it('revalidates stale terminal gate access statuses after TTL', async () => {
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const cacheKey = instance._buildGateAccessCacheKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    instance._responseGateAccessStatusByKey.set(cacheKey, {
      status: 'granted',
      ts: Date.now() - (61 * 1000),
    });
    checkSponsoredAccess.mockResolvedValue({
      status: 'denied',
      gate: null,
      resourceKey: 'questionResponses',
    });

    instance._queueResponseGateAccessChecks(
      new Set([instance._buildGatePendingKey({ slug: 'edge', resourceKey: 'questionResponses' })])
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(checkSponsoredAccess).toHaveBeenCalledTimes(1);
    expect(instance._responseGateAccessStatusByKey.get(cacheKey)?.status).toBe('denied');
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false });
  });

  it('retries gate access when sponsored access resolves with an error status', async () => {
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const retrySpy = jest.spyOn(instance, 'scheduleResponseGateRetry').mockImplementation(() => {});
    const cacheKey = instance._buildGateAccessCacheKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    checkSponsoredAccess.mockResolvedValue({
      status: 'error',
      gate: null,
      resourceKey: 'questionResponses',
    });

    instance._queueResponseGateAccessChecks(
      new Set([instance._buildGatePendingKey({ slug: 'edge', resourceKey: 'questionResponses' })])
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(checkSponsoredAccess).toHaveBeenCalledTimes(1);
    expect(instance._responseGateAccessStatusByKey.get(cacheKey)?.status).toBe('error');
    expect(retrySpy).toHaveBeenCalledWith(30000);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false });
  });

  it('keeps response-gate access checks strict when only a demo-session config exists', async () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.removeItem(REGISTRY_CACHE_KEY);

    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const demoSpy = jest
      .spyOn(contractScriptsModule, 'getDemoSessionConfigBySlug')
      .mockReturnValue({
        slug: 'rxc',
        sessionName: 'Weyl v. Yarvin Debate',
        sponsoredKeys: {
          questionResponses: { encrypted: true },
        },
      });
    const cacheKey = instance._buildGateAccessCacheKey({
      slug: 'rxc',
      resourceKey: 'questionResponses',
    });
    checkSponsoredAccess.mockResolvedValue({
      status: 'denied',
      gate: null,
      resourceKey: 'questionResponses',
    });

    try {
      instance._queueResponseGateAccessChecks(
        new Set([instance._buildGatePendingKey({ slug: 'rxc', resourceKey: 'questionResponses' })])
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(checkSponsoredAccess).toHaveBeenCalledTimes(1);
      expect(checkSponsoredAccess).toHaveBeenCalledWith(expect.objectContaining({
        sessionSlug: 'rxc',
        account,
        resourceKey: 'questionResponses',
        sessionConfig: {},
      }));
      expect(instance._responseGateAccessStatusByKey.get(cacheKey)?.status).toBe('denied');
      expect(queueSpy).toHaveBeenCalledWith({ markLoading: false });
      expect(demoSpy).not.toHaveBeenCalled();
    } finally {
      demoSpy.mockRestore();
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });

  it('ignores stale gate access promises after a reset', async () => {
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const deferred = createDeferred();
    checkSponsoredAccess.mockImplementation(() => deferred.promise);
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const retrySpy = jest.spyOn(instance, 'scheduleResponseGateRetry').mockImplementation(() => {});
    const pendingKey = instance._buildGatePendingKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });

    instance._queueResponseGateAccessChecks(new Set([pendingKey]));
    instance._resetResponseGateAccess();
    deferred.resolve({
      status: 'unknown',
      gate: null,
      resourceKey: 'questionResponses',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(instance._responseGateAccessStatusByKey.size).toBe(0);
    expect(queueSpy).not.toHaveBeenCalled();
    expect(retrySpy).not.toHaveBeenCalled();
  });

  it('schedules a delayed refresh when unknown gate access is still within retry TTL', () => {
    jest.useFakeTimers();
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const pendingKey = instance._buildGatePendingKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    const cacheKey = instance._buildGateAccessCacheKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });

    instance._responseGateAccessStatusByKey.set(cacheKey, {
      status: 'unknown',
      ts: Date.now() - 5000,
    });

    instance._queueResponseGateAccessChecks(new Set([pendingKey]));

    expect(checkSponsoredAccess).not.toHaveBeenCalled();
    expect(queueSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(25000);
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false, bypassSignature: true });
  });

  it('schedules a delayed refresh when error gate access is still within retry TTL', () => {
    jest.useFakeTimers();
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const pendingKey = instance._buildGatePendingKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    const cacheKey = instance._buildGateAccessCacheKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });

    instance._responseGateAccessStatusByKey.set(cacheKey, {
      status: 'error',
      ts: Date.now() - 5000,
    });

    instance._queueResponseGateAccessChecks(new Set([pendingKey]));

    expect(checkSponsoredAccess).not.toHaveBeenCalled();
    expect(queueSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(25000);
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false, bypassSignature: true });
  });

  it('backs off cached unresolved gate access instead of re-queueing an immediate refresh', () => {
    jest.useFakeTimers();
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const pendingKey = instance._buildGatePendingKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    const cacheKey = instance._buildGateAccessCacheKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });

    instance._responseGateAccessStatusByKey.set(cacheKey, {
      status: 'unresolved',
      ts: Date.now() - 5000,
    });

    instance._queueResponseGateAccessChecks(new Set([pendingKey]));

    expect(checkSponsoredAccess).not.toHaveBeenCalled();
    expect(queueSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(25000);
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false, bypassSignature: true });
  });

  it('keeps loading state when data remains uncertain and no cache sources are available', () => {
    const instance = makeInstance();
    instance.state.hasUncertainUserData = true;

    instance._dgHasAny = jest.fn(() => false);
    instance._dgReadAll = jest.fn(() => []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.loadingSurveys).toBe(true);
    expect(instance.state.loadingQuestions).toBe(true);
    expect(instance.state.loadingSBTs).toBe(true);
  });

  it('treats deep-scan reports with coverage gaps as uncertain user data', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({ hadRpcErrors: true, coverageComplete: false });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(true);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('does not mark sbt data uncertain for activity-only deep-scan failures', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      hadRpcErrors: true,
      attemptedSlugs: ['test-10'],
      scannedSlugs: [],
      failedSlugs: [],
      failedActivitySlugs: ['test-10'],
      skippedSlugs: [],
      coverageComplete: false,
      coverageReason: 'activity-failure-all-slugs',
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('does not mark user data uncertain for partial rpc errors when scan still completed', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      hadRpcErrors: true,
      attemptedSlugs: ['edge'],
      scannedSlugs: ['edge'],
      failedSlugs: [],
      failedActivitySlugs: [],
      skippedSlugs: [],
      coverageComplete: true,
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(false);
    expect(instance.state.hasUncertainSbtData).toBe(false);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('marks user data uncertain for partial activity rpc failures even when scan reports coverage complete', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      hadRpcErrors: true,
      attemptedSlugs: ['edge', 'other'],
      scannedSlugs: ['edge'],
      failedSlugs: [],
      failedActivitySlugs: ['other'],
      skippedSlugs: [],
      coverageComplete: true,
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('marks sbt data uncertain for partial sbt rpc failures even when scan reports coverage complete', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      hadRpcErrors: true,
      attemptedSlugs: ['edge', 'other'],
      scannedSlugs: ['edge'],
      failedSlugs: ['other'],
      failedActivitySlugs: [],
      skippedSlugs: [],
      coverageComplete: true,
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(true);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('treats deep-scan reports with all attempted slugs skipped as uncertain user data', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      hadRpcErrors: false,
      attemptedSlugs: ['edge', 'dacc'],
      scannedSlugs: [],
      skippedSlugs: ['edge', 'dacc'],
      failedActivitySlugs: [],
      coverageComplete: true,
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(true);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('clears user-data uncertainty after a successful follow-up deep-scan report resolves prior list-scope skips', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      attemptedSlugs: ['test-10'],
      scannedSlugs: [],
      skippedSlugs: ['test-10'],
      coverageComplete: false,
      coverageReason: 'list-scope-chain-id-unresolved',
    });
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(true);

    instance.applyDeepScanReport({
      attemptedSlugs: ['test-10'],
      scannedSlugs: ['test-10'],
      skippedSlugs: [],
      failedSlugs: [],
      failedActivitySlugs: [],
      coverageComplete: true,
      coverageReason: 'scoped',
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(false);
    expect(instance.state.hasUncertainSbtData).toBe(false);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(2);
  });

  it('applies background retry scan reports for the active profile address', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      isDeepScanning: false,
      hasUncertainUserData: true,
    };
    instance.loadDataFromCache = jest.fn();

    instance.handleBackgroundProfileScanReport({
      detail: {
        source: 'registry-retry',
        scanReport: {
          targetAddress: viewAddress.toLowerCase(),
          hadRpcErrors: false,
          scannedSlugs: ['edge'],
          failedSlugs: [],
        },
      },
    });

    expect(instance.state.hasUncertainUserData).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('applies background retry reports when only activity failure state changes', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      isDeepScanning: false,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.handleBackgroundProfileScanReport({
      detail: {
        source: 'registry-retry',
        scanReport: {
          targetAddress: viewAddress.toLowerCase(),
          hadRpcErrors: true,
          attemptedSlugs: ['edge'],
          scannedSlugs: ['edge'],
          skippedSlugs: [],
          failedSlugs: [],
          failedActivitySlugs: [],
          coverageComplete: true,
          coverageReason: 'registry-ready',
        },
      },
    });

    expect(instance.state.hasUncertainUserData).toBe(false);
    expect(instance.state.hasUncertainSbtData).toBe(false);

    instance.handleBackgroundProfileScanReport({
      detail: {
        source: 'registry-retry',
        scanReport: {
          targetAddress: viewAddress.toLowerCase(),
          hadRpcErrors: true,
          attemptedSlugs: ['edge'],
          scannedSlugs: ['edge'],
          skippedSlugs: [],
          failedSlugs: [],
          failedActivitySlugs: ['edge'],
          coverageComplete: true,
          coverageReason: 'registry-ready',
        },
      },
    });

    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(2);
  });

  it('ignores late deep-scan completions for a stale profile target', async () => {
    const firstAddress = '0x00000000000000000000000000000000000000aa';
    const secondAddress = '0x00000000000000000000000000000000000000bb';
    const firstScan = createDeferred();
    const secondScan = createDeferred();
    const scanSpecificUserProfile = jest.fn((address) => (
      String(address || '').toLowerCase() === firstAddress.toLowerCase()
        ? firstScan.promise
        : secondScan.promise
    ));
    const instance = makeInstance({ viewAddress: firstAddress, scanSpecificUserProfile });
    instance.loadDataFromCache = jest.fn();

    instance.startProfileDeepScan('mount');
    instance.props = { ...instance.props, viewAddress: secondAddress };
    instance.startProfileDeepScan('update');

    firstScan.resolve({
      targetAddress: firstAddress,
      hadRpcErrors: false,
      scannedSlugs: ['edge'],
      failedSlugs: [],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(instance.state.isDeepScanning).toBe(true);
    expect(instance.loadDataFromCache).not.toHaveBeenCalled();

    secondScan.resolve({
      targetAddress: secondAddress,
      hadRpcErrors: false,
      scannedSlugs: ['edge'],
      failedSlugs: [],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('ignores background retry reports for non-active profile addresses', () => {
    const instance = makeInstance({
      viewAddress: '0x00000000000000000000000000000000000000aa',
    });
    const applySpy = jest.spyOn(instance, 'applyDeepScanReport');

    instance.handleBackgroundProfileScanReport({
      detail: {
        source: 'registry-retry',
        scanReport: {
          targetAddress: '0x00000000000000000000000000000000000000bb',
          hadRpcErrors: false,
          scannedSlugs: ['edge'],
          failedSlugs: [],
        },
      },
    });

    expect(applySpy).not.toHaveBeenCalled();
  });

  it('settles question-response loading after deep scan uncertainty when question sources exist', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });
    instance.state.hasUncertainUserData = true;
    const retrySpy = jest.spyOn(instance, 'scheduleResponseGateRetry').mockImplementation(() => {});

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                creator: viewAddress,
                prompt: 'Question 1',
                type: 'freeform',
              },
            },
            questionResponses: {},
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo).toHaveLength(0);
    expect(instance.state.loadingQuestions).toBe(false);
    expect(retrySpy).toHaveBeenCalledWith(30000);
  });

  it('injects creator into createdQuestions sourced from userCache', () => {
    const viewAddress = '0x00000000000000000000000000000000000000bb';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      questionsCache: [],
      userCache: [{
        slug: 'edge',
        data: {
          [viewAddress.toLowerCase()]: {
            [networkID]: {
              data: {
                createdQuestions: [{
                  id: 'q-cache-only',
                  data: {
                    id: 'q-cache-only',
                    prompt: 'Who goes there?',
                    type: 'freeform',
                  },
                }],
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.questionCreationInfo[0].prompt).toBe('Who goes there?');
  });

  it('shows question responses even when question metadata has not been cached yet', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [{
        slug: 'edge',
        data: {
          [viewAddress.toLowerCase()]: {
            [networkID]: {
              lastBlockScanned: 120,
              data: {
                createdSurveys: [],
                createdQuestions: [],
                surveyResponses: [],
                questionResponses: [
                  {
                    questionId: 'q-missing',
                    responder: viewAddress.toLowerCase(),
                    response: JSON.stringify({ answer: { value: 'visible response' } }),
                  },
                ],
              },
            },
          },
        },
      }],
      questionsCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].id).toBe('q-missing');
    expect(instance.state.questionResponseInfo[0].prompt).toBe('Unknown Prompt');
  });

  it('shows survey responses with fallback metadata when survey metadata is not cached yet', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      questionsCache: [],
      userCache: [{
        slug: 'edge',
        data: {
          [viewLower]: {
            [networkID]: {
              lastBlockScanned: 120,
              data: {
                createdSurveys: [],
                createdQuestions: [],
                questionResponses: [],
                surveyResponses: [
                  {
                    surveyId: 's-missing',
                    responder: viewLower,
                    response: JSON.stringify({
                      responses: [
                        { questionID: 'q1', answer: { value: 'visible response' } },
                      ],
                    }),
                  },
                ],
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.surveyResponseInfo[0].id).toBe('s-missing');
    expect(instance.state.surveyResponseInfo[0].title).toBe('Untitled Survey');
    expect(instance.state.surveyResponseInfo[0].questionsCount).toBe(1);
  });

  it('prefers questionsCache responder payload over stale userCache fallback values', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                prompt: 'Question 1',
                type: 'freeform',
              },
            },
            questionResponses: {
              q1: {
                [viewAddress.toLowerCase()]: JSON.stringify({ answer: { value: 'fresh cache value' } }),
              },
            },
          },
        },
      }],
      userCache: [{
        slug: 'edge',
        data: {
          [viewAddress.toLowerCase()]: {
            [networkID]: {
              lastBlockScanned: 120,
              data: {
                createdSurveys: [],
                createdQuestions: [],
                surveyResponses: [],
                questionResponses: [
                  {
                    questionId: 'q1',
                    responder: viewAddress.toLowerCase(),
                    response: JSON.stringify({ answer: { value: '' } }),
                  },
                ],
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.detailedQuestionResponses.q1.answer.value).toBe('fresh cache value');
  });

  it('prefers fresher survey responses from userCache over stale surveysCache payloads', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [{
        slug: 'stale',
        data: {
          [networkID]: {
            surveys: {
              s1: {
                id: 's1',
                title: 'Survey 1',
                creator: viewAddress,
                questionIDs: ['q1'],
              },
            },
            surveyResponses: {
              s1: {
                [viewLower]: JSON.stringify({
                  responses: [
                    { questionID: 'q1', answer: { value: '' } },
                  ],
                }),
              },
            },
          },
        },
      }],
      questionsCache: [{
        slug: 'fresh',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                prompt: 'Question 1',
                type: 'freeform',
              },
            },
          },
        },
      }],
      sbtCache: [],
      userCache: [{
        slug: 'fresh',
        data: {
          [viewLower]: {
            [networkID]: {
              lastBlockScanned: 120,
              data: {
                createdSurveys: [],
                createdQuestions: [],
                questionResponses: [],
                surveyResponses: [{
                  surveyId: 's1',
                  responder: viewLower,
                  blockNumber: 100,
                  response: {
                    responses: [
                      { questionID: 'q1', answer: { value: 'fresh survey payload' } },
                    ],
                  },
                }],
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.surveyResponseInfo[0].slug).toBe('fresh');
    expect(instance.state.detailedSurveyResponses.s1[0].responseData.answer.value).toBe('fresh survey payload');
  });

  it('prefers the latest response using transaction-index recency when caches disagree', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                prompt: 'Question 1',
                type: 'freeform',
              },
            },
            questionResponses: {
              q1: {
                [viewAddress.toLowerCase()]: JSON.stringify({ answer: { value: 'older cache payload' } }),
              },
            },
            questionResponsesMeta: {
              q1: {
                [viewAddress.toLowerCase()]: { bn: 10, txi: 1, li: 5, ts: 0 },
              },
            },
          },
        },
      }],
      userCache: [{
        slug: 'edge',
        data: {
          [viewAddress.toLowerCase()]: {
            [networkID]: {
              lastBlockScanned: 120,
              data: {
                createdSurveys: [],
                createdQuestions: [],
                surveyResponses: [],
                questionResponses: [
                  {
                    questionId: 'q1',
                    responder: viewAddress.toLowerCase(),
                    response: JSON.stringify({ answer: { value: 'newer user-cache payload' } }),
                    blockNumber: 10,
                    transactionIndex: 2,
                    logIndex: 0,
                  },
                ],
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.detailedQuestionResponses.q1.answer.value).toBe('newer user-cache payload');
  });

  it('keeps malformed non-JSON response payloads visible instead of dropping them', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              qbad: {
                id: 'qbad',
                prompt: 'Malformed payload prompt',
                type: 'freeform',
              },
            },
            questionResponses: {
              qbad: {
                [viewAddress.toLowerCase()]: 'not-json-payload',
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.detailedQuestionResponses.qbad.answer.value).toBe('not-json-payload');
  });

  it('normalizes legacy question response payloads that use top-level value fields', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              qlegacy: {
                id: 'qlegacy',
                prompt: 'Legacy prompt',
                type: 'freeform',
              },
            },
            questionResponses: {
              qlegacy: {
                [viewAddress.toLowerCase()]: JSON.stringify({
                  type: 'freeform',
                  value: 'legacy plain answer',
                }),
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].id).toBe('qlegacy');
    expect(instance.state.detailedQuestionResponses.qlegacy.answer.value).toBe('legacy plain answer');
  });

  it('keeps additional-comment-only responses visible after payload normalization', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              qextra: {
                id: 'qextra',
                prompt: 'Extra comments prompt',
                type: 'freeform',
              },
            },
            questionResponses: {
              qextra: {
                [viewAddress.toLowerCase()]: JSON.stringify({
                  answer: { value: '' },
                  additionalComment: 'I only left extra context.',
                }),
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.detailedQuestionResponses.qextra.additional.value).toBe('I only left extra context.');
  });

  it('keeps survey/question loading active during deep scan by default', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
      loadingSurveys: false,
      loadingQuestions: false,
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn(() => []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.loadingSurveys).toBe(true);
    expect(instance.state.loadingQuestions).toBe(true);
  });

  it('allows survey/question sections to resolve while deep scan is running when deep-scan loading is disabled globally', () => {
    globalThis.CE_USER_PROFILE_DEEP_SCAN_LOADING = false;
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
      loadingSurveys: false,
      loadingQuestions: false,
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn(() => []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.loadingSurveys).toBe(false);
    expect(instance.state.loadingQuestions).toBe(false);
  });

  it('suppresses "No surveys created." while a deep scan is still running', () => {
    globalThis.CE_USER_PROFILE_DEEP_SCAN_LOADING = false;
    const instance = makeInstance({
      viewAddress: '0x00000000000000000000000000000000000000aa',
    });
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      loadingSurveys: false,
      showSectionSurveyResponsesOpen: true,
      showSectionSurveysCreatedOpen: true,
      surveyCreationInfo: [],
      surveyResponseInfo: [{
        id: 's1',
        title: 'Survey 1',
        questionsCount: 1,
        tags: [],
        documentURLs: [],
        slug: 'edge',
      }],
      detailedSurveyResponses: { s1: [] },
    };

    const tree = instance.render();
    expect(treeHasText(tree, 'No surveys created.')).toBe(false);
  });

  it('populates slug on user created surveys and injects creator field from userCache', () => {
    const instance = makeInstance();
    const viewLower = String(instance.props.viewAddress).toLowerCase();
    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => {
      if (name === 'userCache') {
        return [{
          slug: 'edge',
          data: {
            [viewLower]: {
              [instance.props.network.id]: {
                data: {
                  createdSurveys: [{
                    id: 's100',
                    data: { title: 'User Cache Survey' },
                  }],
                },
              },
            },
          },
        }];
      }
      return [];
    });

    instance._refreshAllDataFromCache({ force: true });

    expect(instance.state.surveyCreationInfo).toHaveLength(1);
    expect(instance.state.surveyCreationInfo[0].id).toBe('s100');
    expect(instance.state.surveyCreationInfo[0].slug).toBe('edge');
  });

  it('canonicalizes created survey display links for reserved session aliases', () => {
    const toDataUrlSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,');
    try {
      const instance = makeInstance();
      instance.state = {
        ...instance.state,
        selectedTab: 'surveys',
        surveyCreationInfo: [
          {
            id: 'survey-debate',
            title: 'Debate Survey',
            slug: 'DEBATE',
            questionsCount: 1,
            tags: [],
            documentURLs: [],
            questionIDs: [],
          },
          {
            id: 'survey-general',
            title: 'General Survey',
            slug: 'general',
            questionsCount: 2,
            tags: [],
            documentURLs: [],
            questionIDs: [],
          },
        ],
        loadingSurveys: false,
        loadingQuestions: false,
        loadingSBTs: false,
        isDeepScanning: false,
      };

      const tree = instance.render();
      const surveyLinks = collectTreeNodes(
        tree,
        (node) => node?.type === 'a' && typeof node?.props?.href === 'string' && node.props.href.startsWith('/survey/')
      ).map((node) => node.props.href);

      expect(surveyLinks).toContain('/survey/survey-debate?session=DEBATE');
      expect(surveyLinks).toContain('/survey/survey-general');
      expect(surveyLinks).not.toContain('/survey/survey-debate?session=rxc');
      expect(surveyLinks).not.toContain('/survey/survey-general?session=general');
    } finally {
      toDataUrlSpy.mockRestore();
    }
  });

  it('includes held SBTs even when metadata name is missing, unless explicitly unlisted', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });

    const section = instance._deriveSbtSection({
      sbtAggregate: {
        '0x1000000000000000000000000000000000000001': {
          sbtAddress: '0x1000000000000000000000000000000000000001',
          sbtInfo: { unlisted: false },
          mintedSet: new Set([viewLower]),
          burnedSet: new Set(),
          slug: 'edge',
        },
        '0x2000000000000000000000000000000000000002': {
          sbtAddress: '0x2000000000000000000000000000000000000002',
          sbtInfo: { unlisted: true },
          mintedSet: new Set([viewLower]),
          burnedSet: new Set(),
          slug: 'edge',
        },
      },
    }, viewLower);

    expect(section.sbtList).toHaveLength(1);
    expect(section.sbtList[0].sbtInfo.sbtAddress).toBe('0x1000000000000000000000000000000000000001');
    expect(String(section.sbtList[0].sbtInfo.name || '')).toContain('Group');
  });

  it('uses masked display text for held SBTs with locked names', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });

    const section = instance._deriveSbtSection({
      sbtAggregate: {
        '0x1000000000000000000000000000000000000001': {
          sbtAddress: '0x1000000000000000000000000000000000000001',
          sbtInfo: {
            name: '',
            contractName: 'CE-SBT-12',
            nameLocked: true,
            unlisted: false,
          },
          mintedSet: new Set([viewLower]),
          burnedSet: new Set(),
          slug: 'edge',
        },
      },
    }, viewLower);

    expect(section.sbtList).toHaveLength(1);
    expect(section.sbtList[0].sbtInfo.name).toBe('[encrypted]');
  });

  it('returns memoized deep-scan tooltip lines without re-scanning cache in render path', () => {
    const instance = makeInstance();
    instance.state.deepScanTooltipLines = ['edge / 84532: 120'];
    const scanSpy = jest.spyOn(instance, '_dgReadAll');

    const first = instance.buildDeepScanProgressTooltip();
    const second = instance.buildDeepScanProgressTooltip();

    expect(first).toEqual(['edge / 84532: 120']);
    expect(second).toEqual(['edge / 84532: 120']);
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it('includes general-slug progress in deep-scan timer input signatures', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({
      viewAddress,
      network: { id: 84532 },
      latestBlockNumber: 120,
    });
    const listSpy = jest
      .spyOn(cacheScripts, 'listNamespaceSlugsSync')
      .mockReturnValue(['']);
    const peekSpy = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockReturnValueOnce({
        [viewLower]: {
          '84532': {
            lastBlockScanned: 10,
            lastScanTimestamp: 1,
          },
        },
      })
      .mockReturnValueOnce({
        [viewLower]: {
          '84532': {
            lastBlockScanned: 11,
            lastScanTimestamp: 2,
          },
        },
      });

    const first = instance._buildDeepScanTooltipInputSignature();
    const second = instance._buildDeepScanTooltipInputSignature();

    expect(first).not.toEqual(second);
    expect(first).toContain(':84532:10:1');
    expect(second).toContain(':84532:11:2');

    listSpy.mockRestore();
    peekSpy.mockRestore();
  });

  it('refreshes deep-scan tooltip lines on timer ticks while deep scanning', () => {
    jest.useFakeTimers();
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      deepScanTooltipLines: ['edge / 84532: 10'],
    };
    jest
      .spyOn(instance, '_buildDeepScanTooltipInputSignature')
      .mockReturnValueOnce('sig-1')
      .mockReturnValueOnce('sig-2');
    jest
      .spyOn(instance, 'computeDeepScanProgressSnapshot')
      .mockReturnValueOnce({ lines: ['edge / 84532: 11'], rows: null })
      .mockReturnValueOnce({ lines: ['edge / 84532: 12'], rows: null });

    instance.startDeepScanProgressTimer();
    jest.advanceTimersByTime(2000);
    expect(instance.state.deepScanTooltipLines).toEqual(['edge / 84532: 11']);
    jest.advanceTimersByTime(2000);
    expect(instance.state.deepScanTooltipLines).toEqual(['edge / 84532: 12']);
    instance.stopDeepScanProgressTimer();
  });

  it('skips deep-scan tooltip recompute when timer inputs are unchanged', () => {
    jest.useFakeTimers();
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      deepScanTooltipLines: ['edge / 84532: 10'],
    };
    jest.spyOn(instance, '_buildDeepScanTooltipInputSignature').mockReturnValue('stable');
    const computeSpy = jest
      .spyOn(instance, 'computeDeepScanProgressSnapshot')
      .mockReturnValue({ lines: ['edge / 84532: 10'], rows: null });

    instance.startDeepScanProgressTimer();
    jest.advanceTimersByTime(2000);
    jest.advanceTimersByTime(2000);

    expect(computeSpy).toHaveBeenCalledTimes(1);
    instance.stopDeepScanProgressTimer();
  });

  it('skips deep-scan timer state writes when tooltip output is unchanged', () => {
    jest.useFakeTimers();
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      deepScanTooltipLines: ['edge / 84532: 10'],
    };
    jest.spyOn(instance, '_buildDeepScanTooltipInputSignature').mockReturnValue('sig-1');
    jest
      .spyOn(instance, 'computeDeepScanProgressSnapshot')
      .mockReturnValue({ lines: ['edge / 84532: 10'], rows: null });
    instance.setState.mockClear();

    instance.startDeepScanProgressTimer();
    jest.advanceTimersByTime(2000);

    expect(instance.setState).not.toHaveBeenCalled();
    instance.stopDeepScanProgressTimer();
  });

  it('renders full deep-scan tooltip line lists without abbreviation', () => {
    const instance = makeInstance();
    const deepLines = Array.from({ length: 10 }, (_, idx) => `session-${idx + 1} / 84532: ${120 + idx}`);
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      deepScanTooltipLines: deepLines,
      loadingSurveys: true,
      loadingSBTs: true,
    };

    const tree = instance.render();
    const tooltips = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UncontrolledTooltip' &&
        String(node?.props?.target || '').includes('surveySpinner_')
    );
    expect(tooltips.length).toBeGreaterThan(0);

    const tooltipChildren = normalizeChildrenArray(tooltips[0]?.props?.children);
    expect(tooltipChildren).toHaveLength(deepLines.length);
    expect(tooltipChildren[deepLines.length - 1]?.props?.children).toBe(deepLines[deepLines.length - 1]);
  });

  it('renders compact progress-bar rows when structured deep-scan progress is available', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      loadingSurveys: true,
      deepScanTooltipLines: [
        'Session: Edge Session',
        '400 blocks remaining',
      ],
      deepScanProgressRows: [
        {
          slug: 'edge',
          chainId: 84532,
          lastBlockScanned: 1600,
          latestBlock: 2000,
          remainingBlocks: 400,
          percentComplete: 60,
          isDeterminate: true,
          label: 'Edge Session',
          displayLastBlock: 1600,
        },
      ],
    };

    const tree = instance.render();
    const tooltips = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UncontrolledTooltip' &&
        String(node?.props?.target || '').includes('surveySpinner_')
    );
    expect(tooltips.length).toBeGreaterThan(0);
    expect(treeHasText(tooltips[0]?.props?.children, 'Deep scan in progress')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, 'Edge Session')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, '400 blocks remaining')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, '1,600 / 2,000 scanned')).toBe(true);

    const fills = collectTreeNodes(
      tooltips[0]?.props?.children,
      (node) => node?.props?.className === styles.deepScanProgressFill
    );
    expect(fills).toHaveLength(1);
    expect(fills[0]?.props?.style).toEqual(expect.objectContaining({ width: '60%' }));
  });

  it('renders indeterminate fallback rows when latest block is unavailable', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      loadingSurveys: true,
      deepScanTooltipLines: [
        'Session: Edge Session',
        '1,600 scanned',
      ],
      deepScanProgressRows: [
        {
          slug: 'edge',
          chainId: 84532,
          lastBlockScanned: 1600,
          latestBlock: null,
          remainingBlocks: null,
          percentComplete: null,
          isDeterminate: false,
          label: 'Edge Session',
          displayLastBlock: 1600,
        },
      ],
    };

    const tree = instance.render();
    const tooltips = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UncontrolledTooltip' &&
        String(node?.props?.target || '').includes('surveySpinner_')
    );
    expect(tooltips.length).toBeGreaterThan(0);
    expect(treeHasText(tooltips[0]?.props?.children, 'Deep scan in progress')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, 'Edge Session')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, '1,600 scanned')).toBe(true);

    const fills = collectTreeNodes(
      tooltips[0]?.props?.children,
      (node) => node?.props?.className === styles.deepScanProgressFill
    );
    expect(fills).toHaveLength(0);
  });

  it('filters blank separator lines from spinner title text while preserving tooltip spacing', () => {
    const instance = makeInstance();
    const deepLines = [
      'Session: alpha',
      '100 scanned',
      '',
      'Session: beta',
      '200 scanned',
      '   ',
    ];
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      deepScanTooltipLines: deepLines,
      loadingSurveys: true,
    };

    const tree = instance.render();
    const surveySpinners = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'FontAwesomeIcon' &&
        String(node?.props?.id || '').includes('surveySpinner_')
    );
    expect(surveySpinners.length).toBeGreaterThan(0);
    expect(surveySpinners[0]?.props?.title).toBe(
      'Deep scan: Session: alpha | 100 scanned | Session: beta | 200 scanned'
    );

    const tooltips = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UncontrolledTooltip' &&
        String(node?.props?.target || '').includes('surveySpinner_')
    );
    expect(tooltips.length).toBeGreaterThan(0);
    const tooltipChildren = normalizeChildrenArray(tooltips[0]?.props?.children);
    expect(tooltipChildren.map((child) => child?.props?.children)).toEqual(deepLines);
  });

  it('keeps deep-scan progress details hover-only instead of rendering inline summary copy', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      loadingSurveys: true,
      deepScanTooltipLines: [
        'Session: Edge Session',
        'Up to date',
        '',
        'Session: Beta Session',
        '400 blocks remaining',
      ],
      deepScanProgressRows: [
        {
          slug: 'edge',
          chainId: 84532,
          lastBlockScanned: 2000,
          latestBlock: 2000,
          remainingBlocks: 0,
          percentComplete: 100,
          isDeterminate: true,
          label: 'Edge Session',
          displayLastBlock: 2000,
        },
        {
          slug: 'beta',
          chainId: 84532,
          lastBlockScanned: 1600,
          latestBlock: 2000,
          remainingBlocks: 400,
          percentComplete: 60,
          isDeterminate: true,
          label: 'Beta Session',
          displayLastBlock: 1600,
        },
      ],
    };

    const tree = instance.render();
    expect(treeHasText(tree, 'Syncing profile history')).toBe(false);
    expect(treeHasText(tree, 'Beta Session: 400 blocks left')).toBe(false);

    const tooltips = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UncontrolledTooltip' &&
        String(node?.props?.target || '').includes('surveySpinner_')
    );
    expect(tooltips.length).toBeGreaterThan(0);
    expect(treeHasText(tooltips[0]?.props?.children, 'Deep scan in progress')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, 'Beta Session')).toBe(true);
    expect(treeHasText(tooltips[0]?.props?.children, '400 blocks remaining')).toBe(true);
  });

  it('sets hover/focus/click + non-autohide props on all section spinner tooltips and exposes the loading panel on each target', () => {
    const instance = makeInstance();
    const deepLines = ['Session: Edge Session', '400 blocks remaining'];
    const progressRows = [{
      slug: 'edge',
      chainId: 84532,
      lastBlockScanned: 1600,
      latestBlock: 2000,
      remainingBlocks: 400,
      percentComplete: 60,
      isDeterminate: true,
      label: 'Edge Session',
      displayLastBlock: 1600,
    }];
    const spinnerTargetPattern = /(surveySpinner_|surveysCreatedSpinner_|questionSpinner_|questionsCreatedSpinner_|sbtSpinner_)/;
    const collectSpinnerTooltips = (tab) => {
      instance.state = {
        ...instance.state,
        selectedTab: tab,
        isDeepScanning: true,
        deepScanTooltipLines: deepLines,
        deepScanProgressRows: progressRows,
        loadingSurveys: true,
        loadingQuestions: true,
        loadingSBTs: true,
      };
      const tree = instance.render();
      return collectTreeNodes(
        tree,
        (node) => getNodeTypeName(node) === 'UncontrolledTooltip' &&
          spinnerTargetPattern.test(String(node?.props?.target || ''))
      );
    };

    const surveyTabTips = collectSpinnerTooltips('surveys');
    const questionTabTips = collectSpinnerTooltips('questions');
    const allTips = [...surveyTabTips, ...questionTabTips];

    allTips.forEach((tip) => {
      expect(tip.props.trigger).toBe('hover focus click');
      expect(tip.props.autohide).toBe(false);
      expect(treeHasText(tip.props.children, 'Deep scan in progress')).toBe(true);
      expect(treeHasText(tip.props.children, 'Edge Session')).toBe(true);
    });

    const allTargets = allTips.map((tip) => String(tip.props.target || '')).join('|');
    expect(allTargets).toContain('surveySpinner_');
    expect(allTargets).toContain('surveysCreatedSpinner_');
    expect(allTargets).toContain('questionSpinner_');
    expect(allTargets).toContain('questionsCreatedSpinner_');
    expect(allTargets).toContain('sbtSpinner_');
  });

  it('sanitizes spinner tooltip target IDs when viewAddress contains route characters', () => {
    const instance = makeInstance({
      viewAddress: '/session/test-10/survey/0xad3f',
    });
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      isDeepScanning: true,
      deepScanTooltipLines: ['edge / 84532: 150'],
      loadingSurveys: true,
      loadingQuestions: true,
      loadingSBTs: true,
    };
    const spinnerTargetPattern = /(surveySpinner_|surveysCreatedSpinner_|questionSpinner_|questionsCreatedSpinner_|sbtSpinner_)/;
    const tree = instance.render();
    const tooltipTargets = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UncontrolledTooltip' &&
        spinnerTargetPattern.test(String(node?.props?.target || ''))
    ).map((node) => String(node?.props?.target || ''));

    expect(tooltipTargets.length).toBeGreaterThan(0);
    tooltipTargets.forEach((target) => {
      expect(target).not.toContain('/');
      expect(target).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  it('stops spinner interactions from bubbling so section headers do not collapse on tooltip click', () => {
    const instance = makeInstance();
    const deepLines = ['edge / 84532: 150'];
    const spinnerTargetPattern = /(surveySpinner_|surveysCreatedSpinner_|questionSpinner_|questionsCreatedSpinner_|sbtSpinner_)/;
    const collectSpinnerIcons = (tab) => {
      instance.state = {
        ...instance.state,
        selectedTab: tab,
        isDeepScanning: true,
        deepScanTooltipLines: deepLines,
        loadingSurveys: true,
        loadingQuestions: true,
        loadingSBTs: true,
      };
      const tree = instance.render();
      return collectTreeNodes(
        tree,
        (node) => getNodeTypeName(node) === 'FontAwesomeIcon' &&
          spinnerTargetPattern.test(String(node?.props?.id || ''))
      );
    };

    const surveyTabIcons = collectSpinnerIcons('surveys');
    const questionTabIcons = collectSpinnerIcons('questions');
    const allIcons = [...surveyTabIcons, ...questionTabIcons];
    expect(allIcons.length).toBeGreaterThan(0);

    allIcons.forEach((iconNode) => {
      expect(typeof iconNode?.props?.onClick).toBe('function');
      expect(typeof iconNode?.props?.onMouseDown).toBe('function');

      const clickStop = jest.fn();
      iconNode.props.onClick({ stopPropagation: clickStop });
      expect(clickStop).toHaveBeenCalledTimes(1);

      const mouseDownStop = jest.fn();
      iconNode.props.onMouseDown({ stopPropagation: mouseDownStop });
      expect(mouseDownStop).toHaveBeenCalledTimes(1);
    });
  });

  it('uses clone:false when reading survey and question creation caches for analysis payloads', async () => {
    const instance = makeInstance({
      activeSessionSlug: 'edge',
      network: { id: 84532 },
      viewAddress: '0x00000000000000000000000000000000000000aa',
    });
    instance.state = {
      ...instance.state,
      sbtList: [],
      surveyResponseInfo: [],
      detailedSurveyResponses: {},
      questionResponseInfo: [],
      detailedQuestionResponses: {},
      questionCreationInfo: [],
      surveyCreationInfo: [{ id: 's1', title: 'Survey 1', questionsCount: 1 }],
    };

    const peekSpy = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockImplementation((namespace) => {
        if (namespace === 'surveysCache') {
          return {
            '84532': {
              surveys: {
                s1: {
                  questionIDs: ['q1'],
                },
              },
            },
          };
        }
        if (namespace === 'questionsCache') {
          return {
            '84532': {
              questions: {
                q1: {
                  id: 'q1',
                  type: 'freeform',
                  prompt: 'Question 1',
                },
              },
            },
          };
        }
        return {};
      });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await instance.analyzeUser();

    expect(peekSpy).toHaveBeenCalledWith('surveysCache', 'edge', { clone: false });
    expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
    consoleSpy.mockRestore();
  });

  it('decrypts gated responses and patches detailed response state', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      provider: 'wagmi',
    });
    const encryptedResponse = {
      questionID: 'q1',
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":2}',
      },
      additional: {
        value: '',
        encrypted: false,
      },
    };
    instance.state = {
      ...instance.state,
      detailedQuestionResponses: {
        q1: encryptedResponse,
      },
      detailedSurveyResponses: {
        s1: [
          {
            questionData: { id: 'q1', prompt: 'Question 1', type: 'freeform' },
            responseData: encryptedResponse,
            canDecryptOtherResponses: true,
          },
        ],
      },
    };
    cryptoUtils.decryptSingleField.mockResolvedValue({
      answers: {
        q1: { value: 'clear text answer' },
      },
      additionalComments: {},
      importance: {},
    });

    const didDecrypt = await instance.handleDecryptQuestionAnswer('q1', 'answer', encryptedResponse);

    expect(didDecrypt).toBe(true);
    expect(cryptoUtils.decryptSingleField).toHaveBeenCalled();
    expect(instance.state.detailedQuestionResponses.q1.answer.value).toBe('clear text answer');
    expect(instance.state.detailedQuestionResponses.q1.answer.encrypted).toBe(false);
    expect(instance.state.detailedQuestionResponses.q1.answer.encryptedPortion).toBeUndefined();
    expect(instance.state.detailedSurveyResponses.s1[0].responseData.answer.value).toBe('clear text answer');
  });

  it('passes survey binding context when decrypting survey-backed responses', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      provider: 'wagmi',
    });
    const surveyId = `0x${'12'.repeat(32)}`;
    const encryptedResponse = {
      questionID: 'q1',
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":2}',
      },
      additional: {
        value: '',
        encrypted: false,
      },
    };
    instance.state = {
      ...instance.state,
      detailedQuestionResponses: {
        q1: encryptedResponse,
      },
      detailedSurveyResponses: {
        [surveyId]: [
          {
            questionData: {
              id: 'q1',
              prompt: 'Question 1',
              type: 'freeform',
              associatedSurveyId: surveyId,
            },
            responseData: encryptedResponse,
            canDecryptOtherResponses: true,
          },
        ],
      },
    };
    cryptoUtils.decryptSingleField.mockResolvedValue({
      answers: {
        q1: { value: 'clear text answer' },
      },
      additionalComments: {},
      importance: {},
    });

    await instance.handleDecryptQuestionAnswer('q1', 'answer', encryptedResponse);

    expect(cryptoUtils.decryptSingleField).toHaveBeenCalledWith(
      expect.any(Object),
      'q1',
      'answer',
      expect.objectContaining({
        surveyId,
        acceptedSurveyIds: [surveyId, ethers.constants.HashZero],
      })
    );
  });

  it('keeps duplicated payload strings isolated when decrypting one response', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      provider: 'wagmi',
    });
    const duplicatedPayload = JSON.stringify({
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":2}',
      },
      additional: {
        value: '',
        encrypted: false,
      },
    });
    const firstResponse = instance.parseCachedResponsePayload(duplicatedPayload);
    const secondResponse = instance.parseCachedResponsePayload(duplicatedPayload);
    expect(firstResponse).not.toBe(secondResponse);
    instance.state = {
      ...instance.state,
      detailedQuestionResponses: {
        q1: firstResponse,
        q2: secondResponse,
      },
      detailedSurveyResponses: {
        s1: [
          {
            questionData: { id: 'q1', prompt: 'Question 1', type: 'freeform' },
            responseData: firstResponse,
            canDecryptOtherResponses: true,
          },
          {
            questionData: { id: 'q2', prompt: 'Question 2', type: 'freeform' },
            responseData: secondResponse,
            canDecryptOtherResponses: true,
          },
        ],
      },
    };
    cryptoUtils.decryptSingleField.mockResolvedValue({
      answers: {
        q1: { value: 'clear text answer' },
      },
      additionalComments: {},
      importance: {},
    });

    const didDecrypt = await instance.handleDecryptQuestionAnswer('q1', 'answer', firstResponse);

    expect(didDecrypt).toBe(true);
    expect(instance.state.detailedQuestionResponses.q1.answer.value).toBe('clear text answer');
    expect(instance.state.detailedQuestionResponses.q2.answer.value).toBe('*');
    expect(instance.state.detailedQuestionResponses.q2.answer.encrypted).toBe(true);
    expect(instance.state.detailedSurveyResponses.s1[1].responseData.answer.value).toBe('*');
  });

  it('clones __proto__ payload keys as data without mutating object prototype', () => {
    const instance = makeInstance();
    const payload = '{"__proto__":{"polluted":"yes"},"answer":{"value":"safe"}}';

    const parsed = instance.parseCachedResponsePayload(payload);

    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(true);
    expect(parsed.__proto__).toEqual({ polluted: 'yes' });
    expect(parsed.answer.value).toBe('safe');
    expect(parsed.polluted).toBeUndefined();
  });

  it('hides encrypted question content when gate access is denied', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const deniedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    const defaultNoGateKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(deniedKey, { status: 'denied', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(defaultNoGateKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                creator: viewAddress,
                prompt: '[encrypted]',
                type: 'freeform',
                promptEncrypted: '{"v":2}',
              },
            },
            questionResponses: {
              q1: {
                [viewAddress]: JSON.stringify({
                  answer: { value: 'hello world' },
                }),
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(0);
    expect(instance.state.questionCreationInfo).toHaveLength(0);
    expect(instance.state.loadingQuestions).toBe(false);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
  });

  it('keeps question responses visible when only additional comments are encrypted and gate access is denied', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const deniedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    const defaultNoGateKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(deniedKey, { status: 'denied', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(defaultNoGateKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                creator: viewAddress,
                prompt: 'Public prompt',
                type: 'freeform',
              },
            },
            questionResponses: {
              q1: {
                [viewAddress]: JSON.stringify({
                  answer: { value: 'public answer' },
                  additional: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                }),
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].canDecryptOtherResponses).toBe(false);
    expect(instance.state.questionResponseInfo[0].responseEncryption).toEqual({
      answerEncrypted: false,
      additionalEncrypted: true,
    });
    expect(instance.state.detailedQuestionResponses.q1.answer.value).toBe('public answer');
    expect(instance.state.detailedQuestionResponses.q1.additional.encrypted).toBe(true);
  });

  it('keeps survey responses visible when only additional comments are encrypted and gate access is denied', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const deniedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'surveyResponses' });
    const defaultNoGateKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(deniedKey, { status: 'denied', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(defaultNoGateKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            surveys: {
              s1: {
                id: 's1',
                title: 'Survey 1',
                creator: viewAddress,
                questionIDs: ['q1'],
              },
            },
            surveyResponses: {
              s1: {
                [viewAddress]: JSON.stringify({
                  responses: [{
                    questionID: 'q1',
                    answer: { value: 'public survey answer' },
                    additional: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                  }],
                }),
              },
            },
          },
        },
      }],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                creator: viewAddress,
                prompt: 'Question 1',
                type: 'freeform',
              },
            },
            questionResponses: {},
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.detailedSurveyResponses.s1).toHaveLength(1);
    expect(instance.state.detailedSurveyResponses.s1[0].canDecryptOtherResponses).toBe(false);
    expect(instance.state.detailedSurveyResponses.s1[0].responseEncryption).toEqual({
      answerEncrypted: false,
      additionalEncrypted: true,
    });
    expect(instance.state.detailedSurveyResponses.s1[0].responseData.answer.value).toBe('public survey answer');
    expect(instance.state.detailedSurveyResponses.s1[0].responseData.additional.encrypted).toBe(true);
  });

  it('shows encrypted question responses when gate access is granted', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const grantedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    instance._responseGateAccessStatusByKey.set(grantedKey, { status: 'granted', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                creator: viewAddress,
                prompt: '[encrypted]',
                type: 'freeform',
                promptEncrypted: '{"v":2}',
              },
            },
            questionResponses: {
              q1: {
                [viewAddress]: JSON.stringify({
                  answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                }),
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].canDecryptOtherResponses).toBe(true);
    expect(instance.state.questionCreationInfo).toHaveLength(1);
  });

  it('uses the viewer-response source slug when evaluating encrypted question visibility', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const otherAddress = '0x00000000000000000000000000000000000000cc';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const openGrantedKey = instance._buildGateAccessCacheKey({ slug: 'open-session', resourceKey: 'questionResponses' });
    const openDefaultKey = instance._buildGateAccessCacheKey({ slug: 'open-session', resourceKey: 'default' });
    const closedDeniedKey = instance._buildGateAccessCacheKey({ slug: 'closed-session', resourceKey: 'questionResponses' });
    const closedDefaultKey = instance._buildGateAccessCacheKey({ slug: 'closed-session', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(openGrantedKey, { status: 'granted', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(openDefaultKey, { status: 'no-gate', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(closedDeniedKey, { status: 'denied', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(closedDefaultKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'open-session',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                  }),
                },
              },
            },
          },
        },
        {
          slug: 'closed-session',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [otherAddress]: JSON.stringify({
                    answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                  }),
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].id).toBe('q1');
  });

  it('revalidates stale terminal gate statuses during encrypted visibility refresh', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const staleTs = Date.now() - (61 * 1000);
    const grantedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    const defaultNoGateKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(grantedKey, { status: 'granted', ts: staleTs });
    instance._responseGateAccessStatusByKey.set(defaultNoGateKey, { status: 'no-gate', ts: staleTs });
    checkSponsoredAccess.mockResolvedValue({
      status: 'granted',
      gate: null,
      resourceKey: 'questionResponses',
    });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                creator: viewAddress,
                prompt: '[encrypted]',
                type: 'freeform',
                promptEncrypted: '{"v":2}',
              },
            },
            questionResponses: {
              q1: {
                [viewAddress]: JSON.stringify({
                  answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                }),
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(checkSponsoredAccess).toHaveBeenCalled();
    const requestedResources = checkSponsoredAccess.mock.calls.map(([arg]) => arg?.resourceKey);
    expect(requestedResources).toEqual(expect.arrayContaining(['questionResponses', 'default']));
  });

  it('shows encrypted question responses when only default gate is granted', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const defaultGrantedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'default' });
    const resourceNoGateKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    instance._responseGateAccessStatusByKey.set(defaultGrantedKey, { status: 'granted', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(resourceNoGateKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                creator: viewAddress,
                prompt: '[encrypted]',
                type: 'freeform',
                promptEncrypted: '{"v":2}',
              },
            },
            questionResponses: {
              q1: {
                [viewAddress]: JSON.stringify({
                  answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                }),
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].canDecryptOtherResponses).toBe(true);
    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.loadingQuestions).toBe(false);
  });

  it('keeps question loading active when encrypted visibility is uncertain (gate status unknown)', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const unknownKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    instance._responseGateAccessStatusByKey.set(unknownKey, { status: 'unknown', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                creator: viewAddress,
                prompt: '[encrypted]',
                type: 'freeform',
                promptEncrypted: '{"v":2}',
              },
            },
            questionResponses: {
              q1: {
                [viewAddress]: JSON.stringify({
                  answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                }),
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(0);
    expect(instance.state.questionCreationInfo).toHaveLength(0);
    expect(instance.state.loadingQuestions).toBe(true);
    expect(instance.state.hasUncertainGateAccess).toBe(true);
  });

  it('does not keep SBT loading active when only question gate visibility is uncertain', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    instance.state = {
      ...instance.state,
      hasUncertainUserData: false,
      hasUncertainGateAccess: true,
    };
    const unknownKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    instance._responseGateAccessStatusByKey.set(unknownKey, { status: 'unknown', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                creator: viewAddress,
                prompt: '[encrypted]',
                type: 'freeform',
                promptEncrypted: '{"v":2}',
              },
            },
            questionResponses: {
              q1: {
                [viewAddress]: JSON.stringify({
                  answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                }),
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.loadingQuestions).toBe(true);
    expect(instance.state.loadingSBTs).toBe(false);
    expect(instance.state.hasUncertainGateAccess).toBe(true);
  });
});

describe('UserPage cold-load network fallback', () => {
  it('renders cached survey/question/sbt data when network id is unavailable', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const cacheNetworkID = '84532';
    const instance = makeInstance({ viewAddress, network: {} });

    const dataByNamespace = {
      surveysCache: [{
        slug: 'edge',
        data: {
          [cacheNetworkID]: {
            surveys: {
              s1: {
                id: 's1',
                title: 'Survey 1',
                creator: viewAddress,
                questionIDs: ['q1'],
              },
            },
            surveyResponses: {
              s1: {
                [viewAddress]: JSON.stringify({
                  responses: [{ questionID: 'q1', answer: { value: 'yes' } }],
                }),
              },
            },
          },
        },
      }],
      questionsCache: [{
        slug: 'edge',
        data: {
          [cacheNetworkID]: {
            questions: {
              q1: {
                id: 'q1',
                prompt: 'Question 1',
                type: 'freeform',
                creator: viewAddress,
              },
            },
            questionResponses: {
              q1: {
                [viewAddress]: JSON.stringify({
                  answer: { value: 'value' },
                }),
              },
            },
          },
        },
      }],
      sbtCache: [{
        slug: 'edge',
        data: {
          [cacheNetworkID]: {
            sbtList: {
              '0x100': {
                sbtAddress: '0x100',
                sbtInfo: { name: 'Badge 100', unlisted: false },
                mintedAddresses: [viewAddress],
                burnedAddresses: [],
              },
            },
          },
        },
      }],
      userCache: [{
        slug: 'edge',
        data: {
          [viewLower]: {
            [cacheNetworkID]: {
              lastBlockScanned: 120,
              data: {},
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.surveyCreationInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.sbtList).toHaveLength(1);
    expect(instance.state.loadingSurveys).toBe(false);
    expect(instance.state.loadingQuestions).toBe(false);
    expect(instance.state.loadingSBTs).toBe(false);
  });

  it('uses userCache data from non-active chain buckets when network id mismatches', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const cacheNetworkID = '84532';
    const instance = makeInstance({ viewAddress, network: { id: 1 } });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [],
      userCache: [{
        slug: 'edge',
        data: {
          [viewLower]: {
            [cacheNetworkID]: {
              lastBlockScanned: 120,
              data: {
                createdSurveys: [{
                  id: 's1',
                  data: {
                    id: 's1',
                    title: 'Survey from userCache',
                    questionIDs: ['q1'],
                  },
                }],
                surveyResponses: [{
                  surveyId: 's1',
                  responder: viewLower,
                  response: {
                    responses: [
                      {
                        questionID: 'q1',
                        answer: { value: 'yes' },
                      },
                    ],
                  },
                }],
                createdQuestions: [{
                  id: 'q1',
                  data: {
                    id: 'q1',
                    prompt: 'Question from userCache',
                    type: 'freeform',
                  },
                }],
                questionResponses: [{
                  questionId: 'q1',
                  responder: viewLower,
                  response: {
                    answer: { value: 'value' },
                  },
                }],
                sbts: [{
                  sbtAddress: '0x100',
                  sbtInfo: { name: 'Badge from userCache', unlisted: false },
                }],
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyCreationInfo).toHaveLength(1);
    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.sbtList).toHaveLength(1);
    expect(instance.state.loadingSurveys).toBe(false);
    expect(instance.state.loadingQuestions).toBe(false);
    expect(instance.state.loadingSBTs).toBe(false);
  });

  it('uses sbtCache ownership counts to keep SBT after mint-burn-mint', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            sbtList: {
              '0x100': {
                sbtAddress: '0x100',
                sbtInfo: { name: 'Badge 100', unlisted: false },
                mintedAddresses: [viewAddress],
                burnedAddresses: [viewAddress],
                mintedCountByAddress: { [viewLower]: 2 },
                burnedCountByAddress: { [viewLower]: 1 },
              },
            },
          },
        },
      }],
      userCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.sbtList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sbtInfo: expect.objectContaining({
            name: 'Badge 100',
            sbtAddress: '0x100',
          }),
        }),
      ])
    );
  });

  it('honors legacy sbtCache mintedAddresses when count maps are empty placeholders', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            sbtList: {
              '0x100': {
                sbtAddress: '0x100',
                sbtInfo: { name: 'Badge 100', unlisted: false },
                mintedAddresses: [viewAddress],
                burnedAddresses: [],
                mintedCountByAddress: {},
                burnedCountByAddress: {},
                countsLoaded: false,
              },
            },
          },
        },
      }],
      userCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.sbtList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sbtInfo: expect.objectContaining({
            name: 'Badge 100',
            sbtAddress: '0x100',
          }),
        }),
      ])
    );
  });

  it('keeps legacy sbtCache set-only burn behavior when ownership counts are absent', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            sbtList: {
              '0x100': {
                sbtAddress: '0x100',
                sbtInfo: { name: 'Badge 100', unlisted: false },
                mintedAddresses: [viewAddress],
                burnedAddresses: [viewAddress],
              },
            },
          },
        },
      }],
      userCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.sbtList).toHaveLength(0);
  });

  it('does not let userCache fallback SBT entries override burned ownership from sbtCache', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [{
        slug: 'edge',
        data: {
          [networkID]: {
            sbtList: {
              '0x100': {
                sbtAddress: '0x100',
                sbtInfo: { name: 'Badge 100', unlisted: false },
                mintedAddresses: [viewAddress],
                burnedAddresses: [viewAddress],
              },
            },
          },
        },
      }],
      userCache: [{
        slug: 'edge',
        data: {
          [viewLower]: {
            [networkID]: {
              lastBlockScanned: 120,
              data: {
                sbts: [{
                  sbtAddress: '0x100',
                  sbtInfo: { name: 'Badge 100', unlisted: false },
                }],
              },
            },
          },
        },
      }],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.sbtList).toHaveLength(0);
  });

  it('userCache row with explicit burn count > mint count marks SBT as burned when no prior sbtCache signal', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [],
      userCache: [{
        slug: 'edge',
        data: {
          [viewLower]: {
            [networkID]: {
              lastBlockScanned: 120,
              data: {
                sbts: [{
                  sbtAddress: '0x100',
                  sbtInfo: { name: 'Badge 100', unlisted: false },
                  mintedCountByAddress: { [viewLower]: 1 },
                  burnedCountByAddress: { [viewLower]: 2 },
                }],
              },
            },
          },
        },
      }],
    };

    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    const aggregate = instance._collectUnifiedCacheData({ networkID, viewAddressLower: viewLower });
    const sbtEntry = aggregate.sbtAggregate['0x100'];

    expect(sbtEntry.burnedSet.has(viewLower)).toBe(true);
    expect(sbtEntry.mintedSet.has(viewLower)).toBe(false);
    expect(instance._deriveSbtSection(aggregate, viewLower).sbtList).toHaveLength(0);
  });

  it('merges non-active cache partitions even when active-chain buckets exist', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress, network: { id: 1 } });

    const dataByNamespace = {
      surveysCache: [{
        slug: 'edge',
        data: {
          '1': {
            surveys: {
              sActive: {
                id: 'sActive',
                title: 'Active Chain Survey',
                creator: '0x00000000000000000000000000000000000000bb',
                questionIDs: ['qActive'],
              },
            },
            surveyResponses: {},
          },
          '84532': {
            surveys: {
              sOther: {
                id: 'sOther',
                title: 'Other Chain Survey',
                creator: viewAddress,
                questionIDs: ['qOther'],
              },
            },
            surveyResponses: {
              sOther: {
                [viewLower]: JSON.stringify({
                  responses: [{ questionID: 'qOther', answer: { value: 'yes' } }],
                }),
              },
            },
          },
        },
      }],
      questionsCache: [{
        slug: 'edge',
        data: {
          '1': {
            questions: {
              qActive: {
                id: 'qActive',
                prompt: 'Active Prompt',
                type: 'freeform',
              },
            },
            questionResponses: {},
          },
          '84532': {
            questions: {
              qOther: {
                id: 'qOther',
                prompt: 'Other Prompt',
                type: 'freeform',
                creator: viewAddress,
              },
            },
            questionResponses: {
              qOther: {
                [viewLower]: JSON.stringify({ answer: { value: 'cross-chain value' } }),
              },
            },
          },
        },
      }],
      sbtCache: [{
        slug: 'edge',
        data: {
          '1': {
            sbtList: {
              '0x111': {
                sbtAddress: '0x111',
                sbtInfo: { name: 'Active Badge', unlisted: false },
                mintedAddresses: [],
                burnedAddresses: [],
              },
            },
          },
          '84532': {
            sbtList: {
              '0x222': {
                sbtAddress: '0x222',
                sbtInfo: { name: 'Cross Badge', unlisted: false },
                mintedAddresses: [viewLower],
                burnedAddresses: [],
              },
            },
          },
        },
      }],
      userCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'sother' })])
    );
    expect(instance.state.questionResponseInfo).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'qother' })])
    );
    expect(instance.state.sbtList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sbtInfo: expect.objectContaining({ sbtAddress: '0x222' }),
        }),
      ])
    );
  });
});

describe('UserPage deep scan tooltip formatting', () => {
  it('uses explicit demo-session display config for deep-scan tooltip labels when registry config is missing', () => {
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(null);
    const demoConfigSpy = jest
      .spyOn(contractScriptsModule, 'getDemoSessionConfigBySlug')
      .mockReturnValue({
        slug: 'edge',
        sessionName: 'Edge Demo Session',
        blockLimits: {
          start: 1000,
        },
      });

    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [{
      slug: 'edge',
      data: {
        [viewLower]: {
          '84532': {
            lastBlockScanned: 1600,
          },
        },
      },
    }];

    const rows = instance._deriveDeepScanProgressRows(
      userCaches,
      viewLower,
      84532,
      2000
    );

    expect(rows).toEqual([
      expect.objectContaining({
        slug: 'edge',
        label: 'Edge Demo Session (edge)',
      }),
    ]);
    expect(demoConfigSpy).toHaveBeenCalledWith('edge', { allowDemoFallback: true });
  });

  it('derives determinate progress rows with percent complete when start and latest blocks are known', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    jest.spyOn(instance, '_getDeepScanSessionDisplayConfig').mockReturnValue({
      sessionName: 'Edge Session',
      blockLimits: {
        start: 1000,
      },
    });
    const userCaches = [{
      slug: 'edge',
      data: {
        [viewLower]: {
          '84532': {
            lastBlockScanned: 1600,
          },
        },
      },
    }];

    const rows = instance._deriveDeepScanProgressRows(
      userCaches,
      viewLower,
      84532,
      2000
    );

    expect(rows).toEqual([
      expect.objectContaining({
        slug: 'edge',
        chainId: 84532,
        lastBlockScanned: 1600,
        latestBlock: 2000,
        remainingBlocks: 400,
        percentComplete: 60,
        isDeterminate: true,
        label: 'Edge Session (edge)',
        displayLastBlock: 1600,
      }),
    ]);
  });

  it('formats latest-known progress as localized remaining-block counts', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [{
      slug: 'test-session',
      data: {
        [viewLower]: {
          '84532': {
            lastBlockScanned: 15234567,
          },
        },
      },
    }];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(
      userCaches,
      viewLower,
      84532,
      18000000
    );

    expect(lines).toEqual([
      'Session: test-session',
      `${(18000000 - 15234567).toLocaleString()} blocks remaining`,
    ]);
  });

  it('falls back to localized scanned blocks when latest block is unavailable', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [{
      slug: 'test-session',
      data: {
        [viewLower]: {
          '84532': {
            lastBlockScanned: 15234567,
          },
        },
      },
    }];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(
      userCaches,
      viewLower,
      84532,
      null
    );

    expect(lines).toEqual([
      'Session: test-session',
      `${(15234567).toLocaleString()} scanned`,
    ]);
  });

  it('shows "Up to date" when session progress is within 100 blocks of latest', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [{
      slug: 'test-session',
      data: {
        [viewLower]: {
          '84532': {
            lastBlockScanned: 17999900,
          },
        },
      },
    }];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(
      userCaches,
      viewLower,
      84532,
      18000000
    );

    expect(lines).toEqual([
      'Session: test-session',
      'Up to date',
    ]);
  });

  it('renders multiple entries as two-line blocks separated by a blank line', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [
      {
        slug: 'session-a',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 1500,
            },
          },
        },
      },
      {
        slug: 'session-b',
        data: {
          [viewLower]: {
            '11155111': {
              lastBlockScanned: 2500,
            },
          },
        },
      },
    ];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(
      userCaches,
      viewLower,
      84532,
      3000
    );

    expect(lines).toEqual([
      'Session: session-b',
      `${(2500).toLocaleString()} scanned`,
      '',
      'Session: session-a',
      `${(1500).toLocaleString()} blocks remaining`,
    ]);
  });

  it('adds chain IDs only for session slugs that appear on multiple networks', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });
    const userCaches = [
      {
        slug: 'session-a',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 2500,
            },
            '11155111': {
              lastBlockScanned: 1500,
            },
          },
        },
      },
      {
        slug: 'session-b',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 500,
            },
          },
        },
      },
    ];

    const lines = instance._deriveDeepScanProgressTooltipFromCaches(
      userCaches,
      viewLower,
      84532,
      3000
    );

    expect(lines).toEqual([
      'Session: session-a (chain 84532)',
      `${(500).toLocaleString()} blocks remaining`,
      '',
      'Session: session-a (chain 11155111)',
      `${(1500).toLocaleString()} scanned`,
      '',
      'Session: session-b',
      `${(2500).toLocaleString()} blocks remaining`,
    ]);
  });

  it('prioritizes the saved scan-scope session order and keeps an out-of-scope active session first', () => {
    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = ['session-b', 'session-c'];

    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({
      viewAddress,
      activeSessionSlug: 'session-a',
    });
    jest
      .spyOn(instance, '_getDeepScanSessionDisplayConfig')
      .mockImplementation((slug) => ({
        sessionName: String(slug || '').toUpperCase(),
        blockLimits: {
          start: 1000,
        },
      }));

    const userCaches = [
      {
        slug: 'session-z',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 3900,
            },
          },
        },
      },
      {
        slug: 'session-c',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 3300,
            },
          },
        },
      },
      {
        slug: 'session-b',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 2700,
            },
          },
        },
      },
      {
        slug: 'session-a',
        data: {
          [viewLower]: {
            '84532': {
              lastBlockScanned: 1800,
            },
          },
        },
      },
    ];

    const rows = instance._deriveDeepScanProgressRows(
      userCaches,
      viewLower,
      84532,
      4000
    );

    expect(rows.map((row) => row.slug)).toEqual([
      'session-a',
      'session-b',
      'session-c',
      'session-z',
    ]);
  });

  it('links the minimized address text to the profile page and keeps the icon on the block explorer', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
      minimized: true,
      network: { id: 84532, chainId: 84532 },
    });

    const tree = instance.render();
    const explorerHref = `https://sepolia.basescan.org/address/${viewAddress}`;
    const addressLinks = collectTreeNodes(
      tree,
      (node) => node?.type === 'a' && node?.props?.href === `/u/${viewAddress}` && node?.props?.className === styles.addressLink
    );
    const explorerLinks = collectTreeNodes(
      tree,
      (node) => node?.type === 'a' && node?.props?.['aria-label'] === 'View address on explorer'
    );

    expect(treeHasText(tree, '0x000...00aa')).toBe(true);
    expect(addressLinks).toHaveLength(1);
    expect(explorerLinks).toHaveLength(1);
    expect(addressLinks[0]?.props?.target).toBeUndefined();
    expect(explorerLinks[0]?.props?.href).toBe(explorerHref);
  });

  it('links the full-size address text to the block explorer', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
      minimized: false,
      network: { id: 84532, chainId: 84532 },
    });

    const tree = instance.render();
    const explorerHref = `https://sepolia.basescan.org/address/${viewAddress}`;
    const addressLinks = collectTreeNodes(
      tree,
      (node) => node?.type === 'a' && node?.props?.href === explorerHref && node?.props?.className === styles.addressLink
    );

    expect(addressLinks).toHaveLength(1);
    expect(addressLinks[0]?.props?.target).toBe('_blank');
  });

  it('omits explorer links when the active chain has no known explorer metadata', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
      minimized: false,
      network: { id: 777777, chainId: 777777 },
    });

    const tree = instance.render();
    const addressLinks = collectTreeNodes(
      tree,
      (node) => node?.type === 'a' && node?.props?.className === styles.addressLink
    );
    const explorerLinks = collectTreeNodes(
      tree,
      (node) => node?.type === 'a' && node?.props?.className === styles.explorerLink
    );

    expect(instance.getExplorerUrl()).toBeNull();
    expect(addressLinks).toHaveLength(0);
    expect(explorerLinks).toHaveLength(0);
    expect(treeHasText(tree, '0x000...00aa')).toBe(true);
  });

  it('passes the survey source slug into survey-response question cards', () => {
    const instance = makeInstance({
      viewAddress: '0x00000000000000000000000000000000000000aa',
      selectedTab: 'surveys',
    });
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      showSectionSurveyResponsesOpen: true,
      surveyResponseInfo: [{
        id: '0xsurvey',
        title: 'Survey 1',
        questionsCount: 1,
        tags: [],
        documentURLs: [],
        slug: 'edge',
      }],
      expandedSurveyResponses: { '0xsurvey': true },
      detailedSurveyResponses: {
        '0xsurvey': [{
          questionData: { id: 'q1', prompt: 'Question 1', type: 'freeform' },
          responseData: { questionID: 'q1', answer: { value: 'visible answer' } },
          canDecryptOtherResponses: true,
        }],
      },
      surveyCreationInfo: [],
      questionResponseInfo: [],
      detailedQuestionResponses: {},
      questionCreationInfo: [],
      loadingSurveys: false,
      loadingQuestions: false,
      isDeepScanning: false,
    };

    const tree = instance.render();
    const responseCards = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'SingleQuestionResponse'
    );
    const surveyResponseCard = responseCards.find(
      (node) => node?.props?.responderAddress === instance.props.viewAddress
    );

    expect(surveyResponseCard).toBeDefined();
    expect(surveyResponseCard?.props?.sessionSlug).toBe('edge');
  });

  it('does not render the minimized owner bookmark icon shortcut', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
      minimized: true,
    });

    const tree = instance.render();
    const ownerBookmarkShortcuts = collectTreeNodes(
      tree,
      (node) => String(node?.props?.['aria-label'] || '') === 'Open My Bookmarks'
    );

    expect(ownerBookmarkShortcuts).toHaveLength(0);
  });
});
