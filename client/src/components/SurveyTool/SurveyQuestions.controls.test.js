import { SurveyQuestions } from './SurveyQuestions';
import BullhornToggleButton from './BullhornToggleButton';

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

  it('applies active icon classes to bullhorn button when active', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const activeButton = subject.renderBullhornToggleButton({ active: true });
    expect(activeButton?.type).toBe(BullhornToggleButton);
    expect(activeButton?.props?.active).toBe(true);

    const inactiveButton = subject.renderBullhornToggleButton({ active: false });
    expect(inactiveButton?.type).toBe(BullhornToggleButton);
    expect(inactiveButton?.props?.active).toBe(false);
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
});
