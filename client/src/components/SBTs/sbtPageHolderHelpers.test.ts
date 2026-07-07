import {
  buildSbtPageAddressListSignatureMemoState,
  buildSbtPageAddressOccurrenceMap,
  buildSbtPageHolderListSignature,
  buildSbtPageModalFilteredMintedUsersPatch,
  buildSbtPageNetHoldersMemoState,
  buildSbtPageNextFilteredHolderRows,
  computeSbtPageNetCounts,
  computeSbtPageNetHoldersList,
  expandSbtPageAddressListFromCountMap,
  mergeSbtPageBurnEvidenceIntoPreservedHolderState,
  normalizeSbtPageCountMap,
  normalizeSbtPageLoadInfoOptions,
  reconcileSbtPageHolderRefreshState,
} from './sbtPageHolderHelpers';

describe('sbtPageHolderHelpers', () => {
  it('builds holder occurrence maps, net counts, holder lists, and signatures', () => {
    expect(Array.from(buildSbtPageAddressOccurrenceMap(['0xA', '0xa', '', null]).entries())).toEqual([['0xa', 2]]);
    expect(Array.from(computeSbtPageNetCounts(['0xA', '0xB'], ['0xa']).entries())).toEqual([
      ['0xa', 0],
      ['0xb', 1],
    ]);
    expect(computeSbtPageNetHoldersList(['0xA', '0xB', '0xA'], ['0xa'])).toEqual(['0xa', '0xb']);
    expect(buildSbtPageHolderListSignature(['0xA', '0xB'])).toBe(buildSbtPageHolderListSignature(['0xa', '0xb']));
    expect(buildSbtPageHolderListSignature(['0xA', '0xB'])).not.toBe(buildSbtPageHolderListSignature(['0xB', '0xA']));
  });

  it('reuses holder list and net-holder memo state by identity or signature', () => {
    const list = ['0xA', '0xB'];
    const firstMemoState = buildSbtPageAddressListSignatureMemoState({ list });
    expect(firstMemoState.signature).toBe(buildSbtPageHolderListSignature(list));

    const buildSignature = jest.fn(() => 'unused');
    const reusedMemoState = buildSbtPageAddressListSignatureMemoState({
      buildAddressListSignature: buildSignature,
      list,
      memo: firstMemoState.memo,
    });
    expect(reusedMemoState).toEqual(firstMemoState);
    expect(buildSignature).not.toHaveBeenCalled();
    expect(
      buildSbtPageAddressListSignatureMemoState({
        buildAddressListSignature: () => '',
        list: ['0xC'],
      }).signature,
    ).toBe('1:0');

    const minted = ['0xA', '0xB', '0xA'];
    const burned = ['0xa'];
    const firstNetState = buildSbtPageNetHoldersMemoState({
      burnedAddresses: burned,
      mintedAddresses: minted,
    });
    expect(firstNetState.netHolders).toEqual(['0xa', '0xb']);

    const computeNetHolders = jest.fn(() => ['unused']);
    const sameRefNetState = buildSbtPageNetHoldersMemoState({
      burnedAddresses: burned,
      computeNetHoldersList: computeNetHolders,
      memo: firstNetState.memo,
      mintedAddresses: minted,
    });
    expect(sameRefNetState).toEqual(firstNetState);
    expect(computeNetHolders).not.toHaveBeenCalled();

    const sameSignatureNetState = buildSbtPageNetHoldersMemoState({
      burnedAddresses: [...burned],
      computeNetHoldersList: computeNetHolders,
      memo: firstNetState.memo,
      mintedAddresses: [...minted],
    });
    expect(sameSignatureNetState.netHolders).toEqual(firstNetState.netHolders);
    expect(computeNetHolders).not.toHaveBeenCalled();
  });

  it('builds modal filtered holder patches and normalized count-map address lists', () => {
    expect(
      buildSbtPageModalFilteredMintedUsersPatch({
        filtered: [],
        isHolderScanActive: true,
        state: {
          filteredMintedUsers: ['0xA'],
          loadingMintedFilter: true,
        },
      }),
    ).toEqual({ loadingMintedFilter: false });
    expect(
      buildSbtPageModalFilteredMintedUsersPatch({
        buildAddressListSignature: () => 'next',
        filtered: ['0xB'],
        state: {
          filteredMintedUsersSignature: 'prev',
          loadingMintedFilter: true,
        },
      }),
    ).toEqual({
      filteredMintedUsers: ['0xB'],
      filteredMintedUsersSignature: 'next',
      loadingMintedFilter: false,
    });
    expect(
      buildSbtPageModalFilteredMintedUsersPatch({
        buildAddressListSignature: () => 'same',
        filtered: ['0xC'],
        state: {
          filteredMintedUsersSignature: 'same',
          loadingMintedFilter: false,
        },
      }),
    ).toBeNull();

    expect(normalizeSbtPageCountMap({ '0xA': 2.9, '0xB': '1', '0xC': 0 })).toEqual({
      '0xa': 2,
      '0xb': 1,
    });
    expect(expandSbtPageAddressListFromCountMap({ '0xA': 2, '0xB': 1 })).toEqual(['0xa', '0xa', '0xb']);
    expect(expandSbtPageAddressListFromCountMap({}, ['0xFALLBACK'])).toEqual(['0xfallback']);
    expect(expandSbtPageAddressListFromCountMap(null, ['0xFALLBACK'])).toEqual(['0xfallback']);
  });

  it('builds next filtered rows and preserves new burn evidence', () => {
    expect(
      buildSbtPageNextFilteredHolderRows({
        prevFilteredRows: ['0xA', '0xB'],
        prevNetHolders: ['0xA', '0xB'],
        nextNetHolders: ['0xC'],
        replaceRows: true,
      }),
    ).toEqual(['0xc']);
    expect(
      buildSbtPageNextFilteredHolderRows({
        prevFilteredRows: ['0xA'],
        prevNetHolders: ['0xA', '0xB'],
        nextNetHolders: ['0xA', '0xC'],
        replaceRows: true,
      }),
    ).toEqual(['0xa']);

    expect(
      mergeSbtPageBurnEvidenceIntoPreservedHolderState(['0xA', '0xA', '0xB'], ['0xB'], ['0xA', '0xB'], ['0xA', '0xB']),
    ).toEqual({
      mintedAddresses: ['0xa', '0xa', '0xb'],
      burnedAddresses: ['0xb', '0xa'],
      burnDiscovered: true,
    });
    expect(mergeSbtPageBurnEvidenceIntoPreservedHolderState(['0xA'], [], ['0xA'], []).burnDiscovered).toBe(false);
  });

  it('normalizes load-SBT-info options from booleans and option records', () => {
    expect(normalizeSbtPageLoadInfoOptions(true)).toEqual({
      forceEventFetch: true,
      preferCountsOnly: false,
    });
    expect(normalizeSbtPageLoadInfoOptions({ force: true, countsOnly: true })).toEqual({
      forceEventFetch: true,
      preferCountsOnly: true,
    });
    expect(normalizeSbtPageLoadInfoOptions({ forceEventFetch: true, preferCountsOnly: false })).toEqual({
      forceEventFetch: true,
      preferCountsOnly: false,
    });
    expect(normalizeSbtPageLoadInfoOptions(['bad'])).toEqual({
      forceEventFetch: false,
      preferCountsOnly: false,
    });
  });

  it('reconciles incomplete holder refreshes by preserving visible rows and new burn evidence', () => {
    const result = reconcileSbtPageHolderRefreshState({
      nextBurnedAddresses: ['0xA'],
      nextCountsLoaded: false,
      nextHoldersMetaKey: 'holders-key',
      nextMintedAddresses: [],
      prevState: {
        burnedAddresses: [],
        countsLoaded: true,
        filteredMintedUsers: ['0xA', '0xB'],
        holdersMetaKey: 'holders-key',
        mintedAddresses: ['0xA', '0xB'],
        mintedTokensOverride: '2',
        showModal: true,
      },
      userLower: '0xB',
    });

    expect(result).toEqual({
      burnedAddresses: ['0xa'],
      countsLoaded: true,
      filteredMintedUsers: ['0xb'],
      filteredMintedUsersSignature: buildSbtPageHolderListSignature(['0xb']),
      mintedAddresses: ['0xa', '0xb'],
      mintedTokensOverride: '2',
      userHasSBT: true,
    });
  });

  it('reconciles new-key empty holder replacements and drops stale minted-token approximations', () => {
    const result = reconcileSbtPageHolderRefreshState({
      nextBurnedAddresses: [],
      nextCountsLoaded: true,
      nextHoldersMetaKey: 'new-holders-key',
      nextMintedAddresses: [],
      prevState: {
        burnedAddresses: [],
        countsLoaded: false,
        filteredMintedUsers: ['0xA'],
        holdersMetaKey: 'holders-key',
        mintedAddresses: ['0xA'],
        mintedTokensOverride: '1',
        showModal: true,
      },
      userLower: '0xA',
    });

    expect(result).toEqual({
      burnedAddresses: [],
      countsLoaded: true,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: buildSbtPageHolderListSignature([]),
      mintedAddresses: [],
      mintedTokensOverride: null,
      userHasSBT: false,
    });
  });
});
