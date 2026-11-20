import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ANALYSIS_CARD_DRAWING_PATH,
  ANALYSIS_CARD_DRAWING_SAVE_PATH,
  ANALYSIS_CARD_DRAWINGS_PER_DAY,
  ANALYSIS_CARD_PUBLISH_PATH,
  ANALYSIS_CARD_PUBLISHED_PATH,
  ANALYSIS_CARD_SAVED_PATHS,
  ANALYSIS_CARD_SAVES_PER_DAY,
  dispatchAnalysisCardSavedRoute,
} from './analysisCardSavedRoute.js';
import { evaluateAuthenticatedRoutePreflight } from './authenticatedRoutePreflight.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';
import { json } from './responseKvHelpers.js';
import { applySessionConfigMutation } from './sessionConfigMutation.js';
import { FEATURES } from './workerCapabilities.js';
import { projectPublicWorkerSessionConfig, selectDeployWorkerSessionConfigFields } from '../shared/workerSessionConfig.mjs';
import {
  ANALYSIS_CARD_DRAWING_FEATURE, ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES, analysisCardAnswersArePrivate, analysisCardOn,
  normalizeAnalysisCardDrawing,
} from '../../shared/analysisCardSaved.mjs';
import { classifySessionConfigEdits } from '../../shared/sessionConfigEdits.mjs';

const OWNER = `0x${'a1'.repeat(20)}`;
const VISITOR = `0x${'b2'.repeat(20)}`;
const ADMIN = `0x${'c3'.repeat(20)}`;
const NOW = Date.parse('2026-11-18T12:00:00Z');
const CARD = {
  title: 'A patient builder of shared rules',
  matchNote: 'Both trust people closest to a problem to govern it.',
  figure: 'Elinor Ostrom (1933–2012)',
  tastes: { book: { title: 'Governing the Commons', by: 'Elinor Ostrom' }, game: null, film: null, song: null },
  answers: {
    yesNo: { prompt: 'Should towns run their own water?', text: 'Agree' },
    ownWords: { prompt: 'What makes a rule fair?', text: 'People who live with it get a say.', stance: '', trimmed: false },
    vote: null,
  },
};

// A session with the card on, as one made on /new is. Its answers are public, as a new session's are, so every
// signed-in visitor may read a saved card.
const PUBLIC_SESSION = JSON.parse(
  readFileSync(new URL('../../tests/fixtures/worker-compat/previous-minor.json', import.meta.url), 'utf8'),
).config;
const ON = { ...PUBLIC_SESSION, adminAddress: ADMIN, analysisCardEnabled: true };
// The same session with its results shown another way.
const showing = (visibility) => ({
  ...ON,
  sessionModeProfile: { ...ON.sessionModeProfile, results: { ...ON.sessionModeProfile.results, visibility } },
});

const createKv = () => {
  const rows = new Map();
  const puts = [];
  const gets = [];
  return {
    rows,
    puts,
    gets,
    get: async (key) => {
      gets.push(key);
      return rows.get(key) ?? null;
    },
    put: async (key, value, options) => {
      puts.push({ key, value, options });
      rows.set(key, value);
    },
    delete: async (key) => {
      rows.delete(key);
    },
  };
};

const run = async ({
  path = ANALYSIS_CARD_PUBLISH_PATH,
  body = { published: true, card: CARD },
  address = OWNER,
  config = ON,
  kv = createKv(),
  env = { GROUP_KV: kv },
  scopes = { ai: true },
  currentScopes = { ai: true },
  refuse = [],
  createRequesterAccessChecks,
} = {}) => {
  const counted = [];
  const response = await dispatchAnalysisCardSavedRoute({
    path,
    body,
    config,
    slug: 'salon',
    address,
    env,
    headers: { 'Access-Control-Allow-Origin': 'https://app.example' },
    scopes,
    deps: {
      json,
      now: () => NOW,
      computeScopesForLogin: async () => currentScopes,
      evaluateAuthenticatedRoutePreflight,
      checkRateLimit: async ({ route, address: who, limit }) => {
        counted.push({ route, address: who, limit });
        return !refuse.includes(route);
      },
      ...(createRequesterAccessChecks ? { createRequesterAccessChecks } : {}),
    },
  });
  return { response, body: await response.json(), counted, kv };
};

const read = (kv, account = OWNER, extra = {}) =>
  run({ path: ANALYSIS_CARD_PUBLISHED_PATH, body: { account }, address: VISITOR, kv, ...extra });

test('a saved card is filed under the signed-in person and every reader gets the same card', async () => {
  const kv = createKv();
  const saved = await run({ kv });
  assert.equal(saved.response.status, 200);
  assert.deepEqual(saved.body, { published: true, card: CARD, savedAt: NOW });
  assert.equal(saved.response.headers.get('cache-control'), 'no-store');
  assert.deepEqual([...kv.rows.keys()], [`session:salon:analysis-card-saved:v1:${OWNER}`]);
  assert.equal(kv.puts[0].options.expirationTtl, 365 * 24 * 60 * 60);
  assert.deepEqual(saved.counted, [{ route: 'analysis-card-save', address: OWNER, limit: ANALYSIS_CARD_SAVES_PER_DAY }]);

  const first = await read(kv, OWNER.toUpperCase().replace('0X', '0x'));
  const second = await read(kv);
  assert.deepEqual(first.body, { published: true, card: CARD, savedAt: NOW });
  assert.deepEqual(second.body, first.body);
  // Reading is never counted.
  assert.deepEqual(first.counted, []);
});

test('nobody can save a card onto someone else\'s page', async () => {
  // A card is its own person's: a request that names another account is refused, a save or a withdrawal alike,
  // and nothing is stored or counted.
  const kv = createKv();
  await run({ kv });
  const before = [...kv.rows.entries()];
  for (const body of [
    { published: true, card: CARD, account: OWNER },
    { published: false, account: OWNER },
    // A request that names nobody in particular is not the caller's own either.
    { published: true, card: CARD, account: null },
    { published: true, card: CARD, account: '' },
  ]) {
    const result = await run({ kv, address: VISITOR, body });
    assert.deepEqual([result.response.status, result.body], [403, { error: 'analysis_card_own_only' }]);
    assert.deepEqual(result.counted, []);
  }
  assert.deepEqual([...kv.rows.entries()], before);
  // Naming oneself, in any letter case, is the same as naming nobody: the card is filed under the signed-in address.
  const own = await run({ kv, address: VISITOR, body: { published: true, card: CARD, account: VISITOR.toUpperCase().replace('0X', '0x') } });
  assert.equal(own.response.status, 200);
  assert.deepEqual([...kv.rows.keys()].sort(), [OWNER, VISITOR].sort().map((who) => `session:salon:analysis-card-saved:v1:${who}`));
});

test('withdrawing deletes the card\'s words and keeps only the person\'s "no"', async () => {
  const kv = createKv();
  await run({ kv });
  const withdrawn = await run({ kv, body: { published: false, card: CARD } });
  assert.deepEqual(withdrawn.body, { published: false });
  const row = kv.rows.get(`session:salon:analysis-card-saved:v1:${OWNER}`);
  assert.deepEqual(JSON.parse(row), { published: false, withdrawnAt: NOW });
  assert.doesNotMatch(row, /Ostrom|water|rule/);
  assert.deepEqual((await read(kv)).body, { published: false });

  // Ticking the box again saves the card again.
  await run({ kv });
  assert.equal((await read(kv)).body.published, true);
});

test('nothing saved, an unreadable row, or a row that is not a card reads as nothing saved', async () => {
  const kv = createKv();
  assert.deepEqual((await read(kv)).body, { published: null });
  const key = `session:salon:analysis-card-saved:v1:${OWNER}`;
  for (const row of ['not json', '{"published":true}', JSON.stringify({ published: true, card: { title: 'x' }, savedAt: 1 }),
    JSON.stringify({ published: true, card: CARD })]) {
    kv.rows.set(key, row);
    assert.deepEqual((await read(kv)).body, { published: null }, row);
  }
});

test('a card that is malformed or too large is refused, with nothing stored or counted', async () => {
  for (const card of [null, { ...CARD, figure: 'Draw: a red bus (1900)' }, { ...CARD, title: '' },
    { ...CARD, matchNote: '語'.repeat(340), title: '語'.repeat(90),
      answers: { ...CARD.answers, ownWords: { prompt: '語'.repeat(300), text: '語'.repeat(600) },
        vote: { prompt: '語'.repeat(300), items: Array.from({ length: 8 }, () => '語'.repeat(120)) } },
      tastes: Object.fromEntries(['book', 'game', 'film', 'song'].map((kind) => [kind, { title: '語'.repeat(80), by: '語'.repeat(80) }])) }]) {
    const result = await run({ body: { published: true, card } });
    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, { error: 'invalid_card' });
    assert.equal(result.kv.puts.length, 0);
    assert.deepEqual(result.counted, []);
  }
  for (const body of [{}, { published: 'yes', card: CARD }, null]) {
    const result = await run({ body });
    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, { error: 'invalid_request' });
  }
});

test('a read names one account; a sign-in that is not an address cannot save', async () => {
  for (const account of ['', 'salon', '0x123', null, ['0x']]) {
    const result = await run({ path: ANALYSIS_CARD_PUBLISHED_PATH, body: { account } });
    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, { error: 'invalid_account' });
  }
  const odd = await run({ address: 'agent:abc' });
  assert.equal(odd.response.status, 400);
  assert.equal(odd.kv.puts.length, 0);
});

test('who may save or read is the card picture\'s rule: the ai scope, now, in a live session', async () => {
  for (const path of [ANALYSIS_CARD_PUBLISH_PATH, ANALYSIS_CARD_PUBLISHED_PATH]) {
    const body = path === ANALYSIS_CARD_PUBLISH_PATH ? { published: true, card: CARD } : { account: OWNER };
    const noScope = await run({ path, body, scopes: { ai: false } });
    assert.equal(noScope.response.status, 403, path);
    const revoked = await run({ path, body, currentScopes: { ai: false } });
    assert.equal(revoked.response.status, 403, path);
    const ended = await run({ path, body, config: { ...ON, sessionEndsAt: '2026-11-16T00:00:00Z' } });
    assert.equal(ended.response.status, 410, path);
    assert.equal(ended.body.code, 'session_ended');
    for (const result of [noScope, revoked, ended]) assert.equal(result.kv.puts.length, 0);
  }
});

test('a person past their saves for the day is refused and nothing is written', async () => {
  const result = await run({ refuse: ['analysis-card-save'] });
  assert.equal(result.response.status, 429);
  assert.equal(result.kv.puts.length, 0);
});

test('withdrawing is never counted, still works past the day\'s saves, and writes only when needed', async () => {
  const kv = createKv();
  await run({ kv });
  const withdrawn = await run({ kv, body: { published: false }, refuse: ['analysis-card-save'] });
  assert.equal(withdrawn.response.status, 200);
  assert.deepEqual(withdrawn.body, { published: false });
  assert.deepEqual(withdrawn.counted, []);
  assert.equal(kv.puts.length, 2);
  // Taking down a card that is already down writes nothing.
  const again = await run({ kv, body: { published: false } });
  assert.deepEqual(again.body, { published: false });
  assert.deepEqual(again.counted, []);
  assert.equal(kv.puts.length, 2);
  // With nothing saved, the "no" is still kept, so the page does not save a card on its own later.
  const fresh = createKv();
  await run({ kv: fresh, body: { published: false } });
  assert.deepEqual((await read(fresh)).body, { published: false });
  const failing = { get: async () => { throw new Error('kv down'); }, put: async () => {} };
  assert.equal((await run({ env: { GROUP_KV: failing }, body: { published: false } })).response.status, 503);
});

test('a session without its store says so instead of pretending to save', async () => {
  const missing = await run({ env: {} });
  assert.equal(missing.response.status, 503);
  assert.deepEqual(missing.body, { error: 'card_store_unavailable' });
  const failing = { get: async () => { throw new Error('kv down'); }, put: async () => { throw new Error('kv down'); } };
  assert.equal((await run({ env: { GROUP_KV: failing } })).response.status, 503);
  assert.equal((await read(failing)).response.status, 503);
});

test('the signed-in dispatcher answers both paths itself, whatever action the body names', async () => {
  const kv = createKv();
  for (const [path, body] of [
    [ANALYSIS_CARD_PUBLISH_PATH, { action: 'ai', prompt: 'ping', published: true, card: CARD }],
    [ANALYSIS_CARD_PUBLISHED_PATH, { action: 'ai', prompt: 'ping', account: OWNER }],
  ]) {
    const result = await dispatchAuthenticatedSecretActionRoute({
      path,
      action: 'ai',
      body,
      config: ON,
      slug: 'salon',
      address: OWNER,
      env: { GROUP_KV: kv },
      headers: {},
      scopes: { ai: true },
      deps: {
        json,
        evaluateAuthenticatedRoutePreflight,
        computeScopesForLogin: async () => ({ ai: true }),
        checkRateLimit: async () => true,
        proxyOpenAI: async () => { throw new Error('the /ai route must not answer'); },
      },
    });
    assert.equal(result.handled, true, path);
    assert.equal(result.response.status, 200, path);
    assert.equal((await result.response.json()).published, true, path);
  }
});

test('a card goes only where its owner\'s answers go: not saved where answers are private, read only by who may read them', async () => {
  const asMember = { ai: true, storage: true };
  const readAs = (kv, address, config, scopes = asMember) =>
    run({ path: ANALYSIS_CARD_PUBLISHED_PATH, body: { account: OWNER }, address, kv, config, scopes });
  for (const visibility of ['participant_aggregate', 'session_member_aggregate', 'private_admin', 'public_redacted_snapshot']) {
    const config = showing(visibility);
    assert.equal(analysisCardAnswersArePrivate(config), true, visibility);
    // No card is saved: the Worker gives each answer there only to its author and the admins.
    const kv = createKv();
    const refused = await run({ kv, config, scopes: asMember });
    assert.deepEqual([refused.response.status, refused.body], [403, { error: 'analysis_card_answers_private' }], visibility);
    assert.deepEqual([kv.puts.length, refused.counted.length], [0, 0], visibility);
    // A card saved while answers were public is given to nobody once they are private, and is deleted by the
    // first request that meets it, whoever asks: were the rules loosened again, it would otherwise come back
    // quoting answers given under the stricter ones.
    const key = `session:salon:analysis-card-saved:v1:${OWNER}`;
    for (const [reader, scopes] of [[VISITOR, { ai: true }], [VISITOR, asMember], [ADMIN, asMember], [OWNER, asMember]]) {
      await run({ kv });
      assert.equal(kv.rows.has(key), true, visibility);
      assert.deepEqual((await readAs(kv, reader, config, scopes)).body, { published: null }, visibility);
      assert.equal(kv.rows.has(key), false, visibility);
      assert.deepEqual((await readAs(kv, VISITOR, ON)).body, { published: null }, `${visibility}: gone when public again`);
    }
    // So is one that a refused save finds stored.
    await run({ kv });
    assert.equal((await run({ kv, config, scopes: asMember })).response.status, 403, visibility);
    assert.equal(kv.rows.has(key), false, visibility);
    // A "no" holds none of the card's words and is kept, and withdrawing still works there.
    await run({ kv });
    const withdrawn = await run({ kv, config, body: { published: false }, scopes: asMember });
    assert.deepEqual([withdrawn.response.status, withdrawn.body], [200, { published: false }], visibility);
    assert.deepEqual((await readAs(kv, VISITOR, config)).body, { published: false }, visibility);
    assert.equal((await run({ kv, config, scopes: asMember })).response.status, 403, visibility);
    assert.deepEqual((await readAs(kv, OWNER, ON)).body, { published: false }, `${visibility}: the "no" stays`);
  }
  // Where members see every answer, a member reads the card; a sign-in that could not read the answers does not.
  const members = showing('session_member_full');
  assert.equal(analysisCardAnswersArePrivate(members), false);
  const kv = createKv();
  assert.equal((await run({ kv, config: members, scopes: asMember })).response.status, 200);
  assert.equal((await readAs(kv, VISITOR, members)).body.published, true);
  assert.deepEqual((await readAs(kv, VISITOR, members, { ai: true })).body, { published: null });
  // Public answers: every signed-in visitor reads the card. A session from before mode profiles keeps none private.
  assert.equal(analysisCardAnswersArePrivate(ON), false);
  assert.equal(analysisCardAnswersArePrivate({}), false);
  assert.equal((await readAs(kv, VISITOR, ON, { ai: true })).body.published, true);
  // A check that cannot be made counts as no.
  const broken = await run({
    path: ANALYSIS_CARD_PUBLISHED_PATH, body: { account: OWNER }, address: VISITOR, kv,
    createRequesterAccessChecks: () => ({ canRead: async () => { throw new Error('gate unavailable'); } }),
  });
  assert.deepEqual(broken.body, { published: null });
});

test('the card is off unless the session has it on: off, nothing is counted, read or stored', async () => {
  const kv = createKv();
  await run({ kv, config: { ...ON, analysisCardEnabled: true } });
  const before = [...kv.rows.entries()];
  assert.equal(before.length, 1);
  kv.gets.length = 0;
  kv.puts.length = 0;
  // Off is a saved `false` or, as in every session from before the card, a switch that was never saved.
  for (const config of [{ analysisCardEnabled: false }, {}, { ...PUBLIC_SESSION, adminAddress: ADMIN }]) {
    for (const [path, body] of [
      [ANALYSIS_CARD_PUBLISH_PATH, { published: true, card: CARD }],
      [ANALYSIS_CARD_PUBLISH_PATH, { published: false }],
      [ANALYSIS_CARD_PUBLISHED_PATH, { account: OWNER }],
    ]) {
      const off = await run({ path, body, config, kv });
      assert.equal(off.response.status, 403, path);
      assert.deepEqual(off.body, { error: 'analysis_card_off' });
      assert.deepEqual(off.counted, []);
    }
  }
  assert.deepEqual([kv.gets.length, kv.puts.length], [0, 0]);
  // A card saved while it was on is left in storage, and is there again once the card is back on.
  assert.deepEqual([...kv.rows.entries()], before);
  assert.deepEqual((await read(kv)).body, { published: true, card: CARD, savedAt: NOW });
  assert.equal(analysisCardOn({ analysisCardEnabled: true }), true);
  assert.deepEqual([{}, null, undefined, { analysisCardEnabled: false }, { analysisCardEnabled: 'true' }].map(analysisCardOn), [false, false, false, false, false]);

  const viaDispatcher = await dispatchAuthenticatedSecretActionRoute({
    path: ANALYSIS_CARD_PUBLISHED_PATH,
    action: 'ai',
    body: { account: OWNER },
    config: { analysisCardEnabled: false },
    slug: 'salon',
    address: OWNER,
    env: { GROUP_KV: kv },
    headers: {},
    scopes: { ai: true },
    deps: {
      json,
      evaluateAuthenticatedRoutePreflight,
      computeScopesForLogin: async () => { throw new Error('nothing is checked while the card is off'); },
      checkRateLimit: async () => { throw new Error('nothing is counted while the card is off'); },
      proxyOpenAI: async () => { throw new Error('the /ai route must not answer'); },
    },
  });
  assert.equal(viaDispatcher.handled, true);
  assert.equal(viaDispatcher.response.status, 403);
});

test('analysisCardEnabled is true or false, set when made or later, signs no one out, is public and kept on redeploy', () => {
  const base = { slug: 's', sessionId: `0x${'ab'.repeat(16)}`, adminAddress: OWNER };
  const save = (analysisCardEnabled, existingConfig = base) =>
    applySessionConfigMutation({ existingConfig, slug: 's', mutation: { kind: 'set-config', incomingConfig: { ...base, analysisCardEnabled } } });
  assert.deepEqual([save(true).ok, save(false).ok], [true, true]);
  // A session's first save, as /new makes it: the box there starts ticked.
  assert.equal(save(true, null).config.analysisCardEnabled, true);
  assert.deepEqual([save('yes').ok, save('yes').error], [false, 'analysisCardEnabled must be true or false.']);
  assert.deepEqual(classifySessionConfigEdits(base, { ...base, analysisCardEnabled: true }), { content: ['analysisCardEnabled'], authority: [], signsParticipantsOut: false });
  assert.equal(projectPublicWorkerSessionConfig({ ...base, analysisCardEnabled: true }).analysisCardEnabled, true);
  assert.equal(selectDeployWorkerSessionConfigFields({ ...base, analysisCardEnabled: true }).analysisCardEnabled, true);
  // The site offers the switch only where the Worker says it has the card.
  assert.ok(FEATURES.includes('analysis_card_v1'));
});

// The drawn card: made-up bytes with a real picture's first bytes, as the page's canvas gives them.
const picture = (mime, size = 300) => {
  const head = mime === 'image/png' ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] : [0xff, 0xd8, 0xff, 0xe0];
  const bytes = Buffer.alloc(size, 7);
  Buffer.from(head).copy(bytes);
  if (mime === 'image/jpeg') Buffer.from([0xff, 0xd9]).copy(bytes, size - 2);
  return { mime, base64: bytes.toString('base64') };
};
const PAGES = [picture('image/jpeg'), picture('image/jpeg', 301)];
const DRAWING_KEY = `session:salon:analysis-card-drawing:v1:${OWNER}`;
const saveDrawing = (kv, extra = {}) => run({ path: ANALYSIS_CARD_DRAWING_SAVE_PATH, body: { savedAt: NOW, pages: PAGES }, kv, ...extra });
const readDrawing = (kv, extra = {}) =>
  run({ path: ANALYSIS_CARD_DRAWING_PATH, body: { account: OWNER }, address: VISITOR, kv, ...extra });

test('the drawn pages are kept beside the caller\'s own saved card and read back by whoever reads the card', async () => {
  const kv = createKv();
  // With no card saved there is nothing to draw for.
  const early = await saveDrawing(kv);
  assert.deepEqual([early.response.status, early.body], [409, { error: 'analysis_card_not_saved' }]);
  assert.deepEqual([kv.puts.length, early.counted.length], [0, 0]);

  await run({ kv });
  const stored = await saveDrawing(kv);
  assert.deepEqual([stored.response.status, stored.body], [200, { saved: true, pages: 2, savedAt: NOW }]);
  assert.deepEqual(stored.counted, [{ route: 'analysis-card-drawing', address: OWNER, limit: ANALYSIS_CARD_DRAWINGS_PER_DAY }]);
  assert.equal(stored.response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(JSON.parse(kv.rows.get(DRAWING_KEY)), { cardSavedAt: NOW, pages: PAGES });
  assert.equal(kv.puts.at(-1).options.expirationTtl, 365 * 24 * 60 * 60);

  const seen = await readDrawing(kv);
  assert.deepEqual(seen.body, { drawing: { pages: PAGES, savedAt: NOW } });
  assert.deepEqual(seen.counted, []);
  assert.deepEqual((await readDrawing(kv, { address: OWNER })).body, seen.body);

  // Nobody draws onto someone else's card, and a read names one account.
  const other = await saveDrawing(kv, { address: VISITOR, body: { savedAt: NOW, pages: PAGES, account: OWNER } });
  assert.deepEqual([other.response.status, other.body], [403, { error: 'analysis_card_own_only' }]);
  assert.deepEqual((await saveDrawing(kv, { address: VISITOR })).body, { error: 'analysis_card_not_saved' });
  assert.equal((await readDrawing(kv, { body: {} })).response.status, 400);
  assert.deepEqual(JSON.parse(kv.rows.get(DRAWING_KEY)).pages, PAGES);
});

test('only one or two small JPEG or PNG pages are kept, and a refused one is neither stored nor counted', async () => {
  const kv = createKv();
  await run({ kv });
  const tooBig = picture('image/jpeg', ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES + 3);
  const atLimit = picture('image/jpeg', ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES);
  assert.equal(normalizeAnalysisCardDrawing([atLimit]).length, 1);
  // One byte over is over, whatever the padding.
  for (const over of [1, 2, 3]) assert.equal(normalizeAnalysisCardDrawing([picture('image/jpeg', ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES + over)]), null);
  for (const pages of [
    undefined, null, 'pages', {}, [], [PAGES[0], PAGES[1], PAGES[0]],
    [tooBig],
    // A type that only looks like one when turned into text, a PNG, three bytes, and a picture that never ends.
    [{ mime: ['image/jpeg'], base64: PAGES[0].base64 }],
    [{ mime: [['image/jpeg']], base64: PAGES[0].base64 }],
    [picture('image/png')],
    [{ mime: 'image/jpeg', base64: '/9j/' }],
    [{ mime: 'image/jpeg', base64: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('<html><script>x()</script>'.repeat(8))]).toString('base64') }],
    [{ mime: 'image/svg+xml', base64: Buffer.from('<svg onload="x()"/>').toString('base64') }],
    [{ mime: 'text/html', base64: PAGES[0].base64 }],
    // Bytes that are not the picture the type names.
    [{ mime: 'image/png', base64: PAGES[0].base64 }],
    [{ mime: 'image/jpeg', base64: Buffer.from('<script>alert(1)</script>').toString('base64') }],
    [{ mime: 'image/jpeg', base64: `${PAGES[0].base64.slice(0, -4)}!!!!` }],
    [{ mime: 'image/jpeg', base64: `data:image/jpeg;base64,${PAGES[0].base64}` }],
    [{ mime: 'image/jpeg', base64: 42 }],
    [{ base64: PAGES[0].base64 }],
    ['page'],
  ]) {
    const refused = await saveDrawing(kv, { body: { savedAt: NOW, pages } });
    assert.deepEqual([refused.response.status, refused.body], [400, { error: 'invalid_drawing' }], JSON.stringify(pages)?.slice(0, 60));
    assert.deepEqual(refused.counted, []);
  }
  assert.equal(kv.rows.has(DRAWING_KEY), false);
  // Anything beside mime and base64 is dropped.
  await saveDrawing(kv, { body: { savedAt: NOW, pages: [{ ...PAGES[0], name: '../../x', html: '<b>' }] } });
  assert.deepEqual(JSON.parse(kv.rows.get(DRAWING_KEY)).pages, [PAGES[0]]);
  // Past the day's uploads nothing is written.
  const before = kv.rows.get(DRAWING_KEY);
  const limited = await saveDrawing(kv, { refuse: ['analysis-card-drawing'] });
  assert.equal(limited.response.status, 429);
  assert.equal(kv.rows.get(DRAWING_KEY), before);
});

test('the drawn pages go where the card goes and nowhere else', async () => {
  const asMember = { ai: true, storage: true };
  // A new save, or a withdrawal, leaves the old pages unread and deletes them.
  for (const body of [{ published: true, card: { ...CARD, title: 'A newer card' } }, { published: false }]) {
    const kv = createKv();
    await run({ kv });
    await saveDrawing(kv);
    await run({ kv, body });
    assert.equal(kv.rows.has(DRAWING_KEY), false);
    assert.deepEqual((await readDrawing(kv)).body, { drawing: null });
    assert.deepEqual((await readDrawing(kv, { address: OWNER })).body, { drawing: null });
  }
  // Pages left behind by a failed delete are still not shown beside another save.
  const stale = createKv();
  await run({ kv: stale });
  stale.rows.set(DRAWING_KEY, JSON.stringify({ cardSavedAt: NOW - 1, pages: PAGES }));
  assert.deepEqual((await readDrawing(stale)).body, { drawing: null });
  stale.rows.set(DRAWING_KEY, JSON.stringify({ cardSavedAt: NOW, pages: [{ mime: 'image/jpeg', base64: 'not a picture' }] }));
  assert.deepEqual((await readDrawing(stale)).body, { drawing: null });

  // Where answers are private nobody is given the pages, owner and admin included, and they are deleted.
  for (const visibility of ['participant_aggregate', 'private_admin']) {
    for (const reader of [VISITOR, ADMIN, OWNER]) {
      const kv = createKv();
      await run({ kv });
      await saveDrawing(kv);
      const hidden = await readDrawing(kv, { address: reader, config: showing(visibility), scopes: asMember });
      assert.deepEqual(hidden.body, { drawing: null }, visibility);
      assert.equal(kv.rows.has(DRAWING_KEY), false, visibility);
      // And none can be stored there.
      const refused = await saveDrawing(kv, { config: showing(visibility), scopes: asMember });
      assert.equal(refused.response.status, 409, visibility);
    }
  }
  // Where members see every answer, a member reads the pages; a sign-in that could not read the answers does not.
  const members = showing('session_member_full');
  const kv = createKv();
  await run({ kv, config: members, scopes: asMember });
  await saveDrawing(kv, { config: members, scopes: asMember });
  assert.deepEqual((await readDrawing(kv, { config: members, scopes: asMember })).body.drawing.pages, PAGES);
  assert.deepEqual((await readDrawing(kv, { config: members, scopes: { ai: true } })).body, { drawing: null });
  // A check that cannot be made counts as no.
  const broken = await readDrawing(kv, { createRequesterAccessChecks: () => ({ canRead: async () => { throw new Error('gate unavailable'); } }) });
  assert.deepEqual(broken.body, { drawing: null });

  // Off, ended or without the ai scope, the routes answer as the card's own do: nothing read, stored or counted.
  for (const path of [ANALYSIS_CARD_DRAWING_PATH, ANALYSIS_CARD_DRAWING_SAVE_PATH]) {
    const body = path === ANALYSIS_CARD_DRAWING_PATH ? { account: OWNER } : { savedAt: NOW, pages: PAGES };
    const off = await run({ path, body, kv, config: { ...ON, analysisCardEnabled: false } });
    assert.deepEqual([off.response.status, off.body], [403, { error: 'analysis_card_off' }], path);
    assert.equal((await run({ path, body, kv, scopes: { storage: true } })).response.status, 403, path);
    assert.equal((await run({ path, body, kv, currentScopes: { ai: false } })).response.status, 403, path);
    assert.equal((await run({ path, body, kv, config: { ...ON, sessionEndsAt: new Date(NOW - 1000).toISOString() } })).response.status, 410, path);
  }
});

test('the drawn-card routes are path-owned and advertised', async () => {
  assert.deepEqual(ANALYSIS_CARD_SAVED_PATHS, ['/analysis-card/publish', '/analysis-card/published', '/analysis-card/drawing/save', '/analysis-card/drawing']);
  assert.ok(FEATURES.includes(ANALYSIS_CARD_DRAWING_FEATURE));
  const kv = createKv();
  await run({ kv });
  const dispatched = await dispatchAuthenticatedSecretActionRoute({
    path: ANALYSIS_CARD_DRAWING_SAVE_PATH, action: 'ai', body: { savedAt: NOW, pages: PAGES, action: 'ai' }, config: ON, slug: 'salon', address: OWNER,
    env: { GROUP_KV: kv }, headers: {}, scopes: { ai: true },
    deps: { json, now: () => NOW, computeScopesForLogin: async () => ({ ai: true }), evaluateAuthenticatedRoutePreflight, checkRateLimit: async () => true },
  });
  assert.equal(dispatched.handled, true);
  assert.deepEqual(await dispatched.response.json(), { saved: true, pages: 2, savedAt: NOW });
});

test('pages drawn for an earlier save are refused once a later card is the saved one', async () => {
  const kv = createKv();
  await run({ kv });
  // The page saved again before the first save's pages arrived.
  const later = NOW + 5000;
  kv.rows.set(`session:salon:analysis-card-saved:v1:${OWNER}`, JSON.stringify({ published: true, card: { ...CARD, title: 'A later card' }, savedAt: later }));
  for (const savedAt of [NOW, undefined, String(later), later + 1, null]) {
    const late = await saveDrawing(kv, { body: { savedAt, pages: PAGES } });
    assert.deepEqual([late.response.status, late.body], [409, { error: 'analysis_card_drawing_stale' }], String(savedAt));
    assert.deepEqual(late.counted, []);
  }
  assert.equal(kv.rows.has(DRAWING_KEY), false);
  assert.equal((await saveDrawing(kv, { body: { savedAt: later, pages: PAGES } })).response.status, 200);
  assert.deepEqual((await readDrawing(kv)).body, { drawing: { pages: PAGES, savedAt: later } });
});

test('where answers are private, reading an account that never saved a card deletes nothing', async () => {
  const kv = createKv();
  const deleted = [];
  kv.delete = async (key) => { deleted.push(key); kv.rows.delete(key); };
  const config = showing('participant_aggregate');
  const scopes = { ai: true, storage: true };
  for (const path of [ANALYSIS_CARD_PUBLISHED_PATH, ANALYSIS_CARD_DRAWING_PATH]) {
    for (const account of [OWNER, VISITOR, `0x${'9'.repeat(40)}`]) {
      await run({ path, body: { account }, address: VISITOR, kv, config, scopes });
    }
  }
  await run({ kv, config, scopes });
  await saveDrawing(kv, { config, scopes });
  assert.deepEqual(deleted, []);
  // A card that is there is still deleted, with its pages.
  await run({ kv });
  await saveDrawing(kv);
  deleted.length = 0;
  await run({ path: ANALYSIS_CARD_PUBLISHED_PATH, body: { account: OWNER }, address: VISITOR, kv, config, scopes });
  assert.deepEqual(deleted.sort(), [DRAWING_KEY, `session:salon:analysis-card-saved:v1:${OWNER}`].sort());
});
