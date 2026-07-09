import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import { resolveSessionUniverseEntrySlug } from './sbtSessionUniverse.js';
import type { SbtListHelperItem, SbtListHelperRecord } from './sbtListCardDetailsHelpers';

export type SbtSessionGroupLists = {
  featured_SBTs_LIST?: unknown;
  ignored_SBTs_LIST?: unknown;
};

export type SbtListSessionUniverseOptions = {
  demoSessionMap?: Record<string, SbtListHelperRecord>;
};

type ResolveSbtListSectionSessionSlugsArgs = {
  allSessionsMode?: unknown;
  isListModeScopeEnabled?: unknown;
  listSlug?: unknown;
  selectedSessionUniverseSlugs?: unknown;
};
type ResolveSbtListDefaultSelectedSessionSlugsArgs = {
  displayedSessionUniverseSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  listModeConfiguredSessionSlugs?: unknown;
};
type ResolveSbtListSelectedSessionUniverseSlugsArgs = {
  allSessionsMode?: unknown;
  defaultListModeSelectedSessionSlugs?: unknown;
  displayedSessionUniverseSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  selectedSessionSlugs?: unknown;
};
type ResolveSbtListDisplayedSessionUniverseSlugsArgs = {
  allSessionsMode?: unknown;
  availableSessionSlugs?: unknown;
  baseSessionUniverseSlugs?: unknown;
  hasNoSessionUniverseItems?: unknown;
  hiddenRegistrySessionSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  selectedHiddenRegistrySessionSlugs?: unknown;
  showMoreSessions?: unknown;
};
type ResolveSbtListHiddenRegistrySessionSlugsArgs = {
  availableSessionSlugs?: unknown;
  baseSessionUniverseSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  registrySessionUniverseSlugs?: unknown;
};
type ResolveSbtListSelectedHiddenRegistrySessionSlugsArgs = {
  hiddenRegistrySessionSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  selectedSessionSlugs?: unknown;
};
type ResolveSbtListRemainingHiddenRegistrySessionSlugsArgs = {
  hiddenRegistrySessionSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  selectedHiddenRegistrySessionSlugs?: unknown;
};
type ResolveSbtListClampedSelectedSessionSlugsArgs = {
  availableSessionSlugs?: unknown;
  displayedSessionUniverseSlugs?: unknown;
  hiddenRegistrySessionSlugs?: unknown;
  listModeConfiguredSessionSlugs?: unknown;
  registrySessionUniverseSlugs?: unknown;
  selectedSessionSlugs?: unknown;
};
type ResolveSbtListChipSelectedSessionSlugsArgs = {
  defaultListModeSelectedSessionSlugs?: unknown;
  displayedSessionUniverseSlugs?: unknown;
  selectedSessionSlugs?: unknown;
  selectedSlug?: unknown;
  wasSelected?: unknown;
};
export type SbtListSessionUniverseSnapshot = {
  fallbackEntryCount: number;
  registryEntryCount: number;
  registryHydrated: boolean;
  slugs: string[];
};
export type SbtListSessionUniverseSnapshotLike = {
  fallbackEntryCount?: unknown;
  registryEntryCount?: unknown;
  registryHydrated?: unknown;
  slugs?: unknown;
};
type ResolveSbtListSessionUniverseSnapshotUpdateArgs<TPrevious, TNext = TPrevious> = {
  nextSnapshot?: TNext;
  previousSnapshot?: TPrevious;
};

type SbtListSessionUniverseEntryTuple = [unknown, SbtListHelperRecord | undefined];

const SESSION_ID_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_ID_HEX_RE = /^0x[0-9a-f]{32}$/i;
const SESSION_ID_COMPACT_RE = /^[0-9a-f]{32}$/i;
export const SBT_LIST_NO_SESSION_UNIVERSE_SLUG = '__no_session__';

const isSbtListSessionUniverseRecord = (value: unknown): value is SbtListHelperRecord =>
  !!value && typeof value === 'object';

export const isSbtListSessionIdLikeSlug = (raw: unknown): boolean => {
  const value = String(raw || '').trim();
  if (!value) return false;
  return SESSION_ID_UUID_RE.test(value) || SESSION_ID_HEX_RE.test(value) || SESSION_ID_COMPACT_RE.test(value);
};

export const isSbtListSyntheticNoSessionSlug = (slugIn: unknown): boolean =>
  normalizeSessionSlug(slugIn || '') === SBT_LIST_NO_SESSION_UNIVERSE_SLUG;

export const getVisibleSbtListSessionSlugsFromEntries = (
  entries: unknown = [],
  options: SbtListSessionUniverseOptions = {},
): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(entries) ? entries : []).forEach((entry: unknown) => {
    const [key, cfg] = (Array.isArray(entry) ? entry : [undefined, undefined]) as SbtListSessionUniverseEntryTuple;
    const rawSlug = (typeof cfg?.slug === 'string' ? cfg.slug : key) || '';
    const trimmed = String(rawSlug || '').trim();
    const candidate = resolveSessionUniverseEntrySlug(entry, {
      demoSessionMap: options.demoSessionMap,
    });
    const isGeneral = candidate === '';
    if (!isGeneral && !candidate) return;
    const idCheckValue = candidate || trimmed;
    if (isSbtListSessionIdLikeSlug(idCheckValue)) return;
    if (seen.has(candidate)) return;
    seen.add(candidate);
    out.push(candidate);
  });
  return out;
};

export const areStringArraysEqual = (a: unknown = [], b: unknown = []): boolean => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (String(a[i]) !== String(b[i])) return false;
  }
  return true;
};

export const dedupeNormalizedSbtListSlugs = (list: unknown = []): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(list) ? list : []).forEach((raw: unknown) => {
    const slug = normalizeSessionSlug(raw);
    if (isSbtListSessionIdLikeSlug(slug || raw)) return;
    if (seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
};

export const pickNormalizedSbtListSessionSlug = (...values: unknown[]): string => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = normalizeSessionSlug(value);
    if (normalized != null) return normalized;
  }
  return '';
};

export const mergeSbtListsByAddress = (...lists: unknown[]): SbtListHelperItem[] => {
  const out: SbtListHelperItem[] = [];
  const seen = new Set<string>();
  lists.forEach((list: unknown) => {
    (Array.isArray(list) ? list : []).forEach((item: unknown) => {
      const record = isSbtListSessionUniverseRecord(item) ? (item as SbtListHelperItem) : null;
      if (!record) return;
      const addrLower = String(record.sbtAddress || '')
        .trim()
        .toLowerCase();
      if (!addrLower || seen.has(addrLower)) return;
      seen.add(addrLower);
      out.push(record);
    });
  });
  return out;
};

export const sortSbtListSlugsByUniverseOrder = (slugs: unknown = [], universeSlugs: unknown = []): string[] => {
  const normalizedUniverse = dedupeNormalizedSbtListSlugs(universeSlugs);
  const order = new Map<string, number>();
  normalizedUniverse.forEach((slug: string, index: number) => {
    order.set(normalizeSessionSlug(slug), index);
  });
  return dedupeNormalizedSbtListSlugs(slugs).sort((aRaw: string, bRaw: string) => {
    const a = normalizeSessionSlug(aRaw);
    const b = normalizeSessionSlug(bRaw);
    const aOrder = order.has(a) ? (order.get(a) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
    const bOrder = order.has(b) ? (order.get(b) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });
};

export const resolveSbtListSectionSessionSlugs = ({
  allSessionsMode = false,
  isListModeScopeEnabled = false,
  listSlug = '',
  selectedSessionUniverseSlugs = [],
}: ResolveSbtListSectionSessionSlugsArgs = {}): string[] => {
  if (!allSessionsMode) return [normalizeSessionSlug(listSlug || '')];
  if (isListModeScopeEnabled) {
    return Array.isArray(selectedSessionUniverseSlugs) ? selectedSessionUniverseSlugs : [];
  }
  return [normalizeSessionSlug(listSlug || '')];
};

export const resolveSbtListActionableSessionSlugs = (slugs: unknown = []): string[] =>
  dedupeNormalizedSbtListSlugs(slugs).filter((slug: unknown) => !isSbtListSyntheticNoSessionSlug(slug));

export function resolveSbtListSessionUniverseSnapshotUpdate<
  TSnapshot extends SbtListSessionUniverseSnapshotLike,
>(args: { nextSnapshot: TSnapshot; previousSnapshot: TSnapshot }): TSnapshot;
export function resolveSbtListSessionUniverseSnapshotUpdate<
  TPrevious extends SbtListSessionUniverseSnapshotLike = SbtListSessionUniverseSnapshotLike,
  TNext extends SbtListSessionUniverseSnapshotLike = TPrevious,
>(args?: ResolveSbtListSessionUniverseSnapshotUpdateArgs<TPrevious, TNext>): TPrevious | TNext | undefined;
export function resolveSbtListSessionUniverseSnapshotUpdate({
  nextSnapshot,
  previousSnapshot,
}: ResolveSbtListSessionUniverseSnapshotUpdateArgs<
  SbtListSessionUniverseSnapshotLike,
  SbtListSessionUniverseSnapshotLike
> = {}): SbtListSessionUniverseSnapshotLike | undefined {
  const prev =
    previousSnapshot && typeof previousSnapshot === 'object'
      ? (previousSnapshot as SbtListSessionUniverseSnapshotLike)
      : {};
  const next =
    nextSnapshot && typeof nextSnapshot === 'object' ? (nextSnapshot as SbtListSessionUniverseSnapshotLike) : {};
  const prevSlugs = Array.isArray(prev.slugs) ? prev.slugs : [];
  const nextSlugs = Array.isArray(next.slugs) ? next.slugs : [];
  const prevRegistryCount = Number(prev.registryEntryCount || 0);
  const nextRegistryCount = Number(next.registryEntryCount || 0);
  const prevFallbackCount = Number(prev.fallbackEntryCount || 0);
  const nextFallbackCount = Number(next.fallbackEntryCount || 0);
  const prevHydrated = !!prev.registryHydrated;
  const nextHydrated = !!next.registryHydrated;
  if (
    prevRegistryCount === nextRegistryCount &&
    prevFallbackCount === nextFallbackCount &&
    prevHydrated === nextHydrated &&
    areStringArraysEqual(prevSlugs, nextSlugs)
  ) {
    return previousSnapshot;
  }
  return nextSnapshot;
}

export const resolveSbtListDefaultSelectedSessionSlugs = ({
  displayedSessionUniverseSlugs = [],
  isListModeScopeEnabled = false,
  listModeConfiguredSessionSlugs = [],
}: ResolveSbtListDefaultSelectedSessionSlugsArgs = {}): string[] => {
  if (!isListModeScopeEnabled) return [];
  const displayedSlugs = dedupeNormalizedSbtListSlugs(displayedSessionUniverseSlugs);
  const displayedSet = new Set(displayedSlugs);
  const configured = dedupeNormalizedSbtListSlugs(listModeConfiguredSessionSlugs).filter((slug) =>
    displayedSet.has(slug),
  );
  if (configured.length > 0) {
    return sortSbtListSlugsByUniverseOrder(configured, displayedSlugs);
  }
  const fallbackWithoutNoSession = displayedSlugs.filter((slug) => !isSbtListSyntheticNoSessionSlug(slug));
  const fallbackSelection = fallbackWithoutNoSession.length > 0 ? fallbackWithoutNoSession : displayedSlugs;
  return sortSbtListSlugsByUniverseOrder(fallbackSelection, displayedSlugs);
};

export const resolveSbtListSelectedSessionUniverseSlugs = ({
  allSessionsMode = false,
  defaultListModeSelectedSessionSlugs = [],
  displayedSessionUniverseSlugs = [],
  isListModeScopeEnabled = false,
  selectedSessionSlugs = [],
}: ResolveSbtListSelectedSessionUniverseSlugsArgs = {}): string[] => {
  if (!allSessionsMode || !isListModeScopeEnabled) return [];
  const displayedSlugs = dedupeNormalizedSbtListSlugs(displayedSessionUniverseSlugs);
  const displayedSet = new Set(displayedSlugs);
  const userSelected = dedupeNormalizedSbtListSlugs(selectedSessionSlugs).filter((slug) => displayedSet.has(slug));
  if (userSelected.length > 0) {
    return sortSbtListSlugsByUniverseOrder(userSelected, displayedSlugs);
  }
  return Array.isArray(defaultListModeSelectedSessionSlugs) ? defaultListModeSelectedSessionSlugs : [];
};

export const resolveSbtListDisplayedSessionUniverseSlugs = ({
  allSessionsMode = false,
  availableSessionSlugs = [],
  baseSessionUniverseSlugs = [],
  hasNoSessionUniverseItems = false,
  hiddenRegistrySessionSlugs = [],
  isListModeScopeEnabled = false,
  selectedHiddenRegistrySessionSlugs = [],
  showMoreSessions = false,
}: ResolveSbtListDisplayedSessionUniverseSlugsArgs = {}): string[] => {
  const expandedHiddenSlugs = !isListModeScopeEnabled
    ? []
    : dedupeNormalizedSbtListSlugs([
        ...(showMoreSessions && Array.isArray(hiddenRegistrySessionSlugs) ? hiddenRegistrySessionSlugs : []),
        ...(Array.isArray(selectedHiddenRegistrySessionSlugs) ? selectedHiddenRegistrySessionSlugs : []),
      ]);
  const baseUniverse = !isListModeScopeEnabled
    ? Array.isArray(availableSessionSlugs)
      ? availableSessionSlugs
      : []
    : dedupeNormalizedSbtListSlugs([
        ...(Array.isArray(baseSessionUniverseSlugs) ? baseSessionUniverseSlugs : []),
        ...expandedHiddenSlugs,
      ]);
  if (!allSessionsMode || !hasNoSessionUniverseItems) return baseUniverse;
  return dedupeNormalizedSbtListSlugs([...baseUniverse, SBT_LIST_NO_SESSION_UNIVERSE_SLUG]);
};

export const resolveSbtListHiddenRegistrySessionSlugs = ({
  availableSessionSlugs = [],
  baseSessionUniverseSlugs = [],
  isListModeScopeEnabled = false,
  registrySessionUniverseSlugs = [],
}: ResolveSbtListHiddenRegistrySessionSlugsArgs = {}): string[] => {
  if (!isListModeScopeEnabled) return [];
  const baseSet = new Set(
    (Array.isArray(baseSessionUniverseSlugs) ? baseSessionUniverseSlugs : []).map((slug) => normalizeSessionSlug(slug)),
  );
  const discoverable = dedupeNormalizedSbtListSlugs([
    ...(Array.isArray(availableSessionSlugs) ? availableSessionSlugs : []),
    ...(Array.isArray(registrySessionUniverseSlugs) ? registrySessionUniverseSlugs : []),
  ]);
  return discoverable.filter((slug) => !baseSet.has(normalizeSessionSlug(slug)));
};

export const resolveSbtListSelectedHiddenRegistrySessionSlugs = ({
  hiddenRegistrySessionSlugs = [],
  isListModeScopeEnabled = false,
  selectedSessionSlugs = [],
}: ResolveSbtListSelectedHiddenRegistrySessionSlugsArgs = {}): string[] => {
  if (!isListModeScopeEnabled) return [];
  const hiddenSet = new Set(dedupeNormalizedSbtListSlugs(hiddenRegistrySessionSlugs));
  return dedupeNormalizedSbtListSlugs(selectedSessionSlugs).filter((slug) => hiddenSet.has(normalizeSessionSlug(slug)));
};

export const resolveSbtListRemainingHiddenRegistrySessionSlugs = ({
  hiddenRegistrySessionSlugs = [],
  isListModeScopeEnabled = false,
  selectedHiddenRegistrySessionSlugs = [],
}: ResolveSbtListRemainingHiddenRegistrySessionSlugsArgs = {}): string[] => {
  if (!isListModeScopeEnabled) return [];
  const selectedSet = new Set(
    (Array.isArray(selectedHiddenRegistrySessionSlugs) ? selectedHiddenRegistrySessionSlugs : []).map((slug) =>
      normalizeSessionSlug(slug),
    ),
  );
  return dedupeNormalizedSbtListSlugs(hiddenRegistrySessionSlugs).filter(
    (slug) => !selectedSet.has(normalizeSessionSlug(slug)),
  );
};

export const resolveSbtListClampedSelectedSessionSlugs = ({
  availableSessionSlugs = [],
  displayedSessionUniverseSlugs = [],
  hiddenRegistrySessionSlugs = [],
  listModeConfiguredSessionSlugs = [],
  registrySessionUniverseSlugs = [],
  selectedSessionSlugs = [],
}: ResolveSbtListClampedSelectedSessionSlugsArgs = {}): string[] => {
  const selected = (Array.isArray(selectedSessionSlugs) ? selectedSessionSlugs : []) as string[];
  const discoverableSet = new Set(
    dedupeNormalizedSbtListSlugs([
      ...(Array.isArray(displayedSessionUniverseSlugs) ? displayedSessionUniverseSlugs : []),
      ...(Array.isArray(availableSessionSlugs) ? availableSessionSlugs : []),
      ...(Array.isArray(registrySessionUniverseSlugs) ? registrySessionUniverseSlugs : []),
      ...(Array.isArray(hiddenRegistrySessionSlugs) ? hiddenRegistrySessionSlugs : []),
      ...(Array.isArray(listModeConfiguredSessionSlugs) ? listModeConfiguredSessionSlugs : []),
    ]),
  );
  const normalized = dedupeNormalizedSbtListSlugs(selected);
  const clamped = normalized.filter((slug) => discoverableSet.has(slug));
  return areStringArraysEqual(normalized, clamped) ? selected : clamped;
};

export const resolveSbtListChipSelectedSessionSlugs = ({
  defaultListModeSelectedSessionSlugs = [],
  displayedSessionUniverseSlugs = [],
  selectedSessionSlugs = [],
  selectedSlug = '',
  wasSelected = false,
}: ResolveSbtListChipSelectedSessionSlugsArgs = {}): string[] => {
  const normalized = normalizeSessionSlug(selectedSlug || '');
  const displayedSlugs = dedupeNormalizedSbtListSlugs(displayedSessionUniverseSlugs);
  const displayedSet = new Set(displayedSlugs);
  const normalizedPrev = dedupeNormalizedSbtListSlugs(selectedSessionSlugs).filter((slug) => displayedSet.has(slug));
  const effectivePrev =
    normalizedPrev.length > 0 ? normalizedPrev : dedupeNormalizedSbtListSlugs(defaultListModeSelectedSessionSlugs);
  if (wasSelected) {
    const next = effectivePrev.filter((slug) => slug !== normalized);
    const clamped = next.length > 0 ? next : [normalized];
    return sortSbtListSlugsByUniverseOrder(clamped, displayedSlugs);
  }
  return sortSbtListSlugsByUniverseOrder([...effectivePrev, normalized], displayedSlugs);
};
