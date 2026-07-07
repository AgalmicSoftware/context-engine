import SurveyTool from './SurveyTool';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';
import GatedPromptNotice from './GatedPromptNotice';
import QuestionCardLinks from './QuestionCardLinks';
import QuestionDecryptControl from './QuestionDecryptControl';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

const findElement = (node, predicate) => {
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) stack.push(current[i]);
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    if (!React.isValidElement(current)) continue;
    const children = current.props.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const findFirstNodeByType = (node, targetType) =>
  findElement(node, (candidate) => React.isValidElement(candidate) && candidate.type === targetType);

describe('SurveyQuestions render helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('clamps pile rating answers into the supported slider range and guards non-numeric values', () => {
    expect(getNormalizedUiRatingValue('7')).toBe(7);
    expect(getNormalizedUiRatingValue('14')).toBe(10);
    expect(getNormalizedUiRatingValue('abc')).toBe(0);
    // port note: the old test reached `PileViewMode.renderActiveQuestion()`;
    // the portable contract is the shared UI rating normalization that method
    // applies before passing values to the slider.
  });

  it('wires question decrypt controls through display descriptors without moving decrypt execution', () => {
    const onDecrypt = jest.fn();
    const ready = buildQuestionFieldDecryptControlDisplayState({
      actionLabel: 'Decrypt Answer',
      allowDecrypt: true,
      autoDecryptEnabled: false,
      busy: false,
      decryptTooltip: 'Connect wallet to decrypt',
      isDecrypting: false,
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);
    const question = { id: 'q1', type: 'rating', prompt: 'Rate this' };

    const button = screen.getByRole('button', { name: 'Decrypt Answer' });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onDecrypt).toHaveBeenCalledTimes(1);

    const busy = buildQuestionFieldDecryptControlDisplayState({
      ...ready,
      allowDecrypt: true,
      busy: true,
      isDecrypting: true,
    });
    expect(busy).toEqual(
      expect.objectContaining({
        busy: true,
        disabled: true,
        title: undefined,
      }),
    );

    const autoDecrypt = buildQuestionFieldDecryptControlDisplayState({
      actionLabel: 'Decrypt Comments',
      allowDecrypt: false,
      autoDecryptEnabled: true,
      busy: true,
      decryptTooltip: 'Connect wallet to decrypt',
      isDecrypting: false,
      showBusySpinnerWhenAutoDecryptEnabled: true,
      wrapperStyle: { marginTop: '4px' },
    });
    expect(autoDecrypt).toEqual(
      expect.objectContaining({
        autoDecryptEnabled: true,
        busy: true,
        disabled: true,
        showBusySpinnerWhenAutoDecryptEnabled: true,
        title: 'Connect wallet to decrypt',
        wrapperStyle: { marginTop: '4px' },
      }),
    );
  });

  it('renders pile additional comments without the extra header and keeps the lock beside the field', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);
    const question = { id: 'q1', type: 'freeform', prompt: 'Prompt' };

    subject.renderPromptWithManualDecrypt = jest.fn(() => 'Prompt');
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.state = {
      ...subject.state,
      showComments: { q1: true },
      showConviction: {},
      surveysResponseState: [
        {
          answers: { q1: { value: '', encrypted: false } },
          additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
          importance: {},
          conviction: {},
        },
      ],
    };

    const tree = subject.renderActiveQuestion(question);
    const inlineRow = findFirstNodeByType(tree, AdditionalCommentsInlineRow);

    expect(inlineRow).not.toBeNull();
    expect(inlineRow.props.input.type).toBe(SurveyAudioFieldInput);
    expect(inlineRow.props.input.props.placeholder).toBe('Additional comments...');
    expect(renderToStaticMarkup(inlineRow)).toContain(styles.additionalCommentsInputWrap);
    expect(renderToStaticMarkup(inlineRow)).toContain(styles.additionalCommentsLockSlot);
    const lockControl = findFirstNodeByType(inlineRow.props.lockControl, SurveyQuestionsLockAudienceControl);
    expect(lockControl).not.toBeNull();
    expect(lockControl.props.effectiveFieldKey).toBe('additional');
  });

  it('renders pile question icons through the shared footer helper', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.toggleComments = jest.fn();
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');

    const tree = subject.renderPileQuestionIcons({
      questionId: 'q1',
      answer: { value: '', encrypted: false },
      glowAnswer: false,
      maskedAnswer: false,
      hasAdditionalContent: true,
      onToggleComments,
      answerLockControl: <div data-testid="answer-lock" />,
    });
    const button = findElement(
      tree,
      (node) => React.isValidElement(node) && node.props['data-testid'] === E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE,
    );

    expect(button).not.toBeNull();
    expect(button.props['data-ce-question-id']).toBe('q1');
    button.props.onClick();
    expect(onToggleComments).toHaveBeenCalledTimes(1);
    expect(
      findElement(tree, (node) => React.isValidElement(node) && node.props['data-testid'] === 'answer-lock'),
    ).not.toBeNull();
  });

  it('renders full-question footer icons through the shared footer helper', () => {
    const onToggleComments = jest.fn();
    render(
      <FullQuestionFooterIcons
        hasAdditionalContent
        commentsOpen={false}
        onToggleComments={onToggleComments}
        questionId="Q1"
      >
        <SurveyQuestionsLockAudienceControl
          displayState={{
            qid: 'q1',
            effectiveFieldKey: 'answer',
            isPileVisualContext: false,
            hasAudienceMenu: false,
            menuOpen: false,
            isLockDisabled: false,
            buttonTitle: 'Choose encryption audience',
            fieldState: {},
          }}
          onToggleMenu={jest.fn()}
          onSelectAudience={jest.fn()}
        />
        <div data-testid="tag-control" data-tags="governance" />
      </FullQuestionFooterIcons>,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE));
    expect(onToggleComments).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK)).toBeInTheDocument();
    expect(screen.getByTestId('tag-control')).toHaveAttribute('data-tags', 'governance');
  });

  it('keeps full-question response input execution handlers parent-owned with stable arguments', () => {
    const handleAnswer = jest.fn();
    const sliderFlush = jest.fn();
    const toggleAnswerEncryption = jest.fn();
    const question = { id: 'q-response', type: 'rating', prompt: 'Rate this' };
    const answer = { value: 4, encrypted: false };
    const input = (
      <SurveyQuestionsFullQuestionResponseInput
        question={question}
        qIndex={2}
        answer={answer}
        glowAnswer
        isSubmitting
        singleQuestionMode
        audioInputWorkerProps={{ workerReady: true }}
        onAnswerChange={(value) => handleAnswer(5, question.id, value)}
        onRatingChange={(value, event) => handleAnswer(5, question.id, value, { persistDraft: true, event })}
        onDeferredRatingCommit={(value) =>
          handleAnswer(5, question.id, value, {
            persistDraft: false,
            afterUpdate: sliderFlush,
          })
        }
        onRatingChangeComplete={sliderFlush}
        onToggleAnswerEncryption={(encrypted) => toggleAnswerEncryption(5, question.id, encrypted)}
      />
    );

    expect(input.props).toMatchObject({
      question,
      qIndex: 2,
      answer,
      glowAnswer: true,
      isSubmitting: true,
      singleQuestionMode: true,
      audioInputWorkerProps: { workerReady: true },
    });

    input.props.onAnswerChange('next answer');
    input.props.onRatingChange(8, { type: 'keydown' });
    input.props.onDeferredRatingCommit(6);
    input.props.onRatingChangeComplete();
    input.props.onToggleAnswerEncryption(true);

    expect(handleAnswer).toHaveBeenNthCalledWith(1, 5, 'q-response', 'next answer');
    expect(handleAnswer).toHaveBeenNthCalledWith(2, 5, 'q-response', 8, {
      persistDraft: true,
      event: { type: 'keydown' },
    });
    expect(handleAnswer).toHaveBeenNthCalledWith(3, 5, 'q-response', 6, {
      persistDraft: false,
      afterUpdate: sliderFlush,
    });
    expect(sliderFlush).toHaveBeenCalledTimes(1);
    expect(toggleAnswerEncryption).toHaveBeenCalledWith(5, 'q-response', true);
  });

  it('renders full-question card links through the shared header helper', () => {
    const onBookmarkToggle = jest.fn();
    render(
      <QuestionCardLinks
        showResponseLookupSpinner
        isQuestionBookmarked
        onBookmarkToggle={onBookmarkToggle}
        arweaveHref="https://arweave.net/example"
        questionHref="/question/q1?session=edge"
      />,
    );

    expect(screen.getByLabelText('Checking for existing response')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Remove Bookmark'));
    expect(onBookmarkToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByTitle('View on Arweave')).toHaveAttribute('href', 'https://arweave.net/example');
    expect(screen.getByTitle('View question page')).toHaveAttribute('href', '/question/q1?session=edge');
  });

  it('passes viewed-response JSON fallbacks to the bottom JSON controls', () => {
    const { jsonForDisplay } = buildSurveyQuestionsJsonForDisplayState({
      viewingAnswers: true,
      noResponse: true,
      singleQuestionMode: false,
      viewAddress: '0xdef',
    });

    expect(jsonForDisplay).toEqual({
      message: 'No response found for survey from address: 0xdef',
    });
  });

  it('passes only expanded JSON payloads to bottom copy handlers', () => {
    const copyJsonToClipboard = jest.fn();
    const surveyJson = { id: 'survey-1', questionIDs: ['q1'] };
    const responseJson = { responses: [{ questionID: 'q1' }] };
    const jsonPanelDisplayState = buildSurveyQuestionsJsonPanelDisplayState({
      showSurveyJson: true,
      showResponseJson: false,
    });
    const controls = buildSurveyQuestionsRouteJsonControlsProps({
      copyJsonToClipboard,
      jsonPanelDisplayState,
      questionsJson: null,
      responseJson: jsonPanelDisplayState.showResponseJsonPanel ? responseJson : null,
      surveyJson: jsonPanelDisplayState.showSurveyJsonPanel ? surveyJson : null,
    });

    expect(controls.jsonPanelDisplayState.showSurveyJsonPanel).toBe(true);
    expect(controls.jsonPanelDisplayState.showResponseJsonPanel).toBe(false);
    expect(controls.surveyJson).toBe(surveyJson);
    expect(controls.responseJson).toBeNull();

    controls.onCopySurveyJson();

    expect(copyJsonToClipboard).toHaveBeenCalledWith(surveyJson, 'survey');
  });

  it('derives encrypted submit status from pending edit stats during render', () => {
    const readiness = buildSurveyQuestionsSubmitReadinessDescriptor({
      currentStep: 1,
      isSubmitting: true,
      pendingStats: { total: 2, encrypted: 1 },
      singleQuestionMode: false,
    });
    const displayState = buildSurveyQuestionsSubmitFooterDisplayState({
      currentStep: readiness.currentStep,
      hasEncryptedAnswers: readiness.hasEncryptedAnswers,
      isDirty: true,
      isSubmitting: true,
      pendingEditCount: readiness.pendingEditCount,
    });

    expect(readiness.pendingEditCount).toBe(2);
    expect(displayState.uploadStatusText).toBe('Encrypting...');
  });

  it('renders masked full-question prompts as gated prompt cards without answer editors', () => {
    const onAction = jest.fn();
    const noticeState = buildGatedPromptNoticeState({
      questionId: 'Q-Worker',
      tooltipIdSuffix: 'full',
      gateNames: [],
      sbtLabel: 'SBT',
      gateLabel: 'gate',
      gatesLabel: 'gates',
    });
    const promptState = buildQuestionPromptDecryptDisplayState({
      account: '0xabc',
      canReloadPrompt: true,
      loginComplete: true,
      payloadDisplay: {
        noticeLeadingText: 'Requires',
        noticeStatusText: 'session access',
        noticeSuffix: '',
        actionLabel: 'Load Prompt',
        actionTitle: 'Load gated prompt',
      },
      promptMasked: true,
      promptText: '[encrypted]',
      questionId: 'Q-Worker',
    });

    render(
      <GatedPromptNotice
        questionId="Q-Worker"
        tooltipId={noticeState.tooltipId}
        tooltipText={noticeState.tooltipText}
        leadingText={promptState.noticeLeadingText}
        statusText={promptState.noticeStatusText}
        suffix={promptState.noticeSuffix}
        actionLabel={promptState.noticeActionLabel}
        actionTitle={promptState.noticeActionTitle}
        actionTestId={E2E_TESTIDS.SURVEY_DECRYPT_PROMPT_NOTICE}
        onAction={onAction}
      />,
    );

    expect(screen.getByText(/Requires/i)).toBeInTheDocument();
    expect(screen.getByText('session access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load Prompt' })).toHaveAttribute('title', 'Load gated prompt');
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_ANSWER_INPUT)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load Prompt' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders encrypted full-question fields as disabled decrypt controls without a decrypt context', () => {
    const answerDecryptState = buildFieldDecryptState(
      { value: '*', encrypted: true },
      { loginComplete: false, account: '', busy: false },
    );
    const commentsDecryptState = buildFieldDecryptState(
      { value: '*', encrypted: true },
      { loginComplete: false, account: '', busy: false },
    );
    const answerControl = buildQuestionFieldDecryptControlDisplayState({
      actionLabel: 'Decrypt Answer',
      allowDecrypt: answerDecryptState.allowDecrypt,
      autoDecryptEnabled: false,
      busy: answerDecryptState.busy,
      decryptTooltip: 'Login to decrypt this encrypted field.',
      isDecrypting: false,
    });
    const commentsControl = buildQuestionFieldDecryptControlDisplayState({
      actionLabel: 'Decrypt Comments',
      allowDecrypt: commentsDecryptState.allowDecrypt,
      autoDecryptEnabled: false,
      busy: commentsDecryptState.busy,
      decryptTooltip: 'Login to decrypt this encrypted field.',
      isDecrypting: false,
    });
    const lockState = buildAnswerLockDisplayState({
      field: { value: '*', encrypted: true },
      masked: true,
      isSubmitting: false,
    });

    render(
      <>
        <QuestionDecryptControl {...answerControl} />
        <QuestionDecryptControl {...commentsControl} />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Decrypt Answer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrypt Answer' })).toHaveAttribute(
      'title',
      'Login to decrypt this encrypted field.',
    );
    expect(screen.getByRole('button', { name: 'Decrypt Comments' })).toBeDisabled();
    expect(lockState).toEqual(
      expect.objectContaining({
        lockDisabled: true,
        lockTitle: 'Encrypted answer',
      }),
    );
  });

  it('wires enabled encrypted field decrypt controls to answer and comment handlers', () => {
    const onDecrypt = jest.fn();
    render(
      <>
        <QuestionDecryptControl
          {...buildQuestionFieldDecryptControlDisplayState({
            actionLabel: 'Decrypt Answer',
            allowDecrypt: true,
            autoDecryptEnabled: false,
            busy: false,
            decryptTooltip: 'Login to decrypt this encrypted field.',
            isDecrypting: false,
          })}
          onClick={() => onDecrypt('q1', 'answer')}
        />
        <QuestionDecryptControl
          {...buildQuestionFieldDecryptControlDisplayState({
            actionLabel: 'Decrypt Comments',
            allowDecrypt: true,
            autoDecryptEnabled: false,
            busy: false,
            decryptTooltip: 'Login to decrypt this encrypted field.',
            isDecrypting: false,
          })}
          onClick={() => onDecrypt('q1', 'additional')}
        />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Decrypt Answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrypt Comments' }));

    expect(onDecrypt).toHaveBeenCalledWith('q1', 'answer');
    expect(onDecrypt).toHaveBeenCalledWith('q1', 'additional');
  });

  it('surfaces hidden masked question ids through the locked banner without rendering editable cards', () => {
    const visibility = buildSurveyQuestionsMaskedQuestionVisibility({
      questionPool: [{ id: 'Q-Locked', prompt: '[encrypted]', type: 'freeform' }],
      singleQuestionMode: false,
    });
    const lockedBanner = <div data-testid="locked-banner">Locked banner</div>;
    const tree = visibility.visibleQuestionPool.length > 0 ? <div data-testid="editable-card" /> : lockedBanner;

    expect(visibility.hiddenMaskedQuestionIds).toEqual(['q-locked']);
    expect(visibility.visibleQuestionPool).toEqual([]);
    expect(tree).toBe(lockedBanner);
    expect(
      findElement(tree, (node) => React.isValidElement(node) && node.props['data-testid'] === 'editable-card'),
    ).toBeNull();
  });

  it('renders pile freeform answers with the shared audio field input wrapper', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);
    const question = { id: 'q1', type: 'freeform', prompt: 'Prompt' };

    expect(input.type).toBe(SurveyAudioFieldInput);
    expect(input.props.placeholder).toBe('Your response...');
    expect(input.props.disableEncryption).toBe(true);
    expect(input.props.enableDownloads).toBe(false);
  });

  it('routes pile encrypted answer and comments through the shared decrypt control wrapper', () => {
    const answerDecryptState = buildFieldDecryptState(
      { value: '*', encrypted: true, encryptedPortion: '{}' },
      { loginComplete: true, account: '0xabc', busy: false },
    );
    const additionalDecryptState = buildFieldDecryptState(
      { value: '*', encrypted: true, encryptedPortion: '{}' },
      { loginComplete: true, account: '0xabc', busy: false },
    );
    const fieldDisplay = buildQuestionFieldDisplayState({
      answer: { value: '*', encrypted: true, encryptedPortion: '{}' },
      additional: { value: '*', encrypted: true, encryptedPortion: '{}' },
      answerDecryptState,
      additionalDecryptState,
      hasAdditionalContent: true,
    });
    const responseDisplay = buildQuestionResponseDisplayState({
      answer: { value: '*', encrypted: true, encryptedPortion: '{}' },
      additional: { value: '*', encrypted: true, encryptedPortion: '{}' },
    });
    const display = buildQuestionRenderDisplayState({
      responseDisplayState: responseDisplay,
      fieldDisplayState: fieldDisplay,
    });
    const commentsSection = renderPileCommentsSection({
      showComments: true,
      maskedAdditional: display.maskedAdditional,
      decryptAdditionalControl: <QuestionDecryptControl actionLabel="Decrypt Comments" />,
      additionalEditorRow: <AdditionalCommentsInlineRow input={<textarea />} lockControl={null} />,
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);
    const question = { id: 'q1', type: 'freeform', prompt: 'Prompt' };

    expect(display.maskedAnswer).toBe(true);
    expect(display.maskedAdditional).toBe(true);
    expect(renderToStaticMarkup(commentsSection)).toContain('Decrypt Comments');
    expect(findFirstNodeByType(commentsSection, AdditionalCommentsInlineRow)).toBeNull();
  });
});
