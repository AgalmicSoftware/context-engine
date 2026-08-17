import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  resolveBaselineMonotonicitySha,
  selectBaselineMonotonicityRef,
} from './resolve-baseline-monotonicity-base.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.join(__dirname, 'resolve-baseline-monotonicity-base.mjs');

const git = (repoDir, args) =>
  execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const withTempRepo = (run) => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-baseline-base-'));
  try {
    git(repoDir, ['init', '--initial-branch=main']);
    git(repoDir, ['config', 'user.name', 'Baseline Tester']);
    git(repoDir, ['config', 'user.email', '[redacted-email]']);
    fs.writeFileSync(path.join(repoDir, 'fixture.txt'), 'base\n');
    git(repoDir, ['add', 'fixture.txt']);
    git(repoDir, ['commit', '--quiet', '-m', 'base']);
    const baseSha = git(repoDir, ['rev-parse', 'HEAD']);
    git(repoDir, ['update-ref', 'refs/remotes/origin/main', baseSha]);
    return run({ repoDir, baseSha });
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
};

const commitFixture = (repoDir, contents, subject) => {
  fs.writeFileSync(path.join(repoDir, 'fixture.txt'), `${contents}\n`);
  git(repoDir, ['add', 'fixture.txt']);
  git(repoDir, ['commit', '--quiet', '-m', subject]);
  return git(repoDir, ['rev-parse', 'HEAD']);
};

test('fast-forward release-staging pushes compare against their previous tip', () => {
  withTempRepo(({ repoDir }) => {
    const previousStagingSha = commitFixture(repoDir, 'staging', 'staging');
    commitFixture(repoDir, 'candidate', 'candidate');

    const resolved = resolveBaselineMonotonicitySha({
      repoDir,
      eventName: 'push',
      refName: 'release-staging',
      pushBeforeSha: previousStagingSha,
    });

    assert.equal(resolved, previousStagingSha);
  });
});

test('staging pushes use newer public main when the previous tip is already behind it', () => {
  withTempRepo(({ repoDir }) => {
    const previousStagingSha = commitFixture(repoDir, 'staging', 'staging');
    const currentMainSha = commitFixture(repoDir, 'main', 'current main');
    git(repoDir, ['update-ref', 'refs/remotes/origin/main', currentMainSha]);
    commitFixture(repoDir, 'candidate', 'candidate');

    const resolved = resolveBaselineMonotonicitySha({
      repoDir,
      eventName: 'push',
      refName: 'release-staging',
      pushBeforeSha: previousStagingSha,
    });

    assert.equal(resolved, currentMainSha);
  });
});

test('rewritten release-staging pushes compare against public main', () => {
  withTempRepo(({ repoDir, baseSha }) => {
    git(repoDir, ['switch', '--quiet', '-c', 'previous-staging']);
    const previousStagingSha = commitFixture(repoDir, 'previous', 'previous staging');
    git(repoDir, ['switch', '--quiet', 'main']);
    commitFixture(repoDir, 'candidate', 'candidate');

    const resolved = resolveBaselineMonotonicitySha({
      repoDir,
      eventName: 'push',
      refName: 'release-staging',
      pushBeforeSha: previousStagingSha,
    });

    assert.equal(resolved, baseSha);
  });
});

test('release-staging pushes compare against origin/main instead of the rewritten before SHA', () => {
  withTempRepo(({ repoDir, baseSha }) => {
    const resolved = resolveBaselineMonotonicitySha({
      repoDir,
      eventName: 'push',
      refName: 'release-staging',
      pushBeforeSha: '9'.repeat(40),
    });
    assert.equal(resolved, baseSha);
  });
});

test('release-staging suffixed branches use the public main baseline', () => {
  assert.equal(
    selectBaselineMonotonicityRef({
      eventName: 'push',
      refName: 'release-staging-20260729',
      pushBeforeSha: '8'.repeat(40),
    }),
    'origin/main',
  );
});

test('pull requests and ordinary pushes retain their exact event SHAs', () => {
  const pullRequestBaseSha = 'a'.repeat(40);
  const pushBeforeSha = 'b'.repeat(40);
  assert.equal(
    selectBaselineMonotonicityRef({
      eventName: 'pull_request',
      refName: 'feature',
      pullRequestBaseSha,
      pushBeforeSha,
    }),
    pullRequestBaseSha,
  );
  assert.equal(
    selectBaselineMonotonicityRef({
      eventName: 'push',
      refName: 'main',
      pushBeforeSha,
    }),
    pushBeforeSha,
  );
});

test('ordinary pushes still fail closed when the event base is unavailable', () => {
  withTempRepo(({ repoDir }) => {
    assert.throws(
      () =>
        resolveBaselineMonotonicitySha({
          repoDir,
          eventName: 'push',
          refName: 'main',
          pushBeforeSha: 'c'.repeat(40),
        }),
      /was not available/,
    );
  });
});

test('cli writes the resolved full SHA to GITHUB_OUTPUT', () => {
  withTempRepo(({ repoDir, baseSha }) => {
    const githubOutput = path.join(repoDir, 'github-output.txt');
    const result = spawnSync(
      process.execPath,
      [SCRIPT_PATH, '--repo', repoDir, '--github-output', githubOutput],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          BASELINE_EVENT_NAME: 'push',
          BASELINE_REF_NAME: 'release-staging',
          BASELINE_PUSH_BEFORE_SHA: 'd'.repeat(40),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(githubOutput, 'utf8'), `base_sha=${baseSha}\n`);
    assert.equal(result.stdout.trim(), baseSha);
  });
});
