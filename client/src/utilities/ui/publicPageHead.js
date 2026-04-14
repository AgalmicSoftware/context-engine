import { readPublicUrlBasePath } from './publicUrl.js';

export const DEFAULT_PUBLIC_PAGE_TITLE =
  'Context Engine | AI-Assisted Deliberation, Surveys, and SBT-Gated Access';

export const DEFAULT_PUBLIC_PAGE_DESCRIPTION =
  'Context Engine helps groups run structured surveys, AI-assisted analysis, and public or private participation workflows with durable records and optional SBT-gated encryption.';

export const DEFAULT_PUBLIC_PAGE_IMAGE = 'https://contextengine.xyz/android-chrome-512x512.png';

const toStr = (value) => String(value ?? '').trim();

const ensureHeadNode = (selector, tagName, attrs = {}) => {
  let node = document.head.querySelector(selector);
  if (node) return node;
  node = document.createElement(tagName);
  Object.entries(attrs).forEach(([key, value]) => {
    node.setAttribute(key, value);
  });
  document.head.appendChild(node);
  return node;
};

const setMetaContent = (selector, attrs, content) => {
  const node = ensureHeadNode(selector, 'meta', attrs);
  node.setAttribute('content', content);
  return node;
};

const normalizePathname = (pathname) => {
  const raw = toStr(pathname);
  if (!raw) return '/';
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  if (withLeadingSlash === '/') return '/';
  return withLeadingSlash.replace(/\/+$/, '') || '/';
};

const normalizeCanonicalParamValue = (value) => {
  const normalized = toStr(value);
  return normalized || '';
};

const stripConfiguredPublicBasePath = (pathname = '') => {
  const normalizedPath = normalizePathname(pathname);
  const configuredBasePath = normalizePathname(readPublicUrlBasePath());
  if (!configuredBasePath || configuredBasePath === '/') return normalizedPath;
  if (normalizedPath === configuredBasePath) return '/';
  if (normalizedPath.startsWith(`${configuredBasePath}/`)) {
    return normalizedPath.slice(configuredBasePath.length) || '/';
  }
  return normalizedPath;
};

const isContractsPath = (pathname = '') => {
  const routePath = stripConfiguredPublicBasePath(pathname).toLowerCase();
  return routePath.startsWith('/contracts');
};

const isSessionWizardPath = (pathname = '') => {
  const normalizedPath = stripConfiguredPublicBasePath(pathname).toLowerCase();
  return normalizedPath === '/new' || normalizedPath === '/session/new';
};

const isChainScopedRegistryPath = (pathname = '') => {
  const normalizedPath = stripConfiguredPublicBasePath(pathname).toLowerCase();
  return (
    normalizedPath === '/new' ||
    normalizedPath === '/session/new' ||
    normalizedPath === '/admin' ||
    normalizedPath === '/sponsor'
  );
};

const buildCanonicalSearch = (search, pathname = '') => {
  const raw = toStr(search);
  if (!raw || raw === '?') return '';

  const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`);
  const canonicalParams = new URLSearchParams();
  const setCanonicalParam = (canonicalKey, aliases = []) => {
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
  locationLike = (typeof window !== 'undefined' ? window.location : undefined)
) => {
  const windowLocation = typeof window !== 'undefined' ? window.location : undefined;
  const origin = toStr(locationLike?.origin) || toStr(windowLocation?.origin);
  const pathname = normalizePathname(locationLike?.pathname ?? windowLocation?.pathname);
  const search = buildCanonicalSearch(locationLike?.search ?? windowLocation?.search, pathname);
  return origin ? `${origin}${pathname}${search}` : `${pathname}${search}`;
};

export const syncPublicPageHead = ({
  location = (typeof window !== 'undefined' ? window.location : undefined),
  title = DEFAULT_PUBLIC_PAGE_TITLE,
  description = DEFAULT_PUBLIC_PAGE_DESCRIPTION,
  image = DEFAULT_PUBLIC_PAGE_IMAGE,
  canonicalUrl,
  ogUrl,
} = {}) => {
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
  setMetaContent(
    'meta[property="og:description"]',
    { property: 'og:description' },
    resolvedDescription
  );
  setMetaContent('meta[property="og:image"]', { property: 'og:image' }, resolvedImage);
  setMetaContent('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary');
  setMetaContent('meta[name="twitter:title"]', { name: 'twitter:title' }, resolvedTitle);
  setMetaContent(
    'meta[name="twitter:description"]',
    { name: 'twitter:description' },
    resolvedDescription
  );
  setMetaContent('meta[name="twitter:image"]', { name: 'twitter:image' }, resolvedImage);

  if (resolvedCanonicalUrl) {
    const canonicalNode = ensureHeadNode('link[rel="canonical"]', 'link', { rel: 'canonical' });
    canonicalNode.setAttribute('href', resolvedCanonicalUrl);
  }

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    image: resolvedImage,
    canonicalUrl: resolvedCanonicalUrl,
    ogUrl: resolvedOgUrl,
  };
};
