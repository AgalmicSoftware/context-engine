import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnownSessions } from './knownSessions.mjs';

const SITE = 'https://contextengine.sh';
const WORKER = 'https://ce-town-hall.example.workers.dev';
const SESSION_ID = '0x00112233445566778899aabbccddeeff';
const ENTRY = { worker: WORKER, sessionId: SESSION_ID, name: 'Town Hall' };

const jsonList = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const redirect = (location) => new Response(null, { status: 301, headers: { location } });

// A scripted network: each URL's answer, and every request made.
const network = (answers) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), redirect: init.redirect });
    const answer = answers[String(url)];
    if (!answer) throw new TypeError('fetch failed');
    return answer();
  };
  return { calls, fetchImpl };
};

test('a listed slug resolves to its Worker and session, and an unlisted one to nothing', async () => {
  const { calls, fetchImpl } = network({ [`${SITE}/known-sessions.json`]: () => jsonList({ 'town-hall': ENTRY, other: ENTRY }) });
  const known = createKnownSessions({ fetchImpl });
  assert.deepEqual(await known.lookup(SITE, 'town-hall'), { status: 'listed', workerOrigin: WORKER, sessionId: SESSION_ID, name: 'Town Hall' });
  assert.deepEqual(await known.lookup(SITE, 'elsewhere'), { status: 'unlisted' });
  // Inherited names are not entries.
  assert.deepEqual(await known.lookup(SITE, 'constructor'), { status: 'unlisted' });
  assert.deepEqual(calls, [{ url: `${SITE}/known-sessions.json`, redirect: 'manual' }]);
});

test('a site without the list lists nothing: a 404, or the app page it serves for any path', async () => {
  for (const answer of [
    () => new Response('Not found', { status: 404 }),
    () => new Response('<!doctype html><title>Context Engine</title>', { headers: { 'content-type': 'text/html' } }),
  ]) {
    const { fetchImpl } = network({ [`${SITE}/known-sessions.json`]: answer });
    assert.deepEqual(await createKnownSessions({ fetchImpl }).lookup(SITE, 'town-hall'), { status: 'unlisted' });
  }
  // Nor is a list read from a site that isn't https, or a local one outside development.
  for (const site of ['http://contextengine.example', 'http://localhost:3000']) {
    const { calls, fetchImpl } = network({});
    assert.deepEqual(await createKnownSessions({ fetchImpl }).lookup(site, 'town-hall'), { status: 'unlisted' });
    assert.equal(calls.length, 0);
  }
  const local = network({ 'http://localhost:3000/known-sessions.json': () => jsonList({ 'town-hall': { ...ENTRY, worker: 'http://localhost:8787' } }) });
  assert.deepEqual(
    await createKnownSessions({ fetchImpl: local.fetchImpl, allowLocalWorkers: true }).lookup('http://localhost:3000', 'town-hall'),
    { status: 'listed', workerOrigin: 'http://localhost:8787', sessionId: SESSION_ID, name: 'Town Hall' },
  );
});

// A JSON response whose body fails after its first bytes.
const failingBody = (error) => new Response(new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('{"town-hall":'));
    controller.error(error);
  },
}), { headers: { 'content-type': 'application/json' } });

test('a list that cannot be read, or an entry that cannot be used, is reported with the reason', async () => {
  const cases = [
    [() => new Response('busy', { status: 503 }), 'the site answered 503'],
    [() => new Response('{"town-hall":', { headers: { 'content-type': 'application/json' } }), 'the list is not valid JSON'],
    [() => jsonList(['town-hall']), 'the list is not a set of sessions'],
    [() => jsonList({ pad: 'x'.repeat(600 * 1024) }), 'the list is too large'],
    // A body that stops part way is a slow or broken site, not a bad list.
    [() => failingBody(new DOMException('The operation timed out.', 'TimeoutError')), 'the site took too long to answer'],
    [() => failingBody(new TypeError('terminated')), 'the list could not be read'],
    [() => jsonList({ 'town-hall': { ...ENTRY, worker: 'http://ce-town-hall.example.workers.dev' } }), 'its entry for "town-hall" has no usable Worker or session ID'],
    [() => jsonList({ 'town-hall': { ...ENTRY, worker: 'https://10.0.0.5' } }), 'its entry for "town-hall" has no usable Worker or session ID'],
    [() => jsonList({ 'town-hall': { worker: WORKER, sessionId: 'not-an-id' } }), 'its entry for "town-hall" has no usable Worker or session ID'],
    [() => jsonList({ 'town-hall': WORKER }), 'its entry for "town-hall" has no usable Worker or session ID'],
  ];
  for (const [answer, reason] of cases) {
    const { fetchImpl } = network({ [`${SITE}/known-sessions.json`]: answer });
    assert.deepEqual(await createKnownSessions({ fetchImpl }).lookup(SITE, 'town-hall'),
      { status: 'unreadable', listUrl: `${SITE}/known-sessions.json`, reason });
  }
  const { fetchImpl } = network({});
  assert.deepEqual(await createKnownSessions({ fetchImpl }).lookup(SITE, 'town-hall'),
    { status: 'unreadable', listUrl: `${SITE}/known-sessions.json`, reason: 'the site could not be reached' });
});

test('the list follows two redirects to another public https copy of it, and no others', async () => {
  const www = network({
    'https://www.contextengine.sh/known-sessions.json': () => redirect('https://contextengine.sh/known-sessions.json'),
    [`${SITE}/known-sessions.json`]: () => jsonList({ 'town-hall': ENTRY }),
  });
  assert.equal((await createKnownSessions({ fetchImpl: www.fetchImpl }).lookup('https://www.contextengine.sh', 'town-hall')).status, 'listed');
  assert.deepEqual(www.calls.map(({ url }) => url), ['https://www.contextengine.sh/known-sessions.json', `${SITE}/known-sessions.json`]);

  const refused = 'the site redirected somewhere other than a public https copy of the list';
  for (const location of ['http://contextengine.sh/known-sessions.json', 'https://contextengine.sh/sessions.json',
    'https://contextengine.sh/known-sessions.json?all=1', 'https://127.0.0.1/known-sessions.json', 'https://user:[redacted-email]/known-sessions.json']) {
    const { calls, fetchImpl } = network({ [`${SITE}/known-sessions.json`]: () => redirect(location) });
    assert.deepEqual(await createKnownSessions({ fetchImpl }).lookup(SITE, 'town-hall'),
      { status: 'unreadable', listUrl: `${SITE}/known-sessions.json`, reason: refused }, location);
    assert.equal(calls.length, 1);
  }
  const loop = network({
    [`${SITE}/known-sessions.json`]: () => redirect('https://a.example/known-sessions.json'),
    'https://a.example/known-sessions.json': () => redirect('https://b.example/known-sessions.json'),
    'https://b.example/known-sessions.json': () => redirect('https://c.example/known-sessions.json'),
  });
  assert.equal((await createKnownSessions({ fetchImpl: loop.fetchImpl }).lookup(SITE, 'town-hall')).reason, 'the site redirected too many times');
  assert.equal(loop.calls.length, 3);
});

test('a list read is kept for a minute, and a failed read is tried again', async () => {
  let clock = 0;
  let fail = true;
  const { calls, fetchImpl } = network({ [`${SITE}/known-sessions.json`]: () => (fail ? new Response('busy', { status: 503 }) : jsonList({ 'town-hall': ENTRY })) });
  const known = createKnownSessions({ fetchImpl, now: () => clock });
  assert.equal((await known.lookup(SITE, 'town-hall')).status, 'unreadable');
  fail = false;
  assert.equal((await known.lookup(SITE, 'town-hall')).status, 'listed');
  clock += 59_000;
  assert.equal((await known.lookup(SITE, 'town-hall')).status, 'listed');
  assert.equal(calls.length, 2);
  clock += 2_000;
  await known.lookup(SITE, 'town-hall');
  assert.equal(calls.length, 3);
});
