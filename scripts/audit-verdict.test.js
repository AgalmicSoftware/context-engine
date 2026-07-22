'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const helperPath = path.join(repoRoot, 'scripts/lib/audit-verdict.sh');

const runVerdict = (content) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-audit-verdict-'));
  try {
    const reportPath = path.join(tempDir, 'report.txt');
    fs.writeFileSync(reportPath, content);
    return spawnSync('bash', [helperPath, reportPath], { encoding: 'utf8' });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

test('terminal PASS exits zero', () => {
  const result = runVerdict('No blocking findings.\nPASS\n');

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PASS/);
});

test('terminal FAIL exits nonzero even when report production succeeded', () => {
  const result = runVerdict('One finding remains.\nFAIL\n');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /FAIL/);
});

test('missing or malformed terminal verdict fails closed', () => {
  const missing = runVerdict('Analysis completed without a terminal verdict.\n');
  const malformed = runVerdict('PASS\nAdditional trailing prose.\n');

  assert.equal(missing.status, 2);
  assert.equal(malformed.status, 2);
  assert.match(missing.stderr, /missing terminal PASS or FAIL/);
});

test('both audit entrypoints resolve the saved report verdict', () => {
  for (const relativePath of ['scripts/audit-full.sh', 'scripts/audit-diff.sh']) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    assert.match(source, /lib\/audit-verdict\.sh/);
    assert.match(source, /resolve_audit_report_verdict "\$REPORT_FILE"/);
  }
});
