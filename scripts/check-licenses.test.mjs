import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkLicenses, isAllowedLicense } from './check-licenses.mjs';

test('license expressions require all AND terms and accept an allowed OR alternative', () => {
  for (const expression of ['MIT', '(CC-BY-4.0 AND MIT)', '(MPL-2.0 OR Apache-2.0)', 'MIT OR SEE LICENSE IN FEEL-FREE.md', '(GPL-3.0 OR MIT) AND ISC']) {
    assert.equal(isAllowedLicense(expression), true, expression);
  }
  for (const expression of ['', null, 'GPL-3.0', 'LGPL-2.1', 'AGPL-3.0', 'SSPL-1.0', 'BUSL-1.1', 'CPAL-1.0', 'CC-BY-SA-4.0', 'WAGMIT', 'MIT AND unknown', 'MIT OR', '(MIT', 'MIT)']) {
    assert.equal(isAllowedLicense(expression), false, String(expression));
  }
});

test('installed package metadata controls the gate; missing and version-mismatched overrides fail', async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'ce-license-fixture-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const packageDir = path.join(rootDir, 'node_modules/synthetic-dependency');
  await mkdir(packageDir, { recursive: true });
  await writeFile(path.join(rootDir, 'package.json'), JSON.stringify({ name: 'synthetic-project', version: '1.0.0', dependencies: { 'synthetic-dependency': '1.0.0' } }));
  const installed = async (license) => writeFile(path.join(packageDir, 'package.json'), JSON.stringify({ name: 'synthetic-dependency', version: '1.0.0', ...(license ? { license } : {}) }));
  const check = (overrides = {}) => checkLicenses({ rootDir, trees: ['.'], overrides, bundles: [] });
  await installed('GPL-3.0');
  await writeFile(path.join(rootDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/synthetic-dependency': { version: '1.0.0', license: 'MIT' } } }));
  assert.match(check().failures[0], /GPL-3.0/);
  await installed(null);
  assert.match(check().failures[0], /no license metadata/);
  const override = { declaredLicense: null, license: 'MIT', evidence: { source: 'synthetic LICENSE', reviewed: '2026-10-26', note: 'Synthetic permissive fixture.' } };
  assert.equal(check({ 'synthetic-dependency@2.0.0': override }).failures.length, 2);
  assert.deepEqual(check({ 'synthetic-dependency@1.0.0': override }), { counts: [{ tree: '.', packages: 1 }], checked: 1, failures: [] });
  await installed('MIT');
  assert.equal(check().failures.length, 0);
  assert.match(check({ 'synthetic-dependency@1.0.0': override }).failures[0], /stale or incomplete/);
});

test('bundled development packages are checked from esbuild and Vite inputs', async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'ce-shipped-license-fixture-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  await mkdir(path.join(rootDir, 'dist'), { recursive: true });
  const names = ['synthetic-worker-dev', 'synthetic-mcp-dev', 'synthetic-client-dev', 'synthetic-unused-dev'];
  await writeFile(path.join(rootDir, 'package.json'), JSON.stringify({ name: 'synthetic-project', version: '1.0.0', devDependencies: Object.fromEntries(names.map((name) => [name, '1.0.0'])) }));
  for (const name of names) {
    await mkdir(path.join(rootDir, 'node_modules', name), { recursive: true });
    await writeFile(path.join(rootDir, 'node_modules', name, 'package.json'), JSON.stringify({ name, version: '1.0.0', license: 'GPL-3.0' }));
  }
  const bundles = [
    { tree: '.', path: 'dist/worker.json', format: 'esbuild' },
    { tree: '.', path: 'dist/mcp.json', format: 'esbuild' },
    { tree: '.', path: 'dist/client.json', format: 'vite' },
  ];
  await writeFile(path.join(rootDir, bundles[0].path), JSON.stringify({ inputs: { 'node_modules/synthetic-worker-dev/index.js': {} } }));
  await writeFile(path.join(rootDir, bundles[1].path), JSON.stringify({ inputs: { 'node_modules/synthetic-mcp-dev/index.js': {} } }));
  await writeFile(path.join(rootDir, bundles[2].path), JSON.stringify({ moduleIds: ['node_modules/synthetic-client-dev/index.js'] }));
  const result = checkLicenses({ rootDir, trees: ['.'], overrides: {}, bundles });
  assert.equal(result.checked, 3);
  for (const name of names.slice(0, 3)) assert.ok(result.failures.some((failure) => failure.includes(`${name}@1.0.0`)), name);
  assert.equal(result.failures.some((failure) => failure.includes('synthetic-unused-dev')), false);
  await rm(path.join(rootDir, bundles[0].path));
  assert.throws(() => checkLicenses({ rootDir, trees: ['.'], overrides: {}, bundles }), /Missing bundle inputs/);
});

test('an override for an absent installed version fails even when all shipped licenses are allowed', async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'ce-stale-license-fixture-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  await writeFile(path.join(rootDir, 'package.json'), JSON.stringify({ name: 'synthetic-project', version: '1.0.0' }));
  const result = checkLicenses({ rootDir, trees: ['.'], bundles: [], overrides: {
    'synthetic-removed@1.0.0': { declaredLicense: null, license: 'MIT', evidence: { source: 'LICENSE', reviewed: '2026-10-26', note: 'Synthetic removed version.' } },
  } });
  assert.match(result.failures[0], /synthetic-removed@1.0.0.*no longer installed/);
});
