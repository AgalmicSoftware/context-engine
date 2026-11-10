import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_CONTEXT_LIMITS as L,
  hasSessionContext,
  htmlToPlainText,
  normalizeSessionContext,
  sessionContextHtmlText,
  sessionContextPlainText,
  validateSessionContext,
} from '../../shared/sessionContext.mjs';
import { looksSecret } from '../../shared/secretText.mjs';

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

const TX = `0x${'5c'.repeat(32)}`;

test('page names and IDs in a link path are not mistaken for tokens', () => {
  for (const url of [
    'https://en.wikipedia.org/wiki/2024_United_States_presidential_election',
    'https://www.notion.so/Reading-0b5d7c2e9a314f6c8e1d2a3b4c5d6e7f',
    `https://etherscan.io/tx/${TX}`,
  ]) {
    assert.equal(looksSecret(url), false, url);
    assert.equal(validateSessionContext({ links: [{ label: 'Read', url }] }).ok, true, url);
  }
  // The same 40-character run outside a link's path still looks like a token.
  assert.equal(looksSecret('Use 2024_United_States_presidential_election to sign in.'), true);
  assert.equal(looksSecret('https://docs.example.org/view?id=2024_United_States_presidential_election'), true);
});

test('64 hex digits outside a link are refused, pointing a transaction to an explorer link', () => {
  const result = validateSessionContext({ paragraphs: [`The vote passed in transaction ${TX}.`] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((error) => error.path), ['sessionContext.paragraphs.0']);
  assert.match(result.errors[0].message, /^Paragraph 1 has 64 hex digits, the shape of a private key\./);
  assert.match(result.errors[0].message, /To cite a transaction, link to it in a block explorer/);
  assert.match(validateSessionContext({ links: [{ label: TX.slice(2), url: 'https://example.org/' }] }).errors[0].message, /block explorer/);
});

test('bot tokens, keyed RPC links, and Stripe and Hugging Face keys look like secrets', () => {
  // Generate synthetic inputs so the repository contains no full provider-token literals.
  for (const text of [
    `${'1'.repeat(9)}:${'a'.repeat(35)}`,
    `https://eth-mainnet.g.alchemy.com/v2/${'fixture'.repeat(6)}`,
    `https://opt-sepolia.g.alchemy.com/v2/${'fixture'.repeat(6)}`,
    `https://mainnet.infura.io/v3/${'a'.repeat(32)}`,
    ['sk', 'live', 'fixture'.repeat(4)].join('_'),
    ['rk', 'test', 'fixture'.repeat(4)].join('_'),
    ['hf', 'fixture'.repeat(6)].join('_'),
  ]) {
    assert.equal(looksSecret(text), true, text);
    assert.equal(looksSecret(`Our notes: ${text} (shared by mistake)`), true, text);
  }
  for (const text of [
    'Meet at 10:30 on 2026-11-20.',
    'https://docs.alchemy.com/reference/api-overview',
    'https://infura.io/pricing',
    'hf_model_card and sk_live_demo are just words.',
  ]) {
    assert.equal(looksSecret(text), false, text);
  }
});

test('context is typed text or HTML: HTML keeps the title and replaces paragraphs and links', () => {
  const html = ' <h2>Topics</h2><p>One</p> ';
  const stored = { title: 'T', html: '<h2>Topics</h2><p>One</p>', paragraphs: [], links: [] };
  assert.deepEqual(validateSessionContext({ title: 'T', html, paragraphs: ['  '], links: [{ label: 'x', url: '' }] }).value, stored);
  assert.deepEqual(normalizeSessionContext({ title: 'T', html }), stored);
  // A fresh draft carries an empty html; neither form keeps it.
  const blank = { title: '', paragraphs: [], links: [], html: '  ' };
  assert.deepEqual(validateSessionContext(blank).value, { title: '', paragraphs: [], links: [] });
  assert.deepEqual(normalizeSessionContext(blank), { title: '', paragraphs: [], links: [] });
  assert.equal(hasSessionContext({ html: '<p>Only this</p>' }), true);
  assert.equal(hasSessionContext({ title: 'Heading', html: ' ' }), false);
  // A reader shows stored HTML in place of any paragraphs and links stored beside it.
  assert.deepEqual(normalizeSessionContext({ html: '<p>Page</p>', paragraphs: ['Old'], links: [link(1)] }), {
    title: '',
    html: '<p>Page</p>',
    paragraphs: [],
    links: [],
  });
});

test('writers refuse text and HTML together, HTML that is not text, and HTML over its limit', () => {
  const pathsOf = (context) => validateSessionContext(context).errors.map((error) => error.path);
  assert.deepEqual(pathsOf({ html: '<p>Page</p>', paragraphs: ['Typed'] }), ['sessionContext.html']);
  assert.deepEqual(pathsOf({ html: '<p>Page</p>', links: [link(1)] }), ['sessionContext.html']);
  assert.deepEqual(pathsOf({ html: { body: '<p>x</p>' } }), ['sessionContext.html']);
  assert.deepEqual(pathsOf({ html: 'x'.repeat(L.htmlChars + 1) }), ['sessionContext.html']);
  assert.equal(validateSessionContext({ html: 'x'.repeat(L.htmlChars) }).ok, true);
  // Readers clamp stored HTML instead of dropping it.
  assert.equal(normalizeSessionContext({ html: 'y'.repeat(L.htmlChars + 9) }).html.length, L.htmlChars);
});

test('writers refuse HTML that looks like a key, in its words or inside an attribute', () => {
  const token = `https://mainnet.infura.io/v3/${'a'.repeat(32)}`;
  for (const html of [`<a href="${token}">RPC</a>`, `<p>Our node: ${token}</p>`]) {
    const result = validateSessionContext({ html });
    assert.equal(result.ok, false, html);
    assert.equal(result.errors[0].path, 'sessionContext.html');
  }
  // A key spelled with character references is still caught in the words the AI reads.
  const hex = `0x${'ab'.repeat(32)}`;
  const spelled = [...hex].map((char) => `&#${char.charCodeAt(0)};`).join('');
  assert.equal(validateSessionContext({ html: `<p>${spelled}</p>` }).ok, false);
});

test("HTML's words reach plain text, without its tags, scripts or styles", () => {
  const html =
    '<h2>Branch &amp; topics</h2><details><summary>First</summary><p>Line one<br>line &#x27;two&#39;</p></details>' +
    '<script>alert("no")</script><style>p{color:red}</style><!-- hidden --><ul><li>A</li><li>B&nbsp;C</li></ul>';
  assert.equal(htmlToPlainText(html), "Branch & topics\nFirst\nLine one\nline 'two'\nA\nB C");
  assert.equal(sessionContextHtmlText({ html }).includes('alert'), false);
  assert.equal(sessionContextHtmlText({ paragraphs: ['Typed'] }), '');
  assert.equal(sessionContextPlainText({ title: 'T', html: '<p>One</p><p>Two</p>' }), 'T One Two');
});
