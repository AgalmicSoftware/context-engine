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
import { applySessionConfigMutation } from './sessionConfigMutation.js';
import { FEATURES } from './workerCapabilities.js';
import { projectPublicWorkerSessionConfig, selectDeployWorkerSessionConfigFields } from '../shared/workerSessionConfig.mjs';
import { classifySessionConfigEdits } from '../../shared/sessionConfigEdits.mjs';

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

// A session that never saved the switch has the card on, as every session from before the switch does.
const ON = {};

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

test('the card is on unless an admin turns it off: off, nothing is counted, read or stored', async () => {
  const kv = createKv();
  await run({ kv, config: { analysisCardEnabled: true } });
  const before = [...kv.rows.entries()];
  assert.equal(before.length, 1);
  kv.gets.length = 0;
  kv.puts.length = 0;
  for (const config of [{ analysisCardEnabled: false }]) {
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

test('analysisCardEnabled is true or false, signs no one out, the site can read it and a redeploy keeps it', () => {
  const base = { slug: 's', sessionId: `0x${'ab'.repeat(16)}`, adminAddress: OWNER };
  const save = (analysisCardEnabled) =>
    applySessionConfigMutation({ existingConfig: base, slug: 's', mutation: { kind: 'set-config', incomingConfig: { ...base, analysisCardEnabled } } });
  assert.deepEqual([save(true).ok, save(false).ok], [true, true]);
  assert.deepEqual([save('yes').ok, save('yes').error], [false, 'analysisCardEnabled must be true or false.']);
  assert.deepEqual(classifySessionConfigEdits(base, { ...base, analysisCardEnabled: true }), { content: ['analysisCardEnabled'], authority: [], signsParticipantsOut: false });
  assert.equal(projectPublicWorkerSessionConfig({ ...base, analysisCardEnabled: true }).analysisCardEnabled, true);
  assert.equal(selectDeployWorkerSessionConfigFields({ ...base, analysisCardEnabled: true }).analysisCardEnabled, true);
  // The site offers the switch only where the Worker says it has the card.
  assert.ok(FEATURES.includes('analysis_card_v1'));
});
