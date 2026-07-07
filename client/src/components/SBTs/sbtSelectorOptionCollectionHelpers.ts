import { getSelectableSbtKey, normalizeSelectableSbtAddress } from './sbtSelectorSelectionKeyHelpers';

type SbtSelectorSelectedOrPendingAddressArgs = {
  address?: unknown;
  pendingAddresses?: Set<string> | null;
  selectedAddresses?: Set<string> | null;
};
type SbtSelectorSelectedOrPendingKeyArgs = {
  pendingKeys?: Set<string> | null;
  selectedKeys?: Set<string> | null;
  value?: unknown;
};
type BuildSbtSelectorMergedSelectableOptionsArgs = {
  additionalOptions?: unknown;
  sbtOptions?: unknown;
};
type ResolveSbtSelectorDisplayOptionsArgs = {
  defaultFeaturedSBTs?: unknown;
  limitToFeatured?: unknown;
  mergedSbtOptions?: unknown;
  scopeFeaturedAddresses?: unknown;
};
type ResolveSbtSelectorDisplayOptionsResult<T extends Record<string, unknown>> = {
  displayOptions: T[];
  effectiveFeatured: unknown[];
  hasFeaturedSBTs: boolean;
};
type SbtSelectorSelectOption = {
  chainId?: unknown;
  image?: unknown;
  label: string;
  selectionKey: string;
  value: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const buildSbtOptionsByAddress = <T extends Record<string, unknown> = Record<string, unknown>>(
  sbtOptionsInput: unknown,
): Map<string, T> => {
  const byAddress = new Map<string, T>();
  (Array.isArray(sbtOptionsInput) ? sbtOptionsInput : []).forEach((entry: unknown) => {
    const record = isRecord(entry) ? (entry as T) : null;
    if (!record) return;
    const key = String(record.address || '').toLowerCase();
    if (!key || byAddress.has(key)) return;
    byAddress.set(key, record);
  });
  return byAddress;
};

export const buildSbtOptionsBySelectionKey = <T extends Record<string, unknown> = Record<string, unknown>>(
  sbtOptionsInput: unknown,
): Map<string, T> => {
  const bySelectionKey = new Map<string, T>();
  (Array.isArray(sbtOptionsInput) ? sbtOptionsInput : []).forEach((entry: unknown) => {
    const record = isRecord(entry) ? (entry as T) : null;
    if (!record) return;
    const key = getSelectableSbtKey(record);
    if (!key || bySelectionKey.has(key)) return;
    bySelectionKey.set(key, record);
  });
  return bySelectionKey;
};

export const buildSbtSelectorMergedSelectableOptions = <T extends Record<string, unknown> = Record<string, unknown>>({
  additionalOptions = [],
  sbtOptions = [],
}: BuildSbtSelectorMergedSelectableOptionsArgs = {}): T[] => {
  const baseOptions = Array.isArray(sbtOptions) ? (sbtOptions as T[]) : [];
  const extraOptions = Array.isArray(additionalOptions) ? (additionalOptions as T[]) : [];
  return [
    ...baseOptions,
    ...extraOptions.filter(
      (entry: T) =>
        !baseOptions.some(
          (existing: T) => String(existing?.address || '').toLowerCase() === String(entry?.address || '').toLowerCase(),
        ),
    ),
  ];
};

export const resolveSbtSelectorDisplayOptions = <T extends Record<string, unknown> = Record<string, unknown>>({
  defaultFeaturedSBTs = [],
  limitToFeatured = false,
  mergedSbtOptions = [],
  scopeFeaturedAddresses = [],
}: ResolveSbtSelectorDisplayOptionsArgs = {}): ResolveSbtSelectorDisplayOptionsResult<T> => {
  const options = Array.isArray(mergedSbtOptions) ? (mergedSbtOptions as T[]) : [];
  const effectiveFeatured =
    Array.isArray(scopeFeaturedAddresses) && scopeFeaturedAddresses.length > 0
      ? scopeFeaturedAddresses
      : Array.isArray(defaultFeaturedSBTs)
        ? defaultFeaturedSBTs
        : [];
  const hasFeaturedSBTs = effectiveFeatured.length > 0;
  if (!hasFeaturedSBTs || limitToFeatured !== true) {
    return { displayOptions: options, effectiveFeatured, hasFeaturedSBTs };
  }

  const featuredLower = new Set<string>(effectiveFeatured.map((addr: unknown) => String(addr || '').toLowerCase()));
  return {
    displayOptions: options.filter((opt: T) => featuredLower.has(String(opt?.address || '').toLowerCase())),
    effectiveFeatured,
    hasFeaturedSBTs,
  };
};

export const buildSbtSelectorSelectOptions = (displayOptions: unknown): SbtSelectorSelectOption[] =>
  (Array.isArray(displayOptions) ? displayOptions : []).map((sbt: unknown) => {
    const record = isRecord(sbt) ? sbt : {};
    return {
      value: String(record.address || ''),
      selectionKey: getSelectableSbtKey(record),
      label: String(record.name || ''),
      image: record.image,
      chainId: record.chainId,
    };
  });

export const buildSelectedSbtKeySet = (selectedSbts: unknown): Set<string> =>
  new Set(
    (Array.isArray(selectedSbts) ? selectedSbts : []).map((sbt: unknown) => getSelectableSbtKey(sbt)).filter(Boolean),
  );

export const buildSelectedSbtAddressSet = (selectedSbts: unknown): Set<string> =>
  new Set(
    (Array.isArray(selectedSbts) ? selectedSbts : [])
      .map((sbt: unknown) => {
        const record = isRecord(sbt) ? sbt : {};
        return normalizeSelectableSbtAddress(record.address);
      })
      .filter(Boolean),
  );

export const buildEffectiveFeaturedAddressSet = ({
  scopeFeaturedAddresses,
  defaultFeaturedSBTs,
}: {
  defaultFeaturedSBTs?: unknown;
  scopeFeaturedAddresses?: unknown;
} = {}): Set<string> =>
  new Set(
    (Array.isArray(scopeFeaturedAddresses) && scopeFeaturedAddresses.length > 0
      ? scopeFeaturedAddresses
      : Array.isArray(defaultFeaturedSBTs)
        ? defaultFeaturedSBTs
        : []
    )
      .map((address: unknown) => normalizeSelectableSbtAddress(address))
      .filter(Boolean),
  );

export const hasSelectedOrPendingSbtSelectorAddress = ({
  address = '',
  pendingAddresses = null,
  selectedAddresses = null,
}: SbtSelectorSelectedOrPendingAddressArgs = {}): boolean => {
  const normalizedAddress = normalizeSelectableSbtAddress(address);
  if (!normalizedAddress) return false;
  return !!(selectedAddresses?.has(normalizedAddress) || pendingAddresses?.has(normalizedAddress));
};

export const hasSelectedOrPendingSbtSelectorKey = ({
  pendingKeys = null,
  selectedKeys = null,
  value = null,
}: SbtSelectorSelectedOrPendingKeyArgs = {}): boolean => {
  const normalizedKey = getSelectableSbtKey(value);
  if (!normalizedKey) return false;
  return !!(selectedKeys?.has(normalizedKey) || pendingKeys?.has(normalizedKey));
};
