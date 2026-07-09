import {
  STORAGE_BACKENDS,
  attachStorageRefCompatibilityFields,
  assertNoCloudflarePrivateMaterial,
  deriveStorageRefFromLegacyArweaveTxId,
  getLegacyArweaveTxId,
  isSafeCloudflareStorageRefId,
  normalizeStorageRef,
  normalizeStorageRefForRecord,
  resolvePayloadStorageRef,
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

  test('prefers storageRef over stale legacy arweaveTxId when resolving payload pointers', () => {
    const preferredTx = 'preferred123preferred123preferred123preferred123p';
    const legacyTx = 'legacy123legacy123legacy123legacy123legacy1231';
    const record = attachStorageRefCompatibilityFields({
      arweaveTxId: legacyTx,
      storageRef: { backend: 'arweave', id: preferredTx },
    });

    expect(resolvePayloadStorageRef(record)).toEqual({
      backend: STORAGE_BACKENDS.ARWEAVE,
      id: preferredTx,
      uri: `ar://${preferredTx}`,
    });
    expect(getLegacyArweaveTxId(record)).toBe(preferredTx);
    expect(record.arweaveTxId).toBe(preferredTx);
  });

  test('does not synthesize arweaveTxId for Cloudflare storage refs', () => {
    const record = attachStorageRefCompatibilityFields({
      arweaveTxId: TX_ID,
      storageRef: {
        backend: 'cloudflare',
        id: 'cf_responseopaque01',
        resource: 'responses',
      },
    });

    expect(record.storageRef).toEqual({
      backend: STORAGE_BACKENDS.CLOUDFLARE,
      id: 'cf_responseopaque01',
      uri: '/storage/read?id=cf_responseopaque01',
      resource: 'responses',
    });
    expect(getLegacyArweaveTxId(record)).toBe('');
    expect(record.arweaveTxId).toBe(TX_ID);
  });

  test('exports canonical dual-field helper names while preserving legacy aliases', () => {
    expect(deriveStorageRefFromLegacyArweaveTxId(TX_ID)).toEqual({
      backend: STORAGE_BACKENDS.ARWEAVE,
      id: TX_ID,
      uri: `ar://${TX_ID}`,
    });
    expect(resolvePayloadStorageRef({ arweaveTxId: TX_ID })).toEqual(
      normalizeStorageRefForRecord({ arweaveTxId: TX_ID }),
    );
    expect(attachStorageRefCompatibilityFields({ arweaveTxId: TX_ID })).toEqual(
      withStorageRefCompatibility({ arweaveTxId: TX_ID }),
    );
  });
});
