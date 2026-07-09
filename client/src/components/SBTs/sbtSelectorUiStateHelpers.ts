import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';

type ResolveSbtSelectorLabelImageStateArgs = {
  image?: unknown;
};
type SbtSelectorLabelImageState = {
  imageSrc: string;
  shouldRenderImage: boolean;
};
type ResolveSbtSelectorLoadingStatusDisplayStateArgs = {
  compact?: unknown;
  includeTestId?: unknown;
};
type SbtSelectorLoadingStatusDisplayState = {
  shouldAttachRootTestId: boolean;
  shouldAttachTextTestId: boolean;
  shouldUseCompactClass: boolean;
};
type BuildSbtSelectorLoadingStatusClassNameArgs = {
  baseClassName?: unknown;
  compactClassName?: unknown;
  shouldUseCompactClass?: unknown;
};
type ResolveSbtSelectorHeaderLoadingStatusStateArgs = {
  isLoading?: unknown;
};
type SbtSelectorHeaderLoadingStatusState = {
  shouldRenderHeaderLoadingStatus: boolean;
};
type ResolveSbtSelectorGroupSourceSelectionArgs = {
  activeSlug?: unknown;
  next?: unknown;
};
type SbtSelectorGroupSourceSelection = {
  groupOverride: boolean;
  slugOverride: string;
  sourceSessionSlug: string;
};
type BuildSbtSelectorGroupSourceSelectionPatchArgs = {
  selection?: unknown;
};
type SbtSelectorGroupSourceSelectionPatch = {
  groupOverride: boolean;
  sourceSessionSlug: string;
};
type SbtSelectorToggleStateLike = {
  showGroupPicker?: unknown;
  showManualInput?: unknown;
};
type SbtSelectorManualInputTogglePatch = {
  manualInputWarning: string;
  showManualInput: boolean;
};
type SbtSelectorGroupPickerTogglePatch = {
  showGroupPicker: boolean;
};
type SbtSelectorCustomAddressInputPatch = {
  customSBTAddress: string;
  manualInputWarning: string;
};
type ResolveSbtSelectorManualEntryStateArgs = {
  customSBTAddress?: unknown;
  isAddress?: (value: string) => boolean;
};
type SbtSelectorManualEntryState = {
  canAddCustomAddress: boolean;
};
type ResolveSbtSelectorManualControlsStateArgs = {
  manualInputWarning?: unknown;
  showManualInput?: unknown;
};
type SbtSelectorManualControlsState = {
  manualToggleLabel: string;
  shouldRenderManualEntry: boolean;
  shouldRenderManualWarning: boolean;
};
type ResolveSbtSelectorSelectedAddressesStateArgs = {
  selectedSbts?: unknown;
};
type SbtSelectorSelectedAddressesState = {
  shouldRenderSelectedAddresses: boolean;
};
type ResolveSbtSelectorAutoSearchButtonsStateArgs = {
  autoSearchSessionOptions?: unknown;
  enableGroupSelect?: unknown;
  groupOverride?: unknown;
};
type SbtSelectorAutoSearchButtonsState = {
  shouldRenderAutoSearchSessionButtons: boolean;
};
type ResolveSbtSelectorGroupPickerStateArgs = {
  currentSessionSlug?: unknown;
  enableGroupSelect?: unknown;
  groupOverride?: unknown;
  showGroupPicker?: unknown;
};
type SbtSelectorGroupPickerState = {
  selectedGroupValue: string;
  shouldRenderGroupPicker: boolean;
  shouldRenderGroupSettingsButton: boolean;
};
type ResolveSbtSelectorVariantDisplayStateArgs = {
  variant?: unknown;
};
type SbtSelectorVariantDisplayState = {
  shouldUseAdminVariant: boolean;
  shouldUseCreateVariant: boolean;
};
type BuildSbtSelectorRootClassNameArgs = {
  adminClassName?: unknown;
  baseClassName?: unknown;
  createClassName?: unknown;
  variant?: unknown;
};
type BuildSbtSelectorSourceSessionSlugPatchArgs = {
  slug?: unknown;
};
type SbtSelectorSourceSessionSlugPatch = {
  sourceSessionSlug: string;
};
type BuildSbtSelectorDiscoveringPatchArgs = {
  discovering?: unknown;
};
type SbtSelectorDiscoveringPatch = {
  discovering: boolean;
};
type BuildSbtSelectorLoadingOptionsPatchArgs = {
  loadingOptions?: unknown;
};
type SbtSelectorLoadingOptionsPatch = {
  loadingOptions: boolean;
};
type BuildSbtSelectorGroupOptionsPatchArgs<TGroupOption = unknown> = {
  groupOptions?: TGroupOption[] | unknown;
};
type SbtSelectorGroupOptionsPatch<TGroupOption = unknown> = {
  groupOptions: TGroupOption[];
};
type SbtSelectorSelectedOptionResetPatch = {
  selectedOption: null;
};
type BuildSbtSelectorManualInputWarningPatchArgs = {
  warning?: unknown;
};
type SbtSelectorManualInputWarningPatch = {
  manualInputWarning: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const getSbtSelectorLoadingOptionCount = (sbtOptions: unknown): number =>
  Math.max(0, Array.isArray(sbtOptions) ? sbtOptions.length : 0);

export const isSbtSelectorOptionsLoading = (state: unknown = {}): boolean => {
  const record = isRecord(state) ? state : {};
  return !!(record.loadingOptions || record.discovering);
};

export const resolveSbtSelectorNoOptionsMessage = ({
  isLoading = false,
  pluralLabel = 'SBTs',
}: {
  isLoading?: unknown;
  pluralLabel?: unknown;
} = {}): string | null => (isLoading ? null : `No ${String(pluralLabel || 'SBTs')}`);

export const resolveSbtSelectorLabelImageState = ({
  image = null,
}: ResolveSbtSelectorLabelImageStateArgs = {}): SbtSelectorLabelImageState => {
  const shouldRenderImage = !!image;
  return {
    imageSrc: shouldRenderImage ? normalizeArweaveUrl(String(image), { contextLabel: 'sbt_selector_image' }) : '',
    shouldRenderImage,
  };
};

export const resolveSbtSelectorLoadingStatusDisplayState = ({
  compact = false,
  includeTestId = false,
}: ResolveSbtSelectorLoadingStatusDisplayStateArgs = {}): SbtSelectorLoadingStatusDisplayState => ({
  shouldAttachRootTestId: !!includeTestId,
  shouldAttachTextTestId: !compact,
  shouldUseCompactClass: !!compact,
});

export const buildSbtSelectorLoadingStatusClassName = ({
  baseClassName = '',
  compactClassName = '',
  shouldUseCompactClass = false,
}: BuildSbtSelectorLoadingStatusClassNameArgs = {}): string =>
  [String(baseClassName || ''), shouldUseCompactClass ? String(compactClassName || '') : ''].filter(Boolean).join(' ');

export const resolveSbtSelectorHeaderLoadingStatusState = ({
  isLoading = false,
}: ResolveSbtSelectorHeaderLoadingStatusStateArgs = {}): SbtSelectorHeaderLoadingStatusState => ({
  shouldRenderHeaderLoadingStatus: !!isLoading,
});

export const getSbtSelectorLoadingStatusText = ({
  compact = false,
  count = 0,
}: {
  compact?: boolean;
  count?: unknown;
} = {}): string => {
  const safeCount = Math.max(0, Number(count || 0) || 0);
  const hasCount = safeCount > 0;
  return compact ? (hasCount ? `Loading ${safeCount}` : 'Loading') : hasCount ? `Loading ${safeCount}` : 'Loading';
};

export const resolveSbtSelectorGroupSourceSelection = ({
  activeSlug = '',
  next = '',
}: ResolveSbtSelectorGroupSourceSelectionArgs = {}): SbtSelectorGroupSourceSelection => {
  const resolvedActiveSlug = String(activeSlug || '');
  const nextSlug = String(next || '');
  if (nextSlug === '__active__') {
    return {
      groupOverride: false,
      slugOverride: resolvedActiveSlug,
      sourceSessionSlug: resolvedActiveSlug,
    };
  }
  return {
    groupOverride: true,
    slugOverride: nextSlug,
    sourceSessionSlug: nextSlug,
  };
};

export const buildSbtSelectorManualInputTogglePatch = (
  prevState: SbtSelectorToggleStateLike = {},
): SbtSelectorManualInputTogglePatch => ({
  manualInputWarning: '',
  showManualInput: !prevState.showManualInput,
});

export const buildSbtSelectorGroupPickerTogglePatch = (
  prevState: SbtSelectorToggleStateLike = {},
): SbtSelectorGroupPickerTogglePatch => ({
  showGroupPicker: !prevState.showGroupPicker,
});

export const buildSbtSelectorGroupSourceSelectionPatch = ({
  selection = null,
}: BuildSbtSelectorGroupSourceSelectionPatchArgs = {}): SbtSelectorGroupSourceSelectionPatch => {
  const safeSelection = isRecord(selection) ? selection : {};
  return {
    groupOverride: Boolean(safeSelection.groupOverride),
    sourceSessionSlug: String(safeSelection.sourceSessionSlug ?? ''),
  };
};

export const buildSbtSelectorCustomAddressInputPatch = (value: unknown): SbtSelectorCustomAddressInputPatch => ({
  customSBTAddress: String(value ?? ''),
  manualInputWarning: '',
});

export const buildSbtSelectorCustomAddressClearPatch = (): SbtSelectorCustomAddressInputPatch => ({
  customSBTAddress: '',
  manualInputWarning: '',
});

export const resolveSbtSelectorManualEntryState = ({
  customSBTAddress = '',
  isAddress = () => false,
}: ResolveSbtSelectorManualEntryStateArgs = {}): SbtSelectorManualEntryState => {
  const address = String(customSBTAddress || '');
  return {
    canAddCustomAddress: isAddress(address),
  };
};

export const resolveSbtSelectorManualControlsState = ({
  manualInputWarning = '',
  showManualInput = false,
}: ResolveSbtSelectorManualControlsStateArgs = {}): SbtSelectorManualControlsState => ({
  manualToggleLabel: showManualInput ? 'Hide' : '+ By Address',
  shouldRenderManualEntry: !!showManualInput,
  shouldRenderManualWarning: !!manualInputWarning,
});

export const resolveSbtSelectorSelectedAddressesState = ({
  selectedSbts = [],
}: ResolveSbtSelectorSelectedAddressesStateArgs = {}): SbtSelectorSelectedAddressesState => ({
  shouldRenderSelectedAddresses: Array.isArray(selectedSbts) && selectedSbts.length > 0,
});

export const resolveSbtSelectorAutoSearchButtonsState = ({
  autoSearchSessionOptions = [],
  enableGroupSelect = false,
  groupOverride = false,
}: ResolveSbtSelectorAutoSearchButtonsStateArgs = {}): SbtSelectorAutoSearchButtonsState => ({
  shouldRenderAutoSearchSessionButtons: Boolean(
    enableGroupSelect &&
    (groupOverride || (Array.isArray(autoSearchSessionOptions) && autoSearchSessionOptions.length > 0)),
  ),
});

export const resolveSbtSelectorGroupPickerState = ({
  currentSessionSlug = '',
  enableGroupSelect = false,
  groupOverride = false,
  showGroupPicker = false,
}: ResolveSbtSelectorGroupPickerStateArgs = {}): SbtSelectorGroupPickerState => ({
  selectedGroupValue: groupOverride ? String(currentSessionSlug || '') : '__active__',
  shouldRenderGroupPicker: !!enableGroupSelect && !!showGroupPicker,
  shouldRenderGroupSettingsButton: !!enableGroupSelect,
});

export const resolveSbtSelectorVariantDisplayState = ({
  variant = '',
}: ResolveSbtSelectorVariantDisplayStateArgs = {}): SbtSelectorVariantDisplayState => {
  const normalizedVariant = String(variant || '');
  return {
    shouldUseAdminVariant: normalizedVariant === 'admin',
    shouldUseCreateVariant: normalizedVariant === 'create',
  };
};

export const buildSbtSelectorRootClassName = ({
  adminClassName = '',
  baseClassName = '',
  createClassName = '',
  variant = '',
}: BuildSbtSelectorRootClassNameArgs = {}): string => {
  const variantDisplayState = resolveSbtSelectorVariantDisplayState({ variant });
  return [
    String(baseClassName || ''),
    variantDisplayState.shouldUseAdminVariant ? String(adminClassName || '') : '',
    variantDisplayState.shouldUseCreateVariant ? String(createClassName || '') : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
};

export const buildSbtSelectorSourceSessionSlugPatch = ({
  slug = '',
}: BuildSbtSelectorSourceSessionSlugPatchArgs = {}): SbtSelectorSourceSessionSlugPatch => ({
  sourceSessionSlug: String(slug ?? ''),
});

export const buildSbtSelectorDiscoveringPatch = ({
  discovering = false,
}: BuildSbtSelectorDiscoveringPatchArgs = {}): SbtSelectorDiscoveringPatch => ({
  discovering: discovering === true,
});

export const buildSbtSelectorLoadingOptionsPatch = ({
  loadingOptions = false,
}: BuildSbtSelectorLoadingOptionsPatchArgs = {}): SbtSelectorLoadingOptionsPatch => ({
  loadingOptions: loadingOptions === true,
});

export function buildSbtSelectorGroupOptionsPatch<TGroupOption>(args: {
  groupOptions: TGroupOption[];
}): SbtSelectorGroupOptionsPatch<TGroupOption>;
export function buildSbtSelectorGroupOptionsPatch(
  args?: BuildSbtSelectorGroupOptionsPatchArgs,
): SbtSelectorGroupOptionsPatch;
export function buildSbtSelectorGroupOptionsPatch({
  groupOptions = [],
}: BuildSbtSelectorGroupOptionsPatchArgs = {}): SbtSelectorGroupOptionsPatch {
  return {
    groupOptions: Array.isArray(groupOptions) ? groupOptions : [],
  };
}

export const buildSbtSelectorSelectedOptionResetPatch = (): SbtSelectorSelectedOptionResetPatch => ({
  selectedOption: null,
});

export const buildSbtSelectorManualInputWarningPatch = ({
  warning = '',
}: BuildSbtSelectorManualInputWarningPatchArgs = {}): SbtSelectorManualInputWarningPatch => ({
  manualInputWarning: String(warning ?? ''),
});
