import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndexKey, exportCloudflareEncryptedPayloadEnvelopes, storageRoute } from './storageRouteExecution.js';

const PAGE_BYTES = 4 * 1024 * 1024;
const config = { storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'lit' } } };
const fixture = (sizes) => {
  const entries = new Map();
  const payloads = new Map();
  let reads = 0;
  sizes.forEach((size, i) => {
    const id = `payload-${String(i).padStart(8, '0')}`;
    const metadata = { id, resource: 'responses', backend: 'cloudflare', size, encrypted: true,
      payloadAccessControl: { gate: 'none', encryption: 'lit' } };
    entries.set(buildIndexKey({ slug: 'session-a', resource: 'responses', id }), JSON.stringify(metadata));
    payloads.set(`sessions/session-a/storage/${id}`, new Uint8Array(size).fill(7));
  });
  const index = {
    get: async (key) => { reads += 1; return entries.get(key) || null; },
    list: async ({ prefix, cursor = '', limit = 1000 }) => {
      const keys = [...entries.keys()].filter((key) => key.startsWith(prefix)).sort();
      const offset = Number(cursor || 0);
      const end = Math.min(offset + Math.min(limit, 37), keys.length);
      return { keys: keys.slice(offset, end).map((name) => ({ name })), list_complete: end === keys.length, cursor: end === keys.length ? '' : String(end) };
    },
  };
  const env = { CE_STORAGE_INDEX_KV: index, CE_STORAGE_R2: { get: async (key) => {
    const bytes = payloads.get(key);
    return bytes ? { size: bytes.length, arrayBuffer: async () => bytes.buffer } : null;
  } } };
  const run = (cursor = '', overrides = {}) => exportCloudflareEncryptedPayloadEnvelopes({ env, config, slug: 'session-a', resource: 'responses', cursor, ...overrides });
  return { env, run, entries, payloads, get reads() { return reads; } };
};

test('envelope exports round-trip ownership, authority, visibility and group metadata', async () => {
  const f = fixture([2, 2, 2, 2, 2]);
  const identityFields = ['responder', 'uploader', 'uploadAuthority', 'resourceId', 'hidden', 'groupIds'];
  const question = { resource: 'questions', uploader: '0x00000000000000000000000000000000000000aa',
    uploadAuthority: 'admin', resourceId: 'owned-question', hidden: true };
  const response = { responder: '0x00000000000000000000000000000000000000bb', groupIds: ['response-group'],
    payloadAccessControl: { gate: 'group_gate', encryption: 'lit', groupIds: ['nested-group', 'other-group'] } };
  const empty = { responder: '', uploader: '', uploadAuthority: '', resourceId: '', hidden: false, groupIds: [],
    payloadAccessControl: { gate: 'none', encryption: 'lit', groupIds: [] } };
  const nullable = { ...Object.fromEntries(identityFields.map((field) => [field, null])),
    payloadAccessControl: { gate: 'none', encryption: 'lit', groupIds: null } };
  const patches = [question, response, {}, empty, nullable];
  const stored = [...f.entries.entries()].map(([key, raw], i) => {
    const metadata = { ...JSON.parse(raw), ...patches[i] };
    f.entries.delete(key);
    f.entries.set(buildIndexKey({ slug: 'session-a', resource: metadata.resource, id: metadata.id }), JSON.stringify(metadata));
    return metadata;
  });

  const exported = await storageRoute({
    path: '/storage/export-envelopes', method: 'GET', request: new Request('https://worker.example/storage/export-envelopes'),
    env: f.env, config, slug: 'session-a', authScopes: { admin: true }, deps: {},
  });
  assert.equal(exported.status, 200);
  const archive = await exported.json();
  assert.equal(archive.manifest.version, 1);
  assert.equal(archive.manifest.metadataFields, 'identity_v1');
  assert.equal(archive.payloads.length, stored.length);
  const byId = new Map(archive.payloads.map((entry) => [entry.storageRef.id, entry]));
  for (const metadata of stored) {
    const entry = byId.get(metadata.id);
    for (const field of identityFields) {
      assert.equal(Object.hasOwn(entry.metadata, field), Object.hasOwn(metadata, field), `${metadata.id}: ${field} presence`);
      if (Object.hasOwn(metadata, field)) assert.deepEqual(entry.metadata[field], metadata[field], `${metadata.id}: ${field}`);
    }
    assert.equal(Object.hasOwn(entry.metadata.payloadAccessControl, 'groupIds'), Object.hasOwn(metadata.payloadAccessControl, 'groupIds'));
    if (Object.hasOwn(metadata.payloadAccessControl, 'groupIds')) {
      assert.deepEqual(entry.metadata.payloadAccessControl.groupIds, metadata.payloadAccessControl.groupIds);
    }
    assert.deepEqual(Buffer.from(entry.ciphertextBase64url, 'base64url'), Buffer.from([7, 7]));
  }
});

test('envelope exports omit inherited identity and group metadata', async () => {
  const f = fixture([2]);
  const [key, raw] = [...f.entries.entries()][0];
  const inherited = { responder: 'inherited', uploader: 'inherited', uploadAuthority: 'admin', resourceId: 'inherited', hidden: true, groupIds: ['inherited'] };
  const metadata = Object.assign(Object.create(inherited), JSON.parse(raw));
  metadata.payloadAccessControl = Object.assign(Object.create({ groupIds: ['inherited'] }), metadata.payloadAccessControl);
  f.entries.set(key, metadata);
  const exported = await f.run();
  assert.equal(exported.ok, true);
  const projected = exported.payloads[0].metadata;
  for (const field of Object.keys(inherited)) assert.equal(Object.hasOwn(projected, field), false, field);
  assert.equal(Object.hasOwn(projected.payloadAccessControl, 'groupIds'), false);
});

test('exports more than 600 rows in bounded resumable pages without omissions or duplicates', async () => {
  const f = fixture(Array(637).fill(2));
  const ids = [];
  let cursor = '';
  let pages = 0;
  do {
    const readsBefore = f.reads;
    const result = await f.run(cursor);
    assert.equal(result.ok, true);
    assert.ok(f.reads - readsBefore <= 100);
    assert.equal(result.manifest.countScope, 'page');
    assert.equal(result.manifest.exportedPayloadCount, result.payloads.length);
    assert.equal(result.manifest.encryptedPayloadCount, result.payloads.length);
    assert.equal(result.listComplete, !result.cursor);
    assert.equal(result.manifest.partial, !!result.cursor);
    ids.push(...result.payloads.map((entry) => entry.storageRef.id));
    cursor = result.cursor;
    assert.ok(++pages < 25, 'cursor must advance');
  } while (cursor);
  assert.ok(pages > 1);
  assert.equal(ids.length, 637);
  assert.equal(new Set(ids).size, 637);
});

test('byte limits resume within a KV page without losing the deferred row', async () => {
  const f = fixture([2 * 1024 * 1024, 2 * 1024 * 1024, 2]);
  const first = await f.run();
  assert.equal(first.ok, true);
  assert.equal(first.payloads.length, 1);
  assert.equal(first.listComplete, false);
  assert.ok(Buffer.byteLength(JSON.stringify(first.payloads)) <= PAGE_BYTES);
  const next = await f.run(first.cursor);
  assert.equal(next.ok, true);
  assert.equal(next.payloads.length, 2);
  assert.equal(next.listComplete, true);
  assert.equal(new Set([...first.payloads, ...next.payloads].map((entry) => entry.storageRef.id)).size, 3);
});

test('rejects malformed and cross-session/resource export cursors before reads', async () => {
  const f = fixture(Array(38).fill(2));
  const first = await f.run();
  for (const [cursor, overrides] of [
    ['broken', {}], [{ lastKey: 'x' }, {}], [first.cursor, { slug: 'other' }], [first.cursor, { resource: 'questions' }], [first.cursor, { config: { ...config, sessionId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } }],
  ]) {
    const before = f.reads;
    const result = await f.run(cursor, overrides);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(f.reads, before);
  }
});

test('oversized singleton fails explicitly without advancing past the record', async () => {
  const f = fixture([PAGE_BYTES, 2]);
  const result = await f.run();
  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
  assert.equal(result.listComplete, false);
  assert.ok(result.cursor);
  assert.match(result.error, /streaming|backing storage/i);
  assert.ok(result.storageRef?.id);
  const retry = await f.run(result.cursor);
  assert.equal(retry.status, 413);
  assert.equal(retry.cursor, result.cursor);
  assert.deepEqual(retry.storageRef, result.storageRef);
});

test('authenticated export GET and POST forward a usable continuation cursor', async () => {
  const f = fixture(Array(38).fill(2));
  const first = await f.run();
  for (const method of ['GET', 'POST']) {
    const url = method === 'GET'
      ? `https://worker.example/storage/export-envelopes?resource=responses&cursor=${encodeURIComponent(first.cursor)}`
      : 'https://worker.example/storage/export-envelopes';
    const response = await storageRoute({
      path: '/storage/export-envelopes', method, request: new Request(url, method === 'POST' ? { method, body: JSON.stringify({ resource: 'responses', cursor: first.cursor }) } : {}),
      env: f.env, config, slug: 'session-a', authScopes: { admin: true }, deps: {},
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.payloads.length, 1);
    assert.equal(body.listComplete, true);
    assert.equal(body.cursor, null);
  }
});

test('earlier unreadable records keep a terminal page explicitly partial', async () => {
  const f = fixture(Array(38).fill(2));
  f.payloads.delete([...f.payloads.keys()][0]);
  const first = await f.run();
  assert.equal(first.manifest.partial, true);
  assert.equal(first.manifest.readErrors.length, 1);
  const last = await f.run(first.cursor);
  assert.equal(last.listComplete, true);
  assert.equal(last.manifest.partial, true);
});

test('a transient metadata read failure resumes after already exported rows', async () => {
  const f = fixture([2, 2, 2]);
  const original = f.env.CE_STORAGE_INDEX_KV.get;
  let fail = true;
  f.env.CE_STORAGE_INDEX_KV.get = async (key) => {
    if (fail && key.endsWith('00000001')) throw new Error('temporary index failure');
    return original(key);
  };
  const first = await f.run();
  assert.equal(first.ok, false);
  assert.equal(first.status, 503);
  assert.equal(first.payloads.length, 1);
  assert.equal(first.manifest.partial, true);
  fail = false;
  const last = await f.run(first.cursor);
  assert.equal(last.payloads.length, 2);
  assert.equal(last.listComplete, true);
  assert.equal(new Set([...first.payloads, ...last.payloads].map((entry) => entry.storageRef.id)).size, 3);
});

test('persistent list failures return explicit incomplete errors rather than successful cursor loops', async () => {
  const f = fixture(Array(38).fill(2));
  const first = await f.run();
  f.env.CE_STORAGE_INDEX_KV.list = async () => { throw new Error('index unavailable'); };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await f.run(first.cursor);
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.cursor, first.cursor);
    assert.equal(result.listComplete, false);
    assert.equal(result.manifest.partial, true);
    assert.match(result.error, /retry|incomplete/i);
  }
  const response = await storageRoute({ path: '/storage/export-envelopes', method: 'GET',
    request: new Request(`https://worker.example/storage/export-envelopes?resource=responses&cursor=${first.cursor}`),
    env: f.env, config, slug: 'session-a', authScopes: { admin: true }, deps: {} });
  assert.equal(response.status, 503);
});

test('storage export preserves the held cursor and record identity on an oversized response', async () => {
  const f = fixture([PAGE_BYTES]);
  const response = await storageRoute({ path: '/storage/export-envelopes', method: 'GET',
    request: new Request('https://worker.example/storage/export-envelopes?resource=responses'), env: f.env, config,
    slug: 'session-a', authScopes: { admin: true }, deps: {} });
  assert.equal(response.status, 413);
  const body = await response.json();
  assert.ok(body.cursor);
  assert.equal(body.listComplete, false);
  assert.ok(body.storageRef.id);
});
