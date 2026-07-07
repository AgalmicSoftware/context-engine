import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectCoverageFloorFindings } from './check-coverage-floor.mjs';

function writeJson(rootDir, relativePath, value) {
  const targetPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`);
}

function withFixture(callback) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-floor-'));
  try {
    return callback(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('coverage floor check passes at the measured floor', () => withFixture((rootDir) => {
  writeJson(rootDir, 'scripts/coverage-baseline.json', {
    global: {
      statements: 75.7,
      branches: 61,
      functions: 77,
      lines: 79.1,
    },
  });
  writeJson(rootDir, 'client/coverage/coverage-summary.json', {
    total: {
      statements: { pct: 75.7 },
      branches: { pct: 61 },
      functions: { pct: 77 },
      lines: { pct: 79.1 },
    },
  });

  assert.deepEqual(collectCoverageFloorFindings({ repoDir: rootDir }), []);
}));

test('coverage floor check reports every metric below floor', () => withFixture((rootDir) => {
  writeJson(rootDir, 'scripts/coverage-baseline.json', {
    global: {
      statements: 75.7,
      branches: 61,
      functions: 77,
      lines: 79.1,
    },
  });
  writeJson(rootDir, 'client/coverage/coverage-summary.json', {
    total: {
      statements: { pct: 75.69 },
      branches: { pct: 60.99 },
      functions: { pct: 76.99 },
      lines: { pct: 79.09 },
    },
  });

  assert.deepEqual(
    collectCoverageFloorFindings({ repoDir: rootDir }).map((finding) => finding.metric),
    ['statements', 'branches', 'functions', 'lines'],
  );
}));
