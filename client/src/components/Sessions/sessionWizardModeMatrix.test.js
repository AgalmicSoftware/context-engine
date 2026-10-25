import {
  cloneSessionModePreset,
  compileSessionModeProfile,
  SESSION_MODE_PRESET_IDS,
  validateSessionModeProfile,
} from '../../utilities/session/sessionModeProfile';
import { applySessionModeProfileSelectionToDraft } from './sessionWizardModeProfileDraftController';
import { normalizeSessionWizardDraftShape } from './sessionWizardDraftState';
import { buildSessionWizardDeployStorageProfilePayload } from './sessionWizardWorkerDeployStorage';
import { buildSessionWizardWorkerConfigPayload } from './sessionWizardWriteNormalization';
import { validateDeploymentModeValues } from '../../../../workers/shared/workerConfigModeValidation.mjs';
import { applySessionConfigMutation } from '../../../../workers/sessionCorsWorker/sessionConfigMutation.js';

const ADMIN = '0x00000000000000000000000000000000000000a1';
const cases = [];
for (const backend of ['cloudflare', 'arweave']) {
  for (const encryption of ['none', 'worker_envelope', 'lit']) {
    for (const visibility of ['participant_aggregate', 'session_member_aggregate', 'public_full_if_storage_public']) {
      for (const scope of ['admin_raw', 'all_session', 'encrypted_envelopes_only']) {
        for (const agentHttp of [false, true]) {
          const valid =
            !(backend === 'arweave' && encryption === 'worker_envelope') &&
            !(visibility === 'public_full_if_storage_public' && encryption !== 'none') &&
            !(scope === 'encrypted_envelopes_only' && encryption === 'none');
          cases.push({
            name: `${backend}/${encryption}/${visibility}/${scope}/http=${agentHttp}`,
            backend,
            encryption,
            visibility,
            scope,
            agentHttp,
            valid,
          });
        }
      }
    }
  }
}

const profileFor = ({ backend, encryption, visibility, scope, agentHttp }) => {
  const profile = cloneSessionModePreset(
    backend === 'cloudflare'
      ? SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE
      : SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
  );
  profile.preset = 'custom';
  profile.encryption = {
    mode: encryption,
    ...(encryption === 'worker_envelope' ? { keyProvider: 'worker_secret' } : {}),
  };
  profile.evm.registryChainId = backend === 'arweave' || encryption === 'lit' ? 11155420 : null;
  if (backend === 'cloudflare') {
    profile.storage.payloadAccessControl.encryption = encryption;
    if (visibility === 'public_full_if_storage_public')
      profile.storage.payloadAccessControl = { gate: 'none', encryption };
  }
  profile.surfaces.agentHttp = agentHttp;
  profile.results.visibility = visibility;
  profile.export.scope = scope;
  return profile;
};

describe('session setup option compatibility across publication boundaries', () => {
  it('pins the complete core cross product and its supported subset', () => {
    expect(cases).toHaveLength(108);
    expect(cases.filter(({ valid }) => valid)).toHaveLength(60);
  });

  it.each(cases)('$name', (entry) => {
    const profile = profileFor(entry);
    expect(validateSessionModeProfile(profile).valid).toBe(entry.valid);
    if (!entry.valid) {
      expect(() => compileSessionModeProfile(profile)).toThrow();
      expect(validateDeploymentModeValues({ sessionModeProfile: profile })).toMatchObject({ ok: false });
      expect(
        applySessionConfigMutation({
          existingConfig: {},
          mutation: { kind: 'set-config', incomingConfig: { sessionModeProfile: profile } },
          slug: 'matrix',
        }).ok,
      ).toBe(false);
      return;
    }
    let draft = applySessionModeProfileSelectionToDraft(
      {
        networkChainId: 11155420,
        sessionName: 'Matrix session',
        sessionInfo: 'Synthetic setup fixture',
        interviewMode: { openingMode: 'owner', openingPrompt: 'What should change?' },
        groupCreationPolicy: 'participants',
      },
      profile,
      compileSessionModeProfile(profile),
    );
    draft = normalizeSessionWizardDraftShape(draft);
    const storageProfile = buildSessionWizardDeployStorageProfilePayload(draft, {});
    expect(validateDeploymentModeValues({ sessionModeProfile: draft.sessionModeProfile, storageProfile })).toEqual({
      ok: true,
    });
    const config = buildSessionWizardWorkerConfigPayload({
      slug: 'matrix',
      sessionId: '0x11111111111111111111111111111111',
      draft,
      account: ADMIN,
      registryChainId: 11155420,
      registryAddress: '0x00000000000000000000000000000000000000b2',
      latestChainBlock: 1,
    });
    const written = applySessionConfigMutation({
      existingConfig: {},
      mutation: { kind: 'set-config', incomingConfig: config },
      slug: 'matrix',
    });
    expect(written).toMatchObject({ ok: true });
    expect(written.config.sessionModeProfile).toMatchObject({
      storage: { backend: entry.backend },
      encryption: { mode: entry.encryption },
      surfaces: { agentHttp: entry.agentHttp, telegram: false, miniApp: false },
      results: { visibility: entry.visibility },
      export: { scope: entry.scope },
    });
    expect(written.config.interviewMode.openingPrompt).toBe('What should change?');
    const replay = applySessionConfigMutation({
      existingConfig: written.config,
      mutation: { kind: 'set-config', incomingConfig: config },
      slug: 'matrix',
    });
    expect(replay).toMatchObject({ ok: true, config: written.config });
    const restored = normalizeSessionWizardDraftShape(written.config);
    expect(validateSessionModeProfile(restored.sessionModeProfile)).toEqual({ valid: true, issues: [] });
    expect(buildSessionWizardDeployStorageProfilePayload(restored, {})).toEqual(storageProfile);
  });
});
