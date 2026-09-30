#!/usr/bin/env node
// Verifies the immutable Worker release that hosted clients download: the
// pinned manifest bytes, the manifest's source commit, and each bundle's
// SHA-256. Three reachable URLs alone do not prove the artifacts match.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readWorkerBundleDigestFromManifest } from '../workers/shared/workerReleaseManifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORKER_RELEASE_PIN_PATH = path.join(ROOT, 'client', 'src', 'variables', 'workerReleasePin.json');
export const PUBLIC_REPOSITORY = 'AgalmicSoftware/context-engine';
const MANIFEST_FILE = 'worker-release-manifest.json';
// The bundles hosted clients deploy, by their manifest artifact kind.
const CLIENT_BUNDLES = Object.freeze([
  Object.freeze({ kind: 'session-cors-worker', file: 'sessionCorsWorker.bundle.js' }),
  Object.freeze({ kind: 'agent-bridge-worker', file: 'agentBridgeWorker.bundle.js' }),
]);
const ASSET_URL_OVERRIDES = Object.freeze([
  'REACT_APP_CE_WORKER_BUNDLE_URL',
  'REACT_APP_CE_AGENT_BRIDGE_WORKER_BUNDLE_URL',
  'REACT_APP_CE_WORKER_RELEASE_MANIFEST_URL',
]);
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export const workerReleaseBaseUrl = (commit) =>
  `https://github.com/${PUBLIC_REPOSITORY}/releases/download/worker-bundles-${commit}`;

export function readWorkerReleasePin(pinPath = WORKER_RELEASE_PIN_PATH) {
  const pin = JSON.parse(fs.readFileSync(pinPath, 'utf8'));
  if (!COMMIT_PATTERN.test(String(pin?.commit)) || !SHA256_PATTERN.test(String(pin?.manifestSha256))) {
    throw new Error(`${path.relative(ROOT, pinPath)} must pin a full lowercase commit and manifest SHA-256`);
  }
  return { commit: pin.commit, manifestSha256: pin.manifestSha256 };
}

// Like the hosted client, an explicit native-deploy commit selects the release
// and the tracked pin applies otherwise. CE_RELEASE_COMMIT checks a candidate
// before it is pinned; CE_RELEASE_ASSET_BASE_URL checks the same release from
// another location, such as the promoted "latest" channel.
export function resolveWorkerReleaseSelection(env = process.env, pin = readWorkerReleasePin()) {
  const commit = String(env.CE_RELEASE_COMMIT || env.REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT || pin.commit)
    .trim()
    .toLowerCase();
  if (!COMMIT_PATTERN.test(commit)) {
    throw new Error(`release commit must be a full 40-character SHA, not "${commit}"`);
  }
  const baseUrl =
    String(env.CE_RELEASE_ASSET_BASE_URL || '')
      .trim()
      .replace(/\/+$/, '') || workerReleaseBaseUrl(commit);
  return { commit, baseUrl, manifestSha256: commit === pin.commit ? pin.manifestSha256 : '' };
}

export async function verifyWorkerRelease({
  commit,
  baseUrl = workerReleaseBaseUrl(commit),
  manifestSha256 = '',
  fetchImpl = globalThis.fetch,
}) {
  const failures = [];
  const verified = [];
  const download = async (file) => {
    const url = `${baseUrl}/${file}`;
    try {
      const response = await fetchImpl(url, { redirect: 'follow' });
      if (!response.ok) {
        failures.push(`${file}: HTTP ${response.status} from ${url}`);
        return null;
      }
      return { url, bytes: Buffer.from(await response.arrayBuffer()) };
    } catch (error) {
      failures.push(`${file}: ${error?.message || error} (${url})`);
      return null;
    }
  };

  const manifestAsset = await download(MANIFEST_FILE);
  const actualManifestSha256 = manifestAsset ? sha256(manifestAsset.bytes) : '';
  const expectedDigests = new Map();
  if (manifestAsset) {
    const failuresBefore = failures.length;
    if (manifestSha256 && actualManifestSha256 !== manifestSha256) {
      failures.push(`${MANIFEST_FILE}: SHA-256 ${actualManifestSha256} does not match the pinned ${manifestSha256}`);
    }
    let manifest;
    try {
      manifest = JSON.parse(manifestAsset.bytes.toString('utf8'));
    } catch {
      failures.push(`${MANIFEST_FILE}: not valid JSON`);
    }
    if (manifest !== undefined) {
      if (manifest?.source?.repository !== PUBLIC_REPOSITORY) {
        failures.push(
          `${MANIFEST_FILE}: source repository is ${manifest?.source?.repository}, not ${PUBLIC_REPOSITORY}`,
        );
      }
      if (manifest?.source?.commit !== commit || manifest?.replay?.publicCommit !== commit) {
        failures.push(
          `${MANIFEST_FILE}: source commit ${manifest?.source?.commit} / public commit ${manifest?.replay?.publicCommit} is not the selected ${commit}`,
        );
      }
      // Deploys accept a bundle only through this same manifest validation.
      for (const { kind, file } of CLIENT_BUNDLES) {
        const expected = readWorkerBundleDigestFromManifest(manifest, { artifactFile: file, artifactKind: kind });
        const failure = `${MANIFEST_FILE}: ${expected.error}`;
        if (expected.ok) expectedDigests.set(file, expected.digest);
        else if (!failures.includes(failure)) failures.push(failure);
      }
    }
    if (failures.length === failuresBefore) {
      verified.push(`${manifestAsset.url} sha256=${actualManifestSha256} source=${commit}`);
    }
  }
  let verifiedBundles = 0;
  for (const { file } of CLIENT_BUNDLES) {
    const asset = await download(file);
    const expectedDigest = expectedDigests.get(file);
    if (!asset || !expectedDigest) continue;
    const digest = sha256(asset.bytes);
    if (digest !== expectedDigest) {
      failures.push(`${file}: SHA-256 ${digest} does not match the manifest's ${expectedDigest}`);
      continue;
    }
    verifiedBundles += 1;
    verified.push(`${asset.url} sha256=${digest}`);
  }
  // Pass only when every client bundle matched a verified manifest.
  const ok = failures.length === 0 && verifiedBundles === CLIENT_BUNDLES.length;
  return { ok, failures, verified, manifestSha256: actualManifestSha256 };
}

async function main() {
  const selection = resolveWorkerReleaseSelection();
  const result = await verifyWorkerRelease(selection);
  result.verified.forEach((line) => console.log(`verified: ${line}`));
  if (!result.ok) {
    result.failures.forEach((failure) => console.error(`release check failed: ${failure}`));
    process.exitCode = 1;
    return;
  }
  const overrides = ASSET_URL_OVERRIDES.filter((name) => process.env[name]);
  if (overrides.length) console.warn(`not verified here (explicit asset URL overrides): ${overrides.join(', ')}`);
  if (selection.manifestSha256) {
    console.log(`Worker release worker-bundles-${selection.commit} matches the pin.`);
  } else {
    console.log(
      `Worker release worker-bundles-${selection.commit} verified; manifest SHA-256 ${result.manifestSha256}.`,
    );
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`release check failed: ${error?.message || error}`);
    process.exitCode = 1;
  });
}
