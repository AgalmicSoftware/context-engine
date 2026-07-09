import {
  canonicalizeSessionSlug,
  resolveSessionSlugAliasFromDemoSessions,
} from '../../utilities/session/canonicalSessionContext.js';
import {
  getBaselineDemoPlaceholderSlugs,
  getBaselineDemoSessionSlugs,
} from '../../utilities/session/sessionDemoCompat.js';

type DemoSessionConfig = {
  slug?: unknown;
  sessionName?: unknown;
} & Record<string, unknown>;

type DemoSessionMap = Record<string, DemoSessionConfig>;
type UniverseEntryTuple = [unknown, DemoSessionConfig | undefined];
type UniverseEntryList = Array<readonly unknown[]>;

type UniverseOptions = {
  demoSessionMap?: DemoSessionMap;
};

type CustomDemoSessionOptions = {
  baselineDemoUniverseSlugs?: Set<string>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const BASELINE_DEMO_UNIVERSE_SLUGS = new Set<string>(getBaselineDemoSessionSlugs());
const BASELINE_DEMO_PLACEHOLDER_SLUGS = new Set<string>(getBaselineDemoPlaceholderSlugs());

const readUniverseEntryTuple = (entry: unknown): UniverseEntryTuple => {
  if (!Array.isArray(entry)) return [undefined, undefined];
  return [entry[0], isRecord(entry[1]) ? (entry[1] as DemoSessionConfig) : undefined];
};

const readUniverseEntryRawSlug = (entry: unknown): string => {
  const [key, cfg] = readUniverseEntryTuple(entry);
  return typeof cfg?.slug === 'string' ? cfg.slug : String(key || '');
};

export const resolveSessionUniverseEntrySlug = (entry: unknown, { demoSessionMap }: UniverseOptions = {}): string => {
  const [key] = readUniverseEntryTuple(entry);
  const resolvedDemoAlias = resolveSessionSlugAliasFromDemoSessions({
    sessionSlug: key,
    demoSessions: demoSessionMap,
  });
  if (resolvedDemoAlias.sessionConfig) return resolvedDemoAlias.sessionSlug;
  return canonicalizeSessionSlug(readUniverseEntryRawSlug(entry));
};

export const filterSessionUniverseEntriesByDemoVisibility = (
  entries: UniverseEntryList | unknown = [],
  showDemoSessions: unknown,
  { demoSessionMap }: UniverseOptions = {},
): UniverseEntryList => {
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  if (showDemoSessions === true) return normalizedEntries;
  return normalizedEntries.filter(
    (entry) => !BASELINE_DEMO_PLACEHOLDER_SLUGS.has(resolveSessionUniverseEntrySlug(entry, { demoSessionMap })),
  );
};

export const mergeSessionUniverseEntriesBySlug = (
  entrySets: Array<UniverseEntryList | unknown> = [],
  { demoSessionMap }: UniverseOptions = {},
): UniverseEntryTuple[] => {
  const out: UniverseEntryTuple[] = [];
  const seen = new Set<string>();
  (Array.isArray(entrySets) ? entrySets : []).forEach((entries) => {
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const tuple = readUniverseEntryTuple(entry);
      const normalized = resolveSessionUniverseEntrySlug(tuple, { demoSessionMap });
      if (seen.has(normalized)) return;
      seen.add(normalized);
      out.push(tuple);
    });
  });
  return out;
};

export const getCustomDemoSessionEntries = (
  demoSessionMap: DemoSessionMap = {},
  { baselineDemoUniverseSlugs = BASELINE_DEMO_UNIVERSE_SLUGS }: CustomDemoSessionOptions = {},
): Array<[string, DemoSessionConfig]> =>
  Object.entries(demoSessionMap || {}).filter(
    (entry): entry is [string, DemoSessionConfig] =>
      !baselineDemoUniverseSlugs.has(resolveSessionUniverseEntrySlug(entry, { demoSessionMap })),
  );
