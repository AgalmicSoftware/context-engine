import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentInviteRedemptionCoordinator,
  finalizeAgentInviteRedemption,
  releaseAgentInviteRedemption,
  reserveAgentInviteRedemption,
} from './agentInviteRedemptionCoordinator.mjs';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  async transaction(callback) {
    return callback(this);
  }

  async get(key) {
    return this.values.get(key);
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.values.delete(key);
  }
}

function coordinatorEnv() {
  const coordinator = new AgentInviteRedemptionCoordinator({ storage: new MemoryStorage() });
  return {
    AGENT_INVITE_COORDINATOR: {
      getByName: () => ({
        fetch: (input, init) => coordinator.fetch(input instanceof Request ? input : new Request(input, init)),
      }),
    },
  };
}

const tokenHash = 'ab'.repeat(32);

test('invite coordinator serializes reservation and finalization ownership', async () => {
  const env = coordinatorEnv();
  const first = await reserveAgentInviteRedemption({ env, tokenHash, body: { reservationId: 'first' } });
  const competing = await reserveAgentInviteRedemption({ env, tokenHash, body: { reservationId: 'second' } });
  const finalized = await finalizeAgentInviteRedemption({
    env,
    tokenHash,
    body: {
      reservationId: 'first',
      principalId: 'principal-1',
      sessionSlug: 'alpha',
      credentialHash: 'cd'.repeat(32),
    },
  });
  const afterFinalization = await reserveAgentInviteRedemption({
    env,
    tokenHash,
    body: { reservationId: 'third' },
  });

  assert.equal(first.ok, true);
  assert.equal(competing.status, 409);
  assert.equal(competing.reason, 'invite_token_redemption_pending');
  assert.equal(finalized.ok, true);
  assert.equal(afterFinalization.status, 409);
  assert.equal(afterFinalization.reason, 'invite_token_redeemed');
});

test('invite coordinator releases only a reservation owned by the caller', async () => {
  const env = coordinatorEnv();
  await reserveAgentInviteRedemption({ env, tokenHash, body: { reservationId: 'first' } });

  const foreignRelease = await releaseAgentInviteRedemption({
    env,
    tokenHash,
    body: { reservationId: 'second' },
  });
  const ownedRelease = await releaseAgentInviteRedemption({
    env,
    tokenHash,
    body: { reservationId: 'first' },
  });
  const retry = await reserveAgentInviteRedemption({
    env,
    tokenHash,
    body: { reservationId: 'third' },
  });

  assert.equal(foreignRelease.released, false);
  assert.equal(ownedRelease.released, true);
  assert.equal(retry.ok, true);
});

test('invite coordinator calls fail closed without the Durable Object binding', async () => {
  const result = await reserveAgentInviteRedemption({
    env: {},
    tokenHash,
    body: { reservationId: 'first' },
  });

  assert.deepEqual(result, {
    ok: false,
    status: 503,
    reason: 'invite_coordinator_unavailable',
  });
});
