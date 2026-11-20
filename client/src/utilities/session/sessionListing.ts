import { KNOWN_SESSIONS } from './knownSessionsFile';

// What the site's session lists show: which sessions, under what label, in
// what order. Display only: a session left off still opens from its link and
// works as before. "General" (the empty slug: content in no session) shows
// only while it is the current choice.

// Sessions left off the lists for now: automated test runs and older demos.
export const UNLISTED_SESSION_PATTERNS: readonly RegExp[] = Object.freeze([
  /^cloudflare-/, // Worker setup test runs
  /^e2e-/, // end-to-end test runs
  /^live-gates-/, // live gate checks
  /^prd\d+-/, // test runs named after a planning document
  /^ce-mod-/, // session-setup test runs
  /^demo-(?:1|sh|interview)$/, // older demos
  /^(?:telegram|dweb)-demo(?:-\d+)?$/, // older channel demos
  /^rxc-(?:ra-)?test$/, // the two retired trial sessions (RETIRED_SESSION_SLUGS below)
]);

// Trial sessions taken off the lists by name: the first salon trial, whose title reads like the real salon's, and
// the trial before it. A browser that remembers one as its session starts on the default instead (see
// globalSessionState.ts). Test-run sessions matched by the patterns above are still remembered, as test runs
// rely on that.
export const RETIRED_SESSION_SLUGS: readonly string[] = Object.freeze(['rxc-ra-test', 'rxc-test']);

/** A list of sessions without the retired ones, for pickers that build their own options. */
export const withoutRetiredSessions = (slugs: string[]): string[] =>
  slugs.filter((slug) => !RETIRED_SESSION_SLUGS.includes(slug));

export const GENERAL_SESSION_LABEL = 'General';

export const isListedSession = (slug: string): boolean =>
  !!slug && !UNLISTED_SESSION_PATTERNS.some((pattern) => pattern.test(slug));

// The list label: known-sessions.json's `title`, else the session's own name.
export const sessionListName = (slug: string, name = ''): string =>
  slug ? KNOWN_SESSIONS[slug]?.title || name.trim() || slug : GENERAL_SESSION_LABEL;

export const sessionListLabel = (slug: string, name = ''): string => {
  const shown = sessionListName(slug, name);
  return slug && shown.toLowerCase() !== slug ? `${shown} (${slug})` : shown;
};

const KNOWN_ORDER = Object.keys(KNOWN_SESSIONS);
const rank = (slug: string) => {
  if (!slug) return -1;
  const index = KNOWN_ORDER.indexOf(slug);
  return index === -1 ? KNOWN_ORDER.length : index;
};

// General first, then known-sessions.json's order (EDDY, the salon, then the
// test sessions), then every other session by label. Sources that load later
// add only below the known sessions, so those never move.
export const compareSessionListEntries = (
  a: { slug: string; label: string },
  b: { slug: string; label: string },
): number => rank(a.slug) - rank(b.slug) || a.label.localeCompare(b.label) || a.slug.localeCompare(b.slug);

/**
 * The options for a session list. `keep` names the sessions the person has
 * chosen now: each stays visible, even General or a session left off the list.
 */
export const buildSessionListOptions = ({
  slugs,
  keep = [],
  nameOf = () => '',
}: {
  slugs: string[];
  keep?: string[];
  nameOf?: (slug: string) => string;
}): Array<{ slug: string; label: string }> => {
  const kept = new Set(keep);
  return [...new Set(slugs)]
    .filter((slug) => kept.has(slug) || isListedSession(slug))
    .map((slug) => ({ slug, label: sessionListLabel(slug, slug ? nameOf(slug) : '') }))
    .sort(compareSessionListEntries);
};
