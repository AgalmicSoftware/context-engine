import test from 'node:test';
import assert from 'node:assert/strict';

import { createOperationQueue } from './operationQueue.js';

const gate = () => {
  let open;
  const opened = new Promise((resolve) => { open = resolve; });
  return { open, opened };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('shared operations run side by side; the same key runs in order', async () => {
  const queue = createOperationQueue();
  const started = [];
  const hold = gate();
  const run = (name, key) => queue.shared(key, async () => { started.push(name); await hold.opened; });
  const all = [run('a', 'x'), run('b', 'y'), run('c', ''), run('d', 'x')];
  await tick();
  assert.deepEqual(started, ['a', 'b', 'c']);
  hold.open();
  await Promise.all(all);
  assert.deepEqual(started, ['a', 'b', 'c', 'd']);
});

test('an exclusive operation waits for earlier ones and holds back later ones', async () => {
  const queue = createOperationQueue();
  const events = [];
  const first = gate();
  const middle = gate();
  const one = queue.shared('x', async () => { events.push('shared 1 start'); await first.opened; events.push('shared 1 end'); });
  const alone = queue.exclusive(async () => { events.push('exclusive start'); await middle.opened; events.push('exclusive end'); });
  const two = queue.shared('y', async () => { events.push('shared 2'); });
  await tick();
  assert.deepEqual(events, ['shared 1 start']);
  first.open();
  await tick();
  assert.deepEqual(events, ['shared 1 start', 'shared 1 end', 'exclusive start']);
  middle.open();
  await Promise.all([one, alone, two]);
  assert.deepEqual(events.slice(-2), ['exclusive end', 'shared 2']);
});

test('a failed operation releases the queue and reaches only its caller', async () => {
  const queue = createOperationQueue();
  await assert.rejects(queue.shared('x', async () => { throw new Error('boom'); }), /boom/);
  await assert.rejects(queue.exclusive(async () => { throw new Error('bang'); }), /bang/);
  assert.equal(await queue.shared('x', async () => 'next'), 'next');
  assert.equal(await queue.exclusive(async () => 'after'), 'after');
});
