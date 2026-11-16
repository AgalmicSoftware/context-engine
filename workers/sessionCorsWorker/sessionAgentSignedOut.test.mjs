import test from 'node:test';
import assert from 'node:assert/strict';

import { SESSION_AGENT_SIGNED_OUT } from './sessionAgentRoute.js';
import { dispatchSignedOutSessionAgentRequest } from './sessionAgentSignedOut.js';

const WORKER_RUN = {
  slug: 'salon',
  sessionModeProfile: { authority: { mode: 'worker_canonical' } },
  workerAuthority: { version: 1, participantScopes: ['ai', 'storage'] },
};
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });

// The dispatcher's own steps, with the route itself stood in for: what reaches it, and what never does.
const send = async ({
  url = 'https://worker.example/session-agent/ask?slug=salon', body = '{"question":"Why?"}', headers = {}, config = WORKER_RUN,
  cors = { ok: true, headers: { 'Access-Control-Allow-Origin': 'https://app.example' } }, deps = {},
} = {}) => {
  const reached = [];
  const identified = [];
  const response = await dispatchSignedOutSessionAgentRequest({
    request: new Request(url, { method: 'POST', headers, body }),
    env: {},
    path: '/session-agent/ask',
    baseHeaders: {},
    constants: { missingSlugError: 'Name the session.', sessionConfigNotFoundError: 'No such session.' },
    deps: {
      json,
      resolveRequestSlugWithoutToken: ({ request }) => {
        const slug = request.headers.get('x-session-slug');
        return slug ? { ok: true, slug, explicitSlugProvided: true } : { ok: false, error: 'Name the session.' };
      },
      readCurrentSessionConfig: async ({ slug }) => ({ config: slug === 'salon' ? config : null }),
      getCorsContext: async () => cors,
      // The Worker's own reading of who is calling, never a value the request body carries.
      resolveAnonymousRateIdentity: (request) => { identified.push(request.headers.get('cf-connecting-ip')); return 'anon:203.0.113.9'; },
      dispatchSessionAgentRoute: async (args) => { reached.push(args); return json({ answer: 'An answer.' }, 200, args.headers); },
      ...deps,
    },
  });
  return { status: response.status, body: await response.json(), response, reached, identified };
};

test('a signed-out question reaches the route with no address, a first sign-in’s scopes and the caller’s network', async () => {
  const sent = await send({ headers: { 'cf-connecting-ip': '203.0.113.9' }, body: '{"question":"Why?","address":"0xabc","identity":"anon:someone-else"}' });
  assert.equal(sent.status, 200);
  const [args] = sent.reached;
  assert.deepEqual([args.path, args.slug, args.address], ['/session-agent/ask', 'salon', '']);
  assert.deepEqual(args.scopes, { ai: true, storage: true });
  // Counted by what the Worker itself says the network is, whatever the body claims.
  assert.deepEqual(args.signedOut, { identity: 'anon:203.0.113.9' });
  assert.deepEqual(sent.identified, ['203.0.113.9']);
  assert.equal(sent.response.headers.get('Access-Control-Allow-Origin'), 'https://app.example');
});

test('a session that lets only some people sign in gives a visitor no scopes, so the route asks for a sign-in', async () => {
  const gated = { ...WORKER_RUN, workerAuthority: { ...WORKER_RUN.workerAuthority, loginGate: { match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }] } } };
  assert.deepEqual((await send({ config: gated })).reached[0].scopes, {});
  // A session its Worker doesn't run has no sign-in rule of the Worker's to pass.
  assert.deepEqual((await send({ config: { slug: 'salon' } })).reached[0].scopes, {});
  // The session's own switch for AI narrows what a first sign-in is given.
  assert.deepEqual((await send({ config: { ...WORKER_RUN, scopes: { ai: false } } })).reached[0].scopes, { ai: false, storage: true });
});

test('a page the session doesn’t allow, an unnamed or unknown session, and an oversized or malformed body never reach the route', async () => {
  const refusedOrigin = new Response(JSON.stringify({ error: 'Origin not allowed.' }), { status: 403 });
  const blocked = await send({ cors: { ok: false, response: refusedOrigin } });
  assert.deepEqual([blocked.status, blocked.reached.length, blocked.identified.length], [403, 0, 0]);

  for (const [label, options, status] of [
    ['no session named', { url: 'https://worker.example/session-agent/ask' }, 400],
    ['a session the Worker doesn’t hold', { url: 'https://worker.example/session-agent/ask?slug=other' }, 404],
    ['a body over the limit', { body: JSON.stringify({ question: 'x'.repeat(SESSION_AGENT_SIGNED_OUT.bodyBytes) }) }, 400],
    ['a body that isn’t JSON', { body: 'question=Why' }, 400],
    ['a body that isn’t an object', { body: '["Why?"]' }, 400],
  ]) {
    const refused = await send(options);
    assert.deepEqual([refused.status, refused.reached.length], [status, 0], label);
  }
  // The session named in the header must be the one in the query.
  const mismatch = await send({ headers: { 'x-session-slug': 'salon' }, url: 'https://worker.example/session-agent/ask?slug=other' });
  assert.deepEqual([mismatch.status, mismatch.reached.length], [404, 0]);
  // An empty body is an empty object, as status sends.
  assert.deepEqual((await send({ body: '' })).reached[0].body, {});
});
