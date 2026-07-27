import test from 'node:test';
import assert from 'node:assert/strict';

import { applySessionConfigMutation } from './sessionConfigMutation.js';

const baseConfig = {
  slug: 'session-a',
  sessionName: 'Session A',
  scopes: { ai: true, groups: true },
};
const workerGroupsBootstrap = {
  version: 2,
  state: 'fresh_empty',
  bootstrapId: 'a'.repeat(64),
};
const cloneJson = (value) => JSON.parse(JSON.stringify(value));
const workerModeProfile = {
  profileVersion: 1,
  preset: 'custom',
  authority: { mode: 'worker_canonical' },
  evm: { registryChainId: null },
  storage: {
    backend: 'cloudflare',
    payloadAccessControl: {
      gate: 'role_gate',
      encryption: 'worker_envelope',
      accessConditions: {
        match: 'all',
        conditions: [{ kind: 'worker_role', role: 'admin' }],
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
};
const canonicalWorkerStorageProfile = {
  backend: 'cloudflare',
  payloadAccessControl: {
    gate: 'role_gate',
    encryption: 'worker_envelope',
    accessConditions: {
      match: 'all',
      conditions: [{ kind: 'worker_role', role: 'admin' }],
    },
  },
};
const profileBearingConfig = {
  ...baseConfig,
  sessionModeProfile: workerModeProfile,
  storageProfile: canonicalWorkerStorageProfile,
};

test('set-config creates and increments the server-managed authorization epoch', () => {
  const initialized = applySessionConfigMutation({
    existingConfig: {},
    mutation: { kind: 'set-config', incomingConfig: baseConfig },
    slug: 'session-a',
  });
  assert.equal(initialized.ok, true);
  assert.equal(initialized.config.authzEpoch, 1);

  const changed = applySessionConfigMutation({
    existingConfig: initialized.config,
    mutation: { kind: 'set-config', incomingConfig: { scopes: { ai: false } } },
    slug: 'session-a',
  });
  assert.equal(changed.ok, true);
  assert.equal(changed.config.authzEpoch, 2);
  assert.equal(changed.config.scopes.ai, false);
});

test('set-config does not increment the authorization epoch for an idempotent replay', () => {
  const existingConfig = { ...baseConfig, authzEpoch: 4 };
  const result = applySessionConfigMutation({
    existingConfig,
    mutation: { kind: 'set-config', incomingConfig: baseConfig },
    slug: 'session-a',
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.authzEpoch, 4);
});

test('set-config rejects caller-controlled authorization epochs', () => {
  const result = applySessionConfigMutation({
    existingConfig: baseConfig,
    mutation: { kind: 'set-config', incomingConfig: { authzEpoch: 99 } },
    slug: 'session-a',
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: 'Authorization epoch is server-managed.',
  });
});

test('set-config persists only exact group creation policies', () => {
  for (const groupCreationPolicy of ['admin_only', 'participants']) {
    const result = applySessionConfigMutation({
      existingConfig: baseConfig,
      mutation: { kind: 'set-config', incomingConfig: { groupCreationPolicy } },
      slug: 'session-a',
    });
    assert.equal(result.ok, true);
    assert.equal(result.config.groupCreationPolicy, groupCreationPolicy);
  }

  for (const groupCreationPolicy of ['everyone', 'Participants', ' participants ', true]) {
    const invalid = applySessionConfigMutation({
      existingConfig: baseConfig,
      mutation: { kind: 'set-config', incomingConfig: { groupCreationPolicy } },
      slug: 'session-a',
    });
    assert.deepEqual(invalid, {
      ok: false,
      status: 400,
      error: 'Invalid group creation policy.',
    });
  }
});

test('set-config validates profile patches against the complete canonical storage record', () => {
  const existingConfig = {
    ...cloneJson(profileBearingConfig),
    authzEpoch: 4,
  };
  const profileOnlyPatch = applySessionConfigMutation({
    existingConfig,
    mutation: {
      kind: 'set-config',
      incomingConfig: {
        sessionModeProfile: cloneJson(workerModeProfile),
        sessionName: 'Renamed Session',
      },
    },
    slug: 'session-a',
  });
  assert.equal(profileOnlyPatch.ok, true);
  assert.equal(profileOnlyPatch.config.sessionName, 'Renamed Session');
  assert.deepEqual(profileOnlyPatch.config.storageProfile, canonicalWorkerStorageProfile);

  const initializingWithoutStorage = applySessionConfigMutation({
    existingConfig: {},
    mutation: {
      kind: 'set-config',
      incomingConfig: { sessionModeProfile: cloneJson(workerModeProfile) },
    },
    slug: 'session-a',
  });
  assert.deepEqual(initializingWithoutStorage, {
    ok: false,
    status: 400,
    error: 'Invalid session config mode at storageProfile.',
  });
});

test('set-config rejects merged backend aliases and access-condition divergence', () => {
  const existingConfig = {
    ...cloneJson(profileBearingConfig),
    authzEpoch: 4,
  };
  const cases = [
    {
      name: 'condition mismatch',
      incomingConfig: {
        storageProfile: {
          ...cloneJson(canonicalWorkerStorageProfile),
          payloadAccessControl: {
            ...cloneJson(canonicalWorkerStorageProfile.payloadAccessControl),
            accessConditions: {
              match: 'any',
              conditions: [{ kind: 'agent_grant_scope', scope: 'storage' }],
            },
          },
        },
      },
      path: 'storageProfile.payloadAccessControl.accessConditions',
    },
    {
      name: 'backend mismatch',
      incomingConfig: {
        storageProfile: { backend: 'arweave' },
      },
      path: 'storageProfile.backend',
    },
    {
      name: 'second storage source',
      incomingConfig: {
        storageBackend: cloneJson(canonicalWorkerStorageProfile),
      },
      path: 'storageBackend',
    },
  ];

  for (const testCase of cases) {
    const result = applySessionConfigMutation({
      existingConfig,
      mutation: {
        kind: 'set-config',
        incomingConfig: testCase.incomingConfig,
      },
      slug: 'session-a',
    });
    assert.deepEqual(result, {
      ok: false,
      status: 400,
      error: `Invalid session config mode at ${testCase.path}.`,
    }, testCase.name);
  }
});

test('set-config preserves an identical server-managed Worker Group bootstrap marker', () => {
  const existingConfig = {
    ...baseConfig,
    authzEpoch: 3,
    workerGroupsBootstrap,
  };
  const result = applySessionConfigMutation({
    existingConfig,
    mutation: {
      kind: 'set-config',
      incomingConfig: {
        sessionName: 'Renamed Session',
        workerGroupsBootstrap: { ...workerGroupsBootstrap },
      },
    },
    slug: 'session-a',
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.authzEpoch, 4);
  assert.equal(result.config.sessionName, 'Renamed Session');
  assert.deepEqual(result.config.workerGroupsBootstrap, workerGroupsBootstrap);
});

test('set-config rejects adding, changing, or deleting Worker Group bootstrap state', () => {
  const cases = [
    {
      name: 'add',
      existingConfig: baseConfig,
      incomingValue: workerGroupsBootstrap,
    },
    {
      name: 'change',
      existingConfig: { ...baseConfig, workerGroupsBootstrap },
      incomingValue: { ...workerGroupsBootstrap, bootstrapId: 'deployment-b' },
    },
    {
      name: 'delete',
      existingConfig: { ...baseConfig, workerGroupsBootstrap },
      incomingValue: null,
    },
  ];

  for (const testCase of cases) {
    const result = applySessionConfigMutation({
      existingConfig: testCase.existingConfig,
      mutation: {
        kind: 'set-config',
        incomingConfig: { workerGroupsBootstrap: testCase.incomingValue },
      },
      slug: 'session-a',
    });

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      error: 'Worker Group bootstrap state is server-managed.',
    }, testCase.name);
  }
});

test('non-authorization config mutation preserves the current epoch', () => {
  const result = applySessionConfigMutation({
    existingConfig: { ...baseConfig, authzEpoch: 6, limits: { perWalletPerDay: 2 } },
    mutation: { kind: 'set-limits', incomingLimits: { perWalletPerDay: 3 } },
    slug: 'session-a',
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.authzEpoch, 6);
  assert.equal(result.config.limits.perWalletPerDay, 3);
});
