import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import * as agentOnlyMode from './agentOnlyMode.mjs';

for (const [path, method] of [
  ['/telegram/webhook', 'POST'], ['/telegram/mini-app', 'GET'], ['/telegram/mini-app/api/state', 'GET'],
  ['/telegram/result-photo/fixture', 'GET'], ['/mock/telegram/demo-flow', 'POST'],
  ['/mock/telegram/preview', 'GET'], ['/mock/telegram/preview-update', 'POST'],
  ['/api/agent/miniapp/onboard', 'POST'], ['/api/agent/mini-app-launch', 'POST'],
  ['/api/agent/group-approval-link', 'POST'], ['/api/agent/group-approval-revoke', 'POST'],
  ['/api/agent/questions/pose', 'POST'],
  ['/telegram/agent/api/miniapp/onboard', 'POST'], ['/telegram/agent/api/mini-app-launch', 'POST'],
  ['/telegram/agent/api/group-approval-link', 'POST'], ['/telegram/agent/api/group-approval-revoke', 'POST'],
  ['/telegram/agent/api/questions/pose', 'POST'],
]) {
  test(`removed transport route ${path} remains unavailable with old enablement flags`, async () => {
    const env = {
      TELEGRAM_BRIDGE_ENABLED: 'true', TELEGRAM_BOT_TOKEN: 'fixture-token', TELEGRAM_WEBHOOK_SECRET: 'fixture-secret',
      AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true', AGENT_BRIDGE_MINI_APP_ALLOW_PREVIEW_AUTH: 'true',
      AGENT_BRIDGE_AGENT_API_TOKEN: 'fixture-agent',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({ sessions: [{ sessionSlug: 'alpha', telegramBridgeEnabled: true }] }),
      AGENT_ACTION_KV: { get: async () => null, list: async () => ({ keys: [], list_complete: true }) },
      TELEGRAM_FETCH: async () => { assert.fail('removed transport must not call the bot API'); },
    };
    const response = await worker.fetch(new Request(`https://bridge.example${path}`, {
      method, headers: { 'content-type': 'application/json', authorization: 'Bearer fixture-agent' },
      ...(method === 'POST' ? { body: JSON.stringify({ sessionSlug: 'alpha' }) } : {}),
    }), env);
    assert.equal(response.status, 404);
  });
}

test('retained research runtime exposes no human review or tap writers', () => {
  assert.equal(agentOnlyMode.recordAgentOnlyHumanReview, undefined);
  assert.equal(agentOnlyMode.submitAgentOnlyHumanVoteTaps, undefined);
});
