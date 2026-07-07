import {
  UserPage,
  cacheScripts,
  makeInstance,
  collectTreeNodes,
  treeHasText,
  setupUserPageCacheRefreshTestLifecycle,
} from './UserPage.cacheRefresh.testUtils';

describe('UserPage cache refresh render and SBT fallbacks', () => {
  setupUserPageCacheRefreshTestLifecycle();

  it('wires cache display state into disabled header actions and loading indicators', () => {
    const toDataUrlSpy = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
    try {
      const instance = makeInstance({
        isQuestionCacheReady: false,
        isResponsesCacheReady: false,
        isSBTCacheReady: false,
        isSurveyCacheReady: false,
      });
      instance.state = {
        ...instance.state,
        aiAvailable: true,
        isDeepScanning: false,
        loadingQuestions: false,
        loadingSBTs: false,
        loadingSurveys: false,
        questionCreationInfo: [],
        questionResponseInfo: [],
        sbtList: [],
        selectedTab: 'questions',
        surveyCreationInfo: [],
        surveyResponseInfo: [],
      };

      const tree = instance.render();
      const analyzeButton = collectTreeNodes(
        tree,
        (node) => node?.type === 'button' && treeHasText(node, 'Analyze'),
      )[0];
      const compareButton = collectTreeNodes(
        tree,
        (node) => node?.type === 'button' && treeHasText(node, 'Compare'),
      )[0];
      const loadingIndicators = collectTreeNodes(
        tree,
        (node) => getNodeTypeName(node) === 'UserPageDeepScanStatusIndicator',
      );

      expect(analyzeButton.props.disabled).toBe(true);
      expect(analyzeButton.props.title).toBe('Available when the user page fully loads.');
      expect(compareButton.props.disabled).toBe(true);
      expect(compareButton.props.title).toBe('Available when the user page fully loads.');
      expect(loadingIndicators).toHaveLength(3);
      expect(treeHasText(tree, 'No question responses found.')).toBe(false);
      expect(treeHasText(tree, 'No questions created.')).toBe(false);
      expect(treeHasText(tree, `No ${t('sbtsLower')} found.`)).toBe(false);
    } finally {
      toDataUrlSpy.mockRestore();
    }
  });

  it('renders ready empty-cache fallbacks without loading or route drift', () => {
    const toDataUrlSpy = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
    try {
      const instance = makeInstance({
        isQuestionCacheReady: true,
        isResponsesCacheReady: true,
        isSBTCacheReady: true,
        isSurveyCacheReady: true,
      });
      instance.state = {
        ...instance.state,
        aiAvailable: true,
        hasUncertainGateAccess: false,
        hasUncertainSbtData: false,
        hasUncertainUserData: false,
        isDeepScanning: false,
        loadingQuestions: false,
        loadingSBTs: false,
        loadingSurveys: false,
        questionCreationInfo: [],
        questionResponseInfo: [],
        sbtList: [],
        selectedTab: 'questions',
        showSectionQuestionResponsesOpen: true,
        showSectionQuestionsCreatedOpen: true,
        surveyCreationInfo: [],
        surveyResponseInfo: [],
      };

      const tree = instance.render();
      const analyzeButton = collectTreeNodes(
        tree,
        (node) => node?.type === 'button' && treeHasText(node, 'Analyze'),
      )[0];
      const compareButton = collectTreeNodes(
        tree,
        (node) => node?.type === 'button' && treeHasText(node, 'Compare'),
      )[0];
      const loadingIndicators = collectTreeNodes(
        tree,
        (node) => getNodeTypeName(node) === 'UserPageDeepScanStatusIndicator',
      );
      expect(analyzeButton.props.disabled).toBe(false);
      expect(analyzeButton.props.title).toBeUndefined();
      expect(compareButton.props.disabled).toBe(false);
      expect(compareButton.props.title).toBeUndefined();
      expect(loadingIndicators).toHaveLength(0);
      expect(treeHasText(tree, 'No question responses found.')).toBe(true);
      expect(treeHasText(tree, 'No questions created.')).toBe(true);
      expect(treeHasText(tree, `No ${t('sbtsLower')} found.`)).toBe(true);
    } finally {
      toDataUrlSpy.mockRestore();
    }
  });

  it('keeps gated question response uncertainty in the loading fallback state', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      viewAddress,
    });
    const retrySpy = jest.spyOn(instance, 'scheduleResponseGateRetry').mockImplementation(() => {});
    const toDataUrlSpy = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
    try {
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
                    prompt: 'Private prompt',
                    type: 'freeform',
                  },
                },
                questionResponses: {
                  q1: {
                    [viewAddress.toLowerCase()]: JSON.stringify({
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

      expect(instance.state.hasUncertainGateAccess).toBe(true);
      expect(instance.state.loadingQuestions).toBe(true);
      expect(instance.state.questionResponseInfo).toHaveLength(0);
      expect(retrySpy).toHaveBeenCalledWith(30000);

      instance.state = {
        ...instance.state,
        aiAvailable: true,
        isDeepScanning: false,
        selectedTab: 'questions',
        showSectionQuestionResponsesOpen: true,
        showSectionQuestionsCreatedOpen: true,
      };

      const tree = instance.render();
      const loadingIndicators = collectTreeNodes(
        tree,
        (node) => getNodeTypeName(node) === 'UserPageDeepScanStatusIndicator',
      );

      expect(loadingIndicators).toHaveLength(2);
      expect(treeHasText(tree, 'No question responses found.')).toBe(false);
      expect(treeHasText(tree, 'No questions created.')).toBe(false);
    } finally {
      toDataUrlSpy.mockRestore();
      retrySpy.mockRestore();
    }
  });

  it('routes SBT refresh through the injected cache refresh boundary', () => {
    const refreshSbtData = jest.fn();
    const instance = makeInstance({ refreshSbtData });

    instance.dispatchSbtDataRefresh('0x0000000000000000000000000000000000000abc', 'edge');

    expect(refreshSbtData).toHaveBeenCalledTimes(1);
    expect(refreshSbtData).toHaveBeenCalledWith('0x0000000000000000000000000000000000000abc', 'edge');

    const inertInstance = makeInstance({ refreshSbtData: undefined });
    expect(() => {
      inertInstance.dispatchSbtDataRefresh('0x0000000000000000000000000000000000000abc', 'edge');
    }).not.toThrow();
  });

  it('preserves SBT refresh argument order through rendered cache-boundary props', () => {
    const refreshSbtData = jest.fn();
    const toDataUrlSpy = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
    try {
      const instance = makeInstance({ refreshSbtData });
      instance.state = {
        ...instance.state,
        isDeepScanning: false,
        loadingQuestions: false,
        loadingSBTs: false,
        loadingSurveys: false,
        questionCreationInfo: [],
        questionResponseInfo: [],
        sbtList: [
          {
            sbtInfo: {
              name: 'Cache Boundary Badge',
              sbtAddress: '0x0000000000000000000000000000000000000abc',
            },
            slug: 'edge',
          },
        ],
        selectedTab: 'questions',
        surveyCreationInfo: [],
        surveyResponseInfo: [],
      };

      const tree = instance.render();
      const sbtCards = collectTreeNodes(tree, (node) => getNodeTypeName(node) === 'SBTPage');

      expect(sbtCards).toHaveLength(1);
      expect(sbtCards[0].props).toMatchObject({
        SBTAddress: '0x0000000000000000000000000000000000000abc',
        isSBTCacheReady: true,
        metadataOnly: true,
        miniaturized: true,
        sessionSlug: 'edge',
      });

      sbtCards[0].props.refreshSbtData('0x0000000000000000000000000000000000000def');

      expect(refreshSbtData).toHaveBeenCalledTimes(1);
      expect(refreshSbtData).toHaveBeenCalledWith('0x0000000000000000000000000000000000000def', 'edge');
    } finally {
      toDataUrlSpy.mockRestore();
    }
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
      surveyResponseInfo: [
        {
          id: 's1',
          title: 'Survey 1',
          questionsCount: 1,
          tags: [],
          documentURLs: [],
          slug: 'edge',
        },
      ],
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
        return [
          {
            slug: 'edge',
            data: {
              [viewLower]: {
                [instance.props.network.id]: {
                  data: {
                    createdSurveys: [
                      {
                        id: 's100',
                        data: { title: 'User Cache Survey' },
                      },
                    ],
                  },
                },
              },
            },
          },
        ];
      }
      return [];
    });

    instance._refreshAllDataFromCache({ force: true });

    expect(instance.state.surveyCreationInfo).toHaveLength(1);
    expect(instance.state.surveyCreationInfo[0].id).toBe('s100');
    expect(instance.state.surveyCreationInfo[0].slug).toBe('edge');
  });

  it('canonicalizes created survey display links for reserved session aliases', () => {
    const toDataUrlSpy = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
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
        (node) => node?.type === 'a' && typeof node?.props?.href === 'string' && node.props.href.startsWith('/survey/'),
      ).map((node) => node.props.href);

      expect(surveyLinks).toContain('/survey/survey-debate?session=DEBATE');
      expect(surveyLinks).toContain('/survey/survey-general');
      expect(surveyLinks).not.toContain('/survey/survey-debate?session=rxc');
      expect(surveyLinks).not.toContain('/survey/survey-general?session=general');
    } finally {
      toDataUrlSpy.mockRestore();
    }
  });

  it('renders user profile internal routes under the configured PUBLIC_URL base path', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce';
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const toDataUrlSpy = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
    try {
      const viewAddress = '0x00000000000000000000000000000000000000aa';
      const instance = makeInstance({
        account: viewAddress,
        viewAddress,
      });
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

      instance.openFullPage();
      expect(openSpy).toHaveBeenCalledWith(`/ce/u/${viewAddress}`);

      const tree = instance.render();
      const hrefs = collectTreeNodes(tree, (node) => node?.type === 'a' && typeof node?.props?.href === 'string').map(
        (node) => node.props.href,
      );

      expect(hrefs).toContain('/ce/bookmarks');
      expect(hrefs).toContain('/ce/survey/survey-debate?session=DEBATE');
      expect(hrefs).toContain('/ce/survey/survey-general');
    } finally {
      openSpy.mockRestore();
      toDataUrlSpy.mockRestore();
      if (previousPublicUrl === undefined) {
        delete process.env.PUBLIC_URL;
      } else {
        process.env.PUBLIC_URL = previousPublicUrl;
      }
    }
  });

  it('renders held SBTs even when metadata name is missing, unless explicitly unlisted', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      userCache: [],
      sbtCache: [
        {
          slug: 'edge',
          data: {
            84532: {
              sbtList: {
                '0x1000000000000000000000000000000000000001': {
                  sbtAddress: '0x1000000000000000000000000000000000000001',
                  sbtInfo: { unlisted: false },
                  mintedAddresses: [viewLower],
                  burnedAddresses: [],
                },
                '0x2000000000000000000000000000000000000002': {
                  sbtAddress: '0x2000000000000000000000000000000000000002',
                  sbtInfo: { unlisted: true },
                  mintedAddresses: [viewLower],
                  burnedAddresses: [],
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
    const tree = instance.render();
    const [sbtSection] = collectTreeNodes(tree, (node) => getNodeTypeName(node) === 'UserPageSbtSection');

    expect(sbtSection).toBeTruthy();
    expect(sbtSection.props.sbtEntries).toHaveLength(1);
    expect(sbtSection.props.sbtEntries[0].sbtInfo.sbtAddress).toBe('0x1000000000000000000000000000000000000001');
    expect(String(sbtSection.props.sbtEntries[0].sbtInfo.name || '')).toContain('Group');
  });

  it('uses masked display text for held SBTs with locked names', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      userCache: [],
      sbtCache: [
        {
          slug: 'edge',
          data: {
            84532: {
              sbtList: {
                '0x1000000000000000000000000000000000000001': {
                  sbtAddress: '0x1000000000000000000000000000000000000001',
                  sbtInfo: {
                    name: '',
                    contractName: 'CE-SBT-12',
                    nameLocked: true,
                    unlisted: false,
                  },
                  mintedAddresses: [viewLower],
                  burnedAddresses: [],
                },
              },
            },
          },
          mintedSet: new Set([viewLower]),
          burnedSet: new Set(),
          slug: 'edge',
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);
    instance._refreshAllDataFromCache({ force: true, markLoading: true });
    const tree = instance.render();
    const [sbtSection] = collectTreeNodes(tree, (node) => getNodeTypeName(node) === 'UserPageSbtSection');

    expect(sbtSection).toBeTruthy();
    expect(sbtSection.props.sbtEntries).toHaveLength(1);
    expect(sbtSection.props.sbtEntries[0].sbtInfo.name).toBe('[encrypted]');
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

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          84532: {
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
          84532: {
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
});
