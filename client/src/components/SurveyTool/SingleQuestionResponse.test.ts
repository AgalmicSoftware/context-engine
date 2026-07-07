import SingleQuestionResponse, {
  SINGLE_QUESTION_IMPORTANCE_SLIDER_STYLE,
  buildSingleQuestionMiniPromptButtonClassName,
  buildSingleQuestionReadOnlyBinaryClassName,
  resolveSingleQuestionBookmarkIconStyle,
  resolveSingleQuestionRatingBarStyle,
} from './SingleQuestionResponse';
import styles from './SingleQuestionResponse.module.scss';
import GateTooltip from '../Gates/GateTooltip';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

type TreeNode = any;
type TreePredicate = (node: TreeNode) => boolean;
type SingleQuestionResponseProps = Record<string, any>;
const asCacheEntries = (entries: any[]): any => entries;

const createSubject = (props: SingleQuestionResponseProps = {}) =>
  new SingleQuestionResponse({
    network: { id: 84532 },
    questionsCacheNonce: 1,
    questionResponsesNonce: 1,
    sessionSlug: 'edge',
    ...props,
  });

const findElement = (node: TreeNode, predicate: TreePredicate): TreeNode | null => {
  const stack: TreeNode[] = [node];
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

const nodeHasClassName = (node: TreeNode, className: string): boolean => {
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

describe('SingleQuestionResponse style contracts', () => {
  it('builds response display classes and inline styles', () => {
    expect(resolveSingleQuestionBookmarkIconStyle(true, false)).toEqual({ color: 'lightgreen' });
    expect(resolveSingleQuestionBookmarkIconStyle(false, true)).toEqual({ color: '#ffc107' });
    expect(resolveSingleQuestionBookmarkIconStyle(false, false)).toEqual({ color: 'white' });
    expect(buildSingleQuestionMiniPromptButtonClassName(styles)).toBe(
      `${styles.miniPromptAbbrev} ${styles.maskedPromptActionButton}`,
    );
    expect(buildSingleQuestionReadOnlyBinaryClassName(styles, 'agree')).toBe(
      `${styles.readOnlyBinary} ${styles.agree}`,
    );
    expect(SINGLE_QUESTION_IMPORTANCE_SLIDER_STYLE).toEqual({ width: '200px' });
    expect(resolveSingleQuestionRatingBarStyle(60)).toEqual({ width: '60%' });
  });

  it('keeps fullscreen response cards on the prior inherited font treatment', () => {
    const scssPath = path.join(__dirname, 'SingleQuestionResponse.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.fullscreenQuestionContainer\s*{[\s\S]*?font-family:\s*inherit;/);
    expect(scss).toMatch(/\.fullscreenQuestionContainer\s*{[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.06\);/);
    expect(scss).toMatch(/\.questionTitle\s*{[\s\S]*?font-family:\s*inherit;/);
    expect(scss).toMatch(
      /\.encryptedResponseText\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?border-radius:\s*(?:999px|var\(--ce-radius-pill\));[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.08\);/,
    );
    expect(scss).not.toMatch(/\.freeformAnswer\s*{[\s\S]*?font-family:\s*var\(--ce-font-mono\);/);
    expect(scss).not.toMatch(/\.encryptedResponseText\s*{[\s\S]*?font-family:\s*var\(--ce-font-mono\);/);
  });

  it('keeps mini cards on the older compact icon spacing used by UserPage', () => {
    const scssPath = path.join(__dirname, 'SingleQuestionResponse.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(
      /\.miniQuestionContainer \.questionTitleBody\s*{[\s\S]*?padding:\s*15px;[\s\S]*?padding-right:\s*88px;/,
    );
    expect(scss).toMatch(/\.miniQuestionContainer \.cardLinksContainer\s*{[\s\S]*?top:\s*10px;[\s\S]*?right:\s*10px;/);
    expect(scss).toMatch(
      /\.miniQuestionContainer \.cardLinkButton\s*{[\s\S]*?width:\s*auto;[\s\S]*?height:\s*auto;[\s\S]*?font-size:\s*0\.9em;/,
    );
  });

  it('restores prompt width when a response card has no top-right actions to show', () => {
    const scssPath = path.join(__dirname, 'SingleQuestionResponse.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.questionTitleBodyNoLinks\s*{[\s\S]*?padding-right:\s*28px;/);
    expect(scss).toMatch(/\.miniQuestionContainer \.questionTitleBodyNoLinks\s*{[\s\S]*?padding-right:\s*15px;/);
  });
});

describe('SingleQuestionResponse render guard', () => {
  it('skips updates when top-level props and state values are unchanged', () => {
    const question = { id: 'q1', prompt: 'Question?', type: 'freeform' };
    const response = { answer: { value: 'Answer' } };
    const subject = createSubject({ question, response });

    expect(subject.shouldComponentUpdate({ ...subject.props }, { ...subject.state })).toBe(false);
  });

  it('updates when render-relevant prop or state references change', () => {
    const question = { id: 'q1', prompt: 'Question?', type: 'freeform' };
    const response = { answer: { value: 'Answer' } };
    const subject = createSubject({ question, response });

    expect(
      subject.shouldComponentUpdate({ ...subject.props, response: { answer: { value: 'Updated' } } }, subject.state),
    ).toBe(true);
    expect(subject.shouldComponentUpdate(subject.props, { ...subject.state, miniExpanded: true })).toBe(true);
  });
});

describe('SingleQuestionResponse card actions', () => {
  it('omits dead bookmark and page-link controls for synthetic questions without ids', () => {
    const subject = createSubject({
      mode: 'mini',
      question: {
        prompt: 'Simulated question prompt',
        type: 'freeform',
      },
      response: {
        answer: {
          value: 'Simulated answer value',
          encrypted: false,
        },
      },
    });

    const tree = subject.render();

    expect(findElement(tree, (node) => node?.props?.title === 'Bookmark Question')).toBeNull();
    expect(findElement(tree, (node) => node?.props?.title === 'View question page')).toBeNull();
    expect(findElement(tree, (node) => nodeHasClassName(node, styles.questionTitleBodyNoLinks))).not.toBeNull();
  });

  it('keeps arweave and question-page links available for question-only mini cards', () => {
    const subject = createSubject({
      mode: 'mini',
      questionOnly: true,
      question: {
        id: 'q-created',
        prompt: 'Created question prompt',
        type: 'freeform',
        arweaveTxId: 'a'.repeat(43),
      },
      response: null,
    });

    const tree = subject.render();

    expect(findElement(tree, (node) => node?.props?.title === 'View on Arweave')).not.toBeNull();
    expect(findElement(tree, (node) => node?.props?.title === 'View question page')).not.toBeNull();
  });

  it('uses storageRef before stale arweaveTxId for Arweave question links', () => {
    const preferredTxId = 'b'.repeat(43);
    const subject = createSubject({
      mode: 'mini',
      questionOnly: true,
      question: {
        id: 'q-created',
        prompt: 'Created question prompt',
        type: 'freeform',
        arweaveTxId: 'a'.repeat(43),
        storageRef: { backend: 'arweave', id: preferredTxId },
      },
      response: null,
    });

    const tree = subject.render();

    expect(findElement(tree, (node) => node?.props?.title === 'View on Arweave')?.props?.href).toContain(preferredTxId);
  });

  it('does not render an Arweave link for Cloudflare-only question storage refs', () => {
    const subject = createSubject({
      mode: 'mini',
      questionOnly: true,
      question: {
        id: 'q-created',
        prompt: 'Created question prompt',
        type: 'freeform',
        storageRef: { backend: 'cloudflare', id: 'cf_questionopaque01' },
      },
      response: null,
    });

    const tree = subject.render();

    expect(findElement(tree, (node) => node?.props?.title === 'View on Arweave')).toBeNull();
    expect(findElement(tree, (node) => node?.props?.title === 'View question page')).not.toBeNull();
  });

  it('supports a fullscreen question-only card without the mini click-through wrapper', () => {
    const subject = createSubject({
      mode: 'fullscreen',
      questionOnly: true,
      questionPromptClassName: 'heroPrompt',
      questionPromptTestId: 'hero-question-prompt',
      question: {
        id: 'q-hero',
        prompt: 'Hero question prompt',
        type: 'binary',
      },
      response: null,
    });

    const tree = subject.render();
    const outerCard = findElement(tree, (node) => nodeHasClassName(node, styles.fullscreenQuestionContainer));
    const prompt = findElement(tree, (node) => node?.props?.['data-testid'] === 'hero-question-prompt');

    expect(outerCard).not.toBeNull();
    expect(outerCard.props.role).toBeUndefined();
    expect(prompt).not.toBeNull();
    expect(nodeHasClassName(prompt, 'heroPrompt')).toBe(true);
    expect(renderToStaticMarkup(tree)).not.toContain('aria-label="Open question"');
  });

  it('canonicalizes reserved session aliases in question-page links', () => {
    const debateSubject = createSubject({
      mode: 'mini',
      questionOnly: true,
      sessionSlug: 'DEBATE',
      question: {
        id: 'Q-CREATED',
        prompt: 'Created question prompt',
        type: 'freeform',
      },
      response: null,
    });

    const debateTree = debateSubject.render();
    expect(findElement(debateTree, (node) => node?.props?.title === 'View question page')?.props?.href).toBe(
      '/question/q-created?session=DEBATE',
    );

    const generalSubject = createSubject({
      mode: 'mini',
      questionOnly: true,
      sessionSlug: 'general',
      question: {
        id: 'Q-GENERAL',
        prompt: 'General question prompt',
        type: 'freeform',
      },
      response: null,
    });

    const generalTree = generalSubject.render();
    expect(findElement(generalTree, (node) => node?.props?.title === 'View question page')?.props?.href).toBe(
      '/question/q-general',
    );
  });
});

describe('SingleQuestionResponse masked prompt copy', () => {
  it('uses neutral gated prompt wording for manual prompt decrypt buttons', () => {
    const subject = createSubject({
      mode: 'fullscreen',
      question: {
        id: 'q1',
        prompt: '[encrypted]',
        type: 'freeform',
      },
      response: {
        answer: { value: 'Visible answer', encrypted: false },
        additional: { value: '', encrypted: false },
        conviction: null,
      },
      onReloadQuestionPrompt: jest.fn(),
    });

    const tree = subject.renderSinglePersonView();
    const button = findElement(tree, (node) => node?.props?.title === 'Decrypt gated prompt');

    expect(button).toBeTruthy();
  });

  it('hides visible response values while the prompt is still masked', () => {
    const subject = createSubject({
      mode: 'fullscreen',
      question: {
        id: 'q1',
        prompt: '[encrypted]',
        type: 'binary',
      },
      response: {
        answer: { value: 'Agree', encrypted: false },
        additional: { value: 'private note', encrypted: false },
        conviction: null,
      },
    });

    const tree = subject.renderSinglePersonView();
    const notice = findElement(tree, (node) => node?.props?.['data-testid'] === 'ce-encrypted-answer-notice');
    const visibleAgree = findElement(tree, (node) => node?.props?.children === 'Agree');
    const visibleNote = findElement(tree, (node) => node?.props?.children === 'private note');

    expect(notice).toBeTruthy();
    expect(notice?.props?.children).toBe('This response is gated with the question.');
    expect(visibleAgree).toBeNull();
    expect(visibleNote).toBeNull();
  });
});

describe('SingleQuestionResponse option lookup memoization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('memoizes multichoice fallback resolution for the same cache context', () => {
    const listSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue(
      asCacheEntries([
        { slug: '', value: { '84532': { questions: {} } } },
        { slug: 'alpha', value: { '84532': { questions: { q1: { options: ['Yes', 'No'] } } } } },
      ]),
    );
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(null);

    const subject = createSubject();

    const first = subject.getMultichoiceOptions({ id: 'q1', type: 'multichoice' });
    const second = subject.getMultichoiceOptions({ id: 'q1', type: 'multichoice' });

    expect(first).toEqual(['Yes', 'No']);
    expect(second).toBe(first);
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('invalidates option memo when cache nonce props change', () => {
    const listSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue(
      asCacheEntries([
        { slug: '', value: { '84532': { questions: {} } } },
        { slug: 'alpha', value: { '84532': { questions: { q1: { options: ['A', 'B'] } } } } },
      ]),
    );
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(null);

    const subject = createSubject({ questionsCacheNonce: 2 });
    subject.getMultichoiceOptions({ id: 'q1', type: 'multichoice' });

    const prevProps = { ...subject.props };
    (subject as any).props = { ...subject.props, questionsCacheNonce: 3 };
    subject.componentDidUpdate(prevProps);
    subject.getMultichoiceOptions({ id: 'q1', type: 'multichoice' });

    expect(listSpy).toHaveBeenCalledTimes(4);
  });

  it('keeps option memo warm when only response nonce changes', () => {
    const listSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue(
      asCacheEntries([
        { slug: '', value: { '84532': { questions: {} } } },
        { slug: 'alpha', value: { '84532': { questions: { q1: { options: ['A', 'B'] } } } } },
      ]),
    );
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(null);

    const subject = createSubject({ questionResponsesNonce: 7 });
    const first = subject.getMultichoiceOptions({ id: 'q1', type: 'multichoice' });

    const prevProps = { ...subject.props };
    (subject as any).props = { ...subject.props, questionResponsesNonce: 8 };
    subject.componentDidUpdate(prevProps);
    const second = subject.getMultichoiceOptions({ id: 'q1', type: 'multichoice' });

    expect(second).toBe(first);
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('memoizes group-cache map discovery within the same lookup context', () => {
    const listSpy = jest
      .spyOn(cacheScripts, 'listNamespaceEntriesSync')
      .mockReturnValue(asCacheEntries([{ slug: '', value: { '84532': { questions: { q1: { id: 'q1' } } } } }]));
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(null);

    const subject = createSubject();

    const first = subject.readQuestionsMapFromGroupCache();
    const second = subject.readQuestionsMapFromGroupCache();

    expect(first).toEqual({ q1: { id: 'q1' } });
    expect(second).toBe(first);
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('does not rerun cross-group scan after memo warmup in the same context', () => {
    const listSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue(
      asCacheEntries([
        { slug: '', value: { '84532': { questions: {} } } },
        { slug: 'alpha', value: { '84532': { questions: { q1: { options: ['Yes', 'No'] } } } } },
      ]),
    );
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(null);

    const subject = createSubject();
    const first = subject.getMultichoiceOptions({ id: 'q1', type: 'multichoice' });
    const second = subject.getMultichoiceOptions({ id: 'q1', type: 'multichoice' });

    expect(second).toBe(first);
    expect(listSpy).toHaveBeenCalledTimes(2);
  });
});

describe('SingleQuestionResponse aggregator memoization', () => {
  it('reuses normalized latest-response input when allResponses are unchanged', () => {
    const allResponses = [
      { responder: '0xa', timestamp: '1', response: { answer: { value: 'older' } } },
      { responder: '0xa', timestamp: '2', response: { answer: { value: 'latest-a' } } },
      { responder: '0xb', timestamp: '1', response: { answer: { value: 'latest-b' } } },
    ];
    const subject = createSubject({
      question: { id: 'q1', type: 'freeform' },
      allResponses,
    });
    const freeformSpy = jest.fn((responses: any[]) => null);
    subject.renderFreeformAggregator = freeformSpy;

    subject.renderAggregatorByType();
    subject.renderAggregatorByType();

    expect(freeformSpy).toHaveBeenCalledTimes(2);
    expect(freeformSpy.mock.calls[1][0]).toBe(freeformSpy.mock.calls[0][0]);
    expect(freeformSpy.mock.calls[0][0]).toHaveLength(2);
  });

  it('preserves freeform aggregator display output', () => {
    const allResponses = [
      { responder: '0xa', timestamp: '1', response: { answer: { value: 'old visible', encrypted: false } } },
      { responder: '0xa', timestamp: '2', response: { answer: { value: '*', encrypted: true } } },
      { responder: '0xb', timestamp: '1', response: { answer: { value: '', encrypted: false } } },
      { responder: '0xc', timestamp: '1', response: { answer: { value: 'Visible response', encrypted: false } } },
    ];
    const subject = createSubject({
      question: { id: 'q1', type: 'freeform' },
      allResponses,
    });

    const markup = renderToStaticMarkup(subject.renderAggregatorByType());
    expect(markup).toContain('2 total responses. 1 encrypted responses not shown. 1 blank not shown.');
    expect(markup).toContain('Visible response');
    expect(markup).not.toContain('old visible');
  });

  it('standardizes the freeform aggregator empty state copy', () => {
    const subject = createSubject({
      question: { id: 'q1', type: 'freeform' },
      allResponses: [],
    });

    const markup = renderToStaticMarkup(subject.renderAggregatorByType());
    expect(markup).toContain('No freeform responses available.');
  });

  it('applies custom SurveyResults aggregator card classes without affecting the default component styles', () => {
    const subject = createSubject({
      aggregatorResponseMode: true,
      question: { id: 'q1', type: 'binary' },
      allResponses: [],
      containerClassName: 'surveyResultsResponseCard',
      bodyClassName: 'surveyResultsResponseCardBody',
      linksContainerClassName: 'surveyResultsResponseCardLinks',
      iconButtonClassName: 'surveyResultsResponseCardLinkButton',
      aggregatorContainerClassName: 'surveyResultsAggregatorPanel',
      aggregatorTextClassName: 'surveyResultsAggregatorText',
      aggregatorParagraphClassName: 'surveyResultsAggregatorParagraph',
    });

    const tree = subject.render();
    const outerCard = findElement(tree, (element) => nodeHasClassName(element, 'surveyResultsResponseCard'));
    const innerPanel = findElement(tree, (element) => nodeHasClassName(element, 'surveyResultsAggregatorPanel'));

    expect(outerCard).toBeTruthy();
    expect(innerPanel).toBeTruthy();
    expect(renderToStaticMarkup(tree)).toContain('No binary responses available.');
  });
});

describe('SingleQuestionResponse rating rendering', () => {
  it('clamps read-only rating bars and keeps the value label outside the fill track', () => {
    const subject = createSubject({
      mode: 'fullscreen',
      question: { id: 'q1', type: 'rating', prompt: 'Rate this' },
      response: {
        answer: { value: '12', encrypted: false },
        additional: { value: '', encrypted: false },
      },
    });

    const tree = subject.renderSinglePersonView();
    const track = findElement(tree, (node) => nodeHasClassName(node, styles.ratingTrack));
    const bar = findElement(tree, (node) => nodeHasClassName(node, styles.ratingBar));
    const label = findElement(tree, (node) => nodeHasClassName(node, styles.ratingValueLabel));

    expect(track).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(label).not.toBeNull();
    expect(bar.props.style.width).toBe('100%');
    expect(renderToStaticMarkup(label)).toContain('10/10');
  });

  it('treats invalid read-only rating payloads as unanswered instead of rendering broken widths', () => {
    const subject = createSubject({
      mode: 'fullscreen',
      question: { id: 'q1', type: 'rating', prompt: 'Rate this' },
      response: {
        answer: { value: 'abc', encrypted: false },
        additional: { value: '', encrypted: false },
      },
    });

    const tree = subject.renderSinglePersonView();

    expect(findElement(tree, (node) => nodeHasClassName(node, styles.ratingBar))).toBeNull();
    expect(renderToStaticMarkup(tree)).toContain('No answer provided.');
  });
});

describe('SingleQuestionResponse encrypted answer CTA variants', () => {
  const litEncryptedPortion = JSON.stringify({
    v: 1,
    cipher: 'aes-gcm-256',
    recipients: [{ type: 'self-eip712-v1' }, { type: 'lit-sbt-v1', lit: { chain: 'optimismSepolia' } }],
  });

  it('renders only the decrypt button for compact encrypted-answer CTA mode', () => {
    const subject = createSubject({
      question: { id: 'q1', type: 'freeform', prompt: 'Prompt' },
      response: {
        answer: { value: '*', encrypted: true },
        additional: { value: '', encrypted: false },
        conviction: null,
      },
      isOwnResponse: true,
      mode: 'fullscreen',
      showImportance: false,
      onDecryptQuestion: jest.fn(),
      compactEncryptedAnswerCta: true,
    });

    const markup = renderToStaticMarkup(subject.renderSinglePersonView());
    expect(markup).toContain('Decrypt Answer');
    expect(markup).not.toContain('This answer is encrypted.');
    expect(markup).toContain('decryptCta');
  });

  it('hides encrypted-answer notice text when decrypt is available even outside compact mode', () => {
    const subject = createSubject({
      question: { id: 'q1', type: 'freeform', prompt: 'Prompt' },
      response: {
        answer: { value: '*', encrypted: true },
        additional: { value: '', encrypted: false },
        conviction: null,
      },
      isOwnResponse: true,
      mode: 'fullscreen',
      showImportance: false,
      onDecryptQuestion: jest.fn(),
    });

    const markup = renderToStaticMarkup(subject.renderSinglePersonView());
    expect(markup).toContain('Decrypt Answer');
    expect(markup).not.toContain('This answer is encrypted.');
  });

  it('keeps encrypted-answer notice text when decrypt is not available', () => {
    const subject = createSubject({
      question: { id: 'q1', type: 'freeform', prompt: 'Prompt' },
      response: {
        answer: { value: '*', encrypted: true },
        additional: { value: '', encrypted: false },
        conviction: null,
      },
      isOwnResponse: false,
      mode: 'fullscreen',
      showImportance: false,
      onDecryptQuestion: jest.fn(),
      canDecryptOtherResponses: false,
    });

    const markup = renderToStaticMarkup(subject.renderSinglePersonView());
    expect(markup).toContain('This answer is encrypted.');
    expect(markup).not.toContain('Decrypt Answer');
  });

  it('renders decrypt for viewed Lit-gated responses even before session gate context resolves', () => {
    const onDecryptQuestion = jest.fn();
    const subject = createSubject({
      question: { id: 'q1', type: 'freeform', prompt: 'Prompt' },
      response: {
        answer: { value: '*', encrypted: true, encryptedPortion: litEncryptedPortion },
        additional: { value: '', encrypted: false },
        conviction: null,
      },
      isOwnResponse: false,
      mode: 'fullscreen',
      showImportance: false,
      onDecryptQuestion,
      canDecryptOtherResponses: false,
    });

    const tree = subject.renderSinglePersonView();
    const decryptButton = findElement(tree, (node) => node?.props?.children === 'Decrypt Answer');

    expect(renderToStaticMarkup(tree)).toContain('Decrypt Answer');
    expect(decryptButton).not.toBeNull();
    decryptButton.props.onClick();

    expect(onDecryptQuestion).toHaveBeenCalledWith(
      'q1',
      'answer',
      expect.objectContaining({
        answer: expect.objectContaining({ encryptedPortion: litEncryptedPortion }),
      }),
    );
  });
});

describe('SingleQuestionResponse encrypted additional CTA variants', () => {
  it('renders compact encrypted-additional CTA with the same green button style', () => {
    const subject = createSubject({
      question: { id: 'q1', type: 'freeform', prompt: 'Prompt' },
      response: {
        answer: { value: 'visible answer', encrypted: false },
        additional: { value: '*', encrypted: true },
        conviction: null,
      },
      isOwnResponse: true,
      mode: 'fullscreen',
      showImportance: false,
      onDecryptQuestion: jest.fn(),
      compactEncryptedAnswerCta: true,
    });

    const markup = renderToStaticMarkup(subject.renderSinglePersonView());
    expect(markup).toContain('Decrypt Additional Comments');
    expect(markup).not.toContain('Additional comments are encrypted.');
    expect(markup).toContain('decryptCta');
  });

  it('keeps encrypted-additional notice text when decrypt is not available', () => {
    const subject = createSubject({
      question: { id: 'q1', type: 'freeform', prompt: 'Prompt' },
      response: {
        answer: { value: 'visible answer', encrypted: false },
        additional: { value: '*', encrypted: true },
        conviction: null,
      },
      isOwnResponse: false,
      mode: 'fullscreen',
      showImportance: false,
      onDecryptQuestion: jest.fn(),
      canDecryptOtherResponses: false,
    });

    const markup = renderToStaticMarkup(subject.renderSinglePersonView());
    expect(markup).toContain('Additional comments are encrypted.');
    expect(markup).not.toContain('Decrypt Additional Comments');
  });

  it('stacks compact decrypt CTA in a dedicated block when requested', () => {
    const subject = createSubject({
      question: { id: 'q1', type: 'freeform', prompt: 'Prompt' },
      response: {
        answer: { value: 'visible answer', encrypted: false },
        additional: { value: '*', encrypted: true },
        conviction: null,
      },
      isOwnResponse: true,
      mode: 'fullscreen',
      showImportance: false,
      onDecryptQuestion: jest.fn(),
      compactEncryptedAnswerCta: true,
      stackCompactDecryptCta: true,
    });

    const markup = renderToStaticMarkup(subject.renderSinglePersonView());
    expect(markup).toContain('compactDecryptCtaStack');
    expect(markup).toContain('Decrypt Additional Comments');
  });
});

describe('SingleQuestionResponse group slug resolution', () => {
  it('prefers /session/:slug pathname over stale slug props', () => {
    const restorePath = `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
    window.history.replaceState({}, '', '/session/test-10');
    const subject = createSubject({
      sessionSlug: 'test-1',
      activeSessionSlug: 'test-1',
    });

    expect(subject.resolveGroupSlug()).toBe('test-10');
    window.history.replaceState({}, '', restorePath);
  });

  it('prefers question-specific source slug over stale profile page props', () => {
    const restorePath = `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
    window.history.replaceState({}, '', '/u/0x00000000000000000000000000000000000000aa');
    const subject = createSubject({
      sessionSlug: 'demo',
      activeSessionSlug: 'demo',
      question: {
        id: 'q-demo-4',
        sessionSlug: 'demo-4',
      },
    });

    expect(subject.resolveGroupSlug()).toBe('demo-4');
    window.history.replaceState({}, '', restorePath);
  });
});

describe('SingleQuestionResponse gate tooltip integration', () => {
  it('wraps masked prompts with gate tooltip props derived from question encryption gates', () => {
    const gateSbt = '0x1111111111111111111111111111111111111111';
    const subject = createSubject({
      question: {
        id: 'q1',
        type: 'freeform',
        prompt: '[encrypted]',
        encryption: {
          gates: [
            {
              gateId: 'vip_access',
              label: 'VIP Gate',
              mode: 'all',
              sbtAddresses: [gateSbt],
            },
          ],
        },
      },
      response: {
        answer: { value: 'Visible answer', encrypted: false },
        additional: { value: '', encrypted: false },
        conviction: null,
      },
      mode: 'fullscreen',
      showImportance: false,
    });

    const tree = subject.renderSinglePersonView();
    const tooltip = findElement(
      tree,
      (element) => element?.type === GateTooltip && element?.props?.gateId === 'vip_access',
    );

    expect(tooltip).toBeTruthy();
    expect(tooltip.props.gateConfig).toMatchObject({
      label: 'VIP Gate',
      mode: 'all',
    });
    expect(tooltip.props.sbtAddresses).toEqual([gateSbt]);
    expect(tooltip.props.children).toBe('Encrypted');
  });
});
