import {
  buildSbtSelectorCustomAddressClearPatch,
  buildSbtSelectorCustomAddressInputPatch,
  buildSbtSelectorDiscoveringPatch,
  buildSbtSelectorGroupOptionsPatch,
  buildSbtSelectorGroupPickerTogglePatch,
  buildSbtSelectorGroupSourceSelectionPatch,
  buildSbtSelectorLoadingOptionsPatch,
  buildSbtSelectorLoadingStatusClassName,
  buildSbtSelectorManualInputTogglePatch,
  buildSbtSelectorManualInputWarningPatch,
  buildSbtSelectorRootClassName,
  buildSbtSelectorSelectedOptionResetPatch,
  buildSbtSelectorSourceSessionSlugPatch,
  getSbtSelectorLoadingOptionCount,
  getSbtSelectorLoadingStatusText,
  isSbtSelectorOptionsLoading,
  resolveSbtSelectorAutoSearchButtonsState,
  resolveSbtSelectorGroupPickerState,
  resolveSbtSelectorGroupSourceSelection,
  resolveSbtSelectorHeaderLoadingStatusState,
  resolveSbtSelectorLabelImageState,
  resolveSbtSelectorLoadingStatusDisplayState,
  resolveSbtSelectorManualControlsState,
  resolveSbtSelectorManualEntryState,
  resolveSbtSelectorNoOptionsMessage,
  resolveSbtSelectorSelectedAddressesState,
  resolveSbtSelectorVariantDisplayState,
} from './sbtSelectorUiStateHelpers';

describe('sbtSelectorUiStateHelpers', () => {
  it('resolves loading and empty-option display state', () => {
    expect(getSbtSelectorLoadingOptionCount([{ value: 'a' }, { value: 'b' }])).toBe(2);
    expect(getSbtSelectorLoadingOptionCount('bad')).toBe(0);
    expect(isSbtSelectorOptionsLoading({ loadingOptions: true })).toBe(true);
    expect(isSbtSelectorOptionsLoading({ discovering: true })).toBe(true);
    expect(isSbtSelectorOptionsLoading({})).toBe(false);
    expect(
      resolveSbtSelectorNoOptionsMessage({
        isLoading: false,
        pluralLabel: 'Badges',
      }),
    ).toBe('No Badges');
    expect(resolveSbtSelectorNoOptionsMessage({ isLoading: true })).toBeNull();
    expect(getSbtSelectorLoadingStatusText({ compact: false, count: 3 })).toBe('Loading 3');
    expect(getSbtSelectorLoadingStatusText({ compact: true, count: 3 })).toBe('Loading 3');
    expect(getSbtSelectorLoadingStatusText({ compact: true, count: 0 })).toBe('Loading');
  });

  it('resolves image and loading status class state', () => {
    const txId = 'a'.repeat(43);
    expect(resolveSbtSelectorLabelImageState({ image: txId })).toEqual({
      imageSrc: expect.stringMatching(/^https?:\/\//),
      shouldRenderImage: true,
    });
    expect(resolveSbtSelectorLabelImageState({ image: '' })).toEqual({
      imageSrc: '',
      shouldRenderImage: false,
    });
    expect(
      resolveSbtSelectorLoadingStatusDisplayState({
        compact: true,
        includeTestId: true,
      }),
    ).toEqual({
      shouldAttachRootTestId: true,
      shouldAttachTextTestId: false,
      shouldUseCompactClass: true,
    });
    expect(
      buildSbtSelectorLoadingStatusClassName({
        baseClassName: 'base',
        compactClassName: 'compact',
        shouldUseCompactClass: true,
      }),
    ).toBe('base compact');
    expect(resolveSbtSelectorHeaderLoadingStatusState({ isLoading: true })).toEqual({
      shouldRenderHeaderLoadingStatus: true,
    });
  });

  it('builds group source and manual entry patches', () => {
    expect(
      resolveSbtSelectorGroupSourceSelection({
        activeSlug: 'Active',
        next: '__active__',
      }),
    ).toEqual({
      groupOverride: false,
      slugOverride: 'Active',
      sourceSessionSlug: 'Active',
    });
    expect(
      resolveSbtSelectorGroupSourceSelection({
        activeSlug: 'Active',
        next: 'Override',
      }),
    ).toEqual({
      groupOverride: true,
      slugOverride: 'Override',
      sourceSessionSlug: 'Override',
    });
    expect(
      buildSbtSelectorGroupSourceSelectionPatch({
        selection: {
          groupOverride: true,
          sourceSessionSlug: 'Override',
        },
      }),
    ).toEqual({
      groupOverride: true,
      sourceSessionSlug: 'Override',
    });
    expect(buildSbtSelectorManualInputTogglePatch({ showManualInput: false })).toEqual({
      manualInputWarning: '',
      showManualInput: true,
    });
    expect(buildSbtSelectorGroupPickerTogglePatch({ showGroupPicker: true })).toEqual({
      showGroupPicker: false,
    });
    expect(buildSbtSelectorCustomAddressInputPatch(' 0xabc ')).toEqual({
      customSBTAddress: ' 0xabc ',
      manualInputWarning: '',
    });
    expect(buildSbtSelectorCustomAddressClearPatch()).toEqual({
      customSBTAddress: '',
      manualInputWarning: '',
    });
  });

  it('resolves manual, selected, and auto-search controls', () => {
    expect(
      resolveSbtSelectorManualEntryState({
        customSBTAddress: '0x00000000000000000000000000000000000000AA',
        isAddress: (value: string) => value.endsWith('AA'),
      }),
    ).toEqual({
      canAddCustomAddress: true,
    });
    expect(
      resolveSbtSelectorManualControlsState({
        manualInputWarning: 'Invalid address',
        showManualInput: true,
      }),
    ).toEqual({
      manualToggleLabel: 'Hide',
      shouldRenderManualEntry: true,
      shouldRenderManualWarning: true,
    });
    expect(
      resolveSbtSelectorSelectedAddressesState({
        selectedSbts: [{ address: '0xabc' }],
      }),
    ).toEqual({
      shouldRenderSelectedAddresses: true,
    });
    expect(resolveSbtSelectorSelectedAddressesState({ selectedSbts: 'bad' })).toEqual({
      shouldRenderSelectedAddresses: false,
    });
    expect(
      resolveSbtSelectorAutoSearchButtonsState({
        autoSearchSessionOptions: [],
        enableGroupSelect: true,
        groupOverride: true,
      }),
    ).toEqual({
      shouldRenderAutoSearchSessionButtons: true,
    });
    expect(
      resolveSbtSelectorAutoSearchButtonsState({
        autoSearchSessionOptions: [{ value: 'alpha' }],
        enableGroupSelect: false,
        groupOverride: true,
      }),
    ).toEqual({
      shouldRenderAutoSearchSessionButtons: false,
    });
  });

  it('resolves group picker, variants, and small selector patches', () => {
    expect(
      resolveSbtSelectorGroupPickerState({
        currentSessionSlug: 'Alpha',
        enableGroupSelect: true,
        groupOverride: false,
        showGroupPicker: false,
      }),
    ).toEqual({
      selectedGroupValue: '__active__',
      shouldRenderGroupPicker: false,
      shouldRenderGroupSettingsButton: true,
    });
    expect(resolveSbtSelectorVariantDisplayState({ variant: 'admin' })).toEqual({
      shouldUseAdminVariant: true,
      shouldUseCreateVariant: false,
    });
    expect(
      buildSbtSelectorRootClassName({
        adminClassName: 'admin',
        baseClassName: 'root',
        variant: 'admin',
      }),
    ).toBe('root admin');
    expect(buildSbtSelectorSourceSessionSlugPatch({ slug: null })).toEqual({
      sourceSessionSlug: '',
    });
    expect(buildSbtSelectorDiscoveringPatch({ discovering: true })).toEqual({
      discovering: true,
    });
    expect(buildSbtSelectorLoadingOptionsPatch({ loadingOptions: 1 })).toEqual({
      loadingOptions: false,
    });
    expect(buildSbtSelectorGroupOptionsPatch({ groupOptions: null })).toEqual({
      groupOptions: [],
    });
    expect(buildSbtSelectorSelectedOptionResetPatch()).toEqual({
      selectedOption: null,
    });
    expect(buildSbtSelectorManualInputWarningPatch({ warning: null })).toEqual({
      manualInputWarning: '',
    });
  });
});
