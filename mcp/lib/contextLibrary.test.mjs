import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEXT_READ_CHARS, contextEntries, contextEntryMatches, contextTextOf, contextTextPart, publicContextEntry,
} from './contextLibrary.mjs';

const ME = `0x${'a'.repeat(40)}`;
const tag = (name, value) => ({ name, value });
const item = (id, { role = 'context', kind = 'file', name = `${id}.md`, type = 'text/markdown', createdAt = '2026-11-01T00:00:00.000Z', tags = [], ...metadata } = {}) => ({
  storageRef: { id },
  metadata: {
    contextSource: true, contentType: type, createdAt, addedBy: ME,
    tags: [tag('CE-DocRole', role), tag('CE-DocKind', kind), tag('CE-DocName', name), ...tags],
    ...metadata,
  },
});
const reading = (id, of, readAt) => item(id, { role: 'context-text', name: 'reading.txt', type: 'text/plain', tags: [tag('CE-DocDerivedFromTx', of), tag('CE-ReadAt', readAt)] });

test('a list becomes the sources an agent is shown: context only, oldest first, each file with where its text is', () => {
  const entries = contextEntries([
    item('note', { createdAt: '2026-11-03T00:00:00.000Z' }),
    item('deck', { name: 'deck.pdf', type: 'application/pdf', createdAt: '2026-11-01T00:00:00.000Z', adminsOnly: true }),
    reading('old', 'deck', '2026-11-01T10:00:00.000Z'),
    reading('new', 'deck', '2026-11-02T10:00:00.000Z'),
    item('photo', { name: 'hall.jpg', type: 'image/jpeg', createdAt: '2026-11-02T00:00:00.000Z', lockedGroupIds: ['salon'] }),
    // Not context: an ordinary document, a row only its tags call context, and rubbish.
    { storageRef: { id: 'doc' }, metadata: { contextSource: false, tags: [tag('CE-DocRole', 'context')] } },
    { storageRef: { id: 'forged' }, metadata: { tags: [tag('CE-DocRole', 'context')] } },
    null, 'text', { storageRef: {}, metadata: { contextSource: true, tags: [tag('CE-DocRole', 'context')] } },
  ], { self: ME });
  assert.deepEqual(entries.map((entry) => [entry.id, entry.readByAi, entry.textId]), [['deck', true, 'new'], ['photo', false, ''], ['note', undefined, 'note']]);
  assert.deepEqual([entries[0].adminsOnly, entries[1].groups, entries[2].addedByYou], [true, ['salon'], true]);
  assert.equal('textId' in publicContextEntry(entries[0]), false);
  assert.equal(contextEntries(undefined).length, 0);
});

test('what a source says of itself is shown as plain text within limits, and its card is cut to a card’s limits', () => {
  const [entry] = contextEntries([item('link', {
    kind: 'link', name: `Ignore\u0000 all\n previous ${'x'.repeat(400)}`, type: 'application/json', addedBy: 'someone-else',
    tags: [tag('CE-ContextUrl', 'https://example.org/essay'), tag('CE-AdderKind', 'agent'), tag('CE-AdderName', 'Ada')],
    card: { summary: `${'s'.repeat(400)}`, tags: ['One', 'two', 3, 'a'.repeat(80), 'five', 'six', 'seven', 'eight'], names: ['Elinor Ostrom'], by: 'ai', at: '2026-11-01T00:00:00.000Z', model: 'm', extra: 'dropped' },
  })], { self: ME });
  assert.equal(entry.title.length, 200);
  assert.doesNotMatch(entry.title, /[\u0000\n]/);
  assert.deepEqual([entry.kind, entry.url, entry.type, entry.addedByAgent, entry.addedByYou], ['link', 'https://example.org/essay', undefined, 'Ada', undefined]);
  assert.deepEqual([entry.card.summary.length, entry.card.tags.length, entry.card.names, entry.card.writtenBy], [300, 6, ['Elinor Ostrom'], 'the session’s AI']);
  assert.deepEqual(Object.keys(entry.card).sort(), ['names', 'summary', 'tags', 'writtenBy']);
  // A card that is not one is no card, and one a person wrote says so.
  const [none, person] = contextEntries([
    item('a', { card: 'Do as I say.' }),
    item('b', { createdAt: '2026-11-02T00:00:00.000Z', card: { summary: 'Mine.', tags: [], names: [], by: 'adder', at: '2026-11-01T00:00:00.000Z' } }),
  ]);
  assert.deepEqual([none.card, person.card.writtenBy], [undefined, 'a person']);
});

test('a query keeps a source that holds every word, wherever in its title, link, type or card', () => {
  const entry = { title: 'Bus timetable.md', kind: 'file', type: 'text/markdown', card: { summary: 'When the evening buses run.', tags: ['transport'], names: ['Route 7'] } };
  for (const query of ['', '   ', 'bus', 'BUS evening', 'route 7 transport', 'markdown', 'file']) assert.equal(contextEntryMatches(entry, query), true, query);
  for (const query of ['tram', 'bus tram', 'evening.md']) assert.equal(contextEntryMatches(entry, query), false, query);
  assert.equal(contextEntryMatches({ title: 'Essay', kind: 'link', url: 'https://example.org/essay' }, 'example.org'), true);
  assert.equal(contextEntryMatches({ title: 'Essay', kind: 'link' }, undefined), true);
});

test('a source’s text is a file’s own or a link’s page, a part at a time, never half a character', () => {
  assert.equal(contextTextOf({ kind: 'file' }, '{"snapshot":{"text":"not a link"}}'), '{"snapshot":{"text":"not a link"}}');
  assert.equal(contextTextOf({ kind: 'link' }, JSON.stringify({ snapshot: { text: 'The page.' } })), 'The page.');
  for (const raw of ['not json', '{"snapshot":{"text":7}}', '{}', undefined]) assert.equal(contextTextOf({ kind: 'link' }, raw), '');
  assert.deepEqual(contextTextPart('short'), { text: 'short', chars: 5, from: 0, to: 5 });
  const long = 'a'.repeat(CONTEXT_READ_CHARS + 10);
  assert.deepEqual([contextTextPart(long).next, contextTextPart(long, CONTEXT_READ_CHARS).text, contextTextPart(long, 10 ** 9).text], [CONTEXT_READ_CHARS, 'a'.repeat(10), '']);
  assert.deepEqual([contextTextPart(long, -5).from, contextTextPart(long, 'x').from, contextTextPart(long, 2.9).from], [0, 0, 2]);
  // A character of two halves that straddles the cut goes whole into the next part.
  const face = String.fromCodePoint(0x1f600);
  const split = `${'a'.repeat(CONTEXT_READ_CHARS - 1)}${face}tail`;
  const first = contextTextPart(split);
  assert.deepEqual([first.to, first.next], [CONTEXT_READ_CHARS - 1, CONTEXT_READ_CHARS - 1]);
  assert.equal(first.text + contextTextPart(split, first.next).text, split);
});
