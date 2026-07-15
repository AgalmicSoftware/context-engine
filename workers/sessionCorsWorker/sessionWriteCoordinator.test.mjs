import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SessionWriteCoordinator,
  executeCoordinatedSponsoredDeploy,
} from './sessionWriteCoordinator.js';

const createTransactionalState = () => {
  const store = new Map();
  let tail = Promise.resolve();
  const transaction = (callback) => {
    const run = tail.then(() => callback({
      get: async (key) => store.get(key),
      put: async (key, value) => store.set(key, structuredClone(value)),
    }));
    tail = run.catch(() => undefined);
    return run;
  };
  return { state: { storage: { transaction } }, store };
};

const createRequest = ({ requestDigest, deployBody = {}, sensitiveValues = [] } = {}) => new Request(
  'https://session-coordinator.internal/sponsored-deploy',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestDigest,
      deployBody,
      requestOrigin: 'https://allowed.example.test',
      sensitiveValues,
    }),
  },
);

const readResponse = async (response) => ({
  status: response.status,
  body: await response.json(),
});

test('SessionWriteCoordinator chooses one payload before concurrent sponsored deploy mutation', async () => {
  const { state, store } = createTransactionalState();
  let releaseFirst;
  const firstCanFinish = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const calls = [];
  const coordinator = new SessionWriteCoordinator(state, { GROUP_KV: {} }, {
    now: () => 1_000,
    crypto: { randomUUID: () => 'attempt-1' },
    executeDeployHelperRequest: async (request) => {
      calls.push(request);
      await firstCanFinish;
      return {
        ok: true,
        status: 200,
        body: { ok: true, workerUrl: 'https://winner.example.test' },
      };
    },
  });

  const first = coordinator.fetch(createRequest({
    requestDigest: 'digest-a',
    deployBody: { apiToken: 'cf-sponsor-secret', secrets: { openaiKey: 'sk-provider-secret' } },
    sensitiveValues: ['cf-sponsor-secret', 'sk-provider-secret'],
  }));
  while (calls.length === 0) await Promise.resolve();

  const changed = await readResponse(await coordinator.fetch(createRequest({
    requestDigest: 'digest-b',
    deployBody: { apiToken: 'cf-other', sessionSlug: 'changed' },
  })));
  assert.equal(changed.status, 409);
  assert.equal(changed.body.body.sponsoredGrantPayloadConflict, true);
  assert.equal(calls.length, 1);

  releaseFirst();
  const winner = await readResponse(await first);
  assert.equal(winner.status, 200);
  assert.equal(winner.body.body.workerUrl, 'https://winner.example.test');
  assert.equal(calls.length, 1);
  assert.doesNotMatch(JSON.stringify([...store.values()]), /cf-sponsor-secret|sk-provider-secret/);
});

test('SessionWriteCoordinator returns pending for a concurrent identical payload and replays terminal success', async () => {
  const { state } = createTransactionalState();
  let releaseFirst;
  const firstCanFinish = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let calls = 0;
  let nowMs = 2_000;
  const coordinator = new SessionWriteCoordinator(state, {}, {
    now: () => nowMs,
    crypto: { randomUUID: () => 'attempt-2' },
    executeDeployHelperRequest: async () => {
      calls += 1;
      await firstCanFinish;
      return { ok: true, status: 200, body: { ok: true, workerName: 'worker-a' } };
    },
  });

  const first = coordinator.fetch(createRequest({ requestDigest: 'same-digest' }));
  while (calls === 0) await Promise.resolve();
  // Even after the durable crash-recovery lease ages out, the live object must
  // not start a second helper while its original outbound request is active.
  nowMs += 70_000;
  const pending = await readResponse(await coordinator.fetch(createRequest({ requestDigest: 'same-digest' })));
  assert.equal(pending.status, 503);
  assert.equal(pending.body.body.deploymentRequestPending, true);
  assert.equal(calls, 1);

  releaseFirst();
  await first;
  const replay = await readResponse(await coordinator.fetch(createRequest({ requestDigest: 'same-digest' })));
  assert.equal(replay.status, 200);
  assert.equal(replay.body.body.workerName, 'worker-a');
  assert.equal(calls, 1);
});

test('SessionWriteCoordinator allows one same-digest retry after a retryable helper result', async () => {
  const { state } = createTransactionalState();
  let calls = 0;
  const coordinator = new SessionWriteCoordinator(state, {}, {
    now: () => 3_000 + calls,
    crypto: { randomUUID: () => `attempt-${calls + 3}` },
    executeDeployHelperRequest: async () => {
      calls += 1;
      return calls === 1
        ? {
            ok: false,
            status: 503,
            body: { error: 'Retry this deployment.', deploymentRequestPending: true },
          }
        : { ok: true, status: 200, body: { ok: true, workerName: 'recovered-worker' } };
    },
  });

  const first = await readResponse(await coordinator.fetch(createRequest({ requestDigest: 'retry-digest' })));
  assert.equal(first.status, 503);
  const second = await readResponse(await coordinator.fetch(createRequest({ requestDigest: 'retry-digest' })));
  assert.equal(second.status, 200);
  assert.equal(second.body.body.workerName, 'recovered-worker');
  assert.equal(calls, 2);
});

test('SessionWriteCoordinator preserves safe retry recovery metadata for the caller', async () => {
  const { state, store } = createTransactionalState();
  const coordinator = new SessionWriteCoordinator(state, {}, {
    now: () => 4_000,
    crypto: { randomUUID: () => 'attempt-recovery' },
    executeDeployHelperRequest: async () => ({
      ok: false,
      status: 503,
      body: {
        error: 'Upload is pending for cf-sensitive-value.',
        deploymentRequestPending: true,
        orphanResources: {
          kvNamespaceId: 'kv-recover-1',
          kvCleanupStatus: 'retained-upload-pending',
          workerName: 'worker-recover-1',
        },
        bundleDiagnostics: {
          source: 'bundleUrl',
          length: 123,
          sha256: 'a'.repeat(64),
          hasExportDefault: true,
        },
      },
    }),
  });

  const response = await readResponse(await coordinator.fetch(createRequest({
    requestDigest: 'recovery-digest',
    deployBody: { apiToken: 'cf-sensitive-value' },
    sensitiveValues: ['cf-sensitive-value'],
  })));
  assert.equal(response.status, 503);
  assert.equal(response.body.body.error, 'Upload is pending for [REDACTED].');
  assert.deepEqual(response.body.body.orphanResources, {
    kvNamespaceId: 'kv-recover-1',
    kvCleanupStatus: 'retained-upload-pending',
    workerName: 'worker-recover-1',
  });
  assert.deepEqual(response.body.body.bundleDiagnostics, {
    source: 'bundleUrl',
    length: 123,
    sha256: 'a'.repeat(64),
    hasExportDefault: true,
  });
  assert.doesNotMatch(JSON.stringify([...store.values()]), /cf-sensitive-value/);
});

test('executeCoordinatedSponsoredDeploy fails closed without a Durable Object binding', async () => {
  const result = await executeCoordinatedSponsoredDeploy({
    env: { GROUP_KV: {} },
    grantToken: 'grant-a',
    requestDigest: 'digest-a',
    deployBody: { apiToken: 'must-not-run' },
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.deploymentRequestPending, true);
  assert.match(result.body.error, /no Cloudflare action was attempted/i);
});

test('executeCoordinatedSponsoredDeploy routes one grant identity to its coordinator object', async () => {
  const calls = [];
  const result = await executeCoordinatedSponsoredDeploy({
    env: {
      CE_SESSION_COORDINATOR: {
        idFromName: (name) => {
          calls.push(['idFromName', name]);
          return `id:${name}`;
        },
        get: (id) => ({
          fetch: async (url, init) => {
            calls.push(['fetch', id, url, init]);
            return new Response(JSON.stringify({
              ok: true,
              status: 200,
              body: { ok: true, workerName: 'coordinated-worker' },
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          },
        }),
      },
    },
    grantToken: 'grant-stable-id',
    requestDigest: 'digest-stable-id',
    deployBody: { apiToken: 'cf-transient-secret' },
    sensitiveValues: ['cf-transient-secret'],
  });

  assert.equal(calls[0][0], 'idFromName');
  assert.match(calls[0][1], /^[0-9a-f]{64}$/);
  assert.equal(calls[1][0], 'fetch');
  assert.equal(calls[1][1], `id:${calls[0][1]}`);
  assert.equal(calls[1][2], 'https://session-coordinator.internal/sponsored-deploy');
  assert.equal(JSON.parse(calls[1][3].body).deployBody.apiToken, 'cf-transient-secret');
  assert.deepEqual(result, {
    ok: true,
    status: 200,
    body: { ok: true, workerName: 'coordinated-worker' },
  });
});
