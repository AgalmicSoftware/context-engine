import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

test('worker health endpoint marks private bridge skeleton and broadcast-disabled status', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/health'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.worker, 'agentBridgeWorker');
  assert.equal(body.privateRelease, true);
  assert.equal(body.broadcastEnabled, false);
});

test('worker mock demo route returns end-to-end private Telegram flow without secrets', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/mock/telegram/demo-flow', {
    method: 'POST',
    body: JSON.stringify({
      deploymentId: 'deploy-route',
      rootSecret: 'route-secret',
      sessionSlug: 'alpha',
    }),
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.account.accountMode, 'managed_telegram_demo');
  assert.equal(JSON.stringify(body).includes('route-secret'), false);
  assert.equal(JSON.stringify(body.groupCard).includes(body.account.accountAddress), false);
});
