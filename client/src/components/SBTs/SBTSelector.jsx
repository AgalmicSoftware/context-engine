/** @file SBTSelector.jsx */

import React from 'react';
import { Button, FormGroup, Label, Input } from 'reactstrap';
import { ethers } from 'ethers';
import styles from './SBTSelector.module.scss';
import { faCog, faExternalLinkAlt, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AsyncSearchSelect from "../Shared/AsyncSearchSelect.jsx";

import contractScripts from '../../utilities/web3/contractScripts.js';
import {
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionChainId,
  getSessionConfigBySlugOrDefault,
  getSessionLists,
  getSessionSlugByName,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import {
  loadSessionRegistryCache,
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
} from '../../utilities/web3/sessionRegistry.js';
import {
  DEFAULT_CHAIN_ID,
  CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS,
  USE_ONCHAIN_SESSION_REGISTRY,
} from '../../variables/appConfig.js';
import { createLogger, emitForcedLog } from '../../utilities/logging.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { listNamespaceEntriesSync, readCache, writeCache } from '../../utilities/cache/cacheScripts.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import { GLOBAL_SESSION_SELECTION_UPDATED_EVENT } from '../../utilities/session/globalSessionState.js';
import {
  getSbtMaskedFieldValue,
  hasSbtDisplayName,
  hydrateSbtDisplayNameTargeted,
  isSbtFieldLocked,
  isTargetedSbtMetadataLookupEnabled,
  resolveSbtDisplayLabel,
  warmSbtDisplayNamesTargeted,
} from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import { getCanonicalSessionFeaturedSBTs } from '../../utilities/sbt/sessionFeaturedSBTs.js';
import { resolveSbtSelectorSelectedSessionContext } from './sbtSelectorSessionResolution.js';

const sbtLog = createLogger('sbt');
const MASKED_SBT_LABEL = String(getSbtMaskedFieldValue() || '').trim().toLowerCase();
const ALLOW_DEMO_SESSION_FALLBACK = !USE_ONCHAIN_SESSION_REGISTRY;

const NAME_LOOKUP_BASE_DELAY_MS = 30 * 1000;
const NAME_LOOKUP_MAX_DELAY_MS = 60 * 60 * 1000;
const NAME_LOOKUP_MAX_EXPONENT = 8;
const SELECTED_SBT_HYDRATION_RETRY_MS = 45 * 1000;
const SHARED_LIGHT_UNIVERSE_KICKOFF_TTL_MS = 60 * 1000;
const SBT_SELECTOR_DEBUG_STORAGE_KEY = 'ce:sbtSelectorDebug';
const SBT_SELECTOR_DEBUG_QUERY_KEY = 'ceSbtSelectorDebug';

const readBoolishDebugFlag = (value) => {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const isForcedSbtSelectorDebugEnabled = () => {
  try {
    if (typeof globalThis !== 'undefined' && readBoolishDebugFlag(globalThis.CE_SBT_SELECTOR_DEBUG)) {
      return true;
    }
  } catch (_) {
    return false;
  }
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location?.search || '');
      if (params.has(SBT_SELECTOR_DEBUG_QUERY_KEY) && readBoolishDebugFlag(params.get(SBT_SELECTOR_DEBUG_QUERY_KEY))) {
        return true;
      }
    }
  } catch (_) {
    return false;
  }
  try {
    if (typeof localStorage !== 'undefined' && readBoolishDebugFlag(localStorage.getItem(SBT_SELECTOR_DEBUG_STORAGE_KEY))) {
      return true;
    }
  } catch (_) {
    return false;
  }
  try {
    if (typeof sessionStorage !== 'undefined' && readBoolishDebugFlag(sessionStorage.getItem(SBT_SELECTOR_DEBUG_STORAGE_KEY))) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
};

const shouldAutoSearchOtherSelectorSessions = () => {
  try {
    if (
      typeof globalThis !== 'undefined' &&
      typeof globalThis.CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS !== 'undefined'
    ) {
      return readBoolishDebugFlag(globalThis.CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS);
    }
  } catch (_) {
    return CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS;
  }
  return CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS;
};

const emitSbtSelectorDebug = (level, message, payload) => {
  const loggerMethod = typeof sbtLog?.[level] === 'function' ? sbtLog[level].bind(sbtLog) : sbtLog.log.bind(sbtLog);
  if (isForcedSbtSelectorDebugEnabled()) {
    if (typeof payload === 'undefined') {
      emitForcedLog(level, message);
    } else {
      emitForcedLog(level, message, payload);
    }
    return;
  }
  if (typeof payload === 'undefined') {
    loggerMethod(message);
  } else {
    loggerMethod(message, payload);
  }
};

const getNameLookupDelayMs = (attempts) => {
  const safeAttempts = Number(attempts || 0);
  const exponent = Math.min(Math.max(safeAttempts - 1, 0), NAME_LOOKUP_MAX_EXPONENT);
  return Math.min(NAME_LOOKUP_BASE_DELAY_MS * (2 ** exponent), NAME_LOOKUP_MAX_DELAY_MS);
};

const ensureNameLookupState = (sbtCache, netKey) => {
  if (!sbtCache[netKey] || typeof sbtCache[netKey] !== 'object') {
    sbtCache[netKey] = { sbtList: {}, nameLookupState: {} };
  }
  if (!sbtCache[netKey].nameLookupState || typeof sbtCache[netKey].nameLookupState !== 'object') {
    sbtCache[netKey].nameLookupState = {};
  }
  return sbtCache[netKey].nameLookupState;
};

const canRetryNameLookup = (nameLookupState, addressLower, now = Date.now()) => {
  const retryAt = Number(nameLookupState?.[addressLower]?.nextRetryAt || 0);
  return !Number.isFinite(retryAt) || retryAt <= now;
};

const markNameLookupFailure = (nameLookupState, addressLower, now = Date.now()) => {
  const prevAttempts = Number(nameLookupState?.[addressLower]?.attempts || 0) || 0;
  const attempts = prevAttempts + 1;
  const delayMs = getNameLookupDelayMs(attempts);
  nameLookupState[addressLower] = {
    attempts,
    nextRetryAt: now + delayMs,
    lastFailureAt: now,
  };
};

const clearNameLookupFailure = (nameLookupState, addressLower) => {
  if (!nameLookupState || !addressLower) return;
  delete nameLookupState[addressLower];
};

const normalizeAddressListForSig = (addresses) => (
  Array.from(new Set(
    (Array.isArray(addresses) ? addresses : [])
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  )).sort()
);

const normalizeSessionSlugListForSig = (slugs) => (
  Array.from(new Set(
    (Array.isArray(slugs) ? slugs : [])
      .map((value) => normalizeSessionSlug(value || ''))
      .filter((value) => value != null)
  ))
);

const buildSessionSlugSignature = (slugs) => (
  normalizeSessionSlugListForSig(slugs).join(',')
);

const buildFeaturedEntrySignature = (entries) => (
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const slug = normalizeSessionSlug(entry?.slug || '');
      const address = String(entry?.address || '').trim().toLowerCase();
      return `${slug}:${address}`;
    })
    .filter((value) => value !== ':')
    .join(',')
);

const normalizeChainValue = (value) => {
  const parsed = Number(value || 0);
  return parsed || null;
};

const resolveSbtEntryChainId = (entry, fallbackChainId = null) => (
  normalizeChainValue(
    entry?.chainId ||
    entry?.sbtInfo?.chainId ||
    entry?.sbtInfo?.chainID ||
    fallbackChainId
  )
);

const buildSbtLookupKey = ({ address, chainId } = {}) => {
  const lowerAddress = String(address || '').trim().toLowerCase();
  if (!lowerAddress) return '';
  const normalizedChainId = normalizeChainValue(chainId);
  return normalizedChainId ? `${normalizedChainId}:${lowerAddress}` : lowerAddress;
};

const buildScopedSbtIgnoreKey = ({ slug, address } = {}) => {
  const lowerAddress = String(address || '').trim().toLowerCase();
  if (!lowerAddress) return '';
  return `${pickNormalizedSessionSlug(slug)}|${lowerAddress}`;
};

const DEFAULT_FALLBACK_CHAIN_ID = normalizeChainValue(DEFAULT_CHAIN_ID);

const getNormalizedNetworkChainValue = (network) => (
  normalizeChainValue(network?.id || network?.chainId || 0)
);

const buildSessionConfigSig = (sessionConfig) => {
  const config = sessionConfig && typeof sessionConfig === 'object'
    ? sessionConfig
    : null;
  if (!config) return '';
  const slug = String(config?.slug || '');
  const factoryAddress = String(config?.contracts?.sbtFactory?.address || '').trim().toLowerCase();
  const networkChainId = normalizeChainValue(
    config?.networkChainId ||
    config?.__registry?.chainId ||
    config?.contracts?.sbtFactory?.chainId ||
    0
  );
  const blockStart = String(Number(config?.blockLimits?.start || 0) || '');
  const blockEnd = String(Number(config?.blockLimits?.end || 0) || '');
  return [slug, factoryAddress, String(networkChainId || ''), blockStart, blockEnd].join('|');
};

const buildSbtOptionsRequestSignature = ({
  slug,
  cacheRevision,
  sessionConfigSig,
  targetSlugChainSig,
  featuredEntries,
  ignoredFromConfig,
}) => {
  return [
    String(slug || ''),
    String(cacheRevision ?? ''),
    String(sessionConfigSig || ''),
    String(targetSlugChainSig || ''),
    buildFeaturedEntrySignature(featuredEntries),
    normalizeAddressListForSig(ignoredFromConfig).join(','),
  ].join('|');
};

const pickNormalizedSessionSlug = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = normalizeSessionSlug(value);
    if (normalized != null) return normalized;
  }
  return '';
};

const pickOptionalNormalizedSessionSlug = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = normalizeSessionSlug(value);
    if (normalized != null) return normalized;
  }
  return null;
};

const hasOwn = (value, key) => (
  !!value &&
  typeof value === 'object' &&
  Object.prototype.hasOwnProperty.call(value, key)
);

const hasAuthoritativeSessionSlug = (value) => {
  if (!hasOwn(value, 'sessionSlug')) return false;
  const hasExplicitFlag = hasOwn(value, 'sessionSlugExplicit');
  return value?.sessionSlugExplicit === true || !hasExplicitFlag;
};

const resolveAuthoritativeSbtSessionBindingSlug = (sbt) => {
  const sbtInfo = sbt?.sbtInfo || {};

  if (hasAuthoritativeSessionSlug(sbtInfo)) {
    return normalizeSessionSlug(sbtInfo?.sessionSlug || '');
  }
  if (hasAuthoritativeSessionSlug(sbt)) {
    return normalizeSessionSlug(sbt?.sessionSlug || '');
  }

  const legacySlugRaw = sbtInfo?.slug;
  if (legacySlugRaw != null && String(legacySlugRaw).trim() !== '') {
    return normalizeSessionSlug(legacySlugRaw);
  }
  return null;
};

const resolveDeclaredSbtSessionSlug = (sbt) => {
  const sbtInfo = sbt?.sbtInfo || {};
  if (hasOwn(sbtInfo, 'sessionSlug')) {
    return normalizeSessionSlug(sbtInfo?.sessionSlug || '');
  }
  if (hasOwn(sbt, 'sessionSlug')) {
    return normalizeSessionSlug(sbt?.sessionSlug || '');
  }
  return null;
};

const resolveConcreteSbtSessionBindingSlug = (sbt) => {
  const authoritativeSlug = resolveAuthoritativeSbtSessionBindingSlug(sbt);
  if (authoritativeSlug != null) return authoritativeSlug;

  const sbtInfo = sbt?.sbtInfo || {};

  const hasInferredSessionSlug = (
    (hasOwn(sbtInfo, 'sessionSlug') && sbtInfo?.sessionSlugExplicit === false) ||
    (hasOwn(sbt, 'sessionSlug') && sbt?.sessionSlugExplicit === false)
  );
  if (hasInferredSessionSlug) return null;

  const legacySessionName = String(
    sbtInfo?.sessionName ??
    sbt?.sessionName ??
    ''
  ).trim();
  if (!legacySessionName) return null;

  const mappedSlug = getSessionSlugByName(legacySessionName);
  if (mappedSlug == null) return null;
  return normalizeSessionSlug(mappedSlug);
};

const decorateScopedSbtEntry = (entry, fallbackSlug = '') => {
  const next = (entry && typeof entry === 'object') ? { ...entry } : {};
  const sourceSlug = pickNormalizedSessionSlug(
    hasOwn(next, '__sourceSessionSlug') ? next.__sourceSessionSlug : undefined,
    next.slug,
    fallbackSlug
  );
  const sessionBindingSlug = pickOptionalNormalizedSessionSlug(
    hasOwn(next, 'sessionBindingSlug') ? next.sessionBindingSlug : undefined,
    resolveConcreteSbtSessionBindingSlug({
      ...next,
      slug: sourceSlug,
      __sourceSessionSlug: sourceSlug,
    })
  );
  return {
    ...next,
    chainId: resolveSbtEntryChainId(next),
    slug: pickNormalizedSessionSlug(next.slug, fallbackSlug),
    __sourceSessionSlug: sourceSlug,
    ...(sessionBindingSlug != null ? { sessionBindingSlug } : {}),
  };
};

const resolvePropSessionSlug = (props = {}) => {
  const hasExplicitSessionSlug = !!(
    props &&
    Object.prototype.hasOwnProperty.call(props, 'sessionSlug')
  );
  return pickNormalizedSessionSlug(
    hasExplicitSessionSlug ? props.sessionSlug : undefined,
    props?.activeSessionSlug
  );
};

const mergeScopedSbtEntry = (existingEntry, incomingEntry, fallbackSlug = '') => {
  const existing = (existingEntry && typeof existingEntry === 'object')
    ? decorateScopedSbtEntry(existingEntry, fallbackSlug)
    : null;
  const incoming = (incomingEntry && typeof incomingEntry === 'object')
    ? decorateScopedSbtEntry(incomingEntry, fallbackSlug)
    : null;
  const mergedBindingSlug = pickOptionalNormalizedSessionSlug(
    hasOwn(existing, 'sessionBindingSlug') ? existing.sessionBindingSlug : undefined,
    hasOwn(incoming, 'sessionBindingSlug') ? incoming.sessionBindingSlug : undefined
  );
  const finalizeEntry = (entry) => {
    if (!entry) return null;
    return {
      ...entry,
      chainId: resolveSbtEntryChainId(entry),
      slug: pickNormalizedSessionSlug(entry.slug, fallbackSlug),
      __sourceSessionSlug: pickNormalizedSessionSlug(
        hasOwn(entry, '__sourceSessionSlug') ? entry.__sourceSessionSlug : undefined,
        entry.slug,
        fallbackSlug
      ),
      ...(mergedBindingSlug != null ? { sessionBindingSlug: mergedBindingSlug } : {}),
    };
  };
  if (!existing) {
    return incoming ? finalizeEntry(incoming) : null;
  }
  if (!incoming) return finalizeEntry(existing);

  const existingNamed = hasSbtDisplayName(existing?.sbtInfo || null);
  const incomingNamed = hasSbtDisplayName(incoming?.sbtInfo || null);

  if (!existingNamed && incomingNamed) {
    return finalizeEntry({
      ...existing,
      ...incoming,
      slug: pickNormalizedSessionSlug(existing.slug, incoming.slug, fallbackSlug),
    });
  }

  if (!existing?.sbtInfo?.image && incoming?.sbtInfo?.image) {
    return finalizeEntry({
      ...existing,
      ...incoming,
      slug: pickNormalizedSessionSlug(existing.slug, incoming.slug, fallbackSlug),
    });
  }

  return finalizeEntry(existing);
};

const isMaskedSbtOptionLabel = (value) => (
  String(value || '').trim().toLowerCase() === MASKED_SBT_LABEL
);

const isMaskedHiddenTitle = ({ label = '', sbtInfo = null } = {}) => {
  if (!isMaskedSbtOptionLabel(label)) return false;
  if (!sbtInfo || typeof sbtInfo !== 'object') return true;
  const visibleName = (
    String(sbtInfo?.name || '').trim() ||
    String(sbtInfo?.title || '').trim() ||
    String(sbtInfo?.sessionName || '').trim()
  );
  if (visibleName) return false;
  if (sbtInfo?.nameDecrypted === true) return false;
  return isSbtFieldLocked(sbtInfo, 'name');
};

const isUnresolvedSessionConfig = (config) => (
  !!config &&
  typeof config === 'object' &&
  config.__unresolved === true
);

const areSbtOptionsEqual = (left, right) => {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const leftItem = a[i] || {};
    const rightItem = b[i] || {};
    if (
      String(leftItem.address || '') !== String(rightItem.address || '') ||
      String(leftItem.name || '') !== String(rightItem.name || '') ||
      String(leftItem.image || '') !== String(rightItem.image || '') ||
      String(leftItem.sessionSlug || '') !== String(rightItem.sessionSlug || '') ||
      String(leftItem.sessionName || '') !== String(rightItem.sessionName || '') ||
      String(leftItem.chainId ?? '') !== String(rightItem.chainId ?? '') ||
      String(leftItem.selectionKey || '') !== String(rightItem.selectionKey || '')
    ) {
      return false;
    }
  }
  return true;
};


class SBTSelector extends React.Component {
  static _universeMemo = {};
  static _universeInflight = {};
  static _sharedLightUniverseKickoffMemo = {};

  constructor(props) {
    super(props);
    this.state = {
      customSBTAddress: '',
      manualInputWarning: '',
      sbtOptions: [],
      scopeFeaturedAddresses: [],
      showManualInput: false,
      selectedOption: null,
      // Regression guard: the first render happens before componentDidMount can
      // kick off discovery/cache reads, so cold mounts must start as loading.
      loadingOptions: true,
      showGroupPicker: false,
      sourceSessionSlug: resolvePropSessionSlug(props),
      groupOverride: false,
      groupOptions: [],
      discovering: false,
    };
    this._isMounted = false;
    this._selectedSbtHydrationSig = '';
    this._selectedSbtHydrationRetryTimer = null;
    this._lastSbtOptionsRequestSig = '';
    this._inflightSbtOptionsRequestSig = '';
    this._loadSbtOptionsInflight = null;
    this._pendingSbtOptionsReload = false;
    this._pendingSbtOptionsForceReload = false;
    this._sbtOptionsByAddressMemo = { source: null, value: new Map() };
    this._sbtOptionsBySelectionKeyMemo = { source: null, value: new Map() };
    this._discoveringRuns = 0;
    this._progressiveOptionsReloadTimer = null;
    this._progressiveOptionsReloadForce = false;
    this._globalSessionSelectionListener = null;
    this._sessionRegistryCacheListener = null;
    this._pendingSelectedSbtAddresses = new Set();
    this._pendingSelectedSbtKeys = new Set();
  }

  refreshScopedUniverse = ({ forceDiscover = false } = {}) => {
    const discoveryPromise = this.ensureSbtUniverse({ force: forceDiscover });
    this.loadSBTOptions({ force: true });
    Promise.resolve(discoveryPromise).then(() => {
      if (this._isMounted) this.loadSBTOptions({ force: true });
    });
    return discoveryPromise;
  };

  componentDidMount() {
    this._isMounted = true;
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._globalSessionSelectionListener = () => {
        if (!this._isMounted) return;
        // Regression guard: selectors can mount before list-scope hydration finishes,
        // so re-read the global session selection when it updates.
        this.refreshScopedUniverse({ forceDiscover: true });
      };
      window.addEventListener(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, this._globalSessionSelectionListener);
      this._sessionRegistryCacheListener = () => {
        if (!this._isMounted) return;
        // Live session registry updates can change factory addresses and block windows.
        this.refreshScopedUniverse({ forceDiscover: true });
      };
      window.addEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, this._sessionRegistryCacheListener);
    }
    this.refreshGroupOptions();
    this.refreshScopedUniverse({ forceDiscover: false });
    this.hydrateSelectedSbtNames();
    if (this.shouldWarmRegistryCacheForTargets()) {
      const chainId = this.getSessionNetworkId(this.getEffectiveSessionSlug());
      loadSessionRegistryCache({ chainIds: chainId ? [chainId] : undefined, force: true }).then(() => {
        if (this._isMounted) this.refreshScopedUniverse({ forceDiscover: true });
      });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function' && this._globalSessionSelectionListener) {
      window.removeEventListener(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, this._globalSessionSelectionListener);
      this._globalSessionSelectionListener = null;
    }
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function' && this._sessionRegistryCacheListener) {
      window.removeEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, this._sessionRegistryCacheListener);
      this._sessionRegistryCacheListener = null;
    }
    if (this._selectedSbtHydrationRetryTimer) {
      clearTimeout(this._selectedSbtHydrationRetryTimer);
      this._selectedSbtHydrationRetryTimer = null;
    }
    this.clearProgressiveOptionsReload();
    this._sbtOptionsByAddressMemo = { source: null, value: new Map() };
  }

  componentDidUpdate(prevProps, prevState) {
    const prevNetworkId = getNormalizedNetworkChainValue(prevProps.network);
    const nextNetworkId = getNormalizedNetworkChainValue(this.props.network);
    const networkChanged = prevNetworkId !== nextNetworkId;
    const chainIdChanged = normalizeChainValue(prevProps.chainId) !== normalizeChainValue(this.props.chainId);
    const sessionConfigChanged = buildSessionConfigSig(prevProps.sessionConfig) !== buildSessionConfigSig(this.props.sessionConfig);
    const cacheChanged = prevProps.sbtCacheRevision !== this.props.sbtCacheRevision;
    const slugPropChanged = this.getPropSessionSlug(prevProps) !== this.getPropSessionSlug(this.props);
    const sourceGroupChanged = prevState.sourceSessionSlug !== this.state.sourceSessionSlug;
    const selectedSbtPropsChanged = prevProps.selectedSBTs !== this.props.selectedSBTs;
    const discoveryOverrideChanged = this.getDiscoveryOverrideSignature(prevProps) !== this.getDiscoveryOverrideSignature(this.props);
    const sharedLightUniverseFnChanged = prevProps.ensureLightSbtUniverse !== this.props.ensureLightSbtUniverse;

    if (slugPropChanged && !this.state.groupOverride) {
      const nextSlug = this.getPropSessionSlug(this.props);
      if (nextSlug !== this.state.sourceSessionSlug) {
        this.setState({ sourceSessionSlug: nextSlug });
        return;
      }
    }

    if (networkChanged || chainIdChanged || sessionConfigChanged || cacheChanged || slugPropChanged || sourceGroupChanged || discoveryOverrideChanged) {
      this.loadSBTOptions();
    }

    if (networkChanged || chainIdChanged || sessionConfigChanged || slugPropChanged || sourceGroupChanged || discoveryOverrideChanged) {
      this.ensureSbtUniverse({ force: sourceGroupChanged || slugPropChanged || sessionConfigChanged || discoveryOverrideChanged });
    }
    if (sharedLightUniverseFnChanged && typeof this.props.ensureLightSbtUniverse === 'function') {
      this.kickoffSharedLightUniverseIfNeeded();
    }
    if (networkChanged || chainIdChanged || sessionConfigChanged || cacheChanged || slugPropChanged || sourceGroupChanged || discoveryOverrideChanged || selectedSbtPropsChanged) {
      this.hydrateSelectedSbtNames();
    }
    if (
      (networkChanged || chainIdChanged || sessionConfigChanged || slugPropChanged || sourceGroupChanged || discoveryOverrideChanged) &&
      this.shouldWarmRegistryCacheForTargets()
    ) {
      const chainId = this.getSessionNetworkId(this.getEffectiveSessionSlug());
      loadSessionRegistryCache({ chainIds: chainId ? [chainId] : undefined, force: true }).then(() => {
        if (this._isMounted) this.refreshScopedUniverse({ forceDiscover: true });
      });
    }
  }

  getEffectiveSessionSlug = () => {
    if (this.state.groupOverride) {
      return this.state.sourceSessionSlug ?? '';
    }
    return this.getPropSessionSlug(this.props);
  };

  getPropSessionSlug = (props = this.props) => resolvePropSessionSlug(props);

  normalizeDiscoverySlugs = (slugs, { allowEmpty = true } = {}) => {
    const values = Array.isArray(slugs) ? slugs : [slugs];
    const seen = new Set();
    const out = [];
    values.forEach((value) => {
      const normalized = normalizeSessionSlug(value || '');
      if (!allowEmpty && !normalized) return;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      out.push(normalized);
    });
    return out;
  };

  buildSlugListSignature = (slugs) => buildSessionSlugSignature(
    this.normalizeDiscoverySlugs(slugs, { allowEmpty: true })
  );

  getNormalizedDiscoveryOverride = (props = this.props) => {
    if (!Array.isArray(props?.discoverySessionSlugs) || props.discoverySessionSlugs.length === 0) {
      return [];
    }
    return this.normalizeDiscoverySlugs(props.discoverySessionSlugs, { allowEmpty: true });
  };

  getDiscoveryOverrideSignature = (props = this.props) => (
    this.buildSlugListSignature(this.getNormalizedDiscoveryOverride(props))
  );

  getResolvedScopeMode = () => {
    if (this.state.groupOverride) return 'override';
    if (this.getNormalizedDiscoveryOverride().length > 0) return 'explicit';
    return readSessionScanScope();
  };

  getDirectlyInvokedTargetSlugs = () => {
    const explicitOverride = this.getNormalizedDiscoveryOverride();
    if (explicitOverride.length > 0) return explicitOverride;

    const effectiveSlug = normalizeSessionSlug(this.getPropSessionSlug(this.props));
    const scopeMode = readSessionScanScope();
    if (scopeMode === 'general') return [''];
    if (scopeMode === 'list') {
      return this.normalizeDiscoverySlugs(readSessionScanSlugs(), { allowEmpty: true });
    }
    if (scopeMode === 'all') {
      return this.normalizeDiscoverySlugs(getAllSessionSlugs({ includeEmpty: true }), { allowEmpty: true });
    }
    return this.normalizeDiscoverySlugs([effectiveSlug], { allowEmpty: true });
  };

  getResolvedTargetSlugs = ({ slugOverride } = {}) => {
    if (slugOverride !== undefined) {
      return this.normalizeDiscoverySlugs([slugOverride], { allowEmpty: true });
    }
    if (this.state.groupOverride) {
      return this.normalizeDiscoverySlugs([this.state.sourceSessionSlug], { allowEmpty: true });
    }
    return this.getDirectlyInvokedTargetSlugs();
  };

  shouldWarmRegistryCacheForTargets = ({ slugOverride } = {}) => {
    const targetSlugs = this.getResolvedTargetSlugs({ slugOverride });
    if (!targetSlugs.length) return true;
    return targetSlugs.some((targetSlug) => !this.shouldUsePropsSessionConfigForSlug(targetSlug));
  };

  shouldUsePropsSessionConfigForSlug = (slugIn) => {
    const sessionConfig = this.props.sessionConfig;
    if (!sessionConfig || typeof sessionConfig !== 'object') return false;
    const requestedSlug = normalizeSessionSlug(
      slugIn !== undefined ? slugIn : this.getEffectiveSessionSlug()
    );
    const propsSlug = pickNormalizedSessionSlug(sessionConfig?.slug, this.getEffectiveSessionSlug());
    const effectiveSlug = normalizeSessionSlug(this.getEffectiveSessionSlug());
    return requestedSlug === propsSlug || requestedSlug === effectiveSlug;
  };

  // Selector discovery/name hydration is display-only, so demo fallback stays local here.
  getDisplayLookupSessionConfig = (slugIn) => {
    const slug = slugIn !== undefined ? slugIn : this.getEffectiveSessionSlug();
    const strictLookupConfig = getSessionConfigBySlugOrDefault(slug);
    if (strictLookupConfig && !isUnresolvedSessionConfig(strictLookupConfig)) {
      return strictLookupConfig;
    }
    if (!ALLOW_DEMO_SESSION_FALLBACK) {
      return strictLookupConfig || null;
    }
    const demoLookupConfig = getDemoSessionConfigBySlug(slug, { allowDemoFallback: true });
    return (
      demoLookupConfig
      || strictLookupConfig
      || null
    );
  };

  getSessionNetworkId = (slug) => {
    const sessionConfig = this.shouldUsePropsSessionConfigForSlug(slug) && this.props.sessionConfig && typeof this.props.sessionConfig === 'object'
      ? this.props.sessionConfig
      : null;
    const sessionConfigChainId = normalizeChainValue(sessionConfig?.networkChainId);
    if (sessionConfigChainId) return sessionConfigChainId;
    const registryChainId = normalizeChainValue(getSessionChainId(slug));
    if (registryChainId) return registryChainId;
    const displayLookupCfg = this.getDisplayLookupSessionConfig(slug);
    const displayLookupChainId = normalizeChainValue(
      displayLookupCfg?.networkChainId ||
      displayLookupCfg?.__registry?.chainId ||
      displayLookupCfg?.contracts?.sbtFactory?.chainId ||
      displayLookupCfg?.contracts?.surveys?.chainId ||
      0
    );
    if (displayLookupChainId) return displayLookupChainId;
    const directOverride = normalizeChainValue(this.props.chainId);
    if (directOverride) return directOverride;
    const walletChainId = getNormalizedNetworkChainValue(this.props.network);
    if (walletChainId) return walletChainId;
    return DEFAULT_FALLBACK_CHAIN_ID;
  };

  getMetadataLookupConfig = (slugIn) => {
    const slug = slugIn !== undefined ? slugIn : this.getEffectiveSessionSlug();
    const baseCfg = this.getDisplayLookupSessionConfig(slug) || {};
    const propsCfg = this.shouldUsePropsSessionConfigForSlug(slug) && this.props.sessionConfig && typeof this.props.sessionConfig === 'object'
      ? this.props.sessionConfig
      : {};
    const mergedContracts = {
      ...(baseCfg?.contracts && typeof baseCfg.contracts === 'object' ? baseCfg.contracts : {}),
      ...(propsCfg?.contracts && typeof propsCfg.contracts === 'object' ? propsCfg.contracts : {}),
    };
    const chainId = Number(this.getSessionNetworkId(slug) || baseCfg?.networkChainId || 0) || null;
    const next = {
      ...(baseCfg && typeof baseCfg === 'object' ? baseCfg : {}),
      ...(propsCfg && typeof propsCfg === 'object' ? propsCfg : {}),
      slug: slug ?? '',
      contracts: mergedContracts,
    };
    if (chainId) {
      next.networkChainId = chainId;
      if (!next.__registry || typeof next.__registry !== 'object') {
        next.__registry = { chainId };
      } else if (!Number(next.__registry.chainId || 0)) {
        next.__registry = { ...next.__registry, chainId };
      }
    }
    return next;
  };

  getDiscoverySessionRef = (slugIn) => {
    const slug = slugIn !== undefined ? slugIn : this.getEffectiveSessionSlug();
    const metadataLookupCfg = this.getMetadataLookupConfig(slug);
    return {
      ...(metadataLookupCfg && typeof metadataLookupCfg === 'object' ? metadataLookupCfg : {}),
      slug: slug ?? '',
    };
  };

  getSessionLabel = (slug) => {
    const cfg = this.getDisplayLookupSessionConfig(slug);
    const sessionName = cfg?.sessionName || '';
    if (!slug) return sessionName || 'General';
    if (sessionName && sessionName !== slug) return `${sessionName} (${slug})`;
    return sessionName || slug;
  };

  readSbtCacheBySlug = async (slug) => {
    const parsed = await readCache('sbtCache', slug);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  };

  beginDiscovering = () => {
    this._discoveringRuns += 1;
    if (this._isMounted && this._discoveringRuns === 1) {
      this.setState({ discovering: true });
    }
  };

  endDiscovering = () => {
    this._discoveringRuns = Math.max(0, this._discoveringRuns - 1);
    if (this._isMounted && this._discoveringRuns === 0) {
      this.setState({ discovering: false });
    }
  };

  scheduleSelectedSbtHydrationRetry = () => {
    if (!this._isMounted) return;
    if (this._selectedSbtHydrationRetryTimer) return;
    this._selectedSbtHydrationRetryTimer = setTimeout(() => {
      this._selectedSbtHydrationRetryTimer = null;
      if (!this._isMounted) return;
      this.hydrateSelectedSbtNames({ force: true });
    }, SELECTED_SBT_HYDRATION_RETRY_MS);
  };

  clearSelectedSbtHydrationRetry = () => {
    if (!this._selectedSbtHydrationRetryTimer) return;
    clearTimeout(this._selectedSbtHydrationRetryTimer);
    this._selectedSbtHydrationRetryTimer = null;
  };

  scheduleProgressiveOptionsReload = ({ force = false } = {}) => {
    this._progressiveOptionsReloadForce = this._progressiveOptionsReloadForce || force;
    if (this._progressiveOptionsReloadTimer) return;
    this._progressiveOptionsReloadTimer = setTimeout(() => {
      this._progressiveOptionsReloadTimer = null;
      const forceReload = this._progressiveOptionsReloadForce;
      this._progressiveOptionsReloadForce = false;
      if (!this._isMounted) return;
      void this.loadSBTOptions({ force: forceReload });
    }, 0);
  };

  clearProgressiveOptionsReload = () => {
    if (this._progressiveOptionsReloadTimer) {
      clearTimeout(this._progressiveOptionsReloadTimer);
      this._progressiveOptionsReloadTimer = null;
    }
    this._progressiveOptionsReloadForce = false;
  };

  hydrateSelectedSbtNames = async ({ force = false } = {}) => {
    const selected = Array.isArray(this.props.selectedSBTs) ? this.props.selectedSBTs : [];
    const addresses = Array.from(new Set(
      selected
        .map((entry) => String(entry?.address || '').trim())
        .filter((value) => ethers.utils.isAddress(value))
        .map((value) => ethers.utils.getAddress(value))
    ));
    const slug = this.getEffectiveSessionSlug();
    const networkID = this.getSessionNetworkId(slug);
    const metadataLookupCfg = this.getMetadataLookupConfig(slug);
    const sig = `${slug}|${Number(networkID || 0)}|${addresses.join(',')}`;
    if (!addresses.length) {
      this.clearSelectedSbtHydrationRetry();
      this._selectedSbtHydrationSig = sig;
      return;
    }
    if (!force && sig === this._selectedSbtHydrationSig) return;
    this._selectedSbtHydrationSig = sig;

    try {
      const hits = await warmSbtDisplayNamesTargeted({
        addresses,
        preferredSlug: slug,
        metadataLookupConfig: metadataLookupCfg,
        chainId: networkID,
        writeBack: true,
      });
      const targetedLookupEnabled = isTargetedSbtMetadataLookupEnabled();
      if (!this._isMounted) return;
      const resolvedAddresses = new Set(
        (Array.isArray(hits) ? hits : [])
          .map((entry) => String(entry?.address || '').trim().toLowerCase())
          .filter(Boolean)
      );
      const hasUnresolvedAddresses = addresses.some(
        (address) => !resolvedAddresses.has(String(address || '').trim().toLowerCase())
      );
      if (!Array.isArray(hits) || !hits.length) {
        if (!targetedLookupEnabled) {
          this.clearSelectedSbtHydrationRetry();
          return;
        }
        this._selectedSbtHydrationSig = '';
        this.scheduleSelectedSbtHydrationRetry();
        return;
      }
      if (hasUnresolvedAddresses) {
        if (targetedLookupEnabled) {
          this._selectedSbtHydrationSig = '';
          this.scheduleSelectedSbtHydrationRetry();
        } else {
          this.clearSelectedSbtHydrationRetry();
        }
      } else {
        this.clearSelectedSbtHydrationRetry();
      }
      this.loadSBTOptions({ force: true });
    } catch (_) {
      if (!isTargetedSbtMetadataLookupEnabled()) {
        this.clearSelectedSbtHydrationRetry();
        return;
      }
      this._selectedSbtHydrationSig = '';
      this.scheduleSelectedSbtHydrationRetry();
    }
  };

  normalizeSbtCacheForNet = (cacheIn, netKey) => {
    const cacheObj = (cacheIn && typeof cacheIn === 'object') ? { ...cacheIn } : {};
    if (!cacheObj[netKey] || typeof cacheObj[netKey] !== 'object') {
      cacheObj[netKey] = { sbtList: {} };
    }
    if (!cacheObj[netKey].sbtList || typeof cacheObj[netKey].sbtList !== 'object') {
      cacheObj[netKey].sbtList = {};
    }
    return cacheObj;
  };

  getTargetSlugChainSignature = (targetSlugs = []) => (
    this.normalizeDiscoverySlugs(targetSlugs, { allowEmpty: true })
      .map((targetSlug) => `${targetSlug}:${Number(this.getSessionNetworkId(targetSlug) || 0)}`)
      .join('|')
  );

  getIgnoredAddressSet = ({ effectiveSlug, scopeMode, targetSlugs = [] } = {}) => {
    const resolvedEffectiveSlug = normalizeSessionSlug(effectiveSlug || '');
    const slugsToRead = this.normalizeDiscoverySlugs(
      Array.isArray(targetSlugs) && targetSlugs.length > 0
        ? targetSlugs
        : [((scopeMode === 'general' && resolvedEffectiveSlug !== '') ? '' : resolvedEffectiveSlug)],
      { allowEmpty: true }
    );
    const ignored = new Set();
    slugsToRead.forEach((targetSlug) => {
      const listSlug = (scopeMode === 'general' && targetSlug !== '') ? '' : targetSlug;
      const { ignored_SBTs_LIST = [] } = getSessionLists(listSlug);
      (Array.isArray(ignored_SBTs_LIST) ? ignored_SBTs_LIST : []).forEach((address) => {
        const scopedKey = buildScopedSbtIgnoreKey({ slug: targetSlug, address });
        if (scopedKey) ignored.add(scopedKey);
      });
    });
    return ignored;
  };

  getScopeFeaturedEntries = ({ targetSlugs = [], effectiveSlug = '' } = {}) => {
    const resolvedEffectiveSlug = normalizeSessionSlug(effectiveSlug || '');
    const seen = new Set();
    const out = [];
    const addEntries = (addresses = [], slug = resolvedEffectiveSlug) => {
      (Array.isArray(addresses) ? addresses : []).forEach((address) => {
        const rawAddress = String(address || '').trim();
        if (!rawAddress) return;
        const lower = rawAddress.toLowerCase();
        if (seen.has(lower)) return;
        seen.add(lower);
        out.push({
          address: rawAddress,
          slug: normalizeSessionSlug(slug || ''),
        });
      });
    };

    addEntries(this.props.defaultFeaturedSBTs || [], resolvedEffectiveSlug);
    this.normalizeDiscoverySlugs(targetSlugs, { allowEmpty: true }).forEach((targetSlug) => {
      const displayLookupCfg = this.getDisplayLookupSessionConfig(targetSlug);
      const propsFeatured = this.shouldUsePropsSessionConfigForSlug(targetSlug)
        ? getCanonicalSessionFeaturedSBTs(this.props.sessionConfig)
        : [];
      const configFeatured = targetSlug !== resolvedEffectiveSlug
        ? getCanonicalSessionFeaturedSBTs(displayLookupCfg)
        : [];
      const { featured_SBTs_LIST = [] } = getSessionLists(targetSlug);
      addEntries(propsFeatured, targetSlug);
      addEntries(configFeatured, targetSlug);
      addEntries(featured_SBTs_LIST, targetSlug);
    });
    return out;
  };

  readScopedCacheContexts = async (targetSlugs = []) => {
    const contexts = [];
    const contextBySlug = new Map();
    const orderedTargetSlugs = this.normalizeDiscoverySlugs(targetSlugs, { allowEmpty: true });
    for (const targetSlug of orderedTargetSlugs) {
      const chainId = Number(this.getSessionNetworkId(targetSlug) || 0) || null;
      if (!chainId) continue;
      const netKey = String(chainId);
      const cache = this.normalizeSbtCacheForNet(
        await this.readSbtCacheBySlug(targetSlug),
        netKey
      );
      const sbtList = { ...(cache[netKey]?.sbtList || {}) };
      const nameLookupState = ensureNameLookupState(cache, netKey);
      cache[netKey].sbtList = sbtList;
      cache[netKey].nameLookupState = nameLookupState;
      const context = {
        slug: targetSlug,
        chainId,
        netKey,
        cache,
        sbtList,
        nameLookupState,
      };
      contexts.push(context);
      contextBySlug.set(targetSlug, context);
    }
    return { contexts, contextBySlug };
  };

  buildAggregatedSbtListFromContexts = (contexts = []) => {
    const out = {};
    (Array.isArray(contexts) ? contexts : []).forEach((context) => {
      const fallbackSlug = normalizeSessionSlug(context?.slug || '');
      Object.entries(context?.sbtList || {}).forEach(([address, entry]) => {
        const decoratedEntry = decorateScopedSbtEntry({
          ...(entry && typeof entry === 'object' ? entry : {}),
          sbtAddress: entry?.sbtAddress || address,
          chainId: resolveSbtEntryChainId(entry, context?.chainId),
        }, fallbackSlug);
        const lookupKey = buildSbtLookupKey({
          address: decoratedEntry?.sbtAddress || address,
          chainId: decoratedEntry?.chainId || context?.chainId,
        });
        if (!lookupKey) return;
        out[lookupKey] = mergeScopedSbtEntry(
          out[lookupKey],
          decoratedEntry,
          fallbackSlug
        );
      });
    });
    return out;
  };

  buildLinkedScopedSbtListFromKnownCache = ({ targetSlugs = [], fallbackSlug = '', requireConcreteBinding = false } = {}) => {
    const targetSlugSet = new Set(
      this.normalizeDiscoverySlugs(targetSlugs, { allowEmpty: true })
    );
    if (targetSlugSet.size === 0) return {};

    const out = {};
    const knownEntries = listNamespaceEntriesSync('sbtCache', { cloneValues: false });
    (Array.isArray(knownEntries) ? knownEntries : []).forEach(({ slug: cacheSlug, value }) => {
      const sourceSlug = normalizeSessionSlug(cacheSlug || '');
      const cacheValue = (value && typeof value === 'object') ? value : null;
      if (!cacheValue) return;

      Object.entries(cacheValue).forEach(([netKey, netNode]) => {
        const sbtList = (netNode && typeof netNode === 'object' && netNode.sbtList && typeof netNode.sbtList === 'object')
          ? netNode.sbtList
          : null;
        if (!sbtList) return;
        const cachedChainId = normalizeChainValue(netKey);

        Object.entries(sbtList).forEach(([cacheAddress, entry]) => {
          const scopedEntry = decorateScopedSbtEntry({
            ...(entry && typeof entry === 'object' ? entry : {}),
            sbtAddress: entry?.sbtAddress || cacheAddress,
            chainId: resolveSbtEntryChainId(entry, cachedChainId),
            __sourceSessionSlug: sourceSlug,
            slug: pickNormalizedSessionSlug(entry?.slug, sourceSlug),
          }, sourceSlug);
          const entryAddress = String(scopedEntry?.sbtAddress || '').trim().toLowerCase();
          if (!entryAddress) return;

          const resolvedSourceSlug = pickNormalizedSessionSlug(
            scopedEntry.__sourceSessionSlug,
            sourceSlug
          );
          const concreteBindingSlug = resolveAuthoritativeSbtSessionBindingSlug(scopedEntry);
          const bindingSlug = hasOwn(scopedEntry, 'sessionBindingSlug')
            ? scopedEntry.sessionBindingSlug
            : null;
          const sourceInScope = targetSlugSet.has(resolvedSourceSlug);
          const bindingInScope = bindingSlug != null && targetSlugSet.has(bindingSlug);
          const concreteBindingInScope = concreteBindingSlug != null && targetSlugSet.has(concreteBindingSlug);
          if (requireConcreteBinding) {
            if (!sourceInScope && !concreteBindingInScope) return;
          } else if (!sourceInScope && !bindingInScope) {
            return;
          }

          const entryForScope = (requireConcreteBinding && concreteBindingInScope)
            ? { ...scopedEntry, slug: concreteBindingSlug, sessionBindingSlug: concreteBindingSlug }
            : bindingInScope
              ? { ...scopedEntry, slug: bindingSlug }
            : scopedEntry;
          const lookupKey = buildSbtLookupKey({
            address: entryAddress,
            chainId: resolveSbtEntryChainId(entryForScope, cachedChainId),
          });
          if (!lookupKey) return;
          out[lookupKey] = mergeScopedSbtEntry(out[lookupKey], entryForScope, fallbackSlug);
        });
      });
    });
    return out;
  };

  writeCacheContext = async (context) => {
    if (!context || !context.netKey) return;
    context.cache[context.netKey].sbtList = context.sbtList;
    context.cache[context.netKey].nameLookupState = context.nameLookupState;
    await writeCache('sbtCache', context.slug, context.cache);
  };

  buildSbtOptions = ({
    sbtList = {},
    featuredEntries = [],
    ignoredSet = new Set(),
    fallbackSlug = '',
    scopeMode = 'active',
    targetSlugs = [],
  } = {}) => {
    const featuredOrder = new Map();
    const listScopeTargetSlugSet = scopeMode === 'list'
      ? new Set(this.normalizeDiscoverySlugs(
        Array.isArray(targetSlugs) && targetSlugs.length > 0 ? targetSlugs : [fallbackSlug],
        { allowEmpty: true }
      ))
      : null;
    (Array.isArray(featuredEntries) ? featuredEntries : []).forEach((entry, index) => {
      const lower = String(entry?.address || '').trim().toLowerCase();
      if (!lower || featuredOrder.has(lower)) return;
      featuredOrder.set(lower, index);
    });

    const sbtOptionsMap = new Map();
    Object.values(sbtList || {}).forEach((sbt) => {
      if (!sbt) return;
      const sbtInfo = sbt.sbtInfo;
      const sbtAddressOrNull = sbt.sbtAddress;
      if (!sbtAddressOrNull) {
        sbtLog.warn('SBT without address:', sbt);
        return;
      }
      const address = String(sbtAddressOrNull).toLowerCase();
      const chainId = resolveSbtEntryChainId(sbt);
      const resolvedSlug = pickNormalizedSessionSlug(
        hasOwn(sbt, 'sessionBindingSlug') ? sbt.sessionBindingSlug : undefined,
        sbt.slug,
        fallbackSlug
      );
      const selectionKey = buildSbtLookupKey({ address, chainId });
      const isManual = Boolean(sbt.manual);
      if (ignoredSet.has(buildScopedSbtIgnoreKey({ slug: resolvedSlug, address }))) return;
      if (sbtInfo?.unlisted && !isManual) return;
      if (sbtOptionsMap.has(selectionKey || address)) return;
      if (listScopeTargetSlugSet) {
        const declaredSessionSlug = resolveDeclaredSbtSessionSlug(sbt);
        const scopedBucketSlug = resolvedSlug;
        const hasVisibleMetadata = hasSbtDisplayName(sbtInfo);
        if (declaredSessionSlug != null) {
          if (!listScopeTargetSlugSet.has(declaredSessionSlug)) return;
        } else if (hasVisibleMetadata || !listScopeTargetSlugSet.has(scopedBucketSlug)) {
          return;
        }
      }
      const resolvedName = this.resolveSbtLabel(sbtInfo, address, resolvedSlug);
      sbtOptionsMap.set(selectionKey || address, {
        address,
        selectionKey: selectionKey || address,
        name: resolvedName,
        image: sbtInfo?.image || null,
        sessionSlug: resolvedSlug,
        sessionName: sbtInfo?.sessionName || sbt?.sessionName || null,
        chainId: chainId || null,
        ...(hasOwn(sbt, 'sessionBindingSlug') ? { sessionBindingSlug: sbt.sessionBindingSlug } : {}),
        maskedTitleHidden: isMaskedHiddenTitle({
          label: resolvedName,
          sbtInfo,
        }),
      });
    });

    return Array.from(sbtOptionsMap.values()).sort((left, right) => {
      const leftMasked = left?.maskedTitleHidden === true;
      const rightMasked = right?.maskedTitleHidden === true;
      if (leftMasked !== rightMasked) return leftMasked ? 1 : -1;

      const leftFeaturedRank = featuredOrder.has(left.address) ? featuredOrder.get(left.address) : Number.MAX_SAFE_INTEGER;
      const rightFeaturedRank = featuredOrder.has(right.address) ? featuredOrder.get(right.address) : Number.MAX_SAFE_INTEGER;
      if (leftFeaturedRank !== rightFeaturedRank) return leftFeaturedRank - rightFeaturedRank;

      const leftLabel = String(left.name || left.address || '').toLowerCase();
      const rightLabel = String(right.name || right.address || '').toLowerCase();
      const labelCompare = leftLabel.localeCompare(rightLabel);
      if (labelCompare !== 0) return labelCompare;
      const addressCompare = String(left.address || '').localeCompare(String(right.address || ''));
      if (addressCompare !== 0) return addressCompare;
      return Number(left.chainId || 0) - Number(right.chainId || 0);
    });
  };

  applySbtOptions = ({
    sbtList = {},
    featuredEntries = [],
    ignoredSet = new Set(),
    fallbackSlug = '',
    loadingOptions,
    scopeMode = 'active',
    targetSlugs = [],
  } = {}) => {
    const sbtOptions = this.buildSbtOptions({
      sbtList,
      featuredEntries,
      ignoredSet,
      fallbackSlug,
      scopeMode,
      targetSlugs,
    });
    if (!this._isMounted) return sbtOptions;
    const nextPatch = {};
    const optionsChanged = !areSbtOptionsEqual(this.state.sbtOptions, sbtOptions);
    if (optionsChanged) nextPatch.sbtOptions = sbtOptions;
    const scopeFeaturedAddresses = (Array.isArray(featuredEntries) ? featuredEntries : [])
      .map((entry) => String(entry?.address || '').trim().toLowerCase())
      .filter(Boolean);
    const prevFeatured = Array.isArray(this.state.scopeFeaturedAddresses)
      ? this.state.scopeFeaturedAddresses
      : [];
    const featuredChanged = (
      scopeFeaturedAddresses.length !== prevFeatured.length ||
      scopeFeaturedAddresses.some((address, index) => address !== prevFeatured[index])
    );
    if (featuredChanged) nextPatch.scopeFeaturedAddresses = scopeFeaturedAddresses;
    if (typeof loadingOptions === 'boolean' && this.state.loadingOptions !== loadingOptions) {
      nextPatch.loadingOptions = loadingOptions;
    }
    if (Object.keys(nextPatch).length > 0) {
      this.setState(nextPatch);
    }
    return sbtOptions;
  };

  hydrateScopedEntries = async ({
    entries = [],
    contextBySlug,
    aggregatedSbtList,
    fallbackSlug = '',
    onProgress,
  } = {}) => {
    const lookupEntries = Array.isArray(entries) ? entries : [];
    if (!lookupEntries.length) return;
    const orderedContexts = Array.from((contextBySlug instanceof Map ? contextBySlug : new Map()).values());
    const fallbackContext = orderedContexts[0] || null;
    if (!fallbackContext) return;

    const BATCH = 4;
    for (let i = 0; i < lookupEntries.length; i += BATCH) {
      const batch = lookupEntries.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (entry) => {
        const rawAddress = String(entry?.address || '').trim();
        if (!rawAddress || !ethers.utils.isAddress(rawAddress)) return null;
        const lower = rawAddress.toLowerCase();
        const targetSlug = pickNormalizedSessionSlug(entry?.slug, fallbackSlug);
        const context = (contextBySlug instanceof Map ? contextBySlug.get(targetSlug) : null) || fallbackContext;
        if (!context) return null;
        const aggregatedKey = buildSbtLookupKey({ address: rawAddress, chainId: context.chainId });
        const existingInfo = aggregatedSbtList?.[aggregatedKey]?.sbtInfo || context.sbtList?.[lower]?.sbtInfo || null;
        if (hasSbtDisplayName(existingInfo)) {
          clearNameLookupFailure(context.nameLookupState, lower);
          return null;
        }
        if (!canRetryNameLookup(context.nameLookupState, lower, Date.now())) {
          return null;
        }

        try {
          const lookup = await hydrateSbtDisplayNameTargeted({
            address: rawAddress,
            preferredSlug: targetSlug,
            metadataLookupConfig: this.getMetadataLookupConfig(targetSlug),
            chainId: context.chainId,
            writeBack: true,
          });
          return {
            address: rawAddress,
            lower,
            slug: targetSlug,
            context,
            sbtInfo: lookup?.info || null,
          };
        } catch (_) {
          return {
            address: rawAddress,
            lower,
            slug: targetSlug,
            context,
            sbtInfo: null,
          };
        }
      }));

      const touchedContexts = new Set();
      const batchNow = Date.now();
      results.forEach((result) => {
        if (!result) return;
        const { address, lower, slug, context, sbtInfo } = result;
        const aggregatedKey = buildSbtLookupKey({ address, chainId: context.chainId });
        const existingScoped = context.sbtList?.[lower] || {};
        const resolvedInfo = sbtInfo || existingScoped.sbtInfo || aggregatedSbtList?.[aggregatedKey]?.sbtInfo || null;
        context.sbtList[lower] = {
          ...existingScoped,
          sbtAddress: address,
          chainId: resolveSbtEntryChainId(existingScoped, context.chainId),
          sbtInfo: resolvedInfo,
          slug: pickNormalizedSessionSlug(slug, context.slug),
        };
        if (hasSbtDisplayName(resolvedInfo)) {
          clearNameLookupFailure(context.nameLookupState, lower);
        } else {
          markNameLookupFailure(context.nameLookupState, lower, batchNow);
        }
        aggregatedSbtList[aggregatedKey] = mergeScopedSbtEntry(
          aggregatedSbtList[aggregatedKey],
          context.sbtList[lower],
          context.slug
        );
        touchedContexts.add(context);
      });

      if (touchedContexts.size > 0) {
        await Promise.all(Array.from(touchedContexts).map((context) => this.writeCacheContext(context)));
        if (typeof onProgress === 'function') {
          onProgress({
            completedCount: Math.min(lookupEntries.length, i + batch.length),
            totalCount: lookupEntries.length,
            batchSize: batch.length,
          });
        }
      }
    }
  };

  refreshGroupOptions = () => {
    const slugs = getAllSessionSlugs();
    const opts = slugs.map((slug) => ({
      value: slug,
      label: this.getSessionLabel(slug),
    }));
    this.setState({ groupOptions: opts });
  };

  shouldAutoDiscover = () => this.props.autoDiscover !== false;

  getSelectorLogContext = (extra = {}) => ({
    selectorId: String(this.props.id || this.props.label || '').trim() || 'unnamed-selector',
    effectiveSessionSlug: normalizeSessionSlug(this.getEffectiveSessionSlug()),
    ...extra,
  });

  buildSharedLightUniverseKickoffSignature = (slugs = []) => {
    const normalized = this.normalizeDiscoverySlugs(slugs, { allowEmpty: true })
      .slice()
      .sort((left, right) => String(left || '').localeCompare(String(right || '')));
    return `${normalized.length}:${normalized.join(',')}`;
  };

  getSharedLightUniverseKickoffSlugs = ({ slugOverride } = {}) => (
    this.getResolvedTargetSlugs({ slugOverride })
  );

  kickoffSharedLightUniverseIfNeeded = ({ slugOverride } = {}) => {
    if (!this.shouldAutoDiscover()) {
      if (sbtLog.isEnabled('debug') || isForcedSbtSelectorDebugEnabled()) {
        emitSbtSelectorDebug('debug', '[SBTSelector] shared light-universe kickoff skipped (autoDiscover disabled)', this.getSelectorLogContext());
      }
      return null;
    }
    if (typeof window === 'undefined') return null;
    const ensureLightSbtUniverse = this.props.ensureLightSbtUniverse;
    if (typeof ensureLightSbtUniverse !== 'function') {
      if (sbtLog.isEnabled('debug') || isForcedSbtSelectorDebugEnabled()) {
        emitSbtSelectorDebug('debug', '[SBTSelector] shared light-universe kickoff unavailable', this.getSelectorLogContext());
      }
      return null;
    }

    const targetSlugs = this.getResolvedTargetSlugs({ slugOverride });
    const kickoffSlugs = this.getSharedLightUniverseKickoffSlugs({ slugOverride });
    if (!kickoffSlugs.length) return null;

    const kickoffSig = this.buildSharedLightUniverseKickoffSignature(kickoffSlugs);
    const kickoffContext = this.getSelectorLogContext({
      scopeMode: this.getResolvedScopeMode(),
      slugOverride: normalizeSessionSlug(slugOverride ?? ''),
      targetSlugs,
      kickoffSlugs,
      kickoffSig,
    });
    const now = Date.now();
    const lastKickoffAt = Number(SBTSelector._sharedLightUniverseKickoffMemo[kickoffSig] || 0);
    if (lastKickoffAt > 0 && (now - lastKickoffAt) < SHARED_LIGHT_UNIVERSE_KICKOFF_TTL_MS) {
      if (sbtLog.isEnabled('debug') || isForcedSbtSelectorDebugEnabled()) {
        emitSbtSelectorDebug('debug', '[SBTSelector] shared light-universe kickoff skipped (memo hit)', {
          ...kickoffContext,
          lastKickoffAt,
          ageMs: now - lastKickoffAt,
        });
      }
      return null;
    }
    SBTSelector._sharedLightUniverseKickoffMemo[kickoffSig] = now;
    emitSbtSelectorDebug('info', '[SBTSelector] shared light-universe kickoff', {
      ...kickoffContext,
      options: { forceExactSlugs: true },
    });

    try {
      const result = ensureLightSbtUniverse(kickoffSlugs, { forceExactSlugs: true });
      this.beginDiscovering();
      Promise.resolve(result).then(() => {
        if (sbtLog.isEnabled('debug') || isForcedSbtSelectorDebugEnabled()) {
          emitSbtSelectorDebug('debug', '[SBTSelector] shared light-universe kickoff settled', kickoffContext);
        }
      }).finally(() => {
        this.endDiscovering();
      });
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          delete SBTSelector._sharedLightUniverseKickoffMemo[kickoffSig];
          emitSbtSelectorDebug('warn', 'SBTSelector shared light-universe kickoff failed:', error);
        });
      }
      return result;
    } catch (error) {
      delete SBTSelector._sharedLightUniverseKickoffMemo[kickoffSig];
      emitSbtSelectorDebug('warn', 'SBTSelector shared light-universe kickoff failed:', error);
      return null;
    }
  };

  ensureSbtUniverseForSlug = async ({ slug, force } = {}) => {
    const resolvedSlug = normalizeSessionSlug(slug || '');
    const discoveryRef = this.getDiscoverySessionRef(resolvedSlug);
    const networkID = this.getSessionNetworkId(resolvedSlug);
    const factoryAddress = String(discoveryRef?.contracts?.sbtFactory?.address || '').trim().toLowerCase();
    const logContext = this.getSelectorLogContext({
      targetSlug: resolvedSlug,
      force: !!force,
      networkID: Number(networkID || 0) || null,
      factoryAddress,
    });
    if (!networkID) {
      emitSbtSelectorDebug('warn', '[SBTSelector] local universe discovery skipped (missing chain)', logContext);
      return null;
    }
    const metadataLookupCfg = {
      ...(discoveryRef && typeof discoveryRef === 'object' ? discoveryRef : {}),
      networkChainId: networkID,
    };

    const memoKey = `${resolvedSlug}:${networkID}:${factoryAddress}`;
    const now = Date.now();
    const memoHit = SBTSelector._universeMemo[memoKey];
    if (!force && memoHit && (now - memoHit) < 60000) {
      if (sbtLog.isEnabled('debug') || isForcedSbtSelectorDebugEnabled()) {
        emitSbtSelectorDebug('debug', '[SBTSelector] local universe discovery skipped (memo hit)', {
          ...logContext,
          memoKey,
          ageMs: now - memoHit,
        });
      }
      return null;
    }
    if (SBTSelector._universeInflight[memoKey]) {
      if (sbtLog.isEnabled('debug') || isForcedSbtSelectorDebugEnabled()) {
        emitSbtSelectorDebug('debug', '[SBTSelector] local universe discovery joined inflight run', {
          ...logContext,
          memoKey,
        });
      }
      return SBTSelector._universeInflight[memoKey];
    }
    emitSbtSelectorDebug('info', '[SBTSelector] local universe discovery start', {
      ...logContext,
      memoKey,
    });

    const run = (async () => {
      try {
        const netKey = String(networkID);
        let sbtCache = this.normalizeSbtCacheForNet(
          await this.readSbtCacheBySlug(resolvedSlug),
          netKey
        );
        let sbtList = sbtCache[netKey].sbtList || {};
        let nameLookupState = ensureNameLookupState(sbtCache, netKey);

        const mergeLatestCacheState = async () => {
          const latestCache = this.normalizeSbtCacheForNet(
            await this.readSbtCacheBySlug(resolvedSlug),
            netKey
          );
          const latestSbtList = { ...(latestCache[netKey]?.sbtList || {}) };
          Object.entries(latestSbtList).forEach(([address, entry]) => {
            sbtList[address] = mergeScopedSbtEntry(
              sbtList[address],
              decorateScopedSbtEntry(entry, resolvedSlug),
              resolvedSlug
            );
          });
          nameLookupState = {
            ...ensureNameLookupState(latestCache, netKey),
            ...(nameLookupState || {}),
          };
          latestCache[netKey].sbtList = sbtList;
          latestCache[netKey].nameLookupState = nameLookupState;
          sbtCache = latestCache;
        };

        const persistProgressiveCache = async () => {
          await mergeLatestCacheState();
          await writeCache('sbtCache', resolvedSlug, sbtCache);
          this.scheduleProgressiveOptionsReload({ force: true });
        };

        let progressiveCacheFlush = Promise.resolve();
        const queueDiscoveredAddresses = (addresses = []) => {
          const uniqueDiscovered = Array.from(new Set(
            (Array.isArray(addresses) ? addresses : [])
              .map((value) => String(value || '').trim())
              .filter((value) => ethers.utils.isAddress(value))
          ));
          let mutated = false;
          uniqueDiscovered.forEach((address) => {
            const lower = address.toLowerCase();
            const existing = sbtList[lower] || null;
            const nextEntry = mergeScopedSbtEntry(
              existing,
              {
                ...(existing || {}),
                sbtAddress: address,
                sbtInfo: existing?.sbtInfo || null,
                slug: pickNormalizedSessionSlug(existing?.slug, resolvedSlug),
              },
              resolvedSlug
            );
            const existingAddress = String(existing?.sbtAddress || '').trim().toLowerCase();
            const existingSlug = hasOwn(existing, 'slug')
              ? normalizeSessionSlug(existing?.slug || '')
              : null;
            if (existingAddress === lower && existingSlug === nextEntry?.slug) return;
            sbtList[lower] = nextEntry;
            mutated = true;
          });
          if (!mutated) return;
          progressiveCacheFlush = progressiveCacheFlush
            .catch(() => null)
            .then(async () => {
              await persistProgressiveCache();
            })
            .catch((error) => {
              sbtLog.warn('SBTSelector progressive cache write failed:', error);
            });
        };

        const addrs = await contractScripts.getAllSbtAddressesCached('none', discoveryRef, {
          onDiscoveredAddresses: ({ addresses = [] }) => {
            queueDiscoveredAddresses(addresses);
          },
        });
        queueDiscoveredAddresses(addrs);
        await progressiveCacheFlush;
        if (!addrs || !addrs.length) {
          SBTSelector._universeMemo[memoKey] = Date.now();
          emitSbtSelectorDebug('info', '[SBTSelector] local universe discovery found no SBT addresses', {
            ...logContext,
            memoKey,
          });
          return null;
        }
        emitSbtSelectorDebug('info', '[SBTSelector] local universe discovery fetched SBT addresses', {
          ...logContext,
          memoKey,
          addressCount: addrs.length,
        });

        const uniqueAddrs = Array.from(new Set(addrs.map((address) => String(address || '').trim()).filter(Boolean)));
        const lookupNow = Date.now();
        const toFetch = uniqueAddrs.filter((address) => {
          const lower = address.toLowerCase();
          const entry = sbtList[lower] || null;
          if (hasSbtDisplayName(entry?.sbtInfo || null)) {
            clearNameLookupFailure(nameLookupState, lower);
            return false;
          }
          return canRetryNameLookup(nameLookupState, lower, lookupNow);
        });

        const BATCH = 6;
        for (let i = 0; i < toFetch.length; i += BATCH) {
          const batch = toFetch.slice(i, i + BATCH);
          const results = await Promise.all(batch.map(async (address) => {
            try {
              const lookup = await hydrateSbtDisplayNameTargeted({
                address,
                preferredSlug: resolvedSlug,
                metadataLookupConfig: metadataLookupCfg,
                chainId: networkID,
                writeBack: true,
              });
              return { address, sbtInfo: lookup?.info || null };
            } catch (_) {
              return { address, sbtInfo: null };
            }
          }));
          const batchNow = Date.now();
          for (const { address, sbtInfo } of results) {
            const lower = address.toLowerCase();
            const existing = sbtList[lower] || null;
            const resolvedInfo = sbtInfo || existing?.sbtInfo || null;
            sbtList[lower] = mergeScopedSbtEntry(
              existing,
              {
                ...(existing || {}),
                sbtAddress: address,
                sbtInfo: resolvedInfo,
                slug: pickNormalizedSessionSlug(existing?.slug, resolvedSlug),
              },
              resolvedSlug
            );
            if (hasSbtDisplayName(resolvedInfo)) {
              clearNameLookupFailure(nameLookupState, lower);
            } else {
              markNameLookupFailure(nameLookupState, lower, batchNow);
            }
          }
          await persistProgressiveCache();
        }
        SBTSelector._universeMemo[memoKey] = Date.now();
        emitSbtSelectorDebug('info', '[SBTSelector] local universe discovery complete', {
          ...logContext,
          memoKey,
          hydratedAddressCount: toFetch.length,
          cachedAddressCount: Object.keys(sbtList || {}).length,
        });
      } catch (err) {
        sbtLog.error('SBTSelector universe scan failed:', err);
      } finally {
        delete SBTSelector._universeInflight[memoKey];
      }
      return null;
    })();

    SBTSelector._universeInflight[memoKey] = run;
    return run;
  };

  ensureSbtUniverse = async ({ slugOverride, force } = {}) => {
    if (!this.shouldAutoDiscover()) return null;
    if (typeof window === 'undefined') return null;

    const targetSlugs = this.getResolvedTargetSlugs({ slugOverride });
    if (!targetSlugs.length) return null;
    emitSbtSelectorDebug('info', '[SBTSelector] ensureSbtUniverse start', this.getSelectorLogContext({
      scopeMode: this.getResolvedScopeMode(),
      slugOverride: normalizeSessionSlug(slugOverride ?? ''),
      force: !!force,
      targetSlugs,
      hasSharedUniverseKickoff: typeof this.props.ensureLightSbtUniverse === 'function',
    }));
    this.kickoffSharedLightUniverseIfNeeded({ slugOverride });

    this.beginDiscovering();
    try {
      for (const targetSlug of targetSlugs) {
        await this.ensureSbtUniverseForSlug({ slug: targetSlug, force });
        await this.loadSBTOptions({ force: true });
      }
    } finally {
      this.endDiscovering();
    }
    return null;
  };

  isOptionsLoading = () => !!(this.state.loadingOptions || this.state.discovering);

  getNoOptionsMessage = () => (this.isOptionsLoading() ? null : `No ${t('sbts')}`);

  getLoadingOptionCount = () => (
    Math.max(0, Array.isArray(this.state.sbtOptions) ? this.state.sbtOptions.length : 0)
  );

  getLoadingStatusText = ({ compact = false } = {}) => {
    const count = this.getLoadingOptionCount();
    const hasCount = count > 0;
    return compact
      ? (hasCount ? String(count) : 'Loading')
      : (hasCount ? `Loading ${count}` : 'Loading');
  };

  renderLoadingStatus = ({ compact = false, includeTestId = false } = {}) => {
    const text = this.getLoadingStatusText({ compact });
    return (
      <span
        className={`${styles.loadingStatus}${compact ? ` ${styles.loadingStatusCompact}` : ''}`}
        {...(includeTestId ? { 'data-testid': E2E_TESTIDS.SBT_SELECTOR_LOADING_STATUS } : {})}
      >
        <FontAwesomeIcon icon={faSpinner} spin className={styles.loadingStatusSpinner} />
        <span
          className={styles.loadingStatusText}
          {...(!compact ? { 'data-testid': E2E_TESTIDS.SBT_SELECTOR_LOADING } : {})}
        >
          {text}
        </span>
      </span>
    );
  };

  getLoadingMessage = () => this.renderLoadingStatus({ includeTestId: true });

  loadSBTOptions = async ({ force = false } = {}) => {
    const slug = normalizeSessionSlug(this.getEffectiveSessionSlug());
    const scopeMode = this.getResolvedScopeMode();
    const targetSlugs = this.getResolvedTargetSlugs();
    const featuredEntries = this.getScopeFeaturedEntries({
      targetSlugs,
      effectiveSlug: slug,
    });
    const ignoredSet = this.getIgnoredAddressSet({
      effectiveSlug: slug,
      scopeMode,
      targetSlugs,
    });
    const requestSig = buildSbtOptionsRequestSignature({
      slug,
      cacheRevision: this.props.sbtCacheRevision,
      sessionConfigSig: buildSessionConfigSig(this.props.sessionConfig),
      targetSlugChainSig: this.getTargetSlugChainSignature(targetSlugs),
      featuredEntries,
      ignoredFromConfig: Array.from(ignoredSet),
    });
    const requestContext = this.getSelectorLogContext({
      force: !!force,
      scopeMode,
      activeSlug: slug,
      targetSlugs,
      featuredEntryCount: featuredEntries.length,
      ignoredCount: ignoredSet.size,
      requestSig,
    });
    if (sbtLog.isEnabled('debug') || isForcedSbtSelectorDebugEnabled()) {
      emitSbtSelectorDebug('debug', '[SBTSelector] loadSBTOptions request', requestContext);
    }
    if (!force && !this._loadSbtOptionsInflight && requestSig === this._lastSbtOptionsRequestSig) {
      if (sbtLog.isEnabled('debug') || isForcedSbtSelectorDebugEnabled()) {
        emitSbtSelectorDebug('debug', '[SBTSelector] loadSBTOptions skipped (request unchanged)', requestContext);
      }
      return null;
    }
    if (this._loadSbtOptionsInflight) {
      const inflightSig = String(this._inflightSbtOptionsRequestSig || '');
      const shouldQueueRerun = force || requestSig !== inflightSig;
      if (shouldQueueRerun) {
        this._pendingSbtOptionsReload = true;
        this._pendingSbtOptionsForceReload = this._pendingSbtOptionsForceReload || force;
      }
      return this._loadSbtOptionsInflight;
    }

    const run = (async () => {
      const shouldEnableLoading = !this.state.loadingOptions;
      if (shouldEnableLoading) {
        this.setState({ loadingOptions: true });
      }
      const { contexts, contextBySlug } = await this.readScopedCacheContexts(targetSlugs);
      const sbtList = this.buildAggregatedSbtListFromContexts(contexts);
      emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions cache contexts ready', {
        ...requestContext,
        contextCount: contexts.length,
        cachedOptionCount: Object.keys(sbtList).length,
      });
      if (scopeMode === 'list') {
        const linkedScopedSbtList = this.buildLinkedScopedSbtListFromKnownCache({
          targetSlugs,
          fallbackSlug: slug,
          requireConcreteBinding: true,
        });
        Object.entries(linkedScopedSbtList).forEach(([address, entry]) => {
          sbtList[address] = mergeScopedSbtEntry(sbtList[address], entry, slug);
        });
        emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions linked cache merge complete', {
          ...requestContext,
          linkedScopedCount: Object.keys(linkedScopedSbtList).length,
          mergedOptionCount: Object.keys(sbtList).length,
        });
      }
      if (!contexts.length && Object.keys(sbtList).length === 0) {
        this.applySbtOptions({
          sbtList: {},
          featuredEntries,
          ignoredSet,
          fallbackSlug: slug,
          loadingOptions: false,
          scopeMode,
          targetSlugs,
        });
        emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions resolved empty state', {
          ...requestContext,
          contextCount: contexts.length,
          linkedScopedCount: Object.keys(sbtList).length,
        });
        return null;
      }
      if (!contexts.length) {
        this.applySbtOptions({
          sbtList,
          featuredEntries,
          ignoredSet,
          fallbackSlug: slug,
          loadingOptions: false,
          scopeMode,
          targetSlugs,
        });
        emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions resolved from linked cache only', {
          ...requestContext,
          optionCount: Object.keys(sbtList).length,
        });
        return null;
      }
      this.applySbtOptions({
        sbtList,
        featuredEntries,
        ignoredSet,
        fallbackSlug: slug,
        loadingOptions: true,
        scopeMode,
        targetSlugs,
      });
      emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions featured hydration start', {
        ...requestContext,
        featuredHydrationTargetCount: featuredEntries.length,
      });

      await this.hydrateScopedEntries({
        entries: featuredEntries,
        contextBySlug,
        aggregatedSbtList: sbtList,
        fallbackSlug: slug,
        onProgress: (progress) => {
          emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions featured hydration progress', {
            ...requestContext,
            ...progress,
          });
          this.applySbtOptions({
            sbtList,
            featuredEntries,
            ignoredSet,
            fallbackSlug: slug,
            loadingOptions: true,
            scopeMode,
            targetSlugs,
          });
        },
      });

      const entriesNeedingName = Object.values(sbtList || {})
        .map((entry) => ({
          address: String(entry?.sbtAddress || '').trim(),
          slug: pickNormalizedSessionSlug(
            hasOwn(entry, 'sessionBindingSlug') ? entry.sessionBindingSlug : undefined,
            entry?.slug,
            slug
          ),
        }))
        .filter((entry) => entry.address && ethers.utils.isAddress(entry.address))
        .filter((entry) => {
          const info = sbtList[String(entry.address || '').toLowerCase()]?.sbtInfo || null;
          return !hasSbtDisplayName(info);
        });
      emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions name hydration start', {
        ...requestContext,
        nameHydrationTargetCount: entriesNeedingName.length,
      });

      await this.hydrateScopedEntries({
        entries: entriesNeedingName,
        contextBySlug,
        aggregatedSbtList: sbtList,
        fallbackSlug: slug,
        onProgress: (progress) => {
          emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions name hydration progress', {
            ...requestContext,
            ...progress,
          });
          this.applySbtOptions({
            sbtList,
            featuredEntries,
            ignoredSet,
            fallbackSlug: slug,
            loadingOptions: true,
            scopeMode,
            targetSlugs,
          });
        },
      });

      this.applySbtOptions({
        sbtList,
        featuredEntries,
        ignoredSet,
        fallbackSlug: slug,
        loadingOptions: false,
        scopeMode,
        targetSlugs,
      });
      emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions complete', {
        ...requestContext,
        contextCount: contexts.length,
        optionCount: Object.keys(sbtList).length,
      });
      return null;
    })();

    this._inflightSbtOptionsRequestSig = requestSig;
    this._loadSbtOptionsInflight = run;
    try {
      await run;
      this._lastSbtOptionsRequestSig = requestSig;
    } catch (error) {
      if (this._lastSbtOptionsRequestSig === requestSig) {
        this._lastSbtOptionsRequestSig = '';
      }
      if (this._isMounted && this.state.loadingOptions) {
        this.setState({ loadingOptions: false });
      }
      sbtLog.error('SBTSelector option load failed:', error);
    } finally {
      if (this._loadSbtOptionsInflight === run) {
        this._loadSbtOptionsInflight = null;
      }
      if (this._inflightSbtOptionsRequestSig === requestSig) {
        this._inflightSbtOptionsRequestSig = '';
      }
      const shouldRerun = this._pendingSbtOptionsReload;
      const rerunForce = this._pendingSbtOptionsForceReload;
      this._pendingSbtOptionsReload = false;
      this._pendingSbtOptionsForceReload = false;
      if (shouldRerun && this._isMounted) {
        void this.loadSBTOptions({ force: rerunForce });
      }
    }
    return null;
  };

  handleSBTSelection = async (selectedOption) => {
    if (!selectedOption) return;
    const selectedAddress = this.normalizeSelectableAddress(selectedOption.value);
    const selectedKey = this.getSelectableSbtKey(selectedOption) || selectedAddress;
    if (!selectedAddress || this.hasSelectedOrPendingSbtKey(selectedOption)) return;

    this._pendingSelectedSbtKeys.add(selectedKey);
    try {
      if (this.getSelectedSbtKeySet().has(selectedKey)) return;

      const selectableOptions = [
        ...(Array.isArray(this.state.sbtOptions) ? this.state.sbtOptions : []),
        ...this.normalizeAdditionalSBTOptions(),
      ];
      let selectedSBT = selectableOptions.find(
        (sbt) => {
          const optionKey = this.getSelectableSbtKey(sbt);
          return optionKey
            ? optionKey === selectedKey
            : this.normalizeSelectableAddress(sbt?.address) === selectedAddress;
        }
      );
      if (!selectedSBT) {
        // SBT not in options, need to fetch metadata
        try {
          const lookup = await hydrateSbtDisplayNameTargeted({
            address: selectedAddress,
            preferredSlug: this.getEffectiveSessionSlug(),
            metadataLookupConfig: this.getMetadataLookupConfig(this.getEffectiveSessionSlug()),
            chainId: this.getSessionNetworkId(this.getEffectiveSessionSlug()),
            writeBack: true,
          });
          const sbtInfo = lookup?.info || null;
          const resolvedSession = resolveSbtSelectorSelectedSessionContext({
            sessionName: sbtInfo?.sessionName,
            activeSessionSlug: this.getEffectiveSessionSlug(),
            resolveSessionSlugByName: getSessionSlugByName,
          });
          const resolvedSlug = resolvedSession.sessionSlug;
          const resolvedChainId = sbtInfo?.chainID || sbtInfo?.chainId || null;
          const sessionBindingSlug = pickOptionalNormalizedSessionSlug(
            resolveConcreteSbtSessionBindingSlug({
              sbtInfo,
              sessionSlug: resolvedSlug,
              sessionName: resolvedSession.sessionName,
            })
          );
          selectedSBT = {
            address: selectedAddress,
            name: this.resolveSbtLabel(sbtInfo, selectedAddress, resolvedSlug),
            image: sbtInfo?.image || null,
            sessionSlug: resolvedSlug,
            sessionName: resolvedSession.sessionName,
            chainId: resolvedChainId,
            ...(sessionBindingSlug != null ? { sessionBindingSlug } : {}),
            selectionKey: buildSbtLookupKey({ address: selectedAddress, chainId: resolvedChainId }) || selectedAddress,
          };
        } catch (error) {
          sbtLog.error('Error fetching SBT metadata:', error);
          selectedSBT = {
            address: selectedAddress,
            name: this.resolveSbtLabel(null, selectedAddress),
            image: null,
            sessionSlug: this.getEffectiveSessionSlug(),
            selectionKey: selectedAddress,
          };
        }
      } else {
        const resolvedSlug = resolveSbtSelectorSelectedSessionContext({
          sessionName: selectedSBT.sessionName,
          sessionSlug: selectedSBT.sessionSlug,
          activeSessionSlug: this.getEffectiveSessionSlug(),
          resolveSessionSlugByName: getSessionSlugByName,
        }).sessionSlug;
        selectedSBT = {
          ...selectedSBT,
          sessionSlug: resolvedSlug,
          selectionKey: this.getSelectableSbtKey(selectedSBT) || selectedAddress,
        };
      }

      if (this.getSelectedSbtKeySet().has(this.getSelectableSbtKey(selectedSBT) || selectedKey)) return;
      this.setState({ selectedOption: null }); // Reset selector
      this.props.onAddSBT(selectedSBT); // Pass the sbt object
    } finally {
      this._pendingSelectedSbtKeys.delete(selectedKey);
    }
  };

  handleCustomSBTAddressInput = (e) => {
    this.setState({
      customSBTAddress: e.target.value,
      manualInputWarning: '',
    });
  };

  handleAddCustomSBT = async () => {
    const { customSBTAddress } = this.state;
    const customAddressLower = this.normalizeSelectableAddress(customSBTAddress);
    if (!customAddressLower) return;
    if (this.props.limitToFeatured === true && !this.getEffectiveFeaturedAddressSet().has(customAddressLower)) {
      this.setState({
        manualInputWarning: `Only featured ${t('sbts')} can be added by address in this selector.`,
      });
      return;
    }
    if (this.hasSelectedOrPendingSbtAddress(customAddressLower)) return;

    this._pendingSelectedSbtAddresses.add(customAddressLower);
    try {
      if (this.getSelectedSbtAddressSet().has(customAddressLower)) return;

      // Fetch metadata
      let sbtName = customAddressLower;
      let sbtImage = null;
      let sbtInfo = null;
      let resolvedSlug = this.getEffectiveSessionSlug();
      try {
        const lookup = await hydrateSbtDisplayNameTargeted({
          address: customAddressLower,
          preferredSlug: this.getEffectiveSessionSlug(),
          metadataLookupConfig: this.getMetadataLookupConfig(this.getEffectiveSessionSlug()),
          chainId: this.getSessionNetworkId(this.getEffectiveSessionSlug()),
          writeBack: true,
        });
        sbtInfo = lookup?.info || null;
        resolvedSlug = resolveSbtSelectorSelectedSessionContext({
          sessionName: sbtInfo?.sessionName,
          activeSessionSlug: resolvedSlug,
          resolveSessionSlugByName: getSessionSlugByName,
        }).sessionSlug;
        sbtName = this.resolveSbtLabel(sbtInfo, customAddressLower, resolvedSlug);
        sbtImage = sbtInfo?.image || null;
      } catch (error) {
        sbtLog.error('Error fetching SBT metadata:', error);
      }
      // Update cache even if metadata fetch failed.
      const sbtCache = await this.readSbtCacheBySlug(resolvedSlug);
      const networkID = this.getSessionNetworkId(resolvedSlug);
      const netKey = String(networkID);
      const normalizedCache = this.normalizeSbtCacheForNet(sbtCache, netKey);
      normalizedCache[netKey].sbtList[customAddressLower] = {
        sbtAddress: customAddressLower,
        sbtInfo,
        manual: true,
        slug: resolvedSlug
      };
      await writeCache('sbtCache', resolvedSlug, normalizedCache);
      const customSBT = {
        address: customAddressLower,
        name: sbtName,
        image: sbtImage,
        sessionSlug: resolvedSlug,
        sessionName: sbtInfo?.sessionName || null,
        chainId: sbtInfo?.chainID || sbtInfo?.chainId || null,
        ...(pickOptionalNormalizedSessionSlug(
          resolveConcreteSbtSessionBindingSlug({
            sbtInfo,
            sessionSlug: resolvedSlug,
          })
        ) != null
          ? {
            sessionBindingSlug: pickOptionalNormalizedSessionSlug(
              resolveConcreteSbtSessionBindingSlug({
                sbtInfo,
                sessionSlug: resolvedSlug,
              })
            ),
          }
          : {}),
        selectionKey: buildSbtLookupKey({
          address: customAddressLower,
          chainId: sbtInfo?.chainID || sbtInfo?.chainId || null,
        }) || customAddressLower,
      };
      if (this.getSelectedSbtAddressSet().has(customAddressLower)) return;
      this.setState({ customSBTAddress: '', manualInputWarning: '' });
      this.props.onAddSBT(customSBT);
    } finally {
      this._pendingSelectedSbtAddresses.delete(customAddressLower);
    }
  };

  toggleManualInput = () => {
    this.setState(prevState => ({
      showManualInput: !prevState.showManualInput,
      manualInputWarning: '',
    }));
  };

  toggleGroupPicker = () => {
    this.setState(prevState => ({ showGroupPicker: !prevState.showGroupPicker }));
  };

  applyGroupSourceSelection = (next) => {
    const active = this.getPropSessionSlug();
    if (next === '__active__') {
      this.setState(
        { groupOverride: false, sourceSessionSlug: active },
        () => this.ensureSbtUniverse({ slugOverride: active, force: true }).then(() => {
          if (this._isMounted) this.loadSBTOptions({ force: true });
        })
      );
      return;
    }
    this.setState(
      { groupOverride: true, sourceSessionSlug: next },
      () => this.ensureSbtUniverse({ slugOverride: next, force: true }).then(() => {
        if (this._isMounted) this.loadSBTOptions({ force: true });
      })
    );
  };

  handleGroupSelect = (e) => {
    this.applyGroupSourceSelection(e.target.value);
  };

  getAutoSearchSessionOptions = () => {
    if (!this.props.enableGroupSelect) return [];
    if (!shouldAutoSearchOtherSelectorSessions()) return [];
    const hiddenSlugSet = new Set(this.getDirectlyInvokedTargetSlugs());
    if (this.state.groupOverride) {
      hiddenSlugSet.add(normalizeSessionSlug(this.state.sourceSessionSlug));
    }
    return (Array.isArray(this.state.groupOptions) ? this.state.groupOptions : [])
      .map((option) => ({
        ...option,
        value: normalizeSessionSlug(option?.value || ''),
      }))
      .filter((option) => !hiddenSlugSet.has(option.value));
  };

  normalizeAdditionalSBTOptions = (optionsInput = this.props.additionalSBTOptions) => (
    Array.isArray(optionsInput)
      ? optionsInput
          .map((entry) => {
            const address = String(entry?.address || entry?.sbtAddress || entry?.value || '').trim();
            if (!address) return null;
            return {
              ...entry,
              address,
              name: entry?.name || entry?.label || address,
            };
          })
          .filter(Boolean)
      : []
  );

  formatOptionLabel = ({ label, image, value }) => (
    <div className={styles.optionLabel}>
      {image && <img src={normalizeArweaveUrl(image, { contextLabel: 'sbt_selector_image' })} alt="" className={styles.optionImage} />}
      <span>{label}</span>
    </div>
  );

  formatValueLabel = ({ label, image, value }) => (
    <div className={styles.selectedValueLabel}>
      {image && <img src={normalizeArweaveUrl(image, { contextLabel: 'sbt_selector_image' })} alt="" className={styles.optionImage} />}
      <span className={styles.selectedValueText}>{label || value}</span>
    </div>
  );

  resolveSbtLabel = (sbtInfo, address, preferredSlug = this.getEffectiveSessionSlug()) => {
    return (
      resolveSbtDisplayLabel({
        address,
        sbtInfo,
        preferredSlug,
        fallback: 'short',
      }) ||
      address ||
      `Unnamed ${t('sbt')}`
    );
  };

  getSbtOptionsByAddress = (sbtOptionsInput) => {
    const sbtOptions = Array.isArray(sbtOptionsInput) ? sbtOptionsInput : [];
    const memo = this._sbtOptionsByAddressMemo || {};
    if (memo.source === sbtOptions && memo.value instanceof Map) {
      return memo.value;
    }
    const byAddress = new Map();
    sbtOptions.forEach((entry) => {
      const key = String(entry?.address || '').toLowerCase();
      if (!key || byAddress.has(key)) return;
      byAddress.set(key, entry);
    });
    this._sbtOptionsByAddressMemo = { source: sbtOptions, value: byAddress };
    return byAddress;
  };

  getSbtOptionsBySelectionKey = (sbtOptionsInput) => {
    const sbtOptions = Array.isArray(sbtOptionsInput) ? sbtOptionsInput : [];
    const memo = this._sbtOptionsBySelectionKeyMemo || {};
    if (memo.source === sbtOptions && memo.value instanceof Map) {
      return memo.value;
    }
    const bySelectionKey = new Map();
    sbtOptions.forEach((entry) => {
      const key = this.getSelectableSbtKey(entry);
      if (!key || bySelectionKey.has(key)) return;
      bySelectionKey.set(key, entry);
    });
    this._sbtOptionsBySelectionKeyMemo = { source: sbtOptions, value: bySelectionKey };
    return bySelectionKey;
  };

  normalizeSelectableAddress = (value) => {
    const rawAddress = String(value || '').trim();
    if (!rawAddress || !ethers.utils.isAddress(rawAddress)) return '';
    return ethers.utils.getAddress(rawAddress).toLowerCase();
  };

  getSelectableSbtKey = (value) => {
    if (value && typeof value === 'object') {
      const explicit = String(value.selectionKey || '').trim();
      if (explicit) return explicit;
      const rawAddress = value.address || value.sbtAddress || value.value;
      const chainId = value.chainId || value?.sbtInfo?.chainId || value?.sbtInfo?.chainID || null;
      return buildSbtLookupKey({ address: rawAddress, chainId }) || this.normalizeSelectableAddress(rawAddress);
    }
    const raw = String(value || '').trim();
    if (!raw) return '';
    const chainScopedMatch = raw.match(/^(\d+):(0x[a-fA-F0-9]{40})$/);
    if (chainScopedMatch && ethers.utils.isAddress(chainScopedMatch[2])) {
      return `${Number(chainScopedMatch[1])}:${ethers.utils.getAddress(chainScopedMatch[2]).toLowerCase()}`;
    }
    return this.normalizeSelectableAddress(raw);
  };

  getSelectOptionValue = (option) => (
    this.getSelectableSbtKey(option) || String(option?.value || '')
  );

  getSelectedSbtKeySet = () => (
    new Set(
      (Array.isArray(this.props.selectedSBTs) ? this.props.selectedSBTs : [])
        .map((sbt) => this.getSelectableSbtKey(sbt))
        .filter(Boolean)
    )
  );

  getSelectedSbtAddressSet = () => (
    new Set(
      (Array.isArray(this.props.selectedSBTs) ? this.props.selectedSBTs : [])
        .map((sbt) => this.normalizeSelectableAddress(sbt?.address))
        .filter(Boolean)
    )
  );

  getEffectiveFeaturedAddressSet = () => (
    new Set(
      (
        Array.isArray(this.state.scopeFeaturedAddresses) && this.state.scopeFeaturedAddresses.length > 0
          ? this.state.scopeFeaturedAddresses
          : (Array.isArray(this.props.defaultFeaturedSBTs) ? this.props.defaultFeaturedSBTs : [])
      )
        .map((address) => this.normalizeSelectableAddress(address))
      .filter(Boolean)
    )
  );

  getSbtDetailLinkSessionSlug = (sbt, fallbackSlug = this.getEffectiveSessionSlug()) => {
    const explicitBindingSlug = pickOptionalNormalizedSessionSlug(
      hasOwn(sbt, 'sessionBindingSlug') ? sbt.sessionBindingSlug : undefined,
      hasAuthoritativeSessionSlug(sbt?.sbtInfo)
        ? normalizeSessionSlug(sbt?.sbtInfo?.sessionSlug || '')
        : undefined,
      (hasOwn(sbt, 'sessionSlug') && sbt?.sessionSlugExplicit === true)
        ? normalizeSessionSlug(sbt?.sessionSlug || '')
        : undefined
    );
    if (explicitBindingSlug != null) return explicitBindingSlug;

    const metadataSessionName = String(
      sbt?.sbtInfo?.sessionName ??
      sbt?.sessionName ??
      ''
    ).trim();
    if (metadataSessionName) {
      const byName = getSessionSlugByName(metadataSessionName);
      if (byName != null) return normalizeSessionSlug(byName);
    }

    const existingSelectedSlug = pickOptionalNormalizedSessionSlug(sbt?.sessionSlug);
    if (existingSelectedSlug != null) return existingSelectedSlug;

    return pickNormalizedSessionSlug(fallbackSlug);
  };

  hasSelectedOrPendingSbtAddress = (address) => {
    const normalizedAddress = this.normalizeSelectableAddress(address);
    if (!normalizedAddress) return false;
    return this.getSelectedSbtAddressSet().has(normalizedAddress) || this._pendingSelectedSbtAddresses.has(normalizedAddress);
  };

  hasSelectedOrPendingSbtKey = (value) => {
    const normalizedKey = this.getSelectableSbtKey(value);
    if (!normalizedKey) return false;
    return this.getSelectedSbtKeySet().has(normalizedKey) || this._pendingSelectedSbtKeys.has(normalizedKey);
  };

  render() {
    const {
      customSBTAddress,
      manualInputWarning,
      sbtOptions,
      scopeFeaturedAddresses,
      showManualInput,
      selectedOption,
      showGroupPicker,
      groupOverride,
      groupOptions,
    } = this.state;
    // Receive new props for filtering
    const { defaultFeaturedSBTs, limitToFeatured, enableGroupSelect, variant } = this.props;
    const showManualEntry = showManualInput;
    const currentSessionSlug = this.getEffectiveSessionSlug();
    const activeSessionSlug = this.getPropSessionSlug();

    const additionalOptions = this.normalizeAdditionalSBTOptions();
    const mergedSbtOptions = [
      ...sbtOptions,
      ...additionalOptions.filter((entry) => (
        !sbtOptions.some((existing) => String(existing?.address || '').toLowerCase() === entry.address.toLowerCase())
      )),
    ];
    const sbtOptionsBySelectionKey = this.getSbtOptionsBySelectionKey(mergedSbtOptions);
    const sbtOptionsByAddress = this.getSbtOptionsByAddress(mergedSbtOptions);
    const effectiveFeatured = (
      Array.isArray(scopeFeaturedAddresses) && scopeFeaturedAddresses.length > 0
        ? scopeFeaturedAddresses
        : (Array.isArray(defaultFeaturedSBTs) ? defaultFeaturedSBTs : [])
    );
    const hasFeaturedSBTs = effectiveFeatured.length > 0;
    const autoSearchSessionOptions = this.getAutoSearchSessionOptions();
    const showAutoSearchSessionButtons = enableGroupSelect && (groupOverride || autoSearchSessionOptions.length > 0);

    // Filter options based on props
    let displayOptions = mergedSbtOptions;
    if (hasFeaturedSBTs && limitToFeatured === true) {
      const featuredLower = new Set(effectiveFeatured.map((addr) => String(addr || '').toLowerCase()));
      displayOptions = mergedSbtOptions.filter((opt) => featuredLower.has(String(opt?.address || '').toLowerCase()));
    }

    // Map filtered options for the Select component
    const selectOptions = displayOptions.map((sbt) => ({
      value: sbt.address,
      selectionKey: this.getSelectableSbtKey(sbt),
      label: sbt.name,
      image: sbt.image,
      chainId: sbt.chainId,
    }));

    const selectedDisplay = (this.props.selectedSBTs || []).map((sbt) => {
      const address = String(sbt?.address || '').toLowerCase();
      if (!address) return sbt;
      const fromOptions = (
        sbtOptionsBySelectionKey.get(this.getSelectableSbtKey(sbt)) ||
        sbtOptionsByAddress.get(address)
      );
      const resolvedName =
        fromOptions?.name ||
        sbt?.name ||
        this.resolveSbtLabel(
          sbt?.sbtInfo || null,
          address,
          pickNormalizedSessionSlug(sbt?.sessionSlug, currentSessionSlug)
        );
      return {
        ...sbt,
        name: resolvedName || sbt?.name || sbt?.address,
        image: fromOptions?.image || sbt?.image || null,
        sessionName: fromOptions?.sessionName || sbt?.sessionName || null,
        sessionSlug: pickNormalizedSessionSlug(fromOptions?.sessionSlug, sbt?.sessionSlug, currentSessionSlug),
        ...(pickOptionalNormalizedSessionSlug(
          hasOwn(fromOptions, 'sessionBindingSlug') ? fromOptions.sessionBindingSlug : undefined,
          hasOwn(sbt, 'sessionBindingSlug') ? sbt.sessionBindingSlug : undefined
        ) != null
          ? {
            sessionBindingSlug: pickOptionalNormalizedSessionSlug(
              hasOwn(fromOptions, 'sessionBindingSlug') ? fromOptions.sessionBindingSlug : undefined,
              hasOwn(sbt, 'sessionBindingSlug') ? sbt.sessionBindingSlug : undefined
            ),
          }
          : {}),
      };
    });

    // We expect `selectedSBTs` and `onRemoveSBT` to be passed in from the parent if we want to display existing selections.

    const variantClass =
      variant === 'admin'
        ? styles.adminVariant
        : variant === 'create'
          ? styles.createVariant
          : '';

    const isSelectorLoading = this.isOptionsLoading();
    const headerLoadingStatus = isSelectorLoading
      ? (
        <span
          className={styles.loadingStatusSrOnly}
          data-testid={E2E_TESTIDS.SBT_SELECTOR_LOADING_STATUS}
          aria-live="polite"
        >
          {this.getLoadingStatusText({ compact: true })}
        </span>
      )
      : null;

    return (
      <div
        className={`${styles.sbtSelector} ${variantClass}`.trim()}
        data-testid={E2E_TESTIDS.SBT_SELECTOR_ROOT}
        data-ce-sbt-selector-id={String(this.props.id || '').trim() || undefined}
      >
        <FormGroup>
          <div className={styles.selectorHeader}>
            <Label className={styles.sbtLabel}>{this.props.label || `Select ${t('sbts')}`}</Label>
            <div className={styles.selectorHeaderMeta}>
              {headerLoadingStatus}
              {enableGroupSelect && (
                <button
                  type="button"
                  className={styles.settingsButton}
                  onClick={this.toggleGroupPicker}
                  title="Choose group source"
                >
                  <FontAwesomeIcon icon={faCog} />
                </button>
              )}
            </div>
          </div>
          {enableGroupSelect && showGroupPicker && (
            <div className={styles.groupPicker}>
              <Label className={styles.groupPickerLabel}>Sample group</Label>
              <Input
                type="select"
                value={groupOverride ? currentSessionSlug : '__active__'}
                onChange={this.handleGroupSelect}
                className={styles.groupSelect}
              >
                <option value="__active__">Active group: {this.getSessionLabel(activeSessionSlug)}</option>
                {groupOptions.map((opt) => (
                  <option key={opt.value || 'general'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Input>
            </div>
          )}
          <div className={styles.selectorRow}>
            <AsyncSearchSelect
              id={`sbtDropdown-${this.props.id}`}
              options={selectOptions}
              onChange={this.handleSBTSelection}
              className={styles.sbtDropdown}
              classNamePrefix="sbtSelect"
              formatOptionLabel={this.formatOptionLabel}
              formatValueLabel={this.formatValueLabel}
              getOptionValue={this.getSelectOptionValue}
              variant={variant}
              value={selectedOption}
              placeholder={`Select ${t('sbt')}...`}
              isLoading={isSelectorLoading}
              noOptionsMessage={this.getNoOptionsMessage}
              loadingMessage={this.getLoadingMessage}
            />
            <button
              type="button"
              className={styles.menuButton}
              onClick={this.toggleManualInput}
              data-testid={E2E_TESTIDS.SBT_SELECTOR_MANUAL_TOGGLE}
            >
              {showManualInput ? 'Hide' : '+ By Address'}
            </button>
          </div>
          {showAutoSearchSessionButtons && (
            <div className={styles.groupPicker}>
              <Label className={styles.groupPickerLabel}>Browse other sessions</Label>
              <div>
                {groupOverride && (
                  <Button
                    type="button"
                    size="sm"
                    color="secondary"
                    outline
                    className="mr-2 mb-2"
                    onClick={() => this.applyGroupSourceSelection('__active__')}
                    data-testid="ce-sbt-selector-session-source-active"
                  >
                    Scope results
                  </Button>
                )}
                {autoSearchSessionOptions.map((opt) => (
                  <Button
                    key={opt.value || 'general'}
                    type="button"
                    size="sm"
                    color="secondary"
                    outline
                    className="mr-2 mb-2"
                    onClick={() => this.applyGroupSourceSelection(opt.value)}
                    data-testid={`ce-sbt-selector-session-source-${opt.value || 'general'}`}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </FormGroup>

        {showManualEntry && (
          <div className={styles.manualEntry}>
            <Input // Use reactstrap Input here
              id={`customSbtAddressInput-${this.props.id}`}
              type="text"
              placeholder={`Enter ${t('sbt')} Ethereum address`}
              value={customSBTAddress}
              onChange={this.handleCustomSBTAddressInput}
              data-testid={E2E_TESTIDS.SBT_SELECTOR_MANUAL_INPUT}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  this.handleAddCustomSBT();
                }
              }}
              className={styles.sbtAddressInput}
            />
            <Button
              id={`customSbtAddButton-${this.props.id}`}
              onClick={this.handleAddCustomSBT}
              className={styles.sbtAddButton}
              disabled={!ethers.utils.isAddress(customSBTAddress)}
              data-testid={E2E_TESTIDS.SBT_SELECTOR_MANUAL_ADD}
            >
              Add Address
            </Button>
            {manualInputWarning && (
              <div className={styles.manualWarning} role="alert">
                {manualInputWarning}
              </div>
            )}
          </div>
        )}

        {/* Render the currently selected SBTs (if any) with remove icon and external link */}
        {this.props.selectedSBTs && this.props.selectedSBTs.length > 0 && (
          <div className={styles.selectedAddresses}>
            {selectedDisplay.map((sbt) => (
              <div
                key={this.getSelectableSbtKey(sbt) || sbt.address}
                className={styles.addressTag}
                data-testid={E2E_TESTIDS.SBT_SELECTOR_SELECTED}
                data-ce-sbt-address={String(sbt.address || '').trim().toLowerCase() || undefined}
              >
                <span className={styles.sbtName}>{sbt.name || sbt.address}</span>
                <FontAwesomeIcon
                  icon={faTimes}
                  className={styles.removeIcon}
                  size="lg"
                  onClick={() => {
                    if (this.props.onRemoveSBT) {
                      this.props.onRemoveSBT(sbt.address);
                    }
                  }}
                />
                <FontAwesomeIcon
                  icon={faExternalLinkAlt}
                  className={styles.linkIcon}
                  size="lg"
                  onClick={() => window.open(
                    buildSbtDetailPath(
                      sbt.address,
                      this.getSbtDetailLinkSessionSlug(sbt, currentSessionSlug)
                    ),
                    '_blank'
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

export default SBTSelector;
