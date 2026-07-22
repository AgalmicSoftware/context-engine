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

  assert.equal(readText('client/public/_redirects'), '/demo/dacc /about 301\n/* /index.html 200\n');
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

test('client HTML shell description stays aligned with the README framing', () => {
  const html = readText('client/index.html');

  assert.match(html, /AI-enhanced deliberation and sensemaking in large groups/);
  assert.match(html, /cryptographic access control/);
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
