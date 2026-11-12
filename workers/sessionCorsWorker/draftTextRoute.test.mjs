import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import { FEATURES } from './workerCapabilities.js';
import { storageRoute } from './storageRouteExecution.js';
import {
  SESSION_ID, SLUG, buildPublicSessionConfig, createSessionEnv, fetchWorker, login, makeRequest, readJson, signedAdminRequest, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';

// Against the real Worker entry: sign-in, route dispatch, session gate and storage.
const session = { sessionId: SESSION_ID, sessionSlug: SLUG };
const QUESTIONS = ['q-one', 'q-two'];
const SECRET = 'drafted-text-only-config-admins-read';

const setup = async ({ keep = true, questions = QUESTIONS, configOverrides = {} } = {}) => {
  const people = { alice: Wallet.createRandom(), bob: Wallet.createRandom(), coAdmin: Wallet.createRandom(), resultsAdmin: Wallet.createRandom() };
  const { admin, config, env } = createSessionEnv({ configOverrides: {
    interviewMode: { keepDraftTextForAdmins: keep },
    adminAddresses: [people.coAdmin.address.toLowerCase()],
    resultsAdminAddresses: [people.resultsAdmin.address.toLowerCase()],
    ...configOverrides,
  } });
  const adminToken = await login({ env, wallet: admin });
  for (const id of questions) {
    const stored = await uploadJson({ env, token: adminToken, resource: 'questions', data: { id, type: 'freeform', prompt: `Why ${id}?`, ...session } });
    assert.equal(stored.status, 200, JSON.stringify(stored.body));
  }
  const tokens = new Map([[admin, adminToken]]);
  const tokenFor = async (wallet) => {
    if (!tokens.has(wallet)) tokens.set(wallet, await login({ env, wallet }));
    return tokens.get(wallet);
  };
  const call = async (action, body, wallet) => {
    const response = await fetchWorker(makeRequest(`/storage/draft-text/${action}`, {
      method: 'POST', body, token: wallet ? await tokenFor(wallet) : '',
    }), env);
    return { ...(await readJson(response)), cacheControl: response.headers.get('cache-control') };
  };
  const rows = () => [...env.CE_STORAGE_INDEX_KV.values.keys()].filter((key) => key.startsWith('ce-draft-text:'));
  return { ...people, admin, config, env, call, rows, tokenFor, tokens };
};

const draft = (questionId, extra = {}) => ({ questionId, aiAnswer: `${SECRET} answer`, aiComment: `${SECRET} comment`, origin: 'voice_interview', condition: 'shown', ...extra });

test('a signed-in participant stores draft text, and a second put overwrites the row', async () => {
  const s = await setup();
  const first = await s.call('put', { items: [draft('q-one'), draft('q-two', { aiComment: undefined, condition: 'blind' })] }, s.alice);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.cacheControl, 'private, no-store');
  assert.equal(s.rows().length, 2);
  const second = await s.call('put', { items: [draft('Q-ONE', { aiAnswer: 'revised' })] }, s.alice);
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(s.rows().length, 2, 'one row per person and question');
  const stored = s.rows().map((key) => JSON.parse(s.env.CE_STORAGE_INDEX_KV.values.get(key)));
  const one = stored.find((row) => row.questionId.toLowerCase() === 'q-one');
  assert.equal(one.aiAnswer, 'revised');
  assert.equal(one.responder, s.alice.address.toLowerCase());
});

test('put is refused when signed out, with the setting off, or after the session ends', async () => {
  const on = await setup();
  assert.equal((await on.call('put', { items: [draft('q-one')] })).status, 401);
  const off = await setup({ keep: false });
  const refused = await off.call('put', { items: [draft('q-one')] }, off.alice);
  assert.equal(refused.status, 403, JSON.stringify(refused.body));
  assert.equal(refused.body.reason, 'draft_text_disabled');
  const ended = await setup({ questions: [], configOverrides: { sessionEndsAt: new Date(Date.now() - 60_000).toISOString() } });
  assert.equal((await ended.call('put', { items: [draft('q-one')] }, ended.alice)).status, 410);
  assert.deepEqual([...on.rows(), ...off.rows(), ...ended.rows()], []);
});

test('put refuses unknown questions, oversized or unknown fields, duplicates and bad enums', async () => {
  const s = await setup();
  const unknown = await s.call('put', { items: [draft('q-one'), draft('q-missing')] }, s.alice);
  assert.equal(unknown.status, 422, JSON.stringify(unknown.body));
  assert.equal(unknown.body.reason, 'response_question_unknown');
  for (const items of [
    [draft('q-one', { aiAnswer: 'x'.repeat(8001) })],
    [draft('q-one', { aiComment: 'x'.repeat(8001) })],
    [draft('q-one', { answer: 'Agree' })],
    [draft('q-one'), draft('Q-one')],
    [draft('q-one', { origin: 'made_up' })],
    [draft('q-one', { condition: 'hidden' })],
    [draft('q-one', { aiAnswer: ' ', aiComment: '' })],
    [draft('q-one', { aiAnswer: 7 })],
    [],
    Array.from({ length: 201 }, (_, index) => draft(`q-${index}`)),
  ]) {
    const refused = await s.call('put', { items }, s.alice);
    assert.equal(refused.status, 400, `${JSON.stringify(items).slice(0, 120)}: ${JSON.stringify(refused.body)}`);
  }
  assert.equal((await s.call('put', { items: [draft('q-one')], extra: true }, s.alice)).status, 400);
  // Exactly at the limit is accepted.
  assert.equal((await s.call('put', { items: [draft('q-one', { aiAnswer: 'x'.repeat(8000), aiComment: 'y'.repeat(8000) })] }, s.alice)).status, 200);
  assert.equal(s.rows().length, 1);
});

test('put is capped by request size', async () => {
  const s = await setup();
  const big = await s.call('put', { items: [draft('q-one')], padding: 'x'.repeat(2 * 1024 * 1024) }, s.alice);
  assert.equal(big.status, 413, JSON.stringify(big.body));
});

test('put requires the session gate a response upload needs', async () => {
  const member = Wallet.createRandom();
  const base = buildPublicSessionConfig({ admin: member.address });
  const gated = { gate: 'role_gate', encryption: 'none', accessConditions: { version: 1, match: 'any', conditions: [
    { kind: 'worker_role', role: 'member' }, { kind: 'worker_role', role: 'admin' },
  ] } };
  const s = await setup({ configOverrides: {
    roles: { member: [member.address.toLowerCase()] },
    sessionModeProfile: { ...base.sessionModeProfile, storage: { backend: 'cloudflare', payloadAccessControl: gated } },
    storageProfile: { ...base.storageProfile, payloadAccessControl: gated },
  } });
  // Alice is not a member: her answer and her draft text are both refused.
  const answer = await uploadJson({ env: s.env, token: await s.tokenFor(s.alice), resource: 'responses', data: { questionID: 'q-one', answer: 'Because', ...session } });
  assert.equal(answer.status, 403, JSON.stringify(answer.body));
  const refused = await s.call('put', { items: [draft('q-one')] }, s.alice);
  assert.equal(refused.status, 403, JSON.stringify(refused.body));
  assert.deepEqual(s.rows(), []);
  const accepted = await s.call('put', { items: [draft('q-one')] }, member);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
});

test('only a config admin exports draft text; members, co-admins and results admins may not', async () => {
  const s = await setup();
  assert.equal((await s.call('put', { items: [draft('q-one')] }, s.alice)).status, 200);
  assert.equal((await s.call('put', { items: [draft('q-one'), draft('q-two')] }, s.bob)).status, 200);
  assert.equal((await s.call('export', {})).status, 401);
  for (const wallet of [s.alice, s.coAdmin, s.resultsAdmin]) {
    const refused = await s.call('export', {}, wallet);
    assert.equal(refused.status, 403, JSON.stringify(refused.body));
    assert.equal(JSON.stringify(refused.body).includes(SECRET), false);
  }
  const exported = await s.call('export', {}, s.admin);
  assert.equal(exported.status, 200, JSON.stringify(exported.body));
  assert.equal(exported.cacheControl, 'private, no-store');
  assert.equal(exported.body.type, 'ce_draft_text_export');
  assert.equal(exported.body.version, 1);
  assert.equal(exported.body.sessionSlug, SLUG);
  assert.equal(exported.body.cursor, null);
  const pairs = exported.body.rows.map((row) => `${row.responder}:${row.questionId}`).sort();
  assert.deepEqual(pairs, [
    `${s.alice.address.toLowerCase()}:q-one`, `${s.bob.address.toLowerCase()}:q-one`, `${s.bob.address.toLowerCase()}:q-two`,
  ].sort());
  assert.equal(exported.body.rows[0].aiAnswer, `${SECRET} answer`);
  assert.equal(exported.body.rows[0].origin, 'voice_interview');
});

test('delete removes only the caller\'s rows, by question or all, and works with the setting off or the session ended', async () => {
  const s = await setup();
  assert.equal((await s.call('put', { items: [draft('q-one'), draft('q-two')] }, s.alice)).status, 200);
  assert.equal((await s.call('put', { items: [draft('q-one'), draft('q-two')] }, s.bob)).status, 200);
  assert.equal((await s.call('delete', { questionIds: ['q-one'] })).status, 401);
  // Bob asking to delete q-one deletes his row, never Alice's.
  assert.equal((await s.call('delete', { questionIds: ['Q-ONE', 'q-gone'] }, s.bob)).status, 200);
  assert.equal(s.rows().length, 3);
  assert.equal((await s.call('delete', { all: true }, s.bob)).status, 200);
  const left = s.rows().map((key) => JSON.parse(s.env.CE_STORAGE_INDEX_KV.values.get(key)).responder);
  assert.deepEqual(left, [s.alice.address.toLowerCase(), s.alice.address.toLowerCase()]);
  // Deleting nothing is fine.
  assert.equal((await s.call('delete', { all: true }, s.bob)).status, 200);
  for (const body of [{}, { all: false }, { all: true, questionIds: ['q-one'] }, { questionIds: [3] }, { questionIds: 'q-one' }]) {
    assert.equal((await s.call('delete', body, s.alice)).status, 400, JSON.stringify(body));
  }

  // The admin turns the setting off and ends the session: withdrawal still works.
  const changed = await signedAdminRequest({ env: s.env, wallet: s.admin, action: 'set-config', body: { config: {
    ...s.config, interviewMode: { keepDraftTextForAdmins: false },
    sessionModeProfile: { ...s.config.sessionModeProfile, preset: 'custom', results: { ...s.config.sessionModeProfile.results,
      exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } }, export: { scope: 'all_session' } },
    sessionEndsAt: new Date(Date.now() - 60_000).toISOString(),
  } } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  s.tokens.clear(); // A config change signs everyone out.
  assert.equal((await s.call('put', { items: [draft('q-one')] }, s.bob)).status, 410);
  assert.equal((await s.call('delete', { questionIds: ['q-two'] }, s.alice)).status, 200);
  assert.equal(s.rows().length, 1);
  assert.equal((await s.call('delete', { all: true }, s.alice)).status, 200);
  assert.deepEqual(s.rows(), []);
});

test('response listing and reading never return draft text', async () => {
  const s = await setup();
  const token = await s.tokenFor(s.alice);
  const answered = await uploadJson({ env: s.env, token, resource: 'responses', data: { questionID: 'q-one', answer: 'My own words', ...session } });
  assert.equal(answered.status, 200, JSON.stringify(answered.body));
  assert.equal((await s.call('put', { items: [draft('q-one')] }, s.alice)).status, 200);
  const adminToken = await s.tokenFor(s.admin);
  for (const [path, options] of [
    ['/storage/list?resource=responses', { token }],
    ['/storage/list?resource=responses', { token: adminToken }],
    ['/storage/list?resource=responses', {}],
    ['/storage/list', { token: adminToken }],
  ]) {
    const listed = await readJson(await fetchWorker(makeRequest(path, options), s.env));
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.equal(JSON.stringify(listed.body).includes(SECRET), false, path);
    assert.equal(JSON.stringify(listed.body).includes('ce-draft-text'), false, path);
    if (path.includes('responses')) assert.equal(listed.body.items.length, 1);
  }
  const listed = await readJson(await fetchWorker(makeRequest('/storage/list?resource=responses', { token }), s.env));
  const batch = await readJson(await fetchWorker(makeRequest('/storage/read-batch', {
    method: 'POST', token: adminToken, body: { resource: 'responses', ids: listed.body.items.map((item) => item.storageRef.id) },
  }), s.env));
  assert.equal(batch.status, 200, JSON.stringify(batch.body));
  assert.equal(JSON.stringify(batch.body).includes('My own words'), true);
  assert.equal(JSON.stringify(batch.body).includes(SECRET), false);
});

test('the route itself refuses a caller without an address or a storage scope', async () => {
  const s = await setup();
  for (const [uploaderAddress, authScopes] of [['', { storage: true }], [s.alice.address, {}], ['not-an-address', { storage: true }]]) {
    for (const action of ['put', 'delete', 'export']) {
      const response = await storageRoute({
        path: `/storage/draft-text/${action}`, method: 'POST', env: s.env, config: s.config, slug: SLUG, uploaderAddress, authScopes,
        request: new Request(`https://worker.example/storage/draft-text/${action}`, { method: 'POST', body: JSON.stringify({ items: [draft('q-one')], all: true }) }),
        deps: { validateAdmin: async () => true },
      });
      assert.equal(response.status, 401, `${action} ${uploaderAddress}`);
    }
  }
  assert.deepEqual(s.rows(), []);
});

test('the Worker advertises draft_text_v1', () => {
  assert.ok(FEATURES.includes('draft_text_v1'));
});
