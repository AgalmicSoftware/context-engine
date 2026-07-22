'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  packageScriptNames,
  scrubPublicPackageJson,
} = require('./scrub-public-package-json');

test('scrubPublicPackageJson uses source metadata to remove absent private commands', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-package-'));
  try {
    const targetPath = path.join(tempDir, 'target.json');
    const sourcePath = path.join(tempDir, 'source.json');
    fs.writeFileSync(targetPath, `${JSON.stringify({
      scripts: {
        'test:ci': 'npm run test:node && npm run test:cc',
        'test:node': 'node scripts/run-node-tests.js',
      },
    }, null, 2)}\n`);
    fs.writeFileSync(sourcePath, `${JSON.stringify({
      scripts: {
        'test:node': 'node scripts/run-node-tests.js',
        'test:cc': 'node scripts/run-contextengine-cc-tests.js',
        'test:ci': 'npm run test:node && npm run test:cc',
      },
    }, null, 2)}\n`);

    scrubPublicPackageJson(targetPath, sourcePath);

    const result = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    assert.deepEqual(Object.keys(result.scripts), ['test:node', 'test:ci']);
    assert.equal(result.scripts['test:ci'], 'npm run test:node');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scrubPublicPackageJson removes stripped npm scripts from the CI gate manifest', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-gates-'));
  try {
    const targetPath = path.join(tempDir, 'package.json');
    const sourcePath = path.join(tempDir, 'source.json');
    const manifestPath = path.join(tempDir, 'scripts', 'ci-gates.json');
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'client'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'client', 'package.json'), `${JSON.stringify({
      scripts: { 'format:check': 'prettier --check .' },
    }, null, 2)}\n`);
    assert.equal(
      packageScriptNames(
        path.relative(process.cwd(), targetPath),
        'client',
        {},
      ).has('format:check'),
      true,
    );
    fs.writeFileSync(targetPath, `${JSON.stringify({
      scripts: {
        'test:ci': 'node scripts/run-ci-gates.mjs --profile ci',
        'test:node': 'node scripts/run-node-tests.js',
        'test:cc': 'node scripts/run-contextengine-cc-tests.js',
      },
    }, null, 2)}\n`);
    fs.writeFileSync(sourcePath, fs.readFileSync(targetPath));
    fs.writeFileSync(manifestPath, `${JSON.stringify({
      schemaVersion: 1,
      profiles: {
        ci: ['cecc-and-node'],
        hosted: ['cecc-and-node'],
        release: ['release'],
      },
      gates: {
        'cecc-and-node': {
          commands: [
            { label: 'CC', command: 'npm', args: ['run', 'test:cc'] },
            { label: 'Client format', command: 'npm', args: ['--prefix', 'client', 'run', 'format:check'] },
            { label: 'Private package', command: 'npm', args: ['--prefix', 'contextEngine-cc', 'run', 'test'] },
            { label: 'Node', command: 'npm', args: ['run', 'test:node'] },
          ],
        },
        release: {
          commands: [
            { label: 'Node', command: 'npm', args: ['run', 'test:node'] },
          ],
        },
      },
    }, null, 2)}\n`);

    scrubPublicPackageJson(targetPath, sourcePath);

    const packageJson = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(packageJson.scripts['test:cc'], undefined);
    assert.deepEqual(
      manifest.gates['cecc-and-node'].commands.map((entry) => entry.args.at(-1)),
      ['format:check', 'test:node'],
    );
    assert.deepEqual(manifest.profiles.ci, ['cecc-and-node']);
    assert.deepEqual(manifest.profiles.hosted, ['cecc-and-node']);
    assert.deepEqual(manifest.profiles.release, ['release']);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
