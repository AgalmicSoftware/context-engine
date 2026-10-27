import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, wallet, sessionId, enforceKvWriteLimit } from './agentTestFixture.mjs';
import { saveAgentOnlyModeConfig } from './agent/wrappedConfig.mjs';
import { createWorkerExecutionServicesWithWorkerDeps } from './workerExecutionServiceBinding.js';
import { signToken } from './tokenSigning.js';
import { persistAuthTokenRecord } from './authTokenClaims.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
const openQ = '0x' + 'a'.repeat(64), gatedQ = '0x' + 'b'.repeat(64);
const metadata = { model: 'fixture-model', scaffold_version: 'fixture-v1' };
const jsonOk = async response => {
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
};
async function memberToken(f, address = wallet.address) {
  const payload = { sub: address, slug: 'fixture', sessionId, authzEpoch: 1, scopes: { storage: true },
    exp: Math.floor(Date.now() / 1000) + 300, jti: crypto.randomUUID() };
  await persistAuthTokenRecord({ env: f.env, ...payload, ttlSeconds: 300 });
  const jwt = await signToken(payload, f.env.TOKEN_HMAC_SECRET);
  return (await jsonOk(await f.request('/api/agent/wrapped/member-exchange', { method: 'POST', token: jwt, body: {} }))).token;
}
function readableFixture() {
  const questions = new Map([
    ['open-ref', { questionId: openQ, sessionSlug: 'fixture', prompt: 'Open original statement', questionType: 'binary' }],
    ['gated-ref', { questionId: gatedQ, sessionSlug: 'fixture', prompt: 'Gated original statement', questionType: 'binary' }],
  ]);
  let gatedVisible = true;
  const f = fixture({ createWorkerExecutionServicesWithWorkerDeps: args => ({ ...createWorkerExecutionServicesWithWorkerDeps(args),
    storageRoute: async ({ path, request, uploaderAddress }) => {
      const url = new URL(request.url);
      const privileged = String(uploaderAddress).toLowerCase() === wallet.address.toLowerCase();
      const readable = id => id === 'open-ref' || privileged && gatedVisible;
      if (path === '/storage/list') return Response.json({ items: url.searchParams.get('resource') !== 'questions' ? [] :
        [...questions.keys()].filter(readable).map(id => ({ storageRef: { backend: 'cloudflare', id, resource: 'questions' }, metadata: {} })), listComplete: true });
      const id = url.searchParams.get('id');
      return readable(id) && questions.has(id) ? Response.json(questions.get(id)) : Response.json({}, { status: 403 });
    } }) });
  const coordinated = f.withCoordinator();
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'sbt_gate', encryption: 'none' } };
  return { f, questions, coordinated, hideGated: () => { gatedVisible = false; } };
}

test('a Wrapped answer keeps its exact original wording and schema after the question is edited', async () => {
  const { f, questions, hideGated } = readableFixture();
  const originalWording = 'Gated original statement\n  ' + 'Full wording. '.repeat(90).trimEnd();
  questions.get('gated-ref').prompt = originalWording;
  const member = await memberToken(f);
  const page = await jsonOk(await f.request('/api/agent/agent-only/statements', { token: member }));
  assert.equal(page.statements.length, 2);
  assert.equal(Object.hasOwn(page, 'window_id'), false);
  const statement = page.statements.find(row => row.statement_id === gatedQ);
  assert.equal(statement.text, originalWording);
  const body = { run_id: 'wording-run', request_id: 'wording-answer', agent_metadata: metadata,
    answers: [{ statement_id: gatedQ, statement_version: statement.statement_version, answer: { value: 'agree' }, confidence: 80 }] };
  await jsonOk(await f.request('/api/agent/agent-only/answers/bulk', { method: 'POST', token: member, body }));
  const stateKey = [...f.records.keys()].find(key => key.includes(':answer-state:'));
  const eventKey = [...f.records.keys()].find(key => key.includes(':answer-event:'));
  const savedState = f.records.get(stateKey), savedEvent = f.records.get(eventKey);
  assert.deepEqual(JSON.parse(savedEvent).statement, statement);
  assert.deepEqual(JSON.parse(savedState).byStatement[gatedQ].agent.statement, statement);
  questions.set('gated-ref', { questionId: gatedQ, sessionSlug: 'fixture', prompt: 'Edited wording', questionType: 'freeform' });
  const edited = await jsonOk(await f.request('/api/agent/agent-only/statements', { token: member }));
  assert.equal(edited.statements.find(row => row.statement_id === gatedQ).text, 'Edited wording');
  assert.notEqual(edited.statements.find(row => row.statement_id === gatedQ).statement_version, statement.statement_version);
  const stale = await f.request('/api/agent/agent-only/answers/bulk', { method: 'POST', token: member,
    body: { ...body, request_id: 'stale-wording' } });
  assert.equal(stale.status, 400);
  assert.equal((await stale.json()).errors[0].reason, 'statement_version_mismatch');
  assert.equal(f.records.get(stateKey), savedState);
  assert.equal(f.records.get(eventKey), savedEvent);
  const admin = await f.credential({ scopes: ['read_questions'] });
  const exported = await f.request('/api/agent/admin/agent-only/export?view=answers', { token: admin.token });
  assert.equal(exported.status, 200);
  assert.deepEqual(JSON.parse((await exported.text()).trim()).statement, statement);
  hideGated();
  const hidden = await f.request('/api/agent/admin/agent-only/export?view=answers', { token: admin.token });
  assert.equal(hidden.status, 200);
  assert.equal(await hidden.text(), '');
  assert.equal(f.records.get(eventKey), savedEvent, 'read-time filtering must not rewrite research');
});

test('a member can never rewrite shared Wrapped data or choose another member answer state', async () => {
  const { f } = readableFixture();
  const high = await memberToken(f);
  const low = await memberToken(f, '0x3333333333333333333333333333333333333333');
  const read = token => f.request('/api/agent/agent-only/statements', { token });
  const initial = new Map(f.records);
  const lowPage = await jsonOk(await read(low));
  assert.deepEqual(lowPage.statements.map(row => row.text), ['Open original statement']);
  const highPage = await jsonOk(await read(high));
  assert.equal(highPage.statements.length, 2);
  assert.deepEqual(f.records, initial, 'statement reads must not persist caller-specific shared data');
  assert.ok(![...f.records.keys()].some(key => key.includes('agent-mode-window')));
  const deniedConfig = await f.request('/api/agent/admin/agent-only/config', { method: 'POST', token: low, body: { enabledQuestionIds: [] } });
  assert.equal(deniedConfig.status, 403);
  const statement = highPage.statements.find(row => row.statement_id === gatedQ);
  const deniedAnswer = await f.request('/api/agent/agent-only/answers/bulk', { method: 'POST', token: low, body: {
    telegramUserId: wallet.address, run_id: 'gated-run', agent_metadata: metadata,
    answers: [{ statement_id: gatedQ, statement_version: statement.statement_version, answer: { value: 'agree' }, confidence: 80 }],
  } });
  assert.equal(deniedAnswer.status, 400);
  assert.equal((await deniedAnswer.json()).errors[0].reason, 'statement_unknown');
  assert.ok(![...f.records.keys()].some(key => key.includes(':answer-state:')));
  const admin = await f.credential({ scopes: ['read_questions'] });
  assert.equal((await f.request('/api/agent/admin/agent-only/window/open', { method: 'POST', token: admin.token, body: {} })).status, 404);
});

test('Wrapped config, answer state and vote state read failures propagate before writes', async () => {
  const { f } = readableFixture();
  const token = await memberToken(f);
  const page = await jsonOk(await f.request('/api/agent/agent-only/statements', { token }));
  const statement = page.statements[0];
  const get = f.env.GROUP_KV.get.bind(f.env.GROUP_KV);
  const cases = [
    ['agent-mode-config:', '/api/agent/agent-only/statements', {}],
    [':answer-state:', '/api/agent/agent-only/answers/bulk', { method: 'POST', body: { run_id: 'error-run', agent_metadata: metadata,
      answers: [{ statement_id: statement.statement_id, statement_version: statement.statement_version, answer: { value: 'agree' }, confidence: 70 }] } }],
    [':vote-state:', '/api/agent/agent-only/token-votes/bulk', { method: 'POST', body: { run_id: 'error-run', mode: 'linear', agent_metadata: metadata,
      votes: [{ statement_id: statement.statement_id, statement_version: statement.statement_version, votes: 1 }] } }],
  ];
  for (const [keyPart, path, options] of cases) {
    f.env.GROUP_KV.get = async key => { if (key.includes(keyPart)) throw new Error('Fixture KV read outage'); return get(key); };
    const response = await f.request(path, { token, ...options });
    assert.equal(response.status, 503, await response.clone().text());
    assert.ok(![...f.records.keys()].some(key => /:(answer|vote)-(event|state):/.test(key)));
  }
  f.env.GROUP_KV.get = get;
});

test('Wrapped exports preserve both question sources and refuse an unavailable unselected source', async () => {
  const { f, coordinated } = readableFixture();
  let time = Date.now();
  coordinated.coordinator.now = () => time;
  const admin = await f.credential({ scopes: ['read_questions', 'pose_questions'] });
  const created = await jsonOk(await f.request('/api/agent/questions/create', { method: 'POST', token: admin.token,
    body: { questions: [{ prompt: 'Historical proposal wording', questionType: 'binary' }] } }));
  const proposed = created.created[0].questionId;
  const token = await memberToken(f);
  const answer = async (id, requestId) => {
    const page = await jsonOk(await f.request('/api/agent/agent-only/statements', { token }));
    const statement = page.statements.find(row => row.statement_id === id);
    assert.ok(statement);
    return jsonOk(await f.request('/api/agent/agent-only/answers/bulk', { method: 'POST', token,
      body: { run_id: 'source-history', request_id: requestId, agent_metadata: metadata,
        answers: [{ statement_id: id, statement_version: statement.statement_version, answer: { value: 'agree' }, confidence: 80 }] } }));
  };
  await answer(openQ, 'canonical-history');
  await saveAgentOnlyModeConfig({ env: f.agentEnv, sessionSlug: 'fixture', patch: { enabledQuestionIds: [proposed] } });
  time += 1000;
  await answer(proposed, 'proposal-history');
  const exportHistory = () => f.request('/api/agent/admin/agent-only/export?view=answers', { token: admin.token });
  for (const questionSourceMode of ['agent_only_proposals', 'canonical_session']) {
    await saveAgentOnlyModeConfig({ env: f.agentEnv, sessionSlug: 'fixture', patch: { questionSourceMode } });
    const response = await exportHistory();
    assert.equal(response.status, 200, await response.clone().text());
    const ids = (await response.text()).trim().split('\n').map(line => JSON.parse(line).statement_id).sort();
    assert.deepEqual(ids, [openQ, proposed].sort());
  }
  await saveAgentOnlyModeConfig({ env: f.agentEnv, sessionSlug: 'fixture', patch: { questionSourceMode: 'canonical_session' } });
  const get = f.env.GROUP_KV.get.bind(f.env.GROUP_KV);
  f.env.GROUP_KV.get = async key => {
    if (key.includes('proposed-question')) throw new Error('Fixture historical source outage');
    return get(key);
  };
  assert.equal((await exportHistory()).status, 503, 'a source outage must not silently remove stored research');
});

for (const kind of ['answers', 'votes']) test(`Wrapped ${kind} retries preserve events and reject changed content after a failed state write`, async () => {
  const { f, coordinated } = readableFixture();
  const token = await memberToken(f);
  const page = await jsonOk(await f.request('/api/agent/agent-only/statements', { token }));
  const statement = page.statements[0];
  const path = kind === 'answers' ? '/api/agent/agent-only/answers/bulk' : '/api/agent/agent-only/token-votes/bulk';
  const bodyFor = (requestId, value) => ({ run_id: 'retry-history', request_id: requestId, agent_metadata: metadata,
    ...(kind === 'answers' ? { answers: [{ statement_id: statement.statement_id, statement_version: statement.statement_version,
      answer: { value }, confidence: 80 }] } : { mode: 'linear', votes: [{ statement_id: statement.statement_id,
      statement_version: statement.statement_version, votes: value }] }) });
  const send = body => f.request(path, { method: 'POST', token, body });
  let time = Date.now();
  coordinated.coordinator.now = () => time;
  const limited = enforceKvWriteLimit(f.env.GROUP_KV, () => time);
  const statePart = kind === 'answers' ? ':answer-state:' : ':vote-state:';
  const put = f.env.GROUP_KV.put.bind(f.env.GROUP_KV);
  let rejectState = true;
  f.env.GROUP_KV.put = async (key, value, options) => {
    if (key.includes(statePart) && rejectState) { rejectState = false; throw new Error('Fixture lost state write'); }
    return put(key, value, options);
  };
  const retryBody = bodyFor('retry', kind === 'answers' ? 'disagree' : 2);
  assert.equal((await send(retryBody)).status, 503);
  const eventPart = kind === 'answers' ? ':answer-event:' : ':vote-event:';
  const before = new Map([...f.records].filter(([key]) => key.includes(eventPart)));
  assert.equal(before.size, 1);
  // Recreate the object from its durable storage after partial publication.
  const restarted = new SessionWriteCoordinator({ storage: coordinated.storage }, f.env);
  restarted.now = () => time;
  f.env.CE_SESSION_COORDINATOR.get = () => ({ fetch: (url, init) => restarted.fetch(new Request(url, init)) });
  time += 1000;
  const changed = bodyFor('retry', kind === 'answers' ? 'agree' : 3);
  assert.equal((await send(changed)).status, 409, 'an existing event must bind the request even when its state write failed');
  await jsonOk(await send(retryBody));
  assert.deepEqual(new Map([...f.records].filter(([key]) => key.includes(eventPart))), before, 'retry preserves the original events and timestamps');
  const replay = await jsonOk(await send(retryBody));
  assert.equal(replay.replay, true);
  const state = JSON.parse([...f.records].find(([key]) => key.includes(statePart))[1]);
  if (kind === 'answers') assert.equal(state.byStatement[statement.statement_id].agent.answer.value.toLowerCase(), 'disagree');
  else assert.equal(state.votes[statement.statement_id], 2);
  assert.equal((await send(bodyFor('next', kind === 'answers' ? 'agree' : 3))).status, 503);
  time += 1000;
  await jsonOk(await send(bodyFor('next', kind === 'answers' ? 'agree' : 3)));
  assert.equal([...f.records.keys()].filter(key => key.includes(eventPart)).length, 2);
  assert.equal(limited.rejected.length, 0, 'the coordinator must not hammer a KV key inside its write interval');
});

test('concurrent Wrapped answer batches preserve both summaries after the throttled batch retries', async () => {
  const { f, coordinated } = readableFixture();
  const token = await memberToken(f);
  const page = await jsonOk(await f.request('/api/agent/agent-only/statements', { token }));
  let time = Date.now();
  coordinated.coordinator.now = () => time;
  const limited = enforceKvWriteLimit(f.env.GROUP_KV, () => time);
  const bodies = page.statements.map((statement, index) => ({ run_id: 'parallel', request_id: `parallel-${index}`, agent_metadata: metadata,
    answers: [{ statement_id: statement.statement_id, statement_version: statement.statement_version, answer: { value: 'agree' }, confidence: 75 }] }));
  const send = body => f.request('/api/agent/agent-only/answers/bulk', { method: 'POST', token, body });
  const responses = await Promise.all(bodies.map(send));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 503]);
  time += 1000;
  await jsonOk(await send(bodies[responses.findIndex(response => response.status === 503)]));
  const state = JSON.parse([...f.records].find(([key]) => key.includes(':answer-state:'))[1]);
  assert.deepEqual(Object.keys(state.byStatement).sort(), [openQ, gatedQ].sort());
  assert.deepEqual(state.counts, { answers: 2, skips: 0 });
  assert.equal(limited.rejected.length, 0);
});

test('partial-reads: reads preserve history and fail closed on missing data', async () => {
// Repro: failed KV list/get calls are swallowed, so results and Wrapped exports are
// computed from partial data and returned as complete 200 responses; a forged export
// cursor yields an empty "final" page instead of a rejection.

const { f } = readableFixture();
const a = await f.credential({ scopes: ['read_questions', 'pose_questions'] });
await f.request('/api/agent/questions/create', { method: 'POST', token: a.token, body: { questions: [{ prompt: 'Partial-read fixture', questionType: 'binary' }] } });
const qid = (await (await f.request('/api/agent/questions', { token: a.token })).json()).questions[0].questionId;
const prefix = 'ce-agent:0x11111111111111111111111111111111:';
for (let i = 0; i < 6; i++) {
  const record = { requestId: `r${i}`, status: 'direct_submitted', sessionSlug: 'fixture', questionId: qid,
    telegramUserId: `p${i}`, answer: { value: i % 2 ? 'Disagree' : 'Agree' }, createdAt: `2026-10-2${i}T00:00:00Z` };
  await f.env.GROUP_KV.put(`${prefix}telegram:submit-request-by-session:v1:fixture:r${i}`, JSON.stringify(record));
}
const consensus = async () => {
  const r = await f.request('/api/agent/results?view=consensus', { token: a.token });
  const b = await r.json(); return `${r.status} responseCount=${b.responseCount} keys=${Object.keys(b).join(',')}`;
};
assert.match(await consensus(), /^200 responseCount=6/);
const get = f.env.GROUP_KV.get.bind(f.env.GROUP_KV);
f.env.GROUP_KV.get = async key => { if (/submit-request-by-session:v1:fixture:r[0-3]$/.test(key)) throw new Error('KV get failed / op limit'); return get(key); };
assert.match(await consensus(), /^503 /);
f.env.GROUP_KV.get = get;
const list = f.env.GROUP_KV.list.bind(f.env.GROUP_KV);
f.env.GROUP_KV.list = async opts => { if (String(opts.prefix).includes('submit-request-by-session')) throw new Error('KV list failed'); return list(opts); };
assert.match(await consensus(), /^503 /);
f.env.GROUP_KV.list = list;

// Wrapped admin export: forged cursor and list failure.
for (let i = 0; i < 3; i++) await f.env.GROUP_KV.put(`${prefix}telegram:agent-only:answer-event:v1:fixture:u${i}:e${i}`,
  JSON.stringify({ telegramUserId: `u${i}`, questionId: qid, answer: { value: 'agree' }, createdAt: '2026-10-27T00:00:00Z' }));
const exp = async (q) => { const r = await f.request(`/api/agent/admin/agent-only/export?view=answers${q}`, { token: a.token });
  return `${r.status} rows=${r.headers.get('x-agent-only-row-count')} next=${r.headers.get('x-agent-only-next-cursor') || ''}`; };
assert.match(await exp('&limit=10'), /^200 rows=3/);
assert.match(await exp('&limit=10&cursor=forged.cursor'), /^400 /);
f.env.GROUP_KV.list = async opts => { if (String(opts.prefix).includes('answer-event')) throw new Error('KV list failed'); return list(opts); };
assert.match(await exp(''), /^503 /);
f.env.GROUP_KV.list = list;
f.env.GROUP_KV.get = async key => { if (key.includes('answer-event')) throw new Error('KV get failed'); return get(key); };
assert.match(await exp('&limit=10'), /^503 /);
f.env.GROUP_KV.get = get;
for (const operation of ['get', 'list']) {
  f.env.GROUP_KV[operation] = async input => {
    if (String(operation === 'get' ? input : input.prefix).includes('proposed-question')) throw new Error('KV proposal read failed');
    return operation === 'get' ? get(input) : list(input);
  };
  assert.equal((await f.request('/api/agent/questions', { token: a.token })).status, 503);
  assert.equal((await f.request('/api/agent/results?view=consensus', { token: a.token })).status, 503);
  f.env.GROUP_KV[operation] = operation === 'get' ? get : list;
}

});


test('more than 2000 proposals remain a capped question list marked incomplete', async () => {
  const { f } = readableFixture();
  const admin = await f.credential({ scopes: ['read_questions', 'pose_questions'] });
  await jsonOk(await f.request('/api/agent/questions/create', { method: 'POST', token: admin.token,
    body: { questions: [{ prompt: 'Cap fixture', questionType: 'binary' }] } }));
  const [key, value] = [...f.records].find(([name]) => name.includes('proposed-question'));
  const template = JSON.parse(value);
  for (let i = 0; i < 2050; i++) {
    const id = `${template.questionId}x${String(i).padStart(4, '0')}`;
    f.records.set(`${key.slice(0, key.lastIndexOf(':') + 1)}${id}`, JSON.stringify({ ...template, questionId: id, prompt: `Cap fixture ${i}` }));
  }
  f.env.GROUP_KV.list = async ({ prefix = '', limit = 1000, cursor = '' } = {}) => {
    const keys = [...f.records.keys()].filter(name => name.startsWith(prefix)).sort();
    const offset = Number(cursor || 0), end = Math.min(keys.length, offset + limit);
    return { keys: keys.slice(offset, end).map(name => ({ name })), list_complete: end === keys.length,
      ...(end < keys.length ? { cursor: String(end) } : {}) };
  };
  const page = await jsonOk(await f.request('/api/agent/questions?limit=200', { token: admin.token }));
  assert.equal(page.complete, false);
  assert.equal(page.questionSourceReason, 'agent_proposals_capped');
  assert.equal(page.total, 2002, '2000 proposals plus both healthy canonical questions');
  assert.equal(page.questions.length, 200);
  assert.equal(page.hasMore, true);
  assert.equal((await f.request('/api/agent/results?view=consensus', { token: admin.token })).status, 503,
    'an aggregate must not present the capped source as a complete result');
});
