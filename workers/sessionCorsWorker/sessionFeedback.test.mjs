// The Feedback box: anyone on the session page sends, the session's full admins
// read, download and delete, and nothing else in the session ever reads it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { Wallet } from 'ethers';

import { SESSION_FEEDBACK_LIMITS, dispatchSessionFeedbackStore } from './sessionFeedback.js';
import { FEEDBACK_LIMITS, dispatchAnonymousFeedbackRequest, sendSessionFeedback } from './sessionFeedbackRoute.js';
import { createDurableStorage } from './workerGroupTestFixture.mjs';
import { resolveTopLevelRouteSelection } from './topLevelRouteSelection.js';
import { FEATURES } from './workerCapabilities.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';
import { dispatchAdminRequest } from './adminRequestDispatch.js';
import { dispatchAdminResultsAnalysisStatusRequest } from './adminResultsAnalysisDispatch.js';
import { applySessionConfigMutation } from './sessionConfigMutation.js';
import { sessionConfigRequiresReauthorization } from '../../shared/sessionConfigEdits.mjs';
import { projectPublicWorkerSessionConfig } from '../shared/workerSessionConfig.mjs';
import { SLUG, createSessionEnv, fetchWorker, login, makeRequest, readJson, signedAdminRequest } from './sessionWorkerRuntimeFixture.mjs';

const ADDRESS = `0x${'ab'.repeat(20)}`;
const WORKER_RUN = { sessionModeProfile: { authority: { mode: 'worker_canonical' } } };
const SEND = { text: 'The atlas was hard to find.', view: 'results:debateAtlas', theme: 'civic', screen: 'phone', appRelease: '0.9.8' };

// The session coordinator as the routes reach it, with a clock the test moves.
const createStore = () => {
  const { storage, store } = createDurableStorage();
  const coordinator = { state: { storage }, nowMs: Date.parse('2026-11-20T12:00:00.000Z') };
  coordinator.now = () => coordinator.nowMs;
  const call = async (_env, _slug, operation, payload = {}) => {
    const response = await dispatchSessionFeedbackStore(coordinator, operation, payload);
    const body = await response.json();
    return { ok: response.ok && body.ok === true, status: response.status, body };
  };
  return { coordinator, call, store };
};
// Five a day per sender, as the Worker's exact daily counter keeps it.
const createDailyLimit = () => {
  const counts = new Map();
  const calls = [];
  const checkRateLimit = async (args) => {
    calls.push(args);
    const key = `${args.route}:${args.address}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts.get(key) <= args.limit;
  };
  return { checkRateLimit, calls };
};
// Each send a millisecond after the last, so newest-first order is fixed.
const sender = ({ call, coordinator }, { checkRateLimit } = createDailyLimit()) =>
  (body, { address = '', identity = address || 'anon:203.0.113.9', config = {}, release = '0.9.8' } = {}) => {
    coordinator.nowMs += 1;
    return sendSessionFeedback({ env: {}, slug: 'salon', config: { ...WORKER_RUN, ...config }, body, address, identity, checkRateLimit, release, store: call });
  };

test('a signed-in and a signed-out person each send, and only the Worker stamps its release', async () => {
  const feedback = createStore();
  const send = sender(feedback);
  assert.deepEqual(await send({ ...SEND, workerRelease: '9.9.9', signedIn: true, createdAt: 'yesterday' }, { address: ADDRESS }),
    { status: 200, body: { ok: true } });
  assert.deepEqual(await send({ ...SEND, appRelease: undefined }), { status: 200, body: { ok: true } });
  const { messages, counts } = (await feedback.call({}, 'salon', 'list')).body;
  assert.deepEqual(counts, { stored: 2, today: 2 });
  const [signedOut, signedIn] = messages;
  assert.equal(signedIn.workerRelease, '0.9.8');
  assert.equal(signedIn.signedIn, true);
  assert.equal(signedIn.createdAt, '2026-11-20T12:00:00.001Z');
  assert.equal(signedOut.signedIn, false);
  assert.equal('appRelease' in signedOut, false);
  // Nothing stored names the sender, signed in or not.
  assert.ok(!JSON.stringify(messages).includes(ADDRESS.slice(2)));
});

test('a contact field sent with feedback is dropped, never stored', async () => {
  const feedback = createStore();
  const send = sender(feedback);
  assert.equal((await send({ ...SEND, contact: { reachMe: 'sam on Signal', displayName: 'Sam' } }, { address: ADDRESS })).status, 200);
  assert.equal((await send({ ...SEND, contact: { reachMe: '@sam' } })).status, 200);
  assert.equal((await send({ ...SEND, contact: 'not an object' })).status, 200);
  const { messages } = (await feedback.call({}, 'salon', 'list')).body;
  assert.equal(messages.length, 3);
  // A stored message holds only these fields; none of them says who sent it.
  const kept = ['appRelease', 'createdAt', 'id', 'screen', 'signedIn', 'text', 'theme', 'view', 'workerRelease'];
  for (const message of messages) assert.deepEqual(Object.keys(message).sort(), kept);
  assert.ok(!/sam|Signal|not an object/.test(JSON.stringify(messages)));
  assert.ok(!JSON.stringify(messages).includes(ADDRESS.slice(2)));
});

test('a sixth send in a day is refused, counted per address signed in and per network signed out', async () => {
  const feedback = createStore();
  const limit = createDailyLimit();
  const send = sender(feedback, limit);
  for (let index = 0; index < 5; index += 1) assert.equal((await send(SEND, { address: ADDRESS })).status, 200);
  assert.deepEqual(await send(SEND, { address: ADDRESS }),
    { status: 429, body: { error: 'You’ve sent 5 today. Thanks! Try again tomorrow.', reason: 'feedback_person_limit' } });
  assert.equal((await send(SEND)).status, 200);
  assert.deepEqual(limit.calls.at(-1), { env: {}, slug: 'salon', address: 'anon:203.0.113.9', limit: 5, route: 'feedback' });
  assert.equal(limit.calls[0].address, ADDRESS);
  assert.equal((await feedback.call({}, 'salon', 'list')).body.counts.stored, 6);
});

test('wrong or oversized sends say which field, and nothing is stored', async () => {
  const feedback = createStore();
  const send = sender(feedback);
  const cases = [
    [null, /JSON object/],
    [{ ...SEND, text: '   ' }, /Write some feedback/],
    [{ ...SEND, text: 'x'.repeat(FEEDBACK_LIMITS.textChars + 1) }, /at most 2000/],
    [{ ...SEND, view: 'https://example.org/s/salon?group=g1#groupInvite=x' }, /view/],
    [{ ...SEND, view: 'results?x' }, /view/],
    [{ ...SEND, theme: 'Civic Theme' }, /theme/],
    [{ ...SEND, screen: 'watch' }, /screen/],
    [{ ...SEND, appRelease: 'latest' }, /appRelease/],
    [{ ...SEND, padding: 'p'.repeat(FEEDBACK_LIMITS.bodyBytes) }, /too long/],
  ];
  for (const [body, error] of cases) {
    const result = await send(body);
    assert.equal(result.status, 400, JSON.stringify(body)?.slice(0, 60));
    assert.equal(result.body.reason, 'feedback_invalid');
    assert.match(result.body.error, error);
  }
  assert.equal((await send({ ...SEND, text: 'x'.repeat(FEEDBACK_LIMITS.textChars) })).status, 200);
  assert.equal((await feedback.call({}, 'salon', 'list')).body.counts.stored, 1);
});

test('a session with the Feedback box off, or run on chain, refuses sends', async () => {
  const feedback = createStore();
  const off = { status: 403, body: { error: 'This session isn’t taking feedback.', reason: 'feedback_off' } };
  assert.deepEqual(await sender(feedback)(SEND, { config: { feedbackEnabled: false } }), off);
  // On chain, Settings has no Feedback panel, so no admin could read or stop it.
  const onChain = { sessionModeProfile: { authority: { mode: 'onchain_registry' } } };
  assert.deepEqual(await sender(feedback)(SEND, { config: onChain }), off);
  assert.equal((await feedback.call({}, 'salon', 'list')).body.messages.length, 0);
  assert.equal((await sender(feedback)(SEND, { config: { feedbackEnabled: true } })).status, 200);
});

test('the Feedback box setting is a true-or-false content field that public reads carry', () => {
  const config = { slug: 'salon', sessionId: `0x${'3'.repeat(32)}`, adminAddress: ADDRESS };
  const save = (feedbackEnabled) =>
    applySessionConfigMutation({ existingConfig: config, slug: 'salon', mutation: { kind: 'set-config', incomingConfig: { ...config, feedbackEnabled } } });
  assert.equal(save(false).ok, true, JSON.stringify(save(false)));
  assert.deepEqual([save('no').ok, save('no').status, save('no').error], [false, 400, 'feedbackEnabled must be true or false.']);
  // Turning it off or on signs no one out.
  assert.equal(sessionConfigRequiresReauthorization({ ...config, feedbackEnabled: true }, { ...config, feedbackEnabled: false }), false);
  assert.equal(projectPublicWorkerSessionConfig({ ...config, feedbackEnabled: false }).feedbackEnabled, false);
});

test('twenty sends at once never pass the session’s daily or stored caps', async () => {
  const daily = createStore();
  const sendDaily = sender(daily, { checkRateLimit: async () => true });
  for (let index = 0; index < SESSION_FEEDBACK_LIMITS.perSessionPerDay - 10; index += 1) await sendDaily(SEND);
  const raced = await Promise.all(Array.from({ length: 20 }, () => sendDaily(SEND)));
  assert.equal(raced.filter((result) => result.status === 200).length, 10);
  assert.ok(raced.filter((result) => result.status !== 200)
    .every((result) => result.status === 429 && result.body.reason === 'feedback_session_limit' && result.body.error === 'Feedback is closed for today.'));
  // The next day opens again.
  daily.coordinator.nowMs += 24 * 60 * 60 * 1000;
  assert.equal((await sendDaily(SEND)).status, 200);

  const full = createStore();
  const sendFull = sender(full, { checkRateLimit: async () => true });
  for (let day = 0; day < SESSION_FEEDBACK_LIMITS.stored / SESSION_FEEDBACK_LIMITS.perSessionPerDay; day += 1) {
    for (let index = 0; index < SESSION_FEEDBACK_LIMITS.perSessionPerDay - (day === 9 ? 10 : 0); index += 1) await sendFull(SEND);
    if (day < 9) full.coordinator.nowMs += 24 * 60 * 60 * 1000;
  }
  const last = await Promise.all(Array.from({ length: 20 }, () => sendFull(SEND)));
  assert.equal(last.filter((result) => result.status === 200).length, 10);
  assert.deepEqual(last.find((result) => result.status !== 200),
    { status: 409, body: { error: 'Feedback is full; an admin can clear old messages.', reason: 'feedback_full' } });
  assert.equal((await full.call({}, 'salon', 'list', { limit: 1 })).body.counts.stored, SESSION_FEEDBACK_LIMITS.stored);
});

test('admins page newest first, delete some or all, and counts stay true', async () => {
  const feedback = createStore();
  const send = sender(feedback, { checkRateLimit: async () => true });
  for (let index = 0; index < 5; index += 1) {
    await send({ ...SEND, text: `note ${index}` });
    feedback.coordinator.nowMs += 1000;
  }
  const first = (await feedback.call({}, 'salon', 'list', { limit: 2 })).body;
  assert.deepEqual(first.messages.map((message) => message.text), ['note 4', 'note 3']);
  const second = (await feedback.call({}, 'salon', 'list', { limit: 2, cursor: first.cursor })).body;
  const third = (await feedback.call({}, 'salon', 'list', { limit: 2, cursor: second.cursor })).body;
  assert.deepEqual([...second.messages, ...third.messages].map((message) => message.text), ['note 2', 'note 1', 'note 0']);
  assert.equal(third.cursor, undefined);
  for (const payload of [{ limit: 0 }, { limit: 101 }, { cursor: 'not-an-id' }]) {
    assert.equal((await feedback.call({}, 'salon', 'list', payload)).status, 400);
  }

  const one = (await feedback.call({}, 'salon', 'delete', { ids: [first.messages[0].id, first.messages[0].id] })).body;
  assert.deepEqual([one.deleted, one.counts.stored], [1, 4]);
  assert.equal((await feedback.call({}, 'salon', 'delete', { ids: [first.messages[0].id] })).body.deleted, 0);
  for (const payload of [{}, { ids: [] }, { ids: ['nope'] }, { all: true }, { through: 'nope' }, { ids: [first.messages[1].id], through: first.messages[1].id }]) {
    assert.equal((await feedback.call({}, 'salon', 'delete', payload)).status, 400, JSON.stringify(payload));
  }
  // Through an id: that message and every older one.
  const older = (await feedback.call({}, 'salon', 'delete', { through: second.messages[0].id })).body;
  assert.deepEqual([older.deleted, older.counts.stored], [3, 1]);
  assert.deepEqual((await feedback.call({}, 'salon', 'list')).body.messages.map((message) => message.text), ['note 3']);
  const all = (await feedback.call({}, 'salon', 'delete', { through: first.messages[1].id })).body;
  assert.deepEqual([all.deleted, all.counts], [1, { stored: 0, today: 5 }]);
  assert.equal([...feedback.store.keys()].filter((key) => key.startsWith('session-feedback-v1:')).length, 0);
});

test('ids sort in the order messages are stored, so deleting through the newest read spares later ones', async () => {
  const feedback = createStore();
  const add = (text) => feedback.call({}, 'salon', 'add', { record: { text } });
  // Three in the same millisecond, then one from a clock that went back.
  for (const text of ['a', 'b', 'c']) assert.equal((await add(text)).ok, true);
  const read = (await feedback.call({}, 'salon', 'list')).body.messages;
  assert.deepEqual(read.map((message) => message.text), ['c', 'b', 'a']);
  feedback.coordinator.nowMs -= 60_000;
  assert.equal((await add('arrived after reading')).ok, true);
  const cleared = (await feedback.call({}, 'salon', 'delete', { through: read[0].id })).body;
  assert.deepEqual([cleared.deleted, cleared.counts.stored], [3, 1]);
  assert.deepEqual((await feedback.call({}, 'salon', 'list')).body.messages.map((message) => message.text), ['arrived after reading']);
});

test('clearing all finishes even when another admin clears a batch first', async () => {
  const feedback = createStore();
  for (let index = 0; index < 130; index += 1) {
    feedback.coordinator.nowMs += 1;
    assert.equal((await feedback.call({}, 'salon', 'add', { record: { text: `note ${index}` } })).ok, true);
  }
  // The other admin deletes the first batch this clear lists, just after it lists it.
  const { storage } = feedback.coordinator.state;
  const list = storage.list.bind(storage);
  let raced = false;
  storage.list = async (options) => {
    const page = await list(options);
    if (!raced && options?.limit === 128) {
      raced = true;
      const ids = [...page.keys()].map((key) => key.slice('session-feedback-v1:'.length));
      for (const part of [ids.slice(0, 100), ids.slice(100)]) await dispatchSessionFeedbackStore(feedback.coordinator, 'delete', { ids: part });
    }
    return page;
  };
  const [newest] = (await feedback.call({}, 'salon', 'list', { limit: 1 })).body.messages;
  const all = (await feedback.call({}, 'salon', 'delete', { through: newest.id })).body;
  assert.deepEqual([all.deleted, all.counts.stored], [2, 0]);
  assert.equal([...feedback.store.keys()].filter((key) => key.startsWith('session-feedback-v1:')).length, 0);
});

test('the Worker lists the feature, routes a signed-out send to its own handler and a signed-in one to the session', async () => {
  assert.ok(FEATURES.includes('session_feedback'));
  const request = (authorization) => new Request('https://worker.example/feedback', {
    method: 'POST', headers: authorization ? { authorization } : {},
  });
  const deps = { toStr: (value) => String(value ?? '') };
  assert.deepEqual(resolveTopLevelRouteSelection({ path: '/feedback', method: 'POST', request: request(), deps }), { kind: 'feedback' });
  assert.deepEqual(resolveTopLevelRouteSelection({ path: '/feedback', method: 'POST', request: request('Bearer t'), deps }),
    { kind: 'authenticated' });
  // Admins read with the sign-in token, so paging spends no sign-in nonces.
  assert.deepEqual(resolveTopLevelRouteSelection({ path: '/admin/feedback', method: 'GET', request: request('Bearer t'), deps }),
    { kind: 'admin-feedback-list' });

  // Signed in, the sender is the signed-in address, counted as such.
  const limit = createDailyLimit();
  const signedIn = await dispatchAuthenticatedSecretActionRoute({
    path: '/feedback', body: { ...SEND, text: 'no-store-call' }, config: { feedbackEnabled: false }, slug: 'salon', address: ADDRESS, env: {},
    headers: {}, deps: { json: (payload, status) => ({ status, payload }), checkRateLimit: limit.checkRateLimit },
  });
  assert.deepEqual([signedIn.handled, signedIn.response.status, signedIn.response.payload.reason], [true, 403, 'feedback_off']);

  // Signed out, the session comes from ?slug= and the limit counts the network.
  const anonymous = (body, slug = 'salon') => dispatchAnonymousFeedbackRequest({
    request: new Request(`https://worker.example/feedback${slug ? `?slug=${slug}` : ''}`, { method: 'POST', body }),
    env: {},
    baseHeaders: {},
    deps: {
      resolveRequestSlugWithoutToken: () => (slug ? { ok: true, slug, explicitSlugProvided: true } : { ok: true, explicitSlugProvided: false }),
      readCurrentSessionConfig: async () => ({ config: { slug, feedbackEnabled: false } }),
      getCorsContext: async () => ({ ok: true, headers: { 'x-cors': '1' } }),
      resolveAnonymousRateIdentity: () => 'anon:203.0.113.9',
      checkRateLimit: limit.checkRateLimit,
      json: (payload, status, headers) => ({ status, payload, headers }),
    },
    constants: { missingSlugError: 'Name the session.' },
  });
  assert.deepEqual((await anonymous(JSON.stringify(SEND), '')).payload, { error: 'Name the session.' });
  const off = await anonymous(JSON.stringify(SEND));
  assert.deepEqual([off.status, off.payload.reason, off.headers['x-cors']], [403, 'feedback_off', '1']);
  const huge = await anonymous(JSON.stringify({ ...SEND, text: 'x'.repeat(FEEDBACK_LIMITS.bodyBytes) }));
  assert.deepEqual([huge.status, huge.payload.reason], [400, 'feedback_invalid']);
});

test('only full admins delete feedback; results admins are refused, and signed calls never list it', async () => {
  const calls = [];
  const validators = [];
  const admin = (action, validateAdmin) => dispatchAdminRequest({
    request: new Request('https://worker.example/admin/x', { method: 'POST', body: JSON.stringify({ through: 'c', cursor: 'c', limit: 3 }) }),
    env: {},
    baseHeaders: {},
    slug: 'salon',
    action,
    deps: {
      json: (payload, status) => ({ status, payload }),
      resolveAdminRequestAuthority: async ({ deps }) => (validators.push([deps.validateAdmin, validateAdmin]),
        await deps.validateAdmin({ address: 'x' }) === true
        ? { ok: true, headers: {}, targetSlug: 'salon', existingConfig: {}, address: ADDRESS }
        : { ok: false, response: { status: 403 } }),
      validateAdmin: validateAdmin,
      callSessionFeedbackStore: async (_env, slug, operation, payload) => {
        calls.push({ slug, operation, payload });
        return { ok: true, status: 200, body: { ok: true, operation } };
      },
    },
  });
  // A results admin passes only the results check, never the full-admin one.
  const resultsAdmin = async () => false;
  assert.equal((await admin('feedback/list', resultsAdmin)).status, 403);
  assert.equal((await admin('feedback/delete', resultsAdmin)).status, 403);
  assert.equal(calls.length, 0);
  const fullAdmin = async () => true;
  assert.equal((await admin('feedback/list', fullAdmin)).status, 400);
  assert.deepEqual((await admin('feedback/delete', fullAdmin)).payload, { ok: true, operation: 'delete' });
  // The full-admin check itself, never the results builders' wider one.
  assert.ok(validators.every(([used, given]) => used === given));
  assert.deepEqual(calls, [{ slug: 'salon', operation: 'delete', payload: { ids: undefined, through: 'c' } }]);
});

// What reads a session's work, AI Views, the atlas, the risk matrix, the
// Session Agent, the fidelity report, exports and backups, reads fixed
// resources and prefixes. Only the feedback modules, the coordinator's router
// and its call list may name feedback's storage or its coordinator path, and
// every storage listing names a prefix, so none sweeps feedback in unnamed.
test('nothing but the feedback modules names feedback’s storage or imports them', async () => {
  const root = new URL('../../', import.meta.url);
  const named = new Set(['sessionFeedback.js', 'sessionFeedbackRoute.js', 'sessionWriteCoordinator.js', 'sessionConfigAuthority.js']
    .map((name) => `workers/sessionCorsWorker/${name}`));
  const importers = new Set(['sessionFeedbackRoute.js', 'sessionWriteCoordinator.js', 'adminRequestDispatch.js', 'adminResultsAnalysisDispatch.js',
    'authenticatedSecretActionRouteDispatch.js', 'workerRouteShellBinding.js'].map((name) => `workers/sessionCorsWorker/${name}`));
  let scanned = 0;
  for (const top of ['workers', 'shared', 'mcp/lib', 'mcp/bin']) {
    for (const name of await readdir(new URL(`${top}/`, root), { recursive: true })) {
      const path = `${top}/${name}`;
      if (!/\.m?js$/.test(path) || /node_modules|\.test\.m?js$|TestFixture|RuntimeFixture/.test(path)) continue;
      const text = await readFile(new URL(path, root), 'utf8');
      scanned += 1;
      if (!named.has(path)) assert.ok(!text.includes('session-feedback'), `${path} names feedback's storage`);
      if (!importers.has(path)) assert.ok(!/sessionFeedback(Route)?\.js['"]/.test(text), `${path} imports feedback`);
      for (const call of text.matchAll(/\.list\(/g)) {
        const args = text.slice(call.index, call.index + 300).split(/\)\s*;|\)\)/)[0];
        assert.ok(args.includes('prefix'), `${path} lists storage without a prefix: ${args.slice(0, 80)}`);
      }
    }
  }
  assert.ok(scanned > 100, `only ${scanned} sources scanned`);
});

test('through the whole Worker: people send signed in and out, the admin reads, a results admin cannot', async (t) => {
  // No network: an admin check that looks further than the config fails at once.
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('No network in this test.'); });
  const resultsAdmin = Wallet.createRandom();
  const { admin, env } = createSessionEnv({ configOverrides: { resultsAdminAddresses: [resultsAdmin.address.toLowerCase()] } });
  const send = async (body, token = '') => readJson(await fetchWorker(
    makeRequest(token ? '/feedback' : `/feedback?slug=${SLUG}`, { method: 'POST', token, body }), env));
  const token = await login({ env, wallet: admin });
  assert.deepEqual(await send({ ...SEND, text: 'signed in', contact: { reachMe: 'by email' } }, token), { status: 200, body: { ok: true } });
  assert.deepEqual(await send({ ...SEND, text: 'signed out' }), { status: 200, body: { ok: true } });
  const nullBody = await send(null);
  assert.deepEqual([nullBody.status, nullBody.body.error], [400, 'Send the feedback as a JSON object.']);

  const read = async (signIn, query = '') => {
    const response = await fetchWorker(makeRequest(`/admin/feedback?slug=${SLUG}${query}`, { token: signIn }), env);
    return { ...(await readJson(response.clone())), headers: response.headers };
  };
  const plain = ({ status, body }) => ({ status, body });
  const listed = await read(token, '&limit=100');
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  assert.equal(listed.body.cursor, undefined);
  const [signedIn, signedOut] = ['signed in', 'signed out'].map((text) => listed.body.messages.find((message) => message.text === text));
  assert.deepEqual([signedOut.text, signedOut.signedIn, 'contact' in signedOut], ['signed out', false, false]);
  assert.deepEqual([signedIn.text, signedIn.signedIn, 'contact' in signedIn], ['signed in', true, false]);
  const listedText = JSON.stringify(listed.body).toLowerCase();
  assert.ok(!listedText.includes('by email') && !listedText.includes(admin.address.slice(2).toLowerCase()));
  assert.equal(signedIn.workerRelease, signedOut.workerRelease);

  assert.equal(listed.headers.get('cache-control'), 'private, no-store');
  const newest = listed.body.messages[0].id;
  const page1 = await read(token, '&limit=1');
  const page2 = await read(token, `&limit=1&cursor=${encodeURIComponent(page1.body.cursor)}`);
  assert.deepEqual([...page1.body.messages, ...page2.body.messages].map((message) => message.id), listed.body.messages.map((message) => message.id));
  assert.equal(page2.body.cursor, undefined);
  const badPage = await read(token, '&cursor=nope');
  assert.deepEqual([badPage.status, badPage.headers.get('cache-control')], [400, 'private, no-store']);
  assert.equal((await read('')).status, 401);
  for (const wallet of [resultsAdmin, Wallet.createRandom()]) {
    const refusedRead = await read(await login({ env, wallet }));
    assert.deepEqual(plain(refusedRead), { status: 403, body: { error: 'Only the session’s admins can read feedback.' } });
    assert.equal(refusedRead.headers.get('cache-control'), 'private, no-store');
  }
  const refused = await signedAdminRequest({ env, wallet: resultsAdmin, action: 'feedback/delete', body: { through: newest } });
  assert.equal(refused.status, 403, JSON.stringify(refused.body));
  const cleared = await signedAdminRequest({ env, wallet: admin, action: 'feedback/delete', body: { through: newest } });
  assert.deepEqual([cleared.status, cleared.body.deleted], [200, 2]);
  assert.deepEqual((await read(token)).body.messages, []);
});

test('an agent key, even one minted for an admin, does not read feedback', async () => {
  const reached = [];
  const response = await dispatchAdminResultsAnalysisStatusRequest({
    feedback: true,
    request: new Request('https://worker.example/admin/feedback?slug=salon'),
    env: {},
    baseHeaders: {},
    slug: 'salon',
    deps: {
      requireAuth: async () => ({ ok: true, slug: 'salon', payload: { sub: ADDRESS, agentSource: 'agent-key' } }),
      validateAdmin: async () => (reached.push('validateAdmin'), true),
      readCurrentSessionConfig: async () => (reached.push('config'), { config: {} }),
      callSessionFeedbackStore: async () => (reached.push('store'), { ok: true, body: { messages: [] } }),
      json: (payload, status, headers) => ({ status, payload, headers }),
    },
  });
  assert.deepEqual([response.status, response.payload.error, response.headers.get('cache-control')],
    [403, 'Only the session’s admins can read feedback.', 'private, no-store']);
  assert.deepEqual(reached, []);
});

test('a signed-out send names its session with ?slug=, and a pinned Worker refuses another session', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('No network in this test.'); });
  const { admin, env } = createSessionEnv();
  const send = async (query) => readJson(await fetchWorker(makeRequest(`/feedback${query}`, { method: 'POST', body: SEND }), env));
  const stored = async () => {
    const token = await login({ env, wallet: admin });
    return (await readJson(await fetchWorker(makeRequest(`/admin/feedback?slug=${SLUG}`, { token }), env))).body.messages.length;
  };

  // Pinned to its session: the same slug is taken, another is refused, not filed under this one.
  assert.equal((await send(`?slug=${SLUG}`)).status, 200);
  const other = await send('?slug=another-session');
  assert.equal(other.status, 404, JSON.stringify(other.body));
  assert.equal(await stored(), 1);

  // Serving many sessions, the query alone names the session.
  delete env.DEFAULT_SESSION_SLUG;
  assert.deepEqual(await send(`?slug=${SLUG}`), { status: 200, body: { ok: true } });
  assert.equal((await send('')).status, 400);
  assert.equal(await stored(), 2);
});
