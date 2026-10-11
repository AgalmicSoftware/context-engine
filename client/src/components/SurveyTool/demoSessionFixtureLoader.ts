import { hasDemoQuestionFixtures } from '../../utilities/demo/demoFixtureSessionSlugs';
import type { PolisDemoQuestionPoolEntry } from './surveyPolisDemoQuestionPool';

// Demo fixtures are large, so they ship in their own chunks and load on first
// use. Synchronous readers get null until loadDemoSessionFixtures resolves;
// callers then re-render or rebuild.
type DemoSessionFixtures = typeof import('./demoSessionFixtures');

let loadedFixtures: DemoSessionFixtures | null = null;
let pendingFixtures: Promise<DemoSessionFixtures> | null = null;

export const getLoadedDemoSessionFixtures = (): DemoSessionFixtures | null => loadedFixtures;

export const loadDemoSessionFixtures = (): Promise<DemoSessionFixtures> => {
  if (!pendingFixtures) {
    pendingFixtures = import('./demoSessionFixtures').then(
      (fixtures) => {
        loadedFixtures = fixtures;
        return fixtures;
      },
      (error: unknown) => {
        // A failed chunk load may succeed later.
        pendingFixtures = null;
        throw error;
      },
    );
  }
  return pendingFixtures;
};

const readString = (value: unknown = ''): string => String(value || '').trim();

const normalizePathname = (value: unknown = ''): string =>
  readString(value).split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();

const isBuiltInDemoPathname = (value: unknown = ''): boolean => {
  const routePath = normalizePathname(value);
  return routePath === '/session/demo' || routePath.startsWith('/session/demo/');
};

export const shouldUseBuiltInPolisDemoQuestionPool = ({
  displaySlug = '',
  sourceSlug = '',
  pathname = '',
}: {
  displaySlug?: unknown;
  sourceSlug?: unknown;
  pathname?: unknown;
} = {}): boolean => {
  const isBuiltInDemoRoute = readString(displaySlug).toLowerCase() === 'demo' || isBuiltInDemoPathname(pathname);
  if (!isBuiltInDemoRoute) return false;
  return readString(sourceSlug).toLowerCase() === '' || isBuiltInDemoPathname(pathname);
};

/** The built-in demo question pool for the demo route, once its fixture has loaded. */
export const resolveLoadedPolisDemoQuestionPool = ({
  displaySlug = '',
  sourceSlug = '',
  pathname = typeof window !== 'undefined' ? window.location?.pathname : '',
}: {
  displaySlug?: unknown;
  sourceSlug?: unknown;
  pathname?: unknown;
} = {}): PolisDemoQuestionPoolEntry[] =>
  shouldUseBuiltInPolisDemoQuestionPool({ displaySlug, sourceSlug, pathname })
    ? (loadedFixtures?.getPolisDemoQuestionPool() ?? [])
    : [];

/** Temporary demo questions for a demo slug; other slugs never load the fixtures. */
export const loadTemporaryDemoSessionQuestionFixtures = async (
  slug: unknown,
  sessionConfig: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> =>
  hasDemoQuestionFixtures(slug)
    ? (await loadDemoSessionFixtures()).getTemporaryDemoSessionQuestionFixtures(slug, sessionConfig)
    : [];
