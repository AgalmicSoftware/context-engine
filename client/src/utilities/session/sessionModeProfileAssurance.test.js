import { classifySessionModeProfileSupport, compileSessionModeProfile } from './sessionModeProfile';
import {
  SESSION_MODE_DECLARED_SUPPORT,
  createReachableSessionModeFixtures,
  createUnsupportedSessionModeSentinels,
} from './sessionModeProfileAssurance.testUtils';
import {
  validateDeploymentModeValues,
  validateWorkerConfigModeValues,
} from '../../../../workers/shared/workerConfigModeValidation.mjs';

const emptyObservedSupport = () =>
  Object.fromEntries(Object.keys(SESSION_MODE_DECLARED_SUPPORT).map((dimension) => [dimension, new Set()]));

const addAccessConditions = (observed, accessConditions) => {
  if (!accessConditions) return;
  observed.accessMatch.add(accessConditions.match);
  accessConditions.conditions.forEach((condition) => observed.accessCondition.add(condition.kind));
};

const observeReachableProfile = (observed, profile) => {
  observed.preset.add(profile.preset);
  observed.authority.add(profile.authority.mode);
  observed.storage.add(profile.storage.backend);
  observed.encryption.add(profile.encryption.mode);
  if (profile.encryption.keyProvider) observed.keyProvider.add(profile.encryption.keyProvider);
  profile.identity.enabled.forEach((method) => observed.identity.add(method));
  profile.authorization.mechanisms.forEach((mechanism) => observed.authorization.add(mechanism));
  Object.entries(profile.surfaces).forEach(([surface, enabled]) => {
    if (enabled) observed.surface.add(surface);
  });
  observed.results.add(profile.results.visibility);
  observed.export.add(profile.export.scope);
  if (profile.storage.payloadAccessControl?.gate) observed.gate.add(profile.storage.payloadAccessControl.gate);
  addAccessConditions(observed, profile.storage.payloadAccessControl?.accessConditions);
  addAccessConditions(observed, profile.encryption.accessConditions);
};

describe('canonical session mode assurance fixtures', () => {
  it('keeps every reachable family valid and aligned with both Worker validators', () => {
    const fixtures = createReachableSessionModeFixtures();
    expect(new Set(fixtures.map(({ id }) => id)).size).toBe(fixtures.length);

    for (const { id, profile } of fixtures) {
      const support = classifySessionModeProfileSupport(profile);
      expect({ id, status: support.status, issues: support.validation.issues }).toEqual({
        id,
        status: 'reachable',
        issues: [],
      });

      const storageProfile = compileSessionModeProfile(profile).storageProfile;
      const config = { sessionModeProfile: profile, storageProfile };
      expect(validateDeploymentModeValues(config)).toEqual({ ok: true });
      expect(validateWorkerConfigModeValues(config)).toEqual({ ok: true });
      if (id === 'cloudflare-lit') {
        expect(profile.storage.payloadAccessControl.gate).toBe('role_gate');
        expect(storageProfile.payloadAccessControl.gate).toBe('none');
      }
    }
  });

  it('has at least one canonical fixture for every enum value declared reachable', () => {
    const observed = emptyObservedSupport();
    createReachableSessionModeFixtures().forEach(({ profile }) => observeReachableProfile(observed, profile));

    for (const [dimension, values] of Object.entries(SESSION_MODE_DECLARED_SUPPORT)) {
      for (const [value, status] of Object.entries(values)) {
        if (status === 'reachable') {
          expect({ dimension, value, covered: observed[dimension].has(value) }).toEqual({
            dimension,
            value,
            covered: true,
          });
        }
      }
    }
  });

  it('pins every non-reachable enum value to a rejecting support sentinel', () => {
    const sentinels = createUnsupportedSessionModeSentinels();
    const expectedSentinels = Object.entries(SESSION_MODE_DECLARED_SUPPORT)
      .flatMap(([dimension, values]) =>
        Object.entries(values)
          .filter(([, status]) => status !== 'reachable')
          .map(([value, status]) => `${dimension}:${value}:${status}`),
      )
      .sort();
    const actualSentinels = sentinels
      .map(({ dimension, value, expectedStatus }) => `${dimension}:${value}:${expectedStatus}`)
      .sort();

    expect(actualSentinels).toEqual(expectedSentinels);
    for (const { dimension, value, expectedStatus, expectedIssueCode, profile } of sentinels) {
      expect(SESSION_MODE_DECLARED_SUPPORT[dimension][value]).toBe(expectedStatus);
      const support = classifySessionModeProfileSupport(profile);
      expect({ dimension, value, status: support.status }).toEqual({ dimension, value, status: expectedStatus });
      expect(support.validation.issues.map(({ code }) => code)).toContain(expectedIssueCode);
      expect(validateDeploymentModeValues({ sessionModeProfile: profile })).toEqual(
        expect.objectContaining({ ok: false }),
      );
      expect(validateWorkerConfigModeValues({ sessionModeProfile: profile })).toEqual(
        expect.objectContaining({ ok: false }),
      );
    }
  });
});
