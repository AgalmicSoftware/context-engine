import { hasSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { normalizeChainValue } from './sbtSelectorSessionRuntimeHelpers';
import {
  hasOwn,
  pickNormalizedSessionSlug,
  pickOptionalNormalizedSessionSlug,
  resolveConcreteSbtSessionBindingSlug,
} from './sbtSelectorSessionBindingHelpers';

type SbtSelectorScopedEntryLike = Record<string, unknown> & {
  address?: unknown;
  chainId?: unknown;
  sbtInfo?:
    | (Record<string, unknown> & {
        chainID?: unknown;
        chainId?: unknown;
      })
    | null;
  slug?: unknown;
};
export type SbtSelectorScopedEntry = SbtSelectorScopedEntryLike & {
  __sourceSessionSlug?: unknown;
  sbtAddress?: unknown;
  sessionBindingSlug?: unknown;
  sbtInfo?:
    | (Record<string, unknown> & {
        chainID?: unknown;
        chainId?: unknown;
        image?: unknown;
      })
    | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const resolveSbtEntryChainId = (entry: unknown, fallbackChainId: unknown = null): number | null => {
  const record = isRecord(entry) ? (entry as SbtSelectorScopedEntryLike) : {};
  return normalizeChainValue(record.chainId || record.sbtInfo?.chainId || record.sbtInfo?.chainID || fallbackChainId);
};

export const decorateScopedSbtEntry = (entry: unknown, fallbackSlug: unknown = ''): SbtSelectorScopedEntry => {
  const next = isRecord(entry) ? ({ ...entry } as SbtSelectorScopedEntry) : {};
  const sourceSlug = pickNormalizedSessionSlug(
    hasOwn(next, '__sourceSessionSlug') ? next.__sourceSessionSlug : undefined,
    next.slug,
    fallbackSlug,
  );
  const sessionBindingSlug = pickOptionalNormalizedSessionSlug(
    hasOwn(next, 'sessionBindingSlug') ? next.sessionBindingSlug : undefined,
    resolveConcreteSbtSessionBindingSlug({
      ...next,
      slug: sourceSlug,
      __sourceSessionSlug: sourceSlug,
    }),
  );
  return {
    ...next,
    chainId: resolveSbtEntryChainId(next),
    slug: pickNormalizedSessionSlug(next.slug, fallbackSlug),
    __sourceSessionSlug: sourceSlug,
    ...(sessionBindingSlug != null ? { sessionBindingSlug } : {}),
  };
};

export const shouldPreferIncomingScopedSbtEntry = (existingEntry: unknown, incomingEntry: unknown): boolean => {
  const existing = isRecord(existingEntry) ? (existingEntry as SbtSelectorScopedEntry) : null;
  const incoming = isRecord(incomingEntry) ? (incomingEntry as SbtSelectorScopedEntry) : null;
  if (!incoming) return false;

  const existingNamed = hasSbtDisplayName(existing?.sbtInfo || null);
  const incomingNamed = hasSbtDisplayName(incoming.sbtInfo || null);
  if (!existingNamed && incomingNamed) return true;
  return !existing?.sbtInfo?.image && !!incoming.sbtInfo?.image;
};

export const mergeScopedSbtEntry = (
  existingEntry: unknown,
  incomingEntry: unknown,
  fallbackSlug: unknown = '',
): SbtSelectorScopedEntry | null => {
  const existing = isRecord(existingEntry) ? decorateScopedSbtEntry(existingEntry, fallbackSlug) : null;
  const incoming = isRecord(incomingEntry) ? decorateScopedSbtEntry(incomingEntry, fallbackSlug) : null;
  const mergedBindingSlug = pickOptionalNormalizedSessionSlug(
    existing && hasOwn(existing, 'sessionBindingSlug') ? existing.sessionBindingSlug : undefined,
    incoming && hasOwn(incoming, 'sessionBindingSlug') ? incoming.sessionBindingSlug : undefined,
  );
  const finalizeEntry = (entry: SbtSelectorScopedEntry | null): SbtSelectorScopedEntry | null => {
    if (!entry) return null;
    return {
      ...entry,
      chainId: resolveSbtEntryChainId(entry),
      slug: pickNormalizedSessionSlug(entry.slug, fallbackSlug),
      __sourceSessionSlug: pickNormalizedSessionSlug(
        hasOwn(entry, '__sourceSessionSlug') ? entry.__sourceSessionSlug : undefined,
        entry.slug,
        fallbackSlug,
      ),
      ...(mergedBindingSlug != null ? { sessionBindingSlug: mergedBindingSlug } : {}),
    };
  };
  if (!existing) {
    return incoming ? finalizeEntry(incoming) : null;
  }
  if (!incoming) return finalizeEntry(existing);

  if (shouldPreferIncomingScopedSbtEntry(existing, incoming)) {
    return finalizeEntry({
      ...existing,
      ...incoming,
      slug: pickNormalizedSessionSlug(existing.slug, incoming.slug, fallbackSlug),
    });
  }

  return finalizeEntry(existing);
};
