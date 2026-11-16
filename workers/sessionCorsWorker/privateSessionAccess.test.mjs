// A private session's rule against the real group coordinator: who gets in,
// who is refused and why, and that each narrowing holds on the next request.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';

import { formatWorkerGroupReadInvite, workerGroupJoinStatement, workerGroupReadStatement } from '../../shared/workerGroupJoin.mjs';
import { ADMIN, SESSION_ID, createFixture, principal } from './workerGroupTestFixture.mjs';
import {
  PRIVATE_SESSION_INVITE_INVALID,
  PRIVATE_SESSION_INVITE_REQUIRED,
  evaluatePrivateSessionAccess,
  isPrivateSession,
  privateSessionRefusal,
  projectPrivateSessionShell,
} from './privateSessionAccess.js';

const passwordKey = (byte) => new Wallet(`0x${byte.repeat(32)}`);
const readInvite = async (key, groupId = 'salon', sessionId = SESSION_ID) =>
  formatWorkerGroupReadInvite({ groupId, proof: await key.signMessage(workerGroupReadStatement({ sessionId, groupId })) });
const joinProof = (key, index) =>
  key.signMessage(workerGroupJoinStatement({ sessionId: SESSION_ID, groupId: 'salon', address: principal(index).address }));
const request = (invite) => new Request('https://worker.test/storage/list', { headers: invite == null ? {} : { 'X-CE-Group-Invite': invite } });
const ruleOf = (conditions, match = 'any') => ({
  storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none', accessConditions: { match, conditions } } },
});
const groupRule = (groupIds = ['salon'], match) => ruleOf([{ kind: 'worker_role', role: 'admin' }, { kind: 'worker_group', groupIds }], match);

const setup = async () => {
  const f = await createFixture({ joinMode: 'group_password' });
  const key = passwordKey('11');
  await f.admin('groups/password/set', { signer: key.address });
  assert.equal((await f.join(1, { proof: await joinProof(key, 1) })).ok, true);
  const check = (rule, { invite, address = '' } = {}) => evaluatePrivateSessionAccess({
    env: f.env, slug: 'fixture', config: { ...f.sessionConfig, ...rule }, request: request(invite), requesterAddress: address,
  });
  return { f, key, check };
};

test('a session whose rule names no group is not private and admits everyone, as before', async () => {
  const { check } = await setup();
  for (const rule of [{}, ruleOf([{ kind: 'worker_role', role: 'admin' }, { kind: 'agent_grant_scope', scope: 'storage' }])]) {
    assert.equal(isPrivateSession(rule), false);
    assert.deepEqual(await check(rule), { ok: true, private: false });
  }
  assert.equal(isPrivateSession(groupRule()), true);
});

test('admins, members and invite holders get in; everyone else is told why not', async () => {
  const { key, check } = await setup();
  const rule = groupRule();
  const invite = await readInvite(key);
  // Admitted.
  assert.equal((await check(rule, { address: ADMIN })).ok, true);
  assert.equal((await check(rule, { address: principal(1).address })).ok, true);
  assert.equal((await check(rule, { invite })).ok, true);
  assert.equal((await check(rule, { invite, address: principal(2).address })).ok, true);
  // A member whose browser still sends a stale invite is not locked out.
  assert.equal((await check(rule, { invite: await readInvite(passwordKey('22')), address: principal(1).address })).ok, true);
  assert.equal((await check(rule, { invite: 'garbage', address: principal(1).address })).ok, true);

  const required = { ok: false, private: true, status: 403, reason: PRIVATE_SESSION_INVITE_REQUIRED };
  const invalid = { ...required, reason: PRIVATE_SESSION_INVITE_INVALID };
  assert.deepEqual(await check(rule), required);
  assert.deepEqual(await check(rule, { invite: '  ' }), required);
  assert.deepEqual(await check(rule, { address: principal(2).address }), required);
  for (const bad of [
    await readInvite(passwordKey('22')), // another password
    await readInvite(key, 'salon', `0x${'cd'.repeat(16)}`), // another session
    await readInvite(key, 'other'), // a group the rule doesn't name
    formatWorkerGroupReadInvite({ groupId: 'other', proof: (await readInvite(key)).split(':')[1] }), // relabelled
    (await readInvite(key)).slice(0, -2), // cut short
    'garbage',
  ]) {
    assert.deepEqual(await check(rule, { invite: bad }), invalid, bad);
    assert.deepEqual(await check(rule, { invite: bad, address: principal(2).address }), invalid, bad);
  }
});

test('each narrowing refuses on the next request', async () => {
  const { f, key, check } = await setup();
  const invite = await readInvite(key);
  const member = { address: principal(1).address };
  // The group taken out of the rule.
  assert.equal((await check(groupRule(['other']), { invite })).reason, PRIVATE_SESSION_INVITE_INVALID);
  assert.equal((await check(groupRule(['other']), member)).reason, PRIVATE_SESSION_INVITE_REQUIRED);
  // An all-of rule needs every group.
  assert.equal((await check(groupRule(['salon']), { invite })).ok, true);
  const allOf = ruleOf([{ kind: 'worker_group', groupIds: ['salon'] }, { kind: 'worker_group', groupIds: ['other'] }], 'all');
  assert.equal((await check(allOf, { invite })).ok, false);
  // A changed password.
  await f.admin('groups/password/set', { signer: passwordKey('33').address });
  assert.equal((await check(groupRule(), { invite })).reason, PRIVATE_SESSION_INVITE_INVALID);
  assert.equal((await check(groupRule(), { invite: await readInvite(passwordKey('33')) })).ok, true);
  // A removed member.
  assert.equal((await check(groupRule(), member)).ok, true);
  assert.equal((await f.mutate({ operation: 'remove-member', principal: principal(1), remover: 'admin' })).ok, true);
  assert.equal((await check(groupRule(), member)).reason, PRIVATE_SESSION_INVITE_REQUIRED);
  // A group no longer on a password, even one whose old signer is still stored, then deleted.
  const fresh = await readInvite(passwordKey('33'));
  const [groupKey, groupState] = [...f.groupState.store].find(([key, value]) => key.includes('salon') && value?.signer);
  f.groupState.store.set(groupKey, { ...groupState, joinMode: 'admin_add' });
  assert.equal((await check(groupRule(), { invite: fresh })).reason, PRIVATE_SESSION_INVITE_INVALID);
  f.groupState.store.set(groupKey, groupState);
  assert.equal((await check(groupRule(), { invite: fresh })).ok, true);
  assert.equal((await f.mutate({ operation: 'update', input: { joinMode: 'admin_add' } })).ok, true);
  assert.equal((await check(groupRule(), { invite: fresh })).reason, PRIVATE_SESSION_INVITE_INVALID);
  assert.equal((await f.mutate({ operation: 'delete' })).ok, true);
  assert.equal((await check(groupRule(), { invite: fresh })).reason, PRIVATE_SESSION_INVITE_INVALID);
});

test('reading with an invite spends nothing and joins no one', async () => {
  const { f, key, check } = await setup();
  const invite = await readInvite(key);
  const before = f.activeMembers();
  for (let index = 0; index < 5; index += 1) assert.equal((await check(groupRule(), { invite })).ok, true);
  assert.equal(f.activeMembers(), before);
  assert.deepEqual(await f.memberships(2), []);
  // The proof isn't a join proof for anyone.
  assert.equal((await f.join(2, { proof: invite.split(':')[1] })).ok, false);
});

test('a group coordinator that can not answer is a retryable refusal, not an open door', async () => {
  const { f, key } = await setup();
  const env = { ...f.env, CE_WORKER_GROUP_COORDINATOR: { idFromName: (name) => name, get: () => ({ fetch: async () => { throw new Error('down'); } }) } };
  const result = await evaluatePrivateSessionAccess({
    env, slug: 'fixture', config: { ...f.sessionConfig, ...groupRule() }, request: request(await readInvite(key)),
  });
  assert.deepEqual(result, { ok: false, private: true, status: 503, reason: 'private_session_unavailable', retryable: true });
});

test('a refusal never echoes the invite, and the shell keeps only what signing in needs', async () => {
  const sent = [];
  const json = (body, status) => { sent.push({ body, status }); return body; };
  privateSessionRefusal({ access: { ok: false, status: 403, reason: PRIVATE_SESSION_INVITE_INVALID }, json, headers: {} });
  assert.deepEqual(sent, [{ status: 403, body: { error: 'This invite link no longer opens this session.', reason: PRIVATE_SESSION_INVITE_INVALID } }]);

  const shell = projectPrivateSessionShell({
    slug: 's', sessionId: SESSION_ID, configRevision: 'r1', authzEpoch: 3, corsWorkerUrl: 'https://w.test', appearance: { theme: 'civic' },
    sessionModeProfile: { authority: { mode: 'worker_canonical' } }, workerAuthority: { version: 1 }, groupJoinChoices: true,
    sessionName: 'Secret salon', sessionInfo: 'about', sessionContext: 'context text', agentInstructions: 'x',
    sessionHeaderImg: 'https://img.test/a.png', linkedWorkerGroups: ['salon'], sessionAgent: { enabled: true }, interviewMode: {},
  });
  assert.deepEqual(shell, {
    slug: 's', sessionId: SESSION_ID, configRevision: 'r1', authzEpoch: 3, corsWorkerUrl: 'https://w.test', appearance: { theme: 'civic' },
    sessionModeProfile: { authority: { mode: 'worker_canonical' } }, workerAuthority: { version: 1 }, groupJoinChoices: true,
  });
});
