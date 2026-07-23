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
      usesPasskeyIdentity: true,
      usesWorkerGroups: true,
      usesArweave: false,
      usesLit: false,
      usesOnChainSbt: false,
      usesRpc: false,
      usesFunding: false,
      showNetworkControls: false,
      settingsResourceKeys: ['ai'],
      adminSecretCardKeys: ['ai'],
      adminTestKeys: ['health', 'ai'],
    });
  });

  it('reveals only the explicit chain and Lit capabilities of a worker hybrid', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.evm.registryChainId = 11155420;
    profile.encryption = { mode: 'lit' };
    profile.authorization.mechanisms.push('sbt_onchain');

    expect(resolveSessionCapabilityProjection({ sessionModeProfile: profile })).toMatchObject({
      source: 'profile',
      isWorkerCanonical: true,
      usesOnChainSbt: true,
      usesLit: true,
      usesRpc: true,
      usesFunding: false,
      usesChainMetadata: false,
      gateKind: 'sbt',
      settingsResourceKeys: ['ai', 'rpc'],
      adminSecretCardKeys: ['ai', 'rpc', 'lit'],
      adminTestKeys: ['health', 'ai', 'lit'],
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

  it('projects only explicitly sponsored legacy resources when no profile exists', () => {
    const projection = resolveSessionCapabilityProjection({
      sponsoredKeys: { ai: true, rpc: true },
    });

    expect(projection.source).toBe('missing');
    expect(projection.settingsResourceKeys).toEqual(['ai', 'rpc']);
    expect(projection.usesRpc).toBe(true);
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
    });
  });
});
