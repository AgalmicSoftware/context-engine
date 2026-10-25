import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import { normalizeSessionPolicy, resolveSessionInvocation } from './sessionPolicy.mjs';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';

const QID = `0x${'12'.repeat(32)}`;
const SESSION_ID = `0x${'ab'.repeat(16)}`;
class MemoryKv {
  store = new Map();
  async get(key) { return this.store.get(key) ?? null; }
  async put(key, value) { this.store.set(key, value); }
  async delete(key) { this.store.delete(key); }
  async list({ prefix = '' } = {}) { return { list_complete: true, keys: [...this.store.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })) }; }
}
function session(overrides = {}) {
  return { sessionSlug: 'alpha', sessionName: 'Alpha', sessionIdHex: SESSION_ID, sessionWorkerUrl: 'https://worker.example', managedAccountSubmitAllowed: true, telegramGroupOpenAccess: true,
    sessionModeProfile: { authority: { mode: 'worker_canonical' }, surfaces: { agentHttp: true, telegram: false, miniApp: false } }, ...overrides };
}
async function fixture(sessions = [session()]) {
  const sent = [];
  const authRequests = [];
  let broadcasts = 0;
  const env = {
    AGENT_ACTION_KV: new MemoryKv(), DEMO_SIGNER_ROOT_SECRET: 'fixture-root', AGENT_BRIDGE_AGENT_API_TOKEN: 'fixture-token',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture', AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{ questionId: QID, questionType: 'freeform', prompt: 'Your answer?' }]),
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({ defaultSessionSlug: 'alpha', riskCeiling: 'submit', sessions }),
    AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED: 'true', AGENT_RESPONSE_QUEUE: { send: async body => sent.push(body) },
    AGENT_BRIDGE_SESSION_WORKER_URL: 'https://worker.example',
    AGENT_BRIDGE_FETCH: async (url, init) => {
      if (url.includes('/auth/')) {
        const body = JSON.parse(init.body);
        authRequests.push({ url, body });
        return Response.json({ sessionSlug: body.sessionSlug, sessionId: body.sessionId,
          ...(url.endsWith('/auth/nonce') ? { nonce: 'fixture-nonce' } : { token: 'fixture-auth' }) });
      }
      if (url.endsWith('/storage/upload')) return Response.json({ id: Buffer.alloc(32, 1).toString('base64url') });
      throw new Error(`Unexpected request ${url}`);
    },
    AGENT_BRIDGE_CONTRACT_FACTORY: () => ({ submitResponses: async () => { broadcasts += 1; return { hash: `0x${'34'.repeat(32)}` }; } }),
  };
  // Historical bindings remain readable; the retained HTTP route needs no bot.
  await env.AGENT_ACTION_KV.put('telegram:group-session:-100123', JSON.stringify({ sessionSlug: 'alpha' }));
  return { env, sent, authRequests, broadcasts: () => broadcasts };
}
function request(path, { method = 'GET', body, token = 'fixture-token' } = {}) {
  const url = new URL(path, 'https://bridge.example');
  if (method === 'GET') { url.searchParams.set('sessionSlug', 'alpha'); url.searchParams.set('telegramUserId', '42'); url.searchParams.set('groupChatId', '-100123'); }
  return new Request(url, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify({ sessionSlug: 'alpha', telegramUserId: '42', groupChatId: '-100123', ...body }) } : {}) });
}

test('hosted HTTP readiness and invocation do not require Telegram', async () => {
  const { env } = await fixture();
  const policy = normalizeSessionPolicy(JSON.parse(env.AGENT_BRIDGE_SESSION_POLICY_JSON));
  assert.equal(resolveSessionInvocation(policy, 'alpha').ok, true);
  const response = await worker.fetch(request('/api/agent/session-meta'), env);
  const meta = await response.json();
  assert.equal(meta.agentHttpEnabled, true);
  assert.equal(meta.authorityMode, 'worker_canonical');
  assert.equal(meta.telegramBridgeEnabled, false);
  assert.equal(meta.clientSubmitReady, true);
});

test('explicit HTTP disable overrides stale legacy flags and preserves authorization', async () => {
  const disabled = session({ telegramOnly: true, telegramBridgeEnabled: true,
    sessionModeProfile: { authority: { mode: 'worker_canonical' }, surfaces: { agentHttp: false, telegram: false, miniApp: false } } });
  const { env } = await fixture([disabled]);
  const response = await worker.fetch(request('/api/agent/groups'), env);
  assert.equal(response.status, 404);
  const meta = await (await worker.fetch(request('/api/agent/session-meta'), env)).json();
  assert.equal(meta.agentHttpEnabled, false);
  assert.equal(meta.clientSubmitReady, false);
  const enabled = await fixture();
  assert.equal((await worker.fetch(request('/api/agent/groups', { token: 'wrong' }), enabled.env)).status, 401);
});

test('configured legacy HTTP disable wins over an enabled alias on real routes', async () => {
  const { env } = await fixture([session({
    sessionModeProfile: null,
    telegramBridgeEnabled: true,
    agentHttpEnabled: false,
    agentHttp: true,
  })]);

  const meta = await (await worker.fetch(request('/api/agent/session-meta'), env)).json();
  assert.equal(meta.agentHttpEnabled, false);
  assert.equal(meta.clientSubmitReady, false);
  const response = await worker.fetch(request('/api/agent/groups'), env);
  assert.equal(response.status, 404);
});

test('hosted groups, proposals and child sessions work with Telegram disabled', async () => {
  const { env } = await fixture();
  for (const [path, body] of [
    ['/api/agent/groups', null],
    ['/api/agent/groups/propose', { category: { categoryId: 'role', label: 'Role', options: [{ optionId: 'reader', label: 'Reader' }] }, optionIds: ['reader'] }],
    ['/api/agent/sessions/child', { childSessionSlug: 'alpha-child', sessionName: 'Child' }],
  ]) {
    const response = await worker.fetch(request(path, body ? { method: 'POST', body } : {}), env);
    const payload = await response.json();
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(payload.ok, true);
  }
});

test('non-hosted authority cannot use hosted group routes even with HTTP enabled', async () => {
  const { env } = await fixture([session({ sessionModeProfile: { authority: { mode: 'registry_canonical' }, surfaces: { agentHttp: true, telegram: false } } })]);
  assert.equal((await worker.fetch(request('/api/agent/groups'), env)).status, 403);
});

test('HTTP default-session overrides resolve with Telegram disabled', async () => {
  const { env } = await fixture([session(), session({ sessionSlug: 'beta', sessionName: 'Beta' })]);
  await env.AGENT_ACTION_KV.put('telegram:admin-default-session:v1', JSON.stringify({ sessionSlug: 'beta' }));
  const policy = await loadSessionPolicy(env);
  assert.equal(policy.defaultSessionSlug, 'beta');
  assert.equal(policy.adminDefaultSessionSlug, 'beta');
});

test('retained HTTP producer and queue submit once with Telegram disabled', async () => {
  const h = await fixture();
  const response = await worker.fetch(request('/api/agent/preferences', { method: 'POST', body: {
    submit: true, humanApproved: true, preferences: { answersByQuestionId: { [QID]: { text: 'Approved answer' } } },
  } }), h.env);
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].record.sessionSnapshot.sessionIdHex, SESSION_ID);
  assert.equal(h.sent[0].record.sessionSnapshot.sessionModeProfile.authority.mode, 'worker_canonical');
  assert.equal(h.sent[0].record.sessionSnapshot.sessionModeProfile.surfaces.agentHttp, true);
  let acked = 0;
  const delivery = { messages: [{ body: h.sent[0], attempts: 1, ack() { acked += 1; }, retry() { assert.fail('no retry expected'); } }] };
  await worker.queue(delivery, h.env);
  await worker.queue(delivery, h.env);
  assert.equal(acked, 2);
  assert.equal(h.broadcasts(), 1);
  assert.equal(h.authRequests.length, 2);
  assert.ok(h.authRequests.every(entry => entry.body.sessionId === SESSION_ID));
  assert.match(h.authRequests[1].body.message, new RegExp(`urn:context-engine:session:id:${encodeURIComponent(SESSION_ID)}`));
});

test('Wrapped and the legacy HTTP alias remain available without Telegram', async () => {
  const { env } = await fixture();
  const wrapped = await worker.fetch(new Request('https://bridge.example/session-wrapped'), env);
  assert.equal(wrapped.status, 302);
  assert.match(wrapped.headers.get('location'), /ce-session-wrapped/);
  assert.equal((await worker.fetch(request('/telegram/agent/api/questions'), env)).status, 200);
});

test('admin session discovery includes hosted Agent HTTP sessions with Telegram disabled', async () => {
  const { agentVisibleSessions } = await import('./agentSessionRuntime.mjs');
  const { env } = await fixture([session(), session({ sessionSlug: 'beta', sessionName: 'Beta', sessionModeProfile: { authority: { mode: 'worker_canonical' }, surfaces: { agentHttp: false, telegram: true } } })]);
  const policy = await loadSessionPolicy(env);
  assert.deepEqual(agentVisibleSessions(policy, env).map(entry => entry.sessionSlug), ['alpha']);
});

 test('question storage follows explicit authority before legacy transport flags', async () => {
  const { sessionUsesWorkerBackedQuestions } = await import('./agentSessionRuntime.mjs');
  assert.equal(sessionUsesWorkerBackedQuestions(session()), true);
  assert.equal(sessionUsesWorkerBackedQuestions(session({ telegramOnly: true, sessionModeProfile: { authority: { mode: 'registry_canonical' }, surfaces: { agentHttp: true } } })), false);
  assert.equal(sessionUsesWorkerBackedQuestions({ telegramOnly: true }), true);
});

test('draft response guidance uses the retained HTTP submit route', async () => {
  const { env } = await fixture();
  const response = await worker.fetch(request('/api/agent/preferences', { method: 'POST', body: {
    preferences: { answersByQuestionId: { [QID]: { text: 'Draft answer' } } },
  } }), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.review.route, '/api/agent/preferences');
  assert.doesNotMatch(payload.review.note, /Mini App|human-approved/i);
  assert.equal(payload.submittedCount, 0);
});

test('canonical browser origins override legacy aliases while old deployments still work', async () => {
  const probe = (origin, env) => worker.fetch(new Request('https://bridge.example/api/agent/client-login/exchange', {
    method: 'OPTIONS', headers: { origin },
  }), env);
  const legacy = { AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS: 'https://legacy.example' };
  assert.equal((await probe('https://legacy.example', legacy)).status, 204);
  const both = { ...legacy, AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS: 'https://current.example' };
  assert.equal((await probe('https://current.example', both)).status, 204);
  assert.equal((await probe('https://legacy.example', both)).status, 403);
});

test('canonical session cutoff overrides retained legacy aliases', async () => {
  const { agentVisibleSessions } = await import('./agentSessionRuntime.mjs');
  const { env } = await fixture([session(), session({ sessionSlug: 'beta', createdAt: '2026-01-01T00:00:00Z' })]);
  env.AGENT_BRIDGE_SESSION_CREATED_AFTER = '2026-03-01T00:00:00Z';
  env.AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER = '2025-01-01T00:00:00Z';
  assert.deepEqual(agentVisibleSessions(await loadSessionPolicy(env), env).map(entry => entry.sessionSlug), ['alpha']);
});

test('explicit empty canonical cutoff clears a retained legacy cutoff', async () => {
  const { agentVisibleSessions } = await import('./agentSessionRuntime.mjs');
  const { env } = await fixture([session(), session({ sessionSlug: 'beta', createdAt: '2026-01-01T00:00:00Z' })]);
  env.AGENT_BRIDGE_SESSION_CREATED_AFTER = '';
  env.AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER = '2026-03-01T00:00:00Z';
  assert.deepEqual(agentVisibleSessions(await loadSessionPolicy(env), env).map(entry => entry.sessionSlug), ['alpha', 'beta']);
});
