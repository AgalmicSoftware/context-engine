import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  compileSessionModeProfile,
} from '../../utilities/session/sessionModeProfile';
import {
  applySessionModeProfileSelectionToDraft,
  applyStorageProfileChangeToModeDraft,
} from './sessionWizardModeProfileDraftController';

describe('sessionWizardModeProfileDraftController', () => {
  it('keeps session mode profile synchronized with Cloudflare Lit storage changes', () => {
    const prev = {
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      storageProfile: { backend: 'arweave' },
    };

    const next = applyStorageProfileChangeToModeDraft(prev, {
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'lit_encrypted' },
    });

    expect(next.storageProfile).toMatchObject({
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'lit_encrypted' },
    });
    expect(next.sessionModeProfile).toMatchObject({
      preset: 'custom',
      storage: { backend: 'cloudflare' },
      authority: { mode: 'worker_canonical' },
      encryption: { mode: 'lit' },
      surfaces: { web: true },
    });
    expect(prev.storageProfile).toEqual({ backend: 'arweave' });
  });

  it('stores selected mode profiles and clears legacy telegram flags', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const compiled = compileSessionModeProfile(profile);
    const next = applySessionModeProfileSelectionToDraft(
      {
        telegramOnly: true,
        telegram_only: true,
        telegramMode: true,
        sessionMode: 'telegram',
        telegramBridgeEnabled: true,
        telegram: { only: true, mode: 'client', keep: 'value' },
      },
      profile,
      compiled,
    );

    expect(next.sessionModeProfile).toMatchObject({ preset: profile.preset });
    expect(next.storageProfile).toMatchObject(compiled.storageProfile);
    expect(next.telegramOnly).toBeUndefined();
    expect(next.telegram_only).toBeUndefined();
    expect(next.telegramMode).toBeUndefined();
    expect(next.sessionMode).toBeUndefined();
    expect(next.telegramBridgeEnabled).toBeUndefined();
    expect(next.telegram).toEqual({ keep: 'value' });
    expect(next.groupCreationPolicy).toBe('participants');
  });

  it('persists either group creation policy across Worker and registry profile selections', () => {
    const registryProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const restricted = { groupCreationPolicy: 'admin_only' };
    const registryDraft = applySessionModeProfileSelectionToDraft(
      restricted,
      registryProfile,
      compileSessionModeProfile(registryProfile),
    );
    expect(registryDraft.groupCreationPolicy).toBe('admin_only');

    const workerProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const participantDraft = { ...registryDraft, groupCreationPolicy: 'participants' };
    expect(
      applySessionModeProfileSelectionToDraft(participantDraft, workerProfile, compileSessionModeProfile(workerProfile))
        .groupCreationPolicy,
    ).toBe('participants');
  });

  it('clears a retained Wrapped capability when the selected profile disables that surface', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const next = applySessionModeProfileSelectionToDraft(
      {
        agentSessionWrapped: {
          enabled: true,
          bridgeUrl: 'https://wrapped.example.test',
        },
      },
      profile,
      compileSessionModeProfile(profile),
    );

    expect(next.agentSessionWrapped).toBeUndefined();
  });
});
