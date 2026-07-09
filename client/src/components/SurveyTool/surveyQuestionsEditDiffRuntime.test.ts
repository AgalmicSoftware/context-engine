import { createSurveyQuestionsEditDiffRuntime } from './surveyQuestionsEditDiffRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const normalizeQuestionIdKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  areSurveyResponsesConsistent: jest.fn(() => true),
  buildIndexedQuestionEntryKeys: jest.fn((source) => ({
    source,
    byId: new Map([['q1', 'Q1']]),
  })),
  buildRatingEnvelopeQidSetFromUserAnswers: jest.fn(() => new Set<string>()),
  buildSliceFromUserAnswers: jest.fn(() => ({ answers: {} })),
  buildSurveyResponseSliceSignature: jest.fn(() => 'slice-sig'),
  bumpSurveyPerfCounter: jest.fn(),
  getActiveSurveyIndex: jest.fn((value) => value ?? 0),
  getCurrentRenderedQuestionIds: jest.fn(() => ['Rendered-Q']),
  getDefaultResponseEncryptionAudience: jest.fn(() => ({ mode: 'public' })),
  getDefaultResponseEncryptionAudienceForQid: jest.fn((qid) => ({ mode: 'question', qid })),
  hasMeaningfulFieldValue: jest.fn(() => true),
  inst: {
    _changedQidsAndFieldsCache: null,
    _normalizedQuestionEntryKeyCache: new WeakMap<object, unknown>(),
    _pendingEditStatsCache: { count: 1 },
  },
  measureSync: jest.fn((_label, callback) => callback()),
  normalizeFieldAudienceMode: jest.fn((mode) => mode || 'default'),
  normalizeQuestionIdKey: jest.fn(normalizeQuestionIdKey),
  normalizeResponseEncryptionAudience: jest.fn((audience, qid) => ({ audience, qid })),
  orchestrateGetChangedQidsAndFields: jest.fn(() => ({
    result: {
      changedMap: { q1: ['answer'] },
      changedQids: ['q1'],
    },
    newCache: { signature: 'next' },
  })),
  propsRef: {
    current: {
      account: '0xabc',
      loginComplete: true,
      questionID: 'Single-Q',
      questionPool: [{ id: 'Fallback-Prop' }],
      singleQuestionMode: true,
    },
  },
  resolveDiffBaselineSlice: jest.fn(() => ({ answers: {} })),
  resolveFieldEncryptionGateId: jest.fn((_field, qid, fieldKey) => `${qid}:${fieldKey}`),
  stateRef: {
    current: {
      editBaseline: { answers: {} },
      isLoadingResponse: false,
      pileQuestions: [{ id: 'Fallback-Pile' }],
      questionPool: [{ id: 'Fallback-State' }],
      surveysResponseState: [
        {
          additionalComments: { Q2: { value: 'more' } },
          answers: { ' Q1 ': { value: 'answer' } },
          conviction: { Q4: 5 },
          importance: { Q3: 4 },
        },
      ],
      userAnswers: { responses: [] },
    },
  },
  surveyLog: {
    warn: jest.fn(),
  },
  valuesEqual: jest.fn((a, b) => a === b),
  ...overrides,
});

describe('surveyQuestionsEditDiffRuntime', () => {
  it('builds edit tracking ids from response slices, single-question props, and rendered scope', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsEditDiffRuntime(context);

    expect([...runtime.getEditTrackingQuestionIds()]).toEqual(['q1', 'q2', 'q3', 'q4', 'single-q', 'rendered-q']);
  });

  it('delegates changed-field orchestration with scoped ids and updates diff caches', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsEditDiffRuntime(context);
    const source = { Q1: { value: 'answer' } };

    expect(runtime.getChangedQidsAndFields(0)).toEqual({
      changedMap: { q1: ['answer'] },
      changedQids: ['q1'],
    });

    expect(context.measureSync).toHaveBeenCalledWith(
      'ce.surveyQuestions.getChangedQidsAndFields',
      expect.any(Function),
    );
    const [inputs, helpers, previousCache] = context.orchestrateGetChangedQidsAndFields.mock.calls[0];
    expect(previousCache).toBeNull();
    expect(inputs).toEqual(
      expect.objectContaining({
        currentSlice: context.stateRef.current.surveysResponseState[0],
        isLoadingResponse: false,
        isLoggedIn: true,
        surveyIndex: 0,
        userAnswers: context.stateRef.current.userAnswers,
      }),
    );
    expect([...inputs.scopedIds]).toEqual(['q1', 'q2', 'q3', 'q4', 'single-q', 'rendered-q']);
    expect(helpers.getIndexedQuestionEntryKeys(source)).toBe(helpers.getIndexedQuestionEntryKeys(source));
    expect(context.buildIndexedQuestionEntryKeys).toHaveBeenCalledTimes(1);
    expect(helpers.getDefaultResponseEncryptionAudience()).toEqual({ mode: 'public' });
    expect(helpers.getDefaultResponseEncryptionAudienceForQid('q1')).toEqual({ mode: 'question', qid: 'q1' });
    expect(helpers.normalizeResponseEncryptionAudience('audience', 'q1')).toEqual({
      audience: 'audience',
      qid: 'q1',
    });
    expect(helpers.resolveFieldEncryptionGateId({ value: 'x' }, 'q1', 'answer')).toBe('q1:answer');
    expect(helpers.normalizeFieldAudienceMode('', 'answer', { value: 'x' })).toBe('default');
    expect(helpers.resolveDiffBaselineSlice(true)).toEqual({ answers: {} });
    expect(helpers.valuesEqual).toBe(context.valuesEqual);
    expect(helpers.buildSurveyResponseSliceSignature).toBe(context.buildSurveyResponseSliceSignature);
    expect(helpers.buildRatingEnvelopeQidSetFromUserAnswers).toBe(context.buildRatingEnvelopeQidSetFromUserAnswers);
    expect(helpers.hasMeaningfulFieldValue).toBe(context.hasMeaningfulFieldValue);
    expect(helpers.bumpPerfCounter).toBe(context.bumpSurveyPerfCounter);
    expect(context.inst._changedQidsAndFieldsCache).toEqual({ signature: 'next' });
    expect(context.inst._pendingEditStatsCache).toBeNull();
  });

  it('checks response consistency against the current baseline and rendered ids', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsEditDiffRuntime(context);

    expect(runtime.areResponsesConsistent({ responses: [] }, 0)).toBe(true);
    expect(context.areSurveyResponsesConsistent).toHaveBeenCalledWith(
      expect.objectContaining({
        buildSliceFromUserAnswers: context.buildSliceFromUserAnswers,
        editBaseline: context.stateRef.current.editBaseline,
        latest: { responses: [] },
        renderedIds: ['Rendered-Q'],
        valuesEqual: context.valuesEqual,
      }),
    );
  });
});
