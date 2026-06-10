'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
const readText = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const fileExists = (relativePath) => fs.existsSync(path.join(ROOT, relativePath));

const getLockPackage = (lock, packagePath) => lock.packages?.[packagePath] || null;

const assertLockPackageVersion = (lock, packagePath, expectedVersion) => {
  const entry = getLockPackage(lock, packagePath);

  assert.ok(entry, `expected ${packagePath} in package-lock.json`);
  assert.equal(entry.version, expectedVersion, `${packagePath} should resolve ${expectedVersion}`);
};

test('client production ws hotspot stays fixed through the viem dependency path', () => {
  const pkg = readJson('client/package.json');
  const lock = readJson('client/package-lock.json');
  const viemLock = getLockPackage(lock, 'node_modules/viem');

  assert.equal(pkg.dependencies.viem, '2.50.3');
  assert.equal(pkg.overrides?.viem, undefined, 'client should not use an invalid nested viem override');
  assert.ok(viemLock, 'expected viem in client package-lock.json');
  assert.equal(viemLock.version, '2.50.3');
  assert.equal(viemLock.dependencies?.ws, '8.20.1');
  assertLockPackageVersion(lock, 'node_modules/ws', '8.20.1');
});

test('sessionCorsWorker keeps narrow production audit overrides wired in lockfiles', () => {
  const pkg = readJson('workers/sessionCorsWorker/package.json');
  const lock = readJson('workers/sessionCorsWorker/package-lock.json');

  assert.deepEqual(pkg.overrides?.['asn1.js'], { 'bn.js': '4.12.3' });
  assert.deepEqual(pkg.overrides?.ethers, { ws: '8.20.1' });
  assert.equal(pkg.dependencies.ethers, '6.15.0');
  assertLockPackageVersion(lock, 'node_modules/bn.js', '4.12.3');
  assertLockPackageVersion(lock, 'node_modules/ethers/node_modules/ws', '8.20.1');
});

test('accepted ethers v5 audit residuals are documented and bounded', () => {
  const rootPkg = readJson('package.json');
  const clientPkg = readJson('client/package.json');
  const ceccPkg = fileExists('contextEngine-cc/package.json')
    ? readJson('contextEngine-cc/package.json')
    : null;
  const doc = readText('docs/dependency-audit-hotspots.md');

  assert.equal(rootPkg.devDependencies.ethers, '5.7.2');
  assert.equal(clientPkg.dependencies.ethers, '5.7.2');
  if (ceccPkg) {
    assert.equal(ceccPkg.dependencies.ethers, '5.7.2');
  }
  assert.match(doc, /GHSA-848j-6mx2-7j84/);
  assert.match(doc, /client/);
  assert.match(doc, /contextEngine-cc/);
  assert.match(doc, /ethers v6-compatible wallet migration/);
});
