import {
  applyDraftHydrationEffects,
  applyLocalCacheRehydrateAppliedEffects,
  applyLocalCacheRehydrateMissEffects,
  applyLocalCacheRehydrateNoChangeEffects,
  applyLocalCacheRehydrateSuccessEffects,
  applyLocalCacheRehydrateUpdatePlan,
  applyPrefillStateEffects,
  applyPrefillUpdatePlan,
  applyPriorResponseFetchSuccessEffects,
  applyResetFormStateEffects,
  applyRevertPendingEffects,
  applyStartFreshEffects,
  buildGroupedRenderedResponseScopePlan,
  buildLocalCacheHydrationSignature,
  buildMissingRenderedResponseResult,
  buildMissingResponseIdsForRenderedQuestions,
  buildNormalizedRenderedQuestionIds,
  buildPriorResponseFetchPlan,
  buildQuestionSlugMapForIds,
  buildRevertedResponseSlice,
  buildSubmissionGroupContext,
  clearPriorResponseAttemptedKeys,
  executePriorResponseFetchPlan,
  loadGroupedMissingResponseRequests,
  loadMissingRenderedResponseInfo,
  loadMissingResponseIdsForScope,
  prepareLocalCacheSliceBuild,
  resolveLocalCacheHydrationSignatureLookup,
  resolveLocalCacheSliceLookup,
  resolveMissingRenderedResponseLookup,
  resolveQuestionSlugMapLookup,
  runPriorResponseBackfillAttempt,
  shouldBackfillPriorResponses,
  trackPriorResponseAttemptedKeys,
} from './surveyToolHydrationFlow.js';

describe('surveyToolHydrationResponseLookup', () => {
  it('decides when prior-response backfill is allowed', () => {
    expect(
      shouldBackfillPriorResponses({
        loginComplete: true,
        account: '0xabc',
        displayAnswerMode: false,
        viewAddress: '',
        singleQuestionMode: false,
        responderAddress: '',
        hasRefreshQuestionResponses: true,
        submissionComplete: false,
        isSubmitting: false,
      }),
    ).toBe(true);

    expect(
      shouldBackfillPriorResponses({
        loginComplete: true,
        account: '0xabc',
        displayAnswerMode: true,
        viewAddress: '0xdef',
        singleQuestionMode: false,
        responderAddress: '',
        hasRefreshQuestionResponses: true,
        submissionComplete: false,
        isSubmitting: false,
      }),
    ).toBe(false);

    expect(
      shouldBackfillPriorResponses({
        loginComplete: true,
        account: '0xabc',
        displayAnswerMode: false,
        viewAddress: '',
        singleQuestionMode: true,
        responderAddress: '0xdef',
        hasRefreshQuestionResponses: true,
        submissionComplete: false,
        isSubmitting: false,
      }),
    ).toBe(false);
  });

  it('builds grouped prior-response fetch plans without reusing attempted ids', () => {
    expect(
      buildPriorResponseFetchPlan({
        missingInfo: {
          requests: [
            { slug: 'alpha', missingIds: ['q1', 'q2'] },
            { slug: 'beta', missingIds: ['q3'] },
          ],
        },
        responderLower: '0xabc',
        attemptedKeys: new Set(['alpha|0xabc|q2']),
      }),
    ).toEqual({
      requestsToFetch: [
        { slug: 'alpha', idsToFetch: ['q1'] },
        { slug: 'beta', idsToFetch: ['q3'] },
      ],
      attemptedKeysToMark: ['alpha|0xabc|q1', 'beta|0xabc|q3'],
    });
  });

  it('tracks and clears attempted prior-response keys', () => {
    const attempted = new Set(['existing']);

    expect(
      trackPriorResponseAttemptedKeys({
        attemptedSet: attempted,
        attemptedKeysToMark: ['alpha|0xabc|q1', '', 'beta|0xabc|q2'],
      }),
    ).toEqual(['alpha|0xabc|q1', 'beta|0xabc|q2']);

    expect(Array.from(attempted)).toEqual(['existing', 'alpha|0xabc|q1', 'beta|0xabc|q2']);

    clearPriorResponseAttemptedKeys({
      attemptedSet: attempted,
      attemptedKeys: ['alpha|0xabc|q1', null],
    });

    expect(Array.from(attempted)).toEqual(['existing', 'beta|0xabc|q2']);
  });

  it('applies prior-response fetch success effects only when mounted and fetched', () => {
    const resetLocalCacheMemo = jest.fn();
    const triggerRehydrate = jest.fn();

    expect(
      applyPriorResponseFetchSuccessEffects({
        fetched: true,
        isMounted: true,
        resetLocalCacheMemo,
        triggerRehydrate,
      }),
    ).toBe(true);
    expect(resetLocalCacheMemo).toHaveBeenCalledTimes(1);
    expect(triggerRehydrate).toHaveBeenCalledTimes(1);

    resetLocalCacheMemo.mockClear();
    triggerRehydrate.mockClear();

    expect(
      applyPriorResponseFetchSuccessEffects({
        fetched: false,
        isMounted: true,
        resetLocalCacheMemo,
        triggerRehydrate,
      }),
    ).toBe(false);
    expect(resetLocalCacheMemo).not.toHaveBeenCalled();
    expect(triggerRehydrate).not.toHaveBeenCalled();
  });

  it('applies local-cache rehydrate miss, no-change, and success effects', () => {
    const clearHydrationSignature = jest.fn();
    const ensurePriorResponses = jest.fn();
    const callback = jest.fn();

    applyLocalCacheRehydrateMissEffects({
      clearHydrationSignature,
      ensurePriorResponses,
      callback,
    });
    expect(clearHydrationSignature).toHaveBeenCalledTimes(1);
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);

    ensurePriorResponses.mockClear();
    callback.mockClear();

    applyLocalCacheRehydrateNoChangeEffects({
      ensurePriorResponses,
      callback,
    });
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);

    const applyStateUpdates = jest.fn((updates, done) => {
      if (typeof done === 'function') done();
    });
    const afterStateApplied = jest.fn();

    expect(
      applyLocalCacheRehydrateSuccessEffects({
        updates: { surveysResponseState: [] },
        applyStateUpdates,
        afterStateApplied,
      }),
    ).toBe(true);
    expect(applyStateUpdates).toHaveBeenCalledWith({ surveysResponseState: [] }, expect.any(Function));
    expect(afterStateApplied).toHaveBeenCalledTimes(1);

    const functionalApplyStateUpdates = jest.fn((updater, done) => {
      if (typeof updater === 'function') {
        updater({ surveysResponseState: [], editBaseline: null, isDirty: false, submissionComplete: false });
      }
      if (typeof done === 'function') done();
    });
    afterStateApplied.mockClear();

    expect(
      applyLocalCacheRehydrateSuccessEffects({
        updates: (prev) => ({ surveysResponseState: prev.surveysResponseState }),
        applyStateUpdates: functionalApplyStateUpdates,
        afterStateApplied,
      }),
    ).toBe(true);
    expect(functionalApplyStateUpdates).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    expect(afterStateApplied).toHaveBeenCalledTimes(1);

    expect(
      applyLocalCacheRehydrateSuccessEffects({
        updates: null,
        applyStateUpdates,
        afterStateApplied,
      }),
    ).toBe(false);
  });

  it('applies prefill update plans and local-cache post-apply follow-up effects', () => {
    const applyStateUpdates = jest.fn((updates, done) => {
      if (typeof done === 'function') done();
    });
    const updateJsonPreview = jest.fn();
    const recalculateEditStats = jest.fn();
    const ensurePriorResponses = jest.fn();
    const callback = jest.fn();

    expect(
      applyPrefillUpdatePlan({
        updates: { surveysResponseState: [] },
        applyStateUpdates,
        updateJsonPreview,
        recalculateEditStats,
      }),
    ).toBe(true);
    expect(applyStateUpdates).toHaveBeenCalledWith({ surveysResponseState: [] }, expect.any(Function));
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);

    updateJsonPreview.mockClear();
    recalculateEditStats.mockClear();

    expect(
      applyPrefillUpdatePlan({
        updates: null,
        applyStateUpdates,
        updateJsonPreview,
        recalculateEditStats,
      }),
    ).toBe(false);
    expect(updateJsonPreview).not.toHaveBeenCalled();
    expect(recalculateEditStats).not.toHaveBeenCalled();

    applyPrefillStateEffects({
      updateJsonPreview,
      recalculateEditStats,
    });
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);

    updateJsonPreview.mockClear();
    recalculateEditStats.mockClear();

    applyLocalCacheRehydrateAppliedEffects({
      updateJsonPreview,
      recalculateEditStats,
      ensurePriorResponses,
      callback,
    });
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('applies local-cache rehydrate update plans for no-change and changed branches', () => {
    const applyStateUpdates = jest.fn((updates, done) => {
      if (typeof done === 'function') done();
    });
    const updateJsonPreview = jest.fn();
    const recalculateEditStats = jest.fn();
    const ensurePriorResponses = jest.fn();
    const callback = jest.fn();
    const onNoChange = jest.fn();

    expect(
      applyLocalCacheRehydrateUpdatePlan({
        changed: false,
        baselineChanged: false,
        updates: { surveysResponseState: [] },
        applyStateUpdates,
        updateJsonPreview,
        recalculateEditStats,
        ensurePriorResponses,
        callback,
        onNoChange,
      }),
    ).toBe(true);
    expect(onNoChange).toHaveBeenCalledTimes(1);
    expect(applyStateUpdates).not.toHaveBeenCalled();
    expect(updateJsonPreview).not.toHaveBeenCalled();
    expect(recalculateEditStats).not.toHaveBeenCalled();
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);

    onNoChange.mockClear();
    ensurePriorResponses.mockClear();
    callback.mockClear();

    expect(
      applyLocalCacheRehydrateUpdatePlan({
        changed: true,
        baselineChanged: false,
        updates: { surveysResponseState: [] },
        applyStateUpdates,
        updateJsonPreview,
        recalculateEditStats,
        ensurePriorResponses,
        callback,
        onNoChange,
      }),
    ).toBe(true);
    expect(onNoChange).not.toHaveBeenCalled();
    expect(applyStateUpdates).toHaveBeenCalledWith({ surveysResponseState: [] }, expect.any(Function));
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('applies reset, revert, and start-fresh follow-up effects', () => {
    const callback = jest.fn();
    const clearDraft = jest.fn();
    const recalculateEditStats = jest.fn();
    const updateJsonPreview = jest.fn();
    const clearDraftFor = jest.fn();
    const persistDraftSafely = jest.fn();

    applyResetFormStateEffects({ callback });
    expect(callback).toHaveBeenCalledTimes(1);

    applyRevertPendingEffects({
      clearDraft,
      recalculateEditStats,
      updateJsonPreview,
    });
    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);

    applyStartFreshEffects({
      renderedQuestionIds: ['q1', 'q2'],
      clearDraftFor,
      recalculateEditStats,
      persistDraftSafely,
    });
    expect(clearDraftFor).toHaveBeenNthCalledWith(1, 'q1');
    expect(clearDraftFor).toHaveBeenNthCalledWith(2, 'q2');
    expect(recalculateEditStats).toHaveBeenCalledTimes(2);
    expect(persistDraftSafely).toHaveBeenCalledWith(0);
  });

  it('applies draft hydration follow-up effects', () => {
    const updateJsonPreview = jest.fn();
    applyDraftHydrationEffects({ updateJsonPreview });
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
  });

  it('runs prior-response backfill attempts with injected loaders and effects', async () => {
    const loadMissingInfo = jest.fn().mockResolvedValue({
      missingIds: ['q1'],
      slug: 'edge',
      netId: '84532',
    });
    const setHydratingState = jest.fn();
    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const readQuestionsCacheAsync = jest.fn().mockResolvedValue(undefined);
    const resetLocalCacheMemo = jest.fn();
    const triggerRehydrate = jest.fn();
    const attemptedSet = new Set<string>();

    await expect(
      runPriorResponseBackfillAttempt({
        responderLower: '0xAbC',
        slug: 'edge',
        attemptedSet,
        loadMissingInfo,
        setHydratingState,
        isMounted: true,
        refreshQuestionResponses,
        readQuestionsCacheAsync,
        resetLocalCacheMemo,
        triggerRehydrate,
      }),
    ).resolves.toBe(true);

    expect(loadMissingInfo).toHaveBeenCalledWith({ responder: '0xabc', slug: 'edge' });
    expect(setHydratingState).toHaveBeenNthCalledWith(1, true);
    expect(setHydratingState).toHaveBeenNthCalledWith(2, false);
    expect(refreshQuestionResponses).toHaveBeenCalledWith(['q1'], {
      slug: 'edge',
      responder: '0xabc',
    });
    expect(resetLocalCacheMemo).toHaveBeenCalledTimes(1);
    expect(triggerRehydrate).toHaveBeenCalledTimes(1);
    expect(Array.from(attemptedSet)).toEqual(['edge|0xabc|q1']);
  });

  it('clears attempted keys when prior-response backfill fails', async () => {
    const onFailure = jest.fn();
    const attemptedSet = new Set<string>();

    await expect(
      runPriorResponseBackfillAttempt({
        responderLower: '0xabc',
        slug: 'edge',
        attemptedSet,
        loadMissingInfo: jest.fn().mockResolvedValue({
          missingIds: ['q1'],
          slug: 'edge',
          netId: '84532',
        }),
        setHydratingState: jest.fn(),
        isMounted: true,
        refreshQuestionResponses: jest.fn().mockRejectedValue(new Error('boom')),
        readQuestionsCacheAsync: jest.fn().mockResolvedValue(undefined),
        onFailure,
        resetLocalCacheMemo: jest.fn(),
        triggerRehydrate: jest.fn(),
      }),
    ).resolves.toBe(false);

    expect(Array.from(attemptedSet)).toEqual([]);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('executes grouped prior-response fetch plans in normalized order', async () => {
    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const readQuestionsCacheAsync = jest.fn().mockResolvedValue(undefined);

    await expect(
      executePriorResponseFetchPlan({
        requestsToFetch: [
          { slug: 'alpha', idsToFetch: ['Q1', 'q1'] },
          { slug: 'beta', idsToFetch: ['q2'] },
          { slug: '', idsToFetch: ['q3'] },
        ],
        responderLower: '0xAbC',
        refreshQuestionResponses,
        readQuestionsCacheAsync,
      }),
    ).resolves.toEqual({
      fetched: true,
      slug: 'beta',
    });

    expect(refreshQuestionResponses).toHaveBeenNthCalledWith(1, ['q1'], {
      slug: 'alpha',
      responder: '0xabc',
    });
    expect(refreshQuestionResponses).toHaveBeenNthCalledWith(2, ['q2'], {
      slug: 'beta',
      responder: '0xabc',
    });
    expect(readQuestionsCacheAsync).toHaveBeenNthCalledWith(1, 'alpha');
    expect(readQuestionsCacheAsync).toHaveBeenNthCalledWith(2, 'beta');
  });

  it('loads missing rendered response info for single-scope and grouped pile flows', async () => {
    const readQuestionsCacheAsync = jest.fn(async (slug) => {
      if (slug === 'edge') {
        return {
          '84532': {
            questionResponses: {
              q1: {
                '0xabc': {
                  answer: { value: 'present' },
                },
              },
            },
          },
        };
      }
      return {
        '84532': {
          questionResponses: {},
        },
      };
    });
    const ensureQuestionsNet = jest.fn((cache) => cache);

    await expect(
      loadMissingRenderedResponseInfo({
        renderedIds: ['q1', 'q2'],
        slug: 'edge',
        netId: '84532',
        responderLower: '0xabc',
        shouldGroupByScope: false,
        readQuestionsCacheAsync,
        ensureQuestionsNet,
      }),
    ).resolves.toEqual({
      missingIds: ['q2'],
      slug: 'edge',
      netId: '84532',
      requests: [],
    });

    await expect(
      loadMissingRenderedResponseInfo({
        renderedIds: ['q1', 'q2'],
        slug: 'edge',
        netId: '84532',
        responderLower: '0xabc',
        shouldGroupByScope: true,
        slugByQuestionId: new Map([
          ['q1', 'alpha'],
          ['q2', 'beta'],
        ]),
        resolveScopeNetId: (_slug, entryNetId) => entryNetId,
        readQuestionsCacheAsync,
        ensureQuestionsNet,
      }),
    ).resolves.toEqual({
      missingIds: [],
      slug: 'edge',
      netId: '84532',
      requests: [
        { slug: 'alpha', netId: '84532', missingIds: ['q1'] },
        { slug: 'beta', netId: '84532', missingIds: ['q2'] },
      ],
    });
  });

  it('resolves missing rendered response lookup contexts before loading cache data', async () => {
    const readQuestionsCacheAsync = jest.fn(async () => ({
      '84532': {
        questionResponses: {},
      },
    }));
    const ensureQuestionsNet = jest.fn((cache) => cache);
    const resolveResponseHydrationContext = jest.fn((rawSlug) => ({
      sessionSlug: rawSlug,
      networkIdStr: '84532',
    }));
    const normalizeSessionSlugValue = jest.fn((value) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    );
    const getExtraScopeSlugs = jest.fn(() => ['alpha']);
    const resolveQuestionSlugMapForIds = jest.fn(
      () =>
        new Map([
          ['q1', 'alpha'],
          ['q2', 'beta'],
        ]),
    );

    await expect(
      resolveMissingRenderedResponseLookup({
        responderLower: '0xAbC',
        rawSlug: 'EDGE',
        fallbackSlug: 'edge',
        renderedIds: ['q1', 'Q2'],
        minifiedMode: 'pile',
        surveyId: 'survey-1',
        resolveResponseHydrationContext,
        normalizeSessionSlugValue,
        getExtraScopeSlugs,
        resolveQuestionSlugMapForIds,
        resolveScopeNetId: (_resolvedSlug, entryNetId, fallbackNetId) => entryNetId || fallbackNetId,
        readQuestionsCacheAsync,
        ensureQuestionsNet,
      }),
    ).resolves.toEqual({
      missingIds: [],
      slug: 'edge',
      netId: '84532',
      requests: [
        { slug: 'alpha', netId: '84532', missingIds: ['q1'] },
        { slug: 'beta', netId: '84532', missingIds: ['q2'] },
      ],
    });

    expect(resolveQuestionSlugMapForIds).toHaveBeenCalledWith(['q1', 'q2'], { surveyId: 'survey-1' });
  });

  it('loads missing response ids for a single scope from cache state', async () => {
    const readQuestionsCacheAsync = jest.fn().mockResolvedValue({
      '84532': {
        questionResponses: {
          q1: { '0xabc': { answer: { value: 'present' } } },
          q2: {},
        },
      },
    });
    const ensureQuestionsNet = jest.fn((cache) => cache);

    await expect(
      loadMissingResponseIdsForScope({
        slug: 'alpha',
        netId: '84532',
        renderedIds: ['q1', 'q2', 'q3'],
        responderLower: '0xAbC',
        readQuestionsCacheAsync,
        ensureQuestionsNet,
      }),
    ).resolves.toEqual(['q2', 'q3']);
  });

  it('loads grouped missing-response requests from scoped caches', async () => {
    const readQuestionsCacheAsync = jest.fn(async (slug) => {
      if (slug === 'alpha') {
        return {
          '84532': {
            questionResponses: {
              q1: { '0xabc': { answer: { value: 'present' } } },
              q2: {},
            },
          },
        };
      }
      if (slug === 'beta') {
        return {
          '84532': {
            questionResponses: {
              q3: {},
            },
          },
        };
      }
      return {};
    });
    const ensureQuestionsNet = jest.fn((cache) => cache);

    await expect(
      loadGroupedMissingResponseRequests({
        scopePlan: [
          { slug: 'alpha', netId: '84532', questionIds: ['q1', 'q2'] },
          { slug: 'alpha', netId: '84532', questionIds: ['q2'] },
          { slug: 'beta', netId: '84532', questionIds: ['q3'] },
        ],
        fallbackNetId: '11155420',
        responderLower: '0xAbC',
        resolveScopeNetId: (slug, entryNetId) => (slug === 'beta' ? '84532' : entryNetId),
        readQuestionsCacheAsync,
        ensureQuestionsNet,
      }),
    ).resolves.toEqual([
      { slug: 'alpha', netId: '84532', missingIds: ['q2'] },
      { slug: 'alpha', netId: '84532', missingIds: ['q2'] },
      { slug: 'beta', netId: '84532', missingIds: ['q3'] },
    ]);

    expect(readQuestionsCacheAsync).toHaveBeenCalledTimes(2);
    expect(readQuestionsCacheAsync).toHaveBeenNthCalledWith(1, 'alpha');
    expect(readQuestionsCacheAsync).toHaveBeenNthCalledWith(2, 'beta');
  });

  it('builds grouped rendered-response scope plans by slug and network', () => {
    expect(
      buildGroupedRenderedResponseScopePlan({
        renderedIds: ['q1', 'q2', 'q3'],
        slugByQuestionId: new Map([
          ['q1', 'alpha'],
          ['q2', 'alpha'],
          ['q3', 'beta'],
        ]),
        fallbackSlug: 'edge',
        fallbackNetId: '84532',
      }),
    ).toEqual([
      { slug: 'alpha', netId: '84532', questionIds: ['q1', 'q2'] },
      { slug: 'beta', netId: '84532', questionIds: ['q3'] },
    ]);
  });

  it('builds missing response ids for rendered questions from cached responses', () => {
    expect(
      buildMissingResponseIdsForRenderedQuestions({
        renderedIds: ['q1', 'q2', 'q3'],
        questionResponses: {
          q1: { '0xabc': { answer: { value: 'present' } } },
          q2: {},
        },
        responderLower: '0xabc',
      }),
    ).toEqual(['q2', 'q3']);
  });

  it('builds normalized missing-response results from grouped scope requests', () => {
    expect(
      buildMissingRenderedResponseResult({
        requests: [
          { slug: 'alpha', netId: '84532', missingIds: ['Q1', 'q1'] },
          { slug: 'beta', netId: '84532', missingIds: [] },
        ],
        fallbackSlug: 'edge',
        fallbackNetId: '11155420',
      }),
    ).toEqual({
      slug: 'alpha',
      netId: '84532',
      missingIds: ['q1'],
      requests: [{ slug: 'alpha', netId: '84532', missingIds: ['q1'] }],
    });

    expect(
      buildMissingRenderedResponseResult({
        requests: [
          { slug: 'alpha', netId: '84532', missingIds: ['q1'] },
          { slug: 'beta', netId: '84532', missingIds: ['q2'] },
        ],
        fallbackSlug: 'edge',
        fallbackNetId: '11155420',
      }),
    ).toEqual({
      slug: 'edge',
      netId: '11155420',
      missingIds: [],
      requests: [
        { slug: 'alpha', netId: '84532', missingIds: ['q1'] },
        { slug: 'beta', netId: '84532', missingIds: ['q2'] },
      ],
    });
  });

  it('normalizes rendered question ids for hydration', () => {
    expect(
      buildNormalizedRenderedQuestionIds({
        renderedIds: ['Q1', 'q1', null, 'q2', '', undefined, 'Q2'],
      }),
    ).toEqual(['q1', 'q2']);
  });

  it('builds question slug maps for normalized rendered ids', () => {
    expect(
      buildQuestionSlugMapForIds({
        questionIds: ['Q1', 'q2', 'q1', null],
        poolQuestions: [
          { id: 'q1', sessionSlug: 'Edge' },
          { id: 'q2', sessionSlug: 'alpha' },
        ],
        normalizeSlug: (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
        resolveQuestionSlug: ({ questionId, question }) => {
          const questionRecord = question && typeof question === 'object' ? (question as Record<string, unknown>) : {};
          return questionRecord.sessionSlug || `fallback-${questionId}`;
        },
      }),
    ).toEqual(
      new Map([
        ['q1', 'edge'],
        ['q2', 'alpha'],
      ]),
    );
  });

  it('resolves question slug map lookups from question pools, session names, and fallback ids', () => {
    expect(
      resolveQuestionSlugMapLookup({
        questionIds: ['Q1', 'q2', 'q3'],
        questionPool: [{ id: 'q1', sessionSlug: 'Edge' }],
        pileQuestions: [{ id: 'q2', sessionName: 'Alpha Session' }],
        surveyId: undefined,
        singleQuestionMode: false,
        propsSurveyId: 'survey-1',
        props: { activeSessionSlug: 'edge' },
        network: { id: 84532 },
        normalizeSlug: (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
        getSessionSlugByName: (sessionName) => (sessionName === 'Alpha Session' ? 'Alpha' : null),
        resolveSlugForIds: ({ questionId, surveyId }) => `${surveyId}:${questionId}`,
      }),
    ).toEqual(
      new Map([
        ['q1', 'edge'],
        ['q2', 'alpha'],
        ['q3', 'survey-1:q3'],
      ]),
    );
  });

  it('builds submission group contexts from slug-mapped questions', () => {
    expect(
      buildSubmissionGroupContext({
        questionIds: ['Q1', 'q2', 'q1'],
        slugByQuestionId: new Map([
          ['q1', 'Edge'],
          ['q2', 'Edge'],
        ]),
        fallbackSlug: 'general',
        normalizeSlug: (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
      }),
    ).toEqual({
      ok: true,
      submissionGroupKey: 'edge',
      sessionSlugs: ['edge'],
      slugByQuestionId: new Map([
        ['q1', 'edge'],
        ['q2', 'edge'],
      ]),
    });

    expect(
      buildSubmissionGroupContext({
        questionIds: ['q1', 'q2'],
        slugByQuestionId: new Map([['q1', '']]),
        fallbackSlug: 'demo-1',
        normalizeSlug: (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
      }),
    ).toEqual({
      ok: true,
      submissionGroupKey: 'demo-1',
      sessionSlugs: ['demo-1'],
      slugByQuestionId: new Map([
        ['q1', 'demo-1'],
        ['q2', 'demo-1'],
      ]),
    });

    expect(
      buildSubmissionGroupContext({
        questionIds: ['q1', 'q2'],
        slugByQuestionId: new Map([
          ['q1', 'alpha'],
          ['q2', ''],
        ]),
        fallbackSlug: 'edge',
        normalizeSlug: (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
      }),
    ).toEqual({
      ok: false,
      submissionGroupKey: '',
      sessionSlugs: ['alpha', 'edge'],
      slugByQuestionId: new Map([
        ['q1', 'alpha'],
        ['q2', 'edge'],
      ]),
      error:
        'Cannot submit responses from multiple sessions at once. Narrow the question view to one session and try again.',
    });

    expect(
      buildSubmissionGroupContext({
        questionIds: ['q1', 'q2'],
        slugByQuestionId: new Map([
          ['q1', 'alpha'],
          ['q2', 'beta'],
        ]),
        fallbackSlug: 'general',
        normalizeSlug: (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
      }),
    ).toEqual({
      ok: false,
      submissionGroupKey: '',
      sessionSlugs: ['alpha', 'beta'],
      slugByQuestionId: new Map([
        ['q1', 'alpha'],
        ['q2', 'beta'],
      ]),
      error:
        'Cannot submit responses from multiple sessions at once. Narrow the question view to one session and try again.',
    });
  });

  it('builds local-cache hydration signatures from normalized state inputs', () => {
    expect(
      buildLocalCacheHydrationSignature({
        surveyIndex: 2,
        scopeSlugs: ['edge', 'alpha'],
        networkIdStr: '84532',
        account: '0xAbC',
        renderedIds: ['q2', 'q1'],
        questionsCacheNonce: 4,
        questionResponsesNonce: 7,
        suppressPrefill: true,
        submissionError: 'boom',
        submissionComplete: false,
      }),
    ).toBe('2|edge,alpha|84532|0xabc|q2|q1|4|7|1|1|0');
  });

  it('resolves local-cache hydration signatures from hydration context and pile scopes', () => {
    const resolveResponseHydrationContext = jest.fn((rawSlug) => ({
      sessionSlug: rawSlug,
      networkIdStr: '84532',
    }));
    const normalizeSessionSlugValue = jest.fn((value) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    );
    const getExtraScopeSlugs = jest.fn(() => ['alpha']);

    expect(
      resolveLocalCacheHydrationSignatureLookup({
        surveyIndex: 2,
        renderedIds: ['q2', 'q1'],
        rawSlug: 'EDGE',
        account: '0xAbC',
        minifiedMode: 'pile',
        questionsCacheNonce: 4,
        questionResponsesNonce: 7,
        suppressPrefill: true,
        submissionError: 'boom',
        submissionComplete: false,
        resolveResponseHydrationContext,
        normalizeSessionSlugValue,
        getExtraScopeSlugs,
      }),
    ).toBe('2|edge,alpha|84532|0xabc|q2|q1|4|7|1|1|0');

    expect(resolveResponseHydrationContext).toHaveBeenCalledWith('EDGE');
    expect(normalizeSessionSlugValue).toHaveBeenCalledWith('EDGE');
    expect(getExtraScopeSlugs).toHaveBeenCalledWith('edge');
  });

  it('prepares local-cache slice builds with memo reuse and normalized account state', () => {
    expect(
      prepareLocalCacheSliceBuild({
        scopeSlugs: ['Edge', 'alpha'],
        networkIdStr: '84532',
        account: '0xAbC',
        renderedIds: ['q2', 'q1'],
        questionsCacheNonce: 4,
        questionResponsesNonce: 7,
        existingMemo: {
          key: '84532|mismatch',
          value: { stale: true },
          hasValue: true,
        },
        normalizeSessionSlugValue: (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
      }),
    ).toEqual({
      renderedIds: ['q2', 'q1'],
      normalizedAccount: '0xabc',
      memoKey: 'edge,alpha|84532|0xabc|q2|q1|4|7',
      shouldUseMemo: false,
      memoizedValue: null,
    });

    expect(
      prepareLocalCacheSliceBuild({
        scopeSlugs: ['Edge', 'alpha'],
        networkIdStr: '84532',
        account: '0xAbC',
        renderedIds: ['q2', 'q1'],
        questionsCacheNonce: 4,
        questionResponsesNonce: 7,
        existingMemo: {
          key: 'edge,alpha|84532|0xabc|q2|q1|4|7',
          value: { cached: true },
          hasValue: true,
        },
        normalizeSessionSlugValue: (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
      }),
    ).toEqual({
      renderedIds: ['q2', 'q1'],
      normalizedAccount: '0xabc',
      memoKey: 'edge,alpha|84532|0xabc|q2|q1|4|7',
      shouldUseMemo: true,
      memoizedValue: { cached: true },
    });
  });

  it('resolves local-cache slice lookup context before memo preparation', () => {
    const resolveResponseHydrationContext = jest.fn((rawSlug) => ({
      sessionSlug: rawSlug,
      networkIdStr: '84532',
    }));
    const normalizeSessionSlugValue = jest.fn((value) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    );
    const getExtraScopeSlugs = jest.fn(() => ['alpha']);

    expect(
      resolveLocalCacheSliceLookup({
        rawSlug: 'EDGE',
        account: '0xAbC',
        renderedIds: ['q2', 'q1'],
        minifiedMode: 'pile',
        questionsCacheNonce: 4,
        questionResponsesNonce: 7,
        existingMemo: {
          key: '84532|mismatch',
          value: { stale: true },
          hasValue: true,
        },
        resolveResponseHydrationContext,
        normalizeSessionSlugValue,
        getExtraScopeSlugs,
      }),
    ).toEqual({
      scopeSlugs: ['edge', 'alpha'],
      networkIdStr: '84532',
      renderedIds: ['q2', 'q1'],
      normalizedAccount: '0xabc',
      memoKey: 'edge,alpha|84532|0xabc|q2|q1|4|7',
      shouldUseMemo: false,
      memoizedValue: null,
    });
  });

  it('builds reverted response slices from baseline state plus rendered empty shells', () => {
    const cloneFieldState = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    const buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      encrypted: false,
      questionId,
      fieldKey,
    }));

    expect(
      buildRevertedResponseSlice({
        baselineSlice: {
          answers: { q1: { value: 'saved answer' } },
          importance: { q1: 4 },
          conviction: { q1: 7 },
          additionalComments: { q1: { value: 'saved notes' } },
        },
        renderedQuestionIds: ['Q1', 'q2'],
        cloneFieldState,
        buildEmptyResponseFieldState,
      }),
    ).toEqual({
      answers: {
        q1: { value: 'saved answer' },
        q2: { value: '', encrypted: false, questionId: 'q2', fieldKey: 'answer' },
      },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: {
        q1: { value: 'saved notes' },
        q2: { value: '', encrypted: false, questionId: 'q2', fieldKey: 'additional' },
      },
    });

    expect(cloneFieldState).toHaveBeenCalledTimes(2);
    expect(buildEmptyResponseFieldState).toHaveBeenCalledTimes(2);
  });
});
