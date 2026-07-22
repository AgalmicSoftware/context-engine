import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateDeploymentModeValues,
  validateWorkerConfigModeValues,
} from './workerConfigModeValidation.mjs';

test('mode validation accepts canonical deploy and persisted config values', () => {
  const value = {
    sessionModeProfile: {
      preset: 'fast_cheap_cloudflare',
      authority: { mode: 'worker_canonical' },
      storage: {
        backend: 'cloudflare',
        payloadAccessControl: { gate: 'role_gate', encryption: 'worker_envelope' },
      },
      encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
    },
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
