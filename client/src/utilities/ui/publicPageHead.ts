import { readPublicUrlBasePath } from './publicUrl.js';
import {
  PUBLIC_DISCOVERABILITY_PATH,
  PUBLIC_LLMS_PATH,
  PUBLIC_REPO_SOURCE_URL,
  PUBLIC_REPO_URL,
} from '../../variables/publicRepoMetadata.js';

type LocationLike =
  | {
      origin?: unknown;
      pathname?: unknown;
      search?: unknown;
    }
  | undefined;

type StructuredDataNode = Record<string, unknown>;

type PublicPageStructuredData = {
  '@context': 'https://schema.org';
  '@graph': StructuredDataNode[];
};

export type PublicPageHeadState = {
  title: string;
  description: string;
  image: string;
  canonicalUrl: string;
  ogUrl: string;
};

export const DEFAULT_PUBLIC_PAGE_TITLE = 'Context Engine | Deliberation Toolkit';

export const DEFAULT_PUBLIC_PAGE_DESCRIPTION =
  'Context Engine is a toolkit for AI-enhanced deliberation and sensemaking in large groups, with public and private participation, permanent records, and cryptographic access control.';

export const DEFAULT_PUBLIC_PAGE_IMAGE = 'https://contextengine.xyz/android-chrome-512x512.png';
export const DEFAULT_PUBLIC_SITE_NAME = 'Context Engine';
export const DEFAULT_PUBLIC_SITE_URL = 'https://contextengine.xyz/';

const PUBLIC_ORGANIZATION_ID = `${DEFAULT_PUBLIC_SITE_URL}#organization`;
const PUBLIC_SOURCE_CODE_ID = `${DEFAULT_PUBLIC_SITE_URL}#source`;
const PUBLIC_WEBSITE_ID = `${DEFAULT_PUBLIC_SITE_URL}#website`;
const STRUCTURED_DATA_SELECTOR = 'script[type="application/ld+json"][data-ce-structured-data="public-page"]';

const toStr = (value: unknown): string => String(value ?? '').trim();

const ensureHeadNode = (selector: string, tagName: string, attrs: Record<string, string> = {}): HTMLElement => {
  let node = document.head.querySelector(selector) as HTMLElement | null;
  if (node) return node;
  node = document.createElement(tagName) as HTMLElement;
  Object.entries(attrs).forEach(([key, value]) => {
    node.setAttribute(key, value);
  });
  document.head.appendChild(node);
  return node;
};

const setMetaContent = (selector: string, attrs: Record<string, string>, content: string): HTMLElement => {
  const node = ensureHeadNode(selector, 'meta', attrs);
  node.setAttribute('content', content);
  return node;
};

const setStructuredDataContent = (selector: string, attrs: Record<string, string>, content: string): HTMLElement => {
  const node = ensureHeadNode(selector, 'script', attrs);
  node.textContent = content;
  return node;
};

const normalizePathname = (pathname: unknown): string => {
  const raw = toStr(pathname);
  if (!raw) return '/';
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  if (withLeadingSlash === '/') return '/';
  return withLeadingSlash.replace(/\/+$/, '') || '/';
};

const normalizeCanonicalParamValue = (value: unknown): string => {
  const normalized = toStr(value);
  return normalized || '';
};

const stripConfiguredPublicBasePath = (pathname = ''): string => {
  const normalizedPath = normalizePathname(pathname);
  const configuredBasePath = normalizePathname(readPublicUrlBasePath());
  if (!configuredBasePath || configuredBasePath === '/') return normalizedPath;
  if (normalizedPath === configuredBasePath) return '/';
  if (normalizedPath.startsWith(`${configuredBasePath}/`)) {
    return normalizedPath.slice(configuredBasePath.length) || '/';
  }
  return normalizedPath;
};

const isContractsPath = (pathname = ''): boolean => {
  const routePath = stripConfiguredPublicBasePath(pathname).toLowerCase();
  return routePath.startsWith('/contracts');
};

const isSessionWizardPath = (pathname = ''): boolean => {
  const normalizedPath = stripConfiguredPublicBasePath(pathname).toLowerCase();
  return normalizedPath === '/new' || normalizedPath === '/session/new';
};

const isChainScopedRegistryPath = (pathname = ''): boolean => {
  const normalizedPath = stripConfiguredPublicBasePath(pathname).toLowerCase();
  return (
    normalizedPath === '/new' ||
    normalizedPath === '/session/new' ||
    normalizedPath === '/admin' ||
    normalizedPath === '/sponsor'
  );
};

const buildCanonicalSearch = (search: unknown, pathname = ''): string => {
  const raw = toStr(search);
  if (!raw || raw === '?') return '';

  const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`);
  const canonicalParams = new URLSearchParams();
  const setCanonicalParam = (canonicalKey: string, aliases: string[] = []): void => {
    for (const alias of aliases) {
      if (!params.has(alias)) continue;
      const normalizedValue = normalizeCanonicalParamValue(params.get(alias));
      if (!normalizedValue) continue;
      canonicalParams.set(canonicalKey, normalizedValue);
      return;
    }
  };

  // Keep only URL params that resolve a distinct public route or deep link.
  setCanonicalParam('session', ['session', 'sessionSlug', 's']);
  setCanonicalParam('sessionId', ['sessionId', 'sessionID', 'sid']);
  setCanonicalParam('responder', ['responder']);
  setCanonicalParam('demo', ['demo']);

  if (isContractsPath(pathname)) {
    setCanonicalParam('contract', ['contract']);
  }

  if (isChainScopedRegistryPath(pathname)) {
    setCanonicalParam('chainId', ['chainId', 'chainID']);
  }

  if (isSessionWizardPath(pathname)) {
    setCanonicalParam('sponsored', ['sponsored']);
  }

  const canonicalQuery = canonicalParams.toString();
  return canonicalQuery ? `?${canonicalQuery}` : '';
};

export const buildCanonicalPublicUrl = (
  locationLike: LocationLike = typeof window !== 'undefined' ? window.location : undefined,
): string => {
  const windowLocation = typeof window !== 'undefined' ? window.location : undefined;
  const origin = toStr(locationLike?.origin) || toStr(windowLocation?.origin);
  const pathname = normalizePathname(locationLike?.pathname ?? windowLocation?.pathname);
  const search = buildCanonicalSearch(locationLike?.search ?? windowLocation?.search, pathname);
  return origin ? `${origin}${pathname}${search}` : `${pathname}${search}`;
};

export const buildDeploymentDiscoveryUrl = (
  assetPath: unknown,
  locationLike: LocationLike = typeof window !== 'undefined' ? window.location : undefined,
): string => {
  const windowLocation = typeof window !== 'undefined' ? window.location : undefined;
  const origin = toStr(locationLike?.origin) || toStr(windowLocation?.origin);
  const basePath = readPublicUrlBasePath();
  const normalizedAssetPath = toStr(assetPath).startsWith('/') ? toStr(assetPath) : `/${toStr(assetPath)}`;
  return origin ? `${origin}${basePath}${normalizedAssetPath}` : `${basePath}${normalizedAssetPath}`;
};

const buildPublicPageStructuredData = ({
  title = DEFAULT_PUBLIC_PAGE_TITLE,
  description = DEFAULT_PUBLIC_PAGE_DESCRIPTION,
  canonicalUrl = DEFAULT_PUBLIC_SITE_URL,
  location,
}: {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  location?: LocationLike;
} = {}): PublicPageStructuredData => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': PUBLIC_ORGANIZATION_ID,
      name: DEFAULT_PUBLIC_SITE_NAME,
      url: DEFAULT_PUBLIC_SITE_URL,
      sameAs: [PUBLIC_REPO_URL],
    },
    {
      '@type': 'WebSite',
      '@id': PUBLIC_WEBSITE_ID,
      url: DEFAULT_PUBLIC_SITE_URL,
      name: DEFAULT_PUBLIC_SITE_NAME,
      description: DEFAULT_PUBLIC_PAGE_DESCRIPTION,
      publisher: { '@id': PUBLIC_ORGANIZATION_ID },
    },
    {
      '@type': 'SoftwareSourceCode',
      '@id': PUBLIC_SOURCE_CODE_ID,
      name: DEFAULT_PUBLIC_SITE_NAME,
      description: DEFAULT_PUBLIC_PAGE_DESCRIPTION,
      codeRepository: PUBLIC_REPO_URL,
      url: PUBLIC_REPO_SOURCE_URL,
    },
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      isPartOf: { '@id': PUBLIC_WEBSITE_ID },
      about: { '@id': PUBLIC_ORGANIZATION_ID },
      significantLink: [
        PUBLIC_REPO_URL,
        PUBLIC_REPO_SOURCE_URL,
        buildDeploymentDiscoveryUrl(PUBLIC_DISCOVERABILITY_PATH, location),
        buildDeploymentDiscoveryUrl(PUBLIC_LLMS_PATH, location),
      ],
    },
  ],
});

export const syncPublicPageHead = ({
  location = typeof window !== 'undefined' ? window.location : undefined,
  title = DEFAULT_PUBLIC_PAGE_TITLE,
  description = DEFAULT_PUBLIC_PAGE_DESCRIPTION,
  image = DEFAULT_PUBLIC_PAGE_IMAGE,
  canonicalUrl,
  ogUrl,
}: {
  location?: LocationLike;
  title?: unknown;
  description?: unknown;
  image?: unknown;
  canonicalUrl?: unknown;
  ogUrl?: unknown;
} = {}): PublicPageHeadState | null => {
  if (typeof document === 'undefined') return null;

  const resolvedTitle = toStr(title) || DEFAULT_PUBLIC_PAGE_TITLE;
  const resolvedDescription = toStr(description) || DEFAULT_PUBLIC_PAGE_DESCRIPTION;
  const resolvedImage = toStr(image) || DEFAULT_PUBLIC_PAGE_IMAGE;
  const resolvedCanonicalUrl = toStr(canonicalUrl) || buildCanonicalPublicUrl(location);
  const resolvedOgUrl = toStr(ogUrl) || resolvedCanonicalUrl;

  document.title = resolvedTitle;
  setMetaContent('meta[name="description"]', { name: 'description' }, resolvedDescription);
  setMetaContent('meta[property="og:type"]', { property: 'og:type' }, 'website');
  setMetaContent('meta[property="og:url"]', { property: 'og:url' }, resolvedOgUrl);
  setMetaContent('meta[property="og:title"]', { property: 'og:title' }, resolvedTitle);
  setMetaContent('meta[property="og:description"]', { property: 'og:description' }, resolvedDescription);
  setMetaContent('meta[property="og:image"]', { property: 'og:image' }, resolvedImage);
  setMetaContent('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary');
  setMetaContent('meta[name="twitter:title"]', { name: 'twitter:title' }, resolvedTitle);
  setMetaContent('meta[name="twitter:description"]', { name: 'twitter:description' }, resolvedDescription);
  setMetaContent('meta[name="twitter:image"]', { name: 'twitter:image' }, resolvedImage);

  if (resolvedCanonicalUrl) {
    const canonicalNode = ensureHeadNode('link[rel="canonical"]', 'link', { rel: 'canonical' });
    canonicalNode.setAttribute('href', resolvedCanonicalUrl);
  }

  setStructuredDataContent(
    STRUCTURED_DATA_SELECTOR,
    {
      type: 'application/ld+json',
      'data-ce-structured-data': 'public-page',
    },
    JSON.stringify(
      buildPublicPageStructuredData({
        title: resolvedTitle,
        description: resolvedDescription,
        canonicalUrl: resolvedCanonicalUrl || DEFAULT_PUBLIC_SITE_URL,
        location,
      }),
    ),
  );

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    image: resolvedImage,
    canonicalUrl: resolvedCanonicalUrl,
    ogUrl: resolvedOgUrl,
  };
};
