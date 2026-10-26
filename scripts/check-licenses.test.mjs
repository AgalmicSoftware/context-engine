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
  const check = (overrides = {}) => checkLicenses({ rootDir, trees: ['.'], overrides });
  await installed('GPL-3.0');
  await writeFile(path.join(rootDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/synthetic-dependency': { version: '1.0.0', license: 'MIT' } } }));
  assert.match(check().failures[0], /GPL-3.0/);
  await installed(null);
  assert.match(check().failures[0], /no license metadata/);
  const override = { declaredLicense: null, license: 'MIT', evidence: { source: 'synthetic LICENSE', reviewed: '2026-10-26', note: 'Synthetic permissive fixture.' } };
  assert.equal(check({ 'synthetic-dependency@2.0.0': override }).failures.length, 1);
  assert.deepEqual(check({ 'synthetic-dependency@1.0.0': override }), { counts: [{ tree: '.', packages: 1 }], checked: 1, failures: [] });
  await installed('MIT');
  assert.equal(check().failures.length, 0);
  assert.match(check({ 'synthetic-dependency@1.0.0': override }).failures[0], /stale or incomplete/);
});
