import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveWorkerReleaseManifestUrl,
  fetchExpectedWorkerBundleDigest,
  normalizeWorkerBundleSha256,
  readWorkerBundleDigestFromManifest,
} from './workerReleaseManifest.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const DIGEST = 'c'.repeat(64);

const manifest = () => ({
  schemaVersion: 1,
  artifactSet: 'context-engine-worker-bundles',
  source: { commit: SHA_A, ref: 'refs/heads/main', tree: SHA_B },
  replay: {
    privateSourceCommit: SHA_B,
    publicReplayCommit: SHA_A,
    publicCommit: SHA_A,
    publicTree: SHA_B,
  },
  builder: { workflow: 'CI', runId: '123' },
  artifacts: [
    { kind: 'session-cors-worker', file: 'sessionCorsWorker.bundle.js', bytes: 42, sha256: DIGEST },
  ],
});

test('derives an explicit adjacent manifest URL without retaining query or fragment', () => {
  assert.equal(
    deriveWorkerReleaseManifestUrl('https://github.example/releases/latest/download/sessionCorsWorker.bundle.js?x=1#hash'),
    'https://github.example/releases/latest/download/worker-release-manifest.json',
  );
  assert.equal(deriveWorkerReleaseManifestUrl('http://github.example/bundle.js'), '');
});

test('normalizes only complete SHA-256 values', () => {
  assert.equal(normalizeWorkerBundleSha256(DIGEST.toUpperCase()), DIGEST);
  assert.equal(normalizeWorkerBundleSha256('abc'), '');
});

test('reads the one kind-and-file matched digest from complete provenance', () => {
  assert.deepEqual(readWorkerBundleDigestFromManifest(manifest(), {
    artifactFile: 'sessionCorsWorker.bundle.js',
    artifactKind: 'session-cors-worker',
  }), { ok: true, digest: DIGEST });
});

test('rejects incomplete provenance, duplicate artifacts, and invalid digests', () => {
  const incomplete = manifest();
  incomplete.source.tree = '';
  assert.equal(readWorkerBundleDigestFromManifest(incomplete, {
    artifactFile: 'sessionCorsWorker.bundle.js',
    artifactKind: 'session-cors-worker',
  }).ok, false);

  const duplicate = manifest();
  duplicate.artifacts.push({ ...duplicate.artifacts[0] });
  assert.equal(readWorkerBundleDigestFromManifest(duplicate, {
    artifactFile: 'sessionCorsWorker.bundle.js',
    artifactKind: 'session-cors-worker',
  }).ok, false);

  const invalid = manifest();
  invalid.artifacts[0].sha256 = 'nope';
  assert.equal(readWorkerBundleDigestFromManifest(invalid, {
    artifactFile: 'sessionCorsWorker.bundle.js',
    artifactKind: 'session-cors-worker',
  }).ok, false);
});

test('fetches and validates the explicit manifest asset', async () => {
  const calls = [];
  const result = await fetchExpectedWorkerBundleDigest({
    manifestUrl: 'https://assets.example/worker-release-manifest.json',
    artifactFile: 'sessionCorsWorker.bundle.js',
    artifactKind: 'session-cors-worker',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => manifest() };
    },
  });
  assert.deepEqual(result, { ok: true, digest: DIGEST });
  assert.equal(calls[0].options.cache, 'no-store');
});

test('fails closed when the manifest cannot be fetched or parsed', async () => {
  assert.equal((await fetchExpectedWorkerBundleDigest({
    manifestUrl: 'https://assets.example/worker-release-manifest.json',
    artifactFile: 'sessionCorsWorker.bundle.js',
    artifactKind: 'session-cors-worker',
    fetchImpl: async () => ({ ok: false, status: 503 }),
  })).ok, false);
  assert.equal((await fetchExpectedWorkerBundleDigest({
    manifestUrl: 'https://assets.example/not-the-manifest.json',
    artifactFile: 'sessionCorsWorker.bundle.js',
    artifactKind: 'session-cors-worker',
  })).ok, false);
});
