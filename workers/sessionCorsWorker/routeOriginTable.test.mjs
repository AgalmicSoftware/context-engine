import assert from 'node:assert/strict';
import test from 'node:test';
import { Wallet } from 'ethers';

import { APP_ORIGIN, SESSION_ID, SLUG, WORKER_ORIGIN, createSessionEnv, fetchWorker, login } from './sessionWorkerRuntimeFixture.mjs';

// A session's Worker answers browsers only from the origins the session lists. Each route applies that rule
// itself, so each is asked here through the Worker's real entry: from an origin the session does not list
// (a local dev server, as when a locally served site opens a real session), and from one it does.

const LOCAL = 'http://localhost:3000';
const query = `sessionSlug=${SLUG}&sessionId=${SESSION_ID}`;
const groupConfig = {
  workerGroupsBootstrap: { version: 2, state: 'fresh_empty', bootstrapId: 'b0'.repeat(32) },
  groupCreationPolicy: 'participants',
  workerAuthority: { version: 1, participantScopes: ['ai', 'transcribe', 'storage', 'groups', 'fetch'], anonymousScopes: ['ai'] },
};

// Every route a browser on the session page calls, with a body that passes the origin rule's later checks or not:
// the origin rule comes first, so the reply to an unlisted origin does not depend on it.
const ROUTES = [
  ['GET', '/resource-presence'],
  ['GET', '/storage/list?resource=responses&limit=100'],
  ['GET', '/storage/read?id=cf:none'],
  ['POST', '/storage/read-batch', { ids: ['cf:none'] }],
  ['POST', '/storage/upload', { data: '{}', contentType: 'application/json', resource: 'responses' }],
  ['GET', `/groups/list?${query}`],
  ['GET', `/groups/my-memberships?${query}`],
  ['POST', '/groups/create', { sessionId: SESSION_ID, group: { label: 'Listed' } }],
  ['POST', '/groups/join', { sessionId: SESSION_ID, groupId: 'none' }],
  ['POST', '/feedback', { text: 'A note.' }],
  ['POST', '/interview/starter', {}],
  ['GET', `/agent/interview-catalog?${query}`],
  ['GET', `/debate-atlas?${query}`],
  ['GET', `/risk-matrix?${query}`],
  ['GET', `/results-analysis/artifact?${query}`],
  ['POST', '/session-agent/ask', { question: 'What do people agree on?' }],
  ['POST', '/ai', { messages: [] }],
  ['POST', '/transcribe', {}],
  ['POST', '/realtime/call', {}],
  ['POST', '/auth/nonce', { address: '0x00000000000000000000000000000000000000aa', sessionSlug: SLUG, sessionId: SESSION_ID }],
  ['GET', `/api/agent/questions?${query}`],
  ['GET', `/api/agent/results?${query}`],
];

const ask = (env, [method, path, body], { origin, token = '' }) => {
  const headers = new Headers({ Origin: origin, 'X-Group-Slug': SLUG });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return fetchWorker(new Request(`${WORKER_ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
};

const name = ([method, path]) => `${method} ${path.split('?')[0]}`;

test('every session route refuses a signed-in browser on an origin the session does not list', async () => {
  const { env } = createSessionEnv({ configOverrides: groupConfig });
  const token = await login({ env, wallet: Wallet.createRandom() });
  const letIn = [];
  for (const route of ROUTES) {
    const response = await ask(env, route, { origin: LOCAL, token });
    const allowed = response.headers.get('access-control-allow-origin');
    if (response.status !== 403 || allowed) letIn.push(`${name(route)}: ${response.status}, allow-origin ${allowed || 'none'}`);
  }
  assert.deepEqual(letIn, []);
});

// These four ask for a sign-in before they look at the origin, and send that 401 readable by any origin. It
// carries no session data. If they come to check the origin first, take them off this list.
const SIGN_IN_ASKED_FIRST = ['POST /storage/upload', 'GET /groups/my-memberships', 'POST /groups/create', 'POST /groups/join'];

test('signed out, an unlisted origin gets a refusal from every route and session data from none', async () => {
  const { env } = createSessionEnv({ configOverrides: groupConfig });
  const readable = [];
  for (const route of ROUTES) {
    const response = await ask(env, route, { origin: LOCAL });
    assert.ok([401, 403].includes(response.status), `${name(route)} answered ${response.status}`);
    if (response.headers.get('access-control-allow-origin')) {
      assert.equal(response.status, 401, `${name(route)} lets an unlisted origin read more than a sign-in refusal`);
      assert.deepEqual(Object.keys(await response.json()), ['error'], `${name(route)} sends more than an error`);
      readable.push(name(route));
    }
  }
  assert.deepEqual(readable, SIGN_IN_ASKED_FIRST);
});

test('the same routes answer the origin the session lists, and say so to the browser', async () => {
  const { env } = createSessionEnv({ configOverrides: groupConfig });
  const token = await login({ env, wallet: Wallet.createRandom() });
  const unanswered = [];
  for (const route of ROUTES) {
    const response = await ask(env, route, { origin: APP_ORIGIN, token });
    if (response.headers.get('access-control-allow-origin') !== APP_ORIGIN || response.status >= 500) {
      unanswered.push(`${route[0]} ${route[1].split('?')[0]}: ${response.status}, allow-origin ${response.headers.get('access-control-allow-origin') || 'none'}`);
    }
  }
  assert.deepEqual(unanswered, []);
});

test('a session that lists a local dev server answers it: sign-in and the answer list', async () => {
  const { env } = createSessionEnv({ configOverrides: { ...groupConfig, allowOrigins: [APP_ORIGIN, LOCAL] } });
  const nonce = await ask(env, ['POST', '/auth/nonce', { address: Wallet.createRandom().address, sessionSlug: SLUG, sessionId: SESSION_ID }], { origin: LOCAL });
  assert.equal(nonce.status, 200);
  assert.equal(nonce.headers.get('access-control-allow-origin'), LOCAL);
  const token = await login({ env, wallet: Wallet.createRandom() });
  const list = await ask(env, ['GET', '/storage/list?resource=responses&limit=100'], { origin: LOCAL, token });
  assert.equal(list.status, 200);
  assert.equal(list.headers.get('access-control-allow-origin'), LOCAL);
});
