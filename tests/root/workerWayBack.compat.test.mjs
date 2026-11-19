/**
 * @jest-environment node
 */
// The way back: a session whose Worker is put back on the released bundle
// after running this one. Data, a backup and settings made here, names set
// and saved off included, must still read, restore and save under the
// released bundle, and come back intact when this Worker returns.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import { createSignedSiweBody, installSessionCoordinatorBinding, makeJsonRequest } from '../helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerClient } from '../../mcp/lib/workerClient.mjs';
import { createWorkerRuntime } from '../../workers/sessionCorsWorker/worker.js';
import { SessionWriteCoordinator } from '../../workers/sessionCorsWorker/sessionWriteCoordinator.js';

const repo = path.resolve(__dirname, '../..');
// The bundle a live session would go back to (0.9.12; 0.9.13 to 0.9.16 changed
// no Worker code). Move this pin deliberately, to the bundle live sessions run
// before the release being cut; never to a moving tag.
const tag = 'refs/tags/worker-bundles-8d41d69ffc6db0fa31d990d306ed2979d9fe02fa';
let hasTag = true;
try { execFileSync('git', ['rev-parse', '--verify', tag], { cwd: repo, stdio: 'pipe' }); }
catch {
  const message = `The Worker way-back drill requires ${tag} (fetch full history to run it).`;
  if (process.env.CI) throw new Error(message);
  hasTag = false;
  console.warn(`Skipping locally: ${message}`);
}

const memoryKv = () => {
  const values = new Map();
  const listMetadata = new Map();
  return {
    values,
    get: async (key) => {
      if (!Array.isArray(key)) return values.get(key) ?? null;
      if (key.length < 1 || key.length > 100) throw new Error(`KV GET_BULK failed: ${key.length} keys`);
      return new Map(key.map(name => [name, values.get(name) ?? null]));
    },
    put: async (key, value, options) => {
      if (options?.metadata) listMetadata.set(key, options.metadata);
      else listMetadata.delete(key);
      values.set(key, value);
    },
    delete: async (key) => { listMetadata.delete(key); values.delete(key); },
    list: async ({ prefix = '', cursor = '', limit = 100 } = {}) => {
      const names = [...values.keys()].filter(key => key.startsWith(prefix) && key > cursor).sort();
      const keys = names.slice(0, limit).map(name => (listMetadata.has(name) ? { name, metadata: listMetadata.get(name) } : { name }));
      return { keys, list_complete: names.length <= limit, cursor: names.length > limit ? keys.at(-1).name : '' };
    },
  };
};

(hasTag ? describe : describe.skip)('putting a session back on the released Worker bundle', () => {
  let tempDir;
  let released;
  const testResponse = globalThis.Response;
  const origin = 'https://worker.example';
  const site = 'https://app.example';
  const slug = 'way-back';
  const sessionId = `0x${'3'.repeat(32)}`;
  const [owner, member] = [4, 5].map(digit => new ethers.Wallet(`0x${String(digit).repeat(64)}`));

  beforeAll(async () => {
    // Both Workers run on the platform's Response, which the shared Jest
    // setup replaces with a partial stand-in; Node's own fetch still makes it.
    globalThis.Response = (await fetch('data:,')).constructor;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-way-back-worker-'));
    const bundlePath = path.join(tempDir, 'worker.mjs');
    await fs.writeFile(bundlePath, execFileSync('git', ['show', `${tag}:deploy/cloudflare/session-worker/worker.mjs`], { cwd: repo, maxBuffer: 20 * 1024 * 1024 }));
    released = await import(bundlePath);
  }, 120000);

  afterAll(async () => {
    globalThis.Response = testResponse;
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('reads, restores and saves settings on the released bundle, and keeps names for the return', async () => {
    let clock = Date.now();
    const now = jest.spyOn(Date, 'now').mockImplementation(() => clock);
    try {
      // One session's stores, kept across the redeploy: its KV and its coordinator's storage.
      const kv = memoryKv();
      const coordinatorStores = new Map();
      const environment = (Coordinator, store = kv) => {
        const env = installSessionCoordinatorBinding({ GROUP_KV: store, CE_STORAGE_INDEX_KV: store,
          CE_STORAGE_ENVELOPE_KEK: 'a'.repeat(64), TOKEN_HMAC_SECRET: 'synthetic-way-back-hmac',
          ADMIN_TRUSTED_ORIGINS: site, BOOTSTRAP_ADMIN_ADDRESS: owner.address }, Coordinator);
        if (store !== kv) return env;
        // A redeploy keeps each coordinator's storage; only its code changes.
        const binding = env.CE_SESSION_COORDINATOR;
        const get = binding.get;
        binding.get = (id) => {
          const instance = get(id);
          if (!coordinatorStores.has(id)) coordinatorStores.set(id, instance.store);
          else if (instance.store !== coordinatorStores.get(id)) {
            for (const [key, value] of coordinatorStores.get(id)) instance.store.set(key, value);
            coordinatorStores.set(id, instance.store);
          }
          return instance;
        };
        return env;
      };
      const offline = async () => { throw new Error('Unexpected network call'); };
      const runtime = (create, env) => create(env, { now: () => clock, fetch: offline, rpcFetch: offline });
      // The Worker serving the session now; the redeploy swaps it under the same clients.
      let deployed;
      const deploy = (create, Coordinator) => {
        const env = environment(Coordinator);
        deployed = { env, worker: runtime(create, env) };
        return deployed;
      };
      // Sign-ins, counted: the client signs in again on its own after a refused token.
      let signIns = 0;
      const client = wallet => createWorkerClient({ workerOrigin: origin, slug, trustedOrigins: [site], wallet,
        fetchImpl: (url, init) => {
          if (new URL(url).pathname.startsWith('/auth/')) signIns += 1;
          return deployed.worker.fetch(new Request(url, init), deployed.env, { waitUntil() {} });
        } });
      const signed = async (target, action, body = {}) => {
        clock += 61_000;
        const signedBody = await createSignedSiweBody({ worker: target.worker, env: target.env, wallet: owner, sessionSlug: slug, sessionId,
          adminAction: action, audience: site, body });
        const response = await target.worker.fetch(makeJsonRequest(`/admin/${action}`, signedBody, { headers: { Origin: site } }), target.env);
        return { status: response.status, body: await response.json() };
      };
      const readConfig = async () => (await (await deployed.worker.fetch(
        new Request(`${origin}/session-config?slug=${slug}`, { headers: { 'X-Session-Slug': slug } }), deployed.env)).json()).config;

      const config = JSON.parse(await fs.readFile(path.join(repo, 'tests/fixtures/worker-compat/previous-minor.json'), 'utf8')).config;
      Object.assign(config, { slug, sessionId, sessionIdHex: sessionId, adminAddress: owner.address, allowOrigins: [site],
        corsWorkerUrl: origin, workerAuthority: { version: 1, participantScopes: ['storage'] } });
      delete config.resultsAnalysis;
      await kv.put(`session:${slug}:config`, JSON.stringify(config));

      // On this Worker: a question, an answer, a name, names saved off, and a backup.
      const current = deploy(createWorkerRuntime, SessionWriteCoordinator);
      const [admin, person] = [client(owner), client(member)];
      const questionId = `0x${'7'.repeat(64)}`;
      const question = await admin.upload({ resource: 'questions', data: JSON.stringify({ id: questionId, type: 'text', prompt: 'Keep going?', sessionId, sessionSlug: slug }) });
      const answer = await person.upload({ resource: 'responses', data: JSON.stringify({ questionID: questionId, answer: { value: 'Yes' } }) });
      expect(await person.request('/names/set', { method: 'POST', auth: true, body: { name: 'Sam' } })).toMatchObject({ name: 'Sam' });
      const memberKey = member.address.toLowerCase();
      expect((await person.request('/names', { auth: true })).names).toEqual({ [memberKey]: 'Sam' });
      expect(await signed(current, 'set-config', { config: { ...config, namesEnabled: false } })).toMatchObject({ status: 200 });
      expect((await readConfig()).namesEnabled).toBe(false);
      const pages = [];
      let cursor = '';
      do {
        const page = await signed(current, 'export-session-backup', { cursor });
        expect([page.status, page.body.error]).toEqual([200, undefined]);
        pages.push(page.body);
        cursor = page.body.nextCursor;
      } while (cursor);
      expect(JSON.stringify(pages)).toContain('Sam');

      // Back on the released bundle, same stores, same sign-ins.
      const signedInBefore = signIns;
      const previous = deploy(released.createWorkerRuntime, released.SessionWriteCoordinator);
      // (a) What this Worker stored still reads, for people signed in before the redeploy.
      expect((await person.read(answer.id)).answer.value).toBe('Yes');
      expect((await admin.listAll('responses')).items).toHaveLength(1);
      expect((await admin.listAll('questions')).items.map(row => row.storageRef?.id)).toEqual([question.id]);
      expect(signIns).toBe(signedInBefore);
      // (b) The backup restores into a fresh session.
      const fresh = { env: environment(released.SessionWriteCoordinator, memoryKv()) };
      fresh.worker = runtime(released.createWorkerRuntime, fresh.env);
      for (const page of pages) {
        const result = await signed(fresh, 'import-session-backup', { page, adoptSessionId: true, workerUrl: origin });
        expect(result).toMatchObject({ status: 200, body: { complete: page.manifest.complete, counts: { conflicts: 0 } } });
      }
      const restored = createWorkerClient({ workerOrigin: origin, slug, trustedOrigins: [site], wallet: member,
        fetchImpl: (url, init) => fresh.worker.fetch(new Request(url, init), fresh.env, { waitUntil() {} }) });
      expect((await restored.read(answer.id)).answer.value).toBe('Yes');
      expect((await restored.listAll('questions')).items.map(row => row.storageRef?.id)).toEqual([question.id]);
      // The released Worker has no names: a restore there leaves them out, and
      // only the same backup restored on this Worker brings them back.
      const restoredKeys = [...fresh.env.__coordinatorInstances.values()].flatMap(instance => [...instance.store.keys()]);
      expect(restoredKeys.some(key => key.startsWith('session-config-authority'))).toBe(true);
      expect(restoredKeys.filter(key => key.startsWith('session-name-v1:'))).toEqual([]);
      // (c) Settings save. The released Worker serves the config without the
      // setting it does not know, and a save without it goes through.
      expect(await readConfig()).not.toHaveProperty('namesEnabled');
      expect(await signed(previous, 'set-config', { config: { ...config, sessionName: 'Renamed on the way back' } }))
        .toEqual({ status: 200, body: { ok: true } });
      expect((await readConfig()).sessionName).toBe('Renamed on the way back');
      // A save that still carries it, from a page loaded before the way back,
      // is refused whole: reload the admin page after redeploying, then save.
      expect(await signed(previous, 'set-config', { config: { ...config, namesEnabled: false, sessionName: 'Refused' } })).toEqual({
        status: 400, body: { error: 'Unsupported worker-canonical session config field: namesEnabled.' },
      });

      // This Worker again: the edit stands, names stay off, and the name was kept.
      const signedInBack = signIns;
      deploy(createWorkerRuntime, SessionWriteCoordinator);
      expect(await readConfig()).toMatchObject({ sessionName: 'Renamed on the way back', namesEnabled: false });
      expect((await person.request('/names', { auth: true })).names).toEqual({});
      expect(await signed(deployed, 'set-config', { config: { ...config, sessionName: 'Renamed on the way back', namesEnabled: true } })).toMatchObject({ status: 200 });
      expect((await person.request('/names', { auth: true })).names).toEqual({ [memberKey]: 'Sam' });
      expect((await admin.read(answer.id)).answer.value).toBe('Yes');
      expect(signIns).toBe(signedInBack);
    } finally {
      now.mockRestore();
    }
  }, 120000);
});
