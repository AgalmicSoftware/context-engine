import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  compileSessionModeProfile,
  validateSessionModeProfile,
} from './sessionModeProfile';
import {
  validateDeploymentModeValues,
  validateWorkerConfigModeValues,
} from '../../../../workers/shared/workerConfigModeValidation.mjs';

const expectValidatorParity = (profile, expectedValid) => {
  expect(validateSessionModeProfile(profile).valid).toBe(expectedValid);
  const expectedWorkerResult = expectedValid ? { ok: true } : expect.objectContaining({ ok: false });
  const storageProfile = expectedValid ? compileSessionModeProfile(profile).storageProfile : undefined;
  const profileBearingRecord = {
    sessionModeProfile: profile,
    ...(storageProfile ? { storageProfile } : {}),
  };
  expect(validateDeploymentModeValues(profileBearingRecord)).toEqual(expectedWorkerResult);
  expect(validateWorkerConfigModeValues(profileBearingRecord)).toEqual(expectedWorkerResult);
};

describe('session mode profile client/Worker validator parity', () => {
  it('accepts both exact named presets', () => {
    for (const preset of [
      SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE,
      SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
    ]) {
      expectValidatorParity(cloneSessionModePreset(preset), true);
    }
  });

  it('rejects gated Cloudflare public-results claims on both validators', () => {
    const gatedPublicResults = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    gatedPublicResults.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    gatedPublicResults.results.visibility = 'public_full_if_storage_public';
    expectValidatorParity(gatedPublicResults, false);

    const publicReadResults = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    publicReadResults.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    publicReadResults.encryption = { mode: 'none' };
    publicReadResults.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
    publicReadResults.results.visibility = 'public_full_if_storage_public';
    expectValidatorParity(publicReadResults, true);

    const conditionGatedPublicResults = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    conditionGatedPublicResults.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    conditionGatedPublicResults.encryption = { mode: 'none' };
    conditionGatedPublicResults.storage.payloadAccessControl = {
      gate: 'none',
      encryption: 'none',
      accessConditions: {
        match: 'any',
        conditions: [{ kind: 'worker_role', role: 'reviewer' }],
      },
    };
    conditionGatedPublicResults.results.visibility = 'public_full_if_storage_public';
    expectValidatorParity(conditionGatedPublicResults, false);

    const encryptedPublicResults = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    encryptedPublicResults.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    encryptedPublicResults.encryption = { mode: 'lit' };
    expectValidatorParity(encryptedPublicResults, false);
  });

  it('rejects otherwise valid mutations that retain a named preset id', () => {
    const mutatedFast = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    mutatedFast.export.scope = 'all_session';
    const mutatedDecentralized = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    mutatedDecentralized.results.visibility = 'participant_aggregate';

    for (const profile of [mutatedFast, mutatedDecentralized]) {
      expect(validateSessionModeProfile(profile).issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'preset', code: 'preset_profile_mismatch' })]),
      );
      expect(validateDeploymentModeValues({ sessionModeProfile: profile })).toEqual({
        ok: false,
        path: 'sessionModeProfile.preset',
      });
      expect(validateWorkerConfigModeValues({ sessionModeProfile: profile })).toEqual({
        ok: false,
        path: 'sessionModeProfile.preset',
      });
    }
  });

  it('enforces the same 128-character access-condition text boundary', () => {
    const withCondition = (condition) => {
      const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
      profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
      profile.encryption.accessConditions = {
        match: 'any',
        conditions: [condition],
      };
      return profile;
    };

    for (const condition of [
      { kind: 'worker_role', role: 'r'.repeat(128) },
      { kind: 'agent_grant_scope', scope: 's'.repeat(128) },
    ]) {
      expectValidatorParity(withCondition(condition), true);
    }
    for (const condition of [
      { kind: 'worker_role', role: 'r'.repeat(129) },
      { kind: 'agent_grant_scope', scope: 's'.repeat(129) },
    ]) {
      expectValidatorParity(withCondition(condition), false);
    }
  });

  it('rejects empty, null, and array nested profiles', () => {
    for (const profile of [{}, null, []]) {
      expectValidatorParity(profile, false);
    }
  });
});
