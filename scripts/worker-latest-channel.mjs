#!/usr/bin/env node
// Self-contained so workflows can preserve this trusted policy before checking
// out a historical release that predates it. Artifact provenance is verified by
// worker-release-artifacts.mjs before this helper compares the published bytes.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERIFIED_RELEASE_FILES = Object.freeze([
  'sessionCorsWorker.bundle.js',
  'agentBridgeWorker.bundle.js',
  'deployHelper.bundle.js',
  'worker-release-manifest.json',
]);
const MANUAL_REF = 'refs/tags/worker-bundles-latest-manual';
const FULL_SHA = /^[a-f0-9]{40}$/;
const RELEASE_TAG = /^worker-bundles-([a-f0-9]{40})$/;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

export function parseApiResponse(response) {
  const match = String(response).match(/^HTTP\/[\d.]+ (\d{3})[^\r\n]*\r?\n[\s\S]*?\r?\n\r?\n/);
  assert(match, 'GitHub API response is missing an HTTP status');
  const status = Number(match[1]);
  if (status < 200 || status >= 300) {
    throw Object.assign(new Error(`GitHub API HTTP ${status}`), { status });
  }
  return JSON.parse(response.slice(match[0].length));
}

function githubClient(repository) {
  const gh = (args, timeout = 60_000) => execFileSync('gh', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout, maxBuffer: 8 * 1024 * 1024,
  });
  return {
    async api(method, endpoint, body) {
      const args = ['api', '--include', '--method', method, endpoint];
      for (const [key, value] of Object.entries(body || {})) {
        args.push(typeof value === 'boolean' ? '-F' : '-f', `${key}=${value}`);
      }
      let response;
      try {
        response = gh(args);
      } catch (error) {
        // Preserve the HTTP status on failures; never treat auth/network errors
        // as missing state. Only the caller's explicit Latest-404 case is absent.
        if (error.stdout) parseApiResponse(String(error.stdout));
        throw new Error(`GitHub API request failed: ${String(error.stderr || error.message).trim()}`);
      }
      return parseApiResponse(response);
    },
    async download(tag, dir) {
      gh(['release', 'download', tag, '--repo', repository, '--dir', dir], 120_000);
    },
    async setLatest(tag) {
      gh(['release', 'edit', tag, '--repo', repository, '--latest']);
    },
  };
}

function validateRelease(release, expectedTag) {
  assert(release && Number.isSafeInteger(release.id) && release.id > 0, 'Release metadata has an invalid id');
  assert(release.tag_name === expectedTag, 'Release metadata has the wrong tag');
  assert(release.draft === false && release.prerelease === false, 'Latest requires a published, non-prerelease release');
}

function refCommit(ref, expectedRef) {
  assert(ref?.ref === expectedRef && ref?.object?.type === 'commit' && FULL_SHA.test(ref.object.sha),
    `GitHub ref ${expectedRef} must identify a full lowercase commit SHA`);
  return ref.object.sha;
}

async function verifyDownloads(github, tag, expected) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-latest-download-'));
  try {
    await github.download(tag, dir);
    assert(JSON.stringify(fs.readdirSync(dir).sort()) === JSON.stringify([...expected.keys()].sort()),
      'Published release asset names do not match the verified CI artifact');
    for (const [file, bytes] of expected) {
      assert(fs.lstatSync(path.join(dir, file)).isFile(), `Published asset is not a regular file: ${file}`);
      assert(fs.readFileSync(path.join(dir, file)).equals(bytes), `Published asset differs from verified CI bytes: ${file}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export async function manageLatestChannel({ mode, repository, sourceCommit, sourceRef, verifiedDir, github }) {
  assert(['automatic', 'record-manual', 'manual'].includes(mode), 'Unknown Latest update mode');
  assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'Invalid repository');
  assert(FULL_SHA.test(sourceCommit), 'Source commit must be a full lowercase SHA');
  assert(/^refs\/heads\/(?:main|master)$/.test(sourceRef), 'Source must be a validated canonical CI branch');
  github ||= githubClient(repository);
  const prefix = `repos/${repository}`;
  const tag = `worker-bundles-${sourceCommit}`;
  const get = (endpoint) => github.api('GET', `${prefix}/${endpoint}`);
  const skipped = (reason) => ({ status: 'skipped', tag, reason });
  const expected = new Map();
  assert(JSON.stringify(fs.readdirSync(verifiedDir).sort()) === JSON.stringify([...VERIFIED_RELEASE_FILES].sort()),
    'Verified CI artifact must contain exactly the expected Worker release files');
  for (const file of VERIFIED_RELEASE_FILES) {
    const filename = path.join(verifiedDir, file);
    assert(fs.lstatSync(filename).isFile(), `Verified artifact is not a regular file: ${file}`);
    expected.set(file, fs.readFileSync(filename));
  }

  const release = await get(`releases/tags/${tag}`);
  validateRelease(release, tag);
  assert(refCommit(await get(`git/ref/tags/${tag}`), `refs/tags/${tag}`) === sourceCommit,
    'Immutable release tag does not match the validated CI source');
  await verifyDownloads(github, tag, expected);

  const getDefaultHead = async () => {
    const repo = await github.api('GET', prefix);
    assert(repo?.full_name === repository && ['main', 'master'].includes(repo.default_branch),
      'Repository default branch is not a supported canonical CI branch');
    const ref = `refs/heads/${repo.default_branch}`;
    const commit = refCommit(await get(`git/ref/heads/${repo.default_branch}`), ref);
    return { ref, commit };
  };
  const getManualMarker = async () => {
    const refs = await get(`git/matching-refs/tags/${MANUAL_REF.slice('refs/tags/'.length)}`);
    assert(Array.isArray(refs), 'Manual Latest watermark lookup must return an array');
    const exact = refs.filter((ref) => ref?.ref === MANUAL_REF);
    assert(exact.length <= 1, 'Manual Latest watermark lookup is ambiguous');
    return exact.length ? refCommit(exact[0], MANUAL_REF) : '';
  };
  const strictlyNewer = async (base) => {
    if (base === sourceCommit) return false;
    const comparison = await get(`compare/${base}...${sourceCommit}`);
    assert(comparison?.base_commit?.sha === base && ['ahead', 'behind', 'identical', 'diverged'].includes(comparison.status),
      'GitHub commit comparison is malformed');
    return comparison.status === 'ahead' && comparison.merge_base_commit?.sha === base
      && Number.isSafeInteger(comparison.ahead_by) && comparison.ahead_by > 0 && comparison.behind_by === 0;
  };
  const getLatest = async () => {
    try {
      const latest = await get('releases/latest');
      assert(typeof latest?.tag_name === 'string' && latest.tag_name, 'Latest metadata has no release tag');
      validateRelease(latest, latest.tag_name);
      return latest;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  };

  if (mode === 'record-manual') {
    // Write this before touching stable/previous or Latest. If a later mutation
    // fails, the operator can retry; an automatic rerun cannot undo the intent.
    const head = await getDefaultHead();
    const existing = await getManualMarker();
    if (existing !== head.commit) {
      if (existing) {
        await github.api('PATCH', `${prefix}/git/refs/tags/${MANUAL_REF.slice('refs/tags/'.length)}`,
          { sha: head.commit, force: true });
      } else {
        await github.api('POST', `${prefix}/git/refs`, { ref: MANUAL_REF, sha: head.commit });
      }
    }
    assert(await getManualMarker() === head.commit, 'Manual Latest watermark readback failed');
    return { status: 'recorded', tag, watermark: head.commit };
  }

  if (mode === 'automatic') {
    const head = await getDefaultHead();
    if (head.ref !== sourceRef || head.commit !== sourceCommit) return skipped('Candidate is not the current default-branch tip');
    const marker = await getManualMarker();
    if (marker && !await strictlyNewer(marker)) return skipped('Manual rollback remains in effect');
  } else {
    assert(await getManualMarker(), 'Manual Latest update requires a recorded rollback watermark');
  }

  let latest = await getLatest();
  if (mode === 'automatic') {
    const currentCommit = latest?.tag_name.match(RELEASE_TAG)?.[1];
    if (currentCommit && currentCommit !== sourceCommit && !await strictlyNewer(currentCommit)) {
      return skipped('Candidate does not advance the existing Latest release');
    }
    // Publication, comparisons, and downloads may take time. Refresh the tip
    // and Latest inside the shared mutation lock immediately before writing.
    const head = await getDefaultHead();
    if (head.ref !== sourceRef || head.commit !== sourceCommit) return skipped('Default-branch tip changed during verification');
    const refreshed = await getLatest();
    assert(refreshed?.id === latest?.id && refreshed?.tag_name === latest?.tag_name,
      'Latest changed outside the serialized workflow; retry with fresh state');
    latest = refreshed;
  }
  const unchanged = latest?.id === release.id && latest?.tag_name === tag;
  if (!unchanged) await github.setLatest(tag);
  const readback = await getLatest();
  assert(readback?.id === release.id && readback?.tag_name === tag, 'Latest readback does not identify the selected release');
  await verifyDownloads(github, readback.tag_name, expected);
  return { status: unchanged ? 'unchanged' : 'updated', tag };
}

async function main() {
  const options = {};
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    assert(/^--[a-z-]+$/.test(args[index]) && args[index + 1], 'Latest helper requires named arguments');
    const key = args[index].slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[key] = args[index + 1];
  }
  console.log(JSON.stringify(await manageLatestChannel(options)));
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`Worker Latest update failed: ${error.message}`);
    process.exitCode = 1;
  });
}
