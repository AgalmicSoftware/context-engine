import {
  cloneSessionModePreset,
  compileSessionModeProfile,
  SESSION_MODE_PRESET_IDS,
} from '../../utilities/session/sessionModeProfile';
import {
  applySessionWizardRegistryChainDraftDefaults,
  normalizeSessionWizardDraftShape,
} from './sessionWizardDraftState';
import { applySessionModeProfileSelectionToDraft } from './sessionWizardModeProfileDraftController';
import { buildSessionWizardDeployStorageProfilePayload } from './sessionWizardWorkerDeployStorage';
import { resolveSessionWizardWorkerStorageProfilePayload } from './sessionWizardWriteNormalization';
import { validateDeploymentModeValues } from '../../../../workers/shared/workerConfigModeValidation.mjs';

const sbtProfile = () => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = 'custom';
  profile.evm.registryChainId = 11155420;
  profile.encryption.accessConditions = {
    match: 'any',
    conditions: [
      {
        kind: 'sbt_onchain',
        chainId: 11155420,
        contract: '0x00000000000000000000000000000000000000aa',
        anyOrAll: 'any',
      },
    ],
  };
  return profile;
};

describe('session setup config transitions', () => {
  it.each(['none', 'lit'] as const)(
    'deploys the Decentralized profile with %s encryption through the real validator',
    (encryption) => {
      const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
      if (encryption === 'lit') {
        profile.preset = 'custom';
        profile.encryption = { mode: 'lit' };
        profile.results.visibility = 'participant_aggregate';
      }
      const draft = applySessionModeProfileSelectionToDraft({}, profile, compileSessionModeProfile(profile));
      const storageProfile = buildSessionWizardDeployStorageProfilePayload(draft, {});
      expect(storageProfile).toMatchObject({ backend: 'arweave' });
      expect(validateDeploymentModeValues({ sessionModeProfile: profile, storageProfile })).toEqual({ ok: true });
    },
  );

  it('keeps header network changes coherent through deploy and draft reload', () => {
    const profile = sbtProfile();
    const draft = applySessionModeProfileSelectionToDraft(
      { networkChainId: 11155420 },
      profile,
      compileSessionModeProfile(profile),
    );
    const switched = applySessionWizardRegistryChainDraftDefaults({ draft, chainId: 84532 });
    const deploy = resolveSessionWizardWorkerStorageProfilePayload({ draft: switched });
    expect(validateDeploymentModeValues(deploy)).toEqual({ ok: true });
    const reloaded = normalizeSessionWizardDraftShape(switched);
    expect(reloaded.sessionModeProfile.evm.registryChainId).toBe(84532);
    expect(reloaded.storageProfile.payloadAccessControl.accessConditions.conditions[0].chainId).toBe(84532);
    expect(draft.networkChainId).toBe(11155420);
  });

  it('updates the header chain even while a rule contract is incomplete', () => {
    const profile = sbtProfile();
    const compiled = compileSessionModeProfile(profile);
    profile.evm.registryChainId = 84532;
    profile.encryption.accessConditions = {
      match: 'any',
      conditions: [{ kind: 'sbt_onchain', chainId: 84532, contract: '', anyOrAll: 'any' }],
    };
    const next = applySessionModeProfileSelectionToDraft({ networkChainId: 11155420 }, profile, compiled);
    expect(next.networkChainId).toBe(84532);
    expect(next.sessionModeProfile.encryption.accessConditions?.conditions[0]).toMatchObject({
      chainId: 84532,
      contract: '',
    });
  });
});
