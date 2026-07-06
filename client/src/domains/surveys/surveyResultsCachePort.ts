import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';

export type SurveyResultsManagedCacheNamespace =
  | 'questionsCache'
  | 'surveysCache'
  | 'bookmarksCache'
  | 'filters'
  | 'sbtCache'
  | 'userCache'
  | 'analysisCache';

export type SurveyResultsCachePeekOptions = {
  clone?: boolean;
};

export type SurveyResultsCacheListOptions = {
  cloneValues?: boolean;
};

export type SurveyResultsCacheEntry = {
  key?: string;
  namespace?: string;
  slug: string;
  value: unknown;
};

export type SurveyResultsCacheUpdate = {
  action?: string;
  key?: string;
  namespace?: string;
  slug?: string;
  source?: string;
  value?: unknown;
};

export type SurveyResultsCacheUpdateHandler = (update: SurveyResultsCacheUpdate) => void;
export type SurveyResultsCacheUnsubscribe = () => void;

export type SurveyResultsCacheScriptsModule = {
  listNamespaceEntriesSync: (
    namespace: SurveyResultsManagedCacheNamespace | string,
    options?: SurveyResultsCacheListOptions
  ) => SurveyResultsCacheEntry[];
  peekCacheSync: (
    namespace: SurveyResultsManagedCacheNamespace | string,
    slug?: string,
    options?: SurveyResultsCachePeekOptions
  ) => unknown;
  readCache: (
    namespace: SurveyResultsManagedCacheNamespace | string,
    slug?: string
  ) => Promise<unknown>;
  subscribeCacheUpdates: (
    handler: SurveyResultsCacheUpdateHandler
  ) => SurveyResultsCacheUnsubscribe;
  writeCache: (
    namespace: SurveyResultsManagedCacheNamespace | string,
    slug?: string,
    value?: unknown
  ) => Promise<unknown>;
};

export type SurveyResultsCachePort = SurveyResultsCacheScriptsModule;

export type BindSurveyResultsCachePortArgs = {
  cacheScripts: () => SurveyResultsCacheScriptsModule;
};

export const bindSurveyResultsCachePort = ({
  cacheScripts: readCacheScripts,
}: BindSurveyResultsCachePortArgs): SurveyResultsCachePort => ({
  listNamespaceEntriesSync: (namespace, options) => (
    options === undefined
      ? readCacheScripts().listNamespaceEntriesSync(namespace)
      : readCacheScripts().listNamespaceEntriesSync(namespace, options)
  ),
  peekCacheSync: (namespace, slug, options) => {
    if (slug === undefined) return readCacheScripts().peekCacheSync(namespace);
    if (options === undefined) return readCacheScripts().peekCacheSync(namespace, slug);
    return readCacheScripts().peekCacheSync(namespace, slug, options);
  },
  readCache: (namespace, slug) => (
    slug === undefined
      ? readCacheScripts().readCache(namespace)
      : readCacheScripts().readCache(namespace, slug)
  ),
  subscribeCacheUpdates: (handler) => readCacheScripts().subscribeCacheUpdates(handler),
  writeCache: (namespace, slug, value) => {
    if (slug === undefined) return readCacheScripts().writeCache(namespace);
    if (value === undefined) return readCacheScripts().writeCache(namespace, slug);
    return readCacheScripts().writeCache(namespace, slug, value);
  },
});

const readDefaultCacheScripts = (): SurveyResultsCacheScriptsModule => ({
  listNamespaceEntriesSync: (namespace, options) => (
    options === undefined
      ? cacheScriptsModule.listNamespaceEntriesSync(namespace)
      : cacheScriptsModule.listNamespaceEntriesSync(namespace, options)
  ),
  peekCacheSync: (namespace, slug, options) => {
    if (slug === undefined) return cacheScriptsModule.peekCacheSync(namespace);
    if (options === undefined) return cacheScriptsModule.peekCacheSync(namespace, slug);
    return cacheScriptsModule.peekCacheSync(namespace, slug, options);
  },
  readCache: (namespace, slug) => (
    slug === undefined
      ? cacheScriptsModule.readCache(namespace)
      : cacheScriptsModule.readCache(namespace, slug)
  ),
  subscribeCacheUpdates: (handler) => cacheScriptsModule.subscribeCacheUpdates(handler),
  writeCache: (namespace, slug, value) => {
    const writeCache = cacheScriptsModule.writeCache as SurveyResultsCacheScriptsModule['writeCache'];
    if (slug === undefined) return writeCache(namespace);
    if (value === undefined) return writeCache(namespace, slug);
    return writeCache(namespace, slug, value);
  },
});

export const surveyResultsCachePort = bindSurveyResultsCachePort({
  cacheScripts: readDefaultCacheScripts,
});
