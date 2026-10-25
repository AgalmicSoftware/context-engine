import test from 'node:test';
import assert from 'node:assert/strict';
import { readRegistryMetadata, fetchArweaveJson, arweaveIdToHex, hexToArweaveId } from './registryPayloads.mjs';

const id = Buffer.alloc(32, 7).toString('base64url');
const payload = { slug: 'test-session', sessionName: 'Test session' };

test('reads bounded inline metadata and supported Arweave URI forms', async () => {
  for (const uri of [`ar://${id}`, id, `https://arweave.net/${id}`, `https://ar-io.dev/raw/${id}`]) {
    const seen = [];
    assert.deepEqual(await readRegistryMetadata(uri, { fetchImpl: async (url) => {
      seen.push(url);
      return Response.json(payload);
    } }), payload);
    assert.equal(seen[0], `https://ar-io.dev/${id}`);
  }
  for (const uri of [
    `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`,
    `data:application/json;base64,${Buffer.from(JSON.stringify(payload)).toString('base64')}`,
  ]) assert.deepEqual(await readRegistryMetadata(uri), payload);
  assert.equal(hexToArweaveId(arweaveIdToHex(id)), id);
  await assert.rejects(readRegistryMetadata('ar://too-short'), /Arweave|metadata/);
  await assert.rejects(readRegistryMetadata(`data:application/json,${'x'.repeat(300000)}`), /too large/);
});

test('Arweave retries both normal and raw gateway paths and caps streamed bodies', async () => {
  const seen = [];
  const result = await fetchArweaveJson(id, { fetchImpl: async (url, init) => {
    seen.push(url);
    assert.equal(init.redirect, 'manual');
    assert.ok(init.signal);
    return seen.length < 4 ? new Response('', { status: 404 }) : Response.json(payload);
  } });
  assert.deepEqual(result, payload);
  assert.deepEqual(seen, [`https://ar-io.dev/${id}`, `https://ar-io.dev/raw/${id}`, `https://arweave.net/${id}`, `https://arweave.net/raw/${id}`]);
  await assert.rejects(fetchArweaveJson(id, { fetchImpl: async () => new Response('x'.repeat(262145)) }), /too large/);
});

test('gateway redirects stay within the original gateway family', async () => {
  const requests = [];
  await assert.rejects(fetchArweaveJson(id, { fetchImpl: async (url) => {
    requests.push(url);
    return new Response(null, { status: 302, headers: { location: `https://other.example/${id}` } });
  } }), /redirect/);
  assert.equal(requests.some((url) => url.includes('other.example')), false);
  let calls = 0;
  const result = await fetchArweaveJson(id, { fetchImpl: async () => ++calls === 1
    ? new Response(null, { status: 302, headers: { location: `https://sandbox.ar-io.dev/${id}` } })
    : Response.json(payload) });
  assert.deepEqual(result, payload);
});
