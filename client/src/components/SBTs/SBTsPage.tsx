/** @file SBTsPage.tsx */

import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faSpinner, faPlus, faLock } from '@fortawesome/free-solid-svg-icons';
import styles from './SBTsPage.module.scss';
import sbtPageStyles from './SBTPage.module.scss';
import SBTsList from './SBTsList';
import CreateGroup from './CreateSBTGroup';
import SbtCreateAdvancedExternalNotice, {
  shouldShowAdvancedExternalSbtNotice,
} from './SbtCreateAdvancedExternalNotice';
import SBTPage from './SBTPage';
import WorkerSessionGroupsPanel from '../OnePageSession/WorkerSessionGroupsPanel';
import {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from '../../domains/sessions/sessionConfig.js';
import { connect } from 'react-redux';
import { createLogger } from '../../utilities/logging.js';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { hasCachedCreateSbtForm } from '../../utilities/sbt/sbtCreateFormCache.js';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { workerGroupNavigationPort } from '../../domains/worker/workerGroupNavigationPort';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { resolveAdminCapabilities } from '../Admin/adminPageHelpers';
import { GROUP_CREATION_POLICIES, resolveGroupCreationPolicy } from '../../utilities/session/groupCreationPolicy';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import { isCryptoMode, sbtsListPath, t } from '../../utilities/ui/terminology.js';
import { buildPublicRoute, stripPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import defaultSbtImage from '../../assets/img/ce_circuit_logo.png';
import {
  asSBTsPageFeaturedProgress as asFeaturedProgress,
  asSBTsPageFeaturedSbt as asFeaturedSbt,
  buildSBTsPageCacheFeaturedCardModel as buildCacheFeaturedCardModel,
  buildSBTsPageFeaturedEntryModel as buildFeaturedEntryModel,
  buildSBTsPageFeaturedProgressSignature as buildFeaturedProgressSignature,
  buildSBTsPageBooleanTogglePatch as buildBooleanTogglePatch,
  buildSBTsPageInitialState as buildInitialState,
  dedupeSBTsPageAddressListCaseInsensitive as dedupeAddressListCaseInsensitive,
  dedupeSBTsPageSessionSlugList as dedupeSessionSlugList,
  hasSBTsPageCacheFeaturedCardImageMetadata as hasCacheFeaturedCardImageMetadata,
  isSBTsPageSessionAutoFeatureEnabled as isSessionAutoFeatureEnabled,
  isSBTsPageRecord as isRecord,
  normalizeSBTsPageFeaturedEntries as normalizeFeaturedEntries,
  resolveSBTsPageAutoFeatureBySessionSlug as resolveAutoFeatureBySessionSlug,
  resolveSBTsPageDisplaySessionConfig as resolveDisplaySessionConfig,
  resolveSBTsPageDisplaySessionLists as resolveDisplaySessionLists,
  resolveSBTsPageFeaturedSbtSessionSlug as resolveFeaturedSbtSessionSlug,
  resolveSBTsPageReferrerSessionSlug as resolveReferrerSessionSlug,
  resolveSBTsPageCacheFeaturedCardLinkStyle as resolveCacheFeaturedCardLinkStyle,
} from './sbtOverviewPageHelpers';
type FeaturedEntry = {
  address: string;
  sessionSlug: string;
};
type CacheBackedFeaturedCard = {
  address: string;
  sessionSlug: string;
  sbt: FeaturedSbtLike & { sbtInfo: FeaturedSbtMetadataLike };
};
type FeaturedRenderEntry =
  { kind: 'cache'; entry: CacheBackedFeaturedCard } | { kind: 'fallback'; entry: FeaturedEntry };
type MemoBucket<T> = {
  key: string;
  result: T[];
};

type FeaturedListArgs = {
  baseFeaturedList?: unknown;
  effectiveSessionSlug?: unknown;
  autoFeature?: unknown;
  requireExplicitSessionSlug?: unknown;
  isSBTCacheReady?: unknown;
  isAllSessionsMode?: boolean;
  progressBySlug?: Record<string, FeaturedProgressLike | unknown>;
};
type FeaturedEntriesArgs = {
  baseFeaturedList?: unknown;
  effectiveSessionSlug?: unknown;
  effectiveSessionAutoFeature?: unknown;
  requireExplicitAutoFeatureSessionSlug?: unknown;
  isSBTCacheReady?: unknown;
  isAllSessionsMode?: boolean;
  includeListScopeSessions?: boolean;
  listScopeSessionSlugs?: unknown;
  progressBySlug?: Record<string, FeaturedProgressLike | unknown>;
};
type FeaturedCacheCardsArgs = {
  featuredEntries?: unknown;
  isSBTCacheReady?: unknown;
  progressBySlug?: Record<string, FeaturedProgressLike | unknown>;
};

type SBTsPageProps = UnknownRecord & {
  sessionSlug?: string | null;
  sessionConfig?: SBTSessionConfigLike | null;
  activeSessionSlug?: string | null;
  sessionName?: string;
  sessionInfo?: string;
  provider?: unknown;
  network?: unknown;
  account?: unknown;
  litHooks?: unknown;
  loginComplete?: boolean;
  toggleLoginModal?: unknown;
  isSBTCacheReady?: boolean;
  sbtCacheRevision?: number | string | null;
  defaultSbtTags?: unknown;
  defaultFeaturedSBTs?: unknown[];
  onCreateGroupToggleExternal?: () => void;
  showCreateGroupExternal?: boolean;
  hideMiniActionRow?: boolean;
  showCreateGroupAboveFeatured?: boolean;
  preferCacheBackedFeaturedCards?: boolean;
  requireExplicitAutoFeatureSessionSlug?: boolean;
  miniaturized?: boolean;
  refreshSbtData?: unknown;
  onRequestSbtCacheRefresh?: unknown;
  latestBlockNumber?: unknown;
  sbtScanProgressBySlug?: Record<string, FeaturedProgressLike | unknown>;
  sbtRealtimeCoverageBySlug?: unknown;
  ensureLightSbtDiscovery?: unknown;
  ensureLightSbtUniverse?: unknown;
  refreshSessionUniverseRegistryCache?: unknown;
};
type SBTsPageState = {
  showSBTsList: boolean;
  showCreateGroup: boolean;
};

const SBTsListComponent = SBTsList as React.ComponentType<Record<string, unknown>>;
const CreateGroupComponent = CreateGroup as React.ComponentType<Record<string, unknown>>;
const SBTPageComponent = SBTPage as React.ComponentType<Record<string, unknown>>;

const sbtLog = createLogger('sbt');

const getDisplaySessionConfig = (slugIn: unknown = ''): SBTSessionConfigLike | null =>
  resolveDisplaySessionConfig({
    getDemoSessionConfigBySlug,
    getSessionConfigBySlug,
    getSessionConfigBySlugOrDefault,
    slugIn,
  });

const getDisplaySessionLists = (slugIn: unknown = '') =>
  resolveDisplaySessionLists({
    getDemoSessionConfigBySlug,
    getSessionConfigBySlug,
    getSessionConfigBySlugOrDefault,
    slugIn,
  });

const getFeaturedSbtName = (sbt: FeaturedSbtLike | null | undefined): string => {
  const info = isRecord(sbt?.sbtInfo) ? sbt.sbtInfo : {};
  return String(info.name || info.title || sbt?.name || '').trim();
};

const isDemoAutomationFixtureSbt = (sbt: FeaturedSbtLike | null | undefined, sessionSlug: unknown = ''): boolean => {
  if (normalizeSessionSlug(sessionSlug || '') !== 'demo') return false;
  const name = getFeaturedSbtName(sbt);
  if (!name) return false;
  return (
    /\b(?:AI Gate|AI Gated Decrypt|AI Doc Library|AI Doc Filetypes|BrowserUse) Test SBT\b/i.test(name) ||
    /\[(?:e2e-|20\d{6}-\d{6}-(?:response-smoke|anyall|gated|survey|doc))/i.test(name)
  );
};

export class SBTsPage extends Component<SBTsPageProps, SBTsPageState> {
  _featuredListMemo: MemoBucket<string>;

  _featuredEntriesMemo: MemoBucket<FeaturedEntry>;

  _featuredCacheCardsMemo: MemoBucket<CacheBackedFeaturedCard>;

  constructor(props: SBTsPageProps) {
    super(props);
    this.state = buildInitialState({
      activeSessionSlug: props.activeSessionSlug,
      hasCachedCreateSbtForm,
      sessionConfig: props.sessionConfig,
      sessionSlug: props.sessionSlug,
    });

    this.toggleSBTsList = this.toggleSBTsList.bind(this);
    this.toggleCreateGroup = this.toggleCreateGroup.bind(this);
    this._featuredListMemo = { key: '', result: [] };
    this._featuredEntriesMemo = { key: '', result: [] };
    this._featuredCacheCardsMemo = { key: '', result: [] };
  }

  toggleSBTsList() {
    this.setState(
      (prevState) =>
        buildBooleanTogglePatch({
          state: prevState,
          stateKey: 'showSBTsList',
        }) as Pick<SBTsPageState, 'showSBTsList'>,
    );
  }

  toggleCreateGroup() {
    if (typeof this.props.onCreateGroupToggleExternal === 'function') {
      this.props.onCreateGroupToggleExternal();
      return;
    }
    this.setState(
      (prevState) =>
        buildBooleanTogglePatch({
          state: prevState,
          stateKey: 'showCreateGroup',
        }) as Pick<SBTsPageState, 'showCreateGroup'>,
    );
  }

  getMemoizedFeaturedList({
    baseFeaturedList,
    effectiveSessionSlug,
    autoFeature,
    requireExplicitSessionSlug = false,
    isSBTCacheReady,
    isAllSessionsMode = false,
    progressBySlug = {},
  }: FeaturedListArgs): string[] {
    const baseList = dedupeAddressListCaseInsensitive(baseFeaturedList);
    const sessionSlugTarget = normalizeSessionSlug(effectiveSessionSlug || '');
    const key = [
      sessionSlugTarget,
      autoFeature ? '1' : '0',
      requireExplicitSessionSlug ? '1' : '0',
      isSBTCacheReady ? '1' : '0',
      isAllSessionsMode ? '1' : '0',
      String(Number(this.props.sbtCacheRevision || 0)),
      buildFeaturedProgressSignature(progressBySlug, [sessionSlugTarget]),
      baseList.map((addr) => addr.toLowerCase()).join(','),
    ].join('|');
    if (this._featuredListMemo.key === key) {
      return this._featuredListMemo.result;
    }

    let next = baseList;
    if (requireExplicitSessionSlug && !baseFeaturedListIsConfigured && sessionSlugTarget && !isAllSessionsMode) {
      try {
        const cache = peekCacheSync('sbtCache', String(effectiveSessionSlug || ''), { clone: false });
        const explicitAddressSet = new Set<string>();
        if (isRecord(cache)) {
          Object.values(cache).forEach((netNode) => {
            const netRecord = isRecord(netNode) ? netNode : null;
            const sbtList = isRecord(netRecord?.sbtList) ? netRecord.sbtList : null;
            if (!sbtList) return;
            Object.values(sbtList).forEach((rawSbt) => {
              const sbt = asFeaturedSbt(rawSbt);
              if (!sbt?.sbtAddress) return;
              if (isDemoAutomationFixtureSbt(sbt, sessionSlugTarget)) return;
              const sbtSessionSlug = resolveFeaturedSbtSessionSlug(sbt, {
                requireExplicitSessionSlug: true,
              });
              if (sbtSessionSlug !== sessionSlugTarget) return;
              explicitAddressSet.add(
                String(sbt.sbtAddress || '')
                  .trim()
                  .toLowerCase(),
              );
            });
          });
        }
        next = baseList.filter((addr) =>
          explicitAddressSet.has(
            String(addr || '')
              .trim()
              .toLowerCase(),
          ),
        );
      } catch (e) {
        sbtLog.warn('[SBTsPage] Strict featured filter failed:', e);
        next = [];
      }
    }
    if (autoFeature && !isAllSessionsMode) {
      try {
        const cache = peekCacheSync('sbtCache', String(effectiveSessionSlug || ''), { clone: false });
        if (isRecord(cache)) {
          const autoFeaturedAddresses: string[] = [];
          Object.values(cache).forEach((netNode) => {
            const netRecord = isRecord(netNode) ? netNode : null;
            const sbtList = isRecord(netRecord?.sbtList) ? netRecord.sbtList : null;
            if (!sbtList) return;
            Object.values(sbtList).forEach((rawSbt) => {
              const sbt = asFeaturedSbt(rawSbt);
              if (!sbt?.sbtAddress) return;
              if (sbt?.sbtInfo?.unlisted || sbt?.unlisted) return;
              if (isDemoAutomationFixtureSbt(sbt, sessionSlugTarget)) return;
              const sbtSessionSlug = resolveFeaturedSbtSessionSlug(sbt, {
                requireExplicitSessionSlug,
              });
              if (sbtSessionSlug !== sessionSlugTarget) return;
              autoFeaturedAddresses.push(String(sbt.sbtAddress));
            });
          });
          if (autoFeaturedAddresses.length > 0) {
            next = dedupeAddressListCaseInsensitive([...next, ...autoFeaturedAddresses]);
          }
        }
      } catch (e) {
        sbtLog.warn('[SBTsPage] Auto-feature logic failed:', e);
      }
    }

    this._featuredListMemo = { key, result: next };
    return next;
  }

  getMemoizedFeaturedEntries({
    baseFeaturedList,
    effectiveSessionSlug,
    effectiveSessionAutoFeature,
    requireExplicitAutoFeatureSessionSlug = false,
    isSBTCacheReady,
    isAllSessionsMode = false,
    includeListScopeSessions = false,
    listScopeSessionSlugs = [],
    progressBySlug = {},
  }: FeaturedEntriesArgs): FeaturedEntry[] {
    const normalizedEffectiveSlug = normalizeSessionSlug(effectiveSessionSlug || '');
    const scopedSessionSlugs = includeListScopeSessions
      ? dedupeSessionSlugList(listScopeSessionSlugs)
      : [normalizedEffectiveSlug];
    const orderedSessionSlugs =
      scopedSessionSlugs.length > 0
        ? normalizedEffectiveSlug && scopedSessionSlugs.includes(normalizedEffectiveSlug)
          ? dedupeSessionSlugList([normalizedEffectiveSlug, ...scopedSessionSlugs])
          : scopedSessionSlugs
        : [normalizedEffectiveSlug];
    const baseList = dedupeAddressListCaseInsensitive(baseFeaturedList);
    const perSlugFeaturedSignatures = orderedSessionSlugs.map((slug) => {
      const featured =
        slug === normalizedEffectiveSlug
          ? baseList
          : dedupeAddressListCaseInsensitive(getDisplaySessionLists(slug)?.featured_SBTs_LIST || []);
      return `${slug}:${featured.map((addr) => addr.toLowerCase()).join(',')}`;
    });
    const perSlugAutoFeatureSignatures = orderedSessionSlugs.map((slug) => {
      const autoFeatureForSlug =
        slug === normalizedEffectiveSlug
          ? !!effectiveSessionAutoFeature
          : isSessionAutoFeatureEnabled(getDisplaySessionConfig(slug));
      return `${slug}:${autoFeatureForSlug ? '1' : '0'}`;
    });
    const key = [
      normalizedEffectiveSlug,
      isSBTCacheReady ? '1' : '0',
      isAllSessionsMode ? '1' : '0',
      includeListScopeSessions ? '1' : '0',
      requireExplicitAutoFeatureSessionSlug ? '1' : '0',
      String(Number(this.props.sbtCacheRevision || 0)),
      buildFeaturedProgressSignature(progressBySlug, orderedSessionSlugs),
      perSlugAutoFeatureSignatures.join('|'),
      perSlugFeaturedSignatures.join('|'),
    ].join('|');
    if (this._featuredEntriesMemo.key === key) {
      return this._featuredEntriesMemo.result;
    }

    const seenAddresses = new Set<string>();
    const next: FeaturedEntry[] = [];
    orderedSessionSlugs.forEach((slug) => {
      const featuredForSlug =
        slug === normalizedEffectiveSlug
          ? baseList
          : dedupeAddressListCaseInsensitive(getDisplaySessionLists(slug)?.featured_SBTs_LIST || []);
      const autoFeatureForSlug =
        slug === normalizedEffectiveSlug
          ? !!effectiveSessionAutoFeature
          : isSessionAutoFeatureEnabled(getDisplaySessionConfig(slug));
      const addresses = this.getMemoizedFeaturedList({
        baseFeaturedList: featuredForSlug,
        effectiveSessionSlug: slug,
        autoFeature: autoFeatureForSlug,
        requireExplicitSessionSlug: requireExplicitAutoFeatureSessionSlug,
        isSBTCacheReady,
        isAllSessionsMode,
        progressBySlug,
      });
      addresses.forEach((address) => {
        const rawAddress = String(address || '').trim();
        if (!rawAddress) return;
        const lower = rawAddress.toLowerCase();
        if (seenAddresses.has(lower)) return;
        seenAddresses.add(lower);
        next.push({
          address: rawAddress,
          sessionSlug: slug,
        });
      });
    });

    this._featuredEntriesMemo = { key, result: next };
    return next;
  }

  getMemoizedFeaturedCacheCards({
    featuredEntries = [],
    isSBTCacheReady = false,
    progressBySlug = {},
  }: FeaturedCacheCardsArgs): CacheBackedFeaturedCard[] {
    const normalizedEntries = normalizeFeaturedEntries(featuredEntries);
    const key = [
      String(Number(this.props.sbtCacheRevision || 0)),
      isSBTCacheReady ? '1' : '0',
      buildFeaturedProgressSignature(
        progressBySlug,
        normalizedEntries.map((entry) => entry.sessionSlug),
      ),
      normalizedEntries.map((entry) => `${entry.sessionSlug}|${entry.lowerAddress}`).join(','),
    ].join('|');
    if (this._featuredCacheCardsMemo.key === key) {
      return this._featuredCacheCardsMemo.result;
    }

    const next = normalizedEntries
      .map<CacheBackedFeaturedCard | null>((entry) => {
        let cacheMatch: CacheBackedFeaturedCard['sbt'] | null = null;
        try {
          const cache = peekCacheSync('sbtCache', entry.sessionSlug, { clone: false });
          if (isRecord(cache)) {
            Object.values(cache).some((netNode) => {
              const netRecord = isRecord(netNode) ? netNode : null;
              const sbtList = isRecord(netRecord?.sbtList) ? netRecord.sbtList : null;
              const candidate = asFeaturedSbt(sbtList?.[entry.lowerAddress]);
              if (!candidate?.sbtInfo) return false;
              cacheMatch = candidate as FeaturedSbtLike & { sbtInfo: FeaturedSbtMetadataLike };
              return true;
            });
          }
        } catch (e) {
          sbtLog.warn('[SBTsPage] cache-backed featured lookup failed:', e);
        }
        const resolvedCacheMatch = cacheMatch as CacheBackedFeaturedCard['sbt'] | null;
        if (!resolvedCacheMatch || !resolvedCacheMatch.sbtInfo) return null;
        if (!hasCacheFeaturedCardImageMetadata(resolvedCacheMatch.sbtInfo)) return null;
        return {
          address: entry.address,
          sessionSlug: entry.sessionSlug,
          sbt: resolvedCacheMatch,
        };
      })
      .filter((entry): entry is CacheBackedFeaturedCard => !!entry);

    this._featuredCacheCardsMemo = { key, result: next };
    return next;
  }

  /**
   * Resolve effective routing for SBT/group list pages:
   * Priority: URL (/{sbts|groups}/:slugOrKey) → Redux activeSessionSlug → referrer /session/:slug → default general ('')
   * Canonicalize to the active terminology-aware list path when a non-empty slug is known (no reload).
   */
  getResolvedRouting() {
    const path = stripPublicUrlBasePath((typeof window !== 'undefined' ? window.location.pathname : '') || '');
    const parts = path.split('/').filter(Boolean);
    const workerGroupId = String(this.props.workerGroupId || '').trim();
    const onWorkerGroupDetailRoute = !!workerGroupId;
    const onSbtsRoute = parts[0] === 'sbts' || parts[0] === 'groups' || onWorkerGroupDetailRoute;
    const detailSessionSlug = onWorkerGroupDetailRoute
      ? normalizeSessionSlug(
          this.props.sessionSlug ||
            (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sessionName') || '' : ''),
        )
      : '';
    const urlSlugLike = onWorkerGroupDetailRoute
      ? detailSessionSlug || undefined
      : onSbtsRoute && parts.length > 1
        ? parts[1]
        : undefined;
    const isCreateRoute = onSbtsRoute && urlSlugLike === 'new';
    const effectiveUrlSlug = isCreateRoute ? undefined : urlSlugLike;

    // Referrer-based fallback (covers reload from /session/:slug)
    let referrerSlug = '';
    try {
      const ref = (typeof document !== 'undefined' ? document.referrer : '') || '';
      referrerSlug = resolveReferrerSessionSlug(ref);
    } catch (e) {
      sbtLog.warn('SBTsPage: fallback', e);
    }

    const explicitConfig = isRecord(this.props.sessionConfig) ? this.props.sessionConfig : null;
    const explicitConfigSlug = normalizeSessionSlug(explicitConfig?.slug || '');
    const selectedCreateSlug = normalizeSessionSlug(
      this.props.sessionSlug || explicitConfigSlug || this.props.activeSessionSlug || referrerSlug || '',
    );
    const explicitConfigCapabilities = resolveSessionCapabilityProjection(explicitConfig);
    const explicitConfigIsValidated =
      explicitConfigCapabilities.profileValid || explicitConfigCapabilities.source === 'legacy_registry';
    const explicitConfigHasConcreteIdentity = !!(
      explicitConfigSlug ||
      selectedCreateSlug ||
      normalizeSessionSlug(explicitConfig?.sessionId || explicitConfig?.sessionIdHex || '')
    );
    const explicitConfigRejected =
      isCreateRoute &&
      !!explicitConfig &&
      (explicitConfigCapabilities.source === 'invalid_profile' ||
        (explicitConfigCapabilities.source === 'missing' && explicitConfigHasConcreteIdentity) ||
        (!!explicitConfigSlug && !!selectedCreateSlug && explicitConfigSlug !== selectedCreateSlug) ||
        (explicitConfigIsValidated && (!explicitConfigSlug || !selectedCreateSlug)));

    if (explicitConfigRejected) {
      return {
        activeGroup: null,
        canonicalSlug: '',
        urlHasNoSlug: false,
        onSbtsRoute,
        isCreateRoute,
        sessionConfigError: 'The selected session context could not be verified.',
      };
    }

    const selectedRouteSlug = normalizeSessionSlug(effectiveUrlSlug || selectedCreateSlug);
    const useExplicitSessionConfig =
      explicitConfigIsValidated && !!explicitConfigSlug && explicitConfigSlug === selectedRouteSlug;
    const exactExplicitGroup = useExplicitSessionConfig ? explicitConfig : null;

    // An exact validated config supplied by the route is the freshest authority
    // for that slug and must not be shadowed by a same-slug registry cache row.
    // Otherwise resolve by URL → prop → Redux → referrer → default general.
    const groupFromUrl = effectiveUrlSlug ? getDisplaySessionConfig(effectiveUrlSlug) : null;
    const propSlugLike = this.props.sessionSlug || this.props.sessionConfig?.slug || '';
    const groupFromProp = exactExplicitGroup
      ? exactExplicitGroup
      : propSlugLike
        ? getDisplaySessionConfig(propSlugLike)
        : null;
    const groupFromRedux = this.props.activeSessionSlug ? getDisplaySessionConfig(this.props.activeSessionSlug) : null;
    const groupFromRef = referrerSlug ? getDisplaySessionConfig(referrerSlug) : null;
    const activeGroup =
      exactExplicitGroup ||
      groupFromUrl ||
      groupFromProp ||
      groupFromRedux ||
      groupFromRef ||
      getDisplaySessionConfig('');

    const explicitSourceSlug = normalizeSessionSlug(
      effectiveUrlSlug || propSlugLike || this.props.activeSessionSlug || referrerSlug || '',
    );
    const explicitSourceMatched = !!(
      (effectiveUrlSlug && groupFromUrl) ||
      (propSlugLike && groupFromProp) ||
      (this.props.activeSessionSlug && groupFromRedux) ||
      (referrerSlug && groupFromRef)
    );
    const canonicalSlugFromConfig = normalizeSessionSlug(activeGroup?.slug || '');
    const canonicalSlug = canonicalSlugFromConfig || (explicitSourceMatched ? explicitSourceSlug : ''); // '' means general
    const urlHasNoSlug = onSbtsRoute && effectiveUrlSlug === undefined && !isCreateRoute;

    // Canonicalize (silent) if we are on /sbts and have a non-empty slug to show
    if (!isCreateRoute && urlHasNoSlug && canonicalSlug) {
      try {
        window.history.replaceState(null, '', buildPublicRoute(`${sbtsListPath()}/${canonicalSlug}`));
      } catch (e) {
        sbtLog.warn('SBTsPage: fallback', e);
      }
      return {
        activeGroup,
        canonicalSlug,
        urlHasNoSlug: false,
        onSbtsRoute,
        isCreateRoute,
        sessionConfigError: '',
      }; // URL is now canonical
    }

    return { activeGroup, canonicalSlug, urlHasNoSlug, onSbtsRoute, isCreateRoute, sessionConfigError: '' };
  }

  render() {
    const sessionName = this.props.sessionName || '';
    const sessionInfo = this.props.sessionInfo || '';

    const { provider, network, account, loginComplete, toggleLoginModal, isSBTCacheReady, sbtCacheRevision } =
      this.props;
    const { showSBTsList, showCreateGroup } = this.state;
    const effectiveShowCreateGroup =
      typeof this.props.showCreateGroupExternal === 'boolean' ? this.props.showCreateGroupExternal : showCreateGroup;
    const hideMiniActionRow = this.props.hideMiniActionRow === true;
    const showCreateGroupAboveFeatured = this.props.showCreateGroupAboveFeatured === true;
    const routeWorkerGroupId = String(
      this.props.workerGroupId ||
        (typeof window !== 'undefined' ? workerGroupNavigationPort.readGroupIdFromHash(window.location.hash) : ''),
    ).trim();

    // Resolve routing + slug once per render
    const { activeGroup, canonicalSlug, urlHasNoSlug, onSbtsRoute, isCreateRoute, sessionConfigError } =
      this.getResolvedRouting();
    const effectiveSessionSlug = canonicalSlug; // may be '' (general)
    const allSessionsMode = urlHasNoSlug && !canonicalSlug; // plain /sbts with no redux/referrer slug => enumerate all groups
    const sessionCapabilities = resolveSessionCapabilityProjection(activeGroup);
    const groupCreationPolicy = resolveGroupCreationPolicy(
      activeGroup,
      sessionCapabilities.isRegistryCanonical
        ? GROUP_CREATION_POLICIES.PARTICIPANTS
        : GROUP_CREATION_POLICIES.ADMIN_ONLY,
    );
    const sessionAdminCapabilities = resolveAdminCapabilities({ account, sessionConfig: activeGroup });
    const canCreateForSession =
      !activeGroup ||
      (!sessionCapabilities.isWorkerCanonical && !sessionCapabilities.isRegistryCanonical) ||
      groupCreationPolicy === GROUP_CREATION_POLICIES.PARTICIPANTS ||
      sessionAdminCapabilities.canAdminRegistry ||
      sessionAdminCapabilities.canAdminWorker;
    const renderCreationDenied = () => (
      <aside
        className={styles.advancedExternalNotice}
        role="alert"
        data-testid={E2E_TESTIDS.SESSION_GROUP_CREATION_POLICY_DENIED}
      >
        <strong>Group creation is limited to session admins</strong>
        <span>
          This session’s Context Engine controls hide the creation form for other participants. Public SBT factories can
          still be called independently on-chain.
        </span>
      </aside>
    );
    if (isCreateRoute) {
      return (
        <div>
          <div className={styles.container}>
            <div className={styles.buttonRow}>
              <button
                onClick={() => (window.location.href = buildPublicRoute(sbtsListPath()))}
                className={styles.backButton}
              >
                <FontAwesomeIcon icon={faExpand} /> {`Back to ${t('sbts')}`}
              </button>
            </div>
          </div>
          {sessionConfigError ? (
            <aside className={styles.advancedExternalNotice} role="alert">
              <strong>Advanced/external on-chain SBT unavailable</strong>
              <span>
                {sessionConfigError} Return to the session before opening this optional standalone tool again.
              </span>
            </aside>
          ) : shouldShowAdvancedExternalSbtNotice(activeGroup) ? (
            <SbtCreateAdvancedExternalNotice />
          ) : null}
          {!sessionConfigError && canCreateForSession ? (
            <CreateGroupComponent
              account={account}
              loginComplete={loginComplete}
              provider={provider}
              litHooks={this.props.litHooks}
              toggleLoginModal={toggleLoginModal}
              expanded={true}
              network={network}
              preferConnectedNetworkForAuthoring={sessionCapabilities.isPureWorkerCanonical}
              sessionConfigOverride={activeGroup}
              sessionSlug={effectiveSessionSlug}
              sessionInfo={sessionInfo}
              sessionName={sessionName}
              defaultSbtTags={this.props.defaultSbtTags}
              sbtCacheRevision={sbtCacheRevision}
            />
          ) : !sessionConfigError ? (
            renderCreationDenied()
          ) : null}
        </div>
      );
    }

    // actualFeaturedList: prop override, else group config
    const { featured_SBTs_LIST = [] } = getDisplaySessionLists(effectiveSessionSlug || '');
    const baseFeaturedList =
      this.props.defaultFeaturedSBTs && this.props.defaultFeaturedSBTs.length
        ? this.props.defaultFeaturedSBTs
        : featured_SBTs_LIST;

    // Auto-feature embedded session SBTs by matching metadata sessionSlug to the active session.
    const effectiveSessionAutoFeature = isSessionAutoFeatureEnabled(this.props.sessionConfig);
    const scopeMode = readSessionScanScope();
    const listScopeSessionSlugs = scopeMode === 'list' ? readSessionScanSlugs() : [];
    // Embedded mini views (for example OnePageSession) should stay scoped to their active session
    // instead of inheriting explorer/list-wide featured aggregation from a previous route.
    const includeListScopeSessions =
      !this.props.miniaturized && scopeMode === 'list' && listScopeSessionSlugs.length > 0;

    const progressBySlug =
      this.props.sbtScanProgressBySlug && typeof this.props.sbtScanProgressBySlug === 'object'
        ? this.props.sbtScanProgressBySlug
        : {};
    const actualFeaturedEntries = this.getMemoizedFeaturedEntries({
      baseFeaturedList,
      effectiveSessionSlug,
      effectiveSessionAutoFeature,
      requireExplicitAutoFeatureSessionSlug: this.props.requireExplicitAutoFeatureSessionSlug === true,
      isSBTCacheReady,
      isAllSessionsMode: allSessionsMode,
      includeListScopeSessions,
      listScopeSessionSlugs,
      progressBySlug,
    });
    const preferCacheBackedFeaturedCards = this.props.preferCacheBackedFeaturedCards === true;
    const shouldUseCacheBackedFeaturedCards = preferCacheBackedFeaturedCards && isSBTCacheReady !== true;
    const cacheBackedFeaturedCards = shouldUseCacheBackedFeaturedCards
      ? this.getMemoizedFeaturedCacheCards({
          featuredEntries: actualFeaturedEntries,
          isSBTCacheReady,
          progressBySlug,
        })
      : [];
    const cacheBackedFeaturedCardMap = new Map<string, CacheBackedFeaturedCard>(
      cacheBackedFeaturedCards.map((entry) => {
        const sessionSlug = normalizeSessionSlug(entry?.sessionSlug || '');
        const lowerAddress = String(entry?.address || '')
          .trim()
          .toLowerCase();
        return [`${sessionSlug}|${lowerAddress}`, entry];
      }),
    );
    const featuredRenderEntries: FeaturedRenderEntry[] = actualFeaturedEntries.map((entry) => {
      const sessionSlug = normalizeSessionSlug(entry?.sessionSlug || '');
      const lowerAddress = String(entry?.address || '')
        .trim()
        .toLowerCase();
      const cacheKey = `${sessionSlug}|${lowerAddress}`;
      const cacheEntry = shouldUseCacheBackedFeaturedCards ? cacheBackedFeaturedCardMap.get(cacheKey) : null;
      return cacheEntry ? { kind: 'cache', entry: cacheEntry } : { kind: 'fallback', entry };
    });
    const featuredSessionSlugs = dedupeSessionSlugList([
      effectiveSessionSlug,
      ...actualFeaturedEntries.map((entry) => entry.sessionSlug),
    ]);
    const featuredScanActive = featuredSessionSlugs.some((slug) => {
      const progress = progressBySlug[slug];
      if (!progress || typeof progress !== 'object') return false;
      return true;
    });
    const hasFeaturedCards = featuredRenderEntries.length > 0;
    const featuredCardsNeedHydration =
      hasFeaturedCards &&
      (featuredScanActive ||
        (isSBTCacheReady !== true && cacheBackedFeaturedCards.length < actualFeaturedEntries.length));
    // Keep configured or discovered cards visible while metadata hydrates, but avoid
    // extra loading chrome once every featured card has complete cached metadata.
    const showFeaturedCornerSpinner = featuredCardsNeedHydration;
    const showFeaturedColdStartSpinner = !hasFeaturedCards && (!isSBTCacheReady || featuredScanActive);
    const renderCreateGroupPanel = () => (
      <>
        {shouldShowAdvancedExternalSbtNotice(activeGroup) ? <SbtCreateAdvancedExternalNotice /> : null}
        {canCreateForSession ? (
          <CreateGroupComponent
            account={account}
            loginComplete={loginComplete}
            provider={provider}
            litHooks={this.props.litHooks}
            toggleLoginModal={toggleLoginModal}
            expanded={effectiveShowCreateGroup}
            network={network}
            sessionSlug={effectiveSessionSlug}
            sessionInfo={sessionInfo}
            sessionName={sessionName}
            defaultSbtTags={this.props.defaultSbtTags}
            sbtCacheRevision={sbtCacheRevision}
          />
        ) : (
          renderCreationDenied()
        )}
      </>
    );
    const showCreateGroupBeforeFeatured = effectiveShowCreateGroup && showCreateGroupAboveFeatured;
    const showCreateGroupAfterFeatured = effectiveShowCreateGroup && !showCreateGroupBeforeFeatured;
    const showMiniSbtAddress = isCryptoMode();

    return (
      <div>
        {/* Render manual Featured/Create section (Bottom Appearance) for both Miniaturized AND Standard modes */}
        <div>
          {showCreateGroupBeforeFeatured && renderCreateGroupPanel()}
          {/* <h2 className={styles.featuredTitle}>Featured</h2> */}
          {showFeaturedColdStartSpinner ? (
            <FontAwesomeIcon icon={faSpinner} spin className={styles.loadingIcon} />
          ) : (
            <div className={styles.featuredSection}>
              {showFeaturedCornerSpinner && (
                <FontAwesomeIcon
                  icon={faSpinner}
                  spin
                  className={styles.featuredSectionSpinner}
                  data-testid="embedded-featured-spinner"
                  aria-label="Refreshing groups"
                  title="Refreshing groups"
                />
              )}
              <div className={styles.sbtGrid}>
                {featuredRenderEntries.map(({ kind, entry }, index: number) => {
                  if (kind === 'cache') {
                    const {
                      imageUrl,
                      isMintingActive,
                      isPasswordLocked,
                      resolvedSessionSlug,
                      sbtAddress,
                      sbtKey,
                      sbtName,
                      shortenedAddress,
                    } = buildCacheFeaturedCardModel({
                      defaultImage: defaultSbtImage,
                      effectiveSessionSlug,
                      entry,
                      getDisplayName: getSbtDisplayName,
                      getShortAddress: getShortenedAddress,
                      index,
                      sbtLabel: t('sbt'),
                    });
                    return (
                      <a
                        key={sbtKey}
                        href={buildSbtDetailPath(sbtAddress, resolvedSessionSlug)}
                        className={sbtPageStyles.sbtItem}
                        style={resolveCacheFeaturedCardLinkStyle()}
                        data-testid={`cache-featured-sbt-link-${String(sbtAddress || '').toLowerCase()}`}
                      >
                        <div className={sbtPageStyles.iconOverlay}>
                          {isMintingActive ? (
                            <div className={sbtPageStyles.liveIndicator} aria-label={`${t('minting')} Live`}></div>
                          ) : (
                            <div className={sbtPageStyles.endedIndicator} aria-label={`${t('minting')} Ended`}></div>
                          )}
                          {isPasswordLocked && <FontAwesomeIcon icon={faLock} className={sbtPageStyles.lockIcon} />}
                        </div>
                        <div className={sbtPageStyles.miniImageContainer}>
                          <img src={imageUrl} alt={sbtName} className={sbtPageStyles.sbtImage} />
                        </div>
                        <p className={sbtPageStyles.miniSbtName}>{sbtName}</p>
                        {showMiniSbtAddress ? <p className={sbtPageStyles.miniSbtAddress}>{shortenedAddress}</p> : null}
                      </a>
                    );
                  }

                  const { resolvedSessionSlug, sbtAddress, sbtKey } = buildFeaturedEntryModel({
                    effectiveSessionSlug,
                    entry,
                    index,
                  });
                  return (
                    <SBTPageComponent
                      key={sbtKey}
                      SBTAddress={sbtAddress}
                      account={account}
                      provider={provider}
                      litHooks={this.props.litHooks}
                      network={network}
                      miniaturized={true}
                      miniMintable={true}
                      loginComplete={loginComplete}
                      toggleLoginModal={toggleLoginModal}
                      sessionSlug={resolvedSessionSlug}
                      isSBTCacheReady={isSBTCacheReady}
                      sbtCacheRevision={sbtCacheRevision}
                      refreshSbtData={this.props.refreshSbtData}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.container}>
            {!hideMiniActionRow && (
              <div className={styles.buttonRow}>
                <button
                  onClick={() => (window.location.href = buildPublicRoute(sbtsListPath()))}
                  className={styles.backButton}
                >
                  <FontAwesomeIcon icon={faExpand} /> View All
                </button>
                {canCreateForSession ? (
                  <button
                    className={styles.showResultsButton}
                    onClick={this.toggleCreateGroup}
                    data-testid={E2E_TESTIDS.SBTS_CREATE_TOGGLE}
                  >
                    <FontAwesomeIcon icon={faPlus} /> {effectiveShowCreateGroup ? 'Exit' : 'Create'}
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {showCreateGroupAfterFeatured && renderCreateGroupPanel()}
        </div>

        {/* Full list (standard page) -- Rendered ONLY if we are on the dedicated /sbts route */}
        {!this.props.miniaturized && onSbtsRoute && (
          <SBTsListComponent
            provider={provider}
            network={network}
            account={account}
            litHooks={this.props.litHooks}
            loginComplete={loginComplete}
            toggleLoginModal={toggleLoginModal}
            miniaturized={false}
            sbtCacheRevision={sbtCacheRevision}
            onRequestSbtCacheRefresh={this.props.onRequestSbtCacheRefresh}
            isSBTCacheReady={isSBTCacheReady}
            refreshSbtData={this.props.refreshSbtData}
            latestBlockNumber={this.props.latestBlockNumber}
            sbtScanProgressBySlug={this.props.sbtScanProgressBySlug}
            sbtRealtimeCoverageBySlug={this.props.sbtRealtimeCoverageBySlug}
            /* group-aware routing */
            sessionSlug={effectiveSessionSlug}
            sessionConfig={activeGroup}
            allSessionsMode={allSessionsMode}
            ensureLightSbtDiscovery={this.props.ensureLightSbtDiscovery}
            ensureLightSbtUniverse={this.props.ensureLightSbtUniverse}
            refreshSessionUniverseRegistryCache={this.props.refreshSessionUniverseRegistryCache}
            /* embeddedMode suppresses internal Header/Featured to avoid duplication */
            embeddedMode={true}
          />
        )}
      </div>
    );
  }
}

const mapStateToProps = (state: UnknownRecord) => {
  const sessionState = isRecord(state.sessionState) ? state.sessionState : {};
  const activeSessionSlug = sessionState.activeSessionSlug == null ? undefined : String(sessionState.activeSessionSlug);
  return { activeSessionSlug };
};

export default connect(mapStateToProps)(SBTsPage);
