import {
  buildEffectiveFeaturedAddressSet,
  buildSbtOptionsByAddress,
  buildSbtOptionsBySelectionKey,
  buildSbtSelectorMergedSelectableOptions,
  buildSbtSelectorSelectOptions,
  buildSelectedSbtAddressSet,
  buildSelectedSbtKeySet,
  hasSelectedOrPendingSbtSelectorAddress,
  hasSelectedOrPendingSbtSelectorKey,
  resolveSbtSelectorDisplayOptions,
} from './sbtSelectorOptionCollectionHelpers';

describe('sbtSelectorOptionCollectionHelpers', () => {
  it('builds option maps and selected SBT sets without changing key precedence', () => {
    const first = {
      address: '0x000000000000000000000000000000000000000A',
      chainId: 84532,
      selectionKey: 'first-key',
    };
    const duplicateAddress = {
      address: '0x000000000000000000000000000000000000000a',
      chainId: 11155420,
      selectionKey: 'second-key',
    };
    const second = {
      address: '0x000000000000000000000000000000000000000B',
      chainId: 84532,
    };

    expect(Array.from(buildSbtOptionsByAddress([first, duplicateAddress, second]).keys())).toEqual([
      '0x000000000000000000000000000000000000000a',
      '0x000000000000000000000000000000000000000b',
    ]);
    expect(Array.from(buildSbtOptionsBySelectionKey([first, duplicateAddress, second]).keys())).toEqual([
      'first-key',
      'second-key',
      '84532:0x000000000000000000000000000000000000000b',
    ]);
    expect(Array.from(buildSelectedSbtKeySet([first, second]))).toEqual([
      'first-key',
      '84532:0x000000000000000000000000000000000000000b',
    ]);
    expect(Array.from(buildSelectedSbtAddressSet([first, { address: 'bad' }, second]))).toEqual([
      '0x000000000000000000000000000000000000000a',
      '0x000000000000000000000000000000000000000b',
    ]);
  });

  it('preserves selectable option merge and featured filtering behavior', () => {
    const cached = { address: '0x000000000000000000000000000000000000000A', name: 'Cached' };
    const duplicateAdditional = { address: '0x000000000000000000000000000000000000000a', name: 'Additional duplicate' };
    const newAdditional = { address: '0x000000000000000000000000000000000000000B', name: 'Additional' };
    const merged = buildSbtSelectorMergedSelectableOptions({
      sbtOptions: [cached],
      additionalOptions: [duplicateAdditional, newAdditional],
    });

    expect(merged).toEqual([cached, newAdditional]);
    expect(
      resolveSbtSelectorDisplayOptions({
        defaultFeaturedSBTs: ['0x000000000000000000000000000000000000000A'],
        limitToFeatured: true,
        mergedSbtOptions: merged,
        scopeFeaturedAddresses: ['0x000000000000000000000000000000000000000B'],
      }),
    ).toEqual({
      displayOptions: [newAdditional],
      effectiveFeatured: ['0x000000000000000000000000000000000000000B'],
      hasFeaturedSBTs: true,
    });
    expect(
      Array.from(
        buildEffectiveFeaturedAddressSet({
          scopeFeaturedAddresses: [],
          defaultFeaturedSBTs: ['0x000000000000000000000000000000000000000D'],
        }),
      ),
    ).toEqual(['0x000000000000000000000000000000000000000d']);
  });

  it('builds react-select options and selected/pending predicates', () => {
    const first = {
      address: '0x000000000000000000000000000000000000000A',
      chainId: 84532,
      image: 'badge.png',
      name: 'Alpha',
    };
    const second = {
      address: '0x000000000000000000000000000000000000000B',
      name: null,
      selectionKey: 'custom-selection',
    };

    expect(buildSbtSelectorSelectOptions([first, second])).toEqual([
      {
        value: '0x000000000000000000000000000000000000000A',
        selectionKey: '84532:0x000000000000000000000000000000000000000a',
        label: 'Alpha',
        image: 'badge.png',
        chainId: 84532,
      },
      {
        value: '0x000000000000000000000000000000000000000B',
        selectionKey: 'custom-selection',
        label: '',
        image: undefined,
        chainId: undefined,
      },
    ]);
    expect(
      hasSelectedOrPendingSbtSelectorAddress({
        address: first.address,
        selectedAddresses: new Set(['0x000000000000000000000000000000000000000a']),
      }),
    ).toBe(true);
    expect(
      hasSelectedOrPendingSbtSelectorKey({
        value: second,
        pendingKeys: new Set(['custom-selection']),
      }),
    ).toBe(true);
    expect(
      hasSelectedOrPendingSbtSelectorKey({
        value: 'bad',
        pendingKeys: new Set(['bad']),
      }),
    ).toBe(false);
  });
});
