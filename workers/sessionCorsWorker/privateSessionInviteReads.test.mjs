// A private session read from a group-password link, through the Worker's
// real entry: what the group's read invite opens signed out, without joining
// or spending anything, and that it opens no more than a member reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';

import {
  WORKER_GROUP_READ_CODE_FEATURE, WORKER_GROUP_READ_PROOF_V2_FEATURE, buildWorkerGroupReadCodeInvite, formatWorkerGroupReadInvite,
  hashOneUseSecret, parseWorkerGroupReadInvite, workerGroupJoinStatement, workerGroupReadStatement, workerGroupReadStatementV2,
} from '../../shared/workerGroupJoin.mjs';
import { WORKER_GROUP_READ_CODE_MISSES, matchesUnusedWorkerGroupInvite } from './workerGroupInvites.js';
import {
  APP_ORIGIN, SESSION_ID, SLUG, WORKER_ORIGIN, createSessionEnv, fetchWorker, login, readJson, signedAdminRequest, uploadJson,
  withoutNonceLimit,
} from './sessionWorkerRuntimeFixture.mjs';

const GROUP = 'salon';
const rule = (groupIds = [GROUP]) => ({
  match: 'any',
  conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'worker_group', groupIds }],
});
const privateOverrides = ({ visibility = 'session_member_full', groupIds } = {}) => {
  // As a private session is stored: gated, and encrypted at rest by the Worker.
  const payloadAccessControl = { gate: 'role_gate', encryption: 'worker_envelope', accessConditions: rule(groupIds) };
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

const ask = (env, path, { invite, token, method = 'GET', body, from } = {}) => {
  const headers = new Headers({ Origin: APP_ORIGIN, 'X-Session-Slug': SLUG });
  if (from) headers.set('CF-Connecting-IP', from);
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
  // These tests sign more admin requests in a minute than one person's sign-in count allows.
  withoutNonceLimit(env);
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

// A proof that names the Worker it is for, as an agent sends it.
const boundInvite = async (key, workerOrigin = WORKER_ORIGIN, groupId = GROUP) => formatWorkerGroupReadInvite({
  groupId, version: 2, proof: await key.signMessage(workerGroupReadStatementV2({ sessionId: SESSION_ID, groupId, workerOrigin })),
});

test('a read proof that names its Worker reads there, and is worth nothing at any other Worker', async () => {
  const { env, key, ids } = await setup();
  const features = (await readJson(await ask(env, '/capabilities'))).body.features;
  assert.ok(features.includes(WORKER_GROUP_READ_PROOF_V2_FEATURE));

  const here = await boundInvite(key);
  assert.deepEqual(parseWorkerGroupReadInvite(here), { groupId: GROUP, proof: here.split(':')[2], version: 2 });
  const catalog = await readJson(await ask(env, catalogPath, { invite: here }));
  assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
  assert.deepEqual(catalog.body.questions.map((entry) => entry.id).sort(), ids);
  assert.equal((await ask(env, '/storage/list?resource=questions&limit=100', { invite: here })).status, 200);
  assert.equal((await readJson(await ask(env, `/session-config?slug=${SLUG}`, { invite: here }))).body.config.sessionName, 'Runtime session');

  // The same password, proved to a Worker that only claims to hold this session: refused here, in either form.
  const elsewhere = await boundInvite(key, 'https://impostor.example');
  for (const invite of [
    elsewhere,
    // Relabelled as the older form, which names no Worker.
    formatWorkerGroupReadInvite({ groupId: GROUP, proof: elsewhere.split(':')[2] }),
    // This Worker's proof under another group's name, and another password's proof.
    formatWorkerGroupReadInvite({ groupId: 'other', version: 2, proof: here.split(':')[2] }),
    await boundInvite(passwordKey('22')),
    'v2:salon:0x1234',
    'v2::',
  ]) {
    for (const path of [catalogPath, '/storage/list?resource=questions&limit=100']) {
      const refused = await readJson(await ask(env, path, { invite }));
      assert.equal(refused.status, 403, `${path} ${invite.slice(0, 20)}`);
      assert.equal(JSON.stringify(refused.body).includes('Private statement'), false);
    }
    assert.equal((await readJson(await ask(env, `/session-config?slug=${SLUG}`, { invite }))).body.privateSession, 'invite_invalid');
  }
  // The older form still reads, for the pages and agents that send it.
  assert.equal((await ask(env, catalogPath, { invite: await readInvite(key) })).status, 200);
});

test('the catalog never shows an invite holder a question a member of that group could not read', async () => {
  const { env, admin, adminToken, key, groupId, ids, invite } = await setup();
  // A question for another group only, one an admin hid, and one the session blocks.
  const post = (resource, data, extra = {}) => ask(env, '/storage/upload', {
    token: adminToken, method: 'POST', body: { data: JSON.stringify(data), contentType: 'application/json', resource, ...extra },
  }).then(readJson);
  const otherOnly = `0x${'c3'.repeat(32)}`;
  const stored = await post('questions', question(otherOnly, 'For another group only'), {
    accessConditions: { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['other'] }] },
  });
  assert.equal(stored.status, 200, JSON.stringify(stored.body));

  // A member of the invite's group, signed in, is the measure.
  const member = Wallet.createRandom();
  const memberToken = await login({ env, wallet: member });
  const proof = await key.signMessage(workerGroupJoinStatement({ sessionId: SESSION_ID, groupId, address: member.address }));
  assert.equal((await ask(env, '/groups/join', { token: memberToken, method: 'POST', body: { sessionId: SESSION_ID, groupId, proof } })).status, 200);
  const memberReads = async (id) => (await ask(env, `/storage/read?id=${encodeURIComponent(id)}`, { token: memberToken })).status;
  assert.equal(await memberReads(stored.body.storageRef.id), 403);

  for (const held of [invite, await boundInvite(key)]) {
    const catalog = await readJson(await ask(env, catalogPath, { invite: held }));
    assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
    assert.deepEqual(catalog.body.questions.map((entry) => entry.id).sort(), ids);
    assert.equal(JSON.stringify(catalog.body).includes('For another group only'), false);
    assert.equal((await ask(env, `/storage/read?id=${encodeURIComponent(stored.body.storageRef.id)}`, { invite: held })).status, 403);
  }
  assert.ok(admin.address);
});

// One-use codes: a group whose seats are claimed with a code each. An agent handed a link with an unused code reads
// with a proof made from the code, which is never sent and never spent by reading.
const CODES = 'by-code';
const CODE = '0123456789abcdef0123456789abcdef';
const soon = (seconds = 600) => Math.floor(Date.now() / 1000) + seconds;
const codeInvite = async (code = CODE, { groupId = CODES, workerOrigin = WORKER_ORIGIN, expires = soon(), sessionId = SESSION_ID } = {}) =>
  buildWorkerGroupReadCodeInvite({ codeHash: await hashOneUseSecret(code), sessionId, groupId, workerOrigin, expires });
const setupCodes = async () => {
  const base = await setup({ groupIds: [GROUP, CODES] });
  const { env, admin } = base;
  const signed = (action, body) => signedAdminRequest({ env, wallet: admin, action, body });
  const created = await signed('groups/create', { group: { groupId: CODES, label: 'By code', joinMode: 'one_use', memberVisibility: 'session' } });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const added = await signed('groups/invites/add', { groupId: CODES, hashes: [await hashOneUseSecret(CODE), await hashOneUseSecret('f'.repeat(32))] });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  const counts = async () => (await signed('groups/invites/list', { groupId: CODES })).body.counts;
  return { ...base, signed, counts };
};
const questionsPath = '/storage/list?resource=questions&limit=100';

test('an unused one-use code reads what its group reads, and reading never spends it', async () => {
  const { env, ids, counts } = await setupCodes();
  assert.ok((await readJson(await ask(env, '/capabilities'))).body.features.includes(WORKER_GROUP_READ_CODE_FEATURE));

  const invite = await codeInvite();
  // The header carries the start of the code's hash and a keyed hash: never the code, nor the whole of its hash.
  const hash = await hashOneUseSecret(CODE);
  assert.equal(invite.includes(CODE), false);
  assert.equal(invite.includes(hash), false);
  assert.equal(parseWorkerGroupReadInvite(invite).hashPrefix, hash.slice(0, 16));

  for (let round = 0; round < 3; round += 1) {
    const catalog = await readJson(await ask(env, catalogPath, { invite }));
    assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
    assert.deepEqual(catalog.body.questions.map((entry) => entry.id).sort(), ids);
    assert.equal(JSON.stringify(catalog.body).includes(invite.split(':')[4]), false);
    assert.equal((await ask(env, questionsPath, { invite })).status, 200);
    assert.equal((await ask(env, '/storage/list?resource=responses&limit=100', { invite })).status, 200);
    assert.equal((await readJson(await ask(env, `/session-config?slug=${SLUG}`, { invite }))).body.config.sessionName, 'Runtime session');
  }
  // Both codes are as they were: unused, and the group has no member.
  assert.deepEqual(await counts(), { unused: 2, used: 0, revoked: 0 });
  // Reading is all it does.
  const write = await ask(env, '/storage/upload', {
    invite, method: 'POST', body: { data: JSON.stringify(question(`0x${'d4'.repeat(32)}`, 'Not mine to add')), contentType: 'application/json', resource: 'questions' },
  });
  assert.ok([401, 403].includes(write.status));
});

test('a code proof for another Worker, group, session or time, or without the code, is refused in the same words', async () => {
  const { env, key } = await setupCodes();
  const good = await codeInvite();
  const parts = good.split(':');
  const hash = await hashOneUseSecret(CODE);
  const refusals = new Set();
  for (const invite of [
    await codeInvite(CODE, { workerOrigin: 'https://impostor.example' }),
    await codeInvite(CODE, { sessionId: `0x${'9'.repeat(64)}` }),
    // Made for the password group, and this group's proof under the password group's name.
    await codeInvite(CODE, { groupId: GROUP }),
    ['c1', GROUP, ...parts.slice(2)].join(':'),
    // Already past, and further off than a proof may name.
    await codeInvite(CODE, { expires: soon(-5) }),
    await codeInvite(CODE, { expires: soon(3 * 60 * 60) }),
    // A later time than was signed.
    ['c1', CODES, parts[2], String(Number(parts[3]) + 60), parts[4]].join(':'),
    // A code nobody was given; the right start with a made-up keyed hash; the hash itself offered as the keyed hash.
    await codeInvite('a'.repeat(32)),
    ['c1', CODES, parts[2], parts[3], '0'.repeat(64)].join(':'),
    ['c1', CODES, parts[2], parts[3], hash].join(':'),
    // The code or its whole hash in place of a proof.
    `c1:${CODES}:${CODE}`,
    `${CODES}:${CODE}`,
  ]) {
    for (const path of [catalogPath, questionsPath]) {
      const refused = await readJson(await ask(env, path, { invite }));
      assert.equal(refused.status, 403, `${path} ${invite.slice(0, 24)}`);
      assert.equal(JSON.stringify(refused.body).includes('Private statement'), false);
      refusals.add(`${path.split('?')[0]} ${refused.body.reason}`);
    }
  }
  // One answer for every miss, whatever was wrong with it.
  assert.deepEqual([...refusals].sort(), ['/agent/interview-catalog private_session_invite_invalid', '/storage/list private_session_invite_invalid']);
  // A password group takes no code proof, and a code group no password proof.
  assert.equal((await ask(env, catalogPath, { invite: await boundInvite(key, WORKER_ORIGIN, CODES) })).status, 403);
  assert.equal((await ask(env, catalogPath, { invite: good })).status, 200);
});

test('a code proof reads and does nothing else: no AI, voice, interview, Session Agent or signed-in route opens to it', async () => {
  const { env, key } = await setupCodes();
  const invite = await codeInvite();
  const password = await boundInvite(key);
  const reasonOf = async (path, options) => (await readJson(await ask(env, path, options))).body?.reason;
  const refusedAsInvite = 'private_session_invite_invalid';
  // Signed out. The group password, which is meant to be shared, gets past the session's rule on these routes;
  // a one-use code, which is one person's, does not.
  for (const path of ['/ai', '/transcribe', '/realtime/call', '/interview/starter', '/session-agent/status', '/session-agent/ask']) {
    const sent = { method: 'POST', body: { sessionSlug: SLUG, sessionId: SESSION_ID } };
    assert.equal(await reasonOf(path, { ...sent, invite }), refusedAsInvite, path);
    assert.notEqual(await reasonOf(path, { ...sent, invite: password }), refusedAsInvite, `${path} by password`);
  }
  assert.equal(await reasonOf(`/resource-presence?slug=${SLUG}`, { invite }), refusedAsInvite);
  // Signed in as someone who is in no group: the code proof lets them through no signed-in route but the reads.
  const outsider = Wallet.createRandom();
  const token = await login({ env, wallet: outsider });
  assert.equal((await ask(env, questionsPath, { token, invite })).status, 200);
  assert.equal((await ask(env, questionsPath, { token })).status, 403);
  for (const [path, method] of [['/ai', 'POST'], ['/session-agent/ask', 'POST'], ['/groups/members?groupId=by-code', 'GET']]) {
    const sent = { token, method, ...(method === 'POST' ? { body: { sessionSlug: SLUG, sessionId: SESSION_ID } } : {}) };
    assert.equal(await reasonOf(path, { ...sent, invite }), refusedAsInvite, `signed in ${path}`);
  }
  // It still reads, signed out, and joined no one.
  assert.equal((await ask(env, questionsPath, { invite })).status, 200);
  assert.equal((await ask(env, `/groups/list?sessionId=${SESSION_ID}&joinGroup=${CODES}`, { invite })).status, 200);
});

test('a code reads only while its group is still open to joining', async () => {
  const { env, signed } = await setupCodes();
  const invite = await codeInvite();
  assert.equal((await ask(env, questionsPath, { invite })).status, 200);
  const closed = await signed('groups/update', { group: { groupId: CODES, joinEndsAt: new Date(Date.now() + 1500).toISOString() } });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  await new Promise((resolve) => setTimeout(resolve, 1600));
  assert.equal((await ask(env, questionsPath, { invite })).status, 403);
});

test('a code stops reading once it is spent or withdrawn; whoever joined with it reads on as a member', async () => {
  const { env, signed, counts } = await setupCodes();
  const invite = await codeInvite();
  const other = await codeInvite('f'.repeat(32));
  assert.equal((await ask(env, catalogPath, { invite })).status, 200);
  assert.equal((await ask(env, catalogPath, { invite: other })).status, 200);

  const member = Wallet.createRandom();
  const memberToken = await login({ env, wallet: member });
  const joined = await readJson(await ask(env, '/groups/join', { token: memberToken, method: 'POST', body: { sessionId: SESSION_ID, groupId: CODES, secret: CODE } }));
  assert.equal(joined.status, 200, JSON.stringify(joined.body));
  assert.deepEqual(await counts(), { unused: 1, used: 1, revoked: 0 });
  for (const path of [catalogPath, questionsPath]) assert.equal((await ask(env, path, { invite })).status, 403, path);
  // The joiner reads as a member, with or without the spent proof still in hand.
  assert.equal((await ask(env, questionsPath, { token: memberToken })).status, 200);
  assert.equal((await ask(env, questionsPath, { token: memberToken, invite })).status, 200);

  assert.equal((await signed('groups/invites/revoke', { groupId: CODES, allUnused: true })).body.revoked, 1);
  assert.equal((await ask(env, catalogPath, { invite: other })).status, 403);
  assert.equal((await ask(env, questionsPath, { invite: await codeInvite('f'.repeat(32)) })).status, 403);
});

test('only an unused, unexpired code admits a read proof', async () => {
  const hash = await hashOneUseSecret(CODE);
  const statement = 'ContextEngine.WorkerGroup.ReadCode:1\nsession:x\ngroup:g\nworker:https://w.example\nexpires:1';
  const { workerGroupReadCodeMac } = await import('../../shared/workerGroupJoin.mjs');
  const code = { hashPrefix: hash.slice(0, 16), statement, mac: await workerGroupReadCodeMac({ codeHash: hash, statement }) };
  const nowMs = Date.parse('2026-11-20T00:00:00Z');
  const admits = (invite, extra = []) => matchesUnusedWorkerGroupInvite({ code, nowMs, candidates: [...extra, [hash, invite]] });
  assert.equal(await admits({ state: 'unused' }), true);
  assert.equal(await admits({ state: 'unused', expiresAt: '2026-11-21T00:00:00Z' }), true);
  assert.equal(await admits({ state: 'unused' }, [[`${hash.slice(0, 16)}${'0'.repeat(48)}`, { state: 'unused' }]]), true);
  assert.equal(await admits({ state: 'unused', expiresAt: '2026-11-19T00:00:00Z' }), false);
  for (const state of ['used', 'revoked', 'reserved', undefined]) assert.equal(await admits({ state }), false, String(state));
  assert.equal(await matchesUnusedWorkerGroupInvite({ code, nowMs, candidates: [] }), false);
  assert.equal(await matchesUnusedWorkerGroupInvite({ code: { ...code, mac: '0'.repeat(64) }, nowMs, candidates: [[hash, { state: 'unused' }]] }), false);
});

test('a sender of many wrong code proofs is refused unlooked-at for a while; others read on', async () => {
  const { env, counts } = await setupCodes();
  const invite = await codeInvite();
  const guesser = '203.0.113.9';
  assert.equal((await ask(env, questionsPath, { invite, from: guesser })).status, 200);
  for (let guess = 0; guess < WORKER_GROUP_READ_CODE_MISSES.limit; guess += 1) {
    const wrong = await codeInvite(guess.toString(16).padStart(32, '0'));
    assert.equal((await ask(env, questionsPath, { invite: wrong, from: guesser })).status, 403);
  }
  // The same words as any wrong proof, now for the right one too.
  const blocked = await readJson(await ask(env, questionsPath, { invite, from: guesser }));
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.reason, 'private_session_invite_invalid');
  assert.equal((await ask(env, questionsPath, { invite, from: '198.51.100.7' })).status, 200);
  // Counting misses wrote nothing: the codes are as they were.
  assert.deepEqual(await counts(), { unused: 2, used: 0, revoked: 0 });
});
