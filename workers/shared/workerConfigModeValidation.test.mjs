import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateDeploymentModeValues,
  validateWorkerConfigModeValues,
} from './workerConfigModeValidation.mjs';

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const storageProfileFor = (profile) => {
  if (profile.storage.backend === 'arweave') {
    return {
      backend: profile.encryption.mode === 'lit' ? 'lit-arweave' : 'arweave',
    };
  }
  const access = profile.storage.payloadAccessControl;
  const accessConditions =
    profile.encryption.accessConditions ||
    access.accessConditions;
  return {
    backend: 'cloudflare',
    payloadAccessControl: {
      gate: profile.encryption.mode === 'lit' ? 'none' : access.gate,
      encryption: access.encryption,
      ...(accessConditions
        ? { accessConditions: cloneJson(accessConditions) }
        : {}),
    },
  };
};

const completeModeConfig = (sessionModeProfile) => ({
  sessionModeProfile,
  storageProfile: storageProfileFor(sessionModeProfile),
});

test('mode validation accepts canonical deploy and persisted config values', () => {
  const sessionModeProfile = fastCloudflareProfile();
  const value = {
    ...completeModeConfig(sessionModeProfile),
    storageProfile: {
      ...storageProfileFor(sessionModeProfile),
      cloudflare: { payloadAccessMode: 'worker_sbt_gate' },
    },
  };

  assert.deepEqual(validateDeploymentModeValues(value), { ok: true });
  assert.deepEqual(validateWorkerConfigModeValues(value), { ok: true });
});

test('mode validation rejects incomplete or ambiguous profile-bearing storage sources', () => {
  const profile = fastCloudflareProfile();
  const coherentStorage = storageProfileFor(profile);
  const cases = [
    [{ sessionModeProfile: profile }, 'storageProfile'],
    [{ sessionModeProfile: profile, storageProfile: 'cloudflare' }, 'storageProfile'],
    [{ sessionModeProfile: profile, storageBackend: 'cloudflare' }, 'storageProfile'],
    [
      {
        sessionModeProfile: profile,
        storageProfile: coherentStorage,
        storageBackend: cloneJson(coherentStorage),
      },
      'storageBackend',
    ],
    [
      {
        sessionModeProfile: profile,
        storageProfile: 'cloudflare',
        storageBackend: cloneJson(coherentStorage),
      },
      'storageBackend',
    ],
    [
      {
        sessionModeProfile: profile,
        storageProfile: {
          profile: 'cloudflare',
          payloadAccessControl: coherentStorage.payloadAccessControl,
        },
      },
      'storageProfile.backend',
    ],
    [
      {
        sessionModeProfile: profile,
        storageProfile: {
          backend: 'cloudflare',
          profile: 'arweave',
          payloadAccessControl: coherentStorage.payloadAccessControl,
        },
      },
      'storageProfile.profile',
    ],
  ];

  for (const [value, path] of cases) {
    assert.deepEqual(validateDeploymentModeValues(value), { ok: false, path });
  }

  assert.deepEqual(
    validateWorkerConfigModeValues({
      sessionModeProfile: profile,
      storageBackend: cloneJson(coherentStorage),
    }),
    { ok: false, path: 'storageBackend' },
  );
  assert.deepEqual(validateDeploymentModeValues({ storageBackend: 'cloudflare' }), { ok: true });
});

test('mode validation requires profile and storage backend compatibility in both directions', () => {
  const workerProfile = fullWorkerProfile();
  const registryProfile = decentralizedProfile();
  const mismatches = [
    {
      sessionModeProfile: workerProfile,
      storageProfile: { backend: 'arweave' },
    },
    {
      sessionModeProfile: workerProfile,
      storageProfile: { backend: 'lit-arweave' },
    },
    {
      sessionModeProfile: registryProfile,
      storageProfile: {
        backend: 'cloudflare',
        payloadAccessControl: { gate: 'none', encryption: 'none' },
      },
    },
  ];
  for (const value of mismatches) {
    assert.deepEqual(validateDeploymentModeValues(value), {
      ok: false,
      path: 'storageProfile.backend',
    });
    assert.deepEqual(validateWorkerConfigModeValues(value), {
      ok: false,
      path: 'storageProfile.backend',
    });
  }

  const registryLitProfile = decentralizedProfile();
  registryLitProfile.preset = 'custom';
  registryLitProfile.encryption.mode = 'lit';
  registryLitProfile.results.visibility = 'participant_aggregate';
  for (const backend of ['arweave', 'lit-arweave']) {
    const value = {
      sessionModeProfile: registryLitProfile,
      storageProfile: { backend },
    };
    assert.deepEqual(validateDeploymentModeValues(value), { ok: true });
    assert.deepEqual(validateWorkerConfigModeValues(value), { ok: true });
  }
});

test('mode validation compares the effective Lit gate emitted by the client compiler', () => {
  const profile = fastCloudflareProfile();
  profile.preset = 'custom';
  profile.evm.registryChainId = 11155420;
  profile.encryption = { mode: 'lit' };
  profile.storage.payloadAccessControl.encryption = 'lit';

  const compiled = completeModeConfig(profile);
  assert.equal(profile.storage.payloadAccessControl.gate, 'role_gate');
  assert.equal(compiled.storageProfile.payloadAccessControl.gate, 'none');
  assert.deepEqual(validateDeploymentModeValues(compiled), { ok: true });
  assert.deepEqual(validateWorkerConfigModeValues(compiled), { ok: true });

  const staleEmbeddedGate = {
    ...compiled,
    storageProfile: {
      ...compiled.storageProfile,
      payloadAccessControl: {
        ...compiled.storageProfile.payloadAccessControl,
        gate: profile.storage.payloadAccessControl.gate,
      },
    },
  };
  const expected = {
    ok: false,
    path: 'storageProfile.payloadAccessControl.gate',
  };
  assert.deepEqual(validateDeploymentModeValues(staleEmbeddedGate), expected);
  assert.deepEqual(validateWorkerConfigModeValues(staleEmbeddedGate), expected);
});

test('mode validation compares the canonical Cloudflare policy and access-condition document', () => {
  const profile = fullWorkerProfile();
  profile.storage.payloadAccessControl = {
    gate: 'role_gate',
    encryption: 'worker_envelope',
    accessConditions: {
      match: 'all',
      conditions: [{ kind: 'worker_role', role: 'admin' }],
    },
  };
  profile.encryption = { mode: 'worker_envelope', keyProvider: 'worker_secret' };
  profile.results.visibility = 'participant_aggregate';
  const coherent = completeModeConfig(profile);
  assert.deepEqual(validateDeploymentModeValues(coherent), { ok: true });
  assert.deepEqual(validateWorkerConfigModeValues(coherent), { ok: true });

  const cases = [
    [
      {
        ...coherent,
        storageProfile: {
          ...coherent.storageProfile,
          payloadAccessControl: {
            ...coherent.storageProfile.payloadAccessControl,
            gate: 'none',
          },
        },
      },
      'storageProfile.payloadAccessControl.gate',
    ],
    [
      {
        ...coherent,
        storageProfile: {
          ...coherent.storageProfile,
          payloadAccessControl: {
            ...coherent.storageProfile.payloadAccessControl,
            encryption: 'none',
          },
        },
      },
      'storageProfile.payloadAccessControl.encryption',
    ],
    [
      {
        ...coherent,
        storageProfile: {
          ...coherent.storageProfile,
          payloadAccessControl: {
            ...coherent.storageProfile.payloadAccessControl,
            accessConditions: {
              match: 'any',
              conditions: [{ kind: 'agent_grant_scope', scope: 'storage' }],
            },
          },
        },
      },
      'storageProfile.payloadAccessControl.accessConditions',
    ],
    [
      {
        ...coherent,
        storageProfile: {
          ...coherent.storageProfile,
          payloadAccessControl: {
            ...coherent.storageProfile.payloadAccessControl,
            conditions: coherent.storageProfile.payloadAccessControl.accessConditions,
          },
        },
      },
      'storageProfile.payloadAccessControl.conditions',
    ],
    [
      {
        ...coherent,
        storageProfile: {
          ...coherent.storageProfile,
          cloudflare: {
            accessConditions: coherent.storageProfile.payloadAccessControl.accessConditions,
          },
        },
      },
      'storageProfile.cloudflare.accessConditions',
    ],
  ];
  for (const [value, path] of cases) {
    assert.deepEqual(validateDeploymentModeValues(value), { ok: false, path });
    assert.deepEqual(validateWorkerConfigModeValues(value), { ok: false, path });
  }
});

test('mode validation gives encryption access conditions the same precedence as the client compiler', () => {
  const profile = fastCloudflareProfile();
  profile.preset = 'custom';
  profile.encryption.accessConditions = {
    match: 'all',
    conditions: [{ kind: 'worker_role', role: 'reviewer' }],
  };

  const compiled = completeModeConfig(profile);
  assert.deepEqual(
    compiled.storageProfile.payloadAccessControl.accessConditions,
    profile.encryption.accessConditions,
  );
  assert.notDeepEqual(
    compiled.storageProfile.payloadAccessControl.accessConditions,
    profile.storage.payloadAccessControl.accessConditions,
  );
  assert.deepEqual(validateDeploymentModeValues(compiled), { ok: true });
  assert.deepEqual(validateWorkerConfigModeValues(compiled), { ok: true });

  const staleStorageDefault = {
    ...compiled,
    storageProfile: {
      ...compiled.storageProfile,
      payloadAccessControl: {
        ...compiled.storageProfile.payloadAccessControl,
        accessConditions: cloneJson(profile.storage.payloadAccessControl.accessConditions),
      },
    },
  };
  const expected = {
    ok: false,
    path: 'storageProfile.payloadAccessControl.accessConditions',
  };
  assert.deepEqual(validateDeploymentModeValues(staleStorageDefault), expected);
  assert.deepEqual(validateWorkerConfigModeValues(staleStorageDefault), expected);
});

test('profile-bearing Cloudflare storage requires fully explicit gate and encryption', () => {
  const profile = fullWorkerProfile();
  const cases = [
    [
      { backend: 'cloudflare', payloadAccessControl: { mode: 'public_read' } },
      'storageProfile.payloadAccessControl.gate',
    ],
    [
      {
        backend: 'cloudflare',
        payloadAccessControl: { mode: 'lit_encrypted', gate: 'none' },
      },
      'storageProfile.payloadAccessControl.encryption',
    ],
    [
      {
        backend: 'cloudflare',
        payloadAccessControl: { mode: 'lit_encrypted', encryption: 'lit' },
      },
      'storageProfile.payloadAccessControl.gate',
    ],
  ];
  for (const [storageProfile, path] of cases) {
    const value = { sessionModeProfile: profile, storageProfile };
    assert.deepEqual(validateDeploymentModeValues(value), { ok: false, path });
    assert.deepEqual(validateWorkerConfigModeValues(value), { ok: false, path });
  }

  const explicitWithIgnoredLegacyMode = {
    sessionModeProfile: profile,
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: {
        mode: 'lit_encrypted',
        gate: 'none',
        encryption: 'none',
      },
    },
  };
  assert.deepEqual(validateDeploymentModeValues(explicitWithIgnoredLegacyMode), { ok: true });
  assert.deepEqual(validateWorkerConfigModeValues(explicitWithIgnoredLegacyMode), { ok: true });

  const profilelessModeOnly = {
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'lit_encrypted' },
    },
  };
  assert.deepEqual(validateDeploymentModeValues(profilelessModeOnly), { ok: true });
  assert.deepEqual(validateWorkerConfigModeValues(profilelessModeOnly), { ok: true });
});

test('public stored results require unencrypted, condition-free public storage', () => {
  const gated = fullWorkerProfile();
  gated.storage.payloadAccessControl.gate = 'role_gate';

  const encrypted = fullWorkerProfile();
  encrypted.storage.payloadAccessControl.encryption = 'worker_envelope';
  encrypted.encryption = { mode: 'worker_envelope', keyProvider: 'worker_secret' };

  const conditioned = fullWorkerProfile();
  conditioned.storage.payloadAccessControl.accessConditions = {
    match: 'any',
    conditions: [{ kind: 'worker_role', role: 'admin' }],
  };

  for (const sessionModeProfile of [gated, encrypted, conditioned]) {
    const expected = {
      ok: false,
      path: 'sessionModeProfile.results.visibility',
    };
    assert.deepEqual(validateDeploymentModeValues({ sessionModeProfile }), expected);
    assert.deepEqual(validateWorkerConfigModeValues({ sessionModeProfile }), expected);
  }

  const publicRead = fullWorkerProfile();
  const value = completeModeConfig(publicRead);
  assert.deepEqual(validateDeploymentModeValues(value), { ok: true });
  assert.deepEqual(validateWorkerConfigModeValues(value), { ok: true });
});

test('mode validation rejects explicit aliases, blanks, and reserved providers at their exact paths', () => {
  const cases = [
    [{ sessionModeProfile: { authority: { mode: 'registry' } } }, 'sessionModeProfile.authority.mode'],
    [{ sessionModeProfile: { authority: {} } }, 'sessionModeProfile.authority.mode'],
    [{ sessionModeProfile: { encryption: { mode: '' } } }, 'sessionModeProfile.encryption.mode'],
    [
      { sessionModeProfile: { encryption: { mode: 'worker_envelope', keyProvider: 'external_kms' } } },
      'sessionModeProfile.encryption.keyProvider',
    ],
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
  assert.deepEqual(
    validateWorkerConfigModeValues({ sessionModeProfile: null }),
    { ok: false, path: 'sessionModeProfile' },
  );
  assert.deepEqual(
    validateDeploymentModeValues({ storageProfile: { backend: 'cloudflare', payloadAccessControl: [] } }),
    { ok: false, path: 'storageProfile.payloadAccessControl' },
  );
});

test('mode validation accepts complete reachable v1 profiles and rejects schema-only authority', () => {
  for (const sessionModeProfile of [fastCloudflareProfile(), decentralizedProfile(), fullWorkerProfile()]) {
    const value = completeModeConfig(sessionModeProfile);
    assert.deepEqual(validateDeploymentModeValues(value), { ok: true });
    assert.deepEqual(validateWorkerConfigModeValues(value), { ok: true });
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
    profile.results.visibility = 'participant_aggregate';
    return profile;
  };

  for (const condition of [
    { kind: 'worker_role', role: 'r'.repeat(128) },
    { kind: 'agent_grant_scope', scope: 's'.repeat(128) },
  ]) {
    const sessionModeProfile = withCondition(condition);
    const value = completeModeConfig(sessionModeProfile);
    assert.deepEqual(validateDeploymentModeValues(value), { ok: true });
    assert.deepEqual(validateWorkerConfigModeValues(value), { ok: true });
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
