import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS,
  AGENT_BRIDGE_DOC_STORAGE_CLOUDFLARE_TOKEN_PERMISSIONS,
  buildAgentBridgeDeployPlan,
  buildAgentBridgeGeneratedSecrets,
  buildAgentBridgeWorkerUploadMetadata,
  deriveSingleCloudflareAccount,
  generateAgentBridgeSecret,
  resolveAgentBridgeDeployConfig,
  resolveAgentBridgeDeployConfigForLive,
  validateAgentBridgeDeployConfig,
  validateAgentBridgeTokenScope,
} from './deployHelperPlan.mjs';

function completeEnv(overrides = {}) {
  const sessionWorkerOrigin = overrides.CE_SESSION_WORKER_BASE_URL || 'https://session-worker.tenant-subdomain.workers.dev';
  return {
    CLOUDFLARE_API_TOKEN: 'cf-test-token',
    CLOUDFLARE_ACCOUNT_ID: 'account-123',
    CLOUDFLARE_WORKERS_SUBDOMAIN: 'tenant-subdomain',
    TELEGRAM_BRIDGE_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: '123456:test-token',
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
    DEMO_SIGNER_ROOT_SECRET: 'demo-root',
    AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-api-token',
    CE_SESSION_WORKER_BASE_URL: sessionWorkerOrigin,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      version: 1,
      defaultSessionSlug: 'wrapped-alpha',
      sessions: [{
        sessionSlug: 'wrapped-alpha',
        sessionIdHex: `0x${'12'.repeat(16)}`,
        sessionWorkerUrl: sessionWorkerOrigin,
        sessionModeProfile: {
          surfaces: { agentHttp: true, telegram: true },
          authority: { mode: 'worker_canonical' },
        },
      }],
    }),
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
  assert.equal(config.vars.BROADCAST_ENABLED, 'true');
  assert.equal(config.vars.AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED, 'true');
  assert.equal(config.vars.AGENT_BRIDGE_AUTO_FAUCET_ON_JOIN, 'true');
  assert.equal(config.secrets.TELEGRAM_BOT_TOKEN, '[set]');
  assert.equal(config.secrets.TELEGRAM_WEBHOOK_SECRET, '[set]');
  assert.equal(config.secrets.DEMO_SIGNER_ROOT_SECRET, '[set]');
  assert.equal(config.secrets.AGENT_BRIDGE_AGENT_API_TOKEN, '[set]');
  assert.equal(JSON.stringify(config).includes('123456:test-token'), false);
  assert.equal(JSON.stringify(config).includes('webhook-secret'), false);
  assert.equal(JSON.stringify(config).includes('demo-root'), false);
  assert.equal(JSON.stringify(config).includes('agent-api-token'), false);

  const staging = resolveAgentBridgeDeployConfig({
    flags: { 'worker-name': 'ce-agent-bridge-worker-staging' },
    env: completeEnv({
      AGENT_BRIDGE_AGENT_ONLY_TOKEN_TTL_SECONDS: '604800',
      AGENT_BRIDGE_AGENT_WRAPPED_STORY_DEFAULT: 'true',
      AGENT_BRIDGE_AGENT_WRAPPED_COMPASS_DEFAULT: 'true',
    }),
  });
  assert.equal(staging.workerName, 'ce-agent-bridge-worker-staging');
  assert.equal(staging.resources.actionKvTitle, 'ContextEngineAgentBridgeActions:ce-agent-bridge-worker-staging');
  assert.equal(staging.vars.AGENT_BRIDGE_AGENT_ONLY_TOKEN_TTL_SECONDS, '604800');
  assert.equal(staging.vars.AGENT_BRIDGE_AGENT_WRAPPED_STORY_DEFAULT, 'true');
  assert.equal(staging.vars.AGENT_BRIDGE_AGENT_WRAPPED_COMPASS_DEFAULT, 'true');
});

test('Wrapped poster OpenAI configuration is separately named and never inferred from another AI key', () => {
  const genericOnly = resolveAgentBridgeDeployConfig({
    env: completeEnv({
      AGENT_BRIDGE_OPENAI_API_KEY: 'sk-generic-bridge',
      OPENAI_API_KEY: 'sk-session-fallback',
    }),
  });
  assert.equal(genericOnly.secrets.AGENT_BRIDGE_OPENAI_API_KEY, '[set]');
  assert.equal(genericOnly.secrets.AGENT_BRIDGE_WRAPPED_POSTER_OPENAI_API_KEY, '[missing]');

  const posterConfigured = resolveAgentBridgeDeployConfig({
    env: completeEnv({
      AGENT_BRIDGE_WRAPPED_POSTER_OPENAI_API_KEY: 'sk-wrapped-poster',
    }),
  });
  assert.equal(posterConfigured.secrets.AGENT_BRIDGE_WRAPPED_POSTER_OPENAI_API_KEY, '[set]');
  assert.equal(JSON.stringify(posterConfigured).includes('sk-wrapped-poster'), false);
});

test('validateAgentBridgeDeployConfig requires only live deploy credentials, not unit-test credentials', () => {
  const missing = validateAgentBridgeDeployConfig(resolveAgentBridgeDeployConfig({
    env: {},
  }));
  const missingWorkersSubdomain = validateAgentBridgeDeployConfig(resolveAgentBridgeDeployConfig({
    env: completeEnv({ CLOUDFLARE_WORKERS_SUBDOMAIN: '' }),
  }));
  const completeWithoutManualAccountId = validateAgentBridgeDeployConfig(resolveAgentBridgeDeployConfig({
    env: completeEnv({ CLOUDFLARE_ACCOUNT_ID: '' }),
  }));

  assert.equal(missing.ok, false);
  assert.equal(missing.missing.includes('TELEGRAM_BOT_TOKEN'), false);
  assert.equal(missing.missing.includes('AGENT_BRIDGE_AGENT_API_TOKEN'), true);
  assert.equal(missing.missing.includes('DEFAULT_RPC_URL'), false);
  assert.equal(missing.missing.includes('CLOUDFLARE_ACCOUNT_ID'), false);
  assert.equal(missingWorkersSubdomain.ok, false);
  assert.equal(missingWorkersSubdomain.missing.includes('CLOUDFLARE_WORKERS_SUBDOMAIN'), true);
  assert.equal(completeWithoutManualAccountId.ok, true);
  assert.deepEqual(completeWithoutManualAccountId.missing, []);
});

test('Telegram-disabled deployment has no Telegram config, secrets, or plan actions', () => {
  const config = resolveAgentBridgeDeployConfig({
    env: completeEnv({
      TELEGRAM_BRIDGE_ENABLED: '',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_BOT_USERNAME: '',
      TELEGRAM_WEBHOOK_SECRET: '',
      AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER: '2026-05-20T00:00:00.000Z',
    }),
  });
  const validation = validateAgentBridgeDeployConfig(config);
  const plan = buildAgentBridgeDeployPlan(config);

  assert.equal(config.telegramEnabled, false);
  assert.equal(validation.ok, true);
  assert.deepEqual(Object.keys(config.vars).filter((name) => name.includes('TELEGRAM')), []);
  assert.deepEqual(Object.keys(config.secrets).filter((name) => name.includes('TELEGRAM')), []);
  assert.equal(plan.webhookUrl, null);
  assert.equal(JSON.stringify(plan).includes('TELEGRAM_'), false);
  assert.equal(JSON.stringify(plan).includes('api.telegram.org'), false);
});

test('dedicated deployment requires one explicit agentHttp session pinned to its Worker origin', () => {
  const valid = resolveAgentBridgeDeployConfig({ env: completeEnv() });
  const missingPolicy = resolveAgentBridgeDeployConfig({
    env: completeEnv({ AGENT_BRIDGE_SESSION_POLICY_JSON: '' }),
  });
  const multipleSessions = resolveAgentBridgeDeployConfig({
    env: completeEnv({
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'wrapped-alpha',
        sessions: [
          { sessionSlug: 'wrapped-alpha', sessionWorkerUrl: 'https://session-worker.tenant-subdomain.workers.dev', sessionModeProfile: { surfaces: { agentHttp: true } } },
          { sessionSlug: 'wrapped-beta', sessionWorkerUrl: 'https://session-worker.tenant-subdomain.workers.dev', sessionModeProfile: { surfaces: { agentHttp: true } } },
        ],
      }),
    }),
  });
  const mismatchedOrigin = resolveAgentBridgeDeployConfig({
    env: completeEnv({
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'wrapped-alpha',
        sessions: [{
          sessionSlug: 'wrapped-alpha',
          sessionWorkerUrl: 'https://caller-selected.example.test',
          sessionModeProfile: { surfaces: { agentHttp: true } },
        }],
      }),
    }),
  });
  const disabledAgentHttp = resolveAgentBridgeDeployConfig({
    env: completeEnv({
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'wrapped-alpha',
        sessions: [{
          sessionSlug: 'wrapped-alpha',
          sessionWorkerUrl: 'https://session-worker.tenant-subdomain.workers.dev',
          sessionModeProfile: { surfaces: { agentHttp: false } },
        }],
      }),
    }),
  });

  assert.equal(validateAgentBridgeDeployConfig(valid).ok, true);
  assert.deepEqual(valid.dedicatedSession, {
    sessionSlug: 'wrapped-alpha',
    sessionWorkerOrigin: 'https://session-worker.tenant-subdomain.workers.dev',
  });
  for (const config of [missingPolicy, multipleSessions, mismatchedOrigin, disabledAgentHttp]) {
    const validation = validateAgentBridgeDeployConfig(config);
    assert.equal(validation.ok, false);
    assert.equal(validation.missing.some((entry) => entry.includes('dedicated session policy')), true);
  }
});

test('validateAgentBridgeDeployConfig rejects local-only Telegram preview vars', () => {
  const base = resolveAgentBridgeDeployConfig({
    env: completeEnv(),
  });
  const telegramPreview = validateAgentBridgeDeployConfig({
    ...base,
    vars: {
      ...base.vars,
      AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    },
  });
  const previewAuth = validateAgentBridgeDeployConfig({
    ...base,
    vars: {
      ...base.vars,
      AGENT_BRIDGE_MINI_APP_ALLOW_PREVIEW_AUTH: '1',
    },
  });
  const disabledInitData = validateAgentBridgeDeployConfig({
    ...base,
    vars: {
      ...base.vars,
      AGENT_BRIDGE_MINI_APP_REQUIRE_INIT_DATA: 'false',
    },
  });

  assert.equal(telegramPreview.ok, false);
  assert.equal(telegramPreview.missing.includes('AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW is local-only and must not be deployed'), true);
  assert.equal(previewAuth.ok, false);
  assert.equal(previewAuth.missing.includes('AGENT_BRIDGE_MINI_APP_ALLOW_PREVIEW_AUTH is local-only and must not be deployed'), true);
  assert.equal(disabledInitData.ok, false);
  assert.equal(disabledInitData.missing.includes('AGENT_BRIDGE_MINI_APP_REQUIRE_INIT_DATA=false is local-only and must not be deployed'), true);
});

test('deriveSingleCloudflareAccount resolves one account and blocks multiple visible accounts', () => {
  assert.deepEqual(deriveSingleCloudflareAccount({
    result: [{ id: 'account-123', name: 'Demo Account' }],
  }), {
    ok: true,
    accountId: 'account-123',
    accountName: 'Demo Account',
    blocker: '',
    accountCount: 1,
  });

  const multiple = deriveSingleCloudflareAccount({
    result: [
      { id: 'account-123', name: 'One' },
      { id: 'account-456', name: 'Two' },
    ],
  });
  assert.equal(multiple.ok, false);
  assert.match(multiple.blocker, /multiple accounts/i);
  assert.match(multiple.blocker, /not implemented/i);
});

test('live account lookup is opt-in and derives one account without leaking token', async () => {
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({
      success: true,
      result: [{ id: 'account-derived', name: 'Derived Demo' }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const planOnlyConfig = await resolveAgentBridgeDeployConfigForLive({
    env: completeEnv({ CLOUDFLARE_ACCOUNT_ID: '' }),
    fetchImpl: fetchMock,
  });
  assert.equal(planOnlyConfig.accountId, '');
  assert.equal(planOnlyConfig.accountLookup.mode, 'derive_from_token_pending');
  assert.equal(calls.length, 0);

  const liveConfig = await resolveAgentBridgeDeployConfigForLive({
    env: completeEnv({ CLOUDFLARE_ACCOUNT_ID: '' }),
    flags: { 'live-account-lookup': true },
    fetchImpl: fetchMock,
  });
  assert.equal(liveConfig.accountId, 'account-derived');
  assert.equal(liveConfig.accountLookup.mode, 'derived_from_token');
  assert.equal(validateAgentBridgeDeployConfig(liveConfig).ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://api.cloudflare.com/client/v4/accounts?per_page=2');
  assert.equal(calls[0][1].headers.authorization, 'Bearer cf-test-token');
  assert.equal(JSON.stringify(liveConfig).includes('cf-test-token'), false);
});

test('live account lookup blocks multiple visible accounts without falling back silently', async () => {
  const fetchMock = async () => new Response(JSON.stringify({
    success: true,
    result: [
      { id: 'account-one', name: 'One' },
      { id: 'account-two', name: 'Two' },
    ],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

  const config = await resolveAgentBridgeDeployConfigForLive({
    env: completeEnv({ CLOUDFLARE_ACCOUNT_ID: '' }),
    flags: { 'live-account-lookup': true },
    fetchImpl: fetchMock,
  });
  const validation = validateAgentBridgeDeployConfig(config);

  assert.equal(config.accountId, '');
  assert.equal(config.accountLookup.mode, 'derive_from_token_failed');
  assert.equal(config.accountLookup.accountCount, 2);
  assert.match(config.accountLookup.blocker, /multiple accounts/i);
  assert.equal(validation.ok, false);
  assert.equal(validation.missing.some((entry) => entry.includes('CLOUDFLARE_ACCOUNT_ID derivation failed')), true);
});

test('generated secrets are high entropy hex values and never appear in deploy plans', () => {
  const fakeRandomBytes = (length) => Buffer.from(Array.from({ length }, (_, index) => (index + 7) % 256));
  const webhookSecret = generateAgentBridgeSecret({ randomBytesImpl: fakeRandomBytes });
  const generated = buildAgentBridgeGeneratedSecrets({ telegramEnabled: true, randomBytesImpl: fakeRandomBytes });
  const wrappedOnly = buildAgentBridgeGeneratedSecrets({ randomBytesImpl: fakeRandomBytes });
  const config = resolveAgentBridgeDeployConfig({
    env: completeEnv({
      TELEGRAM_WEBHOOK_SECRET: generated.TELEGRAM_WEBHOOK_SECRET,
      DEMO_SIGNER_ROOT_SECRET: generated.DEMO_SIGNER_ROOT_SECRET,
      AGENT_BRIDGE_AGENT_API_TOKEN: generated.AGENT_BRIDGE_AGENT_API_TOKEN,
    }),
  });
  const plan = buildAgentBridgeDeployPlan(config);
  const serialized = JSON.stringify(plan);

  assert.match(webhookSecret, /^[0-9a-f]{64}$/);
  assert.match(generated.TELEGRAM_WEBHOOK_SECRET, /^[0-9a-f]{64}$/);
  assert.match(generated.DEMO_SIGNER_ROOT_SECRET, /^[0-9a-f]{64}$/);
  assert.match(generated.AGENT_BRIDGE_AGENT_API_TOKEN, /^[0-9a-f]{64}$/);
  assert.equal(Object.hasOwn(wrappedOnly, 'TELEGRAM_WEBHOOK_SECRET'), false);
  assert.equal(serialized.includes(generated.TELEGRAM_WEBHOOK_SECRET), false);
  assert.equal(serialized.includes(generated.DEMO_SIGNER_ROOT_SECRET), false);
  assert.equal(serialized.includes(generated.AGENT_BRIDGE_AGENT_API_TOKEN), false);
});

test('validateAgentBridgeTokenScope treats Account Settings: Edit as workers.dev setup only', () => {
  const base = validateAgentBridgeTokenScope({
    permissions: AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS,
  });
  const needsDocStorage = validateAgentBridgeTokenScope({
    permissions: AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS,
    includeDocStorage: true,
  });
  const withDocStorage = validateAgentBridgeTokenScope({
    permissions: [
      ...AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS,
      ...AGENT_BRIDGE_DOC_STORAGE_CLOUDFLARE_TOKEN_PERMISSIONS,
    ],
    includeDocStorage: true,
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
  assert.deepEqual(AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS, [
    { key: 'workers_scripts', type: 'edit' },
    { key: 'workers_kv_storage', type: 'edit' },
  ]);
  assert.equal(base.accountSettingsEditRequired, false);
  assert.equal(needsDocStorage.ok, false);
  assert.deepEqual(needsDocStorage.missing, AGENT_BRIDGE_DOC_STORAGE_CLOUDFLARE_TOKEN_PERMISSIONS);
  assert.equal(withDocStorage.ok, true);
  assert.equal(needsWorkersDevSetup.ok, false);
  assert.deepEqual(needsWorkersDevSetup.optionalMissing, [
    { key: 'account_settings', type: 'edit' },
  ]);
  assert.equal(withWorkersDevSetup.ok, true);
});

test('buildAgentBridgeWorkerUploadMetadata defaults to KV plus atomic invite coordination', () => {
  const config = resolveAgentBridgeDeployConfig({
    env: completeEnv({ ADDITIONAL_RPC_URL: 'https://infura.example.test/op-sepolia' }),
  });
  const metadata = buildAgentBridgeWorkerUploadMetadata(config);

  assert.equal(metadata.main_module, 'worker.js');
  assert.equal(metadata.compatibility_date, '2024-09-02');
  assert.deepEqual(metadata.compatibility_flags, ['nodejs_compat', 'global_fetch_strictly_public']);
  assert.equal(metadata.bindings.some((binding) => binding.name === 'AGENT_ACTION_KV' && binding.type === 'kv_namespace'), true);
  assert.equal(metadata.bindings.some((binding) => binding.name === 'AGENT_DOCS_R2'), false);
  assert.equal(metadata.bindings.some((binding) => binding.name === 'AGENT_DOCS_D1'), false);
  assert.deepEqual(metadata.bindings.find((binding) => binding.type === 'durable_object_namespace'), {
    name: 'AGENT_INVITE_COORDINATOR',
    type: 'durable_object_namespace',
    class_name: 'AgentInviteRedemptionCoordinator',
  });
  assert.deepEqual(metadata.migrations, {
    old_tag: '',
    new_tag: 'agent-invite-redemption-v1',
    new_sqlite_classes: ['AgentInviteRedemptionCoordinator'],
  });
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_PUBLIC_URL' &&
    binding.text === 'https://ce-agent-bridge-worker.tenant-subdomain.workers.dev'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'ADDITIONAL_RPC_URL' &&
    binding.text === 'https://infura.example.test/op-sepolia'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'BROADCAST_ENABLED' &&
    binding.text === 'true'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED' &&
    binding.text === 'true'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_AUTO_FAUCET_ON_JOIN' &&
    binding.text === 'true'
  )), true);
  assert.equal(metadata.bindings.some((binding) => binding.name === 'AGENT_BRIDGE_DEMO_QUESTIONS_JSON'), false);
});

test('buildAgentBridgeWorkerUploadMetadata includes optional demo fixtures when configured', () => {
  const questions = '[{"questionId":"q-demo","prompt":"What should this group decide next?"}]';
  const docs = '[{"docId":"doc-public","title":"Public notes","visibility":"public"}]';
  const config = resolveAgentBridgeDeployConfig({
    env: completeEnv({
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: questions,
      AGENT_BRIDGE_DEMO_DOCS_JSON: docs,
      AGENT_BRIDGE_MAX_REGISTRY_SESSIONS: '25',
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN: '1',
      AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
      AGENT_BRIDGE_MINI_APP_URL: 'https://mini.example.test/telegram',
      AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS: 'https://contextengine.example,https://www.contextengine.example',
      AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS: 'https://mini.contextengine.example',
      AGENT_BRIDGE_MINI_APP_ALLOW_PREVIEW_AUTH: '1',
      AGENT_BRIDGE_MINI_APP_REQUIRE_INIT_DATA: 'false',
      AGENT_BRIDGE_MINI_APP_AUTH_MAX_AGE_SECONDS: '3600',
      AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER: '2026-05-20T00:00:00.000Z',
      AGENT_BRIDGE_RPC_TIMEOUT_MS: '5000',
      AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS: '300',
      AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: '100',
      AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: '200',
      AGENT_BRIDGE_QUESTION_PAYLOAD_CONCURRENCY: '6',
      AGENT_BRIDGE_QUESTION_FOREGROUND_CHUNKS: '2',
      AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITE_TOKEN_HASHES: 'abc123',
      AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITES_JSON: '[{"tokenHash":"def456","sessionSlug":"alpha"}]',
    }),
  });
  const metadata = buildAgentBridgeWorkerUploadMetadata(config);

  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_DEMO_QUESTIONS_JSON' &&
    binding.text === questions
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_DEMO_DOCS_JSON' &&
    binding.text === docs
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_MAX_REGISTRY_SESSIONS' &&
    binding.text === '25'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_QUESTION_SOURCE' &&
    binding.text === 'fixture'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN' &&
    binding.text === '1'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW'
  )), false);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_MINI_APP_URL' &&
    binding.text === 'https://mini.example.test/telegram'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS' &&
    binding.text === 'https://contextengine.example,https://www.contextengine.example'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS' &&
    binding.text === 'https://mini.contextengine.example'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_MINI_APP_ALLOW_PREVIEW_AUTH'
  )), false);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_MINI_APP_REQUIRE_INIT_DATA'
  )), false);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_MINI_APP_AUTH_MAX_AGE_SECONDS' &&
    binding.text === '3600'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER' &&
    binding.text === '2026-05-20T00:00:00.000Z'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_RPC_TIMEOUT_MS' &&
    binding.text === '5000'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS' &&
    binding.text === '300'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK' &&
    binding.text === '100'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK' &&
    binding.text === '200'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_QUESTION_PAYLOAD_CONCURRENCY' &&
    binding.text === '6'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_QUESTION_FOREGROUND_CHUNKS' &&
    binding.text === '2'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITE_TOKEN_HASHES' &&
    binding.text === 'abc123'
  )), true);
  assert.equal(metadata.bindings.some((binding) => (
    binding.name === 'AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITES_JSON' &&
    binding.text === '[{"tokenHash":"def456","sessionSlug":"alpha"}]'
  )), true);
});

test('buildAgentBridgeWorkerUploadMetadata includes R2/D1 only when doc storage is enabled', () => {
  const config = resolveAgentBridgeDeployConfig({
    env: completeEnv({ AGENT_BRIDGE_ENABLE_DOC_STORAGE: 'true' }),
  });
  const metadata = buildAgentBridgeWorkerUploadMetadata(config);

  assert.equal(config.resources.enableDocStorage, true);
  assert.equal(metadata.bindings.some((binding) => binding.name === 'AGENT_DOCS_R2' && binding.type === 'r2_bucket'), true);
  assert.equal(metadata.bindings.some((binding) => binding.name === 'AGENT_DOCS_D1' && binding.type === 'd1'), true);
});

test('resolveAgentBridgeDeployConfig defaults to OP Sepolia POKT RPC and treats extra RPC as additive', () => {
  const config = resolveAgentBridgeDeployConfig({
    env: completeEnv({
      DEFAULT_RPC_URL: '',
      ADDITIONAL_RPC_URL: 'https://infura.example.test/op-sepolia',
    }),
  });

  assert.equal(config.vars.DEFAULT_CHAIN_ID, '11155420');
  assert.equal(config.vars.DEFAULT_RPC_URL, 'https://op-sepolia-testnet.api.pocket.network');
  assert.equal(config.vars.ADDITIONAL_RPC_URL, 'https://infura.example.test/op-sepolia');
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
  assert.equal(plan.remainingDirectApiCalls.some((call) => call.path.includes('/r2/buckets')), false);
  assert.equal(plan.remainingDirectApiCalls.some((call) => call.path.includes('/d1/database')), false);
  assert.equal(JSON.stringify(plan).includes('Durable Object'), false);
  assert.equal(JSON.stringify(plan).includes('MANAGED_DEMO_SIGNER'), false);
  assert.equal(plan.remainingDirectApiCalls.some((call) => call.path.includes('/workers/scripts/ce-agent-bridge-worker/secrets')), true);
  assert.equal(plan.remainingDirectApiCalls[0].path, '/accounts?per_page=2');
  assert.equal(plan.optionalTokenPermissions.length, 1);
  assert.equal(JSON.stringify(plan).includes('123456:test-token'), false);
  assert.equal(JSON.stringify(plan).includes('webhook-secret'), false);
  assert.equal(JSON.stringify(plan).includes('demo-root'), false);
});

test('buildAgentBridgeDeployPlan documents R2/D1 calls only for doc-storage opt-in', () => {
  const config = resolveAgentBridgeDeployConfig({
    env: completeEnv({ AGENT_BRIDGE_ENABLE_DOC_STORAGE: 'true' }),
  });
  const plan = buildAgentBridgeDeployPlan(config);

  assert.equal(plan.resources.enableDocStorage, true);
  assert.equal(plan.requiredTokenPermissions.some((permission) => permission.key === 'workers_r2'), true);
  assert.equal(plan.requiredTokenPermissions.some((permission) => permission.key === 'd1'), true);
  assert.equal(plan.remainingDirectApiCalls.some((call) => call.path.includes('/r2/buckets')), true);
  assert.equal(plan.remainingDirectApiCalls.some((call) => call.path.includes('/d1/database')), true);
});
