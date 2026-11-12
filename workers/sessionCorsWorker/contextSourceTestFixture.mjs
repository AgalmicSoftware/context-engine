import { publishCloudflareOwnedStorageMetadata, storageRoute } from './storageRouteExecution.js';
import { createOutboundUrlSafetyHelpersWithWorkerDeps } from './outboundUrlSafetyBinding.js';
import { installSessionCoordinatorBinding } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';

// A Session Worker's storage for context-source tests: in-memory KV and R2, a
// session coordinator, a session with the default access, pages from a scripted
// network, and a scripted AI provider. Nothing here reaches a real network or service.
// `state.scopes` are a signed-in caller's scopes, and `state.fetchAccess` is what
// the dispatcher's fetch check answers.
export const ADMIN = `0x${'1'.repeat(40)}`;
export const PARTICIPANT = `0x${'2'.repeat(40)}`;
const ADMINS_ONLY = { match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] };
const SESSION_CONDITIONS = {
  match: 'any',
  conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'agent_grant_scope', scope: 'storage' }],
};
export const PDF_BYTES = new TextEncoder().encode('%PDF-1.7 synthetic deck\nstream binary ÿþ');

export const json = (body, status = 200, baseHeaders = {}) => {
  const headers = new Headers(baseHeaders);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
};

// `lagging` holds keys a KV list does not show yet, as after a recent write.
// As in KV, a put replaces a key's list metadata, and one without it clears it,
// and a list returns at most `limit` keys (1,000 by default) and a cursor.
const createKv = () => {
  const store = new Map();
  const listMetadata = new Map();
  const lagging = new Set();
  const deletes = [];
  return {
    store,
    listMetadata,
    lagging,
    deletes,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value, options) => {
      store.set(key, value);
      if (options?.metadata) listMetadata.set(key, options.metadata);
      else listMetadata.delete(key);
    },
    delete: async (key) => { deletes.push(key); store.delete(key); listMetadata.delete(key); },
    // Keys list in the order they were first written; the cursor is the next offset.
    list: async ({ prefix = '', cursor = '', limit = 1000 } = {}) => {
      const names = [...store.keys()].filter((key) => key.startsWith(prefix) && !lagging.has(key));
      const start = Number(cursor) || 0;
      const end = start + limit;
      return {
        keys: names.slice(start, end).map((name) => (listMetadata.has(name) ? { name, metadata: listMetadata.get(name) } : { name })),
        list_complete: end >= names.length,
        ...(end < names.length ? { cursor: String(end) } : {}),
      };
    },
  };
};
const createR2 = () => {
  const store = new Map();
  return {
    store,
    put: async (key, value) => { store.set(key, new Uint8Array(value instanceof Uint8Array ? value : new Uint8Array(value))); },
    get: async (key) => {
      const bytes = store.get(key);
      return bytes ? { customMetadata: {}, arrayBuffer: async () => bytes.slice().buffer, size: bytes.length } : null;
    },
    delete: async (key) => { store.delete(key); },
  };
};

export const pageResponse = (body, type = 'text/html; charset=utf-8') => new Response(body, { headers: { 'content-type': type } });

export const harness = ({ encryption = 'none', pages = {}, ai = { mode: 'anthropic', model: 'claude-sonnet-5-5' }, provider } = {}) => {
  const kv = createKv();
  const r2 = createR2();
  const env = installSessionCoordinatorBinding({ CE_STORAGE_INDEX_KV: kv, CE_STORAGE_R2: r2, CE_STORAGE_ENVELOPE_KEK: 'synthetic-context-test-kek' });
  const state = {
    config: {
      slug: 'salon',
      adminAddress: ADMIN,
      storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'role_gate', encryption, accessConditions: SESSION_CONDITIONS } },
      ai: { mode: ai.mode, models: { fast: { provider: ai.mode, model: ai.model }, thinking: { provider: ai.mode, model: ai.model } } },
    },
    scopes: { storage: true, fetch: true },
    fetchAccess: { ok: true },
  };
  const pageCalls = [];
  const fetchChecks = [];
  const network = async (url, init) => {
    pageCalls.push(String(url));
    const page = pages[String(url)];
    if (!page) throw new Error(`unexpected page fetch ${url}`);
    return typeof page === 'function' ? page(init) : page;
  };
  const providerCalls = [];
  const { safeFetch, isBlockedOutboundUrl } = createOutboundUrlSafetyHelpersWithWorkerDeps({ deps: { fetch: network } });
  const deps = {
    json,
    safeFetch,
    isBlockedOutboundUrl,
    fetch: async (url, init) => {
      providerCalls.push({ url: String(url), init, body: JSON.parse(new TextDecoder().decode(init.body)) });
      return provider ? provider(String(url), init) : json({ error: { message: 'no provider' } }, 500);
    },
    getSessionSecrets: async () => ({ anthropicKey: 'synthetic-anthropic-key', openaiKey: 'synthetic-openai-key' }),
    getOrCreateCoordinatedStorageEnvelopeSessionKey: async ({ baseConfig, candidateRecord }) => {
      state.config = { ...baseConfig, storageEnvelope: { sessionKey: baseConfig.storageEnvelope?.sessionKey || candidateRecord } };
      return { config: state.config, created: true };
    },
    // The session coordinator's publication step, checked against the current config.
    executeCoordinatedStoragePublication: async ({ expectedAuthority, ...publication }) => {
      try {
        await publishCloudflareOwnedStorageMetadata({ ...publication, config: state.config, actor: expectedAuthority.actor });
        return { ok: true, status: 200, body: { ok: true } };
      } catch (error) {
        return { ok: false, status: error.status || 503, body: { error: error.message } };
      }
    },
  };
  const call = (path, { method = 'GET', body, address = '' } = {}) => storageRoute({
    path: path.split('?')[0],
    method,
    request: new Request(`https://worker.example${path}`, {
      method,
      ...(body instanceof FormData ? { body } : body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
    }),
    env,
    config: state.config,
    slug: 'salon',
    uploaderAddress: address,
    authScopes: address ? state.scopes : {},
    expectedAuthority: { actor: address },
    baseHeaders: {},
    checkFetchAccess: async () => {
      fetchChecks.push(address);
      return state.fetchAccess;
    },
    deps,
  });
  const tags = (role, kind, extra = []) => [
    { name: 'CE-DocLibrary', value: '1' },
    { name: 'CE-DocKind', value: kind },
    { name: 'CE-DocStorage', value: 'cloudflare' },
    { name: 'CE-DocRole', value: role },
    ...extra,
  ];
  const uploadFile = ({ address = ADMIN, name = 'deck.pdf', type = 'application/pdf', bytes = PDF_BYTES, adminsOnly = false, role = 'context', extra = {}, extraTags = [] } = {}) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), name);
    form.append('resource', 'docsContext');
    form.append('contentType', type);
    form.append('tags', JSON.stringify(tags(role, 'file', [{ name: 'CE-DocName', value: name }, ...extraTags])));
    if (adminsOnly) form.append('accessConditions', JSON.stringify(ADMINS_ONLY));
    Object.entries(extra).forEach(([key, value]) => form.append(key, value));
    return call('/storage/upload', { method: 'POST', body: form, address });
  };
  const context = (body, address = ADMIN) => call('/storage/context', { method: 'POST', body, address });
  const list = async (address) => (await (await call('/storage/list?resource=docsContext&role=context', { address })).json()).items;
  const read = (id, address) => call(`/storage/read?id=${encodeURIComponent(id)}`, { address });
  return { env, kv, r2, state, deps, call, uploadFile, context, list, read, tags, pageCalls, fetchChecks, providerCalls };
};

export const idOf = async (response) => {
  const body = await response.json();
  if (response.status !== 200) throw new Error(`expected 200, got ${response.status}: ${JSON.stringify(body)}`);
  return body.id || body.source?.id || body.text?.id;
};
