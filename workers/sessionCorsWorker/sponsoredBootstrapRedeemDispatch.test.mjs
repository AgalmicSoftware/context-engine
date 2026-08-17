import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchSponsoredBootstrapRedeem } from './sponsoredBootstrapRedeemDispatch.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

const createKvEnv = (record = null, envOverrides = {}) => {
  const deletes = [];
  const store = new Map();
  let seededKey = '';
  return {
    deletes,
    store,
    env: {
      GROUP_KV: {
        get: async (key) => {
          if (!seededKey && record) {
            seededKey = key;
            store.set(key, JSON.stringify(record));
          }
          return store.has(key) ? store.get(key) : null;
        },
        put: async (key, value) => {
          store.set(key, value);
        },
        delete: async (key) => {
          deletes.push(key);
          store.delete(key);
        },
      },
      ...envOverrides,
    },
  };
};

const createDeployRequest = (body = {}, origin = 'https://allowed.example.test') => ({
  headers: new Headers({ Origin: origin }),
  json: async () => body,
});

const createDeployDeps = (overrides = {}) => {
  const deps = {
    json: createJsonStub(),
    getCorsContext: async () => ({
      ok: true,
      headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    }),
    ...overrides,
  };
  if (!deps.executeCoordinatedSponsoredDeploy && overrides.executeDeployHelperRequest) {
    deps.executeCoordinatedSponsoredDeploy = ({ deployBody, env, requestOrigin }) => (
      overrides.executeDeployHelperRequest({
        body: deployBody,
        env,
        requestOrigin,
        consoleImpl: console,
      })
    );
  }
  if (!deps.reserveCoordinatedSponsoredFaucet) {
    deps.reserveCoordinatedSponsoredFaucet = async ({ env, grantToken, requestDigest }) => {
      const records = env.__testFaucetCoordinator || new Map();
      env.__testFaucetCoordinator = records;
      const existing = records.get(grantToken);
      if (existing && existing.requestDigest !== requestDigest) return { kind: 'conflict' };
      if (existing?.state === 'terminal') return { kind: 'terminal', receipt: existing.receipt };
      if (existing?.state === 'running') return { kind: 'pending' };
      records.set(grantToken, { state: 'running', requestDigest });
      return { kind: 'execute' };
    };
  }
  if (!deps.finalizeCoordinatedSponsoredFaucet) {
    deps.finalizeCoordinatedSponsoredFaucet = async ({ env, grantToken, requestDigest, receipt }) => {
      const records = env.__testFaucetCoordinator || new Map();
      env.__testFaucetCoordinator = records;
      const existing = records.get(grantToken);
      if (!existing || existing.requestDigest !== requestDigest) return null;
      if (existing.state === 'terminal') return existing.receipt;
      const safeReceipt = {
        status: Number(receipt?.status || 0) || 502,
        body: receipt?.body && typeof receipt.body === 'object' ? receipt.body : {},
      };
      records.set(grantToken, { state: 'terminal', requestDigest, receipt: safeReceipt });
      return safeReceipt;
    };
  }
  return deps;
};

test('dispatchSponsoredBootstrapRedeem rejects invalid JSON before reading grant records', async () => {
  const { env } = createKvEnv();

  const result = await dispatchSponsoredBootstrapRedeem({
    request: {
      json: async () => {
        throw new Error('bad json');
      },
    },
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps: createDeployDeps({
      json: createJsonStub(),
    }),
  });

  assert.deepEqual(result, {
    body: { error: 'Invalid JSON.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('dispatchSponsoredBootstrapRedeem uses the embedded deploy-helper path and stores a safe receipt on success', async () => {
  const { env, deletes } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
    },
    cloudflareApiToken: 'cf-sponsored-token',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });
  const embeddedCalls = [];

  const result = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      deployGrantToken: 'deploy-grant-1',
      deployPayload: {
        workerName: 'new-worker',
        sessionSlug: 'fresh-session',
        accountId: 'grantee-selected-account',
        embeddedDeployHelperEnabled: true,
      },
    }),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps: createDeployDeps({
      executeDeployHelperRequest: async (value) => {
        embeddedCalls.push(value);
        return {
          ok: true,
          status: 200,
          body: { ok: true, workerUrl: 'https://fresh-session.example.test' },
        };
      },
      fetch: async () => {
        assert.fail('fallback helper should not run when embedded deploy succeeds');
      },
    }),
  });

  assert.equal(embeddedCalls.length, 1);
  assert.match(embeddedCalls[0].body.deploymentRequestId, /^sponsored-[0-9a-f]{32}$/);
  assert.match(embeddedCalls[0].body.configRevision, /^sponsored-revision-[0-9a-f]{32}$/);
  const {
    deploymentRequestId: _deploymentRequestId,
    configRevision: _configRevision,
    ...embeddedBody
  } = embeddedCalls[0].body;
  assert.deepEqual([{ ...embeddedCalls[0], body: embeddedBody }], [{
    body: {
      workerName: 'new-worker',
      sessionSlug: 'fresh-session',
      embeddedDeployHelperEnabled: true,
      apiToken: 'cf-sponsored-token',
    },
    env,
    requestOrigin: 'https://allowed.example.test',
    consoleImpl: console,
  }]);
  assert.deepEqual(deletes, []);
  assert.deepEqual(result, {
    body: { ok: true, workerUrl: 'https://fresh-session.example.test' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchSponsoredBootstrapRedeem returns retryable embedded deploy failures directly and keeps the grant', async () => {
  const { env, deletes } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
    },
    cloudflareApiToken: 'cf-sponsored-token',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });

  const result = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      deployGrantToken: 'deploy-grant-1',
      deployPayload: {
        workerName: 'new-worker',
        sessionSlug: 'fresh-session',
        secrets: { openaiKey: 'sk-sponsored' },
      },
    }),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps: createDeployDeps({
      executeDeployHelperRequest: async () => ({
        ok: false,
        status: 502,
        body: { error: 'Embedded deploy unavailable.' },
        fallbackEligible: true,
      }),
      fetch: async (url, init) => {
        assert.fail(`fallback helper should not run (${url} ${init?.method || 'GET'})`);
      },
    }),
  });

  assert.deepEqual(deletes, []);
  assert.deepEqual(result, {
    body: { error: 'Embedded deploy unavailable.' },
    status: 502,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchSponsoredBootstrapRedeem fails closed before deploy when the coordinator binding is absent', async () => {
  const { env, store } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: { allowOrigins: ['https://allowed.example.test'] },
    cloudflareApiToken: 'cf-must-not-run',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });

  const result = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      deployGrantToken: 'deploy-grant-without-coordinator',
      deployPayload: { workerName: 'must-not-exist', sessionSlug: 'must-not-exist' },
    }),
    env,
    baseHeaders: {},
    action: 'deploy',
    deps: createDeployDeps(),
  });

  assert.equal(result.status, 503);
  assert.equal(result.body.deploymentRequestPending, true);
  assert.match(result.body.error, /no Cloudflare action was attempted/i);
  assert.doesNotMatch([...store.values()][0], /redeeming|redeemed/);
});

test('dispatchSponsoredBootstrapRedeem validates deploy config before coordinating the one-shot grant', async () => {
  const { env } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: { allowOrigins: ['https://allowed.example.test'] },
    cloudflareApiToken: 'cf-sponsored-token',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });
  const coordinatedBodies = [];
  const deps = createDeployDeps({
    executeCoordinatedSponsoredDeploy: async ({ deployBody }) => {
      coordinatedBodies.push(deployBody);
      return {
        ok: true,
        status: 200,
        body: { ok: true, workerUrl: 'https://corrected.example.test' },
      };
    },
  });
  const grantRequest = {
    deployGrantToken: 'preflight-grant',
    deployPayload: {
      workerName: 'preflight-worker',
      sessionSlug: 'preflight-session',
      allowOrigins: ['*'],
    },
  };

  const invalid = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(grantRequest),
    env,
    baseHeaders: {},
    action: 'deploy',
    deps,
  });
  const corrected = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      ...grantRequest,
      deployPayload: {
        ...grantRequest.deployPayload,
        allowOrigins: ['https://allowed.example.test'],
      },
    }),
    env,
    baseHeaders: {},
    action: 'deploy',
    deps,
  });

  assert.equal(invalid.status, 400);
  assert.match(invalid.body.error, /exact origins/i);
  assert.equal(corrected.status, 200);
  assert.equal(corrected.body.workerUrl, 'https://corrected.example.test');
  assert.equal(coordinatedBodies.length, 1);
  assert.deepEqual(coordinatedBodies[0].allowOrigins, ['https://allowed.example.test']);
});

test('dispatchSponsoredBootstrapRedeem cannot let a losing concurrent payload replace the winning grant receipt', async () => {
  const { env, store } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: { allowOrigins: ['https://allowed.example.test'] },
    cloudflareApiToken: 'cf-winning-grant-token',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });

  const result = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      deployGrantToken: 'shared-grant',
      deployPayload: { workerName: 'losing-worker', sessionSlug: 'losing-session' },
    }),
    env,
    baseHeaders: {},
    action: 'deploy',
    deps: createDeployDeps({
      executeCoordinatedSponsoredDeploy: async () => ({
        ok: false,
        status: 409,
        body: {
          error: 'Sponsored grant was already reserved with a different request payload.',
          sponsoredGrantPayloadConflict: true,
        },
      }),
    }),
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.sponsoredGrantPayloadConflict, true);
  const storedGrant = JSON.parse([...store.values()][0]);
  assert.equal(storedGrant.cloudflareApiToken, 'cf-winning-grant-token');
  assert.equal(storedGrant.state, undefined);
  assert.equal(storedGrant.receipt, undefined);
});

test('dispatchSponsoredBootstrapRedeem binds the normalized request origin into coordination identity', async () => {
  const requestDigests = [];
  const runFromOrigin = async (origin) => {
    const { env } = createKvEnv({
      type: 'deploy-worker',
      sourceSessionSlug: 'source-session',
      sourceConfig: { allowOrigins: ['https://allowed.example.test', 'https://second.example.test'] },
      cloudflareApiToken: 'cf-origin-token',
    }, {
      DEPLOY_HELPER_ENABLED: '1',
    });
    return dispatchSponsoredBootstrapRedeem({
      request: createDeployRequest({
        deployGrantToken: 'origin-bound-grant',
        deployPayload: { workerName: 'origin-worker', sessionSlug: 'origin-session' },
      }, origin),
      env,
      baseHeaders: {},
      action: 'deploy',
      deps: createDeployDeps({
        executeCoordinatedSponsoredDeploy: async (request) => {
          requestDigests.push([request.requestDigest, request.requestOrigin]);
          return {
            ok: false,
            status: 503,
            body: { error: 'Retry.', deploymentRequestPending: true },
          };
        },
      }),
    });
  };

  await runFromOrigin('https://allowed.example.test/path');
  await runFromOrigin('https://second.example.test/other');
  assert.deepEqual(requestDigests.map(([, origin]) => origin), [
    'https://allowed.example.test',
    'https://second.example.test',
  ]);
  assert.notEqual(requestDigests[0][0], requestDigests[1][0]);
});

test('dispatchSponsoredBootstrapRedeem replays a committed safe receipt and rejects changed deploy payloads', async () => {
  const { env, store } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
    },
    cloudflareApiToken: 'cf-sponsored-token',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });
  const embeddedCalls = [];
  const normalPut = env.GROUP_KV.put.bind(env.GROUP_KV);
  let loseReceiptWriteResponse = true;
  env.GROUP_KV.put = async (key, value, options) => {
    await normalPut(key, value, options);
    const parsed = JSON.parse(value);
    if (parsed?.state === 'redeemed' && loseReceiptWriteResponse) {
      loseReceiptWriteResponse = false;
      throw new TypeError('sponsored receipt response lost');
    }
  };
  const requestBody = {
    deployGrantToken: 'deploy-grant-1',
    deployPayload: {
      deploymentRequestId: 'caller-request-first',
      configRevision: 'caller-revision-first',
      workerName: 'new-worker',
      sessionSlug: 'fresh-session',
      secrets: { openaiKey: 'sk-sponsored' },
    },
  };
  const deps = createDeployDeps({
    executeDeployHelperRequest: async (value) => {
      embeddedCalls.push(value);
      return {
        ok: true,
        status: 200,
        body: {
          ok: true,
          workerName: 'new-worker-abc123',
          workerUrl: 'https://fresh-session.example.test',
          kvNamespaceId: 'kv-sponsored-1',
        },
      };
    },
  });

  await assert.rejects(
    dispatchSponsoredBootstrapRedeem({
      request: createDeployRequest(requestBody),
      env,
      baseHeaders: { 'Access-Control-Allow-Origin': '*' },
      action: 'deploy',
      deps,
    }),
    /sponsored receipt response lost/,
  );

  const replay = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      ...requestBody,
      deployPayload: {
        ...requestBody.deployPayload,
        deploymentRequestId: 'caller-request-after-reload',
        configRevision: 'caller-revision-after-reload',
      },
    }),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps,
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.workerName, 'new-worker-abc123');
  assert.equal(embeddedCalls.length, 1);
  assert.match(embeddedCalls[0].body.deploymentRequestId, /^sponsored-[0-9a-f]{32}$/);
  assert.match(embeddedCalls[0].body.configRevision, /^sponsored-revision-[0-9a-f]{32}$/);
  assert.notEqual(embeddedCalls[0].body.deploymentRequestId, requestBody.deployPayload.deploymentRequestId);
  assert.notEqual(embeddedCalls[0].body.configRevision, requestBody.deployPayload.configRevision);

  const storedReceipt = [...store.values()][0];
  assert.doesNotMatch(storedReceipt, /cf-sponsored-token|sk-sponsored|deployPayload/);

  const changed = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      ...requestBody,
      deployPayload: {
        ...requestBody.deployPayload,
        sessionSlug: 'changed-session',
      },
    }),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps,
  });
  assert.equal(changed.status, 409);
  assert.match(changed.body.error, /different request payload/i);
  assert.equal(embeddedCalls.length, 1);
});

test('dispatchSponsoredBootstrapRedeem replaces a terminal helper failure with a secret-free replay receipt', async () => {
  const { env, store } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: { allowOrigins: ['https://allowed.example.test'] },
    cloudflareApiToken: 'cf-terminal-token',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });
  let embeddedCalls = 0;
  const requestBody = {
    deployGrantToken: 'deploy-terminal-grant',
    deployPayload: {
      deploymentRequestId: 'caller-terminal-request',
      configRevision: 'caller-terminal-revision',
      workerName: 'terminal-worker',
      sessionSlug: 'terminal-session',
      bundleText: 'raw bundle must not persist',
      secrets: { openaiKey: 'sk-terminal-provider-secret' },
    },
  };
  const deps = createDeployDeps({
    executeDeployHelperRequest: async () => {
      embeddedCalls += 1;
      return {
        ok: false,
        status: 409,
        body: {
          error: 'Existing worker bindings do not match: cf-terminal-token sk-terminal-provider-secret deploy-terminal-grant.',
          deploymentRequestTerminal: true,
          leakedToken: 'cf-terminal-token',
        },
      };
    },
  });

  const first = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'deploy',
    deps,
  });
  assert.equal(first.status, 409);
  assert.equal(first.body.deploymentRequestTerminal, true);
  assert.equal(
    first.body.error,
    'Existing worker bindings do not match: [REDACTED] [REDACTED] [REDACTED].',
  );
  assert.equal(embeddedCalls, 1);
  const stored = [...store.values()][0];
  assert.doesNotMatch(
    stored,
    /cf-terminal-token|sk-terminal-provider-secret|deploy-terminal-grant|raw bundle must not persist|caller-terminal/,
  );
  assert.equal(JSON.parse(stored).state, 'redeemed');

  const replay = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      ...requestBody,
      deployPayload: {
        ...requestBody.deployPayload,
        deploymentRequestId: 'different-caller-request',
        configRevision: 'different-caller-revision',
      },
    }),
    env,
    baseHeaders: {},
    action: 'deploy',
    deps,
  });
  assert.equal(replay.status, 409);
  assert.equal(replay.body.deploymentRequestTerminal, true);
  assert.equal(embeddedCalls, 1);
});

test('dispatchSponsoredBootstrapRedeem rejects deploy grants when embedded deploy-helper is disabled on the source worker', async () => {
  const { env, deletes } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
      embeddedDeployHelperEnabled: true,
    },
    cloudflareApiToken: 'cf-sponsored-token',
  }, {
    DEPLOY_HELPER_ENABLED: '0',
  });

  const result = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      deployGrantToken: 'deploy-grant-1',
      deployPayload: {
        workerName: 'new-worker',
        sessionSlug: 'fresh-session',
      },
    }),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps: createDeployDeps({
      executeDeployHelperRequest: async () => {
        assert.fail('embedded deploy should be skipped when disabled');
      },
      fetch: async (url, init) => {
        assert.fail(`fallback helper should not run (${url} ${init?.method || 'GET'})`);
      },
    }),
  });

  assert.deepEqual(deletes, []);
  assert.deepEqual(result, {
    body: { error: 'Embedded sponsored deploy is disabled on this worker.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchSponsoredBootstrapRedeem returns embedded deploy failures directly when they are not fallback-eligible', async () => {
  const { env, deletes } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
    },
    cloudflareApiToken: 'cf-sponsored-token',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });

  const result = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      deployGrantToken: 'deploy-grant-1',
      deployPayload: {
        workerName: '',
        sessionSlug: 'fresh-session',
      },
    }),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps: createDeployDeps({
      executeDeployHelperRequest: async () => ({
        ok: false,
        status: 400,
        body: { error: 'Missing workerName.' },
        fallbackEligible: false,
      }),
      fetch: async () => {
        assert.fail('fallback helper should not run for non-retryable embedded failures');
      },
    }),
  });

  assert.deepEqual(deletes, []);
  assert.deepEqual(result, {
    body: { error: 'Missing workerName.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchSponsoredBootstrapRedeem runs faucet grants through the faucet service and stores a receipt on success', async () => {
  const { env, deletes } = createKvEnv({
    type: 'faucet-tx',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
      faucet: { amountEth: '0.0002' },
    },
    faucetPrivateKey: '0xfaucet',
  });
  const faucetCalls = [];

  const result = await dispatchSponsoredBootstrapRedeem({
    request: {
      headers: new Headers({ Origin: 'https://allowed.example.test' }),
      json: async () => ({
        faucetGrantToken: 'faucet-grant-1',
        to: '0x1111111111111111111111111111111111111111',
      }),
    },
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'faucet',
    deps: createDeployDeps({
      json: createJsonStub(),
      getCorsContext: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
      }),
      faucet: async (value) => {
        faucetCalls.push(value);
        return new Response(JSON.stringify({ txHash: '0xfaucet123' }), {
          status: 200,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        });
      },
    }),
  });

  assert.deepEqual(faucetCalls, [{
    payload: {
      action: 'request_test_eth',
      to: '0x1111111111111111111111111111111111111111',
    },
    secrets: {
      faucetPrivateKey: '0xfaucet',
    },
    config: {
      allowOrigins: ['https://allowed.example.test'],
      faucet: { amountEth: '0.0002' },
    },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    slug: 'source-session',
    requesterAddress: '0x1111111111111111111111111111111111111111',
    tokenHasFaucetScope: true,
  }]);
  assert.deepEqual(deletes, []);
  assert.deepEqual(result, {
    body: { txHash: '0xfaucet123' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchSponsoredBootstrapRedeem replays a lost faucet success without sending a second transaction', async () => {
  const { env, store } = createKvEnv({
    type: 'faucet-tx',
    sourceSessionSlug: 'source-session',
    sourceConfig: { allowOrigins: ['https://allowed.example.test'] },
    faucetPrivateKey: '0xfaucet-private',
  });
  const normalPut = env.GROUP_KV.put.bind(env.GROUP_KV);
  let loseReceiptWriteResponse = true;
  env.GROUP_KV.put = async (key, value, options) => {
    await normalPut(key, value, options);
    if (JSON.parse(value)?.state === 'redeemed' && loseReceiptWriteResponse) {
      loseReceiptWriteResponse = false;
      throw new TypeError('faucet receipt response lost');
    }
  };
  let faucetCalls = 0;
  const deps = createDeployDeps({
    json: createJsonStub(),
    getCorsContext: async () => ({
      ok: true,
      headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    }),
    faucet: async () => {
      faucetCalls += 1;
      return new Response(JSON.stringify({
        txHash: '0xfaucet456',
        to: '0x1111111111111111111111111111111111111111',
        amountEth: '0.0002',
        chainId: 11155420,
        rpcUrl: 'https://rpc.example.test/provider-secret-key',
      }), { status: 200 });
    },
  });
  const requestBody = {
    faucetGrantToken: 'faucet-grant-2',
    to: '0x1111111111111111111111111111111111111111',
  };

  const first = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  assert.equal(first.status, 200);
  const replay = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.txHash, '0xfaucet456');
  assert.equal(faucetCalls, 1);
  assert.doesNotMatch([...store.values()][0], /0xfaucet-private|provider-secret-key/);

  const changed = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      ...requestBody,
      to: '0x2222222222222222222222222222222222222222',
    }),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  assert.equal(changed.status, 409);
  assert.equal(faucetCalls, 1);
});

test('dispatchSponsoredBootstrapRedeem replays the DO receipt when KV receipt compaction does not commit', async () => {
  const { env, store } = createKvEnv({
    type: 'faucet-tx',
    sourceSessionSlug: 'source-session',
    sourceConfig: { allowOrigins: ['https://allowed.example.test'] },
    faucetPrivateKey: '0xfaucet-private',
  });
  const normalPut = env.GROUP_KV.put.bind(env.GROUP_KV);
  env.GROUP_KV.put = async (key, value, options) => {
    const parsed = JSON.parse(value);
    if (parsed?.state === 'redeemed') {
      throw new TypeError('faucet receipt did not commit');
    }
    await normalPut(key, value, options);
  };
  let faucetCalls = 0;
  const deps = createDeployDeps({
    json: createJsonStub(),
    getCorsContext: async () => ({
      ok: true,
      headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    }),
    faucet: async () => {
      faucetCalls += 1;
      return new Response(JSON.stringify({ txHash: '0xfaucet789' }), { status: 200 });
    },
  });
  const requestBody = {
    faucetGrantToken: 'faucet-grant-3',
    to: '0x1111111111111111111111111111111111111111',
  };

  const first = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.txHash, '0xfaucet789');
  assert.equal(JSON.parse([...store.values()][0]).state, undefined);

  const retry = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.txHash, '0xfaucet789');
  assert.equal(faucetCalls, 1);

  const changed = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      ...requestBody,
      to: '0x2222222222222222222222222222222222222222',
    }),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  assert.equal(changed.status, 409);
  assert.equal(faucetCalls, 1);
});

test('dispatchSponsoredBootstrapRedeem permits exactly one faucet call under concurrent redemption', async () => {
  const { env, store } = createKvEnv({
    type: 'faucet-tx',
    sourceSessionSlug: 'source-session',
    sourceConfig: { allowOrigins: ['https://allowed.example.test'] },
    faucetPrivateKey: '0xfaucet-concurrency-private',
  });
  let faucetCalls = 0;
  let releaseFaucet;
  let markFaucetStarted;
  const faucetStarted = new Promise((resolve) => { markFaucetStarted = resolve; });
  const faucetBlocked = new Promise((resolve) => { releaseFaucet = resolve; });
  const deps = createDeployDeps({
    faucet: async () => {
      faucetCalls += 1;
      markFaucetStarted();
      await faucetBlocked;
      return new Response(JSON.stringify({ txHash: '0xconcurrent-faucet' }), { status: 200 });
    },
  });
  const requestBody = {
    faucetGrantToken: 'faucet-concurrent-grant',
    to: '0x1111111111111111111111111111111111111111',
  };

  const firstPromise = dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  await faucetStarted;

  const concurrent = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  assert.equal(concurrent.status, 503);
  assert.match(concurrent.body.error, /pending.*will not be repeated/i);
  assert.equal(faucetCalls, 1);

  releaseFaucet();
  const first = await firstPromise;
  assert.equal(first.status, 200);
  assert.equal(first.body.txHash, '0xconcurrent-faucet');

  const replay = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.txHash, '0xconcurrent-faucet');
  assert.equal(faucetCalls, 1);
  assert.doesNotMatch(JSON.stringify([...store.values()]), /0xfaucet-concurrency-private/);
  assert.doesNotMatch(
    JSON.stringify([...env.__testFaucetCoordinator.values()]),
    /0xfaucet-concurrency-private/,
  );
});

test('dispatchSponsoredBootstrapRedeem redacts faucet exceptions and terminally replays the generic failure', async () => {
  const privateKey = '0xfaucet-exception-private';
  const providerCredential = 'provider-rpc-secret';
  const { env, store } = createKvEnv({
    type: 'faucet-tx',
    sourceSessionSlug: 'source-session',
    sourceConfig: { allowOrigins: ['https://allowed.example.test'] },
    faucetPrivateKey: privateKey,
  });
  let faucetCalls = 0;
  const deps = createDeployDeps({
    faucet: async () => {
      faucetCalls += 1;
      throw new Error(`RPC rejected signer ${privateKey} at https://rpc.example/${providerCredential}`);
    },
  });
  const requestBody = {
    faucetGrantToken: 'faucet-exception-grant',
    to: '0x1111111111111111111111111111111111111111',
  };

  const first = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  assert.equal(first.status, 502);
  assert.equal(
    first.body.error,
    'Sponsored faucet redemption was interrupted; transfer status is unknown and it will not be repeated.',
  );

  const replay = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  assert.deepEqual(replay.body, first.body);
  assert.equal(replay.status, 502);
  assert.equal(faucetCalls, 1);

  const persisted = JSON.stringify([
    ...store.values(),
    ...env.__testFaucetCoordinator.values(),
  ]);
  assert.doesNotMatch(persisted, new RegExp(privateKey));
  assert.doesNotMatch(persisted, new RegExp(providerCredential));
});

test('dispatchSponsoredBootstrapRedeem redacts secret-bearing faucet error responses before durable replay', async () => {
  const privateKey = '0xfaucet-response-private';
  const rpcUrl = 'https://rpc.example.test/provider-response-secret';
  const { env, store } = createKvEnv({
    type: 'faucet-tx',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
      faucet: { rpcUrl },
    },
    faucetPrivateKey: privateKey,
  });
  let faucetCalls = 0;
  const deps = createDeployDeps({
    faucet: async () => {
      faucetCalls += 1;
      return new Response(JSON.stringify({
        error: `RPC ${rpcUrl} rejected signer ${privateKey}`,
        privateKey,
        rpcUrl,
      }), { status: 502 });
    },
  });
  const requestBody = {
    faucetGrantToken: 'faucet-response-error-grant',
    to: '0x1111111111111111111111111111111111111111',
  };

  const first = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });
  const replay = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest(requestBody),
    env,
    baseHeaders: {},
    action: 'faucet',
    deps,
  });

  assert.equal(first.status, 502);
  assert.deepEqual(replay, first);
  assert.equal(faucetCalls, 1);
  const exposed = JSON.stringify([first, replay]);
  const persisted = JSON.stringify([
    ...store.values(),
    ...env.__testFaucetCoordinator.values(),
  ]);
  assert.doesNotMatch(exposed, new RegExp(privateKey));
  assert.doesNotMatch(exposed, new RegExp(rpcUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(persisted, new RegExp(privateKey));
  assert.doesNotMatch(persisted, /provider-response-secret/);
});
