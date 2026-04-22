/** @file SingleQuestionResponse.jsx */

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
import { buildQuestionRoutePath } from '../../utilities/survey/questionRouting.js';
import { normalizeSessionSlug, resolveSessionSlugFromPathname } from '../../utilities/session/sessionNaming.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import GateTooltip from '../Gates/GateTooltip';
import {
  listNamespaceEntriesSync,
  peekCacheSync,
  writeCache,
} from '../../utilities/cache/cacheScripts.js';
import { isFreeformBlankAnswer } from '../../utilities/survey/freeformAnswerUtils.js';
import {
  getRatingFillPercent,
  normalizeRatingValue,
  RATING_MAX,
  RATING_MIN,
} from '../../utilities/survey/ratingValue.js';

const questionLog = createLogger('questions');

const normalizeText = (value) => String(value || '').trim();
const joinClassNames = (...parts) => parts.filter(Boolean).join(' ');

const collectGateAddresses = (gates = [], directAddresses = []) => {
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const address = normalizeText(value);
    if (!address) return;
    const key = address.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(address);
  };

  (Array.isArray(directAddresses) ? directAddresses : []).forEach(push);
  (Array.isArray(gates) ? gates : []).forEach((gate) => {
    (Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []).forEach(push);
    push(gate?.sbtAddress);
  });

  return out;
};

const normalizeGateMode = (gate = null, fallbackMode = '') => {
  const raw = normalizeText(fallbackMode || gate?.mode || gate?.operator || gate?.gateMode).toLowerCase();
  if (gate?.requireAll === true || raw === 'all' || raw === 'and') return 'all';
  return raw === 'any' || !raw ? 'any' : raw;
};

const resolvePromptGateTooltipProps = ({
  question = null,
  gateId = '',
  gateConfig = null,
  gateMode = '',
  sbtAddresses = [],
  userHeldSBTs = [],
} = {}) => {
  const questionGateList = Array.isArray(question?.encryption?.gates)
    ? question.encryption.gates
    : Array.isArray(question?.gates)
      ? question.gates
      : [];
  const resolvedGateConfig =
    gateConfig ||
    question?.gateConfig ||
    question?.encryption?.gate ||
    question?.gate ||
    questionGateList[0] ||
    null;
  const resolvedAddresses = collectGateAddresses(questionGateList, [
    ...(Array.isArray(sbtAddresses) ? sbtAddresses : []),
    ...(Array.isArray(question?.sbtAddresses) ? question.sbtAddresses : []),
    ...(Array.isArray(question?.encryption?.sbtAddresses) ? question.encryption.sbtAddresses : []),
  ]);

  return {
    gateId: normalizeText(
      gateId ||
      question?.gateId ||
      question?.encryption?.gateId ||
      resolvedGateConfig?.gateId ||
      resolvedGateConfig?.id
    ) || null,
    gateConfig: resolvedGateConfig,
    mode: normalizeGateMode(
      resolvedGateConfig,
      gateMode || question?.gateMode || question?.encryption?.mode
    ),
    sbtAddresses: resolvedAddresses,
    userHeldSBTs: Array.isArray(userHeldSBTs) ? userHeldSBTs : [],
  };
};




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

class SingleQuestionResponse extends Component {
  constructor(props) {
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

  componentDidUpdate(prevProps) {
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

  clearQuestionLookupMemo = () => {
    this._questionsMapMemo = { key: '', value: {} };
    this._crossGroupQuestionMemo.clear();
    this._multichoiceOptionsMemo.clear();
  };

  trimMemoMap = (map, maxEntries = 128) => {
    if (!map || typeof map.size !== 'number') return;
    while (map.size > maxEntries) {
      const firstKey = map.keys().next().value;
      map.delete(firstKey);
    }
  };

  getQuestionLookupContextKey = () => {
    const slug = this.resolveGroupSlug();
    const netIdStr = String(
      this.props?.network?.id ??
      this.props?.network?.chainId ??
      this.props?.networkChainId ??
      ''
    );
    const nonceParts = [
      this.props?.questionsCacheNonce,
      this.props?.cacheNonce,
      this.props?.cacheRevision,
    ]
      .map((part) => (part == null ? '' : String(part)))
      .join(':');
    return `${slug}|${netIdStr}|${nonceParts}`;
  };

  buildAggregatorResponseSignature = (allResponses = []) => {
    const total = Array.isArray(allResponses) ? allResponses.length : 0;
    if (total <= 0) return '0';
    const first = allResponses[0] || {};
    const last = allResponses[total - 1] || {};
    return [
      total,
      String(first.responder || ''),
      String(first.timestamp || ''),
      String(last.responder || ''),
      String(last.timestamp || ''),
    ].join('|');
  };

  getLatestAnsweredResponses = (allResponses = []) => {
    if (!Array.isArray(allResponses) || allResponses.length === 0) {
      return [];
    }
    const signature = this.buildAggregatorResponseSignature(allResponses);
    const memo = this._aggregatorAnsweredMemo;
    if (memo.responsesRef === allResponses && memo.signature === signature) {
      return memo.value;
    }

    const responderMap = new Map();
    allResponses.forEach((r) => {
      const existing = responderMap.get(r.responder);
      const existingTs = existing ? parseInt(existing.timestamp, 10) : 0;
      const newTs = parseInt(r.timestamp, 10);
      if (!existing || existingTs < newTs) {
        responderMap.set(r.responder, r);
      }
    });
    const uniqueResps = Array.from(responderMap.values()).map((r) => r.response);
    const answered = uniqueResps.filter(Boolean);
    this._aggregatorAnsweredMemo = { responsesRef: allResponses, signature, value: answered };
    return answered;
  };

  checkBookmarkStatus = () => {
    const { question } = this.props;
    if (!question || !question.id) return;

    try {
      const slug = this.resolveGroupSlug();
      const bookmarksCache = peekCacheSync('bookmarksCache', slug, { clone: false });
      const isBookmarked = bookmarksCache?.questions?.includes(question.id);
      if (this.state.isBookmarked !== !!isBookmarked) {
        this.setState({ isBookmarked: !!isBookmarked });
      }
    } catch (error) {
      questionLog.error('[SingleQuestionResponse] Error reading bookmarksCache:', error);
      if (this.state.isBookmarked !== false) {
        this.setState({ isBookmarked: false });
      }
    }
  };

  handleBookmarkClick = () => {
    const { question } = this.props;
    if (!question || !question.id) return;

    const questionId = question.id;
    const slug = this.resolveGroupSlug();
    let bookmarksCache;

    try {
      const existing = peekCacheSync('bookmarksCache', slug, { clone: false }) || {};
      const base = (typeof existing === 'object' && existing !== null) ? existing : {};
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
    let nowBookmarked;

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
    this.setState({ isBookmarked: nowBookmarked, bookmarkSuccess: true });
    if (this._bookmarkSuccessTimer) {
      clearTimeout(this._bookmarkSuccessTimer);
    }
    this._bookmarkSuccessTimer = setTimeout(() => {
      this._bookmarkSuccessTimer = null;
      this.setState({ bookmarkSuccess: false });
    }, 1500); // Feedback for 1.5s

    void writeCache('bookmarksCache', slug, bookmarksCache).catch((error) => {
      questionLog.error('[SingleQuestionResponse] Error saving bookmarksCache:', error);
    });
  };

  // For aggregator mode (allResponses array). We compute summary stats & display them.
  renderAggregatorByType = () => {
    const { question, allResponses } = this.props;

    // If question is missing, we provide a fallback so we don't just show "Loading question/response..."
    // This way aggregator data is still displayed.
    const aggregatorQuestion = question || {
      prompt: '(No prompt found)',
      type: 'freeform',
      options: [],
    };

    if (!allResponses || !Array.isArray(allResponses)) {
      return <p className={styles.aggregatorText}>No aggregator data available.</p>;
    }

    const questionType = aggregatorQuestion.type || '';

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
        return (
          <div className={styles.aggregatorText}>
            No aggregator available for question type: {questionType}
          </div>
        );
    }
  };

  getAggregatorClassNames = () => ({
    aggregatorContainerClassName: joinClassNames(
      styles.aggregatorContainer,
      this.props.aggregatorContainerClassName,
      styles.aggregatorText,
      this.props.aggregatorTextClassName
    ),
    aggregatorParagraphClassName: joinClassNames(
      styles.aggregatorParagraph,
      this.props.aggregatorParagraphClassName
    ),
    aggregatorFreeformAnswerClassName: joinClassNames(
      styles.freeformAnswer,
      this.props.aggregatorFreeformAnswerClassName,
      styles.aggregatorText,
      this.props.aggregatorTextClassName
    ),
  });

  /**
   * Freeform aggregator logic:
   * - Tracks how many were encrypted, how many were blank, how many are shown
   * - Summarizes them in one line, e.g. "2 total responses. 0 encrypted responses not shown, 1 blank not shown."
   * - Displays non-empty, unencrypted answers in a simple list
   */
  renderFreeformAggregator = (parsedResponses) => {
    const {
      aggregatorContainerClassName,
      aggregatorParagraphClassName,
      aggregatorFreeformAnswerClassName,
    } = this.getAggregatorClassNames();
    const total = parsedResponses.length;
    if (total === 0) {
      return (
        <div className={aggregatorContainerClassName}>
          <p className={aggregatorParagraphClassName}>No freeform responses available.</p>
        </div>
      );
    }

    let encryptedCount = 0;
    let blankCount = 0;
    let displayedResponses = [];

    parsedResponses.forEach((respObj) => {
      if (!respObj || !respObj.answer) return;
      const val = respObj.answer.value;

      if (respObj.answer.encrypted && val === '*') {
        encryptedCount++;
      } else if (isFreeformBlankAnswer('freeform', respObj)) {
        blankCount++;
      } else {
        displayedResponses.push(val);
      }
    });

    const nonBlankTotal = Math.max(total - blankCount, 0);

    // Build a summary line
    // e.g. "2 total responses. 1 encrypted not shown, 1 blank not shown."
    // but omit the piece if it's zero
    const parts = [`${nonBlankTotal} total responses.`];
    if (encryptedCount > 0) {
      parts.push(`${encryptedCount} encrypted responses not shown.`);
    } else {
      parts.push(`0 encrypted responses not shown.`);
    }
    if (blankCount > 0) {
      parts.push(`${blankCount} blank not shown.`);
    }

    return (
      <div className={aggregatorContainerClassName}>
        <p className={aggregatorParagraphClassName}>{parts.join(' ')}</p>
        {displayedResponses.length > 0 && (
          <div className={styles.freeformAggregatorList}>
            {displayedResponses.map((val, index) => (
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
  renderBinaryAggregator = (parsedResponses) => {
    const { aggregatorContainerClassName, aggregatorParagraphClassName } = this.getAggregatorClassNames();
    let counts = { Agree: 0, Unsure: 0, Disagree: 0 };
    let total = 0;
    parsedResponses.forEach((resp) => {
      if (resp && resp.answer && resp.answer.value) {
        const val = resp.answer.value;
        if (['Agree', 'Unsure', 'Disagree'].includes(val)) {
          counts[val] = counts[val] + 1;
          total++;
        }
      }
    });
    if (total === 0) {
      return (
        <div className={aggregatorContainerClassName}>
          <p className={aggregatorParagraphClassName}>No binary responses available.</p>
        </div>
      );
    }
    const percent = (num) => ((num / total) * 100).toFixed(2);

    return (
      <div className={aggregatorContainerClassName}>
        <p className={aggregatorParagraphClassName}>{total} total binary responses:</p>
        <div className={styles.binaryAggregatorItem}>
          {this.renderAnswerByType('binary', 'Agree')}
          <span className={styles.binaryOptionResponse}> {counts.Agree} ({percent(counts.Agree)}%)</span>
        </div>
        <div className={styles.binaryAggregatorItem}>
          {this.renderAnswerByType('binary', 'Unsure')}
          <span className={styles.binaryOptionResponse}> {counts.Unsure} ({percent(counts.Unsure)}%)</span>
        </div>
        <div className={styles.binaryAggregatorItem}>
          {this.renderAnswerByType('binary', 'Disagree')}
          <span className={styles.binaryOptionResponse}> {counts.Disagree} ({percent(counts.Disagree)}%)</span>
        </div>
      </div>
    );
  };

  // For aggregator rating
  renderRatingAggregator = (parsedResponses) => {
    const { aggregatorContainerClassName, aggregatorParagraphClassName } = this.getAggregatorClassNames();
    const values = [];
    parsedResponses.forEach((resp) => {
      const ratingValue = normalizeRatingValue(resp?.answer?.value, null);
      if (ratingValue !== null) values.push(ratingValue);
    });
    if (values.length === 0) {
      return (
        <div className={aggregatorContainerClassName}>
          <p className={aggregatorParagraphClassName}>No rating responses available.</p>
        </div>
      );
    }
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    let median = 0;
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      median = (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      median = sorted[mid];
    }

    return (
      <div className={aggregatorContainerClassName}>
        <p className={aggregatorParagraphClassName}>
          {values.length} total rating responses.
        </p>
        <p className={aggregatorParagraphClassName}>
          Average: {avg.toFixed(2)}, Median: {median.toFixed(2)}
        </p>
      </div>
    );
  };

  // For aggregator multichoice (UPDATED: robust option detection + group-aware cache)
  renderMultichoiceAggregator = (parsedResponses, aggregatorQuestion) => {
    const { aggregatorContainerClassName, aggregatorParagraphClassName } = this.getAggregatorClassNames();
    // Prefer options on the object; otherwise consult caches
    let allOptions = this.extractOptionsFromCandidate(aggregatorQuestion);
    if (!allOptions.length) {
      allOptions = this.getMultichoiceOptions(aggregatorQuestion);
    }

    // If still no options, derive them from the answers so we can show *something*
    if (!allOptions.length) {
      const deriveLabel = (choice) => {
        if (typeof choice === 'string') return choice;
        if (!choice || typeof choice !== 'object') return '';
        return choice.label ?? choice.text ?? choice.name ?? choice.value ?? '';
      };
      const bag = new Set();
      (parsedResponses || []).forEach((resp) => {
        if (!resp?.answer || resp.answer.encrypted) return;
        const v = resp.answer.value;
        const arr = Array.isArray(v) ? v : (v != null ? [v] : []);
        arr.map(deriveLabel).map((s) => String(s).trim()).filter(Boolean).forEach((s) => bag.add(s));
      });
      allOptions = Array.from(bag);
    }

    if (!allOptions.length) {
      return (
        <div className={aggregatorContainerClassName}>
          <p className={aggregatorParagraphClassName}>
            No multichoice options are defined for this question.
          </p>
        </div>
      );
    }

    // Canonicalize labels for case-insensitive matching while preserving display casing
    const canon = (s) => String(s).trim().toLowerCase();
    const displayByKey = {};
    allOptions.forEach((opt) => {
      const label = String(opt || '').trim();
      if (!label) return;
      const k = canon(label);
      if (!(k in displayByKey)) displayByKey[k] = label; // first one wins
    });

    const counts = {};
    Object.values(displayByKey).forEach((label) => { counts[label] = 0; });

    const labelFromChoice = (x) => {
      if (typeof x === 'string') return x;
      if (!x || typeof x !== 'object') return '';
      return x.label ?? x.text ?? x.name ?? x.value ?? '';
    };

    let totalResponders = 0;

    (parsedResponses || []).forEach((resp) => {
      if (!resp?.answer || resp.answer.encrypted) return;
      const v = resp.answer.value;

      // Collect this responder’s unique picks (no double-counting same label)
      const picks = new Set();
      const addPick = (raw) => {
        const lbl = String(labelFromChoice(raw)).trim();
        if (!lbl) return;
        const key = canon(lbl);
        if (displayByKey[key]) picks.add(displayByKey[key]); // only count known options
      };

      if (Array.isArray(v)) {
        v.forEach(addPick);
      } else if (v != null) {
        addPick(v);
      }

      if (picks.size > 0) {
        totalResponders += 1;
        picks.forEach((disp) => { counts[disp] += 1; });
      }
    });

    if (totalResponders === 0) {
      return (
        <div className={aggregatorContainerClassName}>
          <p className={aggregatorParagraphClassName}>No multichoice responses available.</p>
        </div>
      );
    }
    const percent = (num) => ((num / totalResponders) * 100).toFixed(2);

    return (
      <div className={aggregatorContainerClassName}>
        <p className={aggregatorParagraphClassName}>
          {totalResponders} total responders to this multichoice question.
        </p>
        {Object.values(displayByKey).map((label) => (
          <div key={label} className={styles.multiChoiceOption}>
            <span className={styles.optionLabel}>{label}</span>
            <span className={styles.optionStats}>
              {counts[label]} ({percent(counts[label])}%)
            </span>
          </div>
        ))}
      </div>
    );
  };

  /* Tiny helper: accept string or object; return true only for CEK envelope */
  isEnvelopeAesGcm256 = (encryptedPortion) => {
    try {
      const env = typeof encryptedPortion === 'string'
        ? JSON.parse(encryptedPortion)
        : (encryptedPortion || {});
      return Number(env?.v) === 2 && String(env?.cipher).toLowerCase() === 'aes-gcm-256';
    } catch {
      return false; // parse failed -> treat as incompatible legacy/unknown
    }
  };

  /**
   * Wire up the decrypt buttons. If the chosen field is masked ('*') and marked encrypted,
   * delegate to the parent onDecryptQuestion(question.id, field). For mini/profile views,
   * redirect to the full question page instead of decrypting in-place.
   */
  handleDecryptClick = (field) => {
    const {
      question,
      response,
      onDecryptQuestion,
      isOwnResponse,
      canDecryptOtherResponses,
      mode,
      responderAddress,
      questionOnly
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

    const canDecrypt = !!isOwnResponse || !!canDecryptOtherResponses;
    if (!onDecryptQuestion || !question?.id || !response || !canDecrypt) return;

    const target =
      field === 'additional'
        ? (response.additional || {})
        : (response.answer || {});

    // Only attempt when actually masked/encrypted
    const isMasked =
      target &&
      target.value === '*' &&
      (Boolean(target.encryptedPortion) || Boolean(target.encrypted));

    if (!isMasked) return;

    try {
      onDecryptQuestion(question.id, field, response);
    } catch (e) { questionLog.warn('SingleQuestionResponse: fallback', e); }
  };

  handlePromptReloadClick = () => {
    const { question, onReloadQuestionPrompt } = this.props;
    if (!question?.id || typeof onReloadQuestionPrompt !== 'function') return;
    try {
      onReloadQuestionPrompt(question.id);
    } catch (e) { questionLog.warn('SingleQuestionResponse: fallback', e); }
  };


  toggleMiniExpand = () => {
    this.setState((prev) => ({ miniExpanded: !prev.miniExpanded }));
  };

  /** Pick a stable id for cache lookups */
  getQuestionId = (q) =>
    q?.id ?? q?._id ?? q?.questionId ?? q?.uuid ?? q?.key ?? q?.slug ?? '';

  /** Resolve active session slug ('' = general) from canonical session props. */
  resolveGroupSlug = () => {
    const fromPath = resolveSessionSlugFromPathname(
      (typeof window !== 'undefined' && window.location?.pathname) ? window.location.pathname : ''
    );
    if (fromPath != null) return fromPath;

    const fromProp =
      this.props?.sessionSlug ??
      this.props?.activeSessionSlug;
    if (fromProp != null) return normalizeSessionSlug(fromProp);

    return '';
  };

  /** Read the per-group questions map from cache mirror using the canonical string network ID. */
  readQuestionsMapFromGroupCache = () => {
    const memoKey = `group:${this.getQuestionLookupContextKey()}`;
    if (this._questionsMapMemo.key === memoKey && this._questionsMapMemo.value) {
      return this._questionsMapMemo.value;
    }
    const slug = this.resolveGroupSlug();
    const netIdStr = String(
      this.props?.network?.id ??
      this.props?.network?.chainId ??
      this.props?.networkChainId ??
      ''
    );

    let parsed = peekCacheSync('questionsCache', slug, { clone: false });
    if (!parsed || typeof parsed !== 'object') {
      const generalEntry = listNamespaceEntriesSync('questionsCache', { cloneValues: false })
        .find((entry) => String(entry?.slug || '') === '');
      parsed = (generalEntry && typeof generalEntry.value === 'object') ? generalEntry.value : null;
      if (!parsed || typeof parsed !== 'object') return {};
    }

    // Prefer exact network; otherwise fall back to the first network that has questions
    let bag = (netIdStr && parsed?.[netIdStr]?.questions) ? parsed[netIdStr].questions : null;
    if (!bag) {
      const firstKey = Object.keys(parsed || {}).find(k => parsed[k]?.questions);
      bag = firstKey ? parsed[firstKey].questions : null;
    }
    const result = bag || {};
    this._questionsMapMemo = { key: memoKey, value: result };
    return result;
  };

  /** Normalize any "options" shape into a string array (deduped, trimmed) */
  extractOptionsFromCandidate = (candidate) => {
    if (!candidate) return [];

    const raw =
      candidate.options ??
      candidate.choices ??
      candidate.answers ??
      candidate.choiceOptions ??
      candidate.config?.options ??
      candidate.config?.choices ??
      candidate.payload?.options ??
      candidate.data?.options ??
      candidate.optionsMap ??
      candidate.options_by_id;

    const toLabel = (x) => {
      if (typeof x === 'string') return x;
      if (!x || typeof x !== 'object') return '';
      return (
        x.label ??
        x.text ??
        x.name ??
        x.value ??
        x.id ??
        ''
      );
    };

    let arr = [];
    if (Array.isArray(raw)) {
      arr = raw.map(toLabel);
    } else if (raw && typeof raw === 'object') {
      // Object bag keyed by id -> {label,...}
      arr = Object.values(raw).map(toLabel);
    }

    const seen = new Set();
    return arr
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
  };

  /** Search ALL `dg:questionsCache:<slug>` caches for a question entry by id (lowercased); return first hit. */
  readQuestionEntryAcrossAllGroups = (idLower) => {
    if (!idLower) return null;
    const memoKey = `cross:${idLower}|${this.getQuestionLookupContextKey()}`;
    if (this._crossGroupQuestionMemo.has(memoKey)) {
      return this._crossGroupQuestionMemo.get(memoKey) || null;
    }

    const netIdStr = String(
      this.props?.network?.id ??
      this.props?.network?.chainId ??
      this.props?.networkChainId ??
      ''
    );
    const remember = (value) => {
      this._crossGroupQuestionMemo.set(memoKey, value || null);
      this.trimMemoMap(this._crossGroupQuestionMemo, 256);
      return value || null;
    };

    try {
      const entries = listNamespaceEntriesSync('questionsCache', { cloneValues: false });
      for (let i = 0; i < entries.length; i++) {
        const parsed = (entries[i] && typeof entries[i].value === 'object') ? entries[i].value : null;
        if (!parsed || typeof parsed !== 'object') continue;

        let netObj = null;
        if (netIdStr) {
          netObj = parsed[netIdStr] || null;
        }
        if (!netObj) {
          const firstKey = Object.keys(parsed)[0];
          netObj = firstKey ? parsed[firstKey] : null;
        }
        if (!netObj || typeof netObj !== 'object') continue;

        const qMap = netObj.questions || {};
        const direct = qMap[idLower] || qMap[String(idLower)];
        if (direct) return remember(direct);

        // Defensive: tolerate unexpected casing by scanning keys
        const hitKey = Object.keys(qMap).find(qk => String(qk || '').toLowerCase() === idLower);
        if (hitKey) return remember(qMap[hitKey]);
      }
    } catch (e) { questionLog.warn('SingleQuestionResponse: fallback', e); }

    return remember(null);
  };

  /** Resolve multichoice options by checking inline, then caches, then storage (group-aware questions cache), and finally across all groups. */
  getMultichoiceOptions = (question) => {
    const id = String(this.getQuestionId(question) || '').toLowerCase();
    if (!id) return [];

    // 1) Inline on the question object
    let out = this.extractOptionsFromCandidate(question);
    if (out.length) return out;

    const memoKey = `options:${id}|${this.getQuestionLookupContextKey()}`;
    const memoHit = this._multichoiceOptionsMemo.get(memoKey);
    if (memoHit) return memoHit;
    const remember = (options) => {
      const normalized = Array.isArray(options) ? options : [];
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
    const {
      questionCache,
      questionsCache,
      questionsById,
      cache,
      entities,
      storeCache,
    } = this.props || {};

    const roots = [
      questionsById,
      questionCache,
      questionsCache,
      cache?.questionsById,
      cache?.questions,
      entities?.questions,
      storeCache?.questionsById,
    ].filter(Boolean);

    for (const root of roots) {
      const hit = root?.[id] || root?.[String(id)];
      out = this.extractOptionsFromCandidate(hit);
      if (out.length) return remember(out);
    }

    // 4) Global runtime caches that might be hydrated elsewhere
    const w = typeof window !== 'undefined' ? window : undefined;
    const globals = [
      w?.__SURVEY_CACHE__?.questionsById,
      w?.__SURVEY_CACHE__,
      w?.__APP_CACHE__?.questionsById,
      w?.__APP_CACHE__?.questions,
      w?.__QUESTION_CACHE__,
    ].filter(Boolean);

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
    } catch (e) { questionLog.warn('SingleQuestionResponse: fallback', e); }

    // 5a) Cross-group last resort: scan all group caches for this id
    try {
      const cross = this.readQuestionEntryAcrossAllGroups(id);
      out = this.extractOptionsFromCandidate(cross);
      if (out.length) return remember(out);
    } catch (e) { questionLog.warn('SingleQuestionResponse: fallback', e); }

    return remember([]);
  };

  renderQuestionOnlyView() {
    const { question = {}, mode } = this.props;

    // Stable id + URL
    const qid = this.getQuestionId(question);
    const url = qid ? buildQuestionRoutePath(qid, { sessionSlug: this.resolveGroupSlug() }) : '/questions';
    const arweaveUrl = question?.arweaveTxId
      ? normalizeArweaveUrl(question.arweaveTxId, { contextLabel: 'single_question_response_link' })
      : '';
    const hasCardActions = Boolean(qid || arweaveUrl);

    const openQuestion = () => {
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) { questionLog.warn('SingleQuestionResponse: fallback', e); }
    };

    const onKeyDown = (e) => {
      const k = e?.key;
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        openQuestion();
      }
    };

    const stopCardNavigation = (e) => {
      e.stopPropagation();
    };

    const type = String(question.type || '').toLowerCase();

    // Non-interactive affordance by type
    let affordance = null;

    if (type === 'binary') {
      const promptText =
        (question && (question.prompt || question.title || question.text)) || '';

      // For binary, we render the row of pills inside the card
      affordance = (
        <div className={styles.answerPillsRow} aria-hidden="true">
          <span className={`${styles.readOnlyBinary} ${styles.agree}`}>Agree</span>
          <span className={`${styles.readOnlyBinary} ${styles.unsure}`}>Unsure</span>
          <span className={`${styles.readOnlyBinary} ${styles.disagree}`}>Disagree</span>
        </div>
      );

    } else if (type === 'multichoice') {
      const options = this.getMultichoiceOptions(question) || [];
      affordance = options.length ? (
        <div className={styles.readOnlyMultichoice} aria-hidden="true">
          {options.map((opt, idx) => (
            <span key={`${opt}-${idx}`} className={styles.choiceItem}>{opt}</span>
          ))}
        </div>
      ) : (
        <div className={styles.aggregatorText} aria-hidden="true">No options available.</div>
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

    // Click-through mini card (entire area clickable)
    return (
      <Card
        className={`${styles.miniQuestionContainer} ${styles.clickThrough}`}
        onClick={openQuestion}
        onKeyDown={onKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Open question"
      >
        <CardBody className={joinClassNames(
          styles.questionTitleBody,
          !hasCardActions && styles.questionTitleBodyNoLinks
        )}>
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
          <div className={styles.questionPrompt}>
            {question?.prompt || 'Untitled question'}
          </div>

          {/* Read-only affordance */}
          {affordance && (
            <div className={styles.readOnlyAffordance}>
              {affordance}
            </div>
          )}
        </CardBody>
      </Card>
    );
  }


  renderSinglePersonView = () => {
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
    } =
      this.props;
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

    const { prompt, type, id, arweaveTxId: questionArweaveTxId } = question;
    const finalArweaveTxId = response?.arweaveTxId || questionArweaveTxId;
    const answer = response.answer || {};
    const additional = response.additional || {};
    const conviction =
      response.conviction !== undefined ? response.conviction : response.importance ?? null;
    const normalizedConviction = normalizeRatingValue(conviction, null);

    const isAnswerEncrypted = answer.encrypted && answer.value === '*';
    const isAdditionalEncrypted = additional.encrypted && additional.value === '*';
    const isPromptMasked = String(prompt || '').trim() === '[encrypted]';
    const canReloadPrompt = isPromptMasked && !!id && typeof this.props.onReloadQuestionPrompt === 'function';
    const promptReloading = !!this.props.promptReloading;
    const canDecryptThisResponse = !!isOwnResponse || !!this.props.canDecryptOtherResponses;
    const promptGateTooltipProps = resolvePromptGateTooltipProps({
      question,
      gateId: this.props.gateId,
      gateConfig: this.props.gateConfig,
      gateMode: this.props.gateMode,
      sbtAddresses: this.props.sbtAddresses,
      userHeldSBTs: this.props.userHeldSBTs,
    });
    const decryptCtaClassName = styles.decryptCta;
    const wrapCompactDecryptCta = (buttonNode, field = '') => {
      if (!compactEncryptedAnswerCta || !stackCompactDecryptCta) return buttonNode;
      return (
        <div className={styles.compactDecryptCtaStack} data-ce-decrypt-field={field}>
          {buttonNode}
        </div>
      );
    };

    const renderEncryptedAnswer = () => {
      if (canDecryptThisResponse) {
        return wrapCompactDecryptCta((
          <Button
            onClick={() => this.handleDecryptClick('answer')}
            className={decryptCtaClassName}
            data-testid={E2E_TESTIDS.DECRYPT_ANSWER}
            data-ce-question-id={String(id || '').trim().toLowerCase()}
          >
            Decrypt Answer
          </Button>
        ), 'answer');
      }
      return (
        <p
          className={styles.encryptedResponseText}
          data-testid={E2E_TESTIDS.ENCRYPTED_ANSWER_NOTICE}
          data-ce-question-id={String(id || '').trim().toLowerCase()}
        >
          This answer is encrypted.
        </p>
      );
    };

    const renderEncryptedAdditional = () => {
      if (canDecryptThisResponse) {
        return (
          wrapCompactDecryptCta((
            <Button
              onClick={() => this.handleDecryptClick('additional')}
              className={decryptCtaClassName}
              data-testid={E2E_TESTIDS.DECRYPT_ADDITIONAL}
              data-ce-question-id={String(id || '').trim().toLowerCase()}
            >
              Decrypt Additional Comments
            </Button>
          ), 'additional')
        );
      }
      return (
        <p
          className={styles.encryptedResponseText}
          data-testid={E2E_TESTIDS.ENCRYPTED_ADDITIONAL_NOTICE}
          data-ce-question-id={String(id || '').trim().toLowerCase()}
        >
          Additional comments are encrypted.
        </p>
      );
    };

    const wrapMaskedPromptLabel = (content) => {
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
      this.props.bodyClassName
    );
    const cardLinksClassName = joinClassNames(styles.cardLinksContainer, this.props.linksContainerClassName);
    const cardLinkButtonClassName = joinClassNames(styles.cardLinkButton, this.props.iconButtonClassName);

    const showFullDetail = mode === 'fullscreen' || miniExpanded;

    let externalLink = null;
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
              {id && (
                <button
                  onClick={this.handleBookmarkClick}
                  className={joinClassNames(
                    cardLinkButtonClassName,
                    styles.bookmarkCardLinkButton,
                    isBookmarked ? styles.bookmarkCardLinkButtonActive : ''
                  )}
                  title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                >
                  <FontAwesomeIcon
                    icon={faBookmark}
                    style={{ color: bookmarkSuccess ? 'lightgreen' : isBookmarked ? '#ffc107' : 'white' }}
                  />
                </button>
              )}

              {/* External/Expand are gated in mini mode until expanded */}
              {showMiniExtras && finalArweaveTxId && (
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
              {showMiniExtras && id && (
                <a
                  href={externalLink || buildQuestionRoutePath(id, {
                    responderAddress: responderAddress || '',
                    sessionSlug: this.resolveGroupSlug(),
                  })}
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
                    className={`${styles.miniPromptAbbrev} ${styles.maskedPromptActionButton}`}
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
                        prompt
                      )
                    )}
                  </button>
                ) : (
                  wrapMaskedPromptLabel(
                    <span className={styles.miniPromptAbbrev}>{prompt}</span>
                  )
                )}
              </div>
              <Button className={styles.miniExpandButton} onClick={this.toggleMiniExpand}>
                {miniExpanded ? (
                  <FontAwesomeIcon icon={faChevronUp} />
                ) : (
                  <FontAwesomeIcon icon={faChevronDown} />
                )}
              </Button>
            </div>
          )}

          {!showFullDetail && mode === 'mini' && (
            <>
              {isAnswerEncrypted ? (
                renderEncryptedAnswer()
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
                        title="Decrypt gated prompt"
                      >
                        {wrapMaskedPromptLabel(
                          promptReloading ? (
                            <span className={styles.maskedPromptLoading}>
                              <FontAwesomeIcon icon={faSpinner} spin className={styles.maskedPromptLoadingSpinner} />
                              <span>Decrypting...</span>
                            </span>
                          ) : (
                            (prompt || 'Question')
                          )
                        )}
                      </button>
                    ) : (
                      wrapMaskedPromptLabel(prompt || 'Question')
                    )}
                  </h4>
                </div>
              )}

              {isAnswerEncrypted ? (
                renderEncryptedAnswer()
              ) : (
                this.renderAnswerByType(type, answer.value)
              )}

              {additional && additional.value ? (
                isAdditionalEncrypted ? (
                  renderEncryptedAdditional()
                ) : (
                  <div className={styles.additionalCommentsSection}>
                    <strong className={styles.additionalCommentsLabel}>
                      Additional Comments:
                    </strong>
                    <p className={styles.additionalCommentsContent}>
                      {typeof additional.value === 'string'
                        ? additional.value
                        : JSON.stringify(additional.value)}
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
                    style={{ width: '200px' }}
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
      const containerClassName = joinClassNames(styles.fullscreenQuestionContainer, this.props.containerClassName);
      const hasCardActions = Boolean(question?.id || question?.arweaveTxId);
      const questionBodyClassName = joinClassNames(
        styles.questionTitleBody,
        !hasCardActions && styles.questionTitleBodyNoLinks,
        this.props.bodyClassName
      );
      const cardLinksClassName = joinClassNames(styles.cardLinksContainer, this.props.linksContainerClassName);
      const cardLinkButtonClassName = joinClassNames(styles.cardLinkButton, this.props.iconButtonClassName);
      // aggregator summary logic
      return (
        <Card className={containerClassName}>
          <CardBody className={questionBodyClassName}>
            {hasCardActions && (
              <div className={cardLinksClassName}>
                {question?.id && (
                  <button
                    onClick={this.handleBookmarkClick}
                    className={joinClassNames(
                      cardLinkButtonClassName,
                      styles.bookmarkCardLinkButton,
                      isBookmarked ? styles.bookmarkCardLinkButtonActive : ''
                    )}
                    title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                  >
                    <FontAwesomeIcon
                      icon={faBookmark}
                      style={{ color: bookmarkSuccess ? 'lightgreen' : isBookmarked ? '#ffc107' : 'white' }}
                    />
                  </button>
                )}
                {question?.arweaveTxId && (
                  <a
                    href={normalizeArweaveUrl(question.arweaveTxId, { contextLabel: 'single_question_response_link' })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardLinkButtonClassName}
                    title="View on Arweave"
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                  </a>
                )}
                {question?.id && (
                  <a
                    href={buildQuestionRoutePath(question.id, { sessionSlug: this.resolveGroupSlug() })}
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
  renderAnswerByType = (type, value) => {
    if (value === null || value === undefined || value === '') {
      return <div className={styles.freeformAnswer}>No answer provided.</div>;
    }

    switch (type) {
      case 'multichoice': {
        const toLabel = (x) => {
          if (typeof x === 'string') return x;
          if (!x || typeof x !== 'object') return '';
          return x.label ?? x.text ?? x.name ?? x.value ?? '';
        };
        const raw = Array.isArray(value) ? value : (value != null ? [value] : []);
        const labels = raw.map(toLabel).map((s) => String(s).trim()).filter(Boolean);
        if (!labels.length) {
          return <div className={styles.freeformAnswer}>No answer provided.</div>;
        }
        return (
          <div className={styles.readOnlyMultichoice}>
            {labels.map((option, idx) => (
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
              <div
                className={styles.ratingBar}
                style={{ width: `${ratingFillPercent}%` }}
              />
            </div>
            <span className={styles.ratingValueLabel}>
              {`${normalizedRatingValue}/${RATING_MAX}`}
            </span>
          </div>
        );
      }

      case 'binary': {
        const optionClass = String(value).toLowerCase();
        return (
          <div className={`${styles.readOnlyBinary} ${styles[optionClass]}`}>
            {value === 'Agree' && <FontAwesomeIcon icon={faCheck} className={styles.optionIcon} />}
            {value === 'Disagree' && <FontAwesomeIcon icon={faTimes} className={styles.optionIcon} />}
            {String(value)}
          </div>
        );
      }

      case 'freeform':
      default:
        return (
          <div className={styles.freeformAnswer}>
            {typeof value === 'string' ? value : JSON.stringify(value)}
          </div>
        );
    }
  };
}

export default SingleQuestionResponse;
