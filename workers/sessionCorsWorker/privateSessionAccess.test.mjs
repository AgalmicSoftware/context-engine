// A private session's rule against the real group coordinator: who gets in,
// who is refused and why, and that each narrowing holds on the next request.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';

import { formatWorkerGroupReadInvite, workerGroupJoinStatement, workerGroupReadStatement } from '../../shared/workerGroupJoin.mjs';
import { ADMIN, SESSION_ID, createFixture, principal } from './workerGroupTestFixture.mjs';
import { dispatchSessionAgentInstructionsRequest, dispatchSessionConfigBootstrapRequest } from './sessionConfigBootstrapDispatch.js';
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

// A whole private session config, as the Worker stores one.
const privateConfig = (rule = { match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'worker_group', groupIds: ['salon'] }] }) => ({
  slug: 'fixture',
  sessionId: SESSION_ID,
  configRevision: 'revision-a',
  authzEpoch: 2,
  sessionName: 'Secret salon',
  sessionInfo: 'Who is coming',
  sessionContext: 'The context text',
  agentInstructions: 'Be kind.',
  adminAddress: ADMIN,
  corsWorkerUrl: 'https://fixture.example.workers.dev',
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'custom',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: null },
    storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'role_gate', encryption: 'worker_envelope', accessConditions: rule } },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
    surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
    results: { visibility: 'participant_aggregate', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
    export: { scope: 'admin_raw' },
  },
  workerAuthority: { version: 1, participantScopes: ['ai', 'storage'], anonymousScopes: ['ai'] },
  storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'role_gate', encryption: 'worker_envelope', accessConditions: rule } },
});

const readConfig = async (env, config, { invite, requester } = {}) => dispatchSessionConfigBootstrapRequest({
  request: new Request('https://worker.test/session-config', { headers: invite ? { 'X-CE-Group-Invite': invite } : {} }),
  env,
  baseHeaders: {},
  deps: {
    resolveRequestSlugWithoutToken: () => ({ ok: true, slug: 'fixture', explicitSlugProvided: true }),
    getSessionConfig: async () => config,
    getCorsContext: async () => ({ ok: true, headers: {} }),
    json: (body, status) => ({ body, status }),
    resolveOptionalRequester: async () => requester || { address: '', scopes: {} },
  },
  constants: { missingSlugError: 'Missing.', sessionConfigNotFoundError: 'Not found.' },
});

test('session-config gives a visitor the rule does not admit only the shell, and says why', async () => {
  const { f, key } = await setup();
  const config = privateConfig();
  const shellKeys = ['allowOrigins', 'appearance', 'authzEpoch', 'configRevision', 'corsWorkerUrl', 'sessionId', 'sessionIdHex', 'sessionModeProfile',
    'slug', 'storageProfile', 'workerAuthority'];
  for (const [options, reason] of [[{}, 'invite_required'], [{ invite: await readInvite(passwordKey('22')) }, 'invite_invalid'],
    [{ requester: { address: principal(2).address } }, 'invite_required']]) {
    const { status, body } = await readConfig(f.env, config, options);
    assert.equal(status, 200);
    assert.equal(body.privateSession, reason);
    assert.equal(body.config.sessionModeProfile.authority.mode, 'worker_canonical');
    for (const hidden of ['sessionName', 'sessionInfo', 'sessionContext', 'agentInstructions', 'adminAddress']) {
      assert.equal(hidden in body.config, false, hidden);
    }
    assert.deepEqual(Object.keys(body.config).filter((field) => !shellKeys.includes(field) && !/Ready|Choices|Results|Atlas|Matrix|Merges/.test(field)), []);
  }
  for (const options of [{ invite: await readInvite(key) }, { requester: { address: principal(1).address } }, { requester: { address: ADMIN } }]) {
    const { status, body } = await readConfig(f.env, config, options);
    assert.equal(status, 200);
    assert.equal('privateSession' in body, false);
    assert.equal(body.config.sessionName, 'Secret salon');
    assert.equal(body.config.sessionContext, 'The context text');
  }
  // A group check that can't be answered refuses, retryably, rather than showing either.
  const down = { ...f.env, CE_WORKER_GROUP_COORDINATOR: { idFromName: (name) => name, get: () => ({ fetch: async () => { throw new Error('down'); } }) } };
  const outage = await readConfig(down, config, { invite: await readInvite(key) });
  assert.deepEqual([outage.status, outage.body.reason, outage.body.retryable], [503, 'private_session_unavailable', true]);
  // A session that isn't private is unchanged.
  const open = privateConfig({ match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'agent_grant_scope', scope: 'storage' }] });
  assert.equal((await readConfig(f.env, open)).body.config.sessionName, 'Secret salon');
});

test('agent instructions follow the same rule', async () => {
  const { f, key } = await setup();
  const read = async (invite) => dispatchSessionAgentInstructionsRequest({
    request: new Request('https://worker.test/llms.txt', { headers: invite ? { 'X-CE-Group-Invite': invite } : {} }),
    env: f.env,
    baseHeaders: {},
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, slug: 'fixture', explicitSlugProvided: true }),
      getSessionConfig: async () => privateConfig(),
      getCorsContext: async () => ({ ok: true, headers: {} }),
      json: (body, status) => ({ body, status }),
    },
    constants: { missingSlugError: 'Missing.', sessionConfigNotFoundError: 'Not found.' },
  });
  assert.equal((await read()).body.reason, PRIVATE_SESSION_INVITE_REQUIRED);
  assert.equal((await read(await readInvite(passwordKey('22')))).body.reason, PRIVATE_SESSION_INVITE_INVALID);
  assert.equal(await (await read(await readInvite(key))).text(), 'Be kind.');
});
