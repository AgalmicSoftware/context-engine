import { readPublicUrlBasePath } from './publicUrl.js';
import {
  PUBLIC_DISCOVERABILITY_PATH,
  PUBLIC_LLMS_PATH,
  PUBLIC_REPO_SOURCE_URL,
  PUBLIC_REPO_URL,
} from '../../variables/publicRepoMetadata.js';
import publicSocialPreview from '../../variables/publicSocialPreview.json';

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

export type PublicPageVideo = {
  url: string;
  type: string;
  width: number;
  height: number;
};

export type PublicPageHeadState = {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  ogType: string;
  twitterCard: string;
  canonicalUrl: string;
  ogUrl: string;
  video: PublicPageVideo | null;
};

export const DEFAULT_PUBLIC_PAGE_TITLE = 'Context Engine | Deliberation Toolkit';

export const DEFAULT_PUBLIC_PAGE_DESCRIPTION =
  'Context Engine is a toolkit for AI-enhanced deliberation and sensemaking in large groups, with public and private participation, permanent records, and cryptographic access control.';

// The default site-wide preview (homepage, About and other app routes): a
// 1200x630 poster plus the product film for platforms that play og:video.
// Values live in variables/publicSocialPreview.json so client/index.html and the
// build-time static page writer stay identical to the runtime head.
export const DEFAULT_PUBLIC_PAGE_IMAGE = publicSocialPreview.image.url;
export const DEFAULT_PUBLIC_PAGE_IMAGE_TYPE = publicSocialPreview.image.type;
export const DEFAULT_PUBLIC_PAGE_IMAGE_WIDTH = publicSocialPreview.image.width;
export const DEFAULT_PUBLIC_PAGE_IMAGE_HEIGHT = publicSocialPreview.image.height;
export const DEFAULT_PUBLIC_PAGE_IMAGE_ALT = publicSocialPreview.image.alt;
export const DEFAULT_PUBLIC_PAGE_VIDEO: PublicPageVideo = Object.freeze({ ...publicSocialPreview.video });
export const DEFAULT_PUBLIC_TWITTER_CARD = publicSocialPreview.twitterCard;
export const DEFAULT_PUBLIC_SITE_NAME = publicSocialPreview.siteName;
export const DEFAULT_PUBLIC_SITE_URL = publicSocialPreview.siteUrl;

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

const removeHeadNodes = (selector: string): void => {
  document.head.querySelectorAll(selector).forEach((node) => node.remove());
};

const setOptionalMetaContent = (selector: string, attrs: Record<string, string>, content: string): void => {
  if (content) {
    setMetaContent(selector, attrs, content);
  } else {
    removeHeadNodes(selector);
  }
};

const toDimension = (value: unknown): string => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? String(n) : '';
};

const OG_VIDEO_PROPERTIES = [
  'og:video',
  'og:video:url',
  'og:video:secure_url',
  'og:video:type',
  'og:video:width',
  'og:video:height',
];

const normalizeVideo = (video: unknown): PublicPageVideo | null => {
  if (!video || typeof video !== 'object') return null;
  const candidate = video as Partial<PublicPageVideo>;
  const url = toStr(candidate.url);
  if (!/^https:\/\//i.test(url)) return null;
  const width = Number(toDimension(candidate.width));
  const height = Number(toDimension(candidate.height));
  return { url, type: toStr(candidate.type) || 'video/mp4', width, height };
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

const isDocsPath = (pathname = ''): boolean => {
  const routePath = stripConfiguredPublicBasePath(pathname).toLowerCase();
  return (
    routePath === '/docs' ||
    routePath.startsWith('/docs/') ||
    routePath === '/contracts' ||
    routePath.startsWith('/contracts/')
  );
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

  if (isDocsPath(pathname)) {
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
  image,
  imageAlt,
  imageWidth,
  imageHeight,
  imageType,
  video,
  ogType,
  twitterCard = DEFAULT_PUBLIC_TWITTER_CARD,
  canonicalUrl,
  ogUrl,
}: {
  location?: LocationLike;
  title?: unknown;
  description?: unknown;
  image?: unknown;
  imageAlt?: unknown;
  imageWidth?: unknown;
  imageHeight?: unknown;
  imageType?: unknown;
  // undefined: the product film accompanies the default poster only.
  // null: no video. An object: that video.
  video?: PublicPageVideo | null;
  ogType?: unknown;
  twitterCard?: unknown;
  canonicalUrl?: unknown;
  ogUrl?: unknown;
} = {}): PublicPageHeadState | null => {
  if (typeof document === 'undefined') return null;

  const resolvedTitle = toStr(title) || DEFAULT_PUBLIC_PAGE_TITLE;
  const resolvedDescription = toStr(description) || DEFAULT_PUBLIC_PAGE_DESCRIPTION;
  const customImage = toStr(image);
  const usesDefaultImage = !customImage || customImage === DEFAULT_PUBLIC_PAGE_IMAGE;
  const resolvedImage = customImage || DEFAULT_PUBLIC_PAGE_IMAGE;
  const resolvedImageAlt = toStr(imageAlt) || (usesDefaultImage ? DEFAULT_PUBLIC_PAGE_IMAGE_ALT : '');
  const resolvedImageWidth =
    toDimension(imageWidth) || (usesDefaultImage ? String(DEFAULT_PUBLIC_PAGE_IMAGE_WIDTH) : '');
  const resolvedImageHeight =
    toDimension(imageHeight) || (usesDefaultImage ? String(DEFAULT_PUBLIC_PAGE_IMAGE_HEIGHT) : '');
  const resolvedImageType = toStr(imageType) || (usesDefaultImage ? DEFAULT_PUBLIC_PAGE_IMAGE_TYPE : '');
  const resolvedVideo =
    video === undefined ? (usesDefaultImage ? DEFAULT_PUBLIC_PAGE_VIDEO : null) : normalizeVideo(video);
  // A video og:type lets compatible clients offer inline playback of the product film.
  // The poster remains available to clients that do not support it.
  const resolvedOgType = toStr(ogType) || (resolvedVideo ? 'video.other' : 'website');
  const resolvedTwitterCard = toStr(twitterCard) || DEFAULT_PUBLIC_TWITTER_CARD;
  const resolvedCanonicalUrl = toStr(canonicalUrl) || buildCanonicalPublicUrl(location);
  const resolvedOgUrl = toStr(ogUrl) || resolvedCanonicalUrl;

  document.title = resolvedTitle;
  setMetaContent('meta[name="description"]', { name: 'description' }, resolvedDescription);
  setMetaContent('meta[property="og:type"]', { property: 'og:type' }, resolvedOgType);
  setMetaContent('meta[property="og:url"]', { property: 'og:url' }, resolvedOgUrl);
  setMetaContent('meta[property="og:title"]', { property: 'og:title' }, resolvedTitle);
  setMetaContent('meta[property="og:description"]', { property: 'og:description' }, resolvedDescription);
  setMetaContent('meta[property="og:site_name"]', { property: 'og:site_name' }, DEFAULT_PUBLIC_SITE_NAME);
  setMetaContent('meta[property="og:image"]', { property: 'og:image' }, resolvedImage);
  setOptionalMetaContent('meta[property="og:image:type"]', { property: 'og:image:type' }, resolvedImageType);
  setOptionalMetaContent('meta[property="og:image:width"]', { property: 'og:image:width' }, resolvedImageWidth);
  setOptionalMetaContent('meta[property="og:image:height"]', { property: 'og:image:height' }, resolvedImageHeight);
  setOptionalMetaContent('meta[property="og:image:alt"]', { property: 'og:image:alt' }, resolvedImageAlt);
  OG_VIDEO_PROPERTIES.forEach((property) => removeHeadNodes(`meta[property="${property}"]`));
  if (resolvedVideo) {
    // Order matters for Open Graph parsers: og:video first, then its structured properties.
    setMetaContent('meta[property="og:video"]', { property: 'og:video' }, resolvedVideo.url);
    setMetaContent('meta[property="og:video:secure_url"]', { property: 'og:video:secure_url' }, resolvedVideo.url);
    setMetaContent('meta[property="og:video:type"]', { property: 'og:video:type' }, resolvedVideo.type);
    setOptionalMetaContent(
      'meta[property="og:video:width"]',
      { property: 'og:video:width' },
      toDimension(resolvedVideo.width),
    );
    setOptionalMetaContent(
      'meta[property="og:video:height"]',
      { property: 'og:video:height' },
      toDimension(resolvedVideo.height),
    );
  }
  setMetaContent('meta[name="twitter:card"]', { name: 'twitter:card' }, resolvedTwitterCard);
  setMetaContent('meta[name="twitter:title"]', { name: 'twitter:title' }, resolvedTitle);
  setMetaContent('meta[name="twitter:description"]', { name: 'twitter:description' }, resolvedDescription);
  setMetaContent('meta[name="twitter:image"]', { name: 'twitter:image' }, resolvedImage);
  setOptionalMetaContent('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt' }, resolvedImageAlt);

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
    imageAlt: resolvedImageAlt,
    ogType: resolvedOgType,
    twitterCard: resolvedTwitterCard,
    canonicalUrl: resolvedCanonicalUrl,
    ogUrl: resolvedOgUrl,
    video: resolvedVideo,
  };
};
