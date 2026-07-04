/** @file SBTFilter */

import React from 'react';
import { FormGroup, Label, Input, Button } from 'reactstrap';
import styles from './SBTSelector.module.scss';
import SBTSelector from './SBTSelector';
import {
  asCacheObject,
  asResponseEntry,
  asSelectedSbtEntry,
  buildItemsSourceSignature,
  buildNetHoldersSet,
  buildNetHoldersSetFromCounts,
  buildSbtFilterFetchedHolderCacheEntryPatch,
  buildSbtFilterFetchedHolderRevisionKey,
  buildSbtFilterHolderFetchResult,
  buildSbtFilterBooleanTogglePatch,
  buildSbtFilterExternalStateSyncPatch,
  buildSbtFilterSbtEntryCachePatch,
  buildSbtFilterInitialState,
  buildSbtFilterHolderRequestKey,
  buildSbtFilterHolderRevisionKey,
  buildSbtFilterLastAppliedSnapshotPatch,
  buildSbtFilterLoadingPatch,
  buildSbtFilterQuickChipClassName,
  buildSbtFilterQuickChipDisplayState,
  buildSbtFilterQuickChipSelectedAddressSet,
  buildSbtFilterSelectionAddPatch,
  buildSbtFilterSelectionRemovePatch,
  buildSbtFilterSelectionStateFromState,
  buildSbtFilterHolderSelectionSets,
  buildSbtFilterSbtCacheMemoKey,
  buildSbtFilterSelectedEntryList,
  buildSbtFilterSnapshot,
  buildSbtFilterStateSignature,
  buildSbtFilterSurfaceClassNames,
  buildUniqueSbtEntries,
  computeHolderListFingerprint,
  countMapFingerprint,
  doesSbtFilterAddressPassSelection,
  isSbtFilterDataReady,
  getCachedSbtFilterQuestionEntry,
  getCachedSbtFilterQuestionResponseMap,
  filterSbtFilterObjectItems,
  hasActiveSbtFilterState,
  hasSbtFilterFeaturedOptions,
  isRecord,
  getSbtFilterItemCount,
  isLatestSbtFilterApplyRun,
  normalizeAggregatorResponseEntries,
  normalizeAddressCountMap,
  readMemoizedSbtFilterSbtCacheBySlug,
  readMemoizedSbtFilterSbtNetBucketBySlug,
  readSbtFilterQuestionsNetBucketBySlug,
  readSbtFilterSbtCacheBySlug,
  readSbtOptionAddress,
  resolveEffectiveSbtFilterNetwork,
  resolveSbtFilterAddressItemDecision,
  resolveSbtFilterAddressItemsToFilter,
  resolveSbtFilterCreationBlock,
  resolveSbtFilterButtonText,
  resolveSbtFilterChainId,
  resolveSbtFilterEmptyResponderShortCircuit,
  resolveSbtFilterEntryCountMapUsage,
  resolveSbtFilterExternalStateSync,
  resolveSbtFilterGroupSlug,
  resolveSbtFilterHolderScanFromBlock,
  resolveSbtFilterItemParticipantAddresses,
  resolveSbtFilterLayoutDisplayState,
  resolveSbtFilterLoadingUpdate,
  resolveSbtFilterModeSectionsState,
  resolveSbtFilterOptionsVisibilityState,
  resolveSbtFilterPanelDisplayState,
  resolveSbtFilterSurfaceDisplayState,
  scheduleMicrotask,
  setBoundedSbtHolderMemoEntry,
  shouldExpandMissingAddressItemsForSbtFilter,
  shouldAppendSbtFilterSelection,
  shouldApplySbtFilterOnDataReady,
  shouldReapplySbtFilterAfterUpdate,
  shouldPassThroughSbtFilter,
  unifySbtFilterAggregatorWithAllLocalQuestions,
} from './sbtFilterHelpers';
import type {
  SbtFilterQuestionEntry,
  SbtFilterResponseByQuestion,
  SbtFilterResponseEntry,
  SbtFilterHolderFetchResult,
  SbtFilterInitialState,
  SbtFilterNetworkLike,
  SbtFilterSbtOption,
  SbtFilterSelectedSbtEntry,
  SbtFilterSelectionState,
  UnknownRecord,
} from './sbtFilterHelpers';
import contractScripts, { getSessionChainId, getSessionSlugByName, normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import { resolveSbtDisplayLabel } from '../../utilities/sbt/sbtDisplayNames.js';
import {
  bindSbtFilterRuntimePorts,
} from './sbtFilterRuntimePorts';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faSpinner, faTimes, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { createLogger } from '../../utilities/logging.js';
import { writeCache } from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';

const sbtLog = createLogger('sbt');
const QUICK_CHIP_GATE_COLORS = ['#5affc2', '#5b8cff', '#ffb347', '#ff6bcb', '#ffd166'];
const sbtFilterRuntimePorts = bindSbtFilterRuntimePorts({
  contractScripts: () => contractScripts,
  writeCache: () => writeCache,
});
const writeCacheValue = sbtFilterRuntimePorts.writeCache;

type SbtFilterQuickSbtOption = {
  address: string;
};
type SbtFilterSelectionListKey = Exclude<keyof SbtFilterSelectionState, 'onlyVerifiedHumans'>;
type SbtFilterQuickChipKey = 'ir' | 'er' | 'ia' | 'ea' | 'ic' | 'ec' | 'ir2' | 'er2';
type SbtFilterCallback = (result: unknown, filterState: SbtFilterSelectionState) => unknown;
type SbtFilterProps = {
  activeSessionSlug?: unknown;
  autoExpand?: unknown;
  buttonSurface?: unknown;
  defaultFeaturedSBTs?: unknown;
  externalSBTFilterState?: unknown;
  expandToSbtHolders?: boolean;
  hideLoadingOverlay?: unknown;
  hideUI?: unknown;
  isQuestionCacheReady?: unknown;
  isSBTCacheReady?: unknown;
  isSurveyCacheReady?: unknown;
  items?: unknown;
  mode?: unknown;
  network?: unknown;
  onFilter?: SbtFilterCallback;
  onFilterCreators?: SbtFilterCallback;
  onFilterResponders?: SbtFilterCallback;
  provider?: unknown;
  sbtCacheRevision?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  ensureLightSbtUniverse?: unknown;
  setFilterLoading?: (loading: boolean) => unknown;
};
type SbtFilterState = Omit<SbtFilterInitialState, 'lastAppliedFilterSnapshot'> & {
  lastAppliedFilterSnapshot: unknown;
  [key: string]: unknown;
};
const contractScriptsBoundary = sbtFilterRuntimePorts.contractScripts;

const HOLDER_SET_MEMO_MAX_ENTRIES = 500;

class SBTFilter extends React.Component<SbtFilterProps, SbtFilterState> {
  _activeApplyFilterRunId: number;
  _applyFilterRunSeq: number;
  _applyFilterScheduled: boolean;
  _holderSetInFlight: Map<string, Promise<SbtFilterHolderFetchResult>>;
  _holderSetMemo: Map<string, Set<string>>;
  _isMounted: boolean;
  _lastExternalFilterStateSignature: string;
  _lastScheduledApplyReason: string;

  constructor(props: SbtFilterProps) {
    super(props);
    this.state = buildSbtFilterInitialState({
      autoExpand: props.autoExpand,
      externalSBTFilterState: props.externalSBTFilterState,
    });
    this._isMounted = false;
    this._applyFilterScheduled = false;
    this._applyFilterRunSeq = 0;
    this._activeApplyFilterRunId = 0;
    this._lastScheduledApplyReason = '';
    this._holderSetMemo = new Map();
    this._holderSetInFlight = new Map();
    this._lastExternalFilterStateSignature = buildSbtFilterStateSignature(
      props.externalSBTFilterState || {}
    );
  }

  componentDidMount() {
    this._isMounted = true;
    // If there's an existing external state that implies active filters, apply them once on mount
    if (this.hasAnyFilterActive()) {
      this.scheduleApplyFilter('mount');
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    this._applyFilterScheduled = false;
    this._holderSetMemo.clear();
    this._holderSetInFlight.clear();
  }


  componentDidUpdate(prevProps: Readonly<SbtFilterProps>, prevState: Readonly<SbtFilterState>): void {
    // Determine readiness based on mode.
    const wasDataReady = isSbtFilterDataReady({
      mode: prevProps.mode,
      isSBTCacheReady: prevProps.isSBTCacheReady,
      isQuestionCacheReady: prevProps.isQuestionCacheReady,
    });
    const isDataReady = isSbtFilterDataReady({
      mode: this.props.mode,
      isSBTCacheReady: this.props.isSBTCacheReady,
      isQuestionCacheReady: this.props.isQuestionCacheReady,
    });

    // If data just became ready and a filter is active, apply the filter.
    if (shouldApplySbtFilterOnDataReady({
      hasActiveFilter: this.hasAnyFilterActive(),
      isDataReady,
      wasDataReady,
    })) {
      this.scheduleApplyFilter('data-ready');
      return; // Filter applied; no further checks this cycle.
    }

    // 1. Handle External Prop Changes (SAFEGUARDED)
    // Keep a signature across updates so in-place mutations with stable refs are still detected.
    const externalStateSync = resolveSbtFilterExternalStateSync({
      currentExternalState: this.props.externalSBTFilterState || {},
      currentLocalSignature: this.getLocalFilterStateSignature(),
      lastExternalSignature: this._lastExternalFilterStateSignature,
      prevExternalState: prevProps.externalSBTFilterState || {},
    });
    if (externalStateSync.hasExternalChanged) {
      this._lastExternalFilterStateSignature = externalStateSync.nextExternalSig;

      // Only short-circuit when we actually sync local state from props.
      // If local state is already aligned, continue so normal reapply triggers
      // (e.g., changed items/mode/cache revision) still run in this update.
      if (externalStateSync.shouldSyncLocalState) {
        this.setState(buildSbtFilterExternalStateSyncPatch({
          incomingStateNormalized: externalStateSync.incomingStateNormalized,
        }));
        // Note: Removed direct applyFilter() call here. The state update triggers
        // componentDidUpdate again, which catches the change in step 2 below.
        return;
      }
    }
    this._lastExternalFilterStateSignature = externalStateSync.nextExternalSig;

    // 2. Handle Local State Changes
    const shouldReapply = shouldReapplySbtFilterAfterUpdate({
      nextProps: this.props,
      nextState: this.state,
      prevProps,
      prevState,
    });

    if (shouldReapply) {
      this.scheduleApplyFilter('state-change');
    }
  }


  hasAnyFilterActive(): boolean {
    return hasActiveSbtFilterState(this.getLocalFilterState());
  }

  getLocalFilterState(): SbtFilterSelectionState {
    return buildSbtFilterSelectionStateFromState(this.state);
  }

  getLocalFilterStateSignature(): string {
    return buildSbtFilterStateSignature(this.getLocalFilterState());
  }

  isLatestApplyRun = (runId: unknown): boolean => (
    isLatestSbtFilterApplyRun({
      activeApplyFilterRunId: this._activeApplyFilterRunId,
      runId,
    })
  );

  getEffectiveNetwork = (): SbtFilterNetworkLike | null => {
    return resolveEffectiveSbtFilterNetwork({
      network: this.props.network,
      sessionSlug: this.props.sessionSlug,
      readSessionChainId: getSessionChainId,
    });
  };

  setFilterLoading = (loading: boolean): void => {
    const loadingUpdate = resolveSbtFilterLoadingUpdate({
      currentLoading: this.state.loading,
      isMounted: this._isMounted,
      loading,
      setFilterLoading: this.props.setFilterLoading,
    });
    if (loadingUpdate.shouldSetLocalLoading) {
      this.setState(buildSbtFilterLoadingPatch({ loading: loadingUpdate.nextLoading }));
    }
    if (loadingUpdate.shouldNotifyParent && this.props.setFilterLoading) {
      this.props.setFilterLoading(loadingUpdate.nextLoading);
    }
  };

  setHolderSetMemo = (key: unknown, value: Set<string>): void => {
    setBoundedSbtHolderMemoEntry(this._holderSetMemo, key, value, HOLDER_SET_MEMO_MAX_ENTRIES);
  };

  scheduleApplyFilter = (reason: unknown = 'scheduled'): void => {
    this._lastScheduledApplyReason = String(reason || 'scheduled');
    if (this._applyFilterScheduled) return;
    this._applyFilterScheduled = true;
    scheduleMicrotask(() => {
      this._applyFilterScheduled = false;
      if (!this._isMounted) return;
      void this.runApplyFilter(this._lastScheduledApplyReason);
    });
  };

  runApplyFilter = async (reason: unknown = 'manual'): Promise<unknown> => {
    const previousActiveRunId = Number(this._activeApplyFilterRunId || 0);
    const runId = Number(this._applyFilterRunSeq || 0) + 1;
    this._applyFilterRunSeq = runId;
    this._activeApplyFilterRunId = runId;
    const result = await this.applyFilter(runId, reason);
    if (result === false && Number(this._activeApplyFilterRunId || 0) === runId) {
      this._activeApplyFilterRunId = previousActiveRunId;
    }
    return result;
  };

  applyFilter = async (runId: unknown, _reason: unknown = 'manual'): Promise<unknown> => {
    const effectiveRunId = runId != null
      ? Number(runId)
      : (Number(this._applyFilterRunSeq || 0) + 1);
    let newFilterSnapshot = '';
    if (runId == null) {
      this._applyFilterRunSeq = effectiveRunId;
      this._activeApplyFilterRunId = effectiveRunId;
    }
    try {
      const { items, mode, provider, network, isQuestionCacheReady, isSBTCacheReady } = this.props;
      const slug = this.props.sessionSlug || '';

      // Correct readiness gating per mode:
      // - SBT only: responder, questionResponses, addresses
      // - SBT + Questions: creator, creatorAndResponder, questions
      const isDataReady = isSbtFilterDataReady({
        mode,
        isSBTCacheReady,
        isQuestionCacheReady,
      });

      if (!isDataReady) {
        sbtLog.warn("SBTFilter: Waiting for necessary caches to be ready. Aborting filter.", {
          mode,
          isSBTCacheReady,
          isQuestionCacheReady
        });
        return;
      }

      const {
        selectedSBTGroupsCreator,
        excludedSBTGroupsCreator,
        selectedSBTGroupsResponder,
        excludedSBTGroupsResponder,
        selectedSBTGroups,
        excludedSBTGroups,
        onlyVerifiedHumans
      } = this.getLocalFilterState();

      const effectiveNetwork = this.getEffectiveNetwork();
      const networkID = String(
        getSessionChainId(slug) ||
        effectiveNetwork?.id ||
        effectiveNetwork?.chainId ||
        ''
      );
      sbtLog.log('Network ID used in SBTFilter:', networkID);

      const itemCount = getSbtFilterItemCount(items);
      const hasActiveFilter = this.hasAnyFilterActive();
      const shouldExpandMissingAddressItems = shouldExpandMissingAddressItemsForSbtFilter({
        mode,
        expandToSbtHolders: this.props.expandToSbtHolders,
        selectedSBTGroups,
      });
      const shouldPassThrough = shouldPassThroughSbtFilter({
        hasActiveFilter,
        items,
        shouldExpandMissingAddressItems,
      });
      const itemsSourceSignature = buildItemsSourceSignature(items);

      newFilterSnapshot = buildSbtFilterSnapshot({
        filterStateSignature: this.getLocalFilterStateSignature(),
        mode,
        itemCount,
        networkID,
        itemsSourceSignature,
        sbtCacheRevision: this.props.sbtCacheRevision,
        passive: shouldPassThrough,
      });
      if (this.state.lastAppliedFilterSnapshot === newFilterSnapshot) {
        // Means we already applied these exact filters; avoid re-render loops
        return false;
      }

      if (this.isLatestApplyRun(effectiveRunId)) {
        this.setState(buildSbtFilterLastAppliedSnapshotPatch({ snapshot: newFilterSnapshot }));
      }

      if (!networkID) {
        sbtLog.error('Network ID is undefined in SBTFilter. Cannot proceed.');
        if (this.props.onFilter) {
          this.props.onFilter(items || [], this.getLocalFilterState());
        }
        return;
      }

      if (shouldPassThrough) {
        // No items or no active filter => pass items straight through
        if (this.props.onFilter) {
          this.props.onFilter(items || [], this.getLocalFilterState());
        }
        return;
      }

      this.setFilterLoading(true);

      const allSbtEntries = buildSbtFilterSelectedEntryList({
        selectedSBTGroupsCreator,
        excludedSBTGroupsCreator,
        selectedSBTGroupsResponder,
        excludedSBTGroupsResponder,
        selectedSBTGroups,
        excludedSBTGroups,
      });

      const uniqueSbtEntries: Map<string, SbtFilterSelectedSbtEntry> = buildUniqueSbtEntries(allSbtEntries);

      const cacheBySlug: Map<string, UnknownRecord> = new Map();
      const writeSbtEntryForSlug = (
        slugForCache: unknown,
        netKeyForCache: unknown,
        sbtAddress: string,
        entryPatch: UnknownRecord = {}
      ): UnknownRecord | null => {
        const cacheKey = buildSbtFilterSbtCacheMemoKey(slugForCache);
        const rawCache = asCacheObject(readMemoizedSbtFilterSbtCacheBySlug({
          cacheBySlug,
          readSbtCacheBySlug: readSbtFilterSbtCacheBySlug,
          slugForCache,
        }));
        const nextCache = buildSbtFilterSbtEntryCachePatch({
          entryPatch,
          netKey: netKeyForCache,
          rawCache,
          sbtAddress,
        });
        if (!nextCache) return null;
        void writeCacheValue('sbtCache', String(slugForCache || ''), nextCache);
        cacheBySlug.set(cacheKey, nextCache);
        return nextCache;
      };

      // Build a map of SBT -> set of minted holders (minus burned)
      const sbtHoldersMap: Record<string, Set<string>> = {};
      for (const [sbtAddress, sbt] of uniqueSbtEntries.entries()) {
        const sbtSlug = resolveSbtFilterGroupSlug({
          fallbackSlug: slug,
          getSessionSlugByName,
          normalizeSessionSlug,
          sbtInput: sbt,
        });
        const chainId = resolveSbtFilterChainId({
          getSessionChainId,
          networkID,
          sbtInput: sbt,
          sbtSlug,
        });
        const netKey = String(chainId || networkID || '');
        if (!netKey) {
          sbtHoldersMap[sbtAddress] = new Set();
          continue;
        }

        const sbtNetCache = readMemoizedSbtFilterSbtNetBucketBySlug({
          cacheBySlug,
          netKeyForCache: netKey,
          readSbtCacheBySlug: readSbtFilterSbtCacheBySlug,
          slugForCache: sbtSlug,
        });
        const sbtListData = sbtNetCache.sbtList || {};
        const entry = sbtListData[sbtAddress] || {};
        const entrySbtInfo = asCacheObject(entry.sbtInfo);
        const sbtRecord = asCacheObject(sbt);
        const sbtInfoRecord = asCacheObject(sbtRecord.sbtInfo);
        const entryMinted = Array.isArray(entry.mintedAddresses) ? entry.mintedAddresses : null;
        const entryBurned = Array.isArray(entry.burnedAddresses) ? entry.burnedAddresses : null;
        const rawEntryMintedCounts = entry?.mintedCountByAddress;
        const rawEntryBurnedCounts = entry?.burnedCountByAddress;
        const entryMintedCountMap = normalizeAddressCountMap(rawEntryMintedCounts);
        const entryBurnedCountMap = normalizeAddressCountMap(rawEntryBurnedCounts);
        const {
          checkpointBackedPartialCounts,
          shouldUseEntryCountMaps,
        } = resolveSbtFilterEntryCountMapUsage({
          entry,
          entryBurned,
          entryBurnedCountMap,
          entryMinted,
          entryMintedCountMap,
          rawEntryBurnedCounts,
          rawEntryMintedCounts,
        });
        const entryMintedFingerprint = computeHolderListFingerprint(entryMinted);
        const entryBurnedFingerprint = computeHolderListFingerprint(entryBurned);
        const entryMintedCountFingerprint = countMapFingerprint(rawEntryMintedCounts);
        const entryBurnedCountFingerprint = countMapFingerprint(rawEntryBurnedCounts);
        const rawCreationBlock = resolveSbtFilterCreationBlock({
          entry,
          entrySbtInfo,
          sbtRecord,
          sbtInfoRecord,
        });
        const holderRevisionKey = buildSbtFilterHolderRevisionKey({
          sbtSlug,
          netKey,
          sbtAddress,
          sbtCacheRevision: this.props.sbtCacheRevision,
          countsLoaded: entry.countsLoaded === true,
          shouldUseEntryCountMaps,
          mintedCountFingerprint: entryMintedCountFingerprint,
          burnedCountFingerprint: entryBurnedCountFingerprint,
          mintedListFingerprint: entryMintedFingerprint,
          burnedListFingerprint: entryBurnedFingerprint,
          creationBlock: rawCreationBlock ?? '',
        });
        const memoizedHolders = this._holderSetMemo.get(holderRevisionKey);
        if (memoizedHolders) {
          sbtHoldersMap[sbtAddress] = memoizedHolders;
          continue;
        }

        if (shouldUseEntryCountMaps) {
          const holdersSet = measureSync('ce.sbtFilter.computeNetHolderSet', () =>
            buildNetHoldersSetFromCounts(entryMintedCountMap, entryBurnedCountMap)
          ) as Set<string>;
          this.setHolderSetMemo(holderRevisionKey, holdersSet);
          sbtHoldersMap[sbtAddress] = holdersSet;
          continue;
        }

        if (!checkpointBackedPartialCounts && entry.countsLoaded === true && entryMinted && entryBurned) {
          const holdersSet = measureSync('ce.sbtFilter.computeNetHolderSet', () =>
            buildNetHoldersSet(entryMinted, entryBurned)
          ) as Set<string>;
          this.setHolderSetMemo(holderRevisionKey, holdersSet);
          sbtHoldersMap[sbtAddress] = holdersSet;
          continue;
        }

        try {
          const fromBlock = resolveSbtFilterHolderScanFromBlock(rawCreationBlock);
          const requestKey = buildSbtFilterHolderRequestKey({
            sbtSlug,
            netKey,
            sbtAddress,
            fromBlock,
          });

          let inFlight = this._holderSetInFlight.get(requestKey);
          if (!inFlight) {
            inFlight = (async () => {
              const counts = await contractScriptsBoundary.getSbtMintBurnCountsByAddress('none', sbtAddress, fromBlock, 'latest', sbtSlug);
              if (counts?.ok === false) {
                throw new Error('SBT holder count scan failed');
              }
              return buildSbtFilterHolderFetchResult({
                counts,
                resolveHoldersSet: (mintedCountByAddress, burnedCountByAddress) => (
                  measureSync('ce.sbtFilter.computeNetHolderSet', () =>
                    buildNetHoldersSetFromCounts(mintedCountByAddress, burnedCountByAddress)
                  ) as Set<string>
                ),
              });
            })()
              .finally(() => {
                this._holderSetInFlight.delete(requestKey);
              });
            this._holderSetInFlight.set(requestKey, inFlight);
          }

          const fetched = await inFlight;
          if (!this.isLatestApplyRun(effectiveRunId)) return;
          const holdersSet = fetched?.holdersSet || new Set();
          sbtHoldersMap[sbtAddress] = holdersSet;

          writeSbtEntryForSlug(
            sbtSlug,
            netKey,
            sbtAddress,
            buildSbtFilterFetchedHolderCacheEntryPatch({ fetched })
          );
          const fetchedRevisionKey = buildSbtFilterFetchedHolderRevisionKey({
            sbtSlug,
            netKey,
            sbtAddress,
            sbtCacheRevision: this.props.sbtCacheRevision,
            fromBlock,
            fetched,
          });
          this.setHolderSetMemo(fetchedRevisionKey, holdersSet);
        } catch (error) {
          sbtLog.error('Error fetching SBT holders:', error);
          sbtHoldersMap[sbtAddress] = new Set();
        }
      }

      sbtLog.log('sbtHoldersMap:', sbtHoldersMap);
      if (!this.isLatestApplyRun(effectiveRunId)) return;

      const {
        selectedCreatorHolderSet,
        excludedCreatorHolderSet,
        selectedResponderHolderSet,
        excludedResponderHolderSet,
        selectedAddressHolderSet,
        excludedAddressHolderSet,
      } = buildSbtFilterHolderSelectionSets({
        selectedSBTGroupsCreator,
        excludedSBTGroupsCreator,
        selectedSBTGroupsResponder,
        excludedSBTGroupsResponder,
        selectedSBTGroups,
        excludedSBTGroups,
        sbtHoldersMap,
      });

      // Helper to check address vs. include/exclude sets
      const doesAddressPassFilters = (address: unknown, selectedSBTs: unknown, excludedSBTs: unknown): boolean => {
        return doesSbtFilterAddressPassSelection({
          address,
          excludedAddressHolderSet,
          excludedCreatorHolderSet,
          excludedResponderHolderSet,
          excludedSBTGroups,
          excludedSBTGroupsCreator,
          excludedSBTGroupsResponder,
          excludedSBTs,
          sbtHoldersMap,
          selectedAddressHolderSet,
          selectedCreatorHolderSet,
          selectedResponderHolderSet,
          selectedSBTGroups,
          selectedSBTGroupsCreator,
          selectedSBTGroupsResponder,
          selectedSBTs,
        });
      };

      const emptyResponderShortCircuit = resolveSbtFilterEmptyResponderShortCircuit({
        items,
        mode,
        selectedResponderHolderSet,
        selectedSBTGroupsResponder,
      });
      if (emptyResponderShortCircuit.shouldShortCircuit) {
        if (emptyResponderShortCircuit.logMessage) {
          sbtLog.log(emptyResponderShortCircuit.logMessage);
        }
        if (this.props.onFilter) {
          this.props.onFilter(emptyResponderShortCircuit.result, this.getLocalFilterState());
        }
        return;
      }

      // Creator and responder mode
      if (mode === 'creatorAndResponder') {
        if (!items) {
          sbtLog.warn('creatorAndResponder mode: no items supplied');
          if (this.props.onFilter) {
            this.props.onFilter([], this.getLocalFilterState());
          }
          return;
        }

        if (Array.isArray(items)) {
          const filteredQuestions: unknown[] = [];
          const filteredResponsesByQuestion: SbtFilterResponseByQuestion = {};

          const networkIDLocal = String(networkID);
          const questionNetCache = readSbtFilterQuestionsNetBucketBySlug(slug, networkIDLocal);

          for (const questionObj of items) {
            const questionRecord = asCacheObject(questionObj);
            if (
              doesAddressPassFilters(
                questionRecord.creator,
                selectedSBTGroupsCreator,
                excludedSBTGroupsCreator
              )
            ) {
              filteredQuestions.push(questionObj);
            }
          }

          // Build question->responses from cache
          for (const qObj of filteredQuestions) {
            const qID = String(asCacheObject(qObj).id || '').toLowerCase();
            const qResponses: SbtFilterResponseEntry[] = [];
            const responseMap = getCachedSbtFilterQuestionResponseMap(questionNetCache, qID);
            if (Object.keys(responseMap).length > 0) {
              const addresses = Object.keys(responseMap);
              for (const addr of addresses) {
                const responseData = responseMap[addr];
                qResponses.push({
                  responder: addr,
                  questionId: qID,
                  response: responseData
                });
              }
            }

          const finalFilteredResponses: SbtFilterResponseEntry[] = [];
          for (const resp of qResponses) {
            if (
              doesAddressPassFilters(
                resp.responder,
                selectedSBTGroupsResponder,
                excludedSBTGroupsResponder
              )
            ) {
              finalFilteredResponses.push(resp);
            }
          }
          filteredResponsesByQuestion[qID] = finalFilteredResponses;
          }

          if (onlyVerifiedHumans) {
            // future hook
          }

          if (this.props.onFilterCreators) {
            this.props.onFilterCreators(filteredQuestions, this.getLocalFilterState());
          }
          if (this.props.onFilterResponders) {
            this.props.onFilterResponders(
              filteredResponsesByQuestion,
              this.getLocalFilterState()
            );
          }

          if (this.props.onFilter) {
            const combinedResult = {
              filteredQuestions,
              filteredResponsesByQuestion
            };
            this.props.onFilter(combinedResult, this.getLocalFilterState());
          }
          return;
        }
        // Aggregator-object version
        else if (typeof items === 'object' && items !== null) {
          const unifiedAgg = unifySbtFilterAggregatorWithAllLocalQuestions(
            items,
            networkID,
            'creatorAndResponder',
            slug
          ) as Record<string, SbtFilterResponseEntry[]>;

          const finalAggregator: SbtFilterResponseByQuestion = {};
          const questionNetCache = readSbtFilterQuestionsNetBucketBySlug(slug, networkID);

          const filteredQuestions: SbtFilterQuestionEntry[] = [];

          for (const qId of Object.keys(unifiedAgg)) {
            const rawArray = unifiedAgg[qId] || [];
            const cachedQuestion = getCachedSbtFilterQuestionEntry(questionNetCache, qId);
            let questionCreator: unknown = cachedQuestion?.creator || null;
            let keepThisQuestion = true;
            if (questionCreator) {
              keepThisQuestion = doesAddressPassFilters(
                questionCreator,
                selectedSBTGroupsCreator,
                excludedSBTGroupsCreator
              );
            }
            if (!keepThisQuestion) {
              continue;
            }
            if (cachedQuestion) {
              filteredQuestions.push(cachedQuestion);
            }

            const keptEntries = normalizeAggregatorResponseEntries(rawArray).filter((entryObj) => {
              if (
                entryObj.responder &&
                !doesAddressPassFilters(
                  entryObj.responder,
                  selectedSBTGroupsResponder,
                  excludedSBTGroupsResponder
                )
              ) {
                return false;
              }
              return true;
            });
            if (keptEntries.length > 0) {
              finalAggregator[qId] = keptEntries;
            }
          }

          if (onlyVerifiedHumans) {
            // future hook
          }

          if (this.props.onFilterCreators) {
            this.props.onFilterCreators(filteredQuestions, this.getLocalFilterState());
          }
          if (this.props.onFilterResponders) {
            const byQuestion: SbtFilterResponseByQuestion = {};
            for (const qId of Object.keys(finalAggregator)) {
              byQuestion[qId] = finalAggregator[qId];
            }
            this.props.onFilterResponders(byQuestion, this.getLocalFilterState());
          }

          if (this.props.onFilter) {
            this.props.onFilter(finalAggregator, this.getLocalFilterState());
          }

          return;
        } else {
          sbtLog.warn(
            'creatorAndResponder mode: expected array or aggregator object, got something else.'
          );
          if (this.props.onFilter) {
            this.props.onFilter([], this.getLocalFilterState());
          }
          return;
        }
      }
      // Single-filter aggregator logic
      else if (
        (mode === 'creator' ||
          mode === 'responder' ||
          mode === 'questions' ||
          mode === 'questionResponses') &&
        typeof items === 'object' &&
        items !== null &&
        !Array.isArray(items)
      ) {
        const unifiedAgg = unifySbtFilterAggregatorWithAllLocalQuestions(
          items,
          networkID,
          mode,
          slug
        ) as Record<string, unknown>;

        const finalAggregator: SbtFilterResponseByQuestion = {};
        const questionNetCache = readSbtFilterQuestionsNetBucketBySlug(slug, networkID);

        const filteredQuestions: SbtFilterQuestionEntry[] = [];

        for (const qId of Object.keys(unifiedAgg)) {
          const rawVal = unifiedAgg[qId];
          const rawArray = normalizeAggregatorResponseEntries(rawVal);

          // For "creator" or "questions" modes, check question creator
          let keepThisQuestion = true;
          if (mode === 'creator' || mode === 'questions') {
            const cachedQuestion = getCachedSbtFilterQuestionEntry(questionNetCache, qId);
            let questionCreator: unknown = cachedQuestion?.creator || null;
            if (questionCreator) {
              keepThisQuestion = doesAddressPassFilters(
                questionCreator,
                selectedSBTGroupsCreator,
                excludedSBTGroupsCreator
              );
            }
          }
          if (!keepThisQuestion) {
            continue;
          }

          if (
            (mode === 'creator' || mode === 'questions') &&
            getCachedSbtFilterQuestionEntry(questionNetCache, qId)
          ) {
            filteredQuestions.push(getCachedSbtFilterQuestionEntry(questionNetCache, qId) as SbtFilterQuestionEntry);
          }

          // For "responder" or "questionResponses", filter the array by entryObj.responder
          let keptEntries = rawArray;
          if (mode === 'responder' || mode === 'questionResponses') {
            keptEntries = rawArray.filter((entryObj) => {
              if (
                entryObj.responder &&
                !doesAddressPassFilters(
                  entryObj.responder,
                  selectedSBTGroupsResponder,
                  excludedSBTGroupsResponder
                )
              ) {
                return false;
              }
              return true;
            });
          }

          if (keptEntries.length > 0) {
            finalAggregator[qId] = keptEntries;
          }
        }

        if (onlyVerifiedHumans) {
          // future hook
        }

        if ((mode === 'creator' || mode === 'questions') && this.props.onFilterCreators) {
          this.props.onFilterCreators(filteredQuestions, this.getLocalFilterState());
        }
        if ((mode === 'responder' || mode === 'questionResponses') && this.props.onFilterResponders) {
          const byQuestion: SbtFilterResponseByQuestion = {};
          for (const qId of Object.keys(finalAggregator)) {
            byQuestion[qId] = finalAggregator[qId];
          }
          this.props.onFilterResponders(byQuestion, this.getLocalFilterState());
        }

        if (this.props.onFilter) {
          this.props.onFilter(finalAggregator, this.getLocalFilterState());
        }

        return;
      }
      // Default: array filtering or other object
      else {
        const shouldExpandAddresses =
          mode === 'addresses' &&
          this.props.expandToSbtHolders === true &&
          selectedSBTGroups.length > 0;

        if (!items && !shouldExpandAddresses) {
          sbtLog.warn(`No items supplied for mode="${mode}".`);
          if (this.props.onFilter) {
            this.props.onFilter([], this.getLocalFilterState());
          }
          return;
        }

        const itemsToFilter = resolveSbtFilterAddressItemsToFilter({
          items,
          selectedAddressHolderSet,
          shouldExpandAddresses,
        });

        const filterItem = (item: unknown): boolean => {
          if (!item) return false;

          if (mode === 'addresses') {
            const addressDecision = resolveSbtFilterAddressItemDecision({
              excludedAddressHolderSet,
              hasSelectedGroups: selectedSBTGroups.length > 0,
              item,
              selectedAddressHolderSet,
            });
            if (addressDecision.shouldLogInvalidType) {
              sbtLog.error('Expected item to be a string in addresses mode, but got:', item);
              return false;
            }
            if (!addressDecision.passes) {
              return false;
            }
            if (onlyVerifiedHumans) {
              // future hook
            }
            return true;
          } else {
            // question-based item or aggregator sub-item
            const {
              creator: addressToCheckCreator,
              responder: addressToCheckResponder,
            } = resolveSbtFilterItemParticipantAddresses(item);

            if (mode === 'creator' || mode === 'questions') {
              if (addressToCheckCreator) {
                if (
                  !doesAddressPassFilters(
                    addressToCheckCreator,
                    selectedSBTGroupsCreator,
                    excludedSBTGroupsCreator
                  )
                ) {
                  return false;
                }
              }
            }
            if (mode === 'responder' || mode === 'questionResponses') {
              if (addressToCheckResponder) {
                if (
                  !doesAddressPassFilters(
                    addressToCheckResponder,
                    selectedSBTGroupsResponder,
                    excludedSBTGroupsResponder
                  )
                ) {
                  return false;
                }
              }
            }
            if (onlyVerifiedHumans && (addressToCheckCreator || addressToCheckResponder)) {
              // future hook
            }
            return true;
          }
        };

        let filteredResult: unknown;
        if (Array.isArray(itemsToFilter)) {
          filteredResult = measureSync('ce.sbtFilter.filter.array', () =>
            itemsToFilter.filter(filterItem)
          );
        } else if (typeof items === 'object') {
          filteredResult = measureSync('ce.sbtFilter.filter.object', () => {
            return filterSbtFilterObjectItems(items, filterItem);
          });
        } else {
          // Unexpected type
          sbtLog.warn('SBTFilter: unsupported items type:', typeof items);
          filteredResult = items;
        }

        sbtLog.log('Filtered items:', filteredResult);

        if (this.props.onFilter) {
          this.props.onFilter(filteredResult, this.getLocalFilterState());
        }
      }
    } finally {
      if (this.isLatestApplyRun(effectiveRunId)) {
        this.setFilterLoading(false);
      }
    }
  };

  // Handlers for adding/removing SBT “include” or “exclude”
  addSbtSelection = (stateKey: SbtFilterSelectionListKey, sbtObject: SbtFilterSbtOption): void => {
    const address = readSbtOptionAddress(sbtObject);
    if (shouldAppendSbtFilterSelection({ address, state: this.state, stateKey })) {
      this.setState((prev: Readonly<SbtFilterState>) => buildSbtFilterSelectionAddPatch({
        sbtObject,
        state: prev,
        stateKey,
      }));
    }
  };

  removeSbtSelection = (stateKey: SbtFilterSelectionListKey, address: unknown): void => {
    this.setState((prev: Readonly<SbtFilterState>) => buildSbtFilterSelectionRemovePatch({
      address,
      state: prev,
      stateKey,
    }));
  };

  handleAddSBTIncludeCreator = (sbtObject: SbtFilterSbtOption): void => {
    this.addSbtSelection('selectedSBTGroupsCreator', sbtObject);
  };
  handleRemoveSBTIncludeCreator = (address: unknown): void => {
    this.removeSbtSelection('selectedSBTGroupsCreator', address);
  };

  handleAddSBTExcludeCreator = (sbtObject: SbtFilterSbtOption): void => {
    this.addSbtSelection('excludedSBTGroupsCreator', sbtObject);
  };
  handleRemoveSBTExcludeCreator = (address: unknown): void => {
    this.removeSbtSelection('excludedSBTGroupsCreator', address);
  };

  handleAddSBTIncludeResponder = (sbtObject: SbtFilterSbtOption): void => {
    this.addSbtSelection('selectedSBTGroupsResponder', sbtObject);
  };
  handleRemoveSBTIncludeResponder = (address: unknown): void => {
    this.removeSbtSelection('selectedSBTGroupsResponder', address);
  };

  handleAddSBTExcludeResponder = (sbtObject: SbtFilterSbtOption): void => {
    this.addSbtSelection('excludedSBTGroupsResponder', sbtObject);
  };
  handleRemoveSBTExcludeResponder = (address: unknown): void => {
    this.removeSbtSelection('excludedSBTGroupsResponder', address);
  };

  handleAddSBTInclude = (sbtObject: SbtFilterSbtOption): void => {
    this.addSbtSelection('selectedSBTGroups', sbtObject);
  };
  handleRemoveSBTInclude = (address: unknown): void => {
    this.removeSbtSelection('selectedSBTGroups', address);
  };

  handleAddSBTExclude = (sbtObject: SbtFilterSbtOption): void => {
    this.addSbtSelection('excludedSBTGroups', sbtObject);
  };
  handleRemoveSBTExclude = (address: unknown): void => {
    this.removeSbtSelection('excludedSBTGroups', address);
  };

  toggleVerifiedHumans = (): void => {
    this.setState((prev: Readonly<SbtFilterState>) => buildSbtFilterBooleanTogglePatch({
      state: prev,
      stateKey: 'onlyVerifiedHumans',
    }));
  };

  toggleFilterOptions = (): void => {
    this.setState((prev: Readonly<SbtFilterState>) => buildSbtFilterBooleanTogglePatch({
      state: prev,
      stateKey: 'showFilterOptions',
    }));
  };

  toggleShowAllSBTs = (): void => {
    this.setState((prevState: Readonly<SbtFilterState>) => buildSbtFilterBooleanTogglePatch({
      state: prevState,
      stateKey: 'showAllSBTs',
    }));
    // No need to call applyFilter here, as this only affects the options in the dropdown
  }

  renderQuickSelectChips = (
    selectedSBTs: unknown,
    onAddHandler: (sbtObject: SbtFilterQuickSbtOption) => void,
    filterKey: SbtFilterQuickChipKey
  ): React.ReactNode => {
    const { defaultFeaturedSBTs, sessionSlug } = this.props;
    if (!hasSbtFilterFeaturedOptions(defaultFeaturedSBTs)) {
      return null;
    }

    const selectedSet = buildSbtFilterQuickChipSelectedAddressSet(selectedSBTs);

    return (
      <div className={styles.quickSelectRow}>
        {defaultFeaturedSBTs.map((featuredAddress, index) => {
          const address = String(featuredAddress || '').trim();
          if (!address) return null;

          const {
            chipLabel,
            isDisabled,
            isSelected,
            key,
            shouldUseSelectedClass,
            style,
            testId,
          } = buildSbtFilterQuickChipDisplayState({
            address,
            filterKey,
            gateColors: QUICK_CHIP_GATE_COLORS,
            index,
            resolveDisplayLabel: resolveSbtDisplayLabel,
            selectedSet,
            sessionSlug,
          });

          return (
            <button
              key={key}
              type="button"
              className={buildSbtFilterQuickChipClassName({
                baseClassName: styles.quickChip,
                selectedClassName: styles.quickChipSelected,
                shouldUseSelectedClass,
              })}
              style={style}
              onClick={() => {
                if (isSelected) return;
                onAddHandler({ address });
              }}
              disabled={isDisabled}
              data-testid={testId}
              aria-disabled={isDisabled}
            >
              {chipLabel}
            </button>
          );
        })}
      </div>
    );
  };

  render() {
    const effectiveNetwork = this.getEffectiveNetwork();
    const {
      showFilterOptions,
      selectedSBTGroupsCreator,
      excludedSBTGroupsCreator,
      selectedSBTGroupsResponder,
      excludedSBTGroupsResponder,
      selectedSBTGroups,
      excludedSBTGroups,
      loading,
      showAllSBTs
    } = this.state;

    // Receive defaultFeaturedSBTs prop
    const { mode, hideUI, defaultFeaturedSBTs } = this.props;

    // Determine if the featured SBTs prop is valid
    const hasFeaturedSBTs = hasSbtFilterFeaturedOptions(defaultFeaturedSBTs);
    const buttonText = resolveSbtFilterButtonText({ mode });
    const panelDisplayState = resolveSbtFilterPanelDisplayState({
      autoExpand: this.props.autoExpand,
      hasFeaturedSBTs,
      hideUI,
    });
    const filterOptionsVisibilityState = resolveSbtFilterOptionsVisibilityState({
      autoExpand: this.props.autoExpand,
      hideLoadingOverlay: this.props.hideLoadingOverlay,
      loading,
      showFilterOptions,
    });
    const modeSectionsState = resolveSbtFilterModeSectionsState({ mode });
    const surfaceDisplayState = resolveSbtFilterSurfaceDisplayState({
      buttonSurface: this.props.buttonSurface,
    });
    const surfaceClassNames = buildSbtFilterSurfaceClassNames({
      filterButtonLightClassName: styles.filterButtonOnLight,
      filterOptionsBaseClassName: styles.filterOptions,
      filterOptionsLightClassName: styles.filterOptionsOnLight,
      shouldUseLightSurface: surfaceDisplayState.shouldUseLightSurface,
    });
    const layoutDisplayState = resolveSbtFilterLayoutDisplayState();
    const sbtSelectorWarmStartProps = {
      activeSessionSlug: this.props.activeSessionSlug,
      sessionSlug: this.props.sessionSlug,
      sessionConfig: this.props.sessionConfig,
      ensureLightSbtUniverse: this.props.ensureLightSbtUniverse,
    };

    if (panelDisplayState.shouldRenderHiddenRoot) {
      return <div style={layoutDisplayState.hiddenRootStyle} />;
    }

    return (
      <div className={styles.sbtFilter}>
        {/* If not autoExpand, show a settings/cog button to toggle filter options */}
        {panelDisplayState.shouldRenderFilterToggleButton && (
          <Button
            onClick={this.toggleFilterOptions}
            className={[
              styles.filterButton,
              surfaceClassNames.filterButtonClassName,
            ].filter(Boolean).join(' ')}
          >
            {buttonText} <FontAwesomeIcon icon={faFilter} className={styles.filterButtonIcon} />
          </Button>
        )}

        {/* If autoExpand is true, or the user toggled showFilterOptions, display the filter UI */}
        {filterOptionsVisibilityState.shouldRenderFilterOptions && (
          <div style={layoutDisplayState.filterOptionsFrameStyle}>
            {filterOptionsVisibilityState.shouldRenderLoadingOverlay && (
              <div style={layoutDisplayState.loadingOverlayStyle}>
                <FontAwesomeIcon icon={faSpinner} spin size="2x" color="white" />
              </div>
            )}
            <div
              className={surfaceClassNames.filterOptionsClassName}
            >

              {/* Conditionally render the "Show All" checkbox */}
              {panelDisplayState.shouldRenderShowAllCheckbox && (
                <FormGroup check className={styles.showAllCheckbox}>
                  <Label check>
                    <Input
                      type="checkbox"
                      checked={showAllSBTs}
                      onChange={this.toggleShowAllSBTs}
                    />{' '}
                    Show All SBTs
                  </Label>
                </FormGroup>
              )}


              {/* Mode: 'responder' => filter by SBT group(s) of Survey Responder */}
      {modeSectionsState.shouldRenderResponderFilter && (
                <>
                  <h5>SBT Group(s) of Survey Responder</h5>
                  <SBTSelector
                    id="includeResponder"
                    network={effectiveNetwork}
                    provider={this.props.provider}
                    onAddSBT={this.handleAddSBTIncludeResponder}
                    onRemoveSBT={this.handleRemoveSBTIncludeResponder}
                    selectedSBTs={selectedSBTGroupsResponder}
                    {...sbtSelectorWarmStartProps}
                    label={'Include Responses from SBT Holders'}
                    defaultFeaturedSBTs={defaultFeaturedSBTs}
                    showAllSBTs={showAllSBTs}
                    sbtCacheRevision={this.props.sbtCacheRevision}
                  />
                  {hasFeaturedSBTs && this.renderQuickSelectChips(
                    selectedSBTGroupsResponder,
                    this.handleAddSBTIncludeResponder,
                    'ir'
                  )}

                  <SBTSelector
                    id="excludeResponder"
                    network={effectiveNetwork}
                    provider={this.props.provider}
                    onAddSBT={this.handleAddSBTExcludeResponder}
                    onRemoveSBT={this.handleRemoveSBTExcludeResponder}
                    selectedSBTs={excludedSBTGroupsResponder}
                    {...sbtSelectorWarmStartProps}
                    label={'Exclude Responses from SBT Holders'}
                    defaultFeaturedSBTs={defaultFeaturedSBTs}
                    showAllSBTs={showAllSBTs}
                    sbtCacheRevision={this.props.sbtCacheRevision}
                  />
                  {hasFeaturedSBTs && this.renderQuickSelectChips(
                    excludedSBTGroupsResponder,
                    this.handleAddSBTExcludeResponder,
                    'er'
                  )}

                </>
              )}

              {/* Mode: 'addresses' => filter addresses by SBT group(s) */}
              {modeSectionsState.shouldRenderAddressFilter && (
                <>
                  <SBTSelector
                    id="includeAddresses"
                    network={effectiveNetwork}
                    provider={this.props.provider}
                    onAddSBT={this.handleAddSBTInclude}
                    onRemoveSBT={this.handleRemoveSBTInclude}
                    selectedSBTs={selectedSBTGroups}
                    {...sbtSelectorWarmStartProps}
                    label={'Include Addresses holding SBT'}
                    defaultFeaturedSBTs={defaultFeaturedSBTs}
                    showAllSBTs={showAllSBTs}
                    sbtCacheRevision={this.props.sbtCacheRevision}
                  />
                  {hasFeaturedSBTs && this.renderQuickSelectChips(
                    selectedSBTGroups,
                    this.handleAddSBTInclude,
                    'ia'
                  )}

                  <SBTSelector
                    id="excludeAddresses"
                    network={effectiveNetwork}
                    provider={this.props.provider}
                    onAddSBT={this.handleAddSBTExclude}
                    onRemoveSBT={this.handleRemoveSBTExclude}
                    selectedSBTs={excludedSBTGroups}
                    {...sbtSelectorWarmStartProps}
                    label={'Exclude Addresses holding SBT'}
                    defaultFeaturedSBTs={defaultFeaturedSBTs}
                    showAllSBTs={showAllSBTs}
                    sbtCacheRevision={this.props.sbtCacheRevision}
                  />
                  {hasFeaturedSBTs && this.renderQuickSelectChips(
                    excludedSBTGroups,
                    this.handleAddSBTExclude,
                    'ea'
                  )}
                </>
              )}

              {/* Mode: 'creator', 'creatorAndResponder', 'questions', or 'questionResponses' => question-based filtering */}
              {modeSectionsState.shouldRenderQuestionFilter && (
                <>
                  {/* If creator-based filtering is relevant */}
                  {modeSectionsState.shouldRenderQuestionCreatorFilter && (
                    <>
                      <SBTSelector
                        id="includeCreator"
                        network={effectiveNetwork}
                        provider={this.props.provider}
                        onAddSBT={this.handleAddSBTIncludeCreator}
                        onRemoveSBT={this.handleRemoveSBTIncludeCreator}
                        selectedSBTs={selectedSBTGroupsCreator}
                        {...sbtSelectorWarmStartProps}
                        label={'Include Questions created by SBT Holders'}
                        defaultFeaturedSBTs={defaultFeaturedSBTs} // Pass prop
                        showAllSBTs={showAllSBTs} // Pass state
                        sbtCacheRevision={this.props.sbtCacheRevision}
                      />
                      {hasFeaturedSBTs && this.renderQuickSelectChips(
                        selectedSBTGroupsCreator,
                        this.handleAddSBTIncludeCreator,
                        'ic'
                      )}

                      <SBTSelector
                        id="excludeCreator"
                        network={effectiveNetwork}
                        provider={this.props.provider}
                        onAddSBT={this.handleAddSBTExcludeCreator}
                        onRemoveSBT={this.handleRemoveSBTExcludeCreator}
                        selectedSBTs={excludedSBTGroupsCreator}
                        {...sbtSelectorWarmStartProps}
                        label={'Exclude Questions created by SBT Holders'}
                        defaultFeaturedSBTs={defaultFeaturedSBTs} // Pass prop
                        showAllSBTs={showAllSBTs} // Pass state
                        sbtCacheRevision={this.props.sbtCacheRevision}
                      />
                      {hasFeaturedSBTs && this.renderQuickSelectChips(
                        excludedSBTGroupsCreator,
                        this.handleAddSBTExcludeCreator,
                        'ec'
                      )}
                    </>
                  )}

                  {/* If responder-based filtering is relevant */}
                  {modeSectionsState.shouldRenderQuestionResponderFilter && (
                    <>
                      <h5>SBT Group(s) of Question Responder</h5>
                      <SBTSelector
                        id="includeResponder2"
                        network={effectiveNetwork}
                        provider={this.props.provider}
                        onAddSBT={this.handleAddSBTIncludeResponder}
                        onRemoveSBT={this.handleRemoveSBTIncludeResponder}
                        selectedSBTs={selectedSBTGroupsResponder}
                        {...sbtSelectorWarmStartProps}
                        label={'Include Responses from SBT Holders'}
                        defaultFeaturedSBTs={defaultFeaturedSBTs} // Pass prop
                        showAllSBTs={showAllSBTs} // Pass state
                        sbtCacheRevision={this.props.sbtCacheRevision}
                      />
                      {hasFeaturedSBTs && this.renderQuickSelectChips(
                        selectedSBTGroupsResponder,
                        this.handleAddSBTIncludeResponder,
                        'ir2'
                      )}

                      <SBTSelector
                        id="excludeResponder2"
                        network={effectiveNetwork}
                        provider={this.props.provider}
                        onAddSBT={this.handleAddSBTExcludeResponder}
                        onRemoveSBT={this.handleRemoveSBTExcludeResponder}
                        selectedSBTs={excludedSBTGroupsResponder}
                        {...sbtSelectorWarmStartProps}
                        label={'Exclude Responses from SBT Holders'}
                        defaultFeaturedSBTs={defaultFeaturedSBTs} // Pass prop
                        showAllSBTs={showAllSBTs} // Pass state
                        sbtCacheRevision={this.props.sbtCacheRevision}
                      />
                      {hasFeaturedSBTs && this.renderQuickSelectChips(
                        excludedSBTGroupsResponder,
                        this.handleAddSBTExcludeResponder,
                        'er2'
                      )}

                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default SBTFilter;
