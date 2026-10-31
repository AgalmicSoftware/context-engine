import test from 'node:test';
import assert from 'node:assert/strict';

import { storageRoute } from './storageRouteExecution.js';
import { createOutboundUrlSafetyHelpersWithWorkerDeps } from './outboundUrlSafetyBinding.js';
import { buildPdfReadRequest, PDF_READ_PROMPT } from './contextDocumentRead.js';

const ADMIN = `0x${'1'.repeat(40)}`;
const PARTICIPANT = `0x${'2'.repeat(40)}`;
const SCOPES = { storage: true };
const ADMINS_ONLY = { match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] };
const SESSION_CONDITIONS = {
  match: 'any',
  conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'agent_grant_scope', scope: 'storage' }],
};
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7 synthetic deck\nstream binary ÿþ');

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: new Headers([...new Headers(headers), ['Content-Type', 'application/json']]) });

const createKv = () => {
  const store = new Map();
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => { store.set(key, value); },
    delete: async (key) => { store.delete(key); },
    list: async ({ prefix = '' } = {}) => ({ keys: [...store.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true }),
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

const pageResponse = (body, type = 'text/html; charset=utf-8') => new Response(body, { headers: { 'content-type': type } });

// A session with the default access (admins, or anyone with the storage
// scope), pages served from a scripted network, and a scripted AI provider.
const harness = ({ encryption = 'none', pages = {}, ai = { mode: 'anthropic', model: 'claude-sonnet-5-5' }, provider } = {}) => {
  const kv = createKv();
  const r2 = createR2();
  const env = { CE_STORAGE_INDEX_KV: kv, CE_STORAGE_R2: r2, CE_STORAGE_ENVELOPE_KEK: 'synthetic-context-test-kek' };
  const state = {
    config: {
      slug: 'salon',
      adminAddress: ADMIN,
      storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'role_gate', encryption, accessConditions: SESSION_CONDITIONS } },
      ai: { mode: ai.mode, models: { fast: { provider: ai.mode, model: ai.model }, thinking: { provider: ai.mode, model: ai.model } } },
    },
  };
  const pageCalls = [];
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
  };
  const call = (path, { method = 'GET', body, address = '', headers = {} } = {}) => storageRoute({
    path: path.split('?')[0],
    method,
    request: new Request(`https://worker.example${path}`, {
      method,
      ...(body instanceof FormData ? { body } : body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } } : {}),
    }),
    env,
    config: state.config,
    slug: 'salon',
    uploaderAddress: address,
    authScopes: address ? SCOPES : {},
    baseHeaders: {},
    deps,
  });
  const tags = (role, kind, extra = []) => [
    { name: 'CE-DocLibrary', value: '1' },
    { name: 'CE-DocKind', value: kind },
    { name: 'CE-DocStorage', value: 'cloudflare' },
    { name: 'CE-DocRole', value: role },
    ...extra,
  ];
  const uploadFile = ({ address = ADMIN, name = 'deck.pdf', type = 'application/pdf', bytes = PDF_BYTES, adminsOnly = false, role = 'context', extra = {} } = {}) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), name);
    form.append('resource', 'docsContext');
    form.append('contentType', type);
    form.append('tags', JSON.stringify(tags(role, 'file', [{ name: 'CE-DocName', value: name }])));
    if (adminsOnly) form.append('accessConditions', JSON.stringify(ADMINS_ONLY));
    Object.entries(extra).forEach(([key, value]) => form.append(key, value));
    return call('/storage/upload', { method: 'POST', body: form, address });
  };
  const context = (body, address = ADMIN) => call('/storage/context', { method: 'POST', body, address });
  const list = async (address) => (await (await call('/storage/list?resource=docsContext&role=context', { address })).json()).items;
  const read = (id, address) => call(`/storage/read?id=${encodeURIComponent(id)}`, { address });
  return { env, kv, r2, state, deps, call, uploadFile, context, list, read, tags, pageCalls, providerCalls };
};

const idOf = async (response) => {
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.id || body.source?.id || body.text?.id;
};
const tagOf = (item, name) => item.metadata.tags.find((tag) => tag.name === name)?.value;

test('only session admins add context, and only as readable PDF or text files', async () => {
  const h = harness();
  const refused = await h.uploadFile({ address: PARTICIPANT });
  assert.equal(refused.status, 403);
  assert.equal((await refused.json()).reason, 'context_admin_required');
  // A participant's ordinary document upload is unaffected.
  const form = new FormData();
  form.append('file', new Blob(['notes'], { type: 'text/plain' }), 'notes.txt');
  form.append('resource', 'docsContext');
  form.append('tags', JSON.stringify([{ name: 'CE-DocLibrary', value: '1' }]));
  assert.equal((await h.call('/storage/upload', { method: 'POST', body: form, address: PARTICIPANT })).status, 200);

  for (const [options, status, reason] of [
    [{ name: 'deck.pptx', type: 'application/vnd.ms-powerpoint' }, 415, 'context_type_unsupported'],
    [{ name: 'notes.txt', type: 'text/plain', bytes: new Uint8Array(1024 * 1024 + 1) }, 413, 'context_too_large'],
    [{ extra: { payloadEncrypted: 'true' } }, 400, 'context_encryption_unsupported'],
    [{ extra: { groupId: 'facilitators' } }, 400, 'context_policy_unsupported'],
    [{ extra: { accessConditions: JSON.stringify({ match: 'any', conditions: [{ kind: 'worker_role', role: 'reviewer' }] }) } }, 400, 'context_policy_unsupported'],
    // Links and AI-read text are written by the context route alone.
    [{ role: 'context-text', name: 'deck.txt', type: 'text/plain', bytes: new TextEncoder().encode('forged reading') }, 400, 'context_route_required'],
  ]) {
    const response = await h.uploadFile(options);
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    assert.equal(body.reason, reason);
  }
  const link = await h.call('/storage/upload', {
    method: 'POST',
    address: ADMIN,
    body: { resource: 'docsContext', contentType: 'application/json', data: { v: 1, kind: 'link', url: 'https://example.org' }, tags: h.tags('context', 'link') },
  });
  assert.equal((await link.json()).reason, 'context_route_required');

  const id = await idOf(await h.uploadFile());
  const [item] = await h.list(ADMIN);
  assert.equal(item.storageRef.id, id);
  assert.equal(item.metadata.contextSource, true);
  assert.equal(item.metadata.adminsOnly, false);
  const stored = JSON.parse(h.kv.store.get([...h.kv.store.keys()].find((key) => key.endsWith(`:docsContext:${id}`))));
  assert.deepEqual([stored.contextSource, stored.uploadAuthority, stored.uploader], [true, 'admin', ADMIN]);
});

test('an admins-only item is refused to participants on read and list; admins read it', async () => {
  for (const encryption of ['none', 'worker_envelope']) {
    const h = harness({ encryption });
    const everyone = await idOf(await h.uploadFile({ name: 'agenda.md', type: 'text/markdown', bytes: new TextEncoder().encode('# Agenda') }));
    const hidden = await idOf(await h.uploadFile({ name: 'board-notes.txt', type: 'text/plain', bytes: new TextEncoder().encode('Admins only notes'), adminsOnly: true }));
    assert.deepEqual((await h.list(PARTICIPANT)).map((item) => item.storageRef.id), [everyone]);
    const anonymous = await h.call('/storage/list?resource=docsContext&role=context');
    assert.ok([401, 403].includes(anonymous.status), 'this session admits signed-in people only');
    const adminItems = await h.list(ADMIN);
    assert.deepEqual(adminItems.map((item) => [item.storageRef.id, item.metadata.adminsOnly]).sort(), [[everyone, false], [hidden, true]].sort());
    assert.equal((await h.read(hidden, PARTICIPANT)).status, 403);
    assert.equal(await (await h.read(hidden, ADMIN)).text(), 'Admins only notes');
    assert.equal(await (await h.read(everyone, PARTICIPANT)).text(), '# Agenda');
    // The role filter narrows the list to context; a plain list keeps everything visible.
    const plain = await (await h.call('/storage/list?resource=docsContext', { address: PARTICIPANT })).json();
    assert.deepEqual(plain.items.map((item) => item.storageRef.id), [everyone]);
  }
});

test('a link is fetched by the Worker under the strict policy and stored with its snapshot', async () => {
  const h = harness({
    pages: {
      'https://example.org/essay': pageResponse('<html><head><title>On Reverse Alignment</title></head><body><nav>Menu</nav><p>Institutions adapt.</p></body></html>'),
    },
  });
  assert.equal((await h.context({ action: 'add-link', url: 'https://example.org/essay' }, PARTICIPANT)).status, 403);
  const added = await h.context({ action: 'add-link', url: 'https://example.org/essay', adminsOnly: true });
  const { source } = await added.json();
  assert.equal(added.status, 200);
  assert.deepEqual([source.kind, source.title, source.url, source.adminsOnly, source.truncated], ['link', 'On Reverse Alignment', 'https://example.org/essay', true, false]);
  assert.match(source.fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
  const record = await (await h.read(source.id, ADMIN)).json();
  assert.deepEqual(record.snapshot.text, 'Institutions adapt.');
  assert.equal(record.snapshot.fetchedAt, source.fetchedAt);
  assert.equal((await h.read(source.id, PARTICIPANT)).status, 403);
  const [item] = await h.list(ADMIN);
  assert.equal(tagOf(item, 'CE-ContextUrl'), 'https://example.org/essay');
  assert.equal(item.metadata.adminsOnly, true);

  for (const url of ['http://example.org/essay', 'https://127.0.0.1/admin', 'https://user:[redacted-email]/', 'https://intranet/']) {
    const refused = await h.context({ action: 'add-link', url });
    assert.ok([400, 422].includes(refused.status), `${url}: ${refused.status}`);
  }
  assert.deepEqual(h.pageCalls, ['https://example.org/essay'], 'refused links never reach the network');
  assert.equal((await h.list(ADMIN)).length, 1);
});

test('Refresh stores a new snapshot with the same privacy and title, then drops the old one', async () => {
  let version = 0;
  const h = harness({ pages: { 'https://example.org/post': () => pageResponse(`Post text, version ${++version}.`, 'text/plain') } });
  const first = (await (await h.context({ action: 'add-link', url: 'https://example.org/post', title: 'RxC post' })).json()).source;
  const refreshed = await h.context({ action: 'add-link', url: 'https://example.org/post', replaces: first.id });
  const { source } = await refreshed.json();
  assert.equal(refreshed.status, 200);
  assert.deepEqual([source.title, source.adminsOnly], ['RxC post', false]);
  assert.notEqual(source.id, first.id);
  assert.deepEqual((await h.list(ADMIN)).map((item) => item.storageRef.id), [source.id]);
  assert.equal((await (await h.read(source.id, ADMIN)).json()).snapshot.text, 'Post text, version 2.');
  assert.equal((await h.read(first.id, ADMIN)).status, 404);
  assert.equal((await h.context({ action: 'add-link', url: 'https://example.org/post', replaces: first.id })).status, 404);
});

test('a PDF is read by the session’s Claude as a native document block, and its text keeps the PDF’s privacy', async () => {
  const h = harness({
    provider: async () => json({ content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'Slide 1: Coalition goals.' }], stop_reason: 'end_turn' }),
  });
  const pdf = await idOf(await h.uploadFile({ adminsOnly: true }));
  assert.equal((await h.context({ action: 'read-pdf', id: pdf }, PARTICIPANT)).status, 403);
  const response = await h.context({ action: 'read-pdf', id: pdf });
  const { text } = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual([text.derivedFrom, text.model, text.truncated], [pdf, 'claude-sonnet-5-5', false]);

  const [call] = h.providerCalls;
  assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(call.init.headers['x-api-key'], 'synthetic-anthropic-key');
  assert.equal(call.body.model, 'claude-sonnet-5-5');
  const [documentBlock, textBlock] = call.body.messages[0].content;
  assert.deepEqual(documentBlock.source.media_type, 'application/pdf');
  assert.equal(documentBlock.type, 'document');
  assert.equal(documentBlock.source.type, 'base64');
  assert.equal(documentBlock.source.data, Buffer.from(PDF_BYTES).toString('base64'));
  assert.doesNotMatch(documentBlock.source.data, /\s/);
  assert.deepEqual(textBlock, { type: 'text', text: PDF_READ_PROMPT });
  assert.equal('temperature' in call.body, false);

  const items = await h.list(ADMIN);
  const reading = items.find((item) => item.storageRef.id === text.id);
  assert.equal(tagOf(reading, 'CE-DocRole'), 'context-text');
  assert.equal(tagOf(reading, 'CE-DocDerivedFromTx'), pdf);
  assert.equal(tagOf(reading, 'CE-ReadBy'), 'ai');
  assert.equal(tagOf(reading, 'CE-ReadModel'), 'claude-sonnet-5-5');
  assert.equal(reading.metadata.adminsOnly, true);
  assert.equal(await (await h.read(text.id, ADMIN)).text(), 'Slide 1: Coalition goals.');
  assert.equal((await h.read(text.id, PARTICIPANT)).status, 403);
  assert.deepEqual(await h.list(PARTICIPANT), []);

  // Reading again replaces the earlier text; removing the PDF removes its text.
  const again = (await (await h.context({ action: 'read-pdf', id: pdf })).json()).text;
  const ids = (await h.list(ADMIN)).map((item) => item.storageRef.id).sort();
  assert.deepEqual(ids, [pdf, again.id].sort());
  const removed = await (await h.context({ action: 'remove', id: pdf })).json();
  assert.deepEqual(removed.removed.sort(), [pdf, again.id].sort());
  assert.deepEqual(await h.list(ADMIN), []);
  assert.equal((await h.read(pdf, ADMIN)).status, 404);
  assert.equal(h.r2.store.size, 0, 'no stored bytes outlive their rows');
});

test('an OpenAI session reads a PDF through the Responses API file input', async () => {
  const h = harness({
    ai: { mode: 'openai', model: 'gpt-5.6-terra' },
    provider: async () => json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Deck text.' }] }], status: 'completed' }),
  });
  const pdf = await idOf(await h.uploadFile());
  const { text } = await (await h.context({ action: 'read-pdf', id: pdf })).json();
  assert.equal(text.model, 'gpt-5.6-terra');
  const [call] = h.providerCalls;
  assert.equal(call.url, 'https://api.openai.com/v1/responses');
  assert.equal(call.init.headers.authorization, 'Bearer synthetic-openai-key');
  const [filePart, textPart] = call.body.input[0].content;
  assert.deepEqual(filePart, {
    type: 'input_file',
    filename: 'deck.pdf',
    file_data: `data:application/pdf;base64,${Buffer.from(PDF_BYTES).toString('base64')}`,
  });
  assert.deepEqual(textPart, { type: 'input_text', text: PDF_READ_PROMPT });
  assert.equal(call.body.max_output_tokens, 8000);
  // Everyone may read the reading of an everyone PDF.
  assert.equal(await (await h.read(text.id, PARTICIPANT)).text(), 'Deck text.');
});

test('PDF reading needs Claude or OpenAI, AI switched on, and a PDF', async () => {
  const other = harness({ ai: { mode: 'openrouter', model: 'openrouter/auto' } });
  const pdf = await idOf(await other.uploadFile());
  const refused = await other.context({ action: 'read-pdf', id: pdf });
  assert.equal(refused.status, 400);
  assert.equal((await refused.json()).reason, 'context_pdf_provider_unsupported');
  assert.equal(other.providerCalls.length, 0);

  const off = harness();
  off.state.config.scopes = { ai: false };
  const offPdf = await idOf(await off.uploadFile());
  assert.equal((await off.context({ action: 'read-pdf', id: offPdf })).status, 403);

  const notes = await idOf(await off.uploadFile({ name: 'notes.txt', type: 'text/plain', bytes: new TextEncoder().encode('Notes') }));
  off.state.config.scopes = {};
  assert.equal((await off.context({ action: 'read-pdf', id: notes })).status, 404);

  const failing = harness({ provider: async () => json({ error: { message: 'PDF has more than 600 pages' } }, 400) });
  const big = await idOf(await failing.uploadFile());
  const failed = await failing.context({ action: 'read-pdf', id: big });
  assert.equal(failed.status, 502);
  assert.match((await failed.json()).error, /600 pages/);
  assert.deepEqual((await failing.list(ADMIN)).map((item) => item.storageRef.id), [big], 'a failed reading stores nothing');
});

test('the request body carries the PDF as base64 bytes without copying it into a string', () => {
  for (const length of [0, 1, 2, 3, 4, 5, 1000]) {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 37) % 256);
    for (const provider of ['anthropic', 'openai']) {
      const { body } = buildPdfReadRequest({ provider, model: provider === 'openai' ? 'gpt-4.1' : 'claude-sonnet-5-5', maxTokens: 10, bytes, filename: 'a.pdf' });
      const parsed = JSON.parse(new TextDecoder().decode(body));
      const data = provider === 'anthropic'
        ? parsed.messages[0].content[0].source.data
        : parsed.input[0].content[0].file_data.replace('data:application/pdf;base64,', '');
      assert.equal(data, Buffer.from(bytes).toString('base64'));
      if (provider === 'openai') assert.equal('reasoning' in parsed, false, 'a non-reasoning model gets no effort');
    }
  }
});
