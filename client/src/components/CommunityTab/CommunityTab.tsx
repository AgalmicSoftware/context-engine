/** @file CommunityTab.tsx */
import { Component } from 'react';
import { connect } from 'react-redux';
import type { RootState } from '../../reducers';
import { updateGlobalSessionSelection } from '../../actions/sessionStateActions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faVoteYea,
  faSpinner,
  faScroll,
  faUsersCog,
  faChevronDown,
  faChevronUp,
  faExclamationTriangle,
  faCog,
  faLayerGroup,
  faFilter,
} from '@fortawesome/free-solid-svg-icons';
import styles from './CommunityTab.module.scss';
import { renderCommunitySessionFilters } from './renderCommunitySessionFilters';
import SessionTestEthBadge from '../Shared/SessionTestEthBadge';
import historicalFigures from '../../variables/demo/historical_figure_users.json';
import { Modal, ModalHeader, ModalBody, Collapse } from 'reactstrap';
import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';
import { canonicalizeSessionSlug as normalizeSessionSlug } from '../../utilities/session/sessionSlug.js';
import contractScripts, {
  getAllSessionSlugs,
  getSessionConfigBySlug,
  getDemoSessionConfigBySlug,
  getSessionChainId,
  getSessionLists,
} from '../../utilities/web3/chainGateway.js';
import SBTsList from '../SBTs/SBTsList';
import SBTFilter from '../SBTs/SBTFilter';
import BeeswarmPlot from '../Shared/BeeswarmPlot/BeeswarmPlot';
import CETooltip from '../Shared/CETooltip';
import GlobalSessionSelector from '../Shared/GlobalSessionSelector';
import { buildSettingsSessionHref } from '../Account/loginSettingsRouteHelpers';

import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import {
  getHistoricalFigureAvatarOrBlockie,
  getHistoricalFigureBlockie,
} from 'utilities/ui/historicalFigureAvatars.js';
import { createLogger } from 'utilities/logging.js';
import { peekCacheSync, readCache, subscribeCacheUpdates } from '../../utilities/cache/cacheScripts.js';
import { createCacheUpdateCoalescer } from '../../utilities/cache/cacheUpdateCoalescer.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { computeQuestionDivisiveness } from '../../utilities/survey/consensusMath.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import {
  GLOBAL_SESSION_SELECTION_UPDATED_EVENT,
  readStoredGlobalSessionSelection,
  resolveScopedSessionSlugsFromSelection,
} from '../../utilities/session/globalSessionState.js';
import { t } from '../../utilities/ui/terminology.js';
import { POLIS_DEMO_DATA_AUTOLOAD_SLUGS } from '../../variables/appConfig.js';
import { buildRatingMatrixFromDemo, getPolisDemoDatasetForSlug } from '../PolisReport/PolisReport';
import { persistCommunitySbtHolderHydrationResults } from './communitySbtHolderHydrationCache.js';
import { buildCommunityBeeswarmPointsFromResults } from './communityBeeswarmPoints';
import { type WorkerCanonicalCacheIdentity } from '../../utilities/survey/workerCanonicalCacheIdentity';
import {
  subscribeWorkerGroupsChanged,
  type WorkerGroupsChangedDetail,
} from '../../utilities/worker/workerGroupChangeEvents';
import {
  getCommunityWorkerGroupCountCacheKey,
  getCommunityWorkerGroupCountState,
  invalidateCommunityWorkerGroupCountCache,
  isDisplayableWorkerUserId,
  loadCommunityWorkerGroupCount,
  pickCommunityWorkerCanonicalCache,
  resolveCommunityScopeAuthority,
  type CommunityWorkerGroupCountCacheEntry,
} from './communityWorkerGroupStats';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT } from '../../utilities/web3/sessionRegistry';
import { readKnownSessionCatalog } from '../../utilities/session/sessionCatalog';
import { SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT } from '../../utilities/session/sessionWorkerConfigCache';
import {
  countCommunitySessions,
  createCommunitySessionFilters,
  filterCommunitySessions,
  isCommunitySessionDateUnavailable,
  type CommunitySessionEntry,
  type CommunitySessionFilters,
} from './communitySessionStats';

const uiLog = createLogger('ui');
const COMMUNITY_BEESWARM_FALLBACK_DEMO_SLUG = 'demo';
const SESSION_FILTER_SUMMARY_ID = 'ce-community-session-filter-summary';
const COMMUNITY_BEESWARM_DOMAIN = [0, 1] as const;
type CacheReadOptions = { clone?: boolean };
type CommunityQuestionRow = {
  sessionSlug: string;
  sessionName: string;
  questionId: string;
  prompt: string;
};
type SessionSelectorOption = { value: string; label: string };
type ScopeCacheEntry = {
  slug: string;
  netKey: string;
  cacheScope: string;
  isWorkerCanonical: boolean;
  sessionConfig: Record<string, unknown>;
  workerCanonicalIdentity: WorkerCanonicalCacheIdentity | null;
  workerGroupIds: string[];
  workerVisibleUserIds: string[];
  workerGroupsCount: number;
  workerGroupsStatus: string;
  surveysCache: Record<string, unknown>;
  questionsCache: Record<string, unknown>;
  sbtCache: Record<string, unknown>;
};
type CommunitySbtCacheEntry = Record<string, unknown> & {
  blockNumber?: unknown;
  burnedAddresses?: unknown;
  burnedCountByAddress?: unknown;
  burnedEventCount?: unknown;
  countsScanCheckpoint?: unknown;
  mintedAddresses?: unknown;
  mintedCountByAddress?: unknown;
  mintedEventCount?: unknown;
  sbtAddress?: unknown;
};
type CommunitySbtNetworkCache = Record<string, unknown> & {
  sbtList?: Record<string, CommunitySbtCacheEntry>;
};
type CommunitySbtCache = Record<string, CommunitySbtNetworkCache>;
type ContractScriptsWithBlockWindow = typeof contractScripts & {
  getRelevantBlockWindowForFilter: (slug?: string) => Promise<{ toBlock?: unknown }>;
};

const contractScriptsWithBlockWindow = contractScripts as ContractScriptsWithBlockWindow;
const COMMUNITY_STAT_TEST_IDS: Record<string, string> = Object.freeze({
  Users: E2E_TESTIDS.COMMUNITY_STAT_USERS,
  Questions: E2E_TESTIDS.COMMUNITY_STAT_QUESTIONS,
  Surveys: E2E_TESTIDS.COMMUNITY_STAT_SURVEYS,
  Groups: E2E_TESTIDS.COMMUNITY_STAT_GROUPS,
  Sessions: E2E_TESTIDS.COMMUNITY_STAT_SESSIONS,
});

const getDisplaySessionLists = (slugIn = '') => {
  const strictLists = getSessionLists(slugIn) || {};
  const hasStrictLists = [
    strictLists.featured_SBTs_LIST,
    strictLists.ignored_SBTs_LIST,
    strictLists.HIGHLIGHTED_QUESTION_IDS,
    strictLists.BLOCKED_QUESTION_IDS,
    strictLists.HIGHLIGHTED_SURVEY_IDS,
    strictLists.BLOCKED_SURVEY_IDS,
  ].some((value: unknown) => Array.isArray(value) && value.length > 0);
  if (hasStrictLists) return strictLists;

  const demoCfg = getDemoSessionConfigBySlug(slugIn, { allowDemoFallback: true }) || {};
  return {
    featured_SBTs_LIST: Array.isArray(demoCfg?.featured_SBTs_LIST) ? demoCfg.featured_SBTs_LIST : [],
    ignored_SBTs_LIST: Array.isArray(demoCfg?.ignored_SBTs_LIST) ? demoCfg.ignored_SBTs_LIST : [],
    HIGHLIGHTED_QUESTION_IDS: Array.isArray(demoCfg?.HIGHLIGHTED_QUESTION_IDS) ? demoCfg.HIGHLIGHTED_QUESTION_IDS : [],
    BLOCKED_QUESTION_IDS: Array.isArray(demoCfg?.BLOCKED_QUESTION_IDS) ? demoCfg.BLOCKED_QUESTION_IDS : [],
    HIGHLIGHTED_SURVEY_IDS: Array.isArray(demoCfg?.HIGHLIGHTED_SURVEY_IDS) ? demoCfg.HIGHLIGHTED_SURVEY_IDS : [],
    BLOCKED_SURVEY_IDS: Array.isArray(demoCfg?.BLOCKED_SURVEY_IDS) ? demoCfg.BLOCKED_SURVEY_IDS : [],
  };
};

const getDisplaySessionChainId = (slugIn = '') => {
  const strictChainId = getSessionChainId(slugIn);
  if (strictChainId != null) return strictChainId;

  const demoCfg = getDemoSessionConfigBySlug(slugIn, { allowDemoFallback: true }) || {};
  const demoChainId = Number(
    demoCfg?.networkChainId || demoCfg?.contracts?.surveys?.chainId || demoCfg?.contracts?.sbtFactory?.chainId || 0,
  );
  return Number.isFinite(demoChainId) && demoChainId > 0 ? demoChainId : null;
};

export class CommunityTab extends Component<any, any> {
  [key: string]: any;

  constructor(props: any) {
    super(props);
    this.state = {
      showModal: false,
      modalType: null,
      modalTitle: '',
      showMoreLeaderboard: false,
      hideSimulatedUsers: false,
      hideHumanUsers: false,
      sbtsCreatedCount: 0,
      loadingSbtsCreated: true,
      uniqueUsers: [],
      surveysCreatedCount: 0,
      surveyResponsesCount: 0,
      uniqueQuestionsCount: 0,
      loadingSurveyData: true,
      surveysList: [],
      questionsList: [],
      questionsTableSignature: '',
      filteredUsers: [], // Initialize as empty, will be set when modal opens
      loadingFilter: false,
      usersSnapshotSelectionKey: null,
      usersFilterSelectionKey: null,
      stats: [
        { icon: faUsers, count: 0, label: 'Users' },
        { icon: faVoteYea, count: 0, label: 'Questions' },
        { icon: faScroll, count: 0, label: 'Surveys' },
        { icon: faUsersCog, count: 0, label: 'Groups' },
      ],
      lastSbtGroupsCount: null,
      initialLoadDone: false,
      initialLoadSelectionKey: this._statsSelectionKey(),
      showLeaderboardControls: false,
      sessions: [],
      showSessionFilters: false,
      sessionFilters: createCommunitySessionFilters(),
    };

    this._holdersHydrationInFlight = false;
    this._usersFilterGeneration = 0;
    this._usersFilterSelectionKey = null;
    this._holdersHydrationAbort = false;
    this._holdersHydrationPromise = null;
    this._cacheRefIds = new WeakMap();
    this._nextCacheRefId = 1;
    this._scopeLabelMemo = null;
    this._latestCacheSignature = '';
    this._latestCoarseCacheSignature = '';
    this._statsPollTimer = null;
    this._statsPollStartedAtMs = 0;
    this._statsUnchangedStreak = 0;
    this._statsRefreshInFlight = false;
    this._statsRefreshQueued = false;
    this._statsRefreshQueuedForce = false;
    this._statsRefreshQueuedLoading = false;
    this._lastInitialLoadCheckMs = 0;
    this._cacheUpdateRefreshQueuedForce = false;
    this._cacheUpdateUnsubscribe = null;
    this._statsCacheRefreshCoalescer = null;
    this._visibilityListenerBound = null;
    this._isUnmounted = false;
    this._beeswarmPoints = [];
    this._workerGroupCountCache = new Map<string, CommunityWorkerGroupCountCacheEntry>();
    this._workerGroupCountCacheRevisions = new Map<string, number>();
    this._workerGroupsChangedUnsubscribe = null;
    this._leaderboardMemo = {
      uniqueUsersRef: null,
      uniqueUsersLength: 0,
      uniqueUsersSignature: '',
      hideSimulatedUsers: false,
      hideHumanUsers: false,
      result: [],
    };
  }

  // === Universe helpers (encapsulated) ===
  _refreshSessionCatalog = () => {
    if (this._isUnmounted) return;
    const sessions = readKnownSessionCatalog();
    this._knownSessionCatalog = sessions;
    if (JSON.stringify(sessions) !== JSON.stringify(this.state.sessions)) this.setState({ sessions });
  };

  _handleWorkerSessionCatalogUpdate = () => {
    this._refreshSessionCatalog();
    this._queueCacheDrivenRefresh({ force: true });
  };

  _readGlobalSelection = () => this.props.globalSessionSelection || readStoredGlobalSessionSelection();

  _isUniverseEnabled = () => this._readGlobalSelection().selectedSessionScope === 'all';

  _resolveRouteSlug = () => {
    if (typeof this.props.activeSessionSlug === 'string') return this.props.activeSessionSlug;
    try {
      const p = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
      if (p.startsWith('/session/')) {
        let slug = (p.split('/').filter(Boolean)[1] || '').trim();
        if (!slug) return ''; // general (empty)
        return normalizeSessionSlug(slug);
      }
    } catch (e) {
      uiLog.warn('CommunityTab: fallback', e);
    }
    return ''; // general (empty)
  };

  _hasPinnedRouteSession = () => {
    try {
      const p = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
      return p.startsWith('/session/');
    } catch (e) {
      uiLog.warn('CommunityTab: fallback', e);
    }
    return false;
  };

  _currentSlug = () => {
    if (!this._isUniverseEnabled()) {
      const selected = this._getSelectedSessionSlugs();
      if (selected.length > 0) {
        return normalizeSessionSlug(selected[0] || '');
      }
    }
    return this._resolveRouteSlug();
  };

  _dedupeNormalizedSlugs = (slugs: unknown[] = []): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    slugs.forEach((slugIn: unknown) => {
      const slug = normalizeSessionSlug(slugIn || '');
      if (seen.has(slug)) return;
      seen.add(slug);
      out.push(slug);
    });
    return out;
  };

  _buildSessionSlugSignature = (slugs: unknown[] = []) => this._dedupeNormalizedSlugs(slugs).join('|');

  _sortSlugsByKnownOrder = (slugs: unknown[] = [], orderedUniverse: unknown[] = []): string[] => {
    const normalizedUniverse = this._dedupeNormalizedSlugs(orderedUniverse);
    const order = new Map<string, number>();
    normalizedUniverse.forEach((slug: string, index: number) => {
      order.set(normalizeSessionSlug(slug || ''), index);
    });
    return this._dedupeNormalizedSlugs(slugs).sort((aRaw: string, bRaw: string) => {
      const a = normalizeSessionSlug(aRaw || '');
      const b = normalizeSessionSlug(bRaw || '');
      const ai = order.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bi = order.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return String(a).localeCompare(String(b));
    });
  };

  _labelForSessionSlug = (slugIn: unknown): string => {
    const slug = normalizeSessionSlug(slugIn || '');
    return slug || 'General';
  };

  _sessionConfig = (slugIn: unknown) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const propConfig = this.props.sessionConfig;
    const exactPropConfig =
      typeof propConfig?.slug === 'string' && normalizeSessionSlug(propConfig.slug) === slug ? propConfig : null;
    return (
      exactPropConfig || getSessionConfigBySlug(slug) || getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })
    );
  };

  _sessionName = (slugIn: unknown): string => {
    const slug = normalizeSessionSlug(slugIn || '');
    const config = this._sessionConfig(slug);
    const name = String(config?.sessionName || '').trim();
    return name || slug || 'General';
  };

  _sessionDisplayName = (slugIn: unknown): string => {
    const slug = normalizeSessionSlug(slugIn || '');
    const name = this._sessionName(slug);
    const slugLabel = slug || 'General';
    return name && name.toLowerCase() !== slugLabel.toLowerCase() ? `${name} (${slugLabel})` : slugLabel;
  };

  // Render calls this every time, and each display name re-reads the session
  // registry and Worker caches. Recompute only when one of its inputs changes;
  // the catalog in state changes whenever the registry or Worker records do.
  _communityScopeLabel = () => {
    const universe = this._isUniverseEnabled();
    const key = JSON.stringify([
      universe,
      this._readGlobalSelection(),
      readSessionScanScope(),
      readSessionScanSlugs(),
      typeof window !== 'undefined' ? window.location.pathname : '',
      this.props.activeSessionSlug ?? null,
      this._getObjectRefId(this.props.sessionConfig),
      this._getObjectRefId(this.state.sessions),
    ]);
    if (this._scopeLabelMemo?.key === key) return this._scopeLabelMemo.label;
    let label = 'All sessions';
    if (!universe) {
      const slugs = this._getSelectedSessionSlugs();
      const selected = slugs.length ? slugs : [this._currentSlug()];
      label = `${selected.length === 1 ? 'Session' : 'Sessions'}: ${selected.map(this._sessionDisplayName).join(', ')}`;
    }
    this._scopeLabelMemo = { key, label };
    return label;
  };

  _getDefaultSelectedSessionSlugs = () => {
    const availableSlugs = this._getSessionSelectorOptions().map((option: SessionSelectorOption) => option.value);
    const availableSet = new Set<string>(availableSlugs);
    const routeSlug = normalizeSessionSlug(this._resolveRouteSlug() || '');
    const selection = this._readGlobalSelection();
    const scopedDefaults =
      selection.selectedSessionScope === 'all'
        ? availableSlugs
        : resolveScopedSessionSlugsFromSelection({
            ...selection,
            primarySessionSlug: selection.primarySessionSlug,
          });
    const filteredDefaults = this._dedupeNormalizedSlugs(scopedDefaults).filter((slug: string) =>
      availableSet.has(slug),
    );
    if (filteredDefaults.length > 0) {
      return this._sortSlugsByKnownOrder(filteredDefaults, availableSlugs);
    }
    if (availableSet.has(routeSlug)) return [routeSlug];
    if (availableSet.has('')) return [''];
    return availableSlugs.length > 0 ? [availableSlugs[0]] : [];
  };

  _getSessionSelectorOptions = (): SessionSelectorOption[] =>
    this._dedupeNormalizedSlugs([this._resolveRouteSlug(), '', ...this.listAllSlugs()]).map((slug: string) => ({
      value: slug,
      label: this._labelForSessionSlug(slug),
    }));

  _getSelectedSessionSlugs = () => {
    const availableSlugs = this._getSessionSelectorOptions().map((option: SessionSelectorOption) => option.value);
    const availableSet = new Set<string>(availableSlugs);
    const defaultSelected = this._getDefaultSelectedSessionSlugs().filter((slug: string) => availableSet.has(slug));
    if (defaultSelected.length > 0) {
      return this._sortSlugsByKnownOrder(defaultSelected, availableSlugs);
    }

    return this._sortSlugsByKnownOrder(availableSlugs, availableSlugs);
  };

  toggleLeaderboardControls = () => {
    this.setState((prevState: Readonly<CommunityTab['state']>) => ({
      showLeaderboardControls: !prevState.showLeaderboardControls,
    }));
  };

  listAllSlugs = () => {
    const selection = this._readGlobalSelection();
    if (selection.selectedSessionScope === 'list') {
      const scopedSlugs = this._dedupeNormalizedSlugs(selection.selectedSessionSlugs);
      if (scopedSlugs.length > 0) return scopedSlugs;
      const routeSlug = normalizeSessionSlug(this._resolveRouteSlug() || '');
      return routeSlug ? [routeSlug] : [''];
    }
    return this._dedupeNormalizedSlugs([
      this._resolveRouteSlug(),
      selection.primarySessionSlug,
      '',
      ...getAllSessionSlugs(),
      ...(this._knownSessionCatalog || this.state.sessions).map(({ slug }: CommunitySessionEntry) => slug),
    ]);
  };

  _resolveNetKeyForSlug = (slug: string) => {
    try {
      const id = getDisplaySessionChainId(slug);
      return id != null ? String(id) : '';
    } catch (_) {
      return '';
    }
  };

  _resolveScopeAuthority = (slug: string) =>
    resolveCommunityScopeAuthority({
      slugIn: slug,
      propSessionConfig: this.props.sessionConfig,
      resolveNetKeyForSlug: this._resolveNetKeyForSlug,
    });

  _readCache = (cacheName: string, slug: string, options: CacheReadOptions = {}): Record<string, unknown> => {
    const shouldClone = options?.clone === true;
    const obj = peekCacheSync(cacheName, slug, { clone: shouldClone }) || {};
    return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {};
  };

  _getObjectRefId = (value: unknown) => {
    if (!value || typeof value !== 'object') return 'na';
    let id = this._cacheRefIds.get(value);
    if (!id) {
      id = this._nextCacheRefId;
      this._nextCacheRefId += 1;
      this._cacheRefIds.set(value, id);
    }
    return id;
  };

  _pickNet = (cacheObj: unknown, netKey: string): Record<string, unknown> => {
    if (!cacheObj || typeof cacheObj !== 'object') return {};
    const parsedCache = cacheObj as Record<string, unknown>;
    if (netKey && parsedCache[netKey] && typeof parsedCache[netKey] === 'object') {
      return parsedCache[netKey] as Record<string, unknown>;
    }
    const ks = Object.keys(parsedCache || {});
    if (ks.length === 1 && parsedCache[ks[0]] && typeof parsedCache[ks[0]] === 'object') {
      return parsedCache[ks[0]] as Record<string, unknown>;
    }
    return {};
  };

  _pickWorkerCanonicalCache = (cacheObj: unknown, identity: WorkerCanonicalCacheIdentity | null) =>
    pickCommunityWorkerCanonicalCache(cacheObj, identity);

  // Catalog aggregation must not prompt for unrelated Workers. Keep the same
  // account choice in the request and cache key so private counts never leak into anonymous reads.
  _workerGroupCountAccount = (sessionSlug: unknown) =>
    normalizeSessionSlug(sessionSlug) === normalizeSessionSlug(this._resolveRouteSlug()) ? this.props.account : '';

  _getWorkerGroupCountCacheKey = (identity: WorkerCanonicalCacheIdentity) =>
    getCommunityWorkerGroupCountCacheKey(identity, this._workerGroupCountAccount(identity.sessionSlug));

  _getWorkerGroupCountState = (identity: WorkerCanonicalCacheIdentity | null) =>
    getCommunityWorkerGroupCountState(
      identity,
      this._workerGroupCountAccount(identity?.sessionSlug),
      this._workerGroupCountCache,
    );

  _invalidateWorkerGroupCountCache = (detail: WorkerGroupsChangedDetail) =>
    invalidateCommunityWorkerGroupCountCache({
      detail,
      cache: this._workerGroupCountCache,
      revisions: this._workerGroupCountCacheRevisions,
    });

  _handleWorkerGroupsChanged = (detail: WorkerGroupsChangedDetail) => {
    if (this._isUnmounted) return;
    this._invalidateWorkerGroupCountCache(detail);
    this._queueCacheDrivenRefresh({ force: true });
  };

  _buildScopeEntriesFromSlugs = (slugs: unknown[] = [], options: CacheReadOptions = {}): ScopeCacheEntry[] => {
    const out: ScopeCacheEntry[] = [];
    this._dedupeNormalizedSlugs(slugs).forEach((slug: string) => {
      const netKey = this._resolveNetKeyForSlug(slug);
      const authority = this._resolveScopeAuthority(slug);
      const surveysCacheAll = this._readCache('surveysCache', slug, options);
      const questionsCacheAll = this._readCache('questionsCache', slug, options);
      const sbtCacheAll = this._readCache('sbtCache', slug, options);
      // Regression guard: Worker-canonical Stats must use the identity-matched
      // `worker` node; numeric-chain fallback can surface stale metadata.
      const pickCache = (cache: Record<string, unknown>) =>
        authority.isWorkerCanonical
          ? this._pickWorkerCanonicalCache(cache, authority.workerCanonicalIdentity)
          : this._pickNet(cache, netKey);
      out.push({
        slug,
        netKey,
        ...authority,
        ...this._getWorkerGroupCountState(authority.workerCanonicalIdentity),
        surveysCache: pickCache(surveysCacheAll),
        questionsCache: pickCache(questionsCacheAll),
        sbtCache: pickCache(sbtCacheAll),
      });
    });
    return out;
  };

  _iterUniverse = (options: CacheReadOptions = {}) => {
    return this._buildScopeEntriesFromSlugs(this.listAllSlugs(), options);
  };

  _iterScopeCaches = (options: CacheReadOptions = {}) => {
    if (this._isUniverseEnabled()) return this._iterUniverse(options);
    const selectedSlugs = this._getSelectedSessionSlugs();
    if (selectedSlugs.length > 0) {
      return this._buildScopeEntriesFromSlugs(selectedSlugs, options);
    }
    return this._buildScopeEntriesFromSlugs([this._currentSlug()], options);
  };

  _loadWorkerGroupCount = (scopeEntry: ScopeCacheEntry) =>
    loadCommunityWorkerGroupCount({
      scopeEntry,
      runtime: {
        account: this._workerGroupCountAccount(scopeEntry.slug),
        provider: this.props.provider,
        networkChainId: this.props.networkChainId,
        network: this.props.network,
      },
      cache: this._workerGroupCountCache,
      revisions: this._workerGroupCountCacheRevisions,
      onWarning: (message, error) => uiLog.warn(message, error),
    });

  _hydrateWorkerGroupCounts = async (scopeEntries: ScopeCacheEntry[]) => {
    await Promise.all(scopeEntries.map((scopeEntry) => this._loadWorkerGroupCount(scopeEntry)));
    scopeEntries.forEach((scopeEntry) => {
      Object.assign(scopeEntry, this._getWorkerGroupCountState(scopeEntry.workerCanonicalIdentity));
    });
  };

  _hydrateSbtHoldersForUsersModal = async () => {
    if (this._holdersHydrationPromise) return this._holdersHydrationPromise;
    this._holdersHydrationInFlight = true;
    this._holdersHydrationAbort = false;
    this._holdersHydrationPromise = (async () => {
      const slugs = this._isUniverseEnabled() ? this.listAllSlugs() : this._getSelectedSessionSlugs();
      const CONC = 2;
      for (let i = 0; i < slugs.length; i += CONC) {
        const chunk = slugs.slice(i, i + CONC);
        await Promise.all(chunk.map((slug: string) => this._hydrateSbtHoldersForSlug(slug)));
        if (this._holdersHydrationAbort) break;
      }
    })();
    try {
      await this._holdersHydrationPromise;
    } finally {
      this._holdersHydrationInFlight = false;
      this._holdersHydrationPromise = null;
    }

    if (this._holdersHydrationAbort || this._isUnmounted) return;
    await this._refreshCommunityStats({ force: true, markLoading: false });
  };

  _hydrateSbtHoldersForSlug = async (slug: string) => {
    if (this._resolveScopeAuthority(slug).isWorkerCanonical) return;
    const netKey = this._resolveNetKeyForSlug(slug);
    if (!netKey) return;

    let cacheObj = await readCache<CommunitySbtCache>('sbtCache', slug);
    if (!cacheObj || typeof cacheObj !== 'object') cacheObj = {};
    if (!cacheObj[netKey]) cacheObj[netKey] = { sbtList: {} };
    const sbtList = cacheObj[netKey].sbtList || {};

    const needsCounts = (entry: any) => {
      if (!entry || !entry.sbtAddress) return false;
      if (entry.countsLoaded === true) return false;
      const hasMinted = Array.isArray(entry.mintedAddresses) && entry.mintedAddresses.length > 0;
      const hasBurned = Array.isArray(entry.burnedAddresses) && entry.burnedAddresses.length > 0;
      return !(hasMinted || hasBurned);
    };

    const entries = Object.values(sbtList || {}).filter(needsCounts);
    if (!entries.length) return;

    const BATCH = 2;
    for (let i = 0; i < entries.length; i += BATCH) {
      if (this._holdersHydrationAbort) break;
      const batch = entries.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (entry: any) => {
          try {
            const addr = entry.sbtAddress;
            const lower = String(addr || '').toLowerCase();
            const rawCreation = entry.creationBlock ?? entry.sbtInfo?.creationBlock;
            const creationBlock = Number.isFinite(Number(rawCreation))
              ? Math.max(0, Math.floor(Number(rawCreation)))
              : 0;
            const counts = await contractScripts.getSbtMintBurnCountsByAddress(
              'none',
              addr,
              creationBlock,
              'latest',
              slug,
            );
            if (counts && counts.ok === false) {
              return { lower, addr, countsOk: false };
            }
            const mintedAddresses = Object.keys(counts.mintedCountByAddress || {}).map((a: any) => a.toLowerCase());
            const burnedAddresses = Object.keys(counts.burnedCountByAddress || {}).map((a: any) => a.toLowerCase());
            return {
              lower,
              addr,
              mintedAddresses,
              burnedAddresses,
              counts,
              countsOk: true,
            };
          } catch (e) {
            return null;
          }
        }),
      );

      const changed = results.some((res: any) => !!res && res.countsOk !== false);

      if (changed) {
        await persistCommunitySbtHolderHydrationResults({ slug, netKey, results });
      }
      if (i + BATCH < entries.length) {
        await new Promise((r: any) => setTimeout(r, 75));
      }
    }
  };

  _shouldCountSbt = (entry: any, slug: any) => {
    if (!entry || !entry.sbtAddress) return false;
    const info = entry.sbtInfo || {};
    if (info.hidden === true) return false;

    let ignored: any[] = [],
      featured: any[] = [];
    const lists = getDisplaySessionLists(slug);
    ignored = lists.ignored_SBTs_LIST || [];
    featured = lists.featured_SBTs_LIST || [];
    const addrLower = String(entry.sbtAddress || '').toLowerCase();
    const ignoredSet: any = new Set(ignored.map((a: any) => (a || '').toLowerCase()));
    const featuredSet: any = new Set(featured.map((a: any) => (a || '').toLowerCase()));
    if (ignoredSet.has(addrLower)) return false;
    if (info.unlisted === true && !featuredSet.has(addrLower)) return false;
    return true;
  };

  _countKeys = (value: any) => {
    if (!value || typeof value !== 'object') return 0;
    return Object.keys(value).length;
  };

  _summarizeNestedResponseKeys = (value: any) => {
    if (!value || typeof value !== 'object') {
      return { totalKeys: 0, hash: 0 };
    }
    let totalKeys = 0;
    let hash = 2166136261;
    const mix = (input: any) => {
      const text = String(input || '');
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      hash >>>= 0;
    };
    Object.entries(value).forEach(([outerKey, inner]: any) => {
      mix(String(outerKey || '').toLowerCase());
      if (!inner || typeof inner !== 'object') {
        mix('0');
        return;
      }
      const nestedKeys = Object.keys(inner);
      totalKeys += nestedKeys.length;
      mix(String(nestedKeys.length));
      nestedKeys.forEach((nestedKey: any) => {
        mix(String(nestedKey || '').toLowerCase());
      });
    });
    return { totalKeys, hash: hash >>> 0 };
  };

  _summarizeSurveyMetadata = (surveysMap: any) => {
    if (!surveysMap || typeof surveysMap !== 'object') {
      return { totalSurveys: 0, hash: 0 };
    }
    let totalSurveys = 0;
    let hash = 2166136261;
    const mix = (input: any) => {
      const text = String(input || '');
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      hash >>>= 0;
    };

    Object.entries(surveysMap).forEach(([surveyId, survey]: any) => {
      totalSurveys += 1;
      const safeSurvey = survey && typeof survey === 'object' ? survey : {};
      const questionIDs = Array.isArray(safeSurvey.questionIDs) ? safeSurvey.questionIDs : [];
      mix(String(surveyId || '').toLowerCase());
      mix(String(safeSurvey.title || ''));
      mix(String(safeSurvey.creator || '').toLowerCase());
      mix(String(questionIDs.length));
      questionIDs.forEach((qid: any) => {
        mix(String(qid || '').toLowerCase());
      });
    });

    return { totalSurveys, hash: hash >>> 0 };
  };

  _summarizeQuestionMetadata = (questionsMap: any) => {
    if (!questionsMap || typeof questionsMap !== 'object') {
      return { totalQuestions: 0, hash: 0 };
    }
    let totalQuestions = 0;
    let hash = 2166136261;
    const mix = (input: any) => {
      const text = String(input || '');
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      hash >>>= 0;
    };

    Object.entries(questionsMap).forEach(([questionId, question]: any) => {
      totalQuestions += 1;
      const safeQuestion = question && typeof question === 'object' ? question : {};
      mix(String(questionId || '').toLowerCase());
      mix(String(safeQuestion.creator || '').toLowerCase());
    });

    return { totalQuestions, hash: hash >>> 0 };
  };

  _summarizeSbtHolderMembers = (sbtListMap: any) => {
    if (!sbtListMap || typeof sbtListMap !== 'object') {
      return { totalEntries: 0, totalMembers: 0, hash: 0 };
    }
    let totalEntries = 0;
    let totalMembers = 0;
    let hash = 2166136261;
    const mix = (input: any) => {
      const text = String(input || '');
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      hash >>>= 0;
    };

    Object.entries(sbtListMap).forEach(([entryKey, entryValue]: any) => {
      totalEntries += 1;
      const entry = entryValue && typeof entryValue === 'object' ? entryValue : {};
      const info = entry?.sbtInfo && typeof entry.sbtInfo === 'object' ? entry.sbtInfo : {};
      const minted = Array.isArray(entry.mintedAddresses) ? entry.mintedAddresses : [];
      const burned = Array.isArray(entry.burnedAddresses) ? entry.burnedAddresses : [];
      const admin = String(info.admin || info.admin_ || '').toLowerCase();
      const creator = String(info.creator || '').toLowerCase();
      const hidden = info.hidden === true ? '1' : '0';
      const unlisted = info.unlisted === true ? '1' : '0';
      mix(String(entryKey || '').toLowerCase());
      mix(String(entry.sbtAddress || '').toLowerCase());
      mix(`a:${admin}`);
      mix(`c:${creator}`);
      mix(`h:${hidden}`);
      mix(`u:${unlisted}`);
      mix(String(minted.length));
      mix(String(burned.length));
      minted.forEach((addr: any) => {
        totalMembers += 1;
        mix(`m:${String(addr || '').toLowerCase()}`);
      });
      burned.forEach((addr: any) => {
        totalMembers += 1;
        mix(`b:${String(addr || '').toLowerCase()}`);
      });
    });

    return { totalEntries, totalMembers, hash: hash >>> 0 };
  };

  _buildCoarseCacheSignature = (scopeEntries: any = []) => {
    const parts: any[] = [];
    for (const {
      slug,
      cacheScope,
      surveysCache,
      questionsCache,
      sbtCache,
      workerGroupsCount,
      workerGroupsStatus,
      workerVisibleUserIds,
    } of scopeEntries) {
      const surveyBlock = Number(surveysCache?.surveysLatestBlock) || Number(surveysCache?.lastBlock) || 0;
      const questionBlock =
        Number(questionsCache?.questionsLatestBlock) ||
        Number(questionsCache?.questionResponsesLatestBlock) ||
        Number(questionsCache?.lastBlock) ||
        0;
      const sbtBlock = Number(sbtCache?.lastBlock) || 0;
      const surveyMetadataSummary = this._summarizeSurveyMetadata(surveysCache?.surveys);
      const questionMetadataSummary = this._summarizeQuestionMetadata(questionsCache?.questions);
      const surveyResponsesSummary = this._summarizeNestedResponseKeys(surveysCache?.surveyResponses);
      const questionResponsesSummary = this._summarizeNestedResponseKeys(questionsCache?.questionResponses);
      const sbtMembersSummary = this._summarizeSbtHolderMembers(sbtCache?.sbtList);
      parts.push(
        [
          String(slug || ''),
          String(cacheScope || ''),
          surveyBlock,
          questionBlock,
          sbtBlock,
          this._countKeys(surveysCache?.surveys),
          surveyMetadataSummary.totalSurveys,
          surveyMetadataSummary.hash,
          this._countKeys(surveysCache?.surveyResponses),
          surveyResponsesSummary.totalKeys,
          surveyResponsesSummary.hash,
          this._countKeys(questionsCache?.questions),
          questionMetadataSummary.totalQuestions,
          questionMetadataSummary.hash,
          this._countKeys(questionsCache?.questionResponses),
          questionResponsesSummary.totalKeys,
          questionResponsesSummary.hash,
          this._countKeys(sbtCache?.sbtList),
          sbtMembersSummary.totalEntries,
          sbtMembersSummary.totalMembers,
          sbtMembersSummary.hash,
          Number(workerGroupsCount || 0),
          String(workerGroupsStatus || ''),
          Array.isArray(workerVisibleUserIds) ? workerVisibleUserIds.slice().sort().join(',') : '',
        ].join(':'),
      );
    }
    parts.push(`universe:${this._isUniverseEnabled() ? 1 : 0}`);
    parts.push(`selected:${this._buildSessionSlugSignature(this._getSelectedSessionSlugs())}`);
    parts.push(`active:${String(this._currentSlug() || '')}`);
    parts.push(`sbtRev:${String(this.props.sbtCacheRevision || '')}`);
    parts.push(`sbtReady:${this.props.isSBTCacheReady ? 1 : 0}`);
    parts.push(`qReady:${this.props.isQuestionCacheReady ? 1 : 0}`);
    parts.push(`sReady:${this.props.isSurveyCacheReady ? 1 : 0}`);
    return parts.join('|');
  };

  _buildCacheSignature = (scopeEntries: any = []) =>
    measureSync('ce.communityTab.cacheSignature', () => {
      const parts: any[] = [];
      for (const {
        slug,
        cacheScope,
        surveysCache,
        questionsCache,
        sbtCache,
        workerGroupsCount,
        workerGroupsStatus,
        workerVisibleUserIds,
      } of scopeEntries) {
        const surveyBlock = Number(surveysCache?.surveysLatestBlock) || Number(surveysCache?.lastBlock) || 0;
        const questionBlock =
          Number(questionsCache?.questionsLatestBlock) ||
          Number(questionsCache?.questionResponsesLatestBlock) ||
          Number(questionsCache?.lastBlock) ||
          0;
        const sbtBlock = Number(sbtCache?.lastBlock) || 0;
        const surveyRefId = this._countKeys(surveysCache) > 0 ? this._getObjectRefId(surveysCache) : 0;
        const questionRefId = this._countKeys(questionsCache) > 0 ? this._getObjectRefId(questionsCache) : 0;
        const sbtRefId = this._countKeys(sbtCache) > 0 ? this._getObjectRefId(sbtCache) : 0;
        const surveyMetadataSummary = this._summarizeSurveyMetadata(surveysCache?.surveys);
        const questionMetadataSummary = this._summarizeQuestionMetadata(questionsCache?.questions);
        const surveyResponsesSummary = this._summarizeNestedResponseKeys(surveysCache?.surveyResponses);
        const questionResponsesSummary = this._summarizeNestedResponseKeys(questionsCache?.questionResponses);
        const sbtMembersSummary = this._summarizeSbtHolderMembers(sbtCache?.sbtList);
        parts.push(
          [
            String(slug || ''),
            String(cacheScope || ''),
            surveyBlock,
            questionBlock,
            sbtBlock,
            this._countKeys(surveysCache?.surveys),
            surveyMetadataSummary.totalSurveys,
            surveyMetadataSummary.hash,
            this._countKeys(surveysCache?.surveyResponses),
            surveyResponsesSummary.totalKeys,
            surveyResponsesSummary.hash,
            this._countKeys(questionsCache?.questions),
            questionMetadataSummary.totalQuestions,
            questionMetadataSummary.hash,
            this._countKeys(questionsCache?.questionResponses),
            questionResponsesSummary.totalKeys,
            questionResponsesSummary.hash,
            this._countKeys(sbtCache?.sbtList),
            sbtMembersSummary.totalEntries,
            sbtMembersSummary.totalMembers,
            sbtMembersSummary.hash,
            surveyRefId,
            questionRefId,
            sbtRefId,
            Number(workerGroupsCount || 0),
            String(workerGroupsStatus || ''),
            Array.isArray(workerVisibleUserIds) ? workerVisibleUserIds.slice().sort().join(',') : '',
          ].join(':'),
        );
      }
      parts.push(`universe:${this._isUniverseEnabled() ? 1 : 0}`);
      parts.push(`selected:${this._buildSessionSlugSignature(this._getSelectedSessionSlugs())}`);
      parts.push(`active:${String(this._currentSlug() || '')}`);
      parts.push(`sbtRev:${String(this.props.sbtCacheRevision || '')}`);
      parts.push(`sbtReady:${this.props.isSBTCacheReady ? 1 : 0}`);
      parts.push(`qReady:${this.props.isQuestionCacheReady ? 1 : 0}`);
      parts.push(`sReady:${this.props.isSurveyCacheReady ? 1 : 0}`);
      return parts.join('|');
    });

  _buildStatsArray = (prevStats: any, counts: any = {}) =>
    (prevStats || []).map((stat: any) => {
      if (stat.label === 'Users') return { ...stat, count: Number(counts.users || 0) };
      if (stat.label === 'Questions') return { ...stat, count: Number(counts.questions || 0) };
      if (stat.label === 'Surveys') return { ...stat, count: Number(counts.surveys || 0) };
      if (stat.label === 'Groups') return { ...stat, count: Number(counts.groups || 0) };
      return stat;
    });

  _areAddressListsEqual = (left: any = [], right: any = []) => {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (String(left[i] || '').toLowerCase() !== String(right[i] || '').toLowerCase()) {
        return false;
      }
    }
    return true;
  };

  _computeUniverseStatsSnapshot = (scopeEntries: any = []) =>
    measureSync('ce.communityTab.computeUniverseStats', () => {
      const surveyIdSet: any = new Set();
      const questionIdSet: any = new Set();
      const userSet: any = new Set();
      const sbtIdentitySet: any = new Set();
      const workerGroupIdentitySet = new Set<string>();
      const surveyTitleMap: Record<string, any> = {};
      const surveySlugMap: Record<string, any> = {};
      const surveyRespondersMap: Record<string, any> = {};

      for (const scopeEntry of scopeEntries) {
        const { slug, netKey, surveysCache, questionsCache, sbtCache } = scopeEntry;
        const surveysData = surveysCache?.surveys || {};
        const surveyResponsesData = surveysCache?.surveyResponses || {};
        const questionsData = questionsCache?.questions || {};
        const questionResponsesData = questionsCache?.questionResponses || {};
        const sbtList = sbtCache?.sbtList || {};

        Object.keys(surveysData || {}).forEach((sId: any) => {
          const sid = String(sId || '').toLowerCase();
          if (!sid) return;
          surveyIdSet.add(sid);
          if (!surveyTitleMap[sid]) {
            surveyTitleMap[sid] = surveysData[sId]?.title || 'Untitled Survey';
          }
          if (!surveySlugMap[sid]) {
            surveySlugMap[sid] = normalizeSessionSlug(String(slug || ''));
          }
          const creator = surveysData[sId]?.creator;
          if (creator) userSet.add(String(creator).toLowerCase());
        });

        Object.keys(surveyResponsesData || {}).forEach((sId: any) => {
          const sid = String(sId || '').toLowerCase();
          const responders = Object.keys(surveyResponsesData[sId] || {});
          if (!surveyRespondersMap[sid]) surveyRespondersMap[sid] = new Set();
          responders.forEach((r: any) => {
            const rl = String(r || '').toLowerCase();
            if (!rl) return;
            surveyRespondersMap[sid].add(rl);
            userSet.add(rl);
          });
        });

        Object.keys(questionsData || {}).forEach((qId: any) => {
          const qid = String(qId || '').toLowerCase();
          if (!qid) return;
          questionIdSet.add(qid);
          const creator = questionsData[qId]?.creator;
          if (creator) userSet.add(String(creator).toLowerCase());
        });

        Object.keys(questionResponsesData || {}).forEach((qId: any) => {
          const responders = Object.keys(questionResponsesData[qId] || {});
          responders.forEach((r: any) => {
            const rl = String(r || '').toLowerCase();
            if (rl) userSet.add(rl);
          });
        });

        if (scopeEntry.isWorkerCanonical) {
          (scopeEntry.workerGroupIds || []).forEach((groupId: unknown) => {
            const normalizedGroupId = String(groupId || '').trim();
            if (normalizedGroupId) workerGroupIdentitySet.add(`${slug}:${normalizedGroupId}`);
          });
          (scopeEntry.workerVisibleUserIds || []).forEach((userId: unknown) => {
            const normalizedUserId = String(userId || '')
              .trim()
              .toLowerCase();
            if (isDisplayableWorkerUserId(normalizedUserId)) userSet.add(normalizedUserId);
          });
        }

        Object.keys(scopeEntry.isWorkerCanonical ? {} : sbtList || {}).forEach((addrLower) => {
          const entry = sbtList[addrLower];
          if (!entry || !entry.sbtAddress) return;

          if (this._shouldCountSbt(entry, slug)) {
            sbtIdentitySet.add(`${netKey}:${String(entry.sbtAddress || '').toLowerCase()}`);
          }

          const info = entry.sbtInfo || {};
          if (info.creator) userSet.add(String(info.creator).toLowerCase());
          if (info.admin) userSet.add(String(info.admin).toLowerCase());
          (entry.mintedAddresses || []).forEach((a: any) => {
            const al = String(a || '').toLowerCase();
            if (al) userSet.add(al);
          });
          (entry.burnedAddresses || []).forEach((a: any) => {
            const al = String(a || '').toLowerCase();
            if (al) userSet.add(al);
          });
        });
      }

      let surveyResponsesCount = 0;
      Object.values(surveyRespondersMap).forEach((set: any) => {
        surveyResponsesCount += set ? set.size : 0;
      });

      const surveysList = Array.from(surveyIdSet).map((sid: any) => ({
        id: sid,
        title: surveyTitleMap[sid] || 'Untitled Survey',
        responsesCount: (surveyRespondersMap[sid] && surveyRespondersMap[sid].size) || 0,
        questionsCount: null,
        slug: surveySlugMap[sid] || '',
      }));

      return {
        uniqueUsers: Array.from(userSet),
        surveysCreatedCount: surveyIdSet.size,
        surveyResponsesCount,
        uniqueQuestionsCount: questionIdSet.size,
        surveysList,
        sbtsCreatedCount: sbtIdentitySet.size + workerGroupIdentitySet.size,
      };
    });

  _computeSingleScopeStatsSnapshot = (scopeEntry: any) =>
    measureSync('ce.communityTab.computeSingleScopeStats', () => {
      if (!scopeEntry || !scopeEntry.cacheScope) {
        return {
          uniqueUsers: [],
          surveysCreatedCount: 0,
          surveyResponsesCount: 0,
          uniqueQuestionsCount: 0,
          surveysList: [],
          sbtsCreatedCount: 0,
        };
      }

      const surveysData = scopeEntry.surveysCache?.surveys || {};
      const surveyResponsesData = scopeEntry.surveysCache?.surveyResponses || {};
      const questionsData = scopeEntry.questionsCache?.questions || {};
      const questionResponsesData = scopeEntry.questionsCache?.questionResponses || {};
      const sbtList = scopeEntry.sbtCache?.sbtList || {};

      const surveysCreatedCount = Object.keys(surveysData).length;
      const uniqueQuestionsCount = Object.keys(questionsData).length;

      let surveyResponsesCount = 0;
      for (const sId in surveyResponsesData) {
        surveyResponsesCount += Object.keys(surveyResponsesData[sId] || {}).length;
      }

      const uniqueUsersSet: any = new Set();
      for (const sId in surveysData) {
        if (surveysData[sId]?.creator) {
          uniqueUsersSet.add(String(surveysData[sId].creator).toLowerCase());
        }
      }
      for (const sId in surveyResponsesData) {
        const responders = Object.keys(surveyResponsesData[sId] || {});
        responders.forEach((r: any) => uniqueUsersSet.add(String(r || '').toLowerCase()));
      }
      for (const qId in questionsData) {
        if (questionsData[qId]?.creator) {
          uniqueUsersSet.add(String(questionsData[qId].creator).toLowerCase());
        }
      }
      for (const qId in questionResponsesData) {
        const responders = Object.keys(questionResponsesData[qId] || {});
        responders.forEach((r: any) => uniqueUsersSet.add(String(r || '').toLowerCase()));
      }

      let sbtsCreatedCount = scopeEntry.isWorkerCanonical ? Number(scopeEntry.workerGroupsCount || 0) : 0;
      if (scopeEntry.isWorkerCanonical) {
        (scopeEntry.workerVisibleUserIds || []).forEach((userId: unknown) => {
          const normalizedUserId = String(userId || '')
            .trim()
            .toLowerCase();
          if (isDisplayableWorkerUserId(normalizedUserId)) uniqueUsersSet.add(normalizedUserId);
        });
      }
      for (const sbtAddress in scopeEntry.isWorkerCanonical ? {} : sbtList) {
        const sbtItem = sbtList[sbtAddress];
        if (!sbtItem) continue;
        if (this._shouldCountSbt(sbtItem, scopeEntry.slug)) sbtsCreatedCount += 1;
        if (sbtItem.sbtInfo?.creator) {
          uniqueUsersSet.add(String(sbtItem.sbtInfo.creator).toLowerCase());
        }
        if (sbtItem.sbtInfo?.admin) {
          uniqueUsersSet.add(String(sbtItem.sbtInfo.admin).toLowerCase());
        }
        (sbtItem.mintedAddresses || []).forEach((addr: any) => uniqueUsersSet.add(String(addr || '').toLowerCase()));
        (sbtItem.burnedAddresses || []).forEach((addr: any) => uniqueUsersSet.add(String(addr || '').toLowerCase()));
      }

      const surveysList = Object.keys(surveysData).map((sId: any) => {
        const survey = surveysData[sId] || {};
        const questionIDs = Array.isArray(survey.questionIDs) ? survey.questionIDs : [];
        const responsesCount = Object.keys(surveyResponsesData[sId] || {}).length;
        return {
          id: sId,
          title: survey.title || 'Untitled Survey',
          responsesCount,
          questionsCount: questionIDs.length,
          slug: normalizeSessionSlug(String(scopeEntry.slug || '')),
        };
      });

      return {
        uniqueUsers: Array.from(uniqueUsersSet),
        surveysCreatedCount,
        surveyResponsesCount,
        uniqueQuestionsCount,
        surveysList,
        sbtsCreatedCount,
      };
    });

  _computeStatsSnapshot = (scopeEntries: any = []) => {
    if (Array.isArray(scopeEntries) && scopeEntries.length === 1) {
      return this._computeSingleScopeStatsSnapshot(scopeEntries[0]);
    }
    return this._computeUniverseStatsSnapshot(scopeEntries);
  };

  _isWorkerScopeEntryReady = (scopeEntry: ScopeCacheEntry) => {
    const groupsSettled = ['ready', 'error', 'unavailable'].includes(scopeEntry.workerGroupsStatus);
    // Identity fields and empty initialization maps do not prove metadata has arrived.
    // The global readiness props belong only to the active session.
    const isActive = normalizeSessionSlug(scopeEntry.slug) === normalizeSessionSlug(this._resolveRouteSlug());
    const questionsReady =
      scopeEntry.questionsCache?.workerMetadataHydrationStatus === 'complete' ||
      (scopeEntry.questionsCache?.workerMetadataHydrationStatus !== 'loading' &&
        isActive &&
        this.props.isQuestionCacheReady) ||
      this._countKeys(scopeEntry.questionsCache?.questions) > 0;
    const surveysReady =
      scopeEntry.surveysCache?.workerMetadataHydrationStatus === 'complete' ||
      (scopeEntry.surveysCache?.workerMetadataHydrationStatus !== 'loading' &&
        isActive &&
        this.props.isSurveyCacheReady) ||
      this._countKeys(scopeEntry.surveysCache?.surveys) > 0;
    return groupsSettled && questionsReady && surveysReady;
  };

  checkIfInitialLoadDone = async () => {
    // This function checks if the initial load is done by comparing the caches' lastBlock to the latest chain block
    const scopeEntries = this._iterScopeCaches({ clone: false });
    if (scopeEntries.length > 1) {
      try {
        for (const scopeEntry of scopeEntries) {
          const { slug, surveysCache, questionsCache, sbtCache } = scopeEntry;
          if (scopeEntry.isWorkerCanonical) {
            if (!this._isWorkerScopeEntryReady(scopeEntry)) return false;
            continue;
          }
          // Determine latest block (group-aware)
          let latestBlockNumber = 0;
          try {
            const { toBlock } = await contractScriptsWithBlockWindow.getRelevantBlockWindowForFilter(slug);
            latestBlockNumber = Number(toBlock || 0);
          } catch (_) {
            try {
              latestBlockNumber = await contractScripts.getLatestBlockNumber('none', slug);
            } catch (e) {
              latestBlockNumber = 0;
            }
          }

          const surveyLastBlock = Number(surveysCache?.surveysLatestBlock) || Number(surveysCache?.lastBlock) || 0;

          const questionLastBlock =
            Number(questionsCache?.questionsLatestBlock) ||
            Number(questionsCache?.questionResponsesLatestBlock) ||
            Number(questionsCache?.lastBlock) ||
            0;

          const sbtLastBlock = Number(sbtCache?.lastBlock) || 0;

          const minLastBlock = Math.min(surveyLastBlock, questionLastBlock, sbtLastBlock);
          if (!(minLastBlock >= latestBlockNumber && latestBlockNumber > 0)) {
            return false;
          }
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    const scopeEntry = scopeEntries[0];
    if (scopeEntry?.isWorkerCanonical) return this._isWorkerScopeEntryReady(scopeEntry);
    const networkID = String(scopeEntry?.netKey || '');
    if (!networkID || !scopeEntry) return false;

    const surveysCache = scopeEntry.surveysCache || {};
    const questionsCache = scopeEntry.questionsCache || {};
    const sbtCache = scopeEntry.sbtCache || {};

    if (!this._countKeys(surveysCache) || !this._countKeys(questionsCache) || !this._countKeys(sbtCache)) {
      return false;
    }

    const surveyLastBlock = Number(surveysCache.surveysLatestBlock) || Number(surveysCache.lastBlock) || 0;
    const questionLastBlock =
      Number(questionsCache.questionsLatestBlock) ||
      Number(questionsCache.questionResponsesLatestBlock) ||
      Number(questionsCache.lastBlock) ||
      0;
    const sbtLastBlock = Number(sbtCache.lastBlock) || 0;

    // Get the latest block number from chain (group-aware)
    let latestBlockNumber = 0;
    const activeSlug = normalizeSessionSlug(scopeEntry.slug || this._currentSlug());
    try {
      const { toBlock } = await contractScriptsWithBlockWindow.getRelevantBlockWindowForFilter(activeSlug);
      latestBlockNumber = Number(toBlock || 0);
    } catch (err) {
      try {
        latestBlockNumber = await contractScripts.getLatestBlockNumber('none', activeSlug);
      } catch (_) {
        return false;
      }
    }

    const minLastBlock = Math.min(surveyLastBlock, questionLastBlock, sbtLastBlock);
    return latestBlockNumber > 0 && minLastBlock >= latestBlockNumber;
  };

  _computeNextPollDelayMs = () => {
    const elapsed = Math.max(0, Date.now() - Number(this._statsPollStartedAtMs || 0));
    if (elapsed >= 120000) {
      return 60000;
    }
    if (elapsed < 30000) {
      if (this._statsUnchangedStreak >= 10) return 5000;
      if (this._statsUnchangedStreak >= 5) return 2500;
      return 1000;
    }
    if (this._statsUnchangedStreak >= 3) return 45000;
    return 30000;
  };

  _isDocumentHidden = () => {
    if (typeof document === 'undefined') return false;
    try {
      return document.hidden === true || document.visibilityState === 'hidden';
    } catch (_) {
      return false;
    }
  };

  _computeFallbackPollDelayMs = () => {
    if (this._isDocumentHidden()) return 120000;
    if (!this.state.initialLoadDone) return 15000;
    return 60000;
  };

  _clearStatsPollTimer = () => {
    if (this._statsPollTimer) {
      clearTimeout(this._statsPollTimer);
      this._statsPollTimer = null;
    }
  };

  _flushQueuedCacheUpdateRefresh = () => {
    if (this._isUnmounted || this._isDocumentHidden()) return;
    const force = !!this._cacheUpdateRefreshQueuedForce;
    this._cacheUpdateRefreshQueuedForce = false;
    this._refreshCommunityStats({ force, markLoading: false });
  };

  _queueCacheDrivenRefresh = ({ force = false }: any = {}) => {
    if (this._isUnmounted || this._isDocumentHidden()) return;
    this._resetUsersFilterForSelection();
    this._cacheUpdateRefreshQueuedForce = this._cacheUpdateRefreshQueuedForce || !!force;
    if (this._statsCacheRefreshCoalescer) {
      this._statsCacheRefreshCoalescer.schedule();
      return;
    }
    this._flushQueuedCacheUpdateRefresh();
  };

  _scheduleNextStatsPoll = (delayMs: any = null) => {
    if (this._isUnmounted) return;
    this._clearStatsPollTimer();
    const fallbackDelay = this._computeFallbackPollDelayMs();
    const safeDelay = delayMs == null ? fallbackDelay : Math.max(0, Number(delayMs) || 0);
    this._statsPollTimer = setTimeout(async () => {
      this._statsPollTimer = null;
      if (this._isUnmounted) return;
      if (!this._isDocumentHidden()) {
        await this.updateStatsPeriodically();
      }
      this._scheduleNextStatsPoll(this._computeFallbackPollDelayMs());
    }, safeDelay);
  };

  _statsSelectionKey = () => {
    const selection = this._readGlobalSelection();
    return JSON.stringify([
      selection.primarySessionSlug,
      selection.selectedSessionScope,
      selection.selectedSessionSlugs,
      normalizeSessionSlug(this._resolveRouteSlug()),
      String(this.props.account || '')
        .trim()
        .toLowerCase(),
      this.props.sessionConfig?.sessionId,
      this.props.sessionConfig?.corsWorkerUrl,
    ]);
  };

  _resetUsersFilterForSelection = () => {
    const selectionKey = this._statsSelectionKey();
    if (!this.state.showModal || this.state.modalType !== 'users' || this._usersFilterSelectionKey === selectionKey) {
      return;
    }
    this._usersFilterSelectionKey = selectionKey;
    this._usersFilterGeneration += 1;
    this.setState({ usersFilterSelectionKey: null, filteredUsers: [], loadingFilter: true });
  };

  _updateUsersFilter = (generation: number, selectionKey: string, patch: Record<string, unknown>) => {
    // A filter may finish after unmount, or after A → B → A. Scope equality
    // alone cannot distinguish that obsolete filter from the current one.
    this.setState((state: Readonly<CommunityTab['state']>) =>
      !this._isUnmounted &&
      generation === this._usersFilterGeneration &&
      selectionKey === this._statsSelectionKey() &&
      state.usersFilterSelectionKey === selectionKey &&
      state.showModal &&
      state.modalType === 'users'
        ? patch
        : null,
    );
  };

  _runStatsRefreshCycle = async ({ force = false, markLoading = false, request = null }: any = {}) => {
    if (this._isUnmounted) return { changed: false };
    this._resetUsersFilterForSelection();
    const selectionKey = this._statsSelectionKey();
    const isCurrent = () =>
      !this._isUnmounted &&
      selectionKey === this._statsSelectionKey() &&
      (!request || this._activeStatsRefresh === request);
    if (this.state.initialLoadSelectionKey !== selectionKey) {
      this._lastInitialLoadCheckMs = 0;
      this.setState({ initialLoadDone: false, initialLoadSelectionKey: selectionKey });
    }
    this._refreshSessionCatalog();

    if (markLoading && (!this.state.loadingSbtsCreated || !this.state.loadingSurveyData)) {
      this.setState({ loadingSbtsCreated: true, loadingSurveyData: true });
    }

    let changed = false;
    let snapshot: any = null;

    const scopeEntries = this._iterScopeCaches({ clone: false });
    await this._hydrateWorkerGroupCounts(scopeEntries);
    if (!isCurrent()) return { changed: false };
    const coarseSignature = this._buildCoarseCacheSignature(scopeEntries);
    let signature = this._latestCacheSignature;
    if (force || coarseSignature !== this._latestCoarseCacheSignature) {
      signature = this._buildCacheSignature(scopeEntries);
      this._latestCoarseCacheSignature = coarseSignature;
    }
    const nextBeeswarmPoints = this._buildCommunityBeeswarmPoints(scopeEntries);
    this._beeswarmPoints = nextBeeswarmPoints;

    if (force || signature !== this._latestCacheSignature) {
      snapshot = this._computeStatsSnapshot(scopeEntries);
      this._latestCacheSignature = signature;
      this._statsUnchangedStreak = 0;
      changed = true;
    } else {
      this._statsUnchangedStreak += 1;
    }

    this.setState((prevState: Readonly<CommunityTab['state']>) => {
      if (!isCurrent()) return null;
      const next: Record<string, any> = {};
      if (prevState.showModal && prevState.modalType === 'questions') {
        // Prompt hydration does not change counter signatures, but the open table must still refresh.
        const questionsTableSignature = JSON.stringify(this._getQuestionDetailsRows(scopeEntries));
        if (questionsTableSignature !== prevState.questionsTableSignature) {
          next.questionsTableSignature = questionsTableSignature;
        }
      }
      if (changed && snapshot) {
        next.uniqueUsers = snapshot.uniqueUsers;
        next.usersSnapshotSelectionKey = selectionKey;
        next.surveysCreatedCount = snapshot.surveysCreatedCount;
        next.surveyResponsesCount = snapshot.surveyResponsesCount;
        next.uniqueQuestionsCount = snapshot.uniqueQuestionsCount;
        next.surveysList = snapshot.surveysList;
        next.sbtsCreatedCount = snapshot.sbtsCreatedCount;
        next.lastSbtGroupsCount = snapshot.sbtsCreatedCount;
        if (
          prevState.showModal &&
          prevState.modalType === 'users' &&
          (prevState.usersFilterSelectionKey !== selectionKey ||
            (!prevState.loadingFilter &&
              this._areAddressListsEqual(prevState.filteredUsers || [], prevState.uniqueUsers || [])))
        ) {
          next.filteredUsers = snapshot.uniqueUsers;
          next.usersFilterSelectionKey = selectionKey;
          next.loadingFilter = false;
        }
        next.stats = this._buildStatsArray(prevState.stats, {
          users: snapshot.uniqueUsers.length,
          // This tile opens the all-type table; the separate plot remains binary-only.
          questions: this._getQuestionDetailsRows(scopeEntries).length,
          surveys: snapshot.surveysCreatedCount,
          groups: snapshot.sbtsCreatedCount,
        });
      }
      if (prevState.loadingSbtsCreated) next.loadingSbtsCreated = false;
      if (prevState.loadingSurveyData) next.loadingSurveyData = false;
      return Object.keys(next).length ? next : null;
    });

    // Cached counts are useful before a slow chain readiness check settles.
    // A newer selection also owns readiness; old asynchronous work cannot publish it.
    if (!this.state.initialLoadDone && isCurrent()) {
      const now = Date.now();
      const checkIntervalMs = force ? 0 : this._statsUnchangedStreak >= 3 ? 5000 : 2000;
      if (now - this._lastInitialLoadCheckMs >= checkIntervalMs) {
        this._lastInitialLoadCheckMs = now;
        const loadDone = await this.checkIfInitialLoadDone();
        if (loadDone && isCurrent()) {
          this.setState(() => (isCurrent() ? { initialLoadDone: true } : null));
        }
      }
    }

    return { changed };
  };

  _refreshCommunityStats = async ({ force = false, markLoading = false }: any = {}) => {
    if (this._isUnmounted) return { changed: false };
    const selectionKey = this._statsSelectionKey();
    if (this._statsRefreshInFlight && this._statsRefreshSelectionKey === selectionKey) {
      this._statsRefreshQueued = true;
      this._statsRefreshQueuedForce = this._statsRefreshQueuedForce || force;
      this._statsRefreshQueuedLoading = this._statsRefreshQueuedLoading || markLoading;
      return { changed: false, queued: true };
    }

    // Switching scopes supersedes pending I/O. Its eventual finally block must
    // not unlock or drain the refresh that belongs to the newer selection.
    const request = {};
    this._activeStatsRefresh = request;
    this._statsRefreshSelectionKey = selectionKey;
    this._statsRefreshQueued = false;
    this._statsRefreshQueuedForce = false;
    this._statsRefreshQueuedLoading = false;
    this._statsRefreshInFlight = true;
    let result = { changed: false };
    try {
      result = await this._runStatsRefreshCycle({ force, markLoading, request });
    } catch (error) {
      uiLog.error('CommunityTab refresh failed:', error);
      if (this._activeStatsRefresh === request) {
        this.setState({ loadingSbtsCreated: false, loadingSurveyData: false });
      }
    } finally {
      if (this._activeStatsRefresh === request) {
        this._statsRefreshInFlight = false;
        if (this._statsRefreshQueued && !this._isUnmounted) {
          const queuedForce = this._statsRefreshQueuedForce;
          const queuedLoading = this._statsRefreshQueuedLoading;
          this._statsRefreshQueued = false;
          this._statsRefreshQueuedForce = false;
          this._statsRefreshQueuedLoading = false;
          setTimeout(() => {
            this._refreshCommunityStats({ force: queuedForce, markLoading: queuedLoading });
          }, 0);
        }
      }
    }
    return result;
  };

  _ensureUniverseWarmup = () => {
    if (
      this._isUniverseEnabled() &&
      typeof this.props.ensureLightSbtUniverse === 'function' &&
      !this._universeKickoffDone
    ) {
      this._universeKickoffDone = true;
      try {
        this.props.ensureLightSbtUniverse();
      } catch (e) {
        uiLog.warn('CommunityTab: callback', e);
      }
    }
  };

  componentDidMount() {
    uiLog.log('CommunityTab mounted. Fetching initial data...');
    this._isUnmounted = false;
    this._refreshSessionCatalog();
    this._statsPollStartedAtMs = Date.now();
    this._statsUnchangedStreak = 0;
    this._latestCacheSignature = '';
    this._latestCoarseCacheSignature = '';
    this.setState({ initialLoadDone: false, loadingSbtsCreated: true, loadingSurveyData: true });
    this._ensureUniverseWarmup();

    this._statsCacheRefreshCoalescer = createCacheUpdateCoalescer(
      () => {
        this._flushQueuedCacheUpdateRefresh();
      },
      { delayMs: 24 },
    );
    this._cacheUpdateUnsubscribe = subscribeCacheUpdates((evt: any) => {
      const ns = String(evt?.namespace || '');
      if (ns === 'surveysCache' || ns === 'questionsCache' || ns === 'sbtCache') {
        this._queueCacheDrivenRefresh({ force: false });
      }
    });
    this._workerGroupsChangedUnsubscribe = subscribeWorkerGroupsChanged(this._handleWorkerGroupsChanged);
    if (typeof document !== 'undefined') {
      this._visibilityListenerBound = () => {
        if (this._isUnmounted) return;
        if (this._isDocumentHidden()) {
          this._scheduleNextStatsPoll(this._computeFallbackPollDelayMs());
          return;
        }
        this._queueCacheDrivenRefresh({ force: true });
        this._scheduleNextStatsPoll(this._computeFallbackPollDelayMs());
      };
      document.addEventListener('visibilitychange', this._visibilityListenerBound);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._globalSessionSelectionListener = () => {
        if (this._isUnmounted) return;
        this._ensureUniverseWarmup();
        this._queueCacheDrivenRefresh({ force: true });
      };
      window.addEventListener(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, this._globalSessionSelectionListener);
      window.addEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, this._refreshSessionCatalog);
      window.addEventListener(SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT, this._handleWorkerSessionCatalogUpdate);
    }

    // Eagerly start SBT holder hydration so uniqueUsers is complete before modal opens
    this._eagerHydrationTimer = setTimeout(() => {
      if (!this._isUnmounted) this._hydrateSbtHoldersForUsersModal();
    }, 1500);

    this._scheduleNextStatsPoll(0);
  }

  componentWillUnmount() {
    this._isUnmounted = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, this._refreshSessionCatalog);
      window.removeEventListener(SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT, this._handleWorkerSessionCatalogUpdate);
    }
    this._holdersHydrationAbort = true;
    if (this._eagerHydrationTimer) {
      clearTimeout(this._eagerHydrationTimer);
      this._eagerHydrationTimer = null;
    }
    this._clearStatsPollTimer();
    if (this._statsCacheRefreshCoalescer) {
      this._statsCacheRefreshCoalescer.cancel();
      this._statsCacheRefreshCoalescer = null;
    }
    if (typeof this._cacheUpdateUnsubscribe === 'function') {
      try {
        this._cacheUpdateUnsubscribe();
      } catch (e) {
        uiLog.warn('CommunityTab: cleanup', e);
      }
    }
    this._cacheUpdateUnsubscribe = null;
    if (typeof this._workerGroupsChangedUnsubscribe === 'function') {
      try {
        this._workerGroupsChangedUnsubscribe();
      } catch (e) {
        uiLog.warn('CommunityTab: cleanup', e);
      }
    }
    this._workerGroupsChangedUnsubscribe = null;
    if (this._visibilityListenerBound && typeof document !== 'undefined') {
      try {
        document.removeEventListener('visibilitychange', this._visibilityListenerBound);
      } catch (e) {
        uiLog.warn('CommunityTab: cleanup', e);
      }
    }
    this._visibilityListenerBound = null;
    if (this._globalSessionSelectionListener && typeof window !== 'undefined') {
      try {
        window.removeEventListener(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, this._globalSessionSelectionListener);
      } catch (e) {
        uiLog.warn('CommunityTab: cleanup', e);
      }
    }
    this._globalSessionSelectionListener = null;
  }

  updateStatsPeriodically = async () => {
    await this._refreshCommunityStats({ force: false, markLoading: false });
  };

  componentDidUpdate(prevProps: any, prevState: any) {
    this._resetUsersFilterForSelection();
    const globalSelectionChanged =
      prevProps.globalSessionSelection?.primarySessionSlug !== this.props.globalSessionSelection?.primarySessionSlug ||
      prevProps.globalSessionSelection?.selectedSessionScope !==
        this.props.globalSessionSelection?.selectedSessionScope ||
      JSON.stringify(prevProps.globalSessionSelection?.selectedSessionSlugs) !==
        JSON.stringify(this.props.globalSessionSelection?.selectedSessionSlugs);
    const cacheInputsChanged =
      prevProps.network?.id !== this.props.network?.id ||
      prevProps.provider !== this.props.provider ||
      prevProps.account !== this.props.account ||
      prevProps.sbtCacheRevision !== this.props.sbtCacheRevision ||
      prevProps.isSBTCacheReady !== this.props.isSBTCacheReady ||
      prevProps.isSurveyCacheReady !== this.props.isSurveyCacheReady ||
      prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady ||
      prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady ||
      prevProps.questionResponsesNonce !== this.props.questionResponsesNonce ||
      prevProps.activeSessionSlug !== this.props.activeSessionSlug ||
      prevProps.sessionConfig !== this.props.sessionConfig ||
      globalSelectionChanged;

    if (cacheInputsChanged) {
      this._ensureUniverseWarmup();
      this._queueCacheDrivenRefresh({ force: true });
      this._scheduleNextStatsPoll(this._computeFallbackPollDelayMs());
    }

    if (!prevState?.showModal && this.state.showModal && this.state.modalType === 'users') {
      this._hydrateSbtHoldersForUsersModal();
    }
  }

  // --- UPDATED: wrappers keep existing call sites stable while sharing one refresh pass ---
  fetchSbtsCreatedCount = async () => {
    await this._refreshCommunityStats({ force: true, markLoading: true });
  };

  fetchSurveyDataFromCache = async () => {
    await this._refreshCommunityStats({ force: true, markLoading: true });
  };

  updateSbtGroupsCountFromCache = () => {
    this._queueCacheDrivenRefresh({ force: false });
  };

  handleUserClick = (user: any) => {
    if (user.username.startsWith('0x')) {
      window.open(buildPublicRoute(`/u/${user.username}`), '_blank', 'noopener,noreferrer');
    } else {
      window.open(buildPublicRoute(`/su/${user.username}`), '_blank', 'noopener,noreferrer');
    }
  };

  // --- Updated handleStatClick to initialize filteredUsers ---
  handleStatClick = (stat: any) => {
    const labelKey = String(stat.label || '')
      .toLowerCase()
      .replace(/\s+/g, '');
    if (labelKey === 'sessions') this._refreshSessionCatalog();
    this._usersFilterGeneration += 1;
    if (labelKey === 'users') {
      const selectionKey = this._statsSelectionKey();
      const ready = this.state.usersSnapshotSelectionKey === selectionKey;
      this._usersFilterSelectionKey = selectionKey;
      this.setState({
        modalTitle: `${stat.label} Details`,
        modalType: 'users',
        showModal: true,
        usersFilterSelectionKey: ready ? selectionKey : null,
        filteredUsers: ready ? this.state.uniqueUsers : [],
        loadingFilter: !ready,
      });
      if (!ready) this._queueCacheDrivenRefresh({ force: true });
    } else if (labelKey === 'groups' || labelKey === 'sbts' || labelKey === 'sbtgroups') {
      this.setState({
        modalTitle: t('sbts'),
        modalType: 'sbtgroups',
        showModal: true,
      });
    } else {
      this.setState({
        modalTitle: `${stat.label} Details`,
        modalType: labelKey,
        showModal: true,
      });
    }
  };

  // Helper to toggle modal visibility
  toggleModal = () => {
    this._usersFilterGeneration += 1;
    this.setState((prevState: Readonly<CommunityTab['state']>) => ({
      showModal: !prevState.showModal,
      modalType: !prevState.showModal ? prevState.modalType : null,
      modalTitle: !prevState.showModal ? prevState.modalTitle : '',
    }));
  };

  _getSingleSelectedWorkerScope = (): ScopeCacheEntry | null => {
    const scopeEntries = this._iterScopeCaches({ clone: false });
    return scopeEntries.length === 1 && scopeEntries[0].isWorkerCanonical ? scopeEntries[0] : null;
  };

  _buildLeaderboardUsersSignature = (users: any = []) =>
    Array.isArray(users) ? users.map((value: any) => String(value || '')).join('|') : '';

  getMemoizedLeaderboardData = () => {
    const { uniqueUsers, hideSimulatedUsers, hideHumanUsers } = this.state;
    const uniqueUsersList = Array.isArray(uniqueUsers) ? uniqueUsers : [];
    const memo = this._leaderboardMemo || {};
    const usersSignature = this._buildLeaderboardUsersSignature(uniqueUsersList);
    if (
      memo.uniqueUsersRef === uniqueUsersList &&
      memo.uniqueUsersLength === uniqueUsersList.length &&
      memo.uniqueUsersSignature === usersSignature &&
      memo.hideSimulatedUsers === !!hideSimulatedUsers &&
      memo.hideHumanUsers === !!hideHumanUsers
    ) {
      return memo.result || [];
    }

    const byUsername: any = new Map();
    if (!hideSimulatedUsers) {
      historicalFigures.forEach((user: any) => {
        const username = String(user?.username || '');
        if (!username || byUsername.has(username)) return;
        byUsername.set(username, user);
      });
    }
    if (!hideHumanUsers) {
      uniqueUsersList.forEach((address: any) => {
        const username = String(address || '');
        if (!username || byUsername.has(username)) return;
        byUsername.set(username, {
          name: username,
          username,
        });
      });
    }

    const result = Array.from(byUsername.values());
    result.sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || '')));

    this._leaderboardMemo = {
      uniqueUsersRef: uniqueUsersList,
      uniqueUsersLength: uniqueUsersList.length,
      uniqueUsersSignature: usersSignature,
      hideSimulatedUsers: !!hideSimulatedUsers,
      hideHumanUsers: !!hideHumanUsers,
      result,
    };
    return result;
  };

  _parseCachedJson = (value: any) => {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (_) {
        return null;
      }
    }
    return typeof value === 'object' ? value : null;
  };

  _normalizeBinaryVoteValue = (value: any) => {
    if (value === 1 || value === '1' || value === true) return 1;
    if (value === -1 || value === '-1' || value === false) return -1;
    if (value === 0 || value === '0') return 0;

    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (normalized === 'agree' || normalized === 'yes' || normalized === 'true') return 1;
    if (normalized === 'disagree' || normalized === 'no' || normalized === 'false') return -1;
    if (normalized === 'unsure' || normalized === 'neutral' || normalized === 'unknown') return 0;
    return null;
  };

  _extractBinaryVoteRecord = (rawResponse: any, fallbackQuestion: any = {}) => {
    const response = this._parseCachedJson(rawResponse);
    if (!response || typeof response !== 'object') return null;

    const answer = response?.answer;
    if (!answer || typeof answer !== 'object' || answer.encrypted || answer.value === '*') {
      return null;
    }

    const vote = this._normalizeBinaryVoteValue(answer.value);
    if (vote == null) return null;

    const responseType = String(response?.type || fallbackQuestion?.type || '')
      .trim()
      .toLowerCase();
    if (responseType && responseType !== 'binary') return null;

    return {
      vote,
      type: 'binary',
      prompt: response?.prompt || fallbackQuestion?.prompt || '',
    };
  };

  _rememberBeeswarmQuestion = (questionMap: any, questionId: any, question: any = {}) => {
    const qid = String(questionId || '').toLowerCase();
    if (!qid) return;

    const existing = questionMap.get(qid) || {};
    questionMap.set(qid, {
      ...existing,
      type: existing.type || question?.type || '',
      prompt: existing.prompt || question?.prompt || '',
    });
  };

  _shouldUseDemoBeeswarmData = () => {
    const scopeEntries = this._iterScopeCaches({ clone: false });
    if (!Array.isArray(scopeEntries) || scopeEntries.length !== 1) return false;
    const activeSlug = normalizeSessionSlug(scopeEntries[0]?.slug || this._currentSlug() || '');
    if (!activeSlug) return false;
    return (
      Array.isArray(POLIS_DEMO_DATA_AUTOLOAD_SLUGS) &&
      POLIS_DEMO_DATA_AUTOLOAD_SLUGS.map((slug: any) => normalizeSessionSlug(slug)).includes(activeSlug)
    );
  };

  _buildDemoBeeswarmPoints = (slugOverride: string | null = null) => {
    const scopeEntries = this._iterScopeCaches({ clone: false });
    const activeSlug = normalizeSessionSlug(scopeEntries[0]?.slug || this._currentSlug() || '');
    const requestedSlug = normalizeSessionSlug(slugOverride || activeSlug || COMMUNITY_BEESWARM_FALLBACK_DEMO_SLUG);
    const dataset = getPolisDemoDatasetForSlug(requestedSlug, {
      allowFallback: false,
    }) as {
      comments?: unknown[];
      participantsVotes?: unknown[];
    } | null;
    const comments = Array.isArray(dataset?.comments) ? dataset.comments : [];
    const binaryComments = comments.filter((c: any) => {
      const t = String(c?.type || '')
        .trim()
        .toLowerCase();
      return !t || t === 'binary';
    });
    const ratingMatrixResult = buildRatingMatrixFromDemo(dataset);
    const ratingMatrix = Array.isArray(ratingMatrixResult?.matrix) ? ratingMatrixResult.matrix : [];
    if (!binaryComments.length || !ratingMatrix.length) return [];

    return buildCommunityBeeswarmPointsFromResults({
      questions: binaryComments.map((comment: any, index: number) => ({
        label: String(comment?.commentBody || '(No prompt)'),
        questionId: String(comment?.commentId || index),
      })),
      ratingMatrix,
      results: computeQuestionDivisiveness(ratingMatrix),
    });
  };

  _isZeroResponseBundledDemoPointSet = (points: any[] = []) => {
    if (!Array.isArray(points) || points.length === 0) return false;
    if (points.some((point: any) => Math.max(0, Number(point?.total || 0)) > 0)) return false;

    const dataset = getPolisDemoDatasetForSlug(COMMUNITY_BEESWARM_FALLBACK_DEMO_SLUG, {
      allowFallback: false,
    }) as { comments?: unknown[] } | null;
    const binaryComments = (Array.isArray(dataset?.comments) ? dataset.comments : []).filter((comment: any) => {
      const type = String(comment?.type || '')
        .trim()
        .toLowerCase();
      return !type || type === 'binary';
    });
    if (binaryComments.length !== points.length) return false;

    const expectedIds = new Set(binaryComments.map((comment: any) => String(comment?.commentId || '').toLowerCase()));
    const pointIds = points.map((point: any) => String(point?.questionId || '').toLowerCase());
    if (pointIds.every((questionId: string) => questionId && expectedIds.has(questionId))) return true;

    const expectedLabels = new Set(binaryComments.map((comment: any) => String(comment?.commentBody || '').trim()));
    return points.every((point: any) => {
      const label = String(point?.label || '').trim();
      return label && expectedLabels.has(label);
    });
  };

  _buildCommunityBeeswarmPoints = (scopeEntriesOverride: any = null) => {
    if (this._shouldUseDemoBeeswarmData()) {
      return this._buildDemoBeeswarmPoints();
    }

    const questionMap: any = new Map();
    const combinedResponses: any = new Map();
    const scopeEntries = Array.isArray(scopeEntriesOverride)
      ? scopeEntriesOverride
      : this._iterScopeCaches({ clone: false });

    scopeEntries.forEach(({ questionsCache }: any) => {
      Object.entries(questionsCache?.questions || {}).forEach(([questionId, question]: any) => {
        this._rememberBeeswarmQuestion(questionMap, questionId, question);
      });
    });

    scopeEntries.forEach(({ questionsCache }: any) => {
      Object.entries(questionsCache?.questionResponses || {}).forEach(([questionId, perQuestionResponses]: any) => {
        const qid = String(questionId || '').toLowerCase();
        if (!qid) return;

        const knownQuestion = questionMap.get(qid) || {};
        Object.entries(perQuestionResponses || {}).forEach(([responderAddress, rawResponse]: any) => {
          const responder = String(responderAddress || '').toLowerCase();
          if (!responder) return;

          const voteRecord = this._extractBinaryVoteRecord(rawResponse, knownQuestion);
          if (!voteRecord) return;

          this._rememberBeeswarmQuestion(questionMap, qid, {
            ...knownQuestion,
            type: voteRecord.type,
            prompt: voteRecord.prompt,
          });

          if (!combinedResponses.has(qid)) combinedResponses.set(qid, {});
          combinedResponses.get(qid)[responder] = voteRecord.vote;
        });
      });
    });

    scopeEntries.forEach(({ surveysCache }: any) => {
      Object.values(surveysCache?.surveyResponses || {}).forEach((responsesByResponder: any) => {
        Object.entries(responsesByResponder || {}).forEach(([responderAddress, rawSurveyResponse]: any) => {
          const responder = String(responderAddress || '').toLowerCase();
          const parsedSurveyResponse = this._parseCachedJson(rawSurveyResponse);
          if (!responder || !parsedSurveyResponse || !Array.isArray(parsedSurveyResponse.responses)) return;

          parsedSurveyResponse.responses.forEach((responseEntry: any) => {
            const qid = String(
              responseEntry?.questionID || responseEntry?.questionId || responseEntry?.id || '',
            ).toLowerCase();
            if (!qid) return;

            const knownQuestion = questionMap.get(qid) || {};
            const voteRecord = this._extractBinaryVoteRecord(responseEntry, knownQuestion);
            if (!voteRecord) return;

            this._rememberBeeswarmQuestion(questionMap, qid, {
              ...knownQuestion,
              type: voteRecord.type,
              prompt: voteRecord.prompt,
            });

            if (!combinedResponses.has(qid)) combinedResponses.set(qid, {});
            combinedResponses.get(qid)[responder] = voteRecord.vote;
          });
        });
      });
    });

    const binaryQuestionIds = Array.from(questionMap.entries())
      .filter(
        ([, question]: any) =>
          String(question?.type || '')
            .trim()
            .toLowerCase() === 'binary',
      )
      .map(([questionId]: any) => questionId)
      .sort((left: any, right: any) => String(left).localeCompare(String(right)));

    if (!binaryQuestionIds.length) return [];

    const responders = Array.from(
      binaryQuestionIds.reduce((set: any, questionId: any) => {
        Object.keys(combinedResponses.get(questionId) || {}).forEach((responder: any) => set.add(responder));
        return set;
      }, new Set()),
    ).sort((left: any, right: any) => String(left).localeCompare(String(right)));

    const participantIndexMap: any = new Map(responders.map((responder: any, index: any) => [responder, index]));
    const ratingMatrix = binaryQuestionIds.map(() => Array(responders.length).fill(null));

    binaryQuestionIds.forEach((questionId: any, rowIndex: any) => {
      Object.entries(combinedResponses.get(questionId) || {}).forEach(([responder, vote]: any) => {
        const participantIndex = participantIndexMap.get(responder);
        if (participantIndex !== undefined) {
          ratingMatrix[rowIndex][participantIndex] = vote;
        }
      });
    });

    return buildCommunityBeeswarmPointsFromResults({
      questions: binaryQuestionIds.map((questionId: any) => ({
        label: questionMap.get(questionId)?.prompt || '(No prompt)',
        questionId,
      })),
      ratingMatrix,
      results: computeQuestionDivisiveness(ratingMatrix),
    });
  };

  renderLeaderboard() {
    const { showMoreLeaderboard } = this.state;
    const uniqueLeaderboardData = this.getMemoizedLeaderboardData();

    const topEntries = 4; // Number of entries to show initially
    const topDisplayed = uniqueLeaderboardData.slice(0, topEntries);
    const remainingEntries = uniqueLeaderboardData.slice(topEntries);

    // Consistent blockie generator using shared utility and stable lowercase seed
    const getBlockieUrl = (seedStr: any) => {
      const seed = String(seedStr || 'contextengine-default-seed').toLowerCase();
      return generateBlockieDataUrl(seed, 8, 4);
    };
    const resolveLeaderboardAvatar = (user: any) => {
      const username = String(user?.username || '').trim();
      const isSimulatedUser = username && !username.startsWith('0x');
      if (isSimulatedUser) {
        return getHistoricalFigureAvatarOrBlockie(username, {
          preferBlockie: false,
          fallbackSeed: user?.name || username,
        });
      }
      return getBlockieUrl(username);
    };
    const handleLeaderboardAvatarError = (event: any, user: any) => {
      const target = event?.currentTarget;
      const username = String(user?.username || '').trim();
      if (!target || !username) return;
      const fallbackSrc = username.startsWith('0x')
        ? getBlockieUrl(username)
        : getHistoricalFigureBlockie(username, { fallbackSeed: user?.name || username });
      if (!fallbackSrc || target.src === fallbackSrc) return;
      target.src = fallbackSrc;
    };

    if (uniqueLeaderboardData.length === 0) {
      return <div className={styles.noUsers}>None yet!</div>;
    }

    return (
      <>
        {topDisplayed.map((user: any, index: any) => {
          const imgSrc = resolveLeaderboardAvatar(user);

          return (
            <div key={index} className={styles.leaderboardItem} onClick={() => this.handleUserClick(user)}>
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={user.name}
                  className={styles.avatar}
                  onError={(event: any) => handleLeaderboardAvatarError(event, user)}
                />
              ) : null}
              <span className={styles.name}>
                {user.username.startsWith('0x') && <>{getShortenedAddress(user.name, true)}</>}
                {!user.username.startsWith('0x') && (
                  <>
                    {user.name}
                    <span className={styles.simBadge} id={`sim-tooltip-${index}`}>
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                    </span>
                    <CETooltip placement="right" target={`sim-tooltip-${index}`}>
                      This is a simulated user.
                    </CETooltip>
                  </>
                )}
              </span>
            </div>
          );
        })}

        <Collapse isOpen={showMoreLeaderboard}>
          {remainingEntries.map((user: any, index: any) => {
            const imgSrc = resolveLeaderboardAvatar(user);

            return (
              <div
                key={index + topEntries} // Ensure unique key
                className={styles.leaderboardItem}
                onClick={() => this.handleUserClick(user)}
              >
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={user.name}
                    className={styles.avatar}
                    onError={(event: any) => handleLeaderboardAvatarError(event, user)}
                  />
                ) : null}
                <span className={styles.name}>
                  {user.username.startsWith('0x') && <>{getShortenedAddress(user.name, true)}</>}
                  {!user.username.startsWith('0x') && (
                    <>
                      {user.name}
                      <span
                        className={styles.simBadge}
                        id={`sim-tooltip-${index + topEntries}`} // Ensure unique ID
                      >
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                      </span>
                      <CETooltip
                        placement="right"
                        target={`sim-tooltip-${index + topEntries}`} // Ensure unique target
                      >
                        This is a simulated user.
                      </CETooltip>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </Collapse>

        {uniqueLeaderboardData.length > topEntries && (
          <button
            onClick={() =>
              this.setState((prevState: Readonly<CommunityTab['state']>) => ({
                showMoreLeaderboard: !prevState.showMoreLeaderboard,
              }))
            }
            className={styles.showMoreButton}
          >
            {showMoreLeaderboard ? (
              <>
                Show Less <FontAwesomeIcon icon={faChevronUp} />
              </>
            ) : (
              // MODIFIED: Include count in button text
              <>
                Show More ({remainingEntries.length}) <FontAwesomeIcon icon={faChevronDown} />
              </>
            )}
          </button>
        )}
      </>
    );
  }

  renderQuestionSwarm(view = this._getQuestionSwarmView()) {
    const { points, scopeLabel, isDemoFallback } = view;
    return (
      <section className={styles.beeswarmSection} data-testid="ce-community-beeswarm-section">
        {isDemoFallback && (
          <p className={styles.scopeLabel} data-testid="ce-community-beeswarm-session">
            {scopeLabel}
          </p>
        )}
        <BeeswarmPlot
          points={points}
          className={styles.beeswarmPlot}
          domain={COMMUNITY_BEESWARM_DOMAIN}
          height={220}
          showIdleSummary={false}
        />
      </section>
    );
  }

  _getQuestionSwarmView = () => {
    if (this._shouldUseDemoBeeswarmData()) {
      const scopeEntries = this._iterScopeCaches({ clone: false });
      const slug = scopeEntries[0]?.slug || this._currentSlug();
      return {
        points: this._buildDemoBeeswarmPoints(),
        scopeLabel: `Demo session: ${this._sessionDisplayName(slug)}`,
        isDemoFallback: false,
      };
    }
    const points =
      Array.isArray(this._beeswarmPoints) && this._beeswarmPoints.length > 0
        ? this._beeswarmPoints
        : this._buildCommunityBeeswarmPoints();
    if (this._isZeroResponseBundledDemoPointSet(points)) {
      return {
        points: this._buildDemoBeeswarmPoints(COMMUNITY_BEESWARM_FALLBACK_DEMO_SLUG),
        scopeLabel: `Demo session: ${this._sessionDisplayName(COMMUNITY_BEESWARM_FALLBACK_DEMO_SLUG)}`,
        isDemoFallback: true,
      };
    }
    return { points, scopeLabel: this._communityScopeLabel(), isDemoFallback: false };
  };

  _getQuestionSwarmPoints = () => this._getQuestionSwarmView().points;

  _getQuestionDetailsRows = (
    scopeEntries: ScopeCacheEntry[] = this._iterScopeCaches({ clone: false }),
  ): CommunityQuestionRow[] => {
    const rows: CommunityQuestionRow[] = [];
    const seen = new Set<string>();
    scopeEntries.forEach((scope) => {
      const sessionSlug = normalizeSessionSlug(scope.slug);
      // Scope authority already requires an exact config slug; never reuse a demo label for an unknown session.
      const sessionName = String(scope.sessionConfig?.sessionName || '').trim() || sessionSlug || 'General';
      const addQuestion = (id: unknown, rawQuestion: unknown) => {
        const questionId = String(id ?? '').trim();
        const key = JSON.stringify([sessionSlug, questionId]);
        if (!questionId || seen.has(key)) return;
        seen.add(key);
        const question = this._parseCachedJson(rawQuestion);
        const prompt = typeof question?.prompt === 'string' ? question.prompt.trim() : '';
        rows.push({
          sessionSlug,
          sessionName,
          questionId,
          prompt: prompt === '[encrypted]' ? 'Encrypted question' : prompt || `Question ${questionId}`,
        });
      };
      const cachedQuestions = scope.questionsCache?.questions;
      const entries =
        cachedQuestions && typeof cachedQuestions === 'object' && !Array.isArray(cachedQuestions)
          ? Object.entries(cachedQuestions)
          : [];
      entries.forEach(([questionId, question]) => addQuestion(questionId, question));
      // Worker scopes must stay identity-bound, even when their cache is empty or stale.
      if (!entries.length && !scope.isWorkerCanonical && POLIS_DEMO_DATA_AUTOLOAD_SLUGS.includes(sessionSlug)) {
        const dataset = getPolisDemoDatasetForSlug(sessionSlug, { allowFallback: false }) as {
          comments?: unknown[];
        } | null;
        const comments = Array.isArray(dataset?.comments) ? dataset.comments : [];
        comments.forEach((rawComment, index) => {
          const comment = this._parseCachedJson(rawComment);
          if (typeof comment?.commentBody === 'string') {
            addQuestion(comment.commentId ?? index, { prompt: comment.commentBody });
          }
        });
      }
    });
    return rows;
  };

  renderQuestionsModalContent = () => {
    const rows = this._getQuestionDetailsRows();
    return (
      <div className={styles.questionsModalContent}>
        <table
          className={styles.questionsTable}
          aria-label="Questions by session"
          data-testid={E2E_TESTIDS.COMMUNITY_QUESTIONS_TABLE}
        >
          <thead>
            <tr>
              <th scope="col">Session</th>
              <th scope="col">Question</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sessionSlug, sessionName, questionId, prompt }) => (
              <tr
                key={JSON.stringify([sessionSlug, questionId])}
                data-ce-session-slug={sessionSlug}
                data-ce-question-id={questionId}
              >
                <td>{sessionName}</td>
                <td>
                  <a href={`${buildSettingsSessionHref(sessionSlug)}#report`}>{prompt}</a>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={2}>No questions available for the selected sessions.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  renderLeaderboardControls() {
    const { showLeaderboardControls, hideSimulatedUsers, hideHumanUsers } = this.state;

    return (
      <div className={styles.leaderboardControlsWrap}>
        <button
          type="button"
          className={styles.sessionSelectorToggle}
          data-ce-control-appearance="frameless"
          aria-label="Leaderboard filters"
          data-testid="ce-community-leaderboard-controls-toggle"
          onClick={this.toggleLeaderboardControls}
        >
          <FontAwesomeIcon icon={faCog} />
        </button>
        {showLeaderboardControls ? (
          <div className={styles.leaderboardControlsPanel} data-testid="ce-community-leaderboard-controls-panel">
            <div className={styles.leaderboardControlsTitle}>Filters</div>
            <div className={styles.leaderboardControlsBody}>
              <label className={styles.leaderboardControlLabel}>
                <input
                  type="checkbox"
                  checked={hideSimulatedUsers}
                  onChange={() =>
                    this.setState((prevState: Readonly<CommunityTab['state']>) => ({
                      hideSimulatedUsers: !prevState.hideSimulatedUsers,
                    }))
                  }
                  className={styles.toggleCheckbox}
                  data-testid="ce-community-hide-simulated-users"
                />
                Hide Simulated Users
              </label>
              <label className={styles.leaderboardControlLabel}>
                <input
                  type="checkbox"
                  checked={hideHumanUsers}
                  onChange={() =>
                    this.setState((prevState: Readonly<CommunityTab['state']>) => ({
                      hideHumanUsers: !prevState.hideHumanUsers,
                    }))
                  }
                  className={styles.toggleCheckbox}
                  data-testid="ce-community-hide-users"
                />
                Hide Users
              </label>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  _setSessionFilter = (key: keyof CommunitySessionFilters, value: string) => {
    this.setState((state: any) => ({ sessionFilters: { ...state.sessionFilters, [key]: value } }));
  };

  renderSessionFilters = () =>
    renderCommunitySessionFilters({
      filters: this.state.sessionFilters,
      isExpanded: this.state.showSessionFilters,
      onFilterChange: this._setSessionFilter,
      onClear: () => this.setState({ sessionFilters: createCommunitySessionFilters() }),
    });

  renderSessionsModalContent = () => {
    const allSessions: CommunitySessionEntry[] = this.state.sessions;
    const sessions = filterCommunitySessions(allSessions, this.state.sessionFilters);
    const counts = countCommunitySessions(sessions);
    const hasFilters = Object.values(this.state.sessionFilters).some((value) => String(value).trim());
    const kindLabels = { centralized: 'Centralized', decentralized: 'Decentralized', unknown: 'Type unavailable' };
    return (
      <div className={styles.sessionsContent}>
        {this.renderSessionFilters()}
        {hasFilters && (
          <p id={SESSION_FILTER_SUMMARY_ID} className={styles.sessionFilterSummary} role="status">
            Filtered: {sessions.length} of {allSessions.length} sessions
          </p>
        )}
        <div className={styles.sessionCounts}>
          <div>
            <strong data-testid="ce-community-sessions-centralized">{counts.centralized}</strong>
            <span>Centralized</span>
          </div>
          <div>
            <strong data-testid="ce-community-sessions-decentralized">{counts.decentralized}</strong>
            <span>Decentralized</span>
          </div>
          {counts.unknown > 0 && (
            <div>
              <strong>{counts.unknown}</strong>
              <span>Type unavailable</span>
            </div>
          )}
        </div>
        {sessions.length ? (
          <div className={styles.sessionListScroller} role="region" aria-label="Session list" tabIndex={0}>
            <ul className={styles.sessionList}>
              {sessions.map((session) => (
                <li key={session.slug}>
                  <a href={session.href} className={styles.sessionLink}>
                    <span className={styles.sessionIdentity}>
                      <strong>{session.name}</strong>
                      <SessionTestEthBadge
                        sessionSlug={session.slug}
                        sessionConfig={this._sessionConfig(session.slug)}
                      />
                      <span>
                        {session.slug || 'general'}
                        {isCommunitySessionDateUnavailable(session, this.state.sessionFilters) && ' · date unavailable'}
                      </span>
                    </span>
                    <span className={styles.sessionKind}>{kindLabels[session.kind]}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>{allSessions.length ? 'No sessions match these filters.' : 'No sessions discovered yet.'}</p>
        )}
      </div>
    );
  };

  renderModalContent = () => {
    const { modalType, surveysList, filteredUsers, loadingFilter } = this.state;
    const { provider, network, account, loginComplete, toggleLoginModal } = this.props;

    switch (modalType) {
      case 'sessions':
        return this.renderSessionsModalContent();
      case 'sbtgroups':
      case 'sbts':
      case 'groups': {
        // Keep the modal on the selected session's authority boundary. The
        // wrapper projects Worker-native Groups only when it receives the
        // exact Worker-canonical slug/config pair.
        const workerScope = this._getSingleSelectedWorkerScope();
        return (
          <SBTsList
            provider={provider}
            network={network}
            account={account}
            loginComplete={loginComplete}
            miniaturized={true}
            toggleLoginModal={toggleLoginModal}
            viewMode="modal" // Important: Set view mode for modal styling
            isSBTCacheReady={this.props.isSBTCacheReady}
            sbtRealtimeCoverageBySlug={this.props.sbtRealtimeCoverageBySlug}
            ensureLightSbtDiscovery={this.props.ensureLightSbtDiscovery}
            ensureLightSbtUniverse={this.props.ensureLightSbtUniverse}
            sessionSlug={workerScope?.slug}
            sessionConfig={workerScope?.sessionConfig}
            communityTabCompactSettings
            interactiveMiniCards
            embeddedMode={!!workerScope}
            allSessionsMode={!workerScope}
          />
        );
      }
      case 'users': {
        const selectionKey = this._statsSelectionKey();
        const generation = this._usersFilterGeneration;
        const ready = this.state.usersFilterSelectionKey === selectionKey;
        // Render user list with filter
        return (
          <div>
            <div className={styles.usersControls}>
              <GlobalSessionSelector
                selection={this._readGlobalSelection()}
                sessionConfig={this.props.sessionConfig}
                onChange={this.props.updateGlobalSessionSelection}
                testId={E2E_TESTIDS.COMMUNITY_USERS_SESSION_SELECT}
                className={styles.usersSessionSelector}
              />
              {ready && (
                <SBTFilter
                  className={styles.usersFilter}
                  key={generation}
                  items={this.state.uniqueUsers} // Filter based on the full uniqueUsers list
                  mode="addresses"
                  provider={provider}
                  network={network}
                  sessionSlug={this._currentSlug()}
                  onFilter={(newFilteredUsers: any) => {
                    this._updateUsersFilter(generation, selectionKey, {
                      filteredUsers: newFilteredUsers,
                      loadingFilter: false,
                    });
                  }}
                  setFilterLoading={(isLoading: any) =>
                    this._updateUsersFilter(generation, selectionKey, { loadingFilter: isLoading })
                  }
                  autoExpand={false} // Changed this to false to allow internal button toggle
                  expandToSbtHolders={true}

                  // this below value is probably not passed-in, but should be
                  isSBTCacheReady={this.props.isSBTCacheReady}
                  sbtCacheRevision={this.props.sbtCacheRevision}
                />
              )}
            </div>
            {!ready || loadingFilter ? (
              <div className={styles.loadingContainer}>
                <FontAwesomeIcon icon={faSpinner} spin /> Loading filtered users...
              </div>
            ) : (
              <div className={styles.userList}>
                {filteredUsers.map((address: any, index: any) => {
                  const seed = String(address || 'contextengine-default-seed').toLowerCase();
                  const blockieUrl = generateBlockieDataUrl(seed, 8, 4);
                  return (
                    <div
                      key={index}
                      className={styles.userItem}
                      onClick={() => window.open(buildPublicRoute(`/u/${address}`), '_blank', 'noopener,noreferrer')}
                    >
                      {blockieUrl ? (
                        <img
                          src={blockieUrl}
                          alt=""
                          width={20}
                          height={20}
                          style={{ borderRadius: 4, marginRight: 6 }}
                        />
                      ) : null}
                      {getShortenedAddress(address, true)}
                    </div>
                  );
                })}
                {filteredUsers.length === 0 && <p>No matching users found.</p>}
              </div>
            )}
          </div>
        );
      }
      case 'surveys':
        // Render survey list
        return (
          <div className={styles.surveyList}>
            {surveysList.map((survey: any, index: any) => {
              const slug = normalizeSessionSlug(String(survey?.slug || this._currentSlug() || ''));
              const sessionQuery = slug ? `?session=${encodeURIComponent(slug)}` : '';
              return (
                <div key={index} className={styles.surveyItem}>
                  <a
                    href={buildPublicRoute(`/survey/${survey.id}${sessionQuery}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.surveyLink}
                  >
                    {survey.title}
                  </a>
                  <span className={styles.questionsCount}>Questions: {survey.questionsCount}</span>
                  <span
                    className={styles.responsesCount}
                    onClick={() =>
                      window.open(
                        buildPublicRoute(`/survey/${survey.id}/results${sessionQuery}`),
                        '_blank',
                        'noopener,noreferrer',
                      )
                    } // Link to results page
                    style={{ cursor: 'pointer' }} // Add pointer cursor
                  >
                    Responses: {survey.responsesCount}
                  </span>
                </div>
              );
            })}
            {surveysList.length === 0 && <p>No surveys found.</p>}
          </div>
        );
      case 'questions':
        return this.renderQuestionsModalContent();
      default:
        return <p>No content specified.</p>;
    }
  };

  render() {
    const { showModal, modalTitle, loadingSbtsCreated, stats } = this.state;
    const selectionKey = this._statsSelectionKey();
    const initialLoadDone = this.state.initialLoadDone && this.state.initialLoadSelectionKey === selectionKey;
    const selectionPublished = this.state.usersSnapshotSelectionKey === selectionKey;
    const isCountPending = (stat: { label: string; count: number }) =>
      (stat.label !== 'Sessions' && (!selectionPublished || (!initialLoadDone && !stat.count))) ||
      (stat.label === 'Groups' && loadingSbtsCreated);
    const displayStats = this._isUniverseEnabled()
      ? [...stats, { icon: faLayerGroup, count: this.state.sessions.length, label: 'Sessions' }]
      : stats;
    const sessionFiltersActive = Object.values(this.state.sessionFilters).some((value) => String(value).trim());
    return (
      <div className={styles.communityTab}>
        <div className={styles.statsSection}>
          <div className={styles.statsHeader}>
            <GlobalSessionSelector
              selection={this._readGlobalSelection()}
              sessionConfig={this.props.sessionConfig}
              onChange={this.props.updateGlobalSessionSelection}
              testId={E2E_TESTIDS.COMMUNITY_SESSION_SELECT}
              className={styles.sessionSelector}
            />
            <div className={styles.headerActionsRight}>
              {!initialLoadDone && (
                <FontAwesomeIcon
                  icon={faSpinner}
                  spin
                  className={styles.statsHeaderSpinner}
                  data-testid="ce-community-stats-loading-spinner"
                />
              )}
            </div>
          </div>
          <div className={styles.statsGrid}>
            {displayStats.map((stat: any) => (
              <button
                type="button"
                key={stat.label}
                className={styles.statItem}
                data-ce-control-appearance="frameless"
                onClick={() => this.handleStatClick(stat)}
                data-testid={COMMUNITY_STAT_TEST_IDS[stat.label]}
                data-ce-count={String(stat.count)}
                aria-busy={isCountPending(stat)}
              >
                <FontAwesomeIcon icon={stat.icon} size="2x" className={styles.statIcon} />
                <span className={styles.statCount}>
                  {isCountPending(stat) ? <FontAwesomeIcon icon={faSpinner} spin /> : stat.count}
                </span>
                <span className={styles.statLabel}>{stat.label === 'Groups' ? t('sbts') : stat.label}</span>
              </button>
            ))}
          </div>
        </div>
        <Modal
          isOpen={showModal}
          toggle={this.toggleModal}
          className={`${styles.modal} ${this.state.modalType === 'sessions' ? styles.sessionsModal : ''}`}
          size="lg"
          centered
          scrollable
        >
          <ModalHeader
            toggle={this.toggleModal}
            className={`${styles.modalHeader} ${this.state.modalType === 'questions' ? styles.questionsModalHeader : ''}`}
            tag={['sessions', 'questions'].includes(this.state.modalType) ? 'div' : 'h5'}
          >
            {this.state.modalType === 'sessions' ? (
              <div className={styles.sessionModalHeading}>
                <h5>{modalTitle}</h5>
                <button
                  type="button"
                  className={styles.sessionFilterToggle}
                  aria-label="Session filters"
                  aria-expanded={this.state.showSessionFilters}
                  aria-controls="ce-community-session-filters"
                  // A disclosure button is not a toggle button: the filtered
                  // summary announces whether filters are active.
                  aria-describedby={sessionFiltersActive ? SESSION_FILTER_SUMMARY_ID : undefined}
                  data-active={sessionFiltersActive ? 'true' : undefined}
                  onClick={() => this.setState((state: any) => ({ showSessionFilters: !state.showSessionFilters }))}
                >
                  <FontAwesomeIcon icon={faFilter} />
                </button>
              </div>
            ) : this.state.modalType === 'questions' ? (
              <>
                <h5>{modalTitle}</h5>
                <a
                  href={buildSettingsSessionHref(this._resolveRouteSlug())}
                  className={styles.questionsModalLink}
                  data-testid="ce-community-questions-session-link"
                >
                  View Full Questions
                </a>
              </>
            ) : (
              modalTitle
            )}
          </ModalHeader>
          <ModalBody className={styles.modalBody}>{this.renderModalContent()}</ModalBody>
        </Modal>
      </div>
    );
  }
}

export default connect((state: RootState) => ({ globalSessionSelection: state.sessionState }), {
  updateGlobalSessionSelection,
})(CommunityTab);
