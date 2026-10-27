import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubmitIdempotencyKey, buildOpaqueActionId } from './opaqueActions.mjs';

test('opaque ids separate a known FNV collision and keep their persisted shape', () => {
  for (const build of [buildOpaqueActionId]) {
    const first = build('kXVPDPqPrkue');
    assert.notEqual(first, build('aY0ReOIYlWwO'));
    assert.equal(first, build('kXVPDPqPrkue'));
    assert.ok(first.length <= 64);
    assert.match(first, /^ceab_[a-z0-9]{50}$/);
  }
});

test('submit ids bind the principal, complete question id, and complete answer', () => {
  const input = { transport: 'telegram_bot_submit', principal: '42', sessionSlug: 'alpha',
    questionId: `0x${'1'.repeat(64)}`, answer: { value: 'first', comments: 'note' } };
  const id = buildOpaqueActionId(buildSubmitIdempotencyKey(input));
  assert.equal(id, buildOpaqueActionId(buildSubmitIdempotencyKey({ ...input, answer: { comments: 'note', value: 'first' } })));
  for (const change of [
    { principal: '43' }, { sessionSlug: 'beta' }, { answer: { value: 'second' } },
    { questionId: `0x${'1'.repeat(20)}2${'1'.repeat(43)}` },
  ]) assert.notEqual(id, buildOpaqueActionId(buildSubmitIdempotencyKey({ ...input, ...change })));
});
