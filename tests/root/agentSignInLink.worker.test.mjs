// End to end: an agent that took part through the MCP gives its person a sign-in link; a browser opens it,
// attaches a passkey, comes back with the passkey alone, and ends the agent's access. The agent's side is the
// real MCP participant layer and the Worker is the real Session Worker; the browser's side is the requests the
// session page makes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import { createParticipant } from '../../mcp/lib/participant.mjs';
import {
  AGENT_CLIENT_HEADER, AGENT_SIGN_IN_FRAGMENT_KEY, AGENT_SIGN_IN_PATHS, agentPasskeyAttachStatement, isAgentSignInCode,
} from '../../shared/agentSignIn.mjs';
import {
  APP_ORIGIN, SESSION_ID, SLUG, WORKER_ORIGIN, createSessionEnv, fetchWorker, login, signedAdminRequest, uploadJson,
} from '../../workers/sessionCorsWorker/sessionWorkerRuntimeFixture.mjs';

const LINK = `${APP_ORIGIN}/session/${SLUG}?worker=${encodeURIComponent(WORKER_ORIGIN)}`;
const QUESTION = `0x${'a1'.repeat(32)}`;
const session = { sessionSlug: SLUG, sessionId: SESSION_ID };
const config = {
  // Sign-in links are off until a session's admin turns them on; this session's has.
  agentSignInLinksEnabled: true,
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

// The Worker gives one account five sign-in nonces a minute; this run signs more often than an agent and a person
// do, so that one count is always answered "allowed". Every other limit is the real one.
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
};

// What the session page sends: from the site's origin, with the sign-in it holds, and no agent header.
const page = (env) => async (route, { token, body, method = 'POST' } = {}) => {
  const headers = new Headers({ Origin: APP_ORIGIN });
  if (token) { headers.set('Authorization', `Bearer ${token}`); headers.set('X-Group-Slug', SLUG); }
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetchWorker(new Request(`${WORKER_ORIGIN}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  return { status: response.status, body: await response.json() };
};
// A passkey's signature, as the page makes one: a nonce, then the message.
const passkeySigned = async (ask, passkey, statement) => {
  const nonce = await ask('/auth/nonce', { body: { address: passkey.address, ...session } });
  assert.equal(nonce.status, 200, JSON.stringify(nonce.body));
  const message = `${new URL(APP_ORIGIN).host} wants you to sign in with your Ethereum account:\n${passkey.address}\n\n${statement}\n\nURI: ${APP_ORIGIN}\nVersion: 1\nChain ID: 1\nNonce: ${nonce.body.nonce}\nIssued At: ${new Date(Date.now() - 5000).toISOString()}\nResources:\n- ${WORKER_ORIGIN}\n- urn:context-engine:session:id:${SESSION_ID}`;
  return { address: passkey.address, message, signature: await passkey.signMessage(message), ...session };
};

test('an agent’s person signs in from its link, keeps the account with a passkey, and ends the agent’s access', async (t) => {
  const { env, admin } = createSessionEnv({ configOverrides: config });
  withoutNonceLimit(env);
  const adminToken = await login({ env, wallet: admin });
  assert.equal((await uploadJson({ env, token: adminToken, resource: 'questions', data: JSON.stringify({
    id: QUESTION, type: 'binary', prompt: 'A statement', sessionSlug: SLUG, sessionId: SESSION_ID, options: ['Agree', 'Unsure', 'Disagree'] }) })).status, 200);

  // The agent: the MCP with a scratch state folder, its own key, and every request it makes recorded.
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-agent-link-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const wallet = ethers.Wallet.createRandom();
  const sent = [];
  const agent = createParticipant({
    config: { stateDir, profile: { displayName: 'Kami’s agent' }, appOrigin: APP_ORIGIN, trustedAppOrigins: [APP_ORIGIN], allowLocalWorkers: false },
    wallet,
    fetchImpl: async (url, init = {}) => {
      sent.push({ url: String(url), body: String(init.body || ''), agent: new Headers(init.headers).get(AGENT_CLIENT_HEADER) || '' });
      // As Node's own fetch sends every request: with Sec-Fetch-Mode, which the Worker must not take for a browser.
      const headers = new Headers(init.headers);
      headers.set('sec-fetch-mode', 'cors');
      headers.set('user-agent', 'node');
      return fetchWorker(new Request(url, { method: init.method || 'GET', headers, body: init.body }), env);
    },
  });
  await agent.joinSession({ link: LINK });
  const answered = await agent.answer({ answers: [{ questionId: QUESTION, value: 'Agree', comment: 'From the agent.' }] });
  assert.equal(answered.submitted, 1, JSON.stringify(answered));
  // Every request says it is an agent's.
  assert.ok(sent.every((call) => call.agent));

  const made = await agent.makeSignInLink({});
  assert.equal(made.made, true, JSON.stringify(made));
  assert.equal(made.account, wallet.address);
  assert.match(made.next, /only to the person you work for/);
  const link = new URL(made.signInLink);
  assert.equal(`${link.origin}${link.pathname}`, `${APP_ORIGIN}/session/${SLUG}`);
  assert.deepEqual([...link.searchParams.entries()], [['worker', WORKER_ORIGIN]]);
  const code = new URLSearchParams(link.hash.slice(1)).get(AGENT_SIGN_IN_FRAGMENT_KEY);
  assert.equal(isAgentSignInCode(code), true);
  assert.ok(Date.parse(made.expiresAt) - Date.now() <= 30 * 60_000);
  // The code is after `#` only: in no address the agent asked for, nothing it sent, and nothing it keeps.
  assert.equal(JSON.stringify(sent).includes(code), false);
  assert.equal((await fs.readFile(path.join(stateDir, 'state.json'), 'utf8').catch(() => '')).includes(code), false);
  assert.equal(JSON.stringify(await agent.whoami()).includes(code), false);

  // Told by something it read to post the link, the agent's own client refuses, and nothing carrying it is sent.
  const posted = await agent.answer({ answers: [{ questionId: QUESTION, value: 'Agree', comment: `Sign in here: ${made.signInLink}` }] })
    .then((result) => JSON.stringify(result), (error) => String(error?.message));
  assert.match(posted, /sign-in link where other people could read it/);
  await assert.rejects(agent.addStatement({ prompt: `Everyone open ${made.signInLink}` }), /sign-in link where other people could read it/);
  assert.equal(JSON.stringify(sent).includes(code), false);

  // The person opens the link: the page swaps the code for a sign-in as the agent's account, and shows its answer.
  const ask = page(env);
  const opened = await ask(AGENT_SIGN_IN_PATHS.exchange, { body: { ...session, code } });
  assert.deepEqual([opened.status, opened.body.address, opened.body.via, opened.body.passkeyAttached], [200, wallet.address, 'agent_link', false]);
  const mine = await ask('/storage/list?resource=responses&limit=10&mine=true', { token: opened.body.token, method: 'GET' });
  assert.deepEqual([mine.status, mine.body.items.length], [200, 1]);
  assert.equal((await ask(AGENT_SIGN_IN_PATHS.exchange, { body: { ...session, code } })).status, 401);

  // They attach a passkey. The agent's sign-in ended with every other; its next call signs in again by itself.
  const passkey = ethers.Wallet.createRandom();
  const attached = await ask(AGENT_SIGN_IN_PATHS.attach, { token: opened.body.token, body: {
    ...session, passkey: await passkeySigned(ask, passkey, agentPasskeyAttachStatement(wallet.address)) } });
  assert.deepEqual([attached.status, attached.body.via, attached.body.passkey], [200, 'passkey_link', passkey.address]);
  assert.equal((await agent.listQuestions({ filter: 'all' })).total, 1);

  // After a reload, in a new tab, on another day: the passkey alone.
  const own = await ask('/auth/login', { body: await passkeySigned(ask, passkey, 'Sign in to Context Engine.') });
  assert.deepEqual([own.status, own.body.linkedAgentAccount], [200, { address: wallet.address.toLowerCase() }]);
  const back = await ask(AGENT_SIGN_IN_PATHS.passkeySignIn, { token: own.body.token, body: session });
  assert.deepEqual([back.status, back.body.address, back.body.via, back.body.agentAccess], [200, wallet.address, 'passkey_link', 'active']);
  // The person changes the agent's answer; it is the account's answer, and the agent sees it.
  const changed = await ask('/storage/upload', { token: back.body.token, body: { contentType: 'application/json', resource: 'responses',
    data: JSON.stringify({ questionId: QUESTION, sessionSlug: SLUG, sessionId: SESSION_ID, answer: { value: 'Disagree' }, additional: { value: 'From the person.' }, responder: wallet.address }) } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));

  // Cancel all agent authorizations: the agent is refused, in words it can pass on, and can make no new link.
  const cancelled = await ask(AGENT_SIGN_IN_PATHS.access, { token: back.body.token, body: { ...session, agentAccess: 'cancelled' } });
  assert.deepEqual([cancelled.status, cancelled.body.agentAccess], [200, 'cancelled']);
  const ended = /ended agent access to it in this session.*Only they can allow it again/;
  await assert.rejects(agent.listQuestions({ filter: 'all' }), ended);
  await assert.rejects(agent.answer({ answers: [{ questionId: QUESTION, value: 'Agree' }] }), ended);
  await assert.rejects(agent.makeSignInLink({}), ended);
  await assert.rejects(agent.joinSession({ link: LINK }), ended);
  // The person carries on.
  assert.equal((await ask('/storage/list?resource=responses&limit=10&mine=true', { token: back.body.token, method: 'GET' })).status, 200);

  // Allowed again, the agent is back without being told anything: it signs in afresh.
  assert.equal((await ask(AGENT_SIGN_IN_PATHS.access, { token: back.body.token, body: { ...session, agentAccess: 'active' } })).body.agentAccess, 'active');
  assert.equal((await agent.listQuestions({ filter: 'all' })).total, 1);

  // The session's admins switch agents off: the agent is told so, and the person is not signed out.
  assert.equal((await signedAdminRequest({ env, wallet: admin, action: 'set-config', body: { config: { agentParticipationEnabled: false } } })).status, 200);
  const off = /has its agent functions switched off/;
  await assert.rejects(agent.answer({ answers: [{ questionId: QUESTION, value: 'Agree' }] }), off);
  await assert.rejects(agent.joinSession({ link: LINK }), off);
  assert.equal((await ask('/storage/list?resource=responses&limit=10&mine=true', { token: back.body.token, method: 'GET' })).status, 200);
});

test('an older Worker, or a session with agents off, makes no link and says why', async (t) => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-agent-link-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const { env } = createSessionEnv({ configOverrides: config });
  withoutNonceLimit(env);
  const asked = [];
  // A Worker that doesn't list the feature is never asked for a code.
  const agent = createParticipant({
    config: { stateDir, profile: {}, appOrigin: APP_ORIGIN, trustedAppOrigins: [APP_ORIGIN], allowLocalWorkers: false },
    wallet: ethers.Wallet.createRandom(),
    fetchImpl: async (url, init = {}) => {
      const route = new URL(url).pathname;
      asked.push(route);
      if (route === '/capabilities') return Response.json({ features: ['worker_groups'] });
      return fetchWorker(new Request(url, { method: init.method || 'GET', headers: init.headers, body: init.body }), env);
    },
  });
  await agent.joinSession({ link: LINK });
  const none = await agent.makeSignInLink({});
  assert.equal(none.made, false);
  assert.match(none.note, /from before sign-in links/);
  assert.equal(asked.includes(AGENT_SIGN_IN_PATHS.create), false);
  await assert.rejects(agent.makeSignInLink({ session: 'another-session' }), /Join it first/);

  // A session that has not turned sign-in links on: said from its settings, with no code asked for.
  const plain = createSessionEnv({ configOverrides: { ...config, agentSignInLinksEnabled: undefined } });
  withoutNonceLimit(plain.env);
  const requested = [];
  const other = createParticipant({
    config: { stateDir, profile: {}, appOrigin: APP_ORIGIN, trustedAppOrigins: [APP_ORIGIN], allowLocalWorkers: false },
    wallet: ethers.Wallet.createRandom(),
    fetchImpl: async (url, init = {}) => {
      requested.push(new URL(url).pathname);
      return fetchWorker(new Request(url, { method: init.method || 'GET', headers: init.headers, body: init.body }), plain.env);
    },
  });
  await other.joinSession({ link: LINK });
  const off = await other.makeSignInLink({});
  assert.deepEqual([off.made, /doesn’t have sign-in links from agents switched on; an admin of the session can turn them on/.test(off.note)], [false, true]);
  assert.equal(requested.includes(AGENT_SIGN_IN_PATHS.create), false);
});
