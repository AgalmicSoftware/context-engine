import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createWorkerClient } from './workerClient.mjs';
import { SESSION_COORDINATOR_UNAVAILABLE } from '../../shared/sessionCoordinatorBusy.mjs';

const TRUSTED = ['https://contextengine.sh'];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const busy = () => json({ error: SESSION_COORDINATOR_UNAVAILABLE }, 503);

// A Worker whose session coordinator refuses the first `refusals` calls to
// each storage path, as a crowded session does.
const setup = (t, refusals) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sent = [];
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (path === '/auth/nonce') return json({ nonce: 'n1abcdefgh' });
    if (path === '/auth/login') return json({ token: 'e30.sig', exp: 9999999999 });
    sent.push(path);
    if (sent.filter((p) => p === path).length <= refusals) return busy();
    return json(path === '/storage/upload' ? { id: 'r1', requestId: JSON.parse(init.body).requestId } : { items: [], listComplete: true });
  };
  const client = createWorkerClient({ workerOrigin: 'https://w.example.dev', slug: 's', trustedOrigins: TRUSTED,
    wallet: ethers.Wallet.createRandom(), fetchImpl, registryConfigLoader: async () => ({ sessionId: '0x00112233445566778899aabbccddeeff' }) });
  // Let each wait run out as soon as the client starts it.
  const settle = async (pending) => {
    let done = false;
    pending.finally(() => { done = true; }).catch(() => {});
    while (!done) { await new Promise((resolve) => setImmediate(resolve)); t.mock.timers.tick(5_000); }
    return pending;
  };
  return { client, sent, settle };
};

test('a busy coordinator is retried for reads and for answers with a request id', async (t) => {
  const { client, sent, settle } = setup(t, 2);
  await settle(client.listAll({ resource: 'responses' }));
  await settle(client.upload({ resource: 'responses', data: { questionID: 'q1' }, requestId: 'answer:v1:op:q1' }));
  assert.deepEqual(sent, ['/storage/list', '/storage/list', '/storage/list', '/storage/upload', '/storage/upload', '/storage/upload']);
});

test('a busy group join is sent again; leaving a group is sent once', async (t) => {
  const join = setup(t, 2);
  await join.settle(join.client.joinGroup('salon'));
  assert.deepEqual(join.sent, ['/groups/join', '/groups/join', '/groups/join']);
  t.mock.timers.reset();

  const leave = setup(t, 1);
  await assert.rejects(leave.settle(leave.client.leaveGroup('salon')), /coordination is unavailable/);
  assert.deepEqual(leave.sent, ['/groups/leave']);
});

test('a write without a request id is sent once, and retries stop after three', async (t) => {
  const once = setup(t, 1);
  await assert.rejects(once.settle(once.client.upload({ resource: 'questions', data: { id: 'q1' } })), /coordination is unavailable/);
  assert.deepEqual(once.sent, ['/storage/upload']);
  t.mock.timers.reset();

  const stuck = setup(t, 10);
  await assert.rejects(stuck.settle(stuck.client.listAll({ resource: 'responses' })), /coordination is unavailable/);
  assert.equal(stuck.sent.length, 4);
});
