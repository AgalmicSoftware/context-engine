import { SurveyQuestions } from './SurveyQuestions';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';
import styles from './SurveyTool.module.scss';
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

const renderStandaloneQuestion = () =>
  renderSurveyQuestions({
    singleQuestionMode: false,
    isStandalone: true,
    surveyIndex: 0,
    account: '0xabc',
    loginComplete: true,
    network: { id: 84532 },
    questionPool: [question],
    isQuestionCacheReady: true,
  });

const getAdditionalLockIconName = () =>
  screen.getByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK).querySelector('svg')?.getAttribute('data-icon');

const getFullQuestionLockControl = (fullQuestionCard) => {
  const footerIcons = fullQuestionCard?.props?.footerIcons;
  const children = footerIcons?.props?.children;
  return Array.isArray(children) ? children[0] : children;
};

const getAdditionalCommentsContainer = () =>
  screen.getByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT).closest(`.${styles.fullQuestionComments}`);

const getAdditionalLockIconName = () =>
  screen.getByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK).querySelector('svg')?.getAttribute('data-icon');

describe('SurveyQuestions additional comment locks', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('turns off additional comment encryption by clicking the active lock', async () => {
    renderStandaloneQuestion();

    const additionalInput = await openAdditionalComments();
    expect(additionalInput).toHaveAttribute('placeholder', 'related thoughts or URLs (optional)');
    expect(getAdditionalLockIconName()).toBe('unlock');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK));
    expect(await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF));
    await waitFor(() => {
      expect(getAdditionalLockIconName()).toBe('lock');
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK));

    await waitFor(() => {
      expect(getAdditionalLockIconName()).toBe('unlock');
    });
    expect(lockControl.type).toBe(SurveyQuestionsLockAudienceControl);
    expect(lockControl.props.effectiveFieldKey).toBe('additional');
    expect(typeof lockControl.props.onLockClick).toBe('function');

    lockControl.props.onLockClick();

    expect(subject.toggleAdditionalCommentsEncryption).toHaveBeenCalledWith(0, 'q1', false);
    expect(subject.toggleLockAudienceMenu).toHaveBeenCalledWith('q1', false, 'additional');
    expect(subject.toggleAnswerEncryption).not.toHaveBeenCalled();
  });

  it('shows the same forced audience menu in full mode when no gate is configured', async () => {
    renderStandaloneQuestion();

    await screen.findByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK));

    const fullQuestionCard = subject.renderQuestion(question, 0, currentSurveyResponseState);

    const lockControl = getFullQuestionLockControl(fullQuestionCard);
    expect(lockControl.type).toBe(SurveyQuestionsLockAudienceControl);
    expect(lockControl.props.normalizedSelfAudienceLabel).toBe('only me');
    expect(lockControl.props.gateOptions).toEqual([]);
    expect(lockControl.props.allowPlaintextOption).toBe(false);
  });

  it('renders full-mode additional comments without the extra header and keeps the lock beside the field', async () => {
    renderStandaloneQuestion();

    const additionalInput = await openAdditionalComments();
    const commentsContainer = getAdditionalCommentsContainer();

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
