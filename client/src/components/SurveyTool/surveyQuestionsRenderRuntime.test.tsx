import { createSurveyQuestionsRenderRuntime } from './surveyQuestionsRenderRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  SingleQuestionResponse: () => null,
  SurveyQuestionsSurveyAnswersView: () => null,
  getActiveSessionSlugFromProps: jest.fn(() => 'active-edge'),
  getCommentsOpen: jest.fn(() => true),
  getQuestionRenderDisplayState: jest.fn(() => ({
    answer: { value: 'answer' },
    hasAdditionalContent: true,
  })),
  handleDecryptQuestionAnswer: jest.fn(),
  handleReloadMaskedPrompt: jest.fn(),
  inst: {
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
  },
  isQuestionFieldBusy: jest.fn(() => true),
  isQuestionPromptMasked: jest.fn(() => false),
  propsRef: {
    current: {
      account: '0xabc',
      isStandalone: false,
      provider: { id: 'provider' },
      questionResponsesNonce: 4,
      questionsCacheNonce: 5,
      responderAddress: '',
      sbtCacheRevision: 6,
      singleQuestionMode: false,
      surveyIndex: 2,
      viewAddress: '',
    },
  },
  renderFullQuestionAdditionalInput: jest.fn(),
  renderFullQuestionCardIcons: jest.fn(() => 'icons'),
  renderFullQuestionCardShell: jest.fn(),
  renderFullQuestionFooterIcons: jest.fn(),
  renderFullQuestionResponseInput: jest.fn(),
  renderFullQuestionSliderSection: jest.fn(),
  renderQuestionAdditionalLockControl: jest.fn(),
  renderQuestionAnswerLockControl: jest.fn(),
  renderQuestionFieldDecryptControl: jest.fn(),
  renderQuestionMaskedPromptCard: jest.fn(() => 'masked-card'),
  renderSurveyQuestionsFullQuestionDisplay: jest.fn(() => 'full-card'),
  resolveEffectiveSlug: jest.fn(() => 'fallback-edge'),
  shouldShowSingleQuestionResponseLookupSpinner: jest.fn(() => false),
  stateRef: {
    current: {
      bookmarkedQuestions: new Set(['q1']),
      canDecryptOtherResponses: true,
      isLoadingResponse: false,
      questionPool: [{ id: 'q1', type: 'text' }],
      questionsCacheNonce: 7,
      sliderToggleExpandedByQuestion: {
        q1: true,
      },
    },
  },
  surveyLog: {
    error: jest.fn(),
    warn: jest.fn(),
  },
  toggleComments: jest.fn(),
  ...overrides,
});

describe('surveyQuestionsRenderRuntime', () => {
  it('returns null and warns when response state is missing', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRenderRuntime(context);

    expect(runtime.renderQuestion({ id: 'q1', type: 'text' }, 0, null)).toBeNull();
    expect(context.surveyLog.warn).toHaveBeenCalledWith(
      'renderQuestion: currentSurveyResponseState or its answers property is undefined/null. Question ID:',
      'q1',
    );
  });

  it('renders masked prompt cards without rendering editable inputs', () => {
    const context = createContext({
      isQuestionPromptMasked: jest.fn(() => true),
    });
    const runtime = createSurveyQuestionsRenderRuntime(context);
    const question = { id: 'q1', type: 'text' };

    expect(runtime.renderQuestion(question, 0, { answers: { q1: { value: '*' } } })).toBe('masked-card');

    expect(context.renderFullQuestionCardIcons).toHaveBeenCalledWith({
      isQuestionBookmarked: true,
      question,
      showResponseLookupSpinner: false,
    });
    expect(context.renderQuestionMaskedPromptCard).toHaveBeenCalledWith({
      cardIcons: 'icons',
      cardKey: 'q1',
      mode: 'full',
      question,
    });
    expect(context.renderSurveyQuestionsFullQuestionDisplay).not.toHaveBeenCalled();
  });

  it('renders full question cards with display state and control renderers', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRenderRuntime(context);
    const responseSlice = { answers: { q1: { value: 'answer' } } };

    expect(runtime.renderQuestion({ id: 'q1', type: 'text' }, 3, responseSlice)).toBe('full-card');

    expect(context.shouldShowSingleQuestionResponseLookupSpinner).toHaveBeenCalledWith(
      expect.objectContaining({
        account: '0xabc',
        singleQuestionMode: false,
      }),
    );
    expect(context.getQuestionRenderDisplayState).toHaveBeenCalledWith({
      questionId: 'q1',
      responseSlice,
    });
    expect(context.renderSurveyQuestionsFullQuestionDisplay).toHaveBeenCalledWith(
      expect.objectContaining({
        cardIcons: 'icons',
        cardKey: 'q1',
        commentsOpen: true,
        qIndex: 3,
        renderAdditionalDecryptControl: context.renderQuestionFieldDecryptControl,
        renderAnswerDecryptControl: context.renderQuestionFieldDecryptControl,
        renderResponseInput: context.renderFullQuestionResponseInput,
        onToggleComments: context.toggleComments,
        sliderOpen: true,
        surveyIndex: 2,
      }),
    );
  });

  it('builds submitted single-question response props with decrypt callbacks intact', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRenderRuntime(context);
    const question = { id: 'q1', type: 'text' };
    const response = { questionID: 'q1', answer: 'Yes' };

    const element = runtime.renderQuestionAnswer(question, response, 1, true);

    expect(element.props).toEqual(
      expect.objectContaining({
        activeSessionSlug: 'active-edge',
        canDecryptOtherResponses: true,
        isOwnResponse: true,
        mode: 'fullscreen',
        promptReloading: true,
        question,
        response,
        sessionSlug: 'edge',
        showImportance: true,
      }),
    );
    element.props.onDecryptQuestion('q1', 'answer');
    expect(context.handleDecryptQuestionAnswer).toHaveBeenCalledWith('q1', 'answer');
    expect(element.props.onReloadQuestionPrompt).toBe(context.handleReloadMaskedPrompt);
  });

  it('builds survey answer view props using the current question pool', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRenderRuntime(context);
    const responses = [{ questionID: 'q1', answer: 'Yes' }];

    const element = runtime.renderSurveyAnswers(responses, false);

    expect(element.props).toEqual(
      expect.objectContaining({
        isOwnResponse: false,
        questionPool: context.stateRef.current.questionPool,
        responses,
      }),
    );
    element.props.onWarning('warned');
    expect(context.surveyLog.warn).toHaveBeenCalledWith('warned');
    expect(element.props.renderQuestionAnswer({ id: 'q1', type: 'text' }, responses[0], 0, false).props.response).toBe(
      responses[0],
    );
  });
});
