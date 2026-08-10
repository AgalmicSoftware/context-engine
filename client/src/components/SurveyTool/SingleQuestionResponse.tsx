/** @file SingleQuestionResponse.tsx */

import React, { Component } from 'react';
import { Card, CardBody, Button } from 'reactstrap';
import CESlider from '../Shared/CESlider';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner,
  faTimes,
  faChevronDown,
  faChevronUp,
  faExternalLinkAlt,
  faExpand,
  faBookmark,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import styles from './SingleQuestionResponse.module.scss';
import { createLogger } from 'utilities/logging.js';
import { buildQuestionRoutePath, resolveQuestionPayloadDisplayState } from '../../utilities/survey/questionRouting.js';
import { normalizeSessionSlug, resolveSessionSlugFromPathname } from '../../utilities/session/sessionNaming.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { getLegacyArweaveTxId } from '../../utilities/storage/storageRefs.js';
import GateTooltip from '../Gates/GateTooltip';
import { listNamespaceEntriesSync, peekCacheSync, writeCache } from '../../utilities/cache/cacheScripts.js';
import {
  getRatingFillPercent,
  normalizeRatingValue,
  RATING_MAX,
  RATING_MIN,
} from '../../utilities/survey/ratingValue.js';
import {
  buildAggregatorResponseSignature,
  buildBinaryAggregatorSummary,
  buildFreeformAggregatorSummary,
  buildMultichoiceAggregatorSummary,
  buildRatingAggregatorSummary,
  buildSingleQuestionBookmarkFeedbackPatch,
  buildSingleQuestionBookmarkStatusPatch,
  buildSingleQuestionBookmarkSuccessPatch,
  extractSingleQuestionOptionsFromCandidate,
  findSingleQuestionEntryAcrossGroups,
  getLatestAnsweredResponses,
  responseHasLitSbtRecipient,
  isEnvelopeAesGcm256,
  resolveSingleQuestionMapFromCacheValue,
  resolvePromptGateTooltipProps,
} from './singleQuestionResponseHelpers.js';

const questionLog = createLogger('questions');

type SingleQuestionRecord = Record<string, unknown>;
type SingleQuestionNetworkLike = SingleQuestionRecord & {
  id?: unknown;
  chainId?: unknown;
};
type SingleQuestionAnswerLike = SingleQuestionRecord & {
  encrypted?: unknown;
  encryptedPortion?: unknown;
  value?: unknown;
};
type SingleQuestionGateLike = SingleQuestionRecord & {
  gateId?: unknown;
  id?: unknown;
  mode?: unknown;
  operator?: unknown;
  gateMode?: unknown;
  requireAll?: boolean;
  sbtAddress?: unknown;
  sbtAddresses?: unknown;
};
type SingleQuestionQuestionLike = SingleQuestionRecord & {
  _id?: unknown;
  arweaveTxId?: unknown;
  storageRef?: unknown;
  encryption?: SingleQuestionRecord & {
    gate?: SingleQuestionGateLike | null;
    gateId?: unknown;
    gates?: unknown;
    mode?: unknown;
    sbtAddresses?: unknown;
  };
  gate?: SingleQuestionGateLike | null;
  gateConfig?: SingleQuestionGateLike | null;
  gateId?: unknown;
  gateMode?: unknown;
  gates?: unknown;
  id?: unknown;
  key?: unknown;
  options?: unknown;
  prompt?: React.ReactNode;
  questionId?: unknown;
  sbtAddresses?: unknown;
  sessionSlug?: unknown;
  slug?: unknown;
  type?: unknown;
  uuid?: unknown;
};
type SingleQuestionResponseLike = SingleQuestionRecord & {
  additional?: SingleQuestionAnswerLike | null;
  answer?: SingleQuestionAnswerLike | null;
  arweaveTxId?: unknown;
  storageRef?: unknown;
  conviction?: unknown;
  importance?: unknown;
};
type SingleQuestionAggregatorQuestion = SingleQuestionQuestionLike & {
  options?: unknown;
  type?: unknown;
};
type SingleQuestionResponseProps = SingleQuestionRecord & {
  activeSessionSlug?: unknown;
  aggregatorContainerClassName?: string;
  aggregatorFreeformAnswerClassName?: string;
  aggregatorParagraphClassName?: string;
  aggregatorResponseMode?: unknown;
  aggregatorTextClassName?: string;
  allResponses?: unknown;
  bodyClassName?: string;
  cacheNonce?: unknown;
  cacheRevision?: unknown;
  cache?: SingleQuestionRecord | null;
  canDecryptOtherResponses?: unknown;
  compactEncryptedAnswerCta?: boolean;
  containerClassName?: string;
  entities?: SingleQuestionRecord | null;
  gateConfig?: SingleQuestionGateLike | null;
  gateId?: unknown;
  gateMode?: unknown;
  getQuestionFromCache?: (questionId: unknown) => unknown;
  iconButtonClassName?: string;
  isOwnResponse?: unknown;
  linksContainerClassName?: string;
  mode?: string;
  network?: SingleQuestionNetworkLike | null;
  networkChainId?: unknown;
  onDecryptQuestion?: (...args: unknown[]) => unknown;
  onReloadQuestionPrompt?: (questionId: unknown) => unknown;
  promptReloading?: unknown;
  question?: SingleQuestionQuestionLike | null;
  questionCache?: SingleQuestionRecord | null;
  questionOnly?: unknown;
  questionPromptClassName?: string;
  questionPromptTestId?: string;
  questionsById?: SingleQuestionRecord | null;
  questionsCacheNonce?: unknown;
  questionsCache?: SingleQuestionRecord | null;
  responderAddress?: string;
  response?: SingleQuestionResponseLike | null;
  sbtAddresses?: unknown;
  selectQuestionById?: (questionId: unknown) => unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  showImportance?: unknown;
  stackCompactDecryptCta?: boolean;
  storeCache?: SingleQuestionRecord | null;
  userHeldSBTs?: unknown;
};
type SingleQuestionResponseState = {
  bookmarkSuccess?: boolean;
  isBookmarked?: boolean;
  miniExpanded?: boolean;
};
type SingleQuestionQuestionsMapMemo = {
  key: string;
  value: SingleQuestionQuestionCacheMap;
};
type SingleQuestionAggregatorAnsweredMemo = {
  responsesRef: unknown;
  signature: string;
  value: unknown[];
};
type SingleQuestionMemoMap<Key = unknown> = {
  size: number;
  keys: () => IterableIterator<Key>;
  delete: (key: Key) => boolean;
};
type SingleQuestionBookmarkCache = SingleQuestionRecord & {
  questions: unknown[];
  surveys: unknown[];
};
type SingleQuestionCacheEntry = SingleQuestionRecord & {
  slug?: unknown;
  value?: unknown;
};
type SingleQuestionQuestionCacheMap = Record<string, unknown>;
type SingleQuestionAggregatorClassNames = {
  aggregatorContainerClassName: string;
  aggregatorParagraphClassName: string;
  aggregatorFreeformAnswerClassName: string;
};
type SingleQuestionWriteCache = (namespace: string, slug: string | undefined, value: unknown) => Promise<unknown>;
type SingleQuestionGlobalCacheWindow = Window & {
  __APP_CACHE__?: Record<string, unknown>;
  __QUESTION_CACHE__?: Record<string, unknown>;
  __SURVEY_CACHE__?: Record<string, unknown>;
};

const joinClassNames = (...parts: unknown[]) => parts.filter(Boolean).join(' ');

const shallowEqualSingleQuestionRecord = (
  left: Record<string, unknown> | null | undefined,
  right: Record<string, unknown> | null | undefined,
): boolean => {
  if (Object.is(left, right)) return true;
  if (!left || !right) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && Object.is(left[key], right[key]));
};

export const SINGLE_QUESTION_IMPORTANCE_SLIDER_STYLE: React.CSSProperties = {
  width: '200px',
};

export const resolveSingleQuestionBookmarkIconStyle = (
  bookmarkSuccess: unknown,
  isBookmarked: unknown,
): React.CSSProperties => ({
  color: bookmarkSuccess
    ? 'var(--ce-status-success-text)'
    : isBookmarked
      ? 'var(--ce-status-warning)'
      : 'var(--ce-panel-text)',
});

export const buildSingleQuestionMiniPromptButtonClassName = (styleMap: Record<string, string>) =>
  `${styleMap.miniPromptAbbrev} ${styleMap.maskedPromptActionButton}`;

export const buildSingleQuestionReadOnlyBinaryClassName = (styleMap: Record<string, string>, optionClassName: string) =>
  `${styleMap.readOnlyBinary} ${styleMap[optionClassName]}`;

export const resolveSingleQuestionRatingBarStyle = (ratingFillPercent: unknown): React.CSSProperties => ({
  width: `${ratingFillPercent}%`,
});

/**
 * SingleQuestionResponse is a component responsible for displaying:
 *
 *  (A) A single individual's response to a single question (in "fullscreen" or "mini" mode)
 *
 *  (B) All responses for a single question in aggregator form (when `aggregatorResponseMode === true`)
 *      - Summaries for freeform, binary, rating, multichoice, etc.
 *
 * PROPS:
 *   - question:  object with fields { id, type, prompt, options? } (if aggregatorResponseMode, question is still helpful for the prompt)
 *   - response:  object with structure { answer, additional, importance, ... } (only for single-person mode)
 *   - allResponses: array of { responder, questionId, response, timestamp }
 *       (only for aggregator mode: SurveyResults “aggregate” or “question” mode)
 *   - isOwnResponse: boolean (if single-person mode, indicates user is the responder)
 *   - mode: "fullscreen" | "mini" (applies to single-person response display)
 *   - aggregatorResponseMode: boolean. If true, we show aggregated stats for allResponses.
 *   - showImportance: boolean (whether to show importance slider UI in single-person mode)
 *   - onDecryptQuestion(questionId, fieldToDecrypt): function to decrypt (only relevant if single-person mode)
 *   - onReloadQuestionPrompt(questionId): function to force prompt metadata/decrypt refresh
 *   - canDecryptOtherResponses: boolean. When true and viewer satisfies the session response gate,
 *     decrypt buttons may appear even when `isOwnResponse === false` (e.g., viewing another wallet's response).
 *   - promptReloading: boolean flag for prompt reload in-flight state
 *   - responderAddress: string. If provided, we can link out to /question/<questionID>/<responderAddress>
 *   - network: object with `.id` or `.chainId` etc. (for aggregator, we often need question metadata from cache)
 *   - questionOnly: boolean. When true and response == null, render a read-only, non-interactive "teaser" view
 *
 * SCSS is in SingleQuestionResponse.module.scss
 */

class SingleQuestionResponse extends Component<SingleQuestionResponseProps, SingleQuestionResponseState> {
  private _bookmarkSuccessTimer: ReturnType<typeof setTimeout> | null;
  private _questionsMapMemo: SingleQuestionQuestionsMapMemo;
  private _crossGroupQuestionMemo: Map<string, unknown | null>;
  private _multichoiceOptionsMemo: Map<string, string[]>;
  private _aggregatorAnsweredMemo: SingleQuestionAggregatorAnsweredMemo;

  constructor(props: SingleQuestionResponseProps) {
    super(props);
    this.state = {
      miniExpanded: false, // used only if mode="mini"
      isBookmarked: false,
      bookmarkSuccess: false,
    };
    this._bookmarkSuccessTimer = null;
    this._questionsMapMemo = { key: '', value: {} };
    this._crossGroupQuestionMemo = new Map();
    this._multichoiceOptionsMemo = new Map();
    this._aggregatorAnsweredMemo = { responsesRef: null, signature: '', value: [] };
  }

  componentDidMount() {
    this.checkBookmarkStatus();
  }

  componentWillUnmount() {
    if (this._bookmarkSuccessTimer) {
      clearTimeout(this._bookmarkSuccessTimer);
      this._bookmarkSuccessTimer = null;
    }
    this.clearQuestionLookupMemo();
  }

  shouldComponentUpdate(nextProps: SingleQuestionResponseProps, nextState: SingleQuestionResponseState): boolean {
    return (
      !shallowEqualSingleQuestionRecord(this.props, nextProps) ||
      !shallowEqualSingleQuestionRecord(this.state, nextState)
    );
  }

  componentDidUpdate(prevProps: SingleQuestionResponseProps) {
    if (this.props.question?.id !== prevProps.question?.id) {
      this.checkBookmarkStatus();
    }
    const questionLookupInputsChanged =
      prevProps.questionsCacheNonce !== this.props.questionsCacheNonce ||
      prevProps.cacheNonce !== this.props.cacheNonce ||
      prevProps.cacheRevision !== this.props.cacheRevision ||
      prevProps.sessionSlug !== this.props.sessionSlug ||
      prevProps.activeSessionSlug !== this.props.activeSessionSlug ||
      prevProps.network?.id !== this.props.network?.id ||
      prevProps.network?.chainId !== this.props.network?.chainId;
    if (questionLookupInputsChanged) {
      this.clearQuestionLookupMemo();
    }
  }

  clearQuestionLookupMemo = (): void => {
    this._questionsMapMemo = { key: '', value: {} };
    this._crossGroupQuestionMemo.clear();
    this._multichoiceOptionsMemo.clear();
  };

  trimMemoMap = <Key,>(map: SingleQuestionMemoMap<Key> | null | undefined, maxEntries = 128): void => {
    if (!map || typeof map.size !== 'number') return;
    while (map.size > maxEntries) {
      const firstKey = map.keys().next().value;
      map.delete(firstKey);
    }
  };

  getQuestionLookupContextKey = (): string => {
    const slug = this.resolveGroupSlug();
    const netIdStr = String(
      this.props?.network?.id ?? this.props?.network?.chainId ?? this.props?.networkChainId ?? '',
    );
    const nonceParts = [this.props?.questionsCacheNonce, this.props?.cacheNonce, this.props?.cacheRevision]
      .map((part: unknown) => (part == null ? '' : String(part)))
      .join(':');
    return `${slug}|${netIdStr}|${nonceParts}`;
  };

  buildAggregatorResponseSignature = (allResponses: unknown = []): string => {
    return buildAggregatorResponseSignature(allResponses);
  };

  getLatestAnsweredResponses = (allResponses: unknown = []): unknown[] => {
    if (!Array.isArray(allResponses) || allResponses.length === 0) {
      return [];
    }
    const signature = this.buildAggregatorResponseSignature(allResponses);
    const memo = this._aggregatorAnsweredMemo;
    if (memo.responsesRef === allResponses && memo.signature === signature) {
      return memo.value;
    }

    const answered = getLatestAnsweredResponses(allResponses);
    this._aggregatorAnsweredMemo = { responsesRef: allResponses, signature, value: answered };
    return answered;
  };

  checkBookmarkStatus = (): void => {
    const { question } = this.props;
    if (!question || !question.id) return;

    try {
      const slug = this.resolveGroupSlug();
      const bookmarksCache = peekCacheSync('bookmarksCache', slug, { clone: false });
      const isBookmarked = bookmarksCache?.questions?.includes(question.id);
      const patch = buildSingleQuestionBookmarkStatusPatch(isBookmarked);
      if (this.state.isBookmarked !== patch.isBookmarked) {
        this.setState(patch);
      }
    } catch (error) {
      questionLog.error('[SingleQuestionResponse] Error reading bookmarksCache:', error);
      if (this.state.isBookmarked !== false) {
        this.setState(buildSingleQuestionBookmarkStatusPatch(false));
      }
    }
  };

  handleBookmarkClick = (): void => {
    const { question } = this.props;
    if (!question || !question.id) return;

    const questionId = question.id;
    const slug = this.resolveGroupSlug();
    let bookmarksCache: SingleQuestionBookmarkCache;

    try {
      const existing = peekCacheSync('bookmarksCache', slug, { clone: false }) || {};
      const base = typeof existing === 'object' && existing !== null ? (existing as SingleQuestionRecord) : {};
      bookmarksCache = {
        ...base,
        surveys: Array.isArray(base.surveys) ? [...base.surveys] : [],
        questions: Array.isArray(base.questions) ? [...base.questions] : [],
      };
    } catch (error) {
      questionLog.error('[SingleQuestionResponse] Error parsing bookmarksCache:', error);
      bookmarksCache = { surveys: [], questions: [] }; // Reset on error
    }

    const questionIndex = bookmarksCache.questions.indexOf(questionId);
    let nowBookmarked: boolean;

    if (questionIndex > -1) {
      // Un-bookmark
      bookmarksCache.questions.splice(questionIndex, 1);
      nowBookmarked = false;
    } else {
      // Bookmark
      bookmarksCache.questions.push(questionId);
      nowBookmarked = true;
    }

    // Update state immediately for instant UI feedback
    this.setState(buildSingleQuestionBookmarkFeedbackPatch(nowBookmarked));
    if (this._bookmarkSuccessTimer) {
      clearTimeout(this._bookmarkSuccessTimer);
    }
    this._bookmarkSuccessTimer = setTimeout(() => {
      this._bookmarkSuccessTimer = null;
      this.setState(buildSingleQuestionBookmarkSuccessPatch(false));
    }, 1500); // Feedback for 1.5s

    void (writeCache as SingleQuestionWriteCache)('bookmarksCache', slug, bookmarksCache).catch((error: unknown) => {
      questionLog.error('[SingleQuestionResponse] Error saving bookmarksCache:', error);
    });
  };

  // For aggregator mode (allResponses array). We compute summary stats & display them.
  renderAggregatorByType = (): React.ReactNode => {
    const { question, allResponses } = this.props;

    // If question is missing, we provide a fallback so we don't just show "Loading question/response..."
    // This way aggregator data is still displayed.
    const aggregatorQuestion: SingleQuestionAggregatorQuestion = (question || {
      prompt: '(No prompt found)',
      type: 'freeform',
      options: [],
    }) as SingleQuestionAggregatorQuestion;

    if (!allResponses || !Array.isArray(allResponses)) {
      return <p className={styles.aggregatorText}>No aggregator data available.</p>;
    }

    const questionType = String(aggregatorQuestion.type || '');

    const answered = this.getLatestAnsweredResponses(allResponses);

    switch (questionType) {
      case 'freeform':
        return this.renderFreeformAggregator(answered);

      case 'binary':
        return this.renderBinaryAggregator(answered);

      case 'rating':
        return this.renderRatingAggregator(answered);

      case 'multichoice':
        return this.renderMultichoiceAggregator(answered, aggregatorQuestion);

      default:
        return <div className={styles.aggregatorText}>No aggregator available for question type: {questionType}</div>;
    }
  };

  getAggregatorClassNames = (): SingleQuestionAggregatorClassNames => ({
    aggregatorContainerClassName: joinClassNames(
      styles.aggregatorContainer,
      this.props.aggregatorContainerClassName,
      styles.aggregatorText,
      this.props.aggregatorTextClassName,
    ),
    aggregatorParagraphClassName: joinClassNames(styles.aggregatorParagraph, this.props.aggregatorParagraphClassName),
    aggregatorFreeformAnswerClassName: joinClassNames(
      styles.freeformAnswer,
      this.props.aggregatorFreeformAnswerClassName,
      styles.aggregatorText,
      this.props.aggregatorTextClassName,
    ),
  });

  /**
   * Freeform aggregator logic:
   * - Tracks how many were encrypted, how many were blank, how many are shown
   * - Summarizes them in one line, e.g. "2 total responses. 0 encrypted responses not shown, 1 blank not shown."
   * - Displays non-empty, unencrypted answers in a simple list
   */
  renderFreeformAggregator = (parsedResponses: unknown[]): React.ReactNode => {
    const { aggregatorContainerClassName, aggregatorParagraphClassName, aggregatorFreeformAnswerClassName } =
      this.getAggregatorClassNames();
    const freeformSummary = buildFreeformAggregatorSummary(parsedResponses);
    if (freeformSummary.total === 0) {
      return (
        <div className={aggregatorContainerClassName}>
          <p className={aggregatorParagraphClassName}>No freeform responses available.</p>
        </div>
      );
    }

    return (
      <div className={aggregatorContainerClassName}>
        <p className={aggregatorParagraphClassName}>{freeformSummary.summaryParts.join(' ')}</p>
        {freeformSummary.displayedResponses.length > 0 && (
          <div className={styles.freeformAggregatorList}>
            {freeformSummary.displayedResponses.map((val: unknown, index: number) => (
              <div key={index} className={aggregatorFreeformAnswerClassName}>
                {typeof val === 'string' ? val : JSON.stringify(val)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // For aggregator binary
  renderBinaryAggregator = (parsedResponses: unknown[]): React.ReactNode => {
    const { aggregatorContainerClassName, aggregatorParagraphClassName } = this.getAggregatorClassNames();
    const binarySummary = buildBinaryAggregatorSummary(parsedResponses);
    if (binarySummary.total === 0) {
      return (
        <div className={aggregatorContainerClassName}>
          <p className={aggregatorParagraphClassName}>No binary responses available.</p>
        </div>
      );
    }
    const percent = (num: number) => ((num / binarySummary.total) * 100).toFixed(2);

    return (
      <div className={aggregatorContainerClassName}>
        <p className={aggregatorParagraphClassName}>{binarySummary.total} total binary responses:</p>
        <div className={styles.binaryAggregatorItem}>
          {this.renderAnswerByType('binary', 'Agree')}
          <span className={styles.binaryOptionResponse}>
            {' '}
            {binarySummary.counts.Agree} ({percent(binarySummary.counts.Agree)}%)
          </span>
        </div>
        <div className={styles.binaryAggregatorItem}>
          {this.renderAnswerByType('binary', 'Unsure')}
          <span className={styles.binaryOptionResponse}>
            {' '}
            {binarySummary.counts.Unsure} ({percent(binarySummary.counts.Unsure)}%)
          </span>
        </div>
        <div className={styles.binaryAggregatorItem}>
          {this.renderAnswerByType('binary', 'Disagree')}
          <span className={styles.binaryOptionResponse}>
            {' '}
            {binarySummary.counts.Disagree} ({percent(binarySummary.counts.Disagree)}%)
          </span>
        </div>
      </div>
    );
  };

  // For aggregator rating
  renderRatingAggregator = (parsedResponses: unknown[]): React.ReactNode => {
    const { aggregatorContainerClassName, aggregatorParagraphClassName } = this.getAggregatorClassNames();
    const ratingSummary = buildRatingAggregatorSummary(parsedResponses);
    if (ratingSummary.total === 0) {
      return (
        <div className={aggregatorContainerClassName}>
          <p className={aggregatorParagraphClassName}>No rating responses available.</p>
        </div>
      );
    }

    return (
      <div className={aggregatorContainerClassName}>
        <p className={aggregatorParagraphClassName}>{ratingSummary.total} total rating responses.</p>
        <p className={aggregatorParagraphClassName}>
          Average: {ratingSummary.average.toFixed(2)}, Median: {ratingSummary.median.toFixed(2)}
        </p>
      </div>
    );
  };

  // For aggregator multichoice (UPDATED: robust option detection + group-aware cache)
  renderMultichoiceAggregator = (
    parsedResponses: unknown[],
    aggregatorQuestion: SingleQuestionAggregatorQuestion,
  ): React.ReactNode => {
    const { aggregatorContainerClassName, aggregatorParagraphClassName } = this.getAggregatorClassNames();
    // Prefer options on the object; otherwise consult caches
    let allOptions = this.extractOptionsFromCandidate(aggregatorQuestion);
    if (!allOptions.length) {
      allOptions = this.getMultichoiceOptions(aggregatorQuestion);
    }

    const multichoiceSummary = buildMultichoiceAggregatorSummary(parsedResponses, allOptions);

    if (!multichoiceSummary.options.length) {
      return (
        <div className={aggregatorContainerClassName}>
          <p className={aggregatorParagraphClassName}>No multichoice options are defined for this question.</p>
        </div>
      );
    }

    if (multichoiceSummary.totalResponders === 0) {
      return (
        <div className={aggregatorContainerClassName}>
          <p className={aggregatorParagraphClassName}>No multichoice responses available.</p>
        </div>
      );
    }
    const percent = (num: number) => ((num / multichoiceSummary.totalResponders) * 100).toFixed(2);

    return (
      <div className={aggregatorContainerClassName}>
        <p className={aggregatorParagraphClassName}>
          {multichoiceSummary.totalResponders} total responders to this multichoice question.
        </p>
        {multichoiceSummary.options.map((label: string) => (
          <div key={label} className={styles.multiChoiceOption}>
            <span className={styles.optionLabel}>{label}</span>
            <span className={styles.optionStats}>
              {multichoiceSummary.counts[label]} ({percent(multichoiceSummary.counts[label])}%)
            </span>
          </div>
        ))}
      </div>
    );
  };

  /* Tiny helper: accept string or object; return true only for CEK envelope */
  isEnvelopeAesGcm256 = (encryptedPortion: unknown): boolean => {
    return isEnvelopeAesGcm256(encryptedPortion);
  };

  /**
   * Wire up the decrypt buttons. If the chosen field is masked ('*') and marked encrypted,
   * delegate to the parent onDecryptQuestion(question.id, field). For mini/profile views,
   * redirect to the full question page instead of decrypting in-place.
   */
  handleDecryptClick = (field: string): void => {
    const {
      question,
      response,
      onDecryptQuestion,
      isOwnResponse,
      canDecryptOtherResponses,
      mode,
      responderAddress,
      questionOnly,
    } = this.props;

    // Redirect for mini/profile views
    if (mode === 'mini' || questionOnly) {
      const rAddr = responderAddress || null;
      const sessionSlug = this.resolveGroupSlug();
      if (question?.id && rAddr) {
        window.location.href = buildQuestionRoutePath(question.id, { responderAddress: rAddr, sessionSlug });
        return;
      } else if (question?.id) {
        window.location.href = buildQuestionRoutePath(question.id, { sessionSlug });
        return;
      }
    }

    const canDecrypt = !!isOwnResponse || !!canDecryptOtherResponses || responseHasLitSbtRecipient(response);
    if (!onDecryptQuestion || !question?.id || !response || !canDecrypt) return;

    const target = field === 'additional' ? response.additional || {} : response.answer || {};

    // Only attempt when actually masked/encrypted
    const isMasked = target && target.value === '*' && (Boolean(target.encryptedPortion) || Boolean(target.encrypted));

    if (!isMasked) return;

    try {
      onDecryptQuestion(question.id, field, response);
    } catch (e) {
      questionLog.warn('SingleQuestionResponse: fallback', e);
    }
  };

  handlePromptReloadClick = (): void => {
    const { question, onReloadQuestionPrompt } = this.props;
    if (!question?.id || typeof onReloadQuestionPrompt !== 'function') return;
    try {
      onReloadQuestionPrompt(question.id);
    } catch (e) {
      questionLog.warn('SingleQuestionResponse: fallback', e);
    }
  };

  toggleMiniExpand = (): void => {
    this.setState((prev: SingleQuestionResponseState) => ({ miniExpanded: !prev.miniExpanded }));
  };

  /** Pick a stable id for cache lookups */
  getQuestionId = (q: unknown = {}): string => {
    const question = q && typeof q === 'object' ? (q as SingleQuestionRecord) : {};
    return String(
      question?.id ?? question?._id ?? question?.questionId ?? question?.uuid ?? question?.key ?? question?.slug ?? '',
    );
  };

  /** Resolve active session slug ('' = general) from canonical session props. */
  resolveGroupSlug = (): string => {
    const fromPath = resolveSessionSlugFromPathname(
      typeof window !== 'undefined' && window.location?.pathname ? window.location.pathname : '',
    );
    if (fromPath != null) return fromPath;

    const fromQuestion = this.props?.question?.sessionSlug ?? this.props?.question?.slug;
    if (fromQuestion != null) return normalizeSessionSlug(fromQuestion);

    const fromProp = this.props?.sessionSlug ?? this.props?.activeSessionSlug;
    if (fromProp != null) return normalizeSessionSlug(fromProp);

    return '';
  };

  /** Read the per-group questions map from cache mirror using the canonical string network ID. */
  readQuestionsMapFromGroupCache = (): SingleQuestionQuestionCacheMap => {
    const memoKey = `group:${this.getQuestionLookupContextKey()}`;
    if (this._questionsMapMemo.key === memoKey && this._questionsMapMemo.value) {
      return this._questionsMapMemo.value;
    }
    const slug = this.resolveGroupSlug();
    const netIdStr = String(
      this.props?.network?.id ?? this.props?.network?.chainId ?? this.props?.networkChainId ?? '',
    );

    let parsed = peekCacheSync('questionsCache', slug, { clone: false });
    if (!parsed || typeof parsed !== 'object') {
      const generalEntry = listNamespaceEntriesSync('questionsCache', { cloneValues: false }).find(
        (entry: SingleQuestionCacheEntry) => String(entry?.slug || '') === '',
      );
      parsed = generalEntry && typeof generalEntry.value === 'object' ? generalEntry.value : null;
      if (!parsed || typeof parsed !== 'object') return {};
    }

    const result = resolveSingleQuestionMapFromCacheValue(parsed, netIdStr);
    this._questionsMapMemo = { key: memoKey, value: result };
    return result;
  };

  /** Normalize any "options" shape into a string array (deduped, trimmed) */
  extractOptionsFromCandidate = (candidate: unknown): string[] => {
    return extractSingleQuestionOptionsFromCandidate(candidate);
  };

  /** Search ALL `dg:questionsCache:<slug>` caches for a question entry by id (lowercased); return first hit. */
  readQuestionEntryAcrossAllGroups = (idLower: unknown): unknown | null => {
    if (!idLower) return null;
    const memoKey = `cross:${idLower}|${this.getQuestionLookupContextKey()}`;
    if (this._crossGroupQuestionMemo.has(memoKey)) {
      return this._crossGroupQuestionMemo.get(memoKey) || null;
    }

    const netIdStr = String(
      this.props?.network?.id ?? this.props?.network?.chainId ?? this.props?.networkChainId ?? '',
    );
    const remember = (value: unknown): unknown | null => {
      this._crossGroupQuestionMemo.set(memoKey, value || null);
      this.trimMemoMap(this._crossGroupQuestionMemo, 256);
      return value || null;
    };

    try {
      const entries = listNamespaceEntriesSync('questionsCache', { cloneValues: false });
      return remember(findSingleQuestionEntryAcrossGroups({ entries, idLower, netIdStr }));
    } catch (e) {
      questionLog.warn('SingleQuestionResponse: fallback', e);
    }

    return remember(null);
  };

  /** Resolve multichoice options by checking inline, then caches, then storage (group-aware questions cache), and finally across all groups. */
  getMultichoiceOptions = (question: unknown): string[] => {
    const id = String(this.getQuestionId(question) || '').toLowerCase();
    if (!id) return [];

    // 1) Inline on the question object
    let out = this.extractOptionsFromCandidate(question);
    if (out.length) return out;

    const memoKey = `options:${id}|${this.getQuestionLookupContextKey()}`;
    const memoHit = this._multichoiceOptionsMemo.get(memoKey);
    if (Array.isArray(memoHit)) return memoHit as string[];
    const remember = (options: unknown): string[] => {
      const normalized = Array.isArray(options) ? (options as string[]) : [];
      this._multichoiceOptionsMemo.set(memoKey, normalized);
      this.trimMemoMap(this._multichoiceOptionsMemo, 256);
      return normalized;
    };

    // 2) Selector / hooks passed in via props
    const { getQuestionFromCache, selectQuestionById } = this.props || {};
    if (typeof getQuestionFromCache === 'function') {
      out = this.extractOptionsFromCandidate(getQuestionFromCache(id));
      if (out.length) return remember(out);
    }
    if (typeof selectQuestionById === 'function') {
      out = this.extractOptionsFromCandidate(selectQuestionById(id));
      if (out.length) return remember(out);
    }

    // 3) Common prop roots (Redux slices, entity maps, etc.)
    const { questionCache, questionsCache, questionsById, cache, entities, storeCache } = this.props || {};

    const roots = [
      questionsById,
      questionCache,
      questionsCache,
      cache?.questionsById,
      cache?.questions,
      entities?.questions,
      storeCache?.questionsById,
    ].filter((root): root is Record<string, unknown> => !!root && typeof root === 'object');

    for (const root of roots) {
      const hit = root?.[id] || root?.[String(id)];
      out = this.extractOptionsFromCandidate(hit);
      if (out.length) return remember(out);
    }

    // 4) Global runtime caches that might be hydrated elsewhere
    const w = typeof window !== 'undefined' ? (window as SingleQuestionGlobalCacheWindow) : undefined;
    const globals = [
      w?.__SURVEY_CACHE__?.questionsById,
      w?.__SURVEY_CACHE__,
      w?.__APP_CACHE__?.questionsById,
      w?.__APP_CACHE__?.questions,
      w?.__QUESTION_CACHE__,
    ].filter(Boolean) as Record<string, unknown>[];

    for (const root of globals) {
      const hit = root?.[id] || root?.[String(id)];
      out = this.extractOptionsFromCandidate(hit);
      if (out.length) return remember(out);
    }

    // 5) Read from group-aware questions cache
    try {
      const qMap = this.readQuestionsMapFromGroupCache();
      const hit = qMap?.[id];
      out = this.extractOptionsFromCandidate(hit);
      if (out.length) return remember(out);
    } catch (e) {
      questionLog.warn('SingleQuestionResponse: fallback', e);
    }

    // 5a) Cross-group last resort: scan all group caches for this id
    try {
      const cross = this.readQuestionEntryAcrossAllGroups(id);
      out = this.extractOptionsFromCandidate(cross);
      if (out.length) return remember(out);
    } catch (e) {
      questionLog.warn('SingleQuestionResponse: fallback', e);
    }

    return remember([]);
  };

  renderQuestionOnlyView() {
    const { question = {}, mode = 'mini', questionPromptClassName, questionPromptTestId } = this.props;
    const questionRecord = question || {};

    // Stable id + URL
    const qid = this.getQuestionId(questionRecord);
    const url = qid ? buildQuestionRoutePath(qid, { sessionSlug: this.resolveGroupSlug() }) : '/questions';
    const questionArweaveTxId = getLegacyArweaveTxId(questionRecord);
    const arweaveUrl = questionArweaveTxId
      ? normalizeArweaveUrl(questionArweaveTxId, { contextLabel: 'single_question_response_link' })
      : '';
    const hasCardActions = Boolean(qid || arweaveUrl);
    const isFullscreen = mode === 'fullscreen';
    const containerClassName = joinClassNames(
      isFullscreen ? styles.fullscreenQuestionContainer : styles.miniQuestionContainer,
      !isFullscreen && styles.clickThrough,
      this.props.containerClassName,
    );
    const questionBodyClassName = joinClassNames(
      styles.questionTitleBody,
      !hasCardActions && styles.questionTitleBodyNoLinks,
      isFullscreen && styles.questionOnlyFullscreenBody,
      this.props.bodyClassName,
    );
    const questionPromptClassNames = joinClassNames(
      styles.questionPromptText,
      isFullscreen && styles.questionPromptTextFullscreen,
      questionPromptClassName,
    );
    const readOnlyAffordanceClassName = joinClassNames(
      styles.questionOnlyAffordance,
      isFullscreen && styles.questionOnlyAffordanceFullscreen,
    );

    const openQuestion = () => {
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        questionLog.warn('SingleQuestionResponse: fallback', e);
      }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
      const k = e?.key;
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        openQuestion();
      }
    };

    const stopCardNavigation = (e: React.SyntheticEvent) => {
      e.stopPropagation();
    };

    const type = String(questionRecord.type || '').toLowerCase();

    // Non-interactive affordance by type
    let affordance: React.ReactNode = null;

    if (type === 'binary') {
      // For binary, we render the row of pills inside the card
      affordance = (
        <div className={styles.answerPillsRow} aria-hidden="true">
          <span className={buildSingleQuestionReadOnlyBinaryClassName(styles, 'agree')}>Agree</span>
          <span className={buildSingleQuestionReadOnlyBinaryClassName(styles, 'unsure')}>Unsure</span>
          <span className={buildSingleQuestionReadOnlyBinaryClassName(styles, 'disagree')}>Disagree</span>
        </div>
      );
    } else if (type === 'multichoice') {
      const options = this.getMultichoiceOptions(questionRecord) || [];
      affordance = options.length ? (
        <div className={styles.readOnlyMultichoice} aria-hidden="true">
          {options.map((opt: string, idx: number) => (
            <span key={`${opt}-${idx}`} className={styles.choiceItem}>
              {opt}
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.aggregatorText} aria-hidden="true">
          No options available.
        </div>
      );
    } else if (type === 'rating') {
      affordance = (
        <div className={styles.readOnlyRating} aria-hidden="true">
          <CESlider min={0} max={10} value={5} tooltip={false} disabled />
        </div>
      );
    } else if (type === 'freeform') {
      // Intentionally render nothing beyond the prompt (no input/placeholder).
      affordance = null;
    }

    // Keep mini cards click-through like UserPage, while fullscreen cards act as static hero panels.
    return (
      <Card
        className={containerClassName}
        onClick={!isFullscreen ? openQuestion : undefined}
        onKeyDown={!isFullscreen ? onKeyDown : undefined}
        role={!isFullscreen ? 'button' : undefined}
        tabIndex={!isFullscreen ? 0 : undefined}
        aria-label={!isFullscreen ? 'Open question' : undefined}
      >
        <CardBody className={questionBodyClassName}>
          {hasCardActions && (
            <div className={styles.cardLinksContainer}>
              {arweaveUrl && (
                <a
                  href={arweaveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.cardLinkButton}
                  title="View on Arweave"
                  onClick={stopCardNavigation}
                  onMouseDown={stopCardNavigation}
                  onKeyDown={stopCardNavigation}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
              )}
              {qid && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.cardLinkButton}
                  title="View question page"
                  onClick={stopCardNavigation}
                  onMouseDown={stopCardNavigation}
                  onKeyDown={stopCardNavigation}
                >
                  <FontAwesomeIcon icon={faExpand} />
                </a>
              )}
            </div>
          )}
          {/* Prompt */}
          <div className={questionPromptClassNames} data-testid={questionPromptTestId}>
            {questionRecord?.prompt || 'Untitled question'}
          </div>

          {/* Read-only affordance */}
          {affordance && <div className={readOnlyAffordanceClassName}>{affordance}</div>}
        </CardBody>
      </Card>
    );
  }

  renderSinglePersonView = (): React.ReactNode => {
    const {
      question,
      response,
      isOwnResponse,
      mode,
      showImportance,
      responderAddress,
      questionOnly,
      compactEncryptedAnswerCta = false,
      stackCompactDecryptCta = false,
    } = this.props;
    const { miniExpanded, isBookmarked, bookmarkSuccess } = this.state;

    // Non-interactive created-question view
    if (questionOnly && question && !response) {
      return this.renderQuestionOnlyView();
    }

    if (!question || !response) {
      // Preserve prior placeholder for genuine unknowns
      return (
        <Card
          className={
            mode === 'mini'
              ? styles.miniQuestionContainer
              : joinClassNames(styles.fullscreenQuestionContainer, this.props.containerClassName)
          }
        >
          <CardBody className={joinClassNames(styles.questionTitleBody, this.props.bodyClassName)}>
            <h4 className={styles.questionTitle}>Loading question/response...</h4>
          </CardBody>
        </Card>
      );
    }

    const { prompt, type, id } = question;
    const finalArweaveTxId = getLegacyArweaveTxId(response) || getLegacyArweaveTxId(question);
    const answer = response.answer || {};
    const additional = response.additional || {};
    const conviction = response.conviction !== undefined ? response.conviction : (response.importance ?? null);
    const normalizedConviction = normalizeRatingValue(conviction, null);

    const isAnswerEncrypted = answer.encrypted && answer.value === '*';
    const isAdditionalEncrypted = additional.encrypted && additional.value === '*';
    const isPromptMasked = String(prompt || '').trim() === '[encrypted]';
    const promptDisplay = resolveQuestionPayloadDisplayState(question, this.props.sessionConfig || null);
    const promptLabel = isPromptMasked ? promptDisplay.label || prompt : prompt;
    const shouldMaskVisibleResponseForMaskedPrompt = isPromptMasked && !isAnswerEncrypted;
    const canReloadPrompt = isPromptMasked && !!id && typeof this.props.onReloadQuestionPrompt === 'function';
    const promptReloading = !!this.props.promptReloading;
    const canDecryptThisResponse =
      !!isOwnResponse || !!this.props.canDecryptOtherResponses || responseHasLitSbtRecipient(response);
    const promptGateTooltipProps = resolvePromptGateTooltipProps({
      question,
      gateId: this.props.gateId,
      gateConfig: this.props.gateConfig,
      gateMode: this.props.gateMode,
      sbtAddresses: this.props.sbtAddresses,
      userHeldSBTs: this.props.userHeldSBTs,
    });
    const decryptCtaClassName = styles.decryptCta;
    const wrapCompactDecryptCta = (buttonNode: React.ReactNode, field = ''): React.ReactNode => {
      if (!compactEncryptedAnswerCta || !stackCompactDecryptCta) return buttonNode;
      return (
        <div className={styles.compactDecryptCtaStack} data-ce-decrypt-field={field}>
          {buttonNode}
        </div>
      );
    };

    const renderEncryptedAnswer = () => {
      if (canDecryptThisResponse) {
        return wrapCompactDecryptCta(
          <Button
            onClick={() => this.handleDecryptClick('answer')}
            className={decryptCtaClassName}
            data-testid={E2E_TESTIDS.DECRYPT_ANSWER}
            data-ce-question-id={String(id || '')
              .trim()
              .toLowerCase()}
          >
            Decrypt Answer
          </Button>,
          'answer',
        );
      }
      return (
        <p
          className={styles.encryptedResponseText}
          data-testid={E2E_TESTIDS.ENCRYPTED_ANSWER_NOTICE}
          data-ce-question-id={String(id || '')
            .trim()
            .toLowerCase()}
        >
          This answer is encrypted.
        </p>
      );
    };

    const renderMaskedPromptResponse = () => (
      <p
        className={styles.encryptedResponseText}
        data-testid={E2E_TESTIDS.ENCRYPTED_ANSWER_NOTICE}
        data-ce-question-id={String(id || '')
          .trim()
          .toLowerCase()}
      >
        This response is gated with the question.
      </p>
    );

    const renderEncryptedAdditional = () => {
      if (canDecryptThisResponse) {
        return wrapCompactDecryptCta(
          <Button
            onClick={() => this.handleDecryptClick('additional')}
            className={decryptCtaClassName}
            data-testid={E2E_TESTIDS.DECRYPT_ADDITIONAL}
            data-ce-question-id={String(id || '')
              .trim()
              .toLowerCase()}
          >
            Decrypt Additional Comments
          </Button>,
          'additional',
        );
      }
      return (
        <p
          className={styles.encryptedResponseText}
          data-testid={E2E_TESTIDS.ENCRYPTED_ADDITIONAL_NOTICE}
          data-ce-question-id={String(id || '')
            .trim()
            .toLowerCase()}
        >
          Additional comments are encrypted.
        </p>
      );
    };

    const wrapMaskedPromptLabel = (content: React.ReactNode): React.ReactNode => {
      if (!isPromptMasked) return content;
      return (
        <GateTooltip
          gateId={promptGateTooltipProps.gateId}
          gateConfig={promptGateTooltipProps.gateConfig}
          mode={promptGateTooltipProps.mode}
          sbtAddresses={promptGateTooltipProps.sbtAddresses}
          userHeldSBTs={promptGateTooltipProps.userHeldSBTs}
        >
          {content}
        </GateTooltip>
      );
    };

    const hasCardActions = Boolean(id || finalArweaveTxId);
    const containerClass =
      mode === 'fullscreen'
        ? joinClassNames(styles.fullscreenQuestionContainer, this.props.containerClassName)
        : styles.miniQuestionContainer;
    const questionBodyClassName = joinClassNames(
      styles.questionTitleBody,
      !hasCardActions && styles.questionTitleBodyNoLinks,
      this.props.bodyClassName,
    );
    const cardLinksClassName = joinClassNames(styles.cardLinksContainer, this.props.linksContainerClassName);
    const cardLinkButtonClassName = joinClassNames(styles.cardLinkButton, this.props.iconButtonClassName);

    const showFullDetail = mode === 'fullscreen' || miniExpanded;

    let externalLink: string | null = null;
    if (responderAddress && id) {
      externalLink = buildQuestionRoutePath(id, {
        responderAddress,
        sessionSlug: this.resolveGroupSlug(),
      });
    }

    // In mini mode, only show external/expand buttons when expanded
    const showMiniExtras = mode !== 'mini' || miniExpanded;

    return (
      <Card className={containerClass}>
        <CardBody className={questionBodyClassName}>
          {hasCardActions && (
            <div className={cardLinksClassName}>
              {Boolean(id) && (
                <button
                  onClick={this.handleBookmarkClick}
                  className={joinClassNames(
                    cardLinkButtonClassName,
                    styles.bookmarkCardLinkButton,
                    isBookmarked ? styles.bookmarkCardLinkButtonActive : '',
                  )}
                  title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                >
                  <FontAwesomeIcon
                    icon={faBookmark}
                    style={resolveSingleQuestionBookmarkIconStyle(bookmarkSuccess, isBookmarked)}
                  />
                </button>
              )}

              {/* External/Expand are gated in mini mode until expanded */}
              {showMiniExtras && Boolean(finalArweaveTxId) && (
                <a
                  href={normalizeArweaveUrl(finalArweaveTxId, { contextLabel: 'single_question_response_link' })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cardLinkButtonClassName}
                  title="View on Arweave"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
              )}
              {showMiniExtras && Boolean(id) && (
                <a
                  href={
                    externalLink ||
                    buildQuestionRoutePath(id, {
                      responderAddress: responderAddress || '',
                      sessionSlug: this.resolveGroupSlug(),
                    })
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cardLinkButtonClassName}
                  title="View question page"
                >
                  <FontAwesomeIcon icon={faExpand} />
                </a>
              )}
            </div>
          )}

          {mode === 'mini' && (
            <div className={styles.miniHeader}>
              <div className={styles.miniQuestionSummary}>
                {canReloadPrompt ? (
                  <button
                    type="button"
                    className={buildSingleQuestionMiniPromptButtonClassName(styles)}
                    onClick={this.handlePromptReloadClick}
                    disabled={promptReloading}
                    aria-busy={promptReloading}
                    title="Decrypt gated prompt"
                  >
                    {wrapMaskedPromptLabel(
                      promptReloading ? (
                        <span className={styles.maskedPromptLoading}>
                          <FontAwesomeIcon icon={faSpinner} spin className={styles.maskedPromptLoadingSpinner} />
                          <span>Decrypting...</span>
                        </span>
                      ) : (
                        promptLabel
                      ),
                    )}
                  </button>
                ) : (
                  wrapMaskedPromptLabel(<span className={styles.miniPromptAbbrev}>{promptLabel}</span>)
                )}
              </div>
              <Button className={styles.miniExpandButton} onClick={this.toggleMiniExpand}>
                {miniExpanded ? <FontAwesomeIcon icon={faChevronUp} /> : <FontAwesomeIcon icon={faChevronDown} />}
              </Button>
            </div>
          )}

          {!showFullDetail && mode === 'mini' && (
            <>
              {isAnswerEncrypted ? (
                renderEncryptedAnswer()
              ) : shouldMaskVisibleResponseForMaskedPrompt ? (
                renderMaskedPromptResponse()
              ) : (
                <>{this.renderAnswerByType(type, answer.value)}</>
              )}
            </>
          )}

          {showFullDetail && (
            <>
              {mode === 'fullscreen' && (
                <div className={styles.promptDecryptRow}>
                  <h4 className={styles.questionTitle}>
                    {canReloadPrompt ? (
                      <button
                        type="button"
                        className={styles.maskedPromptActionButton}
                        onClick={this.handlePromptReloadClick}
                        disabled={promptReloading}
                        aria-busy={promptReloading}
                        title={promptDisplay.actionTitle || 'Decrypt gated prompt'}
                      >
                        {wrapMaskedPromptLabel(
                          promptReloading ? (
                            <span className={styles.maskedPromptLoading}>
                              <FontAwesomeIcon icon={faSpinner} spin className={styles.maskedPromptLoadingSpinner} />
                              <span>{promptDisplay.busyLabel || 'Decrypting...'}</span>
                            </span>
                          ) : (
                            promptLabel || 'Question'
                          ),
                        )}
                      </button>
                    ) : (
                      wrapMaskedPromptLabel(promptLabel || 'Question')
                    )}
                  </h4>
                </div>
              )}

              {isAnswerEncrypted
                ? renderEncryptedAnswer()
                : shouldMaskVisibleResponseForMaskedPrompt
                  ? renderMaskedPromptResponse()
                  : this.renderAnswerByType(type, answer.value)}

              {!shouldMaskVisibleResponseForMaskedPrompt && additional && additional.value ? (
                isAdditionalEncrypted ? (
                  renderEncryptedAdditional()
                ) : (
                  <div className={styles.additionalCommentsSection}>
                    <strong className={styles.additionalCommentsLabel}>Additional Comments:</strong>
                    <p className={styles.additionalCommentsContent}>
                      {typeof additional.value === 'string' ? additional.value : JSON.stringify(additional.value)}
                    </p>
                  </div>
                )
              ) : null}

              {showImportance && !isAnswerEncrypted && !isAdditionalEncrypted && normalizedConviction !== null && (
                <div className={styles.importanceSlider}>
                  <h6 className={styles.importanceText}>Conviction: {normalizedConviction}</h6>
                  <CESlider
                    min={RATING_MIN}
                    max={RATING_MAX}
                    step={1}
                    value={normalizedConviction}
                    tooltip={false}
                    disabled={true}
                    style={SINGLE_QUESTION_IMPORTANCE_SLIDER_STYLE}
                    className={styles.ratingSlider}
                  />
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    );
  };

  // Renders the user interface
  render() {
    const { aggregatorResponseMode, question } = this.props;
    const { isBookmarked, bookmarkSuccess } = this.state;

    if (aggregatorResponseMode) {
      const aggregatorQuestion = question || {};
      const aggregatorQuestionId = aggregatorQuestion.id;
      const aggregatorQuestionArweaveTxId = getLegacyArweaveTxId(aggregatorQuestion);
      const containerClassName = joinClassNames(styles.fullscreenQuestionContainer, this.props.containerClassName);
      const hasCardActions = Boolean(aggregatorQuestionId || aggregatorQuestionArweaveTxId);
      const questionBodyClassName = joinClassNames(
        styles.questionTitleBody,
        !hasCardActions && styles.questionTitleBodyNoLinks,
        this.props.bodyClassName,
      );
      const cardLinksClassName = joinClassNames(styles.cardLinksContainer, this.props.linksContainerClassName);
      const cardLinkButtonClassName = joinClassNames(styles.cardLinkButton, this.props.iconButtonClassName);
      // aggregator summary logic
      return (
        <Card className={containerClassName}>
          <CardBody className={questionBodyClassName}>
            {hasCardActions && (
              <div className={cardLinksClassName}>
                {Boolean(aggregatorQuestionId) && (
                  <button
                    onClick={this.handleBookmarkClick}
                    className={joinClassNames(
                      cardLinkButtonClassName,
                      styles.bookmarkCardLinkButton,
                      isBookmarked ? styles.bookmarkCardLinkButtonActive : '',
                    )}
                    title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                  >
                    <FontAwesomeIcon
                      icon={faBookmark}
                      style={resolveSingleQuestionBookmarkIconStyle(bookmarkSuccess, isBookmarked)}
                    />
                  </button>
                )}
                {Boolean(aggregatorQuestionArweaveTxId) && (
                  <a
                    href={normalizeArweaveUrl(aggregatorQuestionArweaveTxId, {
                      contextLabel: 'single_question_response_link',
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardLinkButtonClassName}
                    title="View on Arweave"
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                  </a>
                )}
                {Boolean(aggregatorQuestionId) && (
                  <a
                    href={buildQuestionRoutePath(aggregatorQuestionId, { sessionSlug: this.resolveGroupSlug() })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardLinkButtonClassName}
                    title="View question page"
                  >
                    <FontAwesomeIcon icon={faExpand} />
                  </a>
                )}
              </div>
            )}
            {this.renderAggregatorByType()}
          </CardBody>
        </Card>
      );
    }

    // Otherwise, single-person display
    return this.renderSinglePersonView();
  }

  // For single-person display: renders the answer portion by question type (UPDATED for multichoice)
  renderAnswerByType = (type: unknown, value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === '') {
      return <div className={styles.freeformAnswer}>No answer provided.</div>;
    }

    switch (type) {
      case 'multichoice': {
        const toLabel = (x: unknown) => {
          if (typeof x === 'string') return x;
          if (!x || typeof x !== 'object') return '';
          const option = x as SingleQuestionRecord;
          return option.label ?? option.text ?? option.name ?? option.value ?? '';
        };
        const raw = Array.isArray(value) ? value : value != null ? [value] : [];
        const labels = raw
          .map(toLabel)
          .map((s: unknown) => String(s).trim())
          .filter(Boolean);
        if (!labels.length) {
          return <div className={styles.freeformAnswer}>No answer provided.</div>;
        }
        return (
          <div className={styles.readOnlyMultichoice}>
            {labels.map((option: string, idx: number) => (
              <div key={`${option}-${idx}`} className={styles.choiceItem}>
                {option}
              </div>
            ))}
          </div>
        );
      }

      case 'rating': {
        const normalizedRatingValue = normalizeRatingValue(value, null);
        if (normalizedRatingValue === null) {
          return <div className={styles.freeformAnswer}>No answer provided.</div>;
        }
        const ratingFillPercent = getRatingFillPercent(value, RATING_MIN);
        return (
          <div className={styles.readOnlyRating}>
            <div className={styles.ratingTrack}>
              <div className={styles.ratingBar} style={resolveSingleQuestionRatingBarStyle(ratingFillPercent)} />
            </div>
            <span className={styles.ratingValueLabel}>{`${normalizedRatingValue}/${RATING_MAX}`}</span>
          </div>
        );
      }

      case 'binary': {
        const optionClass = String(value).toLowerCase();
        return (
          <div className={buildSingleQuestionReadOnlyBinaryClassName(styles, optionClass)}>
            {value === 'Agree' && <FontAwesomeIcon icon={faCheck} className={styles.optionIcon} />}
            {value === 'Disagree' && <FontAwesomeIcon icon={faTimes} className={styles.optionIcon} />}
            {String(value)}
          </div>
        );
      }

      case 'freeform':
      default:
        return <div className={styles.freeformAnswer}>{typeof value === 'string' ? value : JSON.stringify(value)}</div>;
    }
  };
}

export default SingleQuestionResponse;
