import { UserPage, makeInstance, setupUserPageCacheRefreshTestLifecycle } from './UserPage.cacheRefresh.testUtils';

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
      surveysCache: [
        {
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
        },
      ],
      questionsCache: [
        {
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
        },
      ],
      sbtCache: [
        {
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
        },
      ],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewLower]: {
              [networkID]: {
                lastBlockScanned: 120,
                data: {},
              },
            },
          },
        },
      ],
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
    instance._dgHasAny = jest.fn((namespace) => namespace === 'questionsCache' || namespace === 'userCache');
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
    instance._dgHasAny = jest.fn((namespace) => namespace === 'questionsCache' || namespace === 'userCache');
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
    instance._dgHasAny = jest.fn((namespace) => namespace === 'questionsCache' || namespace === 'userCache');
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
    instance._dgHasAny = jest.fn((namespace) => namespace === 'questionsCache' || namespace === 'userCache');
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
    instance._dgHasAny = jest.fn((namespace) => namespace === 'questionsCache' || namespace === 'userCache');
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
});
