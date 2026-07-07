/** @file SurveySelector.tsx */

import React, { Component } from 'react';
import {
  Button,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  FormGroup,
  Label,
  Input,
  Card,
  CardBody,
  FormText,
  InputGroup,
  InputGroupText,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';
import { Link } from 'react-router-dom';
import CETooltip from '../Shared/CETooltip';

// Styles
import '../../assets/css/contextEngine.scss';
import styles from './SurveyTool.module.scss';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookmark,
  faLock,
  faUnlock,
  faPlus,
  faMinus,
  faCaretDown,
  faCaretUp,
  faCheck,
  faTimes,
  faArrowLeft,
  faArrowRight,
  faSpinner,
  faExpand,
  faExternalLinkAlt,
  faFilter,
  faExclamationCircle,
  faCog,
  faMicrophone,
  faChevronLeft,
  faChevronRight,
  faComment,
  faQuestionCircle,
  faBullhorn,
  faRobot,
} from '@fortawesome/free-solid-svg-icons';

import AudioInput from '../Shared/AudioInput/AudioInput';
import QuestionFilter from './QuestionFilter';
import type { QuestionFilterHandle } from './QuestionFilter';
import PileHologramAssistant from './PileHologramAssistant';
import QuestionTagDropdown from './QuestionTagDropdown';
import SingleQuestionResponse from './SingleQuestionResponse';
import { JsonButtonRow, JsonIconButton, JsonPanel, JsonToggleButton } from '../Shared/Json/JsonControls';
import LazyFallback from '../Shared/LazyFallback';
import SessionChipSelector from '../Shared/SessionChipSelector';
import { getQuestionTagDisplayList } from '../../utilities/survey/questionTags.js';

// Crypto and contract utilities
import contractScripts, {
  getAllSessionSlugs,
  getSessionConfigBySlug as getStrictSessionConfigBySlug,
  getSessionSlugByName,
} from '../../utilities/web3/contractScripts.js';
import { ethers, utils } from 'ethers';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { serializeFilterState, deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { ENABLE_IMPORTANCE_SLIDER_TOGGLE } from '../../variables/appConfig.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { createLogger } from 'utilities/logging.js';
import { notify } from '../../utilities/ui/notify.js';
import { buildResponseGatePolicy } from '../../utilities/crypto/litGatePolicy.js';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import { buildSbtAccessControlConditions, resolveLitChain } from '../../utilities/crypto/litProtocol.js';
import {
  buildQuestionRoutePath,
  isMaskedQuestionPayload,
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
  pickBetterQuestionPayload,
  shouldRetryMaskedQuestionRefresh,
} from '../../utilities/survey/questionRouting.js';
import {
  normalizeSessionSlug,
  resolveSessionAliases,
  resolveSessionSlugFromPathname,
} from '../../utilities/session/sessionNaming.js';
import {
  resolveSurveyToolDecryptHydrationContext,
  resolveSurveyToolDraftSessionContext,
  resolveSurveyToolDraftStorageContext,
  resolveSurveyToolEffectiveSlug,
  resolveSurveyToolEnsureQuestionCachedContext,
  resolveSurveyToolExplicitSessionContext,
  resolveSurveyToolIdLookupContext,
  resolveSurveyToolLockAudienceSessionNameContext,
  resolveSurveyToolQuestionConfigContext,
  resolveSurveyToolQuestionCountContext,
  resolveSurveyToolQuestionPayloadCacheWriteContext,
  resolveSurveyToolQuestionsDashboardLoadContext,
  resolveSurveyToolPileFilterContext,
  resolveSurveyToolPileLoadContext,
  resolveSurveyToolPileWarmSeedContext,
  resolveSurveyToolPileResponseReadContext,
  resolveSurveyToolQuestionReadCacheContext,
  resolveSurveyToolQuestionBootstrapContext,
  resolveSurveyToolResponseJsonContext,
  resolveSurveyToolResponseHydrationContext,
  resolveSurveyToolResponseGateSessionContext,
  resolveSurveyToolSubmittedCacheWriteContext,
  resolveSurveyToolSurveyReadContext,
  resolveSurveyToolUpdateCacheContext,
} from './surveyToolSessionResolution.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import {
  listNamespaceEntriesSync,
  peekCacheSync,
  readCache,
  updateCacheAtomic,
  writeCache,
  writeCacheOptimistic,
} from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import {
  isTargetedSbtMetadataLookupEnabled,
  resolveSbtDisplayLabel,
  warmSbtDisplayNamesTargeted,
} from '../../utilities/sbt/sbtDisplayNames.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { normalizeRatingValue, RATING_MAX, RATING_MIN } from '../../utilities/survey/ratingValue.js';
import {
  areSurveySpecificQuestionsLoaded,
  buildQuestionsDashboardFilterLoadingPatch,
  buildQuestionsDashboardFilteredQuestionsPatch,
  buildQuestionsDashboardNoNetworkPatch,
  buildSurveySelectorCopySuccessPatch,
  buildSurveySelectorEmptySurveyListPatch,
  buildSurveySelectorFilterActivePatch,
  buildSurveySelectorFilterStatePatch,
  buildSurveySelectorLoadedSurveysPatch,
  buildSurveySelectorLoadingPatch,
  buildSurveySelectorPendingSubmitStatsPatch,
  buildSurveySelectorPubKeyPatch,
  buildSurveySelectorQuestionCountPatch,
  buildSurveySelectorSelectSurveyPatch,
  buildSurveySelectorSelectedTypesPatch,
  buildSurveySelectorShowLongLoadingPatch,
  buildSurveySelectorShowResultsPatch,
  buildSurveySelectorSubmittedSurveyList,
  buildSurveySelectorViewModePatch,
  getDefaultSurveySelectorPendingSubmitStats,
  getSurveyDocumentLinkTitle,
  getSurveyDocumentUrls,
  resolveSelectedSurveyIndex,
  resolveSurveyIdToCopy,
} from './surveySelectorHelpers.js';

import {
  EMPTY_QUESTION_POOL,
  DEBUG_PREFILL,
  GATE_SBT_HYDRATION_RETRY_MS,
  QUESTION_TAG_DROPDOWN_ROW_STYLE,
  SHOW_PILE_HOLOGRAM_TOGGLE,
  appendExplicitSessionHintToPath,
  applyExistingGroupPrefix,
  areEnvelopesEquivalent,
  areQuestionPayloadsEquivalent,
  buildQuestionCountScopeContextKey,
  buildQuestionDashboardLoadContextSignature,
  buildQuestionFilterStorageKeyPrefix,
  buildQuestionIdScopeSignature,
  buildQuestionScanProgressDisplay,
  buildRatingEnvelopeQidSetFromUserAnswers,
  buildRenderedIdsSignature,
  buildSliceToken,
  buildSurveyDraftSemanticSignature,
  buildSurveyResponseSliceSignature,
  canUseRecentQuestionPayloadForAccount,
  clampSliderValue,
  computeSubmitLabel,
  doesQuestionProgressMatchSlug,
  ensureQuestionsNet,
  ensureSurveysNet,
  formatQuestionScanBlockCount,
  getActiveSessionSlugFromProps,
  getBlockedQuestionIdsSet,
  getConvictionFromResponse,
  getConvictionFromSlice,
  getConvictionFromSliceStrict,
  dedupeQuestionReadSlugs,
  getExtraQuestionReadSlugs,
  getHighlightedQuestionIdsSet,
  getImportanceFromResponse,
  getImportanceFromSlice,
  getNormalizedUiRatingValue,
  getPendingStatsSnapshotFromState,
  getSessionSlugHintFromProps,
  getSessionSlugPinnedFromProps,
  hasCacheHydratedFlag,
  hasConvictionOrImportanceValueForQuestion,
  hasMeaningfulFieldValue,
  isIncomingResponseMetaNewer,
  isSingleSelectMultichoice,
  isSurveyToolFilterStateActive,
  mergeDecryptedViewedResponse,
  mergeQuestionResponses,
  mergeSurveyResponsePayloads,
  normalizeMultichoiceValue,
  normalizeQuestionIdKey,
  normalizeQuestionProgressSlug,
  normalizeSessionSlugValue,
  normalizeSurveyToolFilterState,
  readQuestionsCache,
  readQuestionsCacheAsync,
  readQuestionsCacheRef,
  readRecentQuestionPayload,
  readSurveysCache,
  readSurveysCacheAsync,
  readSurveysCacheRef,
  resolveCurrentTagSessionSlug,
  resolveDecryptHydrationContext,
  resolveDraftSessionContext,
  resolveDraftStorageContext,
  resolveEffectiveSlug,
  resolveEnsureQuestionCachedContext,
  resolveExplicitSessionContext,
  resolveLockAudienceSessionNameContext,
  resolvePileFilterContext,
  resolvePileLoadContext,
  resolvePileResponseReadContext,
  resolvePileWarmSeedContext,
  resolveQuestionBootstrapContext,
  resolveQuestionCountContext,
  resolveQuestionPayloadCacheWriteContext,
  resolveQuestionReadCacheContext,
  resolveQuestionsDashboardLoadContext,
  resolveResponseHydrationContext,
  resolveResponseJsonContext,
  resolveSlugForIds,
  resolveSubmittedCacheWriteContext,
  resolveSurveyReadContext,
  resolveUpdateCacheContext,
  scheduleMicrotask,
  serializeSurveyToolFilterState,
  shouldAutoEncryptAdditionalOnAudienceChange,
  shouldEncryptResponseFieldForSubmit,
  shouldForceOverwriteDraftValues,
  shouldRenderInlineSubmitButton,
  shouldRenderSubmittedIndicator,
  shouldShowPileFullLoadingState,
  shouldShowSingleQuestionResponseLookupSpinner,
  stampResponsePayloadWithMeta,
  surveyLog,
  toNumberOrNull,
  toResponseRecencyMeta,
  updateSubmittedSinceLastEdit,
  writeQuestionsCache,
  writeSurveysCache,
  bumpSurveyPerfCounter,
} from './surveyToolUtils';
import {
  appendMissingAuthoritativePoolQuestions,
  filterQuestionsByAuthoritativePool,
  resolveAuthoritativeQuestionPoolScope,
} from './surveyAuthoritativeQuestionPool';

export const SURVEY_SELECTOR_ACTIVE_FILTER_COLOR = '#11c4dcff';

export const SURVEY_SELECTOR_CREATE_BUTTON_STYLE: React.CSSProperties = {
  marginLeft: '10px',
};

export const SURVEY_SELECTOR_HEADER_SUBMIT_SPINNER_STYLE: React.CSSProperties = {
  marginLeft: 8,
};

export const LazyCreateQuestionsAndSurveys = React.lazy(() => import('./CreateQuestionsAndSurveys'));
export const LazySurveyResults = React.lazy(() => import('./SurveyResults'));

export const resolveSurveySelectorFilterButtonStyle = (isFilterActive: unknown): React.CSSProperties =>
  isFilterActive
    ? {
        color: SURVEY_SELECTOR_ACTIVE_FILTER_COLOR,
        borderColor: SURVEY_SELECTOR_ACTIVE_FILTER_COLOR,
      }
    : {};

export const resolveSurveySelectorFilterIconStyle = (isFilterActive: unknown): React.CSSProperties =>
  isFilterActive ? { color: SURVEY_SELECTOR_ACTIVE_FILTER_COLOR } : {};

export const buildSurveySelectorDropdownItemClassName = (
  styleMap: Record<string, string>,
  variant?: 'questions' | 'survey',
) => {
  const variantClassName =
    variant === 'questions' ? styleMap.questionsItem : variant === 'survey' ? styleMap.surveyItem : '';
  return [styleMap.dropdownItem, variantClassName].filter(Boolean).join(' ');
};

export const buildSurveySelectorHeaderSubmitButtonClassName = (styleMap: Record<string, string>) =>
  [styleMap.headerSubmitButton, styleMap.submitGlow].filter(Boolean).join(' ');

const buildSurveySelectorFilterUrl = ({
  pathname = '',
  search = '',
  hash = '',
  serializedState = '',
}: {
  pathname?: string;
  search?: string;
  hash?: string;
  serializedState?: string;
}): string => {
  const params = new URLSearchParams(String(search || ''));
  if (serializedState) {
    params.set('filter', serializedState);
  } else {
    params.delete('filter');
  }
  const query = params.toString();
  return `${String(pathname || '')}${query ? `?${query}` : ''}${String(hash || '')}`;
};

type SurveySelectorRecord = Record<string, unknown>;
type SurveySelectorNetworkLike = SurveySelectorRecord & {
  chainId?: unknown;
  id?: unknown;
};
type SurveySelectorLifecycleProps = SurveySelectorRecord & {
  activeSessionSlug?: unknown;
  autoOpenResults?: unknown;
  filterState?: unknown;
  isQuestionCacheReady?: unknown;
  isSurveyCacheReady?: unknown;
  network?: SurveySelectorNetworkLike | null;
  networkChainId?: unknown;
  questionResponsesNonce?: unknown;
  questionsCacheNonce?: unknown;
  sessionSlug?: unknown;
  sessionSlugPinned?: boolean;
  singleQuestionMode?: boolean;
  surveyID?: unknown;
  surveyId?: unknown;
};
type SurveySelectorToggleState = {
  createSurveyMode?: boolean;
  filterModalOpen?: boolean;
  selectorDropdownOpen?: boolean;
};
type SurveySelectorViewMode = 'questions' | 'survey';
type SurveySelectorQuestionCountContext = {
  slug: unknown;
  networkID: string;
  readSlugs: string[];
  contextKey: string;
};
type SurveySelectorQuestionCountCommitOptions = {
  propsIn?: SurveySelectorLifecycleProps;
  rememberStable?: boolean;
  ignoreTransientZero?: boolean;
};
type SurveySelectorDisplayedQuestionCountArgs = SurveySelectorQuestionCountCommitOptions & {
  loadingActive?: unknown;
  count?: unknown;
  encryptedCount?: unknown;
};
type SurveySelectorDisplayedQuestionCountResult = {
  count: number;
  encryptedCount: number;
};
type SurveySelectorQuestionCountStatePatch = Partial<{
  encryptedQuestionCount: number;
  filteredQuestionCount: number;
  filterState: unknown;
  showLongLoading: boolean;
  showResults: boolean;
  viewMode: SurveySelectorViewMode;
}>;
type SurveySelectorQuestionCacheRow = SurveySelectorRecord & {
  id?: unknown;
  prompt?: unknown;
};
type SurveySelectorQuestionsCacheByNet = Record<
  string,
  | {
      questions?: Record<string, SurveySelectorQuestionCacheRow | null | undefined>;
    }
  | null
  | undefined
>;
type SurveySelectorSurveyEntry = SurveySelectorRecord & {
  id?: unknown;
  surveyID?: unknown;
};
type SurveySelectorSurveySummary = SurveySelectorSurveyEntry & {
  documentURLs?: unknown;
  questionIDs?: unknown;
  title?: unknown;
};
type SurveySelectorSurveyState = SurveySelectorRecord & {
  selectedSurveyIndex?: number | null;
  surveys?: SurveySelectorSurveyEntry[];
};
type SurveySelectorPrimarySubmitTarget = {
  handlePrimarySubmitClick?: () => void;
  state?: {
    isSubmitting?: unknown;
  };
};
type SurveySelectorStoppableEvent = {
  stopPropagation: () => void;
};
type SurveySelectorRenderQuestionsCache = Record<
  string,
  | {
      questions?: Record<string, unknown>;
    }
  | null
  | undefined
> | null;
type SurveySelectorQuestionSelectorLabelArgs = {
  count?: number;
  encryptedCount?: number;
  encryptedCountTestId?: string;
  prefixLabel?: string;
  showCacheError?: boolean;
  showEncryptedCount?: boolean;
  showSpinner?: boolean;
};
type SurveySelectorEncryptedBadgeProps = {
  'data-ce-encrypted-question-count'?: string;
  'data-testid'?: string;
};
type QuestionsDashboardLifecycleProps = SurveySelectorRecord & {
  activeSessionSlug?: unknown;
  isQuestionCacheReady?: unknown;
  network?: SurveySelectorNetworkLike | null;
  questionResponsesNonce?: unknown;
  questionsCacheNonce?: unknown;
  sessionSlug?: unknown;
};
type QuestionsDashboardQuestionRow = SurveySelectorRecord & {
  creator?: unknown;
  id?: unknown;
  prompt?: unknown;
  sessionSlug?: unknown;
  tags?: unknown;
};
type QuestionsDashboardQuestionCacheByNet = Record<
  string,
  | {
      questionResponses?: Record<string, unknown>;
      questions?: Record<string, QuestionsDashboardQuestionRow>;
    }
  | null
  | undefined
>;
type QuestionsDashboardExtraSlugsMemo = {
  key: string;
  extraQuestions: QuestionsDashboardQuestionRow[];
  extraQuestionResponses: Record<string, unknown>;
};
type QuestionsDashboardLoadOptions = {
  resetFilteredQuestions?: boolean;
};
type QuestionsDashboardProgress = SurveySelectorRecord & {
  discoveredQuestions?: unknown;
  hydratedQuestions?: unknown;
  pendingMetadataCount?: unknown;
  phase?: unknown;
  slug?: unknown;
};
type SurveySelectorQuestionCountSnapshot = {
  hasValue: boolean;
  contextKey: string;
  count: number;
  encryptedCount: number;
};
type SurveyQuestionsComponentType =
  React.ComponentType<SurveySelectorRecord> | React.LazyExoticComponent<React.ComponentType<SurveySelectorRecord>>;
type SurveyQuestionsComponentHost = {
  SurveyQuestionsComponent?: SurveyQuestionsComponentType;
};

const getStaticSurveyQuestionsComponent = (instance: {
  constructor: unknown;
}): SurveyQuestionsComponentType | undefined =>
  (instance.constructor as SurveyQuestionsComponentHost).SurveyQuestionsComponent;

export class SurveySelector extends Component<any, any> {
  questionFilterRef: React.RefObject<QuestionFilterHandle>;
  surveyQuestionsRef: React.RefObject<unknown>;
  loadingTimeout: ReturnType<typeof setTimeout> | null;
  _copySurveyIdTimer: ReturnType<typeof setTimeout> | null;
  _renderQuestionsCacheMemoKey: string;
  _renderQuestionsCacheMemoValue: SurveySelectorRenderQuestionsCache;
  _isMounted: boolean;
  _questionCountStateContextKey: string;
  _stickyQuestionCountSnapshot: SurveySelectorQuestionCountSnapshot;
  _filterStateSig: string;
  _filteredQuestionCountEpoch: number = 0;
  _surveySelectorFetchEpoch: number = 0;
  _lastFetchSurveysSlug: string = '';
  _lastFetchSurveysNetId: string = '';
  _userSurveySelectionPending: boolean = false;

  constructor(props: SurveySelectorLifecycleProps) {
    super(props);
    this.state = {
      surveys: [],
      selectedSurveyIndex: null,
      pubKey: '',
      createSurveyMode: false,
      demoMode: false,
      showResults: this.props.autoOpenResults || false,
      loading: true,
      filterModalOpen: false,
      viewMode: 'questions',
      selectedTypes: [],
      filteredQuestionCount: 0,
      encryptedQuestionCount: 0,
      currentPath: window.location.pathname,
      filterState: normalizeSurveyToolFilterState(this.props.filterState),
      copySurveyIdSuccess: false,
      isFilterActive: isSurveyToolFilterStateActive(this.props.filterState),
      showLongLoading: false,
      selectorDropdownOpen: false,
      pendingSubmitStats: getDefaultSurveySelectorPendingSubmitStats(),
    };
    this.questionFilterRef = React.createRef();
    this.surveyQuestionsRef = React.createRef();
    this.loadingTimeout = null;
    this._copySurveyIdTimer = null;
    this._renderQuestionsCacheMemoKey = '';
    this._renderQuestionsCacheMemoValue = null;
    this._isMounted = false;
    this._questionCountStateContextKey = '';
    this._stickyQuestionCountSnapshot = {
      hasValue: false,
      contextKey: '',
      count: 0,
      encryptedCount: 0,
    };
    this._filterStateSig = serializeSurveyToolFilterState(this.state.filterState || {});
  }

  getQuestionCountContext = (
    propsIn: SurveySelectorLifecycleProps = this.props,
  ): SurveySelectorQuestionCountContext => {
    const slug = resolveEffectiveSlug(propsIn);
    const context = resolveQuestionCountContext(propsIn, slug);
    const networkID = context.networkIdStr || '';
    const readSlugs =
      Array.isArray(context.scopedSessionSlugs) && context.scopedSessionSlugs.length > 0
        ? context.scopedSessionSlugs
        : dedupeQuestionReadSlugs([slug, ...getExtraQuestionReadSlugs(propsIn, slug)]);
    return {
      slug,
      networkID,
      readSlugs,
      contextKey: buildQuestionCountScopeContextKey(readSlugs, networkID),
    };
  };

  clearStickyQuestionCountSnapshot: () => void = () => {
    this._questionCountStateContextKey = '';
    this._stickyQuestionCountSnapshot = {
      hasValue: false,
      contextKey: '',
      count: 0,
      encryptedCount: 0,
    };
  };

  commitQuestionCountState = (
    count: unknown,
    encryptedCount: unknown,
    {
      propsIn = this.props,
      rememberStable = true,
      ignoreTransientZero = false,
    }: SurveySelectorQuestionCountCommitOptions = {},
  ): boolean => {
    const numericCount = Math.max(0, Number(count || 0));
    const numericEncryptedCount = Number.isFinite(Number(encryptedCount)) ? Math.max(0, Number(encryptedCount)) : 0;
    const { contextKey } = this.getQuestionCountContext(propsIn);
    const liveContextMatches = this._questionCountStateContextKey === contextKey;

    if (ignoreTransientZero && numericCount === 0 && liveContextMatches && this.state.filteredQuestionCount > 0) {
      return false;
    }

    const snapshot = this._stickyQuestionCountSnapshot || {};
    const snapshotMatches =
      !!snapshot.hasValue &&
      snapshot.contextKey === contextKey &&
      snapshot.count === numericCount &&
      snapshot.encryptedCount === numericEncryptedCount;
    const liveCountsMatch =
      liveContextMatches &&
      numericCount === this.state.filteredQuestionCount &&
      numericEncryptedCount === this.state.encryptedQuestionCount;

    if (liveCountsMatch && (!rememberStable || snapshotMatches)) {
      return false;
    }

    this._questionCountStateContextKey = contextKey;
    if (rememberStable) {
      this._stickyQuestionCountSnapshot = {
        hasValue: true,
        contextKey,
        count: numericCount,
        encryptedCount: numericEncryptedCount,
      };
    }

    this.setState(buildSurveySelectorQuestionCountPatch(numericCount, numericEncryptedCount));
    return true;
  };

  getDisplayedQuestionCounts = ({
    loadingActive = false,
    count = this.state.filteredQuestionCount,
    encryptedCount = this.state.encryptedQuestionCount,
    propsIn = this.props,
  }: SurveySelectorDisplayedQuestionCountArgs = {}): SurveySelectorDisplayedQuestionCountResult => {
    const liveCount = Math.max(0, Number(count || 0));
    const liveEncryptedCount = Number.isFinite(Number(encryptedCount)) ? Math.max(0, Number(encryptedCount)) : 0;
    const { contextKey } = this.getQuestionCountContext(propsIn);
    const liveContextMatches = this._questionCountStateContextKey === contextKey;
    const snapshot = this._stickyQuestionCountSnapshot || null;
    const hasMatchingSnapshot = !!snapshot?.hasValue && snapshot.contextKey === contextKey;

    if (liveContextMatches) {
      if (!loadingActive || liveCount > 0 || liveEncryptedCount > 0) {
        return { count: liveCount, encryptedCount: liveEncryptedCount };
      }
      if (hasMatchingSnapshot) {
        return { count: snapshot.count, encryptedCount: snapshot.encryptedCount };
      }
      return { count: liveCount, encryptedCount: liveEncryptedCount };
    }

    if (loadingActive && hasMatchingSnapshot) {
      return { count: snapshot.count, encryptedCount: snapshot.encryptedCount };
    }

    return { count: 0, encryptedCount: 0 };
  };

  componentDidMount() {
    this._isMounted = true;
    if (!this.props.singleQuestionMode) {
      this.handleUrlBasedView();
      this.fetchSurveys();
      this.computeFilteredQuestionCount();
      window.addEventListener('popstate', this.handleUrlChange);
    }
    // Start long-loading timer
    this.loadingTimeout = setTimeout(() => {
      const path = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
      const isQuestionsPath = /^\/questions(\/|$)/.test(path);
      const requiredCacheReady = isQuestionsPath ? !!this.props.isQuestionCacheReady : !!this.props.isSurveyCacheReady;

      if (this.state.loading || !requiredCacheReady) {
        this.setState(buildSurveySelectorShowLongLoadingPatch(true));
      }
    }, 10000);
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (!this.props.singleQuestionMode) {
      window.removeEventListener('popstate', this.handleUrlChange);
    }
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    if (this._copySurveyIdTimer) {
      clearTimeout(this._copySurveyIdTimer);
      this._copySurveyIdTimer = null;
    }
  }

  componentDidUpdate(prevProps: SurveySelectorLifecycleProps, prevState: SurveySelectorRecord) {
    const prevQuestionCountContext = this.getQuestionCountContext(prevProps);
    const nextQuestionCountContext = this.getQuestionCountContext(this.props);
    const sessionChanged = prevQuestionCountContext.slug !== nextQuestionCountContext.slug;
    const networkChanged = prevQuestionCountContext.networkID !== nextQuestionCountContext.networkID;
    const surveyCacheReadyTick =
      prevProps.isSurveyCacheReady !== this.props.isSurveyCacheReady && this.props.isSurveyCacheReady;
    const questionCacheReadyTick =
      prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady && this.props.isQuestionCacheReady;
    const questionsNonceTick = prevProps.questionsCacheNonce !== this.props.questionsCacheNonce;
    const questionResponsesNonceTick = prevProps.questionResponsesNonce !== this.props.questionResponsesNonce;

    const shouldRefreshSurveyList = networkChanged || surveyCacheReadyTick || sessionChanged;
    const shouldRecomputeQuestionCount =
      shouldRefreshSurveyList || questionCacheReadyTick || questionsNonceTick || questionResponsesNonceTick;

    if (sessionChanged || networkChanged) {
      this.clearStickyQuestionCountSnapshot();
    }

    if (!this.props.singleQuestionMode && shouldRefreshSurveyList) {
      this.fetchSurveys();
    }
    if (!this.props.singleQuestionMode && shouldRecomputeQuestionCount) {
      this.computeFilteredQuestionCount();
    }

    const statePatch: SurveySelectorQuestionCountStatePatch = {};
    let hasStatePatch = false;

    if (this.props.autoOpenResults && !prevProps.autoOpenResults && !this.state.showResults) {
      statePatch.showResults = true;
      hasStatePatch = true;
    }
    const prevExternalFilterSig = serializeSurveyToolFilterState(normalizeSurveyToolFilterState(prevProps.filterState));
    const nextFilterState = normalizeSurveyToolFilterState(this.props.filterState);
    const nextFilterSig = serializeSurveyToolFilterState(nextFilterState);
    if (nextFilterSig !== prevExternalFilterSig && nextFilterSig !== this._filterStateSig) {
      this._filterStateSig = nextFilterSig;
      statePatch.filterState = nextFilterState;
      hasStatePatch = true;
    }

    if ((sessionChanged || networkChanged) && this.state.viewMode === 'questions') {
      statePatch.filteredQuestionCount = 0;
      statePatch.encryptedQuestionCount = 0;
      hasStatePatch = true;
    }

    // Clear long-loading if loaded
    if (this.state.showLongLoading) {
      const path = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
      const isQuestionsPath = /^\/questions(\/|$)/.test(path);
      const requiredCacheReady = isQuestionsPath ? !!this.props.isQuestionCacheReady : !!this.props.isSurveyCacheReady;

      if (!this.state.loading && requiredCacheReady) {
        statePatch.showLongLoading = false;
        hasStatePatch = true;
      }
    }

    if (hasStatePatch) {
      this.setState(statePatch);
    }
  }

  handleClearFilters = (e: SurveySelectorStoppableEvent): void => {
    e.stopPropagation();
    if (this.questionFilterRef.current) {
      this.questionFilterRef.current.handleClearFilters();
    }
  };

  computeFilteredQuestionCount: () => Promise<void> = async () => {
    // When in 'questions' mode, the QuestionFilter child component is active and
    // applying complex filters (tags, types, SBTs). It drives the count via callback.
    // We must NOT overwrite it with a basic total count here.
    if (this.state.viewMode === 'questions') return;
    const requestEpoch = Number(this._filteredQuestionCountEpoch || 0) + 1;
    this._filteredQuestionCountEpoch = requestEpoch;

    const { slug, networkID: netIdStr, contextKey, readSlugs } = this.getQuestionCountContext();
    const hadPositive =
      this._questionCountStateContextKey === contextKey && (this.state.filteredQuestionCount || 0) > 0;

    if (!netIdStr) {
      if (requestEpoch !== this._filteredQuestionCountEpoch) return;
      if (!hadPositive) {
        this.commitQuestionCountState(0, 0, { rememberStable: false });
      }
      return;
    }

    const scopedReadSlugs = dedupeQuestionReadSlugs(
      Array.isArray(readSlugs) && readSlugs.length > 0 ? readSlugs : [slug],
    );
    const seenQuestionIds = new Set<string>();
    let encryptedCount = 0;
    let nextCount = 0;

    for (const readSlug of scopedReadSlugs) {
      let localQuestionsCache: SurveySelectorQuestionsCacheByNet = {};
      try {
        localQuestionsCache = ensureQuestionsNet(
          await readQuestionsCacheAsync(readSlug),
          netIdStr,
        ) as SurveySelectorQuestionsCacheByNet;
      } catch (_error: unknown) {
        continue;
      }

      const networkCache = localQuestionsCache[netIdStr] || { questions: {} };
      const questionsData: Record<string, SurveySelectorQuestionCacheRow | null | undefined> =
        networkCache.questions || {};
      const BLOCKED_QUESTION_IDS_SET = getBlockedQuestionIdsSet(readSlug);
      for (const q of Object.values(questionsData)) {
        if (!q || !q.id) continue;
        const questionIdLower = String(q.id).toLowerCase();
        if (BLOCKED_QUESTION_IDS_SET.has(questionIdLower)) continue;
        if (seenQuestionIds.has(questionIdLower)) continue;
        seenQuestionIds.add(questionIdLower);
        nextCount += 1;
        if (String(q?.prompt || '').trim() === '[encrypted]') {
          encryptedCount += 1;
        }
      }
    }

    // Ignore a transient zero if we already had a positive count (prevents “Questions (0)” flash).
    if (nextCount === 0 && hadPositive) return;

    if (requestEpoch !== this._filteredQuestionCountEpoch) return;
    this.commitQuestionCountState(nextCount, encryptedCount, {
      rememberStable: true,
      ignoreTransientZero: true,
    });
  };

  handleUrlChange: () => void = () => {
    this.handleUrlBasedView();
  };

  handleUrlBasedView: () => void = () => {
    const path = window.location.pathname || '';
    const params = new URLSearchParams(window.location.search || '');
    const urlRequestsResults = params.get('results') === 'true';
    const isQuestions = /^\/questions(\/|$)/.test(path);
    const isSurveysList = path === '/surveys';
    const isValidSurveyRoute = /^\/survey\/(0x[0-9a-fA-F]{64})(?:\/.*)?$/.test(path);
    let nextViewMode: SurveySelectorViewMode | null = null;
    if (isQuestions) {
      nextViewMode = 'questions';
    } else if (isSurveysList || isValidSurveyRoute) {
      nextViewMode = 'survey';
    } else if (path.startsWith('/survey/')) {
      nextViewMode = 'questions';
    }
    const statePatch: SurveySelectorQuestionCountStatePatch = {};
    if (nextViewMode && nextViewMode !== this.state.viewMode) {
      statePatch.viewMode = nextViewMode;
    }
    if (nextViewMode !== null && urlRequestsResults && !this.state.showResults) {
      statePatch.showResults = true;
    }
    if (Object.keys(statePatch).length > 0) {
      this.setState(statePatch);
    }
  };

  handleFilteredQuestionsWithState = (_filteredQuestions: unknown, filterState: unknown): void => {
    const nextFilterState = normalizeSurveyToolFilterState(filterState);
    const serializedState = serializeSurveyToolFilterState(nextFilterState);
    if (serializedState !== this._filterStateSig) {
      this._filterStateSig = serializedState;
      this.setState(buildSurveySelectorFilterStatePatch(nextFilterState));
    }

    if (!this.props.preventUrlChange && typeof window !== 'undefined') {
      const newUrl = buildSurveySelectorFilterUrl({
        pathname: window.location.pathname || '',
        search: window.location.search || '',
        hash: window.location.hash || '',
        serializedState,
      });
      const currentUrl = `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;
      if (currentUrl !== newUrl) {
        window.history.replaceState({}, '', newUrl);
      }
    }
  };

  async fetchSurveys() {
    const requestEpoch = Number(this._surveySelectorFetchEpoch || 0) + 1;
    this._surveySelectorFetchEpoch = requestEpoch;
    if (!this.state.loading) {
      this.setState(buildSurveySelectorLoadingPatch(true));
    }

    // 1. Resolve Context
    const slug = resolveEffectiveSlug(this.props);
    const surveyReadContext = resolveSurveyReadContext(this.props, slug);
    const effectiveSlug = surveyReadContext.sessionSlug || slug;
    const netIdStr = surveyReadContext.networkIdStr;

    if (!netIdStr) {
      if (requestEpoch !== this._surveySelectorFetchEpoch) return;
      surveyLog.error('SurveySelector: Network ID is undefined in fetchSurveys.');
      this.setState(buildSurveySelectorEmptySurveyListPatch());
      return;
    }

    // 2. Read Caches (Pure Read - No Fetching)
    let surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
    // Read path only: avoid write-on-read feedback loops via questionsCacheNonce.
    if (requestEpoch !== this._surveySelectorFetchEpoch) return;

    const surveyBag = surveysCache?.[netIdStr]?.surveys || {};

    // 3. Build List from Cache
    const userSubmittedSurveys = buildSurveySelectorSubmittedSurveyList(surveyBag);

    // 4. Handle Cache Warmup State (Prevent flashing empty during transient re-fetches)
    // Keep previous list when re-fetch produces empty AND context (slug+network) hasn't changed.
    // This prevents unmounting SurveyQuestions during login-triggered cache re-reads.
    const shouldKeepExisting =
      userSubmittedSurveys.length === 0 &&
      this.state.surveys &&
      this.state.surveys.length > 0 &&
      this._lastFetchSurveysSlug === effectiveSlug &&
      this._lastFetchSurveysNetId === netIdStr;

    if (shouldKeepExisting) {
      if (requestEpoch !== this._surveySelectorFetchEpoch) return;
      this.setState(buildSurveySelectorLoadingPatch(false), this.updateSelectedSurvey);
      return;
    }

    if (requestEpoch !== this._surveySelectorFetchEpoch) return;
    // Track context unconditionally so session/network switches always clear stale data.
    this._lastFetchSurveysSlug = effectiveSlug;
    this._lastFetchSurveysNetId = netIdStr;
    this.setState(buildSurveySelectorLoadedSurveysPatch(userSubmittedSurveys), this.updateSelectedSurvey);
  }

  updateSelectedSurvey: () => void = () => {
    // Skip if user just clicked a survey and URL push hasn't fired yet
    if (this._userSurveySelectionPending) return;
    this.setState(
      (prevState: SurveySelectorSurveyState) => {
        const { surveys } = prevState;
        const path = window.location.pathname;
        return {
          selectedSurveyIndex: resolveSelectedSurveyIndex({
            surveys,
            path,
            surveyId: this.props.surveyId,
            previousSelectedSurveyIndex: prevState.selectedSurveyIndex,
          }),
        };
      },
      () => {
        const { selectedSurveyIndex } = this.state as SurveySelectorSurveyState;
        const surveys = Array.isArray(this.state.surveys) ? (this.state.surveys as SurveySelectorSurveyEntry[]) : [];
        const path = window.location.pathname;
        if (path === '/surveys' && surveys.length > 0 && selectedSurveyIndex === 0 && surveys[0] && surveys[0].id) {
          this.updateURL(surveys[0].id);
        }
      },
    );
  };

  /**
   * Select a survey (by index) and (normally) push a URL like /survey/:id.
   * When preventUrlChange is true, we only update component state.
   */
  selectSurvey = (selectedSurveyIndex: number): void => {
    const survey =
      this.state.surveys && this.state.surveys[selectedSurveyIndex] ? this.state.surveys[selectedSurveyIndex] : null;
    const sid = survey && (survey.id || survey.surveyID);

    // Guard: prevent updateSelectedSurvey from overriding this selection
    // before the URL push callback fires
    this._userSurveySelectionPending = true;

    this.setState(buildSurveySelectorSelectSurveyPatch(selectedSurveyIndex), () => {
      if (this.props.preventUrlChange) {
        this._userSurveySelectionPending = false;
        return;
      }
      const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
      let path = sid ? `/survey/${String(sid).toLowerCase()}` : '/surveys';
      if (sid && slug) path += `?session=${encodeURIComponent(slug)}`;
      window.history.pushState({}, '', applyExistingGroupPrefix(path));
      this._userSurveySelectionPending = false;
    });
  };

  updateURL = (surveyId: unknown): void => {
    const idL = String(surveyId).trim().toLowerCase();
    const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
    const query = slug ? `?session=${encodeURIComponent(slug)}` : '';
    if (this.props.displayAnswerMode && this.props.viewAddress) {
      window.history.pushState({}, '', `/survey/${idL}/${this.props.viewAddress}${query}`);
    } else {
      window.history.pushState({}, '', `/survey/${idL}${query}`);
    }
    if (this.props.onSurveyChange) {
      this.props.onSurveyChange(surveyId);
    }
  };

  /**
   * Switches between "questions" and "survey" views and (normally) updates the URL.
   * When preventUrlChange is true, we skip the pushState calls.
   */
  selectOption = (option: SurveySelectorViewMode): void => {
    this.setState(buildSurveySelectorViewModePatch(option), () => {
      if (this.props.preventUrlChange) return;

      let path = '/questions';
      if (option === 'survey') {
        const idx = this.state.selectedSurveyIndex;
        const current = idx != null && this.state.surveys && this.state.surveys[idx] ? this.state.surveys[idx] : null;
        const sid = current && (current.id || current.surveyID);
        const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
        path = sid
          ? `/survey/${String(sid).toLowerCase()}${slug ? `?session=${encodeURIComponent(slug)}` : ''}`
          : '/surveys';
      }
      window.history.pushState({}, '', applyExistingGroupPrefix(path));
    });
  };

  toggleFilterModal: () => void = () => {
    this.setState((prevState: SurveySelectorToggleState) => ({ filterModalOpen: !prevState.filterModalOpen }));
  };

  toggleCreateMode: () => void = () => {
    this.setState((prevState: SurveySelectorToggleState) => ({
      createSurveyMode: !prevState.createSurveyMode,
    }));
  };

  toggleShowResults: () => void = () => {
    const newShowResults = !this.state.showResults;
    const selectedSurvey =
      this.state.selectedSurveyIndex !== null && this.state.surveys[this.state.selectedSurveyIndex]
        ? this.state.surveys[this.state.selectedSurveyIndex]
        : null;
    const surveyIdForUrl = selectedSurvey ? selectedSurvey.id : null;

    if (newShowResults) {
      // Opening
      const serializedState = serializeSurveyToolFilterState(this.state.filterState);
      let path;
      if (this.state.viewMode === 'questions') {
        path = '/questions/results';
      } else if (this.state.viewMode === 'survey' && surveyIdForUrl) {
        const idL = String(surveyIdForUrl).trim().toLowerCase();
        path = `/survey/${idL}/results`;
      } else {
        path = (window.location.pathname || '').replace(/(\?.*)?$/, '');
        if (!path.endsWith('/results')) path += path.endsWith('/') ? 'results' : '/results';
      }

      if (serializedState) {
        path += `?filter=${serializedState}`;
      }
      const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
      path = appendExplicitSessionHintToPath(path, slug);
      path = applyExistingGroupPrefix(path);

      if (!this.props.preventUrlChange) {
        window.history.pushState({}, '', path);
      }
    } else {
      // Closing
      let basePath;
      if (this.state.viewMode === 'questions') {
        basePath = '/questions';
      } else if (this.state.viewMode === 'survey' && surveyIdForUrl) {
        const idL = String(surveyIdForUrl).trim().toLowerCase();
        const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
        basePath = `/survey/${idL}${slug ? `?session=${encodeURIComponent(slug)}` : ''}`;
      } else {
        basePath = (window.location.pathname || '').replace(/(\/results)?\/?(\?.*)?$/, '');
        if (!basePath) basePath = '/questions';
      }
      const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
      basePath = appendExplicitSessionHintToPath(basePath, slug);
      if (!this.props.preventUrlChange) {
        window.history.pushState({}, '', applyExistingGroupPrefix(basePath));
      }
    }
    this.setState(buildSurveySelectorShowResultsPatch(newShowResults));
  };

  closeShowResults: () => void = () => {
    if (!this.state.showResults) return;
    const selectedSurvey =
      this.state.selectedSurveyIndex !== null && this.state.surveys[this.state.selectedSurveyIndex]
        ? this.state.surveys[this.state.selectedSurveyIndex]
        : null;
    const surveyIdForUrl = selectedSurvey ? selectedSurvey.id : null;

    let basePath;
    if (this.state.viewMode === 'questions') {
      basePath = '/questions';
    } else if (this.state.viewMode === 'survey' && surveyIdForUrl) {
      const idL = String(surveyIdForUrl).trim().toLowerCase();
      const slug = normalizeSessionSlugValue(this.props.activeSessionSlug) || '';
      basePath = `/survey/${idL}${slug ? `?session=${encodeURIComponent(slug)}` : ''}`;
    } else {
      basePath = (window.location.pathname || '').replace(/(\/results)?\/?(\?.*)?$/, '');
      if (!basePath) basePath = '/questions';
    }
    const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
    basePath = appendExplicitSessionHintToPath(basePath, slug);
    if (!this.props.preventUrlChange) {
      window.history.pushState({}, '', applyExistingGroupPrefix(basePath));
    }
    this.setState(buildSurveySelectorShowResultsPatch(false));
  };

  handleHeaderSubmitClick: () => void = () => {
    const target = this.surveyQuestionsRef?.current as SurveySelectorPrimarySubmitTarget | null;
    if (!target || typeof target.handlePrimarySubmitClick !== 'function') return;
    if (target.state?.isSubmitting) return;
    target.handlePrimarySubmitClick();
  };

  handlePendingStatsChange = (stats: unknown): void => {
    if (!stats || typeof stats !== 'object') return;
    const patch = buildSurveySelectorPendingSubmitStatsPatch(stats);
    const { total, encrypted, submittedSinceLastEdit, isSubmitting } = patch.pendingSubmitStats;
    const prev = this.state.pendingSubmitStats || {};
    if (
      prev.total === total &&
      prev.encrypted === encrypted &&
      !!prev.submittedSinceLastEdit === submittedSinceLastEdit &&
      !!prev.isSubmitting === isSubmitting
    )
      return;
    this.setState(patch);
  };

  handleFilterChangeForUrl = (newFilterStateFromResults: unknown): void => {
    // Requirement: Internal Updates: Update local state WITHOUT modifying the URL.
    const nextFilterState = normalizeSurveyToolFilterState(newFilterStateFromResults);
    const nextFilterSig = serializeSurveyToolFilterState(nextFilterState);
    if (nextFilterSig === this._filterStateSig) return;
    this._filterStateSig = nextFilterSig;
    this.setState(buildSurveySelectorFilterStatePatch(nextFilterState));
  };

  handleFilteredQuestionCountUpdate = (count: unknown, encryptedCount: unknown): void => {
    // Keep UI stable while cache warms or if a transient 0 arrives.
    const hasFallbackQuestionPool = Array.isArray(this.props.questionPool) && this.props.questionPool.length > 0;
    if (!this.props.isQuestionCacheReady && !hasFallbackQuestionPool) return;
    this.commitQuestionCountState(count, encryptedCount, {
      rememberStable: true,
      ignoreTransientZero: true,
    });
  };

  handleFilterActivityChange = (isActive: unknown): void => {
    const nextActive = !!isActive;
    if (nextActive === !!this.state.isFilterActive) return;
    this.setState(buildSurveySelectorFilterActivePatch(nextActive));
  };

  toggleSelectorDropdown: () => void = () => {
    this.setState((prevState: SurveySelectorToggleState) => ({
      selectorDropdownOpen: !prevState.selectorDropdownOpen,
    }));
  };

  handlePubKeyUpdate = (pk: unknown): void => {
    if (pk === this.state.pubKey) return;
    this.setState(buildSurveySelectorPubKeyPatch(pk));
  };

  handleUpdateSelectedTypes = (selectedTypes: unknown): void => {
    this.setState(buildSurveySelectorSelectedTypesPatch(selectedTypes));
  };

  copySurveyIdToClipboard = (surveyID: unknown = null): void => {
    const { surveys, selectedSurveyIndex } = this.state;
    const idToCopy = resolveSurveyIdToCopy({
      surveyID,
      search: window.location.search,
      surveys,
      selectedSurveyIndex,
    });

    if (idToCopy) {
      navigator.clipboard
        .writeText(String(idToCopy))
        .then(() => {
          if (!this._isMounted) return;
          this.setState(buildSurveySelectorCopySuccessPatch(true));
          if (this._copySurveyIdTimer) {
            clearTimeout(this._copySurveyIdTimer);
          }
          this._copySurveyIdTimer = setTimeout(() => {
            if (!this._isMounted) return;
            this._copySurveyIdTimer = null;
            this.setState(buildSurveySelectorCopySuccessPatch(false));
          }, 2000);
        })
        .catch((err: unknown) => {
          surveyLog.error('Could not copy survey ID:', err);
        });
    } else {
      surveyLog.error('No survey ID available to copy.');
    }
  };

  getParsedQuestionsCacheForRender = (slug: unknown, networkID: unknown): SurveySelectorRenderQuestionsCache => {
    const nonce = Number(this.props.questionsCacheNonce || 0);
    const memoKey = `${String(slug || '')}|${String(networkID || '')}|${nonce}`;
    if (this._renderQuestionsCacheMemoKey === memoKey && this._renderQuestionsCacheMemoValue) {
      return this._renderQuestionsCacheMemoValue;
    }

    let parsedQuestionsCache: SurveySelectorRenderQuestionsCache = null;
    try {
      parsedQuestionsCache = readQuestionsCacheRef(String(slug || '')) || {};
    } catch (e: unknown) {
      surveyLog.warn('Could not parse questionsCache in SurveySelector render', e);
    }

    this._renderQuestionsCacheMemoKey = memoKey;
    this._renderQuestionsCacheMemoValue = parsedQuestionsCache;
    return parsedQuestionsCache;
  };

  // Helper function to check if all questions for a specific survey are loaded in cache
  areSurveySpecificQuestionsLoaded = (
    survey: SurveySelectorSurveySummary | null,
    networkId: unknown,
    parsedQuestionsCache: SurveySelectorRenderQuestionsCache,
  ): boolean => {
    return areSurveySpecificQuestionsLoaded(survey, networkId, parsedQuestionsCache);
  };

  getSurveyDocumentUrls = (survey: SurveySelectorSurveySummary | null = null): string[] =>
    getSurveyDocumentUrls(survey);

  getSurveyDocumentLinkTitle = (survey: SurveySelectorSurveySummary | null = null): string =>
    getSurveyDocumentLinkTitle(survey);

  renderQuestionSelectorLabel = ({
    prefixLabel = 'Questions',
    count = 0,
    encryptedCount = 0,
    showEncryptedCount = true,
    showSpinner = false,
    showCacheError = false,
    encryptedCountTestId = '',
  }: SurveySelectorQuestionSelectorLabelArgs = {}): React.ReactNode => {
    const encryptedBadgeProps: SurveySelectorEncryptedBadgeProps = {};
    if (showEncryptedCount && encryptedCountTestId) {
      encryptedBadgeProps['data-testid'] = encryptedCountTestId;
      encryptedBadgeProps['data-ce-encrypted-question-count'] = String(Math.max(0, Number(encryptedCount || 0)));
    }

    return (
      <span className={styles.questionSelectorSummary}>
        <span className={styles.questionSelectorPrimary}>
          <span>{prefixLabel}</span>
          <span className={styles.questionSelectorCount}>({count})</span>
        </span>
        {showEncryptedCount && encryptedCount > 0 && (
          <span className={styles.questionSelectorEncryptedBadge} {...encryptedBadgeProps}>
            <FontAwesomeIcon icon={faLock} className={styles.questionSelectorEncryptedIcon} />
            <span className={styles.questionSelectorEncryptedValue}>{encryptedCount}</span>
          </span>
        )}
        {showCacheError ? <span className={styles.questionSelectorMeta}>(cache error)</span> : null}
        {showSpinner ? (
          <span className={styles.questionSelectorSpinner}>
            <FontAwesomeIcon icon={faSpinner} spin />
          </span>
        ) : null}
      </span>
    );
  };

  render() {
    const {
      surveys,
      selectedSurveyIndex,
      loading,
      viewMode,
      createSurveyMode,
      filterModalOpen,
      filteredQuestionCount,
      encryptedQuestionCount,
      showResults,
      isFilterActive,
      showLongLoading,
      selectorDropdownOpen,
    } = this.state;
    const sessionConfig = this.props.sessionConfig || null;
    const activeSessionSlug = getActiveSessionSlugFromProps(this.props);
    const hasCacheError = !!this.props.cacheInitializationError;
    const SurveyQuestionsComponent = this.props.SurveyQuestionsComponent || getStaticSurveyQuestionsComponent(this);

    const selectedSurvey =
      selectedSurveyIndex !== null && surveys[selectedSurveyIndex] ? surveys[selectedSurveyIndex] : null;

    // Read from cache mirror once per render (group-aware)
    const { slug, networkID } = this.getQuestionCountContext();
    const parsedQuestionsCache = this.getParsedQuestionsCacheForRender(slug, networkID);
    const hasFallbackQuestionPool = Array.isArray(this.props.questionPool) && this.props.questionPool.length > 0;
    const questionSelectorLoading = (!this.props.isQuestionCacheReady && !hasFallbackQuestionPool) || loading;
    const questionSelectorCounts = this.getDisplayedQuestionCounts({
      loadingActive: questionSelectorLoading,
      count: filteredQuestionCount,
      encryptedCount: encryptedQuestionCount,
    });

    // Dropdown title
    let dropdownTitle;
    if (viewMode === 'questions') {
      // Spinner only reflects active loading. Errors are shown separately so we don't get stuck "loading" forever.
      if (hasCacheError) {
        dropdownTitle = this.renderQuestionSelectorLabel({
          count: questionSelectorCounts.count,
          encryptedCount: questionSelectorCounts.encryptedCount,
          showEncryptedCount: false,
          showCacheError: true,
        });
      } else if (questionSelectorLoading) {
        dropdownTitle = this.renderQuestionSelectorLabel({
          prefixLabel: 'Loading...',
          count: questionSelectorCounts.count,
          encryptedCount: questionSelectorCounts.encryptedCount,
          showEncryptedCount: false,
          showSpinner: true,
        });
      } else {
        dropdownTitle = this.renderQuestionSelectorLabel({
          count: questionSelectorCounts.count,
          encryptedCount: questionSelectorCounts.encryptedCount,
          showEncryptedCount: false,
        });
      }
    } else {
      const surveySpecificQuestionsLoaded = selectedSurvey
        ? this.areSurveySpecificQuestionsLoaded(selectedSurvey, networkID, parsedQuestionsCache)
        : true;

      if (selectedSurvey && !surveySpecificQuestionsLoaded) {
        dropdownTitle = (
          <span>
            {selectedSurvey.title} <FontAwesomeIcon icon={faSpinner} spin />
          </span>
        );
      } else if (loading || !this.props.isSurveyCacheReady) {
        // Show spinner if internal loading OR cache flags are not ready.
        dropdownTitle = (
          <span>
            {showLongLoading ? 'Loading... ' : 'Surveys '} <FontAwesomeIcon icon={faSpinner} spin />
          </span>
        );
      } else if (selectedSurvey) {
        const surveyDocumentURLs = this.getSurveyDocumentUrls(selectedSurvey);
        const hasDocUrls = surveyDocumentURLs.length > 0;
        dropdownTitle = (
          <span>
            {selectedSurvey.title}
            {hasDocUrls && (
              <a
                href={surveyDocumentURLs[0]}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e: SurveySelectorStoppableEvent) => e.stopPropagation()}
                className={styles.selectedSurveyDocLink}
                title={this.getSurveyDocumentLinkTitle(selectedSurvey)}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            )}
          </span>
        );
      } else if (this.props.surveyId && selectedSurveyIndex === null) {
        // If ID provided but not found yet (and not technically "loading" entire list), show explicit loading state
        dropdownTitle = (
          <span>
            Loading Survey... <FontAwesomeIcon icon={faSpinner} spin />
          </span>
        );
      } else if (surveys.length === 0) {
        // Only show "No surveys found" if we are NOT loading AND cache IS ready.
        dropdownTitle = 'No surveys found';
      } else {
        dropdownTitle = 'Select survey';
      }
    }

    const allowDropdownMenu = !loading && (this.props.isSurveyCacheReady || viewMode === 'questions');

    const createSurveyIcon = createSurveyMode ? faMinus : faPlus;
    const surveyForUrl =
      this.state.selectedSurveyIndex !== null && this.state.surveys[this.state.selectedSurveyIndex]
        ? this.state.surveys[this.state.selectedSurveyIndex].id
        : null;
    const pendingSubmitStats = this.state.pendingSubmitStats || getDefaultSurveySelectorPendingSubmitStats();
    const headerSubmitLabel = (this.props.computeSubmitLabel || computeSubmitLabel)({
      getPendingEditStats: () => pendingSubmitStats,
    });
    const showHeaderSubmitButton =
      !this.props.displayAnswerMode &&
      pendingSubmitStats.total > 0 &&
      !pendingSubmitStats.submittedSinceLastEdit &&
      (viewMode === 'questions' || !!selectedSurvey);

    const filterButtonStyle = resolveSurveySelectorFilterButtonStyle(isFilterActive);
    const filterIconStyle = resolveSurveySelectorFilterIconStyle(isFilterActive);
    const questionDashboardKey = this.getQuestionCountContext().contextKey;

    return (
      <div>
        <div id={styles.surveysRow}>
          <Dropdown id={styles.surveysDropdown} isOpen={selectorDropdownOpen} toggle={this.toggleSelectorDropdown}>
            <DropdownToggle
              id={styles.dropdownToggle}
              data-testid={viewMode === 'questions' ? E2E_TESTIDS.SURVEY_QUESTIONS_TOGGLE : undefined}
            >
              {dropdownTitle}
              {allowDropdownMenu && <FontAwesomeIcon icon={faCaretDown} id={styles.dropdownToggleCaret} />}
            </DropdownToggle>

            {allowDropdownMenu && (
              <DropdownMenu id={styles.dropdownMenu}>
                <DropdownItem
                  className={buildSurveySelectorDropdownItemClassName(styles, 'questions')}
                  onClick={() => this.selectOption('questions')}
                  active={viewMode === 'questions'}
                >
                  {this.renderQuestionSelectorLabel({
                    count: questionSelectorCounts.count,
                    encryptedCount: questionSelectorCounts.encryptedCount,
                    showEncryptedCount: selectorDropdownOpen,
                    showSpinner: questionSelectorLoading,
                    encryptedCountTestId: selectorDropdownOpen ? E2E_TESTIDS.SURVEY_QUESTIONS_ENCRYPTED_COUNT : '',
                  })}
                </DropdownItem>

                {this.props.isSurveyCacheReady ? (
                  <>
                    {surveys.map((survey: SurveySelectorSurveySummary, index: number) => {
                      const surveyQuestionsLoaded = this.areSurveySpecificQuestionsLoaded(
                        survey,
                        networkID,
                        parsedQuestionsCache,
                      );
                      const surveyDocumentURLs = this.getSurveyDocumentUrls(survey);
                      const hasDocUrls = surveyDocumentURLs.length > 0;
                      return (
                        <DropdownItem
                          className={buildSurveySelectorDropdownItemClassName(styles, 'survey')}
                          key={index}
                          onClick={() => this.selectSurvey(index)}
                          active={viewMode === 'survey' && selectedSurveyIndex === index}
                        >
                          <span className={styles.surveyItemRow}>
                            <span className={styles.surveyItemTitle}>{survey.title as React.ReactNode}</span>
                            <span className={styles.surveyItemMeta}>
                              {viewMode === 'survey' && selectedSurveyIndex === index && !surveyQuestionsLoaded && (
                                <FontAwesomeIcon icon={faSpinner} spin className={styles.surveyItemSpinner} />
                              )}
                              {hasDocUrls && (
                                <a
                                  href={surveyDocumentURLs[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.surveyItemDocLink}
                                  onClick={(e: SurveySelectorStoppableEvent) => e.stopPropagation()}
                                  title={this.getSurveyDocumentLinkTitle(survey)}
                                >
                                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                                </a>
                              )}
                            </span>
                          </span>
                        </DropdownItem>
                      );
                    })}

                    {surveys.length === 0 && viewMode === 'survey' && (
                      <DropdownItem disabled className={styles.dropdownItem}>
                        No surveys found in cache.
                      </DropdownItem>
                    )}
                  </>
                ) : (
                  <DropdownItem disabled className={styles.dropdownItem}>
                    Surveys are still loading...
                  </DropdownItem>
                )}
              </DropdownMenu>
            )}
          </Dropdown>

          {viewMode === 'questions' && (
            <Button
              id={styles.filterButton}
              data-testid={E2E_TESTIDS.SURVEY_FILTER_TOGGLE}
              onClick={this.toggleFilterModal}
              style={filterButtonStyle}
              aria-label="Filter questions"
              title="Filter questions"
            >
              <FontAwesomeIcon icon={faFilter} id={styles.filterIcon} style={filterIconStyle} />
              {isFilterActive && (
                <span id={styles.clearFilterIconSpan} onClick={this.handleClearFilters}>
                  <FontAwesomeIcon icon={faTimes} id={styles.clearFilterIcon} />
                </span>
              )}
            </Button>
          )}

          <Button onClick={this.toggleShowResults} id={styles.showResultsButton}>
            Results
          </Button>

          <button
            id={styles.createSurveyButton}
            data-testid={E2E_TESTIDS.SURVEY_CREATE_TOGGLE}
            onClick={this.toggleCreateMode}
            style={SURVEY_SELECTOR_CREATE_BUTTON_STYLE}
          >
            <FontAwesomeIcon icon={createSurveyIcon} />
          </button>

          {showHeaderSubmitButton && (
            <button
              type="button"
              className={buildSurveySelectorHeaderSubmitButtonClassName(styles)}
              onClick={this.handleHeaderSubmitClick}
              title="Submit responses"
              data-testid={E2E_TESTIDS.SURVEY_SUBMIT}
              disabled={!!pendingSubmitStats.isSubmitting}
            >
              {headerSubmitLabel}
              {pendingSubmitStats.isSubmitting && (
                <FontAwesomeIcon icon={faSpinner} spin style={SURVEY_SELECTOR_HEADER_SUBMIT_SPINNER_STYLE} />
              )}
            </button>
          )}
        </div>

        {/* Create survey */}
        {createSurveyMode && (
          <React.Suspense fallback={<LazyFallback label="Loading Question Authoring..." minHeight="160px" />}>
            <LazyCreateQuestionsAndSurveys
              {...this.props}
              toggleLoginModal={this.props.toggleLoginModal}
              expanded={createSurveyMode}
              surveys={surveys}
              surveyIndex={selectedSurveyIndex}
              cache={this.props.cache}
              updateCache={this.props.updateCache}
              sessionConfig={sessionConfig}
              sessionName={this.props.sessionName}
            />
          </React.Suspense>
        )}

        {/* Survey / questions views */}
        {viewMode !== 'questions' && selectedSurvey && SurveyQuestionsComponent && (
          <React.Suspense fallback={<LazyFallback label="Loading Questions..." minHeight="160px" />}>
            <SurveyQuestionsComponent
              ref={this.surveyQuestionsRef}
              useHeaderSubmit={true}
              onPendingStatsChange={this.handlePendingStatsChange}
              displayAnswerMode={this.props.displayAnswerMode}
              viewAddress={this.props.viewAddress}
              account={this.props.account}
              network={this.props.network}
              provider={this.props.provider}
              lit={this.props.lit}
              litHooks={this.props.litHooks}
              toggleLoginModal={this.props.toggleLoginModal}
              surveys={surveys}
              loginComplete={this.props.loginComplete}
              pubKey={this.state.pubKey}
              updatePubKey={this.handlePubKeyUpdate}
              surveyIndex={this.state.selectedSurveyIndex}
              surveyId={selectedSurvey.id}
              cache={this.props.cache}
              updateCache={this.props.updateCache}
              refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
              refreshQuestionMetadata={this.props.refreshQuestionMetadata}
              refreshQuestionResponses={this.props.refreshQuestionResponses}
              defaultTags={this.props.defaultTags}
              defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
              isQuestionCacheReady={this.props.isQuestionCacheReady}
              isResponsesCacheReady={this.props.isResponsesCacheReady}
              isSurveyCacheReady={this.props.isSurveyCacheReady}
              questionsCacheNonce={this.props.questionsCacheNonce}
              questionResponsesNonce={this.props.questionResponsesNonce}
              ensureQuestionCached={this.props.ensureQuestionCached}
              computeSubmitLabel={this.props.computeSubmitLabel}
              cacheInitializationError={this.props.cacheInitializationError}
              questionScanProgress={this.props.questionScanProgress}
              hideEmbeddedDebugUi={this.props.hideEmbeddedDebugUi}
              sessionSlug={this.props.sessionSlug}
              sessionConfig={sessionConfig}
              networkChainId={this.props.networkChainId}
            />
          </React.Suspense>
        )}

        {showResults && (
          <React.Suspense fallback={<LazyFallback label="Loading Results..." minHeight="160px" />}>
            <LazySurveyResults
              isOpen={showResults}
              onClose={this.closeShowResults}
              provider={this.props.provider}
              network={this.props.network}
              networkChainId={this.props.networkChainId}
              lit={this.props.lit}
              litHooks={this.props.litHooks}
              sbtCacheRevision={this.props.sbtCacheRevision}
              surveyId={viewMode === 'questions' ? null : selectedSurvey?.id}
              cache={this.props.cache}
              updateCache={this.props.updateCache}
              viewMode={viewMode}
              filterState={this.state.filterState}
              questionResponsesNonce={this.props.questionResponsesNonce}
              questionsCacheNonce={this.props.questionsCacheNonce}
              refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
              refreshQuestionMetadata={this.props.refreshQuestionMetadata}
              refreshQuestionResponses={this.props.refreshQuestionResponses}
              defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
              defaultTags={this.props.defaultTags}
              sessionInfo={this.props.sessionInfo}
              sessionName={this.props.sessionName}
              isQuestionCacheReady={this.props.isQuestionCacheReady}
              isResponsesCacheReady={this.props.isResponsesCacheReady}
              isSBTCacheReady={this.props.isSBTCacheReady}
              isSurveyCacheReady={this.props.isSurveyCacheReady}
              // Props for URL updates
              currentSurveyIdForUrl={surveyForUrl}
              currentViewModeForUrl={this.state.viewMode}
              onFilterStateChangeForUrlUpdate={this.handleFilterChangeForUrl}
              // Props for unified count
              filteredQuestionsCount={this.state.filteredQuestionCount}
              onCountUpdate={this.handleFilteredQuestionCountUpdate}
              onFilterChange={this.props.onFilterChange}
              preventUrlChange={this.props.preventUrlChange}
              sessionSlug={this.props.sessionSlug}
              activeSessionSlug={getActiveSessionSlugFromProps(this.props)}
              sessionConfig={this.props.sessionConfig}
              ensureLightSbtUniverse={this.props.ensureLightSbtUniverse}
              // Do not drop the pin at the results layer; otherwise /session pages
              // silently fan out to broader scan scope when opening results.
              sessionSlugPinned={this.props.sessionSlugPinned}
            />
          </React.Suspense>
        )}

        {viewMode === 'questions' && (
          <QuestionsDashboard
            key={questionDashboardKey}
            account={this.props.account}
            provider={this.props.provider}
            lit={this.props.lit}
            litHooks={this.props.litHooks}
            network={this.props.network}
            toggleLoginModal={this.props.toggleLoginModal}
            loginComplete={this.props.loginComplete}
            cache={this.props.cache}
            updateCache={this.props.updateCache}

            onFilteredQuestionCountUpdate={this.handleFilteredQuestionCountUpdate}

            filterModalOpen={filterModalOpen}
            toggleFilterModal={this.toggleFilterModal}
            handleFilteredQuestionsWithState={this.handleFilteredQuestionsWithState}
            pubKey={this.state.pubKey}
            updatePubKey={this.handlePubKeyUpdate}
            refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
            refreshQuestionMetadata={this.props.refreshQuestionMetadata}
            refreshQuestionResponses={this.props.refreshQuestionResponses}
            defaultTags={this.props.defaultTags}
            defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
            defaultFilterState={this.props.defaultFilterState}
            // Pass the active filter state down so QuestionFilter can sync
            filterState={this.state.filterState}
            questionsCacheNonce={this.props.questionsCacheNonce}
            questionResponsesNonce={this.props.questionResponsesNonce}
            questionPool={this.props.questionPool}
            isQuestionCacheReady={this.props.isQuestionCacheReady}
            isResponsesCacheReady={this.props.isResponsesCacheReady}
            isSurveyCacheReady={this.props.isSurveyCacheReady}
            isSBTCacheReady={this.props.isSBTCacheReady}
            // Ref and handler for clear button
            questionFilterRef={this.questionFilterRef}
            onFilterActivityChange={this.handleFilterActivityChange}
            sessionSlug={this.props.sessionSlug}
            activeSessionSlug={activeSessionSlug}
            sessionConfig={this.props.sessionConfig}
            ensureLightSbtUniverse={this.props.ensureLightSbtUniverse}
            ensureQuestionCached={this.props.ensureQuestionCached}
            computeSubmitLabel={this.props.computeSubmitLabel}
            cacheInitializationError={this.props.cacheInitializationError}
            onPendingStatsChange={this.handlePendingStatsChange}
            surveyQuestionsRef={this.surveyQuestionsRef}
            SurveyQuestionsComponent={this.props.SurveyQuestionsComponent}
            useHeaderSubmit={true}
            questionScanProgress={this.props.questionScanProgress}
            hideEmbeddedDebugUi={this.props.hideEmbeddedDebugUi}
          />
        )}
      </div>
    );
  }
}

export class QuestionsDashboard extends Component<any, any> {
  _lastLoadContextSignature: string;

  constructor(props: QuestionsDashboardLifecycleProps) {
    super(props);
    this.state = {
      questions: [],
      filteredQuestions: [],
      filterLoading: false,
      initialLoadComplete: false,
      questionResponses: {},
    };
    this._lastLoadContextSignature = '';
  }

  _lastExtraSlugsQuestionsMemo: QuestionsDashboardExtraSlugsMemo = {
    key: '',
    extraQuestions: [],
    extraQuestionResponses: {},
  };

  componentDidMount() {
    this.loadQuestions({ resetFilteredQuestions: true });
  }

  componentDidUpdate(prevProps: QuestionsDashboardLifecycleProps) {
    const sessionChanged =
      prevProps.activeSessionSlug !== this.props.activeSessionSlug || prevProps.sessionSlug !== this.props.sessionSlug;
    const networkChanged = prevProps.network?.id !== this.props.network?.id;
    const cacheReadyTick =
      prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady && this.props.isQuestionCacheReady;
    const nonceTick = prevProps.questionsCacheNonce !== this.props.questionsCacheNonce;
    const responsesNonceTick = prevProps.questionResponsesNonce !== this.props.questionResponsesNonce;
    const fallbackQuestionPoolChanged = prevProps.questionPool !== this.props.questionPool;
    const progressSlug = normalizeQuestionProgressSlug(resolveEffectiveSlug(this.props));
    const pickScopedQuestionProgress = (progressIn: unknown): QuestionsDashboardProgress | null => {
      if (!progressIn || typeof progressIn !== 'object') return null;
      const progress = progressIn as QuestionsDashboardProgress;
      if (!doesQuestionProgressMatchSlug(String(progress.slug || ''), progressSlug)) return null;
      return progress;
    };
    const prevQuestionProgress = pickScopedQuestionProgress(prevProps.questionScanProgress);
    const nextQuestionProgress = pickScopedQuestionProgress(this.props.questionScanProgress);
    const prevDiscoveredQuestions = Math.max(0, Number(prevQuestionProgress?.discoveredQuestions || 0));
    const nextDiscoveredQuestions = Math.max(0, Number(nextQuestionProgress?.discoveredQuestions || 0));
    const prevHydratedQuestions = Math.max(0, Number(prevQuestionProgress?.hydratedQuestions || 0));
    const nextHydratedQuestions = Math.max(0, Number(nextQuestionProgress?.hydratedQuestions || 0));
    const prevPendingMetadataCount = Math.max(0, Number(prevQuestionProgress?.pendingMetadataCount || 0));
    const nextPendingMetadataCount = Math.max(0, Number(nextQuestionProgress?.pendingMetadataCount || 0));
    const progressHydrationTick =
      (nextDiscoveredQuestions !== prevDiscoveredQuestions ||
        nextHydratedQuestions !== prevHydratedQuestions ||
        nextPendingMetadataCount !== prevPendingMetadataCount) &&
      (nextDiscoveredQuestions > 0 || nextHydratedQuestions > 0 || nextPendingMetadataCount > 0);
    const progressCompletedTick =
      prevQuestionProgress?.phase === 'hydrate' && nextQuestionProgress?.phase !== 'hydrate';
    if (
      sessionChanged ||
      networkChanged ||
      cacheReadyTick ||
      nonceTick ||
      responsesNonceTick ||
      fallbackQuestionPoolChanged ||
      progressHydrationTick ||
      progressCompletedTick
    ) {
      this.loadQuestions({
        resetFilteredQuestions: sessionChanged || networkChanged || fallbackQuestionPoolChanged,
      });
    }
  }

  applyDefaultTagsFilter = <T,>(list: T[] | unknown): T[] => {
    // Sessions handle scoping. Tags are for organization and user-driven filtering.
    return Array.isArray(list) ? list : [];
  };

  loadQuestions = ({ resetFilteredQuestions = false }: QuestionsDashboardLoadOptions = {}): void => {
    surveyLog.log('QuestionsDashboard: loadQuestions - Reading from cache mirror');
    const slug = resolveEffectiveSlug(this.props);
    const loadContext = resolveQuestionsDashboardLoadContext(this.props, slug);
    const effectiveSlug = loadContext.sessionSlug || slug;
    const netIdStr = loadContext.networkIdStr;
    const loadContextSignature = buildQuestionDashboardLoadContextSignature({
      effectiveSlug,
      scopedSessionSlugs: loadContext.scopedSessionSlugs as unknown[],
      networkID: netIdStr,
    });
    const contextChanged = this._lastLoadContextSignature !== loadContextSignature;
    this._lastLoadContextSignature = loadContextSignature;
    const shouldResetFilteredQuestions = resetFilteredQuestions || !this.state.initialLoadComplete || contextChanged;
    if (!netIdStr) {
      surveyLog.error('QuestionsDashboard: Network ID is undefined in loadQuestions.');
      this.setState(buildQuestionsDashboardNoNetworkPatch(shouldResetFilteredQuestions), () => {
        if (this.props.onFilteredQuestionCountUpdate && shouldResetFilteredQuestions) {
          this.props.onFilteredQuestionCountUpdate(0, 0);
        }
      });
      return;
    }

    let localQuestionsCache: QuestionsDashboardQuestionCacheByNet = {};
    try {
      localQuestionsCache = (readQuestionsCacheRef(effectiveSlug) as QuestionsDashboardQuestionCacheByNet) || {};
    } catch (e: unknown) {
      surveyLog.error('QuestionsDashboard: Error reading questionsCache from mirror:', e);
      localQuestionsCache = {};
    }

    const networkCache = localQuestionsCache?.[netIdStr] || { questions: {}, questionResponses: {} };
    const questionsData = (networkCache.questions || {}) as Record<string, QuestionsDashboardQuestionRow>;
    const questionResponses = mergeQuestionResponses({}, networkCache.questionResponses || {});
    let questions: QuestionsDashboardQuestionRow[] = Object.keys(questionsData).map((qId: string) => {
      const q = questionsData[qId];
      return {
        id: qId,
        creator: q?.creator || '',
        tags: q?.tags || [],
        ...(q || {}),
        sessionSlug: effectiveSlug,
      };
    });

    const seenQuestionIds = new Set<string>();
    const BLOCKED_QUESTION_IDS_SET = getBlockedQuestionIdsSet(effectiveSlug);
    questions = questions.filter((q: QuestionsDashboardQuestionRow) => {
      if (!q || !q.id) return false;
      const questionIdLower = String(q.id).toLowerCase();
      if (BLOCKED_QUESTION_IDS_SET.has(questionIdLower)) return false;
      if (seenQuestionIds.has(questionIdLower)) return false;
      seenQuestionIds.add(questionIdLower);
      return true;
    });

    const extraSlugs =
      Array.isArray(loadContext.scopedSessionSlugs) && loadContext.scopedSessionSlugs.length > 0
        ? loadContext.scopedSessionSlugs.filter(
            (extraSlug: unknown) => normalizeSessionSlugValue(extraSlug) !== normalizeSessionSlugValue(effectiveSlug),
          )
        : getExtraQuestionReadSlugs(this.props, effectiveSlug);

    const extraSlugsMemoKey =
      extraSlugs.length > 0
        ? [...extraSlugs].sort().join(',') +
          '|' +
          netIdStr +
          '|' +
          String(this.props.questionsCacheNonce || 0) +
          '|' +
          String(this.props.questionResponsesNonce || 0) +
          '|' +
          String(this.props.sbtCacheRevision || 0)
        : '';

    let extraQuestions: QuestionsDashboardQuestionRow[] = [];
    let extraQuestionResponses: Record<string, unknown> = {};
    if (extraSlugsMemoKey && this._lastExtraSlugsQuestionsMemo.key === extraSlugsMemoKey) {
      extraQuestions = this._lastExtraSlugsQuestionsMemo.extraQuestions;
      extraQuestionResponses = this._lastExtraSlugsQuestionsMemo.extraQuestionResponses || {};
    } else if (extraSlugs.length > 0) {
      const extraDedup = new Set<string>();
      const nextExtraQuestionResponses: Record<string, unknown> = {};
      for (const extraSlug of extraSlugs) {
        let extraQuestionsCache: QuestionsDashboardQuestionCacheByNet = {};
        try {
          extraQuestionsCache =
            (readQuestionsCacheRef(String(extraSlug || '')) as QuestionsDashboardQuestionCacheByNet) || {};
        } catch (e: unknown) {
          surveyLog.error(
            'QuestionsDashboard: Error reading questionsCache from mirror for slug "' + extraSlug + '":',
            e,
          );
          extraQuestionsCache = {};
        }
        const extraNetworkCache = extraQuestionsCache?.[netIdStr] || { questions: {}, questionResponses: {} };
        const extraQuestionsData = (extraNetworkCache.questions || {}) as Record<string, QuestionsDashboardQuestionRow>;
        mergeQuestionResponses(nextExtraQuestionResponses, extraNetworkCache.questionResponses || {});
        const BLOCKED_EXTRA_QUESTION_IDS_SET = getBlockedQuestionIdsSet(extraSlug);
        Object.keys(extraQuestionsData).forEach((qId: string) => {
          const q = extraQuestionsData[qId];
          const questionIdRaw = q && q.id != null && String(q.id) !== '' ? q.id : qId;
          if (!questionIdRaw) return;
          const questionIdLower = String(questionIdRaw).toLowerCase();
          if (BLOCKED_EXTRA_QUESTION_IDS_SET.has(questionIdLower)) return;
          if (extraDedup.has(questionIdLower)) return;
          extraDedup.add(questionIdLower);
          extraQuestions.push({
            id: questionIdRaw,
            creator: q?.creator || '',
            tags: q?.tags || [],
            ...(q || {}),
            sessionSlug: extraSlug,
          });
        });
      }
      extraQuestionResponses = nextExtraQuestionResponses;
      this._lastExtraSlugsQuestionsMemo = { key: extraSlugsMemoKey, extraQuestions, extraQuestionResponses };
    }
    for (const eq of extraQuestions) {
      const eqIdLower = String(eq.id).toLowerCase();
      if (!seenQuestionIds.has(eqIdLower)) {
        seenQuestionIds.add(eqIdLower);
        questions.push(eq);
      }
    }
    mergeQuestionResponses(questionResponses, extraQuestionResponses);

    const authoritativeQuestionPoolScope = resolveAuthoritativeQuestionPoolScope(
      this.props.questionPool,
      effectiveSlug,
    );
    if (authoritativeQuestionPoolScope) {
      questions = filterQuestionsByAuthoritativePool(questions, authoritativeQuestionPoolScope);
      questions = appendMissingAuthoritativePoolQuestions(
        questions,
        authoritativeQuestionPoolScope,
        BLOCKED_QUESTION_IDS_SET,
      );
    } else if (questions.length === 0 && Array.isArray(this.props.questionPool)) {
      this.props.questionPool.forEach((entry: QuestionsDashboardQuestionRow) => {
        const questionIdRaw = entry && entry.id != null && String(entry.id) !== '' ? entry.id : null;
        if (!questionIdRaw) return;
        const questionIdLower = String(questionIdRaw).toLowerCase();
        if (BLOCKED_QUESTION_IDS_SET.has(questionIdLower)) return;
        if (seenQuestionIds.has(questionIdLower)) return;
        seenQuestionIds.add(questionIdLower);
        questions.push({
          creator: '',
          tags: [],
          ...entry,
          id: questionIdRaw,
          sessionSlug: effectiveSlug,
        });
      });
    }

    questions = this.applyDefaultTagsFilter(questions);
    const encryptedQuestionCount = questions.filter(
      (question: QuestionsDashboardQuestionRow) => String(question?.prompt || '').trim() === '[encrypted]',
    ).length;
    const nextState: Record<string, unknown> = {
      questions,
      initialLoadComplete: true,
      questionResponses,
    };
    if (shouldResetFilteredQuestions) {
      nextState.filteredQuestions = questions;
    }
    this.setState(nextState, () => {
      if (this.props.onFilteredQuestionCountUpdate && shouldResetFilteredQuestions) {
        this.props.onFilteredQuestionCountUpdate(questions.length, encryptedQuestionCount);
      }
    });
  };

  handleFilteredQuestions = (filteredQuestions: unknown, filterState: unknown): void => {
    const next = this.applyDefaultTagsFilter(filteredQuestions);

    this.setState(buildQuestionsDashboardFilteredQuestionsPatch(next), () => {
      if (this.props.handleFilteredQuestionsWithState) {
        this.props.handleFilteredQuestionsWithState(next, filterState);
      }
    });
  };

  setFilterLoading = (loading: unknown): void => {
    this.setState(buildQuestionsDashboardFilterLoadingPatch(loading));
  };

  render() {
    const { filteredQuestions, filterLoading } = this.state;
    const SurveyQuestionsComponent = this.props.SurveyQuestionsComponent || getStaticSurveyQuestionsComponent(this);

    return (
      <div className={styles.questionsDashboard}>
        <div className={styles.questionsHeader}></div>

        <QuestionFilter
          ref={this.props.questionFilterRef}
          onFilterActivityChange={this.props.onFilterActivityChange}
          filterModalOpen={this.props.filterModalOpen}
          toggleFilterModal={this.props.toggleFilterModal}
          questions={this.state.questions}
          questionResponses={this.state.questionResponses}
          provider={this.props.provider}
          network={this.props.network}
          onFilter={this.handleFilteredQuestions}
          onCountUpdate={this.props.onFilteredQuestionCountUpdate}
          setFilterLoading={this.setFilterLoading}
          defaultFilterState={this.props.defaultFilterState}
          // Pass the active filterState so the component can initialize correctly from URL
          filterState={this.props.filterState}
          defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
          activeSessionSlug={getActiveSessionSlugFromProps(this.props)}
          sessionSlug={this.props.sessionSlug}
          sessionConfig={this.props.sessionConfig}
          ensureLightSbtUniverse={this.props.ensureLightSbtUniverse}
          isQuestionCacheReady={this.props.isQuestionCacheReady}
          isSurveyCacheReady={this.props.isSurveyCacheReady}
          isSBTCacheReady={this.props.isSBTCacheReady}
          currentViewModeForUrl={'questions'}
          currentSurveyIdForUrl={null}
          questionResponsesNonce={this.props.questionResponsesNonce}
          questionsCacheNonce={this.props.questionsCacheNonce}
          defaultTags={this.props.defaultTags}
          /* Ensure per-group storage for filter prefs */
          storageKeyPrefix={buildQuestionFilterStorageKeyPrefix(this.props, resolveEffectiveSlug(this.props))}
        />

        {filterLoading ? (
          <div className={styles.loadingContainer}>
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            <p>Applying filter...</p>
          </div>
        ) : SurveyQuestionsComponent ? (
          <React.Suspense fallback={<LazyFallback label="Loading Questions..." minHeight="160px" />}>
            <SurveyQuestionsComponent
              ref={this.props.surveyQuestionsRef}
              account={this.props.account}
              provider={this.props.provider}
              lit={this.props.lit}
              litHooks={this.props.litHooks}
              toggleLoginModal={this.props.toggleLoginModal}
              loginComplete={this.props.loginComplete}
              cache={this.props.cache}
              updateCache={this.props.updateCache}
              questionPool={filteredQuestions}
              isStandalone={true}
              useHeaderSubmit={this.props.useHeaderSubmit}
              pubKey={this.props.pubKey}
              updatePubKey={this.props.updatePubKey}
              network={this.props.network}
              activeSessionSlug={getActiveSessionSlugFromProps(this.props)}
              sessionSlug={this.props.sessionSlug}
              refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
              refreshQuestionMetadata={this.props.refreshQuestionMetadata}
              refreshQuestionResponses={this.props.refreshQuestionResponses}
              defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
              isQuestionCacheReady={this.props.isQuestionCacheReady}
              isResponsesCacheReady={this.props.isResponsesCacheReady}
              isSurveyCacheReady={this.props.isSurveyCacheReady}
              isSBTCacheReady={this.props.isSBTCacheReady}
              ensureQuestionCached={this.props.ensureQuestionCached}
              computeSubmitLabel={this.props.computeSubmitLabel}
              onPendingStatsChange={this.props.onPendingStatsChange}
              questionScanProgress={this.props.questionScanProgress}
              hideEmbeddedDebugUi={this.props.hideEmbeddedDebugUi}
            />
          </React.Suspense>
        ) : null}
      </div>
    );
  }
}
