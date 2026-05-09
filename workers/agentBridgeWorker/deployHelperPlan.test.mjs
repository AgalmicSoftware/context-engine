import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS,
  buildAgentBridgeDeployPlan,
  buildAgentBridgeWorkerUploadMetadata,
  resolveAgentBridgeDeployConfig,
  validateAgentBridgeDeployConfig,
  validateAgentBridgeTokenScope,
} from './deployHelperPlan.mjs';

function completeEnv(overrides = {}) {
  return {
    CLOUDFLARE_API_TOKEN: 'cf-test-token',
    CLOUDFLARE_ACCOUNT_ID: 'account-123',
    CLOUDFLARE_WORKERS_SUBDOMAIN: 'tenant-subdomain',
    TELEGRAM_BOT_TOKEN: '123456:test-token',
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
    DEMO_SIGNER_ROOT_SECRET: 'demo-root',
    CE_SESSION_WORKER_BASE_URL: 'https://session-worker.tenant-subdomain.workers.dev',
    DEFAULT_CHAIN_ID: '11155420',
    DEFAULT_RPC_URL: 'https://rpc.example.test',
    ...overrides,
  };
}

test('resolveAgentBridgeDeployConfig builds the default workers.dev public URL and redacts secrets', () => {
  const config = resolveAgentBridgeDeployConfig({
    env: completeEnv(),
  });

  assert.equal(config.workerName, 'ce-agent-bridge-worker');
  assert.equal(config.vars.AGENT_BRIDGE_PUBLIC_URL, 'https://ce-agent-bridge-worker.tenant-subdomain.workers.dev');
  assert.equal(config.vars.CE_SESSION_WORKER_BASE_URL, 'https://session-worker.tenant-subdomain.workers.dev');
  assert.equal(config.secrets.TELEGRAM_BOT_TOKEN, '[set]');
  assert.equal(config.secrets.TELEGRAM_WEBHOOK_SECRET, '[set]');
  assert.equal(config.secrets.DEMO_SIGNER_ROOT_SECRET, '[set]');
  assert.equal(JSON.stringify(config).includes('123456:test-token'), false);
  assert.equal(JSON.stringify(config).includes('webhook-secret'), false);
  assert.equal(JSON.stringify(config).includes('demo-root'), false);
});

test('validateAgentBridgeDeployConfig requires only live deploy credentials, not unit-test credentials', () => {
  const missing = validateAgentBridgeDeployConfig(resolveAgentBridgeDeployConfig({
    env: {},
  }));
  const complete = validateAgentBridgeDeployConfig(resolveAgentBridgeDeployConfig({
    env: completeEnv(),
  }));

  assert.equal(missing.ok, false);
  assert.equal(missing.missing.includes('TELEGRAM_BOT_TOKEN'), true);
  assert.equal(missing.missing.includes('DEFAULT_RPC_URL'), true);
  assert.equal(complete.ok, true);
  assert.deepEqual(complete.missing, []);
});

test('validateAgentBridgeTokenScope treats Account Settings: Edit as workers.dev setup only', () => {
  const base = validateAgentBridgeTokenScope({
    permissions: AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS,
  });
  const needsWorkersDevSetup = validateAgentBridgeTokenScope({
    permissions: AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS,
    includeWorkersDevSubdomainSetup: true,
  });
  const withWorkersDevSetup = validateAgentBridgeTokenScope({
    permissions: [
      ...AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS,
      { key: 'account_settings', type: 'edit' },
    ],
    includeWorkersDevSubdomainSetup: true,
  });

  assert.equal(base.ok, true);
  assert.equal(base.accountSettingsEditRequired, false);
  assert.equal(needsWorkersDevSetup.ok, false);
  assert.deepEqual(needsWorkersDevSetup.optionalMissing, [
    { key: 'account_settings', type: 'edit' },
  ]);
  assert.equal(withWorkersDevSetup.ok, true);
});

test('buildAgentBridgeWorkerUploadMetadata models bindings, vars, and Durable Object migration', () => {
  const config = resolveAgentBridgeDeployConfig({
    env: completeEnv(),
  });
  const metadata = buildAgentBridgeWorkerUploadMetadata(config);

  assert.equal(metadata.main_module, 'worker.mjs');
  assert.equal(metadata.compatibility_date, '2024-09-02');
  assert.equal(metadata.bindings.some((binding) => binding.name === 'AGENT_ACTION_KV' && binding.type === 'kv_namespace'), true);
  assert.equal(metadata.bindings.some((binding) => binding.name === 'AGENT_DOCS_R2' && binding.type === 'r2_bucket'), true);
  assert.equal(metadata.bindings.some((binding) => binding.name === 'AGENT_DOCS_D1' && binding.type === 'd1'), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'MANAGED_DEMO_SIGNER' &&
    binding.type === 'durable_object_namespace' &&
    binding.class_name === 'ManagedDemoSignerDurableObject'
  )), true);
  assert.deepEqual(metadata.migrations, [{
    tag: 'v1',
    new_classes: ['ManagedDemoSignerDurableObject'],
  }]);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_PUBLIC_URL' &&
    binding.text === 'https://ce-agent-bridge-worker.tenant-subdomain.workers.dev'
  )), true);
});

test('buildAgentBridgeDeployPlan documents remaining direct Cloudflare API calls without secret values', () => {
  const config = resolveAgentBridgeDeployConfig({
    env: completeEnv(),
    flags: { 'include-workers-dev-subdomain-setup': true },
  });
  const plan = buildAgentBridgeDeployPlan(config);

  assert.equal(plan.publicUrl, 'https://ce-agent-bridge-worker.tenant-subdomain.workers.dev');
  assert.equal(plan.webhookUrl, 'https://ce-agent-bridge-worker.tenant-subdomain.workers.dev/telegram/webhook');
  assert.equal(plan.remainingDirectApiCalls.some((call) => call.path.includes('/storage/kv/namespaces')), true);
  assert.equal(plan.remainingDirectApiCalls.some((call) => call.path.includes('/r2/buckets')), true);
  assert.equal(plan.remainingDirectApiCalls.some((call) => call.path.includes('/d1/database')), true);
  assert.equal(plan.remainingDirectApiCalls.some((call) => call.path.includes('/workers/scripts/ce-agent-bridge-worker/secrets')), true);
  assert.equal(plan.optionalTokenPermissions.length, 1);
  assert.equal(JSON.stringify(plan).includes('123456:test-token'), false);
  assert.equal(JSON.stringify(plan).includes('webhook-secret'), false);
  assert.equal(JSON.stringify(plan).includes('demo-root'), false);
});
