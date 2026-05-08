// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STORAGE_BACKENDS,
  attachStorageRefCompatibilityFields,
  assertNoCloudflarePrivateMaterial,
  deriveStorageRefFromLegacyArweaveTxId,
  getLegacyArweaveTxId,
  isSafeCloudflareStorageRefId,
  resolvePayloadStorageRef,
} from './storageRefs.mjs';

test('CE-CC storage refs prefer storageRef over stale arweaveTxId', () => {
  const record = attachStorageRefCompatibilityFields({
    arweaveTxId: 'legacy-tx',
    storageRef: { backend: 'arweave', id: 'preferred-tx', resource: 'questions' },
  });

  assert.equal(record.arweaveTxId, 'preferred-tx');
  assert.deepEqual(record.storageRef, {
    backend: STORAGE_BACKENDS.ARWEAVE,
    id: 'preferred-tx',
    uri: 'ar://preferred-tx',
    resource: 'questions',
  });
  assert.equal(getLegacyArweaveTxId(record), 'preferred-tx');
});

test('CE-CC storage refs do not synthesize legacy ids for Cloudflare refs', () => {
  const record = attachStorageRefCompatibilityFields({
    arweaveTxId: 'legacy-tx',
    storageRef: { backend: 'cloudflare', id: 'cf_responseopaque01', resource: 'responses' },
  });

  assert.equal(record.arweaveTxId, 'legacy-tx');
  assert.equal(getLegacyArweaveTxId(record), '');
  assert.deepEqual(resolvePayloadStorageRef(record), {
    backend: STORAGE_BACKENDS.CLOUDFLARE,
    id: 'cf_responseopaque01',
    uri: '/storage/read?id=cf_responseopaque01',
    resource: 'responses',
  });
});

test('CE-CC storage refs reject Cloudflare private material', () => {
  assert.equal(isSafeCloudflareStorageRefId('r2://bucket/key'), false);
  assert.throws(
    () => assertNoCloudflarePrivateMaterial({ bucketName: 'private-bucket' }),
    /must not expose/i,
  );
});

test('CE-CC storage refs derive Arweave refs with resource metadata', () => {
  assert.deepEqual(deriveStorageRefFromLegacyArweaveTxId('response-tx', { resource: 'responses' }), {
    backend: STORAGE_BACKENDS.ARWEAVE,
    id: 'response-tx',
    uri: 'ar://response-tx',
    resource: 'responses',
  });
});
