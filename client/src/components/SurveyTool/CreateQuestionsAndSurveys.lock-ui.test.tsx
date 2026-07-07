import { fireEvent, render, screen, within } from '@testing-library/react';
import CreateQuestionsAndSurveys, {
  CREATE_SURVEY_ACTION_ICON_STYLE,
  CREATE_SURVEY_AUTO_TOOL_PANEL_STYLE,
  CREATE_SURVEY_CLEAR_FORM_BUTTON_STYLE,
  CREATE_SURVEY_FREEFORM_PREVIEW_STYLE,
  CREATE_SURVEY_HEADER_ICON_STYLE,
  CREATE_SURVEY_RATING_PREVIEW_TRACK_STYLE,
  CREATE_SURVEY_SMALL_ICON_BUTTON_STYLE,
  CREATE_SURVEY_SUBMIT_ICON_STYLE,
  CREATE_SURVEY_TOGGLE_KNOB_QUESTION_STYLE,
  CREATE_SURVEY_TOGGLE_KNOB_SURVEY_STYLE,
  CREATE_SURVEY_TRAILING_TOGGLE_LABEL_STYLE,
  CREATE_SURVEY_TYPE_PREVIEW_BOX_STYLE,
  CREATE_SURVEY_TYPE_PREVIEW_HEADING_STYLE,
  CREATE_SURVEY_TYPE_PREVIEW_PILL_STYLE,
  CREATE_SURVEY_UPLOADED_QUESTION_LINK_STYLE,
  buildCreateSurveyActionLinkClassName,
  buildCreateSurveyAiPromptCopyClassName,
  buildCreateSurveyContainerClassName,
  buildCreateSurveyProgressStepClassName,
  buildCreateSurveySubmitButtonClassName,
  buildCreateSurveyTypePillClassName,
  resolveCreateSurveyBookmarkSurveyStyle,
  resolveCreateSurveyProgressFillStyle,
  resolveCreateSurveyQuestionBookmarkStyle,
  resolveCreateSurveyToggleKnobStyle,
} from './CreateQuestionsAndSurveys';
import gateLockStyles from '../Gates/GateMultiSelectLock.module.scss';
import surveyStyles from './CreateQuestionsAndSurveys.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const makeInstance = (props: Record<string, unknown> = {}) => {
  const instance = new CreateQuestionsAndSurveys({
    network: { id: 84532 },
    activeSessionSlug: 'edge',
    ...props,
  }) as any;
  instance._isMounted = true;
  instance.setState = jest.fn((update: any, cb?: () => void) => {
    const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });
  return instance;
};

describe('CreateQuestionsAndSurveys lock UI', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds question type preview styles and pill classes', () => {
    expect(CREATE_SURVEY_TYPE_PREVIEW_BOX_STYLE).toEqual({
      border: '1px dashed #b0c4ff',
      padding: 10,
      borderRadius: 6,
      marginTop: 6,
      background: '#f6f8ff',
    });
    expect(CREATE_SURVEY_TYPE_PREVIEW_PILL_STYLE).toEqual({
      display: 'inline-block',
      padding: '3px 8px',
      border: '1px solid #ccd',
      borderRadius: 12,
      marginRight: 6,
      marginTop: 4,
    });
    expect(CREATE_SURVEY_TYPE_PREVIEW_HEADING_STYLE).toEqual({
      fontWeight: 600,
      marginBottom: 6,
    });
    expect(CREATE_SURVEY_RATING_PREVIEW_TRACK_STYLE).toEqual({
      height: 6,
      background: '#d9e1ff',
      borderRadius: 4,
      width: 240,
    });
    expect(CREATE_SURVEY_FREEFORM_PREVIEW_STYLE).toEqual({
      height: 34,
      border: '1px solid #ccd',
      background: '#fff',
      borderRadius: 4,
    });
    expect(buildCreateSurveyTypePillClassName(surveyStyles, 'agree')).toBe(
      `${surveyStyles.pill} ${surveyStyles.pillAgree}`,
    );
    expect(buildCreateSurveyTypePillClassName(surveyStyles, 'unsure')).toBe(
      `${surveyStyles.pill} ${surveyStyles.pillUnsure}`,
    );
    expect(buildCreateSurveyTypePillClassName(surveyStyles, 'disagree')).toBe(
      `${surveyStyles.pill} ${surveyStyles.pillDisagree}`,
    );
    expect(CREATE_SURVEY_SUBMIT_ICON_STYLE).toEqual({ marginRight: 8 });
    expect(CREATE_SURVEY_UPLOADED_QUESTION_LINK_STYLE).toEqual({
      marginLeft: '10px',
      marginRight: '5px',
      textDecoration: 'none',
      color: '#007bff',
    });
    expect(CREATE_SURVEY_SMALL_ICON_BUTTON_STYLE).toEqual({ padding: '0 5px' });
    expect(CREATE_SURVEY_ACTION_ICON_STYLE).toEqual({ marginRight: '5px' });
    expect(buildCreateSurveySubmitButtonClassName(surveyStyles, true, false)).toBe(
      `${surveyStyles.createSurveyButton} ${surveyStyles.submitSurveyBtn} ${surveyStyles.submittingButton} `,
    );
    expect(buildCreateSurveySubmitButtonClassName(surveyStyles, false, true)).toBe(
      `${surveyStyles.createSurveyButton} ${surveyStyles.submitSurveyBtn}  ${surveyStyles.errorButton}`,
    );
    expect(resolveCreateSurveyProgressFillStyle(120)).toEqual({ width: '100%' });
    expect(resolveCreateSurveyProgressFillStyle(-20)).toEqual({ width: '0%' });
    expect(resolveCreateSurveyQuestionBookmarkStyle(true)).toEqual({ color: '#ffc107' });
    expect(resolveCreateSurveyQuestionBookmarkStyle(false)).toEqual({ color: undefined });
    expect(resolveCreateSurveyBookmarkSurveyStyle(true)).toEqual({ color: '#ffe082' });
    expect(resolveCreateSurveyBookmarkSurveyStyle(false)).toEqual({ color: undefined });
    expect(buildCreateSurveyActionLinkClassName(surveyStyles)).toBe(
      `${surveyStyles.actionBtn} ${surveyStyles.actionLink}`,
    );
    expect(CREATE_SURVEY_TOGGLE_KNOB_QUESTION_STYLE).toEqual({
      left: '31px',
      backgroundColor: '#4caf50',
    });
    expect(CREATE_SURVEY_TOGGLE_KNOB_SURVEY_STYLE).toEqual({
      left: '1px',
      backgroundColor: '#fff',
    });
    expect(CREATE_SURVEY_TRAILING_TOGGLE_LABEL_STYLE).toEqual({ marginLeft: '10px' });
    expect(CREATE_SURVEY_HEADER_ICON_STYLE).toEqual({ marginRight: '6px' });
    expect(CREATE_SURVEY_CLEAR_FORM_BUTTON_STYLE).toEqual({ marginLeft: 'auto' });
    expect(CREATE_SURVEY_AUTO_TOOL_PANEL_STYLE).toEqual({ marginTop: '20px' });
    expect(buildCreateSurveyProgressStepClassName(surveyStyles, 2, 1)).toBe(surveyStyles.stepCompleted);
    expect(buildCreateSurveyProgressStepClassName(surveyStyles, 2, 3)).toBe(surveyStyles.step);
    expect(buildCreateSurveyAiPromptCopyClassName(surveyStyles, true)).toBe(
      `${surveyStyles.aiPromptCopyCorner} ${surveyStyles.aiPromptCopyCornerSuccess}`,
    );
    expect(buildCreateSurveyAiPromptCopyClassName(surveyStyles, false)).toBe(`${surveyStyles.aiPromptCopyCorner} `);
    expect(buildCreateSurveyContainerClassName(surveyStyles, true)).toBe(
      `${surveyStyles.createSurveyContainer} ${surveyStyles.miniaturized}`,
    );
    expect(buildCreateSurveyContainerClassName(surveyStyles, false)).toBe(`${surveyStyles.createSurveyContainer} `);
    expect(resolveCreateSurveyToggleKnobStyle(true)).toBe(CREATE_SURVEY_TOGGLE_KNOB_QUESTION_STYLE);
    expect(resolveCreateSurveyToggleKnobStyle(false)).toBe(CREATE_SURVEY_TOGGLE_KNOB_SURVEY_STYLE);
  });

  it('can keep preformed survey-titled drafts in questions mode', () => {
    const instance = makeInstance({
      preformedQuestions: [{ type: 'freeform', prompt: 'What changed?', tags: [] }],
      preformedSurvey: { title: 'Listening Follow-up' },
      preformedMode: 'questions',
    });

    expect(instance.state.title).toBe('Listening Follow-up');
    expect(instance.state.isStandaloneQuestion).toBe(true);
    expect(instance.state.questions).toHaveLength(1);
  });

  it('keeps rapid question type additions in click order', () => {
    const instance = makeInstance();
    instance.updateSurveyHash = jest.fn();
    instance.saveToLocalStorage = jest.fn();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      questions: [],
    };

    const queued: Array<{ update: any; cb?: () => void }> = [];
    instance.setState = jest.fn((update: any, cb?: () => void) => {
      queued.push({ update, cb });
    });

    instance.quickAdd('binary');
    instance.quickAdd('rating');
    instance.quickAdd('freeform');

    const callbacks: Array<() => void> = [];
    for (const item of queued.splice(0)) {
      const patch = typeof item.update === 'function' ? item.update(instance.state, instance.props) : item.update;
      if (patch && typeof patch === 'object') {
        instance.state = { ...instance.state, ...patch };
      }
      if (typeof item.cb === 'function') callbacks.push(item.cb);
    }

    instance.setState = jest.fn((update: any, cb?: () => void) => {
      const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
      if (patch && typeof patch === 'object') {
        instance.state = { ...instance.state, ...patch };
      }
      if (typeof cb === 'function') cb();
    });
    callbacks.forEach((cb) => cb());

    expect(instance.state.questions.map((question: { type?: string }) => question.type)).toEqual([
      'binary',
      'rating',
      'freeform',
    ]);
  });

  it('does not schedule a save when the placeholder question type is added', () => {
    const instance = makeInstance();
    instance.updateSurveyHash = jest.fn();
    instance.saveToLocalStorage = jest.fn();
    instance.addQuestion();

    expect(instance.setState).not.toHaveBeenCalled();
    expect(instance.updateSurveyHash).not.toHaveBeenCalled();
    expect(instance.saveToLocalStorage).not.toHaveBeenCalled();
  });

  it('renders the survey title lock without SBT badge text or inline gate dots', () => {
    const instance = makeInstance();
    instance.resolveGateOptions = jest.fn(() => ({
      gateMap: {
        gate_1: { id: 'gate_1' },
        gate_2: { id: 'gate_2' },
      },
      gateOptions: [
        { id: 'gate_1', label: 'Edge Alpha', badgeLabel: 'Edge Alpha', color: '#5affc2' },
        { id: 'gate_2', label: 'Edge Beta', badgeLabel: 'Edge Beta', color: '#5b8cff' },
      ],
      defaultGateId: 'gate_1',
    }));
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      surveyLockGateIds: ['gate_1', 'gate_2'],
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

    const { container } = render(instance.render());
    const titleLock = container.querySelector(`.${surveyStyles.surveyTitleLock}`) as HTMLElement | null;

    expect(titleLock).not.toBeNull();
    if (!titleLock) throw new Error('Expected survey title lock to render');
    expect(within(titleLock).getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toBeInTheDocument();
    expect(within(titleLock).queryByText(/\bSBT\b/i)).not.toBeInTheDocument();
    expect(within(titleLock).queryByText(/Edge Alpha/i)).not.toBeInTheDocument();
    expect(within(titleLock).queryByText(/Edge Beta/i)).not.toBeInTheDocument();
    expect(within(titleLock).queryByText(/\b\d+\s+gates?\b/i)).not.toBeInTheDocument();
    expect(titleLock.querySelector(`.${gateLockStyles.dots}`)).toBeNull();
  });

  it('renders the question header lock without SBT badge text or inline gate dots', () => {
    const instance = makeInstance();
    instance.resolveGateOptions = jest.fn(() => ({
      gateMap: {
        gate_1: { id: 'gate_1' },
        gate_2: { id: 'gate_2' },
      },
      gateOptions: [
        { id: 'gate_1', label: 'Edge Alpha', badgeLabel: 'Edge Alpha', color: '#5affc2' },
        { id: 'gate_2', label: 'Edge Beta', badgeLabel: 'Edge Beta', color: '#5b8cff' },
      ],
      defaultGateId: 'gate_1',
    }));
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      surveyLockGateIds: [],
      questions: [
        {
          uiKey: 'q1',
          id: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          lockGateIds: ['gate_1', 'gate_2'],
          tags: [],
          currentTagInputValue: '',
          aiGeneratedTagsFromSource: [],
          isGeneratingTags: false,
        },
      ],
    };

    const { container } = render(instance.render());
    const questionLock = container.querySelector(`.${surveyStyles.questionHeaderActions}`) as HTMLElement | null;

    expect(questionLock).not.toBeNull();
    if (!questionLock) throw new Error('Expected question header lock to render');
    expect(within(questionLock).getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toBeInTheDocument();
    expect(within(questionLock).queryByText(/\bSBT\b/i)).not.toBeInTheDocument();
    expect(within(questionLock).queryByText(/Edge Alpha/i)).not.toBeInTheDocument();
    expect(within(questionLock).queryByText(/Edge Beta/i)).not.toBeInTheDocument();
    expect(within(questionLock).queryByText(/\b\d+\s+gates?\b/i)).not.toBeInTheDocument();
    expect(questionLock.querySelector(`.${gateLockStyles.dots}`)).toBeNull();
  });

  it('keeps an explicit empty standalone question gate selection unlocked', () => {
    const instance = makeInstance();
    instance.resolveGateOptions = jest.fn(() => ({
      gateMap: {
        gate_1: { id: 'gate_1' },
      },
      gateOptions: [{ id: 'gate_1', label: 'Edge Alpha', badgeLabel: 'Edge Alpha', color: '#5affc2' }],
      defaultGateId: 'gate_1',
    }));
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: true,
      questions: [
        {
          uiKey: 'q1',
          id: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          lockGateIds: [],
          lockGateIdsTouched: true,
          tags: [],
          currentTagInputValue: '',
          aiGeneratedTagsFromSource: [],
          isGeneratingTags: false,
        },
      ],
    };

    const { container } = render(instance.render());
    const questionLock = container.querySelector(`.${surveyStyles.questionHeaderActions}`) as HTMLElement | null;

    expect(questionLock).not.toBeNull();
    if (!questionLock) throw new Error('Expected question header lock to render');
    const button = within(questionLock).getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON);
    expect(button).toHaveAttribute('aria-label', 'Choose access rule');
    expect(button.querySelector('svg')?.getAttribute('data-icon')).toBe('lock-open');
  });

  it('shows the default lock for an explicit empty survey gate selection', () => {
    const instance = makeInstance();
    instance.resolveGateOptions = jest.fn(() => ({
      gateMap: {
        gate_1: { id: 'gate_1' },
      },
      gateOptions: [{ id: 'gate_1', label: 'Edge Alpha', badgeLabel: 'Edge Alpha', color: '#5affc2' }],
      defaultGateId: 'gate_1',
    }));
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey title',
      surveyLockGateIds: [],
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

    const { container } = render(instance.render());

    const titleLock = container.querySelector(`.${surveyStyles.surveyTitleLock}`) as HTMLElement | null;
    expect(titleLock).not.toBeNull();
    if (!titleLock) throw new Error('Expected survey title lock to render');
    const button = within(titleLock).getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON);
    expect(button).toHaveAttribute('aria-label', 'Edit locked access rule');
    expect(button.querySelector('svg')?.getAttribute('data-icon')).toBe('lock');
  });

  it('opens an app-native clear confirmation instead of calling window.confirm', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      title: 'Draft survey',
      questions: [{ uiKey: 'q1', prompt: 'Question 1', type: 'freeform' }],
      showClearFormConfirm: false,
    };

    instance.handleClearForm();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(instance.state.showClearFormConfirm).toBe(true);

    confirmSpy.mockRestore();
  });

  it('clears the form only after the app-native confirmation is accepted', () => {
    const instance = makeInstance();
    instance.clearUnfinishedSurveyDraft = jest.fn();
    instance.updateSurveyHash = jest.fn();
    instance.state = {
      ...instance.state,
      title: 'Draft survey',
      questions: [{ uiKey: 'q1', prompt: 'Question 1', type: 'freeform' }],
      documentURLs: ['https://example.com/doc.pdf'],
      docURLInput: 'https://example.com/next.pdf',
      surveyHash: '0xhash',
      isStandaloneQuestion: false,
      surveyLockGateIds: ['gate_1'],
      openLockKey: 'survey-title',
      surveyAddedSuccessfully: true,
      questionsAddedSuccessfully: true,
      isSubmitting: true,
      submissionError: 'stale error',
      lastSubmittedSurveyId: 'survey-1',
      lastSubmittedSurveyArweaveTxId: 'tx-1',
      showClearFormConfirm: true,
    };

    instance.confirmClearForm();

    expect(instance.state).toEqual(
      expect.objectContaining({
        title: '',
        questions: [],
        documentURLs: [],
        docURLInput: '',
        surveyHash: '',
        isStandaloneQuestion: true,
        surveyLockGateIds: [],
        openLockKey: '',
        surveyAddedSuccessfully: false,
        questionsAddedSuccessfully: false,
        isSubmitting: false,
        submissionError: '',
        lastSubmittedSurveyId: '',
        lastSubmittedSurveyArweaveTxId: '',
        showClearFormConfirm: false,
      }),
    );
    expect(instance.clearUnfinishedSurveyDraft).toHaveBeenCalledTimes(1);
    expect(instance.updateSurveyHash).toHaveBeenCalledTimes(1);
  });

  it('renders the clear confirmation dialog with stable test ids', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      showClearFormConfirm: true,
      title: 'Draft survey',
      questions: [{ uiKey: 'q1', id: 'q1', type: 'freeform', prompt: 'Question 1', tags: [] }],
    };

    render(instance.render());

    expect(screen.getByTestId('ce-survey-clear-confirm-title')).toHaveTextContent('Clear form?');
    expect(screen.getByTestId('ce-survey-clear-confirm-body')).toHaveTextContent('unsaved survey or question draft');
    expect(screen.getByTestId('ce-survey-clear-confirm-cancel')).toHaveTextContent('Keep editing');
    expect(screen.getByTestId('ce-survey-clear-confirm-confirm')).toHaveTextContent('Clear');
  });

  it('shows invalid document URL feedback inline instead of calling window.alert', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: false,
      docURLInput: 'ftp://example.com/source.pdf',
      documentURLs: [],
      docURLError: '',
    };

    instance.addDocumentURL();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(instance.state.documentURLs).toEqual([]);
    expect(instance.state.docURLInput).toBe('ftp://example.com/source.pdf');
    expect(instance.state.docURLError).toMatch(/Document URLs must use/);

    alertSpy.mockRestore();
  });

  it('clears document URL feedback after a valid URL is added', () => {
    const instance = makeInstance();
    instance.updateSurveyHash = jest.fn();
    instance.saveToLocalStorage = jest.fn();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: false,
      docURLInput: 'https://example.com/source.pdf',
      documentURLs: [],
      docURLError: 'Previous validation error',
    };

    instance.addDocumentURL();

    expect(instance.state.documentURLs).toEqual(['https://example.com/source.pdf']);
    expect(instance.state.docURLInput).toBe('');
    expect(instance.state.docURLError).toBe('');
    expect(instance.updateSurveyHash).toHaveBeenCalledTimes(1);
    expect(instance.saveToLocalStorage).toHaveBeenCalledTimes(1);
  });

  it('renders document URL validation feedback with a stable test id', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Draft survey',
      docURLInput: 'bad-url',
      docURLError: 'Document URLs must use http:// or https://.',
      questions: [],
    };

    render(instance.render());

    expect(screen.getByTestId('ce-create-doc-url-error')).toHaveTextContent('Document URLs must use');
  });

  it('shows missing survey title validation inline instead of calling window.alert', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const instance = makeInstance({
      loginComplete: true,
      toggleLoginModal: jest.fn(),
    });
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: false,
      title: '   ',
      questions: [{ uiKey: 'q1', id: 'q1', type: 'freeform', prompt: 'Question 1', tags: [] }],
      formValidationError: '',
    };

    await instance.createSurvey();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(instance.state.formValidationError).toBe('Please enter a survey title.');

    alertSpy.mockRestore();
  });

  it('opens the login modal and clears stale submit errors before submit work', async () => {
    const toggleLoginModal = jest.fn();
    const instance = makeInstance({
      loginComplete: false,
      toggleLoginModal,
    });
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: false,
      title: 'Survey title',
      questions: [{ uiKey: 'q1', id: 'q1', type: 'freeform', prompt: 'Question 1', tags: [] }],
      isSubmitting: true,
      submissionError: 'stale submit error',
      formValidationError: 'stale validation error',
    };

    await instance.createSurvey();

    expect(toggleLoginModal).toHaveBeenCalledWith(true);
    expect(instance.state.isSubmitting).toBe(false);
    expect(instance.state.submissionError).toBe('');
    expect(instance.state.formValidationError).toBe('');
  });

  it('shows an inline login error when no login modal callback is available', async () => {
    const instance = makeInstance({
      loginComplete: false,
    });
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: false,
      title: 'Survey title',
      questions: [{ uiKey: 'q1', id: 'q1', type: 'freeform', prompt: 'Question 1', tags: [] }],
      submissionError: '',
    };

    await instance.createSurvey();

    expect(instance.state.submissionError).toBe('Log in to create this survey.');
  });

  it('shows blank question prompt validation inline instead of calling window.alert', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const instance = makeInstance({
      loginComplete: true,
      toggleLoginModal: jest.fn(),
    });
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: false,
      title: 'Survey title',
      questions: [{ uiKey: 'q1', id: 'q1', type: 'freeform', prompt: '   ', tags: [] }],
      formValidationError: '',
    };

    await instance.createSurvey();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(instance.state.formValidationError).toBe('Question 1 prompt cannot be blank.');

    alertSpy.mockRestore();
  });

  it('opens the login modal instead of surfacing a submit error for valid unauthenticated drafts', async () => {
    const toggleLoginModal = jest.fn();
    const instance = makeInstance({
      loginComplete: false,
      toggleLoginModal,
    });
    instance.ensureResolvedSessionConfigForSubmit = jest.fn();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      questions: [{ uiKey: 'q1', id: 'q1', type: 'freeform', prompt: 'Question 1', tags: [] }],
      submissionError: 'stale error',
      formValidationError: 'stale validation',
      isSubmitting: true,
    };

    await instance.createSurvey();

    expect(toggleLoginModal).toHaveBeenCalledWith(true);
    expect(instance.ensureResolvedSessionConfigForSubmit).not.toHaveBeenCalled();
    expect(instance.state.submissionError).toBe('');
    expect(instance.state.formValidationError).toBe('');
    expect(instance.state.isSubmitting).toBe(false);
  });

  it('renders form validation feedback with a stable test id', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: '',
      formValidationError: 'Please enter a survey title.',
      questions: [{ uiKey: 'q1', id: 'q1', type: 'freeform', prompt: 'Question 1', tags: [] }],
    };

    render(instance.render());

    expect(screen.getByTestId('ce-create-validation-error')).toHaveTextContent('Please enter a survey title.');
  });
});
