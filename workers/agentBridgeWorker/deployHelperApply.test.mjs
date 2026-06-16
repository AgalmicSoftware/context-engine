import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bundleAgentBridgeWorkerModule,
  buildAgentBridgeWorkerUploadForm,
  collectAgentBridgeWorkerModules,
  executeAgentBridgeDeployApply,
  parseAgentBridgeEnvText,
  verifyAgentBridgeHealth,
  writeAgentBridgeWorkerSecrets,
} from './deployHelperApply.mjs';

function completeEnv(overrides = {}) {
  return {
    CLOUDFLARE_API_TOKEN: 'cf-test-token',
    CLOUDFLARE_ACCOUNT_ID: 'account-123',
    CLOUDFLARE_WORKERS_SUBDOMAIN: 'tenant-subdomain',
    TELEGRAM_BOT_TOKEN: '123456:test-token',
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
    DEMO_SIGNER_ROOT_SECRET: 'demo-root-secret',
    AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-api-token',
    CE_SESSION_WORKER_BASE_URL: 'https://session-worker.tenant-subdomain.workers.dev',
    DEFAULT_CHAIN_ID: '11155420',
    DEFAULT_RPC_URL: 'https://rpc.example.test',
    ...overrides,
  };
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('parseAgentBridgeEnvText treats template placeholders as literal values', () => {
  const parsed = parseAgentBridgeEnvText([
    'AGENT_BRIDGE_PUBLIC_URL=https://ce-agent-bridge-worker.<workers-subdomain>.workers.dev',
    'CE_SESSION_WORKER_BASE_URL=https://<session-worker>.<workers-subdomain>.workers.dev',
    'QUOTED_VALUE="value # not comment"',
    'JSON_VALUE="{\\"defaultSessionSlug\\":\\"telegram-demo-4\\"}"',
    'PLAIN_VALUE=value # comment',
  ].join('\n'));

  assert.equal(parsed.AGENT_BRIDGE_PUBLIC_URL, 'https://ce-agent-bridge-worker.<workers-subdomain>.workers.dev');
  assert.equal(parsed.CE_SESSION_WORKER_BASE_URL, 'https://<session-worker>.<workers-subdomain>.workers.dev');
  assert.equal(parsed.QUOTED_VALUE, 'value # not comment');
  assert.deepEqual(JSON.parse(parsed.JSON_VALUE), { defaultSessionSlug: 'telegram-demo-4' });
  assert.equal(parsed.PLAIN_VALUE, 'value');
});

test('deploy apply dry-run performs no Cloudflare or Telegram calls', async () => {
  const calls = [];
  const exportAdmin = `0x${'ab'.repeat(20)}`;
  const result = await executeAgentBridgeDeployApply({
    env: completeEnv({
      AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: exportAdmin,
    }),
    fetchImpl: async (...args) => {
      calls.push(args);
      throw new Error('dry-run must not fetch');
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.nextCommand, 'npm run deploy:apply -- --apply');
  assert.equal(calls.length, 0);
  assert.equal(JSON.stringify(result).includes('123456:test-token'), false);
  assert.equal(JSON.stringify(result).includes('webhook-secret'), false);
  assert.equal(JSON.stringify(result).includes('demo-root-secret'), false);
  const uploadCall = result.plan.remainingDirectApiCalls.find((call) => call.purpose.includes('Upload agentBridgeWorker module'));
  const bindings = uploadCall.multipartMetadata.bindings;
  assert.equal(bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES' && binding.text === exportAdmin
  )), true);
});

test('deploy apply validation rejects placeholder session worker URLs before mutation', async () => {
  const result = await executeAgentBridgeDeployApply({
    flags: { apply: true },
    env: completeEnv({
      CE_SESSION_WORKER_BASE_URL: 'https://<session-worker>.<workers-subdomain>.workers.dev',
    }),
    fetchImpl: async () => {
      throw new Error('validation should fail before fetch');
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'deploy:apply validation failed before making resource changes');
  assert.equal(result.validation.missing.some((entry) => entry.includes('CE_SESSION_WORKER_BASE_URL')), true);
});

test('writeAgentBridgeWorkerSecrets stores optional bridge secrets when present', async () => {
  const written = [];
  const result = await writeAgentBridgeWorkerSecrets({
    apiToken: 'cf-token',
    accountId: 'account-123',
    workerName: 'ce-agent-bridge-worker',
    env: completeEnv({
      OPENAI_API_KEY: 'sk-bridge-openai',
    }),
    fetchImpl: async (url, init = {}) => {
      written.push(JSON.parse(init.body || '{}'));
      return jsonResponse({ success: true, result: {} });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.written.includes('AGENT_BRIDGE_OPENAI_API_KEY'), true);
  assert.equal(written.find((entry) => entry.name === 'AGENT_BRIDGE_OPENAI_API_KEY')?.text, 'sk-bridge-openai');
});

test('verifyAgentBridgeHealth returns structured network failures', async () => {
  const result = await verifyAgentBridgeHealth({
    publicUrl: 'https://bridge.example',
    fetchImpl: async () => {
      throw new Error('fetch failed');
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.step, 'health_check');
  assert.equal(result.status, 502);
  assert.match(result.error, /fetch failed/);
});

test('collectAgentBridgeWorkerModules includes the worker entrypoint and transitive local modules', () => {
  const modules = collectAgentBridgeWorkerModules();
  const names = modules.map((module) => module.name);

  assert.equal(names.includes('worker.js'), true);
  assert.equal(names.includes('telegramCommands.mjs'), true);
  assert.equal(names.includes('durableObjectSigner.mjs'), true);
  assert.equal(modules.every((module) => module.source.length > 0), true);
});

test('bundleAgentBridgeWorkerModule folds package imports into one upload module', () => {
  const bundle = bundleAgentBridgeWorkerModule();

  assert.equal(bundle.name, 'worker.js');
  assert.equal(bundle.contentType, 'application/javascript+module');
  assert.match(bundle.source, /submitResponses/);
  assert.equal(/from\s+['"]ethers['"]/.test(bundle.source), false);
  assert.equal(bundle.source.includes("from './onChainResponses.mjs'"), false);
});

test('buildAgentBridgeWorkerUploadForm can omit migrations for already-migrated Durable Objects', () => {
  const firstUpload = buildAgentBridgeWorkerUploadForm({
    config: {
      resources: {
        durableObjectBinding: 'MANAGED_DEMO_SIGNER',
        durableObjectClassName: 'ManagedDemoSignerDurableObject',
      },
      vars: {},
    },
    resourceIds: { kvNamespaceId: 'kv-id' },
  });
  const retryUpload = buildAgentBridgeWorkerUploadForm({
    config: {
      resources: {
        durableObjectBinding: 'MANAGED_DEMO_SIGNER',
        durableObjectClassName: 'ManagedDemoSignerDurableObject',
      },
      vars: {},
    },
    resourceIds: { kvNamespaceId: 'kv-id' },
    omitMigrations: true,
  });

  assert.equal(firstUpload.metadata.migrations.new_tag, 'v1');
  assert.equal(firstUpload.metadata.migrations.old_tag, '');
  assert.equal(Array.isArray(firstUpload.metadata.migrations), false);
  assert.equal(Object.hasOwn(retryUpload.metadata, 'migrations'), false);
});

test('deploy apply creates smoke resources without requiring R2/D1, uploads modules, writes secrets, sets webhook, and checks health', async () => {
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ url: String(url), method, options });
    if (String(url).endsWith('/accounts?per_page=2')) {
      return jsonResponse({ success: true, result: [{ id: 'account-derived', name: 'Derived' }] });
    }
    if (String(url).endsWith('/accounts/account-derived/workers/subdomain') && method === 'GET') {
      return jsonResponse({ success: true, result: { subdomain: 'tenant-subdomain', status: 'active' } });
    }
    if (String(url).endsWith('/storage/kv/namespaces?per_page=100')) {
      return jsonResponse({ success: true, result: [] });
    }
    if (String(url).endsWith('/storage/kv/namespaces') && method === 'POST') {
      return jsonResponse({ success: true, result: { id: 'kv-created' } });
    }
    if (String(url).endsWith('/workers/scripts/ce-agent-bridge-worker') && method === 'PUT') {
      return jsonResponse({ success: true, result: { id: 'script-created' } });
    }
    if (String(url).endsWith('/workers/scripts/ce-agent-bridge-worker/secrets') && method === 'PUT') {
      return jsonResponse({ success: true, result: { name: 'secret' } });
    }
    if (String(url).endsWith('/workers/scripts/ce-agent-bridge-worker/subdomain') && method === 'POST') {
      return jsonResponse({ success: true, result: { enabled: true } });
    }
    if (String(url).startsWith('https://api.telegram.org/bot123456:test-token/setWebhook')) {
      return jsonResponse({ ok: true, result: true, description: 'Webhook was set' });
    }
    if (String(url).startsWith('https://api.telegram.org/bot123456:test-token/setMyName')) {
      const body = JSON.parse(options.body || '{}');
      assert.equal(body.name, 'Context Engine');
      return jsonResponse({ ok: true, result: true, description: 'Name was set' });
    }
    if (String(url).startsWith('https://api.telegram.org/bot123456:test-token/setMyCommands')) {
      const body = JSON.parse(options.body || '{}');
      assert.equal(body.commands.some((command) => command.command === 'sessions'), true);
      assert.equal(body.commands.some((command) => command.command === 'questions' && command.description === 'Questions'), true);
      assert.equal(body.commands.some((command) => command.command === 'results' && command.description === 'Results'), true);
      assert.equal(body.commands.some((command) => command.command === 'groups'), true);
      assert.equal(body.commands.some((command) => command.command === 'add_question'), true);
      assert.equal(body.commands.some((command) => command.command === 'me' && command.description === 'View account / get agent token'), true);
      assert.equal(body.commands.some((command) => command.command === 'attachments'), false);
      assert.equal(body.commands.some((command) => command.command === 'docs'), false);
      assert.equal(body.commands.some((command) => command.command === 'q'), false);
      assert.equal(body.commands.some((command) => command.command === 'actions'), false);
      assert.equal(body.commands.some((command) => command.command === 'settings'), false);
      assert.equal(body.commands.some((command) => command.command === 'join'), false);
      assert.equal(body.commands.some((command) => command.command.startsWith('ce_')), false);
      return jsonResponse({ ok: true, result: true, description: 'Commands were set' });
    }
    if (String(url) === 'https://ce-agent-bridge-worker.tenant-subdomain.workers.dev/health') {
      return jsonResponse({ ok: true, worker: 'agentBridgeWorker', version: 'test-version' });
    }
    throw new Error(`Unexpected fetch ${method} ${url}`);
  };

  const result = await executeAgentBridgeDeployApply({
    flags: { apply: true },
    env: completeEnv({
      CLOUDFLARE_ACCOUNT_ID: '',
      CLOUDFLARE_WORKERS_SUBDOMAIN: '',
      AGENT_BRIDGE_PUBLIC_URL: '',
    }),
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, false);
  assert.equal(result.accountId, 'account-derived');
  assert.equal(result.publicUrl, 'https://ce-agent-bridge-worker.tenant-subdomain.workers.dev');
  assert.equal(result.webhookUrl, 'https://ce-agent-bridge-worker.tenant-subdomain.workers.dev/telegram/webhook');
  assert.equal(result.resources.docStorageEnabled, false);
  assert.equal(result.resources.kvNamespaceId, 'kv-created');
  assert.equal(result.resources.r2Skipped, true);
  assert.equal(result.resources.d1Skipped, true);
  assert.equal(result.upload.mainModule, 'worker.js');
  assert.equal(result.secrets.written.length, 4);
  assert.equal(result.health.version, 'test-version');
  assert.equal(calls.some((call) => call.url.endsWith('/workers/scripts/ce-agent-bridge-worker')), true);
  assert.equal(calls.some((call) => call.url.includes('/r2/buckets')), false);
  assert.equal(calls.some((call) => call.url.includes('/d1/database')), false);
  assert.equal(calls.filter((call) => call.url.endsWith('/workers/scripts/ce-agent-bridge-worker/secrets')).length, 4);
  assert.equal(calls.some((call) => call.url.startsWith('https://api.telegram.org/bot123456:test-token/setWebhook')), true);
  assert.equal(calls.some((call) => call.url.startsWith('https://api.telegram.org/bot123456:test-token/setMyName')), true);
  assert.equal(calls.some((call) => call.url.startsWith('https://api.telegram.org/bot123456:test-token/setMyCommands')), true);
  assert.equal(result.telegram.name.name, 'Context Engine');
  assert.equal(result.telegram.commands.count > 0, true);
  assert.equal(result.telegram.commands.commands.includes('sessions'), true);
  assert.equal(result.telegram.commands.commands.includes('groups'), true);
  assert.equal(result.telegram.commands.commands.includes('add_question'), true);
  assert.equal(result.telegram.commands.commands.includes('attachments'), false);
  assert.equal(result.telegram.commands.commands.includes('docs'), false);
  assert.equal(result.telegram.commands.commands.includes('q'), false);
  assert.equal(result.telegram.commands.commands.includes('actions'), false);
  assert.equal(result.telegram.commands.commands.includes('settings'), false);
  assert.equal(result.telegram.commands.commands.includes('join'), false);
  assert.equal(JSON.stringify(result).includes('123456:test-token'), false);
  assert.equal(JSON.stringify(result).includes('webhook-secret'), false);
  assert.equal(JSON.stringify(result).includes('demo-root-secret'), false);
});

test('deploy apply retries worker upload without migrations after migration tag precondition failure', async () => {
  const workerUploadCalls = [];
  const fetchMock = async (url, options = {}) => {
    const method = options.method || 'GET';
    if (String(url).endsWith('/storage/kv/namespaces?per_page=100')) {
      return jsonResponse({ success: true, result: [{ id: 'kv-existing', title: 'ContextEngineAgentBridgeActions:ce-agent-bridge-worker' }] });
    }
    if (String(url).endsWith('/workers/scripts/ce-agent-bridge-worker') && method === 'PUT') {
      workerUploadCalls.push(options.body);
      if (workerUploadCalls.length === 1) {
        return jsonResponse({
          success: false,
          errors: [{ code: 10079, message: "Actor migration tag precondition failed, got tag 'v1' when expected tag ''." }],
        }, { status: 412 });
      }
      return jsonResponse({ success: true, result: { id: 'script-created' } });
    }
    if (String(url).endsWith('/workers/scripts/ce-agent-bridge-worker/secrets') && method === 'PUT') {
      return jsonResponse({ success: true, result: { name: 'secret' } });
    }
    if (String(url).endsWith('/accounts/account-123/workers/subdomain') && method === 'GET') {
      return jsonResponse({ success: true, result: { subdomain: 'tenant-subdomain', status: 'active' } });
    }
    if (String(url).endsWith('/workers/scripts/ce-agent-bridge-worker/subdomain') && method === 'POST') {
      return jsonResponse({ success: true, result: { enabled: true } });
    }
    throw new Error(`Unexpected fetch ${method} ${url}`);
  };

  const result = await executeAgentBridgeDeployApply({
    flags: { apply: true, 'skip-telegram-webhook': true, 'skip-health-check': true },
    env: completeEnv(),
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, true);
  assert.equal(result.upload.migrationRetry, 'omitted_existing_migration');
  assert.equal(workerUploadCalls.length, 2);
});

test('deploy apply provisions R2/D1 only when doc storage is explicitly enabled', async () => {
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ url: String(url), method });
    if (String(url).endsWith('/storage/kv/namespaces?per_page=100')) {
      return jsonResponse({ success: true, result: [{ id: 'kv-existing', title: 'ContextEngineAgentBridgeActions:ce-agent-bridge-worker' }] });
    }
    if (String(url).endsWith('/accounts/account-123/workers/subdomain') && method === 'GET') {
      return jsonResponse({ success: true, result: { subdomain: 'tenant-subdomain', status: 'active' } });
    }
    if (String(url).endsWith('/r2/buckets') && method === 'GET') {
      return jsonResponse({ success: true, result: { buckets: [] } });
    }
    if (String(url).endsWith('/r2/buckets') && method === 'POST') {
      return jsonResponse({ success: true, result: { name: 'ce-agent-bridge-worker-demo-artifacts' } });
    }
    if (String(url).includes('/d1/database?') && method === 'GET') {
      return jsonResponse({ success: true, result: [] });
    }
    if (String(url).endsWith('/d1/database') && method === 'POST') {
      return jsonResponse({ success: true, result: { uuid: 'd1-created' } });
    }
    if (String(url).endsWith('/workers/scripts/ce-agent-bridge-worker') && method === 'PUT') {
      return jsonResponse({ success: true, result: { id: 'script-created' } });
    }
    if (String(url).endsWith('/workers/scripts/ce-agent-bridge-worker/secrets') && method === 'PUT') {
      return jsonResponse({ success: true, result: { name: 'secret' } });
    }
    if (String(url).endsWith('/workers/scripts/ce-agent-bridge-worker/subdomain') && method === 'POST') {
      return jsonResponse({ success: true, result: { enabled: true } });
    }
    if (String(url) === 'https://ce-agent-bridge-worker.tenant-subdomain.workers.dev/health') {
      return jsonResponse({ ok: true, worker: 'agentBridgeWorker', version: 'test-version' });
    }
    throw new Error(`Unexpected fetch ${method} ${url}`);
  };

  const result = await executeAgentBridgeDeployApply({
    flags: { apply: true, 'skip-telegram-webhook': true },
    env: completeEnv({ AGENT_BRIDGE_ENABLE_DOC_STORAGE: 'true' }),
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, true);
  assert.equal(result.resources.docStorageEnabled, true);
  assert.equal(result.resources.r2BucketName, 'ce-agent-bridge-worker-demo-artifacts');
  assert.equal(result.resources.d1DatabaseId, 'd1-created');
  assert.equal(calls.some((call) => call.url.includes('/r2/buckets')), true);
  assert.equal(calls.some((call) => call.url.includes('/d1/database')), true);
});
