import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  ALLOW_MARKER,
  collectBaselineMonotonicityFindings,
} from './check-baseline-monotonicity.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.join(__dirname, 'check-baseline-monotonicity.mjs');

function git(repoDir, args) {
  return execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writeJson(repoDir, relativePath, value) {
  const absolutePath = path.join(repoDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeBaselines(
  repoDir,
  { violations, counts, deadExports = { candidateDeadFiles: 4, candidateUnusedExports: 2 } },
) {
  writeJson(repoDir, 'scripts/client-boundaries-baseline.json', {
    version: 1,
    mode: 'fail-on-new-violation',
    violations,
  });
  writeJson(repoDir, 'scripts/type-debt-baseline.json', {
    counts,
  });
  writeJson(repoDir, 'scripts/dead-exports-baseline.json', {
    version: 1,
    ...deadExports,
  });
}

function commitAll(repoDir, message) {
  git(repoDir, ['add', '-A']);
  git(repoDir, ['commit', '--quiet', '-m', message]);
}

function withTempRepo(run) {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-baseline-monotonicity-'));
  try {
    git(repoDir, ['init', '--initial-branch=main']);
    git(repoDir, ['config', 'user.name', 'Baseline Tester']);
    git(repoDir, ['config', 'user.email', '[redacted-email]']);
    return run(repoDir);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
}

const BASE_VIOLATION = {
  rule: 'route-page-no-low-level',
  source: 'client/src/components/Page.tsx',
  import: '../../utilities/web3/chainGateway.js',
  resolved: 'client/src/utilities/web3/contractScripts',
};

const NEW_VIOLATION = {
  rule: 'route-page-no-low-level',
  source: 'client/src/components/NewPage.tsx',
  import: '../../utilities/worker/workerAuth.js',
  resolved: 'client/src/utilities/worker/workerAuth',
};

test('passes when baselines stay flat or shrink', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [BASE_VIOLATION],
      counts: { colonAny: 4, asAny: 2 },
    });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 3, asAny: 2 },
      deadExports: { candidateDeadFiles: 3, candidateUnusedExports: 2 },
    });

    const result = collectBaselineMonotonicityFindings({ repoDir, baseRef: base });
    assert.equal(result.skipped, false);
    assert.deepEqual(result.boundaryGains, []);
    assert.deepEqual(result.typeDebtIncreases, []);
    assert.deepEqual(result.deadExportIncreases, []);
  });
});

test('reports boundary gains and type-debt increases', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [BASE_VIOLATION],
      counts: { colonAny: 4, asAny: 2 },
    });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [BASE_VIOLATION, NEW_VIOLATION],
      counts: { colonAny: 5, asAny: 2 },
      deadExports: { candidateDeadFiles: 5, candidateUnusedExports: 2 },
    });

    const result = collectBaselineMonotonicityFindings({ repoDir, baseRef: base });
    assert.equal(result.skipped, false);
    assert.deepEqual(result.boundaryGains.map((violation) => violation.source), [
      NEW_VIOLATION.source,
    ]);
    assert.deepEqual(result.typeDebtIncreases, [
      { pattern: 'colonAny', base: 4, current: 5 },
    ]);
    assert.deepEqual(result.deadExportIncreases, [
      { field: 'candidateDeadFiles', base: 4, current: 5 },
    ]);
  });
});

test('allow marker lets intentional baseline growth pass', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
    });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [NEW_VIOLATION],
      counts: { colonAny: 1 },
    });

    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--repo',
      repoDir,
      '--base',
      base,
      '--allow-text',
      `Intentional checker rollout ${ALLOW_MARKER}`,
    ], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Baseline growth allowed/);
  });
});

test('allow marker cannot permit dead-export baseline growth', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
      deadExports: { candidateDeadFiles: 4, candidateUnusedExports: 2 },
    });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
      deadExports: { candidateDeadFiles: 5, candidateUnusedExports: 2 },
    });

    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--repo',
      repoDir,
      '--base',
      base,
      '--allow-text',
      `Attempted bypass ${ALLOW_MARKER}`,
    ], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /dead-exports-baseline\.json growth cannot be allowed/);
  });
});

test('cli fails without allow marker when baselines grow', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
    });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [NEW_VIOLATION],
      counts: { colonAny: 1 },
      deadExports: { candidateDeadFiles: 5, candidateUnusedExports: 2 },
    });

    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--repo',
      repoDir,
      '--base',
      base,
    ], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Baseline monotonicity check failed/);
    assert.match(result.stderr, /client-boundaries-baseline\.json gained 1 violation/);
    assert.match(result.stderr, /type-debt-baseline\.json increased 1 count/);
    assert.match(result.stderr, /dead-exports-baseline\.json increased 1 count/);
  });
});

test('bootstraps the dead-export baseline when the base ref predates it', () => {
  withTempRepo((repoDir) => {
    writeJson(repoDir, 'scripts/client-boundaries-baseline.json', {
      version: 1,
      mode: 'fail-on-new-violation',
      violations: [],
    });
    writeJson(repoDir, 'scripts/type-debt-baseline.json', {
      counts: { colonAny: 0 },
    });
    commitAll(repoDir, 'base baselines without dead exports');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeJson(repoDir, 'scripts/dead-exports-baseline.json', {
      version: 1,
      candidateDeadFiles: 17,
      candidateUnusedExports: 219,
    });

    const result = collectBaselineMonotonicityFindings({ repoDir, baseRef: base });
    assert.deepEqual(result.deadExportIncreases, []);
    assert.match(result.notices.join('\n'), /dead-exports-baseline\.json was not present/);
  });
});

test('missing base ref skips with a notice', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
    });
    commitAll(repoDir, 'base baselines');

    const result = collectBaselineMonotonicityFindings({
      repoDir,
      baseRef: 'missing-base-ref',
    });

    assert.equal(result.skipped, true);
    assert.match(result.notices.join('\n'), /missing-base-ref/);
  });
});

test('help documents the baseline-growth escape hatch', () => {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, '--help'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(ALLOW_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
