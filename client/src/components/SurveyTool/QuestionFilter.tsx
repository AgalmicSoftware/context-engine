/** @file QuestionFilter.tsx */

import React from 'react';
import { connect } from 'react-redux';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';
import styles from './QuestionFilter.module.scss';
import GateTooltip from '../Gates/GateTooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLock, faPlus } from '@fortawesome/free-solid-svg-icons';
import { serializeFilterState, deserializeFilterStateStrict } from '../../utilities/survey/filterStateUtils.js';
import { isFreeformBlankAnswer } from '../../utilities/survey/freeformAnswerUtils.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { rankQuestionsAI } from '../../utilities/ai/aiClient.js';
import { getLocalAiSettings } from '../../utilities/ai/aiSettings.js';
import { resolveEncryptionGate } from '../../utilities/crypto/encryptionGates.js';
import {
  getGateSbtAddresses,
  normalizeGateMode,
  resolveSponsoredGateStateForResource,
  SPONSORED_GATE_STATES,
} from '../../utilities/web3/sponsoredAccess.js';
import { createLogger } from '../../utilities/logging.js';
import { peekCacheSync, readCache, writeCache } from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { notify } from '../../utilities/ui/notify.js';
import {
  QUESTION_FILTER_ENCRYPTED_COUNT_LOCK_STYLE,
  QUESTION_FILTER_MODAL_HEADER_ROW_STYLE,
  QUESTION_FILTER_MODAL_TITLE_ROW_STYLE,
  buildQuestionFilterDisabledSectionClassName,
  resolveQuestionFilterEncryptedCountBadgeStyle,
  resolveQuestionFilterInlineVisibilityStyle,
} from './questionFilterDisplayHelpers';
import {
  QuestionFilterAiSection,
  QuestionFilterLoadFilterControls,
  QuestionFilterQuestionTypesSection,
  QuestionFilterResponseStatusSection,
  QuestionFilterSbtSection,
  QuestionFilterSummaryControls,
  QuestionFilterTagsSection,
  QuestionFilterTopQuestionsSection,
} from './QuestionFilterSections';
import {
  DEFAULT_AI_TOP_N,
  DEFAULT_TOP_QUESTIONS_COUNT,
  EMPTY_FILTER_RESPONSES,
  QUESTION_FILTER_RESPONSE_PARSE_MEMO_MAX,
  getEncryptedQuestionCount,
  getErrorMessage,
  modalStyles,
  readQuestionsCacheSync,
  resolveEffectiveSessionContext,
  resolveEffectiveSlug,
  resolveFilterStorageSlug,
  toUnknownRecord,
  type QuestionFilterAiAccessState,
  type QuestionFilterAiApplyOptions,
  type QuestionFilterAiApplySignatureArgs,
  type QuestionFilterAiProviderSettings,
  type QuestionFilterAiRequestOptions,
  type QuestionFilterBookmarkCache,
  type QuestionFilterGateTooltipProps,
  type QuestionFilterInputChangeEvent,
  type QuestionFilterLoadStateOptions,
  type QuestionFilterMutableStatePatch,
  type QuestionFilterPersistenceProps,
  type QuestionFilterPipelineMemo,
  type QuestionFilterPipelineResult,
  type QuestionFilterQuestionRecord,
  type QuestionFilterQuestionsCacheNet,
  type QuestionFilterRankedQuestion,
  type QuestionFilterRequiredValueEvent,
  type QuestionFilterResponseDrivenStateArgs,
  type QuestionFilterResponseStats,
  type QuestionFilterResponseStatsMemo,
  type QuestionFilterResponsesByQuestion,
  type QuestionFilterSbtSummaryEntry,
  type QuestionFilterSbtSummaryState,
  type QuestionFilterSerializableState,
  type QuestionFilterSessionProps,
  type QuestionFilterStateArg,
  type QuestionFilterStateRecord,
  type QuestionFilterSummaryItem,
  type QuestionFilterWriteCache,
  type UnknownRecord,
} from './questionFilterRuntimeSupport';
import {
  buildQuestionFilterAiApplyBasePatch,
  buildQuestionFilterAiApplyFailurePatch,
  buildQuestionFilterAiApplyErrorPatch,
  buildQuestionFilterAiApplyNoCandidatesPatch,
  buildQuestionFilterAiApplySuccessPatch,
  buildQuestionFilterAiApplyingPatch,
  buildQuestionFilterAiCombinePatch,
  buildQuestionFilterAiDraftQueryPatch,
  buildQuestionFilterAiElapsedPatch,
  buildQuestionFilterAiRankingCountPatch,
  buildQuestionFilterBookmarkFeedbackPatch,
  buildQuestionFilterBookmarkStatusPatch,
  buildQuestionFilterStateFromComponentState,
  buildQuestionFilterCachedResponsesPatch,
  buildQuestionFilterCopyUrlSuccessPatch,
  buildQuestionFilterFilteredQuestionsCountPatch,
  buildQuestionFilterFilterLoadingPatch,
  buildQuestionFilterLoadInputTogglePatch,
  buildQuestionFilterNotRespondedStatusPatch,
  buildQuestionFilterPendingSelectedTypesPatch,
  buildQuestionFilterRemoveAiPatch,
  buildQuestionFilterRemoveTopQuestionsPatch,
  buildQuestionFilterSbtItemRemovalState,
  buildQuestionFilterRespondedStatusPatch,
  buildQuestionFilterSbtLocalStatePatch,
  buildQuestionFilterSelectedTagsPatch,
  buildQuestionFilterTopQuestionsCountPatch,
  buildQuestionFilterUrlInputPatch,
  isQuestionFilterStateDefault,
  normalizeAiIdList,
  normalizeFilterSelectionList,
  normalizePositiveInt,
  normalizeResponseStatusFilterState,
  normalizeSbtFilterLocalState,
} from './questionFilterHelpers.js';
import {
  areQuestionListsEquivalentById,
  buildAiCandidateSignature,
  buildFilterPayloadSignature,
  buildFilteredResponsesByQuestionSignature,
  buildQuestionIdListSignature,
  normalizeNonceKey,
  stableSerializeSmallObject,
  toLowerId,
} from './questionFilterSignatureHelpers.js';
export {
  QUESTION_FILTER_ACTIONS_STYLE,
  QUESTION_FILTER_BOOKMARK_FEEDBACK_STYLE,
  QUESTION_FILTER_DISABLED_TEXT_SPACING_STYLE,
  QUESTION_FILTER_ENCRYPTED_COUNT_LOCK_STYLE,
  QUESTION_FILTER_MODAL_HEADER_ROW_STYLE,
  QUESTION_FILTER_MODAL_TITLE_ROW_STYLE,
  QUESTION_FILTER_SBT_SPINNER_STYLE,
  buildQuestionFilterAiCombineRowClassName,
  buildQuestionFilterDisabledSectionClassName,
  buildQuestionFilterSectionIconClassName,
  buildQuestionFilterTagBubbleClassName,
  buildQuestionFilterTypeButtonClassName,
  buildQuestionFilterTypePillClassName,
  resolveQuestionFilterBookmarkIconStyle,
  resolveQuestionFilterClearIconStyle,
  resolveQuestionFilterCopyIconStyle,
  resolveQuestionFilterEncryptedCountBadgeStyle,
  resolveQuestionFilterInlineVisibilityStyle,
  resolveQuestionFilterSectionBodyStyle,
  resolveQuestionFilterSectionHeaderStyle,
} from './questionFilterDisplayHelpers';

const questionFilterLog = createLogger('questionFilter');
let QUESTION_FILTER_INSTANCE_SEQ = 0;

class QuestionFilter extends React.Component<any, any> {
  private _tagsTooltipId: string;
  private _isMounted: boolean;
  private _loadingFilterStateFromCache: boolean;
  private _allowFilterStateAutosave: boolean;
  private _filterPipelineMemo: QuestionFilterPipelineMemo | null;
  private _allTagsMemo: {
    mergedQuestionsRef: unknown;
    tags: string[];
  };
  private _responseParseMemo: Map<string, unknown>;
  private _questionResponseStatsMemo: QuestionFilterResponseStatsMemo;
  private _stableSerializeByRefMemo: WeakMap<object, Map<unknown, string>>;
  private _lastSavedFilterStateSignature: string;
  private _lastExternalFilterStateSignature: string;
  private _lastEmittedFilterPayloadSignature: string | null;
  private _lastEmittedFilterStateSignature: string | null;
  private _lastEmittedCount: unknown;
  private _lastEmittedEncryptedCount: number | null;
  private _lastEmittedFilterActivity: unknown;
  private _mergedQuestionsSyncSignature: string;
  private _cachedQuestionResponsesSignature: string;
  private _aiAutoApplyInFlightSignature: string;
  private _aiAutoApplyQueuedSignature: string;
  private _aiApplyRequestSeq: number;
  private _aiLatestRequestSeq: number;
  private _aiApplyingElapsedTimer: ReturnType<typeof setInterval> | null;
  private _aiApplyingStartedAtMs: number | null;
  private copySuccessTimeout: ReturnType<typeof setTimeout> | null;
  private bookmarkFeedbackTimeout: ReturnType<typeof setTimeout> | null;

  constructor(props: UnknownRecord) {
    super(props);

    QUESTION_FILTER_INSTANCE_SEQ += 1;
    this._tagsTooltipId = `qf-tags-tip-${QUESTION_FILTER_INSTANCE_SEQ}`;

    // If in "resultsMode" with an externally provided filterState, use that; otherwise use defaults
    const usingResultsMode = this.props.resultsMode || false;
    const filterState = (usingResultsMode && this.props.filterState) || {};

    // Correctly parse the filterState object, which has a different structure than the internal state
    const topQuestions = filterState.topQuestions || null;
    const showTopByImportance = topQuestions?.by === 'conviction';
    const showTopByResponses = topQuestions?.by === 'responses';
    const topCount = topQuestions?.count ?? DEFAULT_TOP_QUESTIONS_COUNT;
    const sortByImportance = showTopByImportance; // "sort by importance" is active if top by importance is

    const selectedTypes = filterState.questionTypes || [];
    const selectedTags = filterState.selectedTags || [];
    const aiSearchQuery = filterState.aiFilter || '';
    const aiTopN = normalizePositiveInt(filterState.aiTopN, DEFAULT_AI_TOP_N);
    const aiCombineWithOtherFilters = !!(aiSearchQuery && filterState.aiCombine === true);
    const sbtFilterLocalState = filterState.sbtFilter || null;
    const responseStatusState = normalizeResponseStatusFilterState({
      filterByResponded: !!filterState?.responseStatus?.responded,
      filterByNotResponded: !!filterState?.responseStatus?.notResponded,
      account: props.account,
    });

    // Merge given questions with local cache so zero-answer or offscreen questions appear
    const mergedQuestions = this.mergeQuestionsWithCache(props.questions);

    this.state = {
      mergedQuestions,
      cachedQuestionResponses: this.props.questionResponses || {},

      // Basic filter states, now correctly initialized
      selectedTypes: selectedTypes,
      selectedTags: selectedTags,
      filterByResponded: responseStatusState.filterByResponded,
      filterByNotResponded: responseStatusState.filterByNotResponded,
      sortByImportance: sortByImportance,
      sbtFilteredQuestions: null, // final array after SBT-based filtering

      // SBT filter internal state
      sbtFilterLocalState: sbtFilterLocalState,

      // AI filter
      aiSearchQuery: aiSearchQuery,
      aiDraftQuery: aiSearchQuery,
      aiRankingCount: aiTopN,
      aiAppliedTopN: aiSearchQuery ? aiTopN : null,
      aiRankedQuestionIds: [],
      aiFilterApplied: false,
      aiCombineWithOtherFilters,
      aiApplying: false,
      aiApplyingElapsedSec: 0,
      aiApplyError: '',
      aiLastAppliedSignature: '',
      // We set the collapsible sections so that ONLY “tags” is auto-open. Others default to false:
      expandedSections: {
        ai: false,
        types: false,
        sbts: false,
        popular: false,
        tags: true,
      },
      filterLoading: false,

      // For “Top X questions” by total importance or # of responses
      showTopQuestions: showTopByImportance,
      topQuestionsCount: topCount,
      showTopQuestionsByResponses: showTopByResponses,

      // Pending states used to update instantly for certain controls:
      pendingSelectedTypes: selectedTypes,
      pendingSortByImportance: sortByImportance,
      pendingSbtFilteredQuestions: null,
      pendingShowTopQuestions: showTopByImportance,
      pendingTopQuestionsCount: topCount,
      pendingShowTopQuestionsByResponses: showTopByResponses,

      // Count how many questions pass the current pending filter config
      filteredQuestionsCount: 0,

      // We store the last fully applied filter set to avoid re-applying identical filters
      lastAppliedFilterState: null,
      lastAppliedFilterStateSignature: '',
      copiedUrlSuccess: false,
      filterBookmarkedFeedback: false,
      isCurrentFilterBookmarked: false,
      showAllTags: false,
      filterUrlInput: '',
      showLoadInput: false,
    };
    this.copySuccessTimeout = null; // For managing the copied success message timeout
    this._isMounted = false;
    this.bookmarkFeedbackTimeout = null;
    this._loadingFilterStateFromCache = false;
    this._allowFilterStateAutosave = false;
    this._filterPipelineMemo = null;
    this._allTagsMemo = { mergedQuestionsRef: null, tags: [] };
    this._responseParseMemo = new Map();
    this._questionResponseStatsMemo = {
      relevantResponsesRef: null,
      mergedQuestionsRef: null,
      questionResponsesNonceKey: null,
      questionsCacheNonceKey: null,
      result: new Map(),
    };
    this._stableSerializeByRefMemo = new WeakMap();
    this._lastSavedFilterStateSignature = '';
    this._lastExternalFilterStateSignature = stableSerializeSmallObject(this.props.filterState);
    this._lastEmittedFilterPayloadSignature = null;
    this._lastEmittedFilterStateSignature = null;
    this._lastEmittedCount = null;
    this._lastEmittedEncryptedCount = null;
    this._lastEmittedFilterActivity = null;
    this._mergedQuestionsSyncSignature = buildQuestionIdListSignature(mergedQuestions);
    this._cachedQuestionResponsesSignature = buildFilteredResponsesByQuestionSignature(
      this.props.questionResponses || {},
    );
    this._aiAutoApplyInFlightSignature = '';
    this._aiAutoApplyQueuedSignature = '';
    this._aiApplyRequestSeq = 0;
    this._aiLatestRequestSeq = 0;
    this._aiApplyingElapsedTimer = null;
    this._aiApplyingStartedAtMs = null;
  }

  /* -------------------------- LIFECYCLE METHODS -------------------------- */

  getEffectiveSessionConfig = (propsIn: QuestionFilterSessionProps = this.props): UnknownRecord => {
    return (resolveEffectiveSessionContext(propsIn).sessionConfig || {}) as UnknownRecord;
  };

  buildAiRequestOptions = (propsIn: QuestionFilterSessionProps = this.props): QuestionFilterAiRequestOptions => {
    const resolvedSession = resolveEffectiveSessionContext(propsIn);
    const slug = resolvedSession.sessionSlug || '';
    const sessionConfig = (resolvedSession.sessionConfig || {}) as UnknownRecord;
    return {
      sessionSlug: slug,
      sessionConfig,
      context: {
        account: propsIn.account || '',
        providerLike: propsIn.provider,
        chainId: propsIn.network?.id || sessionConfig?.networkChainId || null,
      },
    };
  };

  hasConfiguredLocalAiKey = (): boolean => {
    try {
      const local = getLocalAiSettings() as {
        providers?: Record<string, QuestionFilterAiProviderSettings>;
      };
      const providers = local?.providers && typeof local.providers === 'object' ? local.providers : {};
      return Object.values(providers).some((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const plain = String(entry.apiKey || '').trim();
        const encrypted = String(entry.encryptedApiKey || '').trim();
        return !!(plain || encrypted);
      });
    } catch (_) {
      return false;
    }
  };

  syncAiApplyingElapsedTimer = (): void => {
    if (this.state.aiApplying) {
      if (!this._aiApplyingStartedAtMs) this._aiApplyingStartedAtMs = Date.now();
      if (!this._aiApplyingElapsedTimer) {
        this._aiApplyingElapsedTimer = setInterval(() => {
          const started = Number(this._aiApplyingStartedAtMs || Date.now());
          const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
          if (elapsed !== Number(this.state.aiApplyingElapsedSec || 0)) {
            this.setState(buildQuestionFilterAiElapsedPatch(elapsed));
          }
        }, 1000);
      }
      return;
    }

    if (this._aiApplyingElapsedTimer) {
      clearInterval(this._aiApplyingElapsedTimer);
      this._aiApplyingElapsedTimer = null;
    }
    this._aiApplyingStartedAtMs = null;
    if (this.state.aiApplyingElapsedSec !== 0) {
      this.setState(buildQuestionFilterAiElapsedPatch(0));
    }
  };

  getAiAccessState = (propsIn: QuestionFilterSessionProps = this.props): QuestionFilterAiAccessState => {
    const cfg = this.getEffectiveSessionConfig(propsIn);
    const gateState = resolveSponsoredGateStateForResource(cfg, 'ai');
    const sponsoredStatus = String(gateState?.status || SPONSORED_GATE_STATES.UNAVAILABLE);
    const sponsoredAvailable =
      sponsoredStatus === SPONSORED_GATE_STATES.OPEN || sponsoredStatus === SPONSORED_GATE_STATES.RESTRICTED;
    const localKeyAvailable = this.hasConfiguredLocalAiKey();
    const enabled = sponsoredAvailable || localKeyAvailable;
    return {
      enabled,
      sponsoredAvailable,
      localKeyAvailable,
      sponsoredStatus,
    };
  };

  getEncryptedQuestionGateTooltipProps = (
    propsIn: QuestionFilterSessionProps = this.props,
  ): QuestionFilterGateTooltipProps => {
    const sessionConfig = this.getEffectiveSessionConfig(propsIn);
    const gateConfig = (resolveEncryptionGate(sessionConfig) ||
      resolveSponsoredGateStateForResource(sessionConfig, 'questionResponses')?.gate ||
      resolveSponsoredGateStateForResource(sessionConfig, 'default')?.gate ||
      null) as React.ComponentProps<typeof GateTooltip>['gateConfig'] | null;
    const sponsoredGateConfig = gateConfig as Parameters<typeof getGateSbtAddresses>[0];
    const gateRecord = toUnknownRecord(gateConfig);
    const sbtAddresses = getGateSbtAddresses(sponsoredGateConfig || {});

    if (!gateConfig && sbtAddresses.length === 0) return null;

    return {
      gateId: String(gateRecord.gateId || gateRecord.id || '').trim() || null,
      gateConfig,
      mode: normalizeGateMode(sponsoredGateConfig),
      sbtAddresses,
    };
  };

  getQuestionsSubsetBeforeAi = (usePendingState = true): QuestionFilterQuestionRecord[] => {
    const mergedQuestions = Array.isArray(this.state.mergedQuestions)
      ? (this.state.mergedQuestions as QuestionFilterQuestionRecord[])
      : [];
    let subset: QuestionFilterQuestionRecord[] = mergedQuestions;
    const selectedTypes = usePendingState ? this.state.pendingSelectedTypes : this.state.selectedTypes;
    const sbtFilteredQuestions = usePendingState
      ? this.state.pendingSbtFilteredQuestions
      : this.state.sbtFilteredQuestions;
    const selectedTags = this.state.selectedTags || [];

    if (sbtFilteredQuestions !== null) {
      const sbtIds = new Set<string>(
        (Array.isArray(sbtFilteredQuestions) ? sbtFilteredQuestions : []).map((q: QuestionFilterQuestionRecord) =>
          String(q.id || '').toLowerCase(),
        ),
      );
      subset = subset.filter((q) => sbtIds.has(String(q.id || '').toLowerCase()));
    }

    if (Array.isArray(selectedTypes) && selectedTypes.length > 0) {
      const selectedTypesSet = new Set<unknown>(selectedTypes);
      subset = subset.filter((q) => selectedTypesSet.has(q.type));
    }

    if (Array.isArray(selectedTags) && selectedTags.length > 0) {
      const selectedTagsLC = new Set<string>(selectedTags.map((t: unknown) => String(t).toLowerCase()));
      subset = subset.filter((q) => {
        if (!Array.isArray(q.tags)) return false;
        return q.tags.some((tag: unknown) => selectedTagsLC.has(String(tag).toLowerCase()));
      });
    }

    // Response status filter
    const filterByResponded = this.state.filterByResponded;
    const filterByNotResponded = this.state.filterByNotResponded;
    if ((filterByResponded || filterByNotResponded) && !(filterByResponded && filterByNotResponded)) {
      const userAddress = String(this.props.account || '').toLowerCase();
      const relevantResponses = (this.props.questionResponses || this.state.cachedQuestionResponses || {}) as Record<
        string,
        Record<string, unknown> | undefined
      >;
      if (userAddress) {
        subset = subset.filter((q) => {
          const qId = String(q?.id || '');
          const respondersObj = relevantResponses[qId] || relevantResponses[qId.toLowerCase()] || {};
          const hasResponded =
            respondersObj &&
            typeof respondersObj === 'object' &&
            Object.keys(respondersObj).some((addressKey) => String(addressKey).toLowerCase() === userAddress);
          return filterByResponded ? hasResponded : !hasResponded;
        });
      }
    }

    return subset;
  };

  getAiRankingCandidates = (): QuestionFilterQuestionRecord[] => {
    if (this.state.aiCombineWithOtherFilters) {
      return this.getQuestionsSubsetBeforeAi(true);
    }
    return Array.isArray(this.state.mergedQuestions)
      ? (this.state.mergedQuestions as QuestionFilterQuestionRecord[])
      : [];
  };

  buildAiApplySignature = ({
    stateIn = this.state,
    propsIn = this.props,
    queryOverride = null,
    candidateQuestions = null,
  }: QuestionFilterAiApplySignatureArgs = {}): string => {
    const state = stateIn && typeof stateIn === 'object' ? (stateIn as UnknownRecord) : {};
    const query = String(queryOverride != null ? queryOverride : state.aiSearchQuery).trim();
    if (!query) return '';
    const slug = resolveEffectiveSlug(propsIn);
    const candidates = Array.isArray(candidateQuestions) ? candidateQuestions : this.getAiRankingCandidates();
    const candidateSignature = buildAiCandidateSignature(candidates);
    return `${slug}|${query}|${candidateSignature}`;
  };

  queueAutoApplyAiFilter = (reason: unknown = 'auto'): void => {
    const query = String(this.state.aiSearchQuery || '').trim();
    if (!query) return;
    const candidateQuestions = this.getAiRankingCandidates();
    const signature = this.buildAiApplySignature({
      queryOverride: query,
      candidateQuestions,
    });
    if (!signature) return;
    if (this.state.aiFilterApplied && this.state.aiLastAppliedSignature === signature) return;
    if (this._aiAutoApplyInFlightSignature === signature) return;
    if (this._aiAutoApplyQueuedSignature === signature) return;

    this._aiAutoApplyQueuedSignature = signature;
    setTimeout(() => {
      if (!this._isMounted) return;
      if (this._aiAutoApplyQueuedSignature !== signature) return;
      this._aiAutoApplyQueuedSignature = '';
      void this.handleApplyAIFilter({
        auto: true,
        queryOverride: query,
        source: reason,
      });
    }, 0);
  };

  queueCombinedAiRefreshIfNeeded = (reason: unknown): void => {
    if (!this.state.aiCombineWithOtherFilters) return;
    if (!String(this.state.aiSearchQuery || '').trim()) return;
    this.queueAutoApplyAiFilter(reason);
  };

  async componentDidMount() {
    this._isMounted = true;
    this.syncAiApplyingElapsedTimer();
    let initialFiltersApplied = false;
    const hasUrlFilterState = this.hasExternalFilterState(this.props);
    const shouldApplyDefaultFilterState = this.shouldApplyDefaultFilterState(this.props);

    if (this.shouldUseLocalStorageBackedFilterState(this.props)) {
      await this.loadFilterStateFromLocalStorage();
    }

    // Handle defaultFilterState prop (string like "tag=AI&sort=recent")
    // This runs if no URL state is provided (this.props.filterState is null/undefined/empty)
    if (shouldApplyDefaultFilterState) {
      questionFilterLog.log('Received defaultFilterState:', this.props.defaultFilterState);
      // Example: Parse "tag=AI&sort=recent"
      const params = new URLSearchParams(this.props.defaultFilterState);
      const tagParam = params.get('tag');
      const tagsFromDefaultFilterState = tagParam ? tagParam.split(',') : [];
      const defaultSort = params.get('sort'); // 'recent', 'importance', etc.

      const newDefaultState: QuestionFilterMutableStatePatch = {};
      if (tagsFromDefaultFilterState.length > 0) {
        newDefaultState.selectedTags = tagsFromDefaultFilterState;
      }
      if (defaultSort === 'importance') {
        newDefaultState.sortByImportance = true;
        newDefaultState.pendingSortByImportance = true;
      }
      // Add more parsing for other defaultFilterState string params if needed

      if (Object.keys(newDefaultState).length > 0) {
        this.setState(newDefaultState, () => {
          this.handleApplyFilters(true); // Apply the defaults immediately
        });
        initialFiltersApplied = true;
      }
    }

    // Apply this.props.filterState (from URL, object structure)
    // This overrides localStorage and defaultFilterState string.
    if (hasUrlFilterState) {
      const urlFilterState = this.props.filterState;
      const newStateFromUrl: QuestionFilterMutableStatePatch = {};

      // Map questionTypes
      if (urlFilterState.questionTypes !== undefined) {
        const questionTypes = normalizeFilterSelectionList(urlFilterState.questionTypes);
        newStateFromUrl.selectedTypes = questionTypes;
        newStateFromUrl.pendingSelectedTypes = [...questionTypes];
      }

      // Map selectedTags
      if (urlFilterState.selectedTags !== undefined) {
        newStateFromUrl.selectedTags = normalizeFilterSelectionList(urlFilterState.selectedTags);
      }

      // Map responseStatus
      if (urlFilterState.responseStatus !== undefined) {
        const responseStatusState = normalizeResponseStatusFilterState({
          filterByResponded: !!urlFilterState?.responseStatus?.responded,
          filterByNotResponded: !!urlFilterState?.responseStatus?.notResponded,
          account: this.props.account,
        });
        newStateFromUrl.filterByResponded = responseStatusState.filterByResponded;
        newStateFromUrl.filterByNotResponded = responseStatusState.filterByNotResponded;
      }

      // Map aiFilter
      if (urlFilterState.aiFilter !== undefined) {
        const aiSearchQuery = typeof urlFilterState.aiFilter === 'string' ? urlFilterState.aiFilter : '';
        newStateFromUrl.aiSearchQuery = aiSearchQuery;
        newStateFromUrl.aiDraftQuery = aiSearchQuery;
        newStateFromUrl.aiCombineWithOtherFilters = !!(aiSearchQuery.trim() && urlFilterState.aiCombine === true);
      }
      if (urlFilterState.aiTopN !== undefined) {
        const parsedTopN = normalizePositiveInt(urlFilterState.aiTopN, DEFAULT_AI_TOP_N);
        newStateFromUrl.aiRankingCount = parsedTopN;
        newStateFromUrl.aiAppliedTopN = parsedTopN;
      }

      // Map sbtFilter
      if (urlFilterState.sbtFilter !== undefined) {
        newStateFromUrl.sbtFilterLocalState =
          typeof urlFilterState.sbtFilter === 'object' ? { ...urlFilterState.sbtFilter } : null;
      }

      // Map topQuestions
      if (urlFilterState.topQuestions && typeof urlFilterState.topQuestions === 'object') {
        const { count, by } = urlFilterState.topQuestions;
        newStateFromUrl.topQuestionsCount = typeof count === 'number' ? count : DEFAULT_TOP_QUESTIONS_COUNT;
        newStateFromUrl.pendingTopQuestionsCount = typeof count === 'number' ? count : DEFAULT_TOP_QUESTIONS_COUNT;

        if (by === 'importance') {
          newStateFromUrl.showTopQuestions = true;
          newStateFromUrl.pendingShowTopQuestions = true;
          newStateFromUrl.sortByImportance = true;
          newStateFromUrl.pendingSortByImportance = true;
          newStateFromUrl.showTopQuestionsByResponses = false;
          newStateFromUrl.pendingShowTopQuestionsByResponses = false;
        } else if (by === 'responses') {
          newStateFromUrl.showTopQuestionsByResponses = true;
          newStateFromUrl.pendingShowTopQuestionsByResponses = true;
          newStateFromUrl.showTopQuestions = false;
          newStateFromUrl.pendingShowTopQuestions = false;
          newStateFromUrl.sortByImportance = false;
          newStateFromUrl.pendingSortByImportance = false;
        } else {
          // Invalid 'by' value or missing
          newStateFromUrl.showTopQuestions = false;
          newStateFromUrl.pendingShowTopQuestions = false;
          newStateFromUrl.showTopQuestionsByResponses = false;
          newStateFromUrl.pendingShowTopQuestionsByResponses = false;
          newStateFromUrl.sortByImportance = false;
          newStateFromUrl.pendingSortByImportance = false;
          // Keep existing topQuestionsCount or component default if not specified by URL
          if (Object.prototype.hasOwnProperty.call(urlFilterState, 'topQuestions')) {
            // only reset count if topQuestions key exists and is null
            newStateFromUrl.topQuestionsCount = DEFAULT_TOP_QUESTIONS_COUNT; // default count
            newStateFromUrl.pendingTopQuestionsCount = DEFAULT_TOP_QUESTIONS_COUNT; // default count
          }
        }
      } else {
        // topQuestions is null or not an object (or not provided)
        newStateFromUrl.showTopQuestions = false;
        newStateFromUrl.pendingShowTopQuestions = false;
        newStateFromUrl.showTopQuestionsByResponses = false;
        newStateFromUrl.pendingShowTopQuestionsByResponses = false;
        newStateFromUrl.sortByImportance = false;
        newStateFromUrl.pendingSortByImportance = false;
        // Keep existing topQuestionsCount or component default if not specified by URL
      }

      if (Object.keys(newStateFromUrl).length > 0) {
        if (typeof newStateFromUrl.aiSearchQuery === 'string' && newStateFromUrl.aiSearchQuery.trim()) {
          newStateFromUrl.aiAppliedTopN = normalizePositiveInt(newStateFromUrl.aiAppliedTopN, DEFAULT_AI_TOP_N);
          newStateFromUrl.aiFilterApplied = false;
          newStateFromUrl.aiRankedQuestionIds = [];
          newStateFromUrl.aiApplyError = '';
        } else if (!Object.prototype.hasOwnProperty.call(newStateFromUrl, 'aiCombineWithOtherFilters')) {
          newStateFromUrl.aiCombineWithOtherFilters = false;
        }
        this.setState(newStateFromUrl, () => {
          this.handleApplyFilters(true); // Apply filters based on URL state
          this.queueAutoApplyAiFilter('mount:url-filter-state');
        });
        initialFiltersApplied = true;
      }
    }

    // If filters haven't been applied by URL state or defaultFilterState string
    if (!initialFiltersApplied) {
      this.computeFilteredQuestionsCount(); // Compute based on localStorage or initial constructor state
      this.queueAutoApplyAiFilter('mount:existing-state');
    }
    this.checkIfCurrentFilterIsBookmarked();
    this._allowFilterStateAutosave = true;
  } // End of componentDidMount

  buildAutosaveSignature = (
    propsIn: QuestionFilterPersistenceProps = this.props,
    stateIn: unknown = this.state,
  ): string => {
    const state = toUnknownRecord(stateIn);
    const props = toUnknownRecord(propsIn) as QuestionFilterPersistenceProps;
    return stableSerializeSmallObject({
      slug: resolveFilterStorageSlug(props),
      mode: props.filterType === 'results' ? 'results' : 'questions',
      selectedTypes: state.selectedTypes || [],
      sortByImportance: !!state.sortByImportance,
      showTopQuestions: !!state.showTopQuestions,
      topQuestionsCount: Number(state.topQuestionsCount ?? DEFAULT_TOP_QUESTIONS_COUNT),
      aiSearchQuery: String(state.aiSearchQuery || ''),
      aiAppliedTopN: Number(state.aiAppliedTopN ?? DEFAULT_AI_TOP_N),
      aiRankingCount: Number(state.aiRankingCount ?? DEFAULT_AI_TOP_N),
      aiCombineWithOtherFilters: !!state.aiCombineWithOtherFilters,
      sbtFilterLocalState: state.sbtFilterLocalState || null,
      selectedTags: state.selectedTags || [],
      showTopQuestionsByResponses: !!state.showTopQuestionsByResponses,
      filterByResponded: !!state.filterByResponded,
      filterByNotResponded: !!state.filterByNotResponded,
    });
  };

  hasResponseDrivenFilterState = ({
    usePendingState = true,
    stateIn = this.state,
  }: QuestionFilterResponseDrivenStateArgs = {}): boolean => {
    const state = toUnknownRecord(stateIn);
    const hasResponseStatusFilter = this.hasActiveResponseStatusFilter({ stateIn: state });
    const showTopQuestions = usePendingState
      ? !!(state.pendingShowTopQuestions || state.showTopQuestions)
      : !!state.showTopQuestions;
    const showTopQuestionsByResponses = usePendingState
      ? !!(state.pendingShowTopQuestionsByResponses || state.showTopQuestionsByResponses)
      : !!state.showTopQuestionsByResponses;
    const sortByImportance = usePendingState
      ? !!(state.pendingSortByImportance || state.sortByImportance)
      : !!state.sortByImportance;

    return !!(hasResponseStatusFilter || showTopQuestions || showTopQuestionsByResponses || sortByImportance);
  };

  hasActiveResponseStatusFilter = ({ stateIn = this.state }: QuestionFilterStateArg = {}): boolean => {
    const state = toUnknownRecord(stateIn);
    const filterByResponded = !!state.filterByResponded;
    const filterByNotResponded = !!state.filterByNotResponded;
    return (filterByResponded || filterByNotResponded) && !(filterByResponded && filterByNotResponded);
  };

  hasExternalFilterState = (propsIn: QuestionFilterPersistenceProps = this.props): boolean =>
    !!(propsIn?.filterState && typeof propsIn.filterState === 'object' && Object.keys(propsIn.filterState).length > 0);

  shouldApplyDefaultFilterState = (propsIn: QuestionFilterPersistenceProps = this.props): boolean =>
    !!propsIn?.defaultFilterState && !this.hasExternalFilterState(propsIn);

  shouldUseLocalStorageBackedFilterState = (propsIn: QuestionFilterPersistenceProps = this.props): boolean =>
    !!propsIn?.enableLocalStorage &&
    !this.shouldApplyDefaultFilterState(propsIn) &&
    !this.hasExternalFilterState(propsIn);

  getFilterPersistenceScopeSignature = (propsIn: QuestionFilterPersistenceProps = this.props): string =>
    [propsIn?.filterType === 'results' ? 'results' : 'questions', String(resolveFilterStorageSlug(propsIn) || '')].join(
      '|',
    );

  getMemoizedStableSerialize = (value: unknown, maxLen: unknown = 4096): string => {
    if (!value || typeof value !== 'object') {
      return stableSerializeSmallObject(value, maxLen);
    }
    let byLen = this._stableSerializeByRefMemo.get(value);
    if (!byLen) {
      byLen = new Map();
      this._stableSerializeByRefMemo.set(value, byLen);
    }
    if (byLen.has(maxLen)) {
      return byLen.get(maxLen) as string;
    }
    const serialized = stableSerializeSmallObject(value, maxLen);
    byLen.set(maxLen, serialized);
    return serialized;
  };

  shouldAutosaveFilterState = (prevProps: QuestionFilterPersistenceProps, prevState: UnknownRecord): boolean => {
    if (!this.props.enableLocalStorage || !this._allowFilterStateAutosave || this._loadingFilterStateFromCache) {
      return false;
    }

    const autosaveInputsLikelyChanged =
      prevProps.filterType !== this.props.filterType ||
      resolveFilterStorageSlug(prevProps) !== resolveFilterStorageSlug(this.props) ||
      prevState.selectedTypes !== this.state.selectedTypes ||
      prevState.sortByImportance !== this.state.sortByImportance ||
      prevState.showTopQuestions !== this.state.showTopQuestions ||
      prevState.topQuestionsCount !== this.state.topQuestionsCount ||
      prevState.aiSearchQuery !== this.state.aiSearchQuery ||
      prevState.aiAppliedTopN !== this.state.aiAppliedTopN ||
      prevState.aiRankingCount !== this.state.aiRankingCount ||
      prevState.aiCombineWithOtherFilters !== this.state.aiCombineWithOtherFilters ||
      prevState.sbtFilterLocalState !== this.state.sbtFilterLocalState ||
      prevState.selectedTags !== this.state.selectedTags ||
      prevState.showTopQuestionsByResponses !== this.state.showTopQuestionsByResponses ||
      prevState.filterByResponded !== this.state.filterByResponded ||
      prevState.filterByNotResponded !== this.state.filterByNotResponded;

    if (!autosaveInputsLikelyChanged) {
      return false;
    }

    const prevSig = this.buildAutosaveSignature(prevProps, prevState);
    const nextSig = this.buildAutosaveSignature(this.props, this.state);
    return prevSig !== nextSig;
  };

  componentDidUpdate(prevProps: UnknownRecord, prevState: UnknownRecord) {
    measureSync('ce.questionFilter.componentDidUpdate', () => {
      this.syncAiApplyingElapsedTimer();
      const filterPersistenceScopeChanged =
        this.getFilterPersistenceScopeSignature(prevProps) !== this.getFilterPersistenceScopeSignature(this.props);
      const shouldRestoreScopedLocalFilterState =
        filterPersistenceScopeChanged && this.shouldUseLocalStorageBackedFilterState(this.props);

      if (shouldRestoreScopedLocalFilterState) {
        this.invalidatePendingAiApply();
        void this.loadFilterStateFromLocalStorage({ resetIfMissing: true }).then((didRestoreState: unknown) => {
          if (!didRestoreState || !this._isMounted) return;
          this.handleApplyFilters(true);
          this.checkIfCurrentFilterIsBookmarked();
        });
      }

      const prevAccount = toStr(prevProps.account).trim();
      const nextAccount = toStr(this.props.account).trim();
      const accountDisconnected = !!prevAccount && !nextAccount;
      if (accountDisconnected && (this.state.filterByResponded || this.state.filterByNotResponded)) {
        this.setState(
          {
            filterByResponded: false,
            filterByNotResponded: false,
          },
          () => {
            if (this.props.enableLocalStorage && !filterPersistenceScopeChanged) {
              this.saveFilterStateToLocalStorage();
            }
            this.handleApplyFilters(true);
            this.queueCombinedAiRefreshIfNeeded('update:account-disconnect');
          },
        );
        return;
      }
      const prevAccountLower = prevAccount.toLowerCase();
      const nextAccountLower = nextAccount.toLowerCase();
      const connectedAccountChanged = !!nextAccountLower && prevAccountLower !== nextAccountLower;
      const shouldReapplyForAccountChange =
        connectedAccountChanged && this.hasActiveResponseStatusFilter({ stateIn: this.state });

      const questionNoncePresent = this.props.questionsCacheNonce != null && prevProps.questionsCacheNonce != null;
      const responsesNoncePresent =
        this.props.questionResponsesNonce != null && prevProps.questionResponsesNonce != null;

      const questionsChangedByNonce = questionNoncePresent
        ? prevProps.questionsCacheNonce !== this.props.questionsCacheNonce
        : false;
      const questionsChanged = questionsChangedByNonce || prevProps.questions !== this.props.questions;
      const responsesChangedByNonce = responsesNoncePresent
        ? prevProps.questionResponsesNonce !== this.props.questionResponsesNonce
        : false;
      const responsesChangedByRef = prevProps.questionResponses !== this.props.questionResponses;
      const responsesChanged = responsesChangedByNonce || responsesChangedByRef;
      const shouldTrackResponsePayload = this.hasResponseDrivenFilterState({
        usePendingState: true,
        stateIn: this.state,
      });

      const statePatch: QuestionFilterMutableStatePatch = {};
      let shouldApplyFiltersAfterPatch = false;
      let nextMergedQuestionsSyncSignature = this._mergedQuestionsSyncSignature;
      let nextCachedQuestionResponsesSignature = this._cachedQuestionResponsesSignature;

      // Re-run filters if the underlying QUESTIONS array changes.
      if (questionsChanged) {
        const nextMergedQuestions = this.mergeQuestionsWithCache(this.props.questions);
        const nextMergedSignature = buildQuestionIdListSignature(nextMergedQuestions);
        if (nextMergedSignature !== this._mergedQuestionsSyncSignature) {
          statePatch.mergedQuestions = nextMergedQuestions;
          nextMergedQuestionsSyncSignature = nextMergedSignature;
          shouldApplyFiltersAfterPatch = true;
        }
      }

      // Re-run filters when QUESTION RESPONSES arrive after initial mount.
      if (responsesChanged && shouldTrackResponsePayload) {
        const nextCachedQuestionResponses = this.props.questionResponses || {};
        const nextCachedResponsesSignature = buildFilteredResponsesByQuestionSignature(nextCachedQuestionResponses);
        if (nextCachedResponsesSignature !== this._cachedQuestionResponsesSignature) {
          statePatch.cachedQuestionResponses = nextCachedQuestionResponses;
          nextCachedQuestionResponsesSignature = nextCachedResponsesSignature;
          shouldApplyFiltersAfterPatch = true;
        }
      }

      if (shouldApplyFiltersAfterPatch) {
        this.setState(statePatch, () => {
          this._mergedQuestionsSyncSignature = nextMergedQuestionsSyncSignature;
          this._cachedQuestionResponsesSignature = nextCachedQuestionResponsesSignature;
          if (!shouldRestoreScopedLocalFilterState) {
            this.handleApplyFilters(true);
            this.queueAutoApplyAiFilter('update:questions-or-responses');
          }
        });
      } else if (shouldReapplyForAccountChange) {
        if (!shouldRestoreScopedLocalFilterState) {
          this.handleApplyFilters(true);
          this.queueAutoApplyAiFilter('update:account-change');
        }
      } else if (
        // Re-run filters once cache becomes ready (prevents stale counts after first load).
        prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady &&
        this.props.isQuestionCacheReady
      ) {
        if (!shouldRestoreScopedLocalFilterState) {
          this.handleApplyFilters(true);
          this.queueAutoApplyAiFilter('update:question-cache-ready');
        }
      }

      // keep internal state in sync if an external filterState prop changes
      const filterStatePropRefChanged = prevProps.filterState !== this.props.filterState;
      const prevExternalFilterStateSignature =
        !filterStatePropRefChanged && typeof this._lastExternalFilterStateSignature === 'string'
          ? this._lastExternalFilterStateSignature
          : this.getMemoizedStableSerialize(prevProps.filterState);
      const nextExternalFilterStateSignature = filterStatePropRefChanged
        ? this.getMemoizedStableSerialize(this.props.filterState)
        : stableSerializeSmallObject(this.props.filterState);
      const filterStateChanged = prevExternalFilterStateSignature !== nextExternalFilterStateSignature;
      this._lastExternalFilterStateSignature = nextExternalFilterStateSignature;
      if (filterStateChanged) {
        this.syncExternalFilterState(this.props.filterState);
      }

      // Save local filter state if enabled
      if (this.shouldAutosaveFilterState(prevProps, prevState)) {
        this.saveFilterStateToLocalStorage();
      }
    });
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (this.copySuccessTimeout) clearTimeout(this.copySuccessTimeout);
    if (this.bookmarkFeedbackTimeout) clearTimeout(this.bookmarkFeedbackTimeout);
    if (this._aiApplyingElapsedTimer) {
      clearInterval(this._aiApplyingElapsedTimer);
      this._aiApplyingElapsedTimer = null;
    }
    this._aiApplyingStartedAtMs = null;
    this._aiAutoApplyInFlightSignature = '';
    this._aiAutoApplyQueuedSignature = '';
    this._aiLatestRequestSeq = this._aiApplyRequestSeq;
  }

  // ----------------------------------------------------------------------------------
  // BOOKMARK LOGIC
  // ----------------------------------------------------------------------------------
  checkIfCurrentFilterIsBookmarked = (): void => {
    const currentFilterString = serializeFilterState(this.buildFilterState());
    if (!currentFilterString) {
      if (this._isMounted && this.state.isCurrentFilterBookmarked !== false) {
        this.setState(buildQuestionFilterBookmarkStatusPatch(false));
      }
      return;
    }

    const slug = resolveFilterStorageSlug(this.props);
    let bookmarksCache: QuestionFilterBookmarkCache = {};
    try {
      const filtersCache = peekCacheSync('filters', slug, { clone: false }) || {};
      bookmarksCache =
        filtersCache && typeof filtersCache === 'object' ? (filtersCache as QuestionFilterBookmarkCache) : {};
    } catch (e) {
      questionFilterLog.error('Error reading bookmarksCache', e);
      bookmarksCache = {};
    }

    const bookmarkedFilters = Array.isArray(bookmarksCache.bookmarkedFilters)
      ? bookmarksCache.bookmarkedFilters
      : Array.isArray(bookmarksCache.filters)
        ? bookmarksCache.filters
        : [];
    const isMatch = bookmarkedFilters.includes(currentFilterString);

    if (this._isMounted && this.state.isCurrentFilterBookmarked !== isMatch) {
      this.setState(buildQuestionFilterBookmarkStatusPatch(isMatch));
    }
  };

  handleBookmarkCurrentFilter = (): void => {
    if (!this._isMounted) return;

    const currentFilterString = serializeFilterState(this.buildFilterState());
    if (!currentFilterString) {
      // Don't bookmark an empty/default filter
      return;
    }

    const slug = resolveFilterStorageSlug(this.props);
    let bookmarksCacheObject: QuestionFilterBookmarkCache = {};

    try {
      const parsedCache = peekCacheSync('filters', slug, { clone: false });
      bookmarksCacheObject =
        typeof parsedCache === 'object' && parsedCache !== null
          ? { ...(parsedCache as QuestionFilterBookmarkCache) }
          : {};
    } catch (e) {
      questionFilterLog.error('Error parsing bookmarksCache from localStorage, resetting.', e);
    }

    // Canonical field for persisted filter bookmarks.
    if (!Array.isArray(bookmarksCacheObject.bookmarkedFilters)) {
      bookmarksCacheObject.bookmarkedFilters = Array.isArray(bookmarksCacheObject.filters)
        ? [...bookmarksCacheObject.filters]
        : [];
    } else {
      bookmarksCacheObject.bookmarkedFilters = [...bookmarksCacheObject.bookmarkedFilters];
    }

    // Prevent duplicates
    if (!bookmarksCacheObject.bookmarkedFilters.includes(currentFilterString)) {
      bookmarksCacheObject.bookmarkedFilters.push(currentFilterString);
    }

    const writeResult = (writeCache as QuestionFilterWriteCache)('filters', slug, bookmarksCacheObject);
    const handleSuccess = (ok: unknown) => {
      if (!ok) {
        questionFilterLog.warn('Failed to persist bookmarked filter state');
        return;
      }
      this.setState(buildQuestionFilterBookmarkFeedbackPatch(true), () => {
        this.checkIfCurrentFilterIsBookmarked();
      });

      if (this.bookmarkFeedbackTimeout) clearTimeout(this.bookmarkFeedbackTimeout);
      this.bookmarkFeedbackTimeout = setTimeout(() => {
        if (this._isMounted) {
          this.setState(buildQuestionFilterBookmarkFeedbackPatch(false));
        }
      }, 2000);
    };
    if (writeResult && typeof writeResult !== 'boolean' && typeof writeResult.then === 'function') {
      void writeResult.then(handleSuccess).catch((e: unknown) => {
        questionFilterLog.error('Error saving bookmarksCache to local cache:', e);
      });
    } else {
      handleSuccess(writeResult);
    }
  };

  // ----------------------------------------------------------------------------------
  // LOCAL STORAGE FOR FILTER STATE
  // ----------------------------------------------------------------------------------
  getDefaultFilterStatePatch = (): QuestionFilterMutableStatePatch => ({
    selectedTypes: [],
    selectedTags: [],
    sortByImportance: false,
    sbtFilteredQuestions: null,
    sbtFilterLocalState: null,
    aiSearchQuery: '',
    aiDraftQuery: '',
    aiRankingCount: DEFAULT_AI_TOP_N,
    aiAppliedTopN: null,
    aiFilterApplied: false,
    aiCombineWithOtherFilters: false,
    aiRankedQuestionIds: [],
    aiApplying: false,
    aiApplyingElapsedSec: 0,
    aiApplyError: '',
    aiLastAppliedSignature: '',
    filterByResponded: false,
    filterByNotResponded: false,
    showTopQuestions: false,
    topQuestionsCount: DEFAULT_TOP_QUESTIONS_COUNT,
    showTopQuestionsByResponses: false,
    pendingSelectedTypes: [],
    pendingSortByImportance: false,
    pendingSbtFilteredQuestions: null,
    pendingShowTopQuestions: false,
    pendingTopQuestionsCount: DEFAULT_TOP_QUESTIONS_COUNT,
    pendingShowTopQuestionsByResponses: false,
    filterUrlInput: '',
  });

  async loadFilterStateFromLocalStorage(options: QuestionFilterLoadStateOptions = {}): Promise<boolean> {
    const { resetIfMissing = false } = options;
    this._loadingFilterStateFromCache = true;
    let didRestoreState = false;
    try {
      const slug = resolveFilterStorageSlug(this.props);
      const modeKey =
        this.props.filterType === 'results' ? 'questionFilterState_results' : 'questionFilterState_questions';
      let saved: string | null = null;
      const filtersCacheSync = peekCacheSync('filters', slug, { clone: false });
      if (filtersCacheSync && typeof filtersCacheSync === 'object') {
        const filtersCacheRecord = filtersCacheSync as Record<string, unknown>;
        saved = filtersCacheRecord[modeKey] ? JSON.stringify(filtersCacheRecord[modeKey]) : null;
      }
      if (!saved) {
        const filtersCache = await readCache('filters', slug);
        if (filtersCache && typeof filtersCache === 'object' && filtersCache[modeKey]) {
          saved = JSON.stringify((filtersCache as Record<string, unknown>)[modeKey]);
        }
      }
      if (saved) {
        const parsed = toUnknownRecord(JSON.parse(saved));
        const shouldClearPersistedResponseStatus =
          !toStr(this.props.account).trim() && (!!parsed?.filterByResponded || !!parsed?.filterByNotResponded);
        const responseStatusState = normalizeResponseStatusFilterState({
          filterByResponded: parsed.filterByResponded,
          filterByNotResponded: parsed.filterByNotResponded,
          account: this.props.account,
        });
        didRestoreState = true;
        await new Promise<void>((resolve) => {
          if (!this._isMounted) {
            resolve();
            return;
          }
          this.setState(
            (prevState: QuestionFilterStateRecord) => ({
              selectedTypes: Array.isArray(parsed.selectedTypes) ? parsed.selectedTypes : prevState.selectedTypes,
              sortByImportance:
                typeof parsed.sortByImportance === 'boolean' ? parsed.sortByImportance : prevState.sortByImportance,
              showTopQuestions:
                typeof parsed.showTopQuestions === 'boolean' ? parsed.showTopQuestions : prevState.showTopQuestions,
              topQuestionsCount: parsed.topQuestionsCount || prevState.topQuestionsCount,
              aiSearchQuery: typeof parsed.aiSearchQuery === 'string' ? parsed.aiSearchQuery : prevState.aiSearchQuery,
              aiDraftQuery: typeof parsed.aiSearchQuery === 'string' ? parsed.aiSearchQuery : prevState.aiDraftQuery,
              aiRankingCount: normalizePositiveInt(parsed.aiRankingCount, prevState.aiRankingCount || DEFAULT_AI_TOP_N),
              aiAppliedTopN: parsed.aiSearchQuery
                ? normalizePositiveInt(
                    parsed.aiAppliedTopN ?? parsed.aiRankingCount,
                    prevState.aiAppliedTopN || DEFAULT_AI_TOP_N,
                  )
                : null,
              aiFilterApplied: false,
              aiRankedQuestionIds: [],
              aiCombineWithOtherFilters: parsed.aiSearchQuery ? parsed.aiCombineWithOtherFilters === true : false,
              aiApplyError: '',
              sbtFilterLocalState: Object.prototype.hasOwnProperty.call(parsed, 'sbtFilterLocalState')
                ? parsed.sbtFilterLocalState || null
                : prevState.sbtFilterLocalState,
              selectedTags: Array.isArray(parsed.selectedTags) ? parsed.selectedTags : prevState.selectedTags,
              filterByResponded: responseStatusState.filterByResponded,
              filterByNotResponded: responseStatusState.filterByNotResponded,
              showTopQuestionsByResponses:
                typeof parsed.showTopQuestionsByResponses === 'boolean'
                  ? parsed.showTopQuestionsByResponses
                  : prevState.showTopQuestionsByResponses,

              // Also update pending states:
              pendingSelectedTypes: Array.isArray(parsed.selectedTypes)
                ? parsed.selectedTypes
                : prevState.pendingSelectedTypes,
              pendingSortByImportance:
                typeof parsed.sortByImportance === 'boolean'
                  ? parsed.sortByImportance
                  : prevState.pendingSortByImportance,
              pendingShowTopQuestions:
                typeof parsed.showTopQuestions === 'boolean'
                  ? parsed.showTopQuestions
                  : prevState.pendingShowTopQuestions,
              pendingTopQuestionsCount: parsed.topQuestionsCount || prevState.pendingTopQuestionsCount,
              pendingShowTopQuestionsByResponses:
                typeof parsed.showTopQuestionsByResponses === 'boolean'
                  ? parsed.showTopQuestionsByResponses
                  : prevState.pendingShowTopQuestionsByResponses,
            }),
            () => {
              if (shouldClearPersistedResponseStatus) {
                this.saveFilterStateToLocalStorage();
              }
              this.queueAutoApplyAiFilter('load-local-state');
              resolve();
            },
          );
        });
      } else if (resetIfMissing) {
        didRestoreState = true;
        await new Promise<void>((resolve) => {
          if (!this._isMounted) {
            resolve();
            return;
          }
          this.setState(this.getDefaultFilterStatePatch(), () => resolve());
        });
      }
    } catch (error) {
      questionFilterLog.error('Error loading filter state from cache:', error);
    } finally {
      this._loadingFilterStateFromCache = false;
    }
    return didRestoreState;
  }

  saveFilterStateToLocalStorage() {
    try {
      const {
        selectedTypes,
        sortByImportance,
        showTopQuestions,
        topQuestionsCount,
        aiSearchQuery,
        aiRankingCount,
        aiAppliedTopN,
        aiCombineWithOtherFilters,
        sbtFilterLocalState,
        selectedTags,
        showTopQuestionsByResponses,
        filterByResponded,
        filterByNotResponded,
      } = this.state;

      const dataToStore = {
        selectedTypes,
        sortByImportance,
        showTopQuestions,
        topQuestionsCount,
        aiSearchQuery,
        aiRankingCount,
        aiAppliedTopN,
        aiCombineWithOtherFilters,
        sbtFilterLocalState,
        selectedTags,
        showTopQuestionsByResponses,
        filterByResponded,
        filterByNotResponded,
      };

      const modeKey =
        this.props.filterType === 'results' ? 'questionFilterState_results' : 'questionFilterState_questions';
      const slug = resolveFilterStorageSlug(this.props);
      const existing = peekCacheSync('filters', slug, { clone: false });
      const existingModeState = existing && typeof existing === 'object' ? existing[modeKey] || null : null;
      const nextModeSignature = this.getMemoizedStableSerialize(dataToStore);
      const existingModeSignature = this.getMemoizedStableSerialize(existingModeState);
      const persistenceSignature = `${slug}|${modeKey}|${nextModeSignature}`;
      if (nextModeSignature && persistenceSignature === this._lastSavedFilterStateSignature) {
        return;
      }
      if (existingModeSignature === nextModeSignature) {
        this._lastSavedFilterStateSignature = persistenceSignature;
        return;
      }
      const next =
        existing && typeof existing === 'object' ? { ...existing, [modeKey]: dataToStore } : { [modeKey]: dataToStore };
      const writeResult = (writeCache as QuestionFilterWriteCache)('filters', slug, next);
      const handleSuccess = (ok: unknown) => {
        if (ok !== false) {
          this._lastSavedFilterStateSignature = persistenceSignature;
        }
      };
      if (writeResult && typeof writeResult !== 'boolean' && typeof writeResult.then === 'function') {
        void writeResult.then(handleSuccess).catch((error: unknown) => {
          questionFilterLog.error('Error saving filter state to cache:', error);
        });
      } else {
        handleSuccess(writeResult);
      }
    } catch (error) {
      questionFilterLog.error('Error saving filter state to cache:', error);
    }
  }

  syncExternalFilterState(nextFilterState: unknown): void {
    if (!nextFilterState || typeof nextFilterState !== 'object') {
      this.invalidatePendingAiApply();
      this.setState(this.getDefaultFilterStatePatch(), () => {
        this.handleApplyFilters(true);
        this.checkIfCurrentFilterIsBookmarked();
      });
      return;
    }
    const filterState = nextFilterState as UnknownRecord;

    // Prevent stale in-flight AI responses from overriding externally synced state.
    this.invalidatePendingAiApply();

    const selectedTypes = normalizeFilterSelectionList(filterState.questionTypes);
    const selectedTags = normalizeFilterSelectionList(filterState.selectedTags);

    const aiSearchQuery = typeof filterState.aiFilter === 'string' ? filterState.aiFilter : '';
    const aiTopN = normalizePositiveInt(filterState.aiTopN, DEFAULT_AI_TOP_N);
    const aiCombineWithOtherFilters = !!(aiSearchQuery.trim() && filterState.aiCombine === true);

    const sbtFilterLocalState = normalizeSbtFilterLocalState(filterState.sbtFilter);
    const responseStatus = toUnknownRecord(filterState.responseStatus);
    const responseStatusState = normalizeResponseStatusFilterState({
      filterByResponded: !!responseStatus.responded,
      filterByNotResponded: !!responseStatus.notResponded,
      account: this.props.account,
    });

    // Top questions mapping
    let showTopQuestions = false;
    let showTopQuestionsByResponses = false;
    let topQuestionsCount = DEFAULT_TOP_QUESTIONS_COUNT;
    let sortByImportance = false;

    if (filterState.topQuestions && typeof filterState.topQuestions === 'object') {
      const { count, by } = toUnknownRecord(filterState.topQuestions);
      topQuestionsCount = typeof count === 'number' ? count : DEFAULT_TOP_QUESTIONS_COUNT;

      if (by === 'importance') {
        showTopQuestions = true;
        sortByImportance = true;
        showTopQuestionsByResponses = false;
      } else if (by === 'responses') {
        showTopQuestionsByResponses = true;
        showTopQuestions = false;
        sortByImportance = false;
      } else {
        // Unknown "by" value – treat as no top-questions filter
        showTopQuestions = false;
        showTopQuestionsByResponses = false;
        sortByImportance = false;
      }
    }

    const nextAiAppliedTopN = aiSearchQuery ? aiTopN : null;
    const currentAiSearchQuery = String(this.state.aiSearchQuery || '');
    const shouldPreserveAppliedAiState =
      aiSearchQuery.trim() && currentAiSearchQuery === aiSearchQuery && !!this.state.aiFilterApplied;

    this.setState(
      {
        // committed state
        selectedTypes,
        selectedTags,
        aiSearchQuery,
        aiDraftQuery: aiSearchQuery,
        aiRankingCount: aiTopN,
        aiAppliedTopN: nextAiAppliedTopN,
        aiFilterApplied: shouldPreserveAppliedAiState ? this.state.aiFilterApplied : false,
        aiRankedQuestionIds: shouldPreserveAppliedAiState
          ? normalizeAiIdList(this.state.aiRankedQuestionIds || [])
          : [],
        aiCombineWithOtherFilters,
        aiApplyError: shouldPreserveAppliedAiState ? this.state.aiApplyError : '',
        aiApplying: false,
        sbtFilterLocalState,
        filterByResponded: responseStatusState.filterByResponded,
        filterByNotResponded: responseStatusState.filterByNotResponded,
        showTopQuestions,
        showTopQuestionsByResponses,
        topQuestionsCount,
        sortByImportance,

        // pending mirrors (used for instantaneous UI feedback)
        pendingSelectedTypes: selectedTypes,
        pendingShowTopQuestions: showTopQuestions,
        pendingShowTopQuestionsByResponses: showTopQuestionsByResponses,
        pendingTopQuestionsCount: topQuestionsCount,
        pendingSortByImportance: sortByImportance,
      },
      () => {
        // re-apply with the newly synced state so the list/counts update immediately
        this.handleApplyFilters(true);
        // and refresh bookmark adornments
        this.checkIfCurrentFilterIsBookmarked();
        this.queueAutoApplyAiFilter('sync-external-state');
      },
    );
  }

  // ----------------------------------------------------------------------------------
  // MERGE QUESTIONS WITH CACHE & LOAD RESPONSES FROM LOCAL
  // ----------------------------------------------------------------------------------
  mergeQuestionsWithCache(sourceQuestions: unknown): unknown {
    if (!sourceQuestions || !Array.isArray(sourceQuestions)) return sourceQuestions || [];
    const sourceQuestionList = sourceQuestions as QuestionFilterQuestionRecord[];

    const resolvedSession = resolveEffectiveSessionContext(this.props);
    const slug = resolvedSession.sessionSlug || '';
    const group = resolvedSession.sessionConfig || {};
    const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? group.networkChainId ?? '');
    if (!netIdStr) return sourceQuestions; // no network context → return as-is

    // NOTE: read from per-group key `dg:questionsCache:<slug>` using canonical string network keys only
    const questionsCache = readQuestionsCacheSync(slug) as Record<string, QuestionFilterQuestionsCacheNet | undefined>;

    const net = questionsCache?.[netIdStr];
    if (!net || !net.questions) return sourceQuestions;
    const cachedQuestions = net.questions;

    const allCacheQIDs = Object.keys(cachedQuestions);
    const existingIDs = new Set<string>(sourceQuestionList.map((q) => String(q.id || '').toLowerCase()));
    const merged = [...sourceQuestionList];

    allCacheQIDs.forEach((qIdLower) => {
      if (!existingIDs.has(qIdLower)) {
        const qObj = cachedQuestions[qIdLower];
        if (qObj) {
          merged.push({ ...qObj });
        }
      }
    });

    return merged;
  }

  loadQuestionResponsesFromLocalStorage() {
    // Group-aware: read responses from per-group key `dg:questionsCache:<slug>` using STRING network key.
    const resolvedSession = resolveEffectiveSessionContext(this.props);
    const slug = resolvedSession.sessionSlug || '';
    const group = resolvedSession.sessionConfig || {};
    const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? group.networkChainId ?? '');
    if (!netIdStr) {
      questionFilterLog.warn('Network ID undefined; cannot load questionResponses from localStorage.');
      return;
    }

    try {
      const questionsCache = readQuestionsCacheSync(slug);

      const cachedResponses = questionsCache?.[netIdStr]?.questionResponses || {};
      const cachedResponsesSignature = buildFilteredResponsesByQuestionSignature(cachedResponses);
      if (cachedResponsesSignature === this._cachedQuestionResponsesSignature) return;
      this._cachedQuestionResponsesSignature = cachedResponsesSignature;
      this.setState(buildQuestionFilterCachedResponsesPatch(cachedResponses));
    } catch (error) {
      questionFilterLog.error('Error in loadQuestionResponsesFromLocalStorage:', error);
    }
  }

  parseResponse = (responseData: unknown): unknown => {
    if (typeof responseData !== 'string') return responseData;
    const memo = this._responseParseMemo;
    if (memo.has(responseData)) {
      const cached = memo.get(responseData);
      memo.delete(responseData);
      memo.set(responseData, cached);
      return cached;
    }
    try {
      const parsed = JSON.parse(responseData);
      memo.set(responseData, parsed);
      while (memo.size > QUESTION_FILTER_RESPONSE_PARSE_MEMO_MAX) {
        const oldestKey = memo.keys().next().value;
        if (oldestKey === undefined) break;
        memo.delete(oldestKey);
      }
      return parsed;
    } catch (error) {
      questionFilterLog.error('Error parsing response data in QuestionFilter:', error);
      memo.set(responseData, null);
      while (memo.size > QUESTION_FILTER_RESPONSE_PARSE_MEMO_MAX) {
        const oldestKey = memo.keys().next().value;
        if (oldestKey === undefined) break;
        memo.delete(oldestKey);
      }
      return null;
    }
  };

  getMemoizedQuestionResponseStats(
    relevantResponses: unknown = {},
    mergedQuestions: unknown = [],
    questionResponsesNonceKey: unknown = null,
    questionsCacheNonceKey: unknown = null,
  ): Map<string, QuestionFilterResponseStats> {
    const memo = this._questionResponseStatsMemo;
    if (
      memo.relevantResponsesRef === relevantResponses &&
      memo.mergedQuestionsRef === mergedQuestions &&
      memo.questionResponsesNonceKey === questionResponsesNonceKey &&
      memo.questionsCacheNonceKey === questionsCacheNonceKey
    ) {
      return memo.result;
    }

    const questionTypeById: Record<string, string> = {};
    (Array.isArray(mergedQuestions) ? (mergedQuestions as QuestionFilterQuestionRecord[]) : []).forEach((question) => {
      const qLower = toLowerId(question?.id);
      if (!qLower) return;
      questionTypeById[qLower] = String(question?.type || '').toLowerCase();
    });

    const statsByQuestion = new Map<string, QuestionFilterResponseStats>();
    const responsesByQuestion =
      relevantResponses && typeof relevantResponses === 'object' ? (relevantResponses as Record<string, unknown>) : {};
    Object.keys(responsesByQuestion).forEach((qId) => {
      const qLower = String(qId || '').toLowerCase();
      const respondersObj = responsesByQuestion[qId];
      const respondersMap =
        respondersObj && typeof respondersObj === 'object' ? (respondersObj as Record<string, unknown>) : {};
      const responderKeys = Object.keys(respondersMap);
      let totalImportance = 0;
      let responseCount = 0;
      const questionType = questionTypeById[qLower];
      responderKeys.forEach((resp) => {
        const parsed = this.parseResponse(respondersMap[resp]);
        const parsedRecord = toUnknownRecord(parsed);
        const next = Number(parsedRecord.conviction ?? parsedRecord.importance ?? 0);
        if (Number.isFinite(next)) totalImportance += next;
        if (!isFreeformBlankAnswer(questionType, parsed)) {
          responseCount += 1;
        }
      });
      statsByQuestion.set(qLower, {
        responseCount,
        totalImportance,
      });
    });

    this._questionResponseStatsMemo = {
      relevantResponsesRef: relevantResponses,
      mergedQuestionsRef: mergedQuestions,
      questionResponsesNonceKey,
      questionsCacheNonceKey,
      result: statsByQuestion,
    };
    return statsByQuestion;
  }

  // ----------------------------------------------------------------------------------
  // FILTER LOGIC
  // ----------------------------------------------------------------------------------
  setFilterLoading = (loading: unknown): void => {
    this.setState(buildQuestionFilterFilterLoadingPatch(loading));
    if (this.props.setFilterLoading) {
      this.props.setFilterLoading(loading);
    }
  };

  emitCountUpdate = (count: unknown, encryptedCount: unknown): void => {
    if (!this.props.onCountUpdate || !this.props.isQuestionCacheReady) return;
    const safeEncrypted = typeof encryptedCount === 'number' && Number.isFinite(encryptedCount) ? encryptedCount : 0;
    if (this._lastEmittedCount === count && this._lastEmittedEncryptedCount === safeEncrypted) return;
    this._lastEmittedCount = count;
    this._lastEmittedEncryptedCount = safeEncrypted;
    this.props.onCountUpdate(count, safeEncrypted);
  };

  emitFilterActivityChange = (isFilterActive: unknown): void => {
    if (!this.props.onFilterActivityChange) return;
    if (this._lastEmittedFilterActivity === isFilterActive) return;
    this._lastEmittedFilterActivity = isFilterActive;
    this.props.onFilterActivityChange(isFilterActive);
  };

  emitFilterCallbacks(
    filteredPayload: unknown,
    filterStateForCallback: Parameters<typeof serializeFilterState>[0],
  ): void {
    const payloadSignature = buildFilterPayloadSignature(filteredPayload);
    const filterStateSignature = serializeFilterState(filterStateForCallback) || '';
    if (
      this._lastEmittedFilterPayloadSignature === payloadSignature &&
      this._lastEmittedFilterStateSignature === filterStateSignature
    ) {
      return;
    }
    this._lastEmittedFilterPayloadSignature = payloadSignature;
    this._lastEmittedFilterStateSignature = filterStateSignature;
    if (this.props.onFilter) {
      this.props.onFilter(filteredPayload, filterStateForCallback);
    }
    // Avoid duplicate parent work when both props point to the same callback.
    if (this.props.onFilterStateChange && this.props.onFilterStateChange !== this.props.onFilter) {
      this.props.onFilterStateChange(filterStateForCallback);
    }
  }

  buildFilterPipelineResult(usePendingState = false): QuestionFilterPipelineResult {
    const mergedQuestions: QuestionFilterQuestionRecord[] = Array.isArray(this.state.mergedQuestions)
      ? (this.state.mergedQuestions as QuestionFilterQuestionRecord[])
      : [];
    const selectedTypes = usePendingState ? this.state.pendingSelectedTypes : this.state.selectedTypes;
    const sortByImportance = usePendingState ? this.state.pendingSortByImportance : this.state.sortByImportance;
    const sbtFilteredQuestions = usePendingState
      ? this.state.pendingSbtFilteredQuestions
      : this.state.sbtFilteredQuestions;
    const showTopQuestions = usePendingState ? this.state.pendingShowTopQuestions : this.state.showTopQuestions;
    const topQuestionsCount = usePendingState ? this.state.pendingTopQuestionsCount : this.state.topQuestionsCount;
    const showTopQuestionsByResponses = usePendingState
      ? this.state.pendingShowTopQuestionsByResponses
      : this.state.showTopQuestionsByResponses;
    const selectedTags = this.state.selectedTags || [];
    const filterByResponded = this.state.filterByResponded;
    const filterByNotResponded = this.state.filterByNotResponded;
    const aiSearchQuery = this.state.aiSearchQuery || '';
    const aiFilterApplied = !!this.state.aiFilterApplied;
    const aiAppliedTopN = normalizePositiveInt(this.state.aiAppliedTopN, DEFAULT_AI_TOP_N);
    const aiCombineWithOtherFilters = !!this.state.aiCombineWithOtherFilters;
    const aiRankedQuestionIds = normalizeAiIdList(this.state.aiRankedQuestionIds || []);
    const aiRankedIdsSignature = stableSerializeSmallObject(aiRankedQuestionIds, 8192);
    const aiLastAppliedSignature = String(this.state.aiLastAppliedSignature || '');
    const hasSbtFilter = sbtFilteredQuestions !== null;
    const hasTypeFilter = (selectedTypes || []).length > 0;
    const hasTagFilter = (selectedTags || []).length > 0;
    const hasTopFilter = Boolean(showTopQuestions || showTopQuestionsByResponses);
    const hasResponseStatusFilter =
      (filterByResponded || filterByNotResponded) && !(filterByResponded && filterByNotResponded);
    const hasAiFilter = !hasTopFilter && aiFilterApplied && String(aiSearchQuery || '').trim().length > 0;
    const hasImportanceSort = Boolean(sortByImportance);
    const shouldUseResponseData =
      hasResponseStatusFilter || showTopQuestions || showTopQuestionsByResponses || hasImportanceSort;
    const relevantResponses = shouldUseResponseData
      ? this.props.questionResponses || this.state.cachedQuestionResponses || EMPTY_FILTER_RESPONSES
      : EMPTY_FILTER_RESPONSES;
    const questionResponsesNonceKey = shouldUseResponseData
      ? normalizeNonceKey(this.props.questionResponsesNonce)
      : null;
    const questionsCacheNonceKey = shouldUseResponseData ? normalizeNonceKey(this.props.questionsCacheNonce) : null;
    const hasActiveTransforms =
      hasSbtFilter ||
      hasTypeFilter ||
      hasTagFilter ||
      hasResponseStatusFilter ||
      hasAiFilter ||
      hasTopFilter ||
      hasImportanceSort;

    const memo = this._filterPipelineMemo;
    if (
      memo &&
      memo.usePendingState === usePendingState &&
      memo.mergedQuestionsRef === mergedQuestions &&
      memo.relevantResponsesRef === relevantResponses &&
      memo.selectedTypesRef === selectedTypes &&
      memo.sortByImportance === sortByImportance &&
      memo.sbtFilteredQuestionsRef === sbtFilteredQuestions &&
      memo.showTopQuestions === showTopQuestions &&
      memo.topQuestionsCount === topQuestionsCount &&
      memo.showTopQuestionsByResponses === showTopQuestionsByResponses &&
      memo.selectedTagsRef === selectedTags &&
      memo.filterByResponded === filterByResponded &&
      memo.filterByNotResponded === filterByNotResponded &&
      memo.aiSearchQuery === aiSearchQuery &&
      memo.aiFilterApplied === aiFilterApplied &&
      memo.aiAppliedTopN === aiAppliedTopN &&
      memo.aiCombineWithOtherFilters === aiCombineWithOtherFilters &&
      memo.aiRankedIdsSignature === aiRankedIdsSignature &&
      memo.aiLastAppliedSignature === aiLastAppliedSignature &&
      memo.questionResponsesNonceKey === questionResponsesNonceKey &&
      memo.questionsCacheNonceKey === questionsCacheNonceKey
    ) {
      return memo.result;
    }

    if (!hasActiveTransforms) {
      const result = {
        finalQuestions: mergedQuestions,
        count: mergedQuestions.length,
      };
      this._filterPipelineMemo = {
        usePendingState,
        mergedQuestionsRef: mergedQuestions,
        relevantResponsesRef: relevantResponses,
        selectedTypesRef: selectedTypes,
        sortByImportance,
        sbtFilteredQuestionsRef: sbtFilteredQuestions,
        showTopQuestions,
        topQuestionsCount,
        showTopQuestionsByResponses,
        selectedTagsRef: selectedTags,
        filterByResponded,
        filterByNotResponded,
        aiSearchQuery,
        aiFilterApplied,
        aiAppliedTopN,
        aiCombineWithOtherFilters,
        aiRankedIdsSignature,
        aiLastAppliedSignature,
        questionResponsesNonceKey,
        questionsCacheNonceKey,
        result,
      };
      return result;
    }

    const shouldComputeResponseStats = showTopQuestions || showTopQuestionsByResponses || sortByImportance;
    const statsByQuestion = shouldComputeResponseStats
      ? this.getMemoizedQuestionResponseStats(
          relevantResponses,
          mergedQuestions,
          questionResponsesNonceKey,
          questionsCacheNonceKey,
        )
      : null;

    const baseQuestions =
      hasAiFilter && !aiCombineWithOtherFilters ? mergedQuestions : this.getQuestionsSubsetBeforeAi(usePendingState);
    let finalQuestions: QuestionFilterQuestionRecord[] = baseQuestions;

    let shouldApplyAiFilter = hasAiFilter;
    if (hasAiFilter && aiCombineWithOtherFilters) {
      const currentCombinedAiSignature = this.buildAiApplySignature({
        queryOverride: aiSearchQuery,
        candidateQuestions: baseQuestions,
      });
      shouldApplyAiFilter = !!currentCombinedAiSignature && aiLastAppliedSignature === currentCombinedAiSignature;
    }

    if (shouldApplyAiFilter) {
      finalQuestions = this.applyAISearchFilter(finalQuestions, aiSearchQuery, aiRankedQuestionIds, aiAppliedTopN);
    }

    if (showTopQuestions || showTopQuestionsByResponses) {
      const topLimit = Number(topQuestionsCount);
      if (showTopQuestionsByResponses) {
        const rankedByResponses: QuestionFilterRankedQuestion[] = finalQuestions.map((q, idx) => {
          const qLower = String(q.id || '').toLowerCase();
          const score = Number(statsByQuestion?.get(qLower)?.responseCount || 0);
          return [q, idx, score];
        });
        rankedByResponses.sort((a, b) => {
          const diff = b[2] - a[2];
          return diff !== 0 ? diff : a[1] - b[1];
        });
        finalQuestions = rankedByResponses.slice(0, topLimit).map(([q, , score]) => ({ ...q, totalResponses: score }));
      } else {
        const rankedByImportance: QuestionFilterRankedQuestion[] = finalQuestions.map((q, idx) => {
          const qLower = String(q.id || '').toLowerCase();
          const score = Number(statsByQuestion?.get(qLower)?.totalImportance || 0);
          return [q, idx, score];
        });
        rankedByImportance.sort((a, b) => {
          const diff = b[2] - a[2];
          return diff !== 0 ? diff : a[1] - b[1];
        });
        finalQuestions = rankedByImportance
          .slice(0, topLimit)
          .map(([q, , score]) => ({ ...q, totalImportance: score }));
      }
    } else if (sortByImportance) {
      const rankedByImportance: QuestionFilterRankedQuestion[] = finalQuestions.map((q, idx) => {
        const qLower = String(q.id || '').toLowerCase();
        const score = Number(statsByQuestion?.get(qLower)?.totalImportance || 0);
        return [q, idx, score];
      });
      rankedByImportance.sort((a, b) => {
        const diff = b[2] - a[2];
        return diff !== 0 ? diff : a[1] - b[1];
      });
      finalQuestions = rankedByImportance.map(([q, , score]) => ({ ...q, totalImportance: score }));
    }

    const result = {
      finalQuestions,
      count: finalQuestions.length,
    };

    this._filterPipelineMemo = {
      usePendingState,
      mergedQuestionsRef: mergedQuestions,
      relevantResponsesRef: relevantResponses,
      selectedTypesRef: selectedTypes,
      sortByImportance,
      sbtFilteredQuestionsRef: sbtFilteredQuestions,
      showTopQuestions,
      topQuestionsCount,
      showTopQuestionsByResponses,
      selectedTagsRef: selectedTags,
      filterByResponded,
      filterByNotResponded,
      aiSearchQuery,
      aiFilterApplied,
      aiAppliedTopN,
      aiCombineWithOtherFilters,
      aiRankedIdsSignature,
      aiLastAppliedSignature,
      questionResponsesNonceKey,
      questionsCacheNonceKey,
      result,
    };

    return result;
  }

  handleFilteredQuestions = (filtered: unknown, newSbtFilterLocalState: unknown): void => {
    // "filtered" can be an array or an object { filteredQuestions, filteredResponsesByQuestion }
    let realFilteredQuestions: QuestionFilterQuestionRecord[] = [];
    let filteredResponsesByQuestion: QuestionFilterResponsesByQuestion = {};

    if (Array.isArray(filtered)) {
      realFilteredQuestions = filtered;
    } else if (filtered && typeof filtered === 'object') {
      const filteredRecord = filtered as {
        filteredQuestions?: unknown;
        filteredResponsesByQuestion?: unknown;
      };
      if (Array.isArray(filteredRecord.filteredQuestions)) {
        realFilteredQuestions = filteredRecord.filteredQuestions as QuestionFilterQuestionRecord[];
        filteredResponsesByQuestion =
          filteredRecord.filteredResponsesByQuestion && typeof filteredRecord.filteredResponsesByQuestion === 'object'
            ? (filteredRecord.filteredResponsesByQuestion as QuestionFilterResponsesByQuestion)
            : {};
      }
    }

    // Infinite loop prevention
    // Strict deep-equality check. If the incoming filtered lists and SBT state are
    // structurally identical to what we already have, return immediately.
    const sbtStateChanged =
      stableSerializeSmallObject(newSbtFilterLocalState) !== stableSerializeSmallObject(this.state.sbtFilterLocalState);
    const questionsChanged = !areQuestionListsEquivalentById(
      realFilteredQuestions,
      this.state.pendingSbtFilteredQuestions,
    );

    if (!sbtStateChanged && !questionsChanged) {
      return;
    }

    this.setState(
      {
        pendingSbtFilteredQuestions: realFilteredQuestions,
        sbtFilterLocalState: newSbtFilterLocalState,
      },
      () => {
        this.handleApplyFilters(true);
        this.queueCombinedAiRefreshIfNeeded('sbt-filter-change');
      },
    );

    const filterStateForCallback = this.buildFilterState();
    filterStateForCallback.sbtFilter = newSbtFilterLocalState;

    if (Object.keys(filteredResponsesByQuestion).length > 0) {
      this.emitFilterCallbacks(
        {
          filteredQuestions: realFilteredQuestions,
          filteredResponsesByQuestion,
        },
        filterStateForCallback,
      );
    } else {
      this.emitFilterCallbacks(realFilteredQuestions, filterStateForCallback);
    }
  };

  getCurrentFilterState() {
    // This method returns the internal state representation.
    // buildFilterState() is used for the external representation.
    return {
      selectedTypes: this.state.selectedTypes,
      sortByImportance: this.state.sortByImportance,
      showTopQuestions: this.state.showTopQuestions,
      topQuestionsCount: this.state.topQuestionsCount,
      aiSearchQuery: this.state.aiSearchQuery,
      aiDraftQuery: this.state.aiDraftQuery,
      aiRankingCount: this.state.aiRankingCount,
      aiAppliedTopN: this.state.aiAppliedTopN,
      aiFilterApplied: this.state.aiFilterApplied,
      aiCombineWithOtherFilters: this.state.aiCombineWithOtherFilters,
      sbtFilterLocalState: this.state.sbtFilterLocalState,
      selectedTags: this.state.selectedTags,
      showTopQuestionsByResponses: this.state.showTopQuestionsByResponses,
    };
  }

  applyAISearchFilter<TQuestions>(
    questions: TQuestions,
    aiSearchQuery: unknown,
    aiRankedQuestionIds: unknown = [],
    topN: unknown = DEFAULT_AI_TOP_N,
  ): TQuestions | QuestionFilterQuestionRecord[] {
    const query = typeof aiSearchQuery === 'string' ? aiSearchQuery : String(aiSearchQuery || '');
    if (!query.trim()) {
      return questions;
    }
    const orderedIds = normalizeAiIdList(aiRankedQuestionIds);
    if (!orderedIds.length) return [];
    const limit = normalizePositiveInt(topN, DEFAULT_AI_TOP_N);

    const orderById = new Map<string, number>();
    orderedIds.forEach((id, idx) => {
      const key = String(id || '').toLowerCase();
      if (!orderById.has(key)) orderById.set(key, idx);
    });

    return (Array.isArray(questions) ? (questions as QuestionFilterQuestionRecord[]) : [])
      .filter((q) => orderById.has(String(q?.id || '').toLowerCase()))
      .sort((a, b) => {
        const aIdx = orderById.get(String(a?.id || '').toLowerCase());
        const bIdx = orderById.get(String(b?.id || '').toLowerCase());
        return (aIdx ?? 0) - (bIdx ?? 0);
      })
      .slice(0, limit);
  }

  handleAiDraftQueryChange = (nextValue: unknown): void => {
    this.setState(buildQuestionFilterAiDraftQueryPatch(nextValue));
  };

  handleAiTopNChange = (event: QuestionFilterInputChangeEvent): void => {
    const raw = event?.target?.value;
    this.setState(buildQuestionFilterAiRankingCountPatch(raw, DEFAULT_AI_TOP_N));
  };

  handleAiCombineWithFiltersChange = (event: QuestionFilterInputChangeEvent): void => {
    const checked = event?.target?.checked === true;
    this.setState(buildQuestionFilterAiCombinePatch(checked), () => {
      if (this.state.aiFilterApplied && String(this.state.aiSearchQuery || '').trim()) {
        this.handleApplyFilters(true);
        this.queueAutoApplyAiFilter('ai-combine-toggle');
      }
    });
  };

  invalidatePendingAiApply = (): void => {
    this._aiApplyRequestSeq += 1;
    this._aiLatestRequestSeq = this._aiApplyRequestSeq;
    this._aiAutoApplyInFlightSignature = '';
    this._aiAutoApplyQueuedSignature = '';
  };

  handleApplyAIFilter = async ({
    auto = false,
    queryOverride,
    topNOverride,
    source = 'manual',
  }: QuestionFilterAiApplyOptions = {}): Promise<boolean> => {
    const aiAccess = this.getAiAccessState();
    if (!aiAccess.enabled) {
      if (!auto) {
        this.setState(
          buildQuestionFilterAiApplyErrorPatch(
            'AI filter is unavailable. Add a local API key or use a session with sponsored AI access.',
          ),
        );
      }
      return false;
    }

    if (this.state.pendingShowTopQuestions || this.state.pendingShowTopQuestionsByResponses) {
      if (!auto) {
        this.setState(buildQuestionFilterAiApplyErrorPatch('Disable “Top X questions” before applying AI filter.'));
      }
      return false;
    }

    const query = String(queryOverride != null ? queryOverride : this.state.aiDraftQuery).trim();
    const topN = normalizePositiveInt(
      topNOverride != null ? topNOverride : this.state.aiRankingCount,
      DEFAULT_AI_TOP_N,
    );

    if (!query) {
      if (!auto) {
        this.setState(buildQuestionFilterAiApplyErrorPatch('Enter an AI filter query first.'));
      }
      return false;
    }

    const candidateQuestions = this.getAiRankingCandidates();
    const applySignature = this.buildAiApplySignature({
      queryOverride: query,
      candidateQuestions,
    });

    if (!candidateQuestions.length) {
      this.invalidatePendingAiApply();
      this.setState(
        buildQuestionFilterAiApplyNoCandidatesPatch({
          query,
          topN,
        }),
        () => {
          this.handleApplyFilters(true);
        },
      );
      return true;
    }

    if (this.state.aiFilterApplied && this.state.aiLastAppliedSignature === applySignature) {
      this.setState(
        buildQuestionFilterAiApplyBasePatch({
          query,
          topN,
        }),
        () => {
          this.handleApplyFilters(true);
        },
      );
      return true;
    }

    const requestSeq = this._aiApplyRequestSeq + 1;
    this._aiApplyRequestSeq = requestSeq;
    this._aiLatestRequestSeq = requestSeq;
    if (auto) {
      this._aiAutoApplyInFlightSignature = applySignature;
    }

    this.setState(buildQuestionFilterAiApplyingPatch());

    try {
      const rankedIds = await rankQuestionsAI(query, candidateQuestions, Math.max(topN, candidateQuestions.length), {
        ...this.buildAiRequestOptions(),
        throwOnError: true,
      });
      if (!this._isMounted) return false;
      if (requestSeq !== this._aiLatestRequestSeq) return false;
      const normalizedRankedIds = normalizeAiIdList(rankedIds);
      this.setState(
        buildQuestionFilterAiApplySuccessPatch({
          applySignature,
          rankedQuestionIds: normalizedRankedIds,
          query,
          topN,
        }),
        () => {
          this.handleApplyFilters(true);
        },
      );
      return true;
    } catch (error: unknown) {
      questionFilterLog.error('Failed applying AI filter', { source, error });
      if (!this._isMounted) return false;
      if (requestSeq !== this._aiLatestRequestSeq) return false;
      this.setState(
        buildQuestionFilterAiApplyFailurePatch(
          getErrorMessage(error, 'AI filter request failed. Previous AI results were kept.'),
        ),
      );
      return false;
    } finally {
      if (auto && this._aiAutoApplyInFlightSignature === applySignature) {
        this._aiAutoApplyInFlightSignature = '';
      }
    }
  };

  handleApplyFilters(immediate = false): void {
    // Notify parent if filters are active/inactive
    const isFilterActive = !this.isFilterStateDefault(this.buildFilterState());
    this.emitFilterActivityChange(isFilterActive);

    const { mergedQuestions } = this.state;
    if (!mergedQuestions) return;

    const newSelectedTypes = this.state.pendingSelectedTypes;
    const newSortByImportance = this.state.pendingSortByImportance;
    const newShowTopQuestions = this.state.pendingShowTopQuestions;
    const newTopQuestionsCount = this.state.pendingTopQuestionsCount;
    const newAiSearchQuery = this.state.aiSearchQuery;
    const newAiAppliedTopN = this.state.aiAppliedTopN;
    const newAiFilterApplied = this.state.aiFilterApplied;
    const newAiCombineWithOtherFilters = this.state.aiCombineWithOtherFilters;
    const newAiRankedQuestionIds = normalizeAiIdList(this.state.aiRankedQuestionIds || []);
    const newPendingSbtFilteredQuestions = this.state.pendingSbtFilteredQuestions;
    const newShowTopQuestionsByResponses = this.state.pendingShowTopQuestionsByResponses;
    const newSelectedTags = this.state.selectedTags;
    const newFilterByResponded = this.state.filterByResponded;
    const newFilterByNotResponded = this.state.filterByNotResponded;

    const potentialFilterStateObj = {
      newSelectedTypes: [...newSelectedTypes].sort(),
      newSortByImportance,
      newShowTopQuestions,
      newTopQuestionsCount,
      newAiSearchQuery,
      newAiAppliedTopN,
      newAiFilterApplied,
      newAiCombineWithOtherFilters,
      newAiRankedSignature: stableSerializeSmallObject(newAiRankedQuestionIds, 8192),
      newPendingSbtFilteredQuestionsLength: newPendingSbtFilteredQuestions ? newPendingSbtFilteredQuestions.length : -1,
      newShowTopQuestionsByResponses,
      newSelectedTags: [...newSelectedTags].sort(),
      newFilterByResponded,
      newFilterByNotResponded,
    };
    const potentialFilterStateSignature = stableSerializeSmallObject(potentialFilterStateObj);

    if (
      this.state.lastAppliedFilterState &&
      this.state.lastAppliedFilterStateSignature === potentialFilterStateSignature
    ) {
      if (!immediate) return;
    }
    const pipelineResult = this.buildFilterPipelineResult(true);

    // Commit pending → live state and publish one shared pipeline result.
    this.setState(
      {
        lastAppliedFilterState: potentialFilterStateObj,
        lastAppliedFilterStateSignature: potentialFilterStateSignature,
        selectedTypes: newSelectedTypes,
        sortByImportance: newSortByImportance,
        showTopQuestions: newShowTopQuestions,
        topQuestionsCount: newTopQuestionsCount,
        aiSearchQuery: newAiSearchQuery,
        aiAppliedTopN: newAiAppliedTopN,
        aiFilterApplied: newAiFilterApplied,
        aiCombineWithOtherFilters: newAiCombineWithOtherFilters,
        aiRankedQuestionIds: newAiRankedQuestionIds,
        sbtFilteredQuestions: newPendingSbtFilteredQuestions,
        showTopQuestionsByResponses: newShowTopQuestionsByResponses,
        selectedTags: newSelectedTags,
        filteredQuestionsCount: pipelineResult.count,
      },
      () => {
        const filterStateForCallback = this.buildFilterState();
        this.emitFilterCallbacks(pipelineResult.finalQuestions, filterStateForCallback);
        const encCount = getEncryptedQuestionCount(pipelineResult.finalQuestions);
        this.emitCountUpdate(pipelineResult.count, encCount);
        this.checkIfCurrentFilterIsBookmarked();
      },
    );
  }

  buildFilterState(): QuestionFilterSerializableState {
    return buildQuestionFilterStateFromComponentState(this.state, DEFAULT_AI_TOP_N) as QuestionFilterSerializableState;
  }

  isFilterStateDefault = (filterStateToTest: unknown): boolean => {
    return isQuestionFilterStateDefault(filterStateToTest);
  };

  handleCopyFilterUrl = (): void => {
    const { currentViewModeForUrl, currentSurveyIdForUrl } = this.props;

    // Validate context props
    if (!currentViewModeForUrl || (currentViewModeForUrl !== 'questions' && currentViewModeForUrl !== 'survey')) {
      questionFilterLog.error(
        "Cannot construct filter URL: 'currentViewModeForUrl' prop is missing or invalid. Must be 'questions' or 'survey'. Received:",
        currentViewModeForUrl,
      );
      return;
    }
    if (currentViewModeForUrl === 'survey' && (!currentSurveyIdForUrl || typeof currentSurveyIdForUrl !== 'string')) {
      questionFilterLog.error(
        "Cannot construct filter URL: 'currentSurveyIdForUrl' prop is missing or invalid for 'survey' view mode. Received:",
        currentSurveyIdForUrl,
      );
      return;
    }

    const currentAppliedFilterState = this.buildFilterState();

    if (this.isFilterStateDefault(currentAppliedFilterState)) {
      questionFilterLog.log('No custom filter applied to copy URL.');
      return;
    }

    const serializedState = serializeFilterState(currentAppliedFilterState);
    if (!serializedState) {
      questionFilterLog.error('Failed to serialize non-default filter state.');
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('filter', serializedState);

    navigator.clipboard
      .writeText(url.toString())
      .then(() => {
        notify.success('Copied to clipboard');
        if (this.copySuccessTimeout) clearTimeout(this.copySuccessTimeout);
        this.setState(buildQuestionFilterCopyUrlSuccessPatch(true));
        this.copySuccessTimeout = setTimeout(() => {
          if (this._isMounted) {
            this.setState(buildQuestionFilterCopyUrlSuccessPatch(false));
          }
        }, 2000);
      })
      .catch((err: unknown) => {
        questionFilterLog.error('Failed to copy filter URL to clipboard:', err);
      });
  };

  toggleSection = (section: string): void => {
    this.setState((prevState: QuestionFilterStateRecord) => ({
      expandedSections: {
        ...prevState.expandedSections,
        [section]: !prevState.expandedSections[section],
      },
    }));
  };

  computeFilteredQuestionsCount() {
    const { mergedQuestions } = this.state;
    if (!mergedQuestions) {
      this.emitCountUpdate(0, 0);
      if (this.state.filteredQuestionsCount !== 0) {
        this.setState(buildQuestionFilterFilteredQuestionsCountPatch(0));
      }
      return;
    }

    const pipeResult = this.buildFilterPipelineResult(true);
    const encCount = getEncryptedQuestionCount(pipeResult.finalQuestions);
    this.emitCountUpdate(pipeResult.count, encCount);
    const { count: newLength } = pipeResult;
    if (this.state.filteredQuestionsCount !== newLength) {
      this.setState(buildQuestionFilterFilteredQuestionsCountPatch(newLength));
    }
  }

  handleTypeSelection = (type: unknown): void => {
    let newSelectedTypes: unknown[] = [...this.state.pendingSelectedTypes];
    if (newSelectedTypes.includes(type)) {
      newSelectedTypes = newSelectedTypes.filter((t) => t !== type);
    } else {
      newSelectedTypes.push(type);
    }
    this.setState(buildQuestionFilterPendingSelectedTypesPatch(newSelectedTypes), () => {
      this.handleApplyFilters(true);
      this.queueCombinedAiRefreshIfNeeded('type-filter-change');
    });
  };

  handleTagSelection = (tag: unknown): void => {
    const tagLower = String(tag).toLowerCase();
    // Store and compare tags in lowercase for case-insensitive matching
    let updatedTags: string[] = this.state.selectedTags.map((t: unknown) => String(t).toLowerCase());

    if (updatedTags.includes(tagLower)) {
      updatedTags = updatedTags.filter((t) => t !== tagLower);
    } else {
      updatedTags.push(tagLower);
    }

    this.setState(buildQuestionFilterSelectedTagsPatch(updatedTags), () => {
      // Re-apply filters live so counts/lists update immediately
      this.handleApplyFilters(true);
      this.queueCombinedAiRefreshIfNeeded('tag-filter-change');
    });
  };

  handleSortByImportance = (): void => {
    this.setState(
      (prevState: { pendingSortByImportance?: unknown }) => ({
        pendingSortByImportance: !prevState.pendingSortByImportance,
      }),
      () => {
        this.handleApplyFilters(true);
      },
    );
  };

  handleCancelFilters = (): void => {
    // Revert pending changes
    this.setState(
      {
        pendingSelectedTypes: this.state.selectedTypes,
        pendingSortByImportance: this.state.sortByImportance,
        pendingSbtFilteredQuestions: this.state.sbtFilteredQuestions,
        pendingShowTopQuestions: this.state.showTopQuestions,
        pendingTopQuestionsCount: this.state.topQuestionsCount,
        pendingShowTopQuestionsByResponses: this.state.showTopQuestionsByResponses,
        aiDraftQuery: this.state.aiSearchQuery,
        aiRankingCount: normalizePositiveInt(this.state.aiAppliedTopN, DEFAULT_AI_TOP_N),
        aiApplyError: '',
      },
      () => {
        if (!this.props.resultsMode) {
          this.props.toggleFilterModal();
        }
        // After reverting pending states, re-apply filters to reflect the actual current state
        this.handleApplyFilters(true);
      },
    );
  };

  toggleShowTopQuestions = (byResponses = false): void => {
    if (byResponses) {
      this.setState(
        (prev: { pendingShowTopQuestionsByResponses?: unknown }) => ({
          pendingShowTopQuestionsByResponses: !prev.pendingShowTopQuestionsByResponses,
          pendingShowTopQuestions: false, // Ensure the other top questions mode is off
        }),
        () => {
          this.handleApplyFilters(true);
        },
      );
    } else {
      // by importance
      this.setState(
        (prev: { pendingShowTopQuestions?: unknown }) => ({
          pendingShowTopQuestions: !prev.pendingShowTopQuestions,
          pendingShowTopQuestionsByResponses: false, // Ensure the other top questions mode is off
        }),
        () => {
          this.handleApplyFilters(true);
        },
      );
    }
  };

  handleTopQuestionsCountChange = (value: unknown): void => {
    this.setState(buildQuestionFilterTopQuestionsCountPatch(value, DEFAULT_TOP_QUESTIONS_COUNT), () => {
      if (this.state.pendingShowTopQuestions || this.state.pendingShowTopQuestionsByResponses) {
        this.handleApplyFilters(true);
      }
    });
  };

  handleRespondedToggle = (): void => {
    this.setState(
      (prev: { filterByResponded?: unknown }) => ({ filterByResponded: !prev.filterByResponded }),
      () => {
        this.handleApplyFilters(true);
        this.queueCombinedAiRefreshIfNeeded('response-status-filter-change');
      },
    );
  };

  handleNotRespondedToggle = (): void => {
    this.setState(
      (prev: { filterByNotResponded?: unknown }) => ({
        filterByNotResponded: !prev.filterByNotResponded,
      }),
      () => {
        this.handleApplyFilters(true);
        this.queueCombinedAiRefreshIfNeeded('response-status-filter-change');
      },
    );
  };

  handleClearFilters = (): void => {
    this.invalidatePendingAiApply();
    const defaultState = this.getDefaultFilterStatePatch();
    this.setState(defaultState, () => {
      this.handleApplyFilters(true);
    });
  };

  handleFilterUrlInputChange = (e: QuestionFilterRequiredValueEvent): void => {
    this.setState(buildQuestionFilterUrlInputPatch(e.target.value));
  };

  toggleLoadInput = (): void => {
    this.setState(buildQuestionFilterLoadInputTogglePatch(this.state));
  };

  handleLoadFilter = (): void => {
    let input = this.state.filterUrlInput.trim();
    if (!input) return;

    let filterString = input;

    // 1. Try to extract from full URL (query param style)
    try {
      if (input.includes('?')) {
        const urlObj = new URL(input, window.location.origin); // handle relative or absolute
        const params = new URLSearchParams(urlObj.search);
        if (params.has('filter')) {
          filterString = params.get('filter');
        }
      } else if (input.includes('/results/')) {
        // 2. Fallback for legacy path-style input (user pasting old link)
        const parts = input.split('/results/');
        if (parts.length > 1) {
          // take the part after results/, remove any query params that might follow
          filterString = parts[1].split('?')[0];
        }
      }
    } catch (e) {
      // If URL parsing fails, assume input is the string itself
    }

    try {
      const deserializedState = deserializeFilterStateStrict(filterString) as unknown as UnknownRecord;
      if (!deserializedState) {
        throw new Error('Invalid filter string.');
      }

      const selectedTypes = normalizeFilterSelectionList(deserializedState.questionTypes);
      const selectedTags = normalizeFilterSelectionList(deserializedState.selectedTags);
      const sbtFilterLocalState = normalizeSbtFilterLocalState(deserializedState.sbtFilter);
      const newState: QuestionFilterMutableStatePatch = {
        selectedTypes,
        pendingSelectedTypes: selectedTypes,
        selectedTags,
        sbtFilterLocalState,
      };
      // Map deserialized state to component's state structure
      if (deserializedState.responseStatus) {
        const responseStatus = toUnknownRecord(deserializedState.responseStatus);
        const responseStatusState = normalizeResponseStatusFilterState({
          filterByResponded: !!responseStatus.responded,
          filterByNotResponded: !!responseStatus.notResponded,
          account: this.props.account,
        });
        newState.filterByResponded = responseStatusState.filterByResponded;
        newState.filterByNotResponded = responseStatusState.filterByNotResponded;
      } else {
        newState.filterByResponded = false;
        newState.filterByNotResponded = false;
      }
      if (typeof deserializedState.aiFilter === 'string') {
        const aiQuery = deserializedState.aiFilter;
        const aiTopN = normalizePositiveInt(deserializedState.aiTopN, DEFAULT_AI_TOP_N);
        newState.aiSearchQuery = aiQuery;
        newState.aiDraftQuery = aiQuery;
        newState.aiRankingCount = aiTopN;
        newState.aiAppliedTopN = aiQuery.trim() ? aiTopN : null;
        newState.aiFilterApplied = false;
        newState.aiCombineWithOtherFilters = !!(aiQuery.trim() && deserializedState.aiCombine === true);
        newState.aiRankedQuestionIds = [];
        newState.aiApplyError = '';
      } else {
        newState.aiSearchQuery = '';
        newState.aiDraftQuery = '';
        newState.aiRankingCount = DEFAULT_AI_TOP_N;
        newState.aiAppliedTopN = null;
        newState.aiFilterApplied = false;
        newState.aiCombineWithOtherFilters = false;
        newState.aiRankedQuestionIds = [];
        newState.aiApplyError = '';
      }
      if (deserializedState.topQuestions && typeof deserializedState.topQuestions === 'object') {
        const { count, by } = toUnknownRecord(deserializedState.topQuestions);
        newState.topQuestionsCount = typeof count === 'number' ? count : DEFAULT_TOP_QUESTIONS_COUNT;
        newState.pendingTopQuestionsCount = typeof count === 'number' ? count : DEFAULT_TOP_QUESTIONS_COUNT;
        if (by === 'importance') {
          newState.showTopQuestions = true;
          newState.pendingShowTopQuestions = true;
          newState.sortByImportance = true;
          newState.pendingSortByImportance = true;
          newState.showTopQuestionsByResponses = false;
          newState.pendingShowTopQuestionsByResponses = false;
        } else if (by === 'responses') {
          newState.showTopQuestionsByResponses = true;
          newState.pendingShowTopQuestionsByResponses = true;
          newState.showTopQuestions = false;
          newState.pendingShowTopQuestions = false;
          newState.sortByImportance = false;
          newState.pendingSortByImportance = false;
        } else {
          newState.showTopQuestions = false;
          newState.pendingShowTopQuestions = false;
          newState.showTopQuestionsByResponses = false;
          newState.pendingShowTopQuestionsByResponses = false;
          newState.sortByImportance = false;
          newState.pendingSortByImportance = false;
        }
      } else {
        newState.topQuestionsCount = DEFAULT_TOP_QUESTIONS_COUNT;
        newState.pendingTopQuestionsCount = DEFAULT_TOP_QUESTIONS_COUNT;
        newState.showTopQuestions = false;
        newState.pendingShowTopQuestions = false;
        newState.showTopQuestionsByResponses = false;
        newState.pendingShowTopQuestionsByResponses = false;
        newState.sortByImportance = false;
        newState.pendingSortByImportance = false;
      }

      this.setState(newState, () => {
        this.handleApplyFilters(true);
        this.queueAutoApplyAiFilter('load-filter-input');
      });
    } catch (error) {
      questionFilterLog.error('Failed to load filter state:', error);
      alert('Could not load filter from the provided string. Please check the format.');
    }
  };

  toggleShowAllTags = (): void => {
    this.setState((prevState: { showAllTags?: unknown }) => ({ showAllTags: !prevState.showAllTags }));
  };

  // ----------------------------------------------------------------------------------
  // TAGS + FILTER SUMMARY
  // ----------------------------------------------------------------------------------
  getAllTagsWithCounts() {
    const { mergedQuestions } = this.state;

    if (!mergedQuestions || !Array.isArray(mergedQuestions)) return [];
    if (this._allTagsMemo.mergedQuestionsRef === mergedQuestions) {
      return this._allTagsMemo.tags;
    }

    // Aggregate tags case-insensitively to avoid duplicates like "RXC" vs "rxc"
    const tagCounts = new Map<string, number>();
    mergedQuestions.forEach((q: { tags?: unknown }) => {
      if (q.tags && Array.isArray(q.tags)) {
        q.tags.forEach((tag: unknown) => {
          const tagLower = String(tag).toLowerCase();
          tagCounts.set(tagLower, (tagCounts.get(tagLower) || 0) + 1);
        });
      }
    });
    const tags = Array.from(tagCounts.entries())
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([tagLower]) => tagLower);
    this._allTagsMemo = { mergedQuestionsRef: mergedQuestions, tags };
    return tags;
  }

  removeTypeFilter = (type: unknown): void => {
    const newPending = this.state.pendingSelectedTypes.filter((t: unknown) => t !== type);
    this.setState(buildQuestionFilterPendingSelectedTypesPatch(newPending), () => {
      this.handleApplyFilters(true);
      this.queueCombinedAiRefreshIfNeeded('type-filter-remove');
    });
  };

  removeTagFilter = (tag: unknown): void => {
    const newTags = this.state.selectedTags.filter((t: unknown) => t !== tag);
    this.setState(buildQuestionFilterSelectedTagsPatch(newTags), () => {
      this.handleApplyFilters(true);
      this.queueCombinedAiRefreshIfNeeded('tag-filter-remove');
    });
  };

  removeAiFilter = (): void => {
    this.invalidatePendingAiApply();
    this.setState(buildQuestionFilterRemoveAiPatch(), () => {
      this.handleApplyFilters(true);
    });
  };

  removeTopQuestionsFilter = (): void => {
    this.setState(buildQuestionFilterRemoveTopQuestionsPatch(), () => {
      this.handleApplyFilters(true);
    });
  };

  removeSBTFilterItem = (item: { role?: unknown; sbtAddress?: unknown }): void => {
    const updatedState = buildQuestionFilterSbtItemRemovalState(this.state.sbtFilterLocalState || {}, item);
    this.setState(buildQuestionFilterSbtLocalStatePatch(updatedState));
  };

  getFilterSummaryItems(): QuestionFilterSummaryItem[] {
    const items: QuestionFilterSummaryItem[] = [];
    const stateToUse = {
      // Use pending states for UI consistency where they exist
      showTopQuestions: this.state.pendingShowTopQuestions,
      topQuestionsCount: this.state.pendingTopQuestionsCount,
      showTopQuestionsByResponses: this.state.pendingShowTopQuestionsByResponses,
      selectedTypes: this.state.pendingSelectedTypes,
      selectedTags: this.state.selectedTags, // No pending version
      sbtFilterLocalState: this.state.sbtFilterLocalState, // No pending version
    };

    // 1) Show "Top X questions" if active
    if (stateToUse.showTopQuestions) {
      items.push({
        type: 'special',
        label: `Top ${stateToUse.topQuestionsCount} by importance`,
        onRemove: () => this.removeTopQuestionsFilter(),
      });
    }
    if (stateToUse.showTopQuestionsByResponses) {
      items.push({
        type: 'special',
        label: `Top ${stateToUse.topQuestionsCount} by # responses`,
        onRemove: () => this.removeTopQuestionsFilter(),
      });
    }

    // 2) Show question types
    (Array.isArray(stateToUse.selectedTypes) ? stateToUse.selectedTypes : []).forEach((t: unknown) => {
      items.push({
        type: 'questionType',
        label: `${t}`,
        onRemove: () => this.removeTypeFilter(t),
      });
    });

    // 3) Show tags
    (Array.isArray(stateToUse.selectedTags) ? stateToUse.selectedTags : []).forEach((tag: unknown) => {
      items.push({
        type: 'tag',
        label: `#${tag}`,
        onRemove: () => this.removeTagFilter(tag),
      });
    });

    if (this.state.aiFilterApplied && this.state.aiSearchQuery) {
      const topN = normalizePositiveInt(this.state.aiAppliedTopN, DEFAULT_AI_TOP_N);
      items.push({
        type: 'ai',
        label: `AI "${this.state.aiSearchQuery}" (Top ${topN}${this.state.aiCombineWithOtherFilters ? ', combined' : ''})`,
        onRemove: this.removeAiFilter,
      });
    }

    const hasConnectedAccount = toStr(this.props.account).trim() !== '';
    const bothResponseChecked = this.state.filterByResponded && this.state.filterByNotResponded;
    const isAiOverrideModeActive =
      !!this.state.aiFilterApplied &&
      toStr(this.state.aiSearchQuery).trim() !== '' &&
      !this.state.aiCombineWithOtherFilters;
    if (hasConnectedAccount && !isAiOverrideModeActive && this.state.filterByResponded && !bothResponseChecked) {
      items.push({
        type: 'responseStatus',
        label: 'Responded',
        onRemove: () => {
          this.setState(buildQuestionFilterRespondedStatusPatch(false), () => this.handleApplyFilters(true));
        },
      });
    }
    if (hasConnectedAccount && !isAiOverrideModeActive && this.state.filterByNotResponded && !bothResponseChecked) {
      items.push({
        type: 'responseStatus',
        label: 'Not responded',
        onRemove: () => {
          this.setState(buildQuestionFilterNotRespondedStatusPatch(false), () => this.handleApplyFilters(true));
        },
      });
    }

    // 4) SBT filter items
    const st = toUnknownRecord(stateToUse.sbtFilterLocalState) as QuestionFilterSbtSummaryState;
    // creator includes
    if (Array.isArray(st.selectedSBTGroupsCreator)) {
      st.selectedSBTGroupsCreator.forEach((obj) => {
        const entry = obj as QuestionFilterSbtSummaryEntry;
        items.push({
          type: 'sbt',
          label: `Creator+ ${entry.name || entry.address}`,
          onRemove: () =>
            this.removeSBTFilterItem({
              role: 'creatorInclude',
              sbtAddress: entry.address,
            }),
        });
      });
    }
    // creator excludes
    if (Array.isArray(st.excludedSBTGroupsCreator)) {
      st.excludedSBTGroupsCreator.forEach((obj) => {
        const entry = obj as QuestionFilterSbtSummaryEntry;
        items.push({
          type: 'sbt',
          label: `Creator- ${entry.name || entry.address}`,
          onRemove: () =>
            this.removeSBTFilterItem({
              role: 'creatorExclude',
              sbtAddress: entry.address,
            }),
        });
      });
    }
    // responder includes
    if (Array.isArray(st.selectedSBTGroupsResponder)) {
      st.selectedSBTGroupsResponder.forEach((obj) => {
        const entry = obj as QuestionFilterSbtSummaryEntry;
        items.push({
          type: 'sbt',
          label: `Responder+ ${entry.name || entry.address}`,
          onRemove: () =>
            this.removeSBTFilterItem({
              role: 'responderInclude',
              sbtAddress: entry.address,
            }),
        });
      });
    }
    // responder excludes
    if (Array.isArray(st.excludedSBTGroupsResponder)) {
      st.excludedSBTGroupsResponder.forEach((obj) => {
        const entry = obj as QuestionFilterSbtSummaryEntry;
        items.push({
          type: 'sbt',
          label: `Responder- ${entry.name || entry.address}`,
          onRemove: () =>
            this.removeSBTFilterItem({
              role: 'responderExclude',
              sbtAddress: entry.address,
            }),
        });
      });
    }
    // addresses mode includes
    if (Array.isArray(st.selectedSBTGroups)) {
      st.selectedSBTGroups.forEach((obj) => {
        const entry = obj as QuestionFilterSbtSummaryEntry;
        items.push({
          type: 'sbt',
          label: `Include: ${entry.name || entry.address}`,
          onRemove: () =>
            this.removeSBTFilterItem({
              role: 'include',
              sbtAddress: entry.address,
            }),
        });
      });
    }
    // addresses mode excludes
    if (Array.isArray(st.excludedSBTGroups)) {
      st.excludedSBTGroups.forEach((obj) => {
        const entry = obj as QuestionFilterSbtSummaryEntry;
        items.push({
          type: 'sbt',
          label: `Exclude: ${entry.name || entry.address}`,
          onRemove: () =>
            this.removeSBTFilterItem({
              role: 'exclude',
              sbtAddress: entry.address,
            }),
        });
      });
    }

    return items;
  }

  // ----------------------------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------------------------
  render() {
    const isInline = this.props.resultsMode;
    const {
      pendingSelectedTypes,
      aiDraftQuery,
      aiSearchQuery,
      aiRankingCount,
      aiCombineWithOtherFilters,
      aiApplying,
      aiApplyingElapsedSec,
      aiApplyError,
      filterLoading,
      sbtFilterLocalState,
      pendingShowTopQuestions,
      pendingShowTopQuestionsByResponses,
      pendingTopQuestionsCount,
      selectedTags,
      filteredQuestionsCount,
      showAllTags,
      filterUrlInput,
      showLoadInput,
    } = this.state;

    const isTopQuestionsModeActive =
      this.state.pendingShowTopQuestions || this.state.pendingShowTopQuestionsByResponses;
    const isAiOverrideModeActive =
      !!this.state.aiFilterApplied && String(aiSearchQuery || '').trim() !== '' && !aiCombineWithOtherFilters;
    const isOtherFiltersDisabled = isTopQuestionsModeActive || isAiOverrideModeActive;
    const otherFiltersDisabledReason = isTopQuestionsModeActive
      ? 'Disabled by “Top X questions” selection.'
      : 'Disabled by AI Top-N override. Enable “Combine with other filters” to intersect.';
    const aiAccessState = this.getAiAccessState();
    const sbtSessionContext = resolveEffectiveSessionContext(this.props);
    const sbtFilterSessionSlug = sbtSessionContext.sessionSlug || resolveEffectiveSlug(this.props);
    const sbtFilterSessionConfig = this.props.sessionConfig || sbtSessionContext.sessionConfig || {};
    const aiSectionDisabled = isTopQuestionsModeActive;
    const aiControlsDisabled = isTopQuestionsModeActive || !aiAccessState.enabled || aiApplying;
    const aiApplyButtonLabel = aiApplying ? `Applying... ${Math.max(0, Number(aiApplyingElapsedSec || 0))}s` : 'Apply';
    const pipelineForRender = this.buildFilterPipelineResult(false);
    const encryptedCount = getEncryptedQuestionCount(pipelineForRender.finalQuestions);
    const encryptedQuestionGateTooltip = this.getEncryptedQuestionGateTooltipProps();
    const renderEncryptedCountBadge = (marginLeft: string = '8px') => {
      if (encryptedCount <= 0) return null;
      return (
        <GateTooltip
          gateId={encryptedQuestionGateTooltip?.gateId}
          gateConfig={encryptedQuestionGateTooltip?.gateConfig}
          mode={encryptedQuestionGateTooltip?.mode}
          sbtAddresses={encryptedQuestionGateTooltip?.sbtAddresses}
        >
          <span style={resolveQuestionFilterEncryptedCountBadgeStyle(marginLeft)}>
            <FontAwesomeIcon icon={faLock} style={QUESTION_FILTER_ENCRYPTED_COUNT_LOCK_STYLE} />
            {encryptedCount}
          </span>
        </GateTooltip>
      );
    };

    // Gather summary items
    const summaryItems = this.getFilterSummaryItems();
    const hasConnectedAccount = toStr(this.props.account).trim() !== '';

    const allTags = this.getAllTagsWithCounts();
    const tagsToDisplay = showAllTags ? allTags : allTags.slice(0, 10);

    const activeAiTopN = normalizePositiveInt(this.state.aiAppliedTopN, DEFAULT_AI_TOP_N);
    const currentFilterStateForIcon = this.buildFilterState();
    const isCurrentFilterDefault = this.isFilterStateDefault(currentFilterStateForIcon);
    const expandedSections = this.state.expandedSections || {};

    const bodyContent = (
      <div>
        <QuestionFilterTopQuestionsSection
          expandedSections={expandedSections}
          pendingShowTopQuestions={pendingShowTopQuestions}
          pendingShowTopQuestionsByResponses={pendingShowTopQuestionsByResponses}
          pendingTopQuestionsCount={pendingTopQuestionsCount}
          onToggleSection={this.toggleSection}
          onToggleShowTopQuestions={this.toggleShowTopQuestions}
          onTopQuestionsCountChange={this.handleTopQuestionsCountChange}
        />

        <div className={buildQuestionFilterDisabledSectionClassName(styles, isOtherFiltersDisabled)}>
          <QuestionFilterTagsSection
            allTagsCount={allTags.length}
            disabled={isOtherFiltersDisabled}
            disabledReason={otherFiltersDisabledReason}
            expandedSections={expandedSections}
            onTagSelection={this.handleTagSelection}
            onToggleSection={this.toggleSection}
            onToggleShowAllTags={this.toggleShowAllTags}
            selectedTags={selectedTags}
            showAllTags={showAllTags}
            tagsToDisplay={tagsToDisplay}
            tooltipId={this._tagsTooltipId}
          />

          <QuestionFilterQuestionTypesSection
            disabled={isOtherFiltersDisabled}
            expandedSections={expandedSections}
            onToggleSection={this.toggleSection}
            onTypeSelection={this.handleTypeSelection}
            pendingSelectedTypes={pendingSelectedTypes}
          />

          <QuestionFilterResponseStatusSection
            disabled={isOtherFiltersDisabled}
            expandedSections={expandedSections}
            hasConnectedAccount={hasConnectedAccount}
            onRespondedToggle={this.handleRespondedToggle}
            onNotRespondedToggle={this.handleNotRespondedToggle}
            onToggleSection={this.toggleSection}
            filterByResponded={this.state.filterByResponded}
            filterByNotResponded={this.state.filterByNotResponded}
          />

          <QuestionFilterSbtSection
            creatorAndResponderMode={this.props.creatorAndResponderMode}
            defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
            disabled={isOtherFiltersDisabled}
            disabledReason={otherFiltersDisabledReason}
            ensureLightSbtUniverse={this.props.ensureLightSbtUniverse}
            expandedSections={expandedSections}
            isQuestionCacheReady={this.props.isQuestionCacheReady}
            isSBTCacheReady={this.props.isSBTCacheReady}
            isSurveyCacheReady={this.props.isSurveyCacheReady}
            items={this.state.mergedQuestions}
            network={this.props.network}
            onFilter={this.handleFilteredQuestions}
            onToggleSection={this.toggleSection}
            provider={this.props.provider}
            sbtCacheRevision={this.props.sbtCacheRevision}
            sbtFilterLocalState={sbtFilterLocalState}
            sessionConfig={sbtFilterSessionConfig}
            sessionSlug={sbtFilterSessionSlug}
            setFilterLoading={this.setFilterLoading}
          />

          <QuestionFilterAiSection
            activeAiTopN={activeAiTopN}
            aiAccessEnabled={aiAccessState.enabled}
            aiApplyButtonLabel={aiApplyButtonLabel}
            aiApplyError={aiApplyError}
            aiApplying={aiApplying}
            aiCombineWithOtherFilters={aiCombineWithOtherFilters}
            aiControlsDisabled={aiControlsDisabled}
            aiDraftQuery={aiDraftQuery}
            aiRankingCount={aiRankingCount}
            aiSearchQuery={aiSearchQuery}
            aiSectionDisabled={aiSectionDisabled}
            expandedSections={expandedSections}
            isAiFilterApplied={this.state.aiFilterApplied}
            isTopQuestionsModeActive={isTopQuestionsModeActive}
            onAiCombineWithFiltersChange={this.handleAiCombineWithFiltersChange}
            onAiDraftQueryChange={this.handleAiDraftQueryChange}
            onAiTopNChange={this.handleAiTopNChange}
            onApplyAiFilter={() => {
              void this.handleApplyAIFilter({ auto: false, source: 'manual-click' });
            }}
            onToggleSection={this.toggleSection}
          />
        </div>

        {filterLoading && (
          <div className={styles.loadingContainer}>
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            <p>Applying filter...</p>
          </div>
        )}
      </div>
    );

    const filterSummaryAndControlsJsx = (
      <QuestionFilterSummaryControls
        copiedUrlSuccess={this.state.copiedUrlSuccess}
        filterBookmarkedFeedback={this.state.filterBookmarkedFeedback}
        filterUrlInput={filterUrlInput}
        isCurrentFilterBookmarked={this.state.isCurrentFilterBookmarked}
        isDefault={isCurrentFilterDefault}
        onBookmarkCurrentFilter={this.handleBookmarkCurrentFilter}
        onClearFilters={this.handleClearFilters}
        onCopyFilterUrl={this.handleCopyFilterUrl}
        onFilterUrlInputChange={this.handleFilterUrlInputChange}
        onLoadFilter={this.handleLoadFilter}
        showLoadInput={showLoadInput}
        summaryItems={summaryItems}
      />
    );

    if (isInline) {
      // "resultsMode" => render inline, but hide if filterModalOpen is false
      return (
        <div style={resolveQuestionFilterInlineVisibilityStyle(this.props.filterModalOpen)}>
          <div className={styles.questionFilterInline} data-testid={E2E_TESTIDS.QUESTION_FILTER_MODAL}>
            {/* Count row with + icon to open load input */}
            <div className={styles.inlineCountRow}>
              <div className={styles.inlineCountText}>
                {!this.props.isQuestionCacheReady ? (
                  <FontAwesomeIcon icon={faSpinner} spin />
                ) : (
                  <>
                    {`${filteredQuestionsCount} question(s) match current filters`}
                    {renderEncryptedCountBadge('8px')}
                  </>
                )}
              </div>
              <FontAwesomeIcon
                icon={faPlus}
                className={styles.addIcon}
                title="Load a saved filter"
                onClick={this.toggleLoadInput}
              />
            </div>

            {summaryItems.length > 0 && filterSummaryAndControlsJsx}

            {bodyContent}
          </div>
        </div>
      );
    } else {
      // Normal "non-resultsMode," show a Modal
      return (
        <Modal
          isOpen={this.props.filterModalOpen}
          toggle={this.handleCancelFilters} // Use cancel to revert pending changes on close
          style={modalStyles}
        >
          <div data-testid={E2E_TESTIDS.QUESTION_FILTER_MODAL}>
            <ModalHeader toggle={this.handleCancelFilters} className={styles.modalHeader}>
              <div style={QUESTION_FILTER_MODAL_HEADER_ROW_STYLE}>
                <span style={QUESTION_FILTER_MODAL_TITLE_ROW_STYLE}>
                  <span>
                    Filter Questions (
                    {!this.props.isQuestionCacheReady ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                      filteredQuestionsCount
                    )}
                    {renderEncryptedCountBadge('6px')})
                  </span>
                  {/* Place + icon inline with the title to avoid overlaying the close X */}
                  <FontAwesomeIcon
                    icon={faPlus}
                    className={styles.addIcon}
                    title="Load a saved filter"
                    onClick={this.toggleLoadInput}
                  />
                </span>
              </div>
            </ModalHeader>
            <ModalBody className={styles.modalBody}>
              {summaryItems.length > 0 && filterSummaryAndControlsJsx}
              {/* In modal mode, also allow loading even if there are no current filters */}
              {showLoadInput && summaryItems.length === 0 && (
                <QuestionFilterLoadFilterControls
                  filterUrlInput={filterUrlInput}
                  onFilterUrlInputChange={this.handleFilterUrlInputChange}
                  onLoadFilter={this.handleLoadFilter}
                />
              )}
              {bodyContent}
            </ModalBody>
            <ModalFooter>
              <Button
                color="primary"
                onClick={() => {
                  // When "See Questions" is clicked, ensure filters are applied from pending state
                  // and then close the modal.
                  this.handleApplyFilters(false); // false means apply from pending and then update main state
                  this.props.toggleFilterModal();
                }}
              >
                See Questions
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      );
    }
  }
}

const mapStateToProps = (state: UnknownRecord = {}) => {
  const sessionState = toUnknownRecord(state.sessionState);
  const profile = toUnknownRecord(state.profile);
  const activeSessionSlug = sessionState.activeSessionSlug || '';
  return {
    activeSessionSlug,
    account: profile.account || '',
  };
};

export type QuestionFilterHandle = Pick<QuestionFilter, 'handleApplyFilters' | 'handleClearFilters'>;
export { QuestionFilter };
export default connect(mapStateToProps, null, null, { forwardRef: true })(QuestionFilter);
