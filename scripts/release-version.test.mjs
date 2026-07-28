import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assessReleaseImpact,
  compareVersions,
  incrementPatch,
  planReleaseVersion,
  readVersionSurfaces,
  writeVersionSurfaces,
} from './release-version.mjs';

const packageJson = (name, version) => `${JSON.stringify({ name, version, private: true }, null, 2)}\n`;
const packageLock = (name, version) => `${JSON.stringify({
  name,
  version,
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': { name, version },
  },
}, null, 2)}\n`;

test('stable SemVer comparison and patch increments are deterministic', () => {
  assert.equal(compareVersions('0.1.9', '0.1.10'), -1);
  assert.equal(compareVersions('1.0.0', '0.99.99'), 1);
  assert.equal(incrementPatch('0.1.9'), '0.1.10');
  assert.throws(() => incrementPatch('0.1.0-beta.1'), /stable MAJOR\.MINOR\.PATCH/);
});

test('release planning uses the greatest public baseline and keeps major/minor operator-owned', () => {
  assert.deepEqual(
    planReleaseVersion({ mainVersion: '0.1.0', stagingVersion: null }),
    { baselineVersion: '0.1.0', nextVersion: '0.1.1', releaseLevel: 'patch' },
  );
  assert.deepEqual(
    planReleaseVersion({ mainVersion: '0.1.0', stagingVersion: '0.1.2' }),
    { baselineVersion: '0.1.2', nextVersion: '0.1.3', releaseLevel: 'patch' },
  );
  assert.deepEqual(
    planReleaseVersion({
      mainVersion: '0.1.4',
      stagingVersion: null,
      explicitVersion: '0.2.0',
    }),
    { baselineVersion: '0.1.4', nextVersion: '0.2.0', releaseLevel: 'minor' },
  );
  assert.throws(
    () => planReleaseVersion({
      mainVersion: '0.1.4',
      stagingVersion: null,
      explicitVersion: '0.2.1',
    }),
    /minor releases must increment minor once and reset patch to zero/,
  );
  assert.throws(
    () => planReleaseVersion({
      mainVersion: '1.2.3',
      stagingVersion: null,
      explicitVersion: '2.1.0',
    }),
    /major releases must increment major once and reset minor and patch to zero/,
  );
});

test('release impact reports breaking surfaces, explicit features, and patch-only changes', () => {
  assert.equal(
    assessReleaseImpact({
      paths: ['client/src/utilities/shared/encryption/envelopeV1Core.mjs'],
      subjects: ['fix: clarify envelope failure'],
    }).level,
    'major',
  );
  assert.equal(
    assessReleaseImpact({
      paths: ['client/src/components/About/AboutPage.tsx'],
      subjects: ['feat: add contributor panel'],
    }).level,
    'minor',
  );
  assert.equal(
    assessReleaseImpact({
      paths: ['docs/release-runbook.md'],
      subjects: ['docs: clarify release command'],
    }).level,
    'patch',
  );
});

test('version surfaces are synchronized without changing unrelated metadata', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-release-version-'));
  try {
    fs.mkdirSync(path.join(rootDir, 'client'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'package.json'), packageJson('contextEngine', '0.1.0'));
    fs.writeFileSync(path.join(rootDir, 'package-lock.json'), packageLock('contextEngine', '0.1.0'));
    fs.writeFileSync(path.join(rootDir, 'client', 'package.json'), packageJson('client', '0.1.0'));
    fs.writeFileSync(path.join(rootDir, 'client', 'package-lock.json'), packageLock('client', '0.1.0'));

    writeVersionSurfaces(rootDir, '0.1.1');

    assert.deepEqual(readVersionSurfaces(rootDir), {
      version: '0.1.1',
      surfaces: {
        'package.json': '0.1.1',
        'package-lock.json': '0.1.1',
        'client/package.json': '0.1.1',
        'client/package-lock.json': '0.1.1',
      },
    });
    assert.equal(JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).private, true);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
