import {
  buildAgentBridgeTokenTemplateUrl,
  buildGeneratedAgentBridgeSecrets,
  buildTelegramDemoSetupAuditEvent,
  buildTelegramDemoSetupPlan,
  deriveSingleCloudflareAccount,
  deriveWorkersDevPublicUrl,
  generateHighEntropySecret,
  normalizeAdditionalRpcUrl,
  resolveSessionDefaultChainId,
  resolveSessionDefaultRpcUrl,
  resolveSessionWorkerBaseUrl,
  validateAgentBridgeTokenScopes,
  validateTelegramDemoSetup,
} from './telegramDemoSetupHelpers';

const deterministicCrypto = {
  getRandomValues: (bytes: Uint8Array) => {
    bytes.forEach((_, index) => {
      bytes[index] = (index + 1) % 256;
    });
    return bytes;
  },
};

describe('telegramDemoSetupHelpers', () => {
  it('derives a single Cloudflare account and blocks multi-account tokens', () => {
    expect(deriveSingleCloudflareAccount({
      result: [{ id: 'account-123', name: 'Demo Account' }],
    })).toEqual({
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
    expect(multiple.ok).toBe(false);
    expect(multiple.blocker).toMatch(/multiple accounts/i);
    expect(multiple.blocker).toMatch(/not implemented/i);
  });

  it('validates required Cloudflare token scopes and optional workers.dev setup scope', () => {
    const smokePermissions = [
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
      { key: 'workers_durable_objects', type: 'edit' },
    ];
    const docStoragePermissions = [
      ...smokePermissions,
      { key: 'workers_r2', type: 'edit' },
      { key: 'd1', type: 'edit' },
    ];

    expect(validateAgentBridgeTokenScopes({ permissions: smokePermissions }).ok).toBe(true);
    expect(validateAgentBridgeTokenScopes({
      permissions: smokePermissions,
      includeDocStorage: true,
    }).ok).toBe(false);
    expect(validateAgentBridgeTokenScopes({
      permissions: docStoragePermissions,
      includeDocStorage: true,
    }).ok).toBe(true);

    const withSubdomainSetup = validateAgentBridgeTokenScopes({
      permissions: smokePermissions,
      includeWorkersDevSubdomainSetup: true,
    });
    expect(withSubdomainSetup.ok).toBe(false);
    expect(withSubdomainSetup.optionalMissing).toEqual([
      { key: 'account_settings', type: 'edit' },
    ]);
  });

  it('generates high-entropy webhook and signer secrets without exposing them in the plan log event', () => {
    const secret = generateHighEntropySecret({ cryptoImpl: deterministicCrypto });
    expect(secret).toMatch(/^[0-9a-f]{64}$/);

    const generatedSecrets = buildGeneratedAgentBridgeSecrets({ cryptoImpl: deterministicCrypto });
    const plan = buildTelegramDemoSetupPlan({
      sessionSlug: 'alpha',
      sessionWorkerBaseUrl: 'https://session-worker.example.test',
      telegramBotToken: '123456:real-token',
      telegramBotUsername: 'ce_demo_bot',
      cloudflareApiToken: 'cf-real-token',
      workersSubdomain: 'tenant-subdomain',
      generatedSecrets,
      sessionConfig: { telegramOnly: true, sessionName: 'Alpha' },
    });
    const audit = buildTelegramDemoSetupAuditEvent({ plan });
    const serialized = JSON.stringify(audit);

    expect(serialized).not.toContain('123456:real-token');
    expect(serialized).not.toContain('cf-real-token');
    expect(serialized).not.toContain(generatedSecrets.TELEGRAM_WEBHOOK_SECRET);
    expect(serialized).not.toContain(generatedSecrets.DEMO_SIGNER_ROOT_SECRET);
    expect(plan.secrets.TELEGRAM_WEBHOOK_SECRET).toBe('[set]');
    expect(plan.secrets.DEMO_SIGNER_ROOT_SECRET).toBe('[set]');
  });

  it('derives Workers.dev public URL and selected session defaults', () => {
    const sessionConfig = {
      slug: 'alpha',
      corsWorkerUrl: 'https://session-worker.example.test/',
      networkChainId: 11155420,
      rpc: {
        providers: {
          path: {
            rpcUrl: 'https://custom-path.example/rpc',
          },
        },
      },
    };

    expect(deriveWorkersDevPublicUrl({
      workerName: 'CE Agent Bridge Worker!',
      workersSubdomain: 'Tenant Subdomain',
    })).toBe('https://ce-agent-bridge-worker.tenant-subdomain.workers.dev');
    expect(resolveSessionWorkerBaseUrl(sessionConfig)).toBe('https://session-worker.example.test');
    expect(resolveSessionDefaultChainId(sessionConfig)).toBe(11155420);
    expect(resolveSessionDefaultRpcUrl(sessionConfig)).toBe('https://op-sepolia-testnet.api.pocket.network');
  });

  it('preserves default POKT RPC while allowing an optional additional RPC URL', () => {
    const plan = buildTelegramDemoSetupPlan({
      sessionWorkerBaseUrl: 'https://session-worker.example.test',
      telegramBotToken: '123456:test-token',
      telegramBotUsername: 'ce_demo_bot',
      cloudflareApiToken: 'cf-test-token',
      workersSubdomain: 'tenant-subdomain',
      defaultRpcUrl: 'https://op-sepolia-testnet.api.pocket.network',
      additionalRpcUrl: 'https://infura.example.test/op-sepolia',
      sessionConfig: { telegramOnly: true, sessionName: 'Alpha' },
      generatedSecrets: {
        TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
        DEMO_SIGNER_ROOT_SECRET: 'signer-secret',
      },
    });

    expect(plan.vars.DEFAULT_RPC_URL).toBe('https://op-sepolia-testnet.api.pocket.network');
    expect(plan.vars.ADDITIONAL_RPC_URL).toBe('https://infura.example.test/op-sepolia');
    const policy = JSON.parse(String(plan.vars.AGENT_BRIDGE_SESSION_POLICY_JSON || '{}'));
    expect(policy.sessions[0].telegramOnly).toBe(true);
    expect(policy.sessions[0].telegramBridgeEnabled).toBe(true);
    expect(normalizeAdditionalRpcUrl(
      'https://op-sepolia-testnet.api.pocket.network',
      'https://op-sepolia-testnet.api.pocket.network'
    )).toBe('');
    expect(validateTelegramDemoSetup(plan).ok).toBe(true);
  });

  it('builds a Cloudflare token template without requiring a pasted account id', () => {
    const url = new URL(buildAgentBridgeTokenTemplateUrl({
      sessionSlug: 'alpha',
      now: new Date('2026-05-08T12:34:00Z'),
    }));

    expect(url.searchParams.get('accountId')).toBe('*');
    expect(url.searchParams.get('name')).toBe('contextEngine-agentBridgeWorker-alpha-202605081234');
    expect(JSON.parse(url.searchParams.get('permissionGroupKeys') || '[]')).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
      { key: 'workers_durable_objects', type: 'edit' },
    ]);
  });
});
