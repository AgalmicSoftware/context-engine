import {
  resolveSbtPageScanProgressDisplay,
  resolveSbtPageScanProgressFillStyle,
  resolveSbtPageScanProgressPercent,
  shouldShowSbtPageScanProgress,
} from './sbtPageHelpers';
import {
  resolveSbtPageHolderDisplayModel,
  resolveSbtPageHolderFilterItems,
  resolveSbtPageHolderLoadingState,
  resolveSbtPageHolderModalDisplayState,
  resolveSbtPageHolderResolutionState,
  resolveSbtPageHoldersDisplayCount,
} from './sbtPageHolderDisplayHelpers';

describe('sbtPageHelpers holder display helpers', () => {
  it('resolves holder loading display state without changing fallback rules', () => {
    expect(
      resolveSbtPageHolderLoadingState({
        countsLoaded: false,
        hasComputedHolders: false,
        hasFilteredHolders: false,
        isScanActive: false,
        loadingMintersBurners: false,
        loadingMintedFilter: false,
        mintedTokensOverride: null,
        netHoldersCount: 0,
        sbtScanPending: true,
      }),
    ).toEqual({
      countsReady: true,
      effectiveLoading: false,
      holdersReady: true,
      isGlobalLoading: false,
      isLocalLoading: false,
      netMinted: '0',
      shouldOverrideMinted: false,
      terminalEmptyHoldersState: true,
    });
    expect(
      resolveSbtPageHolderLoadingState({
        countsLoaded: false,
        loadingMintersBurners: true,
        mintedTokensOverride: '5',
        netHoldersCount: 0,
        sbtScanInProgress: true,
      }),
    ).toMatchObject({
      countsReady: true,
      effectiveLoading: true,
      isGlobalLoading: true,
      isLocalLoading: true,
      netMinted: '5',
      shouldOverrideMinted: true,
      terminalEmptyHoldersState: false,
    });
    expect(
      resolveSbtPageHolderLoadingState({
        countsLoaded: true,
        mintedTokensOverride: '5',
        netHoldersCount: 2,
      }),
    ).toMatchObject({
      netMinted: '2',
      shouldOverrideMinted: false,
      holdersReady: true,
    });
    expect(
      resolveSbtPageHolderResolutionState({
        loadingMintersBurners: true,
        mintedAddresses: [],
        mintedTokensOverride: '3',
      }),
    ).toEqual({
      addressesAreResolving: true,
      addressesNeedResolutionHint: true,
    });
    expect(
      resolveSbtPageHolderResolutionState({
        isRefreshing: true,
        mintedAddresses: ['0xHolder'],
        mintedTokensOverride: '3',
        showScanProgress: true,
      }),
    ).toEqual({
      addressesAreResolving: false,
      addressesNeedResolutionHint: false,
    });
    expect(
      resolveSbtPageHolderResolutionState({
        loadingMintersBurners: false,
        loadingMintedFilter: false,
        mintedAddresses: [],
        mintedTokensOverride: '3',
        showScanProgress: false,
      }),
    ).toEqual({
      addressesAreResolving: false,
      addressesNeedResolutionHint: true,
    });
    expect(
      resolveSbtPageHoldersDisplayCount({
        netHoldersCount: 4,
        shouldOverrideMinted: false,
      }),
    ).toBe('4');
    expect(
      resolveSbtPageHoldersDisplayCount({
        mintedTokensOverride: '7',
        netHoldersCount: 4,
        shouldOverrideMinted: true,
      }),
    ).toBe('~7');
    expect(
      shouldShowSbtPageScanProgress({
        effectiveLoading: true,
        hasActiveScanProgress: true,
        rawRemainingBlocksCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldShowSbtPageScanProgress({
        effectiveLoading: false,
        hasActiveScanProgress: true,
        rawRemainingBlocksCount: 3,
      }),
    ).toBe(true);
    expect(
      shouldShowSbtPageScanProgress({
        effectiveLoading: false,
        hasActiveScanProgress: true,
        rawRemainingBlocksCount: 0,
      }),
    ).toBe(false);
    expect(
      shouldShowSbtPageScanProgress({
        effectiveLoading: true,
        hasActiveScanProgress: false,
        rawRemainingBlocksCount: 3,
      }),
    ).toBe(false);
    expect(
      resolveSbtPageScanProgressPercent({
        progress: { scannedBlocks: 5, totalBlocks: 20 },
        showScanProgress: true,
      }),
    ).toBe(25);
    expect(
      resolveSbtPageScanProgressPercent({
        progress: { scannedBlocks: 50, totalBlocks: 20 },
        showScanProgress: true,
      }),
    ).toBe(100);
    expect(
      resolveSbtPageScanProgressPercent({
        progress: { scannedBlocks: 'bad', totalBlocks: 20 },
        showScanProgress: true,
      }),
    ).toBe(0);
    expect(
      resolveSbtPageScanProgressPercent({
        progress: { scannedBlocks: 5, totalBlocks: 20 },
        showScanProgress: false,
      }),
    ).toBe(0);
    expect(resolveSbtPageScanProgressFillStyle({ percent: 25 })).toEqual({
      width: '25%',
    });
    expect(resolveSbtPageScanProgressFillStyle({ percent: undefined })).toEqual({
      width: '0%',
    });
    expect(
      resolveSbtPageScanProgressDisplay({
        rawRemainingBlocksCount: 12345.6,
        sessionLabel: ' Example Session ',
        showScanProgress: true,
      }),
    ).toEqual({
      remainingBlocksCount: 12345.6,
      scanProgressSessionText: 'Session: Example Session',
      scanProgressText: 'Scanning mint/burn history: 12,345.6 blocks remaining',
    });
    expect(
      resolveSbtPageScanProgressDisplay({
        rawRemainingBlocksCount: Number.NaN,
        sessionLabel: '',
        showScanProgress: true,
      }),
    ).toEqual({
      remainingBlocksCount: Number.NaN,
      scanProgressSessionText: 'Session: ',
      scanProgressText: 'Scanning mint/burn history: - blocks remaining',
    });
    expect(
      resolveSbtPageScanProgressDisplay({
        rawRemainingBlocksCount: 7,
        sessionLabel: 'Hidden',
        showScanProgress: false,
      }),
    ).toEqual({
      remainingBlocksCount: 0,
      scanProgressSessionText: null,
      scanProgressText: null,
    });
    expect(
      resolveSbtPageHolderFilterItems({
        filteredMintedUsers: ['0xFiltered'],
        hasComputedHolders: true,
        hasFilteredHolders: true,
        isScanActive: true,
        netHolders: ['0xNet'],
      }),
    ).toEqual({
      filteredMintedUsers: ['0xFiltered'],
      holderItemsForFilter: ['0xNet'],
      keepStaleFilterRowsWhileRefreshing: false,
    });
    expect(
      resolveSbtPageHolderFilterItems({
        filteredMintedUsers: ['0xFiltered'],
        hasComputedHolders: false,
        hasFilteredHolders: true,
        isScanActive: true,
        netHolders: ['0xNet'],
      }),
    ).toEqual({
      filteredMintedUsers: ['0xFiltered'],
      holderItemsForFilter: ['0xFiltered'],
      keepStaleFilterRowsWhileRefreshing: true,
    });
    expect(
      resolveSbtPageHolderFilterItems({
        filteredMintedUsers: 'bad',
        hasComputedHolders: false,
        hasFilteredHolders: false,
        isScanActive: true,
      }),
    ).toEqual({
      filteredMintedUsers: [],
      holderItemsForFilter: [],
      keepStaleFilterRowsWhileRefreshing: false,
    });
    expect(
      resolveSbtPageHolderModalDisplayState({
        holdersReady: true,
      }),
    ).toMatchObject({
      showEmptyStateInModal: true,
      showHeaderCount: true,
      showSpinnerInModalBody: false,
      waitingForHolderDetails: false,
    });
    expect(
      resolveSbtPageHolderModalDisplayState({
        hasActiveScanProgress: true,
        isRefreshing: true,
        loadingMintersBurners: true,
        shouldOverrideMinted: true,
        showModal: true,
        showScanProgress: true,
      }),
    ).toMatchObject({
      mintedCountTitle: 'Holder list not loaded yet; showing an on-chain holder count estimate.',
      showApproximateCountHint: true,
      showCornerSpinner: false,
      showEmptyStateInModal: false,
      showHeaderCount: true,
      showScanProgressInModal: true,
      showSpinnerInModalBody: true,
      waitingForHolderDetails: true,
    });
    expect(
      resolveSbtPageHolderModalDisplayState({
        hasFilteredHolders: true,
        holdersReady: true,
        loadingMintersBurners: true,
      }),
    ).toMatchObject({
      showCornerSpinner: true,
      showEmptyStateInModal: false,
      showHeaderCount: true,
      showSpinnerInModalBody: false,
    });
  });

  it('builds the full holder display model for active scan and approximate count states', () => {
    const resolveScanProgressSessionLabel = jest.fn(() => 'Edge Session');
    const model = resolveSbtPageHolderDisplayModel({
      countsLoaded: true,
      filteredMintedUsers: [],
      isScanActive: true,
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      mintedTokensOverride: '25',
      netHolders: [],
      scanProgress: {
        scannedBlocks: 40,
        totalBlocks: 80,
      },
      sbtScanInProgress: true,
      showModal: true,
      resolveScanProgressSessionLabel,
    });

    expect(resolveScanProgressSessionLabel).toHaveBeenCalledTimes(1);
    expect(model).toMatchObject({
      hasActiveScanProgress: true,
      hasComputedHolders: false,
      hasFilteredHolders: false,
      holdersDisplayCount: '~25',
      mintedTokensOverride: '25',
      netMinted: '25',
      shouldOverrideMinted: true,
      showApproximateCountHint: false,
      showEmptyStateInModal: false,
      showScanProgress: true,
      showScanProgressInModal: true,
      showSpinnerInModalBody: true,
      waitingForHolderDetails: true,
    });
    expect(model.scanProgressPct).toBe(50);
    expect(model.scanProgressFillStyle).toEqual({ width: '50%' });
    expect(model.scanProgressText).toBe('Scanning mint/burn history: 40 blocks remaining');
    expect(model.scanProgressSessionText).toBe('Session: Edge Session');
  });

  it('builds settled empty and stale-filter holder display models without modal side effects', () => {
    const emptyModel = resolveSbtPageHolderDisplayModel({
      countsLoaded: false,
      filteredMintedUsers: [],
      isScanActive: false,
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      mintedTokensOverride: null,
      netHolders: [],
      scanProgress: null,
      showModal: true,
      resolveScanProgressSessionLabel: jest.fn(() => 'Unused'),
    });

    expect(emptyModel).toMatchObject({
      countsReady: true,
      holdersDisplayCount: '0',
      holdersReady: true,
      netMinted: '0',
      showEmptyStateInModal: true,
      showHeaderCount: true,
      showScanProgress: false,
      showSpinnerInModalBody: false,
    });
    expect(emptyModel.scanProgressText).toBeNull();
    expect(emptyModel.scanProgressSessionText).toBeNull();

    const staleFilteredModel = resolveSbtPageHolderDisplayModel({
      countsLoaded: false,
      filteredMintedUsers: ['0xFiltered'],
      isScanActive: true,
      loadingMintersBurners: true,
      loadingMintedFilter: false,
      mintedTokensOverride: null,
      netHolders: [],
      scanProgress: {
        scannedBlocks: 10,
        totalBlocks: 20,
      },
      showModal: true,
    });

    expect(staleFilteredModel).toMatchObject({
      filteredMintedUsers: ['0xFiltered'],
      hasComputedHolders: false,
      hasFilteredHolders: true,
      holderItemsForFilter: ['0xFiltered'],
      keepStaleFilterRowsWhileRefreshing: true,
      showEmptyStateInModal: false,
      showScanProgress: true,
    });

    const burnedOutEstimateModel = resolveSbtPageHolderDisplayModel({
      countsLoaded: false,
      filteredMintedUsers: [],
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      mintedAddresses: ['0xBurnedHolder'],
      mintedTokensOverride: '1',
      netHolders: [],
      scanProgress: null,
      showModal: true,
    });

    expect(burnedOutEstimateModel).toMatchObject({
      addressesAreResolving: false,
      addressesNeedResolutionHint: false,
      holdersDisplayCount: '~1',
      showApproximateCountHint: true,
      showSpinnerInModalBody: true,
    });
  });
});
