'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const INSTALLER_SOURCE_PATH = path.join(__dirname, 'install-private-branch-guard.sh');
const PRE_PUSH_SOURCE_PATH = path.join(__dirname, '..', '.githooks', 'pre-push');
const TEST_TMP_ROOT = path.join(__dirname, '.tmp-install-private-branch-guard-tests');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function git(rootDir, args, options = {}) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    ...options,
  });
}

function installFixture(sourceDir) {
  writeFile(
    sourceDir,
    path.join('scripts', 'install-private-branch-guard.sh'),
    fs.readFileSync(INSTALLER_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('.githooks', 'pre-push'),
    fs.readFileSync(PRE_PUSH_SOURCE_PATH, 'utf8'),
  );
  fs.chmodSync(path.join(sourceDir, 'scripts', 'install-private-branch-guard.sh'), 0o755);
  fs.chmodSync(path.join(sourceDir, '.githooks', 'pre-push'), 0o755);
}

function setupSourceRepo() {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(TEST_TMP_ROOT, 'ce-install-private-branch-guard-'));
  const remoteDir = path.join(tempRoot, 'origin.git');
  const sourceDir = path.join(tempRoot, 'source');

  try {
    git(tempRoot, ['init', '--bare', '--initial-branch=main', remoteDir], { stdio: 'ignore' });
    git(tempRoot, ['clone', remoteDir, sourceDir], { stdio: 'ignore' });
    git(sourceDir, ['config', 'user.name', 'Private Dev'], { stdio: 'ignore' });
    git(sourceDir, ['config', 'user.email', 'private@example.com'], { stdio: 'ignore' });

    installFixture(sourceDir);

    writeFile(sourceDir, 'README.md', 'base\n');
    git(sourceDir, ['add', 'README.md'], { stdio: 'ignore' });
    git(sourceDir, ['commit', '--quiet', '-m', 'Initial public base'], { stdio: 'ignore' });
    git(sourceDir, ['push', '--quiet', '-u', 'origin', 'main']);

    git(sourceDir, ['checkout', '--quiet', '-b', 'dev']);
    writeFile(sourceDir, 'private.txt', 'private\n');
    git(sourceDir, ['add', 'private.txt'], { stdio: 'ignore' });
    git(sourceDir, ['commit', '--quiet', '-m', 'Private dev commit'], { stdio: 'ignore' });
    git(sourceDir, ['branch', '--set-upstream-to=origin/main', 'dev'], { stdio: 'ignore' });

    return {
      tempRoot,
      remoteDir,
      sourceDir,
    };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function withSourceRepo(run) {
  const repo = setupSourceRepo();
  try {
    return run(repo);
  } finally {
    fs.rmSync(repo.tempRoot, { recursive: true, force: true });
  }
}

function runInstaller(sourceDir) {
  return spawnSync('bash', [path.join(sourceDir, 'scripts', 'install-private-branch-guard.sh')], {
    cwd: sourceDir,
    encoding: 'utf8',
  });
}

function seedRemoteBranch(sourceDir, branchName) {
  git(sourceDir, ['push', '--quiet', '--no-verify', 'origin', `${branchName}:refs/heads/${branchName}`]);
}

test('installer configures repo-local hooks and unsets the dev upstream', () => {
  withSourceRepo(({ sourceDir }) => {
    const result = runInstaller(sourceDir);

    assert.equal(result.status, 0);
    assert.equal(git(sourceDir, ['config', '--local', '--get', 'core.hooksPath']).trim(), '.githooks');

    const upstreamResult = spawnSync(
      'git',
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', 'dev@{upstream}'],
      {
        cwd: sourceDir,
        encoding: 'utf8',
      },
    );
    assert.notEqual(upstreamResult.status, 0);
    assert.match(result.stdout, /Unset upstream for local dev\./);
  });
});

test('installed pre-push hook blocks publishing dev to origin', () => {
  withSourceRepo(({ sourceDir }) => {
    const installResult = runInstaller(sourceDir);
    assert.equal(installResult.status, 0);

    const pushResult = spawnSync('git', ['push', '-u', 'origin', 'dev'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });

    assert.notEqual(pushResult.status, 0);
    assert.match(`${pushResult.stderr}${pushResult.stdout}`, /Blocked push to public Context Engine remote origin\./);
    assert.doesNotMatch(`${pushResult.stderr}${pushResult.stdout}`, /CE_ALLOW_PRIVATE_BRANCH_PUSH/);
    assert.equal(git(sourceDir, ['ls-remote', '--heads', 'origin', 'dev']).trim(), '');
  });
});

test('installed pre-push hook does not honor the old private branch bypass env var', () => {
  withSourceRepo(({ sourceDir }) => {
    const installResult = runInstaller(sourceDir);
    assert.equal(installResult.status, 0);

    const pushResult = spawnSync('git', ['push', '-u', 'origin', 'dev'], {
      cwd: sourceDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        CE_ALLOW_PRIVATE_BRANCH_PUSH: '1',
      },
    });

    assert.notEqual(pushResult.status, 0);
    assert.match(`${pushResult.stderr}${pushResult.stdout}`, /Blocked push to public Context Engine remote origin\./);
    assert.equal(git(sourceDir, ['ls-remote', '--heads', 'origin', 'dev']).trim(), '');
  });
});

test('installed pre-push hook blocks publishing codex agent branches to origin', () => {
  withSourceRepo(({ sourceDir }) => {
    const installResult = runInstaller(sourceDir);
    assert.equal(installResult.status, 0);
    git(sourceDir, ['checkout', '--quiet', '-b', 'codex/private-agent-branch']);

    const pushResult = spawnSync('git', ['push', '-u', 'origin', 'codex/private-agent-branch'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });

    assert.notEqual(pushResult.status, 0);
    assert.match(`${pushResult.stderr}${pushResult.stdout}`, /Blocked push to public Context Engine remote origin\./);
    assert.equal(git(sourceDir, ['ls-remote', '--heads', 'origin', 'codex/private-agent-branch']).trim(), '');
  });
});

test('installed pre-push hook blocks publishing edge branches to origin', () => {
  withSourceRepo(({ sourceDir }) => {
    const installResult = runInstaller(sourceDir);
    assert.equal(installResult.status, 0);
    git(sourceDir, ['checkout', '--quiet', '-b', 'edge-2026']);

    const pushResult = spawnSync('git', ['push', '-u', 'origin', 'edge-2026'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });

    assert.notEqual(pushResult.status, 0);
    assert.match(`${pushResult.stderr}${pushResult.stdout}`, /Blocked push to public Context Engine remote origin\./);
    assert.equal(git(sourceDir, ['ls-remote', '--heads', 'origin', 'edge-2026']).trim(), '');
  });
});

test('installed pre-push hook blocks publishing dev to matching public remotes even when they are not named origin', () => {
  withSourceRepo(({ sourceDir }) => {
    const installResult = runInstaller(sourceDir);
    assert.equal(installResult.status, 0);

    const hookResult = spawnSync('bash', [path.join(sourceDir, '.githooks', 'pre-push'), 'public', 'git@github.com-agalmic:AgalmicSoftware/context-engine.git'], {
      cwd: sourceDir,
      encoding: 'utf8',
      input: 'refs/heads/dev 1111111111111111111111111111111111111111 refs/heads/dev 0000000000000000000000000000000000000000\n',
    });

    assert.notEqual(hookResult.status, 0);
    assert.match(`${hookResult.stderr}${hookResult.stdout}`, /Blocked push to public Context Engine remote public\./);
  });
});

test('installed pre-push hook still allows deleting a remote dev branch', () => {
  withSourceRepo(({ sourceDir }) => {
    const installResult = runInstaller(sourceDir);
    assert.equal(installResult.status, 0);
    seedRemoteBranch(sourceDir, 'dev');

    const deleteResult = spawnSync('git', ['push', 'origin', '--delete', 'dev'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });

    assert.equal(deleteResult.status, 0);
    assert.equal(git(sourceDir, ['ls-remote', '--heads', 'origin', 'dev']).trim(), '');
  });
});
