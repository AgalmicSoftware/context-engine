import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import type { SbtListHelperItem, SbtListHelperRecord } from './sbtListCardDetailsHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

type ResolveSbtListConcreteSessionBindingSlugOptions = {
  getSessionSlugByName?: (sessionName: string) => unknown;
};

type ResolveSbtListItemSessionSlugOptions<T extends SbtListHelperItem = SbtListHelperItem> = {
  allSessionsMode?: unknown;
  isListModeScopeEnabled?: unknown;
  listSlug?: unknown;
  resolveConcreteSessionBindingSlug?: (sbt: T | null | undefined) => string | null;
};

export const isSbtListHelperRecord = (value: unknown): value is SbtListHelperRecord =>
  !!value && typeof value === 'object';

export const hasSbtListOwn = (obj: unknown, key: PropertyKey): boolean =>
  isSbtListHelperRecord(obj) && Object.prototype.hasOwnProperty.call(obj, key);

export const hasSbtListAuthoritativeSessionSlug = (obj: unknown): boolean => {
  const record = isSbtListHelperRecord(obj) ? obj : {};
  if (!hasSbtListOwn(obj, 'sessionSlug')) return false;
  const hasExplicitFlag = hasSbtListOwn(obj, 'sessionSlugExplicit');
  return record.sessionSlugExplicit === true || !hasExplicitFlag;
};

export const hasSbtListExplicitNoSessionAssociation = (sbt: unknown): boolean => {
  const record = isSbtListHelperRecord(sbt) ? (sbt as SbtListHelperItem) : {};
  const info = isSbtListHelperRecord(record.sbtInfo) ? record.sbtInfo : {};
  if (hasSbtListAuthoritativeSessionSlug(info)) {
    return String(info.sessionSlug ?? '').trim() === '';
  }
  if (hasSbtListAuthoritativeSessionSlug(record)) {
    return String(record.sessionSlug ?? '').trim() === '';
  }
  return false;
};

export const hasSbtListMetadataSessionSlugField = (sbt: unknown): boolean => {
  const record = isSbtListHelperRecord(sbt) ? (sbt as SbtListHelperItem) : {};
  return hasSbtListOwn(record.sbtInfo, 'sessionSlug') || hasSbtListOwn(record, 'sessionSlug');
};

export const hasSbtListMissingOrEmptySessionSlug = (sbt: unknown): boolean => {
  const record = isSbtListHelperRecord(sbt) ? (sbt as SbtListHelperItem) : {};
  const info = isSbtListHelperRecord(record.sbtInfo) ? record.sbtInfo : {};
  if (!hasSbtListMetadataSessionSlugField(record)) return true;
  return String(info.sessionSlug ?? record.sessionSlug ?? '').trim() === '';
};

export const resolveSbtListConcreteSessionBindingSlug = <T extends SbtListHelperItem = SbtListHelperItem>(
  sbt: T | null | undefined,
  { getSessionSlugByName = () => null }: ResolveSbtListConcreteSessionBindingSlugOptions = {},
): string | null => {
  const sbtInfo = isSbtListHelperRecord(sbt?.sbtInfo) ? sbt.sbtInfo : {};

  if (hasSbtListAuthoritativeSessionSlug(sbtInfo)) {
    return normalizeSessionSlug(sbtInfo?.sessionSlug || '');
  }
  if (hasSbtListAuthoritativeSessionSlug(sbt)) {
    return normalizeSessionSlug(sbt?.sessionSlug || '');
  }

  const legacySlugRaw = sbtInfo?.slug;
  if (legacySlugRaw != null && String(legacySlugRaw).trim() !== '') {
    return normalizeSessionSlug(legacySlugRaw);
  }

  const hasInferredSessionSlug =
    (hasSbtListOwn(sbtInfo, 'sessionSlug') && sbtInfo?.sessionSlugExplicit === false) ||
    (hasSbtListOwn(sbt, 'sessionSlug') && sbt?.sessionSlugExplicit === false);
  if (hasInferredSessionSlug) return null;

  const legacySessionName = String(sbtInfo?.sessionName ?? sbt?.sessionName ?? '').trim();
  if (!legacySessionName) return null;

  const mappedSlug = getSessionSlugByName(legacySessionName);
  if (mappedSlug == null) return null;
  return normalizeSessionSlug(mappedSlug);
};

export const resolveSbtListItemSessionSlug = <T extends SbtListHelperItem = SbtListHelperItem>(
  sbt: T | null | undefined,
  {
    allSessionsMode = false,
    isListModeScopeEnabled = false,
    listSlug = '',
    resolveConcreteSessionBindingSlug = (item) => resolveSbtListConcreteSessionBindingSlug(item),
  }: ResolveSbtListItemSessionSlugOptions<T> = {},
): string => {
  const sbtInfo = isSbtListHelperRecord(sbt?.sbtInfo) ? sbt.sbtInfo : {};
  const sourceSlug = normalizeSessionSlug(sbt?.__sourceSessionSlug ?? sbt?.slug ?? sbt?.sessionSlug ?? '');
  if (allSessionsMode && hasSbtListExplicitNoSessionAssociation(sbt)) {
    return SBT_LIST_NO_SESSION_UNIVERSE_SLUG;
  }
  const hasMetadataSessionSlug = hasSbtListOwn(sbtInfo, 'sessionSlug') || hasSbtListOwn(sbt, 'sessionSlug');
  const metadataSessionSlug = hasMetadataSessionSlug
    ? normalizeSessionSlug(sbtInfo?.sessionSlug ?? sbt?.sessionSlug ?? '')
    : null;
  const hasAuthoritativeMetadataSessionSlug =
    hasSbtListAuthoritativeSessionSlug(sbtInfo) || hasSbtListAuthoritativeSessionSlug(sbt);

  if (allSessionsMode && isListModeScopeEnabled) {
    const concreteBindingSlug = resolveConcreteSessionBindingSlug(sbt);
    if (concreteBindingSlug != null) {
      return concreteBindingSlug === '' ? SBT_LIST_NO_SESSION_UNIVERSE_SLUG : concreteBindingSlug;
    }
    if (hasSbtListMissingOrEmptySessionSlug(sbt)) {
      return SBT_LIST_NO_SESSION_UNIVERSE_SLUG;
    }
    return SBT_LIST_NO_SESSION_UNIVERSE_SLUG;
  }
  if (hasSbtListAuthoritativeSessionSlug(sbtInfo)) {
    return normalizeSessionSlug(sbtInfo?.sessionSlug || '');
  }
  if (hasSbtListAuthoritativeSessionSlug(sbt)) {
    return normalizeSessionSlug(sbt?.sessionSlug || '');
  }
  if (
    metadataSessionSlug != null &&
    metadataSessionSlug !== sourceSlug &&
    !hasAuthoritativeMetadataSessionSlug &&
    sourceSlug
  ) {
    return sourceSlug;
  }

  const legacyRaw = sbtInfo?.sessionSlug ?? sbtInfo?.slug ?? sbt?.sessionSlug ?? sbt?.slug;
  if (legacyRaw != null && String(legacyRaw).trim() !== '') {
    return normalizeSessionSlug(legacyRaw);
  }
  if (allSessionsMode) return SBT_LIST_NO_SESSION_UNIVERSE_SLUG;
  return normalizeSessionSlug(listSlug || '');
};
