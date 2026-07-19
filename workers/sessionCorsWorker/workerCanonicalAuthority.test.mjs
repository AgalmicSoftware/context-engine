import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateWorkerCanonicalAnonymousAccess,
  isWorkerCanonicalSessionConfig,
  resolveWorkerCanonicalLoginScopes,
} from './workerCanonicalAuthority.js';

const ADMIN = '0x0000000000000000000000000000000000000001';
const PARTICIPANT = '0x0000000000000000000000000000000000000002';

const buildConfig = (overrides = {}) => ({
  adminAddress: ADMIN,
  sessionModeProfile: {
    authority: { mode: 'worker_canonical' },
    authorization: { mechanisms: ['worker_roles'] },
  },
  workerAuthority: {
    version: 1,
    participantScopes: ['ai', 'transcribe', 'storage', 'groups'],
    anonymousScopes: ['ai', 'transcribe'],
  },
  ...overrides,
});

test('worker-canonical authority requires the exact persisted profile mode', () => {
  assert.equal(isWorkerCanonicalSessionConfig(buildConfig()), true);
  assert.equal(isWorkerCanonicalSessionConfig({ authority: { mode: 'worker_canonical' } }), false);
  assert.equal(
    isWorkerCanonicalSessionConfig({ sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } } }),
    false,
  );
});

test('worker-canonical login grants only configured participant scopes and lets config disable them', async () => {
  assert.deepEqual(
    await resolveWorkerCanonicalLoginScopes({
      address: PARTICIPANT,
      config: buildConfig({ scopes: { transcribe: false } }),
      env: {},
      slug: 'session-a',
    }),
    {
      ai: true,
      groups: true,
      storage: true,
      transcribe: false,
    },
  );
});

test('worker-canonical login adds admin scope only for configured worker-role admins', async () => {
  const adminScopes = await resolveWorkerCanonicalLoginScopes({
    address: ADMIN,
    config: buildConfig(),
    env: {},
    slug: 'session-a',
  });
  const participantScopes = await resolveWorkerCanonicalLoginScopes({
    address: PARTICIPANT,
    config: buildConfig(),
    env: {},
    slug: 'session-a',
  });

  assert.equal(adminScopes.admin, true);
  assert.equal(participantScopes.admin, undefined);
});

test('worker-canonical login evaluates configured worker-group gates and fails closed', async () => {
  const membershipChecks = [];
  const config = buildConfig({
    workerAuthority: {
      version: 1,
      participantScopes: ['storage'],
      anonymousScopes: [],
      loginGate: {
        match: 'all',
        conditions: [{ kind: 'worker_group', groupId: 'participants' }],
      },
    },
  });

  await assert.rejects(
    resolveWorkerCanonicalLoginScopes({
      address: PARTICIPANT,
      config,
      env: { CE_WORKER_GROUPS_KV: {} },
      slug: 'session-a',
      deps: {
        isWorkerGroupMember: async (value) => {
          membershipChecks.push(value);
          return { ok: false, reason: 'worker_group_membership_denied' };
        },
      },
    }),
    /Access denied: worker-canonical login gate failed\./,
  );

  assert.deepEqual(membershipChecks, [{
    env: { CE_WORKER_GROUPS_KV: {} },
    slug: 'session-a',
    groupId: 'participants',
    requesterAddress: PARTICIPANT,
    authScopes: {},
  }]);
});

test('worker-canonical login rejects missing policy instead of granting from an empty config', async () => {
  await assert.rejects(
    resolveWorkerCanonicalLoginScopes({
      address: PARTICIPANT,
      config: buildConfig({ workerAuthority: undefined }),
      env: {},
      slug: 'session-a',
    }),
    /Access denied: worker-canonical authority policy missing\./,
  );
});

test('worker-canonical anonymous access uses the explicit anonymous scope policy only', () => {
  assert.deepEqual(
    evaluateWorkerCanonicalAnonymousAccess({ config: buildConfig(), route: 'ai' }),
    { ok: true, reason: 'worker-canonical-open', scope: 'ai' },
  );
  assert.deepEqual(
    evaluateWorkerCanonicalAnonymousAccess({
      config: buildConfig({
        workerAuthority: {
          version: 1,
          participantScopes: ['storage'],
          anonymousScopes: [],
        },
      }),
      route: 'ai',
    }),
    { ok: false, reason: 'worker-canonical-anonymous-scope-denied', scope: 'ai' },
  );
});
