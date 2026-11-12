import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPdfReadRequest, PDF_READ_PROMPT } from './contextDocumentRead.js';
import { agentAdderTags, groupLockedAccess } from '../../shared/sessionContextSources.mjs';
import { ADMIN, PARTICIPANT, PDF_BYTES, harness, idOf, json, pageResponse } from './contextSourceTestFixture.mjs';
import { publishCloudflareOwnedStorageMetadata } from './storageRouteExecution.js';

const tagOf = (item, name) => item.metadata.tags.find((tag) => tag.name === name)?.value;

test('signed-in people add context files unless the session limits it, and only as readable PDF or text', async () => {
  const h = harness();
  assert.ok([401, 403].includes((await h.uploadFile({ address: '' })).status), 'a signed-out upload is refused');
  const id = await idOf(await h.uploadFile({ address: PARTICIPANT, name: 'notes.txt', type: 'text/plain', bytes: new TextEncoder().encode('notes') }));
  const [added] = await h.list(PARTICIPANT);
  assert.deepEqual([added.storageRef.id, added.metadata.addedBy, added.metadata.uploadAuthority], [id, PARTICIPANT, undefined]);
  const storedByParticipant = JSON.parse(h.kv.store.get([...h.kv.store.keys()].find((key) => key.endsWith(`:docsContext:${id}`))));
  assert.deepEqual([storedByParticipant.contextSource, storedByParticipant.uploadAuthority, storedByParticipant.uploader], [true, 'author', PARTICIPANT]);
  // An AI reading stays with the admins: it spends the session's AI on someone's behalf.
  assert.equal((await h.context({ action: 'read-pdf', id }, PARTICIPANT)).status, 403);

  h.state.config.contextAdditionPolicy = 'admin_only';
  const refused = await h.uploadFile({ address: PARTICIPANT });
  assert.equal(refused.status, 403);
  assert.equal((await refused.json()).reason, 'context_admin_required');
  assert.equal((await h.uploadFile({ address: ADMIN })).status, 200, 'admins still add');
});

test('context is a readable PDF or text file, and links and AI text come only from the context route', async () => {
  const h = harness();
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
    [{ extra: { accessConditions: JSON.stringify({ match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'worker_group', groupIds: ['salon'] }] }) } }, 400, 'context_policy_unsupported'],
    [{ extra: { accessConditions: JSON.stringify({ match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['salon'] }] }) } }, 400, 'context_policy_unsupported'],
    [{ extra: { accessConditions: JSON.stringify({ match: 'any', conditions: [{ kind: 'worker_role', role: 'reviewer' }] }) } }, 400, 'context_policy_unsupported'],
    // A lock checks each group as someone reads, so it names at most 20.
    [{ extra: { accessConditions: JSON.stringify(groupLockedAccess(Array.from({ length: 21 }, (_, index) => `group-${index}`))) } }, 400, 'context_policy_unsupported'],
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

test('a file locked to some groups reaches the members of any of them and admins, and no one else', async () => {
  const MEMBER = `0x${'3'.repeat(40)}`;
  const HOST = `0x${'4'.repeat(40)}`;
  const groupsOf = { [MEMBER]: 'salon', [HOST]: 'hosts' };
  for (const encryption of ['none', 'worker_envelope']) {
    const h = harness({ encryption });
    h.deps.isWorkerGroupMember = async ({ groupId, requesterAddress }) =>
      groupsOf[String(requesterAddress).toLowerCase()] === groupId
        ? { ok: true, principal: { kind: 'address', address: String(requesterAddress).toLowerCase() } }
        : { ok: false, status: 403, reason: 'worker_group_membership_denied' };
    const id = await idOf(await h.uploadFile({
      address: MEMBER,
      name: 'transcript.txt',
      type: 'text/plain',
      bytes: new TextEncoder().encode('Group words'),
      extra: { accessConditions: JSON.stringify(groupLockedAccess(['Salon', 'Hosts'])) },
    }));
    const [item] = await h.list(MEMBER);
    assert.deepEqual([item.storageRef.id, item.metadata.lockedGroupIds, item.metadata.adminsOnly, item.metadata.addedBy], [id, ['hosts', 'salon'], false, MEMBER]);
    assert.equal(await (await h.read(id, MEMBER)).text(), 'Group words');
    assert.equal(await (await h.read(id, HOST)).text(), 'Group words', 'a member of the other group reads it too');
    assert.deepEqual(await h.list(PARTICIPANT), [], 'someone outside the groups never learns it exists');
    assert.equal((await h.read(id, PARTICIPANT)).status, 403);
    assert.equal((await h.read(id, '')).ok, false, 'nor does a signed-out reader');
    assert.equal((await h.list(ADMIN))[0].storageRef.id, id, 'admins see it, so they can remove it');
    assert.equal(await (await h.read(id, ADMIN)).text(), 'Group words');
  }
});

test('a context listing reaches sources past many library files and reads only context rows', async () => {
  const h = harness();
  const add = async (role, i) => idOf(await h.uploadFile({ name: `${role}-${i}.txt`, type: 'text/plain', bytes: new TextEncoder().encode(role), role }));
  const sources = [];
  for (let i = 0; i < 60; i += 1) sources.push(await add('context', i));
  for (let i = 0; i < 1000; i += 1) await add('library', i);
  for (let i = 60; i < 120; i += 1) sources.push(await add('context', i));
  let reads = 0;
  const get = h.kv.get;
  h.kv.get = async (key) => {
    if (key.includes(':docsContext:')) reads += 1;
    return get(key);
  };
  // As the browser does: at most five pages, each following the last one's cursor.
  const listed = [];
  let cursor = '';
  for (let page = 0; page < 5; page += 1) {
    const query = new URLSearchParams({ resource: 'docsContext', role: 'context', ...(cursor ? { cursor } : {}) });
    const body = await (await h.call(`/storage/list?${query}`, { address: ADMIN })).json();
    assert.ok(body.items.length <= 100, 'a page holds at most its limit');
    listed.push(...body.items.map((item) => item.storageRef.id));
    if (body.listComplete) break;
    cursor = body.cursor;
  }
  assert.deepEqual(listed, sources);
  assert.equal(reads, sources.length, 'library rows are skipped unread');
});

test('whoever added a file may remove it; anyone else’s needs an admin', async () => {
  const OTHER = `0x${'4'.repeat(40)}`;
  const h = harness();
  const text = { name: 'notes.txt', type: 'text/plain', bytes: new TextEncoder().encode('notes') };
  const mine = await idOf(await h.uploadFile({ ...text, address: PARTICIPANT }));
  const theirs = await idOf(await h.uploadFile({ ...text, address: OTHER }));
  const refused = await h.context({ action: 'remove', id: theirs }, PARTICIPANT);
  assert.equal(refused.status, 403);
  assert.equal((await refused.json()).reason, 'context_admin_required');
  assert.equal((await h.context({ action: 'remove', id: mine }, PARTICIPANT)).status, 200);
  assert.equal((await h.context({ action: 'remove', id: theirs }, '')).status, 403, 'signed out');
  assert.deepEqual((await h.list(ADMIN)).map((item) => item.storageRef.id), [theirs]);
  assert.equal((await h.context({ action: 'remove', id: theirs }, ADMIN)).status, 200);
  assert.deepEqual(await h.list(ADMIN), []);
  // The setting stops additions, not cleaning up your own.
  const another = await idOf(await h.uploadFile({ ...text, address: PARTICIPANT }));
  h.state.config.contextAdditionPolicy = 'admin_only';
  assert.equal((await h.context({ action: 'remove', id: another }, PARTICIPANT)).status, 200);
});

test('a row that can’t be read removes nothing for someone who isn’t an admin', async () => {
  const h = harness();
  const text = { name: 'notes.txt', type: 'text/plain', bytes: new TextEncoder().encode('notes') };
  const theirs = await idOf(await h.uploadFile({ ...text, address: ADMIN }));
  // One read fails; the next would succeed, and find the file to remove.
  const { get } = h.kv;
  let failures = 1;
  h.kv.get = async (key) => {
    if (failures-- > 0) throw new Error('KV read failed');
    return get(key);
  };
  const refused = await h.context({ action: 'remove', id: theirs }, PARTICIPANT);
  assert.equal(refused.status, 404);
  assert.deepEqual((await h.list(ADMIN)).map((item) => item.storageRef.id), [theirs]);
});

test('a file publishes only if its uploader may still add it when the upload finishes', async () => {
  const h = harness();
  const publish = h.deps.executeCoordinatedStoragePublication;
  h.deps.executeCoordinatedStoragePublication = (publication) => {
    h.state.config.contextAdditionPolicy = 'admin_only';
    return publish(publication);
  };
  const late = await h.uploadFile({ address: PARTICIPANT, name: 'notes.txt', type: 'text/plain', bytes: new TextEncoder().encode('notes') });
  assert.equal(late.status, 409);
  assert.deepEqual(await h.list(ADMIN), []);
});

test('participants add links while the session takes additions and runs; refresh and AI reading stay with admins', async () => {
  const h = harness({ pages: { 'https://example.org/essay': () => pageResponse('<title>Essay</title><p>Institutions adapt.</p>') } });
  const added = await h.context({ action: 'add-link', url: 'https://example.org/essay' }, PARTICIPANT);
  const source = (await added.clone().json()).source;
  assert.equal(added.status, 200, JSON.stringify(source));
  const [item] = await h.list(PARTICIPANT);
  assert.deepEqual([item.storageRef.id, item.metadata.addedBy, tagOf(item, 'CE-DocKind')], [source.id, PARTICIPANT, 'link']);
  assert.equal(h.pageCalls.length, 1);

  // Refreshing a link and reading a PDF make the Worker work again for an item already there.
  const refresh = await h.context({ action: 'add-link', url: 'https://example.org/essay', replaces: source.id }, PARTICIPANT);
  assert.equal(refresh.status, 403);
  const pdf = await idOf(await h.uploadFile({ address: PARTICIPANT }));
  assert.equal((await h.context({ action: 'read-pdf', id: pdf }, PARTICIPANT)).status, 403);

  // Nor while context is admins-only, or once the session has ended; neither fetches the page.
  h.state.config.contextAdditionPolicy = 'admin_only';
  const adminsOnly = await h.context({ action: 'add-link', url: 'https://example.org/essay' }, PARTICIPANT);
  assert.deepEqual([adminsOnly.status, (await adminsOnly.json()).reason], [403, 'context_admin_required']);
  delete h.state.config.contextAdditionPolicy;
  h.state.config.sessionEndsAt = new Date(Date.now() - 60_000).toISOString();
  const ended = await h.context({ action: 'add-link', url: 'https://example.org/essay' }, PARTICIPANT);
  assert.deepEqual([ended.status, (await ended.json()).code], [410, 'session_ended']);
  assert.equal(h.pageCalls.length, 1, 'refused links fetch nothing');
  assert.equal((await h.context({ action: 'add-link', url: 'https://example.org/essay' })).status, 200, 'admins still add');
  assert.equal((await h.context({ action: 'remove', id: source.id }, PARTICIPANT)).status, 200, 'its adder removes it');
  assert.deepEqual(h.fetchChecks, [PARTICIPANT], "only a participant's link takes their fetch scope");
});

test("a participant's link passes the session's access and their fetch scope before the Worker fetches it", async () => {
  const h = harness({ pages: { 'https://example.org/essay': () => pageResponse('<p>Institutions adapt.</p>') } });
  const link = { action: 'add-link', url: 'https://example.org/essay' };
  const sessionAccess = h.state.config.storageProfile.payloadAccessControl;
  h.state.config.storageProfile.payloadAccessControl = {
    ...sessionAccess, accessConditions: { match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] },
  };
  assert.equal((await h.context(link, PARTICIPANT)).status, 403, 'someone the session keeps from adding files');
  assert.deepEqual(h.fetchChecks, [], 'is refused before their fetch scope counts');
  h.state.config.storageProfile.payloadAccessControl = sessionAccess;

  h.state.scopes = { storage: true };
  const noFetch = await h.context(link, PARTICIPANT);
  assert.deepEqual([noFetch.status, (await noFetch.json()).reason], [403, 'context_link_fetch_denied'], 'a sign-in without the fetch scope');
  h.state.scopes = { storage: true, fetch: true };
  // A failed authorization check, or the daily limit, answers as /fetch does, not as the session's rule.
  for (const [error, status] of [['Current authorization check failed.', 403], ['Rate limit exceeded.', 429]]) {
    h.state.fetchAccess = { ok: false, response: json({ error }, status) };
    const refused = await h.context(link, PARTICIPANT);
    assert.deepEqual([refused.status, await refused.json()], [status, { error }]);
  }
  assert.deepEqual(h.pageCalls, [], 'refused links fetch nothing');
  h.state.scopes = { storage: true };
  assert.equal((await h.context(link)).status, 200, "an admin's link takes no fetch scope");
  assert.deepEqual(h.fetchChecks, [PARTICIPANT, PARTICIPANT]);
});

test("a refresh reads the same link again and stays its adder's, who may still remove it", async () => {
  let version = 0;
  const h = harness({ pages: { 'https://example.org/post': () => pageResponse(`Post text, version ${++version}.`, 'text/plain') } });
  const first = await idOf(await h.context({ action: 'add-link', url: 'https://example.org/post', title: 'Their post' }, PARTICIPANT));
  const elsewhere = await h.context({ action: 'add-link', url: 'https://example.org/other', replaces: first });
  assert.equal(elsewhere.status, 400, 'a refresh names the same link');
  const refreshed = await idOf(await h.context({ action: 'add-link', url: 'https://example.org/post', replaces: first, title: 'Renamed' }));
  const [item] = await h.list(ADMIN);
  assert.deepEqual([item.storageRef.id, item.metadata.addedBy, tagOf(item, 'CE-DocName')], [refreshed, PARTICIPANT, 'Their post']);
  assert.equal(h.pageCalls.length, 2);
  assert.equal((await h.context({ action: 'remove', id: refreshed }, PARTICIPANT)).status, 200);
});

test('only an admin publishing a link the context route stored may record its earlier adder', async () => {
  const h = harness();
  const other = `0x${'3'.repeat(40)}`;
  const publish = (actor, metadata) => publishCloudflareOwnedStorageMetadata({
    env: h.env, config: h.state.config, slug: 'salon', actor,
    metadata: { resource: 'docsContext', contextSource: true, id: 'ctx-recorded-adder', uploader: other, uploadAuthority: 'author', ...metadata },
  });
  const superseded = (error) => error.status === 409;
  await assert.rejects(publish(PARTICIPANT, { contextOrigin: 'worker' }), superseded, 'not for a participant');
  await assert.rejects(publish(ADMIN, {}), superseded, 'not for an upload');
  await publish(ADMIN, { contextOrigin: 'worker' });
  assert.equal(JSON.parse(h.kv.store.get('ce-storage:salon:docsContext:ctx-recorded-adder')).uploader, other);
});

test("an agent's self-declared mark is the one adder mark, with one plain name", async () => {
  const h = harness({ pages: { 'https://example.org/essay': pageResponse('<p>Institutions adapt.</p>') } });
  const note = { address: PARTICIPANT, name: 'note.md', type: 'text/markdown', bytes: new TextEncoder().encode('# Note') };
  await idOf(await h.uploadFile({ ...note, extraTags: agentAdderTags('Test Kami') }));
  await idOf(await h.context({ action: 'add-link', url: 'https://example.org/essay', adder: 'agent', adderName: 'Test Kami' }, PARTICIPANT));
  const items = await h.list(PARTICIPANT);
  assert.deepEqual(items.map((item) => [tagOf(item, 'CE-DocKind'), tagOf(item, 'CE-AdderKind'), tagOf(item, 'CE-AdderName')]),
    [['file', 'agent', 'Test Kami'], ['link', 'agent', 'Test Kami']]);

  const kind = (value) => ({ name: 'CE-AdderKind', value });
  const name = (value) => ({ name: 'CE-AdderName', value });
  for (const extraTags of [
    [kind('human')],
    [name('Test Kami')],
    [kind('agent'), kind('agent')],
    [kind('agent'), name('Test Kami'), name('Other')],
    [kind('agent'), name('K'.repeat(81))],
    [kind('agent'), name('Test\u0007Kami')],
    [kind('agent'), name('Kami\u202Egnp.exe')],
  ]) {
    const response = await h.uploadFile({ ...note, extraTags });
    assert.deepEqual([response.status, (await response.json()).reason], [400, 'context_adder_invalid'], JSON.stringify(extraTags));
  }
  for (const marks of [
    { adder: 'admin' }, { adderName: 'Test Kami' }, { adder: 'agent', adderName: 'K'.repeat(81) },
    { adder: 'agent', adderName: 'Kami\u2066gnp.exe' },
  ]) {
    const response = await h.context({ action: 'add-link', url: 'https://example.org/essay', ...marks }, PARTICIPANT);
    assert.deepEqual([response.status, (await response.json()).reason], [400, 'context_adder_invalid'], JSON.stringify(marks));
  }
  assert.equal(h.pageCalls.length, 1, 'a refused mark fetches nothing');
});

test("a refresh keeps an agent's mark, whatever the refresh says", async () => {
  const h = harness({ pages: { 'https://example.org/essay': () => pageResponse('<p>Institutions adapt.</p>') } });
  const first = await idOf(await h.context({ action: 'add-link', url: 'https://example.org/essay', adder: 'agent', adderName: 'Test Kami' }, PARTICIPANT));
  await idOf(await h.context({ action: 'add-link', url: 'https://example.org/essay', replaces: first, adderName: 'Other' }));
  const [item] = await h.list(ADMIN);
  assert.deepEqual([tagOf(item, 'CE-AdderKind'), tagOf(item, 'CE-AdderName'), item.metadata.addedBy], ['agent', 'Test Kami', PARTICIPANT]);
});

test('a link is fetched by the Worker under the strict policy and stored with its snapshot', async () => {
  const h = harness({
    pages: {
      'https://example.org/essay': pageResponse('<html><head><title>On Reverse Alignment</title></head><body><nav>Menu</nav><p>Institutions adapt.</p></body></html>'),
    },
  });
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

  // Participants' links follow the same strict policy.
  for (const url of ['http://example.org/essay', 'https://127.0.0.1/admin', `https://user:pw${'@'}example.org/`, 'https://intranet/']) {
    for (const address of [ADMIN, PARTICIPANT]) {
      const refused = await h.context({ action: 'add-link', url }, address);
      assert.ok([400, 422].includes(refused.status), `${url} from ${address}: ${refused.status}`);
    }
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
  // Readings are stamped to the millisecond, so each reading here gets its own time.
  h.deps.now = () => Date.parse('2026-11-02T10:00:00.000Z');
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
  h.deps.now = () => Date.parse('2026-11-02T10:01:00.000Z');
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

test('a PDF reading sends the session effort to the models that take one', () => {
  const read = (provider, model, reasoningEffort) => JSON.parse(new TextDecoder().decode(buildPdfReadRequest({
    provider, model, maxTokens: 10, reasoningEffort, bytes: new Uint8Array(3), filename: 'a.pdf',
  }).body));
  assert.deepEqual(read('openai', 'gpt-6.1-terra', 'low').reasoning, { effort: 'low' });
  assert.deepEqual(read('openai', 'gpt-6.1-sol', 'none').reasoning, { effort: 'low' }, 'Sol has no none level');
  assert.deepEqual(read('anthropic', 'claude-sonnet-5-5', 'low').output_config, { effort: 'low' });
  assert.equal('output_config' in read('anthropic', 'claude-haiku-4-5', 'low'), false);
});

test('removing a PDF removes its reading even when the KV list has not caught up, readings first', async () => {
  const h = harness({ provider: async () => json({ content: [{ type: 'text', text: 'Deck text.' }] }) });
  const pdf = await idOf(await h.uploadFile());
  const reading = await idOf(await h.context({ action: 'read-pdf', id: pdf }));
  const readingKey = [...h.kv.store.keys()].find((key) => key.endsWith(`:docsContext:${reading}`));
  h.kv.lagging.add(readingKey);
  const removed = await (await h.context({ action: 'remove', id: pdf })).json();
  assert.deepEqual(removed.removed, [reading, pdf]);
  assert.equal(h.kv.store.has(readingKey), false);
  const indexDeletes = h.kv.deletes.filter((key) => key.includes(':docsContext:'));
  assert.ok(indexDeletes.indexOf(readingKey) < indexDeletes.findIndex((key) => key.endsWith(`:docsContext:${pdf}`)));

  // Without the PDF's pointer, the reading the admin's page shows is named instead.
  const second = await idOf(await h.uploadFile({ name: 'second.pdf' }));
  const secondReading = await idOf(await h.context({ action: 'read-pdf', id: second }));
  const secondKey = [...h.kv.store.keys()].find((key) => key.endsWith(`:docsContext:${second}`));
  const row = JSON.parse(h.kv.store.get(secondKey));
  delete row.contextReadingId;
  h.kv.store.set(secondKey, JSON.stringify(row));
  h.kv.lagging.add([...h.kv.store.keys()].find((key) => key.endsWith(`:docsContext:${secondReading}`)));
  const named = await (await h.context({ action: 'remove', id: second, readingIds: [secondReading, pdf, 'unknown'] })).json();
  assert.deepEqual(named.removed, [secondReading, second]);
  assert.equal([...h.kv.store.keys()].some((key) => key.includes(':docsContext:')), false);
});

test('a PDF removed while its AI reads it leaves no reading behind', async () => {
  let release;
  const h = harness({
    provider: () => new Promise((resolve) => {
      release = () => resolve(json({ content: [{ type: 'text', text: 'Late text.' }] }));
    }),
  });
  const pdf = await idOf(await h.uploadFile());
  const reading = h.context({ action: 'read-pdf', id: pdf });
  while (!release) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal((await h.context({ action: 'remove', id: pdf })).status, 200);
  release();
  const late = await reading;
  assert.equal(late.status, 404);
  assert.match((await late.json()).error, /removed while/);
  assert.deepEqual(await h.list(ADMIN), []);
  assert.equal([...h.r2.store.keys()].length, 0);
});

test('a second read of a PDF already being read is refused, and the first keeps its reading', async () => {
  let release;
  const h = harness({
    provider: () => (release
      ? json({ content: [{ type: 'text', text: 'Second text.' }] })
      : new Promise((resolve) => { release = () => resolve(json({ content: [{ type: 'text', text: 'First text.' }] })); })),
  });
  const pdf = await idOf(await h.uploadFile());
  // Readings are stamped to the millisecond, so each reading here gets its own time.
  h.deps.now = () => Date.parse('2026-11-02T10:00:00.000Z');
  const first = h.context({ action: 'read-pdf', id: pdf });
  while (!release) await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await h.context({ action: 'read-pdf', id: pdf });
  assert.equal(second.status, 409);
  assert.match((await second.json()).error, /already being read/);
  release();
  const reading = await idOf(await first);
  assert.equal(h.providerCalls.length, 1);
  assert.equal(await (await h.read(reading, ADMIN)).text(), 'First text.');
  assert.equal(JSON.parse(await h.kv.get(`ce-storage:salon:docsContext:${pdf}`)).contextReadingId, reading);
  // The finished read frees the PDF, and the next reading replaces this one.
  h.deps.now = () => Date.parse('2026-11-02T10:01:00.000Z');
  const replacement = await idOf(await h.context({ action: 'read-pdf', id: pdf }));
  assert.equal((await h.read(reading, ADMIN)).status, 404);
  assert.equal((await h.read(replacement, ADMIN)).status, 200);
});

test('a PDF removed while its reading is stored stays removed with its bytes', async () => {
  let release;
  const h = harness({
    provider: () => new Promise((resolve) => { release = () => resolve(json({ content: [{ type: 'text', text: 'Late text.' }] })); }),
  });
  const pdf = await idOf(await h.uploadFile());
  const reading = h.context({ action: 'read-pdf', id: pdf });
  while (!release) await new Promise((resolve) => setTimeout(resolve, 5));
  // The removal arrives while the stored reading's cleanup lists the PDF's readings.
  const list = h.kv.list;
  let removing;
  h.kv.list = async (options) => {
    if (!removing) {
      removing = h.context({ action: 'remove', id: pdf });
      await Promise.race([removing, new Promise((resolve) => setTimeout(resolve, 20))]);
    }
    return list(options);
  };
  release();
  assert.equal((await reading).status, 200);
  assert.equal((await removing).status, 200);
  h.kv.list = list;
  assert.equal(await h.kv.get(`ce-storage:salon:docsContext:${pdf}`), null);
  assert.deepEqual(await h.list(ADMIN), []);
  assert.equal(h.r2.store.size, 0);
});

test('a reading never removes a newer reading of the same PDF', async () => {
  const h = harness({ provider: async () => json({ content: [{ type: 'text', text: 'Deck text.' }] }) });
  const pdf = await idOf(await h.uploadFile());
  h.deps.now = () => Date.parse('2026-11-02T10:00:00.000Z');
  const newer = await idOf(await h.context({ action: 'read-pdf', id: pdf }));
  // A reading that started first but is stored after the newer one finished.
  h.deps.now = () => Date.parse('2026-11-02T09:00:00.000Z');
  const stale = await h.context({ action: 'read-pdf', id: pdf });
  assert.equal(stale.status, 409);
  assert.equal((await h.read(newer, ADMIN)).status, 200);
  assert.equal(JSON.parse(await h.kv.get(`ce-storage:salon:docsContext:${pdf}`)).contextReadingId, newer);
  assert.deepEqual((await h.list(ADMIN)).map((item) => item.storageRef.id).sort(), [newer, pdf].sort());
});

test('a reading keeps its PDF’s stored rule after the session’s access changes', async () => {
  const h = harness({ provider: async () => json({ content: [{ type: 'text', text: 'Deck text.' }] }) });
  const pdf = await idOf(await h.uploadFile());
  const pdfRow = JSON.parse([...h.kv.store.entries()].find(([key]) => key.endsWith(`:docsContext:${pdf}`))[1]);
  h.state.config = {
    ...h.state.config,
    storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'role_gate', encryption: 'none', accessConditions: {
      match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }],
    } } },
  };
  const reading = await idOf(await h.context({ action: 'read-pdf', id: pdf }));
  const readingRow = JSON.parse([...h.kv.store.entries()].find(([key]) => key.endsWith(`:docsContext:${reading}`))[1]);
  assert.deepEqual(readingRow.accessConditions, pdfRow.accessConditions);
});

test('unknown actions and a file name holding the body placeholder are handled', async () => {
  const h = harness();
  for (const action of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const response = await h.context({ action });
    assert.equal(response.status, 400, action);
  }
  const { body } = buildPdfReadRequest({
    provider: 'openai', model: 'gpt-4.1', maxTokens: 10, bytes: PDF_BYTES, filename: 'x__CE_PDF_BASE64__y.pdf',
  });
  const parsed = JSON.parse(new TextDecoder().decode(body));
  assert.equal(parsed.input[0].content[0].filename, 'x__CE_PDF_BASE64__y.pdf');
  assert.equal(parsed.input[0].content[0].file_data, `data:application/pdf;base64,${Buffer.from(PDF_BYTES).toString('base64')}`);
});

test('a link that looks like it holds a secret is refused before any fetch', async () => {
  const h = harness();
  for (const address of [ADMIN, PARTICIPANT]) {
    for (const url of ['https://example.org/doc?token=abc123', 'https://example.org/doc#k=abc123']) {
      const response = await h.context({ action: 'add-link', url }, address);
      assert.equal(response.status, 400, url);
      assert.match((await response.json()).error, /secrets never go in context/);
    }
    const title = 'sk-proj-0123456789abcdefghij';
    assert.equal((await h.context({ action: 'add-link', url: 'https://example.org/doc', title }, address)).status, 400);
  }
  assert.deepEqual(h.pageCalls, []);
});
