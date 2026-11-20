// A private session read from a group-password link, through the Worker's
// real entry: what the group's read invite opens signed out, without joining
// or spending anything, and that it opens no more than a member reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';

import { formatWorkerGroupReadInvite, workerGroupJoinStatement, workerGroupReadStatement } from '../../shared/workerGroupJoin.mjs';
import {
  APP_ORIGIN, SESSION_ID, SLUG, WORKER_ORIGIN, createSessionEnv, fetchWorker, login, readJson, signedAdminRequest, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';

const GROUP = 'salon';
const rule = (groupIds = [GROUP]) => ({
  match: 'any',
  conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'worker_group', groupIds }],
});
const privateOverrides = ({ visibility = 'session_member_full' } = {}) => {
  // As a private session is stored: gated, and encrypted at rest by the Worker.
  const payloadAccessControl = { gate: 'role_gate', encryption: 'worker_envelope', accessConditions: rule() };
  return {
    workerGroupsBootstrap: { version: 2, state: 'fresh_empty', bootstrapId: 'b0'.repeat(32) },
    workerAuthority: { version: 1, participantScopes: ['storage', 'groups'], anonymousScopes: [] },
    interviewMode: { enabled: true },
    sessionModeProfile: {
      profileVersion: 1,
      preset: 'custom',
      authority: { mode: 'worker_canonical' },
      evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl },
      identity: { default: 'passkey', enabled: ['passkey'] },
      authorization: { mechanisms: ['worker_roles'] },
      encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
      surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
      results: { visibility, exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
      export: { scope: 'admin_raw' },
    },
    storageProfile: {
      type: 'session_storage_profile',
      version: 'session-storage-profile-v1',
      backend: 'cloudflare',
      sessionOwned: true,
      resources: { docsContext: 'active', questions: 'active', surveys: 'active', responses: 'active' },
      payloadAccessControl,
    },
  };
};

const passwordKey = (byte) => new Wallet(`0x${byte.repeat(32)}`);
const readInvite = async (key, groupId = GROUP) =>
  formatWorkerGroupReadInvite({ groupId, proof: await key.signMessage(workerGroupReadStatement({ sessionId: SESSION_ID, groupId })) });

const ask = (env, path, { invite, token, method = 'GET', body } = {}) => {
  const headers = new Headers({ Origin: APP_ORIGIN, 'X-Session-Slug': SLUG });
  if (invite) headers.set('X-CE-Group-Invite', invite);
  if (token) { headers.set('Authorization', `Bearer ${token}`); headers.set('X-Group-Slug', SLUG); }
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return fetchWorker(new Request(`${WORKER_ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
};
const catalogPath = `/agent/interview-catalog?slug=${SLUG}&sessionUrl=${encodeURIComponent(`${APP_ORIGIN}/session/${SLUG}`)}`;

const question = (id, prompt) => ({
  id, type: 'binary', prompt, sessionSlug: SLUG, sessionId: SESSION_ID, options: ['Agree', 'Unsure', 'Disagree'],
});

const setup = async (options) => {
  const { env, admin } = createSessionEnv({ configOverrides: privateOverrides(options) });
  env.CE_STORAGE_ENVELOPE_KEK = 'synthetic-private-session-kek';
  const key = passwordKey('11');
  const created = await signedAdminRequest({
    env, wallet: admin, action: 'groups/create', body: { group: { groupId: GROUP, label: 'Salon', joinMode: 'group_password', memberVisibility: 'session' } },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const groupId = created.body.group.groupId;
  const set = await signedAdminRequest({ env, wallet: admin, action: 'groups/password/set', body: { groupId, signer: key.address } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  const adminToken = await login({ env, wallet: admin });
  const ids = [`0x${'a1'.repeat(32)}`, `0x${'b2'.repeat(32)}`];
  for (const [index, id] of ids.entries()) {
    const stored = await uploadJson({ env, token: adminToken, resource: 'questions', data: JSON.stringify(question(id, `Private statement ${index + 1}`)) });
    assert.equal(stored.status, 200, JSON.stringify(stored.body));
  }
  return { env, admin, adminToken, key, groupId, ids, invite: await readInvite(key, groupId) };
};

const memberCount = async (env, adminToken, groupId) => {
  const listed = await readJson(await ask(env, `/groups/list?sessionId=${SESSION_ID}`, { token: adminToken }));
  return listed.body.groups?.find((group) => group.groupId === groupId)?.memberCount ?? 0;
};

test('the question catalog of a private session opens to the group’s read invite, and to nothing less', async () => {
  const { env, adminToken, key, groupId, ids, invite } = await setup();
  const before = await memberCount(env, adminToken, groupId);

  const refused = await readJson(await ask(env, catalogPath));
  assert.equal(refused.status, 403);
  assert.equal(refused.body.reason, 'private_session_invite_required');

  for (const bad of [await readInvite(passwordKey('22'), groupId), await readInvite(key, 'other'), 'garbage']) {
    const wrong = await readJson(await ask(env, catalogPath, { invite: bad }));
    assert.equal(wrong.status, 403, bad);
    assert.equal(wrong.body.reason, 'private_session_invite_invalid', bad);
    assert.equal(JSON.stringify(wrong.body).includes('Private statement'), false);
  }

  const opened = await ask(env, catalogPath, { invite });
  const catalog = await readJson(opened);
  assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
  assert.deepEqual(catalog.body.questions.map((entry) => entry.id).sort(), ids);
  assert.deepEqual(catalog.body.questions.map((entry) => entry.prompt).sort(), ['Private statement 1', 'Private statement 2']);
  // The invite went in a header: nothing the Worker answers repeats it, and no link carries it.
  const proof = invite.split(':')[1];
  assert.equal(JSON.stringify(catalog.body).includes(proof), false);
  assert.equal(catalog.body.reviewUrl.includes(proof), false);
  assert.equal(opened.headers.get('cache-control'), 'no-store');
  assert.equal(opened.headers.get('referrer-policy'), 'no-referrer');
  // Reading spent nothing and joined no one.
  assert.equal(await memberCount(env, adminToken, groupId), before);
});

test('a changed password ends the catalog for the old link at once', async () => {
  const { env, admin, groupId, invite } = await setup();
  assert.equal((await ask(env, catalogPath, { invite })).status, 200);
  const next = passwordKey('33');
  assert.equal((await signedAdminRequest({ env, wallet: admin, action: 'groups/password/set', body: { groupId, signer: next.address } })).status, 200);
  const old = await readJson(await ask(env, catalogPath, { invite }));
  assert.equal(old.body.reason, 'private_session_invite_invalid');
  assert.equal((await ask(env, catalogPath, { invite: await readInvite(next, groupId) })).status, 200);
});

test('signed out, the invite reads what a member reads of a private session: config, questions, context, groups', async () => {
  const { env, adminToken, groupId, ids, invite } = await setup();
  const stored = await uploadJson({
    env, token: adminToken, resource: 'docsContext', data: JSON.stringify({ title: 'Briefing', body: 'For the salon.' }),
  });
  assert.equal(stored.status, 200, JSON.stringify(stored.body));

  // The session's own description.
  const shell = await readJson(await ask(env, `/session-config?slug=${SLUG}`));
  assert.equal(shell.body.privateSession, 'invite_required');
  assert.equal(shell.body.config.sessionName, undefined);
  const whole = await readJson(await ask(env, `/session-config?slug=${SLUG}`, { invite }));
  assert.equal(whole.body.privateSession, undefined);
  assert.equal(whole.body.config.sessionName, 'Runtime session');

  // Questions and context, listed and read.
  for (const resource of ['questions', 'docsContext']) {
    const none = await readJson(await ask(env, `/storage/list?resource=${resource}&limit=100`));
    assert.equal(none.status, 403, resource);
    const listed = await readJson(await ask(env, `/storage/list?resource=${resource}&limit=100`, { invite }));
    assert.equal(listed.status, 200, `${resource}: ${JSON.stringify(listed.body)}`);
    assert.equal(listed.body.items.length, resource === 'questions' ? ids.length : 1, resource);
    const id = listed.body.items[0].storageRef.id;
    assert.equal((await ask(env, `/storage/read?id=${encodeURIComponent(id)}`)).status, 403, resource);
    assert.equal((await ask(env, `/storage/read?id=${encodeURIComponent(id)}`, { invite })).status, 200, resource);
    const batch = await readJson(await ask(env, '/storage/read-batch', { invite, method: 'POST', body: { ids: [id] } }));
    assert.equal(batch.body.items?.[0]?.status, 200, `${resource}: ${JSON.stringify(batch.body)}`);
  }

  // The group its link names, and no other.
  const groups = await readJson(await ask(env, `/groups/list?sessionId=${SESSION_ID}&joinGroup=${groupId}`, { invite }));
  assert.equal(groups.status, 200, JSON.stringify(groups.body));
  assert.deepEqual(groups.body.groups.map((group) => group.groupId), [groupId]);
});

test('answers open to the invite only where members see every answer; an invite never writes', async () => {
  for (const [visibility, readable] of [['session_member_full', true], ['participant_aggregate', false], ['private_admin', false]]) {
    const { env, key, groupId, ids, invite } = await setup({ visibility });
    const member = Wallet.createRandom();
    const memberToken = await login({ env, wallet: member });
    const proof = await key.signMessage(workerGroupJoinStatement({ sessionId: SESSION_ID, groupId, address: member.address }));
    const joined = await readJson(await ask(env, '/groups/join', { token: memberToken, method: 'POST', body: { sessionId: SESSION_ID, groupId, proof } }));
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
    const answered = await uploadJson({
      env, token: memberToken, resource: 'responses',
      data: JSON.stringify({ questionId: ids[0], sessionSlug: SLUG, sessionId: SESSION_ID, response: 'Agree', responder: member.address }),
    });
    assert.equal(answered.status, 200, JSON.stringify(answered.body));

    const listed = await readJson(await ask(env, '/storage/list?resource=responses&limit=100', { invite }));
    assert.equal(listed.status === 200 && listed.body.items.length === 1, readable, `${visibility}: ${JSON.stringify(listed.body)}`);
    const id = answered.body.storageRef?.id || answered.body.id;
    assert.equal((await ask(env, `/storage/read?id=${encodeURIComponent(id)}`, { invite })).status === 200, readable, visibility);

    // The invite alone is no sign-in: nothing is stored on its word.
    const write = await ask(env, '/storage/upload', {
      invite, method: 'POST', body: { data: '{}', contentType: 'application/json', resource: 'responses' },
    });
    assert.equal(write.status, 401, visibility);
  }
});
