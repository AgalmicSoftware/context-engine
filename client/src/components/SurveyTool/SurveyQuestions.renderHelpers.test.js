import SurveyTool from './SurveyTool';
import { SurveyQuestions } from './SurveyQuestions';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';
import QuestionCardLinks from './QuestionCardLinks';
import QuestionDecryptControl from './QuestionDecryptControl';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
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
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
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
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
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
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

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
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
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
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
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
