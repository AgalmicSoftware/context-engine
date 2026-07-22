import test from 'node:test';
import assert from 'node:assert/strict';

import { applySessionConfigMutation } from './sessionConfigMutation.js';

const baseConfig = {
  slug: 'session-a',
  sessionName: 'Session A',
  scopes: { ai: true, groups: true },
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
