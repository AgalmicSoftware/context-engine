import { normalizeSbtListTokenUri, type SbtCardDetails, type SbtListHelperItem } from './sbtListCardDetailsHelpers';

export type SbtListRenderItemKeyOptions<T extends SbtListHelperItem = SbtListHelperItem> = {
  allSessionsMode?: unknown;
  listSlug?: unknown;
  resolveSbtSessionSlug: (sbt: T) => unknown;
};
export type SbtListInteractiveMiniCardModel = {
  key: string;
  sbtAddress: string;
  sbtAddressLower: string;
  sessionSlug: string;
};
export type BuildSbtListInteractiveMiniCardModelOptions<T extends SbtListHelperItem = SbtListHelperItem> = {
  keyPrefix?: unknown;
  resolveSbtSessionSlug: (sbt: T) => unknown;
  sbt?: T | null;
};
export type SbtListDisplayCardModel = {
  description: string;
  imageSrc: string | null;
  key: string;
  locked: boolean;
  name: string;
  sbtAddress: string;
  sbtAddressLower: string;
  sessionSlug: string;
};
export type SbtListDisplayCardAddressMode = 'trimmed' | 'raw';
export type BuildSbtListDisplayCardModelOptions<T extends SbtListHelperItem = SbtListHelperItem> = {
  addressMode?: SbtListDisplayCardAddressMode;
  getDescriptionText: (sbtInfo: unknown) => string;
  getDisplayName: (sbtInfo: unknown) => unknown;
  isPasswordLocked: (sbt: T) => unknown;
  keyPrefix?: unknown;
  resolveSbtSessionSlug: (sbt: T) => unknown;
  sbt?: T | null;
  unnamedLabel?: unknown;
};
export type SbtListMetaRowModel = {
  hasDetailsToggle: boolean;
  hasTags: boolean;
  isExpanded: boolean;
  sbtAddressLower: string;
  tags: string[];
};
export type BuildSbtListMetaRowModelOptions<T extends SbtListHelperItem = SbtListHelperItem> = {
  details?: SbtCardDetails | null;
  expandedSbtAddresses?: ReadonlySet<string> | null;
  miniaturized?: unknown;
  sbt?: T | null;
};
export type SbtListFeaturedCardModel = {
  detailsId: string;
  isExpanded: boolean;
  linkLabel: string;
  sbtAddress: string;
  sbtAddressLower: string;
  sessionSlug: string;
};
export type BuildSbtListFeaturedCardModelOptions<T extends SbtListHelperItem = SbtListHelperItem> = {
  expandedSbtAddresses?: ReadonlySet<string> | null;
  fallbackLabel?: unknown;
  getDisplayName: (sbtInfo: unknown) => unknown;
  resolveSbtSessionSlug: (sbt: T) => unknown;
  sbt?: T | null;
};

type SbtListPointerNavigationLike = {
  altKey?: boolean;
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

const isSbtListCardModelRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

export const normalizeSbtListAddressLower = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

export const buildSbtListRenderItemKey = <T extends SbtListHelperItem>(
  sbt: T,
  { allSessionsMode, listSlug, resolveSbtSessionSlug }: SbtListRenderItemKeyOptions<T>,
): string => {
  const addrLower = normalizeSbtListAddressLower(sbt.sbtAddress);
  const slugForKey = allSessionsMode ? String(resolveSbtSessionSlug(sbt) || '') : String(listSlug || '');
  return `${slugForKey}|${addrLower}`;
};

export const buildSbtListInteractiveMiniCardModel = <T extends SbtListHelperItem>({
  keyPrefix = 'sbt',
  resolveSbtSessionSlug,
  sbt = null,
}: BuildSbtListInteractiveMiniCardModelOptions<T>): SbtListInteractiveMiniCardModel | null => {
  if (!sbt || !sbt.sbtAddress) return null;
  const sessionSlug = String(resolveSbtSessionSlug(sbt) || '');
  const sbtAddress = String(sbt.sbtAddress || '').trim();
  const sbtAddressLower = sbtAddress.toLowerCase();
  if (!sbtAddressLower) return null;
  return {
    key: `${keyPrefix}-${sessionSlug}|${sbtAddressLower}`,
    sbtAddress,
    sbtAddressLower,
    sessionSlug,
  };
};

export const buildSbtListDisplayCardModel = <T extends SbtListHelperItem>({
  addressMode = 'trimmed',
  getDescriptionText,
  getDisplayName,
  isPasswordLocked,
  keyPrefix = 'sbt',
  resolveSbtSessionSlug,
  sbt = null,
  unnamedLabel = 'SBT',
}: BuildSbtListDisplayCardModelOptions<T>): SbtListDisplayCardModel | null => {
  if (!sbt || !sbt.sbtAddress || !sbt.sbtInfo) return null;
  const rawSbtAddress = String(sbt.sbtAddress || '');
  const sbtAddress = addressMode === 'raw' ? rawSbtAddress : rawSbtAddress.trim();
  if (!sbtAddress) return null;
  const sbtInfo = sbt.sbtInfo as unknown;
  const sbtInfoRecord = isSbtListCardModelRecord(sbtInfo) ? sbtInfo : {};
  const sessionSlug = String(resolveSbtSessionSlug(sbt) || '');
  const sbtAddressLower = sbtAddress.toLowerCase();
  const name = String(getDisplayName(sbtInfo) || `Unnamed ${unnamedLabel}`);

  return {
    description: getDescriptionText(sbtInfo),
    imageSrc: normalizeSbtListTokenUri(sbtInfoRecord.image),
    key: `${keyPrefix}-${sessionSlug}|${sbtAddressLower}`,
    locked: !!isPasswordLocked(sbt),
    name,
    sbtAddress,
    sbtAddressLower,
    sessionSlug,
  };
};

export const buildSbtListMetaRowModel = <T extends SbtListHelperItem>({
  details = null,
  expandedSbtAddresses = null,
  miniaturized = false,
  sbt = null,
}: BuildSbtListMetaRowModelOptions<T>): SbtListMetaRowModel | null => {
  const tags = Array.isArray(details?.tags) ? details.tags : [];
  const hasTags = tags.length > 0;
  const hasDetailsToggle = !miniaturized && !!details?.hasDetails;
  if (!hasTags && !hasDetailsToggle) return null;

  const sbtAddressLower = String(sbt?.sbtAddress || '').toLowerCase();
  return {
    hasDetailsToggle,
    hasTags,
    isExpanded: !!expandedSbtAddresses?.has(sbtAddressLower),
    sbtAddressLower,
    tags,
  };
};

export const buildSbtListFeaturedCardModel = <T extends SbtListHelperItem>({
  expandedSbtAddresses = null,
  fallbackLabel = 'SBT',
  getDisplayName,
  resolveSbtSessionSlug,
  sbt = null,
}: BuildSbtListFeaturedCardModelOptions<T>): SbtListFeaturedCardModel | null => {
  if (!sbt || !sbt.sbtAddress) return null;
  const sbtAddress = String(sbt.sbtAddress || '').trim();
  const sessionSlug = String(resolveSbtSessionSlug(sbt) || '');
  const sbtAddressLower = String(sbtAddress || '').toLowerCase();

  return {
    detailsId: `featured-sbt-details-${sbtAddressLower}`,
    isExpanded: !!expandedSbtAddresses?.has(sbtAddressLower),
    linkLabel: String(getDisplayName(sbt.sbtInfo) || sbtAddress || fallbackLabel),
    sbtAddress,
    sbtAddressLower,
    sessionSlug,
  };
};

export const isModifiedSbtListPointerNavigation = (event: SbtListPointerNavigationLike | null | undefined): boolean =>
  !!(event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1));

export const lowerSbtListAddressSet = (values: unknown = []): Set<string> => {
  const out = new Set<string>();
  (Array.isArray(values) ? values : []).forEach((value: unknown) => {
    const addrLower = normalizeSbtListAddressLower(value);
    if (addrLower) out.add(addrLower);
  });
  return out;
};

export const buildSbtListExpandedAddressSetToggle = (previous: unknown, sbtAddress: unknown): Set<string> => {
  const normalized = normalizeSbtListAddressLower(sbtAddress);
  const next = new Set<string>(previous instanceof Set ? Array.from(previous) : []);
  if (!normalized) return next;
  if (next.has(normalized)) {
    next.delete(normalized);
  } else {
    next.add(normalized);
  }
  return next;
};

export const coerceSbtMintEndSeconds = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
};
