import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
test('worker health endpoint marks private bridge and default broadcast-enabled status', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/health'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.worker, 'agentBridgeWorker');
  assert.equal(body.privateRelease, true);
  assert.equal(body.broadcastEnabled, true);
  assert.equal(body.protocolVersion, 'agent-session-wrapped-v1');
  assert.equal(body.agentSessionWrappedReady, false);
  assert.equal(body.dedicatedSession, null);
});

test('worker health proves its exact dedicated session Worker authority', async () => {
  const sessionWorkerOrigin = 'https://session-alpha.example.workers.dev';
  const response = await worker.fetch(new Request('https://bridge.example/health'), {
    CE_SESSION_WORKER_BASE_URL: sessionWorkerOrigin,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      version: 1,
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionWorkerUrl: sessionWorkerOrigin,
        sessionModeProfile: { surfaces: { agentHttp: true, telegram: false } },
      }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.agentSessionWrappedReady, true);
  assert.deepEqual(body.dedicatedSession, {
    accessEnabled: true,
    sessionSlug: 'alpha',
    sessionWorkerOrigin,
  });
});

test('worker health distinguishes configured authority from disabled Wrapped access', async () => {
  const sessionWorkerOrigin = 'https://session-alpha.example.workers.dev';
  const response = await worker.fetch(new Request('https://bridge.example/health'), {
    CE_SESSION_WORKER_BASE_URL: sessionWorkerOrigin,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      version: 1,
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionWorkerUrl: sessionWorkerOrigin,
        sessionModeProfile: { surfaces: { agentHttp: false, telegram: false } },
      }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.agentSessionWrappedConfigured, true);
  assert.equal(body.agentSessionWrappedReady, false);
  assert.deepEqual(body.dedicatedSession, {
    accessEnabled: false,
    sessionSlug: 'alpha',
    sessionWorkerOrigin,
  });
});

test('worker serves the short Session Wrapped skill route', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/session-wrapped'));

  assert.equal(response.status, 302);
  const location = response.headers.get('location') || '';
  assert.match(location, /^https:\/\/raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine\/main\/workers\/agentBridgeWorker\/skills\/ce-session-wrapped\/SKILL\.md/);
  assert.match(location, /v=2026-10-17-session-wrapped-v1-3-/);
});

test('worker serves the short Session Wrapped skill route to HEAD probes', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/session-wrapped', { method: 'HEAD' }));

  assert.equal(response.status, 302);
  const location = response.headers.get('location') || '';
  assert.match(location, /^https:\/\/raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine\/main\/workers\/agentBridgeWorker\/skills\/ce-session-wrapped\/SKILL\.md/);
  assert.match(location, /v=2026-10-17-session-wrapped-v1-3-/);
});

test('worker dispatches canonical agent API routes', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/api/agent/session-meta?sessionSlug=alpha'), {
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramOnly: true,
        telegramBridgeEnabled: true,
      }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(body.telegramOnly, true);
});
