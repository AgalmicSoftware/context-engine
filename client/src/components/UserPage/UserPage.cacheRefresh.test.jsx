/** @file UserPage.cacheRefresh.test.jsx */
// Remaining broad cache-refresh coverage owns aggregation, memoization, gate uncertainty, response hydration/decrypt, and render fallbacks.
import UserPage from './UserPage';
import styles from './UserPage.module.scss';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';

describe('UserPage cache refresh aggregation and scheduling', () => {
  setupUserPageCacheRefreshTestLifecycle();

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

  it('preserves source session slugs for profile question cards', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({
      viewAddress,
      activeSessionSlug: 'demo',
    });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [{
        slug: 'demo',
        data: {
          [networkID]: {
            questions: {
              q1: {
                id: 'q1',
                creator: viewAddress,
                prompt: 'Question tied to demo-4',
                sessionName: 'demo-4',
                type: 'freeform',
              },
            },
            questionResponses: {
              q1: {
                [viewLower]: JSON.stringify({
                  answer: { value: 'Visible answer' },
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

    expect(instance.state.questionCreationInfo[0]).toEqual(expect.objectContaining({
      id: 'q1',
      sessionSlug: 'demo-4',
      slug: 'demo-4',
    }));
    expect(instance.state.questionResponseInfo[0]).toEqual(expect.objectContaining({
      id: 'q1',
      sessionSlug: 'demo-4',
      slug: 'demo-4',
    }));
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
