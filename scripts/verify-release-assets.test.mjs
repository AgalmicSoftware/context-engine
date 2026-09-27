import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  PUBLIC_REPOSITORY,
  readWorkerReleasePin,
  resolveWorkerReleaseSelection,
  verifyWorkerRelease,
  workerReleaseBaseUrl,
} from './verify-release-assets.mjs';

const SCRIPT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verify-release-assets.mjs');
const COMMIT = 'a'.repeat(40);
const OLDER_COMMIT = 'b'.repeat(40);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

// Shaped like a real CI-built worker-release-manifest.json.
const buildRelease = (commit = COMMIT, { mutate = () => {} } = {}) => {
  const bundles = {
    'sessionCorsWorker.bundle.js': Buffer.from(`session worker ${commit}`),
    'agentBridgeWorker.bundle.js': Buffer.from(`agent bridge ${commit}`),
  };
  const artifact = (kind, file) => ({ kind, file, bytes: bundles[file].length, sha256: sha256(bundles[file]) });
  const tree = 'c'.repeat(40);
  const manifest = {
    schemaVersion: 1,
    artifactSet: 'context-engine-worker-bundles',
    source: { repository: PUBLIC_REPOSITORY, commit, ref: 'refs/heads/main', tree },
    replay: {
      mapping: 'private-source-to-public-replay-v1',
      privateSourceCommit: 'd'.repeat(40),
      publicReplayCommit: 'e'.repeat(40),
      publicCommit: commit,
      publicTree: tree,
    },
    builder: {
      workflow: 'CI',
      workflowRef: `${PUBLIC_REPOSITORY}/.github/workflows/ci.yml@refs/heads/main`,
      runId: '1',
      runAttempt: '1',
    },
    artifacts: [
      artifact('session-cors-worker', 'sessionCorsWorker.bundle.js'),
      artifact('agent-bridge-worker', 'agentBridgeWorker.bundle.js'),
    ],
  };
  mutate(manifest);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  return {
    assets: { ...bundles, 'worker-release-manifest.json': manifestBytes },
    manifestSha256: sha256(manifestBytes),
  };
};

const serve = (baseUrl, assets) => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    const file = url.startsWith(`${baseUrl}/`) ? url.slice(baseUrl.length + 1) : '';
    return Object.hasOwn(assets, file) ? new Response(assets[file]) : new Response('Not Found', { status: 404 });
  };
  return { fetchImpl, requested };
};

test('verifies the pinned release manifest, provenance, and both client bundles', async () => {
  const release = buildRelease();
  const { fetchImpl, requested } = serve(workerReleaseBaseUrl(COMMIT), release.assets);

  const result = await verifyWorkerRelease({ commit: COMMIT, manifestSha256: release.manifestSha256, fetchImpl });

  assert.deepEqual(result.failures, []);
  assert.equal(result.ok, true);
  assert.equal(result.verified.length, 3);
  assert.ok(requested.every((url) => url.includes(`/releases/download/worker-bundles-${COMMIT}/`)));
});

test('accepts a deliberately pinned older release without consulting latest', async () => {
  const release = buildRelease(OLDER_COMMIT);
  const { fetchImpl, requested } = serve(workerReleaseBaseUrl(OLDER_COMMIT), release.assets);

  const result = await verifyWorkerRelease({ commit: OLDER_COMMIT, manifestSha256: release.manifestSha256, fetchImpl });

  assert.equal(result.ok, true);
  assert.equal(
    requested.some((url) => url.includes('/latest/')),
    false,
  );
});

test('names every missing asset', async () => {
  const release = buildRelease();
  delete release.assets['agentBridgeWorker.bundle.js'];
  delete release.assets['worker-release-manifest.json'];
  const { fetchImpl } = serve(workerReleaseBaseUrl(COMMIT), release.assets);

  const result = await verifyWorkerRelease({ commit: COMMIT, manifestSha256: release.manifestSha256, fetchImpl });

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /worker-release-manifest\.json: HTTP 404/);
  assert.match(result.failures.join('\n'), /agentBridgeWorker\.bundle\.js: HTTP 404/);
  assert.equal(result.failures.length, 2);
});

test('rejects a manifest built from a different source commit', async () => {
  const release = buildRelease(COMMIT, {
    mutate: (manifest) => {
      manifest.source.commit = OLDER_COMMIT;
      manifest.replay.publicCommit = OLDER_COMMIT;
    },
  });
  const { fetchImpl } = serve(workerReleaseBaseUrl(COMMIT), release.assets);

  const result = await verifyWorkerRelease({ commit: COMMIT, fetchImpl });

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), new RegExp(`${OLDER_COMMIT}.* is not the selected ${COMMIT}`));
});

test('rejects a manifest from another repository', async () => {
  const release = buildRelease(COMMIT, {
    mutate: (manifest) => {
      manifest.source.repository = 'someone/fork';
    },
  });
  const { fetchImpl } = serve(workerReleaseBaseUrl(COMMIT), release.assets);

  const result = await verifyWorkerRelease({ commit: COMMIT, fetchImpl });

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /source repository is someone\/fork/);
});

test('rejects manifests that deploy-time validation would reject', async () => {
  const cases = {
    'missing private source commit': (manifest) => {
      delete manifest.replay.privateSourceCommit;
    },
    'non-CI builder': (manifest) => {
      manifest.builder.workflow = 'nightly';
    },
    'duplicate bridge artifact': (manifest) => {
      manifest.artifacts.push({ ...manifest.artifacts[1] });
    },
  };
  for (const [label, mutate] of Object.entries(cases)) {
    const release = buildRelease(COMMIT, { mutate });
    const { fetchImpl } = serve(workerReleaseBaseUrl(COMMIT), release.assets);

    const result = await verifyWorkerRelease({ commit: COMMIT, fetchImpl });

    assert.equal(result.ok, false, label);
    assert.match(result.failures.join('\n'), /worker-release-manifest\.json: Worker release manifest/, label);
  }
});

test('never passes a manifest that is not a JSON object', async () => {
  for (const body of ['null', '[]', '"manifest"', 'not json']) {
    const release = buildRelease();
    release.assets['worker-release-manifest.json'] = Buffer.from(body);
    const { fetchImpl } = serve(workerReleaseBaseUrl(COMMIT), release.assets);

    const result = await verifyWorkerRelease({ commit: COMMIT, fetchImpl });

    assert.equal(result.ok, false, body);
    assert.ok(result.failures.length > 0, body);
  }
});

test('rejects a bundle whose bytes differ from the manifest digest', async () => {
  const release = buildRelease();
  release.assets['sessionCorsWorker.bundle.js'] = Buffer.from('replaced session worker');
  const { fetchImpl } = serve(workerReleaseBaseUrl(COMMIT), release.assets);

  const result = await verifyWorkerRelease({ commit: COMMIT, manifestSha256: release.manifestSha256, fetchImpl });

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /sessionCorsWorker\.bundle\.js: SHA-256 [a-f0-9]{64} .*does not match the manifest/);
});

test('rejects a consistent but replaced manifest that no longer matches the pin', async () => {
  const pinned = buildRelease();
  const replaced = buildRelease(COMMIT, {
    mutate: (manifest) => {
      manifest.builder.runId = '2';
    },
  });
  const { fetchImpl } = serve(workerReleaseBaseUrl(COMMIT), replaced.assets);

  const result = await verifyWorkerRelease({ commit: COMMIT, manifestSha256: pinned.manifestSha256, fetchImpl });

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), new RegExp(`does not match the pinned ${pinned.manifestSha256}`));
});

test('reads only well-formed pins', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-release-pin-'));
  const write = (value) => {
    const pinPath = path.join(dir, `${crypto.randomUUID()}.json`);
    fs.writeFileSync(pinPath, JSON.stringify(value));
    return pinPath;
  };
  try {
    const valid = { commit: COMMIT, manifestSha256: 'd'.repeat(64) };
    assert.deepEqual(readWorkerReleasePin(write(valid)), valid);
    assert.throws(() => readWorkerReleasePin(write({ ...valid, commit: 'main' })), /must pin a full lowercase commit/);
    assert.throws(() => readWorkerReleasePin(write({ ...valid, commit: COMMIT.toUpperCase() })), /must pin/);
    assert.throws(() => readWorkerReleasePin(write({ commit: COMMIT })), /manifest SHA-256/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the tracked pin is well formed', () => {
  const pin = readWorkerReleasePin();
  assert.match(pin.commit, /^[a-f0-9]{40}$/);
  assert.match(pin.manifestSha256, /^[a-f0-9]{64}$/);
});

test('selects the pin by default and honours explicit release overrides', () => {
  const pin = { commit: COMMIT, manifestSha256: 'd'.repeat(64) };

  assert.deepEqual(resolveWorkerReleaseSelection({}, pin), {
    commit: COMMIT,
    baseUrl: workerReleaseBaseUrl(COMMIT),
    manifestSha256: pin.manifestSha256,
  });
  assert.deepEqual(resolveWorkerReleaseSelection({ REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT: OLDER_COMMIT }, pin), {
    commit: OLDER_COMMIT,
    baseUrl: workerReleaseBaseUrl(OLDER_COMMIT),
    manifestSha256: '',
  });
  assert.equal(
    resolveWorkerReleaseSelection(
      { CE_RELEASE_COMMIT: COMMIT.toUpperCase(), REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT: OLDER_COMMIT },
      pin,
    ).commit,
    COMMIT,
  );
  assert.equal(
    resolveWorkerReleaseSelection({ CE_RELEASE_ASSET_BASE_URL: 'https://mirror.example/latest/download/' }, pin).baseUrl,
    'https://mirror.example/latest/download',
  );
  assert.throws(() => resolveWorkerReleaseSelection({ CE_RELEASE_COMMIT: 'main' }, pin), /full 40-character SHA/);
});

test('the command fails before any download when the selected commit is invalid', () => {
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    encoding: 'utf8',
    env: { ...process.env, CE_RELEASE_COMMIT: 'main' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /release check failed: release commit must be a full 40-character SHA/);
});

// The Netlify build relies on the exit status, so run the real command
// against a local release server.
const runCommand = (env) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT_PATH], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });

const withReleaseServer = async (handler, run) => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test('the command exits non-zero and names every missing asset', async () => {
  const result = await withReleaseServer(
    (_request, response) => response.writeHead(404).end('Not Found'),
    (origin) => runCommand({ CE_RELEASE_COMMIT: COMMIT, CE_RELEASE_ASSET_BASE_URL: origin }),
  );

  assert.equal(result.status, 1);
  for (const file of ['worker-release-manifest.json', 'sessionCorsWorker.bundle.js', 'agentBridgeWorker.bundle.js']) {
    assert.ok(result.stderr.includes(`release check failed: ${file}: HTTP 404`), `${file}\n${result.stderr}`);
  }
});

test('the command follows asset redirects and exits zero for a verified release', async () => {
  const release = buildRelease();
  // GitHub answers release downloads with a redirect to its asset host.
  const result = await withReleaseServer(
    (request, response) => {
      const [, prefix, file] = request.url.match(/^\/(assets\/)?(.*)$/);
      if (!prefix) response.writeHead(302, { location: `/assets/${file}` }).end();
      else if (Object.hasOwn(release.assets, file)) response.writeHead(200).end(release.assets[file]);
      else response.writeHead(404).end('Not Found');
    },
    (origin) => runCommand({ CE_RELEASE_COMMIT: COMMIT, CE_RELEASE_ASSET_BASE_URL: origin }),
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.match(/^verified: /gm)?.length, 3, result.stdout);
  assert.match(result.stdout, new RegExp(`Worker release worker-bundles-${COMMIT} verified`));
});
