import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKER_CANONICAL_SET_CONFIG_KEYS,
  sessionConfigRequiresReauthorization as revokes,
} from '../../shared/sessionConfigEdits.mjs';
import { applySessionConfigMutation } from './sessionConfigMutation.js';

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

const workerCanonicalConfig = () => ({
  slug: 'session-a',
  sessionName: 'Session A',
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'custom',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: null },
    storage: {
      backend: 'cloudflare',
      payloadAccessControl: {
        gate: 'role_gate',
        encryption: 'worker_envelope',
        accessConditions: { match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] },
      },
    },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
    surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
    results: {
      visibility: 'participant_aggregate',
      exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 },
    },
    export: { scope: 'admin_raw' },
  },
  storageProfile: {
    backend: 'cloudflare',
    payloadAccessControl: {
      gate: 'role_gate',
      encryption: 'worker_envelope',
      accessConditions: { match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] },
    },
  },
});
const setConfig = incomingConfig => applySessionConfigMutation({
  existingConfig: workerCanonicalConfig(),
  mutation: { kind: 'set-config', incomingConfig },
  slug: 'session-a',
});
const unsupported = key => `Unsupported worker-canonical session config field: ${key}.`;

test('the shared set-config key list is exactly what a Worker-canonical session accepts', () => {
  assert.ok(Object.isFrozen(WORKER_CANONICAL_SET_CONFIG_KEYS));
  assert.equal(new Set(WORKER_CANONICAL_SET_CONFIG_KEYS).size, WORKER_CANONICAL_SET_CONFIG_KEYS.length);
  for (const key of WORKER_CANONICAL_SET_CONFIG_KEYS) {
    assert.notEqual(setConfig({ [key]: 'x' }).error, unsupported(key), key);
  }
  assert.equal(setConfig({ sessionName: 'Renamed' }).ok, true);
  // The /admin metadata editor sends these lists; the Worker refuses them.
  for (const key of ['HIGHLIGHTED_QUESTION_IDS', 'BLOCKED_QUESTION_IDS', 'HIGHLIGHTED_SURVEY_IDS',
    'BLOCKED_SURVEY_IDS', 'blockLimits', 'publicKey']) {
    assert.deepEqual(setConfig({ [key]: [] }), { ok: false, status: 400, error: unsupported(key) }, key);
  }
});
