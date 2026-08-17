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
        usesWorkerRuntime: true,
        presetKeyChips: ['Cloudflare account', 'AI provider key'],
        requiredRequirementIds: ['cloudflareAccount', 'aiProviderKey'],
        requiredWorkerSecretFields: ['openaiKey'],
        visibleWorkerResourceKeys: ['ai'],
        requiresRpc: false,
        requiresArweave: false,
        requiresLit: false,
        requiresFunding: false,
        publish: {
          deployPendingSbts: false,
          persistWorkerConfig: true,
          uploadMetadata: false,
          registerSession: false,
          refreshRegistryCache: false,
        },
        publishSettings: {
          showArweaveMetadataControls: false,
          showGasOverrideControls: false,
        },
      }),
    );
  });

  it('adds Lit and chain requirements to Cloudflare only when Lit is selected', () => {
    const profile = cloudflareProfile();
    profile.preset = 'custom';
    profile.encryption = { mode: 'lit' };
    profile.evm.registryChainId = 11155420;
    profile.storage.payloadAccessControl = {
      ...profile.storage.payloadAccessControl!,
      encryption: 'lit',
    };
    const requirements = resolveSessionWizardModeRequirements(profile);

    expect(requirements.presetKeyChips).toEqual([
      'Cloudflare account',
      'AI provider key',
      'RPC URL/key',
      'Lit API key',
    ]);
    expect(requirements.requiredWorkerSecretFields).toEqual(['openaiKey', 'litAccountApiKey']);
    expect(requirements.visibleWorkerResourceKeys).toEqual(['ai', 'rpc', 'lit']);
    expect(requirements.requiresRpc).toBe(true);
    expect(requirements.requiresArweave).toBe(false);
    expect(requirements.publish).toEqual({
      deployPendingSbts: false,
      persistWorkerConfig: true,
      uploadMetadata: false,
      registerSession: false,
      refreshRegistryCache: false,
    });
    expect(requirements.publishSettings).toEqual({
      showArweaveMetadataControls: false,
      showGasOverrideControls: false,
    });
  });

  it('requires transaction inputs for an on-chain SBT condition only while a draft is pending', () => {
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
    expect(requirements.requiresWallet).toBe(false);
    expect(requirements.requiresFunding).toBe(false);
    expect(requirements.requiredRequirementIds).toEqual(['cloudflareAccount', 'aiProviderKey', 'rpc']);
    expect(requirements.visibleWorkerResourceKeys).toEqual(['ai', 'rpc']);
    expect(requirements.publish.deployPendingSbts).toBe(true);
    expect(requirements.publishSettings.showGasOverrideControls).toBe(false);

    const pendingRequirements = resolveSessionWizardModeRequirements(profile, { hasPendingSbtDrafts: true });
    expect(pendingRequirements.requiresWallet).toBe(true);
    expect(pendingRequirements.requiresFunding).toBe(true);
    expect(pendingRequirements.requiredRequirementIds).toEqual([
      'cloudflareAccount',
      'aiProviderKey',
      'rpc',
      'wallet',
      'funding',
    ]);
    expect(pendingRequirements.visibleWorkerResourceKeys).toEqual(['ai', 'rpc', 'txGas']);
    expect(pendingRequirements.publish.deployPendingSbts).toBe(true);
    expect(pendingRequirements.publishSettings.showGasOverrideControls).toBe(true);
  });

  it('preserves decentralized Arweave, RPC, funding, registry, and optional Lit requirements', () => {
    const decentralized = decentralizedProfile();
    const plain = resolveSessionWizardModeRequirements(decentralized);
    const litProfile: SessionModeProfile = {
      ...decentralized,
      preset: 'custom',
      encryption: { mode: 'lit' },
      results: {
        ...decentralized.results,
        visibility: 'participant_aggregate',
      },
      export: { scope: 'encrypted_envelopes_only' },
    };
    const lit = resolveSessionWizardModeRequirements(litProfile);

    expect(plain).toEqual(
      expect.objectContaining({
        isWorkerCanonical: false,
        usesWorkerRuntime: true,
        presetKeyChips: [
          'Compatible Session Worker',
          'AI provider key',
          'Arweave wallet/JWK',
          'RPC URL/key',
          'Lit API key if encryption is enabled',
        ],
        requiredRequirementIds: ['sessionWorker', 'aiProviderKey', 'arweaveJwk', 'rpc', 'wallet', 'funding'],
        requiresArweave: true,
        requiresRpc: true,
        requiresFunding: true,
        requiresLit: false,
        visibleWorkerResourceKeys: ['ai', 'arweave', 'rpc', 'txGas'],
        requiredWorkerSecretFields: ['openaiKey', 'arweaveJwk'],
        publish: {
          deployPendingSbts: true,
          persistWorkerConfig: false,
          uploadMetadata: true,
          registerSession: true,
          refreshRegistryCache: true,
        },
        publishSettings: {
          showArweaveMetadataControls: true,
          showGasOverrideControls: true,
        },
      }),
    );
    expect(lit.visibleWorkerResourceKeys).toEqual(['ai', 'arweave', 'rpc', 'txGas', 'lit']);
    expect(lit.requiredWorkerSecretFields).toEqual(['openaiKey', 'arweaveJwk', 'litAccountApiKey']);
    expect(lit.requiresLit).toBe(true);
    expect(lit.publishSettings).toEqual({
      showArweaveMetadataControls: true,
      showGasOverrideControls: true,
    });
  });

  it('adds the Wrapped token without replacing Cloudflare account requirements', () => {
    const profile = cloudflareProfile();
    profile.preset = 'custom';
    profile.surfaces.agentHttp = true;

    const requirements = resolveSessionWizardModeRequirements(profile);

    expect(requirements.requiredRequirementIds).toEqual(['cloudflareAccount', 'cloudflareApiToken', 'aiProviderKey']);
    expect(requirements.presetKeyChips).toEqual([
      'Cloudflare account',
      'Request-only Cloudflare API token',
      'AI provider key',
    ]);
  });

  it('adds the Wrapped token without replacing decentralized requirements', () => {
    const profile = decentralizedProfile();
    profile.preset = 'custom';
    profile.surfaces.agentHttp = true;

    const requirements = resolveSessionWizardModeRequirements(profile);

    expect(requirements.requiredRequirementIds).toEqual([
      'sessionWorker',
      'cloudflareApiToken',
      'aiProviderKey',
      'arweaveJwk',
      'rpc',
      'wallet',
      'funding',
    ]);
    expect(requirements.presetKeyChips).toEqual([
      'Compatible Session Worker',
      'Request-only Cloudflare API token',
      'AI provider key',
      'Arweave wallet/JWK',
      'RPC URL/key',
      'Lit API key if encryption is enabled',
    ]);
  });

  it('returns an unselected descriptor instead of inventing legacy requirements', () => {
    expect(resolveSessionWizardModeRequirements(null)).toEqual(
      expect.objectContaining({
        selected: false,
        presetKeyChips: [],
        requiredRequirementIds: [],
        requiredWorkerSecretFields: [],
        visibleWorkerResourceKeys: [],
        publishSettings: {
          showArweaveMetadataControls: false,
          showGasOverrideControls: false,
        },
      }),
    );
  });

  it('fails closed when a malformed profile contains chain-shaped fields', () => {
    const profile = cloudflareProfile();
    profile.storage.backend = 'arweave';
    profile.authorization.mechanisms.push('sbt_onchain');

    expect(resolveSessionWizardModeRequirements(profile)).toEqual(
      expect.objectContaining({
        selected: false,
        requiresArweave: false,
        requiresRpc: false,
        requiresFunding: false,
        publish: {
          deployPendingSbts: false,
          persistWorkerConfig: false,
          uploadMetadata: false,
          registerSession: false,
          refreshRegistryCache: false,
        },
      }),
    );
  });
});
