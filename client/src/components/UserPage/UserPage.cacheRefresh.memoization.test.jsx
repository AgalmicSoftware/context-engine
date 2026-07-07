import {
  UserPage,
  cacheScripts,
  makeInstance,
  setupUserPageCacheRefreshTestLifecycle,
} from './UserPage.cacheRefresh.testUtils';

describe('UserPage cache refresh memoization and cache helpers', () => {
  setupUserPageCacheRefreshTestLifecycle();

  it('invalidates memoized SBT derives on sbt cache revision changes without rerunning question/survey derives', () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      latestBlockNumber: 100,
      sbtCacheRevision: 0,
    });
    instance._dgHasAny = jest.fn(
      (namespace) => namespace === 'questionsCache' || namespace === 'sbtCache' || namespace === 'userCache',
    );
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
      questionsCache: [
        {
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
        },
      ],
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
    const hasSpy = jest.spyOn(cacheScripts, 'hasNamespaceEntriesSync').mockReturnValue(true);

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
      surveysCache: [
        {
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
        },
      ],
      questionsCache: [
        {
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
        },
      ],
      sbtCache: [],
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
});
