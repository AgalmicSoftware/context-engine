import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installSessionCoordinatorBinding, createSignedSiweBody, makeJsonRequest } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerRuntime } from './worker.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
import { storageRoute } from './storageRouteExecution.js';
import { exportSessionBackup as exportPage } from './sessionBackup.js';
import { sendSessionFeedback } from './sessionFeedbackRoute.js';
import { STORAGE_EXPORT_PAGE_LIMITS } from './storageScanBudget.js';
import { callSessionConfigCoordinator, forgetSessionConfig } from './sessionConfigAuthority.js';
import { BACKUP_EXPORT_LEASE_MS, BACKUP_EXPORT_SETTLE_MS, BACKUP_VIEW_MAX_AGE_MS, markStorageBackupWrite } from './storageBackupRevision.js';
import { workerGroupBackupPrefixes, coordinateWorkerGroupBackup, executeCoordinatedWorkerGroupMutation } from './workerGroups.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createWorkerClient } from '../../mcp/lib/workerClient.mjs';
import { selectCanonicalStorageVersions } from '../../shared/storage/canonicalStorageVersions.mjs';
import { hashOneUseSecret } from '../../shared/workerGroupJoin.mjs';
import { getSessionSecrets, putSessionConfig, putSessionSecrets } from './sessionConfigSecretsStore.js';
import { updateSessionSecretsAfterLitRepair } from './sessionLitAuthorizationCoordinator.js';
import { decryptSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';
import { recoveryKeyFingerprint } from '../shared/recoveryKey.mjs';
import { build } from 'esbuild';
import { signBackupPage } from './sessionBackupAuthentication.js';

const slug = 'restore-fixture';
const sessionId = `0x${'3'.repeat(32)}`;
const admin = `0x${'1'.repeat(40)}`;
const expectedAuthority = { actor: admin, revision: 1, authzEpoch: 0 };
const memoryKv = () => {
  const values = new Map();
  const listMetadata = new Map();
  const gets = new Map();
  const requests = [];
  let operations = null;
  const operation = () => { if (operations != null && ++operations > 1000) throw new Error('KV request exceeded 1000 operations'); };
  return { values, listMetadata, gets, requests,
    request: async (callback) => {
      operations = 0;
      try { return await callback(); } finally { requests.push(operations); operations = null; }
    },
    get: async (key) => {
      operation();
      // Cloudflare's bulk get: up to 100 keys as one operation, answered as a Map.
      const one = (name) => { gets.set(name, (gets.get(name) || 0) + 1); return values.get(name) ?? null; };
      if (!Array.isArray(key)) return one(key);
      // As Cloudflare: 1 to 100 keys, at most 25 MB of values in all.
      if (key.length < 1 || key.length > 100) throw new Error(`KV GET_BULK failed: ${key.length} keys`);
      if (key.reduce((sum, name) => sum + (values.get(name)?.length || 0), 0) > 25 * 1000 * 1000) throw new Error('KV GET_BULK failed: 413');
      return new Map(key.map((name) => [name, one(name)]));
    },
    put: async (key, value, options) => {
      operation();
      if (options?.metadata) listMetadata.set(key, options.metadata);
      else listMetadata.delete(key);
      return values.set(key, value);
    },
    delete: async (key) => { operation(); listMetadata.delete(key); return values.delete(key); },
    list: async ({ prefix = '', cursor = '', limit = 100 } = {}) => {
      operation();
      const names = [...values.keys()].filter((key) => key.startsWith(prefix) && key > cursor).sort();
      const keys = names.slice(0, limit).map((name) => (listMetadata.has(name) ? { name, metadata: listMetadata.get(name) } : { name }));
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
  kv.values.set(`session:${slug}:config`, JSON.stringify({ slug, sessionId, adminAddress: admin, corsWorkerUrl: 'https://worker.example',
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

test('feedback is never a storage resource and never enters a backup', async () => {
  const { env, kv } = fixture();
  // Whole phrases: a short marker like 7d1c turns up in random MACs and ids.
  const text = 'Feedback marker 7d1c: the atlas was hard to find.';
  const leaked = (value) => String(value).includes(text);
  const sent = await sendSessionFeedback({
    env, slug, config: { sessionModeProfile: { authority: { mode: 'worker_canonical' } } }, body: { text, view: 'results', theme: 'civic', screen: 'desktop' },
    identity: 'anon:203.0.113.9', checkRateLimit: async () => true, release: '0.9.8',
  });
  assert.equal(sent.status, 200, JSON.stringify(sent));
  const listed = await callSessionConfigCoordinator({ env, slug, path: 'session-feedback/list' });
  assert.equal(listed.body.messages[0].text, text);
  assert.ok(![...kv.values.values()].some(leaked));
  const pages = await allPages(env);
  assert.equal(pages.at(-1).manifest.complete, true);
  assert.ok(!leaked(JSON.stringify(pages)));
});

test('a restore keeps everyone who turned the Session Agent off opted out, and every address left off exports off', async () => {
  const source = fixture();
  const people = [`0x${'a'.repeat(40)}`, `0x${'b'.repeat(40)}`];
  const unnamed = [`0x${'b'.repeat(40)}`, `0x${'d'.repeat(40)}`];
  for (const address of people) {
    const set = await callSessionConfigCoordinator({ env: source.env, slug, path: 'session-agent/set', address, optedOut: true });
    assert.equal(set.body.optedOut, true);
  }
  for (const address of unnamed) {
    const set = await callSessionConfigCoordinator({ env: source.env, slug, path: 'session-agent/set-unattributed', address, unattributed: true });
    assert.equal(set.body.unattributed, true);
  }
  const [page] = await allPages(source.env);
  assert.deepEqual(page.coordinator.sessionAgentOptOuts, people);
  assert.deepEqual(page.coordinator.sessionAgentUnattributed, unnamed);
  // A restore only adds: someone the target already holds as opted out stays so,
  // and a backup from before backups carried the list restores with none.
  const already = `0x${'c'.repeat(40)}`;
  const restoreOnto = async (backupPage) => {
    const target = fixture();
    target.kv.values.delete(`session:${slug}:config`);
    await callSessionConfigCoordinator({ env: target.env, slug, path: 'session-agent/set', address: already, optedOut: true });
    await callSessionConfigCoordinator({ env: target.env, slug, path: 'session-agent/set-unattributed', address: already, unattributed: true });
    const result = await importPage(target.env, backupPage);
    assert.equal(result.body.complete, true, JSON.stringify(result));
    const { addresses, unattributed } = (await callSessionConfigCoordinator({ env: target.env, slug, path: 'session-agent/list' })).body;
    return [addresses.sort(), unattributed.sort()];
  };
  assert.deepEqual(await restoreOnto(page), [[...people, already], [...unnamed, already].sort()]);
  const older = structuredClone(page);
  delete older.coordinator.sessionAgentOptOuts;
  delete older.coordinator.sessionAgentUnattributed;
  const sha256 = (text) => createHash('sha256').update(text).digest('hex');
  older.snapshotDigest = sha256(JSON.stringify(older.coordinator));
  older.archiveId = sha256(`${older.manifest.sessionId}:${older.manifest.exportedAt}:${older.snapshotDigest}`);
  assert.deepEqual(await restoreOnto(await signBackupPage(older, source.env)), [[already], [already]]);
});

test('a restore puts back the mark beside each attached passkey, so a cancelled agent stays out even while the record can’t be read', async () => {
  const { AGENT_LINKED_MARK, agentLinkedMarkKey } = await import('./agentSignInStore.js');
  const { checkAgentSignInAtLogin } = await import('./agentSignInLink.js');
  const source = fixture();
  const [account, passkey, other, otherKey, stranger] = ['a1', 'b2', 'c3', 'd4', 'e5'].map((byte) => `0x${byte.repeat(20)}`);
  const store = (env, operation, payload) => callSessionConfigCoordinator({ env, slug, path: `agent-sign-in/${operation}`, ...payload });
  const now = Date.parse('2026-11-20T10:00:00Z');
  assert.equal((await store(source.env, 'attach', { address: account, passkey, now })).body.ok, true);
  assert.equal((await store(source.env, 'access', { address: account, passkey, agentAccess: 'cancelled', now })).body.ok, true);
  assert.equal((await store(source.env, 'attach', { address: other, passkey: otherKey, now })).body.ok, true);
  const [page] = await allPages(source.env);
  assert.deepEqual(page.coordinator.agentSignInLinks.map((row) => [row.account, row.agentAccess]), [[account, 'cancelled'], [other, 'active']]);

  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  // The source's marks are not in a backup: the restore writes them.
  assert.equal([...target.kv.values.keys()].some((key) => key.startsWith('agentLinkAccount:')), false);
  const result = await importPage(target.env, page);
  assert.equal(result.body.complete, true, JSON.stringify(result));
  for (const linked of [account, other]) assert.equal(target.kv.values.get(agentLinkedMarkKey(slug, linked)), AGENT_LINKED_MARK, linked);
  for (const unmarked of [passkey, otherKey, stranger]) assert.equal(target.kv.values.has(agentLinkedMarkKey(slug, unmarked)), false, unmarked);
  assert.equal((await store(target.env, 'state', { address: account })).body.asAccount.agentAccess, 'cancelled');

  // A session that has had sign-in links set, signing someone in with their own key.
  const config = { slug, sessionId, agentSignInLinksEnabled: true, sessionModeProfile: { authority: { mode: 'worker_canonical' } } };
  const signIn = (env, address) => checkAgentSignInAtLogin({ env, request: new Request('https://worker.example/auth/login', { method: 'POST' }), slug, address, config, scopes: {} });
  assert.equal((await signIn(target.env, account)).refusal.body.reason, 'agent_access_cancelled');
  // The record can't be read: the cancelled agent's own key is still refused, because its account is marked.
  const binding = target.env.CE_SESSION_COORDINATOR;
  const get = binding.get.bind(binding);
  binding.get = (id) => {
    const stub = get(id);
    return { fetch: async (input, init) => (String(input?.url || input).includes('agent-sign-in/')
      ? new Response(JSON.stringify({ error: 'Coordinator busy.' }), { status: 503 })
      : stub.fetch(input, init)) };
  };
  const shutOut = await signIn(target.env, account);
  assert.deepEqual([shutOut.refusal.status, shutOut.refusal.body.reason], [503, 'agent_sign_in_unavailable']);
  assert.equal((await signIn(target.env, other)).refusal.status, 503);
  // Someone with nothing attached signs in as ever.
  assert.deepEqual(await signIn(target.env, stranger), {});
  binding.get = get;

  // A backup from before backups carried attachments restores with none, and writes no mark.
  const older = structuredClone(page);
  delete older.coordinator.agentSignInLinks;
  const sha256 = (text) => createHash('sha256').update(text).digest('hex');
  older.snapshotDigest = sha256(JSON.stringify(older.coordinator));
  older.archiveId = sha256(`${older.manifest.sessionId}:${older.manifest.exportedAt}:${older.snapshotDigest}`);
  const plain = fixture();
  plain.kv.values.delete(`session:${slug}:config`);
  assert.equal((await importPage(plain.env, await signBackupPage(older, source.env))).body.complete, true);
  assert.equal([...plain.kv.values.keys()].some((key) => key.startsWith('agentLinkAccount:')), false);
});

// A coordinator whose storage fails once, at the first write of a passkey's lookup: a restore cut off there.
class CutAtPasskeyWrite extends SessionWriteCoordinator {
  constructor(state, env) {
    let cut = false;
    const guard = (put) => async (key, value) => {
      if (!cut && key.startsWith('agent-link:v1:passkey:')) { cut = true; throw new Error('Restore cut off.'); }
      return put(key, value);
    };
    const { storage } = state;
    super({ storage: { ...storage, put: guard(storage.put), transaction: (run) => storage.transaction((txn) => run({ ...txn, put: guard(txn.put) })) } }, env);
  }
}

test('a restore cut off while putting back a passkey, then resumed from the same archive, leaves both lookups working', async () => {
  const source = fixture();
  const [account, passkey] = ['a1', 'b2'].map((byte) => `0x${byte.repeat(20)}`);
  const store = (env, operation, payload) => callSessionConfigCoordinator({ env, slug, path: `agent-sign-in/${operation}`, ...payload });
  assert.equal((await store(source.env, 'attach', { address: account, passkey, now: Date.parse('2026-11-20T10:00:00Z') })).body.ok, true);
  const [page] = await allPages(source.env);

  const target = fixture(CutAtPasskeyWrite);
  target.kv.values.delete(`session:${slug}:config`);
  assert.notEqual((await importPage(target.env, page)).body?.complete, true, 'the first try is cut off');
  const resumed = await importPage(target.env, page);
  assert.equal(resumed.body.complete, true, JSON.stringify(resumed));
  assert.equal((await store(target.env, 'state', { address: account })).body.asAccount.passkey, passkey);
  assert.deepEqual((await store(target.env, 'state', { address: passkey })).body.asPasskey, { account });
});

// A session whose Session Agent records chats: its coordinator stores one only while that setting is on.
const recordingFixture = () => {
  const made = fixture();
  const key = `session:${slug}:config`;
  made.kv.values.set(key, JSON.stringify({ ...JSON.parse(made.kv.values.get(key)), sessionAgent: { audiences: [], history: true } }));
  return made;
};

test('a backup carries the stored chats it began with, and a restore puts them back under their ids', async () => {
  const chat = (question, extra = {}) => ({ day: '2026-11-24', answers: 'general', question, answer: 'Shorter meetings.', ...extra });
  const store = (env, operation, payload = {}) => callSessionConfigCoordinator({ env, slug, path: `session-agent-history/${operation}`, ...payload });
  const source = recordingFixture();
  // Enough stored answers that the backup takes more than one page.
  for (let n = 0; n < 120; n += 1) {
    const id = `cf_chat_${String(n).padStart(3, '0')}`;
    const metadata = { id, resource: 'responses', responder: admin, storageLayer: 'kv', size: 6 };
    source.kv.values.set(`ce-storage:${slug}:responses:${id}`, JSON.stringify(metadata));
    source.kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: Buffer.from('answer').toString('base64url') }));
  }
  assert.equal((await store(source.env, 'add', { entry: chat('First?', { scope: 'admin' }) })).ok, true);
  await store(source.env, 'add', { entry: chat('Second?', { by: `0x${'a'.repeat(40)}`, name: 'Sam', groups: ['salon'] }) });
  const first = await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  assert.ok(first.nextCursor);
  // Whom each answer was fit for goes with it, so a restored session exports no more than this one would.
  assert.deepEqual(first.coordinator.sessionAgentHistory.map((entry) => [entry.id, entry.question, entry.scope, entry.groups]),
    [['000000000001', 'First?', 'admin', undefined], ['000000000002', 'Second?', undefined, ['salon']]]);
  // Someone asks while the backup runs: it carries on, and that chat waits for the next backup.
  assert.equal((await store(source.env, 'add', { entry: chat('Asked during the backup?') })).ok, true);
  const pages = [first];
  for (let cursor = first.nextCursor; cursor;) {
    const page = await exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor });
    assert.equal(page.reason, undefined, JSON.stringify(page).slice(0, 200));
    pages.push(page);
    cursor = page.nextCursor;
  }
  assert.equal(pages.at(-1).manifest.complete, true);
  assert.ok(!JSON.stringify(pages).includes('Asked during the backup?'));
  // A chat the backup holds being cleared while it runs does change it: that backup starts again.
  const again = await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  assert.equal((await store(source.env, 'delete', { ids: ['000000000001'] })).body.deleted, 1);
  await assert.rejects(exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: again.nextCursor }),
    (error) => error.status === 409 && error.reason === 'backup_session_changed');

  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  let result;
  for (const page of pages) result = await importPage(target.env, page);
  assert.equal(result.body.complete, true, JSON.stringify(result).slice(0, 300));
  assert.deepEqual((await store(target.env, 'all')).body.entries, first.coordinator.sessionAgentHistory);
  // The next chat stored on the restored session follows the restored ones.
  assert.equal((await store(target.env, 'add', { entry: chat('After the restore?') })).body.id, '000000000003');
});

test('a restore refuses chats that are not whole exchanges', async () => {
  const source = recordingFixture();
  const added = await callSessionConfigCoordinator({ env: source.env, slug, path: 'session-agent-history/add',
    entry: { day: '2026-11-24', answers: 'general', question: 'First?', answer: 'An answer.' } });
  assert.equal(added.ok, true, JSON.stringify(added));
  const [page] = await allPages(source.env);
  const altered = structuredClone(page);
  altered.coordinator.sessionAgentHistory[0].asker = `0x${'a'.repeat(40)}`;
  const sha256 = (text) => createHash('sha256').update(text).digest('hex');
  altered.snapshotDigest = sha256(JSON.stringify(altered.coordinator));
  altered.archiveId = sha256(`${altered.manifest.sessionId}:${altered.manifest.exportedAt}:${altered.snapshotDigest}`);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  const refused = await importPage(target.env, await signBackupPage(altered, source.env));
  assert.notEqual(refused.body.complete, true);
  assert.match(JSON.stringify(refused.body), /Invalid backup Session Agent chats/);
  assert.deepEqual((await callSessionConfigCoordinator({ env: target.env, slug, path: 'session-agent-history/all' })).body.entries, []);
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
    // Tests skip the first page's wait; dropping this isolate's settings copy
    // stands in for its ageing out meanwhile. Tests below drive the wait.
    const page = await args.env.GROUP_KV.request(() => exportPage({ settle: async () => forgetSessionConfig(args.env, slug), ...args }));
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
const importPage = async (env, page, revision = 0, destination = { workerUrl: 'https://worker.example', requestOrigin: 'https://worker.example' }) => {
  for (let tries = 0; tries < 200; tries += 1) {
    const result = await env.GROUP_KV.request(() => callSessionConfigCoordinator({ env, slug, path: 'backup/import',
      expectedAuthority: { ...expectedAuthority, revision }, page, adoptSessionId: true, ...destination }));
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

test('restore validates recovery keys and replays only its completed receipt', async () => {
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
      assert.equal(replay.status, 200);
      assert.equal(replay.body.replayed, true);
      assert.equal(replay.body.complete, true);
      assert.equal(await target.kv.get(payloadKey), JSON.stringify({ metadata, payloadBase64url: Buffer.from('hello').toString('base64url') }));
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
      adminAction: 'import-session-backup', audience: 'https://app.example', body: { page, adoptSessionId, workerUrl: 'https://worker.example' } });
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
  // One-use codes travel with their group: a spent code stays spent.
  const [spentCode, freshCode] = ['1'.repeat(32), '2'.repeat(32)];
  await a.signed('groups/create', { group: { groupId: 'by-code', label: 'By code', joinMode: 'one_use' } });
  await a.signed('groups/invites/add', { groupId: 'by-code', hashes: [await hashOneUseSecret(spentCode), await hashOneUseSecret(freshCode)] });
  await a.clients[1].request('/groups/join', { method: 'POST', auth: true, body: { sessionId, groupId: 'by-code', secret: spentCode } });
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
      const result = await b.signed('import-session-backup', { page, adoptSessionId: true, workerUrl: 'https://worker.example' });
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
    assert.deepEqual((await b.signed('groups/invites/list', { groupId: 'by-code' })).counts, { unused: 1, used: 1, revoked: 0 });
    const joinByCode = (secret) => b.clients[2].request('/groups/join', { method: 'POST', auth: true, body: { sessionId, groupId: 'by-code', secret } });
    await assert.rejects(joinByCode(spentCode), (error) => error.status === 403);
    assert.equal((await joinByCode(freshCode)).ok, true);
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
      const denied = await c.signed('import-session-backup', { page: chainedPages[0], adoptSessionId: true, workerUrl: 'https://worker.example' }, 409);
      assert.equal(denied.reason, 'recovery_key_mismatch');
      assert.ok(denied.error.includes(await recoveryKeyFingerprint(source.env.CE_STORAGE_ENVELOPE_KEK)));
      assert.equal(next.kv.values.size, 0, 'Reject missing keys before staging or importing data');
      next.env.CE_STORAGE_ENVELOPE_PREVIOUS_KEK = source.env.CE_STORAGE_ENVELOPE_KEK;
      for (const page of chainedPages) await c.signed('import-session-backup', { page, adoptSessionId: true, workerUrl: 'https://worker.example' });
      assert.equal((await c.clients[1].read(encrypted.id)).answer.value, 'Encrypted answer');
      assert.equal((await c.clients[1].read(newAnswer.id)).answer.value, 'Written after restore');
    }
  }
  const unrelated = fixture();
  unrelated.kv.values.delete(`session:${slug}:config`);
  Object.assign(unrelated.env, { BOOTSTRAP_ADMIN_ADDRESS: owner.address, ADMIN_TRUSTED_ORIGINS: 'https://app.example', CE_STORAGE_ENVELOPE_KEK: 'c'.repeat(64) });
  const denied = await connect(unrelated).signed('import-session-backup', { page: pages[0], adoptSessionId: true, workerUrl: 'https://worker.example' }, 409);
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
    ['remove-member', 'missing', { remover: 'member' }, false],
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
  assert.equal((await mutate('remove-member', 'open', { remover: 'member' })).ok, true);
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
  await callSessionConfigCoordinator({ env: target.env, slug, path: 'backup/import', page, adoptSessionId: true, workerUrl: 'https://worker.example', requestOrigin: 'https://worker.example',
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


// Only a backup mark landing after an export read its start revision can
// change the export, so writes skip the marks no export could see.
const answerUpload = (source, value) => storageRoute({ path: '/storage/upload', method: 'POST', env: source.env, slug,
  config: JSON.parse(source.kv.values.get(`session:${slug}:config`)), uploaderAddress: admin, expectedAuthority,
  request: makeJsonRequest('/storage/upload', { resource: 'responses', data: JSON.stringify({ questionID: `0x${'7'.repeat(64)}`, answer: { value } }) }),
  baseHeaders: new Headers() });
const countCoordinatorCalls = (env, onCall = () => {}) => {
  const calls = [];
  const binding = env.CE_SESSION_COORDINATOR;
  env.CE_SESSION_COORDINATOR = { idFromName: (name) => binding.idFromName(name), get: (id) => {
    const stub = binding.get(id);
    return { fetch: (url, init) => {
      const path = new URL(url).pathname.replace('/session-config/', '');
      calls.push(path);
      onCall(path);
      return stub.fetch(url, init);
    } };
  } };
  return calls;
};
// Moves this process's clock, the coordinator's included.
const shiftableClock = (t) => {
  const realNow = Date.now.bind(Date);
  let offset = 0;
  t.mock.method(Date, 'now', () => realNow() + offset);
  return (ms) => { offset += ms; };
};
const marks = (calls) => calls.filter((path) => path === 'backup/write-revision').length;

test('an answer marks no backup revision while no export runs, and marks both sides during one', async () => {
  const source = largeArchiveSource();
  const calls = countCoordinatorCalls(source.env);
  assert.equal((await answerUpload(source, 'No export')).status, 200);
  assert.equal(marks(calls), 0);
  assert.ok((await exportSessionBackup({ env: source.env, slug, expectedAuthority })).nextCursor);
  assert.equal((await answerUpload(source, 'During export')).status, 200);
  assert.equal(marks(calls), 2);
});

test('a write marks when its settings view was asked for more than 2 s ago', async (t) => {
  const { env } = fixture();
  const shift = shiftableClock(t);
  let slow = false;
  const calls = countCoordinatorCalls(env, (path) => { if (slow && path === 'current') shift(BACKUP_VIEW_MAX_AGE_MS + 1); });
  await markStorageBackupWrite(env, slug);
  assert.deepEqual(calls, ['current']);
  forgetSessionConfig(env, slug);
  slow = true;
  await markStorageBackupWrite(env, slug);
  assert.deepEqual(calls, ['current', 'current', 'backup/write-revision']);
});

test('an export waits after taking its lease, so a write that skipped its first mark makes its last', async (t) => {
  const source = largeArchiveSource();
  const shift = shiftableClock(t);
  // A write begins with no export running, so it skips its first mark.
  const calls = countCoordinatorCalls(source.env);
  await markStorageBackupWrite(source.env, slug);
  assert.equal(marks(calls), 0);
  // An export takes its lease and waits before it reads its start revision.
  const first = await exportSessionBackup({ env: source.env, slug, expectedAuthority, settle: async () => shift(BACKUP_EXPORT_SETTLE_MS) });
  assert.ok(first.nextCursor);
  // The write's last check, after the wait, sees the lease, so it marks and the export restarts.
  await markStorageBackupWrite(source.env, slug);
  assert.equal(marks(calls), 1);
  const next = await exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: first.nextCursor });
  assert.equal(next.reason, 'backup_session_changed');
});

test('a write whose view was asked just before an export took its lease marks after the cut', async (t) => {
  const source = largeArchiveSource();
  const shift = shiftableClock(t);
  // The write's view is answered before the lease, and arrives only after the
  // export has waited and read its cut, so the view's age is the export's wait.
  let first = null;
  let hold = true;
  const binding = source.env.CE_SESSION_COORDINATOR;
  source.env.CE_SESSION_COORDINATOR = { idFromName: (name) => binding.idFromName(name), get: (id) => {
    const stub = binding.get(id);
    return { fetch: async (url, init) => {
      if (!hold || !String(url).endsWith('/current')) return stub.fetch(url, init);
      hold = false;
      const response = await stub.fetch(url, init);
      first = await exportSessionBackup({ env: source.env, slug, expectedAuthority, settle: async () => shift(BACKUP_EXPORT_SETTLE_MS) });
      return response;
    } };
  } };
  assert.equal((await answerUpload(source, 'Viewed before the lease')).status, 200);
  assert.ok(first?.nextCursor);
  const next = await exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: first.nextCursor });
  assert.equal(next.reason, 'backup_session_changed');
});

test('a cached or shared settings view keeps the age of the read that made it', async (t) => {
  const { env } = fixture();
  const shift = shiftableClock(t);
  let gate = null;
  const calls = countCoordinatorCalls(env);
  const binding = env.CE_SESSION_COORDINATOR;
  env.CE_SESSION_COORDINATOR = { idFromName: (name) => binding.idFromName(name), get: (id) => {
    const stub = binding.get(id);
    return { fetch: async (url, init) => (gate && String(url).endsWith('/current') ? gate.then(() => stub.fetch(url, init)) : stub.fetch(url, init)) };
  } };
  // A view that takes 1.5 s to arrive.
  let open;
  gate = new Promise((resolve) => { open = resolve; });
  const first = markStorageBackupWrite(env, slug);
  await new Promise((resolve) => setImmediate(resolve));
  shift(1_500);
  open();
  await first;
  assert.deepEqual(calls, ['current'], 'a 1.5 s old view skips the mark');
  // Still cached, but asked for 2.4 s ago.
  gate = null;
  shift(900);
  await markStorageBackupWrite(env, slug);
  assert.deepEqual(calls, ['current', 'backup/write-revision']);
  // A second write joins a view 0.6 s after it was asked for; it arrives 0.3 s
  // later, and both see it as old as the read that made it.
  forgetSessionConfig(env, slug);
  calls.length = 0;
  gate = new Promise((resolve) => { open = resolve; });
  const asked = Date.now();
  const asker = callSessionConfigCoordinator({ env, slug, path: 'current', cache: true });
  await new Promise((resolve) => setImmediate(resolve));
  shift(600);
  const joiner = callSessionConfigCoordinator({ env, slug, path: 'current', cache: true });
  await new Promise((resolve) => setImmediate(resolve));
  shift(300);
  open();
  const views = await Promise.all([asker, joiner]);
  assert.deepEqual(calls, ['current']);
  for (const view of views) assert.ok(view.readStartedAt >= asked && view.readStartedAt < asked + 600, String(view.readStartedAt - asked));
});

test('an export whose lease lapsed between pages restarts, since writes then skip their marks', async (t) => {
  const source = largeArchiveSource();
  const shift = shiftableClock(t);
  const first = await exportSessionBackup({ env: source.env, slug, expectedAuthority });
  shift(BACKUP_EXPORT_LEASE_MS + 1);
  const calls = countCoordinatorCalls(source.env);
  assert.equal((await answerUpload(source, 'After the lease')).status, 200);
  assert.equal(marks(calls), 0);
  const next = await exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor: first.nextCursor });
  assert.equal(next.reason, 'backup_session_changed');
});

test('a backup taken while answers are saved restores every answer saved before its cut and none half-written', async (t) => {
  const source = largeArchiveSource();
  const shift = shiftableClock(t);
  const saved = [];
  const save = async (value) => {
    const response = await answerUpload(source, value);
    assert.equal(response.status, 200, await response.clone().text());
    saved.push((await response.json()).id);
  };
  // One answer is mid-write when the export takes its lease: stopped before its list row.
  const put = source.kv.put;
  let reachHold;
  let release;
  const reached = new Promise((resolve) => { reachHold = resolve; });
  const held = new Promise((resolve) => { release = resolve; });
  let holdNext = true;
  source.kv.put = async (key, ...rest) => {
    if (holdNext && key.startsWith(`ce-storage:${slug}:responses:`)) { holdNext = false; reachHold(); await held; }
    return put(key, ...rest);
  };
  const midWrite = save('Mid-write at the cut');
  await reached;
  let pages = null;
  let cut = [];
  let attempts = 0;
  for (; !pages; attempts += 1) {
    const attempt = [];
    let cursor = '';
    do {
      const page = await exportSessionBackup({ env: source.env, slug, expectedAuthority, cursor, settle: async () => {
        // During the wait the mid-write answer finishes and another is saved;
        // the export's start revision, its cut, is read after this.
        release();
        await midWrite;
        await save(`During the wait ${attempts}`);
        cut = [...saved];
        shift(BACKUP_EXPORT_SETTLE_MS);
      } });
      attempt.push(page);
      cursor = page.nextCursor;
      // For two attempts, answers keep arriving between pages.
      if (cursor && attempts < 2) await save(`Between pages ${attempts}`);
    } while (cursor);
    if (attempt.at(-1).manifest.complete) pages = attempt;
    else assert.equal(attempt.at(-1).reason, 'backup_session_changed');
  }
  assert.equal(attempts, 3);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  let result;
  for (const page of pages) {
    result = await importPage(target.env, page);
    assert.equal(result.ok, true, JSON.stringify(result));
  }
  assert.equal(result.body.complete, true);
  const ids = (kv, prefix) => [...kv.values.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.split(':').pop()).sort();
  const answers = ids(target.kv, `ce-storage:${slug}:responses:`);
  // Every answer saved before the cut is restored, and nothing else.
  assert.deepEqual(answers, [...cut, 'cf_abandon_fixture'].sort());
  // Nothing half-written: each restored answer has its payload, and each payload its answer.
  assert.deepEqual(ids(target.kv, `ce-storage-payload:${slug}:`), answers);
  for (const id of cut) {
    const payload = `ce-storage-payload:${slug}:${id}`;
    assert.equal(target.kv.values.get(payload), source.kv.values.get(payload), id);
  }
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
    if (!changed && [key].flat().some((name) => name.startsWith('ce-storage-payload:'))) {
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
    page, adoptSessionId: true, workerUrl: 'https://worker.example', requestOrigin: 'https://worker.example' }));
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

// 0.8.0 published a restore's config before its cleanup and recorded only
// {configPublished, finishing}, with no committed authority or destination.
const legacyPublishedRestore = async () => {
  const { source, pages } = await completedRestoreSource();
  const importer = `0x${'2'.repeat(40)}`;
  const target = fixture(restartOnEveryRequest());
  target.kv.values.delete(`session:${slug}:config`);
  const archiveId = pages[0].archiveId;
  let progress;
  for (const page of pages) {
    for (let attempts = 0; attempts < 50 && !progress?.committedAuthority; attempts += 1) {
      const result = await restorePageAs(target.env, page, importer);
      assert.equal(result.ok, true, JSON.stringify(result));
      progress = restoreStore(target.env).get(`session-backup-import:${archiveId}`);
      if (result.body.pageComplete !== false) break;
    }
  }
  assert.ok(progress?.committedAuthority, 'The fixture stops after commit, before cleanup');
  const authority = progress.committedAuthority;
  const legacy = { ...progress, configPublished: true, finishing: true, finished: false };
  delete legacy.committedAuthority;
  delete legacy.workerUrl;
  restoreStore(target.env).set(`session-backup-import:${archiveId}`, legacy);
  restoreStore(target.env).set('session-config-authority', { ...authority, projectionPending: false });
  await putSessionConfig(target.env, slug, authority.config);
  return { source, pages, target, importer, archiveId, revision: authority.revision };
};

test('a restore 0.8.0 published is finished by status, never abandoned or expired', async () => {
  const { source, target, archiveId, revision } = await legacyPublishedRestore();
  // The archive's admin now administers the live config; the importer differs.
  const control = (operation) => callSessionConfigCoordinator({ env: target.env, slug, path: `backup/${operation}`,
    archiveId, expectedAuthority: { actor: admin, revision, authzEpoch: 0 } });
  assert.equal((await control('abandon')).status, 409);
  assertRestoredFixtureRows(source, target);
  restoreStore(target.env).get(`session-backup-import:${archiveId}`).expiresAt = 0;
  for (let attempts = 0; attempts < 50; attempts += 1) {
    const result = await control('status');
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.body.restore) break;
    assert.equal(result.body.restore.canAbandon, false);
    assert.ok(attempts < 49);
  }
  assertCompletedRestoreClean(target, archiveId);
  assertRestoredFixtureRows(source, target);
  assert.equal(JSON.parse(await target.kv.get(`session:${slug}:config`)).adminAddress, admin);
});

test('the importer can resume a restore 0.8.0 published from its final page', async () => {
  const { source, pages, target, importer, archiveId, revision } = await legacyPublishedRestore();
  for (let attempts = 0; attempts < 50; attempts += 1) {
    const result = await restorePageAs(target.env, pages.at(-1), importer, revision);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (result.body.complete) break;
    assert.ok(attempts < 49);
  }
  assertCompletedRestoreClean(target, archiveId);
  assertRestoredFixtureRows(source, target);
});

test('a restore 0.8.0 published without its authority fails closed and deletes nothing', async () => {
  const { source, target, archiveId } = await legacyPublishedRestore();
  restoreStore(target.env).delete('session-config-authority');
  target.kv.values.delete(`session:${slug}:config`);
  restoreStore(target.env).get(`session-backup-import:${archiveId}`).expiresAt = 0;
  for (const operation of ['status', 'abandon']) {
    const result = await callSessionConfigCoordinator({ env: target.env, slug, path: `backup/${operation}`,
      archiveId, expectedAuthority: { actor: admin, revision: 0, authzEpoch: 0 } });
    assert.equal(result.status, 409, operation);
  }
  assertRestoredFixtureRows(source, target);
  assert.ok(restoreStore(target.env).get(`session-backup-import:${archiveId}`));
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

test('restored doc-library rows say in their list metadata whether they are context sources, and their reading order', async () => {
  const source = fixture();
  const keyOf = (id) => `ce-storage:${slug}:docsContext:${id}`;
  const adminNote = { contextSource: true, uploadAuthority: 'admin', createdAt: '2026-11-01T00:00:00.000Z' };
  for (const [id, extra] of [['cf_library_file', {}], ['cf_context_file', adminNote]]) {
    const metadata = { id, resource: 'docsContext', storageLayer: 'kv', ...extra };
    source.kv.values.set(keyOf(id), JSON.stringify(metadata));
    source.kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: Buffer.from('small').toString('base64url') }));
  }
  const target = fixture(); target.kv.values.delete(`session:${slug}:config`);
  for (const page of await allPages(source.env)) {
    const result = await importPage(target.env, page);
    assert.equal(result.ok, true, JSON.stringify(result));
  }
  assert.deepEqual(target.kv.listMetadata.get(keyOf('cf_library_file')), { contextSource: false });
  // A restored source keeps its place in the AI's reading list: who added it, and when.
  assert.deepEqual(target.kv.listMetadata.get(keyOf('cf_context_file')), { contextSource: true, admin: true, createdAt: adminNote.createdAt });
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
  source.kv.get = (key) => typeof key === 'string' && key.endsWith(':secrets') ? stale : sourceGet(key);
  const pages = await allPages(source.env);
  assert.deepEqual(await decryptSessionSecretsEnvelope(pages[0].coordinator.secrets, { env: source.env, slug }), { openaiKey: 'synthetic-current-key' });
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  for (const page of pages) assert.equal((await importPage(target.env, page)).ok, true);
  const targetGet = target.kv.get;
  target.kv.get = (key) => typeof key === 'string' && key.endsWith(':secrets') ? stale : targetGet(key);
  assert.equal((await updateSessionSecretsAfterLitRepair({ env: target.env, slug, expectedAuthority,
    incomingSecrets: { anthropicKey: 'synthetic-other-key' } })).ok, true);
  target.kv.get = targetGet;
  assert.deepEqual(await getSessionSecrets(target.env, slug), { openaiKey: 'synthetic-current-key', anthropicKey: 'synthetic-other-key' });
});

const workerUrlFields = ['corsWorkerUrl', 'corsWorkerURL', 'CorsWorkerURL', 'workerUrl',
  'sessionCorsWorkerUrl', 'sessionWorkerUrl', 'sessionWorkerURL', 'workerURL'];
const loadRealBootstrapValidator = async () => {
  const bundled = await build({ entryPoints: [new URL('../../client/src/utilities/session/sessionWorkerDiscovery.ts', import.meta.url).pathname],
    bundle: true, write: false, format: 'esm', platform: 'node',
    alias: { '@ce-shared': new URL('../../shared', import.meta.url).pathname } });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
};

test('restoring at another origin binds every Worker URL and passes real client bootstrap validation', async () => {
  const { validateWorkerCanonicalSessionBootstrap } = await loadRealBootstrapValidator();
  const source = fixture();
  const config = JSON.parse(await readFile(new URL('../../tests/fixtures/worker-compat/previous-minor.json', import.meta.url))).config;
  Object.assign(config, { slug, sessionId, sessionIdHex: sessionId, adminAddress: admin, configRevision: 'restore-origin-fixture' },
    Object.fromEntries(workerUrlFields.map(key => [key, 'https://old-worker.example'])));
  delete config.resultsAnalysis;
  await source.kv.put(`session:${slug}:config`, JSON.stringify(config));
  const pages = await allPages(source.env);
  for (const destination of ['https://new-worker.example', 'https://old-worker.example']) {
    const target = fixture();
    target.kv.values.delete(`session:${slug}:config`);
    for (const page of pages) {
      const result = await importPage(target.env, page, 0, { workerUrl: destination, requestOrigin: destination });
      assert.equal(result.ok, true, JSON.stringify(result));
    }
    const stored = JSON.parse(await target.kv.get(`session:${slug}:config`));
    for (const field of workerUrlFields) assert.equal(stored[field], destination, field);
    const worker = createWorkerRuntime(target.env);
    const response = await worker.fetch(new Request(`${destination}/session-config?slug=${slug}`, { headers: { 'X-Session-Slug': slug } }), target.env);
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(validateWorkerCanonicalSessionBootstrap(await response.json(), {
      expectedSlug: slug, workerOrigin: destination, environment: 'production',
    }).workerOrigin, destination);
    const edit = await callSessionConfigCoordinator({ env: target.env, slug, path: 'mutate', expectedAuthority,
      mutation: { kind: 'set-config', incomingConfig: { ...stored, corsWorkerUrl: 'https://third-worker.example' } } });
    assert.equal(edit.status, 400, 'An ordinary edit cannot rebind an initialized Worker URL');
    assert.equal(JSON.parse(await target.kv.get(`session:${slug}:config`)).corsWorkerUrl, destination);
  }
});

test('a restore destination is required, must match the receiving origin and cannot change between pages', async () => {
  const { pages } = await completedRestoreSource();
  for (const destination of [
    { workerUrl: 'https://other.example', requestOrigin: 'https://worker.example' },
    { requestOrigin: 'https://worker.example' },
    { workerUrl: 'https://worker.example' },
    { workerUrl: 'https://worker.example/path', requestOrigin: 'https://worker.example' },
  ]) {
    const target = fixture();
    target.kv.values.delete(`session:${slug}:config`);
    const result = await importPage(target.env, pages[0], 0, destination);
    assert.equal(result.status, 400, JSON.stringify(destination));
    assert.equal(target.kv.values.size, 0);
    assert.equal([...target.env.__coordinatorInstances.values()].every(({ store }) => store.size === 0), true);
  }
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  assert.equal((await importPage(target.env, pages[0])).ok, true);
  const before = [...target.kv.values];
  const changed = await importPage(target.env, pages[1], 0, { workerUrl: 'https://other.example', requestOrigin: 'https://other.example' });
  assert.equal(changed.status, 409);
  assert.deepEqual([...target.kv.values], before);
  const occupied = fixture();
  const config = JSON.parse(await occupied.kv.get(`session:${slug}:config`));
  config.corsWorkerUrl = 'https://old-worker.example';
  occupied.kv.values.set(`session:${slug}:config`, JSON.stringify(config));
  const refused = await importPage(occupied.env, pages[0], 1);
  assert.equal(refused.status, 409);
  assert.match(refused.body.error, /Worker origin/);
});

test('the signed restore destination is checked against the actual HTTP request origin', async () => {
  const { ethers } = createRequire(new URL('../../package.json', import.meta.url))('ethers');
  const wallet = new ethers.Wallet(`0x${'4'.repeat(64)}`);
  const [page] = await allPages(fixture().env);
  const target = fixture();
  target.kv.values.clear();
  Object.assign(target.env, { BOOTSTRAP_ADMIN_ADDRESS: wallet.address, ADMIN_TRUSTED_ORIGINS: 'https://app.example' });
  const worker = createWorkerRuntime(target.env);
  const body = await createSignedSiweBody({ worker, env: target.env, wallet, sessionSlug: slug,
    adminAction: 'import-session-backup', audience: 'https://app.example',
    body: { page, adoptSessionId: true, workerUrl: 'https://other.example', requestOrigin: 'https://other.example' } });
  const response = await worker.fetch(makeJsonRequest('/admin/import-session-backup', body,
    { headers: { Origin: 'https://app.example' } }), target.env);
  assert.equal(response.status, 400, await response.clone().text());
  assert.equal(await target.kv.get(`session:${slug}:config`), null);
  assert.equal([...target.env.__coordinatorInstances.values()].some(({ store }) => store.has('session-backup-import-active')), false);
});

for (const recovery of ['status', 'retry']) test(`signed restore ${recovery} recovers a lost handoff reply without granting admin rights`, async (t) => {
  const { ethers } = createRequire(new URL('../../package.json', import.meta.url))('ethers');
  const importer = new ethers.Wallet(`0x${'4'.repeat(64)}`);
  const stranger = new ethers.Wallet(`0x${'5'.repeat(64)}`);
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  const source = fixture();
  const [page] = await allPages(source.env);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  Object.assign(target.env, { BOOTSTRAP_ADMIN_ADDRESS: importer.address, ADMIN_TRUSTED_ORIGINS: 'https://app.example' });
  const worker = createWorkerRuntime(target.env, { now: () => clock });
  const call = async (signer, action, body) => {
    clock += 20_000;
    const signed = await createSignedSiweBody({ worker, env: target.env, wallet: signer, sessionSlug: slug,
      adminAction: action, audience: 'https://app.example', body });
    return worker.fetch(makeJsonRequest(`/admin/${action}`, signed, { headers: { Origin: 'https://app.example' } }), target.env);
  };
  const importBody = { page, adoptSessionId: true, workerUrl: 'https://worker.example' };
  const put = target.kv.put;
  let loseReply = true;
  target.kv.put = async (key, value) => {
    const result = await put(key, value);
    if (loseReply && key === `session:${slug}:config`) { loseReply = false; throw new Error('Lost handoff reply'); }
    return result;
  };
  assert.equal((await call(importer, 'import-session-backup', importBody)).status, 503);
  const action = recovery === 'status' ? 'session-backup-status' : 'import-session-backup';
  const body = recovery === 'status' ? { archiveId: page.archiveId } : importBody;
  const recovered = await call(importer, action, body);
  assert.equal(recovered.status, 200, await recovered.clone().text());
  assert.equal((await recovered.json()).restore, null);
  assert.equal((await call(stranger, action, body)).status, 403);
  assert.equal((await call(importer, 'session-backup-status', { archiveId: 'different' })).status, 403);
  assert.equal((await call(importer, 'set-config', { config: { sessionName: 'Unauthorized' } })).status, 403);
  const store = restoreStore(target.env);
  const receipt = store.get('session-backup-import-completion');
  store.set('session-backup-import-completion', { ...receipt, completedAt: 0 });
  assert.equal((await call(importer, action, body)).status, 403);
  store.set('session-backup-import-completion', receipt);
  const authority = store.get('session-config-authority');
  store.set('session-config-authority', { ...authority, revision: authority.revision + 1 });
  assert.equal((await call(importer, action, body)).status, 403);
});

// A backup reads stored values in bulk gets. A payload's size comes from its
// record, so payloads are read in groups no larger than the page has room for.
const storeItem = (kv, resource, id, bytes, extra = {}) => {
  const metadata = { id, resource, responder: admin, storageLayer: 'kv', size: bytes.length, ...extra };
  kv.values.set(`ce-storage:${slug}:${resource}:${id}`, JSON.stringify(metadata));
  kv.values.set(`ce-storage-payload:${slug}:${id}`, JSON.stringify({ metadata, payloadBase64url: Buffer.from(bytes).toString('base64url') }));
};
const recordGets = (kv) => {
  const calls = [];
  const get = kv.get;
  kv.get = async (key) => { calls.push({ bulk: Array.isArray(key), keys: [key].flat() }); return get(key); };
  return calls;
};

test('a backup reads each stored value once, in bulk gets that fit a page, and restores', async () => {
  const source = fixture();
  for (let i = 0; i < 250; i += 1) storeItem(source.kv, 'responses', `cf_bulk_${String(i).padStart(3, '0')}`, Buffer.alloc(3_000, 97 + (i % 26)));
  for (let d = 0; d < 2; d += 1) storeItem(source.kv, 'docsContext', `cf_bulk_doc_${d}`, Buffer.alloc(3 * 1024 * 1024, 120 + d));
  source.kv.values.set(`ce-storage-owner:${slug}:questions:0xabc`, '{"uploader":"synthetic"}');
  source.kv.values.set(`ce-storage-hidden:${slug}:questions:0xabc`, '{"hidden":true}');
  const calls = recordGets(source.kv);
  const pages = await allPages(source.env);
  assert.equal(pages.at(-1).manifest.complete, true);
  const stored = [...source.kv.values.keys()].filter((key) => /^ce-storage(-payload|-owner|-hidden)?:/.test(key));
  // A record is read twice: for its payload's size, then as itself. A file
  // larger than a page is read again on each page it continues on, as before.
  for (const key of stored.filter((name) => !name.includes('cf_bulk_doc_'))) {
    assert.equal(source.kv.gets.get(key), /^ce-storage:/.test(key) ? 2 : 1, key);
  }
  assert.ok(calls.every(({ bulk, keys }) => bulk || !/^ce-storage(-payload|-owner|-hidden)?:/.test(keys[0])), 'no stored value is read on its own');
  // Never both large files in one read: a group holds what one page can.
  const docs = (keys) => keys.filter((key) => key.includes('payload') && key.includes('cf_bulk_doc_')).length;
  assert.ok(calls.every(({ keys }) => docs(keys) <= 1));
  assert.ok(Math.max(...source.kv.requests) <= 40, `KV operations per page: ${Math.max(...source.kv.requests)}`);
  const target = fixture();
  target.kv.values.delete(`session:${slug}:config`);
  let result;
  for (const page of pages) assert.equal((result = await importPage(target.env, page)).ok, true);
  assert.equal(result.body.complete, true);
  for (const key of stored) {
    const want = source.kv.values.get(key);
    const got = target.kv.values.get(key);
    if (key.includes('payload')) assert.equal(JSON.parse(got).payloadBase64url, JSON.parse(want).payloadBase64url, key);
    else assert.equal(got, want, key);
  }
});

test('a payload with no record, a misfiled record, or an understated size is still backed up whole', async () => {
  const source = fixture();
  storeItem(source.kv, 'responses', 'cf_understated', Buffer.alloc(200_000, 98), { size: 10 });
  storeItem(source.kv, 'responses', 'cf_misfiled', Buffer.from('misfiled'));
  source.kv.values.set(`ce-storage:${slug}:responses:cf_misfiled`, JSON.stringify({ id: 'cf_other', resource: 'responses', size: 1 }));
  source.kv.values.set(`ce-storage-payload:${slug}:cf_orphan`, JSON.stringify({ metadata: { id: 'cf_orphan' }, payloadBase64url: Buffer.from('orphan').toString('base64url') }));
  const pages = await allPages(source.env);
  assert.equal(pages.at(-1).manifest.complete, true);
  const entries = pages.flatMap((page) => page.entries);
  const bytesOf = (id) => Buffer.concat(entries.filter((entry) => entry.kind === 'chunk' && entry.id === id && !entry.target)
    .map((entry) => Buffer.from(entry.base64url, 'base64url')));
  assert.deepEqual(bytesOf('cf_understated'), Buffer.alloc(200_000, 98));
  assert.equal(bytesOf('cf_misfiled').toString(), 'misfiled');
  assert.equal(bytesOf('cf_orphan').toString(), 'orphan');
});

test('a stored payload without an id or with bytes that do not decode stops the backup, as before', async () => {
  for (const envelope of [{ metadata: {}, payloadBase64url: 'AAAA' }, { metadata: { id: 'cf_bad' }, payloadBase64url: 7 }]) {
    const source = fixture();
    source.kv.values.set(`ce-storage-payload:${slug}:cf_bad`, JSON.stringify(envelope));
    await assert.rejects(allPages(source.env), /A backup payload is missing or unreadable/);
  }
});

test('a bulk get Cloudflare refuses, where records understate their sizes, is read key by key instead', async () => {
  const source = fixture();
  for (let n = 0; n < 9; n += 1) storeItem(source.kv, 'responses', `cf_small_hint_${n}`, Buffer.alloc(3 * 1000 * 1000, 100 + n), { size: 10 });
  const pages = await allPages(source.env);
  assert.equal(pages.at(-1).manifest.complete, true);
  const entries = pages.flatMap((page) => page.entries);
  for (let n = 0; n < 9; n += 1) {
    const bytes = Buffer.concat(entries.filter((entry) => entry.kind === 'chunk' && entry.id === `cf_small_hint_${n}`)
      .map((entry) => Buffer.from(entry.base64url, 'base64url')));
    assert.deepEqual(bytes, Buffer.alloc(3 * 1000 * 1000, 100 + n));
  }
});

test('a payload whose metadata names another id is read by that id, as before', async () => {
  const source = fixture();
  storeItem(source.kv, 'responses', 'cf_named', Buffer.from('named'));
  const metadata = { id: 'cf_named', resource: 'responses', size: 5 };
  source.kv.values.set(`ce-storage-payload:${slug}:cf_alias`, JSON.stringify({ metadata, payloadBase64url: Buffer.from('alias').toString('base64url') }));
  const entries = (await allPages(source.env)).flatMap((page) => page.entries);
  const bytesOf = (id) => entries.filter((entry) => entry.kind === 'chunk' && entry.id === id).map((entry) => Buffer.from(entry.base64url, 'base64url').toString()).join('');
  assert.equal(bytesOf('cf_alias'), 'named');
});

test('a session with no stored payloads exports without an empty bulk get', async () => {
  const source = fixture();
  source.kv.values.set(`ce-storage-owner:${slug}:questions:0xabc`, '{"uploader":"synthetic"}');
  const calls = recordGets(source.kv);
  const pages = await allPages(source.env);
  assert.equal(pages.at(-1).manifest.complete, true);
  assert.ok(calls.every(({ bulk, keys }) => !bulk || keys.length > 0));
});
