import test from 'node:test';
import assert from 'node:assert/strict';
import { persistAgentProposedQuestion } from './agent/agentQuestionProposals.mjs';
import { saveAgentOnlyModeConfig } from './agent/wrappedConfig.mjs';
import { world, baseConfig, member, outsider, WORKER, ORIGIN, revokeAgentCredentialHash } from './agentSecurityFixture.mjs';

const A = '0x' + 'a1'.repeat(16);
const gated = () => {
  const cfg = baseConfig('alpha', A);
  cfg.workerAuthority.loginGate = { conditions: [{ kind: 'worker_role', role: 'participant' }] };
  cfg.workerRoles = { participant: [member.address] };
  return cfg;
};
const hdr = { 'x-session-slug': 'alpha' };
const show = async (_label, response) => response.status;

test('exchange-derived JWT and browser credential follow request-time gate, epoch, rotation and disable', async () => {
  const w = world({ sessions: { alpha: gated() } });
  const source = await w.credential('alpha');
  const ex = await w.request('/api/agent/client-login/exchange', { method: 'POST', body: { sessionSlug: 'alpha', token: source.token } });
  assert.equal(await show('exchange', ex), 200);
  const { workerCredential, agentCredential } = await ex.json();
  assert.equal(await show('jwt health', await w.request('/health', { token: workerCredential.token, headers: hdr })), 200);
  assert.equal(await show('browser actions', await w.request('/api/agent/actions?sessionSlug=alpha', { token: agentCredential.token })), 200);
  // Gate loss without epoch bump.
  w.bump('alpha', c => ({ workerRoles: { participant: [] } }));
  const lostJwt = await show('gate-lost jwt health', await w.request('/health', { token: workerCredential.token, headers: hdr }));
  const lostBrowser = await show('gate-lost browser actions', await w.request('/api/agent/actions?sessionSlug=alpha', { token: agentCredential.token }));
  const lostSource = await show('gate-lost source actions', await w.request('/api/agent/actions?sessionSlug=alpha', { token: source.token }));
  assert.equal(lostJwt, 403); assert.equal(lostBrowser, 403); assert.equal(lostSource, 403);
  w.bump('alpha', c => ({ workerRoles: { participant: [member.address] } }));
  assert.equal(await show('restored jwt health', await w.request('/health', { token: workerCredential.token, headers: hdr })), 200);
  // Disable Agent HTTP: derived JWT denied, ordinary participant JWT still fine.
  const ordinary = await w.login('alpha');
  w.bump('alpha', c => ({ sessionModeProfile: { ...c.sessionModeProfile, surfaces: { ...c.sessionModeProfile.surfaces, agentHttp: false } } }));
  assert.notEqual(await show('disabled jwt health', await w.request('/health', { token: workerCredential.token, headers: hdr })), 200);
  assert.equal(await show('disabled ordinary health', await w.request('/health', { token: ordinary, headers: hdr })), 200);
  w.bump('alpha', c => ({ sessionModeProfile: { ...c.sessionModeProfile, surfaces: { ...c.sessionModeProfile.surfaces, agentHttp: true } } }));
  assert.equal(await show('reenabled jwt health', await w.request('/health', { token: workerCredential.token, headers: hdr })), 200);
  // Epoch bump.
  w.bump('alpha', c => ({ authzEpoch: 2 }));
  assert.notEqual(await show('epoch jwt health', await w.request('/health', { token: workerCredential.token, headers: hdr })), 200);
  assert.notEqual(await show('epoch browser actions', await w.request('/api/agent/actions?sessionSlug=alpha', { token: agentCredential.token })), 200);
});

test('source rotation and revocation invalidate both derived credentials; member credential follows its participant source', async () => {
  const w = world({ sessions: { alpha: gated() } });
  const source = await w.credential('alpha');
  const ex = await (await w.request('/api/agent/client-login/exchange', { method: 'POST', body: { sessionSlug: 'alpha', token: source.token } })).json();
  await w.credential('alpha'); // rotates the same principal slot
  assert.notEqual(await show('rotated jwt health', await w.request('/health', { token: ex.workerCredential.token, headers: hdr })), 200);
  assert.notEqual(await show('rotated browser', await w.request('/api/agent/actions?sessionSlug=alpha', { token: ex.agentCredential.token })), 200);

  const proposed = await persistAgentProposedQuestion({ env: w.agentEnv('alpha'), sessionSlug: 'alpha', prompt: 'Readable source-revocation fixture', questionType: 'binary' });
  assert.equal(proposed.ok, true);
  await saveAgentOnlyModeConfig({ env: w.agentEnv('alpha'), sessionSlug: 'alpha', patch: { enabledQuestionIds: [proposed.questionId] } });
  // Member credential minted from an exchange-derived JWT dies with the agent source.
  const s2 = await w.credential('alpha', { principal: 'audit-agent-2' });
  const ex2 = await (await w.request('/api/agent/client-login/exchange', { method: 'POST', body: { sessionSlug: 'alpha', token: s2.token } })).json();
  const mem = await w.request('/api/agent/wrapped/member-exchange', { method: 'POST', token: ex2.workerCredential.token, body: { sessionSlug: 'alpha' } });
  assert.equal(await show('member from derived jwt', mem), 200);
  const memberToken = (await mem.json()).token;
  const before = await w.request('/api/agent/agent-only/statements?sessionSlug=alpha', { token: memberToken });
  assert.equal(before.status, 200, await before.clone().text());
  assert.equal((await before.json()).statements[0].text, 'Readable source-revocation fixture');
  await revokeAgentCredentialHash({ env: w.agentEnv('alpha'), tokenHash: s2.tokenHash });
  const after = await w.request('/api/agent/agent-only/statements?sessionSlug=alpha', { token: memberToken });
  assert.equal(after.status, 401);
  assert.equal((await after.json()).reason, 'agent_member_source_revoked');

  // Ordinary member credential follows gate loss and epoch.
  const jwt = await w.login('alpha');
  const m2 = await w.request('/api/agent/wrapped/member-exchange', { method: 'POST', token: jwt, body: { sessionSlug: 'alpha' } });
  assert.equal(await show('member from login', m2), 200);
  const m2Token = (await m2.json()).token;
  assert.equal((await w.request('/api/agent/agent-only/statements?sessionSlug=alpha', { token: m2Token })).status, 200);
  w.bump('alpha', c => ({ workerRoles: { participant: [] } }));
  const gateLost = await w.request('/api/agent/agent-only/statements?sessionSlug=alpha', { token: m2Token });
  assert.equal(gateLost.status, 403);
  assert.equal((await gateLost.json()).reason, 'agent_membership_denied');
});

test('service credentials need session_login; user credentials do not; wrong kinds are refused', async () => {
  const w = world({ sessions: { alpha: gated() } });
  const svc = await w.credential('alpha', { kind: 'service', principal: 'svc-1', scopes: ['read_questions'] });
  assert.equal(await show('svc no session_login', await w.request('/api/agent/client-login/exchange', { method: 'POST', body: { sessionSlug: 'alpha', token: svc.token } })), 403);
  const svc2 = await w.credential('alpha', { kind: 'service', principal: 'svc-2', scopes: ['read_questions', 'session_login'] });
  assert.equal(await show('svc with session_login', await w.request('/api/agent/client-login/exchange', { method: 'POST', body: { sessionSlug: 'alpha', token: svc2.token } })), 200);
  const ao = await w.credential('alpha', { kind: 'agent_only', principal: 'ao-1', scopes: ['agent_autofill'] });
  assert.equal(await show('agent_only exchange', await w.request('/api/agent/client-login/exchange', { method: 'POST', body: { sessionSlug: 'alpha', token: ao.token } })), 403);
  // Outsider account (fails login gate) cannot exchange even with a valid USER credential.
  const out = await w.credential('alpha', { principal: 'outsider', accountAddress: outsider.address });
  assert.notEqual(await show('outsider exchange', await w.request('/api/agent/client-login/exchange', { method: 'POST', body: { sessionSlug: 'alpha', token: out.token } })), 200);
});
