// Signing a person in to the account their AI agent set up, through the Worker's real entry: the one-time
// code, the sign-in it gives, attaching a passkey, ending and restoring the agent's access, and the session's
// switch for agents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';

import {
  AGENT_CLIENT_HEADER, AGENT_SIGN_IN_FEATURE, AGENT_SIGN_IN_LINK_STATEMENT, AGENT_SIGN_IN_PATHS, agentPasskeyAttachStatement,
  isAgentSignInCode, readAgentPasskeyAttachStatement,
} from '../../shared/agentSignIn.mjs';
import { AGENT_SIGN_IN_LIMITS } from './agentSignInLink.js';
import { dispatchAgentSignInStore } from './agentSignInStore.js';
import {
  APP_ORIGIN, SESSION_ID, SLUG, WORKER_ORIGIN, createSessionEnv, fetchWorker, readJson, signedAdminRequest,
} from './sessionWorkerRuntimeFixture.mjs';

const AGENT = { [AGENT_CLIENT_HEADER]: 'mcp/0.8.0' };
const SIGN_IN = 'Sign in to Context Engine.';

const send = (env, path, { method = 'POST', token, body, origin = APP_ORIGIN, headers = {} } = {}) => {
  const all = new Headers(headers);
  if (origin) all.set('Origin', origin);
  if (token) { all.set('Authorization', `Bearer ${token}`); all.set('X-Group-Slug', SLUG); }
  if (body !== undefined) all.set('Content-Type', 'application/json');
  return fetchWorker(new Request(`${WORKER_ORIGIN}${path}`, { method, headers: all, body: body === undefined ? undefined : JSON.stringify(body) }), env).then(readJson);
};
const session = { sessionSlug: SLUG, sessionId: SESSION_ID };

// The Worker gives one account five sign-in nonces a minute. These tests sign far more often than a person or an
// agent does, so that one count is always answered "allowed" here; every other limit is the real one.
const withoutNonceLimit = (env) => {
  const binding = env.CE_SESSION_COORDINATOR;
  env.CE_SESSION_COORDINATOR = {
    idFromName: binding.idFromName,
    get: (id) => ({
      fetch: async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        if (new URL(request.url).pathname === '/auth-state/rate/check') {
          const payload = await request.clone().json();
          if (String(payload?.route).startsWith('authnonce')) return Response.json({ ok: true, allowed: true, count: 1, resetAtMs: payload.resetAtMs });
        }
        return binding.get(id).fetch(request);
      },
    }),
  };
  return env;
};

// A message signed as the page and the MCP sign one, saying `statement`.
const signed = async (env, wallet, statement, { origin = APP_ORIGIN, headers = {} } = {}) => {
  const nonce = await send(env, '/auth/nonce', { body: { address: wallet.address, ...session }, origin, headers });
  assert.equal(nonce.status, 200, JSON.stringify(nonce.body));
  const issuedAt = new Date(Date.now() - 5_000).toISOString();
  const expirationTime = new Date(Date.now() + 600_000).toISOString();
  const message = `${new URL(origin).host} wants you to sign in with your Ethereum account:\n${wallet.address}\n\n${statement}\n\nURI: ${origin}\nVersion: 1\nChain ID: 1\nNonce: ${nonce.body.nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}\nResources:\n- ${WORKER_ORIGIN}\n- urn:context-engine:session:id:${SESSION_ID}`;
  return { address: wallet.address, message, signature: await wallet.signMessage(message), ...session };
};
const signIn = async (env, wallet, { headers = {} } = {}) => send(env, '/auth/login', { body: await signed(env, wallet, SIGN_IN, { headers }), headers });
const tokenOf = async (env, wallet, options) => {
  const result = await signIn(env, wallet, options);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.token;
};
const makeCode = async (env, wallet, { headers = AGENT, statement = AGENT_SIGN_IN_LINK_STATEMENT } = {}) =>
  send(env, AGENT_SIGN_IN_PATHS.create, { body: await signed(env, wallet, statement, { headers }), headers });
const exchange = (env, code, options = {}) => send(env, AGENT_SIGN_IN_PATHS.exchange, { body: { ...session, code }, ...options });
const attach = async (env, token, passkey, account, { statement = agentPasskeyAttachStatement(account) } = {}) =>
  send(env, AGENT_SIGN_IN_PATHS.attach, { token, body: { ...session, passkey: await signed(env, passkey, statement) } });
const passkeySignIn = (env, token) => send(env, AGENT_SIGN_IN_PATHS.passkeySignIn, { token, body: session });
const setAccess = (env, token, agentAccess) => send(env, AGENT_SIGN_IN_PATHS.access, { token, body: { ...session, agentAccess } });
const detach = (env, token) => send(env, AGENT_SIGN_IN_PATHS.detach, { token, body: session });
const stateOf = (env, token) => send(env, AGENT_SIGN_IN_PATHS.state, { token, body: session });
// A signed-in read every participant may make: whether a sign-in still stands.
const stands = async (env, token, headers = {}) => (await send(env, `/groups/my-memberships?sessionId=${SESSION_ID}`, { method: 'GET', token, headers })).status === 200;
const answer = (env, token, data, headers = {}) => send(env, '/storage/upload', {
  token, headers, body: { data: JSON.stringify(data), contentType: 'application/json', resource: 'responses' },
});
const QUESTION = `0x${'a1'.repeat(32)}`;
const groupsConfig = {
  workerGroupsBootstrap: { version: 2, state: 'fresh_empty', bootstrapId: 'b0'.repeat(32) },
  workerAuthority: { version: 1, participantScopes: ['storage', 'groups'], anonymousScopes: [] },
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'custom',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: null },
    storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'none' },
    surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
    results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
    export: { scope: 'all_session' },
  },
};
const setup = async (configOverrides = {}) => {
  const made = createSessionEnv({ configOverrides: { ...groupsConfig, ...configOverrides } });
  withoutNonceLimit(made.env);
  const adminToken = await tokenOf(made.env, made.admin);
  const stored = await send(made.env, '/storage/upload', {
    token: adminToken,
    body: { contentType: 'application/json', resource: 'questions', data: JSON.stringify({ id: QUESTION, type: 'binary', prompt: 'A statement', sessionSlug: SLUG, sessionId: SESSION_ID, options: ['Agree', 'Unsure', 'Disagree'] }) },
  });
  assert.equal(stored.status, 200, JSON.stringify(stored.body));
  return made;
};
const agentAnswer = (wallet, value = 'Agree') => ({
  questionId: QUESTION, sessionSlug: SLUG, sessionId: SESSION_ID, answer: { value }, additional: { value: '' }, responder: wallet.address,
  participant: { kind: 'agent', verification: 'self_reported' },
});
const personAnswer = (wallet, value = 'Disagree') => ({
  questionId: QUESTION, sessionSlug: SLUG, sessionId: SESSION_ID, answer: { value }, additional: { value: '' }, responder: wallet.address,
});
// Everything the session stores that is not a sign-in, a count or this feature's own keys.
const storedData = (env) => JSON.stringify([env.GROUP_KV, env.CE_STORAGE_INDEX_KV].map((kv) =>
  [...kv.values.entries()].filter(([key]) => !/^(authToken:|rate|ce-rate|auth-rate|abuse)/i.test(key) && !/rate-?limit/i.test(key)).sort()));

test('an agent’s link signs its person in as the agent’s account, once, and a passkey then keeps the account', async (t) => {
  const { env } = await setup();
  const agent = Wallet.createRandom();
  const passkey = Wallet.createRandom();
  const account = agent.address.toLowerCase();

  // The agent takes part as itself, then asks for a link.
  const agentToken = await tokenOf(env, agent, { headers: AGENT });
  assert.equal((await answer(env, agentToken, agentAnswer(agent), AGENT)).status, 200);
  const before = storedData(env);
  const made = await makeCode(env, agent);
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.equal(isAgentSignInCode(made.body.code), true);
  assert.deepEqual([made.body.address, made.body.origin, made.body.sessionSlug], [agent.address, APP_ORIGIN, SLUG]);
  assert.ok(made.body.expiresAt > Date.now() + 29 * 60_000 && made.body.expiresAt <= Date.now() + 30 * 60_000);
  // Only its hash is kept anywhere.
  assert.equal(JSON.stringify([...env.GROUP_KV.values.entries()]).includes(made.body.code), false);

  // The person opens the link: signed in as the agent's account, with no key.
  const opened = await exchange(env, made.body.code);
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.deepEqual(
    [opened.body.address, opened.body.via, opened.body.passkeyAttached, opened.body.agentAccess, opened.body.sessionSlug],
    [agent.address, 'agent_link', false, 'active', SLUG],
  );
  const linkToken = opened.body.token;
  assert.equal(await stands(env, linkToken), true);
  // The code is spent.
  assert.deepEqual((await exchange(env, made.body.code)).body, { error: 'This sign-in link has expired or was already used. Ask your agent for a new one.', reason: 'sign_in_code_invalid' });
  // The person answers as the account, and it is the account's answer.
  const changed = await answer(env, linkToken, personAnswer(agent));
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  const seen = await stateOf(env, linkToken);
  assert.deepEqual([seen.body.address, seen.body.via, seen.body.attachedPasskey, seen.body.agentParticipation], [agent.address, 'agent_link', null, true]);

  // A passkey is attached with its own signed consent, and the browser moves to a sign-in the passkey can renew.
  const attached = await attach(env, linkToken, passkey, account);
  assert.equal(attached.status, 200, JSON.stringify(attached.body));
  assert.deepEqual([attached.body.address, attached.body.via, attached.body.passkey, attached.body.agentAccess], [agent.address, 'passkey_link', passkey.address, 'active']);
  const keptToken = attached.body.token;
  assert.equal(await stands(env, keptToken), true);
  // Every sign-in the account had ended with it; the agent simply signs in again, and is told of the passkey.
  assert.equal(await stands(env, linkToken), false);
  assert.equal(await stands(env, agentToken, AGENT), false);
  const again = await signIn(env, agent, { headers: AGENT });
  assert.equal(again.status, 200);
  assert.deepEqual(again.body.attachedPasskey, { address: passkey.address.toLowerCase() });
  assert.equal(await stands(env, again.body.token, AGENT), true);

  // Later: the ordinary passkey sign-in, unchanged, says which account it is for, and is swapped for that account's.
  const own = await signIn(env, passkey);
  assert.equal(own.status, 200);
  assert.deepEqual(own.body.linkedAgentAccount, { address: account });
  const swapped = await passkeySignIn(env, own.body.token);
  assert.equal(swapped.status, 200, JSON.stringify(swapped.body));
  assert.deepEqual([swapped.body.address, swapped.body.via, swapped.body.agentAccess], [agent.address, 'passkey_link', 'active']);
  assert.equal(await stands(env, swapped.body.token), true);
  // And again through the agent, while its access is on.
  const second = await makeCode(env, agent);
  assert.equal((await exchange(env, second.body.code)).body.passkeyAttached, true);

  // Nothing the session already stored was rewritten: the one change is the answer the person gave.
  const after = JSON.parse(storedData(env));
  const earlier = JSON.parse(before);
  const [groupBefore, groupAfter] = [new Map(earlier[0]), new Map(after[0])];
  for (const [key, value] of groupBefore) assert.equal(groupAfter.get(key), value, key);
  const storageBefore = new Map(earlier[1]);
  for (const [key, value] of storageBefore) assert.equal(new Map(after[1]).get(key), value, key);
});

test('cancel all agent authorizations ends every way in for the agent, and only the passkey can do it or undo it', async (t) => {
  const { env } = await setup();
  const agent = Wallet.createRandom();
  const passkey = Wallet.createRandom();
  const account = agent.address.toLowerCase();
  const first = await makeCode(env, agent);
  const linkToken = (await exchange(env, first.body.code)).body.token;

  // Without a passkey there is nothing to cancel with.
  assert.equal((await setAccess(env, linkToken, 'cancelled')).body.reason, 'passkey_sign_in_required');
  assert.equal((await setAccess(env, await tokenOf(env, agent, { headers: AGENT }), 'cancelled')).body.reason, 'passkey_sign_in_required');

  const keptToken = (await attach(env, linkToken, passkey, account)).body.token;
  const agentToken = await tokenOf(env, agent, { headers: AGENT });
  const waiting = await makeCode(env, agent);
  const visitor = (await exchange(env, (await makeCode(env, agent)).body.code)).body.token;
  const unused = await makeCode(env, agent);
  assert.equal(waiting.status, 200);
  assert.equal(await stands(env, visitor), true);

  const cancelled = await setAccess(env, keptToken, 'cancelled');
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal(cancelled.body.agentAccess, 'cancelled');
  assert.ok(cancelled.body.signInsEnded >= 2);
  // The agent's sign-in, a sign-in its link gave, its unused code, a new sign-in and a new code: all refused.
  assert.equal(await stands(env, agentToken, AGENT), false);
  assert.equal(await stands(env, visitor), false);
  assert.equal((await answer(env, agentToken, agentAnswer(agent), AGENT)).status, 401);
  assert.equal((await exchange(env, unused.body.code)).body.reason, 'sign_in_code_invalid');
  const refused = await signIn(env, agent, { headers: AGENT });
  assert.deepEqual([refused.status, refused.body.reason], [403, 'agent_access_cancelled']);
  assert.equal((await signIn(env, agent)).body.reason, 'agent_access_cancelled');
  assert.deepEqual([(await makeCode(env, agent)).status, (await makeCode(env, agent)).body.reason], [403, 'agent_access_cancelled']);
  // The person is untouched, and so is the passkey's way back in.
  assert.equal(await stands(env, keptToken), true);
  const back = await passkeySignIn(env, await tokenOf(env, passkey));
  assert.deepEqual([back.status, back.body.agentAccess], [200, 'cancelled']);
  assert.equal((await answer(env, back.body.token, personAnswer(agent, 'Unsure'))).status, 200);
  assert.equal((await stateOf(env, keptToken)).body.attachedPasskey.agentAccess, 'cancelled');
  // The passkey stays on while it is the only way in.
  assert.equal((await detach(env, keptToken)).body.reason, 'agent_access_cancelled_first');

  // Allowed again: the agent signs in anew. Its old sign-in was deleted and stays dead.
  assert.equal((await setAccess(env, keptToken, 'active')).body.agentAccess, 'active');
  assert.equal(await stands(env, agentToken, AGENT), false);
  assert.equal(await stands(env, await tokenOf(env, agent, { headers: AGENT }), AGENT), true);
  assert.equal((await setAccess(env, keptToken, 'sometimes')).status, 400);

  // Removed: the passkey no longer signs in as the account, and its sign-ins as the account end.
  assert.deepEqual((await detach(env, keptToken)).body, { ok: true, detached: true });
  assert.equal(await stands(env, keptToken), false);
  assert.equal(await stands(env, back.body.token), false);
  assert.equal((await passkeySignIn(env, await tokenOf(env, passkey))).body.reason, 'passkey_not_attached');
  assert.equal((await signIn(env, passkey)).body.linkedAgentAccount, undefined);
  assert.equal(await stands(env, await tokenOf(env, agent, { headers: AGENT }), AGENT), true);
});

test('the account’s own key can also remove its passkey, while the agent may use the account', async (t) => {
  const { env } = await setup();
  const agent = Wallet.createRandom();
  const passkey = Wallet.createRandom();
  const linkToken = (await exchange(env, (await makeCode(env, agent)).body.code)).body.token;
  const keptToken = (await attach(env, linkToken, passkey, agent.address.toLowerCase())).body.token;
  // Not a sign-in a code made.
  const visitor = (await exchange(env, (await makeCode(env, agent)).body.code)).body.token;
  assert.equal((await detach(env, visitor)).body.reason, 'passkey_sign_in_required');
  assert.deepEqual((await detach(env, await tokenOf(env, agent, { headers: AGENT }))).body, { ok: true, detached: true });
  assert.equal(await stands(env, keptToken), false);
  assert.deepEqual((await detach(env, await tokenOf(env, agent, { headers: AGENT }))).body, { ok: true, detached: false });
});

test('a code works once, from the site it was made for, and one at a time', async () => {
  const { env } = await setup();
  const agent = Wallet.createRandom();
  const invalid = { error: 'This sign-in link has expired or was already used. Ask your agent for a new one.', reason: 'sign_in_code_invalid' };

  // Two tabs at once: exactly one is signed in.
  const raced = await makeCode(env, agent);
  const both = await Promise.all([exchange(env, raced.body.code), exchange(env, raced.body.code)]);
  assert.deepEqual(both.map((result) => result.status).sort(), [200, 401]);

  // A second code ends the first.
  const older = await makeCode(env, agent);
  const newer = await makeCode(env, agent);
  assert.deepEqual((await exchange(env, older.body.code)).body, invalid);
  assert.equal((await exchange(env, newer.body.code)).status, 200);

  // From a page that isn't the session's site: refused, and the code is spent by having been shown.
  const elsewhere = await makeCode(env, agent);
  const stranger = await exchange(env, elsewhere.body.code, { origin: 'https://evil.example' });
  assert.equal(stranger.status, 403);
  assert.equal((await exchange(env, elsewhere.body.code, { origin: '' })).status, 403);
  assert.equal((await exchange(env, elsewhere.body.code)).status, 200);

  // Anything that isn't a live code gets the same words, so nothing tells a guess how close it was.
  for (const code of ['', 'cesi_short', `cesi_${'A'.repeat(43)}`, raced.body.code, 42, null, { code: 'x' }]) {
    const answerTo = await exchange(env, code);
    assert.deepEqual([answerTo.status, answerTo.body], [401, invalid], String(code));
  }
  // Another session's id is not this session.
  const other = await makeCode(env, agent);
  assert.equal((await send(env, AGENT_SIGN_IN_PATHS.exchange, { body: { sessionSlug: SLUG, sessionId: `0x${'ef'.repeat(16)}`, code: other.body.code } })).status, 409);
});

test('only the account’s key, from an agent’s own client, can ask for a code', async (t) => {
  const { env, admin } = await setup();
  const agent = Wallet.createRandom();

  // No web page can ask: a browser can't send the agent header across origins, and can't hide that it is a page.
  const preflight = await fetchWorker(new Request(`${WORKER_ORIGIN}${AGENT_SIGN_IN_PATHS.create}`, {
    method: 'OPTIONS', headers: { Origin: APP_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, x-ce-agent-client' },
  }), env);
  assert.equal((preflight.headers.get('access-control-allow-headers') || '').toLowerCase().includes('x-ce-agent-client'), false);
  assert.equal((await makeCode(env, agent, { headers: {} })).body.reason, 'agent_client_required');
  assert.equal((await makeCode(env, agent, { headers: { ...AGENT, 'Sec-Fetch-Site': 'cross-site' } })).body.reason, 'agent_client_required');
  // Node's own fetch, which the MCP uses, sends Sec-Fetch-Mode with every request: that is no browser.
  assert.equal((await makeCode(env, agent, { headers: { ...AGENT, 'Sec-Fetch-Mode': 'cors', 'User-Agent': 'node' } })).status, 200);

  // A sign-in message is not a request for a code, and refusing it spends nothing: it still signs in.
  const ordinary = await signed(env, agent, SIGN_IN, { headers: AGENT });
  const wrong = await send(env, AGENT_SIGN_IN_PATHS.create, { body: ordinary, headers: AGENT });
  assert.deepEqual([wrong.status, wrong.body.reason], [400, 'wrong_statement']);
  assert.equal((await send(env, '/auth/login', { body: ordinary, headers: AGENT })).status, 200);
  // Nor is a request for a code, or a passkey's consent, a sign-in: refused there with its nonce unspent.
  const forCode = await signed(env, agent, AGENT_SIGN_IN_LINK_STATEMENT, { headers: AGENT });
  assert.deepEqual([(await send(env, '/auth/login', { body: forCode, headers: AGENT })).body.reason], ['wrong_statement']);
  assert.equal((await send(env, AGENT_SIGN_IN_PATHS.create, { body: forCode, headers: AGENT })).status, 200);
  const consent = await signed(env, agent, agentPasskeyAttachStatement(Wallet.createRandom().address));
  assert.equal((await send(env, '/auth/login', { body: consent })).body.reason, 'wrong_statement');
  // A signed request is used once.
  const asked = await signed(env, agent, AGENT_SIGN_IN_LINK_STATEMENT, { headers: AGENT });
  assert.equal((await send(env, AGENT_SIGN_IN_PATHS.create, { body: asked, headers: AGENT })).status, 200);
  assert.equal((await send(env, AGENT_SIGN_IN_PATHS.create, { body: asked, headers: AGENT })).status, 400);
  // Someone else's signature, or a sign-in in place of one, is nothing.
  const forged = { ...(await signed(env, agent, AGENT_SIGN_IN_LINK_STATEMENT, { headers: AGENT })), address: Wallet.createRandom().address };
  assert.equal((await send(env, AGENT_SIGN_IN_PATHS.create, { body: forged, headers: AGENT })).status, 400);
  const token = await tokenOf(env, agent, { headers: AGENT });
  assert.notEqual((await send(env, AGENT_SIGN_IN_PATHS.create, { token, body: session, headers: AGENT })).status, 200);
  // Never an admin's account, by a code made for it.
  assert.deepEqual([(await makeCode(env, admin)).status, (await makeCode(env, admin)).body.reason], [403, 'admin_account_not_supported']);

  // The day's codes for one account run out.
  const busy = Wallet.createRandom();
  let last;
  for (let made = 0; made <= AGENT_SIGN_IN_LIMITS.create; made += 1) last = await makeCode(env, busy);
  assert.equal(last.status, 429);
});

test('a sign-in from a link or a passkey has no more power than it needs, and a passkey is attached only by its own consent', async (t) => {
  const { env, admin } = await setup();
  const agent = Wallet.createRandom();
  const passkey = Wallet.createRandom();
  const account = agent.address.toLowerCase();
  const linkToken = (await exchange(env, (await makeCode(env, agent)).body.code)).body.token;

  // It is not the account's key: it attaches nothing without the passkey's consent for this very account.
  const other = Wallet.createRandom();
  assert.equal((await attach(env, linkToken, passkey, account, { statement: SIGN_IN })).body.reason, 'wrong_statement');
  assert.equal((await attach(env, linkToken, passkey, account, { statement: agentPasskeyAttachStatement(other.address) })).body.reason, 'wrong_statement');
  const consent = await signed(env, passkey, agentPasskeyAttachStatement(account));
  const stolen = await send(env, AGENT_SIGN_IN_PATHS.attach, { token: linkToken, body: { ...session, passkey: { ...consent, address: other.address } } });
  assert.equal(stolen.status, 400);
  assert.equal(readAgentPasskeyAttachStatement(agentPasskeyAttachStatement(agent.address)), account);
  assert.equal(readAgentPasskeyAttachStatement(`${agentPasskeyAttachStatement(account)} And more.`), '');
  // The account itself, and an admin, are not passkeys for it.
  assert.equal((await attach(env, linkToken, agent, account)).body.reason, 'invalid_passkey');
  assert.equal((await attach(env, linkToken, admin, account)).body.reason, 'passkey_is_admin');
  // Only a sign-in a code gave attaches one: not the agent's own, and not a stranger's.
  const agentToken = await tokenOf(env, agent, { headers: AGENT });
  assert.equal((await attach(env, agentToken, passkey, account)).body.reason, 'sign_in_link_required');
  assert.equal((await attach(env, await tokenOf(env, other), passkey, other.address.toLowerCase())).body.reason, 'sign_in_link_required');
  assert.equal((await send(env, AGENT_SIGN_IN_PATHS.attach, { body: { ...session, passkey: consent } })).status, 401);

  const attached = await attach(env, linkToken, passkey, account);
  assert.equal(attached.status, 200, JSON.stringify(attached.body));
  // One passkey for an account, one account for a passkey.
  const secondAgent = Wallet.createRandom();
  const secondLink = (await exchange(env, (await makeCode(env, secondAgent)).body.code)).body.token;
  assert.equal((await attach(env, secondLink, passkey, secondAgent.address.toLowerCase())).body.reason, 'passkey_in_use');
  const freshLink = (await exchange(env, (await makeCode(env, agent)).body.code)).body.token;
  assert.equal((await attach(env, freshLink, Wallet.createRandom(), account)).body.reason, 'account_has_passkey');
  // An account that is someone's passkey takes none, and a passkey's own account is not attached as a passkey.
  const chained = (await exchange(env, (await makeCode(env, passkey)).body.code)).body.token;
  assert.equal((await attach(env, chained, Wallet.createRandom(), passkey.address.toLowerCase())).body.reason, 'passkey_in_use');
  assert.equal((await attach(env, secondLink, agent, secondAgent.address.toLowerCase())).body.reason, 'passkey_in_use');

  // A sign-in made here is swapped for nothing further, and reads no admin list.
  const kept = attached.body.token;
  for (const token of [kept, freshLink]) {
    assert.equal((await passkeySignIn(env, token)).body.reason, 'passkey_sign_in_required');
    assert.equal((await send(env, '/admin/feedback', { method: 'GET', token })).status, 403);
  }
  // A passkey with nothing attached is told so; the agent's own key is not a passkey for itself.
  assert.equal((await passkeySignIn(env, await tokenOf(env, other))).status, 404);
  assert.equal((await passkeySignIn(env, await tokenOf(env, agent, { headers: AGENT }))).status, 404);
  // Unsigned, every route but the exchange asks for a sign-in.
  for (const path of [AGENT_SIGN_IN_PATHS.passkeySignIn, AGENT_SIGN_IN_PATHS.access, AGENT_SIGN_IN_PATHS.detach, AGENT_SIGN_IN_PATHS.state]) {
    assert.equal((await send(env, path, { body: session })).status, 401, path);
  }
  // A forged claim is not a sign-in.
  const [body, mac] = kept.split('.');
  const forgedBody = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString('utf8')), actor: other.address.toLowerCase() })).toString('base64url');
  assert.equal(await stands(env, `${forgedBody}.${mac}`), false);
});

test('a session with AI agents switched off refuses what says it is an agent, and nothing else', async (t) => {
  const off = await setup({ agentParticipationEnabled: false });
  const agent = Wallet.createRandom();
  const person = Wallet.createRandom();
  // Sign-ins and codes.
  const refused = await signIn(off.env, agent, { headers: AGENT });
  assert.deepEqual([refused.status, refused.body], [403, { error: 'This session has AI agents switched off.', reason: 'agent_participation_off' }]);
  assert.equal((await makeCode(off.env, agent)).body.reason, 'agent_participation_off');
  // A person's sign-in is as before, and so is their answer.
  const personToken = await tokenOf(off.env, person);
  assert.equal((await answer(off.env, personToken, personAnswer(person))).status, 200);
  // Anything that says an agent made it is not stored, and a signed-in request that says it is an agent's is not answered.
  assert.deepEqual([(await answer(off.env, personToken, agentAnswer(person))).status, (await answer(off.env, personToken, agentAnswer(person))).body.reason], [403, 'agent_participation_off']);
  assert.equal(await stands(off.env, personToken, AGENT), false);
  assert.equal(await stands(off.env, personToken), true);
  // An admin's own tools are not locked out.
  assert.equal((await signIn(off.env, off.admin, { headers: AGENT })).status, 200);

  // On, or never set, everything is as it was.
  for (const overrides of [{}, { agentParticipationEnabled: true }]) {
    const on = await setup(overrides);
    const token = await tokenOf(on.env, agent, { headers: AGENT });
    assert.equal((await answer(on.env, token, agentAnswer(agent), AGENT)).status, 200);
    assert.equal((await makeCode(on.env, agent)).status, 200);
  }

  // Switched off while a code waits and an agent is signed in: both stop, and nobody is signed out.
  const live = await setup();
  const agentToken = await tokenOf(live.env, agent, { headers: AGENT });
  const personLive = await tokenOf(live.env, person);
  const waiting = await makeCode(live.env, agent);
  const saved = await signedAdminRequest({ env: live.env, wallet: live.admin, action: 'set-config', body: { config: { agentParticipationEnabled: false } } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal((await exchange(live.env, waiting.body.code)).body.reason, 'agent_participation_off');
  assert.equal(await stands(live.env, agentToken, AGENT), false);
  assert.equal(await stands(live.env, personLive), true);
  const bad = await signedAdminRequest({ env: live.env, wallet: live.admin, action: 'set-config', body: { config: { agentParticipationEnabled: 'no' } } });
  assert.equal(bad.status, 400);
  // The Worker says it has all this.
  const features = (await send(live.env, '/capabilities', { method: 'GET' })).body.features;
  assert.ok(features.includes(AGENT_SIGN_IN_FEATURE));
});

test('the coordinator keeps a code only as its hash, and judges it only after deleting it', async () => {
  const values = new Map();
  const txn = {
    get: async (key) => values.get(key),
    put: async (key, value) => { values.set(key, structuredClone(value)); },
    delete: async (key) => values.delete(key),
    list: async ({ prefix = '', limit = Infinity } = {}) => new Map([...values].filter(([key]) => key.startsWith(prefix)).slice(0, limit)),
  };
  const coordinator = { state: { storage: { transaction: (run) => run(txn) } } };
  const call = async (operation, payload) => (await dispatchAgentSignInStore(coordinator, operation, payload)).json();
  const account = `0x${'a1'.repeat(20)}`;
  const hash = 'ab'.repeat(32);
  const now = 1_000_000;
  assert.deepEqual(await call('code-create', { address: account, codeHash: hash, origin: APP_ORIGIN, expiresAt: now + 1000, now }), { ok: true, expiresAt: now + 1000 });
  assert.deepEqual([...values.keys()].sort(), [`agent-signin-code:v1:${hash}`, `agent-signin-live:v1:${account}`]);
  // A wrong origin spends it, as any showing does.
  assert.equal((await call('code-redeem', { codeHash: hash, origin: 'https://evil.example', now })).reason, 'sign_in_code_invalid');
  assert.equal(values.size, 0);
  assert.equal((await call('code-redeem', { codeHash: hash, origin: APP_ORIGIN, now })).reason, 'sign_in_code_invalid');
  // Thirty minutes on, to the millisecond, an unused code is dead, and is deleted for having been shown.
  await call('code-create', { address: account, codeHash: hash, origin: APP_ORIGIN, expiresAt: now + 30 * 60_000, now });
  assert.equal((await call('code-redeem', { codeHash: hash, origin: APP_ORIGIN, now: now + 30 * 60_000 })).reason, 'sign_in_code_invalid');
  assert.equal(values.size, 0);
  await call('code-create', { address: account, codeHash: hash, origin: APP_ORIGIN, expiresAt: now + 30 * 60_000, now });
  assert.deepEqual(await call('code-redeem', { codeHash: hash, origin: APP_ORIGIN, now: now + 30 * 60_000 - 1 }), { ok: true, account, link: null });
  // Unused codes are cleared when a new one is made.
  for (let index = 0; index < 5; index += 1) {
    await call('code-create', { address: `0x${String(index).repeat(40)}`, codeHash: String(index).repeat(64), origin: APP_ORIGIN, expiresAt: now + 10, now });
  }
  await call('code-create', { address: account, codeHash: hash, origin: APP_ORIGIN, expiresAt: now + 5000, now: now + 1000 });
  assert.deepEqual([...values.keys()].filter((key) => key.startsWith('agent-signin-code:')), [`agent-signin-code:v1:${hash}`]);
  // Malformed asks are refused before anything is read or written.
  for (const [operation, payload] of [
    ['code-create', { address: account, codeHash: 'short', origin: APP_ORIGIN, expiresAt: now + 10, now }],
    ['code-create', { address: 'nobody', codeHash: hash, origin: APP_ORIGIN, expiresAt: now + 10, now }],
    ['code-create', { address: account, codeHash: hash, origin: APP_ORIGIN, expiresAt: now - 1, now }],
    ['attach', { address: account, passkey: account, now }],
    ['attach', { address: account, passkey: 'not-an-address', now }],
    ['state', {}],
    ['nothing', { address: account }],
  ]) {
    assert.equal((await call(operation, payload)).ok, false, operation);
  }
});

// --- From the security audit ---

const decode = (token) => JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));

test('a sign-in from a link is short, and one through the passkey never outlasts the passkey’s own', async () => {
  const { env } = await setup();
  const agent = Wallet.createRandom();
  const passkey = Wallet.createRandom();
  const now = Math.floor(Date.now() / 1000);
  const linkToken = (await exchange(env, (await makeCode(env, agent)).body.code)).body.token;
  assert.ok(decode(linkToken).exp - now <= 60 * 60 + 5 && decode(linkToken).exp - now > 59 * 60);
  await attach(env, linkToken, passkey, agent.address.toLowerCase());
  const own = await tokenOf(env, passkey);
  const swapped = await passkeySignIn(env, own);
  assert.ok(decode(swapped.body.token).exp <= decode(own).exp);
});

test('nothing the account’s own key does can keep its person from ending the agent’s access', async () => {
  const { env } = await setup();
  const agent = Wallet.createRandom();
  const passkey = Wallet.createRandom();
  // The agent asks to remove a passkey that isn't there, as often as it likes, before sending its link.
  const agentToken = await tokenOf(env, agent, { headers: AGENT });
  for (let asked = 0; asked < 30; asked += 1) assert.deepEqual((await detach(env, agentToken)).body, { ok: true, detached: false });
  const linkToken = (await exchange(env, (await makeCode(env, agent)).body.code)).body.token;
  const kept = (await attach(env, linkToken, passkey, agent.address.toLowerCase())).body.token;
  const cancelled = await setAccess(env, kept, 'cancelled');
  assert.deepEqual([cancelled.status, cancelled.body.agentAccess, cancelled.body.signInsEndedAll], [200, 'cancelled', true]);
  assert.equal((await setAccess(env, kept, 'active')).status, 200);
  assert.deepEqual((await detach(env, kept)).body, { ok: true, detached: true });
});

test('a sign-in the sweep never finds is still ended: every sign-in of an account with a passkey is checked', async () => {
  const { env } = await setup();
  const agent = Wallet.createRandom();
  const passkey = Wallet.createRandom();
  // Signed in before any passkey: this sign-in says nothing of one.
  const early = await tokenOf(env, agent, { headers: AGENT });
  assert.equal(decode(early).agentLinked, undefined);
  const linkToken = (await exchange(env, (await makeCode(env, agent)).body.code)).body.token;
  // The store lists nothing and deletes nothing, as when a list lags or a delete fails.
  const kv = env.GROUP_KV;
  const [list, remove] = [kv.list.bind(kv), kv.delete.bind(kv)];
  kv.list = async (options) => (String(options?.prefix).startsWith('authToken:') ? { keys: [], list_complete: true } : list(options));
  const kept = (await attach(env, linkToken, passkey, agent.address.toLowerCase())).body.token;
  // Still standing after the attach, while the agent may use the account.
  assert.equal(await stands(env, early, AGENT), true);
  kv.list = list;
  kv.delete = async (key) => { if (String(key).startsWith('authToken:')) throw new Error('store unavailable'); return remove(key); };
  const cancelled = await setAccess(env, kept, 'cancelled');
  assert.deepEqual([cancelled.status, cancelled.body.agentAccess, cancelled.body.signInsEndedAll], [200, 'cancelled', false]);
  kv.delete = remove;
  // Its record is still there, and it is refused all the same; so is anything made from it.
  assert.equal(await stands(env, early, AGENT), false);
  assert.equal((await answer(env, early, agentAnswer(agent), AGENT)).status, 401);
  const { validateAuthTokenRecord } = await import('./authTokenClaims.js');
  const { sub, jti } = decode(early);
  assert.equal((await validateAuthTokenRecord({ env, payload: { sub, jti }, slug: SLUG })).ok, false);
  assert.equal((await validateAuthTokenRecord({ env, payload: decode(kept), slug: SLUG })).ok, true);
  // Allowed again, it stands again, as a new sign-in would.
  assert.equal((await setAccess(env, kept, 'active')).status, 200);
  assert.equal(await stands(env, early, AGENT), true);
  // The passkey gone, the account is no longer looked up.
  assert.equal((await detach(env, kept)).status, 200);
  assert.equal([...env.GROUP_KV.values.keys()].some((key) => key.startsWith('agentLinkAccount:')), false);
  assert.equal(await stands(env, early, AGENT), true);
});

test('a session admin can take a passkey off, which also lifts a cancellation; nobody else can', async () => {
  const { env, admin } = await setup();
  const agent = Wallet.createRandom();
  const passkey = Wallet.createRandom();
  const linkToken = (await exchange(env, (await makeCode(env, agent)).body.code)).body.token;
  const kept = (await attach(env, linkToken, passkey, agent.address.toLowerCase())).body.token;
  assert.equal((await setAccess(env, kept, 'cancelled')).status, 200);
  assert.equal((await signIn(env, agent, { headers: AGENT })).body.reason, 'agent_access_cancelled');
  // Not by the passkey's holder, who is no admin.
  assert.notEqual((await signedAdminRequest({ env, wallet: passkey, action: 'agent-link/clear', body: { member: agent.address } })).status, 200);
  assert.equal((await signedAdminRequest({ env, wallet: admin, action: 'agent-link/clear', body: { member: 'nobody' } })).status, 400);
  const cleared = await signedAdminRequest({ env, wallet: admin, action: 'agent-link/clear', body: { member: agent.address } });
  assert.deepEqual([cleared.status, cleared.body], [200, { cleared: true }]);
  // The account is its key's again; the passkey's sign-ins as it are over.
  assert.equal(await stands(env, kept), false);
  assert.equal((await signIn(env, agent, { headers: AGENT })).status, 200);
  assert.equal((await passkeySignIn(env, await tokenOf(env, passkey))).body.reason, 'passkey_not_attached');
  assert.deepEqual((await signedAdminRequest({ env, wallet: admin, action: 'agent-link/clear', body: { member: agent.address } })).body, { cleared: false });
});

test('an account the session gives a power to is never signed in to from a link, and a link sign-in reads nothing for admins', async () => {
  const resultsAdmin = Wallet.createRandom();
  const { env } = await setup({ resultsAdminAddresses: [resultsAdmin.address] });
  assert.equal((await makeCode(env, resultsAdmin)).body.reason, 'admin_account_not_supported');
  const agent = Wallet.createRandom();
  const linkToken = (await exchange(env, (await makeCode(env, agent)).body.code)).body.token;
  for (const path of ['/admin/results-analysis/status', '/admin/diagnostics', '/admin/feedback', '/admin/session-agent/chats']) {
    assert.equal((await send(env, path, { method: 'GET', token: linkToken })).status, 403, path);
  }
});

test('a sign-in link is never stored in the session, and junk spends none of a network’s exchanges', async () => {
  const { env } = await setup();
  const agent = Wallet.createRandom();
  const token = await tokenOf(env, agent, { headers: AGENT });
  const made = await makeCode(env, agent);
  for (const text of [made.body.code, `Open https://app.example/session/x?worker=y#agentSignIn=${made.body.code} now`]) {
    const posted = await answer(env, token, { ...agentAnswer(agent), additional: { value: text } }, AGENT);
    assert.deepEqual([posted.status, posted.body.reason], [400, 'sign_in_link_in_content']);
  }
  assert.equal(JSON.stringify([...env.CE_STORAGE_INDEX_KV.values.entries()]).includes(made.body.code), false);
  // Far past the day's count of real tries, something that isn't a code is still just refused.
  for (let tried = 0; tried < 12; tried += 1) assert.equal((await exchange(env, `junk-${tried}`)).status, 401);
  assert.equal((await exchange(env, made.body.code)).status, 200);
});

test('a backup carries which passkey is attached and whose agent is cancelled, and never a code', async () => {
  const { isAgentLinksBackup, listAgentLinks, restoreAgentLinks } = await import('./agentSignInStore.js');
  const values = new Map();
  const storage = {
    get: async (key) => values.get(key),
    put: async (key, value) => { values.set(key, structuredClone(value)); },
    delete: async (key) => values.delete(key),
    list: async ({ prefix = '', startAfter = '', limit = Infinity } = {}) => new Map([...values].filter(([key]) => key.startsWith(prefix) && key > startAfter).sort().slice(0, limit)),
    transaction: (run) => run(storage),
  };
  const call = async (operation, payload) => (await dispatchAgentSignInStore({ state: { storage } }, operation, payload)).json();
  const [account, passkey, other, otherKey] = ['a1', 'b2', 'c3', 'd4'].map((byte) => `0x${byte.repeat(20)}`);
  const now = Date.parse('2026-11-20T10:00:00Z');
  await call('code-create', { address: account, codeHash: 'ab'.repeat(32), origin: APP_ORIGIN, expiresAt: now + 1000, now });
  await call('attach', { address: account, passkey, now });
  await call('access', { address: account, passkey, agentAccess: 'cancelled', now });
  await call('attach', { address: other, passkey: otherKey, now });
  const rows = await listAgentLinks(storage);
  assert.deepEqual(rows, [
    { account, passkey, linkedAt: '2026-11-20T10:00:00.000Z', agentAccess: 'cancelled' },
    { account: other, passkey: otherKey, linkedAt: '2026-11-20T10:00:00.000Z', agentAccess: 'active' },
  ]);
  assert.equal(isAgentLinksBackup(rows), true);
  assert.equal(JSON.stringify(rows).includes('ab'.repeat(32)), false);
  for (const bad of [null, [{ account, passkey: account, linkedAt: null, agentAccess: 'active' }], [{ ...rows[0], extra: 1 }], [rows[0], { ...rows[1], passkey }],
    [{ ...rows[0], agentAccess: 'maybe' }], [{ ...rows[0], account: account.toUpperCase() }]]) {
    assert.equal(isAgentLinksBackup(bad), false, JSON.stringify(bad));
  }
  // Restored onto a fresh session: the cancelled agent stays out, and the passkey still opens its account.
  values.clear();
  assert.deepEqual(await restoreAgentLinks(storage, rows), { written: 2, skipped: 0 });
  assert.equal((await call('state', { address: account })).asAccount.agentAccess, 'cancelled');
  assert.deepEqual((await call('state', { address: passkey })).asPasskey, { account });
  assert.equal((await call('code-create', { address: account, codeHash: 'cd'.repeat(32), origin: APP_ORIGIN, expiresAt: now + 1000, now })).reason, 'agent_access_cancelled');
  // What is already there is the newer word, and stays.
  assert.deepEqual(await restoreAgentLinks(storage, rows), { written: 0, skipped: 2 });
});
