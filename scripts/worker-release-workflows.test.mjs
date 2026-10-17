import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const releaseRef = (name, sha) => ({ ref: `refs/tags/worker-bundles-${name}`, object: { sha } });

function runPromotionPlan({ refs = [], failure = '' } = {}) {
  const source = fs.readFileSync(new URL('../.github/workflows/promote-worker-bundles.yml', import.meta.url), 'utf8');
  const step = source.split('      - name: Plan stable and previous rollback refs\n')[1]?.split('\n      - name: ')[0];
  assert.ok(step, 'the workflow must expose its promotion planning step');
  const script = step.split('        run: |\n')[1].replace(/^ {10}/gm, '');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-promotion-plan-'));
  const output = path.join(temp, 'output');
  const calls = path.join(temp, 'calls');
  try {
    // Model gh's missing-ref JSON/exit status, with no real GitHub access.
    fs.writeFileSync(path.join(temp, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.MOCK_GH_CALLS, JSON.stringify(args) + '\\n');
if (process.env.MOCK_GH_FAILURE) {
  console.error(process.env.MOCK_GH_FAILURE);
  process.exit(1);
}
const refs = JSON.parse(process.env.MOCK_GH_REFS);
const endpoint = args[1];
const name = endpoint.split('/').at(-1);
const exactRef = 'refs/tags/' + name;
if (endpoint.includes('/git/matching-refs/tags/')) {
  const expectedQuery = '.[] | select(.ref == "' + exactRef + '") | .object.sha';
  if (args[0] !== 'api' || args[2] !== '--jq' || args[3] !== expectedQuery) {
    console.error('matching refs must select the exact channel ref');
    process.exit(2);
  }
  for (const ref of refs.filter(ref => ref.ref === exactRef)) console.log(ref.object.sha);
} else if (endpoint.includes('/git/ref/tags/')) {
  const ref = refs.find(ref => ref.ref === exactRef);
  if (!ref) {
    console.log(JSON.stringify({ message: 'Not Found', status: '404' }));
    process.exit(1);
  }
  console.log(ref.object.sha);
} else {
  console.error('unexpected GitHub request');
  process.exit(2);
}
`, { mode: 0o755 });
    const result = spawnSync('bash', ['-c', script], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${temp}${path.delimiter}${process.env.PATH}`,
        SOURCE_COMMIT: SHA_B,
        GITHUB_REPOSITORY: 'example/fixture',
        GITHUB_OUTPUT: output,
        MOCK_GH_CALLS: calls,
        MOCK_GH_REFS: JSON.stringify(refs),
        MOCK_GH_FAILURE: failure,
      },
    });
    return {
      ...result,
      output: fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '',
      calls: fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse) : [],
    };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test('first stable promotion initializes stable and rollback refs when both are absent', () => {
  const result = runPromotionPlan();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.output, /promotionChanged=true/);
  assert.ok(result.output.includes(`stableCommit=${SHA_B}\n`));
  assert.ok(result.output.includes(`previousCommit=${SHA_B}\n`));
});

test('stable promotion retains the existing stable commit as rollback', () => {
  const result = runPromotionPlan({ refs: [releaseRef('stable', SHA_A), releaseRef('previous', SHA_C)] });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.output.includes(`stableCommit=${SHA_B}\n`));
  assert.ok(result.output.includes(`previousCommit=${SHA_A}\n`));
});

test('promotion ignores refs that only share a channel name prefix', () => {
  const result = runPromotionPlan({ refs: [releaseRef('stable-backup', SHA_A), releaseRef('previous-backup', SHA_C)] });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.output.includes(`previousCommit=${SHA_B}\n`));
});

test('promotion stops on GitHub API failures without treating the channel as absent', () => {
  const result = runPromotionPlan({ failure: 'GitHub API authentication failed' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GitHub API authentication failed/);
  assert.equal(result.output, '');
  assert.equal(result.calls.length, 1);
});

test('automatic Latest runs after publication and excludes historical manual republishes', () => {
  const source = fs.readFileSync(new URL('../.github/workflows/publish-worker-bundles.yml', import.meta.url), 'utf8');
  const publish = source.indexOf('- name: Publish or verify immutable release');
  const automatic = source.indexOf('- name: Advance Latest after automatic publication');
  assert.ok(automatic > publish);
  const step = source.slice(automatic);
  assert.match(step, /if: github\.event_name == 'workflow_run'/);
  assert.match(step, /--mode automatic/);
  assert.match(step, /SOURCE_COMMIT: \$\{\{ steps\.run\.outputs\.sourceCommit \}\}/);
  assert.match(step, /SOURCE_REF: \$\{\{ steps\.run\.outputs\.sourceRef \}\}/);
  assert.doesNotMatch(source.slice(publish, automatic), /gh release edit/);
  assert.match(source.slice(publish, automatic), /--latest=false/);
});

test('automatic and manual Latest changes share serialization without moving automatic stable refs', () => {
  const publish = fs.readFileSync(new URL('../.github/workflows/publish-worker-bundles.yml', import.meta.url), 'utf8');
  const promote = fs.readFileSync(new URL('../.github/workflows/promote-worker-bundles.yml', import.meta.url), 'utf8');
  for (const source of [publish, promote]) {
    assert.match(source, /group: worker-bundle-stable-promotion\s+cancel-in-progress: false/);
    assert.match(source, /permissions:\s+actions: read\s+contents: read/);
  }
  assert.doesNotMatch(publish, /upsert_ref/);
  assert.match(promote, /environment: worker-release-promotion/);
  const mutation = promote.slice(promote.indexOf('- name: Move protected stable channel and retain previous'));
  assert.ok(mutation.indexOf('--mode record-manual') < mutation.indexOf('upsert_ref worker-bundles-previous'));
  assert.ok(mutation.indexOf('--mode manual') > mutation.indexOf('upsert_ref worker-bundles-stable'));
});

test('Latest policy comes from the trusted checkout even for a historical manual rollback', () => {
  for (const workflow of ['publish-worker-bundles.yml', 'promote-worker-bundles.yml']) {
    const source = fs.readFileSync(new URL(`../.github/workflows/${workflow}`, import.meta.url), 'utf8');
    const preserve = source.indexOf('cp scripts/worker-latest-channel.mjs');
    const historicalCheckout = source.indexOf('- name: Checkout exact successful CI source');
    assert.ok(preserve > 0 && preserve < historicalCheckout);
    assert.match(source, /node "\$\{RUNNER_TEMP\}\/worker-latest-channel\.mjs"/);
  }
});
