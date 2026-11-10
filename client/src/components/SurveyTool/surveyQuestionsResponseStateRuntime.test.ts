import * as workerHydration from '../../utilities/survey/workerResponseHydration';
import { buildSurveyLocalCacheSlice, executeSurveyLocalCacheRehydrate } from './surveyToolHydrationController';
import { buildDraftAwareCacheHydrationState } from './surveyToolUtils';
import { createSurveyQuestionsResponseStateRuntime } from './surveyQuestionsResponseStateRuntime';
import type { SurveyQuestionsProps, SurveyQuestionsState } from './surveyQuestionsTypes';

jest.mock('./surveyToolHydrationController', () => ({
  ...jest.requireActual<typeof import('./surveyToolHydrationController')>('./surveyToolHydrationController'),
  buildSurveyLocalCacheSlice: jest.fn(),
  executeSurveyLocalCacheRehydrate: jest.fn(),
}));
jest.mock('./surveyToolUtils', () => ({
  ...jest.requireActual<typeof import('./surveyToolUtils')>('./surveyToolUtils'),
  buildDraftAnswersByQuestionId: jest.fn(() => ({})),
  buildDraftAwareCacheHydrationState: jest.fn(),
}));

const cachedSlice = { answers: { q1: { value: 'cached' } } };

beforeEach(() => {
  jest.mocked(buildSurveyLocalCacheSlice).mockImplementation(({ setLocalCacheMemo }: any) => {
    setLocalCacheMemo({ hasValue: true, key: 'edge:q1', value: cachedSlice });
    return cachedSlice;
  });
  jest.mocked(buildDraftAwareCacheHydrationState).mockImplementation((args: any) => args);
});

const createDeps = ({
  loadDraft = jest.fn((): unknown => null),
  hydrationIds = ['q1'],
  props = { isStandalone: false, surveyIndex: 0 } as SurveyQuestionsProps,
} = {}) => ({
  inst: {
    _applyCachedResponseEntryToSlice: jest.fn(() => false),
    _applyDraftHydrationEntryToSlice: jest.fn((_args: any) => false),
    _applyLocalCacheHydrationEntryToSlice: jest.fn((_args: any) => false),
    _applyResponseHydrationListToSlice: jest.fn(() => false),
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
    _hasMounted: false,
    _isMounted: true,
    _localCacheRehydrateRunId: 0,
    _localCacheSliceMemo: { hasValue: false, key: '', value: null },
    _persistTimer: null,
    _rehydrateLocalCacheLastSig: '',
    _savedAnswersLoadedQids: new Set<string>(),
    _userAnswersSliceCache: { source: null, value: null },
    _viewAllSync: null as { restored: Set<string> } | null,
  },
  propsRef: { current: props },
  stateRef: {
    current: {
      editBaseline: { answers: {} },
      surveysResponseState: [{ answers: {} }],
      userAnswers: {},
    } as unknown as SurveyQuestionsState,
  },
  setState: jest.fn(),
  setResponseHydrationState: jest.fn(),
  drafts: { load: loadDraft, persist: jest.fn(), clear: jest.fn() },
  questionIds: {
    rendered: jest.fn(() => ['q1']),
    editTracking: jest.fn(() => new Set<string>()),
    hydration: jest.fn(() => hydrationIds),
  },
  getQuestionById: jest.fn(() => ({ type: 'rating' })),
  buildEmptyResponseFieldState: jest.fn(() => ({})),
  buildLocalCacheHydrationSignature: jest.fn(() => 'sig'),
  ensurePriorResponsesForRenderedIds: jest.fn(async () => undefined),
  initializeSurveyResponseState: jest.fn((): unknown[] => []),
  recalculateEditStats: jest.fn(),
  updateJsonPreview: jest.fn(),
});

describe('surveyQuestionsResponseStateRuntime', () => {
  it('preserves value equality semantics for empty, numeric, and array answers', () => {
    const runtime = createSurveyQuestionsResponseStateRuntime(createDeps());

    expect(runtime.valuesEqual('', null)).toBe(true);
    for (const empty of ['', null, undefined]) {
      expect(runtime.valuesEqual(empty, 0)).toBe(false);
      expect(runtime.valuesEqual(0, empty)).toBe(false);
    }
    expect(runtime.valuesEqual('0', 0, 'q1')).toBe(true);
    expect(runtime.valuesEqual('4', 4, 'q1')).toBe(true);
    expect(runtime.valuesEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(runtime.valuesEqual(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('builds local-cache slices with rendered ids and memo updates', () => {
    const deps = createDeps();
    const runtime = createSurveyQuestionsResponseStateRuntime(deps);

    expect(runtime.buildSliceFromLocalCache()).toEqual(cachedSlice);
    expect(buildSurveyLocalCacheSlice).toHaveBeenCalledWith(
      expect.objectContaining({
        rawSlug: 'edge',
        renderedIds: ['q1'],
      }),
    );
    expect(deps.inst._localCacheSliceMemo).toEqual({ hasValue: true, key: 'edge:q1', value: cachedSlice });
  });

  // View all: the cache holds a saved answer for q1, the draft a comment typed in the pile.
  const viewAllDeps = (state: Record<string, unknown> = {}) => {
    jest
      .mocked(buildDraftAwareCacheHydrationState)
      .mockImplementation(
        ({ cachedAnswer, cachedAdditional }: any) =>
          ({ effectiveAnswerState: cachedAnswer, effectiveAdditionalState: cachedAdditional }) as any,
      );
    const deps = createDeps({
      loadDraft: jest.fn(() => ({ answers: { q1: { additional: 'Draft comment' } }, baseline: {} })),
      props: { isStandalone: true, isResponsesCacheReady: true, sessionConfig: null } as SurveyQuestionsProps,
    });
    deps.inst._viewAllSync = { restored: new Set<string>() };
    // Minimal appliers: saved answers fill empty fields; the draft writes its comment.
    deps.inst._applyLocalCacheHydrationEntryToSlice = jest.fn(({ targetSlice, questionId, cachedAnswer }: any) => {
      if (!cachedAnswer || targetSlice.answers[questionId]?.value) return false;
      targetSlice.answers[questionId] = { ...targetSlice.answers[questionId], ...cachedAnswer };
      return true;
    });
    deps.inst._applyDraftHydrationEntryToSlice = jest.fn(({ targetSlice, questionId, draftEntry }: any) => {
      targetSlice.additionalComments[questionId] = { value: draftEntry.additional };
      return true;
    });
    Object.assign(deps.stateRef.current, {
      editBaseline: { answers: {}, additionalComments: {} },
      surveysResponseState: [{ answers: { q1: { value: '' } }, additionalComments: { q1: { value: '' } } }],
      ...state,
    });
    return deps;
  };
  const applySync = (deps: ReturnType<typeof viewAllDeps>) => {
    const [update] = deps.setResponseHydrationState.mock.calls.at(-1) as [(prev: unknown) => any];
    return update(deps.stateRef.current);
  };

  it('loads a question new to View all and restores its draft over it, even after a Submit', () => {
    const deps = viewAllDeps({ submissionComplete: true });

    createSurveyQuestionsResponseStateRuntime(deps).syncViewAllQuestions();

    const next = applySync(deps);
    expect(next.surveysResponseState[0].answers.q1.value).toBe('cached');
    expect(next.surveysResponseState[0].additionalComments.q1.value).toBe('Draft comment');
    expect(next.editBaseline.answers.q1.value).toBe('cached');
    expect([...deps.inst._savedAnswersLoadedQids]).toEqual(['q1']);
    expect([...deps.inst._viewAllSync!.restored]).toEqual(['q1']);
  });

  it('leaves loaded questions alone while a Submit result holds the form, and forgets questions that left', () => {
    const deps = viewAllDeps({ submissionComplete: true });
    deps.inst._savedAnswersLoadedQids = new Set(['q1', 'q9']);
    deps.inst._viewAllSync = { restored: new Set(['q1', 'q9']) };

    createSurveyQuestionsResponseStateRuntime(deps).syncViewAllQuestions();

    expect(deps.setResponseHydrationState).not.toHaveBeenCalled();
    expect([...deps.inst._savedAnswersLoadedQids]).toEqual(['q1']);
    expect([...deps.inst._viewAllSync!.restored]).toEqual(['q1']);
  });

  it('counts saved answers as loaded only once the Worker listing has loaded', () => {
    jest.spyOn(workerHydration, 'isWorkerCanonicalSessionConfig').mockReturnValue(true);
    const deps = viewAllDeps();
    const props = deps.propsRef.current as Record<string, unknown>;
    props.isResponsesCacheReady = false;
    const runtime = createSurveyQuestionsResponseStateRuntime(deps);

    runtime.syncViewAllQuestions();
    expect([...deps.inst._savedAnswersLoadedQids]).toEqual([]);
    expect([...deps.inst._viewAllSync!.restored]).toEqual(['q1']);

    // Once the listing is complete, a held form still gets the saved answers it never loaded.
    props.isResponsesCacheReady = true;
    (deps.stateRef.current as Record<string, unknown>).suppressPrefill = true;
    runtime.syncViewAllQuestions();
    expect(applySync(deps).surveysResponseState[0].answers.q1.value).toBe('cached');
    expect([...deps.inst._savedAnswersLoadedQids]).toEqual(['q1']);
  });

  it('loads saved answers but restores no draft while the form starts fresh', () => {
    const deps = viewAllDeps({ startFresh: true });

    createSurveyQuestionsResponseStateRuntime(deps).syncViewAllQuestions();

    const next = applySync(deps);
    expect(next.surveysResponseState[0].answers.q1.value).toBe('cached');
    expect(next.surveysResponseState[0].additionalComments.q1.value).toBe('');
    expect([...deps.inst._viewAllSync!.restored]).toEqual([]);
  });

  it('loads only questions this view has not loaded while a Submit result holds the form', async () => {
    let seenAtRun: Record<string, unknown> = {};
    jest.mocked(executeSurveyLocalCacheRehydrate).mockImplementation(async (run: any) => {
      seenAtRun = {
        ids: run.getHydrationQuestionIds(),
        q1Loaded: run.isQuestionLoaded('Q1'),
        q2Loaded: run.isQuestionLoaded('q2'),
      };
      return { reason: 'applied', renderedQuestionIds: ['q2'] } as any;
    });
    const deps = createDeps({
      loadDraft: jest.fn(() => ({ answers: { q2: { value: 'Draft' }, q9: { value: 'Not in view' } } })),
      props: { isStandalone: true, isResponsesCacheReady: true, sessionConfig: null } as SurveyQuestionsProps,
    });
    Object.assign(deps.stateRef.current, { pileQuestions: [{ id: 'q1' }, { id: 'q2' }], submissionComplete: true });
    deps.inst._savedAnswersLoadedQids = new Set(['q1']);

    await createSurveyQuestionsResponseStateRuntime(deps).rehydrateLocalCacheAnswersForRenderedIds();

    // A stored draft for a question of this view, outside the rendered window, loads with it.
    expect(seenAtRun).toEqual({ ids: ['q1', 'q2'], q1Loaded: true, q2Loaded: false });
    expect([...deps.inst._savedAnswersLoadedQids]).toEqual(['q1', 'q2']);
  });
});
