import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installSessionCoordinatorBinding, createSignedSiweBody, makeJsonRequest } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerRuntime } from './worker.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
import { storageRoute } from './storageRouteExecution.js';
import { exportSessionBackup as exportPage } from './sessionBackup.js';
import { STORAGE_EXPORT_PAGE_LIMITS } from './storageScanBudget.js';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { workerGroupBackupPrefixes, coordinateWorkerGroupBackup, executeCoordinatedWorkerGroupMutation } from './workerGroups.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createWorkerClient } from '../../mcp/lib/workerClient.mjs';
import { selectCanonicalStorageVersions } from '../../shared/storage/canonicalStorageVersions.mjs';
import { getSessionSecrets, putSessionSecrets } from './sessionConfigSecretsStore.js';
import { updateSessionSecretsAfterLitRepair } from './sessionLitAuthorizationCoordinator.js';
import { decryptSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';
import { recoveryKeyFingerprint } from '../shared/recoveryKey.mjs';

const slug = 'restore-fixture';
const sessionId = `0x${'3'.repeat(32)}`;
const admin = `0x${'1'.repeat(40)}`;
const expectedAuthority = { actor: admin, revision: 1, authzEpoch: 0 };
const memoryKv = () => {
  const values = new Map();
  const gets = new Map();
  const requests = [];
  let operations = null;
  const operation = () => { if (operations != null && ++operations > 1000) throw new Error('KV request exceeded 1000 operations'); };
  return { values, gets, requests,
    request: async (callback) => {
      operations = 0;
      try { return await callback(); } finally { requests.push(operations); operations = null; }
    },
    get: async (key) => { operation(); gets.set(key, (gets.get(key) || 0) + 1); return values.get(key) ?? null; },
    put: async (key, value) => { operation(); return values.set(key, value); },
    delete: async (key) => { operation(); return values.delete(key); },
    list: async ({ prefix = '', cursor = '', limit = 100 } = {}) => {
      operation();
      const names = [...values.keys()].filter((key) => key.startsWith(prefix) && key > cursor).sort();
      const keys = names.slice(0, limit).map((name) => ({ name }));
      return { keys, list_complete: names.length <= limit, cursor: names.length > limit ? keys.at(-1).name : '' };
    } };
};
const memoryR2 = () => {
  const objects = new Map();
  return {
    get: async (key) => {
      const item = objects.get(key);
      return item ? { key, size: item.bytes.length, customMetadata: item.customMetadata,
        httpMetadata: item.httpMetadata, arrayBuffer: async () => item.bytes.slice().buffer } : null;
    },
    put: async (key, bytes, options = {}) => objects.set(key, { bytes: new Uint8Array(bytes), ...options }),
    delete: async (key) => objects.delete(key),
    list: async ({ prefix = '', cursor = '', limit = 1000 } = {}) => {
      const names = [...objects.keys()].filter((key) => key.startsWith(prefix) && key > cursor).sort();
      const page = names.slice(0, limit);
      return { objects: page.map((key) => ({ key })), truncated: names.length > limit,
        cursor: names.length > limit ? page.at(-1) : '' };
    },
  };
};
const fixture = (CoordinatorClass) => {
  const kv = memoryKv();
  const env = installSessionCoordinatorBinding({ GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'a'.repeat(64), TOKEN_HMAC_SECRET: 'synthetic-hmac',
  }, CoordinatorClass);
  kv.values.set(`session:${slug}:config`, JSON.stringify({ slug, sessionId, adminAddress: admin,
    chainId: 11155420, registryChainId: 11155420, storageProfile: { mode: 'pure', metadata: 'cloudflare', answers: 'cloudflare',
      payloadAccessControl: { gate: 'public', encryption: 'none' } } }));
  return { env, kv };
};

test('backup pages preserve all storage records and chunk payloads larger than a page', async () => {
  const { env, kv } = fixture();
  const id = 'cf_backup_large';
  const metadata = { id, resource: 'responses', responder: admin, storageLayer: 'kv', size: 5 * 1024 * 1024 };
  const bytes = Buffer.alloc(metadata.size, 120);
  kv.values.set(`ce-storage:${slug}:responses:${id}`, JSON.stringify(metadata));
  kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: bytes.toString('base64url') }));
  kv.values.set(`ce-storage-hidden:${slug}:questions:0xabc`, '{"hidden":true}');
  kv.values.set(`ce-storage-owner:${slug}:questions:0xabc`, '{"uploader":"legacy-admin-only"}');
  const pages = [];
  let cursor = '';
  do {
    const page = await exportSessionBackup({ env, slug, expectedAuthority, cursor });
    assert.equal(page.ok, true, JSON.stringify(page));
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= STORAGE_EXPORT_PAGE_LIMITS.encodedBytes);
    pages.push(page);
    cursor = page.nextCursor;
  } while (cursor);
  assert.ok(pages.length > 1);
  assert.equal(pages.at(-1).manifest.complete, true);
  assert.equal(pages[0].coordinator.configAuthority.config.sessionId, sessionId);
  const entries = pages.flatMap((page) => page.entries);
  assert.deepEqual(entries.find((entry) => entry.kind === 'record').metadata, metadata);
  assert.equal(entries.filter((entry) => entry.kind === 'owner').length, 1);
  assert.equal(entries.filter((entry) => entry.kind === 'hidden').length, 1);
  const restored = Buffer.concat(entries.filter((entry) => entry.kind === 'chunk').map((entry) => Buffer.from(entry.base64url, 'base64url')));
  assert.deepEqual(restored, bytes);
  assert.doesNotMatch(JSON.stringify(pages), new RegExp(env.CE_STORAGE_ENVELOPE_KEK));
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  let result;
  for (const page of pages) {
    result = await importPage(target.env, page);
    assert.equal(result.ok, true, JSON.stringify(result));
  }
  assert.equal(result.body.complete, true);
  assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith('ce-import-chunk:')).length, 0);
  const restoredEnvelope = JSON.parse(await target.kv.get(`ce-storage-payload:${slug}:${id}`));
  assert.deepEqual(Buffer.from(restoredEnvelope.payloadBase64url, 'base64url'), bytes);
});

test('restore refuses missing or altered pages, foreign keys, and mismatched session ids', async () => {
  const source = fixture();
  const [original] = await allPages(source.env);
  const fresh = () => { const target = fixture(); target.kv.values.delete(`session:${slug}:config`); return target; };
  for (const modify of [
    (page) => { page.manifest.type = 'unknown'; },
    (page) => { page.entries.push({ kind: 'owner', key: 'session:another:secrets', value: '{}' }); },
    (page) => { page.manifest.counts.records += 1; },
    (page) => { page.coordinator.configAuthority.config.sessionId = `0x${'8'.repeat(32)}`; },
    (page) => { page.pageNumber = 1; },
  ]) {
    const target = fresh();
    const page = structuredClone(original);
    modify(page);
    const result = await importPage(target.env, page);
    assert.equal(result.ok, false);
    assert.equal(await target.kv.get(`session:${slug}:config`), null);
  }
  const target = fresh();
  assert.equal((await importPage(target.env, original)).ok, true);
  const changed = structuredClone(original);
  changed.extra = 'different signed page';
  assert.equal((await importPage(target.env, changed, 1)).status, 403);
});

test('backup export requires the signed admin action and sends no-store', async () => {
  const { ethers } = createRequire(new URL('../../package.json', import.meta.url))('ethers');
  const wallet = new ethers.Wallet(`0x${'4'.repeat(64)}`);
  const { env, kv } = fixture();
  const config = JSON.parse(await kv.get(`session:${slug}:config`));
  config.adminAddress = wallet.address;
  config.allowOrigins = ['https://app.example'];
  await kv.put(`session:${slug}:config`, JSON.stringify(config));
  const worker = createWorkerRuntime(env);
  const path = '/admin/export-session-backup';
  assert.notEqual((await worker.fetch(makeJsonRequest(path, { slug }), env)).status, 200);
  const body = await createSignedSiweBody({ worker, env, wallet, sessionSlug: slug, adminAction: 'export-session-backup',
    adminOrigin: 'https://app.example', audience: 'https://app.example', body: { slug } });
  const response = await worker.fetch(makeJsonRequest(path, body, { headers: { Origin: 'https://app.example' } }), env);
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://app.example');
  assert.equal(response.headers.get('Vary'), 'Origin');
  assert.equal(result.manifest.type, 'ce_session_backup');
});

test('signed backup replies identify config, group, and invalid-cursor restarts', async () => {
  const { ethers } = createRequire(new URL('../../package.json', import.meta.url))('ethers');
  const wallet = new ethers.Wallet(`0x${'4'.repeat(64)}`);
  for (const change of ['config', 'groups', 'cursor']) {
    const { env, kv } = largeArchiveSource();
    env.CE_WORKER_GROUPS_BOOTSTRAP = 'fresh-template-v2';
    const config = JSON.parse(await kv.get(`session:${slug}:config`));
    Object.assign(config, { adminAddress: wallet.address, allowOrigins: ['https://app.example'] });
    await kv.put(`session:${slug}:config`, JSON.stringify(config));
    const authority = { ...expectedAuthority, actor: wallet.address };
    const first = await exportSessionBackup({ env, slug, expectedAuthority: authority });
    assert.ok(first.nextCursor);
    if (change === 'config') {
      const updated = await callSessionConfigCoordinator({ env, slug, path: 'mutate', expectedAuthority: authority,
        mutation: { kind: 'set-config', incomingConfig: { ...config, name: 'Changed session' } } });
      assert.equal(updated.ok, true, JSON.stringify(updated));
    }
    if (change === 'groups') {
      const result = await executeCoordinatedWorkerGroupMutation({ env, slug, sessionId, expectedAuthority: authority, operation: 'create',
        input: { groupId: 'new-group', label: 'New group', joinMode: 'open' }, actorPrincipal: { kind: 'evm_address', address: wallet.address } });
      assert.equal(result.ok, true, JSON.stringify(result));
    }
    const worker = createWorkerRuntime(env);
    const body = await createSignedSiweBody({ worker, env, wallet, sessionSlug: slug, adminAction: 'export-session-backup',
      adminOrigin: 'https://app.example', audience: 'https://app.example',
      body: { slug, cursor: change === 'cursor' ? 'invalid-cursor' : first.nextCursor } });
    const response = await worker.fetch(makeJsonRequest('/admin/export-session-backup', body,
      { headers: { Origin: 'https://app.example' } }), env);
    const reply = await response.json();
    assert.equal(response.status, change === 'cursor' ? 403 : 409, JSON.stringify(reply));
    assert.equal(reply.reason, change === 'cursor' ? 'backup_cursor_invalid' : 'backup_session_changed');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

const exportSessionBackup = async (args) => {
  for (;;) {
    const page = await args.env.GROUP_KV.request(() => exportPage(args));
    if (!page.preparing) return page;
    assert.ok(page.nextCursor && page.nextCursor !== args.cursor);
    args = { ...args, cursor: page.nextCursor };
  }
};
const allPages = async (env) => {
  const pages = [];
  let cursor = '';
  do {
    const page = await exportSessionBackup({ env, slug, expectedAuthority, cursor });
    pages.push(page);
    cursor = page.nextCursor;
  } while (cursor);
  return pages;
};
const importPage = async (env, page, revision = 0) => {
  for (let tries = 0; tries < 200; tries += 1) {
    const result = await env.GROUP_KV.request(() => callSessionConfigCoordinator({ env, slug, path: 'backup/import',
      expectedAuthority: { ...expectedAuthority, revision }, page, adoptSessionId: true }));
    if (!result.ok || result.body.pageComplete !== false) return result;
    revision = (await callSessionConfigCoordinator({ env, slug, path: 'current' })).body.revision;
  }
  assert.fail('Import page did not finish within its bounded continuations');
};

test('backup export refuses modified, unsigned, or foreign-session cursors before scanning storage', async () => {
  const source = fixture();
  for (let n = 0; n < 120; n += 1) {
    const id = `cf_cursor_${String(n).padStart(3, '0')}`;
    const metadata = { id, resource: 'responses', responder: admin, storageLayer: 'kv', size: 6 };
    source.kv.values.set(`ce-storage:${slug}:responses:${id}`, JSON.stringify(metadata));
    source.kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: Buffer.from('answer').toString('base64url') }));
  }
  const first = await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  assert.ok(first.nextCursor);
  const [encoded, mac] = first.nextCursor.split('.');
  const original = JSON.parse(Buffer.from(encoded, 'base64url').toString());
  for (const mutate of [
    (cursor) => { cursor.continuation.lastKey = `ce-storage-payload:${slug}:cf_cursor_119`; },
    (cursor) => { cursor.continuation.phase = 6; },
    (cursor) => { cursor.continuation.writeRevision += 2; },
    (cursor) => { cursor.continuation.counts.records += 1; },
    (cursor) => { cursor.continuation.exportedAt = new Date(0).toISOString(); },
    (cursor) => { cursor.continuation.pageNumber += 1; },
    (cursor) => { cursor.continuation.archiveId = '0'.repeat(64); },
    (cursor) => { cursor.prefix = 'ce-backup:other-session:'; },
    (cursor) => { cursor.sessionId = `0x${'8'.repeat(64)}`; },
  ]) {
    const changed = structuredClone(original);
    mutate(changed);
    const cursor = Buffer.from(JSON.stringify(changed)).toString('base64url') + (mac ? `.${mac}` : '');
    source.kv.gets.clear();
    await assert.rejects(exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor }),
      (error) => error.status === 403 && error.reason === 'backup_cursor_invalid');
    assert.equal(source.kv.gets.size, 0, 'No payload or config reads after a forged cursor');
  }
  await assert.rejects(exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: encoded }),
    (error) => error.reason === 'backup_cursor_invalid');
  await callSessionConfigCoordinator({ env: source.env, slug, path: 'backup/write-revision' });
  const stale = await exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: first.nextCursor });
  assert.equal(stale.reason, 'backup_session_changed', 'A valid cursor cannot conceal concurrent writes');
});

test('restore validates recovery keys and refuses a completed archive on a nonempty target', async () => {
  const source = fixture();
  const metadata = { id: 'cf_restore_answer', resource: 'responses', responder: admin, size: 5, storageLayer: 'kv' };
  const indexKey = `ce-storage:${slug}:responses:${metadata.id}`;
  const payloadKey = `ce-storage-payload:${slug}:${metadata.id}`;
  source.kv.values.set(indexKey, JSON.stringify(metadata));
  source.kv.values.set(payloadKey, JSON.stringify({ metadata, payloadBase64url: Buffer.from('hello').toString('base64url') }));
  const [page] = await allPages(source.env);
  for (const mode of ['same', 'previous', 'unrelated', 'conflict']) {
    const target = fixture();
    target.kv.values.delete(`session:${slug}:config`);
    if (mode === 'previous' || mode === 'unrelated') target.env.CE_STORAGE_ENVELOPE_KEK = 'b'.repeat(64);
    if (mode === 'previous') target.env.CE_STORAGE_ENVELOPE_PREVIOUS_KEK = source.env.CE_STORAGE_ENVELOPE_KEK;
    if (mode === 'conflict') target.kv.values.set(indexKey, '{"different":true}');
    const result = await importPage(target.env, page);
    if (mode === 'unrelated') {
      assert.equal(result.status, 409);
      assert.equal(result.body.reason, 'recovery_key_mismatch');
      assert.equal(target.kv.values.size, 0);
    } else if (mode === 'conflict') {
      assert.equal(result.status, 409);
      assert.equal(result.body.reason, 'backup_target_not_empty');
      assert.deepEqual([...target.kv.values], [[indexKey, '{"different":true}']]);
    } else {
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.body.complete, true);
      assert.equal(result.body.counts.conflicts, 0);
      assert.equal(await target.kv.get(indexKey), JSON.stringify(metadata));
      const replay = await importPage(target.env, page, 1);
      assert.equal(replay.status, 409);
      assert.equal(replay.body.reason, 'backup_target_not_empty');
    }
  }
});

test('a chunked coordinator snapshot and R2 payload restore into KV without publishing partial config', async () => {
  const source = fixture();
  const groupKey = `${workerGroupBackupPrefixes({ slug, sessionId })[0]}large-group`;
  source.kv.values.set(groupKey, JSON.stringify({ description: 'x'.repeat(4 * 1024 * 1024) }));
  const id = 'cf_r2_backup';
  const metadata = { id, resource: 'responses', responder: admin, storageLayer: 'r2', size: 3 };
  const objectKey = `sessions/${slug}/storage/${id}`;
  source.kv.values.set(`ce-storage:${slug}:responses:${id}`, JSON.stringify(metadata));
  source.env.CE_STORAGE_R2 = {
    get: async (key) => key === objectKey ? { size: 3, arrayBuffer: async () => Buffer.from('r2!') } : null,
    list: async () => ({ objects: [{ key: objectKey }], truncated: false }),
  };
  const pages = await allPages(source.env);
  assert.equal(pages[0].coordinator.chunked, true);
  assert.ok(pages.length > 1);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  for (const page of pages) {
    const result = await importPage(target.env, page);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.body.complete, page.manifest.complete);
    assert.equal(!!await target.kv.get(`session:${slug}:config`), page.manifest.complete);
  }
  assert.equal(await target.kv.get(groupKey), await source.kv.get(groupKey));
  const stored = JSON.parse(await target.kv.get(`ce-storage-payload:${slug}:${id}`));
  assert.deepEqual(stored.metadata, metadata);
  assert.equal(Buffer.from(stored.payloadBase64url, 'base64url').toString(), 'r2!');
});

test('an interrupted payload write resumes the same page without duplicate or lost records', async () => {
  const source = fixture();
  const id = 'cf_interrupted_restore';
  const metadata = { id, resource: 'responses', size: 5 };
  source.kv.values.set(`ce-storage:${slug}:responses:${id}`, JSON.stringify(metadata));
  source.kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: Buffer.from('hello').toString('base64url') }));
  const [page] = await allPages(source.env);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  const put = target.kv.put;
  let interrupted = false;
  target.kv.put = async (key, value) => {
    if (key.startsWith('ce-storage-payload:') && !interrupted) { interrupted = true; throw new Error('synthetic storage outage'); }
    return put(key, value);
  };
  assert.equal((await importPage(target.env, page)).status, 503);
  const retry = await importPage(target.env, page);
  assert.equal(retry.ok, true, JSON.stringify(retry));
  assert.equal(retry.body.complete, true);
  assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith('ce-storage-payload:')).length, 1);
  assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith('ce-import-chunk:')).length, 0);
});

test('fresh signed restore requires the deployment bootstrap admin and explicit identity adoption', async () => {
  const { ethers } = createRequire(new URL('../../package.json', import.meta.url))('ethers');
  const wallet = new ethers.Wallet(`0x${'4'.repeat(64)}`);
  const stranger = new ethers.Wallet(`0x${'5'.repeat(64)}`);
  const source = fixture();
  const [page] = await allPages(source.env);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  Object.assign(target.env, { BOOTSTRAP_ADMIN_ADDRESS: wallet.address, ADMIN_TRUSTED_ORIGINS: 'https://app.example' });
  const worker = createWorkerRuntime(target.env);
  const call = async (signer, adoptSessionId) => {
    const body = await createSignedSiweBody({ worker, env: target.env, wallet: signer, sessionSlug: slug,
      adminAction: 'import-session-backup', audience: 'https://app.example', body: { page, adoptSessionId } });
    return worker.fetch(makeJsonRequest('/admin/import-session-backup', body, { headers: { Origin: 'https://app.example' } }), target.env);
  };
  assert.equal((await call(stranger, true)).status, 403);
  assert.equal((await call(wallet, false)).status, 403);
  const occupiedKey = `ce-agent:${sessionId}:agent:credential:v2:fixture`;
  target.kv.values.set(occupiedKey, '{"type":"agent_credential"}');
  const refused = await call(wallet, true);
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).reason, 'backup_target_not_empty');
  assert.equal(await target.kv.get(`session:${slug}:config`), null);
  assert.equal(await target.kv.get(occupiedKey), '{"type":"agent_credential"}');
  target.kv.values.delete(occupiedKey);
  const response = await call(wallet, true);
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.complete, true);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://app.example');
  assert.equal(response.headers.get('Vary'), 'Origin');
});

test('legacy group rows are backed up only for the matching immutable identity', async () => {
  const source = fixture();
  const group = { sessionSlug: slug, sessionId, groupId: 'legacy' };
  const groupKey = `ce-worker-group:${slug}:legacy`;
  source.kv.values.set(groupKey, JSON.stringify(group));
  source.kv.values.set(`ce-worker-group-index:${slug}:legacy`, 'legacy');
  source.kv.values.set(`ce-worker-group:${slug}:another`, JSON.stringify({ ...group, groupId: 'another', sessionId: `0x${'8'.repeat(32)}` }));
  source.kv.values.set(`ce-worker-group-index:${slug}:another`, 'another');
  const [page] = await allPages(source.env);
  assert.equal(page.coordinator.workerGroups.records.length, 2);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  const result = await importPage(target.env, page);
  assert.equal(result.body.complete, true, JSON.stringify(result));
  assert.equal(await target.kv.get(groupKey), JSON.stringify(group));
  assert.equal(await target.kv.get(`ce-worker-group:${slug}:another`), null);
});

for (const absentSlug of [false, true]) test(`backup preserves secrets and punctuated owned ids (absent slug=${absentSlug})`, async () => {
  const source = fixture();
  const config = JSON.parse(await source.kv.get(`session:${slug}:config`));
  if (absentSlug) delete config.slug;
  await source.kv.put(`session:${slug}:config`, JSON.stringify(config));
  await putSessionSecrets(source.env, slug, { openaiKey: 'synthetic-secret' });
  const ownerKey = `ce-storage-owner:${slug}:questions:fixture.question:v1`;
  source.kv.values.set(ownerKey, '{"uploader":"legacy-admin-only"}');
  const [page] = await allPages(source.env);
  assert.equal(page.coordinator.secrets.cipher, 'AES-256-GCM');
  assert.doesNotMatch(JSON.stringify(page), /synthetic-secret/);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  const result = await importPage(target.env, page);
  assert.equal(result.body.complete, true, JSON.stringify(result));
  assert.equal(await target.kv.get(ownerKey), await source.kv.get(ownerKey));
  assert.equal(await target.kv.get(`session:${slug}:secrets`), await source.kv.get(`session:${slug}:secrets`));
});

for (const [sourceR2, targetR2] of [[false, false], [false, true], [true, true], [true, false]])
test(`restore drill preserves reads, authority, groups and secrets (R2 ${sourceR2} to ${targetR2})`, async (t) => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  const { ethers } = createRequire(new URL('../../package.json', import.meta.url))('ethers');
  const wallets = [4, 5, 6].map((digit) => new ethers.Wallet(`0x${String(digit).repeat(64)}`));
  const [owner, participant] = wallets;
  const source = fixture();
  if (sourceR2) source.env.CE_STORAGE_R2 = memoryR2();
  const config = JSON.parse(await readFile(new URL('../../tests/fixtures/worker-compat/previous-minor.json', import.meta.url))).config;
  Object.assign(config, { slug, sessionId, sessionIdHex: sessionId, adminAddress: owner.address,
    allowOrigins: ['https://app.example'], corsWorkerUrl: 'https://worker.example',
    workerAuthority: { version: 1, participantScopes: ['storage', 'groups', 'ai'] }, groupCreationPolicy: 'admin_only' });
  delete config.resultsAnalysis;
  await source.kv.put(`session:${slug}:config`, JSON.stringify(config));
  Object.assign(source.env, { CE_WORKER_GROUPS_BOOTSTRAP: 'fresh-template-v2', ADMIN_TRUSTED_ORIGINS: 'https://app.example' });
  const connect = (target) => {
    const calls = [];
    const worker = createWorkerRuntime(target.env, { now: () => clock, fetch: async (url, init) => {
      assert.match(String(url), /api\.openai\.com/);
      assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer synthetic-backup-ai-key');
      calls.push(String(url));
      return Response.json({ choices: [{ message: { content: 'Recovered secret works.' } }] });
    }, rpcFetch: async () => { throw new Error('Unexpected network call'); } });
    const clients = wallets.map((wallet) => createWorkerClient({ workerOrigin: 'https://worker.example', slug,
      trustedOrigins: ['https://app.example'], wallet,
      fetchImpl: (url, init) => worker.fetch(new Request(url, init), target.env, { waitUntil() {} }) }));
    const signed = async (action, body = {}, status = 200) => {
      clock += 61_000;
      const signedBody = await createSignedSiweBody({ worker, env: target.env, wallet: owner, sessionSlug: slug, sessionId,
        adminAction: action, audience: 'https://app.example', body });
      const response = await worker.fetch(makeJsonRequest(`/admin/${action}`, signedBody, { headers: { Origin: 'https://app.example' } }), target.env);
      const value = await response.json();
      assert.equal(response.status, status, `${action}: ${JSON.stringify(value)}`);
      return value;
    };
    return { clients, signed, calls };
  };
  const a = connect(source);
  const questionId = `0x${'7'.repeat(64)}`;
  const hiddenId = `0x${'8'.repeat(64)}`;
  const question = { id: questionId, type: 'text', prompt: 'Original prompt', sessionId, sessionSlug: slug };
  await a.clients[1].upload({ resource: 'questions', data: JSON.stringify(question) });
  const correction = await a.clients[0].upload({ resource: 'questions', data: JSON.stringify({ ...question, prompt: 'Corrected prompt' }) });
  const hidden = await a.clients[1].upload({ resource: 'questions', data: JSON.stringify({ ...question, id: hiddenId, prompt: 'Hidden prompt' }) });
  await a.signed('storage/set-hidden', { resource: 'questions', id: hiddenId, hidden: true });
  const plain = await a.clients[1].upload({ resource: 'responses', data: JSON.stringify({ questionID: questionId, answer: { value: 'Plain answer' } }) });
  await a.signed('groups/create', { group: { groupId: 'reviewers', label: 'Reviewers', joinMode: 'admin_add', memberVisibility: 'admin_only' } });
  for (const wallet of [owner, participant]) await a.signed('groups/add-member', { groupId: 'reviewers', principal: { kind: 'evm_address', address: wallet.address } });
  // Preserve optional hashed-token fields exactly as an older membership
  // format may have stored them; raw tokens never enter the archive.
  const memberPrefix = workerGroupBackupPrefixes({ slug, sessionId })[2];
  for (const [key, value] of source.kv.values) if (key.startsWith(memberPrefix)) {
    await source.kv.put(key, JSON.stringify({ ...JSON.parse(value), tokenHash: 'a1'.repeat(32) }));
  }
  config.storageProfile.payloadAccessControl = { gate: 'none', encryption: 'worker_envelope' };
  config.sessionModeProfile.storage.payloadAccessControl = { gate: 'none', encryption: 'worker_envelope' };
  config.sessionModeProfile.encryption.mode = 'worker_envelope';
  config.sessionModeProfile.encryption.keyProvider = 'worker_secret';
  config.sessionModeProfile.results.visibility = 'session_member_aggregate';
  await a.signed('set-config', { config });
  await a.signed('set-secrets', { secrets: { openaiKey: 'synthetic-backup-ai-key' } });
  const encrypted = await a.clients[1].upload({ resource: 'responses', data: JSON.stringify({ questionID: questionId, answer: { value: 'Encrypted answer' } }) });
  const grouped = await a.clients[1].request('/storage/upload', { method: 'POST', auth: true, body: {
    resource: 'responses', backend: 'cloudflare', contentType: 'application/json', groupIds: ['reviewers'],
    data: JSON.stringify({ questionID: hiddenId, answer: { value: 'Group answer' } }),
  } });
  const large = await a.clients[0].upload({ resource: 'docsContext', data: JSON.stringify({ text: 'z'.repeat(5 * 1024 * 1024) }) });
  const pages = [];
  let cursor = '';
  do { const page = await a.signed('export-session-backup', { cursor }); pages.push(page); cursor = page.nextCursor; } while (cursor);
  assert.ok(pages.length > 1);
  assert.doesNotMatch(JSON.stringify(pages), /synthetic-backup-ai-key|Encrypted answer|Group answer/);
  assert.ok(pages[0].coordinator.workerGroups.records.some(([, value]) => value.includes('a1'.repeat(32))));
  for (const previous of [false, true]) {
    const target = fixture();
    if (targetR2) target.env.CE_STORAGE_R2 = memoryR2();
    target.kv.values.delete(`session:${slug}:config`);
    Object.assign(target.env, { BOOTSTRAP_ADMIN_ADDRESS: owner.address, ADMIN_TRUSTED_ORIGINS: 'https://app.example', CE_WORKER_GROUPS_BOOTSTRAP: 'fresh-template-v2' });
    target.env.CE_STORAGE_ENVELOPE_KEK = source.env.CE_STORAGE_ENVELOPE_KEK.toUpperCase();
    if (previous) { target.env.CE_STORAGE_ENVELOPE_PREVIOUS_KEK = source.env.CE_STORAGE_ENVELOPE_KEK.toUpperCase(); target.env.CE_STORAGE_ENVELOPE_KEK = 'b'.repeat(64); }
    const b = connect(target);
    for (const page of pages) {
      const result = await b.signed('import-session-backup', { page, adoptSessionId: true });
      assert.equal(result.complete, page.manifest.complete);
      assert.equal(result.counts.conflicts, 0);
    }
    for (const client of [b.clients[0], b.clients[1]]) {
      assert.equal((await client.read(plain.id)).answer.value, 'Plain answer');
      assert.equal((await client.read(encrypted.id)).answer.value, 'Encrypted answer');
      assert.equal((await client.read(grouped.id)).answer.value, 'Group answer');
    }
    await assert.rejects(b.clients[2].read(encrypted.id), (error) => error.status === 403);
    await assert.rejects(b.clients[2].read(grouped.id), (error) => error.status === 403);
    assert.equal((await b.clients[1].listAll('responses')).items.length, 3);
    assert.equal((await b.clients[0].listAll('responses')).items.length, 3);
    assert.equal((await b.clients[2].listAll('responses')).items.length, 0);
    const publicQuestions = await b.clients[1].listAll('questions');
    assert.ok(publicQuestions.complete);
    assert.ok(publicQuestions.items.some((row) => row.storageRef?.id === correction.id));
    assert.equal(publicQuestions.items.some((row) => row.storageRef?.id === hidden.id), false);
    const adminQuestions = await b.clients[0].listAll('questions');
    assert.ok(adminQuestions.items.some((row) => row.hidden && row.metadata.resourceId === hiddenId));
    const canonical = selectCanonicalStorageVersions(publicQuestions.items.filter((row) => row.storageRef).map((row) => ({
      ...row.metadata, storageRefId: row.storageRef.id, createdAtMs: Date.parse(row.metadata.createdAt),
    })));
    assert.equal(canonical.length, 1);
    assert.equal((await b.clients[1].read(canonical[0].storageRefId)).prompt, 'Corrected prompt');
    const document = await b.clients[0].request(`/storage/read?id=${large.id}`, { auth: true, maxBytes: 8 * 1024 * 1024 });
    assert.equal(document.text.length, 5 * 1024 * 1024);
    const members = await b.signed('groups/list-members', { groupId: 'reviewers' });
    assert.deepEqual(members.members.map((member) => member.principal.address).sort(), [owner.address.toLowerCase(), participant.address.toLowerCase()].sort());
    await b.clients[0].request('/ai', { method: 'POST', auth: true, body: { provider: 'openai', prompt: 'Use restored credentials.' } });
    assert.equal(b.calls.length, 1);
    await b.signed('groups/remove-member', { groupId: 'reviewers', principal: { kind: 'evm_address', address: participant.address } });
    await assert.rejects(b.clients[1].read(grouped.id), (error) => error.status === 403);
    assert.equal((await b.clients[1].read(encrypted.id)).answer.value, 'Encrypted answer');
    if (previous && !sourceR2 && !targetR2) {
      const newAnswer = await b.clients[1].upload({ resource: 'responses',
        data: JSON.stringify({ questionID: questionId, answer: { value: 'Written after restore' } }) });
      const chainedPages = [];
      let nextCursor = '';
      do {
        const page = await b.signed('export-session-backup', { cursor: nextCursor });
        chainedPages.push(page);
        nextCursor = page.nextCursor;
      } while (nextCursor);
      const next = fixture();
      next.kv.values.delete(`session:${slug}:config`);
      Object.assign(next.env, { CE_STORAGE_ENVELOPE_KEK: target.env.CE_STORAGE_ENVELOPE_KEK,
        BOOTSTRAP_ADMIN_ADDRESS: owner.address, ADMIN_TRUSTED_ORIGINS: 'https://app.example' });
      const c = connect(next);
      const denied = await c.signed('import-session-backup', { page: chainedPages[0], adoptSessionId: true }, 409);
      assert.equal(denied.reason, 'recovery_key_mismatch');
      assert.ok(denied.error.includes(await recoveryKeyFingerprint(source.env.CE_STORAGE_ENVELOPE_KEK)));
      assert.equal(next.kv.values.size, 0, 'Reject missing keys before staging or importing data');
      next.env.CE_STORAGE_ENVELOPE_PREVIOUS_KEK = source.env.CE_STORAGE_ENVELOPE_KEK;
      for (const page of chainedPages) await c.signed('import-session-backup', { page, adoptSessionId: true });
      assert.equal((await c.clients[1].read(encrypted.id)).answer.value, 'Encrypted answer');
      assert.equal((await c.clients[1].read(newAnswer.id)).answer.value, 'Written after restore');
    }
  }
  const unrelated = fixture();
  unrelated.kv.values.delete(`session:${slug}:config`);
  Object.assign(unrelated.env, { BOOTSTRAP_ADMIN_ADDRESS: owner.address, ADMIN_TRUSTED_ORIGINS: 'https://app.example', CE_STORAGE_ENVELOPE_KEK: 'c'.repeat(64) });
  const denied = await connect(unrelated).signed('import-session-backup', { page: pages[0], adoptSessionId: true }, 409);
  assert.equal(denied.reason, 'recovery_key_mismatch');
  assert.equal([...unrelated.kv.values.keys()].filter((key) => key.startsWith('ce-storage')).length, 0);
});


for (const unsigned of [false, true]) test(`restore rejects unauthenticated participant records before writing (unsigned=${unsigned})`, async () => {
  const source = fixture();
  const [page] = await allPages(source.env);
  if (unsigned) delete page.authentication;
  else {
    const bytes = Buffer.from(JSON.stringify({ questionID: '0xabc', answer: { value: 'Forged' } }));
    const metadata = { id: 'cf_forged_answer', resource: 'responses', responder: `0x${'2'.repeat(40)}`,
      createdAt: '2020-01-01T00:00:00.000Z', size: bytes.length, storageLayer: 'kv' };
    page.entries.push(
      { kind: 'payload', id: metadata.id, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), chunkCount: 1, metadata },
      { kind: 'chunk', id: metadata.id, index: 0, base64url: bytes.toString('base64url') },
      { kind: 'record', id: metadata.id, resource: metadata.resource, key: `ce-storage:${slug}:responses:${metadata.id}`, metadata },
    );
    Object.assign(page.manifest.counts, { records: 1, payloads: 1, bytes: bytes.length });
  }
  const before = [...source.kv.values];
  const denied = await importPage(source.env, page, 1);
  assert.equal(denied.status, 403, JSON.stringify(denied));
  assert.equal(denied.body.reason, 'backup_authentication_failed');
  assert.deepEqual([...source.kv.values], before);
});

const largeArchiveSource = () => {
  const source = fixture();
  const config = JSON.parse(source.kv.values.get(`session:${slug}:config`));
  config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } };
  source.kv.values.set(`session:${slug}:config`, JSON.stringify(config));
  const id = 'cf_abandon_fixture';
  const metadata = { id, resource: 'responses', size: 5 * 1024 * 1024 };
  source.kv.values.set(`ce-storage:${slug}:responses:${id}`, JSON.stringify(metadata));
  source.kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: Buffer.alloc(metadata.size, 120).toString('base64url') }));
  return source;
};
const restoreControl = (env, operation, archiveId, revision = 0) => callSessionConfigCoordinator({ env, slug,
  path: `backup/${operation}`, expectedAuthority: { ...expectedAuthority, revision }, archiveId });

test('failed and repeated group requests preserve a running backup; successful changes invalidate it', async () => {
  const source = largeArchiveSource();
  source.env.CE_WORKER_GROUPS_BOOTSTRAP = 'fresh-template-v2';
  const principal = { kind: 'evm_address', address: `0x${'7'.repeat(40)}` };
  const mutate = (operation, groupId, extra = {}) => executeCoordinatedWorkerGroupMutation({
    env: source.env, slug, sessionId, expectedAuthority, operation, groupId, principal, actorPrincipal: principal, ...extra,
  });
  assert.equal((await mutate('create', 'open', { input: { groupId: 'open', label: 'Open', joinMode: 'open' } })).ok, true);
  assert.equal((await mutate('create', 'closed', { input: { groupId: 'closed', label: 'Closed', joinMode: 'admin_add' } })).ok, true);
  assert.equal((await mutate('join', 'open')).ok, true);
  let page = await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  assert.ok(page.nextCursor);
  const groupStore = [...source.env.__coordinatorInstances.values()].find(({ store }) => store.has('worker-group-capacity-meta-v3')).store;
  const revision = groupStore.get('storage-backup-revision');
  for (const [operation, groupId, extra, ok] of [
    ['join', 'missing', {}, false],
    ['remove-member', 'missing', {}, false],
    ['join', 'closed', {}, false],
    ['update', 'open', { input: { memberLimit: -1 } }, false],
    ['join', 'open', {}, true],
    ['join', 'open', {}, true],
  ]) {
    assert.equal((await mutate(operation, groupId, extra)).ok, ok);
    assert.equal(groupStore.get('storage-backup-revision'), revision, operation);
  }
  do {
    page = await exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: page.nextCursor });
    assert.equal(page.ok, true);
  } while (page.nextCursor);
  assert.equal(page.manifest.complete, true);
  page = await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  assert.equal((await mutate('remove-member', 'open')).ok, true);
  assert.equal(groupStore.get('storage-backup-revision'), revision + 1);
  await assert.rejects(exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: page.nextCursor }), (error) => error.status === 409 && error.reason === 'backup_session_changed');
});

test('an interrupted group write blocks snapshots until replay records its successful change', async () => {
  const source = largeArchiveSource();
  source.env.CE_WORKER_GROUPS_BOOTSTRAP = 'fresh-template-v2';
  const principal = { kind: 'evm_address', address: `0x${'7'.repeat(40)}` };
  const mutate = (operation, extra = {}) => executeCoordinatedWorkerGroupMutation({
    env: source.env, slug, sessionId, expectedAuthority, operation, groupId: 'open', principal, actorPrincipal: principal, ...extra,
  });
  await mutate('create', { input: { groupId: 'open', label: 'Open', joinMode: 'open' } });
  const page = await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  const groupStore = [...source.env.__coordinatorInstances.values()].find(({ store }) => store.has('worker-group-capacity-meta-v3')).store;
  const revision = groupStore.get('storage-backup-revision');
  const put = source.kv.put;
  let interrupt = true;
  source.kv.put = async (key, value) => {
    await put(key, value);
    if (interrupt && key.startsWith('ce-worker-group-member:')) { interrupt = false; throw new Error('Lost membership write reply'); }
  };
  assert.equal((await mutate('join')).reason, 'worker_group_mutation_ambiguous');
  assert.equal(groupStore.get('storage-backup-revision'), revision);
  await assert.rejects(exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: page.nextCursor }), /group mutation is pending/i);
  assert.equal((await mutate('join')).ok, true);
  assert.equal(groupStore.get('storage-backup-revision'), revision + 1);
  assert.equal([...groupStore.keys()].some((key) => key.startsWith('worker-group-backup-pending:')), false);
  await assert.rejects(exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: page.nextCursor }), (error) => error.status === 409 && error.reason === 'backup_session_changed');
});

test('a lost group finalization reply leaves no orphan backup blocker', async () => {
  class InterruptedCoordinator extends SessionWriteCoordinator {
    async activateWorkerGroupCapacity(group) {
      await super.activateWorkerGroupCapacity(group);
      throw new Error('Lost group finalization reply');
    }
  }
  const source = fixture(InterruptedCoordinator);
  source.env.CE_WORKER_GROUPS_BOOTSTRAP = 'fresh-template-v2';
  const result = await executeCoordinatedWorkerGroupMutation({ env: source.env, slug, sessionId, expectedAuthority, operation: 'create',
    input: { groupId: 'open', label: 'Open', joinMode: 'open' }, actorPrincipal: { kind: 'evm_address', address: admin } });
  assert.equal(result.status, 503);
  const pages = await allPages(source.env);
  assert.equal(pages.at(-1).manifest.complete, true);
  assert.ok(pages[0].coordinator.workerGroups.records.some(([key]) => key.startsWith('ce-worker-group:')));
});

test('restore refuses targets containing config, rows, payloads, groups, or keys', async () => {
  const [page] = await allPages(fixture().env);
  for (const kind of ['config', 'record', 'payload', 'owner', 'hidden', 'r2', 'group', 'group-durable', 'secret', 'signer']) {
    const target = fixture();
    if (kind !== 'config') target.kv.values.delete(`session:${slug}:config`);
    const keys = {
      record: `ce-storage:${slug}:responses:cf_existing`, payload: `ce-storage-payload:${slug}:cf_existing`,
      owner: `ce-storage-owner:${slug}:questions:0xabc`, hidden: `ce-storage-hidden:${slug}:questions:0xabc`,
      group: `${workerGroupBackupPrefixes({ slug, sessionId })[0]}existing`, secret: `session:${slug}:secrets`,
    };
    if (keys[kind]) target.kv.values.set(keys[kind], '{}');
    if (kind === 'r2') {
      target.env.CE_STORAGE_R2 = memoryR2();
      await target.env.CE_STORAGE_R2.put(`sessions/${slug}/storage/cf_existing`, Buffer.from('existing'));
    }
    if (kind === 'group-durable') {
      await coordinateWorkerGroupBackup({ env: target.env, slug, sessionId, operation: 'export' });
      const store = [...target.env.__coordinatorInstances.values()].find(({ store }) => [...store.keys()].some((key) => key.startsWith('worker-group-backup-meta:'))).store;
      store.set('worker-group-capacity-meta-v3', { slug, sessionId, groupCount: 1 });
    }
    if (kind === 'signer') {
      await callSessionConfigCoordinator({ env: target.env, slug, path: 'current' });
      [...target.env.__coordinatorInstances.values()][0].store.set('session-lit-authorization-signer-v1', { version: 1 });
    }
    const before = [...target.kv.values];
    const result = await importPage(target.env, page, kind === 'config' ? 1 : 0);
    assert.equal(result.status, 409, `${kind}: ${JSON.stringify(result)}`);
    assert.equal(result.body.reason, 'backup_target_not_empty', kind);
    assert.deepEqual([...target.kv.values], before, 'Refused import must not write or delete session rows');
  }
});

test('abandonment removes imported visibility and payload rows before a different archive can start', async () => {
  const source = fixture();
  const hiddenKey = `ce-storage-hidden:${slug}:questions:0xabc`;
  source.kv.values.set(hiddenKey, '{"hidden":true}');
  for (let n = 0; n < 120; n += 1) {
    const id = `cf_a${String(n).padStart(3, '0')}`;
    const metadata = { id, resource: 'responses', size: 6 };
    source.kv.values.set(`ce-storage:${slug}:responses:${id}`, JSON.stringify(metadata));
    source.kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: Buffer.from('answer').toString('base64url') }));
  }
  const older = await allPages(source.env);
  assert.ok(older.length > 1);
  source.kv.values.delete(hiddenKey);
  const newer = await allPages(source.env);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  for (const page of older.slice(0, -1)) assert.equal((await importPage(target.env, page)).ok, true);
  assert.ok(await target.kv.get(hiddenKey));
  assert.equal((await importPage(target.env, newer[0])).body.reason, 'backup_restore_in_progress');
  let batches = 0;
  for (;;) {
    const result = await restoreControl(target.env, 'abandon', older[0].archiveId);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (result.body.complete) break;
    assert.ok(++batches < 20);
  }
  assert.equal(target.kv.values.size, 0, 'All rows from the abandoned archive are removed');
  let result;
  for (const page of newer) result = await importPage(target.env, page);
  assert.equal(result.body.complete, true, JSON.stringify(result));
  assert.equal(result.body.counts.conflicts, 0);
  assert.equal(await target.kv.get(hiddenKey), null, 'The new archive does not inherit the old visibility marker');
});

test('abandonment journals every storage kind before a write and resumes interrupted deletions', async () => {
  const source = fixture();
  const metadata = { id: 'cf_journal', resource: 'responses', storageLayer: 'kv', size: 6 };
  source.kv.values.set(`ce-storage:${slug}:responses:cf_journal`, JSON.stringify(metadata));
  source.kv.values.set(`ce-storage-payload:${slug}:cf_journal`, JSON.stringify({ metadata, payloadBase64url: Buffer.from('answer').toString('base64url') }));
  source.kv.values.set(`ce-storage-hidden:${slug}:questions:0xabc`, '{"hidden":true}');
  source.kv.values.set(`ce-storage-owner:${slug}:questions:0xabc`, '{"uploader":"legacy-admin-only"}');
  source.kv.values.set(`${workerGroupBackupPrefixes({ slug, sessionId })[0]}fixture`, '{}');
  await putSessionSecrets(source.env, slug, { openaiKey: 'synthetic-journal-secret' });
  await callSessionConfigCoordinator({ env: source.env, slug, path: 'backup/export', expectedAuthority });
  [...source.env.__coordinatorInstances.values()][0].store.set('session-lit-authorization-signer-v1', {
    version: 1, slug, envelope: JSON.parse(await source.kv.get(`session:${slug}:secrets`)),
  });
  await coordinateWorkerGroupBackup({ env: source.env, slug, sessionId, operation: 'export' });
  const groupStore = [...source.env.__coordinatorInstances.values()].find(({ store }) => [...store.keys()].some((key) => key.startsWith('worker-group-backup-meta:'))).store;
  groupStore.set('worker-group-capacity-meta-v3', { version: 3, slug, sessionId, phase: 'ready', groupCount: 1 });
  const [page] = await allPages(source.env);
  assert.equal(page.manifest.complete, true);
  const failures = [
    `ce-storage:${slug}:`, `ce-storage-payload:${slug}:`, `ce-storage-hidden:${slug}:`, `ce-storage-owner:${slug}:`,
    'ce-worker-group:', 'worker-group-capacity-meta-v3', `session:${slug}:secrets`,
    'session-lit-authorization-signer-v1', `sessions/${slug}/storage/`, 'ce-import-stage:',
  ];
  for (const prefix of failures) {
    let interrupted = false;
    const failAfterWrite = (key) => {
      if (!interrupted && key.startsWith(prefix)) { interrupted = true; throw new Error('Synthetic lost write reply'); }
    };
    class InterruptedCoordinator extends SessionWriteCoordinator {
      constructor(state, env) {
        super(state, env);
        const put = state.storage.put;
        state.storage.put = async (key, value) => { await put(key, value); failAfterWrite(key); };
      }
    }
    const target = fixture(InterruptedCoordinator);
    target.kv.values.delete(`session:${slug}:config`);
    const put = target.kv.put;
    target.kv.put = async (key, value) => { await put(key, value); failAfterWrite(key); };
    if (prefix.startsWith('sessions/')) {
      target.env.CE_STORAGE_R2 = memoryR2();
      const putObject = target.env.CE_STORAGE_R2.put;
      target.env.CE_STORAGE_R2.put = async (key, bytes, options) => { await putObject(key, bytes, options); failAfterWrite(key); };
    }
    const result = await importPage(target.env, page);
    assert.equal(result.status, 503, `${prefix}: ${JSON.stringify(result)}`);
    assert.equal(interrupted, true, prefix);
    assert.equal(await target.kv.get(`session:${slug}:config`), null);
    const list = target.kv.list;
    target.kv.list = async (options) => options.prefix.startsWith('ce-import-stage:')
      ? { keys: [], list_complete: true } : list(options);
    const mutation = await callSessionConfigCoordinator({ env: target.env, slug, path: 'mutate',
      expectedAuthority: { ...expectedAuthority, revision: 0 }, mutation: { action: 'set-config', config: {} } });
    assert.equal(mutation.status, 409, 'An unfinished restore prevents concurrent config publication');
    let interruptedDelete = false;
    const remove = target.kv.delete;
    target.kv.delete = async (key) => {
      await remove(key);
      if (!interruptedDelete) { interruptedDelete = true; throw new Error('Synthetic lost delete reply'); }
    };
    assert.equal((await restoreControl(target.env, 'abandon', page.archiveId)).status, 503);
    let cleaned = false;
    for (let n = 0; n < 20 && !cleaned; n += 1) {
      const abandoned = await restoreControl(target.env, 'abandon', page.archiveId);
      assert.equal(abandoned.ok, true, JSON.stringify(abandoned));
      cleaned = abandoned.body.complete;
    }
    assert.equal(cleaned, true);
    assert.equal(target.kv.values.size, 0, prefix);
    if (target.env.CE_STORAGE_R2) assert.equal((await target.env.CE_STORAGE_R2.list()).objects.length, 0);
    for (const { store } of target.env.__coordinatorInstances.values()) {
      assert.equal([...store.keys()].some((key) => /^(session-backup-import|worker-group-capacity-|worker-group-backup-import|session-lit-authorization-signer)/.test(key)), false, prefix);
    }
  }
});

test('unfinished restores can be abandoned, expire, and never abandon a published config', async () => {
  const source = largeArchiveSource();
  const pages = await allPages(source.env);
  for (const expired of [false, true]) {
    const target = fixture();
    target.kv.values.delete(`session:${slug}:config`);
    assert.equal((await importPage(target.env, pages[0])).ok, true);
    const status = await restoreControl(target.env, 'status');
    assert.equal(status.body.restore.inProgress, true);
    assert.equal(status.body.restore.canAbandon, true);
    if (expired) {
      const store = [...target.env.__coordinatorInstances.values()][0].store;
      const key = `session-backup-import:${pages[0].archiveId}`;
      store.set(key, { ...store.get(key), expiresAt: 1 });
      assert.equal((await restoreControl(target.env, 'status')).body.restore, null);
    } else {
      assert.equal((await restoreControl(target.env, 'abandon', '0'.repeat(64))).status, 409);
      for (let n = 0; n < 500; n += 1) target.kv.values.set(`ce-import-stage:${slug}:${pages[0].archiveId}:test:${n}`, 'chunk');
      let batches = 0;
      for (;;) {
        const abandoned = await restoreControl(target.env, 'abandon', pages[0].archiveId);
        assert.equal(abandoned.ok, true, JSON.stringify(abandoned));
        batches += 1;
        if (abandoned.body.complete) break;
        assert.ok(batches < 10);
      }
      assert.ok(batches > 1);
    }
    assert.equal([...target.kv.values.keys()].some((key) => key.startsWith('ce-import-')), false);
    const empty = fixture();
    const [other] = await allPages(empty.env);
    assert.equal((await importPage(target.env, other)).body.complete, true);
    assert.equal((await restoreControl(target.env, 'abandon', other.archiveId, 1)).status, 409);
    assert.ok(await target.kv.get(`session:${slug}:config`));
  }
});

test('fresh restore status and abandonment require a signed deployment admin', async () => {
  const { ethers } = createRequire(new URL('../../package.json', import.meta.url))('ethers');
  const wallet = new ethers.Wallet(`0x${'4'.repeat(64)}`);
  const stranger = new ethers.Wallet(`0x${'5'.repeat(64)}`);
  const source = largeArchiveSource();
  const page = await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  Object.assign(target.env, { BOOTSTRAP_ADMIN_ADDRESS: wallet.address, ADMIN_TRUSTED_ORIGINS: 'https://app.example' });
  await callSessionConfigCoordinator({ env: target.env, slug, path: 'backup/import', page, adoptSessionId: true,
    expectedAuthority: { actor: wallet.address.toLowerCase(), revision: 0, authzEpoch: 0 } });
  const worker = createWorkerRuntime(target.env);
  const call = async (signer, action) => {
    const body = await createSignedSiweBody({ worker, env: target.env, wallet: signer, sessionSlug: slug,
      adminAction: action, audience: 'https://app.example', body: { archiveId: page.archiveId, adoptSessionId: true } });
    return worker.fetch(makeJsonRequest(`/admin/${action}`, body, { headers: { Origin: 'https://app.example' } }), target.env);
  };
  assert.equal((await call(stranger, 'abandon-session-backup')).status, 403);
  const status = await call(wallet, 'session-backup-status');
  assert.equal(status.status, 200);
  assert.equal((await status.json()).restore.canAbandon, true);
  const response = await call(wallet, 'abandon-session-backup');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).complete, true);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://app.example');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('an upload between export pages makes the archive incomplete and asks for a fresh export', async () => {
  const source = largeArchiveSource();
  const first = await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  assert.ok(first.nextCursor);
  const response = await storageRoute({ path: '/storage/upload', method: 'POST', env: source.env, slug,
    config: JSON.parse(await source.kv.get(`session:${slug}:config`)), uploaderAddress: admin,
    expectedAuthority, request: makeJsonRequest('/storage/upload', { resource: 'responses',
      data: JSON.stringify({ questionID: `0x${'7'.repeat(64)}`, answer: { value: 'During export' } }) }),
    baseHeaders: new Headers(),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const next = await exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: first.nextCursor });
  assert.equal(next.manifest.complete, false);
  assert.equal(next.nextCursor, '');
  assert.equal(next.reason, 'backup_session_changed');
  assert.match(next.error, /session changed during export; export again/i);
});


test('large group snapshots and small payload pages stay within the KV request budget', async (t) => {
  const source = fixture();
  const [, , memberPrefix, principalPrefix] = workerGroupBackupPrefixes({ slug, sessionId });
  for (let n = 0; n < 1000; n += 1) {
    source.kv.values.set(`${memberPrefix}group:${n}`, JSON.stringify({ member: n }));
    source.kv.values.set(`${principalPrefix}${n}:group`, 'group');
  }
  for (let n = 0; n < 150; n += 1) {
    const id = `cf_budget_${String(n).padStart(4, '0')}`;
    const metadata = { id, resource: 'responses', size: 5 };
    source.kv.values.set(`ce-storage:${slug}:responses:${id}`, JSON.stringify(metadata));
    source.kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: Buffer.from('hello').toString('base64url') }));
  }
  const pages = await allPages(source.env);
  assert.equal(pages.at(-1).manifest.complete, true);
  assert.ok(source.kv.requests.every((operations) => operations <= STORAGE_EXPORT_PAGE_LIMITS.operations));
  for (const [key, count] of source.kv.gets) if (key.startsWith(memberPrefix) || key.startsWith(principalPrefix)) assert.equal(count, 1, key);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  let result;
  for (const page of pages) result = await importPage(target.env, page);
  assert.equal(result.body.complete, true, JSON.stringify(result));
  assert.ok(target.kv.requests.every((operations) => operations <= STORAGE_EXPORT_PAGE_LIMITS.operations), JSON.stringify(target.kv.requests));
  assert.deepEqual(result.body.counts, { written: 2301, skipped: 0, conflicts: 0 });
  t.diagnostic(`KV peaks: export ${Math.max(...source.kv.requests)}, import ${Math.max(...target.kv.requests)}; ${source.kv.requests.length} export requests, ${target.kv.requests.length} import requests`);
  assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith(memberPrefix)).length, 1000);
  assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith(`ce-storage:${slug}:responses:`)).length, 150);
});


test('cached group snapshots detect mutations during an export page and reclaim expired chunks', async () => {
  const source = largeArchiveSource();
  const get = source.kv.get;
  let snapshotStore;
  let snapshotKey;
  let changed = false;
  source.kv.get = async (key) => {
    if (!changed && key.startsWith('ce-storage-payload:')) {
      snapshotStore = [...source.env.__coordinatorInstances.values()].find(({ store }) => [...store.keys()].some((name) => name.startsWith('worker-group-backup-meta:'))).store;
      snapshotKey = [...snapshotStore.keys()].find((name) => name.startsWith('worker-group-backup-meta:'));
      snapshotStore.set('storage-backup-revision', 1);
      changed = true;
    }
    return get(key);
  };
  const page = await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  assert.equal(page.reason, 'backup_session_changed');
  assert.equal(page.manifest.complete, false);
  assert.equal(page.nextCursor, '');
  const expiredChunks = [...snapshotStore.keys()].filter((key) => key.includes(':data:'));
  assert.ok(expiredChunks.length);
  snapshotStore.set(snapshotKey, { ...snapshotStore.get(snapshotKey), expiresAt: 1 });
  await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  assert.ok(expiredChunks.every((key) => !snapshotStore.has(key)));
  assert.equal(snapshotStore.has(snapshotKey), false);
});


test('restore refuses live sessions regardless of whether their hidden markers match', async () => {
  const source = fixture();
  const key = `ce-storage-hidden:${slug}:questions:0xabc`;
  const marker = JSON.stringify({ hidden: true, updatedAt: '2026-01-01T00:00:00.000Z' });
  source.kv.values.set(key, marker);
  const pages = await allPages(source.env);
  for (const mode of ['unhidden', 'hidden', 'fresh']) {
    const target = fixture();
    if (mode === 'fresh') target.kv.values.delete(`session:${slug}:config`);
    if (mode === 'hidden') target.kv.values.set(key, marker);
    let result;
    for (const page of pages) result = await importPage(target.env, page, mode === 'fresh' ? 0 : 1);
    assert.equal(result.ok, mode === 'fresh', JSON.stringify(result));
    if (mode === 'fresh') {
      assert.equal(result.body.counts.conflicts, 0);
      assert.equal(result.body.complete, true);
    } else {
      assert.equal(result.status, 409);
      assert.equal(result.body.reason, 'backup_target_not_empty');
    }
    assert.equal(await target.kv.get(key), mode === 'unhidden' ? null : marker);
  }
});

const completedRestoreSource = async () => {
  const source = fixture();
  source.env.CE_WORKER_GROUPS_BOOTSTRAP = 'fresh-template-v2';
  const group = await executeCoordinatedWorkerGroupMutation({ env: source.env, slug, sessionId, expectedAuthority, operation: 'create',
    input: { groupId: 'restored', label: 'Restored', joinMode: 'open' }, actorPrincipal: { kind: 'evm_address', address: admin } });
  assert.equal(group.ok, true);
  for (let n = 0; n < 120; n += 1) {
    const id = `cf_complete_${String(n).padStart(3, '0')}`;
    const metadata = { id, resource: 'responses', responder: admin, storageLayer: 'kv', size: 6 };
    source.kv.values.set(`ce-storage:${slug}:responses:${id}`, JSON.stringify(metadata));
    source.kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: Buffer.from('answer').toString('base64url') }));
  }
  return { source, pages: await allPages(source.env) };
};
const assertCompletedRestoreClean = (target, archiveId) => {
  for (const { store } of target.env.__coordinatorInstances.values()) {
    assert.equal([...store.keys()].some((key) => key.startsWith(`session-backup-import:${archiveId}`)), false,
      'Completion removes journals, descriptors, progress and page receipts in both coordinators');
    assert.equal(store.has('session-backup-import-active'), false);
    assert.equal(store.has('worker-group-backup-import-active'), false);
  }
  assert.equal([...target.kv.values.keys()].some((key) => key.startsWith('ce-import-stage:')), false);
  const completions = [...target.env.__coordinatorInstances.values()].flatMap(({ store }) =>
    [...store].filter(([key]) => key.endsWith('backup-import-completion')));
  assert.equal(completions.length, 2);
  for (const [, value] of completions) {
    assert.equal(value.archiveId, archiveId);
    assert.ok(JSON.stringify(value).length < 512, 'Only a small completion record is kept');
  }
};

test('completed restores clear transient state and cannot replay after KV loss', async () => {
  const { pages } = await completedRestoreSource();
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  for (const page of pages) {
    const result = await importPage(target.env, page);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!page.manifest.complete) {
      const replay = await importPage(target.env, page);
      assert.equal(replay.body.replayed, true, 'Only the active import may replay its page receipts');
    } else assert.equal(result.body.complete, true);
  }
  assertCompletedRestoreClean(target, pages[0].archiveId);
  assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith(`ce-storage:${slug}:responses:`)).length, 120);
  target.kv.values.clear();
  for (const page of pages) {
    const result = await importPage(target.env, page, 1);
    assert.equal(result.status, 409);
    assert.equal(result.body.complete, undefined, 'Surviving receipts must not claim data has been restored');
    assert.equal(result.body.replayed, undefined);
  }
  assert.equal(target.kv.values.size, 0);
  // If the surviving authority is also removed, this really is an empty
  // target: importing the same archive must write its data again.
  for (const { store } of target.env.__coordinatorInstances.values()) {
    store.delete('session-config-authority');
    for (const key of store.keys()) if (key.startsWith('worker-group-capacity-')) store.delete(key);
  }
  for (const page of pages) assert.equal((await importPage(target.env, page)).ok, true);
  assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith(`ce-storage:${slug}:responses:`)).length, 120);
  assertCompletedRestoreClean(target, pages[0].archiveId);
});

test('completion cleanup resumes after lost session or group journal deletion replies', async () => {
  const { pages } = await completedRestoreSource();
  for (const kind of ['index', 'group']) {
    class InterruptedCleanupCoordinator extends SessionWriteCoordinator {
      constructor(state, env) {
        super(state, env);
        const remove = state.storage.delete;
        state.storage.delete = async (key) => {
          const result = await remove(key);
          if (env.interruptCleanup && key.includes(`:journal:${kind}:`)) {
            env.interruptCleanup = false;
            throw new Error('Lost completion cleanup reply');
          }
          return result;
        };
      }
    }
    const target = fixture(InterruptedCleanupCoordinator);
    target.env.interruptCleanup = true;
    target.kv.values.delete(`session:${slug}:config`);
    for (const page of pages.slice(0, -1)) assert.equal((await importPage(target.env, page)).ok, true);
    const interrupted = await importPage(target.env, pages.at(-1));
    assert.equal(interrupted.status, 503, JSON.stringify(interrupted));
    assert.equal(target.env.interruptCleanup, false, 'The fixture must interrupt completion cleanup');
    const result = await importPage(target.env, pages.at(-1));
    assert.equal(result.body.complete, true, JSON.stringify(result));
    assertCompletedRestoreClean(target, pages[0].archiveId);
    assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith(`ce-storage:${slug}:responses:`)).length, 120,
      'Cleanup deletes tracking keys, never restored data');
    assert.ok([...target.kv.values.keys()].some((key) => key.startsWith('ce-worker-group:')));
  }
});

const assertRestoredFixtureRows = (source, target) => {
  for (const [key, value] of source.kv.values) {
    if (key.startsWith(`ce-storage:${slug}:`) || key.startsWith(`ce-storage-payload:${slug}:`)) {
      assert.equal(target.kv.values.get(key), value, key);
    }
  }
};
const restorePageAs = (env, page, actor, revision = 0) => env.GROUP_KV.request(() =>
  callSessionConfigCoordinator({ env, slug, path: 'backup/import', expectedAuthority: { actor, revision, authzEpoch: 0 },
    page, adoptSessionId: true }));
const restartOnEveryRequest = (Base = SessionWriteCoordinator) => class extends Base {
  async fetch(request) { return new SessionWriteCoordinator(this.state, this.env).fetch(request); }
};
const restoreStore = (env) => env.__coordinatorInstances.get(`coordinator:${createHash('sha256').update(`session-config:${slug}`).digest('hex')}`).store;

test('the importing admin keeps authority through cleanup and hands over only when every batch finishes', async () => {
  const { source, pages } = await completedRestoreSource();
  const importer = `0x${'2'.repeat(40)}`;
  const target = fixture(restartOnEveryRequest());
  target.kv.values.delete(`session:${slug}:config`);
  let cleanupBatches = 0;
  let releasedGroupLock = false;
  for (const page of pages) {
    for (let attempts = 0; attempts < 50; attempts += 1) {
      const result = await restorePageAs(target.env, page, importer);
      assert.equal(result.ok, true, JSON.stringify(result));
      if (result.body.complete) break;
      assert.equal(await target.kv.get(`session:${slug}:config`), null, 'Archive admin must not take over during cleanup');
      const progress = restoreStore(target.env).get(`session-backup-import:${page.archiveId}`);
      if (progress.committedAuthority) {
        cleanupBatches += 1;
        assert.equal(progress.committedAuthority.config.adminAddress, admin);
        const refused = await restorePageAs(target.env, page, admin);
        assert.equal(refused.status, 409, 'Only the importing actor continues a committed restore');
        const groupStore = target.env.__coordinatorInstances.get(`coordinator:worker-groups:${slug}:${sessionId}`).store;
        if (!groupStore.has('worker-group-backup-import-active')) {
          releasedGroupLock = true;
          const mutation = await executeCoordinatedWorkerGroupMutation({ env: target.env, slug, sessionId,
            expectedAuthority: { actor: importer, revision: 0, authzEpoch: 0 }, operation: 'create',
            input: { groupId: 'too-early', label: 'Too early', joinMode: 'open' }, actorPrincipal: { kind: 'evm_address', address: importer } });
          assert.equal(mutation.status, 409);
          assert.match(mutation.error, /backup restore is in progress/);
        }
      }
      if (result.body.pageComplete !== false) break;
      assert.ok(attempts < 49, 'Bounded page retries must finish');
    }
  }
  assert.ok(cleanupBatches >= 2, 'The fixture must require several cleanup batches');
  assert.equal(releasedGroupLock, true, 'The session lock must protect the gap after group cleanup');
  assert.equal(JSON.parse(await target.kv.get(`session:${slug}:config`)).adminAddress, admin);
  assertCompletedRestoreClean(target, pages[0].archiveId);
  assertRestoredFixtureRows(source, target);
  assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith(`ce-storage:${slug}:responses:`)).length, 120);
});

test('a committed restore cannot expire or be abandoned and status alone finishes it', async () => {
  const { source, pages } = await completedRestoreSource();
  const importer = `0x${'2'.repeat(40)}`;
  const target = fixture(restartOnEveryRequest());
  target.kv.values.delete(`session:${slug}:config`);
  let committed = false;
  for (const page of pages) {
    for (let attempts = 0; attempts < 50; attempts += 1) {
      const result = await restorePageAs(target.env, page, importer);
      assert.equal(result.ok, true, JSON.stringify(result));
      committed = !!restoreStore(target.env).get(`session-backup-import:${page.archiveId}`)?.committedAuthority;
      if (committed || result.body.pageComplete !== false) break;
      assert.ok(attempts < 49);
    }
    if (committed) break;
  }
  assert.equal(committed, true, 'Verification must leave a durable committed state before cleanup finishes');
  const archiveId = pages[0].archiveId;
  const progress = restoreStore(target.env).get(`session-backup-import:${archiveId}`);
  progress.expiresAt = 0;
  const control = (operation, actor = importer) => callSessionConfigCoordinator({ env: target.env, slug,
    path: `backup/${operation}`, archiveId, expectedAuthority: { actor, revision: 0, authzEpoch: 0 } });
  assert.equal((await control('abandon')).status, 409);
  assert.equal((await control('status', admin)).status, 409);
  for (let attempts = 0; attempts < 50; attempts += 1) {
    const result = await control('status');
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.body.restore) break;
    assert.equal(result.body.restore.canAbandon, false);
    assert.equal(result.body.restore.cleaning, true);
    assert.equal(await target.kv.get(`session:${slug}:config`), null);
    assert.ok(attempts < 49);
  }
  assertCompletedRestoreClean(target, archiveId);
  assertRestoredFixtureRows(source, target);
  assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith(`ce-storage:${slug}:responses:`)).length, 120);
});

test('lost replies at commit, cleanup, handoff and projection recover after a coordinator restart', async () => {
  const { source, pages } = await completedRestoreSource();
  const archiveId = pages[0].archiveId;
  for (const phase of ['commit', 'cleanup', 'handoff', 'projection']) {
    class Interrupted extends SessionWriteCoordinator {
      constructor(state, env) {
        super(state, env);
        const put = state.storage.put;
        state.storage.put = async (key, value) => {
          const result = await put(key, value);
          if (env.interruptPhase === 'commit' && key === `session-backup-import:${archiveId}` && value.committedAuthority) {
            env.interruptPhase = '';
            throw new Error('Lost committed-state reply');
          }
          return result;
        };
        const transaction = state.storage.transaction;
        state.storage.transaction = async (operation) => {
          const result = await transaction(operation);
          if (env.interruptPhase === 'handoff' && await state.storage.get('session-backup-import-completion')) {
            env.interruptPhase = '';
            throw new Error('Lost durable transition reply');
          }
          return result;
        };
        const remove = state.storage.delete;
        state.storage.delete = async (key) => {
          const result = await remove(key);
          if (env.interruptPhase === 'cleanup' && key.includes(':journal:index:') &&
              (await state.storage.get(`session-backup-import:${archiveId}`))?.committedAuthority) {
            env.interruptPhase = '';
            throw new Error('Lost cleanup reply');
          }
          return result;
        };
      }
    }
    const importer = `0x${'2'.repeat(40)}`;
    const target = fixture(restartOnEveryRequest(Interrupted));
    target.kv.values.delete(`session:${slug}:config`);
    target.env.interruptPhase = phase;
    const put = target.kv.put;
    target.kv.put = async (key, value) => {
      const result = await put(key, value);
      if (target.env.interruptPhase === 'projection' && key === `session:${slug}:config`) {
        target.env.interruptPhase = '';
        throw new Error('Lost projection reply');
      }
      return result;
    };
    let lost = false;
    for (const page of pages) {
      for (let attempts = 0; attempts < 50; attempts += 1) {
        const result = await restorePageAs(target.env, page, importer);
        if (!result.ok) {
          assert.equal(result.status, 503, JSON.stringify(result));
          assert.equal(lost, false);
          lost = true;
          if (restoreStore(target.env).has('session-backup-import-completion')) {
            const current = await callSessionConfigCoordinator({ env: target.env, slug, path: 'current' });
            assert.equal(current.body.config.adminAddress, admin);
            break;
          }
        } else if (result.body.pageComplete !== false) break;
        assert.ok(attempts < 49);
      }
    }
    assert.equal(lost, true, phase);
    assert.equal(target.env.interruptPhase, '', phase);
    assertCompletedRestoreClean(target, archiveId);
    assertRestoredFixtureRows(source, target);
    assert.equal([...target.kv.values.keys()].filter((key) => key.startsWith(`ce-storage:${slug}:responses:`)).length, 120, phase);
    assert.equal(JSON.parse(await target.kv.get(`session:${slug}:config`)).adminAddress, admin);
  }
});


test('agent-enabled backup restores canonical records but excludes credentials, invites and managed keys', async () => {
  const source = fixture();
  const key = `session:${slug}:config`;
  const config = JSON.parse(source.kv.values.get(key));
  config.sessionModeProfile = { authority: { mode: 'worker_canonical' }, surfaces: { agentHttp: true } };
  config.agentHttp = { invites: [{ tokenHash: 'b'.repeat(64) }], managedAccountSubmitAllowed: true };
  source.kv.values.set(key, JSON.stringify(config));
  source.env.AGENT_MANAGED_ROOT_SECRET = 'fixture-root-must-stay-out';
  source.kv.values.set(`ce-agent:${sessionId}:agent:credential:v2:fixture`, 'fixture-credential-must-stay-out');
  source.kv.values.set(`ce-agent:${sessionId}:telegram:answer-draft:fixture`, 'fixture-draft-must-stay-out');
  const pages = await allPages(source.env);
  const archive = JSON.stringify(pages);
  assert.doesNotMatch(archive, /fixture-root-must-stay-out|fixture-credential-must-stay-out|fixture-draft-must-stay-out/);
  assert.equal(archive.includes('b'.repeat(64)), false);
  const target = fixture(); target.kv.values.delete(key);
  for (const page of pages) assert.equal((await importPage(target.env, page)).ok, true);
  const restored = JSON.parse(target.kv.values.get(key));
  assert.equal(restored.agentHttp.invites, undefined);
  assert.equal(restored.agentHttp.managedAccountSubmitAllowed, true);
  assert.equal([...target.kv.values.keys()].some(key => key.startsWith(`ce-agent:${sessionId}:`)), false);
});

const uploadBackupDocument = async (source, { data = '', tags = [] } = {}) => storageRoute({
  path: '/storage/upload', method: 'POST', env: source.env, slug,
  config: JSON.parse(await source.kv.get(`session:${slug}:config`)), uploaderAddress: admin,
  expectedAuthority, request: makeJsonRequest('/storage/upload', { resource: 'docsContext', data, tags, contentType: 'text/plain' }),
  baseHeaders: new Headers(),
});

for (const mode of ['plaintext-kv', 'encrypted-kv', 'plaintext-r2']) {
  test(`accepted empty ${mode} documents export, import and remain readable`, async () => {
    const source = fixture();
    const config = JSON.parse(await source.kv.get(`session:${slug}:config`));
    config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: mode === 'encrypted-kv' ? 'worker_envelope' : 'none' } };
    await source.kv.put(`session:${slug}:config`, JSON.stringify(config));
    if (mode === 'plaintext-r2') source.env.CE_STORAGE_R2 = memoryR2();
    const response = await uploadBackupDocument(source);
    assert.equal(response.status, 200, await response.clone().text());
    const { id } = await response.json();
    const pages = await allPages(source.env);
    assert.equal(pages.at(-1).manifest.complete, true);
    assert.equal(pages.at(-1).manifest.counts.payloads, 1);
    const target = fixture();
    target.kv.values.delete(`session:${slug}:config`);
    if (mode === 'plaintext-r2') target.env.CE_STORAGE_R2 = memoryR2();
    for (const page of pages) {
      const imported = await importPage(target.env, page);
      assert.equal(imported.ok, true, JSON.stringify(imported));
    }
    assert.deepEqual(JSON.parse(await target.kv.get(`ce-storage:${slug}:docsContext:${id}`)),
      JSON.parse(await source.kv.get(`ce-storage:${slug}:docsContext:${id}`)));
    const read = await storageRoute({ path: '/storage/read', method: 'GET', env: target.env, slug,
      config: JSON.parse(await target.kv.get(`session:${slug}:config`)), uploaderAddress: admin,
      request: new Request(`https://worker.example/storage/read?id=${id}`), baseHeaders: new Headers(),
    });
    assert.equal(read.status, 200, await read.clone().text());
    assert.equal(await read.text(), '');
  });
}

test('maximum upload metadata fits a backup header and round-trips unchanged', async () => {
  const source = fixture();
  const config = JSON.parse(await source.kv.get(`session:${slug}:config`));
  config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } };
  await source.kv.put(`session:${slug}:config`, JSON.stringify(config));
  const tags = Array.from({ length: 32 }, (_, index) => ({ name: `tag-${index}`, value: index < 31 ? 'é'.repeat(1024) : 'x' }));
  const probe = await uploadBackupDocument(source, { data: 'small', tags });
  assert.equal(probe.status, 200, await probe.clone().text());
  const probeId = (await probe.json()).id;
  const limit = 64 * 1024;
  tags[31].value = 'x'.repeat(limit - Buffer.byteLength(await source.kv.get(`ce-storage:${slug}:docsContext:${probeId}`)) + 1);
  assert.ok(tags[31].value.length > 0 && tags[31].value.length <= 1024);
  const response = await uploadBackupDocument(source, { data: 'small', tags });
  assert.equal(response.status, 200, await response.clone().text());
  const { id } = await response.json();
  const recordKey = `ce-storage:${slug}:docsContext:${id}`;
  const metadata = JSON.parse(await source.kv.get(recordKey));
  assert.equal(Buffer.byteLength(JSON.stringify(metadata)), limit);
  const { MAX_STORAGE_METADATA_BYTES } = await import('./uploadSizeLimits.js');
  assert.equal(MAX_STORAGE_METADATA_BYTES, limit);
  const header = { kind: 'payload', id, size: 25 * 1024 * 1024, sha256: 'f'.repeat(64), chunkCount: 100, metadata: null };
  assert.ok(MAX_STORAGE_METADATA_BYTES + Buffer.byteLength(JSON.stringify(header)) < STORAGE_EXPORT_PAGE_LIMITS.encodedBytes - 16384);
  const pages = await allPages(source.env);
  const target = fixture(); target.kv.values.delete(`session:${slug}:config`);
  for (const page of pages) {
    const result = await importPage(target.env, page);
    assert.equal(result.ok, true, JSON.stringify(result));
  }
  assert.deepEqual(JSON.parse(await target.kv.get(recordKey)), metadata);
  const read = await storageRoute({ path: '/storage/read', method: 'GET', env: target.env, slug,
    config: JSON.parse(await target.kv.get(`session:${slug}:config`)), uploaderAddress: admin,
    request: new Request(`https://worker.example/storage/read?id=${id}`), baseHeaders: new Headers(),
  });
  assert.equal(read.status, 200); assert.equal(await read.text(), 'small');
});

test('legacy metadata that exceeds the backup entry limit reports the stored id', async () => {
  const source = fixture();
  const id = 'legacy-oversized-metadata';
  const metadata = { id, resource: 'docsContext', storageLayer: 'kv', tags: [{ name: 'legacy', value: 'x'.repeat(STORAGE_EXPORT_PAGE_LIMITS.encodedBytes) }] };
  source.kv.values.set(`ce-storage:${slug}:docsContext:${id}`, JSON.stringify(metadata));
  source.kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: Buffer.from('small').toString('base64url') }));
  await assert.rejects(allPages(source.env), (error) => error.status === 409 && error.message.includes(id));
});


test('backup and restore retain the authoritative secrets despite stale source and target KV reads', async () => {
  const source = fixture();
  await putSessionSecrets(source.env, slug, { openaiKey: 'synthetic-old-key', customRpcKey: 'synthetic-cleared' });
  const stale = await source.kv.get(`session:${slug}:secrets`);
  const edit = await updateSessionSecretsAfterLitRepair({ env: source.env, slug, expectedAuthority,
    incomingSecrets: { openaiKey: 'synthetic-current-key', customRpcKey: '' } });
  assert.equal(edit.ok, true);
  const sourceGet = source.kv.get;
  source.kv.get = (key) => key.endsWith(':secrets') ? stale : sourceGet(key);
  const pages = await allPages(source.env);
  assert.deepEqual(await decryptSessionSecretsEnvelope(pages[0].coordinator.secrets, { env: source.env, slug }), { openaiKey: 'synthetic-current-key' });
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  for (const page of pages) assert.equal((await importPage(target.env, page)).ok, true);
  const targetGet = target.kv.get;
  target.kv.get = (key) => key.endsWith(':secrets') ? stale : targetGet(key);
  assert.equal((await updateSessionSecretsAfterLitRepair({ env: target.env, slug, expectedAuthority,
    incomingSecrets: { anthropicKey: 'synthetic-other-key' } })).ok, true);
  target.kv.get = targetGet;
  assert.deepEqual(await getSessionSecrets(target.env, slug), { openaiKey: 'synthetic-current-key', anthropicKey: 'synthetic-other-key' });
});
