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
const registryModeProfile = {
  ...cloneJson(workerModeProfile),
  authority: { mode: 'evm_registry_canonical' },
  evm: { registryChainId: 11155420 },
  storage: { backend: 'arweave' },
  identity: { default: 'wallet', enabled: ['wallet', 'passkey'] },
  authorization: { mechanisms: ['sbt_onchain'] },
  encryption: { mode: 'none' },
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

test('set-config rejects wildcard CORS origins that runtime routing cannot honor', () => {
  for (const allowOrigins of [['*'], ['https://*.example.test']]) {
    const result = applySessionConfigMutation({
      existingConfig: {},
      mutation: { kind: 'set-config', incomingConfig: { ...baseConfig, allowOrigins } },
      slug: 'session-a',
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.match(result.error, /exact origins/i);
  }
});

test('set-config preserves an initialized registry session identity', () => {
  const sessionId = '0x11111111111111111111111111111111';
  const existingConfig = {
    ...baseConfig,
    sessionId,
    sessionModeProfile: registryModeProfile,
    storageProfile: { backend: 'arweave' },
  };
  const replay = applySessionConfigMutation({
    existingConfig,
    mutation: { kind: 'set-config', incomingConfig: { sessionIdHex: sessionId } },
    slug: 'session-a',
  });
  const replacement = applySessionConfigMutation({
    existingConfig,
    mutation: {
      kind: 'set-config',
      incomingConfig: { sessionId: '0x22222222222222222222222222222222' },
    },
    slug: 'session-a',
  });
  const { sessionId: _legacySessionId, ...legacyConfig } = existingConfig;
  const legacyInitialization = applySessionConfigMutation({
    existingConfig: legacyConfig,
    mutation: { kind: 'set-config', incomingConfig: { sessionId } },
    slug: 'session-a',
  });

  assert.equal(replay.ok, true);
  assert.deepEqual(replacement, {
    ok: false,
    status: 409,
    error: 'Registry-canonical session identity cannot be changed after initialization.',
  });
  assert.equal(legacyInitialization.ok, true);
  assert.equal(legacyInitialization.config.sessionId, sessionId);
});

test('set-config preserves legacy registry identity during authority-mode migration', () => {
  const sessionId = '0x11111111111111111111111111111111';
  const existingConfig = {
    ...baseConfig,
    sessionId,
    sessionModeProfile: {
      ...registryModeProfile,
      authority: { mode: 'registry_canonical' },
    },
    storageProfile: { backend: 'arweave' },
  };
  const result = applySessionConfigMutation({
    existingConfig,
    mutation: {
      kind: 'set-config',
      incomingConfig: {
        sessionId: '0x22222222222222222222222222222222',
        sessionModeProfile: registryModeProfile,
      },
    },
    slug: 'session-a',
  });

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: 'Registry-canonical session identity cannot be changed after initialization.',
  });
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

test('set-config accepts Worker lifecycle and generic Group defaults', () => {
  const result = applySessionConfigMutation({
    existingConfig: cloneJson(profileBearingConfig),
    mutation: {
      kind: 'set-config',
      incomingConfig: {
        sessionEndsAt: '2030-01-02T03:04:00Z',
        defaultTags: 'governance,ai',
        defaultGroupTags: 'facilitators,reviewers',
        questionsGenPrompt: 'Prefer concrete tradeoffs.',
        interviewModeEnabled: false,
        interviewMode: { enabled: false, provider: 'openai', realtimeModel: 'gpt-realtime-2.1' },
        defaultFilterState: { sort: 'recent' },
        appearance: { colorSchemeId: 'ocean' },
      },
    },
    slug: 'session-a',
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.sessionEndsAt, '2030-01-02T03:04:00Z');
  assert.equal(result.config.defaultGroupTags, 'facilitators,reviewers');
  assert.equal(result.config.interviewModeEnabled, false);
  assert.deepEqual(result.config.interviewMode, {
    enabled: false,
    provider: 'openai',
    realtimeModel: 'gpt-realtime-2.1',
  });
  assert.deepEqual(result.config.appearance, { colorSchemeId: 'ocean' });
});

test('set-config rejects malformed or unsupported interview mode config', () => {
  for (const incomingConfig of [
    { interviewModeEnabled: 'false' },
    { interviewMode: { enabled: 'false' } },
    { interviewMode: { provider: 'openrouter' } },
    { interviewMode: { realtimeModel: 'gpt-5' } },
    { interviewMode: { enabled: true, apiKey: 'must-not-be-public' } },
  ]) {
    const result = applySessionConfigMutation({
      existingConfig: cloneJson(profileBearingConfig),
      mutation: { kind: 'set-config', incomingConfig },
      slug: 'session-a',
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  }
});

test('set-config rejects unsafe or unregistered session appearance config', () => {
  for (const appearance of [
    { colorSchemeId: '../remote.css' },
    { colorSchemeId: 'classic-95' },
    { colorSchemeId: 'ocean', stylesheet: 'https://example.invalid/theme.css' },
    { colorSchemeId: { value: 'ocean' } },
    { '--ce-session-accent': '#ffffff' },
  ]) {
    const result = applySessionConfigMutation({
      existingConfig: cloneJson(profileBearingConfig),
      mutation: { kind: 'set-config', incomingConfig: { appearance } },
      slug: 'session-a',
    });
    assert.deepEqual(result, {
      ok: false,
      status: 400,
      error: 'Invalid session appearance config.',
    });
  }
});

test('set-config rejects chain-only and SBT-only fields for pure Worker sessions', () => {
  for (const [field, value, error] of [
    ['blockLimits', { start: 100 }, 'Unsupported worker-canonical session config field: blockLimits.'],
    ['faucet', { amountEth: '0.001' }, 'Unsupported worker-canonical session config field: faucet.'],
    ['registryAddress', '0x0000000000000000000000000000000000000001', 'Unsupported worker-canonical session config field: registryAddress.'],
    ['networkChainId', 11155420, 'Worker-native Group sessions do not accept networkChainId.'],
    ['defaultSbtTags', 'token-holders', 'Worker-native Group sessions do not accept defaultSbtTags.'],
    [
      'contracts',
      { sbtFactory: { address: '0x0000000000000000000000000000000000000001', chainId: 11155420 } },
      'Worker-canonical sessions accept only the on-chain SBT Group Factory contract.',
    ],
  ]) {
    const result = applySessionConfigMutation({
      existingConfig: cloneJson(profileBearingConfig),
      mutation: { kind: 'set-config', incomingConfig: { [field]: value } },
      slug: 'session-a',
    });
    assert.deepEqual(result, { ok: false, status: 400, error }, field);
  }
});

test('set-config rejects public-looking fields outside the Worker allowlist', () => {
  for (const [field, value] of [
    ['publicKey', 'public-id'],
    ['resourceKey', 'default'],
    ['keyProvider', 'worker_secret'],
  ]) {
    const result = applySessionConfigMutation({
      existingConfig: cloneJson(profileBearingConfig),
      mutation: { kind: 'set-config', incomingConfig: { [field]: value } },
      slug: 'session-a',
    });
    assert.deepEqual(result, {
      ok: false,
      status: 400,
      error: `Unsupported worker-canonical session config field: ${field}.`,
    });
  }
});

test('set-config accepts only Group Factory chain config for explicit Worker plus on-chain SBT', () => {
  const sessionModeProfile = cloneJson(workerModeProfile);
  sessionModeProfile.evm.registryChainId = 11155420;
  sessionModeProfile.authorization.mechanisms.push('sbt_onchain');
  sessionModeProfile.storage.payloadAccessControl.accessConditions = {
    match: 'any',
    conditions: [
      { kind: 'worker_role', role: 'admin' },
      {
        kind: 'sbt_onchain',
        chainId: 11155420,
        contract: '0x0000000000000000000000000000000000000001',
        anyOrAll: 'any',
      },
    ],
  };
  const storageProfile = cloneJson(canonicalWorkerStorageProfile);
  storageProfile.payloadAccessControl.accessConditions =
    cloneJson(sessionModeProfile.storage.payloadAccessControl.accessConditions);
  const existingConfig = {
    ...baseConfig,
    sessionModeProfile,
    storageProfile,
  };
  const accepted = applySessionConfigMutation({
    existingConfig,
    mutation: {
      kind: 'set-config',
      incomingConfig: {
        networkChainId: 11155420,
        defaultSbtTags: 'token-holders',
        contracts: {
          sbtFactory: {
            address: '0x0000000000000000000000000000000000000002',
            chainId: 11155420,
          },
        },
      },
    },
    slug: 'session-a',
  });
  assert.equal(accepted.ok, true);
  assert.deepEqual(Object.keys(accepted.config.contracts), ['sbtFactory']);

  const rejected = applySessionConfigMutation({
    existingConfig,
    mutation: {
      kind: 'set-config',
      incomingConfig: {
        contracts: {
          surveys: {
            address: '0x0000000000000000000000000000000000000003',
            chainId: 11155420,
          },
        },
      },
    },
    slug: 'session-a',
  });
  assert.deepEqual(rejected, {
    ok: false,
    status: 400,
    error: 'Worker-canonical sessions accept only the on-chain SBT Group Factory contract.',
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
