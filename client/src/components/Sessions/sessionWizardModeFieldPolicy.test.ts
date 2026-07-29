import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
} from '../../utilities/session/sessionModeProfile';
import { resolveSessionWizardModeFieldPolicy } from './sessionWizardModeFieldPolicy';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';

const cloudflareRequirements = () =>
  resolveSessionWizardModeRequirements(
    cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  );

describe('sessionWizardModeFieldPolicy', () => {
  it('shows Worker timing and Group defaults without chain-only controls for pure Cloudflare', () => {
    expect(resolveSessionWizardModeFieldPolicy(cloudflareRequirements())).toEqual({
      showBlockLimits: false,
      showFaucet: false,
      showSessionEndsAt: true,
      showWorkerGroupDefaults: true,
      showSbtDefaults: false,
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

    expect(
      resolveSessionWizardModeFieldPolicy(resolveSessionWizardModeRequirements(profile)),
    ).toEqual({
      showBlockLimits: false,
      showFaucet: false,
      showSessionEndsAt: true,
      showWorkerGroupDefaults: true,
      showSbtDefaults: true,
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
      visibleContractKeys: ['surveys', 'sbtFactory', 'sessionRegistry'],
    });
  });
});
