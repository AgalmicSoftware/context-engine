import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_SESSION_WRAPPED_DEPLOYMENT_KIND,
  executeAgentSessionWrappedDeployment,
  persistAgentSessionWrappedCapability,
} from '../shared/agentSessionWrappedDeployment.mjs';
import { executeDeployHelperRequest } from '../shared/deployHelperCore.mjs';

const body = (overrides = {}) => ({
  deploymentKind: AGENT_SESSION_WRAPPED_DEPLOYMENT_KIND,
  apiToken: 'cf-request-only-token',
  sessionSlug: 'wrapped-alpha',
  sessionWorkerOrigin: 'https://session-worker.example.workers.dev',
  sessionDeploymentIdentity: 'session-deployment-alpha-1',
  authorityMode: 'worker_canonical',
  bundleText: 'export default { fetch() { return new Response("ok") } };',
  ...overrides,
});

const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
});

const cloudflareSuccess = (result = {}) => ({ ok: true, status: 200, data: { success: true, result } });
const cloudflareMissing = () => ({ ok: false, status: 404, error: 'not found' });

function successfulHarness({ existing = false, healthOk = true } = {}) {
  const calls = [];
  let uploadMetadata = null;
  let workerName = '';
  let kvId = 'kv-wrapped-alpha';
  const cfFetchImpl = async (_token, path, init = {}) => {
    const method = init.method || 'GET';
    calls.push({ kind: 'cloudflare', path, method, body: init.body });
    if (path.endsWith('/workers/subdomain') && method === 'GET') {
      return cloudflareSuccess({ subdomain: 'tenant', status: 'active' });
    }
    if (path.includes('/storage/kv/namespaces?per_page=100')) {
      return cloudflareSuccess(existing ? [{ id: kvId, title: 'ContextEngineAgentSessionWrapped:wrapped-alpha:d8a43d33e492' }] : []);
    }
    if (path.endsWith('/storage/kv/namespaces') && method === 'POST') {
      return cloudflareSuccess({ id: kvId });
    }
    const settingsMatch = path.match(/\/workers\/scripts\/([^/]+)\/settings$/);
    if (settingsMatch) {
      workerName = settingsMatch[1];
      if (!existing && !uploadMetadata) return cloudflareMissing();
      return cloudflareSuccess({
        main_module: 'worker.mjs',
        bindings: uploadMetadata?.bindings || [
          { name: 'AGENT_ACTION_KV', type: 'kv_namespace', namespace_id: kvId },
          { name: 'AGENT_BRIDGE_DEPLOYMENT_ID', type: 'plain_text', text: 'd8a43d33e49253bd1deb6ce1ea7d43b6d8bce7fb1ee864804f93e0bd612a80bc' },
          { name: 'AGENT_BRIDGE_BUNDLE_SHA256', type: 'plain_text', text: '3f79d113c075d982f23a6c2b0384dd9ace18865f5fa2560f03d7c0b61574fd3a' },
          { name: 'AGENT_BRIDGE_PUBLIC_URL', type: 'plain_text', text: `https://${workerName}.tenant.workers.dev` },
          { name: 'CE_SESSION_WORKER_BASE_URL', type: 'plain_text', text: 'https://session-worker.example.workers.dev' },
          { name: 'AGENT_BRIDGE_SESSION_POLICY_JSON', type: 'plain_text', text: JSON.stringify({
            version: 1,
            defaultSessionSlug: 'wrapped-alpha',
            sessions: [{
              sessionSlug: 'wrapped-alpha',
              sessionWorkerUrl: 'https://session-worker.example.workers.dev',
              telegramBridgeEnabled: false,
              sessionModeProfile: {
                surfaces: { agentHttp: true, telegram: false },
                authority: { mode: 'worker_canonical' },
              },
            }],
          }) },
          { name: 'AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED', type: 'plain_text', text: 'false' },
          { name: 'BROADCAST_ENABLED', type: 'plain_text', text: 'false' },
        ],
      });
    }
    const uploadMatch = path.match(/\/workers\/scripts\/([^/]+)$/);
    if (uploadMatch && method === 'PUT') {
      workerName = uploadMatch[1];
      const metadataPart = init.body.get('metadata');
      uploadMetadata = JSON.parse(await metadataPart.text());
      return cloudflareSuccess({ id: workerName });
    }
    if (path.endsWith('/secrets') && method === 'GET') {
      return cloudflareSuccess(existing ? [
        { name: 'DEMO_SIGNER_ROOT_SECRET', type: 'secret_text' },
        { name: 'AGENT_BRIDGE_AGENT_API_TOKEN', type: 'secret_text' },
      ] : []);
    }
    if (path.endsWith('/secrets') && method === 'PUT') return cloudflareSuccess({});
    if (path.endsWith('/subdomain') && method === 'POST') return cloudflareSuccess({ enabled: true });
    throw new Error(`Unexpected Cloudflare request ${method} ${path}`);
  };
  const fetchImpl = async (url) => {
    calls.push({ kind: 'public', url: String(url), method: 'GET' });
    if (String(url).endsWith('/release/agent-bridge.bundle.js')) {
      return new Response('export default { fetch() { return new Response("release") } };');
    }
    return jsonResponse(healthOk ? {
      ok: true,
      worker: 'agentBridgeWorker',
      protocolVersion: 'agent-session-wrapped-v1',
      agentSessionWrappedReady: true,
      dedicatedSession: {
        sessionSlug: 'wrapped-alpha',
        sessionWorkerOrigin: 'https://session-worker.example.workers.dev',
      },
    } : { ok: false, reason: 'authority_not_ready' }, healthOk ? 200 : 503);
  };
  return { calls, cfFetchImpl, fetchImpl, getUploadMetadata: () => uploadMetadata };
}

function deployHelperHarness(options = {}) {
  const harness = successfulHarness(options);
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(String(url));
    if (parsed.hostname === 'api.cloudflare.com') {
      const path = `${parsed.pathname.replace('/client/v4', '')}${parsed.search}`;
      const result = await harness.cfFetchImpl('redacted-by-adapter', path, init);
      return jsonResponse(result.data || {
        success: false,
        errors: [{ message: result.error || 'Cloudflare request failed.' }],
      }, result.status || (result.ok ? 200 : 502));
    }
    return harness.fetchImpl(url, init);
  };
  return { ...harness, fetchImpl };
}

const memoryJournal = () => {
  const values = new Map();
  return {
    get: async (key) => values.get(key) || null,
    put: async (key, value) => values.set(key, value),
    delete: async (key) => values.delete(key),
  };
};

test('dedicated Wrapped deployment awaits upload, secrets, activation, and authority health before returning capability', async () => {
  const harness = successfulHarness();
  const result = await executeAgentSessionWrappedDeployment({
    body: body(),
    accountId: 'account-123',
    cfFetchImpl: harness.cfFetchImpl,
    fetchImpl: harness.fetchImpl,
    now: () => new Date('2026-07-20T18:00:00.000Z'),
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.body.agentSessionWrapped, {
    version: 1,
    enabled: true,
    origin: result.body.workerUrl,
    protocolVersion: 'agent-session-wrapped-v1',
    revision: 'wrapped-3f79d113c075d982',
    verifiedAt: '2026-07-20T18:00:00.000Z',
  });
  assert.match(result.body.workerName, /^ce-wrapped-wrapped-alpha-[0-9a-f]{12}$/);
  assert.equal(result.body.telegramConfigured, false);
  assert.deepEqual(result.body.secrets, {
    generated: ['DEMO_SIGNER_ROOT_SECRET', 'AGENT_BRIDGE_AGENT_API_TOKEN'],
    preserved: [],
  });
  assert.equal(JSON.stringify(result).includes('cf-request-only-token'), false);
  const metadata = harness.getUploadMetadata();
  assert.equal(metadata.bindings.some((binding) => binding.type === 'durable_object_namespace'), false);
  assert.equal(metadata.bindings.some((binding) => binding.type === 'd1'), false);
  assert.equal(metadata.bindings.some((binding) => binding.type === 'r2_bucket'), false);
  assert.equal(metadata.bindings.some((binding) => binding.name.startsWith('TELEGRAM_')), false);
  assert.equal(metadata.bindings.find((binding) => binding.name === 'AGENT_BRIDGE_SESSION_POLICY_JSON').text.includes('wrapped-alpha'), true);

  const orderedKinds = harness.calls.map((call) => {
    if (call.kind === 'public') return 'health';
    if (call.path.endsWith('/secrets') && call.method === 'PUT') return 'secret';
    if (/\/workers\/scripts\/[^/]+$/.test(call.path) && call.method === 'PUT') return 'upload';
    if (call.path.endsWith('/subdomain') && call.method === 'POST') return 'activate';
    return 'other';
  });
  assert.equal(orderedKinds.indexOf('upload') < orderedKinds.indexOf('secret'), true);
  assert.equal(orderedKinds.lastIndexOf('secret') < orderedKinds.indexOf('activate'), true);
  assert.equal(orderedKinds.indexOf('activate') < orderedKinds.indexOf('health'), true);
});

test('dedicated Wrapped retry reuses Worker, KV, and secrets without mutation when the bundle is unchanged', async () => {
  const harness = successfulHarness({ existing: true });
  const result = await executeAgentSessionWrappedDeployment({
    body: body(),
    accountId: 'account-123',
    cfFetchImpl: harness.cfFetchImpl,
    fetchImpl: harness.fetchImpl,
    now: () => new Date('2026-07-20T18:00:00.000Z'),
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.body.resources.kvReused, true);
  assert.equal(result.body.upload.reused, true);
  assert.deepEqual(result.body.secrets, {
    generated: [],
    preserved: ['DEMO_SIGNER_ROOT_SECRET', 'AGENT_BRIDGE_AGENT_API_TOKEN'],
  });
  assert.equal(harness.calls.some((call) => /\/workers\/scripts\/[^/]+$/.test(call.path || '') && call.method === 'PUT'), false);
  assert.equal(harness.calls.some((call) => call.path?.endsWith('/secrets') && call.method === 'PUT'), false);
});

test('dedicated Wrapped redeploy updates the same owned Worker while preserving KV and secrets', async () => {
  const harness = successfulHarness({ existing: true });
  const result = await executeAgentSessionWrappedDeployment({
    body: body({ bundleText: 'export default { fetch() { return new Response("updated") } };' }),
    accountId: 'account-123',
    cfFetchImpl: harness.cfFetchImpl,
    fetchImpl: harness.fetchImpl,
    now: () => new Date('2026-07-20T18:00:00.000Z'),
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.body.resources.kvReused, true);
  assert.equal(result.body.upload.reused, false);
  assert.deepEqual(result.body.secrets, {
    generated: [],
    preserved: ['DEMO_SIGNER_ROOT_SECRET', 'AGENT_BRIDGE_AGENT_API_TOKEN'],
  });
  assert.equal(harness.calls.some((call) => /\/workers\/scripts\/[^/]+$/.test(call.path || '') && call.method === 'PUT'), true);
  assert.equal(harness.calls.some((call) => call.path?.endsWith('/secrets') && call.method === 'PUT'), false);
});

test('dedicated Wrapped deployment accepts an HTTPS release bundle URL with a path', async () => {
  const harness = successfulHarness();
  const result = await executeAgentSessionWrappedDeployment({
    body: body({
      bundleText: '',
      bundleUrl: 'https://downloads.example/release/agent-bridge.bundle.js',
    }),
    accountId: 'account-123',
    cfFetchImpl: harness.cfFetchImpl,
    fetchImpl: harness.fetchImpl,
    now: () => new Date('2026-07-20T18:00:00.000Z'),
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.body.upload.reused, false);
  assert.equal(harness.calls.some((call) => call.url === 'https://downloads.example/release/agent-bridge.bundle.js'), true);
});

test('dedicated Wrapped deployment withholds capability when health or authority proof fails', async () => {
  const harness = successfulHarness({ healthOk: false });
  const result = await executeAgentSessionWrappedDeployment({
    body: body(),
    accountId: 'account-123',
    cfFetchImpl: harness.cfFetchImpl,
    fetchImpl: harness.fetchImpl,
    now: () => new Date('2026-07-20T18:00:00.000Z'),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.body.step, 'authority_health_probe');
  assert.equal(result.body.deploymentRequestPending, true);
  assert.equal(Object.hasOwn(result.body, 'agentSessionWrapped'), false);
});

test('deploy helper rejects a missing request-only token before any Cloudflare lookup', async () => {
  const calls = [];
  const result = await executeDeployHelperRequest({
    body: body({ apiToken: '' }),
    fetchImpl: async (...args) => {
      calls.push(args);
      throw new Error('network must not be reached');
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(calls.length, 0);
});

test('existing deploy-helper coordination executes and safely replays a dedicated Wrapped deployment', async () => {
  const harness = deployHelperHarness();
  const requestBody = body({ deploymentRequestId: 'wrapped-deployment-request-0001' });
  const env = { DEPLOY_HELPER_KV: memoryJournal() };
  const options = {
    body: requestBody,
    env,
    requestOrigin: 'https://app.contextengine.sh',
    fetchImpl: harness.fetchImpl,
    resolvedAccountId: 'account-123',
    coordinationBypass: true,
  };

  const first = await executeDeployHelperRequest(options);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.body.agentSessionWrapped.enabled, true);
  const callCountAfterFirst = harness.calls.length;

  const replay = await executeDeployHelperRequest(options);
  assert.equal(replay.ok, true, JSON.stringify(replay));
  assert.deepEqual(replay.body.agentSessionWrapped, first.body.agentSessionWrapped);
  assert.deepEqual(replay.body.resources, first.body.resources);
  assert.equal(harness.calls.length, callCountAfterFirst);
  assert.equal(JSON.stringify(replay).includes('cf-request-only-token'), false);
});

test('capability publication preserves live session config and verifies the durable write', async () => {
  const sessionWorkerOrigin = 'https://session-worker.example.workers.dev';
  const capability = {
    version: 1,
    enabled: true,
    origin: 'https://ce-wrapped-alpha.tenant.workers.dev',
    protocolVersion: 'agent-session-wrapped-v1',
    revision: 'wrapped-0123456789abcdef',
    verifiedAt: '2026-07-20T18:00:00.000Z',
  };
  let stored = {
    slug: 'wrapped-alpha',
    corsWorkerUrl: sessionWorkerOrigin,
    customRuntimeMarker: { retained: true },
  };
  const calls = [];
  const cfFetchImpl = async (_token, path, init = {}) => {
    calls.push({ path, method: init.method || 'GET' });
    if ((init.method || 'GET') === 'PUT') stored = JSON.parse(init.body);
    return cloudflareSuccess(stored);
  };

  const result = await persistAgentSessionWrappedCapability({
    apiToken: 'cf-request-only-token',
    accountId: 'account-123',
    kvNamespaceId: 'kv-session',
    sessionConfigKey: 'session:wrapped-alpha:config',
    sessionSlug: 'wrapped-alpha',
    sessionWorkerOrigin,
    capability,
    cfFetchImpl,
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(stored.customRuntimeMarker, { retained: true });
  assert.deepEqual(stored.agentSessionWrapped, capability);
  assert.deepEqual(calls.map((call) => call.method), ['GET', 'PUT', 'GET']);
});

test('capability publication fails closed when the live config belongs to another Worker origin', async () => {
  const calls = [];
  const result = await persistAgentSessionWrappedCapability({
    apiToken: 'cf-request-only-token',
    accountId: 'account-123',
    kvNamespaceId: 'kv-session',
    sessionConfigKey: 'session:wrapped-alpha:config',
    sessionSlug: 'wrapped-alpha',
    sessionWorkerOrigin: 'https://session-worker.example.workers.dev',
    capability: {
      version: 1,
      enabled: true,
      origin: 'https://ce-wrapped-alpha.tenant.workers.dev',
      protocolVersion: 'agent-session-wrapped-v1',
      revision: 'wrapped-0123456789abcdef',
      verifiedAt: '2026-07-20T18:00:00.000Z',
    },
    cfFetchImpl: async (_token, path, init = {}) => {
      calls.push({ path, method: init.method || 'GET' });
      return cloudflareSuccess({
        slug: 'wrapped-alpha',
        corsWorkerUrl: 'https://other-worker.example.workers.dev',
      });
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.deepEqual(calls.map((call) => call.method), ['GET']);
});
