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
    _a: null,
    _audioInputWorkerPropsMemo: null,
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
    _q: new Map(),
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

  it('reuses per-question input handlers while preserving answer semantics', () => {
    const handleAnswer = jest.fn();
    const toggleAnswerEncryption = jest.fn();
    const context = createContext({ handleAnswer, toggleAnswerEncryption });
    const runtime = createSurveyQuestionsQuestionDisplayRuntime(context);
    const question = { id: 'q1', type: 'freeform' };

    const first = runtime.renderFullQuestionResponseInput({
      question,
      qIndex: 0,
      surveyIndex: 2,
      answer: { value: '' },
    });
    const second = runtime.renderFullQuestionResponseInput({
      question,
      qIndex: 0,
      surveyIndex: 2,
      answer: { value: '' },
    });
    const otherQuestion = runtime.renderFullQuestionResponseInput({
      question: { id: 'q2', type: 'freeform' },
      qIndex: 1,
      surveyIndex: 2,
      answer: { value: '' },
    });

    expect(first.props.onAnswerChange).toBe(second.props.onAnswerChange);
    expect(first.props.onToggleAnswerEncryption).toBe(second.props.onToggleAnswerEncryption);
    expect(first.props.onAnswerChange).not.toBe(otherQuestion.props.onAnswerChange);

    first.props.onAnswerChange('answer text');
    first.props.onToggleAnswerEncryption(true);

    expect(handleAnswer).toHaveBeenCalledWith(2, 'q1', 'answer text');
    expect(toggleAnswerEncryption).toHaveBeenCalledWith(2, 'q1', true);
  });

  it('computes audio input worker props once per question display render', () => {
    const firstWorkerProps = {
      context: { account: '0xabc', chainId: 11155420 },
      sessionConfig: { slug: 'edge' },
      sessionSlug: 'edge',
    };
    const secondWorkerProps = {
      context: { account: '0xdef', chainId: 11155420 },
      sessionConfig: { slug: 'next' },
      sessionSlug: 'next',
    };
    const getAudioInputWorkerProps = jest
      .fn()
      .mockReturnValueOnce(firstWorkerProps)
      .mockReturnValueOnce(secondWorkerProps);
    const runtime = createSurveyQuestionsQuestionDisplayRuntime(createContext({ getAudioInputWorkerProps }));

    runtime.beginQuestionDisplayRender();
    const answerInput = runtime.renderFullQuestionResponseInput({
      question: { id: 'q1', type: 'freeform' },
      qIndex: 0,
      surveyIndex: 0,
      answer: { value: '' },
    });
    const additionalInput = runtime.renderFullQuestionAdditionalInput({
      qIndex: 0,
      surveyIndex: 0,
      questionId: 'q1',
      additional: { value: '' },
    });

    expect(getAudioInputWorkerProps).toHaveBeenCalledTimes(1);
    expect(answerInput.props.audioInputWorkerProps).toBe(firstWorkerProps);
    expect(additionalInput.props.sessionSlug).toBe('edge');
    expect(additionalInput.props.context).toBe(firstWorkerProps.context);

    runtime.beginQuestionDisplayRender();
    const nextInput = runtime.renderFullQuestionResponseInput({
      question: { id: 'q1', type: 'freeform' },
      qIndex: 0,
      surveyIndex: 0,
      answer: { value: '' },
    });

    expect(getAudioInputWorkerProps).toHaveBeenCalledTimes(2);
    expect(nextInput.props.audioInputWorkerProps).toBe(secondWorkerProps);
  });

  it('preserves equivalent audio worker props so unchanged response inputs remain memoized', () => {
    const sessionConfig = { slug: 'edge' };
    const createWorkerProps = (account = '0xabc') => ({
      context: { account, chainId: 11155420, providerLike: 'https://rpc.example' },
      sessionConfig,
      sessionSlug: 'edge',
    });
    const getAudioInputWorkerProps = jest
      .fn()
      .mockImplementationOnce(() => createWorkerProps())
      .mockImplementationOnce(() => createWorkerProps())
      .mockImplementationOnce(() => createWorkerProps('0xdef'));
    const runtime = createSurveyQuestionsQuestionDisplayRuntime(createContext({ getAudioInputWorkerProps }));
    const renderInput = () =>
      runtime.renderFullQuestionResponseInput({
        question: { id: 'q1', type: 'binary' },
        qIndex: 0,
        surveyIndex: 0,
        answer: { value: '' },
      });

    runtime.beginQuestionDisplayRender();
    const firstInput = renderInput();
    runtime.beginQuestionDisplayRender();
    const equivalentInput = renderInput();

    expect(getAudioInputWorkerProps).toHaveBeenCalledTimes(2);
    expect(equivalentInput.props.audioInputWorkerProps).toBe(firstInput.props.audioInputWorkerProps);

    runtime.beginQuestionDisplayRender();
    const changedAccountInput = renderInput();

    expect(changedAccountInput.props.audioInputWorkerProps).not.toBe(firstInput.props.audioInputWorkerProps);
    expect(changedAccountInput.props.audioInputWorkerProps.context.account).toBe('0xdef');
  });
});
