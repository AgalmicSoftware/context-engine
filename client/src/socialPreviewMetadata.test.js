const fs = require('fs');
const os = require('os');
const path = require('path');

let removeDefaultPreviewMediaMeta;
let renderPostSocialPreviewHtml;
let writeStaticPageSocialPreviewHtml;

const clientRoot = path.join(__dirname, '..');
const config = JSON.parse(
  fs.readFileSync(path.join(clientRoot, 'src', 'variables', 'publicSocialPreview.json'), 'utf8'),
);
const indexHtml = fs.readFileSync(path.join(clientRoot, 'index.html'), 'utf8');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const metaTags = (html, attr, value) =>
  html.match(new RegExp(`<meta\\b(?=[^>]*\\b${attr}=(['"])${escapeRegExp(value)}\\1)[^>]*>`, 'gi')) || [];
const metaContent = (html, attr, value) => {
  const [tag] = metaTags(html, attr, value);
  const match = tag && tag.match(/\bcontent=(['"])([\s\S]*?)\1/i);
  return match ? match[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null;
};
const publicFileFor = (url) => path.join(clientRoot, 'public', decodeURIComponent(new URL(url).pathname));

// Minimal ISO-BMFF reader: top-level box order and the video track header size.
const readBoxes = (buf, start, end) => {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header) break;
    boxes.push({ type, start: offset, payload: offset + header, end: offset + size });
    offset += size;
  }
  return boxes;
};
const mp4Info = (file) => {
  const buf = fs.readFileSync(file);
  const top = readBoxes(buf, 0, buf.length);
  const order = top.map((b) => b.type);
  const moov = top.find((b) => b.type === 'moov');
  const tracks = moov ? readBoxes(buf, moov.payload, moov.end).filter((b) => b.type === 'trak') : [];
  const sizes = tracks
    .map((trak) => readBoxes(buf, trak.payload, trak.end).find((b) => b.type === 'tkhd'))
    .filter(Boolean)
    .map((tkhd) => {
      const version = buf.readUInt8(tkhd.payload);
      const at = tkhd.payload + (version === 1 ? 88 : 76);
      return { width: buf.readUInt32BE(at) / 65536, height: buf.readUInt32BE(at + 4) / 65536 };
    })
    .filter((s) => s.width > 0 && s.height > 0);
  return { order, video: sizes[0] || null, bytes: buf.length };
};
const pngSize = (file) => {
  const buf = fs.readFileSync(file);
  expect(buf.toString('latin1', 1, 4)).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length };
};

describe('link-preview metadata for the product film', () => {
  beforeAll(async () => {
    ({ removeDefaultPreviewMediaMeta, renderPostSocialPreviewHtml, writeStaticPageSocialPreviewHtml } =
      await import('../scripts/post-social-preview.mjs'));
  });

  it('puts the film and its poster in the initial HTML crawlers receive', () => {
    const { image, video } = config;
    expect(metaContent(indexHtml, 'property', 'og:video')).toBe(video.url);
    // A video type allows compatible clients to offer inline playback.
    expect(metaContent(indexHtml, 'property', 'og:type')).toBe('video.other');
    expect(metaContent(indexHtml, 'property', 'og:video:secure_url')).toBe(video.url);
    expect(metaContent(indexHtml, 'property', 'og:video:type')).toBe('video/mp4');
    expect(metaContent(indexHtml, 'property', 'og:video:width')).toBe(String(video.width));
    expect(metaContent(indexHtml, 'property', 'og:video:height')).toBe(String(video.height));
    expect(metaContent(indexHtml, 'property', 'og:image')).toBe(image.url);
    expect(metaContent(indexHtml, 'property', 'og:image:type')).toBe(image.type);
    expect(metaContent(indexHtml, 'property', 'og:image:width')).toBe(String(image.width));
    expect(metaContent(indexHtml, 'property', 'og:image:height')).toBe(String(image.height));
    expect(metaContent(indexHtml, 'property', 'og:image:alt')).toBe(image.alt);
    expect(metaContent(indexHtml, 'name', 'twitter:card')).toBe('summary_large_image');
    expect(metaContent(indexHtml, 'name', 'twitter:image')).toBe(image.url);
    expect(metaContent(indexHtml, 'name', 'twitter:image:alt')).toBe(image.alt);
    // No X Player Card: it needs an approved iframe player page (see media/product-film/README.md).
    expect(metaTags(indexHtml, 'name', 'twitter:player')).toHaveLength(0);
    // Open Graph structured properties must follow the og:video they describe.
    const order = ['og:video', 'og:video:secure_url', 'og:video:type', 'og:video:width', 'og:video:height'].map((p) =>
      indexHtml.indexOf(`property="${p}"`),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // The SPA fallback must not claim every route is the homepage.
    expect(metaTags(indexHtml, 'property', 'og:url')).toHaveLength(0);
  });

  it('uses absolute HTTPS, versioned asset URLs that exist in client/public', () => {
    [config.image.url, config.video.url].forEach((url) => {
      expect(url).toMatch(/^https:\/\/contextengine\.sh\/media\/[a-z0-9-]+\/v\d+\/[a-z0-9.-]+$/);
      expect(fs.existsSync(publicFileFor(url))).toBe(true);
    });
    expect(config.video.url).toMatch(/\.mp4$/);
    expect(config.image.alt.length).toBeLessThanOrEqual(420);
  });

  it('declares the real poster and video dimensions', () => {
    const poster = pngSize(publicFileFor(config.image.url));
    expect(poster).toEqual(expect.objectContaining({ width: config.image.width, height: config.image.height }));
    expect(poster.bytes).toBeLessThan(5 * 1024 * 1024);

    const film = mp4Info(publicFileFor(config.video.url));
    expect(film.video).toEqual({ width: config.video.width, height: config.video.height });
    expect(film.bytes).toBeLessThan(8 * 1024 * 1024);
    // Fast start: the movie header precedes the media data so playback can begin early.
    expect(film.order.indexOf('moov')).toBeGreaterThanOrEqual(0);
    expect(film.order.indexOf('moov')).toBeLessThan(film.order.indexOf('mdat'));
  });

  it('keeps post previews on their own header image without the product film', () => {
    const html = renderPostSocialPreviewHtml(indexHtml, {
      slug: 'agent-village-wrapped-2026',
      title: 'Agent Village Wrapped',
      summary: 'A personal-agent evaluation.',
      headerImage: { src: 'agent-village-wrapped/attachments/header.jpg', alt: 'Two illustrated robots read papers.' },
    });

    [
      'og:video',
      'og:video:secure_url',
      'og:video:type',
      'og:video:width',
      'og:video:height',
      'og:image:width',
      'og:image:height',
      'og:image:type',
    ].forEach((property) => expect(metaTags(html, 'property', property)).toHaveLength(0));
    expect(metaContent(html, 'property', 'og:image')).toBe(
      'https://contextengine.sh/posts/agent-village-wrapped/attachments/header.jpg',
    );
    expect(metaContent(html, 'property', 'og:image:alt')).toBe('Two illustrated robots read papers.');
    expect(metaContent(html, 'name', 'twitter:image:alt')).toBe('Two illustrated robots read papers.');
    expect(metaContent(html, 'property', 'og:type')).toBe('article');
    expect(metaTags(html, 'property', 'og:image')).toHaveLength(1);
    expect(removeDefaultPreviewMediaMeta(indexHtml)).not.toMatch(/og:video/);
  });

  it('writes crawler HTML for /about with the film and its own canonical URL', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-static-page-preview-'));
    try {
      fs.writeFileSync(path.join(tempRoot, 'index.html'), indexHtml);
      const written = writeStaticPageSocialPreviewHtml({ buildDir: tempRoot, pages: config.staticPages });
      const nested = path.join(tempRoot, 'about', 'index.html');
      const clean = path.join(tempRoot, 'about.html');
      expect(written).toEqual([nested, clean]);
      const html = fs.readFileSync(nested, 'utf8');
      expect(fs.readFileSync(clean, 'utf8')).toBe(html);
      expect(metaContent(html, 'property', 'og:url')).toBe('https://contextengine.sh/about');
      expect(html).toContain('<link rel="canonical" href="https://contextengine.sh/about" />');
      expect(metaContent(html, 'property', 'og:video')).toBe(config.video.url);
      expect(metaContent(html, 'property', 'og:type')).toBe('video.other');
      expect(metaContent(html, 'property', 'og:image')).toBe(config.image.url);
      expect(metaTags(html, 'property', 'og:video')).toHaveLength(1);
      expect(() => writeStaticPageSocialPreviewHtml({ buildDir: tempRoot, pages: [{ path: '/../escape' }] })).toThrow(
        'Unsafe static page path',
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('caches versioned media immutably and wires the static pages into the build', () => {
    const headers = fs.readFileSync(path.join(clientRoot, 'public', '_headers'), 'utf8');
    for (const url of [config.image.url, config.video.url]) {
      const pathname = new URL(url).pathname;
      expect(headers).toContain(
        `${pathname}\n  Cache-Control: public, max-age=31536000, immutable\n  X-Content-Type-Options: nosniff`,
      );
    }
    // Missing media must not inherit a year-long cache lifetime through a wildcard.
    expect(headers).not.toMatch(/^\/media.*\*/m);
    const viteConfig = fs.readFileSync(path.join(clientRoot, 'vite.config.mjs'), 'utf8');
    expect(viteConfig).toContain("'.mp4': 'video/mp4'");
    expect(viteConfig).toContain(
      'writeStaticPageSocialPreviewHtml({ buildDir: outputDir, pages: publicSocialPreview.staticPages })',
    );
    expect(viteConfig).toMatch(/staticPageSocialPreviewPlugin\(\),/);
  });
});
