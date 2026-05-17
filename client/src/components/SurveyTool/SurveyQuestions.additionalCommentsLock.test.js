import { SurveyQuestions } from './SurveyQuestions';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const treeHasText = (node, text) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

const findElement = (node, predicate) => {
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

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

const nodeHasClassName = (node, className) => {
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

const findNodeByClassName = (node, className) => (
  findElement(node, (candidate) => nodeHasClassName(candidate, className))
);

const getFullQuestionLockControl = (fullQuestionCard) => {
  const footerIcons = fullQuestionCard?.props?.footerIcons;
  const children = footerIcons?.props?.children;
  return Array.isArray(children) ? children[0] : children;
};

describe('SurveyQuestions additional comment locks', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('turns off additional comment encryption when clicking the open active lock', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: { 'q1:additional': true } };
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
      answer: { encrypted: true, encryptionAudience: 'self' },
      field: { encrypted: true, encryptionAudience: 'self', audienceMode: 'explicit' },
      fieldKey: 'additional',
      lockDisabled: false,
      lockTitle: 'Encrypted comments',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      showPlaintextOption: true,
      showFollowOption: true,
    });
    expect(lockControl.type).toBe(SurveyQuestionsLockAudienceControl);
    expect(lockControl.props.effectiveFieldKey).toBe('additional');
    expect(typeof lockControl.props.onLockClick).toBe('function');

    lockControl.props.onLockClick();

    expect(subject.toggleAdditionalCommentsEncryption).toHaveBeenCalledWith(0, 'q1', false);
    expect(subject.toggleLockAudienceMenu).toHaveBeenCalledWith('q1', false, 'additional');
    expect(subject.toggleAnswerEncryption).not.toHaveBeenCalled();
  });

  it('shows the same forced audience menu in full mode when no gate is configured', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
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

    const question = {
      id: 'q1',
      type: 'freeform',
      question: 'How are you?',
    };
    const currentSurveyResponseState = {
      answers: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };

    const fullQuestionCard = subject.renderQuestion(question, 0, currentSurveyResponseState);

    const lockControl = getFullQuestionLockControl(fullQuestionCard);
    expect(lockControl.type).toBe(SurveyQuestionsLockAudienceControl);
    expect(lockControl.props.normalizedSelfAudienceLabel).toBe('only me');
    expect(lockControl.props.gateOptions).toEqual([]);
    expect(lockControl.props.allowPlaintextOption).toBe(false);
  });

  it('renders full-mode additional comments without the extra header and keeps the lock beside the field', () => {
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
      showComments: { q1: true },
    };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');

    const question = {
      id: 'q1',
      type: 'freeform',
      question: 'How are you?',
    };
    const currentSurveyResponseState = {
      answers: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };

    const fullQuestionCard = subject.renderQuestion(question, 0, currentSurveyResponseState);
    const commentsSection = fullQuestionCard.props.commentsSection;
    const inlineRow = findFirstNodeByType(commentsSection, AdditionalCommentsInlineRow);

    expect(inlineRow).not.toBeNull();
    expect(findNodeByClassName(commentsSection, styles.additionalCommentsHeader)).toBeNull();
    expect(treeHasText(commentsSection, 'Additional comments')).toBe(false);
    expect(inlineRow.props.input.type).toBe(SurveyAudioFieldInput);
    expect(inlineRow.props.input.props.placeholder).toBe('related thoughts or URLs (optional)');
    expect(renderToStaticMarkup(inlineRow)).toContain(styles.additionalCommentsInputWrap);
    expect(renderToStaticMarkup(inlineRow)).toContain(styles.additionalCommentsLockSlot);
    expect(renderToStaticMarkup(inlineRow.props.lockControl)).toContain(
      `data-testid="${E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK}"`
    );
  });
});
