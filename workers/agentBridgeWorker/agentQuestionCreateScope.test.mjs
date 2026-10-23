import test from 'node:test';
import assert from 'node:assert/strict';

import { handleAgentHttpRequest } from './agentHttp.mjs';
import { AGENT_CREDENTIAL_SCOPES, createOpaqueAgentPrincipalId, issueAgentCredential } from './agentCredentials.mjs';

class MemoryKv {
  constructor() { this.store = new Map(); }
  async get(key) { return this.store.has(key) ? this.store.get(key) : null; }
  async put(key, value) { this.store.set(key, String(value)); }
  async delete(key) { this.store.delete(key); }
  async list({ prefix = '' } = {}) {
    return { keys: [...this.store.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}

for (const [allowed, scopes] of [[true, [AGENT_CREDENTIAL_SCOPES.POSE_QUESTIONS]], [false, [AGENT_CREDENTIAL_SCOPES.READ_QUESTIONS]]]) {
test(`questions/create enforces the pose_questions credential scope (${allowed})`, async () => {
  const env = {
    AGENT_ACTION_KV: new MemoryKv(),
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', agentHttpEnabled: true }],
    }),
  };
  const issued = await issueAgentCredential({
    env,
    principal: { principalId: createOpaqueAgentPrincipalId('user'), kind: 'user', adapter: 'invite' },
    sessionSlug: 'alpha',
    scopes,
  });
  assert.equal(issued.ok, true);
  const response = await handleAgentHttpRequest({
    request: new Request('https://bridge.example/api/agent/questions/create', {
      method: 'POST',
      headers: { authorization: `Bearer ${issued.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sessionSlug: 'alpha', questions: [{ prompt: 'Should the town add a library?' }] }),
    }),
    env,
  });
  const body = await response.json();
  assert.equal(response.status, allowed ? 200 : 403, JSON.stringify(body));
  if (allowed) {
    assert.equal(body.created.length, 1, JSON.stringify(body));
    assert.equal(body.created[0].prompt, 'Should the town add a library?');
  } else {
    assert.equal(body.reason, 'agent_token_scope_denied');
    assert.equal(body.requiredScope, AGENT_CREDENTIAL_SCOPES.POSE_QUESTIONS);
    assert.equal([...env.AGENT_ACTION_KV.store.keys()].filter(key => key.startsWith('telegram:proposed-question:')).length, 0);
  }
});
}
