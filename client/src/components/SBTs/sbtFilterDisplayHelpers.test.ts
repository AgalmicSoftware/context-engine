import {
  buildSbtFilterBooleanTogglePatch,
  buildSbtFilterQuickChipClassName,
  buildSbtFilterQuickChipDisplayState,
  buildSbtFilterSurfaceClassNames,
  formatSbtFilterQuickChipAddress,
  hasSbtFilterFeaturedOptions,
  resolveSbtFilterButtonText,
  resolveSbtFilterLayoutDisplayState,
  resolveSbtFilterModeSectionsState,
  resolveSbtFilterOptionsVisibilityState,
  resolveSbtFilterPanelDisplayState,
  resolveSbtFilterSurfaceDisplayState,
} from './sbtFilterDisplayHelpers';

describe('sbtFilterDisplayHelpers', () => {
  it('builds generic display and toggle state', () => {
    expect(
      buildSbtFilterBooleanTogglePatch({
        state: { showFilterOptions: true },
        stateKey: 'showFilterOptions',
      }),
    ).toEqual({ showFilterOptions: false });
    expect(
      buildSbtFilterBooleanTogglePatch({
        state: null,
        stateKey: 'showAllSBTs',
      }),
    ).toEqual({ showAllSBTs: true });
    expect(hasSbtFilterFeaturedOptions(['0xA'])).toBe(true);
    expect(hasSbtFilterFeaturedOptions([])).toBe(false);
    expect(resolveSbtFilterButtonText({ mode: 'questions' })).toBe('Response Filter');
    expect(resolveSbtFilterButtonText({ mode: 'creatorAndResponder' })).toBe('Response Filter');
    expect(resolveSbtFilterButtonText({ mode: 'sbt' })).toBe('Filter');
  });

  it('resolves filter panel and surface display state', () => {
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
    expect(resolveSbtFilterSurfaceDisplayState({ buttonSurface: 'light' })).toEqual({
      shouldUseLightSurface: true,
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
  });

  it('resolves filter mode sections', () => {
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
    expect(resolveSbtFilterModeSectionsState({ mode: 'unknown' })).toEqual({
      shouldRenderAddressFilter: false,
      shouldRenderQuestionCreatorFilter: false,
      shouldRenderQuestionFilter: false,
      shouldRenderQuestionResponderFilter: false,
      shouldRenderResponderFilter: false,
    });
  });

  it('builds quick-chip display state and classes', () => {
    const selectedSet = new Set(['0xabcdef0000000000000000000000000000001234']);

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
        shouldUseSelectedClass: true,
      }),
    ).toBe('quick-chip quick-chip-selected');
  });
});
