type UnknownRecord = Record<string, unknown>;
type SbtFilterQuickChipDisplayStateArgs = {
  address?: unknown;
  filterKey?: unknown;
  gateColors?: unknown;
  index?: unknown;
  resolveDisplayLabel?: ((args: { address: string; fallback: string; preferredSlug: string }) => unknown) | null;
  selectedSet?: Set<string> | null;
  sessionSlug?: unknown;
};
type SbtFilterBooleanTogglePatchArgs = {
  state?: unknown;
  stateKey?: unknown;
};
type SbtFilterQuickChipDisplayState = {
  address: string;
  addressLower: string;
  chipLabel: string;
  isDisabled: boolean;
  isSelected: boolean;
  key: string;
  shouldUseSelectedClass: boolean;
  style: Record<string, string | undefined>;
  testId: string;
};
type BuildSbtFilterQuickChipClassNameArgs = {
  baseClassName?: unknown;
  selectedClassName?: unknown;
  shouldUseSelectedClass?: unknown;
};
type ResolveSbtFilterButtonTextArgs = {
  mode?: unknown;
};
type ResolveSbtFilterOptionsVisibilityStateArgs = {
  autoExpand?: unknown;
  hideLoadingOverlay?: unknown;
  loading?: unknown;
  showFilterOptions?: unknown;
};
type SbtFilterOptionsVisibilityState = {
  shouldRenderFilterOptions: boolean;
  shouldRenderLoadingOverlay: boolean;
};
type SbtFilterLayoutStyle = Record<string, string | number>;
type SbtFilterLayoutDisplayState = {
  filterOptionsFrameStyle: SbtFilterLayoutStyle;
  hiddenRootStyle: SbtFilterLayoutStyle;
  loadingOverlayStyle: SbtFilterLayoutStyle;
};
type ResolveSbtFilterPanelDisplayStateArgs = {
  autoExpand?: unknown;
  hasFeaturedSBTs?: unknown;
  hideUI?: unknown;
};
type SbtFilterPanelDisplayState = {
  shouldRenderFilterToggleButton: boolean;
  shouldRenderHiddenRoot: boolean;
  shouldRenderShowAllCheckbox: boolean;
};
type ResolveSbtFilterSurfaceDisplayStateArgs = {
  buttonSurface?: unknown;
};
type SbtFilterSurfaceDisplayState = {
  shouldUseLightSurface: boolean;
};
type BuildSbtFilterSurfaceClassNamesArgs = {
  filterButtonLightClassName?: unknown;
  filterOptionsBaseClassName?: unknown;
  filterOptionsLightClassName?: unknown;
  shouldUseLightSurface?: unknown;
};
type SbtFilterSurfaceClassNames = {
  filterButtonClassName?: string;
  filterOptionsClassName: string;
};
type ResolveSbtFilterModeSectionsStateArgs = {
  mode?: unknown;
};
type SbtFilterModeSectionsState = {
  shouldRenderAddressFilter: boolean;
  shouldRenderQuestionCreatorFilter: boolean;
  shouldRenderQuestionFilter: boolean;
  shouldRenderQuestionResponderFilter: boolean;
  shouldRenderResponderFilter: boolean;
};

const asCacheObject = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

export const hasSbtFilterFeaturedOptions = (defaultFeaturedSBTs: unknown): defaultFeaturedSBTs is unknown[] =>
  Array.isArray(defaultFeaturedSBTs) && defaultFeaturedSBTs.length > 0;

export const buildSbtFilterBooleanTogglePatch = ({
  state = {},
  stateKey = '',
}: SbtFilterBooleanTogglePatchArgs = {}): Record<string, boolean> => {
  const key = String(stateKey || '');
  const source = asCacheObject(state);
  return {
    [key]: !source[key],
  };
};

export const resolveSbtFilterButtonText = ({ mode = '' }: ResolveSbtFilterButtonTextArgs = {}): string =>
  mode === 'questions' || mode === 'questionResponses' || mode === 'creatorAndResponder' ? 'Response Filter' : 'Filter';

export const resolveSbtFilterOptionsVisibilityState = ({
  autoExpand = false,
  hideLoadingOverlay = false,
  loading = false,
  showFilterOptions = false,
}: ResolveSbtFilterOptionsVisibilityStateArgs = {}): SbtFilterOptionsVisibilityState => ({
  shouldRenderFilterOptions: !!autoExpand || !!showFilterOptions,
  shouldRenderLoadingOverlay: !hideLoadingOverlay && !!loading,
});

export const resolveSbtFilterLayoutDisplayState = (): SbtFilterLayoutDisplayState => ({
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

export const resolveSbtFilterPanelDisplayState = ({
  autoExpand = false,
  hasFeaturedSBTs = false,
  hideUI = false,
}: ResolveSbtFilterPanelDisplayStateArgs = {}): SbtFilterPanelDisplayState => ({
  shouldRenderFilterToggleButton: !autoExpand,
  shouldRenderHiddenRoot: !!hideUI,
  shouldRenderShowAllCheckbox: !!hasFeaturedSBTs,
});

export const resolveSbtFilterSurfaceDisplayState = ({
  buttonSurface = '',
}: ResolveSbtFilterSurfaceDisplayStateArgs = {}): SbtFilterSurfaceDisplayState => ({
  shouldUseLightSurface: String(buttonSurface || '') === 'light',
});

export const buildSbtFilterSurfaceClassNames = ({
  filterButtonLightClassName = '',
  filterOptionsBaseClassName = '',
  filterOptionsLightClassName = '',
  shouldUseLightSurface = false,
}: BuildSbtFilterSurfaceClassNamesArgs = {}): SbtFilterSurfaceClassNames => {
  const useLightSurface = !!shouldUseLightSurface;
  const filterButtonClassName = useLightSurface ? String(filterButtonLightClassName || '') || undefined : undefined;
  const filterOptionsClassName = [
    String(filterOptionsBaseClassName || ''),
    useLightSurface ? String(filterOptionsLightClassName || '') : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    filterButtonClassName,
    filterOptionsClassName,
  };
};

export const resolveSbtFilterModeSectionsState = ({
  mode = '',
}: ResolveSbtFilterModeSectionsStateArgs = {}): SbtFilterModeSectionsState => {
  const modeName = String(mode || '');
  return {
    shouldRenderAddressFilter: modeName === 'addresses',
    shouldRenderQuestionCreatorFilter:
      modeName === 'creator' || modeName === 'creatorAndResponder' || modeName === 'questions',
    shouldRenderQuestionFilter:
      modeName === 'creator' ||
      modeName === 'creatorAndResponder' ||
      modeName === 'questions' ||
      modeName === 'questionResponses',
    shouldRenderQuestionResponderFilter:
      modeName === 'responder' || modeName === 'creatorAndResponder' || modeName === 'questionResponses',
    shouldRenderResponderFilter: modeName === 'responder',
  };
};

export const formatSbtFilterQuickChipAddress = (address: unknown): string => {
  const text = String(address || '').trim();
  if (!text) return '';
  if (text.length <= 13) return text;
  return `${text.slice(0, 6)}...${text.slice(-5)}`;
};

export const buildSbtFilterQuickChipDisplayState = ({
  address: addressInput = '',
  filterKey = '',
  gateColors = [],
  index = 0,
  resolveDisplayLabel = null,
  selectedSet = null,
  sessionSlug = '',
}: SbtFilterQuickChipDisplayStateArgs = {}): SbtFilterQuickChipDisplayState => {
  const address = String(addressInput || '').trim();
  const addressLower = address.toLowerCase();
  const colorIndex = Number(index || 0) || 0;
  const colors = Array.isArray(gateColors) ? gateColors : [];
  const backgroundColor = colors.length > 0 ? String(colors[colorIndex % colors.length] || '') : undefined;
  const preferredSlug = String(sessionSlug || '');
  const selectedAddresses = selectedSet instanceof Set ? selectedSet : new Set<string>();
  const isSelected = selectedAddresses.has(addressLower);
  let resolvedLabel = '';
  try {
    resolvedLabel =
      typeof resolveDisplayLabel === 'function'
        ? String(
            resolveDisplayLabel({
              address,
              preferredSlug,
              fallback: 'address',
            }) || '',
          )
        : '';
  } catch (_) {
    resolvedLabel = '';
  }
  const chipLabel =
    resolvedLabel && resolvedLabel.toLowerCase() !== addressLower
      ? resolvedLabel
      : formatSbtFilterQuickChipAddress(address);

  return {
    address,
    addressLower,
    chipLabel,
    isDisabled: isSelected,
    isSelected,
    key: `${filterKey}-${addressLower}-${index}`,
    shouldUseSelectedClass: isSelected,
    style: { backgroundColor },
    testId: `ce-sbt-quick-chip-${filterKey}-${address}`,
  };
};

export const buildSbtFilterQuickChipClassName = ({
  baseClassName = '',
  selectedClassName = '',
  shouldUseSelectedClass = false,
}: BuildSbtFilterQuickChipClassNameArgs = {}): string =>
  [String(baseClassName || ''), shouldUseSelectedClass ? String(selectedClassName || '') : '']
    .filter(Boolean)
    .join(' ');
