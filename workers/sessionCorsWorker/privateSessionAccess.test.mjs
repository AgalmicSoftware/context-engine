// A private session's rule against the real group coordinator: who gets in,
// who is refused and why, and that each narrowing holds on the next request.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Wallet } from 'ethers';

import { formatWorkerGroupReadInvite, workerGroupJoinStatement, workerGroupReadStatement } from '../../shared/workerGroupJoin.mjs';
import { ADMIN, SESSION_ID, createFixture, principal } from './workerGroupTestFixture.mjs';
import { dispatchSessionAgentInstructionsRequest, dispatchSessionConfigBootstrapRequest } from './sessionConfigBootstrapDispatch.js';
import { dispatchAnonymousRoute } from './anonymousRouteDispatch.js';
import { dispatchSignedOutSessionAgentRequest } from './sessionAgentSignedOut.js';
import { dispatchInterviewStarterRequest } from './interviewStarter.js';
import { dispatchResourcePresenceRequest } from './resourcePresenceDispatch.js';
import { dispatchInterviewBriefRequest } from './interviewBriefDispatch.js';
import { issueInterviewCatalogTicket } from './interviewCatalogTicket.js';
import { createWorkerRouteShellWithWorkerDeps } from './workerRouteShellBinding.js';
import { dispatchAuthenticatedRouteEntry } from './authenticatedRouteEntry.js';
import { AGENT_ROUTES } from './agent/routes.mjs';
import { STORAGE_GROUP_READ_INVITE, authorizeCloudflareStorageResourceRead, createRequesterAccessChecks } from './storageRouteExecution.js';
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

const signedOut = (f, path, { invite, config = privateConfig(), query = '', deps = {} } = {}) => dispatchAnonymousRoute({
  path,
  request: new Request(`https://worker.test${path}${query}`, { method: path === '/groups/list' ? 'GET' : 'POST',
    headers: invite ? { 'X-CE-Group-Invite': invite } : {} }),
  anonymousContext: { slug: 'fixture', config, headers: {}, env: f.env },
  deps: { json: (body, status) => ({ body, status }), ...deps },
});

test('a private session lists to a signed-out visitor only the group their invite opens', async () => {
  const { f, key } = await setup();
  await f.mutate({ operation: 'create', principal: undefined, groupId: 'other',
    input: { groupId: 'other', label: 'Other', joinMode: 'open', listed: true } });
  const list = (invite, joinGroup = 'salon') =>
    signedOut(f, '/groups/list', { invite, query: `?sessionId=${SESSION_ID}&joinGroup=${joinGroup}` });
  const opened = await list(await readInvite(key));
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.deepEqual(opened.body.groups.map((group) => group.groupId), ['salon']);
  assert.equal(JSON.stringify(opened.body).includes(ADMIN.slice(2)), false);
  assert.equal((await list()).body.reason, PRIVATE_SESSION_INVITE_REQUIRED);
  assert.equal((await list(await readInvite(passwordKey('22')))).body.reason, PRIVATE_SESSION_INVITE_INVALID);
  // An invite opens its own group's entry, not another's.
  const elsewhere = await list(await readInvite(key), 'other');
  assert.deepEqual([elsewhere.status, elsewhere.body.reason], [403, PRIVATE_SESSION_INVITE_INVALID]);
});

test('the AI routes of a private session answer only those its rule admits', async () => {
  const { f, key } = await setup();
  const reached = [];
  const parsed = async () => { reached.push(true); return { ok: false, status: 400, error: 'parsed' }; };
  const deps = { readAiRequestPayload: parsed, readTranscribeRequestPayload: parsed, readRealtimeCallRequestPayload: parsed };
  const config = { ...privateConfig(), interviewMode: { enabled: true } };
  for (const path of ['/ai', '/transcribe', '/realtime/call']) {
    reached.length = 0;
    assert.equal((await signedOut(f, path, { config, deps })).body.reason, PRIVATE_SESSION_INVITE_REQUIRED, path);
    assert.equal((await signedOut(f, path, { config, deps, invite: await readInvite(passwordKey('22')) })).body.reason,
      PRIVATE_SESSION_INVITE_INVALID, path);
    assert.equal(reached.length, 0, path);
    assert.equal((await signedOut(f, path, { config, deps, invite: await readInvite(key) })).body.error, 'parsed', path);
  }
});

// The routes that read a session for someone signed out, each answering a
// marker once past the rule. Every one is refused without an invite, told an
// invite no longer holds, and let through with a good one.
const sessionReads = {
  json: (body, status = 200) => ({ body, status }),
  resolveRequestSlugWithoutToken: () => ({ ok: true, slug: 'fixture', explicitSlugProvided: true }),
  resolveAnonymousRateIdentity: () => 'visitor',
  getCorsContext: async () => ({ ok: true, headers: {} }),
};
const signedOutRoutes = {
  'session agent': (f, config, request) => dispatchSignedOutSessionAgentRequest({
    request, env: f.env, path: '/session-agent/ask', baseHeaders: {}, constants: {},
    deps: { ...sessionReads, readCurrentSessionConfig: async () => ({ config }), dispatchSessionAgentRoute: async () => ({ body: { marker: true } }) },
  }),
  'interview starter': (f, config, request) => dispatchInterviewStarterRequest({
    request, env: f.env, baseHeaders: {}, constants: {},
    deps: { ...sessionReads, readCurrentSessionConfig: async () => ({ config }),
      evaluateAnonymousRouteAccess: async () => ({ ok: false, status: 418, error: 'marker' }) },
  }),
  'resource presence': (f, config, request) => dispatchResourcePresenceRequest({
    request, env: f.env, baseHeaders: {}, constants: {},
    deps: { ...sessionReads, getSessionConfig: async () => config, getSessionSecrets: async () => ({}) },
  }),
  'interview catalog': (f, config, request) => dispatchInterviewBriefRequest({
    request, env: f.env, baseHeaders: {}, constants: {},
    deps: { ...sessionReads, readCurrentSessionConfig: async () => ({ config }),
      loadPublicInterviewQuestions: async () => { throw Object.assign(new Error('marker'), { marker: true }); } },
  }),
};
const passed = async (run) => {
  try {
    const result = await run();
    return result?.body?.marker === true || result?.body?.error === 'marker' || result?.body?.ok === true;
  } catch (error) {
    return error?.marker === true;
  }
};

test('the signed-out session agent, interview and presence routes follow the rule', async () => {
  const { f, key } = await setup();
  const config = privateConfig();
  const ask = (invite) => new Request('https://worker.test/route?slug=fixture', {
    method: 'POST', body: '{}', headers: invite ? { 'X-CE-Group-Invite': invite } : {},
  });
  for (const [name, route] of Object.entries(signedOutRoutes)) {
    assert.equal((await route(f, config, ask())).body.reason, PRIVATE_SESSION_INVITE_REQUIRED, name);
    assert.equal((await route(f, config, ask(await readInvite(passwordKey('22'))))).body.reason, PRIVATE_SESSION_INVITE_INVALID, name);
    const invite = await readInvite(key);
    assert.equal(await passed(() => route(f, config, ask(invite))), true, name);
    // A session that isn't private is as before.
    const open = privateConfig({ match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'agent_grant_scope', scope: 'storage' }] });
    assert.equal(await passed(() => route(f, open, ask())), true, name);
  }
});

test('a catalog ticket opens a private session to its person only if the rule admits them', async () => {
  const { f } = await setup();
  const env = { ...f.env, TOKEN_HMAC_SECRET: 'synthetic-ticket-hmac' };
  const config = privateConfig();
  const ticketFor = async (address) => (await issueInterviewCatalogTicket({
    env, config, slug: 'fixture', sub: address, parent: 'sign-in-1', parentExp: Math.floor(Date.now() / 1000) + 600,
  })).ticket;
  const read = async (address) => {
    const request = new Request(`https://worker.test/agent/interview-catalog?ticket=${await ticketFor(address)}`);
    return dispatchInterviewBriefRequest({
      request, env, baseHeaders: {}, constants: {},
      deps: { ...sessionReads, readCurrentSessionConfig: async () => ({ config }),
        validateAuthTokenRecord: async () => ({ ok: true }), computeScopesForLogin: async () => ({ storage: true }),
        loadPublicInterviewQuestions: async ({ reader }) => { throw Object.assign(new Error('marker'), { marker: reader?.address }); } },
    }).catch((error) => error.marker);
  };
  assert.equal(await read(principal(1).address), principal(1).address);
  assert.equal((await read(principal(2).address)).body.reason, PRIVATE_SESSION_INVITE_REQUIRED);
});

test('results open to a signed-out invite holder where members see every answer, and to no one else', async () => {
  const { f, key } = await setup();
  const withResults = (visibility, base = privateConfig()) => ({
    ...base,
    sessionModeProfile: { ...base.sessionModeProfile, results: { ...base.sessionModeProfile.results, visibility } },
  });
  const shellFor = (config) => createWorkerRouteShellWithWorkerDeps({
    deps: {
      ...sessionReads,
      toStr: String,
      resolveTopLevelRouteSelection: () => ({ kind: 'results-analysis-artifact' }),
      getRouteBaseHeaders: () => ({}),
      getDefaultWorkerSessionSlug: () => 'fixture',
      readCurrentSessionConfig: async () => ({ config }),
      readPublishedResultsAnalysisArtifact: async () => ({ ok: true, marker: true }),
    },
    constants: {},
  });
  const view = async (config, invite) => (await shellFor(config).fetch(new Request('https://worker.test/results-analysis/artifact?slug=fixture', {
    headers: invite ? { 'X-CE-Group-Invite': invite } : {},
  }), f.env));
  const full = withResults('session_member_full');
  assert.equal((await view(full, await readInvite(key))).body.marker, true);
  // Refused at the door, in the words the page shows, before any read.
  assert.deepEqual((await view(full)).body, { error: 'This session is private. Open it from your group invite link.', reason: PRIVATE_SESSION_INVITE_REQUIRED });
  assert.equal((await view(full, await readInvite(passwordKey('22')))).body.reason, PRIVATE_SESSION_INVITE_INVALID);

  // Where members see only their own answers, an invite reads none.
  const answers = (config, invite, requesterAddress = '') => authorizeCloudflareStorageResourceRead({
    env: f.env, config, slug: 'fixture', resource: 'responses', requesterAddress, authScopes: { storage: true },
    deps: { [STORAGE_GROUP_READ_INVITE]: invite },
  });
  assert.equal((await answers(full, await readInvite(key))).ok, true);
  // A member whose browser still sends an old invite reads as a member.
  assert.equal((await answers(full, await readInvite(passwordKey('22')), principal(1).address)).ok, true);
  const own = await answers(withResults('participant_aggregate'), await readInvite(key));
  assert.equal(own.ok, false);
  assert.equal((await own.response.json()).reason, 'private_response_owner_required');
  // An invite opens nothing in a session whose rule names no group, even one open to all.
  const open = withResults('session_member_full', { ...privateConfig(), storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } } });
  assert.equal((await answers(open, await readInvite(key))).ok, false);
});

test('an item carrying its own rule is still held to a private session\'s rule', async () => {
  const { f, key } = await setup();
  const readsItem = async (rule, { address = '', invite } = {}) => createRequesterAccessChecks({
    env: f.env, config: { ...f.sessionConfig, ...rule }, slug: 'fixture', requesterAddress: address, authScopes: { storage: true },
    deps: invite ? { [STORAGE_GROUP_READ_INVITE]: invite } : {},
  }).canRead({ resource: 'docsContext', accessConditions: { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'storage' }] } });
  // Its own rule admits anyone holding the storage scope; the session's admits members.
  assert.equal(await readsItem(groupRule(), { address: principal(5).address }), false);
  assert.equal(await readsItem(groupRule(), { address: principal(1).address }), true);
  // An invite passes the session's rule; a stale one does not, whatever the item's rule.
  assert.equal(await readsItem(groupRule(), { invite: await readInvite(key) }), true);
  assert.equal(await readsItem(groupRule(), { invite: await readInvite(passwordKey('22')) }), false);
});

test('signed in, a private session admits its members and invite holders, and lets anyone join', async () => {
  const { f, key } = await setup();
  const config = privateConfig();
  const send = (path, method, address, invite) => dispatchAuthenticatedRouteEntry({
    path, method, env: f.env, baseHeaders: {},
    request: new Request(`https://worker.test${path}`, { method, headers: invite ? { 'X-CE-Group-Invite': invite } : {} }),
    deps: {
      json: (body, status) => ({ body, status }),
      requireAuth: async () => ({ ok: true }),
      resolveAuthenticatedRouteContext: async () => ({ ok: true, config, slug: 'fixture', address, scopes: { storage: true, ai: true }, headers: {} }),
      dispatchAuthenticatedRoute: async () => ({ body: { marker: true } }),
    },
  });
  const outsider = principal(2).address;
  for (const [path, method] of [['/ai', 'POST'], ['/session-agent/ask', 'POST'], ['/groups/members', 'GET'],
    ['/storage/response-field-key/unwrap', 'POST'], ['/storage/export-envelopes', 'GET'], ['/groups/create', 'POST'], ['/groups/list', 'GET']]) {
    assert.equal((await send(path, method, outsider)).body.reason, PRIVATE_SESSION_INVITE_REQUIRED, path);
    assert.equal((await send(path, method, outsider, await readInvite(passwordKey('22')))).body.reason, PRIVATE_SESSION_INVITE_INVALID, path);
    assert.equal((await send(path, method, outsider, await readInvite(key))).body.marker, true, path);
    assert.equal((await send(path, method, principal(1).address)).body.marker, true, path);
    assert.equal((await send(path, method, ADMIN)).body.marker, true, path);
  }
  // Storage checks each request itself, and joining a group by its id needs no membership.
  for (const [path, method] of [['/storage/read', 'GET'], ['/storage/list', 'POST'], ['/storage/read-batch', 'POST'], ['/storage/upload', 'POST'],
    ['/groups/join', 'POST'], ['/groups/my-memberships', 'GET'], ['/groups/leave', 'POST']]) {
    assert.equal((await send(path, method, outsider)).body.marker, true, path);
  }
});

// Every route the Worker selects, and what a private session does there. A
// new route fails here until it is placed: behind the rule, or open with the
// reason it shows nothing of the session.
const RULE = 'the rule';
const ROUTE_KINDS = {
  'session-config': RULE, // the shell for anyone it refuses
  'agent-instructions': RULE,
  'resource-presence': RULE,
  'interview-starter': RULE,
  'interview-brief': RULE,
  'session-agent-signed-out': RULE,
  'results-analysis-artifact': RULE,
  'debate-atlas': RULE,
  'risk-matrix': RULE,
  anonymous: RULE, // AI and the group list here; storage checks each read itself
  authenticated: RULE, // at the entry, but for storage reads and uploads, and joining a group by its id
  'interview-catalog-ticket': 'held to the rule where the ticket is used, the catalog',
  'arweave-upload': 'an admin-signed bootstrap upload; otherwise the signed-in entry',
  options: 'open: a CORS preflight',
  capabilities: 'open: what the Worker can do',
  'auth-nonce': 'open: signing in',
  'auth-login': 'open: signing in',
  'auth-logout': 'open: signing out',
  feedback: 'open: a note to the admins that shows nothing back',
  'sponsored-bootstrap-redeem': 'open: a sponsorship code for deploying, no session in it',
  admin: 'admins',
  'admin-abuse-summary': 'admins',
  'admin-results-analysis-status': 'admins',
  'admin-session-diagnostics': 'admins',
  'admin-feedback-list': 'admins',
  'admin-session-agent-chats': 'admins',
};
const AGENT_ACCESS = {
  agent: RULE, wrapped: RULE, participant: RULE, cache: RULE, // cache reads are agent reads; writes are an operator's
  public: 'open: descriptors, ids and an admin-issued invite',
  exchange: 'open: swaps a credential for a sign-in, which the rule then holds',
  operator: 'admins', admin: 'admins', status: 'admins', skillAdmin: 'admins',
};
const PUBLIC_AGENT_ROUTES = ['/api/agent/invite/onboard', '/api/agent/session-meta', '/api/agent/skill', '/api/agent/skill-version',
  '/api/agent/session-wrapped/skill', '/api/agent/session-wrapped/skill-version', '/api/agent/agent-only/start',
  '/api/agent/agent-only/wrapped-image/view/:id'];

test('every route the Worker serves is placed for a private session', () => {
  const source = readFileSync(new URL('./topLevelRouteSelection.js', import.meta.url), 'utf8');
  const kinds = new Set([...source.matchAll(/kind: '([a-z-]+)'/g)].map((match) => match[1]));
  // The two results builds take their kind from their path.
  assert.match(source, /\(path === '\/debate-atlas' \|\| path === '\/risk-matrix'\)[^]*?kind: path\.slice\(1\)/);
  ['debate-atlas', 'risk-matrix'].forEach((kind) => kinds.add(kind));
  assert.deepEqual([...kinds].sort(), Object.keys(ROUTE_KINDS).sort());
  assert.deepEqual([...new Set(Object.values(AGENT_ROUTES).map((route) => route.access))].sort(), Object.keys(AGENT_ACCESS).sort());
  assert.deepEqual(Object.keys(AGENT_ROUTES).filter((path) => AGENT_ROUTES[path].access === 'public').sort(), PUBLIC_AGENT_ROUTES.sort());
});
