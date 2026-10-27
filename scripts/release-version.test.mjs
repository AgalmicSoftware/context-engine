import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assessReleaseImpact,
  compareVersions,
  incrementPatch,
  listWorkerSourceChanges,
  pinWorkerRelease,
  planReleaseVersion,
  readVersionSurfaces,
  verifyWorkerReleasePin,
  WORKER_RELEASE_SOURCE_PATHSPEC,
  writeVersionSurfaces,
} from './release-version.mjs';
import { resolveWorkerBundleTargets } from './worker-bundle.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./release-version.mjs', import.meta.url));

const git = (repoRoot, args) => execFileSync('git', args, {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

const packageJson = (name, version) => `${JSON.stringify({ name, version, private: true }, null, 2)}\n`;
const packageLock = (name, version) => `${JSON.stringify({
  name,
  version,
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': { name, version },
  },
}, null, 2)}\n`;

test('stable SemVer comparison and patch increments are deterministic', () => {
  assert.equal(compareVersions('0.1.9', '0.1.10'), -1);
  assert.equal(compareVersions('1.0.0', '0.99.99'), 1);
  assert.equal(compareVersions('0.0.9007199254740992', '0.0.9007199254740993'), -1);
  assert.equal(incrementPatch('0.1.9'), '0.1.10');
  assert.equal(incrementPatch('0.0.9007199254740992'), '0.0.9007199254740993');
  assert.throws(() => incrementPatch('0.1.0-beta.1'), /stable MAJOR\.MINOR\.PATCH/);
});

test('release planning uses the greatest public baseline and keeps major/minor operator-owned', () => {
  assert.deepEqual(
    planReleaseVersion({ mainVersion: '0.1.0', stagingVersion: null }),
    { baselineVersion: '0.1.0', nextVersion: '0.1.1', releaseLevel: 'patch' },
  );
  assert.deepEqual(
    planReleaseVersion({ mainVersion: '0.1.0', stagingVersion: '0.1.2' }),
    { baselineVersion: '0.1.2', nextVersion: '0.1.3', releaseLevel: 'patch' },
  );
  assert.deepEqual(
    planReleaseVersion({
      mainVersion: '0.1.4',
      stagingVersion: null,
      explicitVersion: '0.2.0',
    }),
    { baselineVersion: '0.1.4', nextVersion: '0.2.0', releaseLevel: 'minor' },
  );
  assert.throws(
    () => planReleaseVersion({
      mainVersion: '0.1.4',
      stagingVersion: null,
      explicitVersion: '0.2.1',
    }),
    /minor releases must increment minor once and reset patch to zero/,
  );
  assert.throws(
    () => planReleaseVersion({
      mainVersion: '1.2.3',
      stagingVersion: null,
      explicitVersion: '2.1.0',
    }),
    /major releases must increment major once and reset minor and patch to zero/,
  );
});

test('release impact reports breaking surfaces, explicit features, and patch-only changes', () => {
  assert.equal(
    assessReleaseImpact({
      paths: ['client/src/utilities/crypto/cryptography.ts'],
      subjects: ['fix: clarify envelope failure'],
    }).level,
    'major',
  );
  assert.equal(
    assessReleaseImpact({
      paths: ['client/src/components/About/AboutPage.tsx'],
      subjects: ['feat: add contributor panel'],
    }).level,
    'minor',
  );
  assert.equal(
    assessReleaseImpact({
      paths: ['docs/release-runbook.md'],
      subjects: ['docs: clarify release command'],
    }).level,
    'patch',
  );
});

test('version surfaces are synchronized without changing unrelated metadata', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-release-version-'));
  try {
    fs.mkdirSync(path.join(rootDir, 'client'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'package.json'), packageJson('contextEngine', '0.1.0'));
    fs.writeFileSync(path.join(rootDir, 'package-lock.json'), packageLock('contextEngine', '0.1.0'));
    fs.writeFileSync(path.join(rootDir, 'client', 'package.json'), packageJson('client', '0.1.0'));
    fs.writeFileSync(path.join(rootDir, 'client', 'package-lock.json'), packageLock('client', '0.1.0'));

    writeVersionSurfaces(rootDir, '0.1.1');

    assert.deepEqual(readVersionSurfaces(rootDir), {
      version: '0.1.1',
      surfaces: {
        'package.json': '0.1.1',
        'package-lock.json': '0.1.1',
        'client/package.json': '0.1.1',
        'client/package-lock.json': '0.1.1',
      },
    });
    assert.equal(JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).private, true);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('verify-ref fails when a supplied release floor cannot be resolved', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-release-ref-'));
  try {
    fs.mkdirSync(path.join(rootDir, 'client'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'package.json'), packageJson('contextEngine', '0.1.1'));
    fs.writeFileSync(path.join(rootDir, 'package-lock.json'), packageLock('contextEngine', '0.1.1'));
    fs.writeFileSync(path.join(rootDir, 'client', 'package.json'), packageJson('client', '0.1.1'));
    fs.writeFileSync(path.join(rootDir, 'client', 'package-lock.json'), packageLock('client', '0.1.1'));
    git(rootDir, ['init', '--quiet']);
    git(rootDir, ['config', 'user.name', 'Release Tester']);
    git(rootDir, ['config', 'user.email', '[redacted-email]']);
    git(rootDir, ['add', 'package.json', 'package-lock.json', 'client/package.json', 'client/package-lock.json']);
    git(rootDir, ['commit', '--quiet', '-m', 'candidate']);

    for (const option of ['--baseline-ref', '--minimum-ref']) {
      const result = spawnSync(process.execPath, [
        SCRIPT_PATH,
        'verify-ref',
        '--repo-root',
        rootDir,
        '--candidate-ref',
        'HEAD',
        option,
        'f'.repeat(40),
      ], { encoding: 'utf8' });

      assert.notEqual(result.status, 0, `${option} unexpectedly passed`);
      assert.match(result.stderr, /Release version ref was not found/);
    }
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('verify-ref rejects an exact SemVer downgrade beyond the safe integer range', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-release-large-version-'));
  try {
    fs.mkdirSync(path.join(rootDir, 'client'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'package.json'), packageJson('contextEngine', '0.0.9007199254740993'));
    fs.writeFileSync(path.join(rootDir, 'package-lock.json'), packageLock('contextEngine', '0.0.9007199254740993'));
    fs.writeFileSync(path.join(rootDir, 'client', 'package.json'), packageJson('client', '0.0.9007199254740993'));
    fs.writeFileSync(path.join(rootDir, 'client', 'package-lock.json'), packageLock('client', '0.0.9007199254740993'));
    git(rootDir, ['init', '--quiet']);
    git(rootDir, ['config', 'user.name', 'Release Tester']);
    git(rootDir, ['config', 'user.email', '[redacted-email]']);
    git(rootDir, ['add', 'package.json', 'package-lock.json', 'client/package.json', 'client/package-lock.json']);
    git(rootDir, ['commit', '--quiet', '-m', 'minimum']);
    const minimumRef = git(rootDir, ['rev-parse', 'HEAD']);

    writeVersionSurfaces(rootDir, '0.0.9007199254740992');
    git(rootDir, ['add', 'package.json', 'package-lock.json', 'client/package.json', 'client/package-lock.json']);
    git(rootDir, ['commit', '--quiet', '-m', 'candidate']);

    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      'verify-ref',
      '--repo-root',
      rootDir,
      '--candidate-ref',
      'HEAD',
      '--minimum-ref',
      minimumRef,
    ], { encoding: 'utf8' });

    assert.notEqual(result.status, 0, 'unsafe large-version downgrade unexpectedly passed');
    assert.match(result.stderr, /must not be lower/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

const PIN_PATH = path.join('client', 'src', 'variables', 'workerReleasePin.json');
const EXAMPLE_CONFIG_PATH = path.join('workers', 'deploy-helper', 'wrangler.example.toml');

const writeRepoFile = (rootDir, relativePath, contents) => {
  fs.mkdirSync(path.dirname(path.join(rootDir, relativePath)), { recursive: true });
  fs.writeFileSync(path.join(rootDir, relativePath), contents);
};

const commitAll = (rootDir, message) => {
  git(rootDir, ['add', '-A']);
  git(rootDir, ['commit', '--quiet', '-m', message]);
  return git(rootDir, ['rev-parse', 'HEAD']);
};

const writePin = (rootDir, commit, manifestSha256 = 'a'.repeat(64)) => writeRepoFile(
  rootDir,
  PIN_PATH,
  `${JSON.stringify({ commit, manifestSha256 }, null, 2)}\n`,
);

const writeExampleConfig = (rootDir, commit) => writeRepoFile(
  rootDir,
  EXAMPLE_CONFIG_PATH,
  `WORKER_BUNDLE_URL = "https://github.com/o/r/releases/download/worker-bundles-${commit}/sessionCorsWorker.bundle.js"\n`,
);

// pin-worker-release moves the pin and the deploy-helper example together.
const writePinnedRelease = (rootDir, commit) => {
  writePin(rootDir, commit);
  writeExampleConfig(rootDir, commit);
};

// Public main with three published releases and an unpublished tip:
// release B only restamps the version, release C changes Worker code and
// the tip changes only a Worker test.
const createPublishedReleaseHistory = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-worker-pin-'));
  git(rootDir, ['init', '--quiet', '--initial-branch', 'main']);
  git(rootDir, ['config', 'user.name', 'Release Tester']);
  git(rootDir, ['config', 'user.email', '[redacted-email]']);
  const writeVersion = (version) => {
    writeRepoFile(rootDir, 'package.json', packageJson('contextEngine', version));
    writeRepoFile(rootDir, 'package-lock.json', packageLock('contextEngine', version));
    writeRepoFile(rootDir, path.join('client', 'package.json'), packageJson('client', version));
    writeRepoFile(rootDir, path.join('client', 'package-lock.json'), packageLock('client', version));
  };
  writeVersion('0.1.0');
  writeRepoFile(rootDir, path.join('workers', 'sessionCorsWorker', 'worker.js'), 'export default 1;\n');
  writeRepoFile(
    rootDir,
    EXAMPLE_CONFIG_PATH,
    'WORKER_BUNDLE_URL = "https://github.com/o/r/releases/download/worker-bundles-' + 'f'.repeat(40) + '/sessionCorsWorker.bundle.js"\n',
  );
  const releaseA = commitAll(rootDir, 'release a');
  writeVersion('0.1.1');
  writeRepoFile(rootDir, 'docs/notes.md', 'notes\n');
  const releaseB = commitAll(rootDir, 'release b');
  writeRepoFile(rootDir, path.join('workers', 'sessionCorsWorker', 'worker.js'), 'export default 2;\n');
  const releaseC = commitAll(rootDir, 'release c');
  writeRepoFile(rootDir, path.join('workers', 'sessionCorsWorker', 'worker.test.mjs'), 'test\n');
  const unpublishedTip = commitAll(rootDir, 'unpublished tip');
  for (const commit of [releaseA, releaseB, releaseC]) git(rootDir, ['tag', `worker-bundles-${commit}`, commit]);
  git(rootDir, ['tag', 'worker-bundles-stable', releaseC]);
  return { rootDir, releaseA, releaseB, releaseC, unpublishedTip };
};

const commitCandidatePin = (rootDir, commit) => {
  git(rootDir, ['checkout', '--quiet', '-B', 'candidate', 'main']);
  writePinnedRelease(rootDir, commit);
  return commitAll(rootDir, `pin ${commit}`);
};

test('Worker source comparison ignores version stamps and test-only changes', () => {
  const { rootDir, releaseA, releaseB, releaseC, unpublishedTip } = createPublishedReleaseHistory();
  try {
    assert.deepEqual(listWorkerSourceChanges({ repoRoot: rootDir, fromRef: releaseA, toRef: releaseB }), []);
    assert.deepEqual(listWorkerSourceChanges({ repoRoot: rootDir, fromRef: releaseB, toRef: releaseC }), [
      'workers/sessionCorsWorker/worker.js',
    ]);
    assert.deepEqual(listWorkerSourceChanges({ repoRoot: rootDir, fromRef: releaseC, toRef: unpublishedTip }), []);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('the Worker release pin must carry the newest published Worker code', () => {
  const { rootDir, releaseA, releaseC, unpublishedTip } = createPublishedReleaseHistory();
  try {
    const verify = (pinCommit) => verifyWorkerReleasePin({
      repoRoot: rootDir,
      candidateRef: commitCandidatePin(rootDir, pinCommit),
      baselineRef: 'main',
    });

    assert.deepEqual(verify(releaseC), { pinCommit: releaseC, newestRelease: releaseC });
    assert.throws(() => verify(releaseA), /pin [a-f0-9]{40} is stale: worker-bundles-[a-f0-9]{40}.*worker\.js/);
    assert.throws(
      () => verify(unpublishedTip),
      /not a published worker-bundles release in main; fetch release tags \(git fetch --no-tags origin main '\+refs\/tags\/worker-bundles-\*:refs\/tags\/worker-bundles-\*'\)/,
    );
    assert.equal(
      verifyWorkerReleasePin({ repoRoot: rootDir, candidateRef: 'main', baselineRef: 'main' }),
      null,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('the release gate refuses a dropped, malformed or split Worker release pin', () => {
  const { rootDir, releaseA, releaseC } = createPublishedReleaseHistory();
  try {
    // Public main ships the pin from here on.
    writePinnedRelease(rootDir, releaseC);
    commitAll(rootDir, 'pin on main');
    const verifyCandidate = (edit) => {
      git(rootDir, ['checkout', '--quiet', '-B', 'candidate', 'main']);
      edit();
      return verifyWorkerReleasePin({
        repoRoot: rootDir,
        candidateRef: commitAll(rootDir, 'candidate'),
        baselineRef: 'main',
      });
    };

    assert.throws(
      () => verifyCandidate(() => fs.rmSync(path.join(rootDir, PIN_PATH))),
      /workerReleasePin\.json is missing at [a-f0-9]{40} but present in main/,
    );
    assert.throws(
      () => verifyCandidate(() => writePin(rootDir, releaseC, 'not-a-digest')),
      /must pin a full lowercase commit and manifest SHA-256/,
    );
    assert.throws(
      () => verifyCandidate(() => writeExampleConfig(rootDir, releaseA)),
      new RegExp(`wrangler\\.example\\.toml at [a-f0-9]{40} names worker-bundles-${releaseA}, not the pinned ${releaseC}`),
    );
    assert.deepEqual(
      verifyCandidate(() => writeRepoFile(rootDir, 'docs/release.md', 'notes\n')),
      { pinCommit: releaseC, newestRelease: releaseC },
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('release preparation and release-ref verification refuse a stale Worker pin', () => {
  const { rootDir, releaseA, releaseC } = createPublishedReleaseHistory();
  const run = (args) => spawnSync(process.execPath, [SCRIPT_PATH, ...args, '--repo-root', rootDir], { encoding: 'utf8' });
  try {
    const staleCandidate = commitCandidatePin(rootDir, releaseA);
    writeVersionSurfaces(rootDir, '0.1.2');
    commitAll(rootDir, 'stamp');

    const plan = run(['plan', '--main-ref', 'main']);
    assert.notEqual(plan.status, 0, 'plan accepted a stale pin');
    assert.match(plan.stderr, /Worker release pin [a-f0-9]{40} is stale/);
    // A dry run reads the target base, not the replayed candidate.
    assert.equal(run(['plan', '--main-ref', 'main', '--dry-run']).status, 0);

    const verifyRef = run(['verify-ref', '--candidate-ref', 'HEAD', '--baseline-ref', 'main']);
    assert.notEqual(verifyRef.status, 0, `verify-ref accepted a stale pin from ${staleCandidate}`);
    assert.match(verifyRef.stderr, /is stale/);

    writePinnedRelease(rootDir, releaseC);
    commitAll(rootDir, 'move pin');
    assert.equal(run(['plan', '--main-ref', 'main']).status, 0);
    const fresh = run(['verify-ref', '--candidate-ref', 'HEAD', '--baseline-ref', 'main']);
    assert.equal(fresh.status, 0, fresh.stderr);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('pin-worker-release pins the newest verified release and its deploy-helper example', async () => {
  const { rootDir, releaseA, releaseB, releaseC } = createPublishedReleaseHistory();
  try {
    await assert.rejects(
      pinWorkerRelease({ repoRoot: rootDir, mainRef: 'main', fetchRemote: '' }),
      /workerReleasePin\.json was not found/,
    );
    writePin(rootDir, releaseA);
    const verified = [];
    const pin = await pinWorkerRelease({
      repoRoot: rootDir,
      mainRef: 'main',
      fetchRemote: '',
      verifyRelease: async ({ commit }) => {
        verified.push(commit);
        return { ok: true, failures: [], manifestSha256: 'b'.repeat(64) };
      },
    });

    assert.deepEqual(verified, [releaseC]);
    assert.deepEqual(pin, { commit: releaseC, manifestSha256: 'b'.repeat(64) });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(rootDir, PIN_PATH), 'utf8')), pin);
    assert.match(
      fs.readFileSync(path.join(rootDir, EXAMPLE_CONFIG_PATH), 'utf8'),
      new RegExp(`worker-bundles-${releaseC}/sessionCorsWorker`),
    );
    await assert.rejects(
      pinWorkerRelease({
        repoRoot: rootDir,
        mainRef: 'main',
        commit: releaseB,
        fetchRemote: '',
        verifyRelease: async () => ({ ok: false, failures: ['manifest: HTTP 404'] }),
      }),
      /failed verification: manifest: HTTP 404/,
    );
    await assert.rejects(
      pinWorkerRelease({ repoRoot: rootDir, mainRef: 'main', commit: 'c'.repeat(40), fetchRemote: '' }),
      /is not a published release in main history/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('pin-worker-release fetches moved release channel tags and reports git failures', async () => {
  const { rootDir: publicDir, releaseA, releaseB, releaseC } = createPublishedReleaseHistory();
  const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-worker-pin-clone-'));
  try {
    git(publicDir, ['tag', 'v0.1.0', releaseA]);
    git(cloneDir, ['clone', '--quiet', publicDir, '.']);
    // Promote Worker Bundles moves worker-bundles-stable after this clone fetched it.
    git(publicDir, ['tag', '-f', 'worker-bundles-stable', releaseB]);
    // Tags outside the Worker release namespace are left as the clone has them.
    git(publicDir, ['tag', '-f', 'v0.1.0', releaseB]);
    git(publicDir, ['tag', 'v0.1.1', releaseC]);
    writePin(cloneDir, releaseB);
    const verifyRelease = async () => ({ ok: true, failures: [], manifestSha256: 'c'.repeat(64) });

    const pin = await pinWorkerRelease({ repoRoot: cloneDir, mainRef: 'origin/main', verifyRelease });

    assert.equal(pin.commit, releaseC);
    assert.equal(git(cloneDir, ['rev-parse', 'worker-bundles-stable^{commit}']), releaseB);
    assert.equal(git(cloneDir, ['rev-parse', 'v0.1.0^{commit}']), releaseA);
    assert.equal(git(cloneDir, ['tag', '--list', 'v0.1.1']), '');
    await assert.rejects(
      pinWorkerRelease({ repoRoot: cloneDir, mainRef: 'origin/main', fetchRemote: 'missing-remote', verifyRelease }),
      /Fetching release tags from missing-remote failed: .*missing-remote/s,
    );
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true });
    fs.rmSync(cloneDir, { recursive: true, force: true });
  }
});

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const repoHasGitHistory = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: REPO_ROOT }).status === 0;

test('the Worker source pathspec covers every local input of the release bundles', {
  skip: !repoHasGitHistory,
}, async () => {
  const { build } = await import('esbuild');
  const bundleInputs = new Set();
  for (const target of resolveWorkerBundleTargets({ rootDir: REPO_ROOT })) {
    // Same entry and options as scripts/worker-bundle.mjs; packages stay
    // external because the lockfiles in the pathspec cover them.
    const result = await build({
      absWorkingDir: REPO_ROOT,
      entryPoints: [target.entryRelativePath],
      bundle: true,
      write: false,
      metafile: true,
      platform: 'browser',
      format: 'esm',
      preserveSymlinks: true,
      packages: 'external',
      logLevel: 'silent',
      target: [target.target || 'es2020'],
      ...(target.mainFields ? { mainFields: target.mainFields } : {}),
    });
    Object.keys(result.metafile.inputs)
      .filter((input) => !input.includes('node_modules') && !input.startsWith('('))
      .forEach((input) => bundleInputs.add(input));
  }
  const covered = new Set(
    git(REPO_ROOT, ['ls-files', '--', ...WORKER_RELEASE_SOURCE_PATHSPEC]).split(/\r?\n/).filter(Boolean),
  );

  assert.ok(bundleInputs.has('workers/sessionCorsWorker/worker.js'));
  assert.deepEqual([...bundleInputs].filter((input) => !covered.has(input)), []);
  // The native Cloudflare template the pin also selects.
  for (const templateInput of [
    'deploy/cloudflare/session-worker/worker.mjs',
    'deploy/cloudflare/session-worker/wrangler.jsonc',
    'deploy/cloudflare/session-worker/package.json',
    'scripts/cloudflare-session-template.mjs',
    'scripts/lib/worker-third-party-notices.mjs',
  ]) {
    assert.ok(covered.has(templateInput), `${templateInput} is not in the Worker source pathspec`);
  }
  // Files no bundle imports would only force needless pin moves.
  for (const nonInput of [
    'shared/encryption/envelopeV1Core.mjs',
    'shared/encryption/envelopeWriterFixtures.mjs',
    'shared/questions/questionId.mjs',
    'workers/agentBridgeWorker/agentOnlyLoadTest.mjs',
    'workers/agentBridgeWorker/deployHelperApply.mjs',
    'workers/agentBridgeWorker/deployHelperPlan.mjs',
  ]) {
    assert.ok(!covered.has(nonInput), `${nonInput} is not a bundle input`);
  }
});

const releaseGuideUrl = new URL('../docs/releasing.md', import.meta.url);
const releaseGuideIsPresent = fs.existsSync(releaseGuideUrl);

test('release guidance documents staging version and ratchet floors', {
  skip: !releaseGuideIsPresent,
}, () => {
  const guide = fs.readFileSync(releaseGuideUrl, 'utf8');

  assert.match(guide, /greater than public `main`/);
  assert.match(guide, /equal to the previous staging version/);
  assert.match(
    guide,
    /Staging pushes compare ratchets to their prior tip only when public `main` is an\s+ancestor of that tip/,
  );
  assert.match(guide, /If public `main` has advanced beyond the prior staging tip/);
});

test('release guidance documents public tag provenance checks', {
  skip: !releaseGuideIsPresent,
}, () => {
  const guide = fs.readFileSync(releaseGuideUrl, 'utf8');

  assert.match(guide, /queries the protected remote for public tag\s+refs/);
  assert.match(guide, /fails closed when public tag history is unavailable/);
  assert.match(guide, /A local-only tag\s+does not prove that a source commit is public/);
});
