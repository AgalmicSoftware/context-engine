import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  LOCKFILES,
  MANIFEST_FILE,
  WORKER_ARTIFACTS,
  createWorkerReleaseManifest,
  planStablePromotion,
  resolvePrivateSourceReference,
  resolveSourceProvenance,
  stageWorkerArtifacts,
  validateSuccessfulCiRun,
  verifyWorkerReleaseArtifact,
} from './worker-release-artifacts.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);

function fixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-worker-release-'));
  const distDir = path.join(rootDir, 'dist');
  const artifactDir = path.join(rootDir, 'artifact');
  fs.mkdirSync(distDir, { recursive: true });
  for (const [index, { file }] of WORKER_ARTIFACTS.entries()) {
    fs.writeFileSync(path.join(distDir, file), `bundle-${index}\n`);
  }
  for (const [index, lockfile] of LOCKFILES.entries()) {
    const target = path.join(rootDir, lockfile);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `{"lockfileVersion":${index + 1}}\n`);
  }
  stageWorkerArtifacts({ distDir, outputDir: artifactDir });
  createWorkerReleaseManifest({
    rootDir,
    artifactDir,
    sourceCommit: SHA_A,
    sourceRef: 'refs/heads/main',
    sourceTree: SHA_B,
    repository: 'AgalmicSoftware/context-engine',
    privateSourceCommit: SHA_C,
    publicReplayCommit: SHA_A,
    workflow: 'CI',
    workflowRef: 'AgalmicSoftware/context-engine/.github/workflows/ci.yml@refs/heads/main',
    runId: '123',
    runAttempt: '2',
    npmVersion: '10.9.0',
  });
  return { rootDir, distDir, artifactDir };
}

function verify(options = {}) {
  const dirs = fixture();
  return {
    ...dirs,
    manifest: verifyWorkerReleaseArtifact({
      rootDir: dirs.rootDir,
      artifactDir: dirs.artifactDir,
      expectedSourceCommit: SHA_A,
      expectedSourceRef: 'refs/heads/main',
      expectedSourceTree: SHA_B,
      expectedRepository: 'AgalmicSoftware/context-engine',
      expectedWorkflow: 'CI',
      expectedRunId: '123',
      expectedRunAttempt: '2',
      ...options,
    }),
  };
}

test('creates and verifies the exact immutable worker artifact structure', () => {
  const { manifest } = verify();
  assert.deepEqual(manifest.artifacts.map(({ kind }) => kind), WORKER_ARTIFACTS.map(({ kind }) => kind));
  assert.equal(manifest.replay.privateSourceCommit, SHA_C);
  assert.equal(manifest.recipe.dependencyLocks.length, LOCKFILES.length);
});

test('verification rejects changed bundle bytes', () => {
  const { rootDir, artifactDir } = fixture();
  fs.appendFileSync(path.join(artifactDir, WORKER_ARTIFACTS[0].file), 'tampered');
  assert.throws(
    () => verifyWorkerReleaseArtifact({
      rootDir,
      artifactDir,
      expectedSourceCommit: SHA_A,
      expectedSourceRef: 'refs/heads/main',
      expectedSourceTree: SHA_B,
      expectedRepository: 'AgalmicSoftware/context-engine',
      expectedWorkflow: 'CI',
      expectedRunId: '123',
      expectedRunAttempt: '2',
    }),
    /artifacts\[0\]\.(?:bytes|sha256) mismatch/,
  );
});

test('verification rejects source, run, and archive-structure mismatches', () => {
  assert.throws(() => verify({ expectedSourceCommit: SHA_B }), /source commit mismatch/);
  assert.throws(() => verify({ expectedRunId: '999' }), /builder run id mismatch/);
  const { rootDir, artifactDir } = fixture();
  fs.writeFileSync(path.join(artifactDir, 'unexpected.txt'), 'nope');
  assert.throws(
    () => verifyWorkerReleaseArtifact({
      rootDir,
      artifactDir,
      expectedSourceCommit: SHA_A,
      expectedSourceRef: 'refs/heads/main',
      expectedSourceTree: SHA_B,
      expectedRepository: 'AgalmicSoftware/context-engine',
      expectedWorkflow: 'CI',
      expectedRunId: '123',
      expectedRunAttempt: '2',
    }),
    /archive structure mismatch/,
  );
});

test('verification rejects dependency-lock drift', () => {
  const { rootDir, artifactDir } = fixture();
  fs.appendFileSync(path.join(rootDir, LOCKFILES[0]), 'changed');
  assert.throws(
    () => verifyWorkerReleaseArtifact({
      rootDir,
      artifactDir,
      expectedSourceCommit: SHA_A,
      expectedSourceRef: 'refs/heads/main',
      expectedSourceTree: SHA_B,
      expectedRepository: 'AgalmicSoftware/context-engine',
      expectedWorkflow: 'CI',
      expectedRunId: '123',
      expectedRunAttempt: '2',
    }),
    /dependency locks\[0\]\.(?:bytes|sha256) mismatch/,
  );
});

test('successful CI run validation fails closed on untrusted run metadata', () => {
  const valid = {
    id: 123,
    run_attempt: 2,
    name: 'CI',
    path: '.github/workflows/ci.yml',
    status: 'completed',
    conclusion: 'success',
    event: 'push',
    head_branch: 'main',
    head_sha: SHA_A,
    head_repository: { full_name: 'AgalmicSoftware/context-engine' },
  };
  assert.deepEqual(validateSuccessfulCiRun(valid, { repository: 'AgalmicSoftware/context-engine' }), {
    sourceCommit: SHA_A,
    sourceRef: 'refs/heads/main',
    runId: '123',
    runAttempt: '2',
  });
  for (const patch of [
    { conclusion: 'failure' },
    { status: 'in_progress' },
    { event: 'pull_request' },
    { head_branch: 'feature' },
    { path: '.github/workflows/other.yml' },
    { head_repository: { full_name: 'fork/context-engine' } },
  ]) {
    assert.throws(
      () => validateSuccessfulCiRun({ ...valid, ...patch }, { repository: 'AgalmicSoftware/context-engine' }),
    );
  }
});

test('stable promotion retains current and previous rollback targets across reruns', () => {
  assert.deepEqual(planStablePromotion({ targetCommit: SHA_A, currentCommit: '', previousCommit: '' }), {
    promotionChanged: 'true',
    stableCommit: SHA_A,
    previousCommit: SHA_A,
  });
  assert.deepEqual(planStablePromotion({ targetCommit: SHA_B, currentCommit: SHA_A, previousCommit: SHA_C }), {
    promotionChanged: 'true',
    stableCommit: SHA_B,
    previousCommit: SHA_A,
  });
  assert.deepEqual(planStablePromotion({ targetCommit: SHA_B, currentCommit: SHA_B, previousCommit: SHA_A }), {
    promotionChanged: 'false',
    stableCommit: SHA_B,
    previousCommit: SHA_A,
  });
  assert.throws(() => planStablePromotion({ targetCommit: 'main', currentCommit: '', previousCommit: '' }));
});

test('source provenance resolves the replay trailer from a fast-forward or merge tip', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-worker-source-'));
  const git = (args) => execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim();
  git(['init', '-b', 'main']);
  git(['config', 'user.name', 'Test']);
  git(['config', 'user.email', '[redacted-email]']);
  fs.writeFileSync(path.join(rootDir, 'file.txt'), 'base\n');
  git(['add', 'file.txt']);
  git(['commit', '-m', 'base']);
  git(['switch', '-c', 'release-staging']);
  fs.appendFileSync(path.join(rootDir, 'file.txt'), 'replay\n');
  git(['commit', '-am', `public replay\n\nCE-Private-Source: ${SHA_C}`]);
  const replayCommit = git(['rev-parse', 'HEAD']);
  git(['switch', 'main']);
  git(['merge', '--no-ff', 'release-staging', '-m', 'merge public replay']);
  const mergeCommit = git(['rev-parse', 'HEAD']);

  const resolved = resolveSourceProvenance({ rootDir, commit: mergeCommit });
  assert.equal(resolved.publicReplayCommit, replayCommit);
  assert.equal(resolved.privateSourceCommit, SHA_C);
  assert.match(resolved.sourceTree, /^[a-f0-9]{40}$/);
});

test('source provenance recognizes only the audited PR 30 trailerless release mapping', () => {
  assert.equal(
    resolvePrivateSourceReference({
      publicCommit: '974dc394a19c420dd6cfcfb5f88499330408a92d',
      trailer: '',
    }),
    '48f5182922c87505c963edc9d0e3fd2c7e1ca8c7',
  );
  assert.equal(
    resolvePrivateSourceReference({
      publicCommit: SHA_A,
      trailer: SHA_C,
    }),
    SHA_C,
  );
  assert.equal(
    resolvePrivateSourceReference({
      publicCommit: SHA_A,
      trailer: '',
    }),
    '',
  );
});

test('source provenance rejects commits without an explicit replay mapping', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-worker-source-missing-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: rootDir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: rootDir });
  execFileSync('git', ['config', 'user.email', '[redacted-email]'], { cwd: rootDir });
  fs.writeFileSync(path.join(rootDir, 'file.txt'), 'base\n');
  execFileSync('git', ['add', 'file.txt'], { cwd: rootDir });
  execFileSync('git', ['commit', '-m', 'base'], { cwd: rootDir });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim();
  assert.throws(() => resolveSourceProvenance({ rootDir, commit }), /CE-Private-Source trailer/);
});

test('manifest verification rejects a rewritten provenance field', () => {
  const { rootDir, artifactDir } = fixture();
  const manifestPath = path.join(artifactDir, MANIFEST_FILE);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.replay.publicTree = SHA_C;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(
    () => verifyWorkerReleaseArtifact({
      rootDir,
      artifactDir,
      expectedSourceCommit: SHA_A,
      expectedSourceRef: 'refs/heads/main',
      expectedSourceTree: SHA_B,
      expectedRepository: 'AgalmicSoftware/context-engine',
      expectedWorkflow: 'CI',
      expectedRunId: '123',
      expectedRunAttempt: '2',
    }),
    /replay public tree mismatch/,
  );
});
