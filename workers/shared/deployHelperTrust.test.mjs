import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDeployHelperRequest } from './deployHelperCore.mjs';
import { fetchExpectedWorkerBundleDigest } from './workerReleaseManifest.mjs';

const assetUrl = 'https://assets.example/worker-release-manifest.json';
const manifestOptions = { manifestUrl: assetUrl, artifactFile: 'sessionCorsWorker.bundle.js', artifactKind: 'session-cors-worker' };

for (const deploymentKind of [undefined, 'agent_session_wrapped']) {
  test(`account authority precedes every artifact read (${deploymentKind || 'session'})`, async () => {
    const calls = [];
    const result = await executeDeployHelperRequest({
      body: { apiToken: 'fixture-invalid', accountId: 'attacker-selected', workerName: 'fixture-worker',
        deploymentKind, bundleUrl: 'https://assets.example/worker.js', bundleManifestUrl: assetUrl },
      fetchImpl: async (url) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ success: false, errors: [{ message: 'Invalid token' }] }), { status: 403 });
      },
    });
    assert.equal(result.ok, false);
    assert.deepEqual(calls, ['https://api.cloudflare.com/client/v4/accounts?per_page=5']);
  });
}

test('missing token cannot trigger a manifest fetch or trust a body-supplied resolved account', async () => {
  const result = await executeDeployHelperRequest({
    body: { resolvedAccountId: 'fake-account', bundleManifestUrl: assetUrl },
    fetchImpl: async () => { assert.fail('no network for missing credentials'); },
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /Missing apiToken/);
});

for (const target of [
  'http://public.example/worker-release-manifest.json',
  'https://user:[redacted-email]/worker-release-manifest.json',
  'https://127.1/worker-release-manifest.json',
  'https://8.8.8.8/worker-release-manifest.json',
  'https://[::ffff:127.0.0.1]/worker-release-manifest.json',
  'https://[2001:4860:4860::8888]/worker-release-manifest.json',
  'https://metadata.google.internal/worker-release-manifest.json',
  'https://files.local/worker-release-manifest.json',
]) {
  test(`artifact target is rejected before fetching: ${target}`, async () => {
    let calls = 0;
    const result = await fetchExpectedWorkerBundleDigest({ ...manifestOptions, manifestUrl: target,
      fetchImpl: async () => { calls += 1; return new Response('{}'); },
    });
    assert.equal(result.ok, false);
    assert.equal(calls, 0);
  });
  test(`artifact redirect is rejected before fetching: ${target}`, async () => {
    const calls = [];
    const result = await fetchExpectedWorkerBundleDigest({ ...manifestOptions,
      fetchImpl: async (url, options) => {
        calls.push(String(url));
        assert.equal(options.redirect, 'manual');
        return new Response(null, { status: 302, headers: { location: target } });
      },
    });
    assert.equal(result.ok, false);
    assert.deepEqual(calls, [assetUrl]);
  });
}

for (const length of [null, '1']) {
  test(`manifest stops actual oversize before parsing with length ${length}`, async () => {
    let cancelled = false;
    let pulls = 0;
    const result = await fetchExpectedWorkerBundleDigest({ ...manifestOptions,
      fetchImpl: async () => new Response(new ReadableStream({
        pull(controller) { pulls += 1; if (pulls <= 3) controller.enqueue(new Uint8Array(1024 * 1024)); else controller.close(); },
        cancel() { cancelled = true; },
      }, { highWaterMark: 0 }), { headers: length ? { 'content-length': length } : {} }),
    });
    assert.equal(result.ok, false);
    assert.equal(cancelled, true);
    assert.equal(pulls, 2);
    assert.match(result.error, /exceeds/);
  });
}

test('artifact redirects can follow the release alias and CDN with no credentials forwarded', async () => {
  const { fetchArtifactText } = await import('./artifactFetch.mjs');
  const calls = [];
  const text = await fetchArtifactText('https://assets.example/latest/worker.js', {
    fetchImpl: async (url, options) => {
      calls.push(String(url));
      assert.equal(options.redirect, 'manual');
      assert.equal(new Headers(options.headers).get('authorization'), null);
      if (calls.length === 1) return new Response(null, { status: 302, headers: { location: '../v1/worker.js' } });
      if (calls.length === 2) return new Response(null, { status: 307, headers: { location: 'https://cdn.example/worker.js?signature=fixture' } });
      return new Response('export default { fetch() {} };');
    },
  });
  assert.equal(text, 'export default { fetch() {} };');
  assert.deepEqual(calls, ['https://assets.example/latest/worker.js', 'https://assets.example/v1/worker.js', 'https://cdn.example/worker.js?signature=fixture']);
});

test('artifact redirect loops stop after five validated hops', async () => {
  const { fetchArtifactText } = await import('./artifactFetch.mjs');
  let calls = 0;
  await assert.rejects(fetchArtifactText('https://assets.example/start', {
    fetchImpl: async () => { calls += 1; return new Response(null, { status: 302, headers: { location: '/again' } }); },
  }), /Too many redirects/);
  assert.equal(calls, 6);
});

for (const length of [null, '1']) {
  test(`bundle read cancels observed oversize (${length})`, async () => {
    const { fetchArtifactText } = await import('./artifactFetch.mjs');
    let cancelled = false;
    let pulls = 0;
    await assert.rejects(fetchArtifactText('https://assets.example/worker.js', {
      fetchImpl: async () => new Response(new ReadableStream({
        pull(controller) { pulls += 1; if (pulls <= 12) controller.enqueue(new Uint8Array(1024 * 1024)); else controller.close(); },
        cancel() { cancelled = true; },
      }, { highWaterMark: 0 }), { headers: length ? { 'content-length': length } : {} }),
    }), /exceeds/);
    assert.equal(pulls, 11);
    assert.equal(cancelled, true);
  });
}
