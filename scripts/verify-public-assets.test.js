'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { verifyPublicAssets } = require('./verify-public-assets');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function withFixture(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-assets-'));
  try {
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('verifyPublicAssets accepts imported and manifest-owned images', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'client/src/assets/logo.png', Buffer.from([0, 1, 2]));
    writeFile(rootDir, 'client/public/avatars/person.jpg', Buffer.from([3, 4, 5]));
    writeFile(rootDir, 'client/src/App.tsx', "import logo from './assets/logo.png';\n");
    writeFile(rootDir, 'client/src/avatarManifest.json', '{"src":"/avatars/person.jpg"}\n');

    const result = verifyPublicAssets(rootDir);
    assert.deepEqual(result.findings, []);
    assert.equal(result.scannedFiles, 2);
  });
});

test('verifyPublicAssets rejects an image with no source, doc, or manifest owner', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'docs/assets/orphan.png', Buffer.from([0, 1, 2]));
    writeFile(rootDir, 'README.md', '# Public project\n');

    const result = verifyPublicAssets(rootDir);
    assert.deepEqual(result.findings, [{
      file: 'docs/assets/orphan.png',
      kind: 'unreferenced public asset',
    }]);

    const cli = spawnSync(process.execPath, [path.join(__dirname, 'verify-public-assets.js'), rootDir], {
      encoding: 'utf8',
    });
    assert.equal(cli.status, 2);
    assert.match(cli.stderr, /docs\/assets\/orphan\.png/);
  });
});
