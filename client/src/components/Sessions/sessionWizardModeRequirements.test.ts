import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  type SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';

const cloudflareProfile = () => cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
const decentralizedProfile = () => cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);

describe('sessionWizardModeRequirements', () => {
  it('derives the default worker-canonical two-key contract and publish capabilities', () => {
    const requirements = resolveSessionWizardModeRequirements(cloudflareProfile());

    expect(requirements).toEqual(
      expect.objectContaining({
        authorityMode: 'worker_canonical',
        isWorkerCanonical: true,
        presetKeyChips: ['Cloudflare API token', 'AI provider key'],
        requiredRequirementIds: ['cloudflareApiToken', 'aiProviderKey'],
        requiredWorkerSecretFields: ['openaiKey'],
        visibleWorkerResourceKeys: ['ai'],
        requiresRpc: false,
        requiresArweave: false,
        requiresLit: false,
        requiresFunding: false,
        publish: {
          persistWorkerConfig: true,
          uploadMetadata: false,
          registerSession: false,
          refreshRegistryCache: false,
        },
      }),
    );
  });

  it('adds Lit and chain requirements to Cloudflare only when Lit is selected', () => {
    const profile = cloudflareProfile();
    profile.preset = 'custom';
    profile.encryption = { mode: 'lit' };
    profile.evm.registryChainId = 11155420;
    const requirements = resolveSessionWizardModeRequirements(profile);

    expect(requirements.presetKeyChips).toEqual([
      'Cloudflare API token',
      'AI provider key',
      'RPC URL/key',
      'Lit API key',
    ]);
    expect(requirements.requiredWorkerSecretFields).toEqual(['openaiKey', 'litAccountApiKey']);
    expect(requirements.visibleWorkerResourceKeys).toEqual(['ai', 'rpc', 'lit']);
    expect(requirements.requiresRpc).toBe(true);
    expect(requirements.requiresArweave).toBe(false);
    expect(requirements.publish).toEqual({
      persistWorkerConfig: true,
      uploadMetadata: false,
      registerSession: false,
      refreshRegistryCache: false,
    });
  });

  it('attributes RPC to an explicit on-chain SBT condition without adding Arweave', () => {
    const profile = cloudflareProfile();
    profile.preset = 'custom';
    profile.evm.registryChainId = 11155420;
    profile.authorization.mechanisms.push('sbt_onchain');
    profile.encryption.accessConditions = {
      match: 'any',
      conditions: [
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x0000000000000000000000000000000000000001',
          anyOrAll: 'any',
        },
      ],
    };

    const requirements = resolveSessionWizardModeRequirements(profile);
    expect(requirements.requiresRpc).toBe(true);
    expect(requirements.requiresArweave).toBe(false);
    expect(requirements.visibleWorkerResourceKeys).toEqual(['ai', 'rpc']);
  });

  it('preserves decentralized Arweave, RPC, funding, registry, and optional Lit requirements', () => {
    const plain = resolveSessionWizardModeRequirements(decentralizedProfile());
    const litProfile: SessionModeProfile = {
      ...decentralizedProfile(),
      preset: 'custom',
      encryption: { mode: 'lit' },
    };
    const lit = resolveSessionWizardModeRequirements(litProfile);

    expect(plain).toEqual(
      expect.objectContaining({
        isWorkerCanonical: false,
        requiresArweave: true,
        requiresRpc: true,
        requiresFunding: true,
        requiresLit: false,
        visibleWorkerResourceKeys: ['ai', 'arweave', 'rpc', 'txGas'],
        requiredWorkerSecretFields: ['openaiKey', 'arweaveJwk'],
        publish: {
          persistWorkerConfig: false,
          uploadMetadata: true,
          registerSession: true,
          refreshRegistryCache: true,
        },
      }),
    );
    expect(lit.visibleWorkerResourceKeys).toEqual(['ai', 'arweave', 'rpc', 'txGas', 'lit']);
    expect(lit.requiredWorkerSecretFields).toEqual(['openaiKey', 'arweaveJwk', 'litAccountApiKey']);
    expect(lit.requiresLit).toBe(true);
  });

  it('returns an unselected descriptor instead of inventing legacy requirements', () => {
    expect(resolveSessionWizardModeRequirements(null)).toEqual(
      expect.objectContaining({
        selected: false,
        presetKeyChips: [],
        requiredRequirementIds: [],
        requiredWorkerSecretFields: [],
        visibleWorkerResourceKeys: [],
      }),
    );
  });
});
