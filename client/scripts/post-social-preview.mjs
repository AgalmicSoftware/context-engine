import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PUBLIC_SITE_URL = 'https://contextengine.xyz/';
const SAFE_POST_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

const toTrimmedString = (value) => String(value ?? '').trim();

const escapeHtmlAttribute = (value) =>
  toTrimmedString(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const insertBeforeHeadClose = (html, tag) => {
  const closingHead = /<\/head>/i;
  if (!closingHead.test(html)) return `${html}\n${tag}\n`;
  return html.replace(closingHead, `    ${tag}\n  </head>`);
};

const upsertMeta = (html, attributeName, attributeValue, content) => {
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\b${escapeRegExp(attributeName)}=(['"])${escapeRegExp(attributeValue)}\\1)[^>]*>`,
    'i',
  );
  const tag = `<meta ${attributeName}="${escapeHtmlAttribute(attributeValue)}" content="${escapeHtmlAttribute(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : insertBeforeHeadClose(html, tag);
};

const upsertCanonical = (html, href) => {
  const pattern = /<link\b(?=[^>]*\brel=(['"])canonical\1)[^>]*>/i;
  const tag = `<link rel="canonical" href="${escapeHtmlAttribute(href)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : insertBeforeHeadClose(html, tag);
};

const upsertTitle = (html, title) => {
  const tag = `<title>${escapeHtmlAttribute(title)}</title>`;
  return /<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, tag)
    : insertBeforeHeadClose(html, tag);
};

const resolvePostAssetUrl = (assetPath, siteUrl) => {
  const value = toTrimmedString(assetPath);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const normalized = value.replace(/^\/+/, '');
  const pathname = normalized.startsWith('posts/') ? `/${normalized}` : `/posts/${normalized}`;
  return new URL(pathname, siteUrl).toString();
};

const renderPostSocialPreviewHtml = (baseHtml, post, { siteUrl = DEFAULT_PUBLIC_SITE_URL } = {}) => {
  const html = String(baseHtml || '');
  const slug = toTrimmedString(post?.slug);
  const title = toTrimmedString(post?.title);
  if (!SAFE_POST_SLUG_RE.test(slug)) throw new Error(`Unsafe post slug: ${slug || '(empty)'}`);
  if (!title) throw new Error(`Post "${slug}" is missing a title`);

  const normalizedSiteUrl = new URL(siteUrl).toString();
  const canonicalUrl = new URL(`/posts/${encodeURIComponent(slug)}`, normalizedSiteUrl).toString();
  const description = toTrimmedString(post?.summary);
  const imageUrl = resolvePostAssetUrl(post?.headerImage?.src, normalizedSiteUrl);
  const imageAlt = toTrimmedString(post?.headerImage?.alt);

  let rendered = upsertTitle(html, title);
  rendered = upsertMeta(rendered, 'name', 'description', description);
  rendered = upsertMeta(rendered, 'property', 'og:type', 'article');
  rendered = upsertMeta(rendered, 'property', 'og:url', canonicalUrl);
  rendered = upsertMeta(rendered, 'property', 'og:title', title);
  rendered = upsertMeta(rendered, 'property', 'og:description', description);
  if (imageUrl) {
    rendered = upsertMeta(rendered, 'property', 'og:image', imageUrl);
    rendered = upsertMeta(rendered, 'name', 'twitter:image', imageUrl);
  }
  if (imageAlt) rendered = upsertMeta(rendered, 'property', 'og:image:alt', imageAlt);
  rendered = upsertMeta(rendered, 'name', 'twitter:card', imageUrl ? 'summary_large_image' : 'summary');
  rendered = upsertMeta(rendered, 'name', 'twitter:title', title);
  rendered = upsertMeta(rendered, 'name', 'twitter:description', description);
  rendered = upsertCanonical(rendered, canonicalUrl);

  return rendered;
};

const writePostSocialPreviewHtml = ({ buildDir, postsDir, siteUrl = DEFAULT_PUBLIC_SITE_URL }) => {
  const outputDir = path.resolve(buildDir);
  const manifestPath = path.resolve(postsDir, 'manifest.json');
  const indexPath = path.resolve(outputDir, 'index.html');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(indexPath)) return [];

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const posts = Array.isArray(manifest?.posts) ? manifest.posts : [];
  const baseHtml = fs.readFileSync(indexPath, 'utf8');
  const written = [];

  for (const post of posts) {
    const slug = toTrimmedString(post?.slug);
    if (!SAFE_POST_SLUG_RE.test(slug)) throw new Error(`Unsafe post slug: ${slug || '(empty)'}`);
    const rendered = renderPostSocialPreviewHtml(baseHtml, post, { siteUrl });
    const postOutputDir = path.resolve(outputDir, 'posts', slug);
    const cleanUrlHtmlPath = path.resolve(outputDir, 'posts', `${slug}.html`);
    fs.mkdirSync(postOutputDir, { recursive: true });
    fs.writeFileSync(path.resolve(postOutputDir, 'index.html'), rendered);
    fs.writeFileSync(cleanUrlHtmlPath, rendered);
    written.push(path.resolve(postOutputDir, 'index.html'), cleanUrlHtmlPath);
  }

  return written;
};

export {
  DEFAULT_PUBLIC_SITE_URL,
  renderPostSocialPreviewHtml,
  writePostSocialPreviewHtml,
};
