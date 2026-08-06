'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const PRE_PUSH_SOURCE_PATH = path.join(__dirname, '..', '.githooks', 'pre-push');
const RELEASE_VERSION_SOURCE_PATH = path.join(__dirname, 'release-version.mjs');
const PUBLIC_GIT_NAME = 'Agalmic';
const PUBLIC_GIT_EMAIL = 'agalmicsoftware@protonmail.com';
const NON_ZERO_SHA = '1111111111111111111111111111111111111111';
const ZERO_SHA = '0000000000000000000000000000000000000000';

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function setupHookFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-pre-push-guard-'));
  execFileSync('git', ['init', '--quiet'], { cwd: tempDir });
  writeFile(
    tempDir,
    path.join('.githooks', 'pre-push'),
    fs.readFileSync(PRE_PUSH_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    tempDir,
    path.join('scripts', 'release-version.mjs'),
    fs.readFileSync(RELEASE_VERSION_SOURCE_PATH, 'utf8'),
  );
  fs.chmodSync(path.join(tempDir, '.githooks', 'pre-push'), 0o755);
  return tempDir;
}

function withHookFixture(run) {
  const tempDir = setupHookFixture();
  try {
    return run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function gitDir(rootDir) {
  return execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim();
}

function runHook(
  rootDir,
  input,
  remoteName = 'origin',
  remoteUrl = '[redacted-email]-agalmic:AgalmicSoftware/context-engine.git',
) {
  return spawnSync(
    'bash',
    [
      path.join(rootDir, '.githooks', 'pre-push'),
      remoteName,
      remoteUrl,
    ],
    {
      cwd: rootDir,
      encoding: 'utf8',
      input,
    },
  );
}

function pushLine({ localRef, localSha = NON_ZERO_SHA, remoteRef, remoteSha = ZERO_SHA }) {
  return `${localRef} ${localSha} ${remoteRef} ${remoteSha}\n`;
}

function writeVersionSurfaces(rootDir, version, clientVersion = version) {
  const rootPackage = { name: 'contextEngine', version, private: true };
  const clientPackage = { name: 'client', version: clientVersion, private: true };
  const lock = (pkg) => ({
    ...pkg,
    lockfileVersion: 3,
    packages: { '': { name: pkg.name, version: pkg.version } },
  });

  writeFile(rootDir, 'package.json', `${JSON.stringify(rootPackage, null, 2)}\n`);
  writeFile(rootDir, 'package-lock.json', `${JSON.stringify(lock(rootPackage), null, 2)}\n`);
  writeFile(rootDir, path.join('client', 'package.json'), `${JSON.stringify(clientPackage, null, 2)}\n`);
  writeFile(rootDir, path.join('client', 'package-lock.json'), `${JSON.stringify(lock(clientPackage), null, 2)}\n`);
}

function createVersionedCandidate(rootDir, candidateVersion, clientVersion = candidateVersion) {
  git(rootDir, ['config', 'user.name', 'Test User']);
  git(rootDir, ['config', 'user.email', '[redacted-email]']);
  writeVersionSurfaces(rootDir, '0.1.0');
  git(rootDir, ['add', '-A']);
  git(rootDir, ['commit', '--quiet', '-m', 'base']);
  const mainSha = git(rootDir, ['rev-parse', 'HEAD']);
  git(rootDir, ['update-ref', 'refs/remotes/origin/main', mainSha]);

  writeVersionSurfaces(rootDir, candidateVersion, clientVersion);
  writeFile(rootDir, 'candidate.txt', `${candidateVersion}\n`);
  git(rootDir, ['add', '-A']);
  const privateSourceSha = createPrivateSourceCommit(rootDir, mainSha);
  git(rootDir, ['config', 'user.name', PUBLIC_GIT_NAME]);
  git(rootDir, ['config', 'user.email', PUBLIC_GIT_EMAIL]);
  git(rootDir, [
    'commit',
    '--quiet',
    '-m',
    'candidate',
    '-m',
    `CE-Private-Source: ${privateSourceSha}`,
  ]);
  return {
    mainSha,
    candidateSha: git(rootDir, ['rev-parse', 'HEAD']),
    privateSourceSha,
  };
}

function createPrivateMergeCandidate(rootDir, branchName) {
  const { mainSha } = createVersionedCandidate(rootDir, '0.1.1');
  const publicBranch = git(rootDir, ['symbolic-ref', '--short', 'HEAD']);
  git(rootDir, ['checkout', '--quiet', '-b', 'private-history', mainSha]);
  writeFile(rootDir, 'private-only.txt', 'must not become reachable\n');
  git(rootDir, ['add', 'private-only.txt']);
  git(rootDir, ['commit', '--quiet', '-m', 'private source']);
  const privateSha = git(rootDir, ['rev-parse', 'HEAD']);
  git(rootDir, ['checkout', '--quiet', publicBranch]);
  git(rootDir, [
    'merge',
    '--quiet',
    '--no-ff',
    '-s',
    'ours',
    'private-history',
    '-m',
    `candidate merge\n\nCE-Private-Source: ${privateSha}`,
  ]);
  git(rootDir, ['branch', '-M', branchName]);
  return {
    mainSha,
    candidateSha: git(rootDir, ['rev-parse', 'HEAD']),
    privateSha,
  };
}

function git(rootDir, args) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim();
}

function createPrivateSourceCommit(rootDir, parentSha) {
  const sourceTree = git(rootDir, ['write-tree']);
  return git(rootDir, ['commit-tree', sourceTree, '-p', parentSha, '-m', 'private source']);
}

function createCommitOnBranch(rootDir, branchName) {
  git(rootDir, ['config', 'user.name', 'Test User']);
  git(rootDir, ['config', 'user.email', '[redacted-email]']);
  git(rootDir, ['checkout', '--quiet', '-b', branchName]);
  writeFile(rootDir, 'fixture.txt', 'fixture\n');
  git(rootDir, ['add', 'fixture.txt']);
  git(rootDir, ['commit', '--quiet', '-m', 'fixture']);
  return git(rootDir, ['rev-parse', 'HEAD']);
}

test('pre-push guard blocks dev pushes to the public origin', () => {
  withHookFixture((rootDir) => {
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/dev',
      remoteRef: 'refs/heads/dev',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blocked push to public Context Engine remote origin\./);
    assert.match(result.stderr, /Rejected ref: refs\/heads\/dev/);
    assert.doesNotMatch(result.stderr, /CE_PUSH_OVERRIDE|CE_ALLOW_PRIVATE_BRANCH_PUSH/);
  });
});

const PUBLIC_REMOTE_URLS = [
  'https://github.com/agalmicsoftware/context-engine.git',
  'https://[redacted-email]/AgalmicSoftware/context-engine.git',
  'https://[redacted-email]:443/AgalmicSoftware/context-engine.git',
  '[redacted-email]:agalmicsoftware/context-engine.git',
  'github.com:AgalmicSoftware/context-engine.git',
  'ssh://[redacted-email]:22/AgalmicSoftware/context-engine.git',
  'git+ssh://[redacted-email]/AgalmicSoftware/context-engine.git',
  'ssh+git://[redacted-email]/AgalmicSoftware/context-engine.git',
  'git://github.com:9418/AgalmicSoftware/context-engine.git',
];

for (const remoteUrl of PUBLIC_REMOTE_URLS) {
  test(`pre-push guard blocks dev pushes through case-variant public alias ${remoteUrl}`, () => {
    withHookFixture((rootDir) => {
      const result = runHook(
        rootDir,
        pushLine({
          localRef: 'refs/heads/dev',
          remoteRef: 'refs/heads/dev',
        }),
        'public-alias',
        remoteUrl,
      );

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Blocked push to public Context Engine remote public-alias\./);
    });
  });
}

for (const remoteUrl of [
  'https://github.com.evil/AgalmicSoftware/context-engine.git',
  'https://github.com/AgalmicSoftware/context-engine-archive.git',
  'https://github.com/Other/context-engine.git',
  'ssh://[redacted-email]/AgalmicSoftware/context-engine.git',
  '[redacted-email]:AgalmicSoftware/context-engine.git.evil',
  'https://github.com.evil/[redacted-email]/AgalmicSoftware/context-engine.git',
  'https://github.com/AgalmicSoftware/context-engine.git?mirror=1',
]) {
  test(`pre-push guard ignores non-public lookalike ${remoteUrl}`, () => {
    withHookFixture((rootDir) => {
      const result = runHook(
        rootDir,
        pushLine({
          localRef: 'refs/heads/dev',
          remoteRef: 'refs/heads/dev',
        }),
        'private-alias',
        remoteUrl,
      );

      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
    });
  });
}

test('pre-push guard allows an unchanged public main ref', () => {
  withHookFixture((rootDir) => {
    const { mainSha } = createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, ['branch', 'main', mainSha]);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/main',
      localSha: mainSha,
      remoteRef: 'refs/heads/main',
      remoteSha: mainSha,
    }));

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });
});

test('pre-push guard blocks direct main history advancement', () => {
  withHookFixture((rootDir) => {
    const { mainSha, candidateSha } = createPrivateMergeCandidate(rootDir, 'main');
    assert.equal(git(rootDir, ['merge-base', '--is-ancestor', mainSha, candidateSha]), '');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/main',
      localSha: candidateSha,
      remoteRef: 'refs/heads/main',
      remoteSha: mainSha,
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blocked public branch refs\/heads\/main/);
    assert.match(result.stderr, /release-staging pull request/);
  });
});

test('pre-push guard blocks private ancestry behind a clean staging tip', () => {
  withHookFixture((rootDir) => {
    const { candidateSha, privateSha } = createPrivateMergeCandidate(rootDir, 'release-staging');
    assert.equal(git(rootDir, ['merge-base', '--is-ancestor', privateSha, candidateSha]), '');
    assert.equal(git(rootDir, ['ls-tree', '-r', '--name-only', candidateSha, '--', 'private-only.txt']), '');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blocked public branch refs\/heads\/release-staging/);
    assert.match(result.stderr, /linear public replay/);
  });
});

test('pre-push guard does not override staging ancestry validation', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createPrivateMergeCandidate(rootDir, 'release-staging');
    const overridePath = path.join(rootDir, gitDir(rootDir), 'CE_PUSH_OVERRIDE');
    fs.writeFileSync(overridePath, 'operator-approved\n');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /candidate is not a linear public replay/);
    assert.equal(fs.existsSync(overridePath), true);
  });
});

test('pre-push guard blocks linear staging commits retained by a private ref', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    writeFile(rootDir, 'private-only.txt', 'must not become reachable\n');
    git(rootDir, ['add', 'private-only.txt']);
    const privateSourceSha = createPrivateSourceCommit(rootDir, candidateSha);
    git(rootDir, [
      'commit',
      '--quiet',
      '-m',
      'private follow-up',
      '-m',
      `CE-Private-Source: ${privateSourceSha}`,
    ]);
    const privateSha = git(rootDir, ['rev-parse', 'HEAD']);
    git(rootDir, ['branch', '-M', 'dev']);
    git(rootDir, ['branch', 'release-staging', privateSha]);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: privateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blocked public branch refs\/heads\/release-staging/);
    assert.match(result.stderr, /also reachable from non-public ref refs\/heads\/dev/);
  });
});

test('pre-push guard requires provenance on every new staging commit', () => {
  withHookFixture((rootDir) => {
    createVersionedCandidate(rootDir, '0.1.1');
    writeFile(rootDir, 'follow-up.txt', 'missing provenance\n');
    git(rootDir, ['add', 'follow-up.txt']);
    git(rootDir, ['commit', '--quiet', '-m', 'unbound follow-up']);
    const followUpSha = git(rootDir, ['rev-parse', 'HEAD']);
    git(rootDir, ['branch', '-M', 'release-staging']);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: followUpSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blocked public branch refs\/heads\/release-staging/);
    assert.match(result.stderr, /valid CE-Private-Source trailer/);
  });
});

test('pre-push guard requires the public replay author and committer identity', () => {
  withHookFixture((rootDir) => {
    createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, [
      'commit',
      '--quiet',
      '--amend',
      '--no-edit',
      '--author',
      'Private Person <[redacted-email]>',
    ]);
    const candidateSha = git(rootDir, ['rev-parse', 'HEAD']);
    git(rootDir, ['branch', '-M', 'release-staging']);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /public replay author and committer identity/);
  });

  withHookFixture((rootDir) => {
    createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, ['config', 'user.name', 'Private Person']);
    git(rootDir, ['config', 'user.email', '[redacted-email]']);
    git(rootDir, [
      'commit',
      '--quiet',
      '--amend',
      '--no-edit',
      '--author',
      `${PUBLIC_GIT_NAME} <${PUBLIC_GIT_EMAIL}>`,
    ]);
    const candidateSha = git(rootDir, ['rev-parse', 'HEAD']);
    git(rootDir, ['branch', '-M', 'release-staging']);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /public replay author and committer identity/);
  });
});

test('pre-push guard requires each private-source trailer to resolve to a commit', () => {
  withHookFixture((rootDir) => {
    createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, [
      'commit',
      '--quiet',
      '--amend',
      '-m',
      'candidate',
      '-m',
      `CE-Private-Source: ${NON_ZERO_SHA}`,
    ]);
    const candidateSha = git(rootDir, ['rev-parse', 'HEAD']);
    git(rootDir, ['branch', '-M', 'release-staging']);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CE-Private-Source commit is unavailable/);
  });
});

test('pre-push guard rejects public commits as private-source provenance', () => {
  withHookFixture((rootDir) => {
    const { mainSha } = createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, [
      'commit',
      '--quiet',
      '--amend',
      '-m',
      'candidate',
      '-m',
      `CE-Private-Source: ${mainSha}`,
    ]);
    const candidateSha = git(rootDir, ['rev-parse', 'HEAD']);
    git(rootDir, ['branch', '-M', 'release-staging']);

    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CE-Private-Source must not point to public history/);
  });

  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    writeFile(rootDir, 'follow-up.txt', 'release candidate fix\n');
    git(rootDir, ['add', 'follow-up.txt']);
    git(rootDir, [
      'commit',
      '--quiet',
      '-m',
      'follow-up',
      '-m',
      `CE-Private-Source: ${candidateSha}`,
    ]);
    const followUpSha = git(rootDir, ['rev-parse', 'HEAD']);
    git(rootDir, ['branch', '-M', 'release-staging']);

    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: followUpSha,
      remoteRef: 'refs/heads/release-staging',
      remoteSha: candidateSha,
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CE-Private-Source must not point to public history/);
  });
});

test('pre-push guard allows lightweight tags of fetched public commits', () => {
  withHookFixture((rootDir) => {
    const { mainSha } = createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, ['tag', 'public-snapshot', mainSha]);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/tags/public-snapshot',
      localSha: mainSha,
      remoteRef: 'refs/tags/public-snapshot',
    }));

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });
});

test('pre-push guard recognizes fetched suffixed staging history', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, ['update-ref', 'refs/remotes/origin/release-staging-refresh', candidateSha]);
    git(rootDir, ['tag', 'candidate-snapshot', candidateSha]);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/tags/candidate-snapshot',
      localSha: candidateSha,
      remoteRef: 'refs/tags/candidate-snapshot',
    }));

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });
});

test('pre-push guard blocks tags that expose private commits', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, ['tag', 'private-snapshot', candidateSha]);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/tags/private-snapshot',
      localSha: candidateSha,
      remoteRef: 'refs/tags/private-snapshot',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blocked public tag refs\/tags\/private-snapshot/);
    assert.match(result.stderr, /not reachable from fetched public history/);
  });
});

test('pre-push guard blocks annotated public tags without an override', () => {
  withHookFixture((rootDir) => {
    const { mainSha } = createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, ['tag', '-a', 'annotated-snapshot', '-m', 'release snapshot', mainSha]);
    const tagSha = git(rootDir, ['rev-parse', 'refs/tags/annotated-snapshot']);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/tags/annotated-snapshot',
      localSha: tagSha,
      remoteRef: 'refs/tags/annotated-snapshot',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blocked public tag refs\/tags\/annotated-snapshot/);
    assert.match(result.stderr, /lightweight tags are required/);
  });
});

test('pre-push guard does not override private tag validation', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, ['tag', 'private-snapshot', candidateSha]);
    const overridePath = path.join(rootDir, gitDir(rootDir), 'CE_PUSH_OVERRIDE');
    fs.writeFileSync(overridePath, 'operator-approved\n');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/tags/private-snapshot',
      localSha: candidateSha,
      remoteRef: 'refs/tags/private-snapshot',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blocked public tag refs\/tags\/private-snapshot/);
    assert.equal(fs.existsSync(overridePath), true);
  });
});

test('pre-push guard resolves HEAD and @ before authorizing a public push', () => {
  for (const localRef of ['HEAD', '@']) {
    withHookFixture((rootDir) => {
      const localSha = createCommitOnBranch(rootDir, 'dev');
      const result = runHook(rootDir, pushLine({
        localRef,
        localSha,
        remoteRef: 'refs/heads/main',
      }));

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp('Rejected ref: ' + localRef.replace('@', '\\@')));
    });

    withHookFixture((rootDir) => {
      const { mainSha } = createVersionedCandidate(rootDir, '0.1.1');
      git(rootDir, ['checkout', '--quiet', '-b', 'main', mainSha]);
      const localSha = mainSha;
      const result = runHook(rootDir, pushLine({
        localRef,
        localSha,
        remoteRef: 'refs/heads/main',
        remoteSha: mainSha,
      }));

      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
    });
  }
});

test('pre-push guard rejects raw object and detached HEAD sources', () => {
  withHookFixture((rootDir) => {
    const localSha = createCommitOnBranch(rootDir, 'main');
    const rawResult = runHook(rootDir, pushLine({
      localRef: localSha,
      localSha,
      remoteRef: 'refs/heads/main',
    }));

    assert.notEqual(rawResult.status, 0);
    assert.match(rawResult.stderr, new RegExp('Rejected ref: ' + localSha));

    git(rootDir, ['checkout', '--quiet', '--detach', localSha]);
    const detachedResult = runHook(rootDir, pushLine({
      localRef: 'HEAD',
      localSha,
      remoteRef: 'refs/heads/main',
    }));

    assert.notEqual(detachedResult.status, 0);
    assert.match(detachedResult.stderr, /Rejected ref: HEAD/);
  });
});

test('pre-push guard allows release-staging pushes to the public origin', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    git(rootDir, ['branch', '-M', 'release-staging-refresh']);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging-refresh',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging-refresh',
    }));

    assert.equal(result.status, 0);
    assert.match(result.stderr, /release version verified: 0\.1\.1/);
  });
});

test('pre-push guard allows a same-version follow-up to an existing release candidate', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    writeFile(rootDir, 'follow-up.txt', 'release candidate fix\n');
    git(rootDir, ['add', '-A']);
    const privateSourceSha = createPrivateSourceCommit(rootDir, candidateSha);
    git(rootDir, [
      'commit',
      '--quiet',
      '-m',
      'follow-up',
      '-m',
      `CE-Private-Source: ${privateSourceSha}`,
    ]);
    const followUpSha = git(rootDir, ['rev-parse', 'HEAD']);
    git(rootDir, ['branch', '-M', 'release-staging']);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: followUpSha,
      remoteRef: 'refs/heads/release-staging',
      remoteSha: candidateSha,
    }));

    assert.equal(result.status, 0);
    assert.match(result.stderr, /release version verified: 0\.1\.1/);
  });
});

test('pre-push guard validates rewritten staging from public main', () => {
  withHookFixture((rootDir) => {
    const { mainSha, candidateSha } = createVersionedCandidate(rootDir, '0.1.2');
    const candidateBranch = git(rootDir, ['symbolic-ref', '--short', 'HEAD']);
    git(rootDir, ['checkout', '--quiet', '-b', 'old-staging', mainSha]);
    writeVersionSurfaces(rootDir, '0.1.1');
    writeFile(rootDir, 'old-candidate.txt', 'old candidate\n');
    git(rootDir, ['add', '-A']);
    const privateSourceSha = createPrivateSourceCommit(rootDir, mainSha);
    git(rootDir, [
      'commit',
      '--quiet',
      '-m',
      'old candidate',
      '-m',
      `CE-Private-Source: ${privateSourceSha}`,
    ]);
    const oldCandidateSha = git(rootDir, ['rev-parse', 'HEAD']);
    git(rootDir, ['update-ref', 'refs/remotes/origin/release-staging', oldCandidateSha]);
    git(rootDir, ['checkout', '--quiet', candidateBranch]);
    git(rootDir, ['branch', '-M', 'release-staging']);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
      remoteSha: oldCandidateSha,
    }));

    assert.equal(result.status, 0);
    assert.match(result.stderr, /release version verified: 0\.1\.2/);
  });
});

test('pre-push guard blocks a version below the existing release candidate', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.2');
    writeVersionSurfaces(rootDir, '0.1.1');
    git(rootDir, ['add', '-A']);
    git(rootDir, ['commit', '--quiet', '-m', 'downgrade']);
    const downgradeSha = git(rootDir, ['rev-parse', 'HEAD']);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: downgradeSha,
      remoteRef: 'refs/heads/release-staging',
      remoteSha: candidateSha,
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Candidate version 0\.1\.1 must not be lower/);
    assert.match(result.stderr, /Blocked release-staging push/);
  });
});

test('pre-push guard blocks when the existing release candidate is unavailable', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
      remoteSha: NON_ZERO_SHA,
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Release version ref was not found/);
    assert.match(result.stderr, /Blocked release-staging push/);
  });
});

test('pre-push guard blocks release-staging versions that do not advance public main', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.0');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Candidate version 0\.1\.0 must be greater/);
    assert.match(result.stderr, /Blocked release-staging push/);
  });
});

test('pre-push guard blocks a public alias when its main baseline has no verified fallback', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }), 'public-alias');

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /public main baseline is unavailable/i);
    assert.match(result.stderr, /git fetch public-alias main:refs\/remotes\/public-alias\/main/);
  });
});

test('pre-push guard compares a public alias to a verified same-repository origin baseline', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.0');
    git(rootDir, ['remote', 'add', 'origin', '[redacted-email]-agalmic:AgalmicSoftware/context-engine.git']);
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }), 'public-alias');

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Candidate version 0\.1\.0 must be greater than refs\/remotes\/origin\/main/);
    assert.match(result.stderr, /Blocked release-staging push/);
  });
});

test('pre-push guard rejects an alias candidate that omits a newer public main', () => {
  withHookFixture((rootDir) => {
    const { mainSha, candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    const candidateBranch = git(rootDir, ['symbolic-ref', '--short', 'HEAD']);
    git(rootDir, ['checkout', '--quiet', '-b', 'newer-public-main', mainSha]);
    writeFile(rootDir, 'newer-main.txt', 'newer public main\n');
    git(rootDir, ['add', 'newer-main.txt']);
    git(rootDir, ['commit', '--quiet', '-m', 'newer public main']);
    const newerMainSha = git(rootDir, ['rev-parse', 'HEAD']);
    git(rootDir, ['update-ref', 'refs/remotes/origin/main', newerMainSha]);
    git(rootDir, ['update-ref', 'refs/remotes/public-alias/main', mainSha]);
    git(rootDir, ['remote', 'add', 'origin', '[redacted-email]-agalmic:AgalmicSoftware/context-engine.git']);
    git(rootDir, ['checkout', '--quiet', candidateBranch]);
    git(rootDir, ['branch', '-M', 'release-staging']);

    const result = runHook(
      rootDir,
      pushLine({
        localRef: 'refs/heads/release-staging',
        localSha: candidateSha,
        remoteRef: 'refs/heads/release-staging',
      }),
      'public-alias',
      'https://github.com/AgalmicSoftware/context-engine.git',
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /candidate is not descended from fetched public main/);
  });
});

test('pre-push guard enforces release floors through case-variant public aliases', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.0');
    git(rootDir, ['remote', 'add', 'origin', '[redacted-email]:agalmicsoftware/context-engine.git']);
    const result = runHook(
      rootDir,
      pushLine({
        localRef: 'refs/heads/release-staging',
        localSha: candidateSha,
        remoteRef: 'refs/heads/release-staging',
      }),
      'public-alias',
      'https://github.com/agalmicsoftware/context-engine.git',
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Candidate version 0\.1\.0 must be greater than refs\/remotes\/origin\/main/);
  });
});

test('pre-push guard blocks mismatched release version surfaces', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1', '0.1.2');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Release version surface mismatch/);
  });
});

test('pre-push guard allows remote deletions to the public origin', () => {
  withHookFixture((rootDir) => {
    const result = runHook(rootDir, pushLine({
      localRef: '(delete)',
      localSha: ZERO_SHA,
      remoteRef: 'refs/heads/dev',
      remoteSha: NON_ZERO_SHA,
    }));

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });
});

test('pre-push guard blocks deleting public main without an override', () => {
  withHookFixture((rootDir) => {
    const result = runHook(rootDir, pushLine({
      localRef: '(delete)',
      localSha: ZERO_SHA,
      remoteRef: 'refs/heads/main',
      remoteSha: NON_ZERO_SHA,
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Rejected ref: refs\/heads\/main/);
  });
});

test('pre-push guard does not override public main deletion', () => {
  withHookFixture((rootDir) => {
    const overridePath = path.join(rootDir, gitDir(rootDir), 'CE_PUSH_OVERRIDE');
    fs.writeFileSync(overridePath, 'operator-approved\n');
    const result = runHook(rootDir, pushLine({
      localRef: '(delete)',
      localSha: ZERO_SHA,
      remoteRef: 'refs/heads/main',
      remoteSha: NON_ZERO_SHA,
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Rejected ref: refs\/heads\/main/);
    assert.equal(fs.existsSync(overridePath), true);
  });
});

test('pre-push guard honors and consumes the one-shot override file', () => {
  withHookFixture((rootDir) => {
    const overridePath = path.join(rootDir, gitDir(rootDir), 'CE_PUSH_OVERRIDE');
    fs.writeFileSync(overridePath, 'operator-approved\n');

    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/dev',
      remoteRef: 'refs/heads/dev',
    }));

    assert.equal(result.status, 0);
    assert.match(result.stderr, /warning: consumed one-time CE push override for origin\./);
    assert.equal(fs.existsSync(overridePath), false);
  });
});
