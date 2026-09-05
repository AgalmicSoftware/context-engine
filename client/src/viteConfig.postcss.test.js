const fs = require('fs');
const os = require('os');
const path = require('path');
let renderPostSocialPreviewHtml;
let writePostSocialPreviewHtml;

describe('vite PostCSS compatibility', () => {
  const clientRoot = path.join(__dirname, '..');

  beforeAll(async () => {
    ({ renderPostSocialPreviewHtml, writePostSocialPreviewHtml } = await import('../scripts/post-social-preview.mjs'));
  });

  it('keeps the retired PurgeCSS config out of the Vite CSS module path', () => {
    const config = fs.readFileSync(path.join(clientRoot, 'vite.config.mjs'), 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(clientRoot, 'package.json'), 'utf8'));

    expect(config).toMatch(/postcss:\s*{\s*plugins:\s*\[\]\s*}/);
    expect(config).toMatch(/PurgeCSS/);
    expect(config).toMatch(/stripped CSS Module selectors/);
    expect(fs.existsSync(path.join(clientRoot, 'postcss.config.js'))).toBe(false);
    expect(pkg.dependencies['@fullhuman/postcss-purgecss']).toBeUndefined();
    expect(pkg.devDependencies['@fullhuman/postcss-purgecss']).toBeUndefined();
  });

  it('serves root posts Markdown as static assets', () => {
    const config = fs.readFileSync(path.join(clientRoot, 'vite.config.mjs'), 'utf8');

    expect(config).toMatch(/const postsDir = path\.resolve\(__dirname, '\.\.', 'posts'\);/);
    expect(config).toContain("'.md': 'text/markdown; charset=utf-8'");
    expect(config).toMatch(/name:\s*'ce-posts-assets-compatibility'/);
    expect(config).toMatch(/fs\.cpSync\(postsDir,[\s\S]*'posts'\)/);
    expect(config).toContain('writePostSocialPreviewHtml({ buildDir: outputDir, postsDir })');
  });

  it('keeps PUBLIC_URL on the process.env expression replaced by Vite', () => {
    const publicUrlSource = fs.readFileSync(path.join(clientRoot, 'src', 'utilities', 'ui', 'publicUrl.ts'), 'utf8');

    expect(publicUrlSource).toContain('const BUNDLED_PUBLIC_URL_PROCESS: ProcWithEnv = { env: process.env };');
    expect(publicUrlSource).toContain('proc: ProcWithEnv = BUNDLED_PUBLIC_URL_PROCESS');
    expect(publicUrlSource).not.toContain("typeof process !== 'undefined' ? process : undefined");
  });

  it('pre-bundles the shared CommonJS modules used during browser startup', () => {
    const config = fs.readFileSync(path.join(clientRoot, 'vite.config.mjs'), 'utf8');
    const cryptographySource = fs.readFileSync(
      path.join(clientRoot, 'src', 'utilities', 'crypto', 'cryptography.ts'),
      'utf8',
    );

    expect(config).toContain("'utilities/crypto/groupPasswordDerivation.cjs'");
    expect(config).toContain("'@ce-shared/rpcDefaults.cjs'");
    expect(config).toContain("find: '@ce-shared'");
    expect(cryptographySource).toContain("from 'utilities/crypto/groupPasswordDerivation.cjs'");
    expect(fs.readFileSync(path.join(clientRoot, 'src', 'variables', 'rpcDefaults.ts'), 'utf8')).toContain(
      "from '@ce-shared/rpcDefaults.cjs'",
    );
  });

  it('resolves shared envelope dependencies from the client install', () => {
    const config = fs.readFileSync(path.join(clientRoot, 'vite.config.mjs'), 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(clientRoot, 'package.json'), 'utf8'));
    const sharedEnvelopeCore = fs.readFileSync(
      path.join(clientRoot, '..', 'shared', 'encryption', 'envelopeV1Core.mjs'),
      'utf8',
    );

    expect(sharedEnvelopeCore).toContain("from 'ethers'");
    expect(pkg.dependencies.ethers).toBe('5.7.2');
    expect(config).toContain('find: /^ethers$/');
    expect(config).toContain("path.resolve(__dirname, 'node_modules', 'ethers', 'lib.esm', 'index.js')");
  });

  it('writes crawler-facing post HTML with the header as a large social image', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-post-social-preview-'));
    const buildDir = path.join(tempRoot, 'build');
    const postsDir = path.join(tempRoot, 'posts');
    const post = {
      slug: 'agent-village-wrapped-2026',
      title: 'Agent Village & "Wrapped"',
      summary: 'A personal-agent evaluation.',
      headerImage: {
        src: 'agent-village-wrapped/attachments/header.jpg',
        alt: 'Two illustrated robots read papers.',
      },
    };

    try {
      fs.mkdirSync(buildDir, { recursive: true });
      fs.mkdirSync(postsDir, { recursive: true });
      fs.writeFileSync(
        path.join(buildDir, 'index.html'),
        '<html><head><title>Context Engine</title><meta property="og:image" content="default.png" /></head></html>',
      );
      fs.writeFileSync(path.join(postsDir, 'manifest.json'), JSON.stringify({ posts: [post] }));

      const written = writePostSocialPreviewHtml({ buildDir, postsDir });
      const nestedHtmlPath = path.join(buildDir, 'posts', post.slug, 'index.html');
      const cleanUrlHtmlPath = path.join(buildDir, 'posts', `${post.slug}.html`);
      const html = fs.readFileSync(nestedHtmlPath, 'utf8');

      expect(written).toEqual([nestedHtmlPath, cleanUrlHtmlPath]);
      expect(fs.readFileSync(cleanUrlHtmlPath, 'utf8')).toBe(html);
      expect(html).toContain('<title>Agent Village &amp; &quot;Wrapped&quot;</title>');
      expect(html).toContain('property="og:type" content="article"');
      expect(html).toContain('name="twitter:card" content="summary_large_image"');
      expect(html).toContain(
        'property="og:image" content="https://contextengine.sh/posts/agent-village-wrapped/attachments/header.jpg"',
      );
      expect(html).toContain('rel="canonical" href="https://contextengine.sh/posts/agent-village-wrapped-2026"');
      expect(() => renderPostSocialPreviewHtml('<html><head></head></html>', { ...post, slug: '../private' })).toThrow(
        'Unsafe post slug',
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
