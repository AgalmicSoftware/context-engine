'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  verifyPublicReleaseSurface,
} = require('./verify-public-release-surface');

const TEST_TMP_ROOT = path.join(__dirname, '.tmp-verify-public-release-surface-tests');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function withPublicFixture(run) {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  const rootDir = fs.mkdtempSync(path.join(TEST_TMP_ROOT, 'surface-'));
  try {
    writeFile(rootDir, path.join('scripts', 'lib', 'public-release-strip-patterns.sh'), `#!/usr/bin/env bash
ce_public_release_strip_patterns() {
  cat <<'EOF'
contextEngine-cc
TODO
scripts/private-*.js
EOF
}
`);
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('verifyPublicReleaseSurface flags imports that resolve into stripped paths', () => {
  withPublicFixture((rootDir) => {
    const strippedImport = '../../contextEngine-cc/lib/litChipotleActionCatalog.mjs';
    writeFile(
      rootDir,
      path.join('workers', 'sessionCorsWorker', 'chipotleClient.test.mjs'),
      `import { DEFAULT_CHIPOTLE_ACTION_CODE } from '${strippedImport}';\n`,
    );

    const result = verifyPublicReleaseSurface(rootDir);

    assert.deepEqual(result.findings.map((finding) => ({
      file: finding.file,
      line: finding.line,
      specifier: finding.specifier,
      targetPath: finding.targetPath,
      pattern: finding.pattern,
    })), [{
      file: 'workers/sessionCorsWorker/chipotleClient.test.mjs',
      line: 1,
      specifier: '../../contextEngine-cc/lib/litChipotleActionCatalog.mjs',
      targetPath: 'contextEngine-cc/lib/litChipotleActionCatalog.mjs',
      pattern: 'contextEngine-cc',
    }]);
  });
});

test('verifyPublicReleaseSurface ignores files inside stripped paths', () => {
  withPublicFixture((rootDir) => {
    const strippedImport = '../../TODO/private-plan.mjs';
    writeFile(
      rootDir,
      path.join('contextEngine-cc', 'test', 'private.test.mjs'),
      `import '${strippedImport}';\n`,
    );
    writeFile(rootDir, path.join('client', 'src', 'public.js'), "import './safe.js';\n");
    writeFile(rootDir, path.join('client', 'src', 'safe.js'), 'export const ok = true;\n');

    const result = verifyPublicReleaseSurface(rootDir);

    assert.deepEqual(result.findings, []);
  });
});

test('verifyPublicReleaseSurface ignores stripped source importing stripped target', () => {
  withPublicFixture((rootDir) => {
    const strippedImport = '../../lib/e2e/wallets';
    writeFile(
      rootDir,
      path.join('scripts', 'lib', 'public-release-strip-patterns.sh'),
      `#!/usr/bin/env bash
ce_public_release_strip_patterns() {
  cat <<'EOF'
scripts/e2e
scripts/lib/e2e
EOF
}
`,
    );
    writeFile(
      rootDir,
      path.join('scripts', 'e2e', 'cloudflare', 'session-worker.js'),
      `const { DEFAULT_PASSKEY_A } = require('${strippedImport}');\n`,
    );

    const result = verifyPublicReleaseSurface(rootDir);

    assert.deepEqual(result.findings, []);
  });
});

test('verifyPublicReleaseSurface ignores a source file that vanishes after traversal', () => {
  withPublicFixture((rootDir) => {
    const transientPath = path.join(rootDir, 'scripts', '.tmp-history', 'review-snapshot.js');
    writeFile(rootDir, path.relative(rootDir, transientPath), "import '../../contextEngine-cc/private.js';\n");
    const originalReadFileSync = fs.readFileSync;
    let removedTransientFile = false;
    fs.readFileSync = function readFileSyncWithRemoval(filePath, ...args) {
      if (!removedTransientFile && path.resolve(String(filePath)) === transientPath) {
        removedTransientFile = true;
        fs.rmSync(transientPath);
      }
      return originalReadFileSync.call(this, filePath, ...args);
    };

    try {
      assert.deepEqual(verifyPublicReleaseSurface(rootDir), {
        findings: [],
        scannedFiles: 0,
      });
    } finally {
      fs.readFileSync = originalReadFileSync;
    }
    assert.equal(removedTransientFile, true);
  });
});

test('verifyPublicReleaseSurface preserves non-vanishing filesystem errors', () => {
  withPublicFixture((rootDir) => {
    const stablePath = path.join(rootDir, 'client', 'src', 'stable.js');
    writeFile(rootDir, path.relative(rootDir, stablePath), 'export const stable = true;\n');
    const originalReadFileSync = fs.readFileSync;
    fs.readFileSync = function readFileSyncWithError(filePath, ...args) {
      if (path.resolve(String(filePath)) === stablePath) {
        const error = new Error('stable file cannot be read');
        error.code = 'EACCES';
        throw error;
      }
      return originalReadFileSync.call(this, filePath, ...args);
    };

    try {
      assert.throws(
        () => verifyPublicReleaseSurface(rootDir),
        (error) => error?.code === 'EACCES' && /stable file cannot be read/.test(error.message),
      );
    } finally {
      fs.readFileSync = originalReadFileSync;
    }
  });
});

test('verify-public-release-surface CLI exits nonzero for stripped imports', () => {
  withPublicFixture((rootDir) => {
    const strippedImport = '../../contextEngine-cc/lib/litChipotleActionCatalog.mjs';
    writeFile(
      rootDir,
      path.join('workers', 'sessionCorsWorker', 'broken.cjs'),
      `const action = require('${strippedImport}');\n`,
    );

    const result = spawnSync(process.execPath, [path.join(__dirname, 'verify-public-release-surface.js'), rootDir], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
    });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Public release surface verification failed/);
    assert.match(result.stderr, /contextEngine-cc\/lib\/litChipotleActionCatalog\.mjs/);
  });
});
