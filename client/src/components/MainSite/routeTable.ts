import { KNOWN_ROUTE_PREFIXES, VALID_SURVEY_ID_RE, isStaticNonCacheRoute } from './routeConfig.js';
import { isOnOrWithinRoutePath } from './routePathHelpers.js';
import { getSbtAddressFromPath, isSbtListRoutePath } from './sbtRoutePathHelpers.js';

export type MainSiteRouteKey =
  | 'wizard'
  | 'surveyId'
  | 'home'
  | 'debate'
  | 'atlas'
  | 'tag'
  | 'bookmarks'
  | 'compare'
  | 'surveysOrQuestionsList'
  | 'questionDetail'
  | 'sbtCreate'
  | 'sbtsList'
  | 'sbtDetail'
  | 'simUser'
  | 'userProfile'
  | 'about'
  | 'posts'
  | 'demos'
  | 'matrix'
  | 'contracts'
  | 'admin'
  | 'sponsor'
  | 'agent'
  | 'session'
  | 'notFound';

export interface MainSiteRouteMatch {
  key: MainSiteRouteKey;
  canonicalPath?: string;
  firstPathSegment: string;
  isKnownRoutePrefix: boolean;
  pathSegments: string[];
  pathWithoutQuery: string;
  shouldBypassCacheHydrationWait: boolean;
  surveyIDFromPath: string | null;
  sbtAddress: string | null;
  sessionToken: string | null;
  questionId: string | null;
}

export interface ResolveMainSiteRouteMatchOptions {
  fullPath: string;
  isAddress?: (value: string) => boolean;
  surveyIDFromPath?: string | null;
}

type RouteDefinition = {
  key: MainSiteRouteKey;
  match: (ctx: RouteDefinitionContext) => boolean;
  canonicalPath?: (ctx: RouteDefinitionContext) => string | undefined;
};

type RouteDefinitionContext = {
  firstPathSegment: string;
  fullPath: string;
  isSbtDetailRoute: boolean;
  isSbtsListRoute: boolean;
  pathSegments: string[];
  pathWithoutQuery: string;
  surveyIDFromPath: string | null;
};

const splitCleanPath = (path: string): string[] =>
  String(path || '')
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean);

const isExactRoute = (path: string, route: string): boolean => path === route || path === `${route}/`;

const readQuestionId = (pathSegments: string[]): string | null => {
  const questionIndex = pathSegments.indexOf('question');
  if (questionIndex < 0) return null;
  return pathSegments[questionIndex + 1] || null;
};

const routeDefinitions: RouteDefinition[] = [
  {
    key: 'wizard',
    match: ({ fullPath }) => fullPath === '/session/new' || fullPath === '/new',
    canonicalPath: ({ fullPath }) => (fullPath === '/new' ? '/session/new' : undefined),
  },
  {
    key: 'surveyId',
    match: ({ surveyIDFromPath }) => !!surveyIDFromPath,
  },
  {
    key: 'home',
    match: ({ fullPath }) => fullPath === '/' || fullPath === '',
  },
  {
    key: 'debate',
    match: ({ fullPath }) => isExactRoute(fullPath, '/debate'),
  },
  {
    key: 'atlas',
    match: ({ fullPath }) => isOnOrWithinRoutePath(fullPath, '/atlas'),
  },
  {
    key: 'tag',
    match: ({ fullPath }) => fullPath.startsWith('/tag/'),
  },
  {
    key: 'bookmarks',
    match: ({ fullPath }) => isExactRoute(fullPath, '/bookmarks'),
  },
  {
    key: 'compare',
    match: ({ fullPath }) => fullPath === '/compare' || fullPath === '/compare/' || fullPath.startsWith('/compare/'),
  },
  {
    key: 'surveysOrQuestionsList',
    match: ({ fullPath }) =>
      isOnOrWithinRoutePath(fullPath, '/surveys') ||
      fullPath.startsWith('/survey/') ||
      isOnOrWithinRoutePath(fullPath, '/questions'),
  },
  {
    key: 'questionDetail',
    match: ({ fullPath }) => fullPath.startsWith('/question/'),
  },
  {
    key: 'sbtCreate',
    match: ({ pathWithoutQuery }) =>
      isExactRoute(pathWithoutQuery, '/sbts/new') || isExactRoute(pathWithoutQuery, '/groups/new'),
  },
  {
    key: 'sbtsList',
    match: ({ isSbtsListRoute }) => isSbtsListRoute,
  },
  {
    key: 'sbtDetail',
    match: ({ isSbtDetailRoute }) => isSbtDetailRoute,
  },
  {
    key: 'simUser',
    match: ({ fullPath }) => fullPath.startsWith('/su/'),
  },
  {
    key: 'userProfile',
    match: ({ fullPath }) => fullPath.includes('0x'),
  },
  {
    key: 'about',
    match: ({ fullPath }) => fullPath === '/about',
  },
  {
    key: 'posts',
    match: ({ fullPath }) => isOnOrWithinRoutePath(fullPath, '/posts'),
  },
  {
    key: 'demos',
    match: ({ fullPath }) => isExactRoute(fullPath, '/demos'),
  },
  {
    key: 'matrix',
    match: ({ fullPath }) => fullPath === '/matrix',
  },
  {
    key: 'contracts',
    match: ({ fullPath }) => fullPath === '/contracts' || fullPath.startsWith('/contracts/'),
  },
  {
    key: 'admin',
    match: ({ fullPath }) => fullPath === '/admin',
  },
  {
    key: 'sponsor',
    match: ({ fullPath }) => isExactRoute(fullPath, '/sponsor'),
  },
  {
    key: 'agent',
    match: ({ fullPath }) => isExactRoute(fullPath, '/agent'),
  },
  {
    key: 'session',
    match: ({ firstPathSegment }) => firstPathSegment === 'session',
  },
];

export const MAIN_SITE_ROUTE_DEFINITIONS = routeDefinitions.map(({ key }) => ({ key }));

export function resolveMainSiteRouteMatch({
  fullPath,
  isAddress = () => false,
  surveyIDFromPath = null,
}: ResolveMainSiteRouteMatchOptions): MainSiteRouteMatch {
  const pathWithoutQuery = String(fullPath || '').split('?')[0] || '';
  const pathSegments = splitCleanPath(pathWithoutQuery);
  const firstPathSegment = String(pathSegments[0] || '')
    .trim()
    .toLowerCase();
  const inferredSurveyID =
    surveyIDFromPath ||
    (pathWithoutQuery.startsWith('/survey/') && pathSegments[1] && VALID_SURVEY_ID_RE.test(pathSegments[1])
      ? pathSegments[1]
      : null);
  const isSbtsListRoute = isSbtListRoutePath(pathWithoutQuery);
  const sbtAddress = getSbtAddressFromPath(pathWithoutQuery, { isAddress });
  const isSbtDetailRoute =
    !!sbtAddress || pathWithoutQuery.startsWith('/sbt/') || pathWithoutQuery.startsWith('/group/');
  const isKnownRoutePrefix =
    pathWithoutQuery === '/' ||
    pathWithoutQuery === '' ||
    KNOWN_ROUTE_PREFIXES.has(firstPathSegment) ||
    pathWithoutQuery.includes('0x');
  const shouldBypassCacheHydrationWait =
    pathWithoutQuery === '/debate' ||
    pathWithoutQuery === '/debate/' ||
    pathWithoutQuery.startsWith('/tag/') ||
    firstPathSegment === 'groups' ||
    isStaticNonCacheRoute(fullPath);
  const context: RouteDefinitionContext = {
    firstPathSegment,
    fullPath,
    isSbtDetailRoute,
    isSbtsListRoute,
    pathSegments,
    pathWithoutQuery,
    surveyIDFromPath: inferredSurveyID,
  };
  const definition = routeDefinitions.find((entry) => entry.match(context));

  return {
    key: definition?.key || 'notFound',
    canonicalPath: definition?.canonicalPath?.(context),
    firstPathSegment,
    isKnownRoutePrefix,
    pathSegments,
    pathWithoutQuery,
    shouldBypassCacheHydrationWait,
    surveyIDFromPath: inferredSurveyID,
    sbtAddress,
    sessionToken: firstPathSegment === 'session' ? pathSegments[1] || null : null,
    questionId: readQuestionId(pathSegments),
  };
}
