import {
  STORAGE_BACKENDS,
  assertNoCloudflarePrivateMaterial,
  isSafeCloudflareStorageRefId,
  normalizeStorageRef,
  normalizeStorageRefForRecord,
  withStorageRefCompatibility,
} from './storageRefs.js';

const TX_ID = 'abc123abc123abc123abc123abc123abc123abc1230';

describe('storageRefs', () => {
  test('derives Arweave storageRef from legacy arweaveTxId without removing compatibility field', () => {
    const record = withStorageRefCompatibility({ arweaveTxId: TX_ID, title: 'Question' });

    expect(record.arweaveTxId).toBe(TX_ID);
    expect(record.storageRef).toEqual({
      backend: STORAGE_BACKENDS.ARWEAVE,
      id: TX_ID,
      uri: `ar://${TX_ID}`,
    });
  });

  test('normalizes lit-arweave as encrypted Arweave payload storage', () => {
    expect(normalizeStorageRefForRecord({ arweaveTxId: TX_ID }, { encrypted: true })).toEqual({
      backend: STORAGE_BACKENDS.LIT_ARWEAVE,
      id: TX_ID,
      uri: `lit-arweave://${TX_ID}`,
      encrypted: true,
    });
  });

  test('normalizes Cloudflare references as opaque worker read IDs', () => {
    const ref = normalizeStorageRef({
      backend: 'cloudflare',
      id: 'docctx_01j7safeopaqueid',
      contentType: 'application/json',
      resource: 'docsContext',
      uri: 'https://account.r2.cloudflarestorage.com/bucket/raw-key',
    });

    expect(ref).toEqual({
      backend: STORAGE_BACKENDS.CLOUDFLARE,
      id: 'docctx_01j7safeopaqueid',
      uri: '/storage/read?id=docctx_01j7safeopaqueid',
      contentType: 'application/json',
      resource: 'docsContext',
    });
    expect(JSON.stringify(ref)).not.toMatch(/account|bucket|r2|token|secret|cloudflarestorage/i);
    expect(assertNoCloudflarePrivateMaterial(ref)).toBe(true);
  });

  test('rejects Cloudflare refs that expose private storage identifiers', () => {
    expect(isSafeCloudflareStorageRefId('r2://bucket/raw-key')).toBe(false);
    expect(isSafeCloudflareStorageRefId('https://worker.example/object')).toBe(false);
    expect(normalizeStorageRef({ backend: 'cloudflare', id: 'r2://bucket/raw-key' })).toBeNull();
    expect(() => assertNoCloudflarePrivateMaterial({ bucketName: 'private-bucket' })).toThrow(/must not expose/i);
  });
});
