import { SurveyQuestions } from './SurveyQuestions';
import { renderToStaticMarkup } from 'react-dom/server';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  findElement,
  treeHasDataTestId,
  treeHasLabel,
} from './surveyToolTreeTestHelpers.js';

describe('SurveyTool pending edit render affordances', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('renders submitted indicator test id when submitted latch is active', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
      questionPool: [],
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
    };

    const tree = subject.render();
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBe(true);
  });

  it('keeps inline submitted indicator visible after submit when userHasResponse is true', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: true,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: false,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      userAnswers: null,
    };

    const tree = subject.render();
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBe(true);
  });

  it('does not render existing-response notice in single-question mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submissionError: '',
      userHasResponse: true,
      userResponseEncrypted: true,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      userAnswers: { answer: { ...emptyField } },
    };

    const tree = subject.render();

    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBe(false);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL)).toBe(false);
  });

  it('keeps existing-response notice available in survey mode for bulk decrypt actions', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submissionError: '',
      userHasResponse: true,
      userResponseEncrypted: true,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      userAnswers: { responses: [] },
    };

    const tree = subject.render();

    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBe(true);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL)).toBe(true);
  });

  it('renders the single-question inline submit below the question when edits are pending', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: false,
      isDirty: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField, value: 'Answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
    };
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.renderQuestion = jest.fn(() => <div key="q1" data-testid="question-card-stub">Question Card</div>);

    const tree = subject.render();
    const markup = renderToStaticMarkup(tree);

    expect(markup).not.toContain('singleQuestionSubmitLayout');
    expect(markup).not.toContain('singleQuestionSubmitRail');
    expect(markup).toContain('Question Card');
    expect(markup).toContain('SUBMIT');
    expect(markup).toContain(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(markup).not.toContain('Clear pending changes');
    expect(subject.renderQuestion).toHaveBeenCalledTimes(1);
  });

  it('does not render single-question submit controls before pending edits appear', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: false,
      isDirty: false,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField, value: '' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
    };
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.renderQuestion = jest.fn(() => <div key="q1" data-testid="question-card-stub">Question Card</div>);

    const tree = subject.render();
    const markup = renderToStaticMarkup(tree);

    expect(markup).not.toContain('singleQuestionSubmitLayout');
    expect(markup).not.toContain('singleQuestionSubmitRail');
    expect(markup).not.toContain(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(subject.renderQuestion).toHaveBeenCalledTimes(1);
  });

  it('does not render submitted CTA state in single-question mode when no pending edits remain', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: true,
      startFresh: false,
      isEditing: true,
      displayAnswerMode: false,
      isDirty: false,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField, value: 'Answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
    };
    subject.renderQuestion = jest.fn(() => <div key="q1" data-testid="question-card-stub">Question Card</div>);

    const tree = subject.render();

    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMIT)).toBe(false);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBe(false);
  });

  it('applies single-question response page wrappers in read mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress: '0xdef',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      isLoadingResponse: false,
      noResponse: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      parsedViewAddressAnswers: { answer: { value: '*', encrypted: true } },
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
    };
    subject.renderQuestionAnswer = jest.fn(() => <div key="resp" data-testid="response-card-stub">Response Card</div>);

    const tree = subject.render();
    const pageRoot = findElement(
      tree,
      (node) => String(node?.props?.className || '').includes('singleQuestionPage')
    );
    const responseView = findElement(
      tree,
      (node) => String(node?.props?.className || '').includes('singleQuestionResponseView')
    );
    const addressLink = findElement(
      tree,
      (node) => node?.type === 'a' && node?.props?.href === '/u/0xdef'
    );

    expect(pageRoot).not.toBeNull();
    expect(responseView).not.toBeNull();
    expect(addressLink).not.toBeNull();
    expect(treeHasLabel(tree, 'question .json')).toBe(true);
    expect(treeHasLabel(tree, 'response .json')).toBe(true);
    expect(subject.renderQuestionAnswer).toHaveBeenCalledTimes(1);
  });

  it('does not call getPendingEditStats during SurveyQuestions.render', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.getPendingEditStats = jest.fn(() => ({ total: 9, encrypted: 4 }));
    subject.state = {
      ...subject.state,
      displayAnswerMode: false,
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Prompt' }],
      modifiedCount: 2,
      encryptedModifiedCount: 1,
      hasEncryptedChanges: true,
      showComments: {},
    };

    subject.render();

    expect(subject.getPendingEditStats).not.toHaveBeenCalled();
  });
});
