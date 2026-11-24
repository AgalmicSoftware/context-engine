import test from 'node:test';
import assert from 'node:assert/strict';

import { answerAiCall, keepAliveAiResponse } from './aiKeepAlive.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';
import { dispatchAnonymousRoute } from './anonymousRouteDispatch.js';

const CORS = { 'Access-Control-Allow-Origin': 'https://site.example' };
const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

// Reads a streamed body as it arrives: what had come by the time `settle` resolves, and all of it.
const readAll = async (response, settle) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let early = null;
  void settle?.then(() => { early = text; });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return { text, early };
};

test('answers as before when the caller does not ask to be kept busy', async () => {
  const reply = jsonResponse({ completion: 'hi' });
  assert.equal(await answerAiCall({ prompt: 'x' }, async () => reply, CORS), reply);
  assert.equal(await answerAiCall({ prompt: 'x', keepAlive: 'yes' }, async () => reply, CORS), reply);
});

test('answers at once with a 200 and spaces, then the reply, which still parses as before', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const response = keepAliveAiResponse(() => pending, CORS, { intervalMs: 5 });
  // The status and headers are there before the provider has answered.
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://site.example');
  // Uncompressed, so no compressor on the way holds the spaces back.
  assert.equal(response.headers.get('Cache-Control'), 'no-store, no-transform');
  const waited = new Promise((resolve) => setTimeout(resolve, 40));
  const reading = readAll(response, waited);
  await waited;
  finish(jsonResponse({ completion: 'the analysis', raw: { model: 'gpt-x' } }));
  const { text, early } = await reading;
  assert.match(early, /^ {3,}$/, 'several spaces while the provider worked');
  assert.match(text, /^ +\{/);
  assert.deepEqual(JSON.parse(text), { completion: 'the analysis', raw: { model: 'gpt-x' } });
});

test("tells a provider's refusal in the body, with its status and wait", async () => {
  const response = keepAliveAiResponse(
    async () => jsonResponse({ error: 'Rate limit reached', details: { code: 'rate_limit' } }, 429, { 'retry-after': '3' }),
    CORS,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    error: 'Rate limit reached',
    details: { code: 'rate_limit' },
    status: 429,
    retryAfter: '3',
  });
});

test('tells a failure with no readable reply, or a call that threw, as an error', async (t) => {
  const unreadable = keepAliveAiResponse(async () => new Response('<html>bad gateway</html>', { status: 502 }), CORS);
  assert.deepEqual(await unreadable.json(), { error: 'AI request failed', status: 502 });
  // A call that threw is logged and its message passed on, as the route did before.
  const logged = t.mock.method(console, 'error', () => {});
  const thrown = keepAliveAiResponse(async () => { throw new Error('socket hang up'); }, CORS);
  assert.deepEqual(await thrown.json(), { error: 'socket hang up', status: 500 });
  assert.deepEqual(logged.mock.calls.map((call) => call.arguments), [['[ai] provider call failed', 'socket hang up']]);
  const silent = keepAliveAiResponse(async () => { throw new Error(''); }, CORS);
  assert.deepEqual(await silent.json(), { error: 'AI request failed', status: 500 });
});

const secrets = { openaiKey: 'test-key' };
const authenticatedAi = (overrides = {}) => dispatchAuthenticatedSecretActionRoute({
  path: '/ai',
  action: '',
  config: { ai: { model: 'gpt-5' } },
  body: { prompt: 'ping', keepAlive: true },
  slug: 'session-a',
  address: '0xabc',
  env: { GROUP_KV: {} },
  limit: 3,
  headers: CORS,
  scopes: { ai: true },
  deps: {
    evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
    resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets }),
    normalizeAiRequestPayload: ({ payload }) => ({ payload, provider: 'openai' }),
    proxyOpenAI: async () => jsonResponse({ completion: 'pong' }),
    json: (data, status, headers) => jsonResponse(data, status, Object.fromEntries(new Headers(headers))),
    ...overrides,
  },
});

test('a signed-in AI request that asks is kept busy; refusals before the provider keep their status', async () => {
  const kept = await authenticatedAi();
  assert.equal(kept.handled, true);
  assert.equal(kept.response.status, 200);
  assert.match(await kept.response.clone().text(), /^ +\{/);
  assert.deepEqual(await kept.response.json(), { completion: 'pong' });

  const refused = await authenticatedAi({
    evaluateAuthenticatedRoutePreflight: async () => ({ ok: false, response: jsonResponse({ error: 'Sign in again.' }, 401) }),
  });
  assert.equal(refused.response.status, 401);
  assert.deepEqual(await refused.response.json(), { error: 'Sign in again.' });
});

test('a signed-out AI request that asks is kept busy too', async () => {
  const request = new Request('https://worker.example/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'ping', keepAlive: true }),
  });
  const response = await dispatchAnonymousRoute({
    path: '/ai',
    request,
    anonymousContext: { slug: 'session-a', config: { scopes: { ai: true } }, headers: CORS },
    deps: {
      readAiRequestPayload: async ({ request: copy }) => ({ ok: true, payload: await copy.json(), provider: 'openai' }),
      evaluateAnonymousRouteAccess: async () => ({ ok: true, reason: 'public' }),
      validateAnonymousAiRequest: () => ({ ok: true }),
      getSessionSecrets: async () => secrets,
      proxyOpenAI: async () => jsonResponse({ error: 'Incorrect API key' }, 401),
      json: (data, status) => jsonResponse(data, status),
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { error: 'Incorrect API key', status: 401 });
});
