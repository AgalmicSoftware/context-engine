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
  const holdersReady =
    countsLoaded === true ||
    hasComputed ||
    hasFiltered ||
    terminalEmptyHoldersState;
  const holderCount = Number(netHoldersCount || 0);
  const shouldOverrideMinted =
    mintedTokensOverride != null &&
    (!countsLoaded || holderCount === 0);
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
    mintedTokensOverride != null &&
    Number(mintedTokensOverride) > 0 &&
    mintedAddresses.length === 0;
  const addressesAreResolving =
    addressesNeedResolutionHint &&
    (
      !!loadingMintersBurners ||
      !!loadingMintedFilter ||
      !!isRefreshing ||
      !!showScanProgress
  );
  return { addressesAreResolving, addressesNeedResolutionHint };
};

export const resolveSbtPageHoldersDisplayCount = ({
  mintedTokensOverride = null,
  netHoldersCount = 0,
  shouldOverrideMinted = false,
}: ResolveSbtPageHoldersDisplayCountArgs = {}): string => (
  shouldOverrideMinted
    ? `~${mintedTokensOverride}`
    : String(netHoldersCount || 0)
);

export const resolveSbtPageHolderFilterItems = ({
  filteredMintedUsers: filteredMintedUsersRaw = [],
  hasComputedHolders = false,
  hasFilteredHolders = false,
  isScanActive = false,
  netHolders = [],
}: ResolveSbtPageHolderFilterItemsArgs = {}): SbtPageHolderFilterItems => {
  const keepStaleFilterRowsWhileRefreshing =
    !!hasFilteredHolders &&
    !hasComputedHolders &&
    !!isScanActive;
  const rawHolderItemsForFilter = hasComputedHolders
    ? netHolders
    : (keepStaleFilterRowsWhileRefreshing ? filteredMintedUsersRaw : []);
  const holderItemsForFilter = Array.isArray(rawHolderItemsForFilter)
    ? rawHolderItemsForFilter
    : [];
  const filteredMintedUsers = Array.isArray(filteredMintedUsersRaw)
    ? filteredMintedUsersRaw
    : [];
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
    (
      !!shouldOverrideMinted &&
      !hasFilteredHolders &&
      !hasComputedHolders &&
      (
        !!loadingMintersBurners ||
        !!loadingMintedFilter ||
        !!isRefreshing ||
        !!showScanProgress
      )
    );
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
    (
      !!showScanProgress ||
      showSpinnerInModalBody ||
      !!loadingMintedFilter ||
      !!hasActiveScanProgress
    );
  const showCornerSpinner =
    (
      !!hasActiveScanProgress ||
      !!loadingMintedFilter ||
      (!!loadingMintersBurners && (!!holdersReady || !!hasFilteredHolders)) ||
      (!!isRefreshing && !!hasActiveScanProgress)
    ) &&
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
