import {
  appendSbtFilterOption,
  asSelectedSbtEntry,
  buildSbtEntrySignature,
  buildSbtFilterQuickChipSelectedAddressSet,
  buildSbtFilterSelectionAddPatch,
  buildSbtFilterSelectionRemovePatch,
  buildSbtFilterSelectionStateFromState,
  buildSbtFilterSnapshot,
  buildSbtFilterStateSignature,
  buildSbtListSignature,
  hasActiveSbtFilterState,
  hasMatchingSbtOptionAddress,
  normalizeIncomingFilterState,
  readSbtOptionAddress,
  removeMatchingSbtOptionAddress,
  resolveSbtFilterChainId,
  resolveSbtFilterGroupSlug,
  shouldAppendSbtFilterSelection,
} from './sbtFilterSelectionHelpers';

describe('sbtFilterSelectionHelpers', () => {
  it('reads and patches SBT option selections without normalizing identity', () => {
    const selected = [{ address: '0xA', label: 'Alpha' }, { address: '0xB', label: 'Beta' }, '0xC', null];

    expect(readSbtOptionAddress(selected[0])).toBe('0xA');
    expect(readSbtOptionAddress('0xA')).toBeUndefined();
    expect(hasMatchingSbtOptionAddress(selected, '0xA')).toBe(true);
    expect(hasMatchingSbtOptionAddress(selected, '0xa')).toBe(false);
    expect(appendSbtFilterOption(selected, { address: '0xD', label: 'Delta' })).toEqual([
      { address: '0xA', label: 'Alpha' },
      { address: '0xB', label: 'Beta' },
      '0xC',
      null,
      { address: '0xD', label: 'Delta' },
    ]);
    expect(appendSbtFilterOption(null, selected[0])).toEqual([{ address: '0xA', label: 'Alpha' }]);
    expect(removeMatchingSbtOptionAddress(selected, '0xA')).toEqual([{ address: '0xB', label: 'Beta' }, '0xC', null]);
    expect(
      shouldAppendSbtFilterSelection({
        address: '0xA',
        state: { selectedSBTGroups: selected },
        stateKey: 'selectedSBTGroups',
      }),
    ).toBe(false);
    expect(
      shouldAppendSbtFilterSelection({
        address: '0xD',
        state: { selectedSBTGroups: selected },
        stateKey: 'selectedSBTGroups',
      }),
    ).toBe(true);
    expect(
      buildSbtFilterSelectionAddPatch({
        sbtObject: { address: '0xD', label: 'Delta' },
        state: { selectedSBTGroups: selected },
        stateKey: 'selectedSBTGroups',
      }),
    ).toEqual({
      selectedSBTGroups: [
        { address: '0xA', label: 'Alpha' },
        { address: '0xB', label: 'Beta' },
        '0xC',
        null,
        { address: '0xD', label: 'Delta' },
      ],
    });
    expect(
      buildSbtFilterSelectionRemovePatch({
        address: '0xB',
        state: { selectedSBTGroups: selected },
        stateKey: 'selectedSBTGroups',
      }),
    ).toEqual({
      selectedSBTGroups: [{ address: '0xA', label: 'Alpha' }, '0xC', null],
    });
    expect(buildSbtFilterQuickChipSelectedAddressSet(selected)).toEqual(new Set(['0xa', '0xb']));
  });

  it('normalizes selected entries, group slugs, and chain ids', () => {
    expect(asSelectedSbtEntry({ address: '0xSBT', sessionSlug: 'edge' })).toEqual({
      address: '0xSBT',
      sessionSlug: 'edge',
    });
    expect(asSelectedSbtEntry('0xSBT')).toEqual({});
    expect(
      resolveSbtFilterGroupSlug({
        fallbackSlug: 'fallback',
        normalizeSessionSlug: (slug) =>
          String(slug || '')
            .trim()
            .toLowerCase(),
        sbtInput: { sessionSlug: ' Edge ' },
      }),
    ).toBe('edge');
    expect(
      resolveSbtFilterGroupSlug({
        fallbackSlug: 'fallback',
        getSessionSlugByName: (name) => (name === 'Named Session' ? 'named' : null),
        sbtInput: { sessionName: 'Named Session' },
      }),
    ).toBe('named');
    expect(
      resolveSbtFilterChainId({
        getSessionChainId: () => 10,
        networkID: 84532,
        sbtInput: { chainID: 11155420 },
        sbtSlug: 'edge',
      }),
    ).toBe(10);
    expect(
      resolveSbtFilterChainId({
        getSessionChainId: () => 0,
        networkID: 84532,
        sbtInput: { chainID: 11155420 },
        sbtSlug: 'edge',
      }),
    ).toBe(11155420);
  });

  it('normalizes filter state and builds stable signatures', () => {
    const selected = [{ address: '0xA' }];
    const normalized = normalizeIncomingFilterState({
      selectedSBTGroupsCreator: selected,
      excludedSBTGroupsCreator: 'bad',
      selectedSBTGroupsResponder: [],
      excludedSBTGroupsResponder: null,
      selectedSBTGroups: [{ address: '0xB' }],
      excludedSBTGroups: undefined,
      onlyVerifiedHumans: 'yes',
    });

    expect(normalized.selectedSBTGroupsCreator).toBe(selected);
    expect(normalized.excludedSBTGroupsCreator).toEqual([]);
    expect(normalized.selectedSBTGroups).toEqual([{ address: '0xB' }]);
    expect(normalized.onlyVerifiedHumans).toBe(true);
    expect(hasActiveSbtFilterState(normalized)).toBe(true);
    expect(hasActiveSbtFilterState({ selectedSBTGroups: 'bad' })).toBe(false);

    expect(
      buildSbtFilterSelectionStateFromState({
        selectedSBTGroupsCreator: selected,
        excludedSBTGroupsCreator: [],
        selectedSBTGroupsResponder: [],
        excludedSBTGroupsResponder: [],
        selectedSBTGroups: [],
        excludedSBTGroups: [],
        onlyVerifiedHumans: 'truthy',
        ignored: true,
      }),
    ).toEqual({
      selectedSBTGroupsCreator: selected,
      excludedSBTGroupsCreator: [],
      selectedSBTGroupsResponder: [],
      excludedSBTGroupsResponder: [],
      selectedSBTGroups: [],
      excludedSBTGroups: [],
      onlyVerifiedHumans: 'truthy',
    });

    expect(
      buildSbtEntrySignature({
        address: ' 0xABC ',
        sessionSlug: ' Edge ',
        chainID: 84532,
      }),
    ).toBe('0xabc|edge|84532');
    expect(
      buildSbtListSignature([
        { address: '0xB', slug: 'Group', chainId: 10 },
        { address: '0xA', group: 'Group', chainID: 10 },
        null,
      ]),
    ).toBe('0xa|group|10,0xb|group|10');
    expect(
      buildSbtFilterStateSignature({
        selectedSBTGroups: [
          { address: '0xB', slug: 'edge', chainId: 84532 },
          { address: '0xA', slug: 'edge', chainId: 84532 },
        ],
        onlyVerifiedHumans: true,
      }),
    ).toBe('||||0xa|edge|84532,0xb|edge|84532||1');
    expect(buildSbtFilterStateSignature({ selectedSBTGroups: 'bad' })).toBe('||||||0');
  });

  it('builds filter snapshots with passive run markers', () => {
    expect(
      buildSbtFilterSnapshot({
        filterStateSignature: 'filter',
        mode: 'addresses',
        itemCount: 2,
        networkID: '',
        itemsSourceSignature: 'items',
        sbtCacheRevision: 7,
        passive: true,
      }),
    ).toBe('filter|addresses|2|__no-network__|items|7|passive');
  });
});
