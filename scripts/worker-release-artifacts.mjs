import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const MANIFEST_FILE = 'worker-release-manifest.json';
export const MANIFEST_SCHEMA_VERSION = 1;
export const ARTIFACT_SET = 'context-engine-worker-bundles';
export const BUILD_RECIPE = Object.freeze({
  id: 'context-engine-worker-bundle',
  version: 1,
  commands: [
    'npm ci',
    'npm --prefix workers/sessionCorsWorker ci',
    'npm run worker:bundle',
  ],
});
export const LOCKFILES = Object.freeze([
  'package-lock.json',
  'client/package-lock.json',
  'workers/sessionCorsWorker/package-lock.json',
]);
export const WORKER_ARTIFACTS = Object.freeze([
  Object.freeze({ kind: 'session-cors-worker', file: 'sessionCorsWorker.bundle.js' }),
  Object.freeze({ kind: 'deploy-helper', file: 'deployHelper.bundle.js' }),
  Object.freeze({ kind: 'agent-bridge-worker', file: 'agentBridgeWorker.bundle.js' }),
]);

const PUBLIC_PII_SCANNER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'verify-public-release-pii.sh',
);
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_REF_PATTERN = /^refs\/heads\/[A-Za-z0-9._/-]+$/;
const PUBLIC_GIT_NAME = 'Agalmic';
const PUBLIC_GIT_EMAIL = 'agalmicsoftware@protonmail.com';
const LEGACY_PUBLIC_SOURCE_MAPPINGS = Object.freeze({
  // PR #30 was prepared from this audited private source immediately before
  // CE-Private-Source trailers became mandatory for Worker artifact CI. A
  // fresh stripped artifact differs only by an untracked empty directory.
  '974dc394a19c420dd6cfcfb5f88499330408a92d': '48f5182922c87505c963edc9d0e3fd2c7e1ca8c7',
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} has unexpected fields: ${actual.join(', ')}`);
}

function assertSha(value, label) {
  assert(SHA_PATTERN.test(String(value || '')), `${label} must be a full lowercase commit SHA`);
}

function assertPositiveIntegerString(value, label) {
  assert(/^[1-9][0-9]*$/.test(String(value || '')), `${label} must be a positive integer`);
}

export function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function assertRegularFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular file`);
  return stat;
}

export function stageWorkerArtifacts({ distDir, outputDir }) {
  fs.mkdirSync(outputDir, { recursive: true });
  assert(fs.readdirSync(outputDir).length === 0, `artifact staging directory must be empty: ${outputDir}`);

  for (const artifact of WORKER_ARTIFACTS) {
    const sourcePath = path.join(distDir, artifact.file);
    assertRegularFile(sourcePath, artifact.file);
    fs.copyFileSync(sourcePath, path.join(outputDir, artifact.file), fs.constants.COPYFILE_EXCL);
  }
}

function dependencyLockRecords(rootDir) {
  return LOCKFILES.map((relativePath) => {
    const filePath = path.join(rootDir, relativePath);
    const stat = assertRegularFile(filePath, relativePath);
    return { path: relativePath, bytes: stat.size, sha256: sha256File(filePath) };
  });
}

function artifactRecords(artifactDir) {
  return WORKER_ARTIFACTS.map(({ kind, file }) => {
    const filePath = path.join(artifactDir, file);
    const stat = assertRegularFile(filePath, file);
    return { kind, file, bytes: stat.size, sha256: sha256File(filePath) };
  });
}

export function createWorkerReleaseManifest({
  rootDir,
  artifactDir,
  sourceCommit,
  sourceRef,
  sourceTree,
  repository,
  privateSourceCommit,
  publicReplayCommit,
  workflow,
  workflowRef,
  runId,
  runAttempt,
  npmVersion,
}) {
  assertSha(sourceCommit, 'source commit');
  assertSha(sourceTree, 'source tree');
  assertSha(privateSourceCommit, 'private source commit');
  assertSha(publicReplayCommit, 'public replay commit');
  assert(SAFE_REF_PATTERN.test(sourceRef), 'source ref must be a full branch ref');
  assert(typeof repository === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'repository is invalid');
  assert(typeof workflow === 'string' && workflow.length > 0, 'workflow is required');
  assert(typeof workflowRef === 'string' && workflowRef.includes('@'), 'workflow ref must include its source ref');
  assertPositiveIntegerString(runId, 'run id');
  assertPositiveIntegerString(runAttempt, 'run attempt');
  assert(typeof npmVersion === 'string' && /^\d+\.\d+\.\d+/.test(npmVersion), 'npm version is invalid');

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    artifactSet: ARTIFACT_SET,
    source: { repository, commit: sourceCommit, ref: sourceRef, tree: sourceTree },
    replay: {
      mapping: 'private-source-to-public-replay-v1',
      privateSourceCommit,
      publicReplayCommit,
      publicCommit: sourceCommit,
      publicTree: sourceTree,
    },
    builder: { workflow, workflowRef, runId: String(runId), runAttempt: String(runAttempt) },
    recipe: {
      ...BUILD_RECIPE,
      nodeVersion: process.version,
      npmVersion,
      dependencyLocks: dependencyLockRecords(rootDir),
    },
    artifacts: artifactRecords(artifactDir),
  };

  fs.writeFileSync(path.join(artifactDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o644,
  });
  return manifest;
}

function validateDigestRecords(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array`);
  assert(actual.length === expected.length, `${label} count mismatch`);
  for (let index = 0; index < expected.length; index += 1) {
    const record = actual[index];
    assertExactKeys(record, Object.keys(expected[index]), `${label}[${index}]`);
    for (const [key, value] of Object.entries(expected[index])) {
      assert(record[key] === value, `${label}[${index}].${key} mismatch`);
    }
  }
}

export function verifyWorkerReleaseArtifact({
  rootDir,
  artifactDir,
  expectedSourceCommit,
  expectedSourceRef,
  expectedSourceTree,
  expectedRepository,
  expectedWorkflow,
  expectedRunId,
  expectedRunAttempt,
}) {
  const manifestPath = path.join(artifactDir, MANIFEST_FILE);
  assertRegularFile(manifestPath, MANIFEST_FILE);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assertExactKeys(manifest, ['schemaVersion', 'artifactSet', 'source', 'replay', 'builder', 'recipe', 'artifacts'], 'manifest');
  assert(manifest.schemaVersion === MANIFEST_SCHEMA_VERSION, 'manifest schema version mismatch');
  assert(manifest.artifactSet === ARTIFACT_SET, 'artifact set mismatch');

  assertExactKeys(manifest.source, ['repository', 'commit', 'ref', 'tree'], 'source');
  assertSha(manifest.source.commit, 'source commit');
  assertSha(manifest.source.tree, 'source tree');
  assert(SAFE_REF_PATTERN.test(manifest.source.ref), 'manifest source ref is invalid');
  assert(manifest.source.commit === expectedSourceCommit, 'source commit mismatch');
  assert(manifest.source.ref === expectedSourceRef, 'source ref mismatch');
  assert(manifest.source.tree === expectedSourceTree, 'source tree mismatch');
  assert(manifest.source.repository === expectedRepository, 'source repository mismatch');

  assertExactKeys(
    manifest.replay,
    ['mapping', 'privateSourceCommit', 'publicReplayCommit', 'publicCommit', 'publicTree'],
    'replay',
  );
  assert(manifest.replay.mapping === 'private-source-to-public-replay-v1', 'replay mapping version mismatch');
  assertSha(manifest.replay.privateSourceCommit, 'private source commit');
  assertSha(manifest.replay.publicReplayCommit, 'public replay commit');
  assert(manifest.replay.publicCommit === manifest.source.commit, 'replay public commit mismatch');
  assert(manifest.replay.publicTree === manifest.source.tree, 'replay public tree mismatch');

  assertExactKeys(manifest.builder, ['workflow', 'workflowRef', 'runId', 'runAttempt'], 'builder');
  assert(manifest.builder.workflow === expectedWorkflow, 'builder workflow mismatch');
  assert(
    manifest.builder.workflowRef === `${expectedRepository}/.github/workflows/ci.yml@${expectedSourceRef}`,
    'builder workflow ref mismatch',
  );
  assert(manifest.builder.runId === String(expectedRunId), 'builder run id mismatch');
  assert(manifest.builder.runAttempt === String(expectedRunAttempt), 'builder run attempt mismatch');
  assertPositiveIntegerString(manifest.builder.runAttempt, 'builder run attempt');

  assertExactKeys(
    manifest.recipe,
    ['id', 'version', 'commands', 'nodeVersion', 'npmVersion', 'dependencyLocks'],
    'recipe',
  );
  assert(manifest.recipe.id === BUILD_RECIPE.id, 'build recipe id mismatch');
  assert(manifest.recipe.version === BUILD_RECIPE.version, 'build recipe version mismatch');
  assert(JSON.stringify(manifest.recipe.commands) === JSON.stringify(BUILD_RECIPE.commands), 'build recipe commands mismatch');
  assert(/^v\d+\.\d+\.\d+/.test(manifest.recipe.nodeVersion), 'builder Node version is invalid');
  assert(/^\d+\.\d+\.\d+/.test(manifest.recipe.npmVersion), 'builder npm version is invalid');
  validateDigestRecords(manifest.recipe.dependencyLocks, dependencyLockRecords(rootDir), 'dependency locks');
  validateDigestRecords(manifest.artifacts, artifactRecords(artifactDir), 'artifacts');

  const expectedFiles = [...WORKER_ARTIFACTS.map(({ file }) => file), MANIFEST_FILE].sort();
  const actualFiles = fs.readdirSync(artifactDir).sort();
  assert(JSON.stringify(actualFiles) === JSON.stringify(expectedFiles), `artifact archive structure mismatch: ${actualFiles.join(', ')}`);
  if (fs.existsSync(path.join(rootDir, '.git'))) {
    const resolved = resolveSourceProvenance({ rootDir, commit: expectedSourceCommit });
    assert(resolved.sourceTree === manifest.source.tree, 'checked-out source tree mismatch');
    assert(resolved.privateSourceCommit === manifest.replay.privateSourceCommit, 'private source replay mismatch');
    assert(resolved.publicReplayCommit === manifest.replay.publicReplayCommit, 'public replay commit mismatch');
  }
  return manifest;
}

function git(rootDir, args) {
  return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim();
}

function privateSourceTrailer(rootDir, commit) {
  return git(rootDir, ['show', '-s', '--format=%(trailers:key=CE-Private-Source,valueonly)', commit]);
}

function commitIsReachableFrom(rootDir, commit, ref) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, ref], {
      cwd: rootDir,
      stdio: 'ignore',
    });
    return true;
  } catch (_) {
    return false;
  }
}

function fetchedPublicHistoryRefs(rootDir) {
  return git(rootDir, [
    'for-each-ref',
    '--format=%(refname)',
    'refs/heads/main',
    'refs/heads/release-staging*',
    'refs/remotes/*/main',
    'refs/remotes/*/release-staging*',
    'refs/tags/*',
  ]).split(/\s+/).filter(Boolean);
}

function assertPrivateSourceIsNotPublic(rootDir, privateSourceCommit, replayCommit, candidateCommit) {
  assert(
    privateSourceCommit !== replayCommit && privateSourceCommit !== candidateCommit,
    `commit ${replayCommit} CE-Private-Source must not point to public history`,
  );

  let resolvedSourceCommit = '';
  try {
    resolvedSourceCommit = execFileSync(
      'git',
      ['rev-parse', '--verify', `${privateSourceCommit}^{commit}`],
      { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch (_) {
    return;
  }
  assert(
    resolvedSourceCommit === privateSourceCommit,
    `commit ${replayCommit} CE-Private-Source must identify a commit`,
  );

  const publicRefs = new Set([replayCommit, candidateCommit, ...fetchedPublicHistoryRefs(rootDir)]);
  assert(
    ![...publicRefs].some((ref) => commitIsReachableFrom(rootDir, privateSourceCommit, ref)),
    `commit ${replayCommit} CE-Private-Source must not point to public history`,
  );
}

export function verifyPublicReplayRange({ rootDir, baseRef, candidateRef }) {
  const baseCommit = git(rootDir, ['rev-parse', '--verify', `${baseRef}^{commit}`]);
  const candidateCommit = git(rootDir, ['rev-parse', '--verify', `${candidateRef}^{commit}`]);
  assertSha(baseCommit, 'public replay base commit');
  assertSha(candidateCommit, 'public replay candidate commit');
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', baseCommit, candidateCommit], {
      cwd: rootDir,
      stdio: 'ignore',
    });
  } catch (_) {
    throw new Error('public replay candidate is not descended from its public main baseline');
  }

  const replayCommits = git(rootDir, ['rev-list', '--reverse', `${baseCommit}..${candidateCommit}`])
    .split(/\s+/)
    .filter(Boolean);
  for (const replayCommit of replayCommits) {
    const parentLine = git(rootDir, ['rev-list', '--parents', '-n', '1', replayCommit]).split(/\s+/);
    assert(parentLine.length === 2, `commit ${replayCommit} is not a linear public replay`);
    const authorName = git(rootDir, ['show', '-s', '--format=%an', replayCommit]);
    const authorEmail = git(rootDir, ['show', '-s', '--format=%ae', replayCommit]);
    const committerName = git(rootDir, ['show', '-s', '--format=%cn', replayCommit]);
    const committerEmail = git(rootDir, ['show', '-s', '--format=%ce', replayCommit]);
    assert(
      authorName === PUBLIC_GIT_NAME &&
        authorEmail === PUBLIC_GIT_EMAIL &&
        committerName === PUBLIC_GIT_NAME &&
        committerEmail === PUBLIC_GIT_EMAIL,
      `commit ${replayCommit} lacks the required public replay author and committer identity`,
    );
    const privateSourceCommit = privateSourceTrailer(rootDir, replayCommit);
    assert(
      SHA_PATTERN.test(privateSourceCommit),
      `commit ${replayCommit} lacks one valid CE-Private-Source trailer`,
    );
    assertPrivateSourceIsNotPublic(rootDir, privateSourceCommit, replayCommit, candidateCommit);
  }

  try {
    execFileSync(
      'bash',
      [PUBLIC_PII_SCANNER, '--git-range', rootDir, baseCommit, candidateCommit],
      {
        cwd: rootDir,
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } catch (error) {
    const detail = String(error?.stderr || error?.message || '').trim();
    throw new Error(detail || 'public release PII scan failed');
  }

  return { baseCommit, candidateCommit, replayCommitCount: replayCommits.length };
}

export function resolvePrivateSourceReference({ publicCommit, trailer }) {
  const explicitTrailer = String(trailer || '').trim();
  if (explicitTrailer) return explicitTrailer;
  return LEGACY_PUBLIC_SOURCE_MAPPINGS[publicCommit] || '';
}

export function resolveSourceProvenance({ rootDir, commit }) {
  assertSha(commit, 'source commit');
  const resolvedCommit = git(rootDir, ['rev-parse', commit]);
  assert(resolvedCommit === commit, 'source commit did not resolve exactly');
  const sourceTree = git(rootDir, ['rev-parse', `${commit}^{tree}`]);
  const parentLine = git(rootDir, ['rev-list', '--parents', '-n', '1', commit]).split(/\s+/);
  const parents = parentLine.slice(1);
  assert(
    parents.length <= 2,
    `source commit ${commit} must have at most one parent or exactly two merge parents`,
  );

  const isMainMerge = parents.length === 2;
  const publicReplayCommit = isMainMerge ? parents[1] : commit;
  if (isMainMerge) {
    assert(
      commitIsReachableFrom(rootDir, parents[0], publicReplayCommit),
      `source merge ${commit} candidate must descend from its first parent`,
    );
    assert(
      sourceTree === git(rootDir, ['rev-parse', `${publicReplayCommit}^{tree}`]),
      `source merge ${commit} tree must match its candidate tree`,
    );
  }

  const privateSourceCommit = resolvePrivateSourceReference({
    publicCommit: publicReplayCommit,
    trailer: privateSourceTrailer(rootDir, publicReplayCommit),
  });

  assertSha(privateSourceCommit, 'CE-Private-Source trailer');
  assertSha(publicReplayCommit, 'public replay commit');
  assertPrivateSourceIsNotPublic(rootDir, privateSourceCommit, publicReplayCommit, commit);
  return { sourceCommit: commit, sourceTree, privateSourceCommit, publicReplayCommit };
}

export function validateSuccessfulCiRun(run, { repository }) {
  assert(run && typeof run === 'object', 'workflow run metadata must be an object');
  assert(run.name === 'CI', 'workflow run name mismatch');
  assert(run.path === '.github/workflows/ci.yml', 'workflow run path mismatch');
  assert(run.status === 'completed', 'workflow run is not completed');
  assert(run.conclusion === 'success', 'workflow run did not succeed');
  assert(run.event === 'push', 'workflow run must originate from a push');
  assert(['main', 'master'].includes(run.head_branch), 'workflow run branch is not releasable');
  assert(run.head_repository?.full_name === repository, 'workflow run repository mismatch');
  assertSha(run.head_sha, 'workflow run head SHA');
  assertPositiveIntegerString(run.id, 'workflow run id');
  assertPositiveIntegerString(run.run_attempt, 'workflow run attempt');
  return {
    sourceCommit: run.head_sha,
    sourceRef: `refs/heads/${run.head_branch}`,
    runId: String(run.id),
    runAttempt: String(run.run_attempt),
  };
}

export function planStablePromotion({ targetCommit, currentCommit, previousCommit }) {
  assertSha(targetCommit, 'promotion target commit');
  if (currentCommit) assertSha(currentCommit, 'current stable commit');
  if (previousCommit) assertSha(previousCommit, 'previous stable commit');
  return {
    promotionChanged: currentCommit !== targetCommit ? 'true' : 'false',
    stableCommit: targetCommit,
    previousCommit: currentCommit && currentCommit !== targetCommit
      ? currentCommit
      : previousCommit || currentCommit || targetCommit,
  };
}

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    assert(key.startsWith('--'), `unknown argument: ${key}`);
    const value = args[index + 1];
    assert(value && !value.startsWith('--'), `missing value for ${key}`);
    values[key.slice(2)] = value;
    index += 1;
  }
  return values;
}

function requireArgs(values, names) {
  for (const name of names) assert(values[name], `--${name} is required`);
}

function writeGithubOutputs(values, outputPath) {
  assert(outputPath, '--github-output is required');
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
}

function runCli(argv) {
  const [command, ...rest] = argv;
  const values = parseArgs(rest);
  const rootDir = path.resolve(values.root || '.');

  if (command === 'stage') {
    requireArgs(values, ['dist', 'output']);
    stageWorkerArtifacts({ distDir: path.resolve(values.dist), outputDir: path.resolve(values.output) });
    return;
  }
  if (command === 'resolve-source') {
    requireArgs(values, ['commit', 'github-output']);
    const result = resolveSourceProvenance({ rootDir, commit: values.commit });
    writeGithubOutputs(result, values['github-output']);
    return;
  }
  if (command === 'verify-replay-range') {
    requireArgs(values, ['base-ref', 'candidate-ref']);
    const result = verifyPublicReplayRange({
      rootDir,
      baseRef: values['base-ref'],
      candidateRef: values['candidate-ref'],
    });
    console.log(`public replay history verified (${result.replayCommitCount} commits)`);
    return;
  }
  if (command === 'validate-run') {
    requireArgs(values, ['run-json', 'repository', 'github-output']);
    const run = JSON.parse(fs.readFileSync(path.resolve(values['run-json']), 'utf8'));
    writeGithubOutputs(validateSuccessfulCiRun(run, { repository: values.repository }), values['github-output']);
    return;
  }
  if (command === 'plan-promotion') {
    requireArgs(values, ['target-commit', 'github-output']);
    const result = planStablePromotion({
      targetCommit: values['target-commit'],
      currentCommit: values['current-commit'] === 'none' ? '' : values['current-commit'],
      previousCommit: values['previous-commit'] === 'none' ? '' : values['previous-commit'],
    });
    writeGithubOutputs(result, values['github-output']);
    return;
  }
  if (command === 'create') {
    requireArgs(values, [
      'artifact-dir', 'source-commit', 'source-ref', 'source-tree', 'repository', 'private-source-commit',
      'public-replay-commit', 'workflow', 'workflow-ref', 'run-id', 'run-attempt', 'npm-version',
    ]);
    createWorkerReleaseManifest({
      rootDir,
      artifactDir: path.resolve(values['artifact-dir']),
      sourceCommit: values['source-commit'],
      sourceRef: values['source-ref'],
      sourceTree: values['source-tree'],
      repository: values.repository,
      privateSourceCommit: values['private-source-commit'],
      publicReplayCommit: values['public-replay-commit'],
      workflow: values.workflow,
      workflowRef: values['workflow-ref'],
      runId: values['run-id'],
      runAttempt: values['run-attempt'],
      npmVersion: values['npm-version'],
    });
    return;
  }
  if (command === 'verify') {
    requireArgs(values, [
      'artifact-dir', 'source-commit', 'source-ref', 'source-tree', 'repository', 'workflow', 'run-id', 'run-attempt',
    ]);
    verifyWorkerReleaseArtifact({
      rootDir,
      artifactDir: path.resolve(values['artifact-dir']),
      expectedSourceCommit: values['source-commit'],
      expectedSourceRef: values['source-ref'],
      expectedSourceTree: values['source-tree'],
      expectedRepository: values.repository,
      expectedWorkflow: values.workflow,
      expectedRunId: values['run-id'],
      expectedRunAttempt: values['run-attempt'],
    });
    return;
  }
  throw new Error(`unknown command: ${command || '(missing)'}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`worker release artifact check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
