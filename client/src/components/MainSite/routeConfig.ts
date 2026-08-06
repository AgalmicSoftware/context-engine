/**
 * @module routeConfig
 * @description Route matching constants and path matchers for MainSite.
 *              Lazy component references live in routeLazyComponents.js.
 *
 * Key exports: KNOWN_ROUTE_PREFIXES, isStaticNonCacheRoute, VALID_SURVEY_ID_RE, SURVEY_RESULTS_RE, QUESTION_RESULTS_RE
 */

/** Set of first-segment prefixes that getMainView recognizes (prevents cache wait for unknown paths) */
export const KNOWN_ROUTE_PREFIXES = new Set([
  'debate',
  'atlas',
  'tag',
  'bookmarks',
  'compare',
  'surveys',
  'survey',
  'questions',
  'question',
  'sbts',
  'sbt',
  'groups',
  'group',
  'su',
  'u',
  'new',
  'demo',
  'about',
  'posts',
  'demos',
  'matrix',
  'contracts', // Permanent legacy alias for /docs.
  'admin',
  'sponsor',
  'agent',
  'session',
  'docs',
]);

/** Routes that render without waiting for cache hydration */
export function isStaticNonCacheRoute(path: string) {
  return (
    path === '/debate' ||
    path === '/debate/' ||
    path.startsWith('/tag/') ||
    path === '/about' ||
    path === '/posts' ||
    path === '/posts/' ||
    path.startsWith('/posts/') ||
    path === '/demos' ||
    path === '/demos/' ||
    path === '/matrix' ||
    path === '/contracts' ||
    path === '/contracts/' ||
    path.startsWith('/contracts/') ||
    path === '/admin' ||
    path === '/admin/' ||
    path === '/sponsor' ||
    path === '/sponsor/' ||
    path === '/agent' ||
    path === '/agent/' ||
    path.startsWith('/docs')
  );
}

/** Valid survey ID: 0x + 64 hex chars */
export const VALID_SURVEY_ID_RE = /^0x[0-9a-fA-F]{64}$/;

/** /survey/:id/results with optional filter segment */
export const SURVEY_RESULTS_RE = /^\/survey\/(0x[0-9a-fA-F]{64})\/results(?:\/([^/?]+))?\/?$/;

/** /questions/results with optional filter segment */
export const QUESTION_RESULTS_RE = /^\/questions\/results(?:\/([^/?]+))?\/?$/;
