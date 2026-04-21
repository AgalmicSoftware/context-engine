/** @file UserPage.test.jsx */
import UserPage from './UserPage';
import styles from './UserPage.module.scss';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import { analyzeUserOpinions } from 'utilities/ai/aiScripts.js';
import { ethers } from 'ethers';
import { notify } from '../../utilities/ui/notify.js';

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

let analysisCacheTestSeq = 0;

const makeAnalysisCacheInstance = (props = {}) => {
  analysisCacheTestSeq += 1;
  const slug = props.activeSessionSlug || `analysis-cache-test-${analysisCacheTestSeq}`;
  const viewAddress = props.viewAddress || '0x00000000000000000000000000000000000000aa';
  const networkID = String(props.network?.id || 84532);
  const instance = makeInstance({
    activeSessionSlug: slug,
    viewAddress,
    network: { id: Number(networkID) },
    account: '0x00000000000000000000000000000000000000bb',
    ...props,
  });

  instance.state = {
    ...instance.state,
    username: 'Cache Test User',
    sbtList: [{
      sbtInfo: {
        name: 'Cache Badge',
        sbtAddress: '0x00000000000000000000000000000000000000cc',
      },
    }],
    questionResponseInfo: [{
      id: 'q1',
      type: 'freeform',
      prompt: 'What should be cached?',
    }],
    detailedQuestionResponses: {
      q1: {
        answer: { value: 'A deterministic answer' },
        conviction: 4,
      },
    },
    surveyResponseInfo: [],
    detailedSurveyResponses: {},
    questionCreationInfo: [],
    surveyCreationInfo: [],
  };

  jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue([slug]);
  jest.spyOn(instance, '_getSessionConfigForSlugExact').mockImplementation((candidate) => (
    candidate === slug
      ? {
        slug,
        ai: {
          mode: 'openai',
          models: { thinking: 'gpt-5' },
          modelProviders: { thinking: 'openai' },
        },
      }
      : null
  ));
  checkSponsoredAccess.mockResolvedValue({
    status: 'no-gate',
    gate: null,
    resourceKey: 'ai',
  });

  return {
    instance,
    slug,
    networkID,
    addressLower: viewAddress.toLowerCase(),
  };
};

const getSingleAnalysisCacheEntry = ({ slug, networkID, addressLower }) => {
  const cacheObj = cacheScripts.peekCacheSync('analysisCache', slug, { clone: false });
  const bucket = cacheObj?.[networkID]?.[addressLower] || {};
  const [[fingerprint, entry] = []] = Object.entries(bucket);
  return { cacheObj, fingerprint, entry };
};

const writeSingleAnalysisCacheEntry = async ({
  slug,
  networkID,
  addressLower,
  fingerprint,
  entry,
}) => {
  const current = cacheScripts.peekCacheSync('analysisCache', slug, { clone: false }) || {};
  await cacheScripts.writeCache('analysisCache', slug, {
    ...current,
    [networkID]: {
      ...(current[networkID] || {}),
      [addressLower]: {
        ...(current[networkID]?.[addressLower] || {}),
        [fingerprint]: entry,
      },
    },
  });
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

describe('UserPage clipboard helpers', () => {
  it('does not mark the address copied when clipboard write rejects', async () => {
    const instance = makeInstance();
    const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = jest.fn().mockRejectedValue(new Error('clipboard denied'));
    const errorSpy = jest.spyOn(notify, 'error').mockImplementation(() => undefined);
    const successSpy = jest.spyOn(notify, 'success').mockImplementation(() => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      await instance.copyToClipboard();

      expect(writeText).toHaveBeenCalledWith('0x00000000000000000000000000000000000000aa');
      expect(errorSpy).toHaveBeenCalledWith('Could not copy address');
      expect(successSpy).not.toHaveBeenCalled();
      expect(instance.state.copied).not.toBe(true);
    } finally {
      if (originalClipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
      } else {
        delete navigator.clipboard;
      }
    }
  });
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
      account: viewAddress,
      viewAddress,
      network: { id: 84532 },
    });
    instance.state = {
      ...instance.state,
      username: 'Unsaved User',
      usernameError: '',
      isEditingUsername: true,
    };

    try {
      instance.setUsername();

      expect(setItemSpy).toHaveBeenCalledWith(
        'userPageUsername_84532_0x00000000000000000000000000000000000000aa',
        'Unsaved User'
      );
      expect(instance.state.username).toBe('Unsaved User');
      expect(instance.state.isEditingUsername).toBe(true);
      expect(instance.state.usernameError).toBe('Failed to save username locally.');
      expect(instance.setState.mock.calls.some(([patch]) => patch?.isEditingUsername === false)).toBe(false);
      const [header] = collectTreeNodes(
        instance.render(),
        (node) => getNodeTypeName(node) === 'UserPageHeader'
      );
      expect(header.props.usernameErrorDisplayState).toEqual({
        shouldRenderUsernameError: true,
        usernameErrorText: 'Failed to save username locally.',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[account]',
        'Error saving username to localStorage:',
        storageError
      );
    } finally {
      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });
});

describe('UserPage analyze action boundary', () => {
  it('routes header analyze clicks through the parent-owned analyze handler with preserved args', () => {
    const instance = makeInstance();
    instance.analyzeUser = jest.fn();
    const tree = instance.render();
    const [header] = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UserPageHeader'
    );
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(header).toBeTruthy();
    expect(header.props.analyzeButtonDisplayState.disabled).toBe(false);

    const result = header.props.onAnalyzeUser(event);

    expect(result).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(instance.analyzeUser).toHaveBeenCalledTimes(1);
    expect(instance.analyzeUser).toHaveBeenCalledWith(event);
  });

  it('keeps disabled header analyze clicks inert before reaching analyze side effects', () => {
    const instance = makeInstance({ isSBTCacheReady: false });
    instance.analyzeUser = jest.fn();
    const tree = instance.render();
    const [header] = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UserPageHeader'
    );
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(header).toBeTruthy();
    expect(header.props.analyzeButtonDisplayState.disabled).toBe(true);

    const result = header.props.onAnalyzeUser(event);

    expect(result).toEqual({
      blockedReason: 'none',
      status: 'disabled',
    });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(instance.analyzeUser).not.toHaveBeenCalled();
  });
});

describe('UserPage bookmark action boundary', () => {
  it('routes visible header bookmark clicks through the parent-owned bookmark handler', () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      viewAddress: '0x00000000000000000000000000000000000000aa',
    });
    instance.toggleBookmark = jest.fn();
    const tree = instance.render();
    const [header] = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UserPageHeader'
    );
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(header).toBeTruthy();
    expect(header.props.headerActionVisibility.showBookmarkButton).toBe(true);

    const result = header.props.onBookmark(event);

    expect(result).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(instance.toggleBookmark).toHaveBeenCalledTimes(1);
    expect(instance.toggleBookmark).toHaveBeenCalledWith(event);
  });

  it('keeps hidden owner bookmark actions inert before reaching bookmark side effects', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
    });
    instance.toggleBookmark = jest.fn();
    const tree = instance.render();
    const [header] = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UserPageHeader'
    );
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(header).toBeTruthy();
    expect(header.props.headerActionVisibility.showBookmarkButton).toBe(false);

    const result = header.props.onBookmark(event);

    expect(result).toEqual({
      blockedReason: 'none',
      status: 'hidden',
    });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(instance.toggleBookmark).not.toHaveBeenCalled();
  });
});

describe('UserPage decrypt action boundary', () => {
  it('keeps rendered decrypt wiring inert without an account while preserving cached response identity', async () => {
    const encryptedResponse = {
      questionID: 'q1',
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":2}',
        encryptionAudience: 'gate',
      },
    };
    const instance = makeInstance({
      account: '',
      activeSessionSlug: 'edge',
      provider: 'wagmi',
    });
    instance.state = {
      ...instance.state,
      detailedQuestionResponses: {
        q1: encryptedResponse,
      },
      loadingQuestions: false,
      loadingSBTs: false,
      loadingSurveys: false,
      questionCreationInfo: [],
      questionResponseInfo: [{
        canDecryptOtherResponses: true,
        id: 'q1',
        prompt: 'Cached gated response',
        sessionSlug: 'edge',
      }],
      selectedTab: 'questions',
      showSectionQuestionResponsesOpen: true,
      showSectionQuestionsCreatedOpen: true,
      surveyCreationInfo: [],
      surveyResponseInfo: [],
    };

    const tree = instance.render();
    const [questionSection] = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UserPageQuestionSection'
    );

    expect(questionSection).toBeTruthy();
    expect(questionSection.props.questionResponseEntries).toEqual([{
      canDecryptOtherResponses: true,
      id: 'q1',
      prompt: 'Cached gated response',
      sessionSlug: 'edge',
    }]);
    expect(questionSection.props.detailedQuestionResponseMap.q1).toBe(encryptedResponse);
    expect(questionSection.props.questionResponsesNonce).toBe(0);
    expect(questionSection.props.sbtCacheRevision).toBe(0);

    const didDecrypt = await questionSection.props.onDecryptQuestion('q1', 'answer', encryptedResponse);

    expect(didDecrypt).toBe(false);
    expect(cryptoUtils.decryptSingleField).not.toHaveBeenCalled();
    expect(instance.setState).not.toHaveBeenCalled();
  });
});

describe('UserPage survey route boundaries', () => {
  it('keeps parent-owned survey href and open callbacks aligned with session and responder routes', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      surveyResponseInfo: [{
        documentURLs: [],
        id: 'survey response',
        questionsCount: 1,
        slug: 'alpha',
        tags: [],
        title: 'Response Survey',
      }],
      surveyCreationInfo: [{
        documentURLs: [],
        id: 'created survey',
        questionIDs: [],
        questionsCount: 1,
        slug: 'beta',
        tags: [],
        title: 'Created Survey',
      }],
    };
    const tree = instance.render();
    const [surveySection] = collectTreeNodes(
      tree,
      (node) => getNodeTypeName(node) === 'UserPageSurveySection'
    );

    expect(surveySection).toBeTruthy();
    expect(surveySection.props.getSurveyCreatedHref({ id: 'created survey' }, 'beta')).toBe(
      '/survey/created%20survey?session=beta'
    );

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const event = { stopPropagation: jest.fn() };
    surveySection.props.onOpenSurveyResponse({ id: 'survey response', slug: 'alpha' }, event);

    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      '/survey/survey%20response?session=alpha&responder=0x00000000000000000000000000000000000000aa',
      '_blank',
      'noopener,noreferrer'
    );
    openSpy.mockRestore();
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
