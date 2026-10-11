#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STABLE_VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const VERSION_SURFACE_PATHS = [
  'package.json',
  'package-lock.json',
  'client/package.json',
  'client/package-lock.json',
];

const parseVersion = (value) => {
  const normalized = String(value || '').trim();
  const match = normalized.match(STABLE_VERSION_RE);
  if (!match) {
    throw new Error(`Expected stable MAJOR.MINOR.PATCH version, received: ${normalized || '<empty>'}`);
  }
  return {
    value: normalized,
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
  };
};

export const compareVersions = (left, right) => {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
};

export const incrementPatch = (version) => {
  const parsed = parseVersion(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1n}`;
};

const releaseLevelBetween = (baselineVersion, nextVersion) => {
  const baseline = parseVersion(baselineVersion);
  const next = parseVersion(nextVersion);
  if (compareVersions(next.value, baseline.value) <= 0) {
    throw new Error(`Release version ${next.value} must be greater than baseline ${baseline.value}`);
  }

  if (next.major !== baseline.major) {
    if (next.major !== baseline.major + 1n || next.minor !== 0n || next.patch !== 0n) {
      throw new Error('Explicit major releases must increment major once and reset minor and patch to zero');
    }
    return 'major';
  }

  if (next.minor !== baseline.minor) {
    if (next.minor !== baseline.minor + 1n || next.patch !== 0n) {
      throw new Error('Explicit minor releases must increment minor once and reset patch to zero');
    }
    return 'minor';
  }

  return 'patch';
};

export const planReleaseVersion = ({
  mainVersion,
  stagingVersion = null,
  explicitVersion = null,
}) => {
  parseVersion(mainVersion);
  if (stagingVersion) parseVersion(stagingVersion);
  const baselineVersion = stagingVersion && compareVersions(stagingVersion, mainVersion) > 0
    ? stagingVersion
    : mainVersion;
  const nextVersion = explicitVersion || incrementPatch(baselineVersion);
  const releaseLevel = releaseLevelBetween(baselineVersion, nextVersion);

  return {
    baselineVersion,
    nextVersion,
    releaseLevel,
  };
};

const majorPathRules = [
  {
    pattern: /^contracts\/.*\.sol$/i,
    reason: 'public smart-contract source changed',
  },
  {
    pattern: /^client\/src\/contractsABI\//i,
    reason: 'public contract ABI changed',
  },
  {
    pattern: /^client\/src\/utilities\/crypto\/(?:cryptography|.*(?:envelope|schema))/i,
    reason: 'persisted encryption envelope/schema surface changed',
  },
  {
    pattern: /^workers\/[^/]+\/.*(?:schema|migration|storage-format)/i,
    reason: 'worker storage/schema compatibility surface changed',
  },
];

export const assessReleaseImpact = ({ paths = [], subjects = [] } = {}) => {
  const normalizedPaths = [...new Set(paths.map((entry) => String(entry || '').trim()).filter(Boolean))].sort();
  const normalizedSubjects = subjects.map((entry) => String(entry || '').trim()).filter(Boolean);
  const reasons = [];

  normalizedSubjects.forEach((subject) => {
    if (/^[a-z]+(?:\([^)]*\))?!:/i.test(subject) || /BREAKING[ -]CHANGE/i.test(subject)) {
      reasons.push(`breaking-change commit signal: ${subject}`);
    }
  });
  normalizedPaths.forEach((changedPath) => {
    const rule = majorPathRules.find(({ pattern }) => pattern.test(changedPath));
    if (rule) reasons.push(`${rule.reason}: ${changedPath}`);
  });
  if (reasons.length) {
    return { level: 'major', reasons: [...new Set(reasons)] };
  }

  normalizedSubjects.forEach((subject) => {
    if (/^feat(?:\([^)]*\))?:/i.test(subject)) {
      reasons.push(`backward-compatible feature commit: ${subject}`);
    }
  });
  if (reasons.length) {
    return { level: 'minor', reasons: [...new Set(reasons)] };
  }

  return {
    level: 'patch',
    reasons: ['no breaking-change or feature signal detected in the public change set'],
  };
};

const parseSurfaceJson = (contentsByPath) => {
  const parsed = Object.fromEntries(
    VERSION_SURFACE_PATHS.map((relativePath) => {
      const contents = contentsByPath[relativePath];
      if (typeof contents !== 'string') {
        throw new Error(`Missing release version surface: ${relativePath}`);
      }
      try {
        return [relativePath, JSON.parse(contents)];
      } catch (error) {
        throw new Error(`Invalid JSON in release version surface ${relativePath}: ${error.message}`);
      }
    }),
  );

  const surfaces = {
    'package.json': parsed['package.json'].version,
    'package-lock.json': parsed['package-lock.json'].version,
    'client/package.json': parsed['client/package.json'].version,
    'client/package-lock.json': parsed['client/package-lock.json'].version,
  };
  const lockRoots = {
    'package-lock.json#packages[""]': parsed['package-lock.json'].packages?.['']?.version,
    'client/package-lock.json#packages[""]': parsed['client/package-lock.json'].packages?.['']?.version,
  };
  const canonicalVersion = surfaces['package.json'];
  parseVersion(canonicalVersion);

  for (const [surface, version] of Object.entries({ ...surfaces, ...lockRoots })) {
    parseVersion(version);
    if (version !== canonicalVersion) {
      throw new Error(
        `Release version surface mismatch: ${surface} is ${version}, expected ${canonicalVersion}`,
      );
    }
  }

  return {
    version: canonicalVersion,
    surfaces,
  };
};

export const readVersionSurfaces = (rootDir) => {
  const contentsByPath = Object.fromEntries(
    VERSION_SURFACE_PATHS.map((relativePath) => [
      relativePath,
      fs.readFileSync(path.join(rootDir, relativePath), 'utf8'),
    ]),
  );
  return parseSurfaceJson(contentsByPath);
};

export const writeVersionSurfaces = (rootDir, version) => {
  parseVersion(version);
  for (const relativePath of VERSION_SURFACE_PATHS) {
    const absolutePath = path.join(rootDir, relativePath);
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    parsed.version = version;
    if (relativePath.endsWith('package-lock.json')) {
      if (!parsed.packages?.['']) {
        throw new Error(`Package lock is missing packages[""]: ${relativePath}`);
      }
      parsed.packages[''].version = version;
    }
    fs.writeFileSync(absolutePath, `${JSON.stringify(parsed, null, 2)}\n`);
  }
  return readVersionSurfaces(rootDir);
};

const git = (repoRoot, args) => execFileSync('git', args, {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

const refExists = (repoRoot, ref) => {
  try {
    git(repoRoot, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
};

export const readVersionAtRef = (repoRoot, ref) => {
  if (!refExists(repoRoot, ref)) {
    throw new Error(`Release version ref was not found: ${ref}`);
  }
  const contentsByPath = Object.fromEntries(
    VERSION_SURFACE_PATHS.map((relativePath) => [
      relativePath,
      git(repoRoot, ['show', `${ref}:${relativePath}`]),
    ]),
  );
  return parseSurfaceJson(contentsByPath);
};

// Worker release pin. Builds without COMMIT_REF (local and self-hosted
// clients) and the deploy-helper CLI deploy the release pinned here. A
// release's own Worker bundles are published only after its public merge,
// so each release pins the newest published one, and preparing a release
// fails while a newer published release ships different Worker code.
export const WORKER_RELEASE_PIN_PATH = 'client/src/variables/workerReleasePin.json';
const DEPLOY_HELPER_EXAMPLE_CONFIG_PATH = 'workers/deploy-helper/wrangler.example.toml';
const WORKER_RELEASE_TAG_RE = /^worker-bundles-([a-f0-9]{40})$/;
const WORKER_RELEASE_URL_RE = /worker-bundles-([a-f0-9]{40})\//g;
const FULL_COMMIT_RE = /^[a-f0-9]{40}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const ROOT_LOCKFILE_PATH = 'package-lock.json';
// What the release bundles are built from (scripts/worker-bundle.mjs), plus
// the native Cloudflare template the pin also selects. A test checks that this
// covers every local input of the real bundles.
export const WORKER_RELEASE_SOURCE_PATHSPEC = Object.freeze([
  ':(glob)workers/**/*.js',
  ':(glob)workers/**/*.mjs',
  ':(glob)workers/**/*.cjs',
  ':(glob)shared/**/*.js',
  ':(glob)shared/**/*.mjs',
  ':(glob)shared/**/*.cjs',
  'workers/sessionCorsWorker/package-lock.json',
  'scripts/worker-bundle.mjs',
  'deploy/cloudflare/session-worker/worker.mjs',
  'deploy/cloudflare/session-worker/wrangler.jsonc',
  'deploy/cloudflare/session-worker/package.json',
  'scripts/cloudflare-session-template.mjs',
  ':(exclude,glob)**/*.test.*',
  // Not imported by any bundle.
  ':(exclude)shared/encryption/envelopeV1Core.mjs',
  ':(exclude)shared/encryption/envelopeWriterFixtures.mjs',
  ':(exclude)workers/agentBridgeWorker/agentOnlyLoadTest.mjs',
  ':(exclude)workers/agentBridgeWorker/deployHelperApply.mjs',
  ':(exclude)workers/agentBridgeWorker/deployHelperPlan.mjs',
]);

const gitOrNull = (repoRoot, args) => {
  try {
    return git(repoRoot, args);
  } catch {
    return null;
  }
};

// Every release stamps its version into the root lockfile; only its
// dependency entries can change a Worker bundle.
const readRootLockDependencies = (repoRoot, ref) => {
  const contents = gitOrNull(repoRoot, ['show', `${ref}:${ROOT_LOCKFILE_PATH}`]);
  if (contents == null) return '';
  const lock = JSON.parse(contents);
  delete lock.version;
  if (lock.packages?.['']) delete lock.packages[''].version;
  return JSON.stringify(lock);
};

export const listWorkerSourceChanges = ({ repoRoot, fromRef, toRef }) => {
  const changed = git(repoRoot, ['diff', '--name-only', fromRef, toRef, '--', ...WORKER_RELEASE_SOURCE_PATHSPEC])
    .split(/\r?\n/)
    .filter(Boolean);
  if (readRootLockDependencies(repoRoot, fromRef) !== readRootLockDependencies(repoRoot, toRef)) {
    changed.push(ROOT_LOCKFILE_PATH);
  }
  return changed;
};

// Publish Worker Bundles tags each release worker-bundles-<public commit>.
// Lists the releases on the baseline's first-parent line, newest first.
export const listPublishedWorkerReleases = ({ repoRoot, baselineRef }) => {
  const tagged = new Set(
    git(repoRoot, ['tag', '--list', 'worker-bundles-*'])
      .split(/\r?\n/)
      .map((name) => name.trim().match(WORKER_RELEASE_TAG_RE)?.[1])
      .filter(Boolean),
  );
  if (!tagged.size) return [];
  return git(repoRoot, ['rev-list', '--first-parent', baselineRef])
    .split(/\s+/)
    .filter((commit) => tagged.has(commit));
};

const PIN_COMMAND = 'node scripts/release-version.mjs pin-worker-release';

// Offline by design (the pre-push hook and release-staging CI run it), so it
// checks the digest's form only; pin-worker-release verifies the digest when it
// writes the pin, and verify:release-assets checks it against the release.
export const verifyWorkerReleasePin = ({ repoRoot, candidateRef, baselineRef }) => {
  const pinContents = gitOrNull(repoRoot, ['show', `${candidateRef}:${WORKER_RELEASE_PIN_PATH}`]);
  if (pinContents == null) {
    if (gitOrNull(repoRoot, ['cat-file', '-e', `${baselineRef}:${WORKER_RELEASE_PIN_PATH}`]) != null) {
      throw new Error(`${WORKER_RELEASE_PIN_PATH} is missing at ${candidateRef} but present in ${baselineRef}`);
    }
    return null;
  }
  let pin = {};
  try {
    pin = JSON.parse(pinContents) || {};
  } catch {
    pin = {};
  }
  const pinCommit = String(pin.commit || '');
  if (!FULL_COMMIT_RE.test(pinCommit) || !SHA256_RE.test(String(pin.manifestSha256 || ''))) {
    throw new Error(
      `${WORKER_RELEASE_PIN_PATH} at ${candidateRef} must pin a full lowercase commit and manifest SHA-256`,
    );
  }
  const exampleConfig = gitOrNull(repoRoot, ['show', `${candidateRef}:${DEPLOY_HELPER_EXAMPLE_CONFIG_PATH}`]) || '';
  const otherExampleRelease = [...exampleConfig.matchAll(WORKER_RELEASE_URL_RE)]
    .map((match) => match[1])
    .find((commit) => commit !== pinCommit);
  if (otherExampleRelease) {
    throw new Error(
      `${DEPLOY_HELPER_EXAMPLE_CONFIG_PATH} at ${candidateRef} names worker-bundles-${otherExampleRelease}, `
        + `not the pinned ${pinCommit}; run ${PIN_COMMAND}`,
    );
  }
  const published = listPublishedWorkerReleases({ repoRoot, baselineRef });
  if (!published.includes(pinCommit)) {
    throw new Error(
      `Worker release pin ${pinCommit} is not a published worker-bundles release in ${baselineRef}; `
        + `fetch release tags (git fetch --tags --force origin) or run ${PIN_COMMAND}`,
    );
  }
  const newestRelease = published[0];
  const changed = listWorkerSourceChanges({ repoRoot, fromRef: pinCommit, toRef: newestRelease });
  if (changed.length) {
    const shown = changed.slice(0, 3).join(', ');
    const more = changed.length > 3 ? ` and ${changed.length - 3} more` : '';
    throw new Error(
      `Worker release pin ${pinCommit} is stale: worker-bundles-${newestRelease} ships different Worker code `
        + `(${shown}${more}). Run ${PIN_COMMAND}, commit the pin, then prepare the release again`,
    );
  }
  return { pinCommit, newestRelease };
};

// Moves the pin to a published release (the newest by default) after the
// same download checks verify-release-assets applies, and keeps the
// deploy-helper example config on that release.
export const pinWorkerRelease = async ({
  repoRoot,
  mainRef = 'origin/main',
  commit = '',
  fetchRemote = 'origin',
  verifyRelease = null,
}) => {
  const pinPath = path.join(repoRoot, WORKER_RELEASE_PIN_PATH);
  if (!fs.existsSync(pinPath)) throw new Error(`${WORKER_RELEASE_PIN_PATH} was not found in ${repoRoot}`);
  if (fetchRemote) {
    // --force: promotion moves the worker-bundles-stable and -previous tags.
    try {
      git(repoRoot, ['fetch', '--tags', '--force', fetchRemote, 'main']);
    } catch (error) {
      const detail = String(error?.stderr || error?.message || '').trim();
      throw new Error(`Fetching release tags from ${fetchRemote} failed: ${detail || 'git fetch exited with an error'}`);
    }
  }
  const published = listPublishedWorkerReleases({ repoRoot, baselineRef: mainRef });
  const selected = String(commit || published[0] || '').trim().toLowerCase();
  if (!published.includes(selected)) {
    throw new Error(
      selected
        ? `worker-bundles-${selected} is not a published release in ${mainRef} history`
        : `No published worker-bundles release in ${mainRef} history`,
    );
  }
  const verify = verifyRelease || (await import('./verify-release-assets.mjs')).verifyWorkerRelease;
  const result = await verify({ commit: selected });
  if (!result?.ok || !/^[a-f0-9]{64}$/.test(String(result.manifestSha256 || ''))) {
    throw new Error(`worker-bundles-${selected} failed verification: ${(result?.failures || []).join('; ')}`);
  }
  const pin = { commit: selected, manifestSha256: result.manifestSha256 };
  fs.writeFileSync(pinPath, `${JSON.stringify(pin, null, 2)}\n`);
  const exampleConfigPath = path.join(repoRoot, DEPLOY_HELPER_EXAMPLE_CONFIG_PATH);
  if (fs.existsSync(exampleConfigPath)) {
    const exampleConfig = fs.readFileSync(exampleConfigPath, 'utf8');
    fs.writeFileSync(exampleConfigPath, exampleConfig.replace(WORKER_RELEASE_URL_RE, `worker-bundles-${selected}/`));
  }
  return pin;
};

const pickNewestRef = (repoRoot, refs) => refs.find((ref) => refs.every((other) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', other, ref], { cwd: repoRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})) || refs[0];

const readNonEmptyLines = (filePath) => {
  if (!filePath) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const readRangeEvidence = (repoRoot, range) => {
  if (!range) return { paths: [], subjects: [] };
  return {
    paths: git(repoRoot, ['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean),
    subjects: git(repoRoot, ['log', '--format=%s', range]).split(/\r?\n/).filter(Boolean),
  };
};

const parseArgs = (argv) => {
  const [command, ...tokens] = argv;
  const options = { baselineRefs: [], minimumRefs: [] };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--acknowledge-patch' || token === '--dry-run' || token === '--json' || token === '--no-fetch') {
      options[token.slice(2).replaceAll('-', '_')] = true;
      continue;
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${token} requires a value`);
    }
    index += 1;
    const key = token.slice(2).replaceAll('-', '_');
    if (key === 'baseline_ref') options.baselineRefs.push(value);
    else if (key === 'minimum_ref') options.minimumRefs.push(value);
    else options[key] = value;
  }
  return { command, options };
};

const reportPlan = ({ impact, plan }) => {
  process.stderr.write(`Release impact suggestion: ${impact.level}\n`);
  impact.reasons.forEach((reason) => process.stderr.write(`- ${reason}\n`));
  process.stderr.write(`Release baseline: ${plan.baselineVersion}\n`);
  process.stderr.write(`Proposed release version: ${plan.nextVersion} (${plan.releaseLevel})\n`);
};

const runPlan = (options) => {
  const repoRoot = path.resolve(options.repo_root || process.cwd());
  const mainRef = options.main_ref || 'origin/main';
  const mainVersion = readVersionAtRef(repoRoot, mainRef).version;
  const stagingVersion = options.staging_ref && refExists(repoRoot, options.staging_ref)
    ? readVersionAtRef(repoRoot, options.staging_ref).version
    : null;
  const rangeEvidence = readRangeEvidence(repoRoot, options.changed_range);
  const impact = assessReleaseImpact({
    paths: [...rangeEvidence.paths, ...readNonEmptyLines(options.changed_paths_file)],
    subjects: [...rangeEvidence.subjects, ...readNonEmptyLines(options.subjects_file)],
  });
  const plan = planReleaseVersion({
    mainVersion,
    stagingVersion,
    explicitVersion: options.release_version || null,
  });

  if (
    impact.level !== 'patch'
    && plan.releaseLevel === 'patch'
    && !options.acknowledge_patch
    && !options.dry_run
  ) {
    throw new Error(
      `Release impact suggests ${impact.level}; supply --release-version or --acknowledge-patch`,
    );
  }

  // A dry run's clone still holds public main's pin; the replayed candidate
  // is checked when the release is prepared.
  if (!options.dry_run) {
    verifyWorkerReleasePin({ repoRoot, candidateRef: 'HEAD', baselineRef: mainRef });
  }

  reportPlan({ impact, plan });
  if (options.result_file) {
    fs.writeFileSync(
      path.resolve(options.result_file),
      `${JSON.stringify({ ...plan, impact }, null, 2)}\n`,
    );
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ...plan, impact }, null, 2)}\n`);
  } else {
    process.stdout.write(`${plan.nextVersion}\n`);
  }
};

const verifyCandidateRef = (options) => {
  const repoRoot = path.resolve(options.repo_root || process.cwd());
  const candidate = readVersionAtRef(repoRoot, options.candidate_ref);
  const baselines = options.baselineRefs
    .filter((ref) => ref && ref !== '0000000000000000000000000000000000000000')
    .map((ref) => ({ ref, version: readVersionAtRef(repoRoot, ref).version }));
  const minimums = options.minimumRefs
    .filter((ref) => ref && ref !== '0000000000000000000000000000000000000000')
    .map((ref) => ({ ref, version: readVersionAtRef(repoRoot, ref).version }));

  for (const baseline of baselines) {
    if (compareVersions(candidate.version, baseline.version) <= 0) {
      throw new Error(
        `Candidate version ${candidate.version} must be greater than ${baseline.ref} (${baseline.version})`,
      );
    }
  }
  for (const minimum of minimums) {
    if (compareVersions(candidate.version, minimum.version) < 0) {
      throw new Error(
        `Candidate version ${candidate.version} must not be lower than ${minimum.ref} (${minimum.version})`,
      );
    }
  }
  if (baselines.length) {
    verifyWorkerReleasePin({
      repoRoot,
      candidateRef: options.candidate_ref,
      baselineRef: pickNewestRef(repoRoot, baselines.map(({ ref }) => ref)),
    });
  }
  process.stdout.write(`release version verified: ${candidate.version}\n`);
};

const usage = () => {
  process.stderr.write(`Usage:
  node scripts/release-version.mjs plan [--repo-root DIR] [--main-ref REF] [--staging-ref REF]
    [--changed-range RANGE | --changed-paths-file FILE --subjects-file FILE]
    [--release-version X.Y.Z] [--acknowledge-patch] [--dry-run] [--json]
  node scripts/release-version.mjs stamp --root DIR --version X.Y.Z
  node scripts/release-version.mjs verify-worktree [--root DIR]
  node scripts/release-version.mjs verify-ref --candidate-ref REF [--baseline-ref REF ...]
    [--minimum-ref REF ...]
  node scripts/release-version.mjs pin-worker-release [--repo-root DIR] [--main-ref REF]
    [--commit SHA] [--remote NAME | --no-fetch]
`);
};

export const runCli = (argv = process.argv.slice(2)) => {
  const { command, options } = parseArgs(argv);
  if (command === 'plan') {
    runPlan(options);
    return;
  }
  if (command === 'stamp') {
    const result = writeVersionSurfaces(path.resolve(options.root || process.cwd()), options.version);
    process.stdout.write(`release version stamped: ${result.version}\n`);
    return;
  }
  if (command === 'verify-worktree') {
    const result = readVersionSurfaces(path.resolve(options.root || process.cwd()));
    process.stdout.write(`release version surfaces verified: ${result.version}\n`);
    return;
  }
  if (command === 'verify-ref') {
    verifyCandidateRef(options);
    return;
  }
  if (command === 'pin-worker-release') {
    return pinWorkerRelease({
      repoRoot: path.resolve(options.repo_root || process.cwd()),
      mainRef: options.main_ref || 'origin/main',
      commit: options.commit || '',
      fetchRemote: options.no_fetch ? '' : options.remote || 'origin',
    }).then((pin) => {
      process.stdout.write(
        `Worker release pinned: worker-bundles-${pin.commit} (manifest SHA-256 ${pin.manifestSha256})\n`,
      );
    });
  }
  usage();
  throw new Error(`Unknown release-version command: ${command || '<missing>'}`);
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const fail = (error) => {
    process.stderr.write(`release version error: ${error.message}\n`);
    process.exitCode = 1;
  };
  try {
    Promise.resolve(runCli()).catch(fail);
  } catch (error) {
    fail(error);
  }
}
