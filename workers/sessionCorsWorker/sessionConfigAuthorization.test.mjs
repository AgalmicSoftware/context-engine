import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionConfigRequiresReauthorization as revokes } from './sessionConfigAuthorization.js';

const invite = { tokenHash: 'a'.repeat(64), enabled: true };
const second = { tokenHash: 'b'.repeat(64), enabled: true };
const withInvites = invites => ({ agentHttp: { invites } });

test('additive invite changes preserve all previous invite records without ambiguity', () => {
  assert.equal(revokes({}, withInvites([invite])), false);
  assert.equal(revokes(withInvites([invite]), withInvites([second, invite])), false);
  assert.equal(revokes(withInvites([invite, second]), withInvites([second, invite])), false);
  for (const next of [[], [{ ...invite, enabled: false }], [{ ...invite, label: 'Changed' }],
    [invite, { ...invite, enabled: false }], [second]]) {
    assert.equal(revokes(withInvites([invite]), withInvites(next)), true);
  }
  assert.equal(revokes(withInvites([{ ...invite, enabled: false }]), withInvites([invite])), true);
});

test('only prompt text is content within interview settings', () => {
  const before = { interviewMode: { enabled: true, openingPrompt: 'Earlier', steeringPrompt: 'Earlier' } };
  assert.equal(revokes(before, { interviewMode: { ...before.interviewMode, openingPrompt: 'Updated', steeringPrompt: '' } }), false);
  assert.equal(revokes(before, { interviewMode: { openingPrompt: 'Updated' } }), true);
  assert.equal(revokes(before, { interviewMode: { ...before.interviewMode, hiddenDraftShare: 0.5 } }), true);
  assert.equal(revokes(before, { interviewMode: { ...before.interviewMode, futureSetting: 'unknown' } }), true);
});

for (const field of ['slug', 'sessionId', 'sessionIdHex', 'configRevision', 'adminAddress', 'adminAddresses',
  'corsWorkerUrl', 'allowOrigins', 'sessionModeProfile', 'workerAuthority', 'workerRoles', 'roles', 'authorization',
  'groupCreationPolicy', 'linkedWorkerGroups', 'workerGroupsBootstrap', 'resultsExposure', 'storageProfile',
  'storageEnvelope', 'responseFieldEncryption', 'agentSessionWrapped', 'scopes', 'limits', 'litCredentials',
  'sessionEndsAt', 'defaultTags', 'defaultGroupTags', 'defaultSbtTags', 'interviewModeEnabled', 'pileAutoAdvanceEnabled',
  'defaultFilterState', 'defaultFeaturedSBTs', 'autoFeatureSBTsBySessionSlug', 'ai', 'networkChainId', 'contracts',
  'embeddedDeployHelperEnabled', 'resultsAnalysis', 'futureUnclassifiedSetting']) {
  test(`${field} remains authority-sensitive even alongside a content edit`, () => {
    const before = { [field]: { value: 'earlier' } };
    const after = { [field]: { value: 'changed' }, sessionName: 'Updated title' };
    assert.equal(revokes(before, after), true);
    assert.equal(revokes(before, { sessionName: 'Updated title' }), true);
  });
}
