import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYSIS_CARD_PUBLISH_PATH,
  ANALYSIS_CARD_PUBLISHED_PATH,
  ANALYSIS_CARD_SAVES_PER_DAY,
  dispatchAnalysisCardSavedRoute,
} from './analysisCardSavedRoute.js';
import { evaluateAuthenticatedRoutePreflight } from './authenticatedRoutePreflight.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';
import { json } from './responseKvHelpers.js';

const OWNER = `0x${'a1'.repeat(20)}`;
const VISITOR = `0x${'b2'.repeat(20)}`;
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

const createKv = () => {
  const rows = new Map();
  const puts = [];
  return {
    rows,
    puts,
    get: async (key) => rows.get(key) ?? null,
    put: async (key, value, options) => {
      puts.push({ key, value, options });
      rows.set(key, value);
    },
  };
};

const run = async ({
  path = ANALYSIS_CARD_PUBLISH_PATH,
  body = { published: true, card: CARD },
  address = OWNER,
  config = {},
  kv = createKv(),
  env = { GROUP_KV: kv },
  scopes = { ai: true },
  currentScopes = { ai: true },
  refuse = [],
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
  const kv = createKv();
  const result = await run({ kv, address: VISITOR, body: { published: true, card: CARD, account: OWNER } });
  assert.equal(result.response.status, 200);
  assert.deepEqual([...kv.rows.keys()], [`session:salon:analysis-card-saved:v1:${VISITOR}`]);
  assert.deepEqual((await read(kv, OWNER)).body, { published: null });
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
    const ended = await run({ path, body, config: { sessionEndsAt: '2026-11-16T00:00:00Z' } });
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
      config: {},
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
