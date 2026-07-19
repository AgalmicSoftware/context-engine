'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const rootDir = resolve(__dirname, '..', '..');

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(rootDir, relativePath), 'utf8'));
const readText = (relativePath) => readFileSync(resolve(rootDir, relativePath), 'utf8');

test('root and client packages require the same supported Node and npm versions', () => {
  const rootPackage = readJson('package.json');
  const rootLock = readJson('package-lock.json');
  const clientPackage = readJson('client/package.json');

  assert.deepEqual(rootPackage.engines, clientPackage.engines);
  assert.deepEqual(rootLock?.packages?.['']?.engines, clientPackage.engines);
});

test('client dev/build scripts stay rooted at / while package homepage points to the live site', () => {
  const pkg = readJson('client/package.json');

  assert.equal(pkg?.homepage, 'https://contextengine.xyz/');
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
