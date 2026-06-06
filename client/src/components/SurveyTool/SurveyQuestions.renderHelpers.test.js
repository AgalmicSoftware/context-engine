import SurveyTool from './SurveyTool';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';
import GatedPromptNotice from './GatedPromptNotice';
import QuestionCardLinks from './QuestionCardLinks';
import QuestionDecryptControl from './QuestionDecryptControl';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import SurveyQuestionsAuthoringPanel from './SurveyQuestionsAuthoringPanel';
import SurveyQuestionsFullQuestionCardShell from './SurveyQuestionsFullQuestionCardShell';
import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import SurveyQuestionsJsonControls from './SurveyQuestionsJsonControls';
import SurveyQuestionsSubmitFooter from './SurveyQuestionsSubmitFooter';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const treeHasDataTestId = (node, testId) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasDataTestId(child, testId));
  if (typeof node !== 'object') return false;
  if (node?.props?.['data-testid'] === testId) return true;
  return treeHasDataTestId(node?.props?.children, testId);
};

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

const countElements = (node, predicate) => {
  let count = 0;
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
    if (predicate(current)) count += 1;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }

  return count;
};

describe('SurveyQuestions render helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('clamps pile rating answers into the supported slider range and guards non-numeric values', () => {
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
    const question = { id: 'q1', type: 'rating', prompt: 'Rate this' };

    subject.renderPromptWithManualDecrypt = jest.fn(() => 'Rate this');
    subject.state = {
      ...subject.state,
      showComments: {},
      showConviction: {},
      surveysResponseState: [
        {
          answers: { q1: { value: '7', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    let tree = subject.renderActiveQuestion(question);
    let slider = findElement(tree, (node) => (
      node?.props?.min === 0 &&
      node?.props?.max === 10 &&
      node?.props?.step === 1 &&
      node?.props?.value !== undefined &&
      typeof node?.props?.onChange === 'function'
    ));
    expect(slider).not.toBeNull();
    expect(slider.props.value).toBe(7);
    expect(nodeHasClassName(slider, styles.ratingSlider)).toBe(true);
    expect(typeof slider.props.onChangeComplete).toBe('function');
    expect(treeHasText(tree, '7')).toBe(true);

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: { q1: { value: '14', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    tree = subject.renderActiveQuestion(question);
    slider = findElement(tree, (node) => (
      node?.props?.min === 0 &&
      node?.props?.max === 10 &&
      node?.props?.step === 1 &&
      node?.props?.value !== undefined &&
      typeof node?.props?.onChange === 'function'
    ));
    expect(slider).not.toBeNull();
    expect(slider.props.value).toBe(10);
    expect(treeHasText(tree, '10')).toBe(true);

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: { q1: { value: 'abc', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    tree = subject.renderActiveQuestion(question);
    slider = findElement(tree, (node) => (
      node?.props?.min === 0 &&
      node?.props?.max === 10 &&
      node?.props?.step === 1 &&
      node?.props?.value !== undefined &&
      typeof node?.props?.onChange === 'function'
    ));
    expect(slider).not.toBeNull();
    expect(slider.props.value).toBe(0);
    expect(nodeHasClassName(slider, styles.ratingSlider)).toBe(true);
    expect(treeHasText(tree, '0')).toBe(true);
  });

  it('wires question decrypt controls through display descriptors without moving decrypt execution', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.handleDecryptQuestionAnswer = jest.fn();
    subject.state = {
      ...subject.state,
      autoDecryptEnabled: false,
      isDecrypting: false,
    };

    const readyControl = subject.renderQuestionFieldDecryptControl({
      questionId: 'Q1',
      fieldKey: 'answer',
      allowDecrypt: true,
      decryptTooltip: 'Connect wallet to decrypt',
      actionLabel: 'Decrypt Answer',
      busy: false,
    });
    expect(readyControl?.type).toBe(QuestionDecryptControl);
    expect(readyControl?.props).toMatchObject({
      actionLabel: 'Decrypt Answer',
      autoDecryptEnabled: false,
      busy: false,
      disabled: false,
      showBusySpinnerWhenAutoDecryptEnabled: false,
      title: undefined,
    });

    readyControl.props.onClick();
    expect(subject.handleDecryptQuestionAnswer).toHaveBeenCalledWith('Q1', 'answer');

    subject.state = {
      ...subject.state,
      isDecrypting: true,
    };
    const busyControl = subject.renderQuestionFieldDecryptControl({
      questionId: 'Q1',
      fieldKey: 'answer',
      allowDecrypt: true,
      decryptTooltip: 'Connect wallet to decrypt',
      actionLabel: 'Decrypt Answer',
      busy: true,
    });
    expect(busyControl?.props).toMatchObject({
      busy: true,
      disabled: true,
      title: undefined,
    });

    subject.state = {
      ...subject.state,
      autoDecryptEnabled: true,
      isDecrypting: false,
    };
    const autoDecryptControl = subject.renderQuestionFieldDecryptControl({
      questionId: 'Q1',
      fieldKey: 'additional',
      allowDecrypt: false,
      decryptTooltip: 'Connect wallet to decrypt',
      actionLabel: 'Decrypt Comments',
      busy: true,
      showBusySpinnerWhenAutoDecryptEnabled: true,
      wrapperStyle: { marginTop: '4px' },
    });
    expect(autoDecryptControl?.props).toMatchObject({
      actionLabel: 'Decrypt Comments',
      autoDecryptEnabled: true,
      busy: true,
      disabled: true,
      showBusySpinnerWhenAutoDecryptEnabled: true,
      title: 'Connect wallet to decrypt',
      wrapperStyle: { marginTop: '4px' },
    });
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
    expect(findNodeByClassName(tree, styles.additionalCommentsHeader)).toBeNull();
    expect(treeHasText(tree, 'Additional comments')).toBe(false);
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
    });
    const commentsButton = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE
    );

    expect(commentsButton).not.toBeNull();
    commentsButton.props.onClick();
    expect(subject.toggleComments).toHaveBeenCalledWith('q1');
    expect(findFirstNodeByType(tree, SurveyQuestionsLockAudienceControl)).not.toBeNull();
  });

  it('renders full-question footer icons through the shared footer helper', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.toggleComments = jest.fn();
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject._getEffectiveDraftSlug = () => 'edge';

    const tree = subject.renderFullQuestionFooterIcons({
      surveyIndex: 0,
      question: {
        id: 'q1',
        prompt: 'Question prompt',
        tags: ['governance'],
      },
      answer: { value: '', encrypted: false },
      glowAnswer: false,
      maskedAnswer: false,
      hasAdditionalContent: true,
      commentsOpen: false,
      onToggleComments: () => subject.toggleComments('q1', true),
    });
    const footer = findFirstNodeByType(tree, FullQuestionFooterIcons);
    const dropdown = findElement(
      tree,
      (node) => node?.type === SurveyQuestionTagControl
    );

    expect(footer).not.toBeNull();
    expect(typeof footer.props.onToggleComments).toBe('function');
    footer.props.onToggleComments();
    expect(subject.toggleComments).toHaveBeenCalledWith('q1', true);
    expect(findFirstNodeByType(tree, SurveyQuestionsLockAudienceControl)).not.toBeNull();
    expect(dropdown).toBeTruthy();
    expect(dropdown.props.tags).toEqual(['governance']);
  });

  it('keeps full-question response input execution handlers parent-owned with stable arguments', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 5,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const audioInputWorkerProps = { workerReady: true };
    const sliderFlush = jest.fn();
    subject.getAudioInputWorkerProps = jest.fn(() => audioInputWorkerProps);
    subject.handleAnswer = jest.fn();
    subject.flushDraftPersistAfterSliderChange = sliderFlush;
    subject.toggleAnswerEncryption = jest.fn();
    subject.state = {
      ...subject.state,
      isSubmitting: true,
    };

    const question = { id: 'q-response', type: 'rating', prompt: 'Rate this' };
    const answer = { value: 4, encrypted: false };
    const input = subject.renderFullQuestionResponseInput({
      question,
      qIndex: 2,
      surveyIndex: 5,
      answer,
      glowAnswer: true,
    });

    expect(input?.type).toBe(SurveyQuestionsFullQuestionResponseInput);
    expect(input?.props).toMatchObject({
      question,
      qIndex: 2,
      answer,
      glowAnswer: true,
      isSubmitting: true,
      singleQuestionMode: true,
      audioInputWorkerProps,
    });
    expect(input.props.audioInputWorkerProps).toBe(audioInputWorkerProps);

    input.props.onAnswerChange('next answer');
    input.props.onRatingChange(8, { type: 'keydown' });
    input.props.onDeferredRatingCommit(6);
    input.props.onRatingChangeComplete();
    input.props.onToggleAnswerEncryption(true);

    expect(subject.handleAnswer).toHaveBeenNthCalledWith(1, 5, 'q-response', 'next answer');
    expect(subject.handleAnswer).toHaveBeenNthCalledWith(2, 5, 'q-response', 8, { persistDraft: true });
    expect(subject.handleAnswer).toHaveBeenNthCalledWith(3, 5, 'q-response', 6, {
      persistDraft: false,
      afterUpdate: sliderFlush,
    });
    expect(sliderFlush).toHaveBeenCalledTimes(1);
    expect(subject.toggleAnswerEncryption).toHaveBeenCalledWith(5, 'q-response', true);
  });

  it('renders full-question card links through the shared header helper', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.handleBookmarkToggle = jest.fn();
    subject._getEffectiveDraftSlug = () => 'edge';

    const tree = subject.renderFullQuestionCardIcons({
      question: {
        id: 'q1',
        arweaveTxId: 'https://arweave.net/example',
      },
      showResponseLookupSpinner: true,
      isQuestionBookmarked: true,
    });
    const links = findFirstNodeByType(tree, QuestionCardLinks);

    expect(links).not.toBeNull();
    expect(links.props.showResponseLookupSpinner).toBe(true);
    expect(links.props.isQuestionBookmarked).toBe(true);
    expect(links.props.arweaveHref).toContain('arweave.net');
    expect(links.props.questionHref).toContain('/question/q1');
    links.props.onBookmarkToggle();
    expect(subject.handleBookmarkToggle).toHaveBeenCalledWith('q1');
  });

  it('passes viewed-response JSON fallbacks to the bottom JSON controls', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      viewAddress: '0xdef',
      loginComplete: true,
      network: { id: 84532 },
      isQuestionCacheReady: true,
    });
    subject.getResponseJson = jest.fn(() => ({ generated: true }));
    subject.getMemoizedLockedQuestionGateDetails = jest.fn(() => []);
    subject.renderLockedQuestionsPanel = jest.fn(() => null);
    subject.state = {
      ...subject.state,
      displayAnswerMode: true,
      noResponse: true,
      questionPool: [{ id: 'q1', type: 'freeform' }],
      showResponseJson: true,
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
    };

    const tree = subject.render();
    const controls = findFirstNodeByType(tree, SurveyQuestionsJsonControls);

    expect(controls).not.toBeNull();
    expect(controls.props.responseJson).toEqual({
      message: 'No response found for survey from address: 0xdef',
    });
    expect(subject.getResponseJson).not.toHaveBeenCalled();
  });

  it('passes only expanded JSON payloads to bottom copy handlers', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      isQuestionCacheReady: true,
    });
    const surveyJson = { id: 'survey-1', questionIDs: ['q1'] };
    subject.getSurveyJson = jest.fn(() => surveyJson);
    subject.getResponseJson = jest.fn(() => ({ responses: [{ questionID: 'q1' }] }));
    subject.copyJsonToClipboard = jest.fn();
    subject.getMemoizedLockedQuestionGateDetails = jest.fn(() => []);
    subject.renderLockedQuestionsPanel = jest.fn(() => null);
    subject.state = {
      ...subject.state,
      displayAnswerMode: true,
      parsedViewAddressAnswers: { responses: [] },
      questionPool: [{ id: 'q1', type: 'freeform' }],
      showSurveyJson: true,
      showResponseJson: false,
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
    };

    const tree = subject.render();
    const controls = findFirstNodeByType(tree, SurveyQuestionsJsonControls);

    expect(controls).not.toBeNull();
    expect(controls.props.jsonPanelDisplayState.showSurveyJsonPanel).toBe(true);
    expect(controls.props.jsonPanelDisplayState.showResponseJsonPanel).toBe(false);
    expect(controls.props.surveyJson).toBe(surveyJson);
    expect(controls.props.responseJson).toBeNull();
    expect(subject.getSurveyJson).toHaveBeenCalledTimes(1);
    expect(subject.getResponseJson).not.toHaveBeenCalled();

    controls.props.onCopySurveyJson();

    expect(subject.copyJsonToClipboard).toHaveBeenCalledWith(surveyJson, 'survey');
  });

  it('derives encrypted submit status from pending edit stats during render', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      isQuestionCacheReady: true,
    });
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 2, encrypted: 1 }));
    subject.getMemoizedLockedQuestionGateDetails = jest.fn(() => []);
    subject.renderLockedQuestionsPanel = jest.fn(() => null);
    subject.state = {
      ...subject.state,
      currentStep: 1,
      isDirty: true,
      isSubmitting: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question' }],
      surveysResponseState: [{
        answers: { q1: { value: 'yes', encrypted: true } },
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
    };

    const tree = subject.render();
    const authoringPanel = findFirstNodeByType(tree, SurveyQuestionsAuthoringPanel);
    const footer = findFirstNodeByType(authoringPanel?.props?.submitResponseButton, SurveyQuestionsSubmitFooter);

    expect(authoringPanel).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(footer.props.pendingEditCount).toBe(2);
    expect(footer.props.displayState.uploadStatusText).toBe('Encrypting...');
  });

  it('renders masked full-question prompts as gated prompt cards without answer editors', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.handleReloadMaskedPrompt = jest.fn();
    subject.state = {
      ...subject.state,
      decryptingByKey: {},
    };

    const tree = subject.renderQuestion(
      {
        id: 'Q-Worker',
        type: 'freeform',
        prompt: '[encrypted]',
        payloadAccessMode: 'worker_sbt_gate',
      },
      0,
      {
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }
    );
    const promptButton = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_DECRYPT_PROMPT
    );
    const notice = findFirstNodeByType(tree, GatedPromptNotice);

    expect(promptButton).not.toBeNull();
    expect(promptButton.props.title).toBe('Load gated prompt');
    expect(treeHasText(tree, 'Requires session access')).toBe(true);
    expect(notice).not.toBeNull();
    expect(notice.props.statusText).toBe('requires session access');
    expect(notice.props.actionLabel).toBe('Load Prompt');
    expect(notice.props.actionTitle).toBe('Load gated prompt');
    expect(findFirstNodeByType(tree, SurveyAudioFieldInput)).toBeNull();
    expect(findFirstNodeByType(tree, QuestionDecryptControl)).toBeNull();

    notice.props.onAction();

    expect(subject.handleReloadMaskedPrompt).toHaveBeenCalledWith('q-worker');
  });

  it('renders encrypted full-question fields as disabled decrypt controls without a decrypt context', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      showComments: { q1: true },
      decryptingByKey: {},
    };

    const tree = subject.renderQuestion(
      { id: 'q1', type: 'freeform', prompt: 'Visible prompt' },
      0,
      {
        answers: { q1: { value: '*', encrypted: true } },
        additionalComments: { q1: { value: '*', encrypted: true } },
        importance: {},
        conviction: {},
      }
    );
    const shell = findFirstNodeByType(tree, SurveyQuestionsFullQuestionCardShell);
    const answerDecryptControl = findElement(
      shell?.props?.mainContent,
      (node) => node?.type === QuestionDecryptControl && node?.props?.actionLabel === 'Decrypt Answer'
    );
    const commentsDecryptControl = findElement(
      shell?.props?.commentsSection,
      (node) => node?.type === QuestionDecryptControl && node?.props?.actionLabel === 'Decrypt Comments'
    );
    const answerLockControl = findFirstNodeByType(shell?.props?.footerIcons, SurveyQuestionsLockAudienceControl);

    expect(answerDecryptControl).not.toBeNull();
    expect(answerDecryptControl.props.disabled).toBe(true);
    expect(answerDecryptControl.props.title).toBe('Login to decrypt this encrypted field.');
    expect(commentsDecryptControl).not.toBeNull();
    expect(commentsDecryptControl.props.disabled).toBe(true);
    expect(commentsDecryptControl.props.title).toBe('Login to decrypt this encrypted field.');
    expect(answerLockControl).not.toBeNull();
    expect(answerLockControl.props.isLockDisabled).toBe(true);
    expect(answerLockControl.props.buttonTitle).toBe('Choose encryption audience');
  });

  it('wires enabled encrypted field decrypt controls to answer and comment handlers', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.handleDecryptQuestionAnswer = jest.fn();
    subject.state = {
      ...subject.state,
      showComments: { q1: true },
      decryptingByKey: {},
    };

    const tree = subject.renderQuestion(
      { id: 'q1', type: 'freeform', prompt: 'Visible prompt' },
      0,
      {
        answers: { q1: { value: '*', encrypted: true } },
        additionalComments: { q1: { value: '*', encrypted: true } },
        importance: {},
        conviction: {},
      }
    );
    const shell = findFirstNodeByType(tree, SurveyQuestionsFullQuestionCardShell);
    const answerDecryptControl = findElement(
      shell?.props?.mainContent,
      (node) => node?.type === QuestionDecryptControl && node?.props?.actionLabel === 'Decrypt Answer'
    );
    const commentsDecryptControl = findElement(
      shell?.props?.commentsSection,
      (node) => node?.type === QuestionDecryptControl && node?.props?.actionLabel === 'Decrypt Comments'
    );

    expect(answerDecryptControl).not.toBeNull();
    expect(answerDecryptControl.props.disabled).toBe(false);
    expect(answerDecryptControl.props.title).toBeUndefined();
    expect(commentsDecryptControl).not.toBeNull();
    expect(commentsDecryptControl.props.disabled).toBe(false);
    expect(commentsDecryptControl.props.title).toBeUndefined();

    answerDecryptControl.props.onClick();
    commentsDecryptControl.props.onClick();

    expect(subject.handleDecryptQuestionAnswer).toHaveBeenCalledWith('q1', 'answer');
    expect(subject.handleDecryptQuestionAnswer).toHaveBeenCalledWith('q1', 'additional');
  });

  it('surfaces hidden masked question ids through the locked banner without rendering editable cards', () => {
    const lockedBanner = <div data-testid="locked-banner">Locked banner</div>;
    const lockedGateDetails = [{
      id: 'gate-1',
      label: 'Gate One',
      questionCount: 1,
      sbts: [],
    }];
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      isQuestionCacheReady: true,
    });
    subject.getMemoizedLockedQuestionGateDetails = jest.fn(() => lockedGateDetails);
    subject.renderLockedQuestionsPanel = jest.fn(() => lockedBanner);
    subject.renderQuestion = jest.fn(() => <div data-testid="editable-card" />);
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'Q-Locked', type: 'freeform', prompt: '[encrypted]' }],
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
    };

    const tree = subject.render();
    const panel = findFirstNodeByType(tree, SurveyQuestionsAuthoringPanel);

    expect(panel).not.toBeNull();
    expect(panel.props.displayState.showLockedQuestionsBanner).toBe(true);
    expect(panel.props.lockedQuestionsBanner).toBe(lockedBanner);
    expect(panel.props.renderedEditableQuestions).toBeNull();
    expect(subject.renderQuestion).not.toHaveBeenCalled();
    expect(subject.getMemoizedLockedQuestionGateDetails).toHaveBeenCalledWith(['q-locked']);
    expect(subject.renderLockedQuestionsPanel).toHaveBeenCalledWith({
      hiddenMaskedQuestionIds: ['q-locked'],
      lockedGateDetails,
    });
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

    subject.renderPromptWithManualDecrypt = jest.fn(() => 'Prompt');
    subject.state = {
      ...subject.state,
      showComments: {},
      showConviction: {},
      surveysResponseState: [
        {
          answers: { q1: { value: 'hello', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    const tree = subject.renderActiveQuestion(question);
    const audioInput = findFirstNodeByType(tree, SurveyAudioFieldInput);

    expect(audioInput).not.toBeNull();
    expect(audioInput.props.placeholder).toBe('Your response...');
    expect(audioInput.props.disableEncryption).toBe(true);
    expect(audioInput.props.enableDownloads).toBe(false);
  });

  it('routes pile encrypted answer and comments through the shared decrypt control wrapper', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);
    const question = { id: 'q1', type: 'freeform', prompt: 'Prompt' };

    subject.renderPromptWithManualDecrypt = jest.fn(() => 'Prompt');
    subject.state = {
      ...subject.state,
      showComments: { q1: true },
      showConviction: {},
      surveysResponseState: [
        {
          answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{}' } },
          additionalComments: { q1: { value: '*', encrypted: true, encryptedPortion: '{}' } },
          importance: {},
          conviction: {},
        },
      ],
    };

    const tree = subject.renderActiveQuestion(question);

    expect(countElements(tree, (node) => node?.type === QuestionDecryptControl)).toBe(2);
    expect(findFirstNodeByType(tree, AdditionalCommentsInlineRow)).toBeNull();
  });
});
