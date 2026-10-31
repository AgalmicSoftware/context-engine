import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_CONTEXT_LIMITS as L,
  hasSessionContext,
  normalizeSessionContext,
  sessionContextPlainText,
  validateSessionContext,
} from '../../shared/sessionContext.mjs';

const link = (index) => ({ label: `Link ${index}`, url: `https://example.org/${index}` });

test('readers clamp stored context to the shared limits and drop what writers refuse', () => {
  const context = normalizeSessionContext({
    title: `  ${'T'.repeat(L.titleChars + 5)} `,
    paragraphs: ['  first  ', '', 7, 'x'.repeat(L.paragraphChars + 10), ...Array(L.paragraphs).fill('more')],
    links: [
      { label: ' Essay ', url: ' https://example.org/essay ' },
      { label: 'Plain', url: 'http://example.org/plain' },
      { label: 'Broken', url: 'not a url' },
      { url: 'https://example.org/no-label' },
      'https://example.org/not-an-object',
      ...Array.from({ length: L.links }, (_, index) => link(index)),
    ],
  });
  assert.equal(context.title.length, L.titleChars);
  assert.equal(context.paragraphs.length, L.paragraphs);
  assert.equal(context.paragraphs[0], 'first');
  assert.equal(context.paragraphs[1].length, L.paragraphChars);
  assert.equal(context.links.length, L.links);
  assert.deepEqual(context.links.slice(0, 2), [
    { label: 'Essay', url: 'https://example.org/essay' },
    { label: 'https://example.org/no-label', url: 'https://example.org/no-label' },
  ]);
});

test('readers accept the early single-body form and anything else as empty', () => {
  assert.deepEqual(normalizeSessionContext({ body: ' Background ' }).paragraphs, ['Background']);
  assert.deepEqual(normalizeSessionContext('text'), { title: '', paragraphs: [], links: [] });
  assert.equal(hasSessionContext(null), false);
  assert.equal(hasSessionContext({ title: 'Only a title' }), false);
  assert.equal(hasSessionContext({ links: [link(1)] }), true);
});

test('writers get the stored form: trimmed text without blank entries', () => {
  const result = validateSessionContext({
    title: ' Context ',
    paragraphs: [' One ', '   '],
    links: [
      { label: ' Essay ', url: ' https://example.org/essay ' },
      { label: '', url: '' },
      { label: 'Label without a link' },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    title: 'Context',
    paragraphs: ['One'],
    links: [{ label: 'Essay', url: 'https://example.org/essay' }],
  });
  assert.deepEqual(validateSessionContext(null), { ok: true, value: null, errors: [] });
  assert.deepEqual(validateSessionContext({}).value, { title: '', paragraphs: [], links: [] });
});

test('writers refuse wrong shapes, unknown fields and text over a limit', () => {
  const messages = (value) => {
    const result = validateSessionContext(value);
    assert.equal(result.ok, false);
    return result.errors.map((error) => `${error.path}: ${error.message}`);
  };
  assert.match(messages('notes')[0], /must be an object/);
  assert.match(messages({ body: 'x' })[0], /unknown field: body/);
  assert.match(messages({ title: 'x'.repeat(L.titleChars + 1) })[0], /title is longer than 80/);
  assert.match(messages({ paragraphs: 'one' })[0], /Paragraphs must be a list/);
  assert.match(messages({ paragraphs: [{}] })[0], /Paragraph 1 must be text/);
  assert.match(messages({ paragraphs: ['x'.repeat(L.paragraphChars + 1)] })[0], /longer than 2,000 characters/);
  assert.match(messages({ paragraphs: Array(L.paragraphs + 1).fill('p') })[0], /at most 6 paragraphs/);
  assert.match(messages({ links: [{ label: 'Plain', url: 'http://example.org' }] })[0], /must be an https:\/\/ link/);
  assert.match(messages({ links: [{ url: 'https://example.org', note: 'x' }] })[0], /unknown field: note/);
  assert.match(messages({ links: [{ label: 'x'.repeat(L.labelChars + 1), url: 'https://example.org' }] })[0], /label is longer/);
  assert.match(messages({ links: [{ url: `https://example.org/${'a'.repeat(L.urlChars)}` }] })[0], /longer than 2,000/);
  assert.match(messages({ links: Array.from({ length: L.links + 1 }, (_, index) => link(index)) })[0], /at most 8 links/);
});

test('plain text joins the title, paragraphs and link labels, never an object', () => {
  const text = sessionContextPlainText({ title: 'Reverse alignment', paragraphs: ['Democracy and AI'], links: [link(1)] });
  assert.equal(text, 'Reverse alignment Democracy and AI Link 1');
  assert.equal(sessionContextPlainText(' already text '), 'already text');
  assert.equal(sessionContextPlainText({ unexpected: true }), '');
});

test('writers refuse context that looks like a key, token or password', () => {
  for (const [value, path] of [
    [{ paragraphs: ['Use sk-live-0123456789abcdefghij for the demo.'] }, 'sessionContext.paragraphs.0'],
    [{ title: 'Bearer abcdefghijklmnopqrstuvwxyz' }, 'sessionContext.title'],
    [{ links: [{ label: 'Doc', url: 'https://example.org/doc?api_key=abc123' }] }, 'sessionContext.links.0'],
    // `${'@'}` keeps the public email scrub from rewriting this credential link.
    [{ links: [{ label: 'Doc', url: `https://user:pass${'@'}example.org/doc` }] }, 'sessionContext.links.0'],
  ]) {
    const result = validateSessionContext(value);
    assert.equal(result.ok, false, JSON.stringify(value));
    assert.ok(result.errors.some((error) => error.path === path && /secrets never go in context/.test(error.message)), JSON.stringify(result.errors));
  }
  assert.equal(validateSessionContext({ links: [{ label: 'Doc', url: 'https://example.org/doc?page=2' }] }).ok, true);
});
