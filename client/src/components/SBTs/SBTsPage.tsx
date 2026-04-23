/** @file SBTsPage.tsx */

import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faSpinner, faPlus, faLock } from '@fortawesome/free-solid-svg-icons';
import styles from './SBTsPage.module.scss';
import sbtPageStyles from './SBTPage.module.scss';
import SBTsList from './SBTsList';
import CreateGroup from './CreateSBTGroup';
import SBTPage from './SBTPage';
import {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import { connect } from 'react-redux';
import { createLogger } from '../../utilities/logging.js';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { hasCachedCreateSbtForm } from '../../utilities/sbt/sbtCreateFormCache.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import { isCryptoMode, sbtsListPath, t } from '../../utilities/ui/terminology.js';
import defaultSbtImage from '../../assets/img/ce_circuit_logo.png';

type AnyRecord = Record<string, any>;
type MaybeRecord = AnyRecord | null;
type MemoBucket = {
  key: string;
  result: any[];
};

type SBTsPageProps = AnyRecord;
type SBTsPageState = {
  showSBTsList: boolean;
  showCreateGroup: boolean;
};

const SBTsListComponent = SBTsList as any;
const CreateGroupComponent = CreateGroup as any;
const SBTPageComponent = SBTPage as any;

const sbtLog = createLogger('sbt');

const normalizeFeaturedCardImageUrl = (value: any) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^ipfs:\/\//i.test(raw)) return `https://ipfs.io/ipfs/${raw.replace(/^ipfs:\/\//i, '')}`;
  return normalizeArweaveUrl(raw, { contextLabel: 'sbt_page_featured_image' });
};

const dedupeAddressListCaseInsensitive = (list: any) => {
  const seen = new Set();
  const out: string[] = [];
  (Array.isArray(list) ? list : []).forEach((addr) => {
    const raw = String(addr || '').trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    out.push(raw);
  });
  return out;
};

const dedupeSessionSlugList = (list: any) => {
  const seen = new Set();
  const out: string[] = [];
  (Array.isArray(list) ? list : []).forEach((slug) => {
    const normalized = normalizeSessionSlug(slug || '');
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

const buildFeaturedProgressSignature = (progressBySlug: AnyRecord = {}, slugs: any[] = []) => (
  dedupeSessionSlugList(slugs).map((slug) => {
    const progress = progressBySlug?.[slug];
    if (!progress || typeof progress !== 'object') return `${slug}:idle`;
    return [
      slug,
      Number(progress.currentBlock || 0),
      Number(progress.latestBlock || 0),
      Number(progress.displayCurrentBlock || 0),
      Number(progress.liveCurrentBlock || 0),
      Number(progress.lastBlock || 0),
      progress.scanInProgress ? '1' : '0',
      progress.deferred ? '1' : '0',
    ].join(':');
  }).join('|')
);

const hasOwn = (obj: any, key: string) => (
  !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key)
);

const hasAuthoritativeSessionSlug = (obj: any) => {
  if (!hasOwn(obj, 'sessionSlug')) return false;
  const hasExplicitFlag = hasOwn(obj, 'sessionSlugExplicit');
  return obj.sessionSlugExplicit === true || !hasExplicitFlag;
};

const resolveFeaturedSbtSessionSlug = (sbt: any) => {
  const info = sbt?.sbtInfo || {};

  if (hasAuthoritativeSessionSlug(info)) {
    return normalizeSessionSlug(info?.sessionSlug || '');
  }
  if (hasAuthoritativeSessionSlug(sbt)) {
    return normalizeSessionSlug(sbt?.sessionSlug || '');
  }

  // Auto-feature must respect metadata authority boundaries, not cache/source buckets.
  const legacyRaw = info?.slug;
  if (legacyRaw != null && String(legacyRaw).trim() !== '') {
    return normalizeSessionSlug(legacyRaw);
  }

  return '';
};

const getDisplaySessionConfig = (slugIn = '') => {
  const slug = normalizeSessionSlug(slugIn || '');
  if (!slug) {
    return (
      getSessionConfigBySlugOrDefault('')
      || getDemoSessionConfigBySlug('', { allowDemoFallback: true })
      || null
    );
  }
  return (
    getSessionConfigBySlug(slug)
    || getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })
    || null
  );
};

const getDisplaySessionLists = (slugIn = '') => {
  const sessionConfig = getDisplaySessionConfig(slugIn) || {};
  return {
    featured_SBTs_LIST: Array.isArray(sessionConfig?.featured_SBTs_LIST)
      ? sessionConfig.featured_SBTs_LIST
      : [],
    ignored_SBTs_LIST: Array.isArray(sessionConfig?.ignored_SBTs_LIST)
      ? sessionConfig.ignored_SBTs_LIST
      : [],
  };
};

const resolveAutoFeatureBySessionSlug = (metadata: MaybeRecord = null) => (
  metadata?.autoFeatureSBTsBySessionSlug !== undefined
    ? metadata.autoFeatureSBTsBySessionSlug
    : metadata?.autoFeatureSBTsWithFeaturedSbtTags
);

const isSessionAutoFeatureEnabled = (sessionConfig: AnyRecord | null = null) => (
  resolveAutoFeatureBySessionSlug(sessionConfig) !== false
);

export class SBTsPage extends Component<SBTsPageProps, SBTsPageState> {
  _featuredListMemo: MemoBucket;

  _featuredEntriesMemo: MemoBucket;

  _featuredCacheCardsMemo: MemoBucket;

  constructor(props: SBTsPageProps) {
    super(props);
    const initialCreateGroupSessionSlug = normalizeSessionSlug(
      props.sessionSlug || props.sessionConfig?.slug || props.activeSessionSlug || ''
    );
    this.state = {
      showSBTsList: false,
      // Initialize Create Group open when cache exists (idempotent; only at mount time)
      showCreateGroup: hasCachedCreateSbtForm({
        sessionSlug: initialCreateGroupSessionSlug,
        migrateLegacyToSessionKey: true,
        clearInvalid: true,
      } as any),
    };

    this.toggleSBTsList = this.toggleSBTsList.bind(this);
    this.toggleCreateGroup = this.toggleCreateGroup.bind(this);
    this._featuredListMemo = { key: '', result: [] };
    this._featuredEntriesMemo = { key: '', result: [] };
    this._featuredCacheCardsMemo = { key: '', result: [] };
  }

  toggleSBTsList() {
    this.setState((prevState) => ({ showSBTsList: !prevState.showSBTsList }));
  }

  toggleCreateGroup() {
    if (typeof this.props.onCreateGroupToggleExternal === 'function') {
      this.props.onCreateGroupToggleExternal();
      return;
    }
    this.setState((prevState) => ({ showCreateGroup: !prevState.showCreateGroup }));
  }

  getMemoizedFeaturedList({
    baseFeaturedList,
    effectiveSessionSlug,
    autoFeature,
    isSBTCacheReady,
    isAllSessionsMode = false,
    progressBySlug = {},
  }: AnyRecord) {
    const baseList = dedupeAddressListCaseInsensitive(baseFeaturedList);
    const sessionSlugTarget = normalizeSessionSlug(effectiveSessionSlug || '');
    const key = [
      sessionSlugTarget,
      autoFeature ? '1' : '0',
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
    if (autoFeature && !isAllSessionsMode) {
      try {
        const cache = peekCacheSync('sbtCache', effectiveSessionSlug, { clone: false });
        if (cache && typeof cache === 'object') {
          const autoFeaturedAddresses: string[] = [];
          Object.values(cache).forEach((netNode: any) => {
            const sbtList = netNode && typeof netNode === 'object' ? netNode.sbtList : null;
            if (!sbtList || typeof sbtList !== 'object') return;
            Object.values(sbtList).forEach((sbt: any) => {
              if (!sbt?.sbtAddress) return;
              if (sbt?.sbtInfo?.unlisted || sbt?.unlisted) return;
              const sbtSessionSlug = resolveFeaturedSbtSessionSlug(sbt);
              if (sbtSessionSlug !== sessionSlugTarget) return;
              autoFeaturedAddresses.push(sbt.sbtAddress);
            });
          });
          if (autoFeaturedAddresses.length > 0) {
            next = dedupeAddressListCaseInsensitive([...baseList, ...autoFeaturedAddresses]);
          }
        }
      } catch (e) {
        sbtLog.warn("[SBTsPage] Auto-feature logic failed:", e);
      }
    }

    this._featuredListMemo = { key, result: next };
    return next;
  }

  getMemoizedFeaturedEntries({
    baseFeaturedList,
    effectiveSessionSlug,
    effectiveSessionAutoFeature,
    isSBTCacheReady,
    isAllSessionsMode = false,
    includeListScopeSessions = false,
    listScopeSessionSlugs = [],
    progressBySlug = {},
  }: AnyRecord) {
    const normalizedEffectiveSlug = normalizeSessionSlug(effectiveSessionSlug || '');
    const scopedSessionSlugs = includeListScopeSessions
      ? dedupeSessionSlugList(listScopeSessionSlugs)
      : [normalizedEffectiveSlug];
    const orderedSessionSlugs = scopedSessionSlugs.length > 0
      ? (
        normalizedEffectiveSlug && scopedSessionSlugs.includes(normalizedEffectiveSlug)
          ? dedupeSessionSlugList([normalizedEffectiveSlug, ...scopedSessionSlugs])
          : scopedSessionSlugs
      )
      : [normalizedEffectiveSlug];
    const baseList = dedupeAddressListCaseInsensitive(baseFeaturedList);
    const perSlugFeaturedSignatures = orderedSessionSlugs.map((slug) => {
      const featured = slug === normalizedEffectiveSlug
        ? baseList
        : dedupeAddressListCaseInsensitive(getDisplaySessionLists(slug)?.featured_SBTs_LIST || []);
      return `${slug}:${featured.map((addr) => addr.toLowerCase()).join(',')}`;
    });
    const perSlugAutoFeatureSignatures = orderedSessionSlugs.map((slug) => {
      const autoFeatureForSlug = slug === normalizedEffectiveSlug
        ? !!effectiveSessionAutoFeature
        : isSessionAutoFeatureEnabled(getDisplaySessionConfig(slug));
      return `${slug}:${autoFeatureForSlug ? '1' : '0'}`;
    });
    const key = [
      normalizedEffectiveSlug,
      isSBTCacheReady ? '1' : '0',
      isAllSessionsMode ? '1' : '0',
      includeListScopeSessions ? '1' : '0',
      String(Number(this.props.sbtCacheRevision || 0)),
      buildFeaturedProgressSignature(progressBySlug, orderedSessionSlugs),
      perSlugAutoFeatureSignatures.join('|'),
      perSlugFeaturedSignatures.join('|'),
    ].join('|');
    if (this._featuredEntriesMemo.key === key) {
      return this._featuredEntriesMemo.result;
    }

    const seenAddresses = new Set();
    const next: AnyRecord[] = [];
    orderedSessionSlugs.forEach((slug) => {
      const featuredForSlug = slug === normalizedEffectiveSlug
        ? baseList
        : dedupeAddressListCaseInsensitive(getDisplaySessionLists(slug)?.featured_SBTs_LIST || []);
      const autoFeatureForSlug = slug === normalizedEffectiveSlug
        ? !!effectiveSessionAutoFeature
        : isSessionAutoFeatureEnabled(getDisplaySessionConfig(slug));
      const addresses = this.getMemoizedFeaturedList({
        baseFeaturedList: featuredForSlug,
        effectiveSessionSlug: slug,
        autoFeature: autoFeatureForSlug,
        isSBTCacheReady,
        isAllSessionsMode,
        progressBySlug,
      });
      addresses.forEach((address: any) => {
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
  }: AnyRecord) {
    const normalizedEntries = (Array.isArray(featuredEntries) ? featuredEntries : []).map((entry) => ({
      address: String(entry?.address || '').trim(),
      lowerAddress: String(entry?.address || '').trim().toLowerCase(),
      sessionSlug: normalizeSessionSlug(entry?.sessionSlug || ''),
    })).filter((entry) => entry.address && entry.lowerAddress);
    const key = [
      String(Number(this.props.sbtCacheRevision || 0)),
      isSBTCacheReady ? '1' : '0',
      buildFeaturedProgressSignature(
        progressBySlug,
        normalizedEntries.map((entry) => entry.sessionSlug)
      ),
      normalizedEntries.map((entry) => `${entry.sessionSlug}|${entry.lowerAddress}`).join(','),
    ].join('|');
    if (this._featuredCacheCardsMemo.key === key) {
      return this._featuredCacheCardsMemo.result;
    }

    const next = normalizedEntries.map((entry) => {
      let cacheMatch: AnyRecord | null = null;
      try {
        const cache = peekCacheSync('sbtCache', entry.sessionSlug, { clone: false });
        if (cache && typeof cache === 'object') {
          Object.values(cache).some((netNode: any) => {
            const candidate = netNode?.sbtList?.[entry.lowerAddress];
            if (!candidate?.sbtInfo) return false;
            cacheMatch = candidate;
            return true;
          });
        }
      } catch (e) {
        sbtLog.warn('[SBTsPage] cache-backed featured lookup failed:', e);
      }
      const resolvedCacheMatch = cacheMatch as AnyRecord | null;
      if (!resolvedCacheMatch || !resolvedCacheMatch.sbtInfo) return null;
      return {
        address: entry.address,
        sessionSlug: entry.sessionSlug,
        sbt: resolvedCacheMatch,
      };
    }).filter(Boolean);

    this._featuredCacheCardsMemo = { key, result: next };
    return next;
  }

/**
   * Resolve effective routing for SBT/group list pages:
   * Priority: URL (/{sbts|groups}/:slugOrKey) → Redux activeSessionSlug → referrer /session/:slug → default general ('')
   * Canonicalize to the active terminology-aware list path when a non-empty slug is known (no reload).
   */
  getResolvedRouting() {
    const path = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
    const parts = path.split('/').filter(Boolean);
    const onSbtsRoute = parts[0] === 'sbts' || parts[0] === 'groups';
    const urlSlugLike = onSbtsRoute && parts.length > 1 ? parts[1] : undefined;
    const isCreateRoute = onSbtsRoute && urlSlugLike === 'new';
    const effectiveUrlSlug = isCreateRoute ? undefined : urlSlugLike;

    // Referrer-based fallback (covers reload from /session/:slug)
    let referrerSlug = '';
    try {
      const ref = (typeof document !== 'undefined' ? document.referrer : '') || '';
      const m = ref.match(/\/session\/([^/?#]+)/i);
      if (m && m[1]) referrerSlug = normalizeSessionSlug(m[1].trim());
    } catch (e) { sbtLog.warn('SBTsPage: fallback', e); }

    // Resolve by URL → explicit prop → Redux → referrer → default general
    const groupFromUrl   = effectiveUrlSlug ? getDisplaySessionConfig(effectiveUrlSlug) : null;
    const propSlugLike   = this.props.sessionSlug || this.props.sessionConfig?.slug || '';
    const groupFromProp  = propSlugLike ? getDisplaySessionConfig(propSlugLike) : null;
    const groupFromRedux = this.props.activeSessionSlug ? getDisplaySessionConfig(this.props.activeSessionSlug) : null;
    const groupFromRef   = referrerSlug ? getDisplaySessionConfig(referrerSlug) : null;
    const activeGroup    = groupFromUrl || groupFromProp || groupFromRedux || groupFromRef || getDisplaySessionConfig('');

    const canonicalSlug = activeGroup?.slug || ''; // '' means general
    const urlHasNoSlug  = onSbtsRoute && effectiveUrlSlug === undefined && !isCreateRoute;

    // Canonicalize (silent) if we are on /sbts and have a non-empty slug to show
    if (!isCreateRoute && urlHasNoSlug && canonicalSlug) {
      try { window.history.replaceState(null, '', `${sbtsListPath()}/${canonicalSlug}`); } catch (e) { sbtLog.warn('SBTsPage: fallback', e); }
      return { canonicalSlug, urlHasNoSlug: false, onSbtsRoute, isCreateRoute }; // URL is now canonical
    }

    return { canonicalSlug, urlHasNoSlug, onSbtsRoute, isCreateRoute };
  }

  render() {
    const sessionName = this.props.sessionName || '';
    const sessionInfo = this.props.sessionInfo || '';

    const { provider, network, account, loginComplete, toggleLoginModal, isSBTCacheReady, sbtCacheRevision } = this.props;
    const { showSBTsList, showCreateGroup } = this.state;
    const effectiveShowCreateGroup = typeof this.props.showCreateGroupExternal === 'boolean'
      ? this.props.showCreateGroupExternal
      : showCreateGroup;
    const hideMiniActionRow = this.props.hideMiniActionRow === true;
    const showCreateGroupAboveFeatured = this.props.showCreateGroupAboveFeatured === true;

    // Resolve routing + slug once per render
    const { canonicalSlug, urlHasNoSlug, onSbtsRoute, isCreateRoute } = this.getResolvedRouting();
    const effectiveSessionSlug = canonicalSlug; // may be '' (general)
    const allSessionsMode = (urlHasNoSlug && !canonicalSlug); // plain /sbts with no redux/referrer slug => enumerate all groups
    if (isCreateRoute) {
      return (
        <div>
          <div className={styles.container}>
            <div id={styles.buttonRow}>
              <button
                onClick={() => (window.location.href = sbtsListPath())}
                className={styles.backButton}
              >
                <FontAwesomeIcon icon={faExpand} /> {`Back to ${t('sbts')}`}
              </button>
            </div>
          </div>
          <CreateGroupComponent
            account={account}
            loginComplete={loginComplete}
            provider={provider}
            toggleLoginModal={toggleLoginModal}
            expanded={true}
            network={network}
            sessionSlug={effectiveSessionSlug}
            sessionInfo={sessionInfo}
            sessionName={sessionName}
            defaultSbtTags={this.props.defaultSbtTags}
            sbtCacheRevision={sbtCacheRevision}
          />
        </div>
      );
    }

    // actualFeaturedList: prop override, else group config
    const { featured_SBTs_LIST = [] } = getDisplaySessionLists(effectiveSessionSlug || '');
    const baseFeaturedList =
      (this.props.defaultFeaturedSBTs && this.props.defaultFeaturedSBTs.length)
        ? this.props.defaultFeaturedSBTs
        : featured_SBTs_LIST;

    // Auto-feature embedded session SBTs by matching metadata sessionSlug to the active session.
    const effectiveSessionAutoFeature = isSessionAutoFeatureEnabled(this.props.sessionConfig);
    const scopeMode = readSessionScanScope();
    const listScopeSessionSlugs = scopeMode === 'list' ? readSessionScanSlugs() : [];
    // Embedded mini views (for example OnePageSession) should stay scoped to their active session
    // instead of inheriting explorer/list-wide featured aggregation from a previous route.
    const includeListScopeSessions = (
      !this.props.miniaturized &&
      scopeMode === 'list' &&
      listScopeSessionSlugs.length > 0
    );

    const progressBySlug = (
      this.props.sbtScanProgressBySlug &&
      typeof this.props.sbtScanProgressBySlug === 'object'
    ) ? this.props.sbtScanProgressBySlug : {};
    const actualFeaturedEntries = this.getMemoizedFeaturedEntries({
      baseFeaturedList,
      effectiveSessionSlug,
      effectiveSessionAutoFeature,
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
    const cacheBackedFeaturedCardMap = new Map(
      cacheBackedFeaturedCards.map((entry: any) => {
        const sessionSlug = normalizeSessionSlug(entry?.sessionSlug || '');
        const lowerAddress = String(entry?.address || '').trim().toLowerCase();
        return [`${sessionSlug}|${lowerAddress}`, entry];
      })
    );
    const featuredRenderEntries = actualFeaturedEntries.map((entry) => {
      const sessionSlug = normalizeSessionSlug(entry?.sessionSlug || '');
      const lowerAddress = String(entry?.address || '').trim().toLowerCase();
      const cacheKey = `${sessionSlug}|${lowerAddress}`;
      const cacheEntry = shouldUseCacheBackedFeaturedCards
        ? cacheBackedFeaturedCardMap.get(cacheKey)
        : null;
      return cacheEntry
        ? { kind: 'cache', entry: cacheEntry }
        : { kind: 'fallback', entry };
    });
    const featuredSessionSlugs = dedupeSessionSlugList([
      effectiveSessionSlug,
      ...actualFeaturedEntries.map(({ sessionSlug }: AnyRecord) => sessionSlug),
    ]);
    const featuredScanActive = featuredSessionSlugs.some((slug) => {
      const progress = progressBySlug[slug];
      if (!progress || typeof progress !== 'object') return false;
      return true;
    });
    const hasFeaturedCards = featuredRenderEntries.length > 0;
    // Keep previously discovered cards visible while a route-local scan is active, but
    // avoid showing a "not ready yet" spinner once we already have cards to render.
    const showFeaturedCornerSpinner = hasFeaturedCards && featuredScanActive;
    const showFeaturedColdStartSpinner = !hasFeaturedCards && (!isSBTCacheReady || featuredScanActive);
    const renderCreateGroupPanel = () => (
      <CreateGroupComponent
        account={account}
        loginComplete={loginComplete}
        provider={provider}
        toggleLoginModal={toggleLoginModal}
        expanded={effectiveShowCreateGroup}
        network={network}
        sessionSlug={effectiveSessionSlug}
        sessionInfo={sessionInfo}
        sessionName={sessionName}
        defaultSbtTags={this.props.defaultSbtTags}
        sbtCacheRevision={sbtCacheRevision}
      />
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
              <FontAwesomeIcon icon={faSpinner} spin id={styles.loadingIcon} />
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
                {featuredRenderEntries.map(({ kind, entry }: AnyRecord, index: number) => {
                  if (kind === 'cache') {
                    const sbt = entry?.sbt || null;
                    const sbtInfo = sbt?.sbtInfo || {};
                    const sbtAddress = String(entry?.address || '').trim();
                    const resolvedSessionSlug = normalizeSessionSlug(entry?.sessionSlug || effectiveSessionSlug || '');
                    const sbtKey = `${resolvedSessionSlug || 'general'}:${String(sbtAddress || '').toLowerCase() || index}`;
                    const imageUrl = normalizeFeaturedCardImageUrl(sbtInfo?.image) || defaultSbtImage;
                    const sbtName = getSbtDisplayName(sbtInfo) || `Unnamed ${t('sbt')}`;
                    const shortenedAddress = getShortenedAddress(sbtAddress, false);
                    const mintingEndTime = Number(sbtInfo?.mintingEndTime || 0);
                    const isMintingActive = mintingEndTime === 0 || mintingEndTime > Math.floor(Date.now() / 1000);
                    const isPasswordLocked = !!(sbtInfo?.hasPasswordMint);
                    return (
                      <a
                        key={sbtKey}
                        href={buildSbtDetailPath(sbtAddress, resolvedSessionSlug)}
                        className={sbtPageStyles.sbtItem}
                        style={{
                          minWidth: '240px',
                          maxWidth: '240px',
                          textDecoration: 'none',
                          cursor: 'pointer',
                        }}
                        data-testid={`cache-featured-sbt-link-${String(sbtAddress || '').toLowerCase()}`}
                      >
                        <div className={sbtPageStyles.iconOverlay}>
                          {isMintingActive
                            ? <div className={sbtPageStyles.liveIndicator} aria-label={`${t('minting')} Live`}></div>
                            : <div className={sbtPageStyles.endedIndicator} aria-label={`${t('minting')} Ended`}></div>
                          }
                          {isPasswordLocked && (
                            <FontAwesomeIcon icon={faLock} className={sbtPageStyles.lockIcon} />
                          )}
                        </div>
                        <div className={sbtPageStyles.miniImageContainer}>
                          <img
                            src={imageUrl}
                            alt={sbtName}
                            className={sbtPageStyles.sbtImage}
                          />
                        </div>
                        <p id={sbtPageStyles.miniSbtName}>{sbtName}</p>
                        {showMiniSbtAddress ? (
                          <p id={sbtPageStyles.miniSbtAddress}>{shortenedAddress}</p>
                        ) : null}
                      </a>
                    );
                  }

                  const { address: sbtAddress, sessionSlug } = entry;
                  const resolvedSessionSlug = normalizeSessionSlug(sessionSlug || effectiveSessionSlug || '');
                  const sbtKey = `${resolvedSessionSlug || 'general'}:${String(sbtAddress || '').toLowerCase() || index}`;
                  return (
                    <SBTPageComponent
                      key={sbtKey}
                      SBTAddress={sbtAddress}
                      account={account}
                      provider={provider}
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
                <div id={styles.buttonRow}>
                  <button
                    onClick={() => (window.location.href = sbtsListPath())}
                    className={styles.backButton}
                  >
                    <FontAwesomeIcon icon={faExpand} /> View All
                  </button>
                  <button
                    id={styles.showResultsButton}
                    onClick={this.toggleCreateGroup}
                    data-testid={E2E_TESTIDS.SBTS_CREATE_TOGGLE}
                  >
                     <FontAwesomeIcon icon={faPlus} /> {effectiveShowCreateGroup ? "Exit" : "Create"}
                  </button>
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

const mapStateToProps = (state: AnyRecord) => ({
  activeSessionSlug: state.sessionState.activeSessionSlug,
});

export default connect(mapStateToProps)(SBTsPage);
