'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const rootDir = resolve(__dirname, '..');

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(rootDir, relativePath), 'utf8'));
const readText = (relativePath) => readFileSync(resolve(rootDir, relativePath), 'utf8');

test('client dev/build scripts stay rooted at / while package homepage points to the live site', () => {
  const pkg = readJson('client/package.json');

  assert.equal(pkg?.homepage, 'https://contextengine.xyz/');
  assert.equal(pkg?.scripts?.dev, 'PUBLIC_URL=/ react-app-rewired start');
  assert.equal(pkg?.scripts?.build, 'PUBLIC_URL=/ react-app-rewired build');
});

test('client HTML shell leaves route-specific canonical metadata to runtime head sync', () => {
  const html = readText('client/public/index.html');

  assert.doesNotMatch(
    html,
    /<meta\s+property="og:url"\s+content="https:\/\/contextengine\.xyz\/"\s*\/?>/
  );
  assert.doesNotMatch(
    html,
    /<link\s+rel="canonical"\s+href="https:\/\/contextengine\.xyz\/"\s*\/?>/
  );
});
