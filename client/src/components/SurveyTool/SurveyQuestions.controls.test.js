import React from 'react';
import { SurveyQuestions } from './SurveyQuestions';
import SurveyQuestionsAuthoringPanel from './SurveyQuestionsAuthoringPanel';
import SurveyQuestionsFullQuestionCardShell from './SurveyQuestionsFullQuestionCardShell';
import SurveyQuestionsFullQuestionSliderSection from './SurveyQuestionsFullQuestionSliderSection';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  findElement,
  findFirstNodeByType,
} from './surveyToolTreeTestHelpers.js';

const emptyResponseSlice = () => ({
  answers: {},
  additionalComments: {},
  importance: {},
  conviction: {},
});

const createReadySubject = ({
  props = {},
  state = {},
  question = { id: 'q1', type: 'freeform', prompt: 'Ready prompt' },
} = {}) => {
  const subject = new SurveyQuestions({
    singleQuestionMode: false,
    isStandalone: false,
    surveyIndex: 0,
    account: '0xabc',
    loginComplete: true,
    network: { id: 84532 },
    isQuestionCacheReady: true,
    ...props,
  });
  subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
  subject.getMemoizedLockedQuestionGateDetails = jest.fn(() => []);
  subject.renderLockedQuestionsPanel = jest.fn(() => null);
  subject.renderQuestion = jest.fn((item) => (
    React.createElement('div', { key: item.id, 'data-testid': 'mock-question-card' }, item.id)
  ));
  subject.state = {
    ...subject.state,
    questionPool: [question],
    surveysResponseState: [emptyResponseSlice()],
    ...state,
  };
  return subject;
};

const getAuthoringPanel = (subject) => {
  const panel = findFirstNodeByType(subject.render(), SurveyQuestionsAuthoringPanel);
  expect(panel).not.toBeNull();
  return panel;
};

const findSubmitButton = (node) => (
  findElement(node, (candidate) => candidate?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_SUBMIT)
);

const findSubmittedIndicator = (node) => (
  findElement(node, (candidate) => candidate?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)
);

describe('SurveyQuestions controls', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('prefers explicit route session slug for audio-input worker props in single-question mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    const inferredSlugSpy = jest.fn(() => 'other');
    subject._getEffectiveDraftSlug = inferredSlugSpy;

    const workerProps = subject.getAudioInputWorkerProps();

    expect(workerProps.sessionSlug).toBe('edge');
    expect(workerProps.sessionSlug).toBe('edge');
    expect(inferredSlugSpy).not.toHaveBeenCalled();
  });

  it('does not inherit the general session config for unknown audio-input worker slugs', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      provider: {},
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'missing-session-slug');

    const workerProps = subject.getAudioInputWorkerProps();

    expect(workerProps).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      context: {
        chainId: 84532,
      },
    });
  });

  it('wires full-question slider section callbacks through the parent shell', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const persistOptions = { persistDraft: true };
    const event = { type: 'change' };
    subject.setSliderMode = jest.fn();
    subject.handleConvictionImportanceChange = jest.fn();
    subject.getSliderPersistOptions = jest.fn(() => persistOptions);
    subject.flushDraftPersistAfterSliderChange = jest.fn();
    subject.state = {
      ...subject.state,
      bookmarkedQuestions: new Set(),
      sliderToggleExpandedByQuestion: { q1: true },
      surveysResponseState: [{
        answers: { q1: { value: 'Ready answer' } },
        additionalComments: {},
        conviction: { q1: 4 },
        importance: { q1: 7 },
      }],
    };

    const tree = subject.renderQuestion(
      { id: 'q1', type: 'freeform', prompt: 'Ready prompt' },
      0,
      subject.state.surveysResponseState[0]
    );
    const cardShell = findFirstNodeByType(tree, SurveyQuestionsFullQuestionCardShell);
    const sliderSection = cardShell?.props?.sliderSection;

    expect(sliderSection?.type).toBe(SurveyQuestionsFullQuestionSliderSection);
    expect(sliderSection.props).toEqual(expect.objectContaining({
      activeSliderValue: 4,
      convictionValue: 4,
      hasConvictionImportanceValue: true,
      importanceValue: 7,
      questionId: 'q1',
      sliderMode: 'conviction',
      sliderOpen: true,
    }));

    sliderSection.props.onSelectMode('importance');
    expect(subject.setSliderMode).toHaveBeenCalledWith('q1', 'importance');

    sliderSection.props.onChange(8, event);
    expect(subject.getSliderPersistOptions).toHaveBeenCalledWith(event);
    expect(subject.handleConvictionImportanceChange).toHaveBeenCalledWith(
      0,
      'q1',
      'conviction',
      8,
      persistOptions
    );

    sliderSection.props.onChangeComplete();
    expect(subject.flushDraftPersistAfterSliderChange).toHaveBeenCalledTimes(1);
  });

  it('keeps submit controls hidden until a survey has pending edits or submitted state', () => {
    const subject = createReadySubject();

    const panel = getAuthoringPanel(subject);

    expect(panel.props.showInlineSubmit).toBe(false);
    expect(panel.props.showTopInlineSubmit).toBe(false);
    expect(subject.renderQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'q1' }),
      0,
      expect.objectContaining({ answers: {} })
    );
  });

  it('renders pending survey submit controls as enabled and wires the primary click handler', () => {
    const subject = createReadySubject({
      state: {
        modifiedCount: 2,
      },
    });
    subject.handlePrimarySubmitClick = jest.fn();

    const panel = getAuthoringPanel(subject);
    const button = findSubmitButton(panel.props.submitResponseButton);

    expect(panel.props.showInlineSubmit).toBe(true);
    expect(panel.props.showTopInlineSubmit).toBe(true);
    expect(button).not.toBeNull();
    expect(button.props.disabled).toBe(false);

    button.props.onClick();

    expect(subject.handlePrimarySubmitClick).toHaveBeenCalledTimes(1);
  });

  it('renders submitted survey state without firing another submit before completion', () => {
    const subject = createReadySubject({
      state: {
        responseUrl: 'https://example.com/submitted',
        submittedSinceLastEdit: true,
      },
    });
    subject.getPendingEditStats = jest.fn(() => ({ total: 0 }));
    subject.encryptAndUpload = jest.fn();

    const panel = getAuthoringPanel(subject);
    const button = findSubmitButton(panel.props.submitResponseButton);
    const submittedIndicator = findSubmittedIndicator(panel.props.submitResponseButton);

    expect(panel.props.showInlineSubmit).toBe(true);
    expect(panel.props.showTopInlineSubmit).toBe(true);
    expect(button).not.toBeNull();
    expect(button.props.disabled).toBe(false);
    expect(submittedIndicator).not.toBeNull();

    button.props.onClick();

    expect(subject._submitGuard).toBe(false);
    expect(subject.encryptAndUpload).not.toHaveBeenCalled();
  });

  it('disables pending submit while an upload is already in progress', () => {
    const subject = createReadySubject({
      state: {
        isSubmitting: true,
        modifiedCount: 1,
      },
    });

    const panel = getAuthoringPanel(subject);
    const button = findSubmitButton(panel.props.submitResponseButton);

    expect(panel.props.showInlineSubmit).toBe(true);
    expect(button).not.toBeNull();
    expect(button.props.disabled).toBe(true);
  });

  it('disables single-question submit when the active prompt is still masked', () => {
    const subject = createReadySubject({
      props: {
        singleQuestionMode: true,
        questionID: 'q1',
      },
      state: {
        modifiedCount: 1,
      },
      question: { id: 'q1', type: 'freeform', prompt: '[encrypted]' },
    });

    const panel = getAuthoringPanel(subject);
    const button = findSubmitButton(panel.props.submitResponseButton);

    expect(panel.props.showInlineSubmit).toBe(true);
    expect(panel.props.showTopInlineSubmit).toBe(false);
    expect(button).not.toBeNull();
    expect(button.props.disabled).toBe(true);
  });

  it('starts primary submit only when pending edits are available', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.getPendingEditStats = jest.fn(() => ({ total: 1 }));
    subject.encryptAndUpload = jest.fn();

    subject.handlePrimarySubmitClick();

    expect(subject._submitGuard).toBe(true);
    expect(subject.encryptAndUpload).toHaveBeenCalledTimes(1);
  });

  it('falls back to modifiedCount when primary submit pending stats are unavailable', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      modifiedCount: 1,
    };
    subject.getPendingEditStats = undefined;
    subject.encryptAndUpload = jest.fn();

    subject.handlePrimarySubmitClick();

    expect(subject._submitGuard).toBe(true);
    expect(subject.encryptAndUpload).toHaveBeenCalledTimes(1);
  });

  it('submits completed responses with pending edits instead of routing to the completed response', () => {
    const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xSurveyABC',
      account: '0xABC',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      submissionComplete: true,
      modifiedCount: 2,
    };
    subject.getPendingEditStats = jest.fn(() => ({ total: 2 }));
    subject._getEffectiveDraftSlug = jest.fn(() => {
      throw new Error('pending completed submits should not resolve a response route');
    });
    subject.encryptAndUpload = jest.fn();

    subject.handlePrimarySubmitClick();

    expect(subject._getEffectiveDraftSlug).not.toHaveBeenCalled();
    expect(subject._submitGuard).toBe(true);
    expect(subject.encryptAndUpload).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it('uses modifiedCount fallback to keep completed pending edits on the submit path', () => {
    const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xSurveyABC',
      account: '0xABC',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      submissionComplete: true,
      modifiedCount: 2,
    };
    subject.getPendingEditStats = undefined;
    subject._getEffectiveDraftSlug = jest.fn(() => {
      throw new Error('fallback pending edits should not resolve a response route');
    });
    subject.encryptAndUpload = jest.fn();

    subject.handlePrimarySubmitClick();

    expect(subject._getEffectiveDraftSlug).not.toHaveBeenCalled();
    expect(subject._submitGuard).toBe(true);
    expect(subject.encryptAndUpload).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it('keeps in-flight primary submit inert before reading pending stats or routes', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      isSubmitting: true,
      submissionComplete: true,
    };
    subject.getPendingEditStats = jest.fn(() => {
      throw new Error('pending stats should not run while submitting');
    });
    subject._getEffectiveDraftSlug = jest.fn();
    subject.encryptAndUpload = jest.fn();

    subject.handlePrimarySubmitClick();

    expect(subject.getPendingEditStats).not.toHaveBeenCalled();
    expect(subject._getEffectiveDraftSlug).not.toHaveBeenCalled();
    expect(subject.encryptAndUpload).not.toHaveBeenCalled();
  });

  it('keeps submitted-without-new-edits clicks inert before completion', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      submittedSinceLastEdit: true,
      submissionComplete: false,
    };
    subject.getPendingEditStats = jest.fn(() => ({ total: 0 }));
    subject.encryptAndUpload = jest.fn();

    subject.handlePrimarySubmitClick();

    expect(subject._submitGuard).toBe(false);
    expect(subject.encryptAndUpload).not.toHaveBeenCalled();
  });

  it('routes completed survey submissions to the response view without resubmitting', () => {
    const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xSurveyABC',
      account: '0xABC',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      submissionComplete: true,
    };
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge session');
    subject.getPendingEditStats = jest.fn(() => ({ total: 0 }));
    subject.encryptAndUpload = jest.fn();

    subject.handlePrimarySubmitClick();

    expect(subject.encryptAndUpload).not.toHaveBeenCalled();
    expect(pushStateSpy).toHaveBeenCalledWith(
      {},
      '',
      '/survey/0xsurveyabc/0xabc?session=edge%20session'
    );
  });

  it('routes completed single-question submissions to the response view with the session slug', () => {
    const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'Q1',
      account: '0xABC',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      submissionComplete: true,
    };
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.getPendingEditStats = jest.fn(() => ({ total: 0 }));
    subject.encryptAndUpload = jest.fn();

    subject.handlePrimarySubmitClick();

    expect(subject.encryptAndUpload).not.toHaveBeenCalled();
    expect(pushStateSpy).toHaveBeenCalledWith(
      {},
      '',
      '/question/q1?session=edge&responder=0xabc'
    );
  });

  it('keeps completed standalone submissions inert instead of routing or resubmitting', () => {
    const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xABC',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      submissionComplete: true,
    };
    subject.getPendingEditStats = jest.fn(() => ({ total: 0 }));
    subject._getEffectiveDraftSlug = jest.fn(() => {
      throw new Error('standalone completed submits should not resolve a route slug');
    });
    subject.encryptAndUpload = jest.fn();

    subject.handlePrimarySubmitClick();

    expect(subject._getEffectiveDraftSlug).not.toHaveBeenCalled();
    expect(subject.encryptAndUpload).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it('keeps completed submissions without an account inert before resolving route slugs', () => {
    const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xSurveyABC',
      account: '',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      submissionComplete: true,
    };
    subject.getPendingEditStats = jest.fn(() => ({ total: 0 }));
    subject._getEffectiveDraftSlug = jest.fn(() => {
      throw new Error('missing-account completed submits should not resolve a route slug');
    });
    subject.encryptAndUpload = jest.fn();

    subject.handlePrimarySubmitClick();

    expect(subject._getEffectiveDraftSlug).not.toHaveBeenCalled();
    expect(subject.encryptAndUpload).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
  });
});
