import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import type { SbtListHelperItem, SbtListHelperRecord } from './sbtListCardDetailsHelpers';
import { dedupeNormalizedSbtListSlugs, pickNormalizedSbtListSessionSlug } from './sbtListSessionUniverseHelpers';

export type SbtListScopedEntryOptions = {
  requireConcreteBinding?: boolean;
};

type SbtListScopedCacheEntry = SbtListHelperRecord & {
  slug?: unknown;
  value?: unknown;
};

type SbtListScopedEntryResolver = (sbt: SbtListHelperItem) => unknown;

type CollectSbtListLinkedScopedEntriesArgs = {
  entries?: unknown;
  options?: SbtListScopedEntryOptions;
  resolveConcreteSessionBindingSlug?: SbtListScopedEntryResolver;
  resolveSbtSessionSlug?: SbtListScopedEntryResolver;
  targetSlugs?: unknown;
};

const isSbtListScopedRecord = (value: unknown): value is SbtListHelperRecord => !!value && typeof value === 'object';

const normalizeScopedCacheEntries = (entries: unknown): SbtListScopedCacheEntry[] =>
  (Array.isArray(entries) ? entries : []).filter(isSbtListScopedRecord) as SbtListScopedCacheEntry[];

export const collectSbtListLinkedScopedEntries = ({
  entries = [],
  options = {},
  resolveConcreteSessionBindingSlug = () => null,
  resolveSbtSessionSlug = () => '',
  targetSlugs = [],
}: CollectSbtListLinkedScopedEntriesArgs = {}): SbtListHelperItem[] => {
  const targetSlugSet = new Set<string>(dedupeNormalizedSbtListSlugs(targetSlugs));
  if (targetSlugSet.size === 0) return [];

  const requireConcreteBinding = options?.requireConcreteBinding === true;
  const out: SbtListHelperItem[] = [];
  const seen = new Set<string>();

  normalizeScopedCacheEntries(entries).forEach(({ slug: cacheSlug, value }) => {
    const sourceSlug = normalizeSessionSlug(cacheSlug || '');
    const cacheValue = isSbtListScopedRecord(value) ? value : null;
    if (!cacheValue) return;

    Object.values(cacheValue).forEach((netNode) => {
      const scopedList =
        isSbtListScopedRecord(netNode) && isSbtListScopedRecord(netNode.sbtList) ? netNode.sbtList : null;
      if (!scopedList) return;

      Object.entries(scopedList).forEach(([cacheAddress, entry]) => {
        const rawEntry = isSbtListScopedRecord(entry) ? (entry as SbtListHelperItem) : {};
        const entryWithSource: SbtListHelperItem = {
          ...rawEntry,
          __sourceSessionSlug: pickNormalizedSbtListSessionSlug(rawEntry.__sourceSessionSlug, sourceSlug),
          sbtAddress: rawEntry.sbtAddress || cacheAddress,
          slug: pickNormalizedSbtListSessionSlug(rawEntry.slug, sourceSlug),
        };
        const addrLower = String(entryWithSource.sbtAddress || '')
          .trim()
          .toLowerCase();
        if (!addrLower || seen.has(addrLower)) return;

        const concreteBindingSlug = resolveConcreteSessionBindingSlug(entryWithSource);
        const bindingInScope =
          concreteBindingSlug != null && targetSlugSet.has(normalizeSessionSlug(concreteBindingSlug));
        if (requireConcreteBinding && !bindingInScope) return;

        const resolvedSlug = normalizeSessionSlug(
          resolveSbtSessionSlug(entryWithSource) || entryWithSource.slug || sourceSlug,
        );
        const resolvedInScope = targetSlugSet.has(resolvedSlug);
        if (!requireConcreteBinding && !bindingInScope && !resolvedInScope) return;

        seen.add(addrLower);
        out.push(
          bindingInScope
            ? { ...entryWithSource, slug: normalizeSessionSlug(concreteBindingSlug || '') }
            : { ...entryWithSource, slug: resolvedSlug },
        );
      });
    });
  });

  return out;
};
