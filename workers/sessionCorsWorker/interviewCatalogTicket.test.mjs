import test from 'node:test';
import assert from 'node:assert/strict';
import { persistAuthTokenRecord, revokeAuthTokenRecord } from './authTokenClaims.js';
import {
  INTERVIEW_CATALOG_TICKET_TTL_SECONDS,
  issueInterviewCatalogTicket,
  verifyInterviewCatalogTicket,
} from './interviewCatalogTicket.js';
import { signToken, verifyToken } from './tokenSigning.js';

const NOW_MS = 1_800_000_000_000;
const NOW = NOW_MS / 1000;
const ADDRESS = `0x${'ab'.repeat(20)}`;
const SIGN_IN = 'b6a3c1f2-0d4e-4a8b-9c7d-1e2f3a4b5c6d';
const SESSION_ID = `0x${'12'.repeat(16)}`;
const config = { sessionId: SESSION_ID, authzEpoch: 3 };

const memoryKv = () => {
  const values = new Map();
  return {
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => { values.set(key, value); },
    delete: async (key) => { values.delete(key); },
  };
};

// Built at runtime so no secret-shaped string sits in the source.
const makeEnv = () => ({ TOKEN_HMAC_SECRET: ['catalog', 'ticket', 'test', 'key'].join('-'), GROUP_KV: memoryKv() });

const setup = async ({ scopes = { storage: true, arweave: false } } = {}) => {
  const env = makeEnv();
  await persistAuthTokenRecord({ env, slug: 'demo', sub: ADDRESS, jti: SIGN_IN, ttlSeconds: 8 * 60 * 60 });
  const scopeCalls = [];
  const deps = {
    now: () => NOW_MS,
    computeScopesForLogin: async (args) => {
      scopeCalls.push(args);
      return scopes;
    },
  };
  const { ticket, expiresAt } = await issueInterviewCatalogTicket({
    env,
    config,
    slug: 'demo',
    sub: ADDRESS.toUpperCase().replace('0X', '0x'),
    parent: SIGN_IN,
    parentExp: NOW + 8 * 60 * 60,
    deps,
  });
  return { env, deps, ticket, expiresAt, scopeCalls };
};

const verify = (args) => verifyInterviewCatalogTicket({ slug: 'demo', config, ...args });

test('a ticket names its person, its sign-in and an hour-long expiry, and reads as that person', async () => {
  const { env, deps, ticket, expiresAt, scopeCalls } = await setup();
  assert.equal(expiresAt, NOW + INTERVIEW_CATALOG_TICKET_TTL_SECONDS);
  assert.match(ticket, /^ic1\.0x[0-9a-f]{40}\.[A-Za-z0-9_-]+\.\d+\.[A-Za-z0-9_-]{43}$/);
  assert.equal(ticket.split('.')[1], ADDRESS);
  assert.ok(ticket.length <= 140, `a ticket stays short: ${ticket.length}`);
  assert.deepEqual(await verify({ env, ticket, deps }), {
    ok: true,
    reader: { address: ADDRESS, scopes: { storage: true, arweave: false } },
  });
  // Access is asked again at each read, as a signed-in storage read asks it.
  assert.deepEqual(scopeCalls[0], { env, slug: 'demo', address: ADDRESS, config, requestedScopes: ['storage', 'arweave'] });
});

test('a ticket never outlasts the sign-in it came from', async () => {
  const env = makeEnv();
  const deps = { now: () => NOW_MS };
  const issued = await issueInterviewCatalogTicket({
    env, config, slug: 'demo', sub: ADDRESS, parent: SIGN_IN, parentExp: NOW + 600, deps,
  });
  assert.equal(issued.expiresAt, NOW + 600);
  await assert.rejects(issueInterviewCatalogTicket({
    env, config, slug: 'demo', sub: ADDRESS, parent: SIGN_IN, parentExp: NOW, deps,
  }));
  await assert.rejects(issueInterviewCatalogTicket({
    env, config, slug: 'demo', sub: 'not-an-address', parent: SIGN_IN, parentExp: NOW + 600, deps,
  }));
  await assert.rejects(issueInterviewCatalogTicket({
    env, config, slug: 'demo', sub: ADDRESS, parent: 'a.b', parentExp: NOW + 600, deps,
  }));
});

test('an expired, altered or misplaced ticket is refused', async () => {
  const { env, deps, ticket } = await setup();
  const refused = { ok: false, status: 401, reason: 'catalog_ticket_invalid' };
  const check = async (result, label) => assert.deepEqual(
    (({ ok, status, reason }) => ({ ok, status, reason }))(await result),
    refused,
    label,
  );
  const [version, sub, parent, exp, mac] = ticket.split('.');
  const otherAddress = `0x${'cd'.repeat(20)}`;
  await check(verify({ env, ticket: [version, otherAddress, parent, exp, mac].join('.'), deps }), 'another person');
  await check(verify({ env, ticket: [version, sub, `${parent}x`, exp, mac].join('.'), deps }), 'another sign-in');
  await check(verify({ env, ticket: [version, sub, parent, String(Number(exp) + 3600), mac].join('.'), deps }), 'a later expiry');
  await check(verify({ env, ticket: [version, sub, parent, exp, `${mac.slice(0, -1)}${mac.endsWith('A') ? 'B' : 'A'}`].join('.'), deps }), 'another MAC');
  await check(verify({ env, ticket: `ic2${ticket.slice(3)}`, deps }), 'another version');
  await check(verify({ env, ticket: '', deps }), 'no ticket');
  await check(verify({ env, ticket, deps: { ...deps, now: () => (Number(exp) * 1000) } }), 'expired');
  await check(verify({ env, ticket, deps, slug: 'other' }), 'another session');
  await check(verify({ env, ticket, deps, config: { ...config, sessionId: `0x${'34'.repeat(16)}` } }), 'a rotated session');
  await check(verify({ env, ticket, deps, config: { ...config, authzEpoch: 4 } }), 'an access edit');
  await check(verify({ env, ticket, deps, config: { ...config, authzEpoch: -1 } }), 'an unreadable access version');
  await check(verify({ env: { ...env, TOKEN_HMAC_SECRET: 'other' }, ticket, deps }), 'another Worker key');
});

test('signing out or losing access ends a ticket', async () => {
  const { env, deps, ticket } = await setup();
  assert.equal((await verify({ env, ticket, deps })).ok, true);
  await revokeAuthTokenRecord({ env, slug: 'demo', sub: ADDRESS, jti: SIGN_IN });
  assert.equal((await verify({ env, ticket, deps })).reason, 'catalog_ticket_invalid');

  const lost = await setup({ scopes: { storage: false, arweave: false } });
  assert.equal((await verify({ env: lost.env, ticket: lost.ticket, deps: lost.deps })).reason, 'catalog_ticket_invalid');
  // With no way to ask about access now, nothing is read.
  assert.equal((await verify({ env: lost.env, ticket: lost.ticket, deps: { now: lost.deps.now } })).reason, 'catalog_ticket_invalid');
  // A gate that turns the person away, or can't tell, refuses, as it does a signed-in read.
  const gate = await setup();
  for (const message of ['Access denied: default gate failed.', 'Access denied: on-chain gate data unavailable.']) {
    const gated = await verify({
      env: gate.env,
      ticket: gate.ticket,
      deps: { ...gate.deps, computeScopesForLogin: async () => { throw new Error(message); } },
    });
    assert.deepEqual([gated.status, gated.reason], [401, 'catalog_ticket_invalid'], message);
  }
});

test('a check that cannot run asks for a retry instead of refusing', async () => {
  const { env, deps, ticket } = await setup();
  const unavailable = { status: 503, reason: 'catalog_ticket_unavailable' };
  const pick = ({ status, reason }) => ({ status, reason });
  assert.deepEqual(pick(await verify({ env: { ...env, TOKEN_HMAC_SECRET: '' }, ticket, deps })), unavailable);
  assert.deepEqual(pick(await verify({
    env, ticket, deps: { ...deps, validateAuthTokenRecord: async () => { throw new Error('KV down'); } },
  })), unavailable);
});

test('a ticket and a sign-in can never stand in for each other', async () => {
  const { env, deps, ticket } = await setup();
  assert.equal((await verifyToken(ticket, env.TOKEN_HMAC_SECRET, deps)).ok, false);
  const signIn = await signToken({ sub: ADDRESS, slug: 'demo', jti: SIGN_IN, exp: NOW + 600 }, env.TOKEN_HMAC_SECRET, deps);
  assert.equal((await verify({ env, ticket: signIn, deps })).reason, 'catalog_ticket_invalid');
});
