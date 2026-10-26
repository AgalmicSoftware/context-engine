import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installSessionCoordinatorBinding, createSignedSiweBody, makeJsonRequest } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerRuntime } from './worker.js';
import { exportSessionBackup } from './sessionBackup.js';
import { STORAGE_EXPORT_PAGE_LIMITS } from './storageScanBudget.js';

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
