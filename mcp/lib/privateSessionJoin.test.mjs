// An agent meeting a private session: a Worker that shows its shell to
// anyone its rule doesn't admit, and the whole config to a member or to a
// request carrying the group's read invite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ethers } from 'ethers';
import { loadOrCreateWallet } from './agentState.mjs';
import { createParticipant } from './participant.mjs';
import { createWorkerGroupPasswordKeys, parseWorkerGroupReadInvite, workerGroupReadStatementV2 } from '../../shared/workerGroupJoin.mjs';

const fixture = JSON.parse(await readFile(new URL('../../tests/fixtures/worker-compat/previous-minor.json', import.meta.url), 'utf8'));
const { slug, sessionId, corsWorkerUrl } = fixture.config;
const GROUP_ID = 'salon';
const PASSWORD = 'correct horse battery';
const CODE = 'c0'.repeat(16);
const keys = createWorkerGroupPasswordKeys(ethers);
const link = (fragment = '') => `https://contextengine.sh/session/${slug}?joinGroup=${GROUP_ID}&worker=${encodeURIComponent(corsWorkerUrl)}${fragment}`;
const passwordFragment = (password = PASSWORD) => `#groupInvite=${encodeURIComponent(`gp:${password}`)}`;

const setup = async (t, { joinRefused = false, olderWorker = false } = {}) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'ce-agent-private-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const { wallet } = await loadOrCreateWallet(stateDir, { privateKey: ethers.Wallet.createRandom().privateKey });
  const signer = await keys.signerOf({ password: PASSWORD, sessionId: sessionId.toLowerCase(), groupId: GROUP_ID });
  const seen = { invites: [], joins: [], configs: [], paths: [] };
  let member = false;
  const admitted = (headers) => {
    if (member && headers.get('authorization')) return true;
    const invite = parseWorkerGroupReadInvite(headers.get('x-ce-group-invite') || '');
    // Only a proof that names this Worker; the older form, which any Worker could reuse, is never sent.
    return !!invite && invite.groupId === GROUP_ID && invite.version === 2 &&
      ethers.utils.verifyMessage(workerGroupReadStatementV2({ sessionId, groupId: GROUP_ID, workerOrigin: corsWorkerUrl }), invite.proof) === signer;
  };
  const fetchImpl = async (input, init = {}) => {
    const path = new URL(input).pathname;
    const headers = new Headers(init.headers);
    seen.invites.push(headers.get('x-ce-group-invite') || '');
    seen.paths.push(path);
    if (path === '/session-config') {
      const whole = admitted(headers);
      seen.configs.push(whole ? 'whole' : 'shell');
      return Response.json(whole
        ? { ok: true, sessionSlug: slug, config: { ...fixture.config, sessionName: 'Secret salon', sessionInfo: 'Only members read this.' } }
        : { ok: true, sessionSlug: slug, privateSession: headers.get('x-ce-group-invite') ? 'invite_invalid' : 'invite_required',
          config: { slug, sessionId, corsWorkerUrl, allowOrigins: fixture.config.allowOrigins, sessionModeProfile: fixture.config.sessionModeProfile } });
    }
    if (path === '/capabilities') return Response.json({ features: olderWorker ? ['worker_groups'] : ['worker_groups', 'group_read_proof_v2'] });
    if (path === '/auth/nonce') return Response.json({ nonce: 'fixtureNonce12345' });
    if (path === '/auth/login') return Response.json({ token: 'fixture-token' });
    if (path === '/groups/join') {
      const body = JSON.parse(init.body);
      seen.joins.push(body);
      // A good password's proof or the group's one-use code lets someone in.
      if (joinRefused || !(body.proof || body.secret === CODE)) return Response.json({ error: 'Worker group request failed.', reason: 'worker_group_join_refused' }, { status: 403 });
      member = true;
      return Response.json({ ok: true, group: { groupId: GROUP_ID }, memberCount: 1 });
    }
    if (path === '/groups/list') return Response.json({ groups: [{ groupId: GROUP_ID, label: 'Salon', joinMode: 'group_password', memberCount: 1 }] });
    if (path === '/groups/my-memberships') return Response.json({ memberships: member ? [{ groupId: GROUP_ID }] : [] });
    if (path === '/storage/list') return Response.json({ items: [], cursor: null, listComplete: true });
    throw new Error(`Unexpected route: ${path}`);
  };
  const participant = createParticipant({
    wallet,
    config: { stateDir, profile: {}, appOrigin: 'https://contextengine.sh', trustedAppOrigins: ['https://contextengine.sh'] },
    fetchImpl,
  });
  return { participant, seen, wallet };
};

test('join_session opens a private session with its link’s password, then joins the link’s group', async (t) => {
  const { participant, seen } = await setup(t);
  const joined = await participant.joinSession({ link: link(passwordFragment()) });
  assert.equal(joined.joinedGroup, GROUP_ID);
  assert.equal(joined.privateSession, undefined);
  assert.equal(joined.title, 'Secret salon');
  assert.equal(joined.description, 'Only members read this.');
  // The shell first, then the session as the invite and the membership show it.
  assert.deepEqual(seen.configs[0], 'shell');
  assert.ok(seen.configs.slice(1).every((shown) => shown === 'whole'));
  // Once made, the read invite went with every request, and the password with none.
  const first = seen.invites.findIndex(Boolean);
  assert.ok(first > 0 && seen.invites.slice(first).every(Boolean));
  assert.equal(JSON.stringify(seen).includes(PASSWORD), false);
  assert.equal(JSON.stringify(joined).includes(PASSWORD), false);
  assert.ok(seen.joins[0].proof);
});

test('a private session with no usable invite says so and shows nothing of itself', async (t) => {
  for (const fragment of ['', passwordFragment('a wrong password here')]) {
    const { participant } = await setup(t, { joinRefused: true });
    const joined = await participant.joinSession({ link: link(fragment) });
    assert.match(joined.privateSession, /^invite_(required|invalid)$/);
    assert.match(joined.note, /This session is private/);
    assert.equal(joined.joinedGroup, undefined);
    assert.ok(joined.groupJoinError);
    assert.notEqual(joined.title, 'Secret salon');
    assert.equal(JSON.stringify(joined).includes('Only members'), false);
  }
});

test('join_group takes a pasted invite link, naming its group, and reads the session whole after', async (t) => {
  const { participant, seen } = await setup(t);
  const first = await participant.joinSession({ link: link() });
  assert.equal(first.privateSession, 'invite_required');
  const result = await participant.joinGroup({ invite: link(passwordFragment()) });
  assert.deepEqual(result, { session: slug, joinedGroup: GROUP_ID });
  assert.ok(seen.joins.at(-1).proof);
  assert.equal(seen.configs.at(-1), 'whole');
  await assert.rejects(participant.joinGroup({ groupId: 'other', invite: link(passwordFragment()) }), /for group "salon", not "other"/);
  await assert.rejects(participant.joinGroup({ invite: link() }), /carries no group invite/);
  const elsewhere = link(passwordFragment()).replace(`/session/${slug}`, '/session/another-session');
  await assert.rejects(participant.joinGroup({ invite: elsewhere }), /another session/);
});

test('a member rejoining from a plain link reads the session whole once signed in', async (t) => {
  const { participant, seen } = await setup(t);
  await participant.joinSession({ link: link(`#groupInvite=${CODE}`), spendInviteCode: true });
  const again = await participant.joinSession({ link: `https://contextengine.sh/session/${slug}?worker=${encodeURIComponent(corsWorkerUrl)}` });
  assert.equal(again.privateSession, undefined);
  assert.equal(again.title, 'Secret salon');
  assert.equal(seen.configs.at(-1), 'whole');
});

test('a one-use code is used up by joining only when the call says so; nothing is signed or stored before', async (t) => {
  const { participant, seen } = await setup(t);
  const asked = await participant.joinSession({ link: link(`#groupInvite=${CODE}`) });
  assert.equal(asked.joined, false);
  assert.equal(asked.inviteCode, 'unused');
  assert.match(asked.note, /one-use code: joining sends it to the session’s Worker and uses it up.*spendInviteCode true.*ask them first/);
  assert.equal(JSON.stringify(asked).includes(CODE), false);
  assert.deepEqual(seen.joins, []);
  assert.deepEqual(seen.paths.filter((path) => path.startsWith('/auth/')), []);
  assert.deepEqual((await participant.whoami()).sessions, []);
  for (const no of [false, 'true', 1]) assert.equal((await participant.joinSession({ link: link(`#groupInvite=${CODE}`), spendInviteCode: no })).joined, false);
  assert.deepEqual(seen.joins, []);

  const joined = await participant.joinSession({ link: link(`#groupInvite=${CODE}`), spendInviteCode: true });
  assert.equal(seen.joins[0].secret, CODE);
  assert.ok(seen.invites.every((invite) => invite === ''));
  assert.equal(joined.joinedGroup, GROUP_ID);
  assert.equal(joined.title, 'Secret salon');
  assert.equal(JSON.stringify(joined).includes(CODE), false);
});

test('a Worker that doesn’t offer reading with a code is sent no code proof, and the agent is told joining would use the code up', async (t) => {
  for (const olderWorker of [false, true]) {
    const { participant, seen } = await setup(t, { olderWorker });
    for (const read of [() => participant.getSession({ session: link(`#groupInvite=${CODE}`) }), () => participant.getInterviewCatalog({ link: link(`#groupInvite=${CODE}`) })]) {
      await assert.rejects(read(), /doesn’t offer reading with a code.*uses the code up.*ask the person/);
    }
    assert.ok(seen.invites.every((invite) => invite === ''));
    assert.deepEqual(seen.joins, []);
  }
});

test('a Worker from before proofs that name their Worker is sent no read proof; the join still opens the session', async (t) => {
  const { participant, seen } = await setup(t, { olderWorker: true });
  const joined = await participant.joinSession({ link: link(passwordFragment()) });
  assert.ok(seen.invites.every((invite) => invite === ''));
  assert.equal(joined.joinedGroup, GROUP_ID);
  assert.equal(joined.title, 'Secret salon');
  // Reading without joining needs the proof, so there it says why not.
  const reader = await setup(t, { olderWorker: true });
  await assert.rejects(reader.participant.getSession({ session: link(passwordFragment()) }), /from before reading by link/);
  assert.ok(reader.seen.invites.every((invite) => invite === ''));
  assert.equal(reader.seen.joins.length, 0);
});
