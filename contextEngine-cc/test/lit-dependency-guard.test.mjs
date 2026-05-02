import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { DEFAULT_CHIPOTLE_ACTION_CODE } from '../lib/litChipotleActionCatalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CC_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(CC_ROOT, '..');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const walkFiles = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const path = resolve(dir, entry);
    const rel = path.slice(CC_ROOT.length + 1);
    if (
      rel === 'node_modules' ||
      rel.startsWith('node_modules/') ||
      rel === 'public/ethers.umd.min.js'
    ) {
      continue;
    }
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walkFiles(path, out);
    } else {
      out.push(path);
    }
  }
  return out;
};

test('contextEngine-cc package manifests do not declare browser Lit SDK dependencies', () => {
  const packageJson = readJson(resolve(CC_ROOT, 'package.json'));
  const packageLock = readJson(resolve(CC_ROOT, 'package-lock.json'));
  const dependencyNames = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ]);
  const lockPackageNames = Object.keys(packageLock.packages || {}).map((entry) => (
    entry.replace(/^node_modules\//, '')
  ));

  for (const name of [...dependencyNames, ...lockPackageNames]) {
    assert.equal(
      name.startsWith('@lit-protocol/'),
      false,
      `Unexpected Lit SDK package in CE-CC manifest: ${name}`,
    );
    assert.notEqual(name, 'viem', 'Unexpected viem package in CE-CC manifest');
  }
});

test('contextEngine-cc runtime source does not import from sibling client/node_modules', () => {
  const sourceFiles = [
    ...walkFiles(resolve(CC_ROOT, 'lib')),
    ...walkFiles(resolve(CC_ROOT, 'hook')),
    ...walkFiles(resolve(CC_ROOT, 'status')),
    resolve(CC_ROOT, 'server.mjs'),
    resolve(CC_ROOT, 'start.mjs'),
  ].filter((path) => ['.mjs', '.js', '.json'].includes(extname(path)));
  const offenders = [];
  for (const file of sourceFiles) {
    const text = readFileSync(file, 'utf8');
    if (
      text.includes('client/node_modules') ||
      text.includes('@lit-protocol/') ||
      text.includes('../../client/node_modules') ||
      text.includes('../client/node_modules')
    ) {
      offenders.push(file.slice(CC_ROOT.length + 1));
    }
  }

  assert.deepEqual(offenders, []);
});

test('CE-CC mirrored Chipotle action source matches the client catalog', () => {
  const clientCatalogPath = resolve(REPO_ROOT, 'client/src/utilities/crypto/litChipotleCatalog.ts');
  assert.equal(existsSync(clientCatalogPath), true, 'client Lit Chipotle catalog must exist');
  const clientSource = readFileSync(clientCatalogPath, 'utf8');
  const match = clientSource.match(/export const DEFAULT_CHIPOTLE_ACTION_CODE = `([\s\S]*?)`;/);
  assert.ok(match, 'client catalog must export DEFAULT_CHIPOTLE_ACTION_CODE');
  assert.equal(DEFAULT_CHIPOTLE_ACTION_CODE, match[1]);
});
