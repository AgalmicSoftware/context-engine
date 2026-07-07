import {
  CORRUPT_METADATA_TYPES,
  VALID_ARWEAVE_METADATA,
  VALID_LOCAL_OVERRIDES,
  VALID_WORKER_CONFIG,
} from './sessionFixtures.js';
import {
  parseLocalResourceOverrides,
  parseSessionIdentity,
  parseSessionMetadata,
  parseWorkerConfig,
} from './sessionParsers.js';

describe('sessionParsers', () => {
  it('parses and normalizes canonical session identity fields', () => {
    const parsed = parseSessionIdentity({
      slug: ' Alpha ',
      sessionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      metadataURI: ' ar://alpha ',
      chainId: '84532',
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.slug).toBe('Alpha');
    expect(parsed.sessionId).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(parsed.metadataURI).toBe('ar://alpha');
    expect(parsed.chainId).toBe(84532);
  });

  it('accepts bytes16 session ids and rejects malformed values', () => {
    const valid = parseSessionIdentity({
      sessionId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
    const invalid = parseSessionIdentity({
      sessionId: 'not-hex',
    });

    expect(valid.ok).toBe(true);
    expect(valid.sessionId).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(invalid.ok).toBe(false);
    expect(invalid.sessionId).toBe('');
    expect(invalid.errors).toContain('sessionId must be a valid 32-character hex string.');
  });

  it('normalizes metadata without mutating the source payload', () => {
    const raw = {
      ...VALID_ARWEAVE_METADATA,
      orgName: ' Legacy Session ',
      orgInfo: ' Legacy session info ',
      lit: { network: 'NAGA_TEST', userMaxPrice: ' 123 ' },
      tags: [' alpha ', ' beta '],
      sponsored: { defaultGateId: 'gate-1' },
      sponsoredSbtAddress: '0x0000000000000000000000000000000000000001',
    };
    const original = JSON.parse(JSON.stringify(raw));

    const parsed = parseSessionMetadata(raw);

    expect(parsed.ok).toBe(true);
    expect(parsed.metadata.sessionName).toBe('Alpha Session');
    expect(parsed.metadata.sessionInfo).toBe('Fixture metadata for parser tests.');
    expect(parsed.metadata.tags).toEqual(['alpha', 'beta']);
    expect(parsed.metadata.lit.network).toBe('chipotle');
    expect(parsed.metadata.lit.userMaxPrice).toBe('123');
    expect(parsed.metadata.sponsored).toBeUndefined();
    expect(parsed.metadata.sponsoredSbtAddress).toBeUndefined();
    expect(raw).toEqual(original);
  });

  it('preserves future public metadata fields while stripping internal parser fields', () => {
    const parsed = parseSessionMetadata({
      sessionName: ' Future Session ',
      __fromCache: true,
      display: {
        accentColor: 'teal',
        nested: {
          mode: 'compact',
        },
      },
      customList: ['alpha', { enabled: true }],
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.metadata.sessionName).toBe('Future Session');
    expect(parsed.metadata.__fromCache).toBeUndefined();
    expect(parsed.metadata.display).toEqual({
      accentColor: 'teal',
      nested: {
        mode: 'compact',
      },
    });
    expect(parsed.metadata.customList).toEqual(['alpha', { enabled: true }]);
  });

  it('rejects corrupt metadata field types instead of coercing them', () => {
    const parsed = parseSessionMetadata({
      ...CORRUPT_METADATA_TYPES,
      lit: { network: ['bad'] },
    });

    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        'sessionName must be a string.',
        'tags must be an array of strings.',
        'lit.network must be a string.',
      ]),
    );
    expect(parsed.metadata.sessionName).toBeUndefined();
    expect(parsed.metadata.tags).toBeUndefined();
    expect(parsed.metadata.lit).toEqual({ network: 'chipotle' });
  });

  it('parses worker config fields and trims nested string values', () => {
    const parsed = parseWorkerConfig({
      ...VALID_WORKER_CONFIG,
      corsWorkerUrl: ' https://worker.example.com ',
      allowOrigins: [' https://example.com ', ''],
      limits: { perWalletPerDay: ' 3 ' },
      rpcEndpoint: ' https://rpc.example.com ',
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.config).toEqual({
      corsWorkerUrl: 'https://worker.example.com',
      allowOrigins: ['https://example.com'],
      limits: { perWalletPerDay: '3' },
      rpcEndpoint: 'https://rpc.example.com',
    });
  });

  it('parses public Lit credential fields from worker config without accepting secret API keys', () => {
    const parsed = parseWorkerConfig({
      corsWorkerUrl: 'https://worker.example.com',
      litCredentials: {
        litApiBase: ' https://api.chipotle.litprotocol.com ',
        litGroupId: ' 7 ',
        litPkpId: ' 0xpkp123 ',
        litActionCid: ' QmAction123 ',
        litAccountApiKey: 'secret-account-key',
        litUsageApiKey: 'secret-usage-key',
      },
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.config.litCredentials).toEqual({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: '7',
      litPkpId: '0xpkp123',
      litActionCid: 'QmAction123',
    });
  });

  it('normalizes protocol-less worker URLs to absolute https bases', () => {
    const parsed = parseWorkerConfig({
      corsWorkerUrl: 'worker.example.com/auth/login',
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.config.corsWorkerUrl).toBe('https://worker.example.com');
  });

  it('parses deploy-time embedded deploy-helper flags from worker config payloads', () => {
    const parsed = parseWorkerConfig({
      embeddedDeployHelperEnabled: false,
      deployHelperEnabled: true,
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.config).toEqual({
      corsWorkerUrl: '',
      allowOrigins: [],
      limits: {},
      rpcEndpoint: '',
      embeddedDeployHelperEnabled: false,
    });
  });

  it('parses legacy string allowOrigins values', () => {
    const parsed = parseWorkerConfig({
      allowOrigins: ' https://example.com,\nhttps://second.example.com \n, https://third.example.com ',
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.config.allowOrigins).toEqual([
      'https://example.com',
      'https://second.example.com',
      'https://third.example.com',
    ]);
  });

  it('accepts legacy corsWorkerURL and CorsWorkerURL keys in worker config', () => {
    const legacy1 = parseWorkerConfig({ corsWorkerURL: 'https://legacy.example.com' });
    const legacy2 = parseWorkerConfig({ CorsWorkerURL: 'https://legacy2.example.com' });
    const canonical = parseWorkerConfig({
      corsWorkerUrl: 'https://canonical.example.com',
      corsWorkerURL: 'https://ignored.example.com',
    });

    expect(legacy1.ok).toBe(true);
    expect(legacy1.config.corsWorkerUrl).toBe('https://legacy.example.com');

    expect(legacy2.ok).toBe(true);
    expect(legacy2.config.corsWorkerUrl).toBe('https://legacy2.example.com');

    // Canonical key takes precedence
    expect(canonical.ok).toBe(true);
    expect(canonical.config.corsWorkerUrl).toBe('https://canonical.example.com');
  });

  it('accepts compatibility worker URL aliases in worker config', () => {
    const workerUrl = parseWorkerConfig({ workerUrl: 'https://worker.example.com/path/' });
    const sessionCorsWorkerUrl = parseWorkerConfig({ sessionCorsWorkerUrl: 'https://session-cors.example.com' });
    const sessionWorkerUrl = parseWorkerConfig({ sessionWorkerUrl: 'https://session-worker.example.com' });
    const sessionWorkerURL = parseWorkerConfig({ sessionWorkerURL: 'https://session-worker-upper.example.com' });
    const workerURL = parseWorkerConfig({ workerURL: 'https://worker-upper.example.com' });

    expect(workerUrl.config.corsWorkerUrl).toBe('https://worker.example.com/path');
    expect(sessionCorsWorkerUrl.config.corsWorkerUrl).toBe('https://session-cors.example.com');
    expect(sessionWorkerUrl.config.corsWorkerUrl).toBe('https://session-worker.example.com');
    expect(sessionWorkerURL.config.corsWorkerUrl).toBe('https://session-worker-upper.example.com');
    expect(workerURL.config.corsWorkerUrl).toBe('https://worker-upper.example.com');
  });

  it('rejects relative worker URLs in worker config', () => {
    const parsed = parseWorkerConfig({
      corsWorkerUrl: '/auth/login',
    });

    expect(parsed.ok).toBe(false);
    expect(parsed.config.corsWorkerUrl).toBe('');
    expect(parsed.errors).toContain('corsWorkerUrl must be an absolute http(s) URL.');
  });

  it('normalizes local override sections and reports invalid values', () => {
    const parsed = parseLocalResourceOverrides({
      ...VALID_LOCAL_OVERRIDES,
      rpc: { useLocal: 'yes', apiKey: ' local-key ' },
      arweave: { useLocal: true, jwk: { bad: true } },
      faucet: 'nope',
    });

    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        'rpc.useLocal must be a boolean.',
        'arweave.jwk must be a string.',
        'faucet must be an object.',
      ]),
    );
    expect(parsed.overrides).toEqual({
      rpc: { useLocal: false, apiKey: 'local-key' },
      arweave: { useLocal: true, jwk: '' },
      faucet: { useLocal: false, privateKey: '' },
    });
  });
});
