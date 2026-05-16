import { SurveyQuestions } from './SurveyQuestions';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';

const findFirstNodeByType = (node, targetType) => {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstNodeByType(child, targetType);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (node?.type === targetType) return node;
  return findFirstNodeByType(node?.props?.children, targetType);
};

describe('SurveyQuestions lock audience controls', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('locks and opens the pile lock audience menu on first click when no default gate is configured', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: {} };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');
    subject.toggleAnswerEncryption = jest.fn();
    subject.toggleAdditionalCommentsEncryption = jest.fn();
    subject.toggleLockAudienceMenu = jest.fn();

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });
    const lockButton = findFirstNodeByType(lockControl, SurveyQuestionsLockAudienceControl);
    expect(lockButton).toBeTruthy();

    lockButton.props.onLockClick();

    expect(subject.toggleLockAudienceMenu).toHaveBeenCalledWith('q1', true, 'answer');
    expect(subject.toggleAnswerEncryption).toHaveBeenCalledWith(0, 'q1', true);
    expect(subject.toggleAnswerEncryption).toHaveBeenCalledTimes(1);
    expect(subject.toggleAdditionalCommentsEncryption).not.toHaveBeenCalled();
  });

  it('opens the pile lock audience menu without locking on first click when a gate option is available', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: {} };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => ({ address: '0x00000000000000000000000000000000000000a1' }));
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');
    subject.toggleAnswerEncryption = jest.fn();
    subject.toggleAdditionalCommentsEncryption = jest.fn();
    subject.toggleLockAudienceMenu = jest.fn();

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });
    const lockButton = findFirstNodeByType(lockControl, SurveyQuestionsLockAudienceControl);
    expect(lockButton).toBeTruthy();

    lockButton.props.onLockClick();

    expect(subject.toggleLockAudienceMenu).toHaveBeenCalledWith('q1', true, 'answer');
    expect(subject.toggleAnswerEncryption).not.toHaveBeenCalled();
    expect(subject.toggleAdditionalCommentsEncryption).not.toHaveBeenCalled();
  });

  it('shows only the self audience option in pile lock menu when no gate is configured', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: { q1: true } };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });

    const audienceControl = findFirstNodeByType(lockControl, SurveyQuestionsLockAudienceControl);
    expect(audienceControl).toBeTruthy();
    expect(audienceControl.props.normalizedSelfAudienceLabel).toBe('only me');
    expect(audienceControl.props.gateOptions).toEqual([]);
  });

  it('derives lock-audience display state for additional fields with inherit mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      lockAudienceMenuByQuestion: { 'q1:additional': true },
      lockAudienceGateDetailsByQuestion: {},
    };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');

    const displayState = subject.getLockAudienceDisplayState({
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      field: { encrypted: true, encryptionAudience: 'self', audienceMode: 'inherit' },
      fieldKey: 'additional',
      lockDisabled: false,
      lockTitle: 'Comments encryption audience',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      showPlaintextOption: true,
      visualContext: 'pile',
    });

    expect(displayState.effectiveFieldKey).toBe('additional');
    expect(displayState.menuOpen).toBe(true);
    expect(displayState.followActive).toBe(true);
    expect(displayState.allowPlaintextOption).toBe(false);
    expect(displayState.isPileVisualContext).toBe(true);
    expect(displayState.buttonTitle).toBe('Choose encryption audience');
  });

  it('uses a darker pressed state for the open pile lock menu without applying the bright active glow', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: { q1: true } };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      visualContext: 'pile',
    });
    const lockButton = findFirstNodeByType(lockControl, SurveyQuestionsLockAudienceControl);

    expect(lockButton).toBeTruthy();
    expect(lockButton.props.isPileVisualContext).toBe(true);
    expect(lockButton.props.pileMenuPressed).toBe(true);
    expect(lockButton.props.showBrightLockState).toBe(false);
    expect(lockButton.props.menuOpen).toBe(true);
  });

  it('labels response gate audience options with the session name', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.getResponseGatePolicy = jest.fn(() => ({
      gates: [{
        gateId: 'default_gate',
        label: 'Registry default gate',
        sbtAddresses: ['0x1111111111111111111111111111111111111111'],
      }],
      recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
    }));
    subject.resolveLockAudienceSessionName = jest.fn(() => 'test-12');
    subject.resolveConfiguredGateLabel = jest.fn(() => 'Registry default gate');
    subject.resolveGateDisplayLabel = jest.fn(() => 'Registry default gate');

    const gateOptions = subject.getResponseGateOptions('q1');

    expect(gateOptions).toHaveLength(1);
    expect(gateOptions[0]).toEqual(expect.objectContaining({
      gateId: 'default_gate',
      label: 'test-12',
    }));
  });
});
