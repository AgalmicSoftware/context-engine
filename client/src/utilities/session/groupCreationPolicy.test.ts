import {
  DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY,
  GROUP_CREATION_POLICIES,
  LEGACY_GROUP_CREATION_POLICY,
  normalizeGroupCreationPolicy,
  resolveGroupCreationPolicy,
} from './groupCreationPolicy';

describe('groupCreationPolicy', () => {
  it('uses participant creation for new-session defaults and admin-only for legacy runtime records', () => {
    expect(DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY).toBe(GROUP_CREATION_POLICIES.PARTICIPANTS);
    expect(LEGACY_GROUP_CREATION_POLICY).toBe(GROUP_CREATION_POLICIES.ADMIN_ONLY);
    expect(normalizeGroupCreationPolicy(undefined)).toBe(GROUP_CREATION_POLICIES.ADMIN_ONLY);
    expect(normalizeGroupCreationPolicy(undefined, DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY)).toBe(
      GROUP_CREATION_POLICIES.PARTICIPANTS,
    );
  });

  it('accepts only the two canonical values and applies the caller-selected fallback', () => {
    expect(resolveGroupCreationPolicy({ groupCreationPolicy: 'participants' })).toBe(
      GROUP_CREATION_POLICIES.PARTICIPANTS,
    );
    expect(resolveGroupCreationPolicy({ groupCreationPolicy: 'admin_only' })).toBe(GROUP_CREATION_POLICIES.ADMIN_ONLY);
    expect(resolveGroupCreationPolicy({ groupCreationPolicy: 'everyone' })).toBe(GROUP_CREATION_POLICIES.ADMIN_ONLY);
    expect(resolveGroupCreationPolicy(null, GROUP_CREATION_POLICIES.PARTICIPANTS)).toBe(
      GROUP_CREATION_POLICIES.PARTICIPANTS,
    );
  });
});
