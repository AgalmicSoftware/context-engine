import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const question = {
  id: 'q1',
  type: 'freeform',
  question: 'How are you?',
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

const openAdditionalComments = async () => {
  const commentsToggle = await screen.findByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE);
  fireEvent.click(commentsToggle);
  return screen.findByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT);
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

  it('turns off additional comment encryption when clicking the open active lock', async () => {
    renderStandaloneQuestion();

    const additionalInput = await openAdditionalComments();
    expect(additionalInput).toHaveAttribute('placeholder', 'related thoughts or URLs (optional)');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK));
    expect(await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF));
    await waitFor(() => {
      expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF)).not.toBeInTheDocument();
    });
    expect(getAdditionalLockIconName()).toBe('lock');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK));
    expect(await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK));

    await waitFor(() => {
      expect(getAdditionalLockIconName()).toBe('unlock');
    });
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF)).not.toBeInTheDocument();
  });

  it('shows the same forced audience menu in full mode when no gate is configured', async () => {
    renderStandaloneQuestion();

    await screen.findByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK));

    const selfOption = await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF);
    expect(selfOption).toHaveTextContent('only me');
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_NONE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_FOLLOW)).not.toBeInTheDocument();
  });

  it('renders full-mode additional comments without the extra header and keeps the lock beside the field', async () => {
    renderStandaloneQuestion();

    const additionalInput = await openAdditionalComments();
    const commentsContainer = getAdditionalCommentsContainer();

    expect(commentsContainer).not.toBeNull();
    expect(commentsContainer.querySelector(`.${styles.additionalCommentsHeader}`)).toBeNull();
    expect(commentsContainer).not.toHaveTextContent('Additional comments');
    expect(additionalInput).toHaveAttribute('placeholder', 'related thoughts or URLs (optional)');
    expect(additionalInput).toHaveAttribute('data-ce-question-id', 'q1');
    expect(commentsContainer.querySelector(`.${styles.additionalCommentsInputWrap}`)).not.toBeNull();
    expect(commentsContainer.querySelector(`.${styles.additionalCommentsLockSlot}`)).not.toBeNull();
    expect(within(commentsContainer).getByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK)).toBeInTheDocument();
  });
});
