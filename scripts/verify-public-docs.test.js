'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { verifyPublicDocs } = require('./verify-public-docs');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function withFixture(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-docs-'));
  try {
    writeFile(rootDir, 'package.json', JSON.stringify({ scripts: { test: 'node --test' } }));
    writeFile(rootDir, 'client/package.json', JSON.stringify({ scripts: { dev: 'vite' } }));
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('verifyPublicDocs accepts public-safe docs, package commands, and local links', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'docs/guide.md', [
      '# Guide',
      '',
      'See [details](details.md).',
      '',
      'Run `npm run test` or `npm --prefix client run dev`.',
      '',
      '```markdown',
      '[example only](missing-example.md)',
      '```',
      '',
    ].join('\n'));
    writeFile(rootDir, 'docs/details.md', '# Details\n');
    writeFile(rootDir, 'client/src/feature.ts', 'export const feature = true;\n');
    writeFile(rootDir, 'docs/paths.md', 'Source: `client/src/feature.ts`. Generated: `client/build/`.\n');

    const result = verifyPublicDocs(rootDir);
    assert.deepEqual(result.findings, []);
    assert.equal(result.scannedFiles, 3);
  });
});

test('verifyPublicDocs rejects private markers, unavailable commands, and broken local links', () => {
  withFixture((rootDir) => {
    const planningId = `${'PR'}${'D'} 123`;
    writeFile(rootDir, 'docs/guide.md', [
      `Internal ${planningId} status lives under TODO/ and artifacts/runs/.`,
      'The private branch includes contextEngine-cc. The public worker is workers/agentBridgeWorker.',
      'Run `npm run ai:private-flow`.',
      'See [missing](missing.md).',
      'Stale source path: `client/src/missingFeature.js`.',
      '',
    ].join('\n'));

    const { findings } = verifyPublicDocs(rootDir);
    const formatted = findings.map((finding) => `${finding.kind}: ${finding.detail}`).join('\n');
    assert.match(formatted, /internal planning identifier/);
    assert.match(formatted, /private planning path/);
    assert.match(formatted, /private artifact path/);
    assert.match(formatted, /private release branch/);
    assert.match(formatted, /private companion path/);
    assert.doesNotMatch(formatted, /private bridge path/);
    assert.match(formatted, /missing public npm script: ai:private-flow/);
    assert.match(formatted, /broken local Markdown link: missing\.md/);
    assert.match(formatted, /missing inline repository path: client\/src\/missingFeature\.js/);
  });
});

test('verify-public-docs CLI exits nonzero when a public doc leaks planning content', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'README.md', `${'PR'}${'D'} 456 remains in progress.\n`);
    const result = spawnSync(process.execPath, [path.join(__dirname, 'verify-public-docs.js'), rootDir], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Public documentation verification failed/);
    assert.match(result.stderr, /internal planning identifier/);
  });
});
