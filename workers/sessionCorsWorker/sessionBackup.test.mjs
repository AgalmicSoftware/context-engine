import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installSessionCoordinatorBinding, createSignedSiweBody, makeJsonRequest } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerRuntime } from './worker.js';
import { exportSessionBackup } from './sessionBackup.js';
import { STORAGE_EXPORT_PAGE_LIMITS } from './storageScanBudget.js';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { workerGroupBackupPrefixes } from './workerGroups.js';
import { readFile } from 'node:fs/promises';
import { createWorkerClient } from '../../mcp/lib/workerClient.mjs';
import { selectCanonicalStorageVersions } from '../../shared/storage/canonicalStorageVersions.mjs';

const slug = 'restore-fixture';
const sessionId = `0x${'3'.repeat(32)}`;
const admin = `0x${'1'.repeat(40)}`;
const expectedAuthority = { actor: admin, revision: 1, authzEpoch: 0 };
const memoryKv = () => {
  const values = new Map();
  return { values, get: async (key) => values.get(key) ?? null,
    put: async (key, value) => values.set(key, value), delete: async (key) => values.delete(key),
    list: async ({ prefix = '', cursor = '', limit = 100 } = {}) => {
      const names = [...values.keys()].filter((key) => key.startsWith(prefix) && key > cursor).sort();
      const keys = names.slice(0, limit).map((name) => ({ name }));
      return { keys, list_complete: names.length <= limit, cursor: names.length > limit ? keys.at(-1).name : '' };
    } };
};
const fixture = () => {
  const kv = memoryKv();
  const env = installSessionCoordinatorBinding({ GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'a'.repeat(64), TOKEN_HMAC_SECRET: 'synthetic-hmac',
  });
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
  assert.equal((await importPage(target.env, changed, 1)).status, 409);
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
  assert.equal(result.manifest.type, 'ce_session_backup');
});

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
const importPage = (env, page, revision = 0) => callSessionConfigCoordinator({ env, slug, path: 'backup/import',
  expectedAuthority: { ...expectedAuthority, revision }, page, adoptSessionId: true });

test('restore validates recovery keys, skips page replays, and never overwrites a conflicting row', async () => {
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
    } else {
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.body.complete, mode !== 'conflict');
      assert.equal(result.body.counts.conflicts, mode === 'conflict' ? 1 : 0);
      assert.equal(await target.kv.get(indexKey), mode === 'conflict' ? '{"different":true}' : JSON.stringify(metadata));
      const replay = await importPage(target.env, page, mode === 'conflict' ? 0 : 1);
      assert.equal(replay.body.replayed, true);
      assert.deepEqual(replay.body.counts, result.body.counts);
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
  const response = await call(wallet, true);
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.complete, true);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
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

test('restore drill preserves encrypted reads, hidden questions, correction authority, groups and AI secrets', async (t) => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  const { ethers } = createRequire(new URL('../../package.json', import.meta.url))('ethers');
  const wallets = [4, 5, 6].map((digit) => new ethers.Wallet(`0x${String(digit).repeat(64)}`));
  const [owner, participant] = wallets;
  const source = fixture();
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
    target.kv.values.delete(`session:${slug}:config`);
    Object.assign(target.env, { BOOTSTRAP_ADMIN_ADDRESS: owner.address, ADMIN_TRUSTED_ORIGINS: 'https://app.example', CE_WORKER_GROUPS_BOOTSTRAP: 'fresh-template-v2' });
    if (previous) { target.env.CE_STORAGE_ENVELOPE_PREVIOUS_KEK = source.env.CE_STORAGE_ENVELOPE_KEK; target.env.CE_STORAGE_ENVELOPE_KEK = 'b'.repeat(64); }
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
  }
  const unrelated = fixture();
  unrelated.kv.values.delete(`session:${slug}:config`);
  Object.assign(unrelated.env, { BOOTSTRAP_ADMIN_ADDRESS: owner.address, ADMIN_TRUSTED_ORIGINS: 'https://app.example', CE_STORAGE_ENVELOPE_KEK: 'c'.repeat(64) });
  const denied = await connect(unrelated).signed('import-session-backup', { page: pages[0], adoptSessionId: true }, 409);
  assert.equal(denied.reason, 'recovery_key_mismatch');
  assert.equal([...unrelated.kv.values.keys()].filter((key) => key.startsWith('ce-storage')).length, 0);
});
