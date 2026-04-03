import {
  canonicalizeSessionSlug,
  resolveSessionSlugAliasFromDemoSessions,
} from '../../utilities/session/canonicalSessionContext.js';
import {
  getBaselineDemoPlaceholderSlugs,
  getBaselineDemoSessionSlugs,
} from '../../utilities/session/sessionDemoCompat.js';

const BASELINE_DEMO_UNIVERSE_SLUGS = new Set(getBaselineDemoSessionSlugs());
const BASELINE_DEMO_PLACEHOLDER_SLUGS = new Set(getBaselineDemoPlaceholderSlugs());

const readUniverseEntryTuple = (entry) => (
  Array.isArray(entry) ? entry : [undefined, undefined]
);

const readUniverseEntryRawSlug = (entry) => {
  const [key, cfg] = readUniverseEntryTuple(entry);
  return (typeof cfg?.slug === 'string' ? cfg.slug : key) || '';
};

export const resolveSessionUniverseEntrySlug = (entry, { demoSessionMap } = {}) => {
  const [key] = readUniverseEntryTuple(entry);
  const resolvedDemoAlias = resolveSessionSlugAliasFromDemoSessions({
    sessionSlug: key,
    demoSessions: demoSessionMap,
  });
  if (resolvedDemoAlias.sessionConfig) return resolvedDemoAlias.sessionSlug;
  return canonicalizeSessionSlug(readUniverseEntryRawSlug(entry));
};

export const filterSessionUniverseEntriesByDemoVisibility = (
  entries = [],
  showDemoSessions,
  { demoSessionMap } = {}
) => {
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  if (showDemoSessions === true) return normalizedEntries;
  return normalizedEntries.filter((entry) => (
    !BASELINE_DEMO_PLACEHOLDER_SLUGS.has(
      resolveSessionUniverseEntrySlug(entry, { demoSessionMap })
    )
  ));
};

export const mergeSessionUniverseEntriesBySlug = (
  entrySets = [],
  { demoSessionMap } = {}
) => {
  const out = [];
  const seen = new Set();
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
  demoSessionMap = {},
  { baselineDemoUniverseSlugs = BASELINE_DEMO_UNIVERSE_SLUGS } = {}
) => (
  Object.entries(demoSessionMap || {}).filter((entry) => (
    !baselineDemoUniverseSlugs.has(
      resolveSessionUniverseEntrySlug(entry, { demoSessionMap })
    )
  ))
);
