import { createWorkerRouteRuntimeWithWorkerDeps } from './workerRouteRuntimeBinding.js';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createWorkerRuntime } from './worker.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
import { issueAgentCredential } from './agent/agentCredentials.mjs';
import { createAgentEnvironment } from './agent/authority.mjs';
export const origin = 'https://session.example';
export const sessionId = '0x11111111111111111111111111111111';
export const wallet = new ethers.Wallet('0x' + '12'.repeat(32));
// Cloudflare KV permits one write to a key per second. Tests opt in after
// setup so retry/projection behavior is checked against the production limit.
export function enforceKvWriteLimit(kv, now = Date.now) {
  const lastWrite = new Map(), rejected = [], writes = [];
  const put = kv.put.bind(kv);
  kv.put = async (key, value, options) => {
    const at = now();
    if (lastWrite.has(key) && at - lastWrite.get(key) < 1000) {
      rejected.push(key);
      throw Object.assign(new Error('KV PUT failed: 429 Too Many Requests'), { status: 429 });
    }
    lastWrite.set(key, at); writes.push({ key, at });
    return put(key, value, options);
  };
  return { rejected, writes };
}

export function fixture(overrides = {}) {
  const records = new Map();
  const writes = [];
  const metadata = new Map();
  let reads = 0;
  const kv = { async get(key) { return records.get(key) ?? null; }, async put(key, value, options) { writes.push(key); records.set(key, value); metadata.set(key, options?.metadata); },
    async delete(key) { writes.push(key); records.delete(key); }, async list({ prefix = '' } = {}) { return { keys: [...records.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name, metadata: metadata.get(name) })), list_complete: true }; } };
  const config = { sessionId, authzEpoch: 1, adminAddress: wallet.address, corsWorkerUrl: origin, allowOrigins: ['https://client.example'],
    sessionModeProfile: { authority: { mode: 'worker_canonical' }, surfaces: { agentHttp: true, browser: true } },
    workerAuthority: { version: 1, loginGate: { conditions: [] }, participantScopes: ['storage', 'groups', 'ai'] }, agentHttp: {} };
  const env = { GROUP_KV: kv, TOKEN_HMAC_SECRET: 'fixture-hmac-secret', AGENT_MANAGED_ROOT_SECRET: 'fresh-session-fixture-root', DEFAULT_SESSION_SLUG: 'fixture' };
  const runtime = createWorkerRuntime(env, {
    readCurrentSessionConfig: async () => { reads++; return { config, revision: 1 }; },
    getSessionConfig: async () => config,
    consumeNonce: async () => ({ ok: true }),
    fetch: async () => { throw new Error('Unexpected external request'); },
    createWorkerRouteRuntimeWithWorkerDeps: args => createWorkerRouteRuntimeWithWorkerDeps({ ...args, deps: { ...args.deps, ...overrides } }),
    ...overrides,
  });
  const agentEnv = createAgentEnvironment({ env, config, revision: 1, slug: 'fixture', origin });
  async function credential({ scopes = ['read_questions', 'draft_answers'], kind = 'user', principal = 'fixture-agent' } = {}) {
    const result = await issueAgentCredential({ env: agentEnv, principal: { principalId: principal, kind, adapter: 'http' },
      sessionSlug: 'fixture', accountAddress: wallet.address, scopes, credentialKind: kind });
    assert.equal(result.ok, true, JSON.stringify(result)); return result;
  }
  async function request(path, { method = 'GET', token, body, headers = {} } = {}) {
    return runtime.fetch(new Request(`${origin}${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...Object.fromEntries(new Headers(headers)) },
      ...(body ? { body: JSON.stringify(body) } : {}) }), env);
  }
  function withCoordinator(deps = {}) {
    const durable = new Map([['session-config-authority', { schemaVersion: 1, slug: 'fixture', revision: 1, config, projectionPending: false }]]);
    let alarm = null;
    const storage = { getAlarm: async () => alarm, setAlarm: async value => { alarm = value; }, deleteAlarm: async () => { alarm = null; }, get: async key => structuredClone(durable.get(key)), put: async (key, value) => durable.set(key, structuredClone(value)),
      delete: async key => durable.delete(key), list: async ({ prefix = '' } = {}) => new Map([...durable].filter(([key]) => key.startsWith(prefix))) };
    let tail = Promise.resolve();
    storage.transaction = operation => { const next = tail.then(() => operation(storage)); tail = next.catch(() => {}); return next; };
    const coordinator = new SessionWriteCoordinator({ storage }, env, deps);
    env.CE_SESSION_COORDINATOR = { idFromName: value => value, get: () => ({ fetch: (url, init) => coordinator.fetch(new Request(url, init)) }) };
    return { durable, coordinator, storage };
  }
  return { env, config, agentEnv, records, metadata, writes, request, credential, withCoordinator, queue: batch => runtime.queue(batch, env), reads: () => reads };
}
