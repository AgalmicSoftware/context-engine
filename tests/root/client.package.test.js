'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const rootDir = resolve(__dirname, '..', '..');

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(rootDir, relativePath), 'utf8'));
const readText = (relativePath) => readFileSync(resolve(rootDir, relativePath), 'utf8');
const sha256 = (relativePath) =>
  createHash('sha256')
    .update(readFileSync(resolve(rootDir, relativePath)))
    .digest('hex');

test('root and client packages require the same supported Node and npm versions', () => {
  const rootPackage = readJson('package.json');
  const rootLock = readJson('package-lock.json');
  const clientPackage = readJson('client/package.json');

  assert.deepEqual(rootPackage.engines, clientPackage.engines);
  assert.deepEqual(rootLock?.packages?.['']?.engines, clientPackage.engines);
});

test('client dev/build scripts stay rooted at / while package homepage points to the live site', () => {
  const pkg = readJson('client/package.json');

  assert.equal(pkg?.homepage, 'https://contextengine.sh/');
  assert.equal(pkg?.scripts?.dev, 'PUBLIC_URL=/ vite --host 0.0.0.0 --port 3000');
  assert.equal(pkg?.scripts?.build, 'PUBLIC_URL=/ vite build');
});

test('client installs use strict peer resolution without a package npmrc shim', () => {
  const lock = readJson('client/package-lock.json');
  const domPeer = lock?.packages?.['node_modules/@testing-library/dom'];

  assert.equal(existsSync(resolve(rootDir, 'client/.npmrc')), false);
  assert.equal(domPeer?.version, '10.4.1');
  assert.equal(domPeer?.peer, true);
});

test('Netlify builds the client from the repository-root deployment contract', () => {
  const configPath = resolve(rootDir, 'netlify.toml');

  assert.equal(existsSync(configPath), true);
  assert.equal(existsSync(resolve(rootDir, 'client/netlify.toml')), false);

  const config = readFileSync(configPath, 'utf8');
  assert.match(config, /\[build\]/);
  assert.match(config, /base\s*=\s*"client"/);
  assert.match(
    config,
    /command\s*=\s*"npm ci && REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT=\$COMMIT_REF npm run build"/
  );
  assert.match(config, /publish\s*=\s*"build"/);
  assert.match(config, /NODE_VERSION\s*=\s*"20"/);
  assert.match(
    config,
    /from\s*=\s*"\/demo\/dacc"[\s\S]*?to\s*=\s*"\/about"[\s\S]*?status\s*=\s*301/
  );
  assert.match(
    config,
    /from\s*=\s*"\/\*"[\s\S]*?to\s*=\s*"\/index\.html"[\s\S]*?status\s*=\s*200/
  );
  // Missing hashed assets must 404 before the SPA rewrite can answer them with HTML that
  // the year-long /assets cache header would pin; the moved preview image redirects.
  const previewRedirect = config.search(
    /from\s*=\s*"\/assets\/img\/context-engine-social-preview-square\.png"\s*to\s*=\s*"\/context-engine-social-preview-square\.png"\s*status\s*=\s*301/
  );
  const missingAssetRule = config.search(/from\s*=\s*"\/assets\/\*"\s*to\s*=\s*"\/404\.html"\s*status\s*=\s*404/);
  const spaFallback = config.search(/from\s*=\s*"\/\*"/);
  assert.ok(previewRedirect > 0 && previewRedirect < missingAssetRule, 'preview redirect precedes the asset 404');
  assert.ok(missingAssetRule > 0 && missingAssetRule < spaFallback, 'asset 404 precedes the SPA fallback');

  assert.equal(
    readText('client/public/_redirects'),
    [
      '/demo/dacc /about 301',
      '/assets/img/context-engine-social-preview-square.png /context-engine-social-preview-square.png 301',
      '/assets/* /404.html 404',
      '/* /index.html 200',
      '',
    ].join('\n'),
  );
});

test('client HTML shell leaves route-specific canonical metadata to runtime head sync', () => {
  const html = readText('client/index.html');

  assert.doesNotMatch(
    html,
    /<meta\s+property="og:url"\s+content="https:\/\/contextengine\.xyz\/"\s*\/?>/
  );
  assert.doesNotMatch(
    html,
    /<link\s+rel="canonical"\s+href="https:\/\/contextengine\.xyz\/"\s*\/?>/
  );
});

test('client HTML shell seeds structured data with the public GitHub repository', () => {
  const html = readText('client/index.html');

  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"sameAs":\s*\["https:\/\/github\.com\/AgalmicSoftware\/context-engine"\]/);
  assert.doesNotMatch(html, /"@type":\s*"WebPage"/);
});

test('client HTML shell loads its fonts in one swap request after the preconnect hints', () => {
  const html = readText('client/index.html');
  const stylesheets = (html.match(/<link\b[^>]*>/g) || []).filter(
    (tag) => tag.includes('rel="stylesheet"') && tag.includes('fonts.googleapis.com'),
  );

  assert.equal(stylesheets.length, 1);
  const fontsUrl = new URL(stylesheets[0].match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&'));
  assert.equal(fontsUrl.pathname, '/css2');
  // Minimal uses Open Sans at 600-800, so load the variable weight range instead of synthesizing bold.
  assert.deepEqual(fontsUrl.searchParams.getAll('family'), [
    'Open Sans:ital,wght@0,300..800;1,300..800',
    'Poppins:wght@400;600;700;800',
  ]);
  assert.equal(fontsUrl.searchParams.get('display'), 'swap');
  const stylesheetIndex = html.indexOf(stylesheets[0]);
  assert.ok(html.indexOf('<link rel="preconnect" href="https://fonts.googleapis.com">') < stylesheetIndex);
  assert.ok(html.indexOf('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>') < stylesheetIndex);
});

test('client HTML shell description stays aligned with the README framing', () => {
  const html = readText('client/index.html');

  assert.match(html, /AI-enhanced deliberation and sensemaking in large groups/);
  assert.match(html, /cryptographic access control/);
});

const readHeaderRules = () => {
  const rules = {};
  let current = null;
  readText('client/public/_headers')
    .split('\n')
    .forEach((line) => {
      if (!line.trim() || line.trim().startsWith('#')) return;
      if (!/^\s/.test(line)) {
        current = {};
        rules[line.trim()] = current;
        return;
      }
      const separator = line.indexOf(':');
      current[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    });
  return rules;
};

test('client static headers enforce the baseline CSP and report a strict-script policy', () => {
  const headers = readHeaderRules()['/*'];

  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(
    headers['Content-Security-Policy'],
    "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  const reportOnly = Object.fromEntries(
    headers['Content-Security-Policy-Report-Only'].split(';').map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources.join(' ')];
    }),
  );
  assert.deepEqual(reportOnly, {
    'default-src': "'self'",
    'script-src': "'self'",
    'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
    'img-src': "'self' data: blob: https:",
    'font-src': "'self' data: https://fonts.gstatic.com",
    'connect-src': "'self' https: wss:",
    'worker-src': "'self' blob:",
    // Document Library previews PDFs in a blob: frame.
    'frame-src': 'https: blob:',
    'media-src': "'self' data: blob: https:",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
    'frame-ancestors': "'none'",
  });
});

test('client isolation headers come from the host, not ignored meta tags', () => {
  const headers = readHeaderRules()['/*'];

  // Browsers ignore COOP/COEP in <meta http-equiv>; auth popups rely on the HTTP headers.
  assert.doesNotMatch(readText('client/index.html'), /http-equiv="Cross-Origin-/i);
  assert.equal(headers['Cross-Origin-Opener-Policy'], 'same-origin-allow-popups');
  assert.equal(headers['Cross-Origin-Embedder-Policy'], 'unsafe-none');
});

test('client static headers cache only hashed build assets as immutable', () => {
  const rules = readHeaderRules();

  // Overlapping Netlify rules combine values, so the catch-all rule must not set caching.
  ['Cache-Control', 'Pragma', 'Expires'].forEach((name) => assert.equal(rules['/*'][name], undefined, name));
  assert.deepEqual(rules['/assets/*'], { 'Cache-Control': 'public, max-age=31536000, immutable' });
  // Public files are copied unhashed, so none may be served from the immutable /assets path.
  assert.equal(existsSync(resolve(rootDir, 'client/public/assets')), false);
});

test('client social preview image lives outside the immutable asset path', () => {
  const html = readText('client/index.html');
  const imageUrl = 'https://contextengine.sh/context-engine-social-preview-square.png';

  assert.ok(html.includes(`<meta property="og:image" content="${imageUrl}" />`));
  assert.ok(html.includes(`<meta name="twitter:image" content="${imageUrl}" />`));
  assert.ok(existsSync(resolve(rootDir, 'client/public/context-engine-social-preview-square.png')));
});

test('public favicon family uses white circuit C artwork with alpha transparency', () => {
  const expectedHashes = {
    'client/public/favicon-16x16.png': '023aafa47101b75938a54d56d921da32830fb96ab91003f2a280de939d938686',
    'client/public/favicon-32x32.png': '7aa31ee9aad774777b35abfc23e2cb51a109dd18ff2406bf962c4c392e980baa',
    'client/public/apple-touch-icon.png': 'f870048b7ac0bb42887347bccbc1124a1aa3884dd41f18446978c07069438c67',
    'client/public/android-chrome-192x192.png': '52a79605c7f70613e5f6d3a947741c220f7cc492f945ca08d99ea13cb1ace861',
    'client/public/android-chrome-512x512.png': 'dfd774627a60aeb5100a53d7a0493116df16fa80415bf74b7a14952f5a879a30',
    'client/public/favicon.ico': '651d4d8693a205792ec5b8935cd42ef4db19ef9b546d28958f9497533a664c7e',
  };

  Object.entries(expectedHashes).forEach(([relativePath, expectedHash]) => {
    assert.equal(sha256(relativePath), expectedHash, relativePath);
  });

  Object.keys(expectedHashes)
    .filter((relativePath) => relativePath.endsWith('.png'))
    .forEach((relativePath) => {
      const png = readFileSync(resolve(rootDir, relativePath));

      assert.equal(png[24], 8, `${relativePath} should use 8-bit channels`);
      assert.equal(png[25], 6, `${relativePath} should use RGBA color`);
    });

  const ico = readFileSync(resolve(rootDir, 'client/public/favicon.ico'));
  assert.equal(ico.readUInt16LE(12), 32, 'favicon.ico should use 32-bit BGRA color');
});
