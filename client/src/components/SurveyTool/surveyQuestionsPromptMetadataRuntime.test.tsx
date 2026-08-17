import { createSurveyQuestionsPromptMetadataRuntime } from './surveyQuestionsPromptMetadataRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  E2E_TESTIDS: {
    SURVEY_DECRYPT_PROMPT: 'ce-survey-decrypt-prompt',
  },
  FontAwesomeIcon: () => null,
  QUESTION_TAG_DROPDOWN_ROW_STYLE: { marginTop: 4 },
  SurveyQuestionTagControl: () => null,
  areQuestionPayloadsEquivalent: jest.fn(() => false),
  buildActiveTagModalState: jest.fn((tag = '') => ({ activeTagModal: tag })),
  buildBulkPromptReloadingState: jest.fn((active) => ({ bulkPromptReloading: active })),
  buildDecryptingByKeyState: jest.fn((prev, key, active) => ({
    ...prev,
    decryptingByKey: {
      ...(prev.decryptingByKey || {}),
      [key]: active,
    },
  })),
  buildQuestionDecryptContextForSession: jest.fn((input) => input),
  buildQuestionPromptDecryptDisplayState: jest.fn((input) => input),
  buildRenderedQuestionPayloadPoolsState: jest.fn((prev) => prev),
  buildVisiblePileQuestionsAfterPromptDecryptState: jest.fn((prev) => prev),
  ensureQuestionsNet: jest.fn((cache) => cache || { 11155420: { questions: {} } }),
  faSpinner: {},
  fetchSingleQuestionData: jest.fn(),
  getAllSessionSlugs: jest.fn(() => ['fallback', 'explicit']),
  getQuestionFieldTaskKey: jest.fn((qid, field) => `${qid}:${field}`),
  getQuestionPayloadDisplayState: jest.fn(() => ({})),
  getSessionSlugHintFromProps: jest.fn(() => 'explicit'),
  getSessionSlugPinnedFromProps: jest.fn(() => false),
  inst: {
    _getEffectiveDraftSlug: jest.fn(() => 'question-slug'),
  },
  isMaskedQuestionPayload: jest.fn(() => false),
  isQuestionFieldBusy: jest.fn(() => false),
  isSurveyQuestionsMaskedPromptText: jest.fn((prompt) => prompt === '[encrypted]'),
  isSurveyToolFilterStateActive: jest.fn(() => false),
  pickBetterQuestionPayload: jest.fn((existing, incoming) => incoming || existing),
  propsRef: {
    current: {
      account: '0xabc',
      network: { id: 11155420 },
      provider: 'browser',
      questionID: 'q1',
      sessionName: 'Edge Session',
      singleQuestionMode: true,
      surveyId: 'survey-1',
    },
  },
  readQuestionsCache: jest.fn(() => ({})),
  resolveCurrentTagSessionSlug: jest.fn(() => 'edge'),
  resolveDraftSessionContext: jest.fn(() => ({ sessionSlug: 'draft', sessionConfig: null })),
  resolveEffectiveSlug: jest.fn(() => 'effective'),
  resolveExplicitSessionContext: jest.fn((slug) => ({
    sessionConfig: slug === 'explicit' ? { sessionName: 'Explicit' } : null,
    sessionSlug: slug,
  })),
  resolveQuestionPayloadCacheWriteContext: jest.fn(() => ({ networkIdStr: '11155420' })),
  resolveSessionChainId: jest.fn(() => 11155420),
  resolveSlugForIds: jest.fn(({ questionId, surveyId }) => (questionId ? 'question-slug' : `survey-${surveyId}`)),
  setState: jest.fn(),
  shouldAttemptAutomaticPromptDecrypt: jest.fn(() => true),
  stateRef: {
    current: {
      pileQuestions: [],
      questionPool: [{ id: 'q1', sessionName: 'Pool Session' }],
    },
  },
  styles: {},
  surveyLog: {
    debug: jest.fn(),
  },
  surveyQuestionReadsPort: {
    getQuestionData: jest.fn(),
  },
  writeQuestionsCache: jest.fn(),
  ...overrides,
});

describe('surveyQuestionsPromptMetadataRuntime', () => {
  it('resolves draft scope and slug for question and survey modes', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsPromptMetadataRuntime(context);

    expect(runtime._getDraftScope()).toBe('questions');
    expect(runtime._getEffectiveDraftSlug()).toBe('question-slug');

    context.propsRef.current.singleQuestionMode = false;
    expect(runtime._getDraftScope()).toBe('survey-1');
    expect(runtime._getEffectiveDraftSlug()).toBe('survey-survey-1');
  });

  it('keeps the session-shell Worker config when building voice input props', () => {
    const sessionConfig = {
      slug: 'demo-sh',
      corsWorkerUrl: 'https://demo-sh-worker.example',
    };
    const resolveDraftSessionContext = jest.fn((_props: unknown, _effectiveDraftSlug: string) => ({
      sessionSlug: 'demo-sh',
      sessionConfig,
    }));
    const resolveExplicitSessionContext = jest.fn(() => ({
      sessionSlug: 'demo-sh',
      sessionConfig: null,
    }));
    const context = createContext({
      propsRef: {
        current: {
          account: '0xabc',
          network: { id: 11155420 },
          provider: 'browser',
          sessionConfig,
          sessionSlug: 'demo-sh',
          sessionSlugPinned: true,
        },
      },
      resolveDraftSessionContext,
      resolveEffectiveSlug: jest.fn(() => 'demo-sh'),
      resolveExplicitSessionContext,
    });

    const runtime = createSurveyQuestionsPromptMetadataRuntime(context);

    expect(runtime.getAudioInputWorkerProps()).toEqual({
      sessionSlug: 'demo-sh',
      sessionConfig,
      context: {
        account: '0xabc',
        providerLike: 'browser',
        chainId: 11155420,
      },
    });
    expect(resolveDraftSessionContext).toHaveBeenCalledWith(context.propsRef.current, 'demo-sh');
    expect(resolveExplicitSessionContext).not.toHaveBeenCalled();
  });

  it('orders candidate slugs without duplicates and applies tag modal updates', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsPromptMetadataRuntime(context);

    expect(runtime.getQuestionFetchCandidateSlugs('Q1', 'Preferred Slug!?', { allowPinnedFallback: true })).toEqual([
      'preferredslug',
      'explicit',
      'question-slug',
      'effective',
      'fallback',
      '',
    ]);

    runtime.handleQuestionTagSelect(' Governance ');
    expect(context.setState).toHaveBeenCalledWith({ activeTagModal: 'Governance' });
  });
});
