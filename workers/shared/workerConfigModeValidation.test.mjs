import test from 'node:test';
import assert from 'node:assert/strict';

import { validateDeploymentModeValues, validateWorkerConfigModeValues } from './workerConfigModeValidation.mjs';

const fastCloudflareProfile = () => ({
  profileVersion: 1,
  preset: 'fast_cheap_cloudflare',
  authority: { mode: 'worker_canonical' },
  evm: { registryChainId: null },
  storage: {
    backend: 'cloudflare',
    payloadAccessControl: {
      gate: 'role_gate',
      encryption: 'worker_envelope',
      accessConditions: {
        match: 'any',
        conditions: [
          { kind: 'worker_role', role: 'admin' },
          { kind: 'agent_grant_scope', scope: 'storage' },
        ],
      },
    },
  },
  identity: { default: 'passkey', enabled: ['passkey'] },
  authorization: { mechanisms: ['worker_roles'] },
  encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
  surfaces: {
    web: true,
    telegram: false,
    miniApp: false,
    agentHttp: false,
    mcp: false,
    ceCc: false,
  },
  results: {
    visibility: 'participant_aggregate',
    exposure: {
      aggregateResultsEnabled: true,
      anonymizedGroupsEnabled: false,
      minGroupSize: 2,
    },
  },
  export: { scope: 'admin_raw' },
});

const decentralizedProfile = () => ({
  profileVersion: 1,
  preset: 'trustless_public_decentralized',
  authority: { mode: 'evm_registry_canonical' },
  evm: { registryChainId: 11155420 },
  storage: { backend: 'arweave' },
  identity: { default: 'wallet', enabled: ['wallet', 'passkey'] },
  authorization: { mechanisms: ['sbt_onchain'] },
  encryption: { mode: 'none' },
  surfaces: {
    web: true,
    telegram: false,
    miniApp: false,
    agentHttp: false,
    mcp: false,
    ceCc: false,
  },
  results: {
    visibility: 'public_full_if_storage_public',
    exposure: {
      aggregateResultsEnabled: true,
      anonymizedGroupsEnabled: false,
      minGroupSize: 2,
    },
  },
  export: { scope: 'all_session' },
});

const fullWorkerProfile = () => ({
  profileVersion: 1,
  preset: 'custom',
  authority: { mode: 'worker_canonical' },
  evm: { registryChainId: null },
  storage: {
    backend: 'cloudflare',
    payloadAccessControl: { gate: 'none', encryption: 'none' },
  },
  identity: { default: 'passkey', enabled: ['passkey'] },
  authorization: { mechanisms: ['worker_roles'] },
  encryption: { mode: 'none' },
  surfaces: {
    web: true,
    telegram: false,
    miniApp: false,
    agentHttp: false,
    mcp: false,
    ceCc: false,
  },
  results: {
    visibility: 'public_full_if_storage_public',
    exposure: {
      aggregateResultsEnabled: true,
      anonymizedGroupsEnabled: false,
      minGroupSize: 2,
    },
  },
  export: { scope: 'all_session' },
});

test('mode validation accepts canonical deploy and persisted config values', () => {
  const value = {
    sessionModeProfile: fastCloudflareProfile(),
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'role_gate', encryption: 'worker_envelope' },
      cloudflare: { payloadAccessMode: 'worker_sbt_gate' },
    },
  };

  assert.deepEqual(validateDeploymentModeValues(value), { ok: true });
  assert.deepEqual(validateWorkerConfigModeValues(value), { ok: true });
});

test('mode validation rejects explicit aliases, blanks, and reserved providers at their exact paths', () => {
  const invalidAuthority = fullWorkerProfile();
  invalidAuthority.authority.mode = 'registry';
  const missingAuthorityMode = fullWorkerProfile();
  missingAuthorityMode.authority = {};
  const blankEncryptionMode = fullWorkerProfile();
  blankEncryptionMode.encryption.mode = '';
  const reservedKeyProvider = fullWorkerProfile();
  reservedKeyProvider.encryption = { mode: 'worker_envelope', keyProvider: 'external_kms' };

  const cases = [
    [{ sessionModeProfile: invalidAuthority }, 'sessionModeProfile.authority.mode'],
    [{ sessionModeProfile: missingAuthorityMode }, 'sessionModeProfile.authority.mode'],
    [{ sessionModeProfile: blankEncryptionMode }, 'sessionModeProfile.encryption.mode'],
    [{ sessionModeProfile: reservedKeyProvider }, 'sessionModeProfile.encryption.keyProvider'],
    [{ storageProfile: {} }, 'storageProfile.backend'],
    [{ storageProfile: { backend: 'r2' } }, 'storageProfile.backend'],
    [
      { storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'public' } } },
      'storageProfile.payloadAccessControl.gate',
    ],
    [
      { storageProfile: { backend: 'cloudflare', payloadAccessControl: { encryption: 'plaintext' } } },
      'storageProfile.payloadAccessControl.encryption',
    ],
    [
      { storageProfile: { backend: 'cloudflare', payloadAccessControl: { mode: 'public-read' } } },
      'storageProfile.payloadAccessControl.mode',
    ],
  ];

  for (const [value, path] of cases) {
    assert.deepEqual(validateDeploymentModeValues(value), { ok: false, path });
    assert.deepEqual(validateWorkerConfigModeValues(value), { ok: false, path });
  }
});

test('mode validation permits absent optional mode fields but rejects malformed explicit containers', () => {
  assert.deepEqual(validateWorkerConfigModeValues({ sessionName: 'No mode patch' }), { ok: true });
  const malformedProfiles = [
    [{}, 'sessionModeProfile.profileVersion'],
    [null, 'sessionModeProfile'],
    [[], 'sessionModeProfile'],
  ];
  for (const [sessionModeProfile, path] of malformedProfiles) {
    assert.deepEqual(validateDeploymentModeValues({ sessionModeProfile }), { ok: false, path });
    assert.deepEqual(validateWorkerConfigModeValues({ sessionModeProfile }), { ok: false, path });
  }
  assert.deepEqual(
    validateDeploymentModeValues({ storageProfile: { backend: 'cloudflare', payloadAccessControl: [] } }),
    { ok: false, path: 'storageProfile.payloadAccessControl' },
  );
});

test('mode validation accepts complete reachable v1 profiles and rejects schema-only authority', () => {
  for (const sessionModeProfile of [fastCloudflareProfile(), decentralizedProfile(), fullWorkerProfile()]) {
    assert.deepEqual(validateDeploymentModeValues({ sessionModeProfile }), { ok: true });
    assert.deepEqual(validateWorkerConfigModeValues({ sessionModeProfile }), { ok: true });
  }

  const schemaOnly = fullWorkerProfile();
  schemaOnly.authority.mode = 'worker_with_public_anchor';
  schemaOnly.evm.registryChainId = 11155420;
  assert.deepEqual(validateDeploymentModeValues({ sessionModeProfile: schemaOnly }), {
    ok: false,
    path: 'sessionModeProfile.authority.mode',
  });
  assert.deepEqual(validateWorkerConfigModeValues({ sessionModeProfile: schemaOnly }), {
    ok: false,
    path: 'sessionModeProfile.authority.mode',
  });
});

test('mode validation rejects semantically valid mutations of named presets', () => {
  const mutatedFast = fastCloudflareProfile();
  mutatedFast.export.scope = 'all_session';
  const mutatedDecentralized = decentralizedProfile();
  mutatedDecentralized.results.visibility = 'participant_aggregate';

  for (const sessionModeProfile of [mutatedFast, mutatedDecentralized]) {
    assert.deepEqual(validateDeploymentModeValues({ sessionModeProfile }), {
      ok: false,
      path: 'sessionModeProfile.preset',
    });
    assert.deepEqual(validateWorkerConfigModeValues({ sessionModeProfile }), {
      ok: false,
      path: 'sessionModeProfile.preset',
    });
  }
});

test('mode validation matches the client 128-character role and grant-scope limit', () => {
  const withCondition = (condition) => {
    const profile = fullWorkerProfile();
    profile.storage.payloadAccessControl.encryption = 'worker_envelope';
    profile.encryption = {
      mode: 'worker_envelope',
      keyProvider: 'worker_secret',
      accessConditions: { match: 'any', conditions: [condition] },
    };
    return profile;
  };

  for (const condition of [
    { kind: 'worker_role', role: 'r'.repeat(128) },
    { kind: 'agent_grant_scope', scope: 's'.repeat(128) },
  ]) {
    const sessionModeProfile = withCondition(condition);
    assert.deepEqual(validateDeploymentModeValues({ sessionModeProfile }), { ok: true });
    assert.deepEqual(validateWorkerConfigModeValues({ sessionModeProfile }), { ok: true });
  }

  for (const [condition, suffix] of [
    [{ kind: 'worker_role', role: 'r'.repeat(129) }, 'role'],
    [{ kind: 'agent_grant_scope', scope: 's'.repeat(129) }, 'scope'],
  ]) {
    const sessionModeProfile = withCondition(condition);
    const expected = {
      ok: false,
      path: `sessionModeProfile.encryption.accessConditions.conditions.0.${suffix}`,
    };
    assert.deepEqual(validateDeploymentModeValues({ sessionModeProfile }), expected);
    assert.deepEqual(validateWorkerConfigModeValues({ sessionModeProfile }), expected);
  }
});

test('mode validation rejects malformed raw v1 access rules at their exact path', () => {
  const profile = fullWorkerProfile();
  profile.encryption = {
    mode: 'worker_envelope',
    keyProvider: 'worker_secret',
    accessConditions: {
      match: 'any',
      conditions: [{ kind: 'worker_role', role: '   ' }],
    },
  };
  profile.storage.payloadAccessControl.encryption = 'worker_envelope';

  assert.deepEqual(validateWorkerConfigModeValues({ sessionModeProfile: profile }), {
    ok: false,
    path: 'sessionModeProfile.encryption.accessConditions.conditions.0.role',
  });
});
