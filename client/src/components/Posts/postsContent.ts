import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';

export type PostManifestEntry = {
  slug: string;
  title: string;
  file: string;
  date?: string;
  summary?: string;
  author?: string;
  headerImage?: PostImage;
  attachments?: string;
  tags: string[];
};

export type PostImage = {
  src: string;
  alt: string;
  caption?: string;
};

export type PostsManifest = {
  posts: PostManifestEntry[];
};

export type LoadedPost = PostManifestEntry & {
  markdown: string;
};

export type PostsFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const POSTS_MANIFEST_PATH = '/posts/manifest.json';

const ABSOLUTE_URL_RE = /^[a-z][a-z\d+\-.]*:\/\//i;
const HTTP_URL_RE = /^https?:\/\//i;

const toTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isSafeRelativePostPath = (value: string): boolean => {
  if (!value) return false;
  if (ABSOLUTE_URL_RE.test(value)) return true;
  const normalized = value.replace(/^\/+/, '');
  const segments = normalized.split('/');
  if (segments.includes('..')) return false;
  return normalized.startsWith('posts/') || !normalized.startsWith('.');
};

const isSafePostAssetPath = (value: string): boolean => {
  if (!value) return false;
  if (ABSOLUTE_URL_RE.test(value)) return HTTP_URL_RE.test(value);
  const normalized = value.replace(/^\/+/, '');
  const segments = normalized.split('/');
  if (segments.includes('..')) return false;
  return normalized.startsWith('posts/') || !normalized.startsWith('.');
};

const stripPostsPrefix = (value: string): string => value.replace(/^\/+/, '').replace(/^posts\//, '');

export const getPostAssetBasePath = (postFile: unknown): string => {
  const value = toTrimmedString(postFile);
  if (!value || ABSOLUTE_URL_RE.test(value)) return '';

  const normalized = stripPostsPrefix(value);
  if (normalized.split('/').includes('..')) return '';

  const lastSlashIndex = normalized.lastIndexOf('/');
  return lastSlashIndex >= 0 ? normalized.slice(0, lastSlashIndex) : '';
};

export const buildPostAssetUrl = (pathOrUrl: unknown, assetBasePath = ''): string => {
  const value = toTrimmedString(pathOrUrl);
  if (!value) return '';
  if (ABSOLUTE_URL_RE.test(value)) return value;

  if (value.replace(/^\/+/, '').split('/').includes('..')) return '';

  const normalized = value.replace(/^\/+/, '');
  const normalizedBase = stripPostsPrefix(assetBasePath).replace(/\/+$/, '');
  const resolvedPath =
    normalized.startsWith('posts/') || value.startsWith('/') || !normalizedBase
      ? normalized
      : `${normalizedBase}/${normalized}`;
  const postsPath = resolvedPath.startsWith('posts/') ? `/${resolvedPath}` : `/posts/${resolvedPath}`;
  return buildPublicRoute(postsPath);
};

const normalizeTags = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((tag) => toTrimmedString(tag))
        .filter(Boolean)
        .slice(0, 8)
    : [];

const normalizePostImage = (value: unknown): PostImage | undefined => {
  if (!value) return undefined;

  const record = typeof value === 'object' ? (value as Record<string, unknown>) : { src: value };

  const rawSrc = toTrimmedString(record.src);
  if (!isSafePostAssetPath(rawSrc)) return undefined;

  const alt = toTrimmedString(record.alt);
  const caption = toTrimmedString(record.caption);

  return {
    src: buildPostAssetUrl(rawSrc),
    alt,
    ...(caption ? { caption } : {}),
  };
};

const normalizePostAttachmentDirectory = (value: unknown): string | undefined => {
  const rawPath = toTrimmedString(value);
  if (!isSafePostAssetPath(rawPath)) return undefined;
  return buildPostAssetUrl(rawPath);
};

export const normalizePostsManifest = (value: unknown): PostManifestEntry[] => {
  const posts = !!value && typeof value === 'object' ? (value as { posts?: unknown }).posts : null;

  if (!Array.isArray(posts)) return [];

  return posts
    .map((entry): PostManifestEntry | null => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const slug = toTrimmedString(record.slug);
      const title = toTrimmedString(record.title);
      const file = toTrimmedString(record.file);
      if (!slug || !title || !isSafeRelativePostPath(file)) return null;

      const date = toTrimmedString(record.date);
      const summary = toTrimmedString(record.summary);
      const author = toTrimmedString(record.author);
      const headerImage = normalizePostImage(record.headerImage);
      const attachments = normalizePostAttachmentDirectory(record.attachments);

      return {
        slug,
        title,
        file,
        ...(date ? { date } : {}),
        ...(summary ? { summary } : {}),
        ...(author ? { author } : {}),
        ...(headerImage ? { headerImage } : {}),
        ...(attachments ? { attachments } : {}),
        tags: normalizeTags(record.tags),
      };
    })
    .filter((entry): entry is PostManifestEntry => !!entry)
    .sort((left, right) => {
      const dateOrder = String(right.date || '').localeCompare(String(left.date || ''));
      return dateOrder || left.title.localeCompare(right.title);
    });
};

export const loadPostsManifest = async (
  fetcher: PostsFetch,
  manifestPath: string = POSTS_MANIFEST_PATH,
): Promise<PostManifestEntry[]> => {
  const response = await fetcher(buildPostAssetUrl(manifestPath), {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Posts manifest unavailable (${response.status})`);
  }

  return normalizePostsManifest(await response.json());
};

export const loadPostMarkdown = async (post: PostManifestEntry, fetcher: PostsFetch): Promise<LoadedPost> => {
  const response = await fetcher(buildPostAssetUrl(post.file), {
    headers: { accept: 'text/markdown,text/plain' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Post unavailable (${response.status})`);
  }

  return {
    ...post,
    markdown: await response.text(),
  };
};
