import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, wallet, origin, sessionId } from './agentTestFixture.mjs';
import { signToken } from './tokenSigning.js';
import { persistAuthTokenRecord } from './authTokenClaims.js';
import { buildAdminActionBodyHash, buildAdminActionTypedData } from './adminTypedData.mjs';

async function jsonOk(response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
}
async function participant(f) {
  const payload = { sub: wallet.address, slug: 'fixture', sessionId, authzEpoch: 1, scopes: { storage: true },
    exp: Math.floor(Date.now() / 1000) + 300, jti: crypto.randomUUID() };
  await persistAuthTokenRecord({ env: f.env, ...payload, ttlSeconds: 300 });
  return signToken(payload, f.env.TOKEN_HMAC_SECRET);
}
async function signed(f, path, body = {}, method = 'POST') {
  const input = { ...body, httpMethod: method, action: path.slice('/api/agent/'.length), slug: 'fixture', sessionSlug: 'fixture', address: wallet.address,
    nonce: crypto.randomUUID(), audience: origin, expiration: Math.floor(Date.now() / 1000) + 120 };
  input.bodyHash = buildAdminActionBodyHash(input);
  const typed = buildAdminActionTypedData(input);
  input.signature = await wallet.signTypedData(typed.domain, { AdminAction: typed.types.AdminAction }, typed.message);
  return f.request(path, { method, body: input });
}
async function hosted() {
  const f = fixture(); f.withCoordinator(); f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'public', encryption: 'none' } };
  const agent = await f.credential({ scopes: ['read_questions', 'draft_answers', 'pose_questions', 'read_groups', 'propose_groups', 'recommend_question_votes', 'apply_question_votes'] });
  await jsonOk(await f.request('/api/agent/questions/create', { method: 'POST', token: agent.token,
    body: { questions: [{ prompt: 'Would a shared garden help?', questionType: 'binary', tags: ['garden'] }, { prompt: 'Choose a season.', questionType: 'freeform' }] } }));
  const questions = (await jsonOk(await f.request('/api/agent/questions', { token: agent.token }))).questions;
  return { f, agent, questions };
}

test('public descriptors and skill redirects disclose current same-origin metadata without materializing state', async () => {
  const f = fixture();
  for (const path of ['/api/agent/session-meta', '/api/agent/skill-version', '/api/agent/session-wrapped/skill-version', '/api/agent/agent-only/start']) {
    await jsonOk(await f.request(path));
  }
  for (const path of ['/api/agent/skill', '/api/agent/session-wrapped/skill']) {
    const response = await f.request(path); assert.ok([302, 307].includes(response.status));
    assert.match(response.headers.get('location'), /workers\/sessionCorsWorker\/agent\/skills/);
    assert.ok(!response.headers.get('location').includes('token='));
  }
  assert.equal(f.writes.length, 0);
});

test('question selection, queue planning, voting and auxiliary groups retain their scoped HTTP behavior', async () => {
  const { f, agent, questions } = await hosted(); const token = agent.token;
  for (const path of ['/api/agent/tags', '/api/agent/questions/next', '/api/agent/onboarding', '/api/agent/groups', '/api/agent/actions', '/api/agent/admin/status']) {
    await jsonOk(await f.request(path, { token }));
  }
  await jsonOk(await f.request('/api/agent/onboarding', { method: 'POST', token, body: { topicPreferences: ['garden'] } }));
  await jsonOk(await f.request('/api/agent/groups/propose', { method: 'POST', token,
    body: { category: { categoryId: 'role', label: 'Role', options: [{ optionId: 'reader', label: 'Reader' }] }, optionIds: ['reader'] } }));
  await jsonOk(await signed(f, '/api/agent/sessions/child', { childSessionSlug: 'fixture-child', sessionName: 'Fixture child' }));
  const jwt = await participant(f);
  await jsonOk(await f.request('/api/agent/question-queue', { token: jwt }));
  await jsonOk(await signed(f, '/api/agent/question-queue', { sponsoredQuestionIds: [questions[0].questionId] }));
  await jsonOk(await f.request('/api/agent/question-queue/plan', { method: 'POST', token, body: { questionIds: [questions[0].questionId] } }));
  assert.equal((await f.request('/api/agent/question-queue/apply', { method: 'POST', token, body: { questionIds: [questions[0].questionId] } })).status, 400);
  await jsonOk(await f.request('/api/agent/question-queue/apply', { method: 'POST', token, body: { questionIds: [questions[0].questionId], approved: true } }));
  await jsonOk(await f.request('/api/agent/question-votes/recommend', { method: 'POST', token, body: {} }));
  await jsonOk(await f.request('/api/agent/question-votes/apply', { method: 'POST', token,
    body: { decisions: [{ questionId: questions[0].questionId, vote: 'up' }], approvalText: 'Approve this vote' } }));
  f.config.adminAddress = '0x2222222222222222222222222222222222222222';
  assert.equal((await f.request('/api/agent/question-queue/plan', { method: 'POST', token, body: {} })).status, 403);
});

test('Wrapped config, statements, predictions, allocations, poster links and research export use the retained routes', async () => {
  const { f, agent, questions } = await hosted(); const token = agent.token;
  await jsonOk(await f.request('/api/agent/admin/agent-only/config', { method: 'POST', token,
    body: { enabledQuestionIds: questions.map(q => q.questionId) } }));
  await jsonOk(await f.request('/api/agent/admin/agent-only/config', { token }));
  const jwt = await participant(f);
  const member = await jsonOk(await f.request('/api/agent/wrapped/member-exchange', { method: 'POST', token: jwt, body: {} }));
  const page = await jsonOk(await f.request('/api/agent/agent-only/statements', { token: member.token }));
  assert.equal(page.statements.length, 2);
  const metadata = { model: 'fixture-model', scaffold_version: 'fixture-v1' };
  const body = { run_id: 'fixture-run', agent_metadata: metadata,
    answers: page.statements.map(q => ({ statement_id: q.statement_id, statement_version: q.statement_version, answer: q.question_type === 'binary' ? { value: 'agree' } : { text: 'Autumn' }, confidence: 80 })) };
  await jsonOk(await f.request('/api/agent/agent-only/answers/bulk', { method: 'POST', token: member.token, body }));
  const replay = await jsonOk(await f.request('/api/agent/agent-only/answers/bulk', { method: 'POST', token: member.token, body }));
  assert.equal(replay.replay, true);
  await jsonOk(await f.request('/api/agent/agent-only/token-votes/bulk', { method: 'POST', token: member.token, body: {
    run_id: 'fixture-run', agent_metadata: metadata, mode: 'linear',
    votes: [{ statement_id: page.statements[0].statement_id, statement_version: page.statements[0].statement_version, votes: 5 }] } }));
  const posterBody = { run_id: 'fixture-run', format: 'json_url', include_base64: false };
  assert.equal((await f.request('/api/agent/agent-only/wrapped-image', { method: 'POST', token: member.token, body: posterBody })).status, 403);
  f.config.agentHttp.wrapped = { posterEnabled: true, posterRenderer: 'openai' };
  assert.equal((await f.request('/api/agent/agent-only/wrapped-image', { method: 'POST', token: member.token, body: posterBody })).status, 503);
  f.config.agentHttp.wrapped.posterRenderer = 'local';
  const poster = await jsonOk(await f.request('/api/agent/agent-only/wrapped-image', { method: 'POST', token: member.token, body: posterBody }));
  const imagePath = new URL(poster.image_url).pathname;
  const get = await f.request(imagePath), head = await f.request(imagePath, { method: 'HEAD' });
  assert.equal(get.status, 200); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal(get.headers.get('content-type'), head.headers.get('content-type'));
  const viewKey = [...f.records.keys()].find(key => key.includes(':wrapped-image-view:'));
  f.records.set(viewKey, JSON.stringify({ ...JSON.parse(f.records.get(viewKey)), expiresAt: '2020-01-01T00:00:00.000Z' }));
  for (const method of ['GET', 'HEAD']) assert.equal((await f.request(imagePath, { method })).status, 404);
  const exported = await f.request('/api/agent/admin/agent-only/export?view=answers&format=jsonl', { token });
  assert.equal(exported.status, 200, await exported.clone().text());
  assert.ok((await exported.text()).includes('fixture-model'));
  await jsonOk(await f.request('/api/agent/admin/metrics', { token }));
  await jsonOk(await signed(f, '/api/agent/admin/skill-update', { latestVersion: 'fixture-update' }));
  assert.equal((await jsonOk(await f.request('/api/agent/admin/skill-update', { token }))).updateAvailable, true);
  await jsonOk(await signed(f, '/api/agent/admin/skill-update', {}, 'DELETE'));
  await jsonOk(await f.request('/api/agent/admin/questions/delete', { method: 'POST', token, body: { questionIds: [questions[0].questionId] } }));
});

test('results, deterministic images, shared operator caches and Geo backlinks enforce current exposure', async () => {
  const { f, agent, questions } = await hosted(); const token = agent.token;
  f.config.agentHttp.managedAccountSubmitAllowed = true;
  await jsonOk(await f.request('/api/agent/preferences', { method: 'POST', token, body: {
    preferences: [{ questionId: questions[0].questionId, value: 'Agree' }], submit: true, humanApproved: true } }));
  for (const view of ['consensus', 'difference']) {
    const results = await jsonOk(await f.request(`/api/agent/results?view=${view}`, { token }));
    assert.equal(results.responseCount, 1);
  }
  const image = await f.request('/api/agent/results-image?view=consensus', { token });
  assert.equal(image.status, 200, await image.clone().text()); assert.match(image.headers.get('content-type'), /image\//);
  const backlink = await jsonOk(await f.request(`/api/agent/geo-backlink?questionId=${questions[0].questionId}`, { token }));
  assert.equal(new URL(backlink.backlink.questionEndpoint).origin, origin);
  const cache = { viewType: 'consensus', dataVersionKey: 'fixture-results-v1', value: { label: 'Fixture aggregate' } };
  await jsonOk(await signed(f, '/api/agent/result-view-cache', cache));
  assert.equal((await f.request('/api/agent/result-view-cache', { method: 'POST', token, body: cache })).status, 403);
  const path = '/api/agent/result-view-cache?viewType=consensus&dataVersionKey=fixture-results-v1';
  const cached = await jsonOk(await f.request(path, { token })); assert.equal(cached.cached, true); assert.equal(cached.value.label, cache.value.label);
  f.config.resultsExposure = { aggregateResultsEnabled: false };
  for (const route of [path, '/api/agent/results?view=consensus&demo=true', '/api/agent/results-image?view=consensus&demo=true']) {
    const hidden = await f.request(route, { token }); assert.equal(hidden.status, 403); assert.ok(!(await hidden.text()).includes(cache.value.label));
  }
});

for (const approval of [
  { approved: false, approvalText: 'Do not approve this change.' },
  { approved: true, confirm: false },
  { confirm: true, confirmed: false },
  { approvalText: 'I do not confirm' },
  { approvalText: 'Maybe yes, but wait for the organizer.' },
  { approvalText: 'Approve this change' },
]) {
  test(`sponsored apply rejects unapproved structured decisions: ${JSON.stringify(approval)}`, async () => {
    const { f, agent, questions } = await hosted();
    const writesBefore = f.writes.length;
    const response = await f.request('/api/agent/question-queue/apply', { method: 'POST', token: agent.token,
      body: { questionIds: [questions[0].questionId], createQuestions: ['A new sponsored question?'], ...approval } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).reason, 'sponsored_question_confirmation_required');
    assert.equal(f.writes.length, writesBefore, 'rejected approval writes neither a question nor a queue');
  });
}

test('sponsored plans bind approval to the mode, resolved IDs and draft contents', async () => {
  const { f, agent, questions } = await hosted();
  const body = { questionIds: [questions[0].questionId], createQuestions: [{ prompt: 'A new sponsored question?', tags: ['garden'] }] };
  const plan = await jsonOk(await f.request('/api/agent/question-queue/plan', { method: 'POST', token: agent.token, body }));
  assert.match(plan.planDigest, /^[a-f0-9]{64}$/);
  assert.match(plan.confirmation.required, /approved: true/);
  assert.match(plan.confirmation.required, /planDigest/);
  for (const change of [
    { mode: 'replace' },
    { questionIds: [questions[1].questionId] },
    { createQuestions: [{ prompt: 'A different sponsored question?', tags: ['garden'] }] },
    { createQuestions: [{ prompt: 'A new sponsored question?', tags: ['changed'] }] },
  ]) {
    const writesBefore = f.writes.length;
    const response = await f.request('/api/agent/question-queue/apply', { method: 'POST', token: agent.token,
      body: { ...body, ...change, approved: true, planDigest: plan.planDigest } });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).reason, 'sponsored_question_plan_changed');
    assert.equal(f.writes.length, writesBefore);
  }
  const applied = await jsonOk(await f.request('/api/agent/question-queue/apply', { method: 'POST', token: agent.token,
    body: { ...body, approved: true, planDigest: plan.planDigest, approvalText: 'Admin approved this plan.' } }));
  assert.equal(applied.createdQuestions.length, 1);
});
