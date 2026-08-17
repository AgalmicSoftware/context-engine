import {
  canonicalizeSessionSlug,
  resolveCanonicalSessionContext,
  resolveCanonicalSessionConfig,
  resolveSessionSlugAliasFromDemoSessions,
  resolveSessionConfigFromSources,
} from './canonicalSessionContext.js';
import { USE_ONCHAIN_SESSION_REGISTRY } from '../../variables/appConfig.js';
import {
  DEMO_SESSION,
  MISSING_SOURCES,
  SLUG_MISMATCH,
  STALE_CACHE_SESSION,
  VALID_ARWEAVE_METADATA,
  VALID_LOCAL_OVERRIDES,
  VALID_REGISTRY_SESSION,
  VALID_WORKER_CONFIG,
} from './sessionFixtures.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from './sessionModeProfile.js';

const workerCanonicalProfile = () => cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);

describe('canonicalSessionContext', () => {
  it('canonicalizes general and legacy alias slugs', () => {
    expect(canonicalizeSessionSlug(' GeNeRal!!! ')).toBe('');
    expect(canonicalizeSessionSlug('DEBATE')).toBe('DEBATE');
    expect(canonicalizeSessionSlug('Team A!')).toBe('Team A!');
  });

  it('rejects reserved object-property slug names', () => {
    expect(canonicalizeSessionSlug('__proto__')).toBe('');
    expect(canonicalizeSessionSlug(' Constructor ')).toBe('');
    expect(canonicalizeSessionSlug('PROTOTYPE')).toBe('');
  });

  it('resolves session config from registry before demo fallbacks', () => {
    const registryCfg = { slug: 'alpha', sessionName: 'Alpha From Registry' };
    const resolved = resolveSessionConfigFromSources({
      sessionSlug: 'alpha',
      getRegistrySessionConfig: (slug) => (slug === 'alpha' ? registryCfg : null),
      demoSessions: {
        general: { slug: '', sessionName: 'General' },
        alpha: { slug: 'alpha', sessionName: 'Alpha From Demo' },
      },
      preferRegistry: true,
    });

    expect(resolved.sessionConfig).toEqual(registryCfg);
    expect(resolved.sessionConfigSource).toBe('registry');
  });

  it('uses the mode-aware demo fallback default when registry resolution misses', () => {
    const demoCfg = { slug: 'alpha', sessionName: 'Alpha From Demo' };
    const shouldAllowDemoFallback = !USE_ONCHAIN_SESSION_REGISTRY;
    const resolved = resolveSessionConfigFromSources({
      sessionSlug: 'alpha',
      demoSessions: {
        alpha: demoCfg,
      },
      preferRegistry: false,
    });

    expect(resolved.sessionSlug).toBe('alpha');
    expect(resolved.sessionConfig).toEqual(shouldAllowDemoFallback ? demoCfg : null);
    expect(resolved.sessionConfigSource).toBe(shouldAllowDemoFallback ? 'demo' : 'missing');
  });

  it('still allows explicit demo fallback overrides', () => {
    const demoCfg = { slug: 'alpha', sessionName: 'Alpha From Demo' };
    const resolved = resolveSessionConfigFromSources({
      sessionSlug: 'alpha',
      demoSessions: {
        alpha: demoCfg,
      },
      preferRegistry: false,
      allowDemoFallback: true,
    });

    expect(resolved.sessionConfig).toEqual(demoCfg);
    expect(resolved.sessionConfigSource).toBe('demo');
  });

  it('does not fall back to general demo config for unknown non-general slugs', () => {
    const resolved = resolveSessionConfigFromSources({
      sessionSlug: 'missing-slug',
      demoSessions: {
        general: { slug: '', sessionName: 'General' },
      },
      preferRegistry: false,
    });

    expect(resolved.sessionConfig).toBeNull();
    expect(resolved.sessionConfigSource).toBe('missing');
  });

  it('keeps generic session-config resolution narrow for non-canonical demo entry keys', () => {
    const resolved = resolveSessionConfigFromSources({
      sessionSlug: 'legacyReading',
      demoSessions: {
        general: { slug: '', sessionName: 'Context Engine' },
        legacyReading: { slug: 'reading-group', sessionName: 'Reading Group' },
      },
      preferRegistry: false,
    });

    expect(resolved.sessionSlug).toBe('legacyReading');
    expect(resolved.sessionConfig).toBeNull();
    expect(resolved.sessionConfigSource).toBe('missing');
  });

  it('resolves canonical demo slugs from demo entry-key aliases', () => {
    const resolved = resolveSessionSlugAliasFromDemoSessions({
      sessionSlug: 'legacyReading',
      demoSessions: {
        general: { slug: '', sessionName: 'Context Engine' },
        legacyReading: { slug: 'reading-group', sessionName: 'Reading Group' },
      },
    });

    expect(resolved.requestedSessionSlug).toBe('legacyReading');
    expect(resolved.sessionSlug).toBe('reading-group');
    expect(resolved.sessionConfigSource).toBe('demo');
    expect(resolved.sessionConfig).toEqual({ slug: 'reading-group', sessionName: 'Reading Group' });
  });

  it('only resolves demo session names when explicitly enabled', () => {
    const demoSessions = {
      general: { slug: '', sessionName: 'Context Engine' },
    };

    expect(
      resolveSessionSlugAliasFromDemoSessions({
        sessionSlug: 'Context Engine',
        demoSessions,
      }).sessionSlug,
    ).toBe('Context Engine');

    expect(
      resolveSessionSlugAliasFromDemoSessions({
        sessionSlug: 'Context Engine',
        demoSessions,
        allowSessionName: true,
      }).sessionSlug,
    ).toBe('');
  });

  it('warns when explicit slug and provided config slug disagree', () => {
    const resolved = resolveCanonicalSessionConfig({
      source: {
        sessionSlug: 'alpha',
        sessionConfig: { slug: 'beta', sessionName: 'Beta' },
      },
    });

    expect(resolved.sessionSlug).toBe('alpha');
    expect(resolved.sessionConfig).toEqual({ slug: 'beta', sessionName: 'Beta' });
    expect(resolved.warnings).toContain('session config slug mismatch: requested "alpha" resolved "beta"');
    expect(resolved.provenance.sessionConfig).toBe('provided');
  });

  it('injects resolved slug into slug-less configs without mutating the input', () => {
    const inputConfig = { sessionName: 'No Slug' };
    const resolved = resolveCanonicalSessionConfig({
      source: {
        sessionSlug: 'alpha',
        sessionConfig: inputConfig,
      },
    });

    expect(resolved.sessionConfig).toEqual({ slug: 'alpha', sessionName: 'No Slug' });
    expect(inputConfig).toEqual({ sessionName: 'No Slug' });
  });

  it('preserves an explicit general slug over active-session defaults', () => {
    const resolved = resolveCanonicalSessionConfig({
      source: {
        sessionSlug: '',
      },
      defaults: {
        activeSessionSlug: 'alpha',
      },
      resolveBySlug: (slug) => {
        if (slug === '') return { slug: '', sessionName: 'General' };
        if (slug === 'alpha') return { slug: 'alpha', sessionName: 'Alpha' };
        return null;
      },
    });

    expect(resolved.sessionSlug).toBe('');
    expect(resolved.sessionConfig).toEqual({ slug: '', sessionName: 'General' });
    expect(resolved.provenance.sessionSlug).toBe('explicit');
  });

  it('resolves canonical session context with registry identity and authoritative metadata', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: VALID_REGISTRY_SESSION.slug,
      registrySession: VALID_REGISTRY_SESSION,
      metadata: VALID_ARWEAVE_METADATA,
      workerConfig: VALID_WORKER_CONFIG,
      localOverrides: VALID_LOCAL_OVERRIDES,
      mode: 'on-chain',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.provenance).toEqual({
      identity: 'registry',
      metadata: 'arweave',
      worker: 'worker-kv',
      local: 'browser',
    });
    expect(resolved.context.identity).toEqual({
      slug: 'alpha',
      sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      metadataURI: 'ar://alpha-session-metadata',
      chainId: 84532,
    });
    expect(resolved.context.effective).toMatchObject({
      slug: 'alpha',
      sessionName: 'Alpha Session',
      corsWorkerUrl: 'https://worker.example.com',
      allowOrigins: ['https://example.com'],
      sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      metadataURI: 'ar://alpha-session-metadata',
      chainId: 84532,
      localPreferences: VALID_LOCAL_OVERRIDES,
    });
  });

  it('accepts an explicitly validated worker-canonical KV source without registry or Arweave identity', () => {
    const workerConfig = {
      slug: 'worker-room',
      sessionId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      configRevision: 'revision-1',
      sessionName: 'Worker Room',
      sessionInfo: 'Canonical worker content.',
      tags: ['worker', 'fixture'],
      corsWorkerUrl: 'https://worker-room.example.test',
      allowOrigins: ['https://app.example.test'],
      gates: [{ id: 'member', type: 'worker_role' }],
      sponsored: { defaultGateId: 'member' },
      sponsoredSbtAddress: '0x0000000000000000000000000000000000000001',
      workerAuthority: { version: 1, participantScopes: ['ai', 'storage'] },
      sessionModeProfile: workerCanonicalProfile(),
      storageProfile: { backend: 'cloudflare' },
    };

    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'worker-room',
      validatedWorkerCanonicalSource: {
        validated: true,
        source: 'worker-kv',
        config: workerConfig,
      },
      mode: 'production',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.errors).toEqual([]);
    expect(resolved.provenance).toEqual({
      identity: 'worker-kv',
      metadata: 'worker-kv',
      worker: 'worker-kv',
      local: 'missing',
    });
    expect(resolved.context.identity).toEqual({
      slug: 'worker-room',
      sessionId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      metadataURI: '',
      chainId: null,
    });
    expect(resolved.context.effective).toMatchObject({
      slug: 'worker-room',
      sessionId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      sessionName: 'Worker Room',
      sessionInfo: 'Canonical worker content.',
      corsWorkerUrl: 'https://worker-room.example.test',
      gates: [{ id: 'member', type: 'worker_role' }],
      sponsored: { defaultGateId: 'member' },
      sponsoredSbtAddress: '0x0000000000000000000000000000000000000001',
      sessionModeProfile: workerConfig.sessionModeProfile,
      workerAuthority: workerConfig.workerAuthority,
    });
    expect(resolved.context.effective).not.toHaveProperty('metadataURI');
    expect(resolved.context.effective).not.toHaveProperty('chainId');
  });

  it('does not let a worker query or mode string grant worker-KV authority', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'worker-room',
      routeContext: {
        slug: 'worker-room',
        sessionId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        worker: 'https://worker-room.example.test',
      },
      mode: 'worker_canonical',
    });

    expect(resolved.ok).toBe(false);
    expect(resolved.errors).toContain('Missing authoritative session identity source.');
    expect(resolved.provenance.identity).toBe('route');
  });

  it('fails closed when the explicit worker-canonical source is not validated or has the wrong profile', () => {
    const baseConfig = {
      slug: 'worker-room',
      sessionId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      corsWorkerUrl: 'https://worker-room.example.test',
      sessionModeProfile: workerCanonicalProfile(),
    };
    const unvalidated = resolveCanonicalSessionContext({
      requestedSlug: 'worker-room',
      validatedWorkerCanonicalSource: {
        validated: false,
        source: 'worker-kv',
        config: baseConfig,
      },
      mode: 'production',
    });
    const wrongProfile = resolveCanonicalSessionContext({
      requestedSlug: 'worker-room',
      validatedWorkerCanonicalSource: {
        validated: true,
        source: 'worker-kv',
        config: {
          ...baseConfig,
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
        },
      },
      mode: 'production',
    });

    for (const resolved of [unvalidated, wrongProfile]) {
      expect(resolved.ok).toBe(false);
      expect(resolved.errors).toContain('Invalid validated worker-canonical source.');
      expect(resolved.errors).toContain('Missing authoritative session identity source.');
      expect(resolved.provenance.identity).toBe('route');
    }
  });

  it('does not let registry or Arweave fields override an explicitly validated worker-canonical source', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'worker-room',
      registrySession: VALID_REGISTRY_SESSION,
      metadata: VALID_ARWEAVE_METADATA,
      workerConfig: {
        corsWorkerUrl: 'https://registry-worker.example.test',
        allowOrigins: ['https://registry.example.test'],
      },
      validatedWorkerCanonicalSource: {
        validated: true,
        source: 'worker-kv',
        config: {
          slug: 'worker-room',
          sessionId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          sessionName: 'Worker Room',
          corsWorkerUrl: 'https://worker-room.example.test',
          sessionModeProfile: workerCanonicalProfile(),
        },
      },
      mode: 'production',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.context.identity.slug).toBe('worker-room');
    expect(resolved.context.identity.sessionId).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(resolved.context.metadata.sessionName).toBe('Worker Room');
    expect(resolved.context.effective.sessionName).toBe('Worker Room');
    expect(resolved.context.effective.corsWorkerUrl).toBe('https://worker-room.example.test');
    expect(resolved.context.effective).not.toHaveProperty('metadataURI');
    expect(resolved.provenance.identity).toBe('worker-kv');
    expect(resolved.provenance.metadata).toBe('worker-kv');
  });

  it('does not fall back to registry identity when a validated worker-canonical config has no session ID', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'worker-room',
      registrySession: VALID_REGISTRY_SESSION,
      validatedWorkerCanonicalSource: {
        validated: true,
        source: 'worker-kv',
        config: {
          slug: 'worker-room',
          sessionName: 'Incomplete Worker Room',
          corsWorkerUrl: 'https://worker-room.example.test',
          sessionModeProfile: workerCanonicalProfile(),
        },
      },
      mode: 'production',
    });

    expect(resolved.ok).toBe(false);
    expect(resolved.errors).toContain('Missing authoritative session identity source.');
    expect(resolved.context.identity).toEqual({
      slug: 'worker-room',
      sessionId: '',
      metadataURI: '',
      chainId: null,
    });
    expect(resolved.provenance.identity).toBe('worker-kv');
  });

  it('keeps worker config authoritative over metadata-shaped worker fields in the effective config', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: VALID_REGISTRY_SESSION.slug,
      registrySession: VALID_REGISTRY_SESSION,
      metadata: {
        ...VALID_ARWEAVE_METADATA,
        corsWorkerUrl: 'https://metadata-worker.example.com',
        allowOrigins: ['https://metadata-origin.example.com'],
        rpcEndpoint: 'https://metadata-rpc.example.com',
        limits: { perWalletPerDay: 1 },
      },
      workerConfig: {
        corsWorkerUrl: 'https://worker.example.com',
        allowOrigins: ['https://worker-origin.example.com'],
        rpcEndpoint: 'https://worker-rpc.example.com',
        limits: { perWalletPerDay: 3 },
      },
      mode: 'on-chain',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.context.effective).toMatchObject({
      corsWorkerUrl: 'https://worker.example.com',
      allowOrigins: ['https://worker-origin.example.com'],
      rpcEndpoint: 'https://worker-rpc.example.com',
      limits: { perWalletPerDay: 3 },
    });
  });

  it('prefers registry sessionIdHex over UUID-style sessionId values', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'alpha',
      registrySession: {
        slug: 'alpha',
        sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        sessionIdHex: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        metadataURI: 'ar://alpha-session-metadata',
        chainId: 84532,
      },
      mode: 'on-chain',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.errors).toEqual([]);
    expect(resolved.provenance.identity).toBe('registry');
    expect(resolved.context.identity.sessionId).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('resolves hex sessionId from __registry when top-level sessionId is UUID format', () => {
    // Real registry cache entries store UUID at config.sessionId and hex in config.__registry.sessionIdHex
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'alpha',
      registrySession: {
        slug: 'alpha',
        sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        metadataURI: 'ar://alpha-session-metadata',
        networkChainId: 84532,
        __registry: {
          sessionIdHex: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          chainId: 84532,
          metadataURI: 'ar://alpha-session-metadata',
        },
      },
      mode: 'on-chain',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.errors).toEqual([]);
    expect(resolved.provenance.identity).toBe('registry');
    expect(resolved.context.identity.sessionId).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('prefers route sessionIdHex over UUID-style sessionId values', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'alpha',
      routeContext: {
        sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        sessionIdHex: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        metadataURI: 'ar://alpha-session-metadata',
        chainId: 84532,
      },
      mode: 'production',
    });

    expect(resolved.ok).toBe(false);
    expect(resolved.errors).toEqual(['Missing authoritative session identity source.']);
    expect(resolved.provenance.identity).toBe('route');
    expect(resolved.context.identity).toEqual({
      slug: 'alpha',
      sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      metadataURI: 'ar://alpha-session-metadata',
      chainId: 84532,
    });
  });

  it('prefers demo sessionIdHex over UUID-style sessionId values', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'demo',
      demoSession: {
        slug: 'demo',
        sessionName: 'Demo Session',
        sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        sessionIdHex: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        metadataURI: 'ar://demo-session-metadata',
        chainId: 84532,
      },
      mode: 'demo',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.errors).toEqual([]);
    expect(resolved.provenance.identity).toBe('demo');
    expect(resolved.context.identity.sessionId).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('strips worker alias and secret metadata fields from effective context', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: VALID_REGISTRY_SESSION.slug,
      registrySession: VALID_REGISTRY_SESSION,
      metadata: {
        ...VALID_ARWEAVE_METADATA,
        rpcUrl: 'https://worker-alias-rpc.example.com',
        apiKey: 'worker-api-key',
        privateKey: 'worker-private-key',
        corsWorkerURL: 'https://worker-alias.example.com',
        arweaveJwk: '{"kty":"RSA"}',
        faucetKey: 'worker-faucet-key',
      },
      workerConfig: VALID_WORKER_CONFIG,
      localOverrides: VALID_LOCAL_OVERRIDES,
      mode: 'on-chain',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.context.metadata.rpcUrl).toBe('https://worker-alias-rpc.example.com');
    expect(resolved.context.effective).not.toHaveProperty('rpcUrl');
    expect(resolved.context.effective).not.toHaveProperty('apiKey');
    expect(resolved.context.effective).not.toHaveProperty('privateKey');
    expect(resolved.context.effective).not.toHaveProperty('corsWorkerURL');
    expect(resolved.context.effective).not.toHaveProperty('arweaveJwk');
    expect(resolved.context.effective).not.toHaveProperty('faucetKey');
  });

  it('strips root gate metadata overrides from effective context', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: VALID_REGISTRY_SESSION.slug,
      registrySession: VALID_REGISTRY_SESSION,
      metadata: {
        ...VALID_ARWEAVE_METADATA,
        gates: [{ id: 'gate-1', type: 'sbt' }],
        sponsored: { defaultGateId: 'gate-1' },
        sponsoredSbtAddress: '0x0000000000000000000000000000000000000001',
      },
      mode: 'on-chain',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.context.metadata).not.toHaveProperty('gates');
    expect(resolved.context.effective).not.toHaveProperty('gates');
    expect(resolved.context.effective).not.toHaveProperty('sponsored');
    expect(resolved.context.effective).not.toHaveProperty('sponsoredSbtAddress');
  });

  it('allows demo identity and metadata fallback in demo mode', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: DEMO_SESSION.slug,
      demoSession: DEMO_SESSION,
      mode: 'demo',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.provenance.identity).toBe('demo');
    expect(resolved.provenance.metadata).toBe('demo');
    expect(resolved.context.identity.slug).toBe('demo');
    expect(resolved.context.effective.sessionName).toBe('Demo Session');
    expect(resolved.warnings).toContain('Using demo session identity fallback; registry is authoritative.');
  });

  it('keeps registry identity authoritative when cache metadata disagrees', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: VALID_REGISTRY_SESSION.slug,
      registrySession: VALID_REGISTRY_SESSION,
      metadata: STALE_CACHE_SESSION,
      mode: 'on-chain',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.provenance.identity).toBe('registry');
    expect(resolved.provenance.metadata).toBe('cache');
    expect(resolved.context.identity.slug).toBe('alpha');
    expect(resolved.context.metadata.slug).toBe('stale');
    expect(resolved.context.effective.slug).toBe('alpha');
    expect(resolved.context.effective.sessionName).toBe('Stale Cache');
    expect(resolved.warnings).toContain('Using cached session metadata replica; arweave metadata is authoritative.');
    expect(resolved.warnings).toContain('session metadata slug mismatch: metadata "stale" ignored in favor of "alpha"');
  });

  it('warns on requested slug mismatch when registry resolution wins', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: SLUG_MISMATCH.requested,
      registrySession: {
        ...VALID_REGISTRY_SESSION,
        slug: SLUG_MISMATCH.config.slug,
      },
      metadata: VALID_ARWEAVE_METADATA,
      mode: 'on-chain',
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.context.identity.slug).toBe('beta');
    expect(resolved.warnings).toContain('session identity slug mismatch: requested "alpha" resolved "beta"');
  });

  it('rejects chainId-only registry record as insufficient authoritative identity', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'alpha',
      registrySession: { chainId: 84532 },
      mode: 'on-chain',
    });

    expect(resolved.ok).toBe(false);
    expect(resolved.errors).toContain('Missing authoritative session identity source.');
    expect(resolved.provenance.identity).toBe('route');
    expect(resolved.context.identity.slug).toBe('alpha');
  });

  it('returns an explicit error when no authoritative sources are available', () => {
    const resolved = resolveCanonicalSessionContext(MISSING_SOURCES);

    expect(resolved.ok).toBe(false);
    expect(resolved.errors).toContain('Missing authoritative session identity source.');
    expect(resolved.provenance).toEqual({
      identity: 'route',
      metadata: 'cache',
      worker: 'missing',
      local: 'missing',
    });
  });

  it('rejects route-only session identity in on-chain mode', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'alpha',
      mode: 'on-chain',
    });

    expect(resolved.ok).toBe(false);
    expect(resolved.errors).toContain('Missing authoritative session identity source.');
    expect(resolved.provenance.identity).toBe('route');
    expect(resolved.context.identity).toEqual({
      slug: 'alpha',
      sessionId: '',
      metadataURI: '',
      chainId: null,
    });
  });

  it('quarantines structurally corrupt metadata and falls through to demo sources', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'alpha',
      registrySession: VALID_REGISTRY_SESSION,
      metadata: 'this is not an object',
      demoSession: { slug: 'alpha', sessionName: 'Alpha Demo' },
      mode: 'demo',
    });

    expect(resolved.warnings).toContain(
      'Quarantined corrupt session metadata (not an object); falling back to alternate sources.',
    );
    expect(resolved.provenance.metadata).toBe('demo');
    expect(resolved.context.metadata).toMatchObject({
      sessionName: 'Alpha Demo',
    });
  });

  it('still treats valid Arweave metadata as authoritative even with field-level errors', () => {
    const resolved = resolveCanonicalSessionContext({
      requestedSlug: 'alpha',
      registrySession: VALID_REGISTRY_SESSION,
      metadata: { sessionName: 'Valid Name', tags: 123 },
      mode: 'on-chain',
    });

    expect(resolved.provenance.metadata).toBe('arweave');
    expect(resolved.context.metadata).toMatchObject({
      sessionName: 'Valid Name',
    });
    expect(resolved.errors.some((entry) => entry.includes('tags'))).toBe(true);
  });
});
