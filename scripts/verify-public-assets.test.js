'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { verifyPublicAssets } = require('./verify-public-assets');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function initGit(rootDir) {
  execFileSync('git', ['init', '--quiet'], { cwd: rootDir });
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

test('verifyPublicAssets does not let one relative reference mask an orphan with the same basename', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'client/src/used/logo.png', Buffer.from([0, 1, 2]));
    writeFile(rootDir, 'client/src/unused/logo.png', Buffer.from([3, 4, 5]));
    writeFile(rootDir, 'client/src/App.tsx', "import logo from './used/logo.png';\nvoid logo;\n");

    const result = verifyPublicAssets(rootDir);
    assert.deepEqual(result.findings, [{
      file: 'client/src/unused/logo.png',
      kind: 'unreferenced public asset',
    }]);
  });
});

test('verifyPublicAssets ignores local build-audit output excluded from the client tree', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'client/.tmp-build-audit/orphan.png', Buffer.from([0, 1, 2]));
    writeFile(rootDir, 'client/.tmp-build-audit/index.html', '<img src="orphan.png">\n');
    writeFile(rootDir, 'README.md', '# Public project\n');

    const result = verifyPublicAssets(rootDir);
    assert.deepEqual(result.findings, []);
    assert.equal(result.scannedFiles, 0);
  });
});

test('verifyPublicAssets ignores assets hidden by gitignore in a git checkout', () => {
  withFixture((rootDir) => {
    initGit(rootDir);
    writeFile(rootDir, '.gitignore', 'ignored-local/\n');
    writeFile(rootDir, 'README.md', '# Public project\n');
    writeFile(rootDir, 'ignored-local/orphan.png', Buffer.from([0, 1, 2]));

    const result = verifyPublicAssets(rootDir);

    assert.deepEqual(result.findings, []);
    assert.equal(result.scannedFiles, 0);
  });
});

test('verifyPublicAssets does not let an ignored owner hide a visible orphan asset', () => {
  withFixture((rootDir) => {
    initGit(rootDir);
    writeFile(rootDir, '.gitignore', 'ignored-local/\n');
    writeFile(rootDir, 'docs/assets/orphan.png', Buffer.from([0, 1, 2]));
    writeFile(rootDir, 'ignored-local/owner.md', 'docs/assets/orphan.png\n');

    const result = verifyPublicAssets(rootDir);

    assert.deepEqual(result.findings, [{
      file: 'docs/assets/orphan.png',
      kind: 'unreferenced public asset',
    }]);
    assert.equal(result.scannedFiles, 1);
  });
});

test('verifyPublicAssets does not follow a visible symlink to an ignored owner', () => {
  withFixture((rootDir) => {
    initGit(rootDir);
    writeFile(rootDir, '.gitignore', 'ignored-local/\n');
    writeFile(rootDir, 'docs/assets/orphan.png', Buffer.from([0, 1, 2]));
    writeFile(rootDir, 'ignored-local/owner.md', 'docs/assets/orphan.png\n');
    fs.symlinkSync(path.join(rootDir, 'ignored-local', 'owner.md'), path.join(rootDir, 'visible-owner.md'));

    const result = verifyPublicAssets(rootDir);

    assert.deepEqual(result.findings, [{
      file: 'docs/assets/orphan.png',
      kind: 'unreferenced public asset',
    }]);
    assert.equal(result.scannedFiles, 1);
  });
});

test('verifyPublicAssets rejects tracked and new nonignored orphan assets in a git checkout', () => {
  withFixture((rootDir) => {
    initGit(rootDir);
    writeFile(rootDir, 'README.md', '# Public project\n');
    writeFile(rootDir, 'client/src/assets/tracked.png', Buffer.from([0, 1, 2]));
    writeFile(rootDir, 'client/src/assets/new.png', Buffer.from([3, 4, 5]));
    execFileSync('git', ['add', 'README.md', 'client/src/assets/tracked.png'], { cwd: rootDir });

    const result = verifyPublicAssets(rootDir);

    assert.deepEqual(result.findings.map((finding) => finding.file), [
      'client/src/assets/new.png',
      'client/src/assets/tracked.png',
    ]);
    assert.equal(result.scannedFiles, 2);
  });
});

test('verifyPublicAssets keeps tmp-build-audit excluded in a git checkout', () => {
  withFixture((rootDir) => {
    initGit(rootDir);
    writeFile(rootDir, 'client/.tmp-build-audit/orphan.png', Buffer.from([0, 1, 2]));
    writeFile(rootDir, 'client/.tmp-build-audit/index.html', '<img src="orphan.png">\n');
    writeFile(rootDir, 'README.md', '# Public project\n');

    const result = verifyPublicAssets(rootDir);

    assert.deepEqual(result.findings, []);
    assert.equal(result.scannedFiles, 0);
  });
});

test('verifyPublicAssets scans large text corpora without aggregating them into one string', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'client/src/assets/owned.png', Buffer.from([0, 1, 2]));
    const chunk = 'x'.repeat(3 * 1024 * 1024);
    for (let index = 0; index < 20; index += 1) {
      writeFile(rootDir, `corpus/chunk-${index}.txt`, chunk);
    }
    writeFile(rootDir, 'client/src/assetManifest.json', '{"src":"/assets/owned.png"}\n');

    const cli = spawnSync(
      process.execPath,
      ['--max-old-space-size=32', path.join(__dirname, 'verify-public-assets.js'), rootDir],
      { encoding: 'utf8' },
    );
    assert.equal(cli.status, 0, cli.stderr || cli.stdout);
    assert.match(cli.stdout, /public asset verification passed/);
  });
});
