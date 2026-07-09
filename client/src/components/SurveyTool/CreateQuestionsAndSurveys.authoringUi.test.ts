import {
  E2E_TESTIDS,
  REGISTRY_CACHE_KEY,
  arweaveClient,
  cacheScripts,
  collectTreeNodes,
  contractScripts,
  cryptoUtils,
  getChainById,
  getDefaultHttpRpc,
  makeInstance,
  nodeHasClassName,
  normalizeArweaveUrl,
  peekCacheSyncMock,
  renderToStaticMarkup,
  resourceKeys,
  sessionRegistryStore,
  sessionRegistryUtils,
  subscribeCacheUpdatesMock,
  treeHasText,
  writeCacheOptimisticMock,
  hasSubmittedResourcesInManagedCache,
  readManagedCacheSnapshot,
  sanitizeDocumentUrls,
  selectManagedNetBucketSnapshot,
} from './CreateQuestionsAndSurveys.cacheTestUtils';

describe('CreateQuestionsAndSurveys managed cache reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    try {
      delete (globalThis as any).CE_ARWEAVE_GATEWAY_URL;
    } catch (_) {}
    try {
      delete (globalThis as any).CE_ARWEAVE_AR_IO_URL;
    } catch (_) {}
    try {
      delete (globalThis as any).CE_ARWEAVE_DIRECT_TO_AR_IO;
    } catch (_) {}
  });

  it('renders the survey/questions toggle immediately on initial load', () => {
    const instance = makeInstance();

    const tree = instance.render();

    expect(treeHasText(tree, 'Survey')).toBe(true);
    expect(treeHasText(tree, 'Questions')).toBe(true);
  });

  it('hides the survey/questions toggle on untouched pile-entry auto mode while keeping the manual switch visible', () => {
    const instance = makeInstance({ hideSurveyQuestionToggleUntilAuthoring: true });

    const tree = instance.render();
    const modeToggles = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'modeToggle'));
    const modeSwitches = collectTreeNodes(tree, (node) => node?.props?.['data-testid'] === 'ce-create-mode-switch');

    expect(modeToggles).toHaveLength(0);
    expect(modeSwitches).toHaveLength(1);
    expect(treeHasText(modeSwitches[0], 'Manual')).toBe(true);
  });

  it('shows the survey/questions toggle after switching pile entry into manual mode', () => {
    const instance = makeInstance({ hideSurveyQuestionToggleUntilAuthoring: true });
    instance.state = { ...instance.state, showAutoTool: false };

    const tree = instance.render();
    const modeToggles = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'modeToggle'));

    expect(modeToggles).toHaveLength(1);
    expect(treeHasText(modeToggles[0], 'Survey')).toBe(true);
    expect(treeHasText(modeToggles[0], 'Questions')).toBe(true);
  });

  it('shows the survey/questions toggle after AI generation loads authored draft content for pile entry', () => {
    const instance = makeInstance({ hideSurveyQuestionToggleUntilAuthoring: true });
    instance.clearUnfinishedSurveyDraft = jest.fn();
    instance.updateSurveyHash = jest.fn();
    instance.saveToLocalStorage = jest.fn();

    instance.handleAutoQuestionsGenerated([{ type: 'freeform', prompt: 'What should happen next?', tags: [] }], [], '');

    const tree = instance.render();
    const modeToggles = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'modeToggle'));

    expect(instance.state.showAutoTool).toBe(false);
    expect(instance.state.questions).toHaveLength(1);
    expect(modeToggles).toHaveLength(1);
    expect(treeHasText(modeToggles[0], 'Survey')).toBe(true);
    expect(treeHasText(modeToggles[0], 'Questions')).toBe(true);
  });

  it('renders labeled manual and AI mode switch text instead of icon-only toggle', () => {
    const instance = makeInstance();

    let tree = instance.render();
    let modeSwitches = collectTreeNodes(tree, (node) => node?.props?.['data-testid'] === 'ce-create-mode-switch');
    expect(modeSwitches).toHaveLength(1);
    expect(treeHasText(modeSwitches[0], 'Manual')).toBe(true);

    instance.state = { ...instance.state, showAutoTool: false };
    tree = instance.render();
    modeSwitches = collectTreeNodes(tree, (node) => node?.props?.['data-testid'] === 'ce-create-mode-switch');
    expect(modeSwitches).toHaveLength(1);
    expect(treeHasText(modeSwitches[0], 'from URL / Content')).toBe(true);
  });

  it('hides survey/question gate controls when the active session exposes no selectable gates', () => {
    const instance = makeInstance();
    instance.resolveGateOptions = jest.fn(() => ({
      gateMap: {},
      gateOptions: [],
      defaultGateId: '',
    }));
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      questions: [
        {
          uiKey: 'q1',
          id: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [],
          currentTagInputValue: '',
          aiGeneratedTagsFromSource: [],
          isGeneratingTags: false,
        },
      ],
    };

    const tree = instance.render();
    const markup = renderToStaticMarkup(tree);
    const gateLockMatches = markup.match(new RegExp(`data-testid="${E2E_TESTIDS.GATE_LOCK}"`, 'g')) || [];
    const surveyTitleLocks = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'surveyTitleLock'));
    const inheritToggles = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'inheritToggle'));

    expect(gateLockMatches).toHaveLength(0);
    expect(surveyTitleLocks).toHaveLength(0);
    expect(inheritToggles).toHaveLength(0);
  });

  it('renders survey/question gate controls when the active session has selectable gates', () => {
    const instance = makeInstance();
    instance.resolveGateOptions = jest.fn(() => ({
      gateMap: {
        gate_1: { id: 'gate_1' },
      },
      gateOptions: [
        {
          id: 'gate_1',
          label: 'Edge Session',
          badgeLabel: 'Edge Session',
          color: '#5affc2',
        },
      ],
      defaultGateId: 'gate_1',
    }));
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      questions: [
        {
          uiKey: 'q1',
          id: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [],
          currentTagInputValue: '',
          aiGeneratedTagsFromSource: [],
          isGeneratingTags: false,
        },
      ],
    };

    const tree = instance.render();
    const markup = renderToStaticMarkup(tree);
    const gateLockMatches = markup.match(new RegExp(`data-testid="${E2E_TESTIDS.GATE_LOCK}"`, 'g')) || [];
    const surveyTitleLocks = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'surveyTitleLock'));
    const inheritToggles = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'inheritToggle'));

    expect(gateLockMatches).toHaveLength(2);
    expect(surveyTitleLocks).toHaveLength(1);
    expect(inheritToggles).toHaveLength(1);
  });

  it('renders uploaded-question Arweave links against ar.io when direct mode is enabled', () => {
    const txId = '8_2VRRP5Ka0b5F9yiq_nm2hJto8qnQazZ2EtfLJ0viE';
    (globalThis as any).CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    (globalThis as any).CE_ARWEAVE_AR_IO_URL = 'https://ar-io.example.test';

    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      questionsAddedSuccessfully: true,
      questions: [
        {
          uiKey: 'q1',
          id: 'question-id-1234567890',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [],
          currentTagInputValue: '',
          aiGeneratedTagsFromSource: [],
          isGeneratingTags: false,
        },
      ],
      uploadedQuestions: [{ questionId: 'question-id-1234567890', arweaveTxId: txId }],
    };

    const markup = renderToStaticMarkup(instance.render());

    expect(markup).toContain(`href="https://ar-io.example.test/${txId}"`);
  });

  it('renders submitted-survey Arweave links against ar.io when direct mode is enabled', () => {
    const txId = '8_2VRRP5Ka0b5F9yiq_nm2hJto8qnQazZ2EtfLJ0viE';
    (globalThis as any).CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    (globalThis as any).CE_ARWEAVE_AR_IO_URL = 'https://ar-io.example.test';

    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      surveyAddedSuccessfully: true,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      questions: [
        {
          uiKey: 'q1',
          id: 'question-id-1234567890',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [],
          currentTagInputValue: '',
          aiGeneratedTagsFromSource: [],
          isGeneratingTags: false,
        },
      ],
      lastSubmittedSurveyId: '0xSurvey',
      lastSubmittedSurveyArweaveTxId: txId,
    };

    const markup = renderToStaticMarkup(instance.render());

    expect(markup).toContain(`href="https://ar-io.example.test/${txId}"`);
  });

  it('canonicalizes submitted-survey display links for reserved session aliases', () => {
    const buildSurveyLinks = (activeSessionSlug: string) => {
      const instance = makeInstance({ activeSessionSlug });
      instance.state = {
        ...instance.state,
        showAutoTool: false,
        surveyAddedSuccessfully: true,
        isStandaloneQuestion: false,
        title: 'Survey Title',
        questions: [
          {
            uiKey: 'q1',
            id: 'question-id-1234567890',
            type: 'freeform',
            prompt: 'Question 1',
            tags: [],
            currentTagInputValue: '',
            aiGeneratedTagsFromSource: [],
            isGeneratingTags: false,
          },
        ],
        lastSubmittedSurveyId: '0xSurvey',
      };

      return collectTreeNodes(
        instance.render(),
        (node) => node?.type === 'a' && typeof node?.props?.href === 'string' && node.props.href.startsWith('/survey/'),
      ).map((node) => node.props.href);
    };

    const debateLinks = buildSurveyLinks('DEBATE');
    expect(debateLinks).toContain('/survey/0xSurvey?session=DEBATE');
    expect(debateLinks).not.toContain('/survey/0xSurvey?session=rxc');

    const generalLinks = buildSurveyLinks('general');
    expect(generalLinks).toContain('/survey/0xSurvey');
    expect(generalLinks).not.toContain('/survey/0xSurvey?session=general');
  });

  it('filters authoring lock options to response-related gates and labels them with the session name', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: false,
    };

    const { gateOptions, defaultGateId } = instance.resolveGateOptions(
      {
        sessionName: 'FOR TEST 12',
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            surveyResponses: {
              gateId: 'survey_gate',
              sbtAddresses: ['0x1111111111111111111111111111111111111111'],
              lookupStatus: 'ok',
            },
            default: {
              gateId: 'default_gate',
              sbtAddresses: ['0x2222222222222222222222222222222222222222'],
              lookupStatus: 'ok',
            },
            docUrls: {
              gateId: 'doc_urls_gate',
              sbtAddresses: ['0x3333333333333333333333333333333333333333'],
              lookupStatus: 'ok',
            },
          },
        },
        sponsored: {
          gates: {
            survey_gate: {
              label: 'Registry surveyResponses gate',
              mode: 'all',
              sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            },
            default_gate: {
              label: 'Registry default gate',
              mode: 'any',
              sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            },
            doc_urls_gate: {
              label: 'Registry docUrls gate',
              mode: 'any',
              sbtAddresses: ['0x3333333333333333333333333333333333333333'],
            },
          },
        },
      },
      { isStandaloneQuestion: false },
    );

    expect(defaultGateId).toBe('survey_gate');
    expect(gateOptions).toEqual([
      expect.objectContaining({
        id: 'default_gate',
        label: 'FOR TEST 12 (default)',
        badgeLabel: 'FOR TEST 12',
        mode: 'any',
        sbtAddress: '0x2222222222222222222222222222222222222222',
        sbtAddresses: ['0x2222222222222222222222222222222222222222'],
      }),
      expect.objectContaining({
        id: 'survey_gate',
        label: 'FOR TEST 12 (survey)',
        badgeLabel: 'FOR TEST 12',
        mode: 'all',
        sbtAddress: '0x1111111111111111111111111111111111111111',
        sbtAddresses: ['0x1111111111111111111111111111111111111111'],
      }),
    ]);
  });
});
