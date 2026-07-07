/** @file SBTSelector */

import React from 'react';
import { Button, FormGroup, Label, Input } from 'reactstrap';
import { ethers } from 'ethers';
import styles from './SBTSelector.module.scss';
import { faCog, faExternalLinkAlt, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AsyncSearchSelect from '../Shared/AsyncSearchSelect';

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
import { DEFAULT_CHAIN_ID, USE_ONCHAIN_SESSION_REGISTRY } from '../../variables/appConfig.js';
import { createLogger, emitForcedLog } from '../../utilities/logging.js';
import { listNamespaceEntriesSync, readCache, writeCache } from '../../utilities/cache/cacheScripts.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import { GLOBAL_SESSION_SELECTION_UPDATED_EVENT } from '../../utilities/session/globalSessionState.js';
import {
  hasSbtDisplayName,
  hydrateSbtDisplayNameTargeted,
  isTargetedSbtMetadataLookupEnabled,
  resolveSbtDisplayLabel,
  warmSbtDisplayNamesTargeted,
} from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import { getCanonicalSessionFeaturedSBTs } from '../../utilities/sbt/sessionFeaturedSBTs.js';
import { bindSbtSelectorRuntimePorts, isEnsureLightSbtUniverse } from './sbtSelectorRuntimePorts';
import type { SbtSelectorLogMethod, UnknownRecord } from './sbtSelectorRuntimePorts';
import { resolveSbtSelectorSelectedSessionContext } from './sbtSelectorSessionResolution.js';
import {
  buildSbtOptionsRequestSignature,
  buildEffectiveFeaturedAddressSet,
  buildSbtLookupKey,
  buildSbtOptionsByAddress,
  buildSbtOptionsBySelectionKey,
  applySbtSelectorAddressHydrationResultsToList,
  applySbtSelectorDiscoveredAddressesToList,
  applySbtSelectorHydrationResults,
  buildSbtSelectorCustomAddressClearPatch,
  buildSbtSelectorCustomAddressInputPatch,
  buildSelectedSbtAddressSet,
  buildSelectedSbtKeySet,
  buildIgnoredSbtSelectorAddressSet,
  buildAggregatedSbtSelectorListFromContexts,
  buildLinkedSbtSelectorListFromKnownCache,
  buildScopeFeaturedSbtSelectorEntries,
  buildSbtSelectorLogContext,
  buildSbtSelectorDiscoverySessionRef,
  buildSbtSelectorDiscoveringPatch,
  buildSharedLightUniverseKickoffSignature,
  buildSbtSelectorMetadataLookupConfig,
  buildSbtSelectorAutoSearchSessionOptions,
  buildSbtSelectorGroupOptions,
  buildSbtSelectorGroupOptionsPatch,
  buildSbtSelectorMergedSelectableOptions,
  buildSbtSelectorNameHydrationEntries,
  buildSbtSelectorNameLookupFetchList,
  buildSbtSelectorOptions,
  buildSbtSelectorOptionsStatePatch,
  buildSbtSelectorGroupPickerTogglePatch,
  buildSbtSelectorGroupSourceSelectionPatch,
  buildSbtSelectorLoadingStatusClassName,
  buildSbtSelectorLoadingOptionsPatch,
  buildSbtSelectorManualInputTogglePatch,
  buildSbtSelectorManualInputWarningPatch,
  buildSbtSelectorRootClassName,
  buildSbtSelectorCustomSbtSelection,
  buildSbtSelectorSelectedDisplayEntries,
  buildSbtSelectorSelectedOptionResetPatch,
  buildSbtSelectorSelectOptions,
  buildSbtSelectorSourceSessionSlugPatch,
  buildSelectedSbtHydrationAddresses,
  buildSelectedSbtHydrationSignature,
  buildSessionSlugSignature,
  buildTargetSlugChainSignature,
  buildSessionConfigSig,
  canRetryNameLookup,
  clearNameLookupFailure,
  ensureNameLookupState,
  getNormalizedNetworkChainValue,
  getSelectableSbtKey,
  getSelectOptionValue,
  getSbtSelectorLoadingOptionCount,
  getSbtSelectorLoadingStatusText,
  hasSelectedOrPendingSbtSelectorAddress,
  hasSelectedOrPendingSbtSelectorKey,
  isSbtSelectorOptionsLoading,
  isSbtSelectorForcedDebugEnabled,
  isUnresolvedSessionConfig,
  markNameLookupFailure,
  mergeSbtSelectorLatestCacheState,
  mergeSbtSelectorLinkedScopedEntries,
  normalizeAdditionalSbtOptions,
  normalizeChainValue,
  normalizeSbtCacheForNet,
  normalizeDiscoverySlugs,
  normalizeSelectableSbtAddress,
  normalizeSessionSlugListForSig,
  pickNormalizedSessionSlug,
  pickOptionalNormalizedSessionSlug,
  readSbtSelectorScopedCacheContexts,
  resolveConcreteSbtSessionBindingSlug,
  getNormalizedDiscoveryOverride,
  resolveDirectSbtSelectorTargetSlugs,
  resolveSbtSelectorAutoSearchButtonsState,
  resolveSbtSelectorDisplayLookupSessionConfig,
  resolveSbtSelectorGroupPickerState,
  resolveSbtSelectorHeaderLoadingStatusState,
  resolveSbtSelectorLabelImageState,
  resolveSbtSelectorLoadingStatusDisplayState,
  resolveSbtSelectorLoadOptionsRequestDecision,
  resolveSbtSelectorManualControlsState,
  resolveSbtSelectorManualEntryState,
  resolveSbtSelectorNoOptionsMessage,
  resolvePropSessionSlug,
  resolveSbtSelectorEffectiveSessionSlug,
  resolveSbtSelectorGroupSourceSelection,
  resolveSbtSelectorSelectedAddressesState,
  resolveSbtSelectorSessionLabel,
  resolveSbtSelectorSessionNetworkId,
  resolveSbtDetailLinkSessionSlug,
  resolveSbtSelectorDisplayOptions,
  resolveSbtSelectorScopeMode,
  resolveSbtSelectorTargetedHydrationDecision,
  resolveSbtSelectorTargetSlugs,
  resolveSbtSelectorUpdateEffects,
  resolveSbtSelectorUpdateSignals,
  shouldAutoSearchOtherSbtSelectorSessions,
  shouldWarmSbtSelectorRegistryCacheForTargets,
  shouldUsePropsSbtSelectorSessionConfigForSlug,
} from './sbtSelectorHelpers';
import type {
  NormalizedAdditionalSbtOption,
  SbtNameLookupState,
  SbtSelectorBuiltOption,
  SbtSelectorOptionsStatePatch,
  SbtSelectorScopedEntry,
} from './sbtSelectorHelpers';

const sbtLog = createLogger('sbt');
type SbtSelectorScopedEntryMap = Record<string, SbtSelectorScopedEntry | null | undefined>;
type SbtSelectorSlugOverrideArgs = {
  slugOverride?: unknown;
};
type SbtSelectorForceArgs = {
  force?: boolean;
};
type SbtSelectorScopedListArgs = {
  effectiveSlug?: unknown;
  scopeMode?: unknown;
  targetSlugs?: unknown;
};
type SbtSelectorLinkedCacheArgs = {
  fallbackSlug?: unknown;
  requireConcreteBinding?: boolean;
  targetSlugs?: unknown;
};
type SbtSelectorBuildOptionsArgs = {
  fallbackSlug?: unknown;
  featuredEntries?: unknown;
  ignoredSet?: unknown;
  sbtList?: unknown;
  scopeMode?: unknown;
  targetSlugs?: unknown;
};
type SbtSelectorApplyOptionsArgs = SbtSelectorBuildOptionsArgs & {
  loadingOptions?: boolean;
};
type SbtSelectorLoadingStatusArgs = {
  compact?: boolean;
  includeTestId?: boolean;
};
type SbtSelectorGroupOption = {
  label: string;
  value: string;
};
type SbtSelectorLooseOption = UnknownRecord & {
  address?: unknown;
  image?: unknown;
  label?: unknown;
  name?: unknown;
  sbtAddress?: unknown;
  value?: unknown;
};
type SbtSelectorAdditionalOption = NormalizedAdditionalSbtOption;
type SbtSelectorAsyncOption = UnknownRecord & {
  label?: React.ReactNode;
  value?: unknown;
};
type SbtSelectorSelectableOption = SbtSelectorScopedEntry &
  SbtSelectorLooseOption & {
    selectionKey?: unknown;
    sessionName?: unknown;
    sessionSlug?: unknown;
    sessionSlugExplicit?: unknown;
  };
type SbtSelectorLabelOption = {
  image?: unknown;
  label?: unknown;
  value?: unknown;
};
type SbtSelectorOptionMemo = {
  source?: unknown;
  value?: Map<string, SbtSelectorSelectableOption>;
};
type SbtSelectorToggleState = {
  showGroupPicker?: boolean;
  showManualInput?: boolean;
};
type SbtSelectorLogContext = UnknownRecord & {
  effectiveSessionSlug: string;
  selectorId: string;
};
type SbtSelectorUniverseMemo = Record<string, number>;
type SbtSelectorUniverseInflight = Record<string, Promise<unknown> | undefined>;
type SbtSelectorRefreshScopedUniverseArgs = {
  forceDiscover?: unknown;
};
type SbtSelectorOption = SbtSelectorBuiltOption;
type SbtSelectorSessionConfigSigLike = UnknownRecord & {
  __registry?: UnknownRecord & {
    chainId?: unknown;
  };
  blockLimits?: UnknownRecord & {
    end?: unknown;
    start?: unknown;
  };
  contracts?: UnknownRecord & {
    sbtFactory?: UnknownRecord & {
      address?: unknown;
      chainId?: unknown;
    };
    surveys?: UnknownRecord & {
      chainId?: unknown;
    };
  };
  networkChainId?: unknown;
  sessionName?: unknown;
  slug?: unknown;
};
type SbtCacheNetNode = UnknownRecord & {
  nameLookupState?: SbtNameLookupState;
  sbtList?: SbtSelectorScopedEntryMap;
};
type SbtCacheByNet = Record<string, SbtCacheNetNode>;
type SbtSelectorCacheContext = {
  cache: SbtCacheByNet;
  chainId: number;
  nameLookupState: SbtNameLookupState;
  netKey: string;
  sbtList: SbtSelectorScopedEntryMap;
  slug: string;
};
type SbtSelectorCacheContextsResult = {
  contextBySlug: Map<string, SbtSelectorCacheContext>;
  contexts: SbtSelectorCacheContext[];
};
type SbtSelectorHydrationProgress = {
  batchSize: number;
  completedCount: number;
  totalCount: number;
};
type SbtSelectorHydrateScopedEntry = UnknownRecord & {
  address?: unknown;
  slug?: unknown;
};
type SbtSelectorHydrateScopedEntriesArgs = {
  aggregatedSbtList?: unknown;
  contextBySlug?: unknown;
  entries?: unknown;
  fallbackSlug?: unknown;
  onProgress?: (progress: SbtSelectorHydrationProgress) => void;
};
type SbtSelectorHydrationResult = {
  address: string;
  context: SbtSelectorCacheContext;
  lower: string;
  sbtInfo: UnknownRecord | null;
  slug: string;
};
type SbtSelectorEnsureUniverseForSlugArgs = {
  force?: unknown;
  slug?: unknown;
};
type SbtSelectorEnsureUniverseArgs = SbtSelectorSlugOverrideArgs & {
  force?: unknown;
};
type SbtSelectorLoadOptionsArgs = {
  force?: unknown;
};
type SbtSelectorCallback<TValue> = {
  bivarianceHack(value: TValue): void;
}['bivarianceHack'];
type SbtSelectorProps = {
  activeSessionSlug?: unknown;
  additionalSBTOptions?: unknown;
  autoDiscover?: boolean;
  chainId?: unknown;
  defaultFeaturedSBTs?: unknown;
  discoverySessionSlugs?: unknown;
  enableGroupSelect?: unknown;
  ensureLightSbtUniverse?: unknown;
  id?: string | number;
  label?: React.ReactNode;
  limitToFeatured?: unknown;
  network?: unknown;
  onAddSBT: SbtSelectorCallback<SbtSelectorSelectableOption>;
  onRemoveSBT?: SbtSelectorCallback<string>;
  provider?: unknown;
  sbtCacheRevision?: unknown;
  selectedSBTs?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  showAllSBTs?: unknown;
  slug?: unknown;
  variant?: string;
};
type SbtSelectorState = SbtSelectorToggleState & {
  customSBTAddress: string;
  discovering: boolean;
  groupOptions: SbtSelectorGroupOption[];
  groupOverride: boolean;
  loadingOptions: boolean;
  manualInputWarning: string;
  sbtOptions: SbtSelectorOption[];
  scopeFeaturedAddresses: string[];
  selectedOption: SbtSelectorLooseOption | null;
  sourceSessionSlug: unknown;
};
type SbtSelectorDiscoveredAddressesPayload = {
  addresses?: unknown;
};
type SbtSelectorAddressHydrationResult = {
  address: string;
  sbtInfo: UnknownRecord | null;
};
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';
const sbtSelectorRuntimePorts = bindSbtSelectorRuntimePorts({
  contractScripts: () => contractScripts,
  hydrateSbtDisplayNameTargeted: () => hydrateSbtDisplayNameTargeted,
  logger: () => sbtLog,
  resolveSbtDisplayLabel: () => resolveSbtDisplayLabel,
  warmSbtDisplayNamesTargeted: () => warmSbtDisplayNamesTargeted,
  writeCache: () => writeCache,
});
const sbtLogUntyped = sbtSelectorRuntimePorts.logger;
const hydrateSbtDisplayNameTargetedTyped = sbtSelectorRuntimePorts.hydrateSbtDisplayNameTargeted;
const warmSbtDisplayNamesTargetedTyped = sbtSelectorRuntimePorts.warmSbtDisplayNamesTargeted;
const resolveSbtDisplayLabelTyped = sbtSelectorRuntimePorts.resolveSbtDisplayLabel;
const writeCacheTyped = sbtSelectorRuntimePorts.writeCache;
const contractScriptsUntyped = sbtSelectorRuntimePorts.contractScripts;
const ALLOW_DEMO_SESSION_FALLBACK = !USE_ONCHAIN_SESSION_REGISTRY;

const SELECTED_SBT_HYDRATION_RETRY_MS = 45 * 1000;
const SHARED_LIGHT_UNIVERSE_KICKOFF_TTL_MS = 60 * 1000;

const emitSbtSelectorDebug = (level: unknown, message: unknown, payload?: unknown): void => {
  const loggerLevel = String(level || 'log');
  const dynamicMethod = sbtLogUntyped[loggerLevel];
  const loggerMethod: SbtSelectorLogMethod =
    typeof dynamicMethod === 'function'
      ? (dynamicMethod as SbtSelectorLogMethod).bind(sbtLog)
      : sbtLogUntyped.log.bind(sbtLog);
  if (isSbtSelectorForcedDebugEnabled()) {
    if (typeof payload === 'undefined') {
      emitForcedLog(loggerLevel, message);
    } else {
      emitForcedLog(loggerLevel, message, payload);
    }
    return;
  }
  if (typeof payload === 'undefined') {
    loggerMethod(message);
  } else {
    loggerMethod(message, payload);
  }
};

const DEFAULT_FALLBACK_CHAIN_ID = normalizeChainValue(DEFAULT_CHAIN_ID);

class SBTSelector extends React.Component<SbtSelectorProps, SbtSelectorState> {
  static _universeMemo: SbtSelectorUniverseMemo = {};
  static _universeInflight: SbtSelectorUniverseInflight = {};
  static _sharedLightUniverseKickoffMemo: SbtSelectorUniverseMemo = {};
  _discoveringRuns = 0;
  _globalSessionSelectionListener: (() => void) | null = null;
  _inflightSbtOptionsRequestSig = '';
  _isMounted = false;
  _lastSbtOptionsRequestSig = '';
  _loadSbtOptionsInflight: Promise<unknown> | null = null;
  _pendingSbtOptionsForceReload = false;
  _pendingSbtOptionsReload = false;
  _pendingSelectedSbtAddresses = new Set<string>();
  _pendingSelectedSbtKeys = new Set<string>();
  _progressiveOptionsReloadForce = false;
  _progressiveOptionsReloadTimer: ReturnType<typeof setTimeout> | null = null;
  _sbtOptionsByAddressMemo: SbtSelectorOptionMemo = { source: null, value: new Map() };
  _sbtOptionsBySelectionKeyMemo: SbtSelectorOptionMemo = { source: null, value: new Map() };
  _selectedSbtHydrationRetryTimer: ReturnType<typeof setTimeout> | null = null;
  _selectedSbtHydrationSig = '';
  _sessionRegistryCacheListener: (() => void) | null = null;

  constructor(props: SbtSelectorProps) {
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

  refreshScopedUniverse = ({ forceDiscover = false }: SbtSelectorRefreshScopedUniverseArgs = {}): unknown => {
    const discoveryPromise = this.ensureSbtUniverse({ force: !!forceDiscover });
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
    if (
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function' &&
      this._globalSessionSelectionListener
    ) {
      window.removeEventListener(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, this._globalSessionSelectionListener);
      this._globalSessionSelectionListener = null;
    }
    if (
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function' &&
      this._sessionRegistryCacheListener
    ) {
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

  componentDidUpdate(prevProps: Readonly<SbtSelectorProps>, prevState: Readonly<SbtSelectorState>) {
    const prevPropSessionSlug = this.getPropSessionSlug(prevProps);
    const nextPropSessionSlug = this.getPropSessionSlug(this.props);
    const updateSignals = resolveSbtSelectorUpdateSignals({
      prevNetwork: prevProps.network,
      nextNetwork: this.props.network,
      prevChainId: prevProps.chainId,
      nextChainId: this.props.chainId,
      prevSessionConfig: prevProps.sessionConfig,
      nextSessionConfig: this.props.sessionConfig,
      prevSbtCacheRevision: prevProps.sbtCacheRevision,
      nextSbtCacheRevision: this.props.sbtCacheRevision,
      prevPropSessionSlug,
      nextPropSessionSlug,
      prevSourceSessionSlug: prevState.sourceSessionSlug,
      nextSourceSessionSlug: this.state.sourceSessionSlug,
      prevSelectedSBTs: prevProps.selectedSBTs,
      nextSelectedSBTs: this.props.selectedSBTs,
      prevDiscoveryOverrideSignature: this.getDiscoveryOverrideSignature(prevProps),
      nextDiscoveryOverrideSignature: this.getDiscoveryOverrideSignature(this.props),
      prevEnsureLightSbtUniverse: prevProps.ensureLightSbtUniverse,
      nextEnsureLightSbtUniverse: this.props.ensureLightSbtUniverse,
    });
    const {
      cacheChanged,
      chainIdChanged,
      discoveryOverrideChanged,
      networkChanged,
      selectedSbtPropsChanged,
      sessionConfigChanged,
      sharedLightUniverseFnChanged,
      slugPropChanged,
      sourceGroupChanged,
      universeScopeChanged,
    } = updateSignals;

    if (slugPropChanged && !this.state.groupOverride) {
      if (nextPropSessionSlug !== this.state.sourceSessionSlug) {
        this.setState(buildSbtSelectorSourceSessionSlugPatch({ slug: nextPropSessionSlug }));
        return;
      }
    }

    const updateEffects = resolveSbtSelectorUpdateEffects({
      cacheChanged,
      chainIdChanged,
      discoveryOverrideChanged,
      hasSharedLightUniverse: typeof this.props.ensureLightSbtUniverse === 'function',
      networkChanged,
      selectedSbtPropsChanged,
      sessionConfigChanged,
      shouldWarmRegistryCache: universeScopeChanged ? this.shouldWarmRegistryCacheForTargets() : false,
      sharedLightUniverseFnChanged,
      slugPropChanged,
      sourceGroupChanged,
    });

    if (updateEffects.shouldLoadOptions) {
      this.loadSBTOptions();
    }

    if (updateEffects.shouldEnsureUniverse) {
      this.ensureSbtUniverse({
        force: sourceGroupChanged || slugPropChanged || sessionConfigChanged || discoveryOverrideChanged,
      });
    }
    if (updateEffects.shouldKickoffSharedLightUniverse) {
      this.kickoffSharedLightUniverseIfNeeded();
    }
    if (updateEffects.shouldHydrateSelectedNames) {
      this.hydrateSelectedSbtNames();
    }
    if (updateEffects.shouldWarmRegistryCache) {
      const chainId = this.getSessionNetworkId(this.getEffectiveSessionSlug());
      loadSessionRegistryCache({ chainIds: chainId ? [chainId] : undefined, force: true }).then(() => {
        if (this._isMounted) this.refreshScopedUniverse({ forceDiscover: true });
      });
    }
  }

  getEffectiveSessionSlug = (): string => {
    return resolveSbtSelectorEffectiveSessionSlug({
      groupOverride: this.state.groupOverride,
      props: this.props,
      sourceSessionSlug: this.state.sourceSessionSlug,
    });
  };

  getPropSessionSlug = (props: Readonly<SbtSelectorProps> = this.props): string => resolvePropSessionSlug(props);

  buildSlugListSignature = (slugs: unknown): string =>
    buildSessionSlugSignature(normalizeDiscoverySlugs(slugs, { allowEmpty: true }));

  getDiscoveryOverrideSignature = (props: Readonly<SbtSelectorProps> = this.props): string =>
    this.buildSlugListSignature(getNormalizedDiscoveryOverride(props));

  getResolvedScopeMode = (): string => {
    return resolveSbtSelectorScopeMode({
      discoveryOverride: getNormalizedDiscoveryOverride(this.props),
      groupOverride: this.state.groupOverride,
      readSessionScanScope,
    });
  };

  getDirectlyInvokedTargetSlugs = (): string[] => {
    return resolveDirectSbtSelectorTargetSlugs({
      explicitOverride: getNormalizedDiscoveryOverride(this.props),
      getAllSessionSlugs,
      normalizeDiscoverySlugs,
      propSessionSlug: this.getPropSessionSlug(this.props),
      readSessionScanScope,
      readSessionScanSlugs,
    });
  };

  getResolvedTargetSlugs = ({ slugOverride }: SbtSelectorSlugOverrideArgs = {}): string[] => {
    return resolveSbtSelectorTargetSlugs({
      directlyInvokedTargetSlugs: this.getDirectlyInvokedTargetSlugs(),
      groupOverride: this.state.groupOverride,
      normalizeDiscoverySlugs,
      sourceSessionSlug: this.state.sourceSessionSlug,
      ...(slugOverride !== undefined ? { slugOverride } : {}),
    });
  };

  shouldWarmRegistryCacheForTargets = ({ slugOverride }: SbtSelectorSlugOverrideArgs = {}): boolean => {
    const targetSlugs = this.getResolvedTargetSlugs({ slugOverride });
    return shouldWarmSbtSelectorRegistryCacheForTargets({
      targetSlugs,
      shouldUsePropsSessionConfigForSlug: this.shouldUsePropsSessionConfigForSlug,
    });
  };

  shouldUsePropsSessionConfigForSlug = (slugIn: unknown): boolean => {
    return shouldUsePropsSbtSelectorSessionConfigForSlug({
      effectiveSessionSlug: this.getEffectiveSessionSlug(),
      sessionConfig: this.props.sessionConfig,
      slugIn,
    });
  };

  // Selector discovery/name hydration is display-only, so demo fallback stays local here.
  getDisplayLookupSessionConfig = (slugIn: unknown): SbtSelectorSessionConfigSigLike | null => {
    const slug = slugIn !== undefined ? slugIn : this.getEffectiveSessionSlug();
    return resolveSbtSelectorDisplayLookupSessionConfig({
      allowDemoSessionFallback: ALLOW_DEMO_SESSION_FALLBACK,
      getDemoSessionConfigBySlug,
      getSessionConfigBySlugOrDefault,
      isUnresolvedSessionConfig,
      sessionSlug: slug,
    }) as SbtSelectorSessionConfigSigLike | null;
  };

  getSessionNetworkId = (slug: unknown): number | null => {
    return resolveSbtSelectorSessionNetworkId({
      defaultFallbackChainId: DEFAULT_FALLBACK_CHAIN_ID,
      directChainId: this.props.chainId,
      displayLookupSessionConfig: this.getDisplayLookupSessionConfig(slug),
      getNormalizedNetworkChainValue,
      getSessionChainId,
      network: this.props.network,
      propsSessionConfig: this.props.sessionConfig,
      shouldUsePropsSessionConfig: this.shouldUsePropsSessionConfigForSlug(slug),
      slug,
    });
  };

  getMetadataLookupConfig = (slugIn: unknown): SbtSelectorSessionConfigSigLike => {
    const slug = slugIn !== undefined ? slugIn : this.getEffectiveSessionSlug();
    const baseCfg = (this.getDisplayLookupSessionConfig(slug) || {}) as SbtSelectorSessionConfigSigLike;
    return buildSbtSelectorMetadataLookupConfig({
      baseConfig: baseCfg,
      chainId: this.getSessionNetworkId(slug),
      propsConfig: this.props.sessionConfig,
      sessionSlug: slug,
      shouldUsePropsConfig: this.shouldUsePropsSessionConfigForSlug(slug),
    }) as SbtSelectorSessionConfigSigLike;
  };

  getDiscoverySessionRef = (slugIn: unknown): SbtSelectorSessionConfigSigLike => {
    const slug = slugIn !== undefined ? slugIn : this.getEffectiveSessionSlug();
    const metadataLookupCfg = this.getMetadataLookupConfig(slug);
    return buildSbtSelectorDiscoverySessionRef({
      metadataLookupConfig: metadataLookupCfg,
      sessionSlug: slug,
    }) as SbtSelectorSessionConfigSigLike;
  };

  getSessionLabel = (slug: unknown): string => {
    return resolveSbtSelectorSessionLabel({
      sessionConfig: this.getDisplayLookupSessionConfig(slug),
      sessionSlug: slug,
    });
  };

  readSbtCacheBySlug = async (slug: unknown): Promise<UnknownRecord> => {
    const parsed = await readCache('sbtCache', slug == null ? undefined : String(slug));
    return isRecord(parsed) ? parsed : {};
  };

  beginDiscovering = (): void => {
    this._discoveringRuns += 1;
    if (this._isMounted && this._discoveringRuns === 1) {
      this.setState(buildSbtSelectorDiscoveringPatch({ discovering: true }));
    }
  };

  endDiscovering = (): void => {
    this._discoveringRuns = Math.max(0, this._discoveringRuns - 1);
    if (this._isMounted && this._discoveringRuns === 0) {
      this.setState(buildSbtSelectorDiscoveringPatch());
    }
  };

  scheduleSelectedSbtHydrationRetry = (): void => {
    if (!this._isMounted) return;
    if (this._selectedSbtHydrationRetryTimer) return;
    this._selectedSbtHydrationRetryTimer = setTimeout(() => {
      this._selectedSbtHydrationRetryTimer = null;
      if (!this._isMounted) return;
      this.hydrateSelectedSbtNames({ force: true });
    }, SELECTED_SBT_HYDRATION_RETRY_MS);
  };

  clearSelectedSbtHydrationRetry = (): void => {
    if (!this._selectedSbtHydrationRetryTimer) return;
    clearTimeout(this._selectedSbtHydrationRetryTimer);
    this._selectedSbtHydrationRetryTimer = null;
  };

  scheduleProgressiveOptionsReload = ({ force = false }: SbtSelectorForceArgs = {}): void => {
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

  clearProgressiveOptionsReload = (): void => {
    if (this._progressiveOptionsReloadTimer) {
      clearTimeout(this._progressiveOptionsReloadTimer);
      this._progressiveOptionsReloadTimer = null;
    }
    this._progressiveOptionsReloadForce = false;
  };

  hydrateSelectedSbtNames = async ({ force = false }: SbtSelectorForceArgs = {}): Promise<void> => {
    const addresses = buildSelectedSbtHydrationAddresses(this.props.selectedSBTs);
    const slug = this.getEffectiveSessionSlug();
    const networkID = this.getSessionNetworkId(slug);
    const metadataLookupCfg = this.getMetadataLookupConfig(slug);
    const sig = buildSelectedSbtHydrationSignature({ addresses, networkID, slug });
    if (!addresses.length) {
      this.clearSelectedSbtHydrationRetry();
      this._selectedSbtHydrationSig = sig;
      return;
    }
    if (!force && sig === this._selectedSbtHydrationSig) return;
    this._selectedSbtHydrationSig = sig;

    try {
      const hits = await warmSbtDisplayNamesTargetedTyped({
        addresses,
        preferredSlug: slug,
        metadataLookupConfig: metadataLookupCfg,
        chainId: networkID,
        writeBack: true,
      });
      const targetedLookupEnabled = isTargetedSbtMetadataLookupEnabled();
      if (!this._isMounted) return;
      const hydrationDecision = resolveSbtSelectorTargetedHydrationDecision({
        addresses,
        hits,
        targetedLookupEnabled,
      });
      if (!hydrationDecision.hasHits) {
        if (hydrationDecision.shouldClearRetry) {
          this.clearSelectedSbtHydrationRetry();
          return;
        }
        this._selectedSbtHydrationSig = '';
        this.scheduleSelectedSbtHydrationRetry();
        return;
      }
      if (hydrationDecision.shouldRetry) {
        this._selectedSbtHydrationSig = '';
        this.scheduleSelectedSbtHydrationRetry();
      } else if (hydrationDecision.shouldClearRetry) {
        this.clearSelectedSbtHydrationRetry();
      }
      if (hydrationDecision.shouldReloadOptions) this.loadSBTOptions({ force: true });
    } catch (_) {
      if (!isTargetedSbtMetadataLookupEnabled()) {
        this.clearSelectedSbtHydrationRetry();
        return;
      }
      this._selectedSbtHydrationSig = '';
      this.scheduleSelectedSbtHydrationRetry();
    }
  };

  getTargetSlugChainSignature = (targetSlugs: unknown = []): string =>
    buildTargetSlugChainSignature(targetSlugs, (targetSlug: string) => this.getSessionNetworkId(targetSlug));

  getIgnoredAddressSet = ({
    effectiveSlug,
    scopeMode,
    targetSlugs = [],
  }: SbtSelectorScopedListArgs = {}): Set<string> => {
    return buildIgnoredSbtSelectorAddressSet({
      effectiveSlug,
      getSessionLists,
      normalizeDiscoverySlugs,
      scopeMode,
      targetSlugs,
    });
  };

  getScopeFeaturedEntries = ({
    targetSlugs = [],
    effectiveSlug = '',
  }: SbtSelectorScopedListArgs = {}): SbtSelectorScopedEntry[] => {
    return buildScopeFeaturedSbtSelectorEntries({
      defaultFeaturedSBTs: this.props.defaultFeaturedSBTs || [],
      effectiveSlug,
      getCanonicalSessionFeaturedSBTs,
      getDisplayLookupSessionConfig: (slug: string) => this.getDisplayLookupSessionConfig(slug),
      getSessionLists,
      normalizeDiscoverySlugs,
      sessionConfig: this.props.sessionConfig,
      shouldUsePropsSessionConfigForSlug: (slug: string) => this.shouldUsePropsSessionConfigForSlug(slug),
      targetSlugs,
    });
  };

  readScopedCacheContexts = async (targetSlugs: unknown = []): Promise<SbtSelectorCacheContextsResult> => {
    return readSbtSelectorScopedCacheContexts({
      targetSlugs,
      getSessionNetworkId: (slug) => this.getSessionNetworkId(slug),
      readSbtCacheBySlug: (slug) => this.readSbtCacheBySlug(slug),
    }) as Promise<SbtSelectorCacheContextsResult>;
  };

  buildAggregatedSbtListFromContexts = (contexts: unknown = []): SbtSelectorScopedEntryMap => {
    return buildAggregatedSbtSelectorListFromContexts(contexts) as SbtSelectorScopedEntryMap;
  };

  buildLinkedScopedSbtListFromKnownCache = ({
    targetSlugs = [],
    fallbackSlug = '',
    requireConcreteBinding = false,
  }: SbtSelectorLinkedCacheArgs = {}): SbtSelectorScopedEntryMap => {
    const knownEntries = listNamespaceEntriesSync('sbtCache', { cloneValues: false });
    return buildLinkedSbtSelectorListFromKnownCache({
      fallbackSlug,
      knownEntries,
      requireConcreteBinding,
      targetSlugs,
    }) as SbtSelectorScopedEntryMap;
  };

  writeCacheContext = async (context: unknown): Promise<void> => {
    const cacheContext = isRecord(context) ? (context as SbtSelectorCacheContext) : null;
    if (!cacheContext || !cacheContext.netKey) return;
    const netNode = cacheContext.cache[cacheContext.netKey] || { sbtList: {} };
    cacheContext.cache[cacheContext.netKey] = netNode;
    netNode.sbtList = cacheContext.sbtList;
    netNode.nameLookupState = cacheContext.nameLookupState;
    await writeCacheTyped('sbtCache', cacheContext.slug, cacheContext.cache);
  };

  buildSbtOptions = ({
    sbtList = {},
    featuredEntries = [],
    ignoredSet = new Set(),
    fallbackSlug = '',
    scopeMode = 'active',
    targetSlugs = [],
  }: SbtSelectorBuildOptionsArgs = {}): SbtSelectorOption[] => {
    return buildSbtSelectorOptions({
      sbtList,
      featuredEntries,
      ignoredSet,
      fallbackSlug,
      scopeMode,
      targetSlugs,
      onMissingAddress: (sbt) => sbtLog.warn('SBT without address:', sbt),
      resolveSbtLabel: (sbtInfo, address, sessionSlug) => this.resolveSbtLabel(sbtInfo, address, sessionSlug),
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
  }: SbtSelectorApplyOptionsArgs = {}): SbtSelectorOption[] => {
    const sbtOptions = this.buildSbtOptions({
      sbtList,
      featuredEntries,
      ignoredSet,
      fallbackSlug,
      scopeMode,
      targetSlugs,
    });
    if (!this._isMounted) return sbtOptions;
    const nextPatch: SbtSelectorOptionsStatePatch<SbtSelectorOption> = buildSbtSelectorOptionsStatePatch({
      currentLoadingOptions: this.state.loadingOptions,
      currentSbtOptions: this.state.sbtOptions,
      currentScopeFeaturedAddresses: this.state.scopeFeaturedAddresses,
      featuredEntries,
      loadingOptions,
      sbtOptions,
    });
    if (Object.keys(nextPatch).length > 0) {
      this.setState((prevState: Readonly<SbtSelectorState>) => ({
        loadingOptions:
          typeof nextPatch.loadingOptions === 'boolean' ? nextPatch.loadingOptions : prevState.loadingOptions,
        sbtOptions: nextPatch.sbtOptions || prevState.sbtOptions,
        scopeFeaturedAddresses: nextPatch.scopeFeaturedAddresses || prevState.scopeFeaturedAddresses,
      }));
    }
    return sbtOptions;
  };

  hydrateScopedEntries = async ({
    entries = [],
    contextBySlug,
    aggregatedSbtList,
    fallbackSlug = '',
    onProgress,
  }: SbtSelectorHydrateScopedEntriesArgs = {}): Promise<void> => {
    const lookupEntries: SbtSelectorHydrateScopedEntry[] = (Array.isArray(entries) ? entries : []).map(
      (entry: unknown) => (isRecord(entry) ? (entry as SbtSelectorHydrateScopedEntry) : {}),
    );
    if (!lookupEntries.length) return;
    const resolvedContextBySlug =
      contextBySlug instanceof Map
        ? (contextBySlug as Map<string, SbtSelectorCacheContext>)
        : new Map<string, SbtSelectorCacheContext>();
    const resolvedAggregatedSbtList = isRecord(aggregatedSbtList)
      ? (aggregatedSbtList as SbtSelectorScopedEntryMap)
      : {};
    const orderedContexts = Array.from(resolvedContextBySlug.values());
    const fallbackContext = orderedContexts[0] || null;
    if (!fallbackContext) return;

    const BATCH = 4;
    for (let i = 0; i < lookupEntries.length; i += BATCH) {
      const batch = lookupEntries.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (entry: SbtSelectorHydrateScopedEntry): Promise<SbtSelectorHydrationResult | null> => {
          const rawAddress = String(entry?.address || '').trim();
          if (!rawAddress || !ethers.utils.isAddress(rawAddress)) return null;
          const lower = rawAddress.toLowerCase();
          const targetSlug = pickNormalizedSessionSlug(entry?.slug, fallbackSlug);
          const context = resolvedContextBySlug.get(targetSlug) || fallbackContext;
          if (!context) return null;
          const aggregatedKey = buildSbtLookupKey({ address: rawAddress, chainId: context.chainId });
          const existingInfo =
            resolvedAggregatedSbtList[aggregatedKey]?.sbtInfo || context.sbtList?.[lower]?.sbtInfo || null;
          if (hasSbtDisplayName(existingInfo)) {
            clearNameLookupFailure(context.nameLookupState, lower);
            return null;
          }
          if (!canRetryNameLookup(context.nameLookupState, lower, Date.now())) {
            return null;
          }

          try {
            const lookup = await hydrateSbtDisplayNameTargetedTyped({
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
        }),
      );

      const touchedContexts = applySbtSelectorHydrationResults({
        results,
        resolvedAggregatedSbtList,
        now: Date.now(),
      }) as Set<SbtSelectorCacheContext>;

      if (touchedContexts.size > 0) {
        await Promise.all(
          Array.from(touchedContexts).map((context: SbtSelectorCacheContext) => this.writeCacheContext(context)),
        );
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

  refreshGroupOptions = (): void => {
    const opts = buildSbtSelectorGroupOptions({
      slugs: getAllSessionSlugs(),
      getSessionLabel: (slug: unknown) => this.getSessionLabel(slug),
    }) as SbtSelectorGroupOption[];
    this.setState(buildSbtSelectorGroupOptionsPatch({ groupOptions: opts }));
  };

  shouldAutoDiscover = (): boolean => this.props.autoDiscover !== false;

  getSelectorLogContext = (extra: UnknownRecord = {}): SbtSelectorLogContext =>
    buildSbtSelectorLogContext({
      effectiveSessionSlug: this.getEffectiveSessionSlug(),
      extra,
      id: this.props.id,
      label: this.props.label,
    }) as SbtSelectorLogContext;

  getSharedLightUniverseKickoffSlugs = ({ slugOverride }: SbtSelectorSlugOverrideArgs = {}): string[] =>
    this.getResolvedTargetSlugs({ slugOverride });

  kickoffSharedLightUniverseIfNeeded = ({ slugOverride }: SbtSelectorSlugOverrideArgs = {}): unknown | null => {
    if (!this.shouldAutoDiscover()) {
      if (sbtLog.isEnabled('debug') || isSbtSelectorForcedDebugEnabled()) {
        emitSbtSelectorDebug(
          'debug',
          '[SBTSelector] shared light-universe kickoff skipped (autoDiscover disabled)',
          this.getSelectorLogContext(),
        );
      }
      return null;
    }
    if (typeof window === 'undefined') return null;
    const ensureLightSbtUniverse = this.props.ensureLightSbtUniverse;
    if (!isEnsureLightSbtUniverse(ensureLightSbtUniverse)) {
      if (sbtLog.isEnabled('debug') || isSbtSelectorForcedDebugEnabled()) {
        emitSbtSelectorDebug(
          'debug',
          '[SBTSelector] shared light-universe kickoff unavailable',
          this.getSelectorLogContext(),
        );
      }
      return null;
    }

    const targetSlugs = this.getResolvedTargetSlugs({ slugOverride });
    const kickoffSlugs = this.getSharedLightUniverseKickoffSlugs({ slugOverride });
    if (!kickoffSlugs.length) return null;

    const kickoffSig = buildSharedLightUniverseKickoffSignature(kickoffSlugs);
    const kickoffContext = this.getSelectorLogContext({
      scopeMode: this.getResolvedScopeMode(),
      slugOverride: normalizeSessionSlug(slugOverride ?? ''),
      targetSlugs,
      kickoffSlugs,
      kickoffSig,
    });
    const now = Date.now();
    const lastKickoffAt = Number(SBTSelector._sharedLightUniverseKickoffMemo[kickoffSig] || 0);
    if (lastKickoffAt > 0 && now - lastKickoffAt < SHARED_LIGHT_UNIVERSE_KICKOFF_TTL_MS) {
      if (sbtLog.isEnabled('debug') || isSbtSelectorForcedDebugEnabled()) {
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
      Promise.resolve(result)
        .then(() => {
          if (sbtLog.isEnabled('debug') || isSbtSelectorForcedDebugEnabled()) {
            emitSbtSelectorDebug('debug', '[SBTSelector] shared light-universe kickoff settled', kickoffContext);
          }
        })
        .finally(() => {
          this.endDiscovering();
        });
      const maybePromise = result as Promise<unknown>;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch((error: unknown) => {
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

  ensureSbtUniverseForSlug = async ({ slug, force }: SbtSelectorEnsureUniverseForSlugArgs = {}): Promise<
    unknown | null
  > => {
    const resolvedSlug = normalizeSessionSlug(slug || '');
    const discoveryRef = this.getDiscoverySessionRef(resolvedSlug);
    const networkID = this.getSessionNetworkId(resolvedSlug);
    const factoryAddress = String(discoveryRef?.contracts?.sbtFactory?.address || '')
      .trim()
      .toLowerCase();
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
    if (!force && memoHit && now - memoHit < 60000) {
      if (sbtLog.isEnabled('debug') || isSbtSelectorForcedDebugEnabled()) {
        emitSbtSelectorDebug('debug', '[SBTSelector] local universe discovery skipped (memo hit)', {
          ...logContext,
          memoKey,
          ageMs: now - memoHit,
        });
      }
      return null;
    }
    if (SBTSelector._universeInflight[memoKey]) {
      if (sbtLog.isEnabled('debug') || isSbtSelectorForcedDebugEnabled()) {
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
        let sbtCache: SbtCacheByNet = normalizeSbtCacheForNet(
          await this.readSbtCacheBySlug(resolvedSlug),
          netKey,
        ) as SbtCacheByNet;
        let sbtList: SbtSelectorScopedEntryMap = sbtCache[netKey].sbtList || {};
        let nameLookupState: SbtNameLookupState = ensureNameLookupState(sbtCache, netKey);

        const mergeLatestCacheState = async (): Promise<void> => {
          const latestCache = normalizeSbtCacheForNet(
            await this.readSbtCacheBySlug(resolvedSlug),
            netKey,
          ) as SbtCacheByNet;
          const mergeResult = mergeSbtSelectorLatestCacheState({
            latestCache,
            nameLookupState,
            netKey,
            resolvedSlug,
            sbtList,
          });
          sbtList = mergeResult.sbtList;
          nameLookupState = mergeResult.nameLookupState;
          sbtCache = mergeResult.cache as SbtCacheByNet;
        };

        const persistProgressiveCache = async (): Promise<void> => {
          await mergeLatestCacheState();
          await writeCacheTyped('sbtCache', resolvedSlug, sbtCache);
          this.scheduleProgressiveOptionsReload({ force: true });
        };

        let progressiveCacheFlush: Promise<unknown> = Promise.resolve();
        const queueDiscoveredAddresses = (addresses: unknown = []): void => {
          const discoveryResult = applySbtSelectorDiscoveredAddressesToList({
            addresses,
            resolvedSlug,
            sbtList,
          });
          sbtList = discoveryResult.sbtList;
          if (!discoveryResult.mutated) return;
          progressiveCacheFlush = progressiveCacheFlush
            .catch(() => null)
            .then(async () => {
              await persistProgressiveCache();
            })
            .catch((error: unknown) => {
              sbtLog.warn('SBTSelector progressive cache write failed:', error);
            });
        };

        const addrs: unknown = await contractScriptsUntyped.getAllSbtAddressesCached('none', discoveryRef, {
          onDiscoveredAddresses: ({ addresses = [] }: SbtSelectorDiscoveredAddressesPayload = {}) => {
            queueDiscoveredAddresses(addresses);
          },
        });
        queueDiscoveredAddresses(addrs);
        await progressiveCacheFlush;
        const discoveredAddresses = Array.isArray(addrs) ? addrs : [];
        if (!discoveredAddresses.length) {
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
          addressCount: discoveredAddresses.length,
        });

        const lookupNow = Date.now();
        const fetchList = buildSbtSelectorNameLookupFetchList({
          addresses: discoveredAddresses,
          nameLookupState,
          now: lookupNow,
          sbtList,
        });
        const toFetch = fetchList.addresses;
        nameLookupState = fetchList.nameLookupState;

        const BATCH = 6;
        for (let i = 0; i < toFetch.length; i += BATCH) {
          const batch = toFetch.slice(i, i + BATCH);
          const results = await Promise.all(
            batch.map(async (address: string): Promise<SbtSelectorAddressHydrationResult> => {
              try {
                const lookup = await hydrateSbtDisplayNameTargetedTyped({
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
            }),
          );
          const batchNow = Date.now();
          const hydrationResult = applySbtSelectorAddressHydrationResultsToList({
            nameLookupState,
            now: batchNow,
            resolvedSlug,
            results,
            sbtList,
          });
          sbtList = hydrationResult.sbtList;
          nameLookupState = hydrationResult.nameLookupState;
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

  ensureSbtUniverse = async ({ slugOverride, force }: SbtSelectorEnsureUniverseArgs = {}): Promise<unknown | null> => {
    if (!this.shouldAutoDiscover()) return null;
    if (typeof window === 'undefined') return null;

    const forceDiscovery = !!force;
    const targetSlugs = this.getResolvedTargetSlugs({ slugOverride });
    if (!targetSlugs.length) return null;
    emitSbtSelectorDebug(
      'info',
      '[SBTSelector] ensureSbtUniverse start',
      this.getSelectorLogContext({
        scopeMode: this.getResolvedScopeMode(),
        slugOverride: normalizeSessionSlug(slugOverride ?? ''),
        force: forceDiscovery,
        targetSlugs,
        hasSharedUniverseKickoff: typeof this.props.ensureLightSbtUniverse === 'function',
      }),
    );
    this.kickoffSharedLightUniverseIfNeeded({ slugOverride });

    this.beginDiscovering();
    try {
      for (const targetSlug of targetSlugs) {
        await this.ensureSbtUniverseForSlug({ slug: targetSlug, force: forceDiscovery });
        await this.loadSBTOptions({ force: true });
      }
    } finally {
      this.endDiscovering();
    }
    return null;
  };

  isOptionsLoading = (): boolean => isSbtSelectorOptionsLoading(this.state);

  getNoOptionsMessage = (): string | null =>
    resolveSbtSelectorNoOptionsMessage({
      isLoading: this.isOptionsLoading(),
      pluralLabel: t('sbts'),
    });

  getLoadingOptionCount = (): number => getSbtSelectorLoadingOptionCount(this.state.sbtOptions);

  getLoadingStatusText = ({ compact = false }: SbtSelectorLoadingStatusArgs = {}): string => {
    return getSbtSelectorLoadingStatusText({
      compact,
      count: this.getLoadingOptionCount(),
    });
  };

  renderLoadingStatus = ({
    compact = false,
    includeTestId = false,
  }: SbtSelectorLoadingStatusArgs = {}): React.ReactElement => {
    const text = this.getLoadingStatusText({ compact });
    const displayState = resolveSbtSelectorLoadingStatusDisplayState({
      compact,
      includeTestId,
    });
    const className = buildSbtSelectorLoadingStatusClassName({
      baseClassName: styles.loadingStatus,
      compactClassName: styles.loadingStatusCompact,
      shouldUseCompactClass: displayState.shouldUseCompactClass,
    });
    return (
      <span
        className={className}
        {...(displayState.shouldAttachRootTestId ? { 'data-testid': E2E_TESTIDS.SBT_SELECTOR_LOADING_STATUS } : {})}
      >
        <FontAwesomeIcon icon={faSpinner} spin className={styles.loadingStatusSpinner} />
        <span
          className={styles.loadingStatusText}
          {...(displayState.shouldAttachTextTestId ? { 'data-testid': E2E_TESTIDS.SBT_SELECTOR_LOADING } : {})}
        >
          {text}
        </span>
      </span>
    );
  };

  getLoadingMessage = (): React.ReactElement => this.renderLoadingStatus({ includeTestId: true });

  loadSBTOptions = async ({ force = false }: SbtSelectorLoadOptionsArgs = {}): Promise<unknown | null> => {
    const forceReload = !!force;
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
      force: forceReload,
      scopeMode,
      activeSlug: slug,
      targetSlugs,
      featuredEntryCount: featuredEntries.length,
      ignoredCount: ignoredSet.size,
      requestSig,
    });
    if (sbtLog.isEnabled('debug') || isSbtSelectorForcedDebugEnabled()) {
      emitSbtSelectorDebug('debug', '[SBTSelector] loadSBTOptions request', requestContext);
    }
    const requestDecision = resolveSbtSelectorLoadOptionsRequestDecision({
      forceReload,
      inflightRequest: this._loadSbtOptionsInflight,
      inflightSig: this._inflightSbtOptionsRequestSig,
      lastRequestSig: this._lastSbtOptionsRequestSig,
      requestSig,
    });
    if (requestDecision.shouldSkipUnchanged) {
      if (sbtLog.isEnabled('debug') || isSbtSelectorForcedDebugEnabled()) {
        emitSbtSelectorDebug('debug', '[SBTSelector] loadSBTOptions skipped (request unchanged)', requestContext);
      }
      return null;
    }
    if (requestDecision.shouldReturnInflight) {
      if (requestDecision.shouldQueueRerun) {
        this._pendingSbtOptionsReload = true;
        this._pendingSbtOptionsForceReload = this._pendingSbtOptionsForceReload || forceReload;
      }
      return this._loadSbtOptionsInflight;
    }

    const run = (async () => {
      const shouldEnableLoading = !this.state.loadingOptions;
      if (shouldEnableLoading) {
        this.setState(buildSbtSelectorLoadingOptionsPatch({ loadingOptions: true }));
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
        const linkedMergeState = mergeSbtSelectorLinkedScopedEntries({
          fallbackSlug: slug,
          linkedScopedSbtList,
          sbtList,
        });
        emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions linked cache merge complete', {
          ...requestContext,
          linkedScopedCount: linkedMergeState.linkedScopedCount,
          mergedOptionCount: linkedMergeState.mergedOptionCount,
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
        onProgress: (progress: SbtSelectorHydrationProgress) => {
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

      const entriesNeedingName = buildSbtSelectorNameHydrationEntries({
        fallbackSlug: slug,
        sbtList,
      }) as SbtSelectorHydrateScopedEntry[];
      emitSbtSelectorDebug('info', '[SBTSelector] loadSBTOptions name hydration start', {
        ...requestContext,
        nameHydrationTargetCount: entriesNeedingName.length,
      });

      await this.hydrateScopedEntries({
        entries: entriesNeedingName,
        contextBySlug,
        aggregatedSbtList: sbtList,
        fallbackSlug: slug,
        onProgress: (progress: SbtSelectorHydrationProgress) => {
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
        this.setState(buildSbtSelectorLoadingOptionsPatch());
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
        void this.loadSBTOptions({ force: !!rerunForce });
      }
    }
    return null;
  };

  handleSBTSelection = async (selectedOption: SbtSelectorLooseOption | null): Promise<void> => {
    if (!selectedOption) return;
    const selectedAddress = normalizeSelectableSbtAddress(selectedOption.value);
    const selectedKey = getSelectableSbtKey(selectedOption) || selectedAddress;
    if (!selectedAddress || this.hasSelectedOrPendingSbtKey(selectedOption)) return;

    this._pendingSelectedSbtKeys.add(selectedKey);
    try {
      if (this.getSelectedSbtKeySet().has(selectedKey)) return;

      const selectableOptions = [
        ...(Array.isArray(this.state.sbtOptions) ? this.state.sbtOptions : []),
        ...this.normalizeAdditionalSBTOptions(),
      ] as SbtSelectorSelectableOption[];
      let selectedSBT = selectableOptions.find((sbt: SbtSelectorSelectableOption) => {
        const optionKey = getSelectableSbtKey(sbt);
        return optionKey ? optionKey === selectedKey : normalizeSelectableSbtAddress(sbt?.address) === selectedAddress;
      });
      if (!selectedSBT) {
        // SBT not in options, need to fetch metadata
        try {
          const lookup = await hydrateSbtDisplayNameTargetedTyped({
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
            }),
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
          selectionKey: getSelectableSbtKey(selectedSBT) || selectedAddress,
        };
      }

      if (this.getSelectedSbtKeySet().has(getSelectableSbtKey(selectedSBT) || selectedKey)) return;
      this.setState(buildSbtSelectorSelectedOptionResetPatch()); // Reset selector
      this.props.onAddSBT(selectedSBT); // Pass the sbt object
    } finally {
      this._pendingSelectedSbtKeys.delete(selectedKey);
    }
  };

  handleCustomSBTAddressInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState(buildSbtSelectorCustomAddressInputPatch(e.target.value));
  };

  handleAddCustomSBT = async (): Promise<void> => {
    const { customSBTAddress } = this.state;
    const customAddressLower = normalizeSelectableSbtAddress(customSBTAddress);
    if (!customAddressLower) return;
    if (this.props.limitToFeatured === true && !this.getEffectiveFeaturedAddressSet().has(customAddressLower)) {
      this.setState(
        buildSbtSelectorManualInputWarningPatch({
          warning: `Only featured ${t('sbts')} can be added by address in this selector.`,
        }),
      );
      return;
    }

    const initialSelectionKey =
      buildSbtLookupKey({
        address: customAddressLower,
        chainId: this.getSessionNetworkId(this.getEffectiveSessionSlug()),
      }) || customAddressLower;
    if (this.hasSelectedOrPendingSbtKey(initialSelectionKey)) return;

    let customSelectionKey = initialSelectionKey;
    this._pendingSelectedSbtKeys.add(initialSelectionKey);
    try {
      if (this.getSelectedSbtKeySet().has(initialSelectionKey)) return;

      // Fetch metadata
      let sbtName = customAddressLower;
      let sbtImage: unknown = null;
      let sbtInfo: UnknownRecord | null = null;
      let resolvedSlug = this.getEffectiveSessionSlug();
      try {
        const lookup = await hydrateSbtDisplayNameTargetedTyped({
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
      const normalizedCache = normalizeSbtCacheForNet(sbtCache, netKey) as SbtCacheByNet;
      const normalizedNode = normalizedCache[netKey] || { sbtList: {} };
      normalizedCache[netKey] = normalizedNode;
      const normalizedSbtList = normalizedNode.sbtList || {};
      normalizedNode.sbtList = normalizedSbtList;
      normalizedSbtList[customAddressLower] = {
        sbtAddress: customAddressLower,
        sbtInfo,
        manual: true,
        slug: resolvedSlug,
      };
      await writeCacheTyped('sbtCache', resolvedSlug, normalizedCache);
      const customSBT = buildSbtSelectorCustomSbtSelection({
        address: customAddressLower,
        name: sbtName,
        image: sbtImage,
        resolvedSlug,
        sbtInfo,
      });
      customSelectionKey = getSelectableSbtKey(customSBT) || initialSelectionKey;
      if (customSelectionKey !== initialSelectionKey) {
        if (this.hasSelectedOrPendingSbtKey(customSelectionKey)) return;
        this._pendingSelectedSbtKeys.add(customSelectionKey);
      }
      if (this.getSelectedSbtKeySet().has(customSelectionKey)) return;
      this.setState(buildSbtSelectorCustomAddressClearPatch());
      this.props.onAddSBT(customSBT);
    } finally {
      this._pendingSelectedSbtKeys.delete(initialSelectionKey);
      this._pendingSelectedSbtKeys.delete(customSelectionKey);
    }
  };

  toggleManualInput = (): void => {
    this.setState((prevState: SbtSelectorToggleState) => buildSbtSelectorManualInputTogglePatch(prevState));
  };

  toggleGroupPicker = (): void => {
    this.setState((prevState: SbtSelectorToggleState) => buildSbtSelectorGroupPickerTogglePatch(prevState));
  };

  applyGroupSourceSelection = (next: unknown): void => {
    const nextSelection = resolveSbtSelectorGroupSourceSelection({
      activeSlug: this.getPropSessionSlug(),
      next,
    });
    this.setState(buildSbtSelectorGroupSourceSelectionPatch({ selection: nextSelection }), () =>
      this.ensureSbtUniverse({ slugOverride: nextSelection.slugOverride, force: true }).then(() => {
        if (this._isMounted) this.loadSBTOptions({ force: true });
      }),
    );
  };

  handleGroupSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    this.applyGroupSourceSelection(e.target.value);
  };

  getAutoSearchSessionOptions = (): SbtSelectorGroupOption[] => {
    return buildSbtSelectorAutoSearchSessionOptions({
      autoSearchOtherSessions: shouldAutoSearchOtherSbtSelectorSessions(),
      directlyInvokedTargetSlugs: this.getDirectlyInvokedTargetSlugs(),
      enableGroupSelect: this.props.enableGroupSelect,
      groupOptions: this.state.groupOptions,
      groupOverride: this.state.groupOverride,
      sourceSessionSlug: this.state.sourceSessionSlug,
    });
  };

  normalizeAdditionalSBTOptions = (
    optionsInput: unknown = this.props.additionalSBTOptions,
  ): SbtSelectorAdditionalOption[] => normalizeAdditionalSbtOptions(optionsInput);

  formatOptionLabel = ({ label, image, value }: SbtSelectorLabelOption): React.ReactElement => {
    const imageState = resolveSbtSelectorLabelImageState({ image });
    return (
      <div className={styles.optionLabel}>
        {imageState.shouldRenderImage ? <img src={imageState.imageSrc} alt="" className={styles.optionImage} /> : null}
        <span>{String(label || '')}</span>
      </div>
    );
  };

  formatValueLabel = ({ label, image, value }: SbtSelectorLabelOption): React.ReactElement => {
    const imageState = resolveSbtSelectorLabelImageState({ image });
    return (
      <div className={styles.selectedValueLabel}>
        {imageState.shouldRenderImage ? <img src={imageState.imageSrc} alt="" className={styles.optionImage} /> : null}
        <span className={styles.selectedValueText}>{String(label || value || '')}</span>
      </div>
    );
  };

  resolveSbtLabel = (
    sbtInfo: unknown,
    address: unknown,
    preferredSlug: unknown = this.getEffectiveSessionSlug(),
  ): string => {
    return String(
      resolveSbtDisplayLabelTyped({
        address: String(address || ''),
        sbtInfo: isRecord(sbtInfo) ? sbtInfo : null,
        preferredSlug: String(preferredSlug || ''),
        fallback: 'short',
      }) ||
        address ||
        `Unnamed ${t('sbt')}`,
    );
  };

  getSbtOptionsByAddress = (sbtOptionsInput: unknown): Map<string, SbtSelectorSelectableOption> => {
    const sbtOptions = Array.isArray(sbtOptionsInput) ? sbtOptionsInput : [];
    const memo = (this._sbtOptionsByAddressMemo as SbtSelectorOptionMemo | undefined) || {};
    if (memo.source === sbtOptions && memo.value instanceof Map) {
      return memo.value;
    }
    const byAddress = buildSbtOptionsByAddress<SbtSelectorSelectableOption>(sbtOptions);
    this._sbtOptionsByAddressMemo = { source: sbtOptions, value: byAddress };
    return byAddress;
  };

  getSbtOptionsBySelectionKey = (sbtOptionsInput: unknown): Map<string, SbtSelectorSelectableOption> => {
    const sbtOptions = Array.isArray(sbtOptionsInput) ? sbtOptionsInput : [];
    const memo = (this._sbtOptionsBySelectionKeyMemo as SbtSelectorOptionMemo | undefined) || {};
    if (memo.source === sbtOptions && memo.value instanceof Map) {
      return memo.value;
    }
    const bySelectionKey = buildSbtOptionsBySelectionKey<SbtSelectorSelectableOption>(sbtOptions);
    this._sbtOptionsBySelectionKeyMemo = { source: sbtOptions, value: bySelectionKey };
    return bySelectionKey;
  };

  getSelectedSbtKeySet = (): Set<string> => buildSelectedSbtKeySet(this.props.selectedSBTs);

  getSelectedSbtAddressSet = (): Set<string> => buildSelectedSbtAddressSet(this.props.selectedSBTs);

  getEffectiveFeaturedAddressSet = (): Set<string> =>
    buildEffectiveFeaturedAddressSet({
      scopeFeaturedAddresses: this.state.scopeFeaturedAddresses,
      defaultFeaturedSBTs: this.props.defaultFeaturedSBTs,
    });

  getSbtDetailLinkSessionSlug = (sbt: unknown, fallbackSlug: unknown = this.getEffectiveSessionSlug()): string => {
    return resolveSbtDetailLinkSessionSlug({ sbt, fallbackSlug });
  };

  hasSelectedOrPendingSbtAddress = (address: unknown): boolean => {
    return hasSelectedOrPendingSbtSelectorAddress({
      address,
      pendingAddresses: this._pendingSelectedSbtAddresses,
      selectedAddresses: this.getSelectedSbtAddressSet(),
    });
  };

  hasSelectedOrPendingSbtKey = (value: unknown): boolean => {
    return hasSelectedOrPendingSbtSelectorKey({
      pendingKeys: this._pendingSelectedSbtKeys,
      selectedKeys: this.getSelectedSbtKeySet(),
      value,
    });
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
    const currentSessionSlug = this.getEffectiveSessionSlug();
    const activeSessionSlug = this.getPropSessionSlug();

    const sbtOptionsList = Array.isArray(sbtOptions) ? (sbtOptions as SbtSelectorOption[]) : [];
    const groupOptionsList = Array.isArray(groupOptions) ? (groupOptions as SbtSelectorGroupOption[]) : [];
    const selectedSbts = Array.isArray(this.props.selectedSBTs)
      ? (this.props.selectedSBTs as SbtSelectorSelectableOption[])
      : [];
    const selectedAddressesState = resolveSbtSelectorSelectedAddressesState({ selectedSbts });
    const additionalOptions = this.normalizeAdditionalSBTOptions();
    const mergedSbtOptions = buildSbtSelectorMergedSelectableOptions<SbtSelectorSelectableOption>({
      additionalOptions,
      sbtOptions: sbtOptionsList,
    });
    const sbtOptionsBySelectionKey = this.getSbtOptionsBySelectionKey(mergedSbtOptions);
    const sbtOptionsByAddress = this.getSbtOptionsByAddress(mergedSbtOptions);
    const autoSearchSessionOptions = this.getAutoSearchSessionOptions();
    const groupPickerState = resolveSbtSelectorGroupPickerState({
      currentSessionSlug,
      enableGroupSelect,
      groupOverride,
      showGroupPicker,
    });
    const { shouldRenderAutoSearchSessionButtons } = resolveSbtSelectorAutoSearchButtonsState({
      autoSearchSessionOptions,
      enableGroupSelect,
      groupOverride,
    });
    const manualEntryState = resolveSbtSelectorManualEntryState({
      customSBTAddress,
      isAddress: ethers.utils.isAddress,
    });
    const manualControlsState = resolveSbtSelectorManualControlsState({
      manualInputWarning,
      showManualInput,
    });
    const { displayOptions } = resolveSbtSelectorDisplayOptions<SbtSelectorSelectableOption>({
      defaultFeaturedSBTs,
      limitToFeatured,
      mergedSbtOptions,
      scopeFeaturedAddresses,
    });

    const selectOptions = buildSbtSelectorSelectOptions(displayOptions);

    const selectedDisplay = buildSbtSelectorSelectedDisplayEntries<
      SbtSelectorSelectableOption,
      SbtSelectorSelectableOption
    >({
      currentSessionSlug,
      resolveSbtLabel: (sbtInfo: unknown, address: string, sessionSlug: string) =>
        this.resolveSbtLabel(sbtInfo, address, sessionSlug),
      sbtOptionsByAddress,
      sbtOptionsBySelectionKey,
      selectedSbts,
    });

    // We expect `selectedSBTs` and `onRemoveSBT` to be passed in from the parent if we want to display existing selections.

    const rootClassName = buildSbtSelectorRootClassName({
      adminClassName: styles.adminVariant,
      baseClassName: styles.sbtSelector,
      createClassName: styles.createVariant,
      variant,
    });

    const isSelectorLoading = this.isOptionsLoading();
    const headerLoadingStatusState = resolveSbtSelectorHeaderLoadingStatusState({
      isLoading: isSelectorLoading,
    });
    const headerLoadingStatus = headerLoadingStatusState.shouldRenderHeaderLoadingStatus
      ? this.renderLoadingStatus({ compact: true, includeTestId: true })
      : null;

    return (
      <div
        className={rootClassName}
        data-testid={E2E_TESTIDS.SBT_SELECTOR_ROOT}
        data-ce-sbt-selector-id={String(this.props.id || '').trim() || undefined}
      >
        <FormGroup>
          <div className={styles.selectorHeader}>
            <Label className={styles.sbtLabel}>{this.props.label || `Select ${t('sbts')}`}</Label>
            <div className={styles.selectorHeaderMeta}>
              {headerLoadingStatus}
              {groupPickerState.shouldRenderGroupSettingsButton && (
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
          {groupPickerState.shouldRenderGroupPicker && (
            <div className={styles.groupPicker}>
              <Label className={styles.groupPickerLabel}>Sample group</Label>
              <Input
                type="select"
                value={groupPickerState.selectedGroupValue}
                onChange={this.handleGroupSelect}
                className={styles.groupSelect}
              >
                <option value="__active__">Active group: {this.getSessionLabel(activeSessionSlug)}</option>
                {groupOptionsList.map((opt: SbtSelectorGroupOption) => (
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
              getOptionValue={getSelectOptionValue}
              variant={variant}
              value={selectedOption as SbtSelectorAsyncOption | null}
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
              {manualControlsState.manualToggleLabel}
            </button>
          </div>
          {shouldRenderAutoSearchSessionButtons && (
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
                {autoSearchSessionOptions.map((opt: SbtSelectorGroupOption) => (
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

        {manualControlsState.shouldRenderManualEntry && (
          <div className={styles.manualEntry}>
            <Input // Use reactstrap Input here
              id={`customSbtAddressInput-${this.props.id}`}
              type="text"
              placeholder={`Enter ${t('sbt')} Ethereum address`}
              value={customSBTAddress}
              onChange={this.handleCustomSBTAddressInput}
              data-testid={E2E_TESTIDS.SBT_SELECTOR_MANUAL_INPUT}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
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
              disabled={!manualEntryState.canAddCustomAddress}
              data-testid={E2E_TESTIDS.SBT_SELECTOR_MANUAL_ADD}
            >
              Add Address
            </Button>
            {manualControlsState.shouldRenderManualWarning && (
              <div className={styles.manualWarning} role="alert">
                {manualInputWarning}
              </div>
            )}
          </div>
        )}

        {/* Render the currently selected SBTs (if any) with remove icon and external link */}
        {selectedAddressesState.shouldRenderSelectedAddresses && (
          <div className={styles.selectedAddresses}>
            {selectedDisplay.map((sbt: SbtSelectorSelectableOption) => (
              <div
                key={getSelectableSbtKey(sbt) || String(sbt.address || '')}
                className={styles.addressTag}
                data-testid={E2E_TESTIDS.SBT_SELECTOR_SELECTED}
                data-ce-sbt-address={
                  String(sbt.address || '')
                    .trim()
                    .toLowerCase() || undefined
                }
              >
                <span className={styles.sbtName}>{String(sbt.name || sbt.address || '')}</span>
                <FontAwesomeIcon
                  icon={faTimes}
                  className={styles.removeIcon}
                  size="lg"
                  onClick={() => {
                    if (this.props.onRemoveSBT) {
                      this.props.onRemoveSBT(sbt.address as string);
                    }
                  }}
                />
                <FontAwesomeIcon
                  icon={faExternalLinkAlt}
                  className={styles.linkIcon}
                  size="lg"
                  onClick={() =>
                    window.open(
                      buildSbtDetailPath(sbt.address, this.getSbtDetailLinkSessionSlug(sbt, currentSessionSlug)),
                      '_blank',
                    )
                  }
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
