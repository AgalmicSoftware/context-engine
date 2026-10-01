import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('automatic bundle publication follows only main and master CI', () => {
  const source = fs.readFileSync(new URL('../.github/workflows/publish-worker-bundles.yml', import.meta.url), 'utf8');
  assert.match(source, /workflow_run:\s*\n\s+branches: \[main, master\]/);
});
test('scheduled public drift verifies assets belonging to the checked-out commit', () => {
  const source = fs.readFileSync(new URL('../.github/workflows/public-drift.yml', import.meta.url), 'utf8');
  assert.match(source, /schedule:/);
  assert.match(source, /CE_RELEASE_COMMIT="\$GITHUB_SHA" npm run -s verify:release-assets/);
});


test('a failed release check cannot skip public artifact exposure checks', () => {
  const source = fs.readFileSync(new URL('../.github/workflows/public-drift.yml', import.meta.url), 'utf8');
  const steps = source.split(/\n\s+- name: /).slice(1).map((block) => ({
    name: block.split('\n')[0].trim(),
    runsAfterFailure: /\n\s+if:\s*\$\{\{\s*(always\(\)|!cancelled\(\)|failure\(\)\s*\|\|)/.test(block),
  }));
  const releaseIndex = steps.findIndex((step) => /release assets/i.test(step.name));
  assert.ok(releaseIndex >= 0);
  assert.deepEqual(steps.slice(releaseIndex + 1).filter((step) => !step.runsAfterFailure).map((step) => step.name), []);
});
