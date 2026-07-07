import {
  E2E_TESTIDS,
  REGISTRY_CACHE_KEY,
  arweaveScripts,
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
  buildCreateSurveyDraftStorageKey,
  hasSubmittedResourcesInManagedCache,
  readManagedCacheSnapshot,
  sanitizeDocumentUrls,
  selectManagedNetBucketSnapshot,
} from './CreateQuestionsAndSurveys.cacheTestUtils';

describe('CreateQuestionsAndSurveys managed cache reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    try {
      localStorage.clear();
    } catch (_) {}
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

  it('reads managed cache snapshots with clone disabled', () => {
    peekCacheSyncMock.mockReturnValue({ surveys: ['a'] });

    const snapshot = readManagedCacheSnapshot('bookmarksCache', 'edge');

    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(snapshot).toEqual({ surveys: ['a'] });
  });

  it('selects a network bucket with numeric-key fallback', () => {
    peekCacheSyncMock.mockReturnValue({
      84532: {
        surveys: {
          a: { id: 'a' },
        },
      },
    });

    const bucket = selectManagedNetBucketSnapshot('surveysCache', 'edge', '84532');

    expect(bucket).toEqual({
      surveys: {
        a: { id: 'a' },
      },
    });
  });

  it('checks submitted resources in managed cache for survey and question flows', () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        surveys: { '0xsurvey': { id: '0xsurvey' } },
        questions: { q1: { id: 'q1' }, q2: { id: 'q2' } },
      },
    });

    expect(
      hasSubmittedResourcesInManagedCache({
        slug: 'edge',
        netId: '84532',
        surveyAddedSuccessfully: true,
        surveyId: '0xSurvey',
      }),
    ).toBe(true);

    expect(
      hasSubmittedResourcesInManagedCache({
        slug: 'edge',
        netId: '84532',
        questionsAddedSuccessfully: true,
        questionIds: ['q1', 'q2'],
      }),
    ).toBe(true);
  });

  it('rejects incomplete submitted resource cache hits', () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: { q1: { id: 'q1' } },
      },
    });

    expect(
      hasSubmittedResourcesInManagedCache({
        slug: 'edge',
        questionsAddedSuccessfully: true,
        questionIds: ['q1'],
      }),
    ).toBe(false);

    expect(
      hasSubmittedResourcesInManagedCache({
        slug: 'edge',
        netId: '84532',
        questionsAddedSuccessfully: true,
        questionIds: ['q1', 'q2'],
      }),
    ).toBe(false);

    expect(
      hasSubmittedResourcesInManagedCache({
        slug: 'edge',
        netId: '84532',
        questionsAddedSuccessfully: true,
        questionIds: 'q1' as unknown as string[],
      }),
    ).toBe(false);
  });

  it('copies survey links with session query params when an active session slug exists', () => {
    const instance = makeInstance({ activeSessionSlug: 'edge' });
    const originalClipboard = navigator.clipboard;
    const writeText = jest.fn().mockResolvedValue(undefined);
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      instance.setCopySuccessState = jest.fn();

      instance.copySurveyLinkToClipboard('0xSurvey');

      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/survey/0xSurvey?session=edge`);
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('canonicalizes copied survey links for reserved session aliases', () => {
    const originalClipboard = navigator.clipboard;
    const writeText = jest.fn().mockResolvedValue(undefined);
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      const debateInstance = makeInstance({ activeSessionSlug: 'DEBATE' });
      debateInstance.setCopySuccessState = jest.fn();
      debateInstance.copySurveyLinkToClipboard('0xSurvey');

      const generalInstance = makeInstance({ activeSessionSlug: 'general' });
      generalInstance.setCopySuccessState = jest.fn();
      generalInstance.copySurveyLinkToClipboard('0xSurvey');

      expect(writeText).toHaveBeenNthCalledWith(1, `${window.location.origin}/survey/0xSurvey?session=DEBATE`);
      expect(writeText).toHaveBeenNthCalledWith(2, `${window.location.origin}/survey/0xSurvey`);
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('saves unfinished survey drafts under the active session key', () => {
    const instance = makeInstance({ activeSessionSlug: 'alpha' });
    instance.state = {
      ...instance.state,
      title: 'Alpha draft',
      documentURLs: ['https://example.com/alpha-doc'],
      questions: [
        {
          id: 'q-alpha',
          type: 'freeform',
          prompt: 'Alpha prompt?',
          tags: ['alpha'],
        },
      ],
    };

    instance.saveToLocalStorage({ immediate: true });

    const rawScopedDraft = localStorage.getItem(buildCreateSurveyDraftStorageKey('alpha'));
    expect(localStorage.getItem('unfinishedSurvey')).toBeNull();
    expect(rawScopedDraft).not.toBeNull();
    expect(JSON.parse(rawScopedDraft || '{}')).toEqual(
      expect.objectContaining({
        _sessionSlug: 'alpha',
        title: 'Alpha draft',
        documentURLs: ['https://example.com/alpha-doc'],
      }),
    );
  });

  it('restores unfinished survey drafts only for the matching active session', () => {
    localStorage.setItem(
      buildCreateSurveyDraftStorageKey('alpha'),
      JSON.stringify({
        _sessionSlug: 'alpha',
        title: 'Alpha draft',
        isStandaloneQuestion: true,
        questions: [
          {
            id: 'q-alpha',
            type: 'freeform',
            prompt: 'Alpha prompt?',
            tags: ['alpha'],
          },
        ],
      }),
    );
    localStorage.setItem(
      buildCreateSurveyDraftStorageKey('beta'),
      JSON.stringify({
        _sessionSlug: 'alpha',
        title: 'Mismatched draft',
        questions: [
          {
            id: 'q-mismatch',
            type: 'freeform',
            prompt: 'Wrong prompt?',
            tags: ['wrong'],
          },
        ],
      }),
    );

    const betaInstance = makeInstance({ activeSessionSlug: 'beta' });
    betaInstance.updateSurveyHash = jest.fn();
    expect(betaInstance.loadFromLocalStorage()).toBe(false);
    expect(betaInstance.state.title).toBe('');
    expect(betaInstance.updateSurveyHash).not.toHaveBeenCalled();

    const alphaInstance = makeInstance({ activeSessionSlug: 'alpha' });
    alphaInstance.updateSurveyHash = jest.fn();
    expect(alphaInstance.loadFromLocalStorage()).toBe(true);
    expect(alphaInstance.state.title).toBe('Alpha draft');
    expect(alphaInstance.state.questions).toEqual([
      expect.objectContaining({
        id: 'q-alpha',
        prompt: 'Alpha prompt?',
        tags: ['alpha'],
      }),
    ]);
    expect(alphaInstance.updateSurveyHash).toHaveBeenCalled();
  });

  it('loads legacy unscoped drafts only outside an active session', () => {
    localStorage.setItem(
      'unfinishedSurvey',
      JSON.stringify({
        title: 'Legacy draft',
        isStandaloneQuestion: true,
        questions: [
          {
            id: 'q-legacy',
            type: 'freeform',
            prompt: 'Legacy prompt?',
            tags: ['legacy'],
          },
        ],
      }),
    );

    const scopedInstance = makeInstance({ activeSessionSlug: 'beta' });
    scopedInstance.updateSurveyHash = jest.fn();
    expect(scopedInstance.loadFromLocalStorage()).toBe(false);
    expect(scopedInstance.state.title).toBe('');
    expect(scopedInstance.updateSurveyHash).not.toHaveBeenCalled();

    const unscopedInstance = makeInstance({ activeSessionSlug: '' });
    unscopedInstance.updateSurveyHash = jest.fn();
    expect(unscopedInstance.loadFromLocalStorage()).toBe(true);
    expect(unscopedInstance.state.title).toBe('Legacy draft');
    expect(unscopedInstance.state.questions).toEqual([
      expect.objectContaining({
        id: 'q-legacy',
        prompt: 'Legacy prompt?',
        tags: ['legacy'],
      }),
    ]);
    expect(unscopedInstance.updateSurveyHash).toHaveBeenCalled();
  });

  it('treats draft storage read and write failures as no-ops', () => {
    const readFailure = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked read');
    });
    const readInstance = makeInstance({ activeSessionSlug: 'alpha' });
    expect(readInstance.loadFromLocalStorage()).toBe(false);
    readFailure.mockRestore();

    const writeFailure = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked write');
    });
    const writeInstance = makeInstance({ activeSessionSlug: 'alpha' });
    writeInstance.state = {
      ...writeInstance.state,
      title: 'No-op draft',
      questions: [
        {
          id: 'q-no-op',
          type: 'freeform',
          prompt: 'No-op prompt?',
          tags: [],
        },
      ],
    };

    expect(() => writeInstance.saveToLocalStorage({ immediate: true })).not.toThrow();
    expect((writeInstance as any)._lastSavedUnfinishedSurveyJson).toBeNull();
    writeFailure.mockRestore();
  });

  it('blocks submit when any question prompt is blank after trim', async () => {
    const addQuestionsSpy = jest.spyOn(contractScripts, 'addQuestions').mockResolvedValue({
      receipt: { status: 1 },
      uploadedQuestions: [],
    });

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'edge',
        network: { id: 84532 },
      });

      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        questions: [
          {
            id: 'q1',
            type: 'freeform',
            prompt: '   ',
            tags: [],
          },
        ],
      };

      await instance.createSurvey();

      expect(instance.state.formValidationError).toBe('Question 1 prompt cannot be blank.');
      expect(addQuestionsSpy).not.toHaveBeenCalled();
      expect(instance.state.isSubmitting).toBe(false);
    } finally {
      addQuestionsSpy.mockRestore();
    }
  });

  it('accepts http(s), root-relative, Arweave, and Lit document URLs while blocking unsafe hrefs', () => {
    const txId = 'a'.repeat(43);
    const arUrl = `ar://${txId}`;
    const litUrl = `lit://arweave/${txId}`;
    const legacyLitUrl = `lit+ar://${txId}`;
    const relativeViewerUrl = `/session/0xSessionToken/docs?__ceDocTx=${txId}&__ceDocStorage=lit-arweave&__ceDocKind=link`;
    const unsafeJavascriptUrl = ['java', 'script:alert(1)'].join('');
    const unsafeDataUrl = 'data:text/html,<script>alert(1)</script>';

    expect(
      sanitizeDocumentUrls([
        'https://example.com/doc',
        'http://example.com/alt',
        relativeViewerUrl,
        arUrl,
        litUrl,
        legacyLitUrl,
        unsafeJavascriptUrl,
        unsafeDataUrl,
      ]),
    ).toEqual(['https://example.com/doc', 'http://example.com/alt', relativeViewerUrl, arUrl, litUrl, legacyLitUrl]);

    const allowedInstance = makeInstance();
    allowedInstance.state = {
      ...allowedInstance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      questions: [],
      documentURLs: ['https://safe.example/doc'],
      docURLInput: relativeViewerUrl,
    };

    allowedInstance.addDocumentURL();

    expect(allowedInstance.state.docURLError).toBe('');
    expect(allowedInstance.state.documentURLs).toEqual(['https://safe.example/doc', relativeViewerUrl]);
    const allowedAnchorHrefs = collectTreeNodes(allowedInstance.render(), (node) => node?.type === 'a')
      .map((node) => node?.props?.href)
      .filter(Boolean);
    expect(allowedAnchorHrefs).toContain(relativeViewerUrl);

    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      questions: [],
      documentURLs: ['https://safe.example/doc', arUrl, litUrl, legacyLitUrl, unsafeJavascriptUrl, unsafeDataUrl],
      docURLInput: unsafeJavascriptUrl,
    };

    instance.addDocumentURL();

    expect(instance.state.docURLError).toBe(
      'Document URLs must use http://, https://, a root-relative path (/...), ar://, or a supported Lit encrypted-doc URL.',
    );
    expect(instance.state.documentURLs).toEqual([
      'https://safe.example/doc',
      arUrl,
      litUrl,
      legacyLitUrl,
      unsafeJavascriptUrl,
      unsafeDataUrl,
    ]);

    const markup = renderToStaticMarkup(instance.render());
    expect(markup).toContain('href="https://safe.example/doc"');
    expect(markup).toContain(`href="${normalizeArweaveUrl(arUrl, { contextLabel: 'create_survey_document_url' })}"`);
    expect(markup).toContain(`Encrypted doc (${litUrl})`);
    expect(markup).toContain(`Encrypted doc (${legacyLitUrl})`);
    expect(markup).not.toContain(`href="${litUrl}"`);
    expect(markup).not.toContain(`href="${legacyLitUrl}"`);
    expect(markup).not.toContain(`href="${unsafeJavascriptUrl}"`);
    expect(markup).not.toContain('href="data:text/html');
  });

  it('coalesces cache update events and marks cache watch as loaded', () => {
    jest.useFakeTimers();
    let onUpdate: ((event: any) => void) | null = null;
    subscribeCacheUpdatesMock.mockImplementation((handler: (event: any) => void) => {
      onUpdate = handler;
      return () => {};
    });
    let reads = 0;
    peekCacheSyncMock.mockImplementation(() => {
      reads += 1;
      if (reads < 2) {
        return {
          '84532': {
            surveys: {},
          },
        };
      }
      return {
        '84532': {
          surveys: {
            '0xsurvey': { id: '0xsurvey' },
          },
        },
      };
    });

    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      surveyAddedSuccessfully: true,
      questionsAddedSuccessfully: false,
      lastSubmittedSurveyId: '0xSurvey',
      uploadedQuestions: [],
      cacheLoaded: false,
      submitStep: 2,
    };

    instance.startCacheWatch();
    expect(instance.state.cacheLoaded).toBe(false);
    expect(typeof onUpdate).toBe('function');

    const updateHandler = onUpdate as ((event: any) => void) | null;
    if (updateHandler) {
      updateHandler({ namespace: 'surveysCache', slug: 'edge', action: 'write' });
    }
    if (instance._cacheWatchCoalescer && typeof instance._cacheWatchCoalescer.flushNow === 'function') {
      instance._cacheWatchCoalescer.flushNow();
    } else {
      jest.advanceTimersByTime(20);
    }

    expect(instance.state.cacheLoaded).toBe(true);
    expect(instance.state.submitStep).toBe(3);
    expect(instance._cacheWatchTimer).toBeNull();
    jest.useRealTimers();
  });

  it('keeps polling fallback active when subscription events are absent', () => {
    jest.useFakeTimers();
    subscribeCacheUpdatesMock.mockImplementation(() => () => {});
    let reads = 0;
    peekCacheSyncMock.mockImplementation(() => {
      reads += 1;
      if (reads < 3) {
        return {
          '84532': {
            questions: {
              q1: { id: 'q1' },
            },
          },
        };
      }
      return {
        '84532': {
          questions: {
            q1: { id: 'q1' },
            q2: { id: 'q2' },
          },
        },
      };
    });

    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      surveyAddedSuccessfully: false,
      questionsAddedSuccessfully: true,
      uploadedQuestions: [{ questionId: 'q1' }, { questionId: 'q2' }],
      cacheLoaded: false,
      submitStep: 2,
    };

    instance.startCacheWatch();
    expect(instance.state.cacheLoaded).toBe(false);

    jest.advanceTimersByTime(2100);

    expect(instance.state.cacheLoaded).toBe(true);
    expect(instance.state.submitStep).toBe(3);
    jest.useRealTimers();
  });
});
