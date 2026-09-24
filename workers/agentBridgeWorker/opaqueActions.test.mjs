import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubmitIdempotencyKey, buildOpaqueActionId, buildTelegramCallbackId, buildTelegramStartId, parseOpaqueActionId } from './opaqueActions.mjs';

test('opaque ids separate a known FNV collision and fit Telegram payload limits', () => {
  for (const build of [buildOpaqueActionId, buildTelegramCallbackId, buildTelegramStartId]) {
    const first = build('kXVPDPqPrkue');
    assert.notEqual(first, build('aY0ReOIYlWwO'));
    assert.equal(first, build('kXVPDPqPrkue'));
    assert.ok(first.length <= 64);
    assert.equal(parseOpaqueActionId(first).ok, true);
  }
});

test('submit ids bind the principal, complete question id, and complete answer', () => {
  const input = { transport: 'telegram_mini_submit', principal: '42', sessionSlug: 'alpha',
    questionId: `0x${'1'.repeat(64)}`, answer: { value: 'first', comments: 'note' } };
  const id = buildOpaqueActionId(buildSubmitIdempotencyKey(input));
  assert.equal(id, buildOpaqueActionId(buildSubmitIdempotencyKey({ ...input, answer: { comments: 'note', value: 'first' } })));
  for (const change of [
    { principal: '43' }, { sessionSlug: 'beta' }, { answer: { value: 'second' } },
    { questionId: `0x${'1'.repeat(20)}2${'1'.repeat(43)}` },
  ]) assert.notEqual(id, buildOpaqueActionId(buildSubmitIdempotencyKey({ ...input, ...change })));
});
