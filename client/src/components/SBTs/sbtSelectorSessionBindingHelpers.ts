import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { getSessionSlugByName } from '../../utilities/web3/chainGateway.js';

type ScopedSbtIgnoreKeyArgs = {
  address?: unknown;
  slug?: unknown;
};
type SbtDetailLinkSessionSlugArgs = {
  fallbackSlug?: unknown;
  sbt?: unknown;
};
type SbtSessionSlugRecord = Record<string, unknown> & {
  sessionName?: unknown;
  sessionSlug?: unknown;
  sessionSlugExplicit?: unknown;
  slug?: unknown;
  sbtInfo?: Record<string, unknown> & {
    sessionName?: unknown;
    sessionSlug?: unknown;
    sessionSlugExplicit?: unknown;
    slug?: unknown;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const pickNormalizedSessionSlug = (...values: unknown[]): string => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = normalizeSessionSlug(value);
    if (normalized != null) return normalized;
  }
  return '';
};

export const pickOptionalNormalizedSessionSlug = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = normalizeSessionSlug(value);
    if (normalized != null) return normalized;
  }
  return null;
};

export const hasOwn = (value: unknown, key: PropertyKey): boolean =>
  isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);

export const buildScopedSbtIgnoreKey = ({ slug, address }: ScopedSbtIgnoreKeyArgs = {}): string => {
  const lowerAddress = String(address || '')
    .trim()
    .toLowerCase();
  if (!lowerAddress) return '';
  return `${pickNormalizedSessionSlug(slug)}|${lowerAddress}`;
};

export const hasAuthoritativeSessionSlug = (value: unknown): boolean => {
  const record = isRecord(value) ? value : {};
  if (!hasOwn(value, 'sessionSlug')) return false;
  const hasExplicitFlag = hasOwn(value, 'sessionSlugExplicit');
  return record.sessionSlugExplicit === true || !hasExplicitFlag;
};

export const resolveAuthoritativeSbtSessionBindingSlug = (sbt: unknown): string | null => {
  const record = isRecord(sbt) ? (sbt as SbtSessionSlugRecord) : {};
  const sbtInfo = isRecord(record.sbtInfo) ? record.sbtInfo : {};

  if (hasAuthoritativeSessionSlug(sbtInfo)) {
    return normalizeSessionSlug(sbtInfo.sessionSlug || '');
  }
  if (hasAuthoritativeSessionSlug(record)) {
    return normalizeSessionSlug(record.sessionSlug || '');
  }

  const legacySlugRaw = sbtInfo.slug;
  if (legacySlugRaw != null && String(legacySlugRaw).trim() !== '') {
    return normalizeSessionSlug(legacySlugRaw);
  }
  return null;
};

export const resolveDeclaredSbtSessionSlug = (sbt: unknown): string | null => {
  const record = isRecord(sbt) ? (sbt as SbtSessionSlugRecord) : {};
  const sbtInfo = isRecord(record.sbtInfo) ? record.sbtInfo : {};
  if (hasOwn(sbtInfo, 'sessionSlug')) {
    return normalizeSessionSlug(sbtInfo.sessionSlug || '');
  }
  if (hasOwn(record, 'sessionSlug')) {
    return normalizeSessionSlug(record.sessionSlug || '');
  }
  return null;
};

export const resolveConcreteSbtSessionBindingSlug = (sbt: unknown): string | null => {
  const record = isRecord(sbt) ? (sbt as SbtSessionSlugRecord) : {};
  const authoritativeSlug = resolveAuthoritativeSbtSessionBindingSlug(sbt);
  if (authoritativeSlug != null) return authoritativeSlug;

  const sbtInfo = isRecord(record.sbtInfo) ? record.sbtInfo : {};

  const hasInferredSessionSlug =
    (hasOwn(sbtInfo, 'sessionSlug') && sbtInfo.sessionSlugExplicit === false) ||
    (hasOwn(record, 'sessionSlug') && record.sessionSlugExplicit === false);
  if (hasInferredSessionSlug) return null;

  const legacySessionName = String(sbtInfo.sessionName ?? record.sessionName ?? '').trim();
  if (!legacySessionName) return null;

  const mappedSlug = getSessionSlugByName(legacySessionName);
  if (mappedSlug == null) return null;
  return normalizeSessionSlug(mappedSlug);
};

export const resolveSbtDetailLinkSessionSlug = ({
  sbt,
  fallbackSlug = '',
}: SbtDetailLinkSessionSlugArgs = {}): string => {
  const record = isRecord(sbt) ? sbt : {};
  const sbtInfo = isRecord(record.sbtInfo) ? record.sbtInfo : {};
  const explicitBindingSlug = pickOptionalNormalizedSessionSlug(
    hasOwn(record, 'sessionBindingSlug') ? record.sessionBindingSlug : undefined,
    hasAuthoritativeSessionSlug(sbtInfo) ? normalizeSessionSlug(sbtInfo.sessionSlug || '') : undefined,
    hasOwn(record, 'sessionSlug') && record.sessionSlugExplicit === true
      ? normalizeSessionSlug(record.sessionSlug || '')
      : undefined,
  );
  if (explicitBindingSlug != null) return explicitBindingSlug;

  const metadataSessionName = String(sbtInfo.sessionName ?? record.sessionName ?? '').trim();
  if (metadataSessionName) {
    const byName = getSessionSlugByName(metadataSessionName);
    if (byName != null) return normalizeSessionSlug(byName);
  }

  const existingSelectedSlug = pickOptionalNormalizedSessionSlug(record.sessionSlug);
  if (existingSelectedSlug != null) return existingSelectedSlug;

  return pickNormalizedSessionSlug(fallbackSlug);
};
