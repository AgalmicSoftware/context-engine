import { sanitizeSbtPageMintedTokensOverride } from './sbtPageAutoMintHelpers';
import {
  hasUsableSbtPageScanProgress,
  isActiveSbtPageScanProgress,
  resolveSbtPageRemainingBlocksCount,
  resolveSbtPageScanProgressDisplay,
  resolveSbtPageScanProgressFillStyle,
  resolveSbtPageScanProgressPercent,
  shouldShowSbtPageScanProgress,
  type SbtPageScanProgressRecord,
} from './sbtPageScanProgressHelpers';

export type ResolveSbtPageHolderLoadingStateArgs = {
  countsLoaded?: unknown;
  hasComputedHolders?: unknown;
  hasFilteredHolders?: unknown;
  isScanActive?: unknown;
  loadingMintersBurners?: unknown;
  loadingMintedFilter?: unknown;
  mintedTokensOverride?: unknown;
  netHoldersCount?: unknown;
  sbtScanInProgress?: unknown;
  sbtScanPending?: unknown;
};
export type ResolveSbtPageHolderResolutionStateArgs = {
  isRefreshing?: unknown;
  loadingMintersBurners?: unknown;
  loadingMintedFilter?: unknown;
  mintedAddresses?: unknown[];
  mintedTokensOverride?: unknown;
  showScanProgress?: unknown;
};
export type ResolveSbtPageHoldersDisplayCountArgs = {
  mintedTokensOverride?: unknown;
  netHoldersCount?: unknown;
  shouldOverrideMinted?: unknown;
};
export type ResolveSbtPageHolderFilterItemsArgs = {
  filteredMintedUsers?: unknown;
  hasComputedHolders?: unknown;
  hasFilteredHolders?: unknown;
  isScanActive?: unknown;
  netHolders?: unknown;
};
export type ResolveSbtPageHolderModalDisplayStateArgs = {
  addressesAreResolving?: unknown;
  hasActiveScanProgress?: unknown;
  hasComputedHolders?: unknown;
  hasFilteredHolders?: unknown;
  holdersReady?: unknown;
  isInitialLoading?: unknown;
  isRefreshing?: unknown;
  isScanActive?: unknown;
  loadingMintersBurners?: unknown;
  loadingMintedFilter?: unknown;
  shouldOverrideMinted?: unknown;
  showModal?: unknown;
  showScanProgress?: unknown;
};
export type ResolveSbtPageHolderDisplayModelArgs = {
  countsLoaded?: unknown;
  filteredMintedUsers?: unknown;
  isScanActive?: unknown;
  loadingMintersBurners?: unknown;
  loadingMintedFilter?: unknown;
  mintedAddresses?: unknown;
  mintedTokensOverride?: unknown;
  netHolders?: unknown;
  scanProgress?: SbtPageScanProgressRecord | null;
  sbtScanInProgress?: unknown;
  sbtScanPending?: unknown;
  showModal?: unknown;
  resolveScanProgressSessionLabel?: ((progress: SbtPageScanProgressRecord | null) => unknown) | null;
};
export type SbtPageHolderLoadingState = {
  countsReady: boolean;
  effectiveLoading: boolean;
  holdersReady: boolean;
  isGlobalLoading: boolean;
  isLocalLoading: boolean;
  netMinted: string;
  shouldOverrideMinted: boolean;
  terminalEmptyHoldersState: boolean;
};
export type SbtPageHolderResolutionState = {
  addressesAreResolving: boolean;
  addressesNeedResolutionHint: boolean;
};
export type SbtPageHolderFilterItems = {
  filteredMintedUsers: unknown[];
  holderItemsForFilter: unknown[];
  keepStaleFilterRowsWhileRefreshing: boolean;
};
export type SbtPageHolderModalDisplayState = {
  mintedCountTitle?: string;
  showApproximateCountHint: boolean;
  showCornerSpinner: boolean;
  showEmptyStateInModal: boolean;
  showHeaderCount: boolean;
  showScanProgressInModal: boolean;
  showSpinnerInModalBody: boolean;
  waitingForHolderDetails: boolean;
};
export type SbtPageHolderDisplayModel = SbtPageHolderLoadingState &
  SbtPageHolderResolutionState &
  SbtPageHolderFilterItems &
  SbtPageHolderModalDisplayState & {
    hasActiveScanProgress: boolean;
    hasComputedHolders: boolean;
    hasFilteredHolders: boolean;
    hasScanProgress: boolean;
    holdersDisplayCount: string;
    isInitialLoading: boolean;
    isRefreshing: boolean;
    mintedTokensOverride: string | null;
    rawRemainingBlocksCount: number;
    remainingBlocksCount: number;
    scanProgressFillStyle: Record<string, string>;
    scanProgressPct: number;
    scanProgressSessionText: string | null;
    scanProgressText: string | null;
    showScanProgress: boolean;
    showScanProgressInModal: boolean;
  };

export const resolveSbtPageHolderLoadingState = ({
  countsLoaded = false,
  hasComputedHolders = false,
  hasFilteredHolders = false,
  isScanActive = false,
  loadingMintersBurners = false,
  loadingMintedFilter = false,
  mintedTokensOverride = null,
  netHoldersCount = 0,
  sbtScanInProgress = false,
  sbtScanPending = false,
}: ResolveSbtPageHolderLoadingStateArgs = {}): SbtPageHolderLoadingState => {
  const hasComputed = !!hasComputedHolders;
  const hasFiltered = !!hasFilteredHolders;
  const terminalEmptyHoldersState =
    !loadingMintersBurners &&
    !loadingMintedFilter &&
    !isScanActive &&
    mintedTokensOverride == null &&
    !hasComputed &&
    !hasFiltered;
  const holdersReady = countsLoaded === true || hasComputed || hasFiltered || terminalEmptyHoldersState;
  const holderCount = Number(netHoldersCount || 0);
  const shouldOverrideMinted = mintedTokensOverride != null && (!countsLoaded || holderCount === 0);
  const netMinted = shouldOverrideMinted ? String(mintedTokensOverride) : String(holderCount);
  const countsReady = countsLoaded === true || mintedTokensOverride != null || terminalEmptyHoldersState;
  const isGlobalLoading = !!sbtScanInProgress || (!!sbtScanPending && !countsReady);
  const isLocalLoading = !!loadingMintersBurners || !countsReady;
  const effectiveLoading = isLocalLoading || isGlobalLoading;
  return {
    countsReady,
    effectiveLoading,
    holdersReady,
    isGlobalLoading,
    isLocalLoading,
    netMinted,
    shouldOverrideMinted,
    terminalEmptyHoldersState,
  };
};

export const resolveSbtPageHolderResolutionState = ({
  isRefreshing = false,
  loadingMintersBurners = false,
  loadingMintedFilter = false,
  mintedAddresses = [],
  mintedTokensOverride = null,
  showScanProgress = false,
}: ResolveSbtPageHolderResolutionStateArgs = {}): SbtPageHolderResolutionState => {
  const addressesNeedResolutionHint =
    mintedTokensOverride != null && Number(mintedTokensOverride) > 0 && mintedAddresses.length === 0;
  const addressesAreResolving =
    addressesNeedResolutionHint &&
    (!!loadingMintersBurners || !!loadingMintedFilter || !!isRefreshing || !!showScanProgress);
  return { addressesAreResolving, addressesNeedResolutionHint };
};

export const resolveSbtPageHoldersDisplayCount = ({
  mintedTokensOverride = null,
  netHoldersCount = 0,
  shouldOverrideMinted = false,
}: ResolveSbtPageHoldersDisplayCountArgs = {}): string =>
  shouldOverrideMinted ? `~${mintedTokensOverride}` : String(netHoldersCount || 0);

export const resolveSbtPageHolderFilterItems = ({
  filteredMintedUsers: filteredMintedUsersRaw = [],
  hasComputedHolders = false,
  hasFilteredHolders = false,
  isScanActive = false,
  netHolders = [],
}: ResolveSbtPageHolderFilterItemsArgs = {}): SbtPageHolderFilterItems => {
  const keepStaleFilterRowsWhileRefreshing = !!hasFilteredHolders && !hasComputedHolders && !!isScanActive;
  const rawHolderItemsForFilter = hasComputedHolders
    ? netHolders
    : keepStaleFilterRowsWhileRefreshing
      ? filteredMintedUsersRaw
      : [];
  const holderItemsForFilter = Array.isArray(rawHolderItemsForFilter) ? rawHolderItemsForFilter : [];
  const filteredMintedUsers = Array.isArray(filteredMintedUsersRaw) ? filteredMintedUsersRaw : [];
  return {
    filteredMintedUsers,
    holderItemsForFilter,
    keepStaleFilterRowsWhileRefreshing,
  };
};

const SBT_PAGE_MINTED_COUNT_ESTIMATE_TITLE = 'Holder list not loaded yet; showing an on-chain holder count estimate.';

export const resolveSbtPageHolderModalDisplayState = ({
  addressesAreResolving = false,
  hasActiveScanProgress = false,
  hasComputedHolders = false,
  hasFilteredHolders = false,
  holdersReady = false,
  isInitialLoading = false,
  isRefreshing = false,
  isScanActive = false,
  loadingMintersBurners = false,
  loadingMintedFilter = false,
  shouldOverrideMinted = false,
  showModal = false,
  showScanProgress = false,
}: ResolveSbtPageHolderModalDisplayStateArgs = {}): SbtPageHolderModalDisplayState => {
  const showEmptyStateInModal =
    !hasFilteredHolders &&
    !hasComputedHolders &&
    !isInitialLoading &&
    !loadingMintedFilter &&
    !addressesAreResolving &&
    !!holdersReady &&
    !shouldOverrideMinted;
  const waitingForHolderDetails =
    !!addressesAreResolving ||
    (!!shouldOverrideMinted &&
      !hasFilteredHolders &&
      !hasComputedHolders &&
      (!!loadingMintersBurners || !!loadingMintedFilter || !!isRefreshing || !!showScanProgress));
  const showApproximateCountHint =
    !hasFilteredHolders &&
    !hasComputedHolders &&
    !showEmptyStateInModal &&
    !addressesAreResolving &&
    !isScanActive &&
    !!shouldOverrideMinted;
  const showSpinnerInModalBody =
    !hasFilteredHolders &&
    !hasComputedHolders &&
    !showEmptyStateInModal &&
    (waitingForHolderDetails || !holdersReady || !!isInitialLoading || !!loadingMintedFilter);
  const showScanProgressInModal =
    !!showModal &&
    !!hasActiveScanProgress &&
    (!!showScanProgress || showSpinnerInModalBody || !!loadingMintedFilter || !!hasActiveScanProgress);
  const showCornerSpinner =
    (!!hasActiveScanProgress ||
      !!loadingMintedFilter ||
      (!!loadingMintersBurners && (!!holdersReady || !!hasFilteredHolders)) ||
      (!!isRefreshing && !!hasActiveScanProgress)) &&
    (!!holdersReady || !!hasFilteredHolders);
  const showHeaderCount = !!holdersReady || !!shouldOverrideMinted;
  return {
    mintedCountTitle: shouldOverrideMinted ? SBT_PAGE_MINTED_COUNT_ESTIMATE_TITLE : undefined,
    showApproximateCountHint,
    showCornerSpinner,
    showEmptyStateInModal,
    showHeaderCount,
    showScanProgressInModal,
    showSpinnerInModalBody,
    waitingForHolderDetails,
  };
};

export const resolveSbtPageHolderDisplayModel = ({
  countsLoaded = false,
  filteredMintedUsers: filteredMintedUsersRaw = [],
  isScanActive = false,
  loadingMintersBurners = false,
  loadingMintedFilter = false,
  mintedAddresses: mintedAddressesRaw = [],
  mintedTokensOverride: mintedTokensOverrideRaw = null,
  netHolders: netHoldersRaw = [],
  scanProgress = null,
  sbtScanInProgress = false,
  sbtScanPending = false,
  showModal = false,
  resolveScanProgressSessionLabel = null,
}: ResolveSbtPageHolderDisplayModelArgs = {}): SbtPageHolderDisplayModel => {
  const netHolders = Array.isArray(netHoldersRaw) ? netHoldersRaw : [];
  const mintedAddresses = Array.isArray(mintedAddressesRaw) ? mintedAddressesRaw : [];
  const filteredMintedUsersInput = Array.isArray(filteredMintedUsersRaw) ? filteredMintedUsersRaw : [];
  const hasComputedHolders = netHolders.length > 0;
  const hasFilteredHolders = filteredMintedUsersInput.length > 0;
  const mintedTokensOverride = sanitizeSbtPageMintedTokensOverride(mintedTokensOverrideRaw);
  const hasScanProgress = hasUsableSbtPageScanProgress(scanProgress);
  const hasActiveScanProgress = isActiveSbtPageScanProgress(scanProgress);

  const holderLoadingState = resolveSbtPageHolderLoadingState({
    countsLoaded,
    hasComputedHolders,
    hasFilteredHolders,
    isScanActive,
    loadingMintersBurners,
    loadingMintedFilter,
    mintedTokensOverride,
    netHoldersCount: netHolders.length,
    sbtScanInProgress,
    sbtScanPending,
  });

  const isInitialLoading = !holderLoadingState.countsReady && holderLoadingState.effectiveLoading;
  const isRefreshing = !isInitialLoading && holderLoadingState.effectiveLoading;
  const rawRemainingBlocksCount = hasScanProgress ? resolveSbtPageRemainingBlocksCount(scanProgress) : 0;
  const showScanProgress = shouldShowSbtPageScanProgress({
    effectiveLoading: holderLoadingState.effectiveLoading,
    hasActiveScanProgress,
    rawRemainingBlocksCount,
  });

  const holderResolutionState = resolveSbtPageHolderResolutionState({
    isRefreshing,
    loadingMintersBurners,
    loadingMintedFilter,
    mintedAddresses,
    mintedTokensOverride,
    showScanProgress,
  });

  const holdersDisplayCount = resolveSbtPageHoldersDisplayCount({
    mintedTokensOverride,
    netHoldersCount: netHolders.length,
    shouldOverrideMinted: holderLoadingState.shouldOverrideMinted,
  });

  const scanProgressSessionLabel =
    showScanProgress && typeof resolveScanProgressSessionLabel === 'function'
      ? resolveScanProgressSessionLabel(scanProgress)
      : '';
  const scanProgressDisplay = resolveSbtPageScanProgressDisplay({
    rawRemainingBlocksCount,
    sessionLabel: showScanProgress ? scanProgressSessionLabel : '',
    showScanProgress,
  });
  const scanProgressPct = resolveSbtPageScanProgressPercent({
    progress: scanProgress,
    showScanProgress,
  });
  const scanProgressFillStyle = resolveSbtPageScanProgressFillStyle({
    percent: scanProgressPct,
  });
  const holderFilterItems = resolveSbtPageHolderFilterItems({
    filteredMintedUsers: filteredMintedUsersInput,
    hasComputedHolders,
    hasFilteredHolders,
    isScanActive,
    netHolders,
  });
  const holderModalDisplayState = resolveSbtPageHolderModalDisplayState({
    addressesAreResolving: holderResolutionState.addressesAreResolving,
    hasActiveScanProgress,
    hasComputedHolders,
    hasFilteredHolders,
    holdersReady: holderLoadingState.holdersReady,
    isInitialLoading,
    isRefreshing,
    isScanActive,
    loadingMintersBurners,
    loadingMintedFilter,
    shouldOverrideMinted: holderLoadingState.shouldOverrideMinted,
    showModal,
    showScanProgress,
  });

  return {
    ...holderLoadingState,
    ...holderResolutionState,
    ...holderFilterItems,
    ...holderModalDisplayState,
    hasActiveScanProgress,
    hasComputedHolders,
    hasFilteredHolders,
    hasScanProgress,
    holdersDisplayCount,
    isInitialLoading,
    isRefreshing,
    mintedTokensOverride,
    rawRemainingBlocksCount,
    remainingBlocksCount: scanProgressDisplay.remainingBlocksCount,
    scanProgressFillStyle,
    scanProgressPct,
    scanProgressSessionText: scanProgressDisplay.scanProgressSessionText,
    scanProgressText: scanProgressDisplay.scanProgressText,
    showScanProgress,
  };
};
