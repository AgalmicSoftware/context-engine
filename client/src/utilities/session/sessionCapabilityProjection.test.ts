import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from './sessionModeProfile';
import { resolveSessionCapabilityProjection } from './sessionCapabilityProjection';

describe('sessionCapabilityProjection', () => {
  it('keeps the minimal worker-canonical profile chainless and worker-native', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);

    expect(resolveSessionCapabilityProjection({ sessionModeProfile: profile })).toMatchObject({
      source: 'profile',
      profileValid: true,
      authorityMode: 'worker_canonical',
      isWorkerCanonical: true,
      isPureWorkerCanonical: true,
      usesPasskeyIdentity: true,
      usesWalletIdentity: false,
      usesWorkerGroups: true,
      usesArweave: false,
      usesLit: false,
      usesOnChainSbt: false,
      usesRpc: false,
      usesFunding: false,
      hasOnChainComponent: false,
      chainId: null,
      showNetworkControls: false,
      settingsResourceKeys: ['ai'],
      adminSecretCardKeys: ['ai'],
      adminTestKeys: ['health', 'ai'],
    });
  });

  it('reveals only the explicit SBT capabilities of a Worker-envelope hybrid', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.evm.registryChainId = 11155420;
    profile.encryption.accessConditions = {
      match: 'any',
      conditions: [
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x1111111111111111111111111111111111111111',
          anyOrAll: 'any',
        },
      ],
    };

    expect(resolveSessionCapabilityProjection({ sessionModeProfile: profile })).toMatchObject({
      source: 'profile',
      isWorkerCanonical: true,
      isPureWorkerCanonical: false,
      usesOnChainSbt: true,
      usesLit: false,
      usesRpc: true,
      usesFunding: false,
      usesChainMetadata: false,
      hasOnChainComponent: true,
      chainId: 11155420,
      gateKind: 'session',
      settingsResourceKeys: ['ai', 'rpc'],
      adminSecretCardKeys: ['ai', 'rpc'],
      adminTestKeys: ['health', 'ai'],
    });
  });

  it('keeps a reachable Worker Lit profile Worker-canonical while exposing its chain', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.evm.registryChainId = 11155420;
    profile.encryption = { mode: 'lit' };
    profile.storage.payloadAccessControl!.encryption = 'lit';

    expect(resolveSessionCapabilityProjection({ sessionModeProfile: profile })).toMatchObject({
      source: 'profile',
      profileValid: true,
      isWorkerCanonical: true,
      isRegistryCanonical: false,
      usesLit: true,
      usesOnChainSbt: false,
      usesRpc: true,
      usesFunding: false,
      chainId: 11155420,
      gateKind: 'session',
      adminSecretCardKeys: ['ai', 'rpc', 'lit'],
    });
  });

  it('preserves the complete registry-canonical control set', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);

    expect(resolveSessionCapabilityProjection({ sessionModeProfile: profile })).toMatchObject({
      source: 'profile',
      isRegistryCanonical: true,
      usesArweave: true,
      usesOnChainSbt: true,
      usesRpc: true,
      usesFunding: true,
      usesWalletIdentity: true,
      hasOnChainComponent: true,
      chainId: 11155420,
      showNetworkControls: true,
      settingsResourceKeys: ['ai', 'arweave', 'rpc', 'txGas'],
      adminSecretCardKeys: ['ai', 'rpc', 'arweave', 'faucet'],
      adminTestKeys: ['health', 'ai', 'arweave', 'faucet'],
    });
  });

  it('fails closed for invalid profiles instead of falling through to stale registry-shaped fields', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.storage.backend = 'arweave';

    expect(
      resolveSessionCapabilityProjection({
        sessionModeProfile: profile,
        __registry: {
          registryChainId: 11155420,
          sessionIdHex: '0x00112233445566778899aabbccddeeff',
        },
      }),
    ).toMatchObject({
      source: 'invalid_profile',
      profileValid: false,
      authorityMode: '',
      usesRpc: false,
      usesArweave: false,
      usesOnChainSbt: false,
      adminSecretCardKeys: ['ai'],
    });
  });

  it.each([{}, null, []])(
    'fails closed for an explicitly present malformed nested profile instead of using legacy registry fields: %p',
    (sessionModeProfile) => {
      expect(
        resolveSessionCapabilityProjection({
          sessionModeProfile,
          __registry: {
            registryChainId: 11155420,
            sessionIdHex: '0x00112233445566778899aabbccddeeff',
          },
        }),
      ).toMatchObject({
        source: 'invalid_profile',
        supportStatus: 'invalid',
        profileValid: false,
        isRegistryCanonical: false,
        usesRpc: false,
        usesOnChainSbt: false,
        chainId: null,
      });
    },
  );

  it('does not infer chain capabilities from sponsored keys when no profile exists', () => {
    const projection = resolveSessionCapabilityProjection({
      sponsoredKeys: { ai: true, rpc: true },
    });

    expect(projection.source).toBe('missing');
    expect(projection.settingsResourceKeys).toEqual(['ai']);
    expect(projection.usesRpc).toBe(false);
    expect(projection.usesArweave).toBe(false);
    expect(projection.usesFunding).toBe(false);
  });

  it('retains explicit legacy registry authority when no profile exists', () => {
    expect(
      resolveSessionCapabilityProjection({
        __registry: {
          registryChainId: 11155420,
          sessionIdHex: '0x00112233445566778899aabbccddeeff',
        },
      }),
    ).toMatchObject({
      source: 'legacy_registry',
      isRegistryCanonical: true,
      usesRpc: true,
      usesArweave: true,
      usesFunding: true,
      chainId: 11155420,
    });
  });

  it('accepts a legacy top-level chain only when paired with strong registry identity', () => {
    expect(
      resolveSessionCapabilityProjection({
        networkChainId: 84532,
        __registry: {
          sessionIdHex: '0x00112233445566778899aabbccddeeff',
        },
      }),
    ).toMatchObject({
      source: 'legacy_registry',
      isRegistryCanonical: true,
      usesRpc: true,
      chainId: 84532,
    });

    expect(resolveSessionCapabilityProjection({ networkChainId: 84532 })).toMatchObject({
      source: 'missing',
      usesRpc: false,
      chainId: null,
    });
  });

  it('fails closed for schema-only authority modes', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.authority.mode = 'worker_with_public_anchor';
    profile.evm.registryChainId = 11155420;

    expect(resolveSessionCapabilityProjection({ sessionModeProfile: profile })).toMatchObject({
      source: 'invalid_profile',
      supportStatus: 'schema_only',
      profileValid: false,
      usesWorkerAuthority: false,
      usesRpc: false,
      showNetworkControls: false,
      chainId: null,
    });
  });
});
