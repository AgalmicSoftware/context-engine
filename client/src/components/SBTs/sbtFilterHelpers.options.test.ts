import {
  appendSbtFilterOption,
  buildSbtFilterQuickChipClassName,
  buildSbtFilterQuickChipDisplayState,
  buildSbtFilterQuickChipSelectedAddressSet,
  buildSbtFilterSelectionAddPatch,
  buildSbtFilterSelectionRemovePatch,
  buildSbtFilterSurfaceClassNames,
  formatSbtFilterQuickChipAddress,
  hasMatchingSbtOptionAddress,
  hasSbtFilterFeaturedOptions,
  readSbtOptionAddress,
  removeMatchingSbtOptionAddress,
  resolveSbtFilterButtonText,
  resolveSbtFilterChainId,
  resolveSbtFilterGroupSlug,
  resolveSbtFilterLayoutDisplayState,
  resolveSbtFilterModeSectionsState,
  resolveSbtFilterOptionsVisibilityState,
  resolveSbtFilterPanelDisplayState,
  resolveSbtFilterSurfaceDisplayState,
  shouldAppendSbtFilterSelection,
} from './sbtFilterHelpers';

describe('sbtFilterHelpers option helpers', () => {
  it('reads and filters SBT option addresses without normalizing identity', () => {
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
    expect(removeMatchingSbtOptionAddress(null, '0xA')).toEqual([]);
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
  });

  it('builds quick-chip selected address sets and short labels', () => {
    const selectedSet = buildSbtFilterQuickChipSelectedAddressSet([
      { address: ' 0xABCDEF0000000000000000000000000000001234 ' },
      { label: 'missing address' },
      '0xnot-object',
      { address: '' },
    ]);

    expect(Array.from(selectedSet)).toEqual(['0xabcdef0000000000000000000000000000001234']);
    expect(formatSbtFilterQuickChipAddress('')).toBe('');
    expect(formatSbtFilterQuickChipAddress('0x1234567890')).toBe('0x1234567890');
    expect(formatSbtFilterQuickChipAddress('0xABCDEF0000000000000000000000000000001234')).toBe('0xABCD...01234');
    expect(
      buildSbtFilterQuickChipDisplayState({
        address: ' 0xABCDEF0000000000000000000000000000001234 ',
        filterKey: 'creator',
        gateColors: ['#111111', '#222222'],
        index: 2,
        resolveDisplayLabel: () => 'Builder Badge',
        selectedSet,
        sessionSlug: 'edge',
      }),
    ).toEqual({
      address: '0xABCDEF0000000000000000000000000000001234',
      addressLower: '0xabcdef0000000000000000000000000000001234',
      chipLabel: 'Builder Badge',
      isDisabled: true,
      isSelected: true,
      key: 'creator-0xabcdef0000000000000000000000000000001234-2',
      shouldUseSelectedClass: true,
      style: { backgroundColor: '#111111' },
      testId: 'ce-sbt-quick-chip-creator-0xABCDEF0000000000000000000000000000001234',
    });
    expect(
      buildSbtFilterQuickChipDisplayState({
        address: '0x9999000000000000000000000000000000001234',
        selectedSet,
      }),
    ).toMatchObject({
      isDisabled: false,
      isSelected: false,
      shouldUseSelectedClass: false,
      style: { backgroundColor: undefined },
    });
    expect(
      buildSbtFilterQuickChipDisplayState({
        address: '0xABCDEF0000000000000000000000000000001234',
        resolveDisplayLabel: () => '0xabcdef0000000000000000000000000000001234',
      }).chipLabel,
    ).toBe('0xABCD...01234');
    expect(
      buildSbtFilterQuickChipDisplayState({
        address: '0xABCDEF0000000000000000000000000000001234',
        resolveDisplayLabel: () => {
          throw new Error('lookup failed');
        },
      }).chipLabel,
    ).toBe('0xABCD...01234');
    expect(
      buildSbtFilterQuickChipClassName({
        baseClassName: 'quick-chip',
        selectedClassName: 'quick-chip-selected',
        shouldUseSelectedClass: false,
      }),
    ).toBe('quick-chip');
    expect(
      buildSbtFilterQuickChipClassName({
        baseClassName: 'quick-chip',
        selectedClassName: 'quick-chip-selected',
        shouldUseSelectedClass: true,
      }),
    ).toBe('quick-chip quick-chip-selected');
    expect(hasSbtFilterFeaturedOptions(['0xA'])).toBe(true);
    expect(hasSbtFilterFeaturedOptions([])).toBe(false);
    expect(resolveSbtFilterButtonText({ mode: 'questions' })).toBe('Response Filter');
    expect(resolveSbtFilterButtonText({ mode: 'creatorAndResponder' })).toBe('Response Filter');
    expect(resolveSbtFilterButtonText({ mode: 'sbt' })).toBe('Filter');
    expect(
      resolveSbtFilterOptionsVisibilityState({
        autoExpand: true,
        hideLoadingOverlay: false,
        loading: true,
        showFilterOptions: false,
      }),
    ).toEqual({
      shouldRenderFilterOptions: true,
      shouldRenderLoadingOverlay: true,
    });
    expect(
      resolveSbtFilterOptionsVisibilityState({
        autoExpand: false,
        hideLoadingOverlay: true,
        loading: true,
        showFilterOptions: true,
      }),
    ).toEqual({
      shouldRenderFilterOptions: true,
      shouldRenderLoadingOverlay: false,
    });
    expect(
      resolveSbtFilterOptionsVisibilityState({
        autoExpand: false,
        loading: false,
        showFilterOptions: false,
      }),
    ).toEqual({
      shouldRenderFilterOptions: false,
      shouldRenderLoadingOverlay: false,
    });
    expect(resolveSbtFilterLayoutDisplayState()).toEqual({
      filterOptionsFrameStyle: { position: 'relative' },
      hiddenRootStyle: { display: 'none' },
      loadingOverlayStyle: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 'inherit',
      },
    });
    expect(
      resolveSbtFilterPanelDisplayState({
        autoExpand: false,
        hasFeaturedSBTs: true,
        hideUI: false,
      }),
    ).toEqual({
      shouldRenderFilterToggleButton: true,
      shouldRenderHiddenRoot: false,
      shouldRenderShowAllCheckbox: true,
    });
    expect(
      resolveSbtFilterPanelDisplayState({
        autoExpand: true,
        hasFeaturedSBTs: false,
        hideUI: true,
      }),
    ).toEqual({
      shouldRenderFilterToggleButton: false,
      shouldRenderHiddenRoot: true,
      shouldRenderShowAllCheckbox: false,
    });
    expect(resolveSbtFilterSurfaceDisplayState({ buttonSurface: 'light' })).toEqual({
      shouldUseLightSurface: true,
    });
    expect(resolveSbtFilterSurfaceDisplayState({ buttonSurface: 'dark' })).toEqual({
      shouldUseLightSurface: false,
    });
    expect(
      buildSbtFilterSurfaceClassNames({
        filterButtonLightClassName: 'filter-button-light',
        filterOptionsBaseClassName: 'filter-options',
        filterOptionsLightClassName: 'filter-options-light',
        shouldUseLightSurface: true,
      }),
    ).toEqual({
      filterButtonClassName: 'filter-button-light',
      filterOptionsClassName: 'filter-options filter-options-light',
    });
    expect(
      buildSbtFilterSurfaceClassNames({
        filterButtonLightClassName: 'filter-button-light',
        filterOptionsBaseClassName: 'filter-options',
        filterOptionsLightClassName: 'filter-options-light',
        shouldUseLightSurface: false,
      }),
    ).toEqual({
      filterButtonClassName: undefined,
      filterOptionsClassName: 'filter-options',
    });
    expect(resolveSbtFilterModeSectionsState({ mode: 'responder' })).toEqual({
      shouldRenderAddressFilter: false,
      shouldRenderQuestionCreatorFilter: false,
      shouldRenderQuestionFilter: false,
      shouldRenderQuestionResponderFilter: true,
      shouldRenderResponderFilter: true,
    });
    expect(resolveSbtFilterModeSectionsState({ mode: 'addresses' })).toEqual({
      shouldRenderAddressFilter: true,
      shouldRenderQuestionCreatorFilter: false,
      shouldRenderQuestionFilter: false,
      shouldRenderQuestionResponderFilter: false,
      shouldRenderResponderFilter: false,
    });
    expect(resolveSbtFilterModeSectionsState({ mode: 'creatorAndResponder' })).toEqual({
      shouldRenderAddressFilter: false,
      shouldRenderQuestionCreatorFilter: true,
      shouldRenderQuestionFilter: true,
      shouldRenderQuestionResponderFilter: true,
      shouldRenderResponderFilter: false,
    });
    expect(resolveSbtFilterModeSectionsState({ mode: 'questionResponses' })).toMatchObject({
      shouldRenderQuestionCreatorFilter: false,
      shouldRenderQuestionFilter: true,
      shouldRenderQuestionResponderFilter: true,
    });
    expect(resolveSbtFilterModeSectionsState({ mode: 'unknown' })).toEqual({
      shouldRenderAddressFilter: false,
      shouldRenderQuestionCreatorFilter: false,
      shouldRenderQuestionFilter: false,
      shouldRenderQuestionResponderFilter: false,
      shouldRenderResponderFilter: false,
    });
  });

  it('resolves selected SBT slugs and chain ids with existing precedence', () => {
    const normalizeSessionSlug = jest.fn((value) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    );
    const getSessionSlugByName = jest.fn((name) => (name === 'Named Session' ? 'named-session' : null));

    expect(
      resolveSbtFilterGroupSlug({
        fallbackSlug: 'fallback',
        normalizeSessionSlug,
        sbtInput: { sessionSlug: ' Direct ' },
      }),
    ).toBe('direct');
    expect(
      resolveSbtFilterGroupSlug({
        fallbackSlug: 'fallback',
        getSessionSlugByName,
        normalizeSessionSlug,
        sbtInput: { sessionName: 'Named Session' },
      }),
    ).toBe('named-session');
    expect(
      resolveSbtFilterGroupSlug({
        fallbackSlug: 'fallback',
        getSessionSlugByName,
        normalizeSessionSlug,
        sbtInput: { sessionName: 'Missing' },
      }),
    ).toBe('fallback');

    expect(
      resolveSbtFilterChainId({
        getSessionChainId: () => 10,
        networkID: 84532,
        sbtInput: { chainId: 11155420 },
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
    expect(
      resolveSbtFilterChainId({
        getSessionChainId: () => null,
        networkID: 84532,
        sbtInput: {},
        sbtSlug: 'edge',
      }),
    ).toBe(84532);
  });
});
