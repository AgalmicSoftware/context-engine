import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyByteLimitError, readBodyBytes, readBodyText } from './bodyByteLimit.mjs';

test('body reader counts UTF-8 bytes across chunks and accepts the exact limit', async () => {
  const bytes = new TextEncoder().encode('é🙂');
  const response = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 3));
    controller.enqueue(bytes.slice(3));
    controller.close();
  } }));
  assert.equal(await readBodyText(response, 6), 'é🙂');
  await assert.rejects(readBodyBytes(new Response('é🙂'), 5), BodyByteLimitError);
});

test('body reader cancels declared oversize without pulling, and stops actual oversize promptly', async () => {
  for (const declared of [null, '1', '100']) {
    let cancelled = false;
    let pulls = 0;
    const stream = new ReadableStream({
      pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(3)); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const response = new Response(stream, { headers: declared ? { 'content-length': declared } : {} });
    await assert.rejects(readBodyBytes(response, 4), BodyByteLimitError);
    assert.equal(cancelled, true);
    assert.equal(pulls, declared === '100' ? 0 : 2);
    assert.equal(stream.locked, false);
  }
});

test('body reader preserves stream errors and handles empty bodies', async () => {
  const error = new Error('upstream failed');
  const response = new Response(new ReadableStream({ start(controller) { controller.error(error); } }));
  await assert.rejects(readBodyBytes(response, 4), error);
  assert.equal(response.body.locked, false);
  assert.deepEqual(await readBodyBytes(new Response(null), 4), new Uint8Array());
});
