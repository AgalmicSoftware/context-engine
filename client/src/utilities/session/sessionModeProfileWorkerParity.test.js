import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset, validateSessionModeProfile } from './sessionModeProfile';
import {
  validateDeploymentModeValues,
  validateWorkerConfigModeValues,
} from '../../../../workers/shared/workerConfigModeValidation.mjs';

const expectValidatorParity = (profile, expectedValid) => {
  expect(validateSessionModeProfile(profile).valid).toBe(expectedValid);
  const expectedWorkerResult = expectedValid ? { ok: true } : expect.objectContaining({ ok: false });
  expect(validateDeploymentModeValues({ sessionModeProfile: profile })).toEqual(expectedWorkerResult);
  expect(validateWorkerConfigModeValues({ sessionModeProfile: profile })).toEqual(expectedWorkerResult);
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
