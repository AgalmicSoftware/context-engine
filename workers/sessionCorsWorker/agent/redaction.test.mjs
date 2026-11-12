import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSecretShape, redactSecrets } from './redaction.mjs';

test('question id fields may hold the bytes32 shape a private key also has', () => {
  const id = `0x${'ab'.repeat(32)}`;
  const queue = { lastQuestionId: id, servedQuestionIds: [id], history: [{ questionId: id }] };
  assert.equal(hasSecretShape(queue), false);
  assert.deepEqual(redactSecrets(queue), queue);
  assert.equal(hasSecretShape({ note: id }), true);
  assert.equal(hasSecretShape({ servedQuestionIds: [{ value: id }] }), true);
  assert.equal(hasSecretShape({ servedQuestionIds: [{ privateKey: 'x' }] }), true);
});

test('question id fields hold only question ids, never another secret', () => {
  const key = `ceagt_${'A'.repeat(40)}`;
  for (const record of [
    { excludeQuestionIds: [key] },
    { lastQuestionId: 'Bearer abcdef123456' },
    { questionId: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig' },
  ]) {
    assert.equal(hasSecretShape(record), true, JSON.stringify(record));
    assert.notDeepEqual(redactSecrets(record), record);
  }
});

test('a stored answer reference may hold a storage id shaped like an API key', () => {
  // 43 base64url characters, as 32 random bytes encode; these begin like a key.
  const id = `sk-${'A'.repeat(40)}`;
  const record = { storageId: id, storageRef: { backend: 'cloudflare', id, uri: `/storage/read?id=${id}` } };
  assert.equal(hasSecretShape(record), false);
  assert.deepEqual(redactSecrets(record), record);
  // Arweave transaction ids have the same shape.
  for (const uri of [`ar://${id}`, `lit-arweave://${id}`]) {
    assert.equal(hasSecretShape({ arweaveTxId: id, storageRef: { backend: 'arweave', id, uri } }), false, uri);
  }
  assert.equal(hasSecretShape({ note: id }), true);
  assert.equal(hasSecretShape({ storageRef: { note: id } }), true);
  const key = `sk-${'A'.repeat(48)}`;
  for (const leak of [
    { storageId: key },
    { storageRef: { id: key } },
    { storageRef: { uri: `/storage/read?id=${key}` } },
    { storageRef: { uri: `https://example.test/?id=${id}` } },
    { storageId: 'Bearer abcdef123456' },
    { arweaveTxId: key },
    { storageRef: { uri: `ar://${key}` } },
  ]) {
    assert.equal(hasSecretShape(leak), true, JSON.stringify(leak));
    assert.notDeepEqual(redactSecrets(leak), leak);
  }
});
