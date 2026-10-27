import { sha256Hex } from './agent/runtimePrimitives.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { signToken } from './tokenSigning.js';
import { persistAuthTokenRecord } from './authTokenClaims.js';
import { buildAdminActionBodyHash, buildAdminActionTypedData } from './adminTypedData.mjs';
import { revokeAgentCredentialHash } from './agent/agentCredentials.mjs';
import { AGENT_ROUTES } from './agent/routes.mjs';

import { fixture, origin, sessionId, wallet } from './agentTestFixture.mjs';

test('removed/unknown routes and unsupported methods reject before config, credentials or state access', async () => {
  const f = fixture();
  for (const path of ['/api/agent/admin/default-session', '/session-wrapped', '/telegram/agent/api/questions', '/api/agent/unknown']) {
    for (const method of ['GET', 'POST', 'DELETE', 'OPTIONS']) assert.equal((await f.request(path, { method })).status, 404, `${method} ${path}`);
  }
  for (const path of Object.keys(AGENT_ROUTES).filter(path => !path.includes(':id'))) assert.equal((await f.request(path, { method: 'PATCH' })).status, 405, path);
  assert.equal(f.reads(), 0); assert.equal(f.writes.length, 0);
});

test('all documented preflights are free of agent state writes and reject an untrusted browser origin', async () => {
  const f = fixture();
  for (const [path, route] of Object.entries(AGENT_ROUTES).filter(([, value]) => value.cors)) {
    const response = await f.request(path, { method: 'OPTIONS', headers: { Origin: 'https://client.example', 'Access-Control-Request-Method': route.methods[0] } });
    assert.equal(response.status, 204, path);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://client.example');
    assert.equal((await f.request(path, { method: 'OPTIONS', headers: { Origin: 'https://foreign.example' } })).status, 403);
  }
  assert.deepEqual(f.writes, []);
});

test('scoped activity uses the credential principal and rejects cross-session, wrong-purpose and rotated tokens', async () => {
  const f = fixture(); const first = await f.credential();
  const ok = await f.request('/api/agent/actions?sessionSlug=fixture&telegramUserId=foreign', { token: first.token });
  assert.equal(ok.status, 200, await ok.clone().text());
  assert.equal((await f.request('/api/agent/actions?sessionSlug=foreign', { token: first.token })).status, 400);
  assert.equal((await f.request('/api/agent/question-queue', { token: first.token })).status, 403);
  assert.equal((await f.request('/api/agent/agent-only/statements', { token: first.token })).status, 403);
  const second = await f.credential();
  assert.equal((await f.request('/api/agent/actions', { token: first.token })).status, 401);
  assert.equal((await f.request('/api/agent/actions', { token: second.token })).status, 200);
  f.config.sessionModeProfile.surfaces.agentHttp = false;
  assert.equal((await f.request('/api/agent/actions', { token: second.token })).status, 403);
});

test('operator issuance verifies signed action and creates a fresh session-bound service credential', async () => {
  const f = fixture();
  const body = { httpMethod: 'POST', action: 'credentials/service', slug: 'fixture', sessionSlug: 'fixture', address: wallet.address,
    label: 'Fixture service', scopes: ['read_questions', 'session_login'], nonce: 'fixture-nonce', audience: origin,
    expiration: Math.floor(Date.now() / 1000) + 120 };
  body.bodyHash = buildAdminActionBodyHash(body);
  const typed = buildAdminActionTypedData(body);
  body.signature = await wallet.signTypedData(typed.domain, { AdminAction: typed.types.AdminAction }, typed.message);
  const response = await f.request('/api/agent/credentials/service', { method: 'POST', body });
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json(); assert.match(result.token, /^ceagt_/);
  const credential = [...f.records.values()].map(value => { try { return JSON.parse(value); } catch { return null; } }).find(value => value?.type === 'agent_credential');
  assert.equal(credential.sessionId, sessionId); assert.equal(credential.sessionWorkerOrigin, origin);
  assert.equal(credential.authzEpoch, 1); assert.equal(credential.credentialKind, 'service');
  assert.ok([...f.records.keys()].every(key => key.startsWith(`ce-agent:${sessionId}:`)));
  assert.ok(![...f.records.values()].some(value => value.includes(result.token)));
  const tampered = await f.request('/api/agent/credentials/service', { method: 'POST', body: { ...body, scopes: ['agent_autofill'] } });
  assert.equal(tampered.status, 400);
});

test('ordinary health remains private and independent of optional agent state', async () => {
  const f = fixture(); delete f.env.AGENT_MANAGED_ROOT_SECRET;
  assert.equal((await f.request('/health')).status, 401);
  const payload = { sub: wallet.address, slug: 'fixture', sessionId, authzEpoch: 1, scopes: { storage: true }, exp: Math.floor(Date.now() / 1000) + 300, jti: 'fixture-participant-jti' };
  await persistAuthTokenRecord({ env: f.env, ...payload, ttlSeconds: 300 });
  const token = await signToken(payload, f.env.TOKEN_HMAC_SECRET);
  f.config.sessionModeProfile.surfaces.agentHttp = false;
  assert.equal((await f.request('/health', { token })).status, 200);
});

test('short-lived source exchanges internally, and source revocation invalidates the browser token and participant health', async () => {
  const f = fixture(); const source = await f.credential();
  const key = `ce-agent:${sessionId}:agent:credential:v2:${source.tokenHash}`;
  const record = JSON.parse(f.records.get(key)); record.expiresAt = new Date(Date.now() + 120_000).toISOString(); f.records.set(key, JSON.stringify(record));
  const response = await f.request('/api/agent/client-login/exchange', { method: 'POST', body: { token: source.token, sessionSlug: 'fixture' } });
  assert.equal(response.status, 200, await response.clone().text());
  const exchange = await response.json();
  assert.ok(Date.parse(exchange.workerCredential.expiresAt) <= Date.parse(record.expiresAt));
  assert.ok(Date.parse(exchange.agentCredential.expiresAt) <= Date.parse(record.expiresAt));
  assert.equal((await f.request('/health', { token: exchange.workerCredential.token })).status, 200);
  assert.equal((await f.request('/api/agent/actions', { token: exchange.agentCredential.token })).status, 200);
  await revokeAgentCredentialHash({ env: f.agentEnv, tokenHash: source.tokenHash });
  assert.equal((await f.request('/health', { token: exchange.workerCredential.token })).status, 401);
  assert.equal((await f.request('/api/agent/actions', { token: exchange.agentCredential.token })).status, 401);
});

test('member exchange binds to current participant JTI, prevents replay and denies ordinary agent routes', async () => {
  const f = fixture();
  const payload = { sub: wallet.address, slug: 'fixture', sessionId, authzEpoch: 1, scopes: { storage: true }, exp: Math.floor(Date.now() / 1000) + 300, jti: 'fixture-member-jti' };
  await persistAuthTokenRecord({ env: f.env, ...payload, ttlSeconds: 300 });
  const token = await signToken(payload, f.env.TOKEN_HMAC_SECRET);
  const response = await f.request('/api/agent/wrapped/member-exchange', { method: 'POST', token, body: { sessionSlug: 'fixture' } });
  assert.equal(response.status, 200, await response.clone().text());
  const member = await response.json();
  assert.deepEqual(member.scopes, ['agent_autofill']);
  assert.equal((await f.request('/api/agent/actions', { token: member.token })).status, 403);
  assert.equal((await f.request('/api/agent/client-login/exchange', { method: 'POST', token: member.token, body: { sessionSlug: 'fixture' } })).status, 403);
  assert.equal((await f.request('/api/agent/wrapped/member-exchange', { method: 'POST', token, body: { sessionSlug: 'fixture' } })).status, 409);
  f.records.delete(`authToken:fixture:${wallet.address.toLowerCase()}:${payload.jti}`);
  assert.equal((await f.request('/api/agent/agent-only/statements', { token: member.token })).status, 401);
});

test('invite onboarding has one concurrent winner and independent journals for two invites in one session', async () => {
  const f = fixture(); const journal = f.withCoordinator();
  const inviteToken = 'fixture-invite-one-opaque-value';
  const secondToken = 'fixture-invite-two-opaque-value';
  f.config.agentHttp.invites = [{ tokenHash: await sha256Hex(inviteToken) }, { tokenHash: await sha256Hex(secondToken) }];
  const body = { sessionSlug: 'fixture', inviteToken };
  const responses = await Promise.all(Array.from({ length: 5 }, () => f.request('/api/agent/invite/onboard', { method: 'POST', body })));
  assert.equal(responses.filter(response => response.status === 200).length, 1, await Promise.all(responses.map(response => response.clone().text())));
  assert.ok(responses.filter(response => response.status !== 200).every(response => response.status === 409));
  const second = await f.request('/api/agent/invite/onboard', { method: 'POST', body: { ...body, inviteToken: secondToken } });
  assert.equal(second.status, 200, await second.clone().text());
  const keys = [...journal.durable.keys()].filter(key => key.startsWith(`ce-agent-invite:${sessionId}:`));
  assert.equal(keys.length, 2); assert.ok(keys.every(key => journal.durable.get(key).phase === 'redeemed'));
  assert.ok(!JSON.stringify([...journal.durable]).includes(inviteToken));
  assert.ok(![...f.records.keys()].some(key => key.includes('agent:invite-redemption:v1:')));
});

test('missing invite coordinator fails closed and finalization uncertainty retains the reservation', async () => {
  const f = fixture(); const inviteToken = 'fixture-invite-three-opaque-value';
  f.config.agentHttp.invites = [{ tokenHash: await sha256Hex(inviteToken) }];
  const body = { sessionSlug: 'fixture', inviteToken };
  assert.equal((await f.request('/api/agent/invite/onboard', { method: 'POST', body })).status, 503);
  assert.equal(f.writes.length, 0);
  const journal = f.withCoordinator(); const binding = f.env.CE_SESSION_COORDINATOR;
  f.env.CE_SESSION_COORDINATOR = { ...binding, get: value => {
    const stub = binding.get(value);
    return { fetch: (url, init) => url.endsWith('/finalize') ? Promise.reject(new Error('Fixture lost acknowledgement')) : stub.fetch(url, init) };
  } };
  assert.equal((await f.request('/api/agent/invite/onboard', { method: 'POST', body })).status, 503);
  const records = [...journal.durable].filter(([key]) => key.startsWith('ce-agent-invite:'));
  assert.equal(records.length, 1); assert.equal(records[0][1].phase, 'pending');
  assert.equal((await f.request('/api/agent/invite/onboard', { method: 'POST', body })).status, 409);
});

test('hosted proposals, reads, drafts and explicit submission stay inside the Session Worker', async () => {
  const f = fixture(); f.withCoordinator();
  f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'public', encryption: 'none' } };
  f.config.agentHttp.managedAccountSubmitAllowed = true;
  f.config.agentHttp.asyncSubmitEnabled = true;
  f.env.AGENT_RESPONSE_QUEUE = { send: async () => { assert.fail('Hosted submissions must use receipts directly'); } };
  const agent = await f.credential({ scopes: ['read_questions', 'draft_answers', 'pose_questions'] });
  const created = await f.request('/api/agent/questions/create', { method: 'POST', token: agent.token,
    body: { questions: [{ prompt: 'Should the fixture use a shared garden?', questionType: 'binary' }] } });
  assert.equal(created.status, 200, await created.clone().text());
  const createBody = await created.json();
  const read = await f.request('/api/agent/questions', { token: agent.token });
  assert.equal(read.status, 200, await read.clone().text());
  const questions = (await read.json()).questions;
  assert.equal(questions.length, 1, JSON.stringify(createBody));
  const questionId = questions[0].questionId;
  const body = { preferences: [{ questionId, value: 'Agree' }] };
  const draft = await f.request('/api/agent/preferences', { method: 'POST', token: agent.token, body });
  assert.equal(draft.status, 200, await draft.clone().text());
  assert.equal([...f.records.keys()].filter(key => key.startsWith('ce-storage:fixture:responses:')).length, 0);
  const submitBody = { ...body, submit: true, humanApproved: true };
  const submitted = await f.request('/api/agent/preferences', { method: 'POST', token: agent.token, body: submitBody });
  assert.equal(submitted.status, 200, await submitted.clone().text());
  const result = await submitted.json(); assert.equal(result.submitted.length, 1);
  const repeat = await f.request('/api/agent/preferences', { method: 'POST', token: agent.token, body: submitBody });
  assert.equal(repeat.status, 200, await repeat.clone().text());
  assert.equal([...f.records.keys()].filter(key => key.startsWith('ce-storage:fixture:responses:')).length, 1);
});

test('question pages are bounded, complete and bound to the current caller and question snapshot', async () => {
  const f = fixture(); f.withCoordinator(); f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'public', encryption: 'none' } };
  const agent = await f.credential({ scopes: ['read_questions', 'pose_questions'] });
  const create = await f.request('/api/agent/questions/create', { method: 'POST', token: agent.token, body: {
    questions: ['one', 'two', 'three'].map(label => ({ prompt: `Fixture ${label}?`, questionType: 'binary' })) } });
  assert.equal(create.status, 200, await create.clone().text());
  const seen = new Set(); let cursor = '';
  for (let i = 0; i < 3; i++) {
    const response = await f.request(`/api/agent/questions?limit=1&cursor=${encodeURIComponent(cursor)}`, { token: agent.token });
    assert.equal(response.status, 200, await response.clone().text());
    const page = await response.json(); assert.equal(page.questions.length, 1); assert.equal(page.total, 3);
    seen.add(page.questions[0].questionId); cursor = page.nextCursor;
    if (i === 0) {
      const other = await f.credential({ principal: 'other-agent' });
      assert.equal((await f.request(`/api/agent/questions?cursor=${encodeURIComponent(cursor)}`, { token: other.token })).status, 400);
      assert.equal((await f.request(`/api/agent/questions?cursor=${encodeURIComponent(cursor)}x`, { token: agent.token })).status, 400);
    }
  }
  assert.equal(seen.size, 3); assert.equal(cursor, '');
});

test('shared operator result caches recheck exposure for every authorized principal', async () => {
  const f = fixture(); f.withCoordinator(); f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } };
  const agent = await f.credential();
  const body = { httpMethod: 'POST', action: 'result-view-cache', slug: 'fixture', sessionSlug: 'fixture', address: wallet.address,
    nonce: crypto.randomUUID(), audience: origin, expiration: Math.floor(Date.now() / 1000) + 120,
    viewType: 'summary', dataVersionKey: 'fixture-version', value: { text: 'Fixture summary' } };
  body.bodyHash = buildAdminActionBodyHash(body);
  const typed = buildAdminActionTypedData(body);
  body.signature = await wallet.signTypedData(typed.domain, { AdminAction: typed.types.AdminAction }, typed.message);
  const saved = await f.request('/api/agent/result-view-cache', { method: 'POST', body });
  assert.equal(saved.status, 200, await saved.clone().text());
  const path = '/api/agent/result-view-cache?viewType=summary&dataVersionKey=fixture-version';
  const warm = await f.request(path, { token: agent.token });
  assert.equal(warm.status, 200, await warm.clone().text()); assert.equal((await warm.json()).cached, true);
  const other = await f.credential({ principal: 'other-agent' });
  assert.equal((await (await f.request(path, { token: other.token })).json()).cached, true);
  f.config.resultsExposure = { aggregateResultsEnabled: false };
  assert.equal((await f.request(path, { token: agent.token })).status, 403);
  assert.equal((await f.request('/api/agent/results?demo=true', { token: agent.token })).status, 403);
});
