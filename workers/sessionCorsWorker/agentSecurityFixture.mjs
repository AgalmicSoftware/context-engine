// Real dispatcher, nonce, login and coordinator fixture for authority regressions.
import { ethers } from 'ethers';
import { createWorkerRuntime } from './worker.js';
import { buildSiweMessage, installSessionCoordinatorBinding, makeJsonRequest } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { issueAgentCredential, revokeAgentCredentialHash } from './agent/agentCredentials.mjs';
import { createAgentEnvironment } from './agent/authority.mjs';
import { buildAdminActionBodyHash, buildAdminActionTypedData } from './adminTypedData.mjs';
export { ethers, revokeAgentCredentialHash };
export const ORIGIN = 'https://client.example.test';
export const WORKER = 'https://worker.example';
export const admin = new ethers.Wallet('0x' + '11'.repeat(32));
export const member = new ethers.Wallet('0x' + '22'.repeat(32));
export const outsider = new ethers.Wallet('0x' + '33'.repeat(32));

export const baseConfig = (slug, sessionId, extra = {}) => ({
  slug, sessionId, authzEpoch: 1, adminAddress: admin.address, allowOrigins: [ORIGIN], corsWorkerUrl: WORKER,
  workerAuthority: { version: 1, loginGate: { conditions: [] }, participantScopes: ['storage', 'groups', 'ai'] },
  storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
  sessionModeProfile: {
    profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' }, evm: { registryChainId: null },
    storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
    identity: { default: 'passkey', enabled: ['passkey'] }, authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'none' }, surfaces: { web: true, telegram: false, miniApp: false, agentHttp: true, mcp: true, ceCc: false },
    results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
    export: { scope: 'all_session' },
  },
  agentHttp: {},
  ...extra,
});

export function world({ sessions, defaultSlug, overrides = {}, envExtra = {} }) {
  const values = new Map();
  const writes = [];
  const kv = { get: async key => values.get(key) ?? null, put: async (key, value) => { writes.push(key); values.set(key, value); },
    delete: async key => { writes.push(key); values.delete(key); }, list: async ({ prefix = '' } = {}) => ({
      keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
  const configs = new Map(Object.entries(sessions));
  const revisions = new Map([...configs.keys()].map(slug => [slug, 1]));
  const env = installSessionCoordinatorBinding({ GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv,
    TOKEN_HMAC_SECRET: 'synthetic-audit-hmac', CE_STORAGE_ENVELOPE_KEK: 'b'.repeat(64), LOGIN_TRUSTED_ORIGINS: ORIGIN,
    AGENT_MANAGED_ROOT_SECRET: 'synthetic-audit-root', ...(defaultSlug ? { DEFAULT_SESSION_SLUG: defaultSlug } : {}), ...envExtra });
  for (const [slug, config] of configs) values.set(`session:${slug}:config`, JSON.stringify(config));
  const external = [];
  const runtime = createWorkerRuntime(env, {
    readCurrentSessionConfig: async ({ slug }) => configs.has(slug) ? { config: configs.get(slug), revision: revisions.get(slug) } : { config: null, revision: 0 },
    getSessionConfig: async (_env, slug) => configs.get(slug) || null,
    fetch: async (url) => { external.push(String(url)); throw new Error('Unexpected external request'); },
    rpcFetch: async () => { throw new Error('No RPC'); },
    ...overrides,
  });
  const agentEnv = slug => createAgentEnvironment({ env, config: configs.get(slug), revision: revisions.get(slug), slug, origin: WORKER });
  const request = (path, { method = 'GET', token, body, headers = {} } = {}) => runtime.fetch(new Request(`${WORKER}${path}`, {
    method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...Object.fromEntries(new Headers(headers)) },
    ...(body ? { body: JSON.stringify(body) } : {}) }), env);
  async function credential(slug, { scopes = ['read_questions', 'draft_answers'], kind = 'user', principal = 'audit-agent', accountAddress = member.address } = {}) {
    const result = await issueAgentCredential({ env: agentEnv(slug), principal: { principalId: principal, kind: kind === 'service' ? 'service' : 'user', adapter: 'http' },
      sessionSlug: slug, accountAddress, scopes, credentialKind: kind });
    if (!result.ok) throw new Error(JSON.stringify(result));
    return result;
  }
  async function login(slug, wallet = member) {
    const config = configs.get(slug);
    const nonceResponse = await runtime.fetch(makeJsonRequest('/auth/nonce', { address: wallet.address, sessionSlug: slug, sessionId: config.sessionId }, { headers: { Origin: ORIGIN } }), env);
    const nonce = await nonceResponse.json();
    if (nonceResponse.status !== 200) throw new Error(`nonce ${nonceResponse.status} ${JSON.stringify(nonce)}`);
    const message = buildSiweMessage({ domain: new URL(ORIGIN).host, uri: ORIGIN, address: wallet.address, nonce: nonce.nonce, sessionSlug: slug, sessionId: config.sessionId });
    const body = { address: wallet.address, sessionSlug: slug, sessionId: config.sessionId, message, signature: await wallet.signMessage(message) };
    const response = await runtime.fetch(makeJsonRequest('/auth/login', body, { headers: { Origin: ORIGIN } }), env);
    const json = await response.json();
    if (response.status !== 200) throw new Error(`login ${response.status} ${JSON.stringify(json)}`);
    return json.token;
  }
  async function adminNonce(slug, wallet = admin, origin = WORKER) {
    const config = configs.get(slug);
    const r = await runtime.fetch(makeJsonRequest('/auth/nonce', { address: wallet.address, sessionSlug: slug, sessionId: config.sessionId, adminAction: true }, { headers: { Origin: origin } }), env);
    const j = await r.json();
    if (r.status !== 200) throw new Error(`admin nonce ${r.status} ${JSON.stringify(j)}`);
    return j.nonce;
  }
  async function signAdmin(body, wallet = admin) {
    const signed = { httpMethod: 'POST', ...body, address: wallet.address };
    signed.bodyHash = buildAdminActionBodyHash(signed);
    const typed = buildAdminActionTypedData(signed);
    signed.signature = await wallet.signTypedData(typed.domain, { AdminAction: typed.types.AdminAction }, typed.message);
    return signed;
  }
  const bump = (slug, patch) => { configs.set(slug, { ...configs.get(slug), ...patch(configs.get(slug)) }); revisions.set(slug, revisions.get(slug) + 1); };
  return { env, kv, values, writes, configs, revisions, runtime, request, credential, login, adminNonce, signAdmin, agentEnv, bump, external };
}
