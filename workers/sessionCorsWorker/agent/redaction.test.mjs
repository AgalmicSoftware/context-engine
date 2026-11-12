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
