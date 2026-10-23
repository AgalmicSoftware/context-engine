import test from 'node:test';
import assert from 'node:assert/strict';
import { readStorageBytesBounded } from './storageScanBudget.js';

test('bounded storage streams cancel when actual bytes exceed the size hint', async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(4)); }, cancel() { cancelled = true; } });
  await assert.rejects(readStorageBytesBounded({ size: 1, body }, 5), /synchronous read limit/);
  assert.equal(cancelled, true);
});

test('bounded storage rejects an oversized object before buffering and preserves typed views', async () => {
  let buffered = false;
  await assert.rejects(readStorageBytesBounded({ size: 20, arrayBuffer: async () => { buffered = true; return new ArrayBuffer(20); } }, 5), /synchronous read limit/);
  assert.equal(buffered, false);
  const bytes = new Uint8Array([1, 2, 3, 4]);
  assert.deepEqual(await readStorageBytesBounded(new DataView(bytes.buffer, 1, 2), 2), new Uint8Array([2, 3]));
});
