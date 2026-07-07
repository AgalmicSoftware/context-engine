import { createSurveyQuestionsQuestionDisplayRuntime } from './surveyQuestionsQuestionDisplayRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  E2E_TESTIDS: {},
  ENABLE_IMPORTANCE_SLIDER_TOGGLE: true,
  FullQuestionFooterIcons: () => null,
  GatedPromptNotice: () => null,
  QuestionCardLinks: () => null,
  QuestionDecryptControl: () => null,
  SurveyAudioFieldInput: () => null,
  SurveyQuestionsFullQuestionCardShell: () => null,
  SurveyQuestionsFullQuestionResponseInput: () => null,
  SurveyQuestionsFullQuestionSliderSection: () => null,
  buildAnswerLockDisplayState: jest.fn((input) => input),
  buildEmptyResponseFieldState: jest.fn((questionId, fieldKey = 'answer') => ({
    encrypted: false,
    fieldKey,
    questionId,
    value: '',
  })),
  buildFieldDecryptStateHelper: jest.fn((field, input) => ({
    ...input,
    encrypted: !!field?.encrypted,
  })),
  buildGatedPromptNoticeState: jest.fn((input) => input),
  buildQuestionFieldDecryptControlDisplayStateHelper: jest.fn((input) => input),
  buildQuestionFieldDisplayStateHelper: jest.fn((input) => input),
  buildQuestionPromptDecryptDisplayState: jest.fn((input) => input),
  buildQuestionRenderDisplayStateHelper: jest.fn((input) => input),
  buildQuestionResponseDisplayStateHelper: jest.fn((input) => input),
  buildQuestionRoutePath: jest.fn(() => '/question/q1'),
  buildSliderModeStatePatch: jest.fn((prev, questionId, mode) => ({
    ...prev,
    sliderModeByQuestion: {
      ...(prev.sliderModeByQuestion || {}),
      [questionId]: mode,
    },
  })),
  buildSliderPersistOptions: jest.fn(() => ({ persistDraft: true })),
  engine: {},
  getAudioInputWorkerProps: jest.fn(() => ({})),
  getQuestionConvictionSliderValue: jest.fn(() => 7),
  getQuestionImportanceSliderValue: jest.fn(() => 5),
  getQuestionSliderMode: jest.fn(() => 'importance'),
  handleAdditional: jest.fn(),
  handleAnswer: jest.fn(),
  handleBookmarkToggle: jest.fn(),
  handleConviction: jest.fn(),
  handleDecryptQuestionAnswer: jest.fn(),
  handleImportance: jest.fn(),
  handleReloadMaskedPrompt: jest.fn(),
  hasConvictionOrImportanceValueForQuestion: jest.fn(() => true),
  hasMeaningfulFieldValue: jest.fn((field) => !!field?.value),
  inst: {
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
  },
  isMaskedPromptText: jest.fn(() => false),
  isQuestionFieldBusy: jest.fn(() => false),
  isQuestionPromptMaskedHelper: jest.fn(() => false),
  parseEncryptedEnvelopeHelper: jest.fn((field) => field),
  persistDraftSafely: jest.fn(),
  propsRef: {
    current: {
      account: '0xabc',
      isStandalone: false,
      loginComplete: true,
      singleQuestionMode: false,
      surveyIndex: 0,
    },
  },
  renderAnswerLockControl: jest.fn(() => null),
  renderPromptWithManualDecrypt: jest.fn(() => null),
  renderQuestionTagDropdown: jest.fn(() => null),
  renderQuestionTagDropdownRow: jest.fn(() => null),
  renderSurveyQuestionsFullQuestionGatedPromptCard: jest.fn(() => null),
  resolveEffectiveSlug: jest.fn(() => 'edge'),
  resolveExplicitSessionContext: jest.fn(() => ({ sessionConfig: null })),
  resolveGatedPromptGateNames: jest.fn(() => []),
  setState: jest.fn((updater) => updater({ sliderModeByQuestion: {} })),
  stateRef: {
    current: {
      autoDecryptEnabled: false,
      isDecrypting: false,
      isSubmitting: false,
      sliderModeByQuestion: {
        q1: 'importance',
      },
      surveysResponseState: [],
    },
  },
  styles: {},
  surveyResponseStoragePort: {
    buildQuestionArweaveHref: jest.fn(() => ''),
  },
  t: jest.fn((key) => key),
  toggleAdditionalCommentsEncryption: jest.fn(),
  toggleAnswerEncryption: jest.fn(),
  ...overrides,
});

describe('surveyQuestionsQuestionDisplayRuntime', () => {
  it('delegates slider mode reads and writes through shared slider helpers', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsQuestionDisplayRuntime(context);

    expect(runtime.getSliderMode('q1')).toBe('importance');
    expect(context.getQuestionSliderMode).toHaveBeenCalledWith(
      expect.objectContaining({
        explicitMode: 'importance',
        questionId: 'q1',
        surveyIndex: 0,
      }),
    );

    runtime.setSliderMode('q1', 'conviction');
    expect(context.buildSliderModeStatePatch).toHaveBeenCalledWith({ sliderModeByQuestion: {} }, 'q1', 'conviction');
  });

  it('assembles question response and decrypt display state', () => {
    const runtime = createSurveyQuestionsQuestionDisplayRuntime(createContext());
    const responseSlice = {
      additionalComments: {
        q1: {
          encrypted: true,
          value: 'notes',
        },
      },
      answers: {
        q1: {
          encrypted: false,
          value: 'answer',
        },
      },
    };

    expect(
      runtime.getQuestionRenderDisplayState({
        questionId: 'q1',
        responseSlice,
      }),
    ).toEqual(
      expect.objectContaining({
        fieldDisplayState: expect.objectContaining({
          hasAdditionalContent: true,
        }),
        responseDisplayState: expect.objectContaining({
          convictionValue: 7,
          importanceValue: 5,
          sliderMode: 'importance',
        }),
      }),
    );
  });
});
