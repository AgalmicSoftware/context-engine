import { render, screen, within } from '@testing-library/react';
import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys.jsx';
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
    const patch = typeof update === 'function'
      ? update(instance.state, instance.props)
      : update;
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
      questions: [{
        uiKey: 'q1',
        id: 'q1',
        type: 'freeform',
        prompt: 'Question 1',
        tags: [],
        currentTagInputValue: '',
        aiGeneratedTagsFromSource: [],
        isGeneratingTags: false,
      }],
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
      questions: [{
        uiKey: 'q1',
        id: 'q1',
        type: 'freeform',
        prompt: 'Question 1',
        lockGateIds: ['gate_1', 'gate_2'],
        tags: [],
        currentTagInputValue: '',
        aiGeneratedTagsFromSource: [],
        isGeneratingTags: false,
      }],
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

    expect(instance.state).toEqual(expect.objectContaining({
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
    }));
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
