/** @file CommunityTab.tsx */
import React, { Component } from 'react';
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
} from '@fortawesome/free-solid-svg-icons';
import styles from './CommunityTab.module.scss';
import historicalFigures from '../../variables/demo/historical_figure_users.json';
import { Modal, ModalHeader, ModalBody, Collapse } from 'reactstrap';
import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';
import contractScripts, {
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionChainId,
  getSessionLists,
  normalizeSessionSlug,
} from '../../utilities/web3/chainGateway.js';
import SBTsList from '../SBTs/SBTsList';
import SBTFilter from '../SBTs/SBTFilter';
import BeeswarmPlot from '../SurveyTool/BeeswarmPlot';
import CETooltip from '../Shared/CETooltip';

import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import {
  getHistoricalFigureAvatarOrBlockie,
  getHistoricalFigureBlockie,
} from 'utilities/ui/historicalFigureAvatars.js';
import { createLogger } from 'utilities/logging.js';
import { peekCacheSync, readCache, subscribeCacheUpdates, writeCache } from '../../utilities/cache/cacheScripts.js';
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
import { getPolisDemoDatasetForSlug } from '../PolisReport/PolisReport';
import { persistCommunitySbtHolderHydrationResults } from './communitySbtHolderHydrationCache.js';

const uiLog = createLogger('ui');
const COMMUNITY_BEESWARM_DEMO_SLUG = 'demo';
type CacheReadOptions = { clone?: boolean };
type SessionSelectorOption = { value: string; label: string };
type ScopeCacheEntry = {
  slug: string;
  netKey: string;
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

class CommunityTab extends Component<any, any> {
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
      filteredUsers: [], // Initialize as empty, will be set when modal opens
      loadingFilter: false,
      stats: [
        { icon: faUsers, count: 0, label: 'Users' },
        { icon: faVoteYea, count: 0, label: 'Questions' },
        { icon: faScroll, count: 0, label: 'Surveys' },
        { icon: faUsersCog, count: 0, label: 'Groups' },
      ],
      lastSbtGroupsCount: null,
      initialLoadDone: false,
      showLeaderboardControls: false,
    };

    this._holdersHydrationInFlight = false;
    this._holdersHydrationAbort = false;
    this._holdersHydrationPromise = null;
    this._cacheRefIds = new WeakMap();
    this._nextCacheRefId = 1;
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
  _readGlobalSelection = () => readStoredGlobalSessionSelection();

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

  _getDefaultSelectedSessionSlugs = () => {
    const availableSlugs = this._getSessionSelectorOptions().map((option: SessionSelectorOption) => option.value);
    const availableSet = new Set<string>(availableSlugs);
    const routeSlug = normalizeSessionSlug(this._resolveRouteSlug() || '');
    if (this._hasPinnedRouteSession() && availableSet.has(routeSlug)) {
      return [routeSlug];
    }
    const selection = this._readGlobalSelection();
    const fallbackPrimarySlug = normalizeSessionSlug(
      typeof this.props.activeSessionSlug === 'string' ? this.props.activeSessionSlug : selection.primarySessionSlug,
    );
    const scopedDefaults =
      selection.selectedSessionScope === 'all'
        ? availableSlugs
        : resolveScopedSessionSlugsFromSelection({
            ...selection,
            primarySessionSlug: fallbackPrimarySlug,
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
    if (readSessionScanScope() === 'list') {
      const scopedSlugs = this._dedupeNormalizedSlugs(readSessionScanSlugs());
      if (scopedSlugs.length > 0) return scopedSlugs;
      const routeSlug = normalizeSessionSlug(this._resolveRouteSlug() || '');
      return routeSlug ? [routeSlug] : [''];
    }
    return this._dedupeNormalizedSlugs([this._resolveRouteSlug(), '', ...getAllSessionSlugs()]);
  };

  _resolveNetKeyForSlug = (slug: string) => {
    try {
      const id = getDisplaySessionChainId(slug);
      return id != null ? String(id) : '';
    } catch (_) {
      return '';
    }
  };

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

  _buildScopeEntriesFromSlugs = (slugs: unknown[] = [], options: CacheReadOptions = {}): ScopeCacheEntry[] => {
    const out: ScopeCacheEntry[] = [];
    this._dedupeNormalizedSlugs(slugs).forEach((slug: string) => {
      const netKey = this._resolveNetKeyForSlug(slug);
      const surveysCacheAll = this._readCache('surveysCache', slug, options);
      const questionsCacheAll = this._readCache('questionsCache', slug, options);
      const sbtCacheAll = this._readCache('sbtCache', slug, options);
      out.push({
        slug,
        netKey,
        surveysCache: this._pickNet(surveysCacheAll, netKey),
        questionsCache: this._pickNet(questionsCacheAll, netKey),
        sbtCache: this._pickNet(sbtCacheAll, netKey),
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

      let changed = false;
      results.forEach((res: any) => {
        if (!res || res.countsOk === false) return;
        const existing = sbtList[res.lower] || {};
        sbtList[res.lower] = {
          ...existing,
          sbtAddress: existing.sbtAddress || res.addr,
          mintedAddresses: res.mintedAddresses,
          burnedAddresses: res.burnedAddresses,
          countsLoaded: true,
          mintedCountByAddress: res.counts?.mintedCountByAddress || existing.mintedCountByAddress || {},
          burnedCountByAddress: res.counts?.burnedCountByAddress || existing.burnedCountByAddress || {},
          mintedEventCount: res.counts?.mintedEventCount || existing.mintedEventCount || 0,
          burnedEventCount: res.counts?.burnedEventCount || existing.burnedEventCount || 0,
          blockNumber: Number.isFinite(Number(res.counts?.scannedToBlock))
            ? Math.floor(Number(res.counts.scannedToBlock))
            : existing.blockNumber,
          countsScanCheckpoint: null,
        };
        changed = true;
      });

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
    for (const { slug, netKey, surveysCache, questionsCache, sbtCache } of scopeEntries) {
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
          String(netKey || ''),
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
      for (const { slug, netKey, surveysCache, questionsCache, sbtCache } of scopeEntries) {
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
            String(netKey || ''),
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
      const sbtAddressSet: any = new Set();
      const surveyTitleMap: Record<string, any> = {};
      const surveySlugMap: Record<string, any> = {};
      const surveyRespondersMap: Record<string, any> = {};

      for (const { slug, surveysCache, questionsCache, sbtCache } of scopeEntries) {
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

        Object.keys(sbtList || {}).forEach((addrLower: any) => {
          const entry = sbtList[addrLower];
          if (!entry || !entry.sbtAddress) return;

          if (this._shouldCountSbt(entry, slug)) {
            sbtAddressSet.add(String(entry.sbtAddress || '').toLowerCase());
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
        sbtsCreatedCount: sbtAddressSet.size,
      };
    });

  _computeSingleScopeStatsSnapshot = (scopeEntry: any) =>
    measureSync('ce.communityTab.computeSingleScopeStats', () => {
      if (!scopeEntry || !scopeEntry.netKey) {
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

      let sbtsCreatedCount = 0;
      for (const sbtAddress in sbtList) {
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

  checkIfInitialLoadDone = async () => {
    // This function checks if the initial load is done by comparing the caches' lastBlock to the latest chain block
    const scopeEntries = this._iterScopeCaches({ clone: false });
    if (scopeEntries.length > 1) {
      try {
        for (const { slug, surveysCache, questionsCache, sbtCache } of scopeEntries) {
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
    return minLastBlock >= latestBlockNumber;
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

  _runStatsRefreshCycle = async ({ force = false, markLoading = false }: any = {}) => {
    if (this._isUnmounted) return { changed: false };

    if (markLoading && (!this.state.loadingSbtsCreated || !this.state.loadingSurveyData)) {
      this.setState({ loadingSbtsCreated: true, loadingSurveyData: true });
    }

    let changed = false;
    let snapshot: any = null;

    const scopeEntries = this._iterScopeCaches({ clone: false });
    const coarseSignature = this._buildCoarseCacheSignature(scopeEntries);
    let signature = this._latestCacheSignature;
    if (force || coarseSignature !== this._latestCoarseCacheSignature) {
      signature = this._buildCacheSignature(scopeEntries);
      this._latestCoarseCacheSignature = coarseSignature;
    }
    const nextBeeswarmPoints = this._buildCommunityBeeswarmPoints(scopeEntries);
    this._beeswarmPoints = nextBeeswarmPoints;
    const plottableQuestionsCount = this._countPlottableQuestionsFromBeeswarmPoints(nextBeeswarmPoints);

    if (force || signature !== this._latestCacheSignature) {
      snapshot = this._computeStatsSnapshot(scopeEntries);
      this._latestCacheSignature = signature;
      this._statsUnchangedStreak = 0;
      changed = true;
    } else {
      this._statsUnchangedStreak += 1;
    }

    let nextInitialLoadDone = this.state.initialLoadDone;
    if (!nextInitialLoadDone) {
      const now = Date.now();
      const checkIntervalMs = force ? 0 : this._statsUnchangedStreak >= 3 ? 5000 : 2000;
      if (now - this._lastInitialLoadCheckMs >= checkIntervalMs) {
        this._lastInitialLoadCheckMs = now;
        const loadDone = await this.checkIfInitialLoadDone();
        if (loadDone) nextInitialLoadDone = true;
      }
    }

    this.setState((prevState: Readonly<CommunityTab['state']>) => {
      const next: Record<string, any> = {};
      if (changed && snapshot) {
        next.uniqueUsers = snapshot.uniqueUsers;
        next.surveysCreatedCount = snapshot.surveysCreatedCount;
        next.surveyResponsesCount = snapshot.surveyResponsesCount;
        next.uniqueQuestionsCount = snapshot.uniqueQuestionsCount;
        next.surveysList = snapshot.surveysList;
        next.sbtsCreatedCount = snapshot.sbtsCreatedCount;
        next.lastSbtGroupsCount = snapshot.sbtsCreatedCount;
        if (
          prevState.showModal &&
          prevState.modalType === 'users' &&
          !prevState.loadingFilter &&
          this._areAddressListsEqual(prevState.filteredUsers || [], prevState.uniqueUsers || [])
        ) {
          next.filteredUsers = snapshot.uniqueUsers;
        }
        next.stats = this._buildStatsArray(prevState.stats, {
          users: snapshot.uniqueUsers.length,
          questions: plottableQuestionsCount,
          surveys: snapshot.surveysCreatedCount,
          groups: snapshot.sbtsCreatedCount,
        });
      }
      if (prevState.loadingSbtsCreated) next.loadingSbtsCreated = false;
      if (prevState.loadingSurveyData) next.loadingSurveyData = false;
      if (nextInitialLoadDone !== prevState.initialLoadDone) {
        next.initialLoadDone = nextInitialLoadDone;
      }
      return Object.keys(next).length ? next : null;
    });

    return { changed };
  };

  _refreshCommunityStats = async ({ force = false, markLoading = false }: any = {}) => {
    if (this._isUnmounted) return { changed: false };
    if (this._statsRefreshInFlight) {
      this._statsRefreshQueued = true;
      this._statsRefreshQueuedForce = this._statsRefreshQueuedForce || force;
      this._statsRefreshQueuedLoading = this._statsRefreshQueuedLoading || markLoading;
      return { changed: false, queued: true };
    }

    this._statsRefreshInFlight = true;
    let result = { changed: false };
    try {
      result = await this._runStatsRefreshCycle({ force, markLoading });
    } catch (error) {
      uiLog.error('CommunityTab refresh failed:', error);
      this.setState({ loadingSbtsCreated: false, loadingSurveyData: false });
    } finally {
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
    return result;
  };

  componentDidMount() {
    uiLog.log('CommunityTab mounted. Fetching initial data...');
    this._isUnmounted = false;
    this._statsPollStartedAtMs = Date.now();
    this._statsUnchangedStreak = 0;
    this._latestCacheSignature = '';
    this._latestCoarseCacheSignature = '';
    this.setState({ initialLoadDone: false, loadingSbtsCreated: true, loadingSurveyData: true });

    if (this._universeKickoffDone == null) this._universeKickoffDone = false;
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
        this._queueCacheDrivenRefresh({ force: true });
      };
      window.addEventListener(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, this._globalSessionSelectionListener);
    }

    // Eagerly start SBT holder hydration so uniqueUsers is complete before modal opens
    this._eagerHydrationTimer = setTimeout(() => {
      if (!this._isUnmounted) this._hydrateSbtHoldersForUsersModal();
    }, 1500);

    this._scheduleNextStatsPoll(0);
  }

  componentWillUnmount() {
    this._isUnmounted = true;
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
    const cacheInputsChanged =
      prevProps.network?.id !== this.props.network?.id ||
      prevProps.provider !== this.props.provider ||
      prevProps.sbtCacheRevision !== this.props.sbtCacheRevision ||
      prevProps.isSBTCacheReady !== this.props.isSBTCacheReady ||
      prevProps.isSurveyCacheReady !== this.props.isSurveyCacheReady ||
      prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady ||
      prevProps.activeSessionSlug !== this.props.activeSessionSlug;

    if (cacheInputsChanged) {
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
    if (labelKey === 'users') {
      this.setState({
        modalTitle: `${stat.label} Details`,
        modalType: 'users',
        showModal: true,
        filteredUsers: this.state.uniqueUsers, // Initialize filter with all users when modal opens
        loadingFilter: false, // Set loading to false initially
      });
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
    this.setState((prevState: Readonly<CommunityTab['state']>) => ({
      showModal: !prevState.showModal,
      modalType: !prevState.showModal ? prevState.modalType : null,
      modalTitle: !prevState.showModal ? prevState.modalTitle : '',
    }));
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
    if (activeSlug !== COMMUNITY_BEESWARM_DEMO_SLUG) return false;
    if (readSessionScanScope() !== 'list') return false;
    return (
      Array.isArray(POLIS_DEMO_DATA_AUTOLOAD_SLUGS) &&
      POLIS_DEMO_DATA_AUTOLOAD_SLUGS.map((slug: any) => normalizeSessionSlug(slug)).includes(
        COMMUNITY_BEESWARM_DEMO_SLUG,
      )
    );
  };

  _buildDemoBeeswarmPoints = () => {
    const dataset = getPolisDemoDatasetForSlug(COMMUNITY_BEESWARM_DEMO_SLUG, { allowFallback: false }) as {
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
    const binaryIndexMap: any[] = [];
    comments.forEach((c: any, i: any) => {
      const t = String(c?.type || '')
        .trim()
        .toLowerCase();
      if (!t || t === 'binary') binaryIndexMap.push(i);
    });
    const participants = Array.isArray(dataset?.participantsVotes) ? dataset.participantsVotes : [];
    if (!binaryComments.length || !participants.length) return [];

    const ratingMatrix = binaryComments.map(() => Array(participants.length).fill(null));
    participants.forEach((participant: any, participantIndex: any) => {
      const votes = participant?.votes && typeof participant.votes === 'object' ? participant.votes : {};
      binaryIndexMap.forEach((originalIndex: any, filteredIndex: any) => {
        const rawVote = votes[String(originalIndex)];
        if (rawVote === undefined) return;
        const vote = this._normalizeBinaryVoteValue(rawVote);
        if (vote == null) return;
        ratingMatrix[filteredIndex][participantIndex] = vote;
      });
    });

    return computeQuestionDivisiveness(ratingMatrix).map((result: any) => {
      const comment = (binaryComments[result.commentIndex] || {}) as {
        commentId?: unknown;
        commentBody?: unknown;
      };
      const rowVotes = Array.isArray(ratingMatrix[result.commentIndex]) ? ratingMatrix[result.commentIndex] : [];
      const unsure = rowVotes.filter((vote: any) => vote === 0).length;
      const total = result.agrees + result.disagrees + unsure;
      return {
        index: result.commentIndex,
        questionId: String(comment.commentId || result.commentIndex),
        // BeeswarmPlot expects `extremity`; this is 50/50-split divisiveness, not PCA extremity.
        extremity: result.divisiveness,
        label: String(comment.commentBody || '(No prompt)'),
        agrees: result.agrees,
        disagrees: result.disagrees,
        unsure,
        total,
      };
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

    return computeQuestionDivisiveness(ratingMatrix).map((result: any) => {
      const questionId = binaryQuestionIds[result.commentIndex];
      const question = questionMap.get(questionId) || {};
      const rowVotes = Array.isArray(ratingMatrix[result.commentIndex]) ? ratingMatrix[result.commentIndex] : [];
      const unsure = rowVotes.filter((vote: any) => vote === 0).length;
      const total = result.agrees + result.disagrees + unsure;
      return {
        index: result.commentIndex,
        questionId,
        // BeeswarmPlot expects `extremity`; this is 50/50-split divisiveness, not PCA extremity.
        extremity: result.divisiveness,
        label: question.prompt || '(No prompt)',
        agrees: result.agrees,
        disagrees: result.disagrees,
        unsure,
        total,
      };
    });
  };

  _countPlottableQuestionsFromBeeswarmPoints = (points: unknown[] = []) => {
    if (!Array.isArray(points)) return 0;
    const ids = new Set();
    points.forEach((point: unknown) => {
      const questionId = String(
        point && typeof point === 'object' ? (point as { questionId?: unknown }).questionId || '' : '',
      )
        .trim()
        .toLowerCase();
      if (questionId) ids.add(questionId);
    });
    return ids.size;
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

  renderQuestionSwarm() {
    const points = this._getQuestionSwarmPoints();
    return (
      <section className={styles.beeswarmSection} data-testid="ce-community-beeswarm-section">
        <BeeswarmPlot points={points} height={220} showIdleSummary={false} />
      </section>
    );
  }

  _getQuestionSwarmPoints = () => {
    if (this._shouldUseDemoBeeswarmData()) {
      return this._buildDemoBeeswarmPoints();
    }
    if (Array.isArray(this._beeswarmPoints) && this._beeswarmPoints.length > 0) {
      return this._beeswarmPoints;
    }
    return this._buildCommunityBeeswarmPoints();
  };

  renderQuestionsModalContent = () => {
    const points = this._getQuestionSwarmPoints();
    return (
      <div className={styles.questionsModalContent}>
        <div className={styles.questionsModalTopBar}>
          <a href={buildPublicRoute('/questions')} className={styles.questionsModalLink}>
            View Full Questions
          </a>
        </div>
        <div className={styles.questionsModalPlot}>
          <BeeswarmPlot points={points} height={240} showIdleSummary={false} />
        </div>
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

  renderModalContent = () => {
    const { modalType, surveysList, filteredUsers, loadingFilter } = this.state;
    const { provider, network, account, loginComplete, toggleLoginModal } = this.props;

    switch (modalType) {
      case 'sbtgroups':
      case 'sbts':
      case 'groups':
        // Render SBTsList directly, passing current props
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
            communityTabCompactSettings
            interactiveMiniCards
            allSessionsMode
          />
        );
      case 'users':
        // Render user list with filter
        return (
          <div>
            <SBTFilter
              items={this.state.uniqueUsers} // Filter based on the full uniqueUsers list
              mode="addresses"
              provider={provider}
              network={network}
              sessionSlug={this._currentSlug()}
              onFilter={(newFilteredUsers: any) => {
                // This setState call now reliably updates the filtered list
                this.setState({ filteredUsers: newFilteredUsers, loadingFilter: false });
              }}
              setFilterLoading={(isLoading: any) => this.setState({ loadingFilter: isLoading })} // Pass loading state setter
              autoExpand={false} // Changed this to false to allow internal button toggle
              expandToSbtHolders={true}

              // this below value is probably not passed-in, but should be
              isSBTCacheReady={this.props.isSBTCacheReady}
              sbtCacheRevision={this.props.sbtCacheRevision}
            />
            {loadingFilter ? (
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
                      window.open(buildPublicRoute(`/survey/${survey.id}/results${sessionQuery}`), '_blank')
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
    const { showModal, modalTitle, loadingSbtsCreated, stats, initialLoadDone } = this.state;

    return (
      <div className={styles.communityTab}>
        <div className={styles.leaderboardSection}>
          <div className={styles.leaderboardTopBar}>
            <div className={styles.headerActionsRight}>{this.renderLeaderboardControls()}</div>
          </div>
          <div className={styles.content}>
            <div className={styles.leaderboard}>{this.renderLeaderboard()}</div>
          </div>
        </div>
        <div className={styles.rightSection}>
          <div className={styles.statsSection}>
            <div className={styles.statsHeader}>
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
              {stats.map((stat: any, index: any) => (
                <div key={index} className={styles.statItem} onClick={() => this.handleStatClick(stat)}>
                  <FontAwesomeIcon icon={stat.icon} size="2x" className={styles.statIcon} />
                  <span className={styles.statCount}>
                    {stat.label === 'Groups' && loadingSbtsCreated ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                      stat.count
                    )}
                  </span>
                  <span className={styles.statLabel}>{stat.label === 'Groups' ? t('sbts') : stat.label}</span>
                </div>
              ))}
            </div>
          </div>
          {this.renderQuestionSwarm()}
        </div>

        <Modal isOpen={showModal} toggle={this.toggleModal} className={styles.modal} size="lg" centered scrollable>
          <ModalHeader toggle={this.toggleModal} className={styles.modalHeader}>
            {modalTitle}
          </ModalHeader>
          <ModalBody className={styles.modalBody}>{this.renderModalContent()}</ModalBody>
        </Modal>
      </div>
    );
  }
}

export default CommunityTab;
