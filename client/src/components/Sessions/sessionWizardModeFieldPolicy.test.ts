import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import {
  SESSION_WIZARD_MODE_POLICY_FIELD_KEYS,
  applySessionWizardModeFieldPolicyToPayload,
  resolveSessionWizardModeFieldPolicy,
} from './sessionWizardModeFieldPolicy';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';

const cloudflareRequirements = () =>
  resolveSessionWizardModeRequirements(cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE));

describe('sessionWizardModeFieldPolicy', () => {
  it('enumerates and strips every policy-governed field that is hidden by the final profile', () => {
    expect(SESSION_WIZARD_MODE_POLICY_FIELD_KEYS).toEqual([
      'blockLimits',
      'faucet',
      'sessionEndsAt',
      'contracts',
      'defaultGroupTags',
      'defaultSbtTags',
      'defaultFeaturedSBTs',
      'autoFeatureSBTsBySessionSlug',
      'agentSessionWrapped',
    ]);
    const payload = Object.fromEntries(SESSION_WIZARD_MODE_POLICY_FIELD_KEYS.map((key) => [key, 'stale']));

    expect(
      applySessionWizardModeFieldPolicyToPayload(
        payload,
        resolveSessionWizardModeFieldPolicy(cloudflareRequirements()),
      ),
    ).toEqual({
      sessionEndsAt: 'stale',
      defaultGroupTags: 'stale',
    });
  });

  it('strips hidden mode fields from encrypted metadata sidecars', () => {
    const requirements = resolveSessionWizardModeRequirements(
      cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
    );
    const payload = {
      sessionEndsAt: '2099-01-02T03:04:00Z',
      defaultGroupTags: 'worker-only-group-defaults',
      encryptedFields: {
        sessionEndsAt: { ciphertext: 'stale-session-end' },
        defaultGroupTags: { ciphertext: 'stale-group-tags' },
        sessionInfo: { ciphertext: 'allowed-session-info' },
      },
      encryptedFieldGates: {
        sessionEndsAt: 'gate-stale',
        defaultGroupTags: 'gate-stale',
        sessionInfo: 'gate-current',
      },
    };

    expect(
      applySessionWizardModeFieldPolicyToPayload(payload, resolveSessionWizardModeFieldPolicy(requirements)),
    ).toEqual({
      encryptedFields: {
        sessionInfo: { ciphertext: 'allowed-session-info' },
      },
      encryptedFieldGates: {
        sessionInfo: 'gate-current',
      },
    });
  });

  it('shows Worker timing and Group defaults without chain-only controls for pure Cloudflare', () => {
    expect(resolveSessionWizardModeFieldPolicy(cloudflareRequirements())).toEqual({
      showBlockLimits: false,
      showFaucet: false,
      showSessionEndsAt: true,
      showWorkerGroupDefaults: true,
      showSbtDefaults: false,
      showAgentSessionWrapped: false,
      visibleContractKeys: [],
    });
  });

  it('exposes only the SBT Group Factory for explicit Cloudflare plus on-chain SBT', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
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

    expect(resolveSessionWizardModeFieldPolicy(resolveSessionWizardModeRequirements(profile))).toEqual({
      showBlockLimits: false,
      showFaucet: false,
      showSessionEndsAt: true,
      showWorkerGroupDefaults: true,
      showSbtDefaults: true,
      showAgentSessionWrapped: false,
      visibleContractKeys: ['sbtFactory'],
    });
  });

  it('preserves decentralized block, faucet, and contract controls', () => {
    const requirements = resolveSessionWizardModeRequirements(
      cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
    );

    expect(resolveSessionWizardModeFieldPolicy(requirements)).toEqual({
      showBlockLimits: true,
      showFaucet: true,
      showSessionEndsAt: false,
      showWorkerGroupDefaults: false,
      showSbtDefaults: true,
      showAgentSessionWrapped: false,
      visibleContractKeys: ['surveys', 'sbtFactory', 'sessionRegistry'],
    });
  });

  it('retains the Wrapped capability only when the final profile enables its surface', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.surfaces.agentHttp = true;
    const payload = {
      agentSessionWrapped: {
        enabled: true,
        bridgeUrl: 'https://wrapped.example.test',
      },
    };

    expect(
      applySessionWizardModeFieldPolicyToPayload(
        payload,
        resolveSessionWizardModeFieldPolicy(resolveSessionWizardModeRequirements(profile)),
      ),
    ).toEqual({
      agentSessionWrapped: {
        enabled: true,
        bridgeUrl: 'https://wrapped.example.test',
      },
    });
  });
});
