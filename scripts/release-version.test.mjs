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
  writeVersionSurfaces,
} from './release-version.mjs';

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

const writePin = (rootDir, commit) => writeRepoFile(
  rootDir,
  PIN_PATH,
  `${JSON.stringify({ commit, manifestSha256: 'a'.repeat(64) }, null, 2)}\n`,
);

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
  writePin(rootDir, commit);
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
    assert.throws(() => verify(unpublishedTip), /not a published worker-bundles release in main/);
    assert.equal(
      verifyWorkerReleasePin({ repoRoot: rootDir, candidateRef: 'main', baselineRef: 'main' }),
      null,
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

    writePin(rootDir, releaseC);
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
