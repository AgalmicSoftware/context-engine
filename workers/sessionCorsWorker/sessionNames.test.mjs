// The names people give themselves in a session: the rules for a name, who
// may set, read and clear one, the setting that turns names off, backups,
// and that nothing outside the names routes reads the store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { classifySessionConfigEdits } from '../../shared/sessionConfigEdits.mjs';
import { projectPublicWorkerSessionConfig } from '../shared/workerSessionConfig.mjs';
import { dispatchAdminRequest } from './adminRequestDispatch.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';
import { applySessionConfigMutation } from './sessionConfigMutation.js';
import {
  dispatchSessionNamesStore, isSessionNamesBackup, normalizeSessionName, readSessionNames, restoreSessionNames, setOwnSessionName,
} from './sessionNames.js';
import { resolveTopLevelRouteSelection } from './topLevelRouteSelection.js';
import { FEATURES } from './workerCapabilities.js';
import { createWorkerRouteShellWithWorkerDeps } from './workerRouteShellBinding.js';

const SESSION_ID = `0x${'ab'.repeat(16)}`;
const SAM = `0x${'1'.repeat(40)}`;
const ALEX = `0x${'2'.repeat(40)}`;
const config = (extra = {}) => ({ slug: 's', sessionId: SESSION_ID, sessionModeProfile: { authority: { mode: 'worker_canonical' } }, ...extra });

// A coordinator's storage as the names store uses it.
const createStorage = () => {
  const map = new Map();
  return {
    map,
    get: async (key) => map.get(key),
    put: async (key, value) => { map.set(key, value); },
    delete: async (key) => { map.delete(key); },
    list: async ({ prefix, startAfter = '', limit }) => new Map([...map].filter(([key]) => key.startsWith(prefix) && key > startAfter)
      .sort(([a], [b]) => a.localeCompare(b)).slice(0, limit)),
  };
};
// The store reached as callSessionNamesStore reaches it.
const storeOn = (storage) => async (_env, _slug, operation, payload = {}) => {
  const response = await dispatchSessionNamesStore({ state: { storage } }, operation, payload);
  const body = await response.json();
  return { ok: response.ok && body.ok === true, status: response.status, body };
};

test('a name is stored as typed, tidied, and refused with a reason when it could mislead', () => {
  for (const [typed, stored] of [
    ['  Sam   Rivera ', 'Sam Rivera'], ['José', 'José'], ['José', 'José'], ['李雷', '李雷'], ["O'Brien-Smith", "O'Brien-Smith"],
    ['J.R. Hall', 'J.R. Hall'], ['Hostetler', 'Hostetler'], ["Sam's agent", "Sam's agent"], ['', ''], ['   ', ''],
  ]) assert.deepEqual(normalizeSessionName(typed), { ok: true, name: stored }, typed);
  for (const [typed, reason] of [
    [undefined, 'empty'], ['x'.repeat(33), 'too_long'], ['Sam (agent)', 'agent_mark'], ['Sam 🙂', 'characters'], ['Sam!', 'characters'],
    ['...', 'characters'], ['0xabc', 'address'], ['me 0x1f', 'address'], ['deadbeefdeadbeef00', 'address'], ['vitalik.eth', 'ens'],
    ['sam.com', 'url_or_email'], ['www.sam', 'url_or_email'], ['sk-abcdefghijklmnopqr', 'secret'], ['Admin', 'role'],
    ['the host', 'role'], ['Session Agent', 'role'], ['session_agent', 'role'], ['RxC', 'role'], ['Context-Engine', 'role'],
  ]) assert.equal(normalizeSessionName(typed).reason, reason, String(typed));
  assert.equal(normalizeSessionName('x'.repeat(32)).ok, true);
  assert.match(normalizeSessionName('Admin').error, /role/);
});

test('a signed-in person sets and removes only their own name, within the daily limit', async () => {
  const storage = createStorage();
  const store = storeOn(storage);
  const limits = [];
  const checkRateLimit = async (args) => { limits.push(args); return true; };
  const set = (body, extra = {}) => setOwnSessionName({ env: {}, slug: 's', config: config(), body, address: SAM, checkRateLimit, store, now: () => 0, ...extra });
  // An address in the body is never whose name changes.
  assert.deepEqual(await set({ name: '  Sam ', address: ALEX }), { status: 200, body: { name: 'Sam', setAt: '1970-01-01T00:00:00.000Z' } });
  assert.deepEqual([...storage.map.keys()], [`session-name-v1:${SAM}`]);
  assert.deepEqual(limits, [{ env: {}, slug: 's', address: SAM, limit: 10, route: 'names-set' }]);
  assert.deepEqual(await set({ name: 'Admin' }), { status: 400, body: { error: normalizeSessionName('Admin').error, reason: 'role' } });
  assert.deepEqual(await set({ name: '' }), { status: 200, body: { name: null, setAt: null } });
  assert.equal(storage.map.size, 0);
  assert.equal((await set({ name: 'Sam' }, { address: '' })).status, 401);
  assert.deepEqual((await set({ name: 'Sam' }, { config: config({ namesEnabled: false }) })).body, { error: 'Names are off in this session', reason: 'names_off' });
  // An on-chain session has no Worker of its own to keep names.
  assert.equal((await set({ name: 'Sam' }, { config: { sessionModeProfile: { authority: { mode: 'onchain_registry' } } } })).status, 403);
  assert.equal((await set({ name: 'Sam' }, { checkRateLimit: async () => false })).status, 429);
  assert.equal((await set({ name: 'Sam' }, { checkRateLimit: async () => null })).status, 503);
  assert.equal((await set({ name: 'Sam' }, { store: async () => ({ ok: false, status: 503 }) })).status, 503);
  assert.equal(storage.map.size, 0);
});

test('names show to people signed in whom the session admits; anyone else sees an empty map', async () => {
  const storage = createStorage();
  const store = storeOn(storage);
  await store({}, 's', 'set', { address: SAM, name: 'Sam', now: 0 });
  await store({}, 's', 'set', { address: ALEX, name: 'Alex', now: 0 });
  const admitted = async () => ({ ok: true });
  const read = (extra = {}) => readSessionNames({ env: {}, slug: 's', config: config(), path: '/names', address: SAM, sessionGate: admitted, store, ...extra });
  assert.deepEqual(await read(), { status: 200, body: { names: { [SAM]: 'Sam', [ALEX]: 'Alex' } } });
  const empty = { status: 200, body: { names: {} } };
  assert.deepEqual(await read({ address: '', sessionGate: () => assert.fail('signed out never reaches the gate') }), empty);
  assert.deepEqual(await read({ sessionGate: async () => ({ ok: false }) }), empty);
  assert.deepEqual(await read({ config: config({ namesEnabled: false }) }), empty);
  assert.equal((await read({ sessionGate: async () => ({ ok: false, unavailable: true }) })).status, 503);
  // Your own name is yours to see, as the field shows it.
  assert.deepEqual(await read({ path: '/names/me' }), { status: 200, body: { name: 'Sam', setAt: '1970-01-01T00:00:00.000Z' } });
  assert.deepEqual(await read({ path: '/names/me', address: `0x${'3'.repeat(40)}` }), { status: 200, body: { name: null, setAt: null } });
  assert.equal((await read({ path: '/names/me', address: '' })).status, 401);
});

test('the routes reach the names store: reads signed in or out, set signed in, clear for admins', async () => {
  assert.deepEqual(resolveTopLevelRouteSelection({ path: '/names', method: 'GET', request: new Request('https://w.test/names') }),
    { kind: 'names', path: '/names' });
  assert.deepEqual(resolveTopLevelRouteSelection({ path: '/names/me', method: 'GET', request: new Request('https://w.test/names/me') }),
    { kind: 'names', path: '/names/me' });
  assert.ok(FEATURES.includes('session_names_v1'));

  const set = await dispatchAuthenticatedSecretActionRoute({
    path: '/names/set', body: { name: 'Sam' }, config: config(), slug: 's', address: SAM, env: {}, headers: {},
    deps: { json: (body, status = 200) => Response.json(body, { status }), checkRateLimit: async () => null },
  });
  assert.equal(set.handled, true);
  assert.equal((await set.response.json()).reason, 'rate_limit_unavailable');

  const cleared = [];
  const clear = (body) => dispatchAdminRequest({
    request: new Request('https://w.test/admin/names/clear', { method: 'POST', body: JSON.stringify(body) }), env: {}, baseHeaders: {}, slug: 's', action: 'names/clear',
    deps: {
      json: (payload, status = 200, headers) => Response.json(payload, { status, headers }),
      resolveAdminRequestAuthority: async () => ({ ok: true, existingConfig: config(), headers: {}, targetSlug: 's', address: ALEX }),
      callSessionNamesStore: async (_env, slug, operation, payload) => { cleared.push([slug, operation, payload]); return { ok: true }; },
    },
  });
  // `address` names the signing admin; `member` is whose name goes.
  const done = await clear({ address: ALEX, member: SAM });
  assert.deepEqual([done.status, await done.json(), done.headers.get('Cache-Control')], [200, { cleared: true }, 'private, no-store']);
  assert.equal((await clear({ address: ALEX })).status, 400);
  assert.deepEqual(cleared, [['s', 'clear', { address: SAM }]]);
});

test('GET /names through the Worker: signed in with the session’s gate, cached privately per reader', async () => {
  const storage = createStorage();
  await storeOn(storage)({}, 's', 'set', { address: SAM, name: 'Sam', now: 0 });
  const sessionConfig = config({ authzEpoch: 2, storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } } });
  const coordinator = { fetch: async (url, init) => {
    const response = await dispatchSessionNamesStore({ state: { storage } }, new URL(url).pathname.split('/').pop(), JSON.parse(init.body));
    return new Response(await response.text(), { status: response.status });
  } };
  const shell = createWorkerRouteShellWithWorkerDeps({
    constants: { missingSlugError: 'Missing sessionSlug.', sessionConfigNotFoundError: 'Session config not found.' },
    deps: {
      toStr: (value) => String(value ?? ''), corsHeaders: () => ({}),
      json: (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers }),
      resolveRequestSlugWithoutToken: () => ({ ok: true, slug: 's', explicitSlugProvided: true }),
      getSessionConfig: async () => sessionConfig,
      readCurrentSessionConfig: async () => ({ revision: 1, config: sessionConfig }),
      getCorsContext: async () => ({ ok: true, headers: {} }),
      requireAuth: async () => ({ ok: true, slug: 's', payload: { sub: SAM, sessionId: SESSION_ID, authzEpoch: 2, scopes: { storage: true } } }),
      computeScopesForLogin: async () => ({ storage: true }), checkRateLimit: async () => true,
    },
  });
  const env = { CE_SESSION_COORDINATOR: { idFromName: (name) => name, get: () => coordinator } };
  const get = (path, signedIn) => shell.fetch(new Request(`https://w.test${path}?slug=s`, signedIn ? { headers: { authorization: 'Bearer t' } } : {}), env);
  const signedIn = await get('/names', true);
  assert.deepEqual([signedIn.status, await signedIn.json()], [200, { names: { [SAM]: 'Sam' } }]);
  assert.deepEqual([signedIn.headers.get('Cache-Control'), signedIn.headers.get('Vary')], ['private, max-age=30', 'Authorization']);
  const signedOut = await get('/names', false);
  assert.deepEqual([signedOut.status, await signedOut.json()], [200, { names: {} }]);
  const own = await get('/names/me', true);
  assert.deepEqual([await own.json(), own.headers.get('Cache-Control')], [{ name: 'Sam', setAt: '1970-01-01T00:00:00.000Z' }, 'private, no-store']);
  assert.equal((await get('/names/me', false)).status, 401);
  // A session whose gate admits only its admins shows a signed-in non-admin no names.
  sessionConfig.storageProfile.payloadAccessControl.gate = 'role_gate';
  const refused = await get('/names', true);
  assert.deepEqual([refused.status, await refused.json()], [200, { names: {} }]);
});

test('namesEnabled is true or false, signs no one out, and the site can read it', () => {
  const base = { slug: 's', sessionId: SESSION_ID, adminAddress: ALEX };
  const save = (namesEnabled) =>
    applySessionConfigMutation({ existingConfig: base, slug: 's', mutation: { kind: 'set-config', incomingConfig: { ...base, namesEnabled } } });
  assert.deepEqual([save('no').ok, save('no').status, save('no').error], [false, 400, 'namesEnabled must be true or false.']);
  assert.equal(save(false).ok, true);
  assert.deepEqual(classifySessionConfigEdits(base, { ...base, namesEnabled: false }), { content: ['namesEnabled'], authority: [], signsParticipantsOut: false });
  assert.equal(projectPublicWorkerSessionConfig({ ...base, namesEnabled: false }).namesEnabled, false);
});

test('a backup carries names as stored, and a restore keeps a name the person has set since', async () => {
  const rows = [{ address: SAM, name: 'Sam', setAt: '2026-11-17T00:00:00.000Z' }, { address: ALEX, name: 'Alex', setAt: '2026-11-17T00:00:00.000Z' }];
  assert.equal(isSessionNamesBackup(rows), true);
  for (const bad of [
    [{ ...rows[0], name: 'Admin' }], [{ ...rows[0], name: ' Sam' }], [{ ...rows[0], name: '' }], [{ ...rows[0], address: SAM.toUpperCase() }],
    [{ ...rows[0], setAt: 'later' }], [{ ...rows[0], extra: 1 }], [rows[0], rows[0]], {},
  ]) assert.equal(isSessionNamesBackup(bad), false, JSON.stringify(bad));
  const storage = createStorage();
  await storage.put(`session-name-v1:${ALEX}`, { name: 'Alex R', setAt: '2026-11-18T00:00:00.000Z' });
  const journal = [];
  assert.deepEqual(await restoreSessionNames(storage, rows, async (key) => journal.push(key)), { written: 1, skipped: 1 });
  assert.deepEqual(journal, [`session-name-v1:${SAM}`]);
  assert.deepEqual(Object.fromEntries(storage.map), {
    [`session-name-v1:${SAM}`]: { name: 'Sam', setAt: rows[0].setAt },
    [`session-name-v1:${ALEX}`]: { name: 'Alex R', setAt: '2026-11-18T00:00:00.000Z' },
  });
});

test('only the names routes and backups read the store, so a name never reaches AI, exports or agent results', async () => {
  const importers = [];
  for (const file of await readdir(new URL('.', import.meta.url), { recursive: true })) {
    if (!/\.(m?js)$/.test(file) || /\.test\.|node_modules/.test(file) || file === 'sessionNames.js') continue;
    if (/from '\.\.?\/(?:\.\.\/)*(?:sessionCorsWorker\/)?sessionNames\.js'/.test(await readFile(new URL(file, import.meta.url), 'utf8'))) importers.push(file);
  }
  assert.deepEqual(importers.sort(), [
    'adminRequestDispatch.js', 'authenticatedRouteDispatch.js', 'authenticatedSecretActionRouteDispatch.js', 'sessionBackupCoordinator.js',
    'sessionBackupImport.js', 'sessionWriteCoordinator.js', 'workerRouteShellBinding.js',
  ]);
});
