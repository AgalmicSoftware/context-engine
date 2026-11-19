import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_AI_MODEL } from '../../shared/aiDefaults.mjs';
import {
  ANALYSIS_CARD_LOOKS_REMEMBERED,
  ANALYSIS_CARD_PICTURE_QUALITY,
  ANALYSIS_CARD_PICTURE_SIZE,
} from '../../shared/analysisCardPicture.mjs';
import { DEFAULT_WRAPPED_IMAGE_MODEL } from './agent/wrappedCore.mjs';
import {
  ANALYSIS_CARD_PICTURE_PATH,
  ANALYSIS_CARD_PICTURES_PER_SESSION_PER_DAY,
  dispatchAnalysisCardPictureRoute,
} from './analysisCardPictureRoute.js';
import { evaluateAuthenticatedRoutePreflight } from './authenticatedRoutePreflight.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';
import { json } from './responseKvHelpers.js';

const SESSION_KEY = 'session-openai-key';
const IMAGE = 'aW1hZ2UtYnl0ZXM=';
const FIGURE = 'Mme Curie (1867–1934)';
const LOOK = {
  name: 'Marie Curie',
  died: 1934,
  era: 'Paris, 1890s to 1900s',
  style: 'A three-colour lithograph poster on cream paper, in ochre, slate blue and vermilion.',
  ground: 'cream',
  accentHex: '#E34234',
  objects: 'a glass flask, a brass electrometer, a lead box, a ruled notebook',
};
const MODERATED = { status: 400, body: { error: { code: 'moderation_blocked', message: 'UPSTREAM SAFETY TEXT' } } };
const DRAWN = { status: 200, body: { data: [{ b64_json: IMAGE }] } };

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
      puts.push({ key, options });
      rows.set(key, value);
    },
  };
};

// OpenAI, as the route sees it: one look per text request, then the queued answers to picture requests.
const createUpstream = ({ look = LOOK, pictures = [DRAWN], lookStatus = 200 } = {}) => {
  const calls = [];
  const queue = [...pictures];
  const fetchImpl = async (url, init) => {
    const call = { url: String(url), authorization: init.headers.authorization, body: JSON.parse(init.body) };
    calls.push(call);
    if (call.url === 'https://api.openai.com/v1/images/generations') {
      const next = queue.shift() || DRAWN;
      return new Response(JSON.stringify(next.body), { status: next.status });
    }
    const text = JSON.stringify(look);
    return new Response(
      JSON.stringify(lookStatus === 200
        ? { output_text: text, choices: [{ message: { content: text } }] }
        : { error: { message: 'UPSTREAM LOOK TEXT' } }),
      { status: lookStatus },
    );
  };
  const pictureCalls = () => calls.filter((call) => call.url.endsWith('/images/generations'));
  const lookCalls = () => calls.filter((call) => !call.url.endsWith('/images/generations'));
  return { calls, fetchImpl, pictureCalls, lookCalls };
};

const lookPromptOf = (call) => (call.body.input || call.body.messages)[0].content;

// The card is off unless a session has it on; a test says `analysisCardEnabled` itself to try it off or unsaved.
const withCardOn = (config) => (Object.hasOwn(config, 'analysisCardEnabled') || config.unsaved ? config : { ...config, analysisCardEnabled: true });

const run = async ({
  figure = FIGURE,
  // A session with the card on, as one made on /new is. Anything a test adds is added to this.
  config = {},
  kv = createKv(),
  env = { GROUP_KV: kv },
  secrets = { openaiKey: SESSION_KEY },
  scopes = { ai: true },
  upstream = createUpstream(),
  refuse = [],
} = {}) => {
  const counted = [];
  const response = await dispatchAnalysisCardPictureRoute({
    body: { figure },
    config: withCardOn(config),
    slug: 'salon',
    address: '0xabc',
    env,
    headers: { 'Access-Control-Allow-Origin': 'https://app.example' },
    scopes,
    deps: {
      json,
      fetch: upstream.fetchImpl,
      now: () => Date.parse('2026-11-17T00:00:00Z'),
      getSessionSecrets: async () => secrets,
      computeScopesForLogin: async () => ({ ai: true }),
      evaluateAuthenticatedRoutePreflight,
      checkRateLimit: async ({ route, address, limit }) => {
        counted.push({ route, address, limit });
        return !refuse.includes(route);
      },
    },
  });
  return { response, body: await response.json(), counted, kv, upstream };
};

const routesCounted = (counted) => counted.map((entry) => entry.route);

test('a figure that is not "Name (years)" is refused before anything is asked', async () => {
  for (const figure of ['Draw a red bus', 'Marie Curie', '', null, 42, 'Marie Curie (scientist)', 'Draw: a bus; a cat (1900)']) {
    const { response, body, counted, upstream } = await run({ figure });
    assert.equal(response.status, 400, String(figure));
    assert.deepEqual(body, { error: 'invalid_figure' });
    assert.equal(upstream.calls.length, 0);
    assert.deepEqual(counted, []);
  }
});

test('a picture already drawn for the figure is returned without asking or counting', async () => {
  const first = await run();
  assert.equal(first.response.status, 200);
  const upstream = createUpstream();
  // The same person, with their years written another way.
  const second = await run({ figure: 'Mme  Curie (1867-1934)', kv: first.kv, upstream });
  assert.equal(second.response.status, 200);
  assert.deepEqual(second.body, { ...first.body, figure: 'Mme Curie (1867-1934)', cached: true });
  assert.equal(upstream.calls.length, 0);
  assert.deepEqual(second.counted, []);
  assert.equal(second.response.headers.get('cache-control'), 'no-store');
});

test('a session without an OpenAI key cannot draw', async () => {
  for (const secrets of [null, {}, { anthropicKey: 'other', openaiKey: '  ' }]) {
    const { response, body, counted, upstream } = await run({ secrets });
    assert.equal(response.status, 409);
    assert.deepEqual(body, { error: 'picture_needs_openai_key' });
    assert.equal(upstream.calls.length, 0);
    assert.deepEqual(counted, []);
  }
});

test('a name the model does not recognise draws nothing and costs no AI call', async () => {
  const upstream = createUpstream({
    look: { name: '', died: 0, era: '', style: '', ground: '', accentHex: '', objects: '' },
  });
  const { response, body, counted, kv } = await run({ figure: 'Nobody Atall (1900–1950)', upstream });
  assert.equal(response.status, 422);
  assert.deepEqual(body, { error: 'figure_not_recognised' });
  assert.equal(upstream.lookCalls().length, 1);
  assert.equal(upstream.pictureCalls().length, 0);
  assert.deepEqual(routesCounted(counted), ['analysis-card-look']);

  // The answer is remembered for a day, so reopening the card asks nothing and counts nothing.
  assert.deepEqual(kv.puts, [
    { key: 'session:salon:analysis-card-picture:v1:figure:nobody atall (1900-1950)', options: { expirationTtl: 24 * 60 * 60 } },
  ]);
  const again = await run({ figure: 'Nobody Atall (1900–1950)', kv });
  assert.equal(again.response.status, 422);
  assert.deepEqual(again.body, { error: 'figure_not_recognised' });
  assert.equal(again.upstream.calls.length, 0);
  assert.deepEqual(again.counted, []);
});

test('the picture is drawn only of the person who was asked for', async () => {
  // The model answers with somebody whose name shares no word with the request.
  const upstream = createUpstream({ look: { ...LOOK, name: 'Albert Einstein', died: 1955 } });
  const { response, body, kv } = await run({ upstream });
  assert.equal(response.status, 422);
  assert.deepEqual(body, { error: 'figure_not_recognised' });
  assert.equal(upstream.pictureCalls().length, 0);
  // Not remembered: the model named somebody, so the next request may get the spelling right.
  assert.equal(kv.puts.length, 0);

  // Nor is a reply that does not say whether the person died.
  const vague = await run({ upstream: createUpstream({ look: { ...LOOK, died: 'unknown' } }) });
  assert.equal(vague.response.status, 422);
  assert.equal(vague.kv.puts.length, 0);
});

test('a refusal cannot be planted on another figure, or over a picture', async () => {
  const unknown = { name: '', died: 0, era: '', style: '', ground: '', accentHex: '', objects: '' };
  // A string that only looks like the figure is kept under its own record.
  const planted = await run({ figure: 'Mme. Curie (1867–1934)', upstream: createUpstream({ look: unknown }) });
  assert.equal(planted.response.status, 422);
  const real = await run({ kv: planted.kv });
  assert.equal(real.response.status, 200);
  assert.equal(real.body.cached, false);

  // A picture stored while another request was being refused is not replaced by that refusal: here the
  // record is missing when the second request starts and present by the time it would write.
  const kv = createKv();
  await run({ kv });
  const key = 'session:salon:analysis-card-picture:v1:figure:mme curie (1867-1934)';
  const picture = kv.rows.get(key);
  assert.ok(picture);
  let reads = 0;
  const racing = { ...kv, get: async (name) => (name === key && reads++ === 0 ? null : (kv.rows.get(name) ?? null)) };
  const refused = await run({ kv: racing, upstream: createUpstream({ look: unknown }) });
  assert.equal(refused.response.status, 422);
  assert.equal(kv.rows.get(key), picture);
});

test('two people who share a name are drawn and kept apart', async () => {
  const kv = createKv();
  const painter = await run({ figure: 'Francis Bacon (1909–1992)', kv, upstream: createUpstream({ look: { ...LOOK, name: 'Francis Bacon', died: 1992 } }) });
  assert.equal(painter.response.status, 200);
  const upstream = createUpstream({ look: { ...LOOK, name: 'Francis Bacon', died: 1626, era: 'England, 1600s' } });
  const philosopher = await run({ figure: 'Francis Bacon (1561–1626)', kv, upstream });
  assert.equal(philosopher.response.status, 200);
  assert.equal(philosopher.body.cached, false);
  assert.equal(philosopher.body.look.era, 'England, 1600s');
  assert.equal(upstream.pictureCalls().length, 1);
  assert.ok(kv.rows.has('session:salon:analysis-card-picture:v1:figure:francis bacon (1909-1992)'));
  assert.ok(kv.rows.has('session:salon:analysis-card-picture:v1:figure:francis bacon (1561-1626)'));
});

test('a new picture is drawn from the look alone, with the session key, and kept', async () => {
  const { response, body, counted, kv, upstream } = await run({ config: { limits: { aiPerWalletPerDay: 25 } } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.example');
  assert.deepEqual(body, {
    figure: FIGURE,
    name: 'Marie Curie',
    portrait: true,
    look: { era: LOOK.era, ground: 'cream', accentHex: '#e34234' },
    image: { mime: 'image/jpeg', base64: IMAGE },
    cached: false,
  });

  const [look] = upstream.lookCalls();
  assert.equal(new URL(look.url).origin, 'https://api.openai.com');
  assert.equal(look.authorization, `Bearer ${SESSION_KEY}`);
  assert.equal(look.body.model, DEFAULT_AI_MODEL);
  assert.match(lookPromptOf(look), /Figure: Mme Curie \(1867–1934\)/);
  assert.match(JSON.stringify(look.body), /analysis_card_look/);

  const [picture, ...others] = upstream.pictureCalls();
  assert.equal(others.length, 0);
  assert.equal(picture.authorization, `Bearer ${SESSION_KEY}`);
  const { prompt, ...settings } = picture.body;
  assert.deepEqual(settings, {
    model: DEFAULT_WRAPPED_IMAGE_MODEL,
    size: ANALYSIS_CARD_PICTURE_SIZE,
    quality: ANALYSIS_CARD_PICTURE_QUALITY,
    output_format: 'jpeg',
    output_compression: 90,
    n: 1,
  });
  assert.ok(prompt.includes(LOOK.style));
  assert.ok(prompt.includes('Marie Curie, the historical figure'));
  assert.ok(!prompt.includes('Mme'));
  assert.ok(!prompt.includes('1867'));

  // One of the person's AI calls and one of the session's pictures, the person first.
  assert.deepEqual(counted, [
    { route: 'analysis-card-look', address: '0xabc', limit: 25 },
    { route: 'ai', address: '0xabc', limit: 25 },
    { route: 'analysis-card-picture-session', address: 'session', limit: ANALYSIS_CARD_PICTURES_PER_SESSION_PER_DAY },
  ]);
  assert.equal(ANALYSIS_CARD_PICTURES_PER_SESSION_PER_DAY, 60);

  const { cached, ...kept } = body;
  assert.equal(cached, false);
  assert.deepEqual(JSON.parse(kv.rows.get('session:salon:analysis-card-picture:v1:figure:mme curie (1867-1934)')), kept);
  assert.deepEqual(kv.puts.map((put) => put.options), [
    { expirationTtl: 30 * 24 * 60 * 60 },
    { expirationTtl: 30 * 24 * 60 * 60 },
  ]);
  assert.ok(!JSON.stringify([...kv.rows]).includes(SESSION_KEY));
  assert.ok(!JSON.stringify(body).includes(SESSION_KEY));
});

test('the look is asked of the session\'s OpenAI model, or the default one when the session uses another provider', async () => {
  const own = await run({ config: { ai: { provider: 'openai', model: 'gpt-4o' } } });
  const [ownLook] = own.upstream.lookCalls();
  assert.equal(ownLook.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(ownLook.body.model, 'gpt-4o');
  assert.equal(ownLook.body.reasoning_effort, undefined);
  assert.equal(ownLook.body.response_format.json_schema.name, 'analysis_card_look');
  assert.equal(ownLook.body.response_format.json_schema.strict, true);

  const other = await run({ config: { ai: { provider: 'anthropic', model: 'claude-opus-5-5' } } });
  const [otherLook] = other.upstream.lookCalls();
  assert.equal(otherLook.body.model, DEFAULT_AI_MODEL);
  assert.equal((otherLook.body.reasoning?.effort ?? otherLook.body.reasoning_effort), 'low');
  assert.equal(other.response.status, 200);
});

test('a refused portrait falls back to a still life of the figure\'s objects', async () => {
  const upstream = createUpstream({ pictures: [MODERATED, DRAWN] });
  const { response, body, counted } = await run({ upstream });
  assert.equal(response.status, 200);
  assert.equal(body.portrait, false);
  assert.equal(body.image.base64, IMAGE);
  const [portrait, emblem] = upstream.pictureCalls();
  assert.ok(portrait.body.prompt.includes('head-and-shoulders portrait'));
  assert.ok(emblem.body.prompt.includes('There is no person in the picture'));
  assert.ok(emblem.body.prompt.includes(LOOK.objects));
  assert.equal(routesCounted(counted).filter((route) => route === 'ai').length, 1);
});

test('a picture refused twice, or refused with no objects to fall back to, is refused', async () => {
  const twice = createUpstream({ pictures: [MODERATED, MODERATED] });
  const refused = await run({ upstream: twice });
  assert.equal(refused.response.status, 422);
  assert.deepEqual(refused.body, { error: 'picture_refused' });
  assert.equal(twice.pictureCalls().length, 2);
  // Remembered for a day: the next request for this figure draws nothing and spends nothing.
  assert.deepEqual(refused.kv.puts.map((put) => put.options), [{ expirationTtl: 24 * 60 * 60 }]);
  const again = await run({ kv: refused.kv });
  assert.equal(again.response.status, 422);
  assert.deepEqual(again.body, { error: 'picture_refused' });
  assert.equal(again.upstream.calls.length, 0);
  assert.deepEqual(again.counted, []);

  const bare = createUpstream({ look: { ...LOOK, objects: '' }, pictures: [MODERATED] });
  const noFallback = await run({ upstream: bare });
  assert.equal(noFallback.response.status, 422);
  assert.deepEqual(noFallback.body, { error: 'picture_refused' });
  assert.equal(bare.pictureCalls().length, 1);
});

test('an upstream failure is reported without its text', async () => {
  const failures = [
    createUpstream({ pictures: [{ status: 500, body: { error: { message: 'UPSTREAM SECRET DETAIL' } } }] }),
    createUpstream({ pictures: [{ status: 200, body: { data: [] } }] }),
    createUpstream({ lookStatus: 500 }),
    createUpstream({ pictures: [MODERATED, { status: 500, body: { error: { message: 'UPSTREAM SECRET DETAIL' } } }] }),
  ];
  for (const upstream of failures) {
    const { response, body, kv } = await run({ upstream });
    assert.equal(response.status, 502);
    assert.deepEqual(body, { error: 'picture_unavailable' });
    assert.equal(kv.puts.length, 0);
  }
  const thrown = await run({ upstream: { ...createUpstream(), fetchImpl: async () => { throw new Error('socket UPSTREAM'); } } });
  assert.equal(thrown.response.status, 502);
  assert.deepEqual(thrown.body, { error: 'picture_unavailable' });
});

test('a session draws at most its daily number of new pictures', async () => {
  const { response, body, upstream, kv } = await run({ refuse: ['analysis-card-picture-session'] });
  assert.equal(response.status, 429);
  assert.deepEqual(body, { error: 'picture_session_limit' });
  assert.equal(upstream.pictureCalls().length, 0);

  // For the next hour nobody else spends a request or an AI call finding the same thing out.
  assert.deepEqual(kv.puts, [
    { key: 'session:salon:analysis-card-picture:v1:session-limit', options: { expirationTtl: 60 * 60 } },
  ]);
  const next = await run({ figure: 'Ada Lovelace (1815–1852)', kv });
  assert.equal(next.response.status, 429);
  assert.deepEqual(next.body, { error: 'picture_session_limit' });
  assert.equal(next.upstream.calls.length, 0);
  assert.deepEqual(next.counted, []);
  // A picture already kept is still returned.
  const kept = await run();
  const cached = await run({ kv: Object.assign(kept.kv, { rows: kept.kv.rows.set('session:salon:analysis-card-picture:v1:session-limit', '{"reached":true}') }) });
  assert.equal(cached.response.status, 200);
  assert.equal(cached.body.cached, true);
});

test('a person past their AI calls, or their look requests, draws nothing', async () => {
  const pastAi = await run({ refuse: ['ai'] });
  assert.equal(pastAi.response.status, 429);
  assert.deepEqual(pastAi.body, { error: 'Rate limit exceeded.' });
  assert.equal(pastAi.upstream.pictureCalls().length, 0);
  // The session's count is untouched by someone who has none of their own left.
  assert.ok(!routesCounted(pastAi.counted).includes('analysis-card-picture-session'));

  const pastLooks = await run({ refuse: ['analysis-card-look'] });
  assert.equal(pastLooks.response.status, 429);
  assert.equal(pastLooks.upstream.calls.length, 0);
  assert.deepEqual(routesCounted(pastLooks.counted), ['analysis-card-look']);
});

test('the looks already used are remembered, newest first, and given to the next look request', async () => {
  const kv = createKv();
  await run({ kv });
  const looksKey = 'session:salon:analysis-card-picture:v1:looks';
  assert.deepEqual(JSON.parse(kv.rows.get(looksKey)), [{ style: LOOK.style, ground: 'cream' }]);

  const turing = {
    ...LOOK,
    name: 'Alan Turing',
    died: 1954,
    style: 'A two-colour linocut on grey card, in black, bottle green and chalk white.',
    ground: 'chalk white',
  };
  const upstream = createUpstream({ look: turing });
  const second = await run({ figure: 'Alan Turing (1912–1954)', kv, upstream });
  assert.equal(second.response.status, 200);
  const prompt = lookPromptOf(upstream.lookCalls()[0]);
  assert.ok(prompt.includes(`- ${LOOK.style} (ground: cream)`));
  assert.deepEqual(JSON.parse(kv.rows.get(looksKey)), [
    { style: turing.style, ground: 'chalk white' },
    { style: LOOK.style, ground: 'cream' },
  ]);

  kv.rows.set(looksKey, JSON.stringify(Array.from({ length: 20 }, (_, index) => ({ style: `A style ${index}.`, ground: 'grey' }))));
  await run({ figure: 'Ada Lovelace (1815–1852)', kv, upstream: createUpstream({ look: { ...LOOK, name: 'Ada Lovelace', died: 1852 } }) });
  assert.equal(JSON.parse(kv.rows.get(looksKey)).length, ANALYSIS_CARD_LOOKS_REMEMBERED);
});

test('a Worker without the storage binding, or with one that fails, still draws', async () => {
  const unbound = await run({ env: {} });
  assert.equal(unbound.response.status, 200);
  assert.equal(unbound.body.cached, false);

  const failing = {
    get: async () => { throw new Error('kv down'); },
    put: async () => { throw new Error('kv down'); },
  };
  const broken = await run({ env: { GROUP_KV: failing } });
  assert.equal(broken.response.status, 200);
  assert.equal(broken.body.image.base64, IMAGE);
});

test('who may ask is the signed-in AI route\'s rule', async () => {
  const noScope = await run({ scopes: { ai: false } });
  assert.equal(noScope.response.status, 403);
  assert.deepEqual(noScope.body, { error: 'Token missing ai scope.' });
  assert.equal(noScope.upstream.calls.length, 0);

  const ended = await run({ config: { sessionEndsAt: '2026-11-16T00:00:00Z' } });
  assert.equal(ended.response.status, 410);
  assert.equal(ended.body.code, 'session_ended');
  assert.equal(ended.upstream.calls.length, 0);
});

test('the signed-in dispatcher answers the path itself, whatever action the body names', async () => {
  const result = await dispatchAuthenticatedSecretActionRoute({
    path: ANALYSIS_CARD_PICTURE_PATH,
    action: 'ai',
    body: { action: 'ai', figure: 'not a figure', prompt: 'ping' },
    config: { analysisCardEnabled: true },
    slug: 'salon',
    address: '0xabc',
    env: {},
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
  assert.equal(result.handled, true);
  assert.equal(result.response.status, 400);
  assert.deepEqual(await result.response.json(), { error: 'invalid_figure' });
});

test('the picture is off unless the session has the card on: off, nothing is counted, read, stored or asked', async () => {
  const drawn = await run({ config: { analysisCardEnabled: true } });
  assert.equal(drawn.response.status, 200);
  const { kv } = drawn;
  const rows = [...kv.rows.entries()];
  kv.gets.length = 0;
  kv.puts.length = 0;
  // A picture already drawn is not given either. Off is a saved `false` or, as in every session from before the
  // card, a switch that was never saved.
  for (const config of [{ analysisCardEnabled: false }, { unsaved: true }, { unsaved: true, sessionName: 'Older' }]) {
    const off = await run({ config, kv });
    assert.equal(off.response.status, 403);
    assert.deepEqual(off.body, { error: 'analysis_card_off' });
    assert.equal(off.response.headers.get('cache-control'), 'no-store');
    assert.equal(off.upstream.calls.length, 0);
    assert.deepEqual(off.counted, []);
  }
  assert.deepEqual([kv.gets.length, kv.puts.length], [0, 0]);
  assert.deepEqual([...kv.rows.entries()], rows);
});
