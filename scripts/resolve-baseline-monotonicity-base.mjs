#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const FULL_COMMIT_SHA_RE = /^[0-9a-f]{40}$/;
const RELEASE_STAGING_PREFIX = 'release-staging';

const readEnv = (env, key) => String(env?.[key] || '').trim();

export const selectBaselineMonotonicityRef = ({
  eventName = '',
  refName = '',
  pullRequestBaseSha = '',
  pushBeforeSha = '',
  releaseBaseRef = 'origin/main',
} = {}) => {
  const normalizedEventName = String(eventName || '').trim();
  const normalizedRefName = String(refName || '').trim();

  if (normalizedEventName === 'pull_request') {
    if (!FULL_COMMIT_SHA_RE.test(String(pullRequestBaseSha || '').trim())) {
      throw new Error('pull_request baseline must be a full lowercase commit SHA');
    }
    return String(pullRequestBaseSha).trim();
  }

  if (normalizedEventName !== 'push') {
    throw new Error(`unsupported baseline monotonicity event "${normalizedEventName || '(empty)'}"`);
  }

  if (normalizedRefName.startsWith(RELEASE_STAGING_PREFIX)) {
    return String(releaseBaseRef || 'origin/main').trim();
  }

  if (!FULL_COMMIT_SHA_RE.test(String(pushBeforeSha || '').trim())) {
    throw new Error('push baseline must be a full lowercase commit SHA');
  }
  return String(pushBeforeSha).trim();
};

export const resolveBaselineMonotonicitySha = ({
  repoDir = process.cwd(),
  ...selection
} = {}) => {
  let baseRef = selectBaselineMonotonicityRef(selection);
  const pushBeforeSha = String(selection.pushBeforeSha || '').trim();
  if (
    String(selection.eventName || '').trim() === 'push'
    && String(selection.refName || '').trim().startsWith(RELEASE_STAGING_PREFIX)
    && FULL_COMMIT_SHA_RE.test(pushBeforeSha)
  ) {
    try {
      execFileSync('git', ['-C', repoDir, 'merge-base', '--is-ancestor', baseRef, pushBeforeSha], {
        stdio: 'ignore',
      });
      execFileSync('git', ['-C', repoDir, 'merge-base', '--is-ancestor', pushBeforeSha, 'HEAD'], {
        stdio: 'ignore',
      });
      baseRef = pushBeforeSha;
    } catch {
      // New, stale, replayed, or unavailable staging history compares to public main.
    }
  }
  let baseSha = '';
  try {
    baseSha = execFileSync('git', ['-C', repoDir, 'rev-parse', '--verify', `${baseRef}^{commit}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error(`baseline monotonicity base ref "${baseRef}" was not available`);
  }
  if (!FULL_COMMIT_SHA_RE.test(baseSha)) {
    throw new Error(`baseline monotonicity base ref "${baseRef}" did not resolve to a full lowercase commit SHA`);
  }
  return baseSha;
};

const parseArgs = (argv) => {
  const options = {
    githubOutput: '',
    repoDir: process.cwd(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--github-output') {
      index += 1;
      if (index >= argv.length) throw new Error('--github-output requires a path');
      options.githubOutput = argv[index];
    } else if (arg === '--repo') {
      index += 1;
      if (index >= argv.length) throw new Error('--repo requires a path');
      options.repoDir = argv[index];
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return options;
};

export const resolveBaselineMonotonicityShaFromEnv = ({
  env = process.env,
  repoDir = process.cwd(),
} = {}) =>
  resolveBaselineMonotonicitySha({
    repoDir,
    eventName: readEnv(env, 'BASELINE_EVENT_NAME'),
    refName: readEnv(env, 'BASELINE_REF_NAME'),
    pullRequestBaseSha: readEnv(env, 'BASELINE_PR_BASE_SHA'),
    pushBeforeSha: readEnv(env, 'BASELINE_PUSH_BEFORE_SHA'),
    releaseBaseRef: readEnv(env, 'BASELINE_RELEASE_BASE_REF') || 'origin/main',
  });

const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const baseSha = resolveBaselineMonotonicityShaFromEnv({
      repoDir: options.repoDir,
    });
    if (options.githubOutput) {
      fs.appendFileSync(options.githubOutput, `base_sha=${baseSha}\n`);
    }
    process.stdout.write(`${baseSha}\n`);
  } catch (error) {
    process.stderr.write(`Baseline monotonicity base resolution failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
