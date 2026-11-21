import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_LINK_READING_SETTINGS, claimSessionLinkReads, resolveSessionLinkReading, settleSessionLinkRead, validateSessionLinkReading,
} from '../../shared/sessionLinkReading.mjs';
import { applySessionConfigMutation } from './sessionConfigMutation.js';
import { readSessionLinks } from './sessionLinkReading.js';
import { ADMIN, PARTICIPANT, harness, idOf, pageResponse } from './contextSourceTestFixture.mjs';

const ESSAY = 'https://essays.example/commons';
const BRIEF = 'https://briefs.example/water';
// A function, so each fetch gets a fresh response.
const page = (words) => () => pageResponse(`<html><head><title>${words}</title></head><body><p>${words}, in full.</p></body></html>`);

// The session's own context, as an admin saved it, with its links.
const withLinks = (h, links, extra = {}) => {
  h.state.config = {
    ...h.state.config, sessionId: 'session-one', ...extra,
    sessionContext: { title: 'Background', paragraphs: ['Read these first.'], links },
  };
  return h.state.config;
};
const read = (h, config = h.state.config) => readSessionLinks({ env: h.env, config, slug: 'salon', deps: h.deps });
const tag = (item, name) => item.metadata.tags.find((entry) => entry.name === name)?.value;
const links = (items) => items.filter((item) => tag(item, 'CE-DocKind') === 'link')
  .map((item) => ({ id: item.storageRef.id, url: tag(item, 'CE-ContextUrl'), title: tag(item, 'CE-DocName'), ...item.metadata }));
const recordOf = async (h, id) => (await h.read(id, ADMIN)).json();

test('reads each saved link once, as the admins’ item for everyone, after the reply', async () => {
  const h = harness({ pages: { [ESSAY]: page('Commons essay'), [BRIEF]: page('Water brief') } });
  withLinks(h, [{ label: 'The essay', url: ESSAY }, { label: '', url: BRIEF }]);
  const work = read(h);
  // The work is handed to the runtime, so the caller's reply never waits on it.
  assert.equal((await Promise.race([work.then(() => 'done'), Promise.resolve('not yet')])), 'not yet');
  const { read: done } = await work;
  await h.settled();
  assert.deepEqual(done.map((entry) => [entry.url, entry.ok]), [[ESSAY, true], [BRIEF, true]]);
  assert.deepEqual(h.pageCalls, [ESSAY, BRIEF]);
  // A participant sees both, as they see a link an admin adds by hand: open to everyone the session admits.
  const seen = links(await h.list(PARTICIPANT));
  assert.deepEqual(seen.map((item) => [item.url, item.title, item.adminsOnly === true]).sort(),
    [[BRIEF, BRIEF, false], [ESSAY, 'The essay', false]]);
  const rows = [...h.kv.store.values()].map((value) => { try { return JSON.parse(value); } catch { return null; } })
    .filter((row) => row?.contextSource === true);
  assert.deepEqual(rows.map((row) => [row.uploader, row.uploadAuthority, row.contextOrigin]), Array(2).fill([ADMIN, 'admin', 'worker']));
  // Read again: nothing is fetched twice.
  assert.deepEqual((await read(h)).read, []);
  assert.deepEqual(h.pageCalls, [ESSAY, BRIEF]);
});

test('takes only the links saved in the session’s context, never a participant’s link or an address in a file', async () => {
  const h = harness({ pages: { [BRIEF]: page('Water brief') } });
  // A participant adds a link and a file naming another address; neither is a saved link.
  assert.equal((await h.context({ action: 'add-link', url: BRIEF }, PARTICIPANT)).status, 200);
  await idOf(await h.uploadFile({ address: PARTICIPANT, name: 'notes.txt', type: 'text/plain', bytes: new TextEncoder().encode(`See ${ESSAY}`) }));
  h.pageCalls.length = 0;
  withLinks(h, []);
  assert.deepEqual((await read(h)).read, []);
  // The participant's copy of an address an admin then saves is no admin's: the saved link is read for everyone.
  withLinks(h, [{ label: 'Brief', url: BRIEF }]);
  assert.deepEqual((await read(h)).read.map((entry) => [entry.url, entry.ok, entry.held]), [[BRIEF, true, undefined]]);
  assert.deepEqual(h.pageCalls, [BRIEF]);
  // Links in HTML context are the page's own text, not saved links.
  const html = harness({ pages: {} });
  html.state.config = { ...html.state.config, sessionContext: { title: 'Background', html: `<p><a href="${ESSAY}">essay</a></p>` } };
  assert.deepEqual((await read(html)).read, []);
  assert.deepEqual(html.pageCalls, []);
});

test('a link an admin added by hand for everyone is already read', async () => {
  const h = harness({ pages: { [ESSAY]: page('Commons essay') } });
  assert.equal((await h.context({ action: 'add-link', url: ESSAY })).status, 200);
  withLinks(h, [{ label: 'The essay', url: ESSAY }]);
  assert.deepEqual((await read(h)).read, [{ url: ESSAY, ok: true, held: true }]);
  assert.deepEqual(h.pageCalls, [ESSAY]);
  // An admins-only copy is not: the saved link is everyone's.
  const locked = harness({ pages: { [ESSAY]: page('Commons essay') } });
  assert.equal((await locked.context({ action: 'add-link', url: ESSAY, adminsOnly: true })).status, 200);
  withLinks(locked, [{ label: 'The essay', url: ESSAY }]);
  assert.deepEqual((await read(locked)).read.map((entry) => [entry.ok, entry.held]), [[true, undefined]]);
});

test('a source an admin removes stays removed while its link stays saved; a link saved again is read again', async () => {
  const h = harness({ pages: { [ESSAY]: page('Commons essay') } });
  withLinks(h, [{ label: 'The essay', url: ESSAY }]);
  await read(h);
  const [source] = links(await h.list(ADMIN));
  assert.equal((await h.context({ action: 'remove', id: source.id })).status, 200);
  assert.deepEqual((await read(h)).read, []);
  // Taken out of the context by a save, and saved again: read afresh.
  withLinks(h, []);
  await readSessionLinks({ env: h.env, config: h.state.config, slug: 'salon', deps: h.deps, afterSave: true });
  withLinks(h, [{ label: 'The essay', url: ESSAY }]);
  assert.deepEqual((await read(h)).read.map((entry) => entry.ok), [true]);
  assert.deepEqual(h.pageCalls, [ESSAY, ESSAY]);
});

test('a link that fails is recorded and not tried again until its retry wait', async (t) => {
  let up = false;
  const h = harness({ pages: { [ESSAY]: () => (up ? page('Commons essay')() : new Response('down', { status: 503 })) } });
  withLinks(h, [{ label: 'The essay', url: ESSAY }], { sessionLinkReading: { retryMinutes: 10 } });
  let nowMs = Date.parse('2026-11-21T10:00:00Z');
  t.mock.method(Date, 'now', () => nowMs);
  const [failed] = (await read(h)).read;
  assert.equal(failed.ok, false);
  assert.match(failed.error, /could not be read/);
  assert.deepEqual(links(await h.list(ADMIN)), []);
  up = true;
  nowMs += 9 * 60_000;
  assert.deepEqual((await read(h)).read, []);
  assert.equal(h.pageCalls.length, 1);
  nowMs += 60_000;
  assert.deepEqual((await read(h)).read.map((entry) => entry.ok), [true]);
  assert.equal(h.pageCalls.length, 2);
});

test('two reads at once fetch a link once', async () => {
  const h = harness({ pages: { [ESSAY]: page('Commons essay') } });
  withLinks(h, [{ label: 'The essay', url: ESSAY }]);
  const [first, second] = await Promise.all([read(h), read(h)]);
  assert.deepEqual([...first.read, ...second.read].map((entry) => entry.ok), [true]);
  assert.deepEqual(h.pageCalls, [ESSAY]);
  assert.equal(links(await h.list(ADMIN)).length, 1);
});

test('a redirect from a saved link is held to the same link policy', async () => {
  const PRIVATE = 'https://127.0.0.1/admin';
  const h = harness({
    pages: {
      [ESSAY]: new Response(null, { status: 302, headers: { location: PRIVATE } }),
      [BRIEF]: new Response(null, { status: 302, headers: { location: 'http://briefs.example/plain' } }),
    },
  });
  withLinks(h, [{ label: 'The essay', url: ESSAY }, { label: 'Brief', url: BRIEF }]);
  const { read: done } = await read(h);
  assert.deepEqual(done.map((entry) => entry.ok), [false, false]);
  // Neither the private address nor the plain-http page is ever asked for.
  assert.deepEqual(h.pageCalls, [ESSAY, BRIEF]);
  assert.deepEqual(links(await h.list(ADMIN)), []);
});

test('settings: off or 0 reads nothing, `links` takes the first ones, `pageChars` cuts each page', async () => {
  const pages = { [ESSAY]: pageResponse(`<p>${'word '.repeat(2000)}</p>`), [BRIEF]: page('Water brief') };
  const saved = [{ label: 'The essay', url: ESSAY }, { label: 'Brief', url: BRIEF }];
  for (const setting of [{ on: false }, { links: 0 }]) {
    const h = harness({ pages });
    withLinks(h, saved, { sessionLinkReading: setting });
    assert.deepEqual((await read(h)).read, []);
    assert.deepEqual(h.pageCalls, []);
  }
  const h = harness({ pages });
  withLinks(h, saved, { sessionLinkReading: { links: 1, pageChars: 1000 } });
  assert.deepEqual((await read(h)).read.map((entry) => entry.url), [ESSAY]);
  const [source] = links(await h.list(ADMIN));
  const { snapshot } = await recordOf(h, source.id);
  assert.deepEqual([snapshot.text.length, snapshot.truncated], [1000, true]);
});

test('reads nothing for a session that has ended, is Lit-encrypted, or has no admin', async () => {
  const pages = { [ESSAY]: page('Commons essay') };
  const saved = [{ label: 'The essay', url: ESSAY }];
  const cases = [
    { sessionEndsAt: '2026-01-01T00:00:00Z' },
    { adminAddress: undefined },
  ];
  for (const extra of cases) {
    const h = harness({ pages });
    withLinks(h, saved, extra);
    assert.deepEqual((await read(h)).read, []);
    assert.deepEqual(h.pageCalls, []);
  }
  const lit = harness({ pages, encryption: 'lit_encrypted' });
  withLinks(lit, saved);
  assert.deepEqual((await read(lit)).read, []);
  assert.deepEqual(lit.pageCalls, []);
});

test('with cards on, each page read gets its card, as a hand-added link does', async () => {
  const card = { summary: 'An essay on commons.', tags: ['commons'], names: [] };
  const h = harness({
    cards: true,
    pages: { [ESSAY]: page('Commons essay') },
    provider: async () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(card) }] }), { status: 200 }),
  });
  withLinks(h, [{ label: 'The essay', url: ESSAY }]);
  await read(h);
  await h.settled();
  const [source] = links(await h.list(ADMIN));
  assert.equal(source.card?.summary, card.summary);
  assert.equal(h.providerCalls.length, 1);
});

test('the setting is validated and bounded on save, and changing it signs no one out', () => {
  assert.deepEqual(resolveSessionLinkReading({}), { on: true, links: 8, fetchSeconds: 10, pageChars: 100_000, retryMinutes: 60 });
  assert.deepEqual(validateSessionLinkReading({ on: false, links: 2 }), { ok: true, value: { on: false, links: 2 } });
  for (const [value, error] of [
    [[], 'sessionLinkReading must be an object.'],
    [{ depth: 1 }, 'sessionLinkReading has no setting depth.'],
    [{ on: 'yes' }, 'sessionLinkReading.on must be true or false.'],
    [{ links: 9 }, 'sessionLinkReading.links must be a whole number from 0 to 8.'],
    [{ fetchSeconds: 21 }, 'sessionLinkReading.fetchSeconds must be a whole number from 3 to 20.'],
    [{ pageChars: 999 }, 'sessionLinkReading.pageChars must be a whole number from 1000 to 100000.'],
    [{ retryMinutes: 1.5 }, 'sessionLinkReading.retryMinutes must be a whole number from 10 to 1440.'],
  ]) assert.deepEqual(validateSessionLinkReading(value), { ok: false, error });
  // A value out of bounds that is somehow stored is read as its default.
  assert.equal(resolveSessionLinkReading({ sessionLinkReading: { fetchSeconds: 99 } }).fetchSeconds,
    SESSION_LINK_READING_SETTINGS.fetchSeconds.default);
  const existingConfig = applySessionConfigMutation({
    existingConfig: {}, slug: 'salon', mutation: { kind: 'set-config', incomingConfig: { sessionName: 'Salon' } },
  }).config;
  const saved = applySessionConfigMutation({
    existingConfig, slug: 'salon', mutation: { kind: 'set-config', incomingConfig: { sessionLinkReading: { links: 3 } } },
  });
  assert.equal(saved.ok, true, saved.error);
  assert.deepEqual(saved.config.sessionLinkReading, { links: 3 });
  assert.equal(saved.config.authzEpoch, existingConfig.authzEpoch);
  const refused = applySessionConfigMutation({
    existingConfig, slug: 'salon', mutation: { kind: 'set-config', incomingConfig: { sessionLinkReading: { links: 99 } } },
  });
  assert.deepEqual([refused.ok, refused.error], [false, 'sessionLinkReading.links must be a whole number from 0 to 8.']);
  const cleared = applySessionConfigMutation({
    existingConfig: saved.config, slug: 'salon', mutation: { kind: 'set-config', incomingConfig: { sessionLinkReading: null } },
  });
  assert.equal(Object.hasOwn(cleared.config, 'sessionLinkReading'), false);
});

test('the coordinator’s record: claims, retry waits, forgetting, and a reset session', () => {
  const urls = [ESSAY, BRIEF];
  const first = claimSessionLinkReads({ state: undefined, sessionId: 's1', urls, retryMs: 600_000, nowMs: 1000 });
  assert.deepEqual(first.due, urls);
  // Claimed and still unsettled: not claimed again until the wait has passed.
  assert.deepEqual(claimSessionLinkReads({ state: first.state, sessionId: 's1', urls, retryMs: 600_000, nowMs: 2000 }).due, []);
  let state = settleSessionLinkRead({ state: first.state, sessionId: 's1', url: ESSAY, ok: true, nowMs: 3000 });
  state = settleSessionLinkRead({ state, sessionId: 's1', url: BRIEF, ok: false, error: 'down', nowMs: 3000 });
  assert.deepEqual(state.links[BRIEF], { at: 3000, ok: false, error: 'down' });
  assert.deepEqual(claimSessionLinkReads({ state, sessionId: 's1', urls, retryMs: 600_000, nowMs: 603_000 }).due, [BRIEF]);
  // A link taken out is forgotten; a reset session starts afresh.
  assert.deepEqual(Object.keys(claimSessionLinkReads({ state, sessionId: 's1', urls: [BRIEF], retryMs: 600_000, nowMs: 4000 }).state.links), [BRIEF]);
  assert.deepEqual(claimSessionLinkReads({ state, sessionId: 's2', urls, retryMs: 600_000, nowMs: 4000 }).due, urls);
  // A read that ends after its link was forgotten records nothing.
  assert.deepEqual(settleSessionLinkRead({ state: { sessionId: 's1', links: {} }, sessionId: 's1', url: ESSAY, ok: true, nowMs: 5000 }),
    { sessionId: 's1', links: {} });
});
