import test from 'node:test';
import assert from 'node:assert/strict';
import { world, baseConfig, admin, outsider } from './agentSecurityFixture.mjs';
import { callSessionConfigCoordinator, readCurrentSessionConfig } from './sessionConfigAuthority.js';

const SESSION_ID = `0x${'a1'.repeat(16)}`;
const invite = { tokenHash: 'a'.repeat(64), enabled: true, label: 'Fixture invite' };
const config = () => {
  const value = baseConfig('alpha', SESSION_ID, { agentHttp: { invites: [invite] } });
  value.sessionModeProfile.surfaces.mcp = false;
  value.workerGroupsBootstrap = { version: 2, state: 'fresh_empty', bootstrapId: 'c'.repeat(64) };
  return value;
};
const contentEdits = [
  ['session name', { sessionName: 'Renamed session' }],
  ['session info', { sessionInfo: 'Updated description' }],
  ['session context', { sessionContext: 'Updated background' }],
  ['question generation prompt', { questionsGenPrompt: 'Ask about shared priorities.' }],
  ['opening prompt', { interviewMode: { openingPrompt: 'Begin with a local question.' } }],
  ['steering prompt', { interviewMode: { steeringPrompt: 'Follow the participant priorities.' } }],
  ['appearance', { appearance: { colorSchemeId: 'ocean' } }],
  ['header image', { sessionHeaderImg: 'https://images.example.test/header.png' }],
  ['additional invite', { agentHttp: { invites: [invite, { tokenHash: 'b'.repeat(64), enabled: true }] } }],
];
const authorityEdits = [
  ['admin', { adminAddress: outsider.address }],
  ['additional admins', { adminAddresses: [outsider.address] }],
  ['surfaces', { sessionModeProfile: { ...config().sessionModeProfile, surfaces: { ...config().sessionModeProfile.surfaces, telegram: true } } }],
  ['login gate', { workerAuthority: { ...config().workerAuthority, loginGate: { conditions: [{ kind: 'worker_role', role: 'participant' }] } } }],
  ['groups', { groupCreationPolicy: 'participants' }],
  ['roles', { workerRoles: { participant: [outsider.address] } }],
  ['results visibility', { sessionModeProfile: { ...config().sessionModeProfile, results: { ...config().sessionModeProfile.results, visibility: 'participant_aggregate' } } }],
  ['results exposure', { resultsExposure: { aggregateResultsEnabled: false } }],
  ['origins', { allowOrigins: ['https://changed.example.test'] }],
  ['field encryption', { responseFieldEncryption: { mode: 'optional' } }],
  ['removed invites', { agentHttp: { invites: [] } }],
  ['disabled invite', { agentHttp: { invites: [{ ...invite, enabled: false }] } }],
  ['Wrapped permissions', { agentHttp: { wrapped: { posterEnabled: true } } }],
  ['submit permissions', { agentHttp: { managedAccountSubmitAllowed: true } }],
  ['interview enablement', { interviewMode: { enabled: true } }],
  ['AI settings', { ai: { provider: 'openai' } }],
  ['limits', { limits: { ai: { daily: 20 } } }],
  ['scopes', { scopes: { ai: false } }],
  ['mixed content and authority', { sessionName: 'Renamed', agentHttp: { asyncSubmitEnabled: true } }],
];

for (const [name, patch, revokes] of [
  ...contentEdits.map(([name, patch]) => [name, patch, false]),
  ...authorityEdits.map(([name, patch]) => [name, patch, true]),
]) test(`${name} edits ${revokes ? 'revoke' : 'preserve'} existing web and agent authorization`, async () => {
  const w = world({ sessions: { alpha: config() }, overrides: { readCurrentSessionConfig } });
  const jwt = await w.login('alpha');
  const agent = await w.credential('alpha');
  const before = await readCurrentSessionConfig({ env: w.env, slug: 'alpha' });
  const jwtStatus = async () => {
    const response = await w.request('/storage/list?type=questions', { token: jwt, headers: { 'x-session-slug': 'alpha' } });
    if (response.status !== 200 && response.status !== 401 && response.status !== 403) throw new Error(await response.text());
    return response.status;
  };
  const agentStatus = async () => (await w.request('/api/agent/actions?sessionSlug=alpha', { token: agent.token })).status;
  assert.equal(await jwtStatus(), 200);
  assert.equal(await agentStatus(), 200);
  const mutation = await callSessionConfigCoordinator({ env: w.env, slug: 'alpha', path: 'mutate',
    expectedAuthority: { actor: admin.address.toLowerCase(), revision: before.revision, authzEpoch: before.config.authzEpoch },
    mutation: { kind: 'set-config', incomingConfig: patch } });
  assert.equal(mutation.ok, true, JSON.stringify(mutation));
  const after = await readCurrentSessionConfig({ env: w.env, slug: 'alpha' });
  w.configs.set('alpha', after.config);
  w.revisions.set('alpha', after.revision);
  assert.equal(after.revision, before.revision + 1, 'every effective edit advances the config revision');
  assert.equal(after.config.authzEpoch, before.config.authzEpoch + (revokes ? 1 : 0));
  if (revokes) {
    assert.notEqual(await jwtStatus(), 200);
    assert.notEqual(await agentStatus(), 200);
  } else {
    assert.equal(await jwtStatus(), 200);
    assert.equal(await agentStatus(), 200);
  }
  assert.deepEqual(w.external, []);
});
