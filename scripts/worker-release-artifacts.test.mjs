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
  verifyPublicReplayRange,
  verifyWorkerReleaseArtifact,
} from './worker-release-artifacts.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const joinAt = (left, right) => `${left}@${right}`;

function publicReplayFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-replay-'));
  const git = (args) => execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim();
  git(['init', '-b', 'main']);
  git(['config', 'user.name', 'Agalmic']);
  git(['config', 'user.email', 'agalmicsoftware@protonmail.com']);
  fs.writeFileSync(path.join(rootDir, 'file.txt'), 'base\n');
  git(['add', 'file.txt']);
  git(['commit', '-m', 'base']);
  const baseCommit = git(['rev-parse', 'HEAD']);
  fs.appendFileSync(path.join(rootDir, 'file.txt'), 'replay\n');
  git(['commit', '-am', `public replay\n\nCE-Private-Source: ${SHA_C}`]);
  const candidateCommit = git(['rev-parse', 'HEAD']);
  return { rootDir, git, baseCommit, candidateCommit };
}

function sourceProvenanceFixture(prefix = 'ce-worker-source-') {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const git = (args) => execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim();
  git(['init', '-b', 'main']);
  git(['config', 'user.name', 'Test']);
  git(['config', 'user.email', joinAt('test', 'example.invalid')]);
  fs.writeFileSync(path.join(rootDir, 'base.txt'), 'base\n');
  git(['add', 'base.txt']);
  git(['commit', '-m', 'base']);
  return { rootDir, git, baseCommit: git(['rev-parse', 'HEAD']) };
}

function createUnreferencedSourceCommit(git, parent, subject) {
  return git(['commit-tree', git(['write-tree']), '-p', parent, '-m', subject]);
}

function messageWithSource(subject, privateSourceCommit = '') {
  return privateSourceCommit
    ? `${subject}\n\nCE-Private-Source: ${privateSourceCommit}`
    : subject;
}

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
  assert.deepEqual(manifest.recipe.commands, [
    'npm ci',
    'npm --prefix workers/sessionCorsWorker ci',
    'npm run worker:bundle',
  ]);
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

test('public replay range verification accepts the exact public identity and one source trailer', () => {
  const { rootDir, baseCommit, candidateCommit } = publicReplayFixture();
  try {
    assert.deepEqual(
      verifyPublicReplayRange({ rootDir, baseRef: baseCommit, candidateRef: candidateCommit }),
      { baseCommit, candidateCommit, replayCommitCount: 1 },
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('public replay range rejects a synthetic merge but accepts its explicit head', () => {
  const { rootDir, git, baseCommit, candidateCommit } = publicReplayFixture();
  try {
    git(['branch', 'release-staging', candidateCommit]);
    git(['switch', '-c', 'synthetic-merge', baseCommit]);
    git(['merge', '--no-ff', 'release-staging', '-m', 'synthetic pull request merge']);
    const mergeCommit = git(['rev-parse', 'HEAD']);

    assert.deepEqual(
      verifyPublicReplayRange({ rootDir, baseRef: baseCommit, candidateRef: candidateCommit }),
      { baseCommit, candidateCommit, replayCommitCount: 1 },
    );
    assert.throws(
      () => verifyPublicReplayRange({ rootDir, baseRef: baseCommit, candidateRef: mergeCommit }),
      /not a linear public replay/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('public replay range verification rejects identity and trailer drift', () => {
  {
    const { rootDir, git, baseCommit } = publicReplayFixture();
    try {
      git([
        'commit',
        '--amend',
        '--no-edit',
        '--author',
        `Private Person <${joinAt('private.person', 'example.test')}>`,
      ]);
      const candidateCommit = git(['rev-parse', 'HEAD']);
      assert.throws(
        () => verifyPublicReplayRange({ rootDir, baseRef: baseCommit, candidateRef: candidateCommit }),
        /public replay author and committer identity/,
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  }

  {
    const { rootDir, git, baseCommit } = publicReplayFixture();
    try {
      git(['commit', '--amend', '-m', 'public replay', '-m', 'CE-Private-Source: not-a-sha']);
      const candidateCommit = git(['rev-parse', 'HEAD']);
      assert.throws(
        () => verifyPublicReplayRange({ rootDir, baseRef: baseCommit, candidateRef: candidateCommit }),
        /one valid CE-Private-Source trailer/,
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  }
});

test('public replay range rejects public commits as private-source provenance', () => {
  {
    const { rootDir, git, baseCommit } = publicReplayFixture();
    try {
      git(['commit', '--amend', '-m', 'public replay', '-m', `CE-Private-Source: ${baseCommit}`]);
      const candidateCommit = git(['rev-parse', 'HEAD']);
      assert.throws(
        () => verifyPublicReplayRange({ rootDir, baseRef: baseCommit, candidateRef: candidateCommit }),
        /CE-Private-Source must not point to public history/,
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  }

  {
    const { rootDir, git, baseCommit, candidateCommit } = publicReplayFixture();
    try {
      fs.appendFileSync(path.join(rootDir, 'file.txt'), 'follow-up\n');
      git(['commit', '-am', `public follow-up\n\nCE-Private-Source: ${candidateCommit}`]);
      const followUpCommit = git(['rev-parse', 'HEAD']);
      assert.throws(
        () => verifyPublicReplayRange({ rootDir, baseRef: baseCommit, candidateRef: followUpCommit }),
        /CE-Private-Source must not point to public history/,
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  }
});

test('public replay range rejects tag-only public commits as private-source provenance', () => {
  const { rootDir, git, baseCommit } = publicReplayFixture();
  try {
    const sourceTree = git(['write-tree']);
    const tagOnlySource = git(['commit-tree', sourceTree, '-p', baseCommit, '-m', 'published source']);
    git(['tag', 'published-source', tagOnlySource]);
    git(['commit', '--amend', '-m', 'public replay', '-m', `CE-Private-Source: ${tagOnlySource}`]);
    const candidateCommit = git(['rev-parse', 'HEAD']);
    assert.equal(git([
      'for-each-ref',
      '--contains',
      tagOnlySource,
      '--format=%(refname)',
      'refs/heads/*',
      'refs/remotes/*',
    ]), '');
    assert.equal(git(['rev-parse', 'refs/tags/published-source']), tagOnlySource);

    assert.throws(
      () => verifyPublicReplayRange({ rootDir, baseRef: baseCommit, candidateRef: candidateCommit }),
      /CE-Private-Source must not point to public history/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('public replay range rejects PII added and removed before the candidate tip', () => {
  const { rootDir, git, baseCommit } = publicReplayFixture();
  try {
    fs.writeFileSync(
      path.join(rootDir, 'transient-leak.txt'),
      `Contact ${joinAt('owner', 'example.test')}\n`,
    );
    git(['add', 'transient-leak.txt']);
    git(['commit', '-m', messageWithSource('add temporary release note', SHA_C)]);
    git(['rm', 'transient-leak.txt']);
    git(['commit', '-m', messageWithSource('remove temporary release note', SHA_C)]);
    const candidateCommit = git(['rev-parse', 'HEAD']);

    assert.equal(git(['ls-tree', '-r', '--name-only', candidateCommit, '--', 'transient-leak.txt']), '');
    assert.throws(
      () => verifyPublicReplayRange({ rootDir, baseRef: baseCommit, candidateRef: candidateCommit }),
      /public release PII scan failed/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('public replay range rejects private planning tokens in replay messages', () => {
  const { rootDir, git, baseCommit } = publicReplayFixture();
  try {
    const planningId = `${'PR'}${'D'} 123`;
    git([
      'commit',
      '--amend',
      '-m',
      `public replay\n\nReferences ${planningId}.`,
      '-m',
      `CE-Private-Source: ${SHA_C}`,
    ]);
    const candidateCommit = git(['rev-parse', 'HEAD']);

    assert.throws(
      () => verifyPublicReplayRange({ rootDir, baseRef: baseCommit, candidateRef: candidateCommit }),
      /public release PII scan failed/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('source provenance resolves a linear replay from its own trailer', () => {
  const { rootDir, git, baseCommit } = sourceProvenanceFixture();
  try {
    const privateSourceCommit = createUnreferencedSourceCommit(git, baseCommit, 'private linear source');
    fs.writeFileSync(path.join(rootDir, 'replay.txt'), 'replay\n');
    git(['add', 'replay.txt']);
    git(['commit', '-m', messageWithSource('public replay', privateSourceCommit)]);
    const replayCommit = git(['rev-parse', 'HEAD']);

    assert.deepEqual(resolveSourceProvenance({ rootDir, commit: replayCommit }), {
      sourceCommit: replayCommit,
      sourceTree: git(['rev-parse', `${replayCommit}^{tree}`]),
      privateSourceCommit,
      publicReplayCommit: replayCommit,
    });
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('source provenance binds a two-parent main merge only to its second parent', () => {
  const { rootDir, git, baseCommit } = sourceProvenanceFixture();
  try {
    const firstParentSource = createUnreferencedSourceCommit(git, baseCommit, 'private first-parent source');
    const candidateSource = createUnreferencedSourceCommit(git, baseCommit, 'private candidate source');
    const mergeSource = createUnreferencedSourceCommit(git, baseCommit, 'private merge source');
    fs.writeFileSync(path.join(rootDir, 'main.txt'), 'main\n');
    git(['add', 'main.txt']);
    git(['commit', '-m', messageWithSource('main update', firstParentSource)]);
    git(['switch', '-c', 'release-staging']);
    fs.writeFileSync(path.join(rootDir, 'candidate.txt'), 'candidate\n');
    git(['add', 'candidate.txt']);
    git(['commit', '-m', messageWithSource('public replay', candidateSource)]);
    const candidateCommit = git(['rev-parse', 'HEAD']);
    git(['switch', 'main']);
    git(['merge', '--no-ff', 'release-staging', '-m', messageWithSource('merge public replay', mergeSource)]);
    const mergeCommit = git(['rev-parse', 'HEAD']);

    assert.deepEqual(resolveSourceProvenance({ rootDir, commit: mergeCommit }), {
      sourceCommit: mergeCommit,
      sourceTree: git(['rev-parse', `${mergeCommit}^{tree}`]),
      privateSourceCommit: candidateSource,
      publicReplayCommit: candidateCommit,
    });
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('source provenance never substitutes merge or first-parent provenance for a missing candidate mapping', () => {
  for (const mergeHasTrailer of [false, true]) {
    const { rootDir, git, baseCommit } = sourceProvenanceFixture();
    try {
      const firstParentSource = createUnreferencedSourceCommit(git, baseCommit, 'private first-parent source');
      const mergeSource = createUnreferencedSourceCommit(git, baseCommit, 'private merge source');
      fs.writeFileSync(path.join(rootDir, 'main.txt'), 'main\n');
      git(['add', 'main.txt']);
      git(['commit', '-m', messageWithSource('main update', firstParentSource)]);
      git(['switch', '-c', 'release-staging']);
      fs.writeFileSync(path.join(rootDir, 'candidate.txt'), 'candidate\n');
      git(['add', 'candidate.txt']);
      git(['commit', '-m', 'candidate without provenance']);
      git(['switch', 'main']);
      git([
        'merge',
        '--no-ff',
        'release-staging',
        '-m',
        messageWithSource('merge public replay', mergeHasTrailer ? mergeSource : ''),
      ]);
      const mergeCommit = git(['rev-parse', 'HEAD']);

      assert.throws(
        () => resolveSourceProvenance({ rootDir, commit: mergeCommit }),
        /CE-Private-Source trailer/,
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  }
});

test('source provenance rejects public candidate history and tag-only commits as private sources', () => {
  for (const sourceKind of ['candidate-history', 'main-history', 'tag-only']) {
    const { rootDir, git, baseCommit } = sourceProvenanceFixture();
    try {
      fs.writeFileSync(path.join(rootDir, 'main.txt'), 'main\n');
      git(['add', 'main.txt']);
      git(['commit', '-m', 'main update']);
      const mainParent = git(['rev-parse', 'HEAD']);
      git(['switch', '-c', 'release-staging']);

      let selectedSource = mainParent;
      if (sourceKind === 'candidate-history') {
        const candidateHistorySource = createUnreferencedSourceCommit(git, mainParent, 'private prior source');
        fs.writeFileSync(path.join(rootDir, 'prior.txt'), 'prior candidate\n');
        git(['add', 'prior.txt']);
        git(['commit', '-m', messageWithSource('prior public replay', candidateHistorySource)]);
        selectedSource = git(['rev-parse', 'HEAD']);
      } else if (sourceKind === 'tag-only') {
        selectedSource = git(['commit-tree', git(['write-tree']), '-m', 'tag-only public source']);
        git(['tag', 'published-source', selectedSource]);
      }

      fs.writeFileSync(path.join(rootDir, 'candidate.txt'), 'candidate\n');
      git(['add', 'candidate.txt']);
      git(['commit', '-m', messageWithSource('public replay', selectedSource)]);
      git(['switch', 'main']);
      git(['merge', '--no-ff', 'release-staging', '-m', 'merge public replay']);
      const mergeCommit = git(['rev-parse', 'HEAD']);

      assert.throws(
        () => resolveSourceProvenance({ rootDir, commit: mergeCommit }),
        /CE-Private-Source must not point to public history/,
        sourceKind,
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  }
});

test('source provenance rejects a stale candidate that is not descended from the first parent', () => {
  const { rootDir, git, baseCommit } = sourceProvenanceFixture();
  try {
    const candidateSource = createUnreferencedSourceCommit(git, baseCommit, 'private candidate source');
    git(['switch', '-c', 'release-staging']);
    fs.writeFileSync(path.join(rootDir, 'candidate.txt'), 'candidate\n');
    git(['add', 'candidate.txt']);
    git(['commit', '-m', messageWithSource('public replay', candidateSource)]);
    git(['switch', 'main']);
    fs.writeFileSync(path.join(rootDir, 'main.txt'), 'main advanced\n');
    git(['add', 'main.txt']);
    git(['commit', '-m', 'advance main']);
    git(['merge', '--no-ff', 'release-staging', '-m', 'merge stale public replay']);
    const mergeCommit = git(['rev-parse', 'HEAD']);

    assert.throws(
      () => resolveSourceProvenance({ rootDir, commit: mergeCommit }),
      /candidate must descend from its first parent/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('source provenance rejects merge trees that differ from the direct candidate', () => {
  const { rootDir, git, baseCommit } = sourceProvenanceFixture();
  try {
    const candidateSource = createUnreferencedSourceCommit(git, baseCommit, 'private candidate source');
    git(['switch', '-c', 'release-staging']);
    fs.writeFileSync(path.join(rootDir, 'candidate.txt'), 'candidate\n');
    git(['add', 'candidate.txt']);
    git(['commit', '-m', messageWithSource('public replay', candidateSource)]);
    const candidateCommit = git(['rev-parse', 'HEAD']);
    git(['switch', 'main']);
    fs.writeFileSync(path.join(rootDir, 'merge-only.txt'), 'unattributed merge bytes\n');
    git(['add', 'merge-only.txt']);
    const mergeCommit = git([
      'commit-tree',
      git(['write-tree']),
      '-p',
      baseCommit,
      '-p',
      candidateCommit,
      '-m',
      'synthetic main merge',
    ]);

    assert.throws(
      () => resolveSourceProvenance({ rootDir, commit: mergeCommit }),
      /tree must match its candidate tree/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('source provenance rejects octopus merge tips', () => {
  const { rootDir, git, baseCommit } = sourceProvenanceFixture();
  try {
    const candidateSource = createUnreferencedSourceCommit(git, baseCommit, 'private candidate source');
    git(['switch', '-c', 'release-staging']);
    fs.writeFileSync(path.join(rootDir, 'candidate.txt'), 'candidate\n');
    git(['add', 'candidate.txt']);
    git(['commit', '-m', messageWithSource('public replay', candidateSource)]);
    const candidateCommit = git(['rev-parse', 'HEAD']);
    git(['switch', 'main']);
    const thirdParent = git(['commit-tree', git(['write-tree']), '-p', baseCommit, '-m', 'third parent']);
    const octopusCommit = git([
      'commit-tree',
      git(['rev-parse', `${candidateCommit}^{tree}`]),
      '-p',
      baseCommit,
      '-p',
      candidateCommit,
      '-p',
      thirdParent,
      '-m',
      'octopus main merge',
    ]);

    assert.throws(
      () => resolveSourceProvenance({ rootDir, commit: octopusCommit }),
      /one parent or exactly two merge parents/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
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
  execFileSync('git', ['config', 'user.email', joinAt('test', 'example.invalid')], { cwd: rootDir });
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
