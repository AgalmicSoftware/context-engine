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
